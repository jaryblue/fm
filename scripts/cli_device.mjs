#!/usr/bin/env node
/**
 * FM-League 真机自动化测试 CLI（Android / Capacitor WebView）
 *
 * 为什么不用 Appium：游戏是 Canvas 渲染，UI 元素不在 DOM 里，定位器全部失效。
 * 本脚本走 CDP（Chrome DevTools Protocol）连接 WebView，调用游戏内 __FM_TEST__ 桥接，
 * 用设计坐标触发真实点击链路，读取状态并截图。
 *
 * 用法：
 *   node scripts/cli_device.mjs --devices                 列出已连接设备
 *   node scripts/cli_device.mjs --apk ./app.apk --install 安装 APK 并跑冒烟测试
 *   node scripts/cli_device.mjs --smoke                   只跑冒烟测试（app 已安装）
 *   node scripts/cli_device.mjs --script ./my-test.mjs    跑自定义测试脚本
 *   node scripts/cli_device.mjs --wifi 192.168.1.23:5555  通过 WiFi 连接设备
 *   node scripts/cli_device.mjs --script ./scripts/device_new_player_flow.mjs --human --jitter 10
 *                                                        拟人点击：坐标加抖动，统计误触率
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKAGE = 'com.zaikaiyiju.fmleague';
const ACTIVITY = `${PACKAGE}/.MainActivity`;
const CDP_PORT = 9222;
const SCREENSHOT_DIR = path.join(ROOT, 'shots', 'device');

function parseArgs(argv) {
  const o = {
    devices: false,
    apk: null,
    install: false,
    smoke: false,
    setupAdb: false,
    wifi: null,
    script: null,
    serial: null,
    cdpPort: CDP_PORT,
    human: false,
    jitter: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--setup-adb') o.setupAdb = true;
    else if (a === '--devices') o.devices = true;
    else if (a === '--install') o.install = true;
    else if (a === '--smoke') o.smoke = true;
    else if (a === '--human') o.human = true;
    else if (a === '--jitter' && argv[i + 1]) o.jitter = Number(argv[++i]);
    else if (a === '--apk' && argv[i + 1]) o.apk = path.resolve(argv[++i]);
    else if (a === '--wifi' && argv[i + 1]) o.wifi = argv[++i];
    else if (a === '--script' && argv[i + 1]) o.script = path.resolve(argv[++i]);
    else if (a === '--serial' && argv[i + 1]) o.serial = argv[++i];
    else if (a === '--cdp-port' && argv[i + 1]) o.cdpPort = Number(argv[++i]);
  }
  if (!Number.isFinite(o.jitter) || o.jitter < 0) o.jitter = 10;
  return o;
}

function findAdb() {
  const candidates = [
    process.env.ADB_PATH,
    path.join(ROOT, 'tools', 'platform-tools', 'adb'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
    '/usr/local/bin/adb',
    '/opt/homebrew/bin/adb',
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const r = spawnSync('which', ['adb'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch {
    // ignore
  }
  return null;
}

let ADB = findAdb();
let SLEEP_RESTORE = null;

async function setupAdbTool() {
  const toolsDir = path.join(ROOT, 'tools');
  const ptDir = path.join(toolsDir, 'platform-tools');
  const adbPath = path.join(ptDir, 'adb');
  if (fs.existsSync(adbPath)) {
    console.log(`adb 已存在: ${adbPath}`);
    return adbPath;
  }
  const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : null;
  if (!platform) throw new Error(`不支持的平台 ${process.platform}，请手动下载 platform-tools`);
  const url = `https://dl.google.com/android/repository/platform-tools-latest-${platform}.zip`;
  const zipPath = path.join(toolsDir, 'platform-tools.zip');
  fs.mkdirSync(toolsDir, { recursive: true });
  console.log(`下载 platform-tools: ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载失败: HTTP ${resp.status}`);
  fs.writeFileSync(zipPath, Buffer.from(await resp.arrayBuffer()));
  console.log('解压中…');
  const r = spawnSync('unzip', ['-qo', zipPath, '-d', toolsDir]);
  if (r.status !== 0) throw new Error('解压失败');
  fs.rmSync(zipPath, { force: true });
  if (!fs.existsSync(adbPath)) throw new Error('解压后未找到 adb');
  execFileSync('chmod', ['+x', adbPath]);
  ADB = adbPath;
  console.log(`adb 就绪: ${adbPath}`);
  return adbPath;
}

function adb(args, opts = {}) {
  if (!ADB) {
    throw new Error(
      '未找到 adb。请先运行：node scripts/cli_device.mjs --setup-adb\n' +
      '或手动下载 Android platform-tools 放到 tools/platform-tools/'
    );
  }
  return execFileSync(ADB, args, { encoding: 'utf8', ...opts });
}

function adbFor(serial, args, opts = {}) {
  return adb(['-s', serial, ...args], opts);
}

/**
 * 屏幕休眠会让 WebView 的 requestAnimationFrame 暂停。
 * 游戏的 setRoute 走 transition.trigger()，必须靠 rAF 推进 update 才会真正切换路由。
 * 因此真机测试必须先唤醒屏幕并把自动锁屏超时调到最大，否则点击生效但路由不变，
 * 表现为「命中率 0%」的假故障。测试结束后恢复原设置。
 */
