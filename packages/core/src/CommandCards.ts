/**
 * 《再开一局》V5 战术卡牌与去元素化“卡合卡”化学反应釜核心
 * - 97 张高区分度卡（CardCatalog.ts 单一数据源）+ 15 条正/负/彩蛋异变词条
 * - 0 阶基础常备卡：永不消耗、不可入炉；1~2 阶消耗卡：仅剩耐久 ≥2 次可入炉
 * - 保留旧版导出签名以保证 Phase 4 UI 改造前全仓零报错构建
 */

import {
  CardAffix,
  CardGene,
  CardMechanic,
  CardTargetLine,
  CommandCardChain,
  CommandCardEffect,
  MatchState,
  TacticalStyle,
  TeamSide,
} from '../../engine/src/types';
import {
  CardTier,
  EASTER_EGG_AFFIXES,
  NEGATIVE_AFFIXES,
  POSITIVE_AFFIXES,
  V5_ALL_CARD_TEMPLATES,
  V5_BASE_CARDS,
  V5_CATALOG_MAP,
  V5_CHEMICAL_CARDS,
  V5_STYLE_CARDS,
  V5CardTemplate,
} from './CardCatalog';

export * from './CardCatalog';

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

export type ElementId = CardGene;
export type CraftFocus = 'balanced' | 'endure' | 'surge';

export interface ElementDef {
  id: ElementId;
  name: string;
  symbol: string;
  color: string;
  desc: string;
}

export const TACTICAL_ELEMENTS: ElementDef[] = [
  { id: 'press', name: '高压', symbol: 'Pr', color: '#EF4444', desc: '激进因子：逼抢/抢断/造越位，拉高爆发与负面风险' },
  { id: 'pass',  name: '短传', symbol: 'Ps', color: '#38BDF8', desc: '稳定剂：传控/默契/冷静，显著降低负面异变率' },
  { id: 'wing',  name: '边路', symbol: 'Wg', color: '#F59E0B', desc: '联动因子：宽度/速度/传中/造角球' },
  { id: 'iron',  name: '铁血', symbol: 'Fe', color: '#22C55E', desc: '中和剂：防守/扑救/体能，中和激进反噬' },
  { id: 'blitz', name: '奇袭', symbol: 'Bz', color: '#A855F7', desc: '催化剂：射门/直塞/远射/造任意球，拉高爆发与彩蛋率' },
];

export const GENE_LABELS: Record<CardGene, string> = {
  press: '高压',
  pass: '短传',
  wing: '边路',
  iron: '铁血',
  blitz: '奇袭',
};

export const STANCE_LABELS: Record<TacticalStyle, string> = {
  tiki_taka: '传控',
  gegenpress: '绞杀',
  wing_play: '两翼',
  counter: '防反',
  park_bus: '铁桶',
  balanced: '阵地',
};

export interface CommandCard extends CommandCardEffect {
  cost: number;              // 能量消耗 (0 ~ 3)
  summary: string;           // 简短效果说明
  recipeKey?: string;        // 基因分子式
  level: number;             // 兼容旧 UI：映射到 tier + 1 (1~4)
  focus?: CraftFocus;
  isCorrupted?: boolean;     // 兼容旧 UI：存在负面异变词条时为 true
  // V5 核心字段
  catalogId?: string;
  tier?: CardTier;           // 0=常备, 1=实用(3次), 2=王牌/神卡(2次), 3=传说(1次)
  gene?: CardGene;           // 5 色基因标
  styleTag?: TacticalStyle;  // 归属风格
  maxUses?: number;          // undefined 表示 0 阶永不消耗
  remainingUses?: number;    // 仅实际打出扣 1
  isBase?: boolean;
  isChemical?: boolean;
}

export const LINE_LABELS: Record<CardTargetLine, string> = {
  GK: '仅门将',
  DEF: '仅后卫线',
  MID: '仅中场线',
  ATT: '仅前锋线',
  ALL: '全队通用',
};

let cardInstanceSeq = 0;

