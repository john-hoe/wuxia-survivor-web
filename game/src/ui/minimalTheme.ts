import Phaser from "phaser";
import { FONT_BODY, FONT_TITLE, PALETTE } from "./visualConstants";

/**
 * 「极简碑林」共享视觉主题（方向 C）。
 * 去面板化：内容浮于墨底之上，竹影 + 雾气 + 暗角压暗，
 * 菜单行 = 大字距衬线文字 + 程序化笔触下划线。
 *
 * 注意：菜单行字体按原型截图使用 Noto Serif SC 衬线栈（非 Ma Shan Zheng）。
 */

/** 菜单行衬线字体栈（原型 c-menu 的 .mi 用字） */
const FONT_ROW = "'Noto Serif SC', 'Songti SC', 'SimSun', serif";

/** 全局复用的笔触纹理 key */
const BRUSH_TEXTURE_KEY = "minimal_brush_stroke";
/** 底部雾气 / 暗角渐变纹理 key（按屏幕尺寸生成一次） */
const MIST_TEXTURE_KEY = "minimal_mist_grad";
const VIGNETTE_TEXTURE_KEY = "minimal_vignette";
const SKY_TEXTURE_KEY = "minimal_sky_grad";

const ROW_TEXT_COLOR = "#f0ead8";
const TITLE_COLOR = "#f4f1e6";

export interface MinimalRowHandle {
  container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
}

/** 字距模拟：字符间插  。导出供其他场景复用。 */
export function spacedText(text: string): string {
  return text.split("").join("\u2009");
}

/** 程序化笔触纹理：多段不等高细椭圆叠加，两端尖、中间略粗、边缘毛糙；白色生成，用时 tint。 */
function ensureBrushTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BRUSH_TEXTURE_KEY)) {
    return;
  }
  const width = 240;
  const height = 24;
  const midY = height / 2;
  const g = scene.add.graphics();

  // 主笔：沿 x 叠加不等高细椭圆，高度按 sin 包络渐细，叠出毛边与浓淡
  let x = 6;
  while (x < width - 6) {
    const t = x / width;
    const taper = Math.sin(Math.PI * Phaser.Math.Clamp(t, 0.02, 0.98));
    const segmentHeight = 1.5 + taper * (4.5 + Math.random() * 3.5);
    const segmentWidth = 6 + Math.random() * 9;
    const yOffset = (Math.random() - 0.5) * 3.5 * taper;
    g.fillStyle(0xffffff, 0.7 + Math.random() * 0.3);
    g.fillEllipse(x, midY + yOffset, segmentWidth, segmentHeight);
    x += segmentWidth * (0.45 + Math.random() * 0.3);
  }
  // 飞白：几道贯穿的极细长条，增加行笔感
  for (let i = 0; i < 3; i++) {
    const y = midY + (Math.random() - 0.5) * 6;
    g.fillStyle(0xffffff, 0.25 + Math.random() * 0.2);
    g.fillEllipse(width / 2, y, width * (0.55 + Math.random() * 0.3), 1.2);
  }
  g.generateTexture(BRUSH_TEXTURE_KEY, width, height);
  g.destroy();
}

