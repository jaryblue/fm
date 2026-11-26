"use strict";
/**
 * 决策层：持球效用 AI + 鲜明战术风格驱动 + 无球接应/压迫协调
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideOnBall = decideOnBall;
exports.updateOffBallTargets = updateOffBallTargets;
const types_1 = require("./types");
const formations_1 = require("./formations");
const physics_1 = require("./physics");
const evaluator_1 = require("./evaluator");
const WIDE_ROLES = new Set(['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'LWB', 'RWB']);
/**
 * 持球人效用决策：统一在预期收益下比较 射门 / 传球 / 盘带
 */
function decideOnBall(holder, attackDir, style, players, ball, mods) {
    const preset = types_1.TACTICAL_PRESETS[style];
    const relX = (0, formations_1.toRelativeX)(holder.pos.x, attackDir);
    const currentXT = (0, evaluator_1.evaluateXT)(holder.pos, attackDir);
    // 门将持球：优先短传给禁区外/边路安全接应点，或长传找中前场（绝不往有对手逼抢的禁区内乱传）
    if (holder.role === 'GK') {
        const mates = players
            .filter(p => p.team === holder.team && p.id !== holder.id && !p.redCard)
            .sort((a, b) => (0, physics_1.dist2D)(holder.pos, a.pos) - (0, physics_1.dist2D)(holder.pos, b.pos));
        if (style === 'counter') {
            const forwardMate = mates.find(m => (0, physics_1.dist2D)(holder.pos, m.pos) > 28) || mates[mates.length - 1] || mates[0];
            return { type: 'pass', target: forwardMate, passType: 'long' };
        }
        if (mods?.gkQuickLaunch) {
            const safeLong = mates.find(m => {
                const d = (0, physics_1.dist2D)(holder.pos, m.pos);
                return d > 26 && d < 52 && (0, evaluator_1.evaluatePassCompletion)(holder, m, players, true) > 0.62;
            });
            if (safeLong)
                return { type: 'pass', target: safeLong, passType: 'long' };
        }
        for (const m of mates) {
            const d = (0, physics_1.dist2D)(holder.pos, m.pos);
            if (d < 10)
                continue; // 避免在禁区内极近距离短传造成弹球
            const oppNear = players.some(o => o.team !== holder.team && !o.redCard && (0, physics_1.dist2D)(o.pos, m.pos) < 5);
            if (oppNear)
                continue;
            const prob = (0, evaluator_1.evaluatePassCompletion)(holder, m, players, false);
            if (prob > 0.65) {
                return { type: 'pass', target: m, passType: d > 25 ? 'long' : 'short' };
            }
        }
        const forwardMate = mates[mates.length - 1] || mates[0];
        return { type: 'pass', target: forwardMate, passType: 'long' };
    }
    let bestScore = -Infinity;
    let bestAction = null;
    // 1. 评估射门（常态 27m 内才评估射门，远射特化可扩至 29m；禁区内强激励、20m+ 抑制盲目远射）
    const goalX = attackDir === 1 ? types_1.PITCH.LENGTH : 0;
    const distToGoal = (0, physics_1.dist2D)(holder.pos, { x: goalX, y: types_1.PITCH.GOAL_Y });
    const longShotDelta = (0, formations_1.clamp)(mods?.longShotBias ?? 0, -0.10, 0.14);
    const maxShootDist = longShotDelta > 0.03 ? 29 : 27;
    const minShootXG = 0.030;
    if (distToGoal < maxShootDist) {
        const xG = (0, evaluator_1.computeShotXG)(holder, attackDir, players);
        const isWideAttacker = holder.role === 'LW' || holder.role === 'RW' || holder.role === 'LM' || holder.role === 'RM';
        const isMidCrasher = holder.role === 'CM' || holder.role === 'CDM';
        const isAttacker = holder.role === 'ST' ||
            holder.role === 'CAM' ||
            isWideAttacker ||
            (isMidCrasher && relX > 66);
        // 中卫除非门前近距离争顶/补射(<12m)，否则极少主动起脚远射
        const roleShootMul = holder.role === 'CB' ? (distToGoal < 12 ? 0.95 : 0.42) :
            isAttacker ? 1.24 : 0.85;
        const boxBonus = distToGoal < 12 ? 0.46 :
            distToGoal < 17 ? 0.34 :
                distToGoal < 21 ? 0.06 : -0.18;
        // 战术驱动内切起脚与中场后插上射门
        const wingCutInBonus = isWideAttacker && relX >= 68
            ? style === 'tiki_taka' ? 0.24
                : style === 'gegenpress' ? 0.22
                    : style === 'counter' ? 0.20
                        : style === 'wing_play' ? 0.14
                            : 0.18
            : 0;
        const midCrashBonus = isMidCrasher && relX >= 70
            ? (style === 'tiki_taka' || style === 'gegenpress' ? 0.22 : 0.14)
            : 0;
        const longShotMod = distToGoal >= 18 ? longShotDelta : 0;
        const dutyShootBonus = holder.duty === 'poacher' ? 0.20 :
            holder.duty === 'inside_forward' ? 0.18 :
                holder.duty === 'target_man' ? 0.10 :
                    holder.duty === 'false_nine' || holder.duty === 'regista' ? -0.10 : 0;
        const shootScore = (0.20 + xG * 3.8 + boxBonus) * preset.shootBias * roleShootMul + longShotMod + wingCutInBonus + midCrashBonus + dutyShootBonus;
        if (xG >= minShootXG && shootScore > bestScore) {
            bestScore = shootScore;
            bestAction = { type: 'shoot', xG };
        }
    }
    // 2. 评估传球给每名未明显越位的队友
    const offsideX = (0, evaluator_1.getOffsideLineX)(holder.team, attackDir, players);
    const teammates = players.filter(p => p.team === holder.team && p.id !== holder.id && !p.redCard);
    for (const mate of teammates) {
        const isDeepOffside = mate.role !== 'GK' &&
            (attackDir === 1 ? mate.pos.x > offsideX + 2.2 : mate.pos.x < offsideX - 2.2);
        if (isDeepOffside)
            continue;
        const d = (0, physics_1.dist2D)(holder.pos, mate.pos);
        if (d < 3.5)
            continue;
        const mateRelX = (0, formations_1.toRelativeX)(mate.pos.x, attackDir);
        const crossMinX = style === 'wing_play' || (mods?.crossBias ?? 0) > 0.03 ? 60 : 66;
        const crossMateMinX = style === 'wing_play' || (mods?.crossBias ?? 0) > 0.03 ? 72 : 78;
        const isCross = relX > crossMinX &&
            (holder.pos.y < 20 || holder.pos.y > types_1.PITCH.WIDTH - 20) &&
            Math.abs(mate.pos.y - types_1.PITCH.HALF_Y) < 18 &&
            mateRelX > crossMateMinX;
        const isThrough = mateRelX - relX > 10 &&
            mateRelX > 58 &&
            d > 13;
        const passType = isCross ? 'cross' : isThrough ? 'through' : d > 26 ? 'long' : 'short';
        const isLofted = passType === 'cross' || passType === 'long';
        const rawComp = (0, evaluator_1.evaluatePassCompletion)(holder, mate, players, isLofted);
        const pComp = style === 'tiki_taka' && passType === 'short' ? Math.min(0.98, rawComp + 0.08) : rawComp;
        const mateXT = (0, evaluator_1.evaluateXT)(mate.pos, attackDir);
        // 向前推进奖励 + 各风格鲜明传球偏好
        const progressGain = (mateRelX - relX) / 105;
        let styleBias = progressGain * (preset.directness - 0.35) * 0.32;
        if (style === 'tiki_taka') {
            if (relX < 74 && passType === 'short' && d < 22)
                styleBias += progressGain > 0 ? 0.18 : 0.06;
            if (passType === 'long')
                styleBias -= 0.16;
            if (isCross)
                styleBias -= 0.12;
            if (relX > 66 && progressGain > 0.04 && passType === 'through')
                styleBias += 0.12;
        }
        else if (style === 'wing_play') {
            const mateWide = mate.pos.y < 19 || mate.pos.y > types_1.PITCH.WIDTH - 19 || WIDE_ROLES.has(mate.role);
            if (relX < 56 && mateWide && mateRelX >= relX - 2)
                styleBias += 0.08;
            if (isCross)
                styleBias += 0.22;
            if (isCross && (holder.role === 'LB' || holder.role === 'RB' || holder.role === 'LWB' || holder.role === 'RWB'))
                styleBias += 0.10;
        }
        else if (style === 'counter') {
            if ((passType === 'through' || passType === 'long') && progressGain > 0.12)
                styleBias += 0.24;
            if (progressGain < 0)
                styleBias -= 0.14;
        }
        else if (style === 'park_bus') {
            if (progressGain > 0.08)
                styleBias += 0.14;
            if (relX < 40 && passType === 'long' && progressGain > 0.18)
                styleBias += 0.12;
            if (relX < 44 && progressGain <= 0)
                styleBias -= 0.12;
        }
        else if (style === 'gegenpress') {
            if (progressGain > 0.05 && (passType === 'through' || passType === 'short'))
                styleBias += 0.12;
            if (isCross)
                styleBias -= 0.06;
        }
        const crossMul = holder.goldTraits?.includes('精准传中') ? 2 : 1;
        const throughMul = holder.goldTraits?.includes('致命直塞') ? 2 : 1;
        const wingTraitBonus = isCross && holder.traits?.includes('精准传中') ? 0.10 * crossMul : 0;
        const throughTraitBonus = isThrough && holder.traits?.includes('致命直塞') ? 0.12 * throughMul : 0;
        const dutyPassBonus = (holder.duty === 'false_nine' || holder.duty === 'regista') && (passType === 'short' || passType === 'through') ? 0.12 :
            holder.duty === 'classic_winger' && isCross ? 0.15 :
                holder.duty === 'wing_back' && isCross ? 0.12 : 0;
        // 仅在推进与组织阶段应用传球偏好，避免在射门区压制起脚
        const passBiasScale = relX < 76 ? 1.0 : 0.25;
        const modPassBias = passBiasScale * (passType === 'through' ? (0, formations_1.clamp)(mods?.throughPassBias ?? 0, -0.10, 0.14) :
            passType === 'cross' ? (0, formations_1.clamp)(mods?.crossBias ?? 0, -0.10, 0.14) :
                passType === 'short' ? (0, formations_1.clamp)(mods?.shortPassBias ?? 0, -0.10, 0.14) : 0);
        const antiPingPong = ball.lastPasserId === mate.id ? (relX >= 64 ? -0.26 : -0.14) : 0;
        const avoidGK = mate.role === 'GK' ? (style === 'tiki_taka' ? -0.06 : -0.16) : 0;
        // 抑制前场三区(relX>=68)无意义来回横传与回传倒脚，鼓励渗透直塞与禁区接应
        let finalThirdMod = 0;
        if (relX >= 68) {
            const dxRel = mateRelX - relX;
            if (dxRel < -3.5) {
                finalThirdMod = -0.19;
            }
            else if (Math.abs(dxRel) <= 3.5 && mateRelX < 84) {
                finalThirdMod = style === 'tiki_taka' ? -0.05 : -0.13;
            }
            else if (dxRel > 4 && mateRelX >= 76) {
                finalThirdMod = 0.11;
            }
            if (isCross && mateRelX >= 76)
                finalThirdMod += 0.12;
            if (isThrough && mateRelX >= 74)
                finalThirdMod += 0.10;
        }
        const passScore = pComp * (mateXT + 0.14) -
            (1 - pComp) * 0.18 +
            styleBias +
            modPassBias +
            wingTraitBonus +
            throughTraitBonus +
            dutyPassBonus +
            antiPingPong +
            avoidGK +
            finalThirdMod;
        if (passScore > bestScore) {
            bestScore = passScore;
            bestAction = { type: 'pass', target: mate, passType };
        }
    }
    // 3. 评估盘带推进
    const dribbleStep = 8;
    const isWidePlayer = WIDE_ROLES.has(holder.role);
    const hugWingY = style === 'wing_play' && isWidePlayer && relX < 62
        ? (holder.pos.y < types_1.PITCH.HALF_Y ? -1.4 : 1.4)
        : isWidePlayer && relX >= 58 && (style === 'tiki_taka' || style === 'gegenpress' || style === 'balanced')
            ? (holder.pos.y < types_1.PITCH.HALF_Y ? 5.2 : -5.2)
            : isWidePlayer && relX >= 64
                ? (holder.pos.y < types_1.PITCH.HALF_Y ? 4.4 : -4.4)
                : holder.pos.y < 16
                    ? 3.5
                    : holder.pos.y > types_1.PITCH.WIDTH - 16
                        ? -3.5
                        : 0;
    const dribbleTarget = {
        x: (0, formations_1.clamp)(holder.pos.x + attackDir * dribbleStep, 4, types_1.PITCH.LENGTH - 4),
        y: (0, formations_1.clamp)(holder.pos.y + hugWingY + (Math.random() - 0.5) * 3, 4, types_1.PITCH.WIDTH - 4),
    };
    let nearestFrontOpp = 99;
    for (const opp of players) {
        if (opp.team === holder.team || opp.redCard)
            continue;
        const forwardDist = (opp.pos.x - holder.pos.x) * attackDir;
        const lateralDist = Math.abs(opp.pos.y - holder.pos.y);
        if (forwardDist > -1 && forwardDist < 10 && lateralDist < 4.5) {
            const d = (0, physics_1.dist2D)(holder.pos, opp.pos);
            if (d < nearestFrontOpp)
                nearestFrontOpp = d;
        }
    }
    const dribbleXT = (0, evaluator_1.evaluateXT)(dribbleTarget, attackDir);
    const dribbleSkill = holder.attributes.dribbling / 99;
    const spaceBonus = nearestFrontOpp > 7.5 ? 0.12 : nearestFrontOpp < 3.2 ? -0.22 : -0.01;
    const finalThirdDriveBonus = relX >= 62 && relX < 88 && nearestFrontOpp > 3.5 && holder.role !== 'CB' ? 0.12 : 0;
    const roleDribbleBias = holder.role === 'LW' || holder.role === 'RW' || holder.role === 'CAM' ||
        ((holder.role === 'LM' || holder.role === 'RM' || holder.role === 'LWB' || holder.role === 'RWB') && relX > 52)
        ? 0.08
        : holder.role === 'CB' || holder.role === 'CDM'
            ? -0.18
            : -0.05;
    const styleDribbleBias = style === 'tiki_taka' ? -0.05 :
        style === 'wing_play' && isWidePlayer ? 0.10 :
            style === 'counter' && relX > 45 && nearestFrontOpp > 6 ? 0.10 : 0;
    const dribbleScore = (currentXT * 0.35 + dribbleXT * 0.58) * (0.68 + dribbleSkill * 0.30) +
        spaceBonus +
        finalThirdDriveBonus +
        roleDribbleBias +
        styleDribbleBias;
    if (!bestAction || dribbleScore > bestScore) {
        bestAction = { type: 'dribble', targetPos: dribbleTarget };
    }
    return bestAction;
}
/**
 * 更新所有无球球员的移动目标
 */
