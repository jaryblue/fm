# 第 1 环：72 张打法三区双刃剑手牌（6 打法 × 3 区 × 攻/守 × 稳健/豪赌 + 216 颗卫星）

> **设计规则**：
> - 每个战术打法拥有 **12 张手牌**（前场 2 攻 2 守 / 中场 2 攻 2 守 / 后场 2 攻 2 守），每对攻/守又分 **「稳健路线（容错高、续航稳）」** 与 **「豪赌路线（爆发猛、副作用重）」**。
> - 每张指令默认持续 **20 分钟**，附挂 **3 颗卫星改造星灯**：**A（减副作用，1 点）/ B（强正面效果，1 点）/ C（宗师质变，2 点）**。
> - 同流派指令装配时自动享绿色契合（副作用自动 `-20%`）。

---

## 一、传控渗透（`tiki_taka` · 12 张）

| ID | 区/向/路 | 指令名 | 正面效果（引擎字段） | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变 · 总线钩子） |
|---|---|---|---|---|---|---|---|
| `tt_a_atk_1` | 前·攻·稳 | **《肋部三角渗透》** | 前/中场 `pass+12`, `shortPass+0.08`, `fkMul 1.25` | `tempo 0.90`, ATT `pace-6` | 移除 ATT `pace-6` | `fkMul` 提至 `1.50` | `onPassStreak(5)` → `grantOnTarget(60)` |
| `tt_a_atk_2` | 前·攻·赌 | **《小禁区撞墙穿刺》** | ATT `pass+14, shoot+8`, `boxCrash+1`, `through+0.08` | `staminaMul 1.30`, `oppThrough+0.10` | `oppThrough` 减半 | ATT `shoot` 提至 `+12` | `onPassStreak(4)` → `addCounter(1)` |
| `tt_a_def_1` | 前·守·稳 | **《前场围抢延缓》** | `pressDist+4`, `oppThrough-0.06`, ATT `def+8` | ATT `staminaMul 1.28` | `staminaMul` 降至 `1.12` | `pressDist` 提至 `+6` | `onTackle` → `stealTempo(80)` |
| `tt_a_def_2` | 前·守·赌 | **《前场原地控球锁》** | `shortPass+0.12`, `tempo 0.78`, `comp+12` | ATT `shoot-8`, `through-0.08` | 移除 ATT `shoot-8` | 每 6 连传回体 `+4%` | `onPassStreak(6)` → `drainOppStamina(2)` |
| `tt_m_atk_1` | 中·攻·稳 | **《手术刀中路渗透》** | MID `pass+10`, `through+0.10`, `shortPass+0.06` | MID `def-6`, `oppThrough+0.08` | 移除 MID `def-6` | `through` 提至 `+0.14` | `onPassStreak(5)` → `grantBypassOffside(40)` |
| `tt_m_atk_2` | 中·攻·赌 | **《全员压上倒三角》** | 全队 `pass+12`, `lineShift+6`, `boxCrash+2` | `oppThrough+0.14`, `staminaMul 1.25` | `oppThrough` 减半 | `chemMod +20` | `onShot` → `cutSkillCd(2)` |
| `tt_m_def_1` | 中·守·稳 | **《慢节奏倒脚控场》** | MID `pass+12, comp+10`, `tiki_taka_flow`(6传回体+3%) | `through-0.08` | 移除 `through-0.08` | 6 连传回体提至 `+5%` | 控球≥58%每分钟 `drainOppStamina(0.6)` |
| `tt_m_def_2` | 中·守·赌 | **《中圈窒息传控网》** | MID `pass+10, def+10`, `interceptProb+0.10` | `tempo 0.82`, 全队 `shoot-6` | 移除 `shoot-6` | `interceptRange+1.0m` | `onIntercept` → `healTeam(2.5)` |
| `tt_d_atk_1` | 后·攻·稳 | **《后场从容出球》** | DEF/GK `pass+14, comp+12`, 抗拦截 `-8%` | `oppThrough+0.08` | `oppThrough` 减半 | MID `pass+6` | 后场传中场成功 → `triggerMiniBuff(提速3秒)` |
| `tt_d_atk_2` | 后·攻·赌 | **《门卫一体高位组织》** | GK/DEF `pass+16`, `lineShift+6`, `tempo 1.15` | `oppThrough+0.14`, `oppShotXg+0.06` | 移除 `oppShotXg` 惩罚 | `through+0.08` | `onPassStreak(5)` → `cutSkillCd(2)` |
| `tt_d_def_1` | 后·守·稳 | **《门前安全三角倒脚》** | DEF/GK `comp+14, pass+12`, `tempo 0.78` | `through-0.12`, `longShot-0.06` | `through` 惩罚减半 | DEF `staminaMul 0.78` | `onDirectiveEnd(0失球)` → `healTeam(8)` |
| `tt_d_def_2` | 后·守·赌 | **《控球替防守极简流》** | `shortPass+0.14`, DEF `comp+12`, `foulMul 0.60` | DEF `def-6`, `blockBonus-0.06` | 移除 DEF `def-6` | `chemMod +18` | `onPassStreak(6)` → `addShield(1)` |

