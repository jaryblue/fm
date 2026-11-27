/**
 * @fm-league/engine - 纯 2D 实时足球比赛模拟引擎
 *
 * 特点：
 * - 10Hz 固定物理步长 (0.1s/tick)，30 ticks = 1 比赛分钟
 * - 支持 step() 逐帧驱动（小游戏/PC 60fps 插值渲染）与 simulateMatch() 整场快跑
 * - 零平台依赖，可直接打包至微信小游戏与 Steam
 */

import {
  ActiveCommandBuff,
  ActiveLegendaryAspect,
  AttackDir,
  BallState,
  CoachMatchReward,
  CommandCardEffect,
  DirectiveZone,
  EquippedActiveSkill,
  EventHookRule,
  EventHookTrigger,
  FormationName,
  ImmunityFlags,
  MatchEvent,
  MatchEventType,
  MatchState,
  PerkSkillSynergyFlags,
  PITCH,
  PlayerState,
  SIM_CONFIG,
  TacticalCallout,
  SkillInstantAction,
  SkillMutationTag,
  SkillVfxTheme,
  TACTICAL_PRESETS,
  TacticalMods,
  TacticalStyle,
  TeamMatchStats,
  TeamSetup,
  TeamSide,
  TriggerSkillResult,
  Vec2,
} from './types';
import { clamp, FORMATIONS, getDefenseSystem, gridToPitch, toAbsoluteX, toRelativeX } from './formations';
import {
  dist2D,
  launchPassBall,
  launchShotBall,
  stepBallPhysics,
  stepPlayersPhysics,
} from './physics';
import { decideOnBall, updateOffBallTargets } from './decision';
import { CommentaryEngine, CommentaryLevel, NarrativeTag } from './CommentaryEngine';

function createEmptyStats(): TeamMatchStats {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    xG: 0,
    passes: 0,
    passesSuccess: 0,
    passAccuracy: 0,
    possessionTicks: 0,
    possessionPct: 50,
    tackles: 0,
    interceptions: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    corners: 0,
    offsides: 0,
    saves: 0,
    distanceKm: 0,
  };
}

export class MatchEngine {
  private state: MatchState;
  private eventSeq = 0;
  private stoppageTicksFirst = 0;
  private stoppageTicksSecond = 0;
  private lastPassTimestamp = -999;
  private commentary: CommentaryEngine;
  private lastShotType: 'normal' | 'long_range' | 'header' | 'penalty' = 'normal';
  private lastShotOriginPos: Vec2 | null = null;
  private lastPassPattern: Record<TeamSide, string> = { home: 'central_combo', away: 'central_combo' };
  private lastShotAttackPattern: Record<TeamSide, string> = { home: 'central_combo', away: 'central_combo' };
  private inMatchInjuriesThisMatch = 0;
  private isKickoffFirst = true;
  private homeMods: TacticalMods;
  private awayMods: TacticalMods;
  private setPieceBoostTicks = 0;
  private setPieceBoostTeam: TeamSide | null = null;
  private gkCounterBoostTicks: Record<TeamSide, number> = { home: 0, away: 0 };
  private tikiTakaPassCount: Record<TeamSide, number> = { home: 0, away: 0 };
  private userEquippedSkills: EquippedActiveSkill[] = [];
  private userAspects: ActiveLegendaryAspect[] = [];
  private userPerkSynergies: PerkSkillSynergyFlags | null = null;
  private userTeamSide: TeamSide | null = null;
  private userFamAvg = 50;
  private userChemAvg = 30;
  private pendingCoachRewards: CoachMatchReward[] = [];
  private bypassOffsideTicks: Record<TeamSide, number> = { home: 0, away: 0 };
  private guaranteeShotOnTargetTicks: Record<TeamSide, number> = { home: 0, away: 0 };
  private oppTempoDrainTicks: Record<TeamSide, number> = { home: 0, away: 0 };
  private aspectRefreshUsedThisMatch = false;
  private prologueScriptedMode = false;
  private prologueSkillTriggered = false;
  private prologueStage = 0;
  private prologueWaitingForCard: 1 | 2 | null = null;
  private prologueWaitingForSub = false;
  private prologuePendingForcedGoal = false;
  private prologueGuaranteedGoal = false;
  private prologueAllowAwayGoal = false;
  private prologueAwayGoalCount = 0;
  private prologueGoalDelayTicks = 0;
  private prologueScriptTicks = 0;
  private pendingTacticalCallouts: TacticalCallout[] = [];
  private userScoutCounterLabel = '';
  private lastScoutCalloutMin = -20;
  private lastSkillPromptMinute = -99;
  private teamSkillGcdMinute: Record<TeamSide, number> = { home: 0, away: 0 };
  private firstHalfSkillTriggers = 0;
  private calloutSeq = 0;
  private pendingSkillResolution: { team: TeamSide; skillName: string; instantSummary: string; startTick: number; expiresTick: number; startShots: number; startXG: number; startGoals: number; startTackles: number } | null = null;
  private subTrackers: Array<{ playerId: string; name: string; startMin: number; startShots: number; startGoals: number; startAssists: number; startTackles: number; startInterceptions: number; reported: boolean }> = [];
  // V6 原子事件总线状态
  private v6PassiveHooks: Record<TeamSide, EventHookRule[]> = { home: [], away: [] };
  private aiSegmentCards: Record<TeamSide, Array<{ minute: number; effect: CommandCardEffect }>> = { home: [], away: [] };
  private teamAttrCap: Record<TeamSide, number> = { home: 99, away: 99 };
  private baseTeamStyle: Record<TeamSide, TacticalStyle> = { home: 'balanced', away: 'balanced' };
  private v6ImmunityFlags: Record<TeamSide, ImmunityFlags> = { home: {}, away: {} };
  private v6PreventPenRedUsed: Record<TeamSide, boolean> = { home: false, away: false };
  private v6TotalFootballMaster: Record<TeamSide, boolean> = { home: false, away: false };
  private v6SkillTempRankBonus: Record<TeamSide, number> = { home: 0, away: 0 };
  private v6SkillDualBranch: Record<TeamSide, boolean> = { home: false, away: false };
  private v6StartingShields: Record<TeamSide, number> = { home: 0, away: 0 };
  private v6MaxCounterStacks: Record<TeamSide, number> = { home: 2, away: 2 };
  private v6ForcedCornerProb: Record<TeamSide, number> = { home: 0, away: 0 };
  private v6PassStreak: Record<TeamSide, number> = { home: 0, away: 0 };

  private hasActiveMechanic(team: TeamSide, mech: NonNullable<CommandCardEffect['mechanic']>): boolean {
    return this.state.activeBuffs.some(b => b.team === team && b.effect.mechanic === mech);
  }

  private hasImmunity(team: TeamSide, key: keyof ImmunityFlags): boolean {
    if (this.v6ImmunityFlags[team]?.[key]) return true;
    return this.state.activeBuffs.some(b => b.team === team && !!b.effect.immunityFlags?.[key]);
  }

  private getEffectiveMods(team: TeamSide): TacticalMods & {
    tempoMul: number;
    foulRateMul: number;
    cornerRateMul: number;
    freeKickRateMul: number;
    blockBonus: number;
    oppShotXgPenalty: number;
    oppThroughPassBonus: number;
    interceptRangeBonus: number;
    interceptProbBonus: number;
    oppLongShotBonus: number;
    offsideTrapBonus: number;
    oppStaminaDrainPerMin: number;
    skillDualBranch: boolean;
    skillTempRankBonus: number;
  } {
    const base = team === 'home' ? this.homeMods : this.awayMods;
    const out = {
      ...base,
      tempoMul: 1.0,
      foulRateMul: 1.0,
      cornerRateMul: 1.0,
      freeKickRateMul: 1.0,
      blockBonus: 0,
      oppShotXgPenalty: 0,
      oppThroughPassBonus: 0,
      interceptRangeBonus: 0,
      interceptProbBonus: 0,
      oppLongShotBonus: 0,
      offsideTrapBonus: 0,
      oppStaminaDrainPerMin: 0,
      skillDualBranch: this.v6SkillDualBranch[team],
      skillTempRankBonus: this.v6SkillTempRankBonus[team],
    };
    const isLeading = team === 'home' ? this.state.homeScore > this.state.awayScore : this.state.awayScore > this.state.homeScore;
    for (const b of this.state.activeBuffs) {
      if (b.team !== team) continue;
      const tm = b.effect.tacticalMod;
      if (tm) {
        if (tm.lineShift) out.lineShift = clamp((out.lineShift ?? 0) + tm.lineShift, -12, 12);
        if (tm.overlapDepthBonus) out.overlapDepthBonus = (out.overlapDepthBonus ?? 0) + tm.overlapDepthBonus;
        if (tm.dualOverlap) out.dualOverlap = true;
        if (tm.falseNineDrop) out.falseNineDrop = (out.falseNineDrop ?? 0) + tm.falseNineDrop;
        if (tm.boxCrashBonus) out.boxCrashBonus = (out.boxCrashBonus ?? 0) + tm.boxCrashBonus;
        if (tm.pressDistBonus) out.pressDistBonus = (out.pressDistBonus ?? 0) + tm.pressDistBonus;
        if (tm.extraPresser) out.extraPresser = true;
        if (tm.shortPassBias) out.shortPassBias = (out.shortPassBias ?? 0) + tm.shortPassBias;
        if (tm.throughPassBias) out.throughPassBias = (out.throughPassBias ?? 0) + tm.throughPassBias;
        if (tm.crossBias) out.crossBias = (out.crossBias ?? 0) + tm.crossBias;
        if (tm.longShotBias) out.longShotBias = (out.longShotBias ?? 0) + tm.longShotBias;
        if (tm.gkQuickLaunch) out.gkQuickLaunch = true;
        if (tm.staminaDrainMul) out.staminaDrainMul = (out.staminaDrainMul ?? 1.0) * tm.staminaDrainMul;
        if (tm.tempoMul) out.tempoMul *= tm.tempoMul;
        if (tm.foulRateMul) out.foulRateMul *= tm.foulRateMul;
        if (tm.cornerRateMul) out.cornerRateMul *= tm.cornerRateMul;
        if (tm.freeKickRateMul) out.freeKickRateMul *= tm.freeKickRateMul;
        if (tm.blockBonus) out.blockBonus += tm.blockBonus;
        if (tm.oppShotXgPenalty) out.oppShotXgPenalty += tm.oppShotXgPenalty;
        if (tm.interceptRangeBonus) out.interceptRangeBonus += tm.interceptRangeBonus;
        if (tm.interceptProbBonus) out.interceptProbBonus += tm.interceptProbBonus;
        if (tm.oppThroughPassBonus) out.oppThroughPassBonus += tm.oppThroughPassBonus;
        if (tm.oppLongShotBonus) out.oppLongShotBonus += tm.oppLongShotBonus;
        if (tm.offsideTrapBonus) out.offsideTrapBonus += tm.offsideTrapBonus;
        if (tm.oppStaminaDrainPerMin) out.oppStaminaDrainPerMin += tm.oppStaminaDrainPerMin;
        if (tm.skillDualBranch) out.skillDualBranch = true;
        if (tm.skillTempRankBonus) out.skillTempRankBonus += tm.skillTempRankBonus;
      }
      if (b.comboActivated && b.effect.comboRule) {
        if (b.effect.comboRule.extraBoxCrash) out.boxCrashBonus = (out.boxCrashBonus ?? 0) + b.effect.comboRule.extraBoxCrash;
        if (b.effect.comboRule.extraCornerMul) out.cornerRateMul *= b.effect.comboRule.extraCornerMul;
      }
      const af = b.effect.affix;
      if (af) {
        if (af.foulRateMul) out.foulRateMul *= af.foulRateMul;
        if (af.lineShiftDelta) out.lineShift = clamp((out.lineShift ?? 0) + af.lineShiftDelta, -12, 12);
        if (af.oppThroughPassBonus) out.oppThroughPassBonus += af.oppThroughPassBonus;
        if (af.mouBusLeading && isLeading) out.oppShotXgPenalty += 0.22;
      }
    }
    return out;
  }

  private getEffectiveChemDelta(team: TeamSide): number {
    let delta = 0;
    for (const b of this.state.activeBuffs) {
      if (b.team !== team) continue;
      if (b.effect.chemistryMod) {
        delta += b.effect.chemistryMod.setTo100 ? 60 : b.effect.chemistryMod.delta;
      }
      if (b.comboActivated && b.effect.comboRule?.extraChemistry) {
        delta += b.effect.comboRule.extraChemistry;
      }
      if (b.effect.affix?.chemistryPenalty) {
        delta += b.effect.affix.chemistryPenalty;
      }
    }
    return delta;
  }

  private hasUserAspect(mechanicKey: string): boolean {
    return this.userAspects.some(a => a.mechanicKey === mechanicKey);
  }

  private getShieldCap(): number {
    return this.hasUserAspect('fortress_shield_start2') || this.v6StartingShields.home >= 2 ? 3 : 2;
  }

  private getCounterCap(): number {
    const side = this.userTeamSide ?? 'home';
    return Math.max(this.hasUserAspect('absorb_max3_counter') ? 3 : 2, this.v6MaxCounterStacks[side] ?? 2);
  }

