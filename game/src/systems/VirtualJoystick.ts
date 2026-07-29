import Phaser from "phaser";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";

export type JoystickSnapshot = {
  x: number;
  y: number;
  magnitude: number;
  active: boolean;
};

export class VirtualJoystick {
  private readonly base: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  private readonly touchZone = new Phaser.Geom.Rectangle();
  private readonly touchCapable: boolean;
  private readonly visualRadius = 64;
  private readonly outputRadius = 48;
  private readonly deadZoneRadius = 6.4;
  private readonly restingBaseAlpha = 0.55;
  private readonly restingThumbAlpha = 0.62;
  private readonly pressedBaseAlpha = 0.8;
  private readonly pressedThumbAlpha = 0.9;
  private baseX = 0;
  private baseY = 0;
  private activePointerId: number | undefined;
  private outputX = 0;
  private outputY = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.touchCapable = scene.sys.game.device.input.touch;
    this.updateLayout();

    this.base = scene.add.circle(this.baseX, this.baseY, this.visualRadius, 0x0f1712, this.restingBaseAlpha)
      .setStrokeStyle(2, 0xd6c28d, 0.56)
      .setDepth(920)
      .setScrollFactor(0);
    this.thumb = scene.add.circle(this.baseX, this.baseY, 24, 0xbfe7d1, this.restingThumbAlpha)
      .setStrokeStyle(2, 0xf7f0d0, 0.72)
      .setDepth(921)
      .setScrollFactor(0);

    if (!this.touchCapable) {
      // 桌面端隐藏虚拟摇杆，键盘操作无需任何触控监听。
      this.base.setVisible(false);
      this.thumb.setVisible(false);
      return;
    }

    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }

  getSnapshot(): JoystickSnapshot {
    const magnitude = Math.min(1, Math.hypot(this.outputX, this.outputY));
    return {
      x: this.outputX,
      y: this.outputY,
      magnitude,
      active: this.activePointerId !== undefined
    };
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.base.destroy();
    this.thumb.destroy();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // 高 DPR：画布物理像素是设计坐标的 K 倍，pointer.x/y 为渲染像素坐标；
    // worldX/worldY 经相机 zoom(K) 逆变换回到 960×540 设计单位（本场景相机 scroll 恒 0），布局/命中必须用它。
    if (this.activePointerId !== undefined || !this.touchZone.contains(pointer.worldX, pointer.worldY)) {
      return;
    }

    this.activePointerId = pointer.id;
    // 动态摇杆：落点即摇杆中心（钳制在屏幕内并避开顶部 HUD 区）。
    this.baseX = Phaser.Math.Clamp(pointer.worldX, 56, DESIGN_WIDTH - 56);
    this.baseY = Phaser.Math.Clamp(pointer.worldY, 152, DESIGN_HEIGHT - 40);
    this.base.setPosition(this.baseX, this.baseY);
    this.updateOutput(pointer);
    this.base.setAlpha(this.pressedBaseAlpha);
    this.thumb.setAlpha(this.pressedThumbAlpha);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) {
      return;
    }

    this.updateOutput(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) {
      return;
    }

    this.activePointerId = undefined;
    this.updateLayout();
    this.base.setPosition(this.baseX, this.baseY);
    this.resetOutput();
  }

  private updateOutput(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.worldX - this.baseX;
    const dy = pointer.worldY - this.baseY;
    const distance = Math.hypot(dx, dy);

    if (distance <= this.deadZoneRadius) {
      this.outputX = 0;
      this.outputY = 0;
      this.thumb.setPosition(this.baseX, this.baseY);
      return;
    }

    const clampedDistance = Math.min(distance, this.outputRadius);
    const normalizedX = dx / distance;
    const normalizedY = dy / distance;
    const magnitude = clampedDistance / this.outputRadius;

    this.outputX = normalizedX * magnitude;
    this.outputY = normalizedY * magnitude;
    this.thumb.setPosition(
      this.baseX + normalizedX * clampedDistance,
      this.baseY + normalizedY * clampedDistance
    );
  }

  private handleResize(): void {
    this.activePointerId = undefined;
    this.updateLayout();
    this.base.setPosition(this.baseX, this.baseY);
    this.resetOutput();
  }

  private updateLayout(): void {
    this.baseX = 104;
    this.baseY = DESIGN_HEIGHT - 104;
    this.touchZone.setTo(0, 96, DESIGN_WIDTH, DESIGN_HEIGHT - 96);
  }

  private resetOutput(): void {
    this.outputX = 0;
    this.outputY = 0;
    this.thumb.setPosition(this.baseX, this.baseY);
    this.base.setAlpha(this.restingBaseAlpha);
    this.thumb.setAlpha(this.restingThumbAlpha);
  }
}