---

## 二、高位逼抢（`gegenpress` · 12 张）

| ID | 区/向/路 | 指令名 | 正面效果（引擎字段） | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变 · 总线钩子） |
|---|---|---|---|---|---|---|---|
| `gp_a_atk_1` | 前·攻·稳 | **《全线压上围攻》** | ATT/MID `shoot+10`, `boxCrash+2`, `lineShift+6` | `oppThrough+0.12` | `oppThrough` 减半 | `shoot` 提至 `+14` | `onCorner` → `cutSkillCd(2)` + `addCounter(1)` |
| `gp_a_atk_2` | 前·攻·赌 | **《疯狗三叉夺命扑》** | ATT `pace+12, shoot+10`, `extraPresser`, `high_press_blitz` | `staminaMul 1.45`, `foulMul 1.50` | `staminaMul` 降至 `1.22` | `pressDist+5` | `onTackle` → `grantOnTarget(50)` |
| `gp_a_def_1` | 前·守·稳 | **《前场封锁出球线》** | `oppDebuff(comp-10)`, `interceptRange+1.2m` | `staminaMul 1.32` | `staminaMul` 降至 `1.14` | `interceptProb+0.12` | `onIntercept` → `stealTempo(100)` |
| `gp_a_def_2` | 前·守·赌 | **《门将出球猎杀令》** | `lineShift+8`, `oppDebuff(comp-14)`, `pressDist+6` | `oppThrough+0.16`, `foulMul 1.40` | `foulMul` 归零 | 对手每分钟掉体 `-0.6%` | `onTackle` → `addCounter(1)` |
| `gp_m_atk_1` | 中·攻·稳 | **《断球瞬时快攻潮》** | `tempo 1.25`, `through+0.10`, MID `pace+10` | DEF `def-6` | 移除 DEF `def-6` | `through` 提至 `+0.14` | `onTackle` → `triggerMiniBuff(全队速度+10/4秒)` |
| `gp_m_atk_2` | 中·攻·赌 | **《重金属中场海啸》** | MID/ATT `pace+12, shoot+8`, `tempo 1.30`, `boxCrash+1` | `staminaMul 1.45`, `oppThrough+0.12` | `staminaMul` 降至 `1.20` | `fkMul 1.35` | `onShot` → `drainOppStamina(2)` |
| `gp_m_def_1` | 中·守·稳 | **《疯狂贴身绞杀》** | `high_press_blitz`, `pressDist+4`, MID `def+10` | `staminaMul 1.40`, `foulMul 1.55` | `staminaMul` 降至 `1.18` | 移除 `foulMul` 惩罚 | `onTackle` → `healTeam(2)` |
| `gp_m_def_2` | 中·守·赌 | **《全员肉搏伐木阵》** | `high_press_blitz`, MID `def+14`, `oppDebuff(fit-6)` | `foulMul 1.85`, `staminaMul 1.35` | `foulMul` 降至 `1.25` | `oppDebuff(comp-10)` | `onTackle` → `cutSkillCd(2)` |
| `gp_d_atk_1` | 后·攻·稳 | **《中卫前压造反击》** | `lineShift+7`, DEF `pass+10`, `through+0.08` | `oppThrough+0.12` | `oppThrough` 减半 | DEF `pace+8` | `onIntercept` → `grantBypassOffside(40)` |
| `gp_d_atk_2` | 后·攻·赌 | **《后防压过中线赌命》** | `lineShift+11`, 全队 `tempo 1.25, pace+8` | `oppThrough+0.18`, `oppShotXg+0.08` | 移除 `oppShotXg` 惩罚 | `boxCrash+2` | `onOffsideTrap` → `triggerMiniBuff(射门+10/5秒)` |
| `gp_d_def_1` | 后·守·稳 | **《造越位高位陷阱》** | `lineShift+5`, `offside_trap`, `offsideTrapBonus+0.12` | 造越位失败时对手单刀 xG `+0.08` | `offsideTrapBonus+0.22` | GK `gk+10` 兜底 | `onOffsideTrap` → `addCounter(1)` + `cutSkillCd(2)` |
| `gp_d_def_2` | 后·守·赌 | **《边后卫内收反抢锁》** | DEF `def+12`, `interceptRange+1.2m`, `pressDist+3` | `staminaMul 1.32`, 边路保护略降 | `staminaMul` 降至 `1.14` | `blockBonus+0.10` | `onTackle` → `addShield(1)`（每指令限1次） |

