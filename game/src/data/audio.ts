import { stageMapConfig } from "./gameConfig";

export type AudioEventConfig = {
  id: string;
  path: string;
  bus: "music" | "sfx";
  priority: number;
  volume: number;
  throttleMs: number;
  mergeWindowMs?: number;
  loop?: boolean;
  required: boolean;
  source?: "placeholder" | "generated" | "handmade";
};

const BGM_QINGSHI_URL = new URL("../assets/audio/bgm_qingshi_loop.ogg", import.meta.url).href;
/** QA-006：枫叶官道 / 夜雨破庙专属 BGM（音频文件由并行代理生成至 assets/audio/，缺失时 AudioSystem 静默回退） */
const BGM_MAPLE_URL = new URL("../assets/audio/bgm_maple_loop.ogg", import.meta.url).href;
const BGM_TEMPLE_URL = new URL("../assets/audio/bgm_temple_loop.ogg", import.meta.url).href;
const SFX_SWORD_SWISH_URL = new URL("../assets/audio/sword_swish.ogg", import.meta.url).href;
const SFX_SWORD_SWISH_HEAVY_URL = new URL("../assets/audio/sword_swish_heavy.ogg", import.meta.url).href;
const SFX_PALM_BOOM_URL = new URL("../assets/audio/palm_boom.ogg", import.meta.url).href;
const SFX_HIT_THUD_URL = new URL("../assets/audio/hit_thud.ogg", import.meta.url).href;
const SFX_ENEMY_DIE_PUFF_URL = new URL("../assets/audio/enemy_die_puff.ogg", import.meta.url).href;
const SFX_PICKUP_CHIME_URL = new URL("../assets/audio/pickup_chime.ogg", import.meta.url).href;
const SFX_COIN_CLINK_URL = new URL("../assets/audio/coin_clink.ogg", import.meta.url).href;
const SFX_HEAL_WARM_URL = new URL("../assets/audio/heal_warm.ogg", import.meta.url).href;
const SFX_REVEAL_COMMON_URL = new URL("../assets/audio/reveal_common.ogg", import.meta.url).href;
const SFX_REVEAL_RARE_URL = new URL("../assets/audio/reveal_rare.ogg", import.meta.url).href;
const SFX_REVEAL_EPIC_URL = new URL("../assets/audio/reveal_epic.ogg", import.meta.url).href;
const SFX_BOSS_ROAR_URL = new URL("../assets/audio/boss_roar.ogg", import.meta.url).href;
const SFX_HEARTBEAT_URL = new URL("../assets/audio/heartbeat.ogg", import.meta.url).href;

/** path 指向真实采样文件（而非 procedural: 合成占位）时返回 true。 */
export function isSampleAudioPath(path: string): boolean {
  return path.length > 0 && !path.startsWith("procedural:");
}

