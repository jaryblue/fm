# 《再开一局》V5 卡片体系闭环设计文档（去元素化 · 异变词条 · 卡组预设终版）

> **核心定稿原则**：
> 1. **彻底去元素化，全游戏只有一种实体——战术卡**：砍掉抽象的「5 元素库存」与「双卡融合/单卡升阶」，改为**消耗卡自带 5 大基因色标，既能进卡组上场打、又能 2~3 张直接入炉发生化学反应**。
> 2. **异变不再是“歪出一张固定卡”，而是「合成词条系统（正面 / 负面 / 彩蛋）」**：投入反应釜合成时，你**一定会得到目标化学神卡**，同时根据基因冲突度触发 **正面超频 / 负面硬代价 / 稀有彩蛋** 三类异变词条（实时透明预览概率），彻底消除“合歪废卡”的挫败感。
> 3. **多套预设卡组（Deck Presets）**：在构筑页可配置并保存 **3~4 套预设卡组**（每套 `8~12 张`），开赛前可在门户/战术室 **1 键切换出战卡组**。
> 4. **防白嫖双铁律**：**0 阶风格常备卡永不消耗，但不可入炉**；**1~2 阶消耗卡仅剩余耐久 ≥ 2 次时才可入炉**（剩 1 次残血卡可打完或回收 **¥20 万** 资金）。
> 5. **97 张高区分度卡 + 15 条异变词条，零假机制**：25 基础常备 + 60 六大流派消耗 + 12 化学反应神卡；每张卡 100% 对齐 `MatchEngine.ts` 已有原语或 4 个明确新增钩子。

---

## 一、整套体系的唯一闭环（去元素化 · 卡合卡 · 预设卡组）

```
[赛后保底掉卡 / 侦察宗师洞察 / 赛后3选1 / 爆冷掉落 / 资金采购]
                         │
                         ▼
         【1~2 阶流派消耗卡（60 张，自带 5 色基因标）】
      🔴高压 · 🔵短传(稳) · 🟠边路 · 🟢铁血(中) · 🟣奇袭(爆)
                         │
          ┌──────────────┴──────────────┐
          ▼ (编入 1~4 号预设卡组)         ▼ (剩余耐久≥2次，2~3张入炉合成)
   【预设卡组 (每套 8~12 张)】      【化学反应釜（实时预览产物与词条概率）】
   • 自动含当前风格 0阶常备 4 张          ├──▶ 必定产出：目标 2/3 阶化学神卡 (12张)
   • 可选带 0阶传承卡《老队长的怒吼》     └──▶ 概率附魔：正面 / 负面 / 彩蛋 异变词条 (15条)
   • 自选 4~8 张消耗卡 / 神卡                    │
          ▲                                     │
          └────────────── 入库编入预设 ───────────┘
                         │
                         ▼ (开赛前 1 键切换带哪套卡组上场)
         赛中实际打出消耗卡 → 耐久 -1 → 归 0 销毁 → 驱动持续掉卡与炼卡
```

### 5 大基因色标的足球语义与合成特性（复用现有 `elem_*` 图标资产）
| 色标 | 基因名 | 足球语义 | 化学反应特性 |
|---|---|---|---|
| 🔴 | **高压 (`press`)** | 逼抢 / 抢断 / 造越位 / 高体耗 | **激进因子**：拉高负面代价与高爆发彩蛋概率 |
| 🔵 | **短传 (`pass`)** | 传控 / 默契 / 冷静 / 节奏 | **稳定剂**：显著降低负面异变率，提升正面超频概率 |
| 🟠 | **边路 (`wing`)** | 宽度 / 速度 / 传中 / 造角球 | **联动因子**：强化边路与造角球产出 |
| 🟢 | **铁血 (`iron`)** | 防守 / 扑救 / 体能 / 封堵 | **中和剂**：大幅中和 🔴/🟣 带来的负面硬代价 |
| 🟣 | **奇袭 (`blitz`)** | 射门 / 直塞 / 远射 / 造任意球 | **催化剂**：拉高进攻爆发与彩蛋词条触发率 |

---

## 二、卡组构筑与局内节拍（Deck Presets & Pacing）

### 1. 多套卡组构筑与赛前切换
- **3~4 套预设卡组槽位**：在「战术手牌工坊」顶部提供 **卡组 1 / 卡组 2 / 卡组 3（+1 解锁槽）** 切换与重命名（如 `预设1：传控主力`、`预设2：客场防反`、`预设3：绝境搏命`）。
- **单套卡组构成（8 ~ 12 张）**：
  - **绑定风格底牌（4 张，0 阶）**：随当前战术风格自动携带（切换风格时自动替换对应 4 张 0 阶底牌）。
  - **自由构筑位（4 ~ 8 张）**：可自由放入 `1~2 阶流派消耗卡`、`2~3 阶化学神卡`，或已解锁的 0 阶传承卡 `老队长的怒吼`。
