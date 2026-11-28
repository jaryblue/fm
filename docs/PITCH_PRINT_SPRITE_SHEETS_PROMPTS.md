# 《再开一局》(Kickoff Again) — 圣物 / 绝技 / 指令 网格拼图（Sprite Sheet）提示词全案

> **文档用途**：专门面向「**单张大图生成多图标 → 本地脚本自动均分抠图**」的高效管线。包含 **赛季战术圣物 `4×2`（8 件 1 对 1）**、**主动绝技 `4×4`（16 个动作母题覆盖全 59 个绝技）**、**临场指令卡 `4×4`（16 张流派主题插画覆盖全 122 张指令）** 共 3 套拼图提示词（附 `4×2` 拆分保底提示词）、逐格 ID 映射表与交付规范。

---

## 一、拼图出图与自动抠图铁律（Auto-Slice Spec）

为了让设计师一次生成多枚图标、并在回传后由脚本 100% 全自动裁切、抠透和命名入库（不产生白边、杂线或跨格粘连），**所有拼图必须严格遵守以下规范**：

### 1. 全局画风与核心色板（PITCH PRINT v1.0）
- **画风统一**：现代体育画刊平面插画（*ligne claire* 清晰闭合墨线 + 2-tone 赛璐璐二分明暗 + 局部印刷半调网点 halftone dots），彻底拒绝 3D 塑料盲盒感与蓝紫赛博霓虹。
- **主色板**：
  - 闭合描边：`#111412`（硬墨黑外轮廓，**必须封闭不开口**）
  - 朱红主角色：`#E03A2E`
  - 冠军暖金：`#D8A842`
  - 战术荧光绿：`#C8F230`
  - 钴蓝战术色：`#2B6BE6`
  - 新闻暖纸白：`#F4EFE4`（图标内部高光用 `#F4EFE4`，与背景纯白 `#FFFFFF` 拉开轻微色差）
  - 球场森林绿：`#112920` / `#0A1A14`

### 2. 四条自动切图硬规矩（交给设计师 / AI 时务必强调）
1. **严格等分对齐网格**：
   - 圣物 `4×2`：`2048 × 1024 px`（`--ar 2:1`，4 列 × 2 行，每格 `512 × 512 px`）
   - 绝技 `4×4`：`2048 × 2048 px`（`--ar 1:1`，4 列 × 4 行，每格 `512 × 512 px`）
   - 指令 `4×4`：`2048 × 2048 px`（`--ar 1:1`，4 列 × 4 行，每格 `512 × 512 px`）
2. **纯平纯白底色 `#FFFFFF` + 闭合墨线**：
   - **为什么用纯白 `#FFFFFF` 而不用绿幕或深绿底？** 绿幕会给荧光绿/森林绿图标带来严重的边缘溢出杂色，深底则会吞掉 `#111412` 黑色阴影；图标外轮廓用 `#111412` 封闭描边、内部亮部用暖纸白 `#F4EFE4`、外部背景铺纯平 `#FFFFFF`，脚本从四角泛洪抠白即可得到边缘完美干净的透明通道。
3. **零分割线、零外框、零文字**：
   - 拼图内**严禁**画灰色/黑色格子分割线、严禁画卡片边框、严禁写序号/字母/中文标签。
   - 每个独立图标四周必须留足 **至少 `15%` 纯白留白区**，禁止道具、投影或速度线跨出各自隐形格子的边界。
4. **防翻车保底方案（支持拆两张 `4×2`）**：
   - 若使用的 AI 模型（如部分生图模型）一次画 `4×4 = 16` 格容易串行或精度下滑，**第三章与第四章均额外附带拆分版（两张 `4×2`，即 8 格一张）的完整英文提示词**，可直接改用两张 `4×2` 出图，切图逻辑完全兼容。

### 3. 全局负面提示词（Global Negative Prompt）

> 以下负面提示词适用于 **所有** 拼图：

```text
grid lines, dividing lines, borders, box frames, labels, numbers, text, letters, watermark, overlapping icons, cropped edges, drop shadows touching border, photorealistic, 3d render, octane render, glossy plastic, soft blur, neon purple, sci-fi hologram
```

---

## 二、拼图 1（P0）：赛季战术圣物 `4×2` 网格图（8 件 · 1 对 1 独立图标）

