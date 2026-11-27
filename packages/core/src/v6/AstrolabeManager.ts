import {
  getDefenseSystem,
  type CommandCardEffect,
  type DefenseSystem,
  type EquippedActiveSkill,
  type EventHookRule,
  type FormationName,
  type ImmunityFlags,
  type TacticalMods,
  type TacticalStyle,
} from '@fm-league/engine';
import { V6_DIRECTIVES, V6_DIRECTIVE_MAP } from './directivesCatalog';
import { V6_ACTIVE_SKILLS, V6_ACTIVE_SKILL_MAP } from './skillsCatalog';
import {
  V6_ALL_PASSIVES,
  V6_FUSION_KEYSTONES,
  V6_FUSION_MAP,
  V6_MASTERY_SEALS,
  V6_MASTERY_SEAL_MAP,
  V6_PASSIVE_MAP,
} from './passivesAndFusionsCatalog';
import type {
  V6AstrolabeState,
  V6CheckpointKey,
  V6DirectiveDef,
  V6DirectiveEnchantId,
  V6FusionKeystoneDef,
  V6RelicId,
  V6SatelliteKey,
  V6SeasonRogueState,
} from './types';

export const V6_SEGMENTS: Array<{
  key: V6CheckpointKey;
  range: string;
  shortLabel: string;
  title: string;
  minStart: number;
  minEnd: number;
}> = [
  { key: 's1', range: "0'-20'", shortLabel: "0'-20'", title: '开局试探段', minStart: 0, minEnd: 20 },
  { key: 's2', range: "21'-45'", shortLabel: "21'-45'", title: '上半攻坚段', minStart: 21, minEnd: 45 },
  { key: 's3', range: "46'-70'", shortLabel: "46'-70'", title: '下半变招段', minStart: 46, minEnd: 70 },
  { key: 's4', range: "71'-90'+", shortLabel: "71'-90'+", title: '决胜总攻段', minStart: 71, minEnd: 99 },
];

export const V6_DIRECTIVE_ENCHANTS: Record<
  V6DirectiveEnchantId,
  { id: V6DirectiveEnchantId; name: string; rarity: 'purple' | 'gold' | 'mythic'; shortTag: string; desc: string }
> = {
  fergie_time: {
    id: 'fergie_time',
    name: '弗格森时间',
    rarity: 'mythic',
    shortTag: '决胜翻倍-1费',
    desc: '71\'+ 决胜总攻段拍出该牌时，正面属性加成翻倍且消耗 -1 TP',
  },
  zero_risk: {
    id: 'zero_risk',
    name: '零代价违禁品',
    rarity: 'mythic',
    shortTag: '副作用清零',
    desc: '本赛季彻底清除该手牌的双刃剑负面代价（体力与防线漏洞归零）',
  },
  minus_cost: {
    id: 'minus_cost',
    name: '零费奇兵',
    rarity: 'gold',
    shortTag: '永久-1TP',
    desc: '本赛季该手牌消耗永久 -1 TP（1 TP 稳健牌可直接 0 费白嫖拍出）',
  },
  long_duration: {
    id: 'long_duration',
    name: '跨半场长效',
    rarity: 'purple',
    shortTag: '持续+10分钟',
    desc: '本赛季该手牌生效时长额外延长 +10 分钟（由 20\' 延至 30\'）',
  },
  lead_fortress: {
    id: 'lead_fortress',
    name: '大巴死守令',
    rarity: 'purple',
    shortTag: '领先铁壁',
    desc: '附带门前封堵加成与禁区对手射门威胁压制（防线 +6 · 封堵 +12%）',
  },
  trail_frenzy: {
    id: 'trail_frenzy',
    name: '绝境血怒',
    rarity: 'purple',
    shortTag: '血怒强攻+8',
    desc: '拍出时额外赋予全队射门 +8 并同步激活【逆境血怒】增伤状态',
  },
  cd_charge: {
    id: 'cd_charge',
    name: '连携充能',
    rarity: 'purple',
    shortTag: '全技CD-4\'',
    desc: '该手牌生效期间每次射门或抢断立即缩减主动技冷却 2 分钟（最多2次）',
  },
};

export const V6_RELICS: Record<
  V6RelicId,
  { id: V6RelicId; name: string; rarity: 'purple' | 'gold' | 'mythic'; desc: string }
> = {
  board_expand: {
    id: 'board_expand',
    name: '战术板扩容',
    rarity: 'mythic',
    desc: '每个赛段可拍出的手牌上限由 2 张提升至 3 张，解锁三连拍爆发',
  },
  rich_budget: {
    id: 'rich_budget',
    name: '充裕指挥预算',
    rarity: 'gold',
    desc: '每赛段基础补给 TP +1（3→4 TP），且跨赛段结余上限提升至 3 TP',
  },
  hairdryer: {
    id: 'hairdryer',
    name: '弗格森吹风机',
    rarity: 'gold',
    desc: '进入下半场（46\'-70\' 段）时全队额外恢复体能，且下半场首张手牌 -1 TP',
  },
  comeback_gene: {
    id: 'comeback_gene',
    name: '逆转基因',
    rarity: 'mythic',
    desc: '每当本场丢球处于落后时，立即额外获得 +1 TP 且全部主动技冷却 -4\'',
  },
  deadball_mage: {
    id: 'deadball_mage',
    name: '死球魔术师',
    rarity: 'purple',
    desc: '本赛季所有角球与前场任意球创造率 ×1.30，定位球极具杀伤力',
  },
  san_siro_gloves: {
    id: 'san_siro_gloves',
    name: '圣西罗门神手套',
    rarity: 'gold',
    desc: '每场开局额外自带 +1 层【绝杀护盾】（可与星盘护盾叠加）',
  },
  super_bench: {
    id: 'super_bench',
    name: '超级替补席',
    rarity: 'purple',
    desc: '下半场每次换人立即获得 +1 TP，并触发全队 4 秒冲刺提速',
  },
  clutch_clock: {
    id: 'clutch_clock',
    name: '压哨绝杀时钟',
    rarity: 'mythic',
    desc: '进入 71\'+ 决胜段若未领先，自动免费激活【决胜强攻】（全队射门/速度+8）',
  },
};

export function createEmptySeasonRogueState(): V6SeasonRogueState {
  return {
    directiveEnchants: {},
    seasonRelics: [],
    overclockedDirectives: [],
    overloadedSkills: [],
    borrowedFusion: null,
  };
}

export const OUTER_RING_STYLES: TacticalStyle[] = [
  'tiki_taka',
  'gegenpress',
  'wing_play',
  'counter',
  'park_bus',
  'balanced',
];

