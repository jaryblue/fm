import type { DefenseSystem, FormationName, TacticalStyle } from '@fm-league/engine';
import type { V6FusionKeystoneDef, V6MasterySealDef, V6PassiveDef } from './types';

// ============================================================================
// 一、外环 48 条打法被动（6 打法 × 攻 4 / 守 4）
// ============================================================================

export const V6_STYLE_PASSIVES: V6PassiveDef[] = [
  // 传控渗透
  { id: 'ps_tt_a1', name: '短传节拍·原点', source: 'style', style: 'tiki_taka', tendency: 'ATK', tier: 'origin', unlockCost: 1, desc: '全队短传倾向+5%、传球+5/冷静+4', tacticalMod: { shortPassBias: 0.05 }, statDelta: { passing: 5, composure: 4 } },
  { id: 'ps_tt_a2', name: '肋部渗透眼', source: 'style', style: 'tiki_taka', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '中前场传球+5、直塞+4%、射门+4', tacticalMod: { throughPassBias: 0.04 }, statDelta: { targetLine: 'MID', passing: 5, shooting: 4 } },
  { id: 'ps_tt_a3', name: '传控造险大师', source: 'style', style: 'tiki_taka', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '前场造任意球×1.20', freeKickRateMul: 1.20 },
  { id: 'ps_tt_a4', name: '五连传校准', source: 'style', style: 'tiki_taka', tendency: 'ATK', tier: 'rare', unlockCost: 2, desc: '每连传5脚叠+1反击威能', hooks: [{ trigger: 'onPassStreak', streakTarget: 5, action: 'addCounter', value: 1 }] },
  { id: 'ps_tt_d1', name: '传控体能呼吸', source: 'style', style: 'tiki_taka', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '每连传6脚全队回体+1.5%', hooks: [{ trigger: 'onPassStreak', streakTarget: 6, action: 'healTeam', value: 1.5 }] },
  { id: 'ps_tt_d2', name: '抗压出球心脏', source: 'style', style: 'tiki_taka', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '防线与中场冷静+6', statDelta: { targetLine: 'DEF', composure: 6 } },
  { id: 'ps_tt_d3', name: '倒脚省力步伐', source: 'style', style: 'tiki_taka', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '全队体能消耗×0.92', tacticalMod: { staminaDrainMul: 0.92 } },
  { id: 'ps_tt_d4', name: '高控球压制', source: 'style', style: 'tiki_taka', tendency: 'DEF', tier: 'rare', unlockCost: 2, desc: '控球≥55%每分钟扣对手0.4%体能', hooks: [{ trigger: 'onPossessionTick', minPossession: 55, action: 'drainOppStamina', value: 0.4 }] },

  // 高位逼抢
  { id: 'ps_gp_a1', name: '高位压迫·原点', source: 'style', style: 'gegenpress', tendency: 'ATK', tier: 'origin', unlockCost: 1, desc: '逼抢半径+2m、防线前压+2', tacticalMod: { pressDistBonus: 2, lineShift: 2 } },
  { id: 'ps_gp_a2', name: '丢球瞬时提速', source: 'style', style: 'gegenpress', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '抢断成功触发3秒提速爆发', hooks: [{ trigger: 'onTackle', action: 'triggerMiniBuff', miniBuffPreset: 'tempo_burst', maxPerBuff: 3 }] },
  { id: 'ps_gp_a3', name: '禁区疯抢补射', source: 'style', style: 'gegenpress', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '禁区抢点+1、锋线射门+4', tacticalMod: { boxCrashBonus: 1 }, statDelta: { targetLine: 'ATT', shooting: 4 } },
  { id: 'ps_gp_a4', name: '前场断球必杀', source: 'style', style: 'gegenpress', tendency: 'ATK', tier: 'rare', unlockCost: 2, desc: '抢断成功叠+1反击威能', hooks: [{ trigger: 'onTackle', action: 'addCounter', value: 1 }] },
  { id: 'ps_gp_d1', name: '六秒三合围', source: 'style', style: 'gegenpress', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '解锁最多3人同时合围逼抢', tacticalMod: { extraPresser: true } },
  { id: 'ps_gp_d2', name: '压迫威慑场', source: 'style', style: 'gegenpress', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '抢断成功削弱对手节奏', hooks: [{ trigger: 'onTackle', action: 'stealTempo', value: 60 }] },
  { id: 'ps_gp_d3', name: '高压肺活量', source: 'style', style: 'gegenpress', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '全队体能消耗×0.90', tacticalMod: { staminaDrainMul: 0.90 } },
  { id: 'ps_gp_d4', name: '造越位协同', source: 'style', style: 'gegenpress', tendency: 'DEF', tier: 'rare', unlockCost: 2, desc: '造越位成功全主动技CD-1分', hooks: [{ trigger: 'onOffsideTrap', action: 'cutSkillCd', value: 1 }] },

  // 两翼齐飞
  { id: 'ps_wp_a1', name: '边路走廊·原点', source: 'style', style: 'wing_play', tendency: 'ATK', tier: 'origin', unlockCost: 1, desc: '传中+3%、边卫套上+1m、传球+3', tacticalMod: { crossBias: 0.03, overlapDepthBonus: 1 }, statDelta: { passing: 3 } },
  { id: 'ps_wp_a2', name: '角球制造机', source: 'style', style: 'wing_play', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '全场造角球倍率×1.25', cornerRateMul: 1.25 },
  { id: 'ps_wp_a3', name: '禁区双点包抄', source: 'style', style: 'wing_play', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '禁区抢点人数+1、锋线射门+4', tacticalMod: { boxCrashBonus: 1 }, statDelta: { targetLine: 'ATT', shooting: 4 } },
  { id: 'ps_wp_a4', name: '边路连线风暴', source: 'style', style: 'wing_play', tendency: 'ATK', tier: 'rare', unlockCost: 2, desc: '每次边路传中成功CD-1分', hooks: [{ trigger: 'onCross', action: 'cutSkillCd', value: 1 }] },
  { id: 'ps_wp_d1', name: '翼卫铁肺续航', source: 'style', style: 'wing_play', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '全队体能消耗×0.90', tacticalMod: { staminaDrainMul: 0.90 } },
  { id: 'ps_wp_d2', name: '边路协防封锁', source: 'style', style: 'wing_play', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '防线防守+4、封堵+6%', statDelta: { targetLine: 'DEF', defending: 4 }, blockBonus: 0.06 },
  { id: 'ps_wp_d3', name: '回追冲刺靴', source: 'style', style: 'wing_play', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '防线速度+4', statDelta: { targetLine: 'DEF', pace: 4 } },
  { id: 'ps_wp_d4', name: '边路断球反推', source: 'style', style: 'wing_play', tendency: 'DEF', tier: 'rare', unlockCost: 2, desc: '拦截成功触发3秒提速爆发', hooks: [{ trigger: 'onIntercept', action: 'triggerMiniBuff', miniBuffPreset: 'tempo_burst', maxPerBuff: 3 }] },

  // 快速反击
  { id: 'ps_ct_a1', name: '致命纵深·原点', source: 'style', style: 'counter', tendency: 'ATK', tier: 'origin', unlockCost: 1, desc: '直塞+3%、全队速度+3/传球+2', tacticalMod: { throughPassBias: 0.03 }, statDelta: { pace: 3, passing: 2 } },
  { id: 'ps_ct_a2', name: '反击第一脚加速', source: 'style', style: 'counter', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '锋线速度+4/传球+3', statDelta: { targetLine: 'ATT', pace: 4, passing: 3 } },
  { id: 'ps_ct_a3', name: '单刀大心脏', source: 'style', style: 'counter', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '锋线射门+4、冷静+6', statDelta: { targetLine: 'ATT', shooting: 4, composure: 6 } },
  { id: 'ps_ct_a4', name: '反击威能扩容', source: 'style', style: 'counter', tendency: 'ATK', tier: 'rare', unlockCost: 2, desc: '反击威能层数上限提至3层', maxCounterStacks: 3 },
  { id: 'ps_ct_d1', name: '低位回收步调', source: 'style', style: 'counter', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '防线防守+3、体能×0.90', tacticalMod: { staminaDrainMul: 0.90 }, statDelta: { targetLine: 'DEF', defending: 3 } },
  { id: 'ps_ct_d2', name: '中场预判雷达', source: 'style', style: 'counter', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '中场防守+4', statDelta: { targetLine: 'MID', defending: 4 } },
  { id: 'ps_ct_d3', name: '门神快发视野', source: 'style', style: 'counter', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '默认解锁门将手抛快发', tacticalMod: { gkQuickLaunch: true } },
  { id: 'ps_ct_d4', name: '扑救转反击', source: 'style', style: 'counter', tendency: 'DEF', tier: 'rare', unlockCost: 2, desc: '门将每次扑救叠+1反击威能', hooks: [{ trigger: 'onSave', action: 'addCounter', value: 1 }] },

  // 铁桶防反
  { id: 'ps_pb_a1', name: '死球专家团', source: 'style', style: 'park_bus', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '造角球与任意球×1.18', cornerRateMul: 1.18, freeKickRateMul: 1.18 },
  { id: 'ps_pb_a2', name: '前场高点牵制', source: 'style', style: 'park_bus', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '禁区抢点+1', tacticalMod: { boxCrashBonus: 1 } },
  { id: 'ps_pb_a3', name: '逆境铁血反扑', source: 'style', style: 'park_bus', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '失球时全主动技CD-2分', hooks: [{ trigger: 'onConcede', action: 'cutSkillCd', value: 2 }] },
  { id: 'ps_pb_a4', name: '角球必杀校射', source: 'style', style: 'park_bus', tendency: 'ATK', tier: 'rare', unlockCost: 2, desc: '赢得角球叠+1反击威能', hooks: [{ trigger: 'onCorner', action: 'addCounter', value: 1 }] },
  { id: 'ps_pb_d1', name: '铁壁防线·原点', source: 'style', style: 'park_bus', tendency: 'DEF', tier: 'origin', unlockCost: 1, desc: '防线深收-3、封堵+6%', tacticalMod: { lineShift: -3 }, blockBonus: 0.06 },
  { id: 'ps_pb_d2', name: '低位弹性城墙', source: 'style', style: 'park_bus', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '对手禁区射门xG-8%', oppShotXgPenalty: 0.08 },
  { id: 'ps_pb_d3', name: '门线战神光环', source: 'style', style: 'park_bus', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '门将扑救+6', statDelta: { targetLine: 'GK', goalkeeping: 6 } },
  { id: 'ps_pb_d4', name: '铁桶护盾起手', source: 'style', style: 'park_bus', tendency: 'DEF', tier: 'rare', unlockCost: 2, desc: '每场开局自带+1绝杀护盾', startingShields: 1 },

  // 均衡阵地
  { id: 'ps_bl_a1', name: '全能阵地·原点', source: 'style', style: 'balanced', tendency: 'ATK', tier: 'origin', unlockCost: 1, desc: '全队传球/防守/冷静+2', statDelta: { passing: 2, defending: 2, composure: 2 } },
  { id: 'ps_bl_a2', name: '铁人替补席', source: 'style', style: 'balanced', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '替补登场立即全队回体+3%', hooks: [{ trigger: 'onSubIn', action: 'healTeam', value: 3 }] },
  { id: 'ps_bl_a3', name: '弧顶远射准星', source: 'style', style: 'balanced', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '远射倾向+4%、射门+3', tacticalMod: { longShotBias: 0.04 }, statDelta: { shooting: 3 } },
  { id: 'ps_bl_a4', name: '弗格森时间', source: 'style', style: 'balanced', tendency: 'ATK', tier: 'rare', unlockCost: 2, desc: '射门时全主动技CD-1分', hooks: [{ trigger: 'onShot', action: 'cutSkillCd', value: 1 }] },
  { id: 'ps_bl_d1', name: '强心更衣室', source: 'style', style: 'balanced', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '全队冷静+4', statDelta: { composure: 4 } },
  { id: 'ps_bl_d2', name: '全天候适应力', source: 'style', style: 'balanced', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '全队体能消耗×0.92', tacticalMod: { staminaDrainMul: 0.92 } },
  { id: 'ps_bl_d3', name: '钢铁纪律素养', source: 'style', style: 'balanced', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '防线防守+4', statDelta: { targetLine: 'DEF', defending: 4 } },
  { id: 'ps_bl_d4', name: '中轴脊柱共振', source: 'style', style: 'balanced', tendency: 'DEF', tier: 'rare', unlockCost: 2, desc: '全队传球+4、冷静+4', statDelta: { passing: 4, composure: 4 } },
];

