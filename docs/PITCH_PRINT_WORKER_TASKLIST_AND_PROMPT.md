# 《再开一局》(Kickoff Again) — PITCH PRINT v1.0 全量视觉收口力工任务清单与执行 Prompt

> **文档性质**：主美逐页全量巡检（对照 `shots/ui-all/*.png` 全套实拍截图与源码）后的最终收口任务单。覆盖全部 **12 个主页面 + 7 个弹窗/浮层 + `GameApp.ts` 全局提示**，确保无任何一页遗漏。

---

## 一、全项目 12 页面 + 7 弹窗零遗漏清点矩阵

### 1. 主界面（12 个 Screen 文件）

| 序号 | 页面文件 (`packages/game-ui/src/screens/`) | 当前状态（主美核验结论） | 本次归属 |
| :--- | :--- | :--- | :--- |
| 1 | `TitleScreen.ts` — 标题页主画面 | **已达标**：PITCH PRINT 徽章 Logo + 暖白存档档案卡 + 英雄剪影 | **主画面禁改**（仅待设计出新 Logo / 8 张底图后由主美接入） |
| 2 | `TitleScreen.ts` — 建队向导 Step 1 & Step 2 | **未迁移**：左侧球衣卡与 Step 2 战术画像/手牌面板仍是旧深海蓝 `#0B1220` + 青蓝霓虹框；存在「手术刀直」截断 | **派给力工 · T2** |
| 3 | `PrologueScreen.ts` — 老将序章（第1~3幕） | **小瑕疵**：第 361 行正文在「通道尽头泛着刺眼」处被截断；第3幕双抉择卡与顶部条待加强 PITCH PRINT 硬墨线对比度 | **派给力工 · T1** |
| 4 | `DraftScreen.ts` — 核心开包（5选3） | **已达标**：红带机密牛皮档案袋撕开 + 5 选 3 + 墨线选手卡 | **禁改** |
| 5 | `PortalScreen.ts` — 备战门户（含连体球票 & 融合夹板） | **主框架已达标**：连体撕票、图钉导航、融合备战夹板四段指令已定标；唯「圣物 0/5」仅纯文字展示 | **仅增量补齐圣物 5 槽展示 · T3**（严禁破坏球票与夹板） |
| 6 | `LeagueScreen.ts` — 联赛赛程与积分榜 | **基本达标**：有 1 处英中混写 `R1·下场` 需改纯中文，统计 Tab 需统一硬墨线风格 | **派给力工 · T4** |
| 7 | `TacticsScreen.ts` — 战术与阵容（Tab ①②） | **待修复与重绘**：球场微卡 `CDM` 被截成 `C...`；顶栏 `② 指令与绝技 (4/4·2/4)` 没同步四段 16 卡；Tab ② 工作台与圣物条待翻新 | **派给力工 · T5** |
| 8 | `ClubRosterScreen.ts` — 引援中心（4 个 Tab） | **一线队 Tab 已达标**；青训学院 / 转会市场 / 经纪人密荐与特训 3 个 Tab 需排查统一样式 | **派给力工 · T6** |
| 9 | `MetaScreen.ts` — 八卦星盘 & 俱乐部基建 | **已达标**：8×8 基建 + 八卦星盘已完成 | **禁改** |
| 10 | `HallOfFameScreen.ts` — 历史荣誉室与编年史 | **待补强**：顶栏与 Tab 编年史计数不一致（0/7 vs 1/7）；`Shuffle Draft` 英文残留；左栏下方大片空白与奖杯未翻新 | **派给力工 · T7** |
| 11 | `MatchDayScreen.ts` — 比赛日（入场/赛中/终场） | **【高优重灾区】**：5 个实拍硬 BUG（Logo压字、双横幅重叠、球场浮字撞GK与截断、71'-9... 截断+「稳健拼图」错词+印章压字、终场弹窗深蓝旧皮+MVP 截断） | **派给力工 · T8** |
| 12 | `PostMatchReDraftScreen.ts` — 赛后复盘与3选1盲盒 | **【高优重灾区】**：演播室统计标签撞黄条、顶部文字截断、3选1 还是旧版紫色科幻电弧盲盒 + `x%/y%/z%` 公式文案、领奖框空洞 | **派给力工 · T9** |
| 13 | `SeasonEndScreen.ts` — 赛季收官与休赛期引援 | **【高优重灾区】**：全页旧深海蓝 `#0B1220` + 奇幻金边宝箱 + 个人奖项卡无头像无暖纸质感 | **派给力工 · T10** |

