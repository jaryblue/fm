"use strict";
/**
 * 轻量 2D+Z 球体物理与球员运动学
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dist2D = dist2D;
exports.pointToSegment = pointToSegment;
exports.launchPassBall = launchPassBall;
exports.launchShotBall = launchShotBall;
exports.stepBallPhysics = stepBallPhysics;
exports.stepPlayersPhysics = stepPlayersPhysics;
const types_1 = require("./types");
const formations_1 = require("./formations");
const GRAVITY = 9.81;
function dist2D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
/**
 * 点 P 到线段 AB 的最短距离与投影参数 t ∈ [0, 1]
 */
function pointToSegment(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq < 1e-6)
        return { dist: dist2D(p, a), t: 0 };
    const t = (0, formations_1.clamp)(((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq, 0, 1);
    const px = a.x + t * abx;
    const py = a.y + t * aby;
    return { dist: dist2D(p, { x: px, y: py }), t };
}
/**
 * 发起传球物理轨迹（短传贴地，长传/传中带 Z 轴抛物线）
 */
function launchPassBall(ball, from, to, passer, target, passType) {
    const d = Math.max(2, dist2D(from, to));
    // 传球初速度：短传 ~16-20 m/s，长传/直塞 ~22-27 m/s
    const baseSpeed = passType === 'short' ? 16 + Math.min(4, d * 0.15) :
        passType === 'through' ? 21 :
            passType === 'cross' ? 22 : 24;
    const flightTime = (0, formations_1.clamp)(d / baseSpeed, 0.25, 2.2);
    // 地面传球略有摩擦，略提高初速以保证到达
    const isLofted = passType === 'long' || passType === 'cross' || d > 26;
    const speedMul = isLofted ? 1.0 : 1.18;
    // 加入轻微传球误差（受 passing 与高压影响）
    const accFactor = (100 - passer.attributes.passing) * 0.015;
    const errX = (Math.random() - 0.5) * accFactor * (d * 0.08);
    const errY = (Math.random() - 0.5) * accFactor * (d * 0.08);
    const tx = (0, formations_1.clamp)(to.x + errX, 1.5, types_1.PITCH.LENGTH - 1.5);
    const ty = (0, formations_1.clamp)(to.y + errY, 1.5, types_1.PITCH.WIDTH - 1.5);
    ball.mode = 'pass';
    ball.holderId = null;
    ball.lastTouchTeam = passer.team;
    ball.lastPasserId = passer.id;
    ball.targetPlayerId = target.id;
    ball.passType = passType;
    ball.pos = { x: from.x, y: from.y, z: 0.15 };
    ball.vel = {
        x: ((tx - from.x) / flightTime) * speedMul,
        y: ((ty - from.y) / flightTime) * speedMul,
        z: isLofted ? 0.5 * GRAVITY * flightTime : 0,
    };
}
/**
 * 发起射门物理轨迹
 */
function launchShotBall(ball, shooter, attackDir, xG, onTarget, targetY, targetZ) {
    const goalX = attackDir === 1 ? types_1.PITCH.LENGTH : 0;
    const d = Math.max(2, dist2D(shooter.pos, { x: goalX, y: targetY }));
    const shotSpeed = 26 + (shooter.attributes.shooting / 99) * 8; // 26~34 m/s
    const flightTime = (0, formations_1.clamp)(d / shotSpeed, 0.15, 1.3);
    ball.mode = 'shot';
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
        z: targetZ / flightTime + 0.5 * GRAVITY * flightTime * 0.35,
    };
}
/**
 * 推进球体物理状态 1 个 tick (0.1s)
 */
