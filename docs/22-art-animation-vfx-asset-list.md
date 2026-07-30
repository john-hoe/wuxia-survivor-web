# 22 Art Animation VFX Asset List

## 目的

本文细化 [10 Art Animation VFX](10-art-animation-vfx.md)，把 MVP 资产拆成可制作、可登记、可验收的清单。

第一性原则：

- 每个玩法对象都必须有可识别外观。
- 每个关键状态都必须有动画或特效。
- 资产可以简化，但不能不可区分。
- 首包体积和同屏 VFX 必须服从性能预算。

## 命名规则

```text
category_object_action_variant.ext
```

示例：

- `hero_shaoxia_move_01.png`
- `enemy_bandit_grunt_walk.png`
- `vfx_skill_yulong_hit.png`
- `ui_icon_skill_yulong.png`
- `audio_hit_light_01.ogg`

所有资产登记到 `src/data/artManifest.ts`。

## Manifest 字段

```ts
type ArtManifestItem = {
  id: string;
  type: "sprite" | "spritesheet" | "vfx" | "ui" | "background";
  path: string;
  width: number;
  height: number;
  frames?: number;
  frameRate?: number;
  usage: string;
  fallback: "shape" | "tint" | "hidden";
  required: boolean;
};
```

## P0 角色资产

| id | 尺寸 | 帧数 | 用途 | fallback |
| --- | ---: | ---: | --- | --- |
| `hero_shaoxia_idle` | 256x256 | 4 | 少侠待机（2× 最终帧） | 青白菱形 |
| `hero_shaoxia_move` | 256x256 | 6 | 少侠移动（2× 最终帧） | 青白菱形 + 朝向箭头 |
| `hero_shaoxia_hurt` | 256x256 | 2 | 受伤闪烁（2× 最终帧） | 白/红闪 |
| `enemy_bandit_grunt_walk` | 192x192 | 4 | 山贼喽啰移动（2× 最终帧） | 暖色圆角剪影 |
| `enemy_hound_run` | 192x192 | 4 | 恶犬移动；2× 最终帧 | 暗红低矮剪影 |
| `enemy_shield_bandit_walk` | 256x256 | 4 | 持盾山贼移动；2× 最终帧 | 大盾剪影 |
| `enemy_wooden_dummy_elite_walk` | 352x352 | 4 | 木人机关移动；2× 最终帧 | 木色大剪影 |
| `boss_heifeng_idle` | 416x416 | 4 | 黑风寨主待机；2× 最终帧 | 深红大剪影 |
| `boss_heifeng_attack` | 416x416 | 6 | 头目攻击；2× 最终帧 | 深红大剪影 + 刀光 |

## 掉落物资产

| id | 尺寸 | 动画 | 颜色规则 |
| --- | ---: | --- | --- |
| `drop_inner_small` | 32x32 | 浮动/闪烁 | 蓝青，亮度低 |
| `drop_inner_medium` | 40x40 | 浮动/闪烁 | 蓝青，亮度中 |
| `drop_inner_large` | 52x52 | 浮动/闪烁 | 蓝青，亮度高 |
| `drop_copper` | 32x32 | 轻微旋转 | 金黄，不接近危险红橙 |
| `drop_heal_pill` | 36x36 | 脉冲 | 绿色或白红，不能像铜钱 |

## 招式资产

| id | 尺寸 | 用途 |
| --- | ---: | --- |
| `skill_yulong_projectile` | 96x32 | 游龙剑气弹体 |
| `skill_yulong_advanced_projectile` | 128x44 | 游龙归海弹体 |
| `skill_huifeng_dart` | 40x40 | 回风飞镖 |
| `skill_huifeng_advanced_dart` | 48x48 | 回风连环 |
| `skill_zhenshan_wave` | 256x256 | 震山掌冲击波 |
| `skill_zhenshan_advanced_wave` | 384x384 | 裂石掌风 |

图标：

- 每个 P0 招式 1 个 64x64 图标。
- 每个进阶 1 个 64x64 图标。
- 图标 64x64 下必须能分辨主体。

## VFX 清单

| id | 时长 | 上限 | 用途 |
| --- | ---: | ---: | --- |
| `vfx_hit_light` | 0.12s | 40 | 普通命中 |
| `vfx_enemy_die` | 0.25s | 30 | 敌人死亡 |
| `vfx_inner_magnet_trail` | 0.35s | 80 | 内力吸附 |
| `vfx_insight_burst` | 0.6s | 1 | 领悟 |
| `vfx_skill_advance` | 0.9s | 1 | 招式进阶 |
| `vfx_hero_hurt_flash` | 0.18s | 1 | 受伤 |
| `vfx_death_vignette` | 0.8-1.2s | 1 | 阵亡过渡 |
| `vfx_elite_warning` | 1.2s | 2 | 精英预警 |
| `vfx_boss_charge_warning` | 0.75s | 1 | 冲撞斩预兆 |
| `vfx_boss_whirlwind_warning` | 0.9s | 1 | 旋风刀预兆 |
| `vfx_scripture_reveal` | 0.8s | 1 | 翻阅秘籍揭示 |

