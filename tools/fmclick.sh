#!/bin/bash
# fmclick —— 用真实鼠标点击「再开一局」canvas 上的设计坐标
# 用法: ./tools/fmclick.sh <session> <designX> <designY>
set -euo pipefail
SESSION="$1"
DX="$2"
DY="$3"
# 视口为 1280x720 且 canvas 铺满，设计坐标 == 客户端坐标
playwright-cli -s="$SESSION" mousemove "$DX" "$DY" >/dev/null 2>&1
playwright-cli -s="$SESSION" mousedown >/dev/null 2>&1
playwright-cli -s="$SESSION" mouseup >/dev/null 2>&1
echo "clicked $DX,$DY"
