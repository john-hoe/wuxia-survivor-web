import Phaser from "phaser";
import { bossConfigsById } from "../data/bosses";
import type { BossId } from "../data/bosses";
import type { RunSummary } from "../types";
import { applyRunSettlement, type RunSettlement } from "../systems/RunSettlementSystem";
import { applyResolutionCamera, DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";
import { addMinimalBackdrop, addMinimalMenuRow, addMinimalTitle } from "../ui/minimalTheme";
import { FONT_BODY, FONT_MONO, PALETTE, fadeIn, transitionTo } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem, getRunSummary } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

type ResultSceneData = Partial<RunSummary>;

type StatRowRefs = {
  container: Phaser.GameObjects.Container;
  valueText: Phaser.GameObjects.Text;
};

/** 方向C「极简碑林」：去面板化纵向疏朗布局（960×540 绝对坐标） */
const TITLE_Y = 84;
const TITLE_FONT_SIZE = 46;
const BOSS_LINE_Y = 130;
const STATS_ROW_WIDTH = 400;
const STATS_ROW_GAP = 46;
const STATS_FIRST_ROW_Y = 176;
const SAVE_LINE_Y = 358;
const DETAIL_LINE_Y = 378;
const MENU_ROW_GAP = 46;
const MENU_FIRST_ROW_Y = 424;
const MENU_FONT_SIZE = 24;
const STATS_STAGGER_MS = 120;
const COUNT_ROLL_MS = 600;
const BUTTON_STAGGER_BASE_MS = 540;
/** 点线引导色：PALETTE.textSecondary 的 int 形式 */
const LEADER_DOT_COLOR = 0x9a958a;

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
    applyResolutionCamera(this);
    enterScreen(this, "result");
    eventBus.emit("result_screen_opened", {});
    getAudioSystem(this).playPlaceholder("result_open");
    const settlement = applyRunSettlement(this, this.runSummary);
    this.runSummary = settlement.runSummary;

    const isWin = this.runSummary.result === "win";
    const isDead = this.runSummary.result === "dead";
    const title = isWin ? "凯旋归来" : this.runSummary.result === "debug" ? "调试终止" : "兵败山道";
    const sealChar = isWin ? "凯" : isDead ? "败" : undefined;
    // 标题描边：胜利芥金 / 失败朱砂 / 调试墨黑
    const titleStroke = isWin ? PALETTE.accentGoldCss : isDead ? PALETTE.cinnabarCss : "#101010";
    const { saveStatusText, detailText } = createSettlementLines(settlement);

    const centerX = DESIGN_WIDTH / 2;
    const centerY = DESIGN_HEIGHT / 2;

    // 方向C：无面板氛围底（替代旧 worldBg 纯色底 + ui_panel_modal 面板）
    addMinimalBackdrop(this);

    // 失败：墨色压边（暗角 alpha 渐强；压在氛围底之上、内容之下）
    if (isDead && this.textures.exists("vfx_death_vignette")) {
      const vignette = this.add.image(centerX, centerY, "vfx_death_vignette")
        .setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT)
        .setAlpha(0);
      this.tweens.add({
        targets: vignette,
        alpha: 0.55,
        duration: 900,
        ease: Phaser.Math.Easing.Cubic.Out
      });
    }

    // 书法标题 + 朱砂印；描边色按胜负覆写
    addMinimalTitle(this, title, TITLE_Y, TITLE_FONT_SIZE, sealChar).setStroke(titleStroke, 5);

    if (this.runSummary.bossDefeated) {
      // QA-002：按 RunSummary 实际携带的 bossId 显示 Boss 名（字段由其他代理补入 types.ts，缺省回退旧文案）
      const rawBossId = (this.runSummary as RunSummary & { bossId?: unknown }).bossId;
      const bossDisplayName = typeof rawBossId === "string" && rawBossId in bossConfigsById
        ? bossConfigsById[rawBossId as BossId].displayName
        : undefined;
      this.add.text(centerX, BOSS_LINE_Y, bossDisplayName ? `头目·${bossDisplayName} 已被击败` : "头目已被击败", {
        color: PALETTE.hpCss,
        fontFamily: FONT_BODY,
        fontSize: "14px"
      }).setOrigin(0.5).setResolution(2);
    }

    // 统计行：标签居左次级色 / 1px 点线引导 / 数值居右 FONT_MONO（铜钱芥金）
    const survivalRow = this.createStatRow(centerX, STATS_FIRST_ROW_Y, "存活时间", formatTime(this.runSummary.survivalSeconds));
    const killsRow = this.createStatRow(centerX, STATS_FIRST_ROW_Y + STATS_ROW_GAP, "击杀", `${this.runSummary.kills}`);
    const levelRow = this.createStatRow(centerX, STATS_FIRST_ROW_Y + STATS_ROW_GAP * 2, "等级", `${this.runSummary.level}`);
    const copperRow = this.createStatRow(centerX, STATS_FIRST_ROW_Y + STATS_ROW_GAP * 3, "铜钱", `+${this.runSummary.copperEarned}`, PALETTE.accentGoldCss);

    // 数字 600ms 从 0 滚动到终值
    const counters = { survival: 0, kills: 0, level: 0, copper: 0 };
    const updateCounterTexts = (): void => {
      survivalRow.valueText.setText(formatTime(Math.round(counters.survival)));
      killsRow.valueText.setText(`${Math.round(counters.kills)}`);
      levelRow.valueText.setText(`${Math.round(counters.level)}`);
      copperRow.valueText.setText(`+${Math.round(counters.copper)}`);
    };
    updateCounterTexts();

    const saveStatusLine = this.add.text(centerX, SAVE_LINE_Y, saveStatusText, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "12px",
      align: "center"
    }).setOrigin(0.5).setResolution(2);
    const detailLine = this.add.text(centerX, DETAIL_LINE_Y, detailText, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "12px",
      align: "center"
    }).setOrigin(0.5).setAlpha(0.85).setResolution(2);

    // 行 stagger 入场：alpha 0→1、y+10→0，逐行延迟 120ms
    const staggerTargets: Array<Phaser.GameObjects.Container | Phaser.GameObjects.Text> = [
      survivalRow.container,
      killsRow.container,
      levelRow.container,
      copperRow.container,
      saveStatusLine,
      detailLine
    ];
    staggerTargets.forEach((row, index) => {
      const targetY = row.y;
      const targetAlpha = row.alpha;
      row.setAlpha(0).setY(targetY + 10);
      this.tweens.add({
        targets: row,
        alpha: targetAlpha,
        y: targetY,
        duration: 300,
        delay: index * STATS_STAGGER_MS,
        ease: Phaser.Math.Easing.Cubic.Out
      });
    });

    this.tweens.add({
      targets: counters,
      survival: this.runSummary.survivalSeconds,
      kills: this.runSummary.kills,
      level: this.runSummary.level,
      copper: this.runSummary.copperEarned,
      duration: COUNT_ROLL_MS,
      delay: STATS_STAGGER_MS,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: updateCounterTexts
    });

    // 胜利：淡青 flash（等淡入结束后再闪）
    if (isWin) {
      this.time.delayedCall(300, () => {
        this.cameras.main.flash(240, 196, 224, 210);
      });
    }

    // 极简菜单行：再来一局（highlight 常显下划线）/ 翻阅秘籍 / 回主菜单
    const buttons: Array<{ label: string; highlight?: boolean; onClick: () => void }> = [
      {
        label: "再来一局",
        highlight: true,
        onClick: () => {
          getAudioSystem(this).playPlaceholder("ui_click");
          this.scene.stop(SCENE_KEYS.game);
          transitionTo(this, SCENE_KEYS.game);
        }
      },
      {
        label: "翻阅秘籍",
        onClick: () => {
          getAudioSystem(this).playPlaceholder("ui_click");
          transitionTo(this, SCENE_KEYS.scripture, { returnTo: "result", runSummary: this.runSummary });
        }
      },
      {
        label: "回主菜单",
        onClick: () => {
          getAudioSystem(this).playPlaceholder("ui_click");
          this.scene.stop(SCENE_KEYS.game);
          transitionTo(this, SCENE_KEYS.menu);
        }
      }
    ];
    buttons.forEach((button, index) => {
      const targetY = MENU_FIRST_ROW_Y + index * MENU_ROW_GAP;
      const menuRow = addMinimalMenuRow(this, centerX, targetY + 8, button.label, button.onClick, { highlight: button.highlight, fontSize: MENU_FONT_SIZE });
      menuRow.container.setAlpha(0);
      this.tweens.add({
        targets: menuRow.container,
        alpha: 1,
        y: targetY,
        duration: 220,
        delay: BUTTON_STAGGER_BASE_MS + index * 80,
        ease: Phaser.Math.Easing.Quadratic.Out
      });
    });

    fadeIn(this);
  }

  /** 单条统计行：标签居左次级色，1px 点线引导（alpha 0.2），数值居右 FONT_MONO。 */
  private createStatRow(centerX: number, y: number, label: string, finalValue: string, valueColor = PALETTE.textPrimary): StatRowRefs {
    const halfWidth = STATS_ROW_WIDTH / 2;
    const labelText = this.add.text(-halfWidth, 0, label, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "15px"
    }).setOrigin(0, 0.5).setResolution(2);
    // 先填最终数值以测量宽度定位点线，再清空交给计数滚动
    const valueText = this.add.text(halfWidth, 0, finalValue, {
      color: valueColor,
      fontFamily: FONT_MONO,
      fontSize: "17px",
      fontStyle: "bold"
    }).setOrigin(1, 0.5).setResolution(2);

    // 细虚线引导：2px 圆点距 6px，1px 高；计数滚动时点线位置保持不动
    const leader = this.add.graphics();
    leader.fillStyle(LEADER_DOT_COLOR, 0.2);
    const leaderStart = labelText.x + labelText.width + 16;
    const leaderEnd = valueText.x - valueText.width - 16;
    for (let dotX = leaderStart; dotX <= leaderEnd - 2; dotX += 6) {
      leader.fillRect(dotX, -0.5, 2, 1);
    }
    valueText.setText("");

    const container = this.add.container(centerX, y, [labelText, leader, valueText]);
    return { container, valueText };
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createSettlementLines(settlement: RunSettlement): { saveStatusText: string; detailText: string } {
  const breakdown = settlement.copperBreakdown;
  const saveStatusText = settlement.saveWritten
    ? `当前铜钱 ${settlement.totalCopperAfter}`
    : settlement.alreadyApplied
      ? `当前铜钱 ${settlement.totalCopperAfter}    本次结算已记录`
      : "本地存档失败，请稍后再试；本局铜钱未写入";

  // QA-002：头目奖励按实际被击败 Boss 显示（如「头目·断剑镖头 180」），无 Boss 信息时回退旧文案
  const bossPart = breakdown.bossBonus > 0
    ? `头目·${breakdown.bossRewardDisplayName ?? "未知"} ${breakdown.bossBonus}`
    : `头目 ${breakdown.bossBonus}`;

  return {
    saveStatusText,
    detailText: `明细：存活 ${breakdown.survivalCopper} + 击杀 ${breakdown.killCopper} + 等级 ${breakdown.levelCopper} + ${bossPart}`
  };
}