function keepDeviceAwake(serial) {
  let original = null;
  try {
    original = adbFor(serial, ['shell', 'settings', 'get', 'system', 'screen_off_timeout']).trim();
    adbFor(serial, ['shell', 'settings', 'put', 'system', 'screen_off_timeout', '2147483647']);
  } catch {
    original = null;
  }
  try {
    adbFor(serial, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  } catch {
    // 部分设备 keyevent 权限受限，忽略
  }
  console.log(`屏幕保持唤醒（原超时 ${original || '未知'}ms）`);
  return original;
}

/**
 * 锁屏 / 通知栏展开时 WebView 不可见，requestAnimationFrame 暂停，
 * 游戏里所有走 transition 的路由切换都不会推进，点击看起来「全部失效」。
 * 这里提前识别并给出可操作的提示，避免误判成按钮热区问题。
 */
function ensureAppVisible(serial) {
  try {
    const dump = adbFor(serial, ['shell', 'dumpsys', 'window']);
    const line = dump.split('\n').find(l => l.includes('mCurrentFocus=')) ?? '';
    const focus = line.split('mCurrentFocus=')[1] ?? '';
    if (focus.includes('NotificationShade') || focus.includes('Keyguard')) {
      throw new Error(
        '设备当前停在锁屏 / 通知栏（mCurrentFocus=NotificationShade）。\n' +
        'WebView 不可见时 rAF 暂停，路由切换不会推进，测试会假性 0% 命中。\n' +
        '请在手机上解锁屏幕、留在游戏画面后重新运行本命令。'
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('NotificationShade')) throw e;
    // dumpsys 不可用时不阻断
  }
}

function restoreDeviceSleep(serial, original) {
  if (!original) return;
  try {
    adbFor(serial, ['shell', 'settings', 'put', 'system', 'screen_off_timeout', original]);
    console.log(`已恢复锁屏超时 ${original}ms`);
  } catch {
    // ignore
  }
}

function listDevices() {
  const out = adb(['devices', '-l']);
  const rows = out.split('\n').slice(1).filter(l => l.trim() && !l.startsWith('*'));
  return rows.map(l => {
    const [serial, state, ...rest] = l.trim().split(/\s+/);
    return { serial, state, model: rest.find(x => x.startsWith('model:'))?.slice(6) ?? '' };
  });
}

function pickDevice(cfg) {
  const devices = listDevices().filter(d => d.state === 'device');
  if (devices.length === 0) {
    throw new Error('没有已授权的真机。请用 USB 连接并允许调试，或用 --wifi IP:5555');
  }
  if (cfg.serial) {
    const d = devices.find(x => x.serial === cfg.serial);
    if (!d) throw new Error(`设备 ${cfg.serial} 未连接`);
    return d.serial;
  }
  if (devices.length > 1) {
    console.log('检测到多台设备，默认使用第一台：');
    devices.forEach((d, i) => console.log(`  [${i}] ${d.serial} ${d.model}`));
  }
  return devices[0].serial;
}

async function waitFor(cond, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await cond()) return true;
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`等待超时：${label}`);
}

