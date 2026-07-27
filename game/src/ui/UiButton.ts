import Phaser from "phaser";
import { FONT_TITLE, PALETTE } from "./visualConstants";

export type UiButton = Phaser.GameObjects.Container & {
  setEnabled: (enabled: boolean) => void;
};

const HOVER_SCALE = 1.04;
const PRESS_SCALE = 0.96;
const PRESS_HOLD_MS = 80;

/** 弹性缩放：统一 kill 旧 tween，Back.easeOut 回弹。 */
function tweenButtonScale(scene: Phaser.Scene, container: Phaser.GameObjects.Container, target: number, duration = 160): void {
  scene.tweens.killTweensOf(container);
  scene.tweens.add({
    targets: container,
    scaleX: target,
    scaleY: target,
    duration,
    ease: Phaser.Math.Easing.Back.Out
  });
}

export function createIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textureKey: string,
  onClick: () => void,
  size = 56,
  iconSize = 36
): UiButton {
  const hasArtButton = scene.textures.exists("ui_button_primary");
  const background = hasArtButton
    ? scene.add.image(0, 0, "ui_button_primary", 0).setDisplaySize(size, size)
    : scene.add.rectangle(0, 0, size, size, 0x2f5b4f, 1).setStrokeStyle(2, 0xd6c28d, 0.9);
  const icon = scene.textures.exists(textureKey)
    ? scene.add.image(0, 0, textureKey).setDisplaySize(iconSize, iconSize)
    : scene.add.rectangle(0, 0, iconSize, iconSize, 0x102019, 1).setStrokeStyle(2, 0xd6c28d, 0.8);
  let enabled = true;

  const setBackgroundState = (state: "normal" | "hover" | "pressed" | "disabled"): void => {
    if (background instanceof Phaser.GameObjects.Image) {
      const frame = state === "pressed" ? 1 : state === "disabled" ? 2 : 0;
      background.setFrame(frame);
      background.setAlpha(state === "disabled" ? 0.72 : 1);
      background.setTint(state === "hover" ? 0xf7fff0 : 0xffffff);
      return;
    }

    const fill = state === "pressed"
      ? 0x24473e
      : state === "hover"
        ? 0x3a6f61
        : state === "disabled"
          ? 0x25332e
          : 0x2f5b4f;
    background.setFillStyle(fill, state === "disabled" ? 0.86 : 1);
    background.setStrokeStyle(2, state === "disabled" ? 0x7b7259 : 0xd6c28d, state === "disabled" ? 0.7 : 0.9);
  };

  const container = scene.add.container(x, y, [background, icon]) as UiButton;
  container.setSize(size, size);
  container.setInteractive({ useHandCursor: true });
  container.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("pressed");
    tweenButtonScale(scene, container, PRESS_SCALE, 70);
    // 按下态保持 80ms 再触发回调，让"按下去"的反馈可被感知
    scene.time.delayedCall(PRESS_HOLD_MS, () => {
      if (!container.active) {
        return;
      }
      tweenButtonScale(scene, container, 1, 190);
      onClick();
    });
  });
  container.on(Phaser.Input.Events.POINTER_UP, () => {
    if (enabled) {
      setBackgroundState("hover");
    }
  });
  container.on(Phaser.Input.Events.POINTER_OVER, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("hover");
    tweenButtonScale(scene, container, HOVER_SCALE);
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("normal");
    tweenButtonScale(scene, container, 1);
  });

  container.setEnabled = (nextEnabled: boolean) => {
    enabled = Boolean(nextEnabled);
    container.setAlpha(enabled ? 1 : 0.62);
    setBackgroundState(enabled ? "normal" : "disabled");
    icon.setAlpha(enabled ? 1 : 0.65);
    scene.tweens.killTweensOf(container);
    container.setScale(1);
    if (enabled) {
      container.setInteractive({ useHandCursor: true });
    } else {
      container.disableInteractive();
    }
  };

  return container;
}

