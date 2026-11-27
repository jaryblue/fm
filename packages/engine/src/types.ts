/**
 * @fm-league/engine - 核心类型与球场常量定义
 * 零平台依赖，适用于 Node / 浏览器 / Steam / 微信小游戏
 */

export const PITCH = {
  LENGTH: 105,
  WIDTH: 68,
  HALF_X: 52.5,
  HALF_Y: 34,
  GOAL_Y: 34,
  GOAL_HALF_WIDTH: 3.66,
  PENALTY_BOX_DEPTH: 16.5,
  PENALTY_BOX_HALF_W: 20.16,
  SIX_YARD_DEPTH: 5.5,
  PENALTY_SPOT: 11,
} as const;

export const SIM_CONFIG = {
  TICK_DT: 0.1,          // 每 tick 物理时间 0.1 秒 (10Hz)
  TICKS_PER_MINUTE: 30,  // 30 ticks = 1 比赛分钟 (90分钟 = 2700 ticks)
  DECISION_INTERVAL: 3,  // 持球决策节拍：每 3 ticks (0.3s) 评估一次核心动作
} as const;

export type TeamSide = 'home' | 'away';
export type AttackDir = 1 | -1; // 1 = 向右攻 (x -> 105), -1 = 向左攻 (x -> 0)

export type PlayerRole =
  | 'GK'
  | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM'
  | 'LW' | 'RW' | 'ST';

export type DefenseSystem = '4-back' | '3-back' | '5-back';

export type FormationName =
  | '4-3-3' | '4-2-3-1' | '4-4-2' | '4-1-2-1-2' | '4-4-1-1' | '4-1-4-1' | '4-2-2-2' | '4-3-2-1'
  | '3-5-2' | '3-4-3' | '3-4-2-1' | '3-4-1-2'
  | '5-4-1' | '5-3-2' | '5-2-3' | '5-2-1-2';

export type TacticalStyle =
  | 'balanced'
  | 'tiki_taka'
  | 'gegenpress'
  | 'counter'
  | 'wing_play'
  | 'park_bus';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 extends Vec2 {
  z: number;
}

export interface PlayerAttributes {
  passing: number;     // 1-99 传球精准与视野
  shooting: number;    // 1-99 射门准度与力量
  dribbling: number;   // 1-99 盘带与护球
  pace: number;        // 1-99 速度与加速
  strength: number;    // 1-99 对抗与平衡
  defending: number;   // 1-99 抢断与拦截
  positioning: number; // 1-99 无球跑位与选位
  composure: number;   // 1-99 冷静度（门前/高压下发挥）
  stamina: number;     // 1-99 体能耐久
  goalkeeping: number; // 1-99 门将扑救与反应
}

export type PlayerDuty =
  | 'default'
  | 'false_nine'
  | 'target_man'
  | 'poacher'
  | 'inverted_fb'
  | 'wing_back'
  | 'regista'
  | 'box_to_box'
  | 'mezzala'
  | 'inside_forward'
  | 'classic_winger';

export interface PlayerInput {
  id: string;
  name: string;
  role: PlayerRole;
  secondaryRoles?: PlayerRole[]; // 兼任位置（多位置适应度）
  shirtNumber: number;
  attributes: PlayerAttributes;
  fitness?: number;  // 0-100
  strainWarning?: boolean;
  isCaptain?: boolean;
  traits?: string[]; // 实装词条（直接影响引擎判定）
  goldTraits?: string[]; // FC26 金标 PlayStyle+
  silverTraits?: string[]; // FC26 银标 PlayStyle
  hiddenTrait?: string; // 未显露的触发式隐藏词条
  formationFamiliarity?: number; // 0-100 当前阵型个人熟练度
  pa?: number;
  isStarred?: boolean;
}