function updateOffBallTargets(players, ball, homeDir, homeStyle, awayStyle, homeFormation, awayFormation, homeMods, awayMods) {
    const holder = ball.holderId ? players.find(p => p.id === ball.holderId) : null;
    const ballTeam = holder ? holder.team : ball.lastTouchTeam;
    // 1. 为防守方挑选逼抢球员（分层防守：中后卫在禁区外且有协防时优先退守卡位，中场/边卫负责上抢）
    const pressers = new Set();
    const defendingTeam = ballTeam === 'home' ? 'away' : ballTeam === 'away' ? 'home' : null;
    if (defendingTeam) {
        const defDir = defendingTeam === 'home' ? homeDir : (homeDir === 1 ? -1 : 1);
        const defBallRelX = (0, formations_1.toRelativeX)(ball.pos.x, defDir);
        const defStyle = defendingTeam === 'home' ? homeStyle : awayStyle;
        const defForm = defendingTeam === 'home' ? homeFormation : awayFormation;
        const defMods = defendingTeam === 'home' ? homeMods : awayMods;
        const isLowBlock = defStyle === 'park_bus' || (0, formations_1.getDefenseSystem)(defForm) === '5-back';
        const preset = types_1.TACTICAL_PRESETS[defStyle];
        const pressDist = preset.pressDistance + (0, formations_1.clamp)(defMods?.pressDistBonus ?? 0, 0, 8);
        const defPlayers = players
            .filter(p => {
            if (p.team !== defendingTeam || p.redCard || p.role === 'GK')
                return false;
            if (defStyle !== 'gegenpress' && defBallRelX < 46 && p.role === 'ST')
                return false;
            return true;
        })
            .sort((a, b) => (0, physics_1.dist2D)(a.pos, ball.pos) - (0, physics_1.dist2D)(b.pos, ball.pos));
        // 判断是否为应该“退守延阻”的最后防线中卫（18~46m 内中卫优先退守卡位，不迎面扑空）
        const shouldCBHold = (p) => {
            if (p.role !== 'CB')
                return false;
            if (ball.mode === 'loose')
                return false;
            if (defBallRelX >= 18)
                return true;
            return false;
        };
        const primaryPresser = defPlayers.find(p => !shouldCBHold(p) && ((0, physics_1.dist2D)(p.pos, ball.pos) < pressDist + 10 || ball.mode === 'loose'));
        if (primaryPresser) {
            pressers.add(primaryPresser.id);
        }
        else if (defPlayers[0] && (defBallRelX < 18 || ball.mode === 'loose')) {
            pressers.add(defPlayers[0].id);
        }
        const allowMultiPress = defBallRelX >= 48 || defStyle === 'gegenpress';
        const secondPresser = defPlayers.find(p => p.id !== primaryPresser?.id && !shouldCBHold(p));
        if (secondPresser && allowMultiPress && (preset.pressIntensity >= 1.1 || defMods?.extraPresser) && (0, physics_1.dist2D)(secondPresser.pos, ball.pos) < pressDist + 3) {
            pressers.add(secondPresser.id);
        }
        const thirdPresser = defPlayers.find(p => !pressers.has(p.id) && p.role !== 'CB');
        if (thirdPresser && allowMultiPress && (defStyle === 'gegenpress' || defMods?.extraPresser) && (0, physics_1.dist2D)(thirdPresser.pos, ball.pos) < pressDist) {
            pressers.add(thirdPresser.id);
        }
    }
    else {
        for (const side of ['home', 'away']) {
            const nearest = players
                .filter(p => p.team === side && !p.redCard && p.role !== 'GK')
                .sort((a, b) => (0, physics_1.dist2D)(a.pos, ball.pos) - (0, physics_1.dist2D)(b.pos, ball.pos))[0];
            if (nearest)
                pressers.add(nearest.id);
        }
    }
    // 2. 统一计算每名无球球员目标坐标（锚点 + 越位线空间边界 + 分层退守延阻 + 简洁前插）
    for (const p of players) {
        if (p.redCard || p.hasBall)
            continue;
        if (ball.mode === 'pass' && ball.targetPlayerId === p.id) {
            p.targetPos = {
                x: (0, formations_1.clamp)(ball.pos.x + ball.vel.x * 0.25, 2, types_1.PITCH.LENGTH - 2),
                y: (0, formations_1.clamp)(ball.pos.y + ball.vel.y * 0.25, 2, types_1.PITCH.WIDTH - 2),
            };
            continue;
        }
        if (pressers.has(p.id)) {
            const dir = p.team === 'home' ? homeDir : (homeDir === 1 ? -1 : 1);
            p.targetPos = {
                x: (0, formations_1.clamp)(ball.pos.x - dir * 0.6, 2, types_1.PITCH.LENGTH - 2),
                y: (0, formations_1.clamp)(ball.pos.y, 2, types_1.PITCH.WIDTH - 2),
            };
            continue;
        }
        const dir = p.team === 'home' ? homeDir : (homeDir === 1 ? -1 : 1);
        const style = p.team === 'home' ? homeStyle : awayStyle;
        const formation = p.team === 'home' ? homeFormation : awayFormation;
        const teamMods = p.team === 'home' ? homeMods : awayMods;
        const slots = formations_1.FORMATIONS[formation];
        const slot = slots[p.slotIndex] || slots[0];
        const hasPossession = ballTeam === null ? null : ballTeam === p.team;
        const rawAnchor = (0, formations_1.getDynamicAnchor)(slot, ball.pos, dir, hasPossession, style, formation, teamMods, p.duty);
        const offsideX = (0, evaluator_1.getOffsideLineX)(p.team, dir, players);
        const ballLimitX = holder ? holder.pos.x : ball.pos.x;
        const onsideMaxX = dir === 1
            ? Math.max(offsideX - 1.6, ballLimitX - 0.5)
            : Math.min(offsideX + 1.6, ballLimitX + 0.5);
        const clampOnside = (x) => p.role === 'GK' ? x : (dir === 1 ? Math.min(x, onsideMaxX) : Math.max(x, onsideMaxX));
        let tx = rawAnchor.x + (p.customOffset ? dir * p.customOffset.x : 0);
        let ty = rawAnchor.y + (p.customOffset ? p.customOffset.y : 0);
        // 无球防守退守延阻（Jockey/Contain）：当球进入己方44m内，非上抢后卫/后腰卡在持球人与球门之间边退边防
        if (hasPossession === false && (p.role === 'CB' || p.role === 'CDM' || p.role === 'LB' || p.role === 'RB' || p.role === 'LWB' || p.role === 'RWB')) {
            const ballRelX = (0, formations_1.toRelativeX)(ball.pos.x, dir);
            const myRelX = (0, formations_1.toRelativeX)(p.pos.x, dir);
            if (ballRelX < 44 && (0, physics_1.dist2D)(p.pos, ball.pos) < 18) {
                const jockeyGap = style === 'park_bus' || style === 'counter' ? 4.2 : 3.4;
                const jockeyX = dir === 1 ? Math.max(6, ball.pos.x - jockeyGap) : Math.min(types_1.PITCH.LENGTH - 6, ball.pos.x + jockeyGap);
                if (myRelX > ballRelX - 4.5) {
                    tx = jockeyX;
                    ty = ty * 0.45 + (ball.pos.y * 0.75 + types_1.PITCH.GOAL_Y * 0.25) * 0.55;
                }
            }
        }
        // 持球进攻时：前场攻击手自然向高威胁空间前插；边前卫/中前卫/翼卫斜插禁区肋部接应
        if (hasPossession && holder) {
            const holderRelX = (0, formations_1.toRelativeX)(holder.pos.x, dir);
            const isCounterStyle = style === 'park_bus' || style === 'counter' || (0, formations_1.getDefenseSystem)(formation) === '5-back';
            const triggerRelX = isCounterStyle ? 24 : 46;
            const isSingleStrikerForm = formation === '5-4-1' || formation === '4-1-4-1' || formation === '4-4-1-1';
            const isAttRole = p.role === 'ST' || p.role === 'CAM' || p.role === 'LW' || p.role === 'RW' ||
                p.role === 'LM' || p.role === 'RM' ||
                ((isCounterStyle || style === 'wing_play') && (p.role === 'LWB' || p.role === 'RWB')) ||
                ((isSingleStrikerForm || style === 'balanced' || style === 'tiki_taka' || (teamMods?.boxCrashBonus ?? 0) > 0) && p.role === 'CM');
            if (isAttRole && holderRelX > triggerRelX) {
                tx += dir * (isCounterStyle ? 12 : p.role === 'LM' || p.role === 'RM' || p.role === 'CM' ? 10 : 8);
                if (holderRelX > 64) {
                    // 进攻三区弱侧边路与中前卫向禁区肋部/后点靠拢争抢门前接应点
                    const targetInwardY = style === 'wing_play' && (p.role === 'LW' || p.role === 'RW') && Math.abs(holder.pos.y - p.pos.y) < 16
                        ? ty
                        : types_1.PITCH.HALF_Y + (ty - types_1.PITCH.HALF_Y) * 0.48;
                    ty = targetInwardY;
                }
            }
        }
        p.targetPos = {
            x: (0, formations_1.clamp)(clampOnside(tx), 3, types_1.PITCH.LENGTH - 3),
            y: (0, formations_1.clamp)(ty, 4, types_1.PITCH.WIDTH - 4),
        };
    }
}
