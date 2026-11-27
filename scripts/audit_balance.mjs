import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const isQuick = process.argv.includes('--quick');

const WORKER_TS = `
import { MatchEngine } from './packages/engine/src/MatchEngine';
import { FORMATIONS } from './packages/engine/src/formations';
import { LeagueManager } from './packages/core/src/LeagueManager';
import {
  V6_ACTIVE_SKILLS,
  V6_ALL_PASSIVES,
  V6_DIRECTIVES,
  V6_FUSION_KEYSTONES,
  V6_MASTERY_SEALS,
  V6_STYLE_PASSIVES,
  V6_SYSTEM_PASSIVES,
  compileAstrolabeToMatchSetup,
  compileDirectiveToEffect,
  createDefaultAstrolabeState,
  createEmptySeasonRogueState,
} from './packages/core/src/v6';
import type { CommandCardEffect, FormationName, PlayerAttributes, PlayerInput, PlayerRole, TacticalStyle, TeamSetup } from './packages/engine/src/types';

function makeAttrs(role: PlayerRole, baseCA = 72): PlayerAttributes {
  const clampA = (v: number) => Math.max(30, Math.min(99, v));
  const isGK = role === 'GK';
  const isDef = ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(role);
  const isAtt = ['ST', 'LW', 'RW', 'CAM'].includes(role);
  return {
    passing: clampA(baseCA + (isDef ? -2 : 4)),
    shooting: clampA(baseCA + (isAtt ? 8 : isDef ? -15 : -2)),
    dribbling: clampA(baseCA + (isAtt ? 6 : isDef ? -8 : 3)),
    pace: clampA(baseCA + (['LW', 'RW', 'LB', 'RB', 'LWB', 'RWB'].includes(role) ? 7 : 0)),
    strength: clampA(baseCA + (['CB', 'ST', 'CDM'].includes(role) ? 6 : -3)),
    defending: clampA(baseCA + (isDef ? 10 : isAtt ? -25 : -4)),
    positioning: clampA(baseCA),
    composure: clampA(baseCA),
    stamina: clampA(baseCA + 5),
    goalkeeping: clampA(isGK ? baseCA + 8 : 25),
  };
}

function makeTeam(name: string, formation: FormationName, style: TacticalStyle, baseCA = 72, fit = 100): TeamSetup {
  const slots = FORMATIONS[formation];
  const players: PlayerInput[] = slots.map((s, idx) => ({
    id: name + '_' + idx,
    name: name + '-' + s.role + (idx + 1),
    role: s.role,
    shirtNumber: idx + 1,
    attributes: makeAttrs(s.role, baseCA),
    fitness: fit,
  }));
  return { name, formation, style, players, teamFamiliarityAvg: 78, teamChemistryAvg: 70 };
}

export function runStaticChecks(engineSource: string) {
  const deadTags: string[] = [];
  const badDirectives: string[] = [];
  const tags = new Set<string>();
  const actions = new Set<string>();
  for (const sk of V6_ACTIVE_SKILLS) {
    tags.add(sk.branchA.tag);
    tags.add(sk.branchB.tag);
    actions.add(sk.instantAction);
  }
  for (const t of tags) {
    if (!engineSource.includes("'" + t + "'")) deadTags.push(t);
  }
  for (const a of actions) {
    if (!engineSource.includes("'" + a + "'")) deadTags.push(a);
  }
  for (const d of V6_DIRECTIVES) {
    const tm = d.baseEffect.tacticalMod;
    if (tm?.tempoMul !== undefined && tm.tempoMul < 0.88) badDirectives.push(d.id + ':tempoMul=' + tm.tempoMul);
    if (tm?.shortPassBias !== undefined && tm.shortPassBias < -0.12) badDirectives.push(d.id + ':shortPass=' + tm.shortPassBias);
  }
  return {
    totalSkills: V6_ACTIVE_SKILLS.length,
    totalDirectives: V6_DIRECTIVES.length,
    totalPassives: V6_ALL_PASSIVES.length,
    deadTags,
    badDirectives,
  };
}

export function runAiSymmetryCheck() {
  const mgr = new LeagueManager();
  mgr.markPrologueCompleted();
  mgr.startNewSeason({ clubId: 'club_star', customName: '平衡测试队', formation: '4-3-3', style: 'gegenpress' });
  mgr.autoCompleteDraft();
  mgr.confirmInitialDraft();
  let rounds = 0, aiSubsSample = 0, aiStrainEver = 0, nanCount = 0;
  for (let r = 0; r < 9; r++) {
    const st = mgr.getState();
    if (st.phase === 'SEASON_END') break;
    if (st.phase === 'WINTER_WINDOW') (mgr as any).closeWinterWindow?.();
    const fx = mgr.getUserCurrentFixture();
    if (!fx) break;
    const uClub = mgr.getUserClub();
    if (r === 2) {
      const eng = mgr.createUserMatchEngine();
      const mr = eng.simulateMatch();
      aiSubsSample = mr.homeName === uClub.name ? mr.awaySubsUsed : mr.homeSubsUsed;
    }
    const out = mgr.simulateUserRound();
    if (!out.ok) break;
    rounds++;
    for (const c of st.clubs) {
      for (const p of c.squad) {
        if (!Number.isFinite(p.ca) || !Number.isFinite(p.fitness ?? 100)) nanCount++;
        if (!c.isUser && p.strainWarning) aiStrainEver++;
      }
    }
    const rw = mgr.getState().pendingPostMatchReward;
    if (rw && !rw.completed) {
      mgr.pickPostMatchRewardCategory(rw.categories[0]);
      const rw2 = mgr.getState().pendingPostMatchReward;
      if (rw2?.options?.[0]) {
        const a = mgr.applyPostMatchRewardOption(rw2.options[0].id);
        if (a.needsTarget && uClub.squad[0]) mgr.applyPostMatchRewardOption(rw2.options[0].id, uClub.squad[0].id);
      }
    }
  }
  return { rounds, aiSubsSample, aiStrain: aiStrainEver, nanCount };
}

export function getCatalogInfo() {
  return {
    formations: Object.keys(FORMATIONS) as FormationName[],
    styles: ['balanced', 'tiki_taka', 'gegenpress', 'counter', 'wing_play', 'park_bus'] as TacticalStyle[],
  };
}

export interface JobSpec {
  group: 'ecology' | 'fatigue' | 'formation' | 'style' | 'stage';
  key: string;
  n: number;
  formation: FormationName;
  style: TacticalStyle;
  stage?: 'none' | 'early' | 'mid' | 'late';
  startFit?: number;
}

export function runJob(job: JobSpec) {
  let wins = 0, draws = 0, gf = 0, ga = 0, shots = 0, injuries = 0;
  let fb4Pass = 0, fb4Cnt = 0, fb3Pass = 0, fb3Cnt = 0, stGoals = 0, hatTricks = 0;
  let fit90Sum = 0, fit90Cnt = 0;
  let firstHalfTrig = 0, secondHalfTrig = 0;
  const shotPats: Record<string, number> = {};
  const goalPats: Record<string, number> = {};
  const STYLES: TacticalStyle[] = ['balanced', 'tiki_taka', 'gegenpress', 'counter', 'wing_play', 'park_bus'];
  const FORMS: FormationName[] = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '5-3-2', '3-4-3'];

  for (let i = 0; i < job.n; i++) {
    const hForm = job.group === 'ecology' ? FORMS[Math.floor(i / 6) % FORMS.length] : job.formation;
    const hStyle = job.group === 'ecology' ? STYLES[i % STYLES.length] : job.style;
    const aForm = job.group === 'ecology' ? FORMS[(Math.floor(i / 6) + 1) % FORMS.length] : '4-3-3';
    const aStyle = job.group === 'ecology' ? STYLES[(i + 2) % STYLES.length] : 'balanced';

    const home = makeTeam('Home', hForm, hStyle, 72, job.startFit ?? 100);
    const away = makeTeam('Away', aForm, aStyle, 72, 100);
    const scheduled: Array<{ min: number; effect: CommandCardEffect }> = [];

    if (job.stage && job.stage !== 'none') {
      const ast = createDefaultAstrolabeState();
      ast.unlockedPassives = [];
      ast.unlockedDirectives = [];
      ast.unlockedSkills = [];
      ast.equippedSkills = [];
      ast.unlockedFusions = [];
      ast.unlockedMasterySeals = [];
      ast.unlockedFormations = [hForm];
      ast.unlockedStyles = [hStyle];
      const rogue = createEmptySeasonRogueState();
      const stylePassives = V6_STYLE_PASSIVES.filter(p => p.style === hStyle);
      const sysKey = hForm.startsWith('5') ? '5-back' : hForm.startsWith('3') ? '3-back' : '4-back';
      const sysPassives = V6_SYSTEM_PASSIVES.filter(p => p.system === sysKey);
      const styleDirs = V6_DIRECTIVES.filter(d => d.source === 'style' && d.style === hStyle);
      const styleSkills = V6_ACTIVE_SKILLS.filter(s => s.source === 'style' && s.style === hStyle);
      const mins = [1, 22, 47, 72];

      if (job.stage === 'early') {
        ast.unlockedPassives = stylePassives.slice(0, 2).map(p => p.id);
        styleDirs.filter(d => d.route === 'steady').slice(0, 2).forEach((d, idx) => {
          const eff = compileDirectiveToEffect(d.id, ast, hStyle, hForm, rogue);
          if (eff) scheduled.push({ min: mins[idx], effect: eff });
        });
        ast.equippedSkills = styleSkills.slice(0, 1).map(s => s.id);
      } else if (job.stage === 'mid') {
        ast.unlockedPassives = [...stylePassives.slice(0, 5).map(p => p.id), ...sysPassives.slice(0, 2).map(p => p.id)];
        rogue.seasonRelics = ['rich_budget', 'comeback_gene'];
        styleDirs.filter(d => d.route === 'steady').slice(0, 4).forEach((d, idx) => {
          ast.directiveSatellites[d.id] = ['A'];
          const eff = compileDirectiveToEffect(d.id, ast, hStyle, hForm, rogue);
          if (eff) scheduled.push({ min: mins[idx], effect: eff });
        });
        ast.equippedSkills = styleSkills.slice(0, 3).map(s => s.id);
      } else if (job.stage === 'late') {
        ast.unlockedPassives = [...stylePassives.map(p => p.id), ...sysPassives.map(p => p.id)];
        const fusion = V6_FUSION_KEYSTONES.find(f => f.system === sysKey && f.style === hStyle);
        if (fusion) { ast.unlockedFusions = [fusion.id]; ast.fusionBranchChoice[fusion.id] = 'A'; }
        const seal = V6_MASTERY_SEALS.find(m => m.style === hStyle);
        if (seal) ast.unlockedMasterySeals = [seal.id];
        rogue.seasonRelics = ['rich_budget', 'hairdryer', 'comeback_gene', 'clutch_clock'];
        const dirs = [...styleDirs.filter(d => d.route === 'steady').slice(0, 3), ...styleDirs.filter(d => d.route === 'gamble').slice(0, 1)];
        dirs.forEach((d, idx) => {
          ast.directiveSatellites[d.id] = idx === 0 ? ['A', 'B', 'C'] : ['A', 'B'];
          if (idx === 0) rogue.overclockedDirectives.push(d.id);
          const eff = compileDirectiveToEffect(d.id, ast, hStyle, hForm, rogue);
          if (eff) scheduled.push({ min: mins[idx], effect: eff });
        });
        ast.equippedSkills = [...styleSkills.slice(0, 3).map(s => s.id), ...(seal ? [seal.activeSkillId] : [])].slice(0, 4);
      }
      ast.unlockedSkills = [...ast.equippedSkills];
      const setup = compileAstrolabeToMatchSetup(ast, hForm, hStyle, rogue);
      Object.assign(home, {
        tacticalMods: setup.tacticalMods, v6PassiveHooks: setup.passiveHooks,
        v6ImmunityFlags: setup.immunityFlags, v6StartingShields: setup.startingShields,
        v6MaxCounterStacks: setup.maxCounterStacks, v6SkillTempRankBonus: setup.skillTempRankBonus,
        v6SkillDualBranch: setup.skillDualBranch, equippedSkills: setup.equippedSkills,
      });
    }

    const engine = new MatchEngine(home, away);
    let dIdx = 0;
    while (engine.getState().phase !== 'full_time') {
      const st = engine.getState();
      while (dIdx < scheduled.length && st.minute >= scheduled[dIdx].min) {
        engine.applyCommandCard('home', scheduled[dIdx].effect);
        dIdx++;
      }
      if (st.activeSkillPrompt) {
        const res = engine.triggerActiveSkill('home', st.activeSkillPrompt.skillId);
        if (res.ok) {
          if (st.minute < 46) firstHalfTrig++;
          else secondHalfTrig++;
        }
      }
      engine.step();
    }

    const fin = engine.getState();
    if (fin.homeScore > fin.awayScore) wins++;
    else if (fin.homeScore === fin.awayScore) draws++;
    gf += fin.homeScore; ga += fin.awayScore;
    shots += fin.stats.home.shots + fin.stats.away.shots;

    for (const ev of fin.events) if ((ev.type as string) === 'injury') injuries++;
    for (const side of ['home', 'away'] as const) {
      const sp = fin.stats[side].attackShotPatterns ?? {};
      for (const [k, v] of Object.entries(sp)) shotPats[k] = (shotPats[k] ?? 0) + v;
      const gp = fin.stats[side].attackGoalPatterns ?? {};
      for (const [k, v] of Object.entries(gp)) goalPats[k] = (goalPats[k] ?? 0) + v;
    }

    let matchHat = false;
    for (const p of fin.players) {
      if (p.matchStats.goals >= 3) matchHat = true;
      if (p.role !== 'GK') { fit90Sum += p.fitness; fit90Cnt++; }
      const fSys = (p.team === 'home' ? hForm : aForm).startsWith('3-') ? '3' : (p.team === 'home' ? hForm : aForm).startsWith('4-') ? '4' : '5';
      if (['LB', 'RB'].includes(p.role) && fSys === '4') { fb4Pass += p.matchStats.passes; fb4Cnt++; }
      if (['LWB', 'RWB'].includes(p.role) && fSys === '3') { fb3Pass += p.matchStats.passes; fb3Cnt++; }
      if (p.role === 'ST') stGoals += p.matchStats.goals;
    }
    if (matchHat) hatTricks++;
  }

  const totG = Math.max(1, gf + ga);
  const totGP = Math.max(1, Object.values(goalPats).reduce((a, b) => a + b, 0));
  const pct = (n: number, d: number) => +(n / Math.max(1, d) * 100).toFixed(1);

  return {
    group: job.group,
    key: job.key,
    formation: job.formation,
    style: job.style,
    stage: job.stage ?? 'none',
    n: job.n,
    winPct: pct(wins, job.n),
    ppg: +((wins * 3 + draws) / job.n).toFixed(2),
    avgTotalGoals: +((gf + ga) / job.n).toFixed(2),
    avgTotalShots: +(shots / job.n).toFixed(1),
    fit90: +(fit90Sum / Math.max(1, fit90Cnt)).toFixed(1),
    injPerMatch: +(injuries / job.n).toFixed(2),
    fb4Pass: +(fb4Pass / Math.max(1, fb4Cnt)).toFixed(1),
    fb3Pass: +(fb3Pass / Math.max(1, fb3Cnt)).toFixed(1),
    stGoalPct: pct(stGoals, totG),
    hatTrickPct: pct(hatTricks, job.n),
    wingGoalPct: pct((goalPats.byline_cross ?? 0) + (goalPats.early_cross ?? 0) + (goalPats.cutback ?? 0), totGP),
    setPenGoalPct: pct((goalPats.set_piece ?? 0) + (goalPats.penalty ?? 0), totGP),
    secondHalfSkillPct: pct(secondHalfTrig, firstHalfTrig + secondHalfTrig),
  };
}
`;

