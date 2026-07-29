import Phaser from "phaser";
import { addMinimalBackdrop, addMinimalMenuRow, addMinimalTitle } from "../ui/minimalTheme";
import { applyResolutionCamera, DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";
import { fadeIn } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

/**
 * 方向 C「极简碑林」：去面板化，四行大字距衬线菜单浮于压暗的游戏画面之上。
 * 氛围底 / 书法标题 / 菜单行（含 hover 笔触下划线）由共享 minimalTheme 模块统一绘制。
 */
const TITLE_Y = 86;
const FIRST_ROW_Y = 206;
const MENU_ROW_GAP = 62;
const MENU_FONT_SIZE = 26;
const STAGGER_MS = 80;

export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.pause);
  }

  create(): void {
    applyResolutionCamera(this);
    enterScreen(this, "pause");
    const centerX = DESIGN_WIDTH / 2;
    const centerY = DESIGN_HEIGHT / 2;

    // 半透明墨底压暗游戏画面（暂停语义，保留在氛围底之下）
    this.add.rectangle(centerX, centerY, DESIGN_WIDTH, DESIGN_HEIGHT, 0x050705, 0.66);
    addMinimalBackdrop(this);
    addMinimalTitle(this, "暂停", TITLE_Y, 46, "歇");

    const rows: Array<{ label: string; highlight?: boolean; onClick: () => void }> = [
      { label: "继续", highlight: true, onClick: () => this.resumeGame() },
      {
        label: "重新开始",
        onClick: () => {
          getAudioSystem(this).playPlaceholder("ui_click");
          this.fadeOutThen(() => {
            this.scene.stop(SCENE_KEYS.pause);
            this.scene.stop(SCENE_KEYS.game);
            this.scene.start(SCENE_KEYS.game);
          });
        }
      },
      {
        label: "回主菜单",
        onClick: () => {
          getAudioSystem(this).playPlaceholder("ui_click");
          this.fadeOutThen(() => {
            this.scene.stop(SCENE_KEYS.pause);
            this.scene.stop(SCENE_KEYS.game);
            this.scene.start(SCENE_KEYS.menu);
          });
        }
      },
      {
        label: "设置",
        onClick: () => {
          getAudioSystem(this).playPlaceholder("ui_click");
          this.scene.launch(SCENE_KEYS.settings, { returnTo: "pause" });
          this.scene.pause(SCENE_KEYS.pause);
        }
      }
    ];

    // 行入场 stagger：alpha 0→1、y+10→y，逐行延迟 80ms
    rows.forEach((row, index) => {
      const targetY = FIRST_ROW_Y + index * MENU_ROW_GAP;
      const handle = addMinimalMenuRow(this, centerX, targetY + 10, row.label, row.onClick, {
        highlight: row.highlight,
        fontSize: MENU_FONT_SIZE
      });
      handle.container.setAlpha(0);
      this.tweens.add({
        targets: handle.container,
        alpha: 1,
        y: targetY,
        duration: 220,
        delay: index * STAGGER_MS,
        ease: Phaser.Math.Easing.Quadratic.Out
      });
    });

    fadeIn(this);
  }

  /**
   * 暂停层的 stop+start 语义不能直接用 transitionTo：
   * 先淡出本场景相机，淡出完成后再 stop 并 start 目标场景。
   */
  private fadeOutThen(action: () => void): void {
    const camera = this.cameras.main;
    camera.fadeOut(180, 10, 10, 10);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, action);
  }

  private resumeGame(): void {
    getAudioSystem(this).playPlaceholder("pause_toggle");
    enterScreen(this, "game");
    eventBus.emit("pause_closed", {});
    this.scene.stop(SCENE_KEYS.pause);
    this.scene.resume(SCENE_KEYS.game);
  }
}
