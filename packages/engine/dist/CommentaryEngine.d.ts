/**
 * 基于《20_比赛事件文本模板.json》与《32_比赛文字直播系统设计.md》的叙事解说引擎
 * 包含 NarrativeState 状态机（梅开二度、帽子戏法、绝杀、连续射门压制、闷战氛围）
 * 零外部 JSON/fs 依赖，可直接打包至 Steam 与微信小游戏
 */
import { TeamSide } from './types';
export type CommentaryLevel = 'critical' | 'important' | 'normal' | 'minor' | 'phase';
export type NarrativeTag = 'BRACE' | 'HATTRICK' | 'LATE_WINNER' | 'MOMENTUM' | 'LULL';
export interface CommentaryResult {
    text: string;
    level: CommentaryLevel;
    narrativeTag?: NarrativeTag;
    momentumText?: string;
}
export interface GoalContext {
    minute: number;
    team: TeamSide;
    player: string;
    assist?: string;
    homeScore: number;
    awayScore: number;
    shotType?: 'normal' | 'long_range' | 'header' | 'penalty';
}
/**
 * 比赛叙事状态机：追踪个人多球里程碑、连续进攻压制与闷战时长
 */
export declare class NarrativeState {
    goalsThisMatch: {
        home: Record<string, number>;
        away: Record<string, number>;
    };
    consecutiveShots: {
        home: number;
        away: number;
    };
    lastEventMinute: number;
    momentum: 'home' | 'away' | 'even';
    onGoal(player: string, team: TeamSide, minute: number): 'HATTRICK' | 'BRACE' | null;
    onShot(team: TeamSide, teamName: string, minute: number): string | null;
    markActive(minute: number): void;
    checkLull(minute: number): string | null;
}
export declare class CommentaryEngine {
    private homeName;
    private awayName;
    readonly narrative: NarrativeState;
    constructor(homeName: string, awayName: string);
    private teamName;
    formatKickoff(minute: number): CommentaryResult;
    formatHalftime(minute: number, homeScore: number, awayScore: number): CommentaryResult;
    formatFulltime(minute: number, homeScore: number, awayScore: number): CommentaryResult;
    formatGoal(ctx: GoalContext): CommentaryResult;
    formatShot(team: TeamSide, player: string, xG: number, minute: number): CommentaryResult;
    formatSave(defTeam: TeamSide, goalkeeper: string, shooter: string, minute: number): CommentaryResult;
    formatMiss(shootTeam: TeamSide, shooter: string, minute: number): CommentaryResult;
    formatFoul(team: TeamSide, player: string, opponent: string, minute: number): CommentaryResult;
    formatYellow(team: TeamSide, player: string, minute: number): CommentaryResult;
    formatRed(team: TeamSide, player: string, isSecondYellow: boolean, minute: number): CommentaryResult;
    formatOffside(team: TeamSide, player: string, minute: number): CommentaryResult;
    formatCorner(team: TeamSide, minute: number): CommentaryResult;
    formatSubstitution(team: TeamSide, playerIn: string, playerOut: string, minute: number): CommentaryResult;
    checkLull(minute: number): CommentaryResult | null;
}