---

## 三、两翼齐飞（`wing_play` · 12 张）

| ID | 区/向/路 | 指令名 | 正面效果（引擎字段） | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变 · 总线钩子） |
|---|---|---|---|---|---|---|---|
| `wp_a_atk_1` | 前·攻·稳 | **《两翼走廊爆破》** | `pace+10`, `cross+0.10`, `wing_overload`(+20%抢点) | `oppThrough+0.10` | `oppThrough` 减半 | `cornerMul 1.35` | `onCross` → `addCounter(1)` |
| `wp_a_atk_2` | 前·攻·赌 | **《狂轰滥炸起高球》** | `cross+0.16`, `boxCrash+2`, `cornerMul 1.45` | `shortPass-0.10`, `staminaMul 1.30` | `staminaMul` 降至 `1.12` | `set_piece_nuke` 生效 | `onCorner` → `grantOnTarget(60)` |
| `wp_a_def_1` | 前·守·稳 | **《边路控球耗角旗》** | `cornerMul 1.40`, `tempo 0.82`, ATT `comp+10` | `boxCrash-1`, ATT `shoot-6` | 移除 ATT `shoot-6` | `fkMul 1.35` | `onCorner` → `healTeam(2.5)` |
| `wp_a_def_2` | 前·守·赌 | **《边锋回撤夹击边卫》** | `pressDist+4`, ATT/MID `def+10`, 边路拦截 `+14%` | ATT `pace-6`, `staminaMul 1.28` | 移除 ATT `pace-6` | `oppDebuff(comp-8)` | `onTackle` → `cutSkillCd(2)` |
| `wp_m_atk_1` | 中·攻·稳 | **《转移调度撕扯》** | MID `pass+10`, `tempo 1.15`, `dualOverlap` | `staminaMul 1.20`, `oppThrough+0.06` | 移除 `oppThrough` | ATT `pace+8` | 每分钟 `drainOppStamina(0.8)` |
| `wp_m_atk_2` | 中·攻·赌 | **《边前卫内切重炮》** | MID `shoot+12, pace+8`, `longShot+0.08`, `cross+0.06` | MID `def-8`, `oppThrough+0.10` | 移除 MID `def-8` | `long_shot_cannon` 生效 | `onShot` → `addCounter(1)` |
| `wp_m_def_1` | 中·守·稳 | **《边中协防封边线》** | MID/DEF `def+10`, `interceptProb+0.14` | `cross-0.06`, `overlapDepth-2` | 移除 `cross` 惩罚 | `blockBonus+0.10` | `onIntercept` → `healTeam(2)` |
| `wp_m_def_2` | 中·守·赌 | **《中场让边锁肋部》** | `interceptRange+1.4m`, `oppThrough-0.08`, MID `def+12` | 对手边路传中威胁略升 | 禁区封堵 `+10%` | `staminaMul 0.82` | `onBlock` → `cutSkillCd(3)` |
| `wp_d_atk_1` | 后·攻·稳 | **《双翼卫压上助攻》** | `dualOverlap`, `overlapDepth+4`, `cross+0.10` | `oppThrough+0.10` | `oppThrough` 减半 | DEF `pace+8` | `onCross` → `cutSkillCd(2)` |
| `wp_d_atk_2` | 后·攻·赌 | **《边卫套边全员冲锋》** | `dualOverlap`, `overlapDepth+6`, `lineShift+6`, `boxCrash+2` | `oppThrough+0.16`, `staminaMul 1.35` | `staminaMul` 降至 `1.15` | `wing_overload` 生效 | `onCorner` → `addCounter(1)` + `healTeam(2)` |
| `wp_d_def_1` | 后·守·稳 | **《翼卫锁死边路》** | DEF `def+10`, `blockBonus+0.10`, `interceptProb+0.15` | `oppLongShot+0.08`, `oppThrough+0.06` | 惩罚减半 | DEF `pace+6` | `onIntercept` → `cutSkillCd(2)` |
| `wp_d_def_2` | 后·守·赌 | **《五人拉宽防传中网》** | `lineShift-4`, `blockBonus+0.18`, 对手传中拦截 `+20%` | `tempo 0.84`, `through-0.08` | 移除 `through` 惩罚 | GK `gk+10` | `onBlock` → `addShield(1)`（每指令限1次） |

