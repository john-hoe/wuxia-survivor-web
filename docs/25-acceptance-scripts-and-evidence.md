# 25 Acceptance Scripts And Evidence

## 目的

本文细化 [08 Acceptance Checklist](08-acceptance-checklist.md)，定义什么叫 MVP 真的完成，以及每轮开发需要留下什么证据。

第一性原则：

- 没有验收脚本和证据，就不能算完成。
- 朋友试玩放在最后，不用于早期功能完成判定。
- 主观体验必须尽量转成可观察指标：时间、帧率、数量、距离、事件。

## 验收层级

| 层级 | 用途 | 通过条件 |
| --- | --- | --- |
| 自动检查 | 防止构建和类型错误 | build/typecheck 通过 |
| 开发者脚本 | 验证核心循环 | 手动步骤可复现 |
| 性能观察 | 验证同屏压力 | 达到 FPS 和预算 |
| 多模型 review | 独立发现缺陷和风险 | Codex/DeepSeek/Kimi findings 已验证、修复或拒绝；`claude-ds` 暂时跳过 |
| 证据包 | 留下可复查材料 | 截图、日志、metrics |
| 最终朋友试玩 | 完成后体验验证 | 至少 5 次记录 |

## 任务完成验收流程

每个 dashboard 任务从 `in_review` 到 `done` 必须按这个顺序：

```text
做完 -> 检查 -> 多模型 review -> 验证 -> 修复 -> 再验收 -> 更新 dashboard
```

通过条件：

- 原任务验收标准全部通过。
- `npm run typecheck`、`npm run build` 或该任务对应的替代检查通过。
- 当前有效 review 的 findings 已逐条验证。
- 真实问题已修复；误报或证据不足的问题已记录为 rejected/unverified。
- 修复后重新跑相关检查。
- 有证据路径、命令输出摘要、截图、日志或 metrics。
- [26 Task Tracker Dashboard](26-task-tracker-dashboard.md) 对应任务状态和验收结果已更新。

不能通过的情况：

- 只完成代码或文档，但没有验收证据。
- 只跑自动测试，没有从用户视角检查画面、流程或体验。
- 原问题仍然存在，却把它降级为后续。
- review findings 未验证就直接标记完成。

## Review 证据格式

每轮 review 建议在证据目录记录：

```text
review/
  context.md
  codex-review.md
  deepseek-review.md
  kimi-review.md
  triage.md
  fix-summary.md
```

`claude-review.md` 当前不是必需文件。只有用户重新启用 `claude-ds` 或某轮任务明确要求时才需要生成。

`triage.md` 至少包含：

| 字段 | 说明 |
| --- | --- |
| finding_id | 稳定编号 |
| reviewer | Codex / DeepSeek / Kimi；`claude-ds` 仅在用户重新启用后使用 |
| priority | P0 / P1 / P2 / P3 |
| scope | in-scope / impact-related / unrelated / needs-more-evidence |
| decision | fixed / rejected / deferred-with-user-approval |
| evidence | 文件行号、截图路径、日志数值或复现步骤 |

默认不允许 `deferred`。只有用户明确同意，或该问题不属于当前任务且不影响验收，才可以写 `deferred-with-user-approval`。

## 自动检查

后续工程创建后，每轮至少跑：

```bash
npm run typecheck
npm run build
```

如果接入 lint：

```bash
npm run lint
```

通过线：

- 命令退出码为 0。
- 控制台没有持续报错。
- build 产物能被 preview 打开。

## 开发者手动脚本

### 3 分钟战斗脚本

1. 打开网页。
2. 确认主菜单显示 `开始闯荡`、`翻阅秘籍`、`设置`，且无商城、充值、广告、体力入口。
3. 点击 `开始闯荡` 进入 `青石山道`。
4. 确认 5 秒内可移动。
5. 移动 30 秒，确认斜向不更快。
6. 确认第一批山贼从屏幕外进入。
7. 击杀至少 10 个敌人。
8. 第一次领悟在 15 到 25 秒内发生。
9. 领悟时战斗暂停。
10. 游玩到 60 秒，确认恶犬出现。
11. 游玩到 150 秒，确认持盾山贼出现。
12. 打开暂停 10 秒，确认战斗停止。
13. 继续到 180 秒，确认战斗仍稳定运行；如果少侠死亡，则确认先出现 `力竭倒地` 阵亡过渡，再进入战后清点。

### 8 分钟闭环脚本

1. 完成 3 分钟脚本。
2. 游玩到 210 秒，确认木人机关预警和生成。
3. 游玩到 360 秒，确认 `黑风寨主` 入场。
4. 观察 `冲撞斩` 和 `旋风刀` 预兆。
5. 击败头目或死亡。
6. 进入 `战后清点`。
7. 获得铜钱。
8. 重开一局。
9. 铜钱足够时翻阅秘籍一次。
10. 确认翻阅秘籍页面概率默认可见、铜钱不足时按钮置灰、结果卡和重复补偿可读。
11. 刷新页面，确认铜钱、设置、记录保留。

### 页面流截图脚本

每次 UI 改动至少保存这些截图：