  /** V6 数据驱动事件总线：统一派发 14 个比赛触发点 × 13 种原子动作 */
  private dispatchHook(
    team: TeamSide,
    trigger: EventHookTrigger,
    ctx?: { passStreak?: number; possessionPct?: number; zeroConceded?: boolean; expiringBuff?: ActiveCommandBuff }
  ): void {
    const s = this.state;
    const oppTeam: TeamSide = team === 'home' ? 'away' : 'home';
    const sources: Array<{ rules: EventHookRule[]; buff?: ActiveCommandBuff }> = [];
    if (this.v6PassiveHooks[team]?.length) {
      sources.push({ rules: this.v6PassiveHooks[team] });
    }
    if (ctx?.expiringBuff?.effect.eventHooks?.length) {
      sources.push({ rules: ctx.expiringBuff.effect.eventHooks, buff: ctx.expiringBuff });
    } else {
      for (const b of s.activeBuffs) {
        if (b.team === team && b.effect.eventHooks?.length) {
          sources.push({ rules: b.effect.eventHooks, buff: b });
        }
      }
    }
    for (const src of sources) {
      for (let idx = 0; idx < src.rules.length; idx++) {
        const rule = src.rules[idx];
        if (rule.trigger !== trigger) continue;
        if (rule.streakTarget && (ctx?.passStreak ?? 0) < rule.streakTarget) continue;
        if (rule.minPossession && (ctx?.possessionPct ?? 0) < rule.minPossession) continue;
        if (rule.requireZeroConceded && !ctx?.zeroConceded) continue;
        if (rule.maxPerBuff && src.buff) {
          src.buff.hookUseCount = src.buff.hookUseCount ?? {};
          const key = `${trigger}_${idx}`;
          if ((src.buff.hookUseCount[key] ?? 0) >= rule.maxPerBuff) continue;
          src.buff.hookUseCount[key] = (src.buff.hookUseCount[key] ?? 0) + 1;
        }
        const val = rule.value ?? 1;
        switch (rule.action) {
          case 'healTeam':
            for (const p of s.players) {
              if (p.team === team && !p.redCard) p.fitness = Math.min(100, p.fitness + val);
            }
            break;
          case 'drainOppStamina':
            for (const p of s.players) {
              if (p.team === oppTeam && !p.redCard) p.fitness = Math.max(20, p.fitness - val);
            }
            break;
          case 'oppComposureDebuff':
            for (const p of s.players) {
              if (p.team === oppTeam && !p.redCard) p.attributes.composure = Math.max(25, p.attributes.composure - val);
            }
            break;
          case 'cutSkillCd':
            if (team === this.userTeamSide) this.reduceEquippedCooldowns(val);
            break;
          case 'addShield':
            if (team === this.userTeamSide && s.aspectStacks) {
              s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + val);
            }
            break;
          case 'addCounter':
            if (team === this.userTeamSide && s.aspectStacks) {
              s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + val);
            }
            break;
          case 'grantBypassOffside':
            this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], val);
            break;
          case 'grantOnTarget':
            this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], val);
            break;
          case 'stealTempo':
            this.oppTempoDrainTicks[oppTeam] = Math.max(this.oppTempoDrainTicks[oppTeam], val);
            break;
          case 'forceCornerProb':
            this.v6ForcedCornerProb[team] = Math.max(this.v6ForcedCornerProb[team], val);
            break;
          case 'extendDirective':
            for (const b of s.activeBuffs) {
              if (b.team === team && !b.effect.id.startsWith('sk_')) {
                b.endMinute = Math.min(95, b.endMinute + val);
              }
            }
            break;
          case 'forceYellowCard': {
            const targetDef = s.players
              .filter(p => p.team === oppTeam && !p.redCard && p.role !== 'GK')
              .sort((a, c) => dist2D(a.pos, s.ball.pos) - dist2D(c.pos, s.ball.pos))[0];
            if (targetDef) {
              targetDef.yellowCards++;
              s.stats[oppTeam].yellowCards++;
              this.pushEvent('yellow_card', oppTeam, targetDef.id, targetDef.name, targetDef.pos, `【战术造牌】${targetDef.name} 被主裁出示黄牌！`, undefined, 'important');
              if (targetDef.yellowCards >= 2) {
                targetDef.redCard = true;
                s.stats[oppTeam].redCards++;
                this.pushEvent('red_card', oppTeam, targetDef.id, targetDef.name, targetDef.pos, `【两黄变红】${targetDef.name} 被红牌罚出场外！`, undefined, 'critical');
              }
            }
            break;
          }
          case 'triggerMiniBuff': {
            const preset = rule.miniBuffPreset ?? 'pace_burst';
            const mini: CommandCardEffect = preset === 'counter_burst'
              ? { id: `v6_mini_${s.tick}`, name: '反击爆发', durationMinutes: 5, paceDelta: 10, tacticalMod: { throughPassBias: 0.12, tempoMul: 1.15 } }
              : preset === 'shot_burst'
              ? { id: `v6_mini_${s.tick}`, name: '强攻爆发', durationMinutes: 4, shootingDelta: 10, tacticalMod: { tempoMul: 1.12 } }
              : preset === 'tempo_burst'
              ? { id: `v6_mini_${s.tick}`, name: '推进提速', durationMinutes: 3, paceDelta: 6, tacticalMod: { tempoMul: 1.15 } }
              : { id: `v6_mini_${s.tick}`, name: '瞬时冲刺', durationMinutes: 4, paceDelta: 10 };
            this.applyCommandCard(team, mini);
            break;
          }
        }
      }
    }
  }

  private pushCoachReward(reward: CoachMatchReward): void {
    this.pendingCoachRewards.push(reward);
  }

  private pushTacticalCallout(player: PlayerState, label: string, kind: TacticalCallout['kind']): void {
    this.calloutSeq++;
    if (player.team === this.userTeamSide && this.state.tacticalStats) {
      if (kind === 'trait') this.state.tacticalStats.traitTriggers++;
      else if (kind === 'chemistry') this.state.tacticalStats.chemPasses++;
      else if (kind === 'scout') this.state.tacticalStats.scoutCounters++;
    }
    if (this.pendingTacticalCallouts.length >= 12) return;
    this.pendingTacticalCallouts.push({
      id: `tc_${this.calloutSeq}`,
      tick: this.state.tick,
      playerId: player.id,
      team: player.team,
      label,
      kind,
      pos: { x: player.pos.x, y: player.pos.y },
    });
  }

  public consumeTacticalCallouts(): TacticalCallout[] {
    if (this.pendingTacticalCallouts.length === 0) return [];
    const out = this.pendingTacticalCallouts;
    this.pendingTacticalCallouts = [];
    return out;
  }

  public consumeCoachRewards(): CoachMatchReward[] {
    if (this.pendingCoachRewards.length === 0) return [];
    const copy = [...this.pendingCoachRewards];
    this.pendingCoachRewards.length = 0;
    return copy;
  }

  private reduceEquippedCooldowns(minutes: number): void {
    const s = this.state;
    if (!s.skillCooldowns) return;
    for (const k of Object.keys(s.skillCooldowns)) {
      s.skillCooldowns[k] = Math.max(s.minute, (s.skillCooldowns[k] ?? s.minute) - minutes);
    }
  }

  private isTrailing(team: TeamSide): boolean {
    return team === 'home'
      ? this.state.homeScore < this.state.awayScore
      : this.state.awayScore < this.state.homeScore;
  }

  constructor(home: TeamSetup, away: TeamSetup) {
    this.prologueScriptedMode = !!(home.prologueScripted || away.prologueScripted);
    this.stoppageTicksFirst = this.prologueScriptedMode ? 0 : Math.floor(Math.random() * 60);  // 0-2 分钟
    this.stoppageTicksSecond = this.prologueScriptedMode ? 60 : 30 + Math.floor(Math.random() * 90); // 1-4 分钟
    this.homeMods = home.tacticalMods ? { ...home.tacticalMods } : {};
    this.awayMods = away.tacticalMods ? { ...away.tacticalMods } : {};
    this.v6PassiveHooks = {
      home: home.v6PassiveHooks ? [...home.v6PassiveHooks] : [],
      away: away.v6PassiveHooks ? [...away.v6PassiveHooks] : [],
    };
    this.aiSegmentCards = {
      home: home.aiSegmentCards ? [...home.aiSegmentCards] : [],
      away: away.aiSegmentCards ? [...away.aiSegmentCards] : [],
    };
    this.teamAttrCap = {
      home: home.hiddenAttrCap ?? 99,
      away: away.hiddenAttrCap ?? 99,
    };
    this.baseTeamStyle = {
      home: home.style,
      away: away.style,
    };
    this.v6ImmunityFlags = {
      home: home.v6ImmunityFlags ? { ...home.v6ImmunityFlags } : {},
      away: away.v6ImmunityFlags ? { ...away.v6ImmunityFlags } : {},
    };
    this.v6TotalFootballMaster = { home: !!home.v6TotalFootballMaster, away: !!away.v6TotalFootballMaster };
    this.v6SkillTempRankBonus = { home: home.v6SkillTempRankBonus ?? 0, away: away.v6SkillTempRankBonus ?? 0 };
    this.v6SkillDualBranch = { home: !!home.v6SkillDualBranch, away: !!away.v6SkillDualBranch };
    this.v6StartingShields = { home: home.v6StartingShields ?? 0, away: away.v6StartingShields ?? 0 };
    this.v6MaxCounterStacks = { home: home.v6MaxCounterStacks ?? 2, away: away.v6MaxCounterStacks ?? 2 };
    if ((home.equippedSkills && home.equippedSkills.length > 0) || (home.activeAspects && home.activeAspects.length > 0) || (home.v6PassiveHooks && home.v6PassiveHooks.length > 0)) {
      this.userTeamSide = 'home';
      this.userEquippedSkills = [...(home.equippedSkills ?? [])];
      this.userAspects = [...(home.activeAspects ?? [])];
      this.userPerkSynergies = home.perkSynergies ?? null;
      this.userFamAvg = home.teamFamiliarityAvg ?? 50;
      this.userChemAvg = home.teamChemistryAvg ?? 30;
      this.userScoutCounterLabel = home.scoutCounterLabel ?? '';
    } else if ((away.equippedSkills && away.equippedSkills.length > 0) || (away.activeAspects && away.activeAspects.length > 0) || away.scoutCounterLabel) {
      this.userTeamSide = 'away';
      this.userEquippedSkills = [...(away.equippedSkills ?? [])];
      this.userAspects = [...(away.activeAspects ?? [])];
      this.userPerkSynergies = away.perkSynergies ?? null;
      this.userFamAvg = away.teamFamiliarityAvg ?? 50;
      this.userChemAvg = away.teamChemistryAvg ?? 30;
      this.userScoutCounterLabel = away.scoutCounterLabel ?? '';
    } else if (this.prologueScriptedMode) {
      this.userTeamSide = home.prologueScripted ? 'home' : 'away';
    }
    this.commentary = new CommentaryEngine(home.name, away.name);
    this.state = this.initState(home, away);
    this.setupKickoff('home');
    if (this.prologueScriptedMode) {
      this.state.tick = 45 * SIM_CONFIG.TICKS_PER_MINUTE;
      this.state.minute = 45;
      this.state.phase = 'second_half';
      this.state.homeAttackDir = 1;
      this.state.homeScore = 0;
      this.state.awayScore = 1;
      this.state.stats.home.goals = 0;
      this.state.stats.away.goals = 1;
      this.pushEvent('commentary', 'home', '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, '【序章·下半场 45\'】0:1 落后！唯有赢下今晚这场决战，才能捧起超级联赛冠军奖杯！', undefined, 'important');
    }
  }

  private initState(home: TeamSetup, away: TeamSetup): MatchState {
    const players: PlayerState[] = [];
    const buildTeam = (setup: TeamSetup, team: TeamSide, dir: AttackDir) => {
      const slots = FORMATIONS[setup.formation];
      for (let i = 0; i < 11; i++) {
        const input = setup.players[i];
        const slot = slots[i];
        const gridPos = setup.gridSlots?.[i];
        const effBaseX = gridPos ? gridToPitch(gridPos.col, gridPos.row).baseX : slot.baseX;
        const effBaseY = gridPos ? gridToPitch(gridPos.col, gridPos.row).baseY : slot.baseY;
        const absX = toAbsoluteX(effBaseX, dir);
        players.push({
          id: input.id,
          name: input.name,
          team,
          role: slot.role,
          duty: setup.slotDuties?.[i] ?? 'default',
          slotIndex: i,
          shirtNumber: input.shirtNumber,
          pos: { x: absX, y: effBaseY },
          vel: { x: 0, y: 0 },
          targetPos: { x: absX, y: effBaseY },
          attributes: { ...input.attributes },
          traits: input.traits ? [...input.traits] : [],
          goldTraits: input.goldTraits ? [...input.goldTraits] : [],
          silverTraits: input.silverTraits ? [...input.silverTraits] : [],
          hiddenTrait: input.hiddenTrait,
          secondaryRoles: input.secondaryRoles ? [...input.secondaryRoles] : [],
          pa: input.pa,
          isStarred: !!input.isStarred,
          fitness: input.fitness ?? 100,
          strainWarning: input.strainWarning,
          isCaptain: input.isCaptain,
          hasBall: false,
          yellowCards: 0,
          redCard: false,
          decisionCooldown: 0,
          stunTicks: 0,
          matchStats: {
            goals: 0,
            assists: 0,
            shots: 0,
            passes: 0,
            passesSuccess: 0,
            tackles: 0,
            interceptions: 0,
            saves: 0,
            distanceM: 0,
          },
        });
      }
      // 个人阵型熟练度与中轴脊柱共振加成
      const teamPlayers = players.filter(p => p.team === team);
      const spineRoles = new Set(['GK', 'CB', 'CDM', 'CM', 'CAM', 'ST']);
      const spineBonus = setup.centralSpineBonus ?? 0;
      for (let ti = 0; ti < teamPlayers.length; ti++) {
        const tp = teamPlayers[ti];
        const fam = setup.players[ti]?.formationFamiliarity;
        if (fam !== undefined) {
          if (fam < 35) {
            tp.attributes.positioning = Math.max(25, tp.attributes.positioning - 2);
            tp.attributes.composure = Math.max(25, tp.attributes.composure - 2);
          } else if (fam >= 85) {
            tp.attributes.positioning = Math.min(99, tp.attributes.positioning + 3);
            tp.attributes.composure = Math.min(99, tp.attributes.composure + 3);
            tp.attributes.passing = Math.min(99, tp.attributes.passing + 2);
          } else if (fam >= 65) {
            tp.attributes.positioning = Math.min(99, tp.attributes.positioning + 2);
            tp.attributes.composure = Math.min(99, tp.attributes.composure + 2);
          }
        }
        if (spineBonus > 0 && spineRoles.has(tp.role)) {
          tp.attributes.passing = Math.min(99, tp.attributes.passing + spineBonus);
          tp.attributes.composure = Math.min(99, tp.attributes.composure + spineBonus);
        }
      }
      // 队长袖标光环：队长本人在场时冷静+4/传球+3，队友冷静+2/传球+1
      if (teamPlayers.some(p => p.isCaptain)) {
        for (const tp of teamPlayers) {
          if (tp.isCaptain) {
            tp.attributes.composure = Math.min(99, tp.attributes.composure + 4);
            tp.attributes.passing = Math.min(99, tp.attributes.passing + 3);
          } else {
            tp.attributes.composure = Math.min(99, tp.attributes.composure + 2);
            tp.attributes.passing = Math.min(99, tp.attributes.passing + 1);
          }
        }
      }
    };

    buildTeam(home, 'home', 1);
    buildTeam(away, 'away', -1);

    return {
      tick: 0,
      minute: 0,
      phase: 'first_half',
      weather: home.weather ?? away.weather ?? 'sunny',
      homeName: home.name,
      awayName: away.name,
      homeFormation: home.formation,
      awayFormation: away.formation,
      homeStyle: home.style,
      awayStyle: away.style,
      homeAttackDir: 1,
      homeScore: 0,
      awayScore: 0,
      players,
      homeSubs: home.subs ? [...home.subs] : [],
      awaySubs: away.subs ? [...away.subs] : [],
      homeSubsUsed: 0,
      awaySubsUsed: 0,
      ball: {
        pos: { x: PITCH.HALF_X, y: PITCH.HALF_Y, z: 0 },
        vel: { x: 0, y: 0, z: 0 },
        mode: 'dead',
        holderId: null,
        lastTouchTeam: 'home',
        lastPasserId: null,
        targetPlayerId: null,
        passType: null,
        shotShooterId: null,
        shotXG: 0,
        shotOnTarget: false,
        shotTargetY: PITCH.GOAL_Y,
        shotTargetZ: 1.0,
        deadTimer: 0,
        restartTeam: 'home',
        restartType: 'kickoff',
        restartPos: { x: PITCH.HALF_X, y: PITCH.HALF_Y },
      },
      events: [],
      unlockedHiddenTraits: [],
      activeBuffs: [],
      stats: {
        home: createEmptyStats(),
        away: createEmptyStats(),
      },
      pairPasses: {},
      pairAssists: {},
      tacticalStats: { traitTriggers: 0, chemPasses: 0, scoutCounters: 0 },
      activeSkillPrompt: null,
      skillUses: {},
      skillCooldowns: {},
      activeAspects: [...this.userAspects],
      aspectStacks: {
        shieldCharges: Math.min(
          this.getShieldCap(),
          (this.hasUserAspect('fortress_shield_start2')
            ? 2
            : (this.hasUserAspect('bus_shield_start1') || this.hasUserAspect('gk_shield_start1') ? 1 : 0)) +
          (this.v6StartingShields[this.userTeamSide ?? 'home'] ?? 0)
        ),
        counterCharges: 0,
        passSeq: 0,
      },
      teamStance: { home: home.style, away: away.style },
      stanceSwitchCount: { home: 0, away: 0 },
      lastConcededMin: { home: -99, away: -99 },
      lastSaveMin: { home: -99, away: -99 },
      deckArchetypeGene: { home: home.deckArchetypeGene, away: away.deckArchetypeGene },
      pendingClutchSetPiece: { home: false, away: false },
      usedDirectiveZones: { home: [], away: [] },
      totalFootballZoneTriggered: { home: false, away: false },
    };
  }

  public getState(): MatchState {
    return this.state;
  }

  public getPrologueTutorialState(): {
    isPrologue: boolean;
    stage: number;
    waitingForCard: 1 | 2 | null;
    waitingForSub: boolean;
    waitingForSkill: boolean;
  } {
    return {
      isPrologue: this.prologueScriptedMode,
      stage: this.prologueStage,
      waitingForCard: this.prologueWaitingForCard,
      waitingForSub: this.prologueWaitingForSub,
      waitingForSkill: !!this.state.activeSkillPrompt && this.prologueScriptedMode,
    };
  }

  /**
   * 实时修改战术风格或阵型（支持玩家临场 Tactical Tweaks）
   */
  public setTactics(team: TeamSide, formation?: FormationName, style?: TacticalStyle): void {
    if (team === 'home') {
      if (formation) this.state.homeFormation = formation;
      if (style) this.state.homeStyle = style;
    } else {
      if (formation) this.state.awayFormation = formation;
      if (style) this.state.awayStyle = style;
    }
    if (formation) {
      const slots = FORMATIONS[formation];
      for (const p of this.state.players) {
        if (p.team === team && slots[p.slotIndex]) {
          p.role = slots[p.slotIndex].role;
        }
      }
    }
  }

  /**
   * 比赛中互换两名场上球员的战术槽位与位置角色
   */
  public swapPlayerSlots(team: TeamSide, playerIdA: string, playerIdB: string): boolean {
    if (playerIdA === playerIdB) return false;
    const a = this.state.players.find(p => p.id === playerIdA && p.team === team && !p.redCard);
    const b = this.state.players.find(p => p.id === playerIdB && p.team === team && !p.redCard);
    if (!a || !b) return false;
    const tmpSlot = a.slotIndex;
    const tmpRole = a.role;
    const tmpOffset = a.customOffset ? { ...a.customOffset } : undefined;
    a.slotIndex = b.slotIndex;
    a.role = b.role;
    a.customOffset = b.customOffset ? { ...b.customOffset } : undefined;
    b.slotIndex = tmpSlot;
    b.role = tmpRole;
    b.customOffset = tmpOffset;
    return true;
  }

  /**
   * 比赛中微调单个球员的球场站位偏移（传入相对球场绝对坐标目标，自动转为相对进攻方向的偏移）
   */
  public setPlayerPitchTarget(team: TeamSide, playerId: string, absX: number, absY: number): boolean {
    const p = this.state.players.find(x => x.id === playerId && x.team === team && !x.redCard);
    if (!p) return false;
    const dir = this.getAttackDir(team);
    const form = team === 'home' ? this.state.homeFormation : this.state.awayFormation;
    const slot = FORMATIONS[form][p.slotIndex] || FORMATIONS[form][0];
    const baseAbsX = toAbsoluteX(slot.baseX, dir);
    const dx = clamp((absX - baseAbsX) * dir, -20, 20);
    const dy = clamp(absY - slot.baseY, -18, 18);
    p.customOffset = { x: dx, y: dy };
    p.targetPos = { x: clamp(absX, 3, PITCH.LENGTH - 3), y: clamp(absY, 3, PITCH.WIDTH - 3) };
    return true;
  }

  public resetPlayerOffsets(team: TeamSide): void {
    for (const p of this.state.players) {
      if (p.team === team) p.customOffset = undefined;
    }
  }

  private getPlayerLine(role: PlayerState['role']): 'GK' | 'DEF' | 'MID' | 'ATT' {
    if (role === 'GK') return 'GK';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role)) return 'DEF';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(role)) return 'MID';
    return 'ATT';
  }

  /**
   * 比赛日打出教练场外指挥卡牌（支持位置限定、负面反噬与高级连锁效果）
   */
  public applyCommandCard(team: TeamSide, card: CommandCardEffect): { ok: boolean; energyRefund?: number; comboActivated?: boolean } {
    if (!card) return { ok: false };
    const s = this.state;
    if (this.prologueScriptedMode && team === this.userTeamSide && !card.id.startsWith('sk_')) {
      if (this.prologueWaitingForCard === null) {
        return { ok: false };
      }
      if (this.prologueWaitingForCard === 1 && card.id !== 'prologue_card_wing_stance') {
        return { ok: false };
      }
      if (this.prologueWaitingForCard === 2 && card.id !== 'prologue_card_wing_combo') {
        return { ok: false };
      }
    }
    const clampAttr = (v: number) => Math.max(25, Math.min(this.teamAttrCap[team], v));
    const targetLine = card.targetLine ?? 'ALL';
    const hadActiveBuff = s.activeBuffs.some(b => b.team === team);
    let energyRefund = 0;

    // V5 态势与连击判定
    s.teamStance = s.teamStance ?? { home: s.homeStyle, away: s.awayStyle };
    s.stanceSwitchCount = s.stanceSwitchCount ?? { home: 0, away: 0 };
    const curStance = s.teamStance[team];
    const isBalancedBase = this.baseTeamStyle[team] === 'balanced';
    const comboActivated = !!(card.comboRule && (
      isBalancedBase ||
      card.comboRule.anyStance ||
      card.affix?.anyStanceCombo ||
      (card.comboRule.requiresStance && curStance === card.comboRule.requiresStance)
    ));
    if (card.stance) {
      if (s.teamStance[team] !== card.stance && !isBalancedBase) {
        s.stanceSwitchCount[team] = (s.stanceSwitchCount[team] ?? 0) + 1;
      }
      s.teamStance[team] = card.stance;
      if (team === 'home') s.homeStyle = card.stance;
      else s.awayStyle = card.stance;
    }
    this.pushEvent(
      'tactic',
      team,
      '',
      card.name,
      { x: PITCH.HALF_X, y: PITCH.HALF_Y },
      `教练打出【${card.name}】${comboActivated ? '触发态势连击！' : '临场指令生效！'}`,
      undefined,
      comboActivated ? 'important' : 'normal'
    );

    // 彩蛋词条【弗格森时间】：80'后打出属性加成翻倍
    const fergieMul = card.affix?.fergieTime && s.minute >= 80 ? 2 : 1;
    let starPlayerId: string | null = null;
    if (card.starPlayerTarget) {
      const teamPlayers = s.players.filter(p => p.team === team && !p.redCard && p.role !== 'GK');
      if (teamPlayers.length > 0) {
        const sorted = [...teamPlayers].sort((a, b) => {
          if (card.starPlayerTarget === 'top_shooter') return b.attributes.shooting - a.attributes.shooting;
          if (card.starPlayerTarget === 'top_passer') return b.attributes.passing - a.attributes.passing;
          return b.attributes.pace - a.attributes.pace;
        });
        starPlayerId = sorted[0].id;
      }
    }

    const effPassing = (card.passingDelta ?? 0) * fergieMul;
    const effShooting = ((card.shootingDelta ?? 0) + (comboActivated ? (card.comboRule?.extraShooting ?? 0) : 0)) * fergieMul;
    const effDefending = ((card.defendingDelta ?? 0) + (comboActivated ? (card.comboRule?.extraDefending ?? 0) : 0)) * fergieMul;
    const effPace = ((card.paceDelta ?? 0) + (comboActivated ? (card.comboRule?.extraPace ?? 0) : 0)) * fergieMul;
    const effComposure = (card.composureDelta ?? 0) * fergieMul;
    const effGK = ((card.goalkeepingDelta ?? 0) + (comboActivated ? (card.comboRule?.extraGoalkeeping ?? 0) : 0)) * fergieMul;
    const effFitGain = (card.fitnessInstantDelta ?? 0) + (comboActivated ? (card.comboRule?.fitnessGain ?? 0) : 0);

    for (const p of s.players) {
      if (p.redCard) continue;
      if (p.team === team) {
        const matchLine = starPlayerId
          ? p.id === starPlayerId
          : (targetLine === 'ALL' || this.getPlayerLine(p.role) === targetLine);
        if (matchLine) {
          if (effFitGain) p.fitness = Math.max(20, Math.min(100, p.fitness + effFitGain));
          if (effPassing) p.attributes.passing = clampAttr(p.attributes.passing + effPassing);
          if (effShooting) p.attributes.shooting = clampAttr(p.attributes.shooting + effShooting);
          if (effDefending) p.attributes.defending = clampAttr(p.attributes.defending + effDefending);
          if (effPace) p.attributes.pace = clampAttr(p.attributes.pace + effPace);
          if (effComposure) p.attributes.composure = clampAttr(p.attributes.composure + effComposure);
          if (effGK && p.role === 'GK') p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + effGK);
        }
        if (card.penaltyFitnessDelta) p.fitness = Math.max(20, Math.min(100, p.fitness + card.penaltyFitnessDelta));
        if (card.penaltyAllDefDelta) p.attributes.defending = clampAttr(p.attributes.defending + card.penaltyAllDefDelta);
        if (card.affix?.allPacePenalty) p.attributes.pace = clampAttr(p.attributes.pace + card.affix.allPacePenalty);
        if (card.affix?.defPacePenalty && this.getPlayerLine(p.role) === 'DEF') {
          p.attributes.pace = clampAttr(p.attributes.pace + card.affix.defPacePenalty);
        }
        if (card.chainEffect?.type === 'spread_all' && !matchLine) {
          p.attributes.passing = clampAttr(p.attributes.passing + 4);
          p.attributes.composure = clampAttr(p.attributes.composure + 4);
        } else if (card.chainEffect?.type === 'synergy_boost' && hadActiveBuff) {
          p.attributes.pace = clampAttr(p.attributes.pace + 6);
          p.attributes.shooting = clampAttr(p.attributes.shooting + 6);
        } else if (card.chainEffect?.type === 'fitness_leech') {
          p.fitness = Math.min(100, p.fitness + 8);
        }
      } else {
        if (card.chainEffect?.type === 'fitness_leech') p.fitness = Math.max(20, p.fitness - 8);
        if (card.oppDebuff?.oppFitnessDelta) p.fitness = Math.max(20, Math.min(100, p.fitness + card.oppDebuff.oppFitnessDelta));
        if (card.oppDebuff?.oppComposureDelta) p.attributes.composure = clampAttr(p.attributes.composure + card.oppDebuff.oppComposureDelta);
        if (comboActivated && card.comboRule?.fitnessLeech) p.fitness = Math.max(20, p.fitness - card.comboRule.fitnessLeech);
      }
    }
    if (card.chainEffect?.type === 'energy_refund') energyRefund += 1;
    if (comboActivated && card.comboRule?.energyRefund) energyRefund += card.comboRule.energyRefund;
    if (card.affix?.energyRefundBonus) energyRefund += card.affix.energyRefundBonus;
    if (card.affix?.clutchSetPiece85 && s.minute >= 85) {
      const myG = team === 'home' ? s.homeScore : s.awayScore;
      const opG = team === 'home' ? s.awayScore : s.homeScore;
      if (myG <= opG) {
        s.pendingClutchSetPiece = s.pendingClutchSetPiece ?? { home: false, away: false };
        s.pendingClutchSetPiece[team] = true;
      }
    }
    if (this.userTeamSide === team && card.element && !card.id.startsWith('sk_')) {
      if (card.element === 'press' && !energyRefund && this.hasUserAspect('press_refund') && Math.random() < 0.50) {
        energyRefund = 1;
        this.pushEvent('commentary', team, '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, '【不熄压迫核心】威能共鸣，返还 1 点指挥能量！', undefined, 'important');
      }
      if (s.skillCooldowns) {
        for (const eq of this.userEquippedSkills) {
          if (eq.linkedElement === card.element && (s.skillCooldowns[eq.id] ?? 0) > s.minute) {
            s.skillCooldowns[eq.id] = Math.max(s.minute, s.skillCooldowns[eq.id] - 1);
          }
          if (card.skillSynergy?.freeCooldownOnce && (
            card.skillSynergy.targetSkillTags.includes('all') ||
            card.skillSynergy.targetSkillTags.includes(eq.situation)
          )) {
            s.skillCooldowns[eq.id] = s.minute;
          }
        }
      }
    }
    if (this.prologueScriptedMode && team === this.userTeamSide && !card.id.startsWith('sk_')) {
      const dir = this.getAttackDir(team);
      const striker = s.players.find(p => p.team === team && !p.redCard && p.id === 'prologue_st_19');
      if (striker) {
        striker.targetPos = { x: dir === 1 ? PITCH.LENGTH - 16 : 16, y: PITCH.GOAL_Y };
      }
      if (this.prologueStage === 0) {
        this.prologueStage = 1;
        this.prologueWaitingForCard = null;
        this.prologuePendingForcedGoal = true;
        this.prologueGoalDelayTicks = 18;
        this.prologueScriptTicks = 0;
      } else if (this.prologueStage === 2) {
        this.prologueStage = 3;
        this.prologueWaitingForCard = null;
        this.prologuePendingForcedGoal = true;
        this.prologueGoalDelayTicks = 18;
        this.prologueScriptTicks = 0;
      }
    }
    if (card.forceStyle) {
      this.setTactics(team, undefined, card.forceStyle);
    }
    const extraDur = comboActivated ? (card.comboRule?.durationBonus ?? 0) : 0;
    const endMinute = Math.min(95, s.minute + card.durationMinutes + extraDur);
    const stTeam = s.stats[team];
    const curConceded = team === 'home' ? s.awayScore : s.homeScore;
    s.activeBuffs.push({
      team,
      name: card.name,
      endMinute,
      comboActivated,
      startConceded: curConceded,
      hookUseCount: {},
      effect: {
        ...card,
        passingDelta: effPassing || undefined,
        shootingDelta: effShooting || undefined,
        defendingDelta: effDefending || undefined,
        paceDelta: effPace || undefined,
        composureDelta: effComposure || undefined,
        goalkeepingDelta: effGK || undefined,
      },
      startStats: {
        shots: stTeam.shots,
        xG: stTeam.xG,
        goals: stTeam.goals,
        tackles: stTeam.tackles,
        passesSuccess: stTeam.passesSuccess,
      },
    });
    // V6 圆心【全攻全守 Zone】三区交响曲追踪
    if (card.zone && !card.id.startsWith('sk_') && !card.id.startsWith('v6_mini_')) {
      s.usedDirectiveZones = s.usedDirectiveZones ?? { home: [], away: [] };
      if (!s.usedDirectiveZones[team].includes(card.zone)) {
        s.usedDirectiveZones[team].push(card.zone);
      }
      if (
        this.v6TotalFootballMaster[team] &&
        !s.totalFootballZoneTriggered?.[team] &&
        s.usedDirectiveZones[team].length >= 3
      ) {
        s.totalFootballZoneTriggered = s.totalFootballZoneTriggered ?? { home: false, away: false };
        s.totalFootballZoneTriggered[team] = true;
        this.pushEvent('commentary', team, '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, '★【全攻全守 Zone 觉醒】前/中/后三区交响曲齐鸣！全队全属性 +6、体能消耗减半！', undefined, 'critical');
        this.applyCommandCard(team, {
          id: 'v6_mini_total_football',
          name: '★ 全攻全守 Zone',
          durationMinutes: 20,
          passingDelta: 6,
          shootingDelta: 6,
          defendingDelta: 6,
          paceDelta: 6,
          composureDelta: 6,
          tacticalMod: { staminaDrainMul: 0.55, tempoMul: 1.15 },
        });
      }
    }
    const comboTag = comboActivated && card.comboRule ? ` · 连击【${card.comboRule.label}】` : '';
    const affixTag = card.affix ? ` · [${card.affix.name}]` : '';
    this.pushEvent(
      'commentary',
      team,
      '',
      '',
      { x: PITCH.HALF_X, y: PITCH.HALF_Y },
      `【教练指挥】${card.name} 生效（持续至 ${endMinute}'）${comboTag}${affixTag}`,
      undefined,
      'important'
    );
    return { ok: true, energyRefund, comboActivated };
  }

  /**
   * 比赛日临场换人（每队最多 5 次）
   */
  public substitute(team: TeamSide, outPlayerId: string, inSubId: string): { ok: boolean; reason?: string } {
    const s = this.state;
    if (this.prologueScriptedMode && team === this.userTeamSide) {
      if (!this.prologueWaitingForSub) {
        return { ok: false, reason: '序章教学阶段暂未到换人时机，请先按场上提示指挥！' };
      }
      if (inSubId !== 'prologue_vet_10') {
        return { ok: false, reason: '请换上替补席的老队长 #10 梅利纳！' };
      }
    }
    const used = team === 'home' ? s.homeSubsUsed : s.awaySubsUsed;
    if (used >= 5) return { ok: false, reason: '换人名额已用完 (5/5)' };

    const subs = team === 'home' ? s.homeSubs : s.awaySubs;
    const subIdx = subs.findIndex(p => p.id === inSubId);
    const outPlayer = s.players.find(p => p.id === outPlayerId && p.team === team && !p.redCard);
    if (subIdx < 0 || !outPlayer) return { ok: false, reason: '无效的换人目标' };

    const sub = subs.splice(subIdx, 1)[0];
    const wasHolding = s.ball.holderId === outPlayer.id;

    // 替换场上球员实体（保留原战术槽位与坐标）
    const pIdx = s.players.indexOf(outPlayer);
    const newPlayer: PlayerState = {
      id: sub.id,
      name: sub.name,
      team,
      role: outPlayer.role,
      slotIndex: outPlayer.slotIndex,
      shirtNumber: sub.shirtNumber,
      pos: { ...outPlayer.pos },
      vel: { x: 0, y: 0 },
      targetPos: { ...outPlayer.targetPos },
      attributes: { ...sub.attributes },
      traits: sub.traits ? [...sub.traits] : [],
      hiddenTrait: sub.hiddenTrait,
      secondaryRoles: sub.secondaryRoles ? [...sub.secondaryRoles] : [],
      pa: sub.pa,
      isStarred: !!sub.isStarred,
      subbedIn: true,
      fitness: sub.fitness ?? 100,
      hasBall: wasHolding,
      yellowCards: 0,
      redCard: false,
      decisionCooldown: 0,
      stunTicks: 0,
      matchStats: {
        goals: 0, assists: 0, shots: 0, passes: 0, passesSuccess: 0,
        tackles: 0, interceptions: 0, saves: 0, distanceM: 0,
      },
    };
    if (newPlayer.traits.includes('超级替补')) {
      newPlayer.attributes.shooting = Math.min(99, newPlayer.attributes.shooting + 8);
      newPlayer.attributes.pace = Math.min(99, newPlayer.attributes.pace + 8);
    }
    if (this.hasActiveMechanic(team, 'super_sub')) {
      newPlayer.attributes.shooting = Math.min(99, newPlayer.attributes.shooting + 10);
      newPlayer.attributes.pace = Math.min(99, newPlayer.attributes.pace + 10);
      newPlayer.attributes.passing = Math.min(99, newPlayer.attributes.passing + 10);
      newPlayer.fitness = Math.min(100, newPlayer.fitness + 15);
    }

    s.players[pIdx] = newPlayer;
    if (wasHolding) s.ball.holderId = newPlayer.id;
    if (team === 'home') s.homeSubsUsed++;
    else s.awaySubsUsed++;

    const sc = this.commentary.formatSubstitution(team, newPlayer.name, outPlayer.name, s.minute);
    this.pushEvent('substitution', team, newPlayer.id, newPlayer.name, newPlayer.pos, sc.text, undefined, sc.level);
    this.dispatchHook(team, 'onSubIn');
    if (!this.prologueScriptedMode && team === this.userTeamSide) {
      this.subTrackers.push({
        playerId: newPlayer.id,
        name: newPlayer.name,
        startMin: s.minute,
        startShots: 0,
        startGoals: 0,
        startAssists: 0,
        startTackles: 0,
        startInterceptions: 0,
        reported: false,
      });
    }
    if (this.prologueScriptedMode && team === this.userTeamSide && inSubId === 'prologue_vet_10') {
      this.prologueWaitingForSub = false;
      this.prologueStage = 5;
      this.prologueScriptTicks = 0;
      this.pushEvent('commentary', team, newPlayer.id, newPlayer.name, newPlayer.pos, '【80\' 老队长登场】37岁队长 #10 梅利纳替补登场！全场八万人起立欢呼！', undefined, 'important');
    }
    return { ok: true };
  }

  private scoreScriptedPrologueGoal(
    team: TeamSide,
    shooter: PlayerState | undefined,
    assister: PlayerState | undefined,
    shotLabel: string
  ): void {
    const s = this.state;
    const goalPos = { x: PITCH.LENGTH - 1, y: PITCH.GOAL_Y };
    if (shooter) {
      shooter.matchStats.shots++;
      shooter.matchStats.goals++;
    }
    s.stats[team].shots++;
    s.stats[team].shotsOnTarget++;
    s.stats[team].xG += 0.45;
    s.stats[team].goals++;
    if (team === 'home') s.homeScore++;
    else s.awayScore++;
    if (assister && assister.id !== shooter?.id) {
      assister.matchStats.assists++;
    }
    s.ball.mode = 'dead';
    s.ball.holderId = null;
    s.ball.pos = { ...goalPos, z: 0 };
    s.ball.vel = { x: 0, y: 0, z: 0 };
    const gc = this.commentary.formatGoal({
      minute: s.minute,
      team,
      player: shooter?.name || '前锋',
      assist: assister?.name,
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      shotType: shotLabel.includes('头') ? 'header' : 'normal',
    });
    this.pushEvent('goal', team, shooter?.id || '', shooter?.name || '', goalPos, gc.text, 0.45, gc.level, gc.narrativeTag);
  }

  private stepPrologueScripted(): MatchState {
    const s = this.state;
    if (s.phase === 'full_time') return s;
    const side: TeamSide = this.userTeamSide ?? 'home';
    const sk = this.userEquippedSkills[0];
    const striker = s.players.find(p => p.team === side && !p.redCard && (p.shirtNumber === 10 || p.role === 'ST'))
      ?? s.players.find(p => p.team === side && !p.redCard && p.role !== 'GK');
    const winger = s.players.find(p => p.team === side && !p.redCard && ['RW', 'LW', 'RM', 'LM'].includes(p.role))
      ?? s.players.find(p => p.team === side && !p.redCard && p.id !== striker?.id && p.role !== 'GK');
    const cam = s.players.find(p => p.team === side && !p.redCard && ['CAM', 'CM'].includes(p.role))
      ?? s.players.find(p => p.team === side && !p.redCard && p.id !== striker?.id && p.role !== 'GK');

    // 等待玩家交互时冻结比赛时钟与事件，避免错过教学节点
    if (this.prologueWaitingForCard !== null || this.prologueWaitingForSub || s.activeSkillPrompt) {
      return s;
    }

    s.tick++;
    s.minute = Math.min(95, Math.floor(s.tick / SIM_CONFIG.TICKS_PER_MINUTE));
    if (s.tick % SIM_CONFIG.TICKS_PER_MINUTE === 0) {
      this.expireCommandBuffs();
    }

    // 让场上球员按阵型保持动态站位
    updateOffBallTargets(s.players, s.ball, s.homeAttackDir, s.homeStyle, s.awayStyle, s.homeFormation, s.awayFormation, this.homeMods, this.awayMods);
    stepPlayersPhysics(s.players, s.ball);
    s.stats.home.possessionTicks++;

    if (this.prologueStage === 0) {
      // 45'~47': 我方中前场推进至对手腹地
      const carrier = winger ?? cam ?? striker;
      if (carrier) {
        const prog = Math.min(1, Math.max(0, (s.tick - 45 * SIM_CONFIG.TICKS_PER_MINUTE) / (2 * SIM_CONFIG.TICKS_PER_MINUTE)));
        carrier.pos = { x: 52 + prog * 18, y: 44 - prog * 6 };
        this.giveBallTo(carrier);
      }
      if (s.minute >= 47) {
        this.prologueWaitingForCard = 1;
        this.pushEvent('commentary', side, '', '', { x: 70, y: 38 }, '【教学 1/5】我方边路推进至前场！打出进攻卡【拉开宽度】撕开防线！', undefined, 'important');
      }
    } else if (this.prologueStage === 1) {
      // Card #1 已打出：固定剧本推进传中 -> #19 凌空破门 (1:3)
      this.prologueScriptTicks++;
      const t = Math.min(1, this.prologueScriptTicks / 18);
      if (winger && striker) {
        winger.pos = { x: 70 + t * 20, y: 48 };
        striker.pos = { x: 78 + t * 13, y: 33 };
        if (this.prologueScriptTicks < 13) {
          this.giveBallTo(winger);
        } else if (this.prologueScriptTicks < 19) {
          s.ball.mode = 'pass';
          s.ball.holderId = null;
          s.ball.lastPasserId = winger.id;
          const pt = (this.prologueScriptTicks - 12) / 6;
          s.ball.pos = { x: winger.pos.x + (striker.pos.x - winger.pos.x) * pt, y: winger.pos.y + (striker.pos.y - winger.pos.y) * pt, z: 0 };
        } else {
          this.scoreScriptedPrologueGoal('home', striker, winger, '边路传中抢点');
          this.prologueStage = 2;
          this.prologueScriptTicks = 0;
        }
      }
    } else if (this.prologueStage === 2) {
      // 51'~58': 中场反抢推进至三十米危险区
      const carrier = cam ?? striker;
      if (carrier) {
        const prog = Math.min(1, Math.max(0, (s.minute - 50) / 8));
        carrier.pos = { x: 48 + prog * 23, y: 30 + prog * 5 };
        this.giveBallTo(carrier);
      }
      if (s.minute >= 58) {
        this.prologueWaitingForCard = 2;
        this.pushEvent('commentary', side, '', '', { x: 71, y: 35 }, '【教学 2/5】我方再次压入对手腹地！打出进攻卡【边路强突造角】强攻追分！', undefined, 'important');
      }
    } else if (this.prologueStage === 3) {
      // Card #2 已打出：固定剧本中路撞墙配合 -> #19 推射破门 (2:3)
      this.prologueScriptTicks++;
      const t = Math.min(1, this.prologueScriptTicks / 18);
      if (cam && striker) {
        cam.pos = { x: 71 + t * 14, y: 36 };
        striker.pos = { x: 79 + t * 13, y: 33 };
        if (this.prologueScriptTicks < 13) {
          this.giveBallTo(cam);
        } else if (this.prologueScriptTicks < 19) {
          s.ball.mode = 'pass';
          s.ball.holderId = null;
          s.ball.lastPasserId = cam.id;
          const pt = (this.prologueScriptTicks - 12) / 6;
          s.ball.pos = { x: cam.pos.x + (striker.pos.x - cam.pos.x) * pt, y: cam.pos.y + (striker.pos.y - cam.pos.y) * pt, z: 0 };
        } else {
          this.scoreScriptedPrologueGoal('home', striker, cam, '禁区推射');
          this.prologueStage = 4;
          this.prologueScriptTicks = 0;
          this.pushEvent('commentary', side, '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, '【追至 2:3】全队燃起斗志！但比赛所剩无几，第 80 分钟准备换上老队长！', undefined, 'important');
        }
      }
    } else if (this.prologueStage === 4) {
      // 62'~85': 围攻对手半场，85' 引导老将替补上场
      const carrier = cam ?? striker;
      if (carrier) {
        carrier.pos = { x: 64 + Math.sin(s.tick * 0.2) * 5, y: 34 + Math.cos(s.tick * 0.15) * 6 };
        this.giveBallTo(carrier);
      }
      if (s.minute >= 85) {
        this.prologueWaitingForSub = true;
        this.pushEvent('commentary', side, '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, '【教学 3/5 · 85\'换人】时间所剩无几！请换上替补席的 37岁老队长 #10 梅利纳！', undefined, 'important');
      }
    } else if (this.prologueStage === 5) {
      // 85'~86': 老队长登场拿球，弹出主动技 #1 (3:3)
      this.prologueScriptTicks++;
      const veteran = s.players.find(p => p.team === side && p.shirtNumber === 10) ?? striker;
      if (veteran) {
        veteran.pos = { x: 82, y: 32 };
        this.giveBallTo(veteran);
      }
      if (this.prologueScriptTicks >= 8 && sk) {
        s.activeSkillPrompt = {
          skillId: sk.id,
          name: sk.name,
          situationLabel: `${s.minute}' 2:3 绝境扳平机会 · 老将禁区前拿球`,
          powerLabel: '必杀重炮 · 扳平比分 3:3',
          expiresTick: s.tick + 9999,
          isCardBoosted: true,
          effectiveRank: 3,
          instantLabel: sk.instantLabel,
          vfxTheme: 'ult',
        };
      }
    } else if (this.prologueStage === 6) {
      // 87'~90': 补时最后一攻，弹出主动技 #2 (4:3)
      this.prologueScriptTicks++;
      const veteran = s.players.find(p => p.team === side && p.shirtNumber === 10) ?? striker;
      if (veteran) {
        veteran.pos = { x: 75 + Math.min(8, this.prologueScriptTicks * 0.2), y: 35 };
        this.giveBallTo(veteran);
      }
      if (s.minute >= 90 && sk) {
        if (veteran) veteran.pos = { x: 83, y: 35 };
        s.activeSkillPrompt = {
          skillId: sk.id,
          name: sk.name,
          situationLabel: `${s.minute}' 3:3 补时最后一攻 · 冠军绝杀`,
          powerLabel: '最后一舞 · 4:3 逆转夺冠',
          expiresTick: s.tick + 9999,
          isCardBoosted: true,
          effectiveRank: 3,
          instantLabel: sk.instantLabel,
          vfxTheme: 'ult',
        };
      }
    } else if (this.prologueStage === 7) {
      // 91'~92': 守住 4:3 领先吹响终场哨
      if (s.minute >= 92) {
        s.phase = 'full_time';
        this.finalizeStats();
        const fc = this.commentary.formatFulltime(s.minute, s.homeScore, s.awayScore);
        this.pushEvent('fulltime', 'home', '', '主队', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, fc.text, undefined, fc.level);
      }
    }
    return s;
  }

  /**
   * 单步推进 1 个 tick (0.1s 物理时间)
   */
  public step(): MatchState {
    const s = this.state;
    if (s.phase === 'full_time') return s;

    if (s.phase === 'half_time') {
      this.startSecondHalf();
      return s;
    }

    const freezePrologueClock =
      this.prologueScriptedMode &&
      (this.prologueWaitingForCard !== null || this.prologueWaitingForSub || !!s.activeSkillPrompt);
    if (!freezePrologueClock) {
      s.tick++;
      s.minute = Math.min(95, Math.floor(s.tick / SIM_CONFIG.TICKS_PER_MINUTE));
      for (const side of ['home', 'away'] as const) {
        while (this.aiSegmentCards[side].length > 0 && this.aiSegmentCards[side][0].minute <= s.minute) {
          const next = this.aiSegmentCards[side].shift()!;
          this.applyCommandCard(side, next.effect);
        }
      }
    }
    if (this.setPieceBoostTicks > 0) this.setPieceBoostTicks--;
    if (this.gkCounterBoostTicks.home > 0) this.gkCounterBoostTicks.home--;
    if (this.gkCounterBoostTicks.away > 0) this.gkCounterBoostTicks.away--;
    if (this.bypassOffsideTicks.home > 0) this.bypassOffsideTicks.home--;
    if (this.bypassOffsideTicks.away > 0) this.bypassOffsideTicks.away--;
    if (this.guaranteeShotOnTargetTicks.home > 0) this.guaranteeShotOnTargetTicks.home--;
    if (this.guaranteeShotOnTargetTicks.away > 0) this.guaranteeShotOnTargetTicks.away--;
    if (this.oppTempoDrainTicks.home > 0) this.oppTempoDrainTicks.home--;
    if (this.oppTempoDrainTicks.away > 0) this.oppTempoDrainTicks.away--;

    // 每分钟体能消耗、闷战解说检测与指挥卡过期回收
    if (s.tick % SIM_CONFIG.TICKS_PER_MINUTE === 0) {
      this.drainFitness();
      this.expireCommandBuffs();
      if (!this.prologueScriptedMode && s.minute >= 58) {
        this.updateAiAutoSubstitutions();
      }
      const lull = this.commentary.checkLull(s.minute);
      if (lull) {
        this.pushEvent('commentary', 'home', '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, lull.text, undefined, lull.level, lull.narrativeTag);
      }
    }

    // 阶段转换检查
    const firstHalfEnd = 45 * SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksFirst;
    const secondHalfEnd = firstHalfEnd + 45 * SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksSecond;

    if (s.phase === 'first_half' && s.tick >= firstHalfEnd) {
      s.phase = 'half_time';
      const hc = this.commentary.formatHalftime(s.minute, s.homeScore, s.awayScore);
      this.pushEvent('halftime', 'home', '', '主队', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, hc.text, undefined, hc.level);
      return s;
    }
    if (s.phase === 'second_half' && s.tick >= secondHalfEnd) {
      s.phase = 'full_time';
      this.finalizeStats();
      const fc = this.commentary.formatFulltime(s.minute, s.homeScore, s.awayScore);
      this.pushEvent('fulltime', 'home', '', '主队', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, fc.text, undefined, fc.level);
      return s;
    }

    // 1. 更新无球跑位与防守逼抢目标
    updateOffBallTargets(
      s.players,
      s.ball,
      s.homeAttackDir,
      s.homeStyle,
      s.awayStyle,
      s.homeFormation,
      s.awayFormation,
      this.getEffectiveMods('home'),
      this.getEffectiveMods('away')
    );

    // 2. 处理球状态机
    if (s.ball.mode === 'dead') {
      this.handleDeadBall();
    } else if (s.ball.mode === 'held') {
      this.handleHeldBall();
    } else if (s.ball.mode === 'pass') {
      stepBallPhysics(s.ball);
      this.handlePassFlight();
    } else if (s.ball.mode === 'shot') {
      stepBallPhysics(s.ball);
      this.handleShotFlight();
    } else if (s.ball.mode === 'loose') {
      stepBallPhysics(s.ball);
      this.handleLooseBall();
    }

    // 3. 推进球员运动学
    stepPlayersPhysics(s.players, s.ball);

    // 4. 累计控球时间
    const possTeam = this.getPossessionTeam();
    if (possTeam) {
      s.stats[possTeam].possessionTicks++;
    }

    // 5. 主动技能触发器、结果定格与替补 15 分钟影响追踪
    if (s.activeSkillPrompt && s.tick >= s.activeSkillPrompt.expiresTick) {
      s.activeSkillPrompt = null;
    }
    if (s.skillResolution && s.tick >= s.skillResolution.expiresTick) {
      s.skillResolution = null;
    }
    if (this.pendingSkillResolution && s.tick >= this.pendingSkillResolution.expiresTick) {
      const pr = this.pendingSkillResolution;
      this.pendingSkillResolution = null;
      const curSt = s.stats[pr.team];
      const dGoals = curSt.goals - pr.startGoals;
      const dShots = curSt.shots - pr.startShots;
      const dXG = Math.max(0, curSt.xG - pr.startXG);
      const dTackles = curSt.tackles - pr.startTackles;
      const isPos = dGoals > 0 || dShots > 0 || dTackles > 0 || dXG >= 0.08;
      const outcomeText =
        dGoals > 0 ? `一击破门！直接改写比分（+${dGoals} 球 · +${dXG.toFixed(2)} xG）` :
        dShots > 0 ? `制造 ${dShots} 次威胁射门（+${dXG.toFixed(2)} xG）` :
        dTackles > 0 ? `完成 ${dTackles} 次关键抢断夺回球权` :
        `全队渗透压上推进（${pr.instantSummary}）`;
      s.skillResolution = {
        skillName: pr.skillName,
        outcomeText,
        isPositive: isPos,
        expiresTick: s.tick + 22,
      };
      this.pushCoachReward({
        bannerText: `⚡ 【${pr.skillName}】结果：${outcomeText}`,
        tone: dGoals > 0 ? '#4ADE80' : '#FACC15',
      });
    }
    for (const tr of this.subTrackers) {
      if (tr.reported) continue;
      const pl = s.players.find(p => p.id === tr.playerId);
      if (!pl) continue;
      const elapsed = s.minute - tr.startMin;
      const ms = pl.matchStats;
      const hasGoalContrib = ms.goals > tr.startGoals || ms.assists > tr.startAssists;
      if (hasGoalContrib || elapsed >= 15) {
        tr.reported = true;
        const actParts: string[] = [];
        if (ms.goals > 0) actParts.push(`${ms.goals}球`);
        if (ms.assists > 0) actParts.push(`${ms.assists}助`);
        if (ms.shots > 0) actParts.push(`${ms.shots}射门`);
        if (ms.tackles + ms.interceptions > 0) actParts.push(`${ms.tackles + ms.interceptions}抢断拦截`);
        const summary = actParts.length > 0
          ? `换人见效：${tr.name} 登场${Math.max(1, elapsed)}分钟贡献 ${actParts.join(' · ')}！`
          : `换人追踪：${tr.name} 登场${Math.max(1, elapsed)}分钟，对方盯防严密暂未觅得良机`;
        this.pushCoachReward({ bannerText: summary, tone: actParts.length > 0 ? '#38BDF8' : '#94A3B8' });
        this.pushEvent('commentary', pl.team, pl.id, pl.name, pl.pos, summary, undefined, actParts.length > 0 ? 'important' : 'normal');
      }
    }
    if (this.prologueScriptedMode && this.userTeamSide) {
      const side = this.userTeamSide;
      const dir = this.getAttackDir(side);
      const sk = this.userEquippedSkills[0];
      const nudgeForward = (p: PlayerState, tx: number, ty: number, speedMul = 1.15) => {
        p.targetPos = { x: tx, y: ty };
        const dx = tx - p.pos.x;
        const dy = ty - p.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 1.5) {
          const stepSpd = Math.min(d, 0.85 * speedMul);
          p.vel = { x: (dx / d) * stepSpd * 10, y: (dy / d) * stepSpd * 10 };
          p.pos = { x: p.pos.x + (dx / d) * stepSpd, y: p.pos.y + (dy / d) * stepSpd };
        }
      };
      const guideHomeBuildUp = (minX: number) => {
        const carrier = s.players.find(p => p.team === side && !p.redCard && p.hasBall)
          ?? s.players.find(p => p.team === side && !p.redCard && ['CAM', 'CM', 'LW', 'RW'].includes(p.role))
          ?? s.players.find(p => p.team === side && !p.redCard && p.role !== 'GK');
        if (carrier) {
          if (!carrier.hasBall && s.ball.mode !== 'pass' && s.ball.mode !== 'shot' && s.ball.lastTouchTeam !== side) {
            this.giveBallTo(carrier);
          }
          if (toRelativeX(carrier.pos.x, dir) < minX) {
            nudgeForward(carrier, dir === 1 ? minX + 4 : PITCH.LENGTH - (minX + 4), PITCH.HALF_Y, 1.25);
          }
        }
        const striker = s.players.find(p => p.team === side && !p.redCard && p.id === 'prologue_st_19');
        if (striker && toRelativeX(striker.pos.x, dir) < minX + 10) {
          nudgeForward(striker, dir === 1 ? minX + 14 : PITCH.LENGTH - (minX + 14), PITCH.GOAL_Y - 1.5, 1.2);
        }
      };

      if (this.prologueStage === 0 && s.minute >= 46) {
        guideHomeBuildUp(64);
        if (s.minute >= 47 && this.prologueWaitingForCard === null) {
          this.prologueWaitingForCard = 1;
          this.pushEvent('commentary', side, '', '', { x: s.ball.pos.x, y: s.ball.pos.y }, '【场外指挥】我方边路推进至前场！打出进攻卡【拉开宽度】撕开防线！', undefined, 'important');
        }
      } else if (this.prologueStage === 1) {
        this.prologueGuaranteedGoal = true;
        if (s.homeScore >= 1) {
          this.prologuePendingForcedGoal = false;
          this.prologueGuaranteedGoal = false;
          this.prologueStage = 2;
        } else if (this.prologuePendingForcedGoal) {
          const attacker = s.players.find(p => p.team === side && !p.redCard && p.id === 'prologue_st_19')
            ?? s.players.find(p => p.team === side && !p.redCard && ['ST', 'CAM', 'LW', 'RW'].includes(p.role))
            ?? s.players.find(p => p.team === side && !p.redCard && p.role !== 'GK');
          if (attacker) {
            nudgeForward(attacker, dir === 1 ? PITCH.LENGTH - 15 : 15, PITCH.GOAL_Y - 1, 1.35);
          }
          if (this.prologueGoalDelayTicks > 0) {
            this.prologueGoalDelayTicks--;
            if (this.prologueGoalDelayTicks === 10 && attacker && !attacker.hasBall && s.ball.mode === 'held') {
              const holder = s.players.find(p => p.id === s.ball.holderId && p.team === side);
              if (holder && holder.id !== attacker.id) {
                this.executePass(holder, attacker, 'through');
              }
            }
          } else if (s.ball.mode !== 'shot' && attacker && toRelativeX(attacker.pos.x, dir) >= 72) {
            if (!attacker.hasBall) this.giveBallTo(attacker);
            this.executeShot(attacker, 0.78, true);
          }
        }
      } else if (this.prologueStage === 2) {
        // 50'~65' 客队平滑反击连入两球 (1:1 -> 1:2 -> 1:3)，随后 73' 引导第二张进攻卡
        const awayAttacker = s.players.find(p => p.team === 'away' && !p.redCard && p.role === 'ST')
          ?? s.players.find(p => p.team === 'away' && !p.redCard && ['CAM', 'LW', 'RW'].includes(p.role))
          ?? s.players.find(p => p.team === 'away' && !p.redCard && p.role !== 'GK');
        if (s.minute >= 52 && this.prologueAwayGoalCount === 0 && s.awayScore === 1) {
          if (awayAttacker) {
            if (!awayAttacker.hasBall && s.ball.mode !== 'shot' && s.ball.mode !== 'pass' && s.ball.lastTouchTeam !== 'away') {
              this.giveBallTo(awayAttacker);
            }
            // 推进期间压制普通 AI 提前瞎射，避免门将扑出后反复抢回球无限射门
            awayAttacker.decisionCooldown = 6;
            const prog = Math.min(1, Math.max(0, (s.minute - 52) / 3));
            const targetX = 48 - prog * 24; // 52' 从中场 48m 平滑推进到 55' 禁区前沿 24m
            nudgeForward(awayAttacker, targetX, PITCH.GOAL_Y - 1.5, 1.35);
            if ((s.minute >= 55 && awayAttacker.pos.x <= 28) || s.minute >= 57) {
              if (s.ball.mode !== 'shot') {
                this.prologueAwayGoalCount = 1;
                this.prologueAllowAwayGoal = true;
                awayAttacker.decisionCooldown = 0;
                if (!awayAttacker.hasBall) this.giveBallTo(awayAttacker);
                this.executeShot(awayAttacker, 0.88, true);
              }
            }
          }
        } else if (s.minute >= 61 && this.prologueAwayGoalCount === 1 && s.awayScore === 2) {
          if (awayAttacker) {
            if (!awayAttacker.hasBall && s.ball.mode !== 'shot' && s.ball.mode !== 'pass' && s.ball.lastTouchTeam !== 'away') {
              this.giveBallTo(awayAttacker);
            }
            awayAttacker.decisionCooldown = 6;
            const prog = Math.min(1, Math.max(0, (s.minute - 61) / 3));
            const targetX = 48 - prog * 24;
            nudgeForward(awayAttacker, targetX, PITCH.GOAL_Y + 1.5, 1.35);
            if ((s.minute >= 64 && awayAttacker.pos.x <= 28) || s.minute >= 66) {
              if (s.ball.mode !== 'shot') {
                this.prologueAwayGoalCount = 2;
                this.prologueAllowAwayGoal = true;
                awayAttacker.decisionCooldown = 0;
                if (!awayAttacker.hasBall) this.giveBallTo(awayAttacker);
                this.executeShot(awayAttacker, 0.88, true);
              }
            }
          }
        } else if (s.minute >= 71 && s.awayScore >= 3) {
          guideHomeBuildUp(66);
          if (s.minute >= 73 && this.prologueWaitingForCard === null) {
            this.prologueWaitingForCard = 2;
            this.pushEvent('commentary', side, '', '', { x: s.ball.pos.x, y: s.ball.pos.y }, '【1:3 绝境】背水一战！打出进攻卡【边路强突造角】，搏命反扑！', undefined, 'important');
          }
        }
      } else if (this.prologueStage === 3) {
        this.prologueGuaranteedGoal = true;
        if (s.homeScore >= 2) {
          this.prologuePendingForcedGoal = false;
          this.prologueGuaranteedGoal = false;
          this.prologueStage = 4;
          const crampStriker = s.players.find(p => p.team === side && p.id === 'prologue_st_19')
            ?? s.players.find(p => p.team === side && !p.redCard && p.role === 'ST');
          if (crampStriker) crampStriker.fitness = 30;
          this.pushEvent('commentary', side, '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, '【2:3 看到希望】#19 陈小宇梅开二度，但落地时小腿抽筋！替补席上 #10 梅利纳撕开了左膝冰袋！', undefined, 'important');
        } else if (this.prologuePendingForcedGoal) {
          const attacker = s.players.find(p => p.team === side && !p.redCard && p.id === 'prologue_st_19')
            ?? s.players.find(p => p.team === side && !p.redCard && ['ST', 'CAM', 'RW', 'LW'].includes(p.role))
            ?? s.players.find(p => p.team === side && !p.redCard && p.role !== 'GK');
          if (attacker) {
            nudgeForward(attacker, dir === 1 ? PITCH.LENGTH - 15 : 15, PITCH.GOAL_Y + 1.0, 1.35);
          }
          if (this.prologueGoalDelayTicks > 0) {
            this.prologueGoalDelayTicks--;
            if (this.prologueGoalDelayTicks === 10 && attacker && !attacker.hasBall && s.ball.mode === 'held') {
              const holder = s.players.find(p => p.id === s.ball.holderId && p.team === side);
              if (holder && holder.id !== attacker.id) {
                this.executePass(holder, attacker, 'through');
              }
            }
          } else if (s.ball.mode !== 'shot' && attacker && toRelativeX(attacker.pos.x, dir) >= 72) {
            if (!attacker.hasBall) this.giveBallTo(attacker);
            this.executeShot(attacker, 0.78, true);
          }
        }
      } else if (this.prologueStage === 4) {
        if (s.minute >= 80 && s.homeSubs.some(sub => sub.id === 'prologue_vet_10')) {
          if (!this.prologueWaitingForSub) {
            this.prologueWaitingForSub = true;
            this.pushEvent('commentary', side, '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, '【80\' 抽筋警报】#19 陈小宇拼到抽筋！请点击右上【换人/战术】，换上老队长 #10 梅利纳！', undefined, 'important');
          }
        }
      } else if (this.prologueStage === 5 && s.homeScore < 3) {
        const veteran = s.players.find(p => p.team === side && (p.id === 'prologue_vet_10' || p.name.includes('梅利纳') || p.name.includes('林锋')))
          ?? s.players.find(p => p.team === side && p.role !== 'GK');
        if (veteran && s.minute >= 80) {
          // 保持在越位线前（不超过对方倒数第二名防守队员），临近 84' 再反越位前插接球
          const oppXs = s.players
            .filter(p => p.team !== side && !p.redCard)
            .map(p => p.pos.x)
            .sort((a, b) => (dir === 1 ? b - a : a - b));
          const offsideLineX = oppXs[1] ?? (dir === 1 ? 80 : 25);
          const safeMaxX = dir === 1 ? Math.min(offsideLineX - 2.0, 76) : Math.max(offsideLineX + 2.0, PITCH.LENGTH - 76);
          if (s.minute < 84) {
            if (dir === 1 && veteran.pos.x > safeMaxX) veteran.pos.x = safeMaxX;
            if (dir === -1 && veteran.pos.x < safeMaxX) veteran.pos.x = safeMaxX;
          }
          const runTargetX = s.minute >= 84
            ? (dir === 1 ? Math.min(PITCH.LENGTH - 18, Math.max(safeMaxX, 82)) : Math.max(18, Math.min(safeMaxX, PITCH.LENGTH - 82)))
            : safeMaxX;
          nudgeForward(veteran, runTargetX, PITCH.GOAL_Y - 1.0, 1.25);
        }
        if (s.minute >= 85 && s.ball.mode !== 'shot' && veteran && toRelativeX(veteran.pos.x, dir) >= 68) {
          this.prologueGuaranteedGoal = true;
          if (!veteran.hasBall) this.giveBallTo(veteran);
          this.executeShot(veteran, 0.85, true);
        }
      } else if (this.prologueStage === 6 && s.homeScore === 3 && sk) {
        const veteran = s.players.find(p => p.team === side && (p.id === 'prologue_vet_10' || p.name.includes('梅利纳') || p.name.includes('林锋')))
          ?? s.players.find(p => p.team === side && p.role !== 'GK');
        if (veteran && s.minute >= 86) {
          // 86'~89' 保持在弧顶越位线前策应，90' 踏入禁区弧顶起脚重炮
          const oppXs = s.players
            .filter(p => p.team !== side && !p.redCard)
            .map(p => p.pos.x)
            .sort((a, b) => (dir === 1 ? b - a : a - b));
          const offsideLineX = oppXs[1] ?? (dir === 1 ? 80 : 25);
          const safeMaxX = dir === 1 ? Math.min(offsideLineX - 2.0, 75) : Math.max(offsideLineX + 2.0, PITCH.LENGTH - 75);
          if (s.minute < 89) {
            if (dir === 1 && veteran.pos.x > safeMaxX) veteran.pos.x = safeMaxX;
            if (dir === -1 && veteran.pos.x < safeMaxX) veteran.pos.x = safeMaxX;
          }
          const runTargetX = s.minute >= 89
            ? (dir === 1 ? Math.min(PITCH.LENGTH - 21, Math.max(safeMaxX, 81)) : Math.max(21, Math.min(safeMaxX, PITCH.LENGTH - 81)))
            : safeMaxX;
          nudgeForward(veteran, runTargetX, PITCH.GOAL_Y + 0.8, 1.25);
        }
        if (s.minute >= 90 && !s.activeSkillPrompt && s.ball.mode !== 'shot' && veteran && toRelativeX(veteran.pos.x, dir) >= 68) {
          if (!veteran.hasBall) this.giveBallTo(veteran);
          s.activeSkillPrompt = {
            skillId: sk.id,
            name: sk.name,
            situationLabel: `${s.minute}' 3:3 补时最后一攻 · 冠军绝杀`,
            powerLabel: '最后一舞 · 4:3 逆转夺冠',
            expiresTick: s.tick + 9999,
            isCardBoosted: true,
            effectiveRank: 3,
            instantLabel: sk.instantLabel,
            vfxTheme: 'ult',
          };
        }
      }
    }
    if (!this.prologueScriptedMode && !s.activeSkillPrompt && this.userTeamSide && this.userEquippedSkills.length > 0 && s.tick % 2 === 0) {
      this.evaluateActiveSkillTriggers(this.userTeamSide);
    }

    return s;
  }

  private evaluateActiveSkillTriggers(team: TeamSide): void {
    const s = this.state;
    const b = s.ball;
    if (b.mode === 'dead') return;
    if (s.minute < 3) return;
    if (s.minute - this.lastSkillPromptMinute < 4) return;
    if (s.minute < (this.teamSkillGcdMinute[team] ?? 0)) return;
    const nonSkillBuffs = s.activeBuffs.filter(bf => bf.team === team && !bf.effect.id.startsWith('sk_'));
    const hasAnyCardBuff = nonSkillBuffs.length > 0;
    const dir = this.getAttackDir(team);
    const relX = toRelativeX(b.pos.x, dir);
    const oppRelX = 105 - relX;
    const teamHasBall = b.lastTouchTeam === team;
    const totalMaxUses = this.userEquippedSkills.reduce((acc, item) => acc + item.maxPerMatch, 0);
    if (s.minute < 46 && this.firstHalfSkillTriggers >= Math.max(2, Math.floor(totalMaxUses * 0.5))) {
      return;
    }

    for (const sk of this.userEquippedSkills) {
      const uses = (s.skillUses?.[sk.id] ?? 0);
      if (uses >= sk.maxPerMatch) continue;
      if (s.minute < 46 && sk.maxPerMatch >= 2 && uses >= Math.ceil(sk.maxPerMatch / 2)) continue;
      const cdEnd = (s.skillCooldowns?.[sk.id] ?? 0);
      if (s.minute < cdEnd) continue;

      const elementMatch = !!sk.linkedElement && nonSkillBuffs.some(bf => bf.effect.element === sk.linkedElement);
      const archetypeMatch = !!sk.linkedElement && s.deckArchetypeGene?.[team] === sk.linkedElement;
      const synergyBuff = nonSkillBuffs.find(bf => {
        const syn = bf.effect.skillSynergy;
        if (!syn) return false;
        return syn.targetSkillTags.includes('all') || syn.targetSkillTags.includes(sk.situation);
      });
      const effModsForSkill = this.getEffectiveMods(team);
      const rankBoost = (synergyBuff?.effect.skillSynergy?.rankBoost ?? 0) + (effModsForSkill.skillTempRankBonus ?? 0);
      const promptBonus = synergyBuff?.effect.skillSynergy?.promptBonusRate ?? 0;
      const effRank = Math.min(3, (sk.effectiveRank ?? 1) + rankBoost);
      const thresholdDrop =
        (hasAnyCardBuff ? 20 : 0) +
        (effRank >= 3 ? 10 : 0) +
        (archetypeMatch ? 10 : 0) +
        Math.round(promptBonus * 25);
      if (this.userFamAvg < Math.max(10, sk.minFamiliarity - thresholdDrop)) continue;
      if (this.userChemAvg < Math.max(10, sk.minChemistry - thresholdDrop)) continue;

      const isLeadingNow = team === 'home' ? s.homeScore > s.awayScore : s.awayScore > s.homeScore;
      const lastConceded = s.lastConcededMin?.[team] ?? -99;
      let matched = false;
      switch (sk.situation) {
        case 'opponent_through_ball':
          matched = !teamHasBall && ((b.mode === 'pass' && (b.passType === 'through' || b.passType === 'long')) || (oppRelX >= 62 && b.mode === 'held'));
          break;
        case 'box_danger':
          matched = !teamHasBall && oppRelX > 72;
          break;
        case 'attacking_final_third':
          matched = teamHasBall && relX > 62;
          break;
        case 'wing_overload':
          matched = teamHasBall && (b.pos.y < 18 || b.pos.y > 50);
          break;
        case 'counter_opportunity':
          matched = teamHasBall && relX < 56 && b.mode === 'held';
          break;
        case 'midfield_press':
          matched = !teamHasBall && oppRelX >= 32 && oppRelX <= 76;
          break;
        case 'trailing_late':
          matched = s.minute >= 68 && (this.isTrailing(team) || s.homeScore === s.awayScore);
          break;
        case 'any_possession':
          matched = teamHasBall && b.mode === 'held' && s.minute >= 48 && (this.isTrailing(team) || s.homeScore === s.awayScore || relX >= 60);
          break;
        case 'set_piece_moment':
          matched = teamHasBall && relX > 68 && (b.passType === 'cross' || s.stats[team].corners > 0);
          break;
        case 'leading_late':
          matched = s.minute >= 70 && isLeadingNow;
          break;
        case 'just_conceded':
          matched = lastConceded >= 0 && s.minute - lastConceded <= 4;
          break;
        case 'high_possession':
          matched = teamHasBall && (this.v6PassStreak[team] >= 4 || (s.aspectStacks?.passSeq ?? 0) >= 4);
          break;
      }

      if (matched) {
        this.lastSkillPromptMinute = s.minute;
        const boostTag = elementMatch ? ' (元素过载+35%)' : hasAnyCardBuff ? ' (卡牌共振+20%)' : '';
        s.activeSkillPrompt = {
          skillId: sk.id,
          name: sk.name,
          situationLabel: sk.situationLabel,
          powerLabel: `${sk.powerLabel}${boostTag}`,
          expiresTick: s.tick + 32,
          isCardBoosted: hasAnyCardBuff || elementMatch,
          effectiveRank: effRank,
          instantLabel: sk.instantLabel,
          mutationChoice: sk.mutationChoice,
          mutationLabel: sk.mutationLabel,
          vfxTheme: sk.vfxTheme ?? 'ult',
        };
        break;
      }
    }
  }

  private executeInstantSkillAction(team: TeamSide, sk: EquippedActiveSkill, mul: number): string {
    const s = this.state;
    const b = s.ball;
    const dir = this.getAttackDir(team);
    const goalX = dir === 1 ? PITCH.LENGTH : 0;
    const friendly = s.players.filter(p => p.team === team && !p.redCard);
    const holder = b.holderId ? s.players.find(p => p.id === b.holderId) : undefined;
    const action: SkillInstantAction = sk.instantAction ?? 'force_through_ball';

    switch (action) {
      case 'clear_danger': {
        if (holder && holder.team !== team) holder.stunTicks = 10;
        const defender = friendly
          .filter(p => p.role !== 'GK')
          .sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        const midfielders = friendly
          .filter(p => p.role !== 'GK' && p.id !== defender?.id)
          .sort((a, c) => Math.abs(toRelativeX(a.pos.x, dir) - 52) - Math.abs(toRelativeX(c.pos.x, dir) - 52));
        const safeMid = midfielders.find(m => {
          const nearestOpp = s.players
            .filter(op => op.team !== team && !op.redCard)
            .reduce((mn, op) => Math.min(mn, dist2D(op.pos, m.pos)), 99);
          return nearestOpp >= 4.5;
        });
        if (defender && safeMid) {
          this.giveBallTo(defender);
          defender.matchStats.interceptions++;
          s.stats[team].interceptions++;
          launchPassBall(b, defender.pos, safeMid.pos, defender, safeMid, 'short');
        } else if (defender) {
          this.giveBallTo(defender);
          defender.matchStats.interceptions++;
          s.stats[team].interceptions++;
        }
        this.applyCommandCard(team, {
          id: `v6_mini_clear_${s.tick}`,
          name: '防线解围稳阵',
          durationMinutes: 4,
          defendingDelta: 6,
          composureDelta: 6,
        });
        if (this.hasUserAspect('clear_counter_stack') && s.aspectStacks) {
          s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
        }
        return '冷静断球解围，稳住后场阵型！';
      }
      case 'instant_counter_pass': {
        const passer = (holder && holder.team === team ? holder : undefined) ??
          friendly.filter(p => p.role !== 'GK').sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        const target = friendly
          .filter(p => p.role !== 'GK' && p.id !== passer?.id)
          .sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        const targetOpen = target && s.players
          .filter(op => op.team !== team && !op.redCard)
          .every(op => dist2D(op.pos, target.pos) >= 4.2);
        this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
        this.applyCommandCard(team, {
          id: `v6_mini_cnt_${s.tick}`,
          name: '瞬时反击提速',
          durationMinutes: 5,
          paceDelta: 10,
          passingDelta: 8,
          tacticalMod: { tempoMul: 1.15, throughPassBias: 0.08 },
        });
        if (passer && target && targetOpen) {
          if (b.mode !== 'held' || holder?.team !== team) {
            this.giveBallTo(passer);
          }
          launchPassBall(b, passer.pos, target.pos, passer, target, 'long');
          if (this.hasUserAspect('counter_pass_speed')) {
            b.vel.x *= 1.20;
            b.vel.y *= 1.20;
          }
          return `极速长传反击连线 ${target.name}！`;
        }
        return '全队瞬间提速冲刺反击！';
      }
      case 'force_through_ball': {
        const passer = (holder && holder.team === team ? holder : undefined) ??
          friendly.filter(p => p.role !== 'GK').sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        const target = friendly
          .filter(p => p.role !== 'GK' && p.id !== passer?.id)
          .sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
        this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 45);
        this.applyCommandCard(team, {
          id: `v6_mini_thr_${s.tick}`,
          name: '直塞渗透视野',
          durationMinutes: 5,
          passingDelta: 10,
          composureDelta: 6,
          tacticalMod: { throughPassBias: 0.10, tempoMul: 1.12 },
        });
        if (passer && target && holder?.team === team) {
          const leadPos: Vec2 = {
            x: clamp(target.pos.x + dir * 3.0, 2, PITCH.LENGTH - 2),
            y: clamp(target.pos.y, 2, PITCH.WIDTH - 2),
          };
          const laneBlocked = s.players.some(op => op.team !== team && !op.redCard && dist2D(op.pos, leadPos) < 4.2);
          if (!laneBlocked) {
            launchPassBall(b, passer.pos, leadPos, passer, target, 'through');
            return `穿透直塞打穿防线找 ${target.name}！`;
          }
        }
        return '中路渗透视野全面开启，下脚直塞更具威胁！';
      }
      case 'force_shot_on_target': {
        const effRank = sk.effectiveRank ?? 1;
        this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 75);
        const carrier = holder && holder.team === team ? holder : undefined;
        if (carrier && carrier.role !== 'GK' && toRelativeX(carrier.pos.x, dir) > 48) {
          const dist = dist2D(carrier.pos, { x: goalX, y: PITCH.GOAL_Y });
          const rawXg = clamp((0.22 - dist * 0.004 + effRank * 0.022) * mul, 0.13, 0.58);
          this.executeShot(carrier, rawXg, true);
          return `${carrier.name} 校准死角爆射！`;
        }
        return '禁区校准！下次射门必中门框且威力提升！';
      }
      case 'win_foul_setpiece': {
        const carrier = (holder && holder.team === team ? holder : undefined) ??
          friendly.filter(p => p.role !== 'GK').sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 65);
        if (carrier) {
          const fkX = dir === 1
            ? clamp(Math.max(carrier.pos.x, PITCH.HALF_X + 12), PITCH.HALF_X + 10, PITCH.LENGTH - 18)
            : clamp(Math.min(carrier.pos.x, PITCH.HALF_X - 12), 18, PITCH.HALF_X - 10);
          this.setDeadBall(team, 'freekick', { x: fkX, y: clamp(carrier.pos.y, 6, PITCH.WIDTH - 6) }, 4);
          this.setPieceBoostTeam = team;
          this.setPieceBoostTicks = 150;
          return `${carrier.name} 赢得前场高危定位球！`;
        }
        return '压迫造犯规获定位球机会！';
      }
      case 'GK_save_boost': {
        const gk = friendly.find(p => p.role === 'GK');
        if (b.mode === 'shot' && b.lastTouchTeam !== team && gk) {
          gk.matchStats.saves++;
          if (gk.matchStats.saves >= 3) {
            this.tryRevealHiddenTrait(gk, '门线战神');
          }
          s.stats[team].saves++;
          this.giveBallTo(gk);
          this.pushEvent('save', team, gk.id, gk.name, gk.pos, `【门神时刻】${gk.name} 不可思议飞身救主！`, undefined, 'important');
          return `${gk.name} 门线反应飞扑化解绝杀！`;
        }
        this.applyCommandCard(team, {
          id: `v6_mini_gk_${s.tick}`,
          name: '门前铁壁结界',
          durationMinutes: 6,
          goalkeepingDelta: 12,
          defendingDelta: 6,
          tacticalMod: { oppShotXgPenalty: 0.14 },
        });
        return '门前铁壁展开：6分钟内门将扑救与防线封堵大幅强化！';
      }
      case 'force_cross_header': {
        const crosser = (holder && holder.team === team ? holder : undefined) ??
          friendly.filter(p => p.role !== 'GK').sort((a, c) => Math.abs(c.pos.y - PITCH.HALF_Y) - Math.abs(a.pos.y - PITCH.HALF_Y))[0];
        const striker = friendly
          .filter(p => p.role !== 'GK' && p.id !== crosser?.id)
          .sort((a, c) => (toRelativeX(c.pos.x, dir) + c.attributes.strength * 0.4) - (toRelativeX(a.pos.x, dir) + a.attributes.strength * 0.4))[0];
        this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 65);
        this.applyCommandCard(team, {
          id: `v6_mini_cross_${s.tick}`,
          name: '两翼传中抢点',
          durationMinutes: 5,
          shootingDelta: 8,
          paceDelta: 6,
          tacticalMod: { crossBias: 0.14, boxCrashBonus: 1 },
        });
        if (
          crosser &&
          striker &&
          holder?.team === team &&
          toRelativeX(crosser.pos.x, dir) >= 54 &&
          toRelativeX(striker.pos.x, dir) >= 70
        ) {
          launchPassBall(b, crosser.pos, striker.pos, crosser, striker, 'cross');
          return `${crosser.name} 边路起球精准传中找禁区内的 ${striker.name}！`;
        }
        return '边路起球与禁区双点包抄全面激活！';
      }
      case 'tactical_foul_stop': {
        const oppTeam: TeamSide = team === 'home' ? 'away' : 'home';
        const tackler = friendly.filter(p => p.role !== 'GK').sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        if (holder && holder.team !== team) holder.stunTicks = 10;
        const safeX = dir === 1 ? Math.max(24, b.pos.x) : Math.min(PITCH.LENGTH - 24, b.pos.x);
        this.setDeadBall(oppTeam, 'freekick', { x: safeX, y: b.pos.y }, 6);
        if (tackler && sk.mutationTag !== 'grant_shield_stack' && Math.random() < 0.30) {
          tackler.yellowCards++;
          s.stats[team].yellowCards++;
          this.pushEvent('yellow_card', team, tackler.id, tackler.name, tackler.pos, `${tackler.name} 战术犯规破坏反击染黄`, undefined, 'normal');
        }
        return `${tackler?.name ?? '后腰'} 果断战术犯规掐断对手反击！`;
      }
      case 'gk_long_launch': {
        const gk = friendly.find(p => p.role === 'GK');
        const target = friendly.filter(p => p.role !== 'GK').sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        this.gkCounterBoostTicks[team] = 75;
        this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
        this.applyCommandCard(team, {
          id: `v6_mini_gkl_${s.tick}`,
          name: '门神反击冲刺',
          durationMinutes: 5,
          paceDelta: 10,
          shootingDelta: 6,
          tacticalMod: { tempoMul: 1.15 },
        });
        if (gk && target && (holder?.id === gk.id || !holder || holder.team !== team)) {
          this.giveBallTo(gk);
          const targetOpen = s.players.filter(op => op.team !== team && !op.redCard).every(op => dist2D(op.pos, target.pos) >= 4.0);
          if (targetOpen) {
            launchPassBall(b, gk.pos, target.pos, gk, target, 'long');
            b.vel.x *= 1.18;
            b.vel.y *= 1.18;
            return `${gk.name} 门神长传制导直找 ${target.name}！`;
          }
        }
        return '门将快速发动全队提速反击！';
      }
      case 'tempo_burst_intercept':
      default: {
        if (holder && holder.team !== team) holder.stunTicks = 12;
        const interceptor = friendly
          .filter(p => p.role !== 'GK')
          .sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        if (interceptor) {
          this.giveBallTo(interceptor);
          interceptor.matchStats.interceptions++;
          s.stats[team].interceptions++;
          return `${interceptor.name} 瞬步反抢直接断球！`;
        }
        return '中前场绞杀夺取节奏！';
      }
    }
  }

  public triggerActiveSkill(
    team: TeamSide,
    skillId: string
  ): TriggerSkillResult & { ok: boolean; boosted?: boolean } {
    const s = this.state;
    const sk = this.userEquippedSkills.find(x => x.id === skillId);
    const failRes: TriggerSkillResult & { ok: boolean; boosted?: boolean } = {
      ok: false,
      triggered: false,
      skillId,
      skillName: sk?.name ?? skillId,
      vfxTheme: sk?.vfxTheme ?? 'ult',
      instantSummary: '',
      effectiveRank: sk?.effectiveRank ?? 1,
      isCardBoosted: false,
    };
    if (!sk) return failRes;
    if (s.minute < (this.teamSkillGcdMinute[team] ?? 0)) return failRes;
    const uses = s.skillUses?.[skillId] ?? 0;
    if (uses >= sk.maxPerMatch) return failRes;
    const cdEnd = s.skillCooldowns?.[skillId] ?? 0;
    if (s.minute < cdEnd) return failRes;

    if (this.prologueScriptedMode && team === this.userTeamSide) {
      this.prologueSkillTriggered = true;
      this.prologueGuaranteedGoal = true;
      const veteran = s.players.find(p => p.team === team && (p.id === 'prologue_vet_10' || p.name.includes('梅利纳') || p.name.includes('林锋'))) ?? s.players.find(p => p.team === team && p.role !== 'GK');
      const wasStage5 = this.prologueStage === 5;
      if (veteran) {
        if (!veteran.hasBall) this.giveBallTo(veteran);
        this.executeShot(veteran, 0.85, true);
      }
      s.activeSkillPrompt = null;
      s.skillUses = s.skillUses ?? {};
      s.skillUses[skillId] = (s.skillUses[skillId] ?? 0) + 1;
      return {
        ok: true,
        triggered: true,
        skillId,
        skillName: sk.name,
        vfxTheme: sk.vfxTheme ?? 'ult',
        instantSummary: wasStage5 ? '老队长远射轰入死角，即将扳平 3:3！' : '补时绝杀起脚，4:3 逆转在望！',
        effectiveRank: sk.effectiveRank ?? 3,
        isCardBoosted: true,
      };
    }
    const nonSkillBuffs = s.activeBuffs.filter(bf => bf.team === team && !bf.effect.id.startsWith('sk_'));
    const hasAnyCardBuff = nonSkillBuffs.length > 0;
    const isElementOverdrive = !!sk.linkedElement && nonSkillBuffs.some(bf => bf.effect.element === sk.linkedElement);
    const mul = isElementOverdrive ? 1.35 : hasAnyCardBuff ? 1.20 : 1.0;

    // 1. 立即结算场上物理干预结果（直接改变传球/射门/断球/定位球走势）
    const instantSummary = this.executeInstantSkillAction(team, sk, mul);

    // 2. 结算技能分支质变 (A/B；若激活 skillDualBranch 则 A+B 双质变同时生效)
    const oppTeam: TeamSide = team === 'home' ? 'away' : 'home';
    const dualBranchActive = this.getEffectiveMods(team).skillDualBranch;
    const tagsToApply: SkillMutationTag[] = [];
    if (sk.mutationTag) tagsToApply.push(sk.mutationTag);
    if (dualBranchActive && sk.secondaryMutationTag && sk.secondaryMutationTag !== sk.mutationTag) {
      tagsToApply.push(sk.secondaryMutationTag);
    }
    for (const tag of tagsToApply) {
      switch (tag) {
        case 'bypass_offside':
          this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
          break;
        case 'guarantee_shot_on_target':
          this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 65);
          break;
        case 'refund_card_energy':
          this.pushCoachReward({ energyRefund: 1, bannerText: `【${sk.name}·质变】返还 +1 指挥能量`, tone: '#FBBF24' });
          break;
        case 'reduce_all_cd':
          this.reduceEquippedCooldowns(3);
          break;
        case 'reset_all_cd':
          this.reduceEquippedCooldowns(99);
          break;
        case 'grant_shield_stack':
          if (s.aspectStacks) {
            s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
          }
          break;
        case 'steal_tempo':
          this.oppTempoDrainTicks[oppTeam] = Math.max(this.oppTempoDrainTicks[oppTeam], 120);
          break;
        case 'counter_damage_amp':
          if (s.aspectStacks) {
            s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
          }
          break;
        case 'force_yellow_card': {
          const targetDef = s.players
            .filter(p => p.team === oppTeam && !p.redCard && p.role !== 'GK')
            .sort((a, c) => dist2D(a.pos, s.ball.pos) - dist2D(c.pos, s.ball.pos))[0];
          if (targetDef) {
            targetDef.yellowCards++;
            s.stats[oppTeam].yellowCards++;
            this.pushEvent('yellow_card', oppTeam, targetDef.id, targetDef.name, targetDef.pos, `【${sk.name}】迫使 ${targetDef.name} 领到黄牌！`, undefined, 'important');
            if (targetDef.yellowCards >= 2) {
              targetDef.redCard = true;
              s.stats[oppTeam].redCards++;
              this.pushEvent('red_card', oppTeam, targetDef.id, targetDef.name, targetDef.pos, `【两黄变红】${targetDef.name} 被罚下场！`, undefined, 'critical');
            }
          }
          break;
        }
        case 'drain_opp_stamina':
          for (const op of s.players) if (op.team === oppTeam && !op.redCard) op.fitness = Math.max(20, op.fitness - 5);
          break;
        case 'heal_team':
          for (const tp of s.players) if (tp.team === team && !tp.redCard) tp.fitness = Math.min(100, tp.fitness + 6);
          break;
        case 'extra_box_crash':
          this.applyCommandCard(team, {
            id: `v6_mini_crash_${s.tick}`,
            name: '禁区包抄',
            durationMinutes: 6,
            tacticalMod: { boxCrashBonus: 1, tempoMul: 1.08 },
          });
          break;
        case 'double_duration':
          break;
      }
    }

    // 3. 元素过载与 18 融合威能联动
    if (isElementOverdrive) {
      if (sk.linkedElement === 'press' || sk.linkedElement === 'blitz') {
        this.pushCoachReward({ nextCardDiscount: 1, bannerText: '【元素过载】下张指挥卡消耗 -1 能量！', tone: '#F97316' });
      } else if (sk.linkedElement === 'pass' && !this.aspectRefreshUsedThisMatch) {
        this.aspectRefreshUsedThisMatch = true;
        this.pushCoachReward({ refreshUsedCard: true, bannerText: '【传导过载】刷新 1 张已使用指挥卡！', tone: '#22D3EE' });
      } else if (sk.linkedElement === 'iron' && s.aspectStacks) {
        s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
      } else if (sk.linkedElement === 'wing' && s.aspectStacks) {
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
    }

    if (s.aspectStacks) {
      if (this.hasUserAspect('wing_counter_stack') && (sk.linkedElement === 'wing' || sk.situation === 'wing_overload')) {
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
      if (this.hasUserAspect('bus_shield_start1') && sk.situation === 'box_danger') {
        s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
      }
      if (this.hasUserAspect('press_tempo_drain') && sk.linkedElement === 'press') {
        this.oppTempoDrainTicks[oppTeam] = Math.max(this.oppTempoDrainTicks[oppTeam], 150);
      }
      if (this.hasUserAspect('wing_cd_refund') && sk.linkedElement === 'wing') {
        this.reduceEquippedCooldowns(2);
      }
      if (this.hasUserAspect('transition_surge')) {
        s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
      if (this.hasUserAspect('absorb_max3_counter') && (sk.situation === 'box_danger' || sk.instantAction === 'clear_danger')) {
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
    }
    if (this.hasUserAspect('midtrap_energy_steal') && sk.situation === 'midfield_press') {
      this.pushCoachReward({ energyRefund: 1, bannerText: '【五盾绞杀】汲取 +1 指挥能量！', tone: '#F59E0B' });
    }
    if (this.hasUserAspect('wing_switch_discount') && sk.linkedElement === 'wing') {
      this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
      this.pushCoachReward({ nextCardDiscount: 1, bannerText: '【双翼弹射】下张手牌 -1 能量！', tone: '#38BDF8' });
    }
    if (this.hasUserAspect('press_refund') && sk.linkedElement === 'press' && Math.random() < 0.55) {
      this.pushCoachReward({ energyRefund: 1, bannerText: '【不熄压迫】技卡共振返还 +1 能量！', tone: '#EF4444' });
    }

    const eff: CommandCardEffect = {
      ...sk.effect,
      passingDelta: sk.effect.passingDelta ? Math.round(sk.effect.passingDelta * mul) : undefined,
      shootingDelta: sk.effect.shootingDelta ? Math.round(sk.effect.shootingDelta * mul) : undefined,
      defendingDelta: sk.effect.defendingDelta ? Math.round(sk.effect.defendingDelta * mul) : undefined,
      paceDelta: sk.effect.paceDelta ? Math.round(sk.effect.paceDelta * mul) : undefined,
      composureDelta: sk.effect.composureDelta ? Math.round(sk.effect.composureDelta * mul) : undefined,
      goalkeepingDelta: sk.effect.goalkeepingDelta ? Math.round(sk.effect.goalkeepingDelta * mul) : undefined,
      fitnessInstantDelta: sk.effect.fitnessInstantDelta ? Math.round(sk.effect.fitnessInstantDelta * mul) : undefined,
    };

    this.applyCommandCard(team, eff);
    s.skillUses = s.skillUses ?? {};
    s.skillUses[skillId] = uses + 1;
    if (s.minute < 46) this.firstHalfSkillTriggers++;
    s.skillCooldowns = s.skillCooldowns ?? {};
    const isFreeFirstCd = !!sk.firstTriggerFreeCd && uses === 0;
    const effCd = isFreeFirstCd
      ? 0
      : (hasAnyCardBuff || isElementOverdrive)
      ? Math.round(sk.cooldownMinutes * 0.75)
      : sk.cooldownMinutes;
    s.skillCooldowns[skillId] = s.minute + effCd;
    const curTeamStyle = team === 'home' ? s.homeStyle : s.awayStyle;
    const isOffStyleGcd = !!(sk.styleTag && sk.styleTag !== curTeamStyle);
    this.teamSkillGcdMinute[team] = s.minute + (isOffStyleGcd ? 18 : 13);
    s.activeSkillPrompt = null;
    if (!this.prologueScriptedMode && team === this.userTeamSide) {
      const stTeam = s.stats[team];
      this.pendingSkillResolution = {
        team,
        skillName: sk.name,
        instantSummary,
        startTick: s.tick,
        expiresTick: s.tick + 25,
        startShots: stTeam.shots,
        startXG: stTeam.xG,
        startGoals: stTeam.goals,
        startTackles: stTeam.tackles,
      };
    }

    const effRank = sk.effectiveRank ?? 1;
    this.pushEvent(
      'commentary',
      team,
      '',
      '',
      s.ball.pos,
      `主动技觉醒【${sk.name} R${effRank}】：${instantSummary}`,
      undefined,
      'important'
    );

    return {
      ok: true,
      triggered: true,
      boosted: hasAnyCardBuff || isElementOverdrive,
      skillId: sk.id,
      skillName: sk.name,
      vfxTheme: (effRank >= 3 ? 'ult' : (sk.vfxTheme ?? 'ult')) as SkillVfxTheme,
      instantSummary,
      effectiveRank: effRank,
      isCardBoosted: hasAnyCardBuff || isElementOverdrive,
      mutationChoice: sk.mutationChoice,
      mutationLabel: sk.mutationLabel,
      instantAction: sk.instantAction,
      styleTag: sk.styleTag,
    };
  }

  public dismissActiveSkillPrompt(): void {
    this.state.activeSkillPrompt = null;
  }

  /**
   * 一键跑完全场（Headless 批量模拟用）
   */
  public simulateMatch(): MatchState {
    while (this.state.phase !== 'full_time') {
      this.step();
    }
    return this.state;
  }

  private getAttackDir(team: TeamSide): AttackDir {
    return team === 'home' ? this.state.homeAttackDir : (this.state.homeAttackDir === 1 ? -1 : 1);
  }

  private getPossessionTeam(): TeamSide | null {
    const b = this.state.ball;
    if (b.holderId) {
      const h = this.state.players.find(p => p.id === b.holderId);
      return h ? h.team : null;
    }
    return b.lastTouchTeam;
  }

  private clearHolder(): void {
    for (const p of this.state.players) p.hasBall = false;
    this.state.ball.holderId = null;
  }

  private giveBallTo(player: PlayerState): void {
    this.clearHolder();
    player.hasBall = true;
    player.decisionCooldown = 1; // 接球后停球缓冲 0.1s
    if (this.userTeamSide && player.team !== this.userTeamSide && this.state.aspectStacks) {
      this.state.aspectStacks.passSeq = 0;
    }
    const b = this.state.ball;
    b.mode = 'held';
    b.holderId = player.id;
    b.lastTouchTeam = player.team;
    b.targetPlayerId = null;
    b.pos = { x: player.pos.x, y: player.pos.y, z: 0 };
    b.vel = { x: 0, y: 0, z: 0 };
  }

  private setupKickoff(team: TeamSide): void {
    this.clearHolder();
    for (const p of this.state.players) {
      if (p.redCard) continue;
      const dir = this.getAttackDir(p.team);
      const slots = p.team === 'home' ? FORMATIONS[this.state.homeFormation] : FORMATIONS[this.state.awayFormation];
      const slot = slots[p.slotIndex];
      // 开球时退回己方半场
      const safeRelX = Math.min(48, slot.baseX);
      p.pos = { x: toAbsoluteX(safeRelX, dir), y: slot.baseY };
      p.vel = { x: 0, y: 0 };
      p.targetPos = { ...p.pos };
    }
    const kicker =
      this.state.players.find(p => p.team === team && !p.redCard && p.role === 'ST') ||
      this.state.players.find(p => p.team === team && !p.redCard && p.role !== 'GK')!;
    kicker.pos = { x: PITCH.HALF_X, y: PITCH.HALF_Y };
    this.giveBallTo(kicker);
    if (this.isKickoffFirst) {
      this.isKickoffFirst = false;
      const kc = this.commentary.formatKickoff(this.state.minute);
      this.pushEvent('kickoff', team, kicker.id, kicker.name, kicker.pos, kc.text, undefined, kc.level);
    }
  }

  private startSecondHalf(): void {
    this.state.phase = 'second_half';
    this.state.homeAttackDir = -1;
    // 半场体能小幅恢复
    for (const p of this.state.players) {
      if (!p.redCard) p.fitness = Math.min(100, p.fitness + 6);
    }
    this.setupKickoff('away');
  }

  private handleDeadBall(): void {
    const b = this.state.ball;
    if (b.deadTimer > 0) {
      b.deadTimer--;
      return;
    }

    const team = b.restartTeam;
    const dir = this.getAttackDir(team);
    let taker: PlayerState | undefined;

    if (b.restartType === 'goalkick') {
      taker = this.state.players.find(p => p.team === team && p.role === 'GK');
      // 真实门球规则：对方球员退至禁区外，本方中卫/边卫散开接应，避免禁区内弹球混战
      for (const p of this.state.players) {
        if (p.redCard || p.id === taker?.id) continue;
        if (p.team !== team) {
          const oppRelX = toRelativeX(p.pos.x, dir);
          if (oppRelX < 22) {
            p.pos.x = toAbsoluteX(24, dir);
          }
        } else if (p.role === 'CB' || p.role === 'LB' || p.role === 'RB') {
          p.pos.x = toAbsoluteX(19, dir);
        }
      }
    } else if (b.restartType === 'penalty') {
      // 直接罚点球
      const penSpotX = dir === 1 ? PITCH.LENGTH - PITCH.PENALTY_SPOT : PITCH.PENALTY_SPOT;
      taker = this.state.players
        .filter(p => p.team === team && !p.redCard && p.role !== 'GK')
        .sort((a, b2) => b2.attributes.shooting - a.attributes.shooting)[0];
      if (taker) {
        taker.pos = { x: penSpotX, y: PITCH.GOAL_Y };
        this.executeShot(taker, 0.76, false, 'penalty');
        return;
      }
    } else {
      const restartRelX = toRelativeX(b.restartPos.x, dir);
      // 角球与前场定位球：派 1~2 名中卫进禁区争顶，定位球核武流派可触发 +35% xG 加成
      if (b.restartType === 'corner' || (b.restartType === 'freekick' && restartRelX > 72)) {
        const hasSetPieceNuke = this.hasActiveMechanic(team, 'set_piece_nuke');
        if (hasSetPieceNuke) {
          this.setPieceBoostTicks = 45;
          this.setPieceBoostTeam = team;
        }
        const cbs = this.state.players
          .filter(p => p.team === team && !p.redCard && p.role === 'CB')
          .sort((a, b2) => b2.attributes.strength - a.attributes.strength);
        const defStyle = team === 'home' ? this.state.homeStyle : this.state.awayStyle;
        const pushCount = hasSetPieceNuke || defStyle === 'park_bus' || defStyle === 'wing_play' ? 2 : 1;
        for (let ci = 0; ci < Math.min(pushCount, cbs.length); ci++) {
          cbs[ci].pos = {
            x: toAbsoluteX(92 + (ci === 0 ? 1.5 : -1.5), dir),
            y: PITCH.HALF_Y + (ci === 0 ? -3.5 : 4.5),
          };
          cbs[ci].targetPos = { ...cbs[ci].pos };
        }
      }
      taker = this.state.players
        .filter(p => p.team === team && !p.redCard && p.role !== 'GK' && p.role !== 'CB')
        .sort((a, b2) => dist2D(a.pos, b.restartPos) - dist2D(b2.pos, b.restartPos))[0];
      if (b.restartType === 'corner' && taker) {
        taker.pos = { ...b.restartPos };
        taker.vel = { x: 0, y: 0 };
        const headerTarget = this.state.players
          .filter(p => p.team === team && !p.redCard && p.id !== taker!.id && p.role !== 'GK')
          .sort((a, b2) => (toRelativeX(b2.pos.x, dir) + b2.attributes.strength * 0.35) - (toRelativeX(a.pos.x, dir) + a.attributes.strength * 0.35))[0];
        if (headerTarget) {
          this.giveBallTo(taker);
          this.dispatchHook(team, 'onCorner');
          this.lastPassPattern[team] = 'set_piece';
          launchPassBall(b, taker.pos, headerTarget.pos, taker, headerTarget, 'cross');
          b.pos.z = 2.0;
          return;
        }
      } else if (b.restartType === 'freekick' && restartRelX >= 72 && Math.abs(b.restartPos.y - PITCH.GOAL_Y) <= 18) {
        const fkShooter = this.state.players
          .filter(p => p.team === team && !p.redCard && p.role !== 'GK')
          .sort((a, b2) => b2.attributes.shooting - a.attributes.shooting)[0];
        if (fkShooter && Math.random() < 0.60) {
          fkShooter.pos = { ...b.restartPos };
          fkShooter.vel = { x: 0, y: 0 };
          this.lastPassPattern[team] = 'set_piece';
          this.setPieceBoostTeam = team;
          this.setPieceBoostTicks = 15;
          this.executeShot(fkShooter, 0.14, false, 'normal');
          return;
        }
      }
    }

    if (taker) {
      taker.pos = { ...b.restartPos };
      taker.vel = { x: 0, y: 0 };
      this.giveBallTo(taker);
    } else {
      b.mode = 'loose';
    }
  }

  private handleHeldBall(): void {
    const b = this.state.ball;
    const holder = this.state.players.find(p => p.id === b.holderId);
    if (!holder) {
      b.mode = 'loose';
      return;
    }

    // 1. 检查近身防守抢断 / 犯规
    const oppStyle = holder.team === 'home' ? this.state.awayStyle : this.state.homeStyle;
    const pressMul = TACTICAL_PRESETS[oppStyle].pressIntensity;

    const defenders = this.state.players
      .filter(p => p.team !== holder.team && !p.redCard && p.stunTicks === 0 && p.role !== 'GK')
      .filter(p => dist2D(p.pos, holder.pos) < 2.35);

    if (defenders.length > 0) {
      const def = defenders[0];
      // 每 tick 约 26% * pressMul 尝试一次贴身对抗
      if (Math.random() < 0.26 * pressMul) {
        const oppTeam: TeamSide = holder.team === 'home' ? 'away' : 'home';
        const defPower = def.attributes.defending * 0.7 + def.attributes.strength * 0.3;
        const frenzyHolderEdge = this.hasActiveMechanic(holder.team, 'blood_frenzy') && this.isTrailing(holder.team) ? 4 : 0;
        const attPower = holder.attributes.dribbling * 0.7 + holder.attributes.strength * 0.3 + frenzyHolderEdge;
        const tackleGoldMul = def.goldTraits?.includes('精准铲断') ? 2 : 1;
        const traitTackleBonus = def.traits?.includes('精准铲断') ? 0.10 * tackleGoldMul : 0;
        const styleTackleBonus =
          oppStyle === 'gegenpress' ? 0.06 :
          oppStyle === 'park_bus' && toRelativeX(holder.pos.x, this.getAttackDir(holder.team)) >= 68 ? 0.045 : 0;
        const defFatigueTacklePenalty = def.fitness < 75 ? -((75 - def.fitness) / 55) * 0.08 : 0;
        const holderStyle = holder.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
        const holderForm = holder.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
        const holderRelX = toRelativeX(holder.pos.x, this.getAttackDir(holder.team));
        const counterStyleTackleMod =
          (oppStyle === 'gegenpress' && holderStyle === 'tiki_taka' && holderRelX < 55 ? 0.08 : 0) +
          ((oppStyle === 'gegenpress' || oppStyle === 'wing_play') && (holderStyle === 'counter' || holderStyle === 'park_bus') && holderRelX < 58 ? -0.06 : 0) +
          (holderStyle === 'balanced' && (oppStyle === 'gegenpress' || oppStyle === 'tiki_taka') ? 0.03 : 0) +
          (getDefenseSystem(holderForm) === '4-back' && holderRelX < 52 ? -0.03 : 0);
        const immuneHighPress = this.hasImmunity(holder.team, 'immuneHighPressTackle');
        const blitzBonus = !immuneHighPress && this.hasActiveMechanic(oppTeam, 'high_press_blitz') ? 0.12 : 0;
        const effStyleTackleBonus = immuneHighPress && oppStyle === 'gegenpress' ? 0 : styleTackleBonus;
        const traitFoulMul = def.traits?.includes('精准铲断') ? (def.goldTraits?.includes('精准铲断') ? 0.45 : 0.65) : 1.0;
        const defEffMods = this.getEffectiveMods(def.team);
        const attEffMods = this.getEffectiveMods(holder.team);
        const tackleWinProb = clamp(0.45 + ((defPower - attPower) / 100) * 0.55 + traitTackleBonus + effStyleTackleBonus + defFatigueTacklePenalty + counterStyleTackleMod + blitzBonus, 0.15, 0.92);

        const hRelX = toRelativeX(holder.pos.x, this.getAttackDir(holder.team));
        if (this.state.pendingClutchSetPiece?.[holder.team] && hRelX >= 68) {
          this.state.pendingClutchSetPiece[holder.team] = false;
          this.handleFoul(def, holder);
          return;
        }

        const inBoxNow =
          hRelX >= PITCH.LENGTH - PITCH.PENALTY_BOX_DEPTH &&
          Math.abs(holder.pos.y - PITCH.GOAL_Y) <= PITCH.PENALTY_BOX_HALF_W;
        const fkMul = hRelX >= 64 ? attEffMods.freeKickRateMul : 1.0;
        const boxFoulBoost = inBoxNow ? 0.08 : 0;
        if (Math.random() < clamp(0.24 * pressMul * traitFoulMul * defEffMods.foulRateMul * fkMul + boxFoulBoost, 0.05, 0.85)) {
          this.handleFoul(def, holder);
          return;
        }

        if (Math.random() < tackleWinProb) {
          def.matchStats.tackles++;
          this.state.stats[def.team].tackles++;
          holder.stunTicks = 5;
          this.giveBallTo(def);
          this.v6PassStreak[holder.team] = 0;
          this.dispatchHook(def.team, 'onTackle');
          if (def.traits?.includes('精准铲断')) {
            this.pushTacticalCallout(def, def.goldTraits?.includes('精准铲断') ? '★精准铲断' : '精准铲断', 'trait');
          }
          this.pushEvent('tackle', def.team, def.id, def.name, def.pos, `${def.name} 干净抢断 ${holder.name}`);
          return;
        } else {
          // 防守者被过掉，短暂硬直
          def.stunTicks = 6;
        }
      }
    }

    // 2. 持球人决策节拍
    if (holder.decisionCooldown > 0) return;

    const style = holder.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
    const effMods = this.getEffectiveMods(holder.team);
    const oppModsForPass = this.getEffectiveMods(holder.team === 'home' ? 'away' : 'home');
    const mods: TacticalMods = {
      ...effMods,
      throughPassBias: (effMods.throughPassBias ?? 0) + (oppModsForPass.oppThroughPassBonus ?? 0),
      longShotBias: (effMods.longShotBias ?? 0) + (oppModsForPass.oppLongShotBonus ?? 0),
    };
    const dir = this.getAttackDir(holder.team);
    const action = decideOnBall(holder, dir, style, this.state.players, b, mods);

    const effTempo = clamp(TACTICAL_PRESETS[style].tempo * effMods.tempoMul, 0.60, 1.55);
    const interval = Math.max(2, Math.round(SIM_CONFIG.DECISION_INTERVAL / effTempo));
    holder.decisionCooldown = interval;

    if (action.type === 'shoot') {
      this.executeShot(holder, action.xG);
    } else if (action.type === 'pass') {
      this.executePass(holder, action.target, action.passType, action.patternTag);
    } else {
      holder.targetPos = action.targetPos;
    }
  }

  private executePass(
    passer: PlayerState,
    target: PlayerState,
    passType: 'short' | 'through' | 'cross' | 'long',
    patternTag?: string
  ): void {
    passer.hasBall = false;
    passer.matchStats.passes++;
    this.state.stats[passer.team].passes++;
    this.lastPassTimestamp = this.state.tick;
    this.lastPassPattern[passer.team] =
      patternTag ?? (passType === 'through' ? 'through_ball' : passType === 'cross' ? 'byline_cross' : 'central_combo');

    // 检查越位（球离开脚瞬间，接球者在对方半场且在越位线前）
    const dir = this.getAttackDir(passer.team);
    const defenders = this.state.players.filter(p => p.team !== passer.team && !p.redCard);
    defenders.sort((a, b) => (dir === 1 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x));
    const offsideLine = defenders.length >= 2
      ? (dir === 1 ? Math.max(PITCH.HALF_X, defenders[1].pos.x) : Math.min(PITCH.HALF_X, defenders[1].pos.x))
      : PITCH.HALF_X;

    const targetIsOffside =
      target.role !== 'GK' &&
      (dir === 1 ? target.pos.x > offsideLine + 0.9 : target.pos.x < offsideLine - 0.9);

    const oppTeamForOffside: TeamSide = passer.team === 'home' ? 'away' : 'home';
    const offsideProb = clamp(0.78 + (this.getEffectiveMods(oppTeamForOffside).offsideTrapBonus ?? 0), 0.65, 0.96);
    if (this.bypassOffsideTicks[passer.team] > 0) {
      this.bypassOffsideTicks[passer.team] = 0;
    } else if (targetIsOffside && Math.random() < offsideProb) {
      const oppTeam = oppTeamForOffside;
      this.state.stats[passer.team].offsides++;
      const oc = this.commentary.formatOffside(passer.team, target.name, this.state.minute);
      this.pushEvent('offside', passer.team, target.id, target.name, target.pos, oc.text, undefined, oc.level);
      if (this.hasActiveMechanic(oppTeam, 'offside_trap')) {
        this.pushEvent('commentary', oppTeam, '', '', target.pos, '【越位陷阱】造越位成功！防线反击提速', undefined, 'important', 'MOMENTUM');
      }
      this.dispatchHook(oppTeam, 'onOffsideTrap');
      this.setDeadBall(oppTeam, 'freekick', target.pos, 4);
      return;
    }

    // 预判传球提前量（阵风天气下长传/传中产生轻微风偏）
    const windDrift = this.state.weather === 'wind' && (passType === 'long' || passType === 'cross') ? 1.4 : 0;
    const leadPos: Vec2 = {
      x: clamp(target.pos.x + target.vel.x * 0.35 + (Math.random() - 0.5) * windDrift, 2, PITCH.LENGTH - 2),
      y: clamp(target.pos.y + target.vel.y * 0.35 + (Math.random() - 0.5) * windDrift, 2, PITCH.WIDTH - 2),
    };

    launchPassBall(this.state.ball, passer.pos, leadPos, passer, target, passType);
    if (this.userTeamSide === passer.team && (passType === 'long' || passType === 'through') && this.hasUserAspect('counter_pass_speed')) {
      this.state.ball.vel.x *= 1.15;
      this.state.ball.vel.y *= 1.15;
    }
  }

  private executeShot(
    shooter: PlayerState,
    xG: number,
    forceOnTarget = false,
    shotTypeOverride?: 'normal' | 'long_range' | 'header' | 'penalty'
  ): void {
    const dir = this.getAttackDir(shooter.team);
    const goalX = dir === 1 ? PITCH.LENGTH : 0;
    const dist = dist2D(shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
    if (this.userTeamSide === shooter.team && this.state.aspectStacks && this.state.aspectStacks.counterCharges > 0) {
      const stacks = this.state.aspectStacks.counterCharges;
      this.state.aspectStacks.counterCharges = 0;
      xG = Math.min(0.75, xG + stacks * 0.10);
    }
    if (this.guaranteeShotOnTargetTicks[shooter.team] > 0) {
      forceOnTarget = true;
      this.guaranteeShotOnTargetTicks[shooter.team] = 0;
      xG = Math.min(0.75, xG * 1.15);
    }
    if (this.setPieceBoostTicks > 0 && this.setPieceBoostTeam === shooter.team) {
      xG = Math.min(0.68, xG * 1.35);
      this.setPieceBoostTicks = 0;
    }
    if (this.gkCounterBoostTicks[shooter.team] > 0) {
      xG = Math.min(0.68, xG * 1.25);
      this.gkCounterBoostTicks[shooter.team] = 0;
    }
    const hasLongShotCannon = dist >= 18 && this.hasActiveMechanic(shooter.team, 'long_shot_cannon');
    if (hasLongShotCannon) {
      xG = Math.min(0.68, xG * 1.30);
    }
    if (dist >= 20 && shooter.traits?.includes('世界波猎手')) {
      xG = Math.min(0.72, xG * 1.15);
      this.pushTacticalCallout(shooter, '★世界波猎手', 'trait');
    } else if (dist >= 18 && shooter.traits?.includes('远射重炮')) {
      this.pushTacticalCallout(shooter, shooter.goldTraits?.includes('远射重炮') ? '★远射重炮' : '远射重炮', 'trait');
    } else if (dist < 16.5 && shooter.traits?.includes('禁区狐狸')) {
      this.pushTacticalCallout(shooter, shooter.goldTraits?.includes('禁区狐狸') ? '★禁区狐狸' : '禁区狐狸', 'trait');
    }
    if (this.userTeamSide === shooter.team && this.userScoutCounterLabel && this.state.minute - this.lastScoutCalloutMin >= 12) {
      this.lastScoutCalloutMin = this.state.minute;
      this.pushTacticalCallout(shooter, this.userScoutCounterLabel, 'scout');
    }
    const hasBloodFrenzy = this.hasActiveMechanic(shooter.team, 'blood_frenzy') && this.isTrailing(shooter.team);
    if (hasBloodFrenzy) {
      xG = Math.min(0.68, xG * 1.10);
    }
    const myStyleShot = shooter.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
    const myFormShot = shooter.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
    const oppStyleShot = shooter.team === 'home' ? this.state.awayStyle : this.state.homeStyle;
    const oppFormShot = shooter.team === 'home' ? this.state.awayFormation : this.state.homeFormation;
    const oppIs5Back = getDefenseSystem(oppFormShot) === '5-back';
    if ((myStyleShot === 'counter' || myStyleShot === 'park_bus') && (oppStyleShot === 'gegenpress' || oppStyleShot === 'wing_play')) {
      xG = Math.min(0.68, xG + (myStyleShot === 'counter' ? 0.05 : 0.04));
      this.pushTacticalCallout(shooter, '战术克制 +xG', 'tactic');
    } else if (myStyleShot === 'park_bus' && oppStyleShot !== 'park_bus') {
      xG = Math.min(0.68, xG + 0.015);
    } else if (oppStyleShot === 'gegenpress' && dist >= 18 && dist < 24) {
      xG = Math.min(0.68, xG + 0.02);
    } else if (myStyleShot === 'tiki_taka' && oppStyleShot === 'park_bus') {
      xG = Math.min(0.68, xG + 0.04);
      this.pushTacticalCallout(shooter, '传控破铁桶', 'tactic');
    } else if (myStyleShot === 'balanced' && dist < 18) {
      xG = Math.min(0.68, xG + 0.02);
    }
    if (myStyleShot === 'tiki_taka' && (this.v6PassStreak[shooter.team] ?? 0) >= 4) {
      xG = Math.min(0.68, xG + 0.035);
      this.pushTacticalCallout(shooter, '传控渗透撕防', 'tactic');
    }
    if ((myStyleShot === 'wing_play' || getDefenseSystem(myFormShot) === '3-back') && toRelativeX(shooter.pos.x, dir) > 72) {
      xG = Math.min(0.68, xG + 0.03);
    }
    if (getDefenseSystem(myFormShot) === '4-back' && toRelativeX(shooter.pos.x, dir) > 70) {
      xG = Math.min(0.68, xG + 0.025);
    }
    shooter.hasBall = false;
    shooter.matchStats.shots++;
    this.state.stats[shooter.team].shots++;
    this.state.stats[shooter.team].xG += xG;

    // 决定是否射正门框范围内（受 shooting、平滑疲惫曲线、五后卫/铁桶密集干扰与距离影响）
    const fatiguePenalty = shooter.fitness < 72 ? ((72 - shooter.fitness) / 52) * 0.07 : 0;
    const strainPenalty = shooter.strainWarning ? 0.035 : 0;
    const antiAttackShotPenalty =
      (oppIs5Back && (myStyleShot === 'wing_play' || getDefenseSystem(myFormShot) === '3-back') ? 0.04 : 0) +
      (oppStyleShot === 'park_bus' && (myStyleShot === 'wing_play' || myStyleShot === 'gegenpress') ? 0.05 : 0);
    const rawShoot = Math.min(this.teamAttrCap[shooter.team], shooter.attributes.shooting + (hasBloodFrenzy ? 8 : 0));
    const effectiveShoot = rawShoot > 80 ? 80 + (rawShoot - 80) * 1.35 : rawShoot;
    const longDistPenalty = dist >= 22 && !hasLongShotCannon ? (dist - 20) * 0.015 : 0;
    const onTargetProb = clamp(
      0.24 + (effectiveShoot / 99) * 0.34 - (dist / 32) * 0.16 - longDistPenalty - fatiguePenalty - strainPenalty - antiAttackShotPenalty + (hasLongShotCannon ? 0.14 : 0),
      0.10,
      hasLongShotCannon ? 0.74 : 0.68
    );
    const onTarget = forceOnTarget || Math.random() < onTargetProb;
    if (onTarget) {
      this.state.stats[shooter.team].shotsOnTarget++;
    }

    const targetY = onTarget
      ? PITCH.GOAL_Y + (Math.random() - 0.5) * (PITCH.GOAL_HALF_WIDTH * 1.8)
      : PITCH.GOAL_Y + (Math.random() < 0.5 ? -1 : 1) * (PITCH.GOAL_HALF_WIDTH + 1.2 + Math.random() * 3.0);
    const targetZ = onTarget ? 0.3 + Math.random() * 1.8 : 0.6 + Math.random() * 2.8;

    this.lastShotType = shotTypeOverride ?? (dist >= 20 ? 'long_range' : this.state.ball.pos.z > 0.9 ? 'header' : 'normal');
    this.lastShotOriginPos = { x: shooter.pos.x, y: shooter.pos.y };
    const recentPass = this.state.tick - this.lastPassTimestamp <= 45;
    const lp = this.lastPassPattern[shooter.team];
    const atkPat =
      shotTypeOverride === 'penalty'
        ? 'penalty'
        : lp === 'set_piece' && recentPass
        ? 'set_piece'
        : this.setPieceBoostTicks > 0 && this.setPieceBoostTeam === shooter.team
        ? 'set_piece'
        : lp === 'set_piece' && recentPass
        ? 'set_piece'
        : (shotTypeOverride === 'header' || lp === 'byline_cross' || lp === 'early_cross') && recentPass
        ? (lp === 'early_cross' ? 'early_cross' : 'byline_cross')
        : lp === 'cutback' && recentPass
        ? 'cutback'
        : lp === 'through_ball' && recentPass
        ? 'through_ball'
        : dist >= 18
        ? 'long_shot'
        : 'central_combo';
    this.lastShotAttackPattern[shooter.team] = atkPat;
    const stStats = this.state.stats[shooter.team];
    stStats.attackShotPatterns = stStats.attackShotPatterns ?? {};
    stStats.attackShotPatterns[atkPat] = (stStats.attackShotPatterns[atkPat] ?? 0) + 1;
    const sc = this.commentary.formatShot(shooter.team, shooter.name, xG, this.state.minute);
    this.pushEvent('shot', shooter.team, shooter.id, shooter.name, shooter.pos, sc.text, xG, sc.level);
    this.dispatchHook(shooter.team, 'onShot');
    if (sc.momentumText) {
      this.pushEvent('commentary', shooter.team, '', '', shooter.pos, sc.momentumText, undefined, 'important', 'MOMENTUM');
    }
    launchShotBall(this.state.ball, shooter, dir, xG, onTarget, targetY, targetZ);
  }

  private handlePassFlight(): void {
    const b = this.state.ball;

    // 1. 出界检查
    if (this.checkOutOfBounds()) return;

    // 2. 防守球员路径拦截检查（高度低于 2.1m 才能拦截）
    if (b.pos.z < 2.1) {
      for (const p of this.state.players) {
        if (p.team === b.lastTouchTeam || p.redCard || p.stunTicks > 0) continue;
        const defIntMods = this.getEffectiveMods(p.team);
        const d = dist2D(p.pos, b.pos);
        if (d < 2.2 + (defIntMods.interceptRangeBonus ?? 0)) {
          const passTeam: TeamSide = b.lastTouchTeam ?? 'home';
          const passStyle = passTeam === 'home' ? this.state.homeStyle : this.state.awayStyle;
          const defStyleInt = p.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
          const defFormInt = p.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
          const defIs5Back = getDefenseSystem(defFormInt) === '5-back';
          let interceptMod = defIntMods.interceptProbBonus ?? 0;
          if (defStyleInt === 'gegenpress' && (b.passType === 'through' || b.passType === 'long')) {
            interceptMod -= (passStyle === 'counter' || passStyle === 'park_bus') ? 0.10 : 0.03;
          }
          if ((defIs5Back || defStyleInt === 'park_bus') && b.passType === 'cross') {
            interceptMod += 0.14;
          }
          if ((defIs5Back || defStyleInt === 'park_bus') && passStyle === 'counter' && b.passType === 'through') {
            interceptMod += 0.05;
          }
          if (passStyle === 'counter' && (b.passType === 'through' || b.passType === 'long')) {
            interceptMod -= 0.05;
          }
          const passerObj = b.lastPasserId ? this.state.players.find(pl => pl.id === b.lastPasserId) : null;
          const passerPass = passerObj ? passerObj.attributes.passing : 65;
          const isLoftedPass = b.passType === 'cross' || b.passType === 'long';
          const passerResist =
            ((passerPass - 60) / 100) * 0.28 +
            (passerObj?.traits?.includes('节拍器') ? (passerObj.goldTraits?.includes('节拍器') ? 0.08 : 0.05) : 0) +
            (isLoftedPass && passerObj?.traits?.includes('精准长传') ? (passerObj.goldTraits?.includes('精准长传') ? 0.10 : 0.06) : 0);
          const oppTempoPenalty = this.oppTempoDrainTicks[passTeam] > 0 ? 0.08 : 0;
          const interceptChance = clamp(0.50 + ((p.attributes.defending - 60) / 100) * 0.28 - passerResist + interceptMod + oppTempoPenalty, 0.24, 0.88);
          if (Math.random() < interceptChance) {
            p.matchStats.interceptions++;
            this.state.stats[p.team].interceptions++;
            this.v6PassStreak[passTeam] = 0;
            this.giveBallTo(p);
            this.dispatchHook(p.team, 'onIntercept');
            this.pushEvent('interception', p.team, p.id, p.name, p.pos, `${p.name} 预判拦截传球`);
            return;
          }
        }
      }
    }

    // 3. 目标接球检查
    const target = b.targetPlayerId
      ? this.state.players.find(p => p.id === b.targetPlayerId)
      : null;
    if (target && dist2D(target.pos, b.pos) < 1.75 && b.pos.z < 2.2) {
      const passer = this.state.players.find(p => p.id === b.lastPasserId);
      if (passer) {
        passer.matchStats.passesSuccess++;
        this.state.stats[passer.team].passesSuccess++;
        const pk = passer.id < target.id ? `${passer.id}|${target.id}` : `${target.id}|${passer.id}`;
        this.state.pairPasses = this.state.pairPasses ?? {};
        this.state.pairPasses[pk] = (this.state.pairPasses[pk] ?? 0) + 1;
        if (passer.traits?.includes('节拍器') && Math.random() < 0.22) {
          this.pushTacticalCallout(passer, passer.goldTraits?.includes('节拍器') ? '★节拍器' : '节拍器', 'trait');
        }
        const effChem = Math.max(0, this.userChemAvg + this.getEffectiveChemDelta(passer.team));
        const chemProb = Math.min(0.45, 0.08 + effChem * 0.0035);
        if (this.userTeamSide === passer.team && effChem >= 15 && Math.random() < chemProb) {
          this.pushTacticalCallout(passer, '默契连线', 'chemistry');
        }
        if (this.userTeamSide === passer.team && this.state.aspectStacks) {
          const ast = this.state.aspectStacks;
          ast.passSeq++;
          if (ast.passSeq >= 4 && this.hasUserAspect('pass4_cd_cut')) {
            ast.passSeq = 0;
            this.reduceEquippedCooldowns(1);
          } else if (ast.passSeq >= 5 && this.hasUserAspect('pass5_card_discount')) {
            ast.passSeq = 0;
            this.pushCoachReward({ nextCardDiscount: 1, bannerText: '【传控枢纽】5连传导，下张指挥卡 -1 能量！', tone: '#38BDF8' });
          } else if (ast.passSeq >= 5 && this.hasUserAspect('pass5_cd_cut2')) {
            ast.passSeq = 0;
            this.reduceEquippedCooldowns(2);
          } else if (ast.passSeq >= 5 && this.hasUserAspect('deep_buildup_refresh') && !this.aspectRefreshUsedThisMatch) {
            ast.passSeq = 0;
            this.aspectRefreshUsedThisMatch = true;
            this.pushCoachReward({ refreshUsedCard: true, bannerText: '【出球大师】5连稳健传导，刷新 1 张已用手牌！', tone: '#2DD4BF' });
          }
        }
        const pepHeal = this.state.activeBuffs
          .filter(bf => bf.team === passer.team && (bf.effect.affix?.passHealEvery6 ?? 0) > 0)
          .reduce((s2, bf) => s2 + (bf.effect.affix?.passHealEvery6 ?? 0), 0);
        if (this.hasActiveMechanic(passer.team, 'tiki_taka_flow') || pepHeal > 0) {
          this.tikiTakaPassCount[passer.team]++;
          if (this.tikiTakaPassCount[passer.team] >= 6) {
            this.tikiTakaPassCount[passer.team] = 0;
            const healAmt = (this.hasActiveMechanic(passer.team, 'tiki_taka_flow') ? 2 : 0) + pepHeal;
            for (const tm of this.state.players) {
              if (tm.team === passer.team && !tm.redCard) {
                tm.fitness = Math.min(100, tm.fitness + healAmt);
              }
            }
          }
        }
        if (passer.role === 'GK' && this.hasActiveMechanic(passer.team, 'gk_counter_launch')) {
          this.gkCounterBoostTicks[passer.team] = 50;
        }
        this.v6PassStreak[passer.team] = (this.v6PassStreak[passer.team] ?? 0) + 1;
        this.dispatchHook(passer.team, 'onPassStreak', { passStreak: this.v6PassStreak[passer.team] });
        if (b.passType === 'cross') {
          this.dispatchHook(passer.team, 'onCross');
        }
      }
      this.giveBallTo(target);

      // 如果是高质量边路传中到禁区，抢点前锋/后插上中卫有较高概率直接头球/垫射
      const tStyle = target.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
      const tMods = target.team === 'home' ? this.homeMods : this.awayMods;
      const isCornerCross = this.lastPassPattern[target.team] === 'set_piece';
      const baseCrossFinish = isCornerCross ? 0.68 : tStyle === 'wing_play' || (tMods.crossBias ?? 0) > 0.03 ? 0.71 : 0.56;
      const defFormCross = target.team === 'home' ? this.state.awayFormation : this.state.homeFormation;
      const defStyleCross = target.team === 'home' ? this.state.awayStyle : this.state.homeStyle;
      const antiCrossPenalty =
        (getDefenseSystem(defFormCross) === '5-back' ? 0.07 : 0) +
        (defStyleCross === 'park_bus' ? 0.06 : 0);
      const crossFinishProb = clamp(
        baseCrossFinish + (this.hasActiveMechanic(target.team, 'wing_overload') ? 0.26 : 0) - antiCrossPenalty,
        0.25,
        0.92
      );
      if (b.passType === 'cross' && target.role !== 'GK' && Math.random() < crossFinishProb) {
        const dir = this.getAttackDir(target.team);
        const relX = toRelativeX(target.pos.x, dir);
        if (relX > 76) {
          const headXg = isCornerCross ? 0.22 : this.hasActiveMechanic(target.team, 'wing_overload') ? 0.24 : (tStyle === 'wing_play' ? 0.23 : 0.19);
          this.executeShot(target, headXg, false, 'header');
        }
      }
      return;
    }

    // 4. 球速慢下来变成自由球
    const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
    if (speed < 2.5 && b.pos.z <= 0.1) {
      b.mode = 'loose';
    }
  }

  private handleShotFlight(): void {
    const b = this.state.ball;
    const shooter = this.state.players.find(p => p.id === b.shotShooterId);
    const shootTeam = shooter ? shooter.team : (b.lastTouchTeam || 'home');
    const defTeam: TeamSide = shootTeam === 'home' ? 'away' : 'home';

    // 1. 门前防守封堵检测（五后卫体系与铁桶防反密集封堵半径与成功率更高）
    const defStyle = defTeam === 'home' ? this.state.homeStyle : this.state.awayStyle;
    const defForm = defTeam === 'home' ? this.state.homeFormation : this.state.awayFormation;
    const isFiveBack = getDefenseSystem(defForm) === '5-back';
    const hasIronWall = this.hasActiveMechanic(defTeam, 'iron_wall_block');
    const defShotMods = this.getEffectiveMods(defTeam);
    const shootEffMods = this.getEffectiveMods(shootTeam);
    const shootForm = shootTeam === 'home' ? this.state.homeFormation : this.state.awayFormation;
    const shootStyle = shootTeam === 'home' ? this.state.homeStyle : this.state.awayStyle;
    const fiveVsCounterTarget = isFiveBack && (getDefenseSystem(shootForm) === '3-back' || shootStyle === 'wing_play') ? 0.03 : 0;
    const busVsCounterTarget = defStyle === 'park_bus' && (shootStyle === 'wing_play' || shootStyle === 'gegenpress') ? 0.09 : 0;
    const blockDist = (defStyle === 'park_bus' || isFiveBack ? 1.36 : 1.08) + (hasIronWall ? 0.25 : 0);
    const blockProb = clamp((defStyle === 'park_bus' || isFiveBack ? 0.22 : 0.18) + fiveVsCounterTarget + busVsCounterTarget + (hasIronWall ? 0.16 : 0) + defShotMods.blockBonus, 0.05, 0.78);
    const skipPrologueBlock = this.prologueScriptedMode && shootTeam === this.userTeamSide && (this.prologueSkillTriggered || this.prologueGuaranteedGoal);
    if (b.pos.z < 1.9 && !skipPrologueBlock) {
      for (const p of this.state.players) {
        if (p.team !== defTeam || p.redCard || p.role === 'GK') continue;
        if (dist2D(p.pos, b.pos) < blockDist && Math.random() < blockProb) {
          b.vel.x = -b.vel.x * 0.35 + (Math.random() - 0.5) * 4;
          b.vel.y = (Math.random() - 0.5) * 8;
          b.mode = 'loose';
          b.lastTouchTeam = defTeam;
          this.dispatchHook(defTeam, 'onBlock');
          return;
        }
      }
    }

    // 2. 到达球门线结算
    const crossedLeft = b.pos.x <= 0.5;
    const crossedRight = b.pos.x >= PITCH.LENGTH - 0.5;
    if (!crossedLeft && !crossedRight) {
      // 球中途停下
      const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
      if (speed < 2.0 && b.pos.z <= 0.1) b.mode = 'loose';
      return;
    }

    const inGoalMouth =
      b.shotOnTarget &&
      Math.abs(b.pos.y - PITCH.GOAL_Y) <= PITCH.GOAL_HALF_WIDTH &&
      b.pos.z <= 2.44;

    if (!inGoalMouth) {
      const mc = this.commentary.formatMiss(shootTeam, shooter?.name || '前锋', this.state.minute);
      this.pushEvent('miss', shootTeam, shooter?.id || '', shooter?.name || '', b.pos, mc.text, undefined, mc.level);
      if (Math.random() < clamp(0.30 * shootEffMods.cornerRateMul, 0.10, 0.85)) {
        this.state.stats[shootTeam].corners++;
        const cornerX = crossedLeft ? 1 : PITCH.LENGTH - 1;
        const cornerY = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        const cc = this.commentary.formatCorner(shootTeam, this.state.minute);
        this.pushEvent('corner', shootTeam, '', '', { x: cornerX, y: cornerY }, cc.text, undefined, cc.level);
        this.setDeadBall(shootTeam, 'corner', { x: cornerX, y: cornerY }, 5);
      } else {
        this.setDeadBall(defTeam, 'goalkick', { x: crossedLeft ? 5.5 : PITCH.LENGTH - 5.5, y: PITCH.GOAL_Y }, 5);
      }
      return;
    }

    // 3. 门将扑救判定（L1+L2 校准：AI 内战总进球 2.3~2.7，零封率 28%~35%，并拉开 80+ 高分区分化）
    const gk = this.state.players.find(p => p.team === defTeam && p.role === 'GK');
    const rawGk = gk ? gk.attributes.goalkeeping : 65;
    const gkAttr = rawGk > 80 ? 80 + (rawGk - 80) * 1.15 : rawGk;
    const frenzyShootBonus = shooter && this.hasActiveMechanic(shooter.team, 'blood_frenzy') && this.isTrailing(shooter.team) ? 8 : 0;
    const rawShooterShoot = shooter ? Math.min(this.teamAttrCap[shooter.team], shooter.attributes.shooting + frenzyShootBonus) : 70;
    const rawShooterComp = shooter ? shooter.attributes.composure : 70;
    const baseShooterAttr = rawShooterShoot * 0.65 + rawShooterComp * 0.35;
    const shooterAttr = baseShooterAttr > 80 ? 80 + (baseShooterAttr - 80) * 1.15 : baseShooterAttr;
    const gkGoldMul = gk?.goldTraits?.includes('门线神扑') ? 2 : 1;
    const gkTraitBonus = gk?.traits?.includes('门线神扑') ? 0.045 * gkGoldMul : 0;
    const gkGodBonus = gk?.traits?.includes('门线战神') ? 0.04 : 0;
    const gkSaveBonus = ((rawGk - 65) / 100) * 0.16 + gkTraitBonus + gkGodBonus;
    const attrDiffBonus = ((shooterAttr - gkAttr) / 100) * 0.28;
    const strainGoalPenalty = shooter?.strainWarning ? 0.04 : 0;
    const cardXgDefensePenalty = defShotMods.oppShotXgPenalty * 0.45;
    let goalProb = clamp(0.33 + b.shotXG * 0.88 + attrDiffBonus - gkSaveBonus - strainGoalPenalty - cardXgDefensePenalty, 0.12, 0.76);
    if (this.prologueScriptedMode) {
      if (shootTeam === this.userTeamSide && (this.prologueSkillTriggered || this.prologueGuaranteedGoal)) goalProb = 1.0;
      else if (shootTeam === 'away' && this.prologueAllowAwayGoal) goalProb = 1.0;
      else goalProb = 0.0;
    }

    if (Math.random() < goalProb) {
      if (this.userTeamSide === defTeam && this.state.aspectStacks && this.state.aspectStacks.shieldCharges > 0) {
        this.state.aspectStacks.shieldCharges--;
        if (gk) gk.matchStats.saves++;
        this.state.stats[defTeam].saves++;
        this.pushEvent('save', defTeam, gk?.id || '', gk?.name || '门将', b.pos, `【传奇护盾】${gk?.name || '后卫与门将'} 门线极限化解必进球！`, undefined, 'important');
        if (this.hasUserAspect('clear_counter_stack')) {
          this.state.aspectStacks.counterCharges = Math.min(this.getCounterCap(), this.state.aspectStacks.counterCharges + 1);
        }
        if (gk) this.giveBallTo(gk);
        else {
          b.mode = 'loose';
          b.lastTouchTeam = defTeam;
        }
        return;
      }
      // 进球！
      if (shooter) shooter.matchStats.goals++;
      this.state.stats[shootTeam].goals++;
      if (shootTeam === 'home') {
        this.state.homeScore++;
        if (this.prologueScriptedMode) {
          this.prologuePendingForcedGoal = false;
          this.prologueGuaranteedGoal = false;
          this.prologueSkillTriggered = false;
          if (this.state.homeScore === 1 && this.prologueStage < 2) this.prologueStage = 2;
          else if (this.state.homeScore === 2 && this.prologueStage < 4) this.prologueStage = 4;
          else if (this.state.homeScore === 3 && this.prologueStage < 6) this.prologueStage = 6;
          else if (this.state.homeScore >= 4 && this.prologueStage < 7) this.prologueStage = 7;
        }
      } else {
        this.state.awayScore++;
        if (this.prologueScriptedMode) {
          this.prologueAllowAwayGoal = false;
          if (this.state.awayScore === 2) {
            this.pushEvent('commentary', 'away', '', '', b.pos, '【1:2 遭反超】铁幕联抓住了压上后的空当反击得手！不要慌，稳住节奏！', undefined, 'important');
          } else if (this.state.awayScore >= 3) {
            this.pushEvent('commentary', 'away', '', '', b.pos, '【1:3 陷入绝境】年轻防线连续丢球！只剩二十多分钟，必须背水一战了！', undefined, 'important');
          }
        }
      }

      // 助攻统计（如果上一脚传球在 6 秒内且同队）
      let assisterName: string | undefined;
      if (b.lastPasserId && shooter && b.lastPasserId !== shooter.id && this.state.tick - this.lastPassTimestamp <= 60) {
        const assister = this.state.players.find(p => p.id === b.lastPasserId && p.team === shootTeam);
        if (assister) {
          assister.matchStats.assists++;
          assisterName = assister.name;
          const ak = assister.id < shooter.id ? `${assister.id}|${shooter.id}` : `${shooter.id}|${assister.id}`;
          this.state.pairAssists = this.state.pairAssists ?? {};
          this.state.pairAssists[ak] = (this.state.pairAssists[ak] ?? 0) + 1;
          if (assister.matchStats.assists >= 2) {
            this.tryRevealHiddenTrait(assister, '助攻大师');
          }
        }
      }

      const gc = this.commentary.formatGoal({
        minute: this.state.minute,
        team: shootTeam,
        player: shooter?.name || '前锋',
        assist: assisterName,
        homeScore: this.state.homeScore,
        awayScore: this.state.awayScore,
        shotType: this.lastShotType,
      });
      const goalEventPos = this.lastShotOriginPos ?? b.pos;
      const gPat = this.lastShotAttackPattern[shootTeam] ?? 'central_combo';
      const gStats = this.state.stats[shootTeam];
      gStats.attackGoalPatterns = gStats.attackGoalPatterns ?? {};
      gStats.attackGoalPatterns[gPat] = (gStats.attackGoalPatterns[gPat] ?? 0) + 1;
      this.pushEvent('goal', shootTeam, shooter?.id || '', shooter?.name || '', goalEventPos, gc.text, b.shotXG, gc.level, gc.narrativeTag);

      // 触发式隐藏词条觉醒检测
      if (shooter) {
        const trailingBefore =
          (shootTeam === 'home' && this.state.homeScore - 1 < this.state.awayScore) ||
          (shootTeam === 'away' && this.state.awayScore - 1 < this.state.homeScore);
        if (trailingBefore) this.tryRevealHiddenTrait(shooter, '逆转王');
        if (shooter.subbedIn) this.tryRevealHiddenTrait(shooter, '超级替补');
        if (this.state.minute >= 70) this.tryRevealHiddenTrait(shooter, '大赛先生');
        if (this.state.minute <= 25 && this.state.homeScore + this.state.awayScore === 1) {
          this.tryRevealHiddenTrait(shooter, '闪电首开');
        }
        if (this.lastShotType === 'long_range') {
          this.tryRevealHiddenTrait(shooter, '世界波猎手');
        }
        if (this.lastShotType === 'header') {
          this.tryRevealHiddenTrait(shooter, '高空霸主');
        }
      }

      if (this.prologueScriptedMode && shootTeam === this.userTeamSide) {
        this.prologueGuaranteedGoal = false;
        this.prologueSkillTriggered = false;
      }
      const concedeTeam: TeamSide = shootTeam === 'home' ? 'away' : 'home';
      if (this.state.lastConcededMin) this.state.lastConcededMin[concedeTeam] = this.state.minute;
      this.dispatchHook(concedeTeam, 'onConcede');
      this.setupKickoff(concedeTeam);
    } else {
      // 门将扑救
      if (gk) {
        gk.matchStats.saves++;
        if (gk.matchStats.saves >= 3) {
          this.tryRevealHiddenTrait(gk, '门线战神');
        }
      }
      this.state.stats[defTeam].saves++;
      if (this.state.lastSaveMin) this.state.lastSaveMin[defTeam] = this.state.minute;
      this.dispatchHook(defTeam, 'onSave');
      this.v6ForcedCornerProb[shootTeam] = 0;
      if (this.lastShotType === 'long_range') {
        this.dispatchHook(shootTeam, 'onLongShotSaved');
      }
      const svc = this.commentary.formatSave(defTeam, gk?.name || '门将', shooter?.name || '前锋', this.state.minute);
      this.pushEvent('save', defTeam, gk?.id || '', gk?.name || '门将', b.pos, svc.text, undefined, svc.level);

      // 大雨天扑救后脱手形成角球的概率略微提升（28% -> 38%），并叠加造角球倍率与 V6 远射扑出转角球钩子
      const baseCornerProb = clamp((this.state.weather === 'rain' ? 0.38 : 0.28) * shootEffMods.cornerRateMul, 0.12, 0.85);
      const cornerProb = Math.max(baseCornerProb, this.v6ForcedCornerProb[shootTeam] ?? 0);
      if (Math.random() < cornerProb) {
        this.state.stats[shootTeam].corners++;
        this.dispatchHook(shootTeam, 'onCorner');
        const cornerX = crossedLeft ? 1 : PITCH.LENGTH - 1;
        const cornerY = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        const cc = this.commentary.formatCorner(shootTeam, this.state.minute);
        this.pushEvent('corner', shootTeam, '', '', { x: cornerX, y: cornerY }, cc.text, undefined, cc.level);
        this.setDeadBall(shootTeam, 'corner', { x: cornerX, y: cornerY }, 5);
      } else if (gk) {
        this.giveBallTo(gk);
      }
    }
  }

  private handleLooseBall(): void {
    const b = this.state.ball;
    if (this.checkOutOfBounds()) return;

    const nearest = this.state.players
      .filter(p => !p.redCard && p.stunTicks === 0)
      .sort((a, b2) => dist2D(a.pos, b.pos) - dist2D(b2.pos, b.pos))[0];

    if (nearest && dist2D(nearest.pos, b.pos) < 1.65 && b.pos.z < 2.0) {
      this.giveBallTo(nearest);
    }
  }

  private checkOutOfBounds(): boolean {
    const b = this.state.ball;
    const oppTeam: TeamSide = b.lastTouchTeam === 'home' ? 'away' : 'home';

    if (b.pos.y <= 0.4 || b.pos.y >= PITCH.WIDTH - 0.4) {
      const y = b.pos.y <= 0.4 ? 1 : PITCH.WIDTH - 1;
      this.setDeadBall(oppTeam, 'throw', { x: clamp(b.pos.x, 2, PITCH.LENGTH - 2), y }, 4);
      return true;
    }

    if (b.pos.x <= 0.4 || b.pos.x >= PITCH.LENGTH - 0.4) {
      // 简单按最后触球方区分角球或球门球
      const homeDefendsLeft = this.state.homeAttackDir === 1;
      const defendingAtEnd: TeamSide =
        (b.pos.x <= 0.4 && homeDefendsLeft) || (b.pos.x >= PITCH.LENGTH - 0.4 && !homeDefendsLeft)
          ? 'home'
          : 'away';
      const attackingAtEnd: TeamSide = defendingAtEnd === 'home' ? 'away' : 'home';

      if (b.lastTouchTeam === defendingAtEnd) {
        this.state.stats[attackingAtEnd].corners++;
        this.dispatchHook(attackingAtEnd, 'onCorner');
        const cx = b.pos.x <= 0.4 ? 1 : PITCH.LENGTH - 1;
        const cy = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        this.setDeadBall(attackingAtEnd, 'corner', { x: cx, y: cy }, 5);
      } else {
        const gx = b.pos.x <= 0.4 ? 5.5 : PITCH.LENGTH - 5.5;
        this.setDeadBall(defendingAtEnd, 'goalkick', { x: gx, y: PITCH.GOAL_Y }, 5);
      }
      return true;
    }
    return false;
  }

  private handleFoul(fouler: PlayerState, victim: PlayerState): void {
    this.state.stats[fouler.team].fouls++;
    const fc = this.commentary.formatFoul(fouler.team, fouler.name, victim.name, this.state.minute);
    this.pushEvent('foul', fouler.team, fouler.id, fouler.name, victim.pos, fc.text, undefined, fc.level);

    // 赛中轻度碰撞伤病事件（低体能时概率略升，每场上限2次）
    const injProb = victim.fitness < 60 ? 0.075 : 0.045;
    if (victim.role !== 'GK' && !victim.strainWarning && this.inMatchInjuriesThisMatch < 2 && Math.random() < injProb) {
      victim.strainWarning = true;
      victim.fitness = Math.max(28, victim.fitness - 10);
      victim.stunTicks = 14;
      this.inMatchInjuriesThisMatch++;
      this.pushEvent(
        'injury',
        victim.team,
        victim.id,
        victim.name,
        victim.pos,
        `【队医进场】${victim.name} 在拼抢中腿部轻度挫伤/拉伤，建议考虑换人保护！`,
        undefined,
        'important'
      );
    }

    // 黄牌/红牌判定（支持 V6 preventPenaltyOrRedOnce 免疫一次两黄变红）
    if (Math.random() < 0.22) {
      if (fouler.yellowCards >= 1 && !this.v6PreventPenRedUsed[fouler.team] && this.hasImmunity(fouler.team, 'preventPenaltyOrRedOnce')) {
        this.v6PreventPenRedUsed[fouler.team] = true;
        this.pushEvent('commentary', fouler.team, fouler.id, fouler.name, fouler.pos, `【钢铁纪律】${fouler.name} 冷静收脚逃过第二张黄牌！`, undefined, 'important');
      } else {
        fouler.yellowCards++;
        this.state.stats[fouler.team].yellowCards++;
        const yc = this.commentary.formatYellow(fouler.team, fouler.name, this.state.minute);
        this.pushEvent('yellow_card', fouler.team, fouler.id, fouler.name, fouler.pos, yc.text, undefined, yc.level);
        if (fouler.yellowCards >= 2) {
          fouler.redCard = true;
          this.state.stats[fouler.team].redCards++;
          const rc = this.commentary.formatRed(fouler.team, fouler.name, true, this.state.minute);
          this.pushEvent('red_card', fouler.team, fouler.id, fouler.name, fouler.pos, rc.text, undefined, rc.level);
        }
      }
    }

    // 检查是否禁区内犯规 -> 点球（支持 V6 preventPenaltyOrRedOnce 免疫一次点球改判禁区外任意球）
    const victimDir = this.getAttackDir(victim.team);
    const victimRelX = toRelativeX(victim.pos.x, victimDir);
    const inPenaltyBox =
      victimRelX >= PITCH.LENGTH - PITCH.PENALTY_BOX_DEPTH &&
      Math.abs(victim.pos.y - PITCH.GOAL_Y) <= PITCH.PENALTY_BOX_HALF_W;

    if (inPenaltyBox) {
      if (!this.v6PreventPenRedUsed[fouler.team] && this.hasImmunity(fouler.team, 'preventPenaltyOrRedOnce')) {
        this.v6PreventPenRedUsed[fouler.team] = true;
        this.pushEvent('commentary', fouler.team, fouler.id, fouler.name, victim.pos, `【钢铁纪律】VAR 介入！犯规发生在禁区线外，化险为夷改判任意球！`, undefined, 'important');
        const outX = victimDir === 1 ? PITCH.LENGTH - PITCH.PENALTY_BOX_DEPTH - 1.5 : PITCH.PENALTY_BOX_DEPTH + 1.5;
        this.setDeadBall(victim.team, 'freekick', { x: outX, y: victim.pos.y }, 5);
      } else {
        this.pushEvent('commentary', victim.team, victim.id, victim.name, victim.pos, `【点球判罚】禁区内放倒 ${victim.name}，主裁判果断指向点球点！`, undefined, 'important');
        this.setDeadBall(victim.team, 'penalty', victim.pos, 6);
      }
    } else {
      this.setDeadBall(victim.team, 'freekick', victim.pos, 5);
    }
  }

  private setDeadBall(
    team: TeamSide,
    type: BallState['restartType'],
    pos: Vec2,
    delayTicks: number
  ): void {
    this.clearHolder();
    const b = this.state.ball;
    b.mode = 'dead';
    b.restartTeam = team;
    b.restartType = type;
    b.restartPos = {
      x: clamp(pos.x, 1.5, PITCH.LENGTH - 1.5),
      y: clamp(pos.y, 1.5, PITCH.WIDTH - 1.5),
    };
    b.pos = { x: b.restartPos.x, y: b.restartPos.y, z: 0 };
    b.vel = { x: 0, y: 0, z: 0 };
    b.deadTimer = delayTicks;
  }

  private tryRevealHiddenTrait(player: PlayerState, expectedTrait: string): void {
    if (player.hiddenTrait !== expectedTrait) return;
    player.hiddenTrait = undefined;
    if (!player.traits.includes(expectedTrait)) {
      player.traits.push(expectedTrait);
    }
    this.state.unlockedHiddenTraits.push({
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      trait: expectedTrait,
    });
    this.pushEvent(
      'commentary',
      player.team,
      player.id,
      player.name,
      player.pos,
      `【隐藏特质觉醒】${player.name} 触发解锁【${expectedTrait}】！`,
      undefined,
      'important'
    );
  }

  private expireCommandBuffs(): void {
    const s = this.state;
    for (let i = s.activeBuffs.length - 1; i >= 0; i--) {
      const b = s.activeBuffs[i];
      const clampAttr = (v: number) => Math.max(25, Math.min(this.teamAttrCap[b.team], v));
      if (s.minute >= b.endMinute) {
        const c = b.effect;
        const targetLine = c.targetLine ?? 'ALL';
        for (const p of s.players) {
          if (p.team !== b.team || p.redCard) continue;
          const matchLine = targetLine === 'ALL' || this.getPlayerLine(p.role) === targetLine;
          if (matchLine) {
            if (c.passingDelta) p.attributes.passing = clampAttr(p.attributes.passing - c.passingDelta);
            if (c.shootingDelta) p.attributes.shooting = clampAttr(p.attributes.shooting - c.shootingDelta);
            if (c.defendingDelta) p.attributes.defending = clampAttr(p.attributes.defending - c.defendingDelta);
            if (c.paceDelta) p.attributes.pace = clampAttr(p.attributes.pace - c.paceDelta);
            if (c.composureDelta) p.attributes.composure = clampAttr(p.attributes.composure - c.composureDelta);
            if (c.goalkeepingDelta && p.role === 'GK') {
              p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping - c.goalkeepingDelta);
            }
          }
          if (c.penaltyAllDefDelta) {
            p.attributes.defending = clampAttr(p.attributes.defending - c.penaltyAllDefDelta);
          }
          if (c.affix?.allPacePenalty) {
            p.attributes.pace = clampAttr(p.attributes.pace - c.affix.allPacePenalty);
          }
          if (c.affix?.defPacePenalty && this.getPlayerLine(p.role) === 'DEF') {
            p.attributes.pace = clampAttr(p.attributes.pace - c.affix.defPacePenalty);
          }
          const endFitPen = (c.endFitnessPenalty ?? 0) + (c.affix?.endFitnessPenalty ?? 0);
          if (endFitPen < 0) {
            p.fitness = Math.max(20, p.fitness + endFitPen);
          }
        }
        if (c.oppDebuff?.oppComposureDelta) {
          for (const op of s.players) {
            if (op.team !== b.team && !op.redCard) {
              op.attributes.composure = clampAttr(op.attributes.composure - c.oppDebuff.oppComposureDelta);
            }
          }
        }
        if (b.team === this.userTeamSide && b.startStats && !c.id.startsWith('sk_')) {
          const curSt = s.stats[b.team];
          const dShots = curSt.shots - b.startStats.shots;
          const dXG = Math.max(0, curSt.xG - b.startStats.xG);
          const dGoals = curSt.goals - b.startStats.goals;
          const dTackles = curSt.tackles - b.startStats.tackles;
          const msg = dGoals > 0
            ? `【${b.name}】战果回执：制造 ${dShots} 射门 (+${dXG.toFixed(2)} xG) 并轰入 ${dGoals} 球！`
            : dShots > 0
            ? `【${b.name}】战果回执：创造 ${dShots} 次射门 (+${dXG.toFixed(2)} xG)`
            : dTackles > 0
            ? `【${b.name}】战果回执：防线贡献 ${dTackles} 次关键抢断`
            : `【${b.name}】结束：对手防守密集，本波暂未换来射门（可切边路/远射卡）`;
          this.pushCoachReward({ bannerText: msg, tone: dGoals > 0 ? '#4ADE80' : dShots > 0 ? '#FACC15' : '#94A3B8' });
          this.pushEvent('commentary', b.team, '', '', { x: PITCH.HALF_X, y: PITCH.HALF_Y }, msg, undefined, dShots > 0 || dGoals > 0 ? 'important' : 'normal');
        }
        const curConcededEnd = b.team === 'home' ? s.awayScore : s.homeScore;
        const zeroConceded = b.startConceded !== undefined && curConcededEnd === b.startConceded;
        s.activeBuffs.splice(i, 1);
        if (!c.id.startsWith('sk_') && !c.id.startsWith('v6_mini_')) {
          this.dispatchHook(b.team, 'onDirectiveEnd', { zeroConceded, expiringBuff: b });
        }
      }
    }
  }

  private updateAiAutoSubstitutions(): void {
    const s = this.state;
    const lineOf = (r: PlayerState['role']) =>
      r === 'GK' ? 'GK' : ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(r) ? 'DEF' : ['ST', 'LW', 'RW'].includes(r) ? 'ATT' : 'MID';

    for (const side of ['home', 'away'] as TeamSide[]) {
      if (side === this.userTeamSide) continue;
      const used = side === 'home' ? s.homeSubsUsed : s.awaySubsUsed;
      if (used >= 4) continue;
      const subs = side === 'home' ? s.homeSubs : s.awaySubs;
      if (subs.length === 0) continue;

      // 在 60' / 68' / 76' / 82' 窗口期自然触发换人（伤病预警优先）
      const targetSubCount = s.minute >= 80 ? 3 : s.minute >= 70 ? 2 : 1;
      const hasStrain = s.players.some(p => p.team === side && !p.redCard && p.role !== 'GK' && p.strainWarning);
      if (!hasStrain && used >= targetSubCount) continue;

      const outPlayer = s.players
        .filter(p => p.team === side && !p.redCard && p.role !== 'GK')
        .filter(p => p.strainWarning || p.fitness < 74 || (s.minute >= 78 && p.fitness < 82))
        .sort((a, b) => (a.strainWarning ? -20 : 0) + a.fitness - ((b.strainWarning ? -20 : 0) + b.fitness))[0];
      if (!outPlayer) continue;

      const outLine = lineOf(outPlayer.role);
      const bestSub = [...subs]
        .filter(sub => sub.role !== 'GK' && (sub.fitness ?? 100) >= 75)
        .sort((a, b) => {
          const score = (x: (typeof subs)[number]) =>
            (lineOf(x.role) === outLine ? 30 : 0) +
            (x.fitness ?? 100) * 0.4 +
            (x.attributes.passing + x.attributes.shooting + x.attributes.defending) * 0.15;
          return score(b) - score(a);
        })[0];
      if (bestSub) {
        this.substitute(side, outPlayer.id, bestSub.id);
      }
    }
  }

  private drainFitness(): void {
    const ROLE_WORKLOAD: Record<PlayerState['role'], number> = {
      GK: 0.10,
      CB: 0.40,
      ST: 0.45,
      CDM: 0.47,
      CAM: 0.48,
      LB: 0.46,
      RB: 0.46,
      CM: 0.50,
      LW: 0.46,
      RW: 0.46,
      LM: 0.47,
      RM: 0.47,
      LWB: 0.50,
      RWB: 0.50,
    };

    for (const p of this.state.players) {
      if (p.redCard) continue;
      const style = p.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
      const formation = p.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
      const defSys = getDefenseSystem(formation);
      const mods = this.getEffectiveMods(p.team);
      const drainMul = clamp(mods.staminaDrainMul ?? 1.0, 0.65, 1.45);

      const rawPress = TACTICAL_PRESETS[style].pressIntensity;
      // 高位逼抢主要压榨中前场与边路；中卫线以整体前压为主，避免全队同速率掉血
      const styleDrain =
        style === 'gegenpress'
          ? (p.role === 'CB' ? 1.06 : p.role === 'GK' ? 1.0 : 1.18)
          : style === 'balanced'
          ? (p.role === 'GK' ? 1.0 : 0.96)
          : style === 'counter'
          ? (p.role === 'GK' ? 1.0 : 0.98)
          : (p.role === 'GK' ? 1.0 : 0.82 + rawPress * 0.25);

      // 阵型负荷系数：三后卫翼卫与边卫跑动更重，五后卫横向补位耗体同步，双中场比三中场更累
      let formFactor = 1.0;
      if (defSys === '3-back' && (p.role === 'LWB' || p.role === 'RWB' || p.role === 'CB')) {
        formFactor = 1.10;
      } else if (defSys === '5-back') {
        if (p.role === 'CB') formFactor = 1.03;
        else if (p.role === 'LWB' || p.role === 'RWB') formFactor = 1.10;
      }
      if ((formation === '4-4-2' || formation === '4-2-2-2') && (p.role === 'CM' || p.role === 'CDM')) {
        formFactor *= 1.08;
      } else if ((formation === '4-2-3-1' || formation === '4-1-4-1' || formation === '3-5-2') && (p.role === 'CM' || p.role === 'CDM')) {
        formFactor *= 0.94;
      }

      const staminaResist = 1.25 - (p.attributes.stamina / 99) * 0.5;
      const lungResist = p.goldTraits?.includes('铁肺覆盖') ? 0.40 : p.traits?.includes('铁肺覆盖') ? 0.60 : 1.0;
      let traitResist = lungResist;
      if (p.traits?.includes('体能充沛')) traitResist *= 0.70;
      const roleFactor = ROLE_WORKLOAD[p.role] ?? 0.48;

      const weatherDrain = this.state.weather === 'heat' && this.state.minute >= 60 ? 1.25 : 1.0;
      const strainDrain = p.strainWarning ? 1.28 : 1.0;
      const oppSide: TeamSide = p.team === 'home' ? 'away' : 'home';
      const oppDrainExtra = this.getEffectiveMods(oppSide).oppStaminaDrainPerMin ?? 0;
      p.fitness = Math.max(
        20,
        p.fitness - roleFactor * styleDrain * formFactor * staminaResist * traitResist * drainMul * weatherDrain * strainDrain - oppDrainExtra
      );
      if (
        p.role !== 'GK' &&
        this.state.minute >= 68 &&
        p.fitness < 52 &&
        !p.strainWarning &&
        this.inMatchInjuriesThisMatch < 2 &&
        Math.random() < 0.024
      ) {
        p.strainWarning = true;
        p.fitness = Math.max(26, p.fitness - 6);
        this.inMatchInjuriesThisMatch++;
        this.pushEvent(
          'injury',
          p.team,
          p.id,
          p.name,
          p.pos,
          `【肌肉紧绷】${p.name} 体能见底出现抽筋拉伤征兆，冲刺与射门受限！`,
          undefined,
          'important'
        );
      }
    }
    // V6 分钟级控球压迫钩子 (onPossessionTick)
    const totPoss = this.state.stats.home.possessionTicks + this.state.stats.away.possessionTicks || 1;
    const homePossPct = Math.round((this.state.stats.home.possessionTicks / totPoss) * 100);
    this.dispatchHook('home', 'onPossessionTick', { possessionPct: homePossPct });
    this.dispatchHook('away', 'onPossessionTick', { possessionPct: 100 - homePossPct });
  }

  private finalizeStats(): void {
    // 跑动距离前 2 名且携带“体能充沛”隐藏词条的球员触发觉醒
    const topRunners = [...this.state.players]
      .filter(p => !p.redCard && p.role !== 'GK')
      .sort((a, b) => b.matchStats.distanceM - a.matchStats.distanceM)
      .slice(0, 2);
    for (const r of topRunners) {
      this.tryRevealHiddenTrait(r, '体能充沛');
    }
    for (const p of this.state.players) {
      if (p.redCard) continue;
      if (p.matchStats.tackles + p.matchStats.interceptions >= 5) {
        this.tryRevealHiddenTrait(p, '禁区清道夫');
      }
      if (p.matchStats.passesSuccess >= 25) {
        this.tryRevealHiddenTrait(p, '传球机器');
      }
      if (!p.subbedIn && this.state.minute >= 85 && (p.matchStats.tackles + p.matchStats.interceptions >= 2 || p.matchStats.saves >= 2 || p.fitness <= 82)) {
        this.tryRevealHiddenTrait(p, '铁血硬汉');
      }
    }

    const s = this.state.stats;
    const totalPoss = s.home.possessionTicks + s.away.possessionTicks || 1;
    s.home.possessionPct = Math.round((s.home.possessionTicks / totalPoss) * 100);
    s.away.possessionPct = 100 - s.home.possessionPct;

    for (const side of ['home', 'away'] as TeamSide[]) {
      const ts = s[side];
      ts.passAccuracy = ts.passes > 0 ? Math.round((ts.passesSuccess / ts.passes) * 100) : 0;
      ts.xG = Math.round(ts.xG * 100) / 100;
      const totalDistM = this.state.players
        .filter(p => p.team === side)
        .reduce((acc, p) => acc + p.matchStats.distanceM, 0);
      ts.distanceKm = Math.round((totalDistM / 1000) * 10) / 10;
    }
  }

  private pushEvent(
    type: MatchEventType,
    team: TeamSide,
    playerId: string,
    playerName: string,
    pos: Vec2,
    text: string,
    xG?: number,
    level?: CommentaryLevel,
    narrativeTag?: NarrativeTag
  ): void {
    this.eventSeq++;
    this.state.events.push({
      id: `evt_${this.eventSeq}`,
      tick: this.state.tick,
      minute: this.state.minute,
      type,
      team,
      playerId,
      playerName,
      pos: { x: pos.x, y: pos.y },
      xG,
      text,
      level,
      narrativeTag,
    });
  }
}
