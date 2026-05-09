# 24 Technical Project Skeleton

## 目的

本文细化 [04 Technical Plan](04-technical-plan.md)，定义 Phaser + TypeScript + Vite 工程骨架、目录边界、场景拆分、命令和调试字段。

第一性原则：

- MVP 要快启动、好调试、少依赖。
- 系统边界清楚，数值进 `data/`，规则进 `systems/`，显示进 `ui/` 和 `scenes/`。
- 不引入后端、账号、商业 SDK 或复杂资源管线。

## 技术栈

| 层 | 选择 |
| --- | --- |
| 游戏框架 | Phaser 3 |
| 语言 | TypeScript |
| 构建 | Vite |
| 包管理 | npm |
| 存档 | `localStorage` |
| 渲染 | Phaser AUTO |

## 目录结构

```text
survivor-web/game/
  package.json
  index.html
  tsconfig.json
  vite.config.ts
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
      BossSystem.ts
      HudSystem.ts
      VfxSystem.ts
      AudioSystem.ts
      PauseSystem.ts
      SaveSystem.ts
      StageSystem.ts
    entities/
      Hero.ts
      Enemy.ts
      Boss.ts
      Projectile.ts
      InnerPowerGem.ts
      Drop.ts
    data/
      stage.ts
      enemies.ts
      waves.ts
      boss.ts
      skills.ts
      insights.ts
      meta.ts
      scripture.ts
      audio.ts
      artManifest.ts
    ui/
      Hud.ts
      VirtualJoystick.ts
      PauseMenu.ts
      DeathOverlay.ts
      ResultPanel.ts
      ScripturePanel.ts
      SettingsPanel.ts
    utils/
      EventBus.ts
      ObjectPool.ts
      SpatialGrid.ts
      math.ts
      storage.ts
      debug.ts
    assets/
      sprites/
      vfx/
      ui/
      audio/
```

## npm scripts

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "preview": "vite preview --host 0.0.0.0"
  }
}
```

如果第一天还未接 ESLint，`lint` 可以暂时后置，但 `typecheck` 必须保留。

## Scene 职责

| Scene | 职责 |
| --- | --- |
| BootScene | 加载配置、资产 manifest、默认存档 |
| MenuScene | 主菜单、开始青石山道、设置入口 |
| GameScene | 主战斗循环和系统更新 |
| InsightScene | 领悟三选一 UI，暂停规则层 |
| DeathTransitionScene | 阵亡过渡、死因提示、跳过到战后清点 |
| PauseScene | 暂停页、设置入口、重开 |
| SettingsScene | 音量、静音、低 VFX |
| ResultScene | 战后清点、铜钱结算、重开 |
| ScriptureScene | 翻阅秘籍和结果揭示 |

## 系统更新顺序

每帧建议：

```text
Input
PauseSystem
StageSystem
EnemyDirector
Hero
SkillSystem
Projectile
Enemy/Boss
DropSystem
InsightSystem
VfxSystem
HudSystem
AudioSystem
Debug
```

如果 `PauseSystem` 处于暂停、领悟、结算状态，战斗系统不更新，只允许 UI 更新。

## 事件总线

使用轻量 `EventBus`，避免系统互相直接调用。

核心事件来自 14-23 号文档：

- `enemy_killed`
- `inner_power_collected`
- `insight_started`
- `skill_cast`
- `boss_spawn_requested`
- `boss_defeated`
- `death_transition_started`
- `run_result_calculated`
- `screen_changed`

## 对象池

必须使用对象池：

- 普通敌人。
- 精英敌人。
- 投射物。
- 内力光点。
- 高频 VFX。

对象池字段：

```ts
type PoolStats = {
  id: string;
  active: number;
  inactive: number;
  createdTotal: number;
  maxActive: number;
};
```

## 坐标和回收

- 世界坐标使用 `number`。
- 背景跟随摄像机循环。
- 远离少侠的敌人、掉落、投射物回收。
- 任一轴绝对值 >20000px 时执行 origin rebase。
- rebase 后所有实体相对少侠位置误差 <=2px。

## 调试面板

按 `~` 或右上调试按钮打开。

必须显示：

```text
fps
scene
screenState
heroHp
heroLevel
innerPower
enemiesAlive
enemiesAliveByType
projectilesAlive
gemsAlive
activeVfx
audioVoices
waveTimeSeconds
directorState
bossState
stageId
loadedChunkCount
qualityScale
missingRequiredAssets
saveStatus
```

## 配置原则

- 数值放 `src/data/`。
- 系统不硬编码显示文案。
- 玩家可见文案集中管理。
- 资产路径只从 `artManifest.ts` 和 `audio.ts` 读取。
- 存档 schema 必须带版本。

## 验收

- `npm run dev` 能启动。
- `npm run build` 通过。
- `npm run typecheck` 通过。
- 打开网页 5 秒内进入主菜单或战斗。
- 刷新后不丢设置和铜钱。
- 调试面板能显示核心字段。
- 控制台没有持续错误。
- 没有后端、账号、商城、广告或付费 SDK。
