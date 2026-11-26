/**
 * fmplay —— 「再开一局」线上试玩自动化脚本（浏览器内注入）
 *
 * 依赖页面已注入 window.__scene() / window.__find()（Canvas 文字探针）。
 * 提供：
 *   __clickText(txt)      点击包含指定文字的元素
 *   __clickAt(x, y)       按设计坐标点击
 *   __dump()              输出当前界面所有文字
 *   __has(txt)            判断界面是否存在某文字
 */
(function () {
  if (window.__fmplay) return;
  window.__fmplay = true;

  const canvas = () => document.getElementById('gameCanvas');

  function designToClient(x, y) {
    const c = canvas();
    const r = c.getBoundingClientRect();
    return { x: r.left + (x / 1280) * r.width, y: r.top + (y / 720) * r.height };
  }

  function clickDesign(x, y) {
    const c = canvas();
    const p = designToClient(x, y);
    const opts = { clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1, isPrimary: true };
    c.dispatchEvent(new PointerEvent('pointermove', opts));
    c.dispatchEvent(new PointerEvent('pointerdown', opts));
    c.dispatchEvent(new PointerEvent('pointerup', opts));
    return p;
  }

  /** 读取当前界面文字（含坐标） */
  window.__dump = function () {
    return (window.__scene ? window.__scene() : []).map((o) => ({ y: o.y, x: o.x, t: o.t }));
  };

  window.__has = function (txt) {
    const re = new RegExp(txt, 'i');
    return (window.__scene ? window.__scene() : []).some((o) => re.test(o.t));
  };

  /**
   * 点击文字匹配项。优先点文本自身的中心，若文本是按钮标题则点击其包围盒中心。
   * offset: {dx, dy} 可微调
   */
  window.__clickText = function (txt, nth, offset) {
    const re = new RegExp(txt, 'i');
    const hits = (window.__scene ? window.__scene() : []).filter((o) => re.test(o.t));
    if (!hits.length) return { ok: false, reason: 'not-found', txt };
    const i = nth || 0;
    if (i >= hits.length) return { ok: false, reason: 'nth-out-of-range', count: hits.length };
    const h = hits[i];
    const dx = offset && offset.dx ? offset.dx : 0;
    const dy = offset && offset.dy ? offset.dy : 0;
    // 文本通常左对齐或居中：dx 按估算字宽一半修正
    const approxW = h.t.length * 7;
    const anchor = h.x < 640 ? h.x + approxW / 2 : h.x;
    clickDesign(anchor + dx, h.y + dy);
    return { ok: true, clicked: h.t, at: [Math.round(anchor + dx), h.y + dy], nth: i, total: hits.length };
  };

  window.__clickAt = function (x, y) {
    const p = clickDesign(x, y);
    return { ok: true, at: [Math.round(p.x), Math.round(p.y)] };
  };

  /** 读取某个坐标周围的文字（用于校准点击位置） */
  window.__near = function (x, y, r) {
    const rad = r || 60;
    return (window.__scene ? window.__scene() : [])
      .filter((o) => Math.abs(o.x - x) <= rad && Math.abs(o.y - y) <= rad)
      .map((o) => `${o.y}|${o.x}|${o.t}`);
  };
})();
