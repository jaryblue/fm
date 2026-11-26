/**
 * fmdraft —— 自动完成「核心开包」选秀（3 包 5 选 3）
 * 用法: __autoDraft()
 */
(function () {
  if (window.__autoDraft) return;
  window.__autoDraft = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = () => (window.__scene ? window.__scene() : []);
  const find = (re) => txt().filter((o) => re.test(o.t));

  window.__autoDraft = async function (maxRounds) {
    const log = [];
    const limit = maxRounds || 40;
    for (let i = 0; i < limit; i++) {
      await sleep(700);
      const t = txt();

      // 1) 有包可撕
      const rip = find(/撕开.*包 ▶/);
      if (rip.length) {
        window.__clickAt(rip[0].x, rip[0].y);
        log.push(`rip@${i}: ${rip[0].t}`);
        await sleep(2600);
        continue;
      }

      // 2) 有卡片可选
      const sel = find(/选择入队/);
      if (sel.length >= 3) {
        // 选前 3 张
        for (let k = 0; k < 3; k++) window.__clickAt(sel[k].x, sel[k].y);
        log.push(`select@${i}: ${sel.length} cards`);
        await sleep(900);
        continue;
      }

      // 3) 确认入队
      const conf = find(/签入这 \d 人进入下一包|确认签入|进入下一包/);
      if (conf.length) {
        window.__clickAt(conf[0].x, conf[0].y);
        log.push(`confirm@${i}: ${conf[0].t}`);
        await sleep(1400);
        continue;
      }

      // 4) 完成选秀 → 进入夏窗
      const done = find(/进入夏窗|夏窗|开始补强|完成开包/);
      if (done.length) {
        log.push(`done-screen@${i}: ${done.map((d) => d.t).join(' / ')}`);
        return { log, state: 'draft-complete', screen: done };
      }

      log.push(`idle@${i}`);
    }
    return { log, state: 'max-rounds' };
  };
})();
