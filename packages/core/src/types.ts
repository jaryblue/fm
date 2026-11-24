/**
 * @fm-league/core - FM27 风格轻度 Rogue 联赛核心类型
 */

import {
  FormationName,
  PlayerAttributes,
  PlayerDuty,
  PlayerInput,
  TacticalStyle,
} from '../../engine/src/types';
import { CommandCard, ElementId } from './CommandCards';

export type PlayerTier = 'S' | 'A' | 'B' | 'C';
export type PlayerMorale = 'low' | 'normal' | 'high';

export interface TempTraitBuff {
  trait: string;
  tier: 'silver' | 'gold';
  remainingMatches: number;
}

export interface DraftPlayer extends PlayerInput {
  ca: number;              // 综合能力 55 - 92
  cost: number;            // 选秀预算点 (40 - 130)
  tier: PlayerTier;
  age: number;
  trait?: string;          // 球员原型与特质展示文本
  traits?: string[];       // 实装引擎词条列表
  goldTraits?: string[];   // FC26 金标 PlayStyle+（2倍加成）
  silverTraits?: string[]; // FC26 银标 PlayStyle（基础加成）
  tempTraits?: TempTraitBuff[]; // 赛后肉鸽等获得的临时特质（持续若干轮后自动过期）
  hiddenTrait?: string;    // 触发式隐藏词条（未觉醒前不显示名称）
  seasonYellowsSinceBan?: number;
  suspendedRounds?: number;
  injuredRounds?: number;
  strainWarning?: boolean;
  morale?: PlayerMorale;
  isNewSigning?: boolean;
  pa?: number;             // 潜力上限 (Potential Ability)
  lastCaDelta?: number;    // 上赛季结算 CA 涨跌变化
  isAcademy?: boolean;     // 青训学院提拔新星（天生高阵型熟练度）
  formationFamiliarity?: Partial<Record<FormationName, number>>; // 0-100 各阵型个人熟练度
  careerStats?: {
    seasons: number;
    appearances: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    championships: number;
  };
  seasonStats: {
    appearances: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    yellowCards: number;
    redCards: number;
    tackles?: number;
    interceptions?: number;
    passes?: number;
    passesSuccess?: number;
    distanceM?: number;
    saves?: number;
  };
}

export type PerkCategory = 'attack' | 'defense' | 'control';

export interface TacticalPerk {
  id: string;
  name: string;
  description: string;
  category: PerkCategory;
  rarity: 'common' | 'rare' | 'epic';
  effect: {
    passingBonus?: number;
    shootingBonus?: number;
    defendingBonus?: number;
    paceBonus?: number;
    staminaBonus?: number;
    goalkeepingBonus?: number;
  };
}

export interface ClubDirectoryEntry {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  baseStrength: number;
}

export interface LeagueTierDef {
  tier: number; // 1 = 最高级超级联赛, 7 = 最低级社区业余联赛
  name: string;
  shortLabel: string;
  baseCA: number;
  promoteCount: number;
  relegateCount: number;
  metaMul: number;
}

export interface LeagueClub {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  isUser: boolean;
  formation: FormationName;
  style: TacticalStyle;
  squad: DraftPlayer[];        // 16~26人名单
  starterIds: string[];        // 11人首发ID（按阵型槽位顺序）
  captainId?: string;          // 场上队长袖标归属球员 ID
  perks: TacticalPerk[];       // 本赛季激活的 Rogue 战术词条
  gridSlots?: Record<number, { col: number; row: number }>; // FM27 5×6 格子微调坐标
  slotDuties?: Record<number, PlayerDuty>; // 各槽位同位置职责风格
}

export interface FixtureMatch {
  id: string;
  round: number;               // 1..34 常规赛双循环
  stage: 'regular' | 'semi' | 'final' | 'third';
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  homeGoals: number;
  awayGoals: number;
  homeXG: number;
  awayXG: number;
}

export interface StandingRow {
  clubId: string;
  clubName: string;
  isUser: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: Array<'W' | 'D' | 'L'>;
}

export type LeaguePhase =
  | 'INIT_DRAFT'
  | 'REGULAR_SEASON'
  | 'RE_DRAFT'
  | 'PLAYOFF_SEMI'
  | 'PLAYOFF_FINAL'
  | 'SEASON_END';

export type MetaBranch = 'scout' | 'finance' | 'coaching' | 'fitness' | 'academy';
export type MetaLevels = Record<MetaBranch, number>;

export interface TacticalMasteryData {
  formations: Record<FormationName, number>;
  styles: Record<TacticalStyle, number>;
}

export type StorylineId = 'underdog' | 'revenge' | 'veteran' | 'wonderkid';

