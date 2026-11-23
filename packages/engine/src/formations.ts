/**
 * 动态阵型锚点矩阵（4后卫 / 3后卫 / 5后卫 共 16 种经典阵型）
 * 根据 球的位置 + 控球状态 + 战术风格 + 技能网行为修正 实时计算 11 名球员的理想战术站位
 */

import {
  AttackDir,
  DefenseSystem,
  FormationName,
  PITCH,
  PlayerDuty,
  PlayerRole,
  TACTICAL_PRESETS,
  TacticalMods,
  TacticalStyle,
  Vec2,
} from './types';

export const ROLE_DUTY_OPTIONS: Partial<Record<PlayerRole, Array<{ duty: PlayerDuty; label: string; desc: string }>>> = {
  ST: [
    { duty: 'default', label: '全能前锋', desc: '均衡串联与抢点' },
    { duty: 'false_nine', label: '伪九号', desc: '回撤接应组织，拉空防线' },
    { duty: 'target_man', label: '站桩支点', desc: '禁区前沿护球做墙' },
    { duty: 'poacher', label: '禁区之王', desc: '埋伏越位线极限抢点' },
  ],
  LW: [
    { duty: 'default', label: '均衡边锋', desc: '内切与传中兼顾' },
    { duty: 'inside_forward', label: '内锋内切', desc: '切入肋部频繁起脚' },
    { duty: 'classic_winger', label: '传统下底', desc: '拉边高速传中' },
  ],
  RW: [
    { duty: 'default', label: '均衡边锋', desc: '内切与传中兼顾' },
    { duty: 'inside_forward', label: '内锋内切', desc: '切入肋部频繁起脚' },
    { duty: 'classic_winger', label: '传统下底', desc: '拉边高速传中' },
  ],
  LM: [
    { duty: 'default', label: '均衡边前卫', desc: '攻守平衡' },
    { duty: 'inside_forward', label: '肋部内切', desc: '内收支援禁区' },
    { duty: 'classic_winger', label: '边路走廊', desc: '拉宽阵型传中' },
  ],
  RM: [
    { duty: 'default', label: '均衡边前卫', desc: '攻守平衡' },
    { duty: 'inside_forward', label: '肋部内切', desc: '内收支援禁区' },
    { duty: 'classic_winger', label: '边路走廊', desc: '拉宽阵型传中' },
  ],
  CM: [
    { duty: 'default', label: '全能中场', desc: '均衡调度与覆盖' },
    { duty: 'regista', label: '拖后核心', desc: '深位控球发牌直塞' },
    { duty: 'box_to_box', label: 'B2B奔袭', desc: '大范围前插与回防' },
    { duty: 'mezzala', label: '肋部攻击手', desc: '前插半空间威胁球门' },
  ],
  CDM: [
    { duty: 'default', label: '防守后腰', desc: '稳固中路屏障' },
    { duty: 'regista', label: '节拍器', desc: '深位精准调度长短传' },
    { duty: 'box_to_box', label: '扫荡B2B', desc: '积极前压拦截反抢' },
  ],
  CAM: [
    { duty: 'default', label: '经典前腰', desc: '中路串联最后一传' },
    { duty: 'false_nine', label: '影锋串联', desc: '游走肋部策应前锋' },
    { duty: 'mezzala', label: '肋部突击', desc: '斜插禁区抢点射门' },
  ],
  LB: [
    { duty: 'default', label: '传统边卫', desc: '稳守边路适度套上' },
    { duty: 'wing_back', label: '进攻翼卫', desc: '高频下底套边传中' },
    { duty: 'inverted_fb', label: '内收边卫', desc: '持球内收中路增援后腰' },
  ],
  RB: [
    { duty: 'default', label: '传统边卫', desc: '稳守边路适度套上' },
    { duty: 'wing_back', label: '进攻翼卫', desc: '高频下底套边传中' },
    { duty: 'inverted_fb', label: '内收边卫', desc: '持球内收中路增援后腰' },
  ],
  LWB: [
    { duty: 'default', label: '全能翼卫', desc: '边路攻防全覆盖' },
    { duty: 'wing_back', label: '爆破翼卫', desc: '极限套上纵深传中' },
    { duty: 'inverted_fb', label: '内收翼卫', desc: '内切中路配合渗透' },
  ],
  RWB: [
    { duty: 'default', label: '全能翼卫', desc: '边路攻防全覆盖' },
    { duty: 'wing_back', label: '爆破翼卫', desc: '极限套上纵深传中' },
    { duty: 'inverted_fb', label: '内收翼卫', desc: '内切中路配合渗透' },
  ],
};

export function gridToPitch(col: number, row: number): { baseX: number; baseY: number } {
  const c = Math.max(0, Math.min(4, Math.round(col)));
  const r = Math.max(0, Math.min(5, Math.round(row)));
  return {
    baseX: 14 + r * 13,
    baseY: 10 + c * 12,
  };
}

