/**
 * 教练「三大防线体系 × 16 阵型 × 六大战术流派」百节点融合技能星图 (共 124 节点)
 * - 支持极坐标自动拓扑、双向连通校验、体系共鸣(×2)与 MatchEngine 行为修正因子输出
 */

import { getDefenseSystem } from '../../engine/src/formations';
import {
  ActiveSkillSituation,
  CommandCardEffect,
  DefenseSystem,
  EquippedActiveSkill,
  FormationName,
  PlayerRole,
  TacticalMods,
  TacticalStyle,
} from '../../engine/src/types';

export type SkillNodeKind =
  | 'origin'      // 6大战术原点 + 3大防线体系原点
  | 'formation'   // 16个具体阵型专精节点
  | 'fusion'      // 18个「防线体系 × 战术流派」融合奇点 (匹配当前体系+战术时 ×2 共鸣)
  | 'keystone'    // 6个跨流派奇点 + 1个中心终极核心
  | 'path';       // 74个路径/桥梁小节点（含行为修正因子）

export interface SkillEffect {
  passing?: number;
  shooting?: number;
  dribbling?: number;
  pace?: number;
  defending?: number;
  positioning?: number;
  composure?: number;
  stamina?: number;
  goalkeeping?: number;
  strength?: number;
}

export interface ActiveSkillDef {
  name: string;
  situation: ActiveSkillSituation;
  situationLabel: string;
  minFamiliarity: number;
  minChemistry: number;
  cooldownMinutes: number;
  maxPerMatch: number;
  durationMinutes: number;
  powerLabel: string;
  effect: Omit<CommandCardEffect, 'id' | 'name' | 'durationMinutes'>;
}

export interface SkillWebNode {
  id: string;
  name: string;
  kind: SkillNodeKind;
  cost: number;
  nx: number; // 归一化坐标 0..1
  ny: number;
  color: string;
  styleTag?: TacticalStyle;
  systemTag?: DefenseSystem;
  formationTag?: FormationName;
  targetRoles?: PlayerRole[];
  desc: string;
  effect: SkillEffect;
  mods?: TacticalMods;
  activeSkill?: ActiveSkillDef;
  neighbors: string[];
}

function ptAt(angleDeg: number, radius: number): { nx: number; ny: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    nx: Math.round((0.5 + Math.cos(rad) * radius) * 1000) / 1000,
    ny: Math.round((0.5 + Math.sin(rad) * radius) * 1000) / 1000,
  };
}

function lerpPt(a: { nx: number; ny: number }, b: { nx: number; ny: number }, t: number) {
  return {
    nx: Math.round((a.nx + (b.nx - a.nx) * t) * 1000) / 1000,
    ny: Math.round((a.ny + (b.ny - a.ny) * t) * 1000) / 1000,
  };
}

const STYLE_ANGLES: Record<TacticalStyle, { angle: number; name: string; color: string; originId: string; desc: string; eff: SkillEffect; mods: TacticalMods }> = {
  gegenpress: {
    angle: -90, name: '高压原点', color: '#EF4444', originId: 'ori_press',
    desc: '高位逼抢起点：全队 速度+2 防守+1，逼抢半径 +2m',
    eff: { pace: 2, defending: 1 }, mods: { pressDistBonus: 2 },
  },
  wing_play: {
    angle: -30, name: '两翼原点', color: '#F59E0B', originId: 'ori_wing',
    desc: '两翼齐飞起点：全队 速度+2 传球+1，边卫套上深度 +3m',
    eff: { pace: 2, passing: 1 }, mods: { overlapDepthBonus: 3 },
  },
  counter: {
    angle: 30, name: '反击原点', color: '#A855F7', originId: 'ori_counter',
    desc: '快速反击起点：全队 速度+2 射门+1，直塞倾向小幅提升',
    eff: { pace: 2, shooting: 1 }, mods: { throughPassBias: 0.03 },
  },
  park_bus: {
    angle: 90, name: '铁桶原点', color: '#22C55E', originId: 'ori_bus',
    desc: '铁桶防反起点：全队 防守+2 冷静+1，防线深收 -2m',
    eff: { defending: 2, composure: 1 }, mods: { lineShift: -2 },
  },
  balanced: {
    angle: 150, name: '均衡原点', color: '#2DD4BF', originId: 'ori_bal',
    desc: '均衡阵地起点：全队 传球+1 防守+1 体能+2',
    eff: { passing: 1, defending: 1, stamina: 2 }, mods: { staminaDrainMul: 0.96 },
  },
  tiki_taka: {
    angle: -150, name: '传控原点', color: '#38BDF8', originId: 'ori_tiki',
    desc: '传控渗透起点：全队 传球+2 盘带+1，短传倾向提升',
    eff: { passing: 2, dribbling: 1 }, mods: { shortPassBias: 0.03 },
  },
};

const SYSTEM_META: Record<DefenseSystem, { angle: number; name: string; color: string; desc: string; eff: SkillEffect; mods: TacticalMods }> = {
  '4-back': {
    angle: -90, name: '四后卫体系', color: '#60A5FA',
    desc: '四后卫主干：边卫与中卫均衡联动，全队 选位+2 传球+1',
    eff: { positioning: 2, passing: 1 }, mods: { overlapDepthBonus: 2 },
  },
  '3-back': {
    angle: 30, name: '三后卫体系', color: '#F472B6',
    desc: '三后卫主干：翼卫大范围往返，中场控制强化（体能+3 速度+1）',
    eff: { stamina: 3, pace: 1 }, mods: { boxCrashBonus: 1 },
  },
  '5-back': {
    angle: 150, name: '五后卫体系', color: '#34D399',
    desc: '五后卫主干：禁区防线厚度拉满，全队 防守+2 门将+2',
    eff: { defending: 2, goalkeeping: 2 }, mods: { lineShift: -2 },
  },
};