if (isMainThread) {
  const { buildSync } = require(path.join(ROOT, 'node_modules/esbuild'));
  const res = buildSync({ stdin: { contents: WORKER_TS, resolveDir: ROOT, loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false });
  const code = res.outputFiles[0].text;
  const modExports = {};
  const modObj = { exports: modExports };
  new Function('exports', 'require', 'module', code)(modExports, require, modObj);
  const { runStaticChecks, runAiSymmetryCheck, getCatalogInfo } = modObj.exports;

  const engineSrc = fs.readFileSync(path.join(ROOT, 'packages/engine/src/MatchEngine.ts'), 'utf8');
  const staticRes = runStaticChecks(engineSrc);
  const aiSym = runAiSymmetryCheck();
  const { formations, styles } = getCatalogInfo();

  const jobs = [];
  jobs.push({ group: 'ecology', key: 'ECO|360', n: isQuick ? 90 : 300, formation: '4-3-3', style: 'balanced' });
  jobs.push({ group: 'fatigue', key: 'FAT|60', n: isQuick ? 40 : 100, formation: '4-3-3', style: 'balanced', startFit: 60 });
  if (!isQuick) {
    for (const f of formations) jobs.push({ group: 'formation', key: `F|${f}`, n: 36, formation: f, style: 'balanced' });
    for (const s of styles) jobs.push({ group: 'style', key: `S|${s}`, n: 60, formation: '4-3-3', style: s });
  }
  for (const s of styles) {
    const form = s === 'park_bus' ? '5-3-2' : s === 'gegenpress' ? '4-2-3-1' : '4-3-3';
    jobs.push({ group: 'stage', key: `G|${s}|early`, n: isQuick ? 24 : 50, formation: form, style: s, stage: 'early' });
    if (!isQuick) jobs.push({ group: 'stage', key: `G|${s}|mid`, n: 50, formation: form, style: s, stage: 'mid' });
    jobs.push({ group: 'stage', key: `G|${s}|late`, n: isQuick ? 24 : 50, formation: form, style: s, stage: 'late' });
  }

  const totalMatches = jobs.reduce((s, j) => s + j.n, 0);
  const numWorkers = Math.min(8, os.cpus().length);
  console.log(`\n=== FM-League V6 自动化平衡性测试 (${isQuick ? 'QUICK' : 'FULL'} 模式: ${totalMatches} 场 / ${numWorkers} 线程) ===`);
  const t0 = Date.now();
  let nextIdx = 0;
  const results = new Array(jobs.length);

  await Promise.all(
    Array.from({ length: numWorkers }, () => new Promise((resolve, reject) => {
      const w = new Worker(new URL(import.meta.url), { workerData: { code } });
      w.on('message', (msg) => {
        if (msg.idx !== undefined) results[msg.idx] = msg.res;
        if (nextIdx < jobs.length) { const idx = nextIdx++; w.postMessage({ idx, job: jobs[idx] }); }
        else w.postMessage({ done: true });
      });
      w.on('exit', () => resolve());
      w.on('error', reject);
      const idx = nextIdx++;
      if (idx < jobs.length) w.postMessage({ idx, job: jobs[idx] });
      else w.postMessage({ done: true });
    }))
  );

  console.log(`耗时: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const checks = [];
  const check = (name, ok, detail, warnOnly = false) => {
    const status = ok ? 'PASS' : warnOnly ? 'WARN' : 'FAIL';
    checks.push({ name, status, detail });
    console.log(`[${status}] ${name}: ${detail}`);
  };

  check('1.静态接线', staticRes.deadTags.length === 0, `技能=${staticRes.totalSkills}, 指令=${staticRes.totalDirectives}, 被动=${staticRes.totalPassives}, 未接线=${staticRes.deadTags.length}`);
  check('2.指令红线', staticRes.badDirectives.length === 0, `极端负收益参数=${staticRes.badDirectives.length}`);
  check('3.AI对称性', aiSym.aiSubsSample >= 2 && aiSym.aiStrain > 0 && aiSym.nanCount === 0, `9轮AI换人=${aiSym.aiSubsSample}, AI疲惫=${aiSym.aiStrain}, NaN=${aiSym.nanCount}`);

  const eco = results.find(r => r.key === 'ECO|360');
  check('4.场均进球', eco.avgTotalGoals >= 2.2 && eco.avgTotalGoals <= 3.3, `场均总进球=${eco.avgTotalGoals}`);
  check('5.体能分布', eco.fit90 >= 58 && eco.fit90 <= 74, `90'非门将均体=${eco.fit90}%`);
  check('6.赛中伤病', eco.injPerMatch >= 0.12 && eco.injPerMatch <= 0.65, `场均伤病=${eco.injPerMatch}`);
  check('7.边卫参与', eco.fb4Pass >= 4.5 && eco.fb3Pass >= 9.0, `4后卫边卫=${eco.fb4Pass}脚, 3后卫翼卫=${eco.fb3Pass}脚`);
  check('8.进攻多样', eco.wingGoalPct >= 10 && eco.setPenGoalPct >= 6, `边路=${eco.wingGoalPct}%, 定位球+点球=${eco.setPenGoalPct}%`);

  const fat60 = results.find(r => r.key === 'FAT|60');
  check('9.体能曲线', fat60.winPct >= 16 && fat60.winPct <= 36, `60%起手胜率=${fat60.winPct}% (PPG ${fat60.ppg})`);

  for (const s of styles) {
    const e = results.find(r => r.key === `G|${s}|early`);
    const m = results.find(r => r.key === `G|${s}|mid`);
    const l = results.find(r => r.key === `G|${s}|late`);
    const mono = l.ppg > e.ppg && (!m || (m.ppg >= e.ppg - 0.1 && l.ppg >= m.ppg - 0.05));
    check(`10.构筑梯度(${s})`, mono && e.winPct >= 34 && e.winPct <= 60 && l.winPct >= 55 && l.winPct <= 86,
      `前${e.ppg}(${e.winPct}%)${m ? `→中${m.ppg}(${m.winPct}%)` : ''}→后${l.ppg}(${l.winPct}%) | 下半场技=${l.secondHalfSkillPct}%`, true);
  }

  const fails = checks.filter(c => c.status === 'FAIL').length;
  const warns = checks.filter(c => c.status === 'WARN').length;
  console.log(`\n总结: ${checks.length - fails - warns} PASS / ${warns} WARN / ${fails} FAIL`);
  if (fails > 0) process.exit(1);
} else {
  const modExports = {};
  const modObj = { exports: modExports };
  new Function('exports', 'require', 'module', workerData.code)(modExports, require, modObj);
  const { runJob } = modObj.exports;
  parentPort.on('message', (msg) => {
    if (msg.done) process.exit(0);
    parentPort.postMessage({ idx: msg.idx, res: runJob(msg.job) });
  });
}