- **赛前 1 键选卡组**：在门户备战页（`PortalScreen`）与战术室（`TacticsScreen`）的开赛按钮旁，展示当前出战卡组标签（如 `出战卡组：预设1 (10张)`），支持 1 键下拉/循环切换预设；若某张消耗卡耐久已耗尽归 0，开赛前自动高亮提示并顺延替补/忽略。

### 2. 四阶分级与防白嫖规则
| 阶级 | 视觉标识 | 耐久 | 是否可入炉 | 数量 | 核心来源 |
|---|---|---:|---|---:|---|
| **0 阶 · 常备** | 冷蓝/银灰边，**无次数** | 永不消耗 | **不可入炉** | **25 张** | 6 风格×4 张 + 序章传承卡 `老队长的怒吼` |
| **1 阶 · 实用** | 湛蓝/翡翠边，**`剩 3 次`** | 3 次 | **剩 ≥2 次可入炉** | **36 张** | 赛后保底掉落 / 侦察宗师 / 3选1 / 资金购 |
| **2 阶 · 王牌 / 神卡** | 紫金边，**`剩 2 次`** | 2 次 | **剩 ≥2 次可入炉** | **33 张**（24 流派 + 9 化学） | 流派卡：3选1/爆冷/资金购；神卡：**仅反应釜** |
| **3 阶 · 传说神卡** | 耀金流光边，**`剩 1 次`** | 1 次 | 不可入炉 | **3 张** | **仅化学反应釜**（3 张卡或 2 张 2 阶卡合成） |

- **仅打出才扣次**：带进卡组但未抽到/未打出的消耗卡，赛后不扣耐久。
- **残血卡去向**：打到只剩 `剩 1 次` 的残血卡不可入炉，玩家可选择打完最后 1 次，或直接回收换取 **¥20 万** 俱乐部资金。

### 3. 局内摸牌与能量节拍（全场精炼打 6~8 张，绝不抢看球戏份）
- **摸牌**：开球摸 **3 张**（手牌上限 **4 张**）；每 **15 分钟**自动摸 1 张、**中场休息**摸 2 张；场上触发**丢球 / 门将扑救(每半场限1次) / 换人(每场限2次)** 额外摸 1 张；抽牌堆空时仅将打过的 0 阶常备牌洗回。
- **能量**：开场 **2 费**，每 **15 分钟**回 **1 费**，中场额外回 **1 费**（上限 **5 费**，全场自然产出 8 费）。
- **六大球队态势（Stance，互斥）**：`【传控】` / `【绞杀】` / `【两翼】` / `【防反】` / `【铁桶】` / `【阵地】`。
- **时机减费窗口放宽**：所有 `刚丢球 0 费` / `扑救后 0 费` 窗口统一为 **6~8 分钟**，确保 `2x~8x` 倍速下也能从容点击。

---

## 三、合成异变词条系统（正面 / 负面 / 彩蛋 · 取代固定异变卡）

投入反应釜合成时，**产物卡本体保持不变**（必定拿到目标化学神卡或同色 2 阶王牌），同时系统按投入基因的平衡度实时计算 **「词条附魔概率」**，并在预览面板透明展示：

- **纯净产出**（无额外词条）：基础 `🔵/🟢` 稳健配方 `55%~75%` 概率纯净出卡。
- **正面超频词条（+）**（约 `15%~25%` 概率）：
  1. `【零耗超频】` 本卡费用 `-1`（最低 0 费）
  2. `【持久续杯】` 本卡初始耐久 `+1` 次
  3. `【开场先声】` 本卡开球必在起手 3 张内（不卡手）
  4. `【态势共鸣】` 任意态势下均可直接触发本卡连击效果
  5. `【回能虹吸】` 打出本卡后额外返还 `1 费`
- **负面硬代价词条（-）**（随 🔴/🟣 冲突度浮动 `0%~40%`，纯足球场上代价）：
  6. `【红黄警告】` 本卡生效期间全队犯规率 `×2.0`（极易吃黄红牌）
  7. `【体能透支】` 效果结束后全队体能 `-14%`
  8. `【防线冒险】` 生效期间防线额外 `+6m`、后卫回追 `-8`（易被打身后）
  9. `【狂躁独狼】` 生效期间全队传球与默契 `-15`
  10. `【重甲沉滞】` 生效期间全队速度 `-5`
  11. `【赌命压迫】` 生效期间对手直塞渗透成功率 `+20%`