export function getElementLabel(id: ElementId): string {
  return GENE_LABELS[id] ?? id;
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

export function instantiateV5Card(tpl: V5CardTemplate, affix?: CardAffix): CommandCard {
  const id = tpl.isBase
    ? (tpl.catalogId === 'card_captain_roar' ? 'card_captain_roar' : `v5_base_${tpl.catalogId}`)
    : `v5_${tpl.catalogId}_${++cardInstanceSeq}_${Date.now().toString(36)}`;
  const costDelta = affix?.costDelta ?? 0;
  const usesBonus = affix?.usesBonus ?? 0;
  const finalCost = Math.max(0, tpl.cost + costDelta);
  const finalMaxUses = tpl.maxUses !== undefined ? tpl.maxUses + usesBonus : undefined;
  const affixTag = affix ? ` [${affix.name}]` : '';

  const card: CommandCard = {
    ...tpl,
    id,
    cost: finalCost,
    element: tpl.gene,
    level: Math.min(4, tpl.tier + 1),
    maxUses: finalMaxUses,
    remainingUses: finalMaxUses,
    affix,
    isCorrupted: affix?.kind === 'negative',
    recipeKey: tpl.recipeGenes ? [...tpl.recipeGenes].sort().join('+') : tpl.gene,
    summary: `${tpl.summary}${affixTag}`,
  };
  return card;
}

export function getStyleBaseCards(style: TacticalStyle): CommandCard[] {
  return V5_BASE_CARDS
    .filter(c => c.styleTag === style)
    .map(tpl => instantiateV5Card(tpl));
}

export function createStarterCoachDeck(style: TacticalStyle = 'tiki_taka'): CommandCard[] {
  // V5：开局赠送 4 张当前风格 1 阶消耗卡 + 2 张跨风格 1 阶卡（基础 0 阶 4 张随风格自动带入）
  const sameStyle = V5_STYLE_CARDS.filter(c => c.styleTag === style && c.tier === 1).slice(0, 4);
  const otherStyle = V5_STYLE_CARDS.filter(c => c.styleTag !== style && c.tier === 1).slice(0, 2);
  return [...sameStyle, ...otherStyle].map(tpl => instantiateV5Card(tpl));
}

export function createCaptainRoarCard(): CommandCard {
  const tpl = V5_CATALOG_MAP.get('card_captain_roar') ?? V5_BASE_CARDS[V5_BASE_CARDS.length - 1];
  return instantiateV5Card(tpl);
}

/**
 * 按 60% 当前流派 + 40% 跨流派权重随机抽取 1~2 阶消耗卡（可选指定基因）
 */
export function rollStyleConsumableCard(
  style: TacticalStyle,
  tier: 1 | 2 = 1,
  preferredGene?: CardGene
): CommandCard {
  let pool = V5_STYLE_CARDS.filter(c => c.tier === tier);
  if (preferredGene) {
    const genePool = pool.filter(c => c.gene === preferredGene);
    if (genePool.length > 0) pool = genePool;
  }
  const samePool = pool.filter(c => c.styleTag === style);
  const pickSame = samePool.length > 0 && Math.random() < 0.65;
  const finalPool = pickSame ? samePool : pool;
  const tpl = finalPool[Math.floor(Math.random() * finalPool.length)] ?? V5_STYLE_CARDS[0];
  return instantiateV5Card(tpl);
}

/**
 * 统计出战卡组的主导基因色标（某基因 ≥4 张时触发卡组基因共鸣）
 */
export function computeDeckArchetypeGene(cards: CommandCard[]): CardGene | undefined {
  const counts: Record<CardGene, number> = { press: 0, pass: 0, wing: 0, iron: 0, blitz: 0 };
  for (const c of cards) {
    const g = inferCardElement(c);
    counts[g] = (counts[g] ?? 0) + 1;
  }
  let best: CardGene | undefined;
  let max = 0;
  for (const g of Object.keys(counts) as CardGene[]) {
    if (counts[g] > max) {
      max = counts[g];
      best = g;
    }
  }
  return max >= 4 ? best : undefined;
}

// ==================== V5 化学反应釜：实时预览 & 词条附魔 ====================

export interface ReactorAffixOdds {
  purePct: number;
  positivePct: number;
  negativePct: number;
  easterEggPct: number;
}

export interface ReactorPreview {
  valid: boolean;
  reason?: string;
  mode?: 'chemical_exact' | 'same_gene_tier2' | 'tier3_legend';
  targetCard?: V5CardTemplate;
  sameGenePool?: V5CardTemplate[];
  odds: ReactorAffixOdds;
  genes: CardGene[];
}

export function canCardEnterReactor(card: CommandCard): { ok: boolean; reason?: string } {
  const tier = card.tier ?? (card.isBase ? 0 : 1);
  if (card.isBase || tier === 0) {
    return { ok: false, reason: '0 阶基础常备卡不可投入反应釜' };
  }
  if (tier >= 3) {
    return { ok: false, reason: '3 阶传说神卡已达巅峰，不可再次入炉' };
  }
  const rem = card.remainingUses ?? card.maxUses ?? 0;
  if (rem < 2) {
    return { ok: false, reason: '剩余耐久不足 2 次（残血卡仅可打完或回收资金）' };
  }
  return { ok: true };
}

function computeReactorOdds(genes: CardGene[], isTier3: boolean): ReactorAffixOdds {
  const counts: Record<CardGene, number> = { press: 0, pass: 0, wing: 0, iron: 0, blitz: 0 };
  for (const g of genes) counts[g]++;

  // 同色 2 张 1 阶卡保底 0% 负面
  if (!isTier3 && genes.length === 2 && genes[0] === genes[1]) {
    return { purePct: 75, positivePct: 25, negativePct: 0, easterEggPct: 0 };
  }

  let neg = counts.press * 12 + counts.blitz * 14 - counts.pass * 14 - counts.iron * 12;
  if (counts.press > 0 && counts.iron > 0) neg += 8;
  if (isTier3) neg += 10;
  const negativePct = Math.max(0, Math.min(45, Math.round(neg)));

  const easterEggPct = isTier3
    ? Math.min(12, 6 + counts.blitz * 3)
    : Math.min(8, counts.blitz > 0 || counts.pass > 0 ? 5 : 3);

  const positivePct = Math.min(28, 16 + counts.pass * 4 + (isTier3 ? 4 : 0));
  const purePct = Math.max(15, 100 - negativePct - easterEggPct - positivePct);
  const sum = purePct + positivePct + negativePct + easterEggPct;
  const adjPure = purePct + (100 - sum);
  return { purePct: adjPure, positivePct, negativePct, easterEggPct };
}

function matchTier3Chemical(genes: CardGene[]): V5CardTemplate {
  const counts: Record<CardGene, number> = { press: 0, pass: 0, wing: 0, iron: 0, blitz: 0 };
  for (const g of genes) counts[g]++;
  if (counts.press + counts.blitz >= 2 && counts.blitz >= 1) {
    return V5_CATALOG_MAP.get('ch_doomsday_attack')!;
  }
  if (counts.pass >= 1 && counts.iron >= 1 && counts.wing >= 1) {
    return V5_CATALOG_MAP.get('ch_golden_chem')!;
  }
  return V5_CATALOG_MAP.get('ch_total_football')!;
}

export function previewReactor(cards: CommandCard[]): ReactorPreview {
  const emptyOdds: ReactorAffixOdds = { purePct: 100, positivePct: 0, negativePct: 0, easterEggPct: 0 };
  if (cards.length < 2 || cards.length > 3) {
    return { valid: false, reason: '请投入 2 或 3 张可入炉的消耗卡', odds: emptyOdds, genes: [] };
  }
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.id)) return { valid: false, reason: '不能重复投入同一张卡', odds: emptyOdds, genes: [] };
    seen.add(c.id);
    const chk = canCardEnterReactor(c);
    if (!chk.ok) return { valid: false, reason: chk.reason, odds: emptyOdds, genes: [] };
  }

  const genes = cards.map(c => inferCardElement(c));
  const tiers = cards.map(c => c.tier ?? 1);

  // 禁止 1张1阶 + 1张2阶 直接 2 卡合成
  if (cards.length === 2 && tiers[0] !== tiers[1]) {
    return {
      valid: false,
      reason: '1 阶与 2 阶混搭需再补 1 张卡（凑满 3 张合成 3 阶传说神卡）',
      odds: emptyOdds,
      genes,
    };
  }

  // 3 张消耗卡 或 2 张 2 阶卡 -> 3 阶传说神卡
  if (cards.length === 3 || (cards.length === 2 && tiers[0] === 2 && tiers[1] === 2)) {
    const target = matchTier3Chemical(genes);
    const odds = computeReactorOdds(genes, true);
    return { valid: true, mode: 'tier3_legend', targetCard: target, odds, genes };
  }

  // 2 张 1 阶卡：同色兜底 vs 异色精确化学神卡
  const sortedKey = [...genes].sort().join('+');
  if (genes[0] === genes[1]) {
    const pool = V5_STYLE_CARDS.filter(c => c.tier === 2 && c.gene === genes[0]);
    const fallbackPool = pool.length > 0 ? pool : V5_STYLE_CARDS.filter(c => c.tier === 2);
    const odds = computeReactorOdds(genes, false);
    return {
      valid: true,
      mode: 'same_gene_tier2',
      targetCard: fallbackPool[0],
      sameGenePool: fallbackPool,
      odds,
      genes,
    };
  }

  const exact = V5_CHEMICAL_CARDS.find(
    c => c.tier === 2 && c.recipeGenes && [...c.recipeGenes].sort().join('+') === sortedKey
  );
  const target =
    exact ??
    (sortedKey === 'pass+wing' ? V5_CATALOG_MAP.get('ch_wingback_wall')! : V5_CHEMICAL_CARDS[0]);
  const odds = computeReactorOdds(genes, false);
  return { valid: true, mode: 'chemical_exact', targetCard: target, odds, genes };
}

