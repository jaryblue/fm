"use strict";
/**
 * @fm-league/engine - 纯 2D 实时足球比赛模拟引擎
 *
 * 特点：
 * - 10Hz 固定物理步长 (0.1s/tick)，30 ticks = 1 比赛分钟
 * - 支持 step() 逐帧驱动（小游戏/PC 60fps 插值渲染）与 simulateMatch() 整场快跑
 * - 零平台依赖，可直接打包至微信小游戏与 Steam
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchEngine = void 0;
const types_1 = require("./types");
const formations_1 = require("./formations");
const physics_1 = require("./physics");
const decision_1 = require("./decision");
const CommentaryEngine_1 = require("./CommentaryEngine");
function createEmptyStats() {
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
class MatchEngine {
    hasActiveMechanic(team, mech) {
        return this.state.activeBuffs.some(b => b.team === team && b.effect.mechanic === mech);
    }
    hasUserAspect(mechanicKey) {
        return this.userAspects.some(a => a.mechanicKey === mechanicKey);
    }
    getShieldCap() {
        return this.hasUserAspect('fortress_shield_start2') ? 3 : 2;
    }
    getCounterCap() {
        return this.hasUserAspect('absorb_max3_counter') ? 3 : 2;
    }
    pushCoachReward(reward) {
        this.pendingCoachRewards.push(reward);
    }
    consumeCoachRewards() {
        if (this.pendingCoachRewards.length === 0)
            return [];
        const copy = [...this.pendingCoachRewards];
        this.pendingCoachRewards.length = 0;
        return copy;
    }
    reduceEquippedCooldowns(minutes) {
        const s = this.state;
        if (!s.skillCooldowns)
            return;
        for (const k of Object.keys(s.skillCooldowns)) {
            s.skillCooldowns[k] = Math.max(s.minute, (s.skillCooldowns[k] ?? s.minute) - minutes);
        }
    }
    isTrailing(team) {
        return team === 'home'
            ? this.state.homeScore < this.state.awayScore
            : this.state.awayScore < this.state.homeScore;
    }
    constructor(home, away) {
        this.eventSeq = 0;
        this.stoppageTicksFirst = 0;
        this.stoppageTicksSecond = 0;
        this.lastPassTimestamp = -999;
        this.lastShotType = 'normal';
        this.isKickoffFirst = true;
        this.setPieceBoostTicks = 0;
        this.setPieceBoostTeam = null;
        this.gkCounterBoostTicks = { home: 0, away: 0 };
        this.tikiTakaPassCount = { home: 0, away: 0 };
        this.userEquippedSkills = [];
        this.userAspects = [];
        this.userPerkSynergies = null;
        this.userTeamSide = null;
        this.userFamAvg = 50;
        this.userChemAvg = 30;
        this.pendingCoachRewards = [];
        this.bypassOffsideTicks = { home: 0, away: 0 };
        this.guaranteeShotOnTargetTicks = { home: 0, away: 0 };
        this.oppTempoDrainTicks = { home: 0, away: 0 };
        this.aspectRefreshUsedThisMatch = false;
        this.stoppageTicksFirst = Math.floor(Math.random() * 60); // 0-2 分钟
        this.stoppageTicksSecond = 30 + Math.floor(Math.random() * 90); // 1-4 分钟
        this.homeMods = home.tacticalMods ? { ...home.tacticalMods } : {};
        this.awayMods = away.tacticalMods ? { ...away.tacticalMods } : {};
        if ((home.equippedSkills && home.equippedSkills.length > 0) || (home.activeAspects && home.activeAspects.length > 0)) {
            this.userTeamSide = 'home';
            this.userEquippedSkills = [...(home.equippedSkills ?? [])];
            this.userAspects = [...(home.activeAspects ?? [])];
            this.userPerkSynergies = home.perkSynergies ?? null;
            this.userFamAvg = home.teamFamiliarityAvg ?? 50;
            this.userChemAvg = home.teamChemistryAvg ?? 30;
        }
        else if ((away.equippedSkills && away.equippedSkills.length > 0) || (away.activeAspects && away.activeAspects.length > 0)) {
            this.userTeamSide = 'away';
            this.userEquippedSkills = [...(away.equippedSkills ?? [])];
            this.userAspects = [...(away.activeAspects ?? [])];
            this.userPerkSynergies = away.perkSynergies ?? null;
            this.userFamAvg = away.teamFamiliarityAvg ?? 50;
            this.userChemAvg = away.teamChemistryAvg ?? 30;
        }
        this.commentary = new CommentaryEngine_1.CommentaryEngine(home.name, away.name);
        this.state = this.initState(home, away);
        this.setupKickoff('home');
    }
    initState(home, away) {
        const players = [];
        const buildTeam = (setup, team, dir) => {
            const slots = formations_1.FORMATIONS[setup.formation];
            for (let i = 0; i < 11; i++) {
                const input = setup.players[i];
                const slot = slots[i];
                const gridPos = setup.gridSlots?.[i];
                const effBaseX = gridPos ? (0, formations_1.gridToPitch)(gridPos.col, gridPos.row).baseX : slot.baseX;
                const effBaseY = gridPos ? (0, formations_1.gridToPitch)(gridPos.col, gridPos.row).baseY : slot.baseY;
                const absX = (0, formations_1.toAbsoluteX)(effBaseX, dir);
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
                    }
                    else if (fam >= 85) {
                        tp.attributes.positioning = Math.min(99, tp.attributes.positioning + 3);
                        tp.attributes.composure = Math.min(99, tp.attributes.composure + 3);
                        tp.attributes.passing = Math.min(99, tp.attributes.passing + 2);
                    }
                    else if (fam >= 65) {
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
                    }
                    else {
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
                pos: { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y, z: 0 },
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
                shotTargetY: types_1.PITCH.GOAL_Y,
                shotTargetZ: 1.0,
                deadTimer: 0,
                restartTeam: 'home',
                restartType: 'kickoff',
                restartPos: { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y },
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
            activeAspects: [...this.userAspects],
            aspectStacks: {
                shieldCharges: this.hasUserAspect('fortress_shield_start2')
                    ? 2
                    : (this.hasUserAspect('bus_shield_start1') || this.hasUserAspect('gk_shield_start1') ? 1 : 0),
                counterCharges: 0,
                passSeq: 0,
            },
        };
    }
    getState() {
        return this.state;
    }
    /**
     * 实时修改战术风格或阵型（支持玩家临场 Tactical Tweaks）
     */
    setTactics(team, formation, style) {
        if (team === 'home') {
            if (formation)
                this.state.homeFormation = formation;
            if (style)
                this.state.homeStyle = style;
        }
        else {
            if (formation)
                this.state.awayFormation = formation;
            if (style)
                this.state.awayStyle = style;
        }
        if (formation) {
            const slots = formations_1.FORMATIONS[formation];
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
    swapPlayerSlots(team, playerIdA, playerIdB) {
        if (playerIdA === playerIdB)
            return false;
        const a = this.state.players.find(p => p.id === playerIdA && p.team === team && !p.redCard);
        const b = this.state.players.find(p => p.id === playerIdB && p.team === team && !p.redCard);
        if (!a || !b)
            return false;
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
    setPlayerPitchTarget(team, playerId, absX, absY) {
        const p = this.state.players.find(x => x.id === playerId && x.team === team && !x.redCard);
        if (!p)
            return false;
        const dir = this.getAttackDir(team);
        const form = team === 'home' ? this.state.homeFormation : this.state.awayFormation;
        const slot = formations_1.FORMATIONS[form][p.slotIndex] || formations_1.FORMATIONS[form][0];
        const baseAbsX = (0, formations_1.toAbsoluteX)(slot.baseX, dir);
        const dx = (0, formations_1.clamp)((absX - baseAbsX) * dir, -20, 20);
        const dy = (0, formations_1.clamp)(absY - slot.baseY, -18, 18);
        p.customOffset = { x: dx, y: dy };
        p.targetPos = { x: (0, formations_1.clamp)(absX, 3, types_1.PITCH.LENGTH - 3), y: (0, formations_1.clamp)(absY, 3, types_1.PITCH.WIDTH - 3) };
        return true;
    }
    resetPlayerOffsets(team) {
        for (const p of this.state.players) {
            if (p.team === team)
                p.customOffset = undefined;
        }
    }
    getPlayerLine(role) {
        if (role === 'GK')
            return 'GK';
        if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role))
            return 'DEF';
        if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(role))
            return 'MID';
        return 'ATT';
    }
    /**
     * 比赛日打出教练场外指挥卡牌（支持位置限定、负面反噬与高级连锁效果）
     */
    applyCommandCard(team, card) {
        const s = this.state;
        const clampAttr = (v) => Math.max(25, Math.min(99, v));
        const targetLine = card.targetLine ?? 'ALL';
        const hadActiveBuff = s.activeBuffs.some(b => b.team === team);
        let energyRefund = 0;
        for (const p of s.players) {
            if (p.redCard)
                continue;
            if (p.team === team) {
                const matchLine = targetLine === 'ALL' || this.getPlayerLine(p.role) === targetLine;
                if (matchLine) {
                    if (card.fitnessInstantDelta) {
                        p.fitness = Math.max(20, Math.min(100, p.fitness + card.fitnessInstantDelta));
                    }
                    if (card.passingDelta)
                        p.attributes.passing = clampAttr(p.attributes.passing + card.passingDelta);
                    if (card.shootingDelta)
                        p.attributes.shooting = clampAttr(p.attributes.shooting + card.shootingDelta);
                    if (card.defendingDelta)
                        p.attributes.defending = clampAttr(p.attributes.defending + card.defendingDelta);
                    if (card.paceDelta)
                        p.attributes.pace = clampAttr(p.attributes.pace + card.paceDelta);
                    if (card.composureDelta)
                        p.attributes.composure = clampAttr(p.attributes.composure + card.composureDelta);
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
                }
                else if (card.chainEffect?.type === 'synergy_boost' && hadActiveBuff) {
                    p.attributes.pace = clampAttr(p.attributes.pace + 6);
                    p.attributes.shooting = clampAttr(p.attributes.shooting + 6);
                }
                else if (card.chainEffect?.type === 'fitness_leech') {
                    p.fitness = Math.min(100, p.fitness + 8);
                }
            }
            else if (card.chainEffect?.type === 'fitness_leech') {
                p.fitness = Math.max(20, p.fitness - 8);
            }
        }
        if (card.chainEffect?.type === 'energy_refund') {
            energyRefund = 1;
        }
        if (this.userTeamSide === team && card.element && !card.id.startsWith('sk_')) {
            if (card.element === 'press' && !energyRefund && this.hasUserAspect('press_refund') && Math.random() < 0.50) {
                energyRefund = 1;
                this.pushEvent('commentary', team, '', '', { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y }, '🔥【不熄压迫核心】威能共鸣，返还 1 点指挥能量！', undefined, 'important');
            }
            if (s.skillCooldowns) {
                for (const eq of this.userEquippedSkills) {
                    if (eq.linkedElement === card.element && (s.skillCooldowns[eq.id] ?? 0) > s.minute) {
                        s.skillCooldowns[eq.id] = Math.max(s.minute, s.skillCooldowns[eq.id] - 1);
                    }
                }
            }
        }
        if (card.forceStyle) {
            this.setTactics(team, undefined, card.forceStyle);
        }
        const endMinute = Math.min(95, s.minute + card.durationMinutes);
        s.activeBuffs.push({ team, name: card.name, endMinute, effect: card });
        const chainTag = card.chainEffect ? ` · 触发连锁【${card.chainEffect.label}】` : '';
        this.pushEvent('commentary', team, '', '', { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y }, `🃏 教练场边指令！【${card.name}】生效（持续至 ${endMinute}'）${chainTag}`, undefined, 'important');
        return { ok: true, energyRefund };
    }
    /**
     * 比赛日临场换人（每队最多 5 次）
     */
    substitute(team, outPlayerId, inSubId) {
        const s = this.state;
        const used = team === 'home' ? s.homeSubsUsed : s.awaySubsUsed;
        if (used >= 5)
            return { ok: false, reason: '换人名额已用完 (5/5)' };
        const subs = team === 'home' ? s.homeSubs : s.awaySubs;
        const subIdx = subs.findIndex(p => p.id === inSubId);
        const outPlayer = s.players.find(p => p.id === outPlayerId && p.team === team && !p.redCard);
        if (subIdx < 0 || !outPlayer)
            return { ok: false, reason: '无效的换人目标' };
        const sub = subs.splice(subIdx, 1)[0];
        const wasHolding = s.ball.holderId === outPlayer.id;
        // 替换场上球员实体（保留原战术槽位与坐标）
        const pIdx = s.players.indexOf(outPlayer);
        const newPlayer = {
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
        if (wasHolding)
            s.ball.holderId = newPlayer.id;
        if (team === 'home')
            s.homeSubsUsed++;
        else
            s.awaySubsUsed++;
        const sc = this.commentary.formatSubstitution(team, newPlayer.name, outPlayer.name, s.minute);
        this.pushEvent('substitution', team, newPlayer.id, newPlayer.name, newPlayer.pos, sc.text, undefined, sc.level);
        return { ok: true };
    }
    /**
     * 单步推进 1 个 tick (0.1s 物理时间)
     */
    step() {
        const s = this.state;
        if (s.phase === 'full_time')
            return s;
        if (s.phase === 'half_time') {
            this.startSecondHalf();
            return s;
        }
        s.tick++;
        s.minute = Math.min(95, Math.floor(s.tick / types_1.SIM_CONFIG.TICKS_PER_MINUTE));
        if (this.setPieceBoostTicks > 0)
            this.setPieceBoostTicks--;
        if (this.gkCounterBoostTicks.home > 0)
            this.gkCounterBoostTicks.home--;
        if (this.gkCounterBoostTicks.away > 0)
            this.gkCounterBoostTicks.away--;
        if (this.bypassOffsideTicks.home > 0)
            this.bypassOffsideTicks.home--;
        if (this.bypassOffsideTicks.away > 0)
            this.bypassOffsideTicks.away--;
        if (this.guaranteeShotOnTargetTicks.home > 0)
            this.guaranteeShotOnTargetTicks.home--;
        if (this.guaranteeShotOnTargetTicks.away > 0)
            this.guaranteeShotOnTargetTicks.away--;
        if (this.oppTempoDrainTicks.home > 0)
            this.oppTempoDrainTicks.home--;
        if (this.oppTempoDrainTicks.away > 0)
            this.oppTempoDrainTicks.away--;
        // 每分钟体能消耗、闷战解说检测与指挥卡过期回收
        if (s.tick % types_1.SIM_CONFIG.TICKS_PER_MINUTE === 0) {
            this.drainFitness();
            this.expireCommandBuffs();
            const lull = this.commentary.checkLull(s.minute);
            if (lull) {
                this.pushEvent('commentary', 'home', '', '', { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y }, lull.text, undefined, lull.level, lull.narrativeTag);
            }
        }
        // 阶段转换检查
        const firstHalfEnd = 45 * types_1.SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksFirst;
        const secondHalfEnd = firstHalfEnd + 45 * types_1.SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksSecond;
        if (s.phase === 'first_half' && s.tick >= firstHalfEnd) {
            s.phase = 'half_time';
            const hc = this.commentary.formatHalftime(s.minute, s.homeScore, s.awayScore);
            this.pushEvent('halftime', 'home', '', '主队', { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y }, hc.text, undefined, hc.level);
            return s;
        }
        if (s.phase === 'second_half' && s.tick >= secondHalfEnd) {
            s.phase = 'full_time';
            this.finalizeStats();
            const fc = this.commentary.formatFulltime(s.minute, s.homeScore, s.awayScore);
            this.pushEvent('fulltime', 'home', '', '主队', { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y }, fc.text, undefined, fc.level);
            return s;
        }
        // 1. 更新无球跑位与防守逼抢目标
        (0, decision_1.updateOffBallTargets)(s.players, s.ball, s.homeAttackDir, s.homeStyle, s.awayStyle, s.homeFormation, s.awayFormation, this.homeMods, this.awayMods);
        // 2. 处理球状态机
        if (s.ball.mode === 'dead') {
            this.handleDeadBall();
        }
        else if (s.ball.mode === 'held') {
            this.handleHeldBall();
        }
        else if (s.ball.mode === 'pass') {
            (0, physics_1.stepBallPhysics)(s.ball);
            this.handlePassFlight();
        }
        else if (s.ball.mode === 'shot') {
            (0, physics_1.stepBallPhysics)(s.ball);
            this.handleShotFlight();
        }
        else if (s.ball.mode === 'loose') {
            (0, physics_1.stepBallPhysics)(s.ball);
            this.handleLooseBall();
        }
        // 3. 推进球员运动学
        (0, physics_1.stepPlayersPhysics)(s.players, s.ball);
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
    evaluateActiveSkillTriggers(team) {
        const s = this.state;
        const b = s.ball;
        if (b.mode === 'dead')
            return;
        const nonSkillBuffs = s.activeBuffs.filter(bf => bf.team === team && !bf.effect.id.startsWith('sk_'));
        const hasAnyCardBuff = nonSkillBuffs.length > 0;
        const dir = this.getAttackDir(team);
        const relX = (0, formations_1.toRelativeX)(b.pos.x, dir);
        const oppRelX = 105 - relX;
        const teamHasBall = b.lastTouchTeam === team;
        for (const sk of this.userEquippedSkills) {
            const uses = (s.skillUses?.[sk.id] ?? 0);
            if (uses >= sk.maxPerMatch)
                continue;
            const cdEnd = (s.skillCooldowns?.[sk.id] ?? 0);
            if (s.minute < cdEnd)
                continue;
            const elementMatch = !!sk.linkedElement && nonSkillBuffs.some(bf => bf.effect.element === sk.linkedElement);
            const effRank = sk.effectiveRank ?? 1;
            const thresholdDrop = (hasAnyCardBuff ? 20 : 0) + (effRank >= 3 ? 10 : 0);
            if (this.userFamAvg < Math.max(10, sk.minFamiliarity - thresholdDrop))
                continue;
            if (this.userChemAvg < Math.max(10, sk.minChemistry - thresholdDrop))
                continue;
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
                const boostTag = elementMatch ? ' (元素过载+35%)' : hasAnyCardBuff ? ' (卡牌共振+20%)' : '';
                s.activeSkillPrompt = {
                    skillId: sk.id,
                    name: sk.name,
                    situationLabel: sk.situationLabel,
                    powerLabel: `${sk.powerLabel}${boostTag}`,
                    expiresTick: s.tick + 12,
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
    executeInstantSkillAction(team, sk, mul) {
        const s = this.state;
        const b = s.ball;
        const dir = this.getAttackDir(team);
        const goalX = dir === 1 ? types_1.PITCH.LENGTH : 0;
        const friendly = s.players.filter(p => p.team === team && !p.redCard);
        const holder = b.holderId ? s.players.find(p => p.id === b.holderId) : undefined;
        const action = sk.instantAction ?? 'force_through_ball';
        switch (action) {
            case 'clear_danger': {
                if (holder && holder.team !== team)
                    holder.stunTicks = 12;
                const defender = friendly
                    .filter(p => p.role !== 'GK')
                    .sort((a, c) => (0, physics_1.dist2D)(a.pos, b.pos) - (0, physics_1.dist2D)(c.pos, b.pos))[0];
                const target = friendly
                    .filter(p => p.role !== 'GK' && p.id !== defender?.id)
                    .sort((a, c) => (0, formations_1.toRelativeX)(c.pos.x, dir) - (0, formations_1.toRelativeX)(a.pos.x, dir))[0];
                if (defender && target) {
                    this.giveBallTo(defender);
                    defender.matchStats.interceptions++;
                    s.stats[team].interceptions++;
                    (0, physics_1.launchPassBall)(b, defender.pos, target.pos, defender, target, 'long');
                }
                else if (defender) {
                    this.giveBallTo(defender);
                }
                if (this.hasUserAspect('clear_counter_stack') && s.aspectStacks) {
                    s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
                }
                return '强硬断球解围化险！';
            }
            case 'instant_counter_pass': {
                const passer = (holder && holder.team === team ? holder : undefined) ??
                    friendly.filter(p => p.role !== 'GK').sort((a, c) => (0, physics_1.dist2D)(a.pos, b.pos) - (0, physics_1.dist2D)(c.pos, b.pos))[0];
                const target = friendly
                    .filter(p => p.role !== 'GK' && p.id !== passer?.id)
                    .sort((a, c) => (0, formations_1.toRelativeX)(c.pos.x, dir) - (0, formations_1.toRelativeX)(a.pos.x, dir))[0];
                if (passer && target) {
                    if (b.mode !== 'held' || holder?.team !== team) {
                        this.giveBallTo(passer);
                    }
                    this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 20);
                    (0, physics_1.launchPassBall)(b, passer.pos, target.pos, passer, target, 'long');
                    if (this.hasUserAspect('counter_pass_speed')) {
                        b.vel.x *= 1.20;
                        b.vel.y *= 1.20;
                    }
                    return `极速长传连线 ${target.name}！`;
                }
                return '全队瞬间提速反击！';
            }
            case 'force_through_ball': {
                const passer = (holder && holder.team === team ? holder : undefined) ??
                    friendly.filter(p => p.role !== 'GK').sort((a, c) => (0, physics_1.dist2D)(a.pos, b.pos) - (0, physics_1.dist2D)(c.pos, b.pos))[0];
                const target = friendly
                    .filter(p => p.role !== 'GK' && p.id !== passer?.id)
                    .sort((a, c) => (0, formations_1.toRelativeX)(c.pos.x, dir) - (0, formations_1.toRelativeX)(a.pos.x, dir))[0];
                if (passer && target) {
                    if (holder?.team !== team)
                        this.giveBallTo(passer);
                    const leadPos = {
                        x: (0, formations_1.clamp)(target.pos.x + dir * 3.5, 2, types_1.PITCH.LENGTH - 2),
                        y: (0, formations_1.clamp)(target.pos.y, 2, types_1.PITCH.WIDTH - 2),
                    };
                    (0, physics_1.launchPassBall)(b, passer.pos, leadPos, passer, target, 'through');
                    return `穿透直塞打穿防线找 ${target.name}！`;
                }
                return '中路渗透线路全面开启！';
            }
            case 'force_shot_on_target': {
                const effRank = sk.effectiveRank ?? 1;
                this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 75);
                const carrier = holder && holder.team === team ? holder : undefined;
                if (carrier && carrier.role !== 'GK' && (0, formations_1.toRelativeX)(carrier.pos.x, dir) > 48) {
                    const dist = (0, physics_1.dist2D)(carrier.pos, { x: goalX, y: types_1.PITCH.GOAL_Y });
                    const rawXg = (0, formations_1.clamp)((0.26 - dist * 0.004 + effRank * 0.025) * mul, 0.14, 0.65);
                    this.executeShot(carrier, rawXg, true);
                    return `${carrier.name} 校准死角爆射！`;
                }
                return '禁区校准！下次射门必中门框且威力提升！';
            }
            case 'win_foul_setpiece': {
                const carrier = (holder && holder.team === team ? holder : undefined) ??
                    friendly.filter(p => p.role !== 'GK').sort((a, c) => (0, formations_1.toRelativeX)(c.pos.x, dir) - (0, formations_1.toRelativeX)(a.pos.x, dir))[0];
                if (carrier) {
                    const fkX = dir === 1
                        ? (0, formations_1.clamp)(Math.max(carrier.pos.x, types_1.PITCH.HALF_X + 12), types_1.PITCH.HALF_X + 10, types_1.PITCH.LENGTH - 18)
                        : (0, formations_1.clamp)(Math.min(carrier.pos.x, types_1.PITCH.HALF_X - 12), 18, types_1.PITCH.HALF_X - 10);
                    this.setDeadBall(team, 'freekick', { x: fkX, y: (0, formations_1.clamp)(carrier.pos.y, 6, types_1.PITCH.WIDTH - 6) }, 4);
                    this.setPieceBoostTeam = team;
                    this.setPieceBoostTicks = 120;
                    return `${carrier.name} 赢得前场高危定位球！`;
                }
                return '压迫造犯规获定位球机会！';
            }
            case 'GK_save_boost': {
                const gk = friendly.find(p => p.role === 'GK');
                if (b.mode === 'shot' && b.lastTouchTeam !== team && gk) {
                    gk.matchStats.saves++;
                    s.stats[team].saves++;
                    this.giveBallTo(gk);
                    this.pushEvent('save', team, gk.id, gk.name, gk.pos, `🧤【门神时刻】${gk.name} 不可思议飞身救主！`, undefined, 'important');
                    return `${gk.name} 门线反应飞扑化解绝杀！`;
                }
                if (s.aspectStacks) {
                    s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
                }
                return '门前结界展开，叠加 +1 绝杀护盾！';
            }
            case 'tempo_burst_intercept':
            default: {
                if (holder && holder.team !== team)
                    holder.stunTicks = 12;
                const interceptor = friendly
                    .filter(p => p.role !== 'GK')
                    .sort((a, c) => (0, physics_1.dist2D)(a.pos, b.pos) - (0, physics_1.dist2D)(c.pos, b.pos))[0];
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
    triggerActiveSkill(team, skillId) {
        const s = this.state;
        const sk = this.userEquippedSkills.find(x => x.id === skillId);
        const failRes = {
            ok: false,
            triggered: false,
            skillId,
            skillName: sk?.name ?? skillId,
            vfxTheme: sk?.vfxTheme ?? 'ult',
            instantSummary: '',
            effectiveRank: sk?.effectiveRank ?? 1,
            isCardBoosted: false,
        };
        if (!sk)
            return failRes;
        const uses = s.skillUses?.[skillId] ?? 0;
        if (uses >= sk.maxPerMatch)
            return failRes;
        const cdEnd = s.skillCooldowns?.[skillId] ?? 0;
        if (s.minute < cdEnd)
            return failRes;
        const nonSkillBuffs = s.activeBuffs.filter(bf => bf.team === team && !bf.effect.id.startsWith('sk_'));
        const hasAnyCardBuff = nonSkillBuffs.length > 0;
        const isElementOverdrive = !!sk.linkedElement && nonSkillBuffs.some(bf => bf.effect.element === sk.linkedElement);
        const mul = isElementOverdrive ? 1.35 : hasAnyCardBuff ? 1.20 : 1.0;
        // 1. 立即结算场上物理干预结果（直接改变传球/射门/断球/定位球走势）
        const instantSummary = this.executeInstantSkillAction(team, sk, mul);
        // 2. 结算技能分支质变 (A/B)
        const oppTeam = team === 'home' ? 'away' : 'home';
        if (sk.mutationTag) {
            switch (sk.mutationTag) {
                case 'bypass_offside':
                    this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
                    break;
                case 'guarantee_shot_on_target':
                    this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 65);
                    break;
                case 'refund_card_energy':
                    this.pushCoachReward({ energyRefund: 1, bannerText: `⚡【${sk.name}·质变】返还 +1 指挥能量`, tone: '#FBBF24' });
                    break;
                case 'reduce_all_cd':
                    this.reduceEquippedCooldowns(3);
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
                case 'double_duration':
                    break;
            }
        }
        // 3. 元素过载与 18 融合威能联动
        if (isElementOverdrive) {
            if (sk.linkedElement === 'press' || sk.linkedElement === 'blitz') {
                this.pushCoachReward({ nextCardDiscount: 1, bannerText: '🔥【元素过载】下张指挥卡消耗 -1 能量！', tone: '#F97316' });
            }
            else if (sk.linkedElement === 'pass' && !this.aspectRefreshUsedThisMatch) {
                this.aspectRefreshUsedThisMatch = true;
                this.pushCoachReward({ refreshUsedCard: true, bannerText: '✨【传导过载】刷新 1 张已使用指挥卡！', tone: '#22D3EE' });
            }
            else if (sk.linkedElement === 'iron' && s.aspectStacks) {
                s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
            }
            else if (sk.linkedElement === 'wing' && s.aspectStacks) {
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
            this.pushCoachReward({ energyRefund: 1, bannerText: '🛡️【五盾绞杀】汲取 +1 指挥能量！', tone: '#F59E0B' });
        }
        if (this.hasUserAspect('wing_switch_discount') && sk.linkedElement === 'wing') {
            this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
            this.pushCoachReward({ nextCardDiscount: 1, bannerText: '⚡【双翼弹射】下张手牌 -1 能量！', tone: '#38BDF8' });
        }
        if (this.hasUserAspect('press_refund') && sk.linkedElement === 'press' && Math.random() < 0.55) {
            this.pushCoachReward({ energyRefund: 1, bannerText: '🔥【不熄压迫】技卡共振返还 +1 能量！', tone: '#EF4444' });
        }
        const eff = {
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
        const effCd = (hasAnyCardBuff || isElementOverdrive) ? Math.round(sk.cooldownMinutes * 0.75) : sk.cooldownMinutes;
        s.skillCooldowns[skillId] = s.minute + effCd;
        s.activeSkillPrompt = null;
        const effRank = sk.effectiveRank ?? 1;
        this.pushEvent('commentary', team, '', '', s.ball.pos, `⚡ 主动技觉醒【${sk.name} R${effRank}】：${instantSummary}`, undefined, 'important');
        return {
            ok: true,
            triggered: true,
            boosted: hasAnyCardBuff || isElementOverdrive,
            skillId: sk.id,
            skillName: sk.name,
            vfxTheme: (effRank >= 3 ? 'ult' : (sk.vfxTheme ?? 'ult')),
            instantSummary,
            effectiveRank: effRank,
            isCardBoosted: hasAnyCardBuff || isElementOverdrive,
            mutationChoice: sk.mutationChoice,
            mutationLabel: sk.mutationLabel,
        };
    }
    dismissActiveSkillPrompt() {
        this.state.activeSkillPrompt = null;
    }
    /**
     * 一键跑完全场（Headless 批量模拟用）
     */
    simulateMatch() {
        while (this.state.phase !== 'full_time') {
            this.step();
        }
        return this.state;
    }
    getAttackDir(team) {
        return team === 'home' ? this.state.homeAttackDir : (this.state.homeAttackDir === 1 ? -1 : 1);
    }
    getPossessionTeam() {
        const b = this.state.ball;
        if (b.holderId) {
            const h = this.state.players.find(p => p.id === b.holderId);
            return h ? h.team : null;
        }
        return b.lastTouchTeam;
    }
    clearHolder() {
        for (const p of this.state.players)
            p.hasBall = false;
        this.state.ball.holderId = null;
    }
    giveBallTo(player) {
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
    setupKickoff(team) {
        this.clearHolder();
        for (const p of this.state.players) {
            if (p.redCard)
                continue;
            const dir = this.getAttackDir(p.team);
            const slots = p.team === 'home' ? formations_1.FORMATIONS[this.state.homeFormation] : formations_1.FORMATIONS[this.state.awayFormation];
            const slot = slots[p.slotIndex];
            // 开球时退回己方半场
            const safeRelX = Math.min(48, slot.baseX);
            p.pos = { x: (0, formations_1.toAbsoluteX)(safeRelX, dir), y: slot.baseY };
            p.vel = { x: 0, y: 0 };
            p.targetPos = { ...p.pos };
        }
        const kicker = this.state.players.find(p => p.team === team && !p.redCard && p.role === 'ST') ||
            this.state.players.find(p => p.team === team && !p.redCard && p.role !== 'GK');
        kicker.pos = { x: types_1.PITCH.HALF_X, y: types_1.PITCH.HALF_Y };
        this.giveBallTo(kicker);
        if (this.isKickoffFirst) {
            this.isKickoffFirst = false;
            const kc = this.commentary.formatKickoff(this.state.minute);
            this.pushEvent('kickoff', team, kicker.id, kicker.name, kicker.pos, kc.text, undefined, kc.level);
        }
    }
    startSecondHalf() {
        this.state.phase = 'second_half';
        this.state.homeAttackDir = -1;
        // 半场体能小幅恢复
        for (const p of this.state.players) {
            if (!p.redCard)
                p.fitness = Math.min(100, p.fitness + 6);
        }
        this.setupKickoff('away');
    }
    handleDeadBall() {
        const b = this.state.ball;
        if (b.deadTimer > 0) {
            b.deadTimer--;
            return;
        }
        const team = b.restartTeam;
        const dir = this.getAttackDir(team);
        let taker;
        if (b.restartType === 'goalkick') {
            taker = this.state.players.find(p => p.team === team && p.role === 'GK');
            // 真实门球规则：对方球员退至禁区外，本方中卫/边卫散开接应，避免禁区内弹球混战
            for (const p of this.state.players) {
                if (p.redCard || p.id === taker?.id)
                    continue;
                if (p.team !== team) {
                    const oppRelX = (0, formations_1.toRelativeX)(p.pos.x, dir);
                    if (oppRelX < 22) {
                        p.pos.x = (0, formations_1.toAbsoluteX)(24, dir);
                    }
                }
                else if (p.role === 'CB' || p.role === 'LB' || p.role === 'RB') {
                    p.pos.x = (0, formations_1.toAbsoluteX)(19, dir);
                }
            }
        }
        else if (b.restartType === 'penalty') {
            // 直接罚点球
            const penSpotX = dir === 1 ? types_1.PITCH.LENGTH - types_1.PITCH.PENALTY_SPOT : types_1.PITCH.PENALTY_SPOT;
            taker = this.state.players
                .filter(p => p.team === team && !p.redCard && p.role !== 'GK')
                .sort((a, b2) => b2.attributes.shooting - a.attributes.shooting)[0];
            if (taker) {
                taker.pos = { x: penSpotX, y: types_1.PITCH.GOAL_Y };
                this.executeShot(taker, 0.76);
                return;
            }
        }
        else {
            const restartRelX = (0, formations_1.toRelativeX)(b.restartPos.x, dir);
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
                        x: (0, formations_1.toAbsoluteX)(92 + (ci === 0 ? 1.5 : -1.5), dir),
                        y: types_1.PITCH.HALF_Y + (ci === 0 ? -3.5 : 4.5),
                    };
                    cbs[ci].targetPos = { ...cbs[ci].pos };
                }
            }
            taker = this.state.players
                .filter(p => p.team === team && !p.redCard && p.role !== 'GK' && p.role !== 'CB')
                .sort((a, b2) => (0, physics_1.dist2D)(a.pos, b.restartPos) - (0, physics_1.dist2D)(b2.pos, b.restartPos))[0];
        }
        if (taker) {
            taker.pos = { ...b.restartPos };
            taker.vel = { x: 0, y: 0 };
            this.giveBallTo(taker);
        }
        else {
            b.mode = 'loose';
        }
    }
    handleHeldBall() {
        const b = this.state.ball;
        const holder = this.state.players.find(p => p.id === b.holderId);
        if (!holder) {
            b.mode = 'loose';
            return;
        }
        // 1. 检查近身防守抢断 / 犯规
        const oppStyle = holder.team === 'home' ? this.state.awayStyle : this.state.homeStyle;
        const pressMul = types_1.TACTICAL_PRESETS[oppStyle].pressIntensity;
        const defenders = this.state.players
            .filter(p => p.team !== holder.team && !p.redCard && p.stunTicks === 0 && p.role !== 'GK')
            .filter(p => (0, physics_1.dist2D)(p.pos, holder.pos) < 2.35);
        if (defenders.length > 0) {
            const def = defenders[0];
            // 每 tick 约 26% * pressMul 尝试一次贴身对抗
            if (Math.random() < 0.26 * pressMul) {
                const oppTeam = holder.team === 'home' ? 'away' : 'home';
                const defPower = def.attributes.defending * 0.7 + def.attributes.strength * 0.3;
                const frenzyHolderEdge = this.hasActiveMechanic(holder.team, 'blood_frenzy') && this.isTrailing(holder.team) ? 4 : 0;
                const attPower = holder.attributes.dribbling * 0.7 + holder.attributes.strength * 0.3 + frenzyHolderEdge;
                const tackleGoldMul = def.goldTraits?.includes('精准铲断') ? 2 : 1;
                const traitTackleBonus = def.traits?.includes('精准铲断') ? 0.10 * tackleGoldMul : 0;
                const styleTackleBonus = oppStyle === 'gegenpress' ? 0.06 :
                    oppStyle === 'park_bus' && (0, formations_1.toRelativeX)(holder.pos.x, this.getAttackDir(holder.team)) >= 68 ? 0.05 : 0;
                const defFatigueTacklePenalty = def.fitness < 65 ? -0.10 : 0;
                const holderStyle = holder.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
                const holderForm = holder.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
                const holderRelX = (0, formations_1.toRelativeX)(holder.pos.x, this.getAttackDir(holder.team));
                const counterStyleTackleMod = (oppStyle === 'gegenpress' && holderStyle === 'tiki_taka' && holderRelX < 55 ? 0.08 : 0) +
                    ((oppStyle === 'gegenpress' || oppStyle === 'wing_play') && (holderStyle === 'counter' || holderStyle === 'park_bus') && holderRelX < 58 ? -0.10 : 0) +
                    (holderStyle === 'balanced' && (oppStyle === 'gegenpress' || oppStyle === 'tiki_taka') ? 0.03 : 0) +
                    ((0, formations_1.getDefenseSystem)(holderForm) === '5-back' && holderRelX >= 52 ? -0.03 : 0) +
                    ((0, formations_1.getDefenseSystem)(holderForm) === '4-back' && holderRelX < 52 ? -0.03 : 0);
                const blitzBonus = this.hasActiveMechanic(oppTeam, 'high_press_blitz') ? 0.12 : 0;
                const traitFoulMul = def.traits?.includes('精准铲断') ? (def.goldTraits?.includes('精准铲断') ? 0.45 : 0.65) : 1.0;
                const tackleWinProb = (0, formations_1.clamp)(0.45 + ((defPower - attPower) / 100) * 0.55 + traitTackleBonus + styleTackleBonus + defFatigueTacklePenalty + counterStyleTackleMod + blitzBonus, 0.15, 0.92);
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
                }
                else {
                    // 防守者被过掉，短暂硬直
                    def.stunTicks = 6;
                }
            }
        }
        // 2. 持球人决策节拍
        if (holder.decisionCooldown > 0)
            return;
        const style = holder.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
        const mods = holder.team === 'home' ? this.homeMods : this.awayMods;
        const dir = this.getAttackDir(holder.team);
        const action = (0, decision_1.decideOnBall)(holder, dir, style, this.state.players, b, mods);
        const interval = Math.max(3, Math.round(types_1.SIM_CONFIG.DECISION_INTERVAL / types_1.TACTICAL_PRESETS[style].tempo));
        holder.decisionCooldown = interval;
        if (action.type === 'shoot') {
            this.executeShot(holder, action.xG);
        }
        else if (action.type === 'pass') {
            this.executePass(holder, action.target, action.passType);
        }
        else {
            holder.targetPos = action.targetPos;
        }
    }
    executePass(passer, target, passType) {
        passer.hasBall = false;
        passer.matchStats.passes++;
        this.state.stats[passer.team].passes++;
        this.lastPassTimestamp = this.state.tick;
        // 检查越位（球离开脚瞬间，接球者在对方半场且在越位线前）
        const dir = this.getAttackDir(passer.team);
        const defenders = this.state.players.filter(p => p.team !== passer.team && !p.redCard);
        defenders.sort((a, b) => (dir === 1 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x));
        const offsideLine = defenders.length >= 2
            ? (dir === 1 ? Math.max(types_1.PITCH.HALF_X, defenders[1].pos.x) : Math.min(types_1.PITCH.HALF_X, defenders[1].pos.x))
            : types_1.PITCH.HALF_X;
        const targetIsOffside = target.role !== 'GK' &&
            (dir === 1 ? target.pos.x > offsideLine + 0.9 : target.pos.x < offsideLine - 0.9);
        if (this.bypassOffsideTicks[passer.team] > 0) {
            this.bypassOffsideTicks[passer.team] = 0;
        }
        else if (targetIsOffside && Math.random() < 0.78) {
            const oppTeam = passer.team === 'home' ? 'away' : 'home';
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
        const leadPos = {
            x: (0, formations_1.clamp)(target.pos.x + target.vel.x * 0.35 + (Math.random() - 0.5) * windDrift, 2, types_1.PITCH.LENGTH - 2),
            y: (0, formations_1.clamp)(target.pos.y + target.vel.y * 0.35 + (Math.random() - 0.5) * windDrift, 2, types_1.PITCH.WIDTH - 2),
        };
        (0, physics_1.launchPassBall)(this.state.ball, passer.pos, leadPos, passer, target, passType);
        if (this.userTeamSide === passer.team && (passType === 'long' || passType === 'through') && this.hasUserAspect('counter_pass_speed')) {
            this.state.ball.vel.x *= 1.15;
            this.state.ball.vel.y *= 1.15;
        }
    }
    executeShot(shooter, xG, forceOnTarget = false) {
        const dir = this.getAttackDir(shooter.team);
        const goalX = dir === 1 ? types_1.PITCH.LENGTH : 0;
        const dist = (0, physics_1.dist2D)(shooter.pos, { x: goalX, y: types_1.PITCH.GOAL_Y });
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
        const hasBloodFrenzy = this.hasActiveMechanic(shooter.team, 'blood_frenzy') && this.isTrailing(shooter.team);
        if (hasBloodFrenzy) {
            xG = Math.min(0.68, xG * 1.10);
        }
        const myStyleShot = shooter.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
        const myFormShot = shooter.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
        const oppStyleShot = shooter.team === 'home' ? this.state.awayStyle : this.state.homeStyle;
        const oppFormShot = shooter.team === 'home' ? this.state.awayFormation : this.state.homeFormation;
        const oppIs5Back = (0, formations_1.getDefenseSystem)(oppFormShot) === '5-back';
        if ((myStyleShot === 'counter' || myStyleShot === 'park_bus') && (oppStyleShot === 'gegenpress' || oppStyleShot === 'wing_play')) {
            xG = Math.min(0.68, xG + (myStyleShot === 'counter' ? 0.08 : 0.05));
        }
        else if (myStyleShot === 'park_bus' && oppStyleShot !== 'park_bus') {
            xG = Math.min(0.68, xG + 0.03);
        }
        else if (myStyleShot === 'counter' && oppStyleShot !== 'park_bus') {
            xG = Math.min(0.68, xG + 0.02);
        }
        else if (oppStyleShot === 'gegenpress' && dist >= 18 && dist < 24) {
            xG = Math.min(0.68, xG + 0.02);
        }
        else if (myStyleShot === 'tiki_taka' && oppStyleShot === 'park_bus') {
            xG = Math.min(0.68, xG + 0.04);
        }
        if ((0, formations_1.getDefenseSystem)(myFormShot) === '5-back' && (0, formations_1.toRelativeX)(shooter.pos.x, dir) > 50) {
            xG = Math.min(0.68, xG + (myFormShot === '5-4-1' ? 0.02 : 0.01));
        }
        if ((0, formations_1.getDefenseSystem)(myFormShot) === '4-back' && (0, formations_1.toRelativeX)(shooter.pos.x, dir) > 70) {
            xG = Math.min(0.68, xG + 0.02);
        }
        shooter.hasBall = false;
        shooter.matchStats.shots++;
        this.state.stats[shooter.team].shots++;
        this.state.stats[shooter.team].xG += xG;
        // 决定是否射正门框范围内（受 shooting、疲惫、五后卫/铁桶密集干扰与距离影响）
        const fatiguePenalty = shooter.fitness < 62 ? ((62 - shooter.fitness) / 38) * 0.11 : 0;
        const strainPenalty = shooter.strainWarning ? 0.04 : 0;
        const antiAttackShotPenalty = (oppIs5Back && (myStyleShot === 'wing_play' || (0, formations_1.getDefenseSystem)(myFormShot) === '3-back') ? 0.08 : 0) +
            (oppStyleShot === 'park_bus' && (myStyleShot === 'wing_play' || myStyleShot === 'gegenpress') ? 0.07 : 0);
        const rawShoot = Math.min(99, shooter.attributes.shooting + (hasBloodFrenzy ? 8 : 0));
        const effectiveShoot = rawShoot > 80 ? 80 + (rawShoot - 80) * 1.35 : rawShoot;
        const longDistPenalty = dist >= 22 && !hasLongShotCannon ? (dist - 20) * 0.015 : 0;
        const onTargetProb = (0, formations_1.clamp)(0.24 + (effectiveShoot / 99) * 0.34 - (dist / 32) * 0.16 - longDistPenalty - fatiguePenalty - strainPenalty - antiAttackShotPenalty + (hasLongShotCannon ? 0.14 : 0), 0.10, hasLongShotCannon ? 0.74 : 0.68);
        const onTarget = forceOnTarget || Math.random() < onTargetProb;
        if (onTarget) {
            this.state.stats[shooter.team].shotsOnTarget++;
        }
        const targetY = onTarget
            ? types_1.PITCH.GOAL_Y + (Math.random() - 0.5) * (types_1.PITCH.GOAL_HALF_WIDTH * 1.8)
            : types_1.PITCH.GOAL_Y + (Math.random() < 0.5 ? -1 : 1) * (types_1.PITCH.GOAL_HALF_WIDTH + 1.2 + Math.random() * 3.0);
        const targetZ = onTarget ? 0.3 + Math.random() * 1.8 : 0.6 + Math.random() * 2.8;
        this.lastShotType = dist >= 20 ? 'long_range' : this.state.ball.pos.z > 0.9 ? 'header' : 'normal';
        const sc = this.commentary.formatShot(shooter.team, shooter.name, xG, this.state.minute);
        this.pushEvent('shot', shooter.team, shooter.id, shooter.name, shooter.pos, sc.text, xG, sc.level);
        if (sc.momentumText) {
            this.pushEvent('commentary', shooter.team, '', '', shooter.pos, sc.momentumText, undefined, 'important', 'MOMENTUM');
        }
        (0, physics_1.launchShotBall)(this.state.ball, shooter, dir, xG, onTarget, targetY, targetZ);
    }
    handlePassFlight() {
        const b = this.state.ball;
        // 1. 出界检查
        if (this.checkOutOfBounds())
            return;
        // 2. 防守球员路径拦截检查（高度低于 2.1m 才能拦截）
        if (b.pos.z < 2.1) {
            for (const p of this.state.players) {
                if (p.team === b.lastTouchTeam || p.redCard || p.stunTicks > 0)
                    continue;
                const d = (0, physics_1.dist2D)(p.pos, b.pos);
                if (d < 2.2) {
                    const passTeam = b.lastTouchTeam ?? 'home';
                    const passStyle = passTeam === 'home' ? this.state.homeStyle : this.state.awayStyle;
                    const defStyleInt = p.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
                    const defFormInt = p.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
                    const defIs5Back = (0, formations_1.getDefenseSystem)(defFormInt) === '5-back';
                    let interceptMod = 0;
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
                    const passerResist = ((passerPass - 60) / 100) * 0.28 +
                        (passerObj?.traits?.includes('节拍器') ? (passerObj.goldTraits?.includes('节拍器') ? 0.08 : 0.05) : 0) +
                        (isLoftedPass && passerObj?.traits?.includes('精准长传') ? (passerObj.goldTraits?.includes('精准长传') ? 0.10 : 0.06) : 0);
                    const oppTempoPenalty = this.oppTempoDrainTicks[passTeam] > 0 ? 0.08 : 0;
                    const interceptChance = (0, formations_1.clamp)(0.50 + ((p.attributes.defending - 60) / 100) * 0.28 - passerResist + interceptMod + oppTempoPenalty, 0.24, 0.86);
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
        if (target && (0, physics_1.dist2D)(target.pos, b.pos) < 1.75 && b.pos.z < 2.2) {
            const passer = this.state.players.find(p => p.id === b.lastPasserId);
            if (passer) {
                passer.matchStats.passesSuccess++;
                this.state.stats[passer.team].passesSuccess++;
                const pk = passer.id < target.id ? `${passer.id}|${target.id}` : `${target.id}|${passer.id}`;
                this.state.pairPasses = this.state.pairPasses ?? {};
                this.state.pairPasses[pk] = (this.state.pairPasses[pk] ?? 0) + 1;
                if (this.userTeamSide === passer.team && this.state.aspectStacks) {
                    const ast = this.state.aspectStacks;
                    ast.passSeq++;
                    if (ast.passSeq >= 4 && this.hasUserAspect('pass4_cd_cut')) {
                        ast.passSeq = 0;
                        this.reduceEquippedCooldowns(1);
                    }
                    else if (ast.passSeq >= 5 && this.hasUserAspect('pass5_card_discount')) {
                        ast.passSeq = 0;
                        this.pushCoachReward({ nextCardDiscount: 1, bannerText: '🎯【传控枢纽】5连传导，下张指挥卡 -1 能量！', tone: '#38BDF8' });
                    }
                    else if (ast.passSeq >= 5 && this.hasUserAspect('pass5_cd_cut2')) {
                        ast.passSeq = 0;
                        this.reduceEquippedCooldowns(2);
                    }
                    else if (ast.passSeq >= 5 && this.hasUserAspect('deep_buildup_refresh') && !this.aspectRefreshUsedThisMatch) {
                        ast.passSeq = 0;
                        this.aspectRefreshUsedThisMatch = true;
                        this.pushCoachReward({ refreshUsedCard: true, bannerText: '🔄【出球大师】5连稳健传导，刷新 1 张已用手牌！', tone: '#2DD4BF' });
                    }
                }
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
            const baseCrossFinish = tStyle === 'wing_play' || (tMods.crossBias ?? 0) > 0.03 ? 0.52 : 0.49;
            const defFormCross = target.team === 'home' ? this.state.awayFormation : this.state.homeFormation;
            const defStyleCross = target.team === 'home' ? this.state.awayStyle : this.state.homeStyle;
            const antiCrossPenalty = ((0, formations_1.getDefenseSystem)(defFormCross) === '5-back' ? 0.22 : 0) +
                (defStyleCross === 'park_bus' ? 0.16 : 0);
            const crossFinishProb = (0, formations_1.clamp)(baseCrossFinish + (this.hasActiveMechanic(target.team, 'wing_overload') ? 0.20 : 0) - antiCrossPenalty, 0.18, 0.92);
            if (b.passType === 'cross' && target.role !== 'GK' && Math.random() < crossFinishProb) {
                const dir = this.getAttackDir(target.team);
                const relX = (0, formations_1.toRelativeX)(target.pos.x, dir);
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
    handleShotFlight() {
        const b = this.state.ball;
        const shooter = this.state.players.find(p => p.id === b.shotShooterId);
        const shootTeam = shooter ? shooter.team : (b.lastTouchTeam || 'home');
        const defTeam = shootTeam === 'home' ? 'away' : 'home';
        // 1. 门前防守封堵检测（五后卫体系与铁桶防反密集封堵半径与成功率更高）
        const defStyle = defTeam === 'home' ? this.state.homeStyle : this.state.awayStyle;
        const defForm = defTeam === 'home' ? this.state.homeFormation : this.state.awayFormation;
        const isFiveBack = (0, formations_1.getDefenseSystem)(defForm) === '5-back';
        const hasIronWall = this.hasActiveMechanic(defTeam, 'iron_wall_block');
        const shootForm = shootTeam === 'home' ? this.state.homeFormation : this.state.awayFormation;
        const shootStyle = shootTeam === 'home' ? this.state.homeStyle : this.state.awayStyle;
        const fiveVsCounterTarget = isFiveBack && ((0, formations_1.getDefenseSystem)(shootForm) === '3-back' || shootStyle === 'wing_play') ? 0.10 : 0;
        const busVsCounterTarget = defStyle === 'park_bus' && (shootStyle === 'wing_play' || shootStyle === 'gegenpress') ? 0.09 : 0;
        const blockDist = (defStyle === 'park_bus' || isFiveBack ? 1.36 : 1.08) + (hasIronWall ? 0.25 : 0);
        const blockProb = (defStyle === 'park_bus' || isFiveBack ? 0.22 : 0.18) + fiveVsCounterTarget + busVsCounterTarget + (hasIronWall ? 0.16 : 0);
        if (b.pos.z < 1.9) {
            for (const p of this.state.players) {
                if (p.team !== defTeam || p.redCard || p.role === 'GK')
                    continue;
                if ((0, physics_1.dist2D)(p.pos, b.pos) < blockDist && Math.random() < blockProb) {
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
        const crossedRight = b.pos.x >= types_1.PITCH.LENGTH - 0.5;
        if (!crossedLeft && !crossedRight) {
            // 球中途停下
            const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
            if (speed < 2.0 && b.pos.z <= 0.1)
                b.mode = 'loose';
            return;
        }
        const inGoalMouth = b.shotOnTarget &&
            Math.abs(b.pos.y - types_1.PITCH.GOAL_Y) <= types_1.PITCH.GOAL_HALF_WIDTH &&
            b.pos.z <= 2.44;
        if (!inGoalMouth) {
            const mc = this.commentary.formatMiss(shootTeam, shooter?.name || '前锋', this.state.minute);
            this.pushEvent('miss', shootTeam, shooter?.id || '', shooter?.name || '', b.pos, mc.text, undefined, mc.level);
            if (Math.random() < 0.30) {
                this.state.stats[shootTeam].corners++;
                const cornerX = crossedLeft ? 1 : types_1.PITCH.LENGTH - 1;
                const cornerY = b.pos.y < types_1.PITCH.HALF_Y ? 1 : types_1.PITCH.WIDTH - 1;
                const cc = this.commentary.formatCorner(shootTeam, this.state.minute);
                this.pushEvent('corner', shootTeam, '', '', { x: cornerX, y: cornerY }, cc.text, undefined, cc.level);
                this.setDeadBall(shootTeam, 'corner', { x: cornerX, y: cornerY }, 5);
            }
            else {
                this.setDeadBall(defTeam, 'goalkick', { x: crossedLeft ? 5.5 : types_1.PITCH.LENGTH - 5.5, y: types_1.PITCH.GOAL_Y }, 5);
            }
            return;
        }
        // 3. 门将扑救判定（L1+L2 校准：AI 内战总进球 2.3~2.7，零封率 28%~35%，并拉开 80+ 高分区分化）
        const gk = this.state.players.find(p => p.team === defTeam && p.role === 'GK');
        const rawGk = gk ? gk.attributes.goalkeeping : 65;
        const gkAttr = rawGk > 80 ? 80 + (rawGk - 80) * 1.15 : rawGk;
        const frenzyShootBonus = shooter && this.hasActiveMechanic(shooter.team, 'blood_frenzy') && this.isTrailing(shooter.team) ? 8 : 0;
        const rawShooterShoot = shooter ? Math.min(99, shooter.attributes.shooting + frenzyShootBonus) : 70;
        const rawShooterComp = shooter ? shooter.attributes.composure : 70;
        const baseShooterAttr = rawShooterShoot * 0.65 + rawShooterComp * 0.35;
        const shooterAttr = baseShooterAttr > 80 ? 80 + (baseShooterAttr - 80) * 1.15 : baseShooterAttr;
        const gkGoldMul = gk?.goldTraits?.includes('门线神扑') ? 2 : 1;
        const gkTraitBonus = gk?.traits?.includes('门线神扑') ? 0.045 * gkGoldMul : 0;
        const gkSaveBonus = ((rawGk - 65) / 100) * 0.16 + gkTraitBonus;
        const attrDiffBonus = ((shooterAttr - gkAttr) / 100) * 0.28;
        const strainGoalPenalty = shooter?.strainWarning ? 0.04 : 0;
        const goalProb = (0, formations_1.clamp)(0.33 + b.shotXG * 0.88 + attrDiffBonus - gkSaveBonus - strainGoalPenalty, 0.16, 0.76);
        if (Math.random() < goalProb) {
            if (this.userTeamSide === defTeam && this.state.aspectStacks && this.state.aspectStacks.shieldCharges > 0) {
                this.state.aspectStacks.shieldCharges--;
                if (gk)
                    gk.matchStats.saves++;
                this.state.stats[defTeam].saves++;
                this.pushEvent('save', defTeam, gk?.id || '', gk?.name || '门将', b.pos, `🛡️【传奇护盾】${gk?.name || '后卫与门将'} 门线极限化解必进球！`, undefined, 'important');
                if (this.hasUserAspect('clear_counter_stack')) {
                    this.state.aspectStacks.counterCharges = Math.min(this.getCounterCap(), this.state.aspectStacks.counterCharges + 1);
                }
                if (gk)
                    this.giveBallTo(gk);
                else {
                    b.mode = 'loose';
                    b.lastTouchTeam = defTeam;
                }
                return;
            }
            // 进球！
            if (shooter)
                shooter.matchStats.goals++;
            this.state.stats[shootTeam].goals++;
            if (shootTeam === 'home')
                this.state.homeScore++;
            else
                this.state.awayScore++;
            // 助攻统计（如果上一脚传球在 6 秒内且同队）
            let assisterName;
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
                const trailingBefore = (shootTeam === 'home' && this.state.homeScore - 1 < this.state.awayScore) ||
                    (shootTeam === 'away' && this.state.awayScore - 1 < this.state.homeScore);
                if (trailingBefore)
                    this.tryRevealHiddenTrait(shooter, '逆转王');
                if (shooter.subbedIn)
                    this.tryRevealHiddenTrait(shooter, '超级替补');
                if (this.state.minute >= 70)
                    this.tryRevealHiddenTrait(shooter, '大赛先生');
            }
            const concedeTeam = shootTeam === 'home' ? 'away' : 'home';
            this.setupKickoff(concedeTeam);
        }
        else {
            // 门将扑救
            if (gk)
                gk.matchStats.saves++;
            this.state.stats[defTeam].saves++;
            const svc = this.commentary.formatSave(defTeam, gk?.name || '门将', shooter?.name || '前锋', this.state.minute);
            this.pushEvent('save', defTeam, gk?.id || '', gk?.name || '门将', b.pos, svc.text, undefined, svc.level);
            // 大雨天扑救后脱手形成角球的概率略微提升（28% -> 38%）
            const cornerProb = this.state.weather === 'rain' ? 0.38 : 0.28;
            if (Math.random() < cornerProb) {
                this.state.stats[shootTeam].corners++;
                const cornerX = crossedLeft ? 1 : types_1.PITCH.LENGTH - 1;
                const cornerY = b.pos.y < types_1.PITCH.HALF_Y ? 1 : types_1.PITCH.WIDTH - 1;
                const cc = this.commentary.formatCorner(shootTeam, this.state.minute);
                this.pushEvent('corner', shootTeam, '', '', { x: cornerX, y: cornerY }, cc.text, undefined, cc.level);
                this.setDeadBall(shootTeam, 'corner', { x: cornerX, y: cornerY }, 5);
            }
            else if (gk) {
                this.giveBallTo(gk);
            }
        }
    }
    handleLooseBall() {
        const b = this.state.ball;
        if (this.checkOutOfBounds())
            return;
        const nearest = this.state.players
            .filter(p => !p.redCard && p.stunTicks === 0)
            .sort((a, b2) => (0, physics_1.dist2D)(a.pos, b.pos) - (0, physics_1.dist2D)(b2.pos, b.pos))[0];
        if (nearest && (0, physics_1.dist2D)(nearest.pos, b.pos) < 1.65 && b.pos.z < 2.0) {
            this.giveBallTo(nearest);
        }
    }
    checkOutOfBounds() {
        const b = this.state.ball;
        const oppTeam = b.lastTouchTeam === 'home' ? 'away' : 'home';
        if (b.pos.y <= 0.4 || b.pos.y >= types_1.PITCH.WIDTH - 0.4) {
            const y = b.pos.y <= 0.4 ? 1 : types_1.PITCH.WIDTH - 1;
            this.setDeadBall(oppTeam, 'throw', { x: (0, formations_1.clamp)(b.pos.x, 2, types_1.PITCH.LENGTH - 2), y }, 4);
            return true;
        }
        if (b.pos.x <= 0.4 || b.pos.x >= types_1.PITCH.LENGTH - 0.4) {
            // 简单按最后触球方区分角球或球门球
            const homeDefendsLeft = this.state.homeAttackDir === 1;
            const defendingAtEnd = (b.pos.x <= 0.4 && homeDefendsLeft) || (b.pos.x >= types_1.PITCH.LENGTH - 0.4 && !homeDefendsLeft)
                ? 'home'
                : 'away';
            const attackingAtEnd = defendingAtEnd === 'home' ? 'away' : 'home';
            if (b.lastTouchTeam === defendingAtEnd) {
                this.state.stats[attackingAtEnd].corners++;
                const cx = b.pos.x <= 0.4 ? 1 : types_1.PITCH.LENGTH - 1;
                const cy = b.pos.y < types_1.PITCH.HALF_Y ? 1 : types_1.PITCH.WIDTH - 1;
                this.setDeadBall(attackingAtEnd, 'corner', { x: cx, y: cy }, 5);
            }
            else {
                const gx = b.pos.x <= 0.4 ? 5.5 : types_1.PITCH.LENGTH - 5.5;
                this.setDeadBall(defendingAtEnd, 'goalkick', { x: gx, y: types_1.PITCH.GOAL_Y }, 5);
            }
            return true;
        }
        return false;
    }
    handleFoul(fouler, victim) {
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
        const victimRelX = (0, formations_1.toRelativeX)(victim.pos.x, victimDir);
        const inPenaltyBox = victimRelX >= types_1.PITCH.LENGTH - types_1.PITCH.PENALTY_BOX_DEPTH &&
            Math.abs(victim.pos.y - types_1.PITCH.GOAL_Y) <= types_1.PITCH.PENALTY_BOX_HALF_W;
        if (inPenaltyBox) {
            this.pushEvent('commentary', victim.team, victim.id, victim.name, victim.pos, `⚖️ 禁区内放倒 ${victim.name}，主裁判果断判罚点球！`, undefined, 'important');
            this.setDeadBall(victim.team, 'penalty', victim.pos, 6);
        }
        else {
            this.setDeadBall(victim.team, 'freekick', victim.pos, 5);
        }
    }
    setDeadBall(team, type, pos, delayTicks) {
        this.clearHolder();
        const b = this.state.ball;
        b.mode = 'dead';
        b.restartTeam = team;
        b.restartType = type;
        b.restartPos = {
            x: (0, formations_1.clamp)(pos.x, 1.5, types_1.PITCH.LENGTH - 1.5),
            y: (0, formations_1.clamp)(pos.y, 1.5, types_1.PITCH.WIDTH - 1.5),
        };
        b.pos = { x: b.restartPos.x, y: b.restartPos.y, z: 0 };
        b.vel = { x: 0, y: 0, z: 0 };
        b.deadTimer = delayTicks;
    }
    tryRevealHiddenTrait(player, expectedTrait) {
        if (player.hiddenTrait !== expectedTrait)
            return;
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
        this.pushEvent('commentary', player.team, player.id, player.name, player.pos, `✨ 隐藏特质觉醒！${player.name} 触发解锁【${expectedTrait}】！`, undefined, 'important');
    }
    expireCommandBuffs() {
        const s = this.state;
        const clampAttr = (v) => Math.max(25, Math.min(99, v));
        for (let i = s.activeBuffs.length - 1; i >= 0; i--) {
            const b = s.activeBuffs[i];
            if (s.minute >= b.endMinute) {
                const c = b.effect;
                const targetLine = c.targetLine ?? 'ALL';
                for (const p of s.players) {
                    if (p.team !== b.team || p.redCard)
                        continue;
                    const matchLine = targetLine === 'ALL' || this.getPlayerLine(p.role) === targetLine;
                    if (matchLine) {
                        if (c.passingDelta)
                            p.attributes.passing = clampAttr(p.attributes.passing - c.passingDelta);
                        if (c.shootingDelta)
                            p.attributes.shooting = clampAttr(p.attributes.shooting - c.shootingDelta);
                        if (c.defendingDelta)
                            p.attributes.defending = clampAttr(p.attributes.defending - c.defendingDelta);
                        if (c.paceDelta)
                            p.attributes.pace = clampAttr(p.attributes.pace - c.paceDelta);
                        if (c.composureDelta)
                            p.attributes.composure = clampAttr(p.attributes.composure - c.composureDelta);
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
    drainFitness() {
        const ROLE_WORKLOAD = {
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
            if (p.redCard)
                continue;
            const style = p.team === 'home' ? this.state.homeStyle : this.state.awayStyle;
            const formation = p.team === 'home' ? this.state.homeFormation : this.state.awayFormation;
            const defSys = (0, formations_1.getDefenseSystem)(formation);
            const mods = p.team === 'home' ? this.homeMods : this.awayMods;
            const drainMul = (0, formations_1.clamp)(mods.staminaDrainMul ?? 1.0, 0.70, 1.0);
            const rawPress = types_1.TACTICAL_PRESETS[style].pressIntensity;
            // 高位逼抢主要压榨中前场与边路；中卫线以整体前压为主，避免全队同速率掉血
            const styleDrain = style === 'gegenpress'
                ? (p.role === 'CB' ? 1.06 : p.role === 'GK' ? 1.0 : 1.18)
                : style === 'balanced'
                    ? (p.role === 'GK' ? 1.0 : 1.04)
                    : (p.role === 'GK' ? 1.0 : 0.7 + rawPress * 0.3);
            // 阵型负荷系数：三后卫翼卫与边卫跑动更重，五后卫中卫更省力，双中场比三中场更累
            let formFactor = 1.0;
            if (defSys === '3-back' && (p.role === 'LWB' || p.role === 'RWB' || p.role === 'CB')) {
                formFactor = 1.10;
            }
            else if (defSys === '5-back') {
                if (p.role === 'CB')
                    formFactor = 0.96;
                else if (p.role === 'LWB' || p.role === 'RWB')
                    formFactor = 1.08;
            }
            if ((formation === '4-4-2' || formation === '4-2-2-2') && (p.role === 'CM' || p.role === 'CDM')) {
                formFactor *= 1.08;
            }
            else if ((formation === '4-2-3-1' || formation === '4-1-4-1' || formation === '3-5-2') && (p.role === 'CM' || p.role === 'CDM')) {
                formFactor *= 0.94;
            }
            const staminaResist = 1.25 - (p.attributes.stamina / 99) * 0.5;
            const lungResist = p.goldTraits?.includes('铁肺覆盖') ? 0.40 : p.traits?.includes('铁肺覆盖') ? 0.60 : 1.0;
            let traitResist = lungResist;
            if (p.traits?.includes('体能充沛'))
                traitResist *= 0.70;
            const roleFactor = ROLE_WORKLOAD[p.role] ?? 0.48;
            const weatherDrain = this.state.weather === 'heat' && this.state.minute >= 60 ? 1.25 : 1.0;
            const strainDrain = p.strainWarning ? 1.28 : 1.0;
            p.fitness = Math.max(20, p.fitness - roleFactor * styleDrain * formFactor * staminaResist * traitResist * drainMul * weatherDrain * strainDrain);
        }
    }
    finalizeStats() {
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
        for (const side of ['home', 'away']) {
            const ts = s[side];
            ts.passAccuracy = ts.passes > 0 ? Math.round((ts.passesSuccess / ts.passes) * 100) : 0;
            ts.xG = Math.round(ts.xG * 100) / 100;
            const totalDistM = this.state.players
                .filter(p => p.team === side)
                .reduce((acc, p) => acc + p.matchStats.distanceM, 0);
            ts.distanceKm = Math.round((totalDistM / 1000) * 10) / 10;
        }
    }
    pushEvent(type, team, playerId, playerName, pos, text, xG, level, narrativeTag) {
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
exports.MatchEngine = MatchEngine;