// ============================================================================
// 二、内环 44 条防线体系（12 条）+ 16 阵型被动（32 条）
// ============================================================================

export const V6_SYSTEM_PASSIVES: V6PassiveDef[] = [
  // 四后卫
  { id: 'sys_4_1', name: '四后卫体系·原点', source: 'system', system: '4-back', tendency: 'ATK', tier: 'origin', unlockCost: 1, desc: '边卫套上深度+2m', tacticalMod: { overlapDepthBonus: 2 } },
  { id: 'sys_4_2', name: '四卫平行越位线', source: 'system', system: '4-back', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '造越位成功叠+1反击威能', hooks: [{ trigger: 'onOffsideTrap', action: 'addCounter', value: 1 }] },
  { id: 'sys_4_3', name: '边卫轮转省体', source: 'system', system: '4-back', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '全队体能消耗×0.94', tacticalMod: { staminaDrainMul: 0.94 } },
  { id: 'sys_4_4', name: '四卫协同出球', source: 'system', system: '4-back', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '防线传球+4', statDelta: { targetLine: 'DEF', passing: 4 } },
  // 三后卫
  { id: 'sys_3_1', name: '三后卫体系·原点', source: 'system', system: '3-back', tendency: 'ATK', tier: 'origin', unlockCost: 1, desc: '解锁双翼卫同时套上', tacticalMod: { dualOverlap: true } },
  { id: 'sys_3_2', name: '双翼卫永动', source: 'system', system: '3-back', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '全队体能消耗×0.92', tacticalMod: { staminaDrainMul: 0.92 } },
  { id: 'sys_3_3', name: '三中卫稳健出球', source: 'system', system: '3-back', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '防线传球+6', statDelta: { targetLine: 'DEF', passing: 6 } },
  { id: 'sys_3_4', name: '翼卫走廊增益', source: 'system', system: '3-back', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '边路传中+4%、速度+3', tacticalMod: { crossBias: 0.04 }, statDelta: { targetLine: 'DEF', pace: 3 } },
  // 五后卫
  { id: 'sys_5_1', name: '五后卫体系·原点', source: 'system', system: '5-back', tendency: 'DEF', tier: 'origin', unlockCost: 1, desc: '禁区封堵+10%、门将默认快发', tacticalMod: { gkQuickLaunch: true }, blockBonus: 0.10 },
  { id: 'sys_5_2', name: '五人禁区铁闸', source: 'system', system: '5-back', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '开局自带+1绝杀护盾', startingShields: 1 },
  { id: 'sys_5_3', name: '五卫反击纵深', source: 'system', system: '5-back', tendency: 'ATK', tier: 'minor', unlockCost: 1, desc: '直塞倾向+4%', tacticalMod: { throughPassBias: 0.04 } },
  { id: 'sys_5_4', name: '门线零封素养', source: 'system', system: '5-back', tendency: 'DEF', tier: 'minor', unlockCost: 1, desc: '对手禁区xG-8%', oppShotXgPenalty: 0.08 },
];