export const INNER_RING_SYSTEMS: DefenseSystem[] = ['4-back', '3-back', '5-back'];

export const STYLE_LABELS: Record<TacticalStyle, { name: string; color: string; short: string }> = {
  tiki_taka: { name: '传控渗透', color: '#22D3EE', short: '传控' },
  gegenpress: { name: '高位逼抢', color: '#F43F5E', short: '高压' },
  wing_play: { name: '两翼齐飞', color: '#F59E0B', short: '两翼' },
  counter: { name: '快速反击', color: '#A855F7', short: '反击' },
  park_bus: { name: '铁桶防反', color: '#10B981', short: '铁桶' },
  balanced: { name: '均衡阵地', color: '#3B82F6', short: '均衡' },
};

export const SYSTEM_LABELS: Record<DefenseSystem, { name: string; color: string }> = {
  '4-back': { name: '四后卫体系', color: '#60A5FA' },
  '3-back': { name: '三后卫体系', color: '#FBBF24' },
  '5-back': { name: '五后卫体系', color: '#34D399' },
};

export const SYSTEM_FORMATIONS: Record<DefenseSystem, FormationName[]> = {
  '4-back': ['4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '4-4-1-1', '4-1-4-1', '4-2-2-2', '4-3-2-1'],
  '3-back': ['3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2'],
  '5-back': ['5-4-1', '5-3-2', '5-2-3', '5-2-1-2'],
};

export const STYLE_ORIGIN_PASSIVE: Record<TacticalStyle, string> = {
  tiki_taka: 'ps_tt_a1',
  gegenpress: 'ps_gp_a1',
  wing_play: 'ps_wp_a1',
  counter: 'ps_ct_a1',
  park_bus: 'ps_pb_d1',
  balanced: 'ps_bl_a1',
};

export const SYSTEM_ORIGIN_PASSIVE: Record<DefenseSystem, string> = {
  '4-back': 'sys_4_1',
  '3-back': 'sys_3_1',
  '5-back': 'sys_5_1',
};

const STYLE_CODE: Record<TacticalStyle, string> = {
  tiki_taka: 'tt',
  gegenpress: 'gp',
  wing_play: 'wp',
  counter: 'ct',
  park_bus: 'pb',
  balanced: 'bl',
};

export interface V6PrereqRef {
  kind: 'passive' | 'directive' | 'skill' | 'fusion';
  id: string;
  label: string;
}

function makeRef(kind: V6PrereqRef['kind'], id: string): V6PrereqRef {
  const label =
    kind === 'passive'
      ? V6_PASSIVE_MAP[id]?.name ?? id
      : kind === 'directive'
      ? V6_DIRECTIVE_MAP[id]?.name ?? id
      : kind === 'skill'
      ? V6_ACTIVE_SKILL_MAP[id]?.name ?? id
      : V6_FUSION_MAP[id]?.name ?? id;
  return { kind, id, label };
}

/** 返回任意 V6 星盘节点的显式前置连线（用于画布连线绘制与防跨级解锁校验） */
export function getV6NodePrerequisites(
  kind: 'passive' | 'directive' | 'skill' | 'fusion',
  id: string
): { mode: 'all' | 'any'; requiresLock?: boolean; prereqs: V6PrereqRef[] } {
  if (kind === 'passive') {
    const p = V6_PASSIVE_MAP[id];
    if (!p || p.tier === 'origin') return { mode: 'all', prereqs: [] };
    if (p.source === 'style' && p.style) {
      const code = STYLE_CODE[p.style];
      const originId = STYLE_ORIGIN_PASSIVE[p.style];
      const m = id.match(/^ps_[a-z]+_([ad])([1-4])$/);
      if (m) {
        const branch = m[1];
        const step = Number(m[2]);
        if (step === 1) {
          return { mode: 'all', prereqs: [makeRef('passive', originId)] };
        }
        return { mode: 'all', prereqs: [makeRef('passive', `ps_${code}_${branch}${step - 1}`)] };
      }
    }
    if (p.source === 'system' && p.system) {
      const m = id.match(/^sys_([345])_([1-4])$/);
      if (m) {
        const sysNum = m[1];
        const step = Number(m[2]);
        if (step > 1) {
          return { mode: 'all', prereqs: [makeRef('passive', `sys_${sysNum}_${step - 1}`)] };
        }
      }
    }
    if (p.source === 'formation' && p.formation) {
      const sys = getDefenseSystem(p.formation);
      return { mode: 'all', prereqs: [makeRef('passive', SYSTEM_ORIGIN_PASSIVE[sys])] };
    }
    return { mode: 'all', prereqs: [] };
  }

  if (kind === 'directive') {
    const d = V6_DIRECTIVE_MAP[id];
    if (!d) return { mode: 'all', prereqs: [] };
    if (d.source === 'style' && d.style) {
      const code = STYLE_CODE[d.style];
      if (d.route === 'gamble') {
        const steadyId = id.replace(/_2$/, '_1');
        if (V6_DIRECTIVE_MAP[steadyId]) {
          return { mode: 'all', prereqs: [makeRef('directive', steadyId)] };
        }
      }
      const branch = d.tendency === 'ATK' ? 'a' : 'd';
      const step = d.zone === 'ATT' ? 1 : d.zone === 'MID' ? 2 : 3;
      return { mode: 'all', prereqs: [makeRef('passive', `ps_${code}_${branch}${step}`)] };
    }
    if (d.source === 'formation' && d.formation) {
      const fmKey = d.formation.replace(/-/g, '');
      const pid = d.tendency === 'ATK' ? `pf_${fmKey}_a` : `pf_${fmKey}_d`;
      return { mode: 'all', prereqs: [makeRef('passive', pid)] };
    }
    if (d.source === 'fusion' && d.defenseSystem && d.style) {
      const fuse = V6_FUSION_KEYSTONES.find(f => f.system === d.defenseSystem && f.style === d.style);
      if (fuse) {
        return { mode: 'all', requiresLock: true, prereqs: [makeRef('fusion', fuse.id)] };
      }
    }
    return { mode: 'all', prereqs: [] };
  }

  if (kind === 'skill') {
    const sk = V6_ACTIVE_SKILL_MAP[id];
    if (!sk) return { mode: 'all', prereqs: [] };
    if (sk.source === 'style' && sk.style) {
      const code = STYLE_CODE[sk.style];
      const branch = sk.tendency === 'DEF' ? 'd' : 'a';
      const step = sk.zone === 'ATT' ? 2 : sk.zone === 'MID' ? 3 : 4;
      return { mode: 'all', prereqs: [makeRef('passive', `ps_${code}_${branch}${step}`)] };
    }
    if (sk.source === 'formation' && sk.formation) {
      const fmKey = sk.formation.replace(/-/g, '');
      return {
        mode: 'any',
        prereqs: [makeRef('passive', `pf_${fmKey}_a`), makeRef('passive', `pf_${fmKey}_d`)],
      };
    }
    return { mode: 'all', prereqs: [] };
  }

  if (kind === 'fusion') {
    const f = V6_FUSION_MAP[id];
    if (!f) return { mode: 'all', prereqs: [] };
    return {
      mode: 'all',
      requiresLock: true,
      prereqs: [
        makeRef('passive', STYLE_ORIGIN_PASSIVE[f.style]),
        makeRef('passive', SYSTEM_ORIGIN_PASSIVE[f.system]),
      ],
    };
  }

  return { mode: 'all', prereqs: [] };
}

/** 校验某节点是否满足前置连通条件（禁止跨级/断链解锁） */
export interface V6TierCaps {
  maxPassives: number;
  maxSkills: number;
  maxDirectives: number;
  maxSatelliteLevel: 0 | 2 | 3;
  maxRelics: number;
  allowFusion: boolean;
  allowMastery: boolean;
}

/** 按玩家历史最高到达级别 (T7 -> T1) 阶梯解锁星盘深度，防止首赛季即毕业 */
export function getV6TierCaps(bestTier: number): V6TierCaps {
  if (bestTier >= 6) {
    return {
      maxPassives: 5,
      maxSkills: 2,
      maxDirectives: 4,
      maxSatelliteLevel: 0,
      maxRelics: 2,
      allowFusion: false,
      allowMastery: false,
    };
  }
  if (bestTier >= 4) {
    return {
      maxPassives: 9,
      maxSkills: 3,
      maxDirectives: 6,
      maxSatelliteLevel: 2,
      maxRelics: 3,
      allowFusion: true,
      allowMastery: false,
    };
  }
  return {
    maxPassives: 99,
    maxSkills: 4,
    maxDirectives: 99,
    maxSatelliteLevel: 3,
    maxRelics: 5,
    allowFusion: true,
    allowMastery: true,
  };
}

export function canUnlockV6Node(
  state: V6AstrolabeState,
  kind: 'passive' | 'directive' | 'skill' | 'fusion',
  id: string
): { ok: boolean; reason?: string; missing: V6PrereqRef[] } {
  const exists =
    kind === 'passive'
      ? !!V6_PASSIVE_MAP[id]
      : kind === 'directive'
      ? !!V6_DIRECTIVE_MAP[id]
      : kind === 'skill'
      ? !!V6_ACTIVE_SKILL_MAP[id]
      : !!V6_FUSION_MAP[id];
  if (!exists) {
    return { ok: false, reason: '未知的星盘节点', missing: [] };
  }
  const { mode, requiresLock, prereqs } = getV6NodePrerequisites(kind, id);
  if (requiresLock && !state.locked) {
    return { ok: false, reason: '请先点击顶部【锁定星盘】固定双环方向，再点亮融合奇点', missing: prereqs };
  }
  if (kind === 'fusion') {
    const aligned = getAlignedFusions(state.outerRingStep, state.innerRingStep).some(x => x.fusion.id === id);
    if (!aligned) {
      return { ok: false, reason: '当前星盘定盘方向未对齐该融合奇点', missing: prereqs };
    }
  }
  const hasRef = (ref: V6PrereqRef): boolean => {
    if (ref.kind === 'passive') return state.unlockedPassives.includes(ref.id);
    if (ref.kind === 'directive') return state.unlockedDirectives.includes(ref.id);
    if (ref.kind === 'skill') return state.unlockedSkills.includes(ref.id);
    return state.unlockedFusions.includes(ref.id);
  };
  const missing = prereqs.filter(r => !hasRef(r));
  if (mode === 'any') {
    if (prereqs.length > 0 && missing.length === prereqs.length) {
      return {
        ok: false,
        reason: `需先点亮任一前置阵型被动：${prereqs.map(r => `【${r.label}】`).join(' 或 ')}`,
        missing,
      };
    }
    return { ok: true, missing: [] };
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `需先点亮前置连线节点：${missing.map(r => `【${r.label}】`).join(' + ')}`,
      missing,
    };
  }
  return { ok: true, missing: [] };
}

