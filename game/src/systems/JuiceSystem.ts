import Phaser from "phaser";
import { DESIGN_WIDTH, RESOLUTION_SCALE } from "../ui/designSize";
import { PALETTE, FONT_MONO } from "../ui/visualConstants";

/**
 * JuiceSystem —— 全局打击感/氛围特效系统。
 *
 * 统一提供：粒子（命中火花/击杀碎屑/拾取闪光/金屑爆发/环境落叶）、
 * 伤害飘字（对象池）、相机反馈（震屏/闪白/推拉）。
 *
 * 用法：`JuiceSystem.get(scene).hitSpark(x, y)`。
 * 每个 Scene 一个实例，懒创建；粒子纹理用 graphics 程序化生成，零美术依赖。
 * 低 VFX 模式下粒子数量按文档降级表 ×0.6（命中 40→24、击杀 30→18）、飘字合并抑制。
 */

export type DamageKind = "normal" | "crit" | "elite" | "boss" | "heal" | "gold" | "poison";

const TEX = {
  dot: "juice_dot",
  spark: "juice_spark",
  leaf: "juice_leaf"
} as const;

/**
 * 伤害数字分层：普通白字 / 暴击芥金 / 精英击杀朱砂 / Boss 橙 / 掉落金色 / 中毒孔雀绿。
 * bounce=true 的档位出场放大 1.4 倍，Back.easeOut 先大后小弹跳回稳。
 */
const DAMAGE_STYLE: Record<
  DamageKind,
  { color: string; fontSize: number; stroke: string; scale: number; bounce?: boolean }
> = {
  normal: { color: "#f4f3ec", fontSize: 15, stroke: "#101010", scale: 1 },
  crit: { color: PALETTE.accentGoldCss, fontSize: 20, stroke: "#101010", scale: 1.15, bounce: true },
  elite: { color: PALETTE.cinnabarCss, fontSize: 18, stroke: "#101010", scale: 1.15, bounce: true },
  boss: { color: "#ff9a3d", fontSize: 17, stroke: "#101010", scale: 1.1 },
  heal: { color: PALETTE.hpCss, fontSize: 15, stroke: "#101010", scale: 1 },
  gold: { color: "#f6d472", fontSize: 15, stroke: "#101010", scale: 1 },
  // 墨染江山·余毒跳字：孔雀绿 #3fae8a（墨里淬毒专属档位，低 VFX 下保留）
  poison: { color: "#3fae8a", fontSize: 15, stroke: "#101010", scale: 1 }
};

/** 弹跳档位的出场放大倍数（scale 1.4 → 回稳） */
const DAMAGE_BOUNCE_POP_SCALE = 1.4;

export class JuiceSystem {
  private static instances = new WeakMap<Phaser.Scene, JuiceSystem>();

  /** 每个场景的单例入口。 */
  static get(scene: Phaser.Scene): JuiceSystem {
    let inst = JuiceSystem.instances.get(scene);
    if (!inst) {
      inst = new JuiceSystem(scene);
      JuiceSystem.instances.set(scene, inst);
    }
    return inst;
  }

