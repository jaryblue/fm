/**
 * 《再开一局》V5 卡片体系完整单一数据源（97 张高区分度卡 + 15 条合成异变词条）
 * - 0 阶基础常备卡：25 张（6 大战术风格 × 4 张 + 序章传承卡《老队长的怒吼》），永不消耗、不可入炉
 * - 1~2 阶流派消耗卡：60 张（6 大风格 × 10 张：6 张 1 阶剩 3 次 + 4 张 2 阶剩 2 次），自带 5 色基因标
 * - 2~3 阶化学反应神卡：12 张（9 张 2 阶剩 2 次 + 3 张 3 阶传说剩 1 次），仅反应釜产出
 * - 15 条合成异变词条：5 正面超频 + 6 负面硬代价 + 4 稀有彩蛋
 */

import {
  CardAffix,
  CardGene,
  CommandCardEffect,
  TacticalStyle,
} from '../../engine/src/types';

export type CardTier = 0 | 1 | 2 | 3;

export interface V5CardTemplate extends Omit<CommandCardEffect, 'id'> {
  catalogId: string;
  tier: CardTier;
  gene: CardGene;
  styleTag?: TacticalStyle; // 归属流派（化学神卡/传承卡为 undefined）
  cost: number;
  maxUses?: number; // undefined 表示 0 阶永不消耗
  isBase?: boolean;
  isChemical?: boolean;
  recipeGenes?: CardGene[]; // 化学神卡的基因配方（无序匹配）
  summary: string;
}

// ==================== 一、15 条合成异变词条 ====================

export const V5_CARD_AFFIXES: CardAffix[] = [
  // 正面超频 (5)
  { id: 'af_pos_zero_cost', name: '零耗超频', kind: 'positive', desc: '本卡费用 -1（最低 0 费）', costDelta: -1 },
  { id: 'af_pos_extra_use', name: '持久续杯', kind: 'positive', desc: '本卡初始耐久 +1 次', usesBonus: 1 },
  { id: 'af_pos_innate', name: '开场先声', kind: 'positive', desc: '开球必在起手 3 张手牌内', innateOpeningHand: true },
  { id: 'af_pos_any_stance', name: '态势共鸣', kind: 'positive', desc: '任意态势下均可直接触发本卡连击', anyStanceCombo: true },
  { id: 'af_pos_refund', name: '回能虹吸', kind: 'positive', desc: '打出本卡后额外返还 1 费', energyRefundBonus: 1 },
  // 负面硬代价 (6，纯足球场上代价)
  { id: 'af_neg_cards', name: '红黄警告', kind: 'negative', desc: '生效期间全队犯规率 ×2.0（极易吃牌）', foulRateMul: 2.0 },
  { id: 'af_neg_fatigue', name: '体能透支', kind: 'negative', desc: '效果结束后全队体能 -14%', endFitnessPenalty: -14 },
  { id: 'af_neg_highline', name: '防线冒险', kind: 'negative', desc: '防线额外 +6m、后卫回追 -8', lineShiftDelta: 6, defPacePenalty: -8 },
  { id: 'af_neg_lonewolf', name: '狂躁独狼', kind: 'negative', desc: '生效期间全队传球与默契 -15', chemistryPenalty: -15 },
  { id: 'af_neg_heavy', name: '重甲沉滞', kind: 'negative', desc: '生效期间全队速度 -5', allPacePenalty: -5 },
  { id: 'af_neg_leaky', name: '赌命压迫', kind: 'negative', desc: '生效期间对手直塞渗透率 +20%', oppThroughPassBonus: 0.2 },
  // 稀有彩蛋奇遇 (4)
  { id: 'af_egg_pep', name: '瓜迪奥拉的笔记', kind: 'easter_egg', desc: '生效期间每 6 脚短传全队回体 +3%', passHealEvery6: 3 },
  { id: 'af_egg_fergie', name: '弗格森时间', kind: 'easter_egg', desc: '80\'后打出 0 费且属性加成翻倍', fergieTime: true },
  { id: 'af_egg_mou', name: '穆氏大巴玄学', kind: 'easter_egg', desc: '领先时打出，对手禁区内射门 xG -22%', mouBusLeading: true },
  { id: 'af_egg_clutch', name: '天选绝杀哨', kind: 'easter_egg', desc: '85\'后未领先打出，下次进前场立刻造定位球', clutchSetPiece85: true },
];

export const POSITIVE_AFFIXES = V5_CARD_AFFIXES.filter(a => a.kind === 'positive');
export const NEGATIVE_AFFIXES = V5_CARD_AFFIXES.filter(a => a.kind === 'negative');
export const EASTER_EGG_AFFIXES = V5_CARD_AFFIXES.filter(a => a.kind === 'easter_egg');

// ==================== 二、25 张 0 阶基础常备卡 ====================

