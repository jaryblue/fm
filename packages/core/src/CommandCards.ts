/**
 * 教练场外指挥卡牌与以撒风格无限化学合成系统
 * - 1 级基础卡：数量拓展至 10 种，严格限定单一位置（门将/后卫/中场/前锋），无连锁
 * - 2~4 元素自由化学反应釜：支持无限种组合，存在双刃剑/负面反噬与超临界反应
 * - 3~4 级高级卡：解锁跨线传导、能量返还、体能虹吸、连续打牌共鸣等连锁效果
 * - 每场比赛最多携带 4 张卡出战，卡库最多收藏 12 张，支持以卡融卡升阶
 */

import { CardMechanic, CardTargetLine, CommandCardChain, CommandCardEffect } from '../../engine/src/types';

export const MECHANIC_LABELS: Record<CardMechanic, string> = {
  offside_trap: '造越位返还1能量',
  set_piece_nuke: '定位球xG+35%',
  super_sub: '替补登场+10全能',
  high_press_blitz: '高位抢断率+12%',
  tiki_taka_flow: '传控每6脚回体2%',
  gk_counter_launch: '门将快发xG+25%',
  wing_overload: '边路传中抢点+20%',
  long_shot_cannon: '远射命中与xG+30%',
  iron_wall_block: '禁区封堵率+18%',
  blood_frenzy: '落后时全队+8射/速',
};

export type ElementId = 'press' | 'pass' | 'wing' | 'iron' | 'blitz';
export type CraftFocus = 'balanced' | 'endure' | 'surge';

export interface ElementDef {
  id: ElementId;
  name: string;
  symbol: string;
  color: string;
  desc: string;
}

export const TACTICAL_ELEMENTS: ElementDef[] = [
  { id: 'press', name: '高压', symbol: 'Pr', color: '#EF4444', desc: '跑动压迫与抢断倾向（偏中场/防线，过量易透支体能）' },
  { id: 'pass',  name: '短传', symbol: 'Ps', color: '#38BDF8', desc: '传控组织与冷静度（偏中场/前腰，稳定化学反应）' },
  { id: 'wing',  name: '边路', symbol: 'Wg', color: '#F59E0B', desc: '边路速度与冲击力（偏边锋/边卫，可催化连锁）' },
  { id: 'iron',  name: '铁血', symbol: 'Fe', color: '#22C55E', desc: '稳固防线与体能恢复（偏后卫/门将，中和不稳定度）' },
  { id: 'blitz', name: '奇袭', symbol: 'Bz', color: '#A855F7', desc: '门前终结与射门威胁（偏前锋，极易触发高危双刃剑）' },
];

export interface CommandCard extends CommandCardEffect {
  cost: number;           // 比赛日战术能量消耗 (1 ~ 3)
  summary: string;        // 简短效果说明
  recipeKey?: string;     // 化学分子式，如 "press+wing+blitz"
  level: number;          // 卡牌等级 1 ~ 4 (Lv.1 基础单位置，Lv.3+ 解锁连锁)
  focus?: CraftFocus;
  isCorrupted?: boolean;  // 是否包含负面反噬/污染
}

export const LINE_LABELS: Record<CardTargetLine, string> = {
  GK: '仅门将',
  DEF: '仅后卫线',
  MID: '仅中场线',
  ATT: '仅前锋线',
  ALL: '全队通用',
};

export function getElementLabel(id: ElementId): string {
  return TACTICAL_ELEMENTS.find(e => e.id === id)?.name ?? id;
}

export function getElementSymbol(id: ElementId): string {
  return TACTICAL_ELEMENTS.find(e => e.id === id)?.symbol ?? id.slice(0, 2);
}

export function formatRecipeChinese(key: string): string {
  return key
    .split('+')
    .map(part => getElementLabel(part as ElementId))
    .join(' + ');
}

