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
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--setup-adb') o.setupAdb = true;
    else if (a === '--devices') o.devices = true;
    else if (a === '--install') o.install = true;
    else if (a === '--smoke') o.smoke = true;
    else if (a === '--apk' && argv[i + 1]) o.apk = path.resolve(argv[++i]);
    else if (a === '--wifi' && argv[i + 1]) o.wifi = argv[++i];
    else if (a === '--script' && argv[i + 1]) o.script = path.resolve(argv[++i]);
    else if (a === '--serial' && argv[i + 1]) o.serial = argv[++i];
    else if (a === '--cdp-port' && argv[i + 1]) o.cdpPort = Number(argv[++i]);
  }
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

function checks(results, name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` (${detail})` : ''}`);
}

async function runSmoke(client, serial) {
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
  await client.evalJs(`window.__FM_TEST__.tap(536, 428)`);
  await new Promise(r => setTimeout(r, 300));

  // 点击「开启新赛季」（设计坐标 640,446）
  await client.evalJs(`window.__FM_TEST__.tap(640, 446)`);
  await new Promise(r => setTimeout(r, 1200));
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

  const client = await connectCdp(serial, cfg);
  console.log('CDP 已连接');
  await enableBridge(client);
  console.log('测试桥接已启用');

  let results = [];
  if (cfg.script) {
    if (!fs.existsSync(cfg.script)) throw new Error(`脚本不存在: ${cfg.script}`);
    const mod = await import(`file://${cfg.script}`);
    if (typeof mod.default !== 'function') throw new Error('自定义脚本需 default export 一个 (client, ctx) => void 的函数');
    results = await mod.default(client, { serial, adb, adbFor, screenshot }) ?? [];
  } else {
    results = await runSmoke(client, serial);
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
}

main().catch(e => {
  console.error(`\n[真机测试失败] ${e.message}`);
  process.exitCode = 1;
});
