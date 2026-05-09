import Phaser from "phaser";

export type ArtPanel = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export function createArtPanel(
  scene: Phaser.Scene,
  textureKey: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fallbackFill = 0x11140f,
  fallbackAlpha = 0.88
): ArtPanel {
  if (scene.textures.exists(textureKey)) {
    return scene.add.image(x, y, textureKey).setDisplaySize(width, height);
  }

  return scene.add
    .rectangle(x, y, width, height, fallbackFill, fallbackAlpha)
    .setStrokeStyle(2, 0xd6c28d, 0.88);
}

export function getSafePanelWidth(scene: Phaser.Scene, maxWidth: number, margin = 48): number {
  return Math.min(maxWidth, Math.max(280, scene.scale.width - margin * 2));
}
