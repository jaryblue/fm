/**
 * 全赛季端到端无头测试：
 * 开局 Shuffle Draft -> 7 轮 8 队单循环联赛 -> R2/R4/R6 Re-Draft -> 前 4 季后赛 -> 结算与序列化
 */

import { LeagueManager } from './LeagueManager';

function runFullSeasonTest() {
  const t0 = Date.now();
  const lm = new LeagueManager();

  // 1. 开局交互式挑 2 个 S/A 级核心，再用 autoCompleteDraft 补齐 16 人
  const pool = lm.getState().draft.currentPool;
  lm.pickDraftPlayer(pool[0].id);
  lm.pickDraftPlayer(pool[1].id);
  lm.autoCompleteDraft();

  const club = lm.getUserClub();
  console.log(`1) 选秀完成: ${club.name} (${club.squad.length}人), 首发 ${club.starterIds.length} 人, 剩余预算 ${lm.getState().draft.budgetRemaining}`);

  // 2. 自动打完整个赛季（常规赛 + Re-Draft + 季后赛）
  while (lm.getState().phase !== 'SEASON_END') {
    const st = lm.getState();

    if (st.phase === 'RE_DRAFT' && st.reDraft) {
      // 挑最低 CA 球员换最高 CA 新秀 + 选第 1 张词条卡
      const weakest = [...lm.getUserClub().squad]
        .filter(p => p.role !== 'GK')
        .sort((a, b) => a.ca - b.ca)[0];
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

  // 3. 验证序列化与反序列化还原
  const savedJson = lm.serialize();
  const restored = LeagueManager.deserialize(savedJson);
  const summary = restored.getState().lastSummary!;
  const standings = restored.getStandings();

  console.log(`\n2) 赛季结束! 耗时: ${Date.now() - t0} ms | 存档 JSON 大小: ${(savedJson.length / 1024).toFixed(1)} KB`);
  console.log(`   最终名次: 第 ${summary.finalRank} 名 (常规赛第 ${summary.regularRank} 名, ${summary.points} 分) | 获得 Meta 点数: +${summary.metaPointsEarned}`);
  if (summary.topScorer) {
    console.log(`   联赛金靴: ${summary.topScorer.name} (${summary.topScorer.clubName}) - ${summary.topScorer.goals} 球`);
  }

  console.log('\n3) 常规赛最终积分榜:');
  standings.forEach((row, idx) => {
    const tag = row.isUser ? ' ★' : '';
    console.log(
      `   ${idx + 1}. ${row.clubName.padEnd(6, '　')}${tag} | 赛${row.played} 胜${row.won} 平${row.drawn} 负${row.lost} | 进${row.gf} 失${row.ga} 净${row.gd >= 0 ? '+' + row.gd : row.gd} | ${row.points}分`
    );
  });
}

runFullSeasonTest();
