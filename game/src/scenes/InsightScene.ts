import Phaser from "phaser";
import type { InsightOption, PendingInsight } from "../data/progression";
import { createTextButton } from "../ui/UiButton";
import { eventBus } from "../utils/EventBus";
import { getAudioSystem } from "../utils/registry";
import { enterScreen } from "../utils/screenFlow";
import { SCENE_KEYS } from "./sceneKeys";

export class InsightScene extends Phaser.Scene {
  private selected = false;
  private keyboardOffCallbacks: Array<() => void> = [];

  constructor() {
    super(SCENE_KEYS.insight);
  }

  create(data?: PendingInsight): void {
    this.selected = false;
    this.keyboardOffCallbacks = [];
    enterScreen(this, "insight");
    const pendingInsight = isPendingInsight(data) ? data : createFallbackInsight();
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0f1512, 0.93);
    if (this.textures.exists("vfx_insight_burst")) {
      this.add.image(this.scale.width / 2, 158, "vfx_insight_burst")
        .setDisplaySize(210, 210)
        .setAlpha(0.44)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
    this.add.text(this.scale.width / 2, 78, "领悟", {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "44px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.add.text(this.scale.width / 2, 126, `等级 ${pendingInsight.levelBefore} -> 等级 ${pendingInsight.levelAfter}`, {
      color: "#d8ead9",
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px"
    }).setOrigin(0.5);

    const cardXs = [230, 480, 730];
    pendingInsight.options.forEach((option, index) => {
      this.createInsightCard(cardXs[index] ?? (230 + index * 250), option, index + 1);
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
  }

  private createInsightCard(x: number, option: InsightOption, shortcut: number): void {
    if (this.textures.exists("ui_card_insight")) {
      this.add.image(x, 306, "ui_card_insight")
        .setDisplaySize(214, 306)
        .setAlpha(0.98);
    } else {
      this.add.rectangle(x, 306, 210, 250, 0x18251f, 1).setStrokeStyle(2, 0xd6c28d, 0.9);
    }

    const iconAssetId = getInsightIconAssetId(option) ?? option.iconKey;
    if (iconAssetId && this.textures.exists(iconAssetId)) {
      this.add.image(x, 230, iconAssetId).setDisplaySize(58, 58);
    } else {
      this.add.circle(x, 230, 28, 0xd6c28d, 0.9);
    }

    this.add.text(x - 82, 206, `${shortcut}`, {
      color: "#14211b",
      fontFamily: "system-ui, sans-serif",
      fontSize: "20px",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.add.text(x, 268, option.title, {
      color: "#f7f0d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: getInsightTitleFontSize(option.title),
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.add.text(x, 318, wrapVisualText(option.description, 9, 2), {
      color: "#d8ead9",
      fontFamily: "system-ui, sans-serif",
      fontSize: "17px",
      align: "center",
      lineSpacing: 3
    }).setOrigin(0.5);
    this.add.text(x, 358, option.typeLabel, {
      color: "#b9d7c8",
      fontFamily: "system-ui, sans-serif",
      fontSize: "15px"
    }).setOrigin(0.5);
    createTextButton(this, x, 418, "领悟", () => this.selectCard(option.id), 150, 52);
  }

  private selectCard(cardId: string): void {
    if (this.selected) {
      return;
    }
    this.selected = true;
    this.input.enabled = false;
    getAudioSystem(this).playPlaceholder("insight");
    eventBus.emit("insight_option_selected", { optionId: cardId });
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
