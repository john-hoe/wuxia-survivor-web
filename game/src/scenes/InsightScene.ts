import Phaser from "phaser";
import type { InsightOption, PendingInsight } from "../data/progression";
import { applyResolutionCamera, DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";
import { createTextButton } from "../ui/UiButton";
import { fadeIn, FONT_BODY, FONT_TITLE, PALETTE } from "../ui/visualConstants";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

type InsightCardRefs = {
  optionId: string;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
};

export class InsightScene extends Phaser.Scene {
  private selected = false;
  private keyboardOffCallbacks: Array<() => void> = [];
  private cards: InsightCardRefs[] = [];

  constructor() {
    super(SCENE_KEYS.insight);
  }

  create(data?: PendingInsight): void {
    this.selected = false;
    this.keyboardOffCallbacks = [];
    this.cards = [];
    applyResolutionCamera(this);
    enterScreen(this, "insight");
    const pendingInsight = isPendingInsight(data) ? data : createFallbackInsight();
    this.add.rectangle(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x0f1512, 0.93);
    if (this.textures.exists("vfx_insight_burst")) {
      const burst = this.add.image(DESIGN_WIDTH / 2, 158, "vfx_insight_burst")
        .setDisplaySize(210, 210)
        .setAlpha(0.34)
        .setBlendMode(Phaser.BlendModes.ADD);
      const baseScale = burst.scaleX;
      this.tweens.add({
        targets: burst,
        rotation: Math.PI * 2,
        duration: 14000,
        repeat: -1
      });
      this.tweens.add({
        targets: burst,
        scaleX: baseScale * 1.1,
        scaleY: baseScale * 1.1,
        alpha: 0.48,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut
      });
    }
    this.add.text(DESIGN_WIDTH / 2, 78, "领悟", {
      color: PALETTE.textPrimary,
      fontFamily: FONT_TITLE,
      fontSize: "44px",
      fontStyle: "bold"
    }).setOrigin(0.5).setResolution(2);
    this.add.text(DESIGN_WIDTH / 2, 126, `等级 ${pendingInsight.levelBefore} -> 等级 ${pendingInsight.levelAfter}`, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "18px"
    }).setOrigin(0.5).setStroke("#101010", 3).setResolution(2);

    const cardXs = [230, 480, 730];
    pendingInsight.options.forEach((option, index) => {
      this.createInsightCard(cardXs[index] ?? (230 + index * 250), option, index + 1, index);
    });

    const keyboard = this.input.keyboard;
    if (keyboard) {
      pendingInsight.options.forEach((option, index) => {
        const key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + index);
        const handler = (): void => this.selectCard(option.id);
        key.on("down", handler);
        this.keyboardOffCallbacks.push(() => key.off("down", handler));
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.keyboardOffCallbacks) {
        off();
      }
      this.keyboardOffCallbacks = [];
    });
    fadeIn(this);
  }

  private createInsightCard(x: number, option: InsightOption, shortcut: number, index: number): void {
    const children: Phaser.GameObjects.GameObject[] = [];
    let background: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    let glow: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (this.textures.exists("ui_card_insight")) {
      background = this.add.image(0, 0, "ui_card_insight")
        .setDisplaySize(214, 306)
        .setAlpha(0.98);
      glow = this.add.image(0, 0, "ui_card_insight")
        .setDisplaySize(214, 306)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xf6d472)
        .setAlpha(0);
    } else {
      background = this.add.rectangle(0, 0, 210, 250, 0x18251f, 1).setStrokeStyle(2, 0xd6c28d, 0.9);
      glow = this.add.rectangle(0, 0, 214, 254, 0xf6d472, 0)
        .setStrokeStyle(2, 0xf6d472, 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
    }
    children.push(background, glow);

    const iconAssetId = getInsightIconAssetId(option) ?? option.iconKey;
    if (iconAssetId && this.textures.exists(iconAssetId)) {
      children.push(this.add.image(0, -76, iconAssetId).setDisplaySize(58, 58));
    } else {
      children.push(this.add.circle(0, -76, 28, 0xd6c28d, 0.9));
    }

    children.push(this.add.text(-82, -100, `${shortcut}`, {
      color: "#14211b",
      fontFamily: FONT_BODY,
      fontSize: "20px",
      fontStyle: "bold"
    }).setOrigin(0.5).setResolution(2));
    children.push(this.add.text(0, -38, option.title, {
      color: PALETTE.textPrimary,
      fontFamily: FONT_TITLE,
      fontSize: getInsightTitleFontSize(option.title),
      fontStyle: "bold"
    }).setOrigin(0.5).setStroke("#14211b", 4).setResolution(2));
    children.push(this.add.text(0, 12, wrapVisualText(option.description, 9, 2), {
      color: "#d8ead9",
      fontFamily: FONT_BODY,
      fontSize: "17px",
      align: "center",
      lineSpacing: 3
    }).setOrigin(0.5).setStroke("#14211b", 3).setResolution(2));
    children.push(this.add.text(0, 52, option.typeLabel, {
      color: PALETTE.textSecondary,
      fontFamily: FONT_BODY,
      fontSize: "15px"
    }).setOrigin(0.5).setStroke("#14211b", 3).setResolution(2));
    children.push(createTextButton(this, 0, 112, "领悟", () => this.selectCard(option.id), 150, 52));

    const container = this.add.container(x, 306 + 34, children);
    container.setSize(214, 306);
    container.setAlpha(0);
    container.setInteractive({ useHandCursor: true });
    const card: InsightCardRefs = { optionId: option.id, container, background, glow };
    this.cards.push(card);

    // 入场：y+34 → 原位，alpha 0→1，Cubic.easeOut 错落
    this.tweens.add({
      targets: container,
      y: 306,
      alpha: 1,
      duration: 420,
      delay: index * 130,
      ease: Phaser.Math.Easing.Cubic.Out
    });

    // 悬停：scale 1.05 + 边框 ADD 发光层淡入
    container.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (this.selected) {
        return;
      }
      this.tweens.add({ targets: container, scale: 1.05, duration: 140, ease: Phaser.Math.Easing.Quadratic.Out });
      this.tweens.add({ targets: glow, alpha: 0.22, duration: 140 });
    });
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      if (this.selected) {
        return;
      }
      this.tweens.add({ targets: container, scale: 1, duration: 140, ease: Phaser.Math.Easing.Quadratic.Out });
      this.tweens.add({ targets: glow, alpha: 0, duration: 140 });
    });
    container.on(Phaser.Input.Events.POINTER_DOWN, () => this.selectCard(option.id));
  }

  private selectCard(cardId: string): void {
    if (this.selected) {
      return;
    }
    this.selected = true;
    this.input.enabled = false;
    getAudioSystem(this).playPlaceholder("insight");
    eventBus.emit("insight_option_selected", { optionId: cardId });
    const picked = this.cards.find((card) => card.optionId === cardId);
    this.cards.forEach((card) => {
      this.tweens.killTweensOf(card.container);
      this.tweens.killTweensOf(card.glow);
      if (card === picked) {
        card.container.setAlpha(1);
        card.glow.setAlpha(0.32);
        const tintable = card.background as unknown as { setTintFill?: (tint: number) => void; clearTint?: () => void };
        tintable.setTintFill?.(0xffffff);
        this.time.delayedCall(160, () => tintable.clearTint?.());
      } else {
        this.tweens.add({ targets: card.container, alpha: 0.25, duration: 260 });
      }
    });
    if (!picked) {
      this.finishSelection();
      return;
    }
    // 选中确认：scale→1.12 + 白闪，Tween 完成后再走原有 300ms 切场
    this.tweens.add({
      targets: picked.container,
      scale: 1.12,
      duration: 260,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => this.finishSelection()
    });
  }

  private finishSelection(): void {
    this.time.delayedCall(300, () => {
      enterScreen(this, "game");
      this.scene.stop(SCENE_KEYS.insight);
      this.scene.resume(SCENE_KEYS.game);
    });
  }
}

