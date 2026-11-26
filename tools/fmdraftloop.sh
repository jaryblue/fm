#!/bin/bash
# fmdraftloop —— 自动完成「核心开包」3 包选秀（每次选 3 张不同卡）
# 用法: ./tools/fmdraftloop.sh <session> [最大轮数]
set -uo pipefail
SESSION="$1"
MAX="${2:-40}"
cd "$(dirname "$0")/.."

for i in $(seq 1 "$MAX"); do
  playwright-cli -s="$SESSION" eval "() => { window.__buf=[]; return 1; }" >/dev/null 2>&1
  sleep 1.1
  # 输出格式: KIND:X,Y|X,Y|X  (KIND ∈ C/S/R/W/I)
  RAW=$(playwright-cli -s="$SESSION" eval "() => { const t=window.__scene(); const conf=t.find(o=>/签入这 \d 人/.test(o.t)); const sel=t.filter(o=>/选择入队/.test(o.t)); const rip=t.find(o=>/撕开.*包 ▶/.test(o.t)); const win=t.find(o=>/夏窗|补齐 26|开始补强/.test(o.t)); if(conf) return 'C:'+conf.x+','+conf.y; if(sel.length>=3) return 'S:'+sel.slice(0,3).map(o=>o.x+','+o.y).join('|'); if(rip) return 'R:'+rip.x+','+rip.y; if(win) return 'W:'+win.x+','+win.y; return 'I:0,0'; }" 2>&1 | grep -o '"[CSRIW]:[^"]*"' | head -1 | tr -d '"')
  K="${RAW%%:*}"
  PAY="${RAW#*:}"
  if [ "$K" = "W" ]; then echo "[$i] DONE (夏窗到达)"; break; fi
  if [ "$K" = "I" ] || [ -z "$RAW" ]; then echo "[$i] idle"; sleep 2; continue; fi
  IFS='|' read -ra COORDS <<< "$PAY"
  for C in "${COORDS[@]}"; do
    CX="${C%%,*}"; CY="${C##*,}"
    ./tools/fmclick.sh "$SESSION" "$CX" "$CY" >/dev/null
    sleep 0.5
  done
  echo "[$i] $K ${COORDS[*]}"
  sleep 1.3
done
