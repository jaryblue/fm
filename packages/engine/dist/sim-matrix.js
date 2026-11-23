"use strict";

// packages/engine/src/types.ts
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
    lineHeight: 4,
    widthScale: 0.9,
    directness: 0.28,
    tempo: 1.15,
    pressDistance: 15,
    pressIntensity: 1.15,
    shootBias: 1.12
  },
  gegenpress: {
    name: "\u9AD8\u4F4D\u903C\u62A2",
    lineHeight: 8,
    widthScale: 1.02,
    directness: 0.6,
    tempo: 1.22,
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
    shootBias: 1.14
  },
  wing_play: {
    name: "\u4E24\u7FFC\u9F50\u98DE",
    lineHeight: 4,
    widthScale: 1.07,
    directness: 0.62,
    tempo: 1.1,
    pressDistance: 14,
    pressIntensity: 1.05,
    shootBias: 1.22
  },
  park_bus: {
    name: "\u94C1\u6876\u9632\u53CD",
    lineHeight: -7,
    widthScale: 0.9,
    directness: 0.62,
    tempo: 0.88,
    pressDistance: 10,
    pressIntensity: 0.82,
    shootBias: 0.8
  }
};

// packages/engine/src/formations.ts
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
    { role: "LWB", baseX: 27, baseY: 9 },
    { role: "CB", baseX: 21, baseY: 21 },
    { role: "CB", baseX: 20, baseY: 34 },
    { role: "CB", baseX: 21, baseY: 47 },
    { role: "RWB", baseX: 27, baseY: 59 },
    { role: "LM", baseX: 45, baseY: 13 },
    { role: "CM", baseX: 44, baseY: 27 },
    { role: "CM", baseX: 44, baseY: 41 },
    { role: "RM", baseX: 45, baseY: 55 },
    { role: "ST", baseX: 69, baseY: 34 }
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
function getDynamicAnchor(slot, ballPos, dir, hasPossession, style, formation, mods) {
  const preset = TACTICAL_PRESETS[style];
  const relBallX = toRelativeX(ballPos.x, dir);
  const ballOffsetFromCenterY = ballPos.y - PITCH.HALF_Y;
  if (slot.role === "GK") {
    const gkRelX = clamp(3 + (relBallX < 30 ? (30 - relBallX) * 0.12 : 0), 2.5, 9);
    const gkY = clamp(PITCH.HALF_Y + ballOffsetFromCenterY * 0.22, 27, 41);
    return { x: toAbsoluteX(gkRelX, dir), y: gkY };
  }
  const shiftScale = style === "tiki_taka" ? 0.66 : style === "gegenpress" ? 0.68 : style === "counter" ? 0.54 : 0.6;
  const ballShiftX = (relBallX - PITCH.HALF_X) * shiftScale;
  let stateShiftX = hasPossession === false ? clamp(mods?.lineShift ?? 0, -8, 8) * 0.7 : Math.max(0, clamp(mods?.lineShift ?? 0, -8, 8)) * 0.4;
  let compactX = 1;
  let widthFactor = preset.widthScale;
  const isLeftSide = slot.baseY < PITCH.HALF_Y;
  const ballOnMyFlank = isLeftSide ? ballPos.y < PITCH.HALF_Y + 8 : ballPos.y > PITCH.HALF_Y - 8;
  const defSys = formation ? getDefenseSystem(formation) : "4-back";
  const isWingBack = defSys !== "4-back";
  if (hasPossession === true) {
    stateShiftX += 7 + preset.lineHeight * 0.55;
    compactX = style === "tiki_taka" ? 0.98 : 1.12;
    if (slot.role === "LB" || slot.role === "RB" || slot.role === "LWB" || slot.role === "RWB") {
      const overlapBonus = clamp(mods?.overlapDepthBonus ?? 0, 0, 12);
      if (style === "park_bus") {
        stateShiftX += 6 + overlapBonus * 0.5;
      } else if (ballOnMyFlank || mods?.dualOverlap) {
        stateShiftX += (isWingBack ? 26 : 24) + overlapBonus;
      } else {
        stateShiftX += 14 + overlapBonus * 0.5;
      }
    } else if (slot.role === "CDM") {
      stateShiftX += mods?.dualOverlap ? -6 : formation === "4-2-3-1" || formation === "4-2-2-2" ? ballOnMyFlank ? 9 : 2 : 3;
    } else if (slot.role === "CM" || slot.role === "CAM") {
      if ((formation === "4-3-3" || formation === "4-1-2-1-2") && slot.role === "CM") {
        stateShiftX += ballOnMyFlank ? 16 : 6;
      } else {
        stateShiftX += relBallX > 52 ? 13 : 6;
      }
    } else if (slot.role === "LW" || slot.role === "RW" || slot.role === "LM" || slot.role === "RM") {
      const f9WingPush = (mods?.falseNineDrop ?? 0) > 0 && (slot.role === "LW" || slot.role === "RW") ? 7 : 0;
      stateShiftX += (style === "wing_play" ? 15 : 10) + f9WingPush;
    } else if (slot.role === "ST") {
      const f9 = clamp(mods?.falseNineDrop ?? 0, 0, 12);
      if (f9 > 0 && relBallX >= 36 && relBallX <= 66) {
        stateShiftX -= Math.min(5, f9 * 0.5);
      } else {
        stateShiftX += formation === "4-4-2" || formation === "3-5-2" ? ballOnMyFlank ? 12 : -2 : 8;
      }
    }
    if (style === "counter" && relBallX < 55 && ["ST", "LW", "RW", "CAM"].includes(slot.role)) {
      stateShiftX += 16;
    }
  } else if (hasPossession === false) {
    stateShiftX += style === "park_bus" ? -5 + preset.lineHeight * 0.45 : style === "gegenpress" ? -1 + preset.lineHeight * 0.75 : -7 + preset.lineHeight * 0.7;
    compactX = style === "park_bus" || defSys === "5-back" ? 0.76 : style === "gegenpress" ? 0.9 : 0.82;
    widthFactor *= style === "park_bus" || defSys === "5-back" ? 0.78 : 0.85;
    if ((style === "counter" || style === "park_bus") && slot.role === "ST") {
      stateShiftX += 11;
    }
  } else {
    stateShiftX += preset.lineHeight * 0.5;
    compactX = 0.95;
  }
  const relXCentered = 22 + (slot.baseX - 22) * compactX;
  const targetRelX = clamp(relXCentered + ballShiftX + stateShiftX, 11, 97);
  const baseOffsetY = slot.baseY - PITCH.HALF_Y;
  let roleWidthAdj = 1;
  if (hasPossession === true) {
    if (slot.role === "CB" && isWingBack && Math.abs(baseOffsetY) > 4) {
      roleWidthAdj = 1.18;
    } else if (slot.role === "LW" || slot.role === "RW") {
      const f9Tuck = (mods?.falseNineDrop ?? 0) > 0 ? 0.76 : 1;
      roleWidthAdj = (style === "wing_play" ? 1.1 : style === "tiki_taka" ? 0.76 : 0.84) * f9Tuck;
    } else if (slot.role === "LB" || slot.role === "RB" || slot.role === "LWB" || slot.role === "RWB") {
      roleWidthAdj = ballOnMyFlank || mods?.dualOverlap ? 1.12 : 0.84;
    }
  }
  const ballPullScale = hasPossession === false ? 0.34 : style === "tiki_taka" ? 0.3 : slot.role === "CAM" ? 0.4 : 0.18;
  let targetY = clamp(PITCH.HALF_Y + baseOffsetY * widthFactor * roleWidthAdj + ballOffsetFromCenterY * ballPullScale, 4, PITCH.WIDTH - 4);
  if (hasPossession === true && style === "wing_play" && relBallX > 70 && !ballOnMyFlank && ["LW", "RW", "LM", "RM"].includes(slot.role)) {
    targetY = PITCH.HALF_Y + (isLeftSide ? -10 : 10);
  }
  return {
    x: toAbsoluteX(targetRelX, dir),
    y: targetY
  };
}