function createFallbackInsight(): PendingInsight {
  return {
    levelBefore: 1,
    levelAfter: 2,
    options: [
      {
        id: "yulong_sword_qi_lv2_debug",
        category: "skill_upgrade",
        title: "游龙剑气 Lv2",
        description: "剑气伤害提高",
        typeLabel: "招式强化",
        iconKey: "skill_yulong_projectile",
        applyEffectId: "upgrade_yulong_sword_qi_2"
      },
      {
        id: "lightfoot_debug",
        category: "passive",
        title: "轻功 +5%",
        description: "移动更轻快",
        typeLabel: "被动属性",
        iconKey: "passive_lightfoot",
        applyEffectId: "passive_move_speed_1"
      },
      {
        id: "magnet_debug",
        category: "passive",
        title: "磁石锦囊",
        description: "拾取范围提高",
        typeLabel: "被动属性",
        iconKey: "passive_pickup_radius",
        applyEffectId: "passive_pickup_radius_1"
      }
    ]
  };
}

function isPendingInsight(value: unknown): value is PendingInsight {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PendingInsight>;
  return typeof candidate.levelBefore === "number"
    && typeof candidate.levelAfter === "number"
    && Array.isArray(candidate.options);
}

function getInsightIconAssetId(option: InsightOption): string | undefined {
  if (
    option.iconKey === "skill_yulong_projectile_advanced"
    || option.applyEffectId.includes("advance_yulong_sword_qi")
    || (option.category === "skill_advance" && option.title.includes("归海"))
  ) {
    return "ui_icon_skill_yulong_advanced";
  }
  if (option.iconKey === "skill_yulong_projectile" || option.applyEffectId.includes("yulong_sword_qi")) {
    return "ui_icon_skill_yulong";
  }
  if (
    option.iconKey === "skill_huifeng_dart_advanced"
    || option.applyEffectId.includes("advance_huifeng_dart")
    || (option.category === "skill_advance" && option.title.includes("连环"))
  ) {
    return "ui_icon_skill_huifeng_advanced";
  }
  if (option.iconKey === "skill_huifeng_dart" || option.applyEffectId.includes("huifeng_dart")) {
    return "ui_icon_skill_huifeng";
  }
  if (
    option.iconKey === "skill_zhenshan_wave_advanced"
    || option.applyEffectId.includes("advance_zhenshan_palm")
    || (option.category === "skill_advance" && option.title.includes("裂石"))
  ) {
    return "ui_icon_skill_zhenshan_advanced";
  }
  if (option.iconKey === "skill_zhenshan_wave" || option.applyEffectId.includes("zhenshan_palm")) {
    return "ui_icon_skill_zhenshan";
  }
  // 墨染江山（moran_ink_zone）：iconKey 含 "moran" 或 applyEffectId 含 "moran_ink_zone"。
  // 纹理是否存在的防御由调用方 createInsightCard 的 textures.exists 统一兜底（缺失退化为圆点占位）。
  if (option.iconKey.includes("moran") || option.applyEffectId.includes("moran_ink_zone")) {
    const isAdvanced = option.iconKey.includes("advanced")
      || option.applyEffectId.includes("advance_moran_ink_zone")
      || option.category === "skill_advance";
    return isAdvanced ? "ui_icon_skill_moran_advanced" : "ui_icon_skill_moran";
  }
  // 烈火神掌（liehuo_firewall）：iconKey 含 "liehuo" 或 applyEffectId 含 "liehuo_firewall"。
  // 与 moran 同一防御约定：纹理缺失时由 createInsightCard 退化为圆点占位。
  if (option.iconKey.includes("liehuo") || option.applyEffectId.includes("liehuo_firewall")) {
    const isAdvanced = option.iconKey.includes("advanced")
      || option.applyEffectId.includes("advance_liehuo_firewall")
      || option.category === "skill_advance";
    return isAdvanced ? "ui_icon_skill_liehuo_advanced" : "ui_icon_skill_liehuo";
  }
  if (option.iconKey === "advance_key_sword_manual_page") {
    return "ui_icon_advance_sword_manual_page";
  }
  if (option.iconKey === "advance_key_hidden_weapon_pouch") {
    return "ui_icon_advance_hidden_weapon_pouch";
  }
  if (option.iconKey === "advance_key_inner_force_manual") {
    return "ui_icon_advance_inner_force_manual";
  }
  if (option.iconKey.startsWith("advance_key_")) {
    return "ui_icon_scripture_compensation_fragment";
  }
  if (option.iconKey === "passive_lightfoot" || option.applyEffectId === "passive_move_speed_1") {
    return "ui_icon_passive_lightfoot";
  }
  if (option.iconKey === "passive_pickup_radius" || option.applyEffectId === "passive_pickup_radius_1") {
    return "ui_icon_passive_pickup_radius";
  }
  if (option.iconKey === "passive_max_hp" || option.applyEffectId === "passive_max_hp_1") {
    return "ui_icon_passive_body_training";
  }
  return undefined;
}

