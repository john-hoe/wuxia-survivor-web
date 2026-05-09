import Phaser from "phaser";
import { skillConfigs, skillOrder, type AdvanceKeyId, type SkillId, type SkillLevelConfig } from "../data/skills";
import type { InsightSkillState } from "../data/progression";
import type { EnemyDamageResult, EnemyTargetSnapshot } from "./EnemyDirectorSystem";
import type { BossDamageResult, BossTargetSnapshot } from "./BossSystem";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";

type Point = {
  x: number;
  y: number;
};

type SkillSystemOptions = {
  getHeroWorld: () => Point;
  getHeroScreen: () => Point;
  getTargets: () => CombatTargetSnapshot[];
  damageTarget: (runtimeId: number, amount: number, source: string) => CombatDamageResult | undefined;
  knockbackEnemy: (runtimeId: number, originWorld: Point, distance: number, source: string) => boolean;
  onEnemyKilled: (result: EnemyDamageResult) => void;
  playSfx: (eventId: string) => void;
};

export type CombatTargetSnapshot = EnemyTargetSnapshot | BossTargetSnapshot;
export type CombatDamageResult = EnemyDamageResult | BossDamageResult;

type SkillRuntime = {
  skillId: SkillId;
  level: number;
  cooldownMs: number;
  retryMs: number;
  advanced: boolean;
};

type ProjectileRuntime = {
  runtimeId: number;
  skillId: SkillId;
  displayName: string;
  worldX: number;
  worldY: number;
  directionX: number;
  directionY: number;
  distanceTraveled: number;
  damage: number;
  radius: number;
  speed: number;
  range: number;
  pierceRemaining: number;
  hitEnemyIds: Set<number>;
  advanced: boolean;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
};

type OrbitalRuntime = {
  runtimeId: number;
  skillId: SkillId;
  angleRad: number;
  advanced: boolean;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
};

type WaveRuntime = {
  runtimeId: number;
  skillId: SkillId;
  worldX: number;
  worldY: number;
  radius: number;
  damage: number;
  knockback: number;
  ageMs: number;
  durationMs: number;
  hitEnemyIds: Set<number>;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
};

type VfxRuntime = {
  view: Phaser.GameObjects.Arc | Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  worldX: number;
  worldY: number;
  ageMs: number;
  durationMs: number;
  type: "hit" | "die" | "advance";
};

type HitSample = {
  ageMs: number;
  damage: number;
};

export type SkillSlotSnapshot = {
  skillId: SkillId;
  displayName: string;
  level: number;
  advanced: boolean;
};

export type SkillSystemSnapshot = {
  skills: string;
  projectilesAlive: number;
  orbitalsAlive: number;
  activeVfx: number;
  skillHitsLast10s: number;
  skillDpsLast10s: number;
  advancedSkills: string;
  skillSlots: SkillSlotSnapshot[];
};

const RETRY_NO_TARGET_MS = 150;
const MAX_PROJECTILES = 80;
const MAX_ORBITALS = 12;
const MAX_WAVES = 3;
const HIT_SFX_THROTTLE_MS = 90;
const WAVE_DURATION_MS = 420;
const ADVANCE_VFX_DURATION_MS = 900;
const ADVANCED_YULONG_COOLDOWN_MS = 680;

