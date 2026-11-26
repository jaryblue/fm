#!/bin/bash
# fmload —— 把本地 JS 文件注入浏览器页面（base64 传输，避免 shell 转义问题）
# 用法: ./tools/fmload.sh <session> <js文件路径>
set -euo pipefail
SESSION="$1"
FILE="$2"
B64=$(base64 -i "$FILE" | tr -d '\n')
playwright-cli -s="$SESSION" eval "(() => { const s = atob('$B64'); (0,eval)(s); return 'injected:' + '$FILE'; })()" 2>&1 | tail -4