- **稀有彩蛋奇遇词条（★）**（3 卡/高爆发配方 `5%~12%` 触发，高光机制）：
  12. `【瓜迪奥拉的笔记】` 生效期间每完成 6 脚短传，全队回体 `+3%`
  13. `【弗格森时间】` 80' 后打出时费用变为 `0 费` 且属性加成翻倍
  14. `【穆氏大巴玄学】` 我方领先时打出，对手禁区内射门 xG `-22%`
  15. `【天选绝杀哨】` 85' 后未领先时打出，立即额外制造 1 次前场任意球/角球

> **交互体验**：玩家在反应釜放入 2~3 张卡时，右侧实时显示：
> `预期产物：【瓜式反抢控球】(2阶)` · `纯净 60% | 正面超频 25% | 负面代价 10% | 彩蛋 5%`，真正做到**高风险主动博弈、不赌盲盒**。

---

## 四、引擎实装对齐表 & 97 张卡池清单

### 1. 引擎对齐红线（`MatchEngine.ts` 复用原语 + 5 个轻量新增钩子）
- **复用原语**：全队/单线/核心/替补属性修正、体能瞬回与结束反噬、10 种 `mechanic`、以及 `TacticalMods` 13 个字段。
- **本次新增 5 个轻量钩子**：
  1. `getEffectiveMods(team)`：将激活中的卡片 `tacticalMod`（含 `shootBias`、`tempoMul`、`widthScaleDelta`、`blockBonus`、`setPieceXgMul`）合入 `homeMods/awayMods`。
  2. `foulRateMul`：挂在抢断犯规判定处，驱动 `【红黄警告】` 等纯足球代价。
  3. `cornerRateMul` / `freeKickRateMul`：挂在封堵出底线与突破犯规判定处，联动下阶段「角球/任意球」子弹时间技能。
  4. `tempChemistryMod`：挂在传球默契判定处，支持中轴/边路/全队默契拉升或降低。
  5. `oppDebuff`（`oppFitnessDelta` / `oppComposureDelta`）：支持 `消耗战拖垮`、`心理窒息防线` 对对手施加体能与冷静削弱。

### 2. 技能系统联动钩子（Cards & Deck → Active Skill Synergy）
为后续「子弹时间主动技」系统预留 3 层无缝联动钩子，确保**组什么卡组、打什么牌，直接影响场上更容易放出哪些大招**：
1. **局面造势供弹（物理层）**：通过 `cornerRateMul`、`freeKickRateMul`、`throughPassBias`、`longShotBias` 直接提高角球、任意球、直塞单刀、远射局面频率，从而高频触发对应的「角球战术」「游龙任意球」「直塞刺穿」「重炮轰门」主动技弹窗。
2. **单卡触发加权与超频（`skillSynergy` 字段）**：
   - 卡牌可选携带 `skillSynergy: { targetSkillTags: string[]; promptBonusRate?: number; freeCooldownOnce?: boolean; rankBoost?: number }`。
   - **弹窗加权（`promptBonusRate`）**：卡片生效期间，匹配标签的主动技在 `evaluateActiveSkillTriggers` 中放宽触发阈值并提升采样权重（如打出高压卡更易弹「高位合围」主动技）。
   - **冷却重置与超频（`freeCooldownOnce` / `rankBoost`）**：打出特定 2~3 阶王牌卡/化学神卡时，直接重置对应主动技冷却，并标记下一次释放为 `isCardBoosted = true`（临时 `+1 Rank`）。
3. **卡组主导基因共鸣（Deck Archetype Synergy）**：
   - 开赛时统计当前出战「预设卡组（8~12 张）」的主导基因色标（如某一基因 `≥ 4 张`）：
     - `🔴高压主导`：逼抢/反抢类主动技冷却 `-20%`；
     - `🔵短传主导`：渗透/组织类主动技熟悉度门槛 `-10`；
     - `🟠边路主导`：传中/角球类主动技触发率 `+25%`；
     - `🟢铁血主导`：防线/门神类主动技持续时间 `+4 分钟`；
     - `🟣奇袭主导`：远射/任意球/绝杀类主动技初始自带 1 次 `+1 Rank` 超频充能。

