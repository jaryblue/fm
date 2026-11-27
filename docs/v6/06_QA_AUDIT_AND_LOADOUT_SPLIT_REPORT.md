# 《再开一局》V6 测试审计与手牌装配独立化报告

> **审计日期**：2026-11-26  
> **对照基线**：`docs/v6/00_ENGINE_BUS_AND_INDEX.md`、`docs/v6/05_RULES_ECONOMY_AND_UX_SPEC.md`  
> **审计范围**：`@fm-league/engine`、`@fm-league/core`（含 `v6` 模块与 `LeagueManager`）、`@fm-league/game-ui`（含比赛日、门户、星盘、赛后结算）

---

## 一、测试执行概览

本次采用**静态类型扫描 + Node 集成实测 + 界面代码走查**三路验证：

1. **TypeScript 静态类型检查**：
   - `packages/engine/tsconfig.json`、`packages/core/tsconfig.json`、`packages/game-ui/tsconfig.json` 直接执行 `tsc -p` 均因 `moduleResolution=node10` 报错（`TS5108`）阻断。
   - 切换 `--moduleResolution bundler` 对源码进行全量扫描后，共检出 **60+ 处隐藏类型错误**（含直接导致比赛手牌失效、门户显示 `undefined`、赛后结算崩溃的 P0/P1 缺陷）。
2. **V6 核心数据与 90 分钟引擎集成实测**：
   - **数据规模**：122 张手牌、366 颗卫星、59 个主动技、92 条被动、18 个融合奇点、6 个宗师印，全量通过 `compileDirectiveToEffect` 编译校验（122/122 成功，0 失败）。
   - **防跨级校验**：`canUnlockV6Node` 对未连通前置的被动、手牌、主动技、融合奇点均准确拦截并给出前置提示（注：传入不存在的非法 ID 时当前会回落为 `ok: true`，建议顺手加一层存在性兜底）。
   - **引擎 90 分钟实况**：`compileAstrolabeToMatchSetup`、`MatchEngine.applyCommandCard` 与 `MatchEngine.triggerActiveSkill`（实测触发 `手术刀直塞` 穿透直塞）均可正常推进至 95' 终场。
3. **UI 与交互流走查**：
   - 定位到**比赛界面手牌完全打不出去**、**门户首页摘要显示 `undefined·undefined`**、**第 1~3 轮赛后新卡解锁界面崩溃**以及**手牌装配混在星盘顶部**的根本原因。

---

## 二、Bug 清单（按严重程度分级）

### P0 · 阻断级（直接导致核心玩法失效或崩溃）

#### 1. 比赛界面手牌完全打不出去（数据结构错位导致全字段 `undefined`）
- **位置**：
  - `packages/core/src/LeagueManager.ts`（`getV6CheckpointDirectives`，第 1121 行）
  - `packages/game-ui/src/screens/MatchDayScreen.ts`（第 156、798–802、2504–2548 行）
- **根因**：
  - `LeagueManager.getV6CheckpointDirectives(checkpoint)` 返回的是包装对象数组：
    `Array<{ def: V6DirectiveDef; effect: CommandCardEffect; satellites: V6SatelliteKey[] }>`。
  - 但 `MatchDayScreen.ts` 将 `v6Checkpoints` 错声明为 `Record<V6CheckpointKey, V6DirectiveDef[]>`，并直接赋值 `p20: league.getV6CheckpointDirectives('p20')`。
  - 渲染与点击逻辑 `cpCards.slice(0, 4).forEach((def, ci) => ...)` 直接读取外层包装对象的属性：
    - `def.tpCost` 为 `undefined`，`canPlay` 判定 `this.v6Tp >= def.tpCost`（即 `4 >= undefined`）**永远为 `false`**；
    - `if (canPlay) hits.add(...)` **不会注册任何点击热区**，点击手牌完全无响应；
    - `def.id`、`def.name`、`def.zone`、`def.benefitSummary`、`def.riskSummary` 全部为 `undefined`，卡片显示缺失，`playV6Directive(def)` 内部也全部读空。

#### 2. 比赛前 20 分钟（0'–20'）手牌处于锁死不可用状态
- **位置**：`packages/game-ui/src/screens/MatchDayScreen.ts`（第 803–806、1029–1037、2492–2540 行）
- **根因**：
  - 比赛开局时 `v6ActiveCheckpoint` 初始化为 `null`、`v6Tp` 为 `0`，直到第 20 分钟才触发 `openV6Checkpoint('p20')`。
  - 在 0'–20' 期间，`canPlay` 要求 `!!activeCp`，导致 4 张手牌在进场后长达 20 分钟（实况几十秒）全部处于锁定状态（`20' 解锁`），除非点亮了均衡宗师印才有一个「紧急叫停(1)」按钮。
  - 玩家进场第一眼看到的就是“所有手牌全是灰的、点不动”，到 20' 触发后又撞上 P0-1 的 `undefined` Bug，形成“全程一张牌都打不出去”的体验。

