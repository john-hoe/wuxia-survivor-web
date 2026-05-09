# 32 P0 Image Batch 001 Generation And Review

## 定位

`P0-image-batch-001` 不是继续写大而全美术 spec，而是进入第一批实际生产闭环：

```text
生图候选 -> 审图评分 -> 淘汰/保留 -> 不达标则重新生图 -> 再审图 -> 全部达标 -> 切图导入 -> 浏览器截图验收
```

本批只覆盖当前战斗和 `SW-PROG-001` 的最小可玩视觉资产：

- 少侠
- 山贼喽啰
- 游龙剑气弹体
- 命中 VFX
- 击杀 VFX
- 内力光点
- 吸附轨迹
- 领悟页卡牌底板和当前三张卡的图标占位

本批不做头目、恶犬、持盾山贼、木人机关、完整秘籍 UI、背景精修、商业化 UI 或额外招式。

## 生产闭环门禁

每个资产必须按以下闭环推进，不允许只生成候选图就进入切图或工程导入：

1. 每个目标资产先生成至少 `4` 个候选；如果当前只生成了 `1` 个候选，也必须先审图，不能默认通过。
2. 每个候选按 25 分审图表评分。
3. 总分 `>=21/25`，且 5 个硬维度都 `>=4/5`，才记为 `pass`。
4. 总分 `18-20` 记为 `revise`，只能作为修改参考，不能进入切图导入。
5. 总分 `<18` 记为 `reject`。
6. 出现文字、水印、伪字、商业素材感、明显仙侠/科幻/氪金 UI、复杂不可抠背景，直接 `reject`，不看总分。
7. 每个目标资产至少需要 `1` 个 `pass` 候选；没有 pass 或 pass 数量不足，就必须重新生图。
8. 重新生图后必须再次审图评分，直到每个目标资产都至少有 `1` 个 pass。
9. 只有全部目标资产都达标后，才允许进入透明边缘检查、切图、spritesheet 重排和 manifest 准备。

`SW-ART-007` 的完成口径不是“候选图存在”，而是“本批目标资产全部至少 1 个 pass，并有完整评分表、淘汰原因和下一步切图清单”。

## 生成规则

统一要求：

- 背景使用纯色平面 chroma-key，默认 `#FF00FF` 洋红；若资产主体含洋红，再改用 `#00FF00`。
- 生图结果可以先是 chroma-key 背景，但切图交付必须是透明 PNG。
- 所有图无文字、无 logo、无水印、无伪字、无 UI 烘焙文案。
- 风格为原创轻武侠江湖风，2D 俯视或 3/4 俯视，手机屏幕可读。
- 禁止仙侠飞升、修仙法阵、科幻霓虹、氪金抽卡 UI、商业游戏复刻。
- spritesheet 帧序默认从左到右、单行排列；每帧至少 8px 透明边距。
- VFX 透明边缘必须可控，不能用黑底、白底、纸张底板或不可抠的烟雾背景。

建议每个资产先生成 4 个候选，审图只保留评分最高且达到 pass 线的 1 到 2 个进入切图；如果 4 个都未达标，立即重新生图，不进入切图阶段。

## 资产生成表

