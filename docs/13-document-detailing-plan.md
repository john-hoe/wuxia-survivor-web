# 13 Document Detailing Plan

> Archived planning document. Its “next step” section predates the implemented
> Phaser project and is retained only as decision history. See
> [CURRENT-STATUS.md](CURRENT-STATUS.md) for current facts.

## 目的

现有文档已经证明方向可行，但很多内容仍是方向描述。接下来要把文档逐步改成“能直接指导实现”的规格。

本文定义细化顺序、完成标准和每份文档应该补到什么粒度。

## 细化完成标准

一份设计文档只有同时满足以下条件，才算“实现级”：

- 有明确目标和非目标。
- 有核心规则，不依赖口头解释。
- 有关键数值或默认参数。
- 有数据结构或配置字段建议。
- 有 UI/反馈规则，玩家可见文案明确。
- 有验收标准和验证方法。
- 有与其他文档的边界，不重复制造冲突。

不能只写“手感要好”“反馈要强”“敌人要多”这种不可执行描述。

## 细化优先级

先细化最容易阻塞工程实现的 P0 系统：

| 顺序 | 规格 | 产出 | 原因 |
| ---: | --- | --- | --- |
| 1 | 内力与领悟系统 | `14-inner-power-and-insight-system.md` | 决定成长节奏和三选一规则 |
| 2 | 少侠移动与受伤系统 | `15-hero-movement-and-damage-system.md` | 决定控制手感和生存规则 |
| 3 | 招式与进阶系统 | `16-skill-and-advancement-system.md` | 决定自动招式、构筑和爽感 |
| 4 | 江湖敌人与怪潮系统 | `17-enemy-wave-and-director-system.md` | 决定压力曲线和性能预算 |
| 5 | 青石山道首关规格 | `18-stage-qingshi-mountain-road-system.md` | 决定 MVP 唯一关卡实现内容 |
| 6 | 黑风寨主头目规格 | `19-boss-heifeng-chief-system.md` | 决定胜利闭环和危险预兆 |
| 7 | 铜钱、局外成长、翻阅秘籍 | `20-copper-meta-scripture-system.md` | 决定结算和非氪金长期目标 |
| 8 | HUD、暂停、页面流细化 | `21-hud-pause-screen-flow-detail.md` | 决定移动端可用性 |
| 9 | 美术、动画、VFX 资产表 | `22-art-animation-vfx-asset-list.md` | 决定资源制作和导入清单 |
| 10 | 音频事件表 | `23-audio-event-table.md` | 决定音效制作和节流策略 |
| 11 | 技术工程骨架 | `24-technical-project-skeleton.md` | 决定文件结构和代码边界 |
| 12 | 验收脚本和证据清单 | `25-acceptance-scripts-and-evidence.md` | 决定什么叫真的完成 |

## 现有文档细化目标

| 文档 | 当前作用 | 需要补到的粒度 |
| --- | --- | --- |
| `00-product-vision.md` | 产品方向和量化目标 | 保持简洁，只保留成功标准和非目标 |
| `01-mvp-scope.md` | MVP 边界 | 补 P0/P1/P2 优先级、每项链接到具体系统规格 |
| `02-core-loop-and-feel.md` | 单局手感节奏 | 补 0 到 8 分钟调参表、失败原因、调整手段 |
| `03-systems-design.md` | 系统总览 | 每个系统补状态机、输入输出、事件名、配置字段 |
| `04-technical-plan.md` | 技术方向 | 补 Phaser scene 架构、文件命名、构建命令和调试面板字段 |
| `05-development-workflow.md` | 工作流程 | 补每轮开发提交前检查表和证据格式 |
| `06-roadmap.md` | 阶段计划 | 每个 phase 补任务拆分、依赖和完成定义 |
| `07-no-monetization-policy.md` | 非氪金边界 | 补允许/禁止的边界案例和数值上限 |
| `08-acceptance-checklist.md` | 总体验收 | 拆成可执行手动脚本、自动检查、性能检查 |
| `09-decision-log.md` | 决策历史 | 只记录关键决策，不塞实现细节 |
| `10-art-animation-vfx.md` | 视觉规格 | 补资产清单、尺寸、帧数、命名、fallback |
| `11-audio-hud-pause.md` | 声音/HUD/页面 | 补布局、状态、按钮、音效事件和 pause state |
| `12-wuxia-style-and-level.md` | 武侠语义和首关方向 | 补世界文案表、敌人命名、关卡物件清单 |

## 细化节奏

每次细化控制在一个主题内，不一次性改所有文件。

每个主题完成时必须：

- 新增或更新对应规格文档。
- 在总览文档中补链接。
- 更新 `09-decision-log.md` 记录关键决策。
- 更新 `current-status.md` 和 `next-step.md`。
- 运行 `git diff --check`。

## 当前批次

已完成的实现级规格：

- `14-inner-power-and-insight-system.md`
- `15-hero-movement-and-damage-system.md`
- `16-skill-and-advancement-system.md`
- `17-enemy-wave-and-director-system.md`
- `18-stage-qingshi-mountain-road-system.md`
- `19-boss-heifeng-chief-system.md`
- `20-copper-meta-scripture-system.md`
- `21-hud-pause-screen-flow-detail.md`
- `22-art-animation-vfx-asset-list.md`
- `23-audio-event-table.md`
- `24-technical-project-skeleton.md`
- `25-acceptance-scripts-and-evidence.md`

本轮追加细化：

- `21-hud-pause-screen-flow-detail.md`：补主菜单、阵亡过渡、战后清点布局和翻阅秘籍 UI。
- `23-audio-event-table.md`：补音频制作管线、生成式音频/API key 边界和音频 manifest 要求。
- `25-acceptance-scripts-and-evidence.md`：补页面流截图脚本和音频制作验收脚本。

下一步：

- 等用户统一核对 18 到 25 号规格及本轮 UI/音频补充。
- 用户确认后再创建 Phaser + TypeScript + Vite 工程骨架。
