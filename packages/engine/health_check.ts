/**
 * 引擎回归健康检查脚本（5 条硬不变量）
 * 每次修改引擎或战术参数后运行，确保不出现牵一发动全身的退化
 */

import { LeagueManager } from '../core/src/LeagueManager';
import { getOffsideLineX } from './src/evaluator';
import { FormationName, TacticalStyle } from './src/types';

function checkStyle(formation: FormationName, style: TacticalStyle, matches = 20) {
  const lm = new LeagueManager();
  lm.startNewSeason({ formation, style });
  lm.autoCompleteDraft();

  let goals = 0;
  let shots = 0;
  let offsides = 0;
  let attTicks = 0;
  let offsideTicks = 0;
  let minFit90 = 100;
  let stGoals = 0;
  let otherGoals = 0;

  for (let i = 0; i < matches; i++) {
    const engine = lm.createUserMatchEngine();
    let st = engine.getState();
    while (st.phase !== 'full_time') {
      st = engine.step();
      if (st.tick % 10 === 0) {
        const dir = st.homeAttackDir;
        const offX = getOffsideLineX('home', dir, st.players);
        const limitX = dir === 1 ? Math.max(offX, st.ball.pos.x) : Math.min(offX, st.ball.pos.x);
        for (const p of st.players) {
          if (p.team === 'home' && !p.redCard && (p.role === 'ST' || p.role === 'LW' || p.role === 'RW' || p.role === 'CAM')) {
            attTicks++;
            if ((dir === 1 && p.pos.x > limitX + 0.5) || (dir === -1 && p.pos.x < limitX - 0.5)) {
              offsideTicks++;
            }
          }
        }
      }
    }
    goals += st.homeScore + st.awayScore;
    shots += st.stats.home.shots + st.stats.away.shots;
    offsides += st.stats.home.offsides + st.stats.away.offsides;
    for (const p of st.players) {
      if (p.team === 'home') {
        if (p.fitness < minFit90) minFit90 = p.fitness;
        if (p.role === 'ST') stGoals += p.matchStats.goals;
        else otherGoals += p.matchStats.goals;
      }
    }
  }

  const avgGoals = goals / matches;
  const offPct = (offsideTicks / Math.max(1, attTicks)) * 100;
  const stShare = (stGoals / Math.max(1, stGoals + otherGoals)) * 100;
  const ok = avgGoals >= 1.2 && avgGoals <= 4.0 && offPct < 3.0 && minFit90 >= 20;
  console.log(
    `[${ok ? 'PASS' : 'WARN'}] ${formation}/${style}: 场均进球=${avgGoals.toFixed(2)}, 场均射门=${(shots / matches).toFixed(1)}, 越位占比=${offPct.toFixed(1)}%, ST进球占比=${stShare.toFixed(0)}%, 90'最低体能=${minFit90.toFixed(0)}%`
  );
  return ok;
}

const results = [
  checkStyle('4-2-3-1', 'gegenpress', 20),
  checkStyle('4-3-3', 'tiki_taka', 20),
  checkStyle('4-3-3', 'wing_play', 20),
  checkStyle('4-4-2', 'balanced', 20),
  checkStyle('5-3-2', 'park_bus', 20),
];

if (results.every(Boolean)) {
  console.log('ALL ENGINE INVARIANTS PASSED');
} else {
  process.exitCode = 1;
}
