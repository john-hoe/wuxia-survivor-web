import type { DebugConfig, StageConfig } from "../types";

export const stageConfig: StageConfig = {
  id: "qingshi_mountain_road",
  displayName: "青石山道",
  targetDurationSeconds: 480,
  bossSpawnSeconds: 360,
  backgroundChunkSizePx: 1024,
  loadedChunkCount: 1,
  qualityScale: 1
};

export const debugConfig: DebugConfig = {
  eventHistoryLimit: 200,
  debugPanelDefaultVisible: false
};

/** 纯表现层视觉参数（不含任何玩法数值）。 */
export type StageVisualConfig = {
  /** 装饰物散布槽位：backgroundChunkSizePx 均分为 N×N 个槽位 */
  propSlotDivisions: number;
  /** 每个槽位生成装饰物的概率 */
  propDensity: number;
  /** 雾带透明度（SCREEN 混合） */
  fogAlpha: number;
  /** 雾带随世界漂移的系数（另叠加时间慢漂） */
  fogDriftFactor: number;
  /** 山门由极远到清晰的聚焦时长（秒，对齐 bossSpawnSeconds） */
  gateFocusSeconds: number;
  /** Boss 战全屏压暗层目标透明度 */
  bossDimAlpha: number;
};

export const stageVisualConfig: StageVisualConfig = {
  propSlotDivisions: 4,
  propDensity: 0.86,
  fogAlpha: 0.08,
  fogDriftFactor: 0.3,
  gateFocusSeconds: 360,
  bossDimAlpha: 0.15
};

/** 天气种类：晴（现状落叶）/ 起风（落叶加密）/ 微雨 / 雪 / 雾。 */
export type WeatherKind = "clear" | "breeze" | "rain" | "snow" | "fog";

/** 竹雨听风·天气系统视觉参数（纯表现层）。 */
export type WeatherVisualConfig = {
  /** 是否按局内时间轴自动轮换天气 */
  timelineEnabled: boolean;
  /** 时间轴：按 fromSeconds 升序，取最后一个 <= 当前秒数的条目 */
  timeline: Array<{ fromSeconds: number; kind: WeatherKind }>;
  /** Boss 出场前多少秒切入临战天气 */
  preBossLeadSeconds: number;
  /** Boss 临战天气（雪或雾） */
  preBossKind: WeatherKind;
  /** 起风落叶发射间隔（毫秒，越小越密） */
  breezeLeafFrequencyMs: number;
  /** 雨丝近层/远层发射间隔（毫秒） */
  rainNearFrequencyMs: number;
  rainFarFrequencyMs: number;
  /** 雪花发射间隔（毫秒） */
  snowFrequencyMs: number;
  /** 地面涟漪间隔区间（毫秒） */
  rippleIntervalMs: { min: number; max: number };
  /** 雾天气主雾带目标透明度 */
  foggyFogAlpha: number;
  /** 雾天气附加滚动雾带目标透明度 */
  fogBandAlpha: number;
  /** 各天气下装饰物摆动幅度倍率（晴低、风高） */
  windSwayByKind: Record<WeatherKind, number>;
};

export const weatherVisualConfig: WeatherVisualConfig = {
  timelineEnabled: true,
  timeline: [
    { fromSeconds: 0, kind: "clear" },
    { fromSeconds: 120, kind: "breeze" },
    { fromSeconds: 240, kind: "rain" }
  ],
  preBossLeadSeconds: 30,
  preBossKind: "fog",
  breezeLeafFrequencyMs: 240,
  rainNearFrequencyMs: 34,
  rainFarFrequencyMs: 26,
  snowFrequencyMs: 85,
  rippleIntervalMs: { min: 700, max: 1600 },
  foggyFogAlpha: 0.2,
  fogBandAlpha: 0.12,
  windSwayByKind: {
    clear: 0.7,
    breeze: 1.7,
    rain: 1.2,
    snow: 1,
    fog: 0.8
  }
};

/** 色温叙事参数：精英预警/Boss 出场时压暗 + 泛朱砂。 */
export type NarrativeTintConfig = {
  /** 压暗层目标透明度 */
  dimAlpha: number;
  /** 朱砂层目标透明度（MULTIPLY 混合） */
  tintAlpha: number;
  /** 进入过渡时长（毫秒） */
  fadeInMs: number;
  /** 事件结束回落时长（毫秒） */
  fadeOutMs: number;
  /** 精英预警后兜底保持秒数（未收到击杀/消失事件时自动回落） */
  eliteHoldSeconds: number;
};

export const narrativeTintConfig: NarrativeTintConfig = {
  dimAlpha: 0.12,
  tintAlpha: 0.14,
  fadeInMs: 800,
  fadeOutMs: 1200,
  eliteHoldSeconds: 8
};

/** 动态暗角参数：低血/Boss 战时收紧。 */
export type VignetteDynamicsConfig = {
  /** 低血收紧比例（覆盖范围 1/(1+该值)） */
  lowHpTighten: number;
  /** Boss 战收紧比例 */
  bossTighten: number;
  /** 收紧到最大时动态暗角层透明度 */
  maxAlpha: number;
  /** 收紧过渡时长（毫秒） */
  tweenMs: number;
  /** 松开过渡时长（毫秒） */
  releaseMs: number;
};