export function craftFromReactor(
  cards: CommandCard[],
  preferredSameGeneCatalogId?: string
): { ok: boolean; card?: CommandCard; affix?: CardAffix; reason?: string } {
  const prev = previewReactor(cards);
  if (!prev.valid || !prev.targetCard) {
    return { ok: false, reason: prev.reason || '当前组合无法发生化学反应' };
  }

  let tpl = prev.targetCard;
  if (prev.mode === 'same_gene_tier2' && prev.sameGenePool && prev.sameGenePool.length > 0) {
    const chosen = preferredSameGeneCatalogId
      ? prev.sameGenePool.find(c => c.catalogId === preferredSameGeneCatalogId)
      : undefined;
    tpl = chosen ?? prev.sameGenePool[Math.floor(Math.random() * prev.sameGenePool.length)];
  }

  // 按实时预览概率抽取异变词条
  const roll = Math.random() * 100;
  let affix: CardAffix | undefined;
  if (roll < prev.odds.easterEggPct) {
    affix = EASTER_EGG_AFFIXES[Math.floor(Math.random() * EASTER_EGG_AFFIXES.length)];
  } else if (roll < prev.odds.easterEggPct + prev.odds.positivePct) {
    affix = POSITIVE_AFFIXES[Math.floor(Math.random() * POSITIVE_AFFIXES.length)];
  } else if (roll < prev.odds.easterEggPct + prev.odds.positivePct + prev.odds.negativePct) {
    affix = NEGATIVE_AFFIXES[Math.floor(Math.random() * NEGATIVE_AFFIXES.length)];
  }

  const card = instantiateV5Card(tpl, affix);
  return { ok: true, card, affix };
}

