# 第 4 环 / 圆心：全部 59 个子弹时间主动技（118 个 A/B 互斥质变）

> **设计规则**：
> - 赛前顶部装配栏：**4 个主动技槽位**（可跨打法、阵型、宗师自由混搭）。
> - 赛中触发对应 `situation` 窗口时自动进入子弹时间（按 `F` 键释放），立即执行 `instantAction` 物理干预 + 持续 5~10 分钟状态增益 + 所选 **A 或 B 互斥质变**。
> - 100% 基于 `MatchEngine.ts` 的 **12 种触发窗口** + **10 种瞬时物理动作** + **事件总线动作**，零假机制。

---

## 一、36 个打法主动技（6 打法 × 3 区 × 攻/守）

### 1. 传控渗透（`tiki_taka` · 6 个）
| ID | 区/向 | 主动技名 | 触发窗口 (`situation`) | 瞬时物理干预 (`instantAction`) | CD/限次 | 分支 A 质变（1点） | 分支 B 质变（1点） |
|---|---|---|---|---|---|---|---|
| `sk_tt_1` | 前·攻 | **《手术刀直塞》** | `attacking_final_third` | `force_through_ball`（强制穿透直塞） | 12'/3次 | `bypass_offside`（4.5秒免越位） | `reduce_all_cd`（全主动技 CD -3'） |
| `sk_tt_2` | 前·守 | **《游龙突破造任意球》** | `attacking_final_third` | `win_foul_setpiece`（造前场任意球+xG×1.35） | 14'/2次 | `guarantee_shot_on_target`（必射正） | `forceYellowCard`（最近防守者吃黄牌） |
| `sk_tt_3` | 中·攻 | **《Tiki-Taka 五连瞬传》** | `high_possession` | `force_through_ball` + 全队 `pass+10`(6') | 12'/3次 | `counter_damage_amp`（叠+1反击威能） | `double_duration`（增益延至 12'） |
| `sk_tt_4` | 中·守 | **《反抢夺回球权》** | `midfield_press` | `tempo_burst_intercept`（硬直对手+瞬步断球） | 10'/3次 | `steal_tempo`（对手 12 秒传球易被断） | 夺球后全队回体 `+6%` |
| `sk_tt_5` | 后·攻 | **《后场破逼抢长传》** | `counter_opportunity` | `instant_counter_pass`（后场精准直找前场） | 12'/3次 | `bypass_offside`（4.5秒免越位） | 传球后 6 分钟全队 `tempo 1.18` |
| `sk_tt_6` | 后·守 | **《门前冷静解围控球》** | `box_danger` | `clear_danger` + 全队 `comp+12`(6') | 12'/3次 | `grant_shield_stack`（叠+1护盾） | `reduce_all_cd`（全主动技 CD -2'） |

### 2. 高位逼抢（`gegenpress` · 6 个）
| ID | 区/向 | 主动技名 | 触发窗口 (`situation`) | 瞬时物理干预 (`instantAction`) | CD/限次 | 分支 A 质变（1点） | 分支 B 质变（1点） |
|---|---|---|---|---|---|---|---|
| `sk_gp_1` | 前·攻 | **《前场断球就地爆射》** | `attacking_final_third` | `force_shot_on_target`（校准死角爆射） | 14'/2次 | `guarantee_shot_on_target`（必射正+xG×1.15） | `counter_damage_amp`（叠+1反击威能） |
| `sk_gp_2` | 前·守 | **《三叉窒息围抢》** | `midfield_press` | `tempo_burst_intercept`（3人合围瞬断） | 10'/3次 | `steal_tempo`（对手 12 秒节奏迟滞） | `drainOppStamina(5)`（扣对手 5% 体能） |
| `sk_gp_3` | 中·攻 | **《重金属闪电直刺》** | `counter_opportunity` | `force_through_ball` + 全队 `pace+10`(5') | 12'/3次 | `bypass_offside`（4.5秒免越位） | `double_duration`（加速延至 10'） |
| `sk_gp_4` | 中·守 | **《中圈战术犯规掐反击》** | `opponent_through_ball` | `tactical_foul_stop`（强行战术犯规停单刀） | 14'/2次 | 0% 吃黄牌风险 | `grant_shield_stack`（叠+1护盾） |
| `sk_gp_5` | 后·攻 | **《造越位哨响反打》** | `opponent_through_ball` | `clear_danger`（吹停/断下对手直塞） | 12'/3次 | 立即衔接 `instant_counter_pass` | `reduce_all_cd`（全主动技 CD -3'） |
| `sk_gp_6` | 后·守 | **《全员疯狗回追补防》** | `box_danger` | `tempo_burst_intercept` + DEF `pace+12`(5') | 12'/3次 | `grant_shield_stack`（叠+1护盾） | 全队立即回体 `+6%` |

### 3. 两翼齐飞（`wing_play` · 6 个）
| ID | 区/向 | 主动技名 | 触发窗口 (`situation`) | 瞬时物理干预 (`instantAction`) | CD/限次 | 分支 A 质变（1点） | 分支 B 质变（1点） |
|---|---|---|---|---|---|---|---|
| `sk_wp_1` | 前·攻 | **《空霸头球绝杀》** | `wing_overload` | `force_cross_header`（边路强行传中抢点头球） | 14'/2次 | `guarantee_shot_on_target`（必射正+xG×1.15） | `counter_damage_amp`（叠+1反击威能） |
| `sk_wp_2` | 前·守 | **《边路爆破造角球》** | `wing_overload` | `win_foul_setpiece`（下底强行造角球/定位球） | 12'/3次 | 禁区抢点 `+2` 人 | `double_duration`（边路增益翻倍） |
| `sk_wp_3` | 中·攻 | **《跨场 50 米大转移》** | `any_possession` | `instant_counter_pass`（斜长传撕扯边路） | 12'/3次 | `bypass_offside`（4.5秒免越位） | `drainOppStamina(4)`（拉扯扣对手体能） |
| `sk_wp_4` | 中·守 | **《边路飞铲断反击》** | `midfield_press` | `tempo_burst_intercept`（边线精准铲断） | 10'/3次 | `reduce_all_cd`（全主动技 CD -2'） | `steal_tempo`（对手 12 秒传球易被断） |
| `sk_wp_5` | 后·攻 | **《翼卫走廊弹射推进》** | `counter_opportunity` | `force_through_ball` + 边卫 `pace+14`(6') | 12'/3次 | `counter_damage_amp`（叠+1反击威能） | `double_duration`（走廊冲刺延至 12'） |
| `sk_wp_6` | 后·守 | **《边路飞铲封传中》** | `box_danger` | `clear_danger`（禁区侧翼滑铲化解传中） | 10'/3次 | `grant_shield_stack`（叠+1护盾） | 立即触发 `instant_counter_pass` |

### 4. 快速反击（`counter` · 6 个）
| ID | 区/向 | 主动技名 | 触发窗口 (`situation`) | 瞬时物理干预 (`instantAction`) | CD/限次 | 分支 A 质变（1点） | 分支 B 质变（1点） |
|---|---|---|---|---|---|---|---|
| `sk_ct_1` | 前·攻 | **《孤胆单刀推射》** | `attacking_final_third` | `force_shot_on_target`（时间凝固推射死角） | 15'/2次 | `guarantee_shot_on_target`（必射正+xG×1.15） | `steal_tempo`（震慑防线 12 秒） |
| `sk_ct_2` | 前·守 | **《前锋回追战术拦截》** | `midfield_press` | `tempo_burst_intercept`（前锋回撤断球） | 10'/3次 | `counter_damage_amp`（叠+1反击威能） | `reduce_all_cd`（全主动技 CD -2'） |
| `sk_ct_3` | 中·攻 | **《猎豹断球直刺》** | `counter_opportunity` | `instant_counter_pass`（不停球过顶长传） | 10'/3次 | `bypass_offside`（4.5秒免越位） | `counter_damage_amp`（叠+1反击威能） |
| `sk_ct_4` | 中·守 | **《中场口袋合围诱杀》** | `opponent_through_ball` | `tempo_burst_intercept` + `pace+10`(5') | 12'/3次 | `bypass_offside`（夺球后 4.5 秒免越位） | `grant_shield_stack`（叠+1护盾） |
| `sk_ct_5` | 后·攻 | **《门神手抛制导导弹》** | `box_danger` | `gk_long_launch`（门将直找前锋+xG×1.25） | 12'/3次 | `bypass_offside`（4.5秒免越位） | `counter_damage_amp`（再叠+1反击威能） |
| `sk_ct_6` | 后·守 | **《门前解围一脚长传》** | `box_danger` | `clear_danger`（中卫解围直找锋线） | 10'/3次 | `bypass_offside`（4.5秒免越位） | `grant_shield_stack`（叠+1护盾） |

### 5. 铁桶防反（`park_bus` · 6 个）
| ID | 区/向 | 主动技名 | 触发窗口 (`situation`) | 瞬时物理干预 (`instantAction`) | CD/限次 | 分支 A 质变（1点） | 分支 B 质变（1点） |
|---|---|---|---|---|---|---|---|
| `sk_pb_1` | 前·攻 | **《定位球核武头槌》** | `set_piece_moment` | `force_cross_header` + `set_piece_nuke` | 14'/2次 | `guarantee_shot_on_target`（必射正+xG×1.15） | 额外派 2 名中卫冲小禁区 |
| `sk_pb_2` | 前·守 | **《前场倒地骗任意球》** | `leading_late` | `win_foul_setpiece` + 全队 `comp+10`(6') | 14'/2次 | `forceYellowCard`（对手吃黄牌） | 全队立即回体 `+6%` |
| `sk_pb_3` | 中·攻 | **《丢球后铁血反扑》** | `just_conceded` | `force_through_ball` + 全队 `shoot+10`(8') | 16'/2次 | `counter_damage_amp`（叠+2反击威能） | `reduce_all_cd`（其余主动技 CD -4'） |
| `sk_pb_4` | 中·守 | **《中场铁闸滑铲锁》** | `midfield_press` | `tactical_foul_stop`（硬朗破坏对手进攻） | 12'/3次 | `steal_tempo`（对手 12 秒节奏迟滞） | `grant_shield_stack`（叠+1护盾） |
| `sk_pb_5` | 后·攻 | **《门神飞身神扑》** | `box_danger` | `GK_save_boost`（极限飞扑/叠护盾） | 12'/3次 | `grant_shield_stack`（再叠+1护盾） | 立即衔接 `gk_long_launch` 快反 |
| `sk_pb_6` | 后·守 | **《门线极限滑铲解围》** | `box_danger` | `clear_danger`（中卫门线绝命解围） | 10'/3次 | `grant_shield_stack`（叠+1护盾） | `counter_damage_amp`（转化为+1反击威能） |

### 6. 均衡阵地（`balanced` · 6 个）
| ID | 区/向 | 主动技名 | 触发窗口 (`situation`) | 瞬时物理干预 (`instantAction`) | CD/限次 | 分支 A 质变（1点） | 分支 B 质变（1点） |
|---|---|---|---|---|---|---|---|
| `sk_bl_1` | 前·攻 | **《电梯世界波》** | `any_possession` | `force_shot_on_target`（禁区外弧顶重炮） | 14'/2次 | `guarantee_shot_on_target`（必射正+xG×1.15） | `reduce_all_cd`（全主动技 CD -3'） |
| `sk_bl_2` | 前·守 | **《老队长的怒吼》** | `trailing_late` | `tempo_burst_intercept` + 全队回体 `+15%` | 20'/1次 | 全队 `shoot+12, pace+8`(10') | **立即重置其余全部主动技 CD** |
| `sk_bl_3` | 中·攻 | **《中轴指挥官调度》** | `high_possession` | `force_through_ball` + `chemMod+30`(8') | 12'/3次 | `double_duration`（默契狂潮延至 16'） | `counter_damage_amp`（叠+1反击威能） |
| `sk_bl_4` | 中·守 | **《领先时刻全队稳节奏》** | `leading_late` | `tempo_burst_intercept` + `tempo 0.80`(8') | 14'/2次 | `grant_shield_stack`（叠+1护盾） | 全队立即回体 `+8%` |
| `sk_bl_5` | 后·攻 | **《失球瞬间闪电扳平》** | `just_conceded` | `instant_counter_pass` + ATT `shoot+12`(6') | 16'/2次 | `bypass_offside`（4.5秒免越位） | `guarantee_shot_on_target`（必射正） |
| `sk_bl_6` | 后·守 | **《全队阵型紧急落位》** | `opponent_through_ball` | `GK_save_boost` + DEF `def+12`(6') | 12'/3次 | `grant_shield_stack`（叠+1护盾） | 全队立即回体 `+6%` |

---

## 二、16 个阵型专属主动技（内环点亮对应阵型解锁）

| 阵型 | ID | 专属主动技名 | 触发窗口 | 瞬时物理干预 | CD/限次 | 分支 A 质变 | 分支 B 质变 |
|---|---|---|---|---|---|---|---|
| **4-3-3** | `sk_f_433` | **《MSN 三叉戟三角绝杀》** | `attacking_final_third` | `force_through_ball` + ATT `shoot+10`(6') | 13'/2次 | `guarantee_shot_on_target` | `bypass_offside` |
| **4-2-3-1** | `sk_f_4231` | **《前腰禁区前沿贴地斩》** | `attacking_final_third` | `force_shot_on_target` + CAM `shoot+12` | 14'/2次 | `guarantee_shot_on_target` | `reduce_all_cd` (-3') |
| **4-4-2** | `sk_f_442` | **《双塔摆渡凌空抽射》** | `wing_overload` | `force_cross_header` + 双 ST `shoot+12` | 13'/2次 | `counter_damage_amp` (+1) | `guarantee_shot_on_target` |
| **4-1-2-1-2** | `sk_f_41212` | **《菱形二过一撕裂中路》** | `high_possession` | `force_through_ball` + MID `pass+14`(6') | 12'/3次 | `bypass_offside` | `double_duration` |
| **4-4-1-1** | `sk_f_4411` | **《影锋后排插上重炮》** | `any_possession` | `force_shot_on_target` + CAM `pace+12` | 14'/2次 | `guarantee_shot_on_target` | `counter_damage_amp` (+1) |
| **4-1-4-1** | `sk_f_4141` | **《单后腰弧顶绝命封堵》** | `box_danger` | `clear_danger` + CDM `def+16`(6') | 11'/3次 | `grant_shield_stack` (+1) | `steal_tempo` (12秒) |
| **4-2-2-2** | `sk_f_4222` | **《双十号肋部造点/任意球》** | `attacking_final_third` | `win_foul_setpiece` + 双 CAM `pass+12` | 14'/2次 | `forceYellowCard` | `guarantee_shot_on_target` |
| **4-3-2-1** | `sk_f_4321` | **《圣诞树弧顶圆月弯刀》** | `set_piece_moment` | `force_shot_on_target` + `long_shot_cannon` | 14'/2次 | `guarantee_shot_on_target` | `reduce_all_cd` (-3') |
| **3-5-2** | `sk_f_352` | **《翼卫奔袭传中双锋争顶》** | `wing_overload` | `force_cross_header` + `dualOverlap`(8') | 12'/3次 | `counter_damage_amp` (+1) | `double_duration` |
| **3-4-3** | `sk_f_343` | **《五人疯狗前场围抢》** | `midfield_press` | `tempo_burst_intercept` + `extraPresser`(8') | 11'/3次 | `steal_tempo` (12秒) | `drainOppStamina(5)` |
| **3-4-2-1** | `sk_f_3421` | **《双影锋斜塞翼卫倒三角》** | `wing_overload` | `force_through_ball` + `chemMod+25`(6') | 12'/3次 | `bypass_offside` | `guarantee_shot_on_target` |
| **3-4-1-2** | `sk_f_3412` | **《十号直塞双箭头单刀》** | `counter_opportunity` | `instant_counter_pass` + 双 ST `pace+12`(6') | 12'/3次 | `bypass_offside` | `counter_damage_amp` (+1) |
| **5-4-1** | `sk_f_541` | **《九人门线绝命筑墙》** | `box_danger` | `GK_save_boost` + `iron_wall_block`(8') | 12'/3次 | `grant_shield_stack` (+1) | 全队回体 `+6%` |
| **5-3-2** | `sk_f_532` | **《门神神扑+双锋快反》** | `box_danger` | `gk_long_launch` + 双 ST `pace+14`(6') | 12'/3次 | `bypass_offside` | `grant_shield_stack` (+1) |
| **5-2-3** | `sk_f_523` | **《后场过顶长传制导三叉戟》** | `counter_opportunity` | `instant_counter_pass` + ATT `pace+14`(6') | 11'/3次 | `bypass_offside` | `counter_damage_amp` (+1) |
| **5-2-1-2** | `sk_f_5212` | **《铁桶前腰反击绝命一击》** | `counter_opportunity` | `force_through_ball` + CAM `pass+14, shoot+10` | 12'/3次 | `guarantee_shot_on_target` | `steal_tempo` (12秒) |

---

## 三、7 个宗师印奥义技 + 圆心终极技

| 归属 | ID | 宗师奥义技名 | 触发窗口 | 瞬时物理干预 | CD/限次 | 分支 A 质变 | 分支 B 质变 |
|---|---|---|---|---|---|---|---|
| 传控宗师印 | `sk_m_tt` | **《梦之队无限短传》** | `high_possession` | `force_through_ball` + 全队 `pass+16, comp+14`(10') | 18'/1次 | 期间每次连传 4 脚必射正 | 期间每分钟扣对手体能 `-1%` |
| 高压宗师印 | `sk_m_gp` | **《九十秒地狱窒息》** | `midfield_press` | `tempo_burst_intercept` + `high_press_blitz` + `extraPresser`(10') | 18'/1次 | `steal_tempo`(15秒) + `drainOppStamina(8)` | 期间抢断全队回体 `+3%` |
| 两翼宗师印 | `sk_m_wp` | **《两翼飓风无限传中》** | `wing_overload` | `force_cross_header` + `dualOverlap` + `wing_overload`(10') | 18'/1次 | 叠 `+2` 反击威能 | 造角球率 `×2.0` + `set_piece_nuke` |
| 反击宗师印 | `sk_m_ct` | **《十秒闪击一剑封喉》** | `counter_opportunity` | `instant_counter_pass` + 全队 `pace+16, shoot+12`(8') | 18'/1次 | `bypass_offside` + `guarantee_shot_on_target` | 叠 `+2` 反击威能 |
| 铁桶宗师印 | `sk_m_pb` | **《圣西罗绝对零封墙》** | `box_danger` | `GK_save_boost` + `iron_wall_block` + `oppShotXg-0.30`(12') | 18'/1次 | 立即叠 `+2` 绝杀护盾 | 全队回体 `+12%` + `steal_tempo` |
| 均衡宗师印 | `sk_m_bl` | **《银河战舰补时奇迹》** | `trailing_late` | `force_shot_on_target` + `blood_frenzy` + 全属性 `+10`(12') | 20'/1次 | **重置其余全部主动技 CD** | 叠 `+1` 护盾 + `+1` 反击威能 |
| **圆心终极** | `sk_ult_core` | **★《全军破限 · 全攻全守》** | `any_possession` | `force_through_ball` + 全队全属性 `+10` + 回体 `+15%`(15') | 25'/1次 | 同步叠 `+2` 护盾 + `+2` 反击威能 | 同步赋予 10 秒免越位 + 必射正 |
