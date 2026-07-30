import Phaser from "phaser";
import { skillConfigs, skillOrder, type AdvanceKeyId, type SkillId, type SkillLevelConfig } from "../data/skills";
import { enemyConfigs } from "../data/enemies";
import type { InsightSkillState } from "../data/progression";
import type { GameEventName } from "../types";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";
import type { EnemyDamageResult, EnemyTargetSnapshot } from "./EnemyDirectorSystem";
import type { BossDamageResult, BossTargetSnapshot } from "./BossSystem";
import { eventBus } from "../utils/EventBus";
import { getArtAnimationKey } from "../utils/artAssets";
import { segmentIntersectsCircle } from "../utils/geometry";
import { JuiceSystem, type DamageKind } from "./JuiceSystem";

type Point = {
  x: number;
  y: number;
};

type SkillSystemOptions = {
  getHeroWorld: () => Point;
  getHeroScreen: () => Point;
  getTargets: () => CombatTargetSnapshot[];
  damageTarget: (runtimeId: number, amount: number, source: string, attackOriginWorld?: Point) => CombatDamageResult | undefined;
  knockbackEnemy: (runtimeId: number, originWorld: Point, distance: number, source: string) => boolean;
  onEnemyKilled: (result: EnemyDamageResult) => void;
  playSfx: (eventId: string) => void;
  /** 可选：英雄面向（归一化输入方向）。烈火神掌无有效目标时按面向喷发火径；缺省/静止时回退默认方向。 */
  getHeroFacing?: () => Point | undefined;
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
  trailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
};

type OrbitalRuntime = {
  runtimeId: number;
  skillId: SkillId;
  angleRad: number;
  advanced: boolean;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  trailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  ghostCooldownMs: number;
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
  /** 地面残痕已 stamp：首次命中即裂；整波未命中则波结束时落地一裂，每波仅一次 */
  crackStamped: boolean;
  view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
};

/** 墨染江山·墨痕领域：世界锚定地面 DoT 控制场，视觉走共享墨层 RenderTexture，无逐领域视图对象。 */
type ZoneRuntime = {
  runtimeId: number;
  skillId: SkillId;
  worldX: number;
  worldY: number;
  radius: number;
  /** 每跳伤害 */
  damage: number;
  slowPercent: number;
  tickIntervalMs: number;
  tickTimerMs: number;
  ageMs: number;
  durationMs: number;
  /** 施放时技能等级（毒化「墨里淬毒」Lv3+ 门槛判定） */
  level: number;
  advanced: boolean;
  /** 毒泡粒子 emitter（Lv3+ 挂领域存续期，随领域销毁） */
  poisonEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
};

type VfxRuntime = {
  view: Phaser.GameObjects.Arc | Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  worldX: number;
  worldY: number;
  ageMs: number;
  durationMs: number;
  type: "hit" | "die" | "advance";
};

/** 火浪推进计划项：推浪火点按 atMs 错峰喷发（纯数据，随墙销毁，无定时器泄漏面）。
 *  现为兜底路径：vfx_fire_palm 缺失时退回逐点火浪；掌形气劲在时计划表为空。 */
type FireWaveBurstPlan = {
  /** 距施放毫秒数（火浪总时长 FIRE_WAVE_DURATION_MS 内 stagger） */
  atMs: number;
  worldX: number;
  worldY: number;
  /** 火点显示缩放（墙宽基准 × 0.8-1.0 随机） */
  scale: number;
};

/**
 * 掌形气劲（方案一"掌劲引路，火径随行"）：vfx_fire_palm 从英雄沿施放指向约 300ms 飞至
 * 火径终点，拖 2-3 个渐隐残影副本（k 越大越淡越大，沿已飞行路径拖尾，ADD 混合）；
 * 到达即砸地（震屏+轻白闪），随后 140ms 内掌与残影原地消散。全部对象随 SkillSystem 销毁。
 */
type FirePalmRuntime = {
  /** 所属火径（到达时校验墙仍在才触发震屏/白闪；墙提前销毁则仅消散） */
  wallRuntimeId: number;
  startX: number;
  startY: number;
  dirX: number;
  dirY: number;
  /** 飞行总距离 = 墙长（英雄 → 火径终点） */
  totalDist: number;
  /** 飞行方向角（贴图朝向右下动势，按飞行方向 setRotation + 轻微摆动） */
  angle: number;
  ageMs: number;
  durationMs: number;
  /** 到达后置位：进入 140ms 原地消散阶段 */
  landed: boolean;
  advanced: boolean;
  view: Phaser.GameObjects.Sprite;
  /** 残影副本（index 0 = 最近最浓；data 内 baseAlpha/baseScale 供消散阶段读取） */
  ghosts: Phaser.GameObjects.Sprite[];
};

/**
 * 烈火神掌·地火喷发：世界锚定的旋转矩形线状 DoT 场，长轴沿施放指向、起点即英雄位置
 * （判定矩形中心 = 英雄 + 指向 × 墙长/2，与火径视觉线完全重合）。
 * 呈现两段式：①掌劲引路——掌形气劲飞至终点砸地（兜底：pendingBursts 逐点火浪）；
 * ②火径随行——vfx_fire_wall 段沿指向拼接（1.5× 厚度、50% 重叠、NORMAL 主体 + ADD 焰心），
 * 自终点向英雄倒卷点亮（兜底路径正向点亮），随墙销毁。
 */
type WallRuntime = {
  runtimeId: number;
  skillId: SkillId;
  worldX: number;
  worldY: number;
  /** 火径长轴方向（弧度）= 施放指向（密集方向/英雄面向） */
  angleRad: number;
  length: number;
  width: number;
  /** 每跳伤害 */
  damage: number;
  tickIntervalMs: number;
  tickTimerMs: number;
  ageMs: number;
  durationMs: number;
  level: number;
  advanced: boolean;
  /** 灼烧跳数（基础 1 / 进阶 2） */
  burnTicks: number;
  /** 施放瞬间英雄世界坐标（出掌爆点位置，火径/推浪起点） */
  castX: number;
  castY: number;
  /** 火径段/裂缝全部点亮的截止时刻（updateFireTrailReveal 超过即短路零开销） */
  trailRevealDoneMs: number;
  /** 火浪推进兜底计划（atMs 升序）：updateWalls 到点喷发，喷完即空；掌劲路径为空表 */
  pendingBursts: FireWaveBurstPlan[];
  view: Phaser.GameObjects.Container;
};

/**
 * 灼烧状态（SkillSystem 自承载，不走 EnemyDirector 桥接）：
 * 墙 tick 命中即刷新——最后一次命中 FIRE_WALL_BURN_DELAY_MS 后跳 1 跳（进阶 2 跳），
 * 伤害 = 点燃当次墙 tick 伤害。目标死亡/离场时 damageTarget 返回未命中即清除。
 */
