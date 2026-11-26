/**
 * 球场空间评估器：xT（期望威胁值）、xG（期望进球）、越位线与传球通道安全度
 */
import { AttackDir, PlayerState, TeamSide, Vec2 } from './types';
/**
 * 连续期望威胁值 xT(x, y) ∈ [0.02, 0.95]
 * 用于统一评估传球与盘带的空间收益
 */
export declare function evaluateXT(pos: Vec2, dir: AttackDir): number;
/**
 * 计算越位线（绝对 X 坐标）：对方倒数第二名防守球员位置（或半场线）
 */
export declare function getOffsideLineX(attackingTeam: TeamSide, attackDir: AttackDir, players: PlayerState[]): number;
/**
 * 计算射门期望进球值 xG ∈ [0.005, 0.65]
 * 对标五大联赛真实射门分布（禁区外远射 0.02~0.06，禁区内 0.10~0.38）
 */
export declare function computeShotXG(shooter: PlayerState, attackDir: AttackDir, players: PlayerState[]): number;
/**
 * 评估传球通道完成概率 ∈ [0.15, 0.97]
 */
export declare function evaluatePassCompletion(passer: PlayerState, target: PlayerState, players: PlayerState[], isLofted: boolean): number;