---

## 四、快速反击（`counter` · 12 张）

| ID | 区/向/路 | 指令名 | 正面效果（引擎字段） | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变 · 总线钩子） |
|---|---|---|---|---|---|---|---|
| `ct_a_atk_1` | 前·攻·稳 | **《闪电打身后》** | `through+0.12`, ATT `pace+12`, `tempo 1.20` | 全队 `pass-6`, `shortPass-0.06` | 移除 `pass-6` | ATT `comp+10` | `onShot` → `healTeam(3)` |
| `ct_a_atk_2` | 前·攻·赌 | **《反越位死神冲刺》** | ATT `pace+16, shoot+10`, `through+0.16` | `staminaMul 1.35`, `shortPass-0.12` | `staminaMul` 降至 `1.15` | 前 10 秒免越位 | `onShot` → `grantBypassOffside(40)` |
| `ct_a_def_1` | 前·守·稳 | **《前锋回撤骚扰》** | `pressDist+3`, `tempo 0.88`, `oppThrough-0.06` | ATT `staminaMul 1.25, shoot-4` | 移除 ATT `shoot-4` | ATT `def+8` | `onTackle` → `addCounter(1)` |
| `ct_a_def_2` | 前·守·赌 | **《单箭头牵制拖延》** | ATT `comp+12`, `fkMul 1.40`, `lineShift-4` | ATT `shoot-6`, `boxCrash-1` | 移除 ATT `shoot-6` | `staminaMul 0.82` | `onDirectiveEnd(0失球)` → `addCounter(2)` |
| `ct_m_atk_1` | 中·攻·稳 | **《一脚过顶打穿》** | `through+0.12`, 长传/直塞球速 `+20%`, MID `pass+8` | `shortPass-0.08`, 易交球权 | 移除 `shortPass` 惩罚 | `tempo 1.22` | `onPassStreak(3)` → `grantBypassOffside(35)` |
| `ct_m_atk_2` | 中·攻·赌 | **《三秒直塞闪击战》** | `tempo 1.32`, `through+0.16`, 全队 `pace+10` | DEF `def-8`, `staminaMul 1.32` | 移除 DEF `def-8` | ATT `shoot+8` | `onIntercept` → `triggerMiniBuff(必射正+加速)` |
| `ct_m_def_1` | 中·守·稳 | **《诱敌深入陷阱》** | `lineShift-4`, `tempo 1.20`, `interceptRange+1.2m` | 全队 `pass-6`, `oppLongShot+0.08` | 移除 `oppLongShot` | `through+0.10` | `onIntercept` → `cutSkillCd(3)` + `addCounter(1)` |
| `ct_m_def_2` | 中·守·赌 | **《放弃中场诱杀阵》** | `lineShift-7`, `interceptProb+0.16`, `blockBonus+0.12` | 控球暴跌，`shortPass-0.14` | `through+0.10` 补偿 | `staminaMul 0.78` | `onTackle` → `addCounter(1)` + `grantBypassOffside(40)` |
| `ct_d_atk_1` | 后·攻·稳 | **《门神长传制导》** | GK `gk+10`, `gkQuickLaunch`, `gk_counter_launch`(xG×1.25) | `shortPass-0.10` | ATT `pace+8` | GK `pass+14` | `onSave` → `addCounter(1)` |
| `ct_d_atk_2` | 后·攻·赌 | **《后卫直接找前锋》** | DEF `pass+14`, 长传球速 `+20%`, `through+0.12` | `shortPass-0.12`, DEF `def-4` | 移除 DEF `def-4` | ATT `shoot+8` | `onIntercept` → `triggerMiniBuff(射门xG×1.20/5秒)` |
| `ct_d_def_1` | 后·守·稳 | **《低位回收蓄力》** | `lineShift-6`, `blockBonus+0.14`, DEF `staminaMul 0.80` | `tempo 0.85`, 控球下降 | 移除 `tempo` 惩罚 | DEF `def+10` | `onDirectiveEnd` → `triggerMiniBuff(全队速度+10/5')` |
| `ct_d_def_2` | 后·守·赌 | **《弹性龟缩反咬一口》** | `lineShift-8`, `oppShotXg-0.15`, DEF `def+12` | 全队 `pass-8`, `shoot-4` | 移除 `shoot-4` | `gkQuickLaunch` 生效 | `onBlock` → `addCounter(1)` + `cutSkillCd(2)` |