| id | 用途 | 尺寸和帧数 | 导入目标路径建议 | Prompt | 审图通过线 |
| --- | --- | --- | --- | --- | --- |
| `hero_shaoxia_idle` | 少侠待机 | 每帧 `128x128`，4 帧，单行 sheet `512x128`，8fps | `game/src/assets/sprites/hero/hero_shaoxia_idle.png` | `原创轻武侠 Web survivor-like game hero idle spritesheet, 少侠主角, 3/4 top-down 2D, white and teal clothes #EAF9F3 #39D6B5, small douli hat, short cloak, waist sword scabbard, clear dark outline, low detail high readability, 4 idle breathing frames left-to-right, centered, 8px safe margin, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly cutout, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 64px 下能认出主角；白青轮廓不被暖棕敌人吞掉；中心跳动 <=4px |
| `hero_shaoxia_move` | 少侠移动 | 每帧 `128x128`，6 帧，单行 sheet `768x128`，10fps | `game/src/assets/sprites/hero/hero_shaoxia_move.png` | `原创轻武侠 Web survivor-like game hero running spritesheet, 少侠移动动作, 3/4 top-down 2D, white teal cloth, short cloak swinging, waist sword scabbard, body leaning forward, readable direction, 6 walk/run frames left-to-right, clear silhouette for mobile, dark teal outline, centered each frame, 8px margin, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 动作幅度可见但不改变碰撞暗示；64px 下仍能定位朝向和主角身份 |
| `hero_shaoxia_hurt` | 少侠受伤闪白 | 每帧 `128x128`，2 帧，单行 sheet `256x128`，12fps | `game/src/assets/sprites/hero/hero_shaoxia_hurt.png` | `原创轻武侠 Web game hero hurt flash spritesheet, 少侠受伤反馈, same hero silhouette as idle, frame 1 white flash, frame 2 subtle red edge flash, no blood gore, 3/4 top-down 2D, clear dark outline, centered, 8px margin, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly cutout, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 0.12-0.18s 内明显受伤；不能像敌方红橙危险预兆；主体尺寸与 idle 一致 |
| `enemy_bandit_grunt_walk` | 山贼喽啰 | 每帧 `96x96`，4 帧，单行 sheet `384x96`，8fps | `game/src/assets/sprites/enemies/enemy_bandit_grunt_walk.png` | `原创轻武侠 Web survivor-like enemy spritesheet, 普通山贼喽啰, warm brown cloth #9B5438, dark red-brown outline #5B2F28, short wooden club or small knife silhouette, hunched shoulders, head scarf corner, 3/4 top-down 2D, 4 walking frames left-to-right, mobile readable, centered, 8px margin, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 64px 下是暖棕人形敌人；不能像少侠、铜钱或持盾敌；中心跳动 <=4px |
| `skill_yulong_projectile` | 游龙剑气弹体 | 每帧 `96x32`，4 帧，单行 sheet `384x32`，12fps | `game/src/assets/sprites/skills/skill_yulong_projectile.png` | `原创轻武侠 skill projectile spritesheet, 游龙剑气, cyan white crescent sword qi, clear pointed tip facing right, short teal tail streaks, 2D top-down projectile, simple readable silhouette, visual width 70-86px inside 96x32 frame, 4 flowing frames left-to-right, centered, 8px margin, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 32px 仍能判断飞行方向；不能像内力圆点；尾迹不暗示额外大范围伤害 |
| `vfx_hit_light` | 命中短闪 | 每帧 `64x64`，4 帧，单行 sheet `256x64`，24-30fps | `game/src/assets/vfx/vfx_hit_light.png` | `原创轻武侠 combat hit VFX spritesheet, 命中短闪, white cyan impact spark with four tiny sword-light strokes, very small pale yellow highlight under 20%, no red-orange main color, 4 quick fade frames left-to-right, transparent cutout friendly, centered in 64x64, flat solid chroma-key magenta background #FF00FF, no text, no logo, no smoke background, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 0.2s 内能指出被命中的敌人；不遮少侠；不误认为铜钱、领悟爆发或危险范围 |
| `vfx_enemy_die` | 山贼击杀消散 | 每帧 `96x96`，6 帧，单行 sheet `576x96`，24fps | `game/src/assets/vfx/vfx_enemy_die.png` | `原创轻武侠 enemy death VFX spritesheet, 山贼击杀消散, warm brown cloth fragments burst outward, small cyan-white center flash alpha low, no gore, no blood spray, no black smoke cloud, 6 frames left-to-right, fragments fade out, centered in 96x96, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 0.20-0.28s 内确认敌人死亡；不遮挡随后内力掉落；不能大面积红橙 |
| `drop_inner_small` | 小内力光点 | 每帧 `32x32`，4 帧，单行 sheet `128x32`，8fps | `game/src/assets/sprites/drops/drop_inner_small.png` | `原创轻武侠 inner power pickup spritesheet, 小内力光点, blue cyan glowing orb #49D8FF with tiny white core and thin outer ring, not coin, not UI icon, 4 subtle pulse frames left-to-right, centered in 32x32, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 32px 下是蓝青内力点；不能像铜钱、回血或游龙剑气；外发光 alpha 易控 |
| `drop_inner_medium` | 中内力光点 | 每帧 `40x40`，4 帧，单行 sheet `160x40`，8fps | `game/src/assets/sprites/drops/drop_inner_medium.png` | `原创轻武侠 inner power pickup spritesheet, 中内力光点, brighter blue cyan orb, double outer ring, white core, stronger than small inner power but still simple, 4 subtle pulse frames left-to-right, centered in 40x40, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 与小内力有尺寸/亮度递进；32px 缩小时仍不变成普通 UI 圆点 |
| `drop_inner_large` | 大内力光点 | 每帧 `52x52`，4 帧，单行 sheet `208x52`，8fps | `game/src/assets/sprites/drops/drop_inner_large.png` | `原创轻武侠 inner power pickup spritesheet, 大内力光团, blue cyan glow #2FCBFF with white core, short soft tail, clear larger reward, 4 pulse frames left-to-right, centered in 52x52, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 64px 下明显高于中内力；不能像回血药、头目危险或领悟爆发 |
| `vfx_inner_magnet_trail` | 内力吸附轨迹 | 每帧 `32x96`，4 帧，单行 sheet `128x96`，12fps | `game/src/assets/vfx/vfx_inner_magnet_trail.png` | `原创轻武侠 pickup magnet trail spritesheet, 内力吸附尾迹, vertical blue cyan dotted streak fading from bright head to transparent tail, soft curved energy trace, no projectile arrowhead, no red-orange, 4 fade frames left-to-right, centered in 32x96, flat solid chroma-key magenta background #FF00FF, no text, no logo, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 轨迹指向少侠，不能像敌方弹道；同屏 80 条也不糊成雾；尾迹透明可控 |
| `ui_card_insight` | 领悟页卡牌底板 | 单帧 `320x460`，9-slice 友好 | `game/src/assets/ui/insight/ui_card_insight.png` | `原创轻武侠 Web game insight card UI background, 领悟卡牌底板, old cloth and thin copper edge, subtle blue stone texture, empty center space for icon title description rendered by code, no baked text, no symbols that look like currency shop, mobile touch friendly, 320x460, flat solid chroma-key magenta background #FF00FF around card, transparent PNG friendly, no logo, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 无烘焙文字；64px 图标位、标题、描述、按钮区域留白明确；不能像抽卡付费卡面 |
| `ui_icon_insight_yulong_placeholder` | 领悟卡游龙图标占位 | 单帧 `64x64` | `game/src/assets/ui/icons/ui_icon_insight_yulong_placeholder.png` | `原创轻武侠 Web game UI icon, 游龙剑气 placeholder icon, cyan white crescent sword qi on simple transparent-friendly icon shape, thin copper border, subject fills 60-70%, no text, no number, no logo, 64x64, flat solid chroma-key magenta background #FF00FF, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 64px 下能认出剑气；32px 下能区分为招式，不像内力掉落 |
| `ui_icon_insight_move_placeholder` | 领悟卡轻功图标占位 | 单帧 `64x64` | `game/src/assets/ui/icons/ui_icon_insight_move_placeholder.png` | `原创轻武侠 Web game UI icon, 轻功步法 placeholder icon, small cloth shoe with two teal wind strokes, thin copper border, subject fills 60-70%, no text, no number, no logo, 64x64, flat solid chroma-key magenta background #FF00FF, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 64px 下能认出移动/轻功语义；不能像飞镖、铜钱或付费加速图标 |
| `ui_icon_insight_pickup_placeholder` | 领悟卡拾取范围图标占位 | 单帧 `64x64` | `game/src/assets/ui/icons/ui_icon_insight_pickup_placeholder.png` | `原创轻武侠 Web game UI icon, 磁石锦囊 pickup radius placeholder icon, small cloth pouch attracting three blue inner power orbs, thin copper border, subject fills 60-70%, no text, no number, no logo, 64x64, flat solid chroma-key magenta background #FF00FF, transparent PNG friendly, no xianxia, no sci-fi, no gacha premium UI, 不要仙侠/科幻/氪金 UI` | 64px 下能认出吸取/收集语义；不能像充值礼包、商城袋或铜钱奖励 |

