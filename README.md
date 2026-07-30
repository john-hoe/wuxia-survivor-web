# Wuxia Survivor Web

## 项目定位

这是一个 Phaser 3 + TypeScript + Vite 实现的 Web 武侠 survivor-like 游戏。

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

## 当前可玩内容

- 1 个可移动少侠，键盘与触控摇杆输入。
- 5 种自动招式与对应升级/进阶。
- 多类普通江湖敌人、精英敌人。
- 3 张地图：青石山道、枫叶官道、夜雨破庙。
- 每张地图对应头目与音乐。
- 内力光点/秘籍残页、领悟、三选一。
- 铜钱结算、铜钱抽秘籍和本地存档。

## 本地运行

要求 Node.js 20.19 或更高版本；推荐使用仓库 `.nvmrc` 指定的 Node 22。

```bash
cd game
npm ci
npm run dev
```

开发服务器只监听 `127.0.0.1`。终端会显示本机访问地址。

也可以留在仓库根目录运行 `npm run dev`；根目录脚本会转发到 `game/`。

## 质量检查与构建

```bash
npm run check
```

该命令依次执行 ESLint、TypeScript 类型检查、Vitest 契约测试和生产构建。
单独命令为 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
构建输出位于 `game/dist/`，Vite `base` 已设置为相对路径，可部署在项目子路径。

Sites 生产部署使用 `npm run build:sites`，它会在通过游戏生产构建后生成
Cloudflare Workers 兼容的 `dist/server` 和静态 `dist/client` 输出。

生产构建启动后，可另外运行浏览器走查：

```bash
npm run test:browser
npm run test:dpr
```

两项检查使用受信任的本机 Chrome 和 localhost HTTP，不开启
`--allow-file-access-from-files` 或 unsafe SwiftShader 参数。

资产门禁位于 `tools/asset-pipeline/`。其依赖、完整图片清单校验、真实对边接缝校验
和 BGM PCM 首尾门禁的运行方式见
[`tools/asset-pipeline/README.md`](tools/asset-pipeline/README.md)。

## 浏览器与存档

- 推荐当前稳定版 Chrome、Edge、Firefox 或 Safari。
- 存档使用浏览器 `localStorage`，不上传服务器。
- 浏览器禁用本地存储时仍可游玩，但页面会提示当前会话改动无法持久化。
- 移动端请使用横屏；竖屏时战斗会暂停。

## 授权边界

本仓库当前没有授予开源许可。公开可见不等于允许复制或再分发，详见
[`LICENSE-STATUS.md`](LICENSE-STATUS.md)。音频与生成资产来源仍应以资产来源清单为准。

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