// ==================== V5 局内时机减费判定（6~8 分钟宽容窗口） ====================

export function evaluateCardEffectiveCost(
  card: CommandCard,
  ms: MatchState,
  side: TeamSide,
  scoutResonant = false
): { cost: number; discounted: boolean; reason?: string } {
  const myGoals = side === 'home' ? ms.homeScore : ms.awayScore;
  const oppGoals = side === 'home' ? ms.awayScore : ms.homeScore;
  const mySubs = side === 'home' ? ms.homeSubsUsed : ms.awaySubsUsed;
  const oppForm = side === 'home' ? ms.awayFormation : ms.homeFormation;
  const myStats = ms.stats[side];
  const oppStats = ms.stats[side === 'home' ? 'away' : 'home'];
  const totPoss = myStats.possessionTicks + oppStats.possessionTicks || 1;
  const myPossPct = (myStats.possessionTicks / totPoss) * 100;
  const hasRed = ms.players.some(p => p.team === side && p.redCard);
  const lastConceded = ms.lastConcededMin?.[side] ?? -99;
  const lastSave = ms.lastSaveMin?.[side] ?? -99;
  const switches = ms.stanceSwitchCount?.[side] ?? 0;

  // 彩蛋词条：【弗格森时间】80' 后打出 0 费
  if (card.affix?.fergieTime && ms.minute >= 80) {
    return { cost: 0, discounted: true, reason: '弗格森时间 0 费' };
  }

  let discount = scoutResonant ? 1 : 0;
  let reason = scoutResonant ? '破绽共振 -1费' : undefined;

  if (card.timingCondition && (card.timingDiscount ?? 0) > 0) {
    let met = false;
    switch (card.timingCondition) {
      case 'trailing': met = myGoals < oppGoals; break;
      case 'leading': met = myGoals > oppGoals; break;
      case 'drawing': met = myGoals === oppGoals; break;
      case 'late_70_not_leading': met = ms.minute >= 70 && myGoals <= oppGoals; break;
      case 'late_70_leading': met = ms.minute >= 70 && myGoals > oppGoals; break;
      case 'late_75_leading': met = ms.minute >= 75 && myGoals > oppGoals; break;
      case 'late_75_drawing': met = ms.minute >= 75 && myGoals === oppGoals; break;
      case 'late_80_not_leading': met = ms.minute >= 80 && myGoals <= oppGoals; break;
      case 'late_65_lead_1': met = ms.minute >= 65 && myGoals - oppGoals === 1; break;
      case 'early_20': met = ms.minute <= 20; break;
      case 'after_60': met = ms.minute >= 60; break;
      case 'halftime_45_55': met = ms.minute >= 45 && ms.minute <= 55; break;
      case 'recent_conceded': met = ms.minute - lastConceded >= 0 && ms.minute - lastConceded <= 8; break;
      case 'recent_save': met = ms.minute - lastSave >= 0 && ms.minute - lastSave <= 7; break;
      case 'sub_used': met = mySubs >= 1; break;
      case 'sub_used_2': met = mySubs >= 2; break;
      case 'red_card': met = hasRed; break;
      case 'low_possession': met = myPossPct <= 45; break;
      case 'vs_5back': met = oppForm.startsWith('5-'); break;
      case 'bad_weather': met = !!ms.weather && ms.weather !== 'sunny'; break;
      case 'switched_stance_2': met = switches >= 2; break;
    }
    if (met) {
      discount += card.timingDiscount!;
      reason = '时机触发减费';
    }
  }

  const finalCost = Math.max(0, card.cost - discount);
  return { cost: finalCost, discounted: finalCost < card.cost, reason };
}

