"use strict";
/**
 * 大规模矩阵仿真压测脚本（1,500 场）：
 * 1. 全量覆盖 16 种阵型 × 6 种战术风格 × 随机 CA 对局
 * 2. 分阵型胜率/进球/控球率分布校验（排查过强或过弱阵型）
 * 3. 分战术风格踢法差异校验（传球数、控球率、射门、抢断）
 * 4. 300 场镜像 A/B 对照（同阵型同 CA：满技能网 TacticalMods vs 无技能网）
 */
Object.defineProperty(exports, "__esModule", { value: true });
const MatchEngine_1 = require("./MatchEngine");
const formations_1 = require("./formations");
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeAttrs(role, baseCA) {
    const jitter = () => randInt(-5, 5);
    const clampA = (v) => Math.max(30, Math.min(99, v));
    const isGK = role === 'GK';
    const isDef = ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(role);
    const isAtt = ['ST', 'LW', 'RW', 'CAM'].includes(role);
    return {
        passing: clampA(baseCA + (isDef ? -2 : 4) + jitter()),
        shooting: clampA(baseCA + (isAtt ? 8 : isDef ? -15 : -2) + jitter()),
        dribbling: clampA(baseCA + (isAtt ? 6 : isDef ? -8 : 3) + jitter()),
        pace: clampA(baseCA + (['LW', 'RW', 'LB', 'RB', 'LWB', 'RWB'].includes(role) ? 7 : 0) + jitter()),
        strength: clampA(baseCA + (['CB', 'ST', 'CDM'].includes(role) ? 6 : -3) + jitter()),
        defending: clampA(baseCA + (isDef ? 10 : isAtt ? -25 : -4) + jitter()),
        positioning: clampA(baseCA + jitter()),
        composure: clampA(baseCA + jitter()),
        stamina: clampA(baseCA + 5 + jitter()),
        goalkeeping: clampA(isGK ? baseCA + 8 + jitter() : 25),
    };
}
function makeTeam(name, formation, style, baseCA, tacticalMods) {
    const slots = formations_1.FORMATIONS[formation];
    const players = slots.map((s, idx) => ({
        id: `${name}_${idx}`,
        name: `${name}-${s.role}${idx + 1}`,
        role: s.role,
        shirtNumber: idx + 1,
        attributes: makeAttrs(s.role, baseCA),
        fitness: 100,
    }));
    return { name, formation, style, players, tacticalMods };
}
const FORMATION_POOL = [
    '4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '4-4-1-1', '4-1-4-1', '4-2-2-2', '4-3-2-1',
    '3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2',
    '5-4-1', '5-3-2', '5-2-3', '5-2-1-2',
];
const STYLE_POOL = ['balanced', 'tiki_taka', 'gegenpress', 'counter', 'wing_play', 'park_bus'];
const FULL_MODS_BY_STYLE = {
    tiki_taka: { shortPassBias: 0.10, falseNineDrop: 8, pressDistBonus: 4, extraPresser: true, staminaDrainMul: 0.85 },
    gegenpress: { pressDistBonus: 6, extraPresser: true, lineShift: 5, boxCrashBonus: 1, staminaDrainMul: 0.80 },
    wing_play: { overlapDepthBonus: 8, dualOverlap: true, crossBias: 0.10, boxCrashBonus: 1 },
    counter: { throughPassBias: 0.10, gkQuickLaunch: true, lineShift: -4, longShotBias: 0.05 },
    park_bus: { lineShift: -6, gkQuickLaunch: true, staminaDrainMul: 0.82 },
    balanced: { boxCrashBonus: 1, longShotBias: 0.06, throughPassBias: 0.05, overlapDepthBonus: 4, staminaDrainMul: 0.88 },
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
    for (const f of FORMATION_POOL)
        byFormation[f] = emptyBucket();
    for (const s of STYLE_POOL)
        byStyle[s] = emptyBucket();
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
        const m1 = Math.random() < 0.35 ? FULL_MODS_BY_STYLE[s1] : undefined;
        const m2 = Math.random() < 0.35 ? FULL_MODS_BY_STYLE[s2] : undefined;
        const res = new MatchEngine_1.MatchEngine(makeTeam('Home', f1, s1, ca1, m1), makeTeam('Away', f2, s2, ca2, m2)).simulateMatch();
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
            if (my.goals > opp.goals)
                b.wins++;
            else if (my.goals === opp.goals)
                b.draws++;
            else
                b.losses++;
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
    // A/B 镜像对照：同阵型同风格同 CA 73，主队带满级技能网 TacticalMods vs 客队无 TacticalMods
    let abModWins = 0, abDraws = 0, abBaseWins = 0;
    let abModXG = 0, abBaseXG = 0;
    let abModShots = 0, abBaseShots = 0;
    let abModPasses = 0, abBasePasses = 0;
    let abModPoss = 0;
    for (let i = 0; i < AB_N; i++) {
        const f = FORMATION_POOL[i % FORMATION_POOL.length];
        const s = STYLE_POOL[i % STYLE_POOL.length];
        const res = new MatchEngine_1.MatchEngine(makeTeam('ModTeam', f, s, 73, FULL_MODS_BY_STYLE[s]), makeTeam('BaseTeam', f, s, 73, undefined)).simulateMatch();
        const h = res.stats.home;
        const a = res.stats.away;
        if (h.goals > a.goals)
            abModWins++;
        else if (h.goals === a.goals)
            abDraws++;
        else
            abBaseWins++;
        abModXG += h.xG;
        abBaseXG += a.xG;
        abModShots += h.shots;
        abBaseShots += a.shots;
        abModPasses += h.passes;
        abBasePasses += a.passes;
        abModPoss += h.possessionPct;
    }
    const ms = Date.now() - t0;
    console.log(`================ ${N + AB_N} 场大规模仿真矩阵报告 (${ms}ms, ${(ms / (N + AB_N)).toFixed(2)}ms/场) ================`);
    console.log(`全局均值: 场均总进球 ${(totalGoals / N).toFixed(2)} | 单队射门 ${(totalShots / (2 * N)).toFixed(1)} (射正率 ${((totalOnTarget / totalShots) * 100).toFixed(1)}%) | 单队传球 ${(totalPasses / (2 * N)).toFixed(0)} (${((totalPassesOk / totalPasses) * 100).toFixed(1)}%) | 控球极值 ${minPoss}%~${maxPoss}%`);
    console.log('\n--- 16 阵型分布 (场次 / 胜率 / 场均进失球 / 控球率) ---');
    for (const f of FORMATION_POOL) {
        const b = byFormation[f];
        const wr = ((b.wins / b.matches) * 100).toFixed(1);
        console.log(`${f.padEnd(10)} n=${String(b.matches).padEnd(4)} 胜率=${wr.padStart(5)}%  进=${(b.gf / b.matches).toFixed(2)} 失=${(b.ga / b.matches).toFixed(2)}  控球=${(b.possSum / b.matches).toFixed(1)}%`);
    }
    console.log('\n--- 6 战术风格踢法差异 (场次 / 胜率 / 场均进失 / 传球 / 射门 / 抢断 / 控球) ---');
    for (const s of STYLE_POOL) {
        const b = byStyle[s];
        const wr = ((b.wins / b.matches) * 100).toFixed(1);
        console.log(`${s.padEnd(12)} n=${String(b.matches).padEnd(4)} 胜率=${wr.padStart(5)}%  进=${(b.gf / b.matches).toFixed(2)} 失=${(b.ga / b.matches).toFixed(2)}  传=${(b.passes / b.matches).toFixed(0)} 射=${(b.shots / b.matches).toFixed(1)} 抢=${(b.tackles / b.matches).toFixed(1)} 控=${(b.possSum / b.matches).toFixed(1)}%`);
    }
    console.log(`\n--- ${AB_N} 场镜像 A/B 对照 (同阵型/同风格/同CA73：满 TacticalMods vs 零 Mods) ---`);
    console.log(`战绩: Mods胜 ${abModWins} (${((abModWins / AB_N) * 100).toFixed(1)}%) | 平 ${abDraws} | 零Mods胜 ${abBaseWins} (${((abBaseWins / AB_N) * 100).toFixed(1)}%)`);
    console.log(`过程对比: xG ${(abModXG / AB_N).toFixed(2)} vs ${(abBaseXG / AB_N).toFixed(2)} | 射门 ${(abModShots / AB_N).toFixed(1)} vs ${(abBaseShots / AB_N).toFixed(1)} | 传球 ${(abModPasses / AB_N).toFixed(0)} vs ${(abBasePasses / AB_N).toFixed(0)} | 控球 ${(abModPoss / AB_N).toFixed(1)}%`);
    console.log('================================================================================');
}
runMatrix();
