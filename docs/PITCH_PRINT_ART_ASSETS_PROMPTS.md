# 《再开一局》(Kickoff Again) — PITCH PRINT v1.0 美术资源重制与 AI 生图提示词全案

> **文档用途**：交付给美术设计师 / AI 绘师直接出图的生产级规范文档。涵盖 **Logo & App 图标（P0）**、**按 7 级联赛阶段演进的 8 张可切换标题页主视觉底图（P0）**、**替换旧科幻/奇幻风格卡包与奖杯（P1）**、**12 枚成就徽章统一模板（P2）** 以及 **保留不动资源清单与交付验收规范**。

---

## 一、全局视觉圣经（PITCH PRINT v1.0 铁律）

所有新增与重制美术资源，必须严格对齐项目当前 UI 实装的 **PITCH PRINT（现代体育画刊 × 平面印刷网点 × 硬核漫画描边）** 视觉语言，彻底告别旧版的蓝紫科幻霓虹与 3D RPG 奇幻风。

### 1. 核心色板与质感规范

| 色彩角色 | Hex 色值 | 用途说明 |
| :--- | :--- | :--- |
| **球场深墨绿（Pitch Deep）** | `#0A1A14` | 阴影、暗角、左侧留白主底色 |
| **草皮森林绿（Pitch Mid）** | `#112920` | 中景层次、建筑与看台暗部、环境基调 |
| **新闻暖纸白（Newsprint Cream）** | `#F4EFE4` | 高光、球衣亮部、文件纸卡、Logo 主字填充 |
| **体育馆朱红（Stadium Red）** | `#E03A2E` | 主角标志色（林风球衣/队长袖标/重点徽章/印章） |
| **冠军暖金（Trophy Gold）** | `#D8A842` | 奖杯、高级联赛灯光、高光描边与荣誉点缀 |
| **战术荧光黄绿（Lime Accent）** | `#C8F230` | 极克制地用于战术线条、记分牌数字或球场激光感高光 |
| **纯墨黑描边（Hard Ink）** | `#111412` | 所有主体轮廓的粗实硬边墨线（`2px~4px` 视觉体感）与斜切硬阴影 |

**画风关键词**：
- 欧洲现代足球平面小说（Franco-Belgian *ligne claire* 清晰线条）+ 《体育画报》复古印刷海报 + 硬核赛璐璐二分明暗（2-tone cel shading）+ 局部印刷半调网点（halftone dot pattern）与细微纸张颗粒纹理（subtle paper grain）。
- **禁止元素**：禁用赛博朋克蓝紫发光、禁用 3D 盲盒塑料渲染质感、禁用韩系油腻厚涂、禁用写实照片拼贴感。

### 2. 全局通用负面提示词（Global Negative Prompt）

> 除文字排版说明外，以下负面提示词适用于 **所有** AI 生图提示词：

```text
3d render, unreal engine, octane render, photorealistic, photography, cyberpunk, neon purple, blue sci-fi hologram, glossy plastic, soft airbrushed gradients, fantasy RPG armor, chibi, super deformed, anime moe, blurry, watermark, signature, extra limbs, distorted football, messy text, garbled letters, low contrast
```

### 3. 【P0 铁律】标题页 8 张底图的强制安全区构图规范

当前 `TitleScreen.ts` 采用**左重右展**的非对称电影海报构图：
- **屏幕左侧 `0% ~ 45%`（约 `x: 0 ~ 576px` at 1280×720）**：叠加游戏 Logo、副标题 Slogan、主菜单功能卡（继续征程 / 开始新征程 / 生涯图鉴 / 荣誉设置）。
- **屏幕右侧 `45% ~ 100%`（约 `x: 580 ~ 1280px`）**：核心英雄构图展示区（人物背影/侧身、球场远景、奖杯、看台氛围）。

**给美术/AI 的构图死命令**：
1. **左暗空 45%**：画面左侧 45% 区域**严禁**出现强高光灯柱、杂乱人脸、复杂文字或高饱和刺眼物体；必须保持深邃、低对比度的暗绿/暗夜负空间（`#0A1A14` ~ `#112920` 渐变暗部 + 极淡网点）。
2. **右主视觉 55%**：将所有人物剪影/背影、球场灯光束、建筑地标、烟火与叙事重心全部偏置在画面右侧 55%（Golden Right-Thirds）。
3. **无内置文字**：底图本身**绝对不要**包含任何中文/英文标题字、版本号、假按钮或记分牌乱码字。

