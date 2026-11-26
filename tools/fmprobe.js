/**
 * fmprobe —— 「再开一局」线上版 Canvas 界面文字探针（累积缓冲版）
 * 注入页面后可用：
 *   window.__buf     -> 累积的所有文字 {t,x,y}
 *   window.__clear() -> 清空累积缓冲
 *   window.__scene() -> 去重后的全部文字（对象数组）
 *   window.__find(kw)-> 命中关键词的文字
 */
(function () {
  if (window.__probeInstalledV2) return;
  window.__probeInstalledV2 = true;

  window.__buf = [];
  const orig = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, m) {
    if (t && typeof t === 'string' && t.trim()) {
      window.__buf.push({ t: String(t).slice(0, 60), x: Math.round(x), y: Math.round(y) });
    }
    return orig.apply(this, arguments);
  };

  window.__clear = function () {
    window.__buf.length = 0;
    return window.__buf.length;
  };

  /** 去重（同文同坐标只保留一条），保持绘制顺序 */
  window.__uniq = function (arr) {
    const seen = new Set();
    const out = [];
    for (const o of arr) {
      const k = o.t + '@' + o.x + ',' + o.y;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(o);
    }
    return out;
  };

  window.__scene = function () {
    return window.__uniq(window.__buf);
  };

  window.__find = function (kw) {
    const re = new RegExp(kw, 'i');
    return window.__uniq(window.__buf).filter((o) => re.test(o.t));
  };
})();
