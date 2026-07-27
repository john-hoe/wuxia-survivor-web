import Phaser from "phaser";
import { JuiceSystem } from "../systems/JuiceSystem";
import { saveSystem } from "../systems/SaveSystem";
import type { SaveData } from "../types";
import {
  addMinimalBackdrop,
  addMinimalBackRow,
  addMinimalMenuRow,
  addMinimalTitle
} from "../ui/minimalTheme";
import { fadeIn, FONT_BODY, FONT_MONO, FONT_TITLE, PALETTE, transitionTo } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem, getSaveData, setSaveData } from "../utils/registry";
import { SCENE_KEYS } from "./sceneKeys";

/**
 * 经脉武学 · 局外成长（原型 d-growth）。
 * 中央简笔人体经络剪影 + 三条经络（任督→体魄/冲脉→轻功/带脉→磁石），
 * 穴位三态（已通玉色 / 可冲芥金脉动 / 未达灰空心），点击穴位右侧浮出墨签购买。
 * 数据只读 SaveData.metaUpgrades，购买沿用 saveSystem.write + "meta_upgrade_purchased" 事件。
 */

type MeridianSceneData = {
  returnTo?: string;
};

type MetaUpgradeKey = keyof SaveData["metaUpgrades"];

type Point = { x: number; y: number };

type CubicSeg = { p0: Point; c1: Point; c2: Point; p1: Point };

type NodeDef = {
  id: string;
  name: string;
  /** 第几重（1-5），与 metaUpgrades 等级一一对应 */
  order: number;
  /** 原型 380x400 坐标系内位置 */
  x: number;
  y: number;
};

type MeridianDef = {
  id: "rendu" | "chong" | "daimai";
  upgradeKey: MetaUpgradeKey;
  /** 签注标题，如 "任督二脉 · 体魄训练" */
  title: string;
  costs: number[];
  nodes: NodeDef[];
  /** 效果文案，如 最大血量 +10% */
  effectText: (level: number) => string;
  /** 常态经络线（芥金细线），原型坐标系 cubic 段 */
  baseCurves: CubicSeg[];
  /** 淡色辅助弧（如带脉后腰弧） */
  faintSamplers: Array<(t: number) => Point>;
  /** 已通段描边采样器：t 0→1 沿经络走向 */
  litSampler: (t: number) => Point;
};

type NodeState = "lit" | "avail" | "locked";

type NodeView = {
  container: Phaser.GameObjects.Container;
  core: Phaser.GameObjects.Arc;
  halo: Phaser.GameObjects.Arc;
};

const CN = ["", "壹", "贰", "叁", "肆", "伍"];

/** 原型 .chart 在 960x540 内的偏移（left:64 top:116） */
const FIG_X = 64;
const FIG_Y = 116;

const MERIDIAN_LINE_COLOR = PALETTE.accentGold;
const JADE = PALETTE.hp;

function cubicAt(seg: CubicSeg, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * seg.p0.x + b * seg.c1.x + c * seg.c2.x + d * seg.p1.x,
    y: a * seg.p0.y + b * seg.c1.y + c * seg.c2.y + d * seg.p1.y
  };
}

/** 带脉采样：center(190,193) rx52 ry13，t 0→1 从左端沿下弧（前身）到右端 */
function daiMaiLowerArc(t: number): Point {
  const angle = Math.PI * (1 - t);
  return { x: 190 + 52 * Math.cos(angle), y: 193 + 13 * Math.sin(angle) };
}

/** 带脉后腰淡弧：上弧 */
function daiMaiUpperArc(t: number): Point {
  const angle = Math.PI * (1 + t);
  return { x: 190 + 52 * Math.cos(angle), y: 193 + 13 * Math.sin(angle) };
}

const CHONG_LEFT_LEG: CubicSeg = {
  p0: { x: 180, y: 258 },
  c1: { x: 178, y: 292 },
  c2: { x: 176, y: 326 },
  p1: { x: 174, y: 362 }
};

