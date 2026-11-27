#!/usr/bin/env node
/**
 * 新玩家入坑 · 真机拟人体验测试
 *
 * 与 cli_ui_e2e.mjs 的区别：
 *   - E2E 用精确坐标，只证明「流程能通」
 *   - 本脚本走完整新玩家路径（序章 → 建队 → 开包 → 夏窗 → 首战），
 *     所有关键按钮通过 --human 加坐标抖动，暴露「热区小 / 字小点不中」问题。
 *
 * 用法：
 *   npm run cli:device -- --script ./scripts/device_new_player_flow.mjs --human --jitter 10
 *   npm run cli:device -- --script ./scripts/device_new_player_flow.mjs
 *
 * 输出：shots/device/np_*.png + 逐阶段 PASS/FAIL + 误触统计
 *
 * 坐标来源：
 *   - TitleScreen / PrologueScreen / MatchDayScreen / DraftScreen / PortalScreen 的 drawButton 定义
 *   - scripts/cli_ui_e2e.mjs 已验证的交互坐标
 */

export default async function run(client, ctx) {
  const {
    serial, tap, tracker, check, screenshot, snapshot, sleep,
    waitForRoute, clearSaveAndReload, jitter,
  } = ctx;

  const results = [];
  const snap = (name) => screenshot(client, serial, name);
  const log = (msg) => console.log(`    ${msg}`);
  const pressEscape = () => client.evalJs(`window.__FM_TEST__.key('Escape', 'Escape')`);

  /**
   * 阶段包装：统一计时、截图取证、失败不中断后续阶段（如实暴露级联问题）。
   */
  async function stage(title, slug, fn) {
    console.log(`\n--- ${title} ---`);
    const t0 = Date.now();
    try {
      const detail = await fn();
      check(results, title, true, `${detail ?? ''} · ${Date.now() - t0}ms`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      check(results, title, false, `${msg} · ${Date.now() - t0}ms`);
      await snap(`np_fail_${slug}`).catch(() => {});
      log(`失败：${msg}`);
    }
  }

  // ---------------------------------------------------------------- 1. 冷启动
  await stage('冷启动：清档后回到标题页', 'cold_start', async () => {
    await clearSaveAndReload();
    const s = await snapshot(client);
    const version = await client.evalJs(`window.__FM_TEST__.getRunningVersion()`);
    const size = await client.evalJs(`JSON.stringify(window.__FM_TEST__.getCanvasSize())`);
    const shot = await snap('np_00_cold_start');
    log(`route=${s.route} phase=${s.phase} version=${version}`);
    log(`canvas=${size} shot=${shot}`);
    if (s.route !== 'title') throw new Error(`期望 title，实际 ${s.route}`);
    return `version=${version} canvas=${size}`;
  });

  // ---------------------------------------------------------------- 2. 序章叙事
  await stage('序章：最后一战 → 捧杯 → 双抉择 → 接过教鞭', 'prologue', async () => {
    // OTA 弹窗属于环境噪音，固定坐标关闭且不计入拟人统计
    await tracker.tap(client, 536, 428, { label: '关闭更新弹窗', jitter: 0, waitMs: 300 });

    // 清档后「开始新赛季」中心 (640, 407)，点击后因序章未完成进入 prologue
    let r = await tap(640, 407, { label: '开始新赛季', expectRoute: 'prologue', waitMs: 1200 });
    log(`开始新赛季: ${r.before.route} -> ${r.after.route} hit=${r.hit}`);
    await snap('np_01_prologue_act1');

    if (r.after.route !== 'prologue') {
      return `SKIP：序章已完成，直接进入 ${r.after.route}`;
    }

    // Stage 0「踏上球场 · 最后一战」按钮 (916,584,224,52) → 中心 (1028,610)
    r = await tap(1028, 610, { label: '踏上球场·最后一战', expectRoute: 'match', waitMs: 1500 });
    log(`踏上球场: ${r.before.route} -> ${r.after.route} hit=${r.hit}`);
    await snap('np_02_prologue_match');
    if (r.after.route !== 'match') throw new Error(`未进入序章比赛，route=${r.after.route}`);

    // 序章比赛是 2x 教学实况，没有「快速完赛」按钮，只能等自然结束。
    // 期间每 2 秒读一次 phase，不注入任何作弊状态。
    const deadline = Date.now() + 180000;
    let phase = '';
    let poll = 0;
    while (Date.now() < deadline) {
      const s = await snapshot(client);
      phase = s.phase;
      if (phase === 'full_time') break;
      if (poll % 10 === 0) log(`序章比赛进行中 phase=${phase} 剩余 ${Math.round((deadline - Date.now()) / 1000)}s`);
      poll++;
      await sleep(2000);
    }
    if (phase !== 'full_time') throw new Error(`序章比赛 180s 未结束，phase=${phase}`);
    await snap('np_03_prologue_fulltime');

    // 顶部「捧起超级联赛冠军奖杯」(1020,24,230,36) → 中心 (1135,42)
    r = await tap(1135, 42, { label: '捧起超级联赛冠军奖杯', waitMs: 900 });
    log(`捧杯: hit=${r.hit}`);
    // 冠军 modal「捧杯之后 · 回到更衣室」(450,578,380,50) → 中心 (640,603)
    r = await tap(640, 603, { label: '捧杯之后·回到更衣室', expectRoute: 'prologue', waitMs: 1400 });
    log(`回到更衣室: ${r.before.route} -> ${r.after.route} hit=${r.hit}`);
    await snap('np_04_prologue_champion');

    // Stage 2「回到故乡 · 推开铁门」(916,584,224,52) → 中心 (1028,610)
    r = await tap(1028, 610, { label: '回到故乡·推开铁门', waitMs: 1000 });
    log(`回到故乡: ${r.before.route} -> ${r.after.route} hit=${r.hit}`);

    // Stage 3 左卡「接过教鞭，回到家乡执教」(lx=88,ly=416,lw=532,lh=264)
    // 按钮 = (110, 622, 488, 44) → 中心 (354, 644)
    r = await tap(354, 644, { label: '接过教鞭·回到家乡执教', expectRoute: 'title', waitMs: 1500 });
    log(`接过教鞭: ${r.before.route} -> ${r.after.route} hit=${r.hit}`);
    await snap('np_05_prologue_accept');
    return `序章走通，最终 route=${r.after.route}`;
  });

  // ---------------------------------------------------------------- 3. 建队向导
  await stage('建队向导：队名 → 阵型哲学 → 确认建队', 'wizard', async () => {
    const s = await snapshot(client);
    if (s.route !== 'title') throw new Error(`期望 title 上的建队向导，实际 ${s.route}`);

    // 向导第一页「下一步：阵型与哲学」中心 (997,614)
    let r = await tap(997, 614, { label: '下一步·阵型与哲学', waitMs: 700 });
    log(`下一步: hit=${r.hit} sig ${r.before.sig === r.after.sig ? '未变' : '已变'}`);
    // 向导第二页「确认建队 · 开启核心开包」(mx+mw-306, my+mh-62, 280,44) → 中心 (962,614)
    r = await tap(962, 614, { label: '确认建队·开启核心开包', expectRoute: 'draft', waitMs: 1200 });
    log(`确认建队: ${r.before.route} -> ${r.after.route} hit=${r.hit}`);
    await snap('np_06_after_wizard');

    const after = await snapshot(client);
    if (after.route !== 'draft') throw new Error(`未进入选秀，route=${after.route}`);
    return `route=${after.route}`;
  });

  // ---------------------------------------------------------------- 4. 核心开包
  await stage('核心开包：3 轮撕包 → 一键推荐选满 → 签入', 'draft', async () => {
    // 跳过新手引导遮挡（键盘 + 屏幕「跳过全部」按钮）
    await pressEscape();
    await sleep(200);
    await tap(812, 684, { label: '跳过全部引导', jitter: 0, waitMs: 300 });

    let packs = 0;
    for (let i = 0; i < 3; i++) {
      const s = await snapshot(client);
      if (s.phase !== 'INIT_DRAFT') break;
      // 撕包 (cx-150,526,300,48) → 中心 (640,550)
      await tap(640, 550, { label: `撕开核心包#${i + 1}`, waitMs: 750 });
      // 一键推荐选满 (926,134,150,30) → 中心 (1001,149)，热区高度仅 30px，抖动敏感
      await tap(1001, 149, { label: `一键推荐选满#${i + 1}`, waitMs: 300 });
      // 签入 (640,573)
      await tap(640, 573, { label: `签入 3 人#${i + 1}`, waitMs: 500 });

      // 只有状态签名真的变了才算这一轮完成，避免「点了但没生效」被记成 PASS
      const afterRound = await snapshot(client);
      if (afterRound.sig !== s.sig || afterRound.phase !== s.phase) {
        packs++;
      } else {
        log(`第 ${i + 1} 轮点击后状态未变化，疑似未命中`);
      }
      await snap(`np_07_draft_round_${i + 1}`);
    }

    const after = await snapshot(client);
    log(`确认完成 ${packs} 轮，phase=${after.phase}`);
    if (packs === 0) throw new Error('一轮开包都没生效');
    if (after.phase === 'INIT_DRAFT') throw new Error(`3 轮后仍停在 INIT_DRAFT（实际生效 ${packs} 轮）`);
    return `packs=${packs} phase=${after.phase}`;
  });

  // ---------------------------------------------------------------- 5. 夏窗补齐
  await stage('夏窗：补齐青训 → 盖章开赛 → 关闭启程简报', 'summer_window', async () => {
    let s = await snapshot(client);
    if (s.phase !== 'SUMMER_WINDOW') {
      return `SKIP：当前 phase=${s.phase}`;
    }
    // 「补齐青训并盖章开赛」(358,308,312,48) → 中心 (514,332)
    // E2E 用 (579,332)，同样落在该按钮内；这里用几何中心
    let r = await tap(514, 332, { label: '补齐青训并盖章开赛', waitMs: 900 });
    log(`补齐青训: ${r.before.phase} -> ${r.after.phase} hit=${r.hit}`);

    await pressEscape();
    await sleep(200);
    // 接下战书 · 踏上征程 (640,500)
    r = await tap(640, 500, { label: '接下战书·踏上征程', waitMs: 500 });
    await snap('np_08_summer_window');

    s = await snapshot(client);
    if (s.phase !== 'REGULAR_SEASON') throw new Error(`未进入常规赛，phase=${s.phase}`);
    return `phase=${s.phase}`;
  });

  // ---------------------------------------------------------------- 6. 首场比赛
  await stage('首场比赛：开场哨 → 出牌 → 快速完赛 → 复盘领奖', 'first_match', async () => {
    let s = await snapshot(client);
    log(`进入首战前 route=${s.route} phase=${s.phase}`);

    // 门户「吹响开场哨 · 亲自指挥本场对决」(112,308,456,48) → 中心 (340,332)
    let r = await tap(340, 332, { label: '吹响开场哨·指挥本场对决', expectRoute: 'match', waitMs: 900 });
    log(`开场哨: ${r.before.route} -> ${r.after.route} hit=${r.hit}`);
    if (r.after.route !== 'match') throw new Error(`未进入比赛，route=${r.after.route}`);

    // 跳过开球入场动画
    await tap(640, 360, { label: '跳过开球动画', jitter: 0, waitMs: 700 });
    await snap('np_09_matchday_kickoff');

    // s1 指令卡 (668,644)
    r = await tap(668, 644, { label: '打出 s1 指令卡', waitMs: 450 });
    log(`出牌: hit=${r.hit} sigChanged=${r.changed}`);
    await snap('np_10_matchday_card');

    // 快速完赛 (1054,24,196,36) → 中心 (1152,42)
    r = await tap(1152, 42, { label: '快速完赛', waitMs: 900 });
    log(`快速完赛: hit=${r.hit}`);

    // 赛后「查看完整复盘与开箱领奖」(mx+304, my+mh-74, mw-340, 48) → 中心约 (774,573)
    r = await tap(774, 573, { label: '查看完整复盘与开箱领奖', waitMs: 600 });
    log(`复盘: hit=${r.hit}`);
    await snap('np_11_postmatch_recap');

    // 下一步：领取赛后肉鸽奖励 (640,668)
    r = await tap(640, 668, { label: '领取赛后肉鸽奖励', waitMs: 600 });
    log(`领奖: hit=${r.hit}`);
    await snap('np_12_postmatch_reward');

    s = await snapshot(client);
    return `phase=${s.phase} route=${s.route}`;
  });

  console.log(`\n[新玩家流程] 截图目录: ${ctx.SCREENSHOT_DIR}`);
  console.log(`[新玩家流程] 拟人抖动: ${jitter}px`);
  return results;
}