const FORM_PASSIVE_TUPLES: Array<[FormationName, string, string, Partial<V6PassiveDef>, string, string, Partial<V6PassiveDef>]> = [
  ['4-3-3', '三叉戟肋部轮转', '前锋射门+4 · 前场指令+4分', { statDelta: { targetLine: 'ATT', shooting: 4 }, directiveDurationBonus: 4, directiveZoneBonus: 'ATT' }, '三叉前场反抢', '前场逼抢+2m', { tacticalMod: { pressDistBonus: 2 } }],
  ['4-2-3-1', '十号位手术刀', '中场传球+5 · 直塞+6%', { statDelta: { targetLine: 'MID', passing: 5 }, tacticalMod: { throughPassBias: 0.06 } }, '双后腰弧顶拦截', '中场防守+5', { statDelta: { targetLine: 'MID', defending: 5 } }],
  ['4-4-2', '双塔交叉做墙', '禁区抢点+1 · 前锋射门+4', { tacticalMod: { boxCrashBonus: 1 }, statDelta: { targetLine: 'ATT', shooting: 4 } }, '双层平行锁链', '防线防守+4', { statDelta: { targetLine: 'DEF', defending: 4 } }],
  ['4-1-2-1-2', '菱形中路撞墙', '短传+8% · 中场指令+4分', { tacticalMod: { shortPassBias: 0.08 }, directiveDurationBonus: 4, directiveZoneBonus: 'MID' }, '单腰菱形拖后', '中场防守+6', { statDelta: { targetLine: 'MID', defending: 6 } }],
  ['4-4-1-1', '影锋双区享益', '前锋与中场传球+4', { statDelta: { targetLine: 'MID', passing: 4 } }, '九人中低位省体', '体能消耗×0.90', { tacticalMod: { staminaDrainMul: 0.90 } }],
  ['4-1-4-1', '四中场后排插上', '禁区抢点+1 · 远射+5%', { tacticalMod: { boxCrashBonus: 1, longShotBias: 0.05 } }, '单腰扇形绞杀', '中场防守+5 · 逼抢+2m', { statDelta: { targetLine: 'MID', defending: 5 }, tacticalMod: { pressDistBonus: 2 } }],
  ['4-2-2-2', '双十号魔方造险', '造任意球×1.30 · 传球+4', { freeKickRateMul: 1.30, statDelta: { targetLine: 'MID', passing: 4 } }, '箱型中场锁', '防线防守+4', { statDelta: { targetLine: 'DEF', defending: 4 } }],
  ['4-3-2-1', '圣诞树弧顶重炮', '远射+8% · 射门+5', { tacticalMod: { longShotBias: 0.08 }, statDelta: { targetLine: 'MID', shooting: 5 } }, '三腰弧顶铁幕', '封堵率+10%', { blockBonus: 0.10 }],
  ['3-5-2', '双翼卫喂饼双锋', '传中+6% · 中场指令+5分', { tacticalMod: { crossBias: 0.06 }, directiveDurationBonus: 5, directiveZoneBonus: 'MID' }, '五中场人数压制', '中场防守+5', { statDelta: { targetLine: 'MID', defending: 5 } }],
  ['3-4-3', '五人宽幅前压', '锋线速度+4 · 前场指令+5分', { statDelta: { targetLine: 'ATT', pace: 4 }, directiveDurationBonus: 5, directiveZoneBonus: 'ATT' }, '三叉前场逼抢', '逼抢+3m', { tacticalMod: { pressDistBonus: 3 } }],
  ['3-4-2-1', '双影锋肋部连线', '中场传球+5 · 速度+4', { statDelta: { targetLine: 'MID', passing: 5, pace: 4 } }, '双腰三卫补防', '防线防守+5', { statDelta: { targetLine: 'DEF', defending: 5 } }],
  ['3-4-1-2', '十号直塞双箭头', '直塞+8% · 前锋冷静+5', { tacticalMod: { throughPassBias: 0.08 }, statDelta: { targetLine: 'ATT', composure: 5 } }, '三中卫扫荡锁', '防线防守+5 · 封堵+8%', { statDelta: { targetLine: 'DEF', defending: 5 }, blockBonus: 0.08 }],
  ['5-4-1', '单箭头反越位偷鸡', '前锋速度+6/冷静+6', { statDelta: { targetLine: 'ATT', pace: 6, composure: 6 } }, '九人铁桶大巴', '防线-3 · 后场指令+5分', { tacticalMod: { lineShift: -3 }, directiveDurationBonus: 5, directiveZoneBonus: 'DEF' }],
  ['5-3-2', '五卫快反双煞', '双锋速度+5 · 直塞+6%', { statDelta: { targetLine: 'ATT', pace: 5 }, tacticalMod: { throughPassBias: 0.06 } }, '五卫三腰封锁', '封堵率+8%', { blockBonus: 0.08 }],
  ['5-2-3', '后场长传找三叉戟', '前锋速度+5 · 传中+5%', { statDelta: { targetLine: 'ATT', pace: 5 }, tacticalMod: { crossBias: 0.05 } }, '断球提速三叉戟', '拦截成功触发3秒提速', { hooks: [{ trigger: 'onIntercept', action: 'triggerMiniBuff', miniBuffPreset: 'tempo_burst', maxPerBuff: 2 }] }],
  ['5-2-1-2', '前腰反击枢纽', '中场传球+6/冷静+5', { statDelta: { targetLine: 'MID', passing: 6, composure: 5 } }, '五卫菱形深防', '对手禁区xG-8%', { oppShotXgPenalty: 0.08 }],
];