const FORMATION_SPECS: Array<{
  f: FormationName;
  sys: DefenseSystem;
  angle: number;
  roles: PlayerRole[];
  desc: string;
  eff: SkillEffect;
  mods?: TacticalMods;
}> = [
  // 4-back (8)
  { f: '4-3-3', sys: '4-back', angle: -135, roles: ['LW', 'RW', 'CM'], desc: '三叉戟与8号位肋部穿插（使用 4-3-3 时效果×2）', eff: { passing: 2, pace: 2 }, mods: { overlapDepthBonus: 2 } },
  { f: '4-2-3-1', sys: '4-back', angle: -115, roles: ['CDM', 'CAM'], desc: '双后腰屏障解放10号位（使用 4-2-3-1 时效果×2）', eff: { passing: 2, composure: 2 }, mods: { throughPassBias: 0.03 } },
  { f: '4-4-2', sys: '4-back', angle: -95, roles: ['ST', 'LM', 'RM'], desc: '双前锋搭档与平行四中场（使用 4-4-2 时效果×2）', eff: { shooting: 2, stamina: 2 }, mods: { crossBias: 0.03 } },
  { f: '4-1-2-1-2', sys: '4-back', angle: -75, roles: ['CAM', 'ST', 'CDM'], desc: '菱形中场短传渗透中路（使用 4-1-2-1-2 时效果×2）', eff: { passing: 2, dribbling: 2 }, mods: { shortPassBias: 0.03 } },
  { f: '4-4-1-1', sys: '4-back', angle: -55, roles: ['CAM', 'ST'], desc: '影锋回撤串联单箭头（使用 4-4-1-1 时效果×2）', eff: { positioning: 2, passing: 2 }, mods: { falseNineDrop: 4 } },
  { f: '4-1-4-1', sys: '4-back', angle: -155, roles: ['CDM', 'CM', 'LM', 'RM'], desc: '单后腰拖后配四中场压迫（使用 4-1-4-1 时效果×2）', eff: { defending: 2, pace: 2 }, mods: { pressDistBonus: 2 } },
  { f: '4-2-2-2', sys: '4-back', angle: -35, roles: ['CAM', 'ST'], desc: '双前腰肋部小配合（使用 4-2-2-2 时效果×2）', eff: { dribbling: 2, shooting: 2 }, mods: { throughPassBias: 0.03 } },
  { f: '4-3-2-1', sys: '4-back', angle: -172, roles: ['CAM', 'CM'], desc: '圣诞树双影锋远射与直塞（使用 4-3-2-1 时效果×2）', eff: { shooting: 2, composure: 2 }, mods: { longShotBias: 0.03 } },
  // 3-back (4)
  { f: '3-5-2', sys: '3-back', angle: 5, roles: ['LWB', 'RWB', 'ST'], desc: '双翼卫走廊与双中锋抢点（使用 3-5-2 时效果×2）', eff: { pace: 2, stamina: 3 }, mods: { overlapDepthBonus: 3 } },
  { f: '3-4-3', sys: '3-back', angle: 25, roles: ['LW', 'RW', 'ST'], desc: '三前锋高位压迫与肋部冲击（使用 3-4-3 时效果×2）', eff: { shooting: 2, pace: 2 }, mods: { pressDistBonus: 2 } },
  { f: '3-4-2-1', sys: '3-back', angle: 45, roles: ['CAM', 'LWB', 'RWB'], desc: '双影锋内收+翼卫拉边（使用 3-4-2-1 时效果×2）', eff: { dribbling: 2, passing: 2 }, mods: { dualOverlap: true } },
  { f: '3-4-1-2', sys: '3-back', angle: 65, roles: ['CAM', 'ST'], desc: '前腰直塞驱动双前锋（使用 3-4-1-2 时效果×2）', eff: { passing: 2, shooting: 2 }, mods: { throughPassBias: 0.03 } },
  // 5-back (4)
  { f: '5-4-1', sys: '5-back', angle: 115, roles: ['CB', 'GK', 'LWB', 'RWB'], desc: '五后卫低位铁桶与单锋偷鸡（使用 5-4-1 时效果×2）', eff: { defending: 3, goalkeeping: 2 }, mods: { lineShift: -3 } },
  { f: '5-3-2', sys: '5-back', angle: 140, roles: ['CB', 'ST'], desc: '五人防线配双前锋快反（使用 5-3-2 时效果×2）', eff: { defending: 2, pace: 2 }, mods: { gkQuickLaunch: true } },
  { f: '5-2-3', sys: '5-back', angle: 165, roles: ['LW', 'RW', 'ST'], desc: '稳守后场长传三叉戟（使用 5-2-3 时效果×2）', eff: { pace: 2, shooting: 2 }, mods: { throughPassBias: 0.03 } },
  { f: '5-2-1-2', sys: '5-back', angle: 190, roles: ['CAM', 'LWB', 'RWB'], desc: '五卫前腰反击枢纽（使用 5-2-1-2 时效果×2）', eff: { passing: 2, defending: 2 }, mods: { overlapDepthBonus: 2 } },
];

