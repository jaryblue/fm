/**
 * @fm-league/engine - 核心类型与球场常量定义
 * 零平台依赖，适用于 Node / 浏览器 / Steam / 微信小游戏
 */
export declare const PITCH: {
    readonly LENGTH: 105;
    readonly WIDTH: 68;
    readonly HALF_X: 52.5;
    readonly HALF_Y: 34;
    readonly GOAL_Y: 34;
    readonly GOAL_HALF_WIDTH: 3.66;
    readonly PENALTY_BOX_DEPTH: 16.5;
    readonly PENALTY_BOX_HALF_W: 20.16;
    readonly SIX_YARD_DEPTH: 5.5;
    readonly PENALTY_SPOT: 11;
};
export declare const SIM_CONFIG: {
    readonly TICK_DT: 0.1;
    readonly TICKS_PER_MINUTE: 30;
    readonly DECISION_INTERVAL: 3;
};
export type TeamSide = 'home' | 'away';
export type AttackDir = 1 | -1;
export type PlayerRole = 'GK' | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';
export type DefenseSystem = '4-back' | '3-back' | '5-back';
export type FormationName = '4-3-3' | '4-2-3-1' | '4-4-2' | '4-1-2-1-2' | '4-4-1-1' | '4-1-4-1' | '4-2-2-2' | '4-3-2-1' | '3-5-2' | '3-4-3' | '3-4-2-1' | '3-4-1-2' | '5-4-1' | '5-3-2' | '5-2-3' | '5-2-1-2';
export type TacticalStyle = 'balanced' | 'tiki_taka' | 'gegenpress' | 'counter' | 'wing_play' | 'park_bus';
export interface Vec2 {
    x: number;
    y: number;
}
export interface Vec3 extends Vec2 {
    z: number;
}
export interface PlayerAttributes {
    passing: number;
    shooting: number;
    dribbling: number;
    pace: number;
    strength: number;
    defending: number;
    positioning: number;
    composure: number;
    stamina: number;
    goalkeeping: number;
}
export type PlayerDuty = 'default' | 'false_nine' | 'target_man' | 'poacher' | 'inverted_fb' | 'wing_back' | 'regista' | 'box_to_box' | 'mezzala' | 'inside_forward' | 'classic_winger';
export interface PlayerInput {
    id: string;
    name: string;
    role: PlayerRole;
    secondaryRoles?: PlayerRole[];
    shirtNumber: number;
    attributes: PlayerAttributes;
    fitness?: number;
    strainWarning?: boolean;
    isCaptain?: boolean;
    traits?: string[];
    goldTraits?: string[];
    silverTraits?: string[];
    hiddenTrait?: string;
    formationFamiliarity?: number;
}
export interface TacticalMods {
    overlapDepthBonus?: number;
    dualOverlap?: boolean;
    falseNineDrop?: number;
    boxCrashBonus?: number;
    lineShift?: number;
    pressDistBonus?: number;
    extraPresser?: boolean;
    throughPassBias?: number;
    longShotBias?: number;
    crossBias?: number;
    shortPassBias?: number;
    gkQuickLaunch?: boolean;
    staminaDrainMul?: number;
}
export type SkillBranchChoice = 'A' | 'B';
export type SkillVfxTheme = 'att' | 'def' | 'ult';
export type SkillInstantAction = 'clear_danger' | 'instant_counter_pass' | 'force_through_ball' | 'force_shot_on_target' | 'win_foul_setpiece' | 'GK_save_boost' | 'tempo_burst_intercept';
export type SkillMutationTag = 'bypass_offside' | 'guarantee_shot_on_target' | 'double_duration' | 'refund_card_energy' | 'reduce_all_cd' | 'grant_shield_stack' | 'steal_tempo' | 'counter_damage_amp';
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
}
export interface CoachMatchReward {
    energyRefund?: number;
    nextCardDiscount?: number;
    refreshUsedCard?: boolean;
    bannerText: string;
    tone: string;
}
export type ActiveSkillSituation = 'opponent_through_ball' | 'attacking_final_third' | 'counter_opportunity' | 'box_danger' | 'wing_overload' | 'midfield_press' | 'trailing_late' | 'any_possession';
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
    mutationLabel?: string;
    instantAction?: SkillInstantAction;
    instantLabel?: string;
    vfxTheme?: SkillVfxTheme;
    linkedElement?: 'press' | 'pass' | 'wing' | 'iron' | 'blitz';
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
    players: PlayerInput[];
    subs?: PlayerInput[];
    tacticalMods?: TacticalMods;
    weather?: 'sunny' | 'rain' | 'wind' | 'heat';
    chemistryPairs?: Record<string, number>;
    centralSpineBonus?: number;
    equippedSkills?: EquippedActiveSkill[];
    activeAspects?: ActiveLegendaryAspect[];
    perkSynergies?: PerkSkillSynergyFlags;
    teamFamiliarityAvg?: number;
    teamChemistryAvg?: number;
    gridSlots?: Record<number, {
        col: number;
        row: number;
    }>;
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
    customOffset?: Vec2;
    attributes: PlayerAttributes;
    traits: string[];
    goldTraits?: string[];
    silverTraits?: string[];
    hiddenTrait?: string;
    subbedIn?: boolean;
    fitness: number;
    strainWarning?: boolean;
    isCaptain?: boolean;
    hasBall: boolean;
    yellowCards: number;
    redCard: boolean;
    decisionCooldown: number;
    stunTicks: number;
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
export type MatchEventType = 'kickoff' | 'pass' | 'shot' | 'goal' | 'save' | 'miss' | 'tackle' | 'interception' | 'foul' | 'yellow_card' | 'red_card' | 'corner' | 'offside' | 'substitution' | 'commentary' | 'halftime' | 'fulltime';
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
export type CardMechanic = 'offside_trap' | 'set_piece_nuke' | 'super_sub' | 'high_press_blitz' | 'tiki_taka_flow' | 'gk_counter_launch' | 'wing_overload' | 'long_shot_cannon' | 'iron_wall_block' | 'blood_frenzy';
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
    element?: 'press' | 'pass' | 'wing' | 'iron' | 'blitz';
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
    homeAttackDir: AttackDir;
    homeScore: number;
    awayScore: number;
    players: PlayerState[];
    homeSubs: PlayerInput[];
    awaySubs: PlayerInput[];
    homeSubsUsed: number;
    awaySubsUsed: number;
    ball: BallState;
    events: MatchEvent[];
    unlockedHiddenTraits: Array<{
        playerId: string;
        playerName: string;
        team: TeamSide;
        trait: string;
    }>;
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
    activeAspects?: ActiveLegendaryAspect[];
    aspectStacks?: {
        shieldCharges: number;
        counterCharges: number;
        passSeq: number;
    };
}
export interface TacticalStyleConfig {
    name: string;
    lineHeight: number;
    widthScale: number;
    directness: number;
    tempo: number;
    pressDistance: number;
    pressIntensity: number;
    shootBias: number;
}
export declare const TACTICAL_PRESETS: Record<TacticalStyle, TacticalStyleConfig>;
