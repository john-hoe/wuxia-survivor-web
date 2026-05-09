# 18 Stage Qingshi Mountain Road System

## 目的

`青石山道` 是 MVP 唯一关卡。它要承载 6 到 8 分钟完整单局：开局移动、怪潮加压、精英出现、头目入场、胜利或失败结算。

本关卡的第一性原则：

- 让玩家 3 秒内知道这是武侠山道，不是现代城市、科幻或仙侠大场面。
- 给割草战斗足够走位空间，不做玩家可见硬边界。
- 背景和物件只服务识别、氛围和节奏，不抢少侠、敌人、内力和危险预兆。
- MVP 只做一个关卡入口，不做关卡选择大地图。

## 范围

P0 必做：

- 1 个关卡入口：`青石山道`。
- 可循环背景，连续移动 3 分钟无可见硬墙、黑边、空白边缘。
- 山道、竹林、碎石、远处山寨门楼 4 类视觉元素。
- 精英预警和头目入场的场景表现。
- 与 [17 Enemy Wave And Director System](17-enemy-wave-and-director-system.md) 对齐的刷怪空间。

P1 后续：

- 轻量随机小物件组合。
- 关卡天气变化。
- 关卡挑战词缀。

非目标：

- 不做复杂地形阻挡。
- 不做真实开放世界探索。
- 不做多关卡入口。
- 不做会影响走位的狭窄墙体。
- 不做需要阅读剧情才能理解的关卡目标。

## 关卡空间模型

MVP 使用“无可见硬边界 + 循环背景 + 相对少侠刷怪”。

```text
world position can move freely
camera follows hero
background chunks loop around camera
enemies spawn outside camera
objects far away recycle
origin rebase when abs(x/y) > 20000px
```

和 [15 Hero Movement And Damage System](15-hero-movement-and-damage-system.md) 的边界规则一致：

- 不出现可见墙体。
- 敌人生成在屏幕外 120 到 260px。
- 普通敌人距离少侠 >1400px 回收。
- 掉落物距离少侠 >1600px 或存在 60 秒回收。
- 任一坐标轴绝对值超过 20000px 时做 origin rebase。

## 视觉分层

| 层 | 内容 | 交互 | 识别优先级 |
| --- | --- | --- | --- |
| 地表层 | 青石路、土路、浅草 | 无 | 低 |
| 氛围层 | 竹影、碎石、路边草 | 无 | 低 |
| 远景层 | 山寨门楼剪影、山坡雾气 | 无 | 低 |
| 玩法层 | 少侠、敌人、内力、铜钱、回血药丸 | 有 | 最高 |
| 危险层 | 头目刀痕、旋风范围、精英预警 | 有 | 最高 |
| UI 层 | HUD、暂停、领悟、结算 | 有 | 独立 |

背景层不能使用接近内力光点的高亮青蓝，也不能使用接近危险范围的高饱和红橙。

## 背景循环块

建议背景块尺寸：

| 资产 | 尺寸 | 用途 |
| --- | ---: | --- |
| `ground_qingshi_base` | 1024x1024 | 低噪声地表 |
| `road_ribbon_a` | 1024x512 | 青石路走向 |
| `road_ribbon_b` | 1024x512 | 土路变化 |
| `bamboo_edge_cluster` | 512x512 | 边缘氛围 |
| `rock_cluster` | 256x256 | 碎石点缀 |
| `distant_gate_shadow` | 1024x512 | 头目前远景提示 |

当前工程基线：

- `SW-ART-011` 已采用用户选择的 Round 003 A / Clean Stone / `003a`。
- `ground_qingshi_base`、`road_ribbon_a`、`road_ribbon_b` 为必需背景资产；缺失时不能通过最终验收。
- `bamboo_edge_cluster`、`rock_cluster`、`wood_stake_flag`、`distant_gate_shadow` 为可隐藏氛围物件；缺失时可以 fallback 隐藏，但不能影响战斗规则。
- 工程中背景以低对比方式渲染：地表约 0.72 alpha，主路约 0.46 alpha，副路约 0.18 alpha，场景物件约 0.12 到 0.28 alpha。第一性原则是背景让位给少侠、敌人、内力光点和危险预兆。

