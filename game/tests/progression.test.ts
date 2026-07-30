import { describe, expect, it } from "vitest";
import { createInsightOptions, type InsightSkillState } from "../src/data/progression";
import { skillOrder } from "../src/data/skills";

const fixedRandom = (): number => 0.25;

describe("insight option contracts", () => {
  it("keeps the authored first insight deterministic", () => {
    expect(createInsightOptions(0, new Set(), undefined, fixedRandom).map((option) => option.id))
      .toEqual(["huifeng_dart_unlock", "yulong_sword_qi_lv2", "lightfoot_1"]);
  });

  it("guarantees an upgrade and passive on the second insight", () => {
    const options = createInsightOptions(1, new Set(), undefined, fixedRandom);
    expect(options).toHaveLength(3);
    expect(options.some((option) => option.category === "skill_upgrade")).toBe(true);
    expect(options.some((option) => option.category === "passive")).toBe(true);
  });

  it("offers a new skill on the third insight when only one is owned", () => {
    const options = createInsightOptions(2, new Set(), undefined, fixedRandom);
    expect(options).toHaveLength(3);
    expect(options.some((option) => option.category === "new_skill")).toBe(true);
  });

  it("never hides a ready advancement", () => {
    const state: InsightSkillState = {
      levels: { yulong_sword_qi: 5 },
      advancedSkillIds: [],
      advanceKeyIds: ["sword_manual_page"],
      maxSkillSlots: 6
    };
    const options = createInsightOptions(8, new Set(), state, fixedRandom);
    expect(options.some((option) => option.id === "yulong_sword_qi_advance")).toBe(true);
  });

  it("still returns three legal choices after finite upgrades are exhausted", () => {
    const levels = Object.fromEntries(skillOrder.map((id) => [id, 5])) as InsightSkillState["levels"];
    const state: InsightSkillState = {
      levels,
      advancedSkillIds: [...skillOrder],
      advanceKeyIds: [],
      maxSkillSlots: 6
    };
    const selected = new Set<string>();
    for (const prefix of ["magnet_pouch_", "lightfoot_", "vitality_", "breath_cycle_"]) {
      for (let level = 1; level <= 5; level += 1) {
        selected.add(`${prefix}${level}`);
      }
    }

    const options = createInsightOptions(40, selected, state, fixedRandom);
    expect(options).toHaveLength(3);
    expect(new Set(options.map((option) => option.id)).size).toBe(3);
  });
});