#### 3. 第 1~3 轮赛后新卡教学弹窗必现 `ReferenceError` 崩溃
- **位置**：`packages/game-ui/src/screens/PostMatchReDraftScreen.ts`（第 713、733、741 行）
- **根因**：
  - `renderCardUnlockView()` 中第 733、741 行调用了 `fitText(...)`，但文件顶部从 `../CanvasKit` 导入列表中**缺少 `fitText`**（`tsc` 报错 `Cannot find name 'fitText'`）。
  - 第 713 行读取了 `card.description`，而 `CommandCard` 类型上不存在 `description` 字段（应为 `card.summary`）。

---

### P1 · 严重级（显性展示错误、状态残留、类型断裂）

#### 4. 门户首页「三区指令池」摘要显示 `undefined·undefined` 与 V5 残留
- **位置**：`packages/game-ui/src/screens/PortalScreen.ts`（第 133、525–531、557 行）
- **根因**：
  - 第 557 行同样把 `getV6CheckpointDirectives('p20')` 返回元素当成 `V6DirectiveDef`，写了 `p20Cards.slice(0, 2).map(c => c.name)`，导致门户摘要渲染出 `undefined·undefined`（应为 `c.def.name`）。
  - 第 525–531 行残留未使用的 V5 卡组变量（`deckPresets`、`loadoutCards`、`deckWarn`）。
  - 第 133 行读取了 `LeagueClub` 上不存在的 `club.transferBudget`（当前资金统一在 `league.getClubFunds()`）。

#### 5. `MatchDayScreen.dispose()` 未清理 V6 赛中状态
- **位置**：`packages/game-ui/src/screens/MatchDayScreen.ts`（第 175–194 行）
- **根因**：`dispose()` 未重置 `leagueRef`、`v6ActiveCheckpoint`、`v6TriggeredCheckpoints`、`v6ZoneCurtains`、`v6ActiveCapsules`、`v6Tp`、`v6CheckpointPlayedCount`、`v6CheckpointUsedIds` 与 `v6HoveredZone`，比赛异常退出或重开时可能残留上一场状态。

#### 6. `V6CheckpointKey` 类型未在 `packages/core/src/v6` 中定义导出
- **位置**：`packages/core/src/v6/types.ts`、`packages/core/src/v6/index.ts`
- **根因**：`MatchDayScreen.ts`（第 24 行）和 `MetaScreen.ts`（第 42 行）均导入了 `V6CheckpointKey`，但 `v6` 模块未定义并导出 `export type V6CheckpointKey = 'p20' | 'p45' | 'p70'`。

---

### P2 · 工程配置与技术债

#### 7. 编译门禁失效与局部类型债务
- **位置**：
  - `packages/engine/tsconfig.json`、`packages/core/tsconfig.json`、`packages/game-ui/tsconfig.json`（`TS5108: Option 'moduleResolution=node10' has been removed`）
  - `packages/engine/dist/`（最后编译时间 `Nov 24 13:12`，滞后于 `src/types.ts` 的 `Nov 26` 更新，导致 `tsc` 解析 `@fm-league/engine` 时报 40+ 找不到 `EventHookRule`/`ImmunityFlags`/`tacticalMod` 的假错误，掩盖了真实 UI 类型错误）
  - `packages/game-ui/src/screens/ClubRosterScreen.ts`（第 542–543 行调用未在参数类型中声明的 `actions.onSave` / `actions.onToast`）
  - `packages/game-ui/src/screens/CardCraftScreen.ts`（第 865–892 行存在 7 处旧类型报错）
  - `packages/core/src/SkillWeb.ts`（第 752 行缺少 5 个新 `SkillMutationTag` 的文案映射）

---

## 三、与 V6 设计目标的逐项对比

