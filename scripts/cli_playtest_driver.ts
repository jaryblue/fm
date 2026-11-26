import { inferCardElement } from '../packages/core/src/CommandCards';
import { LeagueManager } from '../packages/core/src/LeagueManager';
import { FormationName, TacticalStyle } from '../packages/engine/src/types';

type Strategy = 'baseline' | 'scout_cards' | 'full_roguelike';

function parseArgs(argv: string[]) {
  let matches = 9;
  let seasons = 1;
  let strategy: Strategy = 'full_roguelike';
  let formation: FormationName = '4-3-3';
  let style: TacticalStyle = 'tiki_taka';
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--matches' && argv[i + 1]) matches = Math.max(1, Math.min(34, Number(argv[++i]) || 9));
    else if (a === '--seasons' && argv[i + 1]) seasons = Math.max(1, Math.min(5, Number(argv[++i]) || 1));
    else if (a === '--full-season') matches = 34;
    else if (a === '--strategy' && argv[i + 1]) strategy = (argv[++i] as Strategy) || 'full_roguelike';
    else if (a === '--formation' && argv[i + 1]) formation = argv[++i] as FormationName;
    else if (a === '--style' && argv[i + 1]) style = argv[++i] as TacticalStyle;
    else if (a === '--json') json = true;
  }
  return { matches, seasons, strategy, formation, style, json };
}

interface MatchTelemetry {
  round: number;
  opponent: string;
  score: string;
  result: 'W' | 'D' | 'L';
  myXG: number;
  oppXG: number;
  myShotsOnTarget: number;
  oppShotsOnTarget: number;
  mySaves: number;
  scoutedCorrect: boolean;
  energyCurve: number[];
  cardsPlayed: number;
  skillsOffered: number;
  skillsActivated: number;
  subsMade: number;
  traitTriggers: number;
  chemPasses: number;
  scoutCounters: number;
  hiddenTraitsAwakened: number;
  review: string;
}

declare const process: { argv: string[] };
const cfg = parseArgs((process?.argv ?? []).slice(2));
const mgr = new LeagueManager();
mgr.startNewSeason('club_star', cfg.formation, cfg.style, false);
mgr.autoCompleteDraft();
mgr.confirmInitialDraft();

// 检查首发阵容 CA 均值是否有 NaN
const squad = mgr.getUserClub().squad;
const avgCA = squad.length > 0 ? Math.round(squad.reduce((s, p) => s + p.ca, 0) / squad.length) : 0;
const nanFields: string[] = [];
if (Number.isNaN(avgCA)) nanFields.push('avgCA');
for (const p of squad) {
  if (!Number.isFinite(p.ca)) nanFields.push(`${p.name}.ca`);
}

const logs: MatchTelemetry[] = [];
let cardsFused = 0;
let devilTrains = 0;
let metaUpgrades = 0;
const winterWindowBlocks: string[] = [];
const seasonBonusErrors: string[] = [];
const metaUpgradeDetails: string[] = [];
const metaUpgradeBlocks: string[] = [];
let seasonBonusSummary = '';
let metaPointsDelta = 0;
let metaLevelsSnapshot: Record<string, number> = {};
let clubFundsSnapshot = 0;
let seasonMemories: string[] = [];
let retiredLegend = '';
const seasonSummaries: Array<{
  season: number;
  rank: number;
  points: number;
  gf: number;
  ga: number;
  tier: number;
  tierName: string;
  promotionStatus: 'promoted' | 'relegated' | 'stayed';
  metaPointsEarned: number;
  isChampion: boolean;
  topScorer: string;
  seasonMVP: string;
  seasonBonusClaimed: boolean;
  rewardDraftsSigned: number;
}> = [];

