"use strict";

// ../../../WorkBuddy/fb2/fm-league/packages/engine/src/types.ts
var PITCH = {
  LENGTH: 105,
  WIDTH: 68,
  HALF_X: 52.5,
  HALF_Y: 34,
  GOAL_Y: 34,
  GOAL_HALF_WIDTH: 3.66,
  PENALTY_BOX_DEPTH: 16.5,
  PENALTY_BOX_HALF_W: 20.16,
  SIX_YARD_DEPTH: 5.5,
  PENALTY_SPOT: 11
};
var SIM_CONFIG = {
  TICK_DT: 0.1,
  // 每 tick 物理时间 0.1 秒 (10Hz)
  TICKS_PER_MINUTE: 30,
  // 30 ticks = 1 比赛分钟 (90分钟 = 2700 ticks)
  DECISION_INTERVAL: 3
  // 持球决策节拍：每 3 ticks (0.3s) 评估一次核心动作
};
var TACTICAL_PRESETS = {
  balanced: {
    name: "\u5747\u8861\u9635\u5730",
    lineHeight: 0,
    widthScale: 1,
    directness: 0.5,
    tempo: 1,
    pressDistance: 13,
    pressIntensity: 1,
    shootBias: 1
  },
  tiki_taka: {
    name: "\u4F20\u63A7\u6E17\u900F",
    lineHeight: 5,
    widthScale: 0.9,
    directness: 0.28,
    tempo: 1.15,
    pressDistance: 16,
    pressIntensity: 1.15,
    shootBias: 0.88
  },
  gegenpress: {
    name: "\u9AD8\u4F4D\u903C\u62A2",
    lineHeight: 8,
    widthScale: 1.02,
    directness: 0.6,
    tempo: 1.2,
    pressDistance: 20,
    pressIntensity: 1.38,
    shootBias: 1.08
  },
  counter: {
    name: "\u5FEB\u901F\u53CD\u51FB",
    lineHeight: -6,
    widthScale: 0.96,
    directness: 0.82,
    tempo: 1.08,
    pressDistance: 10,
    pressIntensity: 0.82,
    shootBias: 1.12
  },
  wing_play: {
    name: "\u4E24\u7FFC\u9F50\u98DE",
    lineHeight: 3,
    widthScale: 1.15,
    directness: 0.65,
    tempo: 1.05,
    pressDistance: 13,
    pressIntensity: 1,
    shootBias: 1.02
  },
  park_bus: {
    name: "\u94C1\u6876\u9632\u53CD",
    lineHeight: -7,
    widthScale: 0.9,
    directness: 0.85,
    tempo: 0.92,
    pressDistance: 12,
    pressIntensity: 0.85,
    shootBias: 0.98
  }
};

// ../../../WorkBuddy/fb2/fm-league/packages/engine/src/formations.ts
var FORMATIONS = {
  "4-4-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 24, baseY: 11 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 24, baseY: 57 },
    { role: "LM", baseX: 48, baseY: 11 },
    { role: "CM", baseX: 46, baseY: 27 },
    { role: "CM", baseX: 46, baseY: 41 },
    { role: "RM", baseX: 48, baseY: 57 },
    { role: "ST", baseX: 70, baseY: 26 },
    { role: "ST", baseX: 70, baseY: 42 }
  ],
  "4-3-3": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 24, baseY: 10 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 24, baseY: 58 },
    { role: "CDM", baseX: 38, baseY: 34 },
    { role: "CM", baseX: 52, baseY: 23 },
    { role: "CM", baseX: 52, baseY: 45 },
    { role: "LW", baseX: 68, baseY: 12 },
    { role: "ST", baseX: 73, baseY: 34 },
    { role: "RW", baseX: 68, baseY: 56 }
  ],
  "4-2-3-1": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 24, baseY: 10 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 24, baseY: 58 },
    { role: "CDM", baseX: 39, baseY: 26 },
    { role: "CDM", baseX: 39, baseY: 42 },
    { role: "LW", baseX: 58, baseY: 12 },
    { role: "CAM", baseX: 60, baseY: 34 },
    { role: "RW", baseX: 58, baseY: 56 },
    { role: "ST", baseX: 74, baseY: 34 }
  ],
  "3-5-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 20 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 48 },
    { role: "LWB", baseX: 44, baseY: 8 },
    { role: "CDM", baseX: 40, baseY: 34 },
    { role: "CM", baseX: 52, baseY: 24 },
    { role: "CM", baseX: 52, baseY: 44 },
    { role: "RWB", baseX: 44, baseY: 60 },
    { role: "ST", baseX: 71, baseY: 26 },
    { role: "ST", baseX: 71, baseY: 42 }
  ],
  "5-4-1": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LWB", baseX: 28, baseY: 9 },
    { role: "CB", baseX: 21, baseY: 21 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 21, baseY: 47 },
    { role: "RWB", baseX: 28, baseY: 59 },
    { role: "LM", baseX: 46, baseY: 13 },
    { role: "CM", baseX: 44, baseY: 27 },
    { role: "CM", baseX: 44, baseY: 41 },
    { role: "RM", baseX: 46, baseY: 55 },
    { role: "ST", baseX: 68, baseY: 34 }
  ]
};
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function toRelativeX(absX, dir) {
  return dir === 1 ? absX : PITCH.LENGTH - absX;
}
function toAbsoluteX(relX, dir) {
  return dir === 1 ? relX : PITCH.LENGTH - relX;
}
function getDynamicAnchor(slot, ballPos, dir, hasPossession, style) {
  const preset = TACTICAL_PRESETS[style];
  const relBallX = toRelativeX(ballPos.x, dir);
  const ballOffsetFromCenterY = ballPos.y - PITCH.HALF_Y;
  if (slot.role === "GK") {
    const gkRelX = clamp(3 + (relBallX < 30 ? (30 - relBallX) * 0.12 : 0), 2.5, 9);
    const gkY = clamp(PITCH.HALF_Y + ballOffsetFromCenterY * 0.22, 27, 41);
    return { x: toAbsoluteX(gkRelX, dir), y: gkY };
  }
  const ballShiftX = (relBallX - PITCH.HALF_X) * 0.52;
  let stateShiftX = 0;
  let compactX = 1;
  let widthFactor = preset.widthScale;
  if (hasPossession === true) {
    stateShiftX = 6 + preset.lineHeight * 0.6;
    compactX = 1.08;
    if (slot.role === "LB" || slot.role === "RB" || slot.role === "LWB" || slot.role === "RWB") {
      stateShiftX += 11;
    } else if (slot.role === "LW" || slot.role === "RW") {
      stateShiftX += 7;
    } else if (slot.role === "ST") {
      stateShiftX += 6;
    }
  } else if (hasPossession === false) {
    stateShiftX = -7 + preset.lineHeight * 0.8;
    compactX = 0.82;
    widthFactor *= 0.84;
  } else {
    stateShiftX = preset.lineHeight * 0.5;
    compactX = 0.95;
  }
  const relXCentered = 22 + (slot.baseX - 22) * compactX;
  const targetRelX = clamp(relXCentered + ballShiftX + stateShiftX, 11, 97);
  const baseOffsetY = slot.baseY - PITCH.HALF_Y;
  let roleWidthAdj = 1;
  if (hasPossession === true && (slot.role === "LW" || slot.role === "RW")) {
    roleWidthAdj = 0.86;
  }
  const ballPullY = hasPossession === false ? ballOffsetFromCenterY * 0.34 : ballOffsetFromCenterY * 0.18;
  const targetY = clamp(PITCH.HALF_Y + baseOffsetY * widthFactor * roleWidthAdj + ballPullY, 4, PITCH.WIDTH - 4);
  return {
    x: toAbsoluteX(targetRelX, dir),
    y: targetY
  };
}

// ../../../WorkBuddy/fb2/fm-league/packages/engine/src/physics.ts
var GRAVITY = 9.81;
function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function pointToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-6) return { dist: dist2D(p, a), t: 0 };
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq, 0, 1);
  const px = a.x + t * abx;
  const py = a.y + t * aby;
  return { dist: dist2D(p, { x: px, y: py }), t };
}
function launchPassBall(ball, from, to, passer, target, passType) {
  const d = Math.max(2, dist2D(from, to));
  const baseSpeed = passType === "short" ? 16 + Math.min(4, d * 0.15) : passType === "through" ? 21 : passType === "cross" ? 22 : 24;
  const flightTime = clamp(d / baseSpeed, 0.25, 2.2);
  const isLofted = passType === "long" || passType === "cross" || d > 26;
  const speedMul = isLofted ? 1 : 1.18;
  const accFactor = (100 - passer.attributes.passing) * 0.015;
  const errX = (Math.random() - 0.5) * accFactor * (d * 0.08);
  const errY = (Math.random() - 0.5) * accFactor * (d * 0.08);
  const tx = clamp(to.x + errX, 1.5, PITCH.LENGTH - 1.5);
  const ty = clamp(to.y + errY, 1.5, PITCH.WIDTH - 1.5);
  ball.mode = "pass";
  ball.holderId = null;
  ball.lastTouchTeam = passer.team;
  ball.lastPasserId = passer.id;
  ball.targetPlayerId = target.id;
  ball.passType = passType;
  ball.pos = { x: from.x, y: from.y, z: 0.15 };
  ball.vel = {
    x: (tx - from.x) / flightTime * speedMul,
    y: (ty - from.y) / flightTime * speedMul,
    z: isLofted ? 0.5 * GRAVITY * flightTime : 0
  };
}
function launchShotBall(ball, shooter, attackDir, xG, onTarget, targetY, targetZ) {
  const goalX = attackDir === 1 ? PITCH.LENGTH : 0;
  const d = Math.max(2, dist2D(shooter.pos, { x: goalX, y: targetY }));
  const shotSpeed = 26 + shooter.attributes.shooting / 99 * 8;
  const flightTime = clamp(d / shotSpeed, 0.15, 1.3);
  ball.mode = "shot";
  ball.holderId = null;
  ball.lastTouchTeam = shooter.team;
  ball.shotShooterId = shooter.id;
  ball.shotXG = xG;
  ball.shotOnTarget = onTarget;
  ball.shotTargetY = targetY;
  ball.shotTargetZ = targetZ;
  ball.pos = { x: shooter.pos.x, y: shooter.pos.y, z: 0.25 };
  ball.vel = {
    x: (goalX - shooter.pos.x) / flightTime,
    y: (targetY - shooter.pos.y) / flightTime,
    z: targetZ / flightTime + 0.5 * GRAVITY * flightTime * 0.35
  };
}
function stepBallPhysics(ball) {
  if (ball.mode === "dead" || ball.mode === "held") return;
  const dt = SIM_CONFIG.TICK_DT;
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  ball.pos.z += ball.vel.z * dt;
  if (ball.pos.z > 0.05 || ball.vel.z > 0) {
    ball.vel.z -= GRAVITY * dt;
    if (ball.pos.z <= 0) {
      ball.pos.z = 0;
      if (Math.abs(ball.vel.z) > 1.8) {
        ball.vel.z = -ball.vel.z * 0.42;
      } else {
        ball.vel.z = 0;
      }
      ball.vel.x *= 0.86;
      ball.vel.y *= 0.86;
    } else {
      ball.vel.x *= 0.99;
      ball.vel.y *= 0.99;
    }
  } else {
    ball.pos.z = 0;
    const drag = ball.mode === "pass" ? 0.955 : 0.92;
    ball.vel.x *= drag;
    ball.vel.y *= drag;
  }
  ball.pos.z = Math.max(0, ball.pos.z);
}
function stepPlayersPhysics(players, ball) {
  const dt = SIM_CONFIG.TICK_DT;
  for (const p of players) {
    if (p.redCard) continue;
    if (p.stunTicks > 0) {
      p.stunTicks--;
      p.vel.x *= 0.7;
      p.vel.y *= 0.7;
      continue;
    }
    if (p.decisionCooldown > 0) p.decisionCooldown--;
    const baseMaxSpeed = 6.2 + p.attributes.pace / 99 * 2.6;
    const fatigueFactor = 0.78 + p.fitness / 100 * 0.22;
    const ballCarryFactor = p.hasBall ? 0.88 : 1;
    const maxSpeed = baseMaxSpeed * fatigueFactor * ballCarryFactor;
    const dx = p.targetPos.x - p.pos.x;
    const dy = p.targetPos.y - p.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.35) {
      p.vel.x *= 0.6;
      p.vel.y *= 0.6;
    } else {
      const desiredSpeed = dist < 2 ? maxSpeed * (dist / 2) : maxSpeed;
      const desiredVx = dx / dist * desiredSpeed;
      const desiredVy = dy / dist * desiredSpeed;
      const accel = 0.42;
      p.vel.x += (desiredVx - p.vel.x) * accel;
      p.vel.y += (desiredVy - p.vel.y) * accel;
    }
    const oldX = p.pos.x;
    const oldY = p.pos.y;
    p.pos.x = clamp(p.pos.x + p.vel.x * dt, 0.8, PITCH.LENGTH - 0.8);
    p.pos.y = clamp(p.pos.y + p.vel.y * dt, 0.8, PITCH.WIDTH - 0.8);
    const moved = dist2D({ x: oldX, y: oldY }, p.pos);
    p.matchStats.distanceM += moved;
    if (p.hasBall && ball.mode === "held" && ball.holderId === p.id) {
      const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
      const leadX = speed > 0.5 ? p.vel.x / speed * 0.45 : 0;
      const leadY = speed > 0.5 ? p.vel.y / speed * 0.45 : 0;
      ball.pos.x = p.pos.x + leadX;
      ball.pos.y = p.pos.y + leadY;
      ball.pos.z = 0;
      ball.vel.x = p.vel.x;
      ball.vel.y = p.vel.y;
      ball.vel.z = 0;
    }
  }
}