---

## 二、模块 A（P0）：游戏 Logo 与应用图标重制规范

当前 `apps/steam/assets/art/game_logo.webp` 与 `app_icon.png` 需与新画风对齐，建立品牌辨识度。设计原则为**“图字分离生成 + 平面设计师精修合成”**（AI 不擅长准确输出复杂中文字体，因此徽章图形与图标由 AI 生成，中文主标题由设计师用矢量排版完成）。

### A1. 游戏主 Logo（`game_logo.webp`）—— 设计师矢量排版规范

- **输出规格**：`1024 × 512 px`（2:1 横版，透明底 PNG 导出后再转无损/高质 `.webp`，文件大小建议 `< 90 KB`）。
- **结构拆解（3 层叠加）**：
  1. **底板层（斜切体育铭牌）**：向左上方微倾 `-4°` 的硬边平行四边形铭牌，底色 `#111412`，外围一圈 `4px` `#F4EFE4`（暖白）内框，右下角投射 `6px` 实色硬阴影（不模糊）。
  2. **左侧嵌入徽章**：嵌入下方 `A2` 生成的盾牌足球飞翼图形，占比约宽度 24%，左缘略微冲出铭牌边框形成破框动感。
  3. **主文字与年份标签**：
     - 中文主标题：**「再开一局」** —— 选用粗厚硬朗的现代几何运动黑体/斜切黑体（可参考汉仪尚巍手书硬派变体或方正正大黑斜体改造），文字向右上斜切 `8°`，填充 `#F4EFE4`（新闻暖白），外部 `4px` `#111412` 粗黑描边，底部叠加一层 `2px` `#E03A2E`（朱红）或 `#D8A842`（暖金）微错位印刷叠色。
     - 年份角标：**「2026」** 或 **「FOOTBALL ROGUELITE」** —— 放在主铭牌右下角重叠的一枚小矩形标签内，红底 `#E03A2E` + 白字 `#F4EFE4` 等宽数字，或荧光绿 `#C8F230` 黑字。
- **对比度检查**：Logo 会直接叠在标题页左上暗区与亮暖色卡片上方，因此外轮廓必须自带 `#111412` 粗墨黑底托。

### A2. 纯图形徽章底图（`game_logo_emblem.png`）—— AI 生图提示词

> 用途：供设计师作为 `game_logo.webp` 左侧主图形徽章，或直接用于加载页水印、印章装饰。**要求无任何文字**。

- **尺寸建议**：`1024 × 1024 px`（居中留白 15%，背景纯平 `#0A1A14` 或纯白方便抠图）
- **English AI Prompt**：
```text
Flat vector sports emblem icon, no text, no letters, bold graphic novel style, a sharp diagonal modern football crest shield fused with a stylized classic soccer ball and a dynamic upward sweeping speed ribbon arrow, dramatic red (#E03A2E) and championship gold (#D8A842) and cream white (#F4EFE4) palette, thick clean black (#111412) ink outlines, crisp 2-tone cel shading, halftone dot accent inside the ribbon, centered isolated icon on solid flat #0A1A14 background, flat 2D badge design, print poster aesthetic --ar 1:1
```

### A3. 应用与商店图标（`app_icon.png`）—— AI 生图提示词

- **文件名**：`apps/steam/assets/art/app_icon.png`
- **尺寸要求**：`1024 × 1024 px`（实心满铺圆角友好构图，关键视觉集中在中心 `72%` 安全圈内，以适配 iOS/Steam/微信桌面圆角裁切）。
- **创意构图**：深墨绿草坪底纹 + 斜向切割的红金碰撞视觉；主体是一颗正在高速冲刺撕裂画面的红白黑经典菱格足球与半身红衣7号背影剪影（或队长袖标特写），带强烈印刷感速度线与金色微光。**绝不出现模糊小字**。
- **English AI Prompt**：
```text
Mobile and Steam game app icon design, 1:1 square full bleed, no text, no letters, bold graphic novel sports poster style, dramatic close-up of a dynamic red-and-cream soccer ball bursting upward diagonally through a sharp geometric shield frame, subtle silhouette of a football coach tactical clipboard arrow behind, rich stadium floodlight beam in warm gold (#D8A842) and lime (#C8F230) accent, deep pitch green (#0A1A14) background with halftone comic dot texture, thick crisp black (#111412) ink linework, strong contrast readable at tiny 64x64 size, flat 2D cel-shaded illustration --ar 1:1
```