const MERIDIANS: MeridianDef[] = [
  {
    id: "rendu",
    upgradeKey: "max_hp",
    title: "任督二脉 · 体魄训练",
    costs: [120, 220, 360, 520, 720],
    effectText: (level) => `最大血量 +${level * 5}%`,
    nodes: [
      { id: "guanyuan", name: "关元", order: 1, x: 190, y: 234 },
      { id: "qihai", name: "气海", order: 2, x: 190, y: 210 },
      { id: "shenque", name: "神阙", order: 3, x: 190, y: 182 },
      { id: "zhongwan", name: "中脘", order: 4, x: 190, y: 158 },
      { id: "tanzhong", name: "膻中", order: 5, x: 190, y: 134 }
    ],
    baseCurves: [{ p0: { x: 190, y: 92 }, c1: { x: 189, y: 130 }, c2: { x: 191, y: 190 }, p1: { x: 190, y: 246 } }],
    faintSamplers: [],
    litSampler: (t) => ({ x: 190, y: 246 - 112 * t })
  },
  {
    id: "chong",
    upgradeKey: "move_speed",
    title: "冲脉 · 轻功步法",
    costs: [120, 220, 360, 520, 720],
    effectText: (level) => `移动速度 +${level * 3}%`,
    nodes: [
      { id: "yongquan", name: "涌泉", order: 1, x: 174, y: 362 },
      { id: "taixi", name: "太溪", order: 2, x: 175, y: 342 },
      { id: "sanyinjiao", name: "三阴交", order: 3, x: 176, y: 318 },
      { id: "zusanli", name: "足三里", order: 4, x: 178, y: 292 },
      { id: "huantiao", name: "环跳", order: 5, x: 181, y: 262 }
    ],
    baseCurves: [
      CHONG_LEFT_LEG,
      { p0: { x: 200, y: 258 }, c1: { x: 202, y: 292 }, c2: { x: 204, y: 326 }, p1: { x: 206, y: 362 } }
    ],
    faintSamplers: [],
    // 已通段从涌泉（腿线末端）向上延伸
    litSampler: (t) => cubicAt(CHONG_LEFT_LEG, 1 - t)
  },
  {
    id: "daimai",
    upgradeKey: "pickup_radius",
    title: "带脉 · 磁石锦囊",
    costs: [100, 200, 320, 480, 680],
    effectText: (level) => `拾取半径 +${level * 5}%`,
    nodes: [
      { id: "daimai_xue", name: "带脉", order: 1, x: 138, y: 193 },
      { id: "wushu", name: "五枢", order: 2, x: 150, y: 202 },
      { id: "weidao", name: "维道", order: 3, x: 168, y: 205 },
      { id: "jingmen", name: "京门", order: 4, x: 230, y: 202 },
      { id: "zhangmen", name: "章门", order: 5, x: 242, y: 193 }
    ],
    baseCurves: [],
    faintSamplers: [daiMaiUpperArc],
    litSampler: daiMaiLowerArc
  }
];

/** 人体剪影笔画（原型 #figBody，380x400 坐标系） */
const FIGURE_CURVES: CubicSeg[] = [
  // 颈
  { p0: { x: 190, y: 78 }, c1: { x: 190, y: 82 }, c2: { x: 190, y: 84 }, p1: { x: 190, y: 88 } },
  // 肩
  { p0: { x: 148, y: 104 }, c1: { x: 168, y: 88 }, c2: { x: 212, y: 88 }, p1: { x: 232, y: 104 } },
  // 左躯干
  { p0: { x: 148, y: 104 }, c1: { x: 134, y: 130 }, c2: { x: 138, y: 168 }, p1: { x: 158, y: 196 } },
  { p0: { x: 158, y: 196 }, c1: { x: 166, y: 210 }, c2: { x: 172, y: 230 }, p1: { x: 174, y: 254 } },
  // 右躯干
  { p0: { x: 232, y: 104 }, c1: { x: 246, y: 130 }, c2: { x: 242, y: 168 }, p1: { x: 222, y: 196 } },
  { p0: { x: 222, y: 196 }, c1: { x: 214, y: 210 }, c2: { x: 208, y: 230 }, p1: { x: 206, y: 254 } },
  // 髋
  { p0: { x: 174, y: 254 }, c1: { x: 182, y: 263 }, c2: { x: 198, y: 263 }, p1: { x: 206, y: 254 } },
  // 双臂微张
  { p0: { x: 150, y: 108 }, c1: { x: 132, y: 122 }, c2: { x: 112, y: 138 }, p1: { x: 98, y: 152 } },
  { p0: { x: 230, y: 108 }, c1: { x: 248, y: 122 }, c2: { x: 268, y: 138 }, p1: { x: 282, y: 152 } },
  // 双腿分立
  { p0: { x: 174, y: 254 }, c1: { x: 172, y: 286 }, c2: { x: 170, y: 320 }, p1: { x: 167, y: 366 } },
  { p0: { x: 206, y: 254 }, c1: { x: 208, y: 286 }, c2: { x: 210, y: 320 }, p1: { x: 213, y: 366 } },
  // 足
  { p0: { x: 167, y: 366 }, c1: { x: 163, y: 372 }, c2: { x: 158, y: 374 }, p1: { x: 152, y: 372 } },
  { p0: { x: 213, y: 366 }, c1: { x: 217, y: 372 }, c2: { x: 222, y: 374 }, p1: { x: 228, y: 372 } }
];