/** 计算当前双环角度下，6 个方向（12/2/4/6/8/10 点）各自正对生成的 6 个融合奇点 */
export function getAlignedFusions(outerStep: number, innerStep: number): Array<{
  clockIndex: number;
  style: TacticalStyle;
  system: DefenseSystem;
  fusion: V6FusionKeystoneDef;
}> {
  const out: Array<{ clockIndex: number; style: TacticalStyle; system: DefenseSystem; fusion: V6FusionKeystoneDef }> = [];
  for (let k = 0; k < 6; k++) {
    const style = OUTER_RING_STYLES[((k - outerStep) % 6 + 6) % 6];
    const system = INNER_RING_SYSTEMS[((Math.floor(k / 2) - innerStep) % 3 + 3) % 3];
    const fusion = V6_FUSION_KEYSTONES.find(f => f.system === system && f.style === style)!;
    out.push({ clockIndex: k, style, system, fusion });
  }
  return out;
}

/** 创建默认 V6 锁定式双环星盘（自动将开局所选打法与防线体系对齐 12 点钟，并赠送 4 张开局稳健手牌 + 2 个开局主动技） */
export function createDefaultAstrolabeState(
  initialStyle: TacticalStyle = 'balanced',
  initialFormation: FormationName = '4-3-3'
): V6AstrolabeState {
  const styleIdx = Math.max(0, OUTER_RING_STYLES.indexOf(initialStyle));
  const sys = getDefenseSystem(initialFormation);
  const sysIdx = Math.max(0, INNER_RING_SYSTEMS.indexOf(sys));
  const outerRingStep = (6 - styleIdx) % 6;
  const innerRingStep = (3 - sysIdx) % 3;

  // 开局赠送：本打法原点 + 本防线原点 + 4 张本打法稳健手牌（2攻2守，直接填满每拐点4槽） + 2 个本打法主动技
  const starterDirs = V6_DIRECTIVES
    .filter(d => d.source === 'style' && d.style === initialStyle && d.route === 'steady')
    .slice(0, 4)
    .map(d => d.id);
  const starterSkills = V6_ACTIVE_SKILLS
    .filter(s => s.source === 'style' && s.style === initialStyle)
    .slice(0, 2)
    .map(s => s.id);
  const fmKey = initialFormation.replace(/-/g, '');
  const unlockedPassives = [
    STYLE_ORIGIN_PASSIVE[initialStyle],
    SYSTEM_ORIGIN_PASSIVE[sys],
    `pf_${fmKey}_a`,
  ];

  const skillBranchChoice: Record<string, 'A' | 'B'> = {};
  for (const sid of starterSkills) skillBranchChoice[sid] = 'A';

  return {
    outerRingStep,
    innerRingStep,
    locked: false,
    unlockedPassives,
    unlockedDirectives: [...starterDirs],
    directiveSatellites: {},
    unlockedSkills: [...starterSkills],
    skillBranchChoice,
    unlockedFusions: [],
    fusionBranchChoice: {},
    unlockedMasterySeals: [],
    coreUnlocked: false,
    checkpointPools: {
      s1: [...starterDirs],
      s2: [...starterDirs],
      s3: [...starterDirs],
      s4: [...starterDirs],
    },
    useUniversalPool: true,
    equippedSkills: [...starterSkills],
    fogCleared: false,
    freeRespecAvailable: true,
  };
}