### 2. 弹窗 / 浮层 / 全局提示（7 弹窗 + 1 全局）

| 序号 | 组件文件 (`packages/game-ui/src/`) | 当前状态 | 本次归属 |
| :--- | :--- | :--- | :--- |
| 1 | `SettingsModal.ts` — 游戏设置弹窗 | **已达标**：PITCH PRINT 暗调框 + 暖纸快捷键说明 | **禁改** |
| 2 | `SaveSlotModal.ts` — 存档位管理弹窗 | **已达标**：PITCH PRINT 暖纸槽位卡 + 朱红 CTA | **禁改** |
| 3 | `TextInputModal.ts` — 文本输入弹窗 | **已达标**：暖纸白弹窗 + 深墨输入区 | **禁改** |
| 4 | `ConfirmModal.ts` — 二次确认弹窗 | **已达标**：暖纸危险弹窗 + 朱红确认 | **禁改** |
| 5 | `TutorialOverlay.ts` — 老恩师引导聚光灯遮罩 | **已达标**：暖纸提示框 + 聚光灯挖空 | **禁改** |
| 6 | `PlayerModal.ts` — 球员详情档案卡 | **基本达标**：底部 4 张特质卡描述截断偏早，需微调为 2 行换行 | **派给力工 · T10 附带** |
| 7 | `StoryModal.ts` — 赛季剧情事件弹窗 | **小调整**：正文底层黑块与暖纸主体略突兀，调顺为深松石压边档案框 | **派给力工 · T10 附带** |
| 8 | `GameApp.ts` — 全局 Toast 顶部飘条 | **【全游戏高频遮挡 BUG】**：居中于顶部导致建队向导、夏窗、赛后、收官页标题均被压住 | **派给力工 · T10 必改**（移至底部居中安全区） |