function buildSkillWeb(): SkillWebNode[] {
  const nodes: SkillWebNode[] = [];
  const add = (n: SkillWebNode) => nodes.push(n);

  // 1. 中心终极核心 (1)
  add({
    id: 'core_master',
    name: '足球哲学宗师',
    kind: 'keystone',
    cost: 80,
    nx: 0.5,
    ny: 0.5,
    color: '#FACC15',
    desc: '终极枢纽：全队全核心属性 +3，体能消耗 -12%，全队前插抢点 +1',
    effect: { passing: 3, shooting: 3, defending: 3, pace: 3, composure: 3 },
    mods: { staminaDrainMul: 0.88, boxCrashBonus: 1 },
    neighbors: ['sys_4back', 'sys_3back', 'sys_5back'],
  });

  // 2. 三大防线体系原点 + 6个主干 (9)
  (['4-back', '3-back', '5-back'] as DefenseSystem[]).forEach(sys => {
    const meta = SYSTEM_META[sys];
    const sysId = sys === '4-back' ? 'sys_4back' : sys === '3-back' ? 'sys_3back' : 'sys_5back';
    const p = ptAt(meta.angle, 0.13);
    add({
      id: sysId,
      name: meta.name,
      kind: 'origin',
      cost: 25,
      nx: p.nx,
      ny: p.ny,
      color: meta.color,
      systemTag: sys,
      desc: meta.desc,
      effect: meta.eff,
      mods: meta.mods,
      neighbors: ['core_master', `${sysId}_t1`, `${sysId}_t2`],
    });

    const t1 = ptAt(meta.angle - 22, 0.19);
    const t2 = ptAt(meta.angle + 22, 0.19);
    add({
      id: `${sysId}_t1`,
      name: sys === '4-back' ? '四卫造越位' : sys === '3-back' ? '翼卫体能池' : '三中卫协防',
      kind: 'path',
      cost: 15,
      nx: t1.nx,
      ny: t1.ny,
      color: meta.color,
      systemTag: sys,
      desc: sys === '4-back' ? '防线前压 +2m，全队 选位+2' : sys === '3-back' ? '翼卫体能消耗 -10%，体能+3' : '中卫 防守+2 对抗+2',
      effect: sys === '4-back' ? { positioning: 2 } : sys === '3-back' ? { stamina: 3 } : { defending: 2, strength: 2 },
      mods: sys === '4-back' ? { lineShift: 2 } : sys === '3-back' ? { staminaDrainMul: 0.90 } : undefined,
      neighbors: [sysId],
    });
    add({
      id: `${sysId}_t2`,
      name: sys === '4-back' ? '双线补位' : sys === '3-back' ? '中路人数压制' : '门前密集封堵',
      kind: 'path',
      cost: 15,
      nx: t2.nx,
      ny: t2.ny,
      color: meta.color,
      systemTag: sys,
      desc: sys === '4-back' ? '全队 防守+1 传球+1' : sys === '3-back' ? '中场 传球+2 冷静+2' : '门将 扑救+3 防线冷静+2',
      effect: sys === '4-back' ? { defending: 1, passing: 1 } : sys === '3-back' ? { passing: 2, composure: 2 } : { goalkeeping: 3, composure: 2 },
      neighbors: [sysId],
    });
  });

  // 3. 16 个具体阵型专精节点 (16)
  for (const spec of FORMATION_SPECS) {
    const sysId = spec.sys === '4-back' ? 'sys_4back' : spec.sys === '3-back' ? 'sys_3back' : 'sys_5back';
    const fp = ptAt(spec.angle, 0.26);
    const meta = SYSTEM_META[spec.sys];
    add({
      id: `fm_${spec.f}`,
      name: `${spec.f} 专精`,
      kind: 'formation',
      cost: 28,
      nx: fp.nx,
      ny: fp.ny,
      color: meta.color,
      systemTag: spec.sys,
      formationTag: spec.f,
      targetRoles: spec.roles,
      desc: spec.desc,
      effect: spec.eff,
      mods: spec.mods,
      neighbors: [sysId, `${sysId}_t1`, `${sysId}_t2`],
    });
  }

  // 4. 6 大战术原点 + 36 战术小节点 + 6 跨流派奇点 (48)
  const styleKeys = Object.keys(STYLE_ANGLES) as TacticalStyle[];
  const pathModsPool: Array<{ suffix: string; label: string; desc: string; eff: SkillEffect; mods?: TacticalMods }> = [
    { suffix: 'p1', label: '压迫触发', desc: '全队 速度+1，逼抢半径 +2m', eff: { pace: 1 }, mods: { pressDistBonus: 2 } },
    { suffix: 'p2', label: '体能分配', desc: '体能+2，体能消耗 -6%', eff: { stamina: 2 }, mods: { staminaDrainMul: 0.94 } },
    { suffix: 'p3', label: '渗透配合', desc: '传球+2，短传权重微升', eff: { passing: 2 }, mods: { shortPassBias: 0.03 } },
    { suffix: 'p4', label: '直塞反插', desc: '跑位+2，直塞球倾向提升', eff: { positioning: 2 }, mods: { throughPassBias: 0.04 } },
    { suffix: 'p5', label: '远射解放', desc: '射门+2，解锁禁区外远射倾向', eff: { shooting: 2 }, mods: { longShotBias: 0.04 } },
    { suffix: 'p6', label: '边路套上', desc: '速度+1 传球+1，边卫套上 +3m', eff: { pace: 1, passing: 1 }, mods: { overlapDepthBonus: 3 } },
  ];

  styleKeys.forEach((st, sIdx) => {
    const sm = STYLE_ANGLES[st];
    const op = ptAt(sm.angle, 0.45);
    add({
      id: sm.originId,
      name: sm.name,
      kind: 'origin',
      cost: 35,
      nx: op.nx,
      ny: op.ny,
      color: sm.color,
      styleTag: st,
      desc: sm.desc,
      effect: sm.eff,
      mods: sm.mods,
      neighbors: [`${st}_p1`, `${st}_p2`],
    });

    // 每条战术分支 6 个路径小节点，两层扇形向内展开
    const coords = [
      ptAt(sm.angle - 10, 0.40),
      ptAt(sm.angle + 10, 0.40),
      ptAt(sm.angle - 14, 0.36),
      ptAt(sm.angle, 0.36),
      ptAt(sm.angle + 14, 0.36),
      ptAt(sm.angle, 0.31),
    ];
    for (let k = 0; k < 6; k++) {
      const pm = pathModsPool[(k + sIdx) % pathModsPool.length];
      const nId = `${st}_p${k + 1}`;
      const nb: string[] = [];
      if (k === 0) nb.push(sm.originId, `${st}_p3`, `${st}_p4`);
      if (k === 1) nb.push(sm.originId, `${st}_p4`, `${st}_p5`);
      if (k === 2) nb.push(`${st}_p1`, `${st}_p6`);
      if (k === 3) nb.push(`${st}_p1`, `${st}_p2`, `${st}_p6`);
      if (k === 4) nb.push(`${st}_p2`, `${st}_p6`);
      if (k === 5) nb.push(`${st}_p3`, `${st}_p4`, `${st}_p5`);
      add({
        id: nId,
        name: `${sm.name.slice(0, 2)}·${pm.label}`,
        kind: 'path',
        cost: 14,
        nx: coords[k].nx,
        ny: coords[k].ny,
        color: sm.color,
        styleTag: st,
        desc: pm.desc,
        effect: pm.eff,
        mods: pm.mods,
        neighbors: nb,
      });
    }
  });

  // 6 个跨流派奇点
  const crossKeys = [
    { id: 'key_press_wing', a: 'gegenpress' as TacticalStyle, b: 'wing_play' as TacticalStyle, name: '边路绞肉机', color: '#FB923C', desc: '【高压×两翼】全队 速度+3 体能+4，双侧边卫同时套上', eff: { pace: 3, stamina: 4 }, mods: { dualOverlap: true, pressDistBonus: 2 } },
    { id: 'key_wing_cnt', a: 'wing_play' as TacticalStyle, b: 'counter' as TacticalStyle, name: '两翼爆破', color: '#FACC15', desc: '【两翼×反击】全队 速度+3 射门+2，传中倾向 +0.06', eff: { pace: 3, shooting: 2 }, mods: { crossBias: 0.06, overlapDepthBonus: 4 } },
    { id: 'key_cnt_bus', a: 'counter' as TacticalStyle, b: 'park_bus' as TacticalStyle, name: '防反大师', color: '#C084FC', desc: '【反击×铁桶】全队 防守+3 冷静+3，门将手抛快发长传', eff: { defending: 3, composure: 3 }, mods: { gkQuickLaunch: true, throughPassBias: 0.05 } },
    { id: 'key_bus_bal', a: 'park_bus' as TacticalStyle, b: 'balanced' as TacticalStyle, name: '铜墙铁壁', color: '#4ADE80', desc: '【铁桶×均衡】全队 防守+3 门将+4 体能+4', eff: { defending: 3, goalkeeping: 4, stamina: 4 }, mods: { lineShift: -3 } },
    { id: 'key_bal_tiki', a: 'balanced' as TacticalStyle, b: 'tiki_taka' as TacticalStyle, name: '全能大师', color: '#7DD3FC', desc: '【均衡×传控】全队 传球+2 射门+2 防守+2，伪九号回撤 +6m', eff: { passing: 2, shooting: 2, defending: 2 }, mods: { falseNineDrop: 6 } },
    { id: 'key_tiki_press', a: 'tiki_taka' as TacticalStyle, b: 'gegenpress' as TacticalStyle, name: '窒息围抢', color: '#F43F5E', desc: '【传控×高压】全队 传球+3 速度+2，解锁 3 人合围逼抢', eff: { passing: 3, pace: 2 }, mods: { extraPresser: true, shortPassBias: 0.05 } },
  ];

  for (const ck of crossKeys) {
    const midA = STYLE_ANGLES[ck.a].angle;
    const midB = STYLE_ANGLES[ck.b].angle;
    let avg = (midA + midB) / 2;
    if (Math.abs(midA - midB) > 180) avg += 180;
    const kp = ptAt(avg, 0.43);
    add({
      id: ck.id,
      name: ck.name,
      kind: 'keystone',
      cost: 55,
      nx: kp.nx,
      ny: kp.ny,
      color: ck.color,
      desc: ck.desc,
      effect: ck.eff,
      mods: ck.mods,
      neighbors: [STYLE_ANGLES[ck.a].originId, STYLE_ANGLES[ck.b].originId, `${ck.a}_p5`, `${ck.b}_p3`],
    });
  }

  // 5. 中环：18 个「三大防线体系 × 六大战术流派」融合奇点 + 32 个桥梁节点 (50)
  const systems: DefenseSystem[] = ['4-back', '3-back', '5-back'];
  const sysPrefix: Record<DefenseSystem, string> = { '4-back': '4卫', '3-back': '3卫', '5-back': '5卫' };
  const sysRepFormations: Record<DefenseSystem, FormationName[]> = {
    '4-back': ['4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '4-4-1-1', '4-1-4-1'],
    '3-back': ['3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2', '3-5-2', '3-4-3'],
    '5-back': ['5-4-1', '5-3-2', '5-2-3', '5-2-1-2', '5-4-1', '5-3-2'],
  };

  let bridgeSeq = 0;
  styleKeys.forEach((st, sIdx) => {
    const stAngle = STYLE_ANGLES[st].angle;
    systems.forEach((sys, sysIdx) => {
      const offsetAngle = (sysIdx - 1) * 14;
      const fp = ptAt(stAngle + offsetAngle, 0.315);
      const repFm = sysRepFormations[sys][sIdx];
      const fusionId = `fus_${sys}_${st}`;
      const sysColor = SYSTEM_META[sys].color;
      const stName = STYLE_ANGLES[st].name.slice(0, 2);

      // 根据组合赋予鲜明机制
      const mods: TacticalMods =
        st === 'wing_play' ? { overlapDepthBonus: 4, crossBias: 0.04, dualOverlap: sys === '3-back' } :
        st === 'gegenpress' ? { pressDistBonus: 3, extraPresser: true, lineShift: 3 } :
        st === 'tiki_taka' ? { shortPassBias: 0.05, falseNineDrop: sys === '4-back' ? 5 : 0 } :
        st === 'counter' ? { throughPassBias: 0.05, gkQuickLaunch: sys === '5-back' } :
        st === 'park_bus' ? { lineShift: -3, staminaDrainMul: 0.90 } :
        { boxCrashBonus: 1, longShotBias: 0.04 };

      add({
        id: fusionId,
        name: `${sysPrefix[sys]}×${stName}`,
        kind: 'fusion',
        cost: 42,
        nx: fp.nx,
        ny: fp.ny,
        color: sysColor,
        systemTag: sys,
        styleTag: st,
        desc: `【${SYSTEM_META[sys].name}×${stName}融合】全队+1关键属性；当前体系与战术匹配时触发共鸣(效果×2)`,
        effect: st === 'park_bus' ? { defending: 2, composure: 1 } : st === 'tiki_taka' ? { passing: 2, dribbling: 1 } : { pace: 2, shooting: 1 },
        mods,
        neighbors: [`${st}_p6`, `fm_${repFm}`],
      });

      // 为每个融合节点补 1~2 个桥梁小节点，使星图呈网状贯通（共 32 个桥梁节点）
      const fmNode = nodes.find(n => n.id === `fm_${repFm}`)!;
      const midPt = lerpPt(fp, { nx: fmNode.nx, ny: fmNode.ny }, 0.48);
      bridgeSeq++;
      add({
        id: `br_${bridgeSeq}`,
        name: `${sysPrefix[sys]}衔接`,
        kind: 'path',
        cost: 12,
        nx: midPt.nx,
        ny: midPt.ny,
        color: sysColor,
        systemTag: sys,
        desc: '阵型与战术过渡节点：全队 跑位+1 冷静+1',
        effect: { positioning: 1, composure: 1 },
        neighbors: [fusionId, `fm_${repFm}`],
      });
    });
  });

  // 补齐剩余 14 个外环/中环横向连接桥梁节点（总共 18 + 14 = 32 个，全图正好 124 节点）
  const extraBridgePairs: Array<[string, string, string]> = [
    ['fm_4-1-4-1', 'tiki_taka_p3', '边中轮转'],
    ['fm_4-3-3', 'tiki_taka_p4', '伪九支点'],
    ['fm_4-2-3-1', 'gegenpress_p3', '前腰反抢'],
    ['fm_4-4-2', 'gegenpress_p4', '双锋压迫'],
    ['fm_4-1-2-1-2', 'gegenpress_p5', '菱形围抢'],
    ['fm_4-4-1-1', 'wing_play_p3', '边前卫回防'],
    ['fm_4-2-2-2', 'wing_play_p4', '肋部套上'],
    ['fm_4-3-2-1', 'tiki_taka_p5', '圣诞树渗透'],
    ['fm_3-5-2', 'wing_play_p5', '翼卫走廊'],
    ['fm_3-4-3', 'counter_p3', '三叉戟提速'],
    ['fm_3-4-2-1', 'counter_p4', '双影锋反击'],
    ['fm_3-4-1-2', 'park_bus_p3', '中路铁闸'],
    ['fm_5-4-1', 'park_bus_p4', '门前清道夫'],
    ['fm_5-3-2', 'balanced_p3', '五卫出球'],
  ];

  extraBridgePairs.forEach(([aId, bId, label]) => {
    const na = nodes.find(n => n.id === aId);
    const nb = nodes.find(n => n.id === bId);
    if (!na || !nb) return;
    bridgeSeq++;
    const mp = lerpPt(na, nb, 0.5);
    add({
      id: `br_${bridgeSeq}`,
      name: label,
      kind: 'path',
      cost: 12,
      nx: mp.nx,
      ny: mp.ny,
      color: nb.color || na.color,
      desc: '流派跨接节点：全队 体能+2 跑位+1',
      effect: { stamina: 2, positioning: 1 },
      neighbors: [aId, bId],
    });
  });

  // 确定性最小间距松弛迭代，保证 124 个节点绝不重叠
  const minDist = 0.056;
  for (let iter = 0; iter < 48; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.nx - a.nx;
        const dy = b.ny - a.ny;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        if (d < minDist) {
          const push = (minDist - d) * 0.45;
          const ux = dx / d;
          const uy = dy / d;
          if (a.id !== 'core_master') {
            a.nx = Math.max(0.04, Math.min(0.96, a.nx - ux * push));
            a.ny = Math.max(0.04, Math.min(0.96, a.ny - uy * push));
          }
          if (b.id !== 'core_master') {
            b.nx = Math.max(0.04, Math.min(0.96, b.nx + ux * push));
            b.ny = Math.max(0.04, Math.min(0.96, b.ny + uy * push));
          }
        }
      }
    }
  }
  for (const n of nodes) {
    n.nx = Math.round(n.nx * 1000) / 1000;
    n.ny = Math.round(n.ny * 1000) / 1000;
  }

  // 双向图对称化：保证所有 neighbors 互为双向边
  const map = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) {
    for (const nbId of n.neighbors) {
      const nb = map.get(nbId);
      if (nb && !nb.neighbors.includes(n.id)) {
        nb.neighbors.push(n.id);
      }
    }
    if (ACTIVE_SKILL_SPECS[n.id]) {
      n.activeSkill = ACTIVE_SKILL_SPECS[n.id];
    }
  }

  return nodes;
}

