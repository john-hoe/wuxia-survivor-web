export type SkillTag = "aimed" | "orbit" | "aoe" | "pierce" | "defense" | "knockback";
export type SkillKind = "projectile" | "orbit" | "aoe";
export type SkillId = "yulong_sword_qi" | "huifeng_dart" | "zhenshan_palm";
export type AdvanceKeyId = "sword_manual_page" | "hidden_weapon_pouch" | "inner_force_manual";

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
  "zhenshan_palm"
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
  }
};

export function isSkillId(value: string): value is SkillId {
  return Object.prototype.hasOwnProperty.call(skillConfigs, value);
}
