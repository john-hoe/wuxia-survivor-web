import Phaser from "phaser";
import type { InsightOption, PendingInsight } from "../data/progression";
import { isSkillId, type AdvanceKeyId, type SkillId } from "../data/skills";
import { BossSystem, type BossDefeatSummary, type BossSystemSnapshot } from "../systems/BossSystem";
import { EnemyDirectorSystem, type EnemyDirectorSnapshot } from "../systems/EnemyDirectorSystem";
import { HeroHealthSystem, type DamageResult, type HeroHealthSnapshot } from "../systems/HeroHealthSystem";
import { HeroMovementSystem, type HeroMovementSnapshot } from "../systems/HeroMovementSystem";
import { ProgressionSystem, type ProgressionSnapshot } from "../systems/ProgressionSystem";
import { saveSystem } from "../systems/SaveSystem";
import { SkillSystem, type SkillSystemSnapshot } from "../systems/SkillSystem";
import { createArtPanel } from "../ui/ArtPanel";
import { DebugPanel } from "../ui/DebugPanel";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";
import { getAudioSystem, getConfigLoadResult, getSaveData, getScreenState, prepareScreenTransition, setRunSummary } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import type { DebugSnapshot, RunSummary } from "../types";
import { SCENE_KEYS } from "./sceneKeys";

const DEBUG_DAMAGE_AMOUNT = 18;
const DEBUG_HEAL_AMOUNT = 25;
const DEBUG_BOSS_DAMAGE_AMOUNT = 700;
const INSIGHT_RECOVERY_AMOUNT = 20;
const HUD_HEALTH_FILL_MAX_WIDTH = 124;
const HUD_HEALTH_BAR_X = 82;
const HUD_HEALTH_BAR_Y = 45;

export class GameScene extends Phaser.Scene {
  private debugPanel?: DebugPanel;
  private heroHealth?: HeroHealthSystem;
  private latestHealth?: HeroHealthSnapshot;
  private heroMovement?: HeroMovementSystem;
  private latestMovement?: HeroMovementSnapshot;
  private enemyDirector?: EnemyDirectorSystem;
  private latestEnemyDirector?: EnemyDirectorSnapshot;
  private bossSystem?: BossSystem;
  private latestBoss?: BossSystemSnapshot;
  private skillSystem?: SkillSystem;
  private latestSkillSnapshot?: SkillSystemSnapshot;
  private progressionSystem?: ProgressionSystem;
  private latestProgression?: ProgressionSnapshot;
  private heroView?: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  private heroShadow?: Phaser.GameObjects.Ellipse;
  private footHpBack?: Phaser.GameObjects.Rectangle;
  private footHpFill?: Phaser.GameObjects.Rectangle;
  private screenDamageEdges: Phaser.GameObjects.Rectangle[] = [];
  private groundTile?: Phaser.GameObjects.TileSprite;
  private roadTile?: Phaser.GameObjects.TileSprite;
  private roadAccentTile?: Phaser.GameObjects.TileSprite;
  private backgroundProps: Array<{
    image: Phaser.GameObjects.Image;
    baseX: number;
    baseY: number;
    parallaxX: number;
    parallaxY: number;
    marginX: number;
    marginY: number;
  }> = [];
  private hudStatsText?: Phaser.GameObjects.Text;
  private hudHealthFill?: Phaser.GameObjects.Rectangle;
  private hudHealthGlow?: Phaser.GameObjects.Rectangle;
  private hudRunText?: Phaser.GameObjects.Text;
  private bossHudBack?: Phaser.GameObjects.Rectangle;
  private bossHudFill?: Phaser.GameObjects.Rectangle;
  private bossHudText?: Phaser.GameObjects.Text;
  private bossHudTip?: Phaser.GameObjects.Text;
  private innerPowerText?: Phaser.GameObjects.Text;
  private innerPowerFill?: Phaser.GameObjects.Rectangle;
  private skillSlotFrames: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
  private skillSlotIcons: Array<Phaser.GameObjects.Image | undefined> = [];
  private skillSlotTexts: Phaser.GameObjects.Text[] = [];
  private stageScrollX = 0;
  private stageScrollY = 0;
  private elapsedMs = 0;
  private lastHudEventKey = "";
  private runId = "";
  private heroLevel = 1;
  private kills = 0;
  private innerPower = "0/24";
  private debugInsightShowcaseIndex = 0;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    enterScreen(this, "game");
    this.elapsedMs = 0;
    this.lastHudEventKey = "";
    this.runId = createRunId();
    this.stageScrollX = 0;
    this.stageScrollY = 0;
    this.debugInsightShowcaseIndex = 0;
    this.heroLevel = 1;
    this.kills = 0;
    this.innerPower = "0/24";
    const saveData = getSaveData(this);
    const metaUpgrades = saveData.metaUpgrades;
    const baseMaxHp = Math.round(100 * (1 + metaUpgrades.max_hp * 0.05));
    const baseMoveSpeed = Math.round(220 * (1 + metaUpgrades.move_speed * 0.03));
    const basePickupRadius = Math.round(70 * (1 + metaUpgrades.pickup_radius * 0.05));
    this.heroHealth = new HeroHealthSystem(baseMaxHp);
    this.latestHealth = this.heroHealth.getSnapshot();

    this.drawPlaceholderStage();
    this.drawHero();
    this.heroMovement = new HeroMovementSystem(this, baseMoveSpeed);
    this.latestMovement = this.heroMovement.getSnapshot();
    this.enemyDirector = new EnemyDirectorSystem(this, {
      getElapsedSeconds: () => this.getElapsedSeconds(),
      getHeroWorld: () => this.getHeroWorldPosition(),
      getHeroScreen: () => this.getHeroScreenPosition(),
      getHeroVelocity: () => ({
        x: this.latestMovement?.velocityX ?? 0,
        y: this.latestMovement?.velocityY ?? 0
      }),
      damageHero: (amount, source) => this.applyHeroDamage(amount, source),
      getLowVfxMode: () => getSaveData(this).settings.lowVfxMode
    });
    this.latestEnemyDirector = this.enemyDirector.getSnapshot();
    this.bossSystem = new BossSystem(this, {
      getElapsedSeconds: () => this.getElapsedSeconds(),
      getHeroWorld: () => this.getHeroWorldPosition(),
      getHeroScreen: () => this.getHeroScreenPosition(),
      damageHero: (amount, source) => this.applyHeroDamage(amount, source),
      onBossDefeated: (summary) => this.handleBossDefeated(summary),
      playSfx: (eventId) => getAudioSystem(this).playPlaceholder(eventId)
    });
    this.latestBoss = this.bossSystem.getSnapshot();
    this.progressionSystem = new ProgressionSystem(this, {
      getHeroWorld: () => this.getHeroWorldPosition(),
      getHeroScreen: () => this.getHeroScreenPosition(),
      getElapsedSeconds: () => this.getElapsedSeconds(),
      initialPickupRadius: basePickupRadius,
      getSkillState: () => this.skillSystem?.getInsightState(),
      openInsight: (pendingInsight) => this.openInsight(pendingInsight),
      playSfx: (eventId) => getAudioSystem(this).playPlaceholder(eventId)
    });
    this.latestProgression = this.progressionSystem.getSnapshot();
    this.syncProgressionSnapshot();
    this.skillSystem = new SkillSystem(this, {
      getHeroWorld: () => this.getHeroWorldPosition(),
      getHeroScreen: () => this.getHeroScreenPosition(),
      getTargets: () => [
        ...(this.enemyDirector?.getTargets() ?? []),
        ...(this.bossSystem?.getTargets() ?? [])
      ],
      damageTarget: (runtimeId, amount, source) => {
        if (this.bossSystem?.isRuntimeId(runtimeId)) {
          return this.bossSystem.damageBoss(runtimeId, amount, source);
        }
        return this.enemyDirector?.damageEnemy(runtimeId, amount, source);
      },
      knockbackEnemy: (runtimeId, originWorld, distance, source) => this.enemyDirector?.knockbackEnemy(runtimeId, originWorld, distance, source) ?? false,
      onEnemyKilled: (result) => this.handleEnemyKilled(result),
      playSfx: (eventId) => getAudioSystem(this).playPlaceholder(eventId)
    });
    this.latestSkillSnapshot = this.skillSystem.getSnapshot();
    this.drawHud();
    this.debugPanel = new DebugPanel(this, 16, 96, getConfigLoadResult(this).config.debug.debugPanelDefaultVisible);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      const openPause = (): void => this.openPause();
      keyboard.on("keydown-ESC", openPause);
      keyboard.on("keydown-P", openPause);
      const toggleDebug = (): void => {
        if (getScreenState(this) !== "game") {
          return;
        }
        this.debugPanel?.toggle();
      };

