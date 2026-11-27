#!/usr/bin/env node
/**
 * 全量 UI 截图器：12 个页面 + 7 个弹窗，走真实玩家路径，不用任何作弊跳转。
 *
 * 为什么不用真机 adb：真机锁屏后（secure=true）自动化无法解锁；
 * 而 Theme.IS_MOBILE 只看 (pointer: coarse) 与 UA，Playwright 可精确模拟，
 * 画布本身是固定 1280×720 设计空间，所以布局结论与真机一致。
 * 真机仍用于验证触摸热区手感，见 scripts/cli_device.mjs。
 *
 * 依赖测试桥接新增的 getHits() / getModals() / getTutorial()：
 * Canvas 没有 DOM 定位器，靠这三个接口才能枚举「这一页有哪些可点区域」「弹窗开没开」。
 *
 * 用法：
 *   APP_DIR=/tmp/fm-capture/apps/steam node scripts/capture_ui_all.mjs
 *   OUT_DIR=shots/ui-all node scripts/capture_ui_all.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const APP_DIR = path.resolve(process.env.APP_DIR || path.join(ROOT, 'apps', 'steam'));
const OUT_DIR = path.resolve(process.env.OUT_DIR || path.join(ROOT, 'shots', 'ui-all'));

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    for (const p of ['/tmp/pw/node_modules/playwright', '/Users/jary/.npm/_npx/e41f203b7505f1fb/node_modules/playwright']) {
      if (fs.existsSync(p)) return require(p);
    }
    throw new Error('Playwright not found');
  }
}
const { chromium } = loadPlaywright();

function findHeadlessShell() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
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
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(String(req.url || '/').split('?')[0]);
  const file = path.join(APP_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!path.resolve(file).startsWith(APP_DIR)) return res.writeHead(403).end();
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('404');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await chromium.launch({
  ...(findHeadlessShell() ? { executablePath: findHeadlessShell() } : {}),
  headless: true,
  args: ['--single-process', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 16; V2227A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message || e)));

fs.mkdirSync(OUT_DIR, { recursive: true });
const manifest = [];
const results = [];

const sleep = ms => page.waitForTimeout(ms);
const evalJs = (fn, arg) => page.evaluate(fn, arg);
const route = () => evalJs(() => String(window.__FM_TEST__.getRoute() || ''));
const phase = () => evalJs(() => String(window.__FM_TEST__.getState()?.phase || ''));
const modals = () => evalJs(() => window.__FM_TEST__.getModals?.() ?? ['<无 getModals>']);
const hits = () => evalJs(() => window.__FM_TEST__.getHits?.() ?? []);

async function tap(x, y, waitMs = 320) {
  await evalJs(([px, py]) => window.__FM_TEST__.tap(px, py), [x, y]);
  await sleep(waitMs);
}

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 直接从画布取位图：1280×720 设计空间，1:1，不含系统 UI */
async function shot(name, note = '') {
  const dataUrl = await evalJs(() => window.__FM_TEST__.screenshot());
  const file = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
  const r = await route();
  const m = await modals();
  manifest.push({ name, file, route: r, modals: m, note });
  console.log(`  截图 ${name}.png  route=${r}${m.length ? `  modal=${m.join('+')}` : ''}${note ? `  (${note})` : ''}`);
  return file;
}

async function pressEscape() {
  await evalJs(() => window.__FM_TEST__.key('Escape', 'Escape'));
  await sleep(280);
}