/** 规范化存档中的 V6 星盘（兼容旧存档与 p20/p45/p70 存档平滑迁移） */
export function ensureV6AstrolabeState(
  raw: Partial<V6AstrolabeState> | undefined,
  fallbackStyle: TacticalStyle,
  fallbackFormation: FormationName
): V6AstrolabeState {
  const base = createDefaultAstrolabeState(fallbackStyle, fallbackFormation);
  if (!raw) return base;
  const rawPools = (raw.checkpointPools ?? {}) as Partial<Record<string, string[]>>;
  const pS1 = rawPools.s1 ?? rawPools.p20 ?? base.checkpointPools.s1;
  const pS2 = rawPools.s2 ?? rawPools.p20 ?? base.checkpointPools.s2;
  const pS3 = rawPools.s3 ?? rawPools.p45 ?? base.checkpointPools.s3;
  const pS4 = rawPools.s4 ?? rawPools.p70 ?? base.checkpointPools.s4;
  return {
    ...base,
    ...raw,
    unlockedPassives: Array.isArray(raw.unlockedPassives) && raw.unlockedPassives.length > 0 ? raw.unlockedPassives : base.unlockedPassives,
    unlockedDirectives: Array.isArray(raw.unlockedDirectives) && raw.unlockedDirectives.length > 0 ? raw.unlockedDirectives : base.unlockedDirectives,
    directiveSatellites: raw.directiveSatellites ?? {},
    unlockedSkills: Array.isArray(raw.unlockedSkills) && raw.unlockedSkills.length > 0 ? raw.unlockedSkills : base.unlockedSkills,
    skillBranchChoice: raw.skillBranchChoice ?? base.skillBranchChoice,
    unlockedFusions: Array.isArray(raw.unlockedFusions) ? raw.unlockedFusions : [],
    fusionBranchChoice: raw.fusionBranchChoice ?? {},
    unlockedMasterySeals: Array.isArray(raw.unlockedMasterySeals) ? raw.unlockedMasterySeals : [],
    checkpointPools: {
      s1: pS1.slice(0, 4),
      s2: pS2.slice(0, 4),
      s3: pS3.slice(0, 4),
      s4: pS4.slice(0, 4),
    },
    equippedSkills: Array.isArray(raw.equippedSkills) ? raw.equippedSkills.slice(0, 4) : base.equippedSkills,
  };
}

/** T7 新手渐进解雾判断 */
export function isStyleVisibleInFog(
  state: V6AstrolabeState,
  style: TacticalStyle,
  clubTier: number,
  primaryStyle: TacticalStyle
): boolean {
  if (state.fogCleared || clubTier <= 5) return true;
  const pIdx = OUTER_RING_STYLES.indexOf(primaryStyle);
  const sIdx = OUTER_RING_STYLES.indexOf(style);
  if (clubTier === 6) {
    const dist = Math.min((sIdx - pIdx + 6) % 6, (pIdx - sIdx + 6) % 6);
    return dist <= 1;
  }
  return style === primaryStyle;
}

/** 检查某流派宗师印是否满足前置（点亮该流派≥2张满3卫星手牌 + ≥2个该流派主动技） */
export function canUnlockMasterySeal(state: V6AstrolabeState, style: TacticalStyle): { ok: boolean; reason?: string } {
  const maxedDirs = state.unlockedDirectives.filter(id => {
    const d = V6_DIRECTIVE_MAP[id];
    const sats = state.directiveSatellites[id] ?? [];
    return d?.style === style && sats.length >= 3;
  }).length;
  const styleSkills = state.unlockedSkills.filter(id => V6_ACTIVE_SKILL_MAP[id]?.style === style).length;
  if (maxedDirs < 2) return { ok: false, reason: `需先点满 2 张【${STYLE_LABELS[style].short}】手牌的全部 3 颗卫星 (${maxedDirs}/2)` };
  if (styleSkills < 2) return { ok: false, reason: `需先解锁 2 个【${STYLE_LABELS[style].short}】主动技 (${styleSkills}/2)` };
  return { ok: true };
}

/** 圆心【★ 超级宗师】双轨解锁判定（二选一，不强迫全修 6 流派） */
export function canUnlockCore(state: V6AstrolabeState): { ok: boolean; track?: 'multi' | 'mono'; reason: string } {
  if (state.unlockedMasterySeals.length >= 3) {
    return { ok: true, track: 'multi', reason: `已点亮 ${state.unlockedMasterySeals.length} 个宗师印（多修宗师轨达成）` };
  }
  for (const sealId of state.unlockedMasterySeals) {
    const seal = V6_MASTERY_SEAL_MAP[sealId];
    if (!seal) continue;
    const fusionsOfStyle = state.unlockedFusions.filter(fid => V6_FUSION_MAP[fid]?.style === seal.style).length;
    const maxedDirsOfStyle = state.unlockedDirectives.filter(did => {
      const d = V6_DIRECTIVE_MAP[did];
      return d?.style === seal.style && (state.directiveSatellites[did]?.length ?? 0) >= 3;
    }).length;
    if (fusionsOfStyle >= 2 && maxedDirsOfStyle >= 6) {
      return { ok: true, track: 'mono', reason: `【${STYLE_LABELS[seal.style].short}】单修极致轨达成！` };
    }
  }
  return {
    ok: false,
    reason: `需点亮任意 3 个宗师印 (${state.unlockedMasterySeals.length}/3)，或单流派达到「1宗师印 + 2融合奇点 + 6张满卫星手牌」`,
  };
}