> **主美后期唯一收尾动作**（不派给力工，待外部出图完成后由主美亲自执行）：
> 1. 等设计师按 [PITCH_PRINT_ART_ASSETS_PROMPTS.md](file:///Users/jary/WorkBuddy/zaikaiyiju/docs/PITCH_PRINT_ART_ASSETS_PROMPTS.md) 出完 **Logo + 8 张阶段标题底图 + 5 个卡包奖杯 + 12 枚徽章** 后，由主美接入 `AssetLoader.ts` 与 `TitleScreen.ts`；
> 2. 等设计师按 [PITCH_PRINT_SPRITE_SHEETS_PROMPTS.md](file:///Users/jary/WorkBuddy/zaikaiyiju/docs/PITCH_PRINT_SPRITE_SHEETS_PROMPTS.md) 出完 **3 张拼图**后，由主美跑切图脚本切分 40 张贴图并替换占位。

---

## 二、力工全局铁律与防翻车护栏

1. **视觉规范唯一基准**：动手前必须先通读 [PITCH_PRINT_ART_AND_MOTION_SPEC.md](file:///Users/jary/WorkBuddy/zaikaiyiju/docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md)。
   - 全项目严格禁用旧版深海蓝黑 `#0B1220` / `#0F172A` / `#1E293B` 与蓝紫霓虹发光细线框；
   - 统一使用 `THEME` Token（`BG_DEEP` `#0A1A14`、`BG_CARD_DARK`、`BG_PANEL`、`PAPER_CREAM` `#F4EFE4`、`INK_LINE` `#111412`、`VERMILION` `#E03A2E`、`BRASS` `#D8A842`、`LIME` `#C8F230`、`COBALT` `#2B6BE6`）以及 `CanvasKit.ts` 的 `drawPrintCard`、`drawButton`、`drawStamp`、`drawBadge`、`drawWrappedText`、`fitText`、`drawPlayerCard`。
2. **禁止擅自改动禁改区与核心玩法**：
   - 禁止修改 `DraftScreen.ts`、`MetaScreen.ts`、`AstrolabeVisuals.ts`、`AvatarRenderer.ts`、`CanvasKit.ts` 既有签名、`TitleScreen.ts` 标题主画面、`PortalScreen.ts` 连体球票与四段夹板结构。
   - 除 **T7 需要修改 `packages/core/src/Achievements.ts` 第 16 行文案**外，禁止修改 `packages/core/` 和 `packages/engine/` 下的任何逻辑或数值代码。
3. **热区与自动化回归保底**：
   - 调整按钮尺寸/坐标时必须保持热区 `>= 44×44` 且不破坏 `scripts/capture_ui_all.mjs` 中的流程点击。
4. **一口气全部做完**：
   - **不要中途暂停询问**，连续完成 T1–T10 全部代码修改后，运行编译与全量 UI 回归截图，并逐张查看关键新截图确认无文字截断/重叠后再汇报。

---

## 三、T1–T10 逐项精确施工清单

### T1 · `PrologueScreen.ts`（序章 3 幕）
- **定位问题**：`02_prologue.png` 中第 361 行 `story0`（`职业生涯第 612 场...通道尽头泛着刺眼白光，八万人的合唱已在震动鞋底。`）只渲染到「通道尽头泛着刺眼」即被切断。
- **修改要求**：
  1. 检查 `PrologueScreen.ts` 底部暖纸叙事卡内 `drawWrappedText` 的 `maxWidth` / `maxLines` 与卡片高度，确保第 1 幕及第 2、3 幕全部文案**100% 完整显示，不丢任何字**；
  2. 统一第 1~3 幕顶部阶段条（深松石 + 粗墨线）与第 3 幕双抉择卡（暖纸 + 朱红/黄铜按钮 + 硬阴影）为 PITCH PRINT 风格。

### T2 · `TitleScreen.ts`（仅改造建队向导 Step 1 & Step 2，主标题页严禁改动）
- **定位问题**：`04_wizard_step1.png` 左侧球衣预览卡与 `04b_wizard_step2.png` 右下「战术画像 / 代表主动技 / 代表临场手牌」卡片均残留旧版 `#0B1220` 深海蓝底 + 青蓝色细边框；Step 2 左侧星盘预览区中「手术刀直塞」被截断成「手术刀直」。
- **修改要求**：
  1. 将建队向导弹窗外框及内部 Step 1 / Step 2 所有旧版深海蓝卡片替换为 `THEME.BG_CARD_DARK` / `THEME.BG_PANEL` / `THEME.PAPER_CREAM` + `THEME.INK_LINE` 粗墨线卡；
  2. 修复 Step 2 左侧星盘预览节点文字过短导致的「手术刀直」截断；
  3. **严禁改动标题页主画面（有存档/无存档态的 Logo、档案卡、右侧主角插画区）**。

### T3 · `PortalScreen.ts`（仅增量补齐圣物 5 槽展示架，严禁改动球票与四段夹板）
- **定位问题**：[AstrolabeManager.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/v6/AstrolabeManager.ts#L102-L154) 定义了 8 件赛季战术圣物（`V6_RELICS`，每季最多装 5 件），目前门户夹板与词条页只写了纯文字 `圣物 X/5`，缺乏肉鸽战利品视觉感知。
- **修改要求**：
  1. **夹板展开态**（`renderClipboardDrawer` 内 `F1–F4 主动绝技` 区域旁或调整夹板小高度微增）：把纯文字 `圣物 X/5` 升级为 **5 个精巧方章/圆章圣物插槽**，已装备时显示圣物短名/矢量小图标并按 `rarity`（`purple`/`gold`/`mythic`）描边，未装备显示暗色虚线空槽，鼠标悬停或点击可在底部浮条显示该圣物名称与效果；
  2. **赛季词条「查看全部」弹窗**（`renderPerksModal`）：顶部新增一排「本季战术圣物陈列架 (X/5)」，完整展示已装备圣物的稀有度角标、名称与效果说明；
  3. **严禁改动**左侧连体可撕球票、左侧主导航与夹板四段指令切换核心逻辑。

### T4 · `LeagueScreen.ts`（联赛赛程与积分榜）
- **定位问题**：第 148 行存在中英混写 `R${fx.round}·下场`；「赛季数据统计」Tab 卡片样式需对齐 PITCH PRINT。
- **修改要求**：
  1. 第 148 行 `R${fx.round}·下场` 改为纯中文 `第${fx.round}轮·下场`（同步适当调宽 badge 宽度防截断）；
  2. 统一「赛季数据统计」Tab 下各个榜单个体卡为暖纸卡或深松石硬墨线卡（与积分榜主表保持一致）。

### T5 · `TacticsScreen.ts`（战术与阵容 + ② 指令与绝技工作台）
- **定位问题**：
  1. 第 223 行球场微卡 `roleW` 过窄，导致 `09_tactics.png` 中 `CDM` 被截成 `C...`；
  2. 第 410 行顶部 Tab 文案 `② 指令与绝技 (${s1TopCount}/4·${skTopCount}/4)` 未反映四段独立配卡（16 卡）情况；
  3. Tab ②「指令与绝技工作台」及底栏 `本季圣物 (X/5)` 仍是旧风格卡片。
- **修改要求**：
  1. 加宽球场球员微卡的 `roleW`（至少能完整放下 3 字母位置如 `CDM`、`CAM`、`LWB` 且不碰右侧状态徽章/队长标）；
  2. 顶部 Tab ② 文案根据 `ast.useUniversalPool` 准确显示 `② 指令与绝技 (通用4/4 · ${skTopCount}/4)` 或 `② 指令与绝技 (${totalDirCount}/16 · ${skTopCount}/4)`；
  3. 将 Tab ② 内四赛段指令槽、主动绝技槽、右侧候选手牌库与底栏圣物陈列条全部升级为 PITCH PRINT 暖纸便签 + 硬墨线卡片，并把底栏圣物从纯文字改为带稀有度徽章的实体圣物槽位（点击/悬停可看详情）。

### T6 · `ClubRosterScreen.ts`（引援中心全 4 个 Tab 统一）
- **定位问题**：「一线队名单」已完成标杆重绘，其余 3 个 Tab（「青训学院」「转会市场」「经纪人密荐与特训」）尚未核对统一。
- **修改要求**：检查并统一「青训学院」「转会市场」「经纪人密荐与特训」3 个 Tab 下的所有卡片、筛选条、报价/签约按钮与提示条，全部对齐 PITCH PRINT（暖纸卡 + 硬阴影 + 粗墨线 + 矢量小图标，清除任何旧版深海蓝框）。

### T7 · `HallOfFameScreen.ts` + `Achievements.ts:16`（荣誉室与编年史）
- **定位问题**：
  1. 顶栏第 89 行显示 `编年史 0/7`（只算 `completedChronCount`），右侧 Tab 第 267 行却显示 `俱乐部编年史 (1/7)`（算 `completed + active`），两处口径矛盾；
  2. `packages/core/src/Achievements.ts:16` 写着英文 `完成首次 26 人 Shuffle Draft 建队`；
  3. 左栏下方大片空白区（`12_hof.png`），右侧未解锁成就卡视觉偏暗平，顶部奖杯图标还是旧 3D 风格占位。
- **修改要求**：
  1. 修改 `packages/core/src/Achievements.ts:16` 为 `'完成首次 26 人核心开包建队'`；
  2. 统一 `HallOfFameScreen.ts` 顶栏与 Tab 按钮的编年史计数口径（清晰标注 `已完成 X/7` 或 `进行中/已完成` 口径一致）；
  3. 充实左栏「执教生涯统计」与「历届赛季履历/荣誉展柜」卡片质感，去除大片死黑空白；美化右侧成就卡与「俱乐部编年史」Tab 为统一 PITCH PRINT 报刊/搪瓷风格。

### T8（高优重灾区）· `MatchDayScreen.ts`（比赛日全状态）
对照实拍 `18_match_day.png`、`18b_match_card.png`、`18c_match_fulltime.png`，**必须全部修复以下 5 项硬 BUG**：
1. **赛前入场仪式（第 3936 行附近）**：
   - `MATCHDAY BROADCAST · 赛前入场仪式` 压在了顶部 Logo 红色底箭头上 → 调整 Logo 位置与文字 `y` 坐标拉开安全距离；
   - 两侧「主场出战 / 客场挑战」对阵卡消除旧版深海蓝 `#0B1220` 与霓虹红蓝细框，改为 PITCH PRINT 斜切对抗海报/暖纸硬墨线卡。
2. **赛中拍板横幅重叠（`18b_match_card.png`）**：
   - 球场顶部同时出现红色生效提示条与下方绿色属性文字条且互相叠字 → 收拢合并为**唯一一条不重叠的实时战术指令生效状态栏**。
3. **球场红区浮字碰撞截断（`18b_match_card.png`）**：
   - 右侧半场提示浮字 `肋部三角渗透 (前场·[` 与对面门将 `GK` 棋子撞车且文字末尾截断 → 将指令生效战术浮标移至球场中线/侧边空白安全带（或顶部状态栏内），确保完全可读且不压球员棋子。
4. **底部手牌区优化（第 2856–2890 行附近）**：
   - 加宽赛段切换标签，彻底解决 `71'-90'` 被截成 `71'-9...` 的问题；
   - 第 2856 行 `'稳健拼图'` 改为 `'稳健指令'`；
   - 第 2888 行 `'已拍板'` 橡胶印章与卡面文字重合发糊 → 已拍板卡片做明确的压暗/置灰处理或调整印章位置，使「已拍板」状态一眼干净利落。
5. **终场哨响结算浮层（`18c_match_fulltime.png`，第 4189 行附近）**：
   - 彻底替换深海蓝 `#0B1220` + 荧光绿边框的旧弹窗，重绘为 PITCH PRINT 暖纸头版战报卡（高反差大比分 + 双方数据对照 + 全场最佳 MVP 暖纸卡）；
   - 修复第 4189 行 `MAN OF THE MATCH · M...` 截断，改为纯中文 `'全场最佳 · MVP'` 并给足 badge 宽度。

### T9（高优重灾区）· `PostMatchReDraftScreen.ts`（赛后复盘与 3 选 1 盲盒）
对照实拍 `19_postmatch.png`、`20_postmatch_redraft.png`、`20b_postmatch_card_open.png`，**必须全部修复以下 4 项硬 BUG**：
1. **赛后演播室战报页（`19_postmatch.png`）**：
   - 左上主比分卡内 `控球率 / 射门(正) / 预期进球 xG / 抢断 / 拦截` 文字紧贴在对比条正下方导致视觉叠字 → 拉大每行统计项的纵向行距，把指标名称与对比条清晰错开；
   - 修复左上角徽章 `第7级·社区业余联赛...` 截断（放大宽度或使用 `tierInfo.shortLabel` + 轮次）；
   - 将比分主卡、MVP 卡、攻防动量时间轴、出场球员评分表与底部行动条统一为 PITCH PRINT 报刊暖纸/深松石硬墨线视觉。
2. **赛后 3 选 1 盲盒页（`20_postmatch_redraft.png`）**：
   - 剔除第 1 张紫色科幻魔法阵卡图与第 2/3 张 3D 金色闪电包，统一改为 PITCH PRINT 风格矢量/印刷战术盲盒包（硬墨线 + 红/金/紫封条 + 赛事印章，待后续新 `pack_*.webp` 到位无缝换图）；
   - 修改第 1299 行策划草稿风文案 `'按当前联赛等级定制的风险事件：x%常规正收益、y%负面代价、z%超额暴击'` → 改为自然中文 `'按当前联赛等级触发高风险博弈：常规收益 · 负面代价 · 超额暴击'`。
3. **赛后翻牌领奖结果框（`20b_postmatch_card_open.png`）**：
   - 改造当前空洞的绿底大弹窗：改为 PITCH PRINT 暖纸荣誉结算卡，中央展示获得的圣物/附魔/奖励图标（用对应类型徽章 + 稀有度边框）、加粗名称、生效效果拆解与星盘点数加奖。

### T10（高优 + 收口）· `SeasonEndScreen.ts` + `PlayerModal.ts` + `StoryModal.ts` + `GameApp.ts` Toast
1. **`SeasonEndScreen.ts`（`23_season_end.png` 全页翻新 + Tab ② 休赛期引援特训）**：
   - 清除整页深海蓝 `#0B1220` 背景卡与奇幻风格金色宝箱框；
   - 左栏 4 张个人荣誉卡（球队 MVP / 金靴 / 助攻王 / 金手套）改为 PITCH PRINT 暖纸卡 + 调用 `AvatarRenderer` 绘制获奖球员头像（若无对应队员如金靴/助攻王属于其他球队则显示对方队徽）；
   - 右栏 Meta 教练点数明细、赛季记忆明信片（做成真实明信片邮戳+暖纸板式）、3 选 1 结算宝箱（改为 PITCH PRINT 荣誉锦囊/档案盒）以及「2. 休赛期引援特训」Tab 页面全部对齐 PITCH PRINT；
   - 修复顶栏统计文案被顶部 Toast 压住的问题。
2. **`PlayerModal.ts`（`17_modal_player.png`）**：
   - 底部 4 张特质卡描述截断过早，略微增高底部特质卡区域并用 `drawWrappedText(..., maxLines: 2)` 完整展示两行特质说明。
3. **`StoryModal.ts`（`16b_modal_story_kickoff.png`）**：
   - 调整暖纸故事卡内右侧正文暗框边框与字色层次，去掉顶部多余空白、强化报刊简报排版感。
4. **`GameApp.ts` 全局 Toast（第 943–965 行）**：
   - **必改**：将全局 Toast 飘条默认 `ty` 从顶部（目前在建队向导、夏窗门户、赛季收官等页反复压住页面主标题）改为**底部居中安全区**（如 `ty = THEME.H - 54`，并在顶部/底部同时有主按钮时带半透明墨线背板居中浮现），确保不再遮挡任何页面的顶部标题与 Tab 栏。

---

## 四、直接转发给力工 Agent 的「一口气干完」Prompt

> 直接复制下方整段话连同本文件路径发给力工 Agent 即可：

```text
请严格按照以下两份文档一口气完成《再开一局》(Kickoff Again) 全项目剩余 UI 页面的 PITCH PRINT v1.0 视觉统一与实拍 BUG 修复（不设中间暂停，全部做完再汇报）：
1. 视觉圣经：docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md
2. 逐页收口任务单：docs/PITCH_PRINT_WORKER_TASKLIST_AND_PROMPT.md

执行铁律：
- 严格遵守任务单「一、清点矩阵」里的禁改边界：DraftScreen.ts、MetaScreen.ts、AstrolabeVisuals.ts、AvatarRenderer.ts、TitleScreen.ts 主页、PortalScreen.ts 连体球票与四段夹板结构、Settings/SaveSlot/TextInput/Confirm/TutorialOverlay 均已定标，不要破坏。
- 按顺序完成 T1 到 T10 全部 10 项任务（涵盖 PrologueScreen、TitleScreen 建队向导、PortalScreen 圣物5槽、LeagueScreen、TacticsScreen、ClubRosterScreen 其余3个Tab、HallOfFameScreen + Achievements.ts:16、MatchDayScreen、PostMatchReDraftScreen、SeasonEndScreen、PlayerModal、StoryModal 以及 GameApp.ts Toast 位置下移）。
- 彻底清理上述目标页面中的所有旧版深海蓝黑 (#0B1220 / #0F172A) 与霓虹细边框，统一替换为 Theme.ts 色板与 CanvasKit.ts 的 PITCH PRINT 原语。
- 除 Achievements.ts 第16行文案外，严禁修改 packages/core/ 与 packages/engine/ 的数值与核心状态机逻辑。
- 全部完成后，依次运行：
  1) npm run typecheck && npm run build:web
  2) npm run cli:ui（确认 16/16 PASS）
  并用 read_file 亲自检查本次修改涉及的全部新生成截图（尤其是 02_prologue、04_wizard_step1、04b_wizard_step2、09_tactics、12_hof、18_match_day、18b_match_card、18c_match_fulltime、19_postmatch、20_postmatch_redraft、20b_postmatch_card_open、23_season_end），确认无文字截断、无重叠、无深海蓝残留后再汇报结果。
```

---

## 五、力工完成后主美的验收标准

力工交活时，必须提供：
1. `npm run typecheck`、`npm run build:web`、`npm run cli:ui`（`16/16 PASS`）完整输出；
2. 对 T1–T10 每一项逐条说明改了哪几个文件、修掉了哪个截图中暴露的 BUG；
3. 主美将抽查 `shots/ui-all/` 下全部新截图，若发现任何残留旧蓝框或文字压字，直接打回返工。