export function formatCardSummary(
  card: Pick<
    CommandCard,
    | 'durationMinutes'
    | 'targetLine'
    | 'passingDelta'
    | 'shootingDelta'
    | 'defendingDelta'
    | 'paceDelta'
    | 'composureDelta'
    | 'goalkeepingDelta'
    | 'fitnessInstantDelta'
    | 'penaltyFitnessDelta'
    | 'penaltyAllDefDelta'
    | 'chainEffect'
    | 'mechanic'
  >
): string {
  const parts: string[] = [];
  if (card.targetLine && card.targetLine !== 'ALL') {
    parts.push(`[${LINE_LABELS[card.targetLine]}]`);
  }
  if (card.fitnessInstantDelta) parts.push(`体能+${card.fitnessInstantDelta}%`);
  if (card.goalkeepingDelta) parts.push(`扑救+${card.goalkeepingDelta}`);
  if (card.paceDelta) parts.push(`速度${card.paceDelta >= 0 ? '+' : ''}${card.paceDelta}`);
  if (card.shootingDelta) parts.push(`射门${card.shootingDelta >= 0 ? '+' : ''}${card.shootingDelta}`);
  if (card.passingDelta) parts.push(`传球${card.passingDelta >= 0 ? '+' : ''}${card.passingDelta}`);
  if (card.defendingDelta) parts.push(`防守${card.defendingDelta >= 0 ? '+' : ''}${card.defendingDelta}`);
  if (card.composureDelta) parts.push(`冷静${card.composureDelta >= 0 ? '+' : ''}${card.composureDelta}`);
  if (card.penaltyFitnessDelta) parts.push(`反噬:全队体能${card.penaltyFitnessDelta}%`);
  if (card.penaltyAllDefDelta) parts.push(`反噬:防线${card.penaltyAllDefDelta}`);
  if (card.mechanic) parts.push(`机制:${MECHANIC_LABELS[card.mechanic]}`);
  if (card.chainEffect) parts.push(`连锁:${card.chainEffect.label}`);
  return `${card.durationMinutes}分 ${parts.join(' ')}`;
}

export function createInitialElements(): Record<ElementId, number> {
  return { press: 2, pass: 2, wing: 1, iron: 2, blitz: 1 };
}

/**
 * 拓展后的 Lv.1 基础位置卡池（10 种基础卡，均严格限定单一位置、无连锁）
 */
export const LV1_BASE_CARDS: Array<Omit<CommandCard, 'id'>> = [
  {
    name: '门线铁壁',
    cost: 1,
    durationMinutes: 12,
    targetLine: 'GK',
    goalkeepingDelta: 10,
    composureDelta: 8,
    mechanic: 'iron_wall_block',
    level: 1,
    recipeKey: 'iron',
    summary: '',
  },
  {
    name: '手抛快发',
    cost: 1,
    durationMinutes: 10,
    targetLine: 'GK',
    goalkeepingDelta: 6,
    passingDelta: 10,
    mechanic: 'gk_counter_launch',
    level: 1,
    recipeKey: 'pass',
    summary: '',
  },
  {
    name: '铁闸联防',
    cost: 1,
    durationMinutes: 12,
    targetLine: 'DEF',
    defendingDelta: 10,
    composureDelta: 6,
    mechanic: 'set_piece_nuke',
    level: 1,
    recipeKey: 'iron',
    summary: '',
  },
  {
    name: '边卫插上',
    cost: 1,
    durationMinutes: 10,
    targetLine: 'DEF',
    defendingDelta: 6,
    paceDelta: 10,
    mechanic: 'super_sub',
    level: 1,
    recipeKey: 'wing',
    summary: '',
  },
  {
    name: '贴身紧盯',
    cost: 1,
    durationMinutes: 10,
    targetLine: 'DEF',
    defendingDelta: 8,
    paceDelta: 6,
    mechanic: 'offside_trap',
    level: 1,
    recipeKey: 'press',
    summary: '',
  },
  {
    name: '中场节拍器',
    cost: 1,
    durationMinutes: 12,
    targetLine: 'MID',
    passingDelta: 10,
    composureDelta: 8,
    mechanic: 'tiki_taka_flow',
    level: 1,
    recipeKey: 'pass',
    summary: '',
  },
  {
    name: '疯狗扫荡',
    cost: 1,
    durationMinutes: 10,
    targetLine: 'MID',
    defendingDelta: 8,
    paceDelta: 8,
    mechanic: 'high_press_blitz',
    level: 1,
    recipeKey: 'press',
    summary: '',
  },
  {
    name: '前腰手术刀',
    cost: 1,
    durationMinutes: 10,
    targetLine: 'MID',
    passingDelta: 8,
    shootingDelta: 6,
    mechanic: 'long_shot_cannon',
    level: 1,
    recipeKey: 'blitz',
    summary: '',
  },
  {
    name: '禁区猎手',
    cost: 1,
    durationMinutes: 10,
    targetLine: 'ATT',
    shootingDelta: 10,
    composureDelta: 8,
    mechanic: 'blood_frenzy',
    level: 1,
    recipeKey: 'blitz',
    summary: '',
  },
  {
    name: '边锋爆破',
    cost: 1,
    durationMinutes: 10,
    targetLine: 'ATT',
    paceDelta: 12,
    shootingDelta: 6,
    mechanic: 'wing_overload',
    level: 1,
    recipeKey: 'wing',
    summary: '',
  },
];

