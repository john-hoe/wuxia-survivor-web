# 33 UI Icon Art Gap Audit And SW-ART-015/016/017 Brief

## 目的

本文把 `SW-ART-010`、`SW-ART-014` 接入后仍暴露的 UI/图标缺口拆成 `SW-ART-015`、`SW-ART-016`、`SW-ART-017`，供美术 session 继续生产。

第一性原则：

- UI 图标不是装饰，而是玩家在 0.5 到 3 秒内理解选择、奖励、状态的识别工具。
- 如果一个图标必须靠文件名或上下文才能解释，它不能算强 pass。
- 不需要重做整套页面底板；优先补“语义不清、复用过度、工程拼装明显”的小图标和 HUD 组件。
- 当前工程可继续用临时复用资产试玩，但 `SW-ART-015/016/017` 的目标是逐层减少误读、重复感和工程拼装感。

## Audit 结论

不是只有 `剑谱残页`、`暗器囊`、`内劲心法` 这几个还需要美术。按现有代码和资产看，缺口主要分为四类：

1. `领悟` 页图标：进阶信物、招式基础/进阶、被动强化之间仍有复用和语义混淆。
2. 战斗 HUD 小组件：血量/内力/时间/击杀/招式槽仍大量由工程矩形拼装，和正式 UI 面板不是同一套设计语言。
3. 翻阅秘籍结果和奖励图标：已有正式图，但部分奖励类型、补偿、稀有度在 48px/64px 下仍需要盲审复核。
4. 设置/状态控件：现在主要是文字按钮，没有专门的 toggle、slider、disabled、cooldown 等 UI 小组件。

## 任务拆分

| 任务 | 优先级 | 范围 | 完成口径 |
| --- | --- | --- | --- |
| `SW-ART-015` | P0 | 用户试玩已暴露误读，或当前工程明显复用/拼装的核心 UI 图标和 HUD 组件 | 完成后当前 playable 不再有明显图标重复和 HUD 拼装违和 |
| `SW-ART-016` | P1 | 不阻塞 playable，但会明显提升一致性、减少后续返工的图标和控件 | 完成后领悟、翻阅秘籍、设置页的语义一致性更稳 |
| `SW-ART-017` | P2 | polish 和后续扩展组件 | 完成后页面细节更完整，但不作为当前 playable 阻塞项 |

状态口径：

- 美术侧完成候选、盲审、透明边缘检查和 manifest 建议后，只能标 `美术Agent done / Codex工程 pending`。
- 每个任务独立记录状态；`SW-ART-015` 完成不代表 `SW-ART-016/017` 完成。
- 对应任务的工程导入、桌面/移动横屏截图、review、triage、修复、再验收后，该任务才可标 `done / yes`。

`2026-05-07` 状态更新：

- `SW-ART-015` 已完成美术侧 handoff、工程导入、桌面/移动横屏截图、Codex 自审、DeepSeek/Kimi review、triage、修复和再验收，可标记 `done / yes`。
- `SW-ART-016` 已完成美术侧 handoff、工程导入、桌面/移动横屏截图、Codex 自审、DeepSeek/Kimi review、triage、修复、follow-up review 和再验收，可标记 `done / yes`。
- `SW-ART-017` 仍保持独立 `pending`；它覆盖 P2 的 polish 组件，不包含在 `SW-ART-015/016` 的完成口径内。
- `SW-ART-015` 工程证据位于 `evidence/2026-05-07-sw-art-015-import/`。
- `SW-ART-016` 工程证据位于 `evidence/2026-05-07-sw-art-016-import/`。

非目标：

- 不重做 `ui_panel_menu`、`ui_panel_pause`、`ui_panel_result`、`ui_panel_death` 整张大底板，除非用户后续明确要求。
- 不加入商城、充值、限时池、广告、红点催促等商业化 UI。
- 不把中文文字烘焙进图标。

## SW-ART-015 P0 必做资产

这些是用户已经在试玩中暴露误读，或工程仍明显复用/拼装的部分。