/** 计算已消耗的可退还点数（排除开局免费赠送部分） */
export function calcRefundablePoints(
  state: V6AstrolabeState,
  initialStyle: TacticalStyle,
  initialFormation: FormationName
): number {
  const starter = createDefaultAstrolabeState(initialStyle, initialFormation);
  const starterPassives = new Set(starter.unlockedPassives);
  const starterDirs = new Set(starter.unlockedDirectives);
  const starterSkills = new Set(starter.unlockedSkills);

  let total = 0;
  for (const pid of state.unlockedPassives) {
    if (!starterPassives.has(pid)) total += V6_PASSIVE_MAP[pid]?.unlockCost ?? 1;
  }
  for (const did of state.unlockedDirectives) {
    if (!starterDirs.has(did)) total += V6_DIRECTIVE_MAP[did]?.unlockCost ?? 2;
    for (const sat of state.directiveSatellites[did] ?? []) {
      total += sat === 'C' ? 2 : 1;
    }
  }
  for (const sid of state.unlockedSkills) {
    if (!starterSkills.has(sid)) total += V6_ACTIVE_SKILL_MAP[sid]?.unlockCost ?? 2;
  }
  for (const fid of state.unlockedFusions) {
    total += V6_FUSION_MAP[fid]?.unlockCost ?? 3;
  }
  for (const mid of state.unlockedMasterySeals) {
    total += V6_MASTERY_SEAL_MAP[mid]?.unlockCost ?? 3;
  }
  if (state.coreUnlocked) total += 5;
  return total;
}

/** 将某张 V6 三区双刃剑手牌（叠加卫星 A/B/C、契合加成与单赛季暗金附魔/超频）编译为 MatchEngine 可直接执行的 CommandCardEffect */
export function compileDirectiveToEffect(
  directiveId: string,
  state: V6AstrolabeState,
  currentStyle: TacticalStyle,
  currentFormation: FormationName,
  rogue?: V6SeasonRogueState
): CommandCardEffect | null {
  const def: V6DirectiveDef | undefined = V6_DIRECTIVE_MAP[directiveId];
  if (!def) return null;

  const isOverclocked = !!rogue?.overclockedDirectives?.includes(directiveId);
  const sats = new Set<V6SatelliteKey>(
    isOverclocked ? ['A', 'B', 'C'] : (state.directiveSatellites[directiveId] ?? [])
  );
  const enchant = rogue?.directiveEnchants?.[directiveId];
  const effect: CommandCardEffect = {
    id: def.id,
    name: def.name,
    durationMinutes: def.durationMinutes,
    ...def.baseEffect,
    tacticalMod: def.baseEffect.tacticalMod ? { ...def.baseEffect.tacticalMod } : {},
    immunityFlags: def.baseEffect.immunityFlags ? { ...def.baseEffect.immunityFlags } : {},
    eventHooks: def.baseEffect.eventHooks ? [...def.baseEffect.eventHooks] : [],
  };

  // 同打法绿色契合（或五卫全能宗师冠解除跨系惩罚）自动减免 20% 负面风险
  const noCrossPenalty = state.unlockedFusions.some(fid => {
    const f = V6_FUSION_MAP[fid];
    const br = state.fusionBranchChoice[fid] === 'B' ? f?.branchB : f?.branchA;
    return !!br?.immunityFlags?.noCrossStylePenalty;
  });
  const isGreenSynergy =
    noCrossPenalty ||
    (def.style && def.style === currentStyle) ||
    (def.formation && def.formation === currentFormation);
  if (isGreenSynergy && effect.tacticalMod) {
    if ((effect.tacticalMod.oppThroughPassBonus ?? 0) > 0) {
      effect.tacticalMod.oppThroughPassBonus = Math.round(effect.tacticalMod.oppThroughPassBonus! * 0.8 * 100) / 100;
    }
    if ((effect.tacticalMod.staminaDrainMul ?? 1) > 1) {
      effect.tacticalMod.staminaDrainMul = 1 + (effect.tacticalMod.staminaDrainMul! - 1) * 0.8;
    }
  } else if (!isGreenSynergy) {
    // 跨流派强行混搭惩罚：balanced（均衡）享受跨流派手牌惩罚减半（正面属性 78 折、副作用减半）
    const isBalanced = currentStyle === 'balanced';
    const posMul = isBalanced ? 0.78 : 0.55;
    const drainMul = isBalanced ? 1.07 : 1.15;
    const throughRisk = isBalanced ? 0.02 : 0.04;
    const scalePos = (v?: number) => (v && v > 0 ? Math.round(v * posMul) : v);
    effect.passingDelta = scalePos(effect.passingDelta);
    effect.shootingDelta = scalePos(effect.shootingDelta);
    effect.defendingDelta = scalePos(effect.defendingDelta);
    effect.paceDelta = scalePos(effect.paceDelta);
    effect.composureDelta = scalePos(effect.composureDelta);
    effect.goalkeepingDelta = scalePos(effect.goalkeepingDelta);
    if (effect.tacticalMod) {
      effect.tacticalMod.staminaDrainMul = Math.round(((effect.tacticalMod.staminaDrainMul ?? 1) * drainMul) * 100) / 100;
      effect.tacticalMod.oppThroughPassBonus = Math.round(((effect.tacticalMod.oppThroughPassBonus ?? 0) + throughRisk) * 100) / 100;
    }
  }

  // 卫星 A：减半或清除副作用
  if (sats.has('A')) {
    const sA = def.satellites.A;
    if (sA.removeRisk && effect.tacticalMod) {
      if ((effect.tacticalMod.oppThroughPassBonus ?? 0) > 0) effect.tacticalMod.oppThroughPassBonus = 0;
      if ((effect.tacticalMod.staminaDrainMul ?? 1) > 1) effect.tacticalMod.staminaDrainMul = 1.0;
    } else if (sA.halveRisk && effect.tacticalMod) {
      if ((effect.tacticalMod.oppThroughPassBonus ?? 0) > 0) effect.tacticalMod.oppThroughPassBonus! *= 0.5;
      if ((effect.tacticalMod.staminaDrainMul ?? 1) > 1) {
        effect.tacticalMod.staminaDrainMul = 1 + (effect.tacticalMod.staminaDrainMul! - 1) * 0.5;
      }
      if ((effect.tacticalMod.foulRateMul ?? 1) > 1) {
        effect.tacticalMod.foulRateMul = 1 + (effect.tacticalMod.foulRateMul! - 1) * 0.5;
      }
    }
    if (sA.extraEffect) mergeCardEffect(effect, sA.extraEffect);
    if (sA.extraImmunity) effect.immunityFlags = { ...effect.immunityFlags, ...sA.extraImmunity };
  }

  // 卫星 B：强化正面效果
  if (sats.has('B')) {
    const sB = def.satellites.B;
    if (sB.extraEffect) mergeCardEffect(effect, sB.extraEffect);
    if (sB.extraImmunity) effect.immunityFlags = { ...effect.immunityFlags, ...sB.extraImmunity };
  }

  // 卫星 C：宗师质变（挂入事件总线钩子）
  if (sats.has('C')) {
    const sC = def.satellites.C;
    if (sC.extraEffect) mergeCardEffect(effect, sC.extraEffect);
    if (sC.extraHooks?.length) effect.eventHooks = [...(effect.eventHooks ?? []), ...sC.extraHooks];
    if (sC.extraImmunity) effect.immunityFlags = { ...effect.immunityFlags, ...sC.extraImmunity };
  }

  // 单赛季肉鸽暗金附魔加成
  let extraDur = 0;
  if (enchant === 'zero_risk') {
    if (effect.tacticalMod) {
      if ((effect.tacticalMod.oppThroughPassBonus ?? 0) > 0) effect.tacticalMod.oppThroughPassBonus = 0;
      if ((effect.tacticalMod.oppLongShotBonus ?? 0) > 0) effect.tacticalMod.oppLongShotBonus = 0;
      if ((effect.tacticalMod.staminaDrainMul ?? 1) > 1) effect.tacticalMod.staminaDrainMul = 1.0;
      if ((effect.tacticalMod.foulRateMul ?? 1) > 1) effect.tacticalMod.foulRateMul = 1.0;
    }
    if ((effect.passingDelta ?? 0) < 0) effect.passingDelta = 0;
    if ((effect.shootingDelta ?? 0) < 0) effect.shootingDelta = 0;
    if ((effect.defendingDelta ?? 0) < 0) effect.defendingDelta = 0;
    if ((effect.paceDelta ?? 0) < 0) effect.paceDelta = 0;
  } else if (enchant === 'long_duration') {
    extraDur += 10;
  } else if (enchant === 'lead_fortress') {
    effect.defendingDelta = (effect.defendingDelta ?? 0) + 6;
    effect.tacticalMod = effect.tacticalMod ?? {};
    effect.tacticalMod.blockBonus = (effect.tacticalMod.blockBonus ?? 0) + 0.12;
  } else if (enchant === 'trail_frenzy') {
    effect.shootingDelta = (effect.shootingDelta ?? 0) + 8;
    if (!effect.mechanic) effect.mechanic = 'blood_frenzy';
  } else if (enchant === 'cd_charge') {
    effect.eventHooks = [
      ...(effect.eventHooks ?? []),
      { trigger: 'onShot', action: 'cutSkillCd', value: 2, maxPerBuff: 2 },
      { trigger: 'onTackle', action: 'cutSkillCd', value: 2, maxPerBuff: 2 },
    ];
  }

  // 阵型/奇点/宗师印持续时长加成
  for (const pid of state.unlockedPassives) {
    const p = V6_PASSIVE_MAP[pid];
    if (p?.formation === currentFormation && p.directiveDurationBonus && (!p.directiveZoneBonus || p.directiveZoneBonus === def.zone)) {
      extraDur += p.directiveDurationBonus;
    }
  }
  for (const fid of state.unlockedFusions) {
    const f = V6_FUSION_MAP[fid];
    const br = state.fusionBranchChoice[fid] === 'B' ? f?.branchB : f?.branchA;
    if (br?.directiveDurationBonus) extraDur += br.directiveDurationBonus;
  }
  if (def.style === 'tiki_taka' && state.unlockedMasterySeals.includes('seal_tt')) {
    extraDur += 5;
  }
  if (state.unlockedMasterySeals.includes('seal_gp') && effect.tacticalMod && (effect.tacticalMod.staminaDrainMul ?? 1) > 1) {
    effect.tacticalMod.staminaDrainMul = 1 + (effect.tacticalMod.staminaDrainMul! - 1) * 0.75;
  }
  effect.durationMinutes += extraDur;

  return effect;
}

