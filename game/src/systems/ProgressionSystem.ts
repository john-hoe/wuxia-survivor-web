import Phaser from "phaser";
import {
  createInsightOptions,
  enemyInnerPowerDrops,
  getInnerPowerRequiredForLevel,
  innerPowerGemConfigs,
  type InsightSkillState,
  type InnerPowerTier,
  type InsightOption,
  type PendingInsight
} from "../data/progression";
import type { EnemyDamageResult } from "./EnemyDirectorSystem";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";
import { JuiceSystem } from "./JuiceSystem";

type Point = {
  x: number;
  y: number;
};

type InnerPowerGemRuntime = {
  runtimeId: number;
  tier: InnerPowerTier;
  value: number;
  worldX: number;
  worldY: number;
  ageMs: number;
  magnetAgeMs: number;
  trailCooldownMs: number;
  absorbing: boolean;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
};

export type AppliedInsightResult = {
  applied: boolean;
  option?: InsightOption;
};

export type ProgressionSnapshot = {
  level: number;
  innerPower: number;
  nextRequired: number;
  innerPowerRatio: number;
  innerPowerText: string;
  insightCount: number;
  gemsAlive: number;
  lastInsightAtSeconds: number;
  pendingInsight: boolean;
  pickupRadius: number;
};

type ProgressionSystemOptions = {
  getHeroWorld: () => Point;
  getHeroScreen: () => Point;
  getElapsedSeconds: () => number;
  initialPickupRadius?: number;
  getSkillState?: () => InsightSkillState | undefined;
  openInsight: (pendingInsight: PendingInsight) => void;
  playSfx: (eventId: string) => void;
};

const BASE_PICKUP_RADIUS_PX = 70;
const MAGNET_EXTRA_RADIUS_PX = 80;
const COLLECT_DISTANCE_PX = 22;
const GEM_MAX_AGE_MS = 60000;
const INITIAL_MAGNET_SPEED_PX_PER_SECOND = 160;
const MAX_MAGNET_SPEED_PX_PER_SECOND = 560;
const MAGNET_ACCELERATION_MS = 350;
const INSIGHT_RECHECK_DELAY_MS = 300;
const MAX_MAGNET_TRAIL_SPRITES = 24;