### 3. 完整 97 张卡池结构
- **0 阶 · 基础常备卡（25 张）**：6 大风格 × 4 张（起手切态势 / 进攻偏好 / 防守节奏 / 连击时机）+ 序章传承卡 `老队长的怒吼`（1费/15分/70'落后0费，全队冷+10/射速+6/回体+10%）。
- **1~2 阶 · 六大流派消耗卡（60 张）**：每流派 6 张 1 阶（1费/剩3次）+ 4 张 2 阶（2费/剩2次），自带 5 色基因标，剩余 ≥2 次可入炉。
- **2~3 阶 · 化学反应专属神卡（12 张）**：9 张 2 阶神卡（2 张 1 阶卡合成）+ 3 张 3 阶传说神卡（3 张卡或 2 张 2 阶卡合成，商店买不到，仅反应釜产出）。
- **同色双卡兜底**：投入 2 张同色 1 阶卡时，0% 负面异变，直接从对应流派 2 阶王牌池随机（或 3 选 1）产出 1 张 2 阶王牌卡；禁止 `1张1阶 + 1张2阶` 2 卡直接合成（提示再补 1 张升 3 阶传说）。

---

## 五、全项目联动改造清单（卡牌大改后的关联系统）

经全仓扫描，V5 体系上线时需要同步联动改造以下 **8 个关联系统**：

| 关联模块 | 涉及文件 | 联动改造内容 |
|---|---|---|
| **1. 卡牌数据与合成核心** | [CommandCards.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/CommandCards.ts) | 替换为 97 张 V5 卡表 + 15 条异变词条；实现无序基因反应釜求解器 `previewReactor()` / `craftFromReactor()`；移除 `TACTICAL_ELEMENTS` 与 `fuseCoachCards()`。 |
| **2. 存档结构与赛季管理器** | [types.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/types.ts)、[LeagueManager.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/LeagueManager.ts) | `elementInventory` & `coachLoadoutIds(4槽)` 替换为 `cardInventory`（带剩余耐久与词条）+ `deckPresets(3~4套, 每套8~12张)`；新增 `consumePlayedCardUses()` 仅扣实际打出卡耐久；`deserialize()` 兼容迁移旧存档。 |
| **3. 赛前侦察与破绽共振** | [OpponentScouting.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/OpponentScouting.ts) | 将「破绽共振（手牌减费+5分）」的匹配逻辑从旧元素改为**匹配当前出战卡组中对应基因色标的消耗卡/神卡**，保持侦察抓破绽的高收益闭环。 |
| **4. 赛后奖励与随机事件** | [PostMatchReDraftScreen.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/screens/PostMatchReDraftScreen.ts)、[PostMatchEvents.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/PostMatchEvents.ts) | 赛后固定掉落改为 **1 阶战术卡（胜2/平负1）**；`craft_card` 3选1与事件奖励改为「直接获得本流派 2 阶卡 / 现有消耗卡补满耐久 / 赋予正面超频词条」。 |
| **5. 手牌工坊界面** | [CardCraftScreen.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/screens/CardCraftScreen.ts) | 移除元素库存与双模式切换；顶部改为 **「3~4 套预设卡组构筑与切换栏」**；背包支持同名同耐久堆叠与 **残血卡回收 ¥20 万**；右侧反应釜展示 **实时产物 + 正/负/彩蛋概率条**。 |
| **6. 赛前卡组切换入口** | [PortalScreen.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/screens/PortalScreen.ts)、[TacticsScreen.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/screens/TacticsScreen.ts) | 在开赛按钮旁与战术室增加 **「出战卡组：预设 1/2/3」** 1 键切换器；若预设内有耗尽归 0 的卡，自动标黄提醒。 |
| **7. 比赛日与引擎联动** | [MatchEngine.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/engine/src/MatchEngine.ts)、[MatchDayScreen.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/screens/MatchDayScreen.ts) | 接入 `teamStance` 与 5 个轻量钩子；比赛日右下角复用 4 槽展示动态摸牌，左侧增加 **当前态势徽章 + 牌库/弃牌计数**，0 费时机卡与异变词条卡高亮边框。 |
| **8. 成就 / 引导 / 资源与 CLI** | [Achievements.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/Achievements.ts)、[TutorialOverlay.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/TutorialOverlay.ts)、[AssetLoader.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/AssetLoader.ts)、[cli_playtest_driver.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/scripts/cli_playtest_driver.ts) | 更新「合成/异变」成就判定与 `cards` 引导文案；复用 `elem_*` 图作为 5 色基因徽标；同步更新 CLI 驱动测试反应釜、词条概率、预设切换与耐久消耗。 |


---

## 六、后续可选卡面插画扩展提示词（6 大流派 + 12 张化学神卡）

> **统一画风规范（对齐现有卡面窗口 `2:1` / `16:9`）**：
> `Stylized football tactical card illustration, dark navy slate stadium night background (#0B1220), crisp cel-shaded sports anime / broadcast graphic aesthetic, dramatic rim lighting, dynamic motion trails, clean composition centered for horizontal card frame, NO text, NO letters, NO numbers, NO watermarks.`