const ACTIVE_SKILL_SPECS: Record<string, ActiveSkillDef> = {
  // 1. 终极核心 (1)
  core_master: {
    name: '时间停滞·全军破限', situation: 'trailing_late', situationLabel: '70分后关键胶着/落后时刻',
    minFamiliarity: 55, minChemistry: 50, cooldownMinutes: 30, maxPerMatch: 1, durationMinutes: 10,
    powerLabel: '全队全属性+10 · 体能+12% · 绝杀压上',
    effect: { targetLine: 'ALL', passingDelta: 10, shootingDelta: 10, paceDelta: 10, composureDelta: 10, fitnessInstantDelta: 12 },
  },
  // 2. 三大防线体系原点 + 2 个核心战术分支 (5)
  sys_4back: {
    name: '四卫联动封锁', situation: 'opponent_through_ball', situationLabel: '对手中路直塞渗透',
    minFamiliarity: 35, minChemistry: 30, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '后卫线 抢断+10 冷静+8',
    effect: { targetLine: 'DEF', defendingDelta: 10, composureDelta: 8, mechanic: 'iron_wall_block' },
  },
  sys_3back: {
    name: '三卫翼卫爆冲', situation: 'wing_overload', situationLabel: '边路走廊控球推进',
    minFamiliarity: 35, minChemistry: 30, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中前场 速度+10 传球+6',
    effect: { targetLine: 'MID', paceDelta: 10, passingDelta: 6, mechanic: 'wing_overload' },
  },
  sys_5back: {
    name: '五卫铜墙反击', situation: 'box_danger', situationLabel: '对手逼近我方禁区威胁',
    minFamiliarity: 35, minChemistry: 30, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '后卫+门将 防守+12 扑救+10',
    effect: { targetLine: 'DEF', defendingDelta: 12, composureDelta: 8, mechanic: 'iron_wall_block' },
  },
  sys_4back_t1: {
    name: '造越位陷阱', situation: 'opponent_through_ball', situationLabel: '对手传出纵深直塞瞬间',
    minFamiliarity: 40, minChemistry: 35, cooldownMinutes: 22, maxPerMatch: 2, durationMinutes: 7,
    powerLabel: '造越位触发率大增 · 冷静+8',
    effect: { targetLine: 'DEF', defendingDelta: 8, composureDelta: 8, mechanic: 'offside_trap' },
  },
  sys_5back_t2: {
    name: '门前绝命封堵', situation: 'box_danger', situationLabel: '对手禁区内起脚威胁',
    minFamiliarity: 40, minChemistry: 35, cooldownMinutes: 22, maxPerMatch: 2, durationMinutes: 7,
    powerLabel: '门将 扑救+14 · 防线封堵+18%',
    effect: { targetLine: 'GK', goalkeepingDelta: 14, composureDelta: 10, mechanic: 'iron_wall_block' },
  },
  // 3. 六大战术流派原点 (6)
  ori_press: {
    name: '狂热围抢令', situation: 'midfield_press', situationLabel: '中场丢球反抢瞬间',
    minFamiliarity: 30, minChemistry: 25, cooldownMinutes: 18, maxPerMatch: 2, durationMinutes: 7,
    powerLabel: '中前场 速度+9 抢断+9 · 抢断率+12%',
    effect: { targetLine: 'MID', paceDelta: 9, defendingDelta: 9, mechanic: 'high_press_blitz' },
  },
  ori_wing: {
    name: '边路起飞号角', situation: 'wing_overload', situationLabel: '边锋/边卫边路拿球',
    minFamiliarity: 30, minChemistry: 25, cooldownMinutes: 18, maxPerMatch: 2, durationMinutes: 7,
    powerLabel: '前锋线 速度+10 传球+6 · 抢点+20%',
    effect: { targetLine: 'ATT', paceDelta: 10, passingDelta: 6, mechanic: 'wing_overload' },
  },
  ori_counter: {
    name: '闪电直塞制导', situation: 'counter_opportunity', situationLabel: '后场断球转换反击瞬间',
    minFamiliarity: 30, minChemistry: 25, cooldownMinutes: 18, maxPerMatch: 2, durationMinutes: 7,
    powerLabel: '锋线 速度+11 射门+7',
    effect: { targetLine: 'ATT', paceDelta: 11, shootingDelta: 7, mechanic: 'gk_counter_launch' },
  },
  ori_bus: {
    name: '铁血死守令', situation: 'box_danger', situationLabel: '禁区前沿承压时刻',
    minFamiliarity: 30, minChemistry: 25, cooldownMinutes: 18, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '防线 防守+11 体能+8%',
    effect: { targetLine: 'DEF', defendingDelta: 11, fitnessInstantDelta: 8, mechanic: 'iron_wall_block' },
  },
  ori_bal: {
    name: '中场节拍校准', situation: 'any_possession', situationLabel: '我方稳定控球梳理节奏',
    minFamiliarity: 30, minChemistry: 25, cooldownMinutes: 18, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中场 传球+9 冷静+8 · 回体',
    effect: { targetLine: 'MID', passingDelta: 9, composureDelta: 8, mechanic: 'tiki_taka_flow' },
  },
  ori_tiki: {
    name: '传控三角渗透', situation: 'attacking_final_third', situationLabel: '前场三区多人配合渗透',
    minFamiliarity: 30, minChemistry: 25, cooldownMinutes: 18, maxPerMatch: 2, durationMinutes: 7,
    powerLabel: '中前场 传球+11 冷静+7',
    effect: { targetLine: 'MID', passingDelta: 11, composureDelta: 7, mechanic: 'tiki_taka_flow' },
  },
  // 4. 六大跨流派奇点 (6)
  key_press_wing: {
    name: '边路绞肉飓风', situation: 'wing_overload', situationLabel: '边路压迫与套上同时触发',
    minFamiliarity: 50, minChemistry: 45, cooldownMinutes: 24, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '全队 速度+10 抢断+8 · 高位抢断',
    effect: { targetLine: 'ALL', paceDelta: 10, defendingDelta: 8, mechanic: 'high_press_blitz' },
  },
  key_wing_cnt: {
    name: '两翼极速爆破', situation: 'counter_opportunity', situationLabel: '断球后边路空当反击',
    minFamiliarity: 50, minChemistry: 45, cooldownMinutes: 24, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 速度+13 射门+9 · 传中抢点',
    effect: { targetLine: 'ATT', paceDelta: 13, shootingDelta: 9, mechanic: 'wing_overload' },
  },
  key_cnt_bus: {
    name: '门神长传制导', situation: 'counter_opportunity', situationLabel: '门将/后卫拿球发起快反',
    minFamiliarity: 50, minChemistry: 45, cooldownMinutes: 24, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '全队 传球+9 速度+9 · 快发xG+25%',
    effect: { targetLine: 'ALL', passingDelta: 9, paceDelta: 9, mechanic: 'gk_counter_launch' },
  },
  key_bus_bal: {
    name: '绝对防御领域', situation: 'box_danger', situationLabel: '对手强攻禁区关键防守',
    minFamiliarity: 50, minChemistry: 45, cooldownMinutes: 24, maxPerMatch: 2, durationMinutes: 9,
    powerLabel: '防线+门将 防守+12 冷静+10 · 体能+10%',
    effect: { targetLine: 'DEF', defendingDelta: 12, composureDelta: 10, fitnessInstantDelta: 10, mechanic: 'iron_wall_block' },
  },
  key_bal_tiki: {
    name: '伪九号魔术时刻', situation: 'attacking_final_third', situationLabel: '前场三十米区域持球组织',
    minFamiliarity: 50, minChemistry: 45, cooldownMinutes: 24, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '全队 传球+10 射门+8 冷静+8',
    effect: { targetLine: 'ALL', passingDelta: 10, shootingDelta: 8, composureDelta: 8, mechanic: 'tiki_taka_flow' },
  },
  key_tiki_press: {
    name: '窒息三鬼拍门', situation: 'midfield_press', situationLabel: '对手后场出球瞬间围抢',
    minFamiliarity: 50, minChemistry: 45, cooldownMinutes: 24, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '全队 速度+9 传球+8 防守+8',
    effect: { targetLine: 'ALL', paceDelta: 9, passingDelta: 8, defendingDelta: 8, mechanic: 'high_press_blitz' },
  },
  // 5. 16 个阵型专精主动技 (16)
  'fm_4-3-3': {
    name: '三叉戟交叉换位', situation: 'attacking_final_third', situationLabel: '4-3-3 前场三区持球',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 射门+10 速度+9',
    effect: { targetLine: 'ATT', shootingDelta: 10, paceDelta: 9, mechanic: 'wing_overload' },
  },
  'fm_4-2-3-1': {
    name: '10号位手术刀', situation: 'attacking_final_third', situationLabel: '4-2-3-1 前腰拿球组织',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中场 传球+12 射门+8 · 远射加成',
    effect: { targetLine: 'MID', passingDelta: 12, shootingDelta: 8, mechanic: 'long_shot_cannon' },
  },
  'fm_4-4-2': {
    name: '双塔抢点轰炸', situation: 'wing_overload', situationLabel: '4-4-2 边路起球传中时机',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 射门+11 冷静+8 · 抢点+20%',
    effect: { targetLine: 'ATT', shootingDelta: 11, composureDelta: 8, mechanic: 'wing_overload' },
  },
  'fm_4-1-2-1-2': {
    name: '菱形中路撞墙', situation: 'attacking_final_third', situationLabel: '4-1-2-1-2 中路短传渗透',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中前场 传球+11 冷静+9',
    effect: { targetLine: 'MID', passingDelta: 11, composureDelta: 9, mechanic: 'tiki_taka_flow' },
  },
  'fm_4-4-1-1': {
    name: '影锋回撤穿刺', situation: 'any_possession', situationLabel: '4-4-1-1 中前场衔接控球',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 传球+10 射门+9',
    effect: { targetLine: 'ATT', passingDelta: 10, shootingDelta: 9, mechanic: 'long_shot_cannon' },
  },
  'fm_4-1-4-1': {
    name: '单后腰绞杀阵', situation: 'midfield_press', situationLabel: '4-1-4-1 中场压迫抢断',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中场 防守+11 速度+8',
    effect: { targetLine: 'MID', defendingDelta: 11, paceDelta: 8, mechanic: 'high_press_blitz' },
  },
  'fm_4-2-2-2': {
    name: '双十号魔方连线', situation: 'attacking_final_third', situationLabel: '4-2-2-2 肋部双前腰联动',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中场 传球+10 射门+9',
    effect: { targetLine: 'MID', passingDelta: 10, shootingDelta: 9, mechanic: 'tiki_taka_flow' },
  },
  'fm_4-3-2-1': {
    name: '圣诞树重炮齐射', situation: 'attacking_final_third', situationLabel: '4-3-2-1 禁区弧顶外机会',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 射门+12 冷静+8 · 远射+30%',
    effect: { targetLine: 'ATT', shootingDelta: 12, composureDelta: 8, mechanic: 'long_shot_cannon' },
  },
  'fm_3-5-2': {
    name: '翼卫走廊奔袭', situation: 'wing_overload', situationLabel: '3-5-2 边翼卫持球推进',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中场 速度+11 传球+9 · 体能+8%',
    effect: { targetLine: 'MID', paceDelta: 11, passingDelta: 9, fitnessInstantDelta: 8 },
  },
  'fm_3-4-3': {
    name: '前场疯狗高压', situation: 'midfield_press', situationLabel: '3-4-3 前场三叉戟就地反抢',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 速度+10 防守+9 · 抢断率+12%',
    effect: { targetLine: 'ATT', paceDelta: 10, defendingDelta: 9, mechanic: 'high_press_blitz' },
  },
  'fm_3-4-2-1': {
    name: '双影锋肋部爆破', situation: 'attacking_final_third', situationLabel: '3-4-2-1 肋部前场渗入',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 射门+10 传球+9',
    effect: { targetLine: 'ATT', shootingDelta: 10, passingDelta: 9, mechanic: 'long_shot_cannon' },
  },
  'fm_3-4-1-2': {
    name: '十号直塞双锋', situation: 'counter_opportunity', situationLabel: '3-4-1-2 中场直塞转换',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 速度+10 射门+10',
    effect: { targetLine: 'ATT', paceDelta: 10, shootingDelta: 10, mechanic: 'gk_counter_launch' },
  },
  'fm_5-4-1': {
    name: '大巴反击偷鸡', situation: 'counter_opportunity', situationLabel: '5-4-1 断球后单箭头突击',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '全队 防守+8 锋线速度+12',
    effect: { targetLine: 'ATT', paceDelta: 12, shootingDelta: 8, mechanic: 'gk_counter_launch' },
  },
  'fm_5-3-2': {
    name: '五卫快反双煞', situation: 'counter_opportunity', situationLabel: '5-3-2 后场断球打身后',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 速度+11 射门+9',
    effect: { targetLine: 'ATT', paceDelta: 11, shootingDelta: 9, mechanic: 'gk_counter_launch' },
  },
  'fm_5-2-3': {
    name: '长传制导三叉戟', situation: 'counter_opportunity', situationLabel: '5-2-3 后场长传找边锋',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '锋线 速度+12 传球+8',
    effect: { targetLine: 'ATT', paceDelta: 12, passingDelta: 8, mechanic: 'wing_overload' },
  },
  'fm_5-2-1-2': {
    name: '铁桶前腰反击枢纽', situation: 'trailing_late', situationLabel: '5-2-1-2 70分后反击关键期',
    minFamiliarity: 45, minChemistry: 40, cooldownMinutes: 20, maxPerMatch: 2, durationMinutes: 8,
    powerLabel: '中前场 传球+10 射门+10',
    effect: { targetLine: 'ALL', passingDelta: 10, shootingDelta: 10, mechanic: 'blood_frenzy' },
  },
};

