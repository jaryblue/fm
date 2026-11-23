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

export type ActiveSkillSituation =
  | 'opponent_through_ball'
  | 'attacking_final_third'
  | 'counter_opportunity'
  | 'box_danger'
  | 'wing_overload'
  | 'midfield_press'
  | 'trailing_late'
  | 'any_possession';

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
}

export interface ActiveSkillPrompt {
  skillId: string;
  name: string;
  situationLabel: string;
  powerLabel: string;
  expiresTick: number;
  isCardBoosted: boolean;
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
  teamFamiliarityAvg?: number;
  teamChemistryAvg?: number;
  gridSlots?: Record<number, { col: number; row: number }>;
  slotDuties?: Record<number, PlayerDuty>;
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
  | 'yellow_card'
  | 'red_card'
  | 'corner'
  | 'offside'
  | 'substitution'
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
}

export interface ActiveCommandBuff {
  team: TeamSide;
  name: string;
  endMinute: number;
  effect: CommandCardEffect;
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
  activeSkillPrompt?: ActiveSkillPrompt | null;
  skillUses?: Record<string, number>;
  skillCooldowns?: Record<string, number>;
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
    tempo: 1.0,
    pressDistance: 13,
    pressIntensity: 1.0,
    shootBias: 1.0,
  },
  tiki_taka: {
    name: '传控渗透',
    lineHeight: 4,
    widthScale: 0.90,
    directness: 0.28,
    tempo: 1.15,
    pressDistance: 15,
    pressIntensity: 1.15,
    shootBias: 1.12,
  },
  gegenpress: {
    name: '高位逼抢',
    lineHeight: 8,
    widthScale: 1.02,
    directness: 0.60,
    tempo: 1.22,
    pressDistance: 20,
    pressIntensity: 1.38,
    shootBias: 1.08,
  },
  counter: {
    name: '快速反击',
    lineHeight: -6,
    widthScale: 0.96,
    directness: 0.82,
    tempo: 1.08,
    pressDistance: 10,
    pressIntensity: 0.82,
    shootBias: 1.14,
  },
  wing_play: {
    name: '两翼齐飞',
    lineHeight: 4,
    widthScale: 1.07,
    directness: 0.62,
    tempo: 1.10,
    pressDistance: 14,
    pressIntensity: 1.05,
    shootBias: 1.22,
  },
  park_bus: {
    name: '铁桶防反',
    lineHeight: -7,
    widthScale: 0.90,
    directness: 0.62,
    tempo: 0.88,
    pressDistance: 10,
    pressIntensity: 0.82,
    shootBias: 0.80,
  },
};
