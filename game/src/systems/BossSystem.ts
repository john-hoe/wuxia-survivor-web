import Phaser from "phaser";
import { heifengChiefConfig, type BossAttackId, type BossConfig, type BossId, type BossState } from "../data/bosses";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";

type Point = {
  x: number;
  y: number;
};

type HeroDamageResult = {
  damaged: boolean;
  died: boolean;
  ignoredByInvincible: boolean;
};

type BossRuntime = {
  runtimeId: number;
  hp: number;
  worldX: number;
  worldY: number;
  state: BossState;
  stateMs: number;
  aliveMs: number;
  chargeCooldownMs: number;
  whirlwindCooldownMs: number;
  currentAttack: BossAttackId | "none";
  lastAttack: BossAttackId | "none";
  attackDamageApplied: boolean;
  lockedDirectionX: number;
  lockedDirectionY: number;
  hitCount: number;
  lastWarningDurationMs: number;
  lastAttackDamage: number;
  attacksUsed: Set<BossAttackId>;
  stageCleared: boolean;
  deathNotified: boolean;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  warningView?: Phaser.GameObjects.Container;
  attackView?: Phaser.GameObjects.Container;
};

type BossSystemOptions = {
  getElapsedSeconds: () => number;
  getHeroWorld: () => Point;
  getHeroScreen: () => Point;
  damageHero: (amount: number, source: string) => HeroDamageResult | undefined;
  onBossDefeated: (summary: BossDefeatSummary) => void;
  playSfx: (eventId: string) => void;
  config?: BossConfig;
};

export type BossTargetSnapshot = {
  targetKind: "boss";
  runtimeId: number;
  bossId: BossId;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  hp: number;
  maxHp: number;
  collisionRadius: number;
};

export type BossDamageResult = {
  targetKind: "boss";
  damaged: boolean;
  killed: boolean;
  runtimeId: number;
  bossId: BossId;
  amount: number;
  hp: number;
  maxHp: number;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
};

export type BossSystemSnapshot = {
  state: BossState;
  hp: number;
  maxHp: number;
  hpPercent: number;
  currentAttack: BossAttackId | "none";
  nextChargeSeconds: number;
  nextWhirlwindSeconds: number;
  lastWarningDuration: number;
  lastAttackDamage: number;
  aliveSeconds: number;
  hitCount: number;
  attacksUsed: string;
  stageCleared: boolean;
  runtimeId: number | null;
};

export type BossDefeatSummary = {
  bossId: BossId;
  displayName: string;
  copperReward: number;
  aliveSeconds: number;
  hitCount: number;
  attacksUsed: string[];
};

const BOSS_RUNTIME_ID = 900001;
const HERO_COLLISION_RADIUS = 18;
const INTRO_OFFSET_Y = -420;
const INTRO_TARGET_OFFSET_Y = -90;
const IDLE_ATTACK_CHECK_MS = 250;
const BOSS_SPRITE_SCALE = 0.58;

