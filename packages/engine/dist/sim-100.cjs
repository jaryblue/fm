"use strict";

// src/types.ts
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
    tempo: 0.94,
    pressDistance: 12,
    pressIntensity: 0.93,
    shootBias: 0.92
  },
  tiki_taka: {
    name: "\u4F20\u63A7\u6E17\u900F",
    lineHeight: 4,
    widthScale: 0.9,
    directness: 0.46,
    tempo: 1.15,
    pressDistance: 15,
    pressIntensity: 1.15,
    shootBias: 1.12
  },
  gegenpress: {
    name: "\u9AD8\u4F4D\u903C\u62A2",
    lineHeight: 6,
    widthScale: 1.02,
    directness: 0.6,
    tempo: 1.22,
    pressDistance: 19,
    pressIntensity: 1.32,
    shootBias: 1.12
  },
  counter: {
    name: "\u5FEB\u901F\u53CD\u51FB",
    lineHeight: -6,
    widthScale: 0.96,
    directness: 0.82,
    tempo: 1.1,
    pressDistance: 11,
    pressIntensity: 0.95,
    shootBias: 1.16
  },
  wing_play: {
    name: "\u4E24\u7FFC\u9F50\u98DE",
    lineHeight: 4,
    widthScale: 1.07,
    directness: 0.57,
    tempo: 1.04,
    pressDistance: 14,
    pressIntensity: 1.04,
    shootBias: 1.02
  },
  park_bus: {
    name: "\u94C1\u6876\u9632\u53CD",
    lineHeight: -6,
    widthScale: 0.9,
    directness: 0.78,
    tempo: 1.04,
    pressDistance: 11,
    pressIntensity: 0.95,
    shootBias: 1.08
  }
};