| asset id 建议 | 尺寸 | 用途 | 当前问题 | 美术目标 | 验收 |
| --- | ---: | --- | --- | --- | --- |
| `ui_icon_advance_sword_manual_page` | 64x64 | `领悟` 页 `剑谱残页` 进阶信物 | 当前复用 `scripture_reward_common_fragment`，容易和普通残页/掌风类光团混 | 破损纸页 + 剑痕/剑谱线稿，明确是剑谱信物 | 32px/64px 盲看能说出“剑谱/残页”，不误读为掌风或内劲 |
| `ui_icon_advance_hidden_weapon_pouch` | 64x64 | `领悟` 页 `暗器囊` 进阶信物 | 当前临时复用 `meta_icon_magnet_pouch`，比飞镖好但不是专属暗器囊 | 腰囊/布袋 + 小飞针/短镖露出，主体仍是囊袋 | 不能像回风飞镖弹体，也不能像磁石锦囊拾取被动 |
| `ui_icon_advance_inner_force_manual` | 64x64 | `领悟` 页 `内劲心法` 进阶信物 | 当前复用 `scripture_reward_elite_mind_fragment`，和秘籍奖励图标绑定过强 | 古书/卷轴 + 金色内力纹，明确是心法信物 | 和普通残页、内力光点、领悟爆发区分 |
| `ui_icon_skill_yulong` | 64x64 | `游龙剑气` 基础招式图标 | 当前用 placeholder，和正式弹体资产不是同一语义层级 | 单道青白剑气 + 小剑柄/龙形弧线，简洁可读 | 3 秒内能说出“剑气/剑招” |
| `ui_icon_skill_yulong_advanced` | 64x64 | `游龙归海` 进阶图标 | 进阶和基础差异主要靠文本/弹体 | 三道剑气或更宽龙形剑浪，带轻微金边 | 与基础图标相似但明显更强，不能只是放大 |
| `ui_icon_skill_huifeng` | 64x64 | `回风飞镖` 基础招式图标 | 现用 VFX 弹体图作为 UI 图标 | 1 到 2 枚银色飞镖，带短旋转线 | 不像囊袋、不像残页 |
| `ui_icon_skill_huifeng_advanced` | 64x64 | `回风连环` 进阶图标 | 现用 VFX 弹体图，和 `暗器囊` 曾混淆 | 3 到 4 枚飞镖成环，明显是多枚暗器攻击 | 与 `ui_icon_advance_hidden_weapon_pouch` 盲看不混 |
| `ui_icon_skill_zhenshan` | 64x64 | `震山掌` 基础招式图标 | 现用大型 VFX 波图缩小，容易和残页/内劲光团混 | 掌印 + 小冲击波，主体是手掌 | 64px 能看出掌，不只是圆形光团 |
| `ui_icon_skill_zhenshan_advanced` | 64x64 | `裂石掌风` 进阶图标 | 进阶和基础差异靠 VFX 大小 | 掌印 + 裂石纹 + 双层冲击 | 不像秘籍残页、心法或领悟光效 |
| `ui_hud_health_panel` | 280x80 或 9-slice | 左上血量/等级面板 | 当前 `ui_panel_hud` + 工程矩形拼装，和美术槽位不完全匹配 | 专用血条面板，预留 `100/100 等级 18` 文字和血条槽 | 桌面/移动横屏不压框，文本在槽内居中 |
| `ui_hud_run_panel` | 260x80 或 9-slice | 右上时间/击杀面板 | 当前复用 HUD 面板 + 工程矩形，和血量面板风格接近但布局硬拼 | 专用双行信息面板，预留时间/击杀 | `时间 5:55`、`击杀 1117` 不溢出 |
| `ui_hud_inner_power_bar` | 420x44 或 9-slice | 顶部中间内力条 | 当前由工程矩形绘制，风格和左右 HUD 不统一 | 专用内力条底槽 + 填充遮罩友好 | `内力 999/999` 可读，不遮战斗 |
| `ui_hud_skill_slot` | 72x72 | 底部招式槽普通态 | 当前纯工程矩形，只有文字缩写 | 正式招式槽，预留 48px 图标 + Lv 文本 | 4 个槽同屏不跳动，空槽可读 |
| `ui_hud_skill_slot_advanced` | 72x72 | 底部招式槽进阶态 | 当前只加粗描边和 `*` | 进阶态边框/角标 | 玩家不看文字也知道该招已进阶 |

## SW-ART-016 P1 补强资产

这些不会阻止 playable，但会明显提升一致性和减少后续 UI 调整成本。它们不混入 `SW-ART-015`，单独进入 `SW-ART-016`。