let craftSeq = 0;

export function createStarterCoachDeck(): CommandCard[] {
  // 开局赠送 4 张覆盖 门将/后卫/中场/前锋 的 Lv.1 基础卡，刚好填满 4 个出战卡槽
  const picks = [LV1_BASE_CARDS[0], LV1_BASE_CARDS[2], LV1_BASE_CARDS[5], LV1_BASE_CARDS[8]];
  return picks.map((tpl, idx) => {
    const c: CommandCard = {
      ...tpl,
      id: `card_lv1_starter_${idx}`,
    };
    c.summary = formatCardSummary(c);
    return c;
  });
}

const CHAIN_POOL: CommandCardChain[] = [
  { type: 'spread_all', label: '全线传导(其余位置+4传/冷)' },
  { type: 'energy_refund', label: '战术回响(打出返还1能量)' },
  { type: 'synergy_boost', label: '连携共鸣(有激活卡时全队+6速/射)' },
  { type: 'fitness_leech', label: '体能虹吸(吸取对手8%体能)' },
];

export interface ChemistryPreview {
  card: CommandCard;
  stability: '稳定' | '双刃剑' | '高危反噬';
  stabilityColor: string;
  formula: string;
}

/**
 * 以撒风格无限化学合成推演：
 * - 1 个元素：提炼对应定位的 Lv.1 基础卡（严格单位置）
 * - 2 个元素：合成 Lv.2 进阶卡（高属性单位置，存在冲突时可能带轻微反噬）
 * - 3 个元素：合成 Lv.3 高级连锁卡（解锁 1 条连锁效果 + 跨线或高数值）
 * - 4 个元素：合成 Lv.4 传奇反应卡（全队/高爆发 + 强力连锁，但极高概率触发以撒式高收益高反噬）
 */
