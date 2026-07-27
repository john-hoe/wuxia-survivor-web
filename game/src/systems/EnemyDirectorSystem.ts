import Phaser from "phaser";
import { combat001DirectorConfig, type EnemyDirectorConfig, type WaveDirectorState, type WaveSegment } from "../data/waves";
import { enemyConfigs, type EnemyConfig, type EnemyId } from "../data/enemies";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";
import { JuiceSystem } from "./JuiceSystem";

type Point = {
  x: number;
  y: number;
};

type SpawnSide = "left" | "right" | "bottom" | "top" | "corner";

type SpawnPoint = Point & {
  side: SpawnSide;
};

type NormalEnemyId = Exclude<EnemyId, "wooden_dummy_elite">;

type ResolvedWaveSegment = WaveSegment & {
  rawTargetAliveMin: number;
  rawTargetAliveMax: number;
  rawAliveCap: number;
  platformClamp: "desktop" | "mobile" | "low_vfx";
};

export type EnemyContactDamageResult = {
  damaged: boolean;
  died: boolean;
  ignoredByInvincible: boolean;
};

export type EnemyDirectorSnapshot = {
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
  directorState: string;
};

export type EnemyTargetSnapshot = {
  runtimeId: number;
  enemyId: EnemyId;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  hp: number;
  maxHp: number;
  collisionRadius: number;
};

export type EnemyDamageResult = {
  damaged: boolean;
  killed: boolean;
  runtimeId: number;
  enemyId: EnemyId;
  amount: number;
  hp: number;
  maxHp: number;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
};

type EnemyRuntime = {
  runtimeId: number;
  config: EnemyConfig;
  hp: number;
  worldX: number;
  worldY: number;
  directionX: number;
  directionY: number;
  directionRefreshMs: number;
  knockbackVelocityX: number;
  knockbackVelocityY: number;
  knockbackMsRemaining: number;
  offscreenMs: number;
  hitSquashMs: number;
  /** 受击击退表现层位移偏移（屏幕像素，不进世界坐标，阻尼余弦弹性回位） */
  hitOffsetX: number;
  hitOffsetY: number;
  hitOffsetAgeMs: number;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  /**
   * 墨染江山·最小减速通道（本字段为 zone 技能新增的唯一状态）：
   * slowFactor 移速倍率（1 = 无减速），slowMsRemaining 剩余减速时长，
   * 计时自然到期即恢复，领域消失后不再续期即自动清除。
   * 写入入口：eventBus "enemy_slow_requested"（SkillSystem 桥接，GameScene 零改动）。
   */
  slowFactor: number;
  slowMsRemaining: number;
};

type EliteWarningRuntime = {
  worldX: number;
  worldY: number;
  side: SpawnSide;
  spawnSeconds: number;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
};

type SpawnDistanceSample = {
  ageMs: number;
  distance: number;
};

type DespawnSample = {
  ageMs: number;
};

type EnemyDirectorOptions = {
  getElapsedSeconds: () => number;
  getHeroWorld: () => Point;
  getHeroScreen: () => Point;
  getHeroVelocity?: () => Point;
  damageHero: (amount: number, source: string) => EnemyContactDamageResult | undefined;
  getLowVfxMode?: () => boolean;
  config?: EnemyDirectorConfig;
};

const KNOCKBACK_DURATION_MS = 180;
const KNOCKBACK_CHASE_DAMPING = 0;
/** 受击白闪时长与 squash 回弹时长（表现层，不影响数值） */
const HIT_FLASH_MS = 80;
const HIT_SQUASH_MS = 60;
const ELITE_HIT_TINT = 0xf6d472;
const NORMAL_HIT_TINT = 0xffffff;
const DEATH_TWEEN_MS = 200;
/** 受击击退分级（纯表现层）：普通小怪 12-18px 沿弹道方向击退，精英 4-6px 原地抖动，Boss 无位移仅闪白 */
const HIT_KNOCKBACK_NORMAL_MIN_PX = 12;
const HIT_KNOCKBACK_NORMAL_MAX_PX = 18;
const HIT_KNOCKBACK_ELITE_MIN_PX = 4;
const HIT_KNOCKBACK_ELITE_MAX_PX = 6;
/** 偏移回位曲线：阻尼余弦 exp(-t/τ)·cos(ωt)，约 60ms 出现小幅过冲、160ms 内完全回稳 */
const HIT_OFFSET_DECAY_MS = 30;
const HIT_OFFSET_OSCILLATION_MS = 90;
const HIT_OFFSET_SETTLE_MS = 160;