export interface SeasonStoryline {
  id: StorylineId;
  title: string;
  description: string;
  rivalClubId?: string;
}

export interface StoryChoiceOption {
  id: string;
  label: string;
  effectDesc: string;
  effect?: TacticalPerk['effect'];
  metaPointsDelta?: number;
  youngBoost?: boolean;
  veteranBoost?: boolean;
}

export type ChronicleId =
  | 'pyramid_climb'
  | 'relegation_fight'
  | 'captain_torch'
  | 'scout_poach'
  | 'academy_roots'
  | 'tactician_path'
  | 'rival_chronicle';

export interface ChronicleProgress {
  id: ChronicleId;
  title: string;
  subtitle: string;
  artId: string;
  status: 'locked' | 'active' | 'completed';
  chapter: number;
  maxChapters: number;
  startSeason?: number;
  endSeason?: number;
  startTier?: number;
  endTier?: number;
  keyPeople: string[];
  choicesMade: string[];
  statSnapshot: string;
  memorableMoment?: string;
  flags: string[];
}

export type MatchWeather = 'sunny' | 'rain' | 'wind' | 'heat';
export type PrepTrainingKind = 'physio' | 'tactical' | 'mentor' | 'sharp';

export interface OpponentIntelRecord {
  clubId: string;
  familiarity: number;
  playedCount: number;
  wins: number;
  draws: number;
  losses: number;
  lastScore?: string;
}

export interface OpponentClueItem {
  id: string;
  text: string;
  isSmoke?: boolean;
  confidence: 'high' | 'mid' | 'low';
}

export interface OpponentCounterOption {
  id: string;
  label: string;
  desc: string;
  isCorrect: boolean;
  buff: {
    passingBonus?: number;
    shootingBonus?: number;
    defendingBonus?: number;
    paceBonus?: number;
    energyBonus?: number;
    note: string;
  };
}

export interface OpponentMatchupIntel {
  oppClubId: string;
  oppClubName: string;
  familiarity: number;
  recentFormText: string;
  h2hText: string;
  clues: OpponentClueItem[];
  counters: OpponentCounterOption[];
  chosenCounterId?: string;
  spotCorrect?: boolean;
  scoutedThisRound?: boolean;
}

export interface InterMatchPrepState {
  round: number;
  actionsLeft: number;
  doneTraining?: PrepTrainingKind;
  weather: MatchWeather;
  matchupIntel?: OpponentMatchupIntel | null;
  playerTalk?: {
    id: string;
    playerId: string;
    playerName: string;
    role: string;
    prompt: string;
    optA: { label: string; effectDesc: string; kind: 'promise_start' | 'promise_sub' | 'rest' | 'boost' };
    optB: { label: string; effectDesc: string; kind: 'promise_start' | 'promise_sub' | 'rest' | 'boost' };
    resolved?: boolean;
    chosenLabel?: string;
  } | null;
  nextMatchBuff?: {
    playerId?: string;
    passingBonus?: number;
    shootingBonus?: number;
    composureBonus?: number;
    defendingBonus?: number;
    paceBonus?: number;
    energyBonus?: number;
    note?: string;
  };
}

export interface PendingStoryEvent {
  id: string;
  kind: 'briefing' | 'choice';
  round: number;
  badge: string;
  title: string;
  body: string;
  chronicleId?: ChronicleId;
  artId?: string;
  options: StoryChoiceOption[];
}

export interface DraftState {
  targetSquadSize: number;     // 默认 16 人
  budgetTotal: number;         // 默认 1280 预算点 + Meta 财政加成
  budgetRemaining: number;
  currentSetIndex: number;     // 0..3 (4轮 Shuffle Set，每轮从20人池里选4人)
  picksInCurrentSet: number;
  refreshesRemaining: number;  // 局外球探天赋提供的候选池刷新次数
  currentPool: DraftPlayer[];  // 当前可见的候选池
}

export interface ReDraftOffer {
  roundCompleted: number;
  candidates: DraftPlayer[];   // 6名新候选球员
  perkChoices: TacticalPerk[]; // 3~4张 Rogue 战术词条卡
  maxSwaps: number;            // 本次最多替换人数（默认2，财政Lv3为3）
  swapsUsed: number;
  perkChosen: boolean;
}

export interface SeasonBonusOption {
  id: string;
  kind: 'command_pack' | 'youth_awaken' | 'meta_jackpot';
  title: string;
  subtitle: string;
  badge: string;
}

export type SeasonMemoryKind =
  | 'LATE_WINNER'
  | 'COMEBACK'
  | 'CONTROVERSY'
  | 'HEROIC'
  | 'UPSET'
  | 'GOAL_FEST'
  | 'RED_CARD_STAND'
  | 'AWAKENING'
  | 'TITLE_CLASH';