export class ProgressionSystem {
  private readonly gems: InnerPowerGemRuntime[] = [];
  private readonly magnetTrails: Phaser.GameObjects.Sprite[] = [];
  private level = 1;
  private innerPower = 0;
  private insightCount = 0;
  private lastInsightAtSeconds = -1;
  private pendingInsight?: PendingInsight;
  private selectedInsightIds = new Set<string>();
  private nextGemRuntimeId = 1;
  private pickupRadius = BASE_PICKUP_RADIUS_PX;
  private recheckDelayMs = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly options: ProgressionSystemOptions) {
    this.pickupRadius = Phaser.Math.Clamp(
      Math.round(options.initialPickupRadius ?? BASE_PICKUP_RADIUS_PX),
      BASE_PICKUP_RADIUS_PX,
      Math.round(BASE_PICKUP_RADIUS_PX * 1.25)
    );
  }

  update(deltaMs: number): ProgressionSnapshot {
    const clampedDeltaMs = Math.min(deltaMs, 100);
    this.recheckDelayMs = Math.max(0, this.recheckDelayMs - clampedDeltaMs);
    this.updateGems(clampedDeltaMs);
    this.triggerInsightIfReady();
    return this.getSnapshot();
  }

  spawnFromEnemyKill(result: EnemyDamageResult): void {
    const drop = enemyInnerPowerDrops[result.enemyId];
    if (!drop || Math.random() > drop.chance) {
      return;
    }

    this.spawnGem(drop.tier, result.worldX, result.worldY);
  }

  applyInsightOption(optionId: string): AppliedInsightResult {
    const pending = this.pendingInsight;
    if (!pending) {
      return { applied: false };
    }

    const option = pending.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      return { applied: false };
    }

    this.pendingInsight = undefined;
    this.selectedInsightIds.add(option.id);
    this.insightCount += 1;
    this.lastInsightAtSeconds = this.options.getElapsedSeconds();
    this.applyPassiveEffect(option.applyEffectId);
    this.recheckDelayMs = INSIGHT_RECHECK_DELAY_MS;
    eventBus.emit("insight_applied", {
      optionId: option.id,
      title: option.title,
      category: option.category,
      applyEffectId: option.applyEffectId,
      level: this.level,
      insightCount: this.insightCount
    });
    return { applied: true, option };
  }

  getSnapshot(): ProgressionSnapshot {
    const nextRequired = getInnerPowerRequiredForLevel(this.level);
    return {
      level: this.level,
      innerPower: this.innerPower,
      nextRequired,
      innerPowerRatio: nextRequired > 0 ? Phaser.Math.Clamp(this.innerPower / nextRequired, 0, 1) : 0,
      innerPowerText: `${this.innerPower}/${nextRequired}`,
      insightCount: this.insightCount,
      gemsAlive: this.gems.length,
      lastInsightAtSeconds: this.lastInsightAtSeconds,
      pendingInsight: this.pendingInsight !== undefined,
      pickupRadius: this.pickupRadius
    };
  }

  destroy(): void {
    for (const gem of this.gems) {
      gem.view.destroy();
    }
    for (const trail of this.magnetTrails) {
      trail.destroy();
    }
    this.gems.length = 0;
    this.magnetTrails.length = 0;
  }

  private spawnGem(tier: InnerPowerTier, worldX: number, worldY: number): void {
    const config = innerPowerGemConfigs[tier];
    const view = this.createGemView(tier, config.visualRadius, config.color, config.glowColor);
    const gem: InnerPowerGemRuntime = {
      runtimeId: this.nextGemRuntimeId,
      tier,
      value: config.value,
      worldX,
      worldY,
      ageMs: 0,
      magnetAgeMs: 0,
      trailCooldownMs: 0,
      absorbing: false,
      view
    };
    this.nextGemRuntimeId += 1;
    this.gems.push(gem);
    this.updateGemScreenPosition(gem);
    eventBus.emit("inner_power_gem_spawned", {
      runtimeId: gem.runtimeId,
      tier,
      value: gem.value,
      worldX: roundForDebug(worldX),
      worldY: roundForDebug(worldY)
    });
  }

  private updateGems(deltaMs: number): void {
    const heroWorld = this.options.getHeroWorld();
    const deltaSeconds = deltaMs / 1000;

    for (let index = this.gems.length - 1; index >= 0; index -= 1) {
      const gem = this.gems[index];
      gem.ageMs += deltaMs;
      if (gem.ageMs >= GEM_MAX_AGE_MS) {
        this.destroyGem(index, "expired");
        continue;
      }

      const distance = Math.hypot(gem.worldX - heroWorld.x, gem.worldY - heroWorld.y);
      if (!gem.absorbing && distance <= this.pickupRadius + MAGNET_EXTRA_RADIUS_PX) {
        gem.absorbing = true;
        gem.magnetAgeMs = 0;
      }

      if (gem.absorbing) {
        gem.trailCooldownMs = Math.max(0, gem.trailCooldownMs - deltaMs);
        gem.magnetAgeMs += deltaMs;
        const accelerationRatio = Phaser.Math.Clamp(gem.magnetAgeMs / MAGNET_ACCELERATION_MS, 0, 1);
        // Quad.in：吸附终段加速更陡，"飞入"感更强
        const easedRatio = accelerationRatio * accelerationRatio;
        const speed = Phaser.Math.Linear(INITIAL_MAGNET_SPEED_PX_PER_SECOND, MAX_MAGNET_SPEED_PX_PER_SECOND, easedRatio);
        const toHeroX = heroWorld.x - gem.worldX;
        const toHeroY = heroWorld.y - gem.worldY;
        const length = Math.hypot(toHeroX, toHeroY);
        if (length <= COLLECT_DISTANCE_PX) {
          this.collectGem(index, gem);
          continue;
        }

        const step = Math.min(length, speed * deltaSeconds);
        gem.worldX += (toHeroX / length) * step;
        gem.worldY += (toHeroY / length) * step;
      }

      this.updateGemScreenPosition(gem);
      this.updateGemAnimation(gem);
      this.spawnMagnetTrailIfNeeded(gem);
    }
  }

  private collectGem(index: number, gem: InnerPowerGemRuntime): void {
    this.innerPower += gem.value;
    this.options.playSfx("inner_power_pickup");
    // 拾取反馈：收集点金青闪光 + 内力收益金色飘字
    const juice = JuiceSystem.get(this.scene);
    juice.pickupSparkle(gem.view.x, gem.view.y);
    juice.damageNumber(gem.view.x, gem.view.y - 6, `+${gem.value}`, "gold");
    eventBus.emit("inner_power_gem_collected", {
      runtimeId: gem.runtimeId,
      tier: gem.tier,
      value: gem.value,
      innerPower: this.innerPower,
      nextRequired: getInnerPowerRequiredForLevel(this.level)
    });
    eventBus.emit("inner_power_changed", {
      innerPower: this.innerPower,
      nextRequired: getInnerPowerRequiredForLevel(this.level),
      level: this.level
    });
    this.destroyGem(index, "collected");
  }

  private triggerInsightIfReady(): void {
    if (this.pendingInsight || this.recheckDelayMs > 0) {
      return;
    }

    const nextRequired = getInnerPowerRequiredForLevel(this.level);
    if (this.innerPower < nextRequired) {
      return;
    }

    const levelBefore = this.level;
    this.innerPower -= nextRequired;
    this.level += 1;
    this.pendingInsight = {
      levelBefore,
      levelAfter: this.level,
      options: createInsightOptions(this.insightCount, this.selectedInsightIds, this.options.getSkillState?.())
        .filter((option) => !this.selectedInsightIds.has(option.id))
        .slice(0, 3)
    };
    eventBus.emit("inner_power_changed", {
      innerPower: this.innerPower,
      nextRequired: getInnerPowerRequiredForLevel(this.level),
      level: this.level
    });
    eventBus.emit("insight_ready", {
      levelBefore,
      levelAfter: this.level,
      innerPowerRemainder: this.innerPower,
      options: this.pendingInsight.options.map((option) => option.id)
    });
    this.options.openInsight(this.pendingInsight);
  }

  private applyPassiveEffect(effectId: string): void {
    if (effectId === "passive_pickup_radius_1") {
      this.pickupRadius = Math.min(145, this.pickupRadius + 15);
    }
  }

  private createGemView(
    tier: InnerPowerTier,
    radius: number,
    color: number,
    glowColor: number
  ): Phaser.GameObjects.Container | Phaser.GameObjects.Sprite {
    const assetId = getGemAssetId(tier);
    if (assetId && this.scene.textures.exists(assetId)) {
      const view = this.scene.add.sprite(0, 0, assetId)
        .setDepth(13)
        .setOrigin(0.5)
        .setAlpha(0.9);
      const animationKey = getArtAnimationKey(assetId);
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
      }
      view.setData("spriteArt", true);
      return view;
    }

    return this.createGemFallback(radius, color, glowColor);
  }

  private createGemFallback(radius: number, color: number, glowColor: number): Phaser.GameObjects.Container {
    const glow = this.scene.add.circle(0, 0, radius + 7, glowColor, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD);
    const core = this.scene.add.circle(0, 0, radius, color, 0.92)
      .setStrokeStyle(1, 0xc7fcff, 0.85);
    const highlight = this.scene.add.circle(-radius * 0.3, -radius * 0.35, Math.max(2, radius * 0.28), 0xf4fffc, 0.75);
    return this.scene.add.container(0, 0, [glow, core, highlight]).setDepth(13);
  }

  private updateGemScreenPosition(gem: InnerPowerGemRuntime): void {
    const heroWorld = this.options.getHeroWorld();
    const heroScreen = this.options.getHeroScreen();
    gem.view.setPosition(
      heroScreen.x + gem.worldX - heroWorld.x,
      heroScreen.y + gem.worldY - heroWorld.y
    );
  }

  private updateGemAnimation(gem: InnerPowerGemRuntime): void {
    const bob = Math.sin((gem.ageMs + gem.runtimeId * 37) / 130) * 0.08;
    const spriteArt = gem.view instanceof Phaser.GameObjects.Sprite && gem.view.getData("spriteArt") === true;
    const baseScale = spriteArt ? 1 : 1;
    gem.view.setScale(gem.absorbing ? baseScale + 0.08 + bob : baseScale + bob);
    gem.view.setAlpha(gem.absorbing ? 0.98 : 0.86);
  }

  private spawnMagnetTrailIfNeeded(gem: InnerPowerGemRuntime): void {
    if (!gem.absorbing
      || gem.trailCooldownMs > 0
      || this.magnetTrails.length >= MAX_MAGNET_TRAIL_SPRITES
      || !this.scene.textures.exists("vfx_inner_magnet_trail")) {
      return;
    }

    gem.trailCooldownMs = 90;
    const heroScreen = this.options.getHeroScreen();
    const angle = Math.atan2(heroScreen.y - gem.view.y, heroScreen.x - gem.view.x) + Math.PI / 2;
    const trail = this.scene.add.sprite(gem.view.x, gem.view.y, "vfx_inner_magnet_trail")
      .setDepth(12)
      .setOrigin(0.5)
      .setScale(0.58)
      .setAlpha(0.72)
      .setRotation(angle)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.magnetTrails.push(trail);
    const cleanupTrail = (): void => {
      this.scene.tweens.killTweensOf(trail);
      const trailIndex = this.magnetTrails.indexOf(trail);
      if (trailIndex >= 0) {
        this.magnetTrails.splice(trailIndex, 1);
      }
      if (trail.active) {
        trail.destroy();
      }
    };
    const animationKey = getArtAnimationKey("vfx_inner_magnet_trail");
    if (this.scene.anims.exists(animationKey)) {
      trail.play(animationKey);
      // 一次性动画（loop:false）播完兜底销毁；通常 240ms Tween 先结束
      trail.once(Phaser.Animations.Events.ANIMATION_COMPLETE, cleanupTrail);
    }
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 0.38,
      duration: 240,
      ease: "Quad.easeOut",
      onComplete: cleanupTrail
    });
  }

  private destroyGem(index: number, _reason: "collected" | "expired"): void {
    const [gem] = this.gems.splice(index, 1);
    gem.view.destroy();
  }
}

function roundForDebug(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getGemAssetId(tier: InnerPowerTier): string | undefined {
  if (tier === "small") {
    return "drop_inner_small";
  }
  if (tier === "medium") {
    return "drop_inner_medium";
  }
  if (tier === "large") {
    return "drop_inner_large";
  }
  return undefined;
}