// ==================== 兼容旧 UI 导出（供 Phase 4 过渡前保持零报错） ====================

export function createInitialElements(): Record<ElementId, number> {
  return { press: 0, pass: 0, wing: 0, iron: 0, blitz: 0 };
}

export function formatCardSummary(card: Pick<CommandCard, 'summary' | 'durationMinutes'>): string {
  return card.summary || `${card.durationMinutes}分 战术指令`;
}

export function formatCardHumanIntent(card: Pick<CommandCard, 'summary' | 'mechanic' | 'targetLine'>): string {
  if (card.summary) return card.summary;
  if (card.mechanic && MECHANIC_LABELS[card.mechanic]) return MECHANIC_LABELS[card.mechanic];
  return '阶段性改变球队攻防偏好与场上属性';
}

export interface ChemistryPreview {
  card: CommandCard;
  stability: '稳定' | '双刃剑' | '高危反噬';
  stabilityColor: string;
  formula: string;
}

export function synthesizeChemistry(
  elements: ElementId[],
  _focus: CraftFocus = 'balanced',
  commit = false
): ChemistryPreview {
  const genes: CardGene[] = elements.length >= 2 ? elements.slice(0, 3) : [elements[0] ?? 'pass', elements[0] ?? 'pass'];
  const mockCards = genes.map((g, i) => ({
    ...instantiateV5Card(V5_STYLE_CARDS.find(c => c.gene === g && c.tier === 1) ?? V5_STYLE_CARDS[0]),
    id: `mock_${i}`,
  }));
  const prev = previewReactor(mockCards);
  const card = commit
    ? (craftFromReactor(mockCards).card ?? instantiateV5Card(V5_CHEMICAL_CARDS[0]))
    : instantiateV5Card(prev.targetCard ?? V5_CHEMICAL_CARDS[0]);
  const stability: ChemistryPreview['stability'] =
    prev.odds.negativePct >= 25 ? '高危反噬' : prev.odds.negativePct > 0 ? '双刃剑' : '稳定';
  const stabilityColor =
    stability === '高危反噬' ? '#EF4444' : stability === '双刃剑' ? '#F59E0B' : '#22C55E';
  return {
    card,
    stability,
    stabilityColor,
    formula: genes.map(getElementSymbol).join('·'),
  };
}

export function upgradeCommandCard(_card: CommandCard): boolean {
  return false;
}

export function fuseTwoCards(a: CommandCard, b: CommandCard): CommandCard {
  const res = craftFromReactor([a, b]);
  return res.card ?? instantiateV5Card(V5_CHEMICAL_CARDS[0]);
}

const VALID_ELEMENTS = new Set<CardGene>(['press', 'pass', 'wing', 'iron', 'blitz']);

