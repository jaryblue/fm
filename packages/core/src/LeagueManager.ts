/**
 * @fm-league/core - 轻度 Rogue 联赛总控中枢
 * 负责：开局选秀 -> 7轮常规赛 -> 第2/4/6轮 Re-Draft -> 前4名季后赛 -> 结算与存档序列化
 */

import { FORMATIONS, getDefenseSystem } from '../../engine/src/formations';
import { MatchEngine } from '../../engine/src/MatchEngine';
import {
  EquippedActiveSkill,
  FormationName,
  MatchState,
  PlayerAttributes,
  PlayerDuty,
  PlayerInput,
  TacticalStyle,
  TeamSetup,
} from '../../engine/src/types';
import {
  computePerkSynergies,
  computeWeightedCA,
  FICTIONAL_CLUBS,
  generateShuffleSet,
  generateTierPyramid,
  rollSeasonStoryline,
  rollSecondaryRoles,
  SECONDARY_ROLE_POOL,
} from './PlayerPool';
import {
  createDefaultMetaLevels,
  createDefaultTacticalMastery,
  getFormationMasteryInfo,
  getMetaUpgradeCost,
  getStyleMasteryInfo,
} from './MetaTree';
import {
  canUnlockNode,
  computeSkillWebMods,
  getOriginForFormation,
  getOriginForStyle,
  getUnlockedActiveSkillNodes,
  isNodeResonating,
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
  CraftFocus,
  createInitialElements,
  createStarterCoachDeck,
  ElementId,
  fuseTwoCards,
  synthesizeChemistry,
  TACTICAL_ELEMENTS,
  upgradeCommandCard,
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
import { computeStandings, generateRoundRobinFixtures, getLeagueTierInfo, TOTAL_TIERS } from './LeagueScheduler';
import {
  ChemistryLink,
  ChronicleProgress,
  ClubDirectoryEntry,
  DraftPlayer,
  FixtureMatch,
  HallOfFameData,
  InterMatchPrepState,
  LeagueClub,
  LeagueSaveState,
  MetaBranch,
  MetaLevels,
  PostMatchRewardCategory,
  PostMatchRewardOption,
  PostMatchRewardState,
  PrepTrainingKind,
  SeasonBonusOption,
  SeasonMemory,
  SeasonSummary,
  StandingRow,
  TacticalPresetSlot,
  TutorialProgress,
} from './types';

export interface NewSeasonOptions {
  clubId?: string;
  customName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  formation?: FormationName;
  style?: TacticalStyle;
}

const AI_FORMATIONS: FormationName[] = ['4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '3-5-2', '3-4-2-1', '5-4-1', '5-3-2'];
const AI_STYLES: TacticalStyle[] = ['balanced', 'tiki_taka', 'gegenpress', 'counter', 'wing_play'];
const RE_DRAFT_ROUNDS = new Set([8, 17, 26]);
export const TOTAL_REGULAR_ROUNDS = 34;
export const MAX_CLUB_ROSTER = 40;
export const SEASON_SQUAD_SIZE = 26;

export interface PlayerMatchGrowth {
  famGain: number;
  chemGain: number;
  bestPartner?: string;
  unlockedTrait?: string;
  isCaptain?: boolean;
}

export class LeagueManager {
  private state: LeagueSaveState;
  private lastMatchGrowth: Record<string, PlayerMatchGrowth> = {};

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
    if (!this.state.leaguePyramid) {
      this.state.leaguePyramid = generateTierPyramid(this.state.userClubId || 'club_star');
    }
    if (!this.state.metaLevels) this.state.metaLevels = createDefaultMetaLevels();
    if (this.state.metaLevels.academy === undefined) this.state.metaLevels.academy = 0;
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

    if (!this.state.coachDeck || this.state.coachDeck.length === 0) {
      this.state.coachDeck = createStarterCoachDeck();
    } else {
      for (const c of this.state.coachDeck) {
        if (!c.level) c.level = 1;
        if (!c.targetLine) c.targetLine = 'ALL';
      }
    }
    if (!this.state.clubs || this.state.clubs.length === 0) {
      const fresh = this.createNewSeasonState();
      this.state = fresh;
      return;
    }
    for (const c of this.state.clubs) {
      for (const p of c.squad) {
        if (!p.secondaryRoles) p.secondaryRoles = rollSecondaryRoles(p.role, p.tier);
      }
    }
    for (const p of this.state.clubRoster ?? []) {
      if (!p.secondaryRoles) p.secondaryRoles = rollSecondaryRoles(p.role, p.tier);
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
    if (this.state.stayedTierCount === undefined) this.state.stayedTierCount = 0;
    if (this.state.winlessStreak === undefined) this.state.winlessStreak = 0;
    if (!this.state.seasonMemories) this.state.seasonMemories = [];
    if (this.state.phase === 'REGULAR_SEASON' && !this.state.interMatchPrep) {
      this.state.interMatchPrep = createInterMatchPrep(this.state, this.getUserClub());
    }
    const uc = this.getUserClub();
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

    return {
      styleName: styleNames[opp.style] || opp.style,
      counterTip: counterTips[opp.style] || '按常规阵型应战',
      weakLineLabel,
      keyThreat,
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
    step: 'draft' | 'portal_prep' | 'portal_scout' | 'tactics' | 'cards' | 'match' | 'post_match' | 'skipAll'
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

  public upgradeMetaBranch(branch: MetaBranch): { ok: boolean; reason?: string } {
    if (!this.state.metaLevels) {
      this.state.metaLevels = createDefaultMetaLevels();
    }
    const curLv = this.state.metaLevels[branch] ?? 0;
    const cost = getMetaUpgradeCost(branch, curLv);
    if (cost === null) return { ok: false, reason: '该天赋已达满级' };
    if (this.state.metaPointsTotal < cost) return { ok: false, reason: `Meta 点数不足 (需要 ${cost})` };
    this.state.metaPointsTotal -= cost;
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
    let refunded = 0;
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
    return { ok: true, refunded };
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
      const eq = node ? toEquippedActiveSkill(node) : null;
      if (eq) res.push(eq);
    }
    return res;
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
    const baseClub = this.state ? this.getUserClub() : null;
    const opts: NewSeasonOptions = typeof clubOrOpts === 'string'
      ? {
          clubId: clubOrOpts === 'club_star' && carryOverSquad && baseClub ? baseClub.id : clubOrOpts,
          customName: carryOverSquad && baseClub ? baseClub.name : undefined,
          primaryColor: carryOverSquad && baseClub ? baseClub.primaryColor : undefined,
          secondaryColor: carryOverSquad && baseClub ? baseClub.secondaryColor : undefined,
          formation: carryOverSquad && baseClub ? baseClub.formation : formation,
          style: carryOverSquad && baseClub ? baseClub.style : style,
        }
      : clubOrOpts;
    const prevMeta = this.state?.metaPointsTotal ?? 0;
    const prevLevels = this.state?.metaLevels ? { ...this.state.metaLevels } : createDefaultMetaLevels();
    const prevHof = this.state?.hallOfFame ? JSON.parse(JSON.stringify(this.state.hallOfFame)) : createDefaultHallOfFame();
    const prevTut = this.state?.tutorialDone ? { ...this.state.tutorialDone } : {};
    const prevSeason = this.state?.seasonNumber ?? 0;
    const prevPersistent = carryOverSquad ? this.state?.persistentSquad : undefined;
    const prevElements = this.state?.elementInventory ? { ...this.state.elementInventory } : undefined;
    const prevDeck = this.state?.coachDeck ? JSON.parse(JSON.stringify(this.state.coachDeck)) : undefined;
    const prevLoadout = this.state?.coachLoadoutIds ? [...this.state.coachLoadoutIds] : undefined;
    const prevRecipes = this.state?.discoveredRecipes ? [...this.state.discoveredRecipes] : undefined;
    const prevRoster = this.state?.clubRoster ? JSON.parse(JSON.stringify(this.state.clubRoster)) : undefined;
    const prevRosterSel = this.state?.rosterSelectedIds ? [...this.state.rosterSelectedIds] : undefined;
    const prevRosterRefreshes = this.state?.rosterRefreshesRemaining;
    const prevSkillWeb = this.state?.skillWebUnlocked ? [...this.state.skillWebUnlocked] : undefined;
    const prevTier = carryOverSquad ? (this.state?.currentTier ?? 7) : 7;
    const prevPyramid = carryOverSquad && this.state?.leaguePyramid ? JSON.parse(JSON.stringify(this.state.leaguePyramid)) : undefined;
    const prevChronicles = carryOverSquad && this.state?.chronicles ? JSON.parse(JSON.stringify(this.state.chronicles)) : undefined;
    const prevIntel = carryOverSquad && this.state?.opponentIntel ? JSON.parse(JSON.stringify(this.state.opponentIntel)) : undefined;
    const prevChemLinks = carryOverSquad && this.state?.chemistryLinks ? JSON.parse(JSON.stringify(this.state.chemistryLinks)) : undefined;
    const prevStayedTier = carryOverSquad ? (this.state?.stayedTierCount ?? 0) : 0;

    this.state = this.createNewSeasonState(
      opts,
      prevSeason + 1,
      prevMeta,
      prevLevels,
      prevHof,
      prevTut,
      prevPersistent,
      prevTier,
      prevPyramid
    );
    if (prevElements) this.state.elementInventory = prevElements;
    if (prevDeck) this.state.coachDeck = prevDeck;
    if (prevLoadout) this.state.coachLoadoutIds = prevLoadout;
    if (prevRecipes) this.state.discoveredRecipes = prevRecipes;
    if (prevRoster) this.state.clubRoster = prevRoster;
    if (prevRosterSel) this.state.rosterSelectedIds = prevRosterSel;
    if (prevRosterRefreshes !== undefined) this.state.rosterRefreshesRemaining = prevRosterRefreshes;
    if (prevChronicles) this.state.chronicles = prevChronicles;
    if (prevIntel) this.state.opponentIntel = prevIntel;
    if (prevChemLinks) this.state.chemistryLinks = prevChemLinks;
    this.state.stayedTierCount = prevStayedTier;
    this.state.chronicleSeasonAdvancedIds = [];
    this.state.chronicleExtraUnlockedThisSeason = false;
    ensureChronicles(this.state);
    if (this.state.phase === 'REGULAR_SEASON') {
      const ucNow = this.getUserClub();
      this.state.interMatchPrep = createInterMatchPrep(this.state, ucNow);
      const startChr = triggerSeasonStartChronicle(this.state, ucNow);
      if (startChr) this.state.pendingStoryEvent = startChr;
    }
    if (prevSkillWeb && prevSkillWeb.length > 0) {
      const seasonStyleOrigin = getOriginForStyle(opts.style ?? 'tiki_taka');
      const seasonFormOrigin = getOriginForFormation(opts.formation ?? '4-3-3');
      this.state.skillWebUnlocked = Array.from(new Set([...prevSkillWeb, seasonStyleOrigin, seasonFormOrigin]));
    }
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
    existingPyramid?: Record<number, ClubDirectoryEntry[]>
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
          seasonStats: {
            appearances: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0,
            tackles: 0, interceptions: 0, passes: 0, passesSuccess: 0, distanceM: 0, saves: 0,
          },
        }))
      : [];

    const baseTpl = FICTIONAL_CLUBS.find(c => c.id === userClubTemplateId) ?? FICTIONAL_CLUBS[0];
    const userTpl = {
      ...baseTpl,
      name: opts.customName || baseTpl.name,
      shortName: opts.customName ? opts.customName.slice(0, 2) : baseTpl.shortName,
      primaryColor: opts.primaryColor || baseTpl.primaryColor,
      secondaryColor: opts.secondaryColor || baseTpl.secondaryColor,
    };
    const pyramid = existingPyramid ?? generateTierPyramid(userClubTemplateId, userTpl);
    const tierEntries = pyramid[currentTier] ?? pyramid[7];

    const clubs: LeagueClub[] = tierEntries.map((entry, idx) => {
      const isUser = entry.id === userClubTemplateId;
      const aiForm = AI_FORMATIONS[idx % AI_FORMATIONS.length];
      const aiStyle = AI_STYLES[idx % AI_STYLES.length];
      const aiSquad = isUser ? carriedSquad : generateAIDraftSquad(Math.max(32, Math.min(86, entry.baseStrength)));
      const name = isUser && opts.customName ? opts.customName : entry.name;
      return {
        id: entry.id,
        name,
        shortName: isUser && opts.customName ? opts.customName.slice(0, 2) : entry.shortName,
        primaryColor: isUser && opts.primaryColor ? opts.primaryColor : entry.primaryColor,
        secondaryColor: isUser && opts.secondaryColor ? opts.secondaryColor : entry.secondaryColor,
        isUser,
        formation: isUser ? formation : aiForm,
        style: isUser ? style : aiStyle,
        squad: aiSquad,
        starterIds: isUser ? (hasCarryOver ? autoSelectStarters(carriedSquad, formation) : []) : autoSelectStarters(aiSquad, aiForm),
        perks: [],
      };
    });

    const fixtures = generateRoundRobinFixtures(clubs.map(c => c.id), true);
    const storyline = rollSeasonStoryline(userClubTemplateId);
    const userClubName = clubs.find(c => c.isUser)?.name ?? '星辰联';
    return {
      seasonNumber,
      phase: hasCarryOver ? 'REGULAR_SEASON' : 'INIT_DRAFT',
      currentRound: 1,
      userClubId: userClubTemplateId,
      clubs,
      fixtures,
      draft: createInitialDraftState(metaLevels, currentTier),
      reDraft: null,
      metaPointsTotal,
      metaLevels,
      storyline,
      pendingStoryEvent: hasCarryOver ? createOpeningBriefing(storyline, userClubName) : null,
      storyLog: [],
      elementInventory: createInitialElements(),
      coachDeck: createStarterCoachDeck(),
      persistentSquad: hasCarryOver ? carriedSquad : undefined,
      skillWebUnlocked: [getOriginForStyle(style), getOriginForFormation(formation)],
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
      this.state.coachDeck = createStarterCoachDeck();
    }
    return this.state.coachDeck;
  }

  public getLoadoutIds(): string[] {
    const deck = this.getCoachDeck();
    const deckIds = new Set(deck.map(c => c.id));
    if (!this.state.coachLoadoutIds) {
      this.state.coachLoadoutIds = deck.slice(0, 4).map(c => c.id);
    } else {
      this.state.coachLoadoutIds = this.state.coachLoadoutIds.filter(id => deckIds.has(id)).slice(0, 4);
    }
    return this.state.coachLoadoutIds;
  }

  public getMatchLoadout(): CommandCard[] {
    const deck = this.getCoachDeck();
    const ids = this.getLoadoutIds();
    const list = ids.map(id => deck.find(c => c.id === id)).filter((c): c is CommandCard => !!c).slice(0, 4);
    return list.length > 0 ? list : deck.slice(0, 1);
  }

  public toggleLoadoutCard(cardId: string): { ok: boolean; equipped?: boolean; reason?: string } {
    const ids = this.getLoadoutIds();
    const idx = ids.indexOf(cardId);
    if (idx >= 0) {
      ids.splice(idx, 1);
      return { ok: true, equipped: false };
    }
    if (ids.length >= 4) return { ok: false, reason: '出战卡槽已满 (4/4)，请先卸下 1 张' };
    ids.push(cardId);
    return { ok: true, equipped: true };
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
    const minBand = tierBase + meta.scout + (meta.fitness >= 3 ? 2 : 0);
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
      const minBand = tierBase + meta.scout + (meta.fitness >= 3 ? 2 : 0);
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
    this.state.chronicleSeasonAdvancedIds = [];
    this.state.chronicleExtraUnlockedThisSeason = false;
    triggerSeasonStartChronicle(this.state, club);
    this.state.interMatchPrep = createInterMatchPrep(this.state, club);
    tryUnlockAchievement(this.state, 'ach_first_draft');
    if (this.state.storyline) {
      this.state.pendingStoryEvent = createOpeningBriefing(this.state.storyline, club.name);
    }
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
    this.state.seasonTrainedIds = this.state.seasonTrainedIds ?? [];
    if (this.state.seasonTrainedIds.includes(playerId)) {
      return { ok: false, reason: '该球员本休赛期已完成特训（每季限 1 次）' };
    }
    if (this.state.metaPointsTotal < 10) {
      return { ok: false, reason: 'Meta 点数不足（休赛期特训需要 10 pt）' };
    }
    const club = this.getUserClub();
    const p = club.squad.find(x => x.id === playerId);
    if (!p) return { ok: false, reason: '未找到该球员' };
    if (p.ca >= 94) return { ok: false, reason: '该球员已达当前培养上限 (CA 94)' };

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

    p.ca = computeWeightedCA(p.role, p.attributes);
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

  public autoFillClubRoster26(): { added: number } {
    if (this.isSeasonInProgress()) {
      return { added: 0 };
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
        if (meta.coaching > 0) {
          attrs.passing = clampAttr(attrs.passing + Math.min(3, meta.coaching));
          attrs.shooting = clampAttr(attrs.shooting + Math.min(3, meta.coaching));
          if (meta.coaching >= 2) attrs.defending = clampAttr(attrs.defending + Math.min(3, meta.coaching));
        }
        if (meta.fitness > 0) {
          attrs.stamina = clampAttr(attrs.stamina + Math.min(3, meta.fitness) * 3);
          if (meta.fitness >= 2) attrs.pace = clampAttr(attrs.pace + Math.min(3, meta.fitness));
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
      if (p.role === 'GK') {
        attrs.goalkeeping = clampAttr(attrs.goalkeeping + synergy.goalkeepingDelta);
      }

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
        };
      });

    const tacticalMods = club.isUser
      ? computeSkillWebMods(this.getSkillWebUnlocked(), club.formation, club.style)
      : undefined;

    const spineBonus = club.isUser ? computeCentralSpineInfo(club, this.getChemistryLinks()).bonus : 0;
    let teamFamAvg = 50;
    let teamChemAvg = 30;
    if (club.isUser) {
      teamFamAvg = players.length > 0
        ? Math.round(players.reduce((s, pl) => s + (pl.formationFamiliarity ?? 40), 0) / players.length)
        : 40;
      const chemSummary = this.getTacticsChemistrySummary();
      teamChemAvg = chemSummary.specs.length > 0
        ? Math.round(chemSummary.specs.reduce((s, sp) => s + sp.link.score, 0) / chemSummary.specs.length)
        : 30;
    }

    return {
      name: club.name,
      formation: club.formation,
      style: club.style,
      players,
      subs,
      tacticalMods,
      centralSpineBonus: spineBonus,
      equippedSkills: club.isUser ? this.getEquippedActiveSkills() : undefined,
      teamFamiliarityAvg: club.isUser ? teamFamAvg : undefined,
      teamChemistryAvg: club.isUser ? teamChemAvg : undefined,
      gridSlots: club.gridSlots,
      slotDuties: club.slotDuties,
      weather: this.state.interMatchPrep?.weather ?? 'sunny',
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
      if (this.state.phase !== 'REGULAR_SEASON' || this.state.pendingStoryEvent) {
        return {
          simulated,
          stoppedReason:
            this.state.phase === 'RE_DRAFT' ? '触发赛季中期 Re-Draft 补强' :
            this.state.phase === 'SEASON_END' ? '常规赛全部结束，进入赛季结算' :
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
      for (const mp of res.players) aiMatchFitness.set(mp.id, mp.fitness);
      this.applyMatchOutcome(fx, res);
    }

    // 新星故事线：U23 球员每轮稳定成长
    if (this.state.storyline?.id === 'wonderkid') {
      const userClub = this.getUserClub();
      for (const p of userClub.squad) {
        if (p.age <= 23) {
          p.attributes.passing = Math.min(99, p.attributes.passing + 1);
          p.attributes.shooting = Math.min(99, p.attributes.shooting + 1);
          p.attributes.pace = Math.min(99, p.attributes.pace + 1);
          p.ca = computeWeightedCA(p.role, p.attributes);
        }
      }
    }

    // 赛后体能恢复、体能疲惫/轻伤判定与士气浮动
    const userEndFitness = new Map<string, number>();
    for (const mp of userMatchResult.players) {
      userEndFitness.set(mp.id, mp.fitness);
    }
    const userIsHome = userFixture.homeClubId === this.state.userClubId;
    const myGoals = userIsHome ? userFixture.homeGoals : userFixture.awayGoals;
    const oppGoals = userIsHome ? userFixture.awayGoals : userFixture.homeGoals;
    const userWon = myGoals > oppGoals;
    const fitLv = this.getMetaLevels().fitness ?? 0;
    const activeRecover = 20 + fitLv * 3;
    const restRecover = 46 + fitLv * 5;
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
          p.fitness = aiEnd !== undefined
            ? Math.min(100, Math.round(aiEnd + 38))
            : Math.min(100, Math.round((p.fitness ?? 100) + 50));
        }
      }
    }
    const oppClubId = userIsHome ? userFixture.awayClubId : userFixture.homeClubId;
    updateOpponentIntelAfterMatch(this.state, oppClubId, myGoals, oppGoals);
    const userClubTmp = this.getUserClub();
    this.replaceUnavailableStarters(userClubTmp);
    this.state.lastMatchReview = generatePostMatchReview(userMatchResult, userClubTmp.name);
    const hof = this.getHallOfFame();
    hof.totalGoals += myGoals;
    if (userWon) {
      hof.totalWins += 1;
      tryUnlockAchievement(this.state, 'ach_first_win');
      if (oppGoals === 0) tryUnlockAchievement(this.state, 'ach_clean_sheet');
    }
    const userSide = userIsHome ? 'home' : 'away';
    if (userMatchResult.players.some(p => p.team === userSide && p.matchStats.goals >= 3)) {
      tryUnlockAchievement(this.state, 'ach_hattrick');
    }
    if ((userMatchResult.unlockedHiddenTraits || []).some(u => u.team === userSide)) {
      tryUnlockAchievement(this.state, 'ach_hidden_trait');
    }
    const drops = userWon ? 2 : 1;
    const inv = this.getElementInventory();
    for (let i = 0; i < drops; i++) {
      const el = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
      inv[el.id] = (inv[el.id] ?? 0) + 1;
    }

    // 积累当前阵型与战术风格熟练度经验（胜场+2，平负+1；战术幕僚Lv.5翻倍）
    const userClubNow = this.getUserClub();
    const mastery = this.getTacticalMastery();
    const xpMul = this.getMetaLevels().coaching >= 5 ? 2 : 1;
    const xpGain = (userWon ? 2 : 1) * xpMul;
    mastery.formations[userClubNow.formation] = Math.min(15, (mastery.formations[userClubNow.formation] ?? 0) + xpGain);
    mastery.styles[userClubNow.style] = Math.min(15, (mastery.styles[userClubNow.style] ?? 0) + xpGain);

    // 慢热成长：个人阵型熟练度（首发+3/+5，替补+1，幕僚Lv.5×1.5）
    this.lastMatchGrowth = {};
    const unlockedTraitMap = new Map<string, string>();
    for (const u of userMatchResult.unlockedHiddenTraits || []) {
      if (u.team === userSide) unlockedTraitMap.set(u.playerId, u.trait);
    }
    const webUnlocked = this.getSkillWebUnlocked();
    const hasFormNode = webUnlocked.includes(`fm_${userClubNow.formation}`);
    const famMul = this.getMetaLevels().coaching >= 5 ? 1.5 : 1;
    for (const p of userClubNow.squad) {
      const curFam = this.getPlayerFamiliarity(p, userClubNow.formation);
      const isStarter = userEndFitness.has(p.id);
      const baseAdd = isStarter ? (3 + (hasFormNode ? 2 : 0)) : 1;
      const gain = Math.round(baseAdd * famMul);
      p.formationFamiliarity = p.formationFamiliarity ?? {};
      const nextFam = Math.min(100, curFam + gain);
      p.formationFamiliarity[userClubNow.formation] = nextFam;
      this.lastMatchGrowth[p.id] = {
        famGain: Math.max(0, nextFam - curFam),
        chemGain: 0,
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

    this.advanceAfterRound();
    if (this.state.phase !== 'SEASON_END') {
      this.state.interMatchPrep = createInterMatchPrep(this.state, userClubNow);
      this.state.pendingPostMatchReward = this.createPostMatchRewardState(userWon);
      if (this.state.phase === 'REGULAR_SEASON' && !this.state.pendingStoryEvent) {
        const chrEvent = evaluateChronicleTrigger(this.state, userClubNow, this.getStandings());
        if (chrEvent) this.state.pendingStoryEvent = chrEvent;
      }
    } else {
      this.state.pendingPostMatchReward = null;
      this.state.interMatchPrep = null;
    }
  }

  private createPostMatchRewardState(won: boolean): PostMatchRewardState {
    const allCats: PostMatchRewardCategory[] = [
      'player',
      'stat_boost',
      'line_boost',
      'craft_card',
      'event',
      'trait_forge',
      'tactical_pact',
      'chemistry_forge',
    ];
    const club = this.getUserClub();
    const recent = new Set(this.state.recentRewardCategories ?? []);
    const tiredCount = club.squad.filter(p => (p.fitness ?? 100) < 72).length;
    const hasHighCostCard = this.getCoachDeck().some(c => c.cost >= 2);

    // 上下文智能加权 + 防连续重复：优先抽取上一轮未出现过的门类
    const scored = allCats.map(cat => {
      let weight = recent.has(cat) ? 0.35 : 1.5;
      if (!won && (cat === 'tactical_pact' || cat === 'trait_forge' || cat === 'player')) weight += 0.55;
      if (tiredCount >= 3 && (cat === 'event' || cat === 'tactical_pact')) weight += 0.5;
      if (hasHighCostCard && (cat === 'chemistry_forge' || cat === 'craft_card')) weight += 0.45;
      if ((this.state.currentRound % 3 === 0) && cat === 'trait_forge') weight += 0.4;
      return { cat, score: weight * (0.65 + Math.random() * 0.7) };
    });
    scored.sort((a, b) => b.score - a.score);
    const picked = scored.slice(0, 3).map(s => s.cat);
    this.state.recentRewardCategories = picked;

    return {
      round: this.state.currentRound,
      won,
      categories: picked,
      chosenCategory: null,
      options: [],
      pendingStatOptionId: null,
      completed: false,
    };
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
      const cands = generateShuffleSet(3, tierBase + winBonus, tierBase + 13 + winBonus);
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
      const focuses: CraftFocus[] = ['balanced', 'endure', 'surge'];
      const e1 = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
      const e2 = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
      const synth = synthesizeChemistry([e1.id, e2.id], focuses[Math.floor(Math.random() * focuses.length)], true);
      options.push({
        id: 'pm_cc_new',
        category: 'craft_card',
        title: `成品指挥卡：${synth.card.name}`,
        subtitle: synth.card.summary,
        rarity: 'epic',
        craftReward: { kind: 'new_card', card: synth.card },
      });
      options.push({
        id: 'pm_cc_upg',
        category: 'craft_card',
        title: '战术精研：现有指挥卡 +1 级',
        subtitle: '随机将卡库内 1 张未满级指挥卡免费升阶 Lv.+1',
        rarity: 'rare',
        craftReward: { kind: 'upgrade_card' },
      });
      const elA = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
      const elB = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
      options.push({
        id: 'pm_cc_elem',
        category: 'craft_card',
        title: `高阶元素包：${elA.name}×2 + ${elB.name}×1`,
        subtitle: '直接入库用于化学实验室合成高阶双效果指挥卡',
        rarity: 'common',
        craftReward: { kind: 'elements', elements: [{ id: elA.id, name: elA.name, count: 2 }, { id: elB.id, name: elB.name, count: 1 }] },
      });
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
          title: '契约·黑市炼金：Meta与备战点双收',
          subtitle: '代价：消耗最多 2 元素 | 收益：Meta +50pt、下轮备战点 +1、全队冷静 +1',
          rarity: 'epic',
          pactReward: { kind: 'black_market_alchemy', description: '消耗最多2元素换取 Meta +50pt、备战点 +1 及冷静+1' },
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
          title: '指挥卡超频降费：战术能量减负',
          subtitle: '卡库内 1 张高费卡(2+费)能量消耗 -1 且持续时间 +2 分（若无则赠 Meta +25pt）',
          rarity: 'epic',
          chemReward: { kind: 'card_overclock', description: '高费指挥卡费用 -1、持续 +2 分钟' },
        },
      ];
      for (let i = chemPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chemPool[i], chemPool[j]] = [chemPool[j], chemPool[i]];
      }
      options.push(...chemPool.slice(0, 3));
    } else {
      const chrons = ensureChronicles(this.state);
      const evPool: PostMatchRewardOption[] = [];
      evPool.push({
        id: 'pm_ev_meta',
        category: 'event',
        title: '理事会嘉奖：Meta 天赋 +35pt',
        subtitle: '直接入账教练天赋树与 SkillWeb 技能网点数 +35pt',
        rarity: 'epic',
        eventReward: { kind: 'meta_grant', amount: 35, description: '直接获得 Meta 天赋点数 +35pt' },
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
  ): { ok: boolean; needsTarget?: boolean; summary?: string; reason?: string } {
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

    if (opt.category === 'craft_card' && opt.craftReward) {
      const cr = opt.craftReward;
      if (cr.kind === 'new_card' && cr.card) {
        const deck = this.getCoachDeck();
        if (deck.length < 12) {
          deck.push(cr.card);
          const loadout = this.getLoadoutIds();
          if (loadout.length < 4) loadout.push(cr.card.id);
          rw.summaryText = `获得指挥卡【${cr.card.name}】`;
        } else {
          this.state.metaPointsTotal += 20;
          rw.summaryText = `卡库已满，折算 Meta +20pt`;
        }
      } else if (cr.kind === 'upgrade_card') {
        const deck = this.getCoachDeck();
        const upgradable = deck.find(c => (c.level ?? 1) < 4);
        if (upgradable) {
          upgradeCommandCard(upgradable);
          rw.summaryText = `指挥卡【${upgradable.name}】免费升至 Lv.${upgradable.level}`;
        } else {
          this.state.metaPointsTotal += 20;
          rw.summaryText = `所有指挥卡已满级，改赠 Meta +20pt`;
        }
      } else if (cr.kind === 'elements' && cr.elements) {
        const inv = this.getElementInventory();
        for (const el of cr.elements) {
          inv[el.id] = (inv[el.id] ?? 0) + el.count;
        }
        rw.summaryText = `入库元素：${cr.elements.map(e => `${e.name}×${e.count}`).join(' + ')}`;
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
        const inv = this.getElementInventory();
        let spent = 0;
        for (const el of TACTICAL_ELEMENTS) {
          while ((inv[el.id] ?? 0) > 0 && spent < 2) {
            inv[el.id] -= 1;
            spent++;
          }
        }
        this.state.metaPointsTotal += 50;
        if (this.state.interMatchPrep) {
          this.state.interMatchPrep.actionsLeft += 1;
        }
        for (const p of club.squad) {
          p.attributes.composure = clampAttr(p.attributes.composure + 1);
          p.ca = computeWeightedCA(p.role, p.attributes);
        }
        rw.summaryText = `黑市炼金完成：消耗 ${spent} 元素，入账 Meta +50pt、下轮备战点 +1、全队冷静 +1`;
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
        const deck = this.getCoachDeck();
        const highCost = deck.find(c => c.cost >= 2);
        if (highCost) {
          highCost.cost = Math.max(1, highCost.cost - 1);
          highCost.durationMinutes += 2;
          rw.summaryText = `超频成功：【${highCost.name}】费用降至 ${highCost.cost}，持续 +2分`;
        } else {
          this.state.metaPointsTotal += 25;
          rw.summaryText = '卡库均为 1 费卡，改赠 Meta +25pt';
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
    for (const mp of res.players) {
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
          const assister = lastGoal.assistPlayerName ?? userTopAssister?.name;
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

    // 常规赛第 8、17、26 轮结束后触发 Re-Draft（AI 球队同步补强）
    if (this.state.phase === 'REGULAR_SEASON' && RE_DRAFT_ROUNDS.has(r)) {
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

      const club = this.getUserClub();
      this.state.reDraft = createReDraftOffer(
        r,
        club.perks.map(p => p.id),
        this.getMetaLevels(),
        tier
      );
      this.state.phase = 'RE_DRAFT';
      return;
    }

    // 34 轮双循环常规赛全部结束 -> 直接按积分榜排名结算并执行 7 级联赛升降级
    if (this.state.phase === 'REGULAR_SEASON' && r >= TOTAL_REGULAR_ROUNDS) {
      const standings = this.getStandings();
      const userRank = standings.findIndex(s => s.clubId === this.state.userClubId) + 1;
      this.finalizeSeason(userRank);
      return;
    }

    // 常规赛下一轮
    this.state.currentRound = r + 1;
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
    if (computePerkSynergies(club.perks).synergies.length > 0) {
      tryUnlockAchievement(this.state, 'ach_synergy');
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
    const rec = getOpponentIntelRecord(this.state, prep.matchupIntel.oppClubId);
    rec.familiarity = Math.min(100, rec.familiarity + 30);
    const refreshed = buildOpponentMatchupIntel(this.state, this.getUserClub());
    if (refreshed) {
      refreshed.scoutedThisRound = true;
      refreshed.chosenCounterId = prep.matchupIntel.chosenCounterId;
      refreshed.spotCorrect = prep.matchupIntel.spotCorrect;
      prep.matchupIntel = refreshed;
    }
    prep.actionsLeft -= 1;
    return { ok: true, msg: `侦察完成！对【${prep.matchupIntel.oppClubName}】了解度升至 ${rec.familiarity}%` };
  }

  public chooseOpponentCounter(counterId: string): { ok: boolean; correct?: boolean; msg?: string } {
    const prep = this.getInterMatchPrep();
    const intel = prep?.matchupIntel;
    if (!prep || !intel) return { ok: false, msg: '暂无对手情报' };
    if (intel.chosenCounterId) return { ok: false, msg: '本轮已完成战术指证' };
    const opt = intel.counters.find(c => c.id === counterId);
    if (!opt) return { ok: false, msg: '无效的指证方案' };
    intel.chosenCounterId = opt.id;
    intel.spotCorrect = opt.isCorrect;
    if (opt.isCorrect) {
      prep.nextMatchBuff = {
        ...(prep.nextMatchBuff ?? {}),
        passingBonus: (prep.nextMatchBuff?.passingBonus ?? 0) + (opt.buff.passingBonus ?? 0),
        shootingBonus: (prep.nextMatchBuff?.shootingBonus ?? 0) + (opt.buff.shootingBonus ?? 0),
        defendingBonus: (prep.nextMatchBuff?.defendingBonus ?? 0) + (opt.buff.defendingBonus ?? 0),
        paceBonus: (prep.nextMatchBuff?.paceBonus ?? 0) + (opt.buff.paceBonus ?? 0),
        energyBonus: (prep.nextMatchBuff?.energyBonus ?? 0) + (opt.buff.energyBonus ?? 0),
        note: opt.buff.note,
      };
      return { ok: true, correct: true, msg: `异议成立！${opt.buff.note}` };
    }
    return { ok: true, correct: false, msg: '误判了烟雾弹！未触发针对性红利（无惩罚，可正常应战）' };
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
        const top3 = sortedCur.slice(0, tier > 1 ? 3 : 0);
        const mid = sortedCur.slice(tier > 1 ? 3 : 0, tier < TOTAL_TIERS ? sortedCur.length - 3 : sortedCur.length);
        const bot3 = sortedCur.slice(tier < TOTAL_TIERS ? sortedCur.length - 3 : sortedCur.length);

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
    if ((this.state.metaLevels?.finance ?? 0) >= 5) {
      metaEarned = Math.round(metaEarned * 1.15);
    }
    let storyBonus = 0;
    if (this.state.storyline?.id === 'underdog') {
      const next = Math.round(metaEarned * 1.25);
      storyBonus = next - metaEarned;
      metaEarned = next;
    }

    this.state.metaPointsTotal += metaEarned;
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

    // 赛季末动态能力结算：全队年龄 +1 岁，出场少/表现差会掉 CA，表现优异的年轻球员向潜力上限 PA 成长
    for (const p of userClub.squad) {
      const oldCa = p.ca;
      const pst = p.seasonStats;
      p.age = (p.age ?? 24) + 1;
      const pa = p.pa ?? Math.min(96, p.ca + (p.age <= 23 ? 16 : p.age <= 27 ? 8 : 3));
      p.pa = pa;

      // 1. 出场过少（<=5场）导致竞技状态下滑
      if (pst.appearances <= 5) {
        const drop = metaLv.fitness >= 5 ? 1 : 2;
        p.attributes.pace = clampAttr(p.attributes.pace - drop);
        p.attributes.stamina = clampAttr(p.attributes.stamina - drop);
        p.attributes.composure = clampAttr(p.attributes.composure - 1);
      } else if (
        pst.appearances >= 12 &&
        (['ST', 'LW', 'RW', 'CAM'].includes(p.role) && pst.goals === 0 && pst.assists === 0)
      ) {
        // 2. 主力攻击手长期哑火（>=12场0球0助），状态下滑
        p.attributes.shooting = clampAttr(p.attributes.shooting - 1);
        p.attributes.composure = clampAttr(p.attributes.composure - 1);
      } else if (pst.appearances >= 10) {
        // 3. 表现优异成长（U23 成长更快，受潜力上限 PA 约束）
        const goodPerf = pst.goals >= 8 || pst.assists >= 6 || pst.cleanSheets >= 8;
        const baseGrowth = p.age <= 23 ? (goodPerf ? 4 : 3) : (goodPerf ? 3 : 2);
        const academyBonus = p.age <= 23 && metaLv.academy >= 3 ? 1 : 0;
        const delta = baseGrowth + academyBonus;
        if (p.ca < pa) {
          if (p.role === 'GK') {
            p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + delta);
            p.attributes.positioning = clampAttr(p.attributes.positioning + 1);
          } else {
            p.attributes.passing = clampAttr(p.attributes.passing + delta);
            p.attributes.composure = clampAttr(p.attributes.composure + 1);
            if (pst.goals >= 4) p.attributes.shooting = clampAttr(p.attributes.shooting + delta);
            if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.role)) p.attributes.defending = clampAttr(p.attributes.defending + 1);
          }
        }
      }

      // 4. 老将体能/速度自然衰退（>=30岁），体能医疗Lv.5减半
      if (p.age >= 30) {
        const ageDrop = metaLv.fitness >= 5 ? 1 : 2;
        p.attributes.pace = clampAttr(p.attributes.pace - ageDrop);
        p.attributes.stamina = clampAttr(p.attributes.stamina - 1);
      }

      p.ca = computeWeightedCA(p.role, p.attributes);
      if (p.ca > pa && p.ca > oldCa) {
        p.ca = pa;
      }
      p.lastCaDelta = p.ca - oldCa;

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

    // 同步至 40 人大名单，且未入选本季 26 人的球员若长期枯坐板凳也轻微掉状态 (-1)
    const activeIds = new Set(userClub.squad.map(p => p.id));
    const roster = this.getClubRoster();
    for (const rp of roster) {
      if (!activeIds.has(rp.id)) {
        const oldCa = rp.ca;
        rp.age = (rp.age ?? 24) + 1;
        rp.attributes.stamina = clampAttr(rp.attributes.stamina - 1);
        rp.attributes.pace = clampAttr(rp.attributes.pace - 1);
        rp.ca = computeWeightedCA(rp.role, rp.attributes);
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
    };

    this.state.lastSummary = summary;
    this.state.phase = 'SEASON_END';
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
      const e1 = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
      const e2 = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
      const synth = synthesizeChemistry([e1.id, e2.id], 'balanced', true);
      upgradeCommandCard(synth.card);
      const deck = this.getCoachDeck();
      if (deck.length < 12) {
        deck.push(synth.card);
      } else {
        this.state.metaPointsTotal += 35;
      }
      const inv = this.getElementInventory();
      for (let i = 0; i < 4; i++) {
        const el = TACTICAL_ELEMENTS[Math.floor(Math.random() * TACTICAL_ELEMENTS.length)];
        inv[el.id] = (inv[el.id] ?? 0) + 1;
      }
      sum.seasonBonusSummary = `获得 Lv.${synth.card.level ?? 2} 指挥卡【${synth.card.name}】及 4 个战术元素！`;
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
}
