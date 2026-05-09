import Phaser from "phaser";
import { eventBus } from "../utils/EventBus";
import { VirtualJoystick } from "./VirtualJoystick";

export type HeroInputSource = "none" | "keyboard" | "joystick";

export type HeroMovementSnapshot = {
  x: number;
  y: number;
  speed: number;
  deltaX: number;
  deltaY: number;
  velocityX: number;
  velocityY: number;
  velocityMagnitude: number;
  inputX: number;
  inputY: number;
  inputMagnitude: number;
  inputSource: HeroInputSource;
  originRebaseCount: number;
};

type MovementKeys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
};

export class HeroMovementSystem {
  private readonly keys?: MovementKeys;
  private readonly joystick: VirtualJoystick;
  private readonly baseMoveSpeed: number;
  private moveSpeed: number;
  private moveSpeedBonusLevels = 0;
  // 20480px is a shared period for 512px and 1024px MVP background tiles, keeping rebase visually continuous.
  private readonly rebaseThreshold = 20480;
  private worldX = 0;
  private worldY = 0;
  private deltaX = 0;
  private deltaY = 0;
  private inputX = 0;
  private inputY = 0;
  private inputMagnitude = 0;
  private inputSource: HeroInputSource = "none";
  private originRebaseCount = 0;
  private lastMoveEventAtMs = Number.NEGATIVE_INFINITY;

  constructor(private readonly scene: Phaser.Scene, moveSpeed = 220) {
    this.baseMoveSpeed = moveSpeed;
    this.moveSpeed = moveSpeed;
    this.joystick = new VirtualJoystick(scene);

    if (scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        d: Phaser.Input.Keyboard.KeyCodes.D
      }) as MovementKeys;
    }

    eventBus.emit("hero_spawned", {
      x: this.worldX,
      y: this.worldY,
      moveSpeed: this.moveSpeed
    });
  }

  update(deltaMs: number): HeroMovementSnapshot {
    this.readInput();

    const clampedDeltaSeconds = Math.min(deltaMs, 50) / 1000;
    const previousX = this.worldX;
    const previousY = this.worldY;
    this.deltaX = this.inputX * this.moveSpeed * clampedDeltaSeconds;
    this.deltaY = this.inputY * this.moveSpeed * clampedDeltaSeconds;
    this.worldX += this.deltaX;
    this.worldY += this.deltaY;

    const rebased = this.rebaseIfNeeded();
    this.emitMovementIfNeeded(previousX, previousY, rebased);

    return this.getSnapshot();
  }

  getSnapshot(): HeroMovementSnapshot {
    return {
      x: this.worldX,
      y: this.worldY,
      speed: this.moveSpeed,
      deltaX: this.deltaX,
      deltaY: this.deltaY,
      velocityX: roundForDebug(this.inputX * this.moveSpeed),
      velocityY: roundForDebug(this.inputY * this.moveSpeed),
      velocityMagnitude: roundForDebug(this.inputMagnitude * this.moveSpeed),
      inputX: roundForDebug(this.inputX),
      inputY: roundForDebug(this.inputY),
      inputMagnitude: roundForDebug(this.inputMagnitude),
      inputSource: this.inputSource,
      originRebaseCount: this.originRebaseCount
    };
  }

  increaseMoveSpeedPercent(percent: number): number {
    this.moveSpeedBonusLevels = Math.min(5, this.moveSpeedBonusLevels + 1);
    const bonusPerLevel = Math.max(0, percent);
    this.moveSpeed = Math.min(
      Math.round(this.baseMoveSpeed * 1.25),
      Math.round(this.baseMoveSpeed * (1 + bonusPerLevel * this.moveSpeedBonusLevels))
    );
    return this.moveSpeed;
  }

  destroy(): void {
    this.joystick.destroy();
  }

  private readInput(): void {
    const joystickSnapshot = this.joystick.getSnapshot();
    if (joystickSnapshot.magnitude > 0) {
      this.inputX = joystickSnapshot.x;
      this.inputY = joystickSnapshot.y;
      this.inputMagnitude = joystickSnapshot.magnitude;
      this.inputSource = "joystick";
      return;
    }

    const keyboardInput = this.readKeyboardInput();
    this.inputX = keyboardInput.x;
    this.inputY = keyboardInput.y;
    this.inputMagnitude = Math.hypot(this.inputX, this.inputY);
    this.inputSource = this.inputMagnitude > 0 ? "keyboard" : "none";
  }

  private readKeyboardInput(): { x: number; y: number } {
    if (!this.keys) {
      return { x: 0, y: 0 };
    }

    const horizontal = Number(this.keys.right.isDown || this.keys.d.isDown) - Number(this.keys.left.isDown || this.keys.a.isDown);
    const vertical = Number(this.keys.down.isDown || this.keys.s.isDown) - Number(this.keys.up.isDown || this.keys.w.isDown);
    const length = Math.hypot(horizontal, vertical);

    if (length <= 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: horizontal / length,
      y: vertical / length
    };
  }

  private rebaseIfNeeded(): boolean {
    if (Math.abs(this.worldX) < this.rebaseThreshold && Math.abs(this.worldY) < this.rebaseThreshold) {
      return false;
    }

    const offsetX = calculateRebaseOffset(this.worldX, this.rebaseThreshold);
    const offsetY = calculateRebaseOffset(this.worldY, this.rebaseThreshold);
    this.worldX -= offsetX;
    this.worldY -= offsetY;
    this.originRebaseCount += 1;
    eventBus.emit("origin_rebased", {
      originRebaseCount: this.originRebaseCount,
      offsetX,
      offsetY
    });
    return true;
  }

  private emitMovementIfNeeded(previousX: number, previousY: number, rebased: boolean): void {
    if (rebased) {
      return;
    }

    const movedDistance = Math.hypot(this.worldX - previousX, this.worldY - previousY);
    if (movedDistance <= 0.01) {
      return;
    }

    const nowMs = this.scene.time.now;
    if (nowMs - this.lastMoveEventAtMs < 120) {
      return;
    }

    this.lastMoveEventAtMs = nowMs;
    eventBus.emit("hero_moved", {
      x: roundForDebug(this.worldX),
      y: roundForDebug(this.worldY),
      inputX: roundForDebug(this.inputX),
      inputY: roundForDebug(this.inputY),
      inputSource: this.inputSource
    });
  }
}

function roundForDebug(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function calculateRebaseOffset(value: number, threshold: number): number {
  if (Math.abs(value) < threshold) {
    return 0;
  }

  return Math.trunc(value / threshold) * threshold;
}
