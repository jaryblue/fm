import {
  canCardEnterReactor,
  CommandCard,
  evaluateCardEffectiveCost,
  inferCardElement,
} from '../packages/core/src/CommandCards';
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

function shuffleArr<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
  combosTriggered: number;
  timingDiscounts: number;
  cardsDepleted: number;
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

const squad = mgr.getUserClub().squad;
const avgCA = squad.length > 0 ? Math.round(squad.reduce((s, p) => s + p.ca, 0) / squad.length) : 0;
const nanFields: string[] = [];
if (Number.isNaN(avgCA)) nanFields.push('avgCA');
for (const p of squad) {
  if (!Number.isFinite(p.ca)) nanFields.push(`${p.name}.ca`);
}

const logs: MatchTelemetry[] = [];
let reactorCrafts = 0;
let tier3Crafts = 0;
let affixesRolled = { positive: 0, negative: 0, easter_egg: 0 };
let cardsRecycled = 0;
let shopBuys = 0;
let totalCardsDepleted = 0;
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
    if (mgr.getState().phase === 'WINTER_WINDOW') {
      mgr.signFreeAcademyFill(true);
      const cw = mgr.closeWinterWindow();
      if (!cw.ok) winterWindowBlocks.push(cw.reason ?? '未知原因');
      continue;
    }

    // V5 战前卡组运营：反应釜合成 + 残血回收 + 商店补卡 + 私教特训
    if (cfg.strategy === 'full_roguelike') {
      const tw = mgr.getTransferWindowState();
      if (tw.isOpen && (mgr.getTransferMarketState().privateTrainCount ?? 0) < 2 && mgr.getClubFunds() >= 350) {
        const topP = [...mgr.getUserClub().squad].sort((a, b) => b.ca - a.ca)[0];
        if (topP && mgr.privateDevilTraining(topP.id).ok) devilTrains++;
      }

      // 1) 残血卡回收（仅剩 1 次耐久且背包充足时回收换资金）
      const deckForRecycle = mgr.getCoachDeck();
      if (deckForRecycle.length > 8) {
        const damaged = deckForRecycle.find(c => !c.isBase && (c.remainingUses ?? 2) === 1);
        if (damaged && mgr.recycleDamagedCard(damaged.id).ok) {
          cardsRecycled++;
        }
      }

      // 2) V5 化学反应釜合成（第 6 级起解锁；优先 2 张 1 阶合 2 阶神卡，背包富裕时 3 卡合 3 阶传说）
      if (mgr.isReactorUnlocked()) {
        const craftableT1 = mgr.getCoachDeck().filter(c => (c.tier ?? 1) === 1 && canCardEnterReactor(c).ok);
        if (craftableT1.length >= 6) {
          const pick3 = craftableT1.slice(0, 3).map(c => c.id);
          const cr = mgr.craftV5ReactorCards(pick3);
          if (cr.ok && cr.card) {
            reactorCrafts++;
            if ((cr.card.tier ?? 1) >= 3) tier3Crafts++;
            if (cr.affix) affixesRolled[cr.affix.kind]++;
          }
        } else if (craftableT1.length >= 4) {
          const a = craftableT1[0];
          const b = craftableT1.find(c => inferCardElement(c) !== inferCardElement(a)) ?? craftableT1[1];
          const cr = mgr.craftV5ReactorCards([a.id, b.id]);
          if (cr.ok && cr.card) {
            reactorCrafts++;
            if (cr.affix) affixesRolled[cr.affix.kind]++;
          }
        }
      }

      // 3) 卡牌商店补货（资金充裕且背包 < 12）
      if (mgr.getClubFunds() >= 500 && mgr.getCoachDeck().length < 12) {
        const offers = mgr.getCardShopOffers();
        const avail = offers.find(o => !o.sold && mgr.getClubFunds() >= o.price);
        if (avail && mgr.buyCardFromShop(avail.id).ok) {
          shopBuys++;
        }
      }
    }

    const fx = mgr.getUserCurrentFixture();
    if (!fx) break;
    const userClub = mgr.getUserClub();
    const oppClubId = fx.homeClubId === userClub.id ? fx.awayClubId : fx.homeClubId;
    const oppName = st.clubs.find(c => c.id === oppClubId)?.name ?? 'Opponent';

    // 1. 赛前侦察 + 备战
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
    }

    // 2. 逐 Tick 实机模拟比赛（V5 8~12 张动态牌库 + 抽弃牌堆 + 能量节奏 + 耐久扣减）
    const engine = mgr.createUserMatchEngine();
    const ms = engine.getState();
    const userSide = fx.homeClubId === userClub.id ? 'home' : 'away';
    const oppSide = userSide === 'home' ? 'away' : 'home';

    const prepEnergy = mgr.getInterMatchPrep()?.nextMatchBuff?.energyBonus ?? 0;
    const perkEnergy = (userClub.perks ?? []).reduce((s, pk) => s + (pk.effect.startEnergyBonus ?? 0), 0);
    let energy = Math.min(5, 2 + prepEnergy + perkEnergy);
    const energyCurve: number[] = [energy];

    const matchDeck = mgr.getActiveMatchDeck();
    const innateCards = matchDeck.filter(c => c.affix?.innateOpeningHand);
    const normalCards = shuffleArr(matchDeck.filter(c => !c.affix?.innateOpeningHand));
    let drawPile: CommandCard[] = [...innateCards, ...normalCards];
    let discardPile: CommandCard[] = [];
    const hand: CommandCard[] = [];

    const drawCards = (n: number) => {
      for (let i = 0; i < n; i++) {
        if (hand.length >= 4) break;
        if (drawPile.length === 0 && discardPile.length > 0) {
          drawPile = shuffleArr(discardPile);
          discardPile = [];
        }
        const top = drawPile.shift();
        if (top) hand.push(top);
      }
    };
    drawCards(3); // 开球抽 3 张

    const counterSet = new Set(mgr.getInterMatchPrep()?.matchupIntel?.counterElements ?? []);
    const playedCardIds: string[] = [];
    let cardsPlayed = 0;
    let combosTriggered = 0;
    let timingDiscounts = 0;
    let skillsOffered = 0;
    let skillsActivated = 0;
    let subsMade = 0;
    let lastPromptId: string | null = null;
    let halftimeRestored = false;
    const firedMinuteMarks = new Set<number>();
    let lastOppGoals = 0;
    let lastMySaves = 0;
    let gkSaveDrawFirstHalf = false;
    let gkSaveDrawSecondHalf = false;
    let subDrawCount = 0;
    let lastCardPlayMin = -10;

    while (ms.phase !== 'full_time') {
      engine.step();

      if (ms.phase === 'half_time' && !halftimeRestored) {
        halftimeRestored = true;
        energy = Math.min(5, energy + 1);
        energyCurve.push(energy);
        drawCards(2);
      }

      // 每 15 分钟自然回能 +1 与抽 1 张牌
      for (const mark of [15, 30, 60, 75]) {
        if (ms.minute >= mark && !firedMinuteMarks.has(mark)) {
          firedMinuteMarks.add(mark);
          energy = Math.min(5, energy + 1);
          energyCurve.push(energy);
          drawCards(1);
        }
      }

      // 关键事件抽牌：丢球立即抽 1、门将扑救每半场最多抽 1
      const curOppGoals = userSide === 'home' ? ms.awayScore : ms.homeScore;
      if (curOppGoals > lastOppGoals) {
        lastOppGoals = curOppGoals;
        drawCards(1);
      }
      const curMySaves = ms.stats[userSide].saves;
      if (curMySaves > lastMySaves) {
        lastMySaves = curMySaves;
        if (ms.phase === 'first_half' && !gkSaveDrawFirstHalf) {
          gkSaveDrawFirstHalf = true;
          drawCards(1);
        } else if (ms.phase === 'second_half' && !gkSaveDrawSecondHalf) {
          gkSaveDrawSecondHalf = true;
          drawCards(1);
        }
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

      // V5 动态出牌：优先打出连击/减费牌，每 10~14 分钟出 1 张（控节奏不刷牌）
      if (cfg.strategy !== 'baseline' && ms.minute >= 8 && ms.minute - lastCardPlayMin >= 11 && hand.length > 0) {
        const curStance = ms.teamStance?.[userSide];
        let bestIdx = -1;
        let bestScore = -999;
        let bestEffCost = 0;
        let bestDiscounted = false;
        let bestResonant = false;

        for (let i = 0; i < hand.length; i++) {
          const card = hand[i];
          const el = inferCardElement(card);
          const isResonant = scoutedCorrect && counterSet.has(el);
          const evalRes = evaluateCardEffectiveCost(card, ms, userSide, isResonant);
          if (energy < evalRes.cost) continue;
          let sc = (card.tier ?? 0) * 10 - evalRes.cost * 3;
          if (card.comboRule && (card.comboRule.anyStance || card.comboRule.requiresStance === curStance)) sc += 20;
          if (evalRes.discounted) sc += 12;
          if (sc > bestScore) {
            bestScore = sc;
            bestIdx = i;
            bestEffCost = evalRes.cost;
            bestDiscounted = evalRes.discounted;
            bestResonant = isResonant;
          }
        }

        if (bestIdx >= 0) {
          const chosen = hand.splice(bestIdx, 1)[0];
          const el = inferCardElement(chosen);
          energy -= bestEffCost;
          lastCardPlayMin = ms.minute;
          const res = engine.applyCommandCard(userSide, {
            ...chosen,
            durationMinutes: chosen.durationMinutes + (bestResonant ? 4 : 0),
            element: el,
          });
          if (res.ok) {
            playedCardIds.push(chosen.id);
            cardsPlayed++;
            if (res.comboActivated) combosTriggered++;
            if (bestDiscounted) timingDiscounts++;
            if (res.energyRefund) energy = Math.min(5, energy + res.energyRefund);
            energyCurve.push(energy);
          }
          // 非 3 阶一次消耗卡进入弃牌堆，可在本场后续循环抽到
          if ((chosen.tier ?? 0) < 3) {
            discardPile.push(chosen);
          }
        }
      }

      // 62'~82' 自动体能换人（换人抽 1 张牌，全场最多 2 次）
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
              if (subDrawCount < 2) {
                subDrawCount++;
                drawCards(1);
              }
            }
          }
        }
      }
    }

    // V5 赛后结算：仅扣减实际打出的消耗卡耐久
    const useRes = mgr.consumePlayedCardUses(playedCardIds);
    totalCardsDepleted += useRes.depletedNames.length;

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
      combosTriggered,
      timingDiscounts,
      cardsDepleted: useRes.depletedNames.length,
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
    if (rw?.tutorialCardUnlock && !rw.tutorialCardUnlock.claimed) {
      mgr.claimTutorialCardUnlock();
    }
    if (rw && !rw.completed) {
      const cats = rw.categories ?? ['event'];
      const preferCat = cats.includes('craft_card') ? 'craft_card' : cats[0];
      mgr.pickPostMatchRewardCategory(preferCat);
      const opt = mgr.getState().pendingPostMatchReward?.options[0];
      if (opt) {
        const targetId = mgr.getUserClub().squad[0]?.id;
        mgr.applyPostMatchRewardOption(opt.id, targetId);
      }
    }
  }

  const endSt = mgr.getState();
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

    const drafts = endSt.seasonRewardDrafts ?? [];
    let signed = 0;
    for (const d of drafts) {
      const weakest = [...mgr.getClubRoster()].sort((a, b) => a.ca - b.ca)[0];
      const rr = mgr.recruitSeasonRewardToRoster(d.id, weakest?.id);
      if (rr.ok) signed++;
    }
    if (seasonSummaries.length > 0) seasonSummaries[seasonSummaries.length - 1].rewardDraftsSigned = signed;

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
    seasonMemories = (sm.memories ?? []).slice(0, 5).map(m => `${m.title ?? ''}`);
    retiredLegend = sm.retiredLegend?.name ?? '';
  }
}