### 1. 六大流派基础卡面插画（6 张，覆盖 0~2 阶流派卡）
1. **`card_style_tiki_taka.webp`（传控渗透）**：
   - `Three football midfielders forming a glowing cyan geometric passing triangle on dark pitch, crisp short-pass laser lines connecting their boots, calm tactical control aura, cyan and gold rim light.`
2. **`card_style_gegenpress.webp`（高位逼抢）**：
   - `Two aggressive pressing forwards lunging simultaneously to trap an opponent defender near the touchline, intense crimson shockwave rings and speed lines, high-energy heavy metal football atmosphere.`
3. **`card_style_wing_play.webp`（两翼齐飞）**：
   - `Blistering fast winger sprinting down the left flank whipping a curving glowing orange cross into the penalty box, overlapping fullback trail behind, dynamic motion blur, amber and emerald turf.`
4. **`card_style_counter.webp`（快速反击）**：
   - `Lone striker exploding forward in a lightning-fast counterattack breakaway behind a stretched defense, violet sonic boom trail from midfield long ball, dramatic floodlight beams.`
5. **`card_style_park_bus.webp`（铁桶防反）**：
   - `Compact fortress wall of four defenders and a heroic goalkeeper guarding the penalty box, glowing emerald hexagonal energy shield across the six-yard line, rain-soaked resilient atmosphere.`
6. **`card_style_balanced.webp`（均衡阵地）**：
   - `Commanding team captain midfielder in the center circle orchestrating play with glowing golden tactical HUD rings around the pitch, balanced offensive and defensive formation lines.`

### 2. 12 张化学反应专属神卡插画（12 张，2~3 阶专属）
1. **`card_chem_pep_press.webp`（瓜式反抢控球）**：
   - `Tactical midfield maestro instantly winning the ball back and launching a precise short pass, dual cyan-and-crimson energy vortex around the ball, sleek modern stadium night.`
2. **`card_chem_klopp_wing.webp`（克氏边路狂潮）**：
   - `Explosive high-pressing winger stealing the ball high up the pitch and unleashing a blazing cross, crimson-to-amber fire trail, roaring stadium crowd silhouette.`
3. **`card_chem_ancelotti_counter.webp`（安氏防反艺术）**：
   - `Calm goalkeeper catching a shot and launching an effortless pinpoint long pass into open space where a striker sprints free, emerald and violet light arcs, composed elegance.`
4. **`card_chem_wingback_wall.webp`（翼卫狂飙防线）**：
   - `Three armored center-backs holding a solid emerald line while twin wingbacks streak forward along both touchlines with glowing amber jetstreams.`
5. **`card_chem_longshot_banger.webp`（禁区外世界波）**：
   - `Midfielder striking a thunderous volley from 25 yards outside the penalty box, blazing violet-and-cyan comet trajectory curving toward the top corner, dramatic impact flare.`
6. **`card_chem_setpiece_factory.webp`（定位球制造机）**：
   - `Golden glowing corner flag and free-kick arc curving dangerously into a crowded penalty box with towering attackers rising for headers, amber and violet spotlight.`
7. **`card_chem_offside_psych.webp`（心理窒息防线）**：
   - `Synchronized back four stepping forward in unison to spring a glowing crimson laser offside trap, leaving opponent strikers stranded behind, ice-cold tactical precision.`
8. **`card_chem_stamina_engine.webp`（体能永动机）**：
   - `Tireless box-to-box midfielder glowing with emerald and cyan bio-energy rings, effortlessly gliding across the pitch late in the match, fresh cool mist aura.`
9. **`card_chem_final_ten_blitz.webp`（最后十分钟狂攻）**：
   - `All-out final-minutes siege with waves of attackers flooding the opponent penalty area under blazing stadium floodlights, intense crimson and violet overdrive aura.`
10. **`card_chem_golden_chem.webp`（黄金化学反应 · 3阶传说）**：
    - `Entire starting eleven linked by luminous golden constellation lines across the pitch, radiant mythic gold-and-cyan aura pulsing from the center circle, championship prestige.`
11. **`card_chem_total_football.webp`（全能战术大师 · 3阶传说）**：
    - `Fluid swirling tactical formation where players seamlessly interchange positions in a multi-color prism vortex of cyan, emerald, and gold, visionary total football.`
12. **`card_chem_doomsday_attack.webp`（末日总攻令 · 3阶传说）**：
    - `Apocalyptic all-out attack charge with five forwards crashing the box amid crimson lightning and violet shockwaves, high-risk decisive strike atmosphere.`