## 审图评分表

每个候选按 25 分评分。生产通过线：总分 `>=21/25`，且每个硬门槛 `>=4`。总分 `18-20` 只能作为参考候选，不能直接导入。出现商业素材、水印、文字、伪字、明显仙侠/科幻/氪金 UI，直接 `0 分淘汰`。

| 维度 | 5 分 | 4 分 | 3 分 | 0-2 分 |
| --- | --- | --- | --- | --- |
| 64px 可读 | 64px 静图 3 秒内能认出对象、阵营和功能；弹体能认方向 | 能认出对象和大类，细节略弱 | 需要对照说明才能认出 | 缩小后糊成色块或误判 |
| 轻武侠一致性 | 服饰、材质、色彩、武器都符合原创轻武侠江湖 | 基本轻武侠，仅有少量装饰偏离 | 只有局部像武侠，整体偏通用奇幻 | 仙侠、科幻、现代、商业手游感明显 |
| 混淆风险 | 不会与少侠/敌人/内力/铜钱/危险/HUD 混淆 | 有轻微相似但不影响实战读局 | 至少 1 个关键对象容易混淆 | 高概率误判阵营、掉落或危险 |
| 可切透明 PNG | chroma-key 纯净，主体边缘清楚，无底板阴影和不可抠烟雾 | 少量边缘杂色，可通过一次抠图修复 | 需要较多手工清理 | 背景复杂、文字水印、主体和背景粘连 |
| Phaser 导入可行性 | 尺寸、帧数、帧序、边距、中心稳定完全匹配 | 仅需轻微裁切或重排 | 需要重画部分帧或手动补帧 | 帧不一致、中心漂移严重、超过预算或不适合 spritesheet |