export const V6_FORMATION_PASSIVES: V6PassiveDef[] = FORM_PASSIVE_TUPLES.flatMap(([fm, aName, aDesc, aPatch, dName, dDesc, dPatch]) => {
  const key = fm.replace(/-/g, '');
  return [
    { id: `pf_${key}_a`, name: aName, source: 'formation' as const, formation: fm, tendency: 'ATK' as const, tier: 'minor' as const, unlockCost: 1, desc: aDesc, ...aPatch },
    { id: `pf_${key}_d`, name: dName, source: 'formation' as const, formation: fm, tendency: 'DEF' as const, tier: 'minor' as const, unlockCost: 1, desc: dDesc, ...dPatch },
  ];
});

export const V6_ALL_PASSIVES: V6PassiveDef[] = [
  ...V6_STYLE_PASSIVES,
  ...V6_SYSTEM_PASSIVES,
  ...V6_FORMATION_PASSIVES,
];

export const V6_PASSIVE_MAP: Record<string, V6PassiveDef> = Object.fromEntries(
  V6_ALL_PASSIVES.map(p => [p.id, p])
);

// ============================================================================
// 三、18 个流派融合奇点（每个含 A/B 两条威能分支）
// ============================================================================

export const V6_FUSION_KEYSTONES: V6FusionKeystoneDef[] = [
  { id: 'fuse_4_tt', system: '4-back', style: 'tiki_taka', name: '梦三伪九传控', unlockCost: 3, royalDirectiveId: 'fu_4_tt',
    branchA: { choice: 'A', label: '伪九减CD', desc: '伪九回撤+8；每5连传CD-2分', tacticalMod: { falseNineDrop: 8 }, hooks: [{ trigger: 'onPassStreak', streakTarget: 5, action: 'cutSkillCd', value: 2 }] },
    branchB: { choice: 'B', label: '传控续航', desc: '全队体能消耗×0.85且6连传回体+2%', tacticalMod: { staminaDrainMul: 0.85 }, hooks: [{ trigger: 'onPassStreak', streakTarget: 6, action: 'healTeam', value: 2 }] } },
  { id: 'fuse_4_gp', system: '4-back', style: 'gegenpress', name: '重金属前场绞肉', unlockCost: 3, royalDirectiveId: 'fu_4_gp',
    branchA: { choice: 'A', label: '抢断核爆', desc: '每次抢断CD-3分且叠+1反击威能', hooks: [{ trigger: 'onTackle', action: 'cutSkillCd', value: 3 }, { trigger: 'onTackle', action: 'addCounter', value: 1 }] },
    branchB: { choice: 'B', label: '铁肺高压', desc: '全队高压体能消耗×0.78', tacticalMod: { staminaDrainMul: 0.78 } } },
  { id: 'fuse_4_wp', system: '4-back', style: 'wing_play', name: '双边卫走廊狂潮', unlockCost: 3, royalDirectiveId: 'fu_4_wp',
    branchA: { choice: 'A', label: '走廊蓄威', desc: '双边卫套上；每次传中叠+1反击(上限3)', tacticalMod: { dualOverlap: true }, maxCounterStacks: 3, hooks: [{ trigger: 'onCross', action: 'addCounter', value: 1 }] },
    branchB: { choice: 'B', label: '传中回气', desc: '每次传中或赢角球全队回体+2%', hooks: [{ trigger: 'onCross', action: 'healTeam', value: 2 }, { trigger: 'onCorner', action: 'healTeam', value: 2 }] } },
  { id: 'fuse_4_ct', system: '4-back', style: 'counter', name: '安氏猎豹防反', unlockCost: 3, royalDirectiveId: 'fu_4_ct',
    branchA: { choice: 'A', label: '神扑蓄威', desc: '扑救叠+1反击且4秒免越位', hooks: [{ trigger: 'onSave', action: 'addCounter', value: 1 }, { trigger: 'onSave', action: 'grantBypassOffside', value: 40 }] },
    branchB: { choice: 'B', label: '链式防反', desc: '拦截成功全主动技CD-2分', hooks: [{ trigger: 'onIntercept', action: 'cutSkillCd', value: 2 }] } },
  { id: 'fuse_4_pb', system: '4-back', style: 'park_bus', name: '钢铁四卫链式防', unlockCost: 3, royalDirectiveId: 'fu_4_pb',
    branchA: { choice: 'A', label: '封堵反击', desc: '门前封堵CD-3分且叠+1反击', hooks: [{ trigger: 'onBlock', action: 'cutSkillCd', value: 3 }, { trigger: 'onBlock', action: 'addCounter', value: 1 }] },
    branchB: { choice: 'B', label: '链式护盾', desc: '开局+1护盾；指令0失球再+1护盾', startingShields: 1, hooks: [{ trigger: 'onDirectiveEnd', requireZeroConceded: true, action: 'addShield', value: 1 }] } },
  { id: 'fuse_4_bl', system: '4-back', style: 'balanced', name: '全能中轴协奏曲', unlockCost: 3, royalDirectiveId: 'fu_4_bl',
    branchA: { choice: 'A', label: '中轴过载', desc: '装备主动技临时+1 Rank', skillTempRankBonus: 1 },
    branchB: { choice: 'B', label: '长效指令', desc: '所有三区指令持续时间+4分钟', directiveDurationBonus: 4 } },
  { id: 'fuse_3_tt', system: '3-back', style: 'tiki_taka', name: '瓜式 3-2-4-1 倒三角', unlockCost: 3, royalDirectiveId: 'fu_3_tt',
    branchA: { choice: 'A', label: '双质变觉醒', desc: '触发主动技时同时生效A+B双质变', skillDualBranch: true },
    branchB: { choice: 'B', label: '控球吸体', desc: '控球≥55%每分钟扣敌0.8%且回己0.4%', hooks: [{ trigger: 'onPossessionTick', minPossession: 55, action: 'drainOppStamina', value: 0.8 }, { trigger: 'onPossessionTick', minPossession: 55, action: 'healTeam', value: 0.4 }] } },
  { id: 'fuse_3_gp', system: '3-back', style: 'gegenpress', name: '三卫五人狂暴前压', unlockCost: 3, royalDirectiveId: 'fu_3_gp',
    branchA: { choice: 'A', label: '五人窒息', desc: '抢断削弱对手节奏6秒且叠+1反击', hooks: [{ trigger: 'onTackle', action: 'stealTempo', value: 60 }, { trigger: 'onTackle', action: 'addCounter', value: 1 }] },
    branchB: { choice: 'B', label: '三卫稳守', desc: '全队体能消耗×0.85', tacticalMod: { staminaDrainMul: 0.85 } } },
  { id: 'fuse_3_wp', system: '3-back', style: 'wing_play', name: '孔蒂双翼卫永动机', unlockCost: 3, royalDirectiveId: 'fu_3_wp',
    branchA: { choice: 'A', label: '传中减CD', desc: '每次传中CD-2分且禁区抢点+1', tacticalMod: { boxCrashBonus: 1 }, hooks: [{ trigger: 'onCross', action: 'cutSkillCd', value: 2 }] },
    branchB: { choice: 'B', label: '翼卫铁肺', desc: '全队体能消耗×0.80', tacticalMod: { staminaDrainMul: 0.80 } } },
  { id: 'fuse_3_ct', system: '3-back', style: 'counter', name: '三卫直刺反击刃', unlockCost: 3, royalDirectiveId: 'fu_3_ct',
    branchA: { choice: 'A', label: '三层威能', desc: '反击威能上限提至3层且直塞+8%', maxCounterStacks: 3, tacticalMod: { throughPassBias: 0.08 } },
    branchB: { choice: 'B', label: '拦截反越', desc: '中场拦截立即赋予4秒免越位', hooks: [{ trigger: 'onIntercept', action: 'grantBypassOffside', value: 40 }] } },
  { id: 'fuse_3_pb', system: '3-back', style: 'park_bus', name: '三塔禁区空霸阵', unlockCost: 3, royalDirectiveId: 'fu_3_pb',
    branchA: { choice: 'A', label: '三塔轰炸', desc: '禁区抢点+2且赢角球必射正', tacticalMod: { boxCrashBonus: 2 }, hooks: [{ trigger: 'onCorner', action: 'grantOnTarget', value: 50 }] },
    branchB: { choice: 'B', label: '三塔铁墙', desc: '门前封堵叠+1护盾(每场限2次)', hooks: [{ trigger: 'onBlock', action: 'addShield', value: 1 }] } },
  { id: 'fuse_3_bl', system: '3-back', style: 'balanced', name: '动态三后卫引擎', unlockCost: 3, royalDirectiveId: 'fu_3_bl',
    branchA: { choice: 'A', label: '换人进攻', desc: '每次换人延长指令+5分且+1反击', hooks: [{ trigger: 'onSubIn', action: 'extendDirective', value: 5 }, { trigger: 'onSubIn', action: 'addCounter', value: 1 }] },
    branchB: { choice: 'B', label: '换人稳守', desc: '每次换人+1护盾且全队回体+5%', hooks: [{ trigger: 'onSubIn', action: 'addShield', value: 1 }, { trigger: 'onSubIn', action: 'healTeam', value: 5 }] } },
  { id: 'fuse_5_tt', system: '5-back', style: 'tiki_taka', name: '后场倒脚反压迫', unlockCost: 3, royalDirectiveId: 'fu_5_tt',
    branchA: { choice: 'A', label: '四连减CD', desc: '每4连传全主动技CD-1分', hooks: [{ trigger: 'onPassStreak', streakTarget: 4, action: 'cutSkillCd', value: 1 }] },
    branchB: { choice: 'B', label: '免疫高压', desc: '彻底免疫对手高压抢断加成', immunityFlags: { immuneHighPressTackle: true } } },
  { id: 'fuse_5_gp', system: '5-back', style: 'gegenpress', name: '五盾中场绞肉网', unlockCost: 3, royalDirectiveId: 'fu_5_gp',
    branchA: { choice: 'A', label: '绞杀冲刺', desc: '抢断叠+1反击且触发3秒提速', hooks: [{ trigger: 'onTackle', action: 'addCounter', value: 1 }, { trigger: 'onTackle', action: 'triggerMiniBuff', miniBuffPreset: 'tempo_burst', maxPerBuff: 2 }] },
    branchB: { choice: 'B', label: '三卫兜底', desc: '高压体能消耗×0.82', tacticalMod: { staminaDrainMul: 0.82 } } },
  { id: 'fuse_5_wp', system: '5-back', style: 'wing_play', name: '五卫弹射双飞翼', unlockCost: 3, royalDirectiveId: 'fu_5_wp',
    branchA: { choice: 'A', label: '弹射进攻', desc: '双边卫套上+4m且传中叠+1反击', tacticalMod: { dualOverlap: true, overlapDepthBonus: 4 }, hooks: [{ trigger: 'onCross', action: 'addCounter', value: 1 }] },
    branchB: { choice: 'B', label: '回收成盾', desc: '指令结束自动叠+1绝杀护盾', hooks: [{ trigger: 'onDirectiveEnd', action: 'addShield', value: 1 }] } },
  { id: 'fuse_5_ct', system: '5-back', style: 'counter', name: '希腊神话大巴偷鸡', unlockCost: 3, royalDirectiveId: 'fu_5_ct',
    branchA: { choice: 'A', label: '大巴反咬', desc: '指令结束自动爆发5分钟高速反击', hooks: [{ trigger: 'onDirectiveEnd', action: 'triggerMiniBuff', miniBuffPreset: 'counter_burst' }] },
    branchB: { choice: 'B', label: '门神反打', desc: '扑救叠+1反击且CD-2分', hooks: [{ trigger: 'onSave', action: 'addCounter', value: 1 }, { trigger: 'onSave', action: 'cutSkillCd', value: 2 }] } },
  { id: 'fuse_5_pb', system: '5-back', style: 'park_bus', name: '绝对零封要塞', unlockCost: 3, royalDirectiveId: 'fu_5_pb',
    branchA: { choice: 'A', label: '双盾开局', desc: '开局自带2层绝杀护盾', startingShields: 2 },
    branchB: { choice: 'B', label: '零封回血', desc: '开局+1护盾；0失球回体+12%', startingShields: 1, hooks: [{ trigger: 'onDirectiveEnd', requireZeroConceded: true, action: 'healTeam', value: 12 }] } },
  { id: 'fuse_5_bl', system: '5-back', style: 'balanced', name: '五卫全能宗师冠', unlockCost: 3, royalDirectiveId: 'fu_5_bl',
    branchA: { choice: 'A', label: '主动升阶', desc: '全装备主动技临时+1 Rank', skillTempRankBonus: 1 },
    branchB: { choice: 'B', label: '万法归宗', desc: '解除全部跨流派指令契合惩罚', immunityFlags: { noCrossStylePenalty: true } } },
];

