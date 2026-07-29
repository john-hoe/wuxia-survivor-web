export type EnemyTier = "normal" | "elite";
export type EnemyRole = "basic" | "fast" | "tank" | "elite_pressure";
export type EnemyId = "bandit_grunt" | "hound" | "shield_bandit" | "wooden_dummy_elite";

export type EnemyBehaviorKind = "charge" | "pounce" | "shieldwall";

/**
 * 冲锋「官道响马」：距离进入 [triggerMinPx, triggerMaxPx] 且冷却就绪时，
 * 先 windupMs 蓄力（移速 ×windupSlowFactor + 小幅后坐表现，方向于蓄力开始锁定、可走位规避），
 * 随后 chargeMs 直线冲锋（移速 ×chargeSpeedFactor，撞上即现有接触伤害），结束进 cooldownMs 冷却。
 * 蓄力/冲锋中被击退即打断并进冷却；减速带与两阶段乘算兼容。
 */
export type ChargeBehavior = {
  kind: "charge";
  triggerMinPx: number;
  triggerMaxPx: number;
  windupMs: number;
  windupSlowFactor: number;
  /** 蓄力小幅后坐幅度（表现层临时偏移，不进世界坐标） */
  windupRecoilPx: number;
  chargeMs: number;
  chargeSpeedFactor: number;
  cooldownMs: number;
};

/**
 * 扑咬「灰褐野狼」：距离进入 [triggerMinPx, triggerMaxPx] 且冷却就绪时，
 * pounceMs 内向上小跳 hopPx + 前扑 lungePx 快速 lunge（纯表现层临时偏移，不动世界坐标/碰撞，
 * 不附加伤害——接触伤害仍走现有重叠判定），随后进 cooldownMs 冷却。
 */
export type PounceBehavior = {
  kind: "pounce";
  triggerMinPx: number;
  triggerMaxPx: number;
  pounceMs: number;
  lungePx: number;
  /** 向上小跳高度（表现层 y 偏移，负向抬起） */
  hopPx: number;
  cooldownMs: number;
};

/**
 * 盾墙「镖局叛卒」：damageEnemy 入口按攻击来源方向与敌朝向判定，
 * 来自正面 ±frontHalfAngleDeg 扇形的伤害 ×(1-damageReduction)，
 * 格挡时给 blockFlashMs 金色盾光小闪反馈（表现层，不减免即不闪）。
 */
export type ShieldWallBehavior = {
  kind: "shieldwall";
  frontHalfAngleDeg: number;
  damageReduction: number;
  blockFlashMs: number;
};

export type EnemyBehavior = ChargeBehavior | PounceBehavior | ShieldWallBehavior;

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
  /**
   * 小怪行为差异化配置（可选）：仅官道换皮怪激活（见 BEHAVIOR_RESKIN_MAP_IDS +
   * EnemyDirector 换肤生效判定），青石山道原版怪与夜雨破庙换色皮运行时视为无行为。
   */
  behavior?: EnemyBehavior;
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
  },
  // 夜雨破庙：山贼→邪教教徒、恶犬→毒蝎（换色纹理由并行代理注册，textures.exists 缺失回退原版）
  temple_ruin_nightrain: {
    enemy_bandit_grunt_walk: "enemy_cultist_walk",
    enemy_hound_run: "enemy_scorpion_run"
  }
};

/**
 * 行为差异化激活地图白名单（换皮怪=真新怪）：仅枫叶官道三换皮怪
 * （响马=冲锋 / 野狼=扑咬 / 叛卒=盾墙）激活 EnemyConfig.behavior；
 * 青石山道原版怪与夜雨破庙换色皮保持现状手感（不带行为）。
 * EnemyDirector 侧另行校验换色纹理已注册（textures.exists），缺失回退原版皮时行为同步不激活。
 */
export const BEHAVIOR_RESKIN_MAP_IDS: ReadonlySet<string> = new Set(["maple_official_road"]);

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
    assetId: "enemy_bandit_grunt_walk",
    // 官道响马「冲锋」：200-320px 触发，600ms 蓄力（减速 50%+小幅后坐），随后 1.2 倍速直线冲锋 700ms，冷却 6s
    behavior: {
      kind: "charge",
      triggerMinPx: 200,
      triggerMaxPx: 320,
      windupMs: 600,
      windupSlowFactor: 0.5,
      windupRecoilPx: 8,
      chargeMs: 700,
      chargeSpeedFactor: 1.2,
      cooldownMs: 6000
    }
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
    assetId: "enemy_hound_run",
    // 灰褐野狼「扑咬」：130-170px 触发，250ms 起跳（向上小跳+前扑 40px 快速 lunge，表现层），冷却 4s
    behavior: {
      kind: "pounce",
      triggerMinPx: 130,
      triggerMaxPx: 170,
      pounceMs: 250,
      lungePx: 40,
      hopPx: 14,
      cooldownMs: 4000
    }
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
    assetId: "enemy_shield_bandit_walk",
    // 镖局叛卒「盾墙」：正面 ±60° 扇形来源的伤害减免 50%，格挡时 100ms 金色盾光小闪反馈
    behavior: {
      kind: "shieldwall",
      frontHalfAngleDeg: 60,
      damageReduction: 0.5,
      blockFlashMs: 100
    }
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