async function closeAllModals() {
  for (let i = 0; i < 3; i++) {
    const m = await modals();
    if (!m.length) return true;
    await pressEscape();
    await tap(640, 700, 200);
  }
  return (await modals()).length === 0;
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

/** 在候选热区里找第一个能打开指定弹窗的，返回命中的热区 */
async function tapUntilModal(candidates, modalName, label) {
  for (const r of candidates) {
    const cx = Math.round(r.x + r.w / 2);
    const cy = Math.round(r.y + r.h / 2);
    await tap(cx, cy, 320);
    const m = await modals();
    if (m.includes(modalName)) {
      console.log(`  ${label}: 命中热区 (${cx},${cy}) ${r.w}×${r.h}`);
      return { x: cx, y: cy, region: r };
    }
  }
  return null;
}

/** 底部主按钮（CTA）自动定位：
 *  序章/向导/弹窗的主按钮永远在「最右下」，靠这条几何规则点击，
 *  比抄源码坐标稳得多——排版一改源码坐标就废，几何规则不会。
 *  返回 null 表示当前页没有候选。 */
async function tapCta(label, expectRoute, waitMs = 1200) {
  const hs = await hits();
  const cands = hs
    .filter(r => r.w >= 140 && r.w <= 560 && r.h >= 34 && r.y >= 480)
    .sort((a, b) => (b.x + b.w) - (a.x + a.w) || (b.y + b.h) - (a.y + a.h));
  if (!cands.length) return null;
  const r = cands[0];
  const cx = Math.round(r.x + r.w / 2);
  const cy = Math.round(r.y + r.h / 2);
  await tap(cx, cy, waitMs);
  const after = await route();
  console.log(`  ${label}: 点击 CTA (${cx},${cy}) ${r.w}×${r.h} → route=${after}`);
  if (expectRoute && !(Array.isArray(expectRoute) ? expectRoute : [expectRoute]).includes(after)) {
    throw new Error(`${label} 未进入期望路由 ${expectRoute}，实际 ${after}`);
  }
  return { x: cx, y: cy, region: r, route: after };
}

/** 依次尝试候选点，直到路由变成期望值。用于「同一功能有多个入口/按钮宽度会漂移」的场景 */
async function tapUntilRoute(candidates, expected, label, waitMs = 1300) {
  const list = Array.isArray(expected) ? expected : [expected];
  for (const c of candidates) {
    await tap(c.x, c.y, waitMs);
    const r = await route();
    if (list.includes(r)) {
      console.log(`  ${label}: 命中 (${c.x},${c.y}) → route=${r}`);
      return r;
    }
    console.log(`  ${label}: (${c.x},${c.y}) 未命中，当前 route=${r}`);
  }
  throw new Error(`${label} 全部候选未命中，期望 ${list.join('/')}，当前 ${await route()}`);
}

/** 按几何条件点击（用于不是「右下主按钮」的操作，例如页面中部的功能按钮） */
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
  if (expectRoute && !(Array.isArray(expectRoute) ? expectRoute : [expectRoute]).includes(after)) {
    throw new Error(`${label} 未进入期望路由 ${expectRoute}，实际 ${after}`);
  }
  return { x: cx, y: cy, region: r, route: after };
}

/** 关掉剧情弹窗（StoryModal）。
 *  它是全屏压暗 + 全屏拦截热区，不关掉会把后面所有点击吞掉——
 *  简报型底部只有一颗 300×46 的「接下战书」按钮（中心 640,501）；
 *  抉择型要先点一张方案卡，再点卡内的「选择此方案」。 */
async function dismissStoryModal(maxRounds = 4) {
  for (let i = 0; i < maxRounds; i++) {
    const m = await modals();
    if (!m.includes('storyModal')) return true;
    const hs = await hits();
    const btn = hs
      .filter(r => r.w >= 260 && r.w <= 360 && r.h >= 40 && r.h <= 60 && r.y > 420)
      .sort((a, b) => a.x - b.x)[0];
    if (btn) {
      await tap(Math.round(btn.x + btn.w / 2), Math.round(btn.y + btn.h / 2), 900);
      continue;
    }
    const card = hs.filter(r => r.w > 250 && r.h > 150 && r.y > 140).sort((a, b) => a.x - b.x)[0];
    if (card) {
      await tap(Math.round(card.x + card.w / 2), Math.round(card.y + card.h / 2), 600);
      const hs2 = await hits();
      const pick = hs2.filter(r => r.w > 200 && r.h >= 30 && r.h <= 50 && r.y > 300).sort((a, b) => a.x - b.x)[0];
      if (pick) await tap(Math.round(pick.x + pick.w / 2), Math.round(pick.y + pick.h / 2), 900);
      continue;
    }
    return false;
  }
  return !(await modals()).includes('storyModal');
}