for (let sIdx = 0; sIdx < cfg.seasons; sIdx++) {
  if (sIdx > 0) {
    mgr.startNewSeason('club_star', cfg.formation, cfg.style, true);
    mgr.autoCompleteDraft();
    mgr.confirmInitialDraft();
  }
  if (mgr.getState().phase === 'SUMMER_WINDOW') {
    mgr.signFreeAcademyFill(true);
    mgr.finishSummerWindowAndStartSeason();
  }

for (let r = 0; r < cfg.matches; r++) {
  const st = mgr.getState();
  // 赛季已结算：跳出比赛循环，让末尾的赛季结算收尾代码（领奖/新秀/Meta）执行
  if (st.phase === 'SEASON_END') break;
  if (st.pendingStoryEvent) {
    mgr.resolveStoryEvent(st.pendingStoryEvent.options[0].id);
  }
  if (st.phase === 'RE_DRAFT' && st.reDraft) {
    if (!st.reDraft.perkChosen && st.reDraft.perkChoices.length > 0) {
      mgr.chooseReDraftPerk(st.reDraft.perkChoices[0].id);
    }
    mgr.finishReDraft();
  }
  // 半程冬季转会窗：先免签补齐大名单（26人）再关窗，赛程推进到 midRound+1
  if (mgr.getState().phase === 'WINTER_WINDOW') {
    mgr.signFreeAcademyFill(true);
    const cw = mgr.closeWinterWindow();
    if (!cw.ok) winterWindowBlocks.push(cw.reason ?? '未知原因');
    continue;
  }

  // 转会窗开放时测试私教魔鬼特训；卡库有同级卡时测试二合一融合升阶
  if (cfg.strategy === 'full_roguelike') {
    const tw = mgr.getTransferWindowState();
    if (tw.isOpen && tw.privateTrainCount < 2 && mgr.getClubFunds() >= 350) {
      const topP = [...mgr.getUserClub().squad].sort((a, b) => b.ca - a.ca)[0];
      if (topP && mgr.privateDevilTraining(topP.id).ok) devilTrains++;
    }
    const deck = mgr.getCoachDeck();
    const lv1s = deck.filter(c => (c.level ?? 1) === 1);
    if (lv1s.length >= 2) {
      if (mgr.fuseCoachCards(lv1s[0].id, lv1s[1].id).ok) cardsFused++;
    }
  }

  const fx = mgr.getUserCurrentFixture();
  if (!fx) break;
  const userClub = mgr.getUserClub();
  const oppClubId = fx.homeClubId === userClub.id ? fx.awayClubId : fx.homeClubId;
  const oppName = st.clubs.find(c => c.id === oppClubId)?.name ?? 'Opponent';

  // 1. 赛前侦察 + 备战 + 合成配卡
  let scoutedCorrect = false;
  if (cfg.strategy !== 'baseline') {
    const intel = mgr.getInterMatchPrep()?.matchupIntel;
    if (intel) {
      for (const z of intel.zones ?? []) {
        if (!z.scanned) mgr.scanOpponentZone(z.id);
      }
      if (intel.clues.some(c => c.isSmoke && !c.debunked)) {
        mgr.debunkSmokeClue();
      }
      const correctCounter = intel.counters.find(c => c.isCorrect);
      if (correctCounter && !intel.spotCorrect) {
        const spot = mgr.chooseOpponentCounter(correctCounter.id);
        scoutedCorrect = !!spot.correct;
        if (scoutedCorrect) mgr.chooseScoutReward('buff_debuff');
      }
    }
    if ((mgr.getInterMatchPrep()?.actionsLeft ?? 0) > 0) {
      mgr.applyPrepTraining('tactical');
    }
    if (cfg.strategy === 'full_roguelike') {
      const inv = mgr.getElementInventory();
      const elems = (Object.keys(inv) as Array<keyof typeof inv>).filter(k => (inv[k] ?? 0) > 0);
      if (elems.length >= 2 && mgr.getCoachDeck().length < 12) {
        mgr.craftChemistryCard([elems[0], elems[1]], 'balanced', true);
      }
    }
  }

  // 2. 逐 Tick 实机模拟比赛（含能量曲线、减费手牌、主动技、换人、Callouts）
  const engine = mgr.createUserMatchEngine();
  const ms = engine.getState();
  const userSide = fx.homeClubId === userClub.id ? 'home' : 'away';
  const oppSide = userSide === 'home' ? 'away' : 'home';

  const prepEnergy = mgr.getInterMatchPrep()?.nextMatchBuff?.energyBonus ?? 0;
  const perkEnergy = (userClub.perks ?? []).reduce((s, pk) => s + (pk.effect.startEnergyBonus ?? 0), 0);
  let energy = Math.min(5, 3 + prepEnergy + perkEnergy);
  const energyCurve: number[] = [energy];

  const loadout = mgr.getMatchLoadout();
  const counterSet = new Set(mgr.getInterMatchPrep()?.matchupIntel?.counterElements ?? []);
  const usedCards = new Set<string>();
  let cardsPlayed = 0;
  let skillsOffered = 0;
  let skillsActivated = 0;
  let subsMade = 0;
  let lastPromptId: string | null = null;
  let halftimeRestored = false;

  while (ms.phase !== 'full_time') {
    engine.step();

    if (ms.phase === 'half_time' && !halftimeRestored) {
      halftimeRestored = true;
      energy = Math.min(5, energy + 1);
      energyCurve.push(energy);
    }

    // 主动技检测与释放
    if (ms.activeSkillPrompt) {
      const pKey = `${ms.activeSkillPrompt.skillId}_${ms.activeSkillPrompt.expiresTick}`;
      if (pKey !== lastPromptId) {
        lastPromptId = pKey;
        skillsOffered++;
        if (cfg.strategy !== 'baseline') {
          const act = engine.triggerActiveSkill(userSide, ms.activeSkillPrompt.skillId);
          if (act.triggered || act.ok) {
            skillsActivated++;
            const refund = (act as { energyRefund?: number }).energyRefund;
            if (refund) {
              energy = Math.min(5, energy + refund);
              energyCurve.push(energy);
            }
          }
        }
      }
    }

    // 打出教练手牌
    if (cfg.strategy !== 'baseline' && ms.minute >= 12 && ms.minute % 18 === 0) {
      const nextCard = loadout.find(c => !usedCards.has(c.id));
      if (nextCard) {
        const el = inferCardElement(nextCard);
        const isResonant = scoutedCorrect && counterSet.has(el);
        const effCost = Math.max(0, nextCard.cost - (isResonant ? 1 : 0));
        if (energy >= effCost) {
          energy -= effCost;
          usedCards.add(nextCard.id);
          const res = engine.applyCommandCard(userSide, {
            ...nextCard,
            durationMinutes: nextCard.durationMinutes + (isResonant ? 5 : 0),
            element: el,
          });
          if (res.energyRefund) energy = Math.min(5, energy + res.energyRefund);
          energyCurve.push(energy);
          cardsPlayed++;
        }
      }
    }

    // 62'~78' 自动体能换人
    if (cfg.strategy === 'full_roguelike' && ms.minute >= 62 && ms.minute <= 82 && subsMade < 3) {
      const subsUsed = userSide === 'home' ? ms.homeSubsUsed : ms.awaySubsUsed;
      if (subsUsed < 5) {
        const starters = ms.players
          .filter(p => p.team === userSide && !p.redCard && p.role !== 'GK' && p.fitness < 72)
          .sort((a, b) => a.fitness - b.fitness);
        const bench = userSide === 'home' ? ms.homeSubs : ms.awaySubs;
        if (starters.length > 0 && bench.length > 0) {
          const outP = starters[0];
          const inP = bench.find(b => b.role === outP.role || b.secondaryRoles?.includes(outP.role)) ?? bench[0];
          if (inP && engine.substitute(userSide, outP.id, inP.id).ok) {
            subsMade++;
          }
        }
      }
    }
  }

  mgr.completeCurrentRoundWithUserResult(ms);

  const myGoals = userSide === 'home' ? ms.homeScore : ms.awayScore;
  const oppGoals = userSide === 'home' ? ms.awayScore : ms.homeScore;
  const myStats = ms.stats[userSide];
  const oppStats = ms.stats[oppSide];
  const tStats = ms.tacticalStats ?? { traitTriggers: 0, chemPasses: 0, scoutCounters: 0 };

  logs.push({
    round: fx.round,
    opponent: oppName,
    score: `${myGoals}:${oppGoals}`,
    result: myGoals > oppGoals ? 'W' : myGoals === oppGoals ? 'D' : 'L',
    myXG: Number(myStats.xG.toFixed(2)),
    oppXG: Number(oppStats.xG.toFixed(2)),
    myShotsOnTarget: myStats.shotsOnTarget,
    oppShotsOnTarget: oppStats.shotsOnTarget,
    mySaves: myStats.saves,
    scoutedCorrect,
    energyCurve,
    cardsPlayed,
    skillsOffered,
    skillsActivated,
    subsMade,
    traitTriggers: tStats.traitTriggers,
    chemPasses: tStats.chemPasses,
    scoutCounters: tStats.scoutCounters,
    hiddenTraitsAwakened: (ms.unlockedHiddenTraits || []).filter(u => u.team === userSide).length,
    review: mgr.getState().lastMatchReview || '',
  });

  // 3. 赛后领奖推进下一轮
  const rw = mgr.getState().pendingPostMatchReward;
  if (rw && !rw.completed) {
    const cats = rw.categories ?? ['pack'];
    mgr.pickPostMatchRewardCategory(cats[0]);
    const opt = mgr.getState().pendingPostMatchReward?.options[0];
    if (opt) {
      const targetId = mgr.getUserClub().squad[0]?.id;
      mgr.applyPostMatchRewardOption(opt.id, targetId);
    }
  }
}

  // 赛季末结算：领赛季奖励、新秀入队/交换、Meta 天赋升级
  const endSt = mgr.getState();
  // 新版本结算字段为 lastSummary（旧的 seasonSummary 已移除）
  if (endSt.phase === 'SEASON_END' && endSt.lastSummary) {
    const sm = endSt.lastSummary;
    const metaBefore = mgr.getState().metaPointsTotal ?? 0;
    seasonSummaries.push({
      season: endSt.seasonNumber,
      rank: sm.finalRank,
      points: sm.points,
      gf: sm.gf,
      ga: sm.ga,
      tier: sm.newTier ?? sm.tier ?? endSt.currentTier ?? 7,
      tierName: sm.tierName ?? '',
      promotionStatus: sm.promotionStatus ?? 'stayed',
      metaPointsEarned: sm.metaPointsEarned ?? 0,
      isChampion: !!sm.isChampion,
      topScorer: sm.topScorer?.name ?? '',
      seasonMVP: sm.seasonMVP?.name ?? '',
      seasonBonusClaimed: false,
      rewardDraftsSigned: 0,
    });

    // 赛季奖励三选一（新字段：seasonBonusOptions / seasonBonusClaimedId）
    if (!sm.seasonBonusClaimedId && sm.seasonBonusOptions?.length) {
      const r = mgr.pickSeasonBonusReward(sm.seasonBonusOptions[0].id);
      if (r.ok) {
        const idx = seasonSummaries.length - 1;
        seasonSummaries[idx].seasonBonusClaimed = true;
        seasonBonusSummary = r.summary ?? '';
      } else {
        seasonBonusErrors.push(r.reason ?? '未知原因');
      }
    }

    // 赛季新秀入队（新字段：seasonRewardDrafts）
    const drafts = endSt.seasonRewardDrafts ?? [];
    let signed = 0;
    for (const d of drafts) {
      const weakest = [...mgr.getClubRoster()].sort((a, b) => a.ca - b.ca)[0];
      const rr = mgr.recruitSeasonRewardToRoster(d.id, weakest?.id);
      if (rr.ok) signed++;
    }
    if (seasonSummaries.length > 0) seasonSummaries[seasonSummaries.length - 1].rewardDraftsSigned = signed;

    // Meta 基建升级（需要资金 + 曾达联赛级别解锁）
    for (const br of ['academy', 'scout', 'finance', 'transfer', 'medical', 'training_ground', 'stadium', 'analytics'] as const) {
      const u = mgr.upgradeMetaBranch(br);
      if (u.ok) {
        metaUpgrades++;
        metaUpgradeDetails.push(`S${endSt.seasonNumber} ${br}`);
      } else if (u.reason && !u.reason.includes('满级')) {
        metaUpgradeBlocks.push(u.reason);
      }
    }
    const metaAfter = mgr.getState().metaPointsTotal ?? 0;
    metaPointsDelta = metaAfter - metaBefore;
    metaLevelsSnapshot = { ...(mgr.getState().metaLevels ?? {}) } as Record<string, number>;
    clubFundsSnapshot = mgr.getState().clubFunds ?? 0;

    // 退役老将 / 记忆留存（跨赛季继承取证）
    seasonMemories = (sm.memories ?? []).slice(0, 5).map(m => `${m.title ?? ''}`);
    retiredLegend = sm.retiredLegend?.name ?? '';
  }
}

