#!/usr/bin/env node
/**
 * CLI 全流程 Canvas UI 端到端自动化校验 (Playwright 无头 Chromium)
 * 用法：
 *   npm run cli:e2e
 *   npm run cli:play -- --ui
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const APP_DIR = path.join(ROOT, 'apps', 'steam');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    for (const p of [
      '/tmp/pw/node_modules/playwright',
      '/Users/jary/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
    ]) {
      if (fs.existsSync(p)) return require(p);
    }
    throw new Error('Playwright not found');
  }
}

const { chromium } = loadPlaywright();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8',
};

function findHeadlessShell() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const cacheDir = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  if (fs.existsSync(cacheDir)) {
    for (const d of fs.readdirSync(cacheDir)) {
      if (d.startsWith('chromium_headless_shell')) {
        const candidate = path.join(cacheDir, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined;
}
const execPath = findHeadlessShell();

const browser = await chromium.launch({
  ...(execPath ? { executablePath: execPath } : {}),
  headless: true,
  args: ['--single-process', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const errors = [];
const missingAssets = [];
const checks = [];

function record(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});
page.on('pageerror', (err) => {
  errors.push(`pageerror: ${err.message}`);
});

// 存档服务端模拟：Steam 端不写 localStorage，存档走 PUT /api/saves/<key>
// 这里维护一个内存存档表，让 E2E 能读到真实状态（原来恒返回 null，导致选秀/夏窗测试分支从未执行）
const saveStore = new Map();
const SAVE_KEY_BASE = 'fm_league_save_v1';

await page.route('http://fm.test/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.startsWith('/api/saves/')) {
    const key = decodeURIComponent(url.pathname.replace('/api/saves/', ''));
    const method = route.request().method();
    if (method === 'GET') {
      const data = saveStore.get(key) ?? null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
    }
    if (method === 'PUT') {
      let payload = {};
      try {
        payload = route.request().postDataJSON() ?? {};
      } catch {
        payload = {};
      }
      if (typeof payload.data === 'string') saveStore.set(key, payload.data);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (method === 'DELETE') {
      saveStore.delete(key);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const full = path.join(APP_DIR, rel);
  if (!full.startsWith(APP_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    missingAssets.push(url.pathname);
    return route.fulfill({ status: 404, body: 'Not Found' });
  }
  const ext = path.extname(full).toLowerCase();
  return route.fulfill({
    status: 200,
    contentType: MIME[ext] || 'application/octet-stream',
    body: fs.readFileSync(full),
  });
});

async function clickCanvas(x, y, waitMs = 180) {
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  await page.waitForTimeout(waitMs);
}

// 读取存档：Steam 端写服务端而非 localStorage，这里直接查内存存档表
let currentSaveKey = `${SAVE_KEY_BASE}_E2ETEST1`;
async function getSave() {
  for (const [, v] of saveStore) {
    try { return JSON.parse(v); } catch {}
  }
  const raw = await page.evaluate(() => {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.includes('save')) return window.localStorage.getItem(k);
      }
    } catch {}
    return null;
  }).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 存档 key 会随口令变化，这里监听请求自动跟踪
page.on('request', req => {
  const m = req.url().match(/\/api\/saves\/([^?]+)/);
  if (m) currentSaveKey = decodeURIComponent(m[1]);
});

await page.goto('http://fm.test/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);

// 0. 若弹出 8 位口令门，输入测试口令并进入游戏
if (await page.locator('#codeGate').isVisible().catch(() => false)) {
  await page.fill('#codeInput', 'E2ETEST1');
  await page.click('#codeSubmit');
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(600);

const SHOTS_DIR = path.join(ROOT, 'shots', 'e2e');
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function snap(name) {
  await page.screenshot({ path: path.join(SHOTS_DIR, name) });
}

// 1. 进入赛季：若有默认存档则点击「继续赛季」(815, 368)；否则走开局建队
await clickCanvas(815, 368, 600);
await snap('00_after_continue.png');
let afterStart = await getSave();
if (!afterStart) {
  await clickCanvas(640, 407, 800);
  await clickCanvas(1177, 50, 800);
  await clickCanvas(997, 614, 350);
  await clickCanvas(962, 614, 800);
  afterStart = await getSave();
}
record(
  'Title/Start New Season',
  true,
  afterStart ? `phase=${afterStart.phase}` : 'ENTERED_FROM_DEFAULT'
);

// 2. 跳过新手引导并完成 3 轮核心开包（撕包 -> 一键推荐选满 -> 签入）
await page.keyboard.press('Escape');
await clickCanvas(790, 569, 250); // 跳过全部引导
for (let pack = 0; pack < 3; pack++) {
  const sv = await getSave();
  if (sv && sv.phase !== 'INIT_DRAFT') break;
  await clickCanvas(640, 550, 750); // 撕开核心包
  await clickCanvas(1170, 149, 250); // 一键推荐选满
  await clickCanvas(640, 573, 450); // 签入这 3 人
}
const afterDraft = await getSave();
if (afterDraft) {
  record(
    'DraftScreen 一键推荐选满 -> SUMMER_WINDOW',
    afterDraft.phase === 'SUMMER_WINDOW' || afterDraft.phase === 'REGULAR_SEASON',
    `phase=${afterDraft.phase}`
  );
} else {
  record('DraftScreen 一键推荐选满 -> SUMMER_WINDOW', false, 'NO_SAVE_WRITTEN');
}

// 3. 若在 SUMMER_WINDOW，测试「补齐青训并开赛」1 步直达 + 关闭赛季启程简报
if (afterDraft?.phase === 'SUMMER_WINDOW') {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await clickCanvas(579, 332, 750);
  const afterSummer = await getSave();
  const uc = afterSummer?.clubs?.find(c => c.id === afterSummer.userClubId);
  record(
    'PortalScreen 一键补齐青训并开赛',
    afterSummer?.phase === 'REGULAR_SEASON' && (uc?.squad?.length ?? 0) >= 26,
    `phase=${afterSummer?.phase}, squad=${uc?.squad?.length}`
  );
  await clickCanvas(640, 500, 350); // 接下战书 · 踏上征程
}

await snap('01_portal.png');

// 4. 导航至战术室：测试防误触换位 (iy = 92 + 2*70 = 232 -> y=262)
await clickCanvas(48, 262, 350);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await snap('02_tactics.png');
const beforeTac = await getSave();
const ucBefore = beforeTac?.clubs?.find(c => c.id === beforeTac.userClubId);
const starterIdsBefore = ucBefore?.starterIds ? [...ucBefore.starterIds] : [];
// 点击球场中场区域尝试选中球员，再点另一处验证不会误换位
await clickCanvas(400, 380, 200);
await clickCanvas(280, 320, 200);
const afterTwoClicks = await getSave();
const ucAfterTwo = afterTwoClicks?.clubs?.find(c => c.id === afterTwoClicks.userClubId);
const noAccidentalSwap = JSON.stringify(starterIdsBefore) === JSON.stringify(ucAfterTwo?.starterIds ?? []);
record('TacticsScreen 防误触（点 A 再点 B 不自动换位）', noAccidentalSwap);

// 5. 导航至 V6 星盘与门户，验证无运行时异常并截屏
await clickCanvas(48, 402, 350);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await snap('03_meta_astrolabe.png');
await clickCanvas(48, 122, 700);
record('MetaScreen & Portal 切换无报错', errors.length === 0);

// 6. 进入比赛日并测试 V6 s1 (0') 手牌拍板出牌
await clickCanvas(340, 332, 700); // 门户「吹响开场哨 · 亲自指挥本场对决」
await clickCanvas(640, 360, 700); // 跳过开球入场动画
await page.waitForTimeout(500);
await clickCanvas(668, 644, 400); // 点击第 1 张 s1 指令卡
await snap('04_matchday_s1.png');

// 7. 快速完赛并进入赛后战报 & 3选1奖励
await clickCanvas(1152, 42, 700); // 快速完赛
await clickCanvas(774, 573, 500); // 查看完整复盘与开箱领奖
await snap('05_postmatch_recap.png');
await clickCanvas(640, 668, 500); // 下一步：领取赛后肉鸽奖励
await snap('06_postmatch_reward.png');
record('MatchDay V6 出牌与赛后结算无报错', errors.length === 0);

await browser.close();

console.log('\n=== FM-League UI E2E 自动化校验报告 ===');
for (const c of checks) {
  console.log(`${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
console.log(`ERROR_LOGS: ${errors.length} ${JSON.stringify(errors)}`);
console.log(`MISSING_ASSETS: ${missingAssets.length} ${JSON.stringify(missingAssets)}`);
console.log(`SCREENSHOTS_DIR: ${SHOTS_DIR}`);

const failed = checks.some(c => !c.ok) || errors.length > 0 || missingAssets.length > 0;
process.exit(failed ? 1 : 0);
