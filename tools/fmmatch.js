/**
 * fmmatch —— 「再开一局」实时比赛状态读取器（页面内）
 * 只关心比赛相关的文字：比分/分钟/事件/数据/手牌/能量/提示
 */
(function () {
  if (window.__m) return;
  window.__m = true;

  const txt = () => (window.__scene ? window.__scene() : []);
  const uniq = (arr) => {
    const seen = new Set();
    const out = [];
    for (const o of arr) {
      if (seen.has(o.t)) continue;
      seen.add(o.t);
      out.push(o);
    }
    return out;
  };

  /** 只取最后一帧（去重后取最近的同文本） */
  window.__m = {
    all: txt,

    /** 关键指标：比分/分钟/控球/射门/xG 等 */
    key() {
      const t = uniq(txt());
      const re = /(\d+\s*[:：]\s*\d+)|(\d+'\s)|(分钟|控球|射门|xG|传球成功率|抢断|拦截|扑救|角球|犯规|能量|换人|子弹|战术|红牌|黄牌|GOAL|进球|中场|上半场|下半场|完场|结束)/i;
      return t.filter((o) => re.test(o.t)).map((o) => ({ x: o.x, y: o.y, t: o.t }));
    },

    /** 事件流（直播区） */
    events() {
      const t = uniq(txt());
      return t
        .filter((o) => o.x > 700 && o.x < 1180 && o.y > 300 && o.y < 560)
        .map((o) => o.t);
    },

    /** 手牌区 */
    cards() {
      const t = uniq(txt());
      return t.filter((o) => o.y > 500).map((o) => ({ x: o.x, y: o.y, t: o.t }));
    },

    /** 顶部分数板 */
    scoreboard() {
      const t = uniq(txt());
      return t.filter((o) => o.y < 120).map((o) => ({ x: o.x, y: o.y, t: o.t }));
    },
  };
})();