---

## 五、铁桶防反（`park_bus` · 12 张）

| ID | 区/向/路 | 指令名 | 正面效果（引擎字段） | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变 · 总线钩子） |
|---|---|---|---|---|---|---|---|
| `pb_a_atk_1` | 前·攻·稳 | **《孤注一掷·空霸轰炸》** | `set_piece_nuke`(xG×1.35+双CB冲禁区), `boxCrash+2`, `cross+0.10` | `staminaMul 1.30`, `shortPass-0.08` | `staminaMul` 降至 `1.12` | `cornerMul/fkMul 1.30` | 75'后未领先：定位球/传中 xG 再 `+25%` + 双 CB 必进小禁区 |
| `pb_a_atk_2` | 前·攻·赌 | **《定位球核武总攻》** | `set_piece_nuke`, `fkMul 1.50`, `cornerMul 1.50`, `lineShift+6` | `oppThrough+0.14`, `staminaMul 1.35` | `oppThrough` 减半 | 派 3 名高点冲禁区 | `onCorner` → `grantOnTarget(60)` + `addCounter(1)` |
| `pb_a_def_1` | 前·守·稳 | **《前场造犯规磨时间》** | `fkMul 1.45`, 全队 `comp+8`, `tempo 0.80` | ATT `shoot-6` | 移除 ATT `shoot-6` | `staminaMul 0.82` | `onDirectiveEnd(0失球)` → `healTeam(8)` |
| `pb_a_def_2` | 前·守·赌 | **《锋线变后卫十人守》** | ATT `def+14`, `lineShift-8`, `oppShotXg-0.12` | ATT `shoot-12`, `through-0.12` | `shoot` 惩罚减半 | `blockBonus+0.12` | `onBlock` → `addShield(1)`（每指令限1次） |
| `pb_m_atk_1` | 中·攻·稳 | **《中场长传找高点》** | `cross+0.12`, `boxCrash+1`, MID `pass+8` | `shortPass-0.10`, 控球下降 | `shortPass` 惩罚减半 | `cornerMul 1.30` | `onCross` → `grantOnTarget(40)` |
| `pb_m_atk_2` | 中·攻·赌 | **《铁血反扑肉搏推》** | MID `def+10, shoot+10`, `blood_frenzy`, `fkMul 1.35` | `foulMul 1.50`, `staminaMul 1.30` | `foulMul` 降至 `1.10` | MID `pace+8` | `onConcede` → `cutSkillCd(5)` + `healTeam(8)` |
| `pb_m_def_1` | 中·守·稳 | **《中场双鬼拦截网》** | MID `def+14`, `interceptRange+1.2m`, `interceptProb+0.12` | 全队 `shoot-6`, `through-0.06` | 移除 `shoot-6` | `interceptRange+2.0m` | `onIntercept` → `grantBypassOffside(40)` |
| `pb_m_def_2` | 中·守·赌 | **《中路铁丝网绞杀》** | `oppThrough-0.12`, MID `def+16`, `foulMul 1.35` | `tempo 0.82`, 全队 `pass-8` | 移除 `foulMul` 惩罚 | `blockBonus+0.12` | `onTackle` → `drainOppStamina(2.5)` |
| `pb_d_atk_1` | 后·攻·稳 | **《铁桶偷鸡定位球》** | `set_piece_nuke`(xG×1.30), DEF `pass+8`, `fkMul 1.30` | `shortPass-0.10` | 移除 `shortPass` 惩罚 | `cornerMul 1.35` | `onSave` → `triggerMiniBuff(定位球xG加成)` |
| `pb_d_atk_2` | 后·攻·赌 | **《门神大脚直捣黄龙》** | `gkQuickLaunch`, `gk_counter_launch`, GK `gk+12, pass+14` | 全队 `shortPass-0.14`, DEF `def-4` | 移除 DEF `def-4` | ATT `pace+10` | `onSave` → `addCounter(1)` + `grantBypassOffside(40)` |
| `pb_d_def_1` | 后·守·稳 | **《禁区双层铁桶》** | DEF `def+14`, `iron_wall_block`, `oppShotXg-0.20` | `tempo 0.85`, 全队 `pass-6` | 保留 `through+0.06` | GK `gk+10` | `onDirectiveEnd(0失球)` → `healTeam(10)` + `addShield(1)` |
| `pb_d_def_2` | 后·守·赌 | **《绝命门线肉身堵枪眼》** | `iron_wall_block`, `blockBonus+0.24`, `oppShotXg-0.28` | `staminaMul 1.32`, 全队 `shoot-10` | `staminaMul` 降至 `1.10` | 开局立即 `addShield(1)` | `onBlock` → `cutSkillCd(3)` + `healTeam(2)` |