export class EnemyDirectorSystem {
  private readonly config: EnemyDirectorConfig;
  private readonly enemies: EnemyRuntime[] = [];
  private readonly spawnDistanceSamples: SpawnDistanceSample[] = [];
  private readonly despawnSamples: DespawnSample[] = [];
  private spawnAccumulatorMs = 0;
  private nextRuntimeId = 1;
  private lastSpawnDistanceFromHero = 0;
  private currentState: WaveDirectorState = "warmup";
  private bossRequestEmitted = false;
  private nextEliteSpawnSeconds = 0;
  private eliteWarning?: EliteWarningRuntime;
  private readonly initialViewportClamp: "desktop" | "mobile";
  private lastSpawnSide: SpawnSide | "none" = "none";
  private sameSpawnSideStreak = 0;
  private readonly spawnedEnemyIds = new Set<EnemyId>();
  /** 减速请求事件退订函数（enemy_slow_requested → applySlow 桥接） */
  private readonly unsubscribeSlowRequest: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly options: EnemyDirectorOptions) {
    this.config = options.config ?? combat001DirectorConfig;
    this.nextEliteSpawnSeconds = this.config.firstEliteSeconds;
    this.initialViewportClamp = window.innerWidth <= 768 ? "mobile" : "desktop";
    this.unsubscribeSlowRequest = eventBus.on("enemy_slow_requested", (payload) => {
      this.handleSlowRequest(payload);
    });
    eventBus.emit("wave_state_changed", {
      state: this.currentState,
      waveTimeSeconds: options.getElapsedSeconds()
    });
  }

  update(deltaMs: number): EnemyDirectorSnapshot {
    const clampedDeltaMs = Math.min(deltaMs, 100);
    const elapsedSeconds = this.options.getElapsedSeconds();
    const segment = this.resolveSegment(this.getSegment(elapsedSeconds));
    this.emitBossRequestIfNeeded(elapsedSeconds);
    this.ageRollingSamples(clampedDeltaMs);
    this.updateEnemies(clampedDeltaMs);
    this.updateEliteSchedule(elapsedSeconds, segment);
    this.updateState(this.getRuntimeState(segment), elapsedSeconds);
    this.spawnAccumulatorMs += clampedDeltaMs;
    this.spawnTowardTarget(segment);
    return this.getSnapshot(segment);
  }

  getSnapshot(segment = this.resolveSegment(this.getSegment(this.options.getElapsedSeconds()))): EnemyDirectorSnapshot {
    return {
      enemiesAlive: this.enemies.length,
      enemiesAliveByType: this.countEnemiesByType(),
      targetAlive: segment.targetAliveMax,
      targetAliveMin: segment.targetAliveMin,
      rawTargetAliveMin: segment.rawTargetAliveMin,
      rawTargetAliveMax: segment.rawTargetAliveMax,
      aliveCap: segment.aliveCap,
      rawAliveCap: segment.rawAliveCap,
      platformClamp: segment.platformClamp,
      spawnIntervalMs: segment.spawnIntervalMs,
      lastSpawnSide: this.lastSpawnSide,
      sameSpawnSideStreak: this.sameSpawnSideStreak,
      lastSpawnDistanceFromHero: roundForDebug(this.lastSpawnDistanceFromHero),
      minSpawnDistanceLast30s: roundForDebug(this.getMinSpawnDistanceLast30s()),
      despawnCountLast10s: this.despawnSamples.length,
      eliteAlive: this.getEliteAlive(),
      nextEliteSeconds: roundForDebug(Math.max(0, this.nextEliteSpawnSeconds - this.options.getElapsedSeconds())),
      bossRequestEmitted: this.bossRequestEmitted,
      directorState: this.currentState
    };
  }

  destroy(): void {
    this.unsubscribeSlowRequest();
    for (const enemy of this.enemies) {
      enemy.view.destroy();
    }
    this.clearEliteWarning();
    this.enemies.length = 0;
    this.spawnDistanceSamples.length = 0;
    this.despawnSamples.length = 0;
  }

  getTargets(): EnemyTargetSnapshot[] {
    return this.enemies.map((enemy) => this.createTargetSnapshot(enemy));
  }

  debugSpawnShowcase(): void {
    const heroWorld = this.options.getHeroWorld();
    const segment = this.resolveSegment(this.getSegment(this.options.getElapsedSeconds()));
    const compact = window.innerWidth <= 760;
    const placements: Array<{ enemyId: EnemyId; x: number; y: number }> = compact
      ? [
          { enemyId: "wooden_dummy_elite", x: -250, y: -30 },
          { enemyId: "shield_bandit", x: 250, y: -30 },
          { enemyId: "hound", x: -170, y: -150 },
          { enemyId: "bandit_grunt", x: 170, y: -150 }
        ]
      : [
          { enemyId: "wooden_dummy_elite", x: -270, y: -65 },
          { enemyId: "shield_bandit", x: 270, y: -65 },
          { enemyId: "hound", x: -150, y: -190 },
          { enemyId: "bandit_grunt", x: 150, y: -190 }
        ];

    for (const placement of placements) {
      this.spawnEnemy(placement.enemyId, segment, {
        x: heroWorld.x + placement.x,
        y: heroWorld.y + placement.y,
        side: "corner"
      });
    }
  }

  debugShowEliteWarningForShowcase(): void {
    this.clearEliteWarning();
    const heroWorld = this.options.getHeroWorld();
    const elapsedSeconds = this.options.getElapsedSeconds();
    const spawn = {
      x: heroWorld.x + (window.innerWidth <= 760 ? 210 : 250),
      y: heroWorld.y - 96,
      side: "corner" as const
    };
    this.eliteWarning = this.createEliteWarning(spawn, elapsedSeconds + 2);
    playSfxSafely(this.scene, "elite_warning");
    eventBus.emit("enemy_elite_warning_started", {
      enemyId: "wooden_dummy_elite",
      warningSeconds: 2,
      spawnSeconds: elapsedSeconds + 2,
      worldX: roundForDebug(spawn.x),
      worldY: roundForDebug(spawn.y),
      debugShowcase: true
    });
  }

  damageEnemy(runtimeId: number, amount: number, source: string): EnemyDamageResult | undefined {
    const index = this.enemies.findIndex((enemy) => enemy.runtimeId === runtimeId);
    if (index < 0) {
      return undefined;
    }

    const enemy = this.enemies[index];
    const damageAmount = Math.max(0, Math.floor(amount));
    if (damageAmount <= 0) {
      return undefined;
    }

    enemy.hp = Math.max(0, enemy.hp - damageAmount);
    const result = this.createDamageResult(enemy, damageAmount);
    eventBus.emit("enemy_damaged", {
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      source,
      amount: damageAmount,
      hp: enemy.hp,
      maxHp: enemy.config.maxHp
    });

    if (enemy.hp <= 0) {
      this.killEnemy(index, source, result);
      return { ...result, killed: true, hp: 0 };
    }

    this.flashEnemyHit(enemy);
    this.applyHitKnockback(enemy);
    return result;
  }

  knockbackEnemy(runtimeId: number, originWorld: Point, distance: number, source: string): boolean {
    const enemy = this.enemies.find((candidate) => candidate.runtimeId === runtimeId);
    if (!enemy || distance <= 0) {
      return false;
    }

    const awayX = enemy.worldX - originWorld.x;
    const awayY = enemy.worldY - originWorld.y;
    const length = Math.hypot(awayX, awayY);
    const directionX = length > 0 ? awayX / length : (enemy.directionX !== 0 ? -enemy.directionX : 1);
    const directionY = length > 0 ? awayY / length : (enemy.directionY !== 0 ? -enemy.directionY : 0);
    const targetWorldX = enemy.worldX + directionX * distance;
    const targetWorldY = enemy.worldY + directionY * distance;
    const initialVelocity = (2 * distance) / (KNOCKBACK_DURATION_MS / 1000);
    enemy.knockbackVelocityX = directionX * initialVelocity;
    enemy.knockbackVelocityY = directionY * initialVelocity;
    enemy.knockbackMsRemaining = KNOCKBACK_DURATION_MS;
    enemy.directionRefreshMs = 0;
    this.updateEnemyScreenPosition(enemy);
    eventBus.emit("enemy_knockbacked", {
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      source,
      distance: roundForDebug(distance),
      durationMs: KNOCKBACK_DURATION_MS,
      worldX: roundForDebug(enemy.worldX),
      worldY: roundForDebug(enemy.worldY),
      targetWorldX: roundForDebug(targetWorldX),
      targetWorldY: roundForDebug(targetWorldY)
    });
    return true;
  }

  /**
   * 墨染江山减速入口（最小通道）：对单个敌人写入临时减速状态。
   * 已处于减速中时取更强减速倍率与更长剩余时长；计时到期在 updateEnemies 中自动恢复。
   */
  applySlow(runtimeId: number, factor: number, durationMs: number): boolean {
    const enemy = this.enemies.find((candidate) => candidate.runtimeId === runtimeId);
    if (!enemy || durationMs <= 0) {
      return false;
    }

    const clampedFactor = Phaser.Math.Clamp(factor, 0.1, 1);
    enemy.slowFactor = enemy.slowMsRemaining > 0 ? Math.min(enemy.slowFactor, clampedFactor) : clampedFactor;
    enemy.slowMsRemaining = Math.max(enemy.slowMsRemaining, durationMs);
    eventBus.emit("enemy_slowed", {
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      factor: roundForDebug(enemy.slowFactor),
      durationMs: roundForDebug(enemy.slowMsRemaining)
    });
    return true;
  }

  /** eventBus "enemy_slow_requested" 桥接：防御性解析负载后转发 applySlow。 */
  private handleSlowRequest(payload: unknown): void {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const request = payload as { runtimeId?: unknown; factor?: unknown; durationMs?: unknown };
    if (typeof request.runtimeId !== "number" || !Number.isFinite(request.runtimeId)) {
      return;
    }
    const factor = typeof request.factor === "number" && Number.isFinite(request.factor) ? request.factor : 1;
    const durationMs = typeof request.durationMs === "number" && Number.isFinite(request.durationMs)
      ? request.durationMs
      : 0;
    this.applySlow(request.runtimeId, factor, durationMs);
  }

  private spawnTowardTarget(segment: ResolvedWaveSegment): void {
    if (this.enemies.length >= segment.aliveCap) {
      // Keep one interval buffered so dropping below cap trickles spawns instead of bursting.
      this.spawnAccumulatorMs = Math.min(this.spawnAccumulatorMs, segment.spawnIntervalMs);
      return;
    }

    if (this.spawnAccumulatorMs < segment.spawnIntervalMs) {
      return;
    }

    const targetAlive = segment.targetAliveMax;
    const missing = Math.max(0, Math.min(targetAlive, segment.aliveCap) - this.enemies.length);
    const spawnBatches = Math.min(
      this.config.maxSpawnsPerFrame,
      missing,
      Math.floor(this.spawnAccumulatorMs / segment.spawnIntervalMs)
    );

    if (spawnBatches <= 0) {
      this.spawnAccumulatorMs = Math.min(this.spawnAccumulatorMs, segment.spawnIntervalMs);
      return;
    }

    for (let index = 0; index < spawnBatches; index += 1) {
      const enemyId = this.pickNormalEnemyId(segment);
      if (!enemyId) {
        break;
      }
      this.spawnEnemy(enemyId, segment);
      this.spawnAccumulatorMs -= segment.spawnIntervalMs;
    }
  }

  private pickNormalEnemyId(segment: ResolvedWaveSegment): NormalEnemyId | undefined {
    const elapsedSeconds = this.options.getElapsedSeconds();
    const counts = this.countEnemiesByType();
    const candidates: Array<{ id: NormalEnemyId; weight: number }> = [];
    for (const [enemyId, weight] of Object.entries(segment.composition) as Array<[NormalEnemyId, number]>) {
      const config = enemyConfigs[enemyId];
      if (weight <= 0 || elapsedSeconds < config.spawnAfterSeconds) {
        continue;
      }

      const aliveForType = counts[enemyId] ?? 0;
      const typeCap = Math.max(1, Math.floor(segment.aliveCap * config.maxAliveShare));
      if (aliveForType >= typeCap) {
        continue;
      }

      candidates.push({ id: enemyId, weight });
    }

    if (candidates.length === 0) {
      return elapsedSeconds >= enemyConfigs.bandit_grunt.spawnAfterSeconds ? "bandit_grunt" : undefined;
    }

    const newlyUnlocked = candidates.find((candidate) => (
      candidate.id !== "bandit_grunt" && !this.spawnedEnemyIds.has(candidate.id)
    ));
    if (newlyUnlocked) {
      return newlyUnlocked.id;
    }

    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const candidate of candidates) {
      roll -= candidate.weight;
      if (roll <= 0) {
        return candidate.id;
      }
    }
    return candidates[candidates.length - 1].id;
  }

  private spawnEnemy(enemyId: EnemyId, segment: ResolvedWaveSegment, spawnOverride?: SpawnPoint): void {
    const config = enemyConfigs[enemyId];
    const heroWorld = this.options.getHeroWorld();
    const spawn = spawnOverride ?? this.pickSpawnPoint(heroWorld);
    const view = this.createEnemyFallback(config);
    const enemy: EnemyRuntime = {
      runtimeId: this.nextRuntimeId,
      config,
      hp: config.maxHp,
      worldX: spawn.x,
      worldY: spawn.y,
      directionX: 0,
      directionY: 0,
      directionRefreshMs: 0,
      knockbackVelocityX: 0,
      knockbackVelocityY: 0,
      knockbackMsRemaining: 0,
      offscreenMs: 0,
      hitSquashMs: 0,
      hitOffsetX: 0,
      hitOffsetY: 0,
      hitOffsetAgeMs: HIT_OFFSET_SETTLE_MS,
      slowFactor: 1,
      slowMsRemaining: 0,
      view
    };
    this.nextRuntimeId += 1;
    this.enemies.push(enemy);
    this.spawnedEnemyIds.add(config.id);
    this.updateEnemyScreenPosition(enemy);
    this.lastSpawnDistanceFromHero = Math.hypot(spawn.x - heroWorld.x, spawn.y - heroWorld.y);
    this.recordSpawnSide(spawn.side);
    this.spawnDistanceSamples.push({ ageMs: 0, distance: this.lastSpawnDistanceFromHero });
    eventBus.emit("enemy_spawned", {
      runtimeId: enemy.runtimeId,
      enemyId: config.id,
      displayName: config.displayName,
      tier: config.tier,
      role: config.role,
      segmentId: segment.id,
      worldX: roundForDebug(enemy.worldX),
      worldY: roundForDebug(enemy.worldY),
      screenX: roundForDebug(enemy.view.x),
      screenY: roundForDebug(enemy.view.y),
      distanceFromHero: roundForDebug(this.lastSpawnDistanceFromHero)
    });
  }

  private updateEnemies(deltaMs: number): void {
    const heroWorld = this.options.getHeroWorld();
    const deltaSeconds = deltaMs / 1000;

    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      const distanceFromHero = Math.hypot(enemy.worldX - heroWorld.x, enemy.worldY - heroWorld.y);
      const despawnReason = this.getDespawnReason(enemy, distanceFromHero, deltaMs);
      if (despawnReason) {
        this.despawnEnemy(index, despawnReason, distanceFromHero);
        continue;
      }

      enemy.directionRefreshMs -= deltaMs;
      if (enemy.directionRefreshMs <= 0) {
        const toHeroX = heroWorld.x - enemy.worldX;
        const toHeroY = heroWorld.y - enemy.worldY;
        const length = Math.hypot(toHeroX, toHeroY);
        enemy.directionX = length > 0 ? toHeroX / length : 0;
        enemy.directionY = length > 0 ? toHeroY / length : 0;
        enemy.directionRefreshMs = 100;
      }

      enemy.slowMsRemaining = Math.max(0, enemy.slowMsRemaining - deltaMs);
      if (enemy.slowMsRemaining <= 0) {
        enemy.slowFactor = 1;
      }
      const chaseScale = (enemy.knockbackMsRemaining > 0 ? KNOCKBACK_CHASE_DAMPING : 1) * enemy.slowFactor;
      enemy.worldX += enemy.directionX * enemy.config.moveSpeed * chaseScale * deltaSeconds;
      enemy.worldY += enemy.directionY * enemy.config.moveSpeed * chaseScale * deltaSeconds;
      enemy.hitSquashMs = Math.max(0, enemy.hitSquashMs - deltaMs);
      enemy.hitOffsetAgeMs = Math.min(HIT_OFFSET_SETTLE_MS, enemy.hitOffsetAgeMs + deltaMs);
      this.applyKnockbackMotion(enemy, deltaMs);
      this.updateEnemyScreenPosition(enemy);
      this.updateEnemyFallbackAnimation(enemy, deltaMs);
      this.applyContactDamageIfNeeded(enemy);
    }
  }

  private applyKnockbackMotion(enemy: EnemyRuntime, deltaMs: number): void {
    if (enemy.knockbackMsRemaining <= 0) {
      return;
    }

    const elapsedMs = Math.min(deltaMs, enemy.knockbackMsRemaining);
    const remainingBefore = enemy.knockbackMsRemaining;
    const remainingAfter = Math.max(0, remainingBefore - elapsedMs);
    const averageFalloff = ((remainingBefore + remainingAfter) / 2) / KNOCKBACK_DURATION_MS;
    const elapsedSeconds = elapsedMs / 1000;
    enemy.worldX += enemy.knockbackVelocityX * averageFalloff * elapsedSeconds;
    enemy.worldY += enemy.knockbackVelocityY * averageFalloff * elapsedSeconds;
    enemy.knockbackMsRemaining = remainingAfter;

    if (enemy.knockbackMsRemaining <= 0) {
      enemy.knockbackVelocityX = 0;
      enemy.knockbackVelocityY = 0;
    }
  }

  private applyContactDamageIfNeeded(enemy: EnemyRuntime): void {
    if (enemy.knockbackMsRemaining > 0) {
      return;
    }

    const heroWorld = this.options.getHeroWorld();
    const contactDistance = enemy.config.collisionRadius + this.config.heroCollisionRadiusPx;
    if (Math.hypot(enemy.worldX - heroWorld.x, enemy.worldY - heroWorld.y) > contactDistance) {
      return;
    }

    const result = this.options.damageHero(enemy.config.contactDamage, `${enemy.config.id}_contact`);
    if (!result?.damaged) {
      return;
    }

    eventBus.emit("enemy_contact_damage", {
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      amount: enemy.config.contactDamage,
      died: result.died
    });
  }

  private getDespawnReason(enemy: EnemyRuntime, distanceFromHero: number, deltaMs: number): string | undefined {
    if (enemy.config.tier !== "elite") {
      return distanceFromHero > this.config.despawnDistanceFromHeroPx ? "too_far" : undefined;
    }

    if (distanceFromHero <= 1700 || !this.isEnemyOffscreen(enemy, 96)) {
      enemy.offscreenMs = 0;
      return undefined;
    }

    enemy.offscreenMs += deltaMs;
    return enemy.offscreenMs >= 5000 ? "elite_too_far_offscreen" : undefined;
  }

  private isEnemyOffscreen(enemy: EnemyRuntime, margin: number): boolean {
    return (
      enemy.view.x < -margin ||
      enemy.view.x > this.scene.scale.width + margin ||
      enemy.view.y < -margin ||
      enemy.view.y > this.scene.scale.height + margin
    );
  }

  private despawnEnemy(index: number, reason: string, distanceFromHero: number): void {
    const [enemy] = this.enemies.splice(index, 1);
    enemy.view.destroy();
    this.despawnSamples.push({ ageMs: 0 });
    eventBus.emit("enemy_despawned", {
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      reason,
      distanceFromHero: roundForDebug(distanceFromHero)
    });
  }

  private killEnemy(index: number, source: string, result: EnemyDamageResult): void {
    const [enemy] = this.enemies.splice(index, 1);
    this.playEnemyDeathTween(enemy);
    const juice = JuiceSystem.get(this.scene);
    juice.killBurst(result.screenX, result.screenY, getKillBurstTint(enemy.config));
    if (enemy.config.tier === "elite") {
      juice.hitStop(80);
    }
    eventBus.emit("enemy_killed", {
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      source,
      scoreValue: enemy.config.scoreValue,
      worldX: roundForDebug(result.worldX),
      worldY: roundForDebug(result.worldY),
      screenX: roundForDebug(result.screenX),
      screenY: roundForDebug(result.screenY)
    });
  }

  /** 死亡 200ms 小动画：沿远离少侠方向击飞 30-50px + 压扁 + 渐隐，结束后销毁。 */
  private playEnemyDeathTween(enemy: EnemyRuntime): void {
    const view = enemy.view;
    const heroWorld = this.options.getHeroWorld();
    const awayX = enemy.worldX - heroWorld.x;
    const awayY = enemy.worldY - heroWorld.y;
    const length = Math.hypot(awayX, awayY);
    const dirX = length > 0 ? awayX / length : 1;
    const dirY = length > 0 ? awayY / length : 0;
    const distance = Phaser.Math.Between(30, 50);
    this.scene.tweens.killTweensOf(view);
    this.scene.tweens.add({
      targets: view,
      x: view.x + dirX * distance,
      y: view.y + dirY * distance,
      scaleY: view.scaleY * 0.2,
      alpha: 0,
      duration: DEATH_TWEEN_MS,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (view.active) {
          view.destroy();
        }
      }
    });
  }

  private pickSpawnPoint(heroWorld: Point): SpawnPoint {
    const heroScreen = this.options.getHeroScreen();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const margin = Phaser.Math.Between(this.config.spawnOutsideMinPx, this.config.spawnOutsideMaxPx);
      const spawn = this.createSpawnPointForSide(heroWorld, heroScreen, this.chooseSpawnSide(), margin);
      if (Math.hypot(spawn.x - heroWorld.x, spawn.y - heroWorld.y) >= this.config.minSpawnDistanceFromHeroPx) {
        return spawn;
      }
    }

    return this.pickFallbackSpawnPoint(heroWorld);
  }

  private pickFallbackSpawnPoint(heroWorld: Point): SpawnPoint {
    const heroScreen = this.options.getHeroScreen();
    const side = this.chooseSpawnSide();
    return this.createSpawnPointForSide(heroWorld, heroScreen, side, this.config.spawnOutsideMaxPx);
  }

  private createSpawnPointForSide(heroWorld: Point, heroScreen: Point, side: SpawnSide, margin: number): SpawnPoint {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const safeMinX = Math.min(96, width / 2);
    const safeMaxX = Math.max(safeMinX, width - safeMinX);
    let screenX = width + margin;
    let screenY = height / 2;

    if (side === "left") {
      screenX = Phaser.Math.Between(-margin, -this.config.spawnOutsideMinPx);
      screenY = Phaser.Math.Between(96, height - 96);
    } else if (side === "right") {
      screenX = Phaser.Math.Between(width + this.config.spawnOutsideMinPx, width + margin);
      screenY = Phaser.Math.Between(96, height - 96);
    } else if (side === "bottom") {
      screenX = Phaser.Math.Between(safeMinX, safeMaxX);
      screenY = Phaser.Math.Between(height + this.config.spawnOutsideMinPx, height + margin);
    } else if (side === "top") {
      screenX = Phaser.Math.Between(safeMinX, safeMaxX);
      screenY = Phaser.Math.Between(-margin, -this.config.spawnOutsideMinPx);
    } else {
      screenX = Phaser.Math.RND.pick([-margin, width + margin]);
      screenY = Phaser.Math.RND.pick([-margin, height + margin]);
    }

    return {
      side,
      x: heroWorld.x + screenX - heroScreen.x,
      y: heroWorld.y + screenY - heroScreen.y
    };
  }

  private chooseSpawnSide(): SpawnSide {
    const velocity = this.options.getHeroVelocity?.() ?? { x: 0, y: 0 };
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed < 20) {
      return this.pickWeightedSide([
        ["left", 1],
        ["right", 1],
        ["bottom", 1],
        ["top", 1]
      ]);
    }

    const front = Math.abs(velocity.x) >= Math.abs(velocity.y)
      ? velocity.x >= 0 ? "right" : "left"
      : velocity.y >= 0 ? "bottom" : "top";
    const rear = getOppositeSide(front);
    const sides = getPerpendicularSides(front);
    return this.pickWeightedSide([
      [front, 35],
      [sides[0], 20],
      [sides[1], 20],
      [rear, 20],
      ["corner", 5]
    ]);
  }

  private pickWeightedSide(weightedSides: Array<[SpawnSide, number]>): SpawnSide {
    const candidates = this.sameSpawnSideStreak >= 4
      ? weightedSides.filter(([side]) => side !== this.lastSpawnSide)
      : weightedSides;
    const totalWeight = candidates.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * totalWeight;
    for (const [side, weight] of candidates) {
      roll -= weight;
      if (roll <= 0) {
        return side;
      }
    }
    return candidates[candidates.length - 1][0];
  }

  private recordSpawnSide(side: SpawnSide): void {
    if (this.lastSpawnSide === side) {
      this.sameSpawnSideStreak += 1;
      return;
    }

    this.lastSpawnSide = side;
    this.sameSpawnSideStreak = 1;
  }

  private createEnemyFallback(config: EnemyConfig): Phaser.GameObjects.Container | Phaser.GameObjects.Sprite {
    if (this.scene.textures.exists(config.assetId)) {
      return this.createEnemySprite(config, this.getEnemySpriteScale(config), this.getEnemySpriteOriginY(config));
    }
    if (config.id === "hound") {
      return this.createHoundFallback(config);
    }
    if (config.id === "shield_bandit") {
      return this.createShieldBanditFallback(config);
    }
    if (config.id === "wooden_dummy_elite") {
      return this.createWoodenDummyFallback(config);
    }
    return this.createBanditFallback(config);
  }

  private createEnemySprite(config: EnemyConfig, baseScale: number, originY: number): Phaser.GameObjects.Sprite {
    const enemyView = this.scene.add.sprite(0, 0, config.assetId)
      .setDepth(config.tier === "elite" ? 9 : 8)
      .setOrigin(0.5, originY)
      .setScale(baseScale)
      .setAlpha(0.97);
    const animationKey = getArtAnimationKey(config.assetId);
    if (this.scene.anims.exists(animationKey)) {
      enemyView.play(animationKey);
    }
    enemyView.setData("enemyId", config.id);
    enemyView.setData("role", config.role);
    enemyView.setData("walkMs", Phaser.Math.Between(0, 800));
    enemyView.setData("spriteArt", true);
    enemyView.setData("animationKey", animationKey);
    enemyView.setData("baseScale", baseScale);
    return enemyView;
  }

  private getEnemySpriteScale(config: EnemyConfig): number {
    if (config.id === "hound") {
      return 0.72;
    }
    if (config.id === "shield_bandit") {
      return 0.7;
    }
    if (config.id === "wooden_dummy_elite") {
      return 0.82;
    }
    return 0.74;
  }

  private getEnemySpriteOriginY(config: EnemyConfig): number {
    if (config.id === "wooden_dummy_elite") {
      return 0.68;
    }
    if (config.id === "hound") {
      return 0.66;
    }
    return 0.64;
  }

  private createBanditFallback(config: EnemyConfig): Phaser.GameObjects.Container {
    const shadow = this.scene.add.ellipse(0, 32, 44, 12, 0x050705, 0.24);
    const body = this.scene.add.ellipse(0, 4, 42, 50, 0x9b5438, 1)
      .setStrokeStyle(3, 0x5b2f28, 0.95);
    const head = this.scene.add.circle(0, -24, 15, 0xc77b4b, 1)
      .setStrokeStyle(2, 0x5b2f28, 0.95);
    const scarf = this.scene.add.triangle(-2, -34, -18, -3, 5, -4, -4, 14, 0x6d332a, 1)
      .setStrokeStyle(1, 0x5b2f28, 0.85);
    const weapon = this.scene.add.rectangle(21, -4, 7, 48, 0x7a4a2b, 1)
      .setStrokeStyle(1, 0x3a261a, 0.9)
      .setRotation(-0.34);
    const footLeft = this.scene.add.rectangle(-11, 29, 13, 9, 0x5b2f28, 0.96);
    const footRight = this.scene.add.rectangle(11, 29, 13, 9, 0x5b2f28, 0.96);
    const enemyView = this.scene.add.container(0, 0, [shadow, weapon, body, head, scarf, footLeft, footRight])
      .setDepth(8)
      .setAlpha(0.97);
    enemyView.setData("enemyId", config.id);
    enemyView.setData("role", config.role);
    enemyView.setData("walkMs", Phaser.Math.Between(0, 800));
    return enemyView;
  }

  private createHoundFallback(config: EnemyConfig): Phaser.GameObjects.Container {
    const shadow = this.scene.add.ellipse(0, 21, 42, 10, 0x050705, 0.22);
    const body = this.scene.add.ellipse(-2, 3, 42, 24, 0x5c2b2b, 1)
      .setStrokeStyle(2, 0x2a1717, 0.95);
    const head = this.scene.add.circle(20, -4, 12, 0x6d3330, 1)
      .setStrokeStyle(2, 0x2a1717, 0.95);
    const earA = this.scene.add.triangle(13, -13, 0, 8, 8, -9, 15, 7, 0x331918, 1);
    const earB = this.scene.add.triangle(24, -14, 0, 8, 7, -9, 15, 7, 0x331918, 1);
    const tail = this.scene.add.rectangle(-25, -5, 18, 5, 0x331918, 1).setRotation(-0.55);
    const legA = this.scene.add.rectangle(-11, 15, 6, 13, 0x301716, 1).setRotation(0.25);
    const legB = this.scene.add.rectangle(10, 15, 6, 13, 0x301716, 1).setRotation(-0.25);
    const eye = this.scene.add.circle(24, -7, 2, 0xf3d799, 1);
    const enemyView = this.scene.add.container(0, 0, [shadow, tail, body, legA, legB, head, earA, earB, eye])
      .setDepth(8)
      .setAlpha(0.97);
    enemyView.setData("enemyId", config.id);
    enemyView.setData("role", config.role);
    enemyView.setData("walkMs", Phaser.Math.Between(0, 800));
    return enemyView;
  }

  private createShieldBanditFallback(config: EnemyConfig): Phaser.GameObjects.Container {
    const shadow = this.scene.add.ellipse(0, 36, 54, 14, 0x050705, 0.26);
    const body = this.scene.add.ellipse(2, 4, 48, 58, 0x7b5939, 1)
      .setStrokeStyle(3, 0x3d2a1c, 0.95);
    const head = this.scene.add.circle(2, -29, 16, 0xbf7544, 1)
      .setStrokeStyle(2, 0x3d2a1c, 0.95);
    const shield = this.scene.add.rectangle(-20, 2, 26, 46, 0x2f4a41, 1)
      .setStrokeStyle(3, 0xb8a468, 0.95);
    const shieldRim = this.scene.add.rectangle(-20, 2, 14, 31, 0x496b5d, 0.9)
      .setStrokeStyle(1, 0xd6c28d, 0.55);
    const mace = this.scene.add.rectangle(27, 0, 7, 46, 0x573925, 1)
      .setStrokeStyle(1, 0x271a13, 0.9)
      .setRotation(0.3);
    const enemyView = this.scene.add.container(0, 0, [shadow, mace, body, head, shield, shieldRim])
      .setDepth(8)
      .setAlpha(0.97);
    enemyView.setData("enemyId", config.id);
    enemyView.setData("role", config.role);
    enemyView.setData("walkMs", Phaser.Math.Between(0, 800));
    return enemyView;
  }

  private createWoodenDummyFallback(config: EnemyConfig): Phaser.GameObjects.Container {
    const shadow = this.scene.add.ellipse(0, 50, 72, 18, 0x050705, 0.28);
    const trunk = this.scene.add.rectangle(0, 5, 44, 82, 0x7a4f2a, 1)
      .setStrokeStyle(4, 0x3d2615, 0.95);
    const head = this.scene.add.rectangle(0, -48, 38, 34, 0x8d6132, 1)
      .setStrokeStyle(3, 0x3d2615, 0.95);
    const armLeft = this.scene.add.rectangle(-38, -4, 52, 12, 0x6c4322, 1)
      .setStrokeStyle(2, 0x3d2615, 0.95)
      .setRotation(-0.22);
    const armRight = this.scene.add.rectangle(38, -4, 52, 12, 0x6c4322, 1)
      .setStrokeStyle(2, 0x3d2615, 0.95)
      .setRotation(0.22);
    const core = this.scene.add.circle(0, 4, 11, 0xf0d678, 1)
      .setStrokeStyle(2, 0x5e421c, 0.95);
    const warningMarks = this.scene.add.text(0, -50, "木", {
      color: "#2a1a12",
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      fontStyle: "bold"
    }).setOrigin(0.5).setResolution(2);
    const enemyView = this.scene.add.container(0, 0, [shadow, armLeft, armRight, trunk, head, core, warningMarks])
      .setDepth(9)
      .setAlpha(0.98);
    enemyView.setData("enemyId", config.id);
    enemyView.setData("role", config.role);
    enemyView.setData("walkMs", Phaser.Math.Between(0, 800));
    return enemyView;
  }

  private updateEnemyFallbackAnimation(enemy: EnemyRuntime, deltaMs: number): void {
    const walkMs = ((enemy.view.getData("walkMs") as number | undefined) ?? 0) + deltaMs;
    enemy.view.setData("walkMs", walkMs);
    // 受击 squash 回弹：60ms 内从 0.92 恢复到 1（逐帧缩放会覆盖 Tween，故用衰减因子）
    const squash = enemy.hitSquashMs > 0 ? 1 - 0.08 * (enemy.hitSquashMs / HIT_SQUASH_MS) : 1;
    if (enemy.view instanceof Phaser.GameObjects.Sprite && enemy.view.getData("spriteArt") === true) {
      const animationKey = (enemy.view.getData("animationKey") as string | undefined) ?? getArtAnimationKey(enemy.config.assetId);
      if (this.scene.anims.exists(animationKey) && enemy.view.anims.currentAnim?.key !== animationKey) {
        enemy.view.play(animationKey);
      }
      if (Math.abs(enemy.directionX) > 0.04) {
        enemy.view.setFlipX(enemy.directionX < 0);
      }
      const baseScale = (enemy.view.getData("baseScale") as number | undefined) ?? 1;
      const roleMotion = getSpriteRoleMotion(enemy.config.role);
      enemy.view.setRotation(Math.sin(walkMs / roleMotion.rotateMs) * roleMotion.rotation);
      enemy.view.setScale(baseScale * squash, (baseScale + Math.sin(walkMs / roleMotion.pulseMs) * roleMotion.pulse) * squash);
      return;
    }

    if (enemy.config.role === "fast") {
      enemy.view.setRotation(Math.sin(walkMs / 72) * 0.1);
      enemy.view.setScale((1 + Math.sin(walkMs / 58) * 0.045) * squash, (1 - Math.sin(walkMs / 58) * 0.025) * squash);
      return;
    }

    if (enemy.config.role === "tank") {
      enemy.view.setRotation(Math.sin(walkMs / 180) * 0.045);
      enemy.view.setScale(squash, (1 + Math.sin(walkMs / 150) * 0.02) * squash);
      return;
    }

    if (enemy.config.role === "elite_pressure") {
      enemy.view.setRotation(Math.sin(walkMs / 260) * 0.035);
      enemy.view.setScale((1 + Math.sin(walkMs / 180) * 0.018) * squash, (1 + Math.cos(walkMs / 210) * 0.018) * squash);
      return;
    }

    const sway = Math.sin(walkMs / 125) * 0.08;
    enemy.view.setRotation(sway);
    enemy.view.setScale(squash, (1 + Math.sin(walkMs / 90) * 0.035) * squash);
  }

  private updateEnemyScreenPosition(enemy: EnemyRuntime): void {
    const heroWorld = this.options.getHeroWorld();
    const heroScreen = this.options.getHeroScreen();
    // 受击击退偏移：弹性回位系数（回稳后为 0，零开销）
    const offsetScale = getHitOffsetScale(enemy.hitOffsetAgeMs);
    enemy.view.setPosition(
      heroScreen.x + enemy.worldX - heroWorld.x + enemy.hitOffsetX * offsetScale,
      heroScreen.y + enemy.worldY - heroWorld.y + enemy.hitOffsetY * offsetScale
    );
  }

  private createTargetSnapshot(enemy: EnemyRuntime): EnemyTargetSnapshot {
    return {
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      worldX: enemy.worldX,
      worldY: enemy.worldY,
      screenX: enemy.view.x,
      screenY: enemy.view.y,
      hp: enemy.hp,
      maxHp: enemy.config.maxHp,
      collisionRadius: enemy.config.collisionRadius
    };
  }

  private createDamageResult(enemy: EnemyRuntime, amount: number): EnemyDamageResult {
    return {
      damaged: true,
      killed: enemy.hp <= 0,
      runtimeId: enemy.runtimeId,
      enemyId: enemy.config.id,
      amount,
      hp: enemy.hp,
      maxHp: enemy.config.maxHp,
      worldX: enemy.worldX,
      worldY: enemy.worldY,
      screenX: enemy.view.x,
      screenY: enemy.view.y
    };
  }

  /**
   * 受击击退分级（方案五）：写入临时位移偏移，updateEnemyScreenPosition 每帧叠加，
   * 阻尼余弦衰减弹性回位，不碰世界坐标，与逐帧位置重写零冲突。
   * 普通小怪：沿弹道方向（投射物自少侠射向目标，故取 少侠→敌人 方向）击退 12-18px；
   * 精英：随机方向 4-6px 原地抖动；致死一击不偏移（并入死亡击飞）。
   */
  private applyHitKnockback(enemy: EnemyRuntime): void {
    if (enemy.config.tier === "elite") {
      const angle = Math.random() * Math.PI * 2;
      const distance = Phaser.Math.Between(HIT_KNOCKBACK_ELITE_MIN_PX, HIT_KNOCKBACK_ELITE_MAX_PX);
      enemy.hitOffsetX = Math.cos(angle) * distance;
      enemy.hitOffsetY = Math.sin(angle) * distance;
    } else {
      const heroWorld = this.options.getHeroWorld();
      const awayX = enemy.worldX - heroWorld.x;
      const awayY = enemy.worldY - heroWorld.y;
      const length = Math.hypot(awayX, awayY);
      const dirX = length > 0 ? awayX / length : 1;
      const dirY = length > 0 ? awayY / length : 0;
      const distance = Phaser.Math.Between(HIT_KNOCKBACK_NORMAL_MIN_PX, HIT_KNOCKBACK_NORMAL_MAX_PX);
      enemy.hitOffsetX = dirX * distance;
      enemy.hitOffsetY = dirY * distance;
    }
    enemy.hitOffsetAgeMs = 0;
  }

  private flashEnemyHit(enemy: EnemyRuntime): void {
    enemy.hitSquashMs = HIT_SQUASH_MS;
    if (enemy.view instanceof Phaser.GameObjects.Sprite && enemy.view.getData("spriteArt") === true) {
      // 受击白闪：精英用金色，普通敌人白色；80ms 后清 tint（几何兜底图形无 Tint 组件，走 alpha 微闪）
      const view = enemy.view;
      view.setTintFill(enemy.config.tier === "elite" ? ELITE_HIT_TINT : NORMAL_HIT_TINT);
      this.scene.time.delayedCall(HIT_FLASH_MS, () => {
        if (view.active) {
          view.clearTint();
        }
      });
      return;
    }

    enemy.view.setAlpha(0.62);
    this.scene.tweens.add({
      targets: enemy.view,
      alpha: 0.97,
      duration: 110,
      ease: "Quad.easeOut"
    });
  }

  private updateEliteSchedule(elapsedSeconds: number, segment: ResolvedWaveSegment): void {
    if (this.eliteWarning) {
      this.updateEliteWarningMarker(this.eliteWarning, elapsedSeconds);
      if (elapsedSeconds < this.eliteWarning.spawnSeconds) {
        return;
      }

      const spawn = { x: this.eliteWarning.worldX, y: this.eliteWarning.worldY, side: this.eliteWarning.side };
      this.clearEliteWarning();
      if (this.canSpawnElite(elapsedSeconds, segment)) {
        this.spawnEnemy("wooden_dummy_elite", segment, spawn);
        this.nextEliteSpawnSeconds = elapsedSeconds + Phaser.Math.Between(
          this.config.eliteRespawnMinSeconds,
          this.config.eliteRespawnMaxSeconds
        );
        return;
      }

      this.nextEliteSpawnSeconds = elapsedSeconds + 8;
      return;
    }

    if (elapsedSeconds < this.nextEliteSpawnSeconds - this.config.eliteWarningSeconds) {
      return;
    }
    if (!this.canSpawnElite(elapsedSeconds, segment)) {
      return;
    }

    const spawn = this.pickSpawnPoint(this.options.getHeroWorld());
    const warning = this.createEliteWarning(spawn, this.nextEliteSpawnSeconds);
    this.eliteWarning = warning;
    playSfxSafely(this.scene, "elite_warning");
    eventBus.emit("enemy_elite_warning_started", {
      enemyId: "wooden_dummy_elite",
      warningSeconds: this.config.eliteWarningSeconds,
      spawnSeconds: warning.spawnSeconds,
      worldX: roundForDebug(warning.worldX),
      worldY: roundForDebug(warning.worldY)
    });
  }

  private canSpawnElite(elapsedSeconds: number, segment: ResolvedWaveSegment): boolean {
    const config = enemyConfigs.wooden_dummy_elite;
    if (elapsedSeconds < config.spawnAfterSeconds) {
      return false;
    }
    if (this.getEliteAlive() >= this.config.maxEliteAlive) {
      return false;
    }
    return this.enemies.length < Math.floor(segment.aliveCap * 0.9);
  }

  private createEliteWarning(spawn: SpawnPoint, spawnSeconds: number): EliteWarningRuntime {
    if (this.scene.textures.exists("vfx_elite_warning")) {
      const view = this.scene.add.image(0, 0, "vfx_elite_warning")
        .setDisplaySize(80, 80)
        .setOrigin(0.5)
        .setDepth(30)
        .setAlpha(0.96)
        .setBlendMode(Phaser.BlendModes.ADD);
      view.setData("baseScale", 80 / 256);
      const warning = {
        worldX: spawn.x,
        worldY: spawn.y,
        side: spawn.side,
        spawnSeconds,
        view
      };
      this.updateEliteWarningMarker(warning, this.options.getElapsedSeconds());
      return warning;
    }

    const ring = this.scene.add.circle(0, 0, 18, 0x6c4322, 0.18)
      .setStrokeStyle(3, 0xf0d678, 0.96);
    const core = this.scene.add.circle(0, 0, 5, 0xf0d678, 0.95);
    const barA = this.scene.add.rectangle(0, 0, 32, 4, 0xf0d678, 0.82);
    const barB = this.scene.add.rectangle(0, 0, 32, 4, 0xf0d678, 0.82).setRotation(Math.PI / 2);
    const view = this.scene.add.container(0, 0, [ring, barA, barB, core])
      .setDepth(30)
      .setAlpha(0.96);
    const warning = {
      worldX: spawn.x,
      worldY: spawn.y,
      side: spawn.side,
      spawnSeconds,
      view
    };
    this.updateEliteWarningMarker(warning, this.options.getElapsedSeconds());
    return warning;
  }

  private updateEliteWarningMarker(warning: EliteWarningRuntime, elapsedSeconds: number): void {
    const heroWorld = this.options.getHeroWorld();
    const heroScreen = this.options.getHeroScreen();
    const screenX = heroScreen.x + warning.worldX - heroWorld.x;
    const screenY = heroScreen.y + warning.worldY - heroWorld.y;
    const clampedX = Phaser.Math.Clamp(screenX, 24, this.scene.scale.width - 24);
    const clampedY = Phaser.Math.Clamp(screenY, 112, this.scene.scale.height - 24);
    warning.view.setPosition(clampedX, clampedY);
    const baseScale = getNumericData(warning.view, "baseScale", 1);
    warning.view.setScale(baseScale * (1 + Math.sin(elapsedSeconds * 8) * 0.08));
  }

  private clearEliteWarning(): void {
    if (!this.eliteWarning) {
      return;
    }

    this.eliteWarning.view.destroy();
    this.eliteWarning = undefined;
  }

  private getRuntimeState(segment: ResolvedWaveSegment): WaveDirectorState {
    if (segment.state === "boss_pre" || segment.state === "boss_active") {
      return segment.state;
    }
    if (this.eliteWarning) {
      return "elite_warning";
    }
    if (this.getEliteAlive() > 0) {
      return "elite_active";
    }
    return segment.state;
  }

  private getSegment(elapsedSeconds: number): WaveSegment {
    return this.config.segments.find((segment) => (
      elapsedSeconds >= segment.startSeconds && elapsedSeconds < segment.endSeconds
    )) ?? this.config.segments[this.config.segments.length - 1];
  }

  private resolveSegment(segment: WaveSegment): ResolvedWaveSegment {
    const lowVfxMode = this.options.getLowVfxMode?.() ?? false;
    const platformClamp = lowVfxMode ? "low_vfx" : this.initialViewportClamp;
    const capLimit = platformClamp === "low_vfx"
      ? this.config.lowVfxAliveCap
      : platformClamp === "mobile"
        ? this.config.mobileAliveCap
        : segment.aliveCap;
    const aliveCap = Math.min(segment.aliveCap, capLimit);
    const targetScale = segment.aliveCap > 0 ? aliveCap / segment.aliveCap : 1;
    const targetAliveMin = Math.min(aliveCap, Math.floor(segment.targetAliveMin * targetScale));
    const targetAliveMax = Math.min(
      aliveCap,
      Math.max(targetAliveMin, Math.floor(segment.targetAliveMax * targetScale))
    );

    return {
      ...segment,
      rawTargetAliveMin: segment.targetAliveMin,
      rawTargetAliveMax: segment.targetAliveMax,
      rawAliveCap: segment.aliveCap,
      targetAliveMin,
      targetAliveMax,
      aliveCap,
      platformClamp
    };
  }

  private updateState(nextState: WaveDirectorState, elapsedSeconds: number): void {
    if (nextState === this.currentState) {
      return;
    }

    this.currentState = nextState;
    eventBus.emit("wave_state_changed", {
      state: nextState,
      waveTimeSeconds: elapsedSeconds
    });
  }

  private emitBossRequestIfNeeded(elapsedSeconds: number): void {
    if (this.bossRequestEmitted || elapsedSeconds < this.config.bossRequestSeconds) {
      return;
    }

    this.bossRequestEmitted = true;
    eventBus.emit("boss_spawn_requested", {
      bossId: "heifeng_chief",
      waveTimeSeconds: elapsedSeconds
    });
  }

  private ageRollingSamples(deltaMs: number): void {
    for (const sample of this.spawnDistanceSamples) {
      sample.ageMs += deltaMs;
    }
    while (this.spawnDistanceSamples.length > 0 && this.spawnDistanceSamples[0].ageMs > 30000) {
      this.spawnDistanceSamples.shift();
    }

    for (const sample of this.despawnSamples) {
      sample.ageMs += deltaMs;
    }
    while (this.despawnSamples.length > 0 && this.despawnSamples[0].ageMs > 10000) {
      this.despawnSamples.shift();
    }
  }

  private countEnemiesByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const enemy of this.enemies) {
      counts[enemy.config.id] = (counts[enemy.config.id] ?? 0) + 1;
    }
    return counts;
  }

  private getEliteAlive(): number {
    return this.enemies.filter((enemy) => enemy.config.tier === "elite").length;
  }

  private getMinSpawnDistanceLast30s(): number {
    if (this.spawnDistanceSamples.length === 0) {
      return 0;
    }
    return Math.min(...this.spawnDistanceSamples.map((sample) => sample.distance));
  }
}

