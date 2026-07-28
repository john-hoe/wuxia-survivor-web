import Phaser from "phaser";
import { heifengChiefConfig, type BossAttackId, type BossConfig, type BossId, type BossState } from "../data/bosses";
import { eventBus } from "../utils/EventBus";
import type { GameEventName } from "../types";
import { getArtAnimationKey } from "../utils/artAssets";
import { JuiceSystem } from "./JuiceSystem";

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
  hitSquashMs: number;
  ghostCooldownMs: number;
  chargeGhostsSpawned: number;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  auraRing: Phaser.GameObjects.Image;
  inkShadow: Phaser.GameObjects.Image;
  introSlamLanded: boolean;
  windupRecoilMs: number;
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
// 素材 2 倍高清化：boss 帧尺寸 ×2（208→416），缩放系数 ÷2（0.58→0.29）保持屏幕显示尺寸不变。
const BOSS_SPRITE_SCALE = 0.29;
/** 气场升级：Boss 显示尺寸在现有 viewScale 基准上乘法叠加（碰撞半径不变） */
const BOSS_SIZE_MULTIPLIER = 1.35;
/** 常驻气环：半径≈视觉半径×体型倍率×1.1，呼吸 alpha 区间 */
const AURA_RING_RADIUS_FACTOR = 1.1;
const AURA_RING_ALPHA_MIN = 0.18;
const AURA_RING_ALPHA_MAX = 0.32;
const AURA_RING_BREATH_MS = 980;
/** 气环之下的墨黑软椭圆投影：比气环略大 */
const INK_SHADOW_RADIUS_FACTOR = 1.18;
const INK_SHADOW_ALPHA = 0.32;
/** 出场落地一击：400ms 加速下落 + 80ms 落地顿，落地帧墨环冲击波扩散 500ms */
const INTRO_FALL_MS = 400;
const INTRO_LAND_HOLD_MS = 80;
const SLAM_SHOCKWAVE_MS = 500;
/** 程序化气场纹理：画布尺寸、渐变外缘半径、气环环带中心半径（均为纹理像素） */
const AURA_TEXTURE_SIZE = 256;
const AURA_TEXTURE_GRADIENT_RADIUS = 124;
const AURA_TEXTURE_RING_BAND_RADIUS = 102;
/** windup 蓄力压扁 0.94，出手帧 1.06 回弹后归位 */
const WINDUP_SQUASH = 0.94;
const WINDUP_RECOIL = 1.06;
const WINDUP_RECOIL_MS = 140;
/** 受击白闪（Boss 用金色）与 squash 回弹时长 */
const HIT_FLASH_MS = 80;
const HIT_SQUASH_MS = 60;
const HIT_FLASH_TINT = 0xf6d472;
/** windup 蓄力 tint（出手时清除） */
const WINDUP_TINT = 0xff6b5e;
/** 冲锋残影：生成间隔与单次冲锋上限 */
const CHARGE_GHOST_INTERVAL_MS = 90;
const CHARGE_GHOST_MAX = 3;
/** 死亡慢镜：time/tweens 双时间轴减速倍率与持续（游戏毫秒 ≈ 400ms 真实时间） */
const DEATH_SLOWMO_SCALE = 0.3;
const DEATH_SLOWMO_GAME_MS = Math.round(400 * DEATH_SLOWMO_SCALE);

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
    runtime.hitSquashMs = Math.max(0, runtime.hitSquashMs - clampedDeltaMs);
    runtime.windupRecoilMs = Math.max(0, runtime.windupRecoilMs - clampedDeltaMs);
    runtime.ghostCooldownMs = Math.max(0, runtime.ghostCooldownMs - clampedDeltaMs);
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
    // 气场层：墨黑软椭圆投影（下）+ 朱砂气环（上），depth 均低于 Boss view(13)
    const { auraRing, inkShadow } = this.createAuraViews();
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
      hitSquashMs: 0,
      windupRecoilMs: 0,
      ghostCooldownMs: 0,
      chargeGhostsSpawned: 0,
      introSlamLanded: false,
      view,
      shadow,
      auraRing,
      inkShadow
    };
    this.runtime = runtime;
    this.startAuraBreathing(runtime);
    this.updateScreenPosition(runtime);
    this.options.playSfx("boss_warning");
    eventBus.emit("boss_intro_started", {
      bossId: this.config.id,
      displayName: this.config.displayName,
      source,
      waveTimeSeconds: this.options.getElapsedSeconds()
    });
    this.options.playSfx("boss_intro");
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
    // 慢镜可能在销毁时仍激活，恢复双时间轴
    this.scene.time.timeScale = 1;
    this.scene.tweens.timeScale = 1;
    this.scene.tweens.killTweensOf(this.runtime.view);
    this.scene.tweens.killTweensOf(this.runtime.shadow);
    this.scene.tweens.killTweensOf(this.runtime.auraRing);
    this.scene.tweens.killTweensOf(this.runtime.inkShadow);
    this.clearWarning(this.runtime);
    this.clearAttackView(this.runtime);
    this.runtime.auraRing.destroy();
    this.runtime.inkShadow.destroy();
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
    // 墨晕/压暗的 alpha 渐显保持原有节奏（横跨整个 introMs）
    const introProgress = Phaser.Math.Clamp(runtime.stateMs / this.config.introMs, 0, 1);
    runtime.view.setAlpha(0.72 + introProgress * 0.28);

    if (!runtime.introSlamLanded) {
      // 出场落地一击：400ms 加速下落（Cubic.In），从屏幕上缘外砸向出场位
      const fallProgress = Phaser.Math.Clamp(runtime.stateMs / INTRO_FALL_MS, 0, 1);
      const easedFall = Phaser.Math.Easing.Cubic.In(fallProgress);
      runtime.worldX = Phaser.Math.Linear(start.x, target.x, easedFall);
      runtime.worldY = Phaser.Math.Linear(start.y, target.y, easedFall);
      this.setBossViewMotionScale(runtime, 1 + Math.sin(runtime.stateMs / 70) * 0.025);
      if (fallProgress >= 1) {
        runtime.introSlamLanded = true;
        runtime.worldX = target.x;
        runtime.worldY = target.y;
        this.createSlamShockwave(runtime);
        // 防御性广播：GameScene 可接震屏/音效；事件名未列入 GameEventName 联合类型时以断言兜底
        const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
        eventBus.emit("boss_slam_landed" as GameEventName, {
          bossId: this.config.id,
          worldX: runtime.worldX,
          worldY: runtime.worldY,
          screenX: screen.x,
          screenY: screen.y
        });
      }
      return;
    }

    // 落地顿 80ms：压扁回弹，之后在原位维持微浮动直至 intro 结束切入战斗态
    const holdProgress = Phaser.Math.Clamp((runtime.stateMs - INTRO_FALL_MS) / INTRO_LAND_HOLD_MS, 0, 1);
    runtime.worldX = target.x;
    runtime.worldY = target.y;
    if (holdProgress < 1) {
      this.setBossViewMotionScale(runtime, Phaser.Math.Linear(0.92, 1, Phaser.Math.Easing.Quadratic.Out(holdProgress)));
    } else {
      this.setBossViewMotionScale(runtime, 1 + Math.sin(runtime.stateMs / 70) * 0.012);
    }
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
      this.clearWindupTint(runtime);
      runtime.attackDamageApplied = false;
      runtime.windupRecoilMs = WINDUP_RECOIL_MS;
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
    this.spawnChargeGhostIfReady(runtime);

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
      this.clearWindupTint(runtime);
      runtime.attackDamageApplied = false;
      runtime.windupRecoilMs = WINDUP_RECOIL_MS;
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
    // 气环随死亡演出消散：略扩散并淡出（呼吸 Tween 已在 beginDeath 停止）
    runtime.auraRing.setAlpha(AURA_RING_ALPHA_MAX * (1 - progress));
    const ringBaseScale = (runtime.auraRing.getData("baseDisplayScale") as number | undefined) ?? 1;
    runtime.auraRing.setScale(ringBaseScale * (1 + progress * 0.45));
    runtime.inkShadow.setAlpha(INK_SHADOW_ALPHA * (1 - progress));
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
    runtime.chargeGhostsSpawned = 0;
    runtime.ghostCooldownMs = 0;
    this.applyWindupTint(runtime);
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
    this.applyWindupTint(runtime);
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
    this.clearWindupTint(runtime);
    runtime.windupRecoilMs = 0;
    // 停止气环呼吸 Tween，交由 updateDead 做消散演出
    this.scene.tweens.killTweensOf(runtime.auraRing);
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
    // 死亡演出：强震 + 暖白闪 + 金屑爆发 + 400ms 慢镜（time/tweens 双时间轴减速）
    const juice = JuiceSystem.get(this.scene);
    juice.bossDeath();
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    juice.goldBurst(screen.x, screen.y, 32);
    this.scene.time.timeScale = DEATH_SLOWMO_SCALE;
    this.scene.tweens.timeScale = DEATH_SLOWMO_SCALE;
    this.scene.time.delayedCall(DEATH_SLOWMO_GAME_MS, () => {
      this.scene.time.timeScale = 1;
      this.scene.tweens.timeScale = 1;
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
      // 体型升级：在现有 viewScale 基准上乘法叠加 1.35 倍
      const spriteScale = BOSS_SPRITE_SCALE * BOSS_SIZE_MULTIPLIER;
      const bossView = this.scene.add.sprite(0, 0, "boss_heifeng_idle")
        .setDepth(13)
        .setOrigin(0.5, 0.66)
        .setScale(spriteScale)
        .setAlpha(0.98);
      const animationKey = getArtAnimationKey("boss_heifeng_idle");
      if (this.scene.anims.exists(animationKey)) {
        bossView.play(animationKey);
      }
      bossView.setData("bossSpriteArt", true);
      bossView.setData("baseScale", spriteScale);
      bossView.setData("motionScale", 1);
      bossView.setData("facingLeft", false);
      // shadowOffsetY 为屏幕显示空间偏移（显示尺寸不变故不改）；applyBossViewScale 全程乘法叠加 baseScale，自动适配。
      bossView.setData("shadowOffsetY", 56 * BOSS_SIZE_MULTIPLIER);
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
    bossView.setData("baseScale", 1 * BOSS_SIZE_MULTIPLIER);
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
    centerLine.setData("warningInner", true);
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
    inner.setData("warningInner", true);
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

  /** 气场层：墨黑软椭圆投影（下，比气环略大）+ 朱砂气环（上），均低于 Boss view(13)。
   *  2 倍素材适配确认：ringRadius/inkRadius 由 config.visualRadius（世界单位）推算，不含帧像素，自动适配无需改动。 */
  private createAuraViews(): { auraRing: Phaser.GameObjects.Image; inkShadow: Phaser.GameObjects.Image } {
    this.ensureAuraTextures();
    const ringRadius = this.config.visualRadius * BOSS_SIZE_MULTIPLIER * AURA_RING_RADIUS_FACTOR;
    const inkRadius = ringRadius * INK_SHADOW_RADIUS_FACTOR;

    // 墨黑软椭圆投影：径向渐变圆形纹理压扁 0.42 成软椭圆
    const inkShadow = this.scene.add.image(0, 0, "boss_ink_shadow")
      .setDepth(11.4)
      .setAlpha(INK_SHADOW_ALPHA);
    const inkScale = inkRadius / AURA_TEXTURE_GRADIENT_RADIUS;
    inkShadow.setScale(inkScale, inkScale * 0.42);

    // 朱砂气环：环带中心半径对齐 ringRadius
    const auraRing = this.scene.add.image(0, 0, "boss_aura_ring")
      .setDepth(11.5)
      .setAlpha(AURA_RING_ALPHA_MIN);
    const ringScale = ringRadius / AURA_TEXTURE_RING_BAND_RADIUS;
    auraRing.setScale(ringScale);
    auraRing.setData("baseDisplayScale", ringScale);
    return { auraRing, inkShadow };
  }

  /** 气环呼吸：alpha 0.18↔0.32 往返（beginDeath 时停掉转消散演出）。 */
  private startAuraBreathing(runtime: BossRuntime): void {
    runtime.auraRing.setAlpha(AURA_RING_ALPHA_MIN);
    this.scene.tweens.add({
      targets: runtime.auraRing,
      alpha: AURA_RING_ALPHA_MAX,
      duration: AURA_RING_BREATH_MS,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
  }

  /** 程序化径向渐变纹理：朱砂气环 + 墨黑软影，只生成一次。 */
  private ensureAuraTextures(): void {
    if (!this.scene.textures.exists("boss_aura_ring")) {
      const canvasTexture = this.scene.textures.createCanvas("boss_aura_ring", AURA_TEXTURE_SIZE, AURA_TEXTURE_SIZE);
      if (canvasTexture) {
        const context = canvasTexture.getContext();
        const center = AURA_TEXTURE_SIZE / 2;
        const gradient = context.createRadialGradient(center, center, 0, center, center, AURA_TEXTURE_GRADIENT_RADIUS);
        gradient.addColorStop(0, "rgba(120, 20, 12, 0)");
        gradient.addColorStop(0.58, "rgba(120, 20, 12, 0)");
        gradient.addColorStop(0.74, "rgba(196, 58, 38, 0.95)");
        gradient.addColorStop(0.88, "rgba(150, 32, 20, 0.5)");
        gradient.addColorStop(1, "rgba(120, 20, 12, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, AURA_TEXTURE_SIZE, AURA_TEXTURE_SIZE);
        canvasTexture.refresh();
      }
    }
    if (!this.scene.textures.exists("boss_ink_shadow")) {
      const canvasTexture = this.scene.textures.createCanvas("boss_ink_shadow", AURA_TEXTURE_SIZE, AURA_TEXTURE_SIZE);
      if (canvasTexture) {
        const context = canvasTexture.getContext();
        const center = AURA_TEXTURE_SIZE / 2;
        const gradient = context.createRadialGradient(center, center, 0, center, center, AURA_TEXTURE_GRADIENT_RADIUS);
        gradient.addColorStop(0, "rgba(6, 5, 5, 0.92)");
        gradient.addColorStop(0.6, "rgba(6, 5, 5, 0.45)");
        gradient.addColorStop(1, "rgba(6, 5, 5, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, AURA_TEXTURE_SIZE, AURA_TEXTURE_SIZE);
        canvasTexture.refresh();
      }
    }
  }

  /** 落地一击的墨环冲击波：Graphics 墨圈从落点扩散 500ms 后销毁。 */
  private createSlamShockwave(runtime: BossRuntime): void {
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    const graphics = this.scene.add.graphics().setDepth(35);
    const wave = { radius: 16, alpha: 0.85, lineWidth: 12 };
    const maxRadius = this.config.visualRadius * BOSS_SIZE_MULTIPLIER * 2.4;
    this.scene.tweens.add({
      targets: wave,
      radius: maxRadius,
      alpha: 0,
      lineWidth: 2,
      duration: SLAM_SHOCKWAVE_MS,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        graphics.clear();
        graphics.lineStyle(wave.lineWidth, 0x17100f, wave.alpha);
        graphics.strokeCircle(screen.x, screen.y, wave.radius);
        graphics.lineStyle(Math.max(1, wave.lineWidth * 0.4), 0x8f4b2f, wave.alpha * 0.7);
        graphics.strokeCircle(screen.x, screen.y, Math.max(1, wave.radius * 0.82));
      },
      onComplete: () => {
        graphics.destroy();
      }
    });
  }

  private updateWarningView(runtime: BossRuntime): void {
    if (!runtime.warningView) {
      return;
    }
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    runtime.warningView.setPosition(screen.x, screen.y);
    // 预警渐强：alpha 由 0.2→0.9 随 stateMs 逼近出手，明示时机
    const durationMs = Math.max(1, runtime.lastWarningDurationMs);
    const progress = Phaser.Math.Clamp(runtime.stateMs / durationMs, 0, 1);
    runtime.warningView.setAlpha(0.2 + progress * 0.7);
    // 内圈随剩余时间收缩填充（仅几何兜底预警标记了 warningInner 子件）
    const innerScale = 1 - progress * 0.85;
    for (const child of runtime.warningView.list) {
      if (child.getData("warningInner") === true) {
        (child as unknown as Phaser.GameObjects.Components.Transform).setScale(innerScale);
      }
    }
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
    const shadowOffsetY = (runtime.view.getData("shadowOffsetY") as number | undefined)
      ?? this.config.visualRadius * 0.58 * BOSS_SIZE_MULTIPLIER;
    runtime.shadow.setPosition(screen.x, screen.y + shadowOffsetY);
    // 气场层跟随脚下：墨黑投影在下、朱砂气环在上
    runtime.inkShadow.setPosition(screen.x, screen.y + shadowOffsetY);
    runtime.auraRing.setPosition(screen.x, screen.y + shadowOffsetY);
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
    runtime.hitSquashMs = HIT_SQUASH_MS;
    if (runtime.view instanceof Phaser.GameObjects.Sprite && runtime.view.getData("bossSpriteArt") === true) {
      // 受击白闪：Boss 用金色；80ms 后恢复（windup 期恢复为蓄力 tint 而非清除）
      const view = runtime.view;
      view.setTintFill(HIT_FLASH_TINT);
      this.scene.time.delayedCall(HIT_FLASH_MS, () => {
        if (!view.active) {
          return;
        }
        if (runtime.state === "charge_windup" || runtime.state === "whirlwind_windup") {
          view.setTint(WINDUP_TINT);
        } else {
          view.clearTint();
        }
      });
      return;
    }

    runtime.view.setAlpha(0.58);
    this.scene.tweens.add({
      targets: runtime.view,
      alpha: 1,
      duration: 110,
      ease: "Quad.easeOut"
    });
  }

  /** windup 蓄力 tint；几何兜底 Container 无 Tint 组件，仅贴图 Boss 生效。 */
  private applyWindupTint(runtime: BossRuntime): void {
    if (runtime.view instanceof Phaser.GameObjects.Sprite && runtime.view.getData("bossSpriteArt") === true) {
      runtime.view.setTint(WINDUP_TINT);
    }
  }

  private clearWindupTint(runtime: BossRuntime): void {
    if (runtime.view instanceof Phaser.GameObjects.Sprite && runtime.view.getData("bossSpriteArt") === true) {
      runtime.view.clearTint();
    }
  }

  /** 冲锋路径残影：最多 3 个 Boss 纹理残影，alpha 渐隐后销毁。 */
  private spawnChargeGhostIfReady(runtime: BossRuntime): void {
    if (runtime.ghostCooldownMs > 0 || runtime.chargeGhostsSpawned >= CHARGE_GHOST_MAX) {
      return;
    }
    runtime.ghostCooldownMs = CHARGE_GHOST_INTERVAL_MS;
    runtime.chargeGhostsSpawned += 1;
    const screen = this.worldToScreen(runtime.worldX, runtime.worldY);
    let ghost: Phaser.GameObjects.Sprite | Phaser.GameObjects.Ellipse;
    if (runtime.view instanceof Phaser.GameObjects.Sprite && runtime.view.getData("bossSpriteArt") === true) {
      const view = runtime.view;
      const sprite = this.scene.add.sprite(screen.x, screen.y, view.texture.key)
        .setDepth(12)
        .setAlpha(0.32)
        .setScale(view.scaleX, view.scaleY);
      sprite.setFrame(view.frame.name);
      ghost = sprite;
    } else {
      ghost = this.scene.add.ellipse(screen.x, screen.y, 72, 96, 0x8f4b2f, 0.3)
        .setDepth(12);
    }
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (ghost.active) {
          ghost.destroy();
        }
      }
    });
  }

  private updateBossSpriteAnimation(runtime: BossRuntime): void {
    if (!(runtime.view instanceof Phaser.GameObjects.Sprite) || runtime.view.getData("bossSpriteArt") !== true) {
      return;
    }

    const isAttack = isBossAttackState(runtime.state);
    const assetId = isAttack ? "boss_heifeng_attack" : "boss_heifeng_idle";
    if (!this.scene.textures.exists(assetId)) {
      return;
    }

    if (runtime.view.texture.key !== assetId) {
      runtime.view.setTexture(assetId);
    }

    // attack 动画为单次播放（manifest loop:false），在进入攻击态时重播以对齐 windup→挥砍
    const animationKey = getArtAnimationKey(assetId);
    const wasAttack = runtime.view.getData("animAttackState") === true;
    if (this.scene.anims.exists(animationKey)
      && (runtime.view.anims.currentAnim?.key !== animationKey || (isAttack && !wasAttack))) {
      runtime.view.play(animationKey);
    }
    runtime.view.setData("animAttackState", isAttack);
  }

  private setBossViewMotionScale(runtime: BossRuntime, motionScale: number): void {
    runtime.view.setData("motionScale", motionScale);
    this.applyBossViewScale(runtime);
  }

  private applyBossViewScale(runtime: BossRuntime): void {
    const baseScale = (runtime.view.getData("baseScale") as number | undefined) ?? 1;
    const motionScale = (runtime.view.getData("motionScale") as number | undefined) ?? 1;
    const facingLeft = (runtime.view.getData("facingLeft") as boolean | undefined) ?? false;
    // 受击 squash 回弹：60ms 内从 0.92 恢复到 1（每帧缩放会覆盖 Tween，故用衰减因子）
    const squash = runtime.hitSquashMs > 0 ? 1 - 0.08 * (runtime.hitSquashMs / HIT_SQUASH_MS) : 1;
    // 蓄力强化：windup 期压扁 0.94；出手帧 1.06 回弹，140ms 内衰减归位
    const windupScale = runtime.windupRecoilMs > 0
      ? 1 + (WINDUP_RECOIL - 1) * (runtime.windupRecoilMs / WINDUP_RECOIL_MS)
      : runtime.state === "charge_windup" || runtime.state === "whirlwind_windup"
        ? WINDUP_SQUASH
        : 1;
    const totalScale = baseScale * motionScale * squash * windupScale;
    runtime.view.setScale((facingLeft ? -1 : 1) * totalScale, totalScale);
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
