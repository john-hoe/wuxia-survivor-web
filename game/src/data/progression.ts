import type { EnemyId } from "./enemies";
import { skillConfigs, skillOrder, type AdvanceKeyId, type SkillId } from "./skills";

export type InnerPowerTier = "small" | "medium" | "large" | "boss";

export type InnerPowerGemConfig = {
  tier: InnerPowerTier;
  value: number;
  visualRadius: number;
  color: number;
  glowColor: number;
};

export type InsightCategory =
  | "new_skill"
  | "skill_upgrade"
  | "passive"
  | "advance_key"
  | "skill_advance";

export type InsightOption = {
  id: string;
  category: InsightCategory;
  title: string;
  description: string;
  typeLabel: string;
  iconKey: string;
  applyEffectId: string;
};

export type PendingInsight = {
  levelBefore: number;
  levelAfter: number;
  options: InsightOption[];
};

export type InsightSkillState = {
  levels: Partial<Record<SkillId, number>>;
  advancedSkillIds: SkillId[];
  advanceKeyIds: AdvanceKeyId[];
  maxSkillSlots: number;
};

const PASSIVE_MAX_LEVEL = 5;
const DEFAULT_MAX_SKILL_SLOTS = 6;

export const innerPowerRequirements = [
  24,
  34,
  52,
  74,
  100,
  130,
  164,
  202,
  244,
  290,
  340,
  394,
  452,
  514
];

export const innerPowerGemConfigs: Record<InnerPowerTier, InnerPowerGemConfig> = {
  small: {
    tier: "small",
    value: 4,
    visualRadius: 8,
    color: 0x8defff,
    glowColor: 0x3b9fb7
  },
  medium: {
    tier: "medium",
    value: 10,
    visualRadius: 12,
    color: 0xb9f7ff,
    glowColor: 0x4fb6ce
  },
  large: {
    tier: "large",
    value: 30,
    visualRadius: 18,
    color: 0xe1fdff,
    glowColor: 0x69d4ec
  },
  boss: {
    tier: "boss",
    value: 80,
    visualRadius: 24,
    color: 0xf5ffff,
    glowColor: 0x9bf0ff
  }
};

export const enemyInnerPowerDrops: Record<EnemyId, { tier: InnerPowerTier; chance: number }> = {
  bandit_grunt: { tier: "small", chance: 1 },
  hound: { tier: "small", chance: 0.8 },
  shield_bandit: { tier: "medium", chance: 1 },
  wooden_dummy_elite: { tier: "large", chance: 1 }
};

export function getInnerPowerRequiredForLevel(level: number): number {
  if (level <= innerPowerRequirements.length) {
    return innerPowerRequirements[level - 1];
  }

  let required = innerPowerRequirements.at(-1) ?? 514;
  for (let currentLevel = innerPowerRequirements.length + 1; currentLevel <= level; currentLevel += 1) {
    required += 66 + (currentLevel - 14) * 8;
  }
  return required;
}