export function inferCardElement(card: {
  gene?: CardGene;
  element?: CardGene;
  recipeKey?: string;
  mechanic?: CardMechanic;
}): CardGene {
  if (card.gene && VALID_ELEMENTS.has(card.gene)) return card.gene;
  if (card.element && VALID_ELEMENTS.has(card.element)) return card.element;
  if (card.recipeKey) {
    const first = card.recipeKey.split('+')[0] as CardGene;
    if (VALID_ELEMENTS.has(first)) return first;
  }
  switch (card.mechanic) {
    case 'high_press_blitz': return 'press';
    case 'wing_overload': return 'wing';
    case 'iron_wall_block':
    case 'offside_trap':
    case 'gk_counter_launch': return 'iron';
    case 'long_shot_cannon':
    case 'blood_frenzy':
    case 'set_piece_nuke': return 'blitz';
    default: return 'pass';
  }
}

export interface AdjacencySynergy {
  active: boolean;
  kind?: 'combo' | 'setup' | 'gene';
  label?: string;
  detail?: string;
  color?: string;
}

export function evaluateAdjacencySynergy(
  left: CommandCard,
  right: CommandCard,
  clubStyle: TacticalStyle
): AdjacencySynergy {
  const leftStance = left.stance ?? left.styleTag ?? clubStyle;
  if (
    right.comboRule &&
    (right.comboRule.anyStance ||
      right.affix?.anyStanceCombo ||
      right.comboRule.requiresStance === leftStance)
  ) {
    return {
      active: true,
      kind: 'combo',
      label: '连击',
      detail: right.comboRule.label || '态势连击触发增效',
      color: '#C084FC',
    };
  }
  const leftCreates = !!(
    left.tacticalMod?.cornerRateMul ||
    left.tacticalMod?.freeKickRateMul ||
    left.tacticalMod?.crossBias ||
    left.tacticalMod?.throughPassBias
  );
  const rightPayoff = !!(
    right.skillSynergy ||
    right.tacticalMod?.longShotBias ||
    right.tacticalMod?.setPieceXgMul ||
    right.tacticalMod?.boxCrashBonus ||
    (right.shootingDelta ?? 0) >= 6
  );
  if (leftCreates && rightPayoff) {
    return {
      active: true,
      kind: 'setup',
      label: '造势',
      detail: '造势后优先摸取并延长 +2 分',
      color: '#FACC15',
    };
  }
  if (inferCardElement(left) === inferCardElement(right)) {
    return {
      active: true,
      kind: 'gene',
      label: '共鸣',
      detail: '同基因串联 · 下张持续 +2 分',
      color: '#38BDF8',
    };
  }
  return { active: false };
}

export function pickStyleOnboardingCard(
  style: TacticalStyle,
  stage: 'combo' | 'timing' | 'skill',
  excludeCatalogIds?: Set<string>
): { card: CommandCard; tip: string; stage: 'combo' | 'timing' | 'skill'; openerName: string } | null {
  const baseCards = getStyleBaseCards(style);
  const openerName = baseCards[0]?.name ?? '主力态势卡';
  const stylePool = V5_STYLE_CARDS.filter(
    t => t.styleTag === style && !excludeCatalogIds?.has(t.catalogId)
  );
  const allPool = V5_STYLE_CARDS.filter(t => !excludeCatalogIds?.has(t.catalogId));

  let tpl: V5CardTemplate | undefined;
  let tip = '';
  if (stage === 'combo') {
    tpl =
      stylePool.find(t => !!t.comboRule) ??
      allPool.find(t => !!t.comboRule);
    if (tpl) {
      tip = `先打【${openerName}】切出态势，再打【${tpl.name}】即可触发【${tpl.comboRule?.label ?? '态势连击'}】！入队后会自动排在【${openerName}】后面。`;
    }
  } else if (stage === 'timing') {
    tpl =
      stylePool.find(t => !!t.timingCondition && !t.comboRule) ??
      stylePool.find(t => !!t.timingCondition) ??
      allPool.find(t => !!t.timingCondition);
    if (tpl) {
      tip = `开局先捏在手里别急着出！等场上满足条件时卡片会亮绿，此时点击即可【0 费白嫖】打出！`;
    }
  } else {
    tpl =
      stylePool.find(t => !!t.skillSynergy) ??
      allPool.find(t => !!t.skillSynergy);
    if (tpl) {
      tip = `在需要破局时打出【${tpl.name}】，可大幅加速弹出对应的子弹时间主动大招！`;
    }
  }

  if (!tpl) return null;
  return {
    card: instantiateV5Card(tpl),
    tip,
    stage,
    openerName,
  };
}
