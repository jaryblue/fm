/**
 * fmdriver —— 「再开一局」试玩驱动脚本（页面内）
 * 使用 window.__nativeClick(x, y) —— 由 bash 侧通过 playwright-cli mousemove/mousedown/mouseup 执行真实点击。
 * 页面内仅负责「找坐标」，避免合成 PointerEvent 不可靠的问题。
 */
(function () {
  if (window.__fmdriver) return;
  window.__fmdriver = true;

  const txt = () => (window.__scene ? window.__scene() : []);
  const find = (re) => txt().filter((o) => re.test(o.t));

  window.__fmdriver = {
    scene: txt,
    find,

    /** 找到第一个匹配文本的中心（居中文本估算字宽） */
    centerOf(re, nth) {
      const hits = find(re);
      if (!hits.length) return null;
      const h = hits[nth || 0];
      const w = h.t.length * 7;
      const x = h.x < 640 ? h.x + w / 2 : h.x;
      return { x: Math.round(x), y: Math.round(h.y), text: h.t };
    },

    /** 列出所有匹配项 */
    list(re) {
      return find(re).map((o) => ({ x: o.x, y: o.y, t: o.t }));
    },

    /** 一步决策：返回下一��该点哪里 */
    next() {
      const t = txt();
      // 选秀确认
      const conf = t.find((o) => /签入这 \d 人/.test(o.t));
      if (conf) return { act: 'click', x: conf.x, y: conf.y, label: conf.t };
      // 选秀卡
      const sel = t.filter((o) => /选择入队/.test(o.t));
      if (sel.length >= 3) {
        const s = sel[0];
        return { act: 'click', x: s.x, y: s.y, label: 'select-card' };
      }
      // 撕包
      const rip = t.find((o) => /撕开.*包 ▶/.test(o.t));
      if (rip) return { act: 'click', x: rip.x, y: rip.y, label: rip.t };
      return { act: 'wait', label: 'no-action' };
    },
  };
})();
