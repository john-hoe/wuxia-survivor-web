import Phaser from "phaser";
import type { RunSummary } from "../types";
import { inkWipeIn, inkWipeOut } from "../fx/InkWipe";
import { createArtPanel, getSafePanelWidth } from "../ui/ArtPanel";
import { spacedText } from "../ui/minimalTheme";
import { FONT_BODY, FONT_TITLE, PALETTE, fadeIn, transitionTo } from "../ui/visualConstants";
import { getAudioSystem, setRunSummary } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

type DeathTransitionData = {
  causeText?: string;
  runSummary?: RunSummary;
};

const AUTO_FINISH_MS = 2200;
const SKIP_GUARD_MS = 600;

export class DeathTransitionScene extends Phaser.Scene {
  private causeText = "血量耗尽";
  private runSummary?: RunSummary;
  private autoFinishTimer?: Phaser.Time.TimerEvent;
  private canSkip = false;
  private finished = false;

  constructor() {
    super(SCENE_KEYS.deathTransition);
  }

  init(data: DeathTransitionData): void {
    this.causeText = data.causeText ?? "血量耗尽";
    this.runSummary = data.runSummary;
    this.autoFinishTimer = undefined;
    this.canSkip = false;
    this.finished = false;
  }

  create(): void {
    enterScreen(this, "death_transition");
    getAudioSystem(this).playPlaceholder("hero_die");

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const panelCenterY = centerY + 8;

    this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x090606, 0.72);

    // 降饱和感：灰墨帷幕 alpha 0→0.5 渐强
    const grayVeil = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x111114, 0);
    this.tweens.add({
      targets: grayVeil,
      alpha: 0.5,
      duration: 1100,
      ease: Phaser.Math.Easing.Cubic.Out
    });

    // 墨色压边
    if (this.textures.exists("vfx_death_vignette")) {
      const vignette = this.add.image(centerX, centerY, "vfx_death_vignette")
        .setDisplaySize(this.scale.width, this.scale.height)
        .setAlpha(0);
      this.tweens.add({
        targets: vignette,
        alpha: 0.9,
        duration: 1200,
        ease: Phaser.Math.Easing.Cubic.Out
      });
    }

    createArtPanel(this, "ui_panel_death", centerX, panelCenterY, getSafePanelWidth(this, 620), 230, 0x11140f, 0.88);

    const titleText = this.add.text(centerX, panelCenterY - 8, spacedText("力竭倒地"), {
      color: PALETTE.textPrimary,
      fontFamily: FONT_TITLE,
      fontSize: "48px",
      fontStyle: "bold"
    }).setOrigin(0.5).setStroke("#101010", 6).setShadow(0, 4, "rgba(0,0,0,0.6)", 8, true, true).setResolution(2);
    titleText.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: titleText,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 420,
      delay: 120,
      ease: Phaser.Math.Easing.Back.Out
    });

    const causeText = this.add.text(centerX, panelCenterY + 38, this.causeText, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "24px"
    }).setOrigin(0.5).setAlpha(0).setResolution(2);
    this.tweens.add({
      targets: causeText,
      alpha: 1,
      duration: 340,
      delay: 340,
      ease: Phaser.Math.Easing.Cubic.Out
    });

    this.time.delayedCall(SKIP_GUARD_MS, () => {
      this.canSkip = true;
    });
    const skipAfterGuard = (): void => {
      if (this.canSkip) {
        this.finish();
      }
    };

    this.autoFinishTimer = this.time.delayedCall(AUTO_FINISH_MS, () => this.finish());
    this.input.on(Phaser.Input.Events.POINTER_DOWN, skipAfterGuard);
    this.input.keyboard?.on("keydown-SPACE", skipAfterGuard);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, skipAfterGuard);
      this.input.keyboard?.off("keydown-SPACE", skipAfterGuard);
    });

    // A 圆墨中晕过渡（替代原 fadeIn 淡入）：墨滴自中心晕开覆屏 → 满墨稍驻 → 反向收回，
    // 露出上方降饱和/压边/文字演出。Canvas 渲染器兜底原 300ms 淡入。
    const inkStarted = inkWipeIn(this, {
      mode: "center",
      durationMs: 1000,
      onComplete: () => {
        this.time.delayedCall(200, () => {
          inkWipeOut(this, { mode: "center", durationMs: 900 });
        });
      }
    });
    if (!inkStarted) {
      fadeIn(this, 300);
    }
  }

  private finish(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.autoFinishTimer?.remove(false);
    this.autoFinishTimer = undefined;
    const runSummary = this.runSummary ?? {
      runId: "death_transition_fallback",
      result: "dead",
      survivalSeconds: 0,
      kills: 0,
      level: 1,
      copperEarned: 0,
      bossDefeated: false,
      deathCause: this.causeText
    };
    setRunSummary(this, runSummary);
    this.scene.stop(SCENE_KEYS.game);
    transitionTo(this, SCENE_KEYS.result, runSummary);
  }
}
