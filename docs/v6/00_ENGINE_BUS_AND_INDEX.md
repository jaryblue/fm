# 《再开一局》V6 暗黑 4 体量锁定式八卦星盘：总览索引与引擎原子总线规范

> **设计目标**：围绕 `16 真实阵型 × 6 大战术打法`，打造对标《暗黑破坏神 4》构筑深度的足球星盘——**122 张三区双刃剑手牌（366 颗卫星改造）+ 59 个子弹时间主动技（118 个 A/B 质变）+ 92 条被动 + 18 个融合奇点（36 条威能分支）+ 6 宗师印 + 1 圆心超级宗师**，全部由一套 ~120 行的数据驱动引擎总线 100% 真实驱动，**零假机制**。

---

## 一、全量文档索引

| 文档 | 内容范围 | 节点/变化量 |
|---|---|---|
| `00_ENGINE_BUS_AND_INDEX.md`（本文） | 全量索引 + `MatchEngine.ts` 数据驱动原子总线实现规范 | 引擎底座（~155 行增量） |
| `01_STYLE_DIRECTIVES_72.md` | 第 1 环：6 大打法 × 3 区 × 攻/守 × 稳健/豪赌 = **72 张打法手牌** | 72 手牌 + 216 颗卫星 |
| `02_FORMATION_AND_FUSION_DIRECTIVES_50.md` | 第 2/3 环：16 阵型专属手牌（32 张）+ 18 融合王牌手牌（18 张） | 50 手牌 + 150 颗卫星 |
| `03_ACTIVE_SKILLS_59.md` | 第 4 环/圆心：36 打法 + 16 阵型 + 6 宗师印 + 1 圆心终极 = **59 主动技** | 59 主动技 + 118 个 A/B 质变 |
| `04_PASSIVES_FUSIONS_MASTERY.md` | 92 条被动（48 打法 + 44 体系/阵型）+ 18 融合奇点（36 分支）+ 6 宗师印 + 圆心 | 92 被动 + 18 奇点 + 7 终局核 |
| `05_RULES_ECONOMY_AND_UX_SPEC.md` | 赛前临场池（每拐点4张）+ 静态 6 TP 预算 + 赛中视觉反馈 + Meta 经济 + 新手解雾 + 赛后 3 选 1 闭环 | 规则与经济闭环规范 |

---

## 二、`MatchEngine.ts` 数据驱动原子总线实现规范

> **核心原则**：绝不为 122 张手牌和 59 个主动技写 180 段 `if (id === ...)` 硬编码。所有手牌、卫星、主动技、被动、融合奇点全部编译为以下 **4 套原子数据结构** 注入 `MatchEngine.ts`。

### 1. 连续战术与属性修饰器（`EffectiveMods` · 90% 原生已存在）
| 分类 | 字段名 | 作用 | 状态 |
|---|---|---|---|
| **站位与跑动** | `lineShift` (-12..+12), `overlapDepthBonus`, `dualOverlap`, `falseNineDrop`, `boxCrashBonus` | 实时改变 `updateOffBallTargets` 无球跑位与防线高度 | `✅ 原生` |
| **逼抢与拦截** | `pressDistBonus`, `extraPresser`, `interceptRangeBonus`, `interceptProbBonus` | 改变逼抢半径、3 人合围、传球路径拦截半径与胜率 | 前 2 `✅ 原生`；后 2 `🔧 +6行` |
| **传射倾向** | `shortPassBias`, `throughPassBias`, `crossBias`, `longShotBias`, `gkQuickLaunch` | 实时改变 `decideOnBall` 持球决策权重 | `✅ 原生` |
| **倍率与对抗** | `staminaDrainMul`, `tempoMul`, `foulRateMul`, `cornerRateMul`, `freeKickRateMul`, `blockBonus`, `oppShotXgPenalty`, `oppThroughPassBonus`, `oppLongShotBonus`, `offsideTrapBonus`, `oppStaminaDrainPerMin` | 改变体能消耗、决策节拍、犯规/角球/任意球/封堵/造越位、对手威胁与每分钟持续压迫掉体 | 前 8 `✅ 原生`；后 3 `🔧 +8行` |
| **属性与默契** | `passingDelta`, `shootingDelta`, `defendingDelta`, `paceDelta`, `composureDelta`, `goalkeepingDelta`, `targetLine` (`GK/DEF/MID/ATT/ALL`), `chemistryMod`, `oppDebuff` | 实时增减指定线路球员属性、全队默契与对手减益 | `✅ 原生` |
| **内置机制标签** | `offside_trap`, `set_piece_nuke`, `super_sub`, `high_press_blitz`, `tiki_taka_flow`, `gk_counter_launch`, `wing_overload`, `long_shot_cannon`, `iron_wall_block`, `blood_frenzy` | 10 套已内置的专项足球机制 | `✅ 原生` |
| **免疫与规则标记** (`immunityFlags`) | `preventPenaltyOrRedOnce`, `immuneHighPressTackle`, `noCrossStylePenalty` | 生效期免疫 1 次禁区点球或红牌、免疫对手高压抢断加成、解除跨流派指令契合惩罚 | `🔧 +10行` |
| **主动技强化与预算字段** | `skillDualBranch`（中场指令期间主动技同时生效 A+B 双质变）、`skillTempRankBonus`（装备主动技临时 +1 Rank）、`tpCost`（手牌战术点消耗 1/2/3） | 统一驱动双质变、临时升阶与赛中战术点预算 | `🔧 +8行` |