const totals = logs.reduce(
  (acc, l) => {
    if (l.result === 'W') acc.w++;
    else if (l.result === 'D') acc.d++;
    else acc.l++;
    acc.cardsPlayed += l.cardsPlayed;
    acc.combos += l.combosTriggered;
    acc.timingDiscounts += l.timingDiscounts;
    acc.skillsOffered += l.skillsOffered;
    acc.skillsActivated += l.skillsActivated;
    acc.subs += l.subsMade;
    acc.traits += l.traitTriggers;
    acc.chem += l.chemPasses;
    acc.scout += l.scoutCounters;
    return acc;
  },
  { w: 0, d: 0, l: 0, cardsPlayed: 0, combos: 0, timingDiscounts: 0, skillsOffered: 0, skillsActivated: 0, subs: 0, traits: 0, chem: 0, scout: 0 }
);

const finalInventorySize = mgr.getCoachDeck().length;
const flags: string[] = [];
if (nanFields.length > 0) flags.push(`CRITICAL: NaN detected in ${nanFields.join(', ')}`);
if (winterWindowBlocks.length > 0) flags.push(`WARN: 冬季转会窗未能关闭 (${winterWindowBlocks.length} 次): ${winterWindowBlocks[0]}`);
if (cfg.seasons > 1 && seasonSummaries.length < cfg.seasons) {
  flags.push(`WARN: 赛季结算数不足 (${seasonSummaries.length}/${cfg.seasons})，赛季未能完整走完`);
}
if (totals.chem === 0) flags.push('WARN: 默契连线触发为 0 次（请检查阈值或连线条件）');
if (cfg.strategy !== 'baseline' && totals.cardsPlayed === 0) flags.push('WARN: V5 卡牌打出数为 0');
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
  console.log(
    JSON.stringify(
      {
        cfg,
        avgCA,
        totals,
        v5Telemetry: {
          reactorCrafts,
          tier3Crafts,
          affixesRolled,
          cardsRecycled,
          shopBuys,
          totalCardsDepleted,
          finalInventorySize,
        },
        devilTrains,
        metaUpgrades,
        metaPointsDelta,
        metaLevelsSnapshot,
        clubFundsSnapshot,
        seasonBonusSummary,
        retiredLegend,
        seasonMemories,
        winterWindowBlocks,
        seasonBonusErrors,
        metaUpgradeDetails,
        metaUpgradeBlocks,
        seasonSummaries,
        flags,
        logs,
      },
      null,
      2
    )
  );
} else {
  console.log(`\n=== FM-League V5 卡牌体系 CLI 自动游玩与诊断报告 ===`);
  console.log(`策略: ${cfg.strategy} | 赛季数: ${cfg.seasons} | 阵型: ${cfg.formation} | 风格: ${cfg.style} | 阵容均评: ${avgCA}`);
  console.log(`战绩 (${logs.length}场): ${totals.w}胜 ${totals.d}平 ${totals.l}负`);
  console.log(
    `V5 卡牌遥测: 出牌 ${totals.cardsPlayed} 张 (场均 ${(totals.cardsPlayed / Math.max(1, logs.length)).toFixed(1)}) | 连击 ${totals.combos} 次 | 时机减费 ${totals.timingDiscounts} 次 | 耐久耗尽 ${totalCardsDepleted} 张 | 反应釜合成 ${reactorCrafts} 次 (3阶 ${tier3Crafts}) | 词条(正${affixesRolled.positive}/负${affixesRolled.negative}/彩蛋${affixesRolled.easter_egg}) | 残血回收 ${cardsRecycled} | 商店购卡 ${shopBuys} | 末期背包 ${finalInventorySize} 张`
  );
  console.log(
    `引擎机制总计: 主动技 ${totals.skillsActivated}/${totals.skillsOffered} | 换人 ${totals.subs} | 特质 ${totals.traits} | 默契连线 ${totals.chem} | 破绽压制 ${totals.scout} | 魔鬼特训 ${devilTrains} | Meta升级 ${metaUpgrades}`
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
  }
  console.log('');
  console.log('| 轮次 | 对手 | 比分 | xG | 侦察 | 出牌/连击/耗尽 | 主动技 | 换人 | 赛后复盘 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const l of logs) {
    console.log(
      `| R${l.round} | ${l.opponent} | ${l.score}(${l.result}) | ${l.myXG}:${l.oppXG} | ${l.scoutedCorrect ? '命中' : '未'} | ${l.cardsPlayed}/${l.combosTriggered}/${l.cardsDepleted} | ${l.skillsActivated}/${l.skillsOffered} | ${l.subsMade} | ${l.review} |`
    );
  }
  console.log('');
  console.log('=== 自动化体检结论 ===');
  if (flags.length === 0) {
    console.log('PASS: 全部 V5 卡牌与比赛引擎机制链路激活正常，无死机制、无 NaN。');
  } else {
    for (const f of flags) console.log(`- ${f}`);
  }
}