/** 联赛页「进入比赛日」候选点：
 *  顶部右侧有两个宽度接近的按钮（进入比赛日 / 全开），只靠几何取一个容易取成音量键，
 *  所以给出实测主按钮坐标 + 热区枚举结果一起逐个试。 */
async function enterMatchDay() {
  await sleep(500);
  await ensureNoModal();
  const hs = await hits();
  // drawBroadcastHeader: rx=1140 起，音量键 82 宽在 (1058,16)，rightAction 148 宽在 (900,16)
  // → 「进入比赛日」中心 (974,34)。注意右边界正好是 900，用 x>900 过滤会把整块漏掉。
  const computed = hs
    .filter(r => r.y < 70 && r.h < 60 && r.x > 850)
    .sort((a, b) => a.x - b.x)
    .map(r => ({ x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) }));
  const cands = [{ x: 974, y: 34 }, ...computed.filter(c => Math.abs(c.x - 974) > 6)];
  await tapUntilRoute(cands, 'match', '进入比赛日', 1800);
}

/** 赛后肉鸽三选一：必须先点一张卡撕开盲盒，再点底部主按钮，否则一直停在 post_match */
async function finishPostMatchDraft(maxSteps = 6) {
  for (let i = 0; i < maxSteps; i++) {
    if ((await route()) !== 'post_match') return true;
    const hs = await hits();
    const card = hs
      .filter(r => r.w >= 240 && r.w <= 420 && r.h >= 280 && r.h <= 460)
      .sort((a, b) => a.x - b.x)[0];
    if (card) {
      await tap(Math.round(card.x + card.w / 2), Math.round(card.y + card.h / 2), 2600);
      await shot('20b_postmatch_card_open', '赛后 · 撕开盲盒翻牌');
      continue;
    }
    // 开完盲盒后，结算面板的「继续下一轮 · 返回门户首页」在页面中部 (636,408)，
    // 不在底部，tapCta 的 y>=480 规则抓不到；右上角还有一颗同义按钮 (1112,40)。
    for (const c of [{ x: 636, y: 408 }, { x: 1112, y: 40 }]) {
      if ((await route()) !== 'post_match') return true;
      await tap(c.x, c.y, 1600);
      if ((await route()) !== 'post_match') return true;
    }
    await sleep(700);
  }
  return (await route()) !== 'post_match';
}

/** 关键点击前的统一清障：剧情弹窗是异步弹出的，可能在上一步动作完成后才冒出来，
 *  任何一次「点了没反应」都先怀疑是不是有模态在拦截。 */
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