### 2. 事件触发器总线（`EventHookRule`: `trigger -> action` · 新增 ~115 行统一引擎）
所有卫星 C 宗师质变、阵型联动、融合奇点统一配置为 `{ trigger, condition?, action, value }` 数组，引擎在 **14 个事件点** 统一派发 `dispatchHook(team, trigger, ctx)`：

| Trigger（14 个事件点） | 派发位置 (`MatchEngine.ts`) | 可配 Action（10 种真实结算动作） |
|---|---|---|
| `onTackle` | `handleHeldBall` 抢断成功 | `healTeam(pct)`：全队回体 `pct%` |
| `onIntercept` | `handlePassFlight` 拦截成功 | `drainOppStamina(pct)`：对手全队掉体 `pct%` |
| `onBlock` | `handleShotFlight` 封堵成功 | `cutSkillCd(min)`：全主动技 CD 减 `min` 分钟 |
| `onSave` | `handleShotFlight` 门将扑救 | `addShield(n)`：叠 `n` 层绝杀护盾（上限 2/3） |
| `onLongShotSaved` | `handleShotFlight` 远射（≥18m）被门将扑出 | `forceCornerProb(pct)`：扑出转角球率提至 `pct%`（如 80%） |
| `onPassStreak` | `handlePassFlight` 连续 N 脚成功传球 | `addCounter(n)`：叠 `n` 层反击威能（每层下脚射门 `+0.10 xG`） |
| `onCross` | `handlePassFlight` 边路传中成功 | `grantBypassOffside(ticks)`：赋予免越位状态 |
| `onShot` | `executeShot` 射门起脚 | `grantOnTarget(ticks)`：下次射门必射正且 xG `×1.15` |
| `onCorner` | `handleShotFlight`/`checkOutOfBounds` 获角球 | `stealTempo(ticks)`：削弱对手传控节拍与出球抗拦截 |
| `onOffsideTrap` | `executePass` 造越位成功 | `triggerMiniBuff(preset)`：触发 3~5 分钟短时爆发（提速/直塞/射门） |
| `onPossessionTick` | `drainFitness` 每分钟结算（按当前控球率判定） | `drainOppStamina` / `oppComposureDebuff`（控球 ≥55%/58% 触发） |
| `onDirectiveEnd` | `expireCommandBuffs` 指令到期（含 0 失球判定） | `extendDirective(min)` / `forceYellowCard` / `preventPenaltyOrRed` |
| `onSubIn` | `substitute` 替补登场 | （同上，用于换人延长指令、叠护盾与反击层） |
| `onConcede` | `handleShotFlight` 失球瞬间 | （同上，用于失球反扑回体、减 CD、触发短时狂攻） |

### 3. 主动技瞬时物理动作（`SkillInstantAction` · 原 7 种 + 补 3 种 = 10 种，新增 ~20 行）
- **原生 7 种**：`clear_danger`（强硬解围）、`instant_counter_pass`（极速长传反击）、`force_through_ball`（强制穿透直塞）、`force_shot_on_target`（校准死角射门）、`win_foul_setpiece`（前场造定位球+xG×1.35）、`GK_save_boost`（门神扑救/叠护盾）、`tempo_burst_intercept`（硬直对手+瞬步抢断）。
- **新增 3 种（~20 行）**：
  1. `force_cross_header`：边路持球人立刻起高球传中找禁区最高点前锋并触发抢点射门。
  2. `tactical_foul_stop`：中后场强行拉人战术犯规吹停对手必进单刀反击（不判点球，自身 35% 吃黄牌）。
  3. `gk_long_launch`：门将直接大脚精准制导找最前方前锋，并附带 `gkCounterBoostTicks = 50`（射门 xG `×1.25`）。

### 4. 主动技触发窗口（`SkillSituation` · 原 8 种 + 补 4 种 = 12 种，新增 ~15 行）
- **原生 8 种**：`opponent_through_ball`、`box_danger`、`attacking_final_third`、`wing_overload`、`counter_opportunity`、`midfield_press`、`trailing_late`、`any_possession`。
- **新增 4 种（~15 行）**：
  1. `set_piece_moment`（角球或前场任意球死球前瞬间）
  2. `leading_late`（70' 后领先守胜阶段）
  3. `just_conceded`（失球后 3 分钟内反扑窗口）
  4. `high_possession`（连续完成 ≥4 脚成功传递时）