export const audioEvents: AudioEventConfig[] = [
  {
    id: "music_menu",
    path: BGM_QINGSHI_URL,
    bus: "music",
    priority: 1,
    volume: 0.3,
    throttleMs: 0,
    loop: true,
    required: false,
    source: "generated"
  },
  {
    id: "music_stage_qingshi",
    path: BGM_QINGSHI_URL,
    bus: "music",
    priority: 1,
    volume: 0.42,
    throttleMs: 0,
    loop: true,
    required: false,
    source: "generated"
  },
  {
    id: "music_stage_maple",
    path: BGM_MAPLE_URL,
    bus: "music",
    priority: 1,
    volume: 0.42,
    throttleMs: 0,
    loop: true,
    required: false,
    source: "generated"
  },
  {
    id: "music_stage_temple",
    path: BGM_TEMPLE_URL,
    bus: "music",
    priority: 1,
    volume: 0.42,
    throttleMs: 0,
    loop: true,
    required: false,
    source: "generated"
  },
  {
    id: "menu_open",
    path: "procedural:menu_open",
    bus: "sfx",
    priority: 2,
    volume: 0.38,
    throttleMs: 160,
    required: true,
    source: "placeholder"
  },
  {
    id: "ui_click",
    path: "procedural:ui_click",
    bus: "sfx",
    priority: 4,
    volume: 0.45,
    throttleMs: 40,
    required: true,
    source: "placeholder"
  },
  {
    id: "pause_toggle",
    path: "procedural:pause_toggle",
    bus: "sfx",
    priority: 5,
    volume: 0.5,
    throttleMs: 100,
    required: true,
    source: "placeholder"
  },
  {
    id: "skill_cast",
    path: SFX_SWORD_SWISH_URL,
    bus: "sfx",
    priority: 2,
    volume: 0.32,
    throttleMs: 100,
    required: true,
    source: "generated"
  },
  {
    id: "skill_cast_advanced",
    path: SFX_SWORD_SWISH_HEAVY_URL,
    bus: "sfx",
    priority: 3,
    volume: 0.42,
    throttleMs: 120,
    required: true,
    source: "generated"
  },
  {
    id: "hit_light",
    path: SFX_HIT_THUD_URL,
    bus: "sfx",
    priority: 2,
    volume: 0.45,
    throttleMs: 80,
    required: true,
    source: "generated"
  },
  {
    id: "enemy_die",
    path: SFX_ENEMY_DIE_PUFF_URL,
    bus: "sfx",
    priority: 3,
    volume: 0.55,
    throttleMs: 60,
    mergeWindowMs: 60,
    required: true,
    source: "generated"
  },
  {
    id: "inner_power_pickup",
    path: SFX_PICKUP_CHIME_URL,
    bus: "sfx",
    priority: 3,
    volume: 0.5,
    throttleMs: 50,
    mergeWindowMs: 50,
    required: true,
    source: "generated"
  },
  {
    id: "heal_pickup",
    path: SFX_HEAL_WARM_URL,
    bus: "sfx",
    priority: 3,
    volume: 0.5,
    throttleMs: 80,
    required: true,
    source: "generated"
  },
  {
    id: "copper_gain",
    path: SFX_COIN_CLINK_URL,
    bus: "sfx",
    priority: 3,
    volume: 0.5,
    throttleMs: 100,
    required: true,
    source: "generated"
  },
  {
    id: "hero_hurt",
    path: "procedural:hero_hurt",
    bus: "sfx",
    priority: 8,
    volume: 0.8,
    throttleMs: 300,
    required: true,
    source: "placeholder"
  },
  {
    id: "hero_die",
    path: "procedural:hero_die",
    bus: "sfx",
    priority: 10,
    volume: 0.86,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  },
  {
    id: "low_hp_loop",
    path: SFX_HEARTBEAT_URL,
    bus: "sfx",
    priority: 6,
    volume: 0.34,
    throttleMs: 1000,
    loop: true,
    required: false,
    source: "generated"
  },
  {
    id: "insight",
    path: "procedural:insight",
    bus: "sfx",
    priority: 9,
    volume: 0.9,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  },
  {
    id: "skill_advance",
    path: "procedural:skill_advance",
    bus: "sfx",
    priority: 10,
    volume: 1,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  },
  {
    id: "elite_warning",
    path: SFX_PALM_BOOM_URL,
    bus: "sfx",
    priority: 7,
    volume: 0.72,
    throttleMs: 1000,
    required: true,
    source: "generated"
  },
  {
    id: "boss_intro",
    path: SFX_BOSS_ROAR_URL,
    bus: "sfx",
    priority: 10,
    volume: 0.92,
    throttleMs: 0,
    required: true,
    source: "generated"
  },
  {
    id: "boss_warning",
    path: "procedural:boss_warning",
    bus: "sfx",
    priority: 9,
    volume: 0.95,
    throttleMs: 500,
    required: true,
    source: "placeholder"
  },
  {
    id: "boss_hit",
    path: "procedural:boss_hit",
    bus: "sfx",
    priority: 4,
    volume: 0.58,
    throttleMs: 80,
    required: true,
    source: "placeholder"
  },
  {
    id: "boss_defeated",
    path: "procedural:boss_defeated",
    bus: "sfx",
    priority: 10,
    volume: 1,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  },
  {
    id: "result_open",
    path: "procedural:result_open",
    bus: "sfx",
    priority: 7,
    volume: 0.62,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  },
  {
    id: "scripture_reveal_common",
    path: SFX_REVEAL_COMMON_URL,
    bus: "sfx",
    priority: 6,
    volume: 0.58,
    throttleMs: 0,
    required: true,
    source: "generated"
  },
  {
    id: "scripture_reveal_rare",
    path: SFX_REVEAL_RARE_URL,
    bus: "sfx",
    priority: 7,
    volume: 0.72,
    throttleMs: 0,
    required: true,
    source: "generated"
  },
  {
    id: "scripture_reveal_epic",
    path: SFX_REVEAL_EPIC_URL,
    bus: "sfx",
    priority: 9,
    volume: 0.88,
    throttleMs: 0,
    required: true,
    source: "generated"
  }
];

export function countMissingRequiredAudioEvents(): number {
  return audioEvents.filter((item) => item.required && item.path.length === 0).length;
}

/**
 * QA-006：按地图 id 取关卡 BGM 事件 id（读 stageMapConfig.maps[].musicId）。
 * 防御性：未知 id 回默认地图；条目缺失/无 musicId 时回旧版 music_stage_qingshi，保证不崩。
 */
export function getStageMusicId(mapId: string): string {
  const entry =
    stageMapConfig.maps.find((map) => map.id === mapId) ??
    stageMapConfig.maps.find((map) => map.id === stageMapConfig.defaultMapId) ??
    stageMapConfig.maps[0];
  return entry?.musicId ?? "music_stage_qingshi";
}