---

## 三、模块 B（P0）：按比赛阶段演进的 8 张标题页主视觉底图

### 设计思路与游戏阶段映射

依据 `packages/core/src/LeagueScheduler.ts` 中定义的 **7 个联赛层级（Tier 7 → Tier 1）** 以及最终夺冠阶段，策划一套 **共 8 张** 可随玩家生涯最高解锁联赛阶段自动切换/手动预览的标题页底图：
- **叙事主线**：同一位主角/教练（穿红黑球衣/红夹克的背影或侧影意象）从泥泞草根小场一步步走向万人空巷的超级联赛巅峰与捧杯王朝。
- **色彩演进**：从第1张的**冷灰微雨黄昏与朴素铁丝网** → 中期的**城市夜景探照灯与火热德比看台** → 终局的**金色纸屑漫天与冠军奖杯剪影**。

### 8 张底图总览表

| 编号 | 建议文件名 | 对应 `LeagueScheduler.ts` 阶段 | 环境时间与氛围 | 视觉核心意象（右侧 55%） |
| :--- | :--- | :--- | :--- | :--- |
| 01 | `bg_title_01_amateur.webp` | **第7级 · 社区业余联赛** (`业余`) | 清晨薄雾/微阴 | 铁丝网外斑驳水泥看台、手刷白粉边线、孤零零的旧球门与挂着红球衣的背包 |
| 02 | `bg_title_02_district.webp` | **第6级 · 地区联赛** (`地区`) | 黄金傍晚（夕阳） | 小镇木质/铁皮小看台、四根老式卤素灯柱刚点亮、几名居民站在场边围观 |
| 03 | `bg_title_03_tier5.webp` | **第5级 · 丙级联赛** (`丙级`) | 深秋雨夜 | 雨幕中被灯光照亮的绿色草皮水花、塑料遮雨棚教练席、战术板轮廓 |
| 04 | `bg_title_04_tier4.webp` | **第4级 · 乙级联赛** (`乙级`) | 比赛日黄昏入夜 | 砖石结构老牌社区球场、双层看台人声初起、红色围巾与横幅随风扬起 |
| 05 | `bg_title_05_tier3.webp` | **第3级 · 甲级联赛** (`甲级`) | 沸腾夜场 | 现代封闭式看台、强烈黑白交错光柱、漫天彩烟（红与暖白）、球员入场通道剪影 |
| 06 | `bg_title_06_championship.webp` | **第2级 · 冠军联赛** (`冠军`) | 决战暴雨/高压夜 | 巨大悬挑顶棚球场、对峙感极强的光柱交锋、狂热看台人海与荧光绿战术激光意象 |
| 07 | `bg_title_07_super.webp` | **第1级 · 超级联赛** (`超级`) | 欧洲超级碗级星空夜 | 宏伟双层环形超级大球场、整片星空下闪耀的巨型白色穹顶、红衣教练站在场边指挥线前 |
| 08 | `bg_title_08_dynasty.webp` | **巅峰王朝 · 超级联赛捧杯** (`Dynasty`) | 夺冠狂欢金夜 | 漫天金箔纸屑与聚光灯柱、高举银金冠军奖杯的剪影轮廓、沸腾看台如金色海洋 |

> **交付文件命名与尺寸规范**：原稿 `1920 × 1080 px`，上线裁剪压缩为 `1280 × 720 px .webp`（单张严格控制在 `< 160 KB`，8 张总增量控制在 `~1.1 MB` 以内，兼顾微信小游戏分包体积与桌面端清晰度）。

---

### 01. `bg_title_01_amateur.webp` — 第7级 · 社区业余联赛