| 截图 | 场景 | 必须能看见 |
| --- | --- | --- |
| `01-menu.png` | 主菜单 | `开始闯荡`、`翻阅秘籍`、`设置`、当前铜钱或最好成绩 |
| `02-first-combat.png` | 开局战斗 | 少侠、HUD、暂停按钮、内力条 |
| `03-insight.png` | 领悟 | 3 张领悟卡、战斗暂停 |
| `04-pause.png` | 暂停 | `继续`、`重新开始`、`回主菜单`、`设置` |
| `05-death-transition.png` | 阵亡过渡 | `力竭倒地`、死因提示、降饱和画面 |
| `06-result.png` | 战后清点 | 胜败、时间、击杀、等级、铜钱、3 个按钮 |
| `07-scripture.png` | 翻阅秘籍 | 当前铜钱、概率表、翻阅按钮 |
| `08-scripture-result.png` | 翻阅结果 | 结果卡、稀有度、重复补偿 |

通过线：

- 移动端截图中按钮文字不溢出。
- 主菜单到战斗、战斗到阵亡、阵亡到战后清点、战后清点到翻阅秘籍都能连通。
- 玩家可见 UI 不出现 `抽卡`、`Gacha`、`金币`、`充值`、`广告`。

### 音频制作验收脚本

1. 打开设置，确认主音量、音乐音量、音效音量、静音可操作。
2. 分别触发 `ui_click`、`hit_light`、`enemy_die`、`inner_power_pickup`、`hero_hurt`、`hero_die`、`insight`、`boss_warning`、`result_open`。
3. 高频命中 5 秒内连续触发，确认不会爆音。
4. 连续拾取 10 个内力光点，确认拾取音合并，不刺耳。
5. 静音后重复触发 3 个事件，确认没有声音。
6. 刷新页面，确认音量和静音设置保留。
7. 检查音频 manifest，确认每个必需音效有 `source`，且没有 API key 或完整鉴权信息。

## 性能脚本

目标：

| 场景 | 桌面 | 移动端 |
| --- | ---: | ---: |
| 60 敌人 | 60 FPS | 45-60 FPS |
| 120 敌人 | 接近 60 FPS | >=45 FPS |
| 头目 + 100 敌人 | 接近 60 FPS | >=45 FPS |

记录：

- 平均 FPS。
- p95 frame ms。
- enemies alive。
- projectiles alive。
- active VFX。
- audio voices。
- qualityScale。

## 证据目录

每轮建议：

```text
survivor-web/evidence/
  yyyy-mm-dd-topic/
    report.md
    metrics.json
    events.json
    screenshots/
      01-menu.png
      02-first-combat.png
      03-insight.png
      04-pause.png
      05-death-transition.png
      06-result.png
      07-scripture.png
      08-scripture-result.png
      09-elite.png
      10-boss.png
```

## metrics.json 建议

```json
{
  "buildPassed": true,
  "typecheckPassed": true,
  "runtimeSeconds": 180,
  "firstPlayableSeconds": 5,
  "firstInsightSeconds": 20,
  "maxEnemiesAlive": 120,
  "minSpawnDistanceFromHero": 220,
  "avgFps": 60,
  "p95FrameMs": 18,
  "consoleErrorCount": 0,
  "missingRequiredAssets": 0,
  "bossSpawned": true,
  "resultShown": true,
  "deathTransitionShown": true,
  "scriptureScreenShown": true,
  "audioManifestHasSources": true,
  "apiKeyLeakCount": 0,
  "paidEntryCount": 0
}
```

## P0/P1/P2/P3

| 等级 | 定义 |
| --- | --- |
| P0 | 崩溃、黑屏、无法移动、无法开始、存档破坏 |
| P1 | 核心循环断裂：打不到怪、升不了级、死因不可读、无法结算 |
| P2 | 明显影响体验：卡顿、反馈弱、HUD 遮挡、数值拖沓 |
| P3 | 打磨项：局部音效、粒子、文案、动画细节 |

MVP 进入最终朋友试玩前：

- P0 = 0。
- P1 = 0。
- 已知 P2 有记录和处理计划。

## 最终朋友试玩进入条件

只有全部满足后才进行：

- MVP 通过标准全部达成。
- `npm run build` 通过。
- `npm run typecheck` 通过。
- 桌面和移动端都能完成至少 1 局或 8 分钟无崩溃。
- 没有商城、充值、广告、体力、付费抽取入口。
- 战斗闭环、头目、结算、铜钱、翻阅秘籍、存档都可用。

## 最终朋友试玩记录字段

| 字段 | 说明 |
| --- | --- |
| player_id | 朋友编号，不记录隐私 |
| device | 设备和浏览器 |
| session_seconds | 游玩时长 |
| result | win/dead/quit |
| first_insight_seconds | 首次领悟时间 |
| max_level | 最高等级 |
| kills | 击杀数 |
| boss_seen | 是否见到头目 |
| death_understood | 是否理解死因 |
| wanted_retry | 是否想再来一局 |
| build_described | 是否能描述招式构筑 |
| monetization_pressure | 是否感到付费/广告压力 |
| biggest_issue | 最大问题 |

通过线：

- >=70% 愿意再开一局。
- >=70% 能理解死因。
- >=60% 能说出构筑差异。
- 100% 知道铜钱只能靠游玩获得，不能充值购买。
- 0 人感到付费、广告、每日压力。

## 验收

- 每个 P0 系统都有手动验证步骤。
- 每轮开发能留下 report、metrics、截图或等效证据。
- 自动检查和手动脚本分开，不用朋友试玩替代开发验收。
- 所有失败项能分级为 P0/P1/P2/P3。
- 最终朋友试玩只在完成后进行。
