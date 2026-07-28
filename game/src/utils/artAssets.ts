import Phaser from "phaser";
import { artManifest } from "../data/artManifest";

import bambooEdgeClusterUrl from "../assets/backgrounds/bamboo_edge_cluster.png";
import decorFlagUrl from "../assets/backgrounds/decor_flag.png";
import decorLanternUrl from "../assets/backgrounds/decor_lantern.png";
import decorSteleUrl from "../assets/backgrounds/decor_stele.png";
import decorWinejarUrl from "../assets/backgrounds/decor_winejar.png";
import distantGateShadowUrl from "../assets/backgrounds/distant_gate_shadow.png";
import groundQingshiBaseUrl from "../assets/backgrounds/ground_qingshi_base.png";
import groundMapleBaseUrl from "../assets/backgrounds/ground_maple_base.png";
import mapleTreeClusterUrl from "../assets/backgrounds/maple_tree_cluster.png";
import decorStoneLionUrl from "../assets/backgrounds/decor_stone_lion.png";
import decorSwordMoundUrl from "../assets/backgrounds/decor_sword_mound.png";
import roadRibbonAUrl from "../assets/backgrounds/road_ribbon_a.png";
import roadRibbonBUrl from "../assets/backgrounds/road_ribbon_b.png";
import rockClusterUrl from "../assets/backgrounds/rock_cluster.png";
import woodStakeFlagUrl from "../assets/backgrounds/wood_stake_flag.png";
import dropInnerLargeUrl from "../assets/sprites/drop_inner_large.png";
import dropInnerMediumUrl from "../assets/sprites/drop_inner_medium.png";
import dropInnerSmallUrl from "../assets/sprites/drop_inner_small.png";
import bossHeifengAttackUrl from "../assets/sprites/boss_heifeng_attack.png";
import bossHeifengIdleUrl from "../assets/sprites/boss_heifeng_idle.png";
import enemyBanditGruntWalkUrl from "../assets/sprites/enemy_bandit_grunt_walk.png";
import enemyHoundRunUrl from "../assets/sprites/enemy_hound_run.png";
import enemyShieldBanditWalkUrl from "../assets/sprites/enemy_shield_bandit_walk.png";
import enemyWoodenDummyEliteWalkUrl from "../assets/sprites/enemy_wooden_dummy_elite_walk.png";
import heroShaoxiaHurtUrl from "../assets/sprites/hero_shaoxia_hurt.png";
import heroShaoxiaIdleUrl from "../assets/sprites/hero_shaoxia_idle.png";
import heroShaoxiaMoveUrl from "../assets/sprites/hero_shaoxia_move.png";
import skillHuifengAdvancedDartUrl from "../assets/vfx/skill_huifeng_advanced_dart.png";
import skillHuifengDartUrl from "../assets/vfx/skill_huifeng_dart.png";
import skillYulongAdvancedProjectileUrl from "../assets/vfx/skill_yulong_advanced_projectile.png";
import skillYulongProjectileUrl from "../assets/vfx/skill_yulong_projectile.png";
import skillZhenshanAdvancedWaveUrl from "../assets/vfx/skill_zhenshan_advanced_wave.png";
import skillZhenshanWaveUrl from "../assets/vfx/skill_zhenshan_wave.png";
import vfxBossChargeWarningUrl from "../assets/vfx/vfx_boss_charge_warning.png";
import vfxBossWhirlwindWarningUrl from "../assets/vfx/vfx_boss_whirlwind_warning.png";
import vfxDeathVignetteUrl from "../assets/vfx/vfx_death_vignette.png";
import vfxEliteWarningUrl from "../assets/vfx/vfx_elite_warning.png";
import vfxEnemyDieUrl from "../assets/vfx/vfx_enemy_die.png";
import vfxGroundCrackUrl from "../assets/vfx/vfx_ground_crack.png";
import vfxHeroHurtFlashUrl from "../assets/vfx/vfx_hero_hurt_flash.png";
import vfxHitLightUrl from "../assets/vfx/vfx_hit_light.png";
import vfxInkSplatUrl from "../assets/vfx/vfx_ink_splat.png";
import vfxInkStroke1Url from "../assets/vfx/vfx_ink_stroke_1.png";
import vfxInkStroke2Url from "../assets/vfx/vfx_ink_stroke_2.png";
import vfxInkStroke3Url from "../assets/vfx/vfx_ink_stroke_3.png";
import vfxInkStroke4Url from "../assets/vfx/vfx_ink_stroke_4.png";
import vfxInnerMagnetTrailUrl from "../assets/vfx/vfx_inner_magnet_trail.png";
import vfxPoisonBubbleUrl from "../assets/vfx/vfx_poison_bubble.png";
import vfxPoisonBubbleGoldUrl from "../assets/vfx/vfx_poison_bubble_gold.png";
import vfxInsightBurstUrl from "../assets/vfx/vfx_insight_burst.png";
import vfxScriptureRevealUrl from "../assets/vfx/vfx_scripture_reveal.png";
import vfxSkillAdvanceUrl from "../assets/vfx/vfx_skill_advance.png";
import metaIconBodyTrainingUrl from "../assets/ui/meta_icon_body_training.png";
import metaIconLightfootUrl from "../assets/ui/meta_icon_lightfoot.png";
import metaIconMagnetPouchUrl from "../assets/ui/meta_icon_magnet_pouch.png";
import scriptureCompensationCopperUrl from "../assets/ui/scripture_compensation_copper.png";
import scriptureCompensationFragmentUrl from "../assets/ui/scripture_compensation_fragment.png";
import scriptureRewardBodyFragmentUrl from "../assets/ui/scripture_reward_body_fragment.png";
import scriptureRewardCommonFragmentUrl from "../assets/ui/scripture_reward_common_fragment.png";
import scriptureRewardCopperReturnUrl from "../assets/ui/scripture_reward_copper_return.png";
import scriptureRewardCosmeticHatUrl from "../assets/ui/scripture_reward_cosmetic_hat.png";
import scriptureRewardEliteMindFragmentUrl from "../assets/ui/scripture_reward_elite_mind_fragment.png";
import scriptureRewardEpicTitleScrollUrl from "../assets/ui/scripture_reward_epic_title_scroll.png";
import scriptureRewardLightfootFragmentUrl from "../assets/ui/scripture_reward_lightfoot_fragment.png";
import scriptureRewardSwordTasselUrl from "../assets/ui/scripture_reward_sword_tassel.png";
import uiCardInsightUrl from "../assets/ui/ui_card_insight.png";
import uiCardScriptureUrl from "../assets/ui/ui_card_scripture.png";
import uiButtonPrimaryUrl from "../assets/ui/ui_button_primary.png";
import uiIconInsightMoveUrl from "../assets/ui/ui_icon_insight_move_placeholder.png";
import uiIconInsightPickupUrl from "../assets/ui/ui_icon_insight_pickup_placeholder.png";
import uiIconInsightYulongUrl from "../assets/ui/ui_icon_insight_yulong_placeholder.png";
import uiIconPauseUrl from "../assets/ui/ui_icon_pause.png";
import uiHudHealthPanelUrl from "../assets/ui/sw-art-015/ui_hud_health_panel.png";
import uiHudInnerPowerBarUrl from "../assets/ui/sw-art-015/ui_hud_inner_power_bar.png";
import uiHudRunPanelUrl from "../assets/ui/sw-art-015/ui_hud_run_panel.png";
import uiHudSkillSlotUrl from "../assets/ui/sw-art-015/ui_hud_skill_slot.png";
import uiHudSkillSlotAdvancedUrl from "../assets/ui/sw-art-015/ui_hud_skill_slot_advanced.png";
import uiIconAdvanceHiddenWeaponPouchUrl from "../assets/ui/sw-art-015/ui_icon_advance_hidden_weapon_pouch.png";
import uiIconAdvanceInnerForceManualUrl from "../assets/ui/sw-art-015/ui_icon_advance_inner_force_manual.png";
import uiIconAdvanceSwordManualPageUrl from "../assets/ui/sw-art-015/ui_icon_advance_sword_manual_page.png";
import uiIconSkillHuifengUrl from "../assets/ui/sw-art-015/ui_icon_skill_huifeng.png";
import uiIconSkillHuifengAdvancedUrl from "../assets/ui/sw-art-015/ui_icon_skill_huifeng_advanced.png";
import uiIconSkillYulongUrl from "../assets/ui/sw-art-015/ui_icon_skill_yulong.png";
import uiIconSkillYulongAdvancedUrl from "../assets/ui/sw-art-015/ui_icon_skill_yulong_advanced.png";
import uiIconSkillZhenshanUrl from "../assets/ui/sw-art-015/ui_icon_skill_zhenshan.png";
import uiIconSkillZhenshanAdvancedUrl from "../assets/ui/sw-art-015/ui_icon_skill_zhenshan_advanced.png";
import uiIconSkillMoranUrl from "../assets/ui/ui_icon_skill_moran.png";
import uiIconSkillMoranAdvancedUrl from "../assets/ui/ui_icon_skill_moran_advanced.png";
import uiMarkPoisonUrl from "../assets/ui/ui_mark_poison.png";
import uiBadgeDuplicateUrl from "../assets/ui/sw-art-016/ui_badge_duplicate.png";
import uiBadgePityUrl from "../assets/ui/sw-art-016/ui_badge_pity.png";
import uiButtonDisabledUrl from "../assets/ui/sw-art-016/ui_button_disabled.png";
import uiIconPassiveBodyTrainingUrl from "../assets/ui/sw-art-016/ui_icon_passive_body_training.png";
import uiIconPassiveLightfootUrl from "../assets/ui/sw-art-016/ui_icon_passive_lightfoot.png";
import uiIconPassivePickupRadiusUrl from "../assets/ui/sw-art-016/ui_icon_passive_pickup_radius.png";
import uiIconScriptureBodyFragmentUrl from "../assets/ui/sw-art-016/ui_icon_scripture_body_fragment.png";
import uiIconScriptureCommonFragmentUrl from "../assets/ui/sw-art-016/ui_icon_scripture_common_fragment.png";
import uiIconScriptureCompensationCopperUrl from "../assets/ui/sw-art-016/ui_icon_scripture_compensation_copper.png";
import uiIconScriptureCompensationFragmentUrl from "../assets/ui/sw-art-016/ui_icon_scripture_compensation_fragment.png";
import uiIconScriptureCopperReturnUrl from "../assets/ui/sw-art-016/ui_icon_scripture_copper_return.png";
import uiIconScriptureEliteMindFragmentUrl from "../assets/ui/sw-art-016/ui_icon_scripture_elite_mind_fragment.png";
import uiIconScriptureLightfootFragmentUrl from "../assets/ui/sw-art-016/ui_icon_scripture_lightfoot_fragment.png";
import uiSliderKnobUrl from "../assets/ui/sw-art-016/ui_slider_knob.png";
import uiSliderTrackUrl from "../assets/ui/sw-art-016/ui_slider_track.png";
import uiToggleOffUrl from "../assets/ui/sw-art-016/ui_toggle_off.png";
import uiToggleOnUrl from "../assets/ui/sw-art-016/ui_toggle_on.png";
import uiFrameRarityCommonUrl from "../assets/ui/sw-art-017/ui_frame_rarity_common.png";
import uiFrameRarityEliteUrl from "../assets/ui/sw-art-017/ui_frame_rarity_elite.png";
import uiFrameRarityEpicUrl from "../assets/ui/sw-art-017/ui_frame_rarity_epic.png";
import uiFrameRarityRareUrl from "../assets/ui/sw-art-017/ui_frame_rarity_rare.png";
import uiIconBackUrl from "../assets/ui/sw-art-017/ui_icon_back.png";
import uiIconHomeUrl from "../assets/ui/sw-art-017/ui_icon_home.png";
import uiIconLowVfxUrl from "../assets/ui/sw-art-017/ui_icon_low_vfx.png";
import uiIconMuteUrl from "../assets/ui/sw-art-017/ui_icon_mute.png";
import uiIconRestartUrl from "../assets/ui/sw-art-017/ui_icon_restart.png";
import uiIconSoundUrl from "../assets/ui/sw-art-017/ui_icon_sound.png";
import uiPanelScriptureResultSingleUrl from "../assets/ui/sw-art-017/ui_panel_scripture_result_single.png";
import uiPanelScriptureResultTenUrl from "../assets/ui/sw-art-017/ui_panel_scripture_result_ten.png";
import uiPanelSettingsUrl from "../assets/ui/sw-art-017/ui_panel_settings.png";
import uiPanelDeathUrl from "../assets/ui/ui_panel_death.png";
import uiPanelHudUrl from "../assets/ui/ui_panel_hud.png";
import uiPanelMenuUrl from "../assets/ui/ui_panel_menu.png";
import uiPanelPauseUrl from "../assets/ui/ui_panel_pause.png";
import uiPanelResultUrl from "../assets/ui/ui_panel_result.png";
import uiPanelScriptureProbabilityUrl from "../assets/ui/ui_panel_scripture_probability.png";
import uiDividerFlourishUrl from "../assets/ui/divider_flourish.png";
import uiHudEmblemFrameUrl from "../assets/ui/hud_emblem_frame.png";
import uiHudTopStripUrl from "../assets/ui/hud_top_strip.png";
import uiPanelModalUrl from "../assets/ui/panel_modal.png";
import uiSkillSlotFrameUrl from "../assets/ui/skill_slot_frame.png";
import iconCoinUrl from "../assets/ui/icon_coin.png";
import iconFullscreenUrl from "../assets/ui/icon_fullscreen.png";
import iconGearUrl from "../assets/ui/icon_gear.png";
import iconHourglassUrl from "../assets/ui/icon_hourglass.png";
import iconKillUrl from "../assets/ui/icon_kill.png";
import iconLowvfxUrl from "../assets/ui/icon_lowvfx.png";
import iconMusicUrl from "../assets/ui/icon_music.png";
import iconMuteUrl from "../assets/ui/icon_mute.png";
import iconScrollUrl from "../assets/ui/icon_scroll.png";
import iconSfxUrl from "../assets/ui/icon_sfx.png";
import iconSwordUrl from "../assets/ui/icon_sword.png";
import titleBannerUrl from "../assets/ui/title_banner.png";
import uiScrollPaperUrl from "../assets/ui/ui_scroll_paper.png";
import uiScrollRodUrl from "../assets/ui/ui_scroll_rod.png";
import uiScrollCordUrl from "../assets/ui/ui_scroll_cord.png";

