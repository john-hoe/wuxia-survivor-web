export type ScreenState =
  | "menu"
  | "game"
  | "insight"
  | "pause"
  | "settings"
  | "death_transition"
  | "result"
  | "scripture";

export type GameEventName =
  | "config_loaded"
  | "screen_changed"
  | "menu_start_clicked"
  | "hud_updated"
  | "hero_spawned"
  | "hero_moved"
  | "hero_damaged"
  | "hero_invincible_started"
  | "hero_invincible_ended"
  | "hero_low_hp_started"
  | "hero_healed"
  | "hero_died"
  | "origin_rebased"
  | "wave_state_changed"
  | "enemy_elite_warning_started"
  | "enemy_spawned"
  | "enemy_damaged"
  | "enemy_knockbacked"
  | "enemy_slow_requested"
  | "enemy_slowed"
  | "enemy_killed"
  | "enemy_contact_damage"
  | "enemy_despawned"
  | "boss_spawn_requested"
  | "boss_intro_started"
  | "boss_spawned"
  | "boss_attack_warning"
  | "boss_attack_started"
  | "boss_attack_hit"
  | "boss_damaged"
  | "boss_defeated"
  | "stage_cleared"
  | "skill_unlocked"
  | "skill_cast"
  | "skill_zone_spawned"
  | "skill_zone_expired"
  | "skill_hit"
  | "skill_level_changed"
  | "skill_advance_key_collected"
  | "skill_advanced"
  | "skill_cooldown_ready"
  | "inner_power_gem_spawned"
  | "inner_power_gem_collected"
  | "inner_power_changed"
  | "insight_ready"
  | "insight_opened"
  | "insight_option_selected"
  | "insight_applied"
  | "pause_opened"
  | "pause_closed"
  | "settings_changed"
  | "audio_event_played"
  | "audio_event_suppressed"
  | "insight_started"
  | "death_transition_started"
  | "result_screen_opened"
  | "run_result_calculated"
  | "copper_gained"
  | "meta_upgrade_purchased"
  | "save_written"
  | "scripture_screen_opened"
  | "scripture_pull_started"
  | "scripture_pull_result"
  | "scripture_pity_triggered"
  | "scripture_result_confirmed";

export type EventHistoryEntry = {
  sequence: number;
  name: GameEventName;
  payload: unknown;
  timestampMs: number;
};

export type RunResultKind = "dead" | "win" | "debug";

export type RunSummary = {
  runId: string;
  result: RunResultKind;
  survivalSeconds: number;
  kills: number;
  level: number;
  copperEarned: number;
  bossDefeated: boolean;
  /** 被击败的 Boss id（胜利时携带，用于按实际 Boss 配置结算奖励）。 */
  bossId?: string;
  deathCause?: string;
};

export type GameSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  lowVfxMode: boolean;
  /** 伤害飘字开关（方案五·反馈密度分级，仅表现层） */
  damageNumbers: boolean;
  /** 震屏强度：0 无 / 0.5 弱 / 1 标准（仅表现层） */
  shakeScale: number;
};

export type SaveData = {
  schemaVersion: 1;
  copper: number;
  bestTimeSeconds: number;
  bestKills: number;
  bestLevel: number;
  bossDefeated: boolean;
  /** 菜单选关记住的地图 id（"qingshi_mountain_road" | "maple_official_road"；缺省/非法 = 青石山道）。 */
  lastMapId?: string;
  metaUpgrades: {
    max_hp: number;
    move_speed: number;
    pickup_radius: number;
  };
  scriptureGacha: {
    starter_scripture_pool: {
      pulls: number;
      pityCounter: number;
    };
  };
  collection: {
    skins: string[];
    titles: string[];
    fragments: Record<string, number>;
  };
  settings: GameSettings;
};

export type ConfigLoadStatus = "not_loaded" | "loaded" | "error";

export type StageConfig = {
  id: string;
  displayName: string;
  targetDurationSeconds: number;
  bossSpawnSeconds: number;
  backgroundChunkSizePx: number;
  loadedChunkCount: number;
  qualityScale: number;
};

export type DebugConfig = {
  eventHistoryLimit: number;
  debugPanelDefaultVisible: boolean;
};

export type ManifestStats = {
  total: number;
  required: number;
  missingRequired: number;
};

export type GameConfigBundle = {
  stage: StageConfig;
  debug: DebugConfig;
  art: ManifestStats;
  audio: ManifestStats;
  loadedConfigIds: string[];
};

export type ConfigLoadResult = {
  status: ConfigLoadStatus;
  loadedAtMs: number;
  config: GameConfigBundle;
  errors: string[];
};

export type DebugSnapshot = {
  fps: number;
  scene: string;
  screenState: ScreenState;
  heroX: number;
  heroY: number;
  heroHp: number;
  heroMaxHp: number;
  heroLevel: number;
  heroSpeed: number;
  heroVelocityX: number;
  heroVelocityY: number;
  heroVelocityMagnitude: number;
  inputX: number;
  inputY: number;
  inputMagnitude: number;
  inputSource: string;
  innerPower: string;
  nextRequired: number;
  pickupRadius: number;
  insightCount: number;
  lastInsightAt: number;
  pendingInsight: boolean;
  invincibleMs: number;
  isLowHp: boolean;
  lastDamageSource: string;
  footHpBarVisible: boolean;
  hudSafeRadiusPx: number;
  originRebaseCount: number;
  enemiesAlive: number;
  enemiesAliveByType: Record<string, number>;
  targetAlive: number;
  targetAliveMin: number;
  rawTargetAliveMin: number;
  rawTargetAliveMax: number;
  aliveCap: number;
  rawAliveCap: number;
  platformClamp: string;
  spawnIntervalMs: number;
  lastSpawnSide: string;
  sameSpawnSideStreak: number;
  lastSpawnDistanceFromHero: number;
  minSpawnDistanceLast30s: number;
  despawnCountLast10s: number;
  eliteAlive: number;
  nextEliteSeconds: number;
  bossRequestEmitted: boolean;
  skills: string;
  orbitalsAlive: number;
  skillHitsLast10s: number;
  skillDpsLast10s: number;
  advancedSkills: string;
  projectilesAlive: number;
  gemsAlive: number;
  activeVfx: number;
  audioVoices: number;
  waveTimeSeconds: number;
  directorState: string;
  bossState: string;
  bossHp: number;
  bossHpPercent: number;
  currentAttack: string;
  nextChargeSeconds: number;
  nextWhirlwindSeconds: number;
  lastWarningDuration: number;
  lastAttackDamage: number;
  bossAliveSeconds: number;
  bossHitCount: number;
  bossAttacksUsed: string;
  stageCleared: boolean;
  stageId: string;
  loadedChunkCount: number;
  qualityScale: number;
  missingRequiredAssets: number;
  missingRequiredAudioEvents: number;
  saveStatus: string;
  configStatus: ConfigLoadStatus;
  loadedConfigIds: string;
  loadedConfigCount: number;
  eventHistoryCount: number;
  lastEventName: string;
};
