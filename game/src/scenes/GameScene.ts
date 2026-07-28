import Phaser from "phaser";
import { heavyHitFocusConfig, narrativeTintConfig, stageConfig, stageMapConfig, stageVisualConfig, vignetteDynamicsConfig, weatherVisualConfig } from "../data/gameConfig";
import type { DayNightTintTier, StageMapEntry, StageMapId, WeatherKind } from "../data/gameConfig";
import type { InsightOption, PendingInsight } from "../data/progression";
import { isSkillId, type AdvanceKeyId, type SkillId } from "../data/skills";
import { BossSystem, type BossDefeatSummary, type BossSystemSnapshot } from "../systems/BossSystem";
import { inkWipeIn, inkWipeOut } from "../fx/InkWipe";
import { EnemyDirectorSystem, type EnemyDirectorSnapshot } from "../systems/EnemyDirectorSystem";
import { HeroHealthSystem, type DamageResult, type HeroHealthSnapshot } from "../systems/HeroHealthSystem";
import { HeroMovementSystem, type HeroMovementSnapshot } from "../systems/HeroMovementSystem";
import { JuiceSystem } from "../systems/JuiceSystem";
import { ProgressionSystem, type ProgressionSnapshot } from "../systems/ProgressionSystem";
import { saveSystem } from "../systems/SaveSystem";
import { SkillSystem, type SkillSystemSnapshot } from "../systems/SkillSystem";
import { DebugPanel } from "../ui/DebugPanel";
import { PALETTE, FONT_BODY, FONT_MONO, FONT_TITLE, fadeIn } from "../ui/visualConstants";
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
// ── 墨染江山（moran_ink_zone）表现层常量：技能实现归并行代理，此处仅做表现接入 ──
/** 技能 id 的匹配键（用 includes 兼容 "moran" 前缀的变体 id）。 */
const MORAN_SKILL_ID_KEY = "moran";
const MORAN_SKILL_ID = "moran_ink_zone";
/** 施放墨圈最短间隔：防止高频施放时墨圈叠加。 */
const MORAN_INK_RIPPLE_MIN_INTERVAL_MS = 1500;
/** 进阶演出事件/快照双通道去重窗口。 */
const MORAN_ADVANCE_FX_DEDUP_MS = 1500;
// ── P3 HUD 顶栏布局常量（960×56 横带，内容垂直中心 y=33）──────────────
const HUD_STRIP_HEIGHT = 56;
const HUD_DEPTH_STRIP = 91;
const HUD_DEPTH_CONTENT = 92;
const HUD_DEPTH_TEXT = 93;
// 左区：等级徽章 + 生命条
const HUD_EMBLEM_X = 40;
const HUD_EMBLEM_SIZE = 52;
const HUD_HEALTH_BAR_X = 72;
const HUD_HEALTH_BAR_Y = 33;
const HUD_HEALTH_BAR_WIDTH = 170;
const HUD_HEALTH_BAR_HEIGHT = 12;
// 中区：内力分段条
const HUD_INNER_BAR_X = 390;
const HUD_INNER_BAR_Y = 33;
const HUD_INNER_BAR_WIDTH = 220;
const HUD_INNER_BAR_HEIGHT = 10;
const HUD_INNER_VALUE_X = 616;
// 右区：时间 / 击杀 / 暂停
const HUD_TIME_X = 706;
const HUD_KILLS_X = 800;
const HUD_LABEL_Y = 15;
const HUD_VALUE_Y = 34;
// Boss 血条：顶栏正下方
const BOSS_BAR_Y = 68;
const BOSS_BAR_WIDTH = 420;
// ── 主角表现层：接触阴影 + 程序化动画（移动倾斜 / 待机呼吸）────────────
/** 接触阴影纹理键：程序化径向渐变墨黑椭圆，按 key 缓存只生成一次。 */
const HERO_SHADOW_TEXTURE_KEY = "hero_contact_shadow";
const HERO_SHADOW_WIDTH = 56;
const HERO_SHADOW_HEIGHT = 20;
const HERO_SHADOW_ALPHA = 0.3;
/** 阴影 depth：比主角精灵（10）低 1，高于地面层（-30~-23）。 */
const HERO_SHADOW_DEPTH = 9;
/** 移动倾斜上限 ±3.5°，按水平速度占比取值，lerp 平滑、停止归零。 */
const HERO_TILT_MAX_RAD = Phaser.Math.DegToRad(3.5);
const HERO_TILT_SMOOTH_MS = 110;
/** 待机呼吸：1.6s 正弦周期，scaleY 在基础 scale 上乘法叠加 ±1.5%。 */
const HERO_BREATH_PERIOD_MS = 1600;
const HERO_BREATH_AMOUNT = 0.015;
/** 移动时 scaleY 回落到基础值的平滑时间常数。 */
const HERO_BREATH_RECOVER_MS = 140;
/** 死亡后阴影淡出时长，与 startDeathTransition 的 420ms 转场窗口同步。 */
const HERO_SHADOW_DEATH_FADE_MS = 420;
// ── 枫叶官道·昼昏渐变（stageMapEntry.dayNightCycle 驱动）─────────────────
/** 叠加层 depth：低于叙事朱砂层（78）约 1.5、高于 Boss 压暗层（76）；地面/角色受染，HUD/飘字（91+）不染。 */
const DAY_NIGHT_OVERLAY_DEPTH = 76.5;
/** 颜色/强度向目标指数缓动的时间常数（毫秒，帧率无关）：切档/切图/F5 解锁均无跳变。 */
const DAY_NIGHT_SMOOTH_MS = 500;
/** F5 预览锁定的档位秒数（暮赭红）。 */
const DAY_NIGHT_DEBUG_PIN_SECONDS = 330;
// ── 夜雨破庙·永夜夜色叠加 + 石灯笼假光晕 ─────────────────────────────────
/** 石灯笼光晕纹理键：程序化径向暖光（白心渐隐，tint 染色），按 key 缓存只生成一次。 */
const LANTERN_GLOW_TEXTURE_KEY = "temple_lantern_glow";
const LANTERN_GLOW_TEXTURE_SIZE = 96;
/** 光晕暖色 tint 与呼吸基准/振幅（ADD 混合，alpha 围绕 0.35 呼吸）。 */
const LANTERN_GLOW_TINT = 0xffc06a;
const LANTERN_GLOW_BASE_ALPHA = 0.35;
const LANTERN_GLOW_BREATH_AMOUNT = 0.08;
const LANTERN_GLOW_BREATH_PERIOD_MS = 1900;

/** 昼昏渐变档位 → 插值用通道对象（r/g/b 0-255 + strength）。 */
function dayNightTierChannels(tier: DayNightTintTier): { r: number; g: number; b: number; strength: number } {
  return {
    r: (tier.tint >> 16) & 0xff,
    g: (tier.tint >> 8) & 0xff,
    b: tier.tint & 0xff,
    strength: tier.strength
  };
}

/** 装饰物微动画元数据：残旗呼吸 / 竹丛错相位摆动 / 灯笼轻晃。 */
type ScatterPropSway = {
  kind: "flag" | "bamboo" | "lantern";
  phase: number;
  baseRotation: number;
  baseScaleY: number;
};