export const V6_FUSION_MAP: Record<string, V6FusionKeystoneDef> = Object.fromEntries(
  V6_FUSION_KEYSTONES.map(f => [f.id, f])
);

// ============================================================================
// 四、6 个护卫圆心的流派精通大节点（宗师印）
// ============================================================================

export const V6_MASTERY_SEALS: V6MasterySealDef[] = [
  { id: 'seal_tt', style: 'tiki_taka', name: '传控宗师印', unlockCost: 3, activeSkillId: 'sk_m_tt', desc: '解锁奥义《梦之队无限短传》；传控指令持续+5分', directiveDurationBonus: 5 },
  { id: 'seal_gp', style: 'gegenpress', name: '高压宗师印', unlockCost: 3, activeSkillId: 'sk_m_gp', desc: '解锁奥义《九十秒地狱窒息》；高压体能额外消耗-25%', staminaDiscount: 0.25 },
  { id: 'seal_wp', style: 'wing_play', name: '两翼宗师印', unlockCost: 3, activeSkillId: 'sk_m_wp', desc: '解锁奥义《两翼飓风无限传中》；造角球率再×1.20', cornerMulBonus: 1.20 },
  { id: 'seal_ct', style: 'counter', name: '反击宗师印', unlockCost: 3, activeSkillId: 'sk_m_ct', desc: '解锁奥义《十秒闪击一剑封喉》；每次抢断自动叠+1反击威能', hooks: [{ trigger: 'onTackle', action: 'addCounter', value: 1 }] },
  { id: 'seal_pb', style: 'park_bus', name: '铁桶宗师印', unlockCost: 3, activeSkillId: 'sk_m_pb', desc: '解锁奥义《圣西罗绝对零封墙》；每场开局额外+1绝杀护盾', startingShields: 1 },
  { id: 'seal_bl', style: 'balanced', name: '均衡宗师印', unlockCost: 3, activeSkillId: 'sk_m_bl', desc: '解锁奥义《银河战舰补时奇迹》；额外获得1次自由应急拍板权(+2 TP)', extraEmergencyCall: true },
];

export const V6_MASTERY_SEAL_MAP: Record<string, V6MasterySealDef> = Object.fromEntries(
  V6_MASTERY_SEALS.map(m => [m.id, m])
);