export interface TacticalMods {
  overlapDepthBonus?: number; // 0..12 m 边卫/翼卫套上深度加成
  dualOverlap?: boolean;      // 允许双侧边卫同时前插
  falseNineDrop?: number;     // 0..12 m 伪九号回撤接应
  boxCrashBonus?: number;     // 0..2 额外禁区抢点中场人数
  lineShift?: number;         // -8..+8 m 整体防线前压/深收
  pressDistBonus?: number;    // 0..8 m 逼抢触发半径加成
  extraPresser?: boolean;     // 允许最多3人合围逼抢
  throughPassBias?: number;   // -0.1..+0.14 直塞球偏好
  longShotBias?: number;      // -0.1..+0.14 远射解放
  crossBias?: number;         // -0.1..+0.14 下底传中偏好
  shortPassBias?: number;     // -0.1..+0.14 短传渗透偏好
  gkQuickLaunch?: boolean;    // 门将快发长传反击
  staminaDrainMul?: number;   // 0.7..1.0 体能消耗倍率
}

export type SkillBranchChoice = 'A' | 'B';
export type SkillVfxTheme = 'att' | 'def' | 'ult';
export type SkillInstantAction =
  | 'clear_danger'
  | 'instant_counter_pass'
  | 'force_through_ball'
  | 'force_shot_on_target'
  | 'win_foul_setpiece'
  | 'GK_save_boost'
  | 'tempo_burst_intercept'
  | 'force_cross_header'
  | 'tactical_foul_stop'
  | 'gk_long_launch';

export type SkillMutationTag =
  | 'bypass_offside'
  | 'guarantee_shot_on_target'
  | 'double_duration'
  | 'refund_card_energy'
  | 'reduce_all_cd'
  | 'reset_all_cd'
  | 'grant_shield_stack'
  | 'steal_tempo'
  | 'counter_damage_amp'
  | 'force_yellow_card'
  | 'drain_opp_stamina'
  | 'heal_team'
  | 'extra_box_crash';

export type DirectiveZone = 'ATT' | 'MID' | 'DEF';
export type DirectiveTendency = 'ATK' | 'DEF';

export type EventHookTrigger =
  | 'onTackle'
  | 'onIntercept'
  | 'onBlock'
  | 'onSave'
  | 'onLongShotSaved'
  | 'onPassStreak'
  | 'onCross'
  | 'onShot'
  | 'onCorner'
  | 'onOffsideTrap'
  | 'onPossessionTick'
  | 'onDirectiveEnd'
  | 'onSubIn'
  | 'onConcede';

export type EventHookAction =
  | 'healTeam'
  | 'drainOppStamina'
  | 'oppComposureDebuff'
  | 'cutSkillCd'
  | 'addShield'
  | 'addCounter'
  | 'grantBypassOffside'
  | 'grantOnTarget'
  | 'stealTempo'
  | 'triggerMiniBuff'
  | 'extendDirective'
  | 'forceYellowCard'
  | 'forceCornerProb';

export interface EventHookRule {
  trigger: EventHookTrigger;
  action: EventHookAction;
  value?: number;
  streakTarget?: number;
  minPossession?: number;
  requireZeroConceded?: boolean;
  maxPerBuff?: number;
  miniBuffPreset?: 'pace_burst' | 'shot_burst' | 'counter_burst' | 'tempo_burst';
}

export interface ImmunityFlags {
  preventPenaltyOrRedOnce?: boolean;
  immuneHighPressTackle?: boolean;
  noCrossStylePenalty?: boolean;
}

export type LegendaryAspectId = string;

export interface ActiveLegendaryAspect {
  id: LegendaryAspectId;
  nodeId: string;
  name: string;
  shortDesc: string;
  system: '4-back' | '3-back' | '5-back';
  style: TacticalStyle;
  mechanicKey: string;
}

export interface PerkSkillSynergyFlags {
  attackTier: number;
  defenseTier: number;
  controlTier: number;
}

export interface TriggerSkillResult {
  triggered: boolean;
  skillId: string;
  skillName: string;
  vfxTheme: SkillVfxTheme;
  instantSummary: string;
  effectiveRank: number;
  isCardBoosted: boolean;
  mutationChoice?: SkillBranchChoice;
  mutationLabel?: string;
  instantAction?: SkillInstantAction;
  styleTag?: TacticalStyle;
}

export interface CoachMatchReward {
  energyRefund?: number;
  nextCardDiscount?: number;
  refreshUsedCard?: boolean;
  bannerText: string;
  tone: string;
}