- **中文创意简报**：一切梦开始的地方。清晨带着寒气的社区边缘球场，左侧是深邃墨绿暗角与铁丝网投影，右侧是破旧但干净的球网、地上摆着一颗磨损的训练足球，一只红色队长袖标或旧球衣搭在木长凳上，远方几栋居民楼剪影在晨雾中若隐若现。朴实、克制、带有“重新出发”的安静张力。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, bold crisp black (#111412) ink outlines, 2-tone cel shading with subtle halftone dot texture. ASYMMETRIC COMPOSITION: the entire left 45% of the frame is very dark quiet low-contrast deep pitch green (#0A1A14) negative space shadow for UI overlay, NO bright lights or busy details on the left. On the right 55% side: a humble community amateur football pitch at misty dawn, chain-link fence casting crisp shadows, worn white chalk touchline on deep green grass (#112920), a weathered goalpost net and a classic scuffed soccer ball beside a simple wooden bench with a red (#E03A2E) jersey draped over it, distant small apartment silhouettes in pale cream (#F4EFE4) morning mist. Melancholic yet hopeful underdog atmosphere, no text, no letters --ar 16:9
```

### 02. `bg_title_02_district.webp` — 第6级 · 地区联赛

- **中文创意简报**：第一次有镇上街坊来加油的周末傍晚。左侧大面积深墨绿晚霞暗部留白；右侧呈现小镇铁皮小看台和两座老式格栅照明铁塔刚亮起暖黄色灯晕，场地边一位穿红夹克的年轻主帅/核心球员背影站在边线旁注视球场，夕阳余晖把草皮边缘勾勒出暖金亮边。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, Franco-Belgian clean ink lines (#111412), flat cel shading and comic halftone grain. STRICT ASYMMETRIC COMPOSITION: left 45% is dark low-contrast deep forest green (#0A1A14) shadow negative space, completely uncluttered. Right 55% side: a local district town football ground at golden sunset turning to dusk, two modest steel lattice floodlight towers glowing warm amber gold (#D8A842), corrugated metal small bleachers with silhouettes of local spectators, a lone football player/coach from behind wearing a crimson red (#E03A2E) windbreaker standing near the chalk touchline looking out onto the grass pitch (#112920), warm cream (#F4EFE4) rim light, gritty grass-roots pride, no text, no letters --ar 16:9
```

### 03. `bg_title_03_tier5.webp` — 第5级 · 丙级联赛

- **中文创意简报**：真正的职业门槛——秋夜小雨中的丙级保级与冲级泥泞战。左侧 45% 被深暗夜空与教练棚阴影笼罩；右侧呈现雨丝斜落、照明灯光打在湿滑绿茵场上泛起亮白水花，弧形金属替补席顶棚下隐约可见战术板线条感光影，场地中央两道长长的球场边线斜向延伸。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, sharp black (#111412) comic ink lines, 2-tone cel shading, halftone rain texture. STRICT ASYMMETRIC COMPOSITION: left 45% is deep dark night green (#0A1A14) quiet shadow negative space with zero bright highlights. Right 55% side: a gritty lower-division Tier 5 stadium on a rainy autumn night, diagonal comic-style rain streaks lit by stark stadium floodlights, wet emerald pitch (#112920) reflecting cream (#F4EFE4) light splashes, a metallic dugout shelter silhouette on the far right with a red (#E03A2E) team crest banner and subtle lime (#C8F230) tactical line glint, dramatic rainy tension, no text, no letters --ar 16:9
```

### 04. `bg_title_04_tier4.webp` — 第4级 · 乙级联赛

- **中文创意简报**：老牌社区俱乐部的热血回归。左侧保持深绿低对比度影调；右侧展现传统英伦/欧陆红砖结构老球场看台，球迷挥舞着朱红与暖白相间的条纹围巾，场内开球前的聚光氛围，远景记分牌框只有几何色块（无可读文字），充满草根职业联赛的粗粝与生命力。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, bold #111412 ink linework, print poster aesthetic with halftone dots. STRICT ASYMMETRIC COMPOSITION: left 45% is pure dark low-contrast pitch shadow (#0A1A14) negative space for menu placement. Right 55% side: a classic brick-built Tier 4 heritage football stadium at nightfall, packed wooden-and-steel grandstand filled with stylized fan silhouettes waving red (#E03A2E) and cream (#F4EFE4) striped scarves, warm golden (#D8A842) floodlight beams cutting across the deep green pitch (#112920), heroic back-view silhouette of a footballer walking toward the center circle, classic matchday electricity, no text, no readable numbers --ar 16:9
```

### 05. `bg_title_05_tier3.webp` — 第3级 · 甲级联赛

- **中文创意简报**：进入主流视野的甲级夜战！左侧保留深暗隧道出口与球场背阴面作为极简负空间；右侧从球员通道口视角向外爆发——强烈白色与朱红色烟雾在场边升腾，现代两层看台与明亮灯排如银河横跨右侧天际，一名身披红袍的7号队员背对镜头迎向沸腾灯光。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, crisp graphic novel #111412 ink outlines, dramatic 2-tone cel shading with halftone print gradients. STRICT ASYMMETRIC COMPOSITION: left 45% is deep dark tunnel wall shadow in #0A1A14, completely clean and dark negative space. Right 55% side: looking out from the player tunnel onto a roaring modern Tier 3 stadium at night, crimson red (#E03A2E) and cream (#F4EFE4) matchday flare smoke billowing across the sideline, intense diagonal stadium floodlight beams, back silhouette of a #7 striker stepping onto the glowing emerald grass (#112920), high-stakes atmosphere, no text, no letters --ar 16:9
```

### 06. `bg_title_06_championship.webp` — 第2级 · 冠军联赛

- **中文创意简报**：冲超前的最后一道残酷关卡——次级巅峰“冠军联赛”。极强的戏剧张力与速度感：左侧依然维持深邃墨绿与硬切斜阴影留白；右侧是悬挑巨型钢架顶棚的现代化球场，冷暖两股探照灯柱斜交成“X”形光束，右侧绿茵场边红黑主帅与球员并肩凝视大战开启，零星荧光绿（`#C8F230`）光条带出精密战术对决感。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, hard-edged comic book ink (#111412), striking halftone shading. STRICT ASYMMETRIC COMPOSITION: left 45% is solid dark #0A1A14 shadow negative space for UI readability. Right 55% side: a colossal modern championship stadium with dramatic cantilevered steel roof structure at night, sharp diagonal intersecting spotlights in cream (#F4EFE4) and warm gold (#D8A842) with subtle razor-thin lime (#C8F230) tactical laser highlights, tense silhouettes of a manager in sharp coat and red-shirted captain side by side on the touchline facing a roaring tiered crowd, intense promotion playoff tension, no text, no letters --ar 16:9
```

### 07. `bg_title_07_super.webp` — 第1级 · 超级联赛

- **中文创意简报**：最高殿堂的欧洲之夜！顶级舞台的压迫感与神圣感。左侧是深不见底的夜空与底层看台暗部阴影；右侧是一座宏伟的流线型白色穹顶超级大球场全景切角，灯光如白昼般在顶部环形灯带汇聚，场上开球圈光柱直冲云霄，一名身穿红色西装/夹克的功勋教头站在场边指挥线前，气场全开。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, museum-grade sports poster ink linework (#111412), crisp cel shading and subtle paper grain texture. STRICT ASYMMETRIC COMPOSITION: left 45% is dark midnight green-black (#0A1A14) low-contrast negative space. Right 55% side: a grand iconic Super League mega-stadium under a deep starry night sky, sweeping curved cream-white (#F4EFE4) roof ring blazing with monumental golden (#D8A842) floodlights, massive vertical light columns illuminating the immaculate deep green pitch (#112920), triumphant silhouette of a head coach in a crimson (#E03A2E) accented coat standing tall at the technical area edge, epic prestige, no text, no letters --ar 16:9
```

### 08. `bg_title_08_dynasty.webp` — 巅峰王朝 · 超级联赛捧杯

- **中文创意简报**：夺得超级联赛冠军、开启俱乐部王朝的永恒定格！虽然狂欢绚丽，但**依然严格守住左侧 45% 暗影负空间**（例如左半屏设为球场顶棚阴影与深夜暗背景，使 UI 文字和卡片依旧 100% 清晰可读）；右侧 55% 是整场最高潮：金色烟花光束与漫天飞舞的红金纸屑雨中，一座造型雄伟的冠军大耳朵金杯（或高举金杯的核心剪影群像）矗立在领奖台光柱中心，整个球场化作荣耀的暖金与深绿交响。
- **English AI Prompt**：
```text
Wide 16:9 graphic novel sports illustration, PITCH PRINT style, bold #111412 ink outlines, celebratory sports magazine cover art with comic halftone dots. STRICT ASYMMETRIC COMPOSITION: left 45% MUST remain dark deep green-black (#0A1A14) quiet shadow negative space under roof shadow with minimal confetti so UI text stays legible. Right 55% side: peak championship coronation night inside a monumental football arena, dramatic golden (#D8A842) spotlight beam showering down over a victorious football squad silhouette raising a grand gold championship trophy high on a podium, swirling crimson red (#E03A2E) and metallic gold confetti ribbons and celebratory spark streaks in the dark sky, pure glory, no text, no letters --ar 16:9
```

---

## 四、模块 C（P1）：卡包与奖杯资源重制（淘汰旧科幻/奇幻风）

当前 `apps/steam/assets/art/` 中以下 5 个道具偏离体育主题（旧版带有科幻/魔幻 RPG 质感），需用 PITCH PRINT 平面印刷插画风格全部替换，文件名与路径保持不变以实现零代码无缝替换。

### 1. 球员招募包（`pack_recruit.webp`）

- **替换路径**：`apps/steam/assets/art/pack_recruit.webp`（`512 × 512 px` 透明底或深底居中）
- **核心创意**：不再是科幻盲盒，而是一包**印着足球俱乐部红白条纹与经典手写体纹章的硬质牛皮纸/锡箔球星卡包**（类似 Panini / Topps 经典集换卡包），顶部呈锯齿状撕口，隐约透出一抹朱红与暖白高光。
- **English AI Prompt**：
```text
Single isolated sports collectible trading card foil pack, no readable brand text, PITCH PRINT graphic novel style, crisp black (#111412) ink outlines, 2-tone cel shading with halftone dots. Vertical rectangular sealed foil-and-kraft football player card booster pack in stadium crimson red (#E03A2E) and warm cream (#F4EFE4) diagonal racing stripes, bold white soccer ball crest silhouette printed on front, serrated tear-notch top edge with a subtle golden (#D8A842) shine, angled slightly 10 degrees dynamically, isolated centered on solid flat #0A1A14 background, flat 2D print illustration --ar 1:1
```

### 2. 战术指令包（`pack_tactics.webp`）

- **替换路径**：`apps/steam/assets/art/pack_tactics.webp`（`512 × 512 px`）
- **核心创意**：**牛皮纸加红绳封口的机密战术档案袋（Coach Tactical Dossier Pack）**，上面盖着荧光黄绿（`#C8F230`）与墨黑印泥的球场阵型图章，侧面露出半截战术板网格线。
- **English AI Prompt**：
```text
Single isolated tactical football dossier envelope pack, no text, no letters, PITCH PRINT graphic novel style, thick clean black (#111412) ink outlines, 2-tone cel shading with comic halftone texture. Heavy warm cream-manila (#F4EFE4) coach tactical folder secured with a crimson red (#E03A2E) string-tie button, bold lime green (#C8F230) and dark green (#112920) football pitch tactical X-and-O arrows diagram stamped across the cover, slightly tilted dynamic angle, isolated centered on solid flat #0A1A14 background, flat 2D editorial illustration --ar 1:1
```

### 3. 天赋特质包（`pack_perk.webp`）

- **替换路径**：`apps/steam/assets/art/pack_perk.webp`（`512 × 512 px`）
- **核心创意**：**黑金烫金质感的高级球员天赋卡封套**——深墨黑卡套表面压印着冠军金（`#D8A842`）五角星与飞翼足球压纹，封口处带有红色火漆印章质感（平面化表现，非 3D）。
- **English AI Prompt**：
```text
Single isolated prestige black-and-gold football talent card sleeve pack, no text, no letters, PITCH PRINT graphic novel style, bold #111412 ink outlines, flat cel shading with halftone highlights. Matte charcoal-black (#111412) luxury collectible sleeve featuring metallic championship gold (#D8A842) geometric winged-star and football emblem foil embossing, sealed with a stylized flat crimson (#E03A2E) wax-seal badge accent, slightly tilted dynamic presentation, isolated centered on solid flat #0A1A14 background, flat 2D comic poster art --ar 1:1
```

### 4. 超级联赛大冠军奖杯（`trophy_grand_cup.webp`）

- **替换路径**：`apps/steam/assets/art/trophy_grand_cup.webp`（`512 × 512 px`）
- **核心创意**：**具有欧冠“大耳朵杯”与大力神杯融合气质的现代平面硬朗金属奖杯**——线条犀利硬朗（不是奇幻游戏里的圣杯），双侧对称流线手柄，底座绑着红金双色冠军缎带，高光用锐利纯白切片表现金属光泽。
- **English AI Prompt**：
```text
Single isolated grand football championship trophy cup, no text, no letters, PITCH PRINT graphic novel style, bold clean #111412 ink outlines, crisp 2-tone metallic cel shading with comic halftone shine. Iconic wide-handled modern silver-and-gold (#D8A842 & #F4EFE4) football league cup with dramatic flowing side handles, dark emerald-black tiered plinth wrapped in a crimson red (#E03A2E) victory ribbon, sharp geometric specular light slices, centered isolated on solid flat #0A1A14 background, flat 2D sports poster illustration --ar 1:1
```

### 5. 次级联赛奖盘 / 奖杯（`trophy_tier2_4.webp`）

- **替换路径**：`apps/steam/assets/art/trophy_tier2_4.webp`（`512 × 512 px`）
- **核心创意**：**与顶级大杯形成明显等级差异的“银质冠军盾盘 / 优雅细身银杯”**（类似德甲沙拉盘或英冠传统银质奖杯），以冷暖银灰与暖白高光为主、仅底座点缀一丝红/绿丝带，体现进阶荣誉的克制美感。
- **English AI Prompt**：
```text
Single isolated silver football league trophy shield and slender cup hybrid, no text, no letters, PITCH PRINT graphic novel style, bold #111412 ink outlines, 2-tone metallic silver cel shading with halftone dots. Classic European division champion trophy: a polished silver-cream (#F4EFE4) octagonal laurel-wreath salver plate and sleek column base accented with subtle antique gold (#D8A842) rim trim and a small forest green (#112920) ribbon, centered isolated on solid flat #0A1A14 background, flat 2D graphic illustration --ar 1:1
```

---

## 五、模块 D（P2）：12 枚成就徽章统一模板（`apps/steam/assets/art/ach/*.webp`）

当前已有 `ach_blank.webp` 及 12 枚成就图标，建议用同一套“硬核印刷搪瓷徽章”母版批量重绘，确保全部 12 枚圆章或盾章在图鉴墙里呈现高度统一的收藏品级质感。

### 通用英文模板（复制后替换 `[SUBJECT_HERE]` 与 `[ACCENT_COLOR]`）

- **输出规格**：`256 × 256 px`（原画 `512 × 512 px`），`.webp` 格式，单枚 `< 15 KB`。
- **Template Prompt**：
```text
Single circular sports enamel pin badge icon, no text, no letters, PITCH PRINT graphic novel style, thick clean black (#111412) outer border and ink outlines, flat 2-tone cel shading with subtle halftone dot shadow, warm cream (#F4EFE4) inner rim ring on deep pitch green (#0A1A14) badge background, featuring [SUBJECT_HERE] highlighted in [ACCENT_COLOR], crisp minimalist vector-comic silhouette readability, centered isolated on solid flat #0A1A14 background --ar 1:1
```

### 12 枚成就徽章替换参数表（对应 `AssetLoader.ts` 精确 ID）

| Asset ID (`AssetLoader.ts`) | 文件名 (`assets/art/ach/`) | 成就含义 | `[SUBJECT_HERE]` 英文替换词 | `[ACCENT_COLOR]` 主点缀色 |
| :--- | :--- | :--- | :--- | :--- |
| `ach_first_draft` | `ach_first_draft.webp` | 初次选秀建队 | `a hand holding three fanned football player cards with a star seal` | `crimson red (#E03A2E)` |
| `ach_first_win` | `ach_first_win.webp` | 生涯首胜 | `a classic soccer ball crossing a chalk goal line into the net` | `lime green (#C8F230)` |
| `ach_playoffs` | `ach_playoffs.webp` | 杀入季后赛 | `steep upward stadium steps leading to a bright spotlight gate` | `warm gold (#D8A842)` |
| `ach_champion` | `ach_champion.webp` | 联赛夺冠 | `a single sleek championship cup wrapped in laurel branches` | `championship gold (#D8A842)` |
| `ach_dynasty` | `ach_dynasty.webp` | 王朝连冠 | `three overlapping golden crowns floating above a grand football crest` | `championship gold (#D8A842) and crimson red (#E03A2E)` |
| `ach_hattrick` | `ach_hattrick.webp` | 帽子戏法 | `three blazing soccer balls streaking together inside a gentleman top hat outline` | `crimson red (#E03A2E)` |
| `ach_clean_sheet` | `ach_clean_sheet.webp` | 零封对手 | `goalkeeper gloved hands catching a soccer ball in front of an iron shield` | `lime green (#C8F230) and cream (#F4EFE4)` |
| `ach_craft_card` | `ach_craft_card.webp` | 首次战术合成 | `two overlapping tactical cards fusing into a glowing spark anvil icon` | `warm gold (#D8A842)` |
| `ach_recipe_5` | `ach_recipe_5.webp` | 掌握5种战术配方 | `an open coach tactical playbook with five connected star nodes` | `lime green (#C8F230)` |
| `ach_hidden_trait` | `ach_hidden_trait.webp` | 觉醒隐藏特质 | `a lightning-bolt cracked jersey emblem revealing a bright hidden diamond core` | `crimson red (#E03A2E) and gold (#D8A842)` |
| `ach_synergy` | `ach_synergy.webp` | 激活强力羁绊 | `three interlocking geometric chain links forming a triangle around a soccer ball` | `lime green (#C8F230)` |
| `ach_meta_lv3` | `ach_meta_lv3.webp` | 俱乐部基建满级 | `a grand modern stadium facade with three ascending golden chevron stripes` | `championship gold (#D8A842)` |

---

## 六、保留不变的现有资源 & 美术交付验收清单

### 1. 确认保留、无需重绘的现有资源（29 个）

经核对 `packages/game-ui/src/AssetLoader.ts` 与现有资源库，以下资源画风与叙事契合度良好，**本次无需重制**（保留在 `apps/steam/assets/art/` 原位置）：
- **角色立绘（3 个）**：`portrait_linfeng.webp`、`portrait_xiaoyu.webp`、`portrait_mentor.webp`
- **开场序章插画（5 个）**：`prologue_01_tunnel.webp`、`prologue_02_last_kick.webp`、`prologue_03_farewell_phone.webp`、`prologue_04_hometown_club.webp`、`prologue_05_retired_ending.webp`
- **主线剧情事件图（8 个）**：`story_underdog.webp`、`story_revenge.webp`、`story_veteran.webp`、`story_wonderkid.webp`、`story_relegation.webp`、`story_academy.webp`、`story_poach.webp`、`story_tactician.webp`
- **战术指令卡插画（12 个）**：`cmd_tiki_taka.webp`、`cmd_gegenpress.webp`、`cmd_iron_wall.webp`、`cmd_blitz.webp`、`cmd_super_sub.webp`、`cmd_wing_play.webp`、`cmd_set_piece.webp`、`cmd_offside_trap.webp`、`cmd_gk_launch.webp`、`cmd_long_shot.webp`、`cmd_blood_frenzy.webp`、`cmd_captain_roar.webp`
- **空白勋章占位底图（1 个）**：`ach/ach_blank.webp`

### 2. 美术交付路径、尺寸与验收标准（Checklist）

设计师出图完毕后，请直接替换或新增至 `apps/steam/assets/art/`（打包脚本会自动同步，注意微信端分包体积限制）：

- [ ] **Logo & App 图标（P0）**
  - `apps/steam/assets/art/game_logo.webp`：`1024 × 512 px`，透明底，无锯齿白边，`< 90 KB`
  - `apps/steam/assets/art/app_icon.png`：`1024 × 1024 px`，实底无透明孔洞，关键视觉在中心 72% 安全圆内
- [ ] **8 张阶段标题底图（P0）**
  - 文件名：`bg_title_01_amateur.webp` ~ `bg_title_08_dynasty.webp`（同时将默认兜底 `bg_title.webp` 指向 `01` 或当前默认图）
  - 尺寸与体积：`1280 × 720 px .webp`，每张严格 `< 160 KB`
  - **人工质检红线**：将图放进左侧 45% 叠白字与深绿框测试——左侧绝对不可有亮灯刺眼或影响文字辨识度的复杂线稿；画面内**不能出现任何拼错的英文字母或乱码汉字**
- [ ] **5 个卡包与奖杯（P1）**
  - `pack_recruit.webp`、`pack_tactics.webp`、`pack_perk.webp`、`trophy_grand_cup.webp`、`trophy_tier2_4.webp`
  - 尺寸：`512 × 512 px .webp`（若为透明底请确保边缘无 `#0A1A14` 杂色残留；若使用纯色框卡片可与开发约定抠透）
- [ ] **12 枚成就徽章（P2）**
  - `apps/steam/assets/art/ach/ach_*.webp` 共 12 张，每张 `256 × 256 px .webp`，`< 15 KB`
- [ ] **程序对接提示**：8 张标题底图出图并放入目录后，后续仅需在 `AssetLoader.ts` 注册 `bg_title_01` ~ `bg_title_08` 并在 `TitleScreen.ts` 增加“按生涯最高联赛解锁 + 手动左右切换海报预览”逻辑即可完成闭环。