export function createTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 260,
  height = 64
): UiButton {
  const normalFill = 0x2f5b4f;
  const hoverFill = 0x3a6f61;
  const pressedFill = 0x24473e;
  const disabledFill = 0x25332e;
  const normalStroke = 0xd6c28d;
  const disabledStroke = 0x7b7259;
  let enabled = true;

  const hasArtButton = scene.textures.exists("ui_button_primary");
  const hasDisabledArtButton = scene.textures.exists("ui_button_disabled");
  const background = hasArtButton
    ? scene.add.image(0, 0, "ui_button_primary", 0).setDisplaySize(width, height)
    : scene.add.rectangle(0, 0, width, height, normalFill, 1).setStrokeStyle(2, normalStroke, 0.9);

  const setBackgroundState = (state: "normal" | "hover" | "pressed" | "disabled"): void => {
    if (background instanceof Phaser.GameObjects.Image) {
      if (state === "disabled" && hasDisabledArtButton) {
        background
          .setTexture("ui_button_disabled")
          .setDisplaySize(width, height)
          .setAlpha(0.9)
          .clearTint();
        return;
      }

      background
        .setTexture("ui_button_primary")
        .setDisplaySize(width, height);
      const frame = state === "pressed" ? 1 : state === "disabled" ? 2 : 0;
      background.setFrame(frame);
      background.setAlpha(state === "disabled" ? 0.78 : 1);
      background.setTint(state === "hover" ? 0xf7fff0 : 0xffffff);
      return;
    }

    const fill = state === "pressed"
      ? pressedFill
      : state === "hover"
        ? hoverFill
        : state === "disabled"
          ? disabledFill
          : normalFill;
    background.setFillStyle(fill, state === "disabled" ? 0.9 : 1);
    background.setStrokeStyle(2, state === "disabled" ? disabledStroke : normalStroke, state === "disabled" ? 0.7 : 0.9);
  };

  const fontSize = getButtonFontSize(label, width, height);
  const text = scene.add
    .text(0, 0, label, {
      color: PALETTE.textPrimary,
      fontFamily: FONT_TITLE,
      fontSize: `${fontSize}px`
    })
    .setOrigin(0.5)
    .setResolution(2);

  const container = scene.add.container(x, y, [background, text]) as UiButton;
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });
  container.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("pressed");
    tweenButtonScale(scene, container, PRESS_SCALE, 70);
    // 按下态保持 80ms 再触发回调
    scene.time.delayedCall(PRESS_HOLD_MS, () => {
      if (!container.active) {
        return;
      }
      tweenButtonScale(scene, container, 1, 190);
      onClick();
    });
  });
  container.on(Phaser.Input.Events.POINTER_UP, () => {
    if (enabled) {
      setBackgroundState("hover");
    }
  });
  container.on(Phaser.Input.Events.POINTER_OVER, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("hover");
    tweenButtonScale(scene, container, HOVER_SCALE);
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("normal");
    tweenButtonScale(scene, container, 1);
  });

  container.setEnabled = (nextEnabled: boolean) => {
    enabled = Boolean(nextEnabled);
    container.setAlpha(enabled ? 1 : 0.65);
    setBackgroundState(enabled ? "normal" : "disabled");
    text.setColor(enabled ? PALETTE.textPrimary : PALETTE.textSecondary);
    scene.tweens.killTweensOf(container);
    container.setScale(1);
    if (enabled) {
      container.setInteractive({ useHandCursor: true });
    } else {
      container.disableInteractive();
    }
  };

  return container;
}

const MENU_ROW_SLIDE_PX = 6;
const MENU_ROW_TWEEN_MS = 120;

export type MenuRowOptions = {
  /** 主 CTA 常态微亮：金色竖条常显 + 文字常态芥金，仅作视觉提示，hover 时恢复全亮。 */
  highlight?: boolean;
  /** 行左侧图标纹理 key（textures.exists 防御，纹理缺失时静默省略，不影响布局）。 */
  icon?: string;
};