| asset id 建议 | 尺寸 | 用途 | 当前问题 | 美术目标 | 验收 |
| --- | ---: | --- | --- | --- | --- |
| `ui_icon_passive_body_training` | 64x64 | `领悟` 页体魄被动 | 当前复用局外成长 `meta_icon_body_training` | 可继续同源，但需要确认 64px 和 32px 可读 | 和局外成长保持一致但不糊 |
| `ui_icon_passive_lightfoot` | 64x64 | `领悟` 页轻功被动 | 当前使用早期 placeholder 或局外成长风格不完全统一 | 脚步/靴影/轻风，明确移动速度 | 不像回风飞镖 |
| `ui_icon_passive_pickup_radius` | 64x64 | `领悟` 页拾取范围被动 | 当前使用早期吸附图标，用户曾多次盲看疑惑 | 蓝色内力珠被吸向囊袋/手心 | 3 秒内能读成“吸附/拾取范围” |
| `ui_icon_scripture_common_fragment` | 64x64 | 翻阅秘籍普通残页奖励 | 当前可用，但与 `剑谱残页` 需要拉开 | 普通残页更朴素，剑谱残页有剑痕 | 两者同屏不混 |
| `ui_icon_scripture_body_fragment` | 64x64 | 体魄碎片奖励 | 已有，但需复核 32px/64px | 碎片 + 体魄符号 | 和体魄训练大图标有父子关系 |
| `ui_icon_scripture_lightfoot_fragment` | 64x64 | 轻功碎片奖励 | 已有，但需复核 32px/64px | 碎片 + 脚步/轻风 | 和轻功步法图标有父子关系 |
| `ui_icon_scripture_elite_mind_fragment` | 64x64 | 心法碎片奖励 | 已有，但和 `内劲心法` 可能太近 | 奖励碎片版比进阶信物更残缺 | 同屏可区分“碎片奖励”和“进阶信物” |
| `ui_icon_scripture_copper_return` | 64x64 | 铜钱返还奖励 | 已有，需确认小尺寸 | 方孔铜钱 + 回流箭头或小铜串 | 不像正式铜钱掉落或充值币 |
| `ui_icon_scripture_compensation_fragment` | 64x64 | 重复补偿残页 | 当前可用，需与普通残页拉开 | 碎片堆/残页堆，表示补偿 | 十连 48px 下可识别 |
| `ui_icon_scripture_compensation_copper` | 64x64 | 重复补偿铜钱 | 当前可用，需与铜钱返还拉开 | 铜钱堆 + 转化标记 | 不像付费货币 |
| `ui_toggle_on` / `ui_toggle_off` | 96x52 | 设置页静音/低 VFX | 当前都是文字按钮 | 武侠风开关组件 | 不用文字也能看开/关 |
| `ui_slider_track` / `ui_slider_knob` | 320x48 / 48x48 | 设置页音量 | 当前是 `主音 -/+` 文字按钮 | 音量滑杆，后续工程可替换 | 移动端可点区域 >=48px |
| `ui_button_disabled` | 320x96 | 铜钱不足、不可购买、不可十连 | 当前按钮 alpha/文字处理为主 | 禁用态按钮图或 tint 友好底图 | 禁用不像可点击，也不像充值入口 |
| `ui_badge_pity` | 64x64 或 160x48 | 20 抽保底提示 | 当前纯文字 | 小印章/卷轴角标，表示保底进度 | 不像限时促销红点 |
| `ui_badge_duplicate` | 64x64 或 160x48 | 重复转化提示 | 当前纯文字 | 小印章/转化角标 | 10 连结果中可读 |

## SW-ART-017 P2 Polish 资产

这些属于 polish，不建议阻塞当前 MVP playable。它们不混入 `SW-ART-015/016`，单独进入 `SW-ART-017`。