type BurnRuntime = {
  skillId: SkillId;
  ticksRemaining: number;
  /** 距下一跳剩余毫秒 */
  nextTickInMs: number;
  damage: number;
  advanced: boolean;
  attackOriginWorld: Point;
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
  /** 墨痕领域存活数（可选：GameScene 兜底快照字面量无需补齐，消费方按 0 处理） */
  zonesAlive?: number;
  /** 火墙存活数（可选：同 zonesAlive 的可选约定） */
  wallsAlive?: number;
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
/** 投射物拖尾粒子纹理（由 JuiceSystem 程序化生成） */
const TRAIL_TEXTURE = "juice_spark";
/** 回风镖残影：生成间隔与全局上限（防泄漏/防爆量） */
const DART_GHOST_INTERVAL_MS = 70;
const MAX_DART_GHOSTS = 24;
/** 暴击判定：实际伤害 ≥ 该技能当前配置期望伤害的倍数（方案五·伤害数字分层） */
const CRIT_DAMAGE_RATIO = 2;
/** 墨染江山·领域并发上限（冷却 3.6-4.5s > 持续 3.5-4s，常态单领域，进阶/低压时可短暂双领域） */
const MAX_ZONES = 2;
/** 墨层渐褪时长：最后一片领域消失后整层 alpha 线性衰减并销毁 */
const INK_LAYER_FADE_MS = 650;
/** 墨层持续慢渐隐：擦除间隔与单次擦除强度（约 3-4s 消隐，防止连续施放墨痕无限累积） */
const INK_ERASE_INTERVAL_MS = 200;
const INK_ERASE_ALPHA = 0.05;
const INK_ERASE_TEXTURE = "ink_erase_white";
/** 减速宽限：每跳续期 tick + 宽限，领域消失后敌人短时自愈 */
const ZONE_SLOW_GRACE_MS = 260;
/** 墨层 RenderTexture 深度：地面道具之上、敌人（8-9）与投射物（14）之下 */
const INK_LAYER_DEPTH = 2;
/** 墨笔触纹理（256×256，跨代理约定键，未注册时走程序化兜底纹理） */
const INK_STROKE_TEXTURES = ["vfx_ink_stroke_1", "vfx_ink_stroke_2", "vfx_ink_stroke_3", "vfx_ink_stroke_4"];
/** 施放瞬间序列帧（6 帧 96×96） */
const INK_SPLAT_TEXTURE = "vfx_ink_splat";
/** 程序化兜底墨渍纹理（笔触美术缺失时生成一次复用） */
const INK_FALLBACK_TEXTURE = "moran_ink_fallback";
/** 墨点 hitSpark 复用 JuiceSystem 程序化点纹理，深色 NORMAL 混合（不要 ADD 亮色） */
const INK_HIT_DOT_TEXTURE = "juice_dot";
/** 配色：墨 / 进阶芥金墨 / Lv3+ 墨缘淬毒绿韵（原泛青 0x9fc4b4 与孔雀绿 0x3fae8a 按 65:35 合并，乘算微调保持低饱和） */
const INK_TINT_ADVANCED = 0xa99a20;
const INK_TINT_POISON_EDGE = 0x7dbca5;
/** 墨里淬毒（Lv3+）：zone tick 命中桥接中毒（EnemyDirector 最小通道）；余毒跳数 / 跳间隔 / 进阶蚀甲倍率 */
const ZONE_POISON_TICKS_BASE = 2;
const ZONE_POISON_TICKS_ADVANCED = 3;
const ZONE_POISON_TICK_INTERVAL_MS = 500;
const ZONE_POISON_AMP_ADVANCED = 1.1;
/** types.ts 为并行代理共享文件不动：中毒请求事件名本地断言接入事件总线（EnemyDirector 端同名桥接） */
const ENEMY_POISON_REQUESTED_EVENT = "enemy_poison_requested" as GameEventName;
/** 毒泡粒子：纹理键（跨代理约定，缺失走程序化兜底白泡 + tint 上色；进阶金绿版 gold 键缺失回落基础键） */
const POISON_BUBBLE_TEXTURE = "vfx_poison_bubble";
const POISON_BUBBLE_GOLD_TEXTURE = "vfx_poison_bubble_gold";
const POISON_BUBBLE_FALLBACK_TEXTURE = "moran_poison_bubble_fallback";
const POISON_BUBBLE_FREQUENCY_MS = 120;
const POISON_BUBBLE_LIFESPAN_MS = 700;
/** 毒泡配色：孔雀绿 / 金蛊金绿（仅程序化兜底白泡需要 tint，美术泡自带颜色） */
const POISON_BUBBLE_TINT = 0x3fae8a;
const POISON_BUBBLE_GOLD_TINT = 0xa9c04a;
/** 毒泡深度：墨层（2）之上、敌人（8-9）之下——泡从墨面冒出，不盖角色 */
const POISON_BUBBLE_DEPTH = 6;
/** 震山掌地面残痕纹理（跨代理约定键，未注册时走程序化裂纹兜底） */
const GROUND_CRACK_TEXTURE = "vfx_ground_crack";
/** 程序化兜底裂纹纹理（192×192，生成一次全局复用） */
const GROUND_CRACK_FALLBACK_TEXTURE = "zhenshan_crack_fallback";
/** 地面残痕驻留：stamp 后 2.5s 内墨层保持，随后随墨层渐隐销毁 */
const GROUND_CRACK_HOLD_MS = 2500;
/** 地面残痕 stamp 透明度 */
const GROUND_CRACK_ALPHA = 0.55;
/** 回风飞镖轨道虚线点环：程序化纹理键与贴图尺寸（点环半径 120/128，留白边） */
const HUIFENG_ORBIT_RING_TEXTURE = "huifeng_orbit_ring";
const ORBIT_RING_TEXTURE_SIZE = 256;
/** 轨道环透明度：基础 0.14 / 进阶 0.22（金色细环，跟随英雄与轨道半径） */
const ORBIT_RING_ALPHA_BASE = 0.14;
const ORBIT_RING_ALPHA_ADVANCED = 0.22;
/** 轨道环深度：地面墨层（2）之上、敌人（8-9）之下，仅作轨道指引 */
const ORBIT_RING_DEPTH = 4;
// ── 烈火神掌 · 地火喷发（kind "wall"）──
/** 火径并发上限（冷却 4-5s > 持续 3-3.4s，常态单条，进阶/低压时可短暂双条） */
const MAX_WALLS = 2;
/** 火径段贴图（4 帧序列，跨代理约定键，未注册时走程序化兜底火径） */
const FIRE_WALL_SEGMENT_TEXTURE = "vfx_fire_wall";
/** 推浪火点/出掌爆点一次性迸发序列帧（跨代理约定键，缺失退化为金红扩散环） */
const FIRE_WALL_BURST_TEXTURE = "vfx_fire_burst";
/** 段贴图 0 号帧缺省尺寸（读取失败时按 48×48 方形帧计） */
const FIRE_WALL_SEGMENT_FALLBACK_SIZE = 48;
/** 火径深度：地面墨层（2）之上、敌人（8-9）之下——火径贴地燃烧，不盖角色 */
const FIRE_WALL_DEPTH = 6;
/** 推浪火点/出掌爆点深度：火径之上、敌人之下 */
const FIRE_WALL_BURST_DEPTH = 7;
/** 火径淡入/淡出时长：出手即燃（快淡入），熄灭前渐隐（慢淡出） */
const FIRE_WALL_FADE_IN_MS = 160;
const FIRE_WALL_FADE_OUT_MS = 420;
/** 火径整体透明度上限（NORMAL 混合下保留地面可读性） */
const FIRE_WALL_MAX_ALPHA = 0.96;
/** 火浪推进：总时长 300ms，火点间距目标 45px（数量钳 5-7 个，间隔 = 300/数量 ≈ 43-60ms stagger） */
const FIRE_WAVE_DURATION_MS = 300;
const FIRE_WAVE_POINT_SPACING_PX = 45;
const FIRE_WAVE_MIN_POINTS = 5;
const FIRE_WAVE_MAX_POINTS = 7;
/** 推浪火点缩放区间（乘墙宽基准）；出掌爆点固定 ×1.2，明显大于火点 */
const FIRE_WAVE_POINT_SCALE_MIN = 0.8;
const FIRE_WAVE_POINT_SCALE_MAX = 1;
const FIRE_CAST_BURST_SCALE = 1.2;
/** 火径留守：段放大 1.5×（墙厚 36-48 → 54-72）、相邻段重叠 50% 消除缝隙 */
const FIRE_TRAIL_SEGMENT_SCALE = 1.5;
const FIRE_TRAIL_SEGMENT_OVERLAP = 0.5;
/** 火径主体 NORMAL 混合透明度（禁止整墙 ADD：水墨底上发灰发粉） */
const FIRE_TRAIL_SEGMENT_ALPHA = 0.92;
/** 焰心提亮：每段中心同贴图小 copy，ADD 混合低透明度（小面积提亮不过曝） */
const FIRE_TRAIL_CORE_SCALE = 0.55;
const FIRE_TRAIL_CORE_ALPHA = 0.35;
/** 火径段亮起时长（倒卷/正向通用；裂缝用 FIRE_CRACK_FADE_IN_MS） */
const FIRE_TRAIL_REVEAL_FADE_MS = 90;
// ── 掌劲引路（方案一，vfx_fire_palm 存在时启用；缺失退回上方逐点火浪兜底）──
/** 掌形气劲贴图（256×256 单帧，朝向右下动势；跨代理约定键） */
const FIRE_PALM_TEXTURE = "vfx_fire_palm";
/** 终点地裂缝贴图（256×256 单帧，外圈淡晕不可用，仅裁中心 116×116 区绘制） */
const FIRE_CRACK_TEXTURE = "vfx_fire_crack";
/** 掌形气劲飞行时长（≈300ms，与墙 ageMs 时间轴对齐：到达即裂缝落地/火径倒卷起点） */
const FIRE_PALM_FLIGHT_MS = 300;
/** 掌形气劲显示尺寸 px（80-100 档中值；按贴图帧宽换算 scale） */
const FIRE_PALM_DISPLAY_SIZE = 88;
/** 掌形气劲深度：与投射物同档（14），飞行中压过敌人；残影同深度按创建序垫在掌下 */
const FIRE_PALM_DEPTH = 14;
/** 残影副本数与相邻拖尾间距：k 越大越淡（0.38/0.26/0.14）越大（×1.18/1.36/1.54） */
const FIRE_PALM_GHOST_COUNT = 3;
const FIRE_PALM_GHOST_SPACING_PX = 22;
/** 残影 k=1 起始透明度（每远一档 -0.12） */
const FIRE_PALM_GHOST_ALPHA_STEP = 0.38;
const FIRE_PALM_GHOST_SCALE_STEP = 0.18;
/** 掌飞行途中轻微摆动幅度（弧度）与角频率 */
const FIRE_PALM_WOBBLE_RAD = 0.12;
const FIRE_PALM_WOBBLE_FREQ = 0.03;
/** 掌与残影到达后的原地消散时长 */
const FIRE_PALM_LAND_FADE_MS = 140;
/** 火柱倒卷：段自终点向英雄依次点亮的间隔（约 60ms/段） */
const FIRE_TRAIL_REVERSE_INTERVAL_MS = 60;
/** 终点裂缝：裁中心 src 70,70,116,116 区（外圈淡晕不可用），绘制尺寸 = 墙宽 ×1.3 */
const FIRE_CRACK_CROP_X = 70;
const FIRE_CRACK_CROP_Y = 70;
const FIRE_CRACK_CROP_SIZE = 116;
const FIRE_CRACK_SIZE_RATIO = 1.3;
/** 裂缝淡入时长与透明度（落地即现，随火径一起淡出销毁） */
const FIRE_CRACK_FADE_IN_MS = 120;
const FIRE_CRACK_ALPHA = 0.9;
/** 灼烧：最后一次命中后再跳的延迟与进阶多跳间隔（表现层常量，不进 data/skills 数值表） */
const FIRE_WALL_BURN_DELAY_MS = 2000;
const FIRE_WALL_BURN_TICK_INTERVAL_MS = 500;
const FIRE_WALL_BURN_TICKS_BASE = 1;
const FIRE_WALL_BURN_TICKS_ADVANCED = 2;
/** types.ts 为并行代理共享文件不动：火墙施放事件名本地断言接入事件总线（与 moran 毒事件同约定） */
const SKILL_WALL_SPAWNED_EVENT = "skill_wall_spawned" as GameEventName;

export class SkillSystem {
  private readonly skills = new Map<SkillId, SkillRuntime>();
  private readonly advanceKeys = new Set<AdvanceKeyId>();
  private readonly projectiles: ProjectileRuntime[] = [];
  private readonly orbitals: OrbitalRuntime[] = [];
  private readonly waves: WaveRuntime[] = [];
  private readonly zones: ZoneRuntime[] = [];
  private readonly walls: WallRuntime[] = [];
  /** 飞行中的掌形气劲（vfx_fire_palm 存在时的施放前奏；数量 ≤ MAX_WALLS） */
  private readonly firePalms: FirePalmRuntime[] = [];
  /** 灼烧状态表：key = 目标 runtimeId（仅敌人；死亡/离场即清除），SkillSystem 自承载不跨系统 */
  private readonly burnStates = new Map<number, BurnRuntime>();
  private readonly vfx: VfxRuntime[] = [];
  private readonly hitSamples: HitSample[] = [];
  private readonly dartGhosts: Phaser.GameObjects.Sprite[] = [];
  private readonly orbitalHitCooldowns = new Map<string, number>();
  private nextProjectileId = 1;
  private nextOrbitalId = 1;
  private nextWaveId = 1;
  private nextZoneId = 1;
  private nextWallId = 1;
  private hitSfxCooldownMs = 0;
  private cooldownReductionRatio = 0;
  /** 共享地面墨层：屏幕尺寸 RenderTexture，记录其像素 (0,0) 对应的世界坐标，逐帧随镜头对齐 */
  private inkLayer?: Phaser.GameObjects.RenderTexture;
  private inkLayerWorldX = 0;
  private inkLayerWorldY = 0;
  /** stamp 用暂存 Image（不入显示列表，复用避免逐次分配） */
  private inkScratch?: Phaser.GameObjects.Image;
  /** 墨层慢渐隐：擦除计时与暂存白块 */
  private inkEraseTickMs = 0;
  private inkEraseScratch?: Phaser.GameObjects.Image;
  /** 地面残痕驻留剩余毫秒：>0 时墨层不因领域清空而渐隐（震山掌裂纹 2.5s 驻留） */
  private inkCrackHoldMs = 0;
  /** 回风飞镖轨道虚线点环：全部飞镖同圆心同半径，共享一条避免多条同位置叠 alpha */
  private orbitRing?: Phaser.GameObjects.Sprite;

  constructor(private readonly scene: Phaser.Scene, private readonly options: SkillSystemOptions) {
    // 提前实例化 JuiceSystem，确保拖尾粒子纹理已生成
    JuiceSystem.get(this.scene);
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
    const targetGrid = new CombatTargetGrid(targets);
    for (const skillId of skillOrder) {
      const runtime = this.skills.get(skillId);
      if (!runtime) {
        continue;
      }

      if (skillConfigs[skillId].kind === "projectile") {
        this.castProjectileSkillIfReady(runtime, targets);
      } else if (skillConfigs[skillId].kind === "aoe") {
        this.castWaveSkillIfReady(runtime);
      } else if (skillConfigs[skillId].kind === "zone") {
        this.castZoneSkillIfReady(runtime, targets);
      } else if (skillConfigs[skillId].kind === "wall") {
        this.castWallSkillIfReady(runtime, targets);
      }
    }

    this.updateProjectiles(clampedDeltaMs, targetGrid);
    this.updateOrbitals(clampedDeltaMs, targets);
    this.updateWaves(clampedDeltaMs, targets);
    this.updateZones(clampedDeltaMs, targets);
    this.updateWalls(clampedDeltaMs, targets);
    this.updateFirePalms(clampedDeltaMs);
    this.updateBurns(clampedDeltaMs);
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
      zonesAlive: this.zones.length,
      wallsAlive: this.walls.length,
      activeVfx: this.vfx.length + this.waves.length + this.zones.length + this.walls.length + this.firePalms.length,
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

  increaseCooldownReduction(ratio: number): number {
    this.cooldownReductionRatio = Phaser.Math.Clamp(
      this.cooldownReductionRatio + Math.max(0, ratio),
      0,
      0.4
    );
    for (const runtime of this.skills.values()) {
      runtime.cooldownMs = Math.min(runtime.cooldownMs, this.getCooldownMs(runtime));
    }
    return this.cooldownReductionRatio;
  }

  destroy(): void {
    for (const projectile of this.projectiles) {
      projectile.trailEmitter?.destroy();
      projectile.view.destroy();
    }
    for (const orbital of this.orbitals) {
      orbital.trailEmitter?.destroy();
      orbital.view.destroy();
    }
    for (const wave of this.waves) {
      wave.view.destroy();
    }
    for (const zone of this.zones) {
      zone.poisonEmitter?.destroy();
      zone.poisonEmitter = undefined;
    }
    for (const wall of this.walls) {
      wall.view.destroy();
    }
    for (const palm of this.firePalms) {
      palm.view.destroy();
      for (const ghost of palm.ghosts) {
        ghost.destroy();
      }
    }
    this.firePalms.length = 0;
    for (const vfx of this.vfx) {
      vfx.view.destroy();
    }
    for (const ghost of this.dartGhosts) {
      ghost.destroy();
    }
    this.orbitRing?.destroy();
    this.orbitRing = undefined;
    this.inkLayer?.destroy();
    this.inkLayer = undefined;
    this.inkScratch?.destroy();
    this.inkScratch = undefined;
    this.inkEraseScratch?.destroy();
    this.inkEraseScratch = undefined;
    this.inkEraseTickMs = 0;
    this.projectiles.length = 0;
    this.orbitals.length = 0;
    this.waves.length = 0;
    this.zones.length = 0;
    this.walls.length = 0;
    this.burnStates.clear();
    this.vfx.length = 0;
    this.dartGhosts.length = 0;
    this.hitSamples.length = 0;
    this.orbitalHitCooldowns.clear();
    this.inkCrackHoldMs = 0;
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
      zhenshan_palm: "inner_force_manual",
      moran_ink_zone: "pine_soot_inkstick",
      liehuo_firewall: "fire_jujube_pit"
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

    runtime.cooldownMs = this.applyCooldownReduction(profile.cooldownMs);
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
    runtime.cooldownMs = this.applyCooldownReduction(profile.cooldownMs);
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
    const verticalMargin = Math.min(96, Math.max(0, DESIGN_HEIGHT * 0.18));
    const safeVerticalMargin = Math.min(verticalMargin, Math.max(0, (DESIGN_HEIGHT - 1) / 2));
    return target.screenX >= 0
      && target.screenX <= DESIGN_WIDTH
      && target.screenY >= safeVerticalMargin
      && target.screenY <= DESIGN_HEIGHT - safeVerticalMargin;
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
      view: projectileView,
      trailEmitter: this.createTrailEmitter(projectileView, runtime.advanced)
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
      crackStamped: false,
      view
    };
    this.nextWaveId += 1;
    this.waves.push(wave);
    this.updateWorldAnchoredView(wave.view, wave.worldX, wave.worldY);
    JuiceSystem.get(this.scene).heavyHit();
  }

  // ---------- 墨染江山 · 墨痕领域（kind "zone"） ----------

  private castZoneSkillIfReady(runtime: SkillRuntime, targets: CombatTargetSnapshot[]): void {
    if (runtime.cooldownMs > 0 || this.zones.length >= MAX_ZONES) {
      return;
    }

    const profile = this.getZoneProfile(runtime);
    const heroWorld = this.options.getHeroWorld();
    // 首选敌人最密集处（密度中心），无有效目标时墨落少侠脚下作防御性领域
    const center = this.pickZoneCenter(targets, profile.radius, profile.range) ?? heroWorld;
    const zone: ZoneRuntime = {
      runtimeId: this.nextZoneId,
      skillId: runtime.skillId,
      worldX: center.x,
      worldY: center.y,
      radius: profile.radius,
      damage: profile.damage,
      slowPercent: profile.slowPercent,
      tickIntervalMs: profile.tickIntervalMs,
      tickTimerMs: 0,
      ageMs: 0,
      durationMs: profile.durationMs,
      level: runtime.level,
      advanced: runtime.advanced
    };
    this.nextZoneId += 1;
    this.zones.push(zone);
    this.stampInkStrokes(zone, profile.strokeCount, runtime.level);
    this.createInkSplatVfx(zone);
    zone.poisonEmitter = this.createPoisonBubbleEmitter(zone);
    runtime.cooldownMs = this.applyCooldownReduction(profile.cooldownMs);
    this.options.playSfx(runtime.advanced ? "skill_cast_advanced" : "skill_cast");
    eventBus.emit("skill_cast", {
      skillId: runtime.skillId,
      displayName: this.getRuntimeDisplayName(runtime),
      level: runtime.level,
      radius: profile.radius,
      durationMs: profile.durationMs,
      advanced: runtime.advanced
    });
    eventBus.emit("skill_zone_spawned", {
      zoneRuntimeId: zone.runtimeId,
      skillId: runtime.skillId,
      level: runtime.level,
      worldX: zone.worldX,
      worldY: zone.worldY,
      radius: zone.radius,
      durationMs: zone.durationMs,
      slowPercent: zone.slowPercent,
      advanced: zone.advanced
    });
  }

  /**
   * 密度中心选点：仅以英雄 range 范围内的目标为候选，单趟 O(n²) 邻域计数取最密点，
   * 返回其邻域质心（领域圆心不被单个敌人带偏）。仅施放瞬间调用（≥3.6s 一次），120 敌约 1.4 万次距离比较，开销可忽略。
   */
  private pickZoneCenter(targets: CombatTargetSnapshot[], radius: number, range: number): Point | undefined {
    const heroWorld = this.options.getHeroWorld();
    const candidates = targets.filter((target) => (
      Math.hypot(target.worldX - heroWorld.x, target.worldY - heroWorld.y) <= range
    ));
    if (candidates.length === 0) {
      return undefined;
    }

    let best: { target: CombatTargetSnapshot; members: CombatTargetSnapshot[] } | undefined;
    for (const candidate of candidates) {
      const members = candidates.filter((other) => (
        Math.hypot(other.worldX - candidate.worldX, other.worldY - candidate.worldY) <= radius
      ));
      if (!best || members.length > best.members.length) {
        best = { target: candidate, members };
      }
    }
    if (!best) {
      return undefined;
    }

    const sum = best.members.reduce(
      (acc, member) => ({ x: acc.x + member.worldX, y: acc.y + member.worldY }),
      { x: 0, y: 0 }
    );
    return {
      x: sum.x / best.members.length,
      y: sum.y / best.members.length
    };
  }

  /** 领域主循环：老化/跳伤害+续减速/到期移除；墨层逐帧对齐镜头，无存活领域时整层渐褪后销毁。 */
  private updateZones(deltaMs: number, targets: CombatTargetSnapshot[]): void {
    for (let index = this.zones.length - 1; index >= 0; index -= 1) {
      const zone = this.zones[index];
      zone.ageMs += deltaMs;
      zone.tickTimerMs -= deltaMs;
      // 每 tick 只遍历一次敌人列表；施放瞬间（tickTimerMs=0）立即跳第一次
      while (zone.tickTimerMs <= 0 && zone.ageMs <= zone.durationMs) {
        zone.tickTimerMs += zone.tickIntervalMs;
        this.tickZone(zone, targets);
      }
      // 毒泡 emitter 世界锚定：逐帧随镜头对齐领域中心（领域无视图对象，emitter 自承载位置）
      if (zone.poisonEmitter) {
        const { x, y } = this.worldToScreen(zone.worldX, zone.worldY);
        zone.poisonEmitter.setPosition(x, y);
      }

      if (zone.ageMs >= zone.durationMs) {
        zone.poisonEmitter?.destroy();
        zone.poisonEmitter = undefined;
        this.zones.splice(index, 1);
        eventBus.emit("skill_zone_expired", { zoneRuntimeId: zone.runtimeId });
      }
    }

    this.inkCrackHoldMs = Math.max(0, this.inkCrackHoldMs - deltaMs);
    if (!this.inkLayer) {
      return;
    }
    this.syncInkLayerPosition();
    // 持续渐隐：无论是否在施放，墨层都以低速率被擦除，防止连续施放时墨痕无限累积糊屏
    this.inkEraseTickMs += deltaMs;
    if (this.inkEraseTickMs >= INK_ERASE_INTERVAL_MS) {
      this.inkEraseTickMs = 0;
      this.eraseInkLayerPass();
    }
    // 领域清空且地面残痕驻留到期后整层渐隐销毁；驻留中保持原样（裂纹仍可见）
    if (this.zones.length === 0 && this.inkCrackHoldMs <= 0) {
      const nextAlpha = this.inkLayer.alpha - deltaMs / INK_LAYER_FADE_MS;
      if (nextAlpha <= 0) {
        this.inkLayer.destroy();
        this.inkLayer = undefined;
      } else {
        this.inkLayer.setAlpha(nextAlpha);
      }
    }
  }

  /** 用 destination-out 擦除做均匀慢渐隐：每 200ms 擦一次，墨痕约 3-4s 自然消隐。 */
  private eraseInkLayerPass(): void {
    if (!this.inkLayer) {
      return;
    }
    if (!this.scene.textures.exists(INK_ERASE_TEXTURE)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 8, 8);
      g.generateTexture(INK_ERASE_TEXTURE, 8, 8);
      g.destroy();
    }
    const scratch = this.inkEraseScratch ?? new Phaser.GameObjects.Image(this.scene, 0, 0, INK_ERASE_TEXTURE);
    this.inkEraseScratch = scratch;
    scratch
      .setPosition(0, 0)
      .setOrigin(0, 0)
      .setDisplaySize(this.inkLayer.width, this.inkLayer.height)
      .setAlpha(INK_ERASE_ALPHA);
    this.inkLayer.erase(scratch);
  }

  /**
   * 单次跳变：域内敌人走标准技能伤害流；存活敌人经 eventBus 桥接续减速（EnemyDirector 最小通道）。
   * 毒化「墨里淬毒」Lv3+：tick 命中同步桥接中毒（余毒 2 跳；进阶「金蛊江山」3 跳 + 蚀甲 ×1.1），
   * 与减速同走 enemy_*_requested 事件通道，GameScene 零改动。
   */
  private tickZone(zone: ZoneRuntime, targets: CombatTargetSnapshot[]): void {
    for (const target of targets) {
      if (Math.hypot(target.worldX - zone.worldX, target.worldY - zone.worldY) > zone.radius + target.collisionRadius) {
        continue;
      }

      const result = this.applySkillDamage(zone.skillId, target, zone.damage, {
        zoneRuntimeId: zone.runtimeId,
        source: zone.advanced ? "ink_zone_advanced" : "ink_zone",
        attackOriginWorld: { x: zone.worldX, y: zone.worldY }
      });
      if (isEnemyTarget(target)) {
        eventBus.emit("enemy_slow_requested", {
          runtimeId: target.runtimeId,
          factor: 1 - zone.slowPercent,
          durationMs: zone.tickIntervalMs + ZONE_SLOW_GRACE_MS,
          source: zone.skillId
        });
        // 毒化：仅确认命中的敌人中毒（伤害落地才算"被 tick 命中"）
        if (zone.level >= 3 && result?.damaged) {
          eventBus.emit(ENEMY_POISON_REQUESTED_EVENT, {
            runtimeId: target.runtimeId,
            ticks: zone.advanced ? ZONE_POISON_TICKS_ADVANCED : ZONE_POISON_TICKS_BASE,
            tickMs: ZONE_POISON_TICK_INTERVAL_MS,
            damage: zone.damage,
            amp: zone.advanced ? ZONE_POISON_AMP_ADVANCED : 1,
            source: zone.skillId
          });
        }
      }
    }
  }

  /** 共享墨层：懒创建/尺寸漂移重建；施放时 alpha 复位（渐褪中途新墨落地即恢复）。尺寸为设计单位（落墨坐标系），相机 zoom K 负责高清化。 */
  private ensureInkLayer(): Phaser.GameObjects.RenderTexture | undefined {
    const width = DESIGN_WIDTH;
    const height = DESIGN_HEIGHT;
    if (this.inkLayer && (this.inkLayer.width !== width || this.inkLayer.height !== height)) {
      this.inkLayer.destroy();
      this.inkLayer = undefined;
    }
    if (!this.inkLayer) {
      const heroWorld = this.options.getHeroWorld();
      const heroScreen = this.options.getHeroScreen();
      this.inkLayer = this.scene.add.renderTexture(0, 0, width, height)
        .setOrigin(0, 0)
        .setDepth(INK_LAYER_DEPTH);
      // 墨层像素 (0,0) 锚定的世界坐标：与 stageScroll 同一套 heroScreen + world - heroWorld 换算
      this.inkLayerWorldX = heroWorld.x - heroScreen.x;
      this.inkLayerWorldY = heroWorld.y - heroScreen.y;
    }
    this.inkLayer.setAlpha(0.95);
    this.syncInkLayerPosition();
    return this.inkLayer;
  }

  private syncInkLayerPosition(): void {
    if (!this.inkLayer) {
      return;
    }
    const { x, y } = this.worldToScreen(this.inkLayerWorldX, this.inkLayerWorldY);
    this.inkLayer.setPosition(x, y);
  }

  /**
   * 挥毫落墨：随机 1-2 张笔触以随机旋转/缩放 stamp 到共享墨层（世界坐标 → 墨层本地坐标）。
   * 纹理缺失时降级到程序化墨渍纹理；Lv3+ 墨缘淬毒绿韵 tint（泛青并入微量孔雀绿）、进阶芥金 tint
   * （乘算在深色墨上保持低饱和）。
   */
  private stampInkStrokes(zone: ZoneRuntime, strokeCount: number, level: number): void {
    const layer = this.ensureInkLayer();
    if (!layer) {
      return;
    }

    const artKeys = INK_STROKE_TEXTURES.filter((key) => this.scene.textures.exists(key));
    const fallbackKey = artKeys.length === 0 ? this.ensureInkFallbackTexture() : undefined;
    if (artKeys.length === 0 && !fallbackKey) {
      return;
    }

    const scratch = this.obtainInkScratch();
    const localX = zone.worldX - this.inkLayerWorldX;
    const localY = zone.worldY - this.inkLayerWorldY;
    const tint = zone.advanced ? INK_TINT_ADVANCED : level >= 3 ? INK_TINT_POISON_EDGE : 0xffffff;
    const count = Phaser.Math.Clamp(Math.floor(strokeCount), 1, 2);
    for (let index = 0; index < count; index += 1) {
      const textureKey = artKeys.length > 0 ? Phaser.Math.RND.pick(artKeys) : fallbackKey;
      if (!textureKey) {
        continue;
      }
      // 笔触 256×256 覆盖领域直径，随机伸缩让每片墨痕形态不重复；第二道相对第一道交叉 ~90°
      const scale = ((zone.radius * 2) / 256) * Phaser.Math.FloatBetween(0.95, 1.18);
      scratch.setTexture(textureKey);
      scratch.setPosition(
        localX + (index > 0 ? Phaser.Math.Between(-14, 14) : 0),
        localY + (index > 0 ? Phaser.Math.Between(-14, 14) : 0)
      );
      scratch.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2) + index * Math.PI / 2);
      scratch.setScale(scale);
      scratch.setAlpha(zone.advanced ? 0.96 : 0.92);
      // RenderTexture.draw 对 GameObject 使用其自身 alpha/tint（x/y 缺省取对象坐标），tint 需设在对象上
      scratch.setTint(tint);
      layer.draw(scratch);
    }
  }

  /** 程序化兜底墨渍：不规则深墨斑块，生成一次全局复用（防御笔触纹理未注册）。 */
  private ensureInkFallbackTexture(): string | undefined {
    if (this.scene.textures.exists(INK_FALLBACK_TEXTURE)) {
      return INK_FALLBACK_TEXTURE;
    }

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x1a1f1a, 0.9);
    graphics.fillEllipse(128, 128, 196, 172);
    graphics.fillEllipse(96, 108, 128, 96);
    graphics.fillEllipse(164, 150, 116, 104);
    graphics.fillStyle(0x111511, 0.85);
    graphics.fillEllipse(128, 128, 128, 112);
    graphics.fillEllipse(182, 96, 42, 30);
    graphics.fillEllipse(70, 168, 36, 26);
    graphics.generateTexture(INK_FALLBACK_TEXTURE, 256, 256);
    graphics.destroy();
    return this.scene.textures.exists(INK_FALLBACK_TEXTURE) ? INK_FALLBACK_TEXTURE : undefined;
  }

  private obtainInkScratch(): Phaser.GameObjects.Image {
    if (!this.inkScratch || !this.inkScratch.active) {
      this.inkScratch?.destroy();
      this.inkScratch = new Phaser.GameObjects.Image(this.scene, 0, 0, Phaser.Math.RND.pick(INK_STROKE_TEXTURES));
      this.inkScratch.setOrigin(0.5);
    }
    return this.inkScratch;
  }

  /**
   * 震山掌地面残痕：波首次命中/结束时在波中心把 vfx_ground_crack stamp 到共享地面墨层
   * （与墨染江山同一 ensureInkLayer；随机旋转 + 缩放抖动，alpha 0.55）。
   * 驻留 2.5s：inkCrackHoldMs 归零前墨层不渐隐；纹理缺失时走程序化裂纹兜底。
   */
  private stampGroundCrack(wave: WaveRuntime): void {
    const layer = this.ensureInkLayer();
    if (!layer) {
      return;
    }

    const textureKey = this.scene.textures.exists(GROUND_CRACK_TEXTURE)
      ? GROUND_CRACK_TEXTURE
      : this.ensureGroundCrackFallbackTexture();
    if (!textureKey) {
      return;
    }

    const scratch = this.obtainInkScratch();
    const textureSize = this.getTextureFrameWidth(textureKey, 192);
    scratch.setTexture(textureKey);
    scratch.setPosition(wave.worldX - this.inkLayerWorldX, wave.worldY - this.inkLayerWorldY);
    scratch.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    // 裂纹铺满波直径，±18% 缩放抖动避免千波一面；不上 tint（美术帧自带墨色/赭石）
    scratch.setScale(((wave.radius * 2) / textureSize) * Phaser.Math.FloatBetween(0.82, 1.18));
    scratch.setAlpha(GROUND_CRACK_ALPHA);
    scratch.clearTint();
    layer.draw(scratch);
    this.inkCrackHoldMs = GROUND_CRACK_HOLD_MS;
  }

  /** 程序化兜底裂纹：深色砸痕 + 放射状折线裂纹，生成一次全局复用（防御残痕纹理未注册）。 */
  private ensureGroundCrackFallbackTexture(): string | undefined {
    if (this.scene.textures.exists(GROUND_CRACK_FALLBACK_TEXTURE)) {
      return GROUND_CRACK_FALLBACK_TEXTURE;
    }

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x141814, 0.5);
    graphics.fillEllipse(96, 96, 88, 78);
    graphics.lineStyle(3, 0x111511, 0.9);
    for (let index = 0; index < 7; index += 1) {
      const angle = (Math.PI * 2 * index) / 7 + Phaser.Math.FloatBetween(-0.22, 0.22);
      graphics.beginPath();
      graphics.moveTo(96, 96);
      for (let segment = 1; segment <= 3; segment += 1) {
        const distance = 24 * segment + Phaser.Math.Between(-4, 8);
        const jittered = angle + Phaser.Math.FloatBetween(-0.3, 0.3);
        graphics.lineTo(96 + Math.cos(jittered) * distance, 96 + Math.sin(jittered) * distance);
      }
      graphics.strokePath();
    }
    graphics.generateTexture(GROUND_CRACK_FALLBACK_TEXTURE, 192, 192);
    graphics.destroy();
    return this.scene.textures.exists(GROUND_CRACK_FALLBACK_TEXTURE) ? GROUND_CRACK_FALLBACK_TEXTURE : undefined;
  }

  /** 读取纹理 0 号帧宽度（spritesheet 取首帧、单图取 __BASE），读取失败回退设计尺寸。 */
  private getTextureFrameWidth(textureKey: string, fallbackWidth: number): number {
    const texture = this.scene.textures.get(textureKey);
    const frame = texture?.get(0) ?? texture?.get("__BASE");
    const width = frame?.width;
    return typeof width === "number" && Number.isFinite(width) && width > 0 ? width : fallbackWidth;
  }

  /**
   * 施放瞬间墨迹迸发：vfx_ink_splat 序列帧（一次性动画播完销毁，沿用 bindOneShotDestroy 模式）；
   * 纹理缺失时降级为深色扩散环。baseScale 由 updateVfx 乘算，不被缩放曲线覆盖。
   */
  private createInkSplatVfx(zone: ZoneRuntime): void {
    const { x: screenX, y: screenY } = this.worldToScreen(zone.worldX, zone.worldY);
    if (this.scene.textures.exists(INK_SPLAT_TEXTURE)) {
      const baseScale = (zone.radius * 2.1) / 96;
      const view = this.scene.add.sprite(screenX, screenY, INK_SPLAT_TEXTURE)
        .setDepth(7)
        .setScale(baseScale)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      if (zone.advanced) {
        view.setTint(INK_TINT_ADVANCED);
      }
      view.setData("spriteArt", true);
      view.setData("baseScale", baseScale);
      const animationKey = getArtAnimationKey(INK_SPLAT_TEXTURE);
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
        this.bindOneShotDestroy(view);
      }
      this.vfx.push({ view, worldX: zone.worldX, worldY: zone.worldY, ageMs: 0, durationMs: 480, type: "hit" });
      return;
    }

    const fill = this.scene.add.circle(0, 0, zone.radius * 0.42, 0x1a1f1a, 0.4);
    const rim = this.scene.add.circle(0, 0, zone.radius * 0.42, 0x000000, 0)
      .setStrokeStyle(3, zone.advanced ? INK_TINT_ADVANCED : 0x1a1f1a, 0.8);
    const view = this.scene.add.container(screenX, screenY, [fill, rim])
      .setDepth(7);
    this.vfx.push({ view, worldX: zone.worldX, worldY: zone.worldY, ageMs: 0, durationMs: 300, type: "hit" });
  }

  /**
   * 墨点 hitSpark 替代（仅墨染江山）：JuiceSystem 程序化点纹理 tint 深墨/芥金，
   * NORMAL 混合小规模迸发，不走 ADD 亮色。emitter 一次性，自动延时销毁。
   */
  private createInkHitSpark(screenX: number, screenY: number, advanced: boolean): void {
    if (!this.scene.textures.exists(INK_HIT_DOT_TEXTURE)) {
      return;
    }
    const vfxScale = this.getVfxDensityScale();
    if (vfxScale <= 0) {
      return;
    }

    const emitter = this.scene.add.particles(screenX, screenY, INK_HIT_DOT_TEXTURE, {
      speed: { min: 18, max: 78 },
      lifespan: 300,
      scale: { start: 0.62, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: advanced ? [0xa99a20, 0x8a7d1c, 0x5c5416] : [0x1a1f1a, 0x2c332c, 0x111511],
      blendMode: Phaser.BlendModes.NORMAL,
      emitting: false
    });
    emitter.setDepth(18);
    // 降级③：命中粒子低档 ×0.6（40→24/s 同比例，4→2，保底 2 粒不删表现）
    emitter.explode(vfxScale < 1 ? 2 : 4);
    this.scene.time.delayedCall(600, () => {
      emitter.destroy();
    });
  }

  /**
   * 毒泡 emitter（Lv3+ 墨里淬毒）：领域存续期挂在 zone 上，约 120ms 一粒从墨面随机点冒泡，
   * 上升 ~12px 后淡出（lifespan 700ms、scale 0.6-1.0），随领域到期/系统销毁统一销毁。
   * 纹理：进阶优先 gold 版、其次基础版，均缺失走程序化兜底白泡 + tint（孔雀绿/金绿）；美术泡不上 tint。
   */
  private createPoisonBubbleEmitter(zone: ZoneRuntime): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
    if (zone.level < 3) {
      return undefined;
    }

    const fallbackTint = zone.advanced ? POISON_BUBBLE_GOLD_TINT : POISON_BUBBLE_TINT;
    let textureKey: string | undefined;
    if (zone.advanced && this.scene.textures.exists(POISON_BUBBLE_GOLD_TEXTURE)) {
      textureKey = POISON_BUBBLE_GOLD_TEXTURE;
    } else if (this.scene.textures.exists(POISON_BUBBLE_TEXTURE)) {
      textureKey = POISON_BUBBLE_TEXTURE;
    } else {
      textureKey = this.ensurePoisonBubbleFallbackTexture();
    }
    if (!textureKey) {
      return undefined;
    }

    const { x, y } = this.worldToScreen(zone.worldX, zone.worldY);
    const isFallback = textureKey === POISON_BUBBLE_FALLBACK_TEXTURE;
    // 美术泡为 4 帧序列（形成→鼓起→高光→破裂 @8fps，500ms 一轮贴合 700ms 寿命），挂粒子 anim 播放；
    // 兜底白泡单帧无动画，用 tint 上色。
    const bubbleAnimKey = getArtAnimationKey(textureKey);
    const useAnim = !isFallback && this.scene.anims.exists(bubbleAnimKey);
    // 领域表面随机点冒泡：emitZone 相对 emitter 位置，圆域取半径 78% 防贴边溢出墨面。
    // Phaser 类型里 Geom.Circle.getRandomPoint 泛型约束与 RandomZoneSourceCallback 不兼容，
    // 手写等价的圆域均匀采样（sqrt 保面积均匀，mutation 语义与 RandomZone 内部一致）。
    const bubbleRadius = Math.max(14, zone.radius * 0.78);
    const emitter = this.scene.add.particles(x, y, textureKey, {
      frequency: POISON_BUBBLE_FREQUENCY_MS,
      lifespan: POISON_BUBBLE_LIFESPAN_MS,
      // 上升 12px 后淡出：匀速上浮 ~15-22px/s，700ms 行程约 11-15px，alpha 同步渐隐
      speedY: { min: -22, max: -15 },
      speedX: { min: -5, max: 5 },
      scale: { min: 0.6, max: 1.0 },
      alpha: { start: 0.75, end: 0 },
      ...(useAnim ? { anim: bubbleAnimKey } : {}),
      emitZone: {
        type: "random",
        source: {
          getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * bubbleRadius;
            point.x = Math.cos(angle) * distance;
            point.y = Math.sin(angle) * distance;
          }
        }
      },
      ...(isFallback ? { tint: [fallbackTint, 0xffffff] } : {}),
      blendMode: Phaser.BlendModes.NORMAL
    });
    emitter.setDepth(POISON_BUBBLE_DEPTH);
    return emitter;
  }

  /** 程序化兜底毒泡：白芯 + 淡边圆泡（16×16），生成一次全局复用；由 emitter tint 上孔雀绿/金绿。 */
  private ensurePoisonBubbleFallbackTexture(): string | undefined {
    if (this.scene.textures.exists(POISON_BUBBLE_FALLBACK_TEXTURE)) {
      return POISON_BUBBLE_FALLBACK_TEXTURE;
    }

    const graphics = this.scene.add.graphics();
    graphics.lineStyle(1.5, 0xffffff, 0.85);
    graphics.strokeCircle(8, 8, 6);
    graphics.fillStyle(0xffffff, 0.55);
    graphics.fillCircle(8, 8, 4.2);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(6, 5.6, 1.3);
    graphics.generateTexture(POISON_BUBBLE_FALLBACK_TEXTURE, 16, 16);
    graphics.destroy();
    return this.scene.textures.exists(POISON_BUBBLE_FALLBACK_TEXTURE) ? POISON_BUBBLE_FALLBACK_TEXTURE : undefined;
  }

  // ---------- 烈火神掌 · 地火喷发（kind "wall"） ----------

  /**
   * 施放即推掌（方案一"掌劲引路，火径随行"）：敌人最密集方向（密度质心，复用 pickZoneCenter
   * 的单趟 O(n²) 邻域计数，≥4s 一次开销可忽略）定火径指向，火径起点即英雄位置——
   * vfx_fire_palm 掌形气劲拖残影约 300ms 飞至火径终点，到达瞬间震屏+轻白闪+地裂缝落地，
   * 火径段再自终点向英雄倒卷点亮；判定矩形 = 英雄沿指向偏移 墙长/2，长轴沿指向，
   * DoT 时长/判定/数值与现行 wall 完全一致。vfx_fire_palm 缺失时退回"出掌爆点+逐点火浪"
   * 兜底（火径正向点亮）。无有效目标时按英雄面向（getHeroFacing 可选注入）喷发，面向缺失回退正右。
   */
  private castWallSkillIfReady(runtime: SkillRuntime, targets: CombatTargetSnapshot[]): void {
    if (runtime.cooldownMs > 0 || this.walls.length >= MAX_WALLS) {
      return;
    }

    const profile = this.getWallProfile(runtime);
    const heroWorld = this.options.getHeroWorld();
    const placement = this.pickWallPlacement(targets, profile, heroWorld);
    const palmDriven = this.scene.textures.exists(FIRE_PALM_TEXTURE);
    const trail = this.createFireWallView(placement, profile, runtime.advanced, palmDriven);
    const wall: WallRuntime = {
      runtimeId: this.nextWallId,
      skillId: runtime.skillId,
      worldX: placement.x,
      worldY: placement.y,
      angleRad: placement.angleRad,
      length: profile.length,
      width: profile.width,
      damage: profile.damage,
      tickIntervalMs: profile.tickIntervalMs,
      tickTimerMs: trail.revealDoneMs,
      ageMs: 0,
      durationMs: profile.durationMs,
      level: runtime.level,
      advanced: runtime.advanced,
      burnTicks: profile.burnTicks,
      castX: heroWorld.x,
      castY: heroWorld.y,
      trailRevealDoneMs: trail.revealDoneMs,
      pendingBursts: palmDriven ? [] : this.buildFireWavePlan(heroWorld, placement.dirX, placement.dirY, profile),
      view: trail.view
    };
    this.nextWallId += 1;
    this.walls.push(wall);
    this.updateWorldAnchoredView(wall.view, wall.worldX, wall.worldY);
    if (palmDriven) {
      this.spawnFirePalm(wall, placement.dirX, placement.dirY);
    } else {
      // 兜底：出掌爆点 + 逐点火浪（旧推浪逻辑）
      this.createFireBurstVfx(wall);
    }
    runtime.cooldownMs = this.applyCooldownReduction(profile.cooldownMs);
    this.options.playSfx(runtime.advanced ? "skill_cast_advanced" : "skill_cast");
    eventBus.emit("skill_cast", {
      skillId: runtime.skillId,
      displayName: this.getRuntimeDisplayName(runtime),
      level: runtime.level,
      length: profile.length,
      width: profile.width,
      durationMs: profile.durationMs,
      advanced: runtime.advanced
    });
    eventBus.emit(SKILL_WALL_SPAWNED_EVENT, {
      wallRuntimeId: wall.runtimeId,
      skillId: runtime.skillId,
      level: runtime.level,
      worldX: wall.worldX,
      worldY: wall.worldY,
      angleRad: wall.angleRad,
      length: wall.length,
      width: wall.width,
      durationMs: wall.durationMs,
      advanced: wall.advanced
    });
  }

  /**
   * 选向定矩形：最密方向质心（限 range 内）只取指向；无目标/英雄已在质心处走英雄面向兜底，
   * 面向缺失回退正右。判定矩形中心 = 英雄 + 指向 × 墙长/2，长轴沿指向——
   * 火径起点即英雄，不再从密集点凭空出现。仅施放瞬间调用。
   */
  private pickWallPlacement(
    targets: CombatTargetSnapshot[],
    profile: ReturnType<SkillSystem["getWallProfile"]>,
    heroWorld: Point
  ): { x: number; y: number; angleRad: number; dirX: number; dirY: number } {
    let dir: Point | undefined;
    // 邻域半径取半墙长：聚类口径与火径覆盖面一致，指向敌人最密的一簇
    const center = this.pickZoneCenter(targets, Math.max(48, profile.length / 2), profile.range);
    if (center) {
      const dirX = center.x - heroWorld.x;
      const dirY = center.y - heroWorld.y;
      const distance = Math.hypot(dirX, dirY);
      if (distance > 1) {
        dir = { x: dirX / distance, y: dirY / distance };
      }
    }

    if (!dir) {
      const facing = this.options.getHeroFacing?.();
      const facingLength = facing ? Math.hypot(facing.x, facing.y) : 0;
      dir = facing && facingLength > 0.05
        ? { x: facing.x / facingLength, y: facing.y / facingLength }
        : { x: 1, y: 0 };
    }

    return {
      x: heroWorld.x + dir.x * (profile.length / 2),
      y: heroWorld.y + dir.y * (profile.length / 2),
      // 长轴沿指向：火径从英雄脚下推向目标方向（地火喷发，不再横置）
      angleRad: Math.atan2(dir.y, dir.x),
      dirX: dir.x,
      dirY: dir.y
    };
  }

  /**
   * 火浪推进计划：从施放点沿指向每 40-50px 一个火点（数量钳 5-7），间隔 = 300ms/数量
   * ≈ 43-60ms 错峰喷发，形成"火从英雄推出去"的动态线；火点缩放 = 墙宽基准 × 0.8-1.0 随机。
   * 纯数据计划随墙销毁，不挂定时器，无泄漏面。
   */
  private buildFireWavePlan(
    heroWorld: Point,
    dirX: number,
    dirY: number,
    profile: ReturnType<SkillSystem["getWallProfile"]>
  ): FireWaveBurstPlan[] {
    const count = Phaser.Math.Clamp(
      Math.round(profile.length / FIRE_WAVE_POINT_SPACING_PX),
      FIRE_WAVE_MIN_POINTS,
      FIRE_WAVE_MAX_POINTS
    );
    const spacing = profile.length / count;
    const staggerMs = FIRE_WAVE_DURATION_MS / count;
    const baseScale = (profile.width * 2.4) / this.getTextureFrameWidth(FIRE_WALL_BURST_TEXTURE, 96);
    const plan: FireWaveBurstPlan[] = [];
    for (let index = 0; index < count; index += 1) {
      const distance = spacing * (index + 0.5);
      plan.push({
        // 出掌爆点占住 t=0，首个火点延后一个 stagger，推浪感更清晰
        atMs: (index + 1) * staggerMs,
        worldX: heroWorld.x + dirX * distance,
        worldY: heroWorld.y + dirY * distance,
        scale: baseScale * Phaser.Math.FloatBetween(FIRE_WAVE_POINT_SCALE_MIN, FIRE_WAVE_POINT_SCALE_MAX)
      });
    }
    return plan;
  }

  /**
   * 掌形气劲起飞：vfx_fire_palm 主掌（约 88px，按飞行方向 setRotation + 途中轻微摆动）
   * + 2-3 个残影副本（k 越大越淡越大，ADD 混合，先创建垫在主掌下）；进阶金焰 tint。
   * 飞行/落地由 updateFirePalms 推进，全部对象随 SkillSystem 销毁。
   */
  private spawnFirePalm(wall: WallRuntime, dirX: number, dirY: number): void {
    const { x: screenX, y: screenY } = this.worldToScreen(wall.castX, wall.castY);
    const frameWidth = this.getTextureFrameWidth(FIRE_PALM_TEXTURE, 256);
    const baseScale = FIRE_PALM_DISPLAY_SIZE / frameWidth;
    const angle = Math.atan2(dirY, dirX);
    const ghosts: Phaser.GameObjects.Sprite[] = [];
    for (let k = FIRE_PALM_GHOST_COUNT; k >= 1; k -= 1) {
      // k 越大越淡（0.38/0.26/0.14）越大（×1.18/1.36/1.54）
      const ghostAlpha = FIRE_PALM_GHOST_ALPHA_STEP - (k - 1) * 0.12;
      const ghostScale = baseScale * (1 + k * FIRE_PALM_GHOST_SCALE_STEP);
      const ghost = this.scene.add.sprite(screenX, screenY, FIRE_PALM_TEXTURE)
        .setDepth(FIRE_PALM_DEPTH)
        .setRotation(angle)
        .setScale(ghostScale)
        .setAlpha(ghostAlpha)
        .setBlendMode(Phaser.BlendModes.ADD);
      if (wall.advanced) {
        ghost.setTint(0xffe6a3);
      }
      ghost.setData("baseAlpha", ghostAlpha);
      ghost.setData("baseScale", ghostScale);
      ghosts.push(ghost);
    }
    // ghosts 当前顺序 [k3, k2, k1]（先淡后浓），翻转为 [k1, k2, k3] 便于按下标取间距
    ghosts.reverse();
    const view = this.scene.add.sprite(screenX, screenY, FIRE_PALM_TEXTURE)
      .setDepth(FIRE_PALM_DEPTH)
      .setRotation(angle)
      .setScale(baseScale)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (wall.advanced) {
      view.setTint(0xffe6a3);
    }
    view.setData("baseScale", baseScale);
    this.firePalms.push({
      wallRuntimeId: wall.runtimeId,
      startX: wall.castX,
      startY: wall.castY,
      dirX,
      dirY,
      totalDist: wall.length,
      angle,
      ageMs: 0,
      durationMs: FIRE_PALM_FLIGHT_MS,
      landed: false,
      advanced: wall.advanced,
      view,
      ghosts
    });
  }

  /**
   * 掌形气劲主循环：Cubic.Out 飞行（世界锚定对齐镜头 + 摆动），残影沿已飞行路径拖尾
   * （k×22px 之后，钳制不越过起点）；到达终点即落地（震屏+轻白闪，裂缝由火径 reveal 同步落地），
   * 随后 140ms 内掌与残影原地放大消散并销毁。
   */
  private updateFirePalms(deltaMs: number): void {
    for (let index = this.firePalms.length - 1; index >= 0; index -= 1) {
      const palm = this.firePalms[index];
      palm.ageMs += deltaMs;
      const flyProgress = Phaser.Math.Clamp(palm.ageMs / palm.durationMs, 0, 1);
      const eased = 1 - Math.pow(1 - flyProgress, 3);
      const traveled = palm.totalDist * eased;
      const worldX = palm.startX + palm.dirX * traveled;
      const worldY = palm.startY + palm.dirY * traveled;
      const { x: screenX, y: screenY } = this.worldToScreen(worldX, worldY);
      palm.view.setPosition(screenX, screenY);
      // 轻微摆动：气劲飞行不僵硬（落地后停止摆动，定住压向地面）
      if (!palm.landed) {
        palm.view.setRotation(palm.angle + Math.sin(palm.ageMs * FIRE_PALM_WOBBLE_FREQ) * FIRE_PALM_WOBBLE_RAD);
      }
      for (let k = 0; k < palm.ghosts.length; k += 1) {
        const ghostDist = Math.max(0, traveled - (k + 1) * FIRE_PALM_GHOST_SPACING_PX);
        const ghostScreen = this.worldToScreen(palm.startX + palm.dirX * ghostDist, palm.startY + palm.dirY * ghostDist);
        const ghost = palm.ghosts[k];
        ghost.setPosition(ghostScreen.x, ghostScreen.y);
        ghost.setRotation(palm.view.rotation);
      }

      if (!palm.landed && palm.ageMs >= palm.durationMs) {
        this.landFirePalm(palm);
      }

      if (palm.landed) {
        // 原地消散：掌与残影按各自 baseAlpha/baseScale 快速淡出并微放大（残影 k 越大越淡越大）
        const fade = Phaser.Math.Clamp(1 - (palm.ageMs - palm.durationMs) / FIRE_PALM_LAND_FADE_MS, 0, 1);
        palm.view.setAlpha(fade);
        palm.view.setScale(getNumericData(palm.view, "baseScale", 1) * (1 + (1 - fade) * 0.2));
        for (const ghost of palm.ghosts) {
          ghost.setAlpha(getNumericData(ghost, "baseAlpha", 1) * fade);
          ghost.setScale(getNumericData(ghost, "baseScale", 1) * (1 + (1 - fade) * 0.3));
        }
        if (fade <= 0) {
          palm.view.destroy();
          for (const ghost of palm.ghosts) {
            ghost.destroy();
          }
          this.firePalms.splice(index, 1);
        }
      }
    }
  }

  /**
   * 掌到达终点砸地：震屏（JuiceSystem.heavyHit）+ 120ms 轻白暖闪；
   * 墙已提前销毁（场景切换等）则跳过反馈仅消散。地裂缝/火径倒卷由墙 reveal 时间轴同步触发。
   */
  private landFirePalm(palm: FirePalmRuntime): void {
    palm.landed = true;
    const wallAlive = this.walls.some((entry) => entry.runtimeId === palm.wallRuntimeId);
    if (!wallAlive) {
      return;
    }
    JuiceSystem.get(this.scene).heavyHit();
    this.scene.cameras.main.flash(120, 255, 230, 190);
  }

  /**
   * 地火喷发主循环：老化/跳伤害（每 tick 只遍历一次敌人列表，施放瞬间立即跳第一次）/
   * 火浪推进兜底（计划表到点喷发火点）/火径段与裂缝按 reveal 时间轴点亮/世界锚定对齐镜头/
   * 淡入淡出/到期销毁。灼烧由 updateBurns 独立推进。
   */
  private updateWalls(deltaMs: number, targets: CombatTargetSnapshot[]): void {
    for (let index = this.walls.length - 1; index >= 0; index -= 1) {
      const wall = this.walls[index];
      wall.ageMs += deltaMs;
      wall.tickTimerMs -= deltaMs;
      while (wall.tickTimerMs <= 0 && wall.ageMs <= wall.durationMs) {
        wall.tickTimerMs += wall.tickIntervalMs;
        this.tickWall(wall, targets);
      }
      // 火浪推进：计划表 atMs 升序，到点喷发（施放后 300ms 内错峰完成，喷完即空）
      while (wall.pendingBursts.length > 0 && wall.pendingBursts[0].atMs <= wall.ageMs) {
        const burst = wall.pendingBursts.shift();
        if (burst) {
          this.spawnFireWaveBurst(wall, burst);
        }
      }
      this.updateFireTrailReveal(wall);
      this.updateWorldAnchoredView(wall.view, wall.worldX, wall.worldY);
      // 淡入 160ms 即燃、熄灭前 420ms 渐隐
      const fadeIn = Phaser.Math.Clamp(wall.ageMs / FIRE_WALL_FADE_IN_MS, 0, 1);
      const fadeOut = Phaser.Math.Clamp((wall.durationMs - wall.ageMs) / FIRE_WALL_FADE_OUT_MS, 0, 1);
      wall.view.setAlpha(Math.min(fadeIn, fadeOut) * FIRE_WALL_MAX_ALPHA);

      if (wall.ageMs >= wall.durationMs) {
        wall.view.destroy();
        this.walls.splice(index, 1);
      }
    }
  }

  /**
   * 推浪火点：vfx_fire_burst 一次性序列帧（播完销毁，沿用 bindOneShotDestroy 模式），
   * ADD 透亮小规模迸发、最后一帧随 updateVfx 淡散；纹理缺失退化为金红扩散环（程序化推浪版）。
   */
  private spawnFireWaveBurst(wall: WallRuntime, burst: FireWaveBurstPlan): void {
    const { x: screenX, y: screenY } = this.worldToScreen(burst.worldX, burst.worldY);
    if (this.scene.textures.exists(FIRE_WALL_BURST_TEXTURE)) {
      const view = this.scene.add.sprite(screenX, screenY, FIRE_WALL_BURST_TEXTURE)
        .setDepth(FIRE_WALL_BURST_DEPTH)
        .setScale(burst.scale)
        .setBlendMode(Phaser.BlendModes.ADD);
      if (wall.advanced) {
        view.setTint(0xffe6a3);
      }
      view.setData("spriteArt", true);
      view.setData("baseScale", burst.scale);
      const animationKey = getArtAnimationKey(FIRE_WALL_BURST_TEXTURE);
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
        this.bindOneShotDestroy(view);
      }
      this.vfx.push({ view, worldX: burst.worldX, worldY: burst.worldY, ageMs: 0, durationMs: 360, type: "hit" });
      return;
    }

    // 程序化兜底火点：金红扩散小环，与出掌爆点同风格、尺寸随缩放计划收敛
    const radius = Math.max(10, wall.width * 0.7 * burst.scale);
    const fill = this.scene.add.circle(0, 0, radius, wall.advanced ? 0xff8a3d : 0xff6b3d, 0.4);
    const rim = this.scene.add.circle(0, 0, radius, 0x000000, 0)
      .setStrokeStyle(2, wall.advanced ? 0xffe6a3 : 0xffd27a, 0.85);
    const view = this.scene.add.container(screenX, screenY, [fill, rim])
      .setDepth(FIRE_WALL_BURST_DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.vfx.push({ view, worldX: burst.worldX, worldY: burst.worldY, ageMs: 0, durationMs: 280, type: "hit" });
  }

  /**
   * 火径段/裂缝按 reveal 时间轴点亮：段与焰心创建时写入 revealAtMs（掌劲路径 = 飞行 300ms 后
   * 自终点向英雄每 60ms 倒卷一段；兜底路径 = 按轴向位置正向等比映射 300ms 推浪期），
   * ageMs 越过 revealAtMs 后在各自 revealFadeMs 内亮起至 baseAlpha；全部点亮后短路零开销。
   */
  private updateFireTrailReveal(wall: WallRuntime): void {
    if (wall.ageMs > wall.trailRevealDoneMs) {
      return;
    }
    for (const child of wall.view.list) {
      const revealAtMs = getNumericData(child, "revealAtMs", 0);
      const revealFadeMs = getNumericData(child, "revealFadeMs", FIRE_TRAIL_REVEAL_FADE_MS);
      const baseAlpha = getNumericData(child, "baseAlpha", 1);
      const lit = Phaser.Math.Clamp((wall.ageMs - revealAtMs) / revealFadeMs, 0, 1);
      (child as Phaser.GameObjects.Sprite | Phaser.GameObjects.Shape).setAlpha(lit * baseAlpha);
    }
  }

  /**
   * 单次跳变：旋转矩形命中（目标世界坐标变换到墙本地系，半长/半宽 + 碰撞半径容差），
   * 命中走标准技能伤害流；确认命中的敌人点燃灼烧（仅敌人，与毒/减速同约定不伤 Boss）。
   */
  private tickWall(wall: WallRuntime, targets: CombatTargetSnapshot[]): void {
    const cos = Math.cos(-wall.angleRad);
    const sin = Math.sin(-wall.angleRad);
    const halfLength = wall.length / 2;
    const halfWidth = wall.width / 2;
    for (const target of targets) {
      const dx = target.worldX - wall.worldX;
      const dy = target.worldY - wall.worldY;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      if (Math.abs(localX) > halfLength + target.collisionRadius || Math.abs(localY) > halfWidth + target.collisionRadius) {
        continue;
      }

      const result = this.applySkillDamage(wall.skillId, target, wall.damage, {
        wallRuntimeId: wall.runtimeId,
        source: wall.advanced ? "fire_wall_advanced" : "fire_wall",
        attackOriginWorld: { x: wall.worldX, y: wall.worldY }
      });
      // 灼烧：仅确认命中的敌人才被点燃；重复命中刷新延迟（最后一次命中 2s 后再跳）
      if (result?.damaged && isEnemyTarget(target)) {
        this.igniteBurn(target.runtimeId, wall);
      }
    }
  }

  private igniteBurn(runtimeId: number, wall: WallRuntime): void {
    this.burnStates.set(runtimeId, {
      skillId: wall.skillId,
      ticksRemaining: wall.burnTicks,
      nextTickInMs: FIRE_WALL_BURN_DELAY_MS,
      damage: wall.damage,
      advanced: wall.advanced,
      attackOriginWorld: { x: wall.worldX, y: wall.worldY }
    });
  }

  /**
   * 灼烧推进：计时到点跳一跳金红火伤（crit 芥金档飘字，与毒绿档区分）；
   * 目标死亡/离场（damageTarget 未确认命中）即清除，跳数耗尽即熄灭。
   */
  private updateBurns(deltaMs: number): void {
    for (const [runtimeId, burn] of this.burnStates) {
      burn.nextTickInMs -= deltaMs;
      if (burn.nextTickInMs > 0) {
        continue;
      }

      const result = this.applySkillDamageById(burn.skillId, runtimeId, burn.damage, {
        source: burn.advanced ? "fire_wall_burn_advanced" : "fire_wall_burn",
        damageKind: "crit",
        attackOriginWorld: burn.attackOriginWorld
      });
      if (!result?.damaged) {
        this.burnStates.delete(runtimeId);
        continue;
      }

      burn.ticksRemaining -= 1;
      if (burn.ticksRemaining <= 0) {
        this.burnStates.delete(runtimeId);
      } else {
        burn.nextTickInMs = FIRE_WALL_BURN_TICK_INTERVAL_MS;
      }
    }
  }

  /**
   * 火径留守视图：vfx_fire_wall 段贴图沿长轴（施放指向，起点即英雄）拼接——段放大 1.5×
   * （墙厚 36-48 → 54-72）、相邻段重叠 50% 消除缝隙；主体 NORMAL 混合（禁止整墙 ADD：
   * 水墨底上发灰发粉），每段中心一枚同贴图小 copy 作 ADD 焰心提亮（alpha 0.35）；
   * 各段随机相位播 4 帧跳动循环（段与焰心同相位），初始 alpha 0 按 reveal 时间轴点亮——
   * 掌劲路径：飞行 300ms 后自终点向英雄每 60ms 倒卷一段（火柱倒卷），并在终点预埋
   * vfx_fire_crack 地裂缝（裁中心 116×116 区，尺寸 1.3×墙宽，掌到达即 120ms 淡入）；
   * 兜底路径：按轴向位置正向等比映射 300ms 推浪期。纹理缺失走程序化兜底。进阶金焰 tint 暖金。
   * 返回视图与全部点亮截止时刻（revealDoneMs，供 updateFireTrailReveal 短路）。
   */
  private createFireWallView(
    placement: { x: number; y: number; angleRad: number },
    profile: ReturnType<SkillSystem["getWallProfile"]>,
    advanced: boolean,
    palmDriven: boolean
  ): { view: Phaser.GameObjects.Container; revealDoneMs: number } {
    const { x: screenX, y: screenY } = this.worldToScreen(placement.x, placement.y);
    if (!this.scene.textures.exists(FIRE_WALL_SEGMENT_TEXTURE)) {
      return this.createFireWallFallbackView(screenX, screenY, placement.angleRad, profile, advanced, palmDriven);
    }

    const texture = this.scene.textures.get(FIRE_WALL_SEGMENT_TEXTURE);
    const frame = texture?.get(0) ?? texture?.get("__BASE");
    const frameWidth = frame && frame.width > 0 ? frame.width : FIRE_WALL_SEGMENT_FALLBACK_SIZE;
    const frameHeight = frame && frame.height > 0 ? frame.height : FIRE_WALL_SEGMENT_FALLBACK_SIZE;
    // 段显示高 = 墙宽 × 1.5（火径更厚）；段宽 = 帧宽 × 同比例
    const scale = (profile.width * FIRE_TRAIL_SEGMENT_SCALE) / frameHeight;
    const segmentDisplayWidth = Math.max(10, frameWidth * scale);
    // 50% 重叠：段距 = 段宽一半，消除缝隙连成整条火径
    const count = Math.max(2, Math.ceil(profile.length / (segmentDisplayWidth * (1 - FIRE_TRAIL_SEGMENT_OVERLAP))));
    const spacing = profile.length / count;
    const segmentWidth = spacing / (1 - FIRE_TRAIL_SEGMENT_OVERLAP);
    const trailHeight = profile.width * FIRE_TRAIL_SEGMENT_SCALE;
    // 点亮时刻：掌劲路径 = 掌到达（300ms）后自终点（index 大端）向英雄每 60ms 倒卷一段；
    // 兜底路径 = 正向等比映射 300ms 推浪期
    const revealAtFor = (index: number): number => palmDriven
      ? FIRE_PALM_FLIGHT_MS + (count - 1 - index) * FIRE_TRAIL_REVERSE_INTERVAL_MS
      : ((index + 0.5) / count) * FIRE_WAVE_DURATION_MS;
    const revealDoneMs = palmDriven
      ? FIRE_PALM_FLIGHT_MS + (count - 1) * FIRE_TRAIL_REVERSE_INTERVAL_MS + FIRE_TRAIL_REVEAL_FADE_MS
      : FIRE_WAVE_DURATION_MS + FIRE_TRAIL_REVEAL_FADE_MS;
    const animationKey = getArtAnimationKey(FIRE_WALL_SEGMENT_TEXTURE);
    const hasAnimation = this.scene.anims.exists(animationKey);
    const children: Phaser.GameObjects.Sprite[] = [];

    // 终点地裂缝（掌劲路径且贴图在）：裁中心 116×116 区（外圈淡晕不可用），尺寸 1.3×墙宽，
    // 掌到达时刻 120ms 淡入；作为首个子对象垫在火焰段之下，随火径一起淡出销毁
    if (palmDriven && this.scene.textures.exists(FIRE_CRACK_TEXTURE)) {
      const crack = this.scene.add.sprite(profile.length / 2, 0, FIRE_CRACK_TEXTURE)
        .setCrop(FIRE_CRACK_CROP_X, FIRE_CRACK_CROP_Y, FIRE_CRACK_CROP_SIZE, FIRE_CRACK_CROP_SIZE)
        .setScale((profile.width * FIRE_CRACK_SIZE_RATIO) / FIRE_CRACK_CROP_SIZE)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      if (advanced) {
        crack.setTint(0xffe6a3);
      }
      crack.setData("revealAtMs", FIRE_PALM_FLIGHT_MS);
      crack.setData("revealFadeMs", FIRE_CRACK_FADE_IN_MS);
      crack.setData("baseAlpha", FIRE_CRACK_ALPHA);
      children.push(crack);
    }

    for (let index = 0; index < count; index += 1) {
      const offsetX = -profile.length / 2 + spacing * (index + 0.5);
      const revealAtMs = revealAtFor(index);
      const phase = Phaser.Math.FloatBetween(0, 1);
      const segment = this.scene.add.sprite(offsetX, 0, FIRE_WALL_SEGMENT_TEXTURE)
        .setDisplaySize(segmentWidth, trailHeight)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setAlpha(0);
      if (advanced) {
        // 金焰：暖金 tint 乘算在橙红火焰上，不过曝
        segment.setTint(0xffe6a3);
      }
      if (hasAnimation) {
        segment.play(animationKey);
        // 随机相位：拼接段不同步闪烁，火径整体呈流动感
        segment.anims.setProgress(phase);
      }
      segment.setData("spriteArt", true);
      segment.setData("revealAtMs", revealAtMs);
      segment.setData("baseAlpha", FIRE_TRAIL_SEGMENT_ALPHA);
      children.push(segment);

      // 焰心：段中心同贴图小 copy，ADD 混合小面积提亮（整墙只有这里允许 ADD）
      const core = this.scene.add.sprite(offsetX, 0, FIRE_WALL_SEGMENT_TEXTURE)
        .setDisplaySize(segmentWidth * FIRE_TRAIL_CORE_SCALE, trailHeight * FIRE_TRAIL_CORE_SCALE)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      if (advanced) {
        core.setTint(0xffe6a3);
      }
      if (hasAnimation) {
        core.play(animationKey);
        // 与主体段同相位：焰心贴在火苗亮部上，不脱节
        core.anims.setProgress(phase);
      }
      core.setData("spriteArt", true);
      core.setData("revealAtMs", revealAtMs);
      core.setData("baseAlpha", FIRE_TRAIL_CORE_ALPHA);
      children.push(core);
    }

    return {
      view: this.scene.add.container(screenX, screenY, children)
        .setDepth(FIRE_WALL_DEPTH)
        .setRotation(placement.angleRad),
      revealDoneMs
    };
  }

  /**
   * 程序化兜底火径：沿长轴交错排布的金红火圈段（外焰橙红 NORMAL 大圈 + 内芯亮金 ADD 小圈），
   * 与贴图版同一套 reveal 时间轴（掌劲路径倒卷 / 兜底路径正向）；初始 alpha 0，随墙销毁。
   */
  private createFireWallFallbackView(
    screenX: number,
    screenY: number,
    angleRad: number,
    profile: ReturnType<SkillSystem["getWallProfile"]>,
    advanced: boolean,
    palmDriven: boolean
  ): { view: Phaser.GameObjects.Container; revealDoneMs: number } {
    const count = Math.max(4, Math.ceil(profile.length / (profile.width * 0.9)));
    const spacing = profile.length / count;
    const children: Phaser.GameObjects.Arc[] = [];
    for (let index = 0; index < count; index += 1) {
      const offsetX = -profile.length / 2 + spacing * (index + 0.5);
      const revealAtMs = palmDriven
        ? FIRE_PALM_FLIGHT_MS + (count - 1 - index) * FIRE_TRAIL_REVERSE_INTERVAL_MS
        : ((index + 0.5) / count) * FIRE_WAVE_DURATION_MS;
      const outer = this.scene.add.circle(offsetX, 0, profile.width * 0.72, advanced ? 0xff8a3d : 0xff6b3d, 0.5)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setAlpha(0);
      outer.setData("revealAtMs", revealAtMs);
      outer.setData("baseAlpha", 1);
      children.push(outer);
      const core = this.scene.add.circle(offsetX, 0, profile.width * 0.34, advanced ? 0xfff1c4 : 0xffd27a, 0.55)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      core.setData("revealAtMs", revealAtMs);
      core.setData("baseAlpha", 1);
      children.push(core);
    }
    const revealDoneMs = palmDriven
      ? FIRE_PALM_FLIGHT_MS + (count - 1) * FIRE_TRAIL_REVERSE_INTERVAL_MS + FIRE_TRAIL_REVEAL_FADE_MS
      : FIRE_WAVE_DURATION_MS + FIRE_TRAIL_REVEAL_FADE_MS;
    return {
      view: this.scene.add.container(screenX, screenY, children)
        .setDepth(FIRE_WALL_DEPTH)
        .setRotation(angleRad),
      revealDoneMs
    };
  }

  /**
   * 出掌爆点（仅 vfx_fire_palm 缺失的兜底路径使用）：英雄身前一枚稍大的 vfx_fire_burst
   * 一次性序列帧（墙宽基准 ×1.2），标志"出掌"瞬间、推浪由此出发；播完销毁（沿用
   * bindOneShotDestroy 模式），局部效果不做全屏反馈。纹理缺失退化为金红扩散环。
   */
  private createFireBurstVfx(wall: WallRuntime): void {
    const { x: screenX, y: screenY } = this.worldToScreen(wall.castX, wall.castY);
    if (this.scene.textures.exists(FIRE_WALL_BURST_TEXTURE)) {
      const baseScale = ((wall.width * 2.4) / this.getTextureFrameWidth(FIRE_WALL_BURST_TEXTURE, 96)) * FIRE_CAST_BURST_SCALE;
      const view = this.scene.add.sprite(screenX, screenY, FIRE_WALL_BURST_TEXTURE)
        .setDepth(FIRE_WALL_BURST_DEPTH)
        .setScale(baseScale)
        .setBlendMode(Phaser.BlendModes.ADD);
      if (wall.advanced) {
        view.setTint(0xffe6a3);
      }
      view.setData("spriteArt", true);
      view.setData("baseScale", baseScale);
      const animationKey = getArtAnimationKey(FIRE_WALL_BURST_TEXTURE);
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
        this.bindOneShotDestroy(view);
      }
      this.vfx.push({ view, worldX: wall.castX, worldY: wall.castY, ageMs: 0, durationMs: 360, type: "hit" });
      return;
    }

    const fill = this.scene.add.circle(0, 0, wall.width * 0.9, wall.advanced ? 0xff8a3d : 0xff6b3d, 0.4);
    const rim = this.scene.add.circle(0, 0, wall.width * 0.9, 0x000000, 0)
      .setStrokeStyle(3, wall.advanced ? 0xffe6a3 : 0xffd27a, 0.85);
    const view = this.scene.add.container(screenX, screenY, [fill, rim])
      .setDepth(FIRE_WALL_BURST_DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.vfx.push({ view, worldX: wall.castX, worldY: wall.castY, ageMs: 0, durationMs: 280, type: "hit" });
  }

  /**
   * 火墙命中小火花（仅烈火神掌）：JuiceSystem 程序化星点 tint 金红，ADD 混合小规模迸发。
   * emitter 一次性，自动延时销毁；低 VFX 档与墨点同比例降级（4→2）。
   */
  private createFireHitSpark(screenX: number, screenY: number, advanced: boolean): void {
    if (!this.scene.textures.exists(TRAIL_TEXTURE)) {
      return;
    }
    const vfxScale = this.getVfxDensityScale();
    if (vfxScale <= 0) {
      return;
    }

    const emitter = this.scene.add.particles(screenX, screenY, TRAIL_TEXTURE, {
      speed: { min: 26, max: 110 },
      lifespan: 260,
      scale: { start: 0.66, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: advanced ? [0xffe6a3, 0xffc36b, 0xff8a4a] : [0xffd27a, 0xff9a4a, 0xff5f2e],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    });
    emitter.setDepth(18);
    emitter.explode(vfxScale < 1 ? 2 : 4);
    this.scene.time.delayedCall(600, () => {
      emitter.destroy();
    });
  }

  private updateProjectiles(deltaMs: number, targetGrid: CombatTargetGrid): void {
    const deltaSeconds = deltaMs / 1000;
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      const step = projectile.speed * deltaSeconds;
      const previousX = projectile.worldX;
      const previousY = projectile.worldY;
      projectile.worldX += projectile.directionX * step;
      projectile.worldY += projectile.directionY * step;
      projectile.distanceTraveled += step;
      this.updateProjectileScreenPosition(projectile);

      if (this.tryHitEnemyWithProjectile(projectile, targetGrid, previousX, previousY)) {
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
      this.spawnDartGhostIfReady(orbital, deltaMs);
    }

    // 轨道虚线点环：跟随英雄（轨道圆心），显示半径随当前配置
    if (this.orbitRing && this.orbitRing.active) {
      this.updateWorldAnchoredView(this.orbitRing, heroWorld.x, heroWorld.y);
      this.orbitRing.setScale((profile.radius * 2) / ORBIT_RING_TEXTURE_SIZE);
    }
  }

  private updateWaves(deltaMs: number, targets: CombatTargetSnapshot[]): void {
    const heroWorld = this.options.getHeroWorld();
    for (let index = this.waves.length - 1; index >= 0; index -= 1) {
      const wave = this.waves[index];
      wave.ageMs += deltaMs;
      const progress = Phaser.Math.Clamp(wave.ageMs / wave.durationMs, 0, 1);
      const currentRadius = wave.radius * (0.32 + progress * 0.68);
      // 序列帧版本：扩散/渐隐由 3 帧动画承载，跳过手动插值；纹理/动画缺失时走兜底曲线
      const frameAnimated = wave.view.getData("waveFrames") === true;
      if (!frameAnimated) {
        const baseScale = getNumericData(wave.view, "baseScale", 1);
        wave.view.setScale(baseScale * (0.32 + progress * 0.88));
        wave.view.setAlpha(Math.max(0, 0.62 * (1 - progress)));
      }
      this.updateWorldAnchoredView(wave.view, wave.worldX, wave.worldY);
      this.tryHitEnemiesWithWave(wave, currentRadius, heroWorld, targets);

      // 地面残痕：首次命中即裂；整波未命中则波结束时落地一裂（每波仅 stamp 一次）
      if (!wave.crackStamped && (wave.hitEnemyIds.size > 0 || wave.ageMs >= wave.durationMs)) {
        wave.crackStamped = true;
        this.stampGroundCrack(wave);
      }

      if (wave.ageMs >= wave.durationMs) {
        wave.view.destroy();
        this.waves.splice(index, 1);
      }
    }
  }

  private tryHitEnemyWithProjectile(
    projectile: ProjectileRuntime,
    targetGrid: CombatTargetGrid,
    previousX: number,
    previousY: number
  ): boolean {
    const targets = targetGrid.querySegment(
      previousX,
      previousY,
      projectile.worldX,
      projectile.worldY,
      projectile.radius
    );
    for (const target of targets) {
      if (projectile.hitEnemyIds.has(target.runtimeId)) {
        continue;
      }

      const hitDistance = target.collisionRadius + projectile.radius;
      if (!segmentIntersectsCircle(
        previousX,
        previousY,
        projectile.worldX,
        projectile.worldY,
        target.worldX,
        target.worldY,
        hitDistance
      )) {
        continue;
      }

      const result = this.applySkillDamage(projectile.skillId, target, projectile.damage, {
        projectileRuntimeId: projectile.runtimeId,
        source: projectile.advanced ? "advanced_projectile" : "projectile",
        attackOriginWorld: { x: projectile.worldX, y: projectile.worldY }
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
        source: "orbit",
        attackOriginWorld: { x: worldX, y: worldY }
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
        knockback: wave.knockback,
        attackOriginWorld: { x: wave.worldX, y: wave.worldY }
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
    return this.applySkillDamageById(skillId, target.runtimeId, damage, metadata);
  }

  /**
   * 标准技能伤害流（按 runtimeId）：烈火神掌灼烧等无目标快照的延迟伤害同走本入口。
   * metadata.damageKind 可强制飘字档位（灼烧固定 crit 金红档，与毒绿档区分）。
   */
  private applySkillDamageById(
    skillId: SkillId,
    runtimeId: number,
    damage: number,
    metadata: Record<string, unknown>
  ): CombatDamageResult | undefined {
    const origin = metadata.attackOriginWorld;
    const attackOriginWorld = isPoint(origin) ? origin : undefined;
    const result = this.options.damageTarget(runtimeId, damage, skillId, attackOriginWorld);
    if (!result?.damaged) {
      return undefined;
    }

    this.hitSamples.push({ ageMs: 0, damage: result.amount });
    // 打击感反馈：命中火花 + 伤害飘字分层
    // 档位：Boss 橙 / 精英击杀朱砂弹跳 / 暴击芥金弹跳（进阶技能或伤害≥配置期望 2 倍）/ 普通白字
    const juice = JuiceSystem.get(this.scene);
    const isBossTarget = isBossDamageResult(result);
    const runtime = this.skills.get(skillId);
    const expectedDamage = runtime ? this.getExpectedSkillDamage(runtime) : 0;
    const isCrit = expectedDamage > 0 && result.amount >= expectedDamage * CRIT_DAMAGE_RATIO;
    const isEliteKill = !isBossTarget && result.killed && enemyConfigs[result.enemyId]?.tier === "elite";
    const forcedDamageKind = typeof metadata.damageKind === "string" ? (metadata.damageKind as DamageKind) : undefined;
    const damageKind: DamageKind = isBossTarget
      ? "boss"
      : forcedDamageKind ?? (isEliteKill
        ? "elite"
        : runtime?.advanced || isCrit
          ? "crit"
          : "normal");
    const isInkZoneHit = metadata.source === "ink_zone" || metadata.source === "ink_zone_advanced";
    const isFireWallHit = metadata.source === "fire_wall" || metadata.source === "fire_wall_advanced"
      || metadata.source === "fire_wall_burn" || metadata.source === "fire_wall_burn_advanced";
    if (isInkZoneHit) {
      // 墨染江山：小规模深色墨点替代亮色 hitSpark
      this.createInkHitSpark(result.screenX, result.screenY, runtime?.advanced === true);
    } else if (isFireWallHit) {
      // 烈火神掌：金红小火花替代亮色 hitSpark
      this.createFireHitSpark(result.screenX, result.screenY, runtime?.advanced === true);
    } else {
      juice.hitSpark(result.screenX, result.screenY, isBossTarget);
    }
    juice.damageNumber(
      result.screenX,
      result.screenY,
      result.amount,
      damageKind
    );
    if (!isInkZoneHit && !isFireWallHit) {
      // 亮色 ADD 命中闪光与墨韵/烈焰威胁语义冲突，墨染江山与烈火神掌不触发
      this.createHitVfx(result.worldX, result.worldY);
    }
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
        orbital.trailEmitter?.destroy();
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
      orbital.trailEmitter?.destroy();
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
        view,
        trailEmitter: this.createTrailEmitter(view, runtime.advanced),
        ghostCooldownMs: 0
      };
      this.nextOrbitalId += 1;
      this.orbitals.push(orbital);
    }
    this.syncHuifengOrbitRing();
  }

  /**
   * 回风飞镖轨道虚线点环：全部飞镖同圆心同半径，共享一条即可承载表现
   * （逐镖各挂一条会原位叠加，0.14×N 叠出违背"细环"意图的有效透明度），
   * 生命周期挂在 orbitals 重建流程上（等价每个飞镖都挂有轨道线）。金色细环：基础 0.14 / 进阶 0.22。
   */
  private syncHuifengOrbitRing(): void {
    const hasOrbitals = this.orbitals.some((orbital) => orbital.skillId === "huifeng_dart");
    if (!hasOrbitals) {
      this.orbitRing?.destroy();
      this.orbitRing = undefined;
      return;
    }

    const runtime = this.skills.get("huifeng_dart");
    if (!runtime) {
      return;
    }
    if (!this.orbitRing || !this.orbitRing.active) {
      const textureKey = this.ensureOrbitRingTexture();
      if (!textureKey) {
        return;
      }
      this.orbitRing = this.scene.add.sprite(0, 0, textureKey)
        .setDepth(ORBIT_RING_DEPTH)
        .setBlendMode(Phaser.BlendModes.NORMAL);
    }
    this.orbitRing.setAlpha(runtime.advanced ? ORBIT_RING_ALPHA_ADVANCED : ORBIT_RING_ALPHA_BASE);
  }

  /** 程序化轨道点环：芥金细点沿圆周均布成虚线圈（256×256，点环半径 120），生成一次全局复用。 */
  private ensureOrbitRingTexture(): string | undefined {
    if (this.scene.textures.exists(HUIFENG_ORBIT_RING_TEXTURE)) {
      return HUIFENG_ORBIT_RING_TEXTURE;
    }

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xd8c76a, 1);
    const dotCount = 42;
    for (let index = 0; index < dotCount; index += 1) {
      const angle = (Math.PI * 2 * index) / dotCount;
      graphics.fillCircle(128 + Math.cos(angle) * 120, 128 + Math.sin(angle) * 120, 2);
    }
    graphics.generateTexture(HUIFENG_ORBIT_RING_TEXTURE, ORBIT_RING_TEXTURE_SIZE, ORBIT_RING_TEXTURE_SIZE);
    graphics.destroy();
    return this.scene.textures.exists(HUIFENG_ORBIT_RING_TEXTURE) ? HUIFENG_ORBIT_RING_TEXTURE : undefined;
  }

  private destroyProjectile(index: number): void {
    const [projectile] = this.projectiles.splice(index, 1);
    projectile.trailEmitter?.destroy();
    projectile.view.destroy();
  }

  /** 投射物拖尾：emitter 跟随弹体，进阶版金色尾焰；随弹体销毁，防泄漏。
   * 低 VFX 降级⑤：拖尾仅进阶版保留（"off" 全关）；保留的进阶拖尾频率/长度减半（30→60ms、200→100ms）。 */
  private createTrailEmitter(
    view: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite,
    advanced: boolean
  ): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
    if (!this.scene.textures.exists(TRAIL_TEXTURE)) {
      return undefined;
    }
    const vfxScale = this.getVfxDensityScale();
    if (vfxScale <= 0 || (vfxScale < 1 && !advanced)) {
      return undefined;
    }
    const degraded = vfxScale < 1;
    const emitter = this.scene.add.particles(0, 0, TRAIL_TEXTURE, {
      follow: view,
      frequency: degraded ? 60 : 30,
      lifespan: degraded ? 100 : 200,
      speed: { min: 8, max: 26 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: advanced ? [0xf6d472, 0xd8c76a, 0xfff3c4] : [0x9fe8ff, 0x39d6b5, 0xe9fffb],
      blendMode: Phaser.BlendModes.ADD
    });
    emitter.setDepth(13);
    return emitter;
  }

  /** 回风镖残影：每 70ms 叠一层 alpha 渐隐残影 sprite（约 2-3 层同屏），240ms 后销毁。
   * 低 VFX 降级⑤：残影仅进阶版保留（"off" 全关）；进阶残影间隔 70→140ms。 */
  private spawnDartGhostIfReady(orbital: OrbitalRuntime, deltaMs: number): void {
    orbital.ghostCooldownMs = Math.max(0, orbital.ghostCooldownMs - deltaMs);
    if (orbital.ghostCooldownMs > 0 || this.dartGhosts.length >= MAX_DART_GHOSTS) {
      return;
    }
    const vfxScale = this.getVfxDensityScale();
    if (vfxScale <= 0 || (vfxScale < 1 && !orbital.advanced)) {
      return;
    }
    if (!(orbital.view instanceof Phaser.GameObjects.Sprite) || orbital.view.getData("spriteArt") !== true) {
      return;
    }

    orbital.ghostCooldownMs = vfxScale < 1 ? DART_GHOST_INTERVAL_MS * 2 : DART_GHOST_INTERVAL_MS;
    const view = orbital.view;
    const ghost = this.scene.add.sprite(view.x, view.y, view.texture.key)
      .setDepth(14)
      .setAlpha(0.3)
      .setRotation(view.rotation)
      .setScale(view.scaleX, view.scaleY)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.dartGhosts.push(ghost);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.6,
      duration: 240,
      ease: "Quad.easeOut",
      onComplete: () => {
        const ghostIndex = this.dartGhosts.indexOf(ghost);
        if (ghostIndex >= 0) {
          this.dartGhosts.splice(ghostIndex, 1);
        }
        if (ghost.active) {
          ghost.destroy();
        }
      }
    });
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

  /**
   * 墨染江山数值形态：基础形态全部读 data/skills.ts 配置；
   * 进阶「金墨江山」——每跳伤害 +4、冷却 3300、半径 +50%、减速 50%（Lv5 之上再放大）。
   */
  private getZoneProfile(runtime: SkillRuntime): {
    damage: number;
    cooldownMs: number;
    range: number;
    radius: number;
    durationMs: number;
    tickIntervalMs: number;
    slowPercent: number;
    strokeCount: number;
  } {
    const level = this.getLevelConfig(runtime);
    return {
      damage: runtime.advanced ? level.damage + 4 : level.damage,
      cooldownMs: runtime.advanced ? 3300 : (level.cooldownMs ?? 4500),
      range: level.range ?? 640,
      radius: runtime.advanced ? Math.round((level.radius ?? 90) * 1.5) : (level.radius ?? 90),
      durationMs: level.durationMs ?? 3500,
      tickIntervalMs: level.tickIntervalMs ?? 500,
      slowPercent: runtime.advanced ? 0.5 : (level.slowPercent ?? 0.3),
      strokeCount: level.strokeCount ?? 1
    };
  }

  /**
   * 烈火神掌数值形态：基础形态全部读 data/skills.ts 配置；
   * 进阶「金焰神掌」——每跳伤害 ×1.5、墙长 ×1.5、墙宽 ×1.4、灼烧 2 跳（冷却不变）。
   */
  private getWallProfile(runtime: SkillRuntime): {
    damage: number;
    cooldownMs: number;
    range: number;
    length: number;
    width: number;
    durationMs: number;
    tickIntervalMs: number;
    burnTicks: number;
  } {
    const level = this.getLevelConfig(runtime);
    return {
      damage: runtime.advanced ? Math.round(level.damage * 1.5) : level.damage,
      cooldownMs: level.cooldownMs ?? 5000,
      range: level.range ?? 560,
      length: runtime.advanced ? Math.round((level.wallLength ?? 200) * 1.5) : (level.wallLength ?? 200),
      width: runtime.advanced ? Math.round((level.wallWidth ?? 36) * 1.4) : (level.wallWidth ?? 36),
      durationMs: level.durationMs ?? 3000,
      tickIntervalMs: level.tickIntervalMs ?? 400,
      burnTicks: runtime.advanced ? FIRE_WALL_BURN_TICKS_ADVANCED : FIRE_WALL_BURN_TICKS_BASE
    };
  }

  private getCooldownMs(runtime: SkillRuntime): number {
    if (skillConfigs[runtime.skillId].kind === "projectile") {
      return this.applyCooldownReduction(this.getProjectileProfile(runtime).cooldownMs);
    }
    if (skillConfigs[runtime.skillId].kind === "aoe") {
      return this.applyCooldownReduction(this.getWaveProfile(runtime).cooldownMs);
    }
    if (skillConfigs[runtime.skillId].kind === "zone") {
      return this.applyCooldownReduction(this.getZoneProfile(runtime).cooldownMs);
    }
    if (skillConfigs[runtime.skillId].kind === "wall") {
      return this.applyCooldownReduction(this.getWallProfile(runtime).cooldownMs);
    }
    return 0;
  }

  private applyCooldownReduction(cooldownMs: number): number {
    return Math.max(100, Math.round(cooldownMs * (1 - this.cooldownReductionRatio)));
  }

  /** 该技能当前等级/进阶状态下的配置期望伤害，作为暴击阈值基准（均值 2 倍判暴击）。 */
  private getExpectedSkillDamage(runtime: SkillRuntime): number {
    const kind = skillConfigs[runtime.skillId].kind;
    if (kind === "projectile") {
      return this.getProjectileProfile(runtime).damage;
    }
    if (kind === "orbit") {
      return this.getOrbitProfile(runtime).damage;
    }
    if (kind === "aoe") {
      return this.getWaveProfile(runtime).damage;
    }
    if (kind === "zone") {
      return this.getZoneProfile(runtime).damage;
    }
    if (kind === "wall") {
      return this.getWallProfile(runtime).damage;
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
        .setRotation(Math.atan2(direction.y, direction.x));
      const animationKey = getArtAnimationKey("skill_yulong_advanced_projectile");
      if (this.scene.anims.exists(animationKey)) {
        view.play(animationKey);
      }
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
      // 素材 2 倍化适配：清单帧尺寸 ×2 后显示缩放 ÷2（设计显示尺寸 40/48，按实际帧宽推算，旧素材自适应为 1）
      const designWidth = advanced ? 48 : 40;
      const displayScale = designWidth / this.getTextureFrameWidth(artKey, designWidth);
      const view = this.scene.add.sprite(0, 0, artKey)
        .setDepth(15)
        .setOrigin(0.5)
        .setScale(displayScale)
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
      // 帧宽以实际 0 号帧为准（清单升级 3 帧序列后单帧宽不变、整图变宽，防御混合状态）
      const textureWidth = this.getTextureFrameWidth(artKey, advanced ? 384 : 256);
      const baseScale = (radius * 2) / textureWidth;
      const view = this.scene.add.sprite(0, 0, artKey)
        .setDepth(12)
        .setOrigin(0.5)
        .setAlpha(advanced ? 0.92 : 0.88);
      // 墨环为深色主体，必须用 NORMAL 混合；ADD 下深墨几乎不可见
      view.setData("spriteArt", true);
      view.setData("baseScale", baseScale);
      const animationKey = getArtAnimationKey(artKey);
      if (this.scene.anims.exists(animationKey)) {
        // 3 帧序列（12fps loop:false，进阶版金色帧）：出手一次播完停末帧，命中窗随波寿命持续到统一销毁
        view.setScale(baseScale);
        view.play(animationKey);
        view.setData("waveFrames", true);
      } else {
        // 动画未注册（旧单帧清单过渡态）：退回手动 scale/alpha 插值
        view.setScale(baseScale * 0.32);
      }
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
        this.bindOneShotDestroy(view);
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
        this.bindOneShotDestroy(view);
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
      }).setOrigin(0.5).setResolution(2);
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
    }).setOrigin(0.5).setResolution(2);
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

  /** 一次性动画（loop:false）播完即从 vfx 列表移除并销毁；updateVfx 的 alpha 硬切保留作兜底。 */
  private bindOneShotDestroy(view: Phaser.GameObjects.Sprite): void {
    view.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      const vfxIndex = this.vfx.findIndex((entry) => entry.view === view);
      if (vfxIndex >= 0) {
        this.vfx.splice(vfxIndex, 1);
      }
      if (view.active) {
        view.destroy();
      }
    });
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
      // baseScale：art 尺寸换算基数（墨迹迸发等需要 >1 的基础缩放），缺省 1 不影响既有 vfx
      vfx.view.setScale(getNumericData(vfx.view, "baseScale", 1) * scale);

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
    if (keyId === "pine_soot_inkstick") {
      return "松烟墨锭";
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

  /**
   * 防御性读取 VFX 密度档（与 GameScene.getVfxDensityScale 同语义，settings 热更即时生效）：
   * vfxDensity === "off" → 0（全关）；vfxDensity "low" / lowVfxMode → 0.5；缺省 1。
   * 低 VFX 降级只换参数不删功能（docs/29-character-drop-vfx-art-spec.md:430-436）。
   */
  private getVfxDensityScale(): number {
    const saveData = this.scene.registry.get("saveData") as
      | { settings?: { lowVfxMode?: boolean; vfxDensity?: string } }
      | undefined;
    const settings = saveData?.settings;
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

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") {
    return false;
  }
  const point = value as Partial<Point>;
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/**
 * Per-frame broad phase for fast projectiles. At the 180-enemy desktop cap,
 * a 60px projectile step now checks the few adjacent 128px cells instead of
 * scanning every target for every projectile.
 */
class CombatTargetGrid {
  private static readonly CELL_SIZE = 128;
  private readonly cells = new Map<string, CombatTargetSnapshot[]>();
  private maxRadius = 0;

  constructor(targets: CombatTargetSnapshot[]) {
    for (const target of targets) {
      this.maxRadius = Math.max(this.maxRadius, target.collisionRadius);
      const key = this.keyFor(target.worldX, target.worldY);
      const cell = this.cells.get(key) ?? [];
      cell.push(target);
      this.cells.set(key, cell);
    }
  }

  querySegment(startX: number, startY: number, endX: number, endY: number, radius: number): CombatTargetSnapshot[] {
    const padding = Math.max(0, radius) + this.maxRadius;
    const minCellX = Math.floor((Math.min(startX, endX) - padding) / CombatTargetGrid.CELL_SIZE);
    const maxCellX = Math.floor((Math.max(startX, endX) + padding) / CombatTargetGrid.CELL_SIZE);
    const minCellY = Math.floor((Math.min(startY, endY) - padding) / CombatTargetGrid.CELL_SIZE);
    const maxCellY = Math.floor((Math.max(startY, endY) + padding) / CombatTargetGrid.CELL_SIZE);
    const candidates: CombatTargetSnapshot[] = [];
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        candidates.push(...(this.cells.get(`${cellX}:${cellY}`) ?? []));
      }
    }
    return candidates;
  }

  private keyFor(worldX: number, worldY: number): string {
    return `${Math.floor(worldX / CombatTargetGrid.CELL_SIZE)}:${Math.floor(worldY / CombatTargetGrid.CELL_SIZE)}`;
  }
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