/**
 * 全宽菜单行：无重底色，hover 时左侧芥金竖条淡入 + 文字转金 + 整体右移 6px。
 * 用于暂停/设置等弹窗的纵向菜单列表；options.highlight 可标记主行动按钮（常态微亮）。
 */
export function createMenuRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 320,
  height = 56,
  options?: MenuRowOptions
): UiButton {
  const baseX = x;
  const highlight = options?.highlight ?? false;
  const restBarAlpha = highlight ? 0.55 : 0;
  const restTextColor = highlight ? PALETTE.accentGoldCss : PALETTE.textPrimary;
  let enabled = true;

  const background = scene.add.rectangle(0, 0, width, height, PALETTE.panelBg, highlight ? 0.22 : 0.14);
  const accentBar = scene.add.rectangle(-width / 2 + 1.5, 0, 3, height - 14, PALETTE.accentGold, restBarAlpha);
  const text = scene.add
    .text(0, 0, label, {
      color: restTextColor,
      fontFamily: FONT_TITLE,
      fontSize: "22px"
    })
    .setOrigin(0.5)
    .setResolution(2);

  // 可选行图标：固定在行左侧，文字仍整体居中，不做右移补偿
  const children: Phaser.GameObjects.GameObject[] = [background, accentBar];
  if (options?.icon && scene.textures.exists(options.icon)) {
    children.push(scene.add.image(-width / 2 + 26, 0, options.icon).setDisplaySize(24, 24));
  }
  children.push(text);

  const container = scene.add.container(x, y, children) as UiButton;
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  const tweenSlide = (targetX: number): void => {
    scene.tweens.killTweensOf(container);
    scene.tweens.add({
      targets: container,
      x: targetX,
      duration: MENU_ROW_TWEEN_MS,
      ease: Phaser.Math.Easing.Quadratic.Out
    });
  };
  const tweenBar = (alpha: number): void => {
    scene.tweens.killTweensOf(accentBar);
    scene.tweens.add({
      targets: accentBar,
      alpha,
      duration: MENU_ROW_TWEEN_MS,
      ease: Phaser.Math.Easing.Quadratic.Out
    });
  };

  container.on(Phaser.Input.Events.POINTER_OVER, () => {
    if (!enabled) {
      return;
    }
    tweenBar(1);
    tweenSlide(baseX + MENU_ROW_SLIDE_PX);
    text.setColor(PALETTE.accentGoldCss);
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    if (!enabled) {
      return;
    }
    tweenBar(restBarAlpha);
    tweenSlide(baseX);
    text.setColor(restTextColor);
  });
  container.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (!enabled) {
      return;
    }
    // alpha 0.7 闪 80ms 后再触发回调，让点击反馈可被感知
    container.setAlpha(0.7);
    scene.time.delayedCall(PRESS_HOLD_MS, () => {
      if (!container.active) {
        return;
      }
      container.setAlpha(1);
      onClick();
    });
  });

  container.setEnabled = (nextEnabled: boolean) => {
    enabled = Boolean(nextEnabled);
    scene.tweens.killTweensOf(container);
    scene.tweens.killTweensOf(accentBar);
    container.setX(baseX);
    accentBar.setAlpha(enabled ? restBarAlpha : 0);
    text.setColor(enabled ? restTextColor : PALETTE.textPrimary);
    container.setAlpha(enabled ? 1 : 0.35);
    if (enabled) {
      container.setInteractive({ useHandCursor: true });
    } else {
      container.disableInteractive();
    }
  };

  return container;
}

function getButtonFontSize(label: string, width: number, height: number): number {
  const visualLength = Array.from(label).reduce((total, char) => total + (/[\x00-\x7F]/.test(char) ? 0.55 : 1), 0);
  const heightLimit = Math.floor(height * 0.4);
  const widthLimit = Math.floor((width * 0.74) / Math.max(visualLength, 1));
  return Phaser.Math.Clamp(Math.min(24, heightLimit, widthLimit), 16, 24);
}