function mergeCardEffect(target: CommandCardEffect, patch: Partial<CommandCardEffect>): void {
  if (patch.passingDelta) target.passingDelta = (target.passingDelta ?? 0) + patch.passingDelta;
  if (patch.shootingDelta) target.shootingDelta = (target.shootingDelta ?? 0) + patch.shootingDelta;
  if (patch.defendingDelta) target.defendingDelta = (target.defendingDelta ?? 0) + patch.defendingDelta;
  if (patch.paceDelta) target.paceDelta = (target.paceDelta ?? 0) + patch.paceDelta;
  if (patch.composureDelta) target.composureDelta = (target.composureDelta ?? 0) + patch.composureDelta;
  if (patch.goalkeepingDelta) target.goalkeepingDelta = (target.goalkeepingDelta ?? 0) + patch.goalkeepingDelta;
  if (patch.fitnessInstantDelta) target.fitnessInstantDelta = (target.fitnessInstantDelta ?? 0) + patch.fitnessInstantDelta;
  if (patch.penaltyAllDefDelta !== undefined) target.penaltyAllDefDelta = patch.penaltyAllDefDelta;
  if (patch.mechanic) target.mechanic = patch.mechanic;
  if (patch.chemistryMod) {
    target.chemistryMod = {
      scope: patch.chemistryMod.scope,
      delta: (target.chemistryMod?.delta ?? 0) + patch.chemistryMod.delta,
    };
  }
  if (patch.oppDebuff) {
    target.oppDebuff = {
      oppFitnessDelta: (target.oppDebuff?.oppFitnessDelta ?? 0) + (patch.oppDebuff.oppFitnessDelta ?? 0),
      oppComposureDelta: (target.oppDebuff?.oppComposureDelta ?? 0) + (patch.oppDebuff.oppComposureDelta ?? 0),
    };
  }
  if (patch.affix) target.affix = patch.affix;
  if (patch.tacticalMod) {
    target.tacticalMod = target.tacticalMod ?? {};
    const tm = target.tacticalMod;
    const pm = patch.tacticalMod;
    if (pm.lineShift) tm.lineShift = (tm.lineShift ?? 0) + pm.lineShift;
    if (pm.overlapDepthBonus) tm.overlapDepthBonus = (tm.overlapDepthBonus ?? 0) + pm.overlapDepthBonus;
    if (pm.dualOverlap) tm.dualOverlap = true;
    if (pm.boxCrashBonus) tm.boxCrashBonus = (tm.boxCrashBonus ?? 0) + pm.boxCrashBonus;
    if (pm.pressDistBonus) tm.pressDistBonus = (tm.pressDistBonus ?? 0) + pm.pressDistBonus;
    if (pm.shortPassBias) tm.shortPassBias = (tm.shortPassBias ?? 0) + pm.shortPassBias;
    if (pm.throughPassBias) tm.throughPassBias = (tm.throughPassBias ?? 0) + pm.throughPassBias;
    if (pm.crossBias) tm.crossBias = (tm.crossBias ?? 0) + pm.crossBias;
    if (pm.longShotBias) tm.longShotBias = (tm.longShotBias ?? 0) + pm.longShotBias;
    if (pm.gkQuickLaunch) tm.gkQuickLaunch = true;
    if (pm.staminaDrainMul) tm.staminaDrainMul = (tm.staminaDrainMul ?? 1) * pm.staminaDrainMul;
    if (pm.tempoMul) tm.tempoMul = (tm.tempoMul ?? 1) * pm.tempoMul;
    if (pm.foulRateMul) tm.foulRateMul = (tm.foulRateMul ?? 1) * pm.foulRateMul;
    if (pm.cornerRateMul) tm.cornerRateMul = (tm.cornerRateMul ?? 1) * pm.cornerRateMul;
    if (pm.freeKickRateMul) tm.freeKickRateMul = (tm.freeKickRateMul ?? 1) * pm.freeKickRateMul;
    if (pm.blockBonus) tm.blockBonus = (tm.blockBonus ?? 0) + pm.blockBonus;
    if (pm.oppThroughPassBonus) tm.oppThroughPassBonus = (tm.oppThroughPassBonus ?? 0) + pm.oppThroughPassBonus;
    if (pm.oppLongShotBonus) tm.oppLongShotBonus = (tm.oppLongShotBonus ?? 0) + pm.oppLongShotBonus;
    if (pm.interceptRangeBonus) tm.interceptRangeBonus = (tm.interceptRangeBonus ?? 0) + pm.interceptRangeBonus;
    if (pm.offsideTrapBonus) tm.offsideTrapBonus = (tm.offsideTrapBonus ?? 0) + pm.offsideTrapBonus;
    if (pm.oppStaminaDrainPerMin) tm.oppStaminaDrainPerMin = (tm.oppStaminaDrainPerMin ?? 0) + pm.oppStaminaDrainPerMin;
  }
}

