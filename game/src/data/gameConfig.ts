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
