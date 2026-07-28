export type SkillTag = "aimed" | "orbit" | "aoe" | "pierce" | "defense" | "knockback" | "control";
export type SkillKind = "projectile" | "orbit" | "aoe" | "zone";
export type SkillId = "yulong_sword_qi" | "huifeng_dart" | "zhenshan_palm" | "moran_ink_zone";
export type AdvanceKeyId = "sword_manual_page" | "hidden_weapon_pouch" | "inner_force_manual" | "pine_soot_inkstick";

export type SkillLevelConfig = {
  level: number;
  damage: number;
  cooldownMs?: number;
  range?: number;
  projectileCount?: number;
  radius?: number;
  speed?: number;
  pierce?: number;
  knockback?: number;
  rotationSpeedDegPerSecond?: number;
  perEnemyHitCooldownMs?: number;
  /** zone 专用：领域存续时长（墨染江山） */
  durationMs?: number;
  /** zone 专用：伤害跳变间隔（每跳一次伤害+刷新减速） */
  tickIntervalMs?: number;
  /** zone 专用：减速比例 0-1（0.3 = 敌人移速降至 70%） */
  slowPercent?: number;
  /** zone 专用：施放时 stamp 的墨笔触数（Lv3+ 双道交叉） */
  strokeCount?: number;
  /**
   * zone 专用·毒化「墨里淬毒」（Lv3+，可选调参位，当前为表现层常量未启用本字段）：
   * 余毒跳数——被 tick 命中的敌人离开领域后再跳 N 次毒（伤害=当次 tick 伤害）。
   */
  poisonTicks?: number;
  /** zone 专用·毒化：余毒跳间隔 ms（缺省 500，与 tickIntervalMs 同步节奏） */
  poisonTickMs?: number;
  /** zone 专用·毒化进阶「金蛊江山」：蚀甲——中毒期间敌人受伤倍率（1.1 = +10%，缺省 1） */
  poisonAmp?: number;
};

export type SkillAdvancementConfig = {
  requiredLevel: number;
  requiredKeyId: AdvanceKeyId;
  displayName: string;
  description: string;
};

export type SkillConfig = {
  id: SkillId;
  displayName: string;
  kind: SkillKind;
  maxLevel: number;
  tags: SkillTag[];
  levels: SkillLevelConfig[];
  advancement?: SkillAdvancementConfig;
};

export const skillOrder: SkillId[] = [
  "yulong_sword_qi",
  "huifeng_dart",
  "zhenshan_palm",
  "moran_ink_zone"
];

