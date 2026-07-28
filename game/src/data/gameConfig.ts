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
export type StageMapId = "qingshi_mountain_road" | "maple_official_road";

/** 单张地图的纯表现层配置（不含玩法数值；散布权重合计应为 1）。 */
export type StageMapEntry = {
  id: StageMapId;
  displayName: string;
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
      fogTint: 0xd4a05a
    }
  ]
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