/** 石灯笼假光晕元数据：ADD 混合径向暖光 sprite 挂在 prop 上，相位错开呼吸。 */
type LanternGlowMeta = {
  image: Phaser.GameObjects.Image;
  phase: number;
  baseAlpha: number;
};

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
  private heroShadow?: Phaser.GameObjects.Image;
  /** 主角基础 scaleY：drawHero 时采样（2 倍素材后 sprite 约 0.33），呼吸/回落均乘法叠加，不写死。 */
  private heroBaseScaleY = 1;
  /** 当前移动倾斜角（弧度），指数平滑趋近目标。 */
  private heroTiltRad = 0;
  private footHpBack?: Phaser.GameObjects.Rectangle;
  private footHpFill?: Phaser.GameObjects.Rectangle;
  private screenDamageEdges: Phaser.GameObjects.Rectangle[] = [];
  private groundTile?: Phaser.GameObjects.TileSprite;
  private roadTile?: Phaser.GameObjects.TileSprite;
  private roadAccentTile?: Phaser.GameObjects.TileSprite;
  private gateImage?: Phaser.GameObjects.Image;
  private fogTile?: Phaser.GameObjects.TileSprite;
  /** 静态暗角（drawPlaceholderStage 创建；地图切换时随地面层一起重建）。 */
  private vignetteStatic?: Phaser.GameObjects.Image;
  /** 当前地图 id（stageMapConfig 条目）；F2 局内切换预览时改写。 */
  private currentMapId: StageMapId = stageMapConfig.defaultMapId;
  /** 地图切换淡入淡出进行中：屏蔽重复 F2，避免叠化穿插。 */
  private stageMapSwitching = false;
  private scatterProps = new Map<string, { image: Phaser.GameObjects.Image; worldX: number; worldY: number; sway?: ScatterPropSway; glow?: LanternGlowMeta }>();
  private propSlotSizePx = 256;
  private bossDimOverlay?: Phaser.GameObjects.Rectangle;
  private bossDimActive = false;
  /** 夜雨破庙·永夜夜色叠加层（全屏冷蓝 MULTIPLY 常驻；仅配置了 nightOverlay 的地图创建）。 */
  private nightOverlay?: Phaser.GameObjects.Rectangle;
  // ── 竹雨听风：天气层 / 色温叙事 / 动态暗角 / 重击聚焦 ──
  private fogBandTile?: Phaser.GameObjects.TileSprite;
  private vignetteDynamic?: Phaser.GameObjects.Image;
  private narrativeDim?: Phaser.GameObjects.Rectangle;
  private narrativeTint?: Phaser.GameObjects.Rectangle;
  // ── 枫叶官道·昼昏渐变：全屏 MULTIPLY 叠加层（无 dayNightCycle 配置的地图不建层）──
  private dayNightOverlay?: Phaser.GameObjects.Rectangle;
  /** 当前叠加状态（RGB 通道 + 强度），逐帧向时间轴目标缓动；F2 切图往返时保留，避免重建瞬间跳变。 */
  private dayNightCurrent = { r: 255, g: 255, b: 255, strength: 0 };
  /** F5 调试：锁定在 330s 暮赭红档便于预览；再按解除，缓动回正常时间轴。 */
  private dayNightDebugPinned = false;
  private hitFocusOverlay?: Phaser.GameObjects.Rectangle;
  private weatherKind: WeatherKind = "clear";
  private leafEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainNearEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainFarEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private snowEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private windSway = 0.7;
  private windSwayTarget = 0.7;
  private nextRippleAtMs = 0;
  private eliteTintActive = false;
  private bossTintActive = false;
  private narrativeAlertOn = false;
  private eliteTintFallback?: Phaser.Time.TimerEvent;
  private vignetteTighten = 0;
  private lowHpPulseTween?: Phaser.Tweens.Tween;
  private wasLowHp = false;
  private killMilestonesHit = new Set<number>();
  private insightOpening = false;
  private deathTransitionQueued = false;
  private bossEndQueued = false;
  private hudLevelText?: Phaser.GameObjects.Text;
  private hudHealthFill?: Phaser.GameObjects.Rectangle;
  private hudHealthGlow?: Phaser.GameObjects.Rectangle;
  private hudHealthText?: Phaser.GameObjects.Text;
  private hudTimeText?: Phaser.GameObjects.Text;
  private hudKillsText?: Phaser.GameObjects.Text;
  private bossHudBack?: Phaser.GameObjects.Rectangle;
  private bossHudFill?: Phaser.GameObjects.Rectangle;
  private bossHudText?: Phaser.GameObjects.Text;
  private bossHudTip?: Phaser.GameObjects.Text;
  private innerPowerLabel?: Phaser.GameObjects.Text;
  private innerPowerSlot?: Phaser.GameObjects.Rectangle;
  private innerPowerBorder?: Phaser.GameObjects.Rectangle;
  private innerPowerFill?: Phaser.GameObjects.Rectangle;
  private innerPowerText?: Phaser.GameObjects.Text;
  private innerPowerTicks?: Phaser.GameObjects.Graphics;
  private innerPowerTickMax = -1;
  private skillSlotFrames: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle> = [];
  private skillSlotIcons: Array<Phaser.GameObjects.Image | undefined> = [];
  private skillSlotTexts: Phaser.GameObjects.Text[] = [];
  private skillSlotKeyHints: Phaser.GameObjects.Text[] = [];
  private skillSlotCooldownMasks: Phaser.GameObjects.Rectangle[] = [];
  private stageScrollX = 0;
  private stageScrollY = 0;
  private elapsedMs = 0;
  private lastHudEventKey = "";
  private runId = "";
  private heroLevel = 1;
  private kills = 0;
  private innerPower = "0/24";
  private debugInsightShowcaseIndex = 0;
  // ── 墨染江山表现层状态（事件 + 快照双通道，防御并行代理实现差异）──
  private moranCastEventSeen = false;
  private moranKnownUnlocked = false;
  private moranInkRippleCooldownUntilMs = 0;
  private moranAdvanceFxPrev = false;
  private lastMoranAdvanceFxAtMs = -10000;

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
    // 开局地图：读存档选关（lastMapId），缺失/非法回默认（青石山道）；F2 局内切换仅预览、不回写存档
    const savedMapId = getSaveData(this).lastMapId;
    this.currentMapId = stageMapConfig.maps.some((entry) => entry.id === savedMapId)
      ? (savedMapId as StageMapId)
      : stageMapConfig.defaultMapId;
    this.stageMapSwitching = false;
    this.vignetteStatic = undefined;
    this.debugInsightShowcaseIndex = 0;
    this.moranCastEventSeen = false;
    this.moranKnownUnlocked = false;
    this.moranInkRippleCooldownUntilMs = 0;
    this.moranAdvanceFxPrev = false;
    this.lastMoranAdvanceFxAtMs = -10000;
    this.heroLevel = 1;
    this.kills = 0;
    this.innerPower = "0/24";
    this.insightOpening = false;
    this.deathTransitionQueued = false;
    this.bossEndQueued = false;
    this.bossDimActive = false;
    this.bossDimOverlay = undefined;
    this.lowHpPulseTween = undefined;
    this.wasLowHp = false;
    this.killMilestonesHit.clear();
    this.weatherKind = "clear";
    this.windSway = weatherVisualConfig.windSwayByKind.clear;
    this.windSwayTarget = this.windSway;
    this.nextRippleAtMs = 0;
    this.eliteTintActive = false;
    this.bossTintActive = false;
    this.narrativeAlertOn = false;
    this.vignetteTighten = 0;
    this.eliteTintFallback = undefined;
    this.fogBandTile = undefined;
    this.vignetteDynamic = undefined;
    this.narrativeDim = undefined;
    this.narrativeTint = undefined;
    this.dayNightOverlay = undefined;
    this.dayNightCurrent = { r: 255, g: 255, b: 255, strength: 0 };
    this.dayNightDebugPinned = false;
    this.hitFocusOverlay = undefined;
    this.leafEmitter = undefined;
    this.rainNearEmitter = undefined;
    this.rainFarEmitter = undefined;
    this.snowEmitter = undefined;
    const saveData = getSaveData(this);
    const metaUpgrades = saveData.metaUpgrades;
    const baseMaxHp = Math.round(100 * (1 + metaUpgrades.max_hp * 0.05));
    const baseMoveSpeed = Math.round(220 * (1 + metaUpgrades.move_speed * 0.03));
    const basePickupRadius = Math.round(70 * (1 + metaUpgrades.pickup_radius * 0.05));
    this.heroHealth = new HeroHealthSystem(baseMaxHp);
    this.latestHealth = this.heroHealth.getSnapshot();

    this.drawPlaceholderStage();
    console.debug(`[StageMap] 当前地图：${this.getCurrentStageMap().displayName} (${this.currentMapId})`);
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

    const juice = JuiceSystem.get(this);
    juice.setLowVfx(getSaveData(this).settings.lowVfxMode);
    juice.startAmbient();
    const suspendAudio = (): void => {
      (getAudioSystem(this) as any).suspendAll?.();
    };
    const resumeAudio = (): void => {
      (getAudioSystem(this) as any).resumeAll?.();
    };
    this.events.on(Phaser.Scenes.Events.PAUSE, suspendAudio);
    this.events.on(Phaser.Scenes.Events.RESUME, resumeAudio);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, suspendAudio);
      this.events.off(Phaser.Scenes.Events.RESUME, resumeAudio);
      JuiceSystem.get(this).stopAmbient();
      (getAudioSystem(this) as any)?.stopMusic?.(400);
    });
    fadeIn(this);

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
      // F6：压测批量刷怪（按当前波次段敌种组成 +30，连按可叠到 aliveCap×1.5 硬上限）
      const stressSpawnWave = (): void => this.spawnStressWaveForDebug();
      const toggleGodMode = (): void => this.toggleGodModeForPerf();
      const startDeath = (): void => this.startDeathTransition();
      const showResult = (): void => this.showResult();
      const damageHero = (): void => this.applyDebugDamage();
      const healHero = (): void => this.applyDebugHeal();
      const enableP0ArtShowcase = (): void => this.enableP0ArtShowcaseForDebug();
      const startInsightArtShowcase = (): void => this.startInsightArtShowcaseForDebug();
      // F5：枫叶官道昼昏渐变预览——直接跳到 330s 暮赭红档，再按回到正常时间轴；Shift+F5：顿悟美术 showcase。
      const previewDuskTier = (event: KeyboardEvent): void => {
        if (event?.shiftKey) {
          startInsightArtShowcase();
          return;
        }
        this.toggleDayNightDebugPin();
      };
      // F4：直接授予墨染江山 Lv1（内部附赠 showcase 木桩便于验证领域表现）
      const grantMoranSkill = (): void => this.grantMoranSkillForDebug();
      const spawnBoss = (): void => this.spawnBossForDebug();
      const damageBoss = (): void => this.applyDebugBossDamage();
      let debugKey: Phaser.Input.Keyboard.Key | undefined;
      if (import.meta.env.DEV) {
        const switchStageMap = (): void => this.cycleStageMapForPreview();
        const toggleGodMode = (): void => this.toggleGodModeForPerf();
        debugKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
        debugKey.on("down", toggleDebug);
        keyboard.on("keydown-F1", startInsight);
        keyboard.on("keydown-F2", switchStageMap);
        keyboard.on("keydown-F3", enableP0ArtShowcase);
        keyboard.on("keydown-F4", grantMoranSkill);
        keyboard.on("keydown-F5", previewDuskTier);
        keyboard.on("keydown-F6", stressSpawnWave);
        keyboard.on("keydown-F7", startDeath);
        keyboard.on("keydown-F8", showResult);
        keyboard.on("keydown-F9", damageHero);
        keyboard.on("keydown-F10", healHero);
        keyboard.on("keydown-F11", spawnBoss);
        keyboard.on("keydown-F12", damageBoss);
        keyboard.on("keydown-G", toggleGodMode);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
          keyboard.off("keydown-F2", switchStageMap);
        });
      }

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        keyboard.off("keydown-ESC", openPause);
        keyboard.off("keydown-P", openPause);
        debugKey?.off("down", toggleDebug);
        if (import.meta.env.DEV) {
          keyboard.off("keydown-F1", startInsight);
          keyboard.off("keydown-F3", enableP0ArtShowcase);
          keyboard.off("keydown-F4", grantMoranSkill);
          keyboard.off("keydown-F5", previewDuskTier);
          keyboard.off("keydown-F6", stressSpawnWave);
          keyboard.off("keydown-F7", startDeath);
          keyboard.off("keydown-F8", showResult);
          keyboard.off("keydown-F9", damageHero);
          keyboard.off("keydown-F10", healHero);
          keyboard.off("keydown-F11", spawnBoss);
          keyboard.off("keydown-G", toggleGodMode);
          keyboard.off("keydown-F12", damageBoss);
        }
      });
    }

    const unsubscribeBossSpawnRequested = eventBus.on<{ bossId?: string }>("boss_spawn_requested", () => {
      this.bossSystem?.requestSpawn("director");
      this.latestBoss = this.bossSystem?.getSnapshot();
      this.updateBossHud();
    });
    // Boss 出场：A 圆墨中晕快速版（700ms 入 + 400ms 褪），叠加在现有压暗/震屏之前。防御性订阅，不动其他逻辑。
    const unsubscribeBossIntroInk = eventBus.on("boss_intro_started", () => {
      this.playBossIntroInkWipe();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeBossIntroInk();
    });
    const unsubscribeInsightSelected = eventBus.on<{ optionId?: string; cardId?: string }>("insight_option_selected", (payload) => {
      this.applyInsightSelection(payload.optionId ?? payload.cardId ?? "");
    });
    // ── 墨染江山①：施放表现 —— 订阅 skill_zone_spawned（含落点坐标），在墨痕领域中心画"挥毫成阵"墨圈，
    //    局部笔墨反馈，不再全屏明暗闪烁。Lv3+「墨里淬毒」载荷带 level/advanced，墨环叠碧色弧（防御性读取）。
    const unsubscribeMoranCast = eventBus.on<{ skillId?: string; worldX?: number; worldY?: number; radius?: number; level?: number; advanced?: boolean }>(
      "skill_zone_spawned",
      (payload) => {
        if (typeof payload?.skillId === "string" && payload.skillId.includes(MORAN_SKILL_ID_KEY)) {
          this.moranCastEventSeen = true;
          this.playMoranZoneRing(payload.worldX, payload.worldY, payload.radius, payload.level, payload.advanced);
        }
      }
    );
    // ── 墨染江山②：进阶演出 —— 监听既有 skill_advanced 事件；事件丢失时由快照 advanced 跳变兜底。
    const unsubscribeMoranAdvanced = eventBus.on<{ skillId?: string }>("skill_advanced", (payload) => {
      if (typeof payload?.skillId === "string" && payload.skillId.includes(MORAN_SKILL_ID_KEY)) {
        this.playMoranAdvancePerformance();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeMoranCast();
      unsubscribeMoranAdvanced();
    });
    // 色温叙事：精英预警压暗泛朱砂；精英被击杀/消失或兜底计时后回落。
    const unsubscribeEliteWarning = eventBus.on<{ warningSeconds?: number }>("enemy_elite_warning_started", (payload) => {
      this.setEliteNarrativeAlert(true, payload?.warningSeconds);
    });
    const clearEliteOnEnd = (payload?: { enemyId?: string }): void => {
      if (payload?.enemyId === "wooden_dummy_elite") {
        this.setEliteNarrativeAlert(false);
      }
    };
    const unsubscribeEliteKilled = eventBus.on<{ enemyId?: string }>("enemy_killed", clearEliteOnEnd);
    const unsubscribeEliteDespawned = eventBus.on<{ enemyId?: string }>("enemy_despawned", clearEliteOnEnd);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeEliteWarning();
      unsubscribeEliteKilled();
      unsubscribeEliteDespawned();
      this.eliteTintFallback?.remove();
      this.eliteTintFallback = undefined;
      for (const emitter of [this.leafEmitter, this.rainNearEmitter, this.rainFarEmitter, this.snowEmitter]) {
        emitter?.destroy();
      }
      this.leafEmitter = undefined;
      this.rainNearEmitter = undefined;
      this.rainFarEmitter = undefined;
      this.snowEmitter = undefined;
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

    (getAudioSystem(this) as any)?.playMusic?.("music_stage_qingshi");
  }

  update(_time: number, delta: number): void {
    const activeDeltaMs = Math.min(delta, 100);
    this.elapsedMs += activeDeltaMs;
    getAudioSystem(this).update(activeDeltaMs);

    if (this.heroMovement) {
      this.latestMovement = this.heroMovement.update(activeDeltaMs);
      this.updateStageScroll(this.latestMovement);
      this.updateHeroView(this.latestMovement, activeDeltaMs);
    }

    this.updateAtmosphere(activeDeltaMs);

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
      this.updateMoranPresentation();
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
    this.ensureAtmosphereTextures();
    this.scatterProps.clear();
    const chunkSize = getConfigLoadResult(this).config.stage.backgroundChunkSizePx;
    this.propSlotSizePx = Math.max(160, Math.floor(chunkSize / stageVisualConfig.propSlotDivisions));
    this.buildStageMapLayers(this.getCurrentStageMap());

    // 竹雨听风：天气纹理 + 雾带加浓层 / 动态暗角 / 色温叙事 / 重击聚焦等屏幕层。
    this.ensureWeatherTextures();
    this.setupAtmosphereOverlays();

    this.refreshPropScatter();
  }

  /** 当前地图条目（防御：配置被改坏时回落到第一张图）。 */
  private getCurrentStageMap(): StageMapEntry {
    return stageMapConfig.maps.find((entry) => entry.id === this.currentMapId) ?? stageMapConfig.maps[0];
  }

  /**
   * 构建地图相关层：世界底色 / 地面平铺 / 路带（按配置）/ 山门远景 / 雾带 / 静态暗角。
   * drawPlaceholderStage 与 F2 切换重建共用；散布物由 refreshPropScatter 另行负责。
   */
  private buildStageMapLayers(map: StageMapEntry): void {
    const stageWidth = this.scale.width;
    const stageHeight = this.scale.height;
    this.cameras.main.setBackgroundColor(map.worldBg);

    const hasOfficialGround = this.textures.exists(map.groundTexture);
    const groundTexture = hasOfficialGround ? map.groundTexture : map.fallbackGroundTexture;
    this.groundTile = this.add.tileSprite(
      stageWidth / 2,
      stageHeight / 2,
      stageWidth,
      stageHeight,
      groundTexture
    ).setDepth(-30).setAlpha(hasOfficialGround ? map.groundAlphaOfficial : 1);

    // 路带：青石山道铺设 road_ribbon_a/b；枫叶官道关闭（官道已画进地面素材）。
    if (map.roadRibbonEnabled) {
      const hasOfficialRoad = this.textures.exists("road_ribbon_a");
      const roadTexture = hasOfficialRoad ? "road_ribbon_a" : "qingshi_road_tile";
      this.roadTile = this.add.tileSprite(
        stageWidth / 2,
        stageHeight / 2 + 20,
        stageWidth + 256,
        Math.max(stageHeight, 512),
        roadTexture
      ).setDepth(-25).setAlpha(hasOfficialRoad ? 0.6 : 1);

      if (this.textures.exists("road_ribbon_b")) {
        this.roadAccentTile = this.add.tileSprite(
          stageWidth / 2,
          stageHeight / 2 + 12,
          stageWidth + 256,
          Math.max(stageHeight, 512),
          "road_ribbon_b"
        ).setDepth(-24).setAlpha(0.38);
      } else {
        this.roadAccentTile = undefined;
      }
    } else {
      this.roadTile = undefined;
      this.roadAccentTile = undefined;
    }

    // 山门：叙事化远景，不进入装饰物回收池，alpha/scale 由 updateAtmosphere 按时间轴驱动。
    if (this.textures.exists("distant_gate_shadow")) {
      this.gateImage = this.add.image(stageWidth / 2, -46, "distant_gate_shadow")
        .setDepth(-23)
        .setAlpha(0.05)
        .setScale(0.5);
    } else {
      this.gateImage = undefined;
    }

    // 氛围三层之二：雾带（暗角在最后铺，落叶由 JuiceSystem 负责）。雾带按地图染色（白 = 不染）。
    this.fogTile = this.add.tileSprite(
      stageWidth / 2,
      stageHeight / 2,
      stageWidth,
      stageHeight,
      "atmo_fog"
    )
      .setDepth(88)
      .setAlpha(stageVisualConfig.fogAlpha)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    if (map.fogTint !== 0xffffff) {
      this.fogTile.setTint(map.fogTint);
    }
    this.vignetteStatic = this.add.image(stageWidth / 2, stageHeight / 2, "atmo_vignette")
      .setDisplaySize(stageWidth, stageHeight)
      .setDepth(90)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // 昼昏渐变叠加层：仅配置了 dayNightCycle 的地图（枫叶官道）创建；颜色/强度由 updateDayNightCycle 逐帧驱动。
    if (map.dayNightCycle) {
      this.dayNightOverlay = this.add.rectangle(stageWidth / 2, stageHeight / 2, stageWidth, stageHeight, 0xffffff, 0)
        .setDepth(DAY_NIGHT_OVERLAY_DEPTH)
        .setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
      // 立即应用保留的叠加状态：F2 切图往返时重建瞬间不跳变。
      this.applyDayNightOverlay();
    } else {
      this.dayNightOverlay = undefined;
    }

    // 永夜夜色叠加层：仅配置了 nightOverlay 的地图（夜雨破庙）创建；冷蓝 MULTIPLY 常驻，无逐帧驱动。
    if (map.nightOverlay) {
      this.nightOverlay = this.add.rectangle(stageWidth / 2, stageHeight / 2, stageWidth, stageHeight, map.nightOverlay.tint, map.nightOverlay.strength)
        .setDepth(DAY_NIGHT_OVERLAY_DEPTH)
        .setScrollFactor(0)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    } else {
      this.nightOverlay = undefined;
    }
  }

  /**
   * F2 局内切换地图（预览用）：淡出 150ms → 重建地图层 → 淡入 150ms。
   * 只重建地面/路带/山门/雾带/静态暗角/散布/落叶 emitter；敌人/技能/时间/叙事层状态全部保留。
   */
  private cycleStageMapForPreview(): void {
    if (getScreenState(this) !== "game" || this.stageMapSwitching) {
      return;
    }
    const maps = stageMapConfig.maps;
    if (maps.length < 2) {
      return;
    }
    const currentIndex = Math.max(0, maps.findIndex((entry) => entry.id === this.currentMapId));
    const next = maps[(currentIndex + 1) % maps.length];
    this.stageMapSwitching = true;
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.currentMapId = next.id;
      this.rebuildStageMapLayers();
      console.debug(`[StageMap] 当前地图：${next.displayName} (${next.id})`);
      camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.stageMapSwitching = false;
      });
      camera.fadeIn(150, 0, 0, 0);
    });
    camera.fadeOut(150, 0, 0, 0);
  }

  /** 销毁并重建地图相关层（不触碰叙事压暗/动态暗角/重击聚焦/HUD，Boss 战氛围状态不丢）。 */
  private rebuildStageMapLayers(): void {
    this.groundTile?.destroy();
    this.groundTile = undefined;
    this.roadTile?.destroy();
    this.roadTile = undefined;
    this.roadAccentTile?.destroy();
    this.roadAccentTile = undefined;
    this.gateImage?.destroy();
    this.gateImage = undefined;
    this.fogTile?.destroy();
    this.fogTile = undefined;
    this.vignetteStatic?.destroy();
    this.vignetteStatic = undefined;
    this.fogBandTile?.destroy();
    this.fogBandTile = undefined;
    // 昼昏渐变叠加层随地图层同步重建（新地图未配置时 buildStageMapLayers 不再创建）。
    this.dayNightOverlay?.destroy();
    this.dayNightOverlay = undefined;
    // 永夜夜色叠加层同样随地图层重建。
    this.nightOverlay?.destroy();
    this.nightOverlay = undefined;
    for (const prop of this.scatterProps.values()) {
      prop.image.destroy();
      prop.glow?.image.destroy();
    }
    this.scatterProps.clear();
    // 落叶 emitter 销毁重建：起风时按新地图 tint 组重新创建。
    this.leafEmitter?.destroy();
    this.leafEmitter = undefined;

    const map = this.getCurrentStageMap();
    this.buildStageMapLayers(map);
    // 附加雾带随地图重建（雾天目标透明度由下面的 setWeather 重新补间）。
    this.createFogBandLayer(map);
    this.refreshPropScatter();
    // 常驻落叶同步换 tint（JuiceSystem 环境层）
    JuiceSystem.get(this).retintAmbient(map.leafTints);
    // 重新同步天气层：雾带透明度补间 + 按当前天气重建天气 emitter（落叶换 tint）。
    this.setWeather(this.weatherKind);
  }

  private ensureAtmosphereTextures(): void {
    if (!this.textures.exists("atmo_vignette")) {
      const vignette = this.textures.createCanvas("atmo_vignette", 128, 128);
      const context = vignette?.getContext();
      if (vignette && context) {
        const gradient = context.createRadialGradient(64, 64, 34, 64, 64, 84);
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.58, "rgba(246, 242, 232, 1)");
        gradient.addColorStop(1, "rgba(64, 54, 38, 1)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
        vignette.refresh();
      }
    }

    if (!this.textures.exists("atmo_fog")) {
      const fog = this.textures.createCanvas("atmo_fog", 256, 256);
      const context = fog?.getContext();
      if (fog && context) {
        context.clearRect(0, 0, 256, 256);
        const random = mulberry32(20260726);
        for (let index = 0; index < 42; index += 1) {
          const x = random() * 256;
          const y = random() * 256;
          const radius = 26 + random() * 64;
          const alpha = 0.05 + random() * 0.09;
          // 3x3 包裹绘制，保证 TileSprite 平铺无明显接缝。
          for (let offsetX = -256; offsetX <= 256; offsetX += 256) {
            for (let offsetY = -256; offsetY <= 256; offsetY += 256) {
              const gradient = context.createRadialGradient(x + offsetX, y + offsetY, 0, x + offsetX, y + offsetY, radius);
              gradient.addColorStop(0, `rgba(232, 238, 226, ${alpha})`);
              gradient.addColorStop(1, "rgba(232, 238, 226, 0)");
              context.fillStyle = gradient;
              context.fillRect(x + offsetX - radius, y + offsetY - radius, radius * 2, radius * 2);
            }
          }
        }
        fog.refresh();
      }
    }
  }

  private refreshPropScatter(): void {
    const slotSize = this.propSlotSizePx;
    const margin = slotSize * 0.75;
    const stageWidth = this.scale.width;
    const stageHeight = this.scale.height;
    const minI = Math.floor((this.stageScrollX - margin) / slotSize);
    const maxI = Math.floor((this.stageScrollX + stageWidth + margin) / slotSize);
    const minJ = Math.floor((this.stageScrollY - margin) / slotSize);
    const maxJ = Math.floor((this.stageScrollY + stageHeight + margin) / slotSize);
    const needed = new Set<string>();
    for (let slotI = minI; slotI <= maxI; slotI += 1) {
      for (let slotJ = minJ; slotJ <= maxJ; slotJ += 1) {
        const key = `${slotI}:${slotJ}`;
        needed.add(key);
        if (!this.scatterProps.has(key)) {
          const prop = this.createScatterProp(slotI, slotJ, slotSize);
          if (prop) {
            this.scatterProps.set(key, prop);
          }
        }
      }
    }

    for (const [key, prop] of this.scatterProps) {
      if (!needed.has(key)) {
        prop.image.destroy();
        prop.glow?.image.destroy();
        this.scatterProps.delete(key);
        continue;
      }
      const screenX = prop.worldX - this.stageScrollX;
      const screenY = prop.worldY - this.stageScrollY;
      prop.image.setPosition(screenX, screenY);
      // 石灯笼光晕跟随：略上移对齐灯焰位置
      prop.glow?.image.setPosition(screenX, screenY - prop.image.displayHeight * 0.18);
    }
  }

  private createScatterProp(
    slotI: number,
    slotJ: number,
    slotSize: number
  ): { image: Phaser.GameObjects.Image; worldX: number; worldY: number; sway?: ScatterPropSway; glow?: LanternGlowMeta } | undefined {
    const random = mulberry32(hashScatterSlot(slotI, slotJ));
    if (random() > stageVisualConfig.propDensity) {
      return undefined;
    }
    const typeRoll = random();
    const pool = this.getCurrentStageMap().scatterPool;
    let textureKey = pool[0]?.key ?? SCATTER_PROP_POOL[0].key;
    let cumulativeWeight = 0;
    for (const entry of pool) {
      cumulativeWeight += entry.weight;
      if (typeRoll < cumulativeWeight) {
        textureKey = entry.key;
        break;
      }
    }
    if (!this.textures.exists(textureKey)) {
      return undefined;
    }
    const base = SCATTER_PROP_BASE[textureKey] ?? { depth: -21, alpha: 0.55, scale: 0.8 };
    const worldX = slotI * slotSize + random() * slotSize;
    const worldY = slotJ * slotSize + random() * slotSize;
    const image = this.add.image(worldX - this.stageScrollX, worldY - this.stageScrollY, textureKey)
      .setDepth(base.depth)
      .setAlpha(base.alpha * (0.85 + random() * 0.3))
      .setScale(base.scale * (0.85 + random() * 0.35))
      .setFlipX(random() >= 0.5);
    // 移动背景：残旗/竹丛/灯笼挂微动画元数据，相位由槽位种子错开。
    let sway: ScatterPropSway | undefined;
    if (this.getVfxDensityScale() > 0) {
      const phase = random() * Math.PI * 2;
      if (textureKey === "decor_flag" || textureKey === "wood_stake_flag") {
        sway = { kind: "flag", phase, baseRotation: 0, baseScaleY: image.scaleY };
      } else if (textureKey === "bamboo_edge_cluster" || textureKey === "maple_tree_cluster") {
        sway = { kind: "bamboo", phase, baseRotation: 0, baseScaleY: image.scaleY };
      } else if (textureKey === "decor_lantern") {
        sway = { kind: "lantern", phase, baseRotation: 0, baseScaleY: image.scaleY };
      }
    }
    // 夜雨破庙·石灯笼假光晕：ADD 混合径向暖光 sprite 挂在灯笼上，alpha 0.35 呼吸（相位随槽位种子错开）。
    let glow: LanternGlowMeta | undefined;
    if (textureKey === "decor_stone_lantern") {
      this.ensureLanternGlowTexture();
      if (this.textures.exists(LANTERN_GLOW_TEXTURE_KEY)) {
        const glowImage = this.add.image(image.x, image.y - image.displayHeight * 0.18, LANTERN_GLOW_TEXTURE_KEY)
          .setDepth(base.depth + 0.5)
          .setAlpha(LANTERN_GLOW_BASE_ALPHA)
          .setScale(image.scaleX * 1.5)
          .setTint(LANTERN_GLOW_TINT)
          .setBlendMode(Phaser.BlendModes.ADD);
        glow = { image: glowImage, phase: random() * Math.PI * 2, baseAlpha: LANTERN_GLOW_BASE_ALPHA };
      }
    }
    return { image, worldX, worldY, sway, glow };
  }

  private updateAtmosphere(deltaMs: number): void {
    const driftSeconds = this.elapsedMs / 1000;
    if (this.fogTile) {
      this.fogTile.tilePositionX = this.stageScrollX * stageVisualConfig.fogDriftFactor + driftSeconds * 7;
      this.fogTile.tilePositionY = this.stageScrollY * stageVisualConfig.fogDriftFactor + driftSeconds * 4;
    }

    // 雾天气附加雾带：反向慢漂，透明度由 setWeather 补间驱动。
    if (this.fogBandTile) {
      this.fogBandTile.tilePositionX = this.stageScrollX * stageVisualConfig.fogDriftFactor * 0.6 - driftSeconds * 11;
      this.fogBandTile.tilePositionY = this.stageScrollY * stageVisualConfig.fogDriftFactor * 0.5 + driftSeconds * 3;
    }

    if (this.gateImage) {
      const focus = Phaser.Math.Clamp(this.elapsedMs / (stageVisualConfig.gateFocusSeconds * 1000), 0, 1);
      const eased = focus * focus * (3 - 2 * focus);
      this.gateImage.setAlpha(0.05 + 0.47 * eased);
      this.gateImage.setScale(0.5 + 0.55 * eased);
    }

    // 风力摆动幅度向目标缓动（天气切换时平滑过渡）。
    this.windSway += (this.windSwayTarget - this.windSway) * Math.min(1, deltaMs / 900);

    this.updateWeatherTimeline();
    this.updateDayNightCycle(deltaMs);
    this.updatePropSway();
    this.updateWeatherRipples();
  }

  // ── 竹雨听风①：天气系统 ──────────────────────────────────────────────

  /** 按局内时间轴（0-120s 晴 / 120-240s 起风 / 240s+ 微雨 / Boss 前 30s 雪或雾）切换天气；weatherLock 图（夜雨破庙）开局锁定、不轮换。 */
  private updateWeatherTimeline(): void {
    if (!weatherVisualConfig.timelineEnabled) {
      return;
    }
    // 天气锁定：该图恒定锁定天气，不走时间轴轮换、也不吃 Boss 前临战天气覆盖。
    const weatherLock = this.getCurrentStageMap().weatherLock;
    if (weatherLock) {
      if (this.weatherKind !== weatherLock) {
        this.setWeather(weatherLock);
      }
      return;
    }
    const elapsedSeconds = this.getElapsedSeconds();
    let desired: WeatherKind = weatherVisualConfig.timeline[0]?.kind ?? "clear";
    for (const entry of weatherVisualConfig.timeline) {
      if (elapsedSeconds >= entry.fromSeconds) {
        desired = entry.kind;
      }
    }
    const preBossFromSeconds = stageConfig.bossSpawnSeconds - weatherVisualConfig.preBossLeadSeconds;
    if (elapsedSeconds >= preBossFromSeconds) {
      desired = weatherVisualConfig.preBossKind;
    }
    if (desired !== this.weatherKind) {
      this.setWeather(desired);
    }
  }

  private setWeather(kind: WeatherKind): void {
    this.weatherKind = kind;
    this.windSwayTarget = weatherVisualConfig.windSwayByKind[kind] ?? 1;
    const density = this.getVfxDensityScale();

    this.leafEmitter?.stop();
    this.rainNearEmitter?.stop();
    this.rainFarEmitter?.stop();
    this.snowEmitter?.stop();

    if (density > 0) {
      if (kind === "breeze") {
        this.activateBreezeLeaves(density);
      } else if (kind === "rain") {
        this.activateRain(density);
      } else if (kind === "snow") {
        this.activateSnow(density);
      }
    }

    // 雾天气：主雾带加浓 + 附加雾带淡入；离开时回落（VFX 全关时不加浓）。
    const foggy = kind === "fog" && density > 0;
    if (this.fogTile) {
      this.tweens.killTweensOf(this.fogTile);
      this.tweens.add({
        targets: this.fogTile,
        alpha: foggy ? weatherVisualConfig.foggyFogAlpha : stageVisualConfig.fogAlpha,
        duration: 1600,
        ease: "Sine.easeInOut"
      });
    }
    if (this.fogBandTile) {
      this.tweens.killTweensOf(this.fogBandTile);
      this.tweens.add({
        targets: this.fogBandTile,
        alpha: foggy ? weatherVisualConfig.fogBandAlpha : 0,
        duration: 1600,
        ease: "Sine.easeInOut"
      });
    }

    this.nextRippleAtMs = kind === "rain"
      ? this.elapsedMs + this.rollRippleInterval()
      : 0;
  }

  /** 起风：在 JuiceSystem 常驻落叶之上叠加一层加密落叶（风向左斜），tint 组随当前地图。 */
  private activateBreezeLeaves(density: number): void {
    if (!this.leafEmitter) {
      const textureKey = this.textures.exists("juice_leaf") ? "juice_leaf" : "weather_leaf";
      this.leafEmitter = this.add.particles(0, -12, textureKey, {
        x: { min: -20, max: this.scale.width + 60 },
        lifespan: 8000,
        speedY: { min: 18, max: 42 },
        speedX: { min: -46, max: -12 },
        rotate: { min: 0, max: 360 },
        quantity: 1,
        frequency: weatherVisualConfig.breezeLeafFrequencyMs,
        scale: { min: 0.7, max: 1.4 },
        alpha: { min: 0.35, max: 0.75 },
        tint: [...this.getCurrentStageMap().leafTints],
        blendMode: Phaser.BlendModes.NORMAL
      });
      this.leafEmitter.setScrollFactor(0);
      this.leafEmitter.setDepth(-15);
    }
    this.leafEmitter.setFrequency(Math.round(weatherVisualConfig.breezeLeafFrequencyMs / density), 1);
    this.leafEmitter.start();
  }

  /** 微雨：斜向雨丝近/远两层（近层大稀、远层小密），地面涟漪由 updateWeatherRipples 驱动。 */
  private activateRain(density: number): void {
    const stageWidth = this.scale.width;
    if (!this.rainFarEmitter) {
      this.rainFarEmitter = this.add.particles(0, -24, "weather_rain", {
        x: { min: -60, max: stageWidth + 140 },
        lifespan: 1150,
        speedY: { min: 430, max: 560 },
        speedX: { min: -120, max: -80 },
        rotate: { min: -15, max: -11 },
        quantity: 2,
        frequency: weatherVisualConfig.rainFarFrequencyMs,
        scale: { min: 0.45, max: 0.7 },
        alpha: { min: 0.16, max: 0.28 },
        tint: [0x9fb8c4, 0x8aa8b4],
        blendMode: Phaser.BlendModes.NORMAL
      });
      this.rainFarEmitter.setScrollFactor(0);
      this.rainFarEmitter.setDepth(86);
    }
    if (!this.rainNearEmitter) {
      this.rainNearEmitter = this.add.particles(0, -24, "weather_rain", {
        x: { min: -60, max: stageWidth + 140 },
        lifespan: 950,
        speedY: { min: 620, max: 780 },
        speedX: { min: -190, max: -130 },
        rotate: { min: -15, max: -11 },
        quantity: 2,
        frequency: weatherVisualConfig.rainNearFrequencyMs,
        scale: { min: 0.9, max: 1.3 },
        alpha: { min: 0.32, max: 0.5 },
        tint: [0xbfd4d8, 0x9fb8c4],
        blendMode: Phaser.BlendModes.NORMAL
      });
      this.rainNearEmitter.setScrollFactor(0);
      this.rainNearEmitter.setDepth(89);
    }
    this.rainFarEmitter.setFrequency(Math.round(weatherVisualConfig.rainFarFrequencyMs / density), 2);
    this.rainNearEmitter.setFrequency(Math.round(weatherVisualConfig.rainNearFrequencyMs / density), 2);
    this.rainFarEmitter.start();
    this.rainNearEmitter.start();
  }

  /** 雪：慢速雪花 + 风力漂移（横向速度随机分布，部分回卷）。 */
  private activateSnow(density: number): void {
    if (!this.snowEmitter) {
      this.snowEmitter = this.add.particles(0, -16, "weather_snow", {
        x: { min: -30, max: this.scale.width + 30 },
        lifespan: 9500,
        speedY: { min: 26, max: 54 },
        speedX: { min: -16, max: 10 },
        rotate: { min: 0, max: 360 },
        quantity: 1,
        frequency: weatherVisualConfig.snowFrequencyMs,
        scale: { min: 0.5, max: 1.15 },
        alpha: { min: 0.55, max: 0.9 },
        blendMode: Phaser.BlendModes.NORMAL
      });
      this.snowEmitter.setScrollFactor(0);
      this.snowEmitter.setDepth(89);
    }
    this.snowEmitter.setFrequency(Math.round(weatherVisualConfig.snowFrequencyMs / density), 1);
    this.snowEmitter.start();
  }

  /** 雨天偶发地面涟漪：随机位置细环扩散淡出。 */
  private updateWeatherRipples(): void {
    if (this.weatherKind !== "rain" || this.nextRippleAtMs <= 0 || this.elapsedMs < this.nextRippleAtMs) {
      return;
    }
    this.nextRippleAtMs = this.elapsedMs + this.rollRippleInterval();
    if (this.getVfxDensityScale() <= 0) {
      return;
    }
    const stageWidth = this.scale.width;
    const stageHeight = this.scale.height;
    const rippleCount = Math.random() < 0.35 ? 2 : 1;
    for (let index = 0; index < rippleCount; index += 1) {
      const x = 40 + Math.random() * (stageWidth - 80);
      const y = stageHeight * 0.35 + Math.random() * stageHeight * 0.58;
      const ripple = this.add.ellipse(x, y, 12, 5, 0xffffff, 0)
        .setStrokeStyle(1, 0xcfe4e2, 0.55)
        .setDepth(2);
      this.tweens.add({
        targets: ripple,
        scaleX: 5.2,
        scaleY: 5.2,
        alpha: 0,
        duration: 640,
        ease: "Cubic.easeOut",
        onComplete: () => ripple.destroy()
      });
    }
  }

  private rollRippleInterval(): number {
    const { min, max } = weatherVisualConfig.rippleIntervalMs;
    return min + Math.random() * Math.max(0, max - min);
  }

  // ── 竹雨听风③：移动背景（装饰物微动画） ──────────────────────────────

  /** 残旗 rotation ±2° 呼吸、竹丛 scaleY 微摆（错相位）、灯笼轻晃；幅度随风力（天气）缩放。石灯笼光晕呼吸独立常驻。 */
  private updatePropSway(): void {
    const timeSeconds = this.elapsedMs / 1000;
    // 石灯笼光晕呼吸：alpha 围绕 0.35 正弦起伏（相位随槽位错开），与风力摆动解耦、永夜常驻。
    for (const prop of this.scatterProps.values()) {
      const glow = prop.glow;
      if (glow) {
        glow.image.setAlpha(glow.baseAlpha + Math.sin((this.elapsedMs / LANTERN_GLOW_BREATH_PERIOD_MS) * Math.PI * 2 + glow.phase) * LANTERN_GLOW_BREATH_AMOUNT);
      }
    }
    if (this.windSway <= 0.01) {
      return;
    }
    const sway = this.windSway;
    for (const prop of this.scatterProps.values()) {
      const meta = prop.sway;
      if (!meta) {
        continue;
      }
      if (meta.kind === "flag") {
        prop.image.setRotation(meta.baseRotation + Math.sin(timeSeconds * 1.6 + meta.phase) * 0.035 * sway);
      } else if (meta.kind === "bamboo") {
        prop.image.scaleY = meta.baseScaleY * (1 + Math.sin(timeSeconds * 1.15 + meta.phase) * 0.028 * sway);
      } else {
        prop.image.setRotation(meta.baseRotation + Math.sin(timeSeconds * 1.3 + meta.phase) * 0.045 * sway);
      }
    }
  }

  // ── 枫叶官道·昼昏渐变（白天 → 黄昏 → 入夜，全屏 MULTIPLY 低 alpha 叠加） ──

  /**
   * 每帧驱动：按局内时间（与天气时间轴同一计时源 elapsedMs）在相邻档间线性插值目标色/强度，
   * 再向目标做帧率无关的指数缓动，切档/切图/F5 解锁均无跳变；末档（360s Boss 期）之后恒定保持。
   */
  private updateDayNightCycle(deltaMs: number): void {
    const overlay = this.dayNightOverlay;
    const cycle = this.getCurrentStageMap().dayNightCycle;
    if (!overlay || !cycle || cycle.tints.length === 0) {
      return;
    }
    const target = this.dayNightDebugPinned
      ? this.getDayNightPinnedTarget(cycle.tints)
      : this.sampleDayNightTarget(cycle.tints, this.elapsedMs / 1000);
    const k = 1 - Math.exp(-deltaMs / DAY_NIGHT_SMOOTH_MS);
    const current = this.dayNightCurrent;
    current.r += (target.r - current.r) * k;
    current.g += (target.g - current.g) * k;
    current.b += (target.b - current.b) * k;
    current.strength += (target.strength - current.strength) * k;
    this.applyDayNightOverlay();
  }

  /** 时间轴采样：elapsedSeconds 落在相邻档间时线性插值；早于首档取首档、晚于末档守末档。 */
  private sampleDayNightTarget(tints: DayNightTintTier[], elapsedSeconds: number): { r: number; g: number; b: number; strength: number } {
    let prev = tints[0];
    let next: DayNightTintTier | undefined;
    for (const tier of tints) {
      if (elapsedSeconds >= tier.at) {
        prev = tier;
      } else {
        next = tier;
        break;
      }
    }
    const from = dayNightTierChannels(prev);
    if (!next || next.at <= prev.at) {
      return from;
    }
    const to = dayNightTierChannels(next);
    const f = Phaser.Math.Clamp((elapsedSeconds - prev.at) / (next.at - prev.at), 0, 1);
    return {
      r: from.r + (to.r - from.r) * f,
      g: from.g + (to.g - from.g) * f,
      b: from.b + (to.b - from.b) * f,
      strength: from.strength + (to.strength - from.strength) * f
    };
  }

  /** F5 锁定档：取 at <= 330s 的最后一档（当前配置即 330s 暮赭红），防御配置改档后找不到精确秒数。 */
  private getDayNightPinnedTarget(tints: DayNightTintTier[]): { r: number; g: number; b: number; strength: number } {
    let pinned = tints[0];
    for (const tier of tints) {
      if (tier.at <= DAY_NIGHT_DEBUG_PIN_SECONDS) {
        pinned = tier;
      } else {
        break;
      }
    }
    return dayNightTierChannels(pinned);
  }

  /** 把 dayNightCurrent 写入叠加层（MULTIPLY 颜色 + alpha 强度）；强度近零时隐藏，省一次全屏混合。 */
  private applyDayNightOverlay(): void {
    const overlay = this.dayNightOverlay;
    if (!overlay) {
      return;
    }
    const { r, g, b, strength } = this.dayNightCurrent;
    const clamped = Phaser.Math.Clamp(strength, 0, 1);
    overlay.setFillStyle(Phaser.Display.Color.GetColor(Math.round(r), Math.round(g), Math.round(b)), clamped);
    overlay.setVisible(clamped > 0.002);
  }

  /** F5（DEV）：锁定昼昏渐变到 330s 暮赭红档立即预览；再按解除，缓动回正常时间轴。 */
  private toggleDayNightDebugPin(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    const cycle = this.getCurrentStageMap().dayNightCycle;
    if (!cycle) {
      console.debug("[DayNight] 当前地图未配置昼昏渐变（仅枫叶官道启用），请按 F2 切图后再试。");
      return;
    }
    this.dayNightDebugPinned = !this.dayNightDebugPinned;
    if (this.dayNightDebugPinned) {
      // 直接跳到目标档（不经缓动），立即呈现暮赭红。
      this.dayNightCurrent = this.getDayNightPinnedTarget(cycle.tints);
      this.applyDayNightOverlay();
    }
    console.debug(`[DayNight] F5 预览：${this.dayNightDebugPinned ? `锁定 ${DAY_NIGHT_DEBUG_PIN_SECONDS}s 暮赭红档` : "解除锁定，回到时间轴"}`);
  }

  // ── 竹雨听风②：色温叙事（精英预警/Boss 出场压暗 + 泛朱砂） ────────────

  private setEliteNarrativeAlert(active: boolean, warningSeconds?: number): void {
    this.eliteTintFallback?.remove();
    this.eliteTintFallback = undefined;
    this.eliteTintActive = active;
    if (active) {
      // 兜底：预警 + 保持时长后自动回落，避免漏听结束事件导致色调残留。
      const holdMs = ((warningSeconds ?? 2) + narrativeTintConfig.eliteHoldSeconds) * 1000;
      this.eliteTintFallback = this.time.delayedCall(holdMs, () => {
        this.eliteTintFallback = undefined;
        this.eliteTintActive = false;
        this.refreshNarrativeAlert();
      });
    }
    this.refreshNarrativeAlert();
  }

  /** 精英与 Boss 任一激活即进入叙事色调；800ms 进入、事件结束 1.2s 回落。 */
  private refreshNarrativeAlert(): void {
    const active = (this.eliteTintActive || this.bossTintActive) && this.getVfxDensityScale() > 0;
    if (active === this.narrativeAlertOn) {
      return;
    }
    this.narrativeAlertOn = active;
    const dim = this.narrativeDim;
    const tint = this.narrativeTint;
    if (!dim || !tint) {
      return;
    }
    this.tweens.killTweensOf(dim);
    this.tweens.killTweensOf(tint);
    const duration = active ? narrativeTintConfig.fadeInMs : narrativeTintConfig.fadeOutMs;
    this.tweens.add({
      targets: dim,
      alpha: active ? narrativeTintConfig.dimAlpha : 0,
      duration,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: tint,
      alpha: active ? narrativeTintConfig.tintAlpha : 0,
      duration,
      ease: "Sine.easeInOut"
    });
  }

  // ── 竹雨听风④：动态暗角（低血收紧 20% / Boss 战收紧 15%） ─────────────

  private refreshVignetteDynamics(): void {
    const health = this.getHealthSnapshot();
    const boss = this.getBossSnapshot();
    const bossActive = boss.state !== "pending" && boss.state !== "cleared" && boss.state !== "dead";
    let tighten = 0;
    if (this.getVfxDensityScale() > 0) {
      if (health.isLowHp) {
        tighten = Math.max(tighten, vignetteDynamicsConfig.lowHpTighten);
      }
      if (bossActive) {
        tighten = Math.max(tighten, vignetteDynamicsConfig.bossTighten);
      }
    }
    if (!this.vignetteDynamic || Math.abs(tighten - this.vignetteTighten) < 0.001) {
      return;
    }
    this.vignetteTighten = tighten;
    // 动态层按 1.3 倍屏幕铺设，scale 收紧到 1/(1+t) 时仍满幅覆盖，暗角边界向中心收拢。
    const targetScale = 1 / (1 + tighten);
    const targetAlpha = tighten <= 0
      ? 0
      : vignetteDynamicsConfig.maxAlpha * Phaser.Math.Clamp(tighten / vignetteDynamicsConfig.lowHpTighten, 0, 1);
    this.tweens.killTweensOf(this.vignetteDynamic);
    this.tweens.add({
      targets: this.vignetteDynamic,
      alpha: targetAlpha,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: tighten > 0 ? vignetteDynamicsConfig.tweenMs : vignetteDynamicsConfig.releaseMs,
      ease: "Sine.easeInOut"
    });
  }

  // ── 竹雨听风⑤：重击屏幕压暗聚焦 ──────────────────────────────────────

  /** 单次掉血超过上限 20% 时全屏压暗 150ms（黑矩形 alpha 0.25 闪）。 */
  private showHeavyHitFocus(): void {
    if (!this.hitFocusOverlay || this.getVfxDensityScale() <= 0) {
      return;
    }
    this.tweens.killTweensOf(this.hitFocusOverlay);
    this.hitFocusOverlay.setAlpha(heavyHitFocusConfig.alpha);
    this.tweens.add({
      targets: this.hitFocusOverlay,
      alpha: 0,
      duration: heavyHitFocusConfig.durationMs,
      ease: "Quad.easeOut"
    });
  }

  // ── 天气/叙事共享：纹理、屏幕层、设置 ────────────────────────────────

  /** 防御性读取 VFX 设置：vfxDensity === "off" 全关；low/现有 lowVfxMode 减半。 */
  private getVfxDensityScale(): number {
    const settings = getSaveData(this).settings as { lowVfxMode?: boolean; vfxDensity?: string } | undefined;
    if (!settings) {
      return 1;
    }
    if (settings.vfxDensity === "off") {
      return 0;
    }
    if (settings.vfxDensity === "low" || settings.lowVfxMode) {
      return 0.5;
    }
    return 1;
  }

  private ensureWeatherTextures(): void {
    if (!this.textures.exists("weather_rain")) {
      const graphics = this.add.graphics();
      graphics.lineStyle(2, 0xffffff, 0.9);
      graphics.lineBetween(2, 1, 2, 17);
      graphics.generateTexture("weather_rain", 4, 18);
      graphics.destroy();
    }
    if (!this.textures.exists("weather_snow")) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0xffffff, 0.9);
      graphics.fillCircle(4, 4, 3);
      graphics.generateTexture("weather_snow", 8, 8);
      graphics.destroy();
    }
    // JuiceSystem 的落叶纹理若尚未生成（本阶段先于其初始化）则自绘兜底。
    if (!this.textures.exists("juice_leaf") && !this.textures.exists("weather_leaf")) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillEllipse(6, 4, 10, 6);
      graphics.generateTexture("weather_leaf", 12, 8);
      graphics.destroy();
    }
  }

  /** 天气/叙事屏幕层：附加雾带、动态暗角、压暗、朱砂、重击聚焦（全部 scrollFactor 0、低于 HUD）。 */
  private setupAtmosphereOverlays(): void {
    const stageWidth = this.scale.width;
    const stageHeight = this.scale.height;

    this.createFogBandLayer(this.getCurrentStageMap());

    this.narrativeDim = this.add.rectangle(stageWidth / 2, stageHeight / 2, stageWidth, stageHeight, 0x050705, 0)
      .setDepth(77)
      .setScrollFactor(0);
    this.narrativeTint = this.add.rectangle(stageWidth / 2, stageHeight / 2, stageWidth, stageHeight, 0x8f1a12, 0)
      .setDepth(78)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.hitFocusOverlay = this.add.rectangle(stageWidth / 2, stageHeight / 2, stageWidth, stageHeight, 0x000000, 0)
      .setDepth(79)
      .setScrollFactor(0);

    this.vignetteDynamic = this.add.image(stageWidth / 2, stageHeight / 2, "atmo_vignette")
      .setDisplaySize(stageWidth * 1.3, stageHeight * 1.3)
      .setDepth(90)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(0);
  }

  /** 雾天气附加滚动雾带（alpha 0 起步，setWeather 补间加浓）；按地图配置染色。 */
  private createFogBandLayer(map: StageMapEntry): void {
    const stageWidth = this.scale.width;
    const stageHeight = this.scale.height;
    this.fogBandTile = this.add.tileSprite(stageWidth / 2, stageHeight / 2, stageWidth, stageHeight, "atmo_fog")
      .setDepth(87)
      .setAlpha(0)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    if (map.fogTint !== 0xffffff) {
      this.fogBandTile.setTint(map.fogTint);
    }
  }

  private setBossDim(active: boolean): void {
    if (active === this.bossDimActive) {
      return;
    }
    this.bossDimActive = active;
    if (!this.bossDimOverlay) {
      this.bossDimOverlay = this.add.rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x000000,
        0
      ).setDepth(76).setScrollFactor(0);
    }
    this.tweens.killTweensOf(this.bossDimOverlay);
    this.tweens.add({
      targets: this.bossDimOverlay,
      alpha: active ? stageVisualConfig.bossDimAlpha : 0,
      duration: active ? 700 : 900,
      ease: "Sine.easeInOut"
    });
  }

  /**
   * Boss 登场墨晕（表现层叠加）：圆墨自中心晕开覆屏后快速收回，与现有压暗/震屏并行。
   * WebGL 专属；Canvas 渲染器下 inkWipeIn 返回 false 静默跳过，异常不阻断 Boss 出场主流程。
   */
  private playBossIntroInkWipe(): void {
    if (!this.scene.isActive()) {
      return;
    }
    try {
      inkWipeIn(this, {
        mode: "center",
        durationMs: 700,
        onComplete: () => {
          inkWipeOut(this, { mode: "center", durationMs: 400 });
        }
      });
    } catch {
      // 墨晕失败静默：Boss 出场主流程（压暗/震屏/血条）不受影响
    }
  }

  // ── 墨染江山（moran_ink_zone）表现层 ─────────────────────────────────
  // 机制（领域伤害/减速/持续判定）归技能系统代理；此处只做：施放墨晕涟漪、进阶演出、图标映射。

  /**
   * 施放瞬间：屏幕边缘墨晕涟漪（复用 InkWipe 快速版，入 250ms / 褪 400ms）。
   * InkWipe 暂无覆盖率参数，按全幅快速处理；控制技能不加相机震动，避免打扰感。
   * WebGL 专属；Canvas 渲染器 inkWipeIn 返回 false 静默跳过，异常不阻断施放主流程。
   */
  /**
   * 「挥毫成阵」局部墨圈：墨痕领域落点处，一笔墨环从起笔到合拢勾勒 350ms，再驻留淡出 300ms。
   * 局部笔墨反馈，不改变全屏亮度（替代原全屏墨晕涟漪，避免久看明暗闪烁疲劳）。
   * 毒化「墨里淬毒」Lv3+：主墨环下垫一缕 0x3fae8a 碧色弧（起笔错开 30°，比主环宽 1px 透出绿韵）；
   * 进阶「金蛊江山」碧弧转金绿 0xa9c04a。level/advanced 防御性读取，缺省按 Lv1 纯墨。
   */
  private playMoranZoneRing(worldX?: number, worldY?: number, radius?: number, level?: number, advanced?: boolean): void {
    if (!this.scene.isActive() || getScreenState(this) !== "game") {
      return;
    }
    if (this.getVfxDensityScale() <= 0) {
      return;
    }
    if (this.elapsedMs < this.moranInkRippleCooldownUntilMs) {
      return;
    }
    this.moranInkRippleCooldownUntilMs = this.elapsedMs + MORAN_INK_RIPPLE_MIN_INTERVAL_MS;
    try {
      const heroWorld = this.getHeroWorldPosition();
      const heroScreen = this.getHeroScreenPosition();
      const centerX = worldX !== undefined ? heroScreen.x + (worldX - heroWorld.x) : heroScreen.x;
      const centerY = worldY !== undefined ? heroScreen.y + (worldY - heroWorld.y) : heroScreen.y;
      const ringRadius = Math.max(48, radius ?? 90);
      const poisonEdge = (typeof level === "number" && Number.isFinite(level) ? level : 1) >= 3;
      const poisonEdgeColor = advanced === true ? 0xa9c04a : 0x3fae8a;
      const ink = this.add.graphics().setDepth(64);
      const state = { t: 0 };
      this.tweens.add({
        targets: state,
        t: 1,
        duration: 350,
        ease: Phaser.Math.Easing.Quadratic.Out,
        onUpdate: () => {
          ink.clear();
          if (poisonEdge) {
            // 碧色弧垫底：5px 比主墨环宽 1px、起笔错开 30°（-60° 起笔），透出墨缘绿韵
            ink.lineStyle(5, poisonEdgeColor, 0.6);
            ink.beginPath();
            ink.arc(centerX, centerY, ringRadius, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(-60 + state.t * 360));
            ink.strokePath();
          }
          // 主墨环：从 -90° 起笔扫到当前进度
          ink.lineStyle(4, 0x1a1f1a, 0.85);
          ink.beginPath();
          ink.arc(centerX, centerY, ringRadius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + state.t * 360));
          ink.strokePath();
          // 内圈淡金墨意（进阶感，极浅）
          ink.lineStyle(2, 0xa99a20, 0.25);
          ink.beginPath();
          ink.arc(centerX, centerY, ringRadius * 0.82, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + state.t * 360));
          ink.strokePath();
        },
        onComplete: () => {
          this.tweens.add({
            targets: ink,
            alpha: 0,
            duration: 300,
            delay: 250,
            onComplete: () => ink.destroy()
          });
        }
      });
    } catch {
      // 表现失败静默：技能施放主流程不受影响
    }
  }

  /**
   * 进阶/进化演出：hitStop(100) + 英雄脚下圆形墨晕扩散（Graphics 墨圈 alpha 扩散 500ms）
   * + JuiceSystem.goldBurst；技能槽图标/金框由 updateSkillSlots 走现有进阶槽样式自动刷新。
   * 事件与快照双通道触发，用去重窗口防止演出叠加。
   */
  private playMoranAdvancePerformance(): void {
    if (!this.scene.isActive() || getScreenState(this) !== "game") {
      // 顿悟场景中选择进阶时本场景处于暂停态：跳过即时演出，
      // 由 resume 后 updateMoranPresentation 的快照跳变通道补播。
      return;
    }
    if (this.elapsedMs - this.lastMoranAdvanceFxAtMs < MORAN_ADVANCE_FX_DEDUP_MS) {
      return;
    }
    this.lastMoranAdvanceFxAtMs = this.elapsedMs;

    const juice = JuiceSystem.get(this);
    juice.hitStop(100);
    const { x, y } = this.getHeroScreenPosition();
    const footY = y + 20;
    // 墨圈：近黑墨底 + 墨青描边，alpha 扩散淡出（低 VFX 设置下仅保留金屑）。
    if (this.getVfxDensityScale() > 0) {
      const inkRing = this.add.circle(x, footY, 28, 0x0a0f0c, 0.34)
        .setStrokeStyle(3, 0x39d6b5, 0.62)
        .setDepth(64);
      this.tweens.add({
        targets: inkRing,
        scale: 4.4,
        alpha: 0,
        duration: 500,
        ease: "Cubic.easeOut",
        onComplete: () => inkRing.destroy()
      });
    }
    juice.goldBurst(x, footY - 8, 24);
    this.latestSkillSnapshot = this.skillSystem?.getSnapshot();
    this.updateSkillSlots();
  }

  /**
   * 每帧兜底通道（防御并行代理实现差异）：
   * ① 施放 —— 若从未收到 moran 的 skill_cast 事件，按冷却循环节奏补墨晕涟漪；
   * ② 进阶 —— 快照 advanced 跳变（覆盖事件丢失 / 暂停中进阶 / Lv5 直达进阶等路径）。
   */
  private updateMoranPresentation(): void {
    const slots = this.latestSkillSnapshot?.skillSlots ?? [];
    const moranSlot = slots.find((slot) => String(slot.skillId).includes(MORAN_SKILL_ID_KEY));
    if (!moranSlot) {
      this.moranKnownUnlocked = false;
      this.moranAdvanceFxPrev = false;
      return;
    }

    if (!this.moranKnownUnlocked) {
      this.moranKnownUnlocked = true;
    }

    if (moranSlot.advanced && !this.moranAdvanceFxPrev) {
      this.playMoranAdvancePerformance();
    }
    this.moranAdvanceFxPrev = moranSlot.advanced;
  }

  /** F4 调试：直接授予 moran_ink_zone Lv1（防御性调用 SkillSystem 现有授予 API），并放 showcase 木桩便于验证领域效果。 */
  private grantMoranSkillForDebug(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    const granter = this.skillSystem as unknown as {
      unlockSkill?: (skillId: string, level?: number) => boolean;
      setSkillLevel?: (skillId: string, level: number) => boolean;
    } | undefined;
    const unlocked = granter?.unlockSkill?.(MORAN_SKILL_ID, 1) ?? false;
    if (!unlocked) {
      // 已解锁或 id 未注册（技能代理尚未合入）时静默；setSkillLevel 兜底尝试一次
      granter?.setSkillLevel?.(MORAN_SKILL_ID, 1);
    }
    this.latestSkillSnapshot = this.skillSystem?.getSnapshot();
    this.updateSkillSlots();
    this.spawnEnemyShowcaseForDebug();
  }

  /** 石灯笼假光晕纹理：程序化径向渐变白心圆（tint 染暖色后 ADD 混合），按 key 缓存只生成一次。 */
  private ensureLanternGlowTexture(): void {
    if (this.textures.exists(LANTERN_GLOW_TEXTURE_KEY)) {
      return;
    }
    const canvasTexture = this.textures.createCanvas(LANTERN_GLOW_TEXTURE_KEY, LANTERN_GLOW_TEXTURE_SIZE, LANTERN_GLOW_TEXTURE_SIZE);
    const context = canvasTexture?.getContext();
    if (!canvasTexture || !context) {
      return;
    }
    context.clearRect(0, 0, LANTERN_GLOW_TEXTURE_SIZE, LANTERN_GLOW_TEXTURE_SIZE);
    const half = LANTERN_GLOW_TEXTURE_SIZE / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.45)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, LANTERN_GLOW_TEXTURE_SIZE, LANTERN_GLOW_TEXTURE_SIZE);
    canvasTexture.refresh();
  }

  /** 主角脚下软椭圆接触阴影：程序化径向渐变墨黑椭圆纹理，按 key 缓存只生成一次。 */
  private ensureHeroShadowTexture(): void {
    if (this.textures.exists(HERO_SHADOW_TEXTURE_KEY)) {
      return;
    }
    // 纹理直接按最终尺寸 56×20 生成，updateHeroView 的移动拉伸 setScale 才无需换算。
    const canvasTexture = this.textures.createCanvas(HERO_SHADOW_TEXTURE_KEY, HERO_SHADOW_WIDTH, HERO_SHADOW_HEIGHT);
    const context = canvasTexture?.getContext();
    if (!canvasTexture || !context) {
      return;
    }
    context.clearRect(0, 0, HERO_SHADOW_WIDTH, HERO_SHADOW_HEIGHT);
    context.save();
    context.translate(HERO_SHADOW_WIDTH / 2, HERO_SHADOW_HEIGHT / 2);
    context.scale(1, HERO_SHADOW_HEIGHT / HERO_SHADOW_WIDTH);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, HERO_SHADOW_WIDTH / 2);
    gradient.addColorStop(0, "rgba(5, 7, 5, 0.95)");
    gradient.addColorStop(0.55, "rgba(5, 7, 5, 0.5)");
    gradient.addColorStop(1, "rgba(5, 7, 5, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, HERO_SHADOW_WIDTH / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    canvasTexture.refresh();
  }

  private drawHero(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.getHeroScreenY();
    this.heroTiltRad = 0;
    this.ensureHeroShadowTexture();
    this.heroShadow = this.add.image(centerX, centerY + 24, HERO_SHADOW_TEXTURE_KEY)
      .setAlpha(HERO_SHADOW_ALPHA)
      .setDepth(HERO_SHADOW_DEPTH);

    if (this.textures.exists("hero_shaoxia_idle")) {
      const heroSprite = this.add.sprite(centerX, centerY, "hero_shaoxia_idle")
        .setDepth(10)
        .setOrigin(0.5, 0.6)
        // 素材 2 倍高清化：hero 帧尺寸 ×2（128→256），缩放系数 ÷2（0.66→0.33）保持屏幕显示尺寸不变。
        .setScale(0.33);
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
    // 采样基础 scaleY（2 倍素材后 sprite 约 0.33 / 占位容器 1），待机呼吸以此乘法叠加。
    this.heroBaseScaleY = this.heroView.scaleY;

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
    const stageWidth = this.scale.width;
    const stripCenterY = HUD_STRIP_HEIGHT / 2;

    // ── 顶部横带：ui_hud_top_strip，缺失时退化为半透明墨底矩形 + 底线 ──
    if (this.textures.exists("ui_hud_top_strip")) {
      this.add.image(stageWidth / 2, stripCenterY, "ui_hud_top_strip")
        .setDisplaySize(stageWidth, HUD_STRIP_HEIGHT)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH_STRIP);
    } else {
      this.add.rectangle(stageWidth / 2, stripCenterY, stageWidth, HUD_STRIP_HEIGHT, 0x0e1a15, 0.92)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH_STRIP);
      this.add.rectangle(stageWidth / 2, HUD_STRIP_HEIGHT - 1, stageWidth, 2, PALETTE.legacyGold, 0.66)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH_STRIP);
    }

    // ── 左区：等级徽章 + 生命条 ──
    if (this.textures.exists("ui_hud_emblem_frame")) {
      this.add.image(HUD_EMBLEM_X, stripCenterY, "ui_hud_emblem_frame")
        .setDisplaySize(HUD_EMBLEM_SIZE, HUD_EMBLEM_SIZE)
        .setDepth(HUD_DEPTH_CONTENT);
    } else {
      this.add.circle(HUD_EMBLEM_X, stripCenterY, HUD_EMBLEM_SIZE / 2, 0x101c16, 0.92)
        .setStrokeStyle(2, PALETTE.legacyGold, 0.85)
        .setDepth(HUD_DEPTH_CONTENT);
    }
    this.hudLevelText = this.add.text(HUD_EMBLEM_X, stripCenterY, "1", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_MONO,
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#101010",
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(HUD_DEPTH_TEXT).setResolution(2);

    this.add.text(HUD_HEALTH_BAR_X, HUD_LABEL_Y, "生命", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "11px"
    }).setOrigin(0, 0.5).setDepth(HUD_DEPTH_CONTENT).setResolution(2);
    const healthBarCenterX = HUD_HEALTH_BAR_X + HUD_HEALTH_BAR_WIDTH / 2;
    this.hudHealthGlow = this.add.rectangle(
      healthBarCenterX, HUD_HEALTH_BAR_Y,
      HUD_HEALTH_BAR_WIDTH + 6, HUD_HEALTH_BAR_HEIGHT + 6,
      PALETTE.lowHp, 0
    ).setDepth(HUD_DEPTH_CONTENT);
    this.add.rectangle(healthBarCenterX, HUD_HEALTH_BAR_Y, HUD_HEALTH_BAR_WIDTH, HUD_HEALTH_BAR_HEIGHT, 0x070807, 0.88)
      .setDepth(HUD_DEPTH_CONTENT);
    this.hudHealthFill = this.add.rectangle(
      HUD_HEALTH_BAR_X + 1, HUD_HEALTH_BAR_Y,
      HUD_HEALTH_BAR_WIDTH - 2, HUD_HEALTH_BAR_HEIGHT - 2,
      PALETTE.hp, 0.95
    ).setOrigin(0, 0.5).setDepth(HUD_DEPTH_TEXT);
    this.add.rectangle(healthBarCenterX, HUD_HEALTH_BAR_Y, HUD_HEALTH_BAR_WIDTH + 2, HUD_HEALTH_BAR_HEIGHT + 2)
      .setFillStyle(0x000000, 0)
      .setStrokeStyle(1, PALETTE.legacyGold, 0.82)
      .setDepth(HUD_DEPTH_TEXT);
    this.hudHealthText = this.add.text(healthBarCenterX, HUD_HEALTH_BAR_Y, "", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_MONO,
      fontSize: "13px",
      fontStyle: "bold",
      stroke: "#101010",
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(HUD_DEPTH_TEXT).setResolution(2);

    // ── 中区：内力分段条 ──
    const innerBarCenterX = HUD_INNER_BAR_X + HUD_INNER_BAR_WIDTH / 2;
    this.innerPowerLabel = this.add.text(HUD_INNER_BAR_X, HUD_LABEL_Y, "内力", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "11px"
    }).setOrigin(0, 0.5).setDepth(HUD_DEPTH_CONTENT).setResolution(2);
    this.innerPowerSlot = this.add.rectangle(innerBarCenterX, HUD_INNER_BAR_Y, HUD_INNER_BAR_WIDTH, HUD_INNER_BAR_HEIGHT, 0x070807, 0.88)
      .setDepth(HUD_DEPTH_CONTENT);
    this.innerPowerFill = this.add.rectangle(
      HUD_INNER_BAR_X + 1, HUD_INNER_BAR_Y,
      0, HUD_INNER_BAR_HEIGHT - 2,
      PALETTE.innerPower, 0.92
    ).setOrigin(0, 0.5).setDepth(HUD_DEPTH_TEXT);
    this.innerPowerTicks = this.add.graphics().setDepth(HUD_DEPTH_TEXT);
    this.innerPowerBorder = this.add.rectangle(innerBarCenterX, HUD_INNER_BAR_Y, HUD_INNER_BAR_WIDTH + 2, HUD_INNER_BAR_HEIGHT + 2)
      .setFillStyle(0x000000, 0)
      .setStrokeStyle(1, PALETTE.legacyGold, 0.82)
      .setDepth(HUD_DEPTH_TEXT);
    this.innerPowerText = this.add.text(HUD_INNER_VALUE_X, HUD_INNER_BAR_Y, "", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_MONO,
      fontSize: "13px",
      fontStyle: "bold",
      stroke: "#101010",
      strokeThickness: 2
    }).setOrigin(0, 0.5).setDepth(HUD_DEPTH_CONTENT).setResolution(2);

    // ── 右区：时间 / 击杀 / 暂停按钮 ──
    this.add.text(HUD_TIME_X, HUD_LABEL_Y, "时间", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "11px"
    }).setOrigin(0, 0.5).setDepth(HUD_DEPTH_CONTENT).setResolution(2);
    this.hudTimeText = this.add.text(HUD_TIME_X, HUD_VALUE_Y, "0:00", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_MONO,
      fontSize: "16px",
      fontStyle: "bold",
      stroke: "#101010",
      strokeThickness: 2
    }).setOrigin(0, 0.5).setDepth(HUD_DEPTH_CONTENT).setResolution(2);
    this.add.text(HUD_KILLS_X, HUD_LABEL_Y, "击杀", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "11px"
    }).setOrigin(0, 0.5).setDepth(HUD_DEPTH_CONTENT).setResolution(2);
    this.hudKillsText = this.add.text(HUD_KILLS_X, HUD_VALUE_Y, "0", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_MONO,
      fontSize: "16px",
      fontStyle: "bold",
      stroke: "#101010",
      strokeThickness: 2
    }).setOrigin(0, 0.5).setDepth(HUD_DEPTH_CONTENT).setResolution(2);
    createHudPauseButton(this, stageWidth - 36, stripCenterY, () => this.openPause());

    this.drawSkillSlots();
    this.drawBossHud();
    this.screenDamageEdges = createDamageEdgeFlash(this);
    this.updateHud();
  }

  private updateHud(): void {
    const health = this.getHealthSnapshot();
    const healthFillWidth = Math.round((HUD_HEALTH_BAR_WIDTH - 2) * Phaser.Math.Clamp(health.hpRatio, 0, 1));
    this.hudHealthFill?.setDisplaySize(healthFillWidth, HUD_HEALTH_BAR_HEIGHT - 2);
    this.hudHealthFill?.setFillStyle(health.isLowHp ? PALETTE.lowHp : PALETTE.hp, 1);
    this.hudHealthGlow?.setAlpha(health.isLowHp ? 0.28 + Math.sin(this.elapsedMs / 90) * 0.1 : 0);
    this.hudHealthText?.setColor(health.isLowHp ? PALETTE.lowHpCss : PALETTE.textPrimary);
    this.hudHealthText?.setText(`${health.hp}/${health.maxHp}`);
    this.hudLevelText?.setText(`${this.heroLevel}`);

    const progression = this.getProgressionSnapshot();
    this.innerPowerFill?.setDisplaySize(
      Math.round((HUD_INNER_BAR_WIDTH - 2) * Phaser.Math.Clamp(progression.innerPowerRatio, 0, 1)),
      HUD_INNER_BAR_HEIGHT - 2
    );
    this.innerPowerText?.setText(this.innerPower);
    this.updateInnerPowerTicks(progression.nextRequired);

    this.hudTimeText?.setText(formatSeconds(this.getElapsedSeconds()));
    this.hudKillsText?.setText(`${this.kills}`);
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

  /** 按最大内力画 tick 分隔（段数变化时才重绘，避免每帧 clear） */
  private updateInnerPowerTicks(nextRequired: number): void {
    const segments = Phaser.Math.Clamp(Math.round(nextRequired), 1, 60);
    if (!this.innerPowerTicks || segments === this.innerPowerTickMax) {
      return;
    }
    this.innerPowerTickMax = segments;
    const graphics = this.innerPowerTicks;
    graphics.clear();
    if (segments <= 1) {
      return;
    }
    graphics.lineStyle(1, 0x0a0f0c, 0.72);
    const top = HUD_INNER_BAR_Y - HUD_INNER_BAR_HEIGHT / 2;
    const bottom = HUD_INNER_BAR_Y + HUD_INNER_BAR_HEIGHT / 2;
    for (let index = 1; index < segments; index += 1) {
      const x = HUD_INNER_BAR_X + (HUD_INNER_BAR_WIDTH * index) / segments;
      graphics.lineBetween(x, top, x, bottom);
    }
  }

  private drawBossHud(): void {
    const centerX = this.scale.width / 2;
    const width = BOSS_BAR_WIDTH;
    this.bossHudBack = this.add.rectangle(centerX, BOSS_BAR_Y, width, 18, 0x1d0d0b, 0.9)
      .setStrokeStyle(1, PALETTE.legacyGold, 0.86)
      .setDepth(HUD_DEPTH_STRIP)
      .setVisible(false);
    this.bossHudFill = this.add.rectangle(centerX - width / 2 + 2, BOSS_BAR_Y, width - 4, 12, PALETTE.cinnabar, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH_CONTENT)
      .setVisible(false);
    this.bossHudText = this.add.text(centerX, BOSS_BAR_Y - 1, "", {
      color: "#fff1c7",
      fontFamily: FONT_TITLE,
      fontSize: "14px",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(HUD_DEPTH_TEXT).setVisible(false).setResolution(2);
    this.bossHudText.setStroke("#101010", 4);
    this.bossHudTip = this.add.text(centerX, BOSS_BAR_Y + 22, "", {
      color: PALETTE.accentGoldCss,
      fontFamily: FONT_BODY,
      fontSize: "13px",
      stroke: "#101010",
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(HUD_DEPTH_TEXT).setVisible(false).setResolution(2);
  }

  private updateBossHud(): void {
    const boss = this.getBossSnapshot();
    const visible = boss.state !== "pending" && boss.state !== "cleared";
    this.setBossDim(visible && boss.state !== "dead");
    // 色温叙事：Boss 出场压暗泛朱砂，死亡/清场后 1.2s 回落。
    this.bossTintActive = visible && boss.state !== "dead";
    this.refreshNarrativeAlert();
    // Boss 战期间 Boss 血条接管顶部视觉重心，内力区让位隐藏。
    this.innerPowerLabel?.setVisible(!visible);
    this.innerPowerSlot?.setVisible(!visible);
    this.innerPowerBorder?.setVisible(!visible);
    this.innerPowerFill?.setVisible(!visible);
    this.innerPowerText?.setVisible(!visible);
    this.innerPowerTicks?.setVisible(!visible);
    this.bossHudBack?.setVisible(visible);
    this.bossHudFill?.setVisible(visible);
    this.bossHudText?.setVisible(visible);
    this.bossHudTip?.setVisible(visible && boss.currentAttack !== "none");
    if (!visible || !this.bossHudBack || !this.bossHudFill) {
      return;
    }

    const fullWidth = Math.max(0, this.bossHudBack.displayWidth - 4);
    const ratio = Phaser.Math.Clamp(boss.hpPercent / 100, 0, 1);
    this.bossHudFill.setDisplaySize(Math.round(fullWidth * ratio), 12);
    this.bossHudFill.setFillStyle(boss.hpPercent <= 25 ? PALETTE.lowHp : PALETTE.cinnabar, 0.95);
    this.bossHudText?.setText(`${boss.bossName ?? "黑风寨主"}  ${boss.hp}/${boss.maxHp}`);
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
      this.groundTile.tilePositionX = this.stageScrollX;
      this.groundTile.tilePositionY = this.stageScrollY;
    }

    if (this.roadTile) {
      this.roadTile.tilePositionX = this.stageScrollX;
      this.roadTile.tilePositionY = this.stageScrollY;
    }

    if (this.roadAccentTile) {
      this.roadAccentTile.tilePositionX = 420 + this.stageScrollX * 0.9;
      this.roadAccentTile.tilePositionY = 128 + this.stageScrollY * 0.9;
    }

    this.refreshPropScatter();
  }

  private updateHeroView(movement: HeroMovementSnapshot, deltaMs: number): void {
    if (!this.heroView) {
      return;
    }

    const health = this.getHealthSnapshot();
    const heroSprite = this.heroView instanceof Phaser.GameObjects.Sprite ? this.heroView : undefined;
    if (heroSprite) {
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

      // 程序化倾斜：按水平速度占比 ±3.5°，指数平滑，停止时归零（只写 rotation，不打断帧动画/flipX）。
      const speedRef = Math.max(1, movement.speed);
      const tiltTarget = Phaser.Math.Clamp(movement.velocityX / speedRef, -1, 1) * HERO_TILT_MAX_RAD;
      this.heroTiltRad = Phaser.Math.Linear(this.heroTiltRad, tiltTarget, 1 - Math.exp(-deltaMs / HERO_TILT_SMOOTH_MS));
      if (movement.inputMagnitude <= 0.02 && Math.abs(this.heroTiltRad) < 0.001) {
        this.heroTiltRad = 0;
      }
      heroSprite.setRotation(this.heroTiltRad);
    } else if (movement.inputMagnitude > 0.02) {
      // 占位箭头：rotation 仍用于指示朝向，不叠加倾斜。
      this.heroView.rotation = Math.atan2(movement.inputX, -movement.inputY);
    }

    // 待机呼吸：idle 时 scaleY 在基础 scale 上乘法叠加 ±1.5%（1.6s 正弦），移动时平滑回落基础值。
    if (movement.inputMagnitude <= 0.02) {
      const breath = Math.sin((this.elapsedMs / HERO_BREATH_PERIOD_MS) * Math.PI * 2) * HERO_BREATH_AMOUNT;
      this.heroView.setScale(this.heroView.scaleX, this.heroBaseScaleY * (1 + breath));
    } else {
      const recover = 1 - Math.exp(-deltaMs / HERO_BREATH_RECOVER_MS);
      this.heroView.setScale(this.heroView.scaleX, Phaser.Math.Linear(this.heroView.scaleY, this.heroBaseScaleY, recover));
    }

    const centerY = this.getHeroScreenY();
    const bob = Math.sin(this.elapsedMs / 130) * 1.5 * movement.inputMagnitude;
    this.heroView.setPosition(this.scale.width / 2, centerY + bob);
    this.heroShadow?.setScale(1 + movement.inputMagnitude * 0.08, 1);

    const heroAlpha = health.invincibleMs > 0
      ? (Math.sin(this.elapsedMs / 18) > 0 ? 0.46 : 0.95)
      : 1;
    this.heroView.setAlpha(heroAlpha);
    // 接触阴影与主角透明度同步：受伤闪烁同节奏淡出淡入，死亡时随转场窗口持续淡出。
    if (this.heroShadow) {
      if (health.isDead) {
        const fadeStep = (HERO_SHADOW_ALPHA * deltaMs) / HERO_SHADOW_DEATH_FADE_MS;
        this.heroShadow.setAlpha(Math.max(0, this.heroShadow.alpha - fadeStep));
      } else {
        this.heroShadow.setAlpha(HERO_SHADOW_ALPHA * heroAlpha);
      }
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
    this.footHpFill?.setFillStyle(health.isLowHp ? PALETTE.lowHp : PALETTE.hp, 1);

    if (health.isLowHp !== this.wasLowHp) {
      this.wasLowHp = health.isLowHp;
      (getAudioSystem(this) as any).setLowHp?.(health.isLowHp);
      this.updateLowHpPulse(health.isLowHp);
    }

    const lowHpBreath = health.isLowHp ? 0.185 + Math.sin(this.elapsedMs / 320) * 0.065 : 0;
    for (const edge of this.screenDamageEdges) {
      if (edge.alpha > 0) {
        edge.setAlpha(Math.max(0, edge.alpha - deltaMs / 820));
      }
      if (edge.alpha < lowHpBreath) {
        edge.setAlpha(lowHpBreath);
      }
    }

    this.refreshVignetteDynamics();
  }

  private updateLowHpPulse(active: boolean): void {
    if (!active) {
      this.lowHpPulseTween?.stop();
      this.lowHpPulseTween = undefined;
      this.hudHealthGlow?.setScale(1);
      return;
    }
    if (this.lowHpPulseTween || !this.hudHealthGlow) {
      return;
    }
    // 血条本体每帧被 setDisplaySize 重置 scale，脉冲改作用于紧贴血条的辉光层。
    this.lowHpPulseTween = this.tweens.add({
      targets: this.hudHealthGlow,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private openPause(): void {
    if (getScreenState(this) !== "game" || this.bossEndQueued || this.deathTransitionQueued) {
      return;
    }
    getAudioSystem(this).playPlaceholder("pause_toggle");
    prepareScreenTransition(this, "pause");
    eventBus.emit("pause_opened", {});
    this.scene.pause(SCENE_KEYS.game);
    this.scene.launch(SCENE_KEYS.pause);
  }

  private openInsight(pendingInsight?: PendingInsight): void {
    if (getScreenState(this) !== "game" || this.insightOpening || this.bossEndQueued || this.deathTransitionQueued) {
      return;
    }
    this.insightOpening = true;
    JuiceSystem.get(this).levelUp();
    this.time.delayedCall(350, () => {
      this.insightOpening = false;
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
    });
  }

  private startDeathTransition(causeText = "血量耗尽", eventCause = "debug"): void {
    if (getScreenState(this) !== "game" || this.deathTransitionQueued || this.bossEndQueued) {
      return;
    }
    this.deathTransitionQueued = true;
    const runSummary = this.createRunSummary("dead", causeText);
    setRunSummary(this, runSummary);
    this.cameras.main.flash(200, 226, 74, 54);
    this.time.delayedCall(420, () => {
      if (getScreenState(this) !== "game") {
        return;
      }
      prepareScreenTransition(this, "death_transition");
      eventBus.emit("death_transition_started", { cause: eventCause });
      this.debugPanel?.update(this.createDebugSnapshot());
      this.scene.pause(SCENE_KEYS.game);
      this.scene.launch(SCENE_KEYS.deathTransition, { causeText, runSummary });
    });
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
    this.skillSlotKeyHints = [];
    this.skillSlotCooldownMasks = [];
    const slotSize = 64;
    const gap = 8;
    const totalWidth = slotSize * 4 + gap * 3;
    const startX = this.scale.width / 2 - totalWidth / 2 + slotSize / 2;
    const y = this.scale.height - 40;

    for (let index = 0; index < 4; index += 1) {
      const x = startX + index * (slotSize + gap);
      const frame = this.textures.exists("ui_skill_slot_frame")
        ? this.add.image(x, y, "ui_skill_slot_frame").setDisplaySize(slotSize, slotSize).setDepth(HUD_DEPTH_CONTENT)
        : this.add.rectangle(x, y, slotSize, slotSize, 0x11140f, 0.68)
          .setStrokeStyle(1, 0xd6c28d, 0.62)
          .setDepth(HUD_DEPTH_CONTENT);
      const initialIconAssetId = getFirstExistingHudSkillIconAssetId(this);
      const icon = initialIconAssetId
        ? this.add.image(x, y - 4, initialIconAssetId).setDisplaySize(44, 44).setDepth(HUD_DEPTH_TEXT).setVisible(false)
        : undefined;
      // 冷却高度遮罩：自底向上的半透明暗色矩形，比例为 0 时隐藏。
      // 注：SkillSlotSnapshot 目前不携带冷却数据，接口预留，updateSkillSlots 中恒为就绪态。
      const cooldownMask = this.add.rectangle(x, y + slotSize / 2 - 4, slotSize - 8, 0, 0x050705, 0.62)
        .setOrigin(0.5, 1)
        .setDepth(HUD_DEPTH_TEXT)
        .setVisible(false);
      const text = this.add.text(x, y + 21, "", {
        color: PALETTE.textSecondary,
        fontFamily: FONT_MONO,
        fontSize: "10px",
        fontStyle: "bold",
        stroke: "#101010",
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(HUD_DEPTH_TEXT).setAlign("center").setResolution(2);
      const keyHint = this.add.text(x - slotSize / 2 + 8, y - slotSize / 2 + 8, `${index + 1}`, {
        color: PALETTE.textSecondary,
        fontFamily: FONT_MONO,
        fontSize: "10px",
        fontStyle: "bold",
        stroke: "#101010",
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(HUD_DEPTH_TEXT).setResolution(2);
      this.skillSlotFrames.push(frame);
      this.skillSlotIcons.push(icon);
      this.skillSlotTexts.push(text);
      this.skillSlotKeyHints.push(keyHint);
      this.skillSlotCooldownMasks.push(cooldownMask);
    }
  }

  private updateSkillSlots(): void {
    const slots = this.getSkillSnapshot().skillSlots;
    for (let index = 0; index < this.skillSlotTexts.length; index += 1) {
      const frame = this.skillSlotFrames[index];
      const icon = this.skillSlotIcons[index];
      const text = this.skillSlotTexts[index];
      const cooldownMask = this.skillSlotCooldownMasks[index];
      const slot = slots[index];
      // SkillSlotSnapshot 暂无冷却字段，遮罩恒隐藏（接口已就位）。
      cooldownMask?.setVisible(false).setDisplaySize(56, 0);
      if (!slot) {
        setSkillSlotFrameState(frame, false, false);
        icon?.setVisible(false);
        text?.setColor(PALETTE.textSecondary);
        text?.setText("");
        continue;
      }

      setSkillSlotFrameState(frame, true, slot.advanced);
      const iconAssetId = getHudSkillIconAssetId(this, slot.skillId, slot.advanced);
      if (icon && this.textures.exists(iconAssetId)) {
        icon.setTexture(iconAssetId).setDisplaySize(44, 44).setVisible(true);
      } else {
        icon?.setVisible(false);
      }
      text?.setColor(slot.advanced ? "#fff1a8" : PALETTE.textPrimary);
      text?.setText(`${getShortSkillName(slot.displayName)} Lv${slot.level}`);
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

  /**
   * F6 压测（DEV）：让 EnemyDirector 按当前波次段（ResolvedWaveSegment）敌种组成额外批量刷 30 敌，
   * 点位为屏外环形；aliveCap×1.5 硬上限在 EnemyDirector.debugSpawnWaveBatch 内钳制，
   * 连按可堆到 150+ 用于 120 敌 / 150+ 敌性能压测，不改自然刷怪逻辑。
   */
  private spawnStressWaveForDebug(): void {
    if (getScreenState(this) !== "game") {
      return;
    }
    const spawned = this.enemyDirector?.debugSpawnWaveBatch(30) ?? 0;
    this.latestEnemyDirector = this.enemyDirector?.getSnapshot();
    this.debugPanel?.update(this.createDebugSnapshot());
    console.debug(
      `[Stress] F6 批量刷怪 +${spawned}，当前存活 ${this.latestEnemyDirector?.enemiesAlive ?? "?"} / 硬上限 aliveCap×1.5`
    );
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

  private godModeForPerf = false;

  /** DEV 性能压测专用：G 键切换无敌（不清状态、不影响其他调试）。 */
  private toggleGodModeForPerf(): void {
    this.godModeForPerf = !this.godModeForPerf;
    console.debug(`[Perf] godMode=${this.godModeForPerf}`);
  }

  private applyHeroDamage(amount: number, source: string): DamageResult | undefined {
    if (getScreenState(this) !== "game" || this.godModeForPerf) {
      return undefined;
    }

    const result = this.heroHealth?.damage(amount, source);
    if (!result?.damaged) {
      return result;
    }

    getAudioSystem(this).playPlaceholder("hero_hurt");
    JuiceSystem.get(this).heroHurt();
    this.showHeroHurtFlash();
    // 重击（单次掉血 >20% 上限）追加全屏压暗聚焦。
    if (amount >= this.getHealthSnapshot().maxHp * heavyHitFocusConfig.thresholdRatio) {
      this.showHeavyHitFocus();
    }
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
    this.checkKillMilestone();
  }

  private checkKillMilestone(): void {
    const milestone = KILL_MILESTONES.find((entry) => entry.count === this.kills);
    if (!milestone || this.killMilestonesHit.has(milestone.count)) {
      return;
    }
    this.killMilestonesHit.add(milestone.count);
    const killsText = this.hudKillsText;
    if (killsText) {
      this.tweens.killTweensOf(killsText);
      killsText.setScale(1);
      this.tweens.add({
        targets: killsText,
        scale: 1.4,
        duration: 140,
        ease: "Back.easeOut",
        yoyo: true
      });
    }
    JuiceSystem.get(this).damageNumber(this.scale.width - 154, 72, milestone.label, "gold");
  }

  private handleBossDefeated(_summary: BossDefeatSummary): void {
    if (getScreenState(this) !== "game" || this.bossEndQueued) {
      return;
    }
    this.bossEndQueued = true;
    const runSummary = this.createRunSummary("win", undefined, {
      bossDefeated: true
    });
    setRunSummary(this, runSummary);
    JuiceSystem.get(this).bossDeath();
    this.setBossDim(false);
    this.debugPanel?.update(this.createDebugSnapshot());
    this.time.delayedCall(520, () => {
      prepareScreenTransition(this, "result");
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.result, runSummary);
    });
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
        context.fillStyle = PALETTE.worldBg;
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

    // 枫叶官道兜底地面（官方 ground_maple_base 缺失时不崩）：暖墨褐底 + 芥金/枫红碎叶斑点。
    const mapleFallback = stageMapConfig.maps.find((entry) => entry.id === "maple_official_road");
    if (mapleFallback && !this.textures.exists(mapleFallback.fallbackGroundTexture)) {
      const ground = this.textures.createCanvas(mapleFallback.fallbackGroundTexture, 512, 512);
      const context = ground?.getContext();
      if (ground && context) {
        context.fillStyle = mapleFallback.worldBg;
        context.fillRect(0, 0, 512, 512);
        context.fillStyle = "rgba(201, 162, 75, 0.07)";
        for (let index = 0; index < 46; index += 1) {
          const x = (index * 97) % 512;
          const y = (index * 163) % 512;
          context.beginPath();
          context.ellipse(x, y, 2 + (index % 3), 1 + (index % 2), index, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = "rgba(178, 58, 36, 0.08)";
        for (let index = 0; index < 34; index += 1) {
          const x = (index * 131) % 512;
          const y = (index * 89) % 512;
          context.beginPath();
          context.ellipse(x, y, 2 + (index % 4), 1 + (index % 3), index * 0.7, 0, Math.PI * 2);
          context.fill();
        }
        context.strokeStyle = "rgba(12, 7, 4, 0.2)";
        context.lineWidth = 2;
        for (let x = 0; x <= 512; x += 96) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x - 64, 512);
          context.stroke();
        }
        ground.refresh();
      }
    }

    // 夜雨破庙兜底地面（官方 ground_darktemple_base 缺失时不崩）：冷墨青底 + 碎石灰斑 + 残砖缝。
    const templeFallback = stageMapConfig.maps.find((entry) => entry.id === "temple_ruin_nightrain");
    if (templeFallback && !this.textures.exists(templeFallback.fallbackGroundTexture)) {
      const ground = this.textures.createCanvas(templeFallback.fallbackGroundTexture, 512, 512);
      const context = ground?.getContext();
      if (ground && context) {
        context.fillStyle = templeFallback.worldBg;
        context.fillRect(0, 0, 512, 512);
        context.fillStyle = "rgba(122, 138, 154, 0.08)";
        for (let index = 0; index < 56; index += 1) {
          const x = (index * 89) % 512;
          const y = (index * 157) % 512;
          context.beginPath();
          context.ellipse(x, y, 2 + (index % 3), 1 + (index % 2), index * 0.9, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = "rgba(58, 68, 82, 0.12)";
        for (let index = 0; index < 30; index += 1) {
          const x = (index * 137) % 512;
          const y = (index * 83) % 512;
          context.beginPath();
          context.ellipse(x, y, 3 + (index % 4), 2 + (index % 3), index * 0.6, 0, Math.PI * 2);
          context.fill();
        }
        context.strokeStyle = "rgba(6, 9, 13, 0.35)";
        context.lineWidth = 2;
        for (let x = 0; x <= 512; x += 128) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x - 48, 512);
          context.stroke();
        }
        ground.refresh();
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
    scene.add.rectangle(width / 2, thickness / 2, width, thickness, PALETTE.cinnabar, 0),
    scene.add.rectangle(width / 2, height - thickness / 2, width, thickness, PALETTE.cinnabar, 0),
    scene.add.rectangle(thickness / 2, height / 2, thickness, height, PALETTE.cinnabar, 0),
    scene.add.rectangle(width - thickness / 2, height / 2, thickness, height, PALETTE.cinnabar, 0)
  ];

  for (const edge of edges) {
    edge.setDepth(900);
    edge.setBlendMode(Phaser.BlendModes.ADD);
  }

  return edges;
}

function createHudPauseButton(scene: Phaser.Scene, x: number, y: number, onClick: () => void, size = 34): void {
  if (scene.textures.exists("ui_icon_pause")) {
    const baseScale = size / 96;
    const icon = scene.add.image(x, y, "ui_icon_pause").setDisplaySize(size, size).setDepth(HUD_DEPTH_CONTENT);
    const hitArea = scene.add.rectangle(x, y, size + 26, size + 18, 0x000000, 0).setDepth(HUD_DEPTH_TEXT);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on(Phaser.Input.Events.POINTER_OVER, () => icon.setScale(baseScale * 1.08));
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => icon.setScale(baseScale));
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => {
      icon.setScale(baseScale * 0.94);
      onClick();
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, () => icon.setScale(baseScale * 1.08));
    return;
  }

  const background = scene.add.rectangle(x, y, 40, 34, 0x2f5b4f, 0.95)
    .setStrokeStyle(2, 0xd6c28d, 0.9)
    .setDepth(HUD_DEPTH_CONTENT);
  scene.add.text(x, y, "II", {
    color: PALETTE.textPrimary,
    fontFamily: FONT_MONO,
    fontSize: "16px",
    fontStyle: "bold",
    stroke: "#101010",
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(HUD_DEPTH_TEXT).setResolution(2);
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

function getHudSkillIconAssetId(scene: Phaser.Scene, skillId: SkillId, advanced: boolean): string {
  // 墨染江山（moran_ink_zone，并行代理注册的 zone 技能）：防御性映射，
  // 纹理缺失时依次退回普通图标 / icon_scroll，最终仍由调用方 textures.exists 兜底隐藏。
  if (String(skillId).includes(MORAN_SKILL_ID_KEY)) {
    const advancedKey = "ui_icon_skill_moran_advanced";
    const normalKey = "ui_icon_skill_moran";
    if (advanced && scene.textures.exists(advancedKey)) {
      return advancedKey;
    }
    if (scene.textures.exists(normalKey)) {
      return normalKey;
    }
    if (scene.textures.exists("icon_scroll")) {
      return "icon_scroll";
    }
    return advanced ? advancedKey : normalKey;
  }
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
    "ui_icon_skill_moran",
    "ui_icon_skill_yulong_advanced",
    "ui_icon_skill_huifeng_advanced",
    "ui_icon_skill_zhenshan_advanced",
    "ui_icon_skill_moran_advanced",
    "icon_scroll"
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
    frame
      .setTexture("ui_skill_slot_frame")
      .setDisplaySize(64, 64)
      .setAlpha(occupied ? 1 : 0.55);
    // 进阶槽：沿用金色 tint 框判定（新槽框无独立进阶贴图，统一 tint）
    if (advanced && occupied) {
      frame.setTint(0xffd977);
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
    || value === "inner_force_manual"
    || value === "pine_soot_inkstick";
}

const KILL_MILESTONES: Array<{ count: number; label: string }> = [
  { count: 50, label: "五十杀！" },
  { count: 100, label: "百杀！" },
  { count: 200, label: "两百杀！" }
];

const SCATTER_PROP_BASE: Record<string, { depth: number; alpha: number; scale: number }> = {
  bamboo_edge_cluster: { depth: -22, alpha: 0.5, scale: 0.74 },
  rock_cluster: { depth: -21, alpha: 0.52, scale: 0.6 },
  wood_stake_flag: { depth: -21, alpha: 0.48, scale: 0.62 },
  decor_lantern: { depth: -21, alpha: 0.6, scale: 0.9 },
  decor_flag: { depth: -21, alpha: 0.58, scale: 0.9 },
  decor_stele: { depth: -21, alpha: 0.6, scale: 0.88 },
  decor_winejar: { depth: -21, alpha: 0.6, scale: 0.85 },
  // 枫叶官道（素材代理由并行代理注册；缺失时 createScatterProp 按 textures.exists 跳过）
  maple_tree_cluster: { depth: -22, alpha: 0.55, scale: 0.58 },
  decor_stone_lion: { depth: -21, alpha: 0.62, scale: 0.9 },
  decor_sword_mound: { depth: -21, alpha: 0.62, scale: 0.9 },
  // 夜雨破庙（同由并行代理注册；textures.exists 防御，缺失跳过）
  decor_broken_buddha: { depth: -22, alpha: 0.6, scale: 0.92 },
  decor_temple_ruin: { depth: -22, alpha: 0.58, scale: 0.9 },
  decor_stone_lantern: { depth: -21, alpha: 0.66, scale: 0.9 },
  decor_spirit_tablet: { depth: -21, alpha: 0.6, scale: 0.88 }
};

// 青石山道散布类型池：竹丛/石堆为主，4 个 P3 新装饰物各占 8% 低权重点缀。
// 运行时以 stageMapConfig 当前地图条目的 scatterPool 为准；此处仅作配置缺失时的兜底。
const SCATTER_PROP_POOL: Array<{ key: keyof typeof SCATTER_PROP_BASE; weight: number }> = [
  { key: "bamboo_edge_cluster", weight: 0.32 },
  { key: "rock_cluster", weight: 0.24 },
  { key: "wood_stake_flag", weight: 0.12 },
  { key: "decor_lantern", weight: 0.08 },
  { key: "decor_flag", weight: 0.08 },
  { key: "decor_stele", weight: 0.08 },
  { key: "decor_winejar", weight: 0.08 }
];

function hashScatterSlot(slotI: number, slotJ: number): number {
  let hash = (Math.imul(slotI, 374761393) + Math.imul(slotJ, 668265263)) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