export class BossSystem {
  private readonly config: BossConfig;
  private runtime?: BossRuntime;
  private chooseAttackAccumulatorMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly options: BossSystemOptions) {
    this.config = options.config ?? heifengChiefConfig;
  }

  update(deltaMs: number): BossSystemSnapshot {
    const clampedDeltaMs = Math.min(deltaMs, 100);
    const runtime = this.runtime;
    if (!runtime) {
      return this.getSnapshot();
    }

    if (runtime.state !== "pending" && runtime.state !== "cleared") {
      runtime.aliveMs += clampedDeltaMs;
    }

    runtime.chargeCooldownMs = Math.max(0, runtime.chargeCooldownMs - clampedDeltaMs);
    runtime.whirlwindCooldownMs = Math.max(0, runtime.whirlwindCooldownMs - clampedDeltaMs);
    runtime.stateMs += clampedDeltaMs;

    switch (runtime.state) {
      case "intro":
        this.updateIntro(runtime);
        break;
      case "idle":
      case "choose_attack":
        this.updateIdle(runtime, clampedDeltaMs);
        break;
      case "charge_windup":
        this.updateChargeWindup(runtime);
        break;
      case "charge_slash":
        this.updateChargeSlash(runtime, clampedDeltaMs);
        break;
      case "whirlwind_windup":
        this.updateWhirlwindWindup(runtime);
        break;
      case "whirlwind":
        this.updateWhirlwind(runtime);
        break;
      case "hurt":
        this.transitionTo(runtime, "idle");
        break;
      case "dead":
        this.updateDead(runtime);
        break;
      case "pending":
      case "cleared":
        break;
    }

    if (runtime.state === "cleared") {
      return this.getSnapshot();
    }

    this.updateBossSpriteAnimation(runtime);
    this.applyContactDamage(runtime);
    this.updateScreenPosition(runtime);
    return this.getSnapshot();
  }

  requestSpawn(source: "director" | "debug" = "director"): boolean {
    if (this.runtime && this.runtime.state !== "pending") {
      return false;
    }

    const heroWorld = this.options.getHeroWorld();
    const spawnWorld = {
      x: heroWorld.x,
      y: heroWorld.y + INTRO_OFFSET_Y
    };
    const view = this.createBossView();
    const usesSpriteArt = view.getData("bossSpriteArt") === true;
    const shadow = this.scene.add.ellipse(0, 0, usesSpriteArt ? 108 : 86, usesSpriteArt ? 28 : 26, 0x050705, 0.36).setDepth(11);
    const runtime: BossRuntime = {
      runtimeId: BOSS_RUNTIME_ID,
      hp: this.config.maxHp,
      worldX: spawnWorld.x,
      worldY: spawnWorld.y,
      state: "intro",
      stateMs: 0,
      aliveMs: 0,
      chargeCooldownMs: 900,
      whirlwindCooldownMs: 2400,
      currentAttack: "none",
      lastAttack: "none",
      attackDamageApplied: false,
      lockedDirectionX: 0,
      lockedDirectionY: 1,
      hitCount: 0,
      lastWarningDurationMs: 0,
      lastAttackDamage: 0,
      attacksUsed: new Set<BossAttackId>(),
      stageCleared: false,
      deathNotified: false,
      view,
      shadow
    };
    this.runtime = runtime;
    this.updateScreenPosition(runtime);
    this.options.playSfx("boss_warning");
    eventBus.emit("boss_intro_started", {
      bossId: this.config.id,
      displayName: this.config.displayName,
      source,
      waveTimeSeconds: this.options.getElapsedSeconds()
    });
    eventBus.emit("boss_spawned", {
      bossId: this.config.id,
      displayName: this.config.displayName,
      hp: this.config.maxHp,
      maxHp: this.config.maxHp,
      waveTimeSeconds: this.options.getElapsedSeconds()
    });
    return true;
  }

  damageBoss(runtimeId: number, amount: number, source: string): BossDamageResult | undefined {
    const runtime = this.runtime;
    if (!runtime || runtime.runtimeId !== runtimeId || runtime.state === "pending" || runtime.state === "dead" || runtime.state === "cleared") {
      return undefined;
    }

    const damageAmount = Math.max(0, Math.floor(amount));
    if (damageAmount <= 0) {
      return undefined;
    }

    runtime.hp = Math.max(0, runtime.hp - damageAmount);
    runtime.hitCount += 1;
    this.flashBoss(runtime);
    const result = this.createDamageResult(runtime, damageAmount);
    eventBus.emit("boss_damaged", {
      bossId: this.config.id,
      source,
      amount: damageAmount,
      hp: runtime.hp,
      maxHp: this.config.maxHp
    });

    if (runtime.hp <= 0) {
      this.beginDeath(runtime, source);
      return { ...result, killed: true, hp: 0 };
    }

    return result;
  }

  debugDamageBoss(amount: number): BossDamageResult | undefined {
    const runtime = this.runtime;
    if (!runtime) {
      return undefined;
    }
    return this.damageBoss(runtime.runtimeId, amount, "debug_boss_damage");
  }

  isRuntimeId(runtimeId: number): boolean {
    return this.runtime?.runtimeId === runtimeId;
  }

  getTargets(): BossTargetSnapshot[] {
    const runtime = this.runtime;
    if (!runtime || runtime.state === "pending" || runtime.state === "dead" || runtime.state === "cleared") {
      return [];
    }
    return [this.createTargetSnapshot(runtime)];
  }

  getSnapshot(): BossSystemSnapshot {
    const runtime = this.runtime;
    if (!runtime) {
      return {
        state: "pending",
        hp: 0,
        maxHp: this.config.maxHp,
        hpPercent: 0,
        currentAttack: "none",
        nextChargeSeconds: 0,
        nextWhirlwindSeconds: 0,
        lastWarningDuration: 0,
        lastAttackDamage: 0,
        aliveSeconds: 0,
        hitCount: 0,
        attacksUsed: "",
        stageCleared: false,
        runtimeId: null
      };
    }

    return {
      state: runtime.state,
      hp: runtime.hp,
      maxHp: this.config.maxHp,
      hpPercent: Math.round((runtime.hp / this.config.maxHp) * 1000) / 10,
      currentAttack: runtime.currentAttack,
      nextChargeSeconds: Math.round((runtime.chargeCooldownMs / 1000) * 10) / 10,
      nextWhirlwindSeconds: Math.round((runtime.whirlwindCooldownMs / 1000) * 10) / 10,
      lastWarningDuration: Math.round((runtime.lastWarningDurationMs / 1000) * 100) / 100,
      lastAttackDamage: runtime.lastAttackDamage,
      aliveSeconds: Math.round((runtime.aliveMs / 1000) * 10) / 10,
      hitCount: runtime.hitCount,
      attacksUsed: Array.from(runtime.attacksUsed).join(","),
      stageCleared: runtime.stageCleared,
      runtimeId: runtime.runtimeId
    };
  }

  destroy(): void {
    if (!this.runtime) {
      return;
    }
    this.scene.tweens.killTweensOf(this.runtime.view);
    this.scene.tweens.killTweensOf(this.runtime.shadow);
    this.clearWarning(this.runtime);
    this.clearAttackView(this.runtime);
    this.runtime.shadow.destroy();
    this.runtime.view.destroy();
    this.runtime = undefined;
  }

  private updateIntro(runtime: BossRuntime): void {
    const heroWorld = this.options.getHeroWorld();
    const start = {
      x: heroWorld.x,
      y: heroWorld.y + INTRO_OFFSET_Y
    };
    const target = {
      x: heroWorld.x,
      y: heroWorld.y + INTRO_TARGET_OFFSET_Y
    };
    const introProgress = Phaser.Math.Clamp(runtime.stateMs / this.config.introMs, 0, 1);
    const easedProgress = Phaser.Math.Easing.Cubic.Out(introProgress);
    runtime.worldX = Phaser.Math.Linear(start.x, target.x, easedProgress);
    runtime.worldY = Phaser.Math.Linear(start.y, target.y, easedProgress);
    runtime.view.setAlpha(0.72 + introProgress * 0.28);
    this.setBossViewMotionScale(runtime, 1 + Math.sin(runtime.stateMs / 70) * 0.025);
    if (runtime.stateMs >= this.config.introMs) {
      runtime.view.setAlpha(1);
      this.setBossViewMotionScale(runtime, 1);
      this.transitionTo(runtime, "idle");
    }
  }

  private updateIdle(runtime: BossRuntime, deltaMs: number): void {
    const heroWorld = this.options.getHeroWorld();
    const distance = Math.hypot(runtime.worldX - heroWorld.x, runtime.worldY - heroWorld.y);
    if (distance > 120) {
      this.moveToward(runtime, heroWorld, this.config.moveSpeed, deltaMs);
    } else if (distance < 78) {
      this.moveAwayFrom(runtime, heroWorld, this.config.moveSpeed * 0.55, deltaMs);
    }

    this.chooseAttackAccumulatorMs += deltaMs;
    if (this.chooseAttackAccumulatorMs < IDLE_ATTACK_CHECK_MS) {
      return;
    }
    this.chooseAttackAccumulatorMs = 0;
    if (runtime.chargeCooldownMs <= 0 || runtime.whirlwindCooldownMs <= 0) {
      this.transitionTo(runtime, "choose_attack");
      this.startNextAttack(runtime);
    }
  }

  private updateChargeWindup(runtime: BossRuntime): void {
    this.updateWarningView(runtime);
    if (runtime.stateMs >= this.config.charge.warningMs) {
      this.clearWarning(runtime);
      runtime.attackDamageApplied = false;
      this.createChargeAttackView(runtime);
      this.transitionTo(runtime, "charge_slash", false);
      eventBus.emit("boss_attack_started", {
        bossId: this.config.id,
        attackId: "charge_slash",
        displayName: this.config.charge.displayName,
        damage: this.config.charge.damage
      });
    }
  }

  private updateChargeSlash(runtime: BossRuntime, deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    runtime.worldX += runtime.lockedDirectionX * this.config.charge.dashSpeed * deltaSeconds;
    runtime.worldY += runtime.lockedDirectionY * this.config.charge.dashSpeed * deltaSeconds;
    this.updateAttackView(runtime);

    const heroWorld = this.options.getHeroWorld();
    const distance = Math.hypot(heroWorld.x - runtime.worldX, heroWorld.y - runtime.worldY);
    if (distance <= this.config.collisionRadius + HERO_COLLISION_RADIUS + 8) {
      this.applyAttackDamageOnce(runtime, this.config.charge.damage, "boss_charge_slash");
    }

    if (runtime.stateMs >= this.config.charge.activeMs) {
      this.clearAttackView(runtime);
      runtime.chargeCooldownMs = this.config.charge.cooldownMs;
      runtime.lastAttack = "charge_slash";
      this.transitionTo(runtime, "idle");
    }
  }

  private updateWhirlwindWindup(runtime: BossRuntime): void {
    this.updateWarningView(runtime);
    if (runtime.stateMs >= this.config.whirlwind.warningMs) {
      this.clearWarning(runtime);
      runtime.attackDamageApplied = false;
      this.createWhirlwindAttackView(runtime);
      this.transitionTo(runtime, "whirlwind", false);
      eventBus.emit("boss_attack_started", {
        bossId: this.config.id,
        attackId: "whirlwind_blade",
        displayName: this.config.whirlwind.displayName,
        damage: this.config.whirlwind.damage
      });
    }
  }

  private updateWhirlwind(runtime: BossRuntime): void {
    const progress = Phaser.Math.Clamp(runtime.stateMs / this.config.whirlwind.activeMs, 0, 1);
    const radius = Phaser.Math.Linear(this.config.whirlwind.startRadius, this.config.whirlwind.endRadius, progress);
    this.updateWhirlwindAttackView(runtime, radius, progress);
    const heroWorld = this.options.getHeroWorld();
    const distance = Math.hypot(heroWorld.x - runtime.worldX, heroWorld.y - runtime.worldY);
    if (distance <= radius + HERO_COLLISION_RADIUS) {
      this.applyAttackDamageOnce(runtime, this.config.whirlwind.damage, "boss_whirlwind_blade");
    }
    if (runtime.stateMs >= this.config.whirlwind.activeMs) {
      this.clearAttackView(runtime);
      runtime.whirlwindCooldownMs = this.config.whirlwind.cooldownMs;
      runtime.lastAttack = "whirlwind_blade";
      this.transitionTo(runtime, "idle");
    }
  }

  private updateDead(runtime: BossRuntime): void {
    const progress = Phaser.Math.Clamp(runtime.stateMs / 900, 0, 1);
    runtime.view.setAlpha(1 - progress);
    this.setBossViewMotionScale(runtime, 1 + progress * 0.28);
    runtime.shadow.setAlpha(0.36 * (1 - progress));
    if (runtime.stateMs < 900 || runtime.deathNotified) {
      return;
    }

    runtime.deathNotified = true;
    runtime.stageCleared = true;
    this.transitionTo(runtime, "cleared");
    eventBus.emit("stage_cleared", {
      stageId: "qingshi_mountain_road",
      bossId: this.config.id,
      copperReward: this.config.copperReward
    });
    this.options.onBossDefeated({
      bossId: this.config.id,
      displayName: this.config.displayName,
      copperReward: this.config.copperReward,
      aliveSeconds: Math.round(runtime.aliveMs / 1000),
      hitCount: runtime.hitCount,
      attacksUsed: Array.from(runtime.attacksUsed)
    });
  }

  private startNextAttack(runtime: BossRuntime): void {
    const preferCharge = !runtime.attacksUsed.has("charge_slash")
      || (runtime.chargeCooldownMs <= 0 && runtime.lastAttack !== "charge_slash")
      || runtime.whirlwindCooldownMs > 0;
    const attackId: BossAttackId = preferCharge && runtime.chargeCooldownMs <= 0
      ? "charge_slash"
      : runtime.whirlwindCooldownMs <= 0
        ? "whirlwind_blade"
        : "charge_slash";

    if (attackId === "charge_slash") {
      this.startChargeWindup(runtime);
    } else {
      this.startWhirlwindWindup(runtime);
    }
  }

  private startChargeWindup(runtime: BossRuntime): void {
    const heroWorld = this.options.getHeroWorld();
    const dx = heroWorld.x - runtime.worldX;
    const dy = heroWorld.y - runtime.worldY;
    const length = Math.max(1, Math.hypot(dx, dy));
    runtime.lockedDirectionX = dx / length;
    runtime.lockedDirectionY = dy / length;
    runtime.currentAttack = "charge_slash";
    runtime.lastWarningDurationMs = this.config.charge.warningMs;
    runtime.attacksUsed.add("charge_slash");
    this.createChargeWarning(runtime);
    this.options.playSfx("boss_warning");
    eventBus.emit("boss_attack_warning", {
      bossId: this.config.id,
      attackId: "charge_slash",
      displayName: this.config.charge.displayName,
      warningDurationMs: this.config.charge.warningMs,
      damage: this.config.charge.damage
    });
    this.transitionTo(runtime, "charge_windup", false);
  }

  private startWhirlwindWindup(runtime: BossRuntime): void {
    runtime.currentAttack = "whirlwind_blade";
    runtime.lastWarningDurationMs = this.config.whirlwind.warningMs;
    runtime.attacksUsed.add("whirlwind_blade");
    this.createWhirlwindWarning(runtime);
    this.options.playSfx("boss_warning");
    eventBus.emit("boss_attack_warning", {
      bossId: this.config.id,
      attackId: "whirlwind_blade",
      displayName: this.config.whirlwind.displayName,
      warningDurationMs: this.config.whirlwind.warningMs,
      damage: this.config.whirlwind.damage
    });
    this.transitionTo(runtime, "whirlwind_windup", false);
  }

  private beginDeath(runtime: BossRuntime, source: string): void {
    this.clearWarning(runtime);
    this.clearAttackView(runtime);
    runtime.stageCleared = true;
    runtime.currentAttack = "none";
    runtime.lastAttack = runtime.lastAttack === "none" ? runtime.currentAttack : runtime.lastAttack;
    this.options.playSfx("boss_defeated");
    eventBus.emit("boss_defeated", {
      bossId: this.config.id,
      source,
      copperReward: this.config.copperReward,
      aliveSeconds: Math.round(runtime.aliveMs / 1000),
      hitCount: runtime.hitCount,
      attacksUsed: Array.from(runtime.attacksUsed)
    });
    this.createBossDeathBurst(runtime);
    this.transitionTo(runtime, "dead");
  }

  private applyContactDamage(runtime: BossRuntime): void {
    if (runtime.state === "pending" || runtime.state === "dead" || runtime.state === "cleared") {
      return;
    }
    if (runtime.currentAttack !== "none") {
      return;
    }
    const heroWorld = this.options.getHeroWorld();
    const distance = Math.hypot(heroWorld.x - runtime.worldX, heroWorld.y - runtime.worldY);
    if (distance > this.config.collisionRadius + HERO_COLLISION_RADIUS) {
      return;
    }
    const result = this.options.damageHero(this.config.contactDamage, "boss_contact");
    if (!result?.damaged) {
      return;
    }
    runtime.lastAttackDamage = this.config.contactDamage;
    eventBus.emit("boss_attack_hit", {
      bossId: this.config.id,
      attackId: "contact",
      amount: this.config.contactDamage,
      killedHero: result.died
    });
  }

  private applyAttackDamageOnce(runtime: BossRuntime, amount: number, source: string): void {
    if (runtime.attackDamageApplied) {
      return;
    }
    const result = this.options.damageHero(amount, source);
    if (result?.ignoredByInvincible) {
      runtime.attackDamageApplied = true;
      return;
    }
    if (!result?.damaged) {
      return;
    }
    runtime.attackDamageApplied = true;
    runtime.lastAttackDamage = amount;
    eventBus.emit("boss_attack_hit", {
      bossId: this.config.id,
      attackId: runtime.currentAttack,
      amount,
      killedHero: result.died
    });
  }

  private transitionTo(runtime: BossRuntime, state: BossState, resetAttack = true): void {
    runtime.state = state;
    runtime.stateMs = 0;
    if (resetAttack && (state === "idle" || state === "cleared")) {
      runtime.currentAttack = "none";
      runtime.attackDamageApplied = false;
    }
  }

  private moveToward(runtime: BossRuntime, target: Point, speed: number, deltaMs: number): void {
    const dx = target.x - runtime.worldX;
    const dy = target.y - runtime.worldY;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1) {
      return;
    }
    const step = Math.min(distance, speed * (deltaMs / 1000));
    runtime.worldX += (dx / distance) * step;
    runtime.worldY += (dy / distance) * step;
  }

  private moveAwayFrom(runtime: BossRuntime, target: Point, speed: number, deltaMs: number): void {
    const dx = runtime.worldX - target.x;
    const dy = runtime.worldY - target.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const step = speed * (deltaMs / 1000);
    runtime.worldX += (dx / distance) * step;
    runtime.worldY += (dy / distance) * step;
  }

  private createTargetSnapshot(runtime: BossRuntime): BossTargetSnapshot {
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    return {
      targetKind: "boss",
      runtimeId: runtime.runtimeId,
      bossId: this.config.id,
      worldX: runtime.worldX,
      worldY: runtime.worldY,
      screenX: screen.x,
      screenY: screen.y,
      hp: runtime.hp,
      maxHp: this.config.maxHp,
      collisionRadius: this.config.collisionRadius
    };
  }

  private createDamageResult(runtime: BossRuntime, amount: number): BossDamageResult {
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    return {
      targetKind: "boss",
      damaged: true,
      killed: false,
      runtimeId: runtime.runtimeId,
      bossId: this.config.id,
      amount,
      hp: runtime.hp,
      maxHp: this.config.maxHp,
      worldX: runtime.worldX,
      worldY: runtime.worldY,
      screenX: screen.x,
      screenY: screen.y
    };
  }

  private createBossView(): Phaser.GameObjects.Container | Phaser.GameObjects.Sprite {
    if (this.scene.textures.exists("boss_heifeng_idle")) {
      const bossView = this.scene.add.sprite(0, 0, "boss_heifeng_idle")
        .setDepth(13)
        .setOrigin(0.5, 0.66)
        .setScale(BOSS_SPRITE_SCALE)
        .setAlpha(0.98);
      const animationKey = getArtAnimationKey("boss_heifeng_idle");
      if (this.scene.anims.exists(animationKey)) {
        bossView.play(animationKey);
      }
      bossView.setData("bossSpriteArt", true);
      bossView.setData("baseScale", BOSS_SPRITE_SCALE);
      bossView.setData("motionScale", 1);
      bossView.setData("facingLeft", false);
      bossView.setData("shadowOffsetY", 56);
      return bossView;
    }

    const backRobe = this.scene.add.ellipse(0, 13, 72, 82, 0x3a1714, 0.98)
      .setStrokeStyle(3, 0x8f4b2f, 0.92);
    const torso = this.scene.add.ellipse(0, 0, 58, 70, 0x5b211b, 1)
      .setStrokeStyle(2, 0xd6a15e, 0.82);
    const head = this.scene.add.circle(0, -46, 23, 0x8b5740, 1)
      .setStrokeStyle(2, 0x1a0d0b, 0.9);
    const brow = this.scene.add.rectangle(0, -53, 38, 7, 0x17100f, 0.98);
    const beard = this.scene.add.triangle(0, -26, -14, -37, 14, -37, 0, -5, 0x18110f, 0.96);
    const leftArm = this.scene.add.rectangle(-39, 1, 16, 58, 0x4b1b17, 0.96)
      .setStrokeStyle(1, 0xd6a15e, 0.66)
      .setRotation(-0.42);
    const rightArm = this.scene.add.rectangle(42, 2, 16, 62, 0x4b1b17, 0.96)
      .setStrokeStyle(1, 0xd6a15e, 0.66)
      .setRotation(0.44);
    const blade = this.scene.add.rectangle(58, -8, 10, 86, 0xd8d3bf, 0.94)
      .setStrokeStyle(1, 0x705f40, 0.8)
      .setRotation(-0.72);
    const dangerCore = this.scene.add.circle(0, 8, 14, 0xb83a2f, 0.44)
      .setBlendMode(Phaser.BlendModes.ADD);
    const bossView = this.scene.add.container(0, 0, [backRobe, leftArm, rightArm, torso, dangerCore, blade, head, brow, beard])
      .setDepth(13);
    bossView.setData("baseScale", 1);
    bossView.setData("motionScale", 1);
    bossView.setData("facingLeft", false);
    return bossView;
  }

  private createChargeWarning(runtime: BossRuntime): void {
    this.clearWarning(runtime);
    const length = this.config.charge.warningLength;
    const width = this.config.charge.warningWidth;
    const centerOffset = this.config.collisionRadius + length / 2;
    if (this.scene.textures.exists("vfx_boss_charge_warning")) {
      const strip = this.scene.add.image(centerOffset, 0, "vfx_boss_charge_warning")
        .setDisplaySize(length, width * 1.45)
        .setOrigin(0.5)
        .setAlpha(0.9)
        .setBlendMode(Phaser.BlendModes.ADD);
      runtime.warningView = this.scene.add.container(0, 0, [strip])
        .setDepth(33);
      runtime.warningView.setRotation(Math.atan2(runtime.lockedDirectionY, runtime.lockedDirectionX));
      this.updateWarningView(runtime);
      return;
    }

    const strip = this.scene.add.rectangle(centerOffset, 0, length, width, 0xc83a2f, 0.18)
      .setStrokeStyle(3, 0xffd37a, 0.84)
      .setOrigin(0.5);
    const centerLine = this.scene.add.rectangle(centerOffset, 0, length, 4, 0xfff0b0, 0.72)
      .setOrigin(0.5);
    const front = this.scene.add.triangle(centerOffset + length / 2, 0, -16, -28, -16, 28, 24, 0, 0xffd37a, 0.58);
    runtime.warningView = this.scene.add.container(0, 0, [strip, centerLine, front])
      .setDepth(33)
      .setBlendMode(Phaser.BlendModes.ADD);
    runtime.warningView.setRotation(Math.atan2(runtime.lockedDirectionY, runtime.lockedDirectionX));
    this.updateWarningView(runtime);
  }

  private createWhirlwindWarning(runtime: BossRuntime): void {
    this.clearWarning(runtime);
    if (this.scene.textures.exists("vfx_boss_whirlwind_warning")) {
      const diameter = this.config.whirlwind.endRadius * 2;
      const marker = this.scene.add.image(0, 0, "vfx_boss_whirlwind_warning")
        .setDisplaySize(diameter, diameter)
        .setOrigin(0.5)
        .setAlpha(0.9)
        .setBlendMode(Phaser.BlendModes.ADD);
      runtime.warningView = this.scene.add.container(0, 0, [marker])
        .setDepth(32);
      this.updateWarningView(runtime);
      return;
    }

    const outer = this.scene.add.circle(0, 0, this.config.whirlwind.endRadius, 0xc83a2f, 0.08)
      .setStrokeStyle(4, 0xffd37a, 0.82);
    const inner = this.scene.add.circle(0, 0, this.config.whirlwind.startRadius, 0x000000, 0)
      .setStrokeStyle(2, 0xf7f0d0, 0.62);
    const slashA = this.scene.add.rectangle(0, 0, this.config.whirlwind.endRadius * 2, 5, 0xfff0b0, 0.5)
      .setRotation(0.32);
    const slashB = this.scene.add.rectangle(0, 0, this.config.whirlwind.endRadius * 2, 5, 0xfff0b0, 0.42)
      .setRotation(-0.58);
    runtime.warningView = this.scene.add.container(0, 0, [outer, inner, slashA, slashB])
      .setDepth(32)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.updateWarningView(runtime);
  }

  private createChargeAttackView(runtime: BossRuntime): void {
    const glow = this.scene.add.ellipse(0, 0, 104, 40, 0xffd37a, 0.2)
      .setStrokeStyle(2, 0xfff0b0, 0.82);
    const slash = this.scene.add.rectangle(-8, 0, 124, 8, 0xf7f0d0, 0.72)
      .setRotation(-0.18);
    runtime.attackView = this.scene.add.container(0, 0, [glow, slash])
      .setDepth(34)
      .setBlendMode(Phaser.BlendModes.ADD);
    runtime.attackView.setRotation(Math.atan2(runtime.lockedDirectionY, runtime.lockedDirectionX));
    this.updateAttackView(runtime);
  }

  private createWhirlwindAttackView(runtime: BossRuntime): void {
    const outer = this.scene.add.circle(0, 0, this.config.whirlwind.startRadius, 0xf0d678, 0.08)
      .setStrokeStyle(4, 0xf7f0d0, 0.86);
    const bladeA = this.scene.add.rectangle(0, 0, this.config.whirlwind.startRadius * 2, 7, 0xf7f0d0, 0.72);
    const bladeB = this.scene.add.rectangle(0, 0, this.config.whirlwind.startRadius * 2, 7, 0xffd37a, 0.54)
      .setRotation(Math.PI / 2);
    runtime.attackView = this.scene.add.container(0, 0, [outer, bladeA, bladeB])
      .setDepth(34)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.updateWhirlwindAttackView(runtime, this.config.whirlwind.startRadius, 0);
  }

  private createBossDeathBurst(runtime: BossRuntime): void {
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    const burst = this.scene.add.container(screen.x, screen.y).setDepth(36);
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const shard = this.scene.add.rectangle(Math.cos(angle) * 18, Math.sin(angle) * 18, 22, 8, index % 2 === 0 ? 0xd6a15e : 0x8f4b2f, 0.82)
        .setRotation(angle);
      burst.add(shard);
    }
    this.scene.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 1.9,
      duration: 620,
      ease: "Quad.easeOut",
      onComplete: () => burst.destroy()
    });
  }

  private updateWarningView(runtime: BossRuntime): void {
    if (!runtime.warningView) {
      return;
    }
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    runtime.warningView.setPosition(screen.x, screen.y);
    const pulse = 0.8 + Math.sin(runtime.stateMs / 55) * 0.12;
    runtime.warningView.setAlpha(Phaser.Math.Clamp(pulse, 0.55, 0.95));
  }

  private updateAttackView(runtime: BossRuntime): void {
    if (!runtime.attackView) {
      return;
    }
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    runtime.attackView.setPosition(screen.x, screen.y);
    runtime.attackView.setAlpha(0.88);
  }

  private updateWhirlwindAttackView(runtime: BossRuntime, radius: number, progress: number): void {
    if (!runtime.attackView) {
      return;
    }
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    runtime.attackView.setPosition(screen.x, screen.y);
    runtime.attackView.setRotation(progress * Math.PI * 4);
    runtime.attackView.setScale(radius / this.config.whirlwind.startRadius);
    runtime.attackView.setAlpha(Math.max(0.18, 0.78 * (1 - progress * 0.42)));
  }

  private updateScreenPosition(runtime: BossRuntime): void {
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    runtime.view.setPosition(screen.x, screen.y);
    const shadowOffsetY = (runtime.view.getData("shadowOffsetY") as number | undefined) ?? this.config.visualRadius * 0.58;
    runtime.shadow.setPosition(screen.x, screen.y + shadowOffsetY);
    runtime.view.setData("facingLeft", this.shouldFaceLeft(runtime));
    this.applyBossViewScale(runtime);
  }

  private clearWarning(runtime: BossRuntime): void {
    runtime.warningView?.destroy();
    runtime.warningView = undefined;
  }

  private clearAttackView(runtime: BossRuntime): void {
    runtime.attackView?.destroy();
    runtime.attackView = undefined;
  }

  private flashBoss(runtime: BossRuntime): void {
    runtime.view.setAlpha(0.58);
    this.scene.tweens.add({
      targets: runtime.view,
      alpha: 1,
      duration: 110,
      ease: "Quad.easeOut"
    });
  }

  private updateBossSpriteAnimation(runtime: BossRuntime): void {
    if (!(runtime.view instanceof Phaser.GameObjects.Sprite) || runtime.view.getData("bossSpriteArt") !== true) {
      return;
    }

    const assetId = isBossAttackState(runtime.state) ? "boss_heifeng_attack" : "boss_heifeng_idle";
    if (!this.scene.textures.exists(assetId)) {
      return;
    }

    if (runtime.view.texture.key !== assetId) {
      runtime.view.setTexture(assetId);
    }

    const animationKey = getArtAnimationKey(assetId);
    if (this.scene.anims.exists(animationKey) && runtime.view.anims.currentAnim?.key !== animationKey) {
      runtime.view.play(animationKey);
    }
  }

  private setBossViewMotionScale(runtime: BossRuntime, motionScale: number): void {
    runtime.view.setData("motionScale", motionScale);
    this.applyBossViewScale(runtime);
  }

  private applyBossViewScale(runtime: BossRuntime): void {
    const baseScale = (runtime.view.getData("baseScale") as number | undefined) ?? 1;
    const motionScale = (runtime.view.getData("motionScale") as number | undefined) ?? 1;
    const facingLeft = (runtime.view.getData("facingLeft") as boolean | undefined) ?? false;
    runtime.view.setScale((facingLeft ? -1 : 1) * baseScale * motionScale, baseScale * motionScale);
    runtime.shadow.setScale(Math.max(0.55, motionScale));
  }

  private shouldFaceLeft(runtime: BossRuntime): boolean {
    if ((runtime.state === "charge_windup" || runtime.state === "charge_slash") && Math.abs(runtime.lockedDirectionX) > 0.04) {
      return runtime.lockedDirectionX < 0;
    }

    return this.options.getHeroWorld().x - runtime.worldX < 0;
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

function isBossAttackState(state: BossState): boolean {
  return state === "charge_windup" || state === "charge_slash" || state === "whirlwind_windup" || state === "whirlwind";
}