// src/formations.ts
function gridToPitch(col, row) {
  const c = Math.max(0, Math.min(4, Math.round(col)));
  const r = Math.max(0, Math.min(5, Math.round(row)));
  return {
    baseX: 14 + r * 13,
    baseY: 10 + c * 12
  };
}
function getDefenseSystem(f) {
  if (f.startsWith("3-")) return "3-back";
  if (f.startsWith("5-")) return "5-back";
  return "4-back";
}
var FORMATIONS = {
  // ==================== 四后卫体系 (8种) ====================
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
  "4-4-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 25, baseY: 11 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 25, baseY: 57 },
    { role: "LM", baseX: 55, baseY: 12 },
    { role: "CM", baseX: 48, baseY: 27 },
    { role: "CM", baseX: 48, baseY: 41 },
    { role: "RM", baseX: 55, baseY: 56 },
    { role: "ST", baseX: 73, baseY: 26 },
    { role: "ST", baseX: 73, baseY: 42 }
  ],
  "4-1-2-1-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 25, baseY: 10 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 25, baseY: 58 },
    { role: "CDM", baseX: 38, baseY: 34 },
    { role: "CM", baseX: 50, baseY: 22 },
    { role: "CM", baseX: 50, baseY: 46 },
    { role: "CAM", baseX: 61, baseY: 34 },
    { role: "ST", baseX: 74, baseY: 26 },
    { role: "ST", baseX: 74, baseY: 42 }
  ],
  "4-4-1-1": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 24, baseY: 11 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 24, baseY: 57 },
    { role: "LM", baseX: 52, baseY: 12 },
    { role: "CM", baseX: 46, baseY: 27 },
    { role: "CM", baseX: 46, baseY: 41 },
    { role: "RM", baseX: 52, baseY: 56 },
    { role: "CAM", baseX: 64, baseY: 34 },
    { role: "ST", baseX: 75, baseY: 34 }
  ],
  "4-1-4-1": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 24, baseY: 11 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 24, baseY: 57 },
    { role: "CDM", baseX: 36, baseY: 34 },
    { role: "LM", baseX: 55, baseY: 11 },
    { role: "CM", baseX: 54, baseY: 26 },
    { role: "CM", baseX: 54, baseY: 42 },
    { role: "RM", baseX: 55, baseY: 57 },
    { role: "ST", baseX: 74, baseY: 34 }
  ],
  "4-2-2-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 25, baseY: 10 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 25, baseY: 58 },
    { role: "CDM", baseX: 40, baseY: 26 },
    { role: "CDM", baseX: 40, baseY: 42 },
    { role: "CAM", baseX: 59, baseY: 21 },
    { role: "CAM", baseX: 59, baseY: 47 },
    { role: "ST", baseX: 74, baseY: 26 },
    { role: "ST", baseX: 74, baseY: 42 }
  ],
  "4-3-2-1": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LB", baseX: 25, baseY: 10 },
    { role: "CB", baseX: 22, baseY: 26 },
    { role: "CB", baseX: 22, baseY: 42 },
    { role: "RB", baseX: 25, baseY: 58 },
    { role: "CM", baseX: 45, baseY: 21 },
    { role: "CDM", baseX: 41, baseY: 34 },
    { role: "CM", baseX: 45, baseY: 47 },
    { role: "CAM", baseX: 62, baseY: 24 },
    { role: "CAM", baseX: 62, baseY: 44 },
    { role: "ST", baseX: 75, baseY: 34 }
  ],
  // ==================== 三后卫体系 (4种) ====================
  "3-5-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 17 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 51 },
    { role: "LWB", baseX: 46, baseY: 9 },
    { role: "CDM", baseX: 42, baseY: 34 },
    { role: "CM", baseX: 56, baseY: 24 },
    { role: "CM", baseX: 56, baseY: 44 },
    { role: "RWB", baseX: 46, baseY: 59 },
    { role: "ST", baseX: 73, baseY: 26 },
    { role: "ST", baseX: 73, baseY: 42 }
  ],
  "3-4-3": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 17 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 51 },
    { role: "LWB", baseX: 46, baseY: 9 },
    { role: "CM", baseX: 47, baseY: 27 },
    { role: "CM", baseX: 47, baseY: 41 },
    { role: "RWB", baseX: 46, baseY: 59 },
    { role: "LW", baseX: 69, baseY: 14 },
    { role: "ST", baseX: 74, baseY: 34 },
    { role: "RW", baseX: 69, baseY: 54 }
  ],
  "3-4-2-1": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 17 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 51 },
    { role: "LWB", baseX: 47, baseY: 9 },
    { role: "CDM", baseX: 45, baseY: 27 },
    { role: "CDM", baseX: 45, baseY: 41 },
    { role: "RWB", baseX: 47, baseY: 59 },
    { role: "CAM", baseX: 62, baseY: 23 },
    { role: "CAM", baseX: 62, baseY: 45 },
    { role: "ST", baseX: 75, baseY: 34 }
  ],
  "3-4-1-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 17 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 22, baseY: 51 },
    { role: "LWB", baseX: 46, baseY: 9 },
    { role: "CM", baseX: 45, baseY: 27 },
    { role: "CM", baseX: 45, baseY: 41 },
    { role: "RWB", baseX: 46, baseY: 59 },
    { role: "CAM", baseX: 61, baseY: 34 },
    { role: "ST", baseX: 74, baseY: 26 },
    { role: "ST", baseX: 74, baseY: 42 }
  ],
  // ==================== 五后卫体系 (4种) ====================
  "5-4-1": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LWB", baseX: 28, baseY: 9 },
    { role: "CB", baseX: 21, baseY: 21 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 21, baseY: 47 },
    { role: "RWB", baseX: 28, baseY: 59 },
    { role: "LM", baseX: 50, baseY: 13 },
    { role: "CM", baseX: 47, baseY: 27 },
    { role: "CM", baseX: 47, baseY: 41 },
    { role: "RM", baseX: 50, baseY: 55 },
    { role: "ST", baseX: 71, baseY: 34 }
  ],
  "5-3-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LWB", baseX: 27, baseY: 9 },
    { role: "CB", baseX: 21, baseY: 21 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 21, baseY: 47 },
    { role: "RWB", baseX: 27, baseY: 59 },
    { role: "CDM", baseX: 40, baseY: 34 },
    { role: "CM", baseX: 48, baseY: 23 },
    { role: "CM", baseX: 48, baseY: 45 },
    { role: "ST", baseX: 69, baseY: 26 },
    { role: "ST", baseX: 69, baseY: 42 }
  ],
  "5-2-3": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LWB", baseX: 28, baseY: 9 },
    { role: "CB", baseX: 21, baseY: 21 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 21, baseY: 47 },
    { role: "RWB", baseX: 28, baseY: 59 },
    { role: "CDM", baseX: 43, baseY: 27 },
    { role: "CDM", baseX: 43, baseY: 41 },
    { role: "LW", baseX: 67, baseY: 14 },
    { role: "ST", baseX: 72, baseY: 34 },
    { role: "RW", baseX: 67, baseY: 54 }
  ],
  "5-2-1-2": [
    { role: "GK", baseX: 5, baseY: 34 },
    { role: "LWB", baseX: 28, baseY: 9 },
    { role: "CB", baseX: 21, baseY: 21 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 21, baseY: 47 },
    { role: "RWB", baseX: 28, baseY: 59 },
    { role: "CM", baseX: 43, baseY: 27 },
    { role: "CM", baseX: 43, baseY: 41 },
    { role: "CAM", baseX: 58, baseY: 34 },
    { role: "ST", baseX: 71, baseY: 26 },
    { role: "ST", baseX: 71, baseY: 42 }
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
function getDynamicAnchor(slot, ballPos, dir, hasPossession, style, _formation, mods, duty) {
  const preset = TACTICAL_PRESETS[style];
  const relBallX = toRelativeX(ballPos.x, dir);
  const ballOffsetFromCenterY = ballPos.y - PITCH.HALF_Y;
  if (slot.role === "GK") {
    const gkRelX = clamp(3 + (relBallX < 30 ? (30 - relBallX) * 0.12 : 0), 2.5, 9);
    const gkY = clamp(PITCH.HALF_Y + ballOffsetFromCenterY * 0.22, 27, 41);
    return { x: toAbsoluteX(gkRelX, dir), y: gkY };
  }
  const possShift = hasPossession === true ? 5 : hasPossession === false ? -6 : 0;
  const lineMod = clamp(mods?.lineShift ?? 0, -8, 8) * 0.6;
  const blockShiftX = (relBallX - PITCH.HALF_X) * 0.52 + preset.lineHeight * 0.65 + possShift + lineMod;
  const compactX = hasPossession === false ? 0.78 : 0.96;
  let roleModX = 0;
  let roleModY = 0;
  if (hasPossession === true) {
    if ((style === "park_bus" || style === "counter") && ["ST", "LW", "RW", "CAM"].includes(slot.role)) {
      roleModX += 9;
    }
    if (slot.role === "ST" && (mods?.falseNineDrop ?? 0) > 0 && relBallX >= 36 && relBallX <= 66) {
      roleModX = -Math.min(6, (mods?.falseNineDrop ?? 0) * 0.5);
    } else if (slot.role === "LB" || slot.role === "RB" || slot.role === "LWB" || slot.role === "RWB") {
      const isLeft = slot.baseY < PITCH.HALF_Y;
      const onFlank = isLeft ? ballPos.y < PITCH.HALF_Y + 6 : ballPos.y > PITCH.HALF_Y - 6;
      if (onFlank || mods?.dualOverlap) {
        roleModX = 8 + clamp(mods?.overlapDepthBonus ?? 0, 0, 12) * 0.6;
      }
    }
    if (duty === "false_nine") roleModX -= 8;
    else if (duty === "target_man") roleModX += 2;
    else if (duty === "poacher") roleModX += 6;
    else if (duty === "inverted_fb") {
      roleModX += 4;
      roleModY += slot.baseY < PITCH.HALF_Y ? 11 : -11;
    } else if (duty === "wing_back") {
      roleModX += 7;
      roleModY += slot.baseY < PITCH.HALF_Y ? -3 : 3;
    } else if (duty === "regista") roleModX -= 5;
    else if (duty === "box_to_box") roleModX += 6;
    else if (duty === "mezzala") {
      roleModX += 6;
      roleModY += slot.baseY < PITCH.HALF_Y ? -4 : 4;
    } else if (duty === "inside_forward") {
      roleModX += 4;
      roleModY += slot.baseY < PITCH.HALF_Y ? 9 : -9;
    } else if (duty === "classic_winger") {
      roleModY += slot.baseY < PITCH.HALF_Y ? -4 : 4;
    }
  } else if (hasPossession === false && duty === "box_to_box") {
    roleModX -= 4;
  }
  const targetRelX = clamp(22 + (slot.baseX - 22) * compactX + blockShiftX + roleModX, 11, 88);
  const widthFactor = preset.widthScale * (hasPossession === false ? 0.84 : 1);
  const targetY = clamp(
    PITCH.HALF_Y + (slot.baseY - PITCH.HALF_Y) * widthFactor + ballOffsetFromCenterY * 0.28 + roleModY,
    5,
    PITCH.WIDTH - 5
  );
  return {
    x: toAbsoluteX(targetRelX, dir),
    y: targetY
  };
}

// src/physics.ts
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
    const fatigueFactor = p.fitness >= 65 ? 0.9 + (p.fitness - 65) / 35 * 0.1 : 0.58 + p.fitness / 65 * 0.32;
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

// src/evaluator.ts
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

// src/decision.ts
var WIDE_ROLES = /* @__PURE__ */ new Set(["LW", "RW", "LM", "RM", "LB", "RB", "LWB", "RWB"]);
function decideOnBall(holder, attackDir, style, players, ball, mods) {
  const preset = TACTICAL_PRESETS[style];
  const relX = toRelativeX(holder.pos.x, attackDir);
  const currentXT = evaluateXT(holder.pos, attackDir);
  if (holder.role === "GK") {
    const mates = players.filter((p) => p.team === holder.team && p.id !== holder.id && !p.redCard).sort((a, b) => dist2D(holder.pos, a.pos) - dist2D(holder.pos, b.pos));
    if (style === "counter") {
      const forwardMate2 = mates.find((m) => dist2D(holder.pos, m.pos) > 28) || mates[mates.length - 1] || mates[0];
      return { type: "pass", target: forwardMate2, passType: "long" };
    }
    if (mods?.gkQuickLaunch) {
      const safeLong = mates.find((m) => {
        const d = dist2D(holder.pos, m.pos);
        return d > 26 && d < 52 && evaluatePassCompletion(holder, m, players, true) > 0.62;
      });
      if (safeLong) return { type: "pass", target: safeLong, passType: "long" };
    }
    for (const m of mates) {
      const d = dist2D(holder.pos, m.pos);
      if (d < 10) continue;
      const oppNear = players.some((o) => o.team !== holder.team && !o.redCard && dist2D(o.pos, m.pos) < 5);
      if (oppNear) continue;
      const prob = evaluatePassCompletion(holder, m, players, false);
      if (prob > 0.65) {
        return { type: "pass", target: m, passType: d > 25 ? "long" : "short" };
      }
    }
    const forwardMate = mates[mates.length - 1] || mates[0];
    return { type: "pass", target: forwardMate, passType: "long" };
  }
  let bestScore = -Infinity;
  let bestAction = null;
  const goalX = attackDir === 1 ? PITCH.LENGTH : 0;
  const distToGoal = dist2D(holder.pos, { x: goalX, y: PITCH.GOAL_Y });
  const longShotDelta = clamp(mods?.longShotBias ?? 0, -0.1, 0.14);
  const maxShootDist = longShotDelta > 0.03 ? 29 : 27;
  const minShootXG = 0.03;
  if (distToGoal < maxShootDist) {
    const xG = computeShotXG(holder, attackDir, players);
    const isWideAttacker = holder.role === "LW" || holder.role === "RW" || holder.role === "LM" || holder.role === "RM";
    const isMidCrasher = holder.role === "CM" || holder.role === "CDM";
    const isAttacker = holder.role === "ST" || holder.role === "CAM" || isWideAttacker || isMidCrasher && relX > 66;
    const roleShootMul = holder.role === "CB" ? distToGoal < 12 ? 0.95 : 0.42 : isAttacker ? 1.24 : 0.85;
    const boxBonus = distToGoal < 12 ? 0.46 : distToGoal < 17 ? 0.34 : distToGoal < 21 ? 0.06 : -0.18;
    const wingCutInBonus = isWideAttacker && relX >= 68 ? style === "tiki_taka" ? 0.24 : style === "gegenpress" ? 0.22 : style === "counter" ? 0.2 : style === "wing_play" ? 0.14 : 0.18 : 0;
    const midCrashBonus = isMidCrasher && relX >= 70 ? style === "tiki_taka" || style === "gegenpress" ? 0.22 : 0.14 : 0;
    const longShotMod = distToGoal >= 18 ? longShotDelta : 0;
    const dutyShootBonus = holder.duty === "poacher" ? 0.2 : holder.duty === "inside_forward" ? 0.18 : holder.duty === "target_man" ? 0.1 : holder.duty === "false_nine" || holder.duty === "regista" ? -0.1 : 0;
    const shootScore = (0.2 + xG * 3.8 + boxBonus) * preset.shootBias * roleShootMul + longShotMod + wingCutInBonus + midCrashBonus + dutyShootBonus;
    if (xG >= minShootXG && shootScore > bestScore) {
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
    const crossMinX = style === "wing_play" || (mods?.crossBias ?? 0) > 0.03 ? 60 : 66;
    const crossMateMinX = style === "wing_play" || (mods?.crossBias ?? 0) > 0.03 ? 72 : 78;
    const isCross = relX > crossMinX && (holder.pos.y < 20 || holder.pos.y > PITCH.WIDTH - 20) && Math.abs(mate.pos.y - PITCH.HALF_Y) < 18 && mateRelX > crossMateMinX;
    const isThrough = mateRelX - relX > 10 && mateRelX > 58 && d > 13;
    const passType = isCross ? "cross" : isThrough ? "through" : d > 26 ? "long" : "short";
    const isLofted = passType === "cross" || passType === "long";
    const rawComp = evaluatePassCompletion(holder, mate, players, isLofted);
    const pComp = style === "tiki_taka" && passType === "short" ? Math.min(0.98, rawComp + 0.08) : rawComp;
    const mateXT = evaluateXT(mate.pos, attackDir);
    const progressGain = (mateRelX - relX) / 105;
    let styleBias = progressGain * (preset.directness - 0.35) * 0.32;
    if (style === "tiki_taka") {
      if (relX < 74 && passType === "short" && d < 22) styleBias += progressGain > 0 ? 0.18 : 0.06;
      if (passType === "long") styleBias -= 0.16;
      if (isCross) styleBias -= 0.12;
      if (relX > 66 && progressGain > 0.04 && passType === "through") styleBias += 0.12;
    } else if (style === "wing_play") {
      const mateWide = mate.pos.y < 19 || mate.pos.y > PITCH.WIDTH - 19 || WIDE_ROLES.has(mate.role);
      if (relX < 56 && mateWide && mateRelX >= relX - 2) styleBias += 0.08;
      if (isCross) styleBias += 0.22;
      if (isCross && (holder.role === "LB" || holder.role === "RB" || holder.role === "LWB" || holder.role === "RWB")) styleBias += 0.1;
    } else if (style === "counter") {
      if ((passType === "through" || passType === "long") && progressGain > 0.12) styleBias += 0.24;
      if (progressGain < 0) styleBias -= 0.14;
    } else if (style === "park_bus") {
      if (progressGain > 0.08) styleBias += 0.14;
      if (relX < 40 && passType === "long" && progressGain > 0.18) styleBias += 0.12;
      if (relX < 44 && progressGain <= 0) styleBias -= 0.12;
    } else if (style === "gegenpress") {
      if (progressGain > 0.05 && (passType === "through" || passType === "short")) styleBias += 0.12;
      if (isCross) styleBias -= 0.06;
    }
    const crossMul = holder.goldTraits?.includes("\u7CBE\u51C6\u4F20\u4E2D") ? 2 : 1;
    const throughMul = holder.goldTraits?.includes("\u81F4\u547D\u76F4\u585E") ? 2 : 1;
    const wingTraitBonus = isCross && holder.traits?.includes("\u7CBE\u51C6\u4F20\u4E2D") ? 0.1 * crossMul : 0;
    const throughTraitBonus = isThrough && holder.traits?.includes("\u81F4\u547D\u76F4\u585E") ? 0.12 * throughMul : 0;
    const dutyPassBonus = (holder.duty === "false_nine" || holder.duty === "regista") && (passType === "short" || passType === "through") ? 0.12 : holder.duty === "classic_winger" && isCross ? 0.15 : holder.duty === "wing_back" && isCross ? 0.12 : 0;
    const passBiasScale = relX < 76 ? 1 : 0.25;
    const modPassBias = passBiasScale * (passType === "through" ? clamp(mods?.throughPassBias ?? 0, -0.1, 0.14) : passType === "cross" ? clamp(mods?.crossBias ?? 0, -0.1, 0.14) : passType === "short" ? clamp(mods?.shortPassBias ?? 0, -0.1, 0.14) : 0);
    const antiPingPong = ball.lastPasserId === mate.id ? relX >= 64 ? -0.26 : -0.14 : 0;
    const avoidGK = mate.role === "GK" ? style === "tiki_taka" ? -0.06 : -0.16 : 0;
    let finalThirdMod = 0;
    if (relX >= 68) {
      const dxRel = mateRelX - relX;
      if (dxRel < -3.5) {
        finalThirdMod = -0.19;
      } else if (Math.abs(dxRel) <= 3.5 && mateRelX < 84) {
        finalThirdMod = style === "tiki_taka" ? -0.05 : -0.13;
      } else if (dxRel > 4 && mateRelX >= 76) {
        finalThirdMod = 0.11;
      }
      if (isCross && mateRelX >= 76) finalThirdMod += 0.12;
      if (isThrough && mateRelX >= 74) finalThirdMod += 0.1;
    }
    const passScore = pComp * (mateXT + 0.14) - (1 - pComp) * 0.18 + styleBias + modPassBias + wingTraitBonus + throughTraitBonus + dutyPassBonus + antiPingPong + avoidGK + finalThirdMod;
    if (passScore > bestScore) {
      bestScore = passScore;
      bestAction = { type: "pass", target: mate, passType };
    }
  }
  const dribbleStep = 8;
  const isWidePlayer = WIDE_ROLES.has(holder.role);
  const hugWingY = style === "wing_play" && isWidePlayer && relX < 62 ? holder.pos.y < PITCH.HALF_Y ? -1.4 : 1.4 : isWidePlayer && relX >= 58 && (style === "tiki_taka" || style === "gegenpress" || style === "balanced") ? holder.pos.y < PITCH.HALF_Y ? 5.2 : -5.2 : isWidePlayer && relX >= 64 ? holder.pos.y < PITCH.HALF_Y ? 4.4 : -4.4 : holder.pos.y < 16 ? 3.5 : holder.pos.y > PITCH.WIDTH - 16 ? -3.5 : 0;
  const dribbleTarget = {
    x: clamp(holder.pos.x + attackDir * dribbleStep, 4, PITCH.LENGTH - 4),
    y: clamp(holder.pos.y + hugWingY + (Math.random() - 0.5) * 3, 4, PITCH.WIDTH - 4)
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
  const finalThirdDriveBonus = relX >= 62 && relX < 88 && nearestFrontOpp > 3.5 && holder.role !== "CB" ? 0.12 : 0;
  const roleDribbleBias = holder.role === "LW" || holder.role === "RW" || holder.role === "CAM" || (holder.role === "LM" || holder.role === "RM" || holder.role === "LWB" || holder.role === "RWB") && relX > 52 ? 0.08 : holder.role === "CB" || holder.role === "CDM" ? -0.18 : -0.05;
  const styleDribbleBias = style === "tiki_taka" ? -0.05 : style === "wing_play" && isWidePlayer ? 0.1 : style === "counter" && relX > 45 && nearestFrontOpp > 6 ? 0.1 : 0;
  const dribbleScore = (currentXT * 0.35 + dribbleXT * 0.58) * (0.68 + dribbleSkill * 0.3) + spaceBonus + finalThirdDriveBonus + roleDribbleBias + styleDribbleBias;
  if (!bestAction || dribbleScore > bestScore) {
    bestAction = { type: "dribble", targetPos: dribbleTarget };
  }
  return bestAction;
}
function updateOffBallTargets(players, ball, homeDir, homeStyle, awayStyle, homeFormation, awayFormation, homeMods, awayMods) {
  const holder = ball.holderId ? players.find((p) => p.id === ball.holderId) : null;
  const ballTeam = holder ? holder.team : ball.lastTouchTeam;
  const pressers = /* @__PURE__ */ new Set();
  const defendingTeam = ballTeam === "home" ? "away" : ballTeam === "away" ? "home" : null;
  if (defendingTeam) {
    const defDir = defendingTeam === "home" ? homeDir : homeDir === 1 ? -1 : 1;
    const defBallRelX = toRelativeX(ball.pos.x, defDir);
    const defStyle = defendingTeam === "home" ? homeStyle : awayStyle;
    const defForm = defendingTeam === "home" ? homeFormation : awayFormation;
    const defMods = defendingTeam === "home" ? homeMods : awayMods;
    const isLowBlock = defStyle === "park_bus" || getDefenseSystem(defForm) === "5-back";
    const preset = TACTICAL_PRESETS[defStyle];
    const pressDist = preset.pressDistance + clamp(defMods?.pressDistBonus ?? 0, 0, 8);
    const defPlayers = players.filter((p) => {
      if (p.team !== defendingTeam || p.redCard || p.role === "GK") return false;
      if (defStyle !== "gegenpress" && defBallRelX < 46 && p.role === "ST") return false;
      return true;
    }).sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos));
    const shouldCBHold = (p) => {
      if (p.role !== "CB") return false;
      if (ball.mode === "loose") return false;
      if (defBallRelX >= 18) return true;
      return false;
    };
    const primaryPresser = defPlayers.find((p) => !shouldCBHold(p) && (dist2D(p.pos, ball.pos) < pressDist + 10 || ball.mode === "loose"));
    if (primaryPresser) {
      pressers.add(primaryPresser.id);
    } else if (defPlayers[0] && (defBallRelX < 18 || ball.mode === "loose")) {
      pressers.add(defPlayers[0].id);
    }
    const allowMultiPress = defBallRelX >= 48 || defStyle === "gegenpress";
    const secondPresser = defPlayers.find((p) => p.id !== primaryPresser?.id && !shouldCBHold(p));
    if (secondPresser && allowMultiPress && (preset.pressIntensity >= 1.1 || defMods?.extraPresser) && dist2D(secondPresser.pos, ball.pos) < pressDist + 3) {
      pressers.add(secondPresser.id);
    }
    const thirdPresser = defPlayers.find((p) => !pressers.has(p.id) && p.role !== "CB");
    if (thirdPresser && allowMultiPress && (defStyle === "gegenpress" || defMods?.extraPresser) && dist2D(thirdPresser.pos, ball.pos) < pressDist) {
      pressers.add(thirdPresser.id);
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
      p.targetPos = {
        x: clamp(ball.pos.x + ball.vel.x * 0.25, 2, PITCH.LENGTH - 2),
        y: clamp(ball.pos.y + ball.vel.y * 0.25, 2, PITCH.WIDTH - 2)
      };
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
    const formation = p.team === "home" ? homeFormation : awayFormation;
    const teamMods = p.team === "home" ? homeMods : awayMods;
    const slots = FORMATIONS[formation];
    const slot = slots[p.slotIndex] || slots[0];
    const hasPossession = ballTeam === null ? null : ballTeam === p.team;
    const rawAnchor = getDynamicAnchor(slot, ball.pos, dir, hasPossession, style, formation, teamMods, p.duty);
    const offsideX = getOffsideLineX(p.team, dir, players);
    const ballLimitX = holder ? holder.pos.x : ball.pos.x;
    const onsideMaxX = dir === 1 ? Math.max(offsideX - 1.6, ballLimitX - 0.5) : Math.min(offsideX + 1.6, ballLimitX + 0.5);
    const clampOnside = (x) => p.role === "GK" ? x : dir === 1 ? Math.min(x, onsideMaxX) : Math.max(x, onsideMaxX);
    let tx = rawAnchor.x + (p.customOffset ? dir * p.customOffset.x : 0);
    let ty = rawAnchor.y + (p.customOffset ? p.customOffset.y : 0);
    if (hasPossession === false && (p.role === "CB" || p.role === "CDM" || p.role === "LB" || p.role === "RB" || p.role === "LWB" || p.role === "RWB")) {
      const ballRelX = toRelativeX(ball.pos.x, dir);
      const myRelX = toRelativeX(p.pos.x, dir);
      if (ballRelX < 44 && dist2D(p.pos, ball.pos) < 18) {
        const jockeyGap = style === "park_bus" || style === "counter" ? 4.2 : 3.4;
        const jockeyX = dir === 1 ? Math.max(6, ball.pos.x - jockeyGap) : Math.min(PITCH.LENGTH - 6, ball.pos.x + jockeyGap);
        if (myRelX > ballRelX - 4.5) {
          tx = jockeyX;
          ty = ty * 0.45 + (ball.pos.y * 0.75 + PITCH.GOAL_Y * 0.25) * 0.55;
        }
      }
    }
    if (hasPossession && holder) {
      const holderRelX = toRelativeX(holder.pos.x, dir);
      const isCounterStyle = style === "park_bus" || style === "counter" || getDefenseSystem(formation) === "5-back";
      const triggerRelX = isCounterStyle ? 24 : 46;
      const isSingleStrikerForm = formation === "5-4-1" || formation === "4-1-4-1" || formation === "4-4-1-1";
      const isAttRole = p.role === "ST" || p.role === "CAM" || p.role === "LW" || p.role === "RW" || p.role === "LM" || p.role === "RM" || (isCounterStyle || style === "wing_play") && (p.role === "LWB" || p.role === "RWB") || (isSingleStrikerForm || style === "balanced" || style === "tiki_taka" || (teamMods?.boxCrashBonus ?? 0) > 0) && p.role === "CM";
      if (isAttRole && holderRelX > triggerRelX) {
        tx += dir * (isCounterStyle ? 12 : p.role === "LM" || p.role === "RM" || p.role === "CM" ? 10 : 8);
        if (holderRelX > 64) {
          const targetInwardY = style === "wing_play" && (p.role === "LW" || p.role === "RW") && Math.abs(holder.pos.y - p.pos.y) < 16 ? ty : PITCH.HALF_Y + (ty - PITCH.HALF_Y) * 0.48;
          ty = targetInwardY;
        }
      }
    }
    p.targetPos = {
      x: clamp(clampOnside(tx), 3, PITCH.LENGTH - 3),
      y: clamp(ty, 4, PITCH.WIDTH - 4)
    };
  }
}

// src/CommentaryEngine.ts
var TEMPLATES = {
  goal_normal: [
    "{player}\u4E00\u811A\u52B2\u5C04\uFF0C\u76AE\u7403\u76F4\u6302\u6B7B\u89D2\uFF01{team}\u53D6\u5F97\u8FDB\u7403\uFF01",
    "{player}\u5728\u7981\u533A\u5185\u51B7\u9759\u63A8\u5C04\u8FDC\u89D2\u7834\u95E8\uFF01{team}\u5C06\u6BD4\u5206\u6539\u5199\u4E3A{score}\uFF01",
    "{player}\u5E26\u7403\u7A81\u5165\u7981\u533A\u540E\u8D77\u811A\u6012\u5C04\uFF0C\u76AE\u7403\u50CF\u70AE\u5F39\u4E00\u6837\u98DE\u5165\u7403\u95E8\uFF01\u6BD4\u5206{score}\uFF01",
    "\u6F02\u4EAE\uFF01{player}\u5728\u7981\u533A\u5185\u6643\u8FC7\u9632\u5B88\u7403\u5458\uFF0C\u5C0F\u89D2\u5EA6\u6253\u95E8\u5F97\u624B\uFF01\u5F53\u524D\u6BD4\u5206{score}\uFF01",
    "{player}\u95E8\u524D\u62A2\u70B9\uFF0C\u4E00\u811A\u6345\u5C04\u5C06\u7403\u9001\u5165\u7F51\u7A9D\uFF01{team}\u653B\u7834\u5BF9\u624B\u7403\u95E8\uFF01",
    "\u795E\u4ED9\u7403\uFF01{player}\u5728\u5305\u5939\u4E0B\u8D77\u811A\uFF0C\u76AE\u7403\u64E6\u7740\u7ACB\u67F1\u5185\u4FA7\u5165\u7F51\uFF01\u6BD4\u5206\u6765\u5230{score}\uFF01",
    "{player}\u5728\u7981\u533A\u524D\u6CBF\u62FF\u7403\uFF0C\u4E00\u8BB0\u8D34\u5730\u65A9\u76F4\u7A9C\u7403\u95E8\u5DE6\u4E0B\u89D2\uFF01\u5B88\u95E8\u5458\u6BEB\u65E0\u53CD\u5E94\uFF01",
    "{player}\u5229\u7528\u901F\u5EA6\u4F18\u52BF\u7529\u5F00\u540E\u536B\uFF0C\u5355\u5200\u9762\u5BF9\u95E8\u5C06\u51B7\u9759\u63A8\u5C04\u5F97\u5206\uFF01",
    "{player}\u5728\u6DF7\u6218\u4E2D\u6293\u4F4F\u673A\u4F1A\uFF0C\u4E00\u811A\u626B\u5C04\u5C06\u7403\u8F70\u5165\u7403\u95E8\u4E0A\u89D2\uFF01\u5F53\u524D{score}\uFF01",
    "{player}\u5728\u7981\u533A\u5185\u80CC\u8EAB\u62FF\u7403\u8F6C\u8EAB\u62BD\u5C04\uFF0C\u76AE\u7403\u76F4\u5954\u7403\u95E8\u53F3\u4E0A\u89D2\uFF01",
    "{player}\u95E8\u524D\u5012\u5730\u94F2\u5C04\uFF01\u76AE\u7403\u4ECE\u95E8\u5C06\u814B\u4E0B\u94BB\u5165\u7403\u7F51\uFF01{team}\u53D6\u5F97\u5173\u952E\u8FDB\u7403\uFF01",
    "\u53C8\u662F{player}\uFF01\u4ED6\u5728\u7981\u533A\u524D\u6CBF\u8FDE\u7EED\u53D8\u5411\u95EA\u5F00\u7A7A\u6863\uFF0C\u515C\u5C04\u8FDC\u89D2\u5F97\u624B\uFF01\u6BD4\u5206{score}\uFF01"
  ],
  goal_assist: [
    "\u597D\u7403\uFF01{player}\u63A5{assist}\u5999\u4F20\uFF0C\u4E00\u811A\u51CC\u7A7A\u62BD\u5C04\u5E94\u58F0\u5165\u7F51\uFF01\u6BD4\u5206{score}\uFF01",
    "\u7CBE\u5F69\u914D\u5408\uFF01{team}\u6253\u51FA\u6D41\u7545\u56E2\u961F\u8FDB\u653B\uFF0C{assist}\u9001\u51FA\u5173\u952E\u4F20\u7403\uFF0C{player}\u5B8C\u6210\u81F4\u547D\u4E00\u51FB\uFF01",
    "\u8FD9\u7403\u592A\u5173\u952E\u4E86\uFF01{player}\u63A5{assist}\u76F4\u585E\u6740\u5165\u7981\u533A\uFF0C\u9762\u5BF9\u51FA\u51FB\u7684\u95E8\u5C06\u6311\u5C04\u7834\u95E8\uFF01\u5F53\u524D{score}\uFF01",
    "\u53CD\u51FB\u8FDB\u7403\uFF01{team}\u53D1\u52A8\u95EA\u7535\u53CD\u51FB\uFF0C{assist}\u957F\u4F20\u7B56\u52A8\uFF0C{player}\u9AD8\u901F\u63D2\u4E0A\u7206\u5C04\u7834\u95E8\uFF01"
  ],
  goal_long_range: [
    "\u4E16\u754C\u6CE2\uFF01{player}\u5728\u8DDD\u79BB\u7403\u95E8\u4E8C\u5341\u4F59\u7C73\u5916\u7A81\u65BD\u51B7\u7BAD\uFF0C\u76AE\u7403\u5212\u51FA\u5B8C\u7F8E\u5F27\u7EBF\u76F4\u6302\u6B7B\u89D2\uFF01\u6BD4\u5206{score}\uFF01",
    "\u91CD\u70AE\u8F70\u95E8\uFF01{player}\u5916\u56F4\u8FDC\u5C04\u52BF\u5927\u529B\u6C89\uFF0C\u76AE\u7403\u8D34\u7740\u6A2A\u6881\u4E0B\u6CBF\u5165\u7F51\uFF01{team}\u7403\u8FF7\u6CB8\u817E\u4E86\uFF01"
  ],
  goal_header: [
    "{player}\u9AD8\u9AD8\u8DC3\u8D77\u5934\u7403\u653B\u95E8\uFF01\u76AE\u7403\u7838\u5728\u8349\u76AE\u4E0A\u5F39\u5165\u7403\u7F51\uFF01{team}\u53D6\u5F97\u8FDB\u7403\uFF01",
    "{player}\u63A5\u4F20\u4E2D\u7403\u62A2\u70B9\u5934\u69CC\u7834\u95E8\uFF01\u95E8\u5C06\u671B\u7403\u5174\u53F9\uFF0C\u6BD4\u5206\u6539\u5199\u4E3A{score}\uFF01"
  ],
  goal_late: [
    "\u7EDD\u6740\uFF01{player}\u5728\u6BD4\u8D5B\u5C3E\u58F0\u4E0A\u6F14\u81F4\u547D\u4E00\u51FB\uFF01{team}\u5168\u961F\u75AF\u72C2\u5E86\u795D\uFF01\u5F53\u524D\u6BD4\u5206{score}\uFF01",
    "\u538B\u54E8\u7834\u95E8\uFF01{player}\u5173\u952E\u65F6\u523B\u633A\u8EAB\u800C\u51FA\u6D1E\u7A7F\u7403\u95E8\uFF01{team}\u6539\u5199\u6BD4\u5206\u81F3{score}\uFF01"
  ],
  goal_brace: [
    "\u6885\u5F00\u4E8C\u5EA6\uFF01{player}\u518D\u6B21\u5EFA\u529F\uFF0C\u4E00\u811A\u4F4E\u5C04\u7A7F\u900F\u95E8\u5C06\u5341\u6307\u5173\uFF01{team}\u6BD4\u5206\u6765\u5230{score}\uFF01"
  ],
  goal_hattrick: [
    "\u5E3D\u5B50\u620F\u6CD5\uFF01{player}\u5B8C\u6210\u4E86\u672C\u573A\u6BD4\u8D5B\u7684\u7B2C\u4E09\u4E2A\u8FDB\u7403\uFF01\u5F7B\u5E95\u4E3B\u5BB0\u8D5B\u573A\uFF0C\u6BD4\u5206{score}\uFF01"
  ],
  shot_saved: [
    "{player}\u4E00\u811A\u52B2\u5C04\uFF0C{goalkeeper}\u98DE\u8EAB\u5C06\u7403\u6251\u51FA\uFF01\u7CBE\u5F69\u7684\u6251\u6551\uFF01",
    "{player}\u5728\u7981\u533A\u5185\u8D77\u811A\u5C04\u95E8\uFF0C{goalkeeper}\u53CD\u5E94\u795E\u901F\uFF0C\u5355\u638C\u5C06\u7403\u6258\u51FA\u6A2A\u6881\uFF01",
    "\u597D\u9669\uFF01{player}\u7684\u5C04\u95E8\u76F4\u5954\u7403\u95E8\u6B7B\u89D2\uFF0C{goalkeeper}\u9C7C\u8DC3\u4FA7\u6251\u5C06\u7403\u6321\u51FA\uFF01",
    "{player}\u4E00\u811A\u4F4E\u5C04\u76F4\u5954\u7403\u95E8\u5DE6\u4E0B\u89D2\uFF0C{goalkeeper}\u5012\u5730\u5C06\u7403\u7262\u7262\u62B1\u4F4F\uFF01",
    "{player}\u5355\u5200\u9762\u5BF9\u95E8\u5C06\u63A8\u5C04\uFF0C\u88AB{goalkeeper}\u7528\u811A\u795E\u52C7\u6321\u51FA\uFF01",
    "{player}\u7684\u8FDC\u5C04\u52BF\u5927\u529B\u6C89\uFF0C{goalkeeper}\u98DE\u8EAB\u5C06\u7403\u6251\u51FA\u5E95\u7EBF\uFF01"
  ],
  shot_missed: [
    "{player}\u4E00\u811A\u5C04\u95E8\u504F\u51FA\u7403\u95E8\uFF01{team}\u9519\u5931\u826F\u673A\uFF01",
    "{player}\u7684\u8FDC\u5C04\u9AD8\u51FA\u6A2A\u6881\uFF01\u8FD9\u811A\u5C04\u95E8\u7A0D\u5FAE\u6025\u4E86\u70B9\uFF01",
    "\u53EF\u60DC\uFF01{player}\u7981\u533A\u5185\u4E00\u811A\u63A8\u5C04\uFF0C\u76AE\u7403\u64E6\u7740\u7ACB\u67F1\u504F\u51FA\uFF01\u5DEE\u4E4B\u6BEB\u5398\uFF01",
    "{player}\u5E26\u7403\u7A81\u5165\u7981\u533A\u4F4E\u5C04\u6ED1\u95E8\u800C\u8FC7\uFF01\u592A\u53EF\u60DC\u4E86\uFF01",
    "{player}\u7684\u5C04\u95E8\u6253\u5728\u8FB9\u7F51\u4E0A\uFF01{team}\u7403\u8FF7\u53D1\u51FA\u4E00\u9635\u53F9\u606F\uFF01",
    "{player}\u7981\u533A\u5185\u8F6C\u8EAB\u62BD\u5C04\u6253\u98DE\uFF0C{team}\u7684\u8FDB\u653B\u65E0\u529F\u800C\u8FD4\uFF01"
  ],
  shot_attempt: [
    "{player}\u5916\u56F4\u8D77\u811A\u5C1D\u8BD5\u5C04\u95E8\uFF0C\u76AE\u7403\u98DE\u5411\u7403\u95E8\uFF01",
    "{player}\u7981\u533A\u524D\u6CBF\u679C\u65AD\u8D77\u811A\u6253\u95E8\uFF01"
  ],
  foul: [
    "{team}\u7684{player}\u5BF9{opponent}\u72AF\u89C4\uFF0C\u4E3B\u88C1\u5224\u5439\u7F5A\u4EFB\u610F\u7403\u3002",
    "{player}\u5728\u62FC\u62A2\u4E2D\u62C9\u5012\u4E86{opponent}\uFF0C\u72AF\u89C4\uFF01",
    "\u72AF\u89C4\u4E86\uFF01{player}\u94F2\u5012{opponent}\uFF0C\u4E3B\u88C1\u5224\u679C\u65AD\u9E23\u54E8\uFF01",
    "{player}\u5728\u4E2D\u573A\u6218\u672F\u72AF\u89C4\u7ECA\u5012{opponent}\uFF0C\u7834\u574F\u4E86\u5BF9\u624B\u7684\u5FEB\u653B\u8282\u594F\u3002",
    "{player}\u5E26\u7403\u7A81\u7834\u65F6\u88AB{opponent}\u653E\u5012\uFF0C\u4E3B\u88C1\u5224\u5439\u505C\u6BD4\u8D5B\u3002"
  ],
  yellow_card: [
    "\u3010\u9EC4\u724C\u3011{player}\u56E0\u4E3A{reason}\u88AB\u4E3B\u88C1\u5224\u51FA\u793A\u9EC4\u724C\u8B66\u544A\uFF01{team}\u9700\u8981\u63A7\u5236\u52A8\u4F5C\u4E86\uFF01",
    "\u3010\u9EC4\u724C\u3011{player}\u6218\u672F\u72AF\u89C4\u62C9\u5012\u5BF9\u624B\uFF0C\u4E3B\u88C1\u5224\u679C\u65AD\u51FA\u793A\u9EC4\u724C\uFF01",
    "\u3010\u9EC4\u724C\u3011\u88C1\u5224\u4EAE\u724C\u4E86\uFF01{player}\u56E0{reason}\u5403\u5230\u9EC4\u724C\uFF0C\u6559\u7EC3\u5728\u573A\u8FB9\u5927\u558A\u63D0\u9192\u51B7\u9759\uFF01"
  ],
  red_card: [
    "\u3010\u7EA2\u724C\u3011{player}\u56E0{reason}\u88AB\u76F4\u63A5\u7F5A\u4E0B\uFF01{team}\u53EA\u80FD\u5341\u4EBA\u5E94\u6218\uFF01",
    "\u3010\u7EA2\u724C\u3011\u4E24\u9EC4\u53D8\u4E00\u7EA2\uFF01{player}\u7D2F\u8BA1\u4E24\u5F20\u9EC4\u724C\u88AB\u7F5A\u51FA\u573A\uFF01{team}\u9677\u5165\u4EBA\u6570\u52A3\u52BF\uFF01"
  ],
  offside: [
    "{player}\u8D8A\u4F4D\u4E86\uFF01{team}\u7684\u8FD9\u6B21\u8FDB\u653B\u88AB\u8FB9\u88C1\u4E3E\u65D7\u5439\u505C\u3002",
    "\u8D8A\u4F4D\uFF01{player}\u63A5\u76F4\u585E\u7403\u65F6\u8D8A\u4F4D\u534A\u4E2A\u8EAB\u4F4D\uFF0C\u8FDB\u653B\u610F\u56FE\u88AB\u8BC6\u7834\uFF01",
    "\u592A\u53EF\u60DC\u4E86\uFF01{player}\u53CD\u8D8A\u4F4D\u6162\u4E86\u4E00\u62CD\uFF0C{team}\u653B\u52BF\u65E0\u529F\u800C\u8FD4\u3002"
  ],
  corner: [
    "{team}\u83B7\u5F97\u89D2\u7403\u673A\u4F1A\uFF0C\u8FDB\u653B\u7403\u5458\u7EB7\u7EB7\u6D8C\u5165\u7981\u533A\uFF01",
    "{team}\u5236\u9020\u4E00\u6B21\u89D2\u7403\uFF0C\u51C6\u5907\u5F00\u51FA\u6218\u672F\u914D\u5408\uFF01"
  ],
  substitution: [
    "\u3010\u6362\u4EBA\u3011{team}\u505A\u51FA\u6362\u4EBA\u8C03\u6574\uFF01{playerOut}\u88AB\u6362\u4E0B\uFF0C{playerIn}\u66FF\u8865\u767B\u573A\uFF01",
    "\u3010\u6362\u4EBA\u3011\u6218\u672F\u8C03\u6574\uFF01{team}\u7528{playerIn}\u6362\u4E0B{playerOut}\uFF0C\u4FDD\u6301\u573A\u4E0A\u51B2\u51FB\u529B\uFF01",
    "\u3010\u6362\u4EBA\u3011{team}\u8FDB\u884C\u4EBA\u5458\u8F6E\u6362\uFF0C{playerIn}\u66FF\u6362{playerOut}\u4E0A\u573A\uFF01"
  ],
  kick_off: [
    "\u6BD4\u8D5B\u5F00\u59CB\uFF01{homeTeam}\u8FCE\u6218{awayTeam}\uFF0C\u4E3B\u88C1\u5224\u4E00\u58F0\u54E8\u54CD\uFF0C\u5BF9\u51B3\u6B63\u5F0F\u6253\u54CD\uFF01",
    "\u597D\u620F\u5F00\u573A\uFF01{homeTeam} vs {awayTeam}\uFF0C\u53CC\u65B9\u5728\u4E2D\u5708\u5C31\u4F4D\u5F00\u7403\uFF01"
  ],
  half_time: [
    "\u4E0A\u534A\u573A\u6BD4\u8D5B\u7ED3\u675F\uFF01\u76EE\u524D\u6BD4\u5206 {homeTeam} {homeScore} - {awayScore} {awayTeam}\uFF01",
    "\u4E2D\u573A\u54E8\u54CD\uFF01\u534A\u573A\u6218\u7F62 {homeScore}:{awayScore}\uFF0C\u53CC\u65B9\u8FD4\u56DE\u66F4\u8863\u5BA4\u8C03\u6574\u90E8\u7F72\u3002"
  ],
  full_time: [
    "\u5168\u573A\u6BD4\u8D5B\u7ED3\u675F\uFF01\u6700\u7EC8\u6BD4\u5206 {homeTeam} {homeScore} - {awayScore} {awayTeam}\uFF01",
    "\u7EC8\u573A\u54E8\u54CD\uFF01{homeTeam} {homeScore} - {awayScore} {awayTeam}\uFF0C\u611F\u8C22\u53CC\u65B9\u5949\u732E\u7684\u7CBE\u5F69\u5BF9\u51B3\uFF01"
  ],
  atmosphere: [
    "\u53CC\u65B9\u5728\u4E2D\u573A\u9677\u5165\u6FC0\u70C8\u62C9\u952F\u6218\uFF0C\u7403\u6743\u9891\u7E41\u6613\u4E3B\u3002",
    "\u4E24\u961F\u9635\u578B\u4FDD\u6301\u5F97\u5F88\u7D27\u51D1\uFF0C\u573A\u4E0A\u8282\u594F\u7565\u663E\u80F6\u7740\uFF0C\u7B49\u5F85\u7834\u5C40\u673A\u4F1A\u3002",
    "\u573A\u8FB9\u4E3B\u5E05\u4E0D\u65AD\u6325\u624B\u793A\u610F\u538B\u4E0A\uFF0C\u53CC\u65B9\u5728\u8FB9\u8DEF\u5C55\u5F00\u8BD5\u63A2\u6027\u4F20\u5BFC\u3002"
  ]
};
var FOUL_REASONS = ["\u6218\u672F\u72AF\u89C4", "\u80CC\u540E\u94F2\u7403", "\u62FC\u62A2\u52A8\u4F5C\u8FC7\u5927", "\u62C9\u62FD\u7403\u8863"];
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function renderTemplate(tpl, vars) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    if (v !== void 0) {
      out = out.split(`{${k}}`).join(String(v));
    }
  }
  return out;
}
var NarrativeState = class {
  constructor() {
    this.goalsThisMatch = {
      home: {},
      away: {}
    };
    this.consecutiveShots = { home: 0, away: 0 };
    this.lastEventMinute = 0;
    this.momentum = "even";
  }
  onGoal(player, team, minute) {
    this.lastEventMinute = minute;
    const map = this.goalsThisMatch[team];
    map[player] = (map[player] || 0) + 1;
    const cnt = map[player];
    if (cnt >= 3) return "HATTRICK";
    if (cnt === 2) return "BRACE";
    return null;
  }
  onShot(team, teamName, minute) {
    this.lastEventMinute = minute;
    const other = team === "home" ? "away" : "home";
    this.consecutiveShots[other] = 0;
    this.consecutiveShots[team]++;
    if (this.consecutiveShots[team] >= 3) {
      this.momentum = team;
      const cnt = this.consecutiveShots[team];
      this.consecutiveShots[team] = 0;
      return `\u3010\u653B\u52BF\u5982\u6F6E\u3011${teamName}\u77ED\u65F6\u95F4\u5185\u8FDE\u7EED\u5B8C\u6210\u7B2C ${cnt} \u811A\u5C04\u95E8\u538B\u5236\u5BF9\u624B\uFF01`;
    }
    return null;
  }
  markActive(minute) {
    if (minute > this.lastEventMinute) {
      this.lastEventMinute = minute;
    }
  }
  checkLull(minute) {
    if (minute >= 8 && minute <= 86 && minute - this.lastEventMinute >= 6) {
      this.lastEventMinute = minute;
      return pick(TEMPLATES.atmosphere);
    }
    return null;
  }
};
var CommentaryEngine = class {
  constructor(homeName, awayName) {
    this.homeName = homeName;
    this.awayName = awayName;
    this.narrative = new NarrativeState();
  }
  teamName(team) {
    return team === "home" ? this.homeName : this.awayName;
  }
  formatKickoff(minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.kick_off), {
        homeTeam: this.homeName,
        awayTeam: this.awayName
      }),
      level: "phase"
    };
  }
  formatHalftime(minute, homeScore, awayScore) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.half_time), {
        homeTeam: this.homeName,
        awayTeam: this.awayName,
        homeScore,
        awayScore
      }),
      level: "phase"
    };
  }
  formatFulltime(minute, homeScore, awayScore) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.full_time), {
        homeTeam: this.homeName,
        awayTeam: this.awayName,
        homeScore,
        awayScore
      }),
      level: "phase"
    };
  }
  formatGoal(ctx) {
    const milestone = this.narrative.onGoal(ctx.player, ctx.team, ctx.minute);
    const score = `${ctx.homeScore}-${ctx.awayScore}`;
    const team = this.teamName(ctx.team);
    const diff = Math.abs(ctx.homeScore - ctx.awayScore);
    const isLateWinner = ctx.minute >= 85 && diff <= 1;
    let pool = TEMPLATES.goal_normal;
    let narrativeTag;
    if (milestone === "HATTRICK") {
      pool = TEMPLATES.goal_hattrick;
      narrativeTag = "HATTRICK";
    } else if (isLateWinner) {
      pool = TEMPLATES.goal_late;
      narrativeTag = "LATE_WINNER";
    } else if (milestone === "BRACE") {
      pool = TEMPLATES.goal_brace;
      narrativeTag = "BRACE";
    } else if (ctx.shotType === "long_range") {
      pool = TEMPLATES.goal_long_range;
    } else if (ctx.shotType === "header") {
      pool = TEMPLATES.goal_header;
    } else if (ctx.assist) {
      pool = TEMPLATES.goal_assist;
    }
    const text = renderTemplate(pick(pool), {
      player: ctx.player,
      assist: ctx.assist || "\u961F\u53CB",
      team,
      score
    });
    return { text: `\u3010\u8FDB\u7403\u3011${text}`, level: "critical", narrativeTag };
  }
  formatShot(team, player, xG, minute) {
    const momentumText = this.narrative.onShot(team, this.teamName(team), minute) ?? void 0;
    return {
      text: `${renderTemplate(pick(TEMPLATES.shot_attempt), { player })} (xG ${xG.toFixed(2)})`,
      level: "minor",
      momentumText
    };
  }
  formatSave(defTeam, goalkeeper, shooter, minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.shot_saved), {
        goalkeeper,
        player: shooter,
        team: this.teamName(defTeam)
      }),
      level: "minor"
    };
  }
  formatMiss(shootTeam, shooter, minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.shot_missed), {
        player: shooter,
        team: this.teamName(shootTeam)
      }),
      level: "minor"
    };
  }
  formatFoul(team, player, opponent, minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.foul), {
        team: this.teamName(team),
        player,
        opponent
      }),
      level: "minor"
    };
  }
  formatYellow(team, player, minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.yellow_card), {
        team: this.teamName(team),
        player,
        reason: pick(FOUL_REASONS)
      }),
      level: "important"
    };
  }
  formatRed(team, player, isSecondYellow, minute) {
    this.narrative.markActive(minute);
    const tpl = isSecondYellow ? TEMPLATES.red_card[1] : TEMPLATES.red_card[0];
    return {
      text: renderTemplate(tpl, {
        team: this.teamName(team),
        player,
        reason: pick(FOUL_REASONS)
      }),
      level: "important"
    };
  }
  formatOffside(team, player, minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.offside), {
        team: this.teamName(team),
        player
      }),
      level: "minor"
    };
  }
  formatCorner(team, minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.corner), {
        team: this.teamName(team)
      }),
      level: "minor"
    };
  }
  formatSubstitution(team, playerIn, playerOut, minute) {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.substitution), {
        team: this.teamName(team),
        playerIn,
        playerOut
      }),
      level: "normal"
    };
  }
  checkLull(minute) {
    const text = this.narrative.checkLull(minute);
    if (!text) return null;
    return { text, level: "minor", narrativeTag: "LULL" };
  }
};