async function boot() {
  await page.goto(`http://127.0.0.1:${PORT}/index.html?e2e=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__FM_TEST__ !== 'undefined', null, { timeout: 15000 });
  // BootIntro 强制时长 minLoadSec=1.25s + openDuration=0.55s，
  // 期间画的是「正在点亮球场灯光」，此时截图会抓到开场页而不是标题页。
  await sleep(700);
  await tap(640, 360, 1000); // skip()
}

async function stage(title, slug, fn) {
  console.log(`\n--- ${title} ---`);
  const t0 = Date.now();
  try {
    const detail = await fn();
    record(title, true, `${detail ?? ''} · ${Date.now() - t0}ms`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    record(title, false, `${msg} · ${Date.now() - t0}ms`);
    await shot(`fail_${slug}`, '失败现场').catch(() => {});
  }
}

/**
 * 序章比赛是强制教程，三个卡点不处理就会永久死锁（时钟会冻住，不是等就能过）：
 *   1. waitingForCard  → 必须打出高亮进攻牌（拉开宽度 / 边路强突造角）
 *   2. waitingForSub   → 必须开「换人/战术」面板：点场上 #19 陈小宇 → 点替补席老队长 → 保存返回
 *   3. waitingForSkill → 必须点「立即释放 (F)」轰绝杀球
 * 坐标来自 MatchDayScreen 的 drawButton/drawChamferPanel 定义，已用 getHits() 核对。
 */
const SUB_BTN = { x: 1147, y: 112 };     // 右侧「换人/战术 (0/5)」
const SUB_ON_PITCH = { x: 613, y: 285 }; // 球场上的 ST #19 陈小宇卡片
const SUB_BENCH = { x: 978, y: 224 };    // 替补席 #10 梅利纳（老队长）
const SUB_SAVE = { x: 1147, y: 51 };     // 保存并返回比赛
const SKILL_NOW = { x: 817, y: 499 };    // 「立即释放 (F)」

async function playPrologueMatch() {
  const tutIds = { 1: 'prologue_card_wing_stance', 2: 'prologue_card_wing_combo' };
  const deadline = Date.now() + 540000; // 90' 全程 2x，约 5~8 分钟
  let p = '';
  let subDone = false;
  const seenSub = [];
  while (Date.now() < deadline) {
    const dbg = await evalJs(() => window.__FM_TEST__.getMatchDebug());
    if (!dbg) throw new Error('getMatchDebug 不可用');
    p = dbg.phase;
    if (p === 'full_time') return dbg;
    const tut = dbg.tutorial ?? {};

    if (tut.waitingForSub && !subDone) {
      console.log(`  教程换人 @${dbg.minute}'`);
      await tap(SUB_BTN.x, SUB_BTN.y, 700);
      await tap(SUB_ON_PITCH.x, SUB_ON_PITCH.y, 700);
      await tap(SUB_BENCH.x, SUB_BENCH.y, 700);
      await tap(SUB_SAVE.x, SUB_SAVE.y, 900);
      subDone = true;
      seenSub.push(dbg.minute);
      continue;
    }
    if (tut.waitingForCard) {
      const card = (dbg.hand ?? []).find(c => c.id === tutIds[tut.waitingForCard] && !c.used);
      if (card) {
        await tap(card.x, card.y, 400);
        console.log(`  教程出牌 ${card.name} @${dbg.minute}' → ${dbg.score}`);
      }
    } else if (tut.waitingForSkill) {
      await tap(SKILL_NOW.x, SKILL_NOW.y, 600);
      console.log(`  教程技能释放 @${dbg.minute}'`);
    }
    await sleep(900);
  }
  throw new Error(`序章比赛 ${Math.round((Date.now() - (deadline - 540000)) / 1000)}s 未结束，phase=${p}，换人 ${seenSub.join(',') || '未执行'}`);
}