export type ActiveSkillSituation =
  | 'opponent_through_ball'
  | 'attacking_final_third'
  | 'counter_opportunity'
  | 'box_danger'
  | 'wing_overload'
  | 'midfield_press'
  | 'trailing_late'
  | 'any_possession'
  | 'set_piece_moment'
  | 'leading_late'
  | 'just_conceded'
  | 'high_possession';

export interface EquippedActiveSkill {
  id: string;
  name: string;
  situation: ActiveSkillSituation;
  situationLabel: string;
  minFamiliarity: number;
  minChemistry: number;
  cooldownMinutes: number;
  maxPerMatch: number;
  durationMinutes: number;
  powerLabel: string;
  effect: CommandCardEffect;
  rank?: number;
  bonusRank?: number;
  effectiveRank?: number;
  mutationChoice?: SkillBranchChoice;
  mutationTag?: SkillMutationTag;
  secondaryMutationTag?: SkillMutationTag;
  mutationLabel?: string;
  instantAction?: SkillInstantAction;
  instantLabel?: string;
  vfxTheme?: SkillVfxTheme;
  linkedElement?: 'press' | 'pass' | 'wing' | 'iron' | 'blitz';
  styleTag?: TacticalStyle;
  firstTriggerFreeCd?: boolean;
  scoutOverclocked?: boolean;
}

export interface ActiveSkillPrompt {
  skillId: string;
  name: string;
  situationLabel: string;
  powerLabel: string;
  expiresTick: number;
  isCardBoosted: boolean;
  effectiveRank?: number;
  instantLabel?: string;
  mutationChoice?: SkillBranchChoice;
  mutationLabel?: string;
  vfxTheme?: SkillVfxTheme;
}

export interface TeamSetup {
  name: string;
  formation: FormationName;
  style: TacticalStyle;
  players: PlayerInput[]; // 11名首发（第0位为GK）
  subs?: PlayerInput[];   // 替补席名单
  tacticalMods?: TacticalMods;
  weather?: 'sunny' | 'rain' | 'wind' | 'heat';
  chemistryPairs?: Record<string, number>;
  centralSpineBonus?: number;
  equippedSkills?: EquippedActiveSkill[];
  activeAspects?: ActiveLegendaryAspect[];
  perkSynergies?: PerkSkillSynergyFlags;
  teamFamiliarityAvg?: number;
  teamChemistryAvg?: number;
  scoutCounterLabel?: string;
  gridSlots?: Record<number, { col: number; row: number }>;
  slotDuties?: Record<number, PlayerDuty>;
  prologueScripted?: boolean;
  deckArchetypeGene?: CardGene;
  // V6 原子总线常驻扩展
  v6PassiveHooks?: EventHookRule[];
  v6ImmunityFlags?: ImmunityFlags;
  v6TotalFootballMaster?: boolean;
  v6SkillTempRankBonus?: number;
  v6SkillDualBranch?: boolean;
  v6StartingShields?: number;
  v6MaxCounterStacks?: number;
}

export interface PlayerState {
  id: string;
  name: string;
  team: TeamSide;
  role: PlayerRole;
  duty?: PlayerDuty;
  slotIndex: number;
  shirtNumber: number;
  pos: Vec2;
  vel: Vec2;
  targetPos: Vec2;
  customOffset?: Vec2;   // 比赛界面微调站位（相对进攻方向的偏移米数）
  attributes: PlayerAttributes;
  traits: string[];
  goldTraits?: string[];
  silverTraits?: string[];
  hiddenTrait?: string;
  secondaryRoles?: PlayerRole[];
  pa?: number;
  isStarred?: boolean;
  subbedIn?: boolean;
  fitness: number;       // 0-100
  strainWarning?: boolean;
  isCaptain?: boolean;
  hasBall: boolean;
  yellowCards: number;
  redCard: boolean;
  decisionCooldown: number;
  stunTicks: number;     // 被过掉/铲倒后的短暂硬直
  matchStats: {
    goals: number;
    assists: number;
    shots: number;
    passes: number;
    passesSuccess: number;
    tackles: number;
    interceptions: number;
    saves: number;
    distanceM: number;
  };
}