export const artAssetUrls = {
  bamboo_edge_cluster: bambooEdgeClusterUrl,
  boss_heifeng_attack: bossHeifengAttackUrl,
  boss_heifeng_idle: bossHeifengIdleUrl,
  decor_flag: decorFlagUrl,
  decor_lantern: decorLanternUrl,
  decor_stele: decorSteleUrl,
  decor_winejar: decorWinejarUrl,
  distant_gate_shadow: distantGateShadowUrl,
  drop_inner_large: dropInnerLargeUrl,
  drop_inner_medium: dropInnerMediumUrl,
  drop_inner_small: dropInnerSmallUrl,
  enemy_bandit_grunt_walk: enemyBanditGruntWalkUrl,
  enemy_hound_run: enemyHoundRunUrl,
  enemy_shield_bandit_walk: enemyShieldBanditWalkUrl,
  enemy_wooden_dummy_elite_walk: enemyWoodenDummyEliteWalkUrl,
  ground_qingshi_base: groundQingshiBaseUrl,
  ground_maple_base: groundMapleBaseUrl,
  maple_tree_cluster: mapleTreeClusterUrl,
  decor_stone_lion: decorStoneLionUrl,
  decor_sword_mound: decorSwordMoundUrl,
  hero_shaoxia_hurt: heroShaoxiaHurtUrl,
  hero_shaoxia_idle: heroShaoxiaIdleUrl,
  hero_shaoxia_move: heroShaoxiaMoveUrl,
  road_ribbon_a: roadRibbonAUrl,
  road_ribbon_b: roadRibbonBUrl,
  rock_cluster: rockClusterUrl,
  skill_huifeng_advanced_dart: skillHuifengAdvancedDartUrl,
  skill_huifeng_dart: skillHuifengDartUrl,
  skill_yulong_advanced_projectile: skillYulongAdvancedProjectileUrl,
  skill_yulong_projectile: skillYulongProjectileUrl,
  skill_zhenshan_advanced_wave: skillZhenshanAdvancedWaveUrl,
  skill_zhenshan_wave: skillZhenshanWaveUrl,
  vfx_boss_charge_warning: vfxBossChargeWarningUrl,
  vfx_boss_whirlwind_warning: vfxBossWhirlwindWarningUrl,
  vfx_death_vignette: vfxDeathVignetteUrl,
  vfx_elite_warning: vfxEliteWarningUrl,
  vfx_enemy_die: vfxEnemyDieUrl,
  vfx_ground_crack: vfxGroundCrackUrl,
  vfx_hero_hurt_flash: vfxHeroHurtFlashUrl,
  vfx_hit_light: vfxHitLightUrl,
  vfx_ink_splat: vfxInkSplatUrl,
  vfx_ink_stroke_1: vfxInkStroke1Url,
  vfx_ink_stroke_2: vfxInkStroke2Url,
  vfx_ink_stroke_3: vfxInkStroke3Url,
  vfx_ink_stroke_4: vfxInkStroke4Url,
  vfx_inner_magnet_trail: vfxInnerMagnetTrailUrl,
  vfx_poison_bubble: vfxPoisonBubbleUrl,
  vfx_poison_bubble_gold: vfxPoisonBubbleGoldUrl,
  vfx_insight_burst: vfxInsightBurstUrl,
  vfx_scripture_reveal: vfxScriptureRevealUrl,
  vfx_skill_advance: vfxSkillAdvanceUrl,
  meta_icon_body_training: metaIconBodyTrainingUrl,
  meta_icon_lightfoot: metaIconLightfootUrl,
  meta_icon_magnet_pouch: metaIconMagnetPouchUrl,
  scripture_compensation_copper: scriptureCompensationCopperUrl,
  scripture_compensation_fragment: scriptureCompensationFragmentUrl,
  scripture_reward_body_fragment: scriptureRewardBodyFragmentUrl,
  scripture_reward_common_fragment: scriptureRewardCommonFragmentUrl,
  scripture_reward_copper_return: scriptureRewardCopperReturnUrl,
  scripture_reward_cosmetic_hat: scriptureRewardCosmeticHatUrl,
  scripture_reward_elite_mind_fragment: scriptureRewardEliteMindFragmentUrl,
  scripture_reward_epic_title_scroll: scriptureRewardEpicTitleScrollUrl,
  scripture_reward_lightfoot_fragment: scriptureRewardLightfootFragmentUrl,
  scripture_reward_sword_tassel: scriptureRewardSwordTasselUrl,
  ui_card_insight: uiCardInsightUrl,
  ui_card_scripture: uiCardScriptureUrl,
  ui_button_primary: uiButtonPrimaryUrl,
  ui_icon_insight_move_placeholder: uiIconInsightMoveUrl,
  ui_icon_insight_pickup_placeholder: uiIconInsightPickupUrl,
  ui_icon_insight_yulong_placeholder: uiIconInsightYulongUrl,
  ui_icon_pause: uiIconPauseUrl,
  ui_hud_health_panel: uiHudHealthPanelUrl,
  ui_hud_inner_power_bar: uiHudInnerPowerBarUrl,
  ui_hud_run_panel: uiHudRunPanelUrl,
  ui_hud_skill_slot: uiHudSkillSlotUrl,
  ui_hud_skill_slot_advanced: uiHudSkillSlotAdvancedUrl,
  ui_icon_advance_hidden_weapon_pouch: uiIconAdvanceHiddenWeaponPouchUrl,
  ui_icon_advance_inner_force_manual: uiIconAdvanceInnerForceManualUrl,
  ui_icon_advance_sword_manual_page: uiIconAdvanceSwordManualPageUrl,
  ui_icon_skill_huifeng: uiIconSkillHuifengUrl,
  ui_icon_skill_huifeng_advanced: uiIconSkillHuifengAdvancedUrl,
  ui_icon_skill_yulong: uiIconSkillYulongUrl,
  ui_icon_skill_yulong_advanced: uiIconSkillYulongAdvancedUrl,
  ui_icon_skill_zhenshan: uiIconSkillZhenshanUrl,
  ui_icon_skill_zhenshan_advanced: uiIconSkillZhenshanAdvancedUrl,
  ui_icon_skill_moran: uiIconSkillMoranUrl,
  ui_icon_skill_moran_advanced: uiIconSkillMoranAdvancedUrl,
  ui_mark_poison: uiMarkPoisonUrl,
  ui_badge_duplicate: uiBadgeDuplicateUrl,
  ui_badge_pity: uiBadgePityUrl,
  ui_button_disabled: uiButtonDisabledUrl,
  ui_icon_passive_body_training: uiIconPassiveBodyTrainingUrl,
  ui_icon_passive_lightfoot: uiIconPassiveLightfootUrl,
  ui_icon_passive_pickup_radius: uiIconPassivePickupRadiusUrl,
  ui_icon_scripture_body_fragment: uiIconScriptureBodyFragmentUrl,
  ui_icon_scripture_common_fragment: uiIconScriptureCommonFragmentUrl,
  ui_icon_scripture_compensation_copper: uiIconScriptureCompensationCopperUrl,
  ui_icon_scripture_compensation_fragment: uiIconScriptureCompensationFragmentUrl,
  ui_icon_scripture_copper_return: uiIconScriptureCopperReturnUrl,
  ui_icon_scripture_elite_mind_fragment: uiIconScriptureEliteMindFragmentUrl,
  ui_icon_scripture_lightfoot_fragment: uiIconScriptureLightfootFragmentUrl,
  ui_slider_knob: uiSliderKnobUrl,
  ui_slider_track: uiSliderTrackUrl,
  ui_toggle_off: uiToggleOffUrl,
  ui_toggle_on: uiToggleOnUrl,
  ui_frame_rarity_common: uiFrameRarityCommonUrl,
  ui_frame_rarity_elite: uiFrameRarityEliteUrl,
  ui_frame_rarity_epic: uiFrameRarityEpicUrl,
  ui_frame_rarity_rare: uiFrameRarityRareUrl,
  ui_icon_back: uiIconBackUrl,
  ui_icon_home: uiIconHomeUrl,
  ui_icon_low_vfx: uiIconLowVfxUrl,
  ui_icon_mute: uiIconMuteUrl,
  ui_icon_restart: uiIconRestartUrl,
  ui_icon_sound: uiIconSoundUrl,
  ui_panel_scripture_result_single: uiPanelScriptureResultSingleUrl,
  ui_panel_scripture_result_ten: uiPanelScriptureResultTenUrl,
  ui_panel_settings: uiPanelSettingsUrl,
  ui_panel_death: uiPanelDeathUrl,
  ui_panel_hud: uiPanelHudUrl,
  ui_panel_menu: uiPanelMenuUrl,
  ui_panel_pause: uiPanelPauseUrl,
  ui_panel_result: uiPanelResultUrl,
  ui_panel_scripture_probability: uiPanelScriptureProbabilityUrl,
  ui_divider_flourish: uiDividerFlourishUrl,
  ui_hud_emblem_frame: uiHudEmblemFrameUrl,
  ui_hud_top_strip: uiHudTopStripUrl,
  ui_panel_modal: uiPanelModalUrl,
  ui_skill_slot_frame: uiSkillSlotFrameUrl,
  icon_coin: iconCoinUrl,
  icon_fullscreen: iconFullscreenUrl,
  icon_gear: iconGearUrl,
  icon_hourglass: iconHourglassUrl,
  icon_kill: iconKillUrl,
  icon_lowvfx: iconLowvfxUrl,
  icon_music: iconMusicUrl,
  icon_mute: iconMuteUrl,
  icon_scroll: iconScrollUrl,
  icon_sfx: iconSfxUrl,
  icon_sword: iconSwordUrl,
  title_banner: titleBannerUrl,
  ui_scroll_paper: uiScrollPaperUrl,
  ui_scroll_rod: uiScrollRodUrl,
  ui_scroll_cord: uiScrollCordUrl,
  wood_stake_flag: woodStakeFlagUrl
} satisfies Record<string, string>;

