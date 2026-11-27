# Canvas UI 自动化测试流程

> 适用范围：`packages/game-ui` 下的所有页面与弹窗。
> 一句话原则：**UI 全画在 canvas 上，没有 DOM 定位器，所以一切交互都走页面内测试桥 `__FM_TEST__` + 1280×720 设计坐标。**

## 1. 分层结构

```
scripts/lib/ui_harness.mjs        ← 测试底座：起服务、起浏览器、交互原语、阶段断言
scripts/capture_ui_all.mjs        ← 场景脚本：只描述业务流程，14 个阶段 16 条断言
scripts/cli_ui_e2e.mjs            ← 断点 E2E：只验关键路径能不能通，跑得快
scripts/cli_device.mjs            ← 真机通道：验触摸热区手感（模拟通道验不了这个）
scripts/device_new_player_flow.mjs ← 真机新玩家流程，带拟人点击抖动
```

**为什么要分三层**：模拟通道（Playwright）跑得快、可进 CI，但测不出「手指点偏」；真机通道慢、要插线、还可能被锁屏挡住，但能测真实触摸。两个都保留，各管一段。

底座 `ui_harness.mjs` 对外只暴露原语，不含任何业务路径。场景脚本改动不会影响其他测试。

## 2. 跑起来

```bash
npm run cli:ui                 # 全量回归 + 截图 → shots/ui-all/
npm run cli:ui -- --no-shots   # 只跑断言（约快 20%，CI 用）
npm run cli:ui -- --list       # 列出 14 个阶段
npm run cli:ui -- --verbose    # 打印每次点击是否命中

npm run test:ui                # build:web + 全量回归（确保测的是当前源码产物）
npm run test:ui:fast           # build:web + 只断言
npm run verify                 # typecheck + cli:e2e + test:ui:fast（发版前门禁）

npm run cli:device -- --script ./scripts/device_new_player_flow.mjs --human --jitter 10  # 真机
```

退出码：任一阶段失败 → `1`。`shots/ui-all/manifest.json` 记录每张截图的 route / 打开的弹窗 / 说明，以及全部断言结果。

## 3. 测试桥 `__FM_TEST__`

只在 `?e2e=1` 或 `localStorage.fm_e2e=1` 时挂载（`apps/steam/src/main.ts`），线上玩家不可见。

| 接口 | 用途 |
|---|---|
| `tap(x, y)` | **设计坐标**点击，走真实 `GameApp.onPointerDown/Up` 事件链 |
| `key(code, key)` | 键盘事件（如 `Escape` 关弹窗） |
| `getRoute()` | 当前路由字符串 |
| `getState()` | 联赛存档**活引用**（可直接改写字段做状态注入，见「赛季收官」阶段） |
| `getHits()` | 当前帧所有可点热区矩形 —— Canvas 唯一的元素枚举手段 |
| `getModals()` | 当前打开的弹窗名列表，用于断言开关 |
| `getMatchDebug()` | 比赛内部状态：阶段、比分、教程等待项、手牌坐标 |
| `getTutorial()` | 新手引导进度 |
| `screenshot()` | canvas `toDataURL`，拿到的是 1280×720 设计空间位图 |

## 4. 三条必须记住的坐标规则

**① 设计坐标 ≠ 屏幕像素。**
`tap()` 吃 1280×720 设计坐标。真机 1600×900 时屏幕 = 设计 × 1.25，用屏幕坐标点会 100% 落空（曾经因此误判「按钮热区全部失效」）。

**② 优先用几何规则，别抄源码坐标。**
排版一改源码坐标就废。底座提供了三条稳定规则：

- `tapCta()` — 底部主按钮永远是**最右下**那颗 140~560 宽、34+ 高的区域
- `tapWhere(pred)` — 按几何特征找中部功能按钮（如宽 280~380、y 290~390 的「补齐青训」）
- `tapUntilRoute(cands, expect)` — 多个入口/宽度漂移时逐个试到路由对为止

实测踩过的坑：`drawBroadcastHeader` 的 `rightAction` 右边界正好是 `x=900`，用 `x>900` 过滤会把「进入比赛日」整块漏掉，结果点到旁边的音量键。

**③ 异步弹窗会吞点击。**
剧情弹窗（StoryModal）是全屏拦截层，且**在上一步动作完成后才异步弹出**。任何「点了没反应」先调 `ensureNoModal()`，别急着怀疑按钮。

