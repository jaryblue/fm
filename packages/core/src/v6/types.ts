import type {
  ActiveSkillSituation,
  CommandCardEffect,
  DefenseSystem,
  DirectiveTendency,
  DirectiveZone,
  EventHookRule,
  FormationName,
  ImmunityFlags,
  SkillBranchChoice,
  SkillInstantAction,
  SkillMutationTag,
  SkillVfxTheme,
  TacticalMods,
  TacticalStyle,
} from '@fm-league/engine';

export type V6SatelliteKey = 'A' | 'B' | 'C';

/** 四赛段自由拍板区间：0-20' / 21-45' / 46-70' / 71-90'+ */
export type V6CheckpointKey = 's1' | 's2' | 's3' | 's4';

export type V6DirectiveEnchantId =
  | 'fergie_time'
  | 'zero_risk'
  | 'minus_cost'
  | 'long_duration'
  | 'lead_fortress'
  | 'trail_frenzy'
  | 'cd_charge';

export type V6RelicId =
  | 'board_expand'
  | 'rich_budget'
  | 'hairdryer'
  | 'comeback_gene'
  | 'deadball_mage'
  | 'san_siro_gloves'
  | 'super_bench'
  | 'clutch_clock';

export interface V6SeasonRogueState {
  /** 单赛季手牌暗金词条附魔 */
  directiveEnchants: Record<string, V6DirectiveEnchantId>;
  /** 单赛季战术圣物（最多 5 件） */
  seasonRelics: V6RelicId[];
  /** 单赛季卫星超频（本季临时满激活 A+B+C） */
  overclockedDirectives: string[];
  /** 单赛季主动技过载（本季临时双质变 + 减冷却） */
  overloadedSkills: string[];
  /** 单赛季跨界融合奇点借用 */
  borrowedFusion?: { id: string; branch: 'A' | 'B' } | null;
}

export interface V6CompiledDirectiveEntry {
  def: V6DirectiveDef;
  effect: CommandCardEffect;
  satellites: V6SatelliteKey[];
  effectiveTpCost: number;
  enchant?: V6DirectiveEnchantId;
  isOverclocked?: boolean;
  isGreenSynergy?: boolean;
}

export interface V6SatelliteDef {
  key: V6SatelliteKey;
  label: string;
  desc: string;
  cost: number; // A/B = 1, C = 2
  /** 覆盖/移除副作用或叠加正面效果 */
  removeRisk?: boolean;
  halveRisk?: boolean;
  extraEffect?: Partial<CommandCardEffect>;
  extraHooks?: EventHookRule[];
  extraImmunity?: ImmunityFlags;
}

export interface V6DirectiveDef {
  id: string;
  name: string;
  source: 'style' | 'formation' | 'fusion';
  style?: TacticalStyle;
  formation?: FormationName;
  defenseSystem?: DefenseSystem;
  zone: DirectiveZone;
  tendency: DirectiveTendency;
  route: 'steady' | 'gamble' | 'formation' | 'fusion';
  tpCost: 1 | 2 | 3;
  unlockCost: number;
  durationMinutes: number;
  benefitSummary: string;
  riskSummary: string;
  baseEffect: Omit<CommandCardEffect, 'id' | 'name' | 'durationMinutes'>;
  satellites: Record<V6SatelliteKey, V6SatelliteDef>;
}

export interface V6SkillBranchDef {
  choice: SkillBranchChoice;
  label: string;
  desc: string;
  tag: SkillMutationTag;
  extraEffect?: Partial<CommandCardEffect>;
  extraHooks?: EventHookRule[];
}

export interface V6ActiveSkillDef {
  id: string;
  name: string;
  source: 'style' | 'formation' | 'mastery' | 'core';
  style?: TacticalStyle;
  formation?: FormationName;
  zone?: DirectiveZone;
  tendency?: DirectiveTendency;
  situation: ActiveSkillSituation;
  situationLabel: string;
  instantAction: SkillInstantAction;
  instantLabel: string;
  vfxTheme: SkillVfxTheme;
  cooldownMinutes: number;
  maxPerMatch: number;
  durationMinutes: number;
  unlockCost: number;
  powerLabel: string;
  baseEffect: Omit<CommandCardEffect, 'id' | 'name' | 'durationMinutes'>;
  branchA: V6SkillBranchDef;
  branchB: V6SkillBranchDef;
}

