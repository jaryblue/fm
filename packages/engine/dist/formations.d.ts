/**
 * 动态阵型锚点矩阵（4后卫 / 3后卫 / 5后卫 共 16 种经典阵型）
 * 根据 球的位置 + 控球状态 + 战术风格 + 技能网行为修正 实时计算 11 名球员的理想战术站位
 */
import { AttackDir, DefenseSystem, FormationName, PlayerDuty, PlayerRole, TacticalMods, TacticalStyle, Vec2 } from './types';
export declare const ROLE_DUTY_OPTIONS: Partial<Record<PlayerRole, Array<{
    duty: PlayerDuty;
    label: string;
    desc: string;
}>>>;
export declare function gridToPitch(col: number, row: number): {
    baseX: number;
    baseY: number;
};
export declare function pitchToGrid(baseX: number, baseY: number): {
    col: number;
    row: number;
};
export interface FormationSlot {
    role: PlayerRole;
    baseX: number;
    baseY: number;
}
export declare const FORMATION_SYSTEMS: Record<DefenseSystem, {
    label: string;
    formations: FormationName[];
}>;
export declare function getDefenseSystem(f: FormationName): DefenseSystem;
export declare const FORMATIONS: Record<FormationName, FormationSlot[]>;
export declare function clamp(v: number, min: number, max: number): number;
export declare function toRelativeX(absX: number, dir: AttackDir): number;
export declare function toAbsoluteX(relX: number, dir: AttackDir): number;
/**
 * 计算球员在当前瞬间的动态战术锚点（绝对球场坐标）
 */
export declare function getDynamicAnchor(slot: FormationSlot, ballPos: Vec2, dir: AttackDir, hasPossession: boolean | null, // true=本方控球, false=对方控球, null=争抢
style: TacticalStyle, _formation?: FormationName, mods?: TacticalMods, duty?: PlayerDuty): Vec2;