export function pitchToGrid(baseX: number, baseY: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(4, Math.round((baseY - 10) / 12))),
    row: Math.max(0, Math.min(5, Math.round((baseX - 14) / 13))),
  };
}

export interface FormationSlot {
  role: PlayerRole;
  // 基准归一化坐标 (进攻向右视角: x in 0..105, y in 0..68)
  baseX: number;
  baseY: number;
}

export const FORMATION_SYSTEMS: Record<DefenseSystem, { label: string; formations: FormationName[] }> = {
  '4-back': {
    label: '四后卫体系',
    formations: ['4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '4-4-1-1', '4-1-4-1', '4-2-2-2', '4-3-2-1'],
  },
  '3-back': {
    label: '三后卫体系',
    formations: ['3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2'],
  },
  '5-back': {
    label: '五后卫体系',
    formations: ['5-4-1', '5-3-2', '5-2-3', '5-2-1-2'],
  },
};

export function getDefenseSystem(f: FormationName): DefenseSystem {
  if (f.startsWith('3-')) return '3-back';
  if (f.startsWith('5-')) return '5-back';
  return '4-back';
}

export const FORMATIONS: Record<FormationName, FormationSlot[]> = {
  // ==================== 四后卫体系 (8种) ====================
  '4-3-3': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 24, baseY: 10 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 24, baseY: 58 },
    { role: 'CDM', baseX: 38, baseY: 34 },
    { role: 'CM', baseX: 52, baseY: 23 },
    { role: 'CM', baseX: 52, baseY: 45 },
    { role: 'LW', baseX: 68, baseY: 12 },
    { role: 'ST', baseX: 73, baseY: 34 },
    { role: 'RW', baseX: 68, baseY: 56 },
  ],
  '4-2-3-1': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 24, baseY: 10 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 24, baseY: 58 },
    { role: 'CDM', baseX: 39, baseY: 26 },
    { role: 'CDM', baseX: 39, baseY: 42 },
    { role: 'LW', baseX: 58, baseY: 12 },
    { role: 'CAM', baseX: 60, baseY: 34 },
    { role: 'RW', baseX: 58, baseY: 56 },
    { role: 'ST', baseX: 74, baseY: 34 },
  ],
  '4-4-2': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 25, baseY: 11 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 25, baseY: 57 },
    { role: 'LM', baseX: 55, baseY: 12 },
    { role: 'CM', baseX: 48, baseY: 27 },
    { role: 'CM', baseX: 48, baseY: 41 },
    { role: 'RM', baseX: 55, baseY: 56 },
    { role: 'ST', baseX: 73, baseY: 26 },
    { role: 'ST', baseX: 73, baseY: 42 },
  ],
  '4-1-2-1-2': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 25, baseY: 10 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 25, baseY: 58 },
    { role: 'CDM', baseX: 38, baseY: 34 },
    { role: 'CM', baseX: 50, baseY: 22 },
    { role: 'CM', baseX: 50, baseY: 46 },
    { role: 'CAM', baseX: 61, baseY: 34 },
    { role: 'ST', baseX: 74, baseY: 26 },
    { role: 'ST', baseX: 74, baseY: 42 },
  ],
  '4-4-1-1': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 24, baseY: 11 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 24, baseY: 57 },
    { role: 'LM', baseX: 52, baseY: 12 },
    { role: 'CM', baseX: 46, baseY: 27 },
    { role: 'CM', baseX: 46, baseY: 41 },
    { role: 'RM', baseX: 52, baseY: 56 },
    { role: 'CAM', baseX: 64, baseY: 34 },
    { role: 'ST', baseX: 75, baseY: 34 },
  ],
  '4-1-4-1': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 24, baseY: 11 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 24, baseY: 57 },
    { role: 'CDM', baseX: 36, baseY: 34 },
    { role: 'LM', baseX: 55, baseY: 11 },
    { role: 'CM', baseX: 54, baseY: 26 },
    { role: 'CM', baseX: 54, baseY: 42 },
    { role: 'RM', baseX: 55, baseY: 57 },
    { role: 'ST', baseX: 74, baseY: 34 },
  ],
  '4-2-2-2': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 25, baseY: 10 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 25, baseY: 58 },
    { role: 'CDM', baseX: 40, baseY: 26 },
    { role: 'CDM', baseX: 40, baseY: 42 },
    { role: 'CAM', baseX: 59, baseY: 21 },
    { role: 'CAM', baseX: 59, baseY: 47 },
    { role: 'ST', baseX: 74, baseY: 26 },
    { role: 'ST', baseX: 74, baseY: 42 },
  ],
  '4-3-2-1': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LB', baseX: 25, baseY: 10 },
    { role: 'CB', baseX: 22, baseY: 26 },
    { role: 'CB', baseX: 22, baseY: 42 },
    { role: 'RB', baseX: 25, baseY: 58 },
    { role: 'CM', baseX: 45, baseY: 21 },
    { role: 'CDM', baseX: 41, baseY: 34 },
    { role: 'CM', baseX: 45, baseY: 47 },
    { role: 'CAM', baseX: 62, baseY: 24 },
    { role: 'CAM', baseX: 62, baseY: 44 },
    { role: 'ST', baseX: 75, baseY: 34 },
  ],

  // ==================== 三后卫体系 (4种) ====================
  '3-5-2': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 17 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 51 },
    { role: 'LWB', baseX: 46, baseY: 9 },
    { role: 'CDM', baseX: 42, baseY: 34 },
    { role: 'CM', baseX: 56, baseY: 24 },
    { role: 'CM', baseX: 56, baseY: 44 },
    { role: 'RWB', baseX: 46, baseY: 59 },
    { role: 'ST', baseX: 73, baseY: 26 },
    { role: 'ST', baseX: 73, baseY: 42 },
  ],
  '3-4-3': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 17 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 51 },
    { role: 'LWB', baseX: 46, baseY: 9 },
    { role: 'CM', baseX: 47, baseY: 27 },
    { role: 'CM', baseX: 47, baseY: 41 },
    { role: 'RWB', baseX: 46, baseY: 59 },
    { role: 'LW', baseX: 69, baseY: 14 },
    { role: 'ST', baseX: 74, baseY: 34 },
    { role: 'RW', baseX: 69, baseY: 54 },
  ],
  '3-4-2-1': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 17 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 51 },
    { role: 'LWB', baseX: 47, baseY: 9 },
    { role: 'CDM', baseX: 45, baseY: 27 },
    { role: 'CDM', baseX: 45, baseY: 41 },
    { role: 'RWB', baseX: 47, baseY: 59 },
    { role: 'CAM', baseX: 62, baseY: 23 },
    { role: 'CAM', baseX: 62, baseY: 45 },
    { role: 'ST', baseX: 75, baseY: 34 },
  ],
  '3-4-1-2': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 17 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 22, baseY: 51 },
    { role: 'LWB', baseX: 46, baseY: 9 },
    { role: 'CM', baseX: 45, baseY: 27 },
    { role: 'CM', baseX: 45, baseY: 41 },
    { role: 'RWB', baseX: 46, baseY: 59 },
    { role: 'CAM', baseX: 61, baseY: 34 },
    { role: 'ST', baseX: 74, baseY: 26 },
    { role: 'ST', baseX: 74, baseY: 42 },
  ],

  // ==================== 五后卫体系 (4种) ====================
  '5-4-1': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LWB', baseX: 27, baseY: 9 },
    { role: 'CB', baseX: 21, baseY: 21 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 21, baseY: 47 },
    { role: 'RWB', baseX: 27, baseY: 59 },
    { role: 'LM', baseX: 45, baseY: 13 },
    { role: 'CM', baseX: 44, baseY: 27 },
    { role: 'CM', baseX: 44, baseY: 41 },
    { role: 'RM', baseX: 45, baseY: 55 },
    { role: 'ST', baseX: 69, baseY: 34 },
  ],
  '5-3-2': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LWB', baseX: 27, baseY: 9 },
    { role: 'CB', baseX: 21, baseY: 21 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 21, baseY: 47 },
    { role: 'RWB', baseX: 27, baseY: 59 },
    { role: 'CDM', baseX: 40, baseY: 34 },
    { role: 'CM', baseX: 48, baseY: 23 },
    { role: 'CM', baseX: 48, baseY: 45 },
    { role: 'ST', baseX: 69, baseY: 26 },
    { role: 'ST', baseX: 69, baseY: 42 },
  ],
  '5-2-3': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LWB', baseX: 28, baseY: 9 },
    { role: 'CB', baseX: 21, baseY: 21 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 21, baseY: 47 },
    { role: 'RWB', baseX: 28, baseY: 59 },
    { role: 'CDM', baseX: 43, baseY: 27 },
    { role: 'CDM', baseX: 43, baseY: 41 },
    { role: 'LW', baseX: 67, baseY: 14 },
    { role: 'ST', baseX: 72, baseY: 34 },
    { role: 'RW', baseX: 67, baseY: 54 },
  ],
  '5-2-1-2': [
    { role: 'GK', baseX: 5, baseY: 34 },
    { role: 'LWB', baseX: 28, baseY: 9 },
    { role: 'CB', baseX: 21, baseY: 21 },
    { role: 'CB', baseX: 20, baseY: 34 },
    { role: 'CB', baseX: 21, baseY: 47 },
    { role: 'RWB', baseX: 28, baseY: 59 },
    { role: 'CM', baseX: 43, baseY: 27 },
    { role: 'CM', baseX: 43, baseY: 41 },
    { role: 'CAM', baseX: 58, baseY: 34 },
    { role: 'ST', baseX: 71, baseY: 26 },
    { role: 'ST', baseX: 71, baseY: 42 },
  ],
};

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function toRelativeX(absX: number, dir: AttackDir): number {
  return dir === 1 ? absX : PITCH.LENGTH - absX;
}

