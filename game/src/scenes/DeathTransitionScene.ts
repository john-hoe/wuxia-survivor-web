import Phaser from "phaser";
import type { RunSummary } from "../types";
import { createArtPanel, getSafePanelWidth } from "../ui/ArtPanel";
import { getAudioSystem, setRunSummary } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

type DeathTransitionData = {
  causeText?: string;
  runSummary?: RunSummary;
};

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

    const panelCenterY = this.scale.height / 2 + 8;
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x090606, 0.78);
    if (this.textures.exists("vfx_death_vignette")) {
      this.add.image(this.scale.width / 2, this.scale.height / 2, "vfx_death_vignette")
        .setDisplaySize(this.scale.width, this.scale.height)
        .setAlpha(0.9);
    }
    createArtPanel(this, "ui_panel_death", this.scale.width / 2, panelCenterY, getSafePanelWidth(this, 620), 230, 0x11140f, 0.88);
    this.add.text(this.scale.width / 2, panelCenterY - 8, "力竭倒地", {
      color: "#f1d5c5",
      fontFamily: "system-ui, sans-serif",
      fontSize: "44px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.add.text(this.scale.width / 2, panelCenterY + 38, this.causeText, {
      color: "#e8b49d",
      fontFamily: "system-ui, sans-serif",
      fontSize: "24px"
    }).setOrigin(0.5);

    this.time.delayedCall(600, () => {
      this.canSkip = true;
    });
    const skipAfterGuard = (): void => {
      if (this.canSkip) {
        this.finish();
      }
    };

    this.autoFinishTimer = this.time.delayedCall(1000, () => this.finish());
    this.input.on(Phaser.Input.Events.POINTER_DOWN, skipAfterGuard);
    this.input.keyboard?.on("keydown-SPACE", skipAfterGuard);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, skipAfterGuard);
      this.input.keyboard?.off("keydown-SPACE", skipAfterGuard);
    });
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
    this.scene.start(SCENE_KEYS.result, runSummary);
  }
}
