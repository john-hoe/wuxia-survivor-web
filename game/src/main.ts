import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./scenes/BootScene";
import { DeathTransitionScene } from "./scenes/DeathTransitionScene";
import { GameScene } from "./scenes/GameScene";
import { InsightScene } from "./scenes/InsightScene";
import { MenuScene } from "./scenes/MenuScene";
import { MeridianScene } from "./scenes/MeridianScene";
import { PauseScene } from "./scenes/PauseScene";
import { ResultScene } from "./scenes/ResultScene";
import { ScriptureScene } from "./scenes/ScriptureScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { RENDER_HEIGHT, RENDER_WIDTH } from "./ui/designSize";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#11140f",
  // 高 DPR 高清渲染：画布物理尺寸 = 设计尺寸 960×540 × K（K = min(devicePixelRatio, 2)），
  // 各场景相机 setZoom(K) + centerOn(480,270) 把设计内容铺满 K 倍画布（见 ui/designSize.ts）
  width: RENDER_WIDTH,
  height: RENDER_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // 吸附整数 CSS 像素，避免亚像素模糊；文本锐度由 Text.setResolution(2) × 相机 zoom K 共同保证
    autoRound: true
  },
  render: {
    antialias: true,
    // 2 的幂纹理（角色/特效表已 POT 化）启用 mipmap，缩小时走多级采样而非线性模糊
    mipmapFilter: "LINEAR_MIPMAP_LINEAR"
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
    ScriptureScene,
    MeridianScene
  ]
};

const game = new Phaser.Game(config);
// QA 探针：自动化验收/控制台读取相机 zoom、画布尺寸等运行态（只读句柄，不影响游戏逻辑）
(window as unknown as { __WUXIA_GAME__?: Phaser.Game }).__WUXIA_GAME__ = game;