async function main() {
  console.log(`\n=== 全量 UI 截图（12 页面 + 7 弹窗）===`);
  console.log(`源目录: ${APP_DIR}`);
  console.log(`输出目录: ${OUT_DIR}`);

  // ---------------------------------------------------------------- 标题页 + 工具栏弹窗
  await boot();
  await stage('标题页（空存档）', 'title', async () => {
    await waitRoute('title');
    await shot('01_title_fresh', '标题页 · 无存档');
    const hs = await hits();
    console.log(`  标题页可点热区 ${hs.length} 个`);
    return `热区 ${hs.length}`;
  });

  await stage('设置弹窗', 'settings', async () => {
    await tap(1212, 42, 500);
    const m = await modals();
    await shot('10_modal_settings', '设置弹窗');
    if (!m.includes('settingsModal')) throw new Error(`未打开，modals=${m.join(',')}`);
    await closeAllModals();
    return '已截图并关闭';
  });

  await stage('存档位弹窗', 'saveslot', async () => {
    await tap(1100, 42, 500);
    const m = await modals();
    await shot('11_modal_saveslot', '存档位弹窗');
    if (!m.includes('saveSlotModal')) throw new Error(`未打开，modals=${m.join(',')}`);
    await closeAllModals();
    return '已截图并关闭';
  });

  // ---------------------------------------------------------------- 序章
  await stage('序章叙事页', 'prologue', async () => {
    await tap(640, 407, 1200); // 开始新赛季 → 首次进入序章
    const r = await route();
    await shot('02_prologue', '序章 · 老将归来');
    if (r !== 'prologue') throw new Error(`期望 prologue，实际 ${r}`);
    return `route=${r}`;
  });

  await stage('序章比赛（强制教程）', 'prologue_match', async () => {
    await tap(1028, 610, 1500); // 踏上球场 · 最后一战
    await waitRoute('match');
    await shot('03_match_prologue', '序章比赛 · 教程出牌');
    const dbg = await playPrologueMatch();
    await shot('03b_match_prologue_fulltime', '序章比赛 · 全场结束');
    return `score=${dbg.score}`;
  });

  await stage('捧杯 → 双抉择 → 接过教鞭', 'prologue_end', async () => {
    // 全场结束弹窗：左「留在本页看数据」/ 右「捧起超级联赛冠军奖杯」
    await tapCta('捧起超级联赛冠军奖杯', 'match');
    const m1 = await modals();
    await shot('15_modal_story_champion', '剧情弹窗 · 捧杯');
    await tapCta('剧情弹窗 · 回到更衣室', 'prologue');
    await shot('02b_prologue_stage2', '序章 · 回到故乡');
    await tapCta('回到故乡 · 推开铁门', 'prologue');
    await shot('02c_prologue_stage3', '序章 · 双抉择');
    await tapCta('抉择 · 接过教鞭（第一段）');
    await tapCta('抉择 · 接受执教', 'title');
    await shot('02d_prologue_done', '序章结束 · 回到标题页');
    return `championModal=${m1.join(',') || '无'} → title`;
  });

  // ---------------------------------------------------------------- 建队向导 + 文本输入弹窗
  await stage('建队向导 + 队名输入弹窗', 'wizard', async () => {
    await shot('04_wizard_step1', '建队向导 · 队名与队徽');
    const hs = await hits();
    // 队名输入框：宽度 >200、高度 40~60 的宽条
    const nameBoxes = hs.filter(r => r.w > 200 && r.h >= 40 && r.h <= 60).sort((a, b) => b.w - a.w);
    const hit = await tapUntilModal(nameBoxes.slice(0, 4), 'textInputModal', '队名输入框');
    if (hit) {
      await shot('14_modal_textinput', '文本输入弹窗 · 俱乐部名称');
      await closeAllModals();
    }
    await tapCta('下一步：阵型与哲学');
    await shot('04b_wizard_step2', '建队向导 · 阵型与哲学');
    await tapCta('确认建队 · 开启核心开包', 'draft');
    return `textInput=${hit ? '已截图' : '未命中'} route=${await route()}`;
  });

  // ---------------------------------------------------------------- 核心开包 + 引导遮罩
  await stage('核心开包 + 新手引导遮罩', 'draft', async () => {
    await waitRoute('draft');
    await shot('05_draft', '核心开包');
    const tut = await evalJs(() => window.__FM_TEST__.getTutorial?.() ?? {});
    const overlayShown = !tut.skippedAll && !tut.draft;
    record('新手引导遮罩（draft 步）可见', !!overlayShown, `tutorialDone=${JSON.stringify(tut)}`);
    if (overlayShown) await shot('13_modal_tutorial', '新手引导遮罩 · 聚光灯挖空');
    await closeAllModals();
    await pressEscape(); // 收起键盘类遮挡
    await tap(812, 684, 400); // 跳过全部引导
    await shot('05b_draft_pool', '核心开包 · 5 选 3 选牌界面');

    // 注意：corePackDraft.pickedCores 只有「签入」后才填，选牌阶段要用 HUD/签入结果判断，
    // 不能用 pickedCores 判断是否选中——踩过这个坑，误判成「点牌无效」。
    const picked = () => evalJs(() => {
      const d = window.__FM_TEST__.getState()?.corePackDraft;
      return { picked: d?.pickedCores?.length ?? 0, choices: d?.currentChoices?.length ?? 0 };
    });

    const seen = [];
    for (let i = 0; i < 3; i++) {
      const before = await phase();
      await tap(640, 550, 2800);  // 撕开铁血防线包（后接约 2s 爆炸动画，必须等放完）
      await shot(`05c_draft_open${i + 1}`, `核心开包 · 第 ${i + 1} 包展开`);
      // 直接点牌：翻面动画未到 80% 时 DraftScreen 根本不注册热区，所以这里靠热区枚举取真实卡片
      const hs = await hits();
      const cards = hs
        .filter(r => r.w > 150 && r.w < 300 && r.h > 200 && r.y > 100)
        .sort((a, b) => a.x - b.x);
      if (cards.length < 3) throw new Error(`第 ${i + 1} 包只找到 ${cards.length} 张可选牌`);
      for (const c of cards.slice(0, 3)) {
        await tap(Math.round(c.x + c.w / 2), Math.round(c.y + c.h / 2), 500);
      }
      await shot(`05d_draft_picked${i + 1}`, `核心开包 · 第 ${i + 1} 包已勾选 3 人`);
      await tapCta(`签入第 ${i + 1} 包`);
      const p = await picked();
      const after = await phase();
      seen.push(`${before}→${after} 累计 ${p.picked} 人`);
      await shot(`05e_draft_round${i + 1}`, `核心开包 · 第 ${i + 1} 轮签入后`);
      if (p.picked < 3 * (i + 1)) throw new Error(`第 ${i + 1} 轮签入未生效，累计 ${p.picked} 人`);
      if (after !== 'INIT_DRAFT') break;
    }
    const p = await phase();
    if (p === 'INIT_DRAFT') throw new Error(`3 轮开包后仍停在 INIT_DRAFT（${seen.join(', ')}）`);
    return `phase=${p} 轮次 ${seen.join(', ')}`;
  });

  // ---------------------------------------------------------------- 夏窗 + 启程简报剧情弹窗
  await stage('夏窗 + 启程简报', 'summer', async () => {
    const p0 = await waitPhase(['SUMMER_WINDOW', 'REGULAR_SEASON'], 30000);
    if (p0 === 'SUMMER_WINDOW') {
      await waitRoute('portal', 10000);
      // 进入夏窗会立刻弹出「启程简报」，先截图再关
      if ((await modals()).includes('storyModal')) {
        await shot('16_modal_story_briefing', '剧情弹窗 · 启程简报');
        await dismissStoryModal();
      }
      await shot('06_portal_summer', '门户 · 季前夏窗');
      // 门户中部「补齐青训并盖章开赛」(约 358,308,312,48)
      await tapWhere(r => r.w > 280 && r.w < 380 && r.y > 290 && r.y < 390, '补齐青训并盖章开赛', undefined, 1200);
      if ((await modals()).includes('storyModal')) {
        await shot('16b_modal_story_kickoff', '剧情弹窗 · 开赛动员');
        await dismissStoryModal();
      }
    }
    const p = await waitPhase(['REGULAR_SEASON'], 30000);
    await dismissStoryModal();
    await shot('07_portal', '门户主页 · 常规赛');
    return `phase=${p}`;
  });

  // ---------------------------------------------------------------- 六个导航页
  await stage('导航页面逐个截图', 'nav', async () => {
    await dismissStoryModal();
    await waitRoute(['portal', 'league', 'tactics', 'roster', 'meta', 'hof'], 20000);
    await shot('07_portal', '门户主页');

    const rail = [
      { x: 48, y: 192, name: '08_league', label: '联赛', route: 'league' },
      { x: 48, y: 262, name: '09_tactics', label: '战术', route: 'tactics' },
      { x: 48, y: 332, name: '10_roster', label: '引援中心', route: 'roster' },
      { x: 48, y: 402, name: '11_meta', label: '星盘', route: 'meta' },
      { x: 48, y: 472, name: '12_hof', label: '荣誉室', route: 'hof' },
    ];
    const missed = [];
    for (const n of rail) {
      await ensureNoModal();
      await tap(n.x, n.y, 700);
      const r = await route();
      await shot(n.name, `${n.label}页`);
      if (r !== n.route) missed.push(`${n.label}→${r}`);
    }
    // 回到门户
    await tap(48, 122, 700);
    await shot('07b_portal_back', '门户主页（返回）');
    if (missed.length) throw new Error(`导航未命中：${missed.join('、')}`);
    return '6 个导航页全部命中';
  });

  // ---------------------------------------------------------------- 球员详情弹窗
  await stage('球员详情弹窗', 'player', async () => {
    await ensureNoModal();
    await tap(48, 332, 800); // 引援中心
    const r0 = await route();
    await shot('10b_roster_wall', '引援中心 · 大名单墙');
    const hs = await hits();
    // 球员卡：宽度 180~320、高度 100~220，排除导航栏与返回按钮
    const cards = hs
      .filter(r => r.w >= 170 && r.w <= 340 && r.h >= 96 && r.h <= 240 && r.x > 90)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    console.log(`  候选球员卡热区 ${cards.length} 个`);
    const hit = await tapUntilModal(cards.slice(0, 8), 'playerModal', '球员卡');
    await shot('17_modal_player', '球员详情弹窗');
    if (!hit) throw new Error(`未打开球员详情，route=${r0} 候选 ${cards.length}`);
    await closeAllModals();
    return `命中 (${hit.x},${hit.y})`;
  });

  // ---------------------------------------------------------------- 比赛日 → 赛后复盘
  await stage('比赛日与赛后复盘', 'match', async () => {
    await tap(48, 192, 700); // 联赛页
    // 顶部右侧有两个近似尺寸的按钮（进入比赛日 / 全开），宽度接近，
    // 直接按几何取一个会取成音量键，所以这里逐个试到路由变成 match 为止。
    await enterMatchDay();
    await shot('18_match_day', '比赛日 · 指挥界面');
    await tap(640, 360, 800); // 跳过开球动画
    await tapWhere(r => r.y > 560 && r.w > 60 && r.w < 120 && r.x > 600 && r.x < 760, '打出第一张指令卡');
    await shot('18b_match_card', '比赛日 · 出牌后');
    await tapWhere(r => r.y < 60 && r.x > 1000 && r.w > 150, '快速完赛', undefined, 1500);
    await shot('18c_match_fulltime', '比赛日 · 全场结束');
    await tapCta('查看完整复盘与开箱领奖');
    const r2 = await route();
    await shot('19_postmatch', `赛后复盘 · route=${r2}`);
    await tapCta('领取赛后肉鸽奖励');
    await shot('20_postmatch_redraft', '赛后 · 肉鸽三选一');
    await finishPostMatchDraft();
    await shot('20c_postmatch_done', `赛后结算完成 · route=${await route()}`);
    return `route=${r2} → ${await route()}`;
  });

  // ---------------------------------------------------------------- 赛季收官页
  await stage('赛季收官页（末轮快进）', 'season_end', async () => {
    // 打满 14 轮在无头环境要约 1 小时，这里只把「当前轮次」推到末轮，
    // 再正常踢完这一场让赛季自然结算——不是伪造结算画面，结算逻辑照常跑。
    const forced = await evalJs(() => {
      const st = window.__FM_TEST__.getState();
      const total = st.clubs && st.clubs.length >= 2 ? (st.clubs.length - 1) * 2 : 14;
      st.currentRound = total;
      return { total, phase: st.phase };
    });
    console.log(`  当前轮次推至末轮：total=${forced.total} phase=${forced.phase}`);
    await finishPostMatchDraft();
    // 结算收尾有 1~2s 的过场，必须等路由真的落到门户/联赛再导航，否则点击全落在过场里
    await waitRoute(['portal', 'league'], 20000);
    if ((await route()) !== 'league') await tap(48, 192, 900);
    await waitRoute('league', 8000);
    await enterMatchDay();
    await tap(640, 360, 800);
    await tapWhere(r => r.y < 60 && r.x > 1000 && r.w > 150, '快速完赛', undefined, 1500);
    await tapCta('查看完整复盘与开箱领奖');
    await tapCta('领取赛后奖励');
    const r = await route();
    await shot('23_season_end', `赛季收官 · route=${r}`);
    if (r !== 'season_end') throw new Error(`未进入收官页，route=${r}`);
    return `route=${r}`;
  });

  // ---------------------------------------------------------------- 有存档后：重置存档确认弹窗
  await stage('确认弹窗（重置存档）', 'confirm', async () => {
    // 回到标题页：导航栏底部的「主页」是回标题入口，兜底再试左上角队徽
    await ensureNoModal();
    await tap(48, 122, 700);
    // 收官页左下「返回建队主页」(170,643) / 导航栏「主页」(48,650) 都是回标题入口
    const cands = [{ x: 170, y: 643 }, { x: 48, y: 650 }];
    const hs0 = await hits();
    for (const r of hs0.filter(r => r.y < 60 && r.x < 260)) {
      cands.push({ x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) });
    }
    await tapUntilRoute(cands, 'title', '返回标题页', 1400);
    await shot('24_title_with_save', '标题页 · 有存档');

    const hs2 = await hits();
    // 工具栏四个按钮：y<60，按 x 从右到左是 设置/存档位/重置存档/退出
    const tools = hs2.filter(r => r.y < 60 && r.h < 60).sort((a, b) => a.x - b.x);
    console.log(`  标题页工具栏热区 ${tools.length} 个：${tools.map(t => `${t.x}~${t.x + t.w}`).join(' | ')}`);
    const reset = tools.find(t => t.x > 880 && t.x < 1060);
    if (!reset) throw new Error(`未找到重置存档按钮，工具栏 ${tools.length} 个`);
    await tap(Math.round(reset.x + reset.w / 2), Math.round(reset.y + reset.h / 2), 500);
    const m = await modals();
    await shot('22_modal_confirm', '确认弹窗 · 重置存档（危险样式）');
    if (!m.includes('confirmModal')) throw new Error(`未打开确认弹窗，modals=${m.join(',')}`);
    await pressEscape();
    const after = await modals();
    record('确认弹窗可安全关闭（未误触重置）', !after.includes('confirmModal'), `关闭后 modals=${after.join(',') || '无'}`);
    return '已截图并关闭';
  });

  console.log(`\n=== 结果: ${results.filter(r => r.ok).length}/${results.length} PASS ===`);
  for (const f of results.filter(r => !r.ok)) console.log(`  FAIL ${f.name} — ${f.detail}`);
  console.log(`\n截图 ${manifest.length} 张 → ${OUT_DIR}`);
  if (pageErrors.length) console.log(`页面异常 ${pageErrors.length} 条：\n  ${pageErrors.slice(0, 8).join('\n  ')}`);
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ appDir: APP_DIR, capturedAt: new Date().toISOString(), shots: manifest, results, pageErrors }, null, 2)
  );
  if (results.some(r => !r.ok)) process.exitCode = 1;
}

try {
  await main();
} finally {
  await browser.close();
  server.close();
}
