export type BossId = "heifeng_chief" | "duanjian_escort" | "xiejiao_tanzhu";

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
  // 调校:maxHp 4200→5460(+30%，单步调整上限；模型有效Boss DPS≈110-123时击杀窗由约35s升至约45-50s，向60-90s目标窗靠拢，强/中/弱构筑分别约45/60/73s，详见docs/39-balance-tuning.md)
  maxHp: 5460,
  moveSpeed: 70,
  collisionRadius: 34,
  visualRadius: 52,
  contactDamage: 18,
  spawnSeconds: 360,
  // 调校:copperReward 150→170(+13%；Boss战时长+30%后按风险/耗时对等补偿，并保持150/180/210→170/210/250的平滑递增)
  copperReward: 170,
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
  maxHp: 5980, // 可调：略肉于黑风寨主（5460）。调校:4600→5980(+30%，单步上限；对齐60-90s击杀窗，中位构筑约65s，详见docs/39-balance-tuning.md)
  moveSpeed: 76, // 可调：镖头步伐更疾（黑风 70）
  collisionRadius: 34,
  visualRadius: 52,
  contactDamage: 18, // 可调
  spawnSeconds: 360,
  copperReward: 210, // 可调：略高赏金（黑风 170）。调校:180→210(+16.7%；战斗时长+30%后的风险对等补偿，保持递增阶梯)
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

/**
 * 邪教坛主（夜雨破庙 Boss）：数值以黑风寨主/断剑镖头为基准微调，全部参数标注可调。
 * 素材 416²×4 idle / 416²×6 attack（与前两个 Boss 同规格，BOSS_SPRITE_SCALE 复用无需改）。
 * tint 走紫黑系贴合邪教蛊毒气质（可调；受击金闪/蓄力红闪结束后恢复该色）。
 * 法系定位：移速略低于黑风寨主，冲撞突进也稍缓，靠 HP 与招式范围施压。
 */
export const tanzhuConfig: BossConfig = {
  id: "xiejiao_tanzhu",
  displayName: "邪教坛主",
  textureKeys: { idle: "boss_tanzhu_idle", attack: "boss_tanzhu_attack" },
  tint: 0x8a5fbf, // 可调：淡紫（紫黑系邪教气质）；想不染色调为 undefined
  maxHp: 6500, // 可调：第三图 Boss，肉于断剑镖头（5980）。调校:5000→6500(+30%，单步上限；对齐60-90s击杀窗，中位构筑约70s，详见docs/39-balance-tuning.md)
  moveSpeed: 64, // 可调：法系，步伐缓于黑风寨主（70）/断剑镖头（76）
  collisionRadius: 34,
  visualRadius: 52,
  contactDamage: 18, // 可调
  spawnSeconds: 360,
  copperReward: 250, // 可调：第三图赏金，略高于镖头（210）。调校:210→250(+19%；战斗时长+30%后的风险对等补偿，保持递增阶梯)
  introMs: 1200,
  charge: {
    id: "charge_slash",
    displayName: "百蛊蚀心", // 可调：招式名
    cooldownMs: 5500, // 可调
    warningMs: 750,
    activeMs: 550,
    damage: 30, // 可调
    dashSpeed: 540, // 可调：法系突进稍缓（黑风 560 / 镖头 580）
    warningWidth: 78,
    warningLength: 460
  },
  whirlwind: {
    id: "whirlwind_blade",
    displayName: "万毒朝宗", // 可调：招式名
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
  duanjian_escort: duanjianEscortConfig,
  xiejiao_tanzhu: tanzhuConfig
};

/** 默认 Boss：仅作 resolveBossConfigForMap 的运行时兜底（mapId 缺失/异常入参）；正式地图必须在 MAP_BOSS_IDS 显式登记。 */
export const DEFAULT_BOSS_ID: BossId = "heifeng_chief";

/**
 * 地图 → Boss 映射（key 为 stageMapConfig 的地图 id，沿用 MAP_ENEMY_TEXTURE_KEYS 的 Record<string, ...> 解耦模式）。
 * 青石山道 = 黑风寨主；枫叶官道 = 断剑镖头；夜雨破庙 = 邪教坛主。
 * QA-005：stageMapConfig.maps 每个条目都必须在此显式登记，ConfigSystem 构建期断言缺失即抛错；
 * 未列出地图的 DEFAULT_BOSS_ID 回退仅保留为运行时兜底，不再是正式地图的隐式约定。
 */
export const MAP_BOSS_IDS: Record<string, BossId> = {
  qingshi_mountain_road: "heifeng_chief",
  maple_official_road: "duanjian_escort",
  temple_ruin_nightrain: "xiejiao_tanzhu"
};

/** 按地图 id 解析 Boss 配置；mapId 缺失/无映射时回退默认 Boss（黑风寨主）——仅作运行时兜底，正式地图映射以 MAP_BOSS_IDS + ConfigSystem 构建期断言为准。 */
export function resolveBossConfigForMap(mapId: string | undefined): BossConfig {
  const bossId = (mapId ? MAP_BOSS_IDS[mapId] : undefined) ?? DEFAULT_BOSS_ID;
  return bossConfigsById[bossId];
}