export function createInsightOptions(
  insightIndex: number,
  selectedInsightIds: ReadonlySet<string> = new Set(),
  skillState: InsightSkillState = createDefaultSkillState()
): InsightOption[] {
  if (insightIndex === 0) {
    return normalizeOptions([
      createUnlockOption("huifeng_dart", skillState),
      createUpgradeOption("yulong_sword_qi", 2, skillState),
      createPassiveOption("lightfoot", 1)
    ], selectedInsightIds, skillState, insightIndex);
  }

  const nextMagnetLevel = getNextPassiveLevel(selectedInsightIds, "magnet_pouch_", PASSIVE_MAX_LEVEL);
  const nextLightfootLevel = getNextPassiveLevel(selectedInsightIds, "lightfoot_", PASSIVE_MAX_LEVEL);
  const nextVitalityLevel = getNextPassiveLevel(selectedInsightIds, "vitality_", PASSIVE_MAX_LEVEL);
  const passives: InsightOption[] = [];

  if (nextMagnetLevel !== undefined) {
    passives.push({
      id: `magnet_pouch_${nextMagnetLevel}`,
      category: "passive",
      title: "磁石锦囊",
      description: "拾取范围提高",
      typeLabel: "被动属性",
      iconKey: "passive_pickup_radius",
      applyEffectId: "passive_pickup_radius_1"
    });
  }

  if (nextLightfootLevel !== undefined) {
    passives.push({
      id: `lightfoot_${nextLightfootLevel}`,
      category: "passive",
      title: "轻功 +5%",
      description: "移动更轻快",
      typeLabel: "被动属性",
      iconKey: "passive_lightfoot",
      applyEffectId: "passive_move_speed_1"
    });
  }

  if (nextVitalityLevel !== undefined) {
    passives.push({
      id: `vitality_${nextVitalityLevel}`,
      category: "passive",
      title: "体魄训练",
      description: "最大血量提高",
      typeLabel: "被动属性",
      iconKey: "passive_max_hp",
      applyEffectId: "passive_max_hp_1"
    });
  }

  const options: Array<InsightOption | undefined> = [];
  options.push(...createReadyAdvanceOptions(skillState));

  if (getOwnedSkillIds(skillState).length < skillState.maxSkillSlots) {
    options.push(createUnlockOption("huifeng_dart", skillState));
    options.push(createUnlockOption("zhenshan_palm", skillState));
    options.push(createUnlockOption("moran_ink_zone", skillState));
    options.push(createUnlockOption("liehuo_firewall", skillState));
  }

  const nextYulongLevel = getNextSkillLevel(skillState, "yulong_sword_qi");
  if (nextYulongLevel !== undefined) {
    options.push(createUpgradeOption("yulong_sword_qi", nextYulongLevel, skillState));
  }

  for (const skillId of skillOrder) {
    options.push(createAdvanceKeyOption(skillId, skillState));
  }

  for (const skillId of skillOrder) {
    if (skillId === "yulong_sword_qi") {
      continue;
    }
    const nextLevel = getNextSkillLevel(skillState, skillId);
    if (nextLevel !== undefined) {
      options.push(createUpgradeOption(skillId, nextLevel, skillState));
    }
  }

  options.push(...pickRotatingPassives(passives, insightIndex, 3));
  return normalizeOptions(options, selectedInsightIds, skillState, insightIndex);
}

function createDefaultSkillState(): InsightSkillState {
  return {
    levels: {
      yulong_sword_qi: 1
    },
    advancedSkillIds: [],
    advanceKeyIds: [],
    maxSkillSlots: DEFAULT_MAX_SKILL_SLOTS
  };
}

function normalizeOptions(
  candidates: Array<InsightOption | undefined>,
  selectedInsightIds: ReadonlySet<string>,
  skillState: InsightSkillState,
  insightIndex: number
): InsightOption[] {
  const unique = new Map<string, InsightOption>();
  for (const option of candidates) {
    if (!option || selectedInsightIds.has(option.id) || unique.has(option.id)) {
      continue;
    }
    unique.set(option.id, option);
  }

  if (unique.size < 3) {
    const fallbackPassives = createFallbackPassiveOptions(selectedInsightIds, insightIndex);
    for (const option of fallbackPassives) {
      if (unique.size >= 3) {
        break;
      }
      if (!unique.has(option.id) && !selectedInsightIds.has(option.id)) {
        unique.set(option.id, option);
      }
    }
  }

  if (unique.size < 3) {
    for (const skillId of skillOrder) {
      const nextLevel = getNextSkillLevel(skillState, skillId);
      const option = nextLevel !== undefined ? createUpgradeOption(skillId, nextLevel, skillState) : undefined;
      if (!option || unique.has(option.id) || selectedInsightIds.has(option.id)) {
        continue;
      }
      unique.set(option.id, option);
      if (unique.size >= 3) {
        break;
      }
    }
  }

  return Array.from(unique.values()).slice(0, 3);
}

