"use strict";
/**
 * @fm-league/engine - 核心类型与球场常量定义
 * 零平台依赖，适用于 Node / 浏览器 / Steam / 微信小游戏
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TACTICAL_PRESETS = exports.SIM_CONFIG = exports.PITCH = void 0;
exports.PITCH = {
    LENGTH: 105,
    WIDTH: 68,
    HALF_X: 52.5,
    HALF_Y: 34,
    GOAL_Y: 34,
    GOAL_HALF_WIDTH: 3.66,
    PENALTY_BOX_DEPTH: 16.5,
    PENALTY_BOX_HALF_W: 20.16,
    SIX_YARD_DEPTH: 5.5,
    PENALTY_SPOT: 11,
};
exports.SIM_CONFIG = {
    TICK_DT: 0.1, // 每 tick 物理时间 0.1 秒 (10Hz)
    TICKS_PER_MINUTE: 30, // 30 ticks = 1 比赛分钟 (90分钟 = 2700 ticks)
    DECISION_INTERVAL: 3, // 持球决策节拍：每 3 ticks (0.3s) 评估一次核心动作
};
exports.TACTICAL_PRESETS = {
    balanced: {
        name: '均衡阵地',
        lineHeight: 0,
        widthScale: 1.0,
        directness: 0.50,
        tempo: 0.94,
        pressDistance: 12,
        pressIntensity: 0.93,
        shootBias: 0.92,
    },
    tiki_taka: {
        name: '传控渗透',
        lineHeight: 4,
        widthScale: 0.90,
        directness: 0.46,
        tempo: 1.15,
        pressDistance: 15,
        pressIntensity: 1.15,
        shootBias: 1.12,
    },
    gegenpress: {
        name: '高位逼抢',
        lineHeight: 6,
        widthScale: 1.02,
        directness: 0.60,
        tempo: 1.22,
        pressDistance: 19,
        pressIntensity: 1.32,
        shootBias: 1.12,
    },
    counter: {
        name: '快速反击',
        lineHeight: -6,
        widthScale: 0.96,
        directness: 0.82,
        tempo: 1.10,
        pressDistance: 11,
        pressIntensity: 0.95,
        shootBias: 1.16,
    },
    wing_play: {
        name: '两翼齐飞',
        lineHeight: 4,
        widthScale: 1.07,
        directness: 0.57,
        tempo: 1.04,
        pressDistance: 14,
        pressIntensity: 1.04,
        shootBias: 1.02,
    },
    park_bus: {
        name: '铁桶防反',
        lineHeight: -6,
        widthScale: 0.90,
        directness: 0.78,
        tempo: 1.04,
        pressDistance: 11,
        pressIntensity: 0.95,
        shootBias: 1.08,
    },
};