// ../../../WorkBuddy/fb2/fm-league/packages/engine/src/evaluator.ts
function evaluateXT(pos, dir) {
  const relX = toRelativeX(pos.x, dir);
  const distFromCenterY = Math.abs(pos.y - PITCH.HALF_Y);
  let baseXT;
  if (relX < 35) {
    baseXT = 0.02 + relX / 35 * 0.05;
  } else if (relX < 70) {
    baseXT = 0.07 + (relX - 35) / 35 * 0.21;
  } else if (relX < 88) {
    baseXT = 0.28 + (relX - 70) / 18 * 0.34;
  } else {
    baseXT = 0.62 + (relX - 88) / 17 * 0.33;
  }
  const centralBonus = relX > 72 ? clamp(1 - distFromCenterY / 34 * 0.42, 0.58, 1) : clamp(1 - distFromCenterY / 34 * 0.14, 0.86, 1);
  return baseXT * centralBonus;
}
function getOffsideLineX(attackingTeam, attackDir, players) {
  const defenders = players.filter(
    (p) => p.team !== attackingTeam && !p.redCard
  );
  if (defenders.length < 2) return PITCH.HALF_X;
  const sorted = [...defenders].sort(
    (a, b) => attackDir === 1 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x
  );
  const secondLastX = sorted[1].pos.x;
  if (attackDir === 1) {
    return Math.max(PITCH.HALF_X, secondLastX);
  }
  return Math.min(PITCH.HALF_X, secondLastX);
}
function computeShotXG(shooter, attackDir, players) {
  const goalX = attackDir === 1 ? PITCH.LENGTH : 0;
  const dist = dist2D(shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
  if (dist > 34) return 4e-3;
  const p1 = { x: goalX, y: PITCH.GOAL_Y - PITCH.GOAL_HALF_WIDTH };
  const p2 = { x: goalX, y: PITCH.GOAL_Y + PITCH.GOAL_HALF_WIDTH };
  const a1 = Math.atan2(p1.y - shooter.pos.y, p1.x - shooter.pos.x);
  const a2 = Math.atan2(p2.y - shooter.pos.y, p2.x - shooter.pos.x);
  let angle = Math.abs(a2 - a1);
  if (angle > Math.PI) angle = 2 * Math.PI - angle;
  const distFactor = Math.exp(-dist / 11.5);
  const angleFactor = clamp(angle / 0.65, 0.22, 1.2);
  let xG = 0.52 * distFactor * angleFactor;
  let pressurePenalty = 1;
  for (const opp of players) {
    if (opp.team === shooter.team || opp.redCard || opp.role === "GK") continue;
    const dToShooter = dist2D(opp.pos, shooter.pos);
    if (dToShooter < 2.8) {
      pressurePenalty *= 0.72;
    } else {
      const seg = pointToSegment(opp.pos, shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
      if (seg.t > 0.05 && seg.t < 0.7 && seg.dist < 1.8) {
        pressurePenalty *= 0.8;
      }
    }
  }
  const skillFactor = 0.78 + (shooter.attributes.shooting * 0.65 + shooter.attributes.composure * 0.35) / 99 * 0.44;
  let traitMul = 1;
  if (dist < 16.5 && shooter.traits?.includes("\u7981\u533A\u72D0\u72F8")) traitMul *= 1.18;
  if (dist >= 18 && shooter.traits?.includes("\u8FDC\u5C04\u91CD\u70AE")) traitMul *= 1.25;
  xG = clamp(xG * pressurePenalty * skillFactor * traitMul, 8e-3, 0.68);
  return xG;
}
function evaluatePassCompletion(passer, target, players, isLofted) {
  const d = dist2D(passer.pos, target.pos);
  let prob = d < 12 ? 0.96 : d < 25 ? 0.96 - (d - 12) * 9e-3 : Math.max(0.5, 0.84 - (d - 25) * 0.012);
  let passerPressure = 0;
  let targetPressure = 0;
  let corridorRisk = 0;
  for (const opp of players) {
    if (opp.team === passer.team || opp.redCard) continue;
    const dp = dist2D(opp.pos, passer.pos);
    if (dp < 3) passerPressure += (3 - dp) * 0.05;
    const dt = dist2D(opp.pos, target.pos);
    if (dt < 4.5) targetPressure += (4.5 - dt) * 0.035;
    if (!isLofted) {
      const seg = pointToSegment(opp.pos, passer.pos, target.pos);
      if (seg.t > 0.12 && seg.t < 0.88 && seg.dist < 3.2) {
        corridorRisk += (3.2 - seg.dist) * 0.11;
      }
    }
  }
  const skillBonus = (passer.attributes.passing - 60) / 100 * 0.12;
  const traitPassBonus = (passer.traits?.includes("\u8282\u62CD\u5668") ? 0.05 : 0) + (isLofted && passer.traits?.includes("\u7CBE\u51C6\u957F\u4F20") ? 0.07 : 0);
  prob = prob + skillBonus + traitPassBonus - passerPressure - targetPressure - corridorRisk;
  return clamp(prob, 0.18, 0.97);
}

// ../../../WorkBuddy/fb2/fm-league/packages/engine/src/decision.ts
function decideOnBall(holder, attackDir, style, players, ball) {
  const preset = TACTICAL_PRESETS[style];
  const relX = toRelativeX(holder.pos.x, attackDir);
  const currentXT = evaluateXT(holder.pos, attackDir);
  if (holder.role === "GK") {
    const mates = players.filter((p) => p.team === holder.team && p.id !== holder.id && !p.redCard).sort((a, b) => dist2D(holder.pos, a.pos) - dist2D(holder.pos, b.pos));
    for (const m of mates) {
      const prob = evaluatePassCompletion(holder, m, players, false);
      if (prob > 0.72) {
        return { type: "pass", target: m, passType: dist2D(holder.pos, m.pos) > 25 ? "long" : "short" };
      }
    }
    const forwardMate = mates[mates.length - 1] || mates[0];
    return { type: "pass", target: forwardMate, passType: "long" };
  }
  let bestScore = -Infinity;
  let bestAction = null;
  const goalX = attackDir === 1 ? PITCH.LENGTH : 0;
  const distToGoal = dist2D(holder.pos, { x: goalX, y: PITCH.GOAL_Y });
  if (distToGoal < 32) {
    const xG = computeShotXG(holder, attackDir, players);
    const isAttacker = holder.role === "ST" || holder.role === "CAM" || holder.role === "LW" || holder.role === "RW";
    const roleShootMul = isAttacker ? 1.25 : 0.9;
    const shootScore = (0.38 + xG * 3.5) * preset.shootBias * roleShootMul;
    if (xG >= 0.022 && shootScore > bestScore) {
      bestScore = shootScore;
      bestAction = { type: "shoot", xG };
    }
  }
  const offsideX = getOffsideLineX(holder.team, attackDir, players);
  const teammates = players.filter(
    (p) => p.team === holder.team && p.id !== holder.id && !p.redCard
  );
  for (const mate of teammates) {
    const isDeepOffside = mate.role !== "GK" && (attackDir === 1 ? mate.pos.x > offsideX + 2.2 : mate.pos.x < offsideX - 2.2);
    if (isDeepOffside) continue;
    const d = dist2D(holder.pos, mate.pos);
    if (d < 3.5) continue;
    const mateRelX = toRelativeX(mate.pos.x, attackDir);
    const isCross = relX > 72 && (holder.pos.y < 16 || holder.pos.y > PITCH.WIDTH - 16) && Math.abs(mate.pos.y - PITCH.HALF_Y) < 16 && mateRelX > 82;
    const isThrough = mateRelX - relX > 12 && mateRelX > 65 && d > 14;
    const passType = isCross ? "cross" : isThrough ? "through" : d > 28 ? "long" : "short";
    const isLofted = passType === "cross" || passType === "long";
    const pComp = evaluatePassCompletion(holder, mate, players, isLofted);
    const mateXT = evaluateXT(mate.pos, attackDir);
    const progressGain = (mateRelX - relX) / 105;
    const directBonus = progressGain * (preset.directness - 0.35) * 0.28;
    const wingCrossBonus = (style === "wing_play" && isCross ? 0.18 : isCross ? 0.09 : 0) + (isCross && holder.traits?.includes("\u7CBE\u51C6\u4F20\u4E2D") ? 0.1 : 0);
    const throughTraitBonus = isThrough && holder.traits?.includes("\u81F4\u547D\u76F4\u585E") ? 0.12 : 0;
    const tikiShortBonus = style === "tiki_taka" && passType === "short" ? 0.08 : 0;
    const antiPingPong = ball.lastPasserId === mate.id ? -0.1 : 0;
    const avoidGK = mate.role === "GK" ? -0.14 : 0;
    const passScore = pComp * (mateXT + 0.14) - (1 - pComp) * 0.18 + directBonus + wingCrossBonus + throughTraitBonus + tikiShortBonus + antiPingPong + avoidGK;
    if (passScore > bestScore) {
      bestScore = passScore;
      bestAction = { type: "pass", target: mate, passType };
    }
  }
  const dribbleStep = 8;
  const cutInsideY = holder.pos.y < 16 ? 3.5 : holder.pos.y > PITCH.WIDTH - 16 ? -3.5 : 0;
  const dribbleTarget = {
    x: clamp(holder.pos.x + attackDir * dribbleStep, 4, PITCH.LENGTH - 4),
    y: clamp(holder.pos.y + cutInsideY + (Math.random() - 0.5) * 3, 4, PITCH.WIDTH - 4)
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
  const roleDribbleBias = holder.role === "LW" || holder.role === "RW" || holder.role === "CAM" ? 0.04 : holder.role === "CB" || holder.role === "CDM" ? -0.18 : -0.08;
  const dribbleScore = (currentXT * 0.35 + dribbleXT * 0.55) * (0.65 + dribbleSkill * 0.3) + spaceBonus + roleDribbleBias;
  if (!bestAction || dribbleScore > bestScore) {
    bestAction = { type: "dribble", targetPos: dribbleTarget };
  }
  return bestAction;
}
function updateOffBallTargets(players, ball, homeDir, homeStyle, awayStyle, homeFormation, awayFormation) {
  const holder = ball.holderId ? players.find((p) => p.id === ball.holderId) : null;
  const ballTeam = holder ? holder.team : ball.lastTouchTeam;
  const runners = /* @__PURE__ */ new Set();
  if (holder) {
    const attDir = holder.team === "home" ? homeDir : homeDir === 1 ? -1 : 1;
    const offsideX = getOffsideLineX(holder.team, attDir, players);
    const candidates = players.filter((p) => p.team === holder.team && p.id !== holder.id && !p.redCard && p.role !== "GK").sort((a, b) => dist2D(a.pos, holder.pos) - dist2D(b.pos, holder.pos));
    if (candidates[0]) runners.add(candidates[0].id);
    const forwardRunner = candidates.find(
      (p) => (p.role === "ST" || p.role === "LW" || p.role === "RW" || p.role === "CAM") && (attDir === 1 ? p.pos.x <= offsideX - 1.5 : p.pos.x >= offsideX + 1.5)
    );
    if (forwardRunner) runners.add(forwardRunner.id);
  }
  const pressers = /* @__PURE__ */ new Set();
  const defendingTeam = ballTeam === "home" ? "away" : ballTeam === "away" ? "home" : null;
  if (defendingTeam) {
    const defStyle = defendingTeam === "home" ? homeStyle : awayStyle;
    const preset = TACTICAL_PRESETS[defStyle];
    const defPlayers = players.filter((p) => p.team === defendingTeam && !p.redCard && p.role !== "GK").sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos));
    if (defPlayers[0] && (dist2D(defPlayers[0].pos, ball.pos) < preset.pressDistance + 12 || ball.mode === "loose")) {
      pressers.add(defPlayers[0].id);
    }
    if (defPlayers[1] && preset.pressIntensity >= 1.1 && dist2D(defPlayers[1].pos, ball.pos) < preset.pressDistance) {
      pressers.add(defPlayers[1].id);
    }
  } else {
    for (const side of ["home", "away"]) {
      const nearest = players.filter((p) => p.team === side && !p.redCard && p.role !== "GK").sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos))[0];
      if (nearest) pressers.add(nearest.id);
    }
  }
  for (const p of players) {
    if (p.redCard || p.hasBall) continue;
    if (ball.mode === "pass" && ball.targetPlayerId === p.id) {
      const predX = clamp(ball.pos.x + ball.vel.x * 0.25, 2, PITCH.LENGTH - 2);
      const predY = clamp(ball.pos.y + ball.vel.y * 0.25, 2, PITCH.WIDTH - 2);
      p.targetPos = { x: predX, y: predY };
      continue;
    }
    if (pressers.has(p.id)) {
      const dir2 = p.team === "home" ? homeDir : homeDir === 1 ? -1 : 1;
      p.targetPos = {
        x: clamp(ball.pos.x - dir2 * 0.6, 2, PITCH.LENGTH - 2),
        y: clamp(ball.pos.y, 2, PITCH.WIDTH - 2)
      };
      continue;
    }
    const dir = p.team === "home" ? homeDir : homeDir === 1 ? -1 : 1;
    const style = p.team === "home" ? homeStyle : awayStyle;
    const slots = p.team === "home" ? FORMATIONS[homeFormation] : FORMATIONS[awayFormation];
    const slot = slots[p.slotIndex] || slots[0];
    const hasPossession = ballTeam === null ? null : ballTeam === p.team;
    const anchor = getDynamicAnchor(slot, ball.pos, dir, hasPossession, style);
    if (hasPossession && runners.has(p.id) && holder) {
      const offsideX = getOffsideLineX(p.team, dir, players);
      if (p.role === "ST" || p.role === "LW" || p.role === "RW") {
        const safeForwardX = dir === 1 ? Math.min(anchor.x + 8, offsideX - 1.5) : Math.max(anchor.x - 8, offsideX + 1.5);
        p.targetPos = { x: clamp(safeForwardX, 5, PITCH.LENGTH - 5), y: anchor.y };
        continue;
      }
      p.targetPos = {
        x: clamp((anchor.x + holder.pos.x) * 0.5 + dir * 4, 5, PITCH.LENGTH - 5),
        y: clamp((anchor.y + holder.pos.y) * 0.5, 5, PITCH.WIDTH - 5)
      };
      continue;
    }
    p.targetPos = anchor;
  }
}