export const SKILL_WEB_NODES: SkillWebNode[] = buildSkillWeb();

export function isActiveSkillNode(node: SkillWebNode): boolean {
  return !!node.activeSkill;
}

export function getUnlockedActiveSkillNodes(unlockedIds: string[]): SkillWebNode[] {
  const set = new Set(unlockedIds);
  return SKILL_WEB_NODES.filter(n => set.has(n.id) && !!n.activeSkill);
}

export function toEquippedActiveSkill(node: SkillWebNode): EquippedActiveSkill | null {
  if (!node.activeSkill) return null;
  const s = node.activeSkill;
  return {
    id: node.id,
    name: s.name,
    situation: s.situation,
    situationLabel: s.situationLabel,
    minFamiliarity: s.minFamiliarity,
    minChemistry: s.minChemistry,
    cooldownMinutes: s.cooldownMinutes,
    maxPerMatch: s.maxPerMatch,
    durationMinutes: s.durationMinutes,
    powerLabel: s.powerLabel,
    effect: {
      id: `sk_${node.id}`,
      name: s.name,
      durationMinutes: s.durationMinutes,
      ...s.effect,
    },
  };
}

export function getSkillWebSummaryStats(): { total: number; activeCount: number; modifierCount: number } {
  const activeCount = SKILL_WEB_NODES.filter(n => !!n.activeSkill).length;
  return {
    total: SKILL_WEB_NODES.length,
    activeCount,
    modifierCount: SKILL_WEB_NODES.length - activeCount,
  };
}

