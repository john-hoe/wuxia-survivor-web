# 19 Boss Heifeng Chief System

## 目的

`黑风寨主` 是 MVP 胜利闭环的头目。它负责检验玩家 6 分钟内形成的招式构筑、走位能力和危险预兆理解。

第一性原则：

- 头目难度来自可读攻击和持续压迫，不来自突然秒杀。
- 头目必须让玩家知道“现在进入最后阶段”。
- 头目攻击前至少 0.5 秒预兆，移动端也能看清。
- 击败头目后立即进入 `战后清点`，形成完整单局闭环。

## 范围

P0 必做：

- 1 个头目：`黑风寨主`。
- 2 种攻击：`冲撞斩`、`旋风刀`。
- 入场、血条、预警音效、攻击预兆、受击、死亡。
- 胜利结算触发。

P1 后续：

- 第三攻击。
- 二阶段变招。
- 头目台词。

非目标：

- 不做复杂弹幕头目。
- 不做不可打断长剧情。
- 不做瞬移贴脸攻击。
- 不做付费复活或广告复活。

## 基础属性

| 属性 | MVP 值 |
| --- | ---: |
| 生命 | 4200 |
| 碰撞半径 | 34px |
| 视觉半径 | 52px |
| 移动速度 | 70px/s |
| 接触伤害 | 18 |
| 入场时间 | 第 360 秒 |
| 目标击败时间 | 60 到 120 秒 |
| 头目奖励 | 150 铜钱 |

调参边界：

- 平均击败时间 <45 秒：提高生命 15% 或降低普通怪掉落节奏。
- 平均击败时间 >150 秒：降低生命 15% 或缩短旋风刀冷却。
- 头目攻击造成无法理解的死亡：先增强预兆，不先降伤害。

## 状态机

```text
pending
intro
idle
choose_attack
charge_windup
charge_slash
whirlwind_windup
whirlwind
hurt
dead
cleared
```

规则：

- `pending`：等待 `boss_spawn_requested`。
- `intro`：入场 1.2 秒，普通怪潮降压。
- `idle`：短暂追踪少侠，等待攻击冷却。
- `choose_attack`：根据距离和冷却选择攻击。
- `hurt`：受击闪烁，不打断攻击，除非死亡。
- `dead`：播放死亡动画和音效。
- `cleared`：通知结算系统进入胜利 `战后清点`。

暂停、领悟、战后清点期间，头目状态计时全部停止。

## 攻击 1：冲撞斩

用途：惩罚直线贪输出，要求玩家横向走位。

| 项 | 值 |
| --- | ---: |
| 冷却 | 5.5s |
| 预兆 | 0.75s |
| 冲刺时间 | 0.55s |
| 冲刺速度 | 560px/s |
| 伤害 | 30 |
| 预兆宽度 | 78px |
| 预兆长度 | 460px |

流程：

1. 锁定少侠当前位置方向。
2. 地面显示红橙刀痕长条，持续 0.75 秒。
3. 播放 `boss_warning`。
4. 头目沿锁定方向冲刺。
5. 命中少侠时按 [15 Hero Movement And Damage System](15-hero-movement-and-damage-system.md) 触发 0.6 秒受伤无敌。
6. 冲刺结束后停顿 0.35 秒。

公平规则：

- 预兆期间不追踪少侠，方向锁定。
- 预兆和冲刺播放期间，头目朝向跟随锁定冲刺方向，不因少侠后来绕到身后而翻面。
- 预兆透明度 35% 到 55%，不能完全盖住少侠。
- 冲刺不能跨越整个屏幕后立刻二次冲刺。

## 攻击 2：旋风刀

用途：迫使玩家离开近身区域，给回风飞镖和震山掌构筑制造风险。

| 项 | 值 |
| --- | ---: |
| 冷却 | 8.0s |
| 预兆 | 0.9s |
| 扩散时间 | 1.3s |
| 伤害 | 22 |
| 初始半径 | 90px |
| 最大半径 | 310px |
| 安全间隙 | 至少 1 个方向有 70px 以上可走空间 |

流程：

1. 头目原地蓄力，脚下出现环形红橙范围。
2. 播放 `boss_warning`。
3. 环形刀气从 90px 扩散到 310px。
4. 刀气命中少侠造成 22 伤害。
5. 刀气结束后头目进入 0.6 秒硬直。

公平规则：

- 预兆必须早于伤害至少 0.5 秒。
- 旋风刀 VFX 不能遮挡少侠脚下辅助血条。
- 头目战普通怪上限应降低，避免预兆被小怪完全盖住。

## 攻击选择

```text
if distanceToHero > 280 and chargeReady:
  choose charge_slash
else if distanceToHero < 220 and whirlwindReady:
  choose whirlwind
else choose any ready attack by cooldown priority
```

连续攻击限制：

- 同一种攻击不能连续使用超过 2 次。
- 每次攻击之间至少有 1.0 秒普通移动窗口。
- 少侠死亡后立即停止攻击。

## 头目血条

显示规则：

- 头目入场 1 秒内显示。
- 默认放顶部中间或底部独立层，不遮挡少侠半径 180px。
- 文案显示 `黑风寨主`，不显示英文 Boss。
- 血条显示百分比，不需要显示精确数值。
- 血量低于 30% 时血条边缘可轻微闪烁，但不能造成视觉疲劳。

## 数据结构建议

```ts
type BossState =
  | "pending"
  | "intro"
  | "idle"
  | "choose_attack"
  | "charge_windup"
  | "charge_slash"
  | "whirlwind_windup"
  | "whirlwind"
  | "hurt"
  | "dead"
  | "cleared";

type BossConfig = {
  id: "heifeng_chief";
  displayName: "黑风寨主";
  maxHp: number;
  collisionRadius: number;
  contactDamage: number;
  attacks: BossAttackConfig[];
  copperReward: number;
};
```

## 事件

| 事件 | 触发 |
| --- | --- |
| `boss_spawned` | 头目实体生成 |
| `boss_intro_started` | 入场开始 |
| `boss_attack_warning` | 攻击预兆出现 |
| `boss_attack_started` | 攻击真正造成危险 |
| `boss_damaged` | 头目受击 |
| `boss_defeated` | 头目生命归零 |
| `stage_cleared` | 胜利条件达成 |

## 调试字段

```text
bossState
bossHp
bossHpPercent
currentAttack
nextChargeSeconds
nextWhirlwindSeconds
lastWarningDuration
lastAttackDamage
bossAliveSeconds
bossHitCount
stageCleared
```

红线：

- `lastWarningDuration < 0.5`
- 头目入场 1 秒后仍无血条
- 同一种攻击连续 3 次
- 击败头目后 2 秒内没有进入战后清点

## 验收

- 第 360 秒后头目能入场，并显示 `黑风寨主` 血条。
- 头目至少使用 `冲撞斩` 和 `旋风刀` 两种攻击。
- 每次攻击前有至少 0.5 秒视觉预兆和预警音效。
- 头目伤害能触发少侠 0.6 秒受伤无敌，不会同一攻击多次秒扣。
- 普通怪潮在头目战期间下降，头目预兆可读。
- 击败头目后进入 `战后清点`，并结算 150 铜钱头目奖励。