// ../../../WorkBuddy/fb2/fm-league/packages/engine/src/MatchEngine.ts
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
    distanceKm: 0
  };
}
var MatchEngine = class {
  constructor(home, away) {
    this.eventSeq = 0;
    this.stoppageTicksFirst = 0;
    this.stoppageTicksSecond = 0;
    this.lastPassTimestamp = -999;
    this.stoppageTicksFirst = Math.floor(Math.random() * 60);
    this.stoppageTicksSecond = 30 + Math.floor(Math.random() * 90);
    this.state = this.initState(home, away);
    this.setupKickoff("home");
  }
  initState(home, away) {
    const players = [];
    const buildTeam = (setup, team, dir) => {
      const slots = FORMATIONS[setup.formation];
      for (let i = 0; i < 11; i++) {
        const input = setup.players[i];
        const slot = slots[i];
        const absX = toAbsoluteX(slot.baseX, dir);
        players.push({
          id: input.id,
          name: input.name,
          team,
          role: slot.role,
          slotIndex: i,
          shirtNumber: input.shirtNumber,
          pos: { x: absX, y: slot.baseY },
          vel: { x: 0, y: 0 },
          targetPos: { x: absX, y: slot.baseY },
          attributes: { ...input.attributes },
          traits: input.traits ? [...input.traits] : [],
          fitness: input.fitness ?? 100,
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
            distanceM: 0
          }
        });
      }
    };
    buildTeam(home, "home", 1);
    buildTeam(away, "away", -1);
    return {
      tick: 0,
      minute: 0,
      phase: "first_half",
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
        mode: "dead",
        holderId: null,
        lastTouchTeam: "home",
        lastPasserId: null,
        targetPlayerId: null,
        passType: null,
        shotShooterId: null,
        shotXG: 0,
        shotOnTarget: false,
        shotTargetY: PITCH.GOAL_Y,
        shotTargetZ: 1,
        deadTimer: 0,
        restartTeam: "home",
        restartType: "kickoff",
        restartPos: { x: PITCH.HALF_X, y: PITCH.HALF_Y }
      },
      events: [],
      stats: {
        home: createEmptyStats(),
        away: createEmptyStats()
      }
    };
  }
  getState() {
    return this.state;
  }
  /**
   * 实时修改战术风格或阵型（支持玩家临场 Tactical Tweaks）
   */
  setTactics(team, formation, style) {
    if (team === "home") {
      if (formation) this.state.homeFormation = formation;
      if (style) this.state.homeStyle = style;
    } else {
      if (formation) this.state.awayFormation = formation;
      if (style) this.state.awayStyle = style;
    }
  }
  /**
   * 比赛日临场换人（每队最多 5 次）
   */
  substitute(team, outPlayerId, inSubId) {
    const s = this.state;
    const used = team === "home" ? s.homeSubsUsed : s.awaySubsUsed;
    if (used >= 5) return { ok: false, reason: "\u6362\u4EBA\u540D\u989D\u5DF2\u7528\u5B8C (5/5)" };
    const subs = team === "home" ? s.homeSubs : s.awaySubs;
    const subIdx = subs.findIndex((p) => p.id === inSubId);
    const outPlayer = s.players.find((p) => p.id === outPlayerId && p.team === team && !p.redCard);
    if (subIdx < 0 || !outPlayer) return { ok: false, reason: "\u65E0\u6548\u7684\u6362\u4EBA\u76EE\u6807" };
    const sub = subs.splice(subIdx, 1)[0];
    const wasHolding = s.ball.holderId === outPlayer.id;
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
      fitness: sub.fitness ?? 100,
      hasBall: wasHolding,
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
        distanceM: 0
      }
    };
    s.players[pIdx] = newPlayer;
    if (wasHolding) s.ball.holderId = newPlayer.id;
    if (team === "home") s.homeSubsUsed++;
    else s.awaySubsUsed++;
    this.pushEvent("substitution", team, newPlayer.id, newPlayer.name, newPlayer.pos, `\u{1F504} \u6362\u4EBA\uFF1A${newPlayer.name} \u66FF\u4E0B ${outPlayer.name}`);
    return { ok: true };
  }
  /**
   * 单步推进 1 个 tick (0.1s 物理时间)
   */
  step() {
    const s = this.state;
    if (s.phase === "full_time") return s;
    if (s.phase === "half_time") {
      this.startSecondHalf();
      return s;
    }
    s.tick++;
    s.minute = Math.min(95, Math.floor(s.tick / SIM_CONFIG.TICKS_PER_MINUTE));
    if (s.tick % SIM_CONFIG.TICKS_PER_MINUTE === 0) {
      this.drainFitness();
    }
    const firstHalfEnd = 45 * SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksFirst;
    const secondHalfEnd = firstHalfEnd + 45 * SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksSecond;
    if (s.phase === "first_half" && s.tick >= firstHalfEnd) {
      s.phase = "half_time";
      this.pushEvent("halftime", "home", "", "\u4E3B\u961F", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u534A\u573A\u7ED3\u675F");
      return s;
    }
    if (s.phase === "second_half" && s.tick >= secondHalfEnd) {
      s.phase = "full_time";
      this.finalizeStats();
      this.pushEvent("fulltime", "home", "", "\u4E3B\u961F", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u5168\u573A\u6BD4\u8D5B\u7ED3\u675F");
      return s;
    }
    updateOffBallTargets(
      s.players,
      s.ball,
      s.homeAttackDir,
      s.homeStyle,
      s.awayStyle,
      s.homeFormation,
      s.awayFormation
    );
    if (s.ball.mode === "dead") {
      this.handleDeadBall();
    } else if (s.ball.mode === "held") {
      this.handleHeldBall();
    } else if (s.ball.mode === "pass") {
      stepBallPhysics(s.ball);
      this.handlePassFlight();
    } else if (s.ball.mode === "shot") {
      stepBallPhysics(s.ball);
      this.handleShotFlight();
    } else if (s.ball.mode === "loose") {
      stepBallPhysics(s.ball);
      this.handleLooseBall();
    }
    stepPlayersPhysics(s.players, s.ball);
    const possTeam = this.getPossessionTeam();
    if (possTeam) {
      s.stats[possTeam].possessionTicks++;
    }
    return s;
  }
  /**
   * 一键跑完全场（Headless 批量模拟用）
   */
  simulateMatch() {
    while (this.state.phase !== "full_time") {
      this.step();
    }
    return this.state;
  }
  getAttackDir(team) {
    return team === "home" ? this.state.homeAttackDir : this.state.homeAttackDir === 1 ? -1 : 1;
  }
  getPossessionTeam() {
    const b = this.state.ball;
    if (b.holderId) {
      const h = this.state.players.find((p) => p.id === b.holderId);
      return h ? h.team : null;
    }
    return b.lastTouchTeam;
  }
  clearHolder() {
    for (const p of this.state.players) p.hasBall = false;
    this.state.ball.holderId = null;
  }
  giveBallTo(player) {
    this.clearHolder();
    player.hasBall = true;
    player.decisionCooldown = 1;
    const b = this.state.ball;
    b.mode = "held";
    b.holderId = player.id;
    b.lastTouchTeam = player.team;
    b.targetPlayerId = null;
    b.pos = { x: player.pos.x, y: player.pos.y, z: 0 };
    b.vel = { x: 0, y: 0, z: 0 };
  }
  setupKickoff(team) {
    this.clearHolder();
    for (const p of this.state.players) {
      if (p.redCard) continue;
      const dir = this.getAttackDir(p.team);
      const slots = p.team === "home" ? FORMATIONS[this.state.homeFormation] : FORMATIONS[this.state.awayFormation];
      const slot = slots[p.slotIndex];
      const safeRelX = Math.min(48, slot.baseX);
      p.pos = { x: toAbsoluteX(safeRelX, dir), y: slot.baseY };
      p.vel = { x: 0, y: 0 };
      p.targetPos = { ...p.pos };
    }
    const kicker = this.state.players.find((p) => p.team === team && !p.redCard && p.role === "ST") || this.state.players.find((p) => p.team === team && !p.redCard && p.role !== "GK");
    kicker.pos = { x: PITCH.HALF_X, y: PITCH.HALF_Y };
    this.giveBallTo(kicker);
    this.pushEvent("kickoff", team, kicker.id, kicker.name, kicker.pos, `${kicker.name} \u4E2D\u5708\u5F00\u7403`);
  }
  startSecondHalf() {
    this.state.phase = "second_half";
    this.state.homeAttackDir = -1;
    for (const p of this.state.players) {
      if (!p.redCard) p.fitness = Math.min(100, p.fitness + 12);
    }
    this.setupKickoff("away");
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
    if (b.restartType === "goalkick") {
      taker = this.state.players.find((p) => p.team === team && p.role === "GK");
    } else if (b.restartType === "penalty") {
      const penSpotX = dir === 1 ? PITCH.LENGTH - PITCH.PENALTY_SPOT : PITCH.PENALTY_SPOT;
      taker = this.state.players.filter((p) => p.team === team && !p.redCard && p.role !== "GK").sort((a, b2) => b2.attributes.shooting - a.attributes.shooting)[0];
      if (taker) {
        taker.pos = { x: penSpotX, y: PITCH.GOAL_Y };
        this.executeShot(taker, 0.76);
        return;
      }
    } else {
      taker = this.state.players.filter((p) => p.team === team && !p.redCard && p.role !== "GK").sort((a, b2) => dist2D(a.pos, b.restartPos) - dist2D(b2.pos, b.restartPos))[0];
    }
    if (taker) {
      taker.pos = { ...b.restartPos };
      taker.vel = { x: 0, y: 0 };
      this.giveBallTo(taker);
    } else {
      b.mode = "loose";
    }
  }
  handleHeldBall() {
    const b = this.state.ball;
    const holder = this.state.players.find((p) => p.id === b.holderId);
    if (!holder) {
      b.mode = "loose";
      return;
    }
    const oppStyle = holder.team === "home" ? this.state.awayStyle : this.state.homeStyle;
    const pressMul = TACTICAL_PRESETS[oppStyle].pressIntensity;
    const defenders = this.state.players.filter((p) => p.team !== holder.team && !p.redCard && p.stunTicks === 0 && p.role !== "GK").filter((p) => dist2D(p.pos, holder.pos) < 2.35);
    if (defenders.length > 0) {
      const def = defenders[0];
      if (Math.random() < 0.26 * pressMul) {
        const defPower = def.attributes.defending * 0.7 + def.attributes.strength * 0.3;
        const attPower = holder.attributes.dribbling * 0.7 + holder.attributes.strength * 0.3;
        const traitTackleBonus = def.traits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? 0.1 : 0;
        const traitFoulMul = def.traits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? 0.65 : 1;
        const tackleWinProb = clamp(0.45 + (defPower - attPower) / 100 * 0.38 + traitTackleBonus, 0.2, 0.8);
        if (Math.random() < 0.24 * pressMul * traitFoulMul) {
          this.handleFoul(def, holder);
          return;
        }
        if (Math.random() < tackleWinProb) {
          def.matchStats.tackles++;
          this.state.stats[def.team].tackles++;
          holder.stunTicks = 5;
          this.giveBallTo(def);
          this.pushEvent("tackle", def.team, def.id, def.name, def.pos, `${def.name} \u5E72\u51C0\u62A2\u65AD ${holder.name}`);
          return;
        } else {
          def.stunTicks = 6;
        }
      }
    }
    if (holder.decisionCooldown > 0) return;
    const style = holder.team === "home" ? this.state.homeStyle : this.state.awayStyle;
    const dir = this.getAttackDir(holder.team);
    const action = decideOnBall(holder, dir, style, this.state.players, b);
    const interval = Math.max(3, Math.round(SIM_CONFIG.DECISION_INTERVAL / TACTICAL_PRESETS[style].tempo));
    holder.decisionCooldown = interval;
    if (action.type === "shoot") {
      this.executeShot(holder, action.xG);
    } else if (action.type === "pass") {
      this.executePass(holder, action.target, action.passType);
    } else {
      holder.targetPos = action.targetPos;
    }
  }
  executePass(passer, target, passType) {
    passer.hasBall = false;
    passer.matchStats.passes++;
    this.state.stats[passer.team].passes++;
    this.lastPassTimestamp = this.state.tick;
    const dir = this.getAttackDir(passer.team);
    const defenders = this.state.players.filter((p) => p.team !== passer.team && !p.redCard);
    defenders.sort((a, b) => dir === 1 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x);
    const offsideLine = defenders.length >= 2 ? dir === 1 ? Math.max(PITCH.HALF_X, defenders[1].pos.x) : Math.min(PITCH.HALF_X, defenders[1].pos.x) : PITCH.HALF_X;
    const targetIsOffside = target.role !== "GK" && (dir === 1 ? target.pos.x > offsideLine + 0.9 : target.pos.x < offsideLine - 0.9);
    if (targetIsOffside && Math.random() < 0.78) {
      const oppTeam = passer.team === "home" ? "away" : "home";
      this.state.stats[passer.team].offsides++;
      this.pushEvent("offside", passer.team, target.id, target.name, target.pos, `${target.name} \u8D8A\u4F4D\u5728\u5148`);
      this.setDeadBall(oppTeam, "freekick", target.pos, 4);
      return;
    }
    const leadPos = {
      x: clamp(target.pos.x + target.vel.x * 0.35, 2, PITCH.LENGTH - 2),
      y: clamp(target.pos.y + target.vel.y * 0.35, 2, PITCH.WIDTH - 2)
    };
    launchPassBall(this.state.ball, passer.pos, leadPos, passer, target, passType);
  }
  executeShot(shooter, xG) {
    const dir = this.getAttackDir(shooter.team);
    shooter.hasBall = false;
    shooter.matchStats.shots++;
    this.state.stats[shooter.team].shots++;
    this.state.stats[shooter.team].xG += xG;
    const goalX = dir === 1 ? PITCH.LENGTH : 0;
    const dist = dist2D(shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
    const onTargetProb = clamp(
      0.24 + shooter.attributes.shooting / 99 * 0.22 - dist / 35 * 0.14,
      0.18,
      0.54
    );
    const onTarget = Math.random() < onTargetProb;
    if (onTarget) {
      this.state.stats[shooter.team].shotsOnTarget++;
    }
    const targetY = onTarget ? PITCH.GOAL_Y + (Math.random() - 0.5) * (PITCH.GOAL_HALF_WIDTH * 1.8) : PITCH.GOAL_Y + (Math.random() < 0.5 ? -1 : 1) * (PITCH.GOAL_HALF_WIDTH + 1.2 + Math.random() * 3);
    const targetZ = onTarget ? 0.3 + Math.random() * 1.8 : 0.6 + Math.random() * 2.8;
    this.pushEvent("shot", shooter.team, shooter.id, shooter.name, shooter.pos, `${shooter.name} \u8D77\u811A\u5C04\u95E8 (xG ${xG.toFixed(2)})`, xG);
    launchShotBall(this.state.ball, shooter, dir, xG, onTarget, targetY, targetZ);
  }
  handlePassFlight() {
    const b = this.state.ball;
    if (this.checkOutOfBounds()) return;
    if (b.pos.z < 2.1) {
      for (const p of this.state.players) {
        if (p.team === b.lastTouchTeam || p.redCard || p.stunTicks > 0) continue;
        const d = dist2D(p.pos, b.pos);
        if (d < 2.2) {
          const interceptChance = clamp(0.52 + p.attributes.defending / 99 * 0.4, 0.42, 0.88);
          if (Math.random() < interceptChance) {
            p.matchStats.interceptions++;
            this.state.stats[p.team].interceptions++;
            this.giveBallTo(p);
            this.pushEvent("interception", p.team, p.id, p.name, p.pos, `${p.name} \u9884\u5224\u62E6\u622A\u4F20\u7403`);
            return;
          }
        }
      }
    }
    const target = b.targetPlayerId ? this.state.players.find((p) => p.id === b.targetPlayerId) : null;
    if (target && dist2D(target.pos, b.pos) < 1.75 && b.pos.z < 2.2) {
      const passer = this.state.players.find((p) => p.id === b.lastPasserId);
      if (passer) {
        passer.matchStats.passesSuccess++;
        this.state.stats[passer.team].passesSuccess++;
      }
      this.giveBallTo(target);
      if (b.passType === "cross" && target.role !== "GK" && Math.random() < 0.42) {
        const dir = this.getAttackDir(target.team);
        const relX = toRelativeX(target.pos.x, dir);
        if (relX > 85) {
          this.executeShot(target, 0.16);
        }
      }
      return;
    }
    const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
    if (speed < 2.5 && b.pos.z <= 0.1) {
      b.mode = "loose";
    }
  }
  handleShotFlight() {
    const b = this.state.ball;
    const shooter = this.state.players.find((p) => p.id === b.shotShooterId);
    const shootTeam = shooter ? shooter.team : b.lastTouchTeam || "home";
    const defTeam = shootTeam === "home" ? "away" : "home";
    if (b.pos.z < 1.9) {
      for (const p of this.state.players) {
        if (p.team !== defTeam || p.redCard || p.role === "GK") continue;
        if (dist2D(p.pos, b.pos) < 1.15 && Math.random() < 0.24) {
          b.vel.x = -b.vel.x * 0.35 + (Math.random() - 0.5) * 4;
          b.vel.y = (Math.random() - 0.5) * 8;
          b.mode = "loose";
          b.lastTouchTeam = defTeam;
          return;
        }
      }
    }
    const crossedLeft = b.pos.x <= 0.5;
    const crossedRight = b.pos.x >= PITCH.LENGTH - 0.5;
    if (!crossedLeft && !crossedRight) {
      const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
      if (speed < 2 && b.pos.z <= 0.1) b.mode = "loose";
      return;
    }
    const inGoalMouth = b.shotOnTarget && Math.abs(b.pos.y - PITCH.GOAL_Y) <= PITCH.GOAL_HALF_WIDTH && b.pos.z <= 2.44;
    if (!inGoalMouth) {
      this.pushEvent("miss", shootTeam, shooter?.id || "", shooter?.name || "", b.pos, `${shooter?.name || "\u524D\u950B"} \u5C04\u95E8\u504F\u51FA\u7403\u95E8`);
      if (Math.random() < 0.3) {
        this.state.stats[shootTeam].corners++;
        const cornerX = crossedLeft ? 1 : PITCH.LENGTH - 1;
        const cornerY = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        this.pushEvent("corner", shootTeam, "", "", { x: cornerX, y: cornerY }, "\u83B7\u5F97\u89D2\u7403\u673A\u4F1A");
        this.setDeadBall(shootTeam, "corner", { x: cornerX, y: cornerY }, 5);
      } else {
        this.setDeadBall(defTeam, "goalkick", { x: crossedLeft ? 5.5 : PITCH.LENGTH - 5.5, y: PITCH.GOAL_Y }, 5);
      }
      return;
    }
    const gk = this.state.players.find((p) => p.team === defTeam && p.role === "GK");
    const gkAttr = gk ? gk.attributes.goalkeeping : 65;
    const gkTraitBonus = gk?.traits?.includes("\u95E8\u7EBF\u795E\u6251") ? 0.07 : 0;
    const gkSaveBonus = (gkAttr - 65) / 100 * 0.14 + gkTraitBonus;
    const goalProb = clamp(0.24 + b.shotXG * 0.78 - gkSaveBonus, 0.16, 0.58);
    if (Math.random() < goalProb) {
      if (shooter) shooter.matchStats.goals++;
      this.state.stats[shootTeam].goals++;
      if (shootTeam === "home") this.state.homeScore++;
      else this.state.awayScore++;
      if (b.lastPasserId && shooter && b.lastPasserId !== shooter.id && this.state.tick - this.lastPassTimestamp <= 60) {
        const assister = this.state.players.find((p) => p.id === b.lastPasserId && p.team === shootTeam);
        if (assister) assister.matchStats.assists++;
      }
      this.pushEvent("goal", shootTeam, shooter?.id || "", shooter?.name || "", b.pos, `\u26BD \u7403\u8FDB\u4E86\uFF01${shooter?.name || "\u7403\u5458"} \u7834\u95E8\u5F97\u5206\uFF01`, b.shotXG);
      const concedeTeam = shootTeam === "home" ? "away" : "home";
      this.setupKickoff(concedeTeam);
    } else {
      if (gk) gk.matchStats.saves++;
      this.state.stats[defTeam].saves++;
      this.pushEvent("save", defTeam, gk?.id || "", gk?.name || "\u95E8\u5C06", b.pos, `${gk?.name || "\u95E8\u5C06"} \u98DE\u8EAB\u5C06\u7403\u6251\u51FA`);
      if (Math.random() < 0.28) {
        this.state.stats[shootTeam].corners++;
        const cornerX = crossedLeft ? 1 : PITCH.LENGTH - 1;
        const cornerY = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        this.pushEvent("corner", shootTeam, "", "", { x: cornerX, y: cornerY }, "\u83B7\u5F97\u89D2\u7403\u673A\u4F1A");
        this.setDeadBall(shootTeam, "corner", { x: cornerX, y: cornerY }, 5);
      } else if (gk) {
        this.giveBallTo(gk);
      }
    }
  }
  handleLooseBall() {
    const b = this.state.ball;
    if (this.checkOutOfBounds()) return;
    const nearest = this.state.players.filter((p) => !p.redCard && p.stunTicks === 0).sort((a, b2) => dist2D(a.pos, b.pos) - dist2D(b2.pos, b.pos))[0];
    if (nearest && dist2D(nearest.pos, b.pos) < 1.65 && b.pos.z < 2) {
      this.giveBallTo(nearest);
    }
  }
  checkOutOfBounds() {
    const b = this.state.ball;
    const oppTeam = b.lastTouchTeam === "home" ? "away" : "home";
    if (b.pos.y <= 0.4 || b.pos.y >= PITCH.WIDTH - 0.4) {
      const y = b.pos.y <= 0.4 ? 1 : PITCH.WIDTH - 1;
      this.setDeadBall(oppTeam, "throw", { x: clamp(b.pos.x, 2, PITCH.LENGTH - 2), y }, 4);
      return true;
    }
    if (b.pos.x <= 0.4 || b.pos.x >= PITCH.LENGTH - 0.4) {
      const homeDefendsLeft = this.state.homeAttackDir === 1;
      const defendingAtEnd = b.pos.x <= 0.4 && homeDefendsLeft || b.pos.x >= PITCH.LENGTH - 0.4 && !homeDefendsLeft ? "home" : "away";
      const attackingAtEnd = defendingAtEnd === "home" ? "away" : "home";
      if (b.lastTouchTeam === defendingAtEnd) {
        this.state.stats[attackingAtEnd].corners++;
        const cx = b.pos.x <= 0.4 ? 1 : PITCH.LENGTH - 1;
        const cy = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        this.setDeadBall(attackingAtEnd, "corner", { x: cx, y: cy }, 5);
      } else {
        const gx = b.pos.x <= 0.4 ? 5.5 : PITCH.LENGTH - 5.5;
        this.setDeadBall(defendingAtEnd, "goalkick", { x: gx, y: PITCH.GOAL_Y }, 5);
      }
      return true;
    }
    return false;
  }
  handleFoul(fouler, victim) {
    this.state.stats[fouler.team].fouls++;
    this.pushEvent("foul", fouler.team, fouler.id, fouler.name, victim.pos, `${fouler.name} \u72AF\u89C4\u653E\u5012 ${victim.name}`);
    if (Math.random() < 0.22) {
      fouler.yellowCards++;
      this.state.stats[fouler.team].yellowCards++;
      this.pushEvent("yellow_card", fouler.team, fouler.id, fouler.name, fouler.pos, `\u{1F7E8} ${fouler.name} \u9886\u5230\u9EC4\u724C`);
      if (fouler.yellowCards >= 2) {
        fouler.redCard = true;
        this.state.stats[fouler.team].redCards++;
        this.pushEvent("red_card", fouler.team, fouler.id, fouler.name, fouler.pos, `\u{1F7E5} ${fouler.name} \u4E24\u9EC4\u53D8\u4E00\u7EA2\u88AB\u7F5A\u4E0B`);
      }
    }
    const victimDir = this.getAttackDir(victim.team);
    const victimRelX = toRelativeX(victim.pos.x, victimDir);
    const inPenaltyBox = victimRelX >= PITCH.LENGTH - PITCH.PENALTY_BOX_DEPTH && Math.abs(victim.pos.y - PITCH.GOAL_Y) <= PITCH.PENALTY_BOX_HALF_W;
    if (inPenaltyBox) {
      this.setDeadBall(victim.team, "penalty", victim.pos, 6);
    } else {
      this.setDeadBall(victim.team, "freekick", victim.pos, 5);
    }
  }
  setDeadBall(team, type, pos, delayTicks) {
    this.clearHolder();
    const b = this.state.ball;
    b.mode = "dead";
    b.restartTeam = team;
    b.restartType = type;
    b.restartPos = {
      x: clamp(pos.x, 1.5, PITCH.LENGTH - 1.5),
      y: clamp(pos.y, 1.5, PITCH.WIDTH - 1.5)
    };
    b.pos = { x: b.restartPos.x, y: b.restartPos.y, z: 0 };
    b.vel = { x: 0, y: 0, z: 0 };
    b.deadTimer = delayTicks;
  }
  drainFitness() {
    for (const p of this.state.players) {
      if (p.redCard) continue;
      const style = p.team === "home" ? this.state.homeStyle : this.state.awayStyle;
      const pressFactor = TACTICAL_PRESETS[style].pressIntensity;
      const staminaResist = 1.25 - p.attributes.stamina / 99 * 0.5;
      const traitResist = p.traits?.includes("\u94C1\u80BA\u8986\u76D6") ? 0.6 : 1;
      const roleFactor = p.role === "GK" ? 0.15 : 0.34;
      p.fitness = Math.max(20, p.fitness - roleFactor * pressFactor * staminaResist * traitResist);
    }
  }
  finalizeStats() {
    const s = this.state.stats;
    const totalPoss = s.home.possessionTicks + s.away.possessionTicks || 1;
    s.home.possessionPct = Math.round(s.home.possessionTicks / totalPoss * 100);
    s.away.possessionPct = 100 - s.home.possessionPct;
    for (const side of ["home", "away"]) {
      const ts = s[side];
      ts.passAccuracy = ts.passes > 0 ? Math.round(ts.passesSuccess / ts.passes * 100) : 0;
      ts.xG = Math.round(ts.xG * 100) / 100;
      const totalDistM = this.state.players.filter((p) => p.team === side).reduce((acc, p) => acc + p.matchStats.distanceM, 0);
      ts.distanceKm = Math.round(totalDistM / 1e3 * 10) / 10;
    }
  }
  pushEvent(type, team, playerId, playerName, pos, text, xG) {
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
      text
    });
  }
};

