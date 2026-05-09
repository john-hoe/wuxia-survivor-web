# 04 Technical Plan

## 推荐技术栈

| 层 | 选择 |
| --- | --- |
| 游戏框架 | Phaser 3 |
| 语言 | TypeScript |
| 构建 | Vite |
| 包管理 | npm |
| 存档 | browser `localStorage` |
| 渲染 | Phaser AUTO，优先 WebGL，回退 Canvas |
| 部署 | 静态网站即可 |

## 为什么不用复杂引擎

这个项目的第一版是 Web 原生 2D 武侠 survivor-like。核心风险是同屏单位、自动招式、触控和构筑节奏，不是 3D、物理或大型资源管线。

Phaser + TypeScript 的优势：

- 浏览器原生。
- 调试快。
- 静态部署简单。
- 触控和键盘都好接。
- 适合 Canvas/WebGL 2D。
- 代码组织比纯 JS 更可维护。

## 目录建议

实现级工程骨架见 [24 Technical Project Skeleton](24-technical-project-skeleton.md)。本节保留技术方向总览。

```text
survivor-web/
  README.md
  current-status.md
  next-step.md
  docs/
  game/
    package.json
    index.html
    src/
      main.ts
      scenes/
        BootScene.ts
        MenuScene.ts
        GameScene.ts
        InsightScene.ts
        DeathTransitionScene.ts
        PauseScene.ts
        SettingsScene.ts
        ResultScene.ts
        ScriptureScene.ts
      systems/
        EnemyDirector.ts
        SkillSystem.ts
        InsightSystem.ts
        DropSystem.ts
        VfxSystem.ts
        AnimationSystem.ts
        AudioSystem.ts
        PauseSystem.ts
        SaveSystem.ts
      entities/
        Hero.ts
        Enemy.ts
        Projectile.ts
        InnerPowerGem.ts
      data/
        skills.ts
        enemies.ts
        insights.ts
        waves.ts
        vfx.ts
        artManifest.ts
      assets/
        sprites/
        vfx/
        ui/
        audio/
      ui/
        Hud.ts
        VirtualJoystick.ts
        PauseMenu.ts
        SettingsPanel.ts
        ResultPanel.ts
      utils/
        ObjectPool.ts
        math.ts
```

## 性能策略

MVP 先做这些：

- 江湖敌人、剑气/暗器、内力光点使用对象池。
- 频繁出现的 VFX 使用对象池，不在战斗中反复创建销毁。
- 伤害数字限制数量，必要时关闭。
- 粒子数量有上限，低画质模式可降低粒子密度和伤害数字。
- 江湖敌人寻路只做简单追踪，不做复杂路径规划。
- 碰撞使用圆形距离或 Phaser arcade physics，避免复杂多边形。
- 同屏江湖敌人预算先限制在 180。
- 每 10 秒记录一次 FPS 和实体数量。

## 调试面板

调试面板详细字段见 [24 Technical Project Skeleton](24-technical-project-skeleton.md)。

第一版建议按 `~` 或右上角按钮打开调试面板：

| 信息 | 用途 |
| --- | --- |
| FPS | 检查性能 |
| enemies alive | 同屏江湖敌人 |
| projectiles alive | 剑气/暗器数量 |
| inner power gems alive | 内力光点数量 |
| level / inner power | 领悟节奏 |
| wave time | 怪潮节奏 |
| skill levels | 招式构筑检查 |
| active vfx | 特效数量 |
| active particles | 粒子数量 |
| audio voices | 同时播放音效数量 |
| muted / volume | 声音设置 |

## 美术和特效加载

MVP 推荐先用小体量 sprite sheet 和程序化特效混合：

- 少侠、江湖敌人、头目、掉落物优先 sprite sheet。
- 命中、击杀、内力吸附、领悟、进阶可以先用程序化粒子和简单贴图。
- 所有资产登记在 `src/data/artManifest.ts`，避免散落硬编码路径。
- 加载失败时显示明确 fallback 图形，并在调试面板记录缺失资产 id。

资产预算以 [10 Art Animation VFX](10-art-animation-vfx.md) 为准。

## 声音、HUD 和页面

声音、HUD、暂停和页面规格以 [11 Audio HUD Pause](11-audio-hud-pause.md) 为准。

技术要求：

- `AudioSystem` 统一处理音效播放、音乐循环、音量、静音和同类音效节流。
- HUD 使用独立 UI 层，战斗对象不能直接写 HUD 文本。
- 暂停使用 Phaser scene pause/resume 或统一暂停状态，暂停时江湖敌人、招式、掉落、计时器和头目行为都必须停止。
- 设置页写入 `localStorage`，刷新后保留音量、静音和低 VFX 模式。

## 输入方案

PC：

- WASD。
- 方向键。
- 鼠标点击领悟选项。

移动端：

- 左下虚拟摇杆。
- 领悟时点击卡片。
- 右上暂停按钮。

## 验证命令目标

命令和完成验收以 [25 Acceptance Scripts And Evidence](25-acceptance-scripts-and-evidence.md) 为准。

后续创建工程后，至少提供：

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
```

如果暂时不接 lint，也要保留 `typecheck`。

## 浏览器目标

MVP 优先：

- Chrome 桌面。
- Safari 桌面。
- Chrome Android。
- iOS Safari 可后测，但不作为第一天阻塞项。

## 部署目标

MVP 用静态部署即可：

- 本地 `npm run dev`。
- 后续可放 GitHub Pages、Cloudflare Pages 或任意静态服务器。

不需要后端。