function httpJson(url) {
  return fetch(url).then(r => r.json());
}

// ---------- CDP 客户端（Node 22 自带 WebSocket） ----------
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP 调用超时: ${method}`));
        }
      }, 15000);
    });
  }

  async evalJs(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`JS 异常: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    }
    return r.result?.value;
  }

  close() {
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

async function connectCdp(serial, cfg) {
  // 找到 WebView 的 devtools socket 名
  const procLines = adbFor(serial, ['shell', 'cat', '/proc/net/unix']).split('\n');
  const sockets = procLines
    .map(l => l.match(/@(webview_devtools_remote_[^\s]+)/)?.[1])
    .filter(Boolean);
  if (sockets.length === 0) {
    throw new Error(
      '未发现 WebView 调试端口。请确认：\n' +
      '  1) 安装的是 debug APK（release 包默认不可调试）\n' +
      '  2) app 已启动且 WebView 已加载\n' +
      '  3) 开发者选项里 USB 调试已开启'
    );
  }
  const socket = sockets[0];
  // 先清掉可能残留的旧转发（否则会连到上一次运行的 WebView 进程，拿不到页面）
  try {
    execFileSync(ADB, ['-s', serial, 'forward', '--remove', `tcp:${cfg.cdpPort}`], { stdio: 'ignore' });
  } catch { /* 旧转发不存在时忽略 */ }
  adbFor(serial, ['forward', `tcp:${cfg.cdpPort}`, `localabstract:${socket}`]);

  // 等 WebView 页面真正就绪（/json 返回非空且含 page 目标）
  let targets = [];
  for (let i = 0; i < 30; i++) {
    try {
      targets = await httpJson(`http://127.0.0.1:${cfg.cdpPort}/json`);
      if (targets.some(t => t.type === 'page')) break;
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 400));
  }
  if (targets.length === 0) {
    throw new Error(`CDP 端口 ${cfg.cdpPort} 无页面目标。WebView socket=${socket}，请确认 app 已完全启动。`);
  }
  const page = targets.find(t => t.type === 'page' && (t.url.includes('localhost') || t.url.includes('file:') || t.url.includes('http')));
  if (!page) throw new Error('CDP 中未找到页面目标');
  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  return client;
}

async function enableBridge(client) {
  // 通过 localStorage 打开桥接开关，然后 reload 让 main.ts 重新执行
  await client.evalJs(`
    (() => {
      try { localStorage.setItem('fm_e2e', '1'); } catch (e) {}
      return true;
    })()
  `);
  await client.send('Page.enable');
  await client.send('Page.reload', { ignoreCache: true });
  await waitFor(async () => {
    const v = await client.evalJs(`typeof window.__FM_TEST__ !== 'undefined'`);
    return v === true;
  }, 10000, '__FM_TEST__ 桥接就绪');
}

async function screenshot(client, serial, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const dataUrl = await client.evalJs(`window.__FM_TEST__.screenshot()`);
  const base64 = String(dataUrl).split(',')[1] ?? '';
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  return file;
}