// ../../../WorkBuddy/fb2/fm-league/packages/core/src/PlayerPool.ts
var FICTIONAL_CLUBS = [
  { id: "club_star", name: "\u661F\u8FB0\u8054", shortName: "\u661F\u8FB0", primaryColor: "#DC2626", secondaryColor: "#FACC15" },
  { id: "club_iron", name: "\u94C1\u58C1\u57CE", shortName: "\u94C1\u58C1", primaryColor: "#2563EB", secondaryColor: "#E2E8F0" },
  { id: "club_eagle", name: "\u84DD\u9E70\u7ADE\u6280", shortName: "\u84DD\u9E70", primaryColor: "#0284C7", secondaryColor: "#F8FAFC" },
  { id: "club_flame", name: "\u8D64\u7130\u6E2F", shortName: "\u8D64\u7130", primaryColor: "#EA580C", secondaryColor: "#1E293B" },
  { id: "club_oak", name: "\u7687\u5BB6\u6A61\u6811", shortName: "\u6A61\u6811", primaryColor: "#15803D", secondaryColor: "#FDE047" },
  { id: "club_light", name: "\u5317\u6D77\u706F\u5854", shortName: "\u706F\u5854", primaryColor: "#4F46E5", secondaryColor: "#CBD5E1" },
  { id: "club_jade", name: "\u7FE1\u7FE0\u8C37", shortName: "\u7FE1\u7FE0", primaryColor: "#059669", secondaryColor: "#ECFDF5" },
  { id: "club_storm", name: "\u98CE\u66B4\u77FF\u5DE5", shortName: "\u98CE\u66B4", primaryColor: "#7C3AED", secondaryColor: "#F59E0B" }
];
var FIRST_NAMES = [
  "\u6797",
  "\u9648",
  "\u9646",
  "\u5468",
  "\u6C88",
  "\u987E",
  "\u97E9",
  "\u53F6",
  "\u82CF",
  "\u5510",
  "\u83B1\u6602",
  "\u9A6C\u79D1",
  "\u5362\u5361",
  "\u7EF4\u514B\u6258",
  "\u57C3\u91CC\u514B",
  "\u8FEA\u4E9A\u65AF",
  "\u8D39\u5229\u4F69",
  "\u4E39\u5C3C\u5C14",
  "\u5965\u65AF\u5361",
  "\u4F0A\u4E07"
];
var LAST_NAMES = [
  "\u6CFD\u5B87",
  "\u5B50\u8F69",
  "\u6D69\u7136",
  "\u660E\u54F2",
  "\u5929\u4F51",
  "\u4FCA\u6770",
  "\u81F4\u8FDC",
  "\u601D\u9F50",
  "\u5609\u8BDA",
  "\u535A\u8FDC",
  "\u74E6\u5C14\u5FB7",
  "\u83AB\u96F7\u8BFA",
  "\u79D1\u65AF\u5854",
  "\u514B\u52B3\u65AF",
  "\u5E2D\u5C14\u74E6",
  "\u5361\u74E6\u7565",
  "\u8BFA\u4E9A",
  "\u4F69\u96F7\u65AF",
  "\u8D39\u5C14\u5357",
  "\u7D22\u8428"
];
var TACTICAL_PERKS = [
  { id: "perk_tiki", name: "\u4F20\u63A7\u5927\u8111", description: "\u5168\u961F\u4F20\u7403\u4E0E\u63A7\u7403\u89C6\u91CE +5", rarity: "common", effect: { passingBonus: 5 } },
  { id: "perk_finisher", name: "\u4E34\u95E8\u4E00\u811A", description: "\u5168\u961F\u5C04\u95E8\u51C6\u5EA6 +5", rarity: "common", effect: { shootingBonus: 5 } },
  { id: "perk_wall", name: "\u94A2\u94C1\u9632\u7EBF", description: "\u5168\u961F\u62A2\u65AD\u62E6\u622A\u4E0E\u95E8\u5C06\u6251\u6551 +4", rarity: "common", effect: { defendingBonus: 4, goalkeepingBonus: 4 } },
  { id: "perk_turbo", name: "\u8FB9\u8DEF\u8D85\u8DD1", description: "\u5168\u961F\u901F\u5EA6\u4E0E\u4F53\u80FD +5", rarity: "rare", effect: { paceBonus: 5, staminaBonus: 5 } },
  { id: "perk_gegen", name: "\u5168\u653B\u5168\u5B88", description: "\u5168\u961F\u4F20\u7403 +4\u3001\u5C04\u95E8 +4\u3001\u9632\u5B88 +4", rarity: "epic", effect: { passingBonus: 4, shootingBonus: 4, defendingBonus: 4 } },
  { id: "perk_keeper", name: "\u95E8\u795E\u9644\u4F53", description: "\u95E8\u5C06\u6251\u6551\u53CD\u5E94 +9", rarity: "rare", effect: { goalkeepingBonus: 9 } }
];
var ARCHETYPES = {
  GK: [
    { label: "\u95E8\u7EBF\u5B88\u62A4\u8005", biases: { goalkeeping: 14, composure: 8, passing: -10, pace: -12 }, traitPool: ["\u95E8\u7EBF\u795E\u6251"] },
    { label: "\u6E05\u9053\u592B\u95E8\u5C06", biases: { goalkeeping: 9, passing: 6, pace: 4, positioning: 8 }, traitPool: ["\u95E8\u7EBF\u795E\u6251", "\u7CBE\u51C6\u957F\u4F20"] }
  ],
  CB: [
    { label: "\u94C1\u8840\u9632\u7A7A\u5854", biases: { defending: 13, strength: 14, positioning: 8, pace: -10, dribbling: -14 }, traitPool: ["\u7CBE\u51C6\u94F2\u65AD"] },
    { label: "\u51FA\u7403\u4E2D\u536B", biases: { defending: 8, passing: 12, composure: 10, strength: 2 }, traitPool: ["\u7CBE\u51C6\u957F\u4F20", "\u8282\u62CD\u5668"] },
    { label: "\u56DE\u8FFD\u4E2D\u536B", biases: { defending: 10, pace: 12, stamina: 6, strength: -4 }, traitPool: ["\u7CBE\u51C6\u94F2\u65AD", "\u94C1\u80BA\u8986\u76D6"] }
  ],
  FB: [
    { label: "\u5957\u8FB9\u98DE\u7FFC", biases: { pace: 14, dribbling: 8, passing: 7, stamina: 8, strength: -6 }, traitPool: ["\u7CBE\u51C6\u4F20\u4E2D", "\u94C1\u80BA\u8986\u76D6"] },
    { label: "\u9632\u5B88\u578B\u8FB9\u536B", biases: { defending: 12, positioning: 9, strength: 6, shooting: -14 }, traitPool: ["\u7CBE\u51C6\u94F2\u65AD", "\u94C1\u80BA\u8986\u76D6"] }
  ],
  MID: [
    { label: "\u8282\u62CD\u5668\u5927\u5E08", biases: { passing: 15, composure: 12, positioning: 8, pace: -8, strength: -6 }, traitPool: ["\u8282\u62CD\u5668", "\u81F4\u547D\u76F4\u585E"] },
    { label: "B2B \u94C1\u80BA", biases: { stamina: 16, pace: 6, strength: 8, defending: 6, passing: 5 }, traitPool: ["\u94C1\u80BA\u8986\u76D6", "\u7CBE\u51C6\u94F2\u65AD"] },
    { label: "\u524D\u63D2\u91CD\u70AE\u624B", biases: { shooting: 14, positioning: 10, dribbling: 6, defending: -12 }, traitPool: ["\u8FDC\u5C04\u91CD\u70AE", "\u81F4\u547D\u76F4\u585E"] }
  ],
  ATT: [
    { label: "\u901F\u5EA6\u53CD\u51FB\u7BAD", biases: { pace: 16, dribbling: 11, shooting: 4, strength: -8, passing: -4 }, traitPool: ["\u7CBE\u51C6\u4F20\u4E2D", "\u7981\u533A\u72D0\u72F8"] },
    { label: "\u7981\u533A\u62A2\u70B9\u72D0", biases: { shooting: 14, positioning: 14, composure: 12, pace: -4, passing: -8 }, traitPool: ["\u7981\u533A\u72D0\u72F8"] },
    { label: "\u652F\u70B9\u7B56\u5E94\u950B", biases: { strength: 15, passing: 10, shooting: 9, pace: -10 }, traitPool: ["\u81F4\u547D\u76F4\u585E", "\u7981\u533A\u72D0\u72F8"] }
  ]
};
var playerSeq = 0;
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clampAttr(v) {
  return Math.max(25, Math.min(99, Math.round(v)));
}
function getRoleGroup(role) {
  if (role === "GK") return "GK";
  if (role === "CB") return "CB";
  if (["LB", "RB", "LWB", "RWB"].includes(role)) return "FB";
  if (["CDM", "CM", "CAM", "LM", "RM"].includes(role)) return "MID";
  return "ATT";
}
function computeWeightedCA(role, a) {
  const g = getRoleGroup(role);
  if (g === "GK") {
    return Math.round(a.goalkeeping * 0.52 + a.positioning * 0.18 + a.composure * 0.15 + a.passing * 0.15);
  }
  if (g === "CB") {
    return Math.round(a.defending * 0.34 + a.strength * 0.22 + a.positioning * 0.2 + a.pace * 0.12 + a.passing * 0.12);
  }
  if (g === "FB") {
    return Math.round(a.pace * 0.24 + a.defending * 0.24 + a.passing * 0.18 + a.stamina * 0.18 + a.dribbling * 0.16);
  }
  if (g === "MID") {
    return Math.round(a.passing * 0.28 + a.positioning * 0.18 + a.dribbling * 0.16 + a.stamina * 0.14 + a.defending * 0.12 + a.shooting * 0.12);
  }
  return Math.round(a.shooting * 0.3 + a.pace * 0.2 + a.dribbling * 0.2 + a.positioning * 0.18 + a.composure * 0.12);
}
function calcTier(ca) {
  if (ca >= 83) return "S";
  if (ca >= 75) return "A";
  if (ca >= 68) return "B";
  return "C";
}
function generateDraftPlayer(role, targetBand) {
  playerSeq++;
  const group = getRoleGroup(role);
  const archList = ARCHETYPES[group];
  const arch = archList[randInt(0, archList.length - 1)];
  const baseLevel = targetBand ?? randInt(64, 83);
  const rollAttr = (key, defaultBias = 0) => {
    const bias = arch.biases[key] ?? defaultBias;
    return clampAttr(baseLevel + bias + randInt(-9, 9));
  };
  const attributes = {
    passing: rollAttr("passing"),
    shooting: rollAttr("shooting", group === "CB" || group === "GK" ? -22 : 0),
    dribbling: rollAttr("dribbling", group === "GK" ? -25 : 0),
    pace: rollAttr("pace"),
    strength: rollAttr("strength"),
    defending: rollAttr("defending", group === "ATT" ? -28 : 0),
    positioning: rollAttr("positioning"),
    composure: rollAttr("composure"),
    stamina: rollAttr("stamina", 4),
    goalkeeping: group === "GK" ? rollAttr("goalkeeping") : randInt(20, 35)
  };
  const ca = computeWeightedCA(role, attributes);
  const tier = calcTier(ca);
  const cost = Math.max(40, Math.round(42 + (ca - 60) * 2.5));
  const traits = [];
  const t1 = arch.traitPool[randInt(0, arch.traitPool.length - 1)];
  traits.push(t1);
  if ((tier === "S" || tier === "A" && Math.random() < 0.4) && arch.traitPool.length > 1) {
    const t2 = arch.traitPool.find((t) => t !== t1);
    if (t2) traits.push(t2);
  }
  const fn = FIRST_NAMES[randInt(0, FIRST_NAMES.length - 1)];
  const ln = LAST_NAMES[randInt(0, LAST_NAMES.length - 1)];
  return {
    id: `p_${playerSeq}`,
    name: `${fn}\xB7${ln}`,
    role,
    shirtNumber: randInt(1, 99),
    attributes,
    traits,
    fitness: 100,
    ca,
    cost,
    tier,
    age: randInt(19, 32),
    trait: `${arch.label} \xB7 ${traits.join(" / ")}`,
    seasonStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0
    }
  };
}
function generateShuffleSet(size = 20, minBand = 63, maxBand = 85) {
  const roleDistribution = [
    "GK",
    "GK",
    "CB",
    "CB",
    "CB",
    "LB",
    "RB",
    "CDM",
    "CM",
    "CM",
    "CAM",
    "LM",
    "RM",
    "LW",
    "RW",
    "ST",
    "ST",
    "CB",
    "CM",
    "ST"
  ];
  const pool = [];
  for (let i = 0; i < size; i++) {
    const role = roleDistribution[i % roleDistribution.length];
    const roll = Math.random();
    const band = roll < 0.16 ? randInt(Math.max(minBand, 79), maxBand) : roll < 0.56 ? randInt(70, 78) : randInt(minBand, 69);
    pool.push(generateDraftPlayer(role, band));
  }
  return pool.sort((a, b) => b.ca - a.ca);
}

