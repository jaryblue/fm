# 第 2/3 环：32 张阵型专属手牌 + 18 张融合王牌手牌（共 50 张 + 150 颗卫星）

> **解锁与装备规则**：
> - **32 张阵型专属手牌**：在内环点亮对应阵型节点后解锁，**仅在使用该阵型（或同防线体系且解锁契合）时可享绿色契合**，让 16 个真实阵型各有完全不同的赛中打法体验！
> - **18 张融合王牌手牌**：在融合叠加层点亮对应 `防线 × 打法` 融合奇点时解锁，代表该流派的**宗师级标志性战术**，正负面都更具张力。

---

## 一、16 阵型专属手牌（16 × 2 = 32 张，每阵型 1 攻 + 1 守）

### 四后卫体系（8 阵型 · 16 张）
| 阵型 | ID | 区/向 | 专属指令名 | 正面效果 | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变） |
|---|---|---|---|---|---|---|---|---|
| **4-3-3** | `fm_433_atk` | 前·攻 | **《三叉戟交叉换位》** | ATT `pace+10, shoot+10`, `through+0.10`, `chemMod+15` | `staminaMul 1.25` | `staminaMul` 降至 `1.10` | `boxCrash+1` | `onPassStreak(4)` → `grantOnTarget(50)` |
| **4-3-3** | `fm_433_def` | 前·守 | **《三叉戟前场合围锁》** | `extraPresser`, `pressDist+5`, `oppDebuff(comp-8)` | ATT `shoot-6`, `staminaMul 1.28` | 移除 `shoot-6` | `high_press_blitz` | `onTackle` → `addCounter(1)` |
| **4-2-3-1** | `fm_4231_atk` | 中·攻 | **《十号位自由开火权》** | CAM `pass+14, shoot+12`, `through+0.12` | MID `def-6` | 移除 MID `def-6` | `long_shot_cannon` | `onShot` → `cutSkillCd(2)` |
| **4-2-3-1** | `fm_4231_def` | 中·守 | **《双后腰弧顶铁闸》** | CDM `def+14`, `interceptRange+1.4m`, `oppShotXg-0.12` | `tempo 0.85` | 移除 `tempo` 惩罚 | `blockBonus+0.12` | `onIntercept` → `addShield(1)`（限1次） |
| **4-4-2** | `fm_442_atk` | 前·攻 | **《一高一快双塔轰炸》** | 双 ST `shoot+12`, `wing_overload`, `boxCrash+2` | `shortPass-0.08` | 移除 `shortPass` 惩罚 | `cross+0.12` | `onCross` → `grantOnTarget(45)` |
| **4-4-2** | `fm_442_def` | 后·守 | **《经典双层四四二链》** | DEF/MID `def+10`, `lineShift-5`, `oppThrough-0.10` | `through-0.08` | 移除 `through` 惩罚 | `staminaMul 0.82` | `onDirectiveEnd(0失球)` → `healTeam(10)` |
| **4-1-2-1-2** | `fm_41212_atk` | 中·攻 | **《菱形中路撞墙风暴》** | MID `pass+14`, `shortPass+0.12`, `chemMod+20` | 边路空虚（对手传中略升） | `blockBonus+0.08` 补防 | `through+0.10` | `onPassStreak(5)` → `cutSkillCd(2)` |
| **4-1-2-1-2** | `fm_41212_def` | 中·守 | **《单腰拖后菱形绞盘》** | CDM `def+14`, `interceptProb+0.15`, `oppThrough-0.08` | `staminaMul 1.25` | `staminaMul` 降至 `1.10` | `pressDist+3` | `onIntercept` → `healTeam(2.5)` |
| **4-4-1-1** | `fm_4411_atk` | 前·攻 | **《影锋回撤穿刺》** | CAM/ST `pace+10, shoot+10`, `falseNineDrop 6`, `through+0.10` | `oppThrough+0.08` | `oppThrough` 减半 | `chemMod+18` | `onShot` → `addCounter(1)` |
| **4-4-1-1** | `fm_4411_def` | 中·守 | **《九人中低位弹性网》** | DEF/MID `def+10`, `lineShift-4`, `staminaMul 0.82` | `tempo 0.86` | 移除 `tempo` 惩罚 | `blockBonus+0.10` | `onTackle` → `cutSkillCd(2)` |
| **4-1-4-1** | `fm_4141_atk` | 中·攻 | **《五中场波浪前压》** | MID `pass+10, shoot+8`, `lineShift+5`, `boxCrash+1` | `oppThrough+0.10` | `oppThrough` 减半 | `longShot+0.08` | `onPassStreak(5)` → `addCounter(1)` |
| **4-1-4-1** | `fm_4141_def` | 中·守 | **《扇形五人绞杀带》** | MID `def+12`, `interceptRange+1.5m`, `pressDist+4` | `staminaMul 1.32` | `staminaMul` 降至 `1.14` | `high_press_blitz` | `onIntercept` → `stealTempo(90)` |
| **4-2-2-2** | `fm_4222_atk` | 前·攻 | **《双十号魔方连线》** | 双 CAM `pass+14`, `fkMul 1.45`, `chemMod+22` | `staminaMul 1.25` | `staminaMul` 降至 `1.10` | `through+0.10` | `onPassStreak(4)` → `grantBypassOffside(40)` |
| **4-2-2-2** | `fm_4222_def` | 中·守 | **《双腰双前腰箱型锁》** | `interceptProb+0.14`, `oppThrough-0.10`, MID `def+10` | 边路保护减弱 | `blockBonus+0.10` | `foulMul 0.70` | `onTackle` → `healTeam(2)` |
| **4-3-2-1** | `fm_4321_atk` | 前·攻 | **《圣诞树弧顶重炮群》** | 双 CAM `shoot+14`, `longShot+0.14`, `long_shot_cannon` | `shortPass-0.08` | 移除 `shortPass` 惩罚 | `cornerMul 1.35` | 远射被扑 80% 变角球 + `cutSkillCd(2)` |
| **4-3-2-1** | `fm_4321_def` | 中·守 | **《三后腰圣诞树铁幕》** | 三 CM/CDM `def+12`, `oppShotXg-0.14`, `blockBonus+0.12` | `tempo 0.85` | 移除 `tempo` 惩罚 | `staminaMul 0.82` | `onBlock` → `addCounter(1)` |

