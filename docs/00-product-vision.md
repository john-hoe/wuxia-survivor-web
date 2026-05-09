# 00 Product Vision

## 一句话概念

一个可在浏览器中直接打开的轻量武侠 survivor-like 小游戏：用户只控制少侠移动，在不断增强的江湖怪潮中自动释放招式、拾取内力光点、领悟构筑，最终击败首关头目或撑到战后清点。

## 为什么做

目标是给个人和朋友玩，不追求商业发行。

因此第一性原则不是“最大化付费转化”，而是：

- 快速开始。
- 短时间爽。
- 局内成长明显。
- 失败也想再开一局。
- 操作简单，但招式构筑选择有变化。
- 局外抽取和解锁可以有期待感，但不能有付费压力。

## 目标体验

用户第一次打开网页后，理想体验是：

1. 5 秒内开始移动。
2. 20 秒内第一次领悟。
3. 60 秒内感到招式变强。
4. 3 分钟内遇到明显压力变化。
5. 6 到 8 分钟内完成一局。
6. 战后清点后想尝试另一种招式组合。

## 不做什么

- 不做商业化系统。
- 不做复杂剧情。
- 不做大型开放世界。
- 不做多人同步。
- 不做账号体系。
- 不做长线体力和每日任务压力。
- 不做付费抽卡、付费复活或付费加速。
- MVP 不做多关卡，先只做 `青石山道` 1 个关卡。

## 设计目标量化

| 指标 | MVP 目标 |
| --- | --- |
| 首次可操作时间 | <= 5 秒 |
| 第一次领悟时间 | 15 到 25 秒 |
| 前 3 分钟领悟间隔 | 20 到 35 秒 |
| 单局时长 | 6 到 8 分钟 |
| 桌面 FPS | 稳定 60 FPS |
| 移动端 FPS | 45 到 60 FPS |
| 同屏江湖敌人 | MVP 80 到 180 |
| 击杀反馈延迟 | <= 0.2 秒 |
| 死亡后重开时间 | <= 8 秒 |
| 失败局铜钱收益 | 至少能看到进度，3 到 5 局内可做 1 次铜钱抽秘籍 |
| 付费入口 | 0 |

## 实现级边界

产品目标保持简洁，具体实现以 14 到 25 号规格为准：

| 主题 | 规格 |
| --- | --- |
| 内力和领悟 | [14 Inner Power And Insight System](14-inner-power-and-insight-system.md) |
| 少侠移动和受伤 | [15 Hero Movement And Damage System](15-hero-movement-and-damage-system.md) |
| 招式和进阶 | [16 Skill And Advancement System](16-skill-and-advancement-system.md) |
| 敌人和怪潮 | [17 Enemy Wave And Director System](17-enemy-wave-and-director-system.md) |
| 青石山道 | [18 Stage Qingshi Mountain Road System](18-stage-qingshi-mountain-road-system.md) |
| 黑风寨主 | [19 Boss Heifeng Chief System](19-boss-heifeng-chief-system.md) |
| 铜钱、局外成长、翻阅秘籍 | [20 Copper Meta Scripture System](20-copper-meta-scripture-system.md) |
| HUD、暂停、页面流 | [21 HUD Pause Screen Flow Detail](21-hud-pause-screen-flow-detail.md) |
| 美术、动画、VFX 资产 | [22 Art Animation VFX Asset List](22-art-animation-vfx-asset-list.md) |
| 音频事件 | [23 Audio Event Table](23-audio-event-table.md) |
| 技术工程骨架 | [24 Technical Project Skeleton](24-technical-project-skeleton.md) |
| 验收和证据 | [25 Acceptance Scripts And Evidence](25-acceptance-scripts-and-evidence.md) |

## 最终成功标准

这些指标放在游戏开发基本完成后的最终朋友试玩阶段判断，不作为早期功能开发门槛。

- 3 分钟内能理解核心操作。
- 第一次游玩不需要讲解也能领悟。
- 至少 70% 的试玩者愿意立刻再开一局。
- 至少 60% 的试玩者能说出自己这局的招式构筑差异。
- 没有人因为商城、广告、体力或付费提示被打断，因为这些东西不存在。
- 如果加入铜钱抽秘籍，100% 的试玩者应能理解铜钱只能靠游玩获得，不能充值购买。

开发阶段先用开发者自测、自动构建、类型检查、浏览器 sanity 和性能观察确保版本不崩、不黑屏、核心循环能跑。朋友试玩留到最后，避免反馈被半成品问题污染。
