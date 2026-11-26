#!/bin/bash
# fmdump —— 导出「再开一局」当前这一帧的屏幕文字（去重，按 y 排序）
# 用法: ./tools/fmdump.sh [session] [yMin] [yMax] [keywordRegex]
# 先清空累积缓冲，再等一帧，确保只读到当前画面而不是历史堆积
set -euo pipefail
SESSION="${1:-m1}"
YMIN="${2:-0}"
YMAX="${3:-720}"
KW="${4:-}"
playwright-cli -s="$SESSION" eval "window.__clear ? window.__clear() : 0" >/dev/null 2>&1
sleep 0.35
playwright-cli -s="$SESSION" eval "(() => {
  const b = window.__buf || [];
  const seen = new Set();
  const out = [];
  for (const o of b) {
    if (o.y < $YMIN || o.y > $YMAX) continue;
    const k = o.t + '@' + o.x + ',' + o.y;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  out.sort((a, b2) => a.y - b2.y || a.x - b2.x);
  const kw = '$KW';
  const re = kw ? new RegExp(kw, 'i') : null;
  return JSON.stringify(re ? out.filter(o => re.test(o.t)) : out);
})()" 2>&1 | sed -n '/### Result/,/### Ran/p'