export function toAbsoluteX(relX: number, dir: AttackDir): number {
  return dir === 1 ? relX : PITCH.LENGTH - relX;
}

/**
 * 计算球员在当前瞬间的动态战术锚点（绝对球场坐标）
 */
export function getDynamicAnchor(
  slot: FormationSlot,
  ballPos: Vec2,
  dir: AttackDir,
  hasPossession: boolean | null, // true=本方控球, false=对方控球, null=争抢
  style: TacticalStyle,
  _formation?: FormationName,
  mods?: TacticalMods,
  duty?: PlayerDuty
): Vec2 {
  const preset = TACTICAL_PRESETS[style];
  const relBallX = toRelativeX(ballPos.x, dir);
  const ballOffsetFromCenterY = ballPos.y - PITCH.HALF_Y;

  if (slot.role === 'GK') {
    const gkRelX = clamp(3 + (relBallX < 30 ? (30 - relBallX) * 0.12 : 0), 2.5, 9);
    const gkY = clamp(PITCH.HALF_Y + ballOffsetFromCenterY * 0.22, 27, 41);
    return { x: toAbsoluteX(gkRelX, dir), y: gkY };
  }

  // 第一性原理 3 参数团队阵型模型：全队重心 + 阵型紧凑度 + 统一宽度缩放
  const possShift = hasPossession === true ? 5 : hasPossession === false ? -6 : 0;
  const lineMod = clamp(mods?.lineShift ?? 0, -8, 8) * 0.6;
  const blockShiftX = (relBallX - PITCH.HALF_X) * 0.52 + preset.lineHeight * 0.65 + possShift + lineMod;
  const compactX = hasPossession === false ? 0.78 : 0.96;

  let roleModX = 0;
  let roleModY = 0;
  if (hasPossession === true) {
    if (slot.role === 'ST' && (mods?.falseNineDrop ?? 0) > 0 && relBallX >= 36 && relBallX <= 66) {
      roleModX = -Math.min(6, (mods?.falseNineDrop ?? 0) * 0.5);
    } else if (slot.role === 'LB' || slot.role === 'RB' || slot.role === 'LWB' || slot.role === 'RWB') {
      const isLeft = slot.baseY < PITCH.HALF_Y;
      const onFlank = isLeft ? ballPos.y < PITCH.HALF_Y + 6 : ballPos.y > PITCH.HALF_Y - 6;
      if (onFlank || mods?.dualOverlap) {
        roleModX = 8 + clamp(mods?.overlapDepthBonus ?? 0, 0, 12) * 0.6;
      }
    }
    if (duty === 'false_nine') roleModX -= 8;
    else if (duty === 'target_man') roleModX += 2;
    else if (duty === 'poacher') roleModX += 6;
    else if (duty === 'inverted_fb') {
      roleModX += 4;
      roleModY += slot.baseY < PITCH.HALF_Y ? 11 : -11;
    } else if (duty === 'wing_back') {
      roleModX += 7;
      roleModY += slot.baseY < PITCH.HALF_Y ? -3 : 3;
    } else if (duty === 'regista') roleModX -= 5;
    else if (duty === 'box_to_box') roleModX += 6;
    else if (duty === 'mezzala') {
      roleModX += 6;
      roleModY += slot.baseY < PITCH.HALF_Y ? -4 : 4;
    } else if (duty === 'inside_forward') {
      roleModX += 4;
      roleModY += slot.baseY < PITCH.HALF_Y ? 9 : -9;
    } else if (duty === 'classic_winger') {
      roleModY += slot.baseY < PITCH.HALF_Y ? -4 : 4;
    }
  } else if (hasPossession === false && duty === 'box_to_box') {
    roleModX -= 4;
  }

  const targetRelX = clamp(22 + (slot.baseX - 22) * compactX + blockShiftX + roleModX, 11, 88);
  const widthFactor = preset.widthScale * (hasPossession === false ? 0.84 : 1.0);
  const targetY = clamp(
    PITCH.HALF_Y + (slot.baseY - PITCH.HALF_Y) * widthFactor + ballOffsetFromCenterY * 0.28 + roleModY,
    5,
    PITCH.WIDTH - 5
  );

  return {
    x: toAbsoluteX(targetRelX, dir),
    y: targetY,
  };
}