对应 [AstrolabeManager.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/v6/AstrolabeManager.ts#L102-L154) 中定义的全部 **8 件 `V6_RELICS`**。每件都有极强的足球文化与机制识别度，必须 1 对 1 独立绘制。

- **输出规格**：原图 `2048 × 1024 px`（`--ar 2:1`）→ 脚本自动均分为 8 枚 `128 × 128 px` 透明底 `.webp`（单张 `< 8 KB`）。
- **交付路径（原图）**：`apps/steam/assets/art/raw_sheets/sheet_relics_4x2.png`
- **切图产出路径**：`apps/steam/assets/art/relics/relic_<id>.webp`

### `4×2` 逐格设计表

| 网格位置 | Relic ID | 中文名称 | 稀有度 | 视觉核心设计（纯白底独立贴纸道具） |
| :--- | :--- | :--- | :--- | :--- |
| **第1行 第1列 (R1C1)** | `board_expand` | 战术板扩容 | `mythic` | 展开的双折教练磁力战术板，顶部厚重金铜夹头 + 3 枚发光荧光绿指令贴片卡槽 |
| **第1行 第2列 (R1C2)** | `rich_budget` | 充裕指挥预算 | `gold` | 刻有足球盾牌徽记的金属黄金钞票夹，稳稳夹住一叠整齐的暖白纸钞与硬币 |
| **第1行 第3列 (R1C3)** | `hairdryer` | 弗格森吹风机 | `gold` | 复古红银配色老式强力吹风机，风嘴喷出漫画硬边红金音浪与热风速度线 |
| **第1行 第4列 (R1C4)** | `comeback_gene` | 逆转基因 | `mythic` | 朱红与冠军金交织的 DNA 双螺旋链，中心缠绕一枚经典黑白足球与亮荧光绿闪电 |
| **第2行 第1列 (R2C1)** | `deadball_mage` | 死球魔术师 | `purple` | 墨黑镶金带魔术礼帽倒扣向上，帽口飞出一道带着金色星芒尾迹的弧线香蕉球 |
| **第2行 第2列 (R2C2)** | `san_siro_gloves` | 圣西罗门神手套 | `gold` | 一双红白金配色的厚实职业门将手套，十指张开稳稳抱住印着盾牌纹章的足球 |
| **第2行 第3列 (R2C3)** | `super_bench` | 超级替补席 | `purple` | 倾斜动感的朱红专业赛场替补席桶椅，两侧配荧光绿加速飞翼与双色换人箭头 |
| **第2行 第4列 (R2C4)** | `clutch_clock` | 压哨绝杀时钟 | `mythic` | 古典裁判机械怀表式停表，红色扇形倒计时警戒区指向 90 分钟读秒与金黄火花 |

### 整张 `4×2` 复制即用 English AI Prompt

```text
Clean 4x2 grid sprite sheet of 8 distinct flat-vector comic football relic icons arranged in 2 horizontal rows of 4 equal columns, no grid lines, no dividing borders, no text, no letters, no numbers. STRICTLY isolated on pure solid flat #FFFFFF white background, generous 15% white margin around every single icon so nothing touches or overlaps. Unified PITCH PRINT graphic novel style: thick closed #111412 black ink outlines, crisp 2-tone cel shading, subtle halftone dot texture, cohesive palette of stadium red (#E03A2E), championship gold (#D8A842), tactical lime (#C8F230), cobalt blue (#2B6BE6), cream (#F4EFE4), deep pitch green (#112920).
Row 1 (top left to right):
1) Folding magnetic football coach tactical clipboard with brass clip and three glowing lime (#C8F230) extra card slots;
2) Heavy brushed gold (#D8A842) money clip stamped with soccer emblem holding crisp folded cream (#F4EFE4) banknotes;
3) Retro crimson red (#E03A2E) and silver hairdryer blasting sharp comic red-and-lime shockwave wind streaks;
4) Glowing red (#E03A2E) and gold (#D8A842) DNA double helix spiraling around a soccer ball and a sharp lime lightning bolt;
Row 2 (bottom left to right):
5) Sleek black-and-gold (#D8A842) magician top hat shooting out a curving golden banana-kick soccer ball trail with stars;
6) Pair of bold red-white-gold goalkeeper gloves firmly gripping a soccer ball with a mini shield crest;
7) Racing-style crimson (#E03A2E) stadium dugout bucket seat with dynamic lime (#C8F230) speed wings and substitution arrows;
8) Heavy brass referee stopwatch with red (#E03A2E) stoppage-time sector zone near 90 minutes and golden impact sparks.
Flat 2D game UI icon sheet, sharp crisp silhouettes readable at small sizes --ar 2:1
```

---

## 三、拼图 2（P1）：主动绝技 `4×4` 网格图（16 个动作母题 · 覆盖全 59 个绝技）

[skillsCatalog.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/v6/skillsCatalog.ts) 共定义了 **59 个 `V6_ACTIVE_SKILLS`**。通过提炼 **16 个高辨识度球场动作母题**，用 1 张 `4×4`（或拆 2 张 `4×2`）拼图完整覆盖全量 59 个绝技；运行时 UI 再按绝技所属流派与等级叠加外框与 `R1~R3` 徽记。

- **输出规格**：原图 `2048 × 2048 px`（`--ar 1:1`）→ 脚本均分 16 枚 `128 × 128 px` 透明底 `.webp`（单张 `< 8 KB`）。
- **交付路径（原图）**：`apps/steam/assets/art/raw_sheets/sheet_skills_4x4.png`（拆分版：`sheet_skills_a_4x2.png`、`sheet_skills_b_4x2.png`）
- **切图产出路径**：`apps/steam/assets/art/skills/skill_<key>.webp`

### `4×4` 逐格设计表（共 16 枚）

| 格子 | Skill Art Key | 中文动作母题 | 视觉主体（纯白底独立圆形/斜切动态徽章意象） | 覆盖代表绝技（全 59 个归属示例） |
| :--- | :--- | :--- | :--- | :--- |
| **R1C1** | `scalpel_pass` | 手术刀直塞 | 荧光绿锋利直线穿过两名红色防守人剪影间隙的足球弧线 | `sk_tt_1`、`sk_f_3412`、`sk_f_41212` |
| **R1C2** | `tiki_flow` | Tiki-Taka 连传 | 三角形传球连线节点之间高速往返的足球与流畅循环箭头 | `sk_tt_3`、`sk_m_tt`、`sk_bl_3` |
| **R1C3** | `dribble_foul` | 游龙突破造犯规 | 灵巧足球绕过红色障碍桩带出金色闪耀星火与哨子 | `sk_tt_2`、`sk_pb_2` |
| **R1C4** | `gegenpress_swarm` | 高压三叉围抢 | 三枚朱红高压箭头从三面包夹锁死中央蓝白足球 | `sk_gp_1`、`sk_gp_2`、`sk_f_343`、`sk_m_gp` |
| **R2C1** | `blitz_counter` | 闪电防反突刺 | 猎豹爪痕般斜向撕裂画面的红金闪电与高速推进足球 | `sk_gp_3`、`sk_ct_3`、`sk_m_ct` |
| **R2C2** | `solo_finish` | 单刀冷静推射 | 球靴内脚背精准推射对角球门死角的瞬间定格 | `sk_ct_1`、`sk_f_4231` |
| **R2C3** | `power_volley` | 电梯世界波重炮 | 强力凌空抽射出带火焰与音爆环的朱红重炮足球 | `sk_bl_1`、`sk_f_442`、`sk_f_4411`、`sk_f_4321` |
| **R2C4** | `aerial_header` | 空霸头球绝杀 | 球员跃起剪影重锤顶球俯冲砸入球网顶部死角 | `sk_wp_1`、`sk_pb_1`、`sk_f_352` |
| **R3C1** | `wing_switch` | 两翼大转移/传中 | 跨越大半个草皮的超高金色抛物线传中弧线与翼卫箭簇 | `sk_wp_2`、`sk_wp_3`、`sk_wp_5`、`sk_f_3421`、`sk_m_wp` |
| **R3C2** | `long_ball` | 制导长传过顶 | 贴近中圈发出的精准过顶吊传抛物线靶心锁定前锋区 | `sk_tt_5`、`sk_ct_6`、`sk_f_523` |
| **R3C3** | `gk_save` | 门神飞身神扑 | 戴金色手套的门将腾空侧扑挡出贴柱爆射的瞬间 | `sk_pb_5`、`sk_f_532`、`sk_tt_6` |
| **R3C4** | `gk_launch` | 门将手抛制导 | 门将大力抛球发动快反的蓄力手臂与长距制导轨迹 | `sk_ct_5`、`sk_f_5212` |
| **R4C1** | `slide_tackle` | 极限滑铲封堵 | 飞身铲断足球瞬间迸发的荧光绿草屑与铁血断球符号 | `sk_wp_4`、`sk_wp_6`、`sk_pb_4`、`sk_pb_6`、`sk_ct_2`、`sk_gp_6` |
| **R4C2** | `iron_fortress` | 铁壁筑墙/造越位 | 厚重深绿金属盾墙与越位警示红线拦截来球 | `sk_f_541`、`sk_f_4141`、`sk_gp_5`、`sk_m_pb`、`sk_bl_6` |
| **R4C3** | `captain_roar` | 队长怒吼/逆转精神 | 戴红色队长袖标的高举手臂剪影与金色声波士气爆发 | `sk_bl_2`、`sk_bl_4`、`sk_bl_5`、`sk_pb_3`、`sk_m_bl` |
| **R4C4** | `total_football_ult` | 全军破限·全攻全守 | 十一道金红光矢齐射爆发的皇冠足球神徽（终极奥义感） | `sk_ult_core`、`sk_f_433`、`sk_f_4222` |

### 方案 A：整张 `4×4` 英文 AI Prompt

```text
Clean 4x4 grid sprite sheet of 16 distinct flat-vector comic football tactical skill icons arranged in 4 rows of 4 equal columns, no grid lines, no frames, no borders, no text, no letters, no numbers. STRICTLY isolated on pure solid flat #FFFFFF white background, generous 15% white padding around each icon, nothing touching adjacent icons. Unified PITCH PRINT comic novel art style: bold closed #111412 black ink outlines, crisp 2-tone cel shading, halftone accent dots, palette of stadium red (#E03A2E), championship gold (#D8A842), tactical lime (#C8F230), cobalt blue (#2B6BE6), cream (#F4EFE4), dark green (#112920).
Row 1: 1) Sharp lime scalpel-arrow pass slicing between two red defender markers; 2) Triangle passing network connecting a soccer ball with looping arrows; 3) Agile dribbling soccer ball weaving around cones with a referee whistle spark; 4) Three aggressive red arrows swarming and trapping a blue soccer ball in the center;
Row 2: 5) Diagonal crimson-gold lightning claw slash propelling a high-speed counterattack ball; 6) Football boot precision low shot aiming at bottom goal corner target; 7) Blazing crimson comet power volley soccer ball with sonic boom rings; 8) Dominant jumping player silhouette striking a crushing header toward goal net;
Row 3: 9) Sweeping golden diagonal cross arc flying wide from wing touchline to penalty box; 10) High lofted guided long ball arc landing on a glowing lime crosshair reticle; 11) Diving goalkeeper with golden gloves parrying a blazing shot at the goal post; 12) Goalkeeper throwing a missile-fast arm launch pass forward with kinetic lines;
Row 4: 13) Clean dramatic sliding tackle boot intercepting the ball with turf spray sparks; 14) Fortress steel-green interlocking wall shield blocking an incoming red offside line; 15) Raised fist silhouette wearing crimson captain armband radiating golden morale waves; 16) Ultimate Total Football crest: crowned soccer ball bursting with golden-red radial arrows.
Clean 2D game ability icons, bold readable silhouettes --ar 1:1
```

### 方案 B（保底拆分）：两张 `4×2` 英文 AI Prompt（精度更高，不串格）

<details>
<summary>点击展开：绝技拆分版 Sheet 2A（上两行 8 个）+ Sheet 2B（下两行 8 个）</summary>

**Sheet 2A（`sheet_skills_a_4x2.png`，`--ar 2:1`）**：
```text
Clean 4x2 grid sprite sheet of 8 flat-vector comic football skill icons in 2 rows of 4 columns, no grid lines, no borders, no text, strictly isolated on pure flat #FFFFFF white background with 15% padding around each icon. PITCH PRINT graphic novel style, thick closed #111412 ink outlines, 2-tone cel shading, red (#E03A2E), gold (#D8A842), lime (#C8F230), cobalt (#2B6BE6), dark green (#112920).
Row 1: 1) Sharp lime arrow slicing between two red defender silhouettes; 2) Triangle passing circuit connecting soccer ball with crisp arrows; 3) Dribbling soccer ball weaving past cones with referee whistle spark; 4) Three crimson press arrows swarming a trapped ball;
Row 2: 5) Crimson-gold lightning counterattack slash with speeding ball; 6) Football boot precision finish toward goal corner target; 7) Fiery crimson power volley ball with shockwave ring; 8) Airborne jumping header striking ball toward top net. --ar 2:1
```

**Sheet 2B（`sheet_skills_b_4x2.png`，`--ar 2:1`）**：
```text
Clean 4x2 grid sprite sheet of 8 flat-vector comic football skill icons in 2 rows of 4 columns, no grid lines, no borders, no text, strictly isolated on pure flat #FFFFFF white background with 15% padding around each icon. PITCH PRINT graphic novel style, thick closed #111412 ink outlines, 2-tone cel shading, red (#E03A2E), gold (#D8A842), lime (#C8F230), cobalt (#2B6BE6), dark green (#112920).
Row 1: 9) Wide golden diagonal long cross arc flying into penalty area; 10) Lofted long ball trajectory landing on a lime crosshair target; 11) Diving goalkeeper with gold gloves making a dramatic fingertip save; 12) Goalkeeper missile hand-throw launch forward;
Row 2: 13) Sliding tackle boot cleanly intercepting ball with grass sparks; 14) Heavy emerald steel fortress shield wall blocking red offside trap line; 15) Raised arm with crimson captain armband radiating golden soundwave boost; 16) Ultimate crowned soccer ball bursting with golden-red radial attack arrows. --ar 2:1
```

</details>

---

## 四、拼图 3（P1/P2）：临场指令卡 `4×4` 网格图（16 张流派主题插画 · 覆盖全 122 张指令）

[directivesCatalog.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/core/src/v6/directivesCatalog.ts) 共定义了 **122 张 `V6_DIRECTIVES`**（6 大打法 × 12 张 + 32 张阵型卡 + 18 张融合卡）。按「**6 大流派 × 攻/守（12 张）+ 4 类融合/体系特化（4 张）**」组织成 1 张 `4×4`（或 2 张 `4×2`）拼图，正好完美映射全量 122 张卡片。

- **输出规格**：原图 `2048 × 2048 px`（`--ar 1:1`）→ 脚本均分裁出 16 张 `256 × 256 px` 方形插画 `.webp`（单张 `< 18 KB`）。
- **构图特别提醒（与前两张的区别）**：指令卡插画将**嵌入游戏内卡牌画框中**，因此这 16 格不是异形白底贴纸，而是 **16 幅各自独立的正方形全彩漫画小场景（`square comic panel vignette`）**，每一幅自带 `#111412` 细黑边方形画框，画框与画框之间留出 **宽阔纯净的 `#FFFFFF` 白色通道（gutter ≥ 12% 格宽）**，脚本即可直接裁切出干净的 `256×256` 方图。
- **交付路径（原图）**：`apps/steam/assets/art/raw_sheets/sheet_directives_4x4.png`（拆分版：`sheet_directives_a_4x2.png`、`sheet_directives_b_4x2.png`）
- **切图产出路径**：`apps/steam/assets/art/directives/dir_<key>.webp`

### `4×4` 逐格设计表（共 16 幅卡画）

| 格子 | Directive Art Key | 覆盖题材 | 漫画小场景画面描述 |
| :--- | :--- | :--- | :--- |
| **R1C1** | `tt_atk` | **传控 · 进攻** (`tiki_taka · ATK`) | 红衣中场球员之间形成明亮荧光绿几何三角短传渗透，刀锋般直塞撕开对手禁区 |
| **R1C2** | `tt_def` | **传控 · 控场** (`tiki_taka · DEF`) | 后卫与门将冷静围成圆阵从容倒脚控球，周围蓝色逼抢球员无从下脚 |
| **R1C3** | `gp_atk` | **高压 · 抢攻** (`gegenpress · ATK`) | 三名红衣前锋狂暴压迫抢断对手中卫，就地起脚爆射的炸裂瞬间 |
| **R1C4** | `gp_def` | **高压 · 围堵** (`gegenpress · DEF`) | 中圈形成紧密朱红防线口袋合围，全员狂奔回追掐断对手反击路线 |
| **R2C1** | `wp_atk` | **边路 · 爆破** (`wing_play · ATK`) | 边锋沿边线底线强突下底起球传中，禁区双塔中锋抢点飞跃轰炸 |
| **R2C2** | `wp_def` | **边路 · 封锁** (`wing_play · DEF`) | 边后卫高速飞铲封堵对手边路传中线路，荧光绿保护弧覆盖边路走廊 |
| **R2C3** | `ct_atk` | **防反 · 闪击** (`counter · ATK`) | 一记长传跨过半场直找单刀前锋，身后蓝色防线被狂风般抛在脑后 |
| **R2C4** | `ct_def` | **防反 · 诱捕** (`counter · DEF`) | 沉着后场缩回紧凑防线拦截来球，门将与后卫眼神示意准备随时反咬 |
| **R3C1** | `pb_atk` | **铁桶 · 偷鸡** (`park_bus · ATK`) | 重兵压在定位球角球区争顶偷袭，红金高空争顶火花四射 |
| **R3C2** | `pb_def` | **铁桶 · 死守** (`park_bus · DEF`) | 禁区前筑起五道深墨绿钢铁人墙与门神飞扑，任何射门皆被盾牌弹回 |
| **R3C3** | `bl_atk` | **均衡 · 压阵** (`balanced · ATK`) | 中轴核心挥臂调度阵型整体前压，远射炮火从禁区弧顶呼啸而出 |
| **R3C4** | `bl_def` | **均衡 · 稳阵** (`balanced · DEF`) | 老队长在场心大喊稳住防线阵脚，全队三条线整齐划一横向移动落位 |
| **R4C1** | `fu_3back_blitz` | **三后卫全攻融合** (`3-back fusion`) | 三中卫身后全员化身红色狂潮兵压前场，边翼卫如双翼利剑狂飙 |
| **R4C2** | `fu_4back_control` | **四后卫中轴掌控** (`4-back fusion`) | 双后腰坐镇中路精密齿轮运转，左右边后卫交替套上立体进攻 |
| **R4C3** | `fu_5back_fortress` | **五后卫钢铁要塞** (`5-back fusion`) | 五名铁血守将组成不可逾越的城墙堡垒，搭配神勇门将守望零封夜 |
| **R4C4** | `fu_setpiece_clutch` | **定位球 / 补时绝杀** (`clutch / set-piece`) | 90 分钟大时钟背景下，禁区乱战倒钩与角旗弧线绝杀球飞入网窝 |

### 方案 A：整张 `4×4` 英文 AI Prompt

```text
Clean 4x4 grid of 16 square comic-book panel illustrations depicting football tactical moments, arranged neatly in 4 rows of 4 equal columns with wide pure solid #FFFFFF white gutters separating every square panel, NO text, NO letters, NO numbers, NO speech bubbles. Each square panel has a crisp thin #111412 black border frame around rich full-bleed artwork inside the square. Unified PITCH PRINT graphic novel style: bold ink lines (#111412), 2-tone cel shading, comic halftone dots, cohesive palette of deep pitch green (#112920), stadium crimson red (#E03A2E), cobalt blue (#2B6BE6), championship gold (#D8A842), lime tactical highlight (#C8F230), warm cream (#F4EFE4).
Row 1: 1) Tiki-taka attack: red players executing glowing lime geometric triangle passes slicing into box; 2) Tiki-taka control: calm defenders and keeper passing coolly in tight circle escaping press; 3) Gegenpress attack: three red forwards furiously winning ball high and blasting immediate shot; 4) Gegenpress trap: tight mid-pitch red pressing cage swarming blue carrier to kill counter;
Row 2: 5) Wing play attack: rapid red winger whipping cross from corner touchline to leaping strikers; 6) Wing play defense: fullback sliding to block flank cross with protective lime lane arc; 7) Counter attack blitz: blazing solo striker sprinting clear on goal leaving blue defenders behind; 8) Counter defense: compact backline intercepting pass as goalkeeper signals quick break;
Row 3: 9) Park the bus set-piece: towering aerial clash in crowded penalty box on corner kick; 10) Park the bus fortress: dense emerald steel wall of defenders and diving keeper repelling shots; 11) Balanced attack: midfield playmaker commanding waves forward with thunderous long shot from arc; 12) Balanced defense: veteran captain gesturing to keep disciplined symmetrical defensive lines;
Row 4: 13) 3-back all-out crimson blitz wave swarming across entire attacking half; 14) 4-back tactical precision gears with overlapping fullbacks and double pivot midfield; 15) 5-back impenetrable iron fortress backline standing resolute under stadium floodlights; 16) Dramatic 90th-minute stoppage time bicycle-kick winner flying into net under glowing stadium clock.
Clean square panels on pure white grid background --ar 1:1
```

### 方案 B（保底拆分）：两张 `4×2` 英文 AI Prompt

<details>
<summary>点击展开：指令卡插画拆分版 Sheet 3A（上两行 8 张）+ Sheet 3B（下两行 8 张）</summary>

**Sheet 3A（`sheet_directives_a_4x2.png`，`--ar 2:1`）**：
```text
Clean 4x2 grid of 8 square comic-book football tactical panel illustrations arranged in 2 rows of 4 columns with wide pure solid #FFFFFF white gutters between panels, NO text, NO numbers. Each square has a thin #111412 black border frame. PITCH PRINT graphic novel style, #111412 ink lines, halftone dots, deep pitch green (#112920), crimson red (#E03A2E), cobalt blue (#2B6BE6), gold (#D8A842), lime (#C8F230), cream (#F4EFE4).
Row 1: 1) Red players linking sharp lime triangle passes into box; 2) Calm defenders passing in tight circle avoiding press; 3) Three red strikers pressing high to steal ball and shoot; 4) Midfield pressing cage swarming blue ball carrier;
Row 2: 5) Winger whipping cross from touchline to leaping headers; 6) Fullback sliding bravely to block flank cross; 7) Solo striker sprinting away on blazing fast counterattack; 8) Compact backline intercepting pass ready to spring break. --ar 2:1
```

**Sheet 3B（`sheet_directives_b_4x2.png`，`--ar 2:1`）**：
```text
Clean 4x2 grid of 8 square comic-book football tactical panel illustrations arranged in 2 rows of 4 columns with wide pure solid #FFFFFF white gutters between panels, NO text, NO numbers. Each square has a thin #111412 black border frame. PITCH PRINT graphic novel style, #111412 ink lines, halftone dots, deep pitch green (#112920), crimson red (#E03A2E), cobalt blue (#2B6BE6), gold (#D8A842), lime (#C8F230), cream (#F4EFE4).
Row 1: 9) Intense aerial corner kick battle in crowded goalmouth; 10) Unbreakable emerald defensive shield wall blocking shots; 11) Midfield orchestrator unleashing thunderous long-range strike; 12) Captain organizing disciplined aligned defensive lines;
Row 2: 13) 3-back all-out crimson attack wave sweeping forward; 14) 4-back overlapping fullbacks and dual pivot control; 15) 5-back impenetrable defensive castle under night floodlights; 16) Dramatic stoppage-time overhead winner into top corner. --ar 2:1
```

</details>

---

## 五、交付回收与本地自动抠切流水线

设计师出完拼图后，直接把高清原图放进下面目录，不需要手动切图或逐张抠图：

1. **原图存放目录**：`apps/steam/assets/art/raw_sheets/`
   - `sheet_relics_4x2.png`
   - `sheet_skills_4x4.png`（或 `sheet_skills_a_4x2.png` + `sheet_skills_b_4x2.png`）
   - `sheet_directives_4x4.png`（或 `sheet_directives_a_4x2.png` + `sheet_directives_b_4x2.png`）
2. **我这边的一键自动化脚本处理流程**（使用本机 Python 3 + Pillow）：
   - 按精确格网等分裁切为 40 张单图；
   - 对圣物（8 张）与绝技（16 张）执行**边缘泛洪去纯白背景**（外轮廓有 `#111412` 闭合黑线保护，内部高光 `#F4EFE4` 零误伤），再按中心质心对齐并补齐 `8%` 安全边距；
   - 对指令卡插画（16 张）裁剪掉外白边槽，直接输出 `256 × 256 px` 无留白方形卡面；
   - 统一压缩为 `.webp` 落入 `apps/steam/assets/art/relics/`、`skills/`、`directives/`（40 张小图合计约 `380 KB` 左右，完全兼容微信小游戏体积限制）；
   - 最后自动注册进 [AssetLoader.ts](file:///Users/jary/WorkBuddy/zaikaiyiju/packages/game-ui/src/AssetLoader.ts) 并接入门户战术夹板 5 槽圣物架、星盘树、配卡面板与比赛日 HUD。
