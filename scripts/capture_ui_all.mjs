#!/usr/bin/env node
/**
 * UI 全量回归：走真实玩家路径，覆盖 12 个页面 + 7 个弹窗。
 *
 * 这不是「截图脚本」，是回归测试：每个阶段都有状态断言（路由 / 阶段 / 选中人数），
 * 失败会立刻截图现场并继续跑后续阶段，最后给出 PASS/FAIL 汇总与非零退出码。
 *
 * 用法：
 *   npm run cli:ui                     # 默认：apps/steam + shots/ui-all，产出截图
 *   npm run cli:ui -- --no-shots       # 只跑断言不落盘（CI 快速回归）
 *   npm run cli:ui -- --out=shots/xxx  # 指定输出目录
 *   npm run cli:ui -- --app-dir=...    # 指定静态资源目录
 *   npm run cli:ui -- --list           # 列出所有阶段
 *   npm run cli:ui -- --verbose        # 打印每次点击详情
 *
 * 阶段顺序即真实玩家顺序：序章 → 建队 → 开包 → 夏窗 → 常规赛 → 收官。
 * 中间任何一跳失败，后面的阶段会继续跑（如实暴露级联问题），不会中止。
 *
 * 已知硬约束（改版时最容易踩）：
 *   - tap 用 1280×720 设计坐标，不是屏幕像素
 *   - 撕包后有约 2s 爆炸动画；翻面进度 <80% 时 DraftScreen 不注册热区
 *   - corePackDraft.pickedCores 只在「签入」后填充，选牌阶段不能拿它判断
 *   - 剧情弹窗异步弹出且全屏拦截，关键点击前要 ensureNoModal
 */

import path from 'node:path';
import { createSession, writeReport, ROOT } from './lib/ui_harness.mjs';