### 三后卫体系（4 阵型 · 8 张）
| 阵型 | ID | 区/向 | 专属指令名 | 正面效果 | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变） |
|---|---|---|---|---|---|---|---|---|
| **3-5-2** | `fm_352_atk` | 中·攻 | **《双翼卫喂饼双中锋》** | `dualOverlap`, `cross+0.12`, 双 ST `shoot+10`, `boxCrash+1` | `staminaMul 1.28` | `staminaMul` 降至 `1.12` | `wing_overload` | `onCross` → `addCounter(1)` |
| **3-5-2** | `fm_352_def` | 中·守 | **《五中场窒息铁幕》** | MID `def+12, pass+10`, `interceptRange+1.2m` | `tempo 0.85` | 移除 `tempo` 惩罚 | `oppThrough-0.08` | `onIntercept` → `healTeam(2.5)` |
| **3-4-3** | `fm_343_atk` | 前·攻 | **《五人宽幅前场狂压》** | `extraPresser`, `lineShift+7`, ATT `pace+10, shoot+10` | `oppThrough+0.14`, `staminaMul 1.35` | `oppThrough` 减半 | `high_press_blitz` | `onTackle` → `grantOnTarget(50)` |
| **3-4-3** | `fm_343_def` | 后·守 | **《三中卫+双翼卫回撤变五卫》** | `lineShift-6`, DEF `def+12`, `blockBonus+0.14` | ATT `pass-6`, `tempo 0.86` | 移除 `pass-6` | `oppShotXg-0.12` | `onDirectiveEnd(0失球)` → `addShield(1)` |
| **3-4-2-1** | `fm_3421_atk` | 前·攻 | **《双影锋肋部斜塞》** | 双 CAM `pass+12`, `through+0.12`, `overlapDepth+4` | `oppThrough+0.10` | `oppThrough` 减半 | `chemMod+20` | `onPassStreak(4)` → `grantBypassOffside(40)` |
| **3-4-2-1** | `fm_3421_def` | 中·守 | **《3-4-2-1 肋部口袋陷阱》** | `interceptProb+0.14`, DEF/MID `def+10`, `oppThrough-0.08` | `staminaMul 1.25` | `staminaMul` 降至 `1.10` | `pressDist+3` | `onIntercept` → `cutSkillCd(2)` |
| **3-4-1-2** | `fm_3412_atk` | 前·攻 | **《十号直塞双箭头》** | CAM `pass+14`, 双 ST `pace+12`, `through+0.14` | `shortPass-0.08` | 移除 `shortPass` 惩罚 | 长传/直塞球速 `+18%` | `onShot` → `addCounter(1)` |
| **3-4-1-2** | `fm_3412_def` | 后·守 | **《三中卫拖后扫荡锁》** | 三 CB `def+14`, `blockBonus+0.14`, `offsideTrapBonus+0.10` | `tempo 0.86` | 移除 `tempo` 惩罚 | GK `gk+8` | `onBlock` → `cutSkillCd(2)` |