export const vignetteDynamicsConfig: VignetteDynamicsConfig = {
  lowHpTighten: 0.2,
  bossTighten: 0.15,
  maxAlpha: 0.55,
  tweenMs: 600,
  releaseMs: 800
};

// ── 地图配置化：青石山道 / 枫叶官道 ─────────────────────────────────────

/** 局内地图条目 ID。 */
export type StageMapId = "qingshi_mountain_road" | "maple_official_road" | "temple_ruin_nightrain";

/** 昼昏渐变档位：at = 局内秒数；tint = 全屏 MULTIPLY 叠加色；strength = 该层目标 alpha（0 = 无染色）。 */
export type DayNightTintTier = {
  at: number;
  tint: number;
  strength: number;
};

/** 单张地图的纯表现层配置（不含玩法数值；散布权重合计应为 1）。 */
export type StageMapEntry = {
  id: StageMapId;
  displayName: string;
  /** QA-006：该图关卡 BGM 的音频事件 id（注册于 data/audio.ts；AudioSystem.playMusic 按当前地图重映射时读取） */
  musicId: string;
  /** 官方地面平铺纹理 key（textures.exists 防御，缺失时走兜底） */
  groundTexture: string;
  /** 地面兜底纹理 key（GameScene 程序化生成，保证不崩） */
  fallbackGroundTexture: string;
  /** 使用官方地面素材时的透明度（半透透出世界底色） */
  groundAlphaOfficial: number;
  /** 世界底色（相机背景） */
  worldBg: string;
  worldBgInt: number;
  /** 是否铺设青石路带层（road_ribbon_a/b）；枫叶官道关闭，用地面自带官道 */
  roadRibbonEnabled: boolean;
  /** 散布 prop 类型池与权重（key 需存在于 GameScene 的 SCATTER_PROP_BASE） */
  scatterPool: Array<{ key: string; weight: number }>;
  /** 起风落叶粒子 tint 组 */
  leafTints: number[];
  /** 雾带染色（TileSprite tint；0xffffff 表示不染，沿用雾纹理原色） */
  fogTint: number;
  /**
   * 昼昏渐变（可选；缺省 = 不启用，青石山道保持现状）。
   * tints 按 at 升序：局内时间在相邻档间逐帧插值颜色/强度，末档之后恒定保持（Boss 期停末档）。
   */
  dayNightCycle?: { tints: DayNightTintTier[] };
  /**
   * 天气锁定（可选；夜雨破庙 = "rain"）：该图开局即锁定此天气，
   * 不走时间轴轮换、也不吃 Boss 前临战天气覆盖。
   */
  weatherLock?: WeatherKind;
  /**
   * 永夜叠加层（可选；夜雨破庙用）：全屏冷蓝 MULTIPLY 常驻染色，
   * tint = 叠加色，strength = 常驻 alpha（与 dayNightCycle 互斥，二选一）。
   */
  nightOverlay?: { tint: number; strength: number };
};

export type StageMapConfig = {
  /** 默认（开局）地图 */
  defaultMapId: StageMapId;
  /** 全部地图条目；F2 按数组顺序循环切换 */
  maps: StageMapEntry[];
};