function parseArgs(argv) {
  const out = { writeShots: true, verbose: false };
  for (const a of argv) {
    if (a === '--no-shots') out.writeShots = false;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--list') out.list = true;
    else if (a.startsWith('--out=')) out.outDir = a.slice(6);
    else if (a.startsWith('--app-dir=')) out.appDir = a.slice(10);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

const STAGES = [
  '标题页（空存档）',
  '设置弹窗',
  '存档位弹窗',
  '序章叙事页',
  '序章比赛（强制教程）',
  '捧杯 → 双抉择 → 接过教鞭',
  '建队向导 + 队名输入弹窗',
  '核心开包 + 新手引导遮罩',
  '夏窗 + 启程简报',
  '导航页面逐个截图',
  '球员详情弹窗',
  '比赛日与赛后复盘',
  '赛季收官页（末轮快进）',
  '确认弹窗（重置存档）',
];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(
    'UI 全量回归\n\n  --no-shots        只跑断言，不写 PNG\n  --out=DIR         截图输出目录\n  --app-dir=DIR     静态资源目录\n  --verbose         打印每次点击\n  --list            列出阶段\n'
  );
  process.exit(0);
}
if (args.list) {
  STAGES.forEach((s, i) => console.log(`${String(i + 1).padStart(2, '0')}. ${s}`));
  process.exit(0);
}

/** 序章比赛是强制教程，四个卡点不处理时钟会永久冻结（不是慢放） */
const SUB_BTN = { x: 1147, y: 112 };     // 右侧「换人/战术 (0/5)」
const SUB_ON_PITCH = { x: 613, y: 285 }; // 球场上的 ST #19 陈小宇
const SUB_BENCH = { x: 978, y: 224 };    // 替补席 #10 梅利纳（老队长）
const SUB_SAVE = { x: 1147, y: 51 };     // 保存并返回比赛
const SKILL_NOW = { x: 817, y: 499 };    // 「立即释放 (F)」

async function main() {
  console.log('\n=== FM-League UI 全量回归 ===');
  const s = await createSession({
    appDir: args.appDir ?? path.join(ROOT, 'apps', 'steam'),
    outDir: args.outDir ?? path.join(ROOT, 'shots', 'ui-all'),
    writeShots: args.writeShots,
    verbose: args.verbose,
  });
  console.log(`源目录: ${s.appDir}`);
  console.log(`输出目录: ${s.outDir}${args.writeShots ? '' : '（--no-shots，不落盘）'}`);

  const {
    tap, shot, hits, route, modals, stage, tapCta, tapWhere, tapUntilRoute, tapUntilModal,
    waitRoute, waitPhase, ensureNoModal, dismissStoryModal, closeAllModals, pressEscape, sleep,
  } = s;

  /** 打满序章比赛（含换人 + 绝杀技） */
  async function playPrologueMatch() {
    const tutIds = { 1: 'prologue_card_wing_stance', 2: 'prologue_card_wing_combo' };
    const deadline = Date.now() + 540000;
    let subDone = false;
    let p = '';
    while (Date.now() < deadline) {
      const dbg = await s.evalJs(() => window.__FM_TEST__.getMatchDebug());
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
        continue;
      }
      if (tut.waitingForCard) {
        const card = (dbg.hand ?? []).find((c) => c.id === tutIds[tut.waitingForCard] && !c.used);
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
    throw new Error(`序章比赛未在时限内结束，phase=${p}`);
  }

  /** 联赛页「进入比赛日」：顶部两个按钮宽度接近，坐标算错会点成音量键 */
  async function enterMatchDay() {
    await sleep(500);
    await ensureNoModal();
    const hs = await hits();
    // drawBroadcastHeader: rx=1140，音量键 82 宽在 (1058,16)，rightAction 148 宽在 (900,16)
    // → 中心 (974,34)。右边界正好 900，用 x>900 过滤会把整块漏掉。
    const computed = hs
      .filter((r) => r.y < 70 && r.h < 60 && r.x > 850)
      .sort((a, b) => a.x - b.x)
      .map((r) => ({ x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) }));
    const cands = [{ x: 974, y: 34 }, ...computed.filter((c) => Math.abs(c.x - 974) > 6)];
    await tapUntilRoute(cands, 'match', '进入比赛日', 1800);
  }

  /** 赛后肉鸽三选一：必须点一张卡撕开盲盒，再点结算面板的继续 */
  async function finishPostMatchDraft(maxSteps = 6) {
    for (let i = 0; i < maxSteps; i++) {
      if ((await route()) !== 'post_match') return true;
      const hs = await hits();
      const card = hs
        .filter((r) => r.w >= 240 && r.w <= 420 && r.h >= 280 && r.h <= 460)
        .sort((a, b) => a.x - b.x)[0];
      if (card) {
        await tap(Math.round(card.x + card.w / 2), Math.round(card.y + card.h / 2), 2600);
        await shot('20b_postmatch_card_open', '赛后 · 撕开盲盒翻牌');
        continue;
      }
      // 结算面板的「继续下一轮 · 返回门户首页」在页面中部 (636,408)，
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

  try {
    // ---------------------------------------------------------------- 标题页 + 工具栏弹窗
    await s.boot();

    await stage('标题页（空存档）', 'title', async () => {
      await waitRoute('title');
      await shot('01_title_fresh', '标题页 · 无存档');
      const hs = await hits();
      return `可点热区 ${hs.length}`;
    });

    await stage('设置弹窗', 'settings', async () => {
      await tap(1212, 42, 500);
      const m = await modals();
      await shot('10_modal_settings', '设置弹窗');
      if (!m.includes('settingsModal')) throw new Error(`未打开，modals=${m.join(',') || '无'}`);
      await closeAllModals();
      return '已截图并关闭';
    });

    await stage('存档位弹窗', 'saveslot', async () => {
      await tap(1100, 42, 500);
      const m = await modals();
      await shot('11_modal_saveslot', '存档位弹窗');
      if (!m.includes('saveSlotModal')) throw new Error(`未打开，modals=${m.join(',') || '无'}`);
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
      await tapCta('捧起超级联赛冠军奖杯', 'match');
      const m1 = await modals();
      await shot('15_story_champion', '赛后捧杯过场');
      await tapCta('剧情弹窗 · 回到更衣室', 'prologue');
      await shot('02b_prologue_stage2', '序章 · 回到故乡');
      await tapCta('回到故乡 · 推开铁门', 'prologue');
      await shot('02c_prologue_stage3', '序章 · 双抉择');
      await tapCta('抉择 · 接过教鞭（第一段）');
      await tapCta('抉择 · 接受执教', 'title');
      await shot('02d_prologue_done', '序章结束 · 回到标题页');
      return `弹窗=${m1.join(',') || '无'} → title`;
    });

    // ---------------------------------------------------------------- 建队向导 + 文本输入
    await stage('建队向导 + 队名输入弹窗', 'wizard', async () => {
      await shot('04_wizard_step1', '建队向导 · 队名与队徽');
      const hs = await hits();
      const nameBoxes = hs.filter((r) => r.w > 200 && r.h >= 40 && r.h <= 60).sort((a, b) => b.w - a.w);
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
      const tut = await s.evalJs(() => window.__FM_TEST__.getTutorial?.() ?? {});
      const overlayShown = !tut.skippedAll && !tut.draft;
      s.record('新手引导遮罩（draft 步）可见', !!overlayShown, `tutorialDone=${JSON.stringify(tut)}`);
      if (overlayShown) await shot('13_modal_tutorial', '新手引导遮罩 · 聚光灯挖空');
      await closeAllModals();
      await pressEscape();
      await tap(812, 684, 400); // 跳过全部引导
      await shot('05b_draft_pool', '核心开包 · 5 选 3 选牌界面');

      const pickedCount = () =>
        s.evalJs(() => window.__FM_TEST__.getState()?.corePackDraft?.pickedCores?.length ?? 0);
      const seen = [];
      for (let i = 0; i < 3; i++) {
        const before = await s.phase();
        await tap(640, 550, 2800); // 撕包 + 等爆炸动画
        await shot(`05c_draft_open${i + 1}`, `核心开包 · 第 ${i + 1} 包展开`);
        const hs = await hits();
        const cards = hs
          .filter((r) => r.w > 150 && r.w < 300 && r.h > 200 && r.y > 100)
          .sort((a, b) => a.x - b.x);
        if (cards.length < 3) throw new Error(`第 ${i + 1} 包只找到 ${cards.length} 张可选牌`);
        for (const c of cards.slice(0, 3)) {
          await tap(Math.round(c.x + c.w / 2), Math.round(c.y + c.h / 2), 500);
        }
        await shot(`05d_draft_picked${i + 1}`, `核心开包 · 第 ${i + 1} 包已勾选 3 人`);
        await tapCta(`签入第 ${i + 1} 包`);
        const picked = await pickedCount();
        const after = await s.phase();
        seen.push(`${before}→${after} 累计 ${picked} 人`);
        await shot(`05e_draft_round${i + 1}`, `核心开包 · 第 ${i + 1} 轮签入后`);
        if (picked < 3 * (i + 1)) throw new Error(`第 ${i + 1} 轮签入未生效，累计 ${picked} 人`);
        if (after !== 'INIT_DRAFT') break;
      }
      const p = await s.phase();
      if (p === 'INIT_DRAFT') throw new Error(`3 轮开包后仍停在 INIT_DRAFT（${seen.join('，')}）`);
      return `phase=${p} 轮次 ${seen.join('，')}`;
    });

    // ---------------------------------------------------------------- 夏窗 + 启程简报
    await stage('夏窗 + 启程简报', 'summer', async () => {
      const p0 = await waitPhase(['SUMMER_WINDOW', 'REGULAR_SEASON'], 30000);
      if (p0 === 'SUMMER_WINDOW') {
        await waitRoute('portal', 10000);
        if ((await modals()).includes('storyModal')) {
          await shot('16_modal_story_briefing', '剧情弹窗 · 启程简报');
          await dismissStoryModal();
        }
        await shot('06_portal_summer', '门户 · 季前夏窗');
        await tapWhere((r) => r.w > 280 && r.w < 380 && r.y > 290 && r.y < 390, '补齐青训并盖章开赛', undefined, 1200);
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

      // NavRail 热区：x=48，中心 y = 92 + i*70 + 30
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
      await tap(48, 122, 700);
      await shot('07b_portal_back', '门户主页（返回）');
      if (missed.length) throw new Error(`导航未命中：${missed.join('、')}`);
      return '6 个导航页全部命中';
    });

    // ---------------------------------------------------------------- 球员详情
    await stage('球员详情弹窗', 'player', async () => {
      await ensureNoModal();
      await tap(48, 332, 800);
      await shot('10b_roster_wall', '引援中心 · 大名单墙');
      const hs = await hits();
      const cards = hs
        .filter((r) => r.w >= 170 && r.w <= 340 && r.h >= 96 && r.h <= 240 && r.x > 90)
        .sort((a, b) => a.y - b.y || a.x - b.x);
      const hit = await tapUntilModal(cards.slice(0, 8), 'playerModal', '球员卡');
      await shot('17_modal_player', '球员详情弹窗');
      if (!hit) throw new Error(`未打开球员详情，候选 ${cards.length} 张卡`);
      await closeAllModals();
      return `命中 (${hit.x},${hit.y})`;
    });

    // ---------------------------------------------------------------- 比赛日 → 赛后
    await stage('比赛日与赛后复盘', 'match', async () => {
      await tap(48, 192, 700);
      await enterMatchDay();
      await shot('18_match_day', '比赛日 · 指挥界面');
      await tap(640, 360, 800); // 跳过开球动画
      await tapWhere((r) => r.y > 560 && r.w > 60 && r.w < 120 && r.x > 600 && r.x < 760, '打出第一张指令卡');
      await shot('18b_match_card', '比赛日 · 出牌后');
      await tapWhere((r) => r.y < 60 && r.x > 1000 && r.w > 150, '快速完赛', undefined, 1500);
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

    // ---------------------------------------------------------------- 赛季收官
    await stage('赛季收官页（末轮快进）', 'season_end', async () => {
      // 打满 18 轮在无头环境要一小时，这里只把「当前轮次」推到末轮，
      // 再正常踢完这一场让赛季自然结算——不是伪造结算画面，结算逻辑照常跑。
      const forced = await s.evalJs(() => {
        const st = window.__FM_TEST__.getState();
        const total = st.clubs && st.clubs.length >= 2 ? (st.clubs.length - 1) * 2 : 14;
        st.currentRound = total;
        return { total, phase: st.phase };
      });
      console.log(`  当前轮次推至末轮：total=${forced.total} phase=${forced.phase}`);
      await finishPostMatchDraft();
      await waitRoute(['portal', 'league'], 20000);
      if ((await route()) !== 'league') await tap(48, 192, 900);
      await waitRoute('league', 8000);
      await enterMatchDay();
      await tap(640, 360, 800);
      await tapWhere((r) => r.y < 60 && r.x > 1000 && r.w > 150, '快速完赛', undefined, 1500);
      await tapCta('查看完整复盘与开箱领奖');
      await tapCta('领取赛后奖励');
      const r = await route();
      await shot('23_season_end', `赛季收官 · route=${r}`);
      if (r !== 'season_end') throw new Error(`未进入收官页，route=${r}`);
      return `route=${r}`;
    });

    // ---------------------------------------------------------------- 确认弹窗
    await stage('确认弹窗（重置存档）', 'confirm', async () => {
      await ensureNoModal();
      await tap(48, 122, 700);
      // 收官页左下「返回建队主页」(170,643) / 导航栏「主页」(48,650)
      const cands = [{ x: 170, y: 643 }, { x: 48, y: 650 }];
      for (const r of (await hits()).filter((h) => h.y < 60 && h.x < 260)) {
        cands.push({ x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) });
      }
      await tapUntilRoute(cands, 'title', '返回标题页', 1400);
      await shot('24_title_with_save', '标题页 · 有存档');

      // 工具栏按 x 从右到左：设置 / 存档位 / 重置存档
      const tools = (await hits()).filter((r) => r.y < 60 && r.h < 60).sort((a, b) => a.x - b.x);
      const reset = tools.find((t) => t.x > 880 && t.x < 1060);
      if (!reset) throw new Error(`未找到重置存档按钮，工具栏 ${tools.length} 个`);
      await tap(Math.round(reset.x + reset.w / 2), Math.round(reset.y + reset.h / 2), 500);
      const m = await modals();
      await shot('22_modal_confirm', '确认弹窗 · 重置存档（危险样式）');
      if (!m.includes('confirmModal')) throw new Error(`未打开确认弹窗，modals=${m.join(',') || '无'}`);
      await pressEscape();
      s.record('确认弹窗可安全关闭（未误触重置）', !(await modals()).includes('confirmModal'));
      return '已截图并关闭';
    });
  } finally {
    writeReport(s, { args });
    const sum = s.summary();
    await s.close();
    if (sum.failed > 0) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`\n[UI 回归异常] ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