export const V5_BASE_CARDS: V5CardTemplate[] = [
  // 传控渗透 (tiki_taka) 4 张
  {
    catalogId: 'b_tk_1', name: '控球主导', tier: 0, gene: 'pass', styleTag: 'tiki_taka', cost: 1, durationMinutes: 15, isBase: true,
    stance: 'tiki_taka', passingDelta: 4, composureDelta: 3,
    tacticalMod: { shortPassBias: 0.14, staminaDrainMul: 0.85 },
    summary: '15分 切【传控】 短传+20% 体耗-15% 传+4',
  },
  {
    catalogId: 'b_tk_2', name: '肋部直塞', tier: 0, gene: 'pass', styleTag: 'tiki_taka', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'MID', passingDelta: 5, tacticalMod: { throughPassBias: 0.14 },
    summary: '12分 直塞+15% 中场传球+5',
  },
  {
    catalogId: 'b_tk_3', name: '慢速回体', tier: 0, gene: 'pass', styleTag: 'tiki_taka', cost: 1, durationMinutes: 12, isBase: true,
    fitnessInstantDelta: 6, tacticalMod: { tempoMul: 0.85, staminaDrainMul: 0.85 },
    summary: '12分 节奏-15% 全队瞬回体能+6%',
  },
  {
    catalogId: 'b_tk_4', name: '三角共振', tier: 0, gene: 'pass', styleTag: 'tiki_taka', cost: 1, durationMinutes: 12, isBase: true,
    chemistryMod: { scope: 'spine', delta: 20 },
    comboRule: { requiresStance: 'tiki_taka', energyRefund: 1, label: '【传控】连击返1费' },
    summary: '12分 中轴默契+20 【传控】连击返1费',
  },

  // 高位逼抢 (gegenpress) 4 张
  {
    catalogId: 'b_gp_1', name: '高位合围', tier: 0, gene: 'press', styleTag: 'gegenpress', cost: 1, durationMinutes: 15, isBase: true,
    stance: 'gegenpress', defendingDelta: 4,
    tacticalMod: { lineShift: 5, pressDistBonus: 5, staminaDrainMul: 1.15 },
    summary: '15分 切【绞杀】 防线+5m 逼抢+5m 体耗+15%',
  },
  {
    catalogId: 'b_gp_2', name: '前场反抢', tier: 0, gene: 'press', styleTag: 'gegenpress', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'MID', paceDelta: 5, mechanic: 'high_press_blitz',
    summary: '12分 抢断率+12% 中前场速度+5',
  },
  {
    catalogId: 'b_gp_3', name: '造越位线', tier: 0, gene: 'press', styleTag: 'gegenpress', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'DEF', defendingDelta: 5, mechanic: 'offside_trap', tacticalMod: { lineShift: 3 },
    summary: '12分 防线+3m 触发造越位返1费',
  },
  {
    catalogId: 'b_gp_4', name: '快打旋风', tier: 0, gene: 'press', styleTag: 'gegenpress', cost: 1, durationMinutes: 12, isBase: true,
    tacticalMod: { tempoMul: 1.15 },
    comboRule: { requiresStance: 'gegenpress', extraShooting: 6, label: '【绞杀】连击前锋射+6' },
    summary: '12分 节奏+15% 【绞杀】连击前锋射+6',
  },

  // 两翼齐飞 (wing_play) 4 张
  {
    catalogId: 'b_wp_1', name: '拉开宽度', tier: 0, gene: 'wing', styleTag: 'wing_play', cost: 1, durationMinutes: 15, isBase: true,
    stance: 'wing_play', paceDelta: 5,
    tacticalMod: { widthScaleDelta: 0.12, crossBias: 0.14 },
    summary: '15分 切【两翼】 宽度+12% 传中+15% 速+5',
  },
  {
    catalogId: 'b_wp_2', name: '边卫套上', tier: 0, gene: 'wing', styleTag: 'wing_play', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'DEF', paceDelta: 5, tacticalMod: { overlapDepthBonus: 8, dualOverlap: true, crossBias: 0.10 },
    summary: '12分 双边卫套上+8m 传中+10%',
  },
  {
    catalogId: 'b_wp_3', name: '边路协防', tier: 0, gene: 'wing', styleTag: 'wing_play', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'DEF', defendingDelta: 5, tacticalMod: { blockBonus: 0.10 },
    summary: '12分 后卫防守+5 禁区封堵+10%',
  },
  {
    catalogId: 'b_wp_4', name: '下底造角', tier: 0, gene: 'wing', styleTag: 'wing_play', cost: 1, durationMinutes: 12, isBase: true,
    tacticalMod: { cornerRateMul: 1.35 },
    comboRule: { requiresStance: 'wing_play', extraBoxCrash: 1, label: '【两翼】连击禁区抢点+1人' },
    skillSynergy: { targetSkillTags: ['wing_overload', 'corner'], promptBonusRate: 0.2 },
    summary: '12分 造角球×1.35 【两翼】连击抢点+1人',
  },

  // 快速反击 (counter) 4 张
  {
    catalogId: 'b_ct_1', name: '诱敌深收', tier: 0, gene: 'blitz', styleTag: 'counter', cost: 1, durationMinutes: 15, isBase: true,
    stance: 'counter', defendingDelta: 4,
    tacticalMod: { lineShift: -5, throughPassBias: 0.14 },
    summary: '15分 切【防反】 防线-5m 直传+20% 防+4',
  },
  {
    catalogId: 'b_ct_2', name: '长传打身后', tier: 0, gene: 'blitz', styleTag: 'counter', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'ATT', paceDelta: 6, tacticalMod: { throughPassBias: 0.14 },
    summary: '12分 直塞+15% 前锋速度+6',
  },
  {
    catalogId: 'b_ct_3', name: '手抛快发', tier: 0, gene: 'iron', styleTag: 'counter', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'GK', mechanic: 'gk_counter_launch', tacticalMod: { gkQuickLaunch: true },
    timingCondition: 'recent_save', timingDiscount: 1,
    summary: '12分 门将快发xG+25% 扑救后0费',
  },
  {
    catalogId: 'b_ct_4', name: '单刀冷静', tier: 0, gene: 'blitz', styleTag: 'counter', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'ATT', composureDelta: 8,
    comboRule: { requiresStance: 'counter', extraShooting: 6, label: '【防反】连击前锋射+6' },
    summary: '12分 锋线冷静+8 【防反】连击射+6',
  },

  // 铁桶防反 (park_bus) 4 张
  {
    catalogId: 'b_pb_1', name: '全线退守', tier: 0, gene: 'iron', styleTag: 'park_bus', cost: 1, durationMinutes: 15, isBase: true,
    stance: 'park_bus', defendingDelta: 6,
    tacticalMod: { lineShift: -7, tempoMul: 0.85 },
    summary: '15分 切【铁桶】 防线-7m 节奏-15% 防+6',
  },
  {
    catalogId: 'b_pb_2', name: '大脚反击', tier: 0, gene: 'iron', styleTag: 'park_bus', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'GK', goalkeepingDelta: 6, tacticalMod: { gkQuickLaunch: true, throughPassBias: 0.14 },
    summary: '12分 直传+20% 门将扑救+6',
  },
  {
    catalogId: 'b_pb_3', name: '禁区封堵', tier: 0, gene: 'iron', styleTag: 'park_bus', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'DEF', defendingDelta: 5, mechanic: 'iron_wall_block',
    summary: '12分 禁区封堵+18% 后卫防+5',
  },
  {
    catalogId: 'b_pb_4', name: '铁闸拖耗', tier: 0, gene: 'iron', styleTag: 'park_bus', cost: 1, durationMinutes: 12, isBase: true,
    tacticalMod: { staminaDrainMul: 0.80, tempoMul: 0.88 },
    timingCondition: 'late_70_leading', timingDiscount: 1,
    summary: '12分 体耗-20% 70\'领先0费',
  },

  // 均衡阵地 (balanced) 4 张
  {
    catalogId: 'b_bl_1', name: '全线压上', tier: 0, gene: 'blitz', styleTag: 'balanced', cost: 1, durationMinutes: 15, isBase: true,
    stance: 'balanced', shootingDelta: 4, penaltyAllDefDelta: -2,
    tacticalMod: { lineShift: 6, shootBias: 0.20 },
    summary: '15分 切【阵地】 防线+6m 射门欲+20% 防-2',
  },
  {
    catalogId: 'b_bl_2', name: '稳步推进', tier: 0, gene: 'pass', styleTag: 'balanced', cost: 1, durationMinutes: 12, isBase: true,
    targetLine: 'MID', composureDelta: 6, tacticalMod: { shortPassBias: 0.10, throughPassBias: 0.10 },
    summary: '12分 短传/直塞各+10% 中场冷静+6',
  },
  {
    catalogId: 'b_bl_3', name: '呼吸调整', tier: 0, gene: 'iron', styleTag: 'balanced', cost: 1, durationMinutes: 10, isBase: true,
    fitnessInstantDelta: 8,
    summary: '10分 全队瞬回体能+8%',
  },
  {
    catalogId: 'b_bl_4', name: '换人激励', tier: 0, gene: 'wing', styleTag: 'balanced', cost: 1, durationMinutes: 15, isBase: true,
    mechanic: 'super_sub', timingCondition: 'sub_used', timingDiscount: 1,
    summary: '15分 替补全属性+6 已换人0费',
  },

  // 序章传承特卡 (1 张，0 阶常备)
  {
    catalogId: 'card_captain_roar', name: '老队长的怒吼', tier: 0, gene: 'blitz', cost: 1, durationMinutes: 15, isBase: true,
    paceDelta: 6, shootingDelta: 6, composureDelta: 10, fitnessInstantDelta: 10, mechanic: 'blood_frenzy',
    timingCondition: 'late_70_not_leading', timingDiscount: 1,
    summary: '15分 全队冷+10 射速+6 回体+10% 70\'未领先0费',
  },
];