const totals = logs.reduce(
  (acc, l) => {
    if (l.result === 'W') acc.w++;
    else if (l.result === 'D') acc.d++;
    else acc.l++;
    acc.skillsOffered += l.skillsOffered;
    acc.skillsActivated += l.skillsActivated;
    acc.subs += l.subsMade;
    acc.traits += l.traitTriggers;
    acc.chem += l.chemPasses;
    acc.scout += l.scoutCounters;
    return acc;
  },
  { w: 0, d: 0, l: 0, skillsOffered: 0, skillsActivated: 0, subs: 0, traits: 0, chem: 0, scout: 0 }
);

const flags: string[] = [];
if (nanFields.length > 0) flags.push(`CRITICAL: NaN detected in ${nanFields.join(', ')}`);
if (winterWindowBlocks.length > 0) flags.push(`WARN: 冬季转会窗未能关闭 (${winterWindowBlocks.length} 次): ${winterWindowBlocks[0]}`);
if (cfg.seasons > 1 && seasonSummaries.length < cfg.seasons) {
  flags.push(`WARN: 赛季结算数不足 (${seasonSummaries.length}/${cfg.seasons})，赛季未能完整走完`);
}
if (totals.chem === 0) flags.push('WARN: 默契连线触发为 0 次（请检查阈值或连线条件）');
if (totals.skillsOffered < Math.ceil(logs.length * 0.5)) {
  flags.push(`WARN: 主动技弹窗触发偏少 (${totals.skillsOffered}/${logs.length}场)`);
}
const reviewCounts = new Map<string, number>();
for (const l of logs) reviewCounts.set(l.review, (reviewCounts.get(l.review) ?? 0) + 1);
const maxDupReview = Math.max(0, ...reviewCounts.values());
if (logs.length >= 4 && maxDupReview >= Math.ceil(logs.length * 0.6)) {
  flags.push(`WARN: 赛后复盘文案重复率过高 (${maxDupReview}/${logs.length})`);
}

  if (cfg.json) {
    console.log(JSON.stringify({ cfg, avgCA, totals, cardsFused, devilTrains, metaUpgrades, metaPointsDelta, metaLevelsSnapshot, clubFundsSnapshot, seasonBonusSummary, retiredLegend, seasonMemories, winterWindowBlocks, seasonBonusErrors, metaUpgradeDetails, metaUpgradeBlocks, seasonSummaries, flags, logs }, null, 2));
  } else {
  console.log(`\n=== FM-League CLI 自动游玩与诊断报告 ===`);
  console.log(`策略: ${cfg.strategy} | 赛季数: ${cfg.seasons} | 阵型: ${cfg.formation} | 风格: ${cfg.style} | 阵容均评: ${avgCA}`);
  console.log(`战绩 (${logs.length}场): ${totals.w}胜 ${totals.d}平 ${totals.l}负`);
  console.log(
    `机制总计: 主动技弹窗 ${totals.skillsOffered} 次 / 触发 ${totals.skillsActivated} 次 | 换人 ${totals.subs} 次 | 特质 ${totals.traits} | 默契连线 ${totals.chem} | 破绽压制 ${totals.scout} | 融合 ${cardsFused} | 魔鬼特训 ${devilTrains} | Meta升级 ${metaUpgrades}`
  );
  if (seasonSummaries.length > 0) {
    for (const ss of seasonSummaries) {
      console.log(
        `赛季 S${ss.season} 结算: 第 ${ss.rank} 名 (${ss.points}分, ${ss.gf}:${ss.ga}) -> 第 ${ss.tier} 级${ss.tierName ? ` ${ss.tierName}` : ''} ` +
          `[${ss.promotionStatus === 'promoted' ? '升级' : ss.promotionStatus === 'relegated' ? '降级' : '留级'}]` +
          `${ss.isChampion ? ' [冠军]' : ''} | 金靴 ${ss.topScorer || '-'} | MVP ${ss.seasonMVP || '-'}` +
          ` | Meta+${ss.metaPointsEarned} | 赛季奖励${ss.seasonBonusClaimed ? '已领' : '未领'} | 新秀入队 ${ss.rewardDraftsSigned}`
      );
    }
    console.log(`Meta 累计升级 ${metaUpgrades} 次: ${metaUpgradeDetails.join(' / ') || '无'}`);
    console.log(`Meta 等级快照: ${JSON.stringify(metaLevelsSnapshot)} | 俱乐部资金 ¥${clubFundsSnapshot}`);
    if (seasonBonusSummary) console.log(`赛季奖励: ${seasonBonusSummary}`);
    if (retiredLegend) console.log(`退役老将: ${retiredLegend}`);
    if (seasonMemories.length > 0) console.log(`赛季记忆: ${seasonMemories.join(' / ')}`);
  }
  console.log('');
  console.log('| 轮次 | 对手 | 比分 | xG | 射正 | 侦察 | 能量曲线 | 主动技 | 换人 | 特质/默契/破绽 | 赛后复盘 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const l of logs) {
    console.log(
      `| R${l.round} | ${l.opponent} | ${l.score}(${l.result}) | ${l.myXG}:${l.oppXG} | ${l.myShotsOnTarget}:${l.oppShotsOnTarget} | ${l.scoutedCorrect ? '命中' : '未'} | ${l.energyCurve.join('->')} | ${l.skillsActivated}/${l.skillsOffered} | ${l.subsMade} | ${l.traitTriggers}/${l.chemPasses}/${l.scoutCounters} | ${l.review} |`
    );
  }
  console.log('');
  console.log('=== 自动化体检结论 ===');
  if (flags.length === 0) {
    console.log('PASS: 全部机制链路激活正常，无死机制、无 NaN、无高频重复复盘。');
  } else {
    for (const f of flags) console.log(`- ${f}`);
  }
}
