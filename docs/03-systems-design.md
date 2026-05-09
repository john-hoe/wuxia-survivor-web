# 03 Systems Design

## 系统总览

| 系统 | 职责 |
| --- | --- |
| Player | 少侠移动、生命、受伤、拾取半径 |
| EnemyDirector | 刷怪、波次、难度曲线、首关头目触发 |
| Enemy | 江湖敌人移动、血量、碰撞、死亡 |
| SkillSystem | 自动招式、冷却、投射物、伤害 |
| Projectile | 剑气、暗器、回旋物、范围伤害、命中 |
| DropSystem | 内力光点、回血药丸掉落 |
| UpgradeSystem | 领悟池、三选一、招式进阶 |
| CoinSystem | 单局铜钱结算、铜钱消耗和收益记录 |
| ScriptureSystem | 翻阅秘籍、概率、保底、重复补偿 |
| MetaProgression | 局外永久成长、本地存档 |
| HudSystem | 血量、等级、内力、时间、击杀、招式、头目血条 |
| AudioSystem | 音乐、音效、音量、静音、事件音频节流 |
| PauseSystem | 暂停、继续、重开、回菜单、设置 |
| ScreenFlow | 主菜单、领悟选择、阵亡过渡、战后清点、翻阅秘籍、设置页面 |
| AudioVFX | 命中、击杀、拾取、领悟、受伤、头目预兆 |

## 实现级系统索引

| 系统 | 实现级规格 |
| --- | --- |
| Player | [15 Hero Movement And Damage System](15-hero-movement-and-damage-system.md) |
| InsightSystem | [14 Inner Power And Insight System](14-inner-power-and-insight-system.md) |
| SkillSystem | [16 Skill And Advancement System](16-skill-and-advancement-system.md) |
| EnemyDirector | [17 Enemy Wave And Director System](17-enemy-wave-and-director-system.md) |
| StageSystem | [18 Stage Qingshi Mountain Road System](18-stage-qingshi-mountain-road-system.md) |
| BossSystem | [19 Boss Heifeng Chief System](19-boss-heifeng-chief-system.md) |
| Coin/Scripture/Save | [20 Copper Meta Scripture System](20-copper-meta-scripture-system.md) |
| Hud/Pause/ScreenFlow | [21 HUD Pause Screen Flow Detail](21-hud-pause-screen-flow-detail.md) |
| Art/VFX | [22 Art Animation VFX Asset List](22-art-animation-vfx-asset-list.md) |
| AudioSystem | [23 Audio Event Table](23-audio-event-table.md) |
| 工程骨架 | [24 Technical Project Skeleton](24-technical-project-skeleton.md) |
| 验收证据 | [25 Acceptance Scripts And Evidence](25-acceptance-scripts-and-evidence.md) |

## 系统输入输出

| 系统 | 输入 | 输出 |
| --- | --- | --- |
| Player | 键盘/摇杆、伤害事件、成长加成 | 位置、血量、拾取请求、死亡事件 |
| EnemyDirector | 时间、性能预算、少侠位置、头目状态 | 敌人生成、精英预警、头目请求 |
| SkillSystem | 招式配置、敌人列表、冷却 | 投射物、伤害事件、VFX/SFX 事件 |
| InsightSystem | 内力、等级、招式状态 | 领悟选项、属性变化、进阶事件 |
| BossSystem | 头目请求、少侠位置、伤害事件 | 头目攻击、胜利事件、头目血条状态 |
| DropSystem | 敌人死亡、拾取半径 | 内力、回血事件 |
| HudSystem | 快照状态 | 玩家可见 HUD |
| SaveSystem | 结算、设置、局外成长 | `localStorage` 存档 |

## 少侠

实现级规则见 [15 Hero Movement And Damage System](15-hero-movement-and-damage-system.md)。本节只保留系统总览。

MVP 属性：

| 属性 | 初始值建议 |
| --- | ---: |
| 生命 | 100 |
| 移动速度 | 220 px/s |
| 拾取半径 | 70 px |
| 受伤无敌 | 0.6 秒 |

输入：

- PC：WASD / 方向键。
- 移动端：虚拟摇杆。

## 江湖敌人

实现级规则见 [17 Enemy Wave And Director System](17-enemy-wave-and-director-system.md)。本节只保留系统总览。

MVP P0 敌人：

| 敌人 | 角色 | 作用 |
| --- | --- | --- |
| 山贼喽啰 | basic | 基础怪潮和击杀反馈 |
| 恶犬 | fast | 逼迫走位 |
| 持盾山贼 | tank | 检验持续输出 |
| 木人机关 | elite_pressure | 阶段压力和高价值目标 |

MVP 敌人属性字段：

```text
id
hp
speed
damage
radius
inner_power_drop
inner_power_drop_chance
spawn_weight
spawn_after_seconds
```

刷怪原则：

- 江湖敌人应在屏幕外生成。
- 不允许直接生成在少侠 220px 内。
- 生成在镜头外侧 120 到 260px，且到少侠距离不小于 220px。
- 每 30 到 60 秒增加一个压力变量：数量、速度、血量或精英。
- 同屏江湖敌人达到预算上限后停止普通刷怪，优先保帧。
- 第 360 秒由 `EnemyDirector` 发出 `boss_spawn_requested`，头目系统负责实际入场。