function roundForDebug(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * 受击击退偏移回位系数：阻尼余弦 exp(-t/τ)·cos(2πt/T)，
 * t≈60ms 处出现小幅反向过冲（弹性感），≥ HIT_OFFSET_SETTLE_MS 后归零。
 */
function getHitOffsetScale(ageMs: number): number {
  if (ageMs >= HIT_OFFSET_SETTLE_MS) {
    return 0;
  }
  return (
    Math.exp(-ageMs / HIT_OFFSET_DECAY_MS) *
    Math.cos((ageMs / HIT_OFFSET_OSCILLATION_MS) * Math.PI * 2)
  );
}

/** 击杀碎屑配色：精英金色，其余按敌种贴近本体色调。 */
function getKillBurstTint(config: EnemyConfig): number {
  if (config.tier === "elite") {
    return 0xf6d472;
  }
  if (config.id === "hound") {
    return 0x8a4b3f;
  }
  if (config.id === "shield_bandit") {
    return 0xa98a5a;
  }
  return 0xc77b4b;
}

/** 防御性音频调用：AudioSystem 未注册或方法缺失时静默跳过。 */
function playSfxSafely(scene: Phaser.Scene, eventId: string): void {
  const audioSystem = scene.registry.get("audioSystem") as { playPlaceholder?: (id: string) => boolean } | undefined;
  audioSystem?.playPlaceholder?.(eventId);
}

function getNumericData(view: Phaser.GameObjects.GameObject, key: string, fallback: number): number {
  const value = view.getData(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getSpriteRoleMotion(role: EnemyConfig["role"]): { rotateMs: number; rotation: number; pulseMs: number; pulse: number } {
  if (role === "fast") {
    return { rotateMs: 82, rotation: 0.05, pulseMs: 62, pulse: 0.026 };
  }
  if (role === "tank") {
    return { rotateMs: 180, rotation: 0.025, pulseMs: 150, pulse: 0.014 };
  }
  if (role === "elite_pressure") {
    return { rotateMs: 260, rotation: 0.02, pulseMs: 210, pulse: 0.012 };
  }
  return { rotateMs: 150, rotation: 0.026, pulseMs: 110, pulse: 0.016 };
}

function getOppositeSide(side: Exclude<SpawnSide, "corner">): Exclude<SpawnSide, "corner"> {
  if (side === "left") {
    return "right";
  }
  if (side === "right") {
    return "left";
  }
  if (side === "top") {
    return "bottom";
  }
  return "top";
}

function getPerpendicularSides(side: Exclude<SpawnSide, "corner">): [Exclude<SpawnSide, "corner">, Exclude<SpawnSide, "corner">] {
  if (side === "left" || side === "right") {
    return ["top", "bottom"];
  }
  return ["left", "right"];
}