export interface CompiledV6MatchPayload {
  tacticalMods: TacticalMods;
  v6PassiveHooks: EventHookRule[];
  v6ImmunityFlags: ImmunityFlags;
  v6TotalFootballMaster: boolean;
  v6SkillTempRankBonus: number;
  v6SkillDualBranch: boolean;
  v6StartingShields: number;
  v6MaxCounterStacks: number;
  equippedSkills: EquippedActiveSkill[];
  checkpointTpBase: number;
  maxCarryTp: number;
  maxPlaysPerSegment: number;
  hasEmergencyCall: boolean;
  relics: V6RelicId[];
  lineStatDeltas: Array<{
    targetLine?: CommandCardEffect['targetLine'];
    passing?: number;
    shooting?: number;
    defending?: number;
    pace?: number;
    composure?: number;
    goalkeeping?: number;
  }>;
}

/** 赛前一键编译整个 V6 星盘（被动 + 融合奇点 + 宗师印 + 圆心 + 装备主动技 + 单赛季肉鸽圣物）为 MatchEngine 注入包 */
export function compileAstrolabeToMatchSetup(
  state: V6AstrolabeState,
  currentFormation: FormationName,
  currentStyle: TacticalStyle,
  rogue?: V6SeasonRogueState
): CompiledV6MatchPayload {
  const curSys = getDefenseSystem(currentFormation);
  const relics = new Set<V6RelicId>(rogue?.seasonRelics ?? []);
  const overloadedSkillSet = new Set<string>(rogue?.overloadedSkills ?? []);
  const tacticalMods: TacticalMods = {};
  const v6PassiveHooks: EventHookRule[] = [];
  const v6ImmunityFlags: ImmunityFlags = {};
  let v6SkillTempRankBonus = 0;
  let v6SkillDualBranch = false;
  let v6StartingShields = relics.has('san_siro_gloves') ? 1 : 0;
  let v6MaxCounterStacks = 2;
  const lineStatDeltas: CompiledV6MatchPayload['lineStatDeltas'] = [];

  const addMod = (m?: Partial<TacticalMods>) => {
    if (!m) return;
    if (m.lineShift) tacticalMods.lineShift = (tacticalMods.lineShift ?? 0) + m.lineShift;
    if (m.overlapDepthBonus) tacticalMods.overlapDepthBonus = (tacticalMods.overlapDepthBonus ?? 0) + m.overlapDepthBonus;
    if (m.dualOverlap) tacticalMods.dualOverlap = true;
    if (m.falseNineDrop) tacticalMods.falseNineDrop = (tacticalMods.falseNineDrop ?? 0) + m.falseNineDrop;
    if (m.boxCrashBonus) tacticalMods.boxCrashBonus = (tacticalMods.boxCrashBonus ?? 0) + m.boxCrashBonus;
    if (m.pressDistBonus) tacticalMods.pressDistBonus = (tacticalMods.pressDistBonus ?? 0) + m.pressDistBonus;
    if (m.extraPresser) tacticalMods.extraPresser = true;
    if (m.shortPassBias) tacticalMods.shortPassBias = (tacticalMods.shortPassBias ?? 0) + m.shortPassBias;
    if (m.throughPassBias) tacticalMods.throughPassBias = (tacticalMods.throughPassBias ?? 0) + m.throughPassBias;
    if (m.crossBias) tacticalMods.crossBias = (tacticalMods.crossBias ?? 0) + m.crossBias;
    if (m.longShotBias) tacticalMods.longShotBias = (tacticalMods.longShotBias ?? 0) + m.longShotBias;
    if (m.gkQuickLaunch) tacticalMods.gkQuickLaunch = true;
    if (m.staminaDrainMul) tacticalMods.staminaDrainMul = (tacticalMods.staminaDrainMul ?? 1) * m.staminaDrainMul;
  };

  if (relics.has('comeback_gene')) {
    v6PassiveHooks.push({ trigger: 'onConcede', action: 'cutSkillCd', value: 4 });
  }
  if (relics.has('super_bench')) {
    v6PassiveHooks.push({ trigger: 'onSubIn', action: 'triggerMiniBuff', miniBuffPreset: 'pace_burst' });
  }

  // 1. 汇总已解锁且生效的被动
  for (const pid of state.unlockedPassives) {
    const p = V6_PASSIVE_MAP[pid];
    if (!p) continue;
    if (p.source === 'system' && p.system !== curSys) continue;
    if (p.source === 'formation' && p.formation !== currentFormation) continue;
    if (p.source === 'style' && p.style && p.style !== currentStyle) continue;
    addMod(p.tacticalMod);
    if (p.statDelta) lineStatDeltas.push(p.statDelta);
    if (p.hooks?.length) v6PassiveHooks.push(...p.hooks);
    if (p.immunityFlags) Object.assign(v6ImmunityFlags, p.immunityFlags);
    if (p.startingShields) v6StartingShields += p.startingShields;
    if (p.maxCounterStacks) v6MaxCounterStacks = Math.max(v6MaxCounterStacks, p.maxCounterStacks);
  }

  // 2. 汇总当前盘面正对且已解锁的融合奇点 + 本赛季跨界借用奇点
  const alignedIds = new Set(getAlignedFusions(state.outerRingStep, state.innerRingStep).map(a => a.fusion.id));
  const applyFusionBranch = (fid: string, branchKey: 'A' | 'B') => {
    const f = V6_FUSION_MAP[fid];
    if (!f) return;
    const br = branchKey === 'B' ? f.branchB : f.branchA;
    addMod(br.tacticalMod);
    if (br.hooks?.length) v6PassiveHooks.push(...br.hooks);
    if (br.immunityFlags) Object.assign(v6ImmunityFlags, br.immunityFlags);
    if (br.startingShields) v6StartingShields += br.startingShields;
    if (br.maxCounterStacks) v6MaxCounterStacks = Math.max(v6MaxCounterStacks, br.maxCounterStacks);
    if (br.skillDualBranch) v6SkillDualBranch = true;
    if (br.skillTempRankBonus) v6SkillTempRankBonus += br.skillTempRankBonus;
  };
  for (const fid of state.unlockedFusions) {
    if (!alignedIds.has(fid)) continue;
    applyFusionBranch(fid, state.fusionBranchChoice[fid] === 'B' ? 'B' : 'A');
  }
  if (rogue?.borrowedFusion && !state.unlockedFusions.includes(rogue.borrowedFusion.id)) {
    applyFusionBranch(rogue.borrowedFusion.id, rogue.borrowedFusion.branch);
  }

  // 3. 汇总宗师印
  let hasEmergencyCall = false;
  for (const mid of state.unlockedMasterySeals) {
    const m = V6_MASTERY_SEAL_MAP[mid];
    if (!m) continue;
    if (m.startingShields) v6StartingShields += m.startingShields;
    if (m.extraEmergencyCall) hasEmergencyCall = true;
    if (m.hooks?.length) v6PassiveHooks.push(...m.hooks);
  }

  // 4. 编译最多 4 个已装备的主动技
  const equippedSkills: EquippedActiveSkill[] = [];
  for (const sid of state.equippedSkills.slice(0, 4)) {
    const def = V6_ACTIVE_SKILL_MAP[sid];
    if (!def) continue;
    const isOverloaded = overloadedSkillSet.has(sid);
    const choice = state.skillBranchChoice[sid] ?? 'A';
    const primary = choice === 'B' ? def.branchB : def.branchA;
    const secondary = choice === 'B' ? def.branchA : def.branchB;
    const dualActive = v6SkillDualBranch || isOverloaded;
    const eff: CommandCardEffect = {
      id: `sk_${def.id}`,
      name: def.name,
      durationMinutes: def.durationMinutes * (primary.tag === 'double_duration' || (dualActive && secondary.tag === 'double_duration') ? 2 : 1),
      ...def.baseEffect,
    };
    if (primary.extraEffect) mergeCardEffect(eff, primary.extraEffect);
    if (dualActive && secondary.extraEffect) mergeCardEffect(eff, secondary.extraEffect);
    const isOffStyleSkill = !!(def.style && def.style !== currentStyle);
    const isBalancedStyle = currentStyle === 'balanced';
    if (isOffStyleSkill) {
      const skillPosMul = isBalancedStyle ? 0.80 : 0.60;
      const scalePos = (v?: number) => (v && v > 0 ? Math.round(v * skillPosMul) : v);
      eff.passingDelta = scalePos(eff.passingDelta);
      eff.shootingDelta = scalePos(eff.shootingDelta);
      eff.defendingDelta = scalePos(eff.defendingDelta);
      eff.paceDelta = scalePos(eff.paceDelta);
      eff.composureDelta = scalePos(eff.composureDelta);
      eff.goalkeepingDelta = scalePos(eff.goalkeepingDelta);
    }
    equippedSkills.push({
      id: def.id,
      name: def.name,
      situation: def.situation,
      situationLabel: def.situationLabel,
      minFamiliarity: 20,
      minChemistry: 15,
      cooldownMinutes: Math.max(4, def.cooldownMinutes + 3 + (isOffStyleSkill ? (isBalancedStyle ? 2 : 6) : 0) - (isOverloaded ? 3 : 0)),
      maxPerMatch: Math.max(1, def.maxPerMatch + (isOverloaded ? 1 : 0) - (isOffStyleSkill && !isBalancedStyle ? 1 : 0)),
      durationMinutes: eff.durationMinutes,
      powerLabel: def.powerLabel,
      effect: eff,
      rank: 1,
      effectiveRank: Math.min(3, 1 + v6SkillTempRankBonus + (isOverloaded ? 1 : 0)),
      mutationChoice: choice,
      mutationTag: primary.tag,
      secondaryMutationTag: secondary.tag,
      mutationLabel: dualActive ? `${primary.label}+${secondary.label}` : primary.label,
      instantAction: def.instantAction,
      instantLabel: def.instantLabel,
      vfxTheme: def.vfxTheme,
      styleTag: def.style ?? currentStyle,
    });
  }

  // 四赛段 TP 规则：默认每段 3 TP（4段共 12 TP），集齐6印 +1 TP，圣物《充裕指挥预算》+1 TP
  const checkpointTpBase = 3 + (state.unlockedMasterySeals.length >= 6 ? 1 : 0) + (relics.has('rich_budget') ? 1 : 0);
  const maxCarryTp = relics.has('rich_budget') ? 3 : 2;
  const maxPlaysPerSegment = relics.has('board_expand') ? 3 : 2;

  return {
    tacticalMods,
    v6PassiveHooks,
    v6ImmunityFlags,
    v6TotalFootballMaster: state.coreUnlocked,
    v6SkillTempRankBonus,
    v6SkillDualBranch,
    v6StartingShields,
    v6MaxCounterStacks,
    equippedSkills,
    checkpointTpBase,
    maxCarryTp,
    maxPlaysPerSegment,
    hasEmergencyCall,
    relics: Array.from(relics),
    lineStatDeltas,
  };
}