// ---------- 拟人点击与状态取证 ----------
// 精确 tap 只能证明「坐标对得上」；拟人 tap 在坐标上加抖动，
// 用来暴露「按钮热区太小 / 字太小导致手指点偏」这类真人体验问题。
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function snapshot(client) {
  // 只回传小摘要，避免整份存档经 CDP 序列化拖慢每一次点击
  return await client.evalJs(`(() => {
    const t = window.__FM_TEST__;
    const s = t.getState();
    const parts = [];
    for (const k of ['phase', 'seasonNumber', 'currentRound', 'day', 'week', 'activeSlot']) {
      if (s && k in s) parts.push(k + '=' + JSON.stringify(s[k]));
    }
    for (const k of ['squad', 'starterIds', 'hand', 'clubs', 'drafts', 'seasonRewardDrafts']) {
      if (s && Array.isArray(s[k])) parts.push(k + '.len=' + s[k].length);
    }
    if (s && s.corePackDraft) {
      parts.push('pickedCores=' + (s.corePackDraft.pickedCores?.length ?? 0));
      parts.push('choices=' + (s.corePackDraft.currentChoices?.length ?? 0));
    }
    if (s && s.draft && Array.isArray(s.draft.currentPool)) {
      parts.push('draftPool=' + s.draft.currentPool.length);
    }
    return { route: String(t.getRoute() || ''), phase: s ? String(s.phase || '') : '', sig: parts.join('|') };
  })()`);
}

async function tapHuman(client, x, y, opts = {}) {
  const jitter = opts.jitter ?? 0;
  const waitMs = opts.waitMs ?? 220;
  const rand = opts.rand ?? Math.random;
  const dx = jitter ? (rand() * 2 - 1) * jitter : 0;
  const dy = jitter ? (rand() * 2 - 1) * jitter : 0;
  const px = Math.max(4, Math.min(1276, Math.round(x + dx)));
  const py = Math.max(4, Math.min(716, Math.round(y + dy)));
  const before = await snapshot(client);
  await client.evalJs(`window.__FM_TEST__.tap(${px}, ${py})`);
  await sleep(waitMs);
  const after = await snapshot(client);

  let hit = true;
  if (opts.expectRoute && after.route !== opts.expectRoute) hit = false;
  if (opts.expectPhase && after.phase !== opts.expectPhase) hit = false;
  if (!opts.expectRoute && !opts.expectPhase && before.sig === after.sig) hit = false;

  return {
    label: opts.label ?? '',
    target: { x, y },
    actual: { x: px, y: py },
    jitter,
    before,
    after,
    changed: before.sig !== after.sig,
    hit,
  };
}

class HumanTapTracker {
  constructor(jitter = 0) {
    this.jitter = jitter;
    this.taps = [];
  }

  async tap(client, x, y, opts = {}) {
    const r = await tapHuman(client, x, y, { ...opts, jitter: opts.jitter ?? this.jitter });
    this.taps.push(r);
    return r;
  }

  stats() {
    const total = this.taps.length;
    const misses = this.taps.filter(t => !t.hit);
    const offsets = this.taps.map(t => Math.hypot(t.actual.x - t.target.x, t.actual.y - t.target.y));
    return {
      total,
      hits: total - misses.length,
      misses: misses.length,
      hitRate: total ? Number(((total - misses.length) / total).toFixed(3)) : 0,
      avgOffset: offsets.length ? Number((offsets.reduce((a, b) => a + b, 0) / offsets.length).toFixed(1)) : 0,
      maxOffset: offsets.length ? Number(Math.max(...offsets).toFixed(1)) : 0,
      missedLabels: misses.map(m => m.label),
    };
  }
}

async function waitForRoute(client, expected, timeoutMs = 30000, label = '') {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    last = String(await client.evalJs(`window.__FM_TEST__.getRoute()`) ?? '');
    if (Array.isArray(expected) ? expected.includes(last) : last === expected) return last;
    await sleep(400);
  }
  throw new Error(`等待路由超时：期望 ${JSON.stringify(expected)}，当前 ${last}${label ? ` (${label})` : ''}`);
}

async function waitForPhase(client, expected, timeoutMs = 30000, label = '') {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const s = await snapshot(client);
    last = s.phase;
    if (Array.isArray(expected) ? expected.includes(last) : last === expected) return last;
    await sleep(400);
  }
  throw new Error(`等待阶段超时：期望 ${JSON.stringify(expected)}，当前 ${last}${label ? ` (${label})` : ''}`);
}