| asset id 建议 | 尺寸 | 用途 | 备注 |
| --- | ---: | --- | --- |
| `ui_panel_settings` | 700x500 或 9-slice | 设置页专用底板 | 当前复用 `ui_panel_pause` 可接受 |
| `ui_panel_scripture_result_single` | 640x140 | 单抽结果面板 | 当前工程矩形可用 |
| `ui_panel_scripture_result_ten` | 820x140 | 十连结果面板 | 小屏边缘略紧，后续可优化 |
| `ui_icon_back` | 96x96 | 返回按钮 icon-only 版本 | 当前文字 `返回` 可接受 |
| `ui_icon_restart` | 96x96 | 再来一局/重开按钮图标 | 当前文字按钮可接受 |
| `ui_icon_home` | 96x96 | 回主菜单按钮图标 | 当前文字按钮可接受 |
| `ui_icon_sound` / `ui_icon_mute` | 64x64 | 设置页音频 | 可和 toggle/slider 同批做 |
| `ui_icon_low_vfx` | 64x64 | 设置页低 VFX | 可后置 |
| `ui_frame_rarity_common` / `rare` / `elite` / `epic` | 96x96 | 小奖励图标稀有度边框 | 当前 `ui_card_scripture` 4 frame 可用，若十连继续拥挤再做 |

## 美术 session 执行流程

1. 先做 `SW-ART-015`，通过后再做 `SW-ART-016`，最后做 `SW-ART-017`。
2. 三个任务可以共用风格基线，但 handoff、最终推荐 JSON、manifest 建议和验收截图必须按任务分开。
2. 每个目标资产至少 4 个候选。
3. 候选先做 64px 透明 PNG；HUD 组件可做 9-slice 或固定尺寸 PNG。
4. 审图必须遮住文件名做 3 秒盲审，结论分 `pass / revise / reject`。
5. 合格数量不足时继续重生图，不得用“文件名语义 + 尺寸正确”代替 pass。
6. 每个任务最终 handoff 必须包含：
   - `final-recommendations-sw-art-0xx.json`
   - `manifest-suggestion-sw-art-0xx.json`
   - `cutting-manifest-handoff-sw-art-0xx.md`
   - `browser-acceptance-screenshot-checklist-sw-art-0xx.md`
   - 32px/64px 缩放网格
   - alpha 边缘检查报告

## 盲审验收标准

| 维度 | 门槛 |
| --- | --- |
| 语义识别 | 遮住文件名，3 秒内至少能说出正确大类；P0 关键进阶信物必须 4/5 分以上，P1/P2 不低于 3.5/5 |
| 同屏去重 | 任意 3 张领悟卡同屏时，不能有两张被误认为同一物品或同一技能 |
| 小尺寸 | 32px 能看主轮廓，64px 能看主体细节 |
| 透明边缘 | alpha 不触边，主体边缘无白边/黑边/chroma-key 残留 |
| 文字 | 图内不得含中文、英文、伪字或乱码 |
| 商业化误读 | 不出现充值、商城、礼包、限时、红点催促、抽卡氪金暗示 |
| 风格 | 原创轻武侠、青石/铜边/旧纸体系，不能科幻化或现代广告化 |

## 工程接入预期

Codex 工程导入时预计改动：

- `game/src/assets/ui/` 按任务增加 P0/P1/P2 PNG。
- `game/src/data/artManifest.ts` 登记新 asset id。
- `game/src/utils/artAssets.ts` 增加 imports。
- `InsightScene.getInsightIconAssetId()` 改为使用专属领悟/进阶信物图标。
- `GameScene.drawHud()` / `drawSkillSlots()` 可逐步替换专用 HUD 条和招式槽。
- `ScriptureScene` 可按需要替换更清晰的奖励/补偿图标。

`SW-ART-015` 工程验收截图至少覆盖：

1. `领悟` 页：剑谱残页、暗器囊、内劲心法同屏或分组对照。
2. `领悟` 页：游龙、回风、震山基础/进阶图标对照。
3. 战斗 HUD：血量、内力、时间/击杀、招式槽普通态和进阶态。
4. 移动横屏：上述至少各 1 张。

`SW-ART-016` 工程验收截图至少覆盖：

1. `领悟` 页：体魄、轻功、拾取范围被动图标。
2. `翻阅秘籍`：普通残页、体魄碎片、轻功碎片、心法碎片、铜钱返还、补偿残页、补偿铜钱。
3. 设置页：toggle、slider、disabled button 或等价状态组件。
4. 移动横屏：上述至少各 1 张。

`SW-ART-017` 工程验收截图至少覆盖：

1. 设置页专用底板。
2. 单抽/十连结果面板。
3. 返回、重开、主页、声音、静音、低 VFX 图标。
4. 小奖励稀有度边框。
5. 移动横屏：上述至少各 1 张。
