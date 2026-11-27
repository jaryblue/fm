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
import { clamp, FORMATIONS, getDefenseSystem, getDynamicAnchor, toRelativeX } from './formations';
import { dist2D } from './physics';
import {
  computeShotXG,
  evaluatePassCompletion,
  evaluateXT,
  getOffsideLineX,
} from './evaluator';

export type AttackPatternTag =
  | 'byline_cross'
  | 'early_cross'
  | 'cutback'
  | 'through_ball'
  | 'short_combo'
  | 'long_switch';

export type OnBallAction =
  | { type: 'shoot'; xG: number }
  | { type: 'pass'; target: PlayerState; passType: 'short' | 'through' | 'cross' | 'long'; patternTag?: AttackPatternTag }
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
    if (style === 'counter') {
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
    // 现代足球门将优先在 10~30m 内找中卫或空当边后卫短传出球（激活 CB 后场参与度）
    const nearBuildup = mates.filter(
      m => (m.role === 'CB' || m.role === 'LB' || m.role === 'RB' || m.role === 'LWB' || m.role === 'RWB') && dist2D(holder.pos, m.pos) <= 30
    );
    const orderedMates = [...nearBuildup, ...mates.filter(m => !nearBuildup.includes(m))];
    for (const m of orderedMates) {
      const d = dist2D(holder.pos, m.pos);
      if (d < 10) continue; // 避免在禁区内极近距离短传造成弹球
      const oppNear = players.some(o => o.team !== holder.team && !o.redCard && dist2D(o.pos, m.pos) < 5);
      if (oppNear) continue;
      const prob = evaluatePassCompletion(holder, m, players, false);
      if (prob > 0.62) {
        return { type: 'pass', target: m, passType: d > 25 ? 'long' : 'short', patternTag: 'short_combo' };
      }
    }
    const forwardMate = mates[mates.length - 1] || mates[0];
    return { type: 'pass', target: forwardMate, passType: 'long' };
  }

  let bestScore = -Infinity;
  let bestAction: OnBallAction | null = null;

  // 1. 评估射门（常态 27m 内才评估射门，远射特化可扩至 29m；禁区内强激励、20m+ 抑制盲目远射）
  const goalX = attackDir === 1 ? PITCH.LENGTH : 0;
  const distToGoal = dist2D(holder.pos, { x: goalX, y: PITCH.GOAL_Y });
  const longShotDelta = clamp(mods?.longShotBias ?? 0, -0.10, 0.14);
  const maxShootDist = longShotDelta > 0.03 ? 29 : 27;
  const minShootXG = 0.030;
  if (distToGoal < maxShootDist) {
    const xG = computeShotXG(holder, attackDir, players);
    const isWideAttacker = holder.role === 'LW' || holder.role === 'RW' || holder.role === 'LM' || holder.role === 'RM';
    const isMidCrasher = holder.role === 'CM' || holder.role === 'CDM';
    const isAttacker =
      holder.role === 'ST' ||
      holder.role === 'CAM' ||
      isWideAttacker ||
      (isMidCrasher && relX > 66);
    // 中卫除非门前近距离争顶/补射(<12m)，否则极少主动起脚远射
    const roleShootMul =
      holder.role === 'CB' ? (distToGoal < 12 ? 0.95 : 0.42) :
      isAttacker ? 1.24 : 0.85;
    const boxBonus =
      distToGoal < 12 ? 0.46 :
      distToGoal < 17 ? 0.34 :
      distToGoal < 21 ? 0.06 : -0.18;
    // 战术驱动内切起脚与边锋/边前卫肋部抢点射门
    const inCentralOrHalfSpace = Math.abs(holder.pos.y - PITCH.HALF_Y) < 20;
    const wingCutInBonus =
      isWideAttacker && relX >= 68 && inCentralOrHalfSpace
        ? style === 'tiki_taka' ? 0.34
        : style === 'gegenpress' ? 0.32
        : style === 'counter' ? 0.28
        : style === 'wing_play' ? 0.30
        : 0.28
        : isWideAttacker && relX >= 74 && !inCentralOrHalfSpace && style !== 'wing_play' && holder.role !== 'LM' && holder.role !== 'RM'
        ? -0.10
        : 0;
    const stBoxFinishBonus = holder.role === 'ST' && distToGoal < 19 ? 0.12 : 0;
    const midCrashBonus =
      (holder.role === 'CAM' || isMidCrasher) && relX >= 68
        ? (style === 'tiki_taka' || style === 'gegenpress' ? 0.34 : 0.26)
        : 0;
    const stSoloTrim = holder.role === 'ST' && distToGoal > 14 ? -0.10 : 0;
    const styleLongShotTrim =
      longShotDelta <= 0.04
        ? (style === 'tiki_taka' && distToGoal >= 17.5 ? -0.24 : style === 'gegenpress' && distToGoal >= 18.5 ? -0.18 : 0)
        : 0;
    const longShotMod = (distToGoal >= 18 ? longShotDelta : 0) + styleLongShotTrim;
    const dutyShootBonus =
      holder.duty === 'poacher' ? 0.20 :
      holder.duty === 'inside_forward' ? 0.22 :
      holder.duty === 'target_man' ? 0.10 :
      holder.duty === 'false_nine' || holder.duty === 'regista' ? -0.10 : 0;
    const shootScore = (0.20 + xG * 3.8 + boxBonus) * preset.shootBias * roleShootMul + longShotMod + wingCutInBonus + midCrashBonus + stSoloTrim + stBoxFinishBonus + dutyShootBonus;
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
    const holderWide = holder.pos.y < 19 || holder.pos.y > PITCH.WIDTH - 19;
    const crossMinX = style === 'wing_play' || (mods?.crossBias ?? 0) > 0.03 ? 58 : 63;
    const crossMateMinX = style === 'wing_play' || (mods?.crossBias ?? 0) > 0.03 ? 72 : 76;
    const isBylineCross =
      relX >= 83 &&
      holderWide &&
      Math.abs(mate.pos.y - PITCH.HALF_Y) < 16 &&
      mateRelX >= 84;
    const isEarlyCross =
      relX >= crossMinX &&
      relX < 83 &&
      holderWide &&
      Math.abs(mate.pos.y - PITCH.HALF_Y) < 18 &&
      mateRelX >= crossMateMinX &&
      mateRelX - relX >= 8;
    const isCross = isBylineCross || isEarlyCross;
    const isCutback =
      relX >= 82 &&
      holderWide &&
      mateRelX >= 74 &&
      mateRelX <= 88 &&
      Math.abs(mate.pos.y - PITCH.HALF_Y) < 16 &&
      mate.role !== 'CB' &&
      mate.role !== 'GK';
    const isThrough =
      !isCutback &&
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
      if (relX < 74 && passType === 'short' && d < 22) styleBias += progressGain > 0 ? 0.18 : 0.06;
      if (passType === 'long') styleBias -= 0.16;
      if (isCross) styleBias -= 0.12;
      if (relX > 66 && progressGain > 0.04 && passType === 'through') styleBias += 0.12;
    } else if (style === 'wing_play') {
      const mateWide = mate.pos.y < 19 || mate.pos.y > PITCH.WIDTH - 19 || WIDE_ROLES.has(mate.role);
      if (relX < 56 && mateWide && mateRelX >= relX - 2) styleBias += 0.08;
      if (isCross) styleBias += 0.22;
      if (isCross && (holder.role === 'LB' || holder.role === 'RB' || holder.role === 'LWB' || holder.role === 'RWB')) styleBias += 0.10;
    } else if (style === 'counter') {
      if ((passType === 'through' || passType === 'long') && progressGain > 0.12) styleBias += 0.24;
      if (progressGain < 0) styleBias -= 0.14;
    } else if (style === 'park_bus') {
      if (progressGain > 0.08) styleBias += 0.14;
      if (relX < 40 && passType === 'long' && progressGain > 0.18) styleBias += 0.12;
      if (relX < 44 && progressGain <= 0) styleBias -= 0.12;
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
    const antiPingPong = ball.lastPasserId === mate.id ? (relX >= 64 ? -0.26 : -0.14) : 0;
    const avoidGK = mate.role === 'GK' ? (style === 'tiki_taka' ? -0.06 : -0.16) : 0;
    // 激活中卫/边卫/中场后场传导枢纽，抑制后卫线直接越级长找 ST
    const isFBTarget = mate.role === 'LB' || mate.role === 'RB' || mate.role === 'LWB' || mate.role === 'RWB';
    const isBackBuildupHolder = holder.role === 'CB' || holder.role === 'CDM' || holder.role === 'CM';
    const fbOutletBonus =
      isFBTarget && relX < 62 && mateRelX >= relX - 6 && pComp > 0.60
        ? (isBackBuildupHolder ? 0.34 : 0.22)
        : (mate.role === 'CB' && relX < 56 && pComp > 0.68 ? 0.22 : 0) +
          ((mate.role === 'CM' || mate.role === 'CDM') && relX < 64 && mateRelX >= relX - 4 && pComp > 0.65 ? 0.14 : 0);
    const skipLinePenalty =
      (holder.role === 'CB' || holder.role === 'CDM') &&
      relX < 44 &&
      mate.role === 'ST' &&
      mateRelX > 66 &&
      style !== 'counter' &&
      style !== 'park_bus'
        ? -0.22
        : 0;

    // 前场三区(relX>=68)：豁免“下底倒三角回传”，鼓励下底传中、45°斜传与中路肋部穿插
    let finalThirdMod = 0;
    if (isCutback) {
      finalThirdMod = style === 'tiki_taka' || style === 'gegenpress' ? 0.40 : 0.34;
    } else if (relX >= 68) {
      const dxRel = mateRelX - relX;
      if (dxRel < -3.5) {
        finalThirdMod = -0.19;
      } else if (Math.abs(dxRel) <= 3.5 && mateRelX < 84) {
        finalThirdMod = style === 'tiki_taka' ? 0.05 : -0.13;
      } else if (dxRel > 4 && mateRelX >= 76) {
        finalThirdMod = 0.11;
      }
      if (isBylineCross) finalThirdMod += 0.34;
      else if (isEarlyCross) finalThirdMod += (style === 'counter' || style === 'park_bus' || style === 'wing_play' ? 0.28 : 0.16);
      if (isThrough && mateRelX >= 74) finalThirdMod += 0.10;
    }

    const passScore =
      pComp * (mateXT + 0.14) -
      (1 - pComp) * 0.18 +
      styleBias +
      modPassBias +
      wingTraitBonus +
      throughTraitBonus +
      dutyPassBonus +
      fbOutletBonus +
      skipLinePenalty +
      antiPingPong +
      avoidGK +
      finalThirdMod;

    const patternTag: AttackPatternTag =
      isBylineCross ? 'byline_cross' :
      isEarlyCross ? 'early_cross' :
      isCutback ? 'cutback' :
      isThrough ? 'through_ball' :
      passType === 'long' ? 'long_switch' : 'short_combo';

    if (passScore > bestScore) {
      bestScore = passScore;
      bestAction = { type: 'pass', target: mate, passType, patternTag };
    }
  }

  // 3. 评估盘带推进
  const dribbleStep = 8;
  const isWidePlayer = WIDE_ROLES.has(holder.role);
  const hugWingY =
    style === 'wing_play' && isWidePlayer && relX < 62
      ? (holder.pos.y < PITCH.HALF_Y ? -1.4 : 1.4)
      : isWidePlayer && relX >= 58 && (style === 'tiki_taka' || style === 'gegenpress' || style === 'balanced')
      ? (holder.pos.y < PITCH.HALF_Y ? 5.2 : -5.2)
      : isWidePlayer && relX >= 64
      ? (holder.pos.y < PITCH.HALF_Y ? 4.4 : -4.4)
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
  const spaceBonus = nearestFrontOpp > 7.5 ? 0.12 : nearestFrontOpp < 3.2 ? -0.22 : -0.01;
  const finalThirdDriveBonus = relX >= 62 && relX < 88 && nearestFrontOpp > 3.5 && holder.role !== 'CB' ? 0.12 : 0;
  const isFBHolder = holder.role === 'LB' || holder.role === 'RB' || holder.role === 'LWB' || holder.role === 'RWB';
  const roleDribbleBias =
    holder.role === 'LW' || holder.role === 'RW' || holder.role === 'CAM' ||
    ((holder.role === 'LM' || holder.role === 'RM' || isFBHolder) && relX < 74)
      ? (isFBHolder && nearestFrontOpp > 4.2 ? 0.15 : 0.08)
      : holder.role === 'CB' || holder.role === 'CDM'
      ? -0.18
      : -0.05;
  const styleDribbleBias =
    style === 'tiki_taka' ? -0.05 :
    style === 'wing_play' && isWidePlayer ? 0.10 :
    style === 'counter' && relX > 45 && nearestFrontOpp > 6 ? 0.10 : 0;

  const dribbleScore =
    (currentXT * 0.35 + dribbleXT * 0.58) * (0.68 + dribbleSkill * 0.30) +
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

  // 1. 为防守方挑选逼抢球员（分层防守：中后卫在禁区外且有协防时优先退守卡位，中场/边卫负责上抢）
  const pressers = new Set<string>();
  const defendingTeam: TeamSide | null = ballTeam === 'home' ? 'away' : ballTeam === 'away' ? 'home' : null;
  if (defendingTeam) {
    const defDir: AttackDir = defendingTeam === 'home' ? homeDir : (homeDir === 1 ? -1 : 1);
    const defBallRelX = toRelativeX(ball.pos.x, defDir);
    const defStyle = defendingTeam === 'home' ? homeStyle : awayStyle;
    const defForm = defendingTeam === 'home' ? homeFormation : awayFormation;
    const defMods = defendingTeam === 'home' ? homeMods : awayMods;
    const isLowBlock = defStyle === 'park_bus' || getDefenseSystem(defForm) === '5-back';
    const preset = TACTICAL_PRESETS[defStyle];
    const pressDist = preset.pressDistance + clamp(defMods?.pressDistBonus ?? 0, 0, 8);
    const defPlayers = players
      .filter(p => {
        if (p.team !== defendingTeam || p.redCard || p.role === 'GK') return false;
        if (defStyle !== 'gegenpress' && defBallRelX < 46 && p.role === 'ST') return false;
        return true;
      })
      .sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos));

    // 判断是否为应该“退守延阻”的最后防线中卫（18~46m 内中卫优先退守卡位，不迎面扑空）
    const shouldCBHold = (p: PlayerState): boolean => {
      if (p.role !== 'CB') return false;
      if (ball.mode === 'loose') return false;
      if (defBallRelX >= 18) return true;
      return false;
    };

    const primaryPresser = defPlayers.find(p => !shouldCBHold(p) && (dist2D(p.pos, ball.pos) < pressDist + 10 || ball.mode === 'loose'));
    if (primaryPresser) {
      pressers.add(primaryPresser.id);
    } else if (defPlayers[0] && (defBallRelX < 18 || ball.mode === 'loose')) {
      pressers.add(defPlayers[0].id);
    }

    const allowMultiPress = defBallRelX >= 48 || defStyle === 'gegenpress';
    const secondPresser = defPlayers.find(p => p.id !== primaryPresser?.id && !shouldCBHold(p));
    if (secondPresser && allowMultiPress && (preset.pressIntensity >= 1.1 || defMods?.extraPresser) && dist2D(secondPresser.pos, ball.pos) < pressDist + 3) {
      pressers.add(secondPresser.id);
    }
    const thirdPresser = defPlayers.find(p => !pressers.has(p.id) && p.role !== 'CB');
    if (thirdPresser && allowMultiPress && (defStyle === 'gegenpress' || defMods?.extraPresser) && dist2D(thirdPresser.pos, ball.pos) < pressDist) {
      pressers.add(thirdPresser.id);
    }
  } else {
    for (const side of ['home', 'away'] as TeamSide[]) {
      const nearest = players
        .filter(p => p.team === side && !p.redCard && p.role !== 'GK')
        .sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos))[0];
      if (nearest) pressers.add(nearest.id);
    }
  }

  // 2. 统一计算每名无球球员目标坐标（锚点 + 越位线空间边界 + 分层退守延阻 + 简洁前插）
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

    // 无球防守退守延阻（Jockey/Contain）：当球进入己方44m内，非上抢后卫/后腰卡在持球人与球门之间边退边防
    if (hasPossession === false && (p.role === 'CB' || p.role === 'CDM' || p.role === 'LB' || p.role === 'RB' || p.role === 'LWB' || p.role === 'RWB')) {
      const ballRelX = toRelativeX(ball.pos.x, dir);
      const myRelX = toRelativeX(p.pos.x, dir);
      if (ballRelX < 44 && dist2D(p.pos, ball.pos) < 18) {
        const jockeyGap = style === 'park_bus' || style === 'counter' ? 4.2 : 3.4;
        const jockeyX = dir === 1 ? Math.max(6, ball.pos.x - jockeyGap) : Math.min(PITCH.LENGTH - 6, ball.pos.x + jockeyGap);
        if (myRelX > ballRelX - 4.5) {
          tx = jockeyX;
          ty = ty * 0.45 + (ball.pos.y * 0.75 + PITCH.GOAL_Y * 0.25) * 0.55;
        }
      }
    }

    // 持球进攻时：前场攻击手自然向高威胁空间前插；边前卫/中前卫/翼卫斜插禁区肋部接应
    if (hasPossession && holder) {
      const holderRelX = toRelativeX(holder.pos.x, dir);
      const isCounterStyle = style === 'park_bus' || style === 'counter' || getDefenseSystem(formation) === '5-back';
      const triggerRelX = isCounterStyle ? 24 : 46;
      const isSingleStrikerForm = formation === '5-4-1' || formation === '4-1-4-1' || formation === '4-4-1-1';
      const isThreeBack = getDefenseSystem(formation) === '3-back';
      const isFB = p.role === 'LB' || p.role === 'RB';
      const sameFlankFB =
        isFB &&
        style !== 'park_bus' &&
        holderRelX > 54 &&
        ((p.role === 'LB' && holder.pos.y < PITCH.HALF_Y + 6) || (p.role === 'RB' && holder.pos.y > PITCH.HALF_Y - 6) || !!teamMods?.dualOverlap);
      const isAttRole =
        p.role === 'ST' || p.role === 'CAM' || p.role === 'LW' || p.role === 'RW' ||
        p.role === 'LM' || p.role === 'RM' ||
        sameFlankFB ||
        ((isCounterStyle || style === 'wing_play' || isThreeBack) && (p.role === 'LWB' || p.role === 'RWB')) ||
        ((isSingleStrikerForm || style === 'balanced' || style === 'tiki_taka' || style === 'gegenpress' || isThreeBack || (teamMods?.boxCrashBonus ?? 0) > 0) && p.role === 'CM');
      if (isAttRole && holderRelX > triggerRelX) {
        tx += dir * (sameFlankFB ? 13 : isCounterStyle ? 12 : (p.role === 'CAM' || p.role === 'LW' || p.role === 'RW') ? 12 : (p.role === 'LM' || p.role === 'RM' || p.role === 'CM') ? 13 : 8);
        if (holderRelX > 64) {
          // 进攻三区：持球侧边后卫沿边线套上，弱侧边锋/前腰/中前卫内收肋部与点球点接应倒三角/后点传中
          if (sameFlankFB) {
            ty = p.role === 'LB' ? Math.min(ty, 11) : Math.max(ty, PITCH.WIDTH - 11);
          } else {
            const isWeakWing = (p.role === 'LW' || p.role === 'RW') && Math.abs(holder.pos.y - p.pos.y) > 18;
            const shrink = isWeakWing || p.role === 'CAM' || p.role === 'CM' ? 0.34 : 0.44;
            ty = style === 'wing_play' && (p.role === 'LW' || p.role === 'RW') && Math.abs(holder.pos.y - p.pos.y) < 16
              ? ty
              : PITCH.HALF_Y + (ty - PITCH.HALF_Y) * shrink;
          }
        }
      }
    }

    p.targetPos = {
      x: clamp(clampOnside(tx), 3, PITCH.LENGTH - 3),
      y: clamp(ty, 4, PITCH.WIDTH - 4),
    };
  }
}
