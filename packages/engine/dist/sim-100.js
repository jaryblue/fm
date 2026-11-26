"use strict";
/**
 * 100 场无头模拟校准测试脚本
 * 覆盖均衡、传控、高位逼抢、防反、两翼齐飞多种战术对局
 */
Object.defineProperty(exports, "__esModule", { value: true });
const MatchEngine_1 = require("./MatchEngine");
const formations_1 = require("./formations");
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeAttrs(role, baseCA) {
    const jitter = () => randInt(-6, 6);
    const clampA = (v) => Math.max(30, Math.min(99, v));
    const isGK = role === 'GK';
    const isDef = ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(role);
    const isAtt = ['ST', 'LW', 'RW', 'CAM'].includes(role);
    return {
        passing: clampA(baseCA + (isDef ? -2 : 4) + jitter()),
        shooting: clampA(baseCA + (isAtt ? 8 : isDef ? -15 : -2) + jitter()),
        dribbling: clampA(baseCA + (isAtt ? 6 : isDef ? -8 : 3) + jitter()),
        pace: clampA(baseCA + (['LW', 'RW', 'LB', 'RB'].includes(role) ? 7 : 0) + jitter()),
        strength: clampA(baseCA + (['CB', 'ST', 'CDM'].includes(role) ? 6 : -3) + jitter()),
        defending: clampA(baseCA + (isDef ? 10 : isAtt ? -25 : -4) + jitter()),
        positioning: clampA(baseCA + jitter()),
        composure: clampA(baseCA + jitter()),
        stamina: clampA(baseCA + 5 + jitter()),
        goalkeeping: clampA(isGK ? baseCA + 8 + jitter() : 25),
    };
}
function makeTeam(name, formation, style, baseCA) {
    const slots = formations_1.FORMATIONS[formation];
    const players = slots.map((s, idx) => ({
        id: `${name}_${idx}`,
        name: `${name}-${s.role}${idx + 1}`,
        role: s.role,
        shirtNumber: idx + 1,
        attributes: makeAttrs(s.role, baseCA),
        fitness: 100,
    }));
    return { name, formation, style, players };
}
const FORMATION_POOL = [
    '4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '4-4-1-1', '4-1-4-1', '4-2-2-2', '4-3-2-1',
    '3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2',
    '5-4-1', '5-3-2', '5-2-3', '5-2-1-2',
];
const STYLE_POOL = ['balanced', 'tiki_taka', 'gegenpress', 'counter', 'wing_play', 'park_bus'];
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
        const engine = new MatchEngine_1.MatchEngine(makeTeam('Home', f1, s1, ca1), makeTeam('Away', f2, s2, ca2));
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
        if (h.goals > a.goals)
            homeWins++;
        else if (h.goals === a.goals)
            draws++;
        else
            awayWins++;
        minPoss = Math.min(minPoss, h.possessionPct, a.possessionPct);
        maxPoss = Math.max(maxPoss, h.possessionPct, a.possessionPct);
    }
    const elapsedMs = Date.now() - t0;
    const avgGoals = totalGoals / N;
    const avgTeamShots = (totalHomeShots + totalAwayShots) / (2 * N);
    const avgTeamOnTarget = (totalHomeOnTarget + totalAwayOnTarget) / (2 * N);
    const onTargetPct = ((totalHomeOnTarget + totalAwayOnTarget) / Math.max(1, totalHomeShots + totalAwayShots)) * 100;
    const avgTeamXG = (totalHomeXG + totalAwayXG) / (2 * N);
    const avgTeamPasses = totalPasses / (2 * N);
    const passAcc = (totalPassesSuccess / Math.max(1, totalPasses)) * 100;
    console.log('================ 100 场模拟数据校准报告 ================');
    console.log(`耗时: ${elapsedMs} ms (${(elapsedMs / N).toFixed(2)} ms/场)`);
    console.log(`胜平负分布: 主胜 ${homeWins}% | 平 ${draws}% | 客胜 ${awayWins}%`);
    console.log(`场均总进球: ${avgGoals.toFixed(2)} 球 (五大联赛参考: 2.5 - 2.9)`);
    console.log(`单队场均射门: ${avgTeamShots.toFixed(1)} 次 | 射正: ${avgTeamOnTarget.toFixed(1)} 次 (射正率 ${onTargetPct.toFixed(1)}%, 参考: 32%-38%)`);
    console.log(`单队场均 xG: ${avgTeamXG.toFixed(2)} (参考: 1.1 - 1.7)`);
    console.log(`单队场均传球: ${avgTeamPasses.toFixed(0)} 次 | 传球成功率: ${passAcc.toFixed(1)}% (参考: 76%-86%)`);
    console.log(`控球率范围: ${minPoss}% - ${maxPoss}%`);
    console.log(`单队场均防守: 抢断 ${(totalTackles / (2 * N)).toFixed(1)} | 拦截 ${(totalInterceptions / (2 * N)).toFixed(1)} | 扑救 ${(totalSaves / (2 * N)).toFixed(1)}`);
    console.log(`单队场均纪律: 犯规 ${(totalFouls / (2 * N)).toFixed(1)} | 黄牌 ${(totalYellows / (2 * N)).toFixed(2)} | 角球 ${(totalCorners / (2 * N)).toFixed(1)} | 越位 ${(totalOffsides / (2 * N)).toFixed(1)}`);
    console.log('========================================================');
}
run100();
