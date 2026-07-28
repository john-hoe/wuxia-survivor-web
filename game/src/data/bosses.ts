export type BossId = "heifeng_chief" | "duanjian_escort";

export type BossState =
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

export type BossAttackId = "charge_slash" | "whirlwind_blade";

export type BossAttackConfig = {
  id: BossAttackId;
  displayName: string;
  cooldownMs: number;
  warningMs: number;
  activeMs: number;
  damage: number;
};

export type BossConfig = {
  id: BossId;
  displayName: string;
  /** idle/attack 贴图纹理 key；注册侧自动生成 `${key}_anim` 动画（getArtAnimationKey） */
  textureKeys: { idle: string; attack: string };
  /**
   * 常驻 sprite tint（可选；缺省不染，保持素材原色）。
   * 受击闪/蓄力 tint 结束后由 BossSystem 恢复为该色而非 clearTint。
   */
  tint?: number;
  maxHp: number;
  moveSpeed: number;
  collisionRadius: number;
  visualRadius: number;
  contactDamage: number;
  spawnSeconds: number;
  copperReward: number;
  introMs: number;
  charge: BossAttackConfig & {
    dashSpeed: number;
    warningWidth: number;
    warningLength: number;
  };
  whirlwind: BossAttackConfig & {
    startRadius: number;
    endRadius: number;
  };
};

export const heifengChiefConfig: BossConfig = {
  id: "heifeng_chief",
  displayName: "黑风寨主",
  textureKeys: { idle: "boss_heifeng_idle", attack: "boss_heifeng_attack" },
  maxHp: 4200,
  moveSpeed: 70,
  collisionRadius: 34,
  visualRadius: 52,
  contactDamage: 18,
  spawnSeconds: 360,
  copperReward: 150,
  introMs: 1200,
  charge: {
    id: "charge_slash",
    displayName: "冲撞斩",
    cooldownMs: 5500,
    warningMs: 750,
    activeMs: 550,
    damage: 30,
    dashSpeed: 560,
    warningWidth: 78,
    warningLength: 460
  },
  whirlwind: {
    id: "whirlwind_blade",
    displayName: "旋风刀",
    cooldownMs: 8000,
    warningMs: 900,
    activeMs: 1300,
    damage: 22,
    startRadius: 90,
    endRadius: 310
  }
};

/**
 * 断剑镖头（枫叶官道 Boss）：数值以黑风寨主为基准微调，全部参数标注可调。
 * 素材 416²×4 idle / 416²×6 attack（与黑风同规格，BOSS_SPRITE_SCALE 复用无需改）。
 * tint 走冷青灰贴合金铁镖头气质（可调；受击金闪/蓄力红闪结束后恢复该色）。
 */
export const duanjianEscortConfig: BossConfig = {
  id: "duanjian_escort",
  displayName: "断剑镖头",
  textureKeys: { idle: "boss_duanjian_idle", attack: "boss_duanjian_attack" },
  tint: 0xc7d6e2, // 可调：冷青灰（镖头金铁气质）；想不染色调为 undefined
  maxHp: 4600, // 可调：略肉于黑风寨主（4200）
  moveSpeed: 76, // 可调：镖头步伐更疾（黑风 70）
  collisionRadius: 34,
  visualRadius: 52,
  contactDamage: 18, // 可调
  spawnSeconds: 360,
  copperReward: 180, // 可调：略高赏金（黑风 150）
  introMs: 1200,
  charge: {
    id: "charge_slash",
    displayName: "断岳突斩", // 可调：招式名（GameScene 预警文案按 attackId 硬映射，不受影响）
    cooldownMs: 5500, // 可调
    warningMs: 750,
    activeMs: 550,
    damage: 30, // 可调
    dashSpeed: 580, // 可调：略快于黑风（560）
    warningWidth: 78,
    warningLength: 460
  },
  whirlwind: {
    id: "whirlwind_blade",
    displayName: "回风断刃", // 可调：招式名
    cooldownMs: 8000, // 可调
    warningMs: 900,
    activeMs: 1300,
    damage: 22, // 可调
    startRadius: 90,
    endRadius: 310
  }
};

export const bossConfigsById: Record<BossId, BossConfig> = {
  heifeng_chief: heifengChiefConfig,
  duanjian_escort: duanjianEscortConfig
};

/** 默认 Boss：地图无映射（含 temple_ruin_nightrain 等后续新图）时回退黑风寨主。 */
export const DEFAULT_BOSS_ID: BossId = "heifeng_chief";

/**
 * 地图 → Boss 映射（key 为 stageMapConfig 的地图 id，沿用 MAP_ENEMY_TEXTURE_KEYS 的 Record<string, ...> 解耦模式）。
 * 青石山道 = 黑风寨主（现状）；枫叶官道 = 断剑镖头；未列出的地图走 DEFAULT_BOSS_ID。
 */
export const MAP_BOSS_IDS: Record<string, BossId> = {
  qingshi_mountain_road: "heifeng_chief",
  maple_official_road: "duanjian_escort"
};

/** 按地图 id 解析 Boss 配置；mapId 缺失/无映射时回退默认 Boss（黑风寨主）。 */
export function resolveBossConfigForMap(mapId: string | undefined): BossConfig {
  const bossId = (mapId ? MAP_BOSS_IDS[mapId] : undefined) ?? DEFAULT_BOSS_ID;
  return bossConfigsById[bossId];
}