  private readonly scene: Phaser.Scene;
  private lowVfx = false;
  private damagePool: Phaser.GameObjects.Text[] = [];
  private ambientEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ensureTextures();
    // 场景重启/关闭时清空飘字池与环境粒子，避免持有已销毁对象
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopAmbient();
      for (const t of this.damagePool) {
        if (t.scene) {
          t.destroy();
        }
      }
      this.damagePool = [];
      // QA-001a：注销实例。once 监听器已消费，Scene 对象重启复用后
      // JuiceSystem.get 必须返回全新实例，避免旧实例残留已销毁的引用。
      JuiceSystem.instances.delete(scene);
    });
  }

  setLowVfx(low: boolean): void {
    this.lowVfx = low;
    if (low) {
      this.stopAmbient();
    }
  }

  // ---------- 相机反馈 ----------

  /** 英雄受击：短促轻震。 */
  heroHurt(): void {
    this.scene.cameras.main.shake(120, 0.004 * this.getShakeScale());
  }

  /** 重击/震山波级震屏。 */
  heavyHit(): void {
    this.scene.cameras.main.shake(200, 0.006 * this.getShakeScale());
  }

  /** Boss 死亡：强震 + 暖白闪。 */
  bossDeath(): void {
    const cam = this.scene.cameras.main;
    cam.shake(400, 0.01 * this.getShakeScale());
    cam.flash(180, 255, 240, 200);
  }

  /** 升级/顿悟：淡金闪 + 轻微推拉（推拉基准为当前高清渲染缩放 K，不可写死 1）。 */
  levelUp(): void {
    const cam = this.scene.cameras.main;
    cam.flash(200, 246, 212, 114);
    const baseZoom = RESOLUTION_SCALE;
    cam.zoomTo(baseZoom * 1.04, 300, Phaser.Math.Easing.Cubic.Out, true, (
      _cam,
      progress
    ) => {
      if (progress === 1) {
        cam.zoomTo(baseZoom, 260, Phaser.Math.Easing.Cubic.InOut);
      }
    });
  }

  /** 稀有度揭示闪（抽卡）：按稀有度色闪屏。 */
  rarityFlash(rarity: string): void {
    const c = PALETTE.rarityInt[rarity] ?? 0xffffff;
    const r = (c >> 16) & 0xff;
    const g = (c >> 8) & 0xff;
    const b = c & 0xff;
    this.scene.cameras.main.flash(220, r, g, b);
    if (rarity === "elite" || rarity === "epic") {
      this.scene.cameras.main.shake(120, 0.004);
    }
  }

  /** 短暂顿帧（hit stop 低配版）：仅精英击杀/Boss 招式命中用。 */
  hitStop(ms = 80): void {
    this.scene.tweens.timeScale = 0.15;
    this.scene.time.delayedCall(ms, () => {
      this.scene.tweens.timeScale = 1;
    });
  }

  // ---------- 粒子 ----------

  /** 命中火花：小爆发，ADD 混合。 */
  hitSpark(x: number, y: number, big = false): void {
    this.burst(x, y, {
      texture: TEX.spark,
      count: this.q(big ? 12 : 7),
      speed: { min: 60, max: big ? 220 : 160 },
      lifespan: big ? 320 : 240,
      scale: { start: big ? 1.1 : 0.8, end: 0 },
      tint: [0xfff3c4, 0xf6d472, 0xffffff]
    });
  }

  /** 击杀碎屑：尘烟感，可按敌人 tint 着色。 */
  killBurst(x: number, y: number, tint = 0xd8cdb4): void {
    this.burst(x, y, {
      texture: TEX.dot,
      count: this.q(14),
      speed: { min: 40, max: 180 },
      lifespan: 420,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [tint, 0x8a8578, 0x5c584e],
      blendMode: Phaser.BlendModes.NORMAL
    });
    this.burst(x, y, {
      texture: TEX.spark,
      count: this.q(5),
      speed: { min: 90, max: 240 },
      lifespan: 260,
      scale: { start: 0.9, end: 0 },
      tint: 0xfff3c4
    });
  }

  /** 拾取收集闪光：小型金青迸发。 */
  pickupSparkle(x: number, y: number): void {
    this.burst(x, y, {
      texture: TEX.spark,
      count: this.q(6),
      speed: { min: 30, max: 110 },
      lifespan: 260,
      scale: { start: 0.7, end: 0 },
      tint: [0x9fe8ff, 0xf6d472, 0xffffff]
    });
  }

  /** 金屑爆发：进阶/稀有揭示/保底庆祝。 */
  goldBurst(x: number, y: number, count = 24): void {
    this.burst(x, y, {
      texture: TEX.spark,
      count: this.q(count),
      speed: { min: 80, max: 320 },
      lifespan: 520,
      scale: { start: 1.2, end: 0 },
      tint: [0xf6d472, 0xa99a20, 0xfff3c4],
      gravityY: 220
    });
  }

  /** 环境落叶/飞尘：全屏常驻氛围层，scrollFactor 0。 */
  startAmbient(tintGroup?: number[]): void {
    if (this.ambientEmitter || this.isLowVfx()) {
      return;
    }
    const width = DESIGN_WIDTH;
    this.ambientEmitter = this.scene.add.particles(0, -12, TEX.leaf, {
      x: { min: -20, max: width + 20 },
      lifespan: 7000,
      speedY: { min: 12, max: 28 },
      speedX: { min: -14, max: 6 },
      rotate: { min: 0, max: 360 },
      scale: { min: 0.5, max: 1.0 },
      alpha: { start: 0.55, end: 0 },
      frequency: 420,
      tint: tintGroup ?? [0x9aa583, 0x7d9b76, 0xb8b3a4],
      blendMode: Phaser.BlendModes.NORMAL
    });
    this.ambientEmitter.setScrollFactor(0);
    this.ambientEmitter.setDepth(-15);
  }

  /** 切换落叶配色（如换地图）：销毁后按新 tint 重建。 */
  retintAmbient(tintGroup: number[]): void {
    if (!this.ambientEmitter) {
      return;
    }
    this.stopAmbient();
    this.startAmbient(tintGroup);
  }

  stopAmbient(): void {
    this.ambientEmitter?.destroy();
    this.ambientEmitter = null;
  }

  // ---------- 伤害飘字 ----------

  damageNumber(
    x: number,
    y: number,
    amount: number | string,
    kind: DamageKind = "normal"
  ): void {
    // 飘字总开关（设置项缺省视为开启，防御性读取）
    if (this.readSettings()?.damageNumbers === false) {
      return;
    }
    if (this.isLowVfx() && kind === "normal") {
      return; // 低 VFX 模式只保留高价值飘字（降级①：仅暴击/精英/Boss/收益类）
    }
    const style = DAMAGE_STYLE[kind];
    const label = this.obtainText(style);
    const popScale = style.bounce ? style.scale * DAMAGE_BOUNCE_POP_SCALE : style.scale * 1.2;
    label
      .setText(String(amount))
      .setPosition(x + Phaser.Math.Between(-8, 8), y - 10)
      .setAlpha(1)
      .setScale(popScale)
      .setDepth(95)
      .setActive(true)
      .setVisible(true);
    this.scene.tweens.killTweensOf(label);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 26,
      alpha: 0,
      scale: style.scale,
      duration: style.bounce ? 560 : 480,
      // 暴击/精英击杀：Back.easeOut 先大后小弹跳；其余二次渐出
      ease: style.bounce ? "Back.easeOut" : Phaser.Math.Easing.Quadratic.Out,
      onComplete: () => {
        label.setActive(false).setVisible(false);
      }
    });
  }

  // ---------- 内部 ----------

  /**
   * 防御性读取全局设置（audioSystem 注册项可能缺失、字段可能未上线）。
   * 新表现层设置项（shakeScale/damageNumbers）由设置界面批次补齐，缺省不报错。
   */
  private readSettings(): Record<string, unknown> | undefined {
    const holder = this.scene.registry.get("audioSystem") as
      | { getSettings?: () => unknown }
      | undefined;
    return holder?.getSettings?.() as Record<string, unknown> | undefined;
  }

  /** 震屏强度系数：设置项 shakeScale，缺省 1。 */
  private getShakeScale(): number {
    const value = this.readSettings()?.shakeScale;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 1;
  }

  private q(n: number): number {
    // 降级③：低档粒子数按文档降级表统一 ×0.6（命中 40→24/s、击杀 30→18/s 同比例），保底 2。
    // 依据 docs/28-p0-fallback-ui-background-spec.md:366-372、docs/29-character-drop-vfx-art-spec.md:430-436
    return this.isLowVfx() ? Math.max(2, Math.round(n * 0.6)) : n;
  }

  /**
   * 低 VFX 判定：setLowVfx 显式档（GameScene 初始化调用）+ 设置热更兜底
   * （audioSystem.getSettings 防御性读取，设置页切"低特效"经 settings_changed 即时生效）。
   */
  private isLowVfx(): boolean {
    return this.lowVfx || this.readSettings()?.lowVfxMode === true;
  }

  private burst(
    x: number,
    y: number,
    cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig & {
      texture: string;
      count: number;
    }
  ): void {
    const { texture, count, ...rest } = cfg;
    const emitter = this.scene.add.particles(x, y, texture, {
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
      ...rest
    });
    emitter.setDepth(80);
    emitter.explode(count);
    this.scene.time.delayedCall(900, () => emitter.destroy());
  }

  private obtainText(
    style: (typeof DAMAGE_STYLE)[DamageKind]
  ): Phaser.GameObjects.Text {
    // QA-001b：复用前校验对象完好；任何残留路径留下的已销毁/纹理失效对象
    // 一律剔除并新建，杜绝对已销毁 Text 调用 setColor/setFontSize 导致的崩溃。
    for (let i = 0; i < this.damagePool.length; i += 1) {
      const pooled = this.damagePool[i];
      if (pooled.active) {
        continue;
      }
      if (!this.isTextIntact(pooled)) {
        this.damagePool.splice(i, 1);
        i -= 1;
        continue;
      }
      pooled.setColor(style.color).setFontSize(style.fontSize);
      return pooled;
    }
    const t = this.scene.add
      .text(0, 0, "", {
        fontFamily: FONT_MONO,
        fontSize: `${style.fontSize}px`,
        color: style.color,
        fontStyle: "bold"
      })
      .setStroke(style.stroke, 3)
      .setOrigin(0.5)
      .setResolution(2)
      .setActive(false)
      .setVisible(false);
    if (this.damagePool.length < 48) {
      this.damagePool.push(t);
    }
    return t;
  }

  /** 飘字对象完好性：未销毁（scene 仍在）且 canvas 纹理源仍可用。 */
  private isTextIntact(t: Phaser.GameObjects.Text): boolean {
    if (!t.scene) {
      return false;
    }
    const source = t.texture?.source?.[0];
    const image = source?.image as HTMLCanvasElement | undefined;
    return Boolean(image && typeof image.getContext === "function");
  }

  private ensureTextures(): void {
    const textures = this.scene.textures;
    if (!textures.exists(TEX.dot)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 7);
      g.generateTexture(TEX.dot, 16, 16);
      g.destroy();
    }
    if (!textures.exists(TEX.spark)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      // 四角星
      g.beginPath();
      g.moveTo(8, 0);
      g.lineTo(10, 6);
      g.lineTo(16, 8);
      g.lineTo(10, 10);
      g.lineTo(8, 16);
      g.lineTo(6, 10);
      g.lineTo(0, 8);
      g.lineTo(6, 6);
      g.closePath();
      g.fillPath();
      g.generateTexture(TEX.spark, 16, 16);
      g.destroy();
    }
    if (!textures.exists(TEX.leaf)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(6, 4, 10, 6);
      g.generateTexture(TEX.leaf, 12, 8);
      g.destroy();
    }
  }
}
