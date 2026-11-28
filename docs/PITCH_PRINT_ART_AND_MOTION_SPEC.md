# 《再开一局》PITCH PRINT v1.0 移动端大字版美术与动效设计规范

> **适用范围**：`packages/game-ui` 全端同构界面（以 **移动端横屏大字舒展版** 为唯一设计基准，直接复用于 Android / 微信小游戏 / Steam 桌面端）
> **视觉样板**：[art_style_showcase.html](file:///Users/jary/.gemini/antigravity/brain/090304cb-94e0-4657-a950-e756aaa4b7f8/art_style_showcase.html)
> **制定日期**：2026-11-27

---

## 一、定位与设计铁律

### 1.1 核心美术定位：**「绿茵战术板 × 热血漫画」(PITCH PRINT)**
- **视觉配比（70 / 20 / 10）**：
  - **70% 深松柏绿战术底**：一眼确立“足球战术室”身份，淘汰目前发闷的通用深蓝暗黑 SaaS 后台底色。
  - **20% 暖象牙实体档案卡**：核心决策卡（选秀卡、球员档案、赛前球票、临场指令手牌、排名战报）采用实体卡纸质感，彻底告别半透明黑框平铺。
  - **10% 高能信号色**：朱砂红 `#E03A2E`、球场荧光青 `#C8F230`、哑光黄铜金 `#D8A842`，极克制地引导第一视觉焦点。
- **灵魂统一**：以现有最出彩的硬朗粗墨线漫画资产（[portrait_linfeng.webp](file:///Users/jary/WorkBuddy/zaikaiyiju/apps/steam/assets/art/portrait_linfeng.webp)、老将序章分镜）为风格锚点，把 Logo、程序化头像、UI 控件与转场动效拉齐到同一次元：**静如战术手账，动如热血漫画**。

### 1.2 唯一基准原则与「降密提质」铁律
- **唯一设计基准**：只维护一套 **「移动端横屏大字舒展版」**（基于 `1280×720` 设计坐标系）。移动端一眼可读、拇指好点的卡片和字号，在 Steam 桌面端同样呈现《小丑牌 (Balatro)》式的精品独立游戏呼吸感，不再维护两套布局。
- **降密提质铁律**：**宁可每屏少放 2~3 张卡，换取绝对舒展的大字号、大头像与 `>= 44×44` 触控热区。**
- **与既有文档的整合关系**：
  - 本规范整合了 [RELEASE_ART_AND_UI_PLAN.md](file:///Users/jary/WorkBuddy/zaikaiyiju/docs/RELEASE_ART_AND_UI_PLAN.md)（发行级去 HTML 化视觉升级）与 [MOBILE_TYPOGRAPHY_AND_INFO_DENSITY_PLAN.md](file:///Users/jary/WorkBuddy/zaikaiyiju/docs/MOBILE_TYPOGRAPHY_AND_INFO_DENSITY_PLAN.md)（移动端字号与热区治理）。
  - **废除“先按 PC 密排画容器、再靠 `mobileFontSize()` 事后阶梯放大字号”的做法**：美术改版与大字重构同步一次完成，从源头彻底根治溢出、截断与文字碰撞。

---

## 二、色彩系统与五大图形母题（1:1 映射 `Theme.ts`）

### 2.1 `packages/game-ui/src/Theme.ts` 色板映射表

| 层级 | 旧 Token / 旧色值 | 新 Token 名 | 新 Hex 色值 | 使用规范与场景 |
| :--- | :--- | :--- | :--- | :--- |
| **L0 战术底 (70%)** | `BG_DEEP: '#070A10'` | `BG_DEEP` | **`#0A1A14`** | 最底层全屏背景、导航栏底、硬阴影外衬 |
| **L0 战术底 (70%)** | `BG_MID: '#0C1018'` | `BG_MID` | **`#0E231B`** | 页面主舞台底、渐变过渡中段 |
| **L0 战术底 (70%)** | `BG_PANEL: '#111722'` | `BG_PANEL` | **`#112920`** | 战术黑板绿主容器、星盘桌面、草皮主条纹 |
| **L0 战术底 (70%)** | `BG_CARD: '#161E2E'` | `BG_CARD_DARK` | **`#16231D`** | 哑光深松石辅助卡、次级按钮、统计侧栏 |
| **L0 战术底 (70%)** | `BG_PITCH_ALT: '#144226'` | `BG_PITCH_ALT` | **`#163529`** | 球场浅草皮条纹、导航激活态底色 |
| **L1 暖纸卡 (20%)** | （新增） | `PAPER_CREAM` | **`#F4EFE4`** | 核心焦点实体档案卡、指令手牌、比分牌、战报 |
| **L1 暖纸卡 (20%)** | （新增） | `PAPER_WARM` | **`#E7DEC9`** | 暖纸内嵌属性块、球票副区、档案底衬 |
| **L1 暖纸卡 (20%)** | `TX1: '#F1F5F9'`（深底白字） | `PAPER_INK` | **`#141916`** | 暖纸卡上的主文字、粗体运动数字 |
| **L1 暖纸卡 (20%)** | `TX2: '#94A3B8'` | `PAPER_MUTED` | **`#556159`** | 暖纸卡上的次要字段名、年龄/身价附注 |
| **L1 墨线与硬影** | `BORDER: 'rgba(255,255,255,0.06)'` | `INK_LINE` | **`#111412`** | 全局卡片/按钮/头像 `2~3px` 硬墨线描边 |
| **L1 墨线与硬影** | （新增） | `HARD_SHADOW` | **`#07100C`** | `4px 4px 0` 硬偏移实体阴影（替代柔和光晕） |
| **L2 信号色 (10%)** | `FLAME` / `RED` | `VERMILION` | **`#E03A2E`** | 主 CTA（继续/开哨）、红章、招牌绝技、我方主色 |
| **L2 信号色 (10%)** | `GREEN: '#22C55E'` | `LIME` | **`#C8F230`** | 实时焦点、当前轮次、导航选中条、传球轨迹 |
| **L2 信号色 (10%)** | `GOLD` / `GOLD_LIGHT`（旧渐变） | `BRASS` | **`#D8A842`** | 黄铜星盘环、奖杯、老将档位（**纯色/极轻拉丝，禁用旧版橙金浮雕渐变**） |
| **L2 信号色 (10%)** | `BLUE: '#2563EB'` | `COBALT` | **`#2B6BE6`** | 客队、中坚主力档位、防守/侦察按钮 |
| **L2 信号色 (10%)** | `PURPLE: '#A855F7'` | `VIOLET` | **`#7C3AED`** | 高潜小妖档位、肉鸽词条徽章 |
| **深底文字色** | `TX1` / `TX2` | `TX1` / `TX2` | **`#F4EFE4`** / **`#9AB0A3`** | 深松石绿容器上的高对比主字与次字 |

### 2.2 暖纸 vs 深松石使用边界（防刺眼铁律）
- **允许使用暖纸 `#F4EFE4` 的组件**：仅限 **L2 核心决策焦点卡**（标题页当前存档卡、选秀球星卡、引援/替补大卡、门户焦点对阵球票、比赛日底部指令手牌与顶部比分条、赛后补强三选一卡、排名战报卡）。
- **必须保持深松石绿 `#0A1A14` ~ `#16231D` 的区域**：全屏背景、左侧导航轨、顶栏、次级信息列表、比赛实时统计栏、弹窗遮罩外围。保证夜间手机游玩舒适不刺眼，同时让焦点卡一秒跳出画面。

### 2.3 五大标志性图形母题（纯 Canvas 2D 实现）
1. **硬墨线 + 硬偏移投影**：淘汰 `1px rgba(255,255,255,0.06)` 细边与模糊光晕，改用 `2.5px #111412` 实线描边 + `(4, 4)` 纯色硬阴影 `#07100C`。
2. **斜角实体油墨印章**：`-4° ~ -10°` 倾斜双框橡胶戳（`drawStamp`），替代普通小药丸标签，用于 `新援`、`C级`、`高潜小妖`、`我方主场`、`✓ 已签入`、`已拍板`。
3. **离屏预渲染轻纹理**：启动时在离屏小画布生成 `CanvasPattern` 缓存一次复用——包括**半调漫画网点（Halftone）**、**轻档案纸噪点**与**球场粉笔虚线**。
4. **杂志级斜体运动数字**：比分、CA/PA、联赛排名 `#4`、倒计时采用大号加粗斜体等宽数字（`DISPLAY_FONT_NUM`），与无衬线中文小标形成强视觉反差。
5. **哑光黄铜几何线雕**：星盘双环与成就勋章全面剔除暗黑 RPG 浮雕质感，统一为精准的黄铜线雕罗盘与几何足球符号。

---

## 三、移动端唯一大字版排版与「降密提质」逐页标准

### 3.1 `FONT` 语义 Token 硬标准（基于 `1280×720` 设计稿）

> 所有文本均在 `1280×720` 下按以下字号直接布局，容器宽度与行高按放大后的真实尺寸计算，不再依赖事后强拉。

| Token | 设计字号 | 核心用途 | 移动端表现要求 |
| :--- | :--- | :--- | :--- |
| **`HERO_NUM`** | **`32 ~ 48px`** | 比分 `1:0`、联赛排名 `#4`、终章大标题、Cut-In 大字报 | 粗体斜体等宽数字，一眼锁定 |
| **`HEADLINE`** | **`22 ~ 28px`** | 球星 CA/PA 主数值、页面主标题、卡片主标题 | 单卡唯一视觉数字锚点 |
| **`TITLE`** | **`17 ~ 20px`** | 球员姓名、主 CTA 按钮文字、指令卡名、弹窗标题 | 配合 `fitText` 防长名撞框 |
| **`BODY`** | **`14 ~ 16px`** | 剧情/解说正文、词条效果说明、属性名与属性数值 | 行高严格 `>= fontSize × 1.4` |
| **`LABEL`** | **`13 ~ 14px`** | 油墨印章、表头、筛选标签、位置 badge | 全场高频标签基准线 |
| **`MICRO`** | **`12px`（硬下限）** | 极少数角标与辅助脚注 | **严禁全项目出现 `< 12px` 文本** |

- **触控热区硬下限**：所有可点击元素（按钮、手动区域、球员棋子、号牌、沙盘点）**`>= 44×44` 设计像素**，统一通过 `HitRegistry.addTouchTarget` 兜底。
- **数值编码替代纯文字平铺**：次要属性统一使用 **缩写标签 + `drawStatBar` 色条**（如 `射 71` + 短色条、`24岁`、`12场`），比较靠色条长度与颜色分级（`>=70` 朱红/`>=55` 荧光绿），不靠密集小字阅读。

### 3.2 逐页「降密换大字与大头像」改造表（12 页面 + 6 弹窗）

| 页面 / 弹窗 | 现状痛点（过密 / 小字 / 违和） | 降密与 PITCH PRINT 改造方案 | 关键热区与字号底线 |
| :--- | :--- | :--- | :--- |
| **1. `DraftScreen`**<br>开包选秀 | 5 张黑框卡片信息平铺过密，属性与兼职小字拥挤，`i 档案` 仅 `46×20` | **保持 5 选 3 同屏展示 5 张竖版暖纸大卡（不分页）**，通过 **折耳 2D 翻牌** 将兼职与长评语收到背面，正面仅留大头像 + 大字姓名 + 大号 CA/PA + 2×3 实心暖米色条属性；点击整卡以 **`✓ 已签入` 红印章砸落**；`i 档案` 改为右上 `44×44` 折耳触发 | 卡片正文 `>=12.5px`，CA/PA `28px`，折耳热区 `>=44×44` |
| **2. `ClubRosterScreen`**<br>引援中心 | 右侧 **3×3（9 张小卡）** + 左侧 10 行榜单（行高 36），长句横幅撞按钮 | 右侧网格降为 **`2×3`（6 张舒展暖纸大卡/页）**，单卡宽敞展示大头像 + 大字 CA/PA + 6 项色条；左侧榜单降为 **8 行/页（行高 `>=46px`）**；转会窗提示改 `drawWrappedText` 2 行 | 榜单行高 `46px`，筛选/排序 Tab `>=44px` |
| **3. `TacticsScreen`**<br>战术与阵容 | 右侧替补 **3×4（12 张小卡/页）**；`loadout` 指令槽 `112px` 内硬塞 4 行必溢出 | 右侧替补降为 **`2×3`（6 张舒展大卡/页）**；左侧球场首发牌放大间距与站位格高度；`loadout` 指令槽拉高至 `140px+` 且收益/风险各压为 1 行图标+缩写 | 站位格高 `>=44px`，化学连线热区 `>=22px` 容差 |
| **4. `PortalScreen`**<br>赛季门户 | 左 3 块右 1 表偏后台 Dashboard；出战战术长卡片常驻占版面；侦察沙盘点 `38×38` 含 7.5px 微字 | 左侧重做为 **红蓝斜切漫画对抗海报 + 暖纸球票底座** + 4 枚大字赛前整备印章按钮；右侧顶部将「当前出战战术档案」收起为 **单行可下拉「主教练战术夹板抽屉」**（默认只露摘要 `4-3-3 传控 · 绝技2/4 · 指令4/4 · 预案1/4 ▼`，点击/下拉展开完整四段指令、圣物与 `1~4` 预案切换），释放大幅空间给暖纸 **`#4` 巨型斜体排名票** 与肉鸽词条；侦察沙盘清零 `<12px` 小字 | 夹板触发条高 `>=44px`，侦察沙盘点 `>=44×44`，所有说明 `>=13px` |
| **5. `MatchDayScreen`**<br>比赛日 | 底部 4 张指令卡仅 `90×100` 塞 6 行小字；场上点选 `28×28`；解说行距 `14px` 重叠 | 顶部为暖纸极简比分条（`28px` 大比分）；绿茵改为 **战术桌粉笔线+磁性棋子**（半径 `13~15px`，热区 **`44×44`**）；左栏解说保留最新 **8~10 条**（`14px` 字/行高 `22px`）；底部 **4 张暖纸实体指令手牌**（卡高拉至 `118~124px`），拍牌触发 **斜切漫画 Cut-In** | 场上棋子热区 `44×44`，解说 `14px`，手牌正文 `>=13px` |
| **6. `PostMatchReDraftScreen`**<br>赛后补强 | 评分榜行高 `31px` 塞 3 行重叠；全量阵容越出 720px 底边 | 评分榜改 **8 行/页（行高 `>=42px`）**；我方阵容改 **分页（10 行/页，行高 `>=40px`）**；补强盲盒/词条三选一改 **3 张舒展暖纸大卡**，配开包硬闪光 | 行高 `>=40px`，词条描述 `14~15px` |
| **7. `HallOfFameScreen`**<br>荣誉室 | 成就 **12 条/页** 挤在一起，标题撞徽章；奖杯偏 RPG 浮雕 | 成就列表降为 **`6~8 条/页`**（2 列×3~4 行），徽章放大，标题与说明拆 2 行不裁切；赛季履历行拆 2 行 | 成就卡高 `>=82px`，字体 `>=13px` |
| **8. `MetaScreen`**<br>星盘与基建 | 特写 49 节点 @8.5~9.5px 必叠；基建 **8 张同屏** 可用宽仅 `149px` | 星盘改 **黄铜线雕罗盘**，节点仅显示大几何图标+颜色，点击选中时用底部/侧边 **大字暖纸浮卡** 展示详情；基建 **`8 卡` 改为 `2×3`（6 张/页，2 页切换）**，大字写明核心收益 + 块状等级条 | 节点点击半径 `>=24px`，基建说明 `>=14px` |
| **9. `LeagueScreen`**<br>联赛积分榜 | 10 列积分表横挤，球队名撞“赛”列 | 保持 10 队同屏完整感，**10 列精简为 8 列**（合并 `胜-平-负` 与 `进失(净)`），行高 `>=44px`，等宽右对齐数字；升级/降级区改高对比左侧荧光青/朱红竖条 | 表格正文 `>=13px`，KPI 主数字 `24px` |
| **10. `TitleScreen`**<br>标题页 | 火焰 Logo 违和；居中深蓝盒子缺主题感；调色板 `32×30` | 更换为 **PITCH PRINT 矢量新 Logo** + 右侧老将林风粗墨线背影；左下为 **暖纸当前存档档案卡** + 朱红 `继续赛季` 硬阴影大钮；建队向导调色板色块放大至 **`44×44`** | 副标题 `>=14px`，色块热区 `>=44×44` |
| **11. `PrologueScreen`**<br>老将序章 | 整体健康，Stage3 数值行与底部叙述有轻度触顶风险 | 底部对白栏改为 **暖纸漫画台词框（硬墨线+右下续看印章）**，保留全部 4 张优质序章插画，按 `15~16px` 行高重算安全边距 | 台词 `15~16px`，翻页钮 `>=48px` 高 |
| **12. `SeasonEndScreen`**<br>赛季结算 | 大名单行 3 字段横撞；退休横幅与 chips 单行溢出 | 颁奖台配 **黄铜奖杯线雕**；大名单分页展示（`8~10 行/页`），Δ 改 `drawDeltaBadge`；横幅改 `drawWrappedText` 2 行，chips 限显示前 3 个 + `+N` | 大名单行高 `>=44px`，正文 `>=14px` |
| **13. 6 个弹窗**<br>`PlayerModal` 等 | `PlayerModal` 号码格 **33 个 `28×25`** 严重过小；`Settings` 滑条高 32 | `PlayerModal` 改为 **暖纸球员大档案卡**，33 个球衣号码拆 **2 页（5 列×4 行，每格 `>=44×44`）**；`StoryModal` / `ConfirmModal` / `SaveSlotModal` / `TextInputModal` / `SettingsModal` 统一换硬墨线暖纸边框 + `>=44px` 滑条与按钮 | 号码格 `44×44`，弹窗正文 `>=15px` |

---

## 四、「千人千面」热血漫画头像引擎规范（`AvatarRenderer.ts`）

继续复用 [AvatarRenderer.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/AvatarRenderer.ts) 现有的 **5,000,000+ 确定性组合逻辑** 与 `256×320` 离屏 LRU 缓存（`portraitCache`），**实现零静态图增量、100% 千人千面、且与剧情漫画立绘完全统一次元**。

需修改的 5 项渲染规则：
1. **背景层重做（`drawBackdrop`）**：取消冷深蓝渐变与青色柔光；底色改为深松石绿 `#112920`，叠加 **稀有度斜切色带**（S 哑光黄铜 `#D8A842` / A 紫 `#7C3AED` / B 钴蓝 `#2B6BE6` / C 暖灰 `#556159`）与预缓存半调网点 Pattern。
2. **主次墨线分级**：主墨线统一 `INK = '#111412'`；头部轮廓、发型外沿、肩领外沿线宽提升至 **`4.5 ~ 5.5px`**，眉眼鼻嘴内部结构线保持 **`2.2 ~ 2.8px`**，拉出强烈漫画骨骼感。
3. **赛璐璐硬二分阴影 + 墨线排线**：受光面与背光面边界锐利不羽化；在下颌下方与颈部阴影区追加 `4 ~ 6` 条斜向硬墨线排线（Hatching），向 [portrait_linfeng.webp](file:///Users/jary/WorkBuddy/zaikaiyiju/apps/steam/assets/art/portrait_linfeng.webp) 质感靠拢。
4. **移动端特写景别放大（约 `1.18×`）**：微调离屏画布内垂直锚点，减少头顶与两侧留白，聚焦眉眼至球衣领口区间，确保手机卡片缩略图依然清晰抓人。
5. **复古球衣领口与发丝刀锋高光**：强化 V 领/立领双色粗描边；深色头发表面增加一条锐利的新月形亮面刀锋高光。

---

## 五、转场与微动效标准指南（`Motion.ts` + `CanvasKit.ts`）

### 5.1 动效美学总则
- **脆（Crisp）**：总时长压缩在 `110ms ~ 260ms` 之间，绝不拖泥带水。
- **硬（Tactile）**：以位移、缩放与硬阴影收放表达物理反馈，**禁用大半径 `shadowBlur` 与呼吸灯发光**。
- **可打断（Non-blocking）**：所有转场与 Cut-In 允许快速点击打断或并行响应，绝不卡死玩家连续操作。

### 5.2 五大标准原子动效参数表

| 动效名称 | 实现位置 | 时长与缓动 | 视觉与物理表现 | 音效 / 震屏联动 | 适用范围 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. 斜切战术板转场** | `Motion.ts`<br>`RouteTransition` | 遮盖 `120ms` (`easeOutCubic`)<br>拉开 `180ms` (`easeInOutCubic`) | 深松柏绿 `#0A1A14` 斜切幕布 + `6px` 朱红/`3px` 荧光绿粗边界线（替换旧黑蓝+橙焰） | 极轻纸张刷过声 | 所有主路由切页 |
| **2. 实体按压回弹** | `CanvasKit.ts`<br>`drawButton` / 卡片 | 按下即时偏移<br>松手 `110ms` (`easeOutBack`) | 按下瞬时向右下移 `(+2, +2)`、硬阴影由 `4px` 缩至 `2px`；松手弹回原位（专为移动端触控设计） | 机械按键咔哒声 | 所有按钮、选秀卡、指令卡 |
| **3. 油墨盖章砸落** | `Motion.ts`<br>新增 `StampSlam` | `180ms`<br>(`easeOutBack`) | 印章从 `scale 1.48, alpha 0` 砸落至 `1.0` | `ScreenShake(2.5, 0.10)` + 厚重盖章声 | 选秀签入、赛前整备、拍指令、成就解锁 |
| **4. 数值跳变脉冲** | `Motion.ts`<br>新增 `ValuePulse` | `220ms`<br>(`easeOutCubic`) | 数值瞬间放大 `1.0 → 1.22 → 1.0`，前 `80ms` 闪烁 `#C8F230` 高亮 | 轻脆提示音 | 比分变化、CA/PA 提升、资金变动 |
| **5. 漫画斜切 Cut-In** | `Motion.ts`<br>新增 `MangaCutIn` | 入场 `140ms` + 停留 `860ms` + 划出 `200ms`（总计 `1.2s`，**点击秒跳**） | 全屏压暗 50% + 朱红/钴蓝斜切速度线横幅 + 球员漫画特写 + 巨型斜体呼号大字 | `ScreenShake(5, 0.20)` + 哨声/爆发音效 | **严格限定仅限：进球、招牌绝技、夺冠** |

### 5.3 移动端 60fps 性能红线
1. **严禁每帧运行 `ctx.filter = 'blur(...)'` 或大半径 `shadowBlur`**：所有阴影必须使用纯色偏移矩形/多边形绘制，确保低端安卓机与微信小游戏稳跑 60fps。
2. **纹理必须离屏缓存**：半调网点、轻纸噪点只在初始化时绘制到 `64×64` 或 `128×128` 离屏 Canvas 并缓存为 `CanvasPattern`。
3. **同屏粒子硬上限 `<= 40`**：`ParticleSystem` 粒子改用硬边缘小方块/三角形纸屑（淘汰模糊圆点），单次爆发最多 24~40 枚。

---

## 六、拟物互动小巧思设计（Diegetic Micro-Interactions）

> **设计准则**：每个互动机关只服务两个目的——**① 帮移动端大字版藏起次要信息、换取正面大字与呼吸感；② 用真实足球教练道具（战术夹板、球探档案袋、球票、磁性棋子、黄铜罗盘）制造触感多巴胺**。全部基于纯 Canvas 2D 实现，零额外重贴图负担，且绝不阻塞连续操作。

### 6.1 全游戏 8 项拟物互动机关总览

| 序号 | 所属页面 | 互动机关 | 设定隐喻与移动端操作 | 解决的问题 / 体验价值 | 优先级 |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | `PortalScreen` | **下拉式「主教练战术夹板抽屉」** | 右上角默认收起为一根金属战术夹头 + 单行摘要条；点击或向下轻拖以 `220ms easeOutBack` 展开整块夹板抽屉 | 平时释放右侧 35% 纵向空间给大字排名与词条，想查明细或就地切换 `1~4` 预案时一拉即得、无需切页 | **P0** |
| **2** | `Draft` / `ClubRoster` / `Tactics` | **暖纸球星卡「折耳翻牌」**（2D Card Flip） | 卡片正面只留大头像、姓名、大号 CA/PA 与核心色条；点击右上角**卷角折耳**触发 `180ms scaleX (1→0→1)` 翻面，背面显示兼职、特质详解与球探评语 | **直接替正面省出 40% 版面**，让移动端真正做到字大头像大、零拥挤 | **P0** |
| **3** | `DraftScreen` / `PostMatchReDraft` | **「撕封条拆球探档案袋」+「砸红印章签入」** | 开包先见朱红斜封条牛皮档案袋，点击横向撕飞封条后 3 张大卡扇形弹出；点选球员触发 `StampSlam (180ms)` 砸下红章 `✓ 已签入` | 将纯列表点击升级为开盲盒仪式感，盖章反馈爽脆解压 | **P0** |
| **4** | `MatchDayScreen` | **「扇形手牌抽出预览 + 拍桌出牌」** | 底部 4 张暖纸指令卡微斜扇形收纳；首次轻点向上抽出 `24px` 展开收益/代价并联动球场热区粉笔框（`0.25x` 慢放）；再点或上滑“啪”地拍桌生效并盖 `已拍板` 戳 | 单手拇指两段式防误触，拍下瞬间更有教练场边拍板的气势 | **P0** |
| **5** | `PortalScreen` | **「赛前球票沿齿孔撕票」开球仪式** | 焦点战暖纸球票右侧带虚线齿孔；点击 `吹响开场哨` 时右侧票根沿齿孔做 `140ms` 微错位撕裂并伴哨声，无缝衔接斜切转场 | 把普通跳转按钮变成“检票入场”的情绪开关 | **P1** |
| **6** | `TacticsScreen` | **「磁性战术棋子啪嗒吸附 + 粉笔连线」** | 选中球员棋子微微浮起（`scale 1.08` + 硬影拉长至 `8px`），落位瞬间弹回并溅起一圈淡白粉笔灰环；错位画红叉、化学共振拉出流动荧光绿粉笔虚线 | 让平面阵型调整具有真实战术磁板手感和清晰视觉反馈 | **P1** |
| **7** | `MetaScreen` | **「黄铜机械棘轮咔哒回弹」**（Brass Ratchet Dial） | 双环旋转 `±60°` 时加入 `3°` 机械过冲再卡入刻度槽的 `easeOutBack` 手感，配黄铜棘轮咔哒声；奇点对齐时中心迸发细黄铜星芒 | 让八卦兵法罗盘真的像一台精密可盘的黄铜仪器 | **P1** |
| **8** | `TitleScreen` / `HallOfFame` | **「文件夹多标签存档」&「奖杯柜拭亮」** | 标题页暖纸存档卡顶部做档案夹侧耳标签（支持快速切槽）；荣誉室未解锁用蒙尘铅笔线稿、解锁盖黄铜章，点击奖杯触发单道斜向扫光并浮出夺冠简报 | 增强长期收藏的纪念价值，复用 `drawFoilShimmer` 几乎零开发成本 | **P2** |

### 6.2 「主教练战术夹板抽屉」详细交互规范（`PortalScreen` 重点落地）
1. **收起态（默认，高 `64px`）**：外观为一块深松石绿底 + 顶部黄铜金属夹头横条，右侧展示 `4-3-3 传控 · 绝技 2/4 · 指令 4/4 · 预案 1/4` 与醒目下拉角标 `[展开夹板 ▼]`（整条热区 `>= 44px` 高）。
2. **展开态（悬浮抽屉，高约 `340px`，覆盖右侧下层区域并加暗幕衬底）**：
   - 顶部提供 **`预案 1 / 2 / 3 / 4`** 四枚 `44×44` 硬墨线物理拨片，可在门户页直接切换出战预案而不用切进 `TacticsScreen`。
   - 中部以暖纸便签条清晰列出当前装备的 **四段临场指令**（`0'-20'` / `21'-45'` / `46'-70'` / `71'-90'+`）与 **绝技 / 圣物槽**。
   - 底部附 `前往战术板微调 →` 快捷跳转钮；点击夹头、上滑或点击抽屉外空白处均以 `180ms` 平滑收起。

---

## 七、静态美术资产处置与 AI 统一出图规范

### 7.1 现有资产处置清单
- **全量保留复用（零返工）**：
  - 人物立绘：`portrait_linfeng.webp`、`portrait_mentor.webp`、`portrait_xiaoyu.webp`
  - 序章与故事分镜：`prologue_01~05*.webp`、`fx_prologue_last_dance.webp`、`story_*.webp`
  - 指令卡插画：`cmd_*.webp`（置于暖纸卡框内时搭配 `2px #111412` 墨线外框即融为一体）
- **优先替换与升级**：
  - **P0 — 游戏主 Logo**：淘汰旧版火焰足球 `game_logo.webp`，先在 `Motion.ts` (`drawGameLogoEmblem`) 实现 PITCH PRINT 矢量新版 Logo（斜体粗黑字标 + 朱红战术箭头 + 经典足球盾牌），后续按需导出一版同款高清 `game_logo.webp`。
  - **P1 — 星盘与图腾节点**：改造 [AstrolabeVisuals.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/AstrolabeVisuals.ts)，将 3D 奇幻浮雕节点改为纯矢量 **黄铜几何线雕徽记**。
  - **P2（后续按精力排期）**：`ach/*.webp`（成就勋章）与 `pack_*.webp`（补强卡包）可逐步替换为粗墨线+黄铜版画质感版本。

### 7.2 PITCH PRINT 统一 AI 出图风格词缀（供后续补图复用）
> 所有新增插画/图标在 Prompt 末尾统一追加以下约束，确保不再出现画风割裂：
> `graphic novel sports illustration, bold black ink outlines, crisp two-tone cel shading, subtle halftone dot texture, limited palette of deep pine green #112920, archival cream paper #F4EFE4, striker vermilion #E03A2E, and matte brass gold #D8A842, flat editorial print aesthetic, NO glossy 3D render, NO neon glow, NO text, NO letters, NO watermarks.`

---

## 八、工程组件扩展、三阶段路线图与验收标准

### 8.1 `CanvasKit.ts` 共享基础件扩展清单
- **新增函数**：
  - `drawPrintCard(ctx, x, y, w, h, opts)`：统一绘制暖纸卡 `#F4EFE4`（或深松石卡 `#16231D`）+ `2.5px` 墨线 + `4px` 硬偏移投影 + 可选顶部色带。
  - `drawStamp(ctx, text, x, y, color, angleDeg)`：绘制带双线内框与倾斜角度的实体橡胶印章。
  - `getHalftonePattern(ctx)` / `getPaperGrainPattern(ctx)`：全局离屏缓存纹理 Pattern。
- **升级现有函数**：
  - `FONT`：按第 3.1 节更新为移动端唯一大字版语义 Token（`HERO_NUM` / `HEADLINE` / `TITLE` / `BODY` / `LABEL` / `MICRO`）。
  - `drawButton`：替换为硬阴影 + 按压位移 + 4 变体（`primary` 朱红、`gold` 哑光黄铜、`ghost` 深松石、`lime` 荧光绿）。
  - `drawNavRail` / `drawBroadcastHeader` / `drawBadge` / `drawRoundRect`：全面去除发光渐变，切换至 PITCH PRINT 墨线规范。

### 8.2 三阶段低风险实施路线图

| 阶段 | 改造范围 | 预计涉及文件 | 阶段目标与收益 |
| :--- | :--- | :--- | :--- |
| **Phase 1：底座换血** | 色彩、控件皮肤、头像、动效、星盘 | `Theme.ts`、`CanvasKit.ts`、`Motion.ts`、`AvatarRenderer.ts`、`AstrolabeVisuals.ts` | **不碰任何游戏规则与页面路由**，全游戏立刻切换至 PITCH PRINT 基调 + 千人千面漫画头像（完成 ~60% 观感跃迁） |
| **Phase 2：5 大核心高频页重排** | 降密提质 + 暖纸大字 + P0 拟物互动 | `TitleScreen.ts`、`DraftScreen.ts`、`PortalScreen.ts`、`MatchDayScreen.ts`、`TacticsScreen.ts`、`ClubRosterScreen.ts` | 彻底落地“少放卡、放大字、放大头像”的移动端大字舒展排版，并同步接入**战术夹板下拉抽屉、折耳翻牌、砸印章、扇形出牌与漫画 Cut-In** |
| **Phase 3：次级页、弹窗与验收** | 分页清理与全量热区收尾 | `LeagueScreen.ts`、`PostMatchReDraftScreen.ts`、`SeasonEndScreen.ts`、`HallOfFameScreen.ts`、`MetaScreen.ts`、`PrologueScreen.ts` + 6 个 `*Modal.ts` | 消灭最后一处 `<12px` 小字和 `<44px` 热区，接入 P1/P2 互动巧思并完成双端回归 |

### 8.3 量化验收硬标准
1. **字号硬下限**：全项目零 `<12px` 文本；核心正文与属性数值 `>=14px`。
2. **触控热区**：`__FM_TEST__` 扫描与真机点测中，100% 可点区域 `>=44×44` 设计像素。
3. **零溢出与零截断**：高密度页面降卡分页后，姓名、特质、解说、榜单无撞框、无重叠。
4. **头像画风统一**：随机抽取 12 名不同肤色/发型/位置球员，在卡片上均呈现清晰粗墨线二分漫画质感。
5. **动效与包体**：转场/盖章/Cut-In 全程 60fps、可点击打断；微信小游戏主包保持 `<4MB`。
6. **自动化回归验证**：每阶段完成后执行真机冒烟 `npm run cli:device -- --smoke` 与全页面截图 `node scripts/capture_ui_all.mjs`，逐屏目视对比确认。


---

## 九、力工 Agent 逐阶段执行提示词包（可直接复制下发）

> **使用方式**：每次**只给力工 Agent 派发 1 个 Prompt**（严格按 `1A → 1B → 1C → 2A → 2B → 2C → 2D → 2E → 3` 顺序），等待其跑通末尾指定的验收命令并贴出真实结果后，再派发下一个。**务必原封不动保留每个 Prompt 中的「严禁事项」。**

### 9.1 通用全局护栏（所有编码 Prompt 共同遵守）
1. **不动内核逻辑**：严禁修改 `packages/core/`、`packages/engine/`、`server/` 及任何胜负判定、数值公式、存档结构、路由逻辑。
2. **向后兼容防爆**：严禁删除 `THEME`、`FONT`、`ButtonVariant` 或 `CanvasKit.ts` 任何已有导出键名；只能重映射值或新增字段/函数，确保全项目 18 个 UI 文件在任意中间阶段均可零报错编译。
3. **60fps 性能红线**：严禁在 Canvas 渲染循环中调用 `ctx.filter` 或每帧 `shadowBlur > 0`；所有投影必须用纯色偏移矩形/多边形（`#07100C`）实现。
4. **移动端大字与热区底线**：全项目文本硬下限 `>= 12px`、正文 `>= 14px`；所有可点击区域 `>= 44×44`（不足者接入 `hits.addTouchTarget`）。
5. **诚实验收**：每次修改后必须执行指定命令（`npm run typecheck`、`npm run build:web`、`npm run verify`、`npm run test:ui`），不得跳过测试。

---

### 9.2 原子化编码执行 Prompt（9 步）

#### Prompt 1A · Phase 1 底座：色彩常量与共享绘制组件（`Theme.ts` + `CanvasKit.ts`）

```text
【任务目标】
将游戏 UI 视觉底座升级为「绿茵战术板 × 热血漫画」(PITCH PRINT v1.0) 移动端大字版规范，建立暖纸实体卡、斜角红章、硬偏移投影与离线网点纹理工具，同时保持全项目零编译错误。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（重点读第 2、3、5、7、8 章）
2. packages/game-ui/src/Theme.ts
3. packages/game-ui/src/CanvasKit.ts

【允许修改的文件白名单】
- packages/game-ui/src/Theme.ts
- packages/game-ui/src/CanvasKit.ts

【具体改造清单】
1. 修改 packages/game-ui/src/Theme.ts：
   - 保留现有全部键名（W, H, BG_DEEP..BORDER_GOLD, FONT_FAMILY, NUM_FONT_FAMILY, DISPLAY_FONT_CN, DISPLAY_FONT_NUM），重映射色值为 PITCH PRINT 色板：
     BG_DEEP: '#0A1A14', BG_MID: '#0E231B', BG_PANEL: '#112920', BG_CARD: '#16231D', BG_CARD_HOVER: '#1E3128',
     BG_PITCH: '#112920', BG_PITCH_ALT: '#163529',
     GOLD: '#D8A842', GOLD_LIGHT: '#E7C266', GOLD_HOT: '#FEF08A',
     FLAME: '#E03A2E', FLAME_LIGHT: '#F25C50', RED: '#E03A2E', RED_LIGHT: '#F87171',
     BLUE: '#2B6BE6', BLUE_LIGHT: '#60A5FA', GREEN: '#C8F230', PURPLE: '#7C3AED',
     TX1: '#F4EFE4', TX2: '#9AB0A3', TX3: '#6E8578',
     BORDER: 'rgba(17,20,18,0.85)', BORDER_GOLD: 'rgba(216,168,66,0.55)'。
   - 追加导出新语义 Token：
     BG_CARD_DARK: '#16231D', PAPER_CREAM: '#F4EFE4', PAPER_WARM: '#E7DEC9',
     PAPER_INK: '#141916', PAPER_MUTED: '#556159', INK_LINE: '#111412', HARD_SHADOW: '#07100C',
     VERMILION: '#E03A2E', LIME: '#C8F230', BRASS: '#D8A842', COBALT: '#2B6BE6', VIOLET: '#7C3AED'。

2. 修改 packages/game-ui/src/CanvasKit.ts：
   - 统一 FONT 为单一移动端大字舒展标准（去除 IS_MOBILE 分叉），并补充 HERO_NUM：
     HERO_NUM: 40, DISPLAY: 32, HEADLINE: 24, TITLE: 18, BODY: 15, LABEL: 13.5, MICRO: 12。
   - 更新 mobileFontSize(size)：若传入 size < 12 则兜底钳位到 12，避免出现小于 12px 的文字。
   - 新增并导出 4 个基础绘图工具（均须使用 64×64 离屏 Canvas 缓存 CanvasPattern，禁止每帧重建）：
     a) getHalftonePattern(ctx, dark?: boolean): CanvasPattern | null（半调漫画网点）
     b) getPaperGrainPattern(ctx): CanvasPattern | null（极轻档案纸颗粒）
     c) drawPrintCard(ctx, x, y, w, h, opts?: { paper?: boolean; topBandColor?: string; radius?: number; shadowOffset?: number; strokeColor?: string; lineWidth?: number }): void
        - 默认 paper=true 使用 THEME.PAPER_CREAM，paper=false 使用 THEME.BG_CARD_DARK；
        - 先画纯色硬偏移阴影（x+4, y+4, THEME.HARD_SHADOW），再画卡片底色 + 可选顶部色带 + 2.5px THEME.INK_LINE 墨线描边。
     d) drawStamp(ctx, text, x, y, color?: string, angleDeg?: number, scale?: number): void
        - 绘制带双线矩形外框、倾斜角度（默认 -6deg）、纯色油墨文字的实体橡胶印章（内边距充足、字体粗体）。
   - 升级 drawButton：
     - ButtonVariant 保留已有 5 种 'gold' | 'primary' | 'ghost' | 'danger' | 'green' 并新增 'lime' | 'paper'；
     - 彻底移除 3 段高光渐变与 ctx.shadowBlur = 10；
     - 改为纯色扁平填充 + 2.5px THEME.INK_LINE 墨线 + 4px 硬偏移阴影（按下 hits.pointerDown && hovered 时位移 (+2, +2) 且阴影缩为 2px）；
     - 各变体配色：primary 用 THEME.VERMILION 配 #F4EFE4 字；gold 用哑光 THEME.BRASS 配 #141916 字；green 用 #163529 配 #C8F230 字；lime 用 #C8F230 配 #141916 字；paper 用 #F4EFE4 配 #141916 字；ghost 用 #16231D 配 #F4EFE4 字；danger 用 #B91C1C 配 #F4EFE4 字。
   - 升级 drawRoundRect、drawChamferPanel、drawNavRail、drawBroadcastHeader、drawBadge：
     - 去掉淡白细边和柔光，切换至 THEME.INK_LINE 硬描边、#0A1A14/#112920 深松石底与 #C8F230 激活高光条。
   - 升级 ParticleSystem：粒子改用硬边缘小方块/三角形纸屑（淘汰模糊发光圆点），同屏最大粒子数限制 <= 40。

【严禁事项】
- 严禁删除 THEME 或 CanvasKit.ts 中任何现有导出的函数、类、接口或常量名。
- 严禁修改任何 screens/ 下的页面文件或 packages/core、packages/engine。
- 严禁在绘制函数里使用 ctx.filter 或 shadowBlur > 0。

【验收命令与汇报要求】
改完后运行：npm run typecheck && npm run build:web
汇报时贴出：修改的符号清单 + 上述两条命令的完整退出码与输出。
```

---

#### Prompt 1B · Phase 1 底座：转场、动效原语与新矢量 Logo（`Motion.ts`）

```text
【任务目标】
改造 Motion.ts 的斜切转场配色与节奏、将游戏主 Logo 升级为「再开一局 PITCH PRINT 矢量版」（告别火焰足球），并新增 StampSlam、ValuePulse、MangaCutIn 三个标准原子动效类。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（重点读第 5 章与第 7.1 节）
2. packages/game-ui/src/Motion.ts
3. packages/game-ui/src/Theme.ts
4. packages/game-ui/src/CanvasKit.ts

【允许修改的文件白名单】
- packages/game-ui/src/Motion.ts

【具体改造清单】
1. 改造 RouteTransition：
   - inDuration 改为 0.12（120ms），outDuration 改为 0.18（180ms）。
   - 斜切幕布填充色改为 '#0A1A14'（深松柏绿），双斜切边线改为 6px '#E03A2E'（朱砂红）+ 3px '#C8F230'（荧光绿）。
   - 中间标签框改用 drawPrintCard 风格（#F4EFE4 暖纸底 + #111412 硬墨线 + #141916 粗体斜体文字）。
2. 重绘 drawGameLogoEmblem(ctx, cx, cy, size, timeSec, shape)：
   - 去除旧版橙红呼吸光晕与火焰足球矢量；如果 AssetLoader 已加载新版外部图则按需绘制，否则使用纯 Canvas 2D 绘制 PITCH PRINT 新版 Logo：
     a) 倾斜多边形硬偏移黑影（#07100C）+ 暖象牙底板（#F4EFE4，3px #111412 描边）；
     b) 左侧极简经典红绿双拼盾牌队徽 + 黑白几何五边形足球；
     c) 右侧粗黑斜体「再开一局」大字 + 底部横穿的朱砂红（#E03A2E）战术箭头；
     d) 右上角微倾黄铜色（#D8A842）小铭牌「2026」。
3. 新增并导出 3 个原子动效类（零模糊、60fps）：
   - export class StampSlam：trigger() 后 180ms 内使用 easeOutBack 从 scale=1.48, alpha=0 砸落到 scale=1.0, alpha=1，提供 update(dtSec) 与 getTransform()。
   - export class ValuePulse：trigger() 后 220ms 内从 scale 1.0 -> 1.22 -> 1.0，前 80ms 提供 isFlash()=true（供调用方闪烁 #C8F230）。
   - export class MangaCutIn：trigger(opts: { title: string; subtitle?: string; accent?: string; tag?: string }) 启动 1.2s 斜切速度线漫画横幅（140ms 滑入 + 860ms 停留并滚动速度线 + 200ms 划出），提供 dismiss() 方法支持点击秒跳，以及 update(dtSec)、isActive()、render(ctx, w, h)（含 50% 压暗遮罩 + 斜切 #E03A2E/#2B6BE6 横幅 + 速度线 + 大号斜体呼号文字，零 shadowBlur）。

【严禁事项】
- 严禁删除 BootIntro、RouteTransition、ScreenShake、drawGameLogoEmblem 等已有导出符号或破坏其构造/调用签名。
- 严禁使用 shadowBlur 或 ctx.filter。

【验收命令与汇报要求】
改完后运行：npm run typecheck && npm run build:web
汇报时贴出新增/修改的类与方法列表，以及命令输出。
```

---

#### Prompt 1C · Phase 1 底座：千人千面漫画头像与黄铜星盘（`AvatarRenderer.ts` + `AstrolabeVisuals.ts`）

```text
【任务目标】
在不改变任何千人千面组合逻辑和缓存机制的前提下，将 AvatarRenderer.ts 升级为「粗墨线 + 硬二分阴影 + 网点背景」的热血漫画画风（对齐林风立绘）；并将 AstrolabeVisuals.ts 升级为「黄铜几何线雕罗盘」风格。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（重点读第 4 章与第 2.3 节）
2. packages/game-ui/src/AvatarRenderer.ts
3. packages/game-ui/src/AstrolabeVisuals.ts

【允许修改的文件白名单】
- packages/game-ui/src/AvatarRenderer.ts
- packages/game-ui/src/AstrolabeVisuals.ts

【具体改造清单】
1. 修改 packages/game-ui/src/AvatarRenderer.ts：
   - 保留现有 5,000,000+ 组合哈希逻辑与 portraitCache（256×320 离屏缓存）。
   - 主墨线常量 INK 改为 '#111412'。
   - 重写内部 drawBackdrop：删除冷深蓝渐变与青色光晕；改为深松石绿 '#112920' + 左下至右上斜切稀有度色带（S='#D8A842', A='#7C3AED', B='#2B6BE6', C='#556159'，alpha ~0.28）+ 轻量半调网点阵列。
   - 分级加粗墨线：头部轮廓、前后发型、球衣肩部与领口外轮廓 lineWidth 提升至 4.5~5.5；五官内部线条（眉/眼/鼻/嘴）保持 2.2~2.8。
   - 强化赛璐璐硬阴影与排线：将人脸/颈部阴影改为清晰硬边缘二分暗面，并在下颌下方与颈部阴影区绘制 4~6 条斜向短墨线排线（Hatching）。
   - 优化特写景别：在离屏画布绘制主体时轻微放大约 1.15x（以头部为中心略向上偏移），减少头顶留白，让移动端小卡片上五官神态更抓人。
   - 增加复古球衣领口双色粗描边与深色发丝表面单条新月形高光弧线。

2. 修改 packages/game-ui/src/AstrolabeVisuals.ts：
   - 将 drawAstrolabeBackdropAndRings 改为深松石绒面背景 + 精细哑光黄铜同心刻度环（'#D8A842'）+ 极细战术粉笔辅助线，移除所有奇幻发光晕影。
   - 将 drawAstrolabeEdgeLine、drawAstrolabeCircleNode、drawAstrolabeHexFusionNode、drawAstrolabeDiamondSkillNode、drawAstrolabeDirectiveNode 改为硬墨线（'#111412'）+ 黄铜线雕（'#D8A842'）+ 激活态荧光绿（'#C8F230'）实心/描边样式，禁用大半径 shadowBlur。

【严禁事项】
- 严禁改动 drawPlayerAvatar 和 AstrolabeVisuals 导出函数的参数签名与返回值。
- 严禁引入外部图片文件，必须纯 Canvas 2D 完成。

【验收命令与汇报要求】
改完后运行：npm run verify
汇报时贴出实际改动说明及 npm run verify 完整结果。
```

---

#### Prompt 2A · Phase 2 核心页：标题页重构（`TitleScreen.ts`）

```text
【任务目标】
按 PITCH PRINT v1.0 移动端大字版重排 TitleScreen.ts：突出新矢量 Logo 与老将漫画背影，底部改为带文件夹多标签的暖纸存档档案卡，并放大建队向导的调色板热区。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（第 3.2 节 TitleScreen 与第 6.1 节第 8 项）
2. packages/game-ui/src/screens/TitleScreen.ts
3. packages/game-ui/src/CanvasKit.ts
4. packages/game-ui/src/Motion.ts

【允许修改的文件白名单】
- packages/game-ui/src/screens/TitleScreen.ts

【具体改造清单】
1. 背景与主视觉：使用深松石夜景球场斜向光束 + 浅粉笔中圈线 + 半调网点底；左侧顶部展示 Motion.ts 的新版 drawGameLogoEmblem，副标题字号 >= 14px。
2. 暖纸存档档案卡（drawPrintCard）：
   - 顶部增加档案馆文件夹切槽标签页（展示可用存档槽位，支持一键切换存档槽）；
   - 卡内左放清晰队徽与大号俱乐部名（TITLE/HEADLINE），右放朱砂红（variant='primary'）硬阴影「继续赛季 / 开启新赛季」大按钮；
   - 底部 3 个辅助入口（教练天赋、我的球队、荣誉室）改用深松石硬阴影按钮（variant='ghost'），热区高 >= 46px。
3. 建队向导弹窗内所有配色色块与图腾按钮热区放大至 >= 44×44（接入 hits.addTouchTarget），所有文案 >= 14px，消除长文本碰撞。

【严禁事项】
- 严禁破坏新建赛季、读档、老将序章、口令、存档槽切换的现有回调函数与路由逻辑。
- 全页不得出现 < 12px 的文字或 < 44×44 的热区。

【验收命令与汇报要求】
改完后运行：npm run typecheck && npm run build:web
汇报修改要点与命令输出。
```

---

#### Prompt 2B · Phase 2 核心页：选秀开包大字降密与翻牌（`DraftScreen.ts`）

```text
【任务目标】
按「宁可每屏少放卡、换取大字和大头像」铁律改造 DraftScreen.ts：将 5 张瘦长卡改为每屏 3 张舒展暖纸大卡（支持 1-3 / 4-5 翻页），并加入「撕封条开袋 + 右上折耳 2D 翻牌看详情 + 砸红章签入」。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（第 3.2 节 DraftScreen 与第 6.1 节第 2、3 项）
2. packages/game-ui/src/screens/DraftScreen.ts
3. packages/game-ui/src/CanvasKit.ts
4. packages/game-ui/src/Motion.ts

【允许修改的文件白名单】
- packages/game-ui/src/screens/DraftScreen.ts

【具体改造清单】
1. 开包状态（每轮试训包首次打开时）：先展示带斜向朱红封条的牛皮纸球探档案袋（非阻塞，点一下封条 180ms 撕飞并弹出 3 张大卡；也可保留快速跳过/一键推荐）。
2. 每屏 3 张舒展暖纸大卡（drawPrintCard）：
   - 将原本同屏 5 张改为每页展示 3 张大卡（宽度充裕，约 320~340px 宽），并在左侧/右侧或顶部放置大号「第 1-3 位 / 第 4-5 位」翻页切换钮（>=44×44）。
   - 卡面正面只留核心高价值信息：顶部稀有度色带 + 斜角印章（C级/新星）、位置徽章 + 大号斜体 CA/PA（HEADLINE/DISPLAY）、大尺寸漫画头像（>=150×130）、大字姓名（TITLE）+ 2×3 紧凑色条属性（>=13.5px）+ 费用。
3. 右上角卷角折耳「2D 翻牌」（scaleX 1→0→1，180ms）：
   - 在每张卡右上角绘制明显折耳角标（热区 >=44×44），点击后卡片原地翻转展示背面：完整兼职位置、特质详细描述、球探评语与「打开完整档案」大按钮（替代原来 46×20 的小按钮）。
4. 选中签入反馈：点击卡片主体选中时使用 StampSlam 动效砸下斜角朱红橡胶戳 `✓ 已签入`（drawStamp）。

【严禁事项】
- 严禁更改 5 选 3 规则、选秀轮次推进、资金扣减、一键推荐选满与进入夏窗的业务逻辑。

【验收命令与汇报要求】
改完后运行：npm run typecheck && npm run build:web
汇报页面布局尺寸变化、新增交互状态及命令输出。
```

---

#### Prompt 2C · Phase 2 核心页：赛季门户海报化 + 下拉战术夹板抽屉（`PortalScreen.ts`）

```text
【任务目标】
重构 PortalScreen.ts：左侧升级为红蓝斜切对抗海报球票（含开球撕票动效）+ 赛前整备印章按钮；右侧顶部将「当前出战战术档案」收起为可下拉展开的「主教练战术夹板抽屉」，让出大幅版面给巨型斜体排名票与肉鸽词条。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（第 3.2 节 PortalScreen 与第 6.1、6.2 节）
2. packages/game-ui/src/screens/PortalScreen.ts
3. packages/game-ui/src/CanvasKit.ts
4. packages/game-ui/src/Motion.ts

【允许修改的文件白名单】
- packages/game-ui/src/screens/PortalScreen.ts

【具体改造清单】
1. 左侧主视觉对阵球票（drawPrintCard）：
   - 上半部为红蓝（#E03A2E vs #2B6BE6）斜切漫画对抗海报 + 倾斜荧光绿 VS 徽章 + 「我方主场」橡胶印章；
   - 球票右侧设计虚线撕票齿孔，点击「吹响开场哨」时触发 140ms 票根错位撕裂动画后再触发开赛回调；
   - 赛前 4 项轻训练改为硬墨线大字按钮，选中后盖上朱红/荧光绿确认印章。
2. 右侧顶部「主教练战术夹板抽屉」（核心改动）：
   - 默认收起态：高度约 64px，顶部绘黄铜金属夹头横条，单行大字展示「4-3-3 传控渗透 · 绝技 X/4 · 指令 X/4 · 预案 N/4」及醒目「展开夹板 ▼」按钮（整条可点，热区 >=44px）。
   - 下拉展开态：点击/轻拖后以 220ms easeOutBack 向下展开悬浮战术夹板抽屉（约 340px 高，底加半透明压暗遮罩），内含：
     a) 「预案 1 / 2 / 3 / 4」四枚 >=44×44 物理拨片（可直接调用现有切换预案回调就地切换）；
     b) 当前装备的四段临场指令暖纸便签明细（0'-20' / 21'-45' / 46'-70' / 71'-90'+）与绝技/圣物一览；
     c) 底部「前往战术板微调 →」快捷入口，及点击夹头或抽屉外空白区域 180ms 平滑收起。
3. 右侧下半部：用舒展暖纸票面展示巨型斜体 `#N` 联赛排名（HERO_NUM）、健康状况与肉鸽赛季词条，所有文案 >=13.5px；侦察弹窗内所有沙盘点热区通过 hits.addTouchTarget 保证 >=44×44。

【严禁事项】
- 严禁更改门户夏窗三步走流程、赛前整备数值效果、侦察点消耗与开赛跳转逻辑。

【验收命令与汇报要求】
改完后运行：npm run typecheck && npm run build:web
汇报抽屉交互状态机与命令输出。
```

---

#### Prompt 2D · Phase 2 核心页：比赛日战术桌面、扇形手牌与漫画 Cut-In（`MatchDayScreen.ts`）

```text
【任务目标】
仅改造 MatchDayScreen.ts 的视觉皮肤、触控热区、扇形指令手牌与漫画绝技 Cut-In，绝不改动任何比赛引擎仿真与数值逻辑。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（第 3.2 节 MatchDayScreen、第 5.2 节、第 6.1 节第 4 项）
2. packages/game-ui/src/screens/MatchDayScreen.ts
3. packages/game-ui/src/Motion.ts

【允许修改的文件白名单】
- packages/game-ui/src/screens/MatchDayScreen.ts

【具体改造清单】
1. 顶部广播比分条：改为墨黑边框 + 暖纸中心大比分牌（DISPLAY/HERO_NUM 大号斜体数字 + 双方队徽色块 + #C8F230 比赛分钟）。
2. 球场与磁性棋子：球场改深松石草皮条纹（#112920 / #163529）+ 粉笔白线；场上 22 名球员改用带粗黑墨圈与硬偏移影的「磁性战术棋子」（半径 13~15px，点选热区通过 hits.addTouchTarget 强制扩至 >= 44×44）；role 标签按实际字体宽度绘制并保持最小可读字号 >= 12px。
3. 左侧实时文字播报：保留最新 8~10 条（旧条支持滚动/查看），字号 >= 14px，行高动态 >= 22px，彻底消灭文字重叠；右侧统计条保持简洁双色对比条 + 大字等宽数值。
4. 底部 4 张暖纸实体指令手牌（扇形抽出 + 拍桌出牌）：
   - 手牌高度提升至 116~124px，卡片使用暖纸 drawPrintCard（招牌绝技带黄铜底色），微倾排列；
   - 移动端两段式防误触手感：首次点击某卡使其向上抽出 24px 高亮预览收益/代价并在球场绘制粉笔虚线热区（联动现有 0.25x 慢放预览）；再次点击（或点击卡上大字「拍板」区）立即生效并砸下 `已拍板` 红章。
5. 接入 MangaCutIn（Motion.ts）：
   - 仅在「我方进球」和「打出招牌绝技/高潮指令」时触发 MangaCutIn 漫画斜切横幅（1.2s 自动结束，且屏幕任意点击调用 cutIn.dismiss() 秒跳，绝不阻塞暂停或换人）。

【严禁事项】
- 最高警告：严禁修改 MatchDayScreen.ts 中任何比赛引擎推进、体能消耗、阵型计算、xG 统计、换人规则或快进结算逻辑！只改渲染与手牌交互表现。

【验收命令与汇报要求】
改完后运行：npm run verify
汇报修改要点及 npm run verify 完整输出。
```

---

#### Prompt 2E · Phase 2 核心页：战术板与引援中心降密改造（`TacticsScreen.ts` + `ClubRosterScreen.ts`）

```text
【任务目标】
完成 TacticsScreen.ts 与 ClubRosterScreen.ts 的「2×3 舒展大卡降密」改造，消灭 loadout 指令槽文字溢出，并为战术板加入磁性棋子吸附与粉笔连线动效。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（第 3.2 节、第 6.1 节第 2、6 项）
2. packages/game-ui/src/screens/TacticsScreen.ts
3. packages/game-ui/src/screens/ClubRosterScreen.ts

【允许修改的文件白名单】
- packages/game-ui/src/screens/TacticsScreen.ts
- packages/game-ui/src/screens/ClubRosterScreen.ts

【具体改造清单】
1. ClubRosterScreen.ts：
   - 右侧球员卡片网格从 3×3（9 张/页）改为 2×3（6 张舒展暖纸大卡/页），同步更新分页总数计算；
   - 卡片采用「正面大头像+姓名+大字CA/PA+核心色条」+「右上折耳 2D 翻牌看特质与兼职详情」；
   - 左侧数据榜单从 10 行改为 8 行/页（行高 >= 46px），名字与 CA/PA 分行无挤压；
   - 顶部转会窗状态横幅长句使用 drawWrappedText（最多 2 行），筛选/排序按钮全部接入 hits.addTouchTarget(>=44×44)。
2. TacticsScreen.ts：
   - 右侧替补席从 3×4（12 张/页）改为 2×3（6 张舒展暖纸大卡/页），同步更新分页；
   - 左侧绿茵场上棋子选中时呈浮起态（scale 1.08 + 8px 硬阴影），换人落位时绘制短暂扩大的淡白粉笔灰圆环；错位球员旁画手绘感红色粉笔叉，化学共鸣位置间拉出荧光绿/黄铜流动虚线；
   - 站位格与切换按钮热区通过 addTouchTarget 扩至 >= 44px；化学连线点击容差扩至 >= 22px；
   - 「指令与绝技 loadout」标签页内 4 个指令槽高度拉高至 >= 140px，收益与代价各压缩为 1 行「图标+缩写数值」并用 fitText 保底，彻底消除溢出。

【严禁事项】
- 严禁改动球员筛选排序逻辑、最佳首发算法、转会交易/续约/青训提拔数据逻辑与阵型保存结构。

【验收命令与汇报要求】
改完后运行：npm run verify
汇报分页数变更、溢出修复点及 npm run verify 完整结果。
```

---

#### Prompt 3 · Phase 3 收尾：次级页、6 弹窗与全量截图回归

```text
【任务目标】
完成剩余 6 个次级页面与 6 个弹窗的 PITCH PRINT 风格统一、降密分页与 >=44×44 热区兜底，执行全量 UI 截图并检查是否有文字溢出。

【先读文件】
1. docs/PITCH_PRINT_ART_AND_MOTION_SPEC.md（第 3.2 节第 6~13 项、第 6.1 节第 7、8 项、第 8.3 节）
2. packages/game-ui/src/PlayerModal.ts 及其他 5 个 *Modal.ts
3. LeagueScreen.ts, PostMatchReDraftScreen.ts, HallOfFameScreen.ts, MetaScreen.ts, PrologueScreen.ts, SeasonEndScreen.ts

【允许修改的文件白名单】
- packages/game-ui/src/screens/LeagueScreen.ts
- packages/game-ui/src/screens/PostMatchReDraftScreen.ts
- packages/game-ui/src/screens/HallOfFameScreen.ts
- packages/game-ui/src/screens/MetaScreen.ts
- packages/game-ui/src/screens/PrologueScreen.ts
- packages/game-ui/src/screens/SeasonEndScreen.ts
- packages/game-ui/src/PlayerModal.ts
- packages/game-ui/src/StoryModal.ts
- packages/game-ui/src/SettingsModal.ts
- packages/game-ui/src/SaveSlotModal.ts
- packages/game-ui/src/ConfirmModal.ts
- packages/game-ui/src/TextInputModal.ts

【具体改造清单】
1. PlayerModal.ts（重点）：改暖纸大档案卡风格；33 个球衣号码选号格由 28×25 拆为 2 页（5 列×4 行，每格 >= 44×44）；10 条属性条拉高至 10px + 右对齐等宽大字。
2. 其余 5 个弹窗：统一用 drawPrintCard 风格边框 + 硬阴影 + 按钮 >= 44px 高；SettingsModal 滑条热区高 >= 44px，快捷键说明改 2 行。
3. LeagueScreen.ts：10 队积分榜精简为 8 列（合并 胜-平-负 与 进失(净)），行高 >= 44px，字号 >= 13px，升级/降级区改高对比左侧荧光青/朱红竖条。
4. PostMatchReDraftScreen.ts：评分榜改 8 行/页（行高 >= 42px）；我方阵容改 10 行/页分页；补强三选一改 3 张大号暖纸卡 + 撕封条开包态。
5. HallOfFameScreen.ts：成就列表降为 6~8 条/页；未解锁项降饱和度线稿，已解锁盖黄铜印章；点击奖杯触发单道斜向扫光（drawFoilShimmer）。
6. MetaScreen.ts：星盘旋转加入 3° 黄铜棘轮过冲回弹（easeOutBack）与黄铜齿轮音效；节点取消密集小字标签，点击选中时底部弹出大字暖纸详情浮卡；基建 8 卡改 2×3（6 张/页，2 页切换），短句+块状等级点。
7. PrologueScreen.ts 与 SeasonEndScreen.ts：序章底栏改暖纸漫画台词框（>=15px）；结算大名单分页（8~10 行/页）+ Δ 用 drawDeltaBadge + 长横幅 drawWrappedText 2 行。

【严禁事项】
- 全项目严禁留存任何 < 12px 字号调用；严禁修改 core/engine 逻辑。

【验收命令与汇报要求】
1. 运行 npm run verify && npm run test:ui
2. 若连有真机设备，运行 npm run cli:device -- --smoke
3. 汇报全量检查结果，明确列出是否还存在任何文本截断或小热区遗留。
```

---

### 9.3 生图 AI 美术资产提示词（可选外包给生图 Agent）

> 说明：程序跑通完全不依赖下列外部新图（Phase 1 已自带纯矢量新版 Logo 与黄铜星盘）；如需进一步提升静态图质感，可把以下 Prompt 直接发给生图 Agent 并压缩转成 `.webp` 放入 `apps/steam/assets/art/`。

1. **新游戏主 Logo 徽标（替换旧火焰足球 `game_logo.webp`，`1024×512` 透明 PNG/WebP，无文字由程序叠加或另排版）**
   > `minimalist vintage football club crest emblem and slanted dynamic tactical arrow, classic pentagon football inside a bold red #E03A2E and deep pine green #112920 shield, graphic novel sports illustration, bold black ink outlines #111412, crisp two-tone cel shading, matte brass gold #D8A842 corner ribbon, isolated on pure transparent background, flat editorial print aesthetic, NO fire, NO flames, NO glossy 3D render, NO neon glow, NO text, NO letters, NO numbers, NO watermarks`

2. **统一画风成就徽章模板（替换 P2 `ach/*.webp`，`512×512` 透明 PNG/WebP）**
   > `sculpted octagonal championship medallion icon [REPLACE_WITH_SUBJECT: e.g. three flying footballs / goalkeeper gloves holding diamond shield / tactical anvil and compass], graphic novel sports illustration, bold black ink outlines #111412, matte brushed brass gold #D8A842 and deep pine green #112920 enamel, subtle halftone dot shading, isolated on pure transparent background, flat editorial print aesthetic, NO 3D glossy RPG render, NO neon glow, NO text, NO numbers`

3. **统一画风球探档案袋/补强包模板（替换 P2 `pack_*.webp`，`512×680` 透明 PNG/WebP）**
   > `tactile kraft archival scouting dossier envelope tied with a diagonal striker vermilion #E03A2E paper seal and brass clasp [REPLACE_WITH_VARIANT: football tactic board stencil / gilded captain emblem], graphic novel sports illustration, bold black ink outlines #111412, crisp cel shading, subtle paper grain and halftone texture, isolated on pure transparent background, NO glossy 3D lootbox, NO neon glow, NO text, NO letters`
