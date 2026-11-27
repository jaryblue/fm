/**
 * @fm-league/core - 轻度 Rogue 联赛总控中枢
 * 负责：开局选秀 -> 7轮常规赛 -> 第2/4/6轮 Re-Draft -> 前4名季后赛 -> 结算与存档序列化
 */

import { FORMATIONS, getDefenseSystem } from '../../engine/src/formations';
import { MatchEngine } from '../../engine/src/MatchEngine';
import {
  ActiveLegendaryAspect,
  CommandCardEffect,
  EquippedActiveSkill,
  FormationName,
  MatchState,
  PerkSkillSynergyFlags,
  PlayerAttributes,
  PlayerDuty,
  PlayerInput,
  SkillBranchChoice,
  TacticalStyle,
  TeamSetup,
} from '../../engine/src/types';
import {
  calcRefundablePoints,
  canUnlockCore,
  canUnlockMasterySeal,
  canUnlockV6Node,
  compileAstrolabeToMatchSetup,
  compileDirectiveToEffect,
  getV6TierCaps,
  createDefaultAstrolabeState,
  createEmptySeasonRogueState,
  ensureV6AstrolabeState,
  getAlignedFusions,
  V6_ACTIVE_SKILL_MAP,
  V6_DIRECTIVES,
  V6_DIRECTIVE_ENCHANTS,
  V6_DIRECTIVE_MAP,
  V6_FUSION_KEYSTONES,
  V6_FUSION_MAP,
  V6_MASTERY_SEAL_MAP,
  V6_PASSIVE_MAP,
  V6_RELICS,
  type V6AstrolabeState,
  type V6CheckpointKey,
  type V6CompiledDirectiveEntry,
  type V6DirectiveDef,
  type V6DirectiveEnchantId,
  type V6RelicId,
  type V6SatelliteKey,
  type V6SeasonRogueState,
} from './v6';
import {
  calcTransferValue,
  computeInitialPA,
  computePerkSynergies,
  computeWeightedCA,
  createReturningCaptainLinFeng,
  FICTIONAL_CLUBS,
  generateBlackMarketPlayer,
  generateCorePackChoices,
  generateInitialSkeleton8,
  generateShuffleSet,
  generateTierPyramid,
  generateYouthProspect,
  rollBrokerRecommendation,
  rollSeasonStoryline,
  rollSecondaryRoles,
  SECONDARY_ROLE_POOL,
} from './PlayerPool';
import {
  createDefaultMetaLevels,
  createDefaultTacticalMastery,
  getFormationMasteryInfo,
  getMetaUpgradeCost,
  getMetaUpgradeRequirement,
  getStyleMasteryInfo,
} from './MetaTree';
import {
  canUnlockNode,
  computeSkillBonusRank,
  computeSkillWebMods,
  getActiveLegendaryAspects,
  getOriginForFormation,
  getOriginForStyle,
  getSkillTotalInvestedPoints,
  getUnlockedActiveSkillNodes,
  isNodeResonating,
  SKILL_RANK_UPGRADE_COSTS,
  SKILL_WEB_NODES,
  toEquippedActiveSkill,
} from './SkillWeb';
import {
  computeCentralSpineInfo,
  decayChemistryOffSeason,
  getFormationLinks,
  getOrCreateChemistryLink,
  getPlayerFormationFamiliarity,
  pairKey,
} from './Chemistry';
import { createMidSeasonChoice, createOpeningBriefing } from './StoryEvents';
import {
  createInterMatchPrep,
  ensureChronicles,
  evaluateChronicleTrigger,
  recordChronicleChoice,
  recordChronicleMoment,
  triggerSeasonStartChronicle,
} from './Chronicles';
import {
  buildOpponentMatchupIntel,
  generatePostMatchReview,
  getOpponentIntelRecord,
  updateOpponentIntelAfterMatch,
} from './OpponentScouting';
import {
  CommandCard,
  computeDeckArchetypeGene,
  CraftFocus,
  craftFromReactor,
  createCaptainRoarCard,
  createInitialElements,
  createStarterCoachDeck,
  ElementId,
  fuseTwoCards,
  getStyleBaseCards,
  inferCardElement,
  instantiateV5Card,
  POSITIVE_AFFIXES,
  previewReactor,
  ReactorPreview,
  pickStyleOnboardingCard,
  rollStyleConsumableCard,
  synthesizeChemistry,
  TACTICAL_ELEMENTS,
  upgradeCommandCard,
  V5_CHEMICAL_CARDS,
} from './CommandCards';
import { createDefaultHallOfFame, tryUnlockAchievement } from './Achievements';
import {
  autoSelectStarters,
  createInitialDraftState,
  createReDraftOffer,
  DRAFT_PICKS_PER_SET,
  DRAFT_SETS_TOTAL,
  generateAIDraftSquad,
} from './ShuffleDraft';
import { computeStandings, generateRoundRobinFixtures, getLeagueTierInfo, getTierRegularRounds, TOTAL_TIERS } from './LeagueScheduler';
import { getRoundCadence, rollTieredGambleOptions, rollTriStateGamble } from './PostMatchEvents';
import {
  CardShopOffer,
  ChemistryLink,
  ChronicleProgress,
  ClubDirectoryEntry,
  CorePackDraftState,
  DeckPreset,
  DraftPlayer,
  FixtureMatch,
  GambleOutcomeTier,
  HallOfFameData,
  InterMatchPrepState,
  LeagueClub,
  LeagueSaveState,
  MetaBranch,
  MetaLevels,
  PendingBrokerResult,
  PostMatchRewardCategory,
  PostMatchRewardOption,
  PostMatchRewardState,
  PrepTrainingKind,
  ScoutingZoneId,
  ScoutRewardKind,
  SeasonBonusOption,
  SeasonMemory,
  SeasonSummary,
  StandingRow,
  TacticalPresetSlot,
  TransferListing,
  TransferMarketState,
  TransferOffer,
  TutorialProgress,
  YouthAcademyState,
} from './types';

export interface NewSeasonOptions {
  clubId?: string;
  customName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  awayPrimaryColor?: string;
  awaySecondaryColor?: string;
  formation?: FormationName;
  style?: TacticalStyle;
}

const AI_FORMATIONS: FormationName[] = ['4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '3-5-2', '3-4-2-1', '5-4-1', '5-3-2'];
const AI_STYLES: TacticalStyle[] = ['balanced', 'tiki_taka', 'gegenpress', 'counter', 'wing_play'];
const RE_DRAFT_ROUNDS = new Set([8, 16, 24]);
export const TOTAL_REGULAR_ROUNDS = 34;
export const MAX_CLUB_ROSTER = 40;
export const SEASON_SQUAD_SIZE = 26;

export interface PlayerMatchGrowth {
  famGain: number;
  chemGain: number;
  caGain?: number;
  bestPartner?: string;
  unlockedTrait?: string;
  isCaptain?: boolean;
}

export interface LastMatchSummary {
  roundNumber: number;
  fundsEarned: number;
  metaGain: number;
  rankBefore: number;
  rankAfter: number;
  totalTeams: number;
}

export class LeagueManager {
  private state: LeagueSaveState;
  private lastMatchGrowth: Record<string, PlayerMatchGrowth> = {};
  private lastMatchSummary: LastMatchSummary | null = null;

  constructor(initialState?: LeagueSaveState) {
    if (initialState) {
      this.state = JSON.parse(JSON.stringify(initialState));
      this.migrateState();
    } else {
      this.state = this.createNewSeasonState();
    }
  }

  /**
   * 旧存档自动迁移：补全化学合成、出战卡槽、荣誉室、26人大名单与休赛期字段
   */
  private migrateState(): void {
    if (this.state.currentTier === undefined) this.state.currentTier = 7;
    if (this.state.bestTierReached === undefined) {
      this.state.bestTierReached = this.state.currentTier ?? 7;
    }
    if (this.state.clubFunds === undefined) {
      this.state.clubFunds = 500;
    }
    if (!this.state.seasonPrivateTrainedIds) this.state.seasonPrivateTrainedIds = [];
    if (!this.state.leaguePyramid) {
      this.state.leaguePyramid = generateTierPyramid(this.state.userClubId || 'club_star');
    }
    if (!this.state.metaLevels) {
      this.state.metaLevels = createDefaultMetaLevels();
    } else {
      const rawMeta = this.state.metaLevels as unknown as Record<string, number>;
      const def = createDefaultMetaLevels();
      if (rawMeta.medical === undefined && rawMeta.fitness !== undefined) {
        rawMeta.medical = rawMeta.fitness;
      }
      if (rawMeta.training_ground === undefined && rawMeta.coaching !== undefined) {
        rawMeta.training_ground = rawMeta.coaching;
      }
      for (const k of Object.keys(def) as MetaBranch[]) {
        if (rawMeta[k] === undefined) rawMeta[k] = 0;
      }
      delete rawMeta.coaching;
      delete rawMeta.fitness;
    }
    if (!this.state.tacticalMastery) this.state.tacticalMastery = createDefaultTacticalMastery();
    const defMastery = createDefaultTacticalMastery();
    for (const fk of Object.keys(defMastery.formations) as FormationName[]) {
      if (this.state.tacticalMastery.formations[fk] === undefined) {
        this.state.tacticalMastery.formations[fk] = 0;
      }
    }
    if (!this.state.skillWebUnlocked || this.state.skillWebUnlocked.length === 0) {
      const uc = this.state.clubs?.find(c => c.id === this.state.userClubId);
      this.state.skillWebUnlocked = [
        getOriginForStyle(uc?.style ?? 'tiki_taka'),
        getOriginForFormation(uc?.formation ?? '4-3-3'),
      ];
    }
    {
      const uc = this.state.clubs?.find(c => c.id === this.state.userClubId);
      this.state.v6Astrolabe = ensureV6AstrolabeState(
        this.state.v6Astrolabe,
        uc?.style ?? 'tiki_taka',
        uc?.formation ?? '4-3-3'
      );
    }
    if (!this.state.hallOfFame) this.state.hallOfFame = createDefaultHallOfFame();
    if (!this.state.tutorialDone) this.state.tutorialDone = {};
    if (!this.state.elementInventory) this.state.elementInventory = createInitialElements();
    if (!this.state.discoveredRecipes) this.state.discoveredRecipes = [];
    if (!this.state.seasonTrainedIds) this.state.seasonTrainedIds = [];

    if (!this.state.clubRoster) {
      if (this.state.persistentSquad && this.state.persistentSquad.length > 0) {
        this.state.clubRoster = JSON.parse(JSON.stringify(this.state.persistentSquad));
      } else {
        const uc = this.state.clubs?.find(c => c.id === this.state.userClubId);
        this.state.clubRoster = uc && uc.squad.length > 0 ? JSON.parse(JSON.stringify(uc.squad)) : [];
      }
    }

    const userStyle = this.state.clubs?.find(c => c.id === this.state.userClubId)?.style ?? 'tiki_taka';
    if (!this.state.coachDeck || this.state.coachDeck.length === 0) {
      this.state.coachDeck = createStarterCoachDeck(userStyle);
    } else {
      for (const c of this.state.coachDeck) {
        if (!c.level) c.level = 1;
        if (!c.targetLine) c.targetLine = 'ALL';
        if (!c.isBase && c.id !== 'card_captain_roar') {
          if (c.tier === undefined) c.tier = c.level >= 3 ? 2 : 1;
          if (c.maxUses === undefined) c.maxUses = c.tier === 3 ? 1 : c.tier === 2 ? 2 : 3;
          if (c.remainingUses === undefined) c.remainingUses = c.maxUses;
          if (!c.gene) c.gene = inferCardElement(c);
        }
      }
      this.state.coachDeck = this.state.coachDeck.filter(c => c.isBase || c.id === 'card_captain_roar' || (c.remainingUses ?? 1) > 0);
    }
    // V5 旧存档迁移：残留元素按 2:1 折算为 1 阶消耗卡
    if (this.state.elementInventory) {
      const totalElems = Object.values(this.state.elementInventory).reduce((s, n) => s + (n || 0), 0);
      const convertCards = Math.floor(totalElems / 2);
      if (convertCards > 0) {
        for (let i = 0; i < convertCards && this.state.coachDeck.length < 60; i++) {
          this.state.coachDeck.push(rollStyleConsumableCard(userStyle, 1));
        }
        this.state.elementInventory = createInitialElements();
      }
    }
    while (this.state.coachDeck.filter(c => !c.isBase && c.id !== 'card_captain_roar').length < 4) {
      this.state.coachDeck.push(rollStyleConsumableCard(userStyle, 1));
    }
    if (!this.state.clubs || this.state.clubs.length === 0) {
      const fresh = this.createNewSeasonState();
      this.state = fresh;
      return;
    }
    for (const c of this.state.clubs) {
      if (!c.awayPrimaryColor) c.awayPrimaryColor = '#F8FAFC';
      if (!c.awaySecondaryColor) c.awaySecondaryColor = c.primaryColor;
      for (const p of c.squad) {
        if (!p.secondaryRoles) p.secondaryRoles = rollSecondaryRoles(p.role, p.tier);
        if (p.pa === undefined) p.pa = computeInitialPA(p.ca, p.age ?? 24, (p.age ?? 24) <= 19);
        if (p.scoutFogLevel === undefined) p.scoutFogLevel = 2;
        if (p.marketValue === undefined) p.marketValue = calcTransferValue(p);
      }
    }
    for (const p of this.state.clubRoster ?? []) {
      if (!p.secondaryRoles) p.secondaryRoles = rollSecondaryRoles(p.role, p.tier);
      if (p.pa === undefined) p.pa = computeInitialPA(p.ca, p.age ?? 24, (p.age ?? 24) <= 19);
      if (p.scoutFogLevel === undefined) p.scoutFogLevel = 2;
      if (p.marketValue === undefined) p.marketValue = calcTransferValue(p);
    }
    if (!this.state.clubs.some(c => c.id === this.state.userClubId)) {
      const fallback = this.state.clubs.find(c => c.isUser) ?? this.state.clubs[0];
      this.state.userClubId = fallback.id;
      fallback.isUser = true;
    }
    if (this.state.phase === 'INIT_DRAFT' && this.state.draft && this.state.draft.targetSquadSize < 26) {
      this.state.draft.targetSquadSize = 26;
      this.state.draft.budgetTotal += 800;
      this.state.draft.budgetRemaining += 800;
    }
    ensureChronicles(this.state);
    if ((this.state.currentTier ?? 7) === 1) {
      tryUnlockAchievement(this.state, 'ach_top_tier');
    }
    if (this.state.stayedTierCount === undefined) this.state.stayedTierCount = 0;
    if (this.state.winlessStreak === undefined) this.state.winlessStreak = 0;
    if (!this.state.seasonMemories) this.state.seasonMemories = [];
    if (this.state.phase === 'RE_DRAFT') {
      this.state.reDraft = null;
      this.state.phase = 'REGULAR_SEASON';
      this.state.currentRound = Math.min(this.getTotalRegularRounds(), (this.state.currentRound ?? 1) + 1);
    }
    if (this.state.phase === 'REGULAR_SEASON' && !this.state.interMatchPrep) {
      this.state.interMatchPrep = createInterMatchPrep(this.state, this.getUserClub());
    }
    const uc = this.getUserClub();
    if (
      this.state.seasonNumber === 1 &&
      this.state.prologueCompleted &&
      !this.state.secretRetiredEnding &&
      this.state.phase !== 'SEASON_END' &&
      uc &&
      !uc.squad.some(p => p.isPrologueCaptain || p.id === 'captain_lin_feng')
    ) {
      this.grantReturningCaptainPlayer();
    }
    if (uc && uc.starterIds.length === 11) {
      this.replaceUnavailableStarters(uc);
    }
    this.getLoadoutIds();
  }

  public getState(): LeagueSaveState {
    return this.state;
  }

  public getCurrentTierInfo() {
    return getLeagueTierInfo(this.state.currentTier ?? 7);
  }

  public getTotalRegularRounds(): number {
    const count = this.state?.clubs?.length ?? 0;
    if (count >= 2) return (count - 1) * 2;
    return getTierRegularRounds(this.state?.currentTier ?? 7);
  }

  public getMidSeasonRound(): number {
    return Math.max(1, Math.floor(this.getTotalRegularRounds() / 2));
  }

  private getReDraftRounds(): Set<number> {
    const total = this.getTotalRegularRounds();
    if (total === 34) return RE_DRAFT_ROUNDS;
    return new Set([
      Math.max(4, Math.round(total * 0.25)),
      this.getMidSeasonRound(),
      Math.min(total - 2, Math.round(total * 0.72)),
    ]);
  }

  public getUserClub(): LeagueClub {
    return (
      this.state.clubs.find(c => c.id === this.state.userClubId) ??
      this.state.clubs.find(c => c.isUser) ??
      this.state.clubs[0]
    );
  }

  public getLastMatchGrowth(): Record<string, PlayerMatchGrowth> {
    return this.lastMatchGrowth;
  }

  public getLastMatchSummary(): LastMatchSummary | null {
    return this.lastMatchSummary;
  }

  public getStandings(): StandingRow[] {
    return computeStandings(this.state.clubs, this.state.fixtures);
  }

  public getCurrentRoundFixtures(): FixtureMatch[] {
    return this.state.fixtures.filter(f => f.round === this.state.currentRound);
  }

  public getUserCurrentFixture(): FixtureMatch | null {
    return (
      this.state.fixtures.find(
        f =>
          f.round === this.state.currentRound &&
          !f.played &&
          (f.homeClubId === this.state.userClubId || f.awayClubId === this.state.userClubId)
      ) || null
    );
  }

  /**
   * 赛前球探情报简报：分析对手战术克制建议、最弱位置线与头号得分威胁
   */
  public getOpponentBriefing(oppClubId: string): {
    styleName: string;
    counterTip: string;
    weakLineLabel: string;
    keyThreat: string;
    ecoTag?: string;
    isRival?: boolean;
    formerPlayerName?: string;
  } {
    const opp = this.state.clubs.find(c => c.id === oppClubId);
    if (!opp) {
      return { styleName: '均衡阵地', counterTip: '保持主力首发稳扎稳打', weakLineLabel: '无明显短板', keyThreat: '全队均衡' };
    }
    const styleNames: Record<TacticalStyle, string> = {
      tiki_taka: '传控渗透',
      gegenpress: '高位逼抢',
      balanced: '均衡阵地',
      wing_play: '两翼齐飞',
      counter: '快速反击',
      park_bus: '铁桶防反',
    };
    const counterTips: Record<TacticalStyle, string> = {
      tiki_taka: '建议【高位逼抢】或【铁闸】切断短传节奏',
      gegenpress: '建议【快速反击】直塞打其高位防线身后',
      balanced: '推荐针对其最弱一条线布置进攻卡片',
      wing_play: '建议切【5后卫】或强化防线限制边路传中',
      counter: '建议【传控渗透】控球压制，少留反击空间',
      park_bus: '建议【两翼齐飞】或带【定位球/远射】破铁桶',
    };
    const squadMap = new Map(opp.squad.map(p => [p.id, p]));
    const starters = opp.starterIds.map(id => squadMap.get(id)).filter((p): p is DraftPlayer => !!p);
    const avgOf = (roles: string[]) => {
      const list = starters.filter(p => roles.includes(p.role));
      return list.length ? Math.round(list.reduce((s, p) => s + p.ca, 0) / list.length) : 60;
    };
    const defAvg = avgOf(['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB']);
    const midAvg = avgOf(['CDM', 'CM', 'CAM', 'LM', 'RM']);
    const attAvg = avgOf(['LW', 'RW', 'ST']);
    const minVal = Math.min(defAvg, midAvg, attAvg);
    const weakLineLabel =
      minVal === defAvg ? `防线偏弱 (均分 ${defAvg})` :
      minVal === midAvg ? `中场薄弱 (均分 ${midAvg})` : `锋线偏弱 (均分 ${attAvg})`;

    const threat = [...opp.squad]
      .filter(p => p.role !== 'GK')
      .sort((a, b) => (b.seasonStats.goals !== a.seasonStats.goals ? b.seasonStats.goals - a.seasonStats.goals : b.ca - a.ca))[0];
    const keyThreat = threat
      ? `${threat.name} (${threat.role} CA${threat.ca}${threat.seasonStats.goals > 0 ? ` · ${threat.seasonStats.goals}球` : ''})`
      : '无重点盯防目标';

    const former = opp.squad.find(p => p.formerUserClub);
    const isRival = !!opp.isRival || (this.state.rivalClubIds ?? []).includes(opp.id);
    return {
      styleName: styleNames[opp.style] || opp.style,
      counterTip: counterTips[opp.style] || '按常规阵型应战',
      weakLineLabel,
      keyThreat,
      ecoTag: opp.ecoTag,
      isRival,
      formerPlayerName: former ? `${former.name}(${former.role}·CA${former.ca})` : undefined,
    };
  }

  /**
   * 序列化存档（兼容本地 JSON 与微信云开发数据库）
   */
  public serialize(): string {
    return JSON.stringify(this.state);
  }

  public static deserialize(raw: string | LeagueSaveState): LeagueManager {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return new LeagueManager(parsed);
  }

  public getMetaLevels(): MetaLevels {
    return this.state.metaLevels ?? createDefaultMetaLevels();
  }

  public getHallOfFame(): HallOfFameData {
    if (!this.state.hallOfFame) {
      this.state.hallOfFame = createDefaultHallOfFame();
    }
    return this.state.hallOfFame;
  }

  public getTutorialProgress(): TutorialProgress {
    if (!this.state.tutorialDone) {
      this.state.tutorialDone = {};
    }
    return this.state.tutorialDone;
  }

  public markTutorialStep(
    step: 'draft' | 'portal_summer' | 'portal_prep' | 'portal_scout' | 'tactics' | 'cards' | 'match' | 'post_match' | 'skipAll'
  ): void {
    const tut = this.getTutorialProgress();
    if (step === 'skipAll') {
      tut.skippedAll = true;
    } else {
      tut[step] = true;
    }
  }

  public resetTutorial(): void {
    this.state.tutorialDone = {};
  }

  public isPrologueCompleted(): boolean {
    return !!this.state.prologueCompleted;
  }

  public markPrologueCompleted(): void {
    this.state.prologueCompleted = true;
  }

  public markSecretRetiredEnding(): void {
    this.state.secretRetiredEnding = true;
    tryUnlockAchievement(this.state, 'ach_secret_retire');
  }

  public grantCaptainRoarCard(): boolean {
    this.state.coachDeck ??= createStarterCoachDeck();
    const exists = this.state.coachDeck.some(c => c.id === 'card_captain_roar');
    if (!exists) {
      const card = createCaptainRoarCard();
      if (this.state.coachDeck.length >= 12) {
        this.state.coachDeck[0] = card;
      } else {
        this.state.coachDeck.unshift(card);
      }
    }
    const loadout = (this.state.coachLoadoutIds ?? this.state.coachDeck.slice(0, 4).map(c => c.id))
      .filter(id => id !== 'card_captain_roar');
    this.state.coachLoadoutIds = ['card_captain_roar', ...loadout].slice(0, 4);
    return true;
  }

  public grantReturningCaptainPlayer(): boolean {
    const club = this.getUserClub();
    const roster = this.getClubRoster();
    if (club.squad.some(p => p.isPrologueCaptain || p.id === 'captain_lin_feng')) {
      return true;
    }
    const linFeng = createReturningCaptainLinFeng();
    const linCopy = JSON.parse(JSON.stringify(linFeng)) as DraftPlayer;
    const replaceIdx = club.squad.findIndex(p => p.role === 'ST');
    if (replaceIdx >= 0) {
      const removedId = club.squad[replaceIdx].id;
      club.squad[replaceIdx] = linFeng;
      const rIdx = roster.findIndex(r => r.id === removedId);
      if (rIdx >= 0) roster[rIdx] = linCopy;
      else roster.unshift(linCopy);
      const sIdx = club.starterIds.indexOf(removedId);
      if (sIdx >= 0) club.starterIds[sIdx] = linFeng.id;
      if (this.state.rosterSelectedIds) {
        const rsIdx = this.state.rosterSelectedIds.indexOf(removedId);
        if (rsIdx >= 0) this.state.rosterSelectedIds[rsIdx] = linFeng.id;
      }
    } else {
      club.squad.unshift(linFeng);
      roster.unshift(linCopy);
    }
    club.captainId = linFeng.id;
    return true;
  }

  public getClubFunds(): number {
    if (this.state.clubFunds === undefined) this.state.clubFunds = 500;
    return this.state.clubFunds;
  }

  public addClubFunds(amount: number): number {
    this.state.clubFunds = Math.max(0, Math.round(this.getClubFunds() + amount));
    return this.state.clubFunds;
  }

  public spendClubFunds(amount: number): boolean {
    const cur = this.getClubFunds();
    if (cur < amount) return false;
    this.state.clubFunds = Math.round(cur - amount);
    return true;
  }

  public getBestTierReached(): number {
    if (this.state.bestTierReached === undefined) {
      this.state.bestTierReached = this.state.currentTier ?? 7;
    }
    return this.state.bestTierReached;
  }

  public upgradeMetaBranch(branch: MetaBranch): { ok: boolean; reason?: string } {
    if (!this.state.metaLevels) {
      this.state.metaLevels = createDefaultMetaLevels();
    }
    const curLv = this.state.metaLevels[branch] ?? 0;
    const req = getMetaUpgradeRequirement(branch, curLv);
    if (!req) return { ok: false, reason: '该基建分支已达满级 (Lv.8)' };
    const bestTier = this.getBestTierReached();
    if (bestTier > req.minTier) {
      return { ok: false, reason: `需曾晋级第 ${req.minTier} 级或更高联赛解锁 (当前最高第 ${bestTier} 级)` };
    }
    const funds = this.getClubFunds();
    if (funds < req.cost) {
      return { ok: false, reason: `俱乐部资金不足 (需要 ¥${req.cost}，当前 ¥${funds})` };
    }
    this.state.clubFunds = funds - req.cost;
    this.state.metaLevels[branch] = curLv + 1;
    if (this.state.metaLevels[branch] >= 3) {
      tryUnlockAchievement(this.state, 'ach_meta_lv3');
    }
    return { ok: true };
  }

  public getTacticalMastery() {
    if (!this.state.tacticalMastery) {
      this.state.tacticalMastery = createDefaultTacticalMastery();
    }
    return this.state.tacticalMastery;
  }

  public studyTacticalMastery(
    kind: 'formation' | 'style',
    key: FormationName | TacticalStyle
  ): { ok: boolean; newXp?: number; reason?: string } {
    if (this.state.metaPointsTotal < 30) {
      return { ok: false, reason: 'Meta 点数不足（战术研习需要 30 pt）' };
    }
    const m = this.getTacticalMastery();
    const cur = kind === 'formation'
      ? (m.formations[key as FormationName] ?? 0)
      : (m.styles[key as TacticalStyle] ?? 0);
    if (cur >= 15) return { ok: false, reason: '该项熟练度已达宗师 (Lv.3) 满级' };
    this.state.metaPointsTotal -= 30;
    const next = Math.min(15, cur + 5);
    if (kind === 'formation') m.formations[key as FormationName] = next;
    else m.styles[key as TacticalStyle] = next;
    return { ok: true, newXp: next };
  }

  public getSkillWebUnlocked(): string[] {
    if (!this.state.skillWebUnlocked || this.state.skillWebUnlocked.length === 0) {
      const uc = this.state.clubs?.find(c => c.id === this.state.userClubId);
      this.state.skillWebUnlocked = [
        getOriginForStyle(uc?.style ?? 'tiki_taka'),
        getOriginForFormation(uc?.formation ?? '4-3-3'),
      ];
    }
    return this.state.skillWebUnlocked;
  }

  public unlockSkillWebNode(nodeId: string): { ok: boolean; nodeName?: string; reason?: string } {
    const node = SKILL_WEB_NODES.find(n => n.id === nodeId);
    if (!node) return { ok: false, reason: '未找到该技能网节点' };
    const unlocked = this.getSkillWebUnlocked();
    if (unlocked.includes(nodeId)) return { ok: false, reason: '该节点已点亮' };
    if (!canUnlockNode(nodeId, unlocked)) {
      return { ok: false, reason: '需先点亮与该节点相连的相邻节点' };
    }
    if (this.state.metaPointsTotal < node.cost) {
      return { ok: false, reason: `Meta 点数不足 (需要 ${node.cost} pt)` };
    }
    this.state.metaPointsTotal -= node.cost;
    unlocked.push(nodeId);
    return { ok: true, nodeName: node.name };
  }

  public resetSkillWeb(): { ok: boolean; refunded: number; reason?: string } {
    const uc = this.getUserClub();
    const freeStyleOrigin = getOriginForStyle(uc?.style ?? 'tiki_taka');
    const freeFormOrigin = getOriginForFormation(uc?.formation ?? '4-3-3');
    const keepSet = new Set([freeStyleOrigin, freeFormOrigin]);
    const unlocked = this.getSkillWebUnlocked();
    const nodeMap = new Map(SKILL_WEB_NODES.map(n => [n.id, n]));
    let refunded = getSkillTotalInvestedPoints(unlocked, this.state.skillRanks);
    for (const id of unlocked) {
      if (keepSet.has(id)) continue;
      const n = nodeMap.get(id);
      if (n) refunded += n.cost;
    }
    if (refunded === 0 && unlocked.length <= 2) {
      return { ok: false, refunded: 0, reason: '当前仅点亮初始原点，无需重置' };
    }
    this.state.metaPointsTotal += refunded;
    this.state.skillWebUnlocked = Array.from(keepSet);
    this.state.skillLoadoutIds = (this.state.skillLoadoutIds ?? []).filter(id => keepSet.has(id));
    this.state.skillRanks = {};
    this.state.skillMutations = {};
    return { ok: true, refunded };
  }

  public getUserPerkSynergyFlags(): PerkSkillSynergyFlags {
    const uc = this.getUserClub();
    const syn = computePerkSynergies(uc?.perks ?? []);
    return {
      attackTier: syn.counts.attack >= 2 ? 1 : 0,
      defenseTier: syn.counts.defense >= 2 ? 1 : 0,
      controlTier: syn.counts.control >= 2 ? 1 : 0,
    };
  }

  public getSkillRank(nodeId: string): number {
    if (!this.getSkillWebUnlocked().includes(nodeId)) return 0;
    return Math.max(1, Math.min(3, this.state.skillRanks?.[nodeId] ?? 1));
  }

  public getSkillMutation(nodeId: string): SkillBranchChoice {
    return this.state.skillMutations?.[nodeId] ?? 'A';
  }

  public getSkillProgressInfo(nodeId: string): {
    unlocked: boolean;
    baseRank: number;
    bonusRank: number;
    effectiveRank: number;
    maxBaseRank: number;
    nextUpgradeCost: number | null;
    mutationChoice: SkillBranchChoice;
    mutationUnlocked: boolean;
  } {
    const unlockedIds = this.getSkillWebUnlocked();
    const unlocked = unlockedIds.includes(nodeId);
    const node = SKILL_WEB_NODES.find(n => n.id === nodeId);
    if (!unlocked || !node?.activeSkill) {
      return {
        unlocked,
        baseRank: 0,
        bonusRank: 0,
        effectiveRank: 0,
        maxBaseRank: 3,
        nextUpgradeCost: null,
        mutationChoice: 'A',
        mutationUnlocked: false,
      };
    }
    const baseRank = this.getSkillRank(nodeId);
    const uc = this.getUserClub();
    const formation = uc?.formation ?? '4-3-3';
    const style = uc?.style ?? 'tiki_taka';
    const mastery = this.getTacticalMastery();
    const fmLv = getFormationMasteryInfo(formation, mastery.formations[formation] ?? 0).level;
    const stLv = getStyleMasteryInfo(style, mastery.styles[style] ?? 0).level;
    const bonusRank = computeSkillBonusRank(node, {
      formation,
      style,
      unlockedIds,
      formationMasteryLv: fmLv,
      styleMasteryLv: stLv,
      perkSynergies: this.getUserPerkSynergyFlags(),
    });
    const effectiveRank = Math.min(5, baseRank + bonusRank);
    const nextUpgradeCost = baseRank < 3 ? SKILL_RANK_UPGRADE_COSTS[(baseRank + 1) as 2 | 3] : null;
    return {
      unlocked: true,
      baseRank,
      bonusRank,
      effectiveRank,
      maxBaseRank: 3,
      nextUpgradeCost,
      mutationChoice: this.getSkillMutation(nodeId),
      mutationUnlocked: effectiveRank >= 2,
    };
  }

  public upgradeSkillRank(nodeId: string): { ok: boolean; newRank?: number; cost?: number; reason?: string } {
    if (!this.getSkillWebUnlocked().includes(nodeId)) {
      return { ok: false, reason: '请先点亮该技能节点' };
    }
    const node = SKILL_WEB_NODES.find(n => n.id === nodeId);
    if (!node?.activeSkill) return { ok: false, reason: '仅主动技能节点可提升等级' };
    const curRank = this.getSkillRank(nodeId);
    if (curRank >= 3) {
      return { ok: false, reason: '已达 Meta 等级上限 (Lv.3)，可通过流派熟练度与词条共鸣额外 +2 级' };
    }
    const nextRank = (curRank + 1) as 2 | 3;
    const cost = SKILL_RANK_UPGRADE_COSTS[nextRank];
    if (this.state.metaPointsTotal < cost) {
      return { ok: false, reason: `Meta 点数不足 (升至 Lv.${nextRank} 需要 ${cost} pt)` };
    }
    this.state.metaPointsTotal -= cost;
    this.state.skillRanks ??= {};
    this.state.skillRanks[nodeId] = nextRank;
    if (nextRank >= 3) {
      tryUnlockAchievement(this.state, 'ach_skill_rank3');
    }
    if (nextRank >= 2) {
      this.state.skillMutations ??= {};
      if (!this.state.skillMutations[nodeId]) this.state.skillMutations[nodeId] = 'A';
    }
    return { ok: true, newRank: nextRank, cost };
  }

  public setSkillMutation(nodeId: string, choice: SkillBranchChoice): { ok: boolean; reason?: string } {
    const info = this.getSkillProgressInfo(nodeId);
    if (!info.unlocked) return { ok: false, reason: '请先点亮该技能节点' };
    const node = SKILL_WEB_NODES.find(n => n.id === nodeId);
    if (!node?.activeSkill?.mutations) return { ok: false, reason: '该节点不含质变分支' };
    if (!info.mutationUnlocked) return { ok: false, reason: '技能有效等级达到 Lv.2 后即可自由切换 A/B 质变' };
    this.state.skillMutations ??= {};
    this.state.skillMutations[nodeId] = choice;
    tryUnlockAchievement(this.state, 'ach_skill_mutate');
    return { ok: true };
  }

  public getActiveLegendaryAspects(): ActiveLegendaryAspect[] {
    const uc = this.getUserClub();
    return getActiveLegendaryAspects(
      this.getSkillWebUnlocked(),
      uc?.formation ?? '4-3-3',
      uc?.style ?? 'tiki_taka'
    );
  }

  public getSkillLoadoutIds(): string[] {
    const unlockedActive = getUnlockedActiveSkillNodes(this.getSkillWebUnlocked());
    const validIds = new Set(unlockedActive.map(n => n.id));
    if (!this.state.skillLoadoutIds) {
      this.state.skillLoadoutIds = unlockedActive.slice(0, 4).map(n => n.id);
    } else {
      this.state.skillLoadoutIds = this.state.skillLoadoutIds.filter(id => validIds.has(id)).slice(0, 4);
      if (this.state.skillLoadoutIds.length === 0 && unlockedActive.length > 0) {
        this.state.skillLoadoutIds = unlockedActive.slice(0, 4).map(n => n.id);
      }
    }
    return this.state.skillLoadoutIds;
  }

  public toggleSkillLoadout(nodeId: string): { ok: boolean; equipped?: boolean; reason?: string } {
    const unlocked = this.getSkillWebUnlocked();
    if (!unlocked.includes(nodeId)) return { ok: false, reason: '请先点亮该技能节点' };
    const node = SKILL_WEB_NODES.find(n => n.id === nodeId);
    if (!node?.activeSkill) return { ok: false, reason: '该节点为被动改造节点，无需装配' };
    const ids = this.getSkillLoadoutIds();
    const idx = ids.indexOf(nodeId);
    if (idx >= 0) {
      ids.splice(idx, 1);
      return { ok: true, equipped: false };
    }
    if (ids.length >= 4) return { ok: false, reason: '主动技能槽已满 (4/4)，请先卸下 1 个' };
    ids.push(nodeId);
    return { ok: true, equipped: true };
  }

  public getEquippedActiveSkills(): EquippedActiveSkill[] {
    const ids = this.getSkillLoadoutIds();
    const map = new Map(SKILL_WEB_NODES.map(n => [n.id, n]));
    const res: EquippedActiveSkill[] = [];
    for (const id of ids) {
      const node = map.get(id);
      if (!node) continue;
      const info = this.getSkillProgressInfo(id);
      const eq = toEquippedActiveSkill(node, {
        rank: info.baseRank,
        bonusRank: info.bonusRank,
        mutationChoice: info.mutationChoice,
      });
      if (eq) res.push(eq);
    }
    return res;
  }

  // ==================== V6 锁定式五层八卦星盘总控 API ====================

  public getV6Astrolabe(): V6AstrolabeState {
    const uc = this.getUserClub();
    this.state.v6Astrolabe = ensureV6AstrolabeState(
      this.state.v6Astrolabe,
      uc?.style ?? 'tiki_taka',
      uc?.formation ?? '4-3-3'
    );
    return this.state.v6Astrolabe;
  }

  public rotateV6Astrolabe(ring: 'outer' | 'inner', delta: number): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    if (ast.locked) return { ok: false, reason: '星盘已锁定，洗点重置后方可重新旋转内外双环' };
    if (ring === 'outer') ast.outerRingStep = ((ast.outerRingStep + delta) % 6 + 6) % 6;
    else ast.innerRingStep = ((ast.innerRingStep + delta) % 3 + 3) % 3;
    return { ok: true };
  }

  public lockV6Astrolabe(): { ok: boolean } {
    const ast = this.getV6Astrolabe();
    ast.locked = true;
    return { ok: true };
  }

  public respecV6Astrolabe(): { ok: boolean; refunded: number; costFunds: number; reason?: string } {
    const ast = this.getV6Astrolabe();
    const uc = this.getUserClub();
    const style = uc?.style ?? 'tiki_taka';
    const form = uc?.formation ?? '4-3-3';
    const refunded = calcRefundablePoints(ast, style, form);
    let costFunds = 0;
    if (!ast.freeRespecAvailable) {
      costFunds = 80;
      if (!this.spendClubFunds(costFunds)) {
        return { ok: false, refunded: 0, costFunds, reason: `本赛季免费洗点已用完，再次洗点需俱乐部资金 ¥${costFunds}万` };
      }
    }
    this.state.metaPointsTotal += refunded;
    const fresh = createDefaultAstrolabeState(style, form);
    fresh.fogCleared = ast.fogCleared;
    fresh.freeRespecAvailable = false;
    this.state.v6Astrolabe = fresh;
    return { ok: true, refunded, costFunds };
  }

  public clearV6AstrolabeFog(): void {
    this.getV6Astrolabe().fogCleared = true;
  }

  public unlockV6Passive(passiveId: string): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    const p = V6_PASSIVE_MAP[passiveId];
    if (!p) return { ok: false, reason: '未找到该被动节点' };
    if (ast.unlockedPassives.includes(passiveId)) return { ok: false, reason: '已点亮' };
    const prereq = canUnlockV6Node(ast, 'passive', passiveId);
    if (!prereq.ok) return { ok: false, reason: prereq.reason };
    if (this.state.metaPointsTotal < p.unlockCost) return { ok: false, reason: `Meta 点数不足 (需 ${p.unlockCost} pt)` };
    this.state.metaPointsTotal -= p.unlockCost;
    ast.locked = true;
    ast.unlockedPassives.push(passiveId);
    return { ok: true };
  }

  public unlockV6Directive(directiveId: string): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    const d = V6_DIRECTIVE_MAP[directiveId];
    if (!d) return { ok: false, reason: '未找到该三区手牌' };
    if (ast.unlockedDirectives.includes(directiveId)) return { ok: false, reason: '已解锁' };
    const prereq = canUnlockV6Node(ast, 'directive', directiveId);
    if (!prereq.ok) return { ok: false, reason: prereq.reason };
    if (this.state.metaPointsTotal < d.unlockCost) return { ok: false, reason: `Meta 点数不足 (需 ${d.unlockCost} pt)` };
    this.state.metaPointsTotal -= d.unlockCost;
    ast.locked = true;
    ast.unlockedDirectives.push(directiveId);
    return { ok: true };
  }

  public unlockV6DirectiveSatellite(directiveId: string, sat: V6SatelliteKey): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    const d = V6_DIRECTIVE_MAP[directiveId];
    if (!d) return { ok: false, reason: '未找到该手牌' };
    if (!ast.unlockedDirectives.includes(directiveId)) return { ok: false, reason: '请先解锁该手牌本体' };
    const cur = ast.directiveSatellites[directiveId] ?? [];
    if (cur.includes(sat)) return { ok: false, reason: '该卫星改造已点亮' };
    const cost = d.satellites[sat].cost;
    if (this.state.metaPointsTotal < cost) return { ok: false, reason: `Meta 点数不足 (需 ${cost} pt)` };
    this.state.metaPointsTotal -= cost;
    ast.locked = true;
    ast.directiveSatellites[directiveId] = [...cur, sat];
    return { ok: true };
  }

  public unlockV6Skill(skillId: string): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    const sk = V6_ACTIVE_SKILL_MAP[skillId];
    if (!sk) return { ok: false, reason: '未找到该主动技' };
    if (ast.unlockedSkills.includes(skillId)) return { ok: false, reason: '已解锁' };
    if (sk.source === 'mastery' || sk.source === 'core') {
      return { ok: false, reason: '宗师终极技需通过点亮对应宗师印或圆心解锁' };
    }
    const prereq = canUnlockV6Node(ast, 'skill', skillId);
    if (!prereq.ok) return { ok: false, reason: prereq.reason };
    if (this.state.metaPointsTotal < sk.unlockCost) return { ok: false, reason: `Meta 点数不足 (需 ${sk.unlockCost} pt)` };
    this.state.metaPointsTotal -= sk.unlockCost;
    ast.locked = true;
    ast.unlockedSkills.push(skillId);
    ast.skillBranchChoice[skillId] = 'A';
    if (ast.equippedSkills.length < 4) ast.equippedSkills.push(skillId);
    return { ok: true };
  }

  public setV6SkillBranch(skillId: string, choice: SkillBranchChoice): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    if (!ast.unlockedSkills.includes(skillId)) return { ok: false, reason: '请先解锁该主动技' };
    ast.skillBranchChoice[skillId] = choice;
    return { ok: true };
  }

  public unlockV6Fusion(fusionId: string): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    const f = V6_FUSION_MAP[fusionId];
    if (!f) return { ok: false, reason: '未找到该融合奇点' };
    if (ast.unlockedFusions.includes(fusionId)) return { ok: false, reason: '已点亮' };
    const prereq = canUnlockV6Node(ast, 'fusion', fusionId);
    if (!prereq.ok) return { ok: false, reason: prereq.reason };
    if (this.state.metaPointsTotal < f.unlockCost) return { ok: false, reason: `Meta 点数不足 (需 ${f.unlockCost} pt)` };
    this.state.metaPointsTotal -= f.unlockCost;
    ast.locked = true;
    ast.unlockedFusions.push(fusionId);
    ast.fusionBranchChoice[fusionId] = 'A';
    if (!ast.unlockedDirectives.includes(f.royalDirectiveId)) {
      ast.unlockedDirectives.push(f.royalDirectiveId);
    }
    return { ok: true };
  }

  public setV6FusionBranch(fusionId: string, choice: 'A' | 'B'): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    if (!ast.unlockedFusions.includes(fusionId)) return { ok: false, reason: '请先点亮该融合奇点' };
    ast.fusionBranchChoice[fusionId] = choice;
    return { ok: true };
  }

  public unlockV6MasterySeal(sealId: string): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    const seal = V6_MASTERY_SEAL_MAP[sealId];
    if (!seal) return { ok: false, reason: '未找到该宗师印' };
    if (ast.unlockedMasterySeals.includes(sealId)) return { ok: false, reason: '已点亮' };
    const check = canUnlockMasterySeal(ast, seal.style);
    if (!check.ok) return check;
    if (this.state.metaPointsTotal < seal.unlockCost) return { ok: false, reason: `Meta 点数不足 (需 ${seal.unlockCost} pt)` };
    this.state.metaPointsTotal -= seal.unlockCost;
    ast.locked = true;
    ast.unlockedMasterySeals.push(sealId);
    if (!ast.unlockedSkills.includes(seal.activeSkillId)) {
      ast.unlockedSkills.push(seal.activeSkillId);
      ast.skillBranchChoice[seal.activeSkillId] = 'A';
    }
    return { ok: true };
  }

  public unlockV6Core(): { ok: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    if (ast.coreUnlocked) return { ok: false, reason: '圆心超级宗师已觉醒' };
    const check = canUnlockCore(ast);
    if (!check.ok) return { ok: false, reason: check.reason };
    if (this.state.metaPointsTotal < 5) return { ok: false, reason: 'Meta 点数不足 (需 5 pt)' };
    this.state.metaPointsTotal -= 5;
    ast.locked = true;
    ast.coreUnlocked = true;
    if (!ast.unlockedSkills.includes('sk_ult_core')) {
      ast.unlockedSkills.push('sk_ult_core');
      ast.skillBranchChoice['sk_ult_core'] = 'A';
    }
    return { ok: true };
  }

  public getV6SeasonRogue(): V6SeasonRogueState {
    if (!this.state.v6SeasonRogue) {
      this.state.v6SeasonRogue = createEmptySeasonRogueState();
    }
    const r = this.state.v6SeasonRogue;
    r.directiveEnchants = r.directiveEnchants ?? {};
    r.seasonRelics = Array.isArray(r.seasonRelics) ? r.seasonRelics : [];
    r.overclockedDirectives = Array.isArray(r.overclockedDirectives) ? r.overclockedDirectives : [];
    r.overloadedSkills = Array.isArray(r.overloadedSkills) ? r.overloadedSkills : [];
    return r;
  }

  public toggleV6CheckpointCard(checkpoint: V6CheckpointKey, directiveId: string): { ok: boolean; equipped?: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    if (!ast.unlockedDirectives.includes(directiveId)) return { ok: false, reason: '请先在星盘中解锁该手牌' };
    const targetKey: V6CheckpointKey = ast.useUniversalPool ? 's1' : checkpoint;
    const list = ast.checkpointPools[targetKey];
    const idx = list.indexOf(directiveId);
    if (idx >= 0) {
      list.splice(idx, 1);
      if (ast.useUniversalPool) {
        ast.checkpointPools.s2 = [...list];
        ast.checkpointPools.s3 = [...list];
        ast.checkpointPools.s4 = [...list];
      }
      return { ok: true, equipped: false };
    }
    if (list.length >= 4) return { ok: false, reason: '该赛段临场指令槽已满 (4/4)，请先点击槽位卸下 1 张' };
    list.push(directiveId);
    if (ast.useUniversalPool) {
      ast.checkpointPools.s2 = [...list];
      ast.checkpointPools.s3 = [...list];
      ast.checkpointPools.s4 = [...list];
    }
    return { ok: true, equipped: true };
  }

  public setV6UniversalPool(enabled: boolean): void {
    const ast = this.getV6Astrolabe();
    ast.useUniversalPool = enabled;
    if (enabled) {
      ast.checkpointPools.s2 = [...ast.checkpointPools.s1];
      ast.checkpointPools.s3 = [...ast.checkpointPools.s1];
      ast.checkpointPools.s4 = [...ast.checkpointPools.s1];
    }
  }

  /** 按当前俱乐部阵型与打法一键智能推荐装配四赛段手牌与主动技 */
  public autoFillV6LoadoutForClub(): { filledDirectives: number; filledSkills: number } {
    const ast = this.getV6Astrolabe();
    const club = this.getUserClub();
    const rogue = this.getV6SeasonRogue();

    // 若切换了新打法且尚无该打法基础稳健牌，免费同步赠送该打法原点与 2 张稳健起手牌，避免切流派后无契合牌可用
    const styleSteady = V6_DIRECTIVES.filter(d => d.source === 'style' && d.style === club.style && d.route === 'steady');
    for (const sd of styleSteady.slice(0, 2)) {
      if (!ast.unlockedDirectives.includes(sd.id)) ast.unlockedDirectives.push(sd.id);
    }

    const scoreDir = (id: string, seg: V6CheckpointKey): number => {
      const def = V6_DIRECTIVE_MAP[id];
      if (!def) return -999;
      let sc = 0;
      if (def.formation === club.formation) sc += 50;
      if (def.style === club.style) sc += 40;
      if (def.source === 'fusion') sc += 35;
      sc += (ast.directiveSatellites[id]?.length ?? 0) * 8;
      if (rogue.overclockedDirectives.includes(id)) sc += 20;
      if (rogue.directiveEnchants[id]) sc += 18;
      if (seg === 's1' && def.route === 'steady') sc += 10;
      if (seg === 's4' && (def.tpCost >= 2 || def.tendency === 'ATK')) sc += 12;
      return sc;
    };

    const pickFour = (seg: V6CheckpointKey): string[] => {
      const sorted = [...ast.unlockedDirectives].sort((a, b) => scoreDir(b, seg) - scoreDir(a, seg));
      const chosen: string[] = [];
      // 优先保证攻守兼备 + 包含 1TP 灵活拼图牌
      const steadyOne = sorted.find(id => V6_DIRECTIVE_MAP[id]?.tpCost === 1);
      if (steadyOne) chosen.push(steadyOne);
      const atkOne = sorted.find(id => !chosen.includes(id) && V6_DIRECTIVE_MAP[id]?.tendency === 'ATK');
      if (atkOne) chosen.push(atkOne);
      const defOne = sorted.find(id => !chosen.includes(id) && V6_DIRECTIVE_MAP[id]?.tendency === 'DEF');
      if (defOne) chosen.push(defOne);
      for (const id of sorted) {
        if (chosen.length >= 4) break;
        if (!chosen.includes(id)) chosen.push(id);
      }
      return chosen.slice(0, 4);
    };

    if (ast.useUniversalPool) {
      const uni = pickFour('s1');
      ast.checkpointPools = { s1: [...uni], s2: [...uni], s3: [...uni], s4: [...uni] };
    } else {
      ast.checkpointPools = {
        s1: pickFour('s1'),
        s2: pickFour('s2'),
        s3: pickFour('s3'),
        s4: pickFour('s4'),
      };
    }

    const sortedSkills = [...ast.unlockedSkills].sort((a, b) => {
      const sa = V6_ACTIVE_SKILL_MAP[a];
      const sb = V6_ACTIVE_SKILL_MAP[b];
      const scoreS = (sk?: typeof sa, id?: string) =>
        (sk?.source === 'core' ? 60 : sk?.source === 'mastery' ? 50 : sk?.formation === club.formation ? 45 : sk?.style === club.style ? 35 : 10) +
        (id && rogue.overloadedSkills.includes(id) ? 20 : 0);
      return scoreS(sb, b) - scoreS(sa, a);
    });
    ast.equippedSkills = sortedSkills.slice(0, 4);

    return {
      filledDirectives: ast.checkpointPools.s1.length,
      filledSkills: ast.equippedSkills.length,
    };
  }

  public toggleV6EquippedSkill(skillId: string): { ok: boolean; equipped?: boolean; reason?: string } {
    const ast = this.getV6Astrolabe();
    if (!ast.unlockedSkills.includes(skillId)) return { ok: false, reason: '请先在星盘中解锁该主动技' };
    const idx = ast.equippedSkills.indexOf(skillId);
    if (idx >= 0) {
      ast.equippedSkills.splice(idx, 1);
      return { ok: true, equipped: false };
    }
    if (ast.equippedSkills.length >= 4) return { ok: false, reason: '主动技出战槽已满 (4/4)' };
    ast.equippedSkills.push(skillId);
    return { ok: true, equipped: true };
  }

  public getV6CheckpointDirectives(checkpoint: V6CheckpointKey): V6CompiledDirectiveEntry[] {
    const ast = this.getV6Astrolabe();
    const rogue = this.getV6SeasonRogue();
    const club = this.getUserClub();
    const ids = ast.useUniversalPool ? ast.checkpointPools.s1 : ast.checkpointPools[checkpoint];
    const noCrossPenalty = ast.unlockedFusions.some(fid => {
      const f = V6_FUSION_MAP[fid];
      const br = ast.fusionBranchChoice[fid] === 'B' ? f?.branchB : f?.branchA;
      return !!br?.immunityFlags?.noCrossStylePenalty;
    });
    const out: V6CompiledDirectiveEntry[] = [];
    for (const id of (ids ?? []).slice(0, 4)) {
      const def = V6_DIRECTIVE_MAP[id];
      const effect = compileDirectiveToEffect(id, ast, club.style, club.formation, rogue);
      if (def && effect) {
        const isOverclocked = rogue.overclockedDirectives.includes(id);
        const enchant = rogue.directiveEnchants[id];
        const isGreenSynergy = !!(
          noCrossPenalty ||
          (def.style && def.style === club.style) ||
          (def.formation && def.formation === club.formation)
        );
        let effectiveTpCost: number = def.tpCost;
        if (enchant === 'minus_cost') effectiveTpCost = Math.max(0, effectiveTpCost - 1);
        if (enchant === 'fergie_time' && checkpoint === 's4') effectiveTpCost = Math.max(0, effectiveTpCost - 1);
        out.push({
          def,
          effect,
          satellites: isOverclocked ? ['A', 'B', 'C'] : (ast.directiveSatellites[id] ?? []),
          effectiveTpCost,
          enchant,
          isOverclocked,
          isGreenSynergy,
        });
      }
    }
    return out;
  }

  public getV6MatchRuntimeConfig(): {
    checkpointTpBase: number;
    maxCarryTp: number;
    maxPlaysPerSegment: number;
    hasEmergencyCall: boolean;
    totalFootballMaster: boolean;
    relics: V6RelicId[];
  } {
    const ast = this.getV6Astrolabe();
    const rogue = this.getV6SeasonRogue();
    const club = this.getUserClub();
    const compiled = compileAstrolabeToMatchSetup(ast, club.formation, club.style, rogue);
    return {
      checkpointTpBase: compiled.checkpointTpBase,
      maxCarryTp: compiled.maxCarryTp,
      maxPlaysPerSegment: compiled.maxPlaysPerSegment,
      hasEmergencyCall: compiled.hasEmergencyCall,
      totalFootballMaster: compiled.v6TotalFootballMaster,
      relics: compiled.relics,
    };
  }

  public getChemistryLinks(): Record<string, ChemistryLink> {
    if (!this.state.chemistryLinks) {
      this.state.chemistryLinks = {};
    }
    return this.state.chemistryLinks;
  }

  public getPlayerFamiliarity(player: DraftPlayer, formation?: FormationName): number {
    const club = this.getUserClub();
    return getPlayerFormationFamiliarity(player, formation ?? club.formation, this.getSkillWebUnlocked());
  }

  public getTacticsChemistrySummary() {
    const club = this.getUserClub();
    const links = this.getChemistryLinks();
    const squadMap = new Map(club.squad.map(p => [p.id, p]));
    const specs = getFormationLinks(club, squadMap).map(sp => {
      const link = getOrCreateChemistryLink(links, sp.playerA, sp.playerB);
      return { ...sp, link };
    });
    const spineInfo = computeCentralSpineInfo(club, links);
    return { specs, spineInfo };
  }

  /**
   * 开启新赛季（支持保留常驻班底跳过重抽，或重新选秀开局）
   */
  public startNewSeason(
    clubOrOpts: string | NewSeasonOptions = 'club_star',
    formation: FormationName = '4-3-3',
    style: TacticalStyle = 'tiki_taka',
    carryOverSquad = false
  ): LeagueSaveState {
    if (
      carryOverSquad &&
      this.state?.phase === 'SEASON_END' &&
      this.state.lastSummary?.captainSuccessor?.pending &&
      this.state.lastSummary.captainSuccessor.candidateIds.length > 0
    ) {
      this.selectCaptainSuccessor(this.state.lastSummary.captainSuccessor.candidateIds[0]);
    }
    const baseClub = this.state ? this.getUserClub() : null;
    const opts: NewSeasonOptions = typeof clubOrOpts === 'string'
      ? {
          clubId: clubOrOpts === 'club_star' && carryOverSquad && baseClub ? baseClub.id : clubOrOpts,
          customName: carryOverSquad && baseClub ? baseClub.name : undefined,
          primaryColor: carryOverSquad && baseClub ? baseClub.primaryColor : undefined,
          secondaryColor: carryOverSquad && baseClub ? baseClub.secondaryColor : undefined,
          awayPrimaryColor: carryOverSquad && baseClub ? baseClub.awayPrimaryColor : undefined,
          awaySecondaryColor: carryOverSquad && baseClub ? baseClub.awaySecondaryColor : undefined,
          formation: carryOverSquad && baseClub ? baseClub.formation : formation,
          style: carryOverSquad && baseClub ? baseClub.style : style,
        }
      : clubOrOpts;
    const prevMeta = this.state?.metaPointsTotal ?? 0;
    const prevFunds = this.state?.clubFunds ?? 500;
    const prevBestTier = this.state?.bestTierReached ?? 7;
    const prevLevels = this.state?.metaLevels ? { ...this.state.metaLevels } : createDefaultMetaLevels();
    const prevHof = this.state?.hallOfFame ? JSON.parse(JSON.stringify(this.state.hallOfFame)) : createDefaultHallOfFame();
    const prevTut = this.state?.tutorialDone ? { ...this.state.tutorialDone } : {};
    const prevPrologue = this.state?.prologueCompleted;
    const prevSecretEnded = this.state?.secretRetiredEnding;
    const prevSeason = this.state?.seasonNumber ?? 0;
    const prevPersistent = carryOverSquad ? this.state?.persistentSquad : undefined;
    const prevElements = this.state?.elementInventory ? { ...this.state.elementInventory } : undefined;
    const prevDeck = this.state?.coachDeck ? JSON.parse(JSON.stringify(this.state.coachDeck)) : undefined;
    const prevLoadout = this.state?.coachLoadoutIds ? [...this.state.coachLoadoutIds] : undefined;
    const prevDeckPresets = this.state?.deckPresets ? JSON.parse(JSON.stringify(this.state.deckPresets)) : undefined;
    const prevActivePresetIdx = this.state?.activeDeckPresetIdx;
    const prevRecipes = this.state?.discoveredRecipes ? [...this.state.discoveredRecipes] : undefined;
    const prevRoster = this.state?.clubRoster ? JSON.parse(JSON.stringify(this.state.clubRoster)) : undefined;
    const prevRosterSel = this.state?.rosterSelectedIds ? [...this.state.rosterSelectedIds] : undefined;
    const prevRosterRefreshes = this.state?.rosterRefreshesRemaining;
    const prevSkillWeb = this.state?.skillWebUnlocked ? [...this.state.skillWebUnlocked] : undefined;
    const prevSkillLoadout = this.state?.skillLoadoutIds ? [...this.state.skillLoadoutIds] : undefined;
    const prevSkillRanks = this.state?.skillRanks ? { ...this.state.skillRanks } : undefined;
    const prevSkillMutations = this.state?.skillMutations ? { ...this.state.skillMutations } : undefined;
    const prevV6Astrolabe = this.state?.v6Astrolabe ? JSON.parse(JSON.stringify(this.state.v6Astrolabe)) as V6AstrolabeState : undefined;
    const prevTier = carryOverSquad ? (this.state?.currentTier ?? 7) : 7;
    const prevPyramid = carryOverSquad && this.state?.leaguePyramid ? JSON.parse(JSON.stringify(this.state.leaguePyramid)) : undefined;
    const prevChronicles = carryOverSquad && this.state?.chronicles ? JSON.parse(JSON.stringify(this.state.chronicles)) : undefined;
    const prevIntel = carryOverSquad && this.state?.opponentIntel ? JSON.parse(JSON.stringify(this.state.opponentIntel)) : undefined;
    const prevChemLinks = carryOverSquad && this.state?.chemistryLinks ? JSON.parse(JSON.stringify(this.state.chemistryLinks)) : undefined;
    const prevStayedTier = carryOverSquad ? (this.state?.stayedTierCount ?? 0) : 0;
    const prevExPool = carryOverSquad && this.state?.exUserPlayersPool ? JSON.parse(JSON.stringify(this.state.exUserPlayersPool)) : undefined;
    const prevRivals = carryOverSquad && this.state?.rivalClubIds ? [...this.state.rivalClubIds] : undefined;

    this.state = this.createNewSeasonState(
      opts,
      carryOverSquad ? prevSeason + 1 : 1,
      prevMeta,
      prevLevels,
      prevHof,
      prevTut,
      prevPersistent,
      prevTier,
      prevPyramid,
      carryOverSquad ? prevFunds : 900 + (prevLevels.finance ?? 0) * 150,
      Math.min(prevBestTier, prevTier)
    );
    if (prevElements) this.state.elementInventory = prevElements;
    if (prevDeck) this.state.coachDeck = prevDeck;
    if (prevLoadout) this.state.coachLoadoutIds = prevLoadout;
    if (prevDeckPresets) this.state.deckPresets = prevDeckPresets;
    if (prevActivePresetIdx !== undefined) this.state.activeDeckPresetIdx = prevActivePresetIdx;
    if (prevRecipes) this.state.discoveredRecipes = prevRecipes;
    if (carryOverSquad && prevRoster) this.state.clubRoster = prevRoster;
    if (carryOverSquad && prevRosterSel) this.state.rosterSelectedIds = prevRosterSel;
    if (prevRosterRefreshes !== undefined) this.state.rosterRefreshesRemaining = prevRosterRefreshes;
    if (prevChronicles) this.state.chronicles = prevChronicles;
    if (prevIntel) this.state.opponentIntel = prevIntel;
    if (prevExPool) this.state.exUserPlayersPool = prevExPool;
    if (prevRivals) this.state.rivalClubIds = prevRivals;
    if (prevChemLinks) this.state.chemistryLinks = prevChemLinks;
    if (prevPrologue) this.state.prologueCompleted = true;
    if (prevSecretEnded) this.state.secretRetiredEnding = true;
    this.state.stayedTierCount = prevStayedTier;
    this.state.chronicleSeasonAdvancedIds = [];
    this.state.chronicleExtraUnlockedThisSeason = false;
    ensureChronicles(this.state);
    if ((this.state.currentTier ?? 7) === 1) {
      tryUnlockAchievement(this.state, 'ach_top_tier');
    }
    if (this.state.phase === 'REGULAR_SEASON') {
      const ucNow = this.getUserClub();
      this.markPreSeasonRetiringNotices(ucNow);
      this.state.interMatchPrep = createInterMatchPrep(this.state, ucNow);
      const startChr = triggerSeasonStartChronicle(this.state, ucNow);
      if (startChr) this.state.pendingStoryEvent = startChr;
    } else {
      this.markPreSeasonRetiringNotices(this.getUserClub());
    }
    if (prevSkillWeb && prevSkillWeb.length > 0) {
      const seasonStyleOrigin = getOriginForStyle(opts.style ?? 'tiki_taka');
      const seasonFormOrigin = getOriginForFormation(opts.formation ?? '4-3-3');
      this.state.skillWebUnlocked = Array.from(new Set([...prevSkillWeb, seasonStyleOrigin, seasonFormOrigin]));
      if (prevSkillLoadout) {
        const unlockedSet = new Set(this.state.skillWebUnlocked);
        this.state.skillLoadoutIds = prevSkillLoadout.filter(id => unlockedSet.has(id)).slice(0, 4);
      }
      if (prevSkillRanks) this.state.skillRanks = prevSkillRanks;
      if (prevSkillMutations) this.state.skillMutations = prevSkillMutations;
    }
    if (prevV6Astrolabe && (carryOverSquad || prevMeta > 0 || prevV6Astrolabe.locked)) {
      prevV6Astrolabe.freeRespecAvailable = true;
      this.state.v6Astrolabe = ensureV6AstrolabeState(prevV6Astrolabe, opts.style ?? 'tiki_taka', opts.formation ?? '4-3-3');
    } else {
      this.state.v6Astrolabe = createDefaultAstrolabeState(opts.style ?? 'tiki_taka', opts.formation ?? '4-3-3');
    }
    this.state.v6SeasonRogue = createEmptySeasonRogueState();
    return this.state;
  }

  private createNewSeasonState(
    opts: NewSeasonOptions = {},
    seasonNumber = 1,
    metaPointsTotal = 0,
    metaLevels: MetaLevels = createDefaultMetaLevels(),
    hallOfFame: HallOfFameData = createDefaultHallOfFame(),
    tutorialDone: TutorialProgress = {},
    carryOverPersistent?: DraftPlayer[],
    currentTier = 7,
    existingPyramid?: Record<number, ClubDirectoryEntry[]>,
    clubFunds = 900 + (metaLevels.finance ?? 0) * 150,
    bestTierReached = currentTier
  ): LeagueSaveState {
    const userClubTemplateId = opts.clubId ?? 'club_star';
    const formation = opts.formation ?? '4-3-3';
    const style = opts.style ?? 'tiki_taka';
    const hasCarryOver = !!(carryOverPersistent && carryOverPersistent.length >= 16);
    const carriedSquad: DraftPlayer[] = hasCarryOver
      ? carryOverPersistent!.map(p => ({
          ...JSON.parse(JSON.stringify(p)),
          fitness: 100,
          suspendedRounds: 0,
          seasonYellowsSinceBan: 0,
          seasonGrowthXp: 0,
          seasonAttrGained: 0,
          seasonStats: {
            appearances: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0,
            tackles: 0, interceptions: 0, passes: 0, passesSuccess: 0, distanceM: 0, saves: 0,
          },
        }))
      : generateInitialSkeleton8(currentTier);

    const baseTpl = FICTIONAL_CLUBS.find(c => c.id === userClubTemplateId) ?? FICTIONAL_CLUBS[0];
    const userTpl = {
      ...baseTpl,
      name: opts.customName || baseTpl.name,
      shortName: opts.customName ? opts.customName.slice(0, 2) : baseTpl.shortName,
      primaryColor: opts.primaryColor || baseTpl.primaryColor,
      secondaryColor: opts.secondaryColor || baseTpl.secondaryColor,
      awayPrimaryColor: opts.awayPrimaryColor || baseTpl.awayPrimaryColor || '#F8FAFC',
      awaySecondaryColor: opts.awaySecondaryColor || baseTpl.awaySecondaryColor || (opts.primaryColor || baseTpl.primaryColor),
    };
    const pyramid = existingPyramid ?? generateTierPyramid(userClubTemplateId, userTpl);
    const tierEntries = pyramid[currentTier] ?? pyramid[7];
    const curTierBaseCA = getLeagueTierInfo(currentTier).baseCA;
    const totalEntries = Math.max(1, tierEntries.length - 1);

    const clubs: LeagueClub[] = tierEntries.map((entry, idx) => {
      const isUser = entry.id === userClubTemplateId;
      const aiForm = AI_FORMATIONS[(idx + seasonNumber) % AI_FORMATIONS.length];
      const aiStyle = AI_STYLES[(idx + seasonNumber) % AI_STYLES.length];
      // 全级别四层集团分层：争冠集团 / 中游集团 / 下游集团 / 保级集团
      const ratio = idx / totalEntries;
      const [minCA, maxCA] =
        ratio <= 0.22
          ? [curTierBaseCA + (currentTier === 1 ? 3 : 2), curTierBaseCA + (currentTier === 1 ? 6 : currentTier === 2 ? 5 : 4)]
          : ratio <= 0.67
          ? [curTierBaseCA - 1, curTierBaseCA + 2]
          : ratio <= 0.85
          ? [curTierBaseCA - 3, curTierBaseCA - 1]
          : [curTierBaseCA - 5, curTierBaseCA - 3];
      const clampedAiBase = Math.max(minCA, Math.min(maxCA, entry.baseStrength));
      if (!isUser) entry.baseStrength = clampedAiBase;
      const aiSquad = isUser ? carriedSquad : generateAIDraftSquad(Math.max(32, Math.min(93, clampedAiBase)));
      const avgAge = aiSquad.length > 0 ? aiSquad.reduce((s, p) => s + p.age, 0) / aiSquad.length : 25;
      const ecoTag = isUser ? undefined :
        avgAge <= 23.2 ? '青春风暴' :
        avgAge >= 27.0 ? '铁血老兵' :
        aiStyle === 'gegenpress' ? '高位绞肉机' :
        aiStyle === 'tiki_taka' ? '传控大师' :
        aiStyle === 'counter' || aiStyle === 'park_bus' ? '防反黑马' : '均衡劲旅';
      const name = isUser && opts.customName ? opts.customName : entry.name;
      return {
        id: entry.id,
        name,
        shortName: isUser && opts.customName ? opts.customName.slice(0, 2) : entry.shortName,
        primaryColor: isUser && opts.primaryColor ? opts.primaryColor : entry.primaryColor,
        secondaryColor: isUser && opts.secondaryColor ? opts.secondaryColor : entry.secondaryColor,
        awayPrimaryColor: isUser && opts.awayPrimaryColor ? opts.awayPrimaryColor : (entry.awayPrimaryColor ?? '#F8FAFC'),
        awaySecondaryColor: isUser && opts.awaySecondaryColor ? opts.awaySecondaryColor : (entry.awaySecondaryColor ?? entry.primaryColor),
        isUser,
        formation: isUser ? formation : aiForm,
        style: isUser ? style : aiStyle,
        ecoTag,
        squad: aiSquad,
        starterIds: isUser ? (hasCarryOver ? autoSelectStarters(carriedSquad, formation) : []) : autoSelectStarters(aiSquad, aiForm),
        perks: [],
      };
    });

    const fixtures = generateRoundRobinFixtures(clubs.map(c => c.id), true);
    const storyline = rollSeasonStoryline(userClubTemplateId);
    const userClubName = clubs.find(c => c.isUser)?.name ?? '星辰联';
    const corePackDraft: CorePackDraftState | null = hasCarryOver
      ? null
      : {
          step: 0,
          lines: ['DEF', 'MID', 'ATT'],
          currentChoices: generateCorePackChoices('DEF', currentTier),
          pickedCores: [],
        };
    return {
      seasonNumber,
      phase: hasCarryOver ? 'SUMMER_WINDOW' : 'INIT_DRAFT',
      currentRound: 1,
      userClubId: userClubTemplateId,
      clubs,
      fixtures,
      draft: createInitialDraftState(metaLevels, currentTier),
      corePackDraft,
      reDraft: null,
      metaPointsTotal,
      clubFunds,
      bestTierReached,
      metaLevels,
      seasonPrivateTrainedIds: [],
      storyline,
      pendingStoryEvent: null,
      storyLog: [],
      elementInventory: createInitialElements(),
      coachDeck: createStarterCoachDeck(style),
      persistentSquad: hasCarryOver ? carriedSquad : undefined,
      clubRoster: JSON.parse(JSON.stringify(carriedSquad)),
      skillWebUnlocked: [getOriginForStyle(style), getOriginForFormation(formation)],
      v6Astrolabe: createDefaultAstrolabeState(style, formation),
      seasonRewardDrafts: undefined,
      seasonTrainedIds: [],
      discoveredRecipes: [],
      hallOfFame,
      tutorialDone,
      seasonMemories: [],
      lastSummary: null,
      currentTier,
      leaguePyramid: pyramid,
    };
  }

  // ==================== 教练场外指挥卡牌与元素合成 ====================

  public getElementInventory(): Record<ElementId, number> {
    if (!this.state.elementInventory) {
      this.state.elementInventory = createInitialElements();
    }
    return this.state.elementInventory;
  }

  public getCoachDeck(): CommandCard[] {
    if (!this.state.coachDeck || this.state.coachDeck.length === 0) {
      const style = this.state.clubs?.find(c => c.id === this.state.userClubId)?.style ?? 'tiki_taka';
      this.state.coachDeck = createStarterCoachDeck(style);
    }
    return this.state.coachDeck;
  }

  // ==================== V5 卡组预设（3~4套 × 8~12张）、耐久损耗、残血回收与商店 ====================

  public getDeckPresets(): DeckPreset[] {
    const deck = this.getCoachDeck();
    const validIds = new Set(deck.filter(c => !c.isBase && c.id !== 'card_captain_roar').map(c => c.id));
    if (!this.state.deckPresets || this.state.deckPresets.length === 0) {
      const initIds = Array.from(validIds).slice(0, 6);
      this.state.deckPresets = [
        { id: 'preset_1', name: '主力方案', cardIds: [...initIds] },
        { id: 'preset_2', name: '备选方案 B', cardIds: [...initIds] },
        { id: 'preset_3', name: '备选方案 C', cardIds: [...initIds] },
      ];
      this.state.activeDeckPresetIdx = 0;
    }
    for (const pr of this.state.deckPresets) {
      pr.cardIds = pr.cardIds.filter(id => validIds.has(id)).slice(0, 8);
    }
    const mainPreset = this.state.deckPresets[0];
    if (mainPreset && mainPreset.cardIds.length < 6) {
      const userStyle = this.getUserClub().style;
      const sortedIds = [...deck]
        .filter(c => validIds.has(c.id))
        .sort((a, b) => ((b.styleTag === userStyle ? 1 : 0) - (a.styleTag === userStyle ? 1 : 0)) || ((b.tier ?? 1) - (a.tier ?? 1)))
        .map(c => c.id);
      for (const id of sortedIds) {
        if (mainPreset.cardIds.length >= 6) break;
        if (!mainPreset.cardIds.includes(id)) mainPreset.cardIds.push(id);
      }
    }
    return this.state.deckPresets;
  }

  public getActiveDeckPresetIdx(): number {
    const presets = this.getDeckPresets();
    const idx = this.state.activeDeckPresetIdx ?? 0;
    if (idx < 0 || idx >= presets.length) {
      this.state.activeDeckPresetIdx = 0;
      return 0;
    }
    return idx;
  }

  public setActiveDeckPreset(idx: number): { ok: boolean; reason?: string } {
    const presets = this.getDeckPresets();
    if (idx < 0 || idx >= presets.length) return { ok: false, reason: '无效的卡组方案索引' };
    this.state.activeDeckPresetIdx = idx;
    return { ok: true };
  }

  public renameDeckPreset(idx: number, name: string): { ok: boolean } {
    const presets = this.getDeckPresets();
    if (idx < 0 || idx >= presets.length || !name.trim()) return { ok: false };
    presets[idx].name = name.trim().slice(0, 12);
    return { ok: true };
  }

  public addDeckPreset(name?: string): { ok: boolean; preset?: DeckPreset; reason?: string } {
    const presets = this.getDeckPresets();
    if (presets.length >= 4) return { ok: false, reason: '最多支持 4 套卡组方案' };
    const next: DeckPreset = {
      id: `preset_${presets.length + 1}`,
      name: name?.trim().slice(0, 12) || `方案 ${presets.length + 1}`,
      cardIds: [...(presets[0]?.cardIds ?? [])],
    };
    presets.push(next);
    return { ok: true, preset: next };
  }

  public toggleCardInPreset(presetIdx: number, cardId: string): { ok: boolean; equipped?: boolean; reason?: string } {
    const presets = this.getDeckPresets();
    const pr = presets[presetIdx];
    if (!pr) return { ok: false, reason: '未找到该卡组方案' };
    const card = this.getCoachDeck().find(c => c.id === cardId);
    if (!card) return { ok: false, reason: '背包中未找到该卡牌' };
    if (card.isBase || card.id === 'card_captain_roar') {
      return { ok: false, reason: '0 阶基础卡随风格自动编入，无需手动装配' };
    }
    const idx = pr.cardIds.indexOf(cardId);
    if (idx >= 0) {
      pr.cardIds.splice(idx, 1);
      return { ok: true, equipped: false };
    }
    if (pr.cardIds.length >= 8) return { ok: false, reason: '自由槽已满 (8/8)，请先移出 1 张消耗卡' };
    pr.cardIds.push(cardId);
    return { ok: true, equipped: true };
  }

  public isOnboardingDeckFull(): boolean {
    return (
      !!this.state.onboardingDeckFull ||
      (this.state.currentTier ?? 7) < 7 ||
      this.state.seasonNumber > 1 ||
      this.state.currentRound >= 4
    );
  }

  public skipOnboardingDeck(): void {
    this.state.onboardingDeckFull = true;
    this.autoFillDeckPreset();
  }

  public getActiveMatchDeck(): CommandCard[] {
    const club = this.getUserClub();
    const baseCards = getStyleBaseCards(club?.style ?? 'tiki_taka');
    const deck = this.getCoachDeck();
    const presets = this.getDeckPresets();
    const activePreset = presets[this.getActiveDeckPresetIdx()] ?? presets[0];

    if (!this.isOnboardingDeckFull()) {
      const r = Math.max(1, this.state.currentRound);
      const opener = baseCards[0];
      const support = baseCards[2] ?? baseCards[1];
      const unlockedCons = (activePreset?.cardIds ?? [])
        .map(id => deck.find(c => c.id === id))
        .filter((c): c is CommandCard => !!c)
        .slice(0, Math.max(0, r - 1));
      const baseSubset = [opener, support].filter((c): c is CommandCard => !!c);
      const combined = [...baseSubset, ...unlockedCons];
      const order = activePreset?.orderedKeys;
      if (order && order.length > 0) {
        const rankMap = new Map<string, number>();
        order.forEach((k, idx) => rankMap.set(k, idx));
        combined.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
      }
      return combined;
    }

    const freeIds = [...(activePreset?.cardIds ?? [])];
    if (freeIds.length < 4) {
      for (const c of deck) {
        if (freeIds.length >= 4) break;
        if (!c.isBase && c.id !== 'card_captain_roar' && !freeIds.includes(c.id)) {
          freeIds.push(c.id);
        }
      }
    }
    const freeCards = freeIds
      .map(id => deck.find(c => c.id === id))
      .filter((c): c is CommandCard => !!c)
      .slice(0, 8);
    const captainRoar = deck.find(c => c.id === 'card_captain_roar');
    const combined = captainRoar ? [...baseCards, captainRoar, ...freeCards] : [...baseCards, ...freeCards];
    const order = activePreset?.orderedKeys;
    if (order && order.length > 0) {
      const rankMap = new Map<string, number>();
      order.forEach((k, idx) => rankMap.set(k, idx));
      combined.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
    }
    return combined;
  }

  public moveDeckCard(presetIdx: number, fromIdx: number, toIdx: number): boolean {
    const presets = this.getDeckPresets();
    const pr = presets[presetIdx];
    if (!pr) return false;
    const prevIdx = this.getActiveDeckPresetIdx();
    this.state.activeDeckPresetIdx = presetIdx;
    const ordered = this.getActiveMatchDeck().map(c => c.id);
    this.state.activeDeckPresetIdx = prevIdx;
    if (fromIdx < 0 || fromIdx >= ordered.length || toIdx < 0 || toIdx >= ordered.length || fromIdx === toIdx) {
      return false;
    }
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    pr.orderedKeys = ordered;
    return true;
  }

  public consumePlayedCardUses(playedCardIds: string[]): { depletedNames: string[]; remainingCount: number } {
    const deck = this.getCoachDeck();
    const depletedNames: string[] = [];
    const removedIds = new Set<string>();
    const counts = new Map<string, number>();
    for (const id of playedCardIds) counts.set(id, (counts.get(id) ?? 0) + 1);

    for (const c of deck) {
      const usedTimes = counts.get(c.id) ?? 0;
      if (usedTimes <= 0) continue;
      if (c.isBase || c.id === 'card_captain_roar' || (c.tier ?? 1) === 0) continue;
      const cur = c.remainingUses ?? c.maxUses ?? 1;
      const next = Math.max(0, cur - usedTimes);
      c.remainingUses = next;
      if (next <= 0) {
        removedIds.add(c.id);
        depletedNames.push(c.name);
      }
    }

    if (removedIds.size > 0) {
      this.state.coachDeck = deck.filter(c => !removedIds.has(c.id));
      for (const pr of this.getDeckPresets()) {
        pr.cardIds = pr.cardIds.filter(id => !removedIds.has(id));
      }
      if (this.state.coachLoadoutIds) {
        this.state.coachLoadoutIds = this.state.coachLoadoutIds.filter(id => !removedIds.has(id));
      }
    }
    return { depletedNames, remainingCount: this.state.coachDeck?.length ?? 0 };
  }

  public recycleDamagedCard(cardId: string): { ok: boolean; fundsGained?: number; cardName?: string; reason?: string } {
    const deck = this.getCoachDeck();
    const idx = deck.findIndex(c => c.id === cardId);
    if (idx < 0) return { ok: false, reason: '未找到该卡牌' };
    const card = deck[idx];
    if (card.isBase || card.id === 'card_captain_roar') {
      return { ok: false, reason: '0 阶基础常备卡不可回收' };
    }
    const rem = card.remainingUses ?? card.maxUses ?? 1;
    if (rem > 1) {
      return { ok: false, reason: '仅剩余 1 次耐久的残血卡可直接回收折现（耐久 ≥2 请优先投入化学反应釜）' };
    }
    deck.splice(idx, 1);
    for (const pr of this.getDeckPresets()) {
      pr.cardIds = pr.cardIds.filter(id => id !== cardId);
    }
    if (this.state.coachLoadoutIds) {
      this.state.coachLoadoutIds = this.state.coachLoadoutIds.filter(id => id !== cardId);
    }
    const fundsGained = 20;
    this.addClubFunds(fundsGained);
    return { ok: true, fundsGained, cardName: card.name };
  }

  public autoFillDeckPreset(presetIdx?: number): { ok: boolean; added: number; total: number } {
    const presets = this.getDeckPresets();
    const idx = presetIdx ?? this.getActiveDeckPresetIdx();
    const pr = presets[idx];
    if (!pr) return { ok: false, added: 0, total: 0 };
    const deck = this.getCoachDeck();
    const userStyle = this.getUserClub().style;
    const candidates = deck
      .filter(c => !c.isBase && c.id !== 'card_captain_roar' && !pr.cardIds.includes(c.id))
      .sort((a, b) => {
        const aScore = (a.tier ?? 1) * 10 + (a.styleTag === userStyle ? 8 : 0) + (a.isChemical ? 12 : 0) + (a.affix?.kind === 'positive' || a.affix?.kind === 'easter_egg' ? 5 : 0) + (a.remainingUses ?? 1);
        const bScore = (b.tier ?? 1) * 10 + (b.styleTag === userStyle ? 8 : 0) + (b.isChemical ? 12 : 0) + (b.affix?.kind === 'positive' || b.affix?.kind === 'easter_egg' ? 5 : 0) + (b.remainingUses ?? 1);
        return bScore - aScore;
      });
    let added = 0;
    for (const c of candidates) {
      if (pr.cardIds.length >= 8) break;
      pr.cardIds.push(c.id);
      added++;
    }
    return { ok: true, added, total: pr.cardIds.length };
  }

  public tidyAndAutoFillDeck(presetIdx?: number): { recycledCount: number; fundsGained: number; addedCount: number; totalDeckSize: number } {
    const deck = this.getCoachDeck();
    const toRecycle = deck.filter(c => !c.isBase && c.id !== 'card_captain_roar' && (c.tier ?? 1) <= 2 && (c.remainingUses ?? c.maxUses ?? 1) === 1);
    let recycledCount = 0;
    let fundsGained = 0;
    for (const c of toRecycle) {
      const res = this.recycleDamagedCard(c.id);
      if (res.ok) {
        recycledCount++;
        fundsGained += res.fundsGained ?? 20;
      }
    }
    const fill = this.autoFillDeckPreset(presetIdx);
    return {
      recycledCount,
      fundsGained,
      addedCount: fill.added,
      totalDeckSize: fill.total,
    };
  }

  public previewV5Reactor(cardIds: string[]): ReactorPreview {
    const deck = this.getCoachDeck();
    const cards = cardIds.map(id => deck.find(c => c.id === id)).filter((c): c is CommandCard => !!c);
    if (cards.length !== cardIds.length) {
      return { valid: false, reason: '部分选中的卡牌已不在背包中', odds: { purePct: 100, positivePct: 0, negativePct: 0, easterEggPct: 0 }, genes: [] };
    }
    return previewReactor(cards);
  }

  public isReactorUnlocked(): boolean {
    return (this.state.currentTier ?? 7) <= 6;
  }

  public craftV5ReactorCards(
    cardIds: string[],
    preferredSameGeneCatalogId?: string
  ): { ok: boolean; card?: CommandCard; affix?: CommandCard['affix']; reason?: string } {
    if (!this.isReactorUnlocked()) {
      return { ok: false, reason: '化学反应釜将于升入【第 6 级 · 地区联赛】后解锁' };
    }
    const deck = this.getCoachDeck();
    const cards = cardIds.map(id => deck.find(c => c.id === id)).filter((c): c is CommandCard => !!c);
    if (cards.length !== cardIds.length) return { ok: false, reason: '部分材料卡不存在' };
    const res = craftFromReactor(cards, preferredSameGeneCatalogId);
    if (!res.ok || !res.card) return { ok: false, reason: res.reason };

    const removeSet = new Set(cardIds);
    this.state.coachDeck = deck.filter(c => !removeSet.has(c.id));
    this.state.coachDeck.push(res.card);
    for (const pr of this.getDeckPresets()) {
      pr.cardIds = pr.cardIds.filter(id => !removeSet.has(id));
    }
    const activePr = this.getDeckPresets()[this.getActiveDeckPresetIdx()];
    if (activePr && activePr.cardIds.length < 8) {
      activePr.cardIds.push(res.card.id);
    }
    this.state.discoveredRecipes = this.state.discoveredRecipes ?? [];
    const key = res.card.recipeKey ?? inferCardElement(res.card);
    if (!this.state.discoveredRecipes.includes(key)) {
      this.state.discoveredRecipes.push(key);
    }
    tryUnlockAchievement(this.state, 'ach_craft_card');
    if (this.state.discoveredRecipes.length >= 5) tryUnlockAchievement(this.state, 'ach_recipe_5');
    if ((res.card.tier ?? 1) >= 3 || (res.card.level ?? 1) >= 4) tryUnlockAchievement(this.state, 'ach_lv4_card');
    return { ok: true, card: res.card, affix: res.affix };
  }

  public getCardShopOffers(): CardShopOffer[] {
    const curRound = this.state.currentRound ?? 1;
    if (!this.state.cardShopOffers || this.state.cardShopRound !== curRound) {
      const style = this.getUserClub()?.style ?? 'tiki_taka';
      const c1 = rollStyleConsumableCard(style, 1);
      const c2 = rollStyleConsumableCard(style, 1);
      const c3 = rollStyleConsumableCard(style, 2);
      this.state.cardShopOffers = [
        { id: `shop_r${curRound}_1`, card: c1, price: 70, sold: false },
        { id: `shop_r${curRound}_2`, card: c2, price: 70, sold: false },
        { id: `shop_r${curRound}_3`, card: c3, price: 140, sold: false },
      ];
      this.state.cardShopRound = curRound;
      this.state.cardShopBuysThisRound = 0;
    }
    return this.state.cardShopOffers;
  }

  public buyCardFromShop(offerId: string): { ok: boolean; card?: CommandCard; price?: number; reason?: string } {
    const offers = this.getCardShopOffers();
    if ((this.state.cardShopBuysThisRound ?? 0) >= 2) {
      return { ok: false, reason: '本轮卡牌商店限购 2 张已用完' };
    }
    const offer = offers.find(o => o.id === offerId);
    if (!offer || offer.sold) return { ok: false, reason: '该商品已售罄或不存在' };
    const deck = this.getCoachDeck();
    if (deck.length >= 60) return { ok: false, reason: '卡牌背包已满 (60/60)' };
    if (!this.spendClubFunds(offer.price)) {
      return { ok: false, reason: `俱乐部资金不足（需要 ¥${offer.price}万）` };
    }
    offer.sold = true;
    this.state.cardShopBuysThisRound = (this.state.cardShopBuysThisRound ?? 0) + 1;
    const bought = JSON.parse(JSON.stringify(offer.card)) as CommandCard;
    deck.push(bought);
    const activePr = this.getDeckPresets()[this.getActiveDeckPresetIdx()];
    if (activePr && activePr.cardIds.length < 8) activePr.cardIds.push(bought.id);
    return { ok: true, card: bought, price: offer.price };
  }

  public getLoadoutIds(): string[] {
    const activePr = this.getDeckPresets()[this.getActiveDeckPresetIdx()];
    if (activePr) {
      this.state.coachLoadoutIds = [...activePr.cardIds];
      return this.state.coachLoadoutIds;
    }
    const deck = this.getCoachDeck();
    this.state.coachLoadoutIds = deck.slice(0, 4).map(c => c.id);
    return this.state.coachLoadoutIds;
  }

  public getMatchLoadout(): CommandCard[] {
    return this.getActiveMatchDeck();
  }

  public toggleLoadoutCard(cardId: string): { ok: boolean; equipped?: boolean; reason?: string } {
    return this.toggleCardInPreset(this.getActiveDeckPresetIdx(), cardId);
  }

  public craftChemistryCard(
    elements: ElementId[],
    focus: CraftFocus = 'balanced',
    autoEquip = false
  ): { ok: boolean; card?: CommandCard; reason?: string } {
    if (elements.length < 1 || elements.length > 4) {
      return { ok: false, reason: '请投入 1 ~ 4 个战术元素' };
    }
    const deck = this.getCoachDeck();
    if (deck.length >= 12) return { ok: false, reason: '战术卡库已满 (12/12)，请先拆解或融合旧卡' };

    const inv = this.getElementInventory();
    const need: Record<ElementId, number> = { press: 0, pass: 0, wing: 0, iron: 0, blitz: 0 };
    for (const e of elements) need[e]++;
    for (const e of Object.keys(need) as ElementId[]) {
      if ((inv[e] ?? 0) < need[e]) {
        const name = TACTICAL_ELEMENTS.find(t => t.id === e)?.name ?? e;
        return { ok: false, reason: `【${name}】元素数量不足 (需要 ${need[e]})` };
      }
    }
    for (const e of Object.keys(need) as ElementId[]) {
      inv[e] -= need[e];
    }

    const res = synthesizeChemistry(elements, focus, true);
    deck.push(res.card);
    if (autoEquip) {
      const loadout = this.getLoadoutIds();
      if (loadout.length < 4) loadout.push(res.card.id);
    }

    this.state.discoveredRecipes = this.state.discoveredRecipes ?? [];
    const key = [...elements].sort().join('+');
    if (!this.state.discoveredRecipes.includes(key)) {
      this.state.discoveredRecipes.push(key);
    }
    tryUnlockAchievement(this.state, 'ach_craft_card');
    if (this.state.discoveredRecipes.length >= 5) {
      tryUnlockAchievement(this.state, 'ach_recipe_5');
    }
    if ((res.card.level ?? 1) >= 4) {
      tryUnlockAchievement(this.state, 'ach_lv4_card');
    }
    return { ok: true, card: res.card };
  }

  public craftCoachCard(
    a: ElementId,
    b: ElementId,
    focus: CraftFocus = 'balanced'
  ): { ok: boolean; card?: CommandCard; reason?: string } {
    return this.craftChemistryCard([a, b], focus);
  }

  public fuseCoachCards(cardIdA: string, cardIdB: string): { ok: boolean; card?: CommandCard; reason?: string } {
    if (cardIdA === cardIdB) return { ok: false, reason: '请选择两张不同的卡牌进行融合' };
    const deck = this.getCoachDeck();
    const cardA = deck.find(c => c.id === cardIdA);
    const cardB = deck.find(c => c.id === cardIdB);
    if (!cardA || !cardB) return { ok: false, reason: '未找到指定融合卡牌' };

    const fused = fuseTwoCards(cardA, cardB);
    const loadout = this.getLoadoutIds();
    const wasEquipped = loadout.includes(cardIdA) || loadout.includes(cardIdB);
    this.state.coachDeck = deck.filter(c => c.id !== cardIdA && c.id !== cardIdB);
    this.state.coachDeck.push(fused);
    this.state.coachLoadoutIds = loadout.filter(id => id !== cardIdA && id !== cardIdB);
    if (wasEquipped && this.state.coachLoadoutIds.length < 4) {
      this.state.coachLoadoutIds.push(fused.id);
    }
    tryUnlockAchievement(this.state, 'ach_craft_card');
    tryUnlockAchievement(this.state, 'ach_fusion_power');
    if ((fused.level ?? 1) >= 4) {
      tryUnlockAchievement(this.state, 'ach_lv4_card');
    }
    return { ok: true, card: fused };
  }

  public upgradeCoachCard(cardId: string): { ok: boolean; card?: CommandCard; costElem?: ElementId; reason?: string } {
    const deck = this.getCoachDeck();
    const card = deck.find(c => c.id === cardId);
    if (!card) return { ok: false, reason: '未找到该指挥卡' };
    if ((card.level ?? 1) >= 4) return { ok: false, reason: '该指挥卡已强化至最高 Lv.4' };

    const inv = this.getElementInventory();
    const preferred = (card.recipeKey?.split('+')[0] as ElementId | undefined)
      ?? (card.id.includes('press') ? 'press' : 'pass');
    const costElem: ElementId | undefined = (inv[preferred] ?? 0) > 0
      ? preferred
      : (TACTICAL_ELEMENTS.find(e => (inv[e.id] ?? 0) > 0)?.id);

    if (!costElem) return { ok: false, reason: '库存元素不足（升阶需要消耗 1 个战术元素）' };
    inv[costElem] -= 1;
    upgradeCommandCard(card);
    if ((card.level ?? 1) >= 4) {
      tryUnlockAchievement(this.state, 'ach_lv4_card');
    }
    return { ok: true, card, costElem };
  }

  public dismantleCoachCard(cardId: string): { ok: boolean; refunded?: ElementId; count?: number; reason?: string } {
    const deck = this.getCoachDeck();
    if (deck.length <= 2) return { ok: false, reason: '至少需保留 2 张指挥卡' };
    const idx = deck.findIndex(c => c.id === cardId);
    if (idx < 0) return { ok: false, reason: '未找到该指挥卡' };
    const [removed] = deck.splice(idx, 1);
    if (this.state.coachLoadoutIds) {
      this.state.coachLoadoutIds = this.state.coachLoadoutIds.filter(id => id !== cardId);
    }
    const refundId = (removed.recipeKey?.split('+')[0] as ElementId | undefined)
      ?? (removed.id.includes('press') ? 'press' : 'pass');
    const count = removed.isCorrupted ? 2 : 1;
    const inv = this.getElementInventory();
    inv[refundId] = (inv[refundId] ?? 0) + count;
    return { ok: true, refunded: refundId, count };
  }

  public removeCoachCard(cardId: string): void {
    this.dismantleCoachCard(cardId);
  }

  // ==================== 1. 开局 Shuffle Draft 选秀 ====================

  /**
   * 消耗球探天赋提供的刷新次数，重新生成当前 Shuffle 候选池
   */
  public refreshDraftPool(): { ok: boolean; reason?: string } {
    if (this.state.phase !== 'INIT_DRAFT') return { ok: false, reason: '当前不在选秀阶段' };
    const d = this.state.draft;
    const rem = d.refreshesRemaining ?? 0;
    if (rem <= 0) return { ok: false, reason: '刷新次数已用完（可在教练天赋树升级球探网络）' };
    const meta = this.getMetaLevels();
    const tier = this.state.currentTier ?? 7;
    const tierBase = 38 + (7 - Math.max(1, Math.min(7, tier))) * 6;
    const minBand = tierBase + meta.scout + (meta.medical >= 3 ? 2 : 0);
    const maxBand = tierBase + 14 + (meta.scout >= 3 ? 2 : 0);
    d.refreshesRemaining = rem - 1;
    d.currentPool = generateShuffleSet(20, minBand, maxBand);
    return { ok: true };
  }

  /**
   * 从当前候选池选中一名球员加入球队
   */
  public pickDraftPlayer(playerId: string): { ok: boolean; reason?: string } {
    if (this.state.phase !== 'INIT_DRAFT') {
      return { ok: false, reason: '当前不在选秀阶段' };
    }
    const d = this.state.draft;
    const club = this.getUserClub();
    if (club.squad.length >= d.targetSquadSize) {
      return { ok: false, reason: '阵容已满' };
    }

    const idx = d.currentPool.findIndex(p => p.id === playerId);
    if (idx < 0) {
      return { ok: false, reason: '候选池中未找到该球员' };
    }

    const player = d.currentPool[idx];
    const remainingSlotsAfterPick = d.targetSquadSize - club.squad.length - 1;
    // 确保选完这名球员后，剩余预算至少够买最低档(30/人)凑满 16 人
    if (d.budgetRemaining - player.cost < remainingSlotsAfterPick * 30) {
      return { ok: false, reason: '剩余预算不足，无法留足后续名额' };
    }

    d.currentPool.splice(idx, 1);
    d.budgetRemaining -= player.cost;
    club.squad.push(player);
    d.picksInCurrentSet++;

    if (club.squad.length >= d.targetSquadSize) {
      return { ok: true };
    }

    // 选满当前 Shuffle Set 的 4 人，自动刷新下一组 20 人候选池
    if (d.picksInCurrentSet >= DRAFT_PICKS_PER_SET && d.currentSetIndex < DRAFT_SETS_TOTAL - 1) {
      const meta = this.getMetaLevels();
      const tier = this.state.currentTier ?? 7;
      const tierBase = 38 + (7 - Math.max(1, Math.min(7, tier))) * 6;
      const minBand = tierBase + meta.scout + (meta.medical >= 3 ? 2 : 0);
      const maxBand = tierBase + 14 + (meta.scout >= 3 ? 2 : 0);
      d.currentSetIndex++;
      d.picksInCurrentSet = 0;
      d.currentPool = generateShuffleSet(20, minBand, maxBand);
    }

    return { ok: true };
  }

  /**
   * 选秀阶段退选一名已选球员并返还预算，方便补齐后微调阵容
   */
  public releaseDraftPlayer(playerId: string): { ok: boolean; reason?: string; refunded?: number } {
    if (this.state.phase !== 'INIT_DRAFT') {
      return { ok: false, reason: '当前不在选秀阶段' };
    }
    const club = this.getUserClub();
    const d = this.state.draft;
    const idx = club.squad.findIndex(p => p.id === playerId);
    if (idx < 0) return { ok: false, reason: '名单中未找到该球员' };
    const [removed] = club.squad.splice(idx, 1);
    d.budgetRemaining = Math.min(d.budgetTotal, d.budgetRemaining + removed.cost);
    if (!d.currentPool.some(p => p.id === removed.id)) {
      d.currentPool.unshift(removed);
    }
    return { ok: true, refunded: removed.cost };
  }

  /**
   * 一键智能补齐剩余选秀名额（仅补齐至 26 人，保留给玩家自行调整后再确认开赛）
   */
  public autoCompleteDraft(): void {
    if (this.state.phase !== 'INIT_DRAFT') return;
    const club = this.getUserClub();
    const d = this.state.draft;
    const tier = this.state.currentTier ?? 7;
    const tierBase = 38 + (7 - Math.max(1, Math.min(7, tier))) * 6;

    while (club.squad.length < d.targetSquadSize) {
      if (d.currentPool.length === 0) {
        d.currentPool = generateShuffleSet(20, tierBase, tierBase + 12);
      }
      const needGK = !club.squad.some(p => p.role === 'GK');
      const remainingAfter = d.targetSquadSize - club.squad.length - 1;
      const maxAffordable = d.budgetRemaining - remainingAfter * 30;

      const affordable = d.currentPool
        .filter(p => p.cost <= maxAffordable)
        .sort((a, b) => b.ca - a.ca);

      let chosen = needGK
        ? affordable.find(p => p.role === 'GK') || affordable[0]
        : affordable[0];

      if (!chosen) {
        chosen = d.currentPool.sort((a, b) => a.cost - b.cost)[0];
      }

      const idx = d.currentPool.findIndex(p => p.id === chosen.id);
      if (idx >= 0) d.currentPool.splice(idx, 1);
      d.budgetRemaining = Math.max(0, d.budgetRemaining - chosen.cost);
      club.squad.push(chosen);
    }
  }

  /**
   * 玩家确认 26 人选秀名单并正式开启赛季
   */
  public confirmInitialDraft(): { ok: boolean; reason?: string } {
    if (this.state.phase !== 'INIT_DRAFT') {
      return { ok: false, reason: '当前不在选秀阶段' };
    }
    const club = this.getUserClub();
    const d = this.state.draft;
    if (club.squad.length < d.targetSquadSize) {
      return { ok: false, reason: `尚缺 ${d.targetSquadSize - club.squad.length} 名球员，请先选满或点击智能补齐` };
    }
    if (!club.squad.some(p => p.role === 'GK')) {
      return { ok: false, reason: '大名单至少需要 1 名门将 (GK)，请先退选 1 人并签入门将' };
    }
    this.finishInitialDraft();
    return { ok: true };
  }

  private finishInitialDraft(): void {
    const club = this.getUserClub();
    club.starterIds = autoSelectStarters(club.squad, club.formation);
    this.state.phase = 'REGULAR_SEASON';
    this.state.currentRound = 1;
    ensureChronicles(this.state);
    if ((this.state.currentTier ?? 7) === 1) {
      tryUnlockAchievement(this.state, 'ach_top_tier');
    }
    this.state.chronicleSeasonAdvancedIds = [];
    this.state.chronicleExtraUnlockedThisSeason = false;
    triggerSeasonStartChronicle(this.state, club);
    this.state.interMatchPrep = createInterMatchPrep(this.state, club);
    tryUnlockAchievement(this.state, 'ach_first_draft');
    if (this.state.storyline) {
      this.state.pendingStoryEvent = createOpeningBriefing(this.state.storyline, club.name);
    }
  }

  // ==================== 1.5 开局 3 次核心开包 + 夏窗 / 冬窗系统 ====================

  public getCorePackDraftState(): CorePackDraftState {
    if (!this.state.corePackDraft) {
      const tier = this.state.currentTier ?? 7;
      this.state.corePackDraft = {
        step: 0,
        lines: ['DEF', 'MID', 'ATT'],
        currentChoices: generateCorePackChoices('DEF', tier),
        pickedCores: [],
      };
    }
    return this.state.corePackDraft;
  }

  public pickCorePackPlayer(playerId: string): { ok: boolean; player?: DraftPlayer; completed?: boolean; reason?: string } {
    return this.pickCorePackPlayers([playerId]);
  }

  public pickCorePackPlayers(playerIds: string[]): { ok: boolean; player?: DraftPlayer; players?: DraftPlayer[]; completed?: boolean; reason?: string } {
    if (this.state.phase !== 'INIT_DRAFT') {
      return { ok: false, reason: '当前不在开局核心开包阶段' };
    }
    const cpd = this.getCorePackDraftState();
    if (cpd.step >= 3) {
      return { ok: false, reason: '3 次核心开包已全部完成' };
    }
    const uniqueIds = Array.from(new Set(playerIds));
    const chosenList = uniqueIds
      .map(id => cpd.currentChoices.find(p => p.id === id))
      .filter((p): p is DraftPlayer => !!p);
    if (chosenList.length === 0 || chosenList.length !== uniqueIds.length) {
      return { ok: false, reason: '未找到选中的核心候选球员' };
    }

    const club = this.getUserClub();
    const roster = this.getClubRoster();
    const added: DraftPlayer[] = [];
    for (const chosen of chosenList) {
      const copy1 = JSON.parse(JSON.stringify(chosen)) as DraftPlayer;
      const copy2 = JSON.parse(JSON.stringify(chosen)) as DraftPlayer;
      club.squad.push(copy1);
      roster.push(copy2);
      cpd.pickedCores.push(copy1);
      added.push(copy1);
    }
    cpd.step += 1;

    if (cpd.step < 3) {
      const nextLine = cpd.lines[cpd.step];
      cpd.currentChoices = generateCorePackChoices(nextLine, this.state.currentTier ?? 7);
      return { ok: true, player: added[0], players: added, completed: false };
    }

    cpd.currentChoices = [];
    club.starterIds = autoSelectStarters(club.squad, club.formation);
    this.state.phase = 'SUMMER_WINDOW';
    this.getYouthAcademyState();
    this.getTransferMarketState();
    tryUnlockAchievement(this.state, 'ach_first_draft');
    return { ok: true, player: added[0], players: added, completed: true };
  }

  public getTransferWindowState(): {
    isOpen: boolean;
    window: 'summer' | 'winter' | 'closed';
    roundsToNextWindow: number;
    label: string;
  } {
    const ph = this.state.phase;
    if (ph === 'SUMMER_WINDOW' || ph === 'SEASON_END') {
      return { isOpen: true, window: 'summer', roundsToNextWindow: 0, label: '夏季转会窗开放中' };
    }
    if (ph === 'WINTER_WINDOW') {
      return { isOpen: true, window: 'winter', roundsToNextWindow: 0, label: '冬季转会窗开放中 (半程补强)' };
    }
    const r = this.state.currentRound ?? 1;
    const midRound = this.getMidSeasonRound();
    const totalRounds = this.getTotalRegularRounds();
    if (r <= midRound) {
      return {
        isOpen: false,
        window: 'closed',
        roundsToNextWindow: Math.max(1, midRound + 1 - r),
        label: `转会窗已关闭 · 距冬窗还有 ${Math.max(1, midRound + 1 - r)} 轮`,
      };
    }
    return {
      isOpen: false,
      window: 'closed',
      roundsToNextWindow: Math.max(1, totalRounds - r + 1),
      label: `转会窗已关闭 · 距夏窗还有 ${Math.max(1, totalRounds - r + 1)} 轮`,
    };
  }

  /**
   * 兜底免签梯队自由身球员（0 费用，防止夏窗资金耗尽凑不够 26 人卡死）
   */
  public signFreeAcademyFill(fillAll = false): { ok: boolean; added: number; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, added: 0, reason: '当前不在转会窗口期，无法免签球员' };
    const roster = this.getClubRoster();
    if (roster.length >= SEASON_SQUAD_SIZE && fillAll) {
      return { ok: false, added: 0, reason: `大名单已满 ${SEASON_SQUAD_SIZE} 人，无需免签补齐` };
    }
    if (roster.length >= MAX_CLUB_ROSTER) {
      return { ok: false, added: 0, reason: `俱乐部大名单已达上限 (${MAX_CLUB_ROSTER}人)` };
    }
    const tier = this.state.currentTier ?? 7;
    const tierBase = Math.max(34, 38 + (7 - Math.max(1, Math.min(7, tier))) * 6);
    const count = fillAll ? Math.max(1, SEASON_SQUAD_SIZE - roster.length) : 1;
    let added = 0;
    for (let i = 0; i < count; i++) {
      if (roster.length >= MAX_CLUB_ROSTER) break;
      const needGK = !roster.some(p => p.role === 'GK');
      const pool = generateShuffleSet(6, Math.max(30, tierBase - 6), Math.max(36, tierBase - 1));
      const p = (needGK ? pool.find(x => x.role === 'GK') : pool[0]) ?? pool[0];
      p.scoutFogLevel = 2;
      p.paEstMin = p.pa;
      p.paEstMax = p.pa;
      p.isNewSigning = true;
      roster.push(p);
      added++;
    }
    if (this.state.phase === 'SUMMER_WINDOW' || this.state.phase === 'WINTER_WINDOW') {
      this.syncWindowRosterToClub();
    }
    return { ok: true, added };
  }

  private syncWindowRosterToClub(): void {
    const club = this.getUserClub();
    const roster = this.getClubRoster();
    const sel = this.getRosterSelectedIds();
    if (roster.length <= SEASON_SQUAD_SIZE) {
      club.squad = JSON.parse(JSON.stringify(roster));
    } else if (sel.length === SEASON_SQUAD_SIZE) {
      club.squad = sel.map(id => roster.find(p => p.id === id)).filter((p): p is DraftPlayer => !!p).map(p => JSON.parse(JSON.stringify(p)));
    } else {
      const sorted = [...roster].sort((a, b) => b.ca - a.ca).slice(0, SEASON_SQUAD_SIZE);
      club.squad = JSON.parse(JSON.stringify(sorted));
    }
    club.starterIds = autoSelectStarters(club.squad, club.formation);
  }

  public finishSummerWindowAndStartSeason(): { ok: boolean; reason?: string } {
    if (this.state.phase !== 'SUMMER_WINDOW') {
      return { ok: false, reason: '当前不在夏季转会窗阶段' };
    }
    const roster = this.getClubRoster();
    if (roster.length < SEASON_SQUAD_SIZE) {
      return { ok: false, reason: `大名单尚缺 ${SEASON_SQUAD_SIZE - roster.length} 人（需凑满 ${SEASON_SQUAD_SIZE} 人方可注册开赛）` };
    }
    if (!roster.some(p => p.role === 'GK')) {
      return { ok: false, reason: '大名单至少需要 1 名门将 (GK)' };
    }
    if (this.state.transferMarket?.pendingBrokerResult) {
      return { ok: false, reason: '请先处理经纪人密荐开出的待决球员' };
    }
    if (this.getRosterSelectedIds().length < SEASON_SQUAD_SIZE) {
      this.autoSelectSeason16FromRoster();
    }
    this.syncWindowRosterToClub();
    this.finishInitialDraft();
    return { ok: true };
  }

  public closeWinterWindow(): { ok: boolean; reason?: string } {
    if (this.state.phase !== 'WINTER_WINDOW') {
      return { ok: false, reason: '当前不在冬季转会窗阶段' };
    }
    const roster = this.getClubRoster();
    if (roster.length < SEASON_SQUAD_SIZE) {
      return { ok: false, reason: `注册大名单不足 ${SEASON_SQUAD_SIZE} 人，请先补齐` };
    }
    if (this.state.transferMarket?.pendingBrokerResult) {
      return { ok: false, reason: '请先处理经纪人密荐开出的待决球员' };
    }
    this.syncWindowRosterToClub();
    this.state.phase = 'REGULAR_SEASON';
    this.state.currentRound = this.getMidSeasonRound() + 1;
    this.state.winterWindowDoneSeason = this.state.seasonNumber;
    this.state.interMatchPrep = createInterMatchPrep(this.state, this.getUserClub());
    return { ok: true };
  }

  // ==================== 2. 阵型与首发管理 ====================

  public updateUserTactics(
    formation: FormationName,
    style: TacticalStyle,
    starterIds?: string[]
  ): void {
    const club = this.getUserClub();
    const formationChanged = club.formation !== formation;
    club.formation = formation;
    club.style = style;
    if (formationChanged) {
      club.gridSlots = undefined;
      club.slotDuties = undefined;
    }
    if (starterIds && starterIds.length === 11) {
      club.starterIds = [...starterIds];
    } else {
      club.starterIds = autoSelectStarters(club.squad, formation);
    }
    this.replaceUnavailableStarters(club);
  }

  /**
   * 仅替换首发名单中的伤停、停赛、缺失或指定轮休槽位，保留其余健康首发位置不变
   */
  public replaceUnavailableStarters(
    club: LeagueClub,
    extraExcludeIds?: Set<string>
  ): Array<{ outName: string; inName: string; role: string }> {
    const slots = FORMATIONS[club.formation];
    const squadMap = new Map(club.squad.map(p => [p.id, p]));
    const nextIds = [...club.starterIds];
    const usedIds = new Set<string>();
    const needReplaceIndices: number[] = [];
    const outNames = new Map<number, string>();

    const isAvailable = (p: DraftPlayer | undefined): p is DraftPlayer =>
      !!p &&
      (p.suspendedRounds ?? 0) <= 0 &&
      (p.injuredRounds ?? 0) <= 0 &&
      !(extraExcludeIds?.has(p.id));

    for (let i = 0; i < 11; i++) {
      const pid = nextIds[i];
      const p = pid ? squadMap.get(pid) : undefined;
      if (isAvailable(p) && !usedIds.has(p.id)) {
        usedIds.add(p.id);
      } else {
        needReplaceIndices.push(i);
        outNames.set(i, p?.name ?? '空缺');
      }
    }

    const lineOf = (r: string) =>
      r === 'GK' ? 'GK' :
      ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) ? 'DEF' :
      ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(r) ? 'MID' : 'ATT';

    const changes: Array<{ outName: string; inName: string; role: string }> = [];
    for (const idx of needReplaceIndices) {
      const slotRole = slots[idx]?.role ?? 'CM';
      const slotLine = lineOf(slotRole);
      const candidates = club.squad.filter(p => !usedIds.has(p.id) && isAvailable(p));
      const pool = candidates.length > 0
        ? candidates
        : club.squad.filter(p => !usedIds.has(p.id) && (p.suspendedRounds ?? 0) <= 0 && (p.injuredRounds ?? 0) <= 0);
      if (pool.length === 0) continue;

      const scoreOf = (p: DraftPlayer) => {
        let s = p.ca * 1.2 + (p.fitness ?? 100) * 0.6 + (p.strainWarning ? 0 : 120);
        if (p.role === slotRole) s += 1000;
        else if (slotRole !== 'GK' && p.role !== 'GK' && (p.secondaryRoles?.includes(slotRole) ?? false)) s += 600;
        else if (slotRole !== 'GK' && p.role !== 'GK' && lineOf(p.role) === slotLine) s += 300;
        else if ((slotRole === 'GK') !== (p.role === 'GK')) s -= 600;
        return s;
      };

      const best = [...pool].sort((a, b) => scoreOf(b) - scoreOf(a))[0];
      if (best) {
        nextIds[idx] = best.id;
        usedIds.add(best.id);
        changes.push({ outName: outNames.get(idx) ?? '空缺', inName: best.name, role: slotRole });
      }
    }

    if (nextIds.length === 11) {
      club.starterIds = nextIds;
    }
    this.getCaptainId(club);
    return changes;
  }

  public setClubGridSlot(slotIdx: number, col: number, row: number): void {
    if (slotIdx <= 0 || slotIdx > 10) return;
    const club = this.getUserClub();
    club.gridSlots = club.gridSlots ?? {};
    club.gridSlots[slotIdx] = {
      col: Math.max(0, Math.min(4, Math.round(col))),
      row: Math.max(0, Math.min(5, Math.round(row))),
    };
  }

  public setClubSlotDuty(slotIdx: number, duty: PlayerDuty): void {
    if (slotIdx < 0 || slotIdx > 10) return;
    const club = this.getUserClub();
    club.slotDuties = club.slotDuties ?? {};
    club.slotDuties[slotIdx] = duty;
  }

  public resetClubGridAndDuties(): void {
    const club = this.getUserClub();
    club.gridSlots = undefined;
    club.slotDuties = undefined;
  }

  public getCaptainId(targetClub?: LeagueClub): string | undefined {
    const club = targetClub ?? this.getUserClub();
    const starters = club.starterIds
      .map(id => club.squad.find(p => p.id === id))
      .filter((p): p is DraftPlayer => !!p && (p.suspendedRounds ?? 0) <= 0 && (p.injuredRounds ?? 0) <= 0);
    if (club.captainId && starters.some(p => p.id === club.captainId)) {
      return club.captainId;
    }
    const fallback = [...starters].sort(
      (a, b) => (b.attributes.composure + b.age * 0.5) - (a.attributes.composure + a.age * 0.5)
    )[0] ?? club.squad[0];
    if (fallback) club.captainId = fallback.id;
    return club.captainId;
  }

  public toggleStarPlayer(playerId: string): boolean {
    const club = this.getUserClub();
    const roster = this.getClubRoster();
    let next = false;
    const cp = club.squad.find(x => x.id === playerId);
    if (cp) { next = !cp.isStarred; cp.isStarred = next; }
    const rp = roster.find(x => x.id === playerId);
    if (rp) { next = cp ? next : !rp.isStarred; rp.isStarred = next; }
    return next;
  }

  public setCaptain(playerId: string): { ok: boolean; msg?: string } {
    const club = this.getUserClub();
    const p = club.squad.find(x => x.id === playerId);
    if (!p) return { ok: false, msg: '未找到该球员' };
    if ((p.suspendedRounds ?? 0) > 0 || (p.injuredRounds ?? 0) > 0) {
      return { ok: false, msg: '伤停/停赛球员无法佩戴本场袖标' };
    }
    club.captainId = playerId;
    return { ok: true, msg: `已任命【${p.name}】佩戴队长袖标（本人在场冷静+4/传球+3，全队冷静+2/传球+1）` };
  }

  public setPlayerShirtNumber(playerId: string, rawNumber: number): { ok: boolean; msg: string } {
    const club = this.getUserClub();
    const p = club.squad.find(x => x.id === playerId);
    if (!p) return { ok: false, msg: '未找到该球员' };
    const nextNum = Math.max(1, Math.min(99, Math.round(rawNumber)));
    if (p.shirtNumber === nextNum) {
      return { ok: true, msg: `【${p.name}】当前已是 ${nextNum} 号球衣` };
    }
    const prevNum = p.shirtNumber;
    const conflict = club.squad.find(x => x.id !== playerId && x.shirtNumber === nextNum);
    if (conflict) {
      conflict.shirtNumber = prevNum;
    }
    p.shirtNumber = nextNum;
    const roster = this.getClubRoster();
    const rp = roster.find(x => x.id === playerId);
    if (rp) rp.shirtNumber = nextNum;
    if (conflict) {
      const rConflict = roster.find(x => x.id === conflict.id);
      if (rConflict) rConflict.shirtNumber = prevNum;
      return { ok: true, msg: `已将【${p.name}】设为 ${nextNum} 号（与【${conflict.name}】互换号码）` };
    }
    return { ok: true, msg: `已将【${p.name}】球衣号码设为 ${nextNum} 号` };
  }

  public getPlayerStoryTag(player: DraftPlayer): string | null {
    const chrons = this.state.chronicles;
    if (chrons) {
      if (chrons.captain_torch?.status === 'active' && chrons.captain_torch.keyPeople.includes(player.name)) {
        return '薪火传承';
      }
      if (chrons.scout_poach?.status === 'active' && chrons.scout_poach.keyPeople.includes(player.name)) {
        return '球探焦点';
      }
      if (chrons.academy_roots?.status === 'active' && player.age <= 23) {
        return '青训主线';
      }
    }
    const sl = this.state.storyline;
    if (sl?.id === 'wonderkid' && player.age <= 23) return '新星计划';
    if (sl?.id === 'veteran' && player.age >= 28) return '老兵故事';
    return null;
  }

  /**
   * 获取 4 个赛前预置战术槽位（每个预案包含阵型、11名首发球员、战术风格）
   */
  public getTacticalPresets(): TacticalPresetSlot[] {
    const club = this.getUserClub();
    if (!this.state.tacticalPresets || this.state.tacticalPresets.length < 4) {
      const curStarters = club.starterIds.length === 11 ? [...club.starterIds] : autoSelectStarters(club.squad, club.formation);
      const defaults: TacticalPresetSlot[] = [
        { id: 'preset_1', name: '主力控场', formation: club.formation, style: club.style, starterIds: curStarters },
        { id: 'preset_2', name: '高位逼抢', formation: '4-2-3-1', style: 'gegenpress', starterIds: autoSelectStarters(club.squad, '4-2-3-1') },
        { id: 'preset_3', name: '两翼齐飞', formation: '4-3-3', style: 'wing_play', starterIds: autoSelectStarters(club.squad, '4-3-3') },
        { id: 'preset_4', name: '铁桶防反', formation: '5-3-2', style: 'park_bus', starterIds: autoSelectStarters(club.squad, '5-3-2') },
      ];
      const existing = this.state.tacticalPresets ?? [];
      this.state.tacticalPresets = [0, 1, 2, 3].map(i => existing[i] ?? defaults[i]);
    }
    return this.state.tacticalPresets;
  }

  public saveTacticalPreset(slotIndex: number, name?: string): { ok: boolean; preset?: TacticalPresetSlot } {
    if (slotIndex < 0 || slotIndex > 3) return { ok: false };
    const presets = this.getTacticalPresets();
    const club = this.getUserClub();
    const starterIds = club.starterIds.length === 11 ? [...club.starterIds] : autoSelectStarters(club.squad, club.formation);
    const next: TacticalPresetSlot = {
      id: `preset_${slotIndex + 1}`,
      name: name?.trim() || presets[slotIndex].name || `预案 ${slotIndex + 1}`,
      formation: club.formation,
      style: club.style,
      starterIds,
    };
    presets[slotIndex] = next;
    return { ok: true, preset: next };
  }

  public applyTacticalPreset(slotIndex: number): { ok: boolean; preset?: TacticalPresetSlot } {
    if (slotIndex < 0 || slotIndex > 3) return { ok: false };
    const presets = this.getTacticalPresets();
    const preset = presets[slotIndex];
    if (!preset) return { ok: false };
    const club = this.getUserClub();
    const healthyMap = new Map(
      club.squad
        .filter(p => (p.suspendedRounds ?? 0) <= 0 && (p.injuredRounds ?? 0) <= 0)
        .map(p => [p.id, p])
    );
    const validStarters = preset.starterIds.filter(id => healthyMap.has(id));
    const finalStarters = validStarters.length === 11 ? validStarters : autoSelectStarters(club.squad, preset.formation);
    this.updateUserTactics(preset.formation, preset.style, finalStarters);
    return { ok: true, preset };
  }

  public renameTacticalPreset(slotIndex: number, name: string): boolean {
    if (slotIndex < 0 || slotIndex > 3 || !name.trim()) return false;
    const presets = this.getTacticalPresets();
    presets[slotIndex].name = name.trim().slice(0, 8);
    return true;
  }

  /**
   * 休赛期专项特训（方案 A：仅赛季结算期可用）：消耗 10 Meta 点数定向提升 3 项核心属性 +2，每名球员每季限训 1 次
   */
  public trainPlayer(
    playerId: string,
    focus: 'auto' | 'attack' | 'playmake' | 'defense' = 'auto'
  ): { ok: boolean; player?: DraftPlayer; oldCA?: number; newCA?: number; gainedText?: string; reason?: string } {
    if (this.state.phase !== 'SEASON_END') {
      return { ok: false, reason: '专项特训仅在赛季末休赛期开放' };
    }
    const tgLv = this.getMetaLevels().training_ground ?? 0;
    const maxTrainsPerSeason = tgLv >= 6 ? 3 : tgLv >= 4 ? 2 : 1;
    this.state.seasonTrainedIds = this.state.seasonTrainedIds ?? [];
    const trainedCount = this.state.seasonTrainedIds.filter(id => id === playerId).length;
    if (trainedCount >= maxTrainsPerSeason) {
      return { ok: false, reason: `该球员本休赛期特训次数已满 (${trainedCount}/${maxTrainsPerSeason})` };
    }
    if (this.state.metaPointsTotal < 10) {
      return { ok: false, reason: 'PT 点数不足（休赛期特训需要 10 pt）' };
    }
    const club = this.getUserClub();
    const p = club.squad.find(x => x.id === playerId);
    if (!p) return { ok: false, reason: '未找到该球员' };
    const pa = p.pa ?? computeInitialPA(p.ca, p.age ?? 24, (p.age ?? 24) <= 19);
    p.pa = pa;
    if (p.ca >= pa) return { ok: false, reason: `该球员已达潜力上限 (PA ${pa})` };

    const oldCA = p.ca;
    this.state.metaPointsTotal -= 10;
    const clamp = (v: number) => Math.min(99, v);

    let mode = focus;
    if (mode === 'auto') {
      if (p.role === 'GK' || ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)) mode = 'defense';
      else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role)) mode = 'playmake';
      else mode = 'attack';
    }

    let gainedText = '';
    if (p.role === 'GK' && mode === 'defense') {
      p.attributes.goalkeeping = clamp(p.attributes.goalkeeping + 2);
      p.attributes.positioning = clamp(p.attributes.positioning + 2);
      p.attributes.composure = clamp(p.attributes.composure + 2);
      gainedText = '扑救+2 站位+2 冷静+2';
    } else if (mode === 'defense') {
      p.attributes.defending = clamp(p.attributes.defending + 2);
      p.attributes.positioning = clamp(p.attributes.positioning + 2);
      p.attributes.stamina = clamp(p.attributes.stamina + 2);
      gainedText = '抢断+2 选位+2 体能+2';
    } else if (mode === 'playmake') {
      p.attributes.passing = clamp(p.attributes.passing + 2);
      p.attributes.dribbling = clamp(p.attributes.dribbling + 2);
      p.attributes.composure = clamp(p.attributes.composure + 2);
      gainedText = '传球+2 盘带+2 冷静+2';
    } else {
      p.attributes.shooting = clamp(p.attributes.shooting + 2);
      p.attributes.pace = clamp(p.attributes.pace + 2);
      p.attributes.dribbling = clamp(p.attributes.dribbling + 2);
      gainedText = '射门+2 速度+2 盘带+2';
    }

    p.ca = Math.min(pa, computeWeightedCA(p.role, p.attributes));
    p.marketValue = calcTransferValue(p);
    this.state.seasonTrainedIds.push(playerId);
    if (this.state.persistentSquad) {
      const idx = this.state.persistentSquad.findIndex(x => x.id === playerId);
      if (idx >= 0) this.state.persistentSquad[idx] = JSON.parse(JSON.stringify(p));
    }
    if (this.state.clubRoster) {
      const rIdx = this.state.clubRoster.findIndex(x => x.id === playerId);
      if (rIdx >= 0) this.state.clubRoster[rIdx] = JSON.parse(JSON.stringify(p));
    }
    return { ok: true, player: p, oldCA, newCA: p.ca, gainedText };
  }

  // ==================== 2.5 俱乐部 26 人常驻大名单与 16 人出战注册 ====================

  public getClubRoster(): DraftPlayer[] {
    if (!this.state.clubRoster) {
      this.state.clubRoster = [];
    }
    return this.state.clubRoster;
  }

  /**
   * 判断当前是否有正在进行的赛季（常规赛/Re-Draft/季后赛/已开选秀）
   * 赛季进行中必须锁死俱乐部大名单，禁止休赛期外的招募、改名额或重开赛季
   */
  public isSeasonInProgress(): boolean {
    const ph = this.state.phase;
    if (ph === 'REGULAR_SEASON' || ph === 'RE_DRAFT' || ph === 'PLAYOFF_SEMI' || ph === 'PLAYOFF_FINAL') {
      return true;
    }
    if (ph === 'INIT_DRAFT') {
      const uc = this.getUserClub();
      return uc.squad.length > 0 || (this.state.seasonNumber ?? 1) > 1;
    }
    return false;
  }

  public getRosterRefreshesRemaining(): number {
    if (this.state.rosterRefreshesRemaining === undefined) {
      this.state.rosterRefreshesRemaining = 3 + (this.getMetaLevels().scout ?? 0);
    }
    return this.state.rosterRefreshesRemaining;
  }

  public consumeRosterRefresh(): { ok: boolean; remaining: number; reason?: string } {
    if (this.isSeasonInProgress()) {
      return { ok: false, remaining: this.getRosterRefreshesRemaining(), reason: '赛季进行中，大名单已锁定' };
    }
    const rem = this.getRosterRefreshesRemaining();
    if (rem <= 0) {
      return { ok: false, remaining: 0, reason: '球探刷新次数已用完（升级球探网络可增加次数）' };
    }
    this.state.rosterRefreshesRemaining = rem - 1;
    return { ok: true, remaining: this.state.rosterRefreshesRemaining };
  }

  public getRosterSelectedIds(): string[] {
    const roster = this.getClubRoster();
    const rosterIds = new Set(roster.map(p => p.id));
    this.state.rosterSelectedIds = (this.state.rosterSelectedIds ?? []).filter(id => rosterIds.has(id)).slice(0, SEASON_SQUAD_SIZE);
    if (this.state.rosterSelectedIds.length === 0 && roster.length >= SEASON_SQUAD_SIZE) {
      this.autoSelectSeason16FromRoster();
    }
    return this.state.rosterSelectedIds;
  }

  public autoSelectSeason16FromRoster(): string[] {
    if (this.isSeasonInProgress()) {
      return this.getRosterSelectedIds();
    }
    const roster = [...this.getClubRoster()].sort((a, b) => b.ca - a.ca);
    const chosen: DraftPlayer[] = [];
    const pick = (pred: (p: DraftPlayer) => boolean, limit: number) => {
      for (const p of roster) {
        if (chosen.length >= SEASON_SQUAD_SIZE) break;
        if (chosen.some(c => c.id === p.id)) continue;
        if (pred(p)) {
          chosen.push(p);
          if (chosen.filter(pred).length >= limit) break;
        }
      }
    };
    pick(p => p.role === 'GK', 3);
    pick(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role), 8);
    pick(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role), 8);
    pick(p => ['LW', 'RW', 'ST'].includes(p.role), 7);
    for (const p of roster) {
      if (chosen.length >= SEASON_SQUAD_SIZE) break;
      if (!chosen.some(c => c.id === p.id)) chosen.push(p);
    }
    this.state.rosterSelectedIds = chosen.map(p => p.id);
    return this.state.rosterSelectedIds;
  }

  public toggleRosterSelection(playerId: string): { ok: boolean; selected?: boolean; reason?: string } {
    if (this.isSeasonInProgress()) {
      return { ok: false, reason: '赛季进行中，球队大名单已锁定，休赛期方可调整' };
    }
    const roster = this.getClubRoster();
    if (!roster.some(p => p.id === playerId)) return { ok: false, reason: '大名单中未找到该球员' };
    const ids = this.getRosterSelectedIds();
    const idx = ids.indexOf(playerId);
    if (idx >= 0) {
      ids.splice(idx, 1);
      return { ok: true, selected: false };
    }
    if (ids.length >= SEASON_SQUAD_SIZE) {
      return { ok: false, reason: `本赛季报名已满 (${SEASON_SQUAD_SIZE}/${SEASON_SQUAD_SIZE})，请先取消 1 名球员` };
    }
    ids.push(playerId);
    return { ok: true, selected: true };
  }

  public addCandidateToClubRoster(player: DraftPlayer): { ok: boolean; reason?: string } {
    if (this.isSeasonInProgress()) {
      return { ok: false, reason: '赛季进行中，球队大名单已锁定，休赛期方可引援' };
    }
    const roster = this.getClubRoster();
    if (roster.length >= MAX_CLUB_ROSTER) {
      return { ok: false, reason: `俱乐部大名单已达上限 (${MAX_CLUB_ROSTER}/${MAX_CLUB_ROSTER})` };
    }
    if (roster.some(p => p.id === player.id)) {
      return { ok: false, reason: '该球员已在大名单中' };
    }
    roster.push(JSON.parse(JSON.stringify(player)));
    if (roster.length === SEASON_SQUAD_SIZE) {
      this.autoSelectSeason16FromRoster();
    }
    return { ok: true };
  }

  public autoFillClubRoster26(): { added: number; reason?: string } {
    if ((this.state.seasonNumber ?? 1) > 1) {
      return { added: 0, reason: '仅开局第 1 赛季支持一键补齐名单，后续请通过开包奖励、转会与青训补人' };
    }
    if (this.isSeasonInProgress()) {
      return { added: 0, reason: '赛季进行中无法一键补齐名单' };
    }
    const roster = this.getClubRoster();
    const meta = this.getMetaLevels();
    const tier = this.state.currentTier ?? 7;
    const tierBase = 38 + (7 - Math.max(1, Math.min(7, tier))) * 6;
    const minBand = tierBase + meta.scout;
    const maxBand = tierBase + 14 + meta.scout;
    let added = 0;
    const pool = generateShuffleSet(60, minBand, maxBand).sort((a, b) => b.ca - a.ca);

    const ensureRoleCount = (pred: (p: DraftPlayer) => boolean, target: number) => {
      while (roster.length < MAX_CLUB_ROSTER && roster.filter(pred).length < target) {
        const idx = pool.findIndex(pred);
        if (idx < 0) break;
        roster.push(pool.splice(idx, 1)[0]);
        added++;
      }
    };
    ensureRoleCount(p => p.role === 'GK', 4);
    ensureRoleCount(p => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role), 13);
    ensureRoleCount(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role), 13);
    ensureRoleCount(p => ['LW', 'RW', 'ST'].includes(p.role), 10);

    while (roster.length < MAX_CLUB_ROSTER) {
      const extra = pool.shift() ?? generateShuffleSet(1, minBand, maxBand)[0];
      roster.push(extra);
      added++;
    }
    this.autoSelectSeason16FromRoster();
    return { added };
  }

  public startSeasonFromRoster(opts?: NewSeasonOptions): { ok: boolean; reason?: string } {
    if (this.isSeasonInProgress()) {
      return { ok: false, reason: '当前已有正在进行的赛季，请先完成本赛季' };
    }
    const roster = this.getClubRoster();
    if (roster.length < SEASON_SQUAD_SIZE) {
      return { ok: false, reason: `大名单不足 ${SEASON_SQUAD_SIZE} 人，请先补齐大名单` };
    }
    const selIds = this.getRosterSelectedIds();
    const selectedPlayers = selIds.length === SEASON_SQUAD_SIZE
      ? selIds.map(id => roster.find(p => p.id === id)).filter((p): p is DraftPlayer => !!p)
      : roster.slice(0, SEASON_SQUAD_SIZE);
    if (!selectedPlayers.some(p => p.role === 'GK')) {
      return { ok: false, reason: '赛季注册 26 人名单中至少需要 1 名门将 (GK)' };
    }
    this.state.persistentSquad = JSON.parse(JSON.stringify(selectedPlayers));
    const club = this.getUserClub();
    this.startNewSeason(
      opts ?? {
        clubId: club.id,
        customName: club.name,
        primaryColor: club.primaryColor,
        secondaryColor: club.secondaryColor,
        formation: club.formation,
        style: club.style,
      },
      club.formation,
      club.style,
      true
    );
    return { ok: true };
  }

  /**
   * 赛季末新秀处理：若 26 人大名单未满则直接补充入队，若已达 26 人上限则一对一替换
   */
  public recruitSeasonRewardToRoster(rewardPlayerId: string, replacePlayerId?: string): { ok: boolean; mode?: 'added' | 'replaced'; reason?: string } {
    if (this.state.phase !== 'SEASON_END' || !this.state.seasonRewardDrafts) {
      return { ok: false, reason: '当前不在赛季结算阶段' };
    }
    const rIdx = this.state.seasonRewardDrafts.findIndex(p => p.id === rewardPlayerId);
    if (rIdx < 0) return { ok: false, reason: '未找到该引援新秀' };

    const roster = this.getClubRoster();
    if (roster.length < MAX_CLUB_ROSTER && !replacePlayerId) {
      const [incoming] = this.state.seasonRewardDrafts.splice(rIdx, 1);
      incoming.isNewSigning = true;
      roster.push(incoming);
      return { ok: true, mode: 'added' };
    }

    if (!replacePlayerId) {
      return { ok: false, reason: `大名单已满 (${MAX_CLUB_ROSTER}/${MAX_CLUB_ROSTER})，请点选右侧一名球员进行替换` };
    }
    const oIdx = roster.findIndex(p => p.id === replacePlayerId);
    if (oIdx < 0) return { ok: false, reason: '未找到要替换的大名单球员' };

    const [incoming] = this.state.seasonRewardDrafts.splice(rIdx, 1);
    incoming.isNewSigning = true;
    roster[oIdx] = incoming;

    // 若同时在当前赛季 16 人阵容中，同步更新
    const club = this.getUserClub();
    const cIdx = club.squad.findIndex(p => p.id === replacePlayerId);
    if (cIdx >= 0) {
      club.squad[cIdx] = incoming;
      const sIdx = club.starterIds.indexOf(replacePlayerId);
      if (sIdx >= 0) club.starterIds[sIdx] = incoming.id;
    }
    this.state.persistentSquad = JSON.parse(JSON.stringify(club.squad));
    return { ok: true, mode: 'replaced' };
  }

  /**
   * 赛季末新老球员交换：用赛季奖励新秀替换队内一名老球员并持久化
   */
  public swapSeasonRewardPlayer(oldPlayerId: string, rewardPlayerId: string): { ok: boolean; reason?: string } {
    if (this.state.phase !== 'SEASON_END' || !this.state.seasonRewardDrafts) {
      return { ok: false, reason: '当前不在赛季结算交换阶段' };
    }
    const rIdx = this.state.seasonRewardDrafts.findIndex(p => p.id === rewardPlayerId);
    if (rIdx < 0) return { ok: false, reason: '未找到该引援新秀' };
    const club = this.getUserClub();
    const oIdx = club.squad.findIndex(p => p.id === oldPlayerId);
    if (oIdx < 0) return { ok: false, reason: '未找到要替换的队内球员' };

    const [incoming] = this.state.seasonRewardDrafts.splice(rIdx, 1);
    incoming.isNewSigning = true;
    club.squad[oIdx] = incoming;
    const sIdx = club.starterIds.indexOf(oldPlayerId);
    if (sIdx >= 0) club.starterIds[sIdx] = incoming.id;
    this.state.persistentSquad = JSON.parse(JSON.stringify(club.squad));
    return { ok: true };
  }

  // ==================== 3. 比赛驱动与轮次推进 ====================

  private buildTeamSetup(club: LeagueClub, opponentClubId?: string): TeamSetup {
    this.replaceUnavailableStarters(club);
    const squadMap = new Map(club.squad.map(p => [p.id, p]));
    let starters = club.starterIds
      .map(id => squadMap.get(id))
      .filter((p): p is DraftPlayer => !!p && (p.suspendedRounds ?? 0) <= 0 && (p.injuredRounds ?? 0) <= 0);

    if (starters.length < 11) {
      club.starterIds = autoSelectStarters(club.squad, club.formation);
      starters = club.starterIds.map(id => squadMap.get(id)!).filter(Boolean);
    }

    const meta = club.isUser ? this.getMetaLevels() : null;
    const mastery = club.isUser ? this.getTacticalMastery() : null;
    const formLv = mastery ? getFormationMasteryInfo(club.formation, mastery.formations[club.formation] ?? 0).level : 1;
    const styleLv = mastery ? getStyleMasteryInfo(club.style, mastery.styles[club.style] ?? 0).level : 1;
    const synergy = computePerkSynergies(club.perks);
    const storyline = club.isUser ? this.state.storyline : undefined;
    const standings = storyline?.id === 'underdog' ? this.getStandings() : null;
    const oppInTop4 = !!(standings && opponentClubId && standings.slice(0, 4).some(r => r.clubId === opponentClubId));
    const isRevengeMatch = !!(storyline?.id === 'revenge' && opponentClubId && storyline.rivalClubId === opponentClubId);
    const clampAttr = (v: number) => Math.max(25, Math.min(99, v));

    // 叠加多位置适应度 + Rogue 词条 + 协同/反噬 + 故事线 + Meta 天赋 + 阵型/战术熟练度
    const formSlots = FORMATIONS[club.formation];
    const players: PlayerInput[] = starters.map((p, idx) => {
      const attrs: PlayerAttributes = { ...p.attributes };
      const slotRole = formSlots[idx]?.role ?? p.role;
      const isNatural = p.role === slotRole;
      const isSecondary = !isNatural && (p.secondaryRoles?.includes(slotRole) ?? false);
      if (!isNatural) {
        if (isSecondary) {
          attrs.positioning = clampAttr(attrs.positioning - 2);
        } else {
          attrs.positioning = clampAttr(attrs.positioning - 8);
          attrs.composure = clampAttr(attrs.composure - 6);
          attrs.passing = clampAttr(attrs.passing - 5);
          attrs.defending = clampAttr(attrs.defending - 5);
        }
      }
      if (meta) {
        if (meta.training_ground > 0) {
          attrs.passing = clampAttr(attrs.passing + Math.min(3, Math.ceil(meta.training_ground / 2)));
          attrs.shooting = clampAttr(attrs.shooting + Math.min(3, Math.ceil(meta.training_ground / 2)));
          if (meta.training_ground >= 3) attrs.defending = clampAttr(attrs.defending + Math.min(2, Math.floor(meta.training_ground / 3)));
        }
        if (meta.medical > 0) {
          attrs.stamina = clampAttr(attrs.stamina + Math.min(3, Math.ceil(meta.medical / 2)) * 3);
          if (meta.medical >= 2) attrs.pace = clampAttr(attrs.pace + Math.min(2, Math.floor(meta.medical / 3)));
        }
      }
      // 阵型熟练度 Lv.2 / Lv.3 加成
      const defSys = getDefenseSystem(club.formation);
      if (formLv >= 2) {
        if (defSys === '4-back') {
          if (['LW', 'RW', 'CM', 'CAM', 'ST'].includes(p.role)) { attrs.passing = clampAttr(attrs.passing + 2); attrs.pace = clampAttr(attrs.pace + 2); }
        } else if (defSys === '3-back') {
          if (['LWB', 'RWB', 'CM', 'CDM', 'CAM'].includes(p.role)) { attrs.pace = clampAttr(attrs.pace + 3); attrs.stamina = clampAttr(attrs.stamina + 4); }
        } else {
          if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)) attrs.defending = clampAttr(attrs.defending + 3);
          if (p.role === 'GK') attrs.goalkeeping = clampAttr(attrs.goalkeeping + 2);
        }
      }
      if (formLv >= 3) {
        attrs.positioning = clampAttr(attrs.positioning + 2);
        attrs.composure = clampAttr(attrs.composure + 2);
        if (defSys === '4-back') attrs.shooting = clampAttr(attrs.shooting + 2);
        else attrs.defending = clampAttr(attrs.defending + 2);
      }
      // 战术风格熟练度 Lv.2 / Lv.3 加成
      if (styleLv >= 2) {
        if (club.style === 'tiki_taka') { attrs.passing = clampAttr(attrs.passing + 3); attrs.dribbling = clampAttr(attrs.dribbling + 2); }
        else if (club.style === 'gegenpress') { attrs.pace = clampAttr(attrs.pace + 2); attrs.defending = clampAttr(attrs.defending + 2); attrs.stamina = clampAttr(attrs.stamina + 3); }
        else if (club.style === 'wing_play') { attrs.pace = clampAttr(attrs.pace + 3); attrs.passing = clampAttr(attrs.passing + 2); }
        else if (club.style === 'counter') { attrs.pace = clampAttr(attrs.pace + 3); attrs.composure = clampAttr(attrs.composure + 2); }
        else if (club.style === 'park_bus') { attrs.defending = clampAttr(attrs.defending + 3); if (p.role === 'GK') attrs.goalkeeping = clampAttr(attrs.goalkeeping + 3); }
        else { attrs.passing = clampAttr(attrs.passing + 2); attrs.positioning = clampAttr(attrs.positioning + 2); }
      }
      if (styleLv >= 3) {
        if (club.style === 'tiki_taka') { attrs.composure = clampAttr(attrs.composure + 3); attrs.stamina = clampAttr(attrs.stamina + 4); }
        else if (club.style === 'gegenpress' || club.style === 'wing_play') { attrs.shooting = clampAttr(attrs.shooting + 3); attrs.pace = clampAttr(attrs.pace + 1); }
        else if (club.style === 'counter') { attrs.shooting = clampAttr(attrs.shooting + 4); }
        else if (club.style === 'park_bus') { attrs.defending = clampAttr(attrs.defending + 2); attrs.stamina = clampAttr(attrs.stamina + 4); }
        else { attrs.shooting = clampAttr(attrs.shooting + 2); attrs.defending = clampAttr(attrs.defending + 2); }
      }
      for (const perk of club.perks) {
        if (perk.effect.passingBonus) attrs.passing = clampAttr(attrs.passing + perk.effect.passingBonus);
        if (perk.effect.shootingBonus) attrs.shooting = clampAttr(attrs.shooting + perk.effect.shootingBonus);
        if (perk.effect.defendingBonus) attrs.defending = clampAttr(attrs.defending + perk.effect.defendingBonus);
        if (perk.effect.paceBonus) attrs.pace = clampAttr(attrs.pace + perk.effect.paceBonus);
        if (perk.effect.staminaBonus) attrs.stamina = clampAttr(attrs.stamina + perk.effect.staminaBonus);
        if (perk.effect.goalkeepingBonus && p.role === 'GK') {
          attrs.goalkeeping = clampAttr(attrs.goalkeeping + perk.effect.goalkeepingBonus);
        }
        if (perk.effect.dribblingBonus) attrs.dribbling = clampAttr(attrs.dribbling + perk.effect.dribblingBonus);
        if (perk.effect.composureBonus) attrs.composure = clampAttr(attrs.composure + perk.effect.composureBonus);
        if (perk.effect.strengthBonus) attrs.strength = clampAttr(attrs.strength + perk.effect.strengthBonus);
        if (perk.effect.positioningBonus) attrs.positioning = clampAttr(attrs.positioning + perk.effect.positioningBonus);
      }
      // 战术技能网已点亮节点永久加成（单维被动上限 +12，防止 124 节点无限膨胀）
      if (club.isUser) {
        const webUnlocked = this.getSkillWebUnlocked();
        const swDelta: Partial<Record<keyof PlayerAttributes, number>> = {};
        for (const nid of webUnlocked) {
          const node = SKILL_WEB_NODES.find(n => n.id === nid);
          if (!node) continue;
          if (node.targetRoles && !node.targetRoles.includes(p.role)) continue;
          const mul = isNodeResonating(node, club.formation, club.style) ? 2 : 1;
          const ef = node.effect;
          const addSw = (k: keyof PlayerAttributes, val?: number) => {
            if (val) swDelta[k] = (swDelta[k] ?? 0) + val * mul;
          };
          addSw('passing', ef.passing);
          addSw('shooting', ef.shooting);
          addSw('dribbling', ef.dribbling);
          addSw('pace', ef.pace);
          addSw('defending', ef.defending);
          addSw('positioning', ef.positioning);
          addSw('composure', ef.composure);
          addSw('stamina', ef.stamina);
          addSw('strength', ef.strength);
          if (p.role === 'GK') addSw('goalkeeping', ef.goalkeeping);
        }
        for (const k of Object.keys(swDelta) as Array<keyof PlayerAttributes>) {
          const capped = Math.min(12, swDelta[k] ?? 0);
          attrs[k] = clampAttr(attrs[k] + capped);
        }
      }

      // Perk 协同与反噬
      attrs.shooting = clampAttr(attrs.shooting + synergy.shootingDelta);
      attrs.passing = clampAttr(attrs.passing + synergy.passingDelta);
      attrs.defending = clampAttr(attrs.defending + synergy.defendingDelta);
      attrs.pace = clampAttr(attrs.pace + synergy.paceDelta);
      attrs.stamina = clampAttr(attrs.stamina + synergy.staminaDelta);
      attrs.dribbling = clampAttr(attrs.dribbling + synergy.dribblingDelta);
      attrs.composure = clampAttr(attrs.composure + synergy.composureDelta);
      attrs.positioning = clampAttr(attrs.positioning + synergy.positioningDelta);
      if (p.role === 'GK') {
        attrs.goalkeeping = clampAttr(attrs.goalkeeping + synergy.goalkeepingDelta);
      }

      // 已觉醒隐藏特质的常驻战力增益
      const pTraits = p.traits ?? [];
      if (pTraits.includes('逆转王')) { attrs.shooting = clampAttr(attrs.shooting + 3); attrs.composure = clampAttr(attrs.composure + 4); }
      if (pTraits.includes('大赛先生')) { attrs.shooting = clampAttr(attrs.shooting + 4); attrs.composure = clampAttr(attrs.composure + 4); }
      if (pTraits.includes('闪电首开')) { attrs.pace = clampAttr(attrs.pace + 4); attrs.shooting = clampAttr(attrs.shooting + 3); }
      if (pTraits.includes('世界波猎手')) { attrs.shooting = clampAttr(attrs.shooting + 4); }
      if (pTraits.includes('门线战神') && p.role === 'GK') { attrs.goalkeeping = clampAttr(attrs.goalkeeping + 5); }
      if (pTraits.includes('高空霸主')) { attrs.strength = clampAttr(attrs.strength + 5); attrs.shooting = clampAttr(attrs.shooting + 3); }
      if (pTraits.includes('禁区清道夫')) { attrs.defending = clampAttr(attrs.defending + 4); attrs.positioning = clampAttr(attrs.positioning + 3); }
      if (pTraits.includes('传球机器')) { attrs.passing = clampAttr(attrs.passing + 4); attrs.composure = clampAttr(attrs.composure + 3); }
      if (pTraits.includes('铁血硬汉')) { attrs.strength = clampAttr(attrs.strength + 4); attrs.stamina = clampAttr(attrs.stamina + 4); }
      if (pTraits.includes('助攻大师')) { attrs.passing = clampAttr(attrs.passing + 4); attrs.dribbling = clampAttr(attrs.dribbling + 3); }

      // 赛季故事线加成
      if (oppInTop4) {
        attrs.pace = clampAttr(attrs.pace + 4);
        attrs.composure = clampAttr(attrs.composure + 4);
      }
      if (isRevengeMatch) {
        attrs.shooting = clampAttr(attrs.shooting + 5);
        attrs.defending = clampAttr(attrs.defending + 5);
      }
      if (storyline?.id === 'veteran' && p.age >= 28) {
        attrs.passing = clampAttr(attrs.passing + 4);
        attrs.shooting = clampAttr(attrs.shooting + 4);
        attrs.defending = clampAttr(attrs.defending + 4);
        attrs.composure = clampAttr(attrs.composure + 4);
      }

      // 球员士气加成（高昂 +2 传射冷静，低迷 -2）
      if (p.morale === 'high') {
        attrs.passing = clampAttr(attrs.passing + 2);
        attrs.shooting = clampAttr(attrs.shooting + 2);
        attrs.composure = clampAttr(attrs.composure + 2);
      } else if (p.morale === 'low') {
        attrs.passing = clampAttr(attrs.passing - 2);
        attrs.shooting = clampAttr(attrs.shooting - 2);
        attrs.composure = clampAttr(attrs.composure - 2);
      }

      // 赛间整备（玩家谈话、轻训练与抓破绽）对下一场的即时加成
      if (club.isUser && this.state.interMatchPrep?.nextMatchBuff) {
        const buff = this.state.interMatchPrep.nextMatchBuff;
        if (!buff.playerId || buff.playerId === p.id) {
          if (buff.passingBonus) attrs.passing = clampAttr(attrs.passing + buff.passingBonus);
          if (buff.shootingBonus) attrs.shooting = clampAttr(attrs.shooting + buff.shootingBonus);
          if (buff.composureBonus) attrs.composure = clampAttr(attrs.composure + buff.composureBonus);
          if (buff.defendingBonus) attrs.defending = clampAttr(attrs.defending + buff.defendingBonus);
          if (buff.paceBonus) attrs.pace = clampAttr(attrs.pace + buff.paceBonus);
        }
      }

      // L3 静态总加成软上限（+15 以内全额生效，超过部分按 0.5 折算，总增益封顶 +24）
      if (club.isUser) {
        for (const k of Object.keys(attrs) as Array<keyof PlayerAttributes>) {
          const baseVal = p.attributes[k];
          const delta = attrs[k] - baseVal;
          if (delta > 15) {
            const softDelta = Math.min(24, 15 + Math.round((delta - 15) * 0.5));
            attrs[k] = clampAttr(baseVal + softDelta);
          }
        }
      } else {
        // L3 分级 AI 战术素养补正（第 7~6 级 +0，第 5~1 级逐级提升 +2 ~ +10）
        const curTier = this.state.currentTier ?? 7;
        const aiTierBonus = curTier <= 5 ? (6 - curTier) * 2 : 0;
        if (aiTierBonus > 0) {
          attrs.passing = clampAttr(attrs.passing + aiTierBonus);
          attrs.shooting = clampAttr(attrs.shooting + aiTierBonus);
          attrs.defending = clampAttr(attrs.defending + aiTierBonus);
          attrs.positioning = clampAttr(attrs.positioning + aiTierBonus);
          attrs.composure = clampAttr(attrs.composure + aiTierBonus);
          if (p.role === 'GK') attrs.goalkeeping = clampAttr(attrs.goalkeeping + aiTierBonus);
        }

        // 赛前侦查破绽减益（红利 A：针对对手弱点位置/全队削弱对应属性）
        const scoutIntel = this.state.interMatchPrep?.matchupIntel;
        if (
          scoutIntel?.oppClubId === club.id &&
          scoutIntel.spotCorrect &&
          (scoutIntel.chosenRewardKind ?? 'buff_debuff') === 'buff_debuff' &&
          scoutIntel.activeDebuff
        ) {
          const db = scoutIntel.activeDebuff;
          const pLine =
            p.role === 'GK'
              ? 'GK'
              : ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)
              ? 'DEF'
              : ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role)
              ? 'MID'
              : 'ATT';
          if (db.targetLine === 'ALL' || db.targetLine === pLine) {
            if (db.pacePenalty) attrs.pace = clampAttr(attrs.pace - db.pacePenalty);
            if (db.defendingPenalty) attrs.defending = clampAttr(attrs.defending - db.defendingPenalty);
            if (db.composurePenalty) attrs.composure = clampAttr(attrs.composure - db.composurePenalty);
            if (db.goalkeepingPenalty && p.role === 'GK') {
              attrs.goalkeeping = clampAttr(attrs.goalkeeping - db.goalkeepingPenalty);
            }
            if (db.passingPenalty) attrs.passing = clampAttr(attrs.passing - db.passingPenalty);
            if (db.shootingPenalty) attrs.shooting = clampAttr(attrs.shooting - db.shootingPenalty);
          }
        }
      }

      const mergedTraits = p.traits ? [...p.traits] : [];
      const mergedGold = p.goldTraits ? [...p.goldTraits] : [];
      const mergedSilver = p.silverTraits ? [...p.silverTraits] : [];
      for (const tt of p.tempTraits ?? []) {
        if (tt.remainingMatches <= 0) continue;
        if (!mergedTraits.includes(tt.trait)) mergedTraits.push(tt.trait);
        if (tt.tier === 'gold') {
          if (!mergedGold.includes(tt.trait)) mergedGold.push(tt.trait);
        } else if (!mergedSilver.includes(tt.trait) && !mergedGold.includes(tt.trait)) {
          mergedSilver.push(tt.trait);
        }
      }

      return {
        id: p.id,
        name: p.name,
        role: p.role,
        shirtNumber: p.shirtNumber,
        attributes: attrs,
        traits: mergedTraits,
        goldTraits: mergedGold,
        silverTraits: mergedSilver,
        hiddenTrait: p.hiddenTrait,
        fitness: p.fitness,
        strainWarning: p.strainWarning,
        isCaptain: p.id === this.getCaptainId(club),
        formationFamiliarity: club.isUser ? this.getPlayerFamiliarity(p, club.formation) : undefined,
        secondaryRoles: p.secondaryRoles ? [...p.secondaryRoles] : [],
        pa: p.pa,
        isStarred: !!p.isStarred,
      };
    });

    const starterSet = new Set(club.starterIds);
    const subs: PlayerInput[] = club.squad
      .filter(p => !starterSet.has(p.id) && (p.suspendedRounds ?? 0) <= 0 && (p.injuredRounds ?? 0) <= 0)
      .map(p => {
        const sTraits = p.traits ? [...p.traits] : [];
        const sGold = p.goldTraits ? [...p.goldTraits] : [];
        const sSilver = p.silverTraits ? [...p.silverTraits] : [];
        for (const tt of p.tempTraits ?? []) {
          if (tt.remainingMatches <= 0) continue;
          if (!sTraits.includes(tt.trait)) sTraits.push(tt.trait);
          if (tt.tier === 'gold') {
            if (!sGold.includes(tt.trait)) sGold.push(tt.trait);
          } else if (!sSilver.includes(tt.trait) && !sGold.includes(tt.trait)) {
            sSilver.push(tt.trait);
          }
        }
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          shirtNumber: p.shirtNumber,
          attributes: { ...p.attributes },
          traits: sTraits,
          goldTraits: sGold,
          silverTraits: sSilver,
          hiddenTrait: p.hiddenTrait,
          fitness: p.fitness,
          strainWarning: p.strainWarning,
          isCaptain: p.id === this.getCaptainId(club),
          formationFamiliarity: club.isUser ? this.getPlayerFamiliarity(p, club.formation) : undefined,
          secondaryRoles: p.secondaryRoles ? [...p.secondaryRoles] : [],
          pa: p.pa,
          isStarred: !!p.isStarred,
        };
      });

    const v6Payload = club.isUser
      ? compileAstrolabeToMatchSetup(this.getV6Astrolabe(), club.formation, club.style, this.getV6SeasonRogue())
      : null;
    if (v6Payload && v6Payload.lineStatDeltas.length > 0) {
      const lineOf = (r: PlayerInput['role']) =>
        r === 'GK' ? 'GK' : ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) ? 'DEF' : ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(r) ? 'MID' : 'ATT';
      for (const pl of players) {
        for (const sd of v6Payload.lineStatDeltas) {
          if (sd.targetLine && sd.targetLine !== 'ALL' && lineOf(pl.role) !== sd.targetLine) continue;
          if (sd.passing) pl.attributes.passing = clampAttr(pl.attributes.passing + sd.passing);
          if (sd.shooting) pl.attributes.shooting = clampAttr(pl.attributes.shooting + sd.shooting);
          if (sd.defending) pl.attributes.defending = clampAttr(pl.attributes.defending + sd.defending);
          if (sd.pace) pl.attributes.pace = clampAttr(pl.attributes.pace + sd.pace);
          if (sd.composure) pl.attributes.composure = clampAttr(pl.attributes.composure + sd.composure);
          if (sd.goalkeeping && pl.role === 'GK') pl.attributes.goalkeeping = clampAttr(pl.attributes.goalkeeping + sd.goalkeeping);
        }
      }
    }
    const tacticalMods = club.isUser
      ? { ...computeSkillWebMods(this.getSkillWebUnlocked(), club.formation, club.style), ...(v6Payload?.tacticalMods ?? {}) }
      : undefined;

    const curTier = this.state.currentTier ?? 7;
    const aiTierLv = !club.isUser && curTier <= 4 ? 5 - curTier : 0;
    const aiSquadAvgCA = club.squad.length > 0 ? club.squad.reduce((s, p) => s + p.ca, 0) / club.squad.length : 60;
    const aiIsContender = aiTierLv > 0 && aiSquadAvgCA >= getLeagueTierInfo(curTier).baseCA + 7;

    if (aiTierLv > 0) {
      // 隐藏对阵增幅（仅作用于 MatchEngine 计算，不改写 club.squad，UI 面板不可见且可突破 99 上限）
      const hiddenCap = 118;
      const clampHidden = (v: number) => Math.max(25, Math.min(hiddenCap, v));
      const hiddenBonus = aiTierLv * 2 + (aiIsContender ? (aiTierLv >= 4 ? 3 : aiTierLv >= 3 ? 2 : 1) : 0);
      for (const pl of players) {
        if (pl.role === 'GK') {
          pl.attributes.goalkeeping = clampHidden(pl.attributes.goalkeeping + hiddenBonus);
          pl.attributes.composure = clampHidden(pl.attributes.composure + Math.ceil(hiddenBonus * 0.8));
          pl.attributes.positioning = clampHidden(pl.attributes.positioning + Math.ceil(hiddenBonus * 0.8));
        } else {
          pl.attributes.passing = clampHidden(pl.attributes.passing + hiddenBonus);
          pl.attributes.shooting = clampHidden(pl.attributes.shooting + hiddenBonus);
          pl.attributes.dribbling = clampHidden(pl.attributes.dribbling + hiddenBonus);
          pl.attributes.pace = clampHidden(pl.attributes.pace + hiddenBonus);
          pl.attributes.defending = clampHidden(pl.attributes.defending + hiddenBonus);
          pl.attributes.positioning = clampHidden(pl.attributes.positioning + hiddenBonus);
          pl.attributes.composure = clampHidden(pl.attributes.composure + hiddenBonus);
          pl.attributes.strength = clampHidden(pl.attributes.strength + Math.ceil(hiddenBonus * 0.7));
        }
      }
    }

    const aiSegmentCards: TeamSetup['aiSegmentCards'] = [];
    if (aiTierLv > 0) {
      const styleDirs = Object.values(V6_DIRECTIVE_MAP).filter(
        d => d.source === 'style' && d.style === club.style && d.route === 'steady'
      );
      if (styleDirs.length > 0) {
        const cardCount = aiTierLv + (aiIsContender ? 2 : 0);
        const mins = [2, 24, 48, 72, 12, 60].slice(0, cardCount).sort((a, b) => a - b);
        for (let i = 0; i < mins.length; i++) {
          const dirDef = styleDirs[i % styleDirs.length];
          aiSegmentCards.push({
            minute: mins[i],
            effect: {
              id: `ai_${dirDef.id}_${i}`,
              name: dirDef.name,
              durationMinutes: dirDef.durationMinutes,
              ...dirDef.baseEffect,
            },
          });
        }
      }
    }

    const spineBonus = club.isUser
      ? computeCentralSpineInfo(club, this.getChemistryLinks()).bonus
      : aiTierLv >= 4 ? 3 : aiTierLv >= 2 ? 2 : aiTierLv >= 1 ? 1 : 0;
    let teamFamAvg = aiTierLv > 0 ? Math.min(95, 62 + aiTierLv * 6 + (aiIsContender ? 4 : 0)) : 50;
    let teamChemAvg = aiTierLv > 0 ? Math.min(90, 44 + aiTierLv * 8 + (aiIsContender ? 6 : 0)) : 30;
    if (club.isUser) {
      teamFamAvg = players.length > 0
        ? Math.round(players.reduce((s, pl) => s + (pl.formationFamiliarity ?? 40), 0) / players.length)
        : 40;
      const chemSummary = this.getTacticsChemistrySummary();
      teamChemAvg = chemSummary.specs.length > 0
        ? Math.round(chemSummary.specs.reduce((s, sp) => s + sp.link.score, 0) / chemSummary.specs.length)
        : 30;
    }

    let userEquippedSkills = club.isUser
      ? (v6Payload && v6Payload.equippedSkills.length > 0 ? v6Payload.equippedSkills : this.getEquippedActiveSkills())
      : undefined;
    if (
      club.isUser &&
      userEquippedSkills &&
      userEquippedSkills.length > 0 &&
      this.state.interMatchPrep?.matchupIntel?.spotCorrect &&
      this.state.interMatchPrep.matchupIntel.chosenRewardKind === 'skill_overclock'
    ) {
      const counterStyles = this.state.interMatchPrep.matchupIntel.counterStyles ?? [];
      let matchedAny = false;
      userEquippedSkills = userEquippedSkills.map(sk => {
        if (sk.styleTag && counterStyles.includes(sk.styleTag)) {
          matchedAny = true;
          return {
            ...sk,
            effectiveRank: Math.min(5, (sk.effectiveRank ?? 1) + 1),
            firstTriggerFreeCd: true,
            scoutOverclocked: true,
          };
        }
        return sk;
      });
      if (!matchedAny) {
        userEquippedSkills[0] = {
          ...userEquippedSkills[0],
          effectiveRank: Math.min(5, (userEquippedSkills[0].effectiveRank ?? 1) + 1),
          firstTriggerFreeCd: true,
          scoutOverclocked: true,
        };
      }
    }

    return {
      name: club.name,
      formation: club.formation,
      style: club.style,
      players,
      subs,
      tacticalMods,
      centralSpineBonus: spineBonus,
      equippedSkills: userEquippedSkills,
      activeAspects: club.isUser ? this.getActiveLegendaryAspects() : undefined,
      perkSynergies: club.isUser ? this.getUserPerkSynergyFlags() : undefined,
      teamFamiliarityAvg: club.isUser || aiTierLv > 0 ? teamFamAvg : undefined,
      teamChemistryAvg: club.isUser || aiTierLv > 0 ? teamChemAvg : undefined,
      scoutCounterLabel:
        club.isUser && this.state.interMatchPrep?.matchupIntel?.spotCorrect
          ? '破绽压制'
          : undefined,
      gridSlots: club.gridSlots,
      slotDuties: club.slotDuties,
      weather: this.state.interMatchPrep?.weather ?? 'sunny',
      deckArchetypeGene: club.isUser ? computeDeckArchetypeGene(this.getActiveMatchDeck()) : undefined,
      v6PassiveHooks: v6Payload?.v6PassiveHooks,
      v6ImmunityFlags: v6Payload?.v6ImmunityFlags,
      v6TotalFootballMaster: v6Payload?.v6TotalFootballMaster,
      v6SkillTempRankBonus: v6Payload?.v6SkillTempRankBonus,
      v6SkillDualBranch: v6Payload?.v6SkillDualBranch,
      v6StartingShields: v6Payload?.v6StartingShields ?? (aiTierLv >= 3 ? 1 : undefined),
      v6MaxCounterStacks: v6Payload?.v6MaxCounterStacks,
      aiSegmentCards: aiSegmentCards.length > 0 ? aiSegmentCards : undefined,
      hiddenAttrCap: aiTierLv > 0 ? 118 : undefined,
    };
  }

  /**
   * 为玩家本轮比赛实例化一个全新的纯 2D 实时 MatchEngine
   */
  public createUserMatchEngine(): MatchEngine {
    const fixture = this.getUserCurrentFixture();
    if (!fixture) throw new Error('当前轮次没有待进行的玩家比赛');
    const home = this.state.clubs.find(c => c.id === fixture.homeClubId)!;
    const away = this.state.clubs.find(c => c.id === fixture.awayClubId)!;
    return new MatchEngine(this.buildTeamSetup(home, away.id), this.buildTeamSetup(away, home.id));
  }

  /**
   * 序章第二幕：创建 45 分钟下半场 0:3 落后开局、通过战术卡连追两球至 2:3，随后老队长 #10 替补登场两度触发主动技完成 4:3 绝杀夺冠的剧本比赛引擎
   */
  public createPrologueMatchEngine(): MatchEngine {
    const roles11: Array<PlayerInput['role']> = ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
    const makeAttrs = (base: number): PlayerAttributes => ({
      passing: base, shooting: base, dribbling: base, pace: base, strength: base,
      defending: base, positioning: base, composure: base, stamina: 76, goalkeeping: base,
    });
    const homePlayers: PlayerInput[] = roles11.map((role, idx) => {
      const isSt = role === 'ST';
      const numMap = [1, 2, 4, 5, 3, 6, 8, 18, 11, 7, 19];
      return {
        id: isSt ? 'prologue_st_19' : `prologue_h_${idx}`,
        name: isSt ? '陈小宇' : `曙光${idx + 1}号`,
        role,
        shirtNumber: numMap[idx] ?? idx + 2,
        attributes: isSt
          ? { passing: 72, shooting: 76, dribbling: 74, pace: 78, strength: 70, defending: 40, positioning: 75, composure: 74, stamina: 72, goalkeeping: 20 }
          : makeAttrs(72),
        traits: ['节拍器'],
        goldTraits: [],
        silverTraits: ['节拍器'],
        fitness: 72,
        isCaptain: false,
      };
    });
    const veteranSub: PlayerInput = {
      id: 'prologue_vet_10',
      name: '梅利纳(老队长)',
      role: 'ST',
      shirtNumber: 10,
      attributes: { passing: 82, shooting: 90, dribbling: 82, pace: 68, strength: 78, defending: 42, positioning: 88, composure: 94, stamina: 76, goalkeeping: 20 },
      traits: ['远射重炮', '大赛先生'],
      goldTraits: ['远射重炮'],
      silverTraits: ['大赛先生'],
      fitness: 82,
      isCaptain: true,
    };
    const awayPlayers: PlayerInput[] = roles11.map((role, idx) => ({
      id: `prologue_a_${idx}`,
      name: `宿敌${idx + 1}号`,
      role,
      shirtNumber: idx + 1,
      attributes: makeAttrs(role === 'GK' ? 66 : 70),
      traits: [],
      fitness: 72,
    }));
    const homeSetup: TeamSetup = {
      name: '曙光竞技',
      formation: '4-2-3-1',
      style: 'tiki_taka',
      players: homePlayers,
      subs: [veteranSub],
      prologueScripted: true,
      weather: 'rain',
      equippedSkills: [
        {
          id: 'sk_prologue_longshot',
          name: '落叶重炮 · 最后一舞',
          situation: 'trailing_late',
          situationLabel: '弧顶重炮空当',
          powerLabel: '老将绝杀 · 必中死角',
          minFamiliarity: 0,
          minChemistry: 0,
          cooldownMinutes: 0,
          maxPerMatch: 2,
          durationMinutes: 10,
          instantAction: 'force_shot_on_target',
          instantLabel: '梅利纳弧顶起脚轰出世界波',
          vfxTheme: 'ult',
          effectiveRank: 3,
          effect: {
            id: 'sk_prologue_longshot',
            name: '落叶重炮 · 最后一舞',
            durationMinutes: 10,
            targetLine: 'ALL',
            shootingDelta: 15,
            paceDelta: 8,
          },
        },
      ],
    };
    const awaySetup: TeamSetup = {
      name: '铁幕联',
      formation: '4-4-2',
      style: 'park_bus',
      players: awayPlayers,
      subs: [],
      weather: 'rain',
    };
    return new MatchEngine(homeSetup, awaySetup);
  }

  /**
   * 快捷模拟玩家本轮比赛并推进赛程（适用于 34 轮长赛季快速推进）
   */
  public simulateUserRound(): { ok: boolean; reason?: string; userGoals?: number; oppGoals?: number; oppName?: string } {
    const fx = this.getUserCurrentFixture();
    if (!fx) return { ok: false, reason: '当前轮次没有待进行的比赛' };
    const engine = this.createUserMatchEngine();
    const res = engine.simulateMatch();
    this.completeCurrentRoundWithUserResult(res);
    const isHome = fx.homeClubId === this.state.userClubId;
    const oppId = isHome ? fx.awayClubId : fx.homeClubId;
    const oppName = this.state.clubs.find(c => c.id === oppId)?.name ?? '对手';
    return {
      ok: true,
      userGoals: isHome ? fx.homeGoals : fx.awayGoals,
      oppGoals: isHome ? fx.awayGoals : fx.homeGoals,
      oppName,
    };
  }

  /**
   * 连续快速模拟多轮（遇到 Re-Draft、剧情抉择或赛季结束时自动停止）
   */
  public simulateMultipleRounds(count = 5): { simulated: number; stoppedReason?: string } {
    let simulated = 0;
    for (let i = 0; i < count; i++) {
      if (this.state.phase !== 'REGULAR_SEASON' || this.state.pendingStoryEvent) {
        break;
      }
      const res = this.simulateUserRound();
      if (!res.ok) break;
      simulated++;
      const nextPhase = this.state.phase as string;
      if (nextPhase !== 'REGULAR_SEASON' || this.state.pendingStoryEvent) {
        return {
          simulated,
          stoppedReason:
            nextPhase === 'RE_DRAFT' ? '触发赛季中期 Re-Draft 补强' :
            nextPhase === 'SEASON_END' ? '常规赛全部结束，进入赛季结算' :
            '触发赛季剧情抉择事件',
        };
      }
    }
    return { simulated };
  }

  /**
   * 提交玩家本轮比赛结果，同步模拟同轮其他 AI 比赛并推进赛程
   */
  public completeCurrentRoundWithUserResult(userMatchResult: MatchState): void {
    const userFixture = this.getUserCurrentFixture();
    if (!userFixture) return;

    const rankBefore = this.getStandings().findIndex(r => r.isUser) + 1;
    this.applyMatchOutcome(userFixture, userMatchResult);

    // 模拟本轮其余场次（包括 AI 对阵）
    const pendingInRound = this.state.fixtures.filter(
      f => f.round === this.state.currentRound && !f.played
    );
    const aiMatchFitness = new Map<string, number>();
    for (const fx of pendingInRound) {
      const h = this.state.clubs.find(c => c.id === fx.homeClubId)!;
      const a = this.state.clubs.find(c => c.id === fx.awayClubId)!;
      const engine = new MatchEngine(this.buildTeamSetup(h, a.id), this.buildTeamSetup(a, h.id));
      const res = engine.simulateMatch();
      for (const mp of [...res.players, ...(res.subbedOutPlayers ?? [])]) aiMatchFitness.set(mp.id, mp.fitness);
      this.applyMatchOutcome(fx, res);
    }


    // 赛后体能恢复、体能疲惫/轻伤判定与士气浮动（玩家与 AI 采用对称体能规则）
    const userSquadIds = new Set(this.getUserClub().squad.map(p => p.id));
    const userEndFitness = new Map<string, number>();
    for (const mp of [...userMatchResult.players, ...(userMatchResult.subbedOutPlayers ?? [])]) {
      if (userSquadIds.has(mp.id)) {
        userEndFitness.set(mp.id, mp.fitness);
      } else {
        aiMatchFitness.set(mp.id, mp.fitness);
      }
    }
    const userIsHome = userFixture.homeClubId === this.state.userClubId;
    const myGoals = userIsHome ? userFixture.homeGoals : userFixture.awayGoals;
    const oppGoals = userIsHome ? userFixture.awayGoals : userFixture.homeGoals;
    const userWon = myGoals > oppGoals;
    const fitLv = this.getMetaLevels().medical ?? 0;
    const userPerks = this.getUserClub().perks ?? [];
    const perkRecovery = userPerks.reduce((s, pk) => s + (pk.effect.fitnessRecoveryBonus ?? 0), 0);
    const perkElemDrops = userPerks.reduce((s, pk) => s + (pk.effect.elementDropBonus ?? 0), 0);
    const perkYouthGrowth = userPerks.reduce((s, pk) => s + (pk.effect.youthGrowthBonus ?? 0), 0);
    const activeRecover = 20 + fitLv * 3 + perkRecovery;
    const restRecover = 46 + fitLv * 5 + perkRecovery;
    for (const c of this.state.clubs) {
      for (const p of c.squad) {
        if ((p.injuredRounds ?? 0) > 0) {
          p.injuredRounds = Math.max(0, (p.injuredRounds ?? 0) - 1);
        }
        if (c.isUser) {
          const endFit = userEndFitness.get(p.id);
          if (endFit !== undefined) {
            const hadStrain = !!p.strainWarning;
            p.fitness = Math.min(100, Math.round(endFit + activeRecover));
            if (hadStrain && endFit < 56 && Math.random() < 0.45) {
              p.injuredRounds = 1;
              p.careerInjuries = (p.careerInjuries ?? 0) + 1;
              if (p.careerInjuries >= 3) {
                p.attributes.pace = Math.max(30, p.attributes.pace - 1);
              }
              p.strainWarning = false;
              p.morale = 'low';
            } else {
              p.strainWarning = p.fitness < 68;
            }
            if (userWon) {
              p.morale = p.morale === 'low' ? 'normal' : Math.random() < 0.45 ? 'high' : (p.morale ?? 'normal');
            } else if (myGoals < oppGoals && Math.random() < 0.35) {
              p.morale = p.morale === 'high' ? 'normal' : 'low';
            }
          } else {
            p.fitness = Math.min(100, Math.round((p.fitness ?? 100) + restRecover));
            p.strainWarning = false;
          }
        } else {
          const aiEnd = aiMatchFitness.get(p.id);
          if (aiEnd !== undefined) {
            const hadStrain = !!p.strainWarning;
            p.fitness = Math.min(100, Math.round(aiEnd + 17));
            if (hadStrain && aiEnd < 56 && Math.random() < 0.40) {
              p.injuredRounds = 1;
              p.strainWarning = false;
            } else {
              p.strainWarning = p.fitness < 68;
            }
          } else {
            p.fitness = Math.min(100, Math.round((p.fitness ?? 100) + 36));
            p.strainWarning = false;
          }
        }
      }
      if (!c.isUser) {
        const tiredIds = new Set(
          c.squad.filter(p => p.strainWarning || (p.fitness ?? 100) < 74).map(p => p.id)
        );
        this.replaceUnavailableStarters(c, tiredIds);
      }
    }
    const oppClubId = userIsHome ? userFixture.awayClubId : userFixture.homeClubId;
    updateOpponentIntelAfterMatch(this.state, oppClubId, myGoals, oppGoals);
    const userClubTmp = this.getUserClub();
    this.replaceUnavailableStarters(userClubTmp);
    const scoutedCorrect = !!this.state.interMatchPrep?.matchupIntel?.spotCorrect;
    this.state.lastMatchReview = generatePostMatchReview(userMatchResult, userClubTmp.name, { scoutedCorrect });
    const hof = this.getHallOfFame();
    hof.totalGoals += myGoals;
    if (userWon) {
      hof.totalWins += 1;
      tryUnlockAchievement(this.state, 'ach_first_win');
      if (oppGoals === 0) tryUnlockAchievement(this.state, 'ach_clean_sheet');
      if (myGoals - oppGoals >= 4) tryUnlockAchievement(this.state, 'ach_big_win');
      if (this.getMatchLoadout().some(c => c.isCorrupted)) {
        tryUnlockAchievement(this.state, 'ach_corrupted_win');
      }
      let runH = 0;
      let runA = 0;
      let trailed = false;
      for (const ev of userMatchResult.events || []) {
        if (ev.type !== 'goal') continue;
        if (ev.team === 'home') runH++;
        else runA++;
        if ((userIsHome && runH < runA) || (!userIsHome && runA < runH)) {
          trailed = true;
        }
      }
      if (trailed) tryUnlockAchievement(this.state, 'ach_comeback_win');
      const playedUserFx = this.state.fixtures
        .filter(f => f.played && (f.homeClubId === this.state.userClubId || f.awayClubId === this.state.userClubId))
        .sort((a, b) => a.round - b.round);
      let streak = 0;
      for (let i = playedUserFx.length - 1; i >= 0; i--) {
        const fx = playedUserFx[i];
        const uh = fx.homeClubId === this.state.userClubId;
        const wonFx = uh ? fx.homeGoals > fx.awayGoals : fx.awayGoals > fx.homeGoals;
        if (wonFx) streak++;
        else break;
      }
      if (streak >= 5) tryUnlockAchievement(this.state, 'ach_win_streak_5');
    }
    const userSide = userIsHome ? 'home' : 'away';
    if (userMatchResult.players.some(p => p.team === userSide && p.matchStats.goals >= 3)) {
      tryUnlockAchievement(this.state, 'ach_hattrick');
    }
    if ((userMatchResult.unlockedHiddenTraits || []).some(u => u.team === userSide)) {
      tryUnlockAchievement(this.state, 'ach_hidden_trait');
    }
    // V5 赛后保底卡牌掉落：胜场 +2 张 1 阶消耗卡，平/负 +1 张（叠加词条额外掉落）
    const drops = (userWon ? 2 : 1) + perkElemDrops;
    const deckNow = this.getCoachDeck();
    const activePreset = this.getDeckPresets()[this.getActiveDeckPresetIdx()];
    const styleForDrop = this.getUserClub().style;
    for (let i = 0; i < drops; i++) {
      if (deckNow.length < 60) {
        const dropped = rollStyleConsumableCard(styleForDrop, 1);
        deckNow.push(dropped);
        if (activePreset && activePreset.cardIds.length < 6) {
          activePreset.cardIds.push(dropped.id);
        }
      } else {
        this.addClubFunds(20);
      }
    }

    // 积累当前阵型与战术风格熟练度经验（胜场+2，平负+1；战术幕僚Lv.5翻倍）
    const userClubNow = this.getUserClub();
    const mastery = this.getTacticalMastery();
    const tgLv = this.getMetaLevels().training_ground ?? 0;
    const xpMul = tgLv >= 5 ? 2 : 1;
    const xpGain = (userWon ? 2 : 1) * xpMul;
    mastery.formations[userClubNow.formation] = Math.min(15, (mastery.formations[userClubNow.formation] ?? 0) + xpGain);
    mastery.styles[userClubNow.style] = Math.min(15, (mastery.styles[userClubNow.style] ?? 0) + xpGain);

    // 赛后俱乐部资金入账（门票 + 胜平基础奖金 + 球场主场加成 + 财政加成）
    const metaNow = this.getMetaLevels();
    const tierNow = this.state.currentTier ?? 7;
    const tierFundScale = 1 + (7 - tierNow) * 0.12;
    const baseMatchFunds = userWon ? 60 : myGoals === oppGoals ? 35 : 20;
    const stadBonusRates = [0, 0.2, 0.35, 0.5, 0.5, 0.7, 0.85, 1.0, 1.2];
    const finBonusRates = [0, 0.15, 0.25, 0.35, 0.35, 0.35, 0.35, 0.5, 0.6];
    const homeMul = userIsHome ? 1 + (stadBonusRates[metaNow.stadium ?? 0] ?? 0) : 1;
    const finMul = 1 + (finBonusRates[metaNow.finance ?? 0] ?? 0);
    const fundsEarned = Math.round(baseMatchFunds * tierFundScale * homeMul * finMul);
    this.addClubFunds(fundsEarned);
    // V6 Meta 永久星盘点稳定产出（胜 +2pt / 平 +1pt / 负 0pt，拉长星盘成型曲线）
    const v6MetaGain = userWon ? 2 : myGoals === oppGoals ? 1 : 0;
    this.state.metaPointsTotal += v6MetaGain;
    const rankAfter = this.getStandings().findIndex(r => r.isUser) + 1;
    this.lastMatchSummary = {
      roundNumber: userFixture.round,
      fundsEarned,
      metaGain: v6MetaGain,
      rankBefore: rankBefore > 0 ? rankBefore : rankAfter,
      rankAfter,
      totalTeams: this.state.clubs.length,
    };

    // 慢热成长：个人阵型熟练度 + 随比赛进度逐场积累属性成长（受赛季总上限约束，防止低级联赛超模）
    this.lastMatchGrowth = {};
    const unlockedTraitMap = new Map<string, string>();
    for (const u of userMatchResult.unlockedHiddenTraits || []) {
      if (u.team === userSide) unlockedTraitMap.set(u.playerId, u.trait);
    }
    const matchStatsByPlayer = new Map(
      [...userMatchResult.players, ...(userMatchResult.subbedOutPlayers ?? [])]
        .filter(mp => mp.team === userSide)
        .map(mp => [mp.id, mp.matchStats])
    );
    const webUnlocked = this.getSkillWebUnlocked();
    const hasFormNode = webUnlocked.includes(`fm_${userClubNow.formation}`);
    const famMul = tgLv >= 5 ? 1.5 : 1;
    const rosterMapForGrowth = this.state.clubRoster
      ? new Map(this.state.clubRoster.map(r => [r.id, r]))
      : null;
    for (const p of userClubNow.squad) {
      const curFam = this.getPlayerFamiliarity(p, userClubNow.formation);
      const isStarter = userEndFitness.has(p.id);
      const youthExtra = p.age <= 23 ? perkYouthGrowth : 0;
      const baseAdd = (isStarter ? (3 + (hasFormNode ? 2 : 0)) : 1) + youthExtra;
      const gain = Math.round(baseAdd * famMul);
      p.formationFamiliarity = p.formationFamiliarity ?? {};
      const nextFam = Math.min(100, curFam + gain);
      p.formationFamiliarity[userClubNow.formation] = nextFam;

      let caGainThisMatch = 0;
      const pa = p.pa ?? computeInitialPA(p.ca, p.age ?? 24, (p.age ?? 24) <= 19);
      p.pa = pa;
      if (isStarter && p.ca < pa && (p.age ?? 24) <= 28) {
        const pst = p.seasonStats;
        const goodSeasonPerf = pst.goals >= 8 || pst.assists >= 6 || pst.cleanSheets >= 8;
        const seasonCap = this.computeSeasonTargetAttrGain(p, p.age ?? 24, goodSeasonPerf, tgLv);
        const gainedSoFar = p.seasonAttrGained ?? 0;
        if (gainedSoFar < seasonCap) {
          const mStats = matchStatsByPlayer.get(p.id);
          const matchHighlight = !!mStats && (mStats.goals > 0 || mStats.assists > 0 || (p.role === 'GK' && oppGoals === 0));
          const ageBaseXp = (p.age ?? 24) < 18 ? 18 : (p.age ?? 24) <= 23 ? 32 : 15;
          const storyXp = this.state.storyline?.id === 'wonderkid' && (p.age ?? 24) <= 23 ? 10 : 0;
          const roundPaceMul = 34 / Math.max(10, this.getTotalRegularRounds());
          const xpAdd = Math.round((ageBaseXp + (matchHighlight ? 12 : 0) + Math.round(tgLv * 1.5) + storyXp) * roundPaceMul);
          p.seasonGrowthXp = (p.seasonGrowthXp ?? 0) + xpAdd;
          while (p.seasonGrowthXp >= 100 && (p.seasonAttrGained ?? 0) < seasonCap && p.ca < pa) {
            p.seasonGrowthXp -= 100;
            const beforeCa = p.ca;
            for (const k of this.getRoleWeightedKeys(p.role)) {
              p.attributes[k] = Math.min(99, p.attributes[k] + 1);
            }
            p.ca = Math.min(pa, computeWeightedCA(p.role, p.attributes));
            p.marketValue = calcTransferValue(p);
            p.seasonAttrGained = (p.seasonAttrGained ?? 0) + 1;
            caGainThisMatch += Math.max(0, p.ca - beforeCa);
          }
        }
      }
      if (rosterMapForGrowth) {
        const rp = rosterMapForGrowth.get(p.id);
        if (rp) {
          rp.attributes = { ...p.attributes };
          rp.ca = p.ca;
          rp.marketValue = p.marketValue;
          rp.seasonGrowthXp = p.seasonGrowthXp;
          rp.seasonAttrGained = p.seasonAttrGained;
        }
      }

      this.lastMatchGrowth[p.id] = {
        famGain: Math.max(0, nextFam - curFam),
        chemGain: 0,
        caGain: caGainThisMatch > 0 ? caGainThisMatch : undefined,
        unlockedTrait: unlockedTraitMap.get(p.id),
      };
    }

    // 搭档默契度成长：并肩首发 + 比赛真实传球连线 + 助攻破门
    const links = this.getChemistryLinks();
    const capId = this.getCaptainId(userClubNow);
    const starterList = userClubNow.starterIds
      .map(id => userClubNow.squad.find(p => p.id === id))
      .filter((p): p is DraftPlayer => !!p);
    const pairPasses = userMatchResult.pairPasses ?? {};
    const pairAssists = userMatchResult.pairAssists ?? {};
    const bestPartnerDelta = new Map<string, { name: string; score: number }>();
    for (let i = 0; i < starterList.length; i++) {
      for (let j = i + 1; j < starterList.length; j++) {
        const a = starterList[i];
        const b = starterList[j];
        const lk = getOrCreateChemistryLink(links, a, b);
        const k = pairKey(a.id, b.id);
        const mPasses = pairPasses[k] ?? 0;
        const mAssists = pairAssists[k] ?? 0;
        lk.matches += 1;
        lk.passes += mPasses;
        lk.assists += mAssists;
        const capBonus = (a.id === capId || b.id === capId) ? 1.5 : 1;
        const delta = 1.5 * capBonus + Math.floor(mPasses / 8) + mAssists * 4;
        const prevScore = lk.score;
        lk.score = Math.min(100, Math.round((lk.score + delta) * 10) / 10);
        const actualDelta = Math.max(0, lk.score - prevScore);
        if (this.lastMatchGrowth[a.id]) this.lastMatchGrowth[a.id].chemGain += actualDelta;
        if (this.lastMatchGrowth[b.id]) this.lastMatchGrowth[b.id].chemGain += actualDelta;
        const pairWeight = mPasses + mAssists * 10 + actualDelta;
        const prevA = bestPartnerDelta.get(a.id);
        if (!prevA || pairWeight > prevA.score) bestPartnerDelta.set(a.id, { name: b.name, score: pairWeight });
        const prevB = bestPartnerDelta.get(b.id);
        if (!prevB || pairWeight > prevB.score) bestPartnerDelta.set(b.id, { name: a.name, score: pairWeight });
        if (lk.score >= 85 || lk.assists >= 3) {
          lk.title = '黄金连线';
        }
      }
    }
    for (const p of starterList) {
      const g = this.lastMatchGrowth[p.id];
      if (g) {
        g.chemGain = Math.round(g.chemGain * 10) / 10;
        g.bestPartner = bestPartnerDelta.get(p.id)?.name;
        g.isCaptain = p.id === capId;
      }
    }

    this.state.winlessStreak = userWon ? 0 : (this.state.winlessStreak ?? 0) + 1;
    if (userWon && myGoals - oppGoals >= 3) {
      const hero = userMatchResult.players
        .filter(p => p.team === userSide && p.matchStats.goals > 0)
        .sort((a, b) => b.matchStats.goals - a.matchStats.goals)[0];
      recordChronicleMoment(
        this.state,
        'pyramid_climb',
        `S${this.state.seasonNumber} 第${this.state.currentRound}轮 ${myGoals}:${oppGoals} 大胜${hero ? ` (${hero.name} 建功)` : ''}`
      );
    }
    if (userWon && oppGoals === 0 && (this.state.winlessStreak ?? 0) === 0) {
      recordChronicleMoment(
        this.state,
        'relegation_fight',
        `S${this.state.seasonNumber} 第${this.state.currentRound}轮 ${myGoals}:${oppGoals} 关键零封抢分`
      );
    }

    for (const p of userClubNow.squad) {
      if (p.tempTraits && p.tempTraits.length > 0) {
        p.tempTraits = p.tempTraits
          .map(t => ({ ...t, remainingMatches: t.remainingMatches - 1 }))
          .filter(t => t.remainingMatches > 0);
      }
    }

    this.captureSeasonMemory(userFixture, userMatchResult, userClubNow);

    const completedRound = this.state.currentRound;
    this.advanceAfterRound();
    if (this.state.phase !== 'SEASON_END') {
      this.state.interMatchPrep = createInterMatchPrep(this.state, userClubNow);
      this.state.pendingPostMatchReward = this.createPostMatchRewardState(userWon, completedRound);
      if (this.state.phase === 'REGULAR_SEASON' && !this.state.pendingStoryEvent) {
        const chrEvent = evaluateChronicleTrigger(this.state, userClubNow, this.getStandings());
        if (chrEvent) this.state.pendingStoryEvent = chrEvent;
      }
    } else {
      this.state.pendingPostMatchReward = null;
      this.state.interMatchPrep = null;
    }
  }

  public claimTutorialCardUnlock(): boolean {
    const rw = this.state.pendingPostMatchReward;
    const tc = rw?.tutorialCardUnlock;
    if (!tc || tc.claimed) return false;

    const club = this.getUserClub();
    const deck = this.getCoachDeck();
    if (!deck.some(c => c.id === tc.card.id)) {
      deck.push(tc.card);
    }
    const presets = this.getDeckPresets();
    const activePr = presets[this.getActiveDeckPresetIdx()] ?? presets[0];
    if (activePr) {
      if (!activePr.cardIds.includes(tc.card.id)) {
        activePr.cardIds.unshift(tc.card.id);
      }
      const base0 = getStyleBaseCards(club.style)[0]?.id;
      if (base0) {
        const prevOrd = activePr.orderedKeys?.filter(k => k !== tc.card.id) ?? [];
        const bIdx = prevOrd.indexOf(base0);
        if (bIdx >= 0) {
          prevOrd.splice(bIdx + 1, 0, tc.card.id);
          activePr.orderedKeys = prevOrd;
        }
      }
    }
    tc.claimed = true;
    return true;
  }

  private createPostMatchRewardState(won: boolean, completedRound = this.state.currentRound): PostMatchRewardState {
    const cadence = getRoundCadence(completedRound, this.state.winlessStreak ?? 0);
    const picked = this.rollPostMatchCategories(won, cadence, completedRound);
    this.state.recentRewardCategories = picked;

    return {
      round: completedRound,
      won,
      cadence,
      rerollsLeft: 1,
      categories: picked,
      chosenCategory: null,
      options: [],
      pendingStatOptionId: null,
      completed: false,
    };
  }

  private rollPostMatchCategories(
    won: boolean,
    cadence: 'normal' | 'focus' | 'crisis',
    round = this.state.currentRound
  ): PostMatchRewardCategory[] {
    const pool: PostMatchRewardCategory[] = cadence === 'normal'
      ? ['craft_card', 'event', 'trait_forge', 'gamble', 'chemistry_forge']
      : ['craft_card', 'player', 'stat_boost', 'line_boost', 'event', 'trait_forge', 'tactical_pact', 'chemistry_forge', 'gamble'];
    const club = this.getUserClub();
    const recent = new Set(this.state.recentRewardCategories ?? []);
    const tiredCount = club.squad.filter(p => (p.fitness ?? 100) < 72).length;
    const rogue = this.getV6SeasonRogue();

    const scored = pool.map(cat => {
      let weight = recent.has(cat) ? 0.55 : 1.5;
      if (cat === 'craft_card') weight += round <= 3 ? 2.4 : rogue.seasonRelics.length < 3 ? 0.85 : 0.45;
      if (!won && (cat === 'tactical_pact' || cat === 'trait_forge' || cat === 'player' || cat === 'gamble')) weight += 0.55;
      if (tiredCount >= 3 && (cat === 'event' || cat === 'tactical_pact' || cat === 'gamble')) weight += 0.5;
      if (cat === 'chemistry_forge') weight += 0.35;
      if ((round % 3 === 0) && cat === 'trait_forge') weight += 0.4;
      return { cat, score: weight * (0.65 + Math.random() * 0.7) };
    });
    scored.sort((a, b) => b.score - a.score);

    if (this.getReDraftRounds().has(round)) {
      const other = scored.find(s => s.cat !== 'gamble' && s.cat !== 'season_perk')?.cat ?? 'player';
      const res: PostMatchRewardCategory[] = ['season_perk', 'gamble', other];
      for (let i = res.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [res[i], res[j]] = [res[j], res[i]];
      }
      return res;
    }

    if (cadence !== 'normal') {
      const others = scored.filter(s => s.cat !== 'gamble').slice(0, 2).map(s => s.cat);
      const res: PostMatchRewardCategory[] = [...others, 'gamble'];
      for (let i = res.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [res[i], res[j]] = [res[j], res[i]];
      }
      return res;
    }
    return scored.slice(0, 3).map(s => s.cat);
  }

  public rerollPostMatchReward(): { ok: boolean; costLabel?: string; reason?: string } {
    const rw = this.state.pendingPostMatchReward;
    if (!rw || rw.completed) return { ok: false, reason: '当前没有可重抽的赛后奖励' };
    if (rw.pendingStatOptionId) return { ok: false, reason: '请先完成当前球员指定' };
    if ((rw.rerollsLeft ?? 0) <= 0) return { ok: false, reason: '本轮重抽次数已用完' };

    let costLabel = '';
    if (this.state.interMatchPrep && this.state.interMatchPrep.actionsLeft > 0) {
      this.state.interMatchPrep.actionsLeft -= 1;
      costLabel = '消耗 1 备战点';
    } else if (this.state.metaPointsTotal >= 8) {
      this.state.metaPointsTotal -= 8;
      costLabel = '消耗 8 Meta';
    } else {
      return { ok: false, reason: '需要 1 备战点或 8 Meta 方可重抽' };
    }

    rw.rerollsLeft = (rw.rerollsLeft ?? 1) - 1;
    if (!rw.chosenCategory) {
      const cadence = rw.cadence ?? getRoundCadence(rw.round, this.state.winlessStreak ?? 0);
      const picked = this.rollPostMatchCategories(rw.won, cadence, rw.round);
      rw.categories = picked;
      this.state.recentRewardCategories = picked;
      return { ok: true, costLabel };
    }
    this.pickPostMatchRewardCategory(rw.chosenCategory);
    return { ok: true, costLabel };
  }

  public pickPostMatchRewardCategory(cat: PostMatchRewardCategory): { ok: boolean; reason?: string } {
    const rw = this.state.pendingPostMatchReward;
    if (!rw || rw.completed) return { ok: false, reason: '当前没有待领取的赛后奖励' };
    if (!rw.categories.includes(cat)) return { ok: false, reason: '无效的奖励门类' };

    rw.chosenCategory = cat;
    rw.pendingStatOptionId = null;
    const tier = this.state.currentTier ?? 7;
    const winBonus = rw.won ? 3 : 0;
    const tierBase = 38 + (7 - Math.max(1, Math.min(7, tier))) * 6;
    const options: PostMatchRewardOption[] = [];

    if (cat === 'player') {
      const financeBonus = this.getMetaLevels().finance >= 3 ? 2 : 0;
      const isReDraft = this.getReDraftRounds().has(rw.round);
      const milestoneBonus = isReDraft ? 4 : 0;
      const cands = generateShuffleSet(
        3,
        tierBase + winBonus + financeBonus + milestoneBonus,
        tierBase + 13 + winBonus + financeBonus + (isReDraft ? 3 : 0)
      );
      cands.forEach((p, idx) => {
        options.push({
          id: `pm_p_${idx}_${p.id}`,
          category: 'player',
          title: `${p.name} (${p.role} · CA ${p.ca})`,
          subtitle: `${p.age}岁${p.secondaryRoles?.length ? ' · 兼 ' + p.secondaryRoles.join('/') : ''} · ${p.traits?.slice(0, 2).join('/') || '均衡'}`,
          rarity: p.tier === 'S' ? 'epic' : p.tier === 'A' ? 'rare' : 'common',
          player: p,
        });
      });
    } else if (cat === 'season_perk') {
      const club = this.getUserClub();
      const offer = createReDraftOffer(rw.round, club.perks.map(p => p.id), this.getMetaLevels(), tier);
      offer.perkChoices.forEach((pk, idx) => {
        const catLabel = pk.category === 'attack' ? '进攻系' : pk.category === 'defense' ? '防守系' : '控制系';
        options.push({
          id: `pm_sp_${idx}_${pk.id}`,
          category: 'season_perk',
          title: `赛季词条：${pk.name}`,
          subtitle: `[${catLabel}] ${pk.description}`,
          rarity: pk.rarity,
          perk: pk,
        });
      });
    } else if (cat === 'stat_boost') {
      const attrPool: Array<{ attr: keyof PlayerAttributes; label: string; delta: number; rarity: 'common' | 'rare' | 'epic' }> = [
        { attr: 'shooting', label: '射门与终结', delta: rw.won ? 3 : 2, rarity: rw.won ? 'rare' : 'common' },
        { attr: 'pace', label: '速度与爆发', delta: rw.won ? 3 : 2, rarity: rw.won ? 'rare' : 'common' },
        { attr: 'passing', label: '传球与视野', delta: rw.won ? 3 : 2, rarity: rw.won ? 'rare' : 'common' },
        { attr: 'defending', label: '抢断与拦截', delta: rw.won ? 3 : 2, rarity: 'common' },
        { attr: 'dribbling', label: '盘带与护球', delta: 3, rarity: 'rare' },
        { attr: 'stamina', label: '体能耐久', delta: 4, rarity: 'epic' },
        { attr: 'composure', label: '门前冷静', delta: 3, rarity: 'rare' },
        { attr: 'goalkeeping', label: '门将扑救', delta: 4, rarity: 'rare' },
      ];
      for (let i = attrPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [attrPool[i], attrPool[j]] = [attrPool[j], attrPool[i]];
      }
      attrPool.slice(0, 3).forEach((item, idx) => {
        options.push({
          id: `pm_sb_${idx}`,
          category: 'stat_boost',
          title: `特训卡：${item.label} +${item.delta}`,
          subtitle: '指定队内 1 名球员立即永久提升该项属性',
          rarity: item.rarity,
          statBoost: { attr: item.attr, attrLabel: item.label, delta: item.delta },
        });
      });
    } else if (cat === 'line_boost') {
      const linePool: Array<{ line: 'GK' | 'DEF' | 'MID' | 'ATT'; lineLabel: string; attr: keyof PlayerAttributes; attrLabel: string; delta: number }> = [
        { line: 'ATT', lineLabel: '前锋线', attr: 'shooting', attrLabel: '射门', delta: 2 },
        { line: 'MID', lineLabel: '中场线', attr: 'passing', attrLabel: '传球', delta: 2 },
        { line: 'DEF', lineLabel: '后卫线', attr: 'defending', attrLabel: '抢断', delta: 2 },
        { line: 'GK', lineLabel: '门将线', attr: 'goalkeeping', attrLabel: '扑救', delta: 3 },
        { line: 'MID', lineLabel: '中场线', attr: 'stamina', attrLabel: '体能', delta: 2 },
        { line: 'ATT', lineLabel: '前锋线', attr: 'pace', attrLabel: '速度', delta: 2 },
      ];
      for (let i = linePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [linePool[i], linePool[j]] = [linePool[j], linePool[i]];
      }
      linePool.slice(0, 3).forEach((item, idx) => {
        options.push({
          id: `pm_lb_${idx}`,
          category: 'line_boost',
          title: `${item.lineLabel}共振：${item.attrLabel} +${item.delta}`,
          subtitle: `全队所有${item.lineLabel}球员本属性立即 +${item.delta}`,
          rarity: item.delta >= 3 ? 'epic' : 'rare',
          lineBoost: item,
        });
      });
    } else if (cat === 'craft_card') {
      const ast = this.getV6Astrolabe();
      const rogue = this.getV6SeasonRogue();
      const activePoolIds = Array.from(
        new Set([
          ...ast.checkpointPools.s1,
          ...ast.checkpointPools.s2,
          ...ast.checkpointPools.s3,
          ...ast.checkpointPools.s4,
          ...ast.unlockedDirectives,
        ])
      );

      // 选项 1：赛季战术圣物（未满当前级别上限时）或跨界融合奇点借用
      const maxRelics = getV6TierCaps(this.getBestTierReached()).maxRelics;
      const allRelicIds = Object.keys(V6_RELICS) as V6RelicId[];
      const availRelics = allRelicIds.filter(rid => !rogue.seasonRelics.includes(rid));
      if (rogue.seasonRelics.length < maxRelics && availRelics.length > 0) {
        const pickedRelicId = availRelics[Math.floor(Math.random() * availRelics.length)];
        const relic = V6_RELICS[pickedRelicId];
        options.push({
          id: `pm_v6_relic_${pickedRelicId}`,
          category: 'craft_card',
          title: `赛季战术圣物：《${relic.name}》`,
          subtitle: `${relic.desc}（本季常驻 ${rogue.seasonRelics.length + 1}/${maxRelics} · 另赠 +1 Meta 星盘点）`,
          rarity: relic.rarity === 'mythic' ? 'epic' : 'rare',
          v6RogueReward: {
            kind: 'relic',
            relicId: pickedRelicId,
            metaBonus: 1,
            badge: '赛季圣物',
            description: relic.desc,
          },
        });
      } else {
        const candFusions = V6_FUSION_KEYSTONES.filter(
          f => !ast.unlockedFusions.includes(f.id) && rogue.borrowedFusion?.id !== f.id
        );
        const fPick = candFusions[Math.floor(Math.random() * Math.max(1, candFusions.length))] ?? V6_FUSION_KEYSTONES[0];
        const fBranch: 'A' | 'B' = Math.random() < 0.55 ? 'A' : 'B';
        const brDef = fBranch === 'B' ? fPick.branchB : fPick.branchA;
        options.push({
          id: `pm_v6_fusion_${fPick.id}`,
          category: 'craft_card',
          title: `跨界奇点借用：【${fPick.name}·${fBranch}】`,
          subtitle: `${brDef.desc}（本季临时跨流派生效 · 另赠 +2 Meta 星盘点）`,
          rarity: 'epic',
          v6RogueReward: {
            kind: 'borrow_fusion',
            fusionId: fPick.id,
            fusionBranch: fBranch,
            metaBonus: 2,
            badge: '邪道奇点',
            description: brDef.desc,
          },
        });
      }

      // 选项 2：临场手牌暗金词条附魔
      const unenchantedDirs = activePoolIds.filter(did => !rogue.directiveEnchants[did]);
      const targetDirId = (unenchantedDirs.length > 0 ? unenchantedDirs : activePoolIds)[
        Math.floor(Math.random() * Math.max(1, (unenchantedDirs.length > 0 ? unenchantedDirs : activePoolIds).length))
      ];
      const targetDir = targetDirId ? V6_DIRECTIVE_MAP[targetDirId] : undefined;
      const enchantIds = Object.keys(V6_DIRECTIVE_ENCHANTS) as V6DirectiveEnchantId[];
      const pickedEnchantId = enchantIds[Math.floor(Math.random() * enchantIds.length)];
      const ench = V6_DIRECTIVE_ENCHANTS[pickedEnchantId];
      if (targetDir) {
        options.push({
          id: `pm_v6_ench_${targetDir.id}`,
          category: 'craft_card',
          title: `手牌附魔：《${targetDir.name}》·【${ench.name}】`,
          subtitle: `${ench.desc}（本赛季生效 · 另赠 +1 Meta 星盘点）`,
          rarity: ench.rarity === 'mythic' ? 'epic' : 'rare',
          v6RogueReward: {
            kind: 'enchant',
            targetId: targetDir.id,
            enchantId: pickedEnchantId,
            metaBonus: 1,
            badge: '暗金附魔',
            description: ench.desc,
          },
        });
      }

      // 选项 3：手牌三卫星超频 或 主动技双质变过载
      const unOverclockedDirs = activePoolIds.filter(
        did => !rogue.overclockedDirectives.includes(did) && (ast.directiveSatellites[did]?.length ?? 0) < 3
      );
      const unOverloadedSkills = ast.equippedSkills.filter(sid => !rogue.overloadedSkills.includes(sid));
      if (unOverloadedSkills.length > 0 && (Math.random() < 0.45 || unOverclockedDirs.length === 0)) {
        const skId = unOverloadedSkills[Math.floor(Math.random() * unOverloadedSkills.length)];
        const skDef = V6_ACTIVE_SKILL_MAP[skId];
        if (skDef) {
          options.push({
            id: `pm_v6_skov_${skDef.id}`,
            category: 'craft_card',
            title: `绝技过载觉醒：《${skDef.name}》双质变`,
            subtitle: `本赛季同时激活 A+B 双分支质变、冷却 -3' 且限次 +1（另赠 +2 Meta 星盘点）`,
            rarity: 'epic',
            v6RogueReward: {
              kind: 'overload_skill',
              targetId: skDef.id,
              metaBonus: 2,
              badge: '双支觉醒',
              description: `${skDef.branchA.label} + ${skDef.branchB.label}`,
            },
          });
        }
      } else {
        const ocId = (unOverclockedDirs.length > 0 ? unOverclockedDirs : activePoolIds)[0];
        const ocDef = ocId ? V6_DIRECTIVE_MAP[ocId] : undefined;
        if (ocDef) {
          options.push({
            id: `pm_v6_diroc_${ocDef.id}`,
            category: 'craft_card',
            title: `卫星满载超频：《${ocDef.name}》★3`,
            subtitle: `本赛季免费激活该牌全部 A+B+C 三颗卫星（含宗师质变：${ocDef.satellites.C.desc}）并赠 +2 Meta 星盘点`,
            rarity: 'epic',
            v6RogueReward: {
              kind: 'overclock_dir',
              targetId: ocDef.id,
              metaBonus: 2,
              badge: '三星超频',
              description: ocDef.satellites.C.desc,
            },
          });
        }
      }
    } else if (cat === 'trait_forge') {
      const silverPool = [
        { trait: '远射重炮', desc: '禁区外远射(18m+) xG +25%，适合前腰/中场/前锋' },
        { trait: '致命直塞', desc: '直塞球决策倾向与穿透收益提升，撕裂防线利器' },
        { trait: '禁区狐狸', desc: '禁区内射门期望进球 xG +18%，射手质变徽章' },
        { trait: '精准铲断', desc: '抢断成功率 +10% 且犯规风险降低 35%' },
        { trait: '铁肺覆盖', desc: '全场奔跑体能消耗降低 40%，攻防永动机' },
        { trait: '精准传中', desc: '边路传中决策与到位率提升，两翼体系核心' },
        { trait: '节拍器', desc: '短传与中场组织成功率 +5%，传控大脑必备' },
      ];
      const pickedSilver = silverPool[Math.floor(Math.random() * silverPool.length)];
      options.push({
        id: 'pm_tf_silver',
        category: 'trait_forge',
        title: `临时银标：赐予【${pickedSilver.trait}】(5轮)`,
        subtitle: `指定 1 名球员未来 5 轮获得该引擎银标（若已有则临时升金标+ 3轮！）`,
        rarity: 'rare',
        traitForge: { kind: 'grant_silver', trait: pickedSilver.trait, durationRounds: 5, description: pickedSilver.desc },
      });
      options.push({
        id: 'pm_tf_gold',
        category: 'trait_forge',
        title: '临时金标+：PlayStyle+超频 (3轮)',
        subtitle: '指定 1 名球员，将其首枚银标在未来 3 轮升华为金标+(2倍引擎加成)！',
        rarity: 'epic',
        traitForge: { kind: 'upgrade_gold', durationRounds: 3, description: '指定球员临时晋升 1 枚金标特质（3轮）' },
      });
      options.push({
        id: 'pm_tf_role',
        category: 'trait_forge',
        title: '全能改造：解锁第二位置 + 站位+1',
        subtitle: '指定 1 名球员习得兼容次选位置并提升站位/传球 +1',
        rarity: 'rare',
        traitForge: { kind: 'unlock_role', description: '解锁新次选位置并提升站位与传球 +1' },
      });
    } else if (cat === 'tactical_pact') {
      const pactPool: PostMatchRewardOption[] = [
        {
          id: 'pm_tp_blitz',
          category: 'tactical_pact',
          title: '契约·高压透支：攻击群射速 +3',
          subtitle: '代价：全队当前体能 -16% | 收益：全队前锋/中场射门+3、速度+3',
          rarity: 'epic',
          pactReward: { kind: 'blitz_overdrive', description: '前锋/中场射门+3、速度+3，全队体能 -16%' },
        },
        {
          id: 'pm_tp_iron',
          category: 'tactical_pact',
          title: '契约·铁血死守：防线扑救 +4',
          subtitle: '代价：全队前锋射门 -2 | 收益：全队后卫抢断+4、门将扑救+4',
          rarity: 'epic',
          pactReward: { kind: 'iron_fortress', description: '后卫抢断+4、门将扑救+4，前锋射门 -2' },
        },
        {
          id: 'pm_tp_youth',
          category: 'tactical_pact',
          title: '契约·青春风暴：U23 全面暴涨',
          subtitle: '代价：28岁+老将体能上限 -2 | 收益：全队U23新星传射速各 +2',
          rarity: 'rare',
          pactReward: { kind: 'youth_gamble', description: 'U23新星传射速各+2，老将体能 -2' },
        },
        {
          id: 'pm_tp_vet',
          category: 'tactical_pact',
          title: '契约·老兵燃尽：老将关键球 +4',
          subtitle: '代价：27岁+老将体能 -18% | 收益：27岁+老将冷静+5、传球+3、射门+3',
          rarity: 'rare',
          pactReward: { kind: 'veteran_last_dance', description: '27+老将冷静+5传射+3，当前体能 -18%' },
        },
        {
          id: 'pm_tp_alchemy',
          category: 'tactical_pact',
          title: '契约·战术研习所：星盘点与备战双收',
          subtitle: '代价：赞助研发费 ¥30万 | 收益：Meta 星盘点 +6pt、下轮备战点 +1、全队冷静 +1',
          rarity: 'epic',
          pactReward: { kind: 'black_market_alchemy', description: '花费 ¥30万换取 Meta +6pt、备战点 +1 及全队冷静 +1' },
        },
        {
          id: 'pm_tp_stamina',
          category: 'tactical_pact',
          title: '契约·极限体能：消除伤病隐患',
          subtitle: '代价：全队体能统一锁定 74% | 收益：全队体能上限 +4 且清空疲劳警告',
          rarity: 'rare',
          pactReward: { kind: 'stamina_limit_break', description: '全队体能+4并清空疲劳警告，当前体能置为74%' },
        },
      ];
      for (let i = pactPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pactPool[i], pactPool[j]] = [pactPool[j], pactPool[i]];
      }
      options.push(...pactPool.slice(0, 3));
    } else if (cat === 'chemistry_forge') {
      const chemPool: PostMatchRewardOption[] = [
        {
          id: 'pm_cf_gold',
          category: 'chemistry_forge',
          title: '铸造【黄金连线】：首发默契质变',
          subtitle: '当前首发最具潜力的一对阵型连线立即默契 +25 并封号【黄金连线】',
          rarity: 'epic',
          chemReward: { kind: 'golden_link', description: '一对首发核心连线默契 +25 并解锁黄金连线' },
        },
        {
          id: 'pm_cf_form',
          category: 'chemistry_forge',
          title: '阵型宗师灌顶：熟练度 + Meta 基金',
          subtitle: '全队当前阵型熟练度 +12%、宗师经验 +3，并额外获赠 Meta +15pt',
          rarity: 'rare',
          chemReward: { kind: 'formation_master', description: '全队当前阵型熟练度 +12，宗师经验 +3，Meta +15pt' },
        },
        {
          id: 'pm_cf_spine',
          category: 'chemistry_forge',
          title: '中轴脊梁共鸣：门卫腰锋齐升',
          subtitle: '队内核心 GK/CB/CM/ST 各选1名主将冷静+2、站位+2，中轴默契 +10',
          rarity: 'epic',
          chemReward: { kind: 'spine_boost', description: '中轴线主将冷静/站位 +2，中轴默契 +10' },
        },
        {
          id: 'pm_cf_overclock',
          category: 'chemistry_forge',
          title: '星盘指令超频：免费满载三颗卫星',
          subtitle: '本赛季随机为 1 张已装配三区手牌激活全部 A+B+C 卫星改造，并赠 Meta +3pt',
          rarity: 'epic',
          chemReward: { kind: 'card_overclock', description: '已装手牌满载激活三颗卫星 + Meta +3pt' },
        },
      ];
      for (let i = chemPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chemPool[i], chemPool[j]] = [chemPool[j], chemPool[i]];
      }
      options.push(...chemPool.slice(0, 3));
    } else if (cat === 'gamble') {
      const gambleOpts = rollTieredGambleOptions({
        tier,
        round: rw.round,
        won: rw.won,
        winlessStreak: this.state.winlessStreak ?? 0,
        club: this.getUserClub(),
        metaLevels: this.getMetaLevels(),
        recentEventIds: this.state.recentGambleEventIds ?? [],
      }, 3);
      options.push(...gambleOpts);
      const usedIds = gambleOpts.map(o => o.gamble?.eventId).filter((x): x is string => !!x);
      this.state.recentGambleEventIds = [...(this.state.recentGambleEventIds ?? []), ...usedIds].slice(-9);
    } else {
      const chrons = ensureChronicles(this.state);
      const evPool: PostMatchRewardOption[] = [];
      evPool.push({
        id: 'pm_ev_meta',
        category: 'event',
        title: '理事会嘉奖：Meta 天赋 +15pt',
        subtitle: '直接入账教练天赋树与 SkillWeb 技能网点数 +15pt',
        rarity: 'rare',
        eventReward: { kind: 'meta_grant', amount: 15, description: '直接获得 Meta 天赋点数 +15pt' },
      });
      evPool.push({
        id: 'pm_ev_prep',
        category: 'event',
        title: '战术室加班：下轮备战点 +2',
        subtitle: '下轮赛前整备行动点 +2（可多做理疗/演练/侦察）且 Meta +10pt',
        rarity: 'epic',
        eventReward: { kind: 'prep_actions', amount: 2, description: '下轮赛前备战行动点 +2，Meta +10pt' },
      });
      evPool.push({
        id: 'pm_ev_intel',
        category: 'event',
        title: '球探密电：摸透下轮对手 +45%',
        subtitle: '下轮对手球探了解度直接 +45%（解锁更多破绽线索）且 Meta +15pt',
        rarity: 'rare',
        eventReward: { kind: 'scout_intel', amount: 45, description: '下轮对手了解度 +45%，Meta +15pt' },
      });
      if (chrons.relegation_fight.status === 'active') {
        evPool.push({
          id: 'pm_ev_heal',
          category: 'event',
          title: '泥潭理疗 · 全军蓄力',
          subtitle: '保级主线联动：全队体能恢复至 100%',
          rarity: 'epic',
          eventReward: { kind: 'heal_all', description: '全队所有球员体能恢复至 100%' },
        });
      } else {
        evPool.push({
          id: 'pm_ev_heal',
          category: 'event',
          title: '神医理疗周',
          subtitle: '全队所有球员体能立即恢复至 100%',
          rarity: 'rare',
          eventReward: { kind: 'heal_all', description: '全队所有球员体能恢复至 100%' },
        });
      }
      evPool.push({
        id: 'pm_ev_devil',
        category: 'event',
        title: chrons.tactician_path.status === 'active' ? '战术宗师加练周' : '魔鬼加练周',
        subtitle: '全队射门与传球 +1，但全队当前体能 -12%',
        rarity: 'epic',
        eventReward: { kind: 'devil_training', description: '全队射门+1、传球+1，体能 -12%' },
      });
      evPool.push({
        id: 'pm_ev_reveal',
        category: 'event',
        title: chrons.academy_roots.status === 'active' ? '青训秘报 · 激发潜能' : '球探密报 · 激发潜能',
        subtitle: '揭示队内 1 名球员的隐藏觉醒特质（若无则赠 Meta +25pt）',
        rarity: 'rare',
        eventReward: { kind: 'reveal_hidden', description: '提前觉醒 1 名球员的隐藏特质' },
      });
      evPool.push({
        id: 'pm_ev_fam',
        category: 'event',
        title: '全队阵型合练',
        subtitle: '全队对当前首发阵型的个人熟练度 +8%',
        rarity: 'rare',
        eventReward: { kind: 'team_familiarity', description: '全队当前阵型熟练度 +8' },
      });
      evPool.push({
        id: 'pm_ev_chem',
        category: 'event',
        title: '中轴/边路双人合练',
        subtitle: '随机提升一对首发核心连线默契度 +12',
        rarity: 'epic',
        eventReward: { kind: 'pair_chemistry', description: '随机一对阵型连线搭档默契 +12' },
      });
      evPool.push({
        id: 'pm_ev_mentor',
        category: 'event',
        title: '老将传帮带',
        subtitle: '队长与队内 U23 新星建立师徒默契 (+15)',
        rarity: 'rare',
        eventReward: { kind: 'captain_mentor', description: '队长与年轻球员默契度 +15' },
      });
      for (let i = evPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [evPool[i], evPool[j]] = [evPool[j], evPool[i]];
      }
      options.push(...evPool.slice(0, 3));
    }

    rw.options = options;
    return { ok: true };
  }

  public applyPostMatchRewardOption(
    optionId: string,
    targetPlayerId?: string
  ): { ok: boolean; needsTarget?: boolean; summary?: string; gambleTier?: GambleOutcomeTier; reason?: string } {
    const rw = this.state.pendingPostMatchReward;
    if (!rw || rw.completed) return { ok: false, reason: '奖励已完成或不存在' };
    const opt = rw.options.find(o => o.id === optionId);
    if (!opt) return { ok: false, reason: '未找到该奖励选项' };

    const club = this.getUserClub();
    const roster = this.getClubRoster();
    const clampAttr = (v: number) => Math.max(20, Math.min(99, v));

    if (opt.category === 'player' && opt.player) {
      const p = JSON.parse(JSON.stringify(opt.player)) as DraftPlayer;
      p.isNewSigning = true;
      if (club.squad.length < MAX_CLUB_ROSTER) {
        club.squad.push(p);
      } else {
        const starterSet = new Set(club.starterIds);
        const dropIdx = club.squad
          .map((x, idx) => ({ idx, ca: x.ca, starter: starterSet.has(x.id) }))
          .filter(x => !x.starter && club.squad[x.idx].role !== 'GK')
          .sort((a, b) => a.ca - b.ca)[0]?.idx ?? (club.squad.length - 1);
        club.squad[dropIdx] = p;
      }
      if (roster.length < MAX_CLUB_ROSTER) {
        roster.push(JSON.parse(JSON.stringify(p)));
      }
      rw.completed = true;
      rw.summaryText = `新援入队：${p.name} (${p.role} · CA ${p.ca})`;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'season_perk' && opt.perk) {
      club.perks.push(opt.perk);
      const syn = computePerkSynergies(club.perks);
      if (syn.synergies.length > 0) {
        tryUnlockAchievement(this.state, 'ach_synergy');
      }
      if (syn.counts.attack >= 1 && syn.counts.defense >= 1 && syn.counts.control >= 1) {
        tryUnlockAchievement(this.state, 'ach_triple_synergy');
      }
      rw.completed = true;
      rw.summaryText = `激活赛季战术词条【${opt.perk.name}】：${opt.perk.description}`;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'stat_boost' && opt.statBoost) {
      if (!targetPlayerId) {
        rw.pendingStatOptionId = opt.id;
        return { ok: true, needsTarget: true };
      }
      const target = club.squad.find(p => p.id === targetPlayerId);
      if (!target) return { ok: false, reason: '未找到目标球员' };
      const oldCa = target.ca;
      const gain = target.ca >= 82 ? Math.max(1, opt.statBoost.delta - 1) : opt.statBoost.delta;
      target.attributes[opt.statBoost.attr] = clampAttr(target.attributes[opt.statBoost.attr] + gain);
      target.ca = computeWeightedCA(target.role, target.attributes);
      const rIdx = roster.findIndex(r => r.id === target.id);
      if (rIdx >= 0) roster[rIdx] = JSON.parse(JSON.stringify(target));
      rw.pendingStatOptionId = null;
      rw.completed = true;
      rw.summaryText = `${target.name} ${opt.statBoost.attrLabel} +${gain} (CA ${oldCa}→${target.ca})`;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'trait_forge' && opt.traitForge) {
      if (!targetPlayerId) {
        rw.pendingStatOptionId = opt.id;
        return { ok: true, needsTarget: true };
      }
      const target = club.squad.find(p => p.id === targetPlayerId);
      if (!target) return { ok: false, reason: '未找到目标球员' };
      const tf = opt.traitForge;
      const dur = tf.durationRounds ?? 4;
      target.tempTraits = target.tempTraits ? [...target.tempTraits] : [];

      const upsertTempTrait = (trait: string, tier: 'silver' | 'gold', rounds: number) => {
        const existing = target.tempTraits!.find(t => t.trait === trait);
        if (existing) {
          if (tier === 'gold') existing.tier = 'gold';
          existing.remainingMatches = Math.max(existing.remainingMatches, rounds);
        } else {
          target.tempTraits!.push({ trait, tier, remainingMatches: rounds });
        }
      };

      if (tf.kind === 'grant_silver' && tf.trait) {
        const trait = target.role === 'GK' && tf.trait !== '精准长传' && tf.trait !== '节拍器' ? '门线神扑' : tf.trait;
        const alreadyGold = target.goldTraits?.includes(trait);
        const alreadySilver = target.silverTraits?.includes(trait) || target.traits?.includes(trait);
        if (alreadyGold) {
          target.attributes.composure = clampAttr(target.attributes.composure + 2);
          target.ca = computeWeightedCA(target.role, target.attributes);
          rw.summaryText = `${target.name} 已拥有金标【${trait}】，额外强化冷静 +2 (CA ${target.ca})`;
        } else if (alreadySilver) {
          upsertTempTrait(trait, 'gold', Math.max(3, dur - 2));
          rw.summaryText = `${target.name} 的【${trait}】临时共鸣升为金标+（持续 ${Math.max(3, dur - 2)} 轮）！`;
        } else {
          upsertTempTrait(trait, 'silver', dur);
          rw.summaryText = `${target.name} 获得临时银标特质【${trait}】（持续 ${dur} 轮）！`;
        }
      } else if (tf.kind === 'upgrade_gold') {
        const promotable = target.silverTraits?.[0] ?? target.traits?.find(t => !(target.goldTraits ?? []).includes(t));
        if (promotable) {
          upsertTempTrait(promotable, 'gold', dur);
          rw.summaryText = `${target.name} 的【${promotable}】临时超频为金标+（持续 ${dur} 轮，2倍引擎加成）！`;
        } else {
          const fallbackGold = target.role === 'GK' ? '门线神扑' : ['CB', 'LB', 'RB'].includes(target.role) ? '精准铲断' : '节拍器';
          upsertTempTrait(fallbackGold, 'gold', dur);
          rw.summaryText = `${target.name} 临时觉醒金标+【${fallbackGold}】（持续 ${dur} 轮）！`;
        }
      } else if (tf.kind === 'unlock_role') {
        const pool = SECONDARY_ROLE_POOL[target.role] ?? [];
        const existing = new Set(target.secondaryRoles ?? []);
        const newRole = pool.find(r => !existing.has(r));
        target.secondaryRoles = [...existing];
        if (newRole) target.secondaryRoles.push(newRole);
        target.attributes.positioning = clampAttr(target.attributes.positioning + 1);
        target.attributes.passing = clampAttr(target.attributes.passing + 1);
        target.ca = computeWeightedCA(target.role, target.attributes);
        rw.summaryText = newRole
          ? `${target.name} 解锁次选位置【${newRole}】，站位/传球 +1 (CA ${target.ca})`
          : `${target.name} 全位置熟稔度提升，站位/传球 +1 (CA ${target.ca})`;
      }

      const rIdx = roster.findIndex(r => r.id === target.id);
      if (rIdx >= 0) roster[rIdx] = JSON.parse(JSON.stringify(target));
      rw.pendingStatOptionId = null;
      rw.completed = true;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'line_boost' && opt.lineBoost) {
      const lb = opt.lineBoost;
      let count = 0;
      for (const p of club.squad) {
        const pLine =
          p.role === 'GK' ? 'GK' :
          ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role) ? 'DEF' :
          ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.role) ? 'MID' : 'ATT';
        if (pLine === lb.line) {
          p.attributes[lb.attr] = clampAttr(p.attributes[lb.attr] + lb.delta);
          p.ca = computeWeightedCA(p.role, p.attributes);
          count++;
        }
      }
      rw.completed = true;
      rw.summaryText = `${lb.lineLabel} (${count}人) ${lb.attrLabel} +${lb.delta}`;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'craft_card' && opt.v6RogueReward) {
      const vr = opt.v6RogueReward;
      const rogue = this.getV6SeasonRogue();
      this.state.metaPointsTotal += vr.metaBonus;
      if (vr.kind === 'relic' && vr.relicId) {
        const maxRelics = getV6TierCaps(this.getBestTierReached()).maxRelics;
        if (!rogue.seasonRelics.includes(vr.relicId) && rogue.seasonRelics.length < maxRelics) {
          rogue.seasonRelics.push(vr.relicId);
        }
        const relic = V6_RELICS[vr.relicId];
        rw.summaryText = `已装备赛季战术圣物《${relic.name}》（${rogue.seasonRelics.length}/${maxRelics}）· 星盘点 +${vr.metaBonus}pt`;
      } else if (vr.kind === 'enchant' && vr.targetId && vr.enchantId) {
        rogue.directiveEnchants[vr.targetId] = vr.enchantId;
        const dName = V6_DIRECTIVE_MAP[vr.targetId]?.name ?? '三区手牌';
        const eName = V6_DIRECTIVE_ENCHANTS[vr.enchantId].name;
        rw.summaryText = `手牌《${dName}》本赛季已附魔【${eName}】· 星盘点 +${vr.metaBonus}pt`;
      } else if (vr.kind === 'overclock_dir' && vr.targetId) {
        if (!rogue.overclockedDirectives.includes(vr.targetId)) {
          rogue.overclockedDirectives.push(vr.targetId);
        }
        const dName = V6_DIRECTIVE_MAP[vr.targetId]?.name ?? '三区手牌';
        rw.summaryText = `手牌《${dName}》本赛季已满载超频 ★3（A+B+C 全卫星激活）· 星盘点 +${vr.metaBonus}pt`;
      } else if (vr.kind === 'overload_skill' && vr.targetId) {
        if (!rogue.overloadedSkills.includes(vr.targetId)) {
          rogue.overloadedSkills.push(vr.targetId);
        }
        const sName = V6_ACTIVE_SKILL_MAP[vr.targetId]?.name ?? '主动技';
        rw.summaryText = `主动技《${sName}》本赛季已觉醒 A+B 双质变且冷却缩减 · 星盘点 +${vr.metaBonus}pt`;
      } else if (vr.kind === 'borrow_fusion' && vr.fusionId) {
        const br = vr.fusionBranch ?? 'A';
        rogue.borrowedFusion = { id: vr.fusionId, branch: br };
        const fName = V6_FUSION_MAP[vr.fusionId]?.name ?? '融合奇点';
        rw.summaryText = `跨界奇点【${fName}·${br}】已在本赛季激活 · 星盘点 +${vr.metaBonus}pt`;
      }
      rw.completed = true;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'craft_card' && opt.craftReward) {
      const cr = opt.craftReward;
      const deck = this.getCoachDeck();
      const activePr = this.getDeckPresets()[this.getActiveDeckPresetIdx()];
      if (cr.kind === 'new_card' && cr.card) {
        if (deck.length < 60) {
          deck.push(cr.card);
          if (activePr && activePr.cardIds.length < 8) activePr.cardIds.push(cr.card.id);
          rw.summaryText = `获得 2 阶战术卡【${cr.card.name}】`;
        } else {
          this.addClubFunds(50);
          rw.summaryText = `卡牌背包已满，折算俱乐部资金 +¥50万`;
        }
      } else if (cr.kind === 'refill_uses' || cr.kind === 'upgrade_card') {
        const damaged = deck.find(c => !c.isBase && c.maxUses && (c.remainingUses ?? c.maxUses) < c.maxUses);
        if (damaged && damaged.maxUses) {
          damaged.remainingUses = damaged.maxUses;
          rw.summaryText = `战备修复：【${damaged.name}】耐久恢复至 ${damaged.maxUses}/${damaged.maxUses} 次`;
        } else {
          const extra1 = rollStyleConsumableCard(club.style, 1);
          const extra2 = rollStyleConsumableCard(club.style, 1);
          if (deck.length < 59) deck.push(extra1, extra2);
          rw.summaryText = `全卡完好，改赠 2 张 1 阶战术卡【${extra1.name}】【${extra2.name}】`;
        }
      } else if (cr.kind === 'grant_affix') {
        const plain = deck.find(c => !c.isBase && c.id !== 'card_captain_roar' && !c.affix);
        if (plain) {
          const af = POSITIVE_AFFIXES[Math.floor(Math.random() * POSITIVE_AFFIXES.length)];
          plain.affix = af;
          if (af.costDelta) plain.cost = Math.max(0, plain.cost + af.costDelta);
          if (af.usesBonus && plain.maxUses) {
            plain.maxUses += af.usesBonus;
            plain.remainingUses = (plain.remainingUses ?? plain.maxUses) + af.usesBonus;
          }
          plain.summary = `${plain.summary} [${af.name}]`;
          rw.summaryText = `战术附魔：【${plain.name}】获得正面词条 [${af.name}]（${af.desc}）`;
        } else {
          const extra = rollStyleConsumableCard(club.style, 2);
          if (deck.length < 60) deck.push(extra);
          rw.summaryText = `所有消耗卡均已有词条，改赠 2 阶卡【${extra.name}】`;
        }
      } else if (cr.kind === 'elements' && cr.elements) {
        const cnt = Math.max(1, Math.min(3, cr.elements.reduce((s, e) => s + e.count, 0)));
        const names: string[] = [];
        for (let i = 0; i < cnt && deck.length < 60; i++) {
          const nc = rollStyleConsumableCard(club.style, 1);
          deck.push(nc);
          names.push(nc.name);
        }
        rw.summaryText = `获赠战术卡：${names.join('、')}`;
      }
      rw.completed = true;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'tactical_pact' && opt.pactReward) {
      const pr = opt.pactReward;
      if (pr.kind === 'blitz_overdrive') {
        for (const p of club.squad) {
          if (['ST', 'LW', 'RW', 'CAM', 'CM', 'LM', 'RM'].includes(p.role)) {
            p.attributes.shooting = clampAttr(p.attributes.shooting + 3);
            p.attributes.pace = clampAttr(p.attributes.pace + 3);
            p.ca = computeWeightedCA(p.role, p.attributes);
          }
          p.fitness = Math.max(30, (p.fitness ?? 100) - 16);
        }
        rw.summaryText = '高压透支契约生效：中前场射门/速度 +3，全队体能 -16%';
      } else if (pr.kind === 'iron_fortress') {
        for (const p of club.squad) {
          if (p.role === 'GK') p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + 4);
          else if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.role)) {
            p.attributes.defending = clampAttr(p.attributes.defending + 4);
          } else if (['ST', 'LW', 'RW'].includes(p.role)) {
            p.attributes.shooting = clampAttr(p.attributes.shooting - 2);
          }
          p.ca = computeWeightedCA(p.role, p.attributes);
        }
        rw.summaryText = '铁血死守契约生效：防线抢断/门将扑救 +4，前锋射门 -2';
      } else if (pr.kind === 'youth_gamble') {
        let u23Count = 0;
        for (const p of club.squad) {
          if (p.age <= 23) {
            p.attributes.passing = clampAttr(p.attributes.passing + 2);
            p.attributes.shooting = clampAttr(p.attributes.shooting + 2);
            p.attributes.pace = clampAttr(p.attributes.pace + 2);
            p.ca = computeWeightedCA(p.role, p.attributes);
            u23Count++;
          } else if (p.age >= 28) {
            p.attributes.stamina = clampAttr(p.attributes.stamina - 2);
            p.ca = computeWeightedCA(p.role, p.attributes);
          }
        }
        rw.summaryText = `青春风暴契约生效：${u23Count}名U23传射速 +2，28+老将体能 -2`;
      } else if (pr.kind === 'veteran_last_dance') {
        let vetCount = 0;
        for (const p of club.squad) {
          if (p.age >= 27) {
            p.attributes.composure = clampAttr(p.attributes.composure + 5);
            p.attributes.passing = clampAttr(p.attributes.passing + 3);
            p.attributes.shooting = clampAttr(p.attributes.shooting + 3);
            p.ca = computeWeightedCA(p.role, p.attributes);
            p.fitness = Math.max(28, (p.fitness ?? 100) - 18);
            vetCount++;
          }
        }
        rw.summaryText = vetCount > 0
          ? `老兵燃尽契约生效：${vetCount}名老将冷静+5传射+3，当前体能 -18%`
          : '队内暂无27+老将，改赠全队冷静 +1';
        if (vetCount === 0) {
          for (const p of club.squad) p.attributes.composure = clampAttr(p.attributes.composure + 1);
        }
      } else if (pr.kind === 'black_market_alchemy') {
        const paid = this.spendClubFunds(30);
        this.state.metaPointsTotal += 6;
        if (this.state.interMatchPrep) {
          this.state.interMatchPrep.actionsLeft += 1;
        }
        for (const p of club.squad) {
          p.attributes.composure = clampAttr(p.attributes.composure + 1);
          p.ca = computeWeightedCA(p.role, p.attributes);
        }
        rw.summaryText = `战术研习所结算：${paid ? '投入 ¥30万，' : ''}入账 Meta +6pt、下轮备战点 +1、全队冷静 +1`;
      } else if (pr.kind === 'stamina_limit_break') {
        for (const p of club.squad) {
          p.attributes.stamina = clampAttr(p.attributes.stamina + 4);
          p.strainWarning = false;
          p.fitness = 74;
          p.ca = computeWeightedCA(p.role, p.attributes);
        }
        rw.summaryText = '极限体能契约生效：全队体能上限 +4、清空疲劳警告，体能锁定 74%';
      }
      rw.completed = true;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'chemistry_forge' && opt.chemReward) {
      const cr = opt.chemReward;
      if (cr.kind === 'golden_link') {
        const links = this.getChemistryLinks();
        const squadMap = new Map(club.squad.map(p => [p.id, p]));
        const specs = getFormationLinks(club, squadMap);
        const picked = specs.sort((a, b) => {
          const la = getOrCreateChemistryLink(links, a.playerA, a.playerB).score;
          const lb = getOrCreateChemistryLink(links, b.playerA, b.playerB).score;
          return la - lb;
        })[0];
        if (picked) {
          const lk = getOrCreateChemistryLink(links, picked.playerA, picked.playerB);
          lk.score = Math.min(100, lk.score + 25);
          lk.title = '黄金连线';
          rw.summaryText = `黄金连线铸成：${picked.playerA.name} × ${picked.playerB.name} 默契 +25（当前 ${lk.score}）`;
        } else {
          this.state.metaPointsTotal += 25;
          rw.summaryText = '暂无可连线首发，改赠 Meta +25pt';
        }
      } else if (cr.kind === 'formation_master') {
        for (const p of club.squad) {
          const cur = this.getPlayerFamiliarity(p, club.formation);
          p.formationFamiliarity = p.formationFamiliarity ?? {};
          p.formationFamiliarity[club.formation] = Math.min(100, cur + 12);
        }
        const m = this.getTacticalMastery();
        m.formations[club.formation] = Math.min(15, (m.formations[club.formation] ?? 0) + 3);
        this.state.metaPointsTotal += 15;
        rw.summaryText = `阵型宗师灌顶：全队【${club.formation}】熟练度 +12%、宗师经验 +3、Meta +15pt`;
      } else if (cr.kind === 'spine_boost') {
        const spineRoles = new Set(['GK', 'CB', 'CDM', 'CM', 'CAM', 'ST']);
        const boosted: string[] = [];
        const starterList = club.starterIds
          .map(id => club.squad.find(p => p.id === id))
          .filter((p): p is DraftPlayer => !!p && spineRoles.has(p.role))
          .slice(0, 4);
        for (const p of starterList) {
          p.attributes.composure = clampAttr(p.attributes.composure + 2);
          p.attributes.positioning = clampAttr(p.attributes.positioning + 2);
          p.ca = computeWeightedCA(p.role, p.attributes);
          boosted.push(p.name);
        }
        const links = this.getChemistryLinks();
        for (let i = 0; i < starterList.length; i++) {
          for (let j = i + 1; j < starterList.length; j++) {
            const lk = getOrCreateChemistryLink(links, starterList[i], starterList[j]);
            lk.score = Math.min(100, lk.score + 10);
          }
        }
        rw.summaryText = `中轴共鸣：${boosted.join('·')} 冷静/站位 +2，中轴默契 +10`;
      } else if (cr.kind === 'card_overclock') {
        const ast = this.getV6Astrolabe();
        const rogue = this.getV6SeasonRogue();
        const cand = ast.checkpointPools.s1.find(id => !rogue.overclockedDirectives.includes(id)) ?? ast.unlockedDirectives[0];
        this.state.metaPointsTotal += 3;
        if (cand) {
          if (!rogue.overclockedDirectives.includes(cand)) rogue.overclockedDirectives.push(cand);
          const dName = V6_DIRECTIVE_MAP[cand]?.name ?? '三区手牌';
          rw.summaryText = `星盘指令超频：《${dName}》本季已激活全部三颗卫星 ★3，并获赠 Meta +3pt`;
        } else {
          rw.summaryText = '已获赠星盘 Meta +3pt';
        }
      }
      rw.completed = true;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'event' && opt.eventReward) {
      const ev = opt.eventReward;
      if (ev.kind === 'meta_grant') {
        const pts = ev.amount ?? 35;
        this.state.metaPointsTotal += pts;
        rw.summaryText = `理事会嘉奖：Meta 天赋点数 +${pts}pt（当前 ${this.state.metaPointsTotal}pt）`;
      } else if (ev.kind === 'prep_actions') {
        const actGain = ev.amount ?? 2;
        if (this.state.interMatchPrep) {
          this.state.interMatchPrep.actionsLeft += actGain;
        }
        this.state.metaPointsTotal += 10;
        rw.summaryText = `战术室加班：下轮赛前备战点 +${actGain}（当前 ${this.state.interMatchPrep?.actionsLeft ?? actGain} 点）且 Meta +10pt`;
      } else if (ev.kind === 'scout_intel') {
        const intelGain = ev.amount ?? 45;
        this.state.metaPointsTotal += 15;
        const prep = this.state.interMatchPrep;
        if (prep?.matchupIntel) {
          const rec = getOpponentIntelRecord(this.state, prep.matchupIntel.oppClubId);
          rec.familiarity = Math.min(100, rec.familiarity + intelGain);
          const refreshed = buildOpponentMatchupIntel(this.state, club);
          if (refreshed) {
            refreshed.chosenCounterId = prep.matchupIntel.chosenCounterId;
            refreshed.spotCorrect = prep.matchupIntel.spotCorrect;
            refreshed.scoutedThisRound = prep.matchupIntel.scoutedThisRound;
            prep.matchupIntel = refreshed;
          }
          rw.summaryText = `球探密电：【${prep.matchupIntel.oppClubName}】了解度 +${intelGain}%（当前 ${rec.familiarity}%），Meta +15pt`;
        } else {
          this.state.metaPointsTotal += 15;
          rw.summaryText = '球探密电归档：Meta 额外 +30pt';
        }
      } else if (ev.kind === 'heal_all') {
        for (const p of club.squad) p.fitness = 100;
        rw.summaryText = '神医理疗生效：全队体能已恢复至 100%';
      } else if (ev.kind === 'devil_training') {
        for (const p of club.squad) {
          p.attributes.shooting = clampAttr(p.attributes.shooting + 1);
          p.attributes.passing = clampAttr(p.attributes.passing + 1);
          p.ca = computeWeightedCA(p.role, p.attributes);
          p.fitness = Math.max(25, (p.fitness ?? 100) - 12);
        }
        rw.summaryText = '魔鬼加练完成：全队射门/传球 +1，体能 -12%';
      } else if (ev.kind === 'reveal_hidden') {
        const target = club.squad.find(p => !!p.hiddenTrait);
        if (target && target.hiddenTrait) {
          const trait = target.hiddenTrait;
          target.hiddenTrait = undefined;
          target.traits = target.traits ? [...target.traits] : [];
          if (!target.traits.includes(trait)) target.traits.push(trait);
          rw.summaryText = `球探密报：${target.name} 提前觉醒隐藏特质【${trait}】`;
        } else {
          this.state.metaPointsTotal += 25;
          rw.summaryText = '全队隐藏特质已全部显露，改赠 Meta +25pt';
        }
      } else if (ev.kind === 'team_familiarity') {
        for (const p of club.squad) {
          const cur = this.getPlayerFamiliarity(p, club.formation);
          p.formationFamiliarity = p.formationFamiliarity ?? {};
          p.formationFamiliarity[club.formation] = Math.min(100, cur + 8);
        }
        rw.summaryText = `阵型合练完成：全队对【${club.formation}】熟练度 +8`;
      } else if (ev.kind === 'pair_chemistry') {
        const links = this.getChemistryLinks();
        const squadMap = new Map(club.squad.map(p => [p.id, p]));
        const specs = getFormationLinks(club, squadMap);
        if (specs.length > 0) {
          const picked = specs[Math.floor(Math.random() * specs.length)];
          const lk = getOrCreateChemistryLink(links, picked.playerA, picked.playerB);
          lk.score = Math.min(100, lk.score + 12);
          if (lk.score >= 85) lk.title = '黄金连线';
          rw.summaryText = `合练升温：${picked.playerA.name} × ${picked.playerB.name} 默契度 +12（当前 ${lk.score}）`;
        } else {
          this.state.metaPointsTotal += 15;
          rw.summaryText = '暂无可连线首发，改赠 Meta +15pt';
        }
      } else if (ev.kind === 'captain_mentor') {
        const capId = this.getCaptainId(club);
        const cap = club.squad.find(p => p.id === capId) ?? club.squad[0];
        const rookies = club.squad.filter(p => p.id !== cap?.id && p.age <= 23).sort((a, b) => a.age - b.age);
        const rookie = rookies[0] ?? club.squad.find(p => p.id !== cap?.id);
        if (cap && rookie) {
          const links = this.getChemistryLinks();
          const lk = getOrCreateChemistryLink(links, cap, rookie);
          lk.score = Math.min(100, lk.score + 15);
          if (lk.score >= 85) lk.title = '黄金连线';
          rw.summaryText = `老将传帮带：${cap.name} × ${rookie.name} 默契度 +15（当前 ${lk.score}）`;
        } else {
          this.state.metaPointsTotal += 15;
          rw.summaryText = '全队状态稳定，改赠 Meta +15pt';
        }
      }
      rw.completed = true;
      return { ok: true, summary: rw.summaryText };
    }

    if (opt.category === 'gamble' && opt.gamble) {
      const rolledTier = rollTriStateGamble(opt.gamble);
      const outcome = opt.gamble[rolledTier];
      opt.gamble.rolledTier = rolledTier;
      opt.gamble.rolledText = outcome.summary;
      const ef = outcome.effect;
      const target = ef.targetPlayerId ? club.squad.find(p => p.id === ef.targetPlayerId) : undefined;

      if (ef.fitnessDelta !== undefined) {
        const list = target ? [target] : club.squad;
        for (const p of list) {
          p.fitness = Math.max(20, Math.min(100, (p.fitness ?? 100) + ef.fitnessDelta));
          if (p.fitness >= 70) p.strainWarning = false;
        }
      }
      if (ef.moraleShift) {
        const list = target ? [target] : club.squad;
        for (const p of list) p.morale = ef.moraleShift;
      }
      if (ef.injureStarterRounds && ef.injureStarterRounds > 0) {
        const starterSet = new Set(club.starterIds);
        const pool = club.squad.filter(p => starterSet.has(p.id) && (p.injuredRounds ?? 0) === 0);
        const victim = pool[Math.floor(Math.random() * pool.length)];
        if (victim) {
          victim.injuredRounds = (victim.injuredRounds ?? 0) + ef.injureStarterRounds;
          this.replaceUnavailableStarters(club);
        }
      }
      if (ef.metaDelta !== undefined) {
        this.state.metaPointsTotal = Math.max(0, this.state.metaPointsTotal + ef.metaDelta);
      }
      if (ef.prepActionsDelta !== undefined && this.state.interMatchPrep) {
        this.state.interMatchPrep.actionsLeft = Math.max(0, this.state.interMatchPrep.actionsLeft + ef.prepActionsDelta);
      }
      if (ef.scoutIntelDelta !== undefined && this.state.interMatchPrep?.matchupIntel) {
        const prep = this.state.interMatchPrep;
        const intel = prep.matchupIntel;
        if (intel) {
          const rec = getOpponentIntelRecord(this.state, intel.oppClubId);
          rec.familiarity = Math.max(0, Math.min(100, rec.familiarity + ef.scoutIntelDelta));
          const refreshed = buildOpponentMatchupIntel(this.state, club);
          if (refreshed) {
            refreshed.chosenCounterId = intel.chosenCounterId;
            refreshed.spotCorrect = intel.spotCorrect;
            refreshed.scoutedThisRound = intel.scoutedThisRound;
            prep.matchupIntel = refreshed;
          }
        }
      }
      if (ef.elementsGain && ef.elementsGain > 0) {
        const deckG = this.getCoachDeck();
        const cardCount = Math.max(1, Math.ceil(ef.elementsGain / 2));
        for (let i = 0; i < cardCount && deckG.length < 60; i++) {
          deckG.push(rollStyleConsumableCard(club.style, 1));
        }
      }
      if (ef.grantCardLevel && ef.grantCardLevel >= 1) {
        const tierToGrant: 1 | 2 = ef.grantCardLevel >= 3 ? 2 : 1;
        const granted = rollStyleConsumableCard(club.style, tierToGrant);
        const deck = this.getCoachDeck();
        if (deck.length < 60) {
          deck.push(granted);
          const activePr = this.getDeckPresets()[this.getActiveDeckPresetIdx()];
          if (activePr && activePr.cardIds.length < 8) activePr.cardIds.push(granted.id);
        } else {
          this.addClubFunds(40);
        }
      }
      const traitTarget = target ?? club.squad.find(p => p.id === club.captainId) ?? club.squad[0];
      if (ef.tempTrait && traitTarget) {
        traitTarget.tempTraits = traitTarget.tempTraits ? [...traitTarget.tempTraits] : [];
        const existing = traitTarget.tempTraits.find(t => t.trait === ef.tempTrait!.trait);
        if (existing) {
          if (ef.tempTrait.tier === 'gold') existing.tier = 'gold';
          existing.remainingMatches = Math.max(existing.remainingMatches, ef.tempTrait.rounds);
        } else {
          traitTarget.tempTraits.push({
            trait: ef.tempTrait.trait,
            tier: ef.tempTrait.tier,
            remainingMatches: ef.tempTrait.rounds,
          });
        }
      }
      if (ef.attrDelta) {
        const { attr, delta, scope } = ef.attrDelta;
        const targets =
          scope === 'target' ? (target ? [target] : []) :
          scope === 'u23' ? club.squad.filter(p => p.age <= 23) :
          scope === 'veteran' ? club.squad.filter(p => p.age >= 27) :
          scope === 'att' ? club.squad.filter(p => ['LW', 'RW', 'ST', 'CAM'].includes(p.role)) :
          club.squad.filter(p => ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.role));
        for (const p of targets) {
          p.attributes[attr] = Math.max(25, Math.min(99, p.attributes[attr] + delta));
          p.ca = computeWeightedCA(p.role, p.attributes);
        }
      }
      if (ef.teamFamiliarityDelta !== undefined) {
        for (const p of club.squad) {
          const cur = this.getPlayerFamiliarity(p, club.formation);
          p.formationFamiliarity = p.formationFamiliarity ?? {};
          p.formationFamiliarity[club.formation] = Math.max(0, Math.min(100, cur + ef.teamFamiliarityDelta));
        }
      }
      if (ef.pairChemistryDelta !== undefined) {
        const links = this.getChemistryLinks();
        const squadMap = new Map(club.squad.map(p => [p.id, p]));
        const specs = getFormationLinks(club, squadMap);
        if (specs.length > 0) {
          const picked = specs[Math.floor(Math.random() * specs.length)];
          const lk = getOrCreateChemistryLink(links, picked.playerA, picked.playerB);
          lk.score = Math.max(0, Math.min(100, lk.score + ef.pairChemistryDelta));
          if (lk.score >= 85) lk.title = '黄金连线';
        }
      }
      if (ef.nextMatchBuff && this.state.interMatchPrep) {
        const prev = this.state.interMatchPrep.nextMatchBuff ?? {};
        this.state.interMatchPrep.nextMatchBuff = {
          ...prev,
          passingBonus: (prev.passingBonus ?? 0) + (ef.nextMatchBuff.passingBonus ?? 0),
          shootingBonus: (prev.shootingBonus ?? 0) + (ef.nextMatchBuff.shootingBonus ?? 0),
          defendingBonus: (prev.defendingBonus ?? 0) + (ef.nextMatchBuff.defendingBonus ?? 0),
          paceBonus: (prev.paceBonus ?? 0) + (ef.nextMatchBuff.paceBonus ?? 0),
          composureBonus: (prev.composureBonus ?? 0) + (ef.nextMatchBuff.composureBonus ?? 0),
          note: ef.nextMatchBuff.note,
        };
      }

      const tierTag = rolledTier === 'jackpot' ? '超额暴击' : rolledTier === 'negative' ? '触发代价' : '常规收益';
      rw.completed = true;
      rw.summaryText = `[${tierTag}] ${outcome.label}：${outcome.summary}`;
      return { ok: true, summary: rw.summaryText, gambleTier: rolledTier };
    }

    return { ok: false, reason: '未知奖励类型' };
  }

  private applyMatchOutcome(fixture: FixtureMatch, res: MatchState): void {
    let homeGoals = res.homeScore;
    let awayGoals = res.awayScore;

    // 季后赛淘汰赛不允许平局（点球分胜负）
    if (fixture.stage !== 'regular' && homeGoals === awayGoals) {
      if (Math.random() < 0.5) homeGoals += 1;
      else awayGoals += 1;
    }

    fixture.played = true;
    fixture.homeGoals = homeGoals;
    fixture.awayGoals = awayGoals;
    fixture.homeXG = res.stats.home.xG;
    fixture.awayXG = res.stats.away.xG;

    // 本轮已执行停赛的球员扣减停赛场次
    const homeClub = this.state.clubs.find(c => c.id === fixture.homeClubId);
    const awayClub = this.state.clubs.find(c => c.id === fixture.awayClubId);
    for (const c of [homeClub, awayClub]) {
      if (!c) continue;
      for (const p of c.squad) {
        if ((p.suspendedRounds ?? 0) > 0) {
          p.suspendedRounds = (p.suspendedRounds ?? 0) - 1;
        }
      }
    }

    // 回写球员个人赛季统计、隐藏词条觉醒与两黄/红牌停赛
    const playerMap = new Map<string, DraftPlayer>();
    for (const c of this.state.clubs) {
      for (const p of c.squad) playerMap.set(p.id, p);
    }
    for (const u of res.unlockedHiddenTraits || []) {
      const dp = playerMap.get(u.playerId);
      if (dp) {
        dp.hiddenTrait = undefined;
        dp.traits = dp.traits ? [...dp.traits] : [];
        if (!dp.traits.includes(u.trait)) dp.traits.push(u.trait);
      }
    }
    const seenPlayedIds = new Set<string>();
    for (const mp of [...res.players, ...(res.subbedOutPlayers ?? [])]) {
      if (seenPlayedIds.has(mp.id)) continue;
      seenPlayedIds.add(mp.id);
      const dp = playerMap.get(mp.id);
      if (!dp) continue;
      dp.seasonStats.appearances++;
      dp.seasonStats.goals += mp.matchStats.goals;
      dp.seasonStats.assists += mp.matchStats.assists;
      dp.seasonStats.yellowCards += mp.yellowCards;
      dp.seasonStats.tackles = (dp.seasonStats.tackles ?? 0) + mp.matchStats.tackles;
      dp.seasonStats.interceptions = (dp.seasonStats.interceptions ?? 0) + mp.matchStats.interceptions;
      dp.seasonStats.passes = (dp.seasonStats.passes ?? 0) + mp.matchStats.passes;
      dp.seasonStats.passesSuccess = (dp.seasonStats.passesSuccess ?? 0) + mp.matchStats.passesSuccess;
      dp.seasonStats.distanceM = (dp.seasonStats.distanceM ?? 0) + mp.matchStats.distanceM;
      dp.seasonStats.saves = (dp.seasonStats.saves ?? 0) + mp.matchStats.saves;
      if (mp.redCard) {
        dp.seasonStats.redCards++;
        dp.suspendedRounds = (dp.suspendedRounds ?? 0) + 1;
        dp.seasonYellowsSinceBan = 0;
      } else if (mp.yellowCards > 0) {
        dp.seasonYellowsSinceBan = (dp.seasonYellowsSinceBan ?? 0) + mp.yellowCards;
        if (dp.seasonYellowsSinceBan >= 2) {
          dp.suspendedRounds = (dp.suspendedRounds ?? 0) + 1;
          dp.seasonYellowsSinceBan -= 2;
        }
      }
      if (dp.role === 'GK') {
        const conceded = mp.team === 'home' ? awayGoals : homeGoals;
        if (conceded === 0) dp.seasonStats.cleanSheets++;
      }
    }

    // 同步玩家球队的本赛季统计与停赛状态回 clubRoster，确保大名单实时展示队内榜单
    const userClub = this.getUserClub();
    if (userClub && this.state.clubRoster) {
      const rosterMap = new Map(this.state.clubRoster.map(r => [r.id, r]));
      for (const sp of userClub.squad) {
        const rp = rosterMap.get(sp.id);
        if (rp) {
          rp.seasonStats = { ...sp.seasonStats };
          rp.suspendedRounds = sp.suspendedRounds;
          rp.seasonYellowsSinceBan = sp.seasonYellowsSinceBan;
          rp.traits = sp.traits ? [...sp.traits] : rp.traits;
          rp.hiddenTrait = sp.hiddenTrait;
          rp.fitness = sp.fitness;
        }
      }
    }
  }

  private captureSeasonMemory(fixture: FixtureMatch, res: MatchState, userClub: LeagueClub): void {
    const userIsHome = fixture.homeClubId === this.state.userClubId;
    const userSide: 'home' | 'away' = userIsHome ? 'home' : 'away';
    const oppSide: 'home' | 'away' = userIsHome ? 'away' : 'home';
    const oppClubId = userIsHome ? fixture.awayClubId : fixture.homeClubId;
    const oppClub = this.state.clubs.find(c => c.id === oppClubId);
    const oppName = oppClub?.name ?? '对手';
    const myGoals = userIsHome ? fixture.homeGoals : fixture.awayGoals;
    const oppGoals = userIsHome ? fixture.awayGoals : fixture.homeGoals;
    const scoreText = `${myGoals}:${oppGoals}`;
    const round = this.state.currentRound;
    const margin = Math.abs(myGoals - oppGoals);

    const styleLabels: Record<TacticalStyle, string> = {
      tiki_taka: '传控渗透',
      gegenpress: '高位逼抢',
      balanced: '均衡阵地',
      wing_play: '两翼齐飞',
      counter: '快速反击',
      park_bus: '铁桶防反',
    };
    const userFormation = userClub.formation;
    const oppFormation = oppClub?.formation ?? (userIsHome ? res.awayFormation : res.homeFormation) ?? '4-4-2';
    const oppStyle = oppClub ? styleLabels[oppClub.style] : undefined;

    const myStats = userIsHome ? res.stats.home : res.stats.away;
    const oppStats = userIsHome ? res.stats.away : res.stats.home;
    const totPoss = (myStats.possessionTicks + oppStats.possessionTicks) || 1;
    const myPossPct = Math.round((myStats.possessionTicks / totPoss) * 100);
    const xgText = `xG ${myStats.xG.toFixed(2)} : ${oppStats.xG.toFixed(2)}`;
    const possessionText = `控球 ${myPossPct}% : ${100 - myPossPct}%`;

    const standings = this.getStandings();
    const userRank = standings.findIndex(s => s.clubId === this.state.userClubId) + 1;
    const oppRank = standings.findIndex(s => s.clubId === oppClubId) + 1;

    // 找出敌方焦点球员与我方关键助攻手
    const oppStandout = [...res.players]
      .filter(p => p.team === oppSide)
      .sort((a, b) =>
        (b.matchStats.goals * 4 + b.matchStats.assists * 2 + (b.redCard ? 2 : 0) + b.matchStats.saves * 0.5) -
        (a.matchStats.goals * 4 + a.matchStats.assists * 2 + (a.redCard ? 2 : 0) + a.matchStats.saves * 0.5)
      )[0];
    const oppPlayerLabel = oppStandout
      ? `${oppStandout.name}(${oppStandout.matchStats.goals > 0 ? `${oppStandout.matchStats.goals}球` : oppStandout.redCard ? '红牌' : oppStandout.role === 'GK' ? `${oppStandout.matchStats.saves}扑` : oppStandout.role})`
      : undefined;

    const userTopAssister = [...res.players]
      .filter(p => p.team === userSide && p.matchStats.assists > 0)
      .sort((a, b) => b.matchStats.assists - a.matchStats.assists)[0];

    const baseMeta = {
      oppPlayerName: oppPlayerLabel,
      assistPlayerName: userTopAssister?.name,
      userFormation,
      oppFormation,
      oppStyle,
      xgText,
      possessionText,
    };

    const candidates: SeasonMemory[] = [];
    const goalEvents = res.events.filter(e => e.type === 'goal');

    // 追踪比赛过程中的最大落后/领先分差，用于逆转判定
    let hScore = 0;
    let aScore = 0;
    let maxUserDeficit = 0;
    let maxUserLead = 0;
    for (const ev of goalEvents) {
      if (ev.team === 'home') hScore++;
      else aScore++;
      const diff = userIsHome ? (hScore - aScore) : (aScore - hScore);
      if (diff < 0 && -diff > maxUserDeficit) maxUserDeficit = -diff;
      if (diff > 0 && diff > maxUserLead) maxUserLead = diff;
    }

    // 1. LATE_WINNER: 85'+ 决定胜负/绝平的关键进球
    if (margin <= 1 && goalEvents.length > 0) {
      const lastGoal = goalEvents[goalEvents.length - 1];
      if (lastGoal.minute >= 85) {
        const userScored = lastGoal.team === userSide;
        if (userScored && myGoals >= oppGoals) {
          const isWin = myGoals > oppGoals;
          const assister = lastGoal.targetName ?? userTopAssister?.name;
          candidates.push({
            id: `mem_s${this.state.seasonNumber}_r${round}_late`,
            round,
            kind: 'LATE_WINNER',
            badge: isWin ? '读秒绝杀' : '压哨绝平',
            title: `第${lastGoal.minute}分钟 ${lastGoal.playerName} ${isWin ? '绝杀' : '绝平'}！`,
            summary: `第${round}轮${userIsHome ? '主场' : '客场'}战${oppName}(${oppFormation})，${assister ? `${assister}送出致命助攻，` : ''}${lastGoal.playerName}第${lastGoal.minute}分钟一锤定音，${scoreText}带走积分。`,
            scoreText,
            oppName,
            playerName: lastGoal.playerName,
            ...baseMeta,
            assistPlayerName: assister,
            contextTag: userIsHome ? '主场绝杀' : '客场绝杀',
            minute: lastGoal.minute,
            dramaScore: (isWin ? 95 : 89) + Math.min(5, lastGoal.minute - 85),
            isPainful: false,
          });
        } else if (!userScored && myGoals <= oppGoals) {
          const isLoss = myGoals < oppGoals;
          candidates.push({
            id: `mem_s${this.state.seasonNumber}_r${round}_late_pain`,
            round,
            kind: 'LATE_WINNER',
            badge: isLoss ? '惨遭绝杀' : '痛失三分',
            title: `第${lastGoal.minute}分钟遭${oppName}·${lastGoal.playerName}绝杀`,
            summary: `第${round}轮读秒时刻被${oppName}的${lastGoal.playerName}破门，${scoreText}抱憾而归。`,
            scoreText,
            oppName,
            playerName: lastGoal.playerName,
            ...baseMeta,
            oppPlayerName: `${lastGoal.playerName}(${lastGoal.minute}'绝杀)`,
            contextTag: '读秒失守',
            minute: lastGoal.minute,
            dramaScore: (isLoss ? 92 : 85) + Math.min(5, lastGoal.minute - 85),
            isPainful: true,
          });
        }
      }
    }

    // 2. COMEBACK: 落后2球及以上完成翻盘/追平，或领先2球及以上被翻盘
    if (maxUserDeficit >= 2 && myGoals >= oppGoals) {
      const won = myGoals > oppGoals;
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_comeback`,
        round,
        kind: 'COMEBACK',
        badge: won ? '惊天逆转' : '绝地追平',
        title: won ? `落后${maxUserDeficit}球逆转${oppName}！` : `落后${maxUserDeficit}球顽强追平${oppName}`,
        summary: `第${round}轮一度落后${maxUserDeficit}球仍未放弃，${userClub.name}(${userFormation})连追反扑，终场定格在${scoreText}。`,
        scoreText,
        oppName,
        ...baseMeta,
        contextTag: `逆转${maxUserDeficit}球`,
        dramaScore: won ? 91 : 85,
        isPainful: false,
      });
    } else if (maxUserLead >= 2 && myGoals < oppGoals) {
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_choke`,
        round,
        kind: 'COMEBACK',
        badge: '遭逆转翻盘',
        title: `两球领先被${oppName}逆转`,
        summary: `第${round}轮手握${maxUserLead}球优势却没能守住胜果，${oppPlayerLabel ? `被${oppPlayerLabel}率队反扑，` : ''}最终${scoreText}痛失好局。`,
        scoreText,
        oppName,
        ...baseMeta,
        contextTag: '领先被翻',
        dramaScore: 87,
        isPainful: true,
      });
    }

    // 3. UPSET: 以下克上 / 爆冷翻车 (排名相差 >= 5 名)
    if (round >= 5 && userRank > 0 && oppRank > 0) {
      if (myGoals > oppGoals && userRank - oppRank >= 5) {
        candidates.push({
          id: `mem_s${this.state.seasonNumber}_r${round}_upset`,
          round,
          kind: 'UPSET',
          badge: '以下克上',
          title: `第${userRank}名掀翻第${oppRank}名${oppName}！`,
          summary: `第${round}轮以弱胜强，${userClub.name}用${userFormation}阵型${scoreText}击败排名第${oppRank}的${oppName}。`,
          scoreText,
          oppName,
          ...baseMeta,
          contextTag: `第${userRank}斩第${oppRank}`,
          dramaScore: 88,
          isPainful: false,
        });
      } else if (myGoals < oppGoals && oppRank - userRank >= 6 && userRank <= 4) {
        candidates.push({
          id: `mem_s${this.state.seasonNumber}_r${round}_upset_pain`,
          round,
          kind: 'UPSET',
          badge: '阴沟翻船',
          title: `爆冷不敌第${oppRank}名${oppName}`,
          summary: `第${round}轮排名前列的${userClub.name}意外失手，${scoreText}负于${oppName}${oppPlayerLabel ? `(${oppPlayerLabel})` : ''}。`,
          scoreText,
          oppName,
          ...baseMeta,
          contextTag: `爆冷输第${oppRank}`,
          dramaScore: 84,
          isPainful: true,
        });
      }
    }

    // 4. RED_CARD_STAND: 少打一人抢分/失利
    const userRedPlayer = res.players.find(p => p.team === userSide && p.redCard);
    const oppRedPlayer = res.players.find(p => p.team === oppSide && p.redCard);
    if (userRedPlayer && myGoals >= oppGoals) {
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_red_stand`,
        round,
        kind: 'RED_CARD_STAND',
        badge: '十人铁血',
        title: `${userRedPlayer.name}染红下仍${myGoals > oppGoals ? '力克' : '逼平'}${oppName}`,
        summary: `第${round}轮${userRedPlayer.name}被罚下少打一人，全队众志成城${scoreText}守住积分！`,
        scoreText,
        oppName,
        playerName: userRedPlayer.name,
        ...baseMeta,
        contextTag: '少打一人',
        dramaScore: myGoals > oppGoals ? 89 : 83,
        isPainful: false,
      });
    } else if (oppRedPlayer && myGoals < oppGoals) {
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_red_pain`,
        round,
        kind: 'RED_CARD_STAND',
        badge: '多打一人失利',
        title: `多打一人仍负于${oppName}`,
        summary: `第${round}轮${oppName}的${oppRedPlayer.name}染红离场，但我方未能把握人数优势，${scoreText}惜败。`,
        scoreText,
        oppName,
        ...baseMeta,
        contextTag: '强攻未果',
        dramaScore: 81,
        isPainful: true,
      });
    }

    // 5. TITLE_CLASH: 天王山之战 / 宿敌死磕
    const isRival = this.state.storyline?.id === 'revenge' && this.state.storyline.rivalClubId === oppClubId;
    const isTopClash = round >= 8 && userRank > 0 && oppRank > 0 && userRank <= 3 && oppRank <= 3;
    if ((isTopClash || isRival) && myGoals !== oppGoals) {
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_clash`,
        round,
        kind: 'TITLE_CLASH',
        badge: isRival ? '宿敌死磕' : '天王山之战',
        title: `${isRival ? '宿敌战' : '榜首战'}${myGoals > oppGoals ? '力克' : '惜败'}${oppName}`,
        summary: `第${round}轮${isTopClash ? `第${userRank}名与第${oppRank}名强强对话` : '宿敌恩怨对决'}，最终${scoreText}分出高下。`,
        scoreText,
        oppName,
        ...baseMeta,
        contextTag: isRival ? '宿敌德比' : `前${Math.max(userRank, oppRank)}对话`,
        dramaScore: myGoals > oppGoals ? 86 : 82,
        isPainful: myGoals < oppGoals,
      });
    }

    // 6. CONTROVERSY: 红牌+点球 或 75'+ 点球且分差<=1
    const hasRed = res.events.some(e => e.type === 'red_card');
    const penaltyEv = res.events.find(e => e.text?.includes('点球'));
    if (margin <= 1 && ((hasRed && penaltyEv) || (penaltyEv && penaltyEv.minute >= 75))) {
      const painful = myGoals < oppGoals;
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_var`,
        round,
        kind: 'CONTROVERSY',
        badge: '争议判罚',
        title: painful ? `争议红点夜惜败${oppName}` : `顶住红点判罚战${oppName}`,
        summary: `第${round}轮场面火药味十足，关键${hasRed ? '红牌与' : ''}点球判罚左右战局，最终比分${scoreText}。`,
        scoreText,
        oppName,
        ...baseMeta,
        contextTag: hasRed ? '红牌+点球' : '末段点球',
        minute: penaltyEv?.minute,
        dramaScore: 82,
        isPainful: painful,
      });
    }

    // 7. GOAL_FEST: 进球大战(>=6球) 或 >=4球屠杀/惨败
    const totalGoals = myGoals + oppGoals;
    if (totalGoals >= 6 || margin >= 4) {
      const isRoutWin = myGoals - oppGoals >= 4;
      const isRoutLoss = oppGoals - myGoals >= 4;
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_fest`,
        round,
        kind: 'GOAL_FEST',
        badge: isRoutWin ? '火力狂飙' : isRoutLoss ? '惨痛溃败' : '进球大战',
        title: isRoutWin ? `${scoreText}横扫${oppName}` : isRoutLoss ? `${scoreText}惨败${oppName}` : `${scoreText}对攻大战${oppName}`,
        summary: `第${round}轮双方大开大合，${totalGoals}粒进球引爆全场（${xgText}）。`,
        scoreText,
        oppName,
        ...baseMeta,
        contextTag: `${totalGoals}球盛宴`,
        dramaScore: isRoutWin ? 85 : isRoutLoss ? 83 : 82,
        isPainful: isRoutLoss,
      });
    }

    // 8. AWAKENING: 隐藏特质觉醒夜
    const awakened = (res.unlockedHiddenTraits || []).find(u => u.team === userSide);
    if (awakened && myGoals >= oppGoals) {
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_awaken`,
        round,
        kind: 'AWAKENING',
        badge: '潜能觉醒',
        title: `${awakened.playerName} 觉醒【${awakened.trait}】`,
        summary: `第${round}轮战${oppName}关键时刻，${awakened.playerName}突破极限当场觉醒【${awakened.trait}】，率队${scoreText}！`,
        scoreText,
        oppName,
        playerName: awakened.playerName,
        ...baseMeta,
        contextTag: `觉醒·${awakened.trait}`,
        dramaScore: 84,
        isPainful: false,
      });
    }

    // 9. HEROIC: 帽子戏法 或 门将单场>=8次扑救零封/取胜
    const hatHero = res.players
      .filter(p => p.team === userSide && p.matchStats.goals >= 3)
      .sort((a, b) => b.matchStats.goals - a.matchStats.goals)[0];
    if (hatHero) {
      candidates.push({
        id: `mem_s${this.state.seasonNumber}_r${round}_hat`,
        round,
        kind: 'HEROIC',
        badge: '个人封神',
        title: `${hatHero.name} 戴帽主宰比赛`,
        summary: `第${round}轮${hatHero.name}单场轰入${hatHero.matchStats.goals}球，率队${scoreText}力克${oppName}。`,
        scoreText,
        oppName,
        playerName: hatHero.name,
        ...baseMeta,
        contextTag: `单场${hatHero.matchStats.goals}球`,
        dramaScore: 87,
        isPainful: false,
      });
    } else {
      const gkHero = res.players
        .filter(p => p.team === userSide && p.role === 'GK' && p.matchStats.saves >= 8)
        .sort((a, b) => b.matchStats.saves - a.matchStats.saves)[0];
      if (gkHero && (myGoals > oppGoals || oppGoals === 0)) {
        candidates.push({
          id: `mem_s${this.state.seasonNumber}_r${round}_gk`,
          round,
          kind: 'HEROIC',
          badge: '门神降临',
          title: `${gkHero.name} ${gkHero.matchStats.saves}扑守住城池`,
          summary: `第${round}轮面对${oppName}狂轰滥炸，${gkHero.name}高接低挡做出${gkHero.matchStats.saves}次扑救，${scoreText}全身而退。`,
          scoreText,
          oppName,
          playerName: gkHero.name,
          ...baseMeta,
          contextTag: `${gkHero.matchStats.saves}次扑救`,
          dramaScore: 81,
          isPainful: false,
        });
      }
    }

    if (candidates.length === 0) return;
    candidates.sort((a, b) => b.dramaScore - a.dramaScore);
    const best = candidates[0];
    if (!this.state.seasonMemories) this.state.seasonMemories = [];
    this.state.seasonMemories.push(best);
    // 按戏剧分排序，保留最多 4 条高光记忆（优先不同类型多样性）
    this.state.seasonMemories.sort((a, b) => b.dramaScore - a.dramaScore);
    if (this.state.seasonMemories.length > 4) {
      this.state.seasonMemories = this.state.seasonMemories.slice(0, 4);
    }
  }

  private advanceAfterRound(): void {
    const r = this.state.currentRound;
    const tier = this.state.currentTier ?? 7;
    const totalRounds = this.getTotalRegularRounds();
    const midRound = this.getMidSeasonRound();

    // 常规赛阶段节点结束后，AI 球队同步补强（玩家侧的赛季词条与强援已并入赛后 3 选 1）
    if (this.state.phase === 'REGULAR_SEASON' && this.getReDraftRounds().has(r)) {
      for (const aiClub of this.state.clubs) {
        if (aiClub.isUser) continue;
        const aiOffer = createReDraftOffer(r, aiClub.perks.map(p => p.id), undefined, tier);
        const sortedCand = [...aiOffer.candidates].sort((a, b) => b.ca - a.ca);
        const lowestIndices = aiClub.squad
          .map((p, idx) => ({ idx, ca: p.ca, role: p.role }))
          .filter(x => x.role !== 'GK')
          .sort((a, b) => a.ca - b.ca)
          .slice(0, 2);
        for (let k = 0; k < lowestIndices.length && k < sortedCand.length; k++) {
          if (sortedCand[k].ca > aiClub.squad[lowestIndices[k].idx].ca) {
            aiClub.squad[lowestIndices[k].idx] = sortedCand[k];
          }
        }
        if (aiOffer.perkChoices.length > 0) {
          aiClub.perks.push(aiOffer.perkChoices[0]);
        }
        aiClub.starterIds = autoSelectStarters(aiClub.squad, aiClub.formation);
      }
    }

    // 双循环常规赛全部结束 -> 直接按积分榜排名结算并执行 7 级联赛升降级
    if (this.state.phase === 'REGULAR_SEASON' && r >= totalRounds) {
      const standings = this.getStandings();
      const userRank = standings.findIndex(s => s.clubId === this.state.userClubId) + 1;
      this.finalizeSeason(userRank);
      return;
    }

    // 半程结束 -> 开启冬季转会窗（青训成长+自然揭雾+补招至6人，刷新冬窗货架）
    if (this.state.phase === 'REGULAR_SEASON' && r === midRound && this.state.winterWindowDoneSeason !== this.state.seasonNumber) {
      this.state.phase = 'WINTER_WINDOW';
      this.advanceYouthAcademyMidSeason();
      this.refreshTransferShelfForWindow();
      return;
    }

    // 常规赛下一轮
    this.state.currentRound = r + 1;
    const storyR1 = Math.max(3, Math.round(totalRounds * 0.26));
    const storyR2 = Math.max(storyR1 + 2, midRound);
    if ((this.state.currentRound === storyR1 || this.state.currentRound === storyR2) && this.state.storyline) {
      const mappedRound = this.state.currentRound === storyR1 ? 3 : 5;
      this.state.pendingStoryEvent = createMidSeasonChoice(this.state.storyline, mappedRound);
    }
  }

  // ==================== 4. Re-Draft 补强 ====================

  public swapPlayerInReDraft(dropPlayerId: string, pickCandidateId: string): { ok: boolean; reason?: string } {
    if (this.state.phase !== 'RE_DRAFT' || !this.state.reDraft) {
      return { ok: false, reason: '当前不在 Re-Draft 阶段' };
    }
    const rd = this.state.reDraft;
    if (rd.swapsUsed >= rd.maxSwaps) {
      return { ok: false, reason: '本轮更换名额已用完' };
    }

    const club = this.getUserClub();
    const dropIdx = club.squad.findIndex(p => p.id === dropPlayerId);
    const pickIdx = rd.candidates.findIndex(p => p.id === pickCandidateId);
    if (dropIdx < 0 || pickIdx < 0) {
      return { ok: false, reason: '无效的球员选择' };
    }

    const picked = rd.candidates.splice(pickIdx, 1)[0];
    picked.isNewSigning = true;
    club.squad[dropIdx] = picked;
    // 若被替换的是首发，则新援直接接替该首发槽位；若替换的是替补，则新援进入替补席可供战术换人
    const starterIdx = club.starterIds.indexOf(dropPlayerId);
    if (starterIdx >= 0) {
      club.starterIds[starterIdx] = picked.id;
    }
    if (this.state.persistentSquad) {
      this.state.persistentSquad = JSON.parse(JSON.stringify(club.squad));
    }
    rd.swapsUsed++;
    return { ok: true };
  }

  public chooseReDraftPerk(perkId: string): { ok: boolean } {
    if (this.state.phase !== 'RE_DRAFT' || !this.state.reDraft) return { ok: false };
    const perk = this.state.reDraft.perkChoices.find(p => p.id === perkId);
    if (!perk) return { ok: false };
    const club = this.getUserClub();
    club.perks.push(perk);
    this.state.reDraft.perkChosen = true;
    const syn = computePerkSynergies(club.perks);
    if (syn.synergies.length > 0) {
      tryUnlockAchievement(this.state, 'ach_synergy');
    }
    if (syn.counts.attack >= 1 && syn.counts.defense >= 1 && syn.counts.control >= 1) {
      tryUnlockAchievement(this.state, 'ach_triple_synergy');
    }
    return { ok: true };
  }

  public finishReDraft(): void {
    if (this.state.phase !== 'RE_DRAFT') return;
    const club = this.getUserClub();
    const squadIds = new Set(club.squad.map(p => p.id));
    const validStarters = club.starterIds.filter(id => squadIds.has(id));
    if (validStarters.length !== 11) {
      club.starterIds = autoSelectStarters(club.squad, club.formation);
    }
    this.state.reDraft = null;
    this.state.phase = 'REGULAR_SEASON';
    this.state.currentRound++;
    if ((this.state.currentRound === 9 || this.state.currentRound === 18) && this.state.storyline) {
      const mappedRound = this.state.currentRound === 9 ? 3 : 5;
      this.state.pendingStoryEvent = createMidSeasonChoice(this.state.storyline, mappedRound);
    }
  }

  public resolveStoryEvent(optionId: string): { ok: boolean } {
    const ev = this.state.pendingStoryEvent;
    if (!ev) return { ok: false };
    const opt = ev.options.find(o => o.id === optionId) || ev.options[0];
    if (!opt) return { ok: false };

    const club = this.getUserClub();
    const clamp = (v: number) => Math.max(25, Math.min(99, v));
    for (const p of club.squad) {
      if (opt.effect) {
        if (opt.effect.passingBonus) p.attributes.passing = clamp(p.attributes.passing + opt.effect.passingBonus);
        if (opt.effect.shootingBonus) p.attributes.shooting = clamp(p.attributes.shooting + opt.effect.shootingBonus);
        if (opt.effect.defendingBonus) p.attributes.defending = clamp(p.attributes.defending + opt.effect.defendingBonus);
        if (opt.effect.paceBonus) p.attributes.pace = clamp(p.attributes.pace + opt.effect.paceBonus);
        if (opt.effect.staminaBonus) p.attributes.stamina = clamp(p.attributes.stamina + opt.effect.staminaBonus);
        if (opt.effect.goalkeepingBonus && p.role === 'GK') {
          p.attributes.goalkeeping = clamp(p.attributes.goalkeeping + opt.effect.goalkeepingBonus);
        }
      }
      if (opt.youngBoost && p.age <= 23) {
        p.attributes.passing = clamp(p.attributes.passing + 2);
        p.attributes.shooting = clamp(p.attributes.shooting + 2);
      }
      if (opt.veteranBoost && p.age >= 28) {
        p.attributes.defending = clamp(p.attributes.defending + 3);
        p.attributes.composure = clamp(p.attributes.composure + 3);
      }
      p.ca = computeWeightedCA(p.role, p.attributes);
    }

    if (opt.metaPointsDelta) {
      this.state.metaPointsTotal += opt.metaPointsDelta;
    }
    recordChronicleChoice(this.state, ev, opt.label);
    this.state.storyLog = this.state.storyLog ?? [];
    this.state.storyLog.push(`R${ev.round}: ${ev.title} -> ${opt.label}`);
    this.state.pendingStoryEvent = null;
    return { ok: true };
  }

  // ==================== 4.5 跨赛季编年史与赛间缓和期（整备 + 球员沟通） ====================

  public getChronicles(): ChronicleProgress[] {
    const map = ensureChronicles(this.state);
    return Object.values(map);
  }

  public getInterMatchPrep(): InterMatchPrepState | null {
    if (this.state.phase !== 'REGULAR_SEASON') return null;
    if (!this.state.interMatchPrep) {
      this.state.interMatchPrep = createInterMatchPrep(this.state, this.getUserClub());
    }
    return this.state.interMatchPrep;
  }

  public applyPrepTraining(kind: PrepTrainingKind): { ok: boolean; msg?: string } {
    const prep = this.getInterMatchPrep();
    if (!prep) return { ok: false, msg: '当前不在常规赛备战期' };
    if (prep.actionsLeft <= 0) return { ok: false, msg: '本轮赛前整备次数已用完' };
    const club = this.getUserClub();
    const clamp = (v: number) => Math.max(25, Math.min(99, v));
    let msg = '';
    if (kind === 'physio') {
      const tired = [...club.squad].sort((a, b) => (a.strainWarning ? -1 : 0) - (b.strainWarning ? -1 : 0) || (a.fitness ?? 100) - (b.fitness ?? 100)).slice(0, 3);
      for (const p of tired) {
        p.fitness = Math.min(100, (p.fitness ?? 100) + 14);
        p.strainWarning = false;
        if ((p.injuredRounds ?? 0) > 0) p.injuredRounds = Math.max(0, (p.injuredRounds ?? 0) - 1);
      }
      msg = `理疗恢复：${tired.map(p => p.name).join('、')} 消除疲惫/体能 +14%`;
    } else if (kind === 'tactical') {
      for (const p of club.squad) {
        const cur = this.getPlayerFamiliarity(p, club.formation);
        p.formationFamiliarity = p.formationFamiliarity ?? {};
        p.formationFamiliarity[club.formation] = Math.min(100, cur + 4);
      }
      prep.nextMatchBuff = {
        ...(prep.nextMatchBuff ?? {}),
        passingBonus: (prep.nextMatchBuff?.passingBonus ?? 0) + 2,
        defendingBonus: (prep.nextMatchBuff?.defendingBonus ?? 0) + 2,
        note: '战术演练生效：下场全队传球/防守 +2，当前阵型熟练度 +4',
      };
      msg = '战术演练：下场比赛全队传球与防守 +2，全队当前阵型熟练度 +4';
    } else if (kind === 'mentor') {
      const rookies = club.squad.filter(p => p.age <= 22);
      if (rookies.length > 0) {
        const pick = rookies[Math.floor(Math.random() * rookies.length)];
        pick.attributes.passing = clamp(pick.attributes.passing + 1);
        pick.attributes.composure = clamp(pick.attributes.composure + 1);
        pick.ca = computeWeightedCA(pick.role, pick.attributes);
        msg = `青年指导：${pick.name} 传球+1、冷静+1`;
      } else {
        const pick = club.squad[Math.floor(Math.random() * club.squad.length)];
        pick.attributes.composure = clamp(pick.attributes.composure + 1);
        msg = `全队加练：${pick.name} 冷静 +1`;
      }
    } else {
      prep.nextMatchBuff = {
        ...(prep.nextMatchBuff ?? {}),
        shootingBonus: (prep.nextMatchBuff?.shootingBonus ?? 0) + 2,
        composureBonus: (prep.nextMatchBuff?.composureBonus ?? 0) + 2,
        note: '定位球加练：下场全队射门/冷静 +2',
      };
      msg = '射门加练：下场比赛全队射门与冷静 +2';
    }
    prep.doneTraining = kind;
    prep.actionsLeft -= 1;
    return { ok: true, msg };
  }

  public scoutOpponent(): { ok: boolean; msg?: string } {
    const prep = this.getInterMatchPrep();
    if (!prep || !prep.matchupIntel) return { ok: false, msg: '暂无对手情报' };
    if (prep.actionsLeft <= 0) return { ok: false, msg: '本轮整备行动点已用完' };
    if (prep.matchupIntel.scoutedThisRound) return { ok: false, msg: '本轮已完成对该对手的球探侦察' };
    const prev = prep.matchupIntel;
    const rec = getOpponentIntelRecord(this.state, prev.oppClubId);
    rec.familiarity = Math.min(100, rec.familiarity + 30);
    const refreshed = buildOpponentMatchupIntel(this.state, this.getUserClub());
    if (refreshed) {
      refreshed.scoutedThisRound = true;
      refreshed.chosenCounterId = prev.chosenCounterId;
      refreshed.spotCorrect = prev.spotCorrect;
      refreshed.usedDebunk = prev.usedDebunk;
      refreshed.chosenRewardKind = prev.chosenRewardKind;
      refreshed.mastery = prev.mastery;
      refreshed.counterElements = prev.counterElements;
      refreshed.counterStyles = prev.counterStyles;
      refreshed.activeDebuff = prev.activeDebuff;
      refreshed.masteryBonusElement = prev.masteryBonusElement;
      if (prev.analysisPoints !== undefined && refreshed.analysisPoints !== undefined) {
        refreshed.analysisPoints = Math.min(refreshed.maxAnalysisPoints ?? 3, prev.analysisPoints + 1);
      }
      if (prev.zones && refreshed.zones) {
        const scannedSet = new Set(prev.zones.filter(z => z.scanned).map(z => z.id));
        refreshed.zones = refreshed.zones.map(z => ({ ...z, scanned: z.scanned || scannedSet.has(z.id) }));
      }
      prep.matchupIntel = refreshed;
    }
    prep.actionsLeft -= 1;
    return { ok: true, msg: `深度侦察完成！对【${prep.matchupIntel.oppClubName}】了解度升至 ${rec.familiarity}%，分析点 +1` };
  }

  public scanOpponentZone(zoneId: ScoutingZoneId): { ok: boolean; msg?: string } {
    const prep = this.getInterMatchPrep();
    const intel = prep?.matchupIntel;
    if (!prep || !intel) return { ok: false, msg: '暂无对手情报' };
    const zones = intel.zones ?? [];
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return { ok: false, msg: '未找到对应区域录像' };
    if (zone.scanned) return { ok: true, msg: `${zone.label}：${zone.summary}` };
    const ap = intel.analysisPoints ?? 2;
    if (ap <= 0) return { ok: false, msg: '本轮分析点数已用完，请直接对比线索并拍案指证！' };

    intel.analysisPoints = ap - 1;
    zone.scanned = true;
    const rec = getOpponentIntelRecord(this.state, intel.oppClubId);
    rec.familiarity = Math.min(100, rec.familiarity + 10);
    intel.familiarity = rec.familiarity;

    return {
      ok: true,
      msg: zone.isWeakZone
        ? `录像扫描发现异常【${zone.label}】：${zone.summary}`
        : `录像扫描【${zone.label}】：${zone.summary}（未见明显破绽）`,
    };
  }

  public debunkSmokeClue(): { ok: boolean; msg?: string } {
    const prep = this.getInterMatchPrep();
    const intel = prep?.matchupIntel;
    if (!prep || !intel) return { ok: false, msg: '暂无对手情报' };
    if (intel.chosenCounterId) return { ok: false, msg: '本轮已完成战术指证' };
    const smoke = intel.clues.find(c => c.isSmoke && !c.debunked);
    if (!smoke) return { ok: false, msg: '当前线索均已交叉核实，无虚假烟雾弹' };
    const ap = intel.analysisPoints ?? 2;
    if (ap <= 0) return { ok: false, msg: '分析点数不足，无法交叉核实' };

    intel.analysisPoints = ap - 1;
    intel.usedDebunk = true;
    smoke.debunked = true;
    return { ok: true, msg: '交叉核实成功！已识破并剔除 1 条虚假烟雾弹' };
  }

  public chooseOpponentCounter(counterId: string): { ok: boolean; correct?: boolean; mastery?: 'master' | 'standard'; msg?: string } {
    const prep = this.getInterMatchPrep();
    const intel = prep?.matchupIntel;
    if (!prep || !intel) return { ok: false, msg: '暂无对手情报' };
    if (intel.chosenCounterId) return { ok: false, msg: '本轮已完成战术指证' };
    const opt = intel.counters.find(c => c.id === counterId);
    if (!opt) return { ok: false, msg: '无效的指证方案' };
    intel.chosenCounterId = opt.id;
    intel.spotCorrect = opt.isCorrect;
    if (opt.isCorrect) {
      intel.counterElements = opt.counterElements;
      intel.counterStyles = opt.counterStyles;
      intel.activeDebuff = opt.oppDebuff;
      intel.mastery = !intel.usedDebunk ? 'master' : 'standard';
      if (intel.mastery === 'master') {
        tryUnlockAchievement(this.state, 'ach_scout_master');
      }
      let masteryBonusCardName = '';
      if (intel.mastery === 'master' && opt.counterElements?.[0]) {
        const bonusGene = opt.counterElements[0] as ElementId;
        const bonusCard = rollStyleConsumableCard(this.getUserClub().style, 1, bonusGene);
        const deckS = this.getCoachDeck();
        if (deckS.length < 60) deckS.push(bonusCard);
        masteryBonusCardName = bonusCard.name;
        intel.masteryBonusElement = opt.counterElements[0];
      }
      prep.nextMatchBuff = {
        ...(prep.nextMatchBuff ?? {}),
        passingBonus: (prep.nextMatchBuff?.passingBonus ?? 0) + (opt.buff.passingBonus ?? 0),
        shootingBonus: (prep.nextMatchBuff?.shootingBonus ?? 0) + (opt.buff.shootingBonus ?? 0),
        defendingBonus: (prep.nextMatchBuff?.defendingBonus ?? 0) + (opt.buff.defendingBonus ?? 0),
        paceBonus: (prep.nextMatchBuff?.paceBonus ?? 0) + (opt.buff.paceBonus ?? 0),
        energyBonus: (prep.nextMatchBuff?.energyBonus ?? 0) + (opt.buff.energyBonus ?? 0),
        note: opt.buff.note,
      };
      return {
        ok: true,
        correct: true,
        mastery: intel.mastery,
        msg:
          intel.mastery === 'master'
            ? `宗师洞察！未删错直抓破绽，额外获赠克制 1 阶卡【${masteryBonusCardName || '战术卡'}】！请选择本场针对红利`
            : `异议成立！${opt.buff.note} · 请选择 1 项赛中针对红利`,
      };
    }
    return { ok: true, correct: false, msg: '误判了烟雾弹！未触发针对性红利（无惩罚，可正常应战）' };
  }

  public chooseScoutReward(kind: ScoutRewardKind): { ok: boolean; msg?: string } {
    const prep = this.getInterMatchPrep();
    const intel = prep?.matchupIntel;
    if (!prep || !intel) return { ok: false, msg: '暂无对手情报' };
    if (!intel.spotCorrect) return { ok: false, msg: '破绽未指证成功，无法领取针对红利' };
    if (intel.chosenRewardKind) return { ok: false, msg: '本轮针对红利已锁定' };

    intel.chosenRewardKind = kind;
    const tagMsg =
      kind === 'buff_debuff'
        ? `红利锁定【手牌减费+对手减益】：克制元素手牌本场-1费+5分，且${intel.activeDebuff?.label || '削弱对手弱点'}`
        : `红利锁定【主动技超频】：克制流派主动技本场临时+1 Rank且首次释放免冷却`;
    prep.nextMatchBuff = {
      ...(prep.nextMatchBuff ?? {}),
      note: `${prep.nextMatchBuff?.note ? `${prep.nextMatchBuff.note} · ` : ''}${tagMsg}`,
    };
    return { ok: true, msg: tagMsg };
  }

  public resolvePlayerTalk(choice: 'A' | 'B'): { ok: boolean; msg?: string } {
    const prep = this.getInterMatchPrep();
    if (!prep || !prep.playerTalk || prep.playerTalk.resolved) {
      return { ok: false, msg: '当前没有待处理的球员沟通' };
    }
    const talk = prep.playerTalk;
    const opt = choice === 'A' ? talk.optA : talk.optB;
    const club = this.getUserClub();
    const player = club.squad.find(p => p.id === talk.playerId);
    let extraNote = '';
    if (opt.kind === 'rest' && player) {
      player.fitness = Math.min(100, (player.fitness ?? 100) + 18);
      player.strainWarning = false;
      player.morale = player.morale === 'low' ? 'normal' : 'high';
      if (club.starterIds.includes(player.id)) {
        const swaps = this.replaceUnavailableStarters(club, new Set([player.id]));
        if (swaps.length > 0) {
          extraNote = `（已自动轮休，由 ${swaps[0].inName} 暂代首发）`;
        }
      }
    } else if (opt.kind === 'promise_sub' && player) {
      if (talk.id.startsWith('talk_hot_')) {
        prep.nextMatchBuff = { ...(prep.nextMatchBuff ?? {}), passingBonus: (prep.nextMatchBuff?.passingBonus ?? 0) + 2 };
      } else {
        player.fitness = 100;
        if (player.morale === 'low') player.morale = 'normal';
      }
    } else if (opt.kind === 'promise_start') {
      if (player) player.morale = 'high';
      prep.nextMatchBuff = {
        ...(prep.nextMatchBuff ?? {}),
        playerId: talk.playerId,
        shootingBonus: (prep.nextMatchBuff?.shootingBonus ?? 0) + 4,
        passingBonus: (prep.nextMatchBuff?.passingBonus ?? 0) + 4,
      };
    } else if (opt.kind === 'boost') {
      prep.nextMatchBuff = {
        ...(prep.nextMatchBuff ?? {}),
        playerId: talk.playerId,
        shootingBonus: (prep.nextMatchBuff?.shootingBonus ?? 0) + (talk.id.startsWith('talk_hot_') ? 5 : 0),
        composureBonus: (prep.nextMatchBuff?.composureBonus ?? 0) + 4,
        defendingBonus: (prep.nextMatchBuff?.defendingBonus ?? 0) + 4,
      };
    }
    talk.resolved = true;
    talk.chosenLabel = opt.label;
    return { ok: true, msg: `${talk.playerName}：${opt.effectDesc}${extraNote}` };
  }

  // ==================== 5. 赛季结算与排行榜 ====================

  public getTopScorers(limit = 5): Array<{ playerName: string; clubName: string; goals: number; assists: number }> {
    const all: Array<{ playerName: string; clubName: string; goals: number; assists: number }> = [];
    for (const c of this.state.clubs) {
      for (const p of c.squad) {
        if (p.seasonStats.goals > 0 || p.seasonStats.assists > 0) {
          all.push({
            playerName: p.name,
            clubName: c.name,
            goals: p.seasonStats.goals,
            assists: p.seasonStats.assists,
          });
        }
      }
    }
    return all
      .sort((a, b) => (b.goals !== a.goals ? b.goals - a.goals : b.assists - a.assists))
      .slice(0, limit);
  }

  public getTopAssisters(limit = 5): Array<{ playerName: string; clubName: string; assists: number; goals: number }> {
    const all: Array<{ playerName: string; clubName: string; assists: number; goals: number }> = [];
    for (const c of this.state.clubs) {
      for (const p of c.squad) {
        if (p.seasonStats.assists > 0 || p.seasonStats.goals > 0) {
          all.push({
            playerName: p.name,
            clubName: c.name,
            assists: p.seasonStats.assists,
            goals: p.seasonStats.goals,
          });
        }
      }
    }
    return all
      .sort((a, b) => (b.assists !== a.assists ? b.assists - a.assists : b.goals - a.goals))
      .slice(0, limit);
  }

  public getUserTeamSeasonStats(): {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    xgFor: number;
    xgAgainst: number;
    cleanSheets: number;
    yellows: number;
    reds: number;
    topScorer: DraftPlayer | null;
    topAssister: DraftPlayer | null;
    topKeeper: DraftPlayer | null;
    ironMan: DraftPlayer | null;
  } {
    const club = this.getUserClub();
    const row = this.getStandings().find(r => r.isUser);
    let xgFor = 0;
    let xgAgainst = 0;
    let cleanSheets = 0;
    for (const fx of this.state.fixtures) {
      if (!fx.played) continue;
      if (fx.homeClubId === club.id) {
        xgFor += fx.homeXG ?? 0;
        xgAgainst += fx.awayXG ?? 0;
        if (fx.awayGoals === 0) cleanSheets++;
      } else if (fx.awayClubId === club.id) {
        xgFor += fx.awayXG ?? 0;
        xgAgainst += fx.homeXG ?? 0;
        if (fx.homeGoals === 0) cleanSheets++;
      }
    }
    const yellows = club.squad.reduce((s, p) => s + p.seasonStats.yellowCards, 0);
    const reds = club.squad.reduce((s, p) => s + p.seasonStats.redCards, 0);
    const topScorer = [...club.squad].sort((a, b) => b.seasonStats.goals - a.seasonStats.goals || b.ca - a.ca)[0] ?? null;
    const topAssister = [...club.squad].sort((a, b) => b.seasonStats.assists - a.seasonStats.assists || b.ca - a.ca)[0] ?? null;
    const topKeeper = [...club.squad].filter(p => p.role === 'GK').sort((a, b) => b.seasonStats.cleanSheets - a.seasonStats.cleanSheets || (b.seasonStats.saves ?? 0) - (a.seasonStats.saves ?? 0))[0] ?? null;
    const ironMan = [...club.squad].sort((a, b) => b.seasonStats.appearances - a.seasonStats.appearances || b.ca - a.ca)[0] ?? null;

    return {
      played: row?.played ?? 0,
      won: row?.won ?? 0,
      drawn: row?.drawn ?? 0,
      lost: row?.lost ?? 0,
      gf: row?.gf ?? 0,
      ga: row?.ga ?? 0,
      xgFor,
      xgAgainst,
      cleanSheets,
      yellows,
      reds,
      topScorer,
      topAssister,
      topKeeper,
      ironMan,
    };
  }

  private getRoleWeightedKeys(role: DraftPlayer['role']): Array<keyof PlayerAttributes> {
    if (role === 'GK') return ['goalkeeping', 'positioning', 'composure', 'passing'];
    if (role === 'CB') return ['defending', 'strength', 'positioning', 'pace', 'passing'];
    if (['LB', 'RB', 'LWB', 'RWB'].includes(role)) return ['pace', 'defending', 'passing', 'stamina', 'dribbling'];
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(role)) return ['passing', 'positioning', 'dribbling', 'stamina', 'defending', 'shooting'];
    return ['shooting', 'pace', 'dribbling', 'positioning', 'composure'];
  }

  private computeSeasonTargetAttrGain(p: DraftPlayer, seasonAge: number, goodPerf: boolean, tgLv: number): number {
    const pa = p.pa ?? Math.min(96, p.ca + (seasonAge <= 23 ? 16 : seasonAge <= 27 ? 8 : 3));
    const effectiveCa = Math.max(20, p.ca - (p.seasonAttrGained ?? 0));
    const gap = Math.max(0, pa - effectiveCa);
    if (gap <= 0) return 0;
    if (seasonAge < 18) {
      const perfBonus = goodPerf ? 1 : 0;
      const tgBonus = tgLv >= 6 ? 1 : 0;
      return Math.min(gap, 3 + (gap >= 20 ? 1 : 0) + perfBonus + tgBonus);
    }
    if (seasonAge <= 23) {
      const perfBonus = goodPerf ? 2 : 0;
      const tgBonus = tgLv >= 8 ? 2 : tgLv >= 3 ? 1 : 0;
      const storyBonus = this.state.storyline?.id === 'wonderkid' ? 1 : 0;
      return Math.min(gap, 5 + Math.min(4, Math.ceil(gap / 6)) + perfBonus + tgBonus + storyBonus);
    }
    const perfBonus = goodPerf ? 1 : 0;
    return Math.min(gap, 2 + Math.min(3, Math.floor(gap / 6)) + perfBonus);
  }

  public getRetiringNoticePlayers(): DraftPlayer[] {
    const uc = this.getUserClub();
    const roster = this.getClubRoster();
    const map = new Map<string, DraftPlayer>();
    for (const p of [...uc.squad, ...roster]) {
      if (p.retiringAfterSeason) map.set(p.id, p);
    }
    return Array.from(map.values());
  }

  private markPreSeasonRetiringNotices(club: LeagueClub): void {
    const checkList = [...club.squad, ...this.getClubRoster()];
    for (const p of checkList) {
      if (p.isPrologueCaptain || p.id === 'captain_lin_feng') {
        p.retiringAfterSeason = true;
        continue;
      }
      const prof = this.resolvePlayerAgingProfile(p);
      p.retiringAfterSeason = ((p.age ?? 24) + 1) >= prof.retireAge;
    }
  }

  private resolvePlayerAgingProfile(p: DraftPlayer): {
    archetype: 'prodigy_early' | 'standard' | 'late_bloomer' | 'gk_longevity';
    cliffAge: number;
    retireAge: number;
  } {
    let archetype = p.agingArchetype;
    if (!archetype) {
      if (p.role === 'GK') {
        archetype = 'gk_longevity';
      } else if (
        p.goldTraits?.includes('铁肺覆盖') ||
        p.traits?.includes('铁肺覆盖') ||
        p.traits?.includes('大心脏')
      ) {
        archetype = 'late_bloomer';
      } else {
        let h = 0;
        for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
        const mod = Math.abs(h) % 100;
        archetype = mod < 18 ? 'prodigy_early' : mod < 38 ? 'late_bloomer' : 'standard';
      }
      p.agingArchetype = archetype;
    }
    const base =
      archetype === 'prodigy_early'
        ? { cliff: 30, retire: 33 }
        : archetype === 'late_bloomer'
        ? { cliff: 34, retire: 37 }
        : archetype === 'gk_longevity'
        ? { cliff: 35, retire: 38 }
        : { cliff: 32, retire: 35 };
    const injuries = p.careerInjuries ?? 0;
    const injShift = injuries >= 3 ? 2 : injuries === 2 ? 1 : 0;
    return {
      archetype,
      cliffAge: base.cliff - injShift,
      retireAge: base.retire - injShift,
    };
  }

  private finalizeSeason(finalRank: number): void {
    const standings = this.getStandings();
    const regularRank = standings.findIndex(s => s.clubId === this.state.userClubId) + 1;
    const userRow = standings[regularRank - 1];
    const tier = this.state.currentTier ?? 7;
    const tierInfo = getLeagueTierInfo(tier);

    // 7 级联赛升降级判定（前 3 升级，后 3 降级；第 1 级无升级，第 7 级无降级）
    let promotionStatus: 'promoted' | 'relegated' | 'stayed' = 'stayed';
    let newTier = tier;
    if (tier > 1 && regularRank <= tierInfo.promoteCount) {
      promotionStatus = 'promoted';
      newTier = tier - 1;
    } else if (tier < TOTAL_TIERS && regularRank > standings.length - tierInfo.relegateCount) {
      promotionStatus = 'relegated';
      newTier = tier + 1;
    }

    // 同步更新金字塔目录中的升降级球队位置
    if (this.state.leaguePyramid) {
      const pyr = this.state.leaguePyramid;
      const curList = pyr[tier] ?? [];
      const orderedIds = standings.map(s => s.clubId);
      const entryMap = new Map(curList.map(e => [e.id, e]));
      const sortedCur = orderedIds.map(id => entryMap.get(id)).filter((e): e is ClubDirectoryEntry => !!e);
      if (sortedCur.length === curList.length) {
        const promoN = tier > 1 ? tierInfo.promoteCount : 0;
        const relN = tier < TOTAL_TIERS ? tierInfo.relegateCount : 0;
        const top3 = sortedCur.slice(0, promoN);
        const mid = sortedCur.slice(promoN, sortedCur.length - relN);
        const bot3 = sortedCur.slice(sortedCur.length - relN);

        const nextCur: ClubDirectoryEntry[] = [...mid];
        if (tier > 1 && pyr[tier - 1] && top3.length > 0) {
          const upper = pyr[tier - 1];
          const upperDrop = upper.splice(Math.max(0, upper.length - top3.length), top3.length);
          upper.push(...top3);
          nextCur.push(...upperDrop);
        } else {
          nextCur.unshift(...top3);
        }
        if (tier < TOTAL_TIERS && pyr[tier + 1] && bot3.length > 0) {
          const lower = pyr[tier + 1];
          const lowerUp = lower.splice(0, Math.min(bot3.length, lower.length));
          lower.push(...bot3);
          nextCur.push(...lowerUp);
        } else {
          nextCur.push(...bot3);
        }
        pyr[tier] = nextCur;
      }
    }
    this.state.currentTier = newTier;
    this.state.bestTierReached = Math.min(this.state.bestTierReached ?? 7, newTier);
    this.state.stayedTierCount = promotionStatus === 'stayed' ? (this.state.stayedTierCount ?? 0) + 1 : 0;
    if (promotionStatus === 'promoted') {
      recordChronicleMoment(
        this.state,
        'pyramid_climb',
        `第${this.state.seasonNumber}季 第${tier}级 第${regularRank}名成功升级！`,
        tier === 1 && finalRank === 1
      );
      recordChronicleMoment(
        this.state,
        'relegation_fight',
        `第${this.state.seasonNumber}季 逆风翻盘升入第${newTier}级`,
        true
      );
    } else if (tier === 1 && finalRank === 1) {
      recordChronicleMoment(
        this.state,
        'pyramid_climb',
        `第${this.state.seasonNumber}季 登顶第1级超级联赛冠军！`,
        true
      );
    } else if (promotionStatus === 'stayed') {
      recordChronicleMoment(
        this.state,
        'relegation_fight',
        `第${this.state.seasonNumber}季 第${tier}级 第${regularRank}名惊险保级`,
        true
      );
    }

    const rankBase =
      finalRank === 1 ? 140 :
      finalRank === 2 ? 95 :
      finalRank === 3 ? 75 :
      finalRank <= 6 ? 55 : Math.max(25, 50 - (finalRank - 6) * 2);
    const tierScaled = Math.round(rankBase * tierInfo.metaMul);
    const promoBonus = promotionStatus === 'promoted' ? 40 : 0;
    const champBonus = tier === 1 && finalRank === 1 ? 100 : 0;
    let metaEarned = tierScaled + promoBonus + champBonus;
    if ((this.state.metaLevels?.finance ?? 0) >= 8) {
      metaEarned = Math.round(metaEarned * 1.15);
    }
    let storyBonus = 0;
    if (this.state.storyline?.id === 'underdog') {
      const next = Math.round(metaEarned * 1.25);
      storyBonus = next - metaEarned;
      metaEarned = next;
    }

    this.state.metaPointsTotal += metaEarned;
    const finLv = this.state.metaLevels?.finance ?? 0;
    const broadcastBase = Math.round((160 + Math.max(0, 14 - regularRank) * 18 + (promotionStatus === 'promoted' ? 140 : 0) + (finalRank === 1 ? 180 : 0)) * (1 + (7 - tier) * 0.25));
    const broadcastMul = finLv >= 7 ? 1.4 : finLv >= 5 ? 1.25 : 1.0;
    const interestBonus = finLv >= 6 ? Math.min(300, Math.round(this.getClubFunds() * 0.05)) : 0;
    this.addClubFunds(Math.round(broadcastBase * broadcastMul) + interestBonus);
    const top = this.getTopScorers(1)[0];
    const topAst = this.getTopAssisters(1)[0];
    const hof = this.getHallOfFame();
    hof.seasonsPlayed += 1;
    if (finalRank === 1) {
      hof.championships += 1;
      tryUnlockAchievement(this.state, 'ach_champion');
      if (hof.championships >= 2) tryUnlockAchievement(this.state, 'ach_dynasty');
    }
    if (regularRank <= 3) {
      tryUnlockAchievement(this.state, 'ach_playoffs');
    }
    if (tier === 1 || newTier === 1) {
      tryUnlockAchievement(this.state, 'ach_top_tier');
    }
    const memories = [...(this.state.seasonMemories ?? [])]
      .sort((a, b) => b.dramaScore - a.dramaScore)
      .slice(0, 3);
    hof.records.push({
      seasonNumber: this.state.seasonNumber,
      clubName: this.getUserClub().name,
      finalRank,
      regularRank,
      points: userRow?.points ?? 0,
      gf: userRow?.gf ?? 0,
      ga: userRow?.ga ?? 0,
      isChampion: finalRank === 1,
      storylineTitle: this.state.storyline?.title,
      topScorer: top ? { name: top.playerName, goals: top.goals } : null,
      tier,
      promotionStatus,
      topMemory: memories[0] ?? null,
    });

    const userClub = this.getUserClub();
    const metaLv = this.getMetaLevels();
    const clampAttr = (v: number) => Math.max(20, Math.min(99, v));

    // 计算金手套与队内赛季 MVP
    let goldenGlove: { name: string; clubName: string; cleanSheets: number } | null = null;
    for (const c of this.state.clubs) {
      for (const gp of c.squad) {
        if (gp.role !== 'GK') continue;
        if (!goldenGlove || gp.seasonStats.cleanSheets > goldenGlove.cleanSheets) {
          goldenGlove = { name: gp.name, clubName: c.name, cleanSheets: gp.seasonStats.cleanSheets };
        }
      }
    }
    const mvpPlayer = [...userClub.squad].sort((a, b) => {
      const sa = a.seasonStats.goals * 3 + a.seasonStats.assists * 2 + a.seasonStats.cleanSheets * 2 + a.ca * 0.25;
      const sb = b.seasonStats.goals * 3 + b.seasonStats.assists * 2 + b.seasonStats.cleanSheets * 2 + b.ca * 0.25;
      return sb - sa;
    })[0];

    const roleWeightedKeys = (role: DraftPlayer['role']) => this.getRoleWeightedKeys(role);

    // 赛季末动态能力结算：全队年龄 +1 岁，老将自然衰退；按赛季目标增幅扣除「赛季中已涨步数」一次性差额补齐
    for (const p of userClub.squad) {
      const oldCa = p.ca;
      const pst = p.seasonStats;
      const seasonAge = p.age ?? 24;
      p.age = seasonAge + 1;
      const pa = p.pa ?? Math.min(96, p.ca + (p.age <= 23 ? 16 : p.age <= 27 ? 8 : 3));
      p.pa = pa;

      // 1. 出场过少（<=5场）：21岁以下新星免于倒扣，仅微幅磨合；成年球员状态下滑
      if (pst.appearances <= 5) {
        if (p.age <= 21) {
          if (p.ca < pa && (p.seasonAttrGained ?? 0) === 0) {
            for (const k of roleWeightedKeys(p.role)) {
              p.attributes[k] = clampAttr(p.attributes[k] + 1);
            }
          }
        } else {
          const drop = (metaLv.medical ?? 0) >= 4 ? 1 : 2;
          p.attributes.pace = clampAttr(p.attributes.pace - drop);
          p.attributes.stamina = clampAttr(p.attributes.stamina - drop);
          p.attributes.composure = clampAttr(p.attributes.composure - 1);
        }
      } else if (
        pst.appearances >= 12 &&
        (['ST', 'LW', 'RW', 'CAM'].includes(p.role) && pst.goals === 0 && pst.assists === 0) &&
        p.age > 23
      ) {
        // 2. 成年主力攻击手长期哑火（>=12场0球0助），状态下滑
        p.attributes.shooting = clampAttr(p.attributes.shooting - 1);
        p.attributes.composure = clampAttr(p.attributes.composure - 1);
      } else if (pst.appearances >= Math.max(6, Math.round(this.getTotalRegularRounds() * 0.30)) && p.ca < pa && p.age <= 28) {
        // 3. 赛季末差额补齐：按赛季总轮数动态折算主力门槛，出场率不足则打折
        const totalR = this.getTotalRegularRounds();
        const fullStarterApps = Math.max(10, Math.round(totalR * 0.65));
        const goodPerf = pst.goals >= Math.max(4, Math.round(totalR * 0.22)) || pst.assists >= Math.max(3, Math.round(totalR * 0.17)) || pst.cleanSheets >= Math.max(4, Math.round(totalR * 0.22));
        const tgLv = metaLv.training_ground ?? 0;
        const rawTargetGain = this.computeSeasonTargetAttrGain(p, seasonAge, goodPerf, tgLv);
        const appRatio = Math.min(1, pst.appearances / fullStarterApps);
        const discountedTarget = Math.max(1, Math.round(rawTargetGain * appRatio));
        const alreadyGained = p.seasonAttrGained ?? 0;
        const remainingGain = Math.max(0, Math.min(pa - p.ca, discountedTarget - alreadyGained));
        if (remainingGain > 0) {
          for (const k of roleWeightedKeys(p.role)) {
            p.attributes[k] = clampAttr(p.attributes[k] + remainingGain);
          }
        }
      }

      // 4. 差异化断崖式衰老（按位置/模板/伤病史决定断崖与退役年龄，保护 28~31 岁巅峰期不提前下滑）
      const profile = this.resolvePlayerAgingProfile(p);
      if (p.age >= profile.cliffAge) {
        const yearsPast = p.age - profile.cliffAge;
        const medShield = (metaLv.medical ?? 0) >= 6 ? 1 : 0;
        const physDrop = Math.max(2, (yearsPast === 0 ? 5 : 4) - medShield);
        const techDrop = Math.max(1, (yearsPast === 0 ? 2 : 3) - medShield);
        p.attributes.pace = clampAttr(p.attributes.pace - physDrop);
        p.attributes.stamina = clampAttr(p.attributes.stamina - physDrop);
        for (const k of roleWeightedKeys(p.role)) {
          p.attributes[k] = clampAttr(p.attributes[k] - techDrop);
        }
        p.ca = computeWeightedCA(p.role, p.attributes);
        p.pa = Math.min(pa, p.ca);
      } else {
        p.ca = computeWeightedCA(p.role, p.attributes);
        if (p.ca > pa && p.ca > oldCa) {
          p.ca = pa;
        }
      }
      p.marketValue = calcTransferValue(p);
      p.lastCaDelta = p.ca - oldCa;
      p.seasonGrowthXp = 0;
      p.seasonAttrGained = 0;

      const prevCareer = p.careerStats ?? { seasons: 0, appearances: 0, goals: 0, assists: 0, cleanSheets: 0, championships: 0 };
      p.careerStats = {
        seasons: prevCareer.seasons + 1,
        appearances: prevCareer.appearances + pst.appearances,
        goals: prevCareer.goals + pst.goals,
        assists: prevCareer.assists + pst.assists,
        cleanSheets: prevCareer.cleanSheets + pst.cleanSheets,
        championships: prevCareer.championships + (finalRank === 1 ? 1 : 0),
      };
    }

    // 同步至 40 人大名单：U21 梯队小将受青训学院庇护按位置核心属性成长 (+2~4 CA)，非 U21 枯坐板凳轻微掉状态
    const activeIds = new Set(userClub.squad.map(p => p.id));
    const roster = this.getClubRoster();
    const acaLv = metaLv.academy ?? 0;
    for (const rp of roster) {
      if (!activeIds.has(rp.id)) {
        const oldCa = rp.ca;
        rp.age = (rp.age ?? 24) + 1;
        const rPa = rp.pa ?? computeInitialPA(rp.ca, rp.age, rp.age <= 21);
        rp.pa = rPa;
        if (rp.age <= 21 && rp.ca < rPa) {
          const u21Boost = Math.min(rPa - rp.ca, 2 + (acaLv >= 8 ? 2 : acaLv >= 4 ? 1 : 0));
          for (const k of roleWeightedKeys(rp.role)) {
            rp.attributes[k] = clampAttr(rp.attributes[k] + u21Boost);
          }
          rp.ca = Math.min(rPa, computeWeightedCA(rp.role, rp.attributes));
        } else if (rp.age > 21) {
          rp.attributes.stamina = clampAttr(rp.attributes.stamina - 1);
          rp.attributes.pace = clampAttr(rp.attributes.pace - 1);
          rp.ca = computeWeightedCA(rp.role, rp.attributes);
        }
        rp.marketValue = calcTransferValue(rp);
        rp.lastCaDelta = rp.ca - oldCa;
      }
    }
    for (const p of userClub.squad) {
      const idx = roster.findIndex(r => r.id === p.id);
      if (idx >= 0) {
        roster[idx] = JSON.parse(JSON.stringify(p));
      } else if (roster.length < MAX_CLUB_ROSTER) {
        roster.push(JSON.parse(JSON.stringify(p)));
      }
    }

    // 青训学院：每季末自动提拔 1 名 U19 新星入 40 人大名单（按目标联赛等级缩放CA）
    const rewardBase = 40 + (7 - newTier) * 6;
    if (metaLv.academy > 0 && roster.length < MAX_CLUB_ROSTER) {
      const minAca = rewardBase + metaLv.academy * 2;
      const maxAca = rewardBase + 10 + metaLv.academy * 3;
      const prospect = generateShuffleSet(1, minAca, maxAca)[0];
      prospect.age = 18 + Math.floor(Math.random() * 2);
      prospect.pa = Math.min(96, prospect.ca + 16 + metaLv.academy * 2);
      prospect.isNewSigning = true;
      prospect.isAcademy = true;
      prospect.formationFamiliarity = { [userClub.formation]: 82 };
      roster.push(prospect);
    }

    // 休赛期默契度微幅回落
    decayChemistryOffSeason(this.getChemistryLinks());

    // 游子归家老队长 #10 梅利纳：首季圆满落幕，传奇挂靴转任主教练并传承【老队长的怒吼】+50 Meta + 钦点衣钵传人
    let retiredLegend: SeasonSummary['retiredLegend'] = null;
    let captainSuccessor: SeasonSummary['captainSuccessor'] = null;
    const capIdx = userClub.squad.findIndex(p => p.isPrologueCaptain || p.id === 'captain_lin_feng');
    const rosterCapIdx = roster.findIndex(p => p.isPrologueCaptain || p.id === 'captain_lin_feng');
    const capEntity = capIdx >= 0 ? userClub.squad[capIdx] : rosterCapIdx >= 0 ? roster[rosterCapIdx] : null;
    if (capEntity) {
      retiredLegend = {
        name: capEntity.name,
        age: Math.max(38, capEntity.age),
        appearances: capEntity.seasonStats.appearances,
        goals: capEntity.seasonStats.goals,
        assists: capEntity.seasonStats.assists,
        note: '游子归家圆满落幕！#10 梅利纳正式挂靴转任主教练，传承手牌【老队长的怒吼】并注入 +50 Meta 执教基金！',
      };
      if (capIdx >= 0) userClub.squad.splice(capIdx, 1);
      if (rosterCapIdx >= 0) roster.splice(rosterCapIdx, 1);
      userClub.starterIds = userClub.starterIds.filter(id => id !== capEntity.id);
      if (userClub.captainId === capEntity.id) userClub.captainId = undefined;
      if (this.state.rosterSelectedIds) {
        this.state.rosterSelectedIds = this.state.rosterSelectedIds.filter(id => id !== capEntity.id);
      }
      this.grantCaptainRoarCard();
      this.state.metaPointsTotal += 50;
      metaEarned += 50;
    }

    // 常规老将到期退役换血（玻璃人早退、常青树晚退，至少保留 1 名门将）
    const retiredIds = new Set<string>();
    let vetMetaBonus = 0;
    for (const p of [...userClub.squad]) {
      if (p.isPrologueCaptain || p.id === 'captain_lin_feng') continue;
      const prof = this.resolvePlayerAgingProfile(p);
      if ((p.age ?? 24) >= prof.retireAge) {
        if (p.role === 'GK' && userClub.squad.filter(x => x.role === 'GK' && !retiredIds.has(x.id)).length <= 1) {
          continue;
        }
        retiredIds.add(p.id);
        if ((p.careerStats?.appearances ?? 0) >= 10 && vetMetaBonus < 15) {
          vetMetaBonus += 5;
        }
      }
    }
    if (retiredIds.size > 0) {
      userClub.squad = userClub.squad.filter(p => !retiredIds.has(p.id));
      userClub.starterIds = userClub.starterIds.filter(id => !retiredIds.has(id));
      if (userClub.captainId && retiredIds.has(userClub.captainId)) userClub.captainId = undefined;
      for (let i = roster.length - 1; i >= 0; i--) {
        if (retiredIds.has(roster[i].id)) roster.splice(i, 1);
      }
      if (this.state.rosterSelectedIds) {
        this.state.rosterSelectedIds = this.state.rosterSelectedIds.filter(id => !retiredIds.has(id));
      }
      this.state.metaPointsTotal += vetMetaBonus;
      metaEarned += vetMetaBonus;
    }

    if (capEntity) {
      const pool = userClub.squad.length > 0 ? userClub.squad : roster;
      const u23Outfield = pool
        .filter(p => p.role !== 'GK' && (p.age ?? 24) <= 23)
        .sort((a, b) => (b.pa ?? b.ca) - (a.pa ?? a.ca) || a.age - b.age || b.ca - a.ca);
      const fallbackOutfield = pool
        .filter(p => p.role !== 'GK' && !u23Outfield.some(u => u.id === p.id))
        .sort((a, b) => a.age - b.age || (b.pa ?? b.ca) - (a.pa ?? a.ca));
      const candidates = [...u23Outfield, ...fallbackOutfield].slice(0, 4);
      if (candidates.length > 0) {
        captainSuccessor = {
          pending: true,
          captainName: capEntity.name,
          candidateIds: candidates.map(c => c.id),
        };
      }
    }

    this.state.persistentSquad = JSON.parse(JSON.stringify(userClub.squad));
    const rewardCount = metaLv.scout >= 4 ? 4 : 3;
    this.state.seasonRewardDrafts = generateShuffleSet(rewardCount, rewardBase, rewardBase + 14);

    const jackpotMeta = finalRank <= 3 || promotionStatus === 'promoted' ? 90 : 60;
    const seasonBonusOptions: SeasonBonusOption[] = [
      {
        id: 'sb_command_pack',
        kind: 'command_pack',
        badge: '战术典藏包',
        title: '赛季高阶指挥卡 + 元素箱',
        subtitle: '获赠 1 张高阶双元素成品指挥卡 + 4 个随机战术元素',
      },
      {
        id: 'sb_youth_awaken',
        kind: 'youth_awaken',
        badge: '青训黄金一代',
        title: 'U23 新星潜力觉醒',
        subtitle: '队内 U23 球员传射防各 +2 且潜力 PA +4（无U23则全队冷静 +2）',
      },
      {
        id: 'sb_meta_jackpot',
        kind: 'meta_jackpot',
        badge: '理事会嘉奖基金',
        title: `额外 Meta 基金 +${jackpotMeta}pt`,
        subtitle: '直接入账教练天赋树与 SkillWeb 技能网点亮基金',
      },
    ];

    const summary: SeasonSummary = {
      finalRank,
      isChampion: finalRank === 1,
      regularRank,
      points: userRow?.points ?? 0,
      gf: userRow?.gf ?? 0,
      ga: userRow?.ga ?? 0,
      metaPointsEarned: metaEarned,
      topScorer: top ? { name: top.playerName, clubName: top.clubName, goals: top.goals } : null,
      topAssister: topAst ? { name: topAst.playerName, clubName: topAst.clubName, assists: topAst.assists } : null,
      goldenGlove,
      seasonMVP: mvpPlayer
        ? {
            name: mvpPlayer.name,
            role: mvpPlayer.role,
            ca: mvpPlayer.ca,
            goals: mvpPlayer.seasonStats.goals,
            assists: mvpPlayer.seasonStats.assists,
          }
        : null,
      metaBreakdown: {
        rankBase: tierScaled,
        tierMul: tierInfo.metaMul,
        promoBonus,
        champBonus,
        storyBonus,
      },
      seasonBonusOptions,
      seasonBonusClaimedId: null,
      tier,
      tierName: tierInfo.name,
      promotionStatus,
      newTier,
      memories,
      retiredLegend,
      captainSuccessor,
    };

    this.state.lastSummary = summary;
    this.state.phase = 'SEASON_END';
    this.state.seasonPrivateTrainedIds = [];
    this.advanceYouthAcademyEndSeason();
    this.state.transferMarket = null;
    this.getTransferMarketState();
  }

  public selectCaptainSuccessor(playerId: string): { ok: boolean; playerName?: string; grantedTrait?: string; reason?: string } {
    const sum = this.state.lastSummary;
    if (this.state.phase !== 'SEASON_END' || !sum?.captainSuccessor) {
      return { ok: false, reason: '当前没有待选定的衣钵传人' };
    }
    if (!sum.captainSuccessor.pending) {
      return { ok: false, reason: '本赛季已完成衣钵传人钦点' };
    }
    const club = this.getUserClub();
    const roster = this.getClubRoster();
    const target = club.squad.find(p => p.id === playerId) ?? roster.find(p => p.id === playerId);
    if (!target) {
      return { ok: false, reason: '未在队内名单中找到该小将' };
    }
    const clampAttr = (v: number) => Math.max(20, Math.min(99, v));
    const applyInheritance = (p: DraftPlayer, grantedTrait: string) => {
      p.attributes.passing = clampAttr(p.attributes.passing + 3);
      p.attributes.composure = clampAttr(p.attributes.composure + 3);
      if (p.role === 'CB' || p.role === 'LB' || p.role === 'RB' || p.role === 'LWB' || p.role === 'RWB' || p.role === 'CDM') {
        p.attributes.defending = clampAttr(p.attributes.defending + 3);
      } else if (p.role === 'GK') {
        p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + 3);
      } else {
        p.attributes.shooting = clampAttr(p.attributes.shooting + 3);
      }
      p.pa = Math.min(99, Math.max(p.pa ?? p.ca + 4, p.ca + 5));
      p.ca = computeWeightedCA(p.role, p.attributes);
      p.goldTraits = Array.from(new Set([...(p.goldTraits ?? []), grantedTrait]));
      p.traits = Array.from(new Set([...(p.traits ?? []), grantedTrait]));
      p.isCaptainSuccessor = true;
    };
    const existingGold = new Set(target.goldTraits ?? []);
    const grantedTrait = !existingGold.has('大赛先生') ? '大赛先生' : !existingGold.has('远射重炮') ? '远射重炮' : '球场领袖';
    const inSquad = club.squad.find(p => p.id === playerId);
    if (inSquad) applyInheritance(inSquad, grantedTrait);
    const inRoster = roster.find(p => p.id === playerId);
    if (inRoster) applyInheritance(inRoster, grantedTrait);
    if (this.state.persistentSquad) {
      const inPersist = this.state.persistentSquad.find(p => p.id === playerId);
      if (inPersist) applyInheritance(inPersist, grantedTrait);
    }
    sum.captainSuccessor = {
      ...sum.captainSuccessor,
      pending: false,
      chosenPlayerId: target.id,
      chosenPlayerName: target.name,
      grantedTrait,
      note: `${target.name} 正式接过 #10 ${sum.captainSuccessor.captainName} 衣钵，核心属性 +3、PA 突破并觉醒金标【${grantedTrait}】！`,
    };
    return { ok: true, playerName: target.name, grantedTrait };
  }

  public pickSeasonBonusReward(optionId: string): { ok: boolean; summary?: string; reason?: string } {
    const sum = this.state.lastSummary;
    if (this.state.phase !== 'SEASON_END' || !sum) {
      return { ok: false, reason: '当前不在赛季结算阶段' };
    }
    if (sum.seasonBonusClaimedId) {
      return { ok: false, reason: '本赛季结算宝箱已领取' };
    }
    const opt = sum.seasonBonusOptions?.find(o => o.id === optionId);
    if (!opt) return { ok: false, reason: '无效的赛季奖励选项' };

    const club = this.getUserClub();
    const roster = this.getClubRoster();
    const clampAttr = (v: number) => Math.max(20, Math.min(99, v));

    if (opt.kind === 'command_pack') {
      const chemTpl = V5_CHEMICAL_CARDS[Math.floor(Math.random() * V5_CHEMICAL_CARDS.length)];
      const chemCard = instantiateV5Card(chemTpl, POSITIVE_AFFIXES[Math.floor(Math.random() * POSITIVE_AFFIXES.length)]);
      const t1a = rollStyleConsumableCard(club.style, 1);
      const t1b = rollStyleConsumableCard(club.style, 1);
      const deck = this.getCoachDeck();
      if (deck.length < 58) {
        deck.push(chemCard, t1a, t1b);
      } else {
        this.addClubFunds(120);
      }
      sum.seasonBonusSummary = `获得附魔神卡【${chemCard.name}】及 2 张 1 阶战术卡【${t1a.name}】【${t1b.name}】！`;
    } else if (opt.kind === 'youth_awaken') {
      const youths = club.squad.filter(p => p.age <= 24);
      if (youths.length > 0) {
        for (const p of youths) {
          p.pa = Math.min(99, (p.pa ?? p.ca + 6) + 4);
          p.attributes.passing = clampAttr(p.attributes.passing + 2);
          p.attributes.shooting = clampAttr(p.attributes.shooting + 2);
          p.attributes.defending = clampAttr(p.attributes.defending + 2);
          p.ca = computeWeightedCA(p.role, p.attributes);
          const rIdx = roster.findIndex(r => r.id === p.id);
          if (rIdx >= 0) roster[rIdx] = JSON.parse(JSON.stringify(p));
        }
        sum.seasonBonusSummary = `青训黄金一代觉醒：${youths.length} 名新星核心属性 +2、潜力 PA +4！`;
      } else {
        for (const p of club.squad) {
          p.attributes.composure = clampAttr(p.attributes.composure + 2);
          p.ca = computeWeightedCA(p.role, p.attributes);
        }
        sum.seasonBonusSummary = '老兵沉淀升华：全队冷静属性永久 +2！';
      }
      this.state.persistentSquad = JSON.parse(JSON.stringify(club.squad));
    } else {
      const jackpotMeta = sum.finalRank <= 3 || sum.promotionStatus === 'promoted' ? 90 : 60;
      this.state.metaPointsTotal += jackpotMeta;
      sum.seasonBonusSummary = `理事会嘉奖基金入账：额外获得 +${jackpotMeta} Meta 点数！`;
    }

    sum.seasonBonusClaimedId = opt.id;
    return { ok: true, summary: sum.seasonBonusSummary };
  }

  // ==================== 6. 青训试训池（迷雾球探/自然成长/超19岁解约）与转会市场 ====================

  public getYouthAcademyState(): YouthAcademyState {
    const meta = this.getMetaLevels();
    const seasonNum = this.state.seasonNumber ?? 1;
    const tier = this.state.currentTier ?? 7;
    const acaLv = meta.academy ?? 0;
    const scoutLv = meta.scout ?? 0;
    if (!this.state.youthAcademy) {
      const cands = this.generateYouthPool(acaLv, tier, scoutLv, 6);
      this.state.youthAcademy = {
        seasonNumber: seasonNum,
        freeRefreshesLeft: 1 + (acaLv >= 3 ? 3 : acaLv >= 2 ? 2 : acaLv >= 1 ? 1 : 0),
        paidRefreshesUsed: 0,
        candidates: cands,
        overseasPackUsed: false,
      };
    }
    return this.state.youthAcademy;
  }

  private generateYouthPool(acaLv: number, tier: number, scoutLv: number, count = 6): DraftPlayer[] {
    const list: DraftPlayer[] = [];
    for (let i = 0; i < count; i++) {
      const p = generateYouthProspect(acaLv, tier, scoutLv, acaLv >= 2 ? 2 : 0);
      if (acaLv >= 6 && (p.traits?.length ?? 0) === 0) {
        p.traits = ['节拍器'];
        p.silverTraits = ['节拍器'];
      }
      if (acaLv >= 7 && i === 0) {
        const minGolden = acaLv >= 8 ? 88 : 86;
        p.pa = Math.max(p.pa ?? 80, minGolden);
        p.marketValue = calcTransferValue(p);
        if (p.scoutFogLevel === 2) { p.paEstMin = p.pa; p.paEstMax = p.pa; }
      }
      list.push(p);
    }
    return list;
  }

  /**
   * 冬窗（第 17 轮后）青训自然成长：在训小妖 CA +1~2，迷雾自动提升 1 级 (0->1 / 1->2)，并补招至 6 人
   */
  public advanceYouthAcademyMidSeason(): void {
    const ya = this.getYouthAcademyState();
    const meta = this.getMetaLevels();
    const acaLv = meta.academy ?? 0;
    const scoutLv = meta.scout ?? 0;
    const tier = this.state.currentTier ?? 7;
    const clampAttr = (v: number) => Math.min(99, v);

    for (const p of ya.candidates) {
      const pa = p.pa ?? computeInitialPA(p.ca, p.age, true);
      p.pa = pa;
      if (p.ca < pa) {
        const gain = 1 + (acaLv >= 5 ? 1 : 0);
        if (p.role === 'GK') {
          p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + gain);
          p.attributes.positioning = clampAttr(p.attributes.positioning + 1);
        } else {
          p.attributes.passing = clampAttr(p.attributes.passing + gain);
          p.attributes.dribbling = clampAttr(p.attributes.dribbling + gain);
          p.attributes.composure = clampAttr(p.attributes.composure + 1);
        }
        p.ca = Math.min(pa, computeWeightedCA(p.role, p.attributes));
        p.marketValue = calcTransferValue(p);
      }
      const curFog = p.scoutFogLevel ?? 0;
      if (curFog < 2) {
        const nextFog = (curFog + 1) as 1 | 2;
        p.scoutFogLevel = nextFog;
        if (nextFog === 1) {
          p.paEstMin = Math.max(p.ca, pa - 4);
          p.paEstMax = Math.min(99, pa + 4);
        } else {
          p.paEstMin = pa;
          p.paEstMax = pa;
        }
      }
    }

    if (ya.candidates.length < 6) {
      const need = 6 - ya.candidates.length;
      ya.candidates.push(...this.generateYouthPool(acaLv, tier, scoutLv, need));
    }
    ya.freeRefreshesLeft = Math.max(ya.freeRefreshesLeft, 1);
  }

  /**
   * 赛季末青训结算：在训小妖年龄 +1、CA 自然成长 +1~3、迷雾升至 Lv.2，超过 19 岁自动解约离队，补招 16~18 岁新秀至 6 人
   */
  public advanceYouthAcademyEndSeason(): { releasedNames: string[] } {
    const ya = this.getYouthAcademyState();
    const meta = this.getMetaLevels();
    const acaLv = meta.academy ?? 0;
    const scoutLv = meta.scout ?? 0;
    const tier = this.state.currentTier ?? 7;
    const clampAttr = (v: number) => Math.min(99, v);

    const releasedNames: string[] = [];
    const kept: DraftPlayer[] = [];
    for (const p of ya.candidates) {
      p.age = (p.age ?? 17) + 1;
      if (p.age > 19) {
        releasedNames.push(p.name);
        continue;
      }
      const pa = p.pa ?? computeInitialPA(p.ca, p.age, true);
      p.pa = pa;
      if (p.ca < pa) {
        const gain = 1 + (acaLv >= 6 ? 2 : acaLv >= 3 ? 1 : 0);
        if (p.role === 'GK') {
          p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + gain);
          p.attributes.positioning = clampAttr(p.attributes.positioning + 1);
        } else {
          p.attributes.passing = clampAttr(p.attributes.passing + gain);
          p.attributes.dribbling = clampAttr(p.attributes.dribbling + gain);
          p.attributes.shooting = clampAttr(p.attributes.shooting + 1);
          p.attributes.composure = clampAttr(p.attributes.composure + 1);
        }
        p.ca = Math.min(pa, computeWeightedCA(p.role, p.attributes));
        p.marketValue = calcTransferValue(p);
      }
      p.scoutFogLevel = 2;
      p.paEstMin = pa;
      p.paEstMax = pa;
      kept.push(p);
    }

    if (kept.length < 6) {
      kept.push(...this.generateYouthPool(acaLv, tier, scoutLv, 6 - kept.length));
    }
    ya.candidates = kept;
    ya.seasonNumber = (this.state.seasonNumber ?? 1) + 1;
    ya.freeRefreshesLeft = 1 + (acaLv >= 3 ? 3 : acaLv >= 2 ? 2 : acaLv >= 1 ? 1 : 0);
    ya.paidRefreshesUsed = 0;
    ya.overseasPackUsed = false;
    return { releasedNames };
  }

  public rerollYouthProspects(paid = false): { ok: boolean; cost?: number; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可刷新青训试训营` };
    const ya = this.getYouthAcademyState();
    const meta = this.getMetaLevels();
    const acaLv = meta.academy ?? 0;
    const scoutLv = meta.scout ?? 0;
    const tier = this.state.currentTier ?? 7;
    if (!paid && ya.freeRefreshesLeft > 0) {
      ya.freeRefreshesLeft -= 1;
      ya.candidates = this.generateYouthPool(acaLv, tier, scoutLv, 6);
      return { ok: true, cost: 0 };
    }
    const rawCost = 60 + ya.paidRefreshesUsed * 40;
    const discount = scoutLv >= 8 ? 0.5 : scoutLv >= 5 ? 0.65 : scoutLv >= 4 ? 0.8 : 1.0;
    const cost = Math.round(rawCost * discount);
    if (!this.spendClubFunds(cost)) {
      return { ok: false, reason: `俱乐部资金不足 (需要 ¥${cost}万)` };
    }
    ya.paidRefreshesUsed += 1;
    ya.candidates = this.generateYouthPool(acaLv, tier, scoutLv, 6);
    return { ok: true, cost };
  }

  public scoutYouthProspect(playerId: string): { ok: boolean; newLevel?: number; cost?: number; reason?: string } {
    const ya = this.getYouthAcademyState();
    const p = ya.candidates.find(c => c.id === playerId);
    if (!p) return { ok: false, reason: '未找到该青训试训球员' };
    const cur = p.scoutFogLevel ?? 0;
    if (cur >= 2) return { ok: false, reason: '已完成全部球探精测' };
    const scoutLv = this.getMetaLevels().scout ?? 0;
    const baseCost = cur === 0 ? 35 : 75;
    const discount = scoutLv >= 8 ? 0.5 : scoutLv >= 5 ? 0.65 : scoutLv >= 4 ? 0.8 : 1.0;
    const cost = Math.round(baseCost * discount);
    if (!this.spendClubFunds(cost)) {
      return { ok: false, reason: `资金不足 (需要 ¥${cost}万)` };
    }
    const nextLv = (cur + 1) as 1 | 2;
    p.scoutFogLevel = nextLv;
    const pa = p.pa ?? computeInitialPA(p.ca, p.age, true);
    p.pa = pa;
    if (nextLv === 1) {
      const spread = scoutLv >= 7 ? 3 : 5;
      p.paEstMin = Math.max(p.ca, pa - Math.floor(Math.random() * spread + 1));
      p.paEstMax = Math.min(99, pa + Math.floor(Math.random() * spread + 1));
    } else {
      p.paEstMin = pa;
      p.paEstMax = pa;
    }
    return { ok: true, newLevel: nextLv, cost };
  }

  public signYouthProspect(playerId: string): { ok: boolean; player?: DraftPlayer; cost?: number; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可提拔青训球员` };
    const ya = this.getYouthAcademyState();
    const idx = ya.candidates.findIndex(c => c.id === playerId);
    if (idx < 0) return { ok: false, reason: '未找到该青训球员' };
    const roster = this.getClubRoster();
    if (roster.length >= MAX_CLUB_ROSTER) {
      return { ok: false, reason: `俱乐部大名单已满 (${MAX_CLUB_ROSTER}/${MAX_CLUB_ROSTER})` };
    }
    const p = ya.candidates[idx];
    const acaLv = this.getMetaLevels().academy ?? 0;
    const tgLv = this.getMetaLevels().training_ground ?? 0;
    const feeMul = acaLv >= 5 ? 0.75 : acaLv >= 3 ? 0.85 : 1.0;
    const signCost = Math.round(Math.max(25, (p.ca - 32) * 2.4) * feeMul);
    if (!this.spendClubFunds(signCost)) {
      return { ok: false, reason: `资金不足 (签字费 ¥${signCost}万)` };
    }
    ya.candidates.splice(idx, 1);
    p.scoutFogLevel = 2;
    p.paEstMin = p.pa;
    p.paEstMax = p.pa;
    p.isNewSigning = true;
    p.isAcademy = true;
    const uc = this.getUserClub();
    const initFam = 65 + (tgLv >= 7 ? 25 : tgLv >= 5 ? 10 : 0);
    p.formationFamiliarity = { [uc.formation]: Math.min(95, initFam) };
    roster.push(JSON.parse(JSON.stringify(p)));
    if (this.state.phase === 'SUMMER_WINDOW' || this.state.phase === 'WINTER_WINDOW') {
      this.syncWindowRosterToClub();
    }
    return { ok: true, player: p, cost: signCost };
  }

  public getTransferMarketState(): TransferMarketState {
    const meta = this.getMetaLevels();
    const seasonNum = this.state.seasonNumber ?? 1;
    const tier = this.state.currentTier ?? 7;
    const trLv = meta.transfer ?? 0;
    const scoutLv = meta.scout ?? 0;
    if (!this.state.transferMarket || this.state.transferMarket.seasonNumber !== seasonNum) {
      const shelfSize = trLv >= 6 ? 14 : trLv >= 3 ? 12 : trLv >= 2 ? 10 : trLv >= 1 ? 9 : 8;
      const minBand = Math.max(36, 36 + (7 - tier) * 6);
      const maxBand = Math.min(90, minBand + 9 + (trLv >= 6 ? 3 : 0));
      const pool = generateShuffleSet(shelfSize, minBand, maxBand).map(p => {
        p.scoutFogLevel = scoutLv >= 7 ? 2 : 1;
        const pa = p.pa ?? computeInitialPA(p.ca, p.age);
        p.pa = pa;
        p.paEstMin = Math.max(p.ca, pa - 6);
        p.paEstMax = Math.min(99, pa + 6);
        p.marketValue = calcTransferValue(p);
        return p;
      });
      this.state.transferMarket = {
        seasonNumber: seasonNum,
        freeRefreshesLeft: 1 + Math.min(3, scoutLv),
        paidRefreshesUsed: 0,
        marketPool: pool,
        listings: [],
        mysteryBoxSmallUsed: false,
        mysteryBoxLargeUsed: false,
        privateTrainCount: 0,
        pendingBrokerResult: null,
      };
    }
    return this.state.transferMarket;
  }

  private refreshTransferShelfForWindow(): void {
    const tm = this.getTransferMarketState();
    const meta = this.getMetaLevels();
    const trLv = meta.transfer ?? 0;
    const scoutLv = meta.scout ?? 0;
    const tier = this.state.currentTier ?? 7;
    const shelfSize = trLv >= 6 ? 14 : trLv >= 3 ? 12 : trLv >= 2 ? 10 : trLv >= 1 ? 9 : 8;
    const minBand = Math.max(36, 36 + (7 - tier) * 6);
    const maxBand = Math.min(90, minBand + 14 + (trLv >= 6 ? 4 : 0));
    tm.marketPool = generateShuffleSet(shelfSize, minBand, maxBand).map(p => {
      p.scoutFogLevel = scoutLv >= 7 ? 2 : 1;
      const pa = p.pa ?? computeInitialPA(p.ca, p.age);
      p.pa = pa;
      p.paEstMin = Math.max(p.ca, pa - 6);
      p.paEstMax = Math.min(99, pa + 6);
      p.marketValue = calcTransferValue(p);
      return p;
    });
    tm.freeRefreshesLeft = Math.max(tm.freeRefreshesLeft, 1);
    tm.mysteryBoxSmallUsed = false;
    tm.mysteryBoxLargeUsed = false;
  }

  public scoutTransferPlayer(playerId: string): { ok: boolean; cost?: number; reason?: string } {
    const tm = this.getTransferMarketState();
    const p = tm.marketPool.find(x => x.id === playerId);
    if (!p) return { ok: false, reason: '货架上未找到该球员' };
    if ((p.scoutFogLevel ?? 1) >= 2) return { ok: false, reason: '该球员球探报告已完全揭晓' };
    const scoutLv = this.getMetaLevels().scout ?? 0;
    const discount = scoutLv >= 8 ? 0.5 : scoutLv >= 5 ? 0.65 : scoutLv >= 4 ? 0.8 : 1.0;
    const cost = Math.round(35 * discount);
    if (!this.spendClubFunds(cost)) return { ok: false, reason: `资金不足 (考察费 ¥${cost}万)` };
    p.scoutFogLevel = 2;
    p.paEstMin = p.pa ?? p.ca;
    p.paEstMax = p.pa ?? p.ca;
    return { ok: true, cost };
  }

  public refreshTransferShelf(paid = false): { ok: boolean; cost?: number; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可刷新转会货架` };
    const tm = this.getTransferMarketState();
    const meta = this.getMetaLevels();
    const trLv = meta.transfer ?? 0;
    const scoutLv = meta.scout ?? 0;
    const tier = this.state.currentTier ?? 7;
    if (!paid && tm.freeRefreshesLeft > 0) {
      tm.freeRefreshesLeft -= 1;
    } else {
      const rawCost = 80 + tm.paidRefreshesUsed * 50;
      const discount = scoutLv >= 8 ? 0.5 : scoutLv >= 5 ? 0.65 : scoutLv >= 4 ? 0.8 : 1.0;
      const cost = Math.round(rawCost * discount);
      if (!this.spendClubFunds(cost)) return { ok: false, reason: `资金不足 (刷新需要 ¥${cost}万)` };
      tm.paidRefreshesUsed += 1;
    }
    const shelfSize = trLv >= 6 ? 14 : trLv >= 3 ? 12 : trLv >= 2 ? 10 : trLv >= 1 ? 9 : 8;
    const minBand = Math.max(36, 36 + (7 - tier) * 6);
    const maxBand = Math.min(90, minBand + 14 + (trLv >= 6 ? 4 : 0));
    tm.marketPool = generateShuffleSet(shelfSize, minBand, maxBand).map(p => {
      p.scoutFogLevel = scoutLv >= 7 ? 2 : 1;
      const pa = p.pa ?? computeInitialPA(p.ca, p.age);
      p.pa = pa;
      p.paEstMin = Math.max(p.ca, pa - 6);
      p.paEstMax = Math.min(99, pa + 6);
      p.marketValue = calcTransferValue(p);
      return p;
    });
    return { ok: true };
  }

  public getBuyDiscountRate(): number {
    const trLv = this.getMetaLevels().transfer ?? 0;
    if (trLv >= 8) return 0.80;
    if (trLv >= 7) return 0.84;
    if (trLv >= 3) return 0.88;
    if (trLv >= 2) return 0.92;
    if (trLv >= 1) return 0.95;
    return 1.0;
  }

  public buyTransferPlayer(playerId: string): { ok: boolean; player?: DraftPlayer; cost?: number; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可签约转会球员` };
    const tm = this.getTransferMarketState();
    const idx = tm.marketPool.findIndex(p => p.id === playerId);
    if (idx < 0) return { ok: false, reason: '货架上未找到该球员' };
    const roster = this.getClubRoster();
    if (roster.length >= MAX_CLUB_ROSTER) return { ok: false, reason: `俱乐部大名单已满 (${MAX_CLUB_ROSTER}/${MAX_CLUB_ROSTER})` };
    const p = tm.marketPool[idx];
    const baseVal = p.marketValue ?? calcTransferValue(p);
    const cost = Math.round(baseVal * this.getBuyDiscountRate());
    if (!this.spendClubFunds(cost)) return { ok: false, reason: `资金不足 (转会费 ¥${cost}万)` };
    tm.marketPool.splice(idx, 1);
    p.scoutFogLevel = 2;
    p.paEstMin = p.pa;
    p.paEstMax = p.pa;
    p.isNewSigning = true;
    const tgLv = this.getMetaLevels().training_ground ?? 0;
    if (tgLv >= 4) {
      const uc = this.getUserClub();
      p.formationFamiliarity = { [uc.formation]: tgLv >= 8 ? 75 : tgLv >= 7 ? 65 : 55 };
    }
    roster.push(JSON.parse(JSON.stringify(p)));
    if (this.state.phase === 'SUMMER_WINDOW' || this.state.phase === 'WINTER_WINDOW') {
      this.syncWindowRosterToClub();
    }
    return { ok: true, player: p, cost };
  }

  public quickSellRosterPlayer(playerId: string): { ok: boolean; revenue?: number; playerName?: string; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可出售球员` };
    const roster = this.getClubRoster();
    const minKeep = this.state.phase === 'SUMMER_WINDOW' ? 11 : SEASON_SQUAD_SIZE;
    if (roster.length <= minKeep) return { ok: false, reason: `至少需保留 ${minKeep} 名球员` };
    const idx = roster.findIndex(p => p.id === playerId);
    if (idx < 0) return { ok: false, reason: '大名单中未找到该球员' };
    const p = roster[idx];
    if (p.isPrologueCaptain || p.id === 'captain_lin_feng') {
      return { ok: false, reason: '老队长 #10 梅利纳正在上演游子归家最后一舞，无法出售！' };
    }
    if (p.role === 'GK' && roster.filter(x => x.role === 'GK').length <= 1) {
      return { ok: false, reason: '不能出售最后 1 名门将 (GK)' };
    }
    const trLv = this.getMetaLevels().transfer ?? 0;
    const rate = trLv >= 5 ? 0.92 : trLv >= 4 ? 0.89 : 0.85;
    const revenue = Math.round((p.marketValue ?? calcTransferValue(p)) * rate);
    const [sold] = roster.splice(idx, 1);
    if (sold) {
      const exCopy = JSON.parse(JSON.stringify(sold)) as DraftPlayer;
      exCopy.formerUserClub = true;
      this.state.exUserPlayersPool = [exCopy, ...(this.state.exUserPlayersPool ?? [])].slice(0, 12);
      const aiTargets = this.state.clubs.filter(c => !c.isUser);
      if (aiTargets.length > 0) {
        const dest = aiTargets[Math.floor(Math.random() * aiTargets.length)];
        const weakest = [...dest.squad].filter(q => q.role !== 'GK').sort((a, b) => a.ca - b.ca)[0];
        if (weakest && weakest.ca <= exCopy.ca + 3) {
          const wIdx = dest.squad.findIndex(q => q.id === weakest.id);
          if (wIdx >= 0) {
            dest.squad[wIdx] = exCopy;
            dest.starterIds = autoSelectStarters(dest.squad, dest.formation);
          }
        }
      }
    }
    this.state.rosterSelectedIds = (this.state.rosterSelectedIds ?? []).filter(id => id !== playerId);
    this.addClubFunds(revenue);
    if (this.state.phase === 'SUMMER_WINDOW' || this.state.phase === 'WINTER_WINDOW') {
      this.syncWindowRosterToClub();
    }
    return { ok: true, revenue, playerName: p.name };
  }

  public listPlayerForAuction(playerId: string): { ok: boolean; listing?: TransferListing; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可挂牌出售` };
    const tm = this.getTransferMarketState();
    const trLv = this.getMetaLevels().transfer ?? 0;
    const maxSlots = trLv >= 4 ? 5 : 3;
    if (tm.listings.length >= maxSlots) return { ok: false, reason: `挂牌槽位已满 (${maxSlots}/${maxSlots})` };
    if (tm.listings.some(l => l.playerId === playerId)) return { ok: false, reason: '该球员已在挂牌中' };
    const roster = this.getClubRoster();
    const minKeep = this.state.phase === 'SUMMER_WINDOW' ? 11 : SEASON_SQUAD_SIZE;
    if (roster.length <= minKeep) return { ok: false, reason: `至少需保留 ${minKeep} 名球员` };
    const p = roster.find(x => x.id === playerId);
    if (!p) return { ok: false, reason: '未找到该球员' };
    if (p.isPrologueCaptain || p.id === 'captain_lin_feng') {
      return { ok: false, reason: '老队长 #10 梅利纳正在上演游子归家最后一舞，无法挂牌！' };
    }
    if (p.role === 'GK' && roster.filter(x => x.role === 'GK').length <= 1) return { ok: false, reason: '不能挂牌最后 1 名门将' };
    const baseValue = p.marketValue ?? calcTransferValue(p);
    const offerCount = (trLv >= 5 ? 2 : 1) + (Math.random() < 0.5 ? 1 : 0);
    const maxMul = trLv >= 8 ? 1.35 : trLv >= 7 ? 1.28 : 1.18;
    const offers: TransferOffer[] = [];
    const aiClubs = FICTIONAL_CLUBS.filter(c => c.id !== this.state.userClubId);
    for (let i = 0; i < offerCount; i++) {
      const club = aiClubs[Math.floor(Math.random() * aiClubs.length)];
      const isGiant = (p.pa ?? p.ca) >= 82 && Math.random() < 0.4;
      const mul = 0.92 + Math.random() * (maxMul - 0.92) + (isGiant ? 0.1 : 0);
      offers.push({
        id: `offer_${Date.now()}_${i}`,
        clubName: club.name,
        offerPrice: Math.round(baseValue * mul),
        isGiant,
      });
    }
    const listing: TransferListing = {
      playerId: p.id,
      playerName: p.name,
      role: p.role,
      ca: p.ca,
      pa: p.pa ?? p.ca,
      age: p.age,
      baseValue,
      offers: offers.sort((a, b) => b.offerPrice - a.offerPrice),
    };
    tm.listings.push(listing);
    return { ok: true, listing };
  }

  public acceptTransferOffer(playerId: string, offerId: string): { ok: boolean; revenue?: number; buyer?: string; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，无法在比赛期成交转会` };
    const tm = this.getTransferMarketState();
    const lIdx = tm.listings.findIndex(l => l.playerId === playerId);
    if (lIdx < 0) return { ok: false, reason: '未找到该挂牌记录' };
    const listing = tm.listings[lIdx];
    const offer = listing.offers.find(o => o.id === offerId);
    if (!offer) return { ok: false, reason: '未找到该报价' };
    const roster = this.getClubRoster();
    const rIdx = roster.findIndex(p => p.id === playerId);
    const [soldAuc] = rIdx >= 0 ? roster.splice(rIdx, 1) : [undefined];
    if (soldAuc) {
      const exCopy = JSON.parse(JSON.stringify(soldAuc)) as DraftPlayer;
      exCopy.formerUserClub = true;
      this.state.exUserPlayersPool = [exCopy, ...(this.state.exUserPlayersPool ?? [])].slice(0, 12);
      const aiDest = this.state.clubs.find(c => !c.isUser && c.name === offer.clubName) ?? this.state.clubs.find(c => !c.isUser);
      if (aiDest) {
        const weakIdx = aiDest.squad.findIndex(q => q.role !== 'GK');
        if (weakIdx >= 0) {
          aiDest.squad[weakIdx] = exCopy;
          aiDest.starterIds = autoSelectStarters(aiDest.squad, aiDest.formation);
        }
      }
    }
    this.state.rosterSelectedIds = (this.state.rosterSelectedIds ?? []).filter(id => id !== playerId);
    tm.listings.splice(lIdx, 1);
    this.addClubFunds(offer.offerPrice);
    if (this.state.phase === 'SUMMER_WINDOW' || this.state.phase === 'WINTER_WINDOW') {
      this.syncWindowRosterToClub();
    }
    return { ok: true, revenue: offer.offerPrice, buyer: offer.clubName };
  }

  // ==================== 7. 经纪人密荐（输多赢少+百分比锚定+当场买/卖二选一）与特训 ====================

  public openBrokerPackage(boxTier: 'small' | 'large'): { ok: boolean; result?: PendingBrokerResult; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可委托经纪人密荐` };
    const tm = this.getTransferMarketState();
    if (tm.pendingBrokerResult) return { ok: false, reason: '请先处理上一份经纪人密荐结果（签入或出售）' };
    if (boxTier === 'small' && tm.mysteryBoxSmallUsed) return { ok: false, reason: '本转会窗常规密荐已委托过' };
    if (boxTier === 'large' && tm.mysteryBoxLargeUsed) return { ok: false, reason: '本转会窗金牌密荐已委托过' };
    const cost = boxTier === 'small' ? 220 : 450;
    if (!this.spendClubFunds(cost)) return { ok: false, reason: `资金不足 (需要 ¥${cost}万)` };
    if (boxTier === 'small') tm.mysteryBoxSmallUsed = true;
    else tm.mysteryBoxLargeUsed = true;

    const curTier = this.state.currentTier ?? 7;
    const medLv = this.getMetaLevels().medical ?? 0;
    const res = rollBrokerRecommendation(curTier, boxTier, medLv);
    tm.pendingBrokerResult = res;
    return { ok: true, result: res };
  }

  public resolveBrokerResult(action: 'sign' | 'sell'): { ok: boolean; revenue?: number; player?: DraftPlayer; reason?: string } {
    const tm = this.getTransferMarketState();
    const pending = tm.pendingBrokerResult;
    if (!pending) return { ok: false, reason: '当前没有待处理的经纪人密荐球员' };

    if (action === 'sell') {
      tm.pendingBrokerResult = null;
      this.addClubFunds(pending.sellPrice);
      return { ok: true, revenue: pending.sellPrice, player: pending.player };
    }

    const roster = this.getClubRoster();
    if (roster.length >= MAX_CLUB_ROSTER) {
      return { ok: false, reason: `俱乐部大名单已满 (${MAX_CLUB_ROSTER}/${MAX_CLUB_ROSTER})，请先出售 1 人或选择立即转手变现` };
    }
    roster.push(JSON.parse(JSON.stringify(pending.player)));
    tm.pendingBrokerResult = null;
    if (this.state.phase === 'SUMMER_WINDOW' || this.state.phase === 'WINTER_WINDOW') {
      this.syncWindowRosterToClub();
    }
    return { ok: true, player: pending.player };
  }

  public openMysteryBox(boxTier: 'small' | 'large'): { ok: boolean; player?: DraftPlayer; note?: string; reason?: string } {
    const openRes = this.openBrokerPackage(boxTier);
    if (!openRes.ok || !openRes.result) return { ok: false, reason: openRes.reason };
    const signRes = this.resolveBrokerResult('sign');
    if (!signRes.ok) return { ok: false, reason: signRes.reason };
    return { ok: true, player: openRes.result.player, note: openRes.result.note };
  }

  public buyOverseasYouthPack(): { ok: boolean; players?: DraftPlayer[]; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可举办海外青年营` };
    const ya = this.getYouthAcademyState();
    if (ya.overseasPackUsed) return { ok: false, reason: '本赛季海外青年营名额已用完' };
    if (!this.spendClubFunds(320)) return { ok: false, reason: '资金不足 (需要 ¥320万)' };
    ya.overseasPackUsed = true;
    const acaLv = this.getMetaLevels().academy ?? 0;
    const scoutLv = this.getMetaLevels().scout ?? 0;
    const curTier = this.state.currentTier ?? 7;
    const pack: DraftPlayer[] = [];
    for (let i = 0; i < 3; i++) {
      const p = generateYouthProspect(acaLv, curTier, scoutLv, 2);
      p.age = 16 + Math.floor(Math.random() * 2);
      p.isAcademy = true;
      ya.candidates.unshift(p);
      pack.push(p);
    }
    return { ok: true, players: pack };
  }

  public privateDevilTraining(playerId: string): { ok: boolean; success?: boolean; paBreak?: number; note?: string; reason?: string } {
    const win = this.getTransferWindowState();
    if (!win.isOpen) return { ok: false, reason: `${win.label}，仅夏窗与冬窗可安排私教魔鬼特训` };
    const tm = this.getTransferMarketState();
    if (tm.privateTrainCount >= 2) return { ok: false, reason: '本赛季私人魔鬼特训次数已满 (2/2)' };
    this.state.seasonPrivateTrainedIds = this.state.seasonPrivateTrainedIds ?? [];
    if (this.state.seasonPrivateTrainedIds.includes(playerId)) {
      return { ok: false, reason: '该球员本赛季已接受过私人魔鬼特训' };
    }
    const roster = this.getClubRoster();
    const club = this.getUserClub();
    const p = club.squad.find(x => x.id === playerId) ?? roster.find(x => x.id === playerId);
    if (!p) return { ok: false, reason: '未找到该球员' };
    if (!this.spendClubFunds(350)) return { ok: false, reason: '资金不足 (私人魔鬼特训需要 ¥350万)' };

    tm.privateTrainCount += 1;
    this.state.seasonPrivateTrainedIds.push(playerId);
    const tgLv = this.getMetaLevels().training_ground ?? 0;
    const medLv = this.getMetaLevels().medical ?? 0;
    const successRate = Math.min(0.75, 0.5 + (tgLv >= 5 ? 0.15 : tgLv >= 2 ? 0.1 : tgLv >= 1 ? 0.05 : 0));
    if (Math.random() < successRate) {
      const paGain = tgLv >= 7 ? 3 : 2;
      p.pa = Math.min(99, (p.pa ?? computeInitialPA(p.ca, p.age)) + paGain);
      p.attributes.composure = Math.min(99, p.attributes.composure + 2);
      p.attributes.stamina = Math.min(99, p.attributes.stamina + 2);
      p.ca = Math.min(p.pa, computeWeightedCA(p.role, p.attributes));
      p.marketValue = calcTransferValue(p);
      const syncTarget = (arr?: DraftPlayer[]) => {
        const t = arr?.find(x => x.id === playerId);
        if (t) Object.assign(t, JSON.parse(JSON.stringify(p)));
      };
      syncTarget(club.squad);
      syncTarget(roster);
      return { ok: true, success: true, paBreak: paGain, note: `特训突破成功！${p.name} 潜力 PA +${paGain}（当前 PA ${p.pa}）` };
    } else {
      p.fitness = Math.max(40, (p.fitness ?? 100) - (medLv >= 7 ? 15 : 30));
      p.injuredRounds = medLv >= 7 ? 1 : 2;
      p.careerInjuries = (p.careerInjuries ?? 0) + 1;
      const syncTarget = (arr?: DraftPlayer[]) => {
        const t = arr?.find(x => x.id === playerId);
        if (t) { t.fitness = p.fitness; t.injuredRounds = p.injuredRounds; }
      };
      syncTarget(club.squad);
      syncTarget(roster);
      return { ok: true, success: false, note: `高强度加练拉伤！${p.name} 需伤停 ${p.injuredRounds} 轮` };
    }
  }
}