// ../../../WorkBuddy/fb2/fm-league/packages/core/src/ShuffleDraft.ts
var DRAFT_SQUAD_SIZE = 16;
var DRAFT_BUDGET_TOTAL = 1280;
var DRAFT_SETS_TOTAL = 4;
var DRAFT_PICKS_PER_SET = 4;
function createInitialDraftState() {
  return {
    targetSquadSize: DRAFT_SQUAD_SIZE,
    budgetTotal: DRAFT_BUDGET_TOTAL,
    budgetRemaining: DRAFT_BUDGET_TOTAL,
    currentSetIndex: 0,
    picksInCurrentSet: 0,
    currentPool: generateShuffleSet(20, 64, 88)
  };
}
function generateAIDraftSquad(baseStrength = 74) {
  const requiredRoles = [
    "GK",
    "GK",
    "CB",
    "CB",
    "CB",
    "LB",
    "RB",
    "CDM",
    "CM",
    "CM",
    "CAM",
    "LM",
    "RM",
    "LW",
    "RW",
    "ST"
  ];
  return requiredRoles.map((role, i) => {
    const variance = i % 5 - 2;
    const ca = Math.max(60, Math.min(88, baseStrength + variance * 2));
    return generateDraftPlayer(role, ca);
  });
}
function autoSelectStarters(squad, formation) {
  const slots = FORMATIONS[formation];
  const used = /* @__PURE__ */ new Set();
  const starters = [];
  for (const slot of slots) {
    let best = squad.filter((p) => !used.has(p.id) && p.role === slot.role).sort((a, b) => b.ca - a.ca)[0];
    if (!best && slot.role !== "GK") {
      const isDef = ["CB", "LB", "RB", "LWB", "RWB"].includes(slot.role);
      const isMid = ["CDM", "CM", "CAM", "LM", "RM"].includes(slot.role);
      const isAtt = ["LW", "RW", "ST"].includes(slot.role);
      best = squad.filter((p) => !used.has(p.id) && p.role !== "GK").filter((p) => {
        if (isDef) return ["CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(p.role);
        if (isMid) return ["CDM", "CM", "CAM", "LM", "RM", "LW", "RW"].includes(p.role);
        if (isAtt) return ["ST", "LW", "RW", "CAM", "LM", "RM"].includes(p.role);
        return true;
      }).sort((a, b) => b.ca - a.ca)[0];
    }
    if (!best) {
      best = squad.filter((p) => !used.has(p.id)).sort((a, b) => b.ca - a.ca)[0];
    }
    if (best) {
      used.add(best.id);
      starters.push(best.id);
    }
  }
  return starters;
}
function createReDraftOffer(roundCompleted, ownedPerkIds) {
  const minCA = roundCompleted >= 6 ? 74 : roundCompleted >= 4 ? 70 : 68;
  const maxCA = roundCompleted >= 6 ? 91 : roundCompleted >= 4 ? 89 : 87;
  const candidates = generateShuffleSet(6, minCA, maxCA);
  const availablePerks = TACTICAL_PERKS.filter((p) => !ownedPerkIds.includes(p.id));
  const pool = availablePerks.length >= 3 ? availablePerks : TACTICAL_PERKS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const perkChoices = shuffled.slice(0, 3);
  return {
    roundCompleted,
    candidates,
    perkChoices,
    maxSwaps: 2,
    swapsUsed: 0,
    perkChosen: false
  };
}

// ../../../WorkBuddy/fb2/fm-league/packages/core/src/LeagueScheduler.ts
function generateRoundRobinFixtures(clubIds) {
  const n = clubIds.length;
  if (n % 2 !== 0) throw new Error("League team count must be even");
  const ids = [...clubIds];
  const fixed = ids[0];
  const rotating = ids.slice(1);
  const fixtures = [];
  for (let round = 1; round <= n - 1; round++) {
    const circle = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const t1 = circle[i];
      const t2 = circle[n - 1 - i];
      const flip = (round + i) % 2 === 0;
      const homeClubId = flip ? t2 : t1;
      const awayClubId = flip ? t1 : t2;
      fixtures.push({
        id: `fix_r${round}_${i + 1}`,
        round,
        stage: "regular",
        homeClubId,
        awayClubId,
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        homeXG: 0,
        awayXG: 0
      });
    }
    const last = rotating.pop();
    rotating.unshift(last);
  }
  return fixtures;
}
function computeStandings(clubs, fixtures) {
  const map = /* @__PURE__ */ new Map();
  for (const c of clubs) {
    map.set(c.id, {
      clubId: c.id,
      clubName: c.name,
      isUser: c.isUser,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      form: []
    });
  }
  const regularPlayed = fixtures.filter((f) => f.stage === "regular" && f.played).sort((a, b) => a.round - b.round);
  for (const f of regularPlayed) {
    const h = map.get(f.homeClubId);
    const a = map.get(f.awayClubId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.gf += f.homeGoals;
    h.ga += f.awayGoals;
    a.gf += f.awayGoals;
    a.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      h.won++;
      h.points += 3;
      h.form.push("W");
      a.lost++;
      a.form.push("L");
    } else if (f.homeGoals < f.awayGoals) {
      a.won++;
      a.points += 3;
      a.form.push("W");
      h.lost++;
      h.form.push("L");
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
      h.form.push("D");
      a.form.push("D");
    }
  }
  const rows = Array.from(map.values());
  for (const r of rows) {
    r.gd = r.gf - r.ga;
    if (r.form.length > 5) r.form = r.form.slice(-5);
  }
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.clubName.localeCompare(b.clubName);
  });
  return rows;
}