---

## 六、均衡阵地（`balanced` · 12 张）

| ID | 区/向/路 | 指令名 | 正面效果（引擎字段） | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变 · 总线钩子） |
|---|---|---|---|---|---|---|---|
| `bl_a_atk_1` | 前·攻·稳 | **《禁区外重炮轰炸》** | `longShot+0.12`, `long_shot_cannon`(≥18m xG×1.30/射正+14%) | 全队 `pass-8` | 移除 `pass-8` | ATT/MID `shoot+8` | 远射被扑时 **80%** 转化为角球 |
| `bl_a_atk_2` | 前·攻·赌 | **《孤注一掷补时狂潮》** | `blood_frenzy`, ATT `shoot+14, pace+10`, `boxCrash+2` | `staminaMul 1.40`, `oppThrough+0.12` | `staminaMul` 降至 `1.18` | 75'后属性加成翻倍 | `onShot` → `cutSkillCd(2)` |
| `bl_a_def_1` | 前·守·稳 | **《前场控球稳局势》** | `shortPass+0.08`, ATT `comp+10`, `tempo 0.85` | ATT `pace-4`, `shoot-4` | 移除 ATT `shoot-4` | `chemMod +18` | `onPassStreak(5)` → `healTeam(2.5)` |
| `bl_a_def_2` | 前·守·赌 | **《替补生力军前场搅局》** | `super_sub` 强化(替补登场+12全攻防), `pressDist+3` | 首发前锋 `staminaMul 1.25` | 移除体能惩罚 | `oppDebuff(comp-8)` | `onSubIn` → `extendDirective(6)` + `addCounter(1)` |
| `bl_m_atk_1` | 中·攻·稳 | **《全能压迫节拍》** | 全队 `pass+7, def+7`, `chemMod +15` | MID `staminaMul 1.20` | 移除体能惩罚 | `chemMod` 提至 `+28` | `onTackle`/`onPassStreak(5)` → `cutSkillCd(1)` |
| `bl_m_atk_2` | 中·攻·赌 | **《中轴脊柱全线压上》** | 中轴(CB/CDM/CM/CAM/ST) 全属性 `+8`, `lineShift+5` | `staminaMul 1.32`, `oppThrough+0.08` | `oppThrough` 归零 | `tempo 1.15` | `onShot` → `addCounter(1)` |
| `bl_m_def_1` | 中·守·稳 | **《中场阵地降速缓气》** | MID `def+10, pass+8`, 全队 `staminaMul 0.80` | `tempo 0.85`, `through-0.06` | 移除 `through` 惩罚 | 立即全队回体 `+5%` | `onDirectiveEnd` → `healTeam(6)` |
| `bl_m_def_2` | 中·守·赌 | **《战术犯规掐节奏》** | MID `def+12`, `interceptProb+0.12`, `stealTempo` 常驻压制 | `foulMul 1.60` | `foulMul` 降至 `1.15` | `oppThrough-0.08` | `onTackle` → `drainOppStamina(2)` |
| `bl_d_atk_1` | 后·攻·稳 | **《后场弹性推进》** | `lineShift+3`, DEF `pass+10`, `chemMod +12` | `oppThrough+0.06` | 移除 `oppThrough` | MID `pass+6` | `onPassStreak(5)` → `triggerMiniBuff(速度+8/4秒)` |
| `bl_d_atk_2` | 后·攻·赌 | **《边中卫带球插上》** | DEF `pace+10, pass+10`, `overlapDepth+3`, `boxCrash+1` | `oppThrough+0.12`, `staminaMul 1.25` | `oppThrough` 减半 | `longShot+0.08` | `onCross` → `addCounter(1)` |
| `bl_d_def_1` | 后·守·稳 | **《钢铁纪律防线》** | DEF `def+10, comp+10`, `foulMul 0.50` | `pressDist-2` | 移除 `pressDist-2` | DEF `staminaMul 0.75` | 生效期间免疫 **1 次**禁区点球或红牌 |
| `bl_d_def_2` | 后·守·赌 | **《老将定海神针》** | DEF/GK `comp+14, def+12`, `oppShotXg-0.14` | DEF `pace-6`, `tempo 0.88` | 移除 DEF `pace-6` | 70'后额外 `+1` 护盾 | `onSave` → `healTeam(4)` + `cutSkillCd(2)` |
