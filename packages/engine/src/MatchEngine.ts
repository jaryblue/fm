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
  AttackDir,
  BallState,
  CommandCardEffect,
  EquippedActiveSkill,
  FormationName,
  MatchEvent,
  MatchEventType,
  MatchState,
  PITCH,
  PlayerState,
  SIM_CONFIG,
  TACTICAL_PRESETS,
  TacticalMods,
  TacticalStyle,
  TeamMatchStats,
  TeamSetup,
  TeamSide,
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
  private isKickoffFirst = true;
  private homeMods: TacticalMods;
  private awayMods: TacticalMods;
  private setPieceBoostTicks = 0;
  private setPieceBoostTeam: TeamSide | null = null;
  private gkCounterBoostTicks: Record<TeamSide, number> = { home: 0, away: 0 };
  private tikiTakaPassCount: Record<TeamSide, number> = { home: 0, away: 0 };
  private userEquippedSkills: EquippedActiveSkill[] = [];
  private userTeamSide: TeamSide | null = null;
  private userFamAvg = 50;
  private userChemAvg = 30;

  private hasActiveMechanic(team: TeamSide, mech: NonNullable<CommandCardEffect['mechanic']>): boolean {
    return this.state.activeBuffs.some(b => b.team === team && b.effect.mechanic === mech);
  }

  private isTrailing(team: TeamSide): boolean {
    return team === 'home'
      ? this.state.homeScore < this.state.awayScore
      : this.state.awayScore < this.state.homeScore;
  }

  constructor(home: TeamSetup, away: TeamSetup) {
    this.stoppageTicksFirst = Math.floor(Math.random() * 60);  // 0-2 分钟
    this.stoppageTicksSecond = 30 + Math.floor(Math.random() * 90); // 1-4 分钟
    this.homeMods = home.tacticalMods ? { ...home.tacticalMods } : {};
    this.awayMods = away.tacticalMods ? { ...away.tacticalMods } : {};
    if (home.equippedSkills && home.equippedSkills.length > 0) {
      this.userTeamSide = 'home';
      this.userEquippedSkills = [...home.equippedSkills];
      this.userFamAvg = home.teamFamiliarityAvg ?? 50;
      this.userChemAvg = home.teamChemistryAvg ?? 30;
    } else if (away.equippedSkills && away.equippedSkills.length > 0) {
      this.userTeamSide = 'away';
      this.userEquippedSkills = [...away.equippedSkills];
      this.userFamAvg = away.teamFamiliarityAvg ?? 50;
      this.userChemAvg = away.teamChemistryAvg ?? 30;
    }
    this.commentary = new CommentaryEngine(home.name, away.name);
    this.state = this.initState(home, away);
    this.setupKickoff('home');
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
      activeSkillPrompt: null,
      skillUses: {},
      skillCooldowns: {},
    };
  }

  public getState(): MatchState {
    return this.state;
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
  public applyCommandCard(team: TeamSide, card: CommandCardEffect): { ok: boolean; energyRefund?: number } {
    const s = this.state;
    const clampAttr = (v: number) => Math.max(25, Math.min(99, v));
    const targetLine = card.targetLine ?? 'ALL';
    const hadActiveBuff = s.activeBuffs.some(b => b.team === team);
    let energyRefund = 0;

    for (const p of s.players) {
      if (p.redCard) continue;
      if (p.team === team) {
        const matchLine = targetLine === 'ALL' || this.getPlayerLine(p.role) === targetLine;
        if (matchLine) {
          if (card.fitnessInstantDelta) {
            p.fitness = Math.max(20, Math.min(100, p.fitness + card.fitnessInstantDelta));
          }
          if (card.passingDelta) p.attributes.passing = clampAttr(p.attributes.passing + card.passingDelta);
          if (card.shootingDelta) p.attributes.shooting = clampAttr(p.attributes.shooting + card.shootingDelta);
          if (card.defendingDelta) p.attributes.defending = clampAttr(p.attributes.defending + card.defendingDelta);
          if (card.paceDelta) p.attributes.pace = clampAttr(p.attributes.pace + card.paceDelta);
          if (card.composureDelta) p.attributes.composure = clampAttr(p.attributes.composure + card.composureDelta);
          if (card.goalkeepingDelta && p.role === 'GK') {
            p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + card.goalkeepingDelta);
          }
        }
        if (card.penaltyFitnessDelta) {
          p.fitness = Math.max(20, Math.min(100, p.fitness + card.penaltyFitnessDelta));
        }
        if (card.penaltyAllDefDelta) {
          p.attributes.defending = clampAttr(p.attributes.defending + card.penaltyAllDefDelta);
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
      } else if (card.chainEffect?.type === 'fitness_leech') {
        p.fitness = Math.max(20, p.fitness - 8);
      }
    }
    if (card.chainEffect?.type === 'energy_refund') {
      energyRefund = 1;
    }
    if (card.forceStyle) {
      this.setTactics(team, undefined, card.forceStyle);
    }
    const endMinute = Math.min(95, s.minute + card.durationMinutes);
    s.activeBuffs.push({ team, name: card.name, endMinute, effect: card });
    const chainTag = card.chainEffect ? ` · 触发连锁【${card.chainEffect.label}】` : '';
    this.pushEvent(
      'commentary',
      team,
      '',
      '',
      { x: PITCH.HALF_X, y: PITCH.HALF_Y },
      `🃏 教练场边指令！【${card.name}】生效（持续至 ${endMinute}'）${chainTag}`,
      undefined,
      'important'
    );
    return { ok: true, energyRefund };
  }

  /**
   * 比赛日临场换人（每队最多 5 次）
   */
  public substitute(team: TeamSide, outPlayerId: string, inSubId: string): { ok: boolean; reason?: string } {
    const s = this.state;
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
    return { ok: true };
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

    s.tick++;
    s.minute = Math.min(95, Math.floor(s.tick / SIM_CONFIG.TICKS_PER_MINUTE));
    if (this.setPieceBoostTicks > 0) this.setPieceBoostTicks--;
    if (this.gkCounterBoostTicks.home > 0) this.gkCounterBoostTicks.home--;
    if (this.gkCounterBoostTicks.away > 0) this.gkCounterBoostTicks.away--;

    // 每分钟体能消耗、闷战解说检测与指挥卡过期回收
    if (s.tick % SIM_CONFIG.TICKS_PER_MINUTE === 0) {
      this.drainFitness();
      this.expireCommandBuffs();
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
      this.homeMods,
      this.awayMods
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

    // 5. 主动技能触发器与过期检测
    if (s.activeSkillPrompt && s.tick >= s.activeSkillPrompt.expiresTick) {
      s.activeSkillPrompt = null;
    }
    if (!s.activeSkillPrompt && this.userTeamSide && this.userEquippedSkills.length > 0 && s.tick % 10 === 0) {
      this.evaluateActiveSkillTriggers(this.userTeamSide);
    }

    return s;
  }

  private evaluateActiveSkillTriggers(team: TeamSide): void {
    const s = this.state;
    const b = s.ball;
    if (b.mode === 'dead') return;
    const hasCardBoost = s.activeBuffs.some(bf => bf.team === team && !bf.effect.id.startsWith('sk_'));
    const thresholdDrop = hasCardBoost ? 20 : 0;
    const dir = this.getAttackDir(team);
    const relX = toRelativeX(b.pos.x, dir);
    const oppRelX = 105 - relX;
    const teamHasBall = b.lastTouchTeam === team;

    for (const sk of this.userEquippedSkills) {
      const uses = (s.skillUses?.[sk.id] ?? 0);
      if (uses >= sk.maxPerMatch) continue;
      const cdEnd = (s.skillCooldowns?.[sk.id] ?? 0);
      if (s.minute < cdEnd) continue;
      if (this.userFamAvg < Math.max(10, sk.minFamiliarity - thresholdDrop)) continue;
      if (this.userChemAvg < Math.max(10, sk.minChemistry - thresholdDrop)) continue;

      let matched = false;
      switch (sk.situation) {
        case 'opponent_through_ball':
          matched = !teamHasBall && b.mode === 'pass' && b.passType === 'through';
          break;
        case 'box_danger':
          matched = !teamHasBall && oppRelX > 76;
          break;
        case 'attacking_final_third':
          matched = teamHasBall && relX > 66;
          break;
        case 'wing_overload':
          matched = teamHasBall && (b.pos.y < 16 || b.pos.y > 52);
          break;
        case 'counter_opportunity':
          matched = teamHasBall && relX < 52 && b.mode === 'held';
          break;
        case 'midfield_press':
          matched = !teamHasBall && oppRelX >= 34 && oppRelX <= 74;
          break;
        case 'trailing_late':
          matched = s.minute >= 70 && (this.isTrailing(team) || s.homeScore === s.awayScore);
          break;
        case 'any_possession':
          matched = teamHasBall && b.mode === 'held';
          break;
      }

      if (matched) {
        s.activeSkillPrompt = {
          skillId: sk.id,
          name: sk.name,
          situationLabel: sk.situationLabel,
          powerLabel: hasCardBoost ? `${sk.powerLabel} (卡牌共振+35%威力)` : sk.powerLabel,
          expiresTick: s.tick + 12,
          isCardBoosted: hasCardBoost,
        };
        break;
      }
    }
  }

  public triggerActiveSkill(team: TeamSide, skillId: string): { ok: boolean; boosted?: boolean } {
    const s = this.state;
    const sk = this.userEquippedSkills.find(x => x.id === skillId);
    if (!sk) return { ok: false };
    const uses = s.skillUses?.[skillId] ?? 0;
    if (uses >= sk.maxPerMatch) return { ok: false };
    const cdEnd = s.skillCooldowns?.[skillId] ?? 0;
    if (s.minute < cdEnd) return { ok: false };

    const hasCardBoost = s.activeBuffs.some(bf => bf.team === team && !bf.effect.id.startsWith('sk_'));
    const mul = hasCardBoost ? 1.35 : 1.0;
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
    s.skillCooldowns = s.skillCooldowns ?? {};
    const effCd = hasCardBoost ? Math.round(sk.cooldownMinutes * 0.6) : sk.cooldownMinutes;
    s.skillCooldowns[skillId] = s.minute + effCd;
    s.activeSkillPrompt = null;
    return { ok: true, boosted: hasCardBoost };
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
        this.executeShot(taker, 0.76);
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
        const styleTackleBonus = oppStyle === 'gegenpress' ? 0.08 : 0;
        const blitzBonus = this.hasActiveMechanic(oppTeam, 'high_press_blitz') ? 0.12 : 0;
        const traitFoulMul = def.traits?.includes('精准铲断') ? (def.goldTraits?.includes('精准铲断') ? 0.45 : 0.65) : 1.0;
        const tackleWinProb = clamp(0.45 + ((defPower - attPower) / 100) * 0.55 + traitTackleBonus + styleTackleBonus + blitzBonus, 0.15, 0.92);

        // 约 24% 概率动作过大造成犯规
        if (Math.random() < 0.24 * pressMul * traitFoulMul) {
          this.handleFoul(def, holder);
          return;
        }

        if (Math.random() < tackleWinProb) {
          def.matchStats.tackles++;
          this.state.stats[def.team].tackles++;
          holder.stunTicks = 5;
          this.giveBallTo(def);
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
    const mods = holder.team === 'home' ? this.homeMods : this.awayMods;
    const dir = this.getAttackDir(holder.team);
    const action = decideOnBall(holder, dir, style, this.state.players, b, mods);

    const interval = Math.max(3, Math.round(SIM_CONFIG.DECISION_INTERVAL / TACTICAL_PRESETS[style].tempo));
    holder.decisionCooldown = interval;

    if (action.type === 'shoot') {
      this.executeShot(holder, action.xG);
    } else if (action.type === 'pass') {
      this.executePass(holder, action.target, action.passType);
    } else {
      holder.targetPos = action.targetPos;
    }
  }

  private executePass(
    passer: PlayerState,
    target: PlayerState,
    passType: 'short' | 'through' | 'cross' | 'long'
  ): void {
    passer.hasBall = false;
    passer.matchStats.passes++;
    this.state.stats[passer.team].passes++;
    this.lastPassTimestamp = this.state.tick;

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

    if (targetIsOffside && Math.random() < 0.78) {
      const oppTeam: TeamSide = passer.team === 'home' ? 'away' : 'home';
      this.state.stats[passer.team].offsides++;
      const oc = this.commentary.formatOffside(passer.team, target.name, this.state.minute);
      this.pushEvent('offside', passer.team, target.id, target.name, target.pos, oc.text, undefined, oc.level);
      if (this.hasActiveMechanic(oppTeam, 'offside_trap')) {
        this.pushEvent('commentary', oppTeam, '', '', target.pos, `🎯 造越位陷阱成功！返还 1 点战术能量`, undefined, 'important', 'MOMENTUM');
      }
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
  }

  private executeShot(shooter: PlayerState, xG: number): void {
    const dir = this.getAttackDir(shooter.team);
    const goalX = dir === 1 ? PITCH.LENGTH : 0;
    const dist = dist2D(shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
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
    const hasBloodFrenzy = this.hasActiveMechanic(shooter.team, 'blood_frenzy') && this.isTrailing(shooter.team);
    if (hasBloodFrenzy) {
      xG = Math.min(0.68, xG * 1.10);
    }
    shooter.hasBall = false;
    shooter.matchStats.shots++;
    this.state.stats[shooter.team].shots++;
    this.state.stats[shooter.team].xG += xG;

    // 决定是否射正门框范围内（受 shooting 与距离影响，五大联赛平均射正率 ~34%-38%）
    const fatiguePenalty = shooter.fitness < 55 ? ((55 - shooter.fitness) / 35) * 0.10 : 0;
    const effectiveShoot = Math.min(99, shooter.attributes.shooting + (hasBloodFrenzy ? 8 : 0));
    const onTargetProb = clamp(
      0.20 + (effectiveShoot / 99) * 0.30 - (dist / 35) * 0.14 - fatiguePenalty + (hasLongShotCannon ? 0.14 : 0),
      0.14,
      hasLongShotCannon ? 0.72 : 0.62
    );
    const onTarget = Math.random() < onTargetProb;
    if (onTarget) {
      this.state.stats[shooter.team].shotsOnTarget++;
    }

    const targetY = onTarget
      ? PITCH.GOAL_Y + (Math.random() - 0.5) * (PITCH.GOAL_HALF_WIDTH * 1.8)
      : PITCH.GOAL_Y + (Math.random() < 0.5 ? -1 : 1) * (PITCH.GOAL_HALF_WIDTH + 1.2 + Math.random() * 3.0);
    const targetZ = onTarget ? 0.3 + Math.random() * 1.8 : 0.6 + Math.random() * 2.8;

    this.lastShotType = dist >= 20 ? 'long_range' : this.state.ball.pos.z > 0.9 ? 'header' : 'normal';
    const sc = this.commentary.formatShot(shooter.team, shooter.name, xG, this.state.minute);
    this.pushEvent('shot', shooter.team, shooter.id, shooter.name, shooter.pos, sc.text, xG, sc.level);
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
        const d = dist2D(p.pos, b.pos);
        if (d < 2.2) {
          const interceptChance = clamp(0.52 + (p.attributes.defending / 99) * 0.40, 0.42, 0.88);
          if (Math.random() < interceptChance) {
            p.matchStats.interceptions++;
            this.state.stats[p.team].interceptions++;
            this.giveBallTo(p);
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
        if (this.hasActiveMechanic(passer.team, 'tiki_taka_flow')) {
          this.tikiTakaPassCount[passer.team]++;
          if (this.tikiTakaPassCount[passer.team] >= 6) {
            this.tikiTakaPassCount[passer.team] = 0;
            for (const tm of this.state.players) {
              if (tm.team === passer.team && !tm.redCard) {
                tm.fitness = Math.min(100, tm.fitness + 2);
              }
            }
          }
        }
        if (passer.role === 'GK' && this.hasActiveMechanic(passer.team, 'gk_counter_launch')) {
          this.gkCounterBoostTicks[passer.team] = 50;
        }
      }
      this.giveBallTo(target);

      // 如果是高质量边路传中到禁区，抢点前锋有较高概率直接头球/垫射
      const tStyle = target.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
      const tMods = target.team === 'home' ? this.homeMods : this.awayMods;
      const baseCrossFinish = tStyle === 'wing_play' || (tMods.crossBias ?? 0) > 0.03 ? 0.66 : 0.50;
      const crossFinishProb = clamp(
        baseCrossFinish + (this.hasActiveMechanic(target.team, 'wing_overload') ? 0.20 : 0),
        0.30,
        0.92
      );
      if (b.passType === 'cross' && target.role !== 'GK' && Math.random() < crossFinishProb) {
        const dir = this.getAttackDir(target.team);
        const relX = toRelativeX(target.pos.x, dir);
        if (relX > 80) {
          this.executeShot(target, 0.17);
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
    const blockDist = (defStyle === 'park_bus' || isFiveBack ? 1.60 : 1.15) + (hasIronWall ? 0.25 : 0);
    const blockProb = (defStyle === 'park_bus' || isFiveBack ? 0.33 : 0.24) + (hasIronWall ? 0.18 : 0);
    if (b.pos.z < 1.9) {
      for (const p of this.state.players) {
        if (p.team !== defTeam || p.redCard || p.role === 'GK') continue;
        if (dist2D(p.pos, b.pos) < blockDist && Math.random() < blockProb) {
          b.vel.x = -b.vel.x * 0.35 + (Math.random() - 0.5) * 4;
          b.vel.y = (Math.random() - 0.5) * 8;
          b.mode = 'loose';
          b.lastTouchTeam = defTeam;
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
      if (Math.random() < 0.30) {
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

    // 3. 门将扑救判定（校准：射正转化率使场均总进球稳定在 2.5 - 2.8）
    const gk = this.state.players.find(p => p.team === defTeam && p.role === 'GK');
    const gkAttr = gk ? gk.attributes.goalkeeping : 65;
    const frenzyShootBonus = shooter && this.hasActiveMechanic(shooter.team, 'blood_frenzy') && this.isTrailing(shooter.team) ? 8 : 0;
    const shooterAttr = shooter ? (Math.min(99, shooter.attributes.shooting + frenzyShootBonus) * 0.65 + shooter.attributes.composure * 0.35) : 70;
    const gkGoldMul = gk?.goldTraits?.includes('门线神扑') ? 2 : 1;
    const gkTraitBonus = gk?.traits?.includes('门线神扑') ? 0.07 * gkGoldMul : 0;
    const gkSaveBonus = ((gkAttr - 65) / 100) * 0.22 + gkTraitBonus;
    const attrDiffBonus = ((shooterAttr - gkAttr) / 100) * 0.18;
    const goalProb = clamp(0.24 + b.shotXG * 0.78 + attrDiffBonus - gkSaveBonus, 0.12, 0.68);

    if (Math.random() < goalProb) {
      // 进球！
      if (shooter) shooter.matchStats.goals++;
      this.state.stats[shootTeam].goals++;
      if (shootTeam === 'home') this.state.homeScore++;
      else this.state.awayScore++;

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
      this.pushEvent('goal', shootTeam, shooter?.id || '', shooter?.name || '', b.pos, gc.text, b.shotXG, gc.level, gc.narrativeTag);

      // 触发式隐藏词条觉醒检测
      if (shooter) {
        const trailingBefore =
          (shootTeam === 'home' && this.state.homeScore - 1 < this.state.awayScore) ||
          (shootTeam === 'away' && this.state.awayScore - 1 < this.state.homeScore);
        if (trailingBefore) this.tryRevealHiddenTrait(shooter, '逆转王');
        if (shooter.subbedIn) this.tryRevealHiddenTrait(shooter, '超级替补');
        if (this.state.minute >= 70) this.tryRevealHiddenTrait(shooter, '大赛先生');
      }

      const concedeTeam: TeamSide = shootTeam === 'home' ? 'away' : 'home';
      this.setupKickoff(concedeTeam);
    } else {
      // 门将扑救
      if (gk) gk.matchStats.saves++;
      this.state.stats[defTeam].saves++;
      const svc = this.commentary.formatSave(defTeam, gk?.name || '门将', shooter?.name || '前锋', this.state.minute);
      this.pushEvent('save', defTeam, gk?.id || '', gk?.name || '门将', b.pos, svc.text, undefined, svc.level);

      // 大雨天扑救后脱手形成角球的概率略微提升（28% -> 38%）
      const cornerProb = this.state.weather === 'rain' ? 0.38 : 0.28;
      if (Math.random() < cornerProb) {
        this.state.stats[shootTeam].corners++;
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

    // 黄牌/红牌判定（场均约 1.3–2.0 张黄牌）
    if (Math.random() < 0.22) {
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

    // 检查是否禁区内犯规 -> 点球
    const victimDir = this.getAttackDir(victim.team);
    const victimRelX = toRelativeX(victim.pos.x, victimDir);
    const inPenaltyBox =
      victimRelX >= PITCH.LENGTH - PITCH.PENALTY_BOX_DEPTH &&
      Math.abs(victim.pos.y - PITCH.GOAL_Y) <= PITCH.PENALTY_BOX_HALF_W;

    if (inPenaltyBox) {
      this.setDeadBall(victim.team, 'penalty', victim.pos, 6);
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
      `✨ 隐藏特质觉醒！${player.name} 触发解锁【${expectedTrait}】！`,
      undefined,
      'important'
    );
  }

  private expireCommandBuffs(): void {
    const s = this.state;
    const clampAttr = (v: number) => Math.max(25, Math.min(99, v));
    for (let i = s.activeBuffs.length - 1; i >= 0; i--) {
      const b = s.activeBuffs[i];
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
        }
        s.activeBuffs.splice(i, 1);
      }
    }
  }

  private drainFitness(): void {
    const ROLE_WORKLOAD: Record<PlayerState['role'], number> = {
      GK: 0.10,
      CB: 0.36,
      ST: 0.44,
      CDM: 0.48,
      CAM: 0.48,
      LB: 0.50,
      RB: 0.50,
      CM: 0.54,
      LW: 0.54,
      RW: 0.54,
      LM: 0.54,
      RM: 0.54,
      LWB: 0.60,
      RWB: 0.60,
    };

    for (const p of this.state.players) {
      if (p.redCard) continue;
      const style = p.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
      const formation = p.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
      const defSys = getDefenseSystem(formation);
      const mods = p.team === 'home' ? this.homeMods : this.awayMods;
      const drainMul = clamp(mods.staminaDrainMul ?? 1.0, 0.70, 1.0);

      const rawPress = TACTICAL_PRESETS[style].pressIntensity;
      // 高位逼抢主要压榨中前场与边路；中卫线以整体前压为主，避免全队同速率掉血
      const styleDrain =
        style === 'gegenpress'
          ? (p.role === 'CB' ? 1.12 : p.role === 'GK' ? 1.0 : 1.25)
          : (p.role === 'GK' ? 1.0 : 0.7 + rawPress * 0.3);

      // 阵型负荷系数：三后卫翼卫与边卫跑动更重，五后卫中卫更省力，双中场比三中场更累
      let formFactor = 1.0;
      if (defSys === '3-back' && (p.role === 'LWB' || p.role === 'RWB' || p.role === 'CB')) {
        formFactor = 1.10;
      } else if (defSys === '5-back') {
        if (p.role === 'CB') formFactor = 0.90;
        else if (p.role === 'LWB' || p.role === 'RWB') formFactor = 1.06;
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
      p.fitness = Math.max(
        20,
        p.fitness - roleFactor * styleDrain * formFactor * staminaResist * traitResist * drainMul * weatherDrain * strainDrain
      );
    }
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