const FIGURE_CIRCLES = [
  // 头
  { x: 190, y: 52, r: 26 },
  // 圆发髻
  { x: 190, y: 19.5, r: 6.5 }
];

const TAG_WIDTH = 240;
const TAG_HEIGHT = 214;
const TAG_X = 600;
const TAG_Y = 148;

export class MeridianScene extends Phaser.Scene {
  private returnTo: "menu" | "scripture" = "scripture";
  private dynamicRoot?: Phaser.GameObjects.Container;
  private selectedNodeId = "";
  private nodeViews = new Map<string, NodeView>();
  private litGraphics: Partial<Record<MeridianDef["id"], Phaser.GameObjects.Graphics>> = {};
  private selectionRing?: Phaser.GameObjects.Graphics;
  /** 穴位 id → 所属经络 */
  private readonly nodeMeridian = new Map<string, MeridianDef>();

  constructor() {
    super(SCENE_KEYS.meridian);
  }

  create(data?: MeridianSceneData): void {
    this.returnTo = data?.returnTo === "menu" ? "menu" : "scripture";
    for (const meridian of MERIDIANS) {
      for (const node of meridian.nodes) {
        this.nodeMeridian.set(node.id, meridian);
      }
    }

    addMinimalBackdrop(this);
    addMinimalTitle(this, "经脉武学", 52, 46, "脉");
    this.drawFigureAndBaseMeridians();
    this.drawLegend();
    addMinimalBackRow(this, () => {
      transitionTo(this, this.returnTo === "menu" ? SCENE_KEYS.menu : SCENE_KEYS.scripture);
    });

    this.selectedNodeId = this.findDefaultSelectedNodeId();
    this.refreshDynamic({ entrance: true });
    fadeIn(this);
  }

  // ---------------------------------------------------------------- 静态层

  /** 人体剪影（ghost + main 双描）+ 三条经络常态线 + 金色氛围光晕。一次性绘制。 */
  private drawFigureAndBaseMeridians(): void {
    const g = this.add.graphics().setDepth(0);
    // 金色氛围光（原型 .fig-aura）
    g.fillStyle(MERIDIAN_LINE_COLOR, 0.045);
    g.fillCircle(FIG_X + 190, FIG_Y + 200, 190);
    g.fillStyle(MERIDIAN_LINE_COLOR, 0.03);
    g.fillCircle(FIG_X + 190, FIG_Y + 190, 120);

    // 剪影：ghost 偏移层 + main 层
    this.strokeFigure(g, 0.8, 0.7, 0.16, 1.1);
    this.strokeFigure(g, 0, 0, 0.5, 1.35);

    // 经络常态线：芥金 62% / 淡弧 22%
    for (const meridian of MERIDIANS) {
      for (const sampler of meridian.faintSamplers) {
        this.strokeSampler(g, sampler, 0.22, 1.5);
      }
      for (const seg of meridian.baseCurves) {
        this.strokeCubic(g, seg, 0.62, 1.5);
      }
      if (meridian.id === "daimai") {
        this.strokeSampler(g, daiMaiLowerArc, 0.62, 1.5);
      }
    }
  }

  private strokeFigure(g: Phaser.GameObjects.Graphics, ox: number, oy: number, alpha: number, width: number): void {
    g.lineStyle(width, MERIDIAN_LINE_COLOR, alpha);
    for (const circle of FIGURE_CIRCLES) {
      g.strokeCircle(FIG_X + circle.x + ox, FIG_Y + circle.y + oy, circle.r);
    }
    for (const seg of FIGURE_CURVES) {
      this.strokeCubic(g, seg, alpha, width, ox, oy);
    }
  }

  private strokeCubic(
    g: Phaser.GameObjects.Graphics,
    seg: CubicSeg,
    alpha: number,
    width: number,
    ox = 0,
    oy = 0
  ): void {
    g.lineStyle(width, MERIDIAN_LINE_COLOR, alpha);
    g.beginPath();
    const start = cubicAt(seg, 0);
    g.moveTo(FIG_X + start.x + ox, FIG_Y + start.y + oy);
    for (let i = 1; i <= 24; i += 1) {
      const p = cubicAt(seg, i / 24);
      g.lineTo(FIG_X + p.x + ox, FIG_Y + p.y + oy);
    }
    g.strokePath();
  }

