#!/bin/bash
# fmbullet —— 轮询等待「0.25x 子弹时间」横幅出现，一旦出现立即点击「立即释放 (F)」
# 用法: ./tools/fmbullet.sh <session> [timeoutSeconds]
set -uo pipefail
SESSION="${1:-m1}"
TIMEOUT="${2:-120}"
DEADLINE=$(( $(date +%s) + TIMEOUT ))
BT_X=817   # 「立即释放 (F)」按钮中心 x = bx+bw-196 + 122/2 = 328+624-196+61
BT_Y=499   # = by+18 + 38/2 = 462+18+19
FOUND=0
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  HIT=$(playwright-cli -s="$SESSION" eval "(() => {
    const b = window.__buf || [];
    for (const o of b) { if (o.t && o.t.indexOf('子弹时间') >= 0) return 1; }
    return 0;
  })()" 2>/dev/null | grep -o '1' | head -1)
  if [ "$HIT" = "1" ]; then
    echo ">>> 子弹时间横幅出现，释放"
    playwright-cli -s="$SESSION" mousemove "$BT_X" "$BT_Y" >/dev/null 2>&1
    playwright-cli -s="$SESSION" mousedown >/dev/null 2>&1
    playwright-cli -s="$SESSION" mouseup >/dev/null 2>&1
    FOUND=1
    break
  fi
  sleep 0.25
done
if [ "$FOUND" = "1" ]; then echo "RELEASED"; else echo "TIMEOUT no bullet-time prompt"; fi