export interface SeasonMemory {
  id: string;
  round: number;
  kind: SeasonMemoryKind;
  badge: string;
  title: string;
  summary: string;
  scoreText: string;
  oppName: string;
  playerName?: string;
  oppPlayerName?: string;
  assistPlayerName?: string;
  userFormation?: string;
  oppFormation?: string;
  oppStyle?: string;
  xgText?: string;
  possessionText?: string;
  contextTag?: string;
  details?: string[];
  minute?: number;
  dramaScore: number;
  isPainful?: boolean;
}

export interface SeasonSummary {
  finalRank: number;
  isChampion: boolean;
  regularRank: number;
  points: number;
  gf: number;
  ga: number;
  metaPointsEarned: number;
  topScorer: { name: string; clubName: string; goals: number } | null;
  topAssister?: { name: string; clubName: string; assists: number } | null;
  goldenGlove?: { name: string; clubName: string; cleanSheets: number } | null;
  seasonMVP?: { name: string; role: string; ca: number; goals: number; assists: number } | null;
  metaBreakdown?: {
    rankBase: number;
    tierMul: number;
    promoBonus: number;
    champBonus: number;
    storyBonus: number;
  };
  seasonBonusOptions?: SeasonBonusOption[];
  seasonBonusClaimedId?: string | null;
  seasonBonusSummary?: string;
  memories?: SeasonMemory[];
  tier?: number;
  tierName?: string;
  promotionStatus?: 'promoted' | 'relegated' | 'stayed';
  newTier?: number;
}

export interface SeasonHistoryRecord {
  seasonNumber: number;
  clubName: string;
  finalRank: number;
  regularRank: number;
  points: number;
  gf: number;
  ga: number;
  isChampion: boolean;
  storylineTitle?: string;
  topScorer?: { name: string; goals: number } | null;
  topMemory?: SeasonMemory | null;
  tier?: number;
  promotionStatus?: 'promoted' | 'relegated' | 'stayed';
}

export interface HallOfFameData {
  seasonsPlayed: number;
  championships: number;
  totalWins: number;
  totalGoals: number;
  records: SeasonHistoryRecord[];
  unlockedAchievements: string[];
}

export interface TutorialProgress {
  draft?: boolean;
  portal_prep?: boolean;
  portal_scout?: boolean;
  tactics?: boolean;
  cards?: boolean;
  match?: boolean;
  post_match?: boolean;
  skippedAll?: boolean;
}

export interface TacticalPresetSlot {
  id: string;
  name: string;
  formation: FormationName;
  style: TacticalStyle;
  starterIds: string[];
}

export interface LeagueSaveState {
  seasonNumber: number;
  currentTier?: number;
  leaguePyramid?: Record<number, ClubDirectoryEntry[]>;
  phase: LeaguePhase;
  currentRound: number;        // 1..34 常规赛双循环
  userClubId: string;
  clubs: LeagueClub[];
  fixtures: FixtureMatch[];
  draft: DraftState;
  reDraft: ReDraftOffer | null;
  metaPointsTotal: number;
  metaLevels?: MetaLevels;
  storyline?: SeasonStoryline;
  pendingStoryEvent?: PendingStoryEvent | null;
  storyLog?: string[];
  chronicles?: Record<ChronicleId, ChronicleProgress>;
  interMatchPrep?: InterMatchPrepState | null;
  opponentIntel?: Record<string, OpponentIntelRecord>;
  lastMatchReview?: string | null;
  stayedTierCount?: number;
  winlessStreak?: number;
  chronicleSeasonAdvancedIds?: ChronicleId[];
  chronicleExtraUnlockedThisSeason?: boolean;
  elementInventory?: Record<ElementId, number>;
  coachDeck?: CommandCard[];
  coachLoadoutIds?: string[];
  tacticalPresets?: TacticalPresetSlot[];
  persistentSquad?: DraftPlayer[];
  clubRoster?: DraftPlayer[];
  rosterSelectedIds?: string[];
  rosterRefreshesRemaining?: number;
  tacticalMastery?: TacticalMasteryData;
  skillWebUnlocked?: string[];
  skillLoadoutIds?: string[];
  chemistryLinks?: Record<string, ChemistryLink>;
  seasonRewardDrafts?: DraftPlayer[];
  seasonTrainedIds?: string[];
  discoveredRecipes?: string[];
  hallOfFame?: HallOfFameData;
  tutorialDone?: TutorialProgress;
  pendingPostMatchReward?: PostMatchRewardState | null;
  recentRewardCategories?: PostMatchRewardCategory[];
  recentGambleEventIds?: string[];
  seasonMemories?: SeasonMemory[];
  lastSummary: SeasonSummary | null;
}