async function clearSaveAndReload(client) {
  await client.evalJs(`(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('fm_league_save_v1') || k === 'fm_league_active_slot')) {
          localStorage.removeItem(k);
        }
      }
      localStorage.setItem('fm_e2e', '1');
    } catch (e) {}
    return true;
  })()`);
  await client.send('Page.enable');
  await client.send('Page.reload', { ignoreCache: true });
  await waitFor(async () => {
    const v = await client.evalJs(`typeof window.__FM_TEST__ !== 'undefined'`);
    return v === true;
  }, 12000, '清档后测试桥接就绪');
}

function checks(results, name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` (${detail})` : ''}`);
}

async function runSmoke(client, serial, tracker) {
  const results = [];
  console.log('\n=== 真机冒烟测试 ===');

  const version = await client.evalJs(`window.__FM_TEST__.getRunningVersion()`);
  checks(results, '版本号读取', !!version, String(version));

  const route = await client.evalJs(`window.__FM_TEST__.getRoute()`);
  checks(results, '当前路由', !!route, String(route));

  const size = await client.evalJs(`JSON.stringify(window.__FM_TEST__.getCanvasSize())`);
  checks(results, 'Canvas 尺寸', !!size && size !== '{"width":0,"height":0}', size);

  const shot1 = await screenshot(client, serial, '01_title');
  checks(results, '标题页截图', fs.statSync(shot1).size > 1000, shot1);

  // OTA 更新弹窗可能挡住点击：先点「取消」（设计坐标约 536,428）关掉。
  // ConfirmModal 渲染时会 hits.clear()，不关弹窗的话后续 tap 会被吞掉。
  // 关弹窗属于环境准备，不参与拟人误触统计
  await tracker.tap(client, 536, 428, { label: '关闭更新弹窗', jitter: 0, waitMs: 300 });

  // 点击「开启新赛季」（设计坐标 640,446）
  await tracker.tap(client, 640, 446, { label: '开始新赛季', waitMs: 1200 });
  const route2 = await client.evalJs(`window.__FM_TEST__.getRoute()`);
  checks(results, '点击开局后路由变化', route2 !== route, `${route} -> ${route2}`);

  const shot2 = await screenshot(client, serial, '02_after_start');
  checks(results, '开局后截图', fs.statSync(shot2).size > 1000, shot2);

  const state = await client.evalJs(`JSON.stringify((() => {
    const s = window.__FM_TEST__.getState();
    return { phase: s.phase, season: s.seasonNumber, round: s.currentRound, clubs: s.clubs ? s.clubs.length : 0 };
  })())`);
  checks(results, '游戏状态可读', !!state, state);

  return results;
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  console.log('\n=== FM-League 真机自动化测试 ===');
  if (cfg.setupAdb) {
    await setupAdbTool();
    if (cfg.devices === false && !cfg.apk && !cfg.smoke && !cfg.script) return;
  }
  console.log(`adb: ${ADB ?? '未找到'}`);

  if (cfg.devices) {
    if (!ADB) throw new Error('未找到 adb');
    const devices = listDevices();
    console.log('\n设备列表：');
    if (devices.length === 0) console.log('  (无)');
    for (const d of devices) console.log(`  ${d.serial}\t${d.state}\t${d.model}`);
    return;
  }

  if (cfg.wifi) {
    adb(['connect', cfg.wifi]);
    console.log(`已连接 WiFi 设备 ${cfg.wifi}`);
  }

  const serial = pickDevice(cfg);
  const originalSleepTimeout = keepDeviceAwake(serial);
  SLEEP_RESTORE = { serial, original: originalSleepTimeout };

  if (cfg.install) {
    if (!cfg.apk || !fs.existsSync(cfg.apk)) throw new Error('--install 需要 --apk 指向存在的文件');
    console.log(`\n安装 APK: ${cfg.apk}`);
    try {
      adbFor(serial, ['install', '-r', cfg.apk]);
      console.log('安装完成');
    } catch (e) {
      const msg = String(e.stdout ?? e.message ?? e);
      if (msg.includes('INSTALL_FAILED_ABORTED') || msg.includes('rejected')) {
        throw new Error(
          '安装被真机拒绝（Android 13+ 的 adb 安装验证）。请在手机上：\n' +
          '  1) 解锁屏幕，查看是否弹出「是否安装此应用」对话框并点允许\n' +
          '  2) 开发者选项 → 关闭「通过 USB 验证应用」\n' +
          '  3) 允许「安装未知应用」给 shell/文件管理器\n' +
          '然后重新运行本命令。'
        );
      }
      throw e;
    }
  }

  console.log(`\n启动应用: ${ACTIVITY}`);
  adbFor(serial, ['shell', 'am', 'force-stop', PACKAGE]);
  adbFor(serial, ['shell', 'am', 'start', '-n', ACTIVITY]);
  await new Promise(r => setTimeout(r, 2500));
  ensureAppVisible(serial);

  const client = await connectCdp(serial, cfg);
  console.log('CDP 已连接');
  await enableBridge(client);
  console.log('测试桥接已启用');

  const tracker = new HumanTapTracker(cfg.human ? cfg.jitter : 0);
  let results = [];
  if (cfg.script) {
    if (!fs.existsSync(cfg.script)) throw new Error(`脚本不存在: ${cfg.script}`);
    const mod = await import(`file://${cfg.script}`);
    if (typeof mod.default !== 'function') throw new Error('自定义脚本需 default export 一个 (client, ctx) => void 的函数');
    results = await mod.default(client, {
      serial,
      adb,
      adbFor,
      screenshot,
      sleep,
      snapshot,
      tracker,
      check: checks,
      tap: (x, y, opts) => tracker.tap(client, x, y, opts),
      waitForRoute: (expected, timeoutMs, label) => waitForRoute(client, expected, timeoutMs, label),
      waitForPhase: (expected, timeoutMs, label) => waitForPhase(client, expected, timeoutMs, label),
      clearSaveAndReload: () => clearSaveAndReload(client),
      human: cfg.human,
      jitter: tracker.jitter,
      ROOT,
      SCREENSHOT_DIR,
    }) ?? [];
  } else {
    results = await runSmoke(client, serial, tracker);
  }

  const tapStats = tracker.stats();
  console.log(`\n=== 拟人点击统计 (jitter=${tracker.jitter}px) ===`);
  console.log(`总点击 ${tapStats.total} / 命中 ${tapStats.hits} / 误触 ${tapStats.misses} / 命中率 ${(tapStats.hitRate * 100).toFixed(1)}%`);
  console.log(`平均偏移 ${tapStats.avgOffset}px / 最大偏移 ${tapStats.maxOffset}px`);
  if (tapStats.missedLabels.length > 0) {
    console.log(`误触步骤: ${tapStats.missedLabels.join('、')}`);
  }

  client.close();
  try {
    execFileSync(ADB, ['-s', serial, 'forward', '--remove', `tcp:${cfg.cdpPort}`], { stdio: 'ignore' });
  } catch { /* ignore */ }

  const failed = results.filter(r => !r.ok);
  console.log(`\n=== 结果: ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length > 0) {
    console.log('失败项：');
    for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
    process.exitCode = 1;
  }

  if (SLEEP_RESTORE) {
    restoreDeviceSleep(SLEEP_RESTORE.serial, SLEEP_RESTORE.original);
    SLEEP_RESTORE = null;
  }
}

main().catch(e => {
  console.error(`\n[真机测试失败] ${e.message}`);
  if (SLEEP_RESTORE) {
    restoreDeviceSleep(SLEEP_RESTORE.serial, SLEEP_RESTORE.original);
    SLEEP_RESTORE = null;
  }
  process.exitCode = 1;
});