| 设计目标模块 | 设计文档要求 | 当前实现状态 | 评估结论 |
| :--- | :--- | :--- | :--- |
| **星盘节点规模** | 122 手牌 + 366 卫星 + 59 主动技 + 92 被动 + 18 融合奇点 + 6 宗师印 + 圆心双轨 | 目录、数据与解锁规则全量就绪 | **已达标** |
| **连线与防跨级** | 显式星宿连线、禁止跨节点解锁、沿用高清雕纹素材 | `Pass 1/2/3` 完整绘线、`canUnlockV6Node` 校验、`drawSkillGlyph` 已接入 | **已达标** |
| **旋转锁盘与迷雾** | 未锁盘可旋转对齐 6 奇点、锁盘铺路、洗点重置、T7 渐进迷雾 | `MetaScreen` + `AstrolabeManager` 完整支持 | **已达标** |
| **引擎原子总线** | 14 触发点 × 13 动作、10 瞬时物理干预、12 局势、免疫/双质变/`+1 Rank` | `MatchEngine.ts` 已全量接入并通过 90 分钟实测 | **已达标** |
| **20'/45'/70' 拐点拍板与 2D 视效** | 4 TP + 最多结余 2 TP、0.05x 慢放、悬停预览、2s 光幕箭头、双色胶囊 | 渲染与底层均已编写，但因 `v6Checkpoints` 类型错位导致**赛中完全打不出去** | **P0 失效** |
| **手牌/主动技装配功能** | 清晰高效地配置每拐点 4 张手牌与 4 个主动技，不干扰星盘构筑 | **强行挤在 `MetaScreen` 顶部 48px 窄条**，挤压星盘视野且无法横向对比筛选 122 张牌；原 `cards` 导航入口被隐藏重定向 | **设计偏离，需独立拆分** |
| **赛后 3 选 1 肉鸽扩容** | 6 大类单赛季词条/圣物替换旧背包体系 | 按此前约定**暂缓扩容**，目前仍沿用旧版 10 类盲盒与旧卡掉率 | **按约暂缓** |

---

## 四、手牌装配独立化改造方案与修复优先级

### 1. 手牌装配独立化方案（UX 架构拆分）

将「**星盘构筑（Meta 解锁与路线规划）**」与「**临场配装（赛前选牌与技能槽编排）**」彻底解耦：

1. **恢复独立一级页签「指令配装」**：
   - 恢复 `CanvasKit.ts` `drawNavRail()` 中的第 7 个（或替换旧 `cards` 位置）导航入口：**「指令配装」**，路由指向新建的 `DirectiveLoadoutScreen.ts`（取代已废弃的 V5 `CardCraftScreen.ts`）。
   - `PortalScreen` 的「前往星盘配牌 / 调整技能」按钮统一跳转至该独立配装页。
2. **`DirectiveLoadoutScreen.ts` 三区布局设计**：
   - **顶部出战槽区**：
     - 左侧：切换 `通用池(全拐点共用)` / `分拐点(20' / 45' / 70')`，清晰展示当前拐点的 **4 张手牌槽位**（直接显示费用 `1/2/3 TP`、区域色条 前红/中蓝/后绿、攻/守倾向、已点亮卫星数 `★0~3`，支持点击卸下或调整顺序），并附带「一键按当前阵型/打法推荐配牌」按钮。
     - 右侧：**F1–F4 主动技槽位**，支持直接切换 A/B 质变分支或卸下。
   - **下方已解锁牌库 / 技能库浏览器**：
     - 支持按「手牌 / 主动技」切换，以及按 **区域（前/中/后）**、**倾向（攻/守）**、**费用（1/2/3 TP）**、**来源（当前流派/阵型/融合王牌）** 筛选；
     - 选中任意手牌时，右侧面板直接对比其「🟢 收益 vs 🔴 代价」与卫星 A/B/C 效果，点击即可一键装配至当前拐点槽位。
3. **`MetaScreen.ts` 彻底减负**：
   - 移除顶部 48px 的 `renderLoadoutBar()`，将星盘画布高度从 `540px` 扩大至约 `590px`，释放星盘全景视野；
   - 星盘仅保留「旋转双环 / 锁盘 / 洗点 / 破雾 / 点亮节点与卫星」，并在右侧检视抽屉中保留快捷跳转「前往指令配装 ▶」按钮。

### 2. 建议执行顺序

1. **Phase 1（优先修复全部 P0/P1 阻断 Bug）**：
   - 在 `packages/core/src/v6/types.ts` 补全并导出 `V6CheckpointKey`；
   - 修复 `MatchDayScreen.ts` 中 `v6Checkpoints` 的包装类型解包（`entry.def` / `entry.effect`）与 `dispose()` 状态清理，并优化开局 0'–20' 的拍板引导（例如开局提供可选「起手拍板」或明确提示）；
   - 修复 `PortalScreen.ts` 的 `c.def.name` 与清理 V5 死代码；
   - 修复 `PostMatchReDraftScreen.ts` 缺失 `fitText` 导入与 `card.summary`；
   - 修复 `tsconfig.json` 并重新构建 `packages/engine`，保证 `tsc --noEmit` 全仓 0 报错。
2. **Phase 2（手牌装配独立化改造）**：
   - 新增 `DirectiveLoadoutScreen.ts` 并接入 `NavRail` 与 `GameApp.ts`；
   - 清理 `MetaScreen.ts` 顶部配装条与废弃的 `CardCraftScreen.ts`。
3. **Phase 3（验收回归）**：
   - 跑通 `tsc` 全仓检查 + `MatchEngine` 集成测试 + 实际界面逐屏点击验收（确认手牌在赛中可正常悬停预览、点击拍板、触发 2s 光幕与双色胶囊、完成赛后结算）。