export type BallMode = 'held' | 'pass' | 'shot' | 'loose' | 'dead';

export interface BallState {
  pos: Vec3;
  vel: Vec3;
  mode: BallMode;
  holderId: string | null;
  lastTouchTeam: TeamSide | null;
  lastPasserId: string | null;
  targetPlayerId: string | null;
  passType: 'short' | 'through' | 'cross' | 'long' | null;
  shotShooterId: string | null;
  shotXG: number;
  shotOnTarget: boolean;
  shotTargetY: number;
  shotTargetZ: number;
  deadTimer: number;
  restartTeam: TeamSide;
  restartType: 'kickoff' | 'throw' | 'goalkick' | 'corner' | 'freekick' | 'penalty';
  restartPos: Vec2;
}

export type MatchEventType =
  | 'kickoff'
  | 'pass'
  | 'shot'
  | 'goal'
  | 'save'
  | 'miss'
  | 'tackle'
  | 'interception'
  | 'foul'
  | 'injury'
  | 'yellow_card'
  | 'red_card'
  | 'corner'
  | 'offside'
  | 'substitution'
  | 'tactic'
  | 'commentary'
  | 'halftime'
  | 'fulltime';

export interface MatchEvent {
  id: string;
  tick: number;
  minute: number;
  type: MatchEventType;
  team: TeamSide;
  playerId: string;
  playerName: string;
  targetId?: string;
  targetName?: string;
  pos: Vec2;
  xG?: number;
  text: string;
  level?: 'critical' | 'important' | 'normal' | 'minor' | 'phase';
  narrativeTag?: 'BRACE' | 'HATTRICK' | 'LATE_WINNER' | 'MOMENTUM' | 'LULL';
}

export interface TacticalCallout {
  id: string;
  tick: number;
  playerId: string;
  team: TeamSide;
  label: string;
  kind: 'trait' | 'chemistry' | 'scout' | 'tactic';
  pos: Vec2;
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  xG: number;
  passes: number;
  passesSuccess: number;
  passAccuracy: number;
  possessionTicks: number;
  possessionPct: number;
  tackles: number;
  interceptions: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  corners: number;
  offsides: number;
  saves: number;
  distanceKm: number;
  attackShotPatterns?: Record<string, number>;
  attackGoalPatterns?: Record<string, number>;
}

export type CardTargetLine = 'GK' | 'DEF' | 'MID' | 'ATT' | 'ALL';

export interface CommandCardChain {
  type: 'energy_refund' | 'spread_all' | 'synergy_boost' | 'fitness_leech';
  label: string;
}

export type CardMechanic =
  | 'offside_trap'
  | 'set_piece_nuke'
  | 'super_sub'
  | 'high_press_blitz'
  | 'tiki_taka_flow'
  | 'gk_counter_launch'
  | 'wing_overload'
  | 'long_shot_cannon'
  | 'iron_wall_block'
  | 'blood_frenzy';

export type TeamStance = TacticalStyle;
export type CardGene = 'press' | 'pass' | 'wing' | 'iron' | 'blitz';
export type CardAffixKind = 'positive' | 'negative' | 'easter_egg';

export interface CardAffix {
  id: string;
  name: string;
  kind: CardAffixKind;
  desc: string;
  costDelta?: number;
  usesBonus?: number;
  innateOpeningHand?: boolean;
  anyStanceCombo?: boolean;
  energyRefundBonus?: number;
  foulRateMul?: number;
  endFitnessPenalty?: number;
  lineShiftDelta?: number;
  defPacePenalty?: number;
  chemistryPenalty?: number;
  allPacePenalty?: number;
  oppThroughPassBonus?: number;
  passHealEvery6?: number;
  fergieTime?: boolean;
  mouBusLeading?: boolean;
  clutchSetPiece85?: boolean;
}

export interface CardTacticalMod extends TacticalMods {
  shootBias?: number;
  tempoMul?: number;
  widthScaleDelta?: number;
  blockBonus?: number;
  setPieceXgMul?: number;
  foulRateMul?: number;
  cornerRateMul?: number;
  freeKickRateMul?: number;
  oppShotXgPenalty?: number;
  // V6 原子修饰器扩展
  interceptRangeBonus?: number;
  interceptProbBonus?: number;
  oppThroughPassBonus?: number;
  oppLongShotBonus?: number;
  offsideTrapBonus?: number;
  oppStaminaDrainPerMin?: number;
  skillDualBranch?: boolean;
  skillTempRankBonus?: number;
}