// ../../../WorkBuddy/fb2/fm-league/packages/core/src/LeagueManager.ts
var AI_FORMATIONS = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-4-1"];
var AI_STYLES = ["balanced", "tiki_taka", "gegenpress", "counter", "wing_play"];
var RE_DRAFT_ROUNDS = /* @__PURE__ */ new Set([2, 4, 6]);
var LeagueManager = class _LeagueManager {
  constructor(initialState) {
    if (initialState) {
      this.state = JSON.parse(JSON.stringify(initialState));
    } else {
      this.state = this.createNewSeasonState();
    }
  }
  getState() {
    return this.state;
  }
  getUserClub() {
    return this.state.clubs.find((c) => c.id === this.state.userClubId);
  }
  getStandings() {
    return computeStandings(this.state.clubs, this.state.fixtures);
  }
  getCurrentRoundFixtures() {
    return this.state.fixtures.filter((f) => f.round === this.state.currentRound);
  }
  getUserCurrentFixture() {
    return this.state.fixtures.find(
      (f) => f.round === this.state.currentRound && !f.played && (f.homeClubId === this.state.userClubId || f.awayClubId === this.state.userClubId)
    ) || null;
  }
  /**
   * 序列化存档（兼容本地 JSON 与微信云开发数据库）
   */
  serialize() {
    return JSON.stringify(this.state);
  }
  static deserialize(raw) {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return new _LeagueManager(parsed);
  }
  /**
   * 开启新赛季（保留 Meta 局外点数）
   */
  startNewSeason(userClubTemplateId = "club_star", formation = "4-3-3", style = "tiki_taka") {
    const prevMeta = this.state?.metaPointsTotal ?? 0;
    const prevSeason = this.state?.seasonNumber ?? 0;
    this.state = this.createNewSeasonState(userClubTemplateId, formation, style, prevSeason + 1, prevMeta);
    return this.state;
  }
  createNewSeasonState(userClubTemplateId = "club_star", formation = "4-3-3", style = "tiki_taka", seasonNumber = 1, metaPointsTotal = 0) {
    const clubs = FICTIONAL_CLUBS.map((tpl, idx) => {
      const isUser = tpl.id === userClubTemplateId;
      const aiForm = AI_FORMATIONS[idx % AI_FORMATIONS.length];
      const aiStyle = AI_STYLES[idx % AI_STYLES.length];
      const aiSquad = isUser ? [] : generateAIDraftSquad(72 + idx % 5);
      return {
        id: tpl.id,
        name: tpl.name,
        shortName: tpl.shortName,
        primaryColor: tpl.primaryColor,
        secondaryColor: tpl.secondaryColor,
        isUser,
        formation: isUser ? formation : aiForm,
        style: isUser ? style : aiStyle,
        squad: aiSquad,
        starterIds: isUser ? [] : autoSelectStarters(aiSquad, aiForm),
        perks: []
      };
    });
    const fixtures = generateRoundRobinFixtures(clubs.map((c) => c.id));
    return {
      seasonNumber,
      phase: "INIT_DRAFT",
      currentRound: 1,
      userClubId: userClubTemplateId,
      clubs,
      fixtures,
      draft: createInitialDraftState(),
      reDraft: null,
      metaPointsTotal,
      lastSummary: null
    };
  }
  // ==================== 1. 开局 Shuffle Draft 选秀 ====================
  /**
   * 从当前候选池选中一名球员加入球队
   */
  pickDraftPlayer(playerId) {
    if (this.state.phase !== "INIT_DRAFT") {
      return { ok: false, reason: "\u5F53\u524D\u4E0D\u5728\u9009\u79C0\u9636\u6BB5" };
    }
    const d = this.state.draft;
    const club = this.getUserClub();
    if (club.squad.length >= d.targetSquadSize) {
      return { ok: false, reason: "\u9635\u5BB9\u5DF2\u6EE1" };
    }
    const idx = d.currentPool.findIndex((p) => p.id === playerId);
    if (idx < 0) {
      return { ok: false, reason: "\u5019\u9009\u6C60\u4E2D\u672A\u627E\u5230\u8BE5\u7403\u5458" };
    }
    const player = d.currentPool[idx];
    const remainingSlotsAfterPick = d.targetSquadSize - club.squad.length - 1;
    if (d.budgetRemaining - player.cost < remainingSlotsAfterPick * 40) {
      return { ok: false, reason: "\u5269\u4F59\u9884\u7B97\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u7559\u8DB3\u540E\u7EED\u540D\u989D" };
    }
    d.currentPool.splice(idx, 1);
    d.budgetRemaining -= player.cost;
    club.squad.push(player);
    d.picksInCurrentSet++;
    if (club.squad.length >= d.targetSquadSize) {
      this.finishInitialDraft();
      return { ok: true };
    }
    if (d.picksInCurrentSet >= DRAFT_PICKS_PER_SET && d.currentSetIndex < DRAFT_SETS_TOTAL - 1) {
      d.currentSetIndex++;
      d.picksInCurrentSet = 0;
      d.currentPool = generateShuffleSet(20, 64, 88);
    }
    return { ok: true };
  }
  /**
   * 一键智能补齐剩余选秀名额（确保有 GK 且不超预算）
   */
  autoCompleteDraft() {
    if (this.state.phase !== "INIT_DRAFT") return;
    const club = this.getUserClub();
    const d = this.state.draft;
    while (club.squad.length < d.targetSquadSize) {
      if (d.currentPool.length === 0) {
        d.currentPool = generateShuffleSet(20, 62, 84);
      }
      const needGK = !club.squad.some((p) => p.role === "GK");
      const remainingAfter = d.targetSquadSize - club.squad.length - 1;
      const maxAffordable = d.budgetRemaining - remainingAfter * 40;
      const affordable = d.currentPool.filter((p) => p.cost <= maxAffordable).sort((a, b) => b.ca - a.ca);
      let chosen = needGK ? affordable.find((p) => p.role === "GK") || affordable[0] : affordable[0];
      if (!chosen) {
        chosen = d.currentPool.sort((a, b) => a.cost - b.cost)[0];
      }
      const idx = d.currentPool.findIndex((p) => p.id === chosen.id);
      if (idx >= 0) d.currentPool.splice(idx, 1);
      d.budgetRemaining = Math.max(0, d.budgetRemaining - chosen.cost);
      club.squad.push(chosen);
    }
    this.finishInitialDraft();
  }
  finishInitialDraft() {
    const club = this.getUserClub();
    club.starterIds = autoSelectStarters(club.squad, club.formation);
    this.state.phase = "REGULAR_SEASON";
    this.state.currentRound = 1;
  }
  // ==================== 2. 阵型与首发管理 ====================
  updateUserTactics(formation, style, starterIds) {
    const club = this.getUserClub();
    club.formation = formation;
    club.style = style;
    if (starterIds && starterIds.length === 11) {
      club.starterIds = [...starterIds];
    } else {
      club.starterIds = autoSelectStarters(club.squad, formation);
    }
  }
  // ==================== 3. 比赛驱动与轮次推进 ====================
  buildTeamSetup(club) {
    const squadMap = new Map(club.squad.map((p) => [p.id, p]));
    let starters = club.starterIds.map((id) => squadMap.get(id)).filter((p) => !!p);
    if (starters.length < 11) {
      club.starterIds = autoSelectStarters(club.squad, club.formation);
      starters = club.starterIds.map((id) => squadMap.get(id)).filter(Boolean);
    }
    const players = starters.map((p) => {
      const attrs = { ...p.attributes };
      for (const perk of club.perks) {
        if (perk.effect.passingBonus) attrs.passing = Math.min(99, attrs.passing + perk.effect.passingBonus);
        if (perk.effect.shootingBonus) attrs.shooting = Math.min(99, attrs.shooting + perk.effect.shootingBonus);
        if (perk.effect.defendingBonus) attrs.defending = Math.min(99, attrs.defending + perk.effect.defendingBonus);
        if (perk.effect.paceBonus) attrs.pace = Math.min(99, attrs.pace + perk.effect.paceBonus);
        if (perk.effect.staminaBonus) attrs.stamina = Math.min(99, attrs.stamina + perk.effect.staminaBonus);
        if (perk.effect.goalkeepingBonus && p.role === "GK") {
          attrs.goalkeeping = Math.min(99, attrs.goalkeeping + perk.effect.goalkeepingBonus);
        }
      }
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        shirtNumber: p.shirtNumber,
        attributes: attrs,
        traits: p.traits ? [...p.traits] : [],
        fitness: p.fitness
      };
    });
    const starterSet = new Set(club.starterIds);
    const subs = club.squad.filter((p) => !starterSet.has(p.id)).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      shirtNumber: p.shirtNumber,
      attributes: { ...p.attributes },
      traits: p.traits ? [...p.traits] : [],
      fitness: p.fitness
    }));
    return {
      name: club.name,
      formation: club.formation,
      style: club.style,
      players,
      subs
    };
  }
  /**
   * 为玩家本轮比赛实例化一个全新的纯 2D 实时 MatchEngine
   */
  createUserMatchEngine() {
    const fixture = this.getUserCurrentFixture();
    if (!fixture) throw new Error("\u5F53\u524D\u8F6E\u6B21\u6CA1\u6709\u5F85\u8FDB\u884C\u7684\u73A9\u5BB6\u6BD4\u8D5B");
    const home = this.state.clubs.find((c) => c.id === fixture.homeClubId);
    const away = this.state.clubs.find((c) => c.id === fixture.awayClubId);
    return new MatchEngine(this.buildTeamSetup(home), this.buildTeamSetup(away));
  }
  /**
   * 提交玩家本轮比赛结果，同步模拟同轮其他 AI 比赛并推进赛程
   */
  completeCurrentRoundWithUserResult(userMatchResult) {
    const userFixture = this.getUserCurrentFixture();
    if (!userFixture) return;
    this.applyMatchOutcome(userFixture, userMatchResult);
    const pendingInRound = this.state.fixtures.filter(
      (f) => f.round === this.state.currentRound && !f.played
    );
    for (const fx of pendingInRound) {
      const h = this.state.clubs.find((c) => c.id === fx.homeClubId);
      const a = this.state.clubs.find((c) => c.id === fx.awayClubId);
      const engine = new MatchEngine(this.buildTeamSetup(h), this.buildTeamSetup(a));
      const res = engine.simulateMatch();
      this.applyMatchOutcome(fx, res);
    }
    for (const c of this.state.clubs) {
      for (const p of c.squad) p.fitness = 100;
    }
    this.advanceAfterRound();
  }
  applyMatchOutcome(fixture, res) {
    let homeGoals = res.homeScore;
    let awayGoals = res.awayScore;
    if (fixture.stage !== "regular" && homeGoals === awayGoals) {
      if (Math.random() < 0.5) homeGoals += 1;
      else awayGoals += 1;
    }
    fixture.played = true;
    fixture.homeGoals = homeGoals;
    fixture.awayGoals = awayGoals;
    fixture.homeXG = res.stats.home.xG;
    fixture.awayXG = res.stats.away.xG;
    const playerMap = /* @__PURE__ */ new Map();
    for (const c of this.state.clubs) {
      for (const p of c.squad) playerMap.set(p.id, p);
    }
    for (const mp of res.players) {
      const dp = playerMap.get(mp.id);
      if (!dp) continue;
      dp.seasonStats.appearances++;
      dp.seasonStats.goals += mp.matchStats.goals;
      dp.seasonStats.assists += mp.matchStats.assists;
      dp.seasonStats.yellowCards += mp.yellowCards;
      if (mp.redCard) dp.seasonStats.redCards++;
      if (dp.role === "GK") {
        const conceded = mp.team === "home" ? awayGoals : homeGoals;
        if (conceded === 0) dp.seasonStats.cleanSheets++;
      }
    }
  }
  advanceAfterRound() {
    const r = this.state.currentRound;
    if (this.state.phase === "REGULAR_SEASON" && RE_DRAFT_ROUNDS.has(r)) {
      const club = this.getUserClub();
      this.state.reDraft = createReDraftOffer(
        r,
        club.perks.map((p) => p.id)
      );
      this.state.phase = "RE_DRAFT";
      return;
    }
    if (this.state.phase === "REGULAR_SEASON" && r >= 7) {
      const standings = this.getStandings();
      const userRank = standings.findIndex((s) => s.clubId === this.state.userClubId) + 1;
      if (userRank <= 4) {
        this.state.fixtures.push(
          {
            id: "fix_semi_1",
            round: 8,
            stage: "semi",
            homeClubId: standings[0].clubId,
            awayClubId: standings[3].clubId,
            played: false,
            homeGoals: 0,
            awayGoals: 0,
            homeXG: 0,
            awayXG: 0
          },
          {
            id: "fix_semi_2",
            round: 8,
            stage: "semi",
            homeClubId: standings[1].clubId,
            awayClubId: standings[2].clubId,
            played: false,
            homeGoals: 0,
            awayGoals: 0,
            homeXG: 0,
            awayXG: 0
          }
        );
        this.state.currentRound = 8;
        this.state.phase = "PLAYOFF_SEMI";
      } else {
        this.finalizeSeason(userRank);
      }
      return;
    }
    if (this.state.phase === "PLAYOFF_SEMI") {
      const semis = this.state.fixtures.filter((f) => f.stage === "semi");
      const w1 = semis[0].homeGoals >= semis[0].awayGoals ? semis[0].homeClubId : semis[0].awayClubId;
      const l1 = w1 === semis[0].homeClubId ? semis[0].awayClubId : semis[0].homeClubId;
      const w2 = semis[1].homeGoals >= semis[1].awayGoals ? semis[1].homeClubId : semis[1].awayClubId;
      const l2 = w2 === semis[1].homeClubId ? semis[1].awayClubId : semis[1].homeClubId;
      this.state.fixtures.push(
        {
          id: "fix_final",
          round: 9,
          stage: "final",
          homeClubId: w1,
          awayClubId: w2,
          played: false,
          homeGoals: 0,
          awayGoals: 0,
          homeXG: 0,
          awayXG: 0
        },
        {
          id: "fix_third",
          round: 9,
          stage: "third",
          homeClubId: l1,
          awayClubId: l2,
          played: false,
          homeGoals: 0,
          awayGoals: 0,
          homeXG: 0,
          awayXG: 0
        }
      );
      this.state.currentRound = 9;
      this.state.phase = "PLAYOFF_FINAL";
      return;
    }
    if (this.state.phase === "PLAYOFF_FINAL") {
      const finalFx = this.state.fixtures.find((f) => f.stage === "final");
      const thirdFx = this.state.fixtures.find((f) => f.stage === "third");
      const champId = finalFx.homeGoals >= finalFx.awayGoals ? finalFx.homeClubId : finalFx.awayClubId;
      const runnerUpId = champId === finalFx.homeClubId ? finalFx.awayClubId : finalFx.homeClubId;
      const thirdId = thirdFx.homeGoals >= thirdFx.awayGoals ? thirdFx.homeClubId : thirdFx.awayClubId;
      const finalRank = this.state.userClubId === champId ? 1 : this.state.userClubId === runnerUpId ? 2 : this.state.userClubId === thirdId ? 3 : 4;
      this.finalizeSeason(finalRank);
      return;
    }
    this.state.currentRound = r + 1;
  }
  // ==================== 4. Re-Draft 补强 ====================
  swapPlayerInReDraft(dropPlayerId, pickCandidateId) {
    if (this.state.phase !== "RE_DRAFT" || !this.state.reDraft) {
      return { ok: false, reason: "\u5F53\u524D\u4E0D\u5728 Re-Draft \u9636\u6BB5" };
    }
    const rd = this.state.reDraft;
    if (rd.swapsUsed >= rd.maxSwaps) {
      return { ok: false, reason: "\u672C\u8F6E\u66F4\u6362\u540D\u989D\u5DF2\u7528\u5B8C" };
    }
    const club = this.getUserClub();
    const dropIdx = club.squad.findIndex((p) => p.id === dropPlayerId);
    const pickIdx = rd.candidates.findIndex((p) => p.id === pickCandidateId);
    if (dropIdx < 0 || pickIdx < 0) {
      return { ok: false, reason: "\u65E0\u6548\u7684\u7403\u5458\u9009\u62E9" };
    }
    const picked = rd.candidates.splice(pickIdx, 1)[0];
    club.squad[dropIdx] = picked;
    const starterIdx = club.starterIds.indexOf(dropPlayerId);
    if (starterIdx >= 0) {
      club.starterIds[starterIdx] = picked.id;
    }
    rd.swapsUsed++;
    return { ok: true };
  }
  chooseReDraftPerk(perkId) {
    if (this.state.phase !== "RE_DRAFT" || !this.state.reDraft) return { ok: false };
    const perk = this.state.reDraft.perkChoices.find((p) => p.id === perkId);
    if (!perk) return { ok: false };
    const club = this.getUserClub();
    club.perks.push(perk);
    this.state.reDraft.perkChosen = true;
    return { ok: true };
  }
  finishReDraft() {
    if (this.state.phase !== "RE_DRAFT") return;
    const club = this.getUserClub();
    club.starterIds = autoSelectStarters(club.squad, club.formation);
    this.state.reDraft = null;
    this.state.phase = "REGULAR_SEASON";
    this.state.currentRound++;
  }
  // ==================== 5. 赛季结算与排行榜 ====================
  getTopScorers(limit = 5) {
    const all = [];
    for (const c of this.state.clubs) {
      for (const p of c.squad) {
        if (p.seasonStats.goals > 0 || p.seasonStats.assists > 0) {
          all.push({
            playerName: p.name,
            clubName: c.name,
            goals: p.seasonStats.goals,
            assists: p.seasonStats.assists
          });
        }
      }
    }
    return all.sort((a, b) => b.goals !== a.goals ? b.goals - a.goals : b.assists - a.assists).slice(0, limit);
  }
  finalizeSeason(finalRank) {
    const standings = this.getStandings();
    const regularRank = standings.findIndex((s) => s.clubId === this.state.userClubId) + 1;
    const userRow = standings[regularRank - 1];
    const metaEarned = finalRank === 1 ? 150 : finalRank === 2 ? 90 : finalRank === 3 ? 60 : finalRank === 4 ? 40 : Math.max(15, 35 - (finalRank - 4) * 5);
    this.state.metaPointsTotal += metaEarned;
    const top = this.getTopScorers(1)[0];
    const summary = {
      finalRank,
      isChampion: finalRank === 1,
      regularRank,
      points: userRow?.points ?? 0,
      gf: userRow?.gf ?? 0,
      ga: userRow?.ga ?? 0,
      metaPointsEarned: metaEarned,
      topScorer: top ? { name: top.playerName, clubName: top.clubName, goals: top.goals } : null
    };
    this.state.lastSummary = summary;
    this.state.phase = "SEASON_END";
  }
};