// packages/engine/src/physics.ts
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

// packages/engine/src/evaluator.ts
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

// packages/engine/src/decision.ts
var WIDE_ROLES = /* @__PURE__ */ new Set(["LW", "RW", "LM", "RM", "LB", "RB", "LWB", "RWB"]);
function decideOnBall(holder, attackDir, style, players, ball, mods) {
  const preset = TACTICAL_PRESETS[style];
  const relX = toRelativeX(holder.pos.x, attackDir);
  const currentXT = evaluateXT(holder.pos, attackDir);
  if (holder.role === "GK") {
    const mates = players.filter((p) => p.team === holder.team && p.id !== holder.id && !p.redCard).sort((a, b) => dist2D(holder.pos, a.pos) - dist2D(holder.pos, b.pos));
    if (style === "counter" || style === "park_bus") {
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
  const maxShootDist = longShotDelta > 0.03 ? 34 : 32;
  const minShootXG = style === "tiki_taka" ? 0.025 : style === "park_bus" ? 0.028 : 0.02;
  if (distToGoal < maxShootDist) {
    const xG = computeShotXG(holder, attackDir, players);
    const isAttacker = holder.role === "ST" || holder.role === "CAM" || holder.role === "LW" || holder.role === "RW" || (holder.role === "LM" || holder.role === "RM" || holder.role === "CM") && relX > 62;
    const roleShootMul = isAttacker ? 1.28 : 0.92;
    const boxBonus = distToGoal < 20 ? 0.28 : 0;
    const wingCutInBonus = style === "wing_play" && WIDE_ROLES.has(holder.role) && relX >= 68 ? 0.14 : 0;
    const longShotMod = distToGoal >= 18 ? longShotDelta : 0;
    const shootScore = (0.4 + xG * 3.6 + boxBonus) * preset.shootBias * roleShootMul + longShotMod + wingCutInBonus;
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
      if (relX < 74 && passType === "short" && d < 22) styleBias += 0.16;
      if (passType === "long") styleBias -= 0.2;
      if (relX < 68 && mateRelX < relX && mateRelX > 32) styleBias += 0.05;
    } else if (style === "wing_play") {
      const mateWide = mate.pos.y < 19 || mate.pos.y > PITCH.WIDTH - 19 || WIDE_ROLES.has(mate.role);
      if (relX < 56 && mateWide && mateRelX >= relX - 2) styleBias += 0.08;
      if (isCross) styleBias += 0.22;
    } else if (style === "counter") {
      if ((passType === "through" || passType === "long") && progressGain > 0.12) styleBias += 0.24;
      if (progressGain < 0) styleBias -= 0.14;
    } else if (style === "park_bus") {
      if (relX < 40 && passType === "long" && progressGain > 0.18) styleBias += 0.14;
      if (relX < 38 && passType === "short" && progressGain <= 0) styleBias -= 0.1;
    } else if (style === "gegenpress") {
      if (progressGain > 0.05 && (passType === "through" || passType === "short")) styleBias += 0.12;
    }
    const wingTraitBonus = isCross && holder.traits?.includes("\u7CBE\u51C6\u4F20\u4E2D") ? 0.1 : 0;
    const throughTraitBonus = isThrough && holder.traits?.includes("\u81F4\u547D\u76F4\u585E") ? 0.12 : 0;
    const passBiasScale = relX < 76 ? 1 : 0.25;
    const modPassBias = passBiasScale * (passType === "through" ? clamp(mods?.throughPassBias ?? 0, -0.1, 0.14) : passType === "cross" ? clamp(mods?.crossBias ?? 0, -0.1, 0.14) : passType === "short" ? clamp(mods?.shortPassBias ?? 0, -0.1, 0.14) : 0);
    const antiPingPong = ball.lastPasserId === mate.id ? -0.1 : 0;
    const avoidGK = mate.role === "GK" ? style === "tiki_taka" ? -0.06 : -0.16 : 0;
    const passScore = pComp * (mateXT + 0.14) - (1 - pComp) * 0.18 + styleBias + modPassBias + wingTraitBonus + throughTraitBonus + antiPingPong + avoidGK;
    if (passScore > bestScore) {
      bestScore = passScore;
      bestAction = { type: "pass", target: mate, passType };
    }
  }
  const dribbleStep = 8;
  const isWidePlayer = WIDE_ROLES.has(holder.role);
  const hugWingY = style === "wing_play" && isWidePlayer && relX < 52 ? holder.pos.y < PITCH.HALF_Y ? -1.4 : 1.4 : isWidePlayer && relX >= 62 ? holder.pos.y < PITCH.HALF_Y ? 3.8 : -3.8 : holder.pos.y < 16 ? 3.5 : holder.pos.y > PITCH.WIDTH - 16 ? -3.5 : 0;
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
  const spaceBonus = nearestFrontOpp > 7.5 ? 0.08 : nearestFrontOpp < 3.5 ? -0.22 : -0.05;
  const roleDribbleBias = holder.role === "LW" || holder.role === "RW" || holder.role === "CAM" || (holder.role === "LM" || holder.role === "RM") && relX > 55 ? 0.05 : holder.role === "CB" || holder.role === "CDM" ? -0.18 : -0.08;
  const styleDribbleBias = style === "tiki_taka" ? -0.08 : style === "wing_play" && isWidePlayer ? 0.08 : style === "counter" && relX > 45 && nearestFrontOpp > 6 ? 0.08 : 0;
  const dribbleScore = (currentXT * 0.35 + dribbleXT * 0.55) * (0.65 + dribbleSkill * 0.3) + spaceBonus + roleDribbleBias + styleDribbleBias;
  if (!bestAction || dribbleScore > bestScore) {
    bestAction = { type: "dribble", targetPos: dribbleTarget };
  }
  return bestAction;
}
function updateOffBallTargets(players, ball, homeDir, homeStyle, awayStyle, homeFormation, awayFormation, homeMods, awayMods) {
  const holder = ball.holderId ? players.find((p) => p.id === ball.holderId) : null;
  const ballTeam = holder ? holder.team : ball.lastTouchTeam;
  const runners = /* @__PURE__ */ new Set();
  if (holder) {
    const attDir = holder.team === "home" ? homeDir : homeDir === 1 ? -1 : 1;
    const attStyle = holder.team === "home" ? homeStyle : awayStyle;
    const attMods = holder.team === "home" ? homeMods : awayMods;
    const offsideX = getOffsideLineX(holder.team, attDir, players);
    const candidates = players.filter((p) => p.team === holder.team && p.id !== holder.id && !p.redCard && p.role !== "GK").sort((a, b) => dist2D(a.pos, holder.pos) - dist2D(b.pos, holder.pos));
    if (candidates[0]) runners.add(candidates[0].id);
    if (attStyle === "tiki_taka" && candidates[1]) runners.add(candidates[1].id);
    const forwardRunner = candidates.find(
      (p) => (p.role === "ST" || p.role === "LW" || p.role === "RW" || p.role === "CAM" || p.role === "LM" || p.role === "RM" || p.role === "CM") && (attDir === 1 ? p.pos.x <= offsideX - 1.5 : p.pos.x >= offsideX + 1.5)
    );
    if (forwardRunner) runners.add(forwardRunner.id);
    const overlapCandidates = candidates.filter(
      (p) => (p.role === "LB" || p.role === "RB" || p.role === "LWB" || p.role === "RWB") && (attDir === 1 ? p.pos.x <= offsideX - 2 : p.pos.x >= offsideX + 2)
    );
    if (overlapCandidates[0]) runners.add(overlapCandidates[0].id);
    if (attMods?.dualOverlap && overlapCandidates[1]) runners.add(overlapCandidates[1].id);
  }
  const pressers = /* @__PURE__ */ new Set();
  const defendingTeam = ballTeam === "home" ? "away" : ballTeam === "away" ? "home" : null;
  if (defendingTeam) {
    const defStyle = defendingTeam === "home" ? homeStyle : awayStyle;
    const defMods = defendingTeam === "home" ? homeMods : awayMods;
    const preset = TACTICAL_PRESETS[defStyle];
    const pressDist = preset.pressDistance + clamp(defMods?.pressDistBonus ?? 0, 0, 8);
    const defPlayers = players.filter((p) => p.team === defendingTeam && !p.redCard && p.role !== "GK").sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos));
    if (defPlayers[0] && (dist2D(defPlayers[0].pos, ball.pos) < pressDist + 12 || ball.mode === "loose")) {
      pressers.add(defPlayers[0].id);
    }
    if (defPlayers[1] && (preset.pressIntensity >= 1.1 || defMods?.extraPresser) && dist2D(defPlayers[1].pos, ball.pos) < pressDist + 4) {
      pressers.add(defPlayers[1].id);
    }
    if (defPlayers[2] && (defStyle === "gegenpress" || defMods?.extraPresser) && dist2D(defPlayers[2].pos, ball.pos) < pressDist) {
      pressers.add(defPlayers[2].id);
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
    const formation = p.team === "home" ? homeFormation : awayFormation;
    const teamMods = p.team === "home" ? homeMods : awayMods;
    const anchor = getDynamicAnchor(slot, ball.pos, dir, hasPossession, style, formation, teamMods);
    if (hasPossession && holder) {
      const holderRelX = toRelativeX(holder.pos.x, dir);
      const offsideX = getOffsideLineX(p.team, dir, players);
      if (holderRelX > 66 && (p.role === "ST" || p.role === "CAM" || p.role === "LW" || p.role === "RW" || (teamMods?.boxCrashBonus ?? 0) > 0 && p.role === "CM")) {
        const boxX = dir === 1 ? Math.min(96, offsideX - 1.4) : Math.max(9, offsideX + 1.4);
        const boxY = p.role === "ST" ? PITCH.HALF_Y + (holder.pos.y < PITCH.HALF_Y ? 4 : -4) : p.role === "CAM" ? PITCH.HALF_Y + (holder.pos.y < PITCH.HALF_Y ? -3 : 3) : holder.pos.y < PITCH.HALF_Y ? PITCH.HALF_Y + 11 : PITCH.HALF_Y - 11;
        p.targetPos = { x: clamp(boxX, 8, PITCH.LENGTH - 8), y: clamp(boxY, 6, PITCH.WIDTH - 6) };
        continue;
      }
      if (runners.has(p.id)) {
        if (p.role === "ST" || p.role === "LW" || p.role === "RW" || p.role === "LM" || p.role === "RM" || p.role === "CM") {
          const safeForwardX = dir === 1 ? Math.min(anchor.x + 12, offsideX - 1.5) : Math.max(anchor.x - 12, offsideX + 1.5);
          p.targetPos = { x: clamp(safeForwardX, 5, PITCH.LENGTH - 5), y: anchor.y };
          continue;
        }
        if (p.role === "LB" || p.role === "RB" || p.role === "LWB" || p.role === "RWB") {
          const wingY = p.role === "LB" || p.role === "LWB" ? 6 : PITCH.WIDTH - 6;
          const safeOverlapX = dir === 1 ? Math.min(anchor.x + 16, offsideX - 2) : Math.max(anchor.x - 16, offsideX + 2);
          p.targetPos = { x: clamp(safeOverlapX, 8, PITCH.LENGTH - 8), y: wingY };
          continue;
        }
        const dx = anchor.x - holder.pos.x;
        const dy = anchor.y - holder.pos.y;
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const supportDist = style === "tiki_taka" ? 12 : 15;
        p.targetPos = {
          x: clamp(holder.pos.x + dx / d * supportDist + dir * 3, 5, PITCH.LENGTH - 5),
          y: clamp(holder.pos.y + dy / d * supportDist, 5, PITCH.WIDTH - 5)
        };
        continue;
      }
    }
    p.targetPos = anchor;
  }
}