// ==================== 三、60 张 1~2 阶六大流派消耗卡 ====================

export const V5_STYLE_CARDS: V5CardTemplate[] = [
  // ---------- 1. 传控渗透 (tiki_taka, 10 张) ----------
  {
    catalogId: 'tk_01', name: '伪九号回撤', tier: 1, gene: 'pass', styleTag: 'tiki_taka', cost: 1, maxUses: 3, durationMinutes: 15,
    passingDelta: 6, tacticalMod: { falseNineDrop: 10, throughPassBias: 0.12 },
    summary: '15分 中锋回撤+10m 直塞+12% 传+6',
  },
  {
    catalogId: 'tk_02', name: '弧顶造任意球', tier: 1, gene: 'blitz', styleTag: 'tiki_taka', cost: 1, maxUses: 3, durationMinutes: 15,
    tacticalMod: { freeKickRateMul: 1.65 },
    comboRule: { requiresStance: 'tiki_taka', extraXgBonus: 0.20, label: '【传控】连击定位球xG+20%' },
    skillSynergy: { targetSkillTags: ['freekick', 'attacking_final_third'], promptBonusRate: 0.3 },
    summary: '15分 造任意球×1.65 【传控】连击定位球xG+20%',
  },
  {
    catalogId: 'tk_03', name: '中轴灵魂共振', tier: 1, gene: 'pass', styleTag: 'tiki_taka', cost: 1, maxUses: 3, durationMinutes: 15,
    chemistryMod: { scope: 'spine', delta: 45, setTo100: true }, passingDelta: 6,
    summary: '15分 中轴脊柱默契直冲100 传+6',
  },
  {
    catalogId: 'tk_04', name: '远射解放', tier: 1, gene: 'blitz', styleTag: 'tiki_taka', cost: 1, maxUses: 3, durationMinutes: 15,
    mechanic: 'long_shot_cannon', tacticalMod: { longShotBias: 0.14 },
    summary: '15分 远射倾向+14% 远射xG+30%',
  },
  {
    catalogId: 'tk_05', name: '领先控球消磨', tier: 1, gene: 'pass', styleTag: 'tiki_taka', cost: 1, maxUses: 3, durationMinutes: 15,
    tacticalMod: { tempoMul: 0.75, shortPassBias: 0.14, staminaDrainMul: 0.78 },
    timingCondition: 'late_70_leading', timingDiscount: 1,
    summary: '15分 节奏-25% 短传控场 70\'领先0费',
  },
  {
    catalogId: 'tk_06', name: '丢球6秒反抢', tier: 1, gene: 'press', styleTag: 'tiki_taka', cost: 1, maxUses: 3, durationMinutes: 12,
    targetLine: 'MID', defendingDelta: 10, paceDelta: 6,
    timingCondition: 'recent_conceded', timingDiscount: 1,
    summary: '12分 中场抢断+10 速+6 刚丢球0费',
  },
  {
    catalogId: 'tk_07', name: '提速一脚出球', tier: 2, gene: 'pass', styleTag: 'tiki_taka', cost: 2, maxUses: 2, durationMinutes: 15,
    passingDelta: 10, tacticalMod: { tempoMul: 1.25, shortPassBias: 0.14 },
    comboRule: { requiresStance: 'tiki_taka', energyRefund: 1, label: '【传控】连击返1费' },
    summary: '15分 节奏+25% 传+10 【传控】连击返1费',
  },
  {
    catalogId: 'tk_08', name: '组织核心觉醒', tier: 2, gene: 'pass', styleTag: 'tiki_taka', cost: 2, maxUses: 2, durationMinutes: 15,
    starPlayerTarget: 'top_passer', passingDelta: 10, composureDelta: 10, mechanic: 'tiki_taka_flow',
    skillSynergy: { targetSkillTags: ['attacking_final_third'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '15分 传球核心全能+10 传控每6脚回体',
  },
  {
    catalogId: 'tk_09', name: '破铁桶耐心传导', tier: 2, gene: 'blitz', styleTag: 'tiki_taka', cost: 2, maxUses: 2, durationMinutes: 15,
    passingDelta: 8, shootingDelta: 8, tacticalMod: { longShotBias: 0.14, throughPassBias: 0.14 },
    timingCondition: 'vs_5back', timingDiscount: 1,
    summary: '15分 远射+直塞双拉满 对5后卫-1费',
  },
  {
    catalogId: 'tk_10', name: '传控艺术', tier: 2, gene: 'pass', styleTag: 'tiki_taka', cost: 2, maxUses: 2, durationMinutes: 18,
    passingDelta: 10, composureDelta: 8, chemistryMod: { scope: 'all', delta: 40, setTo100: true },
    summary: '18分 全队默契100 传+10 冷+8',
  },

  // ---------- 2. 高位逼抢 (gegenpress, 10 张) ----------
  {
    catalogId: 'gp_01', name: '开场闪击', tier: 1, gene: 'press', styleTag: 'gegenpress', cost: 1, maxUses: 3, durationMinutes: 15,
    paceDelta: 8, tacticalMod: { pressDistBonus: 6, tempoMul: 1.15 },
    timingCondition: 'early_20', timingDiscount: 1,
    summary: '15分 全队速+8 逼抢+6m 0\'~20\'0费',
  },
  {
    catalogId: 'gp_02', name: '就地反抢快打', tier: 1, gene: 'blitz', styleTag: 'gegenpress', cost: 1, maxUses: 3, durationMinutes: 12,
    mechanic: 'high_press_blitz', paceDelta: 7,
    comboRule: { requiresStance: 'gegenpress', energyRefund: 1, label: '【绞杀】连击返1费' },
    summary: '12分 抢断+12% 速+7 【绞杀】连击返1费',
  },
  {
    catalogId: 'gp_03', name: '边线陷阱', tier: 1, gene: 'wing', styleTag: 'gegenpress', cost: 1, maxUses: 3, durationMinutes: 15,
    defendingDelta: 7, oppDebuff: { oppFitnessDelta: -8 },
    summary: '15分 边路拦截 防+7 吸对手体能8%',
  },
  {
    catalogId: 'gp_04', name: '压迫造角', tier: 1, gene: 'wing', styleTag: 'gegenpress', cost: 1, maxUses: 3, durationMinutes: 15,
    tacticalMod: { pressDistBonus: 4, cornerRateMul: 1.55 },
    skillSynergy: { targetSkillTags: ['corner', 'midfield_press'], promptBonusRate: 0.25 },
    summary: '15分 高位迫使解围 造角球×1.55',
  },
  {
    catalogId: 'gp_05', name: '体能收割', tier: 1, gene: 'press', styleTag: 'gegenpress', cost: 1, maxUses: 3, durationMinutes: 15,
    paceDelta: 9, tacticalMod: { pressDistBonus: 5 },
    timingCondition: 'after_60', timingDiscount: 1,
    summary: '15分 全队速+9 逼抢+5m 60\'后0费',
  },
  {
    catalogId: 'gp_06', name: '丢球暴怒反扑', tier: 1, gene: 'press', styleTag: 'gegenpress', cost: 1, maxUses: 3, durationMinutes: 12,
    shootingDelta: 9, paceDelta: 7, tacticalMod: { lineShift: 6 },
    timingCondition: 'recent_conceded', timingDiscount: 1,
    summary: '12分 防线+6m 射+9 刚丢球0费',
  },
  {
    catalogId: 'gp_07', name: '窒息三人合围', tier: 2, gene: 'press', styleTag: 'gegenpress', cost: 2, maxUses: 2, durationMinutes: 15,
    defendingDelta: 9, mechanic: 'high_press_blitz',
    tacticalMod: { extraPresser: true, pressDistBonus: 8, staminaDrainMul: 1.35, foulRateMul: 1.30 },
    skillSynergy: { targetSkillTags: ['midfield_press'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '15分 3人合围 逼抢+8m 代价:体耗+35%/犯规×1.3',
  },
  {
    catalogId: 'gp_08', name: '中场绞肉机', tier: 2, gene: 'press', styleTag: 'gegenpress', cost: 2, maxUses: 2, durationMinutes: 15,
    targetLine: 'MID', defendingDelta: 12, oppDebuff: { oppComposureDelta: -8 },
    tacticalMod: { foulRateMul: 1.40 },
    summary: '15分 中场防+12 对手冷-8 代价:犯规×1.4',
  },
  {
    catalogId: 'gp_09', name: '连续高压波浪', tier: 2, gene: 'press', styleTag: 'gegenpress', cost: 2, maxUses: 2, durationMinutes: 15,
    paceDelta: 8, defendingDelta: 6,
    comboRule: { requiresStance: 'gegenpress', durationBonus: 6, label: '【绞杀】连击时长+6分' },
    summary: '15分 速+8 防+6 【绞杀】连击延长6分',
  },
  {
    catalogId: 'gp_10', name: '极限体能透支', tier: 2, gene: 'blitz', styleTag: 'gegenpress', cost: 2, maxUses: 2, durationMinutes: 15,
    paceDelta: 11, shootingDelta: 9, endFitnessPenalty: -14,
    summary: '15分 全队速+11 射+9 代价:结束体能-14%',
  },

  // ---------- 3. 两翼齐飞 (wing_play, 10 张) ----------
  {
    catalogId: 'wp_01', name: '边路强突造角', tier: 1, gene: 'wing', styleTag: 'wing_play', cost: 1, maxUses: 3, durationMinutes: 15,
    paceDelta: 7, tacticalMod: { crossBias: 0.14, cornerRateMul: 1.75 },
    comboRule: { requiresStance: 'wing_play', extraBoxCrash: 1, label: '【两翼】连击抢点+1人' },
    skillSynergy: { targetSkillTags: ['corner', 'wing_overload'], promptBonusRate: 0.35 },
    summary: '15分 造角球×1.75 【两翼】连击抢点+1人',
  },
  {
    catalogId: 'wp_02', name: '双边卫同步前插', tier: 1, gene: 'wing', styleTag: 'wing_play', cost: 1, maxUses: 3, durationMinutes: 15,
    paceDelta: 6, penaltyAllDefDelta: -4, tacticalMod: { overlapDepthBonus: 12, dualOverlap: true },
    summary: '15分 双侧套上+12m 代价:后卫防-4',
  },
  {
    catalogId: 'wp_03', name: '边锋内切轰门', tier: 1, gene: 'blitz', styleTag: 'wing_play', cost: 1, maxUses: 3, durationMinutes: 15,
    targetLine: 'ATT', shootingDelta: 10, tacticalMod: { longShotBias: 0.12 },
    summary: '15分 锋线射+10 远射倾向+12%',
  },
  {
    catalogId: 'wp_04', name: '双翼默契拉满', tier: 1, gene: 'pass', styleTag: 'wing_play', cost: 1, maxUses: 3, durationMinutes: 15,
    chemistryMod: { scope: 'wings', delta: 40 }, tacticalMod: { crossBias: 0.14 },
    summary: '15分 边路连线默契+40 传中+20%',
  },
  {
    catalogId: 'wp_05', name: '专打疲惫边卫', tier: 1, gene: 'wing', styleTag: 'wing_play', cost: 1, maxUses: 3, durationMinutes: 15,
    targetLine: 'ATT', paceDelta: 10, timingCondition: 'after_60', timingDiscount: 1,
    summary: '15分 边锋速+10 60\'后0费',
  },
  {
    catalogId: 'wp_06', name: '补时高球砸禁区', tier: 1, gene: 'blitz', styleTag: 'wing_play', cost: 1, maxUses: 3, durationMinutes: 12,
    shootingDelta: 8, tacticalMod: { lineShift: 8, boxCrashBonus: 2, crossBias: 0.14 },
    timingCondition: 'late_80_not_leading', timingDiscount: 1,
    summary: '12分 抢点+2人 防线+8m 80\'未领先0费',
  },
  {
    catalogId: 'wp_07', name: '高空轰炸禁区', tier: 2, gene: 'wing', styleTag: 'wing_play', cost: 2, maxUses: 2, durationMinutes: 15,
    mechanic: 'wing_overload', shootingDelta: 9,
    comboRule: { requiresStance: 'wing_play', energyRefund: 1, label: '【两翼】连击返1费' },
    summary: '15分 传中抢点+20% 射+9 【两翼】连击返1费',
  },
  {
    catalogId: 'wp_08', name: '边路爆点单挑', tier: 2, gene: 'wing', styleTag: 'wing_play', cost: 2, maxUses: 2, durationMinutes: 15,
    starPlayerTarget: 'fastest_winger', paceDelta: 12, shootingDelta: 8,
    tacticalMod: { freeKickRateMul: 1.40 },
    skillSynergy: { targetSkillTags: ['wing_overload'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '15分 最快边锋速+12 射+8 造任意球×1.4',
  },
  {
    catalogId: 'wp_09', name: '破大巴起球', tier: 2, gene: 'wing', styleTag: 'wing_play', cost: 2, maxUses: 2, durationMinutes: 15,
    mechanic: 'wing_overload', tacticalMod: { crossBias: 0.14, boxCrashBonus: 1 },
    timingCondition: 'vs_5back', timingDiscount: 1,
    summary: '15分 高空传中破密集 对5后卫-1费',
  },
  {
    catalogId: 'wp_10', name: '弧线传中风暴', tier: 2, gene: 'wing', styleTag: 'wing_play', cost: 2, maxUses: 2, durationMinutes: 18,
    passingDelta: 8, chemistryMod: { scope: 'wings', delta: 50, setTo100: true },
    tacticalMod: { crossBias: 0.14, cornerRateMul: 1.80 },
    summary: '18分 边路默契100 造角球×1.8 传+8',
  },

  // ---------- 4. 快速反击 (counter, 10 张) ----------
  {
    catalogId: 'ct_01', name: '门线神扑快反', tier: 1, gene: 'iron', styleTag: 'counter', cost: 1, maxUses: 3, durationMinutes: 15,
    targetLine: 'GK', goalkeepingDelta: 10, mechanic: 'gk_counter_launch',
    comboRule: { requiresStance: 'counter', extraPace: 8, label: '【防反】连击全队速+8' },
    summary: '15分 门将扑+10 快发xG+25% 【防反】连击速+8',
  },
  {
    catalogId: 'ct_02', name: '单刀冷静推射', tier: 1, gene: 'blitz', styleTag: 'counter', cost: 1, maxUses: 3, durationMinutes: 15,
    targetLine: 'ATT', composureDelta: 12, shootingDelta: 8,
    comboRule: { requiresStance: 'counter', energyRefund: 1, label: '【防反】连击返1费' },
    summary: '15分 锋线冷+12 射+8 【防反】连击返1费',
  },
  {
    catalogId: 'ct_03', name: '追风替补杀手', tier: 1, gene: 'wing', styleTag: 'counter', cost: 1, maxUses: 3, durationMinutes: 18,
    mechanic: 'super_sub', paceDelta: 8, timingCondition: 'sub_used', timingDiscount: 1,
    summary: '18分 替补全能+10 速+8 已换人0费',
  },
  {
    catalogId: 'ct_04', name: '惩罚压上', tier: 1, gene: 'blitz', styleTag: 'counter', cost: 1, maxUses: 3, durationMinutes: 15,
    paceDelta: 7, tacticalMod: { throughPassBias: 0.14 },
    timingCondition: 'leading', timingDiscount: 1,
    summary: '15分 直塞+25% 速+7 领先时0费',
  },
  {
    catalogId: 'ct_05', name: '绝杀反击号角', tier: 1, gene: 'blitz', styleTag: 'counter', cost: 1, maxUses: 3, durationMinutes: 15,
    targetLine: 'ATT', shootingDelta: 11, paceDelta: 9,
    timingCondition: 'late_75_drawing', timingDiscount: 1,
    summary: '15分 锋线射+11 速+9 75\'平局0费',
  },
  {
    catalogId: 'ct_06', name: '反击造任意球', tier: 1, gene: 'blitz', styleTag: 'counter', cost: 1, maxUses: 3, durationMinutes: 15,
    paceDelta: 6, tacticalMod: { freeKickRateMul: 1.65 },
    skillSynergy: { targetSkillTags: ['freekick', 'counter_opportunity'], promptBonusRate: 0.3 },
    summary: '15分 高速突破 造前场任意球×1.65',
  },
  {
    catalogId: 'ct_07', name: '铁血防反一击', tier: 2, gene: 'iron', styleTag: 'counter', cost: 2, maxUses: 2, durationMinutes: 15,
    targetLine: 'ATT', paceDelta: 10, shootingDelta: 10,
    tacticalMod: { lineShift: -6, throughPassBias: 0.14 },
    summary: '15分 防线-6m 直塞拉满 锋线射速+10',
  },
  {
    catalogId: 'ct_08', name: '控球劣势暴击', tier: 2, gene: 'blitz', styleTag: 'counter', cost: 2, maxUses: 2, durationMinutes: 15,
    paceDelta: 11, shootingDelta: 9, timingCondition: 'low_possession', timingDiscount: 1,
    summary: '15分 全队速+11 射+9 控球≤45%减1费',
  },
  {
    catalogId: 'ct_09', name: '黄金快马箭头', tier: 2, gene: 'wing', styleTag: 'counter', cost: 2, maxUses: 2, durationMinutes: 18,
    starPlayerTarget: 'fastest_striker', paceDelta: 14, shootingDelta: 10,
    tacticalMod: { staminaDrainMul: 0.78 },
    skillSynergy: { targetSkillTags: ['counter_opportunity'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '18分 最快前锋速+14 射+10 体耗降',
  },
  {
    catalogId: 'ct_10', name: '闪电反击大师', tier: 2, gene: 'blitz', styleTag: 'counter', cost: 2, maxUses: 2, durationMinutes: 18,
    defendingDelta: 8, paceDelta: 11, shootingDelta: 10, tacticalMod: { lineShift: -7, tempoMul: 1.20 },
    summary: '18分 防线-7m 全队防+8 射+10 速+11',
  },

  // ---------- 5. 铁桶防反 (park_bus, 10 张) ----------
  {
    catalogId: 'pb_01', name: '禁区铜墙铁壁', tier: 1, gene: 'iron', styleTag: 'park_bus', cost: 1, maxUses: 3, durationMinutes: 15,
    targetLine: 'DEF', defendingDelta: 10, mechanic: 'iron_wall_block',
    comboRule: { requiresStance: 'park_bus', extraGoalkeeping: 8, label: '【铁桶】连击门将扑+8' },
    summary: '15分 封堵+18% 后卫防+10 【铁桶】连击扑+8',
  },
  {
    catalogId: 'pb_02', name: '零封回气', tier: 1, gene: 'pass', styleTag: 'park_bus', cost: 1, maxUses: 3, durationMinutes: 15,
    composureDelta: 8,
    comboRule: { requiresStance: 'park_bus', energyRefund: 1, fitnessGain: 6, label: '【铁桶】连击返1费+回体6%' },
    summary: '15分 冷静+8 【铁桶】连击返1费+回体6%',
  },
  {
    catalogId: 'pb_03', name: '死守偷鸡角球', tier: 1, gene: 'iron', styleTag: 'park_bus', cost: 1, maxUses: 3, durationMinutes: 15,
    defendingDelta: 8, mechanic: 'set_piece_nuke', tacticalMod: { cornerRateMul: 1.35 },
    summary: '15分 防+8 定位球xG+35% 造角球×1.35',
  },
  {
    catalogId: 'pb_04', name: '少打一人铁血阵', tier: 1, gene: 'iron', styleTag: 'park_bus', cost: 1, maxUses: 3, durationMinutes: 18,
    defendingDelta: 14, tacticalMod: { staminaDrainMul: 0.75, lineShift: -6 },
    timingCondition: 'red_card', timingDiscount: 1,
    summary: '18分 全队防+14 体耗-25% 吃红牌0费',
  },
  {
    catalogId: 'pb_05', name: '一球领先锁胜', tier: 1, gene: 'iron', styleTag: 'park_bus', cost: 1, maxUses: 3, durationMinutes: 15,
    defendingDelta: 9, tacticalMod: { lineShift: -7, blockBonus: 0.20 },
    timingCondition: 'late_65_lead_1', timingDiscount: 1,
    summary: '15分 防线-7m 封堵+20% 65\'领先1球0费',
  },
  {
    catalogId: 'pb_06', name: '战术犯规止损', tier: 1, gene: 'press', styleTag: 'park_bus', cost: 1, maxUses: 3, durationMinutes: 15,
    targetLine: 'DEF', defendingDelta: 12, tacticalMod: { foulRateMul: 1.50 },
    summary: '15分 后卫抢断+12 代价:犯规×1.5',
  },
  {
    catalogId: 'pb_07', name: '大巴拖时间', tier: 2, gene: 'iron', styleTag: 'park_bus', cost: 2, maxUses: 2, durationMinutes: 15,
    defendingDelta: 10, tacticalMod: { lineShift: -8, tempoMul: 0.72, shootBias: -0.25 },
    timingCondition: 'late_75_leading', timingDiscount: 1,
    summary: '15分 防线-8m 节奏-28% 75\'领先-1费',
  },
  {
    catalogId: 'pb_08', name: '门神附体', tier: 2, gene: 'iron', styleTag: 'park_bus', cost: 2, maxUses: 2, durationMinutes: 15,
    targetLine: 'GK', goalkeepingDelta: 16, composureDelta: 12, fitnessInstantDelta: 6,
    skillSynergy: { targetSkillTags: ['box_danger'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '15分 门将扑+16 冷+12 全队回体+6%',
  },
  {
    catalogId: 'pb_09', name: '消耗战拖垮', tier: 2, gene: 'iron', styleTag: 'park_bus', cost: 2, maxUses: 2, durationMinutes: 18,
    tacticalMod: { staminaDrainMul: 0.72 }, oppDebuff: { oppFitnessDelta: -10 },
    summary: '18分 我方体耗-28% 削减对手体能10%',
  },
  {
    catalogId: 'pb_10', name: '链式防守', tier: 2, gene: 'iron', styleTag: 'park_bus', cost: 2, maxUses: 2, durationMinutes: 18,
    defendingDelta: 12, goalkeepingDelta: 12, chemistryMod: { scope: 'all', delta: 40, setTo100: true },
    summary: '18分 全队默契100 防+12 门将扑+12',
  },

  // ---------- 6. 均衡阵地 (balanced, 10 张) ----------
  {
    catalogId: 'bl_01', name: '弹性攻防', tier: 1, gene: 'pass', styleTag: 'balanced', cost: 1, maxUses: 3, durationMinutes: 15,
    defendingDelta: 6, shootingDelta: 6,
    summary: '15分 攻防一体 全队防+6 射+6',
  },
  {
    catalogId: 'bl_02', name: '跨态势变招', tier: 1, gene: 'pass', styleTag: 'balanced', cost: 1, maxUses: 3, durationMinutes: 15,
    passingDelta: 7, shootingDelta: 7, defendingDelta: 7,
    timingCondition: 'switched_stance_2', timingDiscount: 1,
    summary: '15分 全队传射防+7 切过≥2态势0费',
  },
  {
    catalogId: 'bl_03', name: '纪律碾压', tier: 1, gene: 'iron', styleTag: 'balanced', cost: 1, maxUses: 3, durationMinutes: 15,
    composureDelta: 10, tacticalMod: { foulRateMul: 0.55 },
    summary: '15分 犯规率-45% 全队冷静+10',
  },
  {
    catalogId: 'bl_04', name: '中场吹风机', tier: 1, gene: 'press', styleTag: 'balanced', cost: 1, maxUses: 3, durationMinutes: 15,
    fitnessInstantDelta: 10, shootingDelta: 6, passingDelta: 6,
    timingCondition: 'halftime_45_55', timingDiscount: 1,
    summary: '15分 回体+10% 射传+6 下半场初0费',
  },
  {
    catalogId: 'bl_05', name: '定位球演练', tier: 1, gene: 'wing', styleTag: 'balanced', cost: 1, maxUses: 3, durationMinutes: 15,
    mechanic: 'set_piece_nuke', tacticalMod: { cornerRateMul: 1.45, freeKickRateMul: 1.45 },
    summary: '15分 造角球&任意球×1.45 定位球xG+35%',
  },
  {
    catalogId: 'bl_06', name: '天气适应', tier: 1, gene: 'iron', styleTag: 'balanced', cost: 1, maxUses: 3, durationMinutes: 18,
    composureDelta: 8, tacticalMod: { staminaDrainMul: 0.80 },
    timingCondition: 'bad_weather', timingDiscount: 1,
    summary: '18分 体耗-20% 冷+8 恶劣天气0费',
  },
  {
    catalogId: 'bl_07', name: '核心无限开火权', tier: 2, gene: 'blitz', styleTag: 'balanced', cost: 2, maxUses: 2, durationMinutes: 15,
    starPlayerTarget: 'top_shooter', shootingDelta: 12, composureDelta: 8,
    tacticalMod: { shootBias: 0.25 },
    skillSynergy: { targetSkillTags: ['attacking_final_third'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '15分 头号射手射+12 冷+8 射门倾向+25%',
  },
  {
    catalogId: 'bl_08', name: '板凳深度压制', tier: 2, gene: 'wing', styleTag: 'balanced', cost: 2, maxUses: 2, durationMinutes: 18,
    mechanic: 'super_sub', paceDelta: 8, shootingDelta: 8,
    timingCondition: 'sub_used_2', timingDiscount: 1,
    summary: '18分 替补全能爆发 已换≥2人-1费',
  },
  {
    catalogId: 'bl_09', name: '逆风稳军心', tier: 2, gene: 'pass', styleTag: 'balanced', cost: 2, maxUses: 2, durationMinutes: 15,
    composureDelta: 12, passingDelta: 8, fitnessInstantDelta: 8,
    timingCondition: 'trailing', timingDiscount: 1,
    summary: '15分 冷+12 传+8 回体+8% 落后-1费',
  },
  {
    catalogId: 'bl_10', name: '全能控场', tier: 2, gene: 'pass', styleTag: 'balanced', cost: 2, maxUses: 2, durationMinutes: 18,
    passingDelta: 7, shootingDelta: 7, defendingDelta: 7, fitnessInstantDelta: 10,
    chemistryMod: { scope: 'all', delta: 40, setTo100: true },
    summary: '18分 全队默契100 传射防+7 回体+10%',
  },
];

// ==================== 四、12 张化学反应专属神卡（仅反应釜产出） ====================

export const V5_CHEMICAL_CARDS: V5CardTemplate[] = [
  // 9 张 2 阶跨流派化学神卡（2 张 1 阶卡合成，耐久 2 次）
  {
    catalogId: 'ch_pep_press', name: '瓜式反抢控球', tier: 2, gene: 'pass', cost: 2, maxUses: 2, durationMinutes: 16, isChemical: true,
    recipeGenes: ['pass', 'press'],
    passingDelta: 8, defendingDelta: 8, mechanic: 'tiki_taka_flow',
    tacticalMod: { pressDistBonus: 4, shortPassBias: 0.14 },
    skillSynergy: { targetSkillTags: ['attacking_final_third', 'midfield_press'], rankBoost: 1 },
    summary: '16分 传控回体+高位抢断 中场传防+8',
  },
  {
    catalogId: 'ch_klopp_wing', name: '克氏边路狂潮', tier: 2, gene: 'press', cost: 2, maxUses: 2, durationMinutes: 16, isChemical: true,
    recipeGenes: ['press', 'wing'],
    paceDelta: 10, mechanic: 'wing_overload', tacticalMod: { pressDistBonus: 6, crossBias: 0.14 },
    skillSynergy: { targetSkillTags: ['wing_overload', 'midfield_press'], rankBoost: 1 },
    summary: '16分 逼抢+6m 边路传中抢点+20% 速+10',
  },
  {
    catalogId: 'ch_ancelotti_counter', name: '安氏防反艺术', tier: 2, gene: 'iron', cost: 2, maxUses: 2, durationMinutes: 16, isChemical: true,
    recipeGenes: ['iron', 'blitz'],
    defendingDelta: 8, shootingDelta: 8, mechanic: 'gk_counter_launch',
    tacticalMod: { lineShift: -5, throughPassBias: 0.14 },
    skillSynergy: { targetSkillTags: ['counter_opportunity'], rankBoost: 1 },
    summary: '16分 防线-5m 门将快发xG+25% 直塞拉满',
  },
  {
    catalogId: 'ch_wingback_wall', name: '翼卫狂飙防线', tier: 2, gene: 'wing', cost: 2, maxUses: 2, durationMinutes: 16, isChemical: true,
    recipeGenes: ['iron', 'wing'],
    defendingDelta: 8, paceDelta: 8, tacticalMod: { overlapDepthBonus: 12, dualOverlap: true, cornerRateMul: 1.50 },
    summary: '16分 后卫防+8 双边卫套上+12m 造角球×1.5',
  },
  {
    catalogId: 'ch_longshot_banger', name: '禁区外世界波', tier: 2, gene: 'blitz', cost: 2, maxUses: 2, durationMinutes: 16, isChemical: true,
    recipeGenes: ['pass', 'blitz'],
    shootingDelta: 9, mechanic: 'long_shot_cannon', tacticalMod: { longShotBias: 0.14 },
    summary: '16分 远射倾向+20% 远射xG+30% 射+9',
  },
  {
    catalogId: 'ch_setpiece_factory', name: '定位球制造机', tier: 2, gene: 'wing', cost: 2, maxUses: 2, durationMinutes: 16, isChemical: true,
    recipeGenes: ['wing', 'blitz'],
    mechanic: 'set_piece_nuke', tacticalMod: { cornerRateMul: 1.70, freeKickRateMul: 1.70 },
    skillSynergy: { targetSkillTags: ['corner', 'freekick'], promptBonusRate: 0.4, freeCooldownOnce: true },
    summary: '16分 造角球×1.7 造任意球×1.7 定位球xG+35%',
  },
  {
    catalogId: 'ch_offside_psych', name: '心理窒息防线', tier: 2, gene: 'press', cost: 2, maxUses: 2, durationMinutes: 16, isChemical: true,
    recipeGenes: ['iron', 'press'],
    defendingDelta: 9, mechanic: 'offside_trap', oppDebuff: { oppComposureDelta: -8 },
    summary: '16分 造越位返1费 防+9 对手冷静-8',
  },
  {
    catalogId: 'ch_stamina_engine', name: '体能永动机', tier: 2, gene: 'iron', cost: 2, maxUses: 2, durationMinutes: 18, isChemical: true,
    recipeGenes: ['iron', 'pass'],
    fitnessInstantDelta: 14, paceDelta: 6, tacticalMod: { staminaDrainMul: 0.70 },
    summary: '18分 全队瞬回体能+14% 体耗-30% 速+6',
  },
  {
    catalogId: 'ch_final_ten_blitz', name: '最后十分钟狂攻', tier: 2, gene: 'blitz', cost: 2, maxUses: 2, durationMinutes: 15, isChemical: true,
    recipeGenes: ['press', 'blitz'],
    shootingDelta: 11, paceDelta: 9, penaltyAllDefDelta: -5, endFitnessPenalty: -8,
    tacticalMod: { lineShift: 8, shootBias: 0.30 },
    timingCondition: 'late_70_not_leading', timingDiscount: 1,
    summary: '15分 70\'未领先-1费 防线+8m 射+11 速+9(防-5/体-8%)',
  },

  // 3 张 3 阶传说神卡（3 张卡或 2 张 2 阶卡合成，耐久 1 次）
  {
    catalogId: 'ch_golden_chem', name: '黄金化学反应', tier: 3, gene: 'pass', cost: 3, maxUses: 1, durationMinutes: 20, isChemical: true,
    recipeGenes: ['pass', 'iron', 'wing'],
    passingDelta: 9, shootingDelta: 9, defendingDelta: 9, composureDelta: 9,
    chemistryMod: { scope: 'all', delta: 60, setTo100: true },
    comboRule: { anyStance: true, energyRefund: 1, label: '任意态势连击返1费' },
    skillSynergy: { targetSkillTags: ['all'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '20分 [传说] 全队默契100 全属性+9 返1费',
  },
  {
    catalogId: 'ch_total_football', name: '全能战术大师', tier: 3, gene: 'wing', cost: 3, maxUses: 1, durationMinutes: 20, isChemical: true,
    recipeGenes: ['pass', 'iron', 'press'],
    passingDelta: 9, shootingDelta: 9, defendingDelta: 9, paceDelta: 9, fitnessInstantDelta: 10,
    tacticalMod: { cornerRateMul: 1.50, freeKickRateMul: 1.50 },
    skillSynergy: { targetSkillTags: ['all'], promptBonusRate: 0.35, rankBoost: 1 },
    summary: '20分 [传说] 全队全属性+9 造定位球×1.5 回体+10%',
  },
  {
    catalogId: 'ch_doomsday_attack', name: '末日总攻令', tier: 3, gene: 'blitz', cost: 3, maxUses: 1, durationMinutes: 20, isChemical: true,
    recipeGenes: ['press', 'blitz', 'blitz'],
    shootingDelta: 13, paceDelta: 12, penaltyAllDefDelta: -7, endFitnessPenalty: -12,
    tacticalMod: { lineShift: 8, pressDistBonus: 8, shootBias: 0.35 },
    skillSynergy: { targetSkillTags: ['attacking_final_third', 'trailing_late'], freeCooldownOnce: true, rankBoost: 1 },
    summary: '20分 [传说] 射+13 速+12 逼抢+8m (防-7/体-12%)',
  },
];

export const V5_ALL_CARD_TEMPLATES: V5CardTemplate[] = [
  ...V5_BASE_CARDS,
  ...V5_STYLE_CARDS,
  ...V5_CHEMICAL_CARDS,
];

export const V5_CATALOG_MAP = new Map<string, V5CardTemplate>(
  V5_ALL_CARD_TEMPLATES.map(t => [t.catalogId, t])
);