循环规则：

- 摄像机周围至少铺满 `3x3` 个 1024 块。
- 镜头移动到块边缘前，下一圈块已经存在。
- 背景块重复可以被轻微旋转/镜像打散，但不能影响碰撞，因为 P0 不做地形碰撞。
- 每个屏幕内高对比大物件不超过 5 个，避免和掉落物混淆。

## 关卡时间表现

| 时间 | 场景表现 | 玩法作用 |
| ---: | --- | --- |
| 0-30s | 清晨山道，低密度竹影 | 让玩家确认移动和第一批山贼 |
| 30-120s | 路边杂草、碎石增多 | 快怪加入，视觉仍保持低噪声 |
| 120-180s | 远处出现山寨旗影 | 暗示持盾山贼和中段压力 |
| 180-300s | 木人机关预警边缘符号 | 精英出现，给高价值目标提示 |
| 300-360s | 远处门楼和风尘更明显 | 头目前压 |
| 360s+ | 黑风寨主入场，短暂压暗背景 | 头目战开始，普通怪潮降压 |

这些变化只用于氛围和读节奏，不改变地形或玩家规则。

## 关卡物件清单

| 物件 | 数量目标 | 作用 | 是否碰撞 |
| --- | ---: | --- | --- |
| 青石路段 | 常驻 | 武侠山道识别 | 否 |
| 竹林影 | 每屏 4-8 组 | 边缘氛围 | 否 |
| 碎石堆 | 每屏 3-6 组 | 打散重复 | 否 |
| 破旗/木桩 | 每屏 1-3 个 | 山寨方向提示 | 否 |
| 山寨门楼远景 | 300 秒后可见度提高 | 头目临近提示 | 否 |
| 精英预警边缘符号 | 木人机关前 1.2 秒 | 精英生成提示 | 否 |
| 头目入场尘土 | 360 秒 | 头目入场反馈 | 否 |

MVP 不把这些物件做成障碍。若后续要加障碍，必须重新评估移动手感和怪潮公平性。

## 头目入口

第 360 秒收到 `boss_spawn_requested` 后：

1. 普通怪潮压力降到头目战配置。
2. 背景暗度降低 10% 到 18%，持续 1 秒后恢复。
3. 山寨门楼方向出现尘土线或黑色剪影。
4. 播放 `boss_intro`。
5. HUD 显示头目血条。
6. `黑风寨主` 在屏幕外 220 到 360px 处入场，不贴脸生成。

头目实际行为见 [19 Boss Heifeng Chief System](19-boss-heifeng-chief-system.md)。

## 数据结构建议

```ts
type StageId = "qingshi_mountain_road";

type StageConfig = {
  id: StageId;
  displayName: "青石山道";
  targetDurationSeconds: [number, number];
  backgroundChunkSize: number;
  originRebaseThreshold: number;
  visualPhases: StageVisualPhase[];
  propRules: StagePropRule[];
};

type StageVisualPhase = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  backgroundTint: string;
  propDensityScale: number;
  distantGateAlpha: number;
};
```

## 调试字段

```text
stageId
stageTimeSeconds
cameraWorldX
cameraWorldY
loadedChunkCount
visiblePropCount
originRebaseCount
currentVisualPhase
backgroundLoopGapCount
bossIntroTriggered
```

红线：

- `backgroundLoopGapCount > 0`
- `loadedChunkCount < 9`
- `originRebaseCount` 后少侠、敌人、掉落物相对位置跳变超过 2px
- 3 秒截图中少侠或内力被背景高亮淹没

## 验收

- 主菜单只有 `青石山道` 一个 MVP 关卡入口。
- 连续朝任意方向移动 3 分钟，没有可见硬墙、黑屏、空白边缘或刷怪断层。
- 静止截图 3 秒内能识别少侠、敌人、内力光点、危险范围和武侠山道背景。
- 背景不会被误认为可拾取物或危险范围。
- 第 360 秒头目入场有场景反馈，但不遮挡危险预兆。
- origin rebase 后，少侠、敌人、投射物、掉落物和镜头无肉眼可见跳动。