// packages/engine/src/CommentaryEngine.ts
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
    "\u{1F3A9} \u5E3D\u5B50\u620F\u6CD5\uFF01{player}\u5B8C\u6210\u4E86\u672C\u573A\u6BD4\u8D5B\u7684\u7B2C\u4E09\u4E2A\u8FDB\u7403\uFF01\u5F7B\u5E95\u4E3B\u5BB0\u8D5B\u573A\uFF0C\u6BD4\u5206{score}\uFF01"
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
    "\u{1F7E8} {player}\u56E0\u4E3A{reason}\u88AB\u4E3B\u88C1\u5224\u51FA\u793A\u9EC4\u724C\u8B66\u544A\uFF01{team}\u9700\u8981\u63A7\u5236\u52A8\u4F5C\u4E86\uFF01",
    "\u{1F7E8} {player}\u6218\u672F\u72AF\u89C4\u62C9\u5012\u5BF9\u624B\uFF0C\u4E3B\u88C1\u5224\u679C\u65AD\u51FA\u793A\u9EC4\u724C\uFF01",
    "\u{1F7E8} \u88C1\u5224\u4EAE\u724C\u4E86\uFF01{player}\u56E0{reason}\u5403\u5230\u9EC4\u724C\uFF0C\u6559\u7EC3\u5728\u573A\u8FB9\u5927\u558A\u63D0\u9192\u51B7\u9759\uFF01"
  ],
  red_card: [
    "\u{1F7E5} \u7EA2\u724C\uFF01{player}\u56E0{reason}\u88AB\u76F4\u63A5\u7F5A\u4E0B\uFF01{team}\u53EA\u80FD\u5341\u4EBA\u5E94\u6218\uFF01",
    "\u{1F7E5} \u4E24\u9EC4\u53D8\u4E00\u7EA2\uFF01{player}\u7D2F\u8BA1\u4E24\u5F20\u9EC4\u724C\u88AB\u7F5A\u51FA\u573A\uFF01{team}\u9677\u5165\u4EBA\u6570\u52A3\u52BF\uFF01"
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
    "\u{1F504} {team}\u505A\u51FA\u6362\u4EBA\u8C03\u6574\uFF01{playerOut}\u88AB\u6362\u4E0B\uFF0C{playerIn}\u66FF\u8865\u767B\u573A\uFF01",
    "\u{1F504} \u6218\u672F\u8C03\u6574\uFF01{team}\u7528{playerIn}\u6362\u4E0B{playerOut}\uFF0C\u4FDD\u6301\u573A\u4E0A\u51B2\u51FB\u529B\uFF01",
    "\u{1F504} {team}\u8FDB\u884C\u4EBA\u5458\u8F6E\u6362\uFF0C{playerIn}\u66FF\u6362{playerOut}\u4E0A\u573A\uFF01"
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
      return `\u{1F525} ${teamName}\u653B\u52BF\u5982\u6F6E\uFF01\u77ED\u65F6\u95F4\u5185\u8FDE\u7EED\u5B8C\u6210\u7B2C ${cnt} \u811A\u5C04\u95E8\u538B\u5236\u5BF9\u624B\uFF01`;
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
    return { text: `\u26BD ${text}`, level: "critical", narrativeTag };
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

// packages/engine/src/MatchEngine.ts
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
    this.stoppageTicksFirst = Math.floor(Math.random() * 60);
    this.stoppageTicksSecond = 30 + Math.floor(Math.random() * 90);
    this.homeMods = home.tacticalMods ? { ...home.tacticalMods } : {};
    this.awayMods = away.tacticalMods ? { ...away.tacticalMods } : {};
    this.commentary = new CommentaryEngine(home.name, away.name);
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
          hiddenTrait: input.hiddenTrait,
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
      unlockedHiddenTraits: [],
      activeBuffs: [],
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
    const clampAttr = (v) => Math.max(25, Math.min(99, v));
    const targetLine = card.targetLine ?? "ALL";
    const hadActiveBuff = s.activeBuffs.some((b) => b.team === team);
    let energyRefund = 0;
    for (const p of s.players) {
      if (p.redCard) continue;
      if (p.team === team) {
        const matchLine = targetLine === "ALL" || this.getPlayerLine(p.role) === targetLine;
        if (matchLine) {
          if (card.fitnessInstantDelta) {
            p.fitness = Math.max(20, Math.min(100, p.fitness + card.fitnessInstantDelta));
          }
          if (card.passingDelta) p.attributes.passing = clampAttr(p.attributes.passing + card.passingDelta);
          if (card.shootingDelta) p.attributes.shooting = clampAttr(p.attributes.shooting + card.shootingDelta);
          if (card.defendingDelta) p.attributes.defending = clampAttr(p.attributes.defending + card.defendingDelta);
          if (card.paceDelta) p.attributes.pace = clampAttr(p.attributes.pace + card.paceDelta);
          if (card.composureDelta) p.attributes.composure = clampAttr(p.attributes.composure + card.composureDelta);
          if (card.goalkeepingDelta && p.role === "GK") {
            p.attributes.goalkeeping = clampAttr(p.attributes.goalkeeping + card.goalkeepingDelta);
          }
        }
        if (card.penaltyFitnessDelta) {
          p.fitness = Math.max(20, Math.min(100, p.fitness + card.penaltyFitnessDelta));
        }
        if (card.penaltyAllDefDelta) {
          p.attributes.defending = clampAttr(p.attributes.defending + card.penaltyAllDefDelta);
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
      } else if (card.chainEffect?.type === "fitness_leech") {
        p.fitness = Math.max(20, p.fitness - 8);
      }
    }
    if (card.chainEffect?.type === "energy_refund") {
      energyRefund = 1;
    }
    if (card.forceStyle) {
      this.setTactics(team, void 0, card.forceStyle);
    }
    const endMinute = Math.min(95, s.minute + card.durationMinutes);
    s.activeBuffs.push({ team, name: card.name, endMinute, effect: card });
    const chainTag = card.chainEffect ? ` \xB7 \u89E6\u53D1\u8FDE\u9501\u3010${card.chainEffect.label}\u3011` : "";
    this.pushEvent(
      "commentary",
      team,
      "",
      "",
      { x: PITCH.HALF_X, y: PITCH.HALF_Y },
      `\u{1F0CF} \u6559\u7EC3\u573A\u8FB9\u6307\u4EE4\uFF01\u3010${card.name}\u3011\u751F\u6548\uFF08\u6301\u7EED\u81F3 ${endMinute}'\uFF09${chainTag}`,
      void 0,
      "important"
    );
    return { ok: true, energyRefund };
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
      hiddenTrait: sub.hiddenTrait,
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
    s.players[pIdx] = newPlayer;
    if (wasHolding) s.ball.holderId = newPlayer.id;
    if (team === "home") s.homeSubsUsed++;
    else s.awaySubsUsed++;
    const sc = this.commentary.formatSubstitution(team, newPlayer.name, outPlayer.name, s.minute);
    this.pushEvent("substitution", team, newPlayer.id, newPlayer.name, newPlayer.pos, sc.text, void 0, sc.level);
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
      this.homeMods,
      this.awayMods
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
        const styleTackleBonus = oppStyle === "gegenpress" ? 0.08 : 0;
        const traitFoulMul = def.traits?.includes("\u7CBE\u51C6\u94F2\u65AD") ? 0.65 : 1;
        const tackleWinProb = clamp(0.45 + (defPower - attPower) / 100 * 0.55 + traitTackleBonus + styleTackleBonus, 0.15, 0.9);
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
    const mods = holder.team === "home" ? this.homeMods : this.awayMods;
    const dir = this.getAttackDir(holder.team);
    const action = decideOnBall(holder, dir, style, this.state.players, b, mods);
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
      const oc = this.commentary.formatOffside(passer.team, target.name, this.state.minute);
      this.pushEvent("offside", passer.team, target.id, target.name, target.pos, oc.text, void 0, oc.level);
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
      0.2 + shooter.attributes.shooting / 99 * 0.3 - dist / 35 * 0.14,
      0.16,
      0.6
    );
    const onTarget = Math.random() < onTargetProb;
    if (onTarget) {
      this.state.stats[shooter.team].shotsOnTarget++;
    }
    const targetY = onTarget ? PITCH.GOAL_Y + (Math.random() - 0.5) * (PITCH.GOAL_HALF_WIDTH * 1.8) : PITCH.GOAL_Y + (Math.random() < 0.5 ? -1 : 1) * (PITCH.GOAL_HALF_WIDTH + 1.2 + Math.random() * 3);
    const targetZ = onTarget ? 0.3 + Math.random() * 1.8 : 0.6 + Math.random() * 2.8;
    this.lastShotType = dist >= 20 ? "long_range" : this.state.ball.pos.z > 0.9 ? "header" : "normal";
    const sc = this.commentary.formatShot(shooter.team, shooter.name, xG, this.state.minute);
    this.pushEvent("shot", shooter.team, shooter.id, shooter.name, shooter.pos, sc.text, xG, sc.level);
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
      const tStyle = target.team === "home" ? this.state.homeStyle : this.state.awayStyle;
      const tMods = target.team === "home" ? this.homeMods : this.awayMods;
      const crossFinishProb = tStyle === "wing_play" || (tMods.crossBias ?? 0) > 0.03 ? 0.66 : 0.5;
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
    const blockDist = defStyle === "park_bus" || isFiveBack ? 1.6 : 1.15;
    const blockProb = defStyle === "park_bus" || isFiveBack ? 0.33 : 0.24;
    if (b.pos.z < 1.9) {
      for (const p of this.state.players) {
        if (p.team !== defTeam || p.redCard || p.role === "GK") continue;
        if (dist2D(p.pos, b.pos) < blockDist && Math.random() < blockProb) {
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
      const mc = this.commentary.formatMiss(shootTeam, shooter?.name || "\u524D\u950B", this.state.minute);
      this.pushEvent("miss", shootTeam, shooter?.id || "", shooter?.name || "", b.pos, mc.text, void 0, mc.level);
      if (Math.random() < 0.3) {
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
    const gkAttr = gk ? gk.attributes.goalkeeping : 65;
    const shooterAttr = shooter ? shooter.attributes.shooting * 0.65 + shooter.attributes.composure * 0.35 : 70;
    const gkTraitBonus = gk?.traits?.includes("\u95E8\u7EBF\u795E\u6251") ? 0.07 : 0;
    const gkSaveBonus = (gkAttr - 65) / 100 * 0.22 + gkTraitBonus;
    const attrDiffBonus = (shooterAttr - gkAttr) / 100 * 0.18;
    const goalProb = clamp(0.24 + b.shotXG * 0.78 + attrDiffBonus - gkSaveBonus, 0.12, 0.68);
    if (Math.random() < goalProb) {
      if (shooter) shooter.matchStats.goals++;
      this.state.stats[shootTeam].goals++;
      if (shootTeam === "home") this.state.homeScore++;
      else this.state.awayScore++;
      let assisterName;
      if (b.lastPasserId && shooter && b.lastPasserId !== shooter.id && this.state.tick - this.lastPassTimestamp <= 60) {
        const assister = this.state.players.find((p) => p.id === b.lastPasserId && p.team === shootTeam);
        if (assister) {
          assister.matchStats.assists++;
          assisterName = assister.name;
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
      }
      const concedeTeam = shootTeam === "home" ? "away" : "home";
      this.setupKickoff(concedeTeam);
    } else {
      if (gk) gk.matchStats.saves++;
      this.state.stats[defTeam].saves++;
      const svc = this.commentary.formatSave(defTeam, gk?.name || "\u95E8\u5C06", shooter?.name || "\u524D\u950B", this.state.minute);
      this.pushEvent("save", defTeam, gk?.id || "", gk?.name || "\u95E8\u5C06", b.pos, svc.text, void 0, svc.level);
      if (Math.random() < 0.28) {
        this.state.stats[shootTeam].corners++;
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
      `\u2728 \u9690\u85CF\u7279\u8D28\u89C9\u9192\uFF01${player.name} \u89E6\u53D1\u89E3\u9501\u3010${expectedTrait}\u3011\uFF01`,
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
        }
        s.activeBuffs.splice(i, 1);
      }
    }
  }
  drainFitness() {
    for (const p of this.state.players) {
      if (p.redCard) continue;
      const style = p.team === "home" ? this.state.homeStyle : this.state.awayStyle;
      const mods = p.team === "home" ? this.homeMods : this.awayMods;
      const drainMul = clamp(mods.staminaDrainMul ?? 1, 0.7, 1);
      const pressFactor = TACTICAL_PRESETS[style].pressIntensity;
      const staminaResist = 1.25 - p.attributes.stamina / 99 * 0.5;
      let traitResist = p.traits?.includes("\u94C1\u80BA\u8986\u76D6") ? 0.6 : 1;
      if (p.traits?.includes("\u4F53\u80FD\u5145\u6C9B")) traitResist *= 0.7;
      const roleFactor = p.role === "GK" ? 0.15 : 0.34;
      p.fitness = Math.max(20, p.fitness - roleFactor * pressFactor * staminaResist * traitResist * drainMul);
    }
  }
  finalizeStats() {
    const topRunners = [...this.state.players].filter((p) => !p.redCard && p.role !== "GK").sort((a, b) => b.matchStats.distanceM - a.matchStats.distanceM).slice(0, 2);
    for (const r of topRunners) {
      this.tryRevealHiddenTrait(r, "\u4F53\u80FD\u5145\u6C9B");
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

// packages/engine/src/sim-matrix.ts
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeAttrs(role, baseCA) {
  const jitter = () => randInt(-5, 5);
  const clampA = (v) => Math.max(30, Math.min(99, v));
  const isGK = role === "GK";
  const isDef = ["CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(role);
  const isAtt = ["ST", "LW", "RW", "CAM"].includes(role);
  return {
    passing: clampA(baseCA + (isDef ? -2 : 4) + jitter()),
    shooting: clampA(baseCA + (isAtt ? 8 : isDef ? -15 : -2) + jitter()),
    dribbling: clampA(baseCA + (isAtt ? 6 : isDef ? -8 : 3) + jitter()),
    pace: clampA(baseCA + (["LW", "RW", "LB", "RB", "LWB", "RWB"].includes(role) ? 7 : 0) + jitter()),
    strength: clampA(baseCA + (["CB", "ST", "CDM"].includes(role) ? 6 : -3) + jitter()),
    defending: clampA(baseCA + (isDef ? 10 : isAtt ? -25 : -4) + jitter()),
    positioning: clampA(baseCA + jitter()),
    composure: clampA(baseCA + jitter()),
    stamina: clampA(baseCA + 5 + jitter()),
    goalkeeping: clampA(isGK ? baseCA + 8 + jitter() : 25)
  };
}
function makeTeam(name, formation, style, baseCA, tacticalMods) {
  const slots = FORMATIONS[formation];
  const players = slots.map((s, idx) => ({
    id: `${name}_${idx}`,
    name: `${name}-${s.role}${idx + 1}`,
    role: s.role,
    shirtNumber: idx + 1,
    attributes: makeAttrs(s.role, baseCA),
    fitness: 100
  }));
  return { name, formation, style, players, tacticalMods };
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
var FULL_MODS_BY_STYLE = {
  tiki_taka: { shortPassBias: 0.1, falseNineDrop: 8, pressDistBonus: 4, extraPresser: true, staminaDrainMul: 0.85 },
  gegenpress: { pressDistBonus: 6, extraPresser: true, lineShift: 5, boxCrashBonus: 1, staminaDrainMul: 0.8 },
  wing_play: { overlapDepthBonus: 8, dualOverlap: true, crossBias: 0.1, boxCrashBonus: 1 },
  counter: { throughPassBias: 0.1, gkQuickLaunch: true, lineShift: -4, longShotBias: 0.05 },
  park_bus: { lineShift: -6, gkQuickLaunch: true, staminaDrainMul: 0.82 },
  balanced: { boxCrashBonus: 1, longShotBias: 0.06, throughPassBias: 0.05, overlapDepthBonus: 4, staminaDrainMul: 0.88 }
};
function emptyBucket() {
  return { matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, shots: 0, passes: 0, possSum: 0, tackles: 0, xg: 0 };
}
function runMatrix() {
  const N = 1200;
  const AB_N = 300;
  const t0 = Date.now();
  const byFormation = {};
  const byStyle = {};
  for (const f of FORMATION_POOL) byFormation[f] = emptyBucket();
  for (const s of STYLE_POOL) byStyle[s] = emptyBucket();
  let totalGoals = 0;
  let totalShots = 0;
  let totalOnTarget = 0;
  let totalPasses = 0;
  let totalPassesOk = 0;
  let minPoss = 100;
  let maxPoss = 0;
  for (let i = 0; i < N; i++) {
    const f1 = FORMATION_POOL[i % FORMATION_POOL.length];
    const f2 = FORMATION_POOL[randInt(0, FORMATION_POOL.length - 1)];
    const s1 = STYLE_POOL[i % STYLE_POOL.length];
    const s2 = STYLE_POOL[randInt(0, STYLE_POOL.length - 1)];
    const ca1 = randInt(70, 76);
    const ca2 = randInt(70, 76);
    const m1 = Math.random() < 0.35 ? FULL_MODS_BY_STYLE[s1] : void 0;
    const m2 = Math.random() < 0.35 ? FULL_MODS_BY_STYLE[s2] : void 0;
    const res = new MatchEngine(
      makeTeam("Home", f1, s1, ca1, m1),
      makeTeam("Away", f2, s2, ca2, m2)
    ).simulateMatch();
    const h = res.stats.home;
    const a = res.stats.away;
    totalGoals += h.goals + a.goals;
    totalShots += h.shots + a.shots;
    totalOnTarget += h.shotsOnTarget + a.shotsOnTarget;
    totalPasses += h.passes + a.passes;
    totalPassesOk += h.passesSuccess + a.passesSuccess;
    minPoss = Math.min(minPoss, h.possessionPct, a.possessionPct);
    maxPoss = Math.max(maxPoss, h.possessionPct, a.possessionPct);
    const record = (b, my, opp) => {
      b.matches++;
      if (my.goals > opp.goals) b.wins++;
      else if (my.goals === opp.goals) b.draws++;
      else b.losses++;
      b.gf += my.goals;
      b.ga += opp.goals;
      b.shots += my.shots;
      b.passes += my.passes;
      b.possSum += my.possessionPct;
      b.tackles += my.tackles;
      b.xg += my.xG;
    };
    record(byFormation[f1], h, a);
    record(byFormation[f2], a, h);
    record(byStyle[s1], h, a);
    record(byStyle[s2], a, h);
  }
  let abModWins = 0, abDraws = 0, abBaseWins = 0;
  let abModXG = 0, abBaseXG = 0;
  let abModShots = 0, abBaseShots = 0;
  let abModPasses = 0, abBasePasses = 0;
  let abModPoss = 0;
  for (let i = 0; i < AB_N; i++) {
    const f = FORMATION_POOL[i % FORMATION_POOL.length];
    const s = STYLE_POOL[i % STYLE_POOL.length];
    const res = new MatchEngine(
      makeTeam("ModTeam", f, s, 73, FULL_MODS_BY_STYLE[s]),
      makeTeam("BaseTeam", f, s, 73, void 0)
    ).simulateMatch();
    const h = res.stats.home;
    const a = res.stats.away;
    if (h.goals > a.goals) abModWins++;
    else if (h.goals === a.goals) abDraws++;
    else abBaseWins++;
    abModXG += h.xG;
    abBaseXG += a.xG;
    abModShots += h.shots;
    abBaseShots += a.shots;
    abModPasses += h.passes;
    abBasePasses += a.passes;
    abModPoss += h.possessionPct;
  }
  const ms = Date.now() - t0;
  console.log(`================ ${N + AB_N} \u573A\u5927\u89C4\u6A21\u4EFF\u771F\u77E9\u9635\u62A5\u544A (${ms}ms, ${(ms / (N + AB_N)).toFixed(2)}ms/\u573A) ================`);
  console.log(`\u5168\u5C40\u5747\u503C: \u573A\u5747\u603B\u8FDB\u7403 ${(totalGoals / N).toFixed(2)} | \u5355\u961F\u5C04\u95E8 ${(totalShots / (2 * N)).toFixed(1)} (\u5C04\u6B63\u7387 ${(totalOnTarget / totalShots * 100).toFixed(1)}%) | \u5355\u961F\u4F20\u7403 ${(totalPasses / (2 * N)).toFixed(0)} (${(totalPassesOk / totalPasses * 100).toFixed(1)}%) | \u63A7\u7403\u6781\u503C ${minPoss}%~${maxPoss}%`);
  console.log("\n--- 16 \u9635\u578B\u5206\u5E03 (\u573A\u6B21 / \u80DC\u7387 / \u573A\u5747\u8FDB\u5931\u7403 / \u63A7\u7403\u7387) ---");
  for (const f of FORMATION_POOL) {
    const b = byFormation[f];
    const wr = (b.wins / b.matches * 100).toFixed(1);
    console.log(`${f.padEnd(10)} n=${String(b.matches).padEnd(4)} \u80DC\u7387=${wr.padStart(5)}%  \u8FDB=${(b.gf / b.matches).toFixed(2)} \u5931=${(b.ga / b.matches).toFixed(2)}  \u63A7\u7403=${(b.possSum / b.matches).toFixed(1)}%`);
  }
  console.log("\n--- 6 \u6218\u672F\u98CE\u683C\u8E22\u6CD5\u5DEE\u5F02 (\u573A\u6B21 / \u80DC\u7387 / \u573A\u5747\u8FDB\u5931 / \u4F20\u7403 / \u5C04\u95E8 / \u62A2\u65AD / \u63A7\u7403) ---");
  for (const s of STYLE_POOL) {
    const b = byStyle[s];
    const wr = (b.wins / b.matches * 100).toFixed(1);
    console.log(`${s.padEnd(12)} n=${String(b.matches).padEnd(4)} \u80DC\u7387=${wr.padStart(5)}%  \u8FDB=${(b.gf / b.matches).toFixed(2)} \u5931=${(b.ga / b.matches).toFixed(2)}  \u4F20=${(b.passes / b.matches).toFixed(0)} \u5C04=${(b.shots / b.matches).toFixed(1)} \u62A2=${(b.tackles / b.matches).toFixed(1)} \u63A7=${(b.possSum / b.matches).toFixed(1)}%`);
  }
  console.log(`
--- ${AB_N} \u573A\u955C\u50CF A/B \u5BF9\u7167 (\u540C\u9635\u578B/\u540C\u98CE\u683C/\u540CCA73\uFF1A\u6EE1 TacticalMods vs \u96F6 Mods) ---`);
  console.log(`\u6218\u7EE9: Mods\u80DC ${abModWins} (${(abModWins / AB_N * 100).toFixed(1)}%) | \u5E73 ${abDraws} | \u96F6Mods\u80DC ${abBaseWins} (${(abBaseWins / AB_N * 100).toFixed(1)}%)`);
  console.log(`\u8FC7\u7A0B\u5BF9\u6BD4: xG ${(abModXG / AB_N).toFixed(2)} vs ${(abBaseXG / AB_N).toFixed(2)} | \u5C04\u95E8 ${(abModShots / AB_N).toFixed(1)} vs ${(abBaseShots / AB_N).toFixed(1)} | \u4F20\u7403 ${(abModPasses / AB_N).toFixed(0)} vs ${(abBasePasses / AB_N).toFixed(0)} | \u63A7\u7403 ${(abModPoss / AB_N).toFixed(1)}%`);
  console.log("================================================================================");
}
runMatrix();