function createFallbackPassiveOptions(selectedInsightIds: ReadonlySet<string>, insightIndex: number): InsightOption[] {
  const candidates: InsightOption[] = [];
  const nextMagnetLevel = getNextPassiveLevel(selectedInsightIds, "magnet_pouch_", PASSIVE_MAX_LEVEL);
  const nextLightfootLevel = getNextPassiveLevel(selectedInsightIds, "lightfoot_", PASSIVE_MAX_LEVEL);
  const nextVitalityLevel = getNextPassiveLevel(selectedInsightIds, "vitality_", PASSIVE_MAX_LEVEL);
  if (nextMagnetLevel !== undefined) {
    candidates.push(createPassiveOption("magnet", nextMagnetLevel));
  }
  if (nextLightfootLevel !== undefined) {
    candidates.push(createPassiveOption("lightfoot", nextLightfootLevel));
  }
  if (nextVitalityLevel !== undefined) {
    candidates.push(createPassiveOption("vitality", nextVitalityLevel));
  }
  return pickRotatingPassives(candidates, insightIndex, 3);
}

function createUnlockOption(skillId: SkillId, skillState: InsightSkillState): InsightOption | undefined {
  if (skillState.levels[skillId] !== undefined) {
    return undefined;
  }

  const config = skillConfigs[skillId];
  return {
    id: `${skillId}_unlock`,
    category: "new_skill",
    title: `${config.displayName} Lv1`,
    description: getUnlockDescription(skillId),
    typeLabel: "新招式",
    iconKey: getSkillIconKey(skillId),
    applyEffectId: `unlock_${skillId}`
  };
}

function createUpgradeOption(skillId: SkillId, targetLevel: number, skillState: InsightSkillState): InsightOption | undefined {
  const config = skillConfigs[skillId];
  const currentLevel = skillState.levels[skillId];
  if (currentLevel === undefined || currentLevel >= targetLevel || targetLevel > config.maxLevel) {
    return undefined;
  }

  return {
    id: `${skillId}_lv${targetLevel}`,
    category: "skill_upgrade",
    title: `${config.displayName} Lv${targetLevel}`,
    description: getUpgradeDescription(skillId),
    typeLabel: "招式强化",
    iconKey: getSkillIconKey(skillId),
    applyEffectId: `upgrade_${skillId}_${targetLevel}`
  };
}

function createReadyAdvanceOptions(skillState: InsightSkillState): InsightOption[] {
  return skillOrder
    .map((skillId) => createAdvanceOption(skillId, skillState))
    .filter((option): option is InsightOption => option !== undefined);
}

function createAdvanceOption(skillId: SkillId, skillState: InsightSkillState): InsightOption | undefined {
  const config = skillConfigs[skillId];
  const advancement = config.advancement;
  if (!advancement || skillState.advancedSkillIds.includes(skillId)) {
    return undefined;
  }

  const level = skillState.levels[skillId] ?? 0;
  if (level < advancement.requiredLevel || !skillState.advanceKeyIds.includes(advancement.requiredKeyId)) {
    return undefined;
  }

  return {
    id: `${skillId}_advance`,
    category: "skill_advance",
    title: advancement.displayName,
    description: advancement.description,
    typeLabel: "进阶",
    iconKey: `${getSkillIconKey(skillId)}_advanced`,
    applyEffectId: `advance_${skillId}`
  };
}

function createAdvanceKeyOption(skillId: SkillId, skillState: InsightSkillState): InsightOption | undefined {
  const config = skillConfigs[skillId];
  const advancement = config.advancement;
  if (!advancement || skillState.advancedSkillIds.includes(skillId)) {
    return undefined;
  }

  const level = skillState.levels[skillId] ?? 0;
  if (level < 3 || skillState.advanceKeyIds.includes(advancement.requiredKeyId)) {
    return undefined;
  }

  return {
    id: `${advancement.requiredKeyId}_key`,
    category: "advance_key",
    title: getAdvanceKeyTitle(advancement.requiredKeyId),
    description: `${config.displayName}进阶所需`,
    typeLabel: "进阶信物",
    iconKey: `advance_key_${advancement.requiredKeyId}`,
    applyEffectId: `collect_advance_key_${advancement.requiredKeyId}`
  };
}

