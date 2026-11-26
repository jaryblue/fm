/**
 * 轻量 2D+Z 球体物理与球员运动学
 */
import { AttackDir, BallState, PlayerState, Vec2 } from './types';
export declare function dist2D(a: Vec2, b: Vec2): number;
/**
 * 点 P 到线段 AB 的最短距离与投影参数 t ∈ [0, 1]
 */
export declare function pointToSegment(p: Vec2, a: Vec2, b: Vec2): {
    dist: number;
    t: number;
};
/**
 * 发起传球物理轨迹（短传贴地，长传/传中带 Z 轴抛物线）
 */
export declare function launchPassBall(ball: BallState, from: Vec2, to: Vec2, passer: PlayerState, target: PlayerState, passType: 'short' | 'through' | 'cross' | 'long'): void;
/**
 * 发起射门物理轨迹
 */
export declare function launchShotBall(ball: BallState, shooter: PlayerState, attackDir: AttackDir, xG: number, onTarget: boolean, targetY: number, targetZ: number): void;
/**
 * 推进球体物理状态 1 个 tick (0.1s)
 */
export declare function stepBallPhysics(ball: BallState): void;
/**
 * 推进所有场上球员运动学 (带转向惯性与体能影响)
 */
export declare function stepPlayersPhysics(players: PlayerState[], ball: BallState): void;