审图记录模板：

| asset id | 候选文件 | 64px 可读 | 轻武侠 | 混淆风险 | 可切透明 | Phaser 可行 | 总分 | 结论 | 修改意见 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `hero_shaoxia_idle` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `enemy_bandit_grunt_walk` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `skill_yulong_projectile` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `vfx_hit_light` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `vfx_enemy_die` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `drop_inner_small` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `vfx_inner_magnet_trail` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `ui_card_insight` |  |  |  |  |  |  |  | pass / revise / reject |  |
| `ui_icon_insight_yulong_placeholder` |  |  |  |  |  |  |  | pass / revise / reject |  |

## 落地目录建议

本任务只给目录建议，不创建资产目录，不改工程代码。

临时生产目录建议：

```text
game/src/assets/_incoming/p0-image-batch-001/
  prompts/
  candidates/
  review-sheets/
  cut-transparent/
  rejected-reference-only/
```

正式导入目录建议：

```text
game/src/assets/sprites/hero/
game/src/assets/sprites/enemies/
game/src/assets/sprites/skills/
game/src/assets/sprites/drops/
game/src/assets/vfx/
game/src/assets/ui/insight/
game/src/assets/ui/icons/
```

`artManifest.ts` 后续建议由工程 worker 统一接入。当前 manifest 的 `path` 仍为空，实际路径字符串可以由工程侧按 Phaser/Vite 加载策略决定；本批交接只保证文件名、尺寸、帧数、透明 PNG 和用途稳定。

按当前 `ArtManifestItem` 类型，建议映射为：

| 资产 | manifest `type` 建议 |
| --- | --- |
| 少侠、山贼、游龙弹体、内力光点 | `spritesheet` |
| 命中、击杀、吸附轨迹 | `vfx` |
| 领悟卡牌底板、领悟图标占位 | `ui` |

不要在当前工程类型未扩展前把 manifest `type` 写成 `projectile` 或 `drop`；这两个语义可放入 `tags`。

## 浏览器截图验收

工程导入后至少保留以下截图或关键帧证据：

| 证据文件建议 | 内容 | 通过线 |
| --- | --- | --- |
| `art-p0-001-01-combat-flight.png` | 少侠、至少 3 个山贼、1 条飞行中的游龙剑气、HUD 同屏 | 3 秒内能指出少侠、山贼和剑气飞行方向 |
| `art-p0-001-02-hit-kill-drop.png` | 游龙命中、山贼击杀、内力掉落同屏 | 命中和击杀反馈在 0.2s 内可读，内力不被击杀 VFX 遮挡 |
| `art-p0-001-03-inner-magnet.png` | 多个内力光点吸附到少侠 | 轨迹指向少侠，不能像敌方弹道或危险范围 |
| `art-p0-001-04-insight-desktop.png` | 桌面领悟页三张卡 | 卡牌底板不挤压文本区，三张图标含义可区分 |
| `art-p0-001-05-insight-mobile.png` | 移动端领悟页三张卡 | 点击区域不小于 72px 高，图标和文字不重叠 |
| `art-p0-001-06-scale-grid.png` | 核心资产 32/64px 缩放网格 | 掉落 32px 可分，角色/图标 64px 可读 |

浏览器验收失败时，不把问题记为“后续精修”；若影响对象识别、命中/击杀反馈或领悟选择可读性，应回到候选图或切图阶段修正。

## 工程交接清单

交给工程接入前，美术侧应提供：

- 通过审图的候选源图和最终透明 PNG。
- 每个 spritesheet 的帧尺寸、帧数、fps、帧序、锚点说明。
- 每个资产的最终文件名与建议目标路径。
- 审图评分表，含未通过候选的淘汰原因。
- 32px/64px 缩放检查图。
- 透明 PNG 边缘检查结果：无白边、黑边、假底板、残留 chroma-key。
- manifest 建议字段：`id/type/path/width/height/frames/frameRate/usage/fallback/required/tags`。
- 浏览器导入后需要补拍的截图列表和命名。

本批完成的判断不是“图生成了”，而是：至少一组候选通过审图，完成透明切图，工程能按稳定 id 导入，并用浏览器截图证明当前战斗和领悟页可读。