export interface CardChemistryMod {
  scope: 'spine' | 'wings' | 'all';
  delta: number;
  setTo100?: boolean;
}

export interface CardOppDebuff {
  oppFitnessDelta?: number;
  oppComposureDelta?: number;
  oppPassPenalty?: number;
}

export interface CardComboRule {
  requiresStance?: TeamStance;
  anyStance?: boolean;
  energyRefund?: number;
  durationBonus?: number;
  extraShooting?: number;
  extraPace?: number;
  extraDefending?: number;
  extraGoalkeeping?: number;
  extraChemistry?: number;
  extraBoxCrash?: number;
  extraXgBonus?: number;
  fitnessLeech?: number;
  fitnessGain?: number;
  extraCornerMul?: number;
  label: string;
}

export type CardTimingCondition =
  | 'trailing'
  | 'leading'
  | 'drawing'
  | 'late_70_not_leading'
  | 'late_70_leading'
  | 'late_75_leading'
  | 'late_75_drawing'
  | 'late_80_not_leading'
  | 'late_65_lead_1'
  | 'early_20'
  | 'after_60'
  | 'halftime_45_55'
  | 'recent_conceded'
  | 'recent_save'
  | 'sub_used'
  | 'sub_used_2'
  | 'red_card'
  | 'low_possession'
  | 'vs_5back'
  | 'bad_weather'
  | 'switched_stance_2';

export interface CardSkillSynergy {
  targetSkillTags: string[];
  promptBonusRate?: number;
  freeCooldownOnce?: boolean;
  rankBoost?: number;
}

export interface CommandCardEffect {
  id: string;
  name: string;
  durationMinutes: number;
  targetLine?: CardTargetLine;
  passingDelta?: number;
  shootingDelta?: number;
  defendingDelta?: number;
  paceDelta?: number;
  composureDelta?: number;
  goalkeepingDelta?: number;
  fitnessInstantDelta?: number;
  penaltyFitnessDelta?: number;
  penaltyAllDefDelta?: number;
  chainEffect?: CommandCardChain;
  mechanic?: CardMechanic;
  forceStyle?: TacticalStyle;
  element?: CardGene;
  // V5 扩展字段
  stance?: TeamStance;
  tacticalMod?: CardTacticalMod;
  chemistryMod?: CardChemistryMod;
  oppDebuff?: CardOppDebuff;
  comboRule?: CardComboRule;
  timingCondition?: CardTimingCondition;
  timingDiscount?: number;
  skillSynergy?: CardSkillSynergy;
  affix?: CardAffix;
  endFitnessPenalty?: number;
  starPlayerTarget?: 'top_shooter' | 'top_passer' | 'fastest_winger' | 'fastest_striker';
  // V6 三区双刃剑指令与原子总线扩展
  zone?: DirectiveZone;
  tendency?: DirectiveTendency;
  tpCost?: number;
  benefitSummary?: string;
  riskSummary?: string;
  immunityFlags?: ImmunityFlags;
  eventHooks?: EventHookRule[];
}

export interface ActiveCommandBuff {
  team: TeamSide;
  name: string;
  endMinute: number;
  effect: CommandCardEffect;
  comboActivated?: boolean;
  endPenaltyApplied?: boolean;
  startConceded?: number;
  hookUseCount?: Record<string, number>;
  startStats?: {
    shots: number;
    xG: number;
    goals: number;
    tackles: number;
    passesSuccess: number;
  };
}

