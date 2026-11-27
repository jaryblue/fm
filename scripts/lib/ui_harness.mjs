#!/usr/bin/env node
/**
 * Canvas UI 自动化测试底座（Playwright 移动端模拟）
 *
 * 为什么需要它：这个游戏的 UI 全部画在 canvas 上，没有 DOM 定位器，
 * 常规的 page.click('.btn') 完全用不了。所有交互必须走页面内的测试桥
 * `__FM_TEST__`（仅 ?e2e=1 或 localStorage.fm_e2e=1 时挂载）。
 *
 * 本底座负责三件事：
 *   1. 起静态服务器 + 起移动端模拟浏览器（isMobile + hasTouch + Android UA
 *      → Theme.IS_MOBILE 为真 → 走真实移动端布局分支）
 *   2. 提供「人话级」交互原语：tap / tapCta / tapWhere / tapUntilRoute /
 *      ensureNoModal / waitRoute / waitPhase / shot
 *   3. 提供阶段化断言器：session.stage() 统一计时、失败截图、PASS/FAIL 汇总
 *
 * 坐标系：__FM_TEST__.tap() 吃的是 1280×720 设计坐标，不是屏幕像素。
 * 真机 1600×900 时屏幕 = 设计 × 1.25，用屏幕坐标点会 100% 落空。
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const DESIGN_W = 1280;
export const DESIGN_H = 720;

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 16; V2227A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    // 开发机上 playwright 常常是 npx 缓存或临时目录装的，不一定是项目依赖
    for (const p of [
      '/tmp/pw/node_modules/playwright',
      '/Users/jary/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
    ]) {
      if (fs.existsSync(p)) return require(p);
    }
    throw new Error(
      '未找到 playwright。安装：npm i -D playwright && npx playwright install chromium'
    );
  }
}

function findHeadlessShell() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  const cacheDir = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  if (fs.existsSync(cacheDir)) {
    for (const d of fs.readdirSync(cacheDir)) {
      if (d.startsWith('chromium_headless_shell')) {
        const c = path.join(cacheDir, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
        if (fs.existsSync(c)) return c;
      }
    }
  }
  return undefined;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function startServer(appDir) {
  const root = path.resolve(appDir);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(String(req.url || '/').split('?')[0]);
    const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (!path.resolve(file).startsWith(root)) return res.writeHead(403).end();
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('404');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * 创建一次测试会话。
 * @param {object} opts
 * @param {string} [opts.appDir] 静态资源根目录，默认 apps/steam
 * @param {string} [opts.outDir] 截图输出目录，默认 shots/ui-all
 * @param {boolean} [opts.writeShots] 是否落盘 PNG，false 时只跑断言（CI 快速回归用）
 * @param {boolean} [opts.verbose] 打印每次点击详情
 */
