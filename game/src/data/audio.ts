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

export const audioEvents: AudioEventConfig[] = [
  {
    id: "music_menu",
    path: "",
    bus: "music",
    priority: 1,
    volume: 0.35,
    throttleMs: 0,
    loop: true,
    required: false,
    source: "generated"
  },
  {
    id: "music_stage_qingshi",
    path: "",
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
    path: "procedural:skill_cast",
    bus: "sfx",
    priority: 2,
    volume: 0.32,
    throttleMs: 100,
    required: true,
    source: "placeholder"
  },
  {
    id: "skill_cast_advanced",
    path: "procedural:skill_cast_advanced",
    bus: "sfx",
    priority: 3,
    volume: 0.42,
    throttleMs: 120,
    required: true,
    source: "placeholder"
  },
  {
    id: "hit_light",
    path: "procedural:hit_light",
    bus: "sfx",
    priority: 2,
    volume: 0.45,
    throttleMs: 80,
    required: true,
    source: "placeholder"
  },
  {
    id: "enemy_die",
    path: "procedural:enemy_die",
    bus: "sfx",
    priority: 3,
    volume: 0.55,
    throttleMs: 60,
    mergeWindowMs: 60,
    required: true,
    source: "placeholder"
  },
  {
    id: "inner_power_pickup",
    path: "procedural:inner_power_pickup",
    bus: "sfx",
    priority: 3,
    volume: 0.5,
    throttleMs: 50,
    mergeWindowMs: 50,
    required: true,
    source: "placeholder"
  },
  {
    id: "heal_pickup",
    path: "procedural:heal_pickup",
    bus: "sfx",
    priority: 3,
    volume: 0.5,
    throttleMs: 80,
    required: true,
    source: "placeholder"
  },
  {
    id: "copper_gain",
    path: "procedural:copper_gain",
    bus: "sfx",
    priority: 3,
    volume: 0.5,
    throttleMs: 100,
    required: true,
    source: "placeholder"
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
    path: "",
    bus: "sfx",
    priority: 6,
    volume: 0.34,
    throttleMs: 1000,
    loop: true,
    required: false,
    source: "placeholder"
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
    path: "procedural:elite_warning",
    bus: "sfx",
    priority: 7,
    volume: 0.72,
    throttleMs: 1000,
    required: true,
    source: "placeholder"
  },
  {
    id: "boss_intro",
    path: "procedural:boss_intro",
    bus: "sfx",
    priority: 10,
    volume: 0.92,
    throttleMs: 0,
    required: true,
    source: "placeholder"
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
    path: "procedural:scripture_reveal_common",
    bus: "sfx",
    priority: 6,
    volume: 0.58,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  },
  {
    id: "scripture_reveal_rare",
    path: "procedural:scripture_reveal_rare",
    bus: "sfx",
    priority: 7,
    volume: 0.72,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  },
  {
    id: "scripture_reveal_epic",
    path: "procedural:scripture_reveal_epic",
    bus: "sfx",
    priority: 9,
    volume: 0.88,
    throttleMs: 0,
    required: true,
    source: "placeholder"
  }
];

export function countMissingRequiredAudioEvents(): number {
  return audioEvents.filter((item) => item.required && item.path.length === 0).length;
}