## UI 资产

| id | 尺寸 | 用途 |
| --- | ---: | --- |
| `ui_panel_hud` | 512x128 | HUD 底板 |
| `ui_panel_menu` | 960x640 | 主菜单 |
| `ui_panel_pause` | 640x720 | 暂停页 |
| `ui_panel_result` | 720x760 | 战后清点 |
| `ui_panel_death` | 720x360 | 阵亡过渡文案层 |
| `ui_card_insight` | 320x460 | 领悟卡 |
| `ui_card_scripture` | 320x460 | 秘籍结果卡 |
| `ui_panel_scripture_probability` | 720x280 | 翻阅秘籍概率说明 |
| `ui_button_primary` | 320x96 | 主按钮 |
| `ui_icon_pause` | 96x96 | 暂停按钮 |
| `ui_icon_advance_sword_manual_page` | 64x64 | `SW-ART-015` 领悟页 `剑谱残页` 进阶信物 |
| `ui_icon_advance_hidden_weapon_pouch` | 64x64 | `SW-ART-015` 领悟页 `暗器囊` 进阶信物 |
| `ui_icon_advance_inner_force_manual` | 64x64 | `SW-ART-015` 领悟页 `内劲心法` 进阶信物 |
| `ui_icon_skill_yulong` | 64x64 | `SW-ART-015` `游龙剑气` 基础招式图标 |
| `ui_icon_skill_yulong_advanced` | 64x64 | `SW-ART-015` `游龙归海` 进阶图标 |
| `ui_icon_skill_huifeng` | 64x64 | `SW-ART-015` `回风飞镖` 基础招式图标 |
| `ui_icon_skill_huifeng_advanced` | 64x64 | `SW-ART-015` `回风连环` 进阶图标 |
| `ui_icon_skill_zhenshan` | 64x64 | `SW-ART-015` `震山掌` 基础招式图标 |
| `ui_icon_skill_zhenshan_advanced` | 64x64 | `SW-ART-015` `裂石掌风` 进阶图标 |
| `ui_hud_health_panel` | 280x80 | `SW-ART-015` 左上血量/等级 HUD 面板 |
| `ui_hud_run_panel` | 260x80 | `SW-ART-015` 右上时间/击杀 HUD 面板 |
| `ui_hud_inner_power_bar` | 420x44 | `SW-ART-015` 顶部内力条底槽 |
| `ui_hud_skill_slot` | 72x72 | `SW-ART-015` 底部招式槽普通态 |
| `ui_hud_skill_slot_advanced` | 72x72 | `SW-ART-015` 底部招式槽进阶态 |
| `ui_icon_passive_body_training` | 64x64 | `SW-ART-016` 领悟页体魄被动图标 |
| `ui_icon_passive_lightfoot` | 64x64 | `SW-ART-016` 领悟页轻功被动图标 |
| `ui_icon_passive_pickup_radius` | 64x64 | `SW-ART-016` 领悟页拾取范围被动图标 |
| `ui_icon_scripture_common_fragment` | 64x64 | `SW-ART-016` 翻阅秘籍普通残页奖励图标 |
| `ui_icon_scripture_body_fragment` | 64x64 | `SW-ART-016` 翻阅秘籍体魄碎片奖励图标 |
| `ui_icon_scripture_lightfoot_fragment` | 64x64 | `SW-ART-016` 翻阅秘籍轻功碎片奖励图标 |
| `ui_icon_scripture_elite_mind_fragment` | 64x64 | `SW-ART-016` 翻阅秘籍心法碎片奖励图标 |
| `ui_icon_scripture_copper_return` | 64x64 | `SW-ART-016` 翻阅秘籍铜钱返还奖励图标 |
| `ui_icon_scripture_compensation_fragment` | 64x64 | `SW-ART-016` 重复奖励转残页补偿图标 |
| `ui_icon_scripture_compensation_copper` | 64x64 | `SW-ART-016` 重复奖励转铜钱补偿图标 |
| `ui_toggle_on` | 96x52 | `SW-ART-016` 设置页开关开启态 |
| `ui_toggle_off` | 96x52 | `SW-ART-016` 设置页开关关闭态 |
| `ui_slider_track` | 320x48 | `SW-ART-016` 设置页音量滑杆轨道 |
| `ui_slider_knob` | 48x48 | `SW-ART-016` 设置页音量滑杆滑块 |
| `ui_button_disabled` | 320x96 | `SW-ART-016` 禁用按钮底图 |
| `ui_badge_pity` | 64x64 | `SW-ART-016` 翻阅秘籍保底提示角标 |
| `ui_badge_duplicate` | 64x64 | `SW-ART-016` 翻阅秘籍重复转化角标 |
| `meta_icon_body_training` | 64x64 | `SW-ART-014` 体魄训练局外成长图标 |
| `meta_icon_lightfoot` | 64x64 | `SW-ART-014` 轻功步法局外成长图标 |
| `meta_icon_magnet_pouch` | 64x64 | `SW-ART-014` 磁石锦囊局外成长图标 |
| `scripture_reward_common_fragment` | 64x64 | `SW-ART-014` 普通秘籍残页奖励图标 |
| `scripture_reward_copper_return` | 64x64 | `SW-ART-014` 铜钱返还奖励图标 |
| `scripture_reward_cosmetic_hat` | 64x64 | `SW-ART-014` 斗笠外观奖励图标 |
| `scripture_reward_sword_tassel` | 64x64 | `SW-ART-014` 剑穗外观奖励图标 |
| `scripture_reward_body_fragment` | 64x64 | `SW-ART-014` 体魄成长碎片奖励图标 |
| `scripture_reward_lightfoot_fragment` | 64x64 | `SW-ART-014` 轻功成长碎片奖励图标 |
| `scripture_reward_elite_mind_fragment` | 64x64 | `SW-ART-014` 稀有心法碎片奖励图标 |
| `scripture_reward_epic_title_scroll` | 64x64 | `SW-ART-014` 史诗称号卷轴奖励图标 |
| `scripture_compensation_fragment` | 64x64 | `SW-ART-014` 重复奖励转残页补偿图标 |
| `scripture_compensation_copper` | 64x64 | `SW-ART-014` 重复奖励转铜钱补偿图标 |