  private strokeSampler(
    g: Phaser.GameObjects.Graphics,
    sampler: (t: number) => Point,
    alpha: number,
    width: number
  ): void {
    g.lineStyle(width, MERIDIAN_LINE_COLOR, alpha);
    g.beginPath();
    const start = sampler(0);
    g.moveTo(FIG_X + start.x, FIG_Y + start.y);
    for (let i = 1; i <= 48; i += 1) {
      const p = sampler(i / 48);
      g.lineTo(FIG_X + p.x, FIG_Y + p.y);
    }
    g.strokePath();
  }

  /** 底部图例：已通 / 可冲 / 未达 */
  private drawLegend(): void {
    const y = this.scale.height - 26;
    const items: Array<{ label: string; state: NodeState }> = [
      { label: "已通", state: "lit" },
      { label: "可冲", state: "avail" },
      { label: "未达", state: "locked" }
    ];
    const container = this.add.container(this.scale.width / 2, y).setDepth(1);
    let cursor = 0;
    const parts: Phaser.GameObjects.GameObject[] = [];
    for (const item of items) {
      const dot = this.add.circle(cursor + 3, 0, 3, 0xffffff);
      this.styleDot(dot, item.state);
      const text = this.add.text(cursor + 11, 0, item.label, {
        color: PALETTE.textSecondary,
        fontFamily: FONT_BODY,
        fontSize: "11px"
      }).setOrigin(0, 0.5).setResolution(2).setAlpha(0.8);
      parts.push(dot, text);
      cursor += 11 + text.displayWidth + 22;
    }
    container.add(parts);
    container.setX(this.scale.width / 2 - (cursor - 22) / 2);
  }

  private styleDot(dot: Phaser.GameObjects.Arc, state: NodeState): void {
    if (state === "lit") {
      dot.setFillStyle(JADE, 1);
    } else if (state === "avail") {
      dot.setFillStyle(MERIDIAN_LINE_COLOR, 1);
    } else {
      dot.setFillStyle(0xcdc8b9, 0.08).setStrokeStyle(1, 0xcdc8b9, 0.4);
    }
  }

  // ---------------------------------------------------------------- 动态层

  /** 重建动态层：信息行 / 已通描边 / 穴位 / 签注 / 墨签。购买与点选后原位刷新。 */
  private refreshDynamic(opts?: { entrance?: boolean; litAnim?: { meridianId: MeridianDef["id"]; fromLevel: number } }): void {
    this.dynamicRoot?.destroy(true);
    this.nodeViews.clear();
    this.litGraphics = {};
    this.dynamicRoot = this.add.container(0, 0).setDepth(2);

    const saveData = getSaveData(this);
    this.buildInfoLine(saveData);

    // 每条经络一个 Graphics 承载已通段描边（冲穴时增量重绘做延伸动画）
    for (const meridian of MERIDIANS) {
      const litG = this.add.graphics().setDepth(2);
      this.dynamicRoot.add(litG);
      this.litGraphics[meridian.id] = litG;
      const level = saveData.metaUpgrades[meridian.upgradeKey];
      const drawLevel = opts?.litAnim?.meridianId === meridian.id ? opts.litAnim.fromLevel : level;
      this.drawLitSegments(meridian, this.fracForLevel(meridian, drawLevel));
    }

    this.buildNodes(saveData, opts?.entrance ?? false);
    this.buildCaptions(saveData, opts?.entrance ?? false);
    this.buildSelectionRing();
    this.buildTag(saveData, opts?.entrance ?? false);
  }