function stepBallPhysics(ball) {
    if (ball.mode === 'dead' || ball.mode === 'held')
        return;
    const dt = types_1.SIM_CONFIG.TICK_DT;
    ball.pos.x += ball.vel.x * dt;
    ball.pos.y += ball.vel.y * dt;
    ball.pos.z += ball.vel.z * dt;
    if (ball.pos.z > 0.05 || ball.vel.z > 0) {
        ball.vel.z -= GRAVITY * dt;
        if (ball.pos.z <= 0) {
            ball.pos.z = 0;
            if (Math.abs(ball.vel.z) > 1.8) {
                ball.vel.z = -ball.vel.z * 0.42;
            }
            else {
                ball.vel.z = 0;
            }
            // 落地后草皮摩擦减速
            ball.vel.x *= 0.86;
            ball.vel.y *= 0.86;
        }
        else {
            // 轻微空气阻力
            ball.vel.x *= 0.99;
            ball.vel.y *= 0.99;
        }
    }
    else {
        ball.pos.z = 0;
        // 地面滚动摩擦
        const drag = ball.mode === 'pass' ? 0.955 : 0.92;
        ball.vel.x *= drag;
        ball.vel.y *= drag;
    }
    ball.pos.z = Math.max(0, ball.pos.z);
}
/**
 * 推进所有场上球员运动学 (带转向惯性与体能影响)
 */
function stepPlayersPhysics(players, ball) {
    const dt = types_1.SIM_CONFIG.TICK_DT;
    for (const p of players) {
        if (p.redCard)
            continue;
        if (p.stunTicks > 0) {
            p.stunTicks--;
            p.vel.x *= 0.7;
            p.vel.y *= 0.7;
            continue;
        }
        if (p.decisionCooldown > 0)
            p.decisionCooldown--;
        // 持球人略微降速 (带球比无球慢约 12%)；体能低于 65% 后速度明显下滑，凸显换人价值
        const baseMaxSpeed = 6.2 + (p.attributes.pace / 99) * 2.6; // 6.2 ~ 8.8 m/s
        const fatigueFactor = p.fitness >= 65
            ? 0.90 + ((p.fitness - 65) / 35) * 0.10
            : 0.58 + (p.fitness / 65) * 0.32;
        const ballCarryFactor = p.hasBall ? 0.88 : 1.0;
        const maxSpeed = baseMaxSpeed * fatigueFactor * ballCarryFactor;
        const dx = p.targetPos.x - p.pos.x;
        const dy = p.targetPos.y - p.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.35) {
            p.vel.x *= 0.6;
            p.vel.y *= 0.6;
        }
        else {
            // 接近目标时平滑减速
            const desiredSpeed = dist < 2.0 ? maxSpeed * (dist / 2.0) : maxSpeed;
            const desiredVx = (dx / dist) * desiredSpeed;
            const desiredVy = (dy / dist) * desiredSpeed;
            // 加速度混合（模拟转向惯性）
            const accel = 0.42;
            p.vel.x += (desiredVx - p.vel.x) * accel;
            p.vel.y += (desiredVy - p.vel.y) * accel;
        }
        const oldX = p.pos.x;
        const oldY = p.pos.y;
        p.pos.x = (0, formations_1.clamp)(p.pos.x + p.vel.x * dt, 0.8, types_1.PITCH.LENGTH - 0.8);
        p.pos.y = (0, formations_1.clamp)(p.pos.y + p.vel.y * dt, 0.8, types_1.PITCH.WIDTH - 0.8);
        const moved = dist2D({ x: oldX, y: oldY }, p.pos);
        p.matchStats.distanceM += moved;
        // 持球时球紧贴脚下（略微在运动方向前方 0.45m）
        if (p.hasBall && ball.mode === 'held' && ball.holderId === p.id) {
            const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
            const leadX = speed > 0.5 ? (p.vel.x / speed) * 0.45 : 0;
            const leadY = speed > 0.5 ? (p.vel.y / speed) * 0.45 : 0;
            ball.pos.x = p.pos.x + leadX;
            ball.pos.y = p.pos.y + leadY;
            ball.pos.z = 0;
            ball.vel.x = p.vel.x;
            ball.vel.y = p.vel.y;
            ball.vel.z = 0;
        }
    }
}
