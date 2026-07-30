# 35 MVP Freeze Baseline

> 历史记录，非当前验收事实源。文中引用的 `SW-QA-001` 原始证据、manifest
> 和本地快照未进入公开仓库，因此相关通过结论当前不可独立复核。现行状态与
> 可复验命令以 `docs/CURRENT-STATUS.md` 和根目录 `README.md` 为准。

## 目的

本文记录 `survivor-web` MVP 通过后的冻结基线。它不是新玩法规格，而是后续数值平衡、正式音频、移动端适配和第二关开发的回退点。

冻结基线对应任务：`SW-POST-001`。

## 冻结结论

当前 MVP 可以作为 post-MVP 的基线继续开发。

冻结依据：

- 用户已试玩并确认 MVP 体验成功。
- `SW-QA-001` 已完成完整工程验收。
- `npm run typecheck` 和 `npm run build` 在本轮冻结中重新通过。
- 源码、文档、运行时资产已有 SHA256 manifest 和本地源码快照。
- 朋友试玩仍后置到第二关之后的最终验证阶段。

## 冻结范围

| 范围 | 状态 | 说明 |
| --- | --- | --- |
| 首关 | frozen baseline | `青石山道` 作为当前唯一完整关卡 |
| 核心战斗 | frozen baseline | 少侠移动、怪潮、接触伤害、自动招式、Boss 闭环 |
| 成长 | frozen baseline | 内力、领悟、三招式、进阶、局外成长 |
| 经济 | frozen baseline | 铜钱只来自游玩和重复补偿返还，不存在付费入口 |
| 页面流 | frozen baseline | 主菜单、战斗、暂停、设置、领悟、阵亡、战后清点、翻阅秘籍 |
| 美术/VFX | frozen baseline | P0/P1/P2 已导入资产作为当前版本视觉基线 |
| 音频 | frozen baseline | WebAudio 本地占位音效作为 P0 音频基线 |
| 移动端 | frozen baseline | 横屏可玩，完整移动端沉浸适配后置到 `SW-MOBILE-001` |
| 朋友试玩 | not started | 真实反馈收集放到 `SW-QA-002` |

## 可复查证据

| 证据 | 路径 |
| --- | --- |
| MVP QA 报告 | `evidence/2026-05-09-sw-qa-001/report.md` |
| MVP QA metrics | `evidence/2026-05-09-sw-qa-001/metrics.json` |
| 冻结报告 | `evidence/2026-05-09-sw-post-001/report.md` |
| 冻结 manifest | `evidence/2026-05-09-sw-post-001/baseline-manifest.json` |
| 源码哈希清单 | `evidence/2026-05-09-sw-post-001/source-hashes.json` |
| 本地源码快照 | `evidence/2026-05-09-sw-post-001/survivor-web-mvp-freeze-source.tar.gz` |
| 构建日志 | `evidence/2026-05-09-sw-post-001/logs/build.log` |
| 类型检查日志 | `evidence/2026-05-09-sw-post-001/logs/typecheck.log` |

## 基线指标

来自 `SW-QA-001`：

| 指标 | 基线 |
| --- | ---: |
| 第一次领悟 | 18 秒 |
| Boss 请求发出 | 360 秒 |
| Boss 首次出现 | 360 秒 |
| 真实长跑时长 | 365 秒 |
| 平均 FPS | 76.5 |
| 最低采样 FPS | 64 |
| 压力场最高敌人数 | 232 |
| 压力场平均 FPS | 63.2 |
| console/page errors | 0 |
| missing required assets | 0 |
| missing required audio events | 0 |
| paid entry count | 0 |
| API key leak count | 0 |

## 复跑命令

在 `survivor-web/game/` 下执行：

```bash
npm run typecheck
npm run build
```

完整 QA 可用既有脚本复跑，需要本地 dev server：

```bash
npm run dev -- --host 127.0.0.1
node ../evidence/2026-05-09-sw-qa-001/run-sw-qa-001.cjs
```

说明：

- 完整 QA 会跑到 360 秒 Boss 触发，耗时较长。
- `SW-POST-001` 本轮不重复完整长跑，只引用 `SW-QA-001` 已通过证据，并重新执行 typecheck/build 与冻结 manifest。

## 调试入口边界

以下入口只用于开发和 QA，不作为玩家正式功能：

| 入口 | 位置 | 作用 | 边界 |
| --- | --- | --- | --- |
| `window.__WUXIA_SURVIVOR_DEBUG__` | `debugHooks.ts` | 自动验收读取状态和事件 | 不保存玩家进度，不作为玩法 API |
| 反引号 | `GameScene` DEV only | 切换 DebugPanel | 生产构建不可作为玩家入口 |
| `F3` | `GameScene` DEV only | P0 美术/VFX 展示 | 只用于截图验收 |
| `F4` | `GameScene` DEV only | 敌人展示 | 只用于截图验收 |
| `F5/F6` | `GameScene` DEV only | 领悟展示/触发 | 只用于 QA |
| `F7/F8` | `GameScene` DEV only | 阵亡/结果页调试 | 只用于页面流测试 |
| `F9/F10` | `GameScene` DEV only | 伤害/回血调试 | 只用于 HUD 和伤害验证 |
| `F11/F12` | `GameScene` DEV only | Boss 入场/伤害调试 | 只用于 Boss 验收 |
| `F6/F7/F8/F9` | `ScriptureScene` DEV only | 翻阅秘籍结果和 layout tuner | 只用于 UI 调整和截图验收 |

后续正式构建前需要再次确认：开发调试入口不被包装成玩家可见功能，不影响无付费、无商城边界。

## 后续任务禁止改动范围

`SW-BAL-001` 数值平衡阶段禁止：

- 新增第二关。
- 新增付费、商城、广告、体力、每日任务压力。
- 改动翻阅秘籍概率为不透明。
- 删除现有 QA 脚本或覆盖 `SW-QA-001` 证据。
- 大规模重构页面流或资产 manifest。

允许：

- 调整敌人血量、速度、生成权重、波次压力。
- 调整内力掉落、等级需求、领悟权重。
- 调整招式伤害、冷却、数量、范围和击退。
- 调整铜钱结算系数，但不能引入外部付费来源。

## 回退方式

当前主 repo 未把 `survivor-web/` 纳入已跟踪文件，因此本轮不擅自创建 commit 或 tag。

如需回退到本基线：

1. 使用 `source-hashes.json` 确认文件差异。
2. 使用 `survivor-web-mvp-freeze-source.tar.gz` 恢复冻结时的源码、文档和运行时资产。
3. 重新执行 `npm install`、`npm run typecheck`、`npm run build`。
4. 必要时复跑 `SW-QA-001` 完整脚本。

如果后续需要更强的回退能力，应由用户明确授权后创建 git commit 或 tag。