export interface ChemistryLink {
  score: number;
  passes: number;
  assists: number;
  matches: number;
  title?: string;
}

export type PostMatchRoundCadence = 'normal' | 'focus' | 'crisis';
export type LeagueTierBracket = 'grassroots' | 'pro' | 'elite' | 'all';
export type GambleOutcomeTier = 'positive' | 'negative' | 'jackpot';

export interface GambleOutcomeEffect {
  fitnessDelta?: number;           // 全队或指定球员体能增减
  targetPlayerId?: string;
  moraleShift?: PlayerMorale;      // 士气变化
  injureStarterRounds?: number;    // 负面：随机1名首发轻伤轮次
  metaDelta?: number;              // Meta 点数变化（常规封顶 5~15，超额 25）
  prepActionsDelta?: number;       // 备战行动点变化
  scoutIntelDelta?: number;        // 下轮对手了解度变化
  elementsGain?: number;           // 赠送随机战术元素数量
  grantCardLevel?: number;         // 赠送指定等级指挥卡
  tempTrait?: { trait: string; tier: 'silver' | 'gold'; rounds: number };
  teamFamiliarityDelta?: number;   // 当前阵型熟练度增减
  pairChemistryDelta?: number;     // 随机首发连线默契增减
  attrDelta?: { attr: keyof PlayerAttributes; delta: number; scope: 'target' | 'u23' | 'veteran' | 'att' | 'def' };
  nextMatchBuff?: {
    passingBonus?: number;
    shootingBonus?: number;
    defendingBonus?: number;
    paceBonus?: number;
    composureBonus?: number;
    note: string;
  };
}

export interface TriStateGambleOutcome {
  tier: GambleOutcomeTier;
  prob: number;     // 整数百分比 (0..100)，三态之和 = 100
  label: string;    // 简短结果标题
  summary: string;  // 结算说明
  effect: GambleOutcomeEffect;
}

export interface TriStateGambleSpec {
  eventId: string;
  bracket: LeagueTierBracket;
  tierMin: number;
  tierMax: number;
  positive: TriStateGambleOutcome; // x% 常规正收益
  negative: TriStateGambleOutcome; // y% 负面代价
  jackpot: TriStateGambleOutcome;  // z% 超额暴击收益
  modifierHint?: string;           // 玩家如何干预概率的提示
  rolledTier?: GambleOutcomeTier;
  rolledText?: string;
}

export type PostMatchRewardCategory =
  | 'player'
  | 'stat_boost'
  | 'line_boost'
  | 'craft_card'
  | 'event'
  | 'trait_forge'
  | 'tactical_pact'
  | 'chemistry_forge'
  | 'gamble'
  | 'season_perk';

export interface PostMatchRewardOption {
  id: string;
  category: PostMatchRewardCategory;
  title: string;
  subtitle: string;
  rarity: 'common' | 'rare' | 'epic';
  player?: DraftPlayer;
  perk?: TacticalPerk;
  statBoost?: { attr: keyof PlayerAttributes; attrLabel: string; delta: number };
  lineBoost?: { line: 'GK' | 'DEF' | 'MID' | 'ATT'; lineLabel: string; attr: keyof PlayerAttributes; attrLabel: string; delta: number };
  craftReward?: { kind: 'new_card' | 'upgrade_card' | 'elements'; card?: CommandCard; elements?: Array<{ id: ElementId; name: string; count: number }> };
  eventReward?: {
    kind:
      | 'heal_all'
      | 'reveal_hidden'
      | 'devil_training'
      | 'scout_meta'
      | 'team_familiarity'
      | 'pair_chemistry'
      | 'captain_mentor'
      | 'meta_grant'
      | 'prep_actions'
      | 'scout_intel';
    description: string;
    amount?: number;
  };
  traitForge?: { kind: 'grant_silver' | 'upgrade_gold' | 'unlock_role'; trait?: string; durationRounds?: number; description: string };
  pactReward?: { kind: 'blitz_overdrive' | 'iron_fortress' | 'youth_gamble' | 'veteran_last_dance' | 'black_market_alchemy' | 'stamina_limit_break'; description: string };
  chemReward?: { kind: 'golden_link' | 'formation_master' | 'spine_boost' | 'card_overclock'; description: string };
  gamble?: TriStateGambleSpec;
}

export interface PostMatchRewardState {
  round: number;
  won: boolean;
  cadence?: PostMatchRoundCadence;
  rerollsLeft?: number;
  categories: PostMatchRewardCategory[];
  chosenCategory: PostMatchRewardCategory | null;
  options: PostMatchRewardOption[];
  pendingStatOptionId?: string | null;
  completed: boolean;
  summaryText?: string;
}
