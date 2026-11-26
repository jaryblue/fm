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
    return require('/Users/jary/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
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

const execPath = [
  process.env.CHROMIUM_PATH,
  '/Users/jary/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
].find(p => p && fs.existsSync(p));

const browser = await chromium.launch({
  ...(execPath ? { executablePath: execPath } : {}),
  headless: true,
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
let currentSaveKey = `${SAVE_KEY_BASE}_GUEST01`;
async function getSave() {
  const raw = saveStore.get(currentSaveKey);
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
await page.waitForTimeout(1200);

// 1. 进入建队/开局：点击「开启新赛季」(TitleScreen) -> 跳过序章或快速建队
await clickCanvas(640, 446, 400);
// 若进入序章，连续点击跳过/推进直到进入建队或选秀
for (let i = 0; i < 8; i++) {
  const sv = await getSave();
  if (sv && (sv.phase === 'INIT_DRAFT' || sv.phase === 'SUMMER_WINDOW' || sv.phase === 'REGULAR_SEASON')) break;
  await clickCanvas(1170, 56, 200);
  await clickCanvas(640, 590, 200);
}
const afterStart = await getSave();
record(
  'Title/Start New Season',
  !!afterStart && ['INIT_DRAFT', 'SUMMER_WINDOW', 'REGULAR_SEASON'].includes(afterStart.phase),
  afterStart ? `phase=${afterStart.phase}` : 'NO_SAVE_WRITTEN'
);

// 2. 若仍在 DraftScreen，测试「一键推荐选满」+ 确认签入
for (let pack = 0; pack < 3; pack++) {
  const sv = await getSave();
  if (!sv || sv.phase !== 'INIT_DRAFT') break;
  await clickCanvas(1001, 149, 250); // 一键推荐选满
  await clickCanvas(640, 573, 350); // 确认签入
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

// 3. 若在 SUMMER_WINDOW，测试「补齐青训并开赛」1 步直达
if (afterDraft?.phase === 'SUMMER_WINDOW') {
  await clickCanvas(579, 332, 400);
  const afterSummer = await getSave();
  const uc = afterSummer?.clubs?.find(c => c.id === afterSummer.userClubId);
  record(
    'PortalScreen 一键补齐青训并开赛',
    afterSummer?.phase === 'REGULAR_SEASON' && (uc?.squad?.length ?? 0) >= 26,
    `phase=${afterSummer?.phase}, squad=${uc?.squad?.length}`
  );
}

// 4. 导航至战术室：测试防误触换位 & 浮层触发换人
await clickCanvas(48, 224, 350);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
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

// 5. 导航至手牌工坊与赛程页，验证无运行时异常
await clickCanvas(48, 286, 250);
await page.keyboard.press('Escape');
await clickCanvas(48, 348, 250);
record('CardCraft & League 页面切换无报错', errors.length === 0);

await browser.close();

console.log('\n=== FM-League UI E2E 自动化校验报告 ===');
for (const c of checks) {
  console.log(`${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
console.log(`ERROR_LOGS: ${errors.length} ${JSON.stringify(errors)}`);
console.log(`MISSING_ASSETS: ${missingAssets.length} ${JSON.stringify(missingAssets)}`);

const failed = checks.some(c => !c.ok) || errors.length > 0 || missingAssets.length > 0;
process.exit(failed ? 1 : 0);
