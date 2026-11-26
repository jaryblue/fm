/**
 * 决策层：持球效用 AI + 鲜明战术风格驱动 + 无球接应/压迫协调
 */
import { AttackDir, BallState, PlayerState, TacticalMods, TacticalStyle, Vec2 } from './types';
import { FORMATIONS } from './formations';
export type OnBallAction = {
    type: 'shoot';
    xG: number;
} | {
    type: 'pass';
    target: PlayerState;
    passType: 'short' | 'through' | 'cross' | 'long';
} | {
    type: 'dribble';
    targetPos: Vec2;
};
/**
 * 持球人效用决策：统一在预期收益下比较 射门 / 传球 / 盘带
 */
export declare function decideOnBall(holder: PlayerState, attackDir: AttackDir, style: TacticalStyle, players: PlayerState[], ball: BallState, mods?: TacticalMods): OnBallAction;
/**
 * 更新所有无球球员的移动目标
 */
export declare function updateOffBallTargets(players: PlayerState[], ball: BallState, homeDir: AttackDir, homeStyle: TacticalStyle, awayStyle: TacticalStyle, homeFormation: keyof typeof FORMATIONS, awayFormation: keyof typeof FORMATIONS, homeMods?: TacticalMods, awayMods?: TacticalMods): void;