export interface V6PassiveDef {
  id: string;
  name: string;
  source: 'style' | 'system' | 'formation';
  style?: TacticalStyle;
  system?: DefenseSystem;
  formation?: FormationName;
  tendency: DirectiveTendency;
  tier: 'origin' | 'minor' | 'rare';
  unlockCost: number;
  desc: string;
  tacticalMod?: Partial<TacticalMods>;
  statDelta?: {
    targetLine?: CommandCardEffect['targetLine'];
    passing?: number;
    shooting?: number;
    defending?: number;
    pace?: number;
    composure?: number;
    goalkeeping?: number;
  };
  directiveDurationBonus?: number;
  directiveZoneBonus?: DirectiveZone;
  hooks?: EventHookRule[];
  immunityFlags?: ImmunityFlags;
  startingShields?: number;
  maxCounterStacks?: number;
  cornerRateMul?: number;
  freeKickRateMul?: number;
  oppShotXgPenalty?: number;
  blockBonus?: number;
}

export interface V6FusionBranchDef {
  choice: 'A' | 'B';
  label: string;
  desc: string;
  tacticalMod?: Partial<TacticalMods>;
  hooks?: EventHookRule[];
  immunityFlags?: ImmunityFlags;
  startingShields?: number;
  maxCounterStacks?: number;
  skillDualBranch?: boolean;
  skillTempRankBonus?: number;
  directiveDurationBonus?: number;
}

export interface V6FusionKeystoneDef {
  id: string;
  system: DefenseSystem;
  style: TacticalStyle;
  name: string;
  unlockCost: number;
  royalDirectiveId: string;
  branchA: V6FusionBranchDef;
  branchB: V6FusionBranchDef;
}

export interface V6MasterySealDef {
  id: string;
  style: TacticalStyle;
  name: string;
  unlockCost: number;
  activeSkillId: string;
  desc: string;
  directiveDurationBonus?: number;
  staminaDiscount?: number;
  cornerMulBonus?: number;
  startingShields?: number;
  extraEmergencyCall?: boolean;
  hooks?: EventHookRule[];
}

export interface V6AstrolabeState {
  /** 外环 6 大打法旋转步数 (0..5，步长 60°) */
  outerRingStep: number;
  /** 内环 3 大防线体系旋转步数 (0..2，步长 120°) */
  innerRingStep: number;
  /** 定盘锁：true 时不可旋转，洗点重置后解锁 */
  locked: boolean;
  /** 已点亮被动 ID */
  unlockedPassives: string[];
  /** 已点亮三区手牌 ID */
  unlockedDirectives: string[];
  /** 每张手牌已点亮的卫星改造 ['A','B','C'] */
  directiveSatellites: Record<string, V6SatelliteKey[]>;
  /** 已点亮主动技 ID */
  unlockedSkills: string[];
  /** 每个主动技已解锁/激活的分支选择 */
  skillBranchChoice: Record<string, SkillBranchChoice>;
  /** 已点亮融合奇点 ID */
  unlockedFusions: string[];
  /** 融合奇点分支选择 */
  fusionBranchChoice: Record<string, 'A' | 'B'>;
  /** 已点亮流派宗师印 ID */
  unlockedMasterySeals: string[];
  /** 圆心超级宗师是否已点亮 */
  coreUnlocked: boolean;
  /** 赛前临场指令池：0-20' / 21-45' / 46-70' / 71-90'+ 四段各最多 4 张 */
  checkpointPools: Record<V6CheckpointKey, string[]>;
  /** 一键复用 4 张通用池（开启时 s2/s3/s4 自动沿用 s1） */
  useUniversalPool: boolean;
  /** 已装备的主动技 ID（最多 4 个） */
  equippedSkills: string[];
  /** T7 新手迷雾是否已手动/升段全解开 */
  fogCleared: boolean;
  /** 本赛季是否还有 1 次休赛期免费全额洗点 */
  freeRespecAvailable: boolean;
}