function createPassiveOption(passive: "magnet" | "lightfoot" | "vitality", level: number): InsightOption {
  if (passive === "magnet") {
    return {
      id: `magnet_pouch_${level}`,
      category: "passive",
      title: "磁石锦囊",
      description: "拾取范围提高",
      typeLabel: "被动属性",
      iconKey: "passive_pickup_radius",
      applyEffectId: "passive_pickup_radius_1"
    };
  }

  if (passive === "lightfoot") {
    return {
      id: `lightfoot_${level}`,
      category: "passive",
      title: "轻功 +5%",
      description: "移动更轻快",
      typeLabel: "被动属性",
      iconKey: "passive_lightfoot",
      applyEffectId: "passive_move_speed_1"
    };
  }

  return {
    id: `vitality_${level}`,
    category: "passive",
    title: "体魄训练",
    description: "最大血量提高",
    typeLabel: "被动属性",
    iconKey: "passive_max_hp",
    applyEffectId: "passive_max_hp_1"
  };
}

function getOwnedSkillIds(skillState: InsightSkillState): SkillId[] {
  return skillOrder.filter((skillId) => skillState.levels[skillId] !== undefined);
}

function getNextSkillLevel(skillState: InsightSkillState, skillId: SkillId): number | undefined {
  const currentLevel = skillState.levels[skillId];
  if (currentLevel === undefined) {
    return undefined;
  }
  const maxLevel = skillConfigs[skillId].maxLevel;
  return currentLevel < maxLevel ? currentLevel + 1 : undefined;
}

function getSkillIconKey(skillId: SkillId): string {
  if (skillId === "yulong_sword_qi") {
    return "skill_yulong_projectile";
  }
  if (skillId === "huifeng_dart") {
    return "skill_huifeng_dart";
  }
  if (skillId === "moran_ink_zone") {
    // 跨代理约定图标：ui_icon_skill_moran；进阶选项自动派生 ui_icon_skill_moran_advanced
    return "ui_icon_skill_moran";
  }
  if (skillId === "liehuo_firewall") {
    // 跨代理约定图标：ui_icon_skill_liehuo；进阶选项自动派生 ui_icon_skill_liehuo_advanced
    return "ui_icon_skill_liehuo";
  }
  return "skill_zhenshan_wave";
}

function getUnlockDescription(skillId: SkillId): string {
  if (skillId === "huifeng_dart") {
    return "飞镖环绕护身";
  }
  if (skillId === "zhenshan_palm") {
    return "定时震退近敌";
  }
  if (skillId === "moran_ink_zone") {
    return "墨痕覆地，伤敌减速";
  }
  if (skillId === "liehuo_firewall") {
    return "烈火成墙，灼敌断路";
  }
  return "剑气自动索敌";
}

function getUpgradeDescription(skillId: SkillId): string {
  if (skillId === "huifeng_dart") {
    return "飞镖更密更快";
  }
  if (skillId === "zhenshan_palm") {
    return "掌风范围扩大";
  }
  if (skillId === "moran_ink_zone") {
    return "墨域更广更浓";
  }
  if (skillId === "liehuo_firewall") {
    return "火墙更长更烈";
  }
  return "剑气更锋利";
}

function getAdvanceKeyTitle(keyId: AdvanceKeyId): string {
  if (keyId === "hidden_weapon_pouch") {
    return "暗器囊";
  }
  if (keyId === "inner_force_manual") {
    return "内劲心法";
  }
  if (keyId === "pine_soot_inkstick") {
    return "松烟墨锭";
  }
  if (keyId === "fire_jujube_pit") {
    return "火枣核";
  }
  return "剑谱残页";
}

function getNextPassiveLevel(selectedInsightIds: ReadonlySet<string>, prefix: string, maxLevel: number): number | undefined {
  let level = 1;
  while (selectedInsightIds.has(`${prefix}${level}`)) {
    level += 1;
  }
  return level <= maxLevel ? level : undefined;
}

function pickRotatingPassives(passives: InsightOption[], insightIndex: number, count: number): InsightOption[] {
  if (passives.length <= count) {
    return passives;
  }

  const startIndex = Math.max(0, insightIndex - 1) % passives.length;
  return Array.from({ length: count }, (_, offset) => passives[(startIndex + offset) % passives.length]);
}
