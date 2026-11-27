/**
 * @fm-league/engine - 纯 2D 实时足球比赛模拟引擎
 *
 * 特点：
 * - 10Hz 固定物理步长 (0.1s/tick)，30 ticks = 1 比赛分钟
 * - 支持 step() 逐帧驱动（小游戏/PC 60fps 插值渲染）与 simulateMatch() 整场快跑
 * - 零平台依赖，可直接打包至微信小游戏与 Steam
 */
import { CoachMatchReward, CommandCardEffect, FormationName, MatchState, TacticalCallout, TacticalStyle, TeamSetup, TeamSide, TriggerSkillResult } from './types';
export declare class MatchEngine {
    private state;
    private eventSeq;
    private stoppageTicksFirst;
    private stoppageTicksSecond;
    private lastPassTimestamp;
    private commentary;
    private lastShotType;
    private lastShotOriginPos;
    private lastPassPattern;
    private lastShotAttackPattern;
    private inMatchInjuriesThisMatch;
    private isKickoffFirst;
    private homeMods;
    private awayMods;
    private setPieceBoostTicks;
    private setPieceBoostTeam;
    private gkCounterBoostTicks;
    private tikiTakaPassCount;
    private userEquippedSkills;
    private userAspects;
    private userPerkSynergies;
    private userTeamSide;
    private userFamAvg;
    private userChemAvg;
    private pendingCoachRewards;
    private bypassOffsideTicks;
    private guaranteeShotOnTargetTicks;
    private oppTempoDrainTicks;
    private aspectRefreshUsedThisMatch;
    private prologueScriptedMode;
    private prologueSkillTriggered;
    private prologueStage;
    private prologueWaitingForCard;
    private prologueWaitingForSub;
    private prologuePendingForcedGoal;
    private prologueGuaranteedGoal;
    private prologueAllowAwayGoal;
    private prologueAwayGoalCount;
    private prologueGoalDelayTicks;
    private prologueScriptTicks;
    private pendingTacticalCallouts;
    private userScoutCounterLabel;
    private lastScoutCalloutMin;
    private lastSkillPromptMinute;
    private teamSkillGcdMinute;
    private firstHalfSkillTriggers;
    private calloutSeq;
    private pendingSkillResolution;
    private subTrackers;
    private v6PassiveHooks;
    private aiSegmentCards;
    private teamAttrCap;
    private baseTeamStyle;
    private v6ImmunityFlags;
    private v6PreventPenRedUsed;
    private v6TotalFootballMaster;
    private v6SkillTempRankBonus;
    private v6SkillDualBranch;
    private v6StartingShields;
    private v6MaxCounterStacks;
    private v6ForcedCornerProb;
    private v6PassStreak;
    private hasActiveMechanic;
    private hasImmunity;
    private getEffectiveMods;
    private getEffectiveChemDelta;
    private hasUserAspect;
    private getShieldCap;
    private getCounterCap;
    /** V6 数据驱动事件总线：统一派发 14 个比赛触发点 × 13 种原子动作 */
    private dispatchHook;
    private pushCoachReward;
    private pushTacticalCallout;
    consumeTacticalCallouts(): TacticalCallout[];
    consumeCoachRewards(): CoachMatchReward[];
    private reduceEquippedCooldowns;
    private isTrailing;
    constructor(home: TeamSetup, away: TeamSetup);
    private initState;
    getState(): MatchState;
    getPrologueTutorialState(): {
        isPrologue: boolean;
        stage: number;
        waitingForCard: 1 | 2 | null;
        waitingForSub: boolean;
        waitingForSkill: boolean;
    };
    /**
     * 实时修改战术风格或阵型（支持玩家临场 Tactical Tweaks）
     */
    setTactics(team: TeamSide, formation?: FormationName, style?: TacticalStyle): void;
    /**
     * 比赛中互换两名场上球员的战术槽位与位置角色
     */
    swapPlayerSlots(team: TeamSide, playerIdA: string, playerIdB: string): boolean;
    /**
     * 比赛中微调单个球员的球场站位偏移（传入相对球场绝对坐标目标，自动转为相对进攻方向的偏移）
     */
    setPlayerPitchTarget(team: TeamSide, playerId: string, absX: number, absY: number): boolean;
    resetPlayerOffsets(team: TeamSide): void;
    private getPlayerLine;
    /**
     * 比赛日打出教练场外指挥卡牌（支持位置限定、负面反噬与高级连锁效果）
     */
    applyCommandCard(team: TeamSide, card: CommandCardEffect): {
        ok: boolean;
        energyRefund?: number;
        comboActivated?: boolean;
    };
    /**
     * 比赛日临场换人（每队最多 5 次）
     */
    substitute(team: TeamSide, outPlayerId: string, inSubId: string): {
        ok: boolean;
        reason?: string;
    };
    private scoreScriptedPrologueGoal;
    private stepPrologueScripted;
    /**
     * 单步推进 1 个 tick (0.1s 物理时间)
     */
    step(): MatchState;
    private evaluateActiveSkillTriggers;
    private executeInstantSkillAction;
    triggerActiveSkill(team: TeamSide, skillId: string): TriggerSkillResult & {
        ok: boolean;
        boosted?: boolean;
    };
    dismissActiveSkillPrompt(): void;
    /**
     * 一键跑完全场（Headless 批量模拟用）
     */
    simulateMatch(): MatchState;
    private getAttackDir;
    private getPossessionTeam;
    private clearHolder;
    private giveBallTo;
    private setupKickoff;
    private startSecondHalf;
    private handleDeadBall;
    private handleHeldBall;
    private executePass;
    private executeShot;
    private handlePassFlight;
    private handleShotFlight;
    private handleLooseBall;
    private checkOutOfBounds;
    private handleFoul;
    private setDeadBall;
    private tryRevealHiddenTrait;
    private expireCommandBuffs;
    private updateAiAutoSubstitutions;
    private drainFitness;
    private finalizeStats;
    private pushEvent;
}