export function synthesizeChemistry(
  elements: ElementId[],
  focus: CraftFocus = 'balanced',
  commit = false
): ChemistryPreview {
  const counts: Record<ElementId, number> = { press: 0, pass: 0, wing: 0, iron: 0, blitz: 0 };
  for (const e of elements) counts[e]++;

  const formula = elements.map(getElementSymbol).join('·');
  const recipeKey = [...elements].sort().join('+');
  const len = elements.length;

  // 1 个元素 -> 从 Lv.1 基础位置卡池精确提炼
  if (len <= 1) {
    const e0 = elements[0] || 'pass';
    const candidates = LV1_BASE_CARDS.filter(c => c.recipeKey === e0);
    const tpl = candidates[commit ? Math.floor(Math.random() * candidates.length) : 0] || LV1_BASE_CARDS[5];
    const card: CommandCard = {
      ...tpl,
      id: commit ? `card_chem_${++craftSeq}_${Date.now().toString(36)}` : 'preview',
    };
    if (focus === 'endure') card.durationMinutes += 4;
    if (focus === 'surge') card.fitnessInstantDelta = (card.fitnessInstantDelta ?? 0) + 6;
    card.summary = formatCardSummary(card);
    return { card, stability: '稳定', stabilityColor: '#22C55E', formula };
  }

  // 计算化学向量
  let passing = counts.pass * 6 + counts.wing * 2;
  let shooting = counts.blitz * 6 + counts.wing * 2;
  let defending = counts.iron * 6 + counts.press * 3;
  let pace = counts.wing * 6 + counts.press * 4 + counts.blitz * 2;
  let composure = counts.pass * 4 + counts.iron * 3 - Math.max(0, counts.blitz - 1) * 3;
  let goalkeeping = counts.iron >= 2 && counts.pass >= 1 ? counts.iron * 5 : 0;
  let fitnessInstant = counts.iron * 5 - Math.max(0, counts.press - 1) * 4;

  // 确定目标位置：Lv.2 严格单位置；Lv.3 偏进攻/中后场；Lv.4 可全队通用
  let targetLine: CardTargetLine = 'MID';
  if (len <= 2) {
    if (counts.iron >= 2 && counts.pass === 0 && counts.blitz === 0) targetLine = 'GK';
    else if (counts.iron + counts.press >= 2 && counts.blitz === 0) targetLine = 'DEF';
    else if (counts.blitz >= 1 && counts.wing + counts.blitz >= 2) targetLine = 'ATT';
    else if (counts.blitz >= 2) targetLine = 'ATT';
    else targetLine = 'MID';
  } else if (len === 3) {
    targetLine = counts.blitz >= 2 ? 'ATT' : counts.iron >= 2 ? 'DEF' : 'MID';
  } else {
    targetLine = 'ALL';
  }

  // 不稳定度评估（激进元素堆叠 + 冲突元素 press vs iron）
  const aggression = counts.press + counts.blitz * 1.4;
  const conflict = counts.press > 0 && counts.iron > 0 ? 1 : 0;
  const rawInstability = aggression + conflict - counts.pass * 0.6;

  let penaltyFitnessDelta: number | undefined;
  let penaltyAllDefDelta: number | undefined;
  let isCorrupted = false;
  let stability: ChemistryPreview['stability'] = '稳定';
  let stabilityColor = '#22C55E';

  if (rawInstability >= 3.2) {
    stability = '高危反噬';
    stabilityColor = '#EF4444';
    isCorrupted = true;
    // 以撒式高风险高回报：进攻/速度大幅飙升，但付出体能与轻微防线代价
    shooting += 8;
    pace += 7;
    penaltyFitnessDelta = -4;
    if (counts.blitz >= 2) penaltyAllDefDelta = -1;
  } else if (rawInstability >= 2.0 || len >= 3) {
    stability = '双刃剑';
    stabilityColor = '#F59E0B';
    isCorrupted = counts.press >= 2 || counts.blitz >= 2;
    if (counts.press >= 2) penaltyFitnessDelta = -3;
  }

  // 等级与能量消耗
  const level = Math.min(4, len);
  let cost = len >= 4 ? 3 : len === 3 ? 2 : 1;

  // 自由倾向修正
  if (focus === 'endure') {
    // 持久掌控
  } else if (focus === 'surge') {
    if (cost > 1) cost -= 1;
    else fitnessInstant += 6;
  }

  // Lv.3+ 解锁连锁效果（根据主元素确定性地选出专属连锁，确保玩家可构筑可预期！）
  let chainEffect: CommandCardChain | undefined;
  if (level >= 3) {
    const chainIdx =
      counts.pass >= 2 ? 0 :
      counts.wing >= 1 && counts.pass >= 1 ? 1 :
      counts.blitz >= 1 ? 2 :
      counts.iron >= 1 ? 3 :
      (elements.length + counts.press) % CHAIN_POOL.length;
    chainEffect = CHAIN_POOL[chainIdx];
  }

  // 化学反应命名
  const prefix =
    level === 4 ? (isCorrupted ? '超临界·' : '传奇反应·') :
    level === 3 ? (isCorrupted ? '狂暴连锁·' : '高阶共鸣·') :
    isCorrupted ? '过载·' : '精炼·';
  const coreName =
    counts.blitz >= 2 ? '核爆突袭' :
    counts.press >= 2 ? '窒息狂潮' :
    counts.iron >= 2 ? '绝对壁垒' :
    counts.pass >= 2 ? '量子传控' :
    counts.wing >= 2 ? '超音速两翼' :
    targetLine === 'ATT' ? '终结连携' :
    targetLine === 'DEF' ? '铁血防线' :
    targetLine === 'GK' ? '神盾守望' : '全能枢纽';

  let mechanic: CommandCard['mechanic'];
  if (counts.iron >= 2 && counts.pass === 0 && counts.blitz === 0) mechanic = 'iron_wall_block';
  else if (counts.iron >= 1 && counts.press >= 1 && counts.blitz === 0) mechanic = 'offside_trap';
  else if (counts.iron >= 1 && counts.blitz >= 1) mechanic = 'set_piece_nuke';
  else if (counts.iron >= 1 && counts.pass >= 1) mechanic = 'gk_counter_launch';
  else if (counts.pass >= 2 && counts.blitz >= 1) mechanic = 'long_shot_cannon';
  else if (counts.pass >= 2) mechanic = 'tiki_taka_flow';
  else if (counts.wing >= 2 || (counts.wing >= 1 && counts.pass >= 1)) mechanic = 'wing_overload';
  else if (counts.wing >= 1 && counts.blitz >= 1) mechanic = 'super_sub';
  else if (counts.blitz >= 2) mechanic = 'blood_frenzy';
  else if (counts.press >= 2 || counts.press >= 1) mechanic = 'high_press_blitz';

  const card: CommandCard = {
    id: commit ? `card_chem_${++craftSeq}_${Date.now().toString(36)}` : 'preview',
    name: `${prefix}${coreName}`,
    cost,
    durationMinutes: (level >= 4 ? 18 : level === 3 ? 16 : 11) + (focus === 'endure' ? 5 : 0),
    targetLine,
    passingDelta: passing > 0 ? passing : undefined,
    shootingDelta: shooting > 0 ? shooting : undefined,
    defendingDelta: defending > 0 ? defending : undefined,
    paceDelta: pace > 0 ? pace : undefined,
    composureDelta: composure !== 0 ? composure : undefined,
    goalkeepingDelta: goalkeeping > 0 ? goalkeeping : undefined,
    fitnessInstantDelta: fitnessInstant > 0 ? fitnessInstant : undefined,
    penaltyFitnessDelta,
    penaltyAllDefDelta,
    chainEffect,
    mechanic,
    recipeKey,
    level,
    focus,
    isCorrupted,
    summary: '',
  };
  card.summary = formatCardSummary(card);
  return { card, stability, stabilityColor, formula };
}