function getInsightTitleFontSize(title: string): string {
  return getVisualLength(title) > 8.5 ? "20px" : "22px";
}

function wrapVisualText(text: string, maxUnitsPerLine: number, maxLines: number): string {
  const lines: string[] = [];
  let line = "";
  let units = 0;

  for (const char of Array.from(text)) {
    const unit = getVisualLength(char);
    if (line && units + unit > maxUnitsPerLine) {
      lines.push(line);
      if (lines.length >= maxLines) {
        lines[maxLines - 1] = `${trimToVisualLength(lines[maxLines - 1], Math.max(1, maxUnitsPerLine - 1))}…`;
        return lines.join("\n");
      }
      line = char;
      units = unit;
      continue;
    }
    line += char;
    units += unit;
  }

  if (line) {
    lines.push(line);
  }
  return lines.slice(0, maxLines).join("\n");
}

function trimToVisualLength(text: string, maxUnits: number): string {
  let result = "";
  let units = 0;
  for (const char of Array.from(text)) {
    const unit = getVisualLength(char);
    if (units + unit > maxUnits) {
      break;
    }
    result += char;
    units += unit;
  }
  return result;
}

function getVisualLength(text: string): number {
  return Array.from(text).reduce((total, char) => total + (/[\x00-\x7F]/.test(char) ? 0.55 : 1), 0);
}
