export type WaveDirectorState = "warmup" | "build" | "pressure" | "elite_warning" | "elite_active" | "boss_pre" | "boss_active";

export type WaveSegment = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  state: Exclude<WaveDirectorState, "elite_warning" | "elite_active">;
  targetAliveMin: number;
  targetAliveMax: number;
  aliveCap: number;
  spawnIntervalMs: number;
  // Normal enemies only. Elites use separate timing/state rules.
  composition: {
    bandit_grunt: number;
    hound: number;
    shield_bandit: number;
  };
};

export type EnemyDirectorConfig = {
  id: string;
  spawnOutsideMinPx: number;
  spawnOutsideMaxPx: number;
  minSpawnDistanceFromHeroPx: number;
  despawnDistanceFromHeroPx: number;
  maxSpawnsPerFrame: number;
  heroCollisionRadiusPx: number;
  mobileAliveCap: number;
  lowVfxAliveCap: number;
  firstEliteSeconds: number;
  eliteWarningSeconds: number;
  eliteRespawnMinSeconds: number;
  eliteRespawnMaxSeconds: number;
  maxEliteAlive: number;
  bossRequestSeconds: number;
  segments: WaveSegment[];
};

export const combat001DirectorConfig: EnemyDirectorConfig = {
  id: "wave_001_qingshi_mountain_road",
  spawnOutsideMinPx: 120,
  spawnOutsideMaxPx: 260,
  minSpawnDistanceFromHeroPx: 220,
  despawnDistanceFromHeroPx: 1400,
  maxSpawnsPerFrame: 8,
  heroCollisionRadiusPx: 18,
  mobileAliveCap: 120,
  lowVfxAliveCap: 90,
  firstEliteSeconds: 180,
  eliteWarningSeconds: 1.2,
  eliteRespawnMinSeconds: 45,
  eliteRespawnMaxSeconds: 60,
  maxEliteAlive: 1,
  bossRequestSeconds: 360,
  segments: [
    {
      id: "wave_001_000_010",
      startSeconds: 0,
      endSeconds: 10,
      state: "warmup",
      targetAliveMin: 0,
      targetAliveMax: 5,
      aliveCap: 8,
      spawnIntervalMs: 850,
      composition: { bandit_grunt: 1, hound: 0, shield_bandit: 0 }
    },
    {
      id: "wave_001_010_030",
      startSeconds: 10,
      endSeconds: 30,
      state: "warmup",
      targetAliveMin: 5,
      targetAliveMax: 10,
      aliveCap: 16,
      spawnIntervalMs: 700,
      composition: { bandit_grunt: 1, hound: 0, shield_bandit: 0 }
    },
    {
      id: "wave_001_030_060",
      startSeconds: 30,
      endSeconds: 60,
      state: "build",
      targetAliveMin: 10,
      targetAliveMax: 16,
      aliveCap: 24,
      spawnIntervalMs: 650,
      composition: { bandit_grunt: 0.85, hound: 0.15, shield_bandit: 0 }
    },
    {
      id: "wave_001_060_120",
      startSeconds: 60,
      endSeconds: 120,
      state: "build",
      targetAliveMin: 35,
      targetAliveMax: 55,
      aliveCap: 70,
      spawnIntervalMs: 360,
      composition: { bandit_grunt: 0.65, hound: 0.35, shield_bandit: 0 }
    },
    {
      id: "wave_001_120_180",
      startSeconds: 120,
      endSeconds: 180,
      state: "pressure",
      targetAliveMin: 55,
      targetAliveMax: 80,
      aliveCap: 95,
      spawnIntervalMs: 320,
      composition: { bandit_grunt: 0.55, hound: 0.3, shield_bandit: 0.15 }
    },
    {
      id: "wave_001_180_240",
      startSeconds: 180,
      endSeconds: 240,
      state: "pressure",
      targetAliveMin: 80,
      targetAliveMax: 110,
      aliveCap: 125,
      spawnIntervalMs: 280,
      composition: { bandit_grunt: 0.5, hound: 0.3, shield_bandit: 0.2 }
    },
    {
      id: "wave_001_240_300",
      startSeconds: 240,
      endSeconds: 300,
      state: "pressure",
      targetAliveMin: 100,
      targetAliveMax: 135,
      aliveCap: 155,
      spawnIntervalMs: 240,
      composition: { bandit_grunt: 0.45, hound: 0.35, shield_bandit: 0.2 }
    },
    {
      id: "wave_001_300_360",
      startSeconds: 300,
      endSeconds: 360,
      state: "boss_pre",
      targetAliveMin: 120,
      targetAliveMax: 160,
      aliveCap: 180,
      spawnIntervalMs: 220,
      composition: { bandit_grunt: 0.45, hound: 0.3, shield_bandit: 0.25 }
    },
    {
      id: "wave_001_360_480",
      startSeconds: 360,
      endSeconds: 480,
      state: "boss_active",
      targetAliveMin: 70,
      targetAliveMax: 120,
      aliveCap: 125,
      spawnIntervalMs: 420,
      composition: { bandit_grunt: 0.55, hound: 0.25, shield_bandit: 0.2 }
    }
  ]
};