### 五后卫体系（4 阵型 · 8 张）
| 阵型 | ID | 区/向 | 专属指令名 | 正面效果 | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变） |
|---|---|---|---|---|---|---|---|---|
| **5-4-1** | `fm_541_atk` | 前·攻 | **《孤胆中锋偷鸡反击》** | 单 ST `pace+16, shoot+12, comp+12`, `through+0.12` | `shortPass-0.12` | 移除 `shortPass` 惩罚 | `gk_counter_launch` | `onShot` → `healTeam(4)` |
| **5-4-1** | `fm_541_def` | 后·守 | **《九人门线钢铁大巴》** | `lineShift-8`, `iron_wall_block`, `oppShotXg-0.25` | `tempo 0.80`, `shoot-8` | 移除 `shoot-8` | `staminaMul 0.75` | `onDirectiveEnd(0失球)` → `addShield(1)` + `healTeam(10)` |
| **5-3-2** | `fm_532_atk` | 后·攻 | **《五卫弹射双锋快反》** | `gkQuickLaunch`, 双 ST `pace+14`, `tempo 1.25` | `shortPass-0.10` | 移除 `shortPass` 惩罚 | `through+0.12` | `onSave` → `addCounter(1)` + `grantBypassOffside(40)` |
| **5-3-2** | `fm_532_def` | 中·守 | **《三中场+五卫中路铁桶》** | `oppThrough-0.14`, DEF/MID `def+12`, `blockBonus+0.14` | `tempo 0.84` | 移除 `tempo` 惩罚 | `foulMul 0.65` | `onIntercept` → `cutSkillCd(2)` |
| **5-2-3** | `fm_523_atk` | 后·攻 | **《跳过中场长传找三叉戟》** | DEF `pass+14`, ATT `pace+14`, 长传球速 `+20%` | MID `pass-8`, 控球下降 | 移除 MID `pass-8` | `wing_overload` | `onIntercept` → `triggerMiniBuff(三叉戟速度+12/4秒)` |
| **5-2-3** | `fm_523_def` | 后·守 | **《五卫双腰禁区封锁带》** | DEF/CDM `def+14`, `oppShotXg-0.18`, `interceptRange+1.2m` | `staminaMul 1.22` | `staminaMul` 降至 `1.05` | `blockBonus+0.12` | `onBlock` → `addCounter(1)` |
| **5-2-1-2** | `fm_5212_atk` | 中·攻 | **《前腰反击枢纽一脚出球》** | CAM `pass+16, comp+12`, `through+0.14`, `tempo 1.22` | `shortPass-0.08` | 移除 `shortPass` 惩罚 | 双 ST `shoot+10` | `onPassStreak(3)` → `grantOnTarget(45)` |
| **5-2-1-2** | `fm_5212_def` | 后·守 | **《五卫菱形深防阵》** | `lineShift-6`, DEF `def+14`, `oppThrough-0.12` | `tempo 0.84` | 移除 `tempo` 惩罚 | GK `gk+10` | `onSave` → `cutSkillCd(3)` |