export const skillConfigs: Record<SkillId, SkillConfig> = {
  yulong_sword_qi: {
    id: "yulong_sword_qi",
    displayName: "游龙剑气",
    kind: "projectile",
    maxLevel: 5,
    tags: ["aimed"],
    advancement: {
      requiredLevel: 5,
      requiredKeyId: "sword_manual_page",
      displayName: "游龙归海",
      description: "游龙剑气进阶为三道穿透剑气"
    },
    levels: [
      {
        level: 1,
        damage: 14,
        cooldownMs: 900,
        range: 680,
        projectileCount: 1,
        radius: 14,
        speed: 520,
        pierce: 0
      },
      {
        level: 2,
        damage: 18,
        cooldownMs: 850,
        range: 680,
        projectileCount: 1,
        radius: 14,
        speed: 540,
        pierce: 0
      },
      {
        level: 3,
        damage: 22,
        cooldownMs: 820,
        range: 700,
        projectileCount: 2,
        radius: 14,
        speed: 560,
        pierce: 0
      },
      {
        level: 4,
        damage: 28,
        cooldownMs: 760,
        range: 720,
        projectileCount: 2,
        radius: 16,
        speed: 580,
        pierce: 1
      },
      {
        level: 5,
        damage: 34,
        cooldownMs: 700,
        range: 740,
        projectileCount: 3,
        radius: 16,
        speed: 600,
        pierce: 1
      }
    ]
  },
  huifeng_dart: {
    id: "huifeng_dart",
    displayName: "回风飞镖",
    kind: "orbit",
    maxLevel: 5,
    tags: ["orbit", "defense"],
    advancement: {
      requiredLevel: 5,
      requiredKeyId: "hidden_weapon_pouch",
      displayName: "回风连环",
      description: "飞镖外圈扩大并带出连环尾迹"
    },
    levels: [
      {
        level: 1,
        damage: 8,
        projectileCount: 1,
        radius: 72,
        rotationSpeedDegPerSecond: 220,
        perEnemyHitCooldownMs: 450
      },
      {
        level: 2,
        damage: 10,
        projectileCount: 2,
        radius: 76,
        rotationSpeedDegPerSecond: 230,
        perEnemyHitCooldownMs: 420
      },
      {
        level: 3,
        damage: 12,
        projectileCount: 2,
        radius: 84,
        rotationSpeedDegPerSecond: 250,
        perEnemyHitCooldownMs: 390
      },
      {
        level: 4,
        damage: 15,
        projectileCount: 3,
        radius: 90,
        rotationSpeedDegPerSecond: 270,
        perEnemyHitCooldownMs: 360
      },
      {
        level: 5,
        damage: 18,
        projectileCount: 4,
        radius: 96,
        rotationSpeedDegPerSecond: 290,
        perEnemyHitCooldownMs: 330
      }
    ]
  },
  zhenshan_palm: {
    id: "zhenshan_palm",
    displayName: "震山掌",
    kind: "aoe",
    maxLevel: 5,
    tags: ["aoe", "knockback"],
    advancement: {
      requiredLevel: 5,
      requiredKeyId: "inner_force_manual",
      displayName: "裂石掌风",
      description: "震山掌进阶为两段扩散掌风"
    },
    levels: [
      {
        level: 1,
        damage: 20,
        cooldownMs: 3200,
        radius: 95,
        knockback: 36
      },
      {
        level: 2,
        damage: 26,
        cooldownMs: 3000,
        radius: 105,
        knockback: 40
      },
      {
        level: 3,
        damage: 32,
        cooldownMs: 2800,
        radius: 118,
        knockback: 44
      },
      {
        level: 4,
        damage: 40,
        cooldownMs: 2550,
        radius: 132,
        knockback: 48
      },
      {
        level: 5,
        damage: 50,
        cooldownMs: 2300,
        radius: 150,
        knockback: 54
      }
    ]
  },
  /**
   * 墨染江山（moran_ink_zone，kind "zone"）——墨痕领域·地面 DoT 控制场。
   * 每隔 cooldownMs 在敌人最密集处挥毫，留下 radius 墨痕领域，持续 durationMs，
   * 域内敌人每 tickIntervalMs 跳一次 damage 并附带 slowPercent 减速（领域消失后短时自愈）。
   * 形态分级：Lv1-2 单道墨痕；Lv3-4 双道交叉 + 半径 +30% + 墨缘泛青；Lv5/进阶「金墨江山」
   * 墨芯芥金 + 半径 +50% + 减速 50%（进阶形态数值见 SkillSystem.getZoneProfile）。
   *
   * 毒化升级「墨里淬毒」（Lv3+，表现层参数为 SkillSystem 常量，本表数值不动）：
   * - Lv3+：tick 命中使敌人中毒——离开领域后余毒再跳 2 次（间隔 500ms，伤害=当次 tick 伤害），
   *   墨缘泛孔雀绿韵、领域表面冒毒泡、中毒飘绿字、敌人头顶中毒印记。
   * - 进阶「金蛊江山」：余毒 3 次 + 蚀甲（中毒敌人受伤 +10%），毒泡转金绿 #a9c04a。
   * 调参预留：poisonTicks / poisonTickMs / poisonAmp 可选字段（见 SkillLevelConfig）。
   *
   * 【跨代理对接 · GameScene 由表现层代理维护】
   * 1. F4 调试键：GameScene F 系 debug 键中新增 F4 → skillSystem.unlockSkill("moran_ink_zone", 1)。
   * 2. GameScene 局部函数 isAdvanceKeyId 需将 "pine_soot_inkstick" 加入白名单，
   *    否则顿悟池中的「松烟墨锭」信物无法被 collectAdvanceKey 接收。
   */
  moran_ink_zone: {
    id: "moran_ink_zone",
    displayName: "墨染江山",
    kind: "zone",
    maxLevel: 5,
    tags: ["aoe", "control"],
    advancement: {
      requiredLevel: 5,
      requiredKeyId: "pine_soot_inkstick",
      displayName: "金墨江山",
      description: "墨痕进阶为金墨领域，范围与减速大幅提升"
    },
    levels: [
      {
        level: 1,
        damage: 6,
        cooldownMs: 4500,
        range: 640,
        radius: 90,
        durationMs: 3500,
        tickIntervalMs: 500,
        slowPercent: 0.3,
        strokeCount: 1
      },
      {
        level: 2,
        damage: 8,
        cooldownMs: 4300,
        range: 650,
        radius: 96,
        durationMs: 3600,
        tickIntervalMs: 500,
        slowPercent: 0.3,
        strokeCount: 1
      },
      {
        // Lv3 起「墨里淬毒」生效：余毒 2 跳 @500ms（毒参数为 SkillSystem 表现层常量，不增减本表数值）
        level: 3,
        damage: 10,
        cooldownMs: 4100,
        range: 670,
        radius: 117,
        durationMs: 3700,
        tickIntervalMs: 500,
        slowPercent: 0.32,
        strokeCount: 2
      },
      {
        level: 4,
        damage: 13,
        cooldownMs: 3900,
        range: 690,
        radius: 124,
        durationMs: 3800,
        tickIntervalMs: 500,
        slowPercent: 0.35,
        strokeCount: 2
      },
      {
        level: 5,
        damage: 16,
        cooldownMs: 3600,
        range: 720,
        radius: 130,
        durationMs: 4000,
        tickIntervalMs: 500,
        slowPercent: 0.4,
        strokeCount: 2
      }
    ]
  }
};

export function isSkillId(value: string): value is SkillId {
  return Object.prototype.hasOwnProperty.call(skillConfigs, value);
}