/** 生成天空径向渐变 / 雾气 / 暗角三张缓存纹理（按当前屏幕尺寸）。 */
function ensureGradientTextures(scene: Phaser.Scene): void {
  const width = Math.max(2, Math.floor(scene.scale.width));
  const height = Math.max(2, Math.floor(scene.scale.height));

  if (!scene.textures.exists(SKY_TEXTURE_KEY)) {
    const tex = scene.textures.createCanvas(SKY_TEXTURE_KEY, width, height);
    if (tex) {
      const ctx = tex.getContext();
      // 对应原型 radial-gradient(120% 90% at 50% 0%)
      const radius = Math.hypot(width * 0.6, height * 0.9);
      const grad = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, radius);
      grad.addColorStop(0, "#18241b");
      grad.addColorStop(0.46, "#101a13");
      grad.addColorStop(1, "#0a100c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      tex.refresh();
    }
  }

  if (!scene.textures.exists(VIGNETTE_TEXTURE_KEY)) {
    const tex = scene.textures.createCanvas(VIGNETTE_TEXTURE_KEY, width, height);
    if (tex) {
      const ctx = tex.getContext();
      // 对应原型 radial-gradient(90% 78% at 50% 44%)，中心透明、四角压暗
      const radius = Math.hypot(width * 0.5, height * 0.44) / 0.52;
      const grad = ctx.createRadialGradient(width / 2, height * 0.44, 0, width / 2, height * 0.44, radius);
      grad.addColorStop(0, "rgba(3,6,4,0)");
      grad.addColorStop(0.52, "rgba(3,6,4,0)");
      grad.addColorStop(1, "rgba(3,6,4,0.55)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      tex.refresh();
    }
  }

  if (!scene.textures.exists(MIST_TEXTURE_KEY)) {
    const mistHeight = Math.max(2, Math.floor(height * 0.36));
    const tex = scene.textures.createCanvas(MIST_TEXTURE_KEY, 4, mistHeight);
    if (tex) {
      const ctx = tex.getContext();
      // 底部向上雾气：白 6-8% 渐隐
      const grad = ctx.createLinearGradient(0, mistHeight, 0, 0);
      grad.addColorStop(0, "rgba(238,241,234,0.075)");
      grad.addColorStop(0.45, "rgba(238,241,234,0.03)");
      grad.addColorStop(1, "rgba(238,241,234,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, mistHeight);
      tex.refresh();
    }
  }
}

/** 竹影两侧 + 底部雾气 + 暗角压暗的氛围底。depth 默认 -10 以下，不挡内容。 */
export function addMinimalBackdrop(scene: Phaser.Scene): void {
  ensureGradientTextures(scene);
  const width = scene.scale.width;
  const height = scene.scale.height;
  const scaleFactor = height / 540; // 原型按 540 高设计，随分辨率缩放

  if (scene.textures.exists(SKY_TEXTURE_KEY)) {
    scene.add.image(0, 0, SKY_TEXTURE_KEY).setOrigin(0, 0).setDepth(-100);
  } else {
    scene.add.rectangle(0, 0, width, height, PALETTE.worldBgInt).setOrigin(0, 0).setDepth(-100);
  }

  // 两侧水墨竹丛：大 displaySize、低 alpha，右侧 flipX，缓慢横向漂移视差
  if (scene.textures.exists("bamboo_edge_cluster")) {
    const farSize = 410 * scaleFactor;
    const nearSize = 560 * scaleFactor;
    const bottomNear = height + 24 * scaleFactor;
    const bottomFar = height + 36 * scaleFactor;

    const farLeft = scene.add.image(-150 * scaleFactor, bottomFar, "bamboo_edge_cluster")
      .setOrigin(0, 1).setDisplaySize(farSize, farSize).setAlpha(0.10).setDepth(-99);
    const farRight = scene.add.image(width + 150 * scaleFactor, bottomFar, "bamboo_edge_cluster")
      .setOrigin(1, 1).setDisplaySize(farSize, farSize).setAlpha(0.10).setFlipX(true).setDepth(-99);
    const nearLeft = scene.add.image(-218 * scaleFactor, bottomNear, "bamboo_edge_cluster")
      .setOrigin(0, 1).setDisplaySize(nearSize, nearSize).setAlpha(0.14).setDepth(-98);
    const nearRight = scene.add.image(width + 218 * scaleFactor, bottomNear, "bamboo_edge_cluster")
      .setOrigin(1, 1).setDisplaySize(nearSize, nearSize).setAlpha(0.14).setFlipX(true).setDepth(-98);

    scene.tweens.add({
      targets: [nearLeft, farLeft],
      x: `+=${14 * scaleFactor}`,
      duration: 6800,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut
    });
    scene.tweens.add({
      targets: [nearRight, farRight],
      x: `-=${14 * scaleFactor}`,
      duration: 8200,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut
    });
  }

  // 整体压暗（轻量墨纱，保留竹影可见）
  scene.add.rectangle(0, 0, width, height, 0x070c09, 0.35).setOrigin(0, 0).setDepth(-97);

  // 底部向上雾气
  if (scene.textures.exists(MIST_TEXTURE_KEY)) {
    scene.add.image(0, height, MIST_TEXTURE_KEY)
      .setOrigin(0, 1)
      .setDisplaySize(width, height * 0.36)
      .setDepth(-96);
  }

  // 暗角
  if (scene.textures.exists(VIGNETTE_TEXTURE_KEY)) {
    scene.add.image(0, 0, VIGNETTE_TEXTURE_KEY).setOrigin(0, 0).setDepth(-95);
  }
}

/** 标题 + 可选印章字。size 默认 44；sealChar 传入时在标题右下盖朱砂印。返回标题 Text。 */
export function addMinimalTitle(
  scene: Phaser.Scene,
  text: string,
  y: number,
  size = 44,
  sealChar?: string
): Phaser.GameObjects.Text {
  const centerX = scene.scale.width / 2;
  const title = scene.add.text(centerX, y, text, {
    color: TITLE_COLOR,
    fontFamily: FONT_TITLE,
    fontSize: `${size}px`
  }).setOrigin(0.5).setResolution(2);
  title.setShadow(0, 4, "rgba(0,0,0,0.5)", 10, true, true);

  if (sealChar) {
    // 朱砂印：圆角方块 + 内白描 + 白字，斜盖在标题右下（与最后一字略有交叠）
    const box = size * 0.42;
    const seal = scene.add.container(
      title.x + title.width / 2 - box * 0.3,
      y + size * 0.8
    );
    const g = scene.add.graphics();
    g.fillStyle(PALETTE.cinnabar, 1);
    g.fillRoundedRect(-box / 2, -box / 2, box, box, box * 0.22);
    g.lineStyle(1.5, 0xfdf6ec, 0.9);
    g.strokeRoundedRect(-box / 2 + 2.5, -box / 2 + 2.5, box - 5, box - 5, box * 0.16);
    seal.add(g);
    seal.add(scene.add.text(0, 1, sealChar, {
      color: "#fdf6ec",
      fontFamily: FONT_TITLE,
      fontSize: `${Math.round(size * 0.26)}px`
    }).setOrigin(0.5).setResolution(2));
    seal.setRotation(Phaser.Math.DegToRad(-4));
  }
  return title;
}

/** 极简菜单行：大字距衬线文字，hover 笔触下划线+scale 1.03，highlight 常显下划线。 */
export function addMinimalMenuRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts?: { highlight?: boolean; fontSize?: number }
): MinimalRowHandle {
  ensureBrushTexture(scene);
  const highlight = opts?.highlight ?? false;
  const fontSize = opts?.fontSize ?? 28;

  const text = scene.add.text(0, 0, spacedText(label), {
    color: ROW_TEXT_COLOR,
    fontFamily: FONT_ROW,
    fontSize: `${fontSize}px`,
    fontStyle: "600"
  }).setOrigin(0.5).setResolution(2);
  text.setShadow(0, 1, "rgba(0,0,0,0.5)", 4, true, true);
  // 非高亮行默认略暗（原型 .mi.dim 78%），hover 时恢复全亮
  const restTextAlpha = highlight ? 1 : 0.78;
  text.setAlpha(restTextAlpha);

  const underline = scene.add.image(0, text.height / 2 + 8, BRUSH_TEXTURE_KEY)
    .setDisplaySize(text.width * 0.92, 12)
    .setTint(PALETTE.accentGold);
  const restLineAlpha = highlight ? 0.6 : 0;
  underline.setAlpha(restLineAlpha);

  const container = scene.add.container(x, y, [text, underline]);
  const hitWidth = text.width + 32;
  const hitHeight = text.height + 30;
  container.setInteractive(
    new Phaser.Geom.Rectangle(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight),
    Phaser.Geom.Rectangle.Contains
  );
  if (container.input) {
    container.input.cursor = "pointer";
  }

  let enabled = true;
  let hovering = false;

  const applyHover = (over: boolean): void => {
    hovering = over;
    scene.tweens.killTweensOf([text, underline]);
    scene.tweens.add({
      targets: text,
      scaleX: over ? 1.03 : 1,
      scaleY: over ? 1.03 : 1,
      alpha: over ? 1 : restTextAlpha,
      duration: 120,
      ease: Phaser.Math.Easing.Sine.Out
    });
    scene.tweens.add({
      targets: underline,
      alpha: over ? 1 : restLineAlpha,
      duration: 120,
      ease: Phaser.Math.Easing.Sine.Out
    });
  };

  container.on(Phaser.Input.Events.POINTER_OVER, () => {
    if (enabled) {
      applyHover(true);
    }
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    if (enabled) {
      applyHover(false);
    }
  });
  container.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (enabled) {
      onClick();
    }
  });

  return {
    container,
    setEnabled(next: boolean): void {
      enabled = next;
      if (!next) {
        container.disableInteractive();
        if (hovering) {
          applyHover(false);
        }
        container.setAlpha(0.45);
      } else {
        container.setInteractive(
          new Phaser.Geom.Rectangle(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight),
          Phaser.Geom.Rectangle.Contains
        );
        if (container.input) {
          container.input.cursor = "pointer";
        }
        container.setAlpha(1);
      }
    }
  };
}