export async function createSession(opts = {}) {
  const appDir = path.resolve(opts.appDir ?? path.join(ROOT, 'apps', 'steam'));
  const outDir = path.resolve(opts.outDir ?? path.join(ROOT, 'shots', 'ui-all'));
  const writeShots = opts.writeShots !== false;
  const verbose = !!opts.verbose;

  const { chromium } = loadPlaywright();
  const { server, port } = await startServer(appDir);

  const browser = await chromium.launch({
    ...(findHeadlessShell() ? { executablePath: findHeadlessShell() } : {}),
    headless: true,
    args: ['--single-process', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: DESIGN_W, height: DESIGN_H },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: MOBILE_UA,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

  if (writeShots) fs.mkdirSync(outDir, { recursive: true });

  const shots = [];
  const results = [];
  const sleep = (ms) => page.waitForTimeout(ms);
  const evalJs = (fn, arg) => page.evaluate(fn, arg);

  // ---------------- 只读取证 ----------------
  const route = () => evalJs(() => String(window.__FM_TEST__.getRoute() || ''));
  const phase = () => evalJs(() => String(window.__FM_TEST__.getState()?.phase || ''));
  const state = () => evalJs(() => window.__FM_TEST__.getState() ?? null);
  const modals = () => evalJs(() => window.__FM_TEST__.getModals?.() ?? []);
  const hits = () => evalJs(() => window.__FM_TEST__.getHits?.() ?? []);

  // ---------------- 交互原语 ----------------
  async function tap(x, y, waitMs = 320) {
    await evalJs(([px, py]) => window.__FM_TEST__.tap(px, py), [x, y]);
    await sleep(waitMs);
  }

  async function pressEscape() {
    await evalJs(() => window.__FM_TEST__.key('Escape', 'Escape'));
    await sleep(280);
  }

  async function shot(name, note = '') {
    const r = await route();
    const m = await modals();
    if (!writeShots) {
      shots.push({ name, file: null, route: r, modals: m, note });
      return null;
    }
    const dataUrl = await evalJs(() => window.__FM_TEST__.screenshot());
    const file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
    shots.push({ name, file, route: r, modals: m, note });
    console.log(`  截图 ${name}.png  route=${r}${m.length ? `  modal=${m.join('+')}` : ''}${note ? `  (${note})` : ''}`);
    return file;
  }

  function record(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    return ok;
  }

  async function waitRoute(expected, timeoutMs = 20000) {
    const list = Array.isArray(expected) ? expected : [expected];
    const t0 = Date.now();
    let last = '';
    while (Date.now() - t0 < timeoutMs) {
      last = await route();
      if (list.includes(last)) return last;
      await sleep(300);
    }
    throw new Error(`等待路由超时：期望 ${list.join('/')}，实际 ${last}`);
  }

  async function waitPhase(expected, timeoutMs = 30000) {
    const list = Array.isArray(expected) ? expected : [expected];
    const t0 = Date.now();
    let last = '';
    while (Date.now() - t0 < timeoutMs) {
      last = await phase();
      if (list.includes(last)) return last;
      await sleep(300);
    }
    throw new Error(`等待阶段超时：期望 ${list.join('/')}，实际 ${last}`);
  }

  /**
   * 点「底部主按钮（CTA）」。
   * 逐页抄源码坐标在排版一改就废；而主按钮的几何特征很稳定：
   * 永远是页面最右下那颗 140~560 宽、34+ 高的按钮。
   */
  async function tapCta(label, expectRoute, waitMs = 1200) {
    const hs = await hits();
    const cands = hs
      .filter((r) => r.w >= 140 && r.w <= 560 && r.h >= 34 && r.y >= 480)
      .sort((a, b) => (b.x + b.w) - (a.x + a.w) || (b.y + b.h) - (a.y + a.h));
    if (!cands.length) return null;
    const r = cands[0];
    const cx = Math.round(r.x + r.w / 2);
    const cy = Math.round(r.y + r.h / 2);
    await tap(cx, cy, waitMs);
    const after = await route();
    console.log(`  ${label}: 点击 CTA (${cx},${cy}) ${Math.round(r.w)}×${Math.round(r.h)} → route=${after}`);
    if (expectRoute) {
      const list = Array.isArray(expectRoute) ? expectRoute : [expectRoute];
      if (!list.includes(after)) {
        throw new Error(`${label} 未进入期望路由 ${list.join('/')}，实际 ${after}`);
      }
    }
    return { x: cx, y: cy, region: r, route: after };
  }

  /** 按几何条件点页面中部的功能按钮（不是右下主按钮时用） */
  async function tapWhere(pred, label, expectRoute, waitMs = 1200) {
    const hs = await hits();
    const cands = hs.filter(pred);
    if (!cands.length) throw new Error(`${label}: 没有匹配的热区（当前 ${hs.length} 个）`);
    const r = cands[0];
    const cx = Math.round(r.x + r.w / 2);
    const cy = Math.round(r.y + r.h / 2);
    await tap(cx, cy, waitMs);
    const after = await route();
    console.log(`  ${label}: 点击 (${cx},${cy}) ${Math.round(r.w)}×${Math.round(r.h)} → route=${after}`);
    if (expectRoute) {
      const list = Array.isArray(expectRoute) ? expectRoute : [expectRoute];
      if (!list.includes(after)) {
        throw new Error(`${label} 未进入期望路由 ${list.join('/')}，实际 ${after}`);
      }
    }
    return { x: cx, y: cy, region: r, route: after };
  }

  /** 依次尝试候选点，直到路由变成期望值（同一功能有多个入口时用） */
  async function tapUntilRoute(candidates, expected, label, waitMs = 1300) {
    const list = Array.isArray(expected) ? expected : [expected];
    for (const c of candidates) {
      await tap(c.x, c.y, waitMs);
      const r = await route();
      if (list.includes(r)) {
        console.log(`  ${label}: 命中 (${c.x},${c.y}) → route=${r}`);
        return r;
      }
      if (verbose) console.log(`  ${label}: (${c.x},${c.y}) 未命中，当前 route=${r}`);
    }
    throw new Error(`${label} 全部候选未命中，期望 ${list.join('/')}，当前 ${await route()}`);
  }

  /** 依次点候选热区，直到指定弹窗被打开 */
  async function tapUntilModal(candidates, modalName, label) {
    for (const r of candidates) {
      const cx = Math.round(r.x + r.w / 2);
      const cy = Math.round(r.y + r.h / 2);
      await tap(cx, cy, 320);
      if ((await modals()).includes(modalName)) {
        console.log(`  ${label}: 命中热区 (${cx},${cy}) ${Math.round(r.w)}×${Math.round(r.h)}`);
        return { x: cx, y: cy, region: r };
      }
    }
    return null;
  }

  async function closeAllModals() {
    for (let i = 0; i < 3; i++) {
      if (!(await modals()).length) return true;
      await pressEscape();
      await tap(640, 700, 200);
    }
    return (await modals()).length === 0;
  }

  /**
   * 关掉剧情弹窗（StoryModal）。
   * 它是全屏压暗 + 全屏拦截热区，不关掉会把后面所有点击吞掉。
   * 简报型底部只有一颗 300×46 的「接下战书」；抉择型要先点方案卡再点「选择此方案」。
   */
  async function dismissStoryModal(maxRounds = 4) {
    for (let i = 0; i < maxRounds; i++) {
      if (!(await modals()).includes('storyModal')) return true;
      const hs = await hits();
      const btn = hs
        .filter((r) => r.w >= 260 && r.w <= 360 && r.h >= 40 && r.h <= 60 && r.y > 420)
        .sort((a, b) => a.x - b.x)[0];
      if (btn) {
        await tap(Math.round(btn.x + btn.w / 2), Math.round(btn.y + btn.h / 2), 900);
        continue;
      }
      const card = hs.filter((r) => r.w > 250 && r.h > 150 && r.y > 140).sort((a, b) => a.x - b.x)[0];
      if (card) {
        await tap(Math.round(card.x + card.w / 2), Math.round(card.y + card.h / 2), 600);
        const hs2 = await hits();
        const pick = hs2
          .filter((r) => r.w > 200 && r.h >= 30 && r.h <= 50 && r.y > 300)
          .sort((a, b) => a.x - b.x)[0];
        if (pick) await tap(Math.round(pick.x + pick.w / 2), Math.round(pick.y + pick.h / 2), 900);
        continue;
      }
      return false;
    }
    return !(await modals()).includes('storyModal');
  }

  /**
   * 关键点击前统一清障。
   * 剧情弹窗是异步弹出的——可能在上一步动作完成后才冒出来，
   * 任何一次「点了没反应」都先怀疑是不是有模态在拦截。
   */
  async function ensureNoModal(maxRounds = 6) {
    for (let i = 0; i < maxRounds; i++) {
      const m = await modals();
      if (!m.length) return true;
      if (m.includes('storyModal')) await dismissStoryModal(2);
      else await closeAllModals();
      await sleep(350);
    }
    const left = await modals();
    if (left.length) console.log(`  [清障失败] 仍有遮挡：${left.join(',')}`);
    return left.length === 0;
  }

  // ---------------- 阶段化断言 ----------------
  async function stage(title, slug, fn) {
    console.log(`\n--- ${title} ---`);
    const t0 = Date.now();
    try {
      const detail = await fn();
      record(title, true, `${detail ?? ''} · ${Date.now() - t0}ms`);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      record(title, false, `${msg} · ${Date.now() - t0}ms`);
      await shot(`fail_${slug}`, '失败现场').catch(() => {});
      return false;
    }
  }

  async function boot({ skipIntro = true } = {}) {
    await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.__FM_TEST__ !== 'undefined', null, { timeout: 15000 });
    if (!skipIntro) return;
    // BootIntro 有 minLoadSec=1.25s + openDuration=0.55s 的强制时长，
    // 期间画的是「正在点亮球场灯光」，此时截图会抓到开场页而不是标题页。
    await sleep(700);
    await tap(640, 360, 1000); // skip()
  }

  function summary() {
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    return { total: results.length, passed, failed: failed.length, failedItems: failed, shots: shots.length };
  }

  async function close() {
    await browser.close().catch(() => {});
    server.close();
  }

  return {
    page, browser, outDir, appDir,
    sleep, evalJs,
    route, phase, state, modals, hits,
    tap, pressEscape, shot, record,
    waitRoute, waitPhase, tapCta, tapWhere, tapUntilRoute, tapUntilModal,
    closeAllModals, dismissStoryModal, ensureNoModal,
    stage, boot, summary, close,
    get shots() { return shots; },
    get results() { return results; },
    get pageErrors() { return pageErrors; },
  };
}

/** 把会话结果写成 manifest.json，并打印汇总表 */
export function writeReport(session, extra = {}) {
  const sum = session.summary();
  const manifest = {
    capturedAt: new Date().toISOString(),
    appDir: session.appDir,
    outDir: session.outDir,
    summary: sum,
    shots: session.shots,
    results: session.results,
    pageErrors: session.pageErrors,
    ...extra,
  };
  fs.mkdirSync(session.outDir, { recursive: true });
  fs.writeFileSync(path.join(session.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n=== 结果: ${sum.passed}/${sum.total} PASS ===`);
  for (const f of sum.failedItems) console.log(`  FAIL ${f.name} — ${f.detail}`);
  console.log(`截图 ${sum.shots} 张 → ${session.outDir}`);
  if (session.pageErrors.length) {
    console.log(`页面异常 ${session.pageErrors.length} 条：\n  ${session.pageErrors.slice(0, 8).join('\n  ')}`);
  }
  return manifest;
}
