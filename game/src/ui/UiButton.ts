import Phaser from "phaser";

export type UiButton = Phaser.GameObjects.Container & {
  setEnabled: (enabled: boolean) => void;
};

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
    onClick();
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
    container.setScale(1.04);
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("normal");
    container.setScale(1);
  });

  container.setEnabled = (nextEnabled: boolean) => {
    enabled = Boolean(nextEnabled);
    container.setAlpha(enabled ? 1 : 0.62);
    setBackgroundState(enabled ? "normal" : "disabled");
    icon.setAlpha(enabled ? 1 : 0.65);
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
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: `${fontSize}px`
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [background, text]) as UiButton;
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });
  container.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("pressed");
    onClick();
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
    container.setScale(1.02);
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    if (!enabled) {
      return;
    }
    setBackgroundState("normal");
    container.setScale(1);
  });

  container.setEnabled = (nextEnabled: boolean) => {
    enabled = Boolean(nextEnabled);
    container.setAlpha(enabled ? 1 : 0.65);
    setBackgroundState(enabled ? "normal" : "disabled");
    text.setColor(enabled ? "#f7f0d0" : "#a9ad9f");
    container.setScale(1);
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