## 招式

实现级规则见 [16 Skill And Advancement System](16-skill-and-advancement-system.md)。本节只保留系统总览。

MVP 招式属性：

```text
id
level
damage
cooldown
range
projectile_count
duration
knockback
tags
```

招式标签：

- `orbit`：环绕。
- `aimed`：自动瞄准。
- `aoe`：范围。
- `pierce`：穿透。
- `chain`：连锁。
- `defense`：护身。

## 领悟池

实现级规则见 [14 Inner Power And Insight System](14-inner-power-and-insight-system.md)。本节只保留系统总览。

领悟分三类：

| 类型 | 例子 |
| --- | --- |
| 新招式 | 获得游龙剑气、回风飞镖 |
| 招式强化 | 伤害 +20%、冷却 -10%、数量 +1 |
| 被动属性 | 移速、拾取半径、最大生命 |

三选一规则：

- 每次领悟给 3 个不同选项。
- 至少 1 个选项应强化已有招式，除非少侠没有招式可强化。
- 不能给已满级招式继续强化。
- 进阶条件满足时，进阶选项权重提高。

## 招式进阶

招式进阶触发、进阶信物来源和领悟权重见 [14 Inner Power And Insight System](14-inner-power-and-insight-system.md)。

MVP 进阶示例：

| 基础招式 | 条件 | 进阶结果 |
| --- | --- | --- |
| 游龙剑气 Lv5 | 剑谱残页 | 游龙归海 |
| 回风飞镖 Lv5 | 暗器囊 | 回风连环 |
| 震山掌 Lv5 | 内劲心法 | 裂石掌风 |

注意：名字和表现必须原创，不使用《Survivor.io》的技能名、图标或表现。

## 首关头目

头目状态：

```text
enter
idle
charge_windup
charge
bullet_ring_windup
bullet_ring
stunned_optional
dead
```

首关头目攻击必须有预兆：

- 冲撞前 0.6 到 0.9 秒显示方向提示。
- 环形弹幕前 0.5 秒出现蓄力动画。

## 局外成长

MVP 只做 3 项永久成长：

| 局外成长 | 每级效果 | 最高等级 |
| --- | ---: | ---: |
| 体魄训练 | 最大生命 +5% | 5 |
| 轻功步法 | 移动速度 +3% | 5 |
| 磁石锦囊 | 拾取半径 +5% | 5 |

局外成长不能变成付费系统。所有局外成长都只消耗局内铜钱。

## 铜钱系统

MVP 新增铜钱只来自战后清点结算。翻阅秘籍的重复补偿可以返还少量铜钱，但它属于消耗返还/补偿记录，不属于战斗掉落。

结算输入：

```text
survival_seconds
kills
level
stage_boss_defeated
difficulty_multiplier
```

MVP 公式：

```text
base = floor(survival_seconds / 10) + kills * 1 + level * 8
boss_bonus = stage_boss_defeated ? 150 : 0
copper_earned = floor((base + boss_bonus) * difficulty_multiplier)
```

限制：

- `difficulty_multiplier` MVP 默认为 `1.0`。
- 铜钱不能通过充值、广告、每日登录或外部账号获得。
- 铜钱变化必须记录来源：`run_result`、`meta_upgrade`、`scripture_pull` 或 `scripture_duplicate_compensation`。

## 铜钱抽秘籍系统

抽秘籍消耗铜钱，不消耗任何付费货币。

MVP 池子：

```text
pool_id: starter_scripture_pool
single_pull_cost: 300
ten_pull_cost: 3000
pity_rare_or_above: 20
```

概率：

| 稀有度 | 概率 | 主要内容 |
| --- | ---: | --- |
| common | 65% | 普通残页、少量铜钱返还 |
| rare | 25% | 外观残页、角色装饰 |
| elite | 9% | 稀有心法碎片 |
| epic | 1% | 收藏品、称号、招式特效 |

重复补偿：

- 重复 `common`：转为 20 到 40 铜钱或通用残页。
- 重复 `rare`：转为 1 个稀有残页。
- 重复 `elite`：转为 1 个稀有心法碎片。
- 重复 `epic`：转为 3 个史诗碎片。

强度边界：

- 抽秘籍可以解锁轻成长碎片，但 MVP 中抽秘籍来源的长期战力加成上限为约 `15%`。
- 核心通关仍主要来自局内领悟、走位和招式构筑。
- 不允许设计“没有抽到某个奖励就无法通关”的内容。

## 存档

`localStorage` 内容：

```json
{
  "schemaVersion": 1,
  "copper": 0,
  "bestTimeSeconds": 0,
  "bestKills": 0,
  "metaUpgrades": {
    "max_hp": 0,
    "move_speed": 0,
    "pickup_radius": 0
  },
  "scriptureGacha": {
    "starter_scripture_pool": {
      "pulls": 0,
      "pityCounter": 0
    }
  },
  "collection": {
    "skins": [],
    "titles": [],
    "fragments": {}
  },
  "settings": {
    "masterVolume": 1.0,
    "musicVolume": 0.6,
    "sfxVolume": 0.8,
    "muted": false,
    "lowVfxMode": false
  }
}
```

存档规则：

- 读档失败时重建默认存档。
- 存档版本升级要有迁移函数。
- 不保存任何隐私数据。