export interface MatchState {
  tick: number;
  minute: number;
  phase: 'first_half' | 'half_time' | 'second_half' | 'full_time';
  weather?: 'sunny' | 'rain' | 'wind' | 'heat';
  homeName: string;
  awayName: string;
  homeFormation: FormationName;
  awayFormation: FormationName;
  homeStyle: TacticalStyle;
  awayStyle: TacticalStyle;
  homeAttackDir: AttackDir; // 上半场 1, 下半场 -1
  homeScore: number;
  awayScore: number;
  players: PlayerState[];
  homeSubs: PlayerInput[];
  awaySubs: PlayerInput[];
  homeSubsUsed: number;
  awaySubsUsed: number;
  ball: BallState;
  events: MatchEvent[];
  unlockedHiddenTraits: Array<{ playerId: string; playerName: string; team: TeamSide; trait: string }>;
  activeBuffs: ActiveCommandBuff[];
  stats: {
    home: TeamMatchStats;
    away: TeamMatchStats;
  };
  pairPasses?: Record<string, number>;
  pairAssists?: Record<string, number>;
  tacticalStats?: {
    traitTriggers: number;
    chemPasses: number;
    scoutCounters: number;
  };
  skillResolution?: {
    skillName: string;
    outcomeText: string;
    isPositive: boolean;
    expiresTick: number;
  } | null;
  activeSkillPrompt?: ActiveSkillPrompt | null;
  skillUses?: Record<string, number>;
  skillCooldowns?: Record<string, number>;
  activeAspects?: ActiveLegendaryAspect[];
  aspectStacks?: {
    shieldCharges: number;
    counterCharges: number;
    passSeq: number;
  };
  // V5 局内态势与时机窗追踪
  teamStance?: { home?: TeamStance; away?: TeamStance };
  stanceSwitchCount?: { home: number; away: number };
  lastConcededMin?: { home: number; away: number };
  lastSaveMin?: { home: number; away: number };
  deckArchetypeGene?: { home?: CardGene; away?: CardGene };
  pendingClutchSetPiece?: { home: boolean; away: boolean };
  // V6 三区轨迹与全攻全守 Zone
  usedDirectiveZones?: { home: DirectiveZone[]; away: DirectiveZone[] };
  totalFootballZoneTriggered?: { home: boolean; away: boolean };
}

export interface TacticalStyleConfig {
  name: string;
  lineHeight: number;     // -8 ~ +8 m
  widthScale: number;     // 0.85 ~ 1.15
  directness: number;     // 0.2 ~ 0.9 (长传/向前倾向)
  tempo: number;          // 0.7 ~ 1.2 (决策频率修正)
  pressDistance: number;  // 8 ~ 22 m (触发积极上抢的距离)
  pressIntensity: number; // 0.5 ~ 1.4
  shootBias: number;      // 0.8 ~ 1.2
}

export const TACTICAL_PRESETS: Record<TacticalStyle, TacticalStyleConfig> = {
  balanced: {
    name: '均衡阵地',
    lineHeight: 0,
    widthScale: 1.0,
    directness: 0.50,
    tempo: 0.94,
    pressDistance: 12,
    pressIntensity: 0.93,
    shootBias: 0.92,
  },
  tiki_taka: {
    name: '传控渗透',
    lineHeight: 4,
    widthScale: 0.90,
    directness: 0.46,
    tempo: 1.15,
    pressDistance: 15,
    pressIntensity: 1.15,
    shootBias: 1.12,
  },
  gegenpress: {
    name: '高位逼抢',
    lineHeight: 6,
    widthScale: 1.02,
    directness: 0.60,
    tempo: 1.22,
    pressDistance: 19,
    pressIntensity: 1.32,
    shootBias: 1.12,
  },
  counter: {
    name: '快速反击',
    lineHeight: -6,
    widthScale: 0.96,
    directness: 0.82,
    tempo: 1.10,
    pressDistance: 11,
    pressIntensity: 0.95,
    shootBias: 1.16,
  },
  wing_play: {
    name: '两翼齐飞',
    lineHeight: 4,
    widthScale: 1.07,
    directness: 0.57,
    tempo: 1.04,
    pressDistance: 14,
    pressIntensity: 1.04,
    shootBias: 1.02,
  },
  park_bus: {
    name: '铁桶防反',
    lineHeight: -6,
    widthScale: 0.90,
    directness: 0.78,
    tempo: 1.04,
    pressDistance: 11,
    pressIntensity: 0.95,
    shootBias: 1.08,
  },
};