export class SkillSystem {
  private readonly skills = new Map<SkillId, SkillRuntime>();
  private readonly advanceKeys = new Set<AdvanceKeyId>();
  private readonly projectiles: ProjectileRuntime[] = [];
  private readonly orbitals: OrbitalRuntime[] = [];
  private readonly waves: WaveRuntime[] = [];
  private readonly vfx: VfxRuntime[] = [];
  private readonly hitSamples: HitSample[] = [];
  private readonly orbitalHitCooldowns = new Map<string, number>();
  private nextProjectileId = 1;
  private nextOrbitalId = 1;
  private nextWaveId = 1;
  private hitSfxCooldownMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly options: SkillSystemOptions) {
    this.unlockSkill("yulong_sword_qi", 1);
  }

  update(deltaMs: number): SkillSystemSnapshot {
    const clampedDeltaMs = Math.min(deltaMs, 100);
    this.hitSfxCooldownMs = Math.max(0, this.hitSfxCooldownMs - clampedDeltaMs);
    this.ageCooldownMap(this.orbitalHitCooldowns, clampedDeltaMs);

    for (const runtime of this.skills.values()) {
      runtime.cooldownMs = Math.max(0, runtime.cooldownMs - clampedDeltaMs);
      runtime.retryMs = Math.max(0, runtime.retryMs - clampedDeltaMs);
    }

    const targets = this.options.getTargets();
    for (const skillId of skillOrder) {
      const runtime = this.skills.get(skillId);
      if (!runtime) {
        continue;
      }

      if (skillConfigs[skillId].kind === "projectile") {
        this.castProjectileSkillIfReady(runtime, targets);
      } else if (skillConfigs[skillId].kind === "aoe") {
        this.castWaveSkillIfReady(runtime);
      }
    }

    this.updateProjectiles(clampedDeltaMs, targets);
    this.updateOrbitals(clampedDeltaMs, targets);
    this.updateWaves(clampedDeltaMs, targets);
    this.updateVfx(clampedDeltaMs);
    this.ageHitSamples(clampedDeltaMs);
    return this.getSnapshot();
  }

  getSnapshot(): SkillSystemSnapshot {
    const totalDamage = this.hitSamples.reduce((sum, sample) => sum + sample.damage, 0);
    const oldestSampleAgeMs = this.hitSamples.reduce((maxAge, sample) => Math.max(maxAge, sample.ageMs), 0);
    const dpsWindowSeconds = this.hitSamples.length > 0
      ? Math.min(10, Math.max(1, oldestSampleAgeMs / 1000))
      : 10;
    return {
      skills: this.formatSkills(),
      projectilesAlive: this.projectiles.length,
      orbitalsAlive: this.orbitals.length,
      activeVfx: this.vfx.length + this.waves.length,
      skillHitsLast10s: this.hitSamples.length,
      skillDpsLast10s: Math.round((totalDamage / dpsWindowSeconds) * 10) / 10,
      advancedSkills: this.formatAdvancedSkills(),
      skillSlots: this.getSkillSlots()
    };
  }

  getInsightState(): InsightSkillState {
    const levels: Partial<Record<SkillId, number>> = {};
    const advancedSkillIds: SkillId[] = [];
    for (const skillId of skillOrder) {
      const runtime = this.skills.get(skillId);
      if (!runtime) {
        continue;
      }
      levels[skillId] = runtime.level;
      if (runtime.advanced) {
        advancedSkillIds.push(skillId);
      }
    }

    return {
      levels,
      advancedSkillIds,
      advanceKeyIds: Array.from(this.advanceKeys),
      maxSkillSlots: 6
    };
  }

  destroy(): void {
    for (const projectile of this.projectiles) {
      projectile.view.destroy();
    }
    for (const orbital of this.orbitals) {
      orbital.view.destroy();
    }
    for (const wave of this.waves) {
      wave.view.destroy();
    }
    for (const vfx of this.vfx) {
      vfx.view.destroy();
    }
    this.projectiles.length = 0;
    this.orbitals.length = 0;
    this.waves.length = 0;
    this.vfx.length = 0;
    this.hitSamples.length = 0;
    this.orbitalHitCooldowns.clear();
  }

  unlockSkill(skillId: SkillId, level = 1): boolean {
    const config = skillConfigs[skillId];
    const existing = this.skills.get(skillId);
    if (existing) {
      return this.setSkillLevel(skillId, Math.max(existing.level, level));
    }

    const nextLevel = Phaser.Math.Clamp(Math.floor(level), 1, config.maxLevel);
    const runtime: SkillRuntime = {
      skillId,
      level: nextLevel,
      cooldownMs: 0,
      retryMs: 0,
      advanced: false
    };
    this.skills.set(skillId, runtime);
    if (config.kind === "orbit") {
      this.rebuildOrbitals(skillId);
    }
    eventBus.emit("skill_unlocked", {
      skillId,
      displayName: config.displayName,
      level: nextLevel
    });
    return true;
  }

  setYulongLevel(level: number): void {
    this.setSkillLevel("yulong_sword_qi", level);
  }

  setSkillLevel(skillId: SkillId, level: number): boolean {
    const config = skillConfigs[skillId];
    const runtime = this.skills.get(skillId);
    if (!runtime) {
      return this.unlockSkill(skillId, level);
    }

    const nextLevel = Phaser.Math.Clamp(Math.floor(level), 1, config.maxLevel);
    if (nextLevel === runtime.level) {
      return false;
    }

    runtime.level = nextLevel;
    runtime.cooldownMs = Math.min(runtime.cooldownMs, this.getCooldownMs(runtime));
    if (config.kind === "orbit") {
      this.rebuildOrbitals(skillId);
    }
    eventBus.emit("skill_level_changed", {
      skillId,
      displayName: config.displayName,
      level: runtime.level
    });
    return true;
  }

  collectAdvanceKey(keyId: AdvanceKeyId): boolean {
    if (this.advanceKeys.has(keyId)) {
      return false;
    }

    this.advanceKeys.add(keyId);
    eventBus.emit("skill_advance_key_collected", {
      keyId,
      displayName: this.getAdvanceKeyDisplayName(keyId)
    });
    return true;
  }

  advanceSkill(skillId: SkillId): boolean {
    const runtime = this.skills.get(skillId);
    const config = skillConfigs[skillId];
    const advancement = config.advancement;
    if (!runtime || !advancement || runtime.advanced) {
      return false;
    }
    if (runtime.level < advancement.requiredLevel || !this.advanceKeys.has(advancement.requiredKeyId)) {
      return false;
    }

    runtime.advanced = true;
    runtime.cooldownMs = 0;
    if (config.kind === "orbit") {
      this.rebuildOrbitals(skillId);
    }
    this.createAdvanceVfx(advancement.displayName);
    this.options.playSfx("skill_advance");
    eventBus.emit("skill_advanced", {
      skillId,
      displayName: advancement.displayName,
      baseDisplayName: config.displayName,
      level: runtime.level
    });
    return true;
  }

  debugEnableP0AdvancedShowcase(): void {
    const requiredKeys: Record<SkillId, AdvanceKeyId> = {
      yulong_sword_qi: "sword_manual_page",
      huifeng_dart: "hidden_weapon_pouch",
      zhenshan_palm: "inner_force_manual"
    };
    for (const skillId of skillOrder) {
      this.unlockSkill(skillId, 5);
      this.setSkillLevel(skillId, 5);
      this.collectAdvanceKey(requiredKeys[skillId]);
      this.advanceSkill(skillId);
    }
  }

  private castProjectileSkillIfReady(runtime: SkillRuntime, targets: CombatTargetSnapshot[]): void {
    if (runtime.cooldownMs > 0 || runtime.retryMs > 0) {
      return;
    }

    const profile = this.getProjectileProfile(runtime);
    const target = this.pickTarget(targets, profile.range);
    if (!target) {
      runtime.retryMs = RETRY_NO_TARGET_MS;
      eventBus.emit("skill_cooldown_ready", {
        skillId: runtime.skillId,
        reason: "no_target"
      });
      return;
    }

    const heroWorld = this.options.getHeroWorld();
    const toTargetX = target.worldX - heroWorld.x;
    const toTargetY = target.worldY - heroWorld.y;
    const length = Math.hypot(toTargetX, toTargetY);
    const direction = length > 0
      ? { x: toTargetX / length, y: toTargetY / length }
      : { x: 1, y: 0 };
    const spreadAngles = getSpreadAngles(profile.projectileCount);
    const availableSlots = Math.max(0, MAX_PROJECTILES - this.projectiles.length);
    for (let index = 0; index < Math.min(spreadAngles.length, availableSlots); index += 1) {
      this.spawnProjectile(runtime, heroWorld, rotatePoint(direction, spreadAngles[index]), profile);
    }

    runtime.cooldownMs = profile.cooldownMs;
    eventBus.emit("skill_cast", {
      skillId: runtime.skillId,
      displayName: this.getRuntimeDisplayName(runtime),
      level: runtime.level,
      targetRuntimeId: target.runtimeId,
      projectileCount: Math.min(spreadAngles.length, availableSlots),
      advanced: runtime.advanced
    });
  }

  private castWaveSkillIfReady(runtime: SkillRuntime): void {
    if (runtime.cooldownMs > 0 || this.waves.length >= MAX_WAVES) {
      return;
    }

    const profile = this.getWaveProfile(runtime);
    const heroWorld = this.options.getHeroWorld();
    this.spawnWave(runtime, heroWorld, profile);
    runtime.cooldownMs = profile.cooldownMs;
    this.options.playSfx("skill_cast");
    eventBus.emit("skill_cast", {
      skillId: runtime.skillId,
      displayName: this.getRuntimeDisplayName(runtime),
      level: runtime.level,
      radius: profile.radius,
      advanced: runtime.advanced
    });
  }

  private pickTarget(targets: CombatTargetSnapshot[], range: number): CombatTargetSnapshot | undefined {
    const heroWorld = this.options.getHeroWorld();
    const candidates = targets
      .map((target) => ({
        target,
        distance: Math.hypot(target.worldX - heroWorld.x, target.worldY - heroWorld.y)
      }))
      .filter((entry) => entry.distance <= range && this.isReadableCombatTarget(entry.target));

    candidates.sort((a, b) => {
      if (Math.abs(a.distance - b.distance) <= 24) {
        return a.target.hp - b.target.hp;
      }
      return a.distance - b.distance;
    });

    return candidates[0]?.target;
  }

  private isReadableCombatTarget(target: CombatTargetSnapshot): boolean {
    const verticalMargin = Math.min(96, Math.max(0, this.scene.scale.height * 0.18));
    const safeVerticalMargin = Math.min(verticalMargin, Math.max(0, (this.scene.scale.height - 1) / 2));
    return target.screenX >= 0
      && target.screenX <= this.scene.scale.width
      && target.screenY >= safeVerticalMargin
      && target.screenY <= this.scene.scale.height - safeVerticalMargin;
  }

  private spawnProjectile(
    runtime: SkillRuntime,
    heroWorld: Point,
    direction: Point,
    profile: ReturnType<SkillSystem["getProjectileProfile"]>
  ): void {
    const projectileView = this.createYulongProjectileFallback(direction, runtime.advanced);
    const projectile: ProjectileRuntime = {
      runtimeId: this.nextProjectileId,
      skillId: runtime.skillId,
      displayName: this.getRuntimeDisplayName(runtime),
      worldX: heroWorld.x,
      worldY: heroWorld.y,
      directionX: direction.x,
      directionY: direction.y,
      distanceTraveled: 0,
      damage: profile.damage,
      radius: profile.radius,
      speed: profile.speed,
      range: profile.range,
      pierceRemaining: profile.pierce,
      hitEnemyIds: new Set<number>(),
      advanced: runtime.advanced,
      view: projectileView
    };
    this.nextProjectileId += 1;
    this.projectiles.push(projectile);
    this.updateProjectileScreenPosition(projectile);
    this.options.playSfx(runtime.advanced ? "skill_cast_advanced" : "skill_cast");
  }

  private spawnWave(
    runtime: SkillRuntime,
    heroWorld: Point,
    profile: ReturnType<SkillSystem["getWaveProfile"]>
  ): void {
    const view = this.createZhenshanWaveFallback(profile.radius, runtime.advanced);
    const wave: WaveRuntime = {
      runtimeId: this.nextWaveId,
      skillId: runtime.skillId,
      worldX: heroWorld.x,
      worldY: heroWorld.y,
      radius: profile.radius,
      damage: profile.damage,
      knockback: profile.knockback,
      ageMs: 0,
      durationMs: WAVE_DURATION_MS,
      hitEnemyIds: new Set<number>(),
      view
    };
    this.nextWaveId += 1;
    this.waves.push(wave);
    this.updateWorldAnchoredView(wave.view, wave.worldX, wave.worldY);
  }

  private updateProjectiles(deltaMs: number, targets: CombatTargetSnapshot[]): void {
    const deltaSeconds = deltaMs / 1000;
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      const step = projectile.speed * deltaSeconds;
      projectile.worldX += projectile.directionX * step;
      projectile.worldY += projectile.directionY * step;
      projectile.distanceTraveled += step;
      this.updateProjectileScreenPosition(projectile);

      if (this.tryHitEnemyWithProjectile(projectile, targets)) {
        if (projectile.pierceRemaining <= 0) {
          this.destroyProjectile(index);
          continue;
        }
        projectile.pierceRemaining -= 1;
      }

      if (projectile.distanceTraveled >= projectile.range) {
        this.destroyProjectile(index);
      }
    }
  }

  private updateOrbitals(deltaMs: number, targets: CombatTargetSnapshot[]): void {
    const runtime = this.skills.get("huifeng_dart");
    if (!runtime) {
      return;
    }

    const profile = this.getOrbitProfile(runtime);
    const heroWorld = this.options.getHeroWorld();
    const deltaSeconds = deltaMs / 1000;
    const angleStep = Phaser.Math.DegToRad(profile.rotationSpeedDegPerSecond) * deltaSeconds;
    for (const orbital of this.orbitals) {
      if (orbital.skillId !== runtime.skillId) {
        continue;
      }

      orbital.angleRad += angleStep;
      const worldX = heroWorld.x + Math.cos(orbital.angleRad) * profile.radius;
      const worldY = heroWorld.y + Math.sin(orbital.angleRad) * profile.radius;
      this.updateWorldAnchoredView(orbital.view, worldX, worldY);
      orbital.view.setRotation(orbital.angleRad + Math.PI / 4);
      this.tryHitEnemiesWithOrbital(orbital, worldX, worldY, profile, targets);
    }
  }

  private updateWaves(deltaMs: number, targets: CombatTargetSnapshot[]): void {
    const heroWorld = this.options.getHeroWorld();
    for (let index = this.waves.length - 1; index >= 0; index -= 1) {
      const wave = this.waves[index];
      wave.ageMs += deltaMs;
      const progress = Phaser.Math.Clamp(wave.ageMs / wave.durationMs, 0, 1);
      const currentRadius = wave.radius * (0.32 + progress * 0.68);
      const baseScale = getNumericData(wave.view, "baseScale", 1);
      wave.view.setScale(baseScale * (0.32 + progress * 0.88));
      wave.view.setAlpha(Math.max(0, 0.62 * (1 - progress)));
      this.updateWorldAnchoredView(wave.view, wave.worldX, wave.worldY);
      this.tryHitEnemiesWithWave(wave, currentRadius, heroWorld, targets);

      if (wave.ageMs >= wave.durationMs) {
        wave.view.destroy();
        this.waves.splice(index, 1);
      }
    }
  }

  private tryHitEnemyWithProjectile(projectile: ProjectileRuntime, targets: CombatTargetSnapshot[]): boolean {
    for (const target of targets) {
      if (projectile.hitEnemyIds.has(target.runtimeId)) {
        continue;
      }

      const hitDistance = target.collisionRadius + projectile.radius;
      if (Math.hypot(target.worldX - projectile.worldX, target.worldY - projectile.worldY) > hitDistance) {
        continue;
      }

      const result = this.applySkillDamage(projectile.skillId, target, projectile.damage, {
        projectileRuntimeId: projectile.runtimeId,
        source: projectile.advanced ? "advanced_projectile" : "projectile"
      });
      if (!result?.damaged) {
        continue;
      }

      projectile.hitEnemyIds.add(target.runtimeId);
      return true;
    }

    return false;
  }

  private tryHitEnemiesWithOrbital(
    orbital: OrbitalRuntime,
    worldX: number,
    worldY: number,
    profile: ReturnType<SkillSystem["getOrbitProfile"]>,
    targets: CombatTargetSnapshot[]
  ): void {
    for (const target of targets) {
      const cooldownKey = `${orbital.runtimeId}:${target.runtimeId}`;
      if ((this.orbitalHitCooldowns.get(cooldownKey) ?? 0) > 0) {
        continue;
      }

      const hitDistance = target.collisionRadius + 13;
      if (Math.hypot(target.worldX - worldX, target.worldY - worldY) > hitDistance) {
        continue;
      }

      const result = this.applySkillDamage(orbital.skillId, target, profile.damage, {
        orbitalRuntimeId: orbital.runtimeId,
        source: "orbit"
      });
      if (result?.damaged) {
        this.orbitalHitCooldowns.set(cooldownKey, profile.perEnemyHitCooldownMs);
      }
    }
  }

  private tryHitEnemiesWithWave(
    wave: WaveRuntime,
    currentRadius: number,
    originWorld: Point,
    targets: CombatTargetSnapshot[]
  ): void {
    for (const target of targets) {
      if (wave.hitEnemyIds.has(target.runtimeId)) {
        continue;
      }
      if (Math.hypot(target.worldX - wave.worldX, target.worldY - wave.worldY) > currentRadius + target.collisionRadius) {
        continue;
      }

      const result = this.applySkillDamage(wave.skillId, target, wave.damage, {
        waveRuntimeId: wave.runtimeId,
        source: "aoe_wave",
        knockback: wave.knockback
      });
      wave.hitEnemyIds.add(target.runtimeId);
      if (result?.damaged && !result.killed) {
        if (isEnemyTarget(target)) {
          this.options.knockbackEnemy(target.runtimeId, originWorld, wave.knockback, wave.skillId);
        }
      }
    }
  }

  private applySkillDamage(
    skillId: SkillId,
    target: CombatTargetSnapshot,
    damage: number,
    metadata: Record<string, unknown>
  ): CombatDamageResult | undefined {
    const result = this.options.damageTarget(target.runtimeId, damage, skillId);
    if (!result?.damaged) {
      return undefined;
    }

    this.hitSamples.push({ ageMs: 0, damage: result.amount });
    this.createHitVfx(result.worldX, result.worldY);
    this.playThrottledHitSfx();
    eventBus.emit("skill_hit", {
      skillId,
      targetKind: isBossDamageResult(result) ? "boss" : "enemy",
      targetRuntimeId: result.runtimeId,
      ...getSkillHitTargetPayload(result),
      amount: result.amount,
      killed: result.killed,
      ...metadata
    });

    if (result.killed) {
      this.createDeathVfx(result.worldX, result.worldY);
      if (isBossDamageResult(result)) {
        this.options.playSfx("boss_defeated");
      } else {
        this.options.playSfx("enemy_die");
        this.options.onEnemyKilled(result);
      }
    }
    return result;
  }

  private rebuildOrbitals(skillId: SkillId): void {
    const runtime = this.skills.get(skillId);
    if (!runtime) {
      return;
    }

    const profile = this.getOrbitProfile(runtime);
    const count = Math.min(MAX_ORBITALS, profile.projectileCount);
    const existing = this.orbitals.filter((orbital) => orbital.skillId === skillId);
    const mustRecreate = existing.some((orbital) => orbital.advanced !== runtime.advanced);

    if (mustRecreate) {
      for (let index = this.orbitals.length - 1; index >= 0; index -= 1) {
        const orbital = this.orbitals[index];
        if (orbital.skillId !== skillId) {
          continue;
        }
        orbital.view.destroy();
        this.orbitals.splice(index, 1);
      }
      existing.length = 0;
    }

    const anchorAngle = existing[0]?.angleRad ?? 0;
    for (let index = existing.length - 1; index >= count; index -= 1) {
      const orbital = existing[index];
      const globalIndex = this.orbitals.indexOf(orbital);
      if (globalIndex >= 0) {
        this.orbitals.splice(globalIndex, 1);
      }
      orbital.view.destroy();
      existing.splice(index, 1);
    }

    for (let index = 0; index < Math.min(existing.length, count); index += 1) {
      existing[index].advanced = runtime.advanced;
    }

    for (let index = 0; index < count; index += 1) {
      if (existing[index]) {
        continue;
      }
      const angleRad = anchorAngle + (Math.PI * 2 * index) / count;
      const view = this.createHuifengDartFallback(runtime.advanced);
      const orbital: OrbitalRuntime = {
        runtimeId: this.nextOrbitalId,
        skillId,
        angleRad,
        advanced: runtime.advanced,
        view
      };
      this.nextOrbitalId += 1;
      this.orbitals.push(orbital);
    }
  }

  private destroyProjectile(index: number): void {
    const [projectile] = this.projectiles.splice(index, 1);
    projectile.view.destroy();
  }

  private getLevelConfig(runtime: SkillRuntime): SkillLevelConfig {
    const config = skillConfigs[runtime.skillId];
    return config.levels[runtime.level - 1] ?? config.levels[0];
  }

  private getProjectileProfile(runtime: SkillRuntime): {
    damage: number;
    cooldownMs: number;
    range: number;
    projectileCount: number;
    radius: number;
    speed: number;
    pierce: number;
  } {
    const level = this.getLevelConfig(runtime);
    if (runtime.advanced && runtime.skillId === "yulong_sword_qi") {
      return {
        damage: level.damage + 8,
        cooldownMs: ADVANCED_YULONG_COOLDOWN_MS,
        range: (level.range ?? 740) + 80,
        projectileCount: 3,
        radius: Math.round((level.radius ?? 16) * 1.45),
        speed: (level.speed ?? 600) + 70,
        pierce: (level.pierce ?? 1) + 2
      };
    }

    return {
      damage: level.damage,
      cooldownMs: level.cooldownMs ?? 900,
      range: level.range ?? 680,
      projectileCount: level.projectileCount ?? 1,
      radius: level.radius ?? 14,
      speed: level.speed ?? 520,
      pierce: level.pierce ?? 0
    };
  }

  private getOrbitProfile(runtime: SkillRuntime): {
    damage: number;
    projectileCount: number;
    radius: number;
    rotationSpeedDegPerSecond: number;
    perEnemyHitCooldownMs: number;
  } {
    const level = this.getLevelConfig(runtime);
    return {
      damage: runtime.advanced ? level.damage + 4 : level.damage,
      projectileCount: (level.projectileCount ?? 1) + (runtime.advanced ? 2 : 0),
      radius: runtime.advanced ? 116 : (level.radius ?? 72),
      rotationSpeedDegPerSecond: (level.rotationSpeedDegPerSecond ?? 220) + (runtime.advanced ? 35 : 0),
      perEnemyHitCooldownMs: runtime.advanced ? 280 : (level.perEnemyHitCooldownMs ?? 450)
    };
  }

  private getWaveProfile(runtime: SkillRuntime): {
    damage: number;
    cooldownMs: number;
    radius: number;
    knockback: number;
  } {
    const level = this.getLevelConfig(runtime);
    return {
      damage: runtime.advanced ? level.damage + 12 : level.damage,
      cooldownMs: runtime.advanced ? 2200 : (level.cooldownMs ?? 3200),
      radius: runtime.advanced ? 190 : (level.radius ?? 95),
      knockback: runtime.advanced ? 70 : (level.knockback ?? 36)
    };
  }

  private getCooldownMs(runtime: SkillRuntime): number {
    if (skillConfigs[runtime.skillId].kind === "projectile") {
      return this.getProjectileProfile(runtime).cooldownMs;
    }
    if (skillConfigs[runtime.skillId].kind === "aoe") {
      return this.getWaveProfile(runtime).cooldownMs;
    }
    return 0;
  }

  private createYulongProjectileFallback(direction: Point, advanced: boolean): Phaser.GameObjects.Container | Phaser.GameObjects.Sprite {
    if (advanced && this.scene.textures.exists("skill_yulong_advanced_projectile")) {
      const view = this.scene.add.sprite(0, 0, "skill_yulong_advanced_projectile")
        .setDepth(14)
        .setOrigin(0.5)
        .setScale(0.92)
        .setAlpha(0.98)
        .setRotation(Math.atan2(direction.y, direction.x))
        .setBlendMode(Phaser.BlendModes.ADD);
      view.setData("spriteArt", true);
      return view;
    }

    if (this.scene.textures.exists("skill_yulong_projectile")) {
      const view = this.scene.add.sprite(0, 0, "skill_yulong_projectile")
        .setDepth(14)
        .setOrigin(0.5)
        .setScale(advanced ? 1.04 : 0.9)
        .setAlpha(advanced ? 1 : 0.95)
        .setRotation(Math.atan2(direction.y, direction.x));
      const animationKey = getArtAnimationKey("skill_yulong_projectile");
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
      }
      view.setData("spriteArt", true);
      return view;
    }

    const width = advanced ? 112 : 78;
    const height = advanced ? 22 : 16;
    const core = this.scene.add.ellipse(0, 0, width, height, advanced ? 0xe9fffb : 0xbff8f1, advanced ? 0.82 : 0.9)
      .setStrokeStyle(advanced ? 3 : 2, advanced ? 0xd8c76a : 0x39d6b5, advanced ? 0.95 : 0.95);
    const point = this.scene.add.triangle(width / 2 + 3, 0, -8, -14, -8, 14, 18, 0, 0xe9fffb, 0.95);
    const tail = this.scene.add.ellipse(-width / 2 + 5, 0, advanced ? 52 : 32, advanced ? 11 : 8, 0x39d6b5, advanced ? 0.38 : 0.28);
    const view = this.scene.add.container(0, 0, [tail, core, point])
      .setDepth(14)
      .setAlpha(advanced ? 0.98 : 0.92);
    view.setRotation(Math.atan2(direction.y, direction.x));
    return view;
  }

  private createHuifengDartFallback(advanced: boolean): Phaser.GameObjects.Container | Phaser.GameObjects.Sprite {
    const artKey = advanced ? "skill_huifeng_advanced_dart" : "skill_huifeng_dart";
    if (this.scene.textures.exists(artKey)) {
      const view = this.scene.add.sprite(0, 0, artKey)
        .setDepth(15)
        .setOrigin(0.5)
        .setAlpha(advanced ? 1 : 0.98)
        .setBlendMode(Phaser.BlendModes.ADD);
      view.setData("spriteArt", true);
      return view;
    }

    const bladeColor = advanced ? 0xd8c76a : 0xd7e4df;
    const edgeColor = advanced ? 0x39d6b5 : 0x52645d;
    const bladeA = this.scene.add.triangle(0, -1, 0, -18, 7, 0, 0, 18, bladeColor, 0.95)
      .setStrokeStyle(1, edgeColor, 0.9);
    const bladeB = this.scene.add.triangle(0, 1, -18, 0, 0, -7, 18, 0, bladeColor, 0.9)
      .setStrokeStyle(1, edgeColor, 0.84);
    const hub = this.scene.add.circle(0, 0, advanced ? 5 : 4, 0x14211b, 0.95)
      .setStrokeStyle(1, advanced ? 0xd8c76a : 0xd6c28d, 0.9);
    const trail = this.scene.add.circle(0, 0, advanced ? 24 : 18, 0x39d6b5, advanced ? 0.16 : 0.08)
      .setBlendMode(Phaser.BlendModes.ADD);
    return this.scene.add.container(0, 0, [trail, bladeA, bladeB, hub]).setDepth(15);
  }

  private createZhenshanWaveFallback(radius: number, advanced: boolean): Phaser.GameObjects.Container | Phaser.GameObjects.Sprite {
    const artKey = advanced ? "skill_zhenshan_advanced_wave" : "skill_zhenshan_wave";
    if (this.scene.textures.exists(artKey)) {
      const textureWidth = advanced ? 384 : 256;
      const baseScale = (radius * 2) / textureWidth;
      const view = this.scene.add.sprite(0, 0, artKey)
        .setDepth(12)
        .setOrigin(0.5)
        .setAlpha(advanced ? 0.86 : 0.78)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(baseScale * 0.32);
      view.setData("spriteArt", true);
      view.setData("baseScale", baseScale);
      return view;
    }

    const fill = this.scene.add.circle(0, 0, radius, advanced ? 0xd8c76a : 0x9bd39d, advanced ? 0.13 : 0.1);
    const outer = this.scene.add.circle(0, 0, radius, 0x000000, 0)
      .setStrokeStyle(advanced ? 4 : 3, advanced ? 0xd8c76a : 0xa8e3ad, advanced ? 0.82 : 0.72);
    const inner = this.scene.add.circle(0, 0, radius * 0.54, 0x000000, 0)
      .setStrokeStyle(2, advanced ? 0x39d6b5 : 0x6fcfb8, advanced ? 0.58 : 0.42);
    const view = this.scene.add.container(0, 0, [fill, outer, inner])
      .setDepth(12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.32);
    return view;
  }

  private createHitVfx(worldX: number, worldY: number): void {
    const { x: screenX, y: screenY } = this.worldToScreen(worldX, worldY);
    if (this.scene.textures.exists("vfx_hit_light")) {
      const view = this.scene.add.sprite(screenX, screenY, "vfx_hit_light")
        .setDepth(18)
        .setBlendMode(Phaser.BlendModes.ADD);
      const animationKey = getArtAnimationKey("vfx_hit_light");
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
      }
      view.setData("spriteArt", true);
      this.vfx.push({ view, worldX, worldY, ageMs: 0, durationMs: 160, type: "hit" });
      return;
    }

    const view = this.scene.add.circle(screenX, screenY, 28, 0xbff8f1, 0.55)
      .setStrokeStyle(2, 0x39d6b5, 0.78)
      .setDepth(18)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.vfx.push({ view, worldX, worldY, ageMs: 0, durationMs: 140, type: "hit" });
  }

  private createDeathVfx(worldX: number, worldY: number): void {
    const { x: screenX, y: screenY } = this.worldToScreen(worldX, worldY);
    if (this.scene.textures.exists("vfx_enemy_die")) {
      const view = this.scene.add.sprite(screenX, screenY, "vfx_enemy_die")
        .setDepth(17)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      const animationKey = getArtAnimationKey("vfx_enemy_die");
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
      }
      view.setData("spriteArt", true);
      this.vfx.push({ view, worldX, worldY, ageMs: 0, durationMs: 280, type: "die" });
      return;
    }

    const group = this.scene.add.container(screenX, screenY).setDepth(17);
    for (let index = 0; index < 5; index += 1) {
      const angle = (Math.PI * 2 * index) / 5;
      const shard = this.scene.add.rectangle(Math.cos(angle) * 8, Math.sin(angle) * 8, 12, 6, 0xc77b4b, 0.8)
        .setStrokeStyle(1, 0x5b2f28, 0.6)
        .setRotation(angle);
      group.add(shard);
    }
    this.vfx.push({ view: group, worldX, worldY, ageMs: 0, durationMs: 260, type: "die" });
  }

  private createAdvanceVfx(label: string): void {
    const heroWorld = this.options.getHeroWorld();
    const heroScreen = this.options.getHeroScreen();
    if (this.scene.textures.exists("vfx_skill_advance")) {
      const burst = this.scene.add.sprite(0, 0, "vfx_skill_advance")
        .setOrigin(0.5)
        .setAlpha(0.88)
        .setBlendMode(Phaser.BlendModes.ADD);
      const text = this.scene.add.text(0, -108, label, {
        color: "#f7f0d0",
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        fontStyle: "bold"
      }).setOrigin(0.5);
      const view = this.scene.add.container(heroScreen.x, heroScreen.y, [burst, text])
        .setDepth(90);
      this.vfx.push({
        view,
        worldX: heroWorld.x,
        worldY: heroWorld.y,
        ageMs: 0,
        durationMs: ADVANCE_VFX_DURATION_MS,
        type: "advance"
      });
      return;
    }

    const ringA = this.scene.add.circle(0, 0, 88, 0x39d6b5, 0.12)
      .setStrokeStyle(4, 0xd8c76a, 0.88);
    const ringB = this.scene.add.circle(0, 0, 132, 0x000000, 0)
      .setStrokeStyle(3, 0xe9fffb, 0.72);
    const text = this.scene.add.text(0, -116, label, {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "24px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const view = this.scene.add.container(heroScreen.x, heroScreen.y, [ringA, ringB, text])
      .setDepth(90)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.vfx.push({
      view,
      worldX: heroWorld.x,
      worldY: heroWorld.y,
      ageMs: 0,
      durationMs: ADVANCE_VFX_DURATION_MS,
      type: "advance"
    });
  }

  private updateProjectileScreenPosition(projectile: ProjectileRuntime): void {
    this.updateWorldAnchoredView(projectile.view, projectile.worldX, projectile.worldY);
  }

  private updateWorldAnchoredView(view: Phaser.GameObjects.Components.Transform, worldX: number, worldY: number): void {
    const { x, y } = this.worldToScreen(worldX, worldY);
    view.setPosition(x, y);
  }

  private updateVfx(deltaMs: number): void {
    for (let index = this.vfx.length - 1; index >= 0; index -= 1) {
      const vfx = this.vfx[index];
      vfx.ageMs += deltaMs;
      const { x, y } = this.worldToScreen(vfx.worldX, vfx.worldY);
      vfx.view.setPosition(x, y);
      const progress = Phaser.Math.Clamp(vfx.ageMs / vfx.durationMs, 0, 1);
      const alpha = 1 - progress;
      const spriteArt = vfx.view instanceof Phaser.GameObjects.Sprite && vfx.view.getData("spriteArt") === true;
      const scale = spriteArt
        ? vfx.type === "hit"
          ? 1 + progress * 0.18
          : vfx.type === "die"
            ? 0.94 + progress * 0.08
            : 0.82 + progress * 0.75
        : vfx.type === "hit"
          ? 1 + progress * 0.65
          : vfx.type === "advance"
            ? 0.82 + progress * 0.75
            : 1 - progress * 0.28;
      vfx.view.setAlpha(alpha * (spriteArt ? 1 : vfx.type === "hit" ? 0.55 : 0.9));
      vfx.view.setScale(scale);

      if (vfx.ageMs >= vfx.durationMs) {
        vfx.view.destroy();
        this.vfx.splice(index, 1);
      }
    }
  }

  private ageHitSamples(deltaMs: number): void {
    for (const sample of this.hitSamples) {
      sample.ageMs += deltaMs;
    }
    while (this.hitSamples.length > 0 && this.hitSamples[0].ageMs > 10000) {
      this.hitSamples.shift();
    }
  }

  private ageCooldownMap(cooldowns: Map<string, number>, deltaMs: number): void {
    for (const [key, value] of cooldowns) {
      const nextValue = value - deltaMs;
      if (nextValue <= 0) {
        cooldowns.delete(key);
      } else {
        cooldowns.set(key, nextValue);
      }
    }
  }

  private playThrottledHitSfx(): void {
    if (this.hitSfxCooldownMs > 0) {
      return;
    }
    this.hitSfxCooldownMs = HIT_SFX_THROTTLE_MS;
    this.options.playSfx("hit_light");
  }

  private formatSkills(): string {
    return this.getSkillSlots()
      .map((slot) => `${slot.displayName} Lv${slot.level}${slot.advanced ? "*" : ""}`)
      .join(", ");
  }

  private formatAdvancedSkills(): string {
    return this.getSkillSlots()
      .filter((slot) => slot.advanced)
      .map((slot) => slot.displayName)
      .join(", ");
  }

  private getSkillSlots(): SkillSlotSnapshot[] {
    return skillOrder
      .map((skillId) => this.skills.get(skillId))
      .filter((runtime): runtime is SkillRuntime => runtime !== undefined)
      .map((runtime) => ({
        skillId: runtime.skillId,
        displayName: this.getRuntimeDisplayName(runtime),
        level: runtime.level,
        advanced: runtime.advanced
      }));
  }

  private getRuntimeDisplayName(runtime: SkillRuntime): string {
    if (runtime.advanced) {
      return skillConfigs[runtime.skillId].advancement?.displayName ?? skillConfigs[runtime.skillId].displayName;
    }
    return skillConfigs[runtime.skillId].displayName;
  }

  private getAdvanceKeyDisplayName(keyId: AdvanceKeyId): string {
    if (keyId === "hidden_weapon_pouch") {
      return "暗器囊";
    }
    if (keyId === "inner_force_manual") {
      return "内劲心法";
    }
    return "剑谱残页";
  }

  private worldToScreen(worldX: number, worldY: number): Point {
    const heroWorld = this.options.getHeroWorld();
    const heroScreen = this.options.getHeroScreen();
    return {
      x: heroScreen.x + worldX - heroWorld.x,
      y: heroScreen.y + worldY - heroWorld.y
    };
  }
}

function getSpreadAngles(projectileCount: number): number[] {
  if (projectileCount <= 1) {
    return [0];
  }
  if (projectileCount === 2) {
    return [-7, 7];
  }

  const clampedCount = Math.min(5, projectileCount);
  const totalSpread = clampedCount >= 4 ? 34 : 32;
  const step = totalSpread / (clampedCount - 1);
  return Array.from({ length: clampedCount }, (_, index) => -totalSpread / 2 + index * step);
}

function rotatePoint(point: Point, degrees: number): Point {
  const radians = Phaser.Math.DegToRad(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  };
}

function getNumericData(view: Phaser.GameObjects.GameObject, key: string, fallback: number): number {
  const value = view.getData(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isEnemyTarget(target: CombatTargetSnapshot): target is EnemyTargetSnapshot {
  return !("targetKind" in target) || target.targetKind !== "boss";
}

function isBossDamageResult(result: CombatDamageResult): result is BossDamageResult {
  return "targetKind" in result && result.targetKind === "boss";
}

function getSkillHitTargetPayload(result: CombatDamageResult): Record<string, string | number> {
  if (isBossDamageResult(result)) {
    return {
      bossRuntimeId: result.runtimeId,
      bossId: result.bossId
    };
  }
  return {
    enemyRuntimeId: result.runtimeId,
    enemyId: result.enemyId
  };
}