export type ArtAssetId = keyof typeof artAssetUrls;

export function preloadArtAssets(scene: Phaser.Scene): void {
  const missingRequiredUrls = getMissingRequiredArtAssetUrlIds();
  if (missingRequiredUrls.length > 0) {
    throw new Error(`Missing required art asset URL imports: ${missingRequiredUrls.join(", ")}`);
  }

  for (const item of artManifest) {
    const url = artAssetUrls[item.id as ArtAssetId];
    if (!url) {
      continue;
    }

    if ((item.frames ?? 1) > 1) {
      scene.load.spritesheet(item.id, url, {
        frameWidth: item.width,
        frameHeight: item.height,
        endFrame: (item.frames ?? 1) - 1
      });
      continue;
    }

    scene.load.image(item.id, url);
  }
}

export function registerArtAnimations(scene: Phaser.Scene): void {
  for (const item of artManifest) {
    const frameCount = item.frames ?? 1;
    if (item.type === "ui" || item.frameRate === 0 || frameCount <= 1 || !scene.textures.exists(item.id)) {
      continue;
    }

    const animationKey = getArtAnimationKey(item.id);
    if (scene.anims.exists(animationKey)) {
      continue;
    }

    scene.anims.create({
      key: animationKey,
      frames: scene.anims.generateFrameNumbers(item.id, { start: 0, end: frameCount - 1 }),
      frameRate: item.frameRate ?? 10,
      // 一次性特效（命中/死亡/揭示）播放一次后停在末帧，由调用方 animationcomplete 销毁
      repeat: item.loop === false ? 0 : -1
    });
  }
}

export function getArtAnimationKey(assetId: string): string {
  return `${assetId}_anim`;
}

export function getMissingRequiredArtAssetUrlIds(): string[] {
  return artManifest
    .filter((item) => item.required && artAssetUrls[item.id as ArtAssetId] === undefined)
    .map((item) => item.id);
}
