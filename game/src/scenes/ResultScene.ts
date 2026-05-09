import Phaser from "phaser";
import type { RunSummary } from "../types";
import { applyRunSettlement, type RunSettlement } from "../systems/RunSettlementSystem";
import { createArtPanel, getSafePanelWidth } from "../ui/ArtPanel";
import { createIconButton, createTextButton } from "../ui/UiButton";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem, getRunSummary } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

type ResultSceneData = Partial<RunSummary>;

const RESULT_PANEL_WIDTH = 660;
const RESULT_PANEL_HEIGHT = 480;
const RESULT_BUTTON_ROW_Y_OFFSET = 177;
const RESULT_RESTART_X_OFFSET = -154;
const RESULT_HOME_X_OFFSET = -82;
const RESULT_SCRIPTURE_X_OFFSET = 85;
const RESULT_ICON_BUTTON_SIZE = 48;
const RESULT_ICON_SIZE = 30;
const RESULT_TEXT_BUTTON_WIDTH = 190;
const RESULT_TEXT_BUTTON_HEIGHT = 44;
const RESULT_STATS_ROW_Y_OFFSETS = [-77, -41, -5] as const;
const RESULT_STATS_FONT_SIZE = "20px";

export class ResultScene extends Phaser.Scene {
  private runSummary: RunSummary = {
    runId: "result_scene_default",
    result: "debug",
    survivalSeconds: 0,
    kills: 0,
    level: 1,
    copperEarned: 0,
    bossDefeated: false
  };

  constructor() {
    super(SCENE_KEYS.result);
  }

  init(data: ResultSceneData): void {
    this.runSummary = {
      ...getRunSummary(this),
      ...data
    };
  }

  create(): void {
    enterScreen(this, "result");
    eventBus.emit("result_screen_opened", {});
    getAudioSystem(this).playPlaceholder("result_open");
    const settlement = applyRunSettlement(this, this.runSummary);
    this.runSummary = settlement.runSummary;

    const title = this.runSummary.result === "win" ? "胜利" : this.runSummary.result === "debug" ? "调试终止" : "失败";
    const survivalText = formatTime(this.runSummary.survivalSeconds);
    const resultStatusText = this.runSummary.bossDefeated ? `${title}\n头目 黑风寨主 已击败` : title;
    const settlementLines = createSettlementLines(settlement);

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x18251f);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const controlRowY = centerY + RESULT_BUTTON_ROW_Y_OFFSET;

    createArtPanel(this, "ui_panel_result", centerX, centerY, getSafePanelWidth(this, RESULT_PANEL_WIDTH), RESULT_PANEL_HEIGHT, 0x11140f, 0.78);
    this.add.text(this.scale.width / 2, 108, "战后清点", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "42px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.add.text(this.scale.width / 2, 146, resultStatusText, {
      color: "#d8ead9",
      fontFamily: "system-ui, sans-serif",
      fontSize: "22px",
      align: "center",
      lineSpacing: 6
    }).setOrigin(0.5);
    [
      `存活时间 ${survivalText}    击杀 ${this.runSummary.kills}    等级 ${this.runSummary.level}`,
      ...settlementLines
    ].forEach((line, index) => {
      this.add.text(centerX, centerY + RESULT_STATS_ROW_Y_OFFSETS[index], line, {
        color: "#d8ead9",
        fontFamily: "system-ui, sans-serif",
        fontSize: RESULT_STATS_FONT_SIZE,
        align: "center"
      }).setOrigin(0.5);
    });

    createIconButton(this, centerX + RESULT_RESTART_X_OFFSET, controlRowY, "ui_icon_restart", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.game);
    }, RESULT_ICON_BUTTON_SIZE, RESULT_ICON_SIZE);
    createIconButton(this, centerX + RESULT_HOME_X_OFFSET, controlRowY, "ui_icon_home", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.stop(SCENE_KEYS.game);
      this.scene.start(SCENE_KEYS.menu);
    }, RESULT_ICON_BUTTON_SIZE, RESULT_ICON_SIZE);
    createTextButton(this, centerX + RESULT_SCRIPTURE_X_OFFSET, controlRowY, "翻阅秘籍", () => {
      getAudioSystem(this).playPlaceholder("ui_click");
      this.scene.start(SCENE_KEYS.scripture, { returnTo: "result", runSummary: this.runSummary });
    }, RESULT_TEXT_BUTTON_WIDTH, RESULT_TEXT_BUTTON_HEIGHT);
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createSettlementLines(settlement: RunSettlement): [string, string] {
  const breakdown = settlement.copperBreakdown;
  const saveStatusText = settlement.saveWritten
    ? `当前铜钱 ${settlement.totalCopperAfter}`
    : settlement.alreadyApplied
      ? `当前铜钱 ${settlement.totalCopperAfter}    本次结算已记录`
      : "本地存档失败，请稍后再试；本局铜钱未写入";

  return [
    `铜钱 +${settlement.runSummary.copperEarned}    ${saveStatusText}`,
    `明细：存活 ${breakdown.survivalCopper} + 击杀 ${breakdown.killCopper} + 等级 ${breakdown.levelCopper} + 头目 ${breakdown.bossBonus}`
  ];
}