// ../../../WorkBuddy/fb2/fm-league/packages/core/src/sim-season.ts
function runFullSeasonTest() {
  const t0 = Date.now();
  const lm = new LeagueManager();
  const pool = lm.getState().draft.currentPool;
  lm.pickDraftPlayer(pool[0].id);
  lm.pickDraftPlayer(pool[1].id);
  lm.autoCompleteDraft();
  const club = lm.getUserClub();
  console.log(`1) \u9009\u79C0\u5B8C\u6210: ${club.name} (${club.squad.length}\u4EBA), \u9996\u53D1 ${club.starterIds.length} \u4EBA, \u5269\u4F59\u9884\u7B97 ${lm.getState().draft.budgetRemaining}`);
  while (lm.getState().phase !== "SEASON_END") {
    const st = lm.getState();
    if (st.phase === "RE_DRAFT" && st.reDraft) {
      const weakest = [...lm.getUserClub().squad].filter((p) => p.role !== "GK").sort((a, b) => a.ca - b.ca)[0];
      const bestNew = st.reDraft.candidates[0];
      if (weakest && bestNew) {
        lm.swapPlayerInReDraft(weakest.id, bestNew.id);
      }
      if (st.reDraft.perkChoices[0]) {
        lm.chooseReDraftPerk(st.reDraft.perkChoices[0].id);
      }
      lm.finishReDraft();
      continue;
    }
    const engine = lm.createUserMatchEngine();
    const res = engine.simulateMatch();
    lm.completeCurrentRoundWithUserResult(res);
  }
  const savedJson = lm.serialize();
  const restored = LeagueManager.deserialize(savedJson);
  const summary = restored.getState().lastSummary;
  const standings = restored.getStandings();
  console.log(`
2) \u8D5B\u5B63\u7ED3\u675F! \u8017\u65F6: ${Date.now() - t0} ms | \u5B58\u6863 JSON \u5927\u5C0F: ${(savedJson.length / 1024).toFixed(1)} KB`);
  console.log(`   \u6700\u7EC8\u540D\u6B21: \u7B2C ${summary.finalRank} \u540D (\u5E38\u89C4\u8D5B\u7B2C ${summary.regularRank} \u540D, ${summary.points} \u5206) | \u83B7\u5F97 Meta \u70B9\u6570: +${summary.metaPointsEarned}`);
  if (summary.topScorer) {
    console.log(`   \u8054\u8D5B\u91D1\u9774: ${summary.topScorer.name} (${summary.topScorer.clubName}) - ${summary.topScorer.goals} \u7403`);
  }
  console.log("\n3) \u5E38\u89C4\u8D5B\u6700\u7EC8\u79EF\u5206\u699C:");
  standings.forEach((row, idx) => {
    const tag = row.isUser ? " \u2605" : "";
    console.log(
      `   ${idx + 1}. ${row.clubName.padEnd(6, "\u3000")}${tag} | \u8D5B${row.played} \u80DC${row.won} \u5E73${row.drawn} \u8D1F${row.lost} | \u8FDB${row.gf} \u5931${row.ga} \u51C0${row.gd >= 0 ? "+" + row.gd : row.gd} | ${row.points}\u5206`
    );
  });
}
runFullSeasonTest();