/** 左下角"← 返回"小字行。 */
export function addMinimalBackRow(scene: Phaser.Scene, onClick: () => void): MinimalRowHandle {
  const x = 28;
  const y = scene.scale.height - 28;
  const text = scene.add.text(0, 0, "← 返回", {
    color: PALETTE.textSecondary,
    fontFamily: FONT_BODY,
    fontSize: "15px"
  }).setOrigin(0, 0.5).setResolution(2);

  const container = scene.add.container(x, y, [text]);
  const hitWidth = text.width + 20;
  const hitHeight = text.height + 16;
  const hitArea = new Phaser.Geom.Rectangle(-10, -hitHeight / 2, hitWidth, hitHeight);
  container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
  if (container.input) {
    container.input.cursor = "pointer";
  }

  let enabled = true;
  container.on(Phaser.Input.Events.POINTER_OVER, () => {
    if (enabled) {
      text.setColor(PALETTE.accentGoldCss);
    }
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    if (enabled) {
      text.setColor(PALETTE.textSecondary);
    }
  });
  container.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (enabled) {
      onClick();
    }
  });

  return {
    container,
    setEnabled(next: boolean): void {
      enabled = next;
      if (!next) {
        container.disableInteractive();
        container.setAlpha(0.45);
      } else {
        container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        if (container.input) {
          container.input.cursor = "pointer";
        }
        container.setAlpha(1);
      }
    }
  };
}
