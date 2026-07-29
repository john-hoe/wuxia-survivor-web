import Phaser from "phaser";
import { DESIGN_WIDTH } from "./designSize";

export type ArtPanel = Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle;

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
    // 九宫格：四角 16px 保护区，面板任意尺寸拉伸不变形
    return scene.add
      .nineslice(x, y, textureKey, undefined, width, height, 16, 16, 16, 16)
      .setOrigin(0.5);
  }

  return scene.add
    .rectangle(x, y, width, height, fallbackFill, fallbackAlpha)
    .setStrokeStyle(2, 0xd6c28d, 0.88);
}

export function getSafePanelWidth(scene: Phaser.Scene, maxWidth: number, margin = 48): number {
  void scene; // 签名保留 scene 以便调用方一致；安全宽度按设计尺寸计算
  return Math.min(maxWidth, Math.max(280, DESIGN_WIDTH - margin * 2));
}