## 背景和场景物件资产

`SW-ART-011` 当前工程基线采用 Round 003 A / Clean Stone / `003a`，正式文件位于 `game/src/assets/backgrounds/`。

| id | 尺寸 | 用途 | required | fallback |
| --- | ---: | --- | --- | --- |
| `ground_qingshi_base` | 1024x1024 | 青石山道低噪声地表 | yes | shape |
| `road_ribbon_a` | 1024x512 | 青石路主走向 | yes | shape |
| `road_ribbon_b` | 1024x512 | 青石路变化层 | yes | shape |
| `bamboo_edge_cluster` | 512x512 | 竹林边缘氛围 | no | hidden |
| `rock_cluster` | 256x256 | 低对比碎石点缀 | no | hidden |
| `wood_stake_flag` | 256x256 | 木桩残旗方向提示 | no | hidden |
| `distant_gate_shadow` | 1024x512 | 远处寨门剪影 | no | hidden |

验收口径：背景不得被误认为内力光点、铜钱、回血或危险红橙预警；桌面和移动横屏截图中少侠、敌人、掉落和招式 VFX 必须 3 秒内可读。

## 动画规格

| 动画 | 帧数/时长 | 规则 |
| --- | --- | --- |
| 少侠移动 | 4-6 帧，8-12 fps | 方向清楚 |
| 敌人移动 | 4 帧，6-10 fps | 不需要复杂 |
| 受击闪烁 | 0.08-0.15s | 不改变碰撞 |
| 死亡 | 0.15-0.35s | 播完回收 |
| 阵亡过渡 | 0.8-1.2s | 降饱和 + 墨色压边，不阻塞超过 1.5s |
| 内力吸附 | 0.25-0.45s | 加速飞向少侠 |
| 领悟卡弹入 | 0.15-0.3s | 不拖慢选择 |
| 头目入场 | 0.8-1.5s | 可跳过长动画，不阻塞 |

## 性能预算

- 首包美术体积建议 <=10MB。
- 单张 sprite sheet <=2048x2048。
- 常驻活跃 VFX <=80。
- 爆发峰值 VFX <=160，持续不超过 1 秒。
- 低 VFX 模式关闭伤害数字、减少尾迹、降低粒子数量 40% 到 60%。

## 验收

- 调试面板缺失必需资产数为 0。
- 3 秒截图可识别少侠、敌人、内力、铜钱、回血、头目和危险范围。
- 同屏 120 敌人时，背景和 VFX 不淹没少侠。
- 每个 P0 招式都有弹体、图标、命中反馈。
- 头目两个攻击都有预兆 VFX。
- 主菜单、阵亡过渡、战后清点、翻阅秘籍都有 UI 资产或明确 fallback。
- 翻阅秘籍结果卡在 64x64 图标尺寸下能区分稀有度和奖励类型。
- fallback 图形能明确提示缺资产，但不能进入最终验收版本。