/**
 * 升级卡牌等级（Lv.1→Lv.2→Lv.3→Lv.4），到达 Lv.3 自动觉醒连锁效果！
 */
export function upgradeCommandCard(card: CommandCard): boolean {
  const curLv = card.level ?? 1;
  if (curLv >= 4) return false;
  card.level = curLv + 1;
  card.durationMinutes += 2;
  if (card.passingDelta) card.passingDelta += 3;
  if (card.shootingDelta) card.shootingDelta += 3;
  if (card.defendingDelta) card.defendingDelta += 3;
  if (card.paceDelta) card.paceDelta += 3;
  if (card.goalkeepingDelta) card.goalkeepingDelta += 3;
  if (card.composureDelta) card.composureDelta += 2;
  if (card.fitnessInstantDelta) card.fitnessInstantDelta += 4;

  // 升至 Lv.3 时觉醒连锁效果；升至 Lv.4 时开放全队生效
  if (card.level === 3 && !card.chainEffect) {
    const idx = card.name.length % CHAIN_POOL.length;
    card.chainEffect = CHAIN_POOL[idx];
  }
  if (card.level >= 4) {
    card.targetLine = 'ALL';
  }
  card.summary = formatCardSummary(card);
  return true;
}

/**
 * 以卡融卡：将两张现有卡牌融合成高一阶卡牌（最高 Lv.4），继承较高数值并觉醒连锁
 */
export function fuseTwoCards(a: CommandCard, b: CommandCard): CommandCard {
  const nextLv = Math.min(4, Math.max(a.level ?? 1, b.level ?? 1) + 1);
  const chain = a.chainEffect || b.chainEffect || (nextLv >= 3 ? CHAIN_POOL[(a.name.length + b.name.length) % CHAIN_POOL.length] : undefined);
  const capFuse = (v: number) => (v > 0 ? Math.min(14, v) : undefined);
  const card: CommandCard = {
    id: `card_fuse_${++craftSeq}_${Date.now().toString(36)}`,
    name: `融合·${a.name.slice(0, 3)}${b.name.slice(0, 3)}`,
    cost: Math.min(3, Math.max(a.cost, b.cost)),
    durationMinutes: Math.max(a.durationMinutes, b.durationMinutes) + 2,
    targetLine: nextLv >= 4 ? 'ALL' : (a.targetLine === b.targetLine ? a.targetLine : 'MID'),
    passingDelta: capFuse((a.passingDelta ?? 0) + Math.ceil((b.passingDelta ?? 0) * 0.5)),
    shootingDelta: capFuse((a.shootingDelta ?? 0) + Math.ceil((b.shootingDelta ?? 0) * 0.5)),
    defendingDelta: capFuse((a.defendingDelta ?? 0) + Math.ceil((b.defendingDelta ?? 0) * 0.5)),
    paceDelta: capFuse((a.paceDelta ?? 0) + Math.ceil((b.paceDelta ?? 0) * 0.5)),
    composureDelta: capFuse((a.composureDelta ?? 0) + Math.ceil((b.composureDelta ?? 0) * 0.5)),
    goalkeepingDelta: capFuse((a.goalkeepingDelta ?? 0) + Math.ceil((b.goalkeepingDelta ?? 0) * 0.5)),
    fitnessInstantDelta: capFuse((a.fitnessInstantDelta ?? 0) + (b.fitnessInstantDelta ?? 0)),
    penaltyFitnessDelta: a.penaltyFitnessDelta || b.penaltyFitnessDelta,
    penaltyAllDefDelta: a.penaltyAllDefDelta || b.penaltyAllDefDelta,
    chainEffect: chain,
    recipeKey: [a.recipeKey, b.recipeKey].filter(Boolean).join('+'),
    level: nextLv,
    isCorrupted: !!(a.isCorrupted || b.isCorrupted),
    summary: '',
  };
  card.summary = formatCardSummary(card);
  return card;
}
