# Wuxia Survivor Web Prototype

## 项目定位

这是一个独立于 `vega 的世界` 的 Web 武侠 survivor-like 小游戏原型。

目标不是复制《Survivor.io》的 IP、美术、角色、技能名、关卡或数值，而是学习它的底层玩法结构，并用原创武侠江湖风格表达：

- 少侠只控制移动。
- 招式自动释放。
- 山贼、黑衣人、机关傀儡等怪潮持续压迫。
- 内力光点/秘籍残页驱动局内领悟。
- 领悟三选一形成招式构筑。
- 一局结束后有轻量局外成长和铜钱奖励。

## 硬边界

- 不做商城。
- 不做充值。
- 可以做铜钱抽秘籍，但铜钱只能来自游玩。
- 不做体力系统。
- 不做广告激励。
- 不做付费加速。
- 不做任何隐性收费设计。

这个项目只服务个人和朋友游玩，所以所有成长、解锁和奖励都必须来自游玩本身。

## MVP 目标

先做一个 6 到 8 分钟可玩的网页版本：

- 1 个可移动少侠。
- 3 种 P0 自动招式。
- 3 类普通江湖敌人 + 1 类精英敌人。
- 1 个首关头目。
- 内力光点/秘籍残页、领悟、三选一。
- 3 个招式进阶组合。
- 1 个 MVP 关卡：`青石山道`。
- 铜钱结算、铜钱抽秘籍和本地存档。

## 文档入口

建议按顺序阅读：

1. `docs/00-product-vision.md`
2. `docs/01-mvp-scope.md`
3. `docs/02-core-loop-and-feel.md`
4. `docs/03-systems-design.md`
5. `docs/04-technical-plan.md`
6. `docs/05-development-workflow.md`
7. `docs/06-roadmap.md`
8. `docs/07-no-monetization-policy.md`
9. `docs/08-acceptance-checklist.md`
10. `docs/09-decision-log.md`
11. `docs/10-art-animation-vfx.md`
12. `docs/11-audio-hud-pause.md`
13. `docs/12-wuxia-style-and-level.md`
14. `docs/13-document-detailing-plan.md`
15. `docs/14-inner-power-and-insight-system.md`
16. `docs/15-hero-movement-and-damage-system.md`
17. `docs/16-skill-and-advancement-system.md`
18. `docs/17-enemy-wave-and-director-system.md`
19. `docs/18-stage-qingshi-mountain-road-system.md`
20. `docs/19-boss-heifeng-chief-system.md`
21. `docs/20-copper-meta-scripture-system.md`
22. `docs/21-hud-pause-screen-flow-detail.md`
23. `docs/22-art-animation-vfx-asset-list.md`
24. `docs/23-audio-event-table.md`
25. `docs/24-technical-project-skeleton.md`
26. `docs/25-acceptance-scripts-and-evidence.md`
27. `docs/26-task-tracker-dashboard.md`
28. `docs/27-art-agent-production-plan.md`
29. `docs/28-p0-fallback-ui-background-spec.md`
30. `docs/34-post-mvp-route.md`
31. `docs/35-mvp-freeze-baseline.md`

## 推荐技术方向

第一版推荐：

- Phaser 3
- TypeScript
- Vite
- Canvas/WebGL 自动渲染
- `localStorage` 本地存档

原因：这是 Web 原生 2D 游戏，启动快、部署简单、移动端触控适配直接，适合快速验证满屏江湖敌人和自动招式的爽感。