## 5. 时序陷阱（改版最容易踩）

| 场景 | 现象 | 正确处理 |
|---|---|---|
| 启动开场动画 | 截图抓到「正在点亮球场灯光」而非标题页 | BootIntro 有 1.25s + 0.55s 强制时长，等 700ms 后 tap 一次跳过，再等 1s |
| 核心开包撕包 | 点了没反应 | 撕包后有约 2s 爆炸动画，等 2.8s |
| 核心开包选牌 | 点牌不选中 | 翻面进度 <80% 时 DraftScreen **根本不注册热区**，「一键推荐选满」也无效；等动画完再按 `getHits()` 取真实卡片矩形逐张点 |
| 判定开包成功 | 误判「点牌无效」 | `corePackDraft.pickedCores` **只在「签入」后填充**，选牌阶段不能用它判断 |
| 赛后肉鸽 | 卡在 `post_match` 出不来 | 必须先点一张盲盒卡，再点结算面板中部的「继续下一轮」(636,408)；那颗按钮不在底部，`tapCta` 抓不到 |
| 序章强制教程 | 时钟冻在 47'/80'/89' 不动 | 不是慢放，是教程门禁。按 `getMatchDebug().tutorial` 分别处理：出指定牌 / 换人面板四步 / 放绝杀技 |

## 6. 序章比赛四个卡点（唯一需要硬编码坐标的地方）

```js
SUB_BTN      = { x: 1147, y: 112 }  // 右侧「换人/战术」
SUB_ON_PITCH = { x: 613,  y: 285 }  // 场上 ST #19 陈小宇
SUB_BENCH    = { x: 978,  y: 224 }  // 替补席 #10 梅利纳（老队长）
SUB_SAVE     = { x: 1147, y: 51  }  // 保存并返回比赛
SKILL_NOW    = { x: 817,  y: 499 }  // 「立即释放 (F)」
```

换人是四步流程，少一步比赛就永久停表。改 MatchDayScreen 布局后必须同步这五个点，`npm run cli:ui` 会在「序章比赛」阶段立刻报错。

## 7. 新增一个阶段的写法

```js
await stage('我的新页面', 'my_page', async () => {
  await ensureNoModal();                    // 1. 先清障
  await tap(48, 332, 800);                  // 2. 导航
  await waitRoute('roster');                // 3. 等状态，别用固定 sleep
  await shot('25_my_page', '我的新页面');    // 4. 截图（名字带序号，便于排序）
  const hs = await hits();                  // 5. 用热区枚举代替猜坐标
  const btn = hs.find(r => r.w > 200 && r.y > 400);
  if (!btn) throw new Error('目标按钮不存在');// 6. 失败就抛错，stage 会自动截现场图
  await tap(Math.round(btn.x + btn.w / 2), Math.round(btn.y + btn.h / 2), 700);
  return `route=${await route()}`;          // 7. 返回值会成为 PASS 的 detail
});
```

约定：

- `stage` 内部**不要 `try/catch`**，抛错由底座统一处理（记 FAIL + `fail_<slug>.png`）
- 阶段之间允许级联失败，后面的阶段会继续跑，最后一次性看到全部问题
- 断言要落在**状态**上（route / phase / 数量），不要只看「点击没报错」

## 8. CI

`.github/workflows/ui-regression.yml`：push / PR / 手动触发。

```
npm ci → 临时装 playwright（不进 devDependencies）→ install chromium
      → typecheck → build:web → cli:e2e → cli:ui（截图）
      → 上传 shots/ui-all 为 artifact（保留 14 天）
```

失败时额外上传 `fail_*.png`，直接能看到失败现场。

## 9. 已知限制

- **测不出触摸手感**：模拟通道的 tap 是精确坐标，44px 热区是否好按只能靠真机（`cli:device --human --jitter 10`）。
- **赛季收官用状态注入**：打满 18 轮无头要一小时，所以把 `state.currentRound` 推到末轮后正常踢完一场，让结算逻辑照常跑——只改轮次，不改结算。
- **随机性**：开包候选、剧情事件、比赛比分每局不同。断言只落在结构与数量上（选满 3 人、阶段推进），不断言具体球员或比分。
- **真机锁屏无法自动解锁**：`secure=true` 时 `adb` 的 `dismiss-keyguard` / 手势全部无效，真机流程需人工解锁后跑。
