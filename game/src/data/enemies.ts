export type EnemyTier = "normal" | "elite";
export type EnemyRole = "basic" | "fast" | "tank" | "elite_pressure";
export type EnemyId = "bandit_grunt" | "hound" | "shield_bandit" | "wooden_dummy_elite";

export type EnemyConfig = {
  id: EnemyId;
  displayName: string;
  tier: EnemyTier;
  role: EnemyRole;
  maxHp: number;
  moveSpeed: number;
  contactDamage: number;
  collisionRadius: number;
  visualRadius: number;
  spawnAfterSeconds: number;
  innerPowerDrop: "small" | "medium" | "large";
  innerPowerDropChance: number;
  healDropChance: number;
  scoreValue: number;
  maxAliveShare: number;
  colorRole: string;
  assetId: string;
};

/**
 * 地图敌种换肤表：地图 id → 原版贴图 key → 换色版贴图 key。
 * 枫叶官道三个换色纹理由 GameScene/artManifest 侧注册（EnemyDirector 用 textures.exists 防御，缺失回退原版）；
 * 青石山道不在表内，直接用 EnemyConfig.assetId 原版。精英木人与 Boss 不换肤（表内无对应条目）。
 */
export const MAP_ENEMY_TEXTURE_KEYS: Record<string, Record<string, string>> = {
  maple_official_road: {
    enemy_bandit_grunt_walk: "enemy_maple_bandit_walk",
    enemy_hound_run: "enemy_maple_wolf_run",
    enemy_shield_bandit_walk: "enemy_maple_shield_walk"
  }
};

export const enemyConfigs: Record<EnemyId, EnemyConfig> = {
  bandit_grunt: {
    id: "bandit_grunt",
    displayName: "山贼喽啰",
    tier: "normal",
    role: "basic",
    maxHp: 28,
    moveSpeed: 72,
    contactDamage: 5,
    collisionRadius: 16,
    visualRadius: 36,
    spawnAfterSeconds: 0,
    innerPowerDrop: "small",
    innerPowerDropChance: 1,
    healDropChance: 0.01,
    scoreValue: 1,
    maxAliveShare: 1,
    colorRole: "warm_brown_basic_enemy",
    assetId: "enemy_bandit_grunt_walk"
  },
  hound: {
    id: "hound",
    displayName: "恶犬",
    tier: "normal",
    role: "fast",
    maxHp: 18,
    moveSpeed: 118,
    contactDamage: 8,
    collisionRadius: 14,
    visualRadius: 32,
    spawnAfterSeconds: 35,
    innerPowerDrop: "small",
    innerPowerDropChance: 0.8,
    healDropChance: 0.01,
    scoreValue: 1,
    maxAliveShare: 0.35,
    colorRole: "dark_red_fast_enemy",
    assetId: "enemy_hound_run"
  },
  shield_bandit: {
    id: "shield_bandit",
    displayName: "持盾山贼",
    tier: "normal",
    role: "tank",
    maxHp: 80,
    moveSpeed: 48,
    contactDamage: 14,
    collisionRadius: 20,
    visualRadius: 46,
    spawnAfterSeconds: 120,
    innerPowerDrop: "medium",
    innerPowerDropChance: 1,
    healDropChance: 0.02,
    scoreValue: 3,
    maxAliveShare: 0.25,
    colorRole: "earth_brown_tank_enemy",
    assetId: "enemy_shield_bandit_walk"
  },
  wooden_dummy_elite: {
    id: "wooden_dummy_elite",
    displayName: "木人机关",
    tier: "elite",
    role: "elite_pressure",
    maxHp: 260,
    moveSpeed: 42,
    contactDamage: 20,
    collisionRadius: 28,
    visualRadius: 72,
    spawnAfterSeconds: 180,
    innerPowerDrop: "large",
    innerPowerDropChance: 1,
    healDropChance: 0.2,
    scoreValue: 12,
    maxAliveShare: 0.02,
    colorRole: "wooden_elite_enemy",
    assetId: "enemy_wooden_dummy_elite_walk"
  }
};