export function getOriginForStyle(style: TacticalStyle): string {
  return STYLE_ANGLES[style]?.originId ?? 'ori_tiki';
}

export function getOriginForFormation(formation: FormationName): string {
  const sys = getDefenseSystem(formation);
  return sys === '4-back' ? 'sys_4back' : sys === '3-back' ? 'sys_3back' : 'sys_5back';
}

export function canUnlockNode(nodeId: string, unlockedIds: string[]): boolean {
  if (unlockedIds.includes(nodeId)) return false;
  const node = SKILL_WEB_NODES.find(n => n.id === nodeId);
  if (!node) return false;
  if (node.kind === 'origin') return true;
  return node.neighbors.some(nb => unlockedIds.includes(nb));
}

export function getSkillWebEdges(): Array<[SkillWebNode, SkillWebNode]> {
  const map = new Map(SKILL_WEB_NODES.map(n => [n.id, n]));
  const seen = new Set<string>();
  const edges: Array<[SkillWebNode, SkillWebNode]> = [];
  for (const n of SKILL_WEB_NODES) {
    for (const nbId of n.neighbors) {
      const key = n.id < nbId ? `${n.id}|${nbId}` : `${nbId}|${n.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const nb = map.get(nbId);
      if (nb) edges.push([n, nb]);
    }
  }
  return edges;
}

export function isNodeResonating(node: SkillWebNode, formation: FormationName, style: TacticalStyle): boolean {
  const sys = getDefenseSystem(formation);
  if (node.kind === 'formation' && node.formationTag === formation) return true;
  if (node.kind === 'fusion' && node.systemTag === sys && node.styleTag === style) return true;
  return false;
}

export function computeSkillWebMods(
  unlockedIds: string[],
  formation: FormationName,
  style: TacticalStyle
): TacticalMods {
  const map = new Map(SKILL_WEB_NODES.map(n => [n.id, n]));
  const mods: TacticalMods = {
    overlapDepthBonus: 0,
    dualOverlap: false,
    falseNineDrop: 0,
    boxCrashBonus: 0,
    lineShift: 0,
    pressDistBonus: 0,
    extraPresser: false,
    throughPassBias: 0,
    longShotBias: 0,
    crossBias: 0,
    shortPassBias: 0,
    gkQuickLaunch: false,
    staminaDrainMul: 1.0,
  };

  for (const id of unlockedIds) {
    const node = map.get(id);
    if (!node?.mods) continue;
    const mul = isNodeResonating(node, formation, style) ? 2 : 1;
    const m = node.mods;
    if (m.overlapDepthBonus) mods.overlapDepthBonus! += m.overlapDepthBonus * mul;
    if (m.dualOverlap) mods.dualOverlap = true;
    if (m.falseNineDrop) mods.falseNineDrop! += m.falseNineDrop * mul;
    if (m.boxCrashBonus) mods.boxCrashBonus! += m.boxCrashBonus;
    if (m.lineShift) mods.lineShift! += m.lineShift * mul;
    if (m.pressDistBonus) mods.pressDistBonus! += m.pressDistBonus * mul;
    if (m.extraPresser) mods.extraPresser = true;
    if (m.throughPassBias) mods.throughPassBias! += m.throughPassBias * mul;
    if (m.longShotBias) mods.longShotBias! += m.longShotBias * mul;
    if (m.crossBias) mods.crossBias! += m.crossBias * mul;
    if (m.shortPassBias) mods.shortPassBias! += m.shortPassBias * mul;
    if (m.gkQuickLaunch) mods.gkQuickLaunch = true;
    if (m.staminaDrainMul && m.staminaDrainMul < 1) {
      const reduction = (1 - m.staminaDrainMul) * mul;
      mods.staminaDrainMul = Math.max(0.70, mods.staminaDrainMul! - reduction);
    }
  }

  // 有界裁剪，防止数值失控
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  mods.overlapDepthBonus = clamp(mods.overlapDepthBonus!, 0, 12);
  mods.falseNineDrop = clamp(mods.falseNineDrop!, 0, 12);
  mods.boxCrashBonus = clamp(mods.boxCrashBonus!, 0, 2);
  mods.lineShift = clamp(mods.lineShift!, -8, 8);
  mods.pressDistBonus = clamp(mods.pressDistBonus!, 0, 8);
  mods.throughPassBias = clamp(mods.throughPassBias!, -0.10, 0.14);
  mods.longShotBias = clamp(mods.longShotBias!, -0.10, 0.14);
  mods.crossBias = clamp(mods.crossBias!, -0.10, 0.14);
  mods.shortPassBias = clamp(mods.shortPassBias!, -0.10, 0.14);
  mods.staminaDrainMul = clamp(mods.staminaDrainMul!, 0.70, 1.0);
  return mods;
}
