/**
 * 决策层：持球效用 AI + 鲜明战术风格驱动 + 无球接应/压迫协调
 */

import {
  AttackDir,
  BallState,
  PITCH,
  PlayerState,
  TACTICAL_PRESETS,
  TacticalMods,
  TacticalStyle,
  TeamSide,
  Vec2,
} from './types';
import { clamp, FORMATIONS, getDynamicAnchor, toRelativeX } from './formations';
import { dist2D } from './physics';
import {
  computeShotXG,
  evaluatePassCompletion,
  evaluateXT,
  getOffsideLineX,
} from './evaluator';

export type OnBallAction =
  | { type: 'shoot'; xG: number }
  | { type: 'pass'; target: PlayerState; passType: 'short' | 'through' | 'cross' | 'long' }
  | { type: 'dribble'; targetPos: Vec2 };

const WIDE_ROLES = new Set(['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'LWB', 'RWB']);

/**
 * 持球人效用决策：统一在预期收益下比较 射门 / 传球 / 盘带
 */
export function decideOnBall(
  holder: PlayerState,
  attackDir: AttackDir,
  style: TacticalStyle,
  players: PlayerState[],
  ball: BallState,
  mods?: TacticalMods
): OnBallAction {
  const preset = TACTICAL_PRESETS[style];
  const relX = toRelativeX(holder.pos.x, attackDir);
  const currentXT = evaluateXT(holder.pos, attackDir);

  // 门将持球：优先短传给禁区外/边路安全接应点，或长传找中前场（绝不往有对手逼抢的禁区内乱传）
  if (holder.role === 'GK') {
    const mates = players
      .filter(p => p.team === holder.team && p.id !== holder.id && !p.redCard)
      .sort((a, b) => dist2D(holder.pos, a.pos) - dist2D(holder.pos, b.pos));
    if (style === 'counter' || style === 'park_bus') {
      const forwardMate = mates.find(m => dist2D(holder.pos, m.pos) > 28) || mates[mates.length - 1] || mates[0];
      return { type: 'pass', target: forwardMate, passType: 'long' };
    }
    if (mods?.gkQuickLaunch) {
      const safeLong = mates.find(m => {
        const d = dist2D(holder.pos, m.pos);
        return d > 26 && d < 52 && evaluatePassCompletion(holder, m, players, true) > 0.62;
      });
      if (safeLong) return { type: 'pass', target: safeLong, passType: 'long' };
    }
    for (const m of mates) {
      const d = dist2D(holder.pos, m.pos);
      if (d < 10) continue; // 避免在禁区内极近距离短传造成弹球
      const oppNear = players.some(o => o.team !== holder.team && !o.redCard && dist2D(o.pos, m.pos) < 5);
      if (oppNear) continue;
      const prob = evaluatePassCompletion(holder, m, players, false);
      if (prob > 0.65) {
        return { type: 'pass', target: m, passType: d > 25 ? 'long' : 'short' };
      }
    }
    const forwardMate = mates[mates.length - 1] || mates[0];
    return { type: 'pass', target: forwardMate, passType: 'long' };
  }

  let bestScore = -Infinity;
  let bestAction: OnBallAction | null = null;

  // 1. 评估射门（门前 32m 内且有合理 xG 才进入竞争；远射解放可扩至 34m 并微调远射权重）
  const goalX = attackDir === 1 ? PITCH.LENGTH : 0;
  const distToGoal = dist2D(holder.pos, { x: goalX, y: PITCH.GOAL_Y });
  const longShotDelta = clamp(mods?.longShotBias ?? 0, -0.10, 0.14);
  const maxShootDist = longShotDelta > 0.03 ? 34 : 32;
  const minShootXG = style === 'tiki_taka' ? 0.025 : style === 'park_bus' ? 0.028 : 0.020;
  if (distToGoal < maxShootDist) {
    const xG = computeShotXG(holder, attackDir, players);
    const isWideAttacker = holder.role === 'LW' || holder.role === 'RW' || holder.role === 'LM' || holder.role === 'RM';
    const isAttacker =
      holder.role === 'ST' ||
      holder.role === 'CAM' ||
      isWideAttacker ||
      (holder.role === 'CM' && relX > 62);
    const roleShootMul = isAttacker ? 1.28 : 0.92;
    const boxBonus = distToGoal < 20 ? 0.28 : 0;
    // 战术驱动内切起脚：传控渗透/高位逼抢下边锋内切射门意愿高，两翼齐飞侧重传中但近门也可内切
    const wingCutInBonus =
      isWideAttacker && relX >= 66
        ? style === 'tiki_taka' ? 0.22
        : style === 'gegenpress' ? 0.18
        : style === 'counter' ? 0.16
        : style === 'wing_play' ? 0.08
        : 0.14
        : 0;
    const midCrashBonus =
      (holder.role === 'CM' || holder.role === 'CDM') && relX >= 68 && (style === 'tiki_taka' || style === 'gegenpress')
        ? 0.12
        : 0;
    const longShotMod = distToGoal >= 18 ? longShotDelta : 0;
    const dutyShootBonus =
      holder.duty === 'poacher' ? 0.20 :
      holder.duty === 'inside_forward' ? 0.16 :
      holder.duty === 'target_man' ? 0.10 :
      holder.duty === 'false_nine' || holder.duty === 'regista' ? -0.10 : 0;
    const shootScore = (0.40 + xG * 3.6 + boxBonus) * preset.shootBias * roleShootMul + longShotMod + wingCutInBonus + midCrashBonus + dutyShootBonus;
    if (xG >= minShootXG && shootScore > bestScore) {
      bestScore = shootScore;
      bestAction = { type: 'shoot', xG };
    }
  }

  // 2. 评估传球给每名未明显越位的队友
  const offsideX = getOffsideLineX(holder.team, attackDir, players);
  const teammates = players.filter(
    p => p.team === holder.team && p.id !== holder.id && !p.redCard
  );

  for (const mate of teammates) {
    const isDeepOffside =
      mate.role !== 'GK' &&
      (attackDir === 1 ? mate.pos.x > offsideX + 2.2 : mate.pos.x < offsideX - 2.2);
    if (isDeepOffside) continue;

    const d = dist2D(holder.pos, mate.pos);
    if (d < 3.5) continue;

    const mateRelX = toRelativeX(mate.pos.x, attackDir);
    const crossMinX = style === 'wing_play' || (mods?.crossBias ?? 0) > 0.03 ? 60 : 66;
    const crossMateMinX = style === 'wing_play' || (mods?.crossBias ?? 0) > 0.03 ? 72 : 78;
    const isCross =
      relX > crossMinX &&
      (holder.pos.y < 20 || holder.pos.y > PITCH.WIDTH - 20) &&
      Math.abs(mate.pos.y - PITCH.HALF_Y) < 18 &&
      mateRelX > crossMateMinX;
    const isThrough =
      mateRelX - relX > 10 &&
      mateRelX > 58 &&
      d > 13;
    const passType: 'short' | 'through' | 'cross' | 'long' =
      isCross ? 'cross' : isThrough ? 'through' : d > 26 ? 'long' : 'short';

    const isLofted = passType === 'cross' || passType === 'long';
    const rawComp = evaluatePassCompletion(holder, mate, players, isLofted);
    const pComp = style === 'tiki_taka' && passType === 'short' ? Math.min(0.98, rawComp + 0.08) : rawComp;
    const mateXT = evaluateXT(mate.pos, attackDir);

    // 向前推进奖励 + 各风格鲜明传球偏好
    const progressGain = (mateRelX - relX) / 105;
    let styleBias = progressGain * (preset.directness - 0.35) * 0.32;

    if (style === 'tiki_taka') {
      if (relX < 74 && passType === 'short' && d < 22) styleBias += 0.16;
      if (passType === 'long') styleBias -= 0.20;
      if (isCross) styleBias -= 0.14;
      if (relX < 68 && mateRelX < relX && mateRelX > 32) styleBias += 0.05;
    } else if (style === 'wing_play') {
      const mateWide = mate.pos.y < 19 || mate.pos.y > PITCH.WIDTH - 19 || WIDE_ROLES.has(mate.role);
      if (relX < 56 && mateWide && mateRelX >= relX - 2) styleBias += 0.08;
      if (isCross) styleBias += 0.22;
      if (isCross && (holder.role === 'LB' || holder.role === 'RB' || holder.role === 'LWB' || holder.role === 'RWB')) styleBias += 0.10;
    } else if (style === 'counter') {
      if ((passType === 'through' || passType === 'long') && progressGain > 0.12) styleBias += 0.24;
      if (progressGain < 0) styleBias -= 0.14;
    } else if (style === 'park_bus') {
      if (relX < 40 && passType === 'long' && progressGain > 0.18) styleBias += 0.14;
      if (relX < 38 && passType === 'short' && progressGain <= 0) styleBias -= 0.10;
    } else if (style === 'gegenpress') {
      if (progressGain > 0.05 && (passType === 'through' || passType === 'short')) styleBias += 0.12;
      if (isCross) styleBias -= 0.06;
    }

    const crossMul = holder.goldTraits?.includes('精准传中') ? 2 : 1;
    const throughMul = holder.goldTraits?.includes('致命直塞') ? 2 : 1;
    const wingTraitBonus = isCross && holder.traits?.includes('精准传中') ? 0.10 * crossMul : 0;
    const throughTraitBonus = isThrough && holder.traits?.includes('致命直塞') ? 0.12 * throughMul : 0;
    const dutyPassBonus =
      (holder.duty === 'false_nine' || holder.duty === 'regista') && (passType === 'short' || passType === 'through') ? 0.12 :
      holder.duty === 'classic_winger' && isCross ? 0.15 :
      holder.duty === 'wing_back' && isCross ? 0.12 : 0;
    // 仅在推进与组织阶段应用传球偏好，避免在射门区压制起脚
    const passBiasScale = relX < 76 ? 1.0 : 0.25;
    const modPassBias = passBiasScale * (
      passType === 'through' ? clamp(mods?.throughPassBias ?? 0, -0.10, 0.14) :
      passType === 'cross' ? clamp(mods?.crossBias ?? 0, -0.10, 0.14) :
      passType === 'short' ? clamp(mods?.shortPassBias ?? 0, -0.10, 0.14) : 0
    );
    const antiPingPong = ball.lastPasserId === mate.id ? -0.10 : 0;
    const avoidGK = mate.role === 'GK' ? (style === 'tiki_taka' ? -0.06 : -0.16) : 0;

    const passScore =
      pComp * (mateXT + 0.14) -
      (1 - pComp) * 0.18 +
      styleBias +
      modPassBias +
      wingTraitBonus +
      throughTraitBonus +
      dutyPassBonus +
      antiPingPong +
      avoidGK;

    if (passScore > bestScore) {
      bestScore = passScore;
      bestAction = { type: 'pass', target: mate, passType };
    }
  }

  // 3. 评估盘带推进
  const dribbleStep = 8;
  const isWidePlayer = WIDE_ROLES.has(holder.role);
  const hugWingY =
    style === 'wing_play' && isWidePlayer && relX < 58
      ? (holder.pos.y < PITCH.HALF_Y ? -1.4 : 1.4)
      : isWidePlayer && relX >= 56 && (style === 'tiki_taka' || style === 'gegenpress' || style === 'balanced')
      ? (holder.pos.y < PITCH.HALF_Y ? 4.8 : -4.8)
      : isWidePlayer && relX >= 62
      ? (holder.pos.y < PITCH.HALF_Y ? 3.8 : -3.8)
      : holder.pos.y < 16
      ? 3.5
      : holder.pos.y > PITCH.WIDTH - 16
      ? -3.5
      : 0;
  const dribbleTarget: Vec2 = {
    x: clamp(holder.pos.x + attackDir * dribbleStep, 4, PITCH.LENGTH - 4),
    y: clamp(holder.pos.y + hugWingY + (Math.random() - 0.5) * 3, 4, PITCH.WIDTH - 4),
  };

  let nearestFrontOpp = 99;
  for (const opp of players) {
    if (opp.team === holder.team || opp.redCard) continue;
    const forwardDist = (opp.pos.x - holder.pos.x) * attackDir;
    const lateralDist = Math.abs(opp.pos.y - holder.pos.y);
    if (forwardDist > -1 && forwardDist < 10 && lateralDist < 4.5) {
      const d = dist2D(holder.pos, opp.pos);
      if (d < nearestFrontOpp) nearestFrontOpp = d;
    }
  }

  const dribbleXT = evaluateXT(dribbleTarget, attackDir);
  const dribbleSkill = holder.attributes.dribbling / 99;
  const spaceBonus = nearestFrontOpp > 7.5 ? 0.08 : nearestFrontOpp < 3.5 ? -0.22 : -0.05;
  const roleDribbleBias =
    holder.role === 'LW' || holder.role === 'RW' || holder.role === 'CAM' ||
    ((holder.role === 'LM' || holder.role === 'RM') && relX > 55)
      ? 0.05
      : holder.role === 'CB' || holder.role === 'CDM'
      ? -0.18
      : -0.08;
  const styleDribbleBias =
    style === 'tiki_taka' ? -0.08 :
    style === 'wing_play' && isWidePlayer ? 0.08 :
    style === 'counter' && relX > 45 && nearestFrontOpp > 6 ? 0.08 : 0;

  const dribbleScore =
    (currentXT * 0.35 + dribbleXT * 0.55) * (0.65 + dribbleSkill * 0.30) +
    spaceBonus +
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
export function updateOffBallTargets(
  players: PlayerState[],
  ball: BallState,
  homeDir: AttackDir,
  homeStyle: TacticalStyle,
  awayStyle: TacticalStyle,
  homeFormation: keyof typeof FORMATIONS,
  awayFormation: keyof typeof FORMATIONS,
  homeMods?: TacticalMods,
  awayMods?: TacticalMods
): void {
  const holder = ball.holderId ? players.find(p => p.id === ball.holderId) : null;
  const ballTeam: TeamSide | null = holder ? holder.team : ball.lastTouchTeam;

  // 1. 为防守方挑选逼抢球员（由战术 preset.pressDistance 与 pressIntensity 统一决定）
  const pressers = new Set<string>();
  const defendingTeam: TeamSide | null = ballTeam === 'home' ? 'away' : ballTeam === 'away' ? 'home' : null;
  if (defendingTeam) {
    const defDir: AttackDir = defendingTeam === 'home' ? homeDir : (homeDir === 1 ? -1 : 1);
    const defBallRelX = toRelativeX(ball.pos.x, defDir);
    const defStyle = defendingTeam === 'home' ? homeStyle : awayStyle;
    const defMods = defendingTeam === 'home' ? homeMods : awayMods;
    const preset = TACTICAL_PRESETS[defStyle];
    const pressDist = preset.pressDistance + clamp(defMods?.pressDistBonus ?? 0, 0, 8);
    const defPlayers = players
      .filter(p => {
        if (p.team !== defendingTeam || p.redCard || p.role === 'GK') return false;
        if (defStyle !== 'gegenpress' && defBallRelX < 46 && p.role === 'ST') return false;
        return true;
      })
      .sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos));

    if (defPlayers[0] && (dist2D(defPlayers[0].pos, ball.pos) < pressDist + 12 || ball.mode === 'loose')) {
      pressers.add(defPlayers[0].id);
    }
    if (defPlayers[1] && (preset.pressIntensity >= 1.1 || defMods?.extraPresser) && dist2D(defPlayers[1].pos, ball.pos) < pressDist + 4) {
      pressers.add(defPlayers[1].id);
    }
    if (defPlayers[2] && (defStyle === 'gegenpress' || defMods?.extraPresser) && dist2D(defPlayers[2].pos, ball.pos) < pressDist) {
      pressers.add(defPlayers[2].id);
    }
  } else {
    for (const side of ['home', 'away'] as TeamSide[]) {
      const nearest = players
        .filter(p => p.team === side && !p.redCard && p.role !== 'GK')
        .sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos))[0];
      if (nearest) pressers.add(nearest.id);
    }
  }

  // 2. 统一计算每名无球球员目标坐标（锚点 + 越位线空间边界 + 简洁前插）
  for (const p of players) {
    if (p.redCard || p.hasBall) continue;

    if (ball.mode === 'pass' && ball.targetPlayerId === p.id) {
      p.targetPos = {
        x: clamp(ball.pos.x + ball.vel.x * 0.25, 2, PITCH.LENGTH - 2),
        y: clamp(ball.pos.y + ball.vel.y * 0.25, 2, PITCH.WIDTH - 2),
      };
      continue;
    }

    if (pressers.has(p.id)) {
      const dir: AttackDir = p.team === 'home' ? homeDir : (homeDir === 1 ? -1 : 1);
      p.targetPos = {
        x: clamp(ball.pos.x - dir * 0.6, 2, PITCH.LENGTH - 2),
        y: clamp(ball.pos.y, 2, PITCH.WIDTH - 2),
      };
      continue;
    }

    const dir: AttackDir = p.team === 'home' ? homeDir : (homeDir === 1 ? -1 : 1);
    const style = p.team === 'home' ? homeStyle : awayStyle;
    const formation = p.team === 'home' ? homeFormation : awayFormation;
    const teamMods = p.team === 'home' ? homeMods : awayMods;
    const slots = FORMATIONS[formation];
    const slot = slots[p.slotIndex] || slots[0];
    const hasPossession = ballTeam === null ? null : ballTeam === p.team;

    const rawAnchor = getDynamicAnchor(slot, ball.pos, dir, hasPossession, style, formation, teamMods, p.duty);
    const offsideX = getOffsideLineX(p.team, dir, players);
    const ballLimitX = holder ? holder.pos.x : ball.pos.x;
    const onsideMaxX = dir === 1
      ? Math.max(offsideX - 1.6, ballLimitX - 0.5)
      : Math.min(offsideX + 1.6, ballLimitX + 0.5);
    const clampOnside = (x: number) =>
      p.role === 'GK' ? x : (dir === 1 ? Math.min(x, onsideMaxX) : Math.max(x, onsideMaxX));

    let tx = rawAnchor.x + (p.customOffset ? dir * p.customOffset.x : 0);
    let ty = rawAnchor.y + (p.customOffset ? p.customOffset.y : 0);

    // 持球进攻时：前场攻击手自然向高威胁空间前插（受越位线边界约束，无需额外脚本）
    if (hasPossession && holder) {
      const holderRelX = toRelativeX(holder.pos.x, dir);
      const isAttRole =
        p.role === 'ST' || p.role === 'CAM' || p.role === 'LW' || p.role === 'RW' ||
        p.role === 'LM' || p.role === 'RM' || ((teamMods?.boxCrashBonus ?? 0) > 0 && p.role === 'CM');
      if (isAttRole && holderRelX > 48) {
        tx += dir * 8;
        if (holderRelX > 66) {
          // 进攻三区适当向中路肋部靠拢争抢门前接应点
          const targetInwardY = style === 'wing_play' && (p.role === 'LW' || p.role === 'RW') && Math.abs(holder.pos.y - p.pos.y) < 16
            ? ty
            : PITCH.HALF_Y + (ty - PITCH.HALF_Y) * 0.55;
          ty = targetInwardY;
        }
      }
    }

    p.targetPos = {
      x: clamp(clampOnside(tx), 3, PITCH.LENGTH - 3),
      y: clamp(ty, 4, PITCH.WIDTH - 4),
    };
  }
}