// src/MatchEngine.ts
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
    this.lastShotType = "normal";
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
    this.prologueScriptedMode = false;
    this.prologueSkillTriggered = false;
    this.prologueStage = 0;
    this.prologueWaitingForCard = null;
    this.prologueWaitingForSub = false;
    this.prologuePendingForcedGoal = false;
    this.prologueGuaranteedGoal = false;
    this.prologueAllowAwayGoal = false;
    this.prologueAwayGoalCount = 0;
    this.prologueGoalDelayTicks = 0;
    this.prologueScriptTicks = 0;
    this.pendingTacticalCallouts = [];
    this.userScoutCounterLabel = "";
    this.lastScoutCalloutMin = -20;
    this.calloutSeq = 0;
    this.pendingSkillResolution = null;
    this.subTrackers = [];
    // V6 原子事件总线状态
    this.v6PassiveHooks = { home: [], away: [] };
    this.v6ImmunityFlags = { home: {}, away: {} };
    this.v6PreventPenRedUsed = { home: false, away: false };
    this.v6TotalFootballMaster = { home: false, away: false };
    this.v6SkillTempRankBonus = { home: 0, away: 0 };
    this.v6SkillDualBranch = { home: false, away: false };
    this.v6StartingShields = { home: 0, away: 0 };
    this.v6MaxCounterStacks = { home: 2, away: 2 };
    this.v6ForcedCornerProb = { home: 0, away: 0 };
    this.v6PassStreak = { home: 0, away: 0 };
    this.prologueScriptedMode = !!(home.prologueScripted || away.prologueScripted);
    this.stoppageTicksFirst = this.prologueScriptedMode ? 0 : Math.floor(Math.random() * 60);
    this.stoppageTicksSecond = this.prologueScriptedMode ? 60 : 30 + Math.floor(Math.random() * 90);
    this.homeMods = home.tacticalMods ? { ...home.tacticalMods } : {};
    this.awayMods = away.tacticalMods ? { ...away.tacticalMods } : {};
    this.v6PassiveHooks = {
      home: home.v6PassiveHooks ? [...home.v6PassiveHooks] : [],
      away: away.v6PassiveHooks ? [...away.v6PassiveHooks] : []
    };
    this.v6ImmunityFlags = {
      home: home.v6ImmunityFlags ? { ...home.v6ImmunityFlags } : {},
      away: away.v6ImmunityFlags ? { ...away.v6ImmunityFlags } : {}
    };
    this.v6TotalFootballMaster = { home: !!home.v6TotalFootballMaster, away: !!away.v6TotalFootballMaster };
    this.v6SkillTempRankBonus = { home: home.v6SkillTempRankBonus ?? 0, away: away.v6SkillTempRankBonus ?? 0 };
    this.v6SkillDualBranch = { home: !!home.v6SkillDualBranch, away: !!away.v6SkillDualBranch };
    this.v6StartingShields = { home: home.v6StartingShields ?? 0, away: away.v6StartingShields ?? 0 };
    this.v6MaxCounterStacks = { home: home.v6MaxCounterStacks ?? 2, away: away.v6MaxCounterStacks ?? 2 };
    if (home.equippedSkills && home.equippedSkills.length > 0 || home.activeAspects && home.activeAspects.length > 0 || home.v6PassiveHooks && home.v6PassiveHooks.length > 0) {
      this.userTeamSide = "home";
      this.userEquippedSkills = [...home.equippedSkills ?? []];
      this.userAspects = [...home.activeAspects ?? []];
      this.userPerkSynergies = home.perkSynergies ?? null;
      this.userFamAvg = home.teamFamiliarityAvg ?? 50;
      this.userChemAvg = home.teamChemistryAvg ?? 30;
      this.userScoutCounterLabel = home.scoutCounterLabel ?? "";
    } else if (away.equippedSkills && away.equippedSkills.length > 0 || away.activeAspects && away.activeAspects.length > 0 || away.scoutCounterLabel) {
      this.userTeamSide = "away";
      this.userEquippedSkills = [...away.equippedSkills ?? []];
      this.userAspects = [...away.activeAspects ?? []];
      this.userPerkSynergies = away.perkSynergies ?? null;
      this.userFamAvg = away.teamFamiliarityAvg ?? 50;
      this.userChemAvg = away.teamChemistryAvg ?? 30;
      this.userScoutCounterLabel = away.scoutCounterLabel ?? "";
    } else if (this.prologueScriptedMode) {
      this.userTeamSide = home.prologueScripted ? "home" : "away";
    }
    this.commentary = new CommentaryEngine(home.name, away.name);
    this.state = this.initState(home, away);
    this.setupKickoff("home");
    if (this.prologueScriptedMode) {
      this.state.tick = 45 * SIM_CONFIG.TICKS_PER_MINUTE;
      this.state.minute = 45;
      this.state.phase = "second_half";
      this.state.homeAttackDir = 1;
      this.state.homeScore = 0;
      this.state.awayScore = 1;
      this.state.stats.home.goals = 0;
      this.state.stats.away.goals = 1;
      this.pushEvent("commentary", "home", "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u3010\u5E8F\u7AE0\xB7\u4E0B\u534A\u573A 45'\u30110:1 \u843D\u540E\uFF01\u552F\u6709\u8D62\u4E0B\u4ECA\u665A\u8FD9\u573A\u51B3\u6218\uFF0C\u624D\u80FD\u6367\u8D77\u8D85\u7EA7\u8054\u8D5B\u51A0\u519B\u5956\u676F\uFF01", void 0, "important");
    }
  }
  hasActiveMechanic(team, mech) {
    return this.state.activeBuffs.some((b) => b.team === team && b.effect.mechanic === mech);
  }
  hasImmunity(team, key) {
    if (this.v6ImmunityFlags[team]?.[key]) return true;
    return this.state.activeBuffs.some((b) => b.team === team && !!b.effect.immunityFlags?.[key]);
  }
  getEffectiveMods(team) {
    const base = team === "home" ? this.homeMods : this.awayMods;
    const out = {
      ...base,
      tempoMul: 1,
      foulRateMul: 1,
      cornerRateMul: 1,
      freeKickRateMul: 1,
      blockBonus: 0,
      oppShotXgPenalty: 0,
      oppThroughPassBonus: 0,
      interceptRangeBonus: 0,
      interceptProbBonus: 0,
      oppLongShotBonus: 0,
      offsideTrapBonus: 0,
      oppStaminaDrainPerMin: 0,
      skillDualBranch: this.v6SkillDualBranch[team],
      skillTempRankBonus: this.v6SkillTempRankBonus[team]
    };
    const isLeading = team === "home" ? this.state.homeScore > this.state.awayScore : this.state.awayScore > this.state.homeScore;
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
        if (tm.staminaDrainMul) out.staminaDrainMul = (out.staminaDrainMul ?? 1) * tm.staminaDrainMul;
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
  getEffectiveChemDelta(team) {
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
  hasUserAspect(mechanicKey) {
    return this.userAspects.some((a) => a.mechanicKey === mechanicKey);
  }
  getShieldCap() {
    return this.hasUserAspect("fortress_shield_start2") || this.v6StartingShields.home >= 2 ? 3 : 2;
  }
  getCounterCap() {
    const side = this.userTeamSide ?? "home";
    return Math.max(this.hasUserAspect("absorb_max3_counter") ? 3 : 2, this.v6MaxCounterStacks[side] ?? 2);
  }
  /** V6 数据驱动事件总线：统一派发 14 个比赛触发点 × 13 种原子动作 */
  dispatchHook(team, trigger, ctx) {
    const s = this.state;
    const oppTeam = team === "home" ? "away" : "home";
    const sources = [];
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
          case "healTeam":
            for (const p of s.players) {
              if (p.team === team && !p.redCard) p.fitness = Math.min(100, p.fitness + val);
            }
            break;
          case "drainOppStamina":
            for (const p of s.players) {
              if (p.team === oppTeam && !p.redCard) p.fitness = Math.max(20, p.fitness - val);
            }
            break;
          case "oppComposureDebuff":
            for (const p of s.players) {
              if (p.team === oppTeam && !p.redCard) p.attributes.composure = Math.max(25, p.attributes.composure - val);
            }
            break;
          case "cutSkillCd":
            if (team === this.userTeamSide) this.reduceEquippedCooldowns(val);
            break;
          case "addShield":
            if (team === this.userTeamSide && s.aspectStacks) {
              s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + val);
            }
            break;
          case "addCounter":
            if (team === this.userTeamSide && s.aspectStacks) {
              s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + val);
            }
            break;
          case "grantBypassOffside":
            this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], val);
            break;
          case "grantOnTarget":
            this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], val);
            break;
          case "stealTempo":
            this.oppTempoDrainTicks[oppTeam] = Math.max(this.oppTempoDrainTicks[oppTeam], val);
            break;
          case "forceCornerProb":
            this.v6ForcedCornerProb[team] = Math.max(this.v6ForcedCornerProb[team], val);
            break;
          case "extendDirective":
            for (const b of s.activeBuffs) {
              if (b.team === team && !b.effect.id.startsWith("sk_")) {
                b.endMinute = Math.min(95, b.endMinute + val);
              }
            }
            break;
          case "forceYellowCard": {
            const targetDef = s.players.filter((p) => p.team === oppTeam && !p.redCard && p.role !== "GK").sort((a, c) => dist2D(a.pos, s.ball.pos) - dist2D(c.pos, s.ball.pos))[0];
            if (targetDef) {
              targetDef.yellowCards++;
              s.stats[oppTeam].yellowCards++;
              this.pushEvent("yellow_card", oppTeam, targetDef.id, targetDef.name, targetDef.pos, `\u3010\u6218\u672F\u9020\u724C\u3011${targetDef.name} \u88AB\u4E3B\u88C1\u51FA\u793A\u9EC4\u724C\uFF01`, void 0, "important");
              if (targetDef.yellowCards >= 2) {
                targetDef.redCard = true;
                s.stats[oppTeam].redCards++;
                this.pushEvent("red_card", oppTeam, targetDef.id, targetDef.name, targetDef.pos, `\u3010\u4E24\u9EC4\u53D8\u7EA2\u3011${targetDef.name} \u88AB\u7EA2\u724C\u7F5A\u51FA\u573A\u5916\uFF01`, void 0, "critical");
              }
            }
            break;
          }
          case "triggerMiniBuff": {
            const preset = rule.miniBuffPreset ?? "pace_burst";
            const mini = preset === "counter_burst" ? { id: `v6_mini_${s.tick}`, name: "\u53CD\u51FB\u7206\u53D1", durationMinutes: 5, paceDelta: 10, tacticalMod: { throughPassBias: 0.12, tempoMul: 1.15 } } : preset === "shot_burst" ? { id: `v6_mini_${s.tick}`, name: "\u5F3A\u653B\u7206\u53D1", durationMinutes: 4, shootingDelta: 10, tacticalMod: { tempoMul: 1.12 } } : preset === "tempo_burst" ? { id: `v6_mini_${s.tick}`, name: "\u63A8\u8FDB\u63D0\u901F", durationMinutes: 3, paceDelta: 6, tacticalMod: { tempoMul: 1.15 } } : { id: `v6_mini_${s.tick}`, name: "\u77AC\u65F6\u51B2\u523A", durationMinutes: 4, paceDelta: 10 };
            this.applyCommandCard(team, mini);
            break;
          }
        }
      }
    }
  }
  pushCoachReward(reward) {
    this.pendingCoachRewards.push(reward);
  }
  pushTacticalCallout(player, label, kind) {
    this.calloutSeq++;
    if (player.team === this.userTeamSide && this.state.tacticalStats) {
      if (kind === "trait") this.state.tacticalStats.traitTriggers++;
      else if (kind === "chemistry") this.state.tacticalStats.chemPasses++;
      else if (kind === "scout") this.state.tacticalStats.scoutCounters++;
    }
    if (this.pendingTacticalCallouts.length >= 12) return;
    this.pendingTacticalCallouts.push({
      id: `tc_${this.calloutSeq}`,
      tick: this.state.tick,
      playerId: player.id,
      team: player.team,
      label,
      kind,
      pos: { x: player.pos.x, y: player.pos.y }
    });
  }
  consumeTacticalCallouts() {
    if (this.pendingTacticalCallouts.length === 0) return [];
    const out = this.pendingTacticalCallouts;
    this.pendingTacticalCallouts = [];
    return out;
  }
  consumeCoachRewards() {
    if (this.pendingCoachRewards.length === 0) return [];
    const copy = [...this.pendingCoachRewards];
    this.pendingCoachRewards.length = 0;
    return copy;
  }
  reduceEquippedCooldowns(minutes) {
    const s = this.state;
    if (!s.skillCooldowns) return;
    for (const k of Object.keys(s.skillCooldowns)) {
      s.skillCooldowns[k] = Math.max(s.minute, (s.skillCooldowns[k] ?? s.minute) - minutes);
    }
  }
  isTrailing(team) {
    return team === "home" ? this.state.homeScore < this.state.awayScore : this.state.awayScore < this.state.homeScore;
  }
  initState(home, away) {
    const players = [];
    const buildTeam = (setup, team, dir) => {
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
          duty: setup.slotDuties?.[i] ?? "default",
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
            distanceM: 0
          }
        });
      }
      const teamPlayers = players.filter((p) => p.team === team);
      const spineRoles = /* @__PURE__ */ new Set(["GK", "CB", "CDM", "CM", "CAM", "ST"]);
      const spineBonus = setup.centralSpineBonus ?? 0;
      for (let ti = 0; ti < teamPlayers.length; ti++) {
        const tp = teamPlayers[ti];
        const fam = setup.players[ti]?.formationFamiliarity;
        if (fam !== void 0) {
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
      if (teamPlayers.some((p) => p.isCaptain)) {
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
    buildTeam(home, "home", 1);
    buildTeam(away, "away", -1);
    return {
      tick: 0,
      minute: 0,
      phase: "first_half",
      weather: home.weather ?? away.weather ?? "sunny",
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
      unlockedHiddenTraits: [],
      activeBuffs: [],
      stats: {
        home: createEmptyStats(),
        away: createEmptyStats()
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
          (this.hasUserAspect("fortress_shield_start2") ? 2 : this.hasUserAspect("bus_shield_start1") || this.hasUserAspect("gk_shield_start1") ? 1 : 0) + (this.v6StartingShields[this.userTeamSide ?? "home"] ?? 0)
        ),
        counterCharges: 0,
        passSeq: 0
      },
      teamStance: { home: home.style, away: away.style },
      stanceSwitchCount: { home: 0, away: 0 },
      lastConcededMin: { home: -99, away: -99 },
      lastSaveMin: { home: -99, away: -99 },
      deckArchetypeGene: { home: home.deckArchetypeGene, away: away.deckArchetypeGene },
      pendingClutchSetPiece: { home: false, away: false },
      usedDirectiveZones: { home: [], away: [] },
      totalFootballZoneTriggered: { home: false, away: false }
    };
  }
  getState() {
    return this.state;
  }
  getPrologueTutorialState() {
    return {
      isPrologue: this.prologueScriptedMode,
      stage: this.prologueStage,
      waitingForCard: this.prologueWaitingForCard,
      waitingForSub: this.prologueWaitingForSub,
      waitingForSkill: !!this.state.activeSkillPrompt && this.prologueScriptedMode
    };
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
  swapPlayerSlots(team, playerIdA, playerIdB) {
    if (playerIdA === playerIdB) return false;
    const a = this.state.players.find((p) => p.id === playerIdA && p.team === team && !p.redCard);
    const b = this.state.players.find((p) => p.id === playerIdB && p.team === team && !p.redCard);
    if (!a || !b) return false;
    const tmpSlot = a.slotIndex;
    const tmpRole = a.role;
    const tmpOffset = a.customOffset ? { ...a.customOffset } : void 0;
    a.slotIndex = b.slotIndex;
    a.role = b.role;
    a.customOffset = b.customOffset ? { ...b.customOffset } : void 0;
    b.slotIndex = tmpSlot;
    b.role = tmpRole;
    b.customOffset = tmpOffset;
    return true;
  }
  /**
   * 比赛中微调单个球员的球场站位偏移（传入相对球场绝对坐标目标，自动转为相对进攻方向的偏移）
   */
  setPlayerPitchTarget(team, playerId, absX, absY) {
    const p = this.state.players.find((x) => x.id === playerId && x.team === team && !x.redCard);
    if (!p) return false;
    const dir = this.getAttackDir(team);
    const form = team === "home" ? this.state.homeFormation : this.state.awayFormation;
    const slot = FORMATIONS[form][p.slotIndex] || FORMATIONS[form][0];
    const baseAbsX = toAbsoluteX(slot.baseX, dir);
    const dx = clamp((absX - baseAbsX) * dir, -20, 20);
    const dy = clamp(absY - slot.baseY, -18, 18);
    p.customOffset = { x: dx, y: dy };
    p.targetPos = { x: clamp(absX, 3, PITCH.LENGTH - 3), y: clamp(absY, 3, PITCH.WIDTH - 3) };
    return true;
  }
  resetPlayerOffsets(team) {
    for (const p of this.state.players) {
      if (p.team === team) p.customOffset = void 0;
    }
  }
  getPlayerLine(role) {
    if (role === "GK") return "GK";
    if (["CB", "LB", "RB", "LWB", "RWB"].includes(role)) return "DEF";
    if (["CDM", "CM", "CAM", "LM", "RM"].includes(role)) return "MID";
    return "ATT";
  }
  /**
   * 比赛日打出教练场外指挥卡牌（支持位置限定、负面反噬与高级连锁效果）
   */
  applyCommandCard(team, card) {
    const s = this.state;
    if (this.prologueScriptedMode && team === this.userTeamSide && !card.id.startsWith("sk_")) {
      if (this.prologueWaitingForCard === null) {
        return { ok: false };
      }
      if (this.prologueWaitingForCard === 1 && card.id === "prologue_card_allout_blitz") {
        return { ok: false };
      }
      if (this.prologueWaitingForCard === 2 && card.id === "prologue_card_wing_surge") {
        return { ok: false };
      }
    }
    const clampAttr = (v) => Math.max(25, Math.min(99, v));
    const targetLine = card.targetLine ?? "ALL";
    const hadActiveBuff = s.activeBuffs.some((b) => b.team === team);
    let energyRefund = 0;
    s.teamStance = s.teamStance ?? { home: s.homeStyle, away: s.awayStyle };
    s.stanceSwitchCount = s.stanceSwitchCount ?? { home: 0, away: 0 };
    const curStance = s.teamStance[team];
    const comboActivated = !!(card.comboRule && (card.comboRule.anyStance || card.affix?.anyStanceCombo || card.comboRule.requiresStance && curStance === card.comboRule.requiresStance));
    if (card.stance) {
      if (s.teamStance[team] !== card.stance) {
        s.stanceSwitchCount[team] = (s.stanceSwitchCount[team] ?? 0) + 1;
      }
      s.teamStance[team] = card.stance;
      if (team === "home") s.homeStyle = card.stance;
      else s.awayStyle = card.stance;
    }
    this.pushEvent(
      "tactic",
      team,
      "",
      card.name,
      { x: PITCH.HALF_X, y: PITCH.HALF_Y },
      `\u6559\u7EC3\u6253\u51FA\u3010${card.name}\u3011${comboActivated ? "\u89E6\u53D1\u6001\u52BF\u8FDE\u51FB\uFF01" : "\u4E34\u573A\u6307\u4EE4\u751F\u6548\uFF01"}`,
      void 0,
      comboActivated ? "important" : "normal"
    );
    const fergieMul = card.affix?.fergieTime && s.minute >= 80 ? 2 : 1;
    let starPlayerId = null;
    if (card.starPlayerTarget) {
      const teamPlayers = s.players.filter((p) => p.team === team && !p.redCard && p.role !== "GK");
      if (teamPlayers.length > 0) {
        const sorted = [...teamPlayers].sort((a, b) => {
          if (card.starPlayerTarget === "top_shooter") return b.attributes.shooting - a.attributes.shooting;
          if (card.starPlayerTarget === "top_passer") return b.attributes.passing - a.attributes.passing;
          return b.attributes.pace - a.attributes.pace;
        });
        starPlayerId = sorted[0].id;
      }
    }
    const effPassing = (card.passingDelta ?? 0) * fergieMul;
    const effShooting = ((card.shootingDelta ?? 0) + (comboActivated ? card.comboRule?.extraShooting ?? 0 : 0)) * fergieMul;
    const effDefending = ((card.defendingDelta ?? 0) + (comboActivated ? card.comboRule?.extraDefending ?? 0 : 0)) * fergieMul;
    const effPace = ((card.paceDelta ?? 0) + (comboActivated ? card.comboRule?.extraPace ?? 0 : 0)) * fergieMul;
    const effComposure = (card.composureDelta ?? 0) * fergieMul;
    const effGK = ((card.goalkeepingDelta ?? 0) + (comboActivated ? card.comboRule?.extraGoalkeeping ?? 0 : 0)) * fergieMul;
    const effFitGain = (card.fitnessInstantDelta ?? 0) + (comboActivated ? card.comboRule?.fitnessGain ?? 0 : 0);
    for (const p of s.players) {
      if (p.redCard) continue;
      if (p.team === team) {
        const matchLine = starPlayerId ? p.id === starPlayerId : targetLine === "ALL" || this.getPlayerLine(p.role) === targetLine;
        if (matchLine) {
          if (effFitGain) p.fitness = Math.max(20, Math.min(100, p.fitness + effFitGain));
          if (effPassing) p.attributes.passing = clampAttr(p.attributes.passing + effPassing);
          if (effShooting) p.attributes.shooting = clampAttr(p.attributes.shooting + effShooting);
          if (effDefending) p.attributes.defending = clampAttr(p.attributes.defending + effDefending);
          if (effPace) p.attributes.pace = clampAttr(p.attributes.pace + effPace);
          if (effComposure) p.attributes.composure = clampAttr(p.attributes.composure + effComposure);
          if (effGK && p.role === "GK") p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + effGK);
        }
        if (card.penaltyFitnessDelta) p.fitness = Math.max(20, Math.min(100, p.fitness + card.penaltyFitnessDelta));
        if (card.penaltyAllDefDelta) p.attributes.defending = clampAttr(p.attributes.defending + card.penaltyAllDefDelta);
        if (card.affix?.allPacePenalty) p.attributes.pace = clampAttr(p.attributes.pace + card.affix.allPacePenalty);
        if (card.affix?.defPacePenalty && this.getPlayerLine(p.role) === "DEF") {
          p.attributes.pace = clampAttr(p.attributes.pace + card.affix.defPacePenalty);
        }
        if (card.chainEffect?.type === "spread_all" && !matchLine) {
          p.attributes.passing = clampAttr(p.attributes.passing + 4);
          p.attributes.composure = clampAttr(p.attributes.composure + 4);
        } else if (card.chainEffect?.type === "synergy_boost" && hadActiveBuff) {
          p.attributes.pace = clampAttr(p.attributes.pace + 6);
          p.attributes.shooting = clampAttr(p.attributes.shooting + 6);
        } else if (card.chainEffect?.type === "fitness_leech") {
          p.fitness = Math.min(100, p.fitness + 8);
        }
      } else {
        if (card.chainEffect?.type === "fitness_leech") p.fitness = Math.max(20, p.fitness - 8);
        if (card.oppDebuff?.oppFitnessDelta) p.fitness = Math.max(20, Math.min(100, p.fitness + card.oppDebuff.oppFitnessDelta));
        if (card.oppDebuff?.oppComposureDelta) p.attributes.composure = clampAttr(p.attributes.composure + card.oppDebuff.oppComposureDelta);
        if (comboActivated && card.comboRule?.fitnessLeech) p.fitness = Math.max(20, p.fitness - card.comboRule.fitnessLeech);
      }
    }
    if (card.chainEffect?.type === "energy_refund") energyRefund += 1;
    if (comboActivated && card.comboRule?.energyRefund) energyRefund += card.comboRule.energyRefund;
    if (card.affix?.energyRefundBonus) energyRefund += card.affix.energyRefundBonus;
    if (card.affix?.clutchSetPiece85 && s.minute >= 85) {
      const myG = team === "home" ? s.homeScore : s.awayScore;
      const opG = team === "home" ? s.awayScore : s.homeScore;
      if (myG <= opG) {
        s.pendingClutchSetPiece = s.pendingClutchSetPiece ?? { home: false, away: false };
        s.pendingClutchSetPiece[team] = true;
      }
    }
    if (this.userTeamSide === team && card.element && !card.id.startsWith("sk_")) {
      if (card.element === "press" && !energyRefund && this.hasUserAspect("press_refund") && Math.random() < 0.5) {
        energyRefund = 1;
        this.pushEvent("commentary", team, "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u3010\u4E0D\u7184\u538B\u8FEB\u6838\u5FC3\u3011\u5A01\u80FD\u5171\u9E23\uFF0C\u8FD4\u8FD8 1 \u70B9\u6307\u6325\u80FD\u91CF\uFF01", void 0, "important");
      }
      if (s.skillCooldowns) {
        for (const eq of this.userEquippedSkills) {
          if (eq.linkedElement === card.element && (s.skillCooldowns[eq.id] ?? 0) > s.minute) {
            s.skillCooldowns[eq.id] = Math.max(s.minute, s.skillCooldowns[eq.id] - 1);
          }
          if (card.skillSynergy?.freeCooldownOnce && (card.skillSynergy.targetSkillTags.includes("all") || card.skillSynergy.targetSkillTags.includes(eq.situation))) {
            s.skillCooldowns[eq.id] = s.minute;
          }
        }
      }
    }
    if (this.prologueScriptedMode && team === this.userTeamSide && !card.id.startsWith("sk_")) {
      const dir = this.getAttackDir(team);
      const striker = s.players.find((p) => p.team === team && !p.redCard && p.id === "prologue_st_19");
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
      this.setTactics(team, void 0, card.forceStyle);
    }
    const extraDur = comboActivated ? card.comboRule?.durationBonus ?? 0 : 0;
    const endMinute = Math.min(95, s.minute + card.durationMinutes + extraDur);
    const stTeam = s.stats[team];
    const curConceded = team === "home" ? s.awayScore : s.homeScore;
    s.activeBuffs.push({
      team,
      name: card.name,
      endMinute,
      comboActivated,
      startConceded: curConceded,
      hookUseCount: {},
      effect: {
        ...card,
        passingDelta: effPassing || void 0,
        shootingDelta: effShooting || void 0,
        defendingDelta: effDefending || void 0,
        paceDelta: effPace || void 0,
        composureDelta: effComposure || void 0,
        goalkeepingDelta: effGK || void 0
      },
      startStats: {
        shots: stTeam.shots,
        xG: stTeam.xG,
        goals: stTeam.goals,
        tackles: stTeam.tackles,
        passesSuccess: stTeam.passesSuccess
      }
    });
    if (card.zone && !card.id.startsWith("sk_") && !card.id.startsWith("v6_mini_")) {
      s.usedDirectiveZones = s.usedDirectiveZones ?? { home: [], away: [] };
      if (!s.usedDirectiveZones[team].includes(card.zone)) {
        s.usedDirectiveZones[team].push(card.zone);
      }
      if (this.v6TotalFootballMaster[team] && !s.totalFootballZoneTriggered?.[team] && s.usedDirectiveZones[team].length >= 3) {
        s.totalFootballZoneTriggered = s.totalFootballZoneTriggered ?? { home: false, away: false };
        s.totalFootballZoneTriggered[team] = true;
        this.pushEvent("commentary", team, "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u2605\u3010\u5168\u653B\u5168\u5B88 Zone \u89C9\u9192\u3011\u524D/\u4E2D/\u540E\u4E09\u533A\u4EA4\u54CD\u66F2\u9F50\u9E23\uFF01\u5168\u961F\u5168\u5C5E\u6027 +6\u3001\u4F53\u80FD\u6D88\u8017\u51CF\u534A\uFF01", void 0, "critical");
        this.applyCommandCard(team, {
          id: "v6_mini_total_football",
          name: "\u2605 \u5168\u653B\u5168\u5B88 Zone",
          durationMinutes: 20,
          passingDelta: 6,
          shootingDelta: 6,
          defendingDelta: 6,
          paceDelta: 6,
          composureDelta: 6,
          tacticalMod: { staminaDrainMul: 0.55, tempoMul: 1.15 }
        });
      }
    }
    const comboTag = comboActivated && card.comboRule ? ` \xB7 \u8FDE\u51FB\u3010${card.comboRule.label}\u3011` : "";
    const affixTag = card.affix ? ` \xB7 [${card.affix.name}]` : "";
    this.pushEvent(
      "commentary",
      team,
      "",
      "",
      { x: PITCH.HALF_X, y: PITCH.HALF_Y },
      `\u3010\u6559\u7EC3\u6307\u6325\u3011${card.name} \u751F\u6548\uFF08\u6301\u7EED\u81F3 ${endMinute}'\uFF09${comboTag}${affixTag}`,
      void 0,
      "important"
    );
    return { ok: true, energyRefund, comboActivated };
  }
  /**
   * 比赛日临场换人（每队最多 5 次）
   */
  substitute(team, outPlayerId, inSubId) {
    const s = this.state;
    if (this.prologueScriptedMode && team === this.userTeamSide) {
      if (!this.prologueWaitingForSub) {
        return { ok: false, reason: "\u5E8F\u7AE0\u6559\u5B66\u9636\u6BB5\u6682\u672A\u5230\u6362\u4EBA\u65F6\u673A\uFF0C\u8BF7\u5148\u6309\u573A\u4E0A\u63D0\u793A\u6307\u6325\uFF01" };
      }
      if (inSubId !== "prologue_vet_10") {
        return { ok: false, reason: "\u8BF7\u6362\u4E0A\u66FF\u8865\u5E2D\u7684\u8001\u961F\u957F #10 \u6797\u950B\uFF01" };
      }
    }
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
    if (newPlayer.traits.includes("\u8D85\u7EA7\u66FF\u8865")) {
      newPlayer.attributes.shooting = Math.min(99, newPlayer.attributes.shooting + 8);
      newPlayer.attributes.pace = Math.min(99, newPlayer.attributes.pace + 8);
    }
    if (this.hasActiveMechanic(team, "super_sub")) {
      newPlayer.attributes.shooting = Math.min(99, newPlayer.attributes.shooting + 10);
      newPlayer.attributes.pace = Math.min(99, newPlayer.attributes.pace + 10);
      newPlayer.attributes.passing = Math.min(99, newPlayer.attributes.passing + 10);
      newPlayer.fitness = Math.min(100, newPlayer.fitness + 15);
    }
    s.players[pIdx] = newPlayer;
    if (wasHolding) s.ball.holderId = newPlayer.id;
    if (team === "home") s.homeSubsUsed++;
    else s.awaySubsUsed++;
    const sc = this.commentary.formatSubstitution(team, newPlayer.name, outPlayer.name, s.minute);
    this.pushEvent("substitution", team, newPlayer.id, newPlayer.name, newPlayer.pos, sc.text, void 0, sc.level);
    this.dispatchHook(team, "onSubIn");
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
        reported: false
      });
    }
    if (this.prologueScriptedMode && team === this.userTeamSide && inSubId === "prologue_vet_10") {
      this.prologueWaitingForSub = false;
      this.prologueStage = 5;
      this.prologueScriptTicks = 0;
      this.pushEvent("commentary", team, newPlayer.id, newPlayer.name, newPlayer.pos, "\u301080' \u8001\u961F\u957F\u767B\u573A\u301137\u5C81\u961F\u957F #10 \u6797\u950B\u66FF\u8865\u767B\u573A\uFF01\u5168\u573A\u516B\u4E07\u4EBA\u8D77\u7ACB\u6B22\u547C\uFF01", void 0, "important");
    }
    return { ok: true };
  }
  scoreScriptedPrologueGoal(team, shooter, assister, shotLabel) {
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
    if (team === "home") s.homeScore++;
    else s.awayScore++;
    if (assister && assister.id !== shooter?.id) {
      assister.matchStats.assists++;
    }
    s.ball.mode = "dead";
    s.ball.holderId = null;
    s.ball.pos = { ...goalPos, z: 0 };
    s.ball.vel = { x: 0, y: 0, z: 0 };
    const gc = this.commentary.formatGoal({
      minute: s.minute,
      team,
      player: shooter?.name || "\u524D\u950B",
      assist: assister?.name,
      homeScore: s.homeScore,
      awayScore: s.awayScore,
      shotType: shotLabel.includes("\u5934") ? "header" : "normal"
    });
    this.pushEvent("goal", team, shooter?.id || "", shooter?.name || "", goalPos, gc.text, 0.45, gc.level, gc.narrativeTag);
  }
  stepPrologueScripted() {
    const s = this.state;
    if (s.phase === "full_time") return s;
    const side = this.userTeamSide ?? "home";
    const sk = this.userEquippedSkills[0];
    const striker = s.players.find((p) => p.team === side && !p.redCard && (p.shirtNumber === 10 || p.role === "ST")) ?? s.players.find((p) => p.team === side && !p.redCard && p.role !== "GK");
    const winger = s.players.find((p) => p.team === side && !p.redCard && ["RW", "LW", "RM", "LM"].includes(p.role)) ?? s.players.find((p) => p.team === side && !p.redCard && p.id !== striker?.id && p.role !== "GK");
    const cam = s.players.find((p) => p.team === side && !p.redCard && ["CAM", "CM"].includes(p.role)) ?? s.players.find((p) => p.team === side && !p.redCard && p.id !== striker?.id && p.role !== "GK");
    if (this.prologueWaitingForCard !== null || this.prologueWaitingForSub || s.activeSkillPrompt) {
      return s;
    }
    s.tick++;
    s.minute = Math.min(95, Math.floor(s.tick / SIM_CONFIG.TICKS_PER_MINUTE));
    if (s.tick % SIM_CONFIG.TICKS_PER_MINUTE === 0) {
      this.expireCommandBuffs();
    }
    updateOffBallTargets(s.players, s.ball, s.homeAttackDir, s.homeStyle, s.awayStyle, s.homeFormation, s.awayFormation, this.homeMods, this.awayMods);
    stepPlayersPhysics(s.players, s.ball);
    s.stats.home.possessionTicks++;
    if (this.prologueStage === 0) {
      const carrier = winger ?? cam ?? striker;
      if (carrier) {
        const prog = Math.min(1, Math.max(0, (s.tick - 45 * SIM_CONFIG.TICKS_PER_MINUTE) / (2 * SIM_CONFIG.TICKS_PER_MINUTE)));
        carrier.pos = { x: 52 + prog * 18, y: 44 - prog * 6 };
        this.giveBallTo(carrier);
      }
      if (s.minute >= 47) {
        this.prologueWaitingForCard = 1;
        this.pushEvent("commentary", side, "", "", { x: 70, y: 38 }, "\u3010\u6559\u5B66 1/5\u3011\u6211\u65B9\u8FB9\u8DEF\u63A8\u8FDB\u81F3\u524D\u573A\uFF01\u6253\u51FA\u8FDB\u653B\u5361\u3010\u4E24\u7FFC\u9F50\u98DE\xB7\u8FB9\u8DEF\u7206\u7834\u3011\u6495\u5F00\u9632\u7EBF\uFF01", void 0, "important");
      }
    } else if (this.prologueStage === 1) {
      this.prologueScriptTicks++;
      const t = Math.min(1, this.prologueScriptTicks / 18);
      if (winger && striker) {
        winger.pos = { x: 70 + t * 20, y: 48 };
        striker.pos = { x: 78 + t * 13, y: 33 };
        if (this.prologueScriptTicks < 13) {
          this.giveBallTo(winger);
        } else if (this.prologueScriptTicks < 19) {
          s.ball.mode = "pass";
          s.ball.holderId = null;
          s.ball.lastPasserId = winger.id;
          const pt = (this.prologueScriptTicks - 12) / 6;
          s.ball.pos = { x: winger.pos.x + (striker.pos.x - winger.pos.x) * pt, y: winger.pos.y + (striker.pos.y - winger.pos.y) * pt, z: 0 };
        } else {
          this.scoreScriptedPrologueGoal("home", striker, winger, "\u8FB9\u8DEF\u4F20\u4E2D\u62A2\u70B9");
          this.prologueStage = 2;
          this.prologueScriptTicks = 0;
        }
      }
    } else if (this.prologueStage === 2) {
      const carrier = cam ?? striker;
      if (carrier) {
        const prog = Math.min(1, Math.max(0, (s.minute - 50) / 8));
        carrier.pos = { x: 48 + prog * 23, y: 30 + prog * 5 };
        this.giveBallTo(carrier);
      }
      if (s.minute >= 58) {
        this.prologueWaitingForCard = 2;
        this.pushEvent("commentary", side, "", "", { x: 71, y: 35 }, "\u3010\u6559\u5B66 2/5\u3011\u6211\u65B9\u518D\u6B21\u538B\u5165\u5BF9\u624B\u8179\u5730\uFF01\u6253\u51FA\u8FDB\u653B\u5361\u3010\u5168\u7EBF\u538B\u4E0A\xB7\u7EDD\u5730\u603B\u653B\u3011\u5F3A\u653B\u8FFD\u5206\uFF01", void 0, "important");
      }
    } else if (this.prologueStage === 3) {
      this.prologueScriptTicks++;
      const t = Math.min(1, this.prologueScriptTicks / 18);
      if (cam && striker) {
        cam.pos = { x: 71 + t * 14, y: 36 };
        striker.pos = { x: 79 + t * 13, y: 33 };
        if (this.prologueScriptTicks < 13) {
          this.giveBallTo(cam);
        } else if (this.prologueScriptTicks < 19) {
          s.ball.mode = "pass";
          s.ball.holderId = null;
          s.ball.lastPasserId = cam.id;
          const pt = (this.prologueScriptTicks - 12) / 6;
          s.ball.pos = { x: cam.pos.x + (striker.pos.x - cam.pos.x) * pt, y: cam.pos.y + (striker.pos.y - cam.pos.y) * pt, z: 0 };
        } else {
          this.scoreScriptedPrologueGoal("home", striker, cam, "\u7981\u533A\u63A8\u5C04");
          this.prologueStage = 4;
          this.prologueScriptTicks = 0;
          this.pushEvent("commentary", side, "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u3010\u8FFD\u81F3 2:3\u3011\u5168\u961F\u71C3\u8D77\u6597\u5FD7\uFF01\u4F46\u6BD4\u8D5B\u6240\u5269\u65E0\u51E0\uFF0C\u7B2C 85 \u5206\u949F\u51C6\u5907\u6362\u4E0A\u8001\u961F\u957F\uFF01", void 0, "important");
        }
      }
    } else if (this.prologueStage === 4) {
      const carrier = cam ?? striker;
      if (carrier) {
        carrier.pos = { x: 64 + Math.sin(s.tick * 0.2) * 5, y: 34 + Math.cos(s.tick * 0.15) * 6 };
        this.giveBallTo(carrier);
      }
      if (s.minute >= 85) {
        this.prologueWaitingForSub = true;
        this.pushEvent("commentary", side, "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u3010\u6559\u5B66 3/5 \xB7 85'\u6362\u4EBA\u3011\u65F6\u95F4\u6240\u5269\u65E0\u51E0\uFF01\u8BF7\u6362\u4E0A\u66FF\u8865\u5E2D\u7684 37\u5C81\u8001\u961F\u957F #10 \u6797\u950B\uFF01", void 0, "important");
      }
    } else if (this.prologueStage === 5) {
      this.prologueScriptTicks++;
      const veteran = s.players.find((p) => p.team === side && p.shirtNumber === 10) ?? striker;
      if (veteran) {
        veteran.pos = { x: 82, y: 32 };
        this.giveBallTo(veteran);
      }
      if (this.prologueScriptTicks >= 8 && sk) {
        s.activeSkillPrompt = {
          skillId: sk.id,
          name: sk.name,
          situationLabel: `${s.minute}' 2:3 \u7EDD\u5883\u6273\u5E73\u673A\u4F1A \xB7 \u8001\u5C06\u7981\u533A\u524D\u62FF\u7403`,
          powerLabel: "\u5FC5\u6740\u91CD\u70AE \xB7 \u6273\u5E73\u6BD4\u5206 3:3",
          expiresTick: s.tick + 9999,
          isCardBoosted: true,
          effectiveRank: 3,
          instantLabel: sk.instantLabel,
          vfxTheme: "ult"
        };
      }
    } else if (this.prologueStage === 6) {
      this.prologueScriptTicks++;
      const veteran = s.players.find((p) => p.team === side && p.shirtNumber === 10) ?? striker;
      if (veteran) {
        veteran.pos = { x: 75 + Math.min(8, this.prologueScriptTicks * 0.2), y: 35 };
        this.giveBallTo(veteran);
      }
      if (s.minute >= 90 && sk) {
        if (veteran) veteran.pos = { x: 83, y: 35 };
        s.activeSkillPrompt = {
          skillId: sk.id,
          name: sk.name,
          situationLabel: `${s.minute}' 3:3 \u8865\u65F6\u6700\u540E\u4E00\u653B \xB7 \u51A0\u519B\u7EDD\u6740`,
          powerLabel: "\u6700\u540E\u4E00\u821E \xB7 4:3 \u9006\u8F6C\u593A\u51A0",
          expiresTick: s.tick + 9999,
          isCardBoosted: true,
          effectiveRank: 3,
          instantLabel: sk.instantLabel,
          vfxTheme: "ult"
        };
      }
    } else if (this.prologueStage === 7) {
      if (s.minute >= 92) {
        s.phase = "full_time";
        this.finalizeStats();
        const fc = this.commentary.formatFulltime(s.minute, s.homeScore, s.awayScore);
        this.pushEvent("fulltime", "home", "", "\u4E3B\u961F", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, fc.text, void 0, fc.level);
      }
    }
    return s;
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
    const freezePrologueClock = this.prologueScriptedMode && (this.prologueWaitingForCard !== null || this.prologueWaitingForSub || !!s.activeSkillPrompt);
    if (!freezePrologueClock) {
      s.tick++;
      s.minute = Math.min(95, Math.floor(s.tick / SIM_CONFIG.TICKS_PER_MINUTE));
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
    if (s.tick % SIM_CONFIG.TICKS_PER_MINUTE === 0) {
      this.drainFitness();
      this.expireCommandBuffs();
      const lull = this.commentary.checkLull(s.minute);
      if (lull) {
        this.pushEvent("commentary", "home", "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, lull.text, void 0, lull.level, lull.narrativeTag);
      }
    }
    const firstHalfEnd = 45 * SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksFirst;
    const secondHalfEnd = firstHalfEnd + 45 * SIM_CONFIG.TICKS_PER_MINUTE + this.stoppageTicksSecond;
    if (s.phase === "first_half" && s.tick >= firstHalfEnd) {
      s.phase = "half_time";
      const hc = this.commentary.formatHalftime(s.minute, s.homeScore, s.awayScore);
      this.pushEvent("halftime", "home", "", "\u4E3B\u961F", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, hc.text, void 0, hc.level);
      return s;
    }
    if (s.phase === "second_half" && s.tick >= secondHalfEnd) {
      s.phase = "full_time";
      this.finalizeStats();
      const fc = this.commentary.formatFulltime(s.minute, s.homeScore, s.awayScore);
      this.pushEvent("fulltime", "home", "", "\u4E3B\u961F", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, fc.text, void 0, fc.level);
      return s;
    }
    updateOffBallTargets(
      s.players,
      s.ball,
      s.homeAttackDir,
      s.homeStyle,
      s.awayStyle,
      s.homeFormation,
      s.awayFormation,
      this.getEffectiveMods("home"),
      this.getEffectiveMods("away")
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
      const outcomeText = dGoals > 0 ? `\u4E00\u51FB\u7834\u95E8\uFF01\u76F4\u63A5\u6539\u5199\u6BD4\u5206\uFF08+${dGoals} \u7403 \xB7 +${dXG.toFixed(2)} xG\uFF09` : dShots > 0 ? `\u5236\u9020 ${dShots} \u6B21\u5A01\u80C1\u5C04\u95E8\uFF08+${dXG.toFixed(2)} xG\uFF09` : dTackles > 0 ? `\u5B8C\u6210 ${dTackles} \u6B21\u5173\u952E\u62A2\u65AD\u593A\u56DE\u7403\u6743` : `\u5168\u961F\u6E17\u900F\u538B\u4E0A\u63A8\u8FDB\uFF08${pr.instantSummary}\uFF09`;
      s.skillResolution = {
        skillName: pr.skillName,
        outcomeText,
        isPositive: isPos,
        expiresTick: s.tick + 22
      };
      this.pushCoachReward({
        bannerText: `\u26A1 \u3010${pr.skillName}\u3011\u7ED3\u679C\uFF1A${outcomeText}`,
        tone: dGoals > 0 ? "#4ADE80" : "#FACC15"
      });
    }
    for (const tr of this.subTrackers) {
      if (tr.reported) continue;
      const pl = s.players.find((p) => p.id === tr.playerId);
      if (!pl) continue;
      const elapsed = s.minute - tr.startMin;
      const ms = pl.matchStats;
      const hasGoalContrib = ms.goals > tr.startGoals || ms.assists > tr.startAssists;
      if (hasGoalContrib || elapsed >= 15) {
        tr.reported = true;
        const actParts = [];
        if (ms.goals > 0) actParts.push(`${ms.goals}\u7403`);
        if (ms.assists > 0) actParts.push(`${ms.assists}\u52A9`);
        if (ms.shots > 0) actParts.push(`${ms.shots}\u5C04\u95E8`);
        if (ms.tackles + ms.interceptions > 0) actParts.push(`${ms.tackles + ms.interceptions}\u62A2\u65AD\u62E6\u622A`);
        const summary = actParts.length > 0 ? `\u6362\u4EBA\u89C1\u6548\uFF1A${tr.name} \u767B\u573A${Math.max(1, elapsed)}\u5206\u949F\u8D21\u732E ${actParts.join(" \xB7 ")}\uFF01` : `\u6362\u4EBA\u8FFD\u8E2A\uFF1A${tr.name} \u767B\u573A${Math.max(1, elapsed)}\u5206\u949F\uFF0C\u5BF9\u65B9\u76EF\u9632\u4E25\u5BC6\u6682\u672A\u89C5\u5F97\u826F\u673A`;
        this.pushCoachReward({ bannerText: summary, tone: actParts.length > 0 ? "#38BDF8" : "#94A3B8" });
        this.pushEvent("commentary", pl.team, pl.id, pl.name, pl.pos, summary, void 0, actParts.length > 0 ? "important" : "normal");
      }
    }
    if (this.prologueScriptedMode && this.userTeamSide) {
      const side = this.userTeamSide;
      const dir = this.getAttackDir(side);
      const sk = this.userEquippedSkills[0];
      const nudgeForward = (p, tx, ty, speedMul = 1.15) => {
        p.targetPos = { x: tx, y: ty };
        const dx = tx - p.pos.x;
        const dy = ty - p.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 1.5) {
          const stepSpd = Math.min(d, 0.85 * speedMul);
          p.vel = { x: dx / d * stepSpd * 10, y: dy / d * stepSpd * 10 };
          p.pos = { x: p.pos.x + dx / d * stepSpd, y: p.pos.y + dy / d * stepSpd };
        }
      };
      const guideHomeBuildUp = (minX) => {
        const carrier = s.players.find((p) => p.team === side && !p.redCard && p.hasBall) ?? s.players.find((p) => p.team === side && !p.redCard && ["CAM", "CM", "LW", "RW"].includes(p.role)) ?? s.players.find((p) => p.team === side && !p.redCard && p.role !== "GK");
        if (carrier) {
          if (!carrier.hasBall && s.ball.mode !== "pass" && s.ball.mode !== "shot" && s.ball.lastTouchTeam !== side) {
            this.giveBallTo(carrier);
          }
          if (toRelativeX(carrier.pos.x, dir) < minX) {
            nudgeForward(carrier, dir === 1 ? minX + 4 : PITCH.LENGTH - (minX + 4), PITCH.HALF_Y, 1.25);
          }
        }
        const striker = s.players.find((p) => p.team === side && !p.redCard && p.id === "prologue_st_19");
        if (striker && toRelativeX(striker.pos.x, dir) < minX + 10) {
          nudgeForward(striker, dir === 1 ? minX + 14 : PITCH.LENGTH - (minX + 14), PITCH.GOAL_Y - 1.5, 1.2);
        }
      };
      if (this.prologueStage === 0 && s.minute >= 46) {
        guideHomeBuildUp(64);
        if (s.minute >= 47 && this.prologueWaitingForCard === null) {
          this.prologueWaitingForCard = 1;
          this.pushEvent("commentary", side, "", "", { x: s.ball.pos.x, y: s.ball.pos.y }, "\u3010\u573A\u5916\u6307\u6325\u3011\u6211\u65B9\u8FB9\u8DEF\u63A8\u8FDB\u81F3\u524D\u573A\uFF01\u6253\u51FA\u8FDB\u653B\u5361\u3010\u4E24\u7FFC\u9F50\u98DE\xB7\u8FB9\u8DEF\u7206\u7834\u3011\u6495\u5F00\u9632\u7EBF\uFF01", void 0, "important");
        }
      } else if (this.prologueStage === 1) {
        this.prologueGuaranteedGoal = true;
        if (s.homeScore >= 1) {
          this.prologuePendingForcedGoal = false;
          this.prologueGuaranteedGoal = false;
          this.prologueStage = 2;
        } else if (this.prologuePendingForcedGoal) {
          const attacker = s.players.find((p) => p.team === side && !p.redCard && p.id === "prologue_st_19") ?? s.players.find((p) => p.team === side && !p.redCard && ["ST", "CAM", "LW", "RW"].includes(p.role)) ?? s.players.find((p) => p.team === side && !p.redCard && p.role !== "GK");
          if (attacker) {
            nudgeForward(attacker, dir === 1 ? PITCH.LENGTH - 15 : 15, PITCH.GOAL_Y - 1, 1.35);
          }
          if (this.prologueGoalDelayTicks > 0) {
            this.prologueGoalDelayTicks--;
            if (this.prologueGoalDelayTicks === 10 && attacker && !attacker.hasBall && s.ball.mode === "held") {
              const holder = s.players.find((p) => p.id === s.ball.holderId && p.team === side);
              if (holder && holder.id !== attacker.id) {
                this.executePass(holder, attacker, "through");
              }
            }
          } else if (s.ball.mode !== "shot" && attacker && toRelativeX(attacker.pos.x, dir) >= 72) {
            if (!attacker.hasBall) this.giveBallTo(attacker);
            this.executeShot(attacker, 0.78, true);
          }
        }
      } else if (this.prologueStage === 2) {
        const awayAttacker = s.players.find((p) => p.team === "away" && !p.redCard && p.role === "ST") ?? s.players.find((p) => p.team === "away" && !p.redCard && ["CAM", "LW", "RW"].includes(p.role)) ?? s.players.find((p) => p.team === "away" && !p.redCard && p.role !== "GK");
        if (s.minute >= 52 && this.prologueAwayGoalCount === 0 && s.awayScore === 1) {
          if (awayAttacker) {
            if (!awayAttacker.hasBall && s.ball.mode !== "shot" && s.ball.mode !== "pass" && s.ball.lastTouchTeam !== "away") {
              this.giveBallTo(awayAttacker);
            }
            awayAttacker.decisionCooldown = 6;
            const prog = Math.min(1, Math.max(0, (s.minute - 52) / 3));
            const targetX = 48 - prog * 24;
            nudgeForward(awayAttacker, targetX, PITCH.GOAL_Y - 1.5, 1.35);
            if (s.minute >= 55 && awayAttacker.pos.x <= 28 || s.minute >= 57) {
              if (s.ball.mode !== "shot") {
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
            if (!awayAttacker.hasBall && s.ball.mode !== "shot" && s.ball.mode !== "pass" && s.ball.lastTouchTeam !== "away") {
              this.giveBallTo(awayAttacker);
            }
            awayAttacker.decisionCooldown = 6;
            const prog = Math.min(1, Math.max(0, (s.minute - 61) / 3));
            const targetX = 48 - prog * 24;
            nudgeForward(awayAttacker, targetX, PITCH.GOAL_Y + 1.5, 1.35);
            if (s.minute >= 64 && awayAttacker.pos.x <= 28 || s.minute >= 66) {
              if (s.ball.mode !== "shot") {
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
            this.pushEvent("commentary", side, "", "", { x: s.ball.pos.x, y: s.ball.pos.y }, "\u30101:3 \u7EDD\u5883\u3011\u80CC\u6C34\u4E00\u6218\uFF01\u6253\u51FA\u8FDB\u653B\u5361\u3010\u5168\u7EBF\u538B\u4E0A\xB7\u7EDD\u5730\u603B\u653B\u3011\uFF0C\u640F\u547D\u53CD\u6251\uFF01", void 0, "important");
          }
        }
      } else if (this.prologueStage === 3) {
        this.prologueGuaranteedGoal = true;
        if (s.homeScore >= 2) {
          this.prologuePendingForcedGoal = false;
          this.prologueGuaranteedGoal = false;
          this.prologueStage = 4;
          const crampStriker = s.players.find((p) => p.team === side && p.id === "prologue_st_19") ?? s.players.find((p) => p.team === side && !p.redCard && p.role === "ST");
          if (crampStriker) crampStriker.fitness = 30;
          this.pushEvent("commentary", side, "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u30102:3 \u770B\u5230\u5E0C\u671B\u3011#19 \u9648\u5C0F\u5B87\u6885\u5F00\u4E8C\u5EA6\uFF0C\u4F46\u843D\u5730\u65F6\u5C0F\u817F\u62BD\u7B4B\uFF01\u66FF\u8865\u5E2D\u4E0A #10 \u6797\u950B\u6495\u5F00\u4E86\u5DE6\u819D\u51B0\u888B\uFF01", void 0, "important");
        } else if (this.prologuePendingForcedGoal) {
          const attacker = s.players.find((p) => p.team === side && !p.redCard && p.id === "prologue_st_19") ?? s.players.find((p) => p.team === side && !p.redCard && ["ST", "CAM", "RW", "LW"].includes(p.role)) ?? s.players.find((p) => p.team === side && !p.redCard && p.role !== "GK");
          if (attacker) {
            nudgeForward(attacker, dir === 1 ? PITCH.LENGTH - 15 : 15, PITCH.GOAL_Y + 1, 1.35);
          }
          if (this.prologueGoalDelayTicks > 0) {
            this.prologueGoalDelayTicks--;
            if (this.prologueGoalDelayTicks === 10 && attacker && !attacker.hasBall && s.ball.mode === "held") {
              const holder = s.players.find((p) => p.id === s.ball.holderId && p.team === side);
              if (holder && holder.id !== attacker.id) {
                this.executePass(holder, attacker, "through");
              }
            }
          } else if (s.ball.mode !== "shot" && attacker && toRelativeX(attacker.pos.x, dir) >= 72) {
            if (!attacker.hasBall) this.giveBallTo(attacker);
            this.executeShot(attacker, 0.78, true);
          }
        }
      } else if (this.prologueStage === 4) {
        if (s.minute >= 80 && s.homeSubs.some((sub) => sub.id === "prologue_vet_10")) {
          if (!this.prologueWaitingForSub) {
            this.prologueWaitingForSub = true;
            this.pushEvent("commentary", side, "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, "\u301080' \u62BD\u7B4B\u8B66\u62A5\u3011#19 \u9648\u5C0F\u5B87\u62FC\u5230\u62BD\u7B4B\uFF01\u8BF7\u70B9\u51FB\u53F3\u4E0A\u3010\u6362\u4EBA/\u6218\u672F\u3011\uFF0C\u6362\u4E0A\u8001\u961F\u957F #10 \u6797\u950B\uFF01", void 0, "important");
          }
        }
      } else if (this.prologueStage === 5 && s.homeScore < 3) {
        const veteran = s.players.find((p) => p.team === side && (p.id === "prologue_vet_10" || p.name.includes("\u6797\u950B"))) ?? s.players.find((p) => p.team === side && p.role !== "GK");
        if (veteran && s.minute >= 80) {
          const oppXs = s.players.filter((p) => p.team !== side && !p.redCard).map((p) => p.pos.x).sort((a, b) => dir === 1 ? b - a : a - b);
          const offsideLineX = oppXs[1] ?? (dir === 1 ? 80 : 25);
          const safeMaxX = dir === 1 ? Math.min(offsideLineX - 2, 76) : Math.max(offsideLineX + 2, PITCH.LENGTH - 76);
          if (s.minute < 84) {
            if (dir === 1 && veteran.pos.x > safeMaxX) veteran.pos.x = safeMaxX;
            if (dir === -1 && veteran.pos.x < safeMaxX) veteran.pos.x = safeMaxX;
          }
          const runTargetX = s.minute >= 84 ? dir === 1 ? Math.min(PITCH.LENGTH - 18, Math.max(safeMaxX, 82)) : Math.max(18, Math.min(safeMaxX, PITCH.LENGTH - 82)) : safeMaxX;
          nudgeForward(veteran, runTargetX, PITCH.GOAL_Y - 1, 1.25);
        }
        if (s.minute >= 85 && s.ball.mode !== "shot" && veteran && toRelativeX(veteran.pos.x, dir) >= 68) {
          this.prologueGuaranteedGoal = true;
          if (!veteran.hasBall) this.giveBallTo(veteran);
          this.executeShot(veteran, 0.85, true);
        }
      } else if (this.prologueStage === 6 && s.homeScore === 3 && sk) {
        const veteran = s.players.find((p) => p.team === side && (p.id === "prologue_vet_10" || p.name.includes("\u6797\u950B"))) ?? s.players.find((p) => p.team === side && p.role !== "GK");
        if (veteran && s.minute >= 86) {
          const oppXs = s.players.filter((p) => p.team !== side && !p.redCard).map((p) => p.pos.x).sort((a, b) => dir === 1 ? b - a : a - b);
          const offsideLineX = oppXs[1] ?? (dir === 1 ? 80 : 25);
          const safeMaxX = dir === 1 ? Math.min(offsideLineX - 2, 75) : Math.max(offsideLineX + 2, PITCH.LENGTH - 75);
          if (s.minute < 89) {
            if (dir === 1 && veteran.pos.x > safeMaxX) veteran.pos.x = safeMaxX;
            if (dir === -1 && veteran.pos.x < safeMaxX) veteran.pos.x = safeMaxX;
          }
          const runTargetX = s.minute >= 89 ? dir === 1 ? Math.min(PITCH.LENGTH - 21, Math.max(safeMaxX, 81)) : Math.max(21, Math.min(safeMaxX, PITCH.LENGTH - 81)) : safeMaxX;
          nudgeForward(veteran, runTargetX, PITCH.GOAL_Y + 0.8, 1.25);
        }
        if (s.minute >= 90 && !s.activeSkillPrompt && s.ball.mode !== "shot" && veteran && toRelativeX(veteran.pos.x, dir) >= 68) {
          if (!veteran.hasBall) this.giveBallTo(veteran);
          s.activeSkillPrompt = {
            skillId: sk.id,
            name: sk.name,
            situationLabel: `${s.minute}' 3:3 \u8865\u65F6\u6700\u540E\u4E00\u653B \xB7 \u51A0\u519B\u7EDD\u6740`,
            powerLabel: "\u6700\u540E\u4E00\u821E \xB7 4:3 \u9006\u8F6C\u593A\u51A0",
            expiresTick: s.tick + 9999,
            isCardBoosted: true,
            effectiveRank: 3,
            instantLabel: sk.instantLabel,
            vfxTheme: "ult"
          };
        }
      }
    }
    if (!this.prologueScriptedMode && !s.activeSkillPrompt && this.userTeamSide && this.userEquippedSkills.length > 0 && s.tick % 2 === 0) {
      this.evaluateActiveSkillTriggers(this.userTeamSide);
    }
    return s;
  }
  evaluateActiveSkillTriggers(team) {
    const s = this.state;
    const b = s.ball;
    if (b.mode === "dead") return;
    const nonSkillBuffs = s.activeBuffs.filter((bf) => bf.team === team && !bf.effect.id.startsWith("sk_"));
    const hasAnyCardBuff = nonSkillBuffs.length > 0;
    const dir = this.getAttackDir(team);
    const relX = toRelativeX(b.pos.x, dir);
    const oppRelX = 105 - relX;
    const teamHasBall = b.lastTouchTeam === team;
    for (const sk of this.userEquippedSkills) {
      const uses = s.skillUses?.[sk.id] ?? 0;
      if (uses >= sk.maxPerMatch) continue;
      const cdEnd = s.skillCooldowns?.[sk.id] ?? 0;
      if (s.minute < cdEnd) continue;
      const elementMatch = !!sk.linkedElement && nonSkillBuffs.some((bf) => bf.effect.element === sk.linkedElement);
      const archetypeMatch = !!sk.linkedElement && s.deckArchetypeGene?.[team] === sk.linkedElement;
      const synergyBuff = nonSkillBuffs.find((bf) => {
        const syn = bf.effect.skillSynergy;
        if (!syn) return false;
        return syn.targetSkillTags.includes("all") || syn.targetSkillTags.includes(sk.situation);
      });
      const effModsForSkill = this.getEffectiveMods(team);
      const rankBoost = (synergyBuff?.effect.skillSynergy?.rankBoost ?? 0) + (effModsForSkill.skillTempRankBonus ?? 0);
      const promptBonus = synergyBuff?.effect.skillSynergy?.promptBonusRate ?? 0;
      const effRank = Math.min(3, (sk.effectiveRank ?? 1) + rankBoost);
      const thresholdDrop = (hasAnyCardBuff ? 20 : 0) + (effRank >= 3 ? 10 : 0) + (archetypeMatch ? 10 : 0) + Math.round(promptBonus * 25);
      if (this.userFamAvg < Math.max(10, sk.minFamiliarity - thresholdDrop)) continue;
      if (this.userChemAvg < Math.max(10, sk.minChemistry - thresholdDrop)) continue;
      const isLeadingNow = team === "home" ? s.homeScore > s.awayScore : s.awayScore > s.homeScore;
      const lastConceded = s.lastConcededMin?.[team] ?? -99;
      let matched = false;
      switch (sk.situation) {
        case "opponent_through_ball":
          matched = !teamHasBall && (b.mode === "pass" && (b.passType === "through" || b.passType === "long") || oppRelX >= 62 && b.mode === "held");
          break;
        case "box_danger":
          matched = !teamHasBall && oppRelX > 72;
          break;
        case "attacking_final_third":
          matched = teamHasBall && relX > 62;
          break;
        case "wing_overload":
          matched = teamHasBall && (b.pos.y < 18 || b.pos.y > 50);
          break;
        case "counter_opportunity":
          matched = teamHasBall && relX < 56 && b.mode === "held";
          break;
        case "midfield_press":
          matched = !teamHasBall && oppRelX >= 32 && oppRelX <= 76;
          break;
        case "trailing_late":
          matched = s.minute >= 68 && (this.isTrailing(team) || s.homeScore === s.awayScore);
          break;
        case "any_possession":
          matched = teamHasBall && b.mode === "held" && s.minute >= 48 && (this.isTrailing(team) || s.homeScore === s.awayScore || relX >= 60);
          break;
        case "set_piece_moment":
          matched = teamHasBall && relX > 68 && (b.passType === "cross" || s.stats[team].corners > 0);
          break;
        case "leading_late":
          matched = s.minute >= 70 && isLeadingNow;
          break;
        case "just_conceded":
          matched = lastConceded >= 0 && s.minute - lastConceded <= 4;
          break;
        case "high_possession":
          matched = teamHasBall && (this.v6PassStreak[team] >= 4 || (s.aspectStacks?.passSeq ?? 0) >= 4);
          break;
      }
      if (matched) {
        const boostTag = elementMatch ? " (\u5143\u7D20\u8FC7\u8F7D+35%)" : hasAnyCardBuff ? " (\u5361\u724C\u5171\u632F+20%)" : "";
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
          vfxTheme: sk.vfxTheme ?? "ult"
        };
        break;
      }
    }
  }
  executeInstantSkillAction(team, sk, mul) {
    const s = this.state;
    const b = s.ball;
    const dir = this.getAttackDir(team);
    const goalX = dir === 1 ? PITCH.LENGTH : 0;
    const friendly = s.players.filter((p) => p.team === team && !p.redCard);
    const holder = b.holderId ? s.players.find((p) => p.id === b.holderId) : void 0;
    const action = sk.instantAction ?? "force_through_ball";
    switch (action) {
      case "clear_danger": {
        if (holder && holder.team !== team) holder.stunTicks = 12;
        const defender = friendly.filter((p) => p.role !== "GK").sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        const target = friendly.filter((p) => p.role !== "GK" && p.id !== defender?.id).sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        if (defender && target) {
          this.giveBallTo(defender);
          defender.matchStats.interceptions++;
          s.stats[team].interceptions++;
          launchPassBall(b, defender.pos, target.pos, defender, target, "long");
        } else if (defender) {
          this.giveBallTo(defender);
        }
        if (this.hasUserAspect("clear_counter_stack") && s.aspectStacks) {
          s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
        }
        return "\u5F3A\u786C\u65AD\u7403\u89E3\u56F4\u5316\u9669\uFF01";
      }
      case "instant_counter_pass": {
        const passer = (holder && holder.team === team ? holder : void 0) ?? friendly.filter((p) => p.role !== "GK").sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        const target = friendly.filter((p) => p.role !== "GK" && p.id !== passer?.id).sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        if (passer && target) {
          if (b.mode !== "held" || holder?.team !== team) {
            this.giveBallTo(passer);
          }
          this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 20);
          launchPassBall(b, passer.pos, target.pos, passer, target, "long");
          if (this.hasUserAspect("counter_pass_speed")) {
            b.vel.x *= 1.2;
            b.vel.y *= 1.2;
          }
          return `\u6781\u901F\u957F\u4F20\u8FDE\u7EBF ${target.name}\uFF01`;
        }
        return "\u5168\u961F\u77AC\u95F4\u63D0\u901F\u53CD\u51FB\uFF01";
      }
      case "force_through_ball": {
        const passer = (holder && holder.team === team ? holder : void 0) ?? friendly.filter((p) => p.role !== "GK").sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        const target = friendly.filter((p) => p.role !== "GK" && p.id !== passer?.id).sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        if (passer && target) {
          if (holder?.team !== team) this.giveBallTo(passer);
          const leadPos = {
            x: clamp(target.pos.x + dir * 3.5, 2, PITCH.LENGTH - 2),
            y: clamp(target.pos.y, 2, PITCH.WIDTH - 2)
          };
          launchPassBall(b, passer.pos, leadPos, passer, target, "through");
          return `\u7A7F\u900F\u76F4\u585E\u6253\u7A7F\u9632\u7EBF\u627E ${target.name}\uFF01`;
        }
        return "\u4E2D\u8DEF\u6E17\u900F\u7EBF\u8DEF\u5168\u9762\u5F00\u542F\uFF01";
      }
      case "force_shot_on_target": {
        const effRank = sk.effectiveRank ?? 1;
        this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 75);
        const carrier = holder && holder.team === team ? holder : void 0;
        if (carrier && carrier.role !== "GK" && toRelativeX(carrier.pos.x, dir) > 48) {
          const dist = dist2D(carrier.pos, { x: goalX, y: PITCH.GOAL_Y });
          const rawXg = clamp((0.26 - dist * 4e-3 + effRank * 0.025) * mul, 0.14, 0.65);
          this.executeShot(carrier, rawXg, true);
          return `${carrier.name} \u6821\u51C6\u6B7B\u89D2\u7206\u5C04\uFF01`;
        }
        return "\u7981\u533A\u6821\u51C6\uFF01\u4E0B\u6B21\u5C04\u95E8\u5FC5\u4E2D\u95E8\u6846\u4E14\u5A01\u529B\u63D0\u5347\uFF01";
      }
      case "win_foul_setpiece": {
        const carrier = (holder && holder.team === team ? holder : void 0) ?? friendly.filter((p) => p.role !== "GK").sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        if (carrier) {
          const fkX = dir === 1 ? clamp(Math.max(carrier.pos.x, PITCH.HALF_X + 12), PITCH.HALF_X + 10, PITCH.LENGTH - 18) : clamp(Math.min(carrier.pos.x, PITCH.HALF_X - 12), 18, PITCH.HALF_X - 10);
          this.setDeadBall(team, "freekick", { x: fkX, y: clamp(carrier.pos.y, 6, PITCH.WIDTH - 6) }, 4);
          this.setPieceBoostTeam = team;
          this.setPieceBoostTicks = 120;
          return `${carrier.name} \u8D62\u5F97\u524D\u573A\u9AD8\u5371\u5B9A\u4F4D\u7403\uFF01`;
        }
        return "\u538B\u8FEB\u9020\u72AF\u89C4\u83B7\u5B9A\u4F4D\u7403\u673A\u4F1A\uFF01";
      }
      case "GK_save_boost": {
        const gk = friendly.find((p) => p.role === "GK");
        if (b.mode === "shot" && b.lastTouchTeam !== team && gk) {
          gk.matchStats.saves++;
          if (gk.matchStats.saves >= 3) {
            this.tryRevealHiddenTrait(gk, "\u95E8\u7EBF\u6218\u795E");
          }
          s.stats[team].saves++;
          this.giveBallTo(gk);
          this.pushEvent("save", team, gk.id, gk.name, gk.pos, `\u3010\u95E8\u795E\u65F6\u523B\u3011${gk.name} \u4E0D\u53EF\u601D\u8BAE\u98DE\u8EAB\u6551\u4E3B\uFF01`, void 0, "important");
          return `${gk.name} \u95E8\u7EBF\u53CD\u5E94\u98DE\u6251\u5316\u89E3\u7EDD\u6740\uFF01`;
        }
        if (s.aspectStacks) {
          s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
        }
        return "\u95E8\u524D\u7ED3\u754C\u5C55\u5F00\uFF0C\u53E0\u52A0 +1 \u7EDD\u6740\u62A4\u76FE\uFF01";
      }
      case "force_cross_header": {
        const crosser = (holder && holder.team === team ? holder : void 0) ?? friendly.filter((p) => p.role !== "GK").sort((a, c) => Math.abs(c.pos.y - PITCH.HALF_Y) - Math.abs(a.pos.y - PITCH.HALF_Y))[0];
        const striker = friendly.filter((p) => p.role !== "GK" && p.id !== crosser?.id).sort((a, c) => toRelativeX(c.pos.x, dir) + c.attributes.strength * 0.4 - (toRelativeX(a.pos.x, dir) + a.attributes.strength * 0.4))[0];
        if (crosser && striker) {
          if (holder?.team !== team) this.giveBallTo(crosser);
          striker.pos = { x: toAbsoluteX(93, dir), y: PITCH.GOAL_Y + (Math.random() - 0.5) * 6 };
          this.giveBallTo(striker);
          this.lastShotType = "header";
          this.executeShot(striker, clamp(0.32 * mul, 0.22, 0.65), true);
          return `${crosser.name} \u5F27\u7EBF\u4F20\u4E2D\uFF0C${striker.name} \u9AD8\u7A7A\u9738\u4E3B\u5934\u69CC\u653B\u95E8\uFF01`;
        }
        return "\u8FB9\u8DEF\u8D77\u7403\u7981\u533A\u53CC\u70B9\u5305\u6284\uFF01";
      }
      case "tactical_foul_stop": {
        const oppTeam = team === "home" ? "away" : "home";
        const tackler = friendly.filter((p) => p.role !== "GK").sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        if (holder && holder.team !== team) holder.stunTicks = 10;
        const safeX = dir === 1 ? Math.max(24, b.pos.x) : Math.min(PITCH.LENGTH - 24, b.pos.x);
        this.setDeadBall(oppTeam, "freekick", { x: safeX, y: b.pos.y }, 6);
        if (tackler && sk.mutationTag !== "grant_shield_stack" && Math.random() < 0.3) {
          tackler.yellowCards++;
          s.stats[team].yellowCards++;
          this.pushEvent("yellow_card", team, tackler.id, tackler.name, tackler.pos, `${tackler.name} \u6218\u672F\u72AF\u89C4\u7834\u574F\u53CD\u51FB\u67D3\u9EC4`, void 0, "normal");
        }
        return `${tackler?.name ?? "\u540E\u8170"} \u679C\u65AD\u6218\u672F\u72AF\u89C4\u6390\u65AD\u5BF9\u624B\u53CD\u51FB\uFF01`;
      }
      case "gk_long_launch": {
        const gk = friendly.find((p) => p.role === "GK");
        const target = friendly.filter((p) => p.role !== "GK").sort((a, c) => toRelativeX(c.pos.x, dir) - toRelativeX(a.pos.x, dir))[0];
        if (gk && target) {
          this.giveBallTo(gk);
          this.gkCounterBoostTicks[team] = 60;
          this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 30);
          launchPassBall(b, gk.pos, target.pos, gk, target, "long");
          b.vel.x *= 1.22;
          b.vel.y *= 1.22;
          return `${gk.name} \u95E8\u795E\u957F\u4F20\u5236\u5BFC\u76F4\u627E ${target.name}\uFF01`;
        }
        return "\u95E8\u5C06\u5927\u811A\u53D1\u52A8\u95EA\u7535\u53CD\u51FB\uFF01";
      }
      case "tempo_burst_intercept":
      default: {
        if (holder && holder.team !== team) holder.stunTicks = 12;
        const interceptor = friendly.filter((p) => p.role !== "GK").sort((a, c) => dist2D(a.pos, b.pos) - dist2D(c.pos, b.pos))[0];
        if (interceptor) {
          this.giveBallTo(interceptor);
          interceptor.matchStats.interceptions++;
          s.stats[team].interceptions++;
          return `${interceptor.name} \u77AC\u6B65\u53CD\u62A2\u76F4\u63A5\u65AD\u7403\uFF01`;
        }
        return "\u4E2D\u524D\u573A\u7EDE\u6740\u593A\u53D6\u8282\u594F\uFF01";
      }
    }
  }
  triggerActiveSkill(team, skillId) {
    const s = this.state;
    const sk = this.userEquippedSkills.find((x) => x.id === skillId);
    const failRes = {
      ok: false,
      triggered: false,
      skillId,
      skillName: sk?.name ?? skillId,
      vfxTheme: sk?.vfxTheme ?? "ult",
      instantSummary: "",
      effectiveRank: sk?.effectiveRank ?? 1,
      isCardBoosted: false
    };
    if (!sk) return failRes;
    const uses = s.skillUses?.[skillId] ?? 0;
    if (uses >= sk.maxPerMatch) return failRes;
    const cdEnd = s.skillCooldowns?.[skillId] ?? 0;
    if (s.minute < cdEnd) return failRes;
    if (this.prologueScriptedMode && team === this.userTeamSide) {
      this.prologueSkillTriggered = true;
      this.prologueGuaranteedGoal = true;
      const veteran = s.players.find((p) => p.team === team && (p.id === "prologue_vet_10" || p.name.includes("\u6797\u950B"))) ?? s.players.find((p) => p.team === team && p.role !== "GK");
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
        vfxTheme: sk.vfxTheme ?? "ult",
        instantSummary: wasStage5 ? "\u8001\u961F\u957F\u8FDC\u5C04\u8F70\u5165\u6B7B\u89D2\uFF0C\u5373\u5C06\u6273\u5E73 3:3\uFF01" : "\u8865\u65F6\u7EDD\u6740\u8D77\u811A\uFF0C4:3 \u9006\u8F6C\u5728\u671B\uFF01",
        effectiveRank: sk.effectiveRank ?? 3,
        isCardBoosted: true
      };
    }
    const nonSkillBuffs = s.activeBuffs.filter((bf) => bf.team === team && !bf.effect.id.startsWith("sk_"));
    const hasAnyCardBuff = nonSkillBuffs.length > 0;
    const isElementOverdrive = !!sk.linkedElement && nonSkillBuffs.some((bf) => bf.effect.element === sk.linkedElement);
    const mul = isElementOverdrive ? 1.35 : hasAnyCardBuff ? 1.2 : 1;
    const instantSummary = this.executeInstantSkillAction(team, sk, mul);
    const oppTeam = team === "home" ? "away" : "home";
    const dualBranchActive = this.getEffectiveMods(team).skillDualBranch;
    const tagsToApply = [];
    if (sk.mutationTag) tagsToApply.push(sk.mutationTag);
    if (dualBranchActive && sk.secondaryMutationTag && sk.secondaryMutationTag !== sk.mutationTag) {
      tagsToApply.push(sk.secondaryMutationTag);
    }
    for (const tag of tagsToApply) {
      switch (tag) {
        case "bypass_offside":
          this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
          break;
        case "guarantee_shot_on_target":
          this.guaranteeShotOnTargetTicks[team] = Math.max(this.guaranteeShotOnTargetTicks[team], 65);
          break;
        case "refund_card_energy":
          this.pushCoachReward({ energyRefund: 1, bannerText: `\u3010${sk.name}\xB7\u8D28\u53D8\u3011\u8FD4\u8FD8 +1 \u6307\u6325\u80FD\u91CF`, tone: "#FBBF24" });
          break;
        case "reduce_all_cd":
          this.reduceEquippedCooldowns(3);
          break;
        case "reset_all_cd":
          this.reduceEquippedCooldowns(99);
          break;
        case "grant_shield_stack":
          if (s.aspectStacks) {
            s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
          }
          break;
        case "steal_tempo":
          this.oppTempoDrainTicks[oppTeam] = Math.max(this.oppTempoDrainTicks[oppTeam], 120);
          break;
        case "counter_damage_amp":
          if (s.aspectStacks) {
            s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
          }
          break;
        case "force_yellow_card": {
          const targetDef = s.players.filter((p) => p.team === oppTeam && !p.redCard && p.role !== "GK").sort((a, c) => dist2D(a.pos, s.ball.pos) - dist2D(c.pos, s.ball.pos))[0];
          if (targetDef) {
            targetDef.yellowCards++;
            s.stats[oppTeam].yellowCards++;
            this.pushEvent("yellow_card", oppTeam, targetDef.id, targetDef.name, targetDef.pos, `\u3010${sk.name}\u3011\u8FEB\u4F7F ${targetDef.name} \u9886\u5230\u9EC4\u724C\uFF01`, void 0, "important");
            if (targetDef.yellowCards >= 2) {
              targetDef.redCard = true;
              s.stats[oppTeam].redCards++;
              this.pushEvent("red_card", oppTeam, targetDef.id, targetDef.name, targetDef.pos, `\u3010\u4E24\u9EC4\u53D8\u7EA2\u3011${targetDef.name} \u88AB\u7F5A\u4E0B\u573A\uFF01`, void 0, "critical");
            }
          }
          break;
        }
        case "drain_opp_stamina":
          for (const op of s.players) if (op.team === oppTeam && !op.redCard) op.fitness = Math.max(20, op.fitness - 5);
          break;
        case "heal_team":
          for (const tp of s.players) if (tp.team === team && !tp.redCard) tp.fitness = Math.min(100, tp.fitness + 6);
          break;
        case "extra_box_crash":
        case "double_duration":
          break;
      }
    }
    if (isElementOverdrive) {
      if (sk.linkedElement === "press" || sk.linkedElement === "blitz") {
        this.pushCoachReward({ nextCardDiscount: 1, bannerText: "\u3010\u5143\u7D20\u8FC7\u8F7D\u3011\u4E0B\u5F20\u6307\u6325\u5361\u6D88\u8017 -1 \u80FD\u91CF\uFF01", tone: "#F97316" });
      } else if (sk.linkedElement === "pass" && !this.aspectRefreshUsedThisMatch) {
        this.aspectRefreshUsedThisMatch = true;
        this.pushCoachReward({ refreshUsedCard: true, bannerText: "\u3010\u4F20\u5BFC\u8FC7\u8F7D\u3011\u5237\u65B0 1 \u5F20\u5DF2\u4F7F\u7528\u6307\u6325\u5361\uFF01", tone: "#22D3EE" });
      } else if (sk.linkedElement === "iron" && s.aspectStacks) {
        s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
      } else if (sk.linkedElement === "wing" && s.aspectStacks) {
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
    }
    if (s.aspectStacks) {
      if (this.hasUserAspect("wing_counter_stack") && (sk.linkedElement === "wing" || sk.situation === "wing_overload")) {
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
      if (this.hasUserAspect("bus_shield_start1") && sk.situation === "box_danger") {
        s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
      }
      if (this.hasUserAspect("press_tempo_drain") && sk.linkedElement === "press") {
        this.oppTempoDrainTicks[oppTeam] = Math.max(this.oppTempoDrainTicks[oppTeam], 150);
      }
      if (this.hasUserAspect("wing_cd_refund") && sk.linkedElement === "wing") {
        this.reduceEquippedCooldowns(2);
      }
      if (this.hasUserAspect("transition_surge")) {
        s.aspectStacks.shieldCharges = Math.min(this.getShieldCap(), s.aspectStacks.shieldCharges + 1);
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
      if (this.hasUserAspect("absorb_max3_counter") && (sk.situation === "box_danger" || sk.instantAction === "clear_danger")) {
        s.aspectStacks.counterCharges = Math.min(this.getCounterCap(), s.aspectStacks.counterCharges + 1);
      }
    }
    if (this.hasUserAspect("midtrap_energy_steal") && sk.situation === "midfield_press") {
      this.pushCoachReward({ energyRefund: 1, bannerText: "\u3010\u4E94\u76FE\u7EDE\u6740\u3011\u6C72\u53D6 +1 \u6307\u6325\u80FD\u91CF\uFF01", tone: "#F59E0B" });
    }
    if (this.hasUserAspect("wing_switch_discount") && sk.linkedElement === "wing") {
      this.bypassOffsideTicks[team] = Math.max(this.bypassOffsideTicks[team], 45);
      this.pushCoachReward({ nextCardDiscount: 1, bannerText: "\u3010\u53CC\u7FFC\u5F39\u5C04\u3011\u4E0B\u5F20\u624B\u724C -1 \u80FD\u91CF\uFF01", tone: "#38BDF8" });
    }
    if (this.hasUserAspect("press_refund") && sk.linkedElement === "press" && Math.random() < 0.55) {
      this.pushCoachReward({ energyRefund: 1, bannerText: "\u3010\u4E0D\u7184\u538B\u8FEB\u3011\u6280\u5361\u5171\u632F\u8FD4\u8FD8 +1 \u80FD\u91CF\uFF01", tone: "#EF4444" });
    }
    const eff = {
      ...sk.effect,
      passingDelta: sk.effect.passingDelta ? Math.round(sk.effect.passingDelta * mul) : void 0,
      shootingDelta: sk.effect.shootingDelta ? Math.round(sk.effect.shootingDelta * mul) : void 0,
      defendingDelta: sk.effect.defendingDelta ? Math.round(sk.effect.defendingDelta * mul) : void 0,
      paceDelta: sk.effect.paceDelta ? Math.round(sk.effect.paceDelta * mul) : void 0,
      composureDelta: sk.effect.composureDelta ? Math.round(sk.effect.composureDelta * mul) : void 0,
      goalkeepingDelta: sk.effect.goalkeepingDelta ? Math.round(sk.effect.goalkeepingDelta * mul) : void 0,
      fitnessInstantDelta: sk.effect.fitnessInstantDelta ? Math.round(sk.effect.fitnessInstantDelta * mul) : void 0
    };
    this.applyCommandCard(team, eff);
    s.skillUses = s.skillUses ?? {};
    s.skillUses[skillId] = uses + 1;
    s.skillCooldowns = s.skillCooldowns ?? {};
    const isFreeFirstCd = !!sk.firstTriggerFreeCd && uses === 0;
    const effCd = isFreeFirstCd ? 0 : hasAnyCardBuff || isElementOverdrive ? Math.round(sk.cooldownMinutes * 0.75) : sk.cooldownMinutes;
    s.skillCooldowns[skillId] = s.minute + effCd;
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
        startTackles: stTeam.tackles
      };
    }
    const effRank = sk.effectiveRank ?? 1;
    this.pushEvent(
      "commentary",
      team,
      "",
      "",
      s.ball.pos,
      `\u4E3B\u52A8\u6280\u89C9\u9192\u3010${sk.name} R${effRank}\u3011\uFF1A${instantSummary}`,
      void 0,
      "important"
    );
    return {
      ok: true,
      triggered: true,
      boosted: hasAnyCardBuff || isElementOverdrive,
      skillId: sk.id,
      skillName: sk.name,
      vfxTheme: effRank >= 3 ? "ult" : sk.vfxTheme ?? "ult",
      instantSummary,
      effectiveRank: effRank,
      isCardBoosted: hasAnyCardBuff || isElementOverdrive,
      mutationChoice: sk.mutationChoice,
      mutationLabel: sk.mutationLabel,
      instantAction: sk.instantAction,
      styleTag: sk.styleTag
    };
  }
  dismissActiveSkillPrompt() {
    this.state.activeSkillPrompt = null;
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
    if (this.userTeamSide && player.team !== this.userTeamSide && this.state.aspectStacks) {
      this.state.aspectStacks.passSeq = 0;
    }
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
    if (this.isKickoffFirst) {
      this.isKickoffFirst = false;
      const kc = this.commentary.formatKickoff(this.state.minute);
      this.pushEvent("kickoff", team, kicker.id, kicker.name, kicker.pos, kc.text, void 0, kc.level);
    }
  }
  startSecondHalf() {
    this.state.phase = "second_half";
    this.state.homeAttackDir = -1;
    for (const p of this.state.players) {
      if (!p.redCard) p.fitness = Math.min(100, p.fitness + 6);
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
      for (const p of this.state.players) {
        if (p.redCard || p.id === taker?.id) continue;
        if (p.team !== team) {
          const oppRelX = toRelativeX(p.pos.x, dir);
          if (oppRelX < 22) {
            p.pos.x = toAbsoluteX(24, dir);
          }
        } else if (p.role === "CB" || p.role === "LB" || p.role === "RB") {
          p.pos.x = toAbsoluteX(19, dir);
        }
      }
    } else if (b.restartType === "penalty") {
      const penSpotX = dir === 1 ? PITCH.LENGTH - PITCH.PENALTY_SPOT : PITCH.PENALTY_SPOT;
      taker = this.state.players.filter((p) => p.team === team && !p.redCard && p.role !== "GK").sort((a, b2) => b2.attributes.shooting - a.attributes.shooting)[0];
      if (taker) {
        taker.pos = { x: penSpotX, y: PITCH.GOAL_Y };
        this.executeShot(taker, 0.76);
        return;
      }
    } else {
      const restartRelX = toRelativeX(b.restartPos.x, dir);
      if (b.restartType === "corner" || b.restartType === "freekick" && restartRelX > 72) {
        const hasSetPieceNuke = this.hasActiveMechanic(team, "set_piece_nuke");
        if (hasSetPieceNuke) {
          this.setPieceBoostTicks = 45;
          this.setPieceBoostTeam = team;
        }
        const cbs = this.state.players.filter((p) => p.team === team && !p.redCard && p.role === "CB").sort((a, b2) => b2.attributes.strength - a.attributes.strength);
        const defStyle = team === "home" ? this.state.homeStyle : this.state.awayStyle;
        const pushCount = hasSetPieceNuke || defStyle === "park_bus" || defStyle === "wing_play" ? 2 : 1;
        for (let ci = 0; ci < Math.min(pushCount, cbs.length); ci++) {
          cbs[ci].pos = {
            x: toAbsoluteX(92 + (ci === 0 ? 1.5 : -1.5), dir),
            y: PITCH.HALF_Y + (ci === 0 ? -3.5 : 4.5)
          };
          cbs[ci].targetPos = { ...cbs[ci].pos };
        }
      }
      taker = this.state.players.filter((p) => p.team === team && !p.redCard && p.role !== "GK" && p.role !== "CB").sort((a, b2) => dist2D(a.pos, b.restartPos) - dist2D(b2.pos, b.restartPos))[0];
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
        const oppTeam = holder.team === "home" ? "away" : "home";
        const defPower = def.attributes.defending * 0.7 + def.attributes.strength * 0.3;
        const frenzyHolderEdge = this.hasActiveMechanic(holder.team, "blood_frenzy") && this.isTrailing(holder.team) ? 4 : 0;
        const attPower = holder.attributes.dribbling * 0.7 + holder.attributes.strength * 0.3 + frenzyHolderEdge;
        const tackleGoldMul = def.goldTraits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? 2 : 1;
        const traitTackleBonus = def.traits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? 0.1 * tackleGoldMul : 0;
        const styleTackleBonus = oppStyle === "gegenpress" ? 0.06 : oppStyle === "park_bus" && toRelativeX(holder.pos.x, this.getAttackDir(holder.team)) >= 68 ? 0.05 : 0;
        const defFatigueTacklePenalty = def.fitness < 65 ? -0.1 : 0;
        const holderStyle = holder.team === "home" ? this.state.homeStyle : this.state.awayStyle;
        const holderForm = holder.team === "home" ? this.state.homeFormation : this.state.awayFormation;
        const holderRelX = toRelativeX(holder.pos.x, this.getAttackDir(holder.team));
        const counterStyleTackleMod = (oppStyle === "gegenpress" && holderStyle === "tiki_taka" && holderRelX < 55 ? 0.08 : 0) + ((oppStyle === "gegenpress" || oppStyle === "wing_play") && (holderStyle === "counter" || holderStyle === "park_bus") && holderRelX < 58 ? -0.1 : 0) + (holderStyle === "balanced" && (oppStyle === "gegenpress" || oppStyle === "tiki_taka") ? 0.03 : 0) + (getDefenseSystem(holderForm) === "5-back" && holderRelX >= 52 ? -0.03 : 0) + (getDefenseSystem(holderForm) === "4-back" && holderRelX < 52 ? -0.03 : 0);
        const immuneHighPress = this.hasImmunity(holder.team, "immuneHighPressTackle");
        const blitzBonus = !immuneHighPress && this.hasActiveMechanic(oppTeam, "high_press_blitz") ? 0.12 : 0;
        const effStyleTackleBonus = immuneHighPress && oppStyle === "gegenpress" ? 0 : styleTackleBonus;
        const traitFoulMul = def.traits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? def.goldTraits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? 0.45 : 0.65 : 1;
        const defEffMods = this.getEffectiveMods(def.team);
        const attEffMods = this.getEffectiveMods(holder.team);
        const tackleWinProb = clamp(0.45 + (defPower - attPower) / 100 * 0.55 + traitTackleBonus + effStyleTackleBonus + defFatigueTacklePenalty + counterStyleTackleMod + blitzBonus, 0.15, 0.92);
        const hRelX = toRelativeX(holder.pos.x, this.getAttackDir(holder.team));
        if (this.state.pendingClutchSetPiece?.[holder.team] && hRelX >= 68) {
          this.state.pendingClutchSetPiece[holder.team] = false;
          this.handleFoul(def, holder);
          return;
        }
        const fkMul = hRelX >= 64 ? attEffMods.freeKickRateMul : 1;
        if (Math.random() < clamp(0.24 * pressMul * traitFoulMul * defEffMods.foulRateMul * fkMul, 0.05, 0.85)) {
          this.handleFoul(def, holder);
          return;
        }
        if (Math.random() < tackleWinProb) {
          def.matchStats.tackles++;
          this.state.stats[def.team].tackles++;
          holder.stunTicks = 5;
          this.giveBallTo(def);
          this.v6PassStreak[holder.team] = 0;
          this.dispatchHook(def.team, "onTackle");
          if (def.traits?.includes("\u7CBE\u51C6\u94F2\u65AD")) {
            this.pushTacticalCallout(def, def.goldTraits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? "\u2605\u7CBE\u51C6\u94F2\u65AD" : "\u7CBE\u51C6\u94F2\u65AD", "trait");
          }
          this.pushEvent("tackle", def.team, def.id, def.name, def.pos, `${def.name} \u5E72\u51C0\u62A2\u65AD ${holder.name}`);
          return;
        } else {
          def.stunTicks = 6;
        }
      }
    }
    if (holder.decisionCooldown > 0) return;
    const style = holder.team === "home" ? this.state.homeStyle : this.state.awayStyle;
    const effMods = this.getEffectiveMods(holder.team);
    const oppModsForPass = this.getEffectiveMods(holder.team === "home" ? "away" : "home");
    const mods = {
      ...effMods,
      throughPassBias: (effMods.throughPassBias ?? 0) + (oppModsForPass.oppThroughPassBonus ?? 0),
      longShotBias: (effMods.longShotBias ?? 0) + (oppModsForPass.oppLongShotBonus ?? 0)
    };
    const dir = this.getAttackDir(holder.team);
    const action = decideOnBall(holder, dir, style, this.state.players, b, mods);
    const effTempo = clamp(TACTICAL_PRESETS[style].tempo * effMods.tempoMul, 0.6, 1.55);
    const interval = Math.max(2, Math.round(SIM_CONFIG.DECISION_INTERVAL / effTempo));
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
    const oppTeamForOffside = passer.team === "home" ? "away" : "home";
    const offsideProb = clamp(0.78 + (this.getEffectiveMods(oppTeamForOffside).offsideTrapBonus ?? 0), 0.65, 0.96);
    if (this.bypassOffsideTicks[passer.team] > 0) {
      this.bypassOffsideTicks[passer.team] = 0;
    } else if (targetIsOffside && Math.random() < offsideProb) {
      const oppTeam = oppTeamForOffside;
      this.state.stats[passer.team].offsides++;
      const oc = this.commentary.formatOffside(passer.team, target.name, this.state.minute);
      this.pushEvent("offside", passer.team, target.id, target.name, target.pos, oc.text, void 0, oc.level);
      if (this.hasActiveMechanic(oppTeam, "offside_trap")) {
        this.pushEvent("commentary", oppTeam, "", "", target.pos, "\u3010\u8D8A\u4F4D\u9677\u9631\u3011\u9020\u8D8A\u4F4D\u6210\u529F\uFF01\u9632\u7EBF\u53CD\u51FB\u63D0\u901F", void 0, "important", "MOMENTUM");
      }
      this.dispatchHook(oppTeam, "onOffsideTrap");
      this.setDeadBall(oppTeam, "freekick", target.pos, 4);
      return;
    }
    const windDrift = this.state.weather === "wind" && (passType === "long" || passType === "cross") ? 1.4 : 0;
    const leadPos = {
      x: clamp(target.pos.x + target.vel.x * 0.35 + (Math.random() - 0.5) * windDrift, 2, PITCH.LENGTH - 2),
      y: clamp(target.pos.y + target.vel.y * 0.35 + (Math.random() - 0.5) * windDrift, 2, PITCH.WIDTH - 2)
    };
    launchPassBall(this.state.ball, passer.pos, leadPos, passer, target, passType);
    if (this.userTeamSide === passer.team && (passType === "long" || passType === "through") && this.hasUserAspect("counter_pass_speed")) {
      this.state.ball.vel.x *= 1.15;
      this.state.ball.vel.y *= 1.15;
    }
  }
  executeShot(shooter, xG, forceOnTarget = false) {
    const dir = this.getAttackDir(shooter.team);
    const goalX = dir === 1 ? PITCH.LENGTH : 0;
    const dist = dist2D(shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
    if (this.userTeamSide === shooter.team && this.state.aspectStacks && this.state.aspectStacks.counterCharges > 0) {
      const stacks = this.state.aspectStacks.counterCharges;
      this.state.aspectStacks.counterCharges = 0;
      xG = Math.min(0.75, xG + stacks * 0.1);
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
    const hasLongShotCannon = dist >= 18 && this.hasActiveMechanic(shooter.team, "long_shot_cannon");
    if (hasLongShotCannon) {
      xG = Math.min(0.68, xG * 1.3);
    }
    if (dist >= 20 && shooter.traits?.includes("\u4E16\u754C\u6CE2\u730E\u624B")) {
      xG = Math.min(0.72, xG * 1.15);
      this.pushTacticalCallout(shooter, "\u2605\u4E16\u754C\u6CE2\u730E\u624B", "trait");
    } else if (dist >= 18 && shooter.traits?.includes("\u8FDC\u5C04\u91CD\u70AE")) {
      this.pushTacticalCallout(shooter, shooter.goldTraits?.includes("\u8FDC\u5C04\u91CD\u70AE") ? "\u2605\u8FDC\u5C04\u91CD\u70AE" : "\u8FDC\u5C04\u91CD\u70AE", "trait");
    } else if (dist < 16.5 && shooter.traits?.includes("\u7981\u533A\u72D0\u72F8")) {
      this.pushTacticalCallout(shooter, shooter.goldTraits?.includes("\u7981\u533A\u72D0\u72F8") ? "\u2605\u7981\u533A\u72D0\u72F8" : "\u7981\u533A\u72D0\u72F8", "trait");
    }
    if (this.userTeamSide === shooter.team && this.userScoutCounterLabel && this.state.minute - this.lastScoutCalloutMin >= 12) {
      this.lastScoutCalloutMin = this.state.minute;
      this.pushTacticalCallout(shooter, this.userScoutCounterLabel, "scout");
    }
    const hasBloodFrenzy = this.hasActiveMechanic(shooter.team, "blood_frenzy") && this.isTrailing(shooter.team);
    if (hasBloodFrenzy) {
      xG = Math.min(0.68, xG * 1.1);
    }
    const myStyleShot = shooter.team === "home" ? this.state.homeStyle : this.state.awayStyle;
    const myFormShot = shooter.team === "home" ? this.state.homeFormation : this.state.awayFormation;
    const oppStyleShot = shooter.team === "home" ? this.state.awayStyle : this.state.homeStyle;
    const oppFormShot = shooter.team === "home" ? this.state.awayFormation : this.state.homeFormation;
    const oppIs5Back = getDefenseSystem(oppFormShot) === "5-back";
    if ((myStyleShot === "counter" || myStyleShot === "park_bus") && (oppStyleShot === "gegenpress" || oppStyleShot === "wing_play")) {
      xG = Math.min(0.68, xG + (myStyleShot === "counter" ? 0.08 : 0.05));
      this.pushTacticalCallout(shooter, "\u6218\u672F\u514B\u5236 +xG", "tactic");
    } else if (myStyleShot === "park_bus" && oppStyleShot !== "park_bus") {
      xG = Math.min(0.68, xG + 0.03);
    } else if (myStyleShot === "counter" && oppStyleShot !== "park_bus") {
      xG = Math.min(0.68, xG + 0.02);
    } else if (oppStyleShot === "gegenpress" && dist >= 18 && dist < 24) {
      xG = Math.min(0.68, xG + 0.02);
    } else if (myStyleShot === "tiki_taka" && oppStyleShot === "park_bus") {
      xG = Math.min(0.68, xG + 0.04);
      this.pushTacticalCallout(shooter, "\u4F20\u63A7\u7834\u94C1\u6876", "tactic");
    }
    if (getDefenseSystem(myFormShot) === "5-back" && toRelativeX(shooter.pos.x, dir) > 50) {
      xG = Math.min(0.68, xG + (myFormShot === "5-4-1" ? 0.02 : 0.01));
    }
    if (getDefenseSystem(myFormShot) === "4-back" && toRelativeX(shooter.pos.x, dir) > 70) {
      xG = Math.min(0.68, xG + 0.02);
    }
    shooter.hasBall = false;
    shooter.matchStats.shots++;
    this.state.stats[shooter.team].shots++;
    this.state.stats[shooter.team].xG += xG;
    const fatiguePenalty = shooter.fitness < 62 ? (62 - shooter.fitness) / 38 * 0.11 : 0;
    const strainPenalty = shooter.strainWarning ? 0.04 : 0;
    const antiAttackShotPenalty = (oppIs5Back && (myStyleShot === "wing_play" || getDefenseSystem(myFormShot) === "3-back") ? 0.08 : 0) + (oppStyleShot === "park_bus" && (myStyleShot === "wing_play" || myStyleShot === "gegenpress") ? 0.07 : 0);
    const rawShoot = Math.min(99, shooter.attributes.shooting + (hasBloodFrenzy ? 8 : 0));
    const effectiveShoot = rawShoot > 80 ? 80 + (rawShoot - 80) * 1.35 : rawShoot;
    const longDistPenalty = dist >= 22 && !hasLongShotCannon ? (dist - 20) * 0.015 : 0;
    const onTargetProb = clamp(
      0.24 + effectiveShoot / 99 * 0.34 - dist / 32 * 0.16 - longDistPenalty - fatiguePenalty - strainPenalty - antiAttackShotPenalty + (hasLongShotCannon ? 0.14 : 0),
      0.1,
      hasLongShotCannon ? 0.74 : 0.68
    );
    const onTarget = forceOnTarget || Math.random() < onTargetProb;
    if (onTarget) {
      this.state.stats[shooter.team].shotsOnTarget++;
    }
    const targetY = onTarget ? PITCH.GOAL_Y + (Math.random() - 0.5) * (PITCH.GOAL_HALF_WIDTH * 1.8) : PITCH.GOAL_Y + (Math.random() < 0.5 ? -1 : 1) * (PITCH.GOAL_HALF_WIDTH + 1.2 + Math.random() * 3);
    const targetZ = onTarget ? 0.3 + Math.random() * 1.8 : 0.6 + Math.random() * 2.8;
    this.lastShotType = dist >= 20 ? "long_range" : this.state.ball.pos.z > 0.9 ? "header" : "normal";
    const sc = this.commentary.formatShot(shooter.team, shooter.name, xG, this.state.minute);
    this.pushEvent("shot", shooter.team, shooter.id, shooter.name, shooter.pos, sc.text, xG, sc.level);
    this.dispatchHook(shooter.team, "onShot");
    if (sc.momentumText) {
      this.pushEvent("commentary", shooter.team, "", "", shooter.pos, sc.momentumText, void 0, "important", "MOMENTUM");
    }
    launchShotBall(this.state.ball, shooter, dir, xG, onTarget, targetY, targetZ);
  }
  handlePassFlight() {
    const b = this.state.ball;
    if (this.checkOutOfBounds()) return;
    if (b.pos.z < 2.1) {
      for (const p of this.state.players) {
        if (p.team === b.lastTouchTeam || p.redCard || p.stunTicks > 0) continue;
        const defIntMods = this.getEffectiveMods(p.team);
        const d = dist2D(p.pos, b.pos);
        if (d < 2.2 + (defIntMods.interceptRangeBonus ?? 0)) {
          const passTeam = b.lastTouchTeam ?? "home";
          const passStyle = passTeam === "home" ? this.state.homeStyle : this.state.awayStyle;
          const defStyleInt = p.team === "home" ? this.state.homeStyle : this.state.awayStyle;
          const defFormInt = p.team === "home" ? this.state.homeFormation : this.state.awayFormation;
          const defIs5Back = getDefenseSystem(defFormInt) === "5-back";
          let interceptMod = defIntMods.interceptProbBonus ?? 0;
          if (defStyleInt === "gegenpress" && (b.passType === "through" || b.passType === "long")) {
            interceptMod -= passStyle === "counter" || passStyle === "park_bus" ? 0.1 : 0.03;
          }
          if ((defIs5Back || defStyleInt === "park_bus") && b.passType === "cross") {
            interceptMod += 0.14;
          }
          if ((defIs5Back || defStyleInt === "park_bus") && passStyle === "counter" && b.passType === "through") {
            interceptMod += 0.05;
          }
          if (passStyle === "counter" && (b.passType === "through" || b.passType === "long")) {
            interceptMod -= 0.05;
          }
          const passerObj = b.lastPasserId ? this.state.players.find((pl) => pl.id === b.lastPasserId) : null;
          const passerPass = passerObj ? passerObj.attributes.passing : 65;
          const isLoftedPass = b.passType === "cross" || b.passType === "long";
          const passerResist = (passerPass - 60) / 100 * 0.28 + (passerObj?.traits?.includes("\u8282\u62CD\u5668") ? passerObj.goldTraits?.includes("\u8282\u62CD\u5668") ? 0.08 : 0.05 : 0) + (isLoftedPass && passerObj?.traits?.includes("\u7CBE\u51C6\u957F\u4F20") ? passerObj.goldTraits?.includes("\u7CBE\u51C6\u957F\u4F20") ? 0.1 : 0.06 : 0);
          const oppTempoPenalty = this.oppTempoDrainTicks[passTeam] > 0 ? 0.08 : 0;
          const interceptChance = clamp(0.5 + (p.attributes.defending - 60) / 100 * 0.28 - passerResist + interceptMod + oppTempoPenalty, 0.24, 0.88);
          if (Math.random() < interceptChance) {
            p.matchStats.interceptions++;
            this.state.stats[p.team].interceptions++;
            this.v6PassStreak[passTeam] = 0;
            this.giveBallTo(p);
            this.dispatchHook(p.team, "onIntercept");
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
        const pk = passer.id < target.id ? `${passer.id}|${target.id}` : `${target.id}|${passer.id}`;
        this.state.pairPasses = this.state.pairPasses ?? {};
        this.state.pairPasses[pk] = (this.state.pairPasses[pk] ?? 0) + 1;
        if (passer.traits?.includes("\u8282\u62CD\u5668") && Math.random() < 0.22) {
          this.pushTacticalCallout(passer, passer.goldTraits?.includes("\u8282\u62CD\u5668") ? "\u2605\u8282\u62CD\u5668" : "\u8282\u62CD\u5668", "trait");
        }
        const effChem = Math.max(0, this.userChemAvg + this.getEffectiveChemDelta(passer.team));
        const chemProb = Math.min(0.45, 0.08 + effChem * 35e-4);
        if (this.userTeamSide === passer.team && effChem >= 15 && Math.random() < chemProb) {
          this.pushTacticalCallout(passer, "\u9ED8\u5951\u8FDE\u7EBF", "chemistry");
        }
        if (this.userTeamSide === passer.team && this.state.aspectStacks) {
          const ast = this.state.aspectStacks;
          ast.passSeq++;
          if (ast.passSeq >= 4 && this.hasUserAspect("pass4_cd_cut")) {
            ast.passSeq = 0;
            this.reduceEquippedCooldowns(1);
          } else if (ast.passSeq >= 5 && this.hasUserAspect("pass5_card_discount")) {
            ast.passSeq = 0;
            this.pushCoachReward({ nextCardDiscount: 1, bannerText: "\u3010\u4F20\u63A7\u67A2\u7EBD\u30115\u8FDE\u4F20\u5BFC\uFF0C\u4E0B\u5F20\u6307\u6325\u5361 -1 \u80FD\u91CF\uFF01", tone: "#38BDF8" });
          } else if (ast.passSeq >= 5 && this.hasUserAspect("pass5_cd_cut2")) {
            ast.passSeq = 0;
            this.reduceEquippedCooldowns(2);
          } else if (ast.passSeq >= 5 && this.hasUserAspect("deep_buildup_refresh") && !this.aspectRefreshUsedThisMatch) {
            ast.passSeq = 0;
            this.aspectRefreshUsedThisMatch = true;
            this.pushCoachReward({ refreshUsedCard: true, bannerText: "\u3010\u51FA\u7403\u5927\u5E08\u30115\u8FDE\u7A33\u5065\u4F20\u5BFC\uFF0C\u5237\u65B0 1 \u5F20\u5DF2\u7528\u624B\u724C\uFF01", tone: "#2DD4BF" });
          }
        }
        const pepHeal = this.state.activeBuffs.filter((bf) => bf.team === passer.team && (bf.effect.affix?.passHealEvery6 ?? 0) > 0).reduce((s2, bf) => s2 + (bf.effect.affix?.passHealEvery6 ?? 0), 0);
        if (this.hasActiveMechanic(passer.team, "tiki_taka_flow") || pepHeal > 0) {
          this.tikiTakaPassCount[passer.team]++;
          if (this.tikiTakaPassCount[passer.team] >= 6) {
            this.tikiTakaPassCount[passer.team] = 0;
            const healAmt = (this.hasActiveMechanic(passer.team, "tiki_taka_flow") ? 2 : 0) + pepHeal;
            for (const tm of this.state.players) {
              if (tm.team === passer.team && !tm.redCard) {
                tm.fitness = Math.min(100, tm.fitness + healAmt);
              }
            }
          }
        }
        if (passer.role === "GK" && this.hasActiveMechanic(passer.team, "gk_counter_launch")) {
          this.gkCounterBoostTicks[passer.team] = 50;
        }
        this.v6PassStreak[passer.team] = (this.v6PassStreak[passer.team] ?? 0) + 1;
        this.dispatchHook(passer.team, "onPassStreak", { passStreak: this.v6PassStreak[passer.team] });
        if (b.passType === "cross") {
          this.dispatchHook(passer.team, "onCross");
        }
      }
      this.giveBallTo(target);
      const tStyle = target.team === "home" ? this.state.homeStyle : this.state.awayStyle;
      const tMods = target.team === "home" ? this.homeMods : this.awayMods;
      const baseCrossFinish = tStyle === "wing_play" || (tMods.crossBias ?? 0) > 0.03 ? 0.52 : 0.49;
      const defFormCross = target.team === "home" ? this.state.awayFormation : this.state.homeFormation;
      const defStyleCross = target.team === "home" ? this.state.awayStyle : this.state.homeStyle;
      const antiCrossPenalty = (getDefenseSystem(defFormCross) === "5-back" ? 0.22 : 0) + (defStyleCross === "park_bus" ? 0.16 : 0);
      const crossFinishProb = clamp(
        baseCrossFinish + (this.hasActiveMechanic(target.team, "wing_overload") ? 0.2 : 0) - antiCrossPenalty,
        0.18,
        0.92
      );
      if (b.passType === "cross" && target.role !== "GK" && Math.random() < crossFinishProb) {
        const dir = this.getAttackDir(target.team);
        const relX = toRelativeX(target.pos.x, dir);
        if (relX > 80) {
          this.executeShot(target, 0.17);
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
    const defStyle = defTeam === "home" ? this.state.homeStyle : this.state.awayStyle;
    const defForm = defTeam === "home" ? this.state.homeFormation : this.state.awayFormation;
    const isFiveBack = getDefenseSystem(defForm) === "5-back";
    const hasIronWall = this.hasActiveMechanic(defTeam, "iron_wall_block");
    const defShotMods = this.getEffectiveMods(defTeam);
    const shootEffMods = this.getEffectiveMods(shootTeam);
    const shootForm = shootTeam === "home" ? this.state.homeFormation : this.state.awayFormation;
    const shootStyle = shootTeam === "home" ? this.state.homeStyle : this.state.awayStyle;
    const fiveVsCounterTarget = isFiveBack && (getDefenseSystem(shootForm) === "3-back" || shootStyle === "wing_play") ? 0.1 : 0;
    const busVsCounterTarget = defStyle === "park_bus" && (shootStyle === "wing_play" || shootStyle === "gegenpress") ? 0.09 : 0;
    const blockDist = (defStyle === "park_bus" || isFiveBack ? 1.36 : 1.08) + (hasIronWall ? 0.25 : 0);
    const blockProb = clamp((defStyle === "park_bus" || isFiveBack ? 0.22 : 0.18) + fiveVsCounterTarget + busVsCounterTarget + (hasIronWall ? 0.16 : 0) + defShotMods.blockBonus, 0.05, 0.78);
    const skipPrologueBlock = this.prologueScriptedMode && shootTeam === this.userTeamSide && (this.prologueSkillTriggered || this.prologueGuaranteedGoal);
    if (b.pos.z < 1.9 && !skipPrologueBlock) {
      for (const p of this.state.players) {
        if (p.team !== defTeam || p.redCard || p.role === "GK") continue;
        if (dist2D(p.pos, b.pos) < blockDist && Math.random() < blockProb) {
          b.vel.x = -b.vel.x * 0.35 + (Math.random() - 0.5) * 4;
          b.vel.y = (Math.random() - 0.5) * 8;
          b.mode = "loose";
          b.lastTouchTeam = defTeam;
          this.dispatchHook(defTeam, "onBlock");
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
      const mc = this.commentary.formatMiss(shootTeam, shooter?.name || "\u524D\u950B", this.state.minute);
      this.pushEvent("miss", shootTeam, shooter?.id || "", shooter?.name || "", b.pos, mc.text, void 0, mc.level);
      if (Math.random() < clamp(0.3 * shootEffMods.cornerRateMul, 0.1, 0.85)) {
        this.state.stats[shootTeam].corners++;
        const cornerX = crossedLeft ? 1 : PITCH.LENGTH - 1;
        const cornerY = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        const cc = this.commentary.formatCorner(shootTeam, this.state.minute);
        this.pushEvent("corner", shootTeam, "", "", { x: cornerX, y: cornerY }, cc.text, void 0, cc.level);
        this.setDeadBall(shootTeam, "corner", { x: cornerX, y: cornerY }, 5);
      } else {
        this.setDeadBall(defTeam, "goalkick", { x: crossedLeft ? 5.5 : PITCH.LENGTH - 5.5, y: PITCH.GOAL_Y }, 5);
      }
      return;
    }
    const gk = this.state.players.find((p) => p.team === defTeam && p.role === "GK");
    const rawGk = gk ? gk.attributes.goalkeeping : 65;
    const gkAttr = rawGk > 80 ? 80 + (rawGk - 80) * 1.15 : rawGk;
    const frenzyShootBonus = shooter && this.hasActiveMechanic(shooter.team, "blood_frenzy") && this.isTrailing(shooter.team) ? 8 : 0;
    const rawShooterShoot = shooter ? Math.min(99, shooter.attributes.shooting + frenzyShootBonus) : 70;
    const rawShooterComp = shooter ? shooter.attributes.composure : 70;
    const baseShooterAttr = rawShooterShoot * 0.65 + rawShooterComp * 0.35;
    const shooterAttr = baseShooterAttr > 80 ? 80 + (baseShooterAttr - 80) * 1.15 : baseShooterAttr;
    const gkGoldMul = gk?.goldTraits?.includes("\u95E8\u7EBF\u795E\u6251") ? 2 : 1;
    const gkTraitBonus = gk?.traits?.includes("\u95E8\u7EBF\u795E\u6251") ? 0.045 * gkGoldMul : 0;
    const gkGodBonus = gk?.traits?.includes("\u95E8\u7EBF\u6218\u795E") ? 0.04 : 0;
    const gkSaveBonus = (rawGk - 65) / 100 * 0.16 + gkTraitBonus + gkGodBonus;
    const attrDiffBonus = (shooterAttr - gkAttr) / 100 * 0.28;
    const strainGoalPenalty = shooter?.strainWarning ? 0.04 : 0;
    const cardXgDefensePenalty = defShotMods.oppShotXgPenalty * 0.45;
    let goalProb = clamp(0.33 + b.shotXG * 0.88 + attrDiffBonus - gkSaveBonus - strainGoalPenalty - cardXgDefensePenalty, 0.12, 0.76);
    if (this.prologueScriptedMode) {
      if (shootTeam === this.userTeamSide && (this.prologueSkillTriggered || this.prologueGuaranteedGoal)) goalProb = 1;
      else if (shootTeam === "away" && this.prologueAllowAwayGoal) goalProb = 1;
      else goalProb = 0;
    }
    if (Math.random() < goalProb) {
      if (this.userTeamSide === defTeam && this.state.aspectStacks && this.state.aspectStacks.shieldCharges > 0) {
        this.state.aspectStacks.shieldCharges--;
        if (gk) gk.matchStats.saves++;
        this.state.stats[defTeam].saves++;
        this.pushEvent("save", defTeam, gk?.id || "", gk?.name || "\u95E8\u5C06", b.pos, `\u3010\u4F20\u5947\u62A4\u76FE\u3011${gk?.name || "\u540E\u536B\u4E0E\u95E8\u5C06"} \u95E8\u7EBF\u6781\u9650\u5316\u89E3\u5FC5\u8FDB\u7403\uFF01`, void 0, "important");
        if (this.hasUserAspect("clear_counter_stack")) {
          this.state.aspectStacks.counterCharges = Math.min(this.getCounterCap(), this.state.aspectStacks.counterCharges + 1);
        }
        if (gk) this.giveBallTo(gk);
        else {
          b.mode = "loose";
          b.lastTouchTeam = defTeam;
        }
        return;
      }
      if (shooter) shooter.matchStats.goals++;
      this.state.stats[shootTeam].goals++;
      if (shootTeam === "home") {
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
            this.pushEvent("commentary", "away", "", "", b.pos, "\u30101:2 \u906D\u53CD\u8D85\u3011\u94C1\u5E55\u8054\u6293\u4F4F\u4E86\u538B\u4E0A\u540E\u7684\u7A7A\u5F53\u53CD\u51FB\u5F97\u624B\uFF01\u4E0D\u8981\u614C\uFF0C\u7A33\u4F4F\u8282\u594F\uFF01", void 0, "important");
          } else if (this.state.awayScore >= 3) {
            this.pushEvent("commentary", "away", "", "", b.pos, "\u30101:3 \u9677\u5165\u7EDD\u5883\u3011\u5E74\u8F7B\u9632\u7EBF\u8FDE\u7EED\u4E22\u7403\uFF01\u53EA\u5269\u4E8C\u5341\u591A\u5206\u949F\uFF0C\u5FC5\u987B\u80CC\u6C34\u4E00\u6218\u4E86\uFF01", void 0, "important");
          }
        }
      }
      let assisterName;
      if (b.lastPasserId && shooter && b.lastPasserId !== shooter.id && this.state.tick - this.lastPassTimestamp <= 60) {
        const assister = this.state.players.find((p) => p.id === b.lastPasserId && p.team === shootTeam);
        if (assister) {
          assister.matchStats.assists++;
          assisterName = assister.name;
          const ak = assister.id < shooter.id ? `${assister.id}|${shooter.id}` : `${shooter.id}|${assister.id}`;
          this.state.pairAssists = this.state.pairAssists ?? {};
          this.state.pairAssists[ak] = (this.state.pairAssists[ak] ?? 0) + 1;
          if (assister.matchStats.assists >= 2) {
            this.tryRevealHiddenTrait(assister, "\u52A9\u653B\u5927\u5E08");
          }
        }
      }
      const gc = this.commentary.formatGoal({
        minute: this.state.minute,
        team: shootTeam,
        player: shooter?.name || "\u524D\u950B",
        assist: assisterName,
        homeScore: this.state.homeScore,
        awayScore: this.state.awayScore,
        shotType: this.lastShotType
      });
      this.pushEvent("goal", shootTeam, shooter?.id || "", shooter?.name || "", b.pos, gc.text, b.shotXG, gc.level, gc.narrativeTag);
      if (shooter) {
        const trailingBefore = shootTeam === "home" && this.state.homeScore - 1 < this.state.awayScore || shootTeam === "away" && this.state.awayScore - 1 < this.state.homeScore;
        if (trailingBefore) this.tryRevealHiddenTrait(shooter, "\u9006\u8F6C\u738B");
        if (shooter.subbedIn) this.tryRevealHiddenTrait(shooter, "\u8D85\u7EA7\u66FF\u8865");
        if (this.state.minute >= 70) this.tryRevealHiddenTrait(shooter, "\u5927\u8D5B\u5148\u751F");
        if (this.state.minute <= 25 && this.state.homeScore + this.state.awayScore === 1) {
          this.tryRevealHiddenTrait(shooter, "\u95EA\u7535\u9996\u5F00");
        }
        if (this.lastShotType === "long_range") {
          this.tryRevealHiddenTrait(shooter, "\u4E16\u754C\u6CE2\u730E\u624B");
        }
        if (this.lastShotType === "header") {
          this.tryRevealHiddenTrait(shooter, "\u9AD8\u7A7A\u9738\u4E3B");
        }
      }
      if (this.prologueScriptedMode && shootTeam === this.userTeamSide) {
        this.prologueGuaranteedGoal = false;
        this.prologueSkillTriggered = false;
      }
      const concedeTeam = shootTeam === "home" ? "away" : "home";
      if (this.state.lastConcededMin) this.state.lastConcededMin[concedeTeam] = this.state.minute;
      this.dispatchHook(concedeTeam, "onConcede");
      this.setupKickoff(concedeTeam);
    } else {
      if (gk) {
        gk.matchStats.saves++;
        if (gk.matchStats.saves >= 3) {
          this.tryRevealHiddenTrait(gk, "\u95E8\u7EBF\u6218\u795E");
        }
      }
      this.state.stats[defTeam].saves++;
      if (this.state.lastSaveMin) this.state.lastSaveMin[defTeam] = this.state.minute;
      this.dispatchHook(defTeam, "onSave");
      this.v6ForcedCornerProb[shootTeam] = 0;
      if (this.lastShotType === "long_range") {
        this.dispatchHook(shootTeam, "onLongShotSaved");
      }
      const svc = this.commentary.formatSave(defTeam, gk?.name || "\u95E8\u5C06", shooter?.name || "\u524D\u950B", this.state.minute);
      this.pushEvent("save", defTeam, gk?.id || "", gk?.name || "\u95E8\u5C06", b.pos, svc.text, void 0, svc.level);
      const baseCornerProb = clamp((this.state.weather === "rain" ? 0.38 : 0.28) * shootEffMods.cornerRateMul, 0.12, 0.85);
      const cornerProb = Math.max(baseCornerProb, this.v6ForcedCornerProb[shootTeam] ?? 0);
      if (Math.random() < cornerProb) {
        this.state.stats[shootTeam].corners++;
        this.dispatchHook(shootTeam, "onCorner");
        const cornerX = crossedLeft ? 1 : PITCH.LENGTH - 1;
        const cornerY = b.pos.y < PITCH.HALF_Y ? 1 : PITCH.WIDTH - 1;
        const cc = this.commentary.formatCorner(shootTeam, this.state.minute);
        this.pushEvent("corner", shootTeam, "", "", { x: cornerX, y: cornerY }, cc.text, void 0, cc.level);
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
        this.dispatchHook(attackingAtEnd, "onCorner");
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
    const fc = this.commentary.formatFoul(fouler.team, fouler.name, victim.name, this.state.minute);
    this.pushEvent("foul", fouler.team, fouler.id, fouler.name, victim.pos, fc.text, void 0, fc.level);
    if (Math.random() < 0.22) {
      if (fouler.yellowCards >= 1 && !this.v6PreventPenRedUsed[fouler.team] && this.hasImmunity(fouler.team, "preventPenaltyOrRedOnce")) {
        this.v6PreventPenRedUsed[fouler.team] = true;
        this.pushEvent("commentary", fouler.team, fouler.id, fouler.name, fouler.pos, `\u3010\u94A2\u94C1\u7EAA\u5F8B\u3011${fouler.name} \u51B7\u9759\u6536\u811A\u9003\u8FC7\u7B2C\u4E8C\u5F20\u9EC4\u724C\uFF01`, void 0, "important");
      } else {
        fouler.yellowCards++;
        this.state.stats[fouler.team].yellowCards++;
        const yc = this.commentary.formatYellow(fouler.team, fouler.name, this.state.minute);
        this.pushEvent("yellow_card", fouler.team, fouler.id, fouler.name, fouler.pos, yc.text, void 0, yc.level);
        if (fouler.yellowCards >= 2) {
          fouler.redCard = true;
          this.state.stats[fouler.team].redCards++;
          const rc = this.commentary.formatRed(fouler.team, fouler.name, true, this.state.minute);
          this.pushEvent("red_card", fouler.team, fouler.id, fouler.name, fouler.pos, rc.text, void 0, rc.level);
        }
      }
    }
    const victimDir = this.getAttackDir(victim.team);
    const victimRelX = toRelativeX(victim.pos.x, victimDir);
    const inPenaltyBox = victimRelX >= PITCH.LENGTH - PITCH.PENALTY_BOX_DEPTH && Math.abs(victim.pos.y - PITCH.GOAL_Y) <= PITCH.PENALTY_BOX_HALF_W;
    if (inPenaltyBox) {
      if (!this.v6PreventPenRedUsed[fouler.team] && this.hasImmunity(fouler.team, "preventPenaltyOrRedOnce")) {
        this.v6PreventPenRedUsed[fouler.team] = true;
        this.pushEvent("commentary", fouler.team, fouler.id, fouler.name, victim.pos, `\u3010\u94A2\u94C1\u7EAA\u5F8B\u3011VAR \u4ECB\u5165\uFF01\u72AF\u89C4\u53D1\u751F\u5728\u7981\u533A\u7EBF\u5916\uFF0C\u5316\u9669\u4E3A\u5937\u6539\u5224\u4EFB\u610F\u7403\uFF01`, void 0, "important");
        const outX = victimDir === 1 ? PITCH.LENGTH - PITCH.PENALTY_BOX_DEPTH - 1.5 : PITCH.PENALTY_BOX_DEPTH + 1.5;
        this.setDeadBall(victim.team, "freekick", { x: outX, y: victim.pos.y }, 5);
      } else {
        this.pushEvent("commentary", victim.team, victim.id, victim.name, victim.pos, `\u3010\u70B9\u7403\u5224\u7F5A\u3011\u7981\u533A\u5185\u653E\u5012 ${victim.name}\uFF0C\u4E3B\u88C1\u5224\u679C\u65AD\u6307\u5411\u70B9\u7403\u70B9\uFF01`, void 0, "important");
        this.setDeadBall(victim.team, "penalty", victim.pos, 6);
      }
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
  tryRevealHiddenTrait(player, expectedTrait) {
    if (player.hiddenTrait !== expectedTrait) return;
    player.hiddenTrait = void 0;
    if (!player.traits.includes(expectedTrait)) {
      player.traits.push(expectedTrait);
    }
    this.state.unlockedHiddenTraits.push({
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      trait: expectedTrait
    });
    this.pushEvent(
      "commentary",
      player.team,
      player.id,
      player.name,
      player.pos,
      `\u3010\u9690\u85CF\u7279\u8D28\u89C9\u9192\u3011${player.name} \u89E6\u53D1\u89E3\u9501\u3010${expectedTrait}\u3011\uFF01`,
      void 0,
      "important"
    );
  }
  expireCommandBuffs() {
    const s = this.state;
    const clampAttr = (v) => Math.max(25, Math.min(99, v));
    for (let i = s.activeBuffs.length - 1; i >= 0; i--) {
      const b = s.activeBuffs[i];
      if (s.minute >= b.endMinute) {
        const c = b.effect;
        const targetLine = c.targetLine ?? "ALL";
        for (const p of s.players) {
          if (p.team !== b.team || p.redCard) continue;
          const matchLine = targetLine === "ALL" || this.getPlayerLine(p.role) === targetLine;
          if (matchLine) {
            if (c.passingDelta) p.attributes.passing = clampAttr(p.attributes.passing - c.passingDelta);
            if (c.shootingDelta) p.attributes.shooting = clampAttr(p.attributes.shooting - c.shootingDelta);
            if (c.defendingDelta) p.attributes.defending = clampAttr(p.attributes.defending - c.defendingDelta);
            if (c.paceDelta) p.attributes.pace = clampAttr(p.attributes.pace - c.paceDelta);
            if (c.composureDelta) p.attributes.composure = clampAttr(p.attributes.composure - c.composureDelta);
            if (c.goalkeepingDelta && p.role === "GK") {
              p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping - c.goalkeepingDelta);
            }
          }
          if (c.penaltyAllDefDelta) {
            p.attributes.defending = clampAttr(p.attributes.defending - c.penaltyAllDefDelta);
          }
          if (c.affix?.allPacePenalty) {
            p.attributes.pace = clampAttr(p.attributes.pace - c.affix.allPacePenalty);
          }
          if (c.affix?.defPacePenalty && this.getPlayerLine(p.role) === "DEF") {
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
        if (b.team === this.userTeamSide && b.startStats && !c.id.startsWith("sk_")) {
          const curSt = s.stats[b.team];
          const dShots = curSt.shots - b.startStats.shots;
          const dXG = Math.max(0, curSt.xG - b.startStats.xG);
          const dGoals = curSt.goals - b.startStats.goals;
          const dTackles = curSt.tackles - b.startStats.tackles;
          const msg = dGoals > 0 ? `\u3010${b.name}\u3011\u6218\u679C\u56DE\u6267\uFF1A\u5236\u9020 ${dShots} \u5C04\u95E8 (+${dXG.toFixed(2)} xG) \u5E76\u8F70\u5165 ${dGoals} \u7403\uFF01` : dShots > 0 ? `\u3010${b.name}\u3011\u6218\u679C\u56DE\u6267\uFF1A\u521B\u9020 ${dShots} \u6B21\u5C04\u95E8 (+${dXG.toFixed(2)} xG)` : dTackles > 0 ? `\u3010${b.name}\u3011\u6218\u679C\u56DE\u6267\uFF1A\u9632\u7EBF\u8D21\u732E ${dTackles} \u6B21\u5173\u952E\u62A2\u65AD` : `\u3010${b.name}\u3011\u7ED3\u675F\uFF1A\u5BF9\u624B\u9632\u5B88\u5BC6\u96C6\uFF0C\u672C\u6CE2\u6682\u672A\u6362\u6765\u5C04\u95E8\uFF08\u53EF\u5207\u8FB9\u8DEF/\u8FDC\u5C04\u5361\uFF09`;
          this.pushCoachReward({ bannerText: msg, tone: dGoals > 0 ? "#4ADE80" : dShots > 0 ? "#FACC15" : "#94A3B8" });
          this.pushEvent("commentary", b.team, "", "", { x: PITCH.HALF_X, y: PITCH.HALF_Y }, msg, void 0, dShots > 0 || dGoals > 0 ? "important" : "normal");
        }
        const curConcededEnd = b.team === "home" ? s.awayScore : s.homeScore;
        const zeroConceded = b.startConceded !== void 0 && curConcededEnd === b.startConceded;
        s.activeBuffs.splice(i, 1);
        if (!c.id.startsWith("sk_") && !c.id.startsWith("v6_mini_")) {
          this.dispatchHook(b.team, "onDirectiveEnd", { zeroConceded, expiringBuff: b });
        }
      }
    }
  }
  drainFitness() {
    const ROLE_WORKLOAD = {
      GK: 0.1,
      CB: 0.36,
      ST: 0.44,
      CDM: 0.48,
      CAM: 0.48,
      LB: 0.5,
      RB: 0.5,
      CM: 0.54,
      LW: 0.54,
      RW: 0.54,
      LM: 0.54,
      RM: 0.54,
      LWB: 0.6,
      RWB: 0.6
    };
    for (const p of this.state.players) {
      if (p.redCard) continue;
      const style = p.team === "home" ? this.state.homeStyle : this.state.awayStyle;
      const formation = p.team === "home" ? this.state.homeFormation : this.state.awayFormation;
      const defSys = getDefenseSystem(formation);
      const mods = this.getEffectiveMods(p.team);
      const drainMul = clamp(mods.staminaDrainMul ?? 1, 0.65, 1.45);
      const rawPress = TACTICAL_PRESETS[style].pressIntensity;
      const styleDrain = style === "gegenpress" ? p.role === "CB" ? 1.06 : p.role === "GK" ? 1 : 1.18 : style === "balanced" ? p.role === "GK" ? 1 : 1.04 : p.role === "GK" ? 1 : 0.7 + rawPress * 0.3;
      let formFactor = 1;
      if (defSys === "3-back" && (p.role === "LWB" || p.role === "RWB" || p.role === "CB")) {
        formFactor = 1.1;
      } else if (defSys === "5-back") {
        if (p.role === "CB") formFactor = 0.96;
        else if (p.role === "LWB" || p.role === "RWB") formFactor = 1.08;
      }
      if ((formation === "4-4-2" || formation === "4-2-2-2") && (p.role === "CM" || p.role === "CDM")) {
        formFactor *= 1.08;
      } else if ((formation === "4-2-3-1" || formation === "4-1-4-1" || formation === "3-5-2") && (p.role === "CM" || p.role === "CDM")) {
        formFactor *= 0.94;
      }
      const staminaResist = 1.25 - p.attributes.stamina / 99 * 0.5;
      const lungResist = p.goldTraits?.includes("\u94C1\u80BA\u8986\u76D6") ? 0.4 : p.traits?.includes("\u94C1\u80BA\u8986\u76D6") ? 0.6 : 1;
      let traitResist = lungResist;
      if (p.traits?.includes("\u4F53\u80FD\u5145\u6C9B")) traitResist *= 0.7;
      const roleFactor = ROLE_WORKLOAD[p.role] ?? 0.48;
      const weatherDrain = this.state.weather === "heat" && this.state.minute >= 60 ? 1.25 : 1;
      const strainDrain = p.strainWarning ? 1.28 : 1;
      const oppSide = p.team === "home" ? "away" : "home";
      const oppDrainExtra = this.getEffectiveMods(oppSide).oppStaminaDrainPerMin ?? 0;
      p.fitness = Math.max(
        20,
        p.fitness - roleFactor * styleDrain * formFactor * staminaResist * traitResist * drainMul * weatherDrain * strainDrain - oppDrainExtra
      );
    }
    const totPoss = this.state.stats.home.possessionTicks + this.state.stats.away.possessionTicks || 1;
    const homePossPct = Math.round(this.state.stats.home.possessionTicks / totPoss * 100);
    this.dispatchHook("home", "onPossessionTick", { possessionPct: homePossPct });
    this.dispatchHook("away", "onPossessionTick", { possessionPct: 100 - homePossPct });
  }
  finalizeStats() {
    const topRunners = [...this.state.players].filter((p) => !p.redCard && p.role !== "GK").sort((a, b) => b.matchStats.distanceM - a.matchStats.distanceM).slice(0, 2);
    for (const r of topRunners) {
      this.tryRevealHiddenTrait(r, "\u4F53\u80FD\u5145\u6C9B");
    }
    for (const p of this.state.players) {
      if (p.redCard) continue;
      if (p.matchStats.tackles + p.matchStats.interceptions >= 5) {
        this.tryRevealHiddenTrait(p, "\u7981\u533A\u6E05\u9053\u592B");
      }
      if (p.matchStats.passesSuccess >= 25) {
        this.tryRevealHiddenTrait(p, "\u4F20\u7403\u673A\u5668");
      }
      if (!p.subbedIn && this.state.minute >= 85 && (p.matchStats.tackles + p.matchStats.interceptions >= 2 || p.matchStats.saves >= 2 || p.fitness <= 82)) {
        this.tryRevealHiddenTrait(p, "\u94C1\u8840\u786C\u6C49");
      }
    }
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
      narrativeTag
    });
  }
};

// src/sim-100.ts
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeAttrs(role, baseCA) {
  const jitter = () => randInt(-6, 6);
  const clampA = (v) => Math.max(30, Math.min(99, v));
  const isGK = role === "GK";
  const isDef = ["CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(role);
  const isAtt = ["ST", "LW", "RW", "CAM"].includes(role);
  return {
    passing: clampA(baseCA + (isDef ? -2 : 4) + jitter()),
    shooting: clampA(baseCA + (isAtt ? 8 : isDef ? -15 : -2) + jitter()),
    dribbling: clampA(baseCA + (isAtt ? 6 : isDef ? -8 : 3) + jitter()),
    pace: clampA(baseCA + (["LW", "RW", "LB", "RB"].includes(role) ? 7 : 0) + jitter()),
    strength: clampA(baseCA + (["CB", "ST", "CDM"].includes(role) ? 6 : -3) + jitter()),
    defending: clampA(baseCA + (isDef ? 10 : isAtt ? -25 : -4) + jitter()),
    positioning: clampA(baseCA + jitter()),
    composure: clampA(baseCA + jitter()),
    stamina: clampA(baseCA + 5 + jitter()),
    goalkeeping: clampA(isGK ? baseCA + 8 + jitter() : 25)
  };
}
function makeTeam(name, formation, style, baseCA) {
  const slots = FORMATIONS[formation];
  const players = slots.map((s, idx) => ({
    id: `${name}_${idx}`,
    name: `${name}-${s.role}${idx + 1}`,
    role: s.role,
    shirtNumber: idx + 1,
    attributes: makeAttrs(s.role, baseCA),
    fitness: 100
  }));
  return { name, formation, style, players };
}
var FORMATION_POOL = [
  "4-3-3",
  "4-2-3-1",
  "4-4-2",
  "4-1-2-1-2",
  "4-4-1-1",
  "4-1-4-1",
  "4-2-2-2",
  "4-3-2-1",
  "3-5-2",
  "3-4-3",
  "3-4-2-1",
  "3-4-1-2",
  "5-4-1",
  "5-3-2",
  "5-2-3",
  "5-2-1-2"
];
var STYLE_POOL = ["balanced", "tiki_taka", "gegenpress", "counter", "wing_play", "park_bus"];
function run100() {
  const N = 100;
  const t0 = Date.now();
  let totalGoals = 0;
  let totalHomeShots = 0;
  let totalAwayShots = 0;
  let totalHomeOnTarget = 0;
  let totalAwayOnTarget = 0;
  let totalHomeXG = 0;
  let totalAwayXG = 0;
  let totalPasses = 0;
  let totalPassesSuccess = 0;
  let totalTackles = 0;
  let totalInterceptions = 0;
  let totalFouls = 0;
  let totalYellows = 0;
  let totalCorners = 0;
  let totalOffsides = 0;
  let totalSaves = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let minPoss = 100;
  let maxPoss = 0;
  for (let i = 0; i < N; i++) {
    const f1 = FORMATION_POOL[i % FORMATION_POOL.length];
    const f2 = FORMATION_POOL[(i + 2) % FORMATION_POOL.length];
    const s1 = STYLE_POOL[i % STYLE_POOL.length];
    const s2 = STYLE_POOL[(i + 3) % STYLE_POOL.length];
    const ca1 = randInt(69, 77);
    const ca2 = randInt(68, 76);
    const engine = new MatchEngine(
      makeTeam("Home", f1, s1, ca1),
      makeTeam("Away", f2, s2, ca2)
    );
    const res = engine.simulateMatch();
    const h = res.stats.home;
    const a = res.stats.away;
    totalGoals += h.goals + a.goals;
    totalHomeShots += h.shots;
    totalAwayShots += a.shots;
    totalHomeOnTarget += h.shotsOnTarget;
    totalAwayOnTarget += a.shotsOnTarget;
    totalHomeXG += h.xG;
    totalAwayXG += a.xG;
    totalPasses += h.passes + a.passes;
    totalPassesSuccess += h.passesSuccess + a.passesSuccess;
    totalTackles += h.tackles + a.tackles;
    totalInterceptions += h.interceptions + a.interceptions;
    totalFouls += h.fouls + a.fouls;
    totalYellows += h.yellowCards + a.yellowCards;
    totalCorners += h.corners + a.corners;
    totalOffsides += h.offsides + a.offsides;
    totalSaves += h.saves + a.saves;
    if (h.goals > a.goals) homeWins++;
    else if (h.goals === a.goals) draws++;
    else awayWins++;
    minPoss = Math.min(minPoss, h.possessionPct, a.possessionPct);
    maxPoss = Math.max(maxPoss, h.possessionPct, a.possessionPct);
  }
  const elapsedMs = Date.now() - t0;
  const avgGoals = totalGoals / N;
  const avgTeamShots = (totalHomeShots + totalAwayShots) / (2 * N);
  const avgTeamOnTarget = (totalHomeOnTarget + totalAwayOnTarget) / (2 * N);
  const onTargetPct = (totalHomeOnTarget + totalAwayOnTarget) / Math.max(1, totalHomeShots + totalAwayShots) * 100;
  const avgTeamXG = (totalHomeXG + totalAwayXG) / (2 * N);
  const avgTeamPasses = totalPasses / (2 * N);
  const passAcc = totalPassesSuccess / Math.max(1, totalPasses) * 100;
  console.log("================ 100 \u573A\u6A21\u62DF\u6570\u636E\u6821\u51C6\u62A5\u544A ================");
  console.log(`\u8017\u65F6: ${elapsedMs} ms (${(elapsedMs / N).toFixed(2)} ms/\u573A)`);
  console.log(`\u80DC\u5E73\u8D1F\u5206\u5E03: \u4E3B\u80DC ${homeWins}% | \u5E73 ${draws}% | \u5BA2\u80DC ${awayWins}%`);
  console.log(`\u573A\u5747\u603B\u8FDB\u7403: ${avgGoals.toFixed(2)} \u7403 (\u4E94\u5927\u8054\u8D5B\u53C2\u8003: 2.5 - 2.9)`);
  console.log(`\u5355\u961F\u573A\u5747\u5C04\u95E8: ${avgTeamShots.toFixed(1)} \u6B21 | \u5C04\u6B63: ${avgTeamOnTarget.toFixed(1)} \u6B21 (\u5C04\u6B63\u7387 ${onTargetPct.toFixed(1)}%, \u53C2\u8003: 32%-38%)`);
  console.log(`\u5355\u961F\u573A\u5747 xG: ${avgTeamXG.toFixed(2)} (\u53C2\u8003: 1.1 - 1.7)`);
  console.log(`\u5355\u961F\u573A\u5747\u4F20\u7403: ${avgTeamPasses.toFixed(0)} \u6B21 | \u4F20\u7403\u6210\u529F\u7387: ${passAcc.toFixed(1)}% (\u53C2\u8003: 76%-86%)`);
  console.log(`\u63A7\u7403\u7387\u8303\u56F4: ${minPoss}% - ${maxPoss}%`);
  console.log(`\u5355\u961F\u573A\u5747\u9632\u5B88: \u62A2\u65AD ${(totalTackles / (2 * N)).toFixed(1)} | \u62E6\u622A ${(totalInterceptions / (2 * N)).toFixed(1)} | \u6251\u6551 ${(totalSaves / (2 * N)).toFixed(1)}`);
  console.log(`\u5355\u961F\u573A\u5747\u7EAA\u5F8B: \u72AF\u89C4 ${(totalFouls / (2 * N)).toFixed(1)} | \u9EC4\u724C ${(totalYellows / (2 * N)).toFixed(2)} | \u89D2\u7403 ${(totalCorners / (2 * N)).toFixed(1)} | \u8D8A\u4F4D ${(totalOffsides / (2 * N)).toFixed(1)}`);
  console.log("========================================================");
}
run100();
