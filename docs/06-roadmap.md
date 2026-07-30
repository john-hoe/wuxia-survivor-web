# 06 Roadmap

> Historical MVP roadmap. Several later content items now exist in runtime, but
> this file has not been retroactively treated as acceptance evidence. Current
> status is maintained in [CURRENT-STATUS.md](CURRENT-STATUS.md).

## Phase 0：文档和工程骨架

工程骨架实现级规格见 [24 Technical Project Skeleton](24-technical-project-skeleton.md)。

目标：

- 建立文档。
- 创建 Phaser + TypeScript + Vite 工程。
- 跑通空场景。
- 跑通基础 HUD 层、暂停页和音频设置占位。
- 跑通主菜单、阵亡过渡、战后清点和翻阅秘籍页面占位。

验收：

- `npm run dev` 可启动。
- 浏览器能看到菜单或空游戏场景。
- 能打开暂停页并返回。
- 能切换静音设置。
- 主菜单 5 秒内能进入青石山道。
- `npm run build` 通过。

## Phase 1：最小战斗闭环

少侠移动、受伤、无敌帧和死亡规则见 [15 Hero Movement And Damage System](15-hero-movement-and-damage-system.md)。
自动招式、冷却、瞄准和进阶规则见 [16 Skill And Advancement System](16-skill-and-advancement-system.md)。
江湖敌人、刷怪位置和基础压力曲线见 [17 Enemy Wave And Director System](17-enemy-wave-and-director-system.md)。

目标：

- P0 少侠、江湖敌人、招式、掉落物和基础 VFX 资产。
- P0 HUD、暂停页和基础音效。
- 少侠移动。
- 江湖敌人追踪。
- 一个自动招式。
- 击杀江湖敌人。

验收：

- 3 分钟内可持续游玩。
- 少侠只移动也能击杀敌人。
- 江湖敌人能伤害少侠。
- 死亡后能重开。
- 死亡后先出现 `力竭倒地`，再进入战后清点。
- 命中、击杀、受伤和内力掉落有可读视觉反馈。
- 命中、击杀、拾取、受伤有基础音效或静音设置。
- HUD 不遮挡核心战斗区域。

## Phase 2：内力和领悟

实现级规格见 [14 Inner Power And Insight System](14-inner-power-and-insight-system.md)。

目标：

- 内力光点。
- 等级。
- 三选一领悟。
- 3 个 P0 招式和若干强化。
- 领悟、进阶和内力吸附特效。
- 领悟选择页和领悟音效。

验收：

- 第一次领悟在 15 到 25 秒。
- 每次领悟至少 3 个可选项。
- 选择领悟后战斗表现明显变化。
- 用户能从动画或特效看出领悟和招式变化。
- 领悟页能用键鼠/触控选择，并能返回战斗。

## Phase 3：青石山道怪潮和首关头目

怪潮实现级规格见 [17 Enemy Wave And Director System](17-enemy-wave-and-director-system.md)。
青石山道关卡规格见 [18 Stage Qingshi Mountain Road System](18-stage-qingshi-mountain-road-system.md)。
黑风寨主规格见 [19 Boss Heifeng Chief System](19-boss-heifeng-chief-system.md)。

目标：

- 波次节奏。
- 3 类普通江湖敌人。
- 1 类精英怪。
- 1 个首关头目：`黑风寨主`。
- 头目预兆动画和技能范围特效。
- 头目预警声音和头目血条。

验收：

- 6 分钟后头目出现。
- 180 到 210 秒内首次出现精英预警和木人机关。
- 连续 3 分钟测试中，没有敌人生成在少侠 220px 内。
- 头目至少 2 种可读攻击。
- 击败头目可胜利结算。
- 头目攻击前至少 0.5 秒有视觉预兆。
- 头目出现时 HUD 显示头目血条，且预警声音不刺耳。

## Phase 4：局外成长和存档

铜钱、局外成长、翻阅秘籍和存档见 [20 Copper Meta Scripture System](20-copper-meta-scripture-system.md)。

目标：

- 铜钱结算。
- 3 个永久成长项。
- 1 个铜钱抽秘籍池。
- `localStorage` 存档。
- 结算页、翻阅秘籍结果页和设置持久化。

验收：

- 刷新页面后保留铜钱、永久成长和最好成绩。
- 翻阅秘籍只消耗铜钱，概率公开，重复奖励有补偿，铜钱不足状态清楚。
- 永久成长不会破坏前 3 分钟难度。
- 结算页能重开、回菜单、进入翻阅秘籍；设置刷新后保留。
- 没有任何付费入口。

## Phase 5：手感和完成前自测

资产清单、音频事件、页面细化和验收证据分别见 [22 Art Animation VFX Asset List](22-art-animation-vfx-asset-list.md)、[23 Audio Event Table](23-audio-event-table.md)、[21 HUD Pause Screen Flow Detail](21-hud-pause-screen-flow-detail.md)、[25 Acceptance Scripts And Evidence](25-acceptance-scripts-and-evidence.md)。

目标：

- 美术、动画、VFX、声音、HUD、主菜单、暂停页、阵亡过渡、战后清点、翻阅秘籍、内力吸附、受伤反馈的完整打磨。
- 使用占位或生成式音频完成必需事件，并确认音频 manifest 不含 API key。
- 移动端虚拟摇杆。
- 开发者自测和浏览器 sanity。

验收：

- 桌面和移动端都能完成至少 1 局或 8 分钟无崩溃运行。
- P0/P1 为 0。
- 移动端可稳定游玩。

## Post-MVP 路线

执行细则见 [34 Post-MVP Route](34-post-mvp-route.md)。

用户已确认朋友试玩收集真实反馈放到最后。MVP 通过后先按以下顺序推进：

```text
MVP 冻结
-> 数值平衡
-> 正式音频
-> 移动端适配
-> 青石山道小扩展
-> 第二关
-> 最终朋友试玩
```

原因：

- 当前 MVP 已可玩，下一步先固化可回退基线。
- 数值平衡必须发生在正式加内容前，否则第二关会继承未校准的节奏问题。
- 正式音频和移动端适配属于高频体验面，应在扩大关卡前完成。
- 第二关之前先做青石山道小扩展，用较小成本验证扩展方式。

## Phase 6：最终朋友试玩

目标：

- 在 post-MVP 路线完成后，再让朋友试玩。
- 记录首次领悟时间、单局时长、死因理解、是否愿意再来一局、铜钱抽秘籍理解和最大问题。

验收：

- 至少 5 次朋友试玩记录。
- 70% 愿意再开一局。
- 70% 能理解死因。
- 60% 能说出本局构筑差异。
- 100% 知道铜钱抽秘籍只消耗游玩铜钱，不能充值购买。

## 后续扩展池

只在 Phase 6 最终朋友试玩后考虑更大范围扩展：

- 更多招式。
- 更多头目。
- 第三关及更多关卡目标点。
- 每日种子。
- 本地排行榜。
- 可选难度。
- 角色皮肤，可以通过铜钱抽秘籍、成就或挑战解锁，不收费。