export const stageMapConfig: StageMapConfig = {
  defaultMapId: "qingshi_mountain_road",
  maps: [
    {
      id: "qingshi_mountain_road",
      displayName: "青石山道",
      musicId: "music_stage_qingshi",
      groundTexture: "ground_qingshi_base",
      fallbackGroundTexture: "qingshi_ground_tile",
      groundAlphaOfficial: 0.72,
      worldBg: "#14201b",
      worldBgInt: 0x14201b,
      roadRibbonEnabled: true,
      scatterPool: [
        { key: "bamboo_edge_cluster", weight: 0.32 },
        { key: "rock_cluster", weight: 0.24 },
        { key: "wood_stake_flag", weight: 0.12 },
        { key: "decor_lantern", weight: 0.08 },
        { key: "decor_flag", weight: 0.08 },
        { key: "decor_stele", weight: 0.08 },
        { key: "decor_winejar", weight: 0.08 }
      ],
      leafTints: [0x9aa583, 0x7d9b76, 0xb8b3a4],
      fogTint: 0xffffff
    },
    {
      id: "maple_official_road",
      displayName: "枫叶官道",
      musicId: "music_stage_maple",
      groundTexture: "ground_maple_base",
      fallbackGroundTexture: "maple_ground_tile",
      groundAlphaOfficial: 0.8,
      worldBg: "#241a12",
      worldBgInt: 0x241a12,
      roadRibbonEnabled: false,
      scatterPool: [
        { key: "maple_tree_cluster", weight: 0.34 },
        { key: "rock_cluster", weight: 0.14 },
        { key: "decor_stone_lion", weight: 0.12 },
        { key: "decor_sword_mound", weight: 0.12 },
        { key: "decor_stele", weight: 0.1 },
        { key: "decor_flag", weight: 0.1 },
        { key: "decor_winejar", weight: 0.08 }
      ],
      leafTints: [0xb23a24, 0xd4692a, 0xe09a3e],
      fogTint: 0xd4a05a,
      // 昼昏渐变：白天 → 150s 浅暖橙 → 260s 赭橙 → 330s 暮赭红 → 360s+（Boss 期）夜墨红恒定。
      dayNightCycle: {
        tints: [
          { at: 0, tint: 0xffffff, strength: 0 },
          { at: 150, tint: 0xd4a05a, strength: 0.1 },
          { at: 260, tint: 0xc06a30, strength: 0.2 },
          { at: 330, tint: 0x8a3a28, strength: 0.3 },
          { at: 360, tint: 0x3a1a14, strength: 0.38 }
        ]
      }
    },
    {
      id: "temple_ruin_nightrain",
      displayName: "夜雨破庙",
      musicId: "music_stage_temple",
      groundTexture: "ground_darktemple_base",
      fallbackGroundTexture: "temple_ground_tile",
      groundAlphaOfficial: 0.85,
      worldBg: "#0d1117",
      worldBgInt: 0x0d1117,
      roadRibbonEnabled: false,
      scatterPool: [
        { key: "decor_broken_buddha", weight: 0.18 },
        { key: "decor_temple_ruin", weight: 0.16 },
        { key: "decor_stone_lantern", weight: 0.14 },
        { key: "decor_spirit_tablet", weight: 0.12 },
        { key: "rock_cluster", weight: 0.14 },
        { key: "decor_stele", weight: 0.12 },
        { key: "decor_flag", weight: 0.08 },
        { key: "decor_winejar", weight: 0.06 }
      ],
      // 雨丝冷蓝灰（起风落叶通道复用为雨丝染色）
      leafTints: [0x6a7a8a, 0x8a9aaa, 0x5a6a7a],
      fogTint: 0x7a8a9a,
      // 永夜：不配 dayNightCycle，改为常驻冷蓝夜色叠加 + 天气锁定中雨（不走时间轴轮换）
      weatherLock: "rain",
      nightOverlay: { tint: 0x2a3a52, strength: 0.22 }
    }
  ]
};

/** QA-003 遮挡治理视觉参数（纯表现层，不含玩法数值）：出生安全区 / 动态淡出 / HUD 安全区 / Boss 出场落点。 */
export type OcclusionVisualConfig = {
  /** 出生安全区半径（px）：以英雄出生点（屏幕中心）为圆心，区内不生成高遮挡大件 prop（换小件或跳过） */
  spawnSafeRadiusPx: number;
  /** 高遮挡大件 prop 纹理 key（竹丛/枫树/石佛/残垣）；石堆/酒坛等小件不受安全区与淡出限制 */
  largeOccluderKeys: string[];
  /** 动态淡出触发半径（px）：英雄与大件 prop 水平距离小于该值且 prop depth 高于英雄时触发 */
  propFadeRadiusPx: number;
  /** 动态淡出目标透明度（离开后恢复 prop 生成时的基础 alpha） */
  propFadeAlpha: number;
  /** 动态淡出/恢复补间时长（毫秒） */
  propFadeMs: number;
  /** HUD 安全区高度（px）：屏幕顶部该条带内不生成任何散布 prop（生成时按屏幕 y 坐标过滤） */
  hudSafeTopPx: number;
  /** Boss 出场落点距屏幕底边最小留白（px）：落点屏幕 y 须 ≤ 屏幕高 - 该值，避开底部技能栏 */
  bossIntroMinBottomMarginPx: number;
};

export const occlusionVisualConfig: OcclusionVisualConfig = {
  spawnSafeRadiusPx: 220,
  largeOccluderKeys: ["bamboo_edge_cluster", "maple_tree_cluster", "decor_broken_buddha", "decor_temple_ruin"],
  propFadeRadiusPx: 70,
  propFadeAlpha: 0.3,
  propFadeMs: 220,
  hudSafeTopPx: 96,
  bossIntroMinBottomMarginPx: 150
};

/** 重击屏幕压暗聚焦参数。 */
export type HeavyHitFocusConfig = {
  /** 单次掉血占上限比例达到该值时触发 */
  thresholdRatio: number;
  /** 压暗峰值透明度 */
  alpha: number;
  /** 压暗总时长（毫秒） */
  durationMs: number;
};

export const heavyHitFocusConfig: HeavyHitFocusConfig = {
  thresholdRatio: 0.2,
  alpha: 0.25,
  durationMs: 150
};

/** 震屏强度三档取值（无 / 弱 / 标准），对应 GameSettings.shakeScale。 */
export const shakeScaleLevels = [0, 0.5, 1] as const;

/** 方案五反馈密度设置默认值：新档初始化与旧档缺字段补齐共用，仅表现层。 */
export const feedbackSettingsDefaults = {
  damageNumbers: true,
  shakeScale: 1
} as const;