      const startInsight = (): void => this.openInsight();
      const startDeath = (): void => this.startDeathTransition();
      const showResult = (): void => this.showResult();
      const damageHero = (): void => this.applyDebugDamage();
      const healHero = (): void => this.applyDebugHeal();
      const enableP0ArtShowcase = (): void => this.enableP0ArtShowcaseForDebug();
      const startInsightArtShowcase = (): void => this.startInsightArtShowcaseForDebug();
      const spawnEnemyShowcase = (): void => this.spawnEnemyShowcaseForDebug();
      const spawnBoss = (): void => this.spawnBossForDebug();
      const damageBoss = (): void => this.applyDebugBossDamage();
      let debugKey: Phaser.Input.Keyboard.Key | undefined;
      if (import.meta.env.DEV) {
        debugKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
        debugKey.on("down", toggleDebug);
        keyboard.on("keydown-F3", enableP0ArtShowcase);
        keyboard.on("keydown-F4", spawnEnemyShowcase);
        keyboard.on("keydown-F5", startInsightArtShowcase);
        keyboard.on("keydown-F6", startInsight);
        keyboard.on("keydown-F7", startDeath);
        keyboard.on("keydown-F8", showResult);
        keyboard.on("keydown-F9", damageHero);
        keyboard.on("keydown-F10", healHero);
        keyboard.on("keydown-F11", spawnBoss);
        keyboard.on("keydown-F12", damageBoss);
      }

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        keyboard.off("keydown-ESC", openPause);
        keyboard.off("keydown-P", openPause);
        debugKey?.off("down", toggleDebug);
        if (import.meta.env.DEV) {
          keyboard.off("keydown-F3", enableP0ArtShowcase);
          keyboard.off("keydown-F4", spawnEnemyShowcase);
          keyboard.off("keydown-F5", startInsightArtShowcase);
          keyboard.off("keydown-F6", startInsight);
          keyboard.off("keydown-F7", startDeath);
          keyboard.off("keydown-F8", showResult);
          keyboard.off("keydown-F9", damageHero);
          keyboard.off("keydown-F10", healHero);
          keyboard.off("keydown-F11", spawnBoss);
          keyboard.off("keydown-F12", damageBoss);
        }
      });
    }

    const unsubscribeBossSpawnRequested = eventBus.on<{ bossId?: string }>("boss_spawn_requested", () => {
      this.bossSystem?.requestSpawn("director");
      this.latestBoss = this.bossSystem?.getSnapshot();
      this.updateBossHud();
    });
    const unsubscribeInsightSelected = eventBus.on<{ optionId?: string; cardId?: string }>("insight_option_selected", (payload) => {
      this.applyInsightSelection(payload.optionId ?? payload.cardId ?? "");
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeBossSpawnRequested();
      unsubscribeInsightSelected();
      this.progressionSystem?.destroy();
      this.progressionSystem = undefined;
      this.latestProgression = undefined;
      this.skillSystem?.destroy();
      this.skillSystem = undefined;
      this.latestSkillSnapshot = undefined;
      this.enemyDirector?.destroy();
      this.enemyDirector = undefined;
      this.latestEnemyDirector = undefined;
      this.bossSystem?.destroy();
      this.bossSystem = undefined;
      this.latestBoss = undefined;
      this.heroMovement?.destroy();
      this.heroMovement = undefined;
      this.latestMovement = undefined;
      this.heroHealth = undefined;
      this.latestHealth = undefined;
    });
  }

  update(_time: number, delta: number): void {
    const activeDeltaMs = Math.min(delta, 100);
    this.elapsedMs += activeDeltaMs;
    getAudioSystem(this).update(activeDeltaMs);

    if (this.heroMovement) {
      this.latestMovement = this.heroMovement.update(activeDeltaMs);
      this.updateStageScroll(this.latestMovement);
      this.updateHeroView(this.latestMovement);
    }

    if (this.heroHealth) {
      this.latestHealth = this.heroHealth.update(activeDeltaMs);
      if (this.latestHealth.isDead && getScreenState(this) === "game") {
        this.handleHeroDeath(this.latestHealth.lastDamageSource);
        // Death transition pauses this scene and refreshes the debug snapshot, so no more frame work is needed.
        return;
      }
    }

    if (this.enemyDirector && getScreenState(this) === "game") {
      this.latestEnemyDirector = this.enemyDirector.update(activeDeltaMs);
      if (this.latestHealth?.isDead) {
        return;
      }
    }

    if (this.bossSystem && getScreenState(this) === "game") {
      this.latestBoss = this.bossSystem.update(activeDeltaMs);
      if (this.latestHealth?.isDead) {
        return;
      }
    }

    if (this.skillSystem && getScreenState(this) === "game") {
      this.latestSkillSnapshot = this.skillSystem.update(activeDeltaMs);
    }

    if (this.progressionSystem && getScreenState(this) === "game") {
      this.latestProgression = this.progressionSystem.update(activeDeltaMs);
      this.syncProgressionSnapshot();
    }

    this.updateHealthFeedback(activeDeltaMs);
    this.updateHud();
    this.updateBossHud();
    this.debugPanel?.update(this.createDebugSnapshot());
  }

  private drawPlaceholderStage(): void {
    this.ensureStageTextures();
    this.backgroundProps = [];
    this.cameras.main.setBackgroundColor("#33483e");
    const hasOfficialGround = this.textures.exists("ground_qingshi_base");
    const hasOfficialRoad = this.textures.exists("road_ribbon_a");
    const groundTexture = hasOfficialGround ? "ground_qingshi_base" : "qingshi_ground_tile";
    const roadTexture = hasOfficialRoad ? "road_ribbon_a" : "qingshi_road_tile";
    const stageWidth = this.scale.width;
    const stageHeight = this.scale.height;
    this.groundTile = this.add.tileSprite(
      stageWidth / 2,
      stageHeight / 2,
      stageWidth,
      stageHeight,
      groundTexture
    ).setDepth(-30).setAlpha(hasOfficialGround ? 0.72 : 1);
    this.roadTile = this.add.tileSprite(
      stageWidth / 2,
      stageHeight / 2 + 20,
      stageWidth + 256,
      Math.max(stageHeight, 512),
      roadTexture
    ).setDepth(-25).setAlpha(hasOfficialRoad ? 0.46 : 1);

    if (this.textures.exists("road_ribbon_b")) {
      this.roadAccentTile = this.add.tileSprite(
        stageWidth / 2,
        stageHeight / 2 + 12,
        stageWidth + 256,
        Math.max(stageHeight, 512),
        "road_ribbon_b"
      ).setDepth(-24).setAlpha(0.18);
    } else {
      this.roadAccentTile = undefined;
    }

    this.addBackgroundProp("distant_gate_shadow", stageWidth / 2, -92, -23, 0.12, 0.82, 0.22, 0.16);
    this.addBackgroundProp("bamboo_edge_cluster", 132, 146, -22, 0.16, 0.86, 0.52, 0.46);
    this.addBackgroundProp("bamboo_edge_cluster", stageWidth - 96, stageHeight - 72, -22, 0.13, 0.74, 0.48, 0.43, true);
    this.addBackgroundProp("rock_cluster", 260, stageHeight - 108, -21, 0.28, 0.7, 0.7, 0.64);
    this.addBackgroundProp("rock_cluster", stageWidth - 170, 168, -21, 0.22, 0.62, 0.66, 0.58, true);
    this.addBackgroundProp("wood_stake_flag", stageWidth - 150, 214, -21, 0.28, 0.58, 0.7, 0.62);
  }

  private addBackgroundProp(
    textureKey: string,
    baseX: number,
    baseY: number,
    depth: number,
    alpha: number,
    scale: number,
    parallaxX: number,
    parallaxY: number,
    flipX = false
  ): void {
    if (!this.textures.exists(textureKey)) {
      return;
    }

    const image = this.add.image(baseX, baseY, textureKey)
      .setDepth(depth)
      .setAlpha(alpha)
      .setScale(scale)
      .setFlipX(flipX);
    const frame = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    const marginX = Math.max(320, (frame?.width ?? 512) * scale);
    const marginY = Math.max(240, (frame?.height ?? 512) * scale);
    this.backgroundProps.push({ image, baseX, baseY, parallaxX, parallaxY, marginX, marginY });
  }

  private drawHero(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.getHeroScreenY();
    this.heroShadow = this.add.ellipse(centerX, centerY + 24, 52, 16, 0x050705, 0.32).setDepth(5);

    if (this.textures.exists("hero_shaoxia_idle")) {
      const heroSprite = this.add.sprite(centerX, centerY, "hero_shaoxia_idle")
        .setDepth(10)
        .setOrigin(0.5, 0.6)
        .setScale(0.66);
      this.playHeroAnimation(heroSprite, "hero_shaoxia_idle");
      this.heroView = heroSprite;
    } else {
      const body = this.add.circle(0, 0, 24, 0xbfe7d1, 1)
        .setStrokeStyle(2, 0x1b463b, 0.95);
      const facing = this.add.polygon(0, -2, [
        0, -28,
        13, 12,
        0, 6,
        -13, 12
      ], 0xf7f0d0, 1).setStrokeStyle(1, 0xd6c28d, 0.95);
      const waist = this.add.rectangle(0, 12, 28, 8, 0x2f5b4f, 1);
      this.heroView = this.add.container(centerX, centerY, [body, facing, waist]).setDepth(10);
    }

    this.footHpBack = this.add.rectangle(centerX - 28, centerY + 38, 56, 6, 0x070807, 0.75)
      .setOrigin(0, 0.5)
      .setDepth(16)
      .setVisible(false);
    this.footHpFill = this.add.rectangle(centerX - 27, centerY + 38, 54, 4, 0x5fd27a, 1)
      .setOrigin(0, 0.5)
      .setDepth(17)
      .setVisible(false);
  }

  private drawHud(): void {
    const healthPanelX = 156;
    createArtPanel(this, "ui_hud_health_panel", healthPanelX, 48, 280, 80, 0x11140f, 0.72).setDepth(78);
    const healthBarCenterX = HUD_HEALTH_BAR_X + HUD_HEALTH_FILL_MAX_WIDTH / 2;
    this.hudHealthGlow = this.add.rectangle(healthBarCenterX, HUD_HEALTH_BAR_Y, HUD_HEALTH_FILL_MAX_WIDTH + 6, 18, 0x7d1616, 0.0).setDepth(79);
    this.add.rectangle(healthBarCenterX, HUD_HEALTH_BAR_Y, HUD_HEALTH_FILL_MAX_WIDTH + 6, 18, 0x07110d, 0.9).setStrokeStyle(1, 0xd6c28d, 0.45).setDepth(80);
    this.hudHealthFill = this.add.rectangle(HUD_HEALTH_BAR_X, HUD_HEALTH_BAR_Y, HUD_HEALTH_FILL_MAX_WIDTH, 12, 0x5fd27a, 0.95).setOrigin(0, 0.5).setDepth(81);
    this.hudStatsText = this.add.text(healthBarCenterX, HUD_HEALTH_BAR_Y, "", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      stroke: "#07110d",
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(82);

    createArtPanel(this, "ui_hud_inner_power_bar", this.scale.width / 2, 42, 420, 44, 0x11140f, 0.68).setDepth(78);
    this.innerPowerFill = this.add.rectangle(this.scale.width / 2 - 186, 42, 0, 14, 0x3b9fb7, 0.78).setOrigin(0, 0.5).setDepth(79);
    this.innerPowerText = this.add.text(this.scale.width / 2, 42, "", {
      color: "#c7f4ff",
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px"
    }).setOrigin(0.5).setDepth(82);

    const runPanelX = this.scale.width - 204;
    createArtPanel(this, "ui_hud_run_panel", runPanelX, 48, 260, 80, 0x11140f, 0.72).setDepth(78);
    this.add.rectangle(runPanelX - 16, 43, 158, 42, 0x07110d, 0.44).setStrokeStyle(1, 0x6fcfb8, 0.34).setDepth(79);
    this.hudRunText = this.add.text(runPanelX - 86, 43, "", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      stroke: "#07110d",
      strokeThickness: 2,
      lineSpacing: 2
    }).setOrigin(0, 0.5).setDepth(81);
    createHudPauseButton(this, this.scale.width - 54, 48, () => this.openPause());
    this.drawSkillSlots();
    this.drawBossHud();
    this.screenDamageEdges = createDamageEdgeFlash(this);
    this.updateHud();
  }

  private updateHud(): void {
    const health = this.getHealthSnapshot();
    const healthFillWidth = Math.round(HUD_HEALTH_FILL_MAX_WIDTH * Phaser.Math.Clamp(health.hpRatio, 0, 1));
    this.hudHealthFill?.setDisplaySize(healthFillWidth, 12);
    this.hudHealthFill?.setFillStyle(health.isLowHp ? 0xd95a4f : 0x5fd27a, 1);
    this.hudHealthGlow?.setAlpha(health.isLowHp ? 0.28 + Math.sin(this.elapsedMs / 90) * 0.1 : 0);
    this.hudStatsText?.setColor(health.isLowHp ? "#ffb5a8" : "#f7f0d0");
    this.hudStatsText?.setText(`${health.hp}/${health.maxHp}  等级 ${this.heroLevel}`);
    const progression = this.getProgressionSnapshot();
    this.innerPowerText?.setText(`内力 ${this.innerPower}`);
    this.innerPowerFill?.setDisplaySize(Math.round(372 * Phaser.Math.Clamp(progression.innerPowerRatio, 0, 1)), 14);
    this.hudRunText?.setText(`时间 ${formatSeconds(this.getElapsedSeconds())}\n击杀 ${this.kills}`);
    this.updateSkillSlots();
    const hudEventKey = `${health.hp}/${health.maxHp}/${this.heroLevel}/${this.getElapsedSeconds()}`;
    if (hudEventKey !== this.lastHudEventKey) {
      this.lastHudEventKey = hudEventKey;
      eventBus.emit("hud_updated", {
        hp: health.hp,
        maxHp: health.maxHp,
        level: this.heroLevel,
        waveTimeSeconds: this.getElapsedSeconds()
      });
    }
  }

  private drawBossHud(): void {
    const centerX = this.scale.width / 2;
    const y = 104;
    const width = Phaser.Math.Clamp(this.scale.width - 280, 280, 460);
    this.bossHudBack = this.add.rectangle(centerX, y, width, 34, 0x1d0d0b, 0.88)
      .setStrokeStyle(2, 0xd6a15e, 0.86)
      .setDepth(82)
      .setVisible(false);
    this.bossHudFill = this.add.rectangle(centerX - width / 2 + 4, y, width - 8, 22, 0xb83a2f, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(83)
      .setVisible(false);
    this.bossHudText = this.add.text(centerX, y - 1, "", {
      color: "#fff1c7",
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(84).setVisible(false);
    this.bossHudTip = this.add.text(centerX, y + 28, "", {
      color: "#ffd37a",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px"
    }).setOrigin(0.5).setDepth(84).setVisible(false);
  }

  private updateBossHud(): void {
    const boss = this.getBossSnapshot();
    const visible = boss.state !== "pending" && boss.state !== "cleared";
    this.bossHudBack?.setVisible(visible);
    this.bossHudFill?.setVisible(visible);
    this.bossHudText?.setVisible(visible);
    this.bossHudTip?.setVisible(visible && boss.currentAttack !== "none");
    if (!visible || !this.bossHudBack || !this.bossHudFill) {
      return;
    }

    const fullWidth = Math.max(0, this.bossHudBack.displayWidth - 8);
    const ratio = Phaser.Math.Clamp(boss.hpPercent / 100, 0, 1);
    this.bossHudFill.setDisplaySize(Math.round(fullWidth * ratio), 22);
    this.bossHudFill.setFillStyle(boss.hpPercent <= 25 ? 0xf05a43 : 0xb83a2f, 0.95);
    this.bossHudText?.setText(`黑风寨主  ${boss.hp}/${boss.maxHp}`);
    const attackLabel = boss.currentAttack === "charge_slash"
      ? "冲撞斩"
      : boss.currentAttack === "whirlwind_blade"
        ? "旋风刀"
        : "";
    this.bossHudTip?.setText(attackLabel ? `${attackLabel} 预警中` : "");
  }

  private updateStageScroll(movement: HeroMovementSnapshot): void {
    this.stageScrollX += movement.deltaX;
    this.stageScrollY += movement.deltaY;

    if (this.groundTile) {
      this.groundTile.tilePositionX = this.stageScrollX * 0.38;
      this.groundTile.tilePositionY = this.stageScrollY * 0.38;
    }

    if (this.roadTile) {
      this.roadTile.tilePositionX = this.stageScrollX;
      this.roadTile.tilePositionY = this.stageScrollY;
    }

    if (this.roadAccentTile) {
      this.roadAccentTile.tilePositionX = 420 + this.stageScrollX * 0.84;
      this.roadAccentTile.tilePositionY = 128 + this.stageScrollY * 0.84;
    }

    for (const prop of this.backgroundProps) {
      prop.image.x = Phaser.Math.Wrap(prop.baseX - this.stageScrollX * prop.parallaxX, -prop.marginX, this.scale.width + prop.marginX);
      prop.image.y = Phaser.Math.Wrap(prop.baseY - this.stageScrollY * prop.parallaxY, -prop.marginY, this.scale.height + prop.marginY);
    }
  }

  private updateHeroView(movement: HeroMovementSnapshot): void {
    if (!this.heroView) {
      return;
    }

    const heroSprite = this.heroView instanceof Phaser.GameObjects.Sprite ? this.heroView : undefined;
    if (heroSprite) {
      const health = this.getHealthSnapshot();
      if (health.invincibleMs > 0 && this.textures.exists("hero_shaoxia_hurt")) {
        this.playHeroAnimation(heroSprite, "hero_shaoxia_hurt");
      } else if (movement.inputMagnitude > 0.02 && this.textures.exists("hero_shaoxia_move")) {
        this.playHeroAnimation(heroSprite, "hero_shaoxia_move");
      } else {
        this.playHeroAnimation(heroSprite, "hero_shaoxia_idle");
      }

      if (Math.abs(movement.inputX) > 0.05) {
        heroSprite.setFlipX(movement.inputX > 0);
      }
      heroSprite.setRotation(0);
    } else if (movement.inputMagnitude > 0.02) {
      this.heroView.rotation = Math.atan2(movement.inputX, -movement.inputY);
    }

    const centerY = this.getHeroScreenY();
    const bob = Math.sin(this.elapsedMs / 130) * 1.5 * movement.inputMagnitude;
    this.heroView.setPosition(this.scale.width / 2, centerY + bob);
    this.heroShadow?.setScale(1 + movement.inputMagnitude * 0.08, 1);

    const health = this.getHealthSnapshot();
    if (health.invincibleMs > 0) {
      this.heroView.setAlpha(Math.sin(this.elapsedMs / 18) > 0 ? 0.46 : 0.95);
    } else {
      this.heroView.setAlpha(1);
    }

    const footY = centerY + bob + 38;
    this.heroShadow?.setPosition(this.scale.width / 2, centerY + bob + 24);
    this.footHpBack?.setPosition(this.scale.width / 2 - 28, footY);
    this.footHpFill?.setPosition(this.scale.width / 2 - 27, footY);
  }

  private playHeroAnimation(sprite: Phaser.GameObjects.Sprite, assetId: string): void {
    const animationKey = getArtAnimationKey(assetId);
    if (!this.anims.exists(animationKey) || sprite.anims.currentAnim?.key === animationKey) {
      return;
    }
    sprite.play(animationKey);
  }

  private updateHealthFeedback(deltaMs: number): void {
    const health = this.getHealthSnapshot();
    const visible = health.footHpBarVisible;
    this.footHpBack?.setVisible(visible);
    this.footHpFill?.setVisible(visible);
    this.footHpFill?.setDisplaySize(Math.max(0, Math.round(54 * Phaser.Math.Clamp(health.hpRatio, 0, 1))), 4);
    this.footHpFill?.setFillStyle(health.isLowHp ? 0xd95a4f : 0x5fd27a, 1);

    for (const edge of this.screenDamageEdges) {
      if (edge.alpha > 0) {
        edge.setAlpha(Math.max(0, edge.alpha - deltaMs / 820));
      }
    }
  }

  private openPause(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    getAudioSystem(this).playPlaceholder("pause_toggle");
    prepareScreenTransition(this, "pause");
    eventBus.emit("pause_opened", {});
    this.scene.pause(SCENE_KEYS.game);
    this.scene.launch(SCENE_KEYS.pause);
  }

  private openInsight(pendingInsight?: PendingInsight): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    prepareScreenTransition(this, "insight");
    eventBus.emit("insight_started", {});
    eventBus.emit("insight_opened", {
      levelBefore: pendingInsight?.levelBefore,
      levelAfter: pendingInsight?.levelAfter,
      options: pendingInsight?.options.map((option) => option.id) ?? []
    });
    this.debugPanel?.update(this.createDebugSnapshot());
    this.scene.pause(SCENE_KEYS.game);
    this.scene.launch(SCENE_KEYS.insight, pendingInsight);
  }

  private startDeathTransition(causeText = "血量耗尽", eventCause = "debug"): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    const runSummary = this.createRunSummary("dead", causeText);
    setRunSummary(this, runSummary);
    prepareScreenTransition(this, "death_transition");
    eventBus.emit("death_transition_started", { cause: eventCause });
    this.debugPanel?.update(this.createDebugSnapshot());
    this.scene.pause(SCENE_KEYS.game);
    this.scene.launch(SCENE_KEYS.deathTransition, { causeText, runSummary });
  }

  private showResult(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    const runSummary = this.createRunSummary("debug");
    setRunSummary(this, runSummary);
    prepareScreenTransition(this, "result");
    this.scene.stop(SCENE_KEYS.game);
    this.scene.start(SCENE_KEYS.result, runSummary);
  }

  private createRunSummary(
    result: RunSummary["result"],
    deathCause?: string,
    overrides: Partial<Pick<RunSummary, "bossDefeated">> = {}
  ): RunSummary {
    return {
      runId: this.runId,
      result,
      survivalSeconds: this.getElapsedSeconds(),
      kills: this.kills,
      level: this.heroLevel,
      copperEarned: 0,
      bossDefeated: overrides.bossDefeated ?? false,
      deathCause
    };
  }

  private createDebugSnapshot(): DebugSnapshot {
    const configLoadResult = getConfigLoadResult(this);
    const eventHistorySummary = eventBus.getHistorySummary();
    const health = this.getHealthSnapshot();
    const movement = this.latestMovement ?? this.heroMovement?.getSnapshot() ?? {
      x: 0,
      y: 0,
      speed: 220,
      deltaX: 0,
      deltaY: 0,
      velocityX: 0,
      velocityY: 0,
      velocityMagnitude: 0,
      inputX: 0,
      inputY: 0,
      inputMagnitude: 0,
      inputSource: "none",
      originRebaseCount: 0
    };
    const enemyDirector = this.getEnemyDirectorSnapshot();
    const boss = this.getBossSnapshot();
    const skillSnapshot = this.getSkillSnapshot();
    const progression = this.getProgressionSnapshot();

    return {
      fps: Math.round(this.game.loop.actualFps),
      scene: SCENE_KEYS.game,
      screenState: getScreenState(this),
      heroX: movement.x,
      heroY: movement.y,
      heroHp: health.hp,
      heroMaxHp: health.maxHp,
      heroLevel: this.heroLevel,
      heroSpeed: movement.speed,
      heroVelocityX: movement.velocityX,
      heroVelocityY: movement.velocityY,
      heroVelocityMagnitude: movement.velocityMagnitude,
      inputX: movement.inputX,
      inputY: movement.inputY,
      inputMagnitude: movement.inputMagnitude,
      inputSource: movement.inputSource,
      innerPower: this.innerPower,
      nextRequired: progression.nextRequired,
      pickupRadius: progression.pickupRadius,
      insightCount: progression.insightCount,
      lastInsightAt: progression.lastInsightAtSeconds,
      pendingInsight: progression.pendingInsight,
      invincibleMs: health.invincibleMs,
      isLowHp: health.isLowHp,
      lastDamageSource: health.lastDamageSource,
      footHpBarVisible: health.footHpBarVisible,
      hudSafeRadiusPx: 180,
      originRebaseCount: movement.originRebaseCount,
      enemiesAlive: enemyDirector.enemiesAlive,
      enemiesAliveByType: enemyDirector.enemiesAliveByType,
      targetAlive: enemyDirector.targetAlive,
      targetAliveMin: enemyDirector.targetAliveMin,
      rawTargetAliveMin: enemyDirector.rawTargetAliveMin,
      rawTargetAliveMax: enemyDirector.rawTargetAliveMax,
      aliveCap: enemyDirector.aliveCap,
      rawAliveCap: enemyDirector.rawAliveCap,
      platformClamp: enemyDirector.platformClamp,
      spawnIntervalMs: enemyDirector.spawnIntervalMs,
      lastSpawnSide: enemyDirector.lastSpawnSide,
      sameSpawnSideStreak: enemyDirector.sameSpawnSideStreak,
      lastSpawnDistanceFromHero: enemyDirector.lastSpawnDistanceFromHero,
      minSpawnDistanceLast30s: enemyDirector.minSpawnDistanceLast30s,
      despawnCountLast10s: enemyDirector.despawnCountLast10s,
      eliteAlive: enemyDirector.eliteAlive,
      nextEliteSeconds: enemyDirector.nextEliteSeconds,
      bossRequestEmitted: enemyDirector.bossRequestEmitted,
      skills: skillSnapshot.skills,
      projectilesAlive: skillSnapshot.projectilesAlive,
      orbitalsAlive: skillSnapshot.orbitalsAlive,
      skillHitsLast10s: skillSnapshot.skillHitsLast10s,
      skillDpsLast10s: skillSnapshot.skillDpsLast10s,
      advancedSkills: skillSnapshot.advancedSkills,
      gemsAlive: progression.gemsAlive,
      activeVfx: skillSnapshot.activeVfx,
      audioVoices: getAudioSystem(this).getActiveVoices(),
      waveTimeSeconds: this.getElapsedSeconds(),
      directorState: enemyDirector.directorState,
      bossState: boss.state,
      bossHp: boss.hp,
      bossHpPercent: boss.hpPercent,
      currentAttack: boss.currentAttack,
      nextChargeSeconds: boss.nextChargeSeconds,
      nextWhirlwindSeconds: boss.nextWhirlwindSeconds,
      lastWarningDuration: boss.lastWarningDuration,
      lastAttackDamage: boss.lastAttackDamage,
      bossAliveSeconds: boss.aliveSeconds,
      bossHitCount: boss.hitCount,
      bossAttacksUsed: boss.attacksUsed,
      stageCleared: boss.stageCleared,
      stageId: configLoadResult.config.stage.id,
      loadedChunkCount: configLoadResult.config.stage.loadedChunkCount,
      qualityScale: configLoadResult.config.stage.qualityScale,
      missingRequiredAssets: configLoadResult.config.art.missingRequired,
      missingRequiredAudioEvents: configLoadResult.config.audio.missingRequired,
      saveStatus: saveSystem.getStatus(),
      configStatus: configLoadResult.status,
      loadedConfigIds: configLoadResult.config.loadedConfigIds.join(","),
      loadedConfigCount: configLoadResult.config.loadedConfigIds.length,
      eventHistoryCount: eventHistorySummary.count,
      lastEventName: eventHistorySummary.lastEventName
    };
  }

  private drawSkillSlots(): void {
    this.skillSlotFrames = [];
    this.skillSlotIcons = [];
    this.skillSlotTexts = [];
    const slotSize = 72;
    const gap = 8;
    const totalWidth = slotSize * 4 + gap * 3;
    const startX = this.scale.width / 2 - totalWidth / 2 + slotSize / 2;
    const y = this.scale.height - 42;

    for (let index = 0; index < 4; index += 1) {
      const x = startX + index * (slotSize + gap);
      const frame = this.textures.exists("ui_hud_skill_slot")
        ? this.add.image(x, y, "ui_hud_skill_slot").setDisplaySize(slotSize, slotSize).setDepth(80)
        : this.add.rectangle(x, y, slotSize, slotSize, 0x11140f, 0.68)
          .setStrokeStyle(1, 0xd6c28d, 0.62)
          .setDepth(80);
      const initialIconAssetId = getFirstExistingHudSkillIconAssetId(this);
      const icon = initialIconAssetId
        ? this.add.image(x, y - 8, initialIconAssetId).setDisplaySize(34, 34).setDepth(81).setVisible(false)
        : undefined;
      const text = this.add.text(x, y + 18, `${index + 1}`, {
        color: "#b8c8ba",
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        fontStyle: "bold"
      }).setOrigin(0.5).setDepth(81).setAlign("center");
      this.skillSlotFrames.push(frame);
      this.skillSlotIcons.push(icon);
      this.skillSlotTexts.push(text);
    }
  }

  private updateSkillSlots(): void {
    const slots = this.getSkillSnapshot().skillSlots;
    for (let index = 0; index < this.skillSlotTexts.length; index += 1) {
      const frame = this.skillSlotFrames[index];
      const icon = this.skillSlotIcons[index];
      const text = this.skillSlotTexts[index];
      const slot = slots[index];
      if (!slot) {
        setSkillSlotFrameState(frame, false, false);
        icon?.setVisible(false);
        text?.setColor("#6f7f74");
        text?.setText(`${index + 1}`);
        continue;
      }

      setSkillSlotFrameState(frame, true, slot.advanced);
      const iconAssetId = getHudSkillIconAssetId(slot.skillId, slot.advanced);
      if (icon && this.textures.exists(iconAssetId)) {
        icon.setTexture(iconAssetId).setDisplaySize(34, 34).setVisible(true);
      } else {
        icon?.setVisible(false);
      }
      text?.setColor(slot.advanced ? "#fff1a8" : "#f7f0d0");
      text?.setText(`${getShortSkillName(slot.displayName)}\nLv${slot.level}`);
    }
  }

  private applyDebugDamage(): void {
    if (getScreenState(this) !== "game") {
      return;
    }

    this.applyHeroDamage(DEBUG_DAMAGE_AMOUNT, "debug_hurt");
  }

  private applyDebugHeal(): void {
    if (getScreenState(this) !== "game") {
      return;
    }

    const healed = this.heroHealth?.heal(DEBUG_HEAL_AMOUNT);
    if (!healed) {
      return;
    }

    getAudioSystem(this).playPlaceholder("heal_pickup");
    this.showHealFlash();
    this.latestHealth = this.heroHealth?.getSnapshot();
  }

  private spawnBossForDebug(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    this.bossSystem?.requestSpawn("debug");
    this.latestBoss = this.bossSystem?.getSnapshot();
    this.updateBossHud();
  }

  private enableP0ArtShowcaseForDebug(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    this.skillSystem?.debugEnableP0AdvancedShowcase();
    this.enemyDirector?.debugSpawnShowcase();
    this.enemyDirector?.debugShowEliteWarningForShowcase();
    this.latestSkillSnapshot = this.skillSystem?.getSnapshot();
    this.latestEnemyDirector = this.enemyDirector?.getSnapshot();
    this.updateSkillSlots();
    this.debugPanel?.update(this.createDebugSnapshot());
  }

  private startInsightArtShowcaseForDebug(): void {
    if (getScreenState(this) !== "game") {
      return;
    }

    const pendingInsight = createDebugInsightArtShowcase(this.debugInsightShowcaseIndex);
    this.debugInsightShowcaseIndex = (this.debugInsightShowcaseIndex + 1) % DEBUG_INSIGHT_ART_SHOWCASES.length;
    this.openInsight(pendingInsight);
  }

  private spawnEnemyShowcaseForDebug(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    this.enemyDirector?.debugSpawnShowcase();
    this.latestEnemyDirector = this.enemyDirector?.getSnapshot();
    this.debugPanel?.update(this.createDebugSnapshot());
  }

  private applyDebugBossDamage(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    if (this.getBossSnapshot().state === "pending") {
      this.spawnBossForDebug();
    }
    this.bossSystem?.debugDamageBoss(DEBUG_BOSS_DAMAGE_AMOUNT);
    this.latestBoss = this.bossSystem?.getSnapshot();
    this.updateBossHud();
  }

  private applyInsightRecovery(): void {
    const healed = this.heroHealth?.heal(INSIGHT_RECOVERY_AMOUNT);
    if (!healed) {
      return;
    }

    getAudioSystem(this).playPlaceholder("heal_pickup");
    this.showHealFlash();
    this.latestHealth = this.heroHealth?.getSnapshot();
  }

  private showHealFlash(): void {
    const { x, y } = this.getHeroScreenPosition();
    const flash = this.add.circle(x, y, 34, 0x6feb8a, 0.24)
      .setStrokeStyle(2, 0xb8ffd0, 0.68)
      .setDepth(65);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.45,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  private getHealthSnapshot(): HeroHealthSnapshot {
    return this.latestHealth ?? this.heroHealth?.getSnapshot() ?? {
      hp: 100,
      maxHp: 100,
      hpRatio: 1,
      invincibleMs: 0,
      isLowHp: false,
      isDead: false,
      lastDamageSource: "none",
      footHpBarVisible: false
    };
  }

  private getEnemyDirectorSnapshot(): EnemyDirectorSnapshot {
    return this.latestEnemyDirector ?? this.enemyDirector?.getSnapshot() ?? {
      enemiesAlive: 0,
      enemiesAliveByType: {},
      targetAlive: 0,
      targetAliveMin: 0,
      rawTargetAliveMin: 0,
      rawTargetAliveMax: 0,
      aliveCap: 0,
      rawAliveCap: 0,
      platformClamp: "desktop",
      spawnIntervalMs: 0,
      lastSpawnSide: "none",
      sameSpawnSideStreak: 0,
      lastSpawnDistanceFromHero: 0,
      minSpawnDistanceLast30s: 0,
      despawnCountLast10s: 0,
      eliteAlive: 0,
      nextEliteSeconds: 180,
      bossRequestEmitted: false,
      directorState: "not_started"
    };
  }

  private getBossSnapshot(): BossSystemSnapshot {
    return this.latestBoss ?? this.bossSystem?.getSnapshot() ?? {
      state: "pending",
      hp: 0,
      maxHp: 4200,
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

  private getSkillSnapshot(): SkillSystemSnapshot {
    return this.latestSkillSnapshot ?? this.skillSystem?.getSnapshot() ?? {
      skills: "游龙剑气 Lv1",
      projectilesAlive: 0,
      orbitalsAlive: 0,
      activeVfx: 0,
      skillHitsLast10s: 0,
      skillDpsLast10s: 0,
      advancedSkills: "",
      skillSlots: [
        {
          skillId: "yulong_sword_qi",
          displayName: "游龙剑气",
          level: 1,
          advanced: false
        }
      ]
    };
  }

  private getProgressionSnapshot(): ProgressionSnapshot {
    return this.latestProgression ?? this.progressionSystem?.getSnapshot() ?? {
      level: 1,
      innerPower: 0,
      nextRequired: 24,
      innerPowerRatio: 0,
      innerPowerText: "0/24",
      insightCount: 0,
      gemsAlive: 0,
      lastInsightAtSeconds: -1,
      pendingInsight: false,
      pickupRadius: 70
    };
  }

  private applyHeroDamage(amount: number, source: string): DamageResult | undefined {
    if (getScreenState(this) !== "game") {
      return undefined;
    }

    const result = this.heroHealth?.damage(amount, source);
    if (!result?.damaged) {
      return result;
    }

    getAudioSystem(this).playPlaceholder("hero_hurt");
    this.showHeroHurtFlash();
    for (const edge of this.screenDamageEdges) {
      edge.setAlpha(0.3);
    }
    this.latestHealth = this.heroHealth?.getSnapshot();
    if (result.died) {
      this.handleHeroDeath(source);
    }
    return result;
  }

  private showHeroHurtFlash(): void {
    if (!this.textures.exists("vfx_hero_hurt_flash")) {
      return;
    }
    const { x, y } = this.getHeroScreenPosition();
    const flash = this.add.sprite(x, y, "vfx_hero_hurt_flash")
      .setDisplaySize(112, 112)
      .setDepth(66)
      .setAlpha(0.72)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.24,
      duration: 190,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  private getHeroWorldPosition(): { x: number; y: number } {
    const movement = this.latestMovement ?? this.heroMovement?.getSnapshot();
    return {
      x: movement?.x ?? 0,
      y: movement?.y ?? 0
    };
  }

  private getHeroScreenPosition(): { x: number; y: number } {
    return {
      x: this.scale.width / 2,
      y: this.getHeroScreenY()
    };
  }

  private handleEnemyKilled(result: Parameters<ProgressionSystem["spawnFromEnemyKill"]>[0]): void {
    this.kills += 1;
    this.progressionSystem?.spawnFromEnemyKill(result);
  }

  private handleBossDefeated(_summary: BossDefeatSummary): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    const runSummary = this.createRunSummary("win", undefined, {
      bossDefeated: true
    });
    setRunSummary(this, runSummary);
    prepareScreenTransition(this, "result");
    this.debugPanel?.update(this.createDebugSnapshot());
    this.scene.stop(SCENE_KEYS.game);
    this.scene.start(SCENE_KEYS.result, runSummary);
  }

  private syncProgressionSnapshot(): void {
    const progression = this.getProgressionSnapshot();
    this.heroLevel = progression.level;
    this.innerPower = progression.innerPowerText;
  }

  private applyInsightSelection(optionId: string): void {
    if (!optionId) {
      return;
    }

    const result = this.progressionSystem?.applyInsightOption(optionId);
    if (!result?.applied || !result.option) {
      return;
    }

    const unlockMatch = result.option.applyEffectId.match(/^unlock_(.+)$/);
    if (unlockMatch && isSkillId(unlockMatch[1])) {
      this.skillSystem?.unlockSkill(unlockMatch[1], 1);
    }

    const skillUpgradeMatch = result.option.applyEffectId.match(/^upgrade_(.+)_(\d+)$/);
    if (skillUpgradeMatch && isSkillId(skillUpgradeMatch[1])) {
      this.skillSystem?.setSkillLevel(skillUpgradeMatch[1], Number(skillUpgradeMatch[2]));
    }

    const advanceKeyMatch = result.option.applyEffectId.match(/^collect_advance_key_(.+)$/);
    if (advanceKeyMatch && isAdvanceKeyId(advanceKeyMatch[1])) {
      this.skillSystem?.collectAdvanceKey(advanceKeyMatch[1]);
    }

    const advanceMatch = result.option.applyEffectId.match(/^advance_(.+)$/);
    if (advanceMatch && isSkillId(advanceMatch[1])) {
      this.skillSystem?.advanceSkill(advanceMatch[1]);
    }

    if (result.option.applyEffectId === "passive_move_speed_1") {
      this.heroMovement?.increaseMoveSpeedPercent(0.05);
      this.latestMovement = this.heroMovement?.getSnapshot();
    }
    if (result.option.applyEffectId === "passive_max_hp_1") {
      this.latestHealth = this.heroHealth?.increaseMaxHp(10);
    }
    this.applyInsightRecovery();
    this.latestSkillSnapshot = this.skillSystem?.getSnapshot();
    this.latestProgression = this.progressionSystem?.getSnapshot();
    this.syncProgressionSnapshot();
  }

  private getElapsedSeconds(): number {
    return Math.floor(this.elapsedMs / 1000);
  }

  private getHeroScreenY(): number {
    return this.scale.height / 2 + 12;
  }

  private handleHeroDeath(eventCause: string): void {
    this.startDeathTransition("血量耗尽", eventCause);
  }

  private ensureStageTextures(): void {
    if (!this.textures.exists("qingshi_ground_tile")) {
      const ground = this.textures.createCanvas("qingshi_ground_tile", 512, 512);
      const context = ground?.getContext();
      if (ground && context) {
        context.fillStyle = "#33483e";
        context.fillRect(0, 0, 512, 512);
        context.fillStyle = "rgba(216, 234, 217, 0.08)";
        for (let index = 0; index < 80; index += 1) {
          const x = (index * 83) % 512;
          const y = (index * 151) % 512;
          const radius = 1 + (index % 4);
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
        context.strokeStyle = "rgba(13, 26, 18, 0.18)";
        context.lineWidth = 2;
        for (let x = 0; x <= 512; x += 64) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x - 96, 512);
          context.stroke();
        }
        ground.refresh();
      }
    }

    if (!this.textures.exists("qingshi_road_tile")) {
      const road = this.textures.createCanvas("qingshi_road_tile", 1024, 1024);
      const context = road?.getContext();
      if (road && context) {
        context.clearRect(0, 0, 1024, 1024);
        context.strokeStyle = "rgba(111, 106, 86, 0.44)";
        context.lineWidth = 132;
        context.lineCap = "round";
        for (let offset = -768; offset <= 1280; offset += 460) {
          context.beginPath();
          context.moveTo(offset, 1024);
          context.lineTo(offset + 1024, 0);
          context.stroke();
        }
        context.strokeStyle = "rgba(247, 240, 208, 0.16)";
        context.lineWidth = 4;
        for (let offset = -768; offset <= 1280; offset += 230) {
          context.beginPath();
          context.moveTo(offset, 1024);
          context.lineTo(offset + 1024, 0);
          context.stroke();
        }
        road.refresh();
      }
    }
  }
}

function createRunId(): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `run_${randomId}`;
}

function formatSeconds(totalSeconds: number): string {
  const clampedTotalSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(clampedTotalSeconds / 60);
  const seconds = clampedTotalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createDamageEdgeFlash(scene: Phaser.Scene): Phaser.GameObjects.Rectangle[] {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const thickness = 56;
  const edges = [
    scene.add.rectangle(width / 2, thickness / 2, width, thickness, 0x7d1616, 0),
    scene.add.rectangle(width / 2, height - thickness / 2, width, thickness, 0x7d1616, 0),
    scene.add.rectangle(thickness / 2, height / 2, thickness, height, 0x7d1616, 0),
    scene.add.rectangle(width - thickness / 2, height / 2, thickness, height, 0x7d1616, 0)
  ];

  for (const edge of edges) {
    edge.setDepth(900);
    edge.setBlendMode(Phaser.BlendModes.ADD);
  }

  return edges;
}

function createHudPauseButton(scene: Phaser.Scene, x: number, y: number, onClick: () => void): void {
  if (scene.textures.exists("ui_icon_pause")) {
    const icon = scene.add.image(x, y, "ui_icon_pause").setDisplaySize(54, 54).setDepth(83);
    const hitArea = scene.add.rectangle(x, y, 78, 70, 0x000000, 0).setDepth(84);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on(Phaser.Input.Events.POINTER_OVER, () => icon.setScale(0.6));
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => icon.setScale(54 / 96));
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => {
      icon.setScale(0.54);
      onClick();
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, () => icon.setScale(0.6));
    return;
  }

  const background = scene.add.rectangle(x, y, 84, 72, 0x2f5b4f, 0.95)
    .setStrokeStyle(2, 0xd6c28d, 0.9)
    .setDepth(82);
  scene.add.text(x, y, "暂停", {
    color: "#f7f0d0",
    fontFamily: "system-ui, sans-serif",
    fontSize: "18px",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(83);
  background.setInteractive({ useHandCursor: true });
  background.on(Phaser.Input.Events.POINTER_OVER, () => background.setFillStyle(0x3a6f61, 1));
  background.on(Phaser.Input.Events.POINTER_OUT, () => background.setFillStyle(0x2f5b4f, 0.95));
  background.on(Phaser.Input.Events.POINTER_DOWN, onClick);
}

const DEBUG_INSIGHT_ART_SHOWCASES: Array<{ levelBefore: number; levelAfter: number; options: InsightOption[] }> = [
  {
    levelBefore: 15,
    levelAfter: 16,
    options: [
      {
        id: "debug_sword_manual_page",
        category: "advance_key",
        title: "剑谱残页",
        description: "游龙剑气进阶所需",
        typeLabel: "进阶信物",
        iconKey: "advance_key_sword_manual_page",
        applyEffectId: "debug_showcase_sword_manual_page"
      },
      {
        id: "debug_hidden_weapon_pouch",
        category: "advance_key",
        title: "暗器囊",
        description: "回风飞镖进阶所需",
        typeLabel: "进阶信物",
        iconKey: "advance_key_hidden_weapon_pouch",
        applyEffectId: "debug_showcase_hidden_weapon_pouch"
      },
      {
        id: "debug_inner_force_manual",
        category: "advance_key",
        title: "内劲心法",
        description: "震山掌进阶所需",
        typeLabel: "进阶信物",
        iconKey: "advance_key_inner_force_manual",
        applyEffectId: "debug_showcase_inner_force_manual"
      }
    ]
  },
  {
    levelBefore: 16,
    levelAfter: 17,
    options: [
      {
        id: "debug_yulong_skill_icon",
        category: "skill_upgrade",
        title: "游龙剑气 Lv5",
        description: "剑气更锋利",
        typeLabel: "招式强化",
        iconKey: "skill_yulong_projectile",
        applyEffectId: "upgrade_yulong_sword_qi_5"
      },
      {
        id: "debug_huifeng_skill_icon",
        category: "skill_upgrade",
        title: "回风飞镖 Lv5",
        description: "飞镖更密更快",
        typeLabel: "招式强化",
        iconKey: "skill_huifeng_dart",
        applyEffectId: "upgrade_huifeng_dart_5"
      },
      {
        id: "debug_zhenshan_skill_icon",
        category: "skill_upgrade",
        title: "震山掌 Lv5",
        description: "掌风范围扩大",
        typeLabel: "招式强化",
        iconKey: "skill_zhenshan_wave",
        applyEffectId: "upgrade_zhenshan_palm_5"
      }
    ]
  },
  {
    levelBefore: 17,
    levelAfter: 18,
    options: [
      {
        id: "debug_yulong_advanced_icon",
        category: "skill_advance",
        title: "游龙归海",
        description: "三道穿透剑气",
        typeLabel: "进阶招式",
        iconKey: "skill_yulong_projectile",
        applyEffectId: "advance_yulong_sword_qi"
      },
      {
        id: "debug_huifeng_advanced_icon",
        category: "skill_advance",
        title: "回风连环",
        description: "多枚飞镖成环",
        typeLabel: "进阶招式",
        iconKey: "skill_huifeng_dart_advanced",
        applyEffectId: "advance_huifeng_dart"
      },
      {
        id: "debug_zhenshan_advanced_icon",
        category: "skill_advance",
        title: "裂石掌风",
        description: "掌风裂石扩散",
        typeLabel: "进阶招式",
        iconKey: "skill_zhenshan_wave_advanced",
        applyEffectId: "advance_zhenshan_palm"
      }
    ]
  },
  {
    levelBefore: 18,
    levelAfter: 19,
    options: [
      {
        id: "debug_passive_body_training_icon",
        category: "passive",
        title: "体魄训练",
        description: "最大血量提高",
        typeLabel: "被动属性",
        iconKey: "passive_max_hp",
        applyEffectId: "passive_max_hp_1"
      },
      {
        id: "debug_passive_lightfoot_icon",
        category: "passive",
        title: "轻功步法",
        description: "移动速度提高",
        typeLabel: "被动属性",
        iconKey: "passive_lightfoot",
        applyEffectId: "passive_move_speed_1"
      },
      {
        id: "debug_passive_pickup_icon",
        category: "passive",
        title: "磁石锦囊",
        description: "拾取范围提高",
        typeLabel: "被动属性",
        iconKey: "passive_pickup_radius",
        applyEffectId: "passive_pickup_radius_1"
      }
    ]
  }
];

function createDebugInsightArtShowcase(index: number): PendingInsight {
  const showcase = DEBUG_INSIGHT_ART_SHOWCASES[index % DEBUG_INSIGHT_ART_SHOWCASES.length];
  return {
    levelBefore: showcase.levelBefore,
    levelAfter: showcase.levelAfter,
    options: showcase.options.map((option) => ({ ...option }))
  };
}

function getShortSkillName(displayName: string): string {
  if (displayName === "游龙归海") {
    return "归海";
  }
  if (displayName === "游龙剑气") {
    return "剑气";
  }
  if (displayName === "回风飞镖") {
    return "飞镖";
  }
  if (displayName === "震山掌") {
    return "掌风";
  }
  return displayName.slice(0, 2);
}

function getHudSkillIconAssetId(skillId: SkillId, advanced: boolean): string {
  if (skillId === "huifeng_dart") {
    return advanced ? "ui_icon_skill_huifeng_advanced" : "ui_icon_skill_huifeng";
  }
  if (skillId === "zhenshan_palm") {
    return advanced ? "ui_icon_skill_zhenshan_advanced" : "ui_icon_skill_zhenshan";
  }
  return advanced ? "ui_icon_skill_yulong_advanced" : "ui_icon_skill_yulong";
}

function getFirstExistingHudSkillIconAssetId(scene: Phaser.Scene): string | undefined {
  return [
    "ui_icon_skill_yulong",
    "ui_icon_skill_huifeng",
    "ui_icon_skill_zhenshan",
    "ui_icon_skill_yulong_advanced",
    "ui_icon_skill_huifeng_advanced",
    "ui_icon_skill_zhenshan_advanced"
  ].find((assetId) => scene.textures.exists(assetId));
}

function setSkillSlotFrameState(
  frame: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | undefined,
  occupied: boolean,
  advanced: boolean
): void {
  if (!frame) {
    return;
  }

  if (frame instanceof Phaser.GameObjects.Image) {
    const textureKey = advanced && frame.scene.textures.exists("ui_hud_skill_slot_advanced")
      ? "ui_hud_skill_slot_advanced"
      : "ui_hud_skill_slot";
    frame
      .setTexture(textureKey)
      .setDisplaySize(72, 72)
      .setAlpha(occupied ? 1 : 0.58);
    if (advanced && textureKey === "ui_hud_skill_slot") {
      frame.setTint(0xfff0a4);
    } else {
      frame.clearTint();
    }
    return;
  }

  frame.setFillStyle(0x11140f, occupied ? 0.72 : 0.52);
  frame.setStrokeStyle(advanced ? 3 : 1, advanced ? 0xd8c76a : 0xd6c28d, occupied ? 0.78 : 0.38);
}

function isAdvanceKeyId(value: string): value is AdvanceKeyId {
  return value === "sword_manual_page"
    || value === "hidden_weapon_pouch"
    || value === "inner_force_manual";
}