---

## 二、18 张流派融合王牌手牌（18 个 `防线 × 打法` 融合奇点专属解锁）

| 融合组合 | ID | 区/向 | 王牌指令名 | 正面效果 | 双刃剑副作用 | 卫星 A（减负） | 卫星 B（增效） | 卫星 C（宗师质变） |
|---|---|---|---|---|---|---|---|---|
| 4卫×传控 | `fu_4_tt` | 前·攻 | **《梦三 Tiki-Taka 极致窒息》** | `falseNineDrop 8`, 全队 `pass+14`, `shortPass+0.12`, `chemMod+25` | `staminaMul 1.30`, `longShot-0.10` | `staminaMul` 降至 `1.10` | `tiki_taka_flow`(回体+4%) | `onPassStreak(5)` → `grantOnTarget(60)` + `cutSkillCd(2)` |
| 4卫×高压 | `fu_4_gp` | 前·攻 | **《克洛普重金属六秒狂潮》** | `extraPresser`, `high_press_blitz`, `tempo 1.30`, ATT `pace+12, shoot+10` | `staminaMul 1.48`, `oppThrough+0.14` | `staminaMul` 降至 `1.22` | `oppDebuff(comp-12)` | `onTackle` → `cutSkillCd(3)` + `addCounter(1)` |
| 4卫×两翼 | `fu_4_wp` | 前·攻 | **《双边卫绝命走廊狂潮》** | `dualOverlap`, `overlapDepth+5`, `wing_overload`, `cross+0.14` | `oppThrough+0.14`, `staminaMul 1.30` | `oppThrough` 减半 | `cornerMul 1.45` | `onCross` → `addCounter(1)` + `healTeam(2)` |
| 4卫×反击 | `fu_4_ct` | 中·攻 | **《安氏银河战舰三秒闪击》** | `tempo 1.30`, `through+0.14`, ATT `pace+14, shoot+10`, 传球加速 `+20%` | `shortPass-0.10`, DEF `def-6` | 移除 DEF `def-6` | `gk_counter_launch` | `onIntercept` → `grantBypassOffside(50)` + `addCounter(1)` |
| 4卫×铁桶 | `fu_4_pb` | 后·守 | **《萨基-卡佩罗链式铁幕》** | `iron_wall_block`, `oppShotXg-0.22`, DEF `def+14, comp+12`, `foulMul 0.65` | `tempo 0.82`, `shoot-6` | 移除 `shoot-6` | 立即 `addShield(1)` | `onBlock` → `cutSkillCd(3)` + `addCounter(1)` |
| 4卫×均衡 | `fu_4_bl` | 中·攻 | **《皇马欧冠中轴交响曲》** | 中轴全属性 `+10`, `chemMod+30`, `blood_frenzy` | `staminaMul 1.28` | `staminaMul` 降至 `1.10` | `long_shot_cannon` | `onShot` → `healTeam(3)` + `cutSkillCd(2)` |
| 3卫×传控 | `fu_3_tt` | 中·攻 | **《瓜式 3-2-4-1 倒三角压迫》** | 全队 `pass+14`, `lineShift+6`, `interceptRange+1.2m`, `chemMod+22` | `oppThrough+0.12`, `staminaMul 1.28` | `oppThrough` 减半 | 控球≥58%扣对手体能 | `onPassStreak(5)` → `stealTempo(100)` + `cutSkillCd(2)` |
| 3卫×高压 | `fu_3_gp` | 中·守 | **《加斯佩里尼全场人盯人》** | `extraPresser`, `high_press_blitz`, `pressDist+6`, 全队 `def+10` | `staminaMul 1.50`, `foulMul 1.60` | `foulMul` 降至 `1.15` | `oppDebuff(fit-8, comp-10)` | `onTackle` → `drainOppStamina(3)` + `healTeam(2)` |
| 3卫×两翼 | `fu_3_wp` | 中·攻 | **《孔蒂双翼卫永动引擎》** | `dualOverlap`, `overlapDepth+6`, 翼卫 `pace+14`, `wing_overload` | `oppThrough+0.12` | `oppThrough` 减半 | 翼卫 `staminaMul 0.70` | `onCross` → `cutSkillCd(3)` + `addCounter(1)` |
| 3卫×反击 | `fu_3_ct` | 中·攻 | **《国米三卫双锋致命刺》** | `lineShift-4`, `through+0.14`, 长传加速 `+22%`, ATT `pace+14` | `shortPass-0.10` | 移除 `shortPass` 惩罚 | `interceptRange+1.2m` | `onIntercept` → `addCounter(1)` + `grantOnTarget(45)` |
| 3卫×铁桶 | `fu_3_pb` | 前·攻 | **《三塔禁区空霸核打击》** | `set_piece_nuke`, `boxCrash+3`, 3 CB 冲禁区, `cornerMul 1.50` | `staminaMul 1.35`, `oppThrough+0.12` | `oppThrough` 减半 | `iron_wall_block` 同步生效 | `onCorner` → `grantOnTarget(60)` + `addShield(1)`（限1次） |
| 3卫×均衡 | `fu_3_bl` | 中·攻 | **《阿隆索动态三卫变阵》** | `super_sub`, `tempo 1.18`, 全队 `pass+8, def+8, pace+8` | `staminaMul 1.28` | `staminaMul` 降至 `1.10` | `chemMod+22` | `onSubIn` → `extendDirective(6)` + `addShield(1)` + `addCounter(1)` |
| 5卫×传控 | `fu_5_tt` | 后·守 | **《五卫后场戏耍反压迫》** | DEF/GK `pass+16, comp+16`, 免疫对手高压抢断, `shortPass+0.12` | `tempo 0.84`, `shoot-6` | 移除 `shoot-6` | 4 连传 `cutSkillCd(1)` | `onPassStreak(6)` → `triggerMiniBuff(全队提速+直塞/5秒)` |
| 5卫×高压 | `fu_5_gp` | 中·守 | **《五盾无忧中场绞肉机》** | `extraPresser`, `high_press_blitz`, MID `def+14`, **对手直塞副作用归零** | `staminaMul 1.42`, `foulMul 1.45` | `staminaMul` 降至 `1.18` | 移除 `foulMul` 惩罚 | `onTackle` → `addCounter(1)` + `stealTempo(90)` |
| 5卫×两翼 | `fu_5_wp` | 后·攻 | **《五卫瞬间弹射变 3-4-3》** | `dualOverlap`, `lineShift+7`, `overlapDepth+6`, `cross+0.14`, 4 秒免越位 | `oppThrough+0.14`, `staminaMul 1.35` | `oppThrough` 减半 | `wing_overload` 生效 | `onCross` → `grantOnTarget(45)` + `addCounter(1)` |
| 5卫×反击 | `fu_5_ct` | 后·守 | **《2004 希腊神话大巴偷鸡》** | `lineShift-7`, `iron_wall_block`, `oppShotXg-0.22`, `gkQuickLaunch` | `tempo 0.82`, `shortPass-0.10` | 移除 `shortPass` 惩罚 | `set_piece_nuke` 同步生效 | `onDirectiveEnd` → 自动爆发 **5 分钟高速反击（速度+12/直塞+0.14/必免越位）** |
| 5卫×铁桶 | `fu_5_pb` | 后·守 | **《穆氏绝境大巴绝对要塞》** | `iron_wall_block`, `oppShotXg-0.30`, 立即 `addShield(1)`, GK `gk+14` | 全队 `shoot-10, pass-8`, `tempo 0.78` | 移除 `pass-8` | `staminaMul 0.75` | `onDirectiveEnd(0失球)` → 全队回体 `+15%` + `addShield(1)` |
| 5卫×均衡 | `fu_5_bl` | 后·守 | **《五卫全能铁血宗师盾》** | 全队 `def+10, comp+10, pass+8`, `foulMul 0.55`, 跨流派全绿色契合 | `tempo 0.88` | 移除 `tempo` 惩罚 | 免疫 1 次点球/红牌 | `onSave`/`onBlock` → `cutSkillCd(2)` + `healTeam(3)` |