  /** 顶部小字：铜钱 N · 已通穴位 n/15 */
  private buildInfoLine(saveData: SaveData): void {
    const totalLit = MERIDIANS.reduce((sum, m) => sum + saveData.metaUpgrades[m.upgradeKey], 0);
    const y = 108;
    const parts: Array<Phaser.GameObjects.Text | Phaser.GameObjects.Image> = [];

    if (this.textures.exists("icon_coin")) {
      const coin = this.add.image(0, 0, "icon_coin").setOrigin(0, 0.5).setDisplaySize(13, 13);
      parts.push(coin);
    }
    const mkLabel = (text: string) => this.add.text(0, 0, text, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setOrigin(0, 0.5).setResolution(2);
    const mkValue = (text: string) => this.add.text(0, 0, text, {
      color: PALETTE.accentGoldCss,
      fontFamily: FONT_MONO,
      fontSize: "13px",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setResolution(2);

    parts.push(mkLabel(" 铜钱 "), mkValue(`${saveData.copper}`), mkLabel("  ·  已通穴位 "), mkValue(`${totalLit} / 15`));

    let cursor = 0;
    for (const part of parts) {
      part.setX(cursor);
      cursor += part.displayWidth;
    }
    const container = this.add.container(this.scale.width / 2 - cursor / 2, y, parts);
    this.dynamicRoot?.add(container);
  }

  /** 穴位节点：三态样式 + 可冲脉动环 + 点击选中。 */
  private buildNodes(saveData: SaveData, entrance: boolean): void {
    let index = 0;
    for (const meridian of MERIDIANS) {
      const level = saveData.metaUpgrades[meridian.upgradeKey];
      for (const node of meridian.nodes) {
        const state = this.nodeState(node, level);
        const x = FIG_X + node.x;
        const y = FIG_Y + node.y;

        const halo = this.add.circle(0, 0, 9, JADE, 0.22);
        const ring = this.add.circle(0, 0, 9).setFillStyle(0, 0).setStrokeStyle(1, MERIDIAN_LINE_COLOR, 0.75);
        const core = this.add.circle(0, 0, 5.5);
        if (state === "lit") {
          halo.setVisible(true);
          ring.setVisible(false);
          core.setFillStyle(JADE, 1);
          // 微光晕呼吸
          const glow = this.tweens.add({
            targets: halo,
            alpha: { from: 0.14, to: 0.3 },
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: Phaser.Math.Easing.Sine.InOut
          });
          halo.once(Phaser.GameObjects.Events.DESTROY, () => glow.remove());
        } else if (state === "avail") {
          halo.setVisible(false);
          ring.setVisible(true);
          core.setFillStyle(MERIDIAN_LINE_COLOR, 1);
          // 芥金脉动环 alpha 0.4 ↔ 1
          const pulse = this.tweens.add({
            targets: ring,
            alpha: 0.4,
            duration: 760,
            yoyo: true,
            repeat: -1,
            ease: Phaser.Math.Easing.Sine.InOut
          });
          ring.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
        } else {
          halo.setVisible(false);
          ring.setVisible(false);
          core.setFillStyle(0xcdc8b9, 0.1).setStrokeStyle(1, 0xcdc8b9, 0.4);
        }

        const container = this.add.container(x, y, [halo, ring, core]).setDepth(3);
        container.setInteractive(new Phaser.Geom.Circle(0, 0, 14), Phaser.Geom.Circle.Contains);
        if (container.input) {
          container.input.cursor = "pointer";
        }
        container.on(Phaser.Input.Events.POINTER_DOWN, () => this.selectNode(node.id));
        this.dynamicRoot?.add(container);
        this.nodeViews.set(node.id, { container, core, halo });

        if (entrance) {
          container.setAlpha(0).setScale(0.5);
          this.tweens.add({
            targets: container,
            alpha: 1,
            scale: 1,
            duration: 280,
            delay: 120 + index * 35,
            ease: Phaser.Math.Easing.Back.Out
          });
        }
        index += 1;
      }
    }
  }

  /** 三处经络签注：经名 / 重数 / 五点小图。 */
  private buildCaptions(saveData: SaveData, entrance: boolean): void {
    const layouts: Array<{ meridianId: MeridianDef["id"]; x: number; y: number; alignRight: boolean }> = [
      { meridianId: "rendu", x: 356, y: 236, alignRight: false },
      { meridianId: "daimai", x: 344, y: 296, alignRight: false },
      { meridianId: "chong", x: 222, y: 416, alignRight: true }
    ];

    layouts.forEach((layout, layoutIndex) => {
      const meridian = MERIDIANS.find((m) => m.id === layout.meridianId);
      if (!meridian) {
        return;
      }
      const level = saveData.metaUpgrades[meridian.upgradeKey];
      const originX = layout.alignRight ? 1 : 0;
      const name = this.add.text(layout.x, layout.y, meridian.title, {
        color: "#f0ead8",
        fontFamily: FONT_BODY,
        fontSize: "13px",
        fontStyle: "600"
      }).setOrigin(originX, 0).setResolution(2).setAlpha(0.85);
      const sub = this.add.text(layout.x, layout.y + 20, level > 0 ? `第${CN[level]}重 · ${meridian.effectText(level)}` : "未入门 · 待冲开", {
        color: PALETTE.textSecondary,
        fontFamily: FONT_BODY,
        fontSize: "11px"
      }).setOrigin(originX, 0).setResolution(2).setAlpha(0.8);

      const dots: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < meridian.nodes.length; i += 1) {
        const state = this.nodeState(meridian.nodes[i], level);
        const dotX = layout.alignRight ? layout.x - 6 - i * 11 : layout.x + i * 11;
        const dot = this.add.circle(dotX + (layout.alignRight ? 0 : 3), layout.y + 46, 3, 0xffffff);
        this.styleDot(dot, state);
        dots.push(dot);
      }

      const objects: Array<Phaser.GameObjects.Text | Phaser.GameObjects.Arc> = [name, sub, ...dots];
      this.dynamicRoot?.add(objects);
      if (entrance) {
        for (const obj of objects) {
          obj.setAlpha(0);
        }
        this.tweens.add({
          targets: objects,
          alpha: (target: Phaser.GameObjects.GameObject) => (target instanceof Phaser.GameObjects.Text ? 0.85 : 1),
          duration: 300,
          delay: 260 + layoutIndex * 90,
          ease: Phaser.Math.Easing.Sine.Out
        });
      }
    });
  }

  /** 选中虚线圈（近似：细描边圆）。 */
  private buildSelectionRing(): void {
    const node = this.findNode(this.selectedNodeId);
    this.selectionRing = this.add.graphics().setDepth(4);
    if (!node) {
      return;
    }
    this.selectionRing.lineStyle(1, 0xf0ead8, 0.85);
    this.selectionRing.strokeCircle(FIG_X + node.x, FIG_Y + node.y, 10.5);
  }

  /** 墨签：深墨底 + 芥金边 + 朱砂短线，穴名/所属经/当前/下层/价格/冲穴行。 */
  private buildTag(saveData: SaveData, entrance: boolean): void {
    const node = this.findNode(this.selectedNodeId);
    if (!node) {
      return;
    }
    const meridian = this.nodeMeridian.get(node.id);
    if (!meridian) {
      return;
    }
    const level = saveData.metaUpgrades[meridian.upgradeKey];
    const maxLevel = meridian.costs.length;
    const state = this.nodeState(node, level);
    const nextCost = level < maxLevel ? meridian.costs[level] : undefined;

    const tag = this.add.container(TAG_X, TAG_Y).setDepth(10);

    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelBg, 0.92);
    panel.fillRoundedRect(0, 0, TAG_WIDTH, TAG_HEIGHT, 6);
    panel.lineStyle(1, MERIDIAN_LINE_COLOR, 0.55);
    panel.strokeRoundedRect(0.5, 0.5, TAG_WIDTH - 1, TAG_HEIGHT - 1, 6);
    tag.add(panel);
    // 顶部 1px 朱砂短线
    tag.add(this.add.rectangle(TAG_WIDTH / 2, 1, 44, 1, PALETTE.cinnabar, 0.9));

    tag.add(this.add.text(22, 18, node.name, {
      color: PALETTE.textPrimary,
      fontFamily: FONT_TITLE,
      fontSize: "20px"
    }).setResolution(2));
    tag.add(this.add.text(22, 48, meridian.title, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "12px"
    }).setResolution(2));
    tag.add(this.add.rectangle(TAG_WIDTH / 2, 68, TAG_WIDTH - 44, 1, MERIDIAN_LINE_COLOR, 0.18));

    const currentText = level > 0 ? `第${CN[level]}重 · ${meridian.effectText(level)}` : "未入门";
    tag.add(this.add.text(22, 82, "当前", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "12px"
    }).setResolution(2));
    tag.add(this.add.text(70, 81, currentText, {
      color: PALETTE.textPrimary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setResolution(2));

    const lockedView = state === "locked";
    const nextRowDim = lockedView || level >= maxLevel;
    const nextText = level >= maxLevel
      ? "五重圆满 · 气血周流"
      : lockedView
        ? `第${CN[node.order]}重 → ${meridian.effectText(node.order)}`
        : `第${CN[level + 1]}重 → ${meridian.effectText(level + 1)}`;
    tag.add(this.add.text(22, 108, "下层", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "12px"
    }).setResolution(2));
    tag.add(this.add.text(70, 107, nextText, {
      color: PALETTE.textPrimary,
      fontFamily: FONT_BODY,
      fontSize: "13px"
    }).setResolution(2).setAlpha(nextRowDim ? 0.5 : 1));

    // 价格行：icon_coin + FONT_MONO 芥金
    const priceY = 140;
    const priceAlpha = nextRowDim ? 0.45 : 1;
    let priceCursor = 22;
    if (this.textures.exists("icon_coin")) {
      const coin = this.add.image(priceCursor, priceY, "icon_coin").setOrigin(0, 0.5).setDisplaySize(16, 16).setAlpha(priceAlpha);
      tag.add(coin);
      priceCursor += 22;
    }
    const priceValue = this.add.text(priceCursor, priceY, nextCost === undefined ? "—" : `${lockedView ? meridian.costs[node.order - 1] : nextCost}`, {
      color: PALETTE.accentGoldCss,
      fontFamily: FONT_MONO,
      fontSize: "15px",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setResolution(2).setAlpha(priceAlpha);
    tag.add(priceValue);
    tag.add(this.add.text(priceCursor + priceValue.displayWidth + 8, priceY, "铜钱", {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "11px"
    }).setOrigin(0, 0.5).setResolution(2).setAlpha(priceAlpha));

    tag.add(this.add.rectangle(TAG_WIDTH / 2, 162, TAG_WIDTH - 44, 1, MERIDIAN_LINE_COLOR, 0.18));

    // 冲穴行（addMinimalMenuRow 小号）：可冲且铜钱够才可点
    const canBuy = state === "avail" && nextCost !== undefined && saveData.copper >= nextCost;
    const ctaLabel = state === "locked"
      ? "未达 · 需先通前穴"
      : state === "lit"
        ? "此穴已通 · 气血周流"
        : nextCost === undefined
          ? "五重圆满"
          : "点按冲开此穴";
    const cta = addMinimalMenuRow(this, TAG_WIDTH / 2, 186, ctaLabel, () => this.purchaseNode(node), { fontSize: 18 });
    cta.setEnabled(state === "avail" && canBuy);
    tag.add(cta.container);

    this.dynamicRoot?.add(tag);
    // 浮出动画：右滑 + 淡入（入场与每次重建共用，即"再买一次后原位刷新"）
    tag.setAlpha(0).setX(TAG_X + 12).setRotation(0.012);
    this.tweens.add({
      targets: tag,
      alpha: 1,
      x: TAG_X,
      duration: entrance ? 420 : 260,
      delay: entrance ? 500 : 0,
      ease: Phaser.Math.Easing.Sine.Out
    });
  }

  // ---------------------------------------------------------------- 行为

  private selectNode(nodeId: string): void {
    if (nodeId === this.selectedNodeId) {
      return;
    }
    this.selectedNodeId = nodeId;
    this.refreshDynamic();
  }

  /** 冲穴：沿用现有 meta 购买路径（克隆存档 → 扣铜钱 → 写档 → 广播事件）。 */
  private purchaseNode(node: NodeDef): void {
    const meridian = this.nodeMeridian.get(node.id);
    if (!meridian) {
      return;
    }
    const saveData = cloneSaveData(getSaveData(this));
    const level = saveData.metaUpgrades[meridian.upgradeKey];
    const cost = meridian.costs[level];
    // 只能冲当前可冲之穴（顺序第 level+1 重）
    if (cost === undefined || node.order !== level + 1 || saveData.copper < cost) {
      return;
    }

    saveData.copper -= cost;
    saveData.metaUpgrades[meridian.upgradeKey] = level + 1;
    if (!saveSystem.write(saveData)) {
      return;
    }
    setSaveData(this, saveData);
    this.playSfx(level + 1 >= meridian.costs.length ? "scripture_reveal_rare" : "insight");
    eventBus.emit("meta_upgrade_purchased", {
      key: meridian.upgradeKey,
      level: saveData.metaUpgrades[meridian.upgradeKey],
      cost,
      remainingCopper: saveData.copper
    });

    JuiceSystem.get(this).goldBurst(FIG_X + node.x, FIG_Y + node.y);
    // 刷新（已通段先停在旧重数），再做描边延伸 + 穴位点亮
    this.refreshDynamic({ litAnim: { meridianId: meridian.id, fromLevel: level } });
    this.animateLitExtension(meridian, level, level + 1);
    this.flashLitNode(node.id);
  }

  /** 经络段玉色描边从旧重数延伸到新重数。 */
  private animateLitExtension(meridian: MeridianDef, fromLevel: number, toLevel: number): void {
    const fromFrac = this.fracForLevel(meridian, fromLevel);
    const toFrac = this.fracForLevel(meridian, toLevel);
    const progress = { f: fromFrac };
    this.tweens.add({
      targets: progress,
      f: toFrac,
      duration: 420,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: () => this.drawLitSegments(meridian, progress.f)
    });
  }

  /** 新通穴位点亮：玉色放大回稳 + 光晕闪。 */
  private flashLitNode(nodeId: string): void {
    const view = this.nodeViews.get(nodeId);
    if (!view) {
      return;
    }
    view.core.setScale(1);
    this.tweens.add({
      targets: view.core,
      scale: 1.8,
      duration: 160,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.Out
    });
    // 光晕点亮闪：停掉常驻呼吸，亮闪后回落
    this.tweens.killTweensOf(view.halo);
    view.halo.setAlpha(0.9);
    this.tweens.add({
      targets: view.halo,
      alpha: 0.22,
      duration: 520,
      ease: Phaser.Math.Easing.Sine.Out
    });
  }

  /** 已通段描边：玉色发光（宽低透 + 窄实两层），frac 为沿 litSampler 的比例。 */
  private drawLitSegments(meridian: MeridianDef, frac: number): void {
    const g = this.litGraphics[meridian.id];
    if (!g) {
      return;
    }
    g.clear();
    if (frac <= 0.001) {
      return;
    }
    const steps = Math.max(2, Math.round(48 * Phaser.Math.Clamp(frac, 0, 1)));
    const draw = (width: number, alpha: number): void => {
      g.lineStyle(width, JADE, alpha);
      g.beginPath();
      const start = meridian.litSampler(0);
      g.moveTo(FIG_X + start.x, FIG_Y + start.y);
      for (let i = 1; i <= steps; i += 1) {
        const p = meridian.litSampler((i / steps) * frac);
        g.lineTo(FIG_X + p.x, FIG_Y + p.y);
      }
      g.strokePath();
    };
    draw(4.5, 0.16);
    draw(2, 0.9);
  }

  // ---------------------------------------------------------------- 查询

  private nodeState(node: NodeDef, level: number): NodeState {
    if (node.order <= level) {
      return "lit";
    }
    if (node.order === level + 1) {
      return "avail";
    }
    return "locked";
  }

  private findNode(nodeId: string): NodeDef | undefined {
    for (const meridian of MERIDIANS) {
      const found = meridian.nodes.find((node) => node.id === nodeId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /** 默认选中：第一个"可冲"穴位；全满则选首穴。 */
  private findDefaultSelectedNodeId(): string {
    const saveData = getSaveData(this);
    for (const meridian of MERIDIANS) {
      const level = saveData.metaUpgrades[meridian.upgradeKey];
      const avail = meridian.nodes.find((node) => this.nodeState(node, level) === "avail");
      if (avail) {
        return avail.id;
      }
    }
    return MERIDIANS[0].nodes[0].id;
  }

  /** 穴位 order → 已通段描边比例（在 litSampler 上最近邻匹配）。 */
  private fracForLevel(meridian: MeridianDef, level: number): number {
    if (level <= 0) {
      return 0;
    }
    const node = meridian.nodes.find((candidate) => candidate.order === Math.min(level, meridian.nodes.length));
    if (!node) {
      return 0;
    }
    let bestT = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 400; i += 1) {
      const t = i / 400;
      const p = meridian.litSampler(t);
      const dist = (p.x - node.x) * (p.x - node.x) + (p.y - node.y) * (p.y - node.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
    // 略微越过穴位，让描边包住穴点
    return Math.min(1, bestT + 0.02);
  }

  /** 音效防御性播放：音频系统未初始化时静默跳过。 */
  private playSfx(eventId: string): void {
    try {
      getAudioSystem(this).playPlaceholder(eventId);
    } catch {
      // audio unavailable
    }
  }
}

function cloneSaveData(saveData: SaveData): SaveData {
  return {
    ...saveData,
    metaUpgrades: { ...saveData.metaUpgrades },
    scriptureGacha: {
      starter_scripture_pool: { ...saveData.scriptureGacha.starter_scripture_pool }
    },
    collection: {
      skins: [...saveData.collection.skins],
      titles: [...saveData.collection.titles],
      fragments: { ...saveData.collection.fragments }
    },
    settings: { ...saveData.settings }
  };
}
