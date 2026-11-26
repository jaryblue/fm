#!/bin/bash
# fmwatch —— 读取比赛状态（比分/分钟/关键事件）
# 用法: ./tools/fmwatch.sh <session> [clear]
set -uo pipefail
SESSION="$1"
if [ "${2:-}" = "clear" ]; then
  playwright-cli -s="$SESSION" eval "() => { window.__buf=[]; return 1; }" >/dev/null 2>&1
  exit 0
fi
playwright-cli -s="$SESSION" eval "() => { const t=window.__m.all(); const seen=new Set(); const out=[]; for(const o of t){ if(seen.has(o.t))continue; seen.add(o.t); if(/上半场|下半场|中场|完场|分钟|\\d+\\s*:\\s*\\d+|GOAL|进球|红牌|黄牌|换人|战术|子弹|能量|手牌|花|点球/.test(o.t)) out.push(o.y+'|'+o.x+'|'+o.t); } return out.slice(0,40); }" 2>&1 | grep -o '"[^"]*"' | tr -d '"' | head -40
