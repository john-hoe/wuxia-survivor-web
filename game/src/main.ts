import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./scenes/BootScene";
import { DeathTransitionScene } from "./scenes/DeathTransitionScene";
import { GameScene } from "./scenes/GameScene";
import { InsightScene } from "./scenes/InsightScene";
import { MenuScene } from "./scenes/MenuScene";
import { PauseScene } from "./scenes/PauseScene";
import { ResultScene } from "./scenes/ResultScene";
import { ScriptureScene } from "./scenes/ScriptureScene";
import { SettingsScene } from "./scenes/SettingsScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#11140f",
  width: 960,
  height: 540,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    BootScene,
    MenuScene,
    GameScene,
    InsightScene,
    PauseScene,
    SettingsScene,
    DeathTransitionScene,
    ResultScene,
    ScriptureScene
  ]
};

new Phaser.Game(config);
