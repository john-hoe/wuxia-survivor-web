# 27 Art Agent Production Plan

## 目的

本文是 `SW-ART-001` 的产出文档，供 `survivor-web/docs/26-task-tracker-dashboard.md` 后续拆分 `SW-ART-002` 到 `SW-ART-006` 使用。

`SW-ART-002` 和 `SW-ART-006` 的工程可接入规格见 [28 P0 Fallback UI Background Spec](28-p0-fallback-ui-background-spec.md)。

`SW-ART-003`、`SW-ART-004`、`SW-ART-005` 的制作级规格见 [29 Character Drop VFX Art Spec](29-character-drop-vfx-art-spec.md)。

第一性原则：

- 美术优先解决识别和反馈，不先追求精修。
- 每个资产必须能落到 Phaser 可加载的 PNG、spritesheet、atlas、manifest 或 fallback。
- 主观风格必须转成可验收标准：尺寸、帧数、透明背景、3 秒截图识别、64x64 图标识别、VFX 数量预算。
- 不使用《Survivor.io》或其他商业游戏的原始素材、截图裁切、图标描摹、角色复刻、特效复刻。

## 美术 Agent 职责边界

### 负责

| 范围 | 具体产出 | 交付判断 |
| --- | --- | --- |
| 资产概念 | 少侠、敌人、头目、掉落、招式、VFX、UI、青石山道背景的外观方案 | 能对应到 P0 asset id、尺寸和用途 |
| 风格提示词 | AI 生成提示词、禁用词、批次生成说明 | 生成图不偏科幻、仙侠、抽卡手游或现代 UI |
| 资产制作顺序 | 先做可读 fallback，再做角色/敌人，再做掉落/招式/VFX/UI/背景 | 工程可按批次接入，不等最终全量精修 |
| 验收建议 | 3 秒截图识别、64x64 缩小、透明背景、VFX 预算、移动端 UI 可读 | 验收标准可被截图、manifest 和调试面板验证 |
| 工程交接 | 文件命名、尺寸、spritesheet 帧序、manifest 字段、fallback 规则 | Codex 工程能直接登记到 `src/data/artManifest.ts` |

### 不负责

| 不负责项 | 边界 |
| --- | --- |
| Phaser 工程实现 | 不创建 scene、component、physics、collision、object pool、build 脚本 |
| 数值平衡 | 不决定伤害、冷却、怪潮数量、铜钱收益、保底概率 |
| 商业化 | 不设计充值、广告、付费礼包、限时池、付费皮肤售卖 |
| 存档和数据迁移 | 只给图标/页面视觉建议，不写 localStorage schema |
| 规则裁判 | 不用视觉表现替代命中、掉落、结算和胜负判定 |

## P0 美术产出清单

### 批次原则

| 批次 | 目标 | 通过后解锁 |
| --- | --- | --- |
| B0 fallback 和风格小样 | 没有正式图也能看懂少侠、敌人、掉落、危险、UI | 工程骨架和调试面板 |
| B1 角色和敌人 | 单屏 80 到 120 敌人时，少侠和敌人仍能分层 | 基础战斗、怪潮、受伤死亡 |
| B2 掉落和招式 | 命中、击杀、内力、领悟、三招式能形成爽感 | 内力系统、招式系统 |
| B3 头目和危险预兆 | 黑风寨主攻击前 0.5 秒以上可读 | 头目战 |
| B4 UI 和页面 | 主菜单、HUD、暂停、领悟、战后清点、翻阅秘籍可接入 | 页面流和局外系统 |
| B5 青石山道背景 | 背景有武侠山道识别，但不抢玩法对象 | 完整 3 分钟和 8 分钟验收脚本 |

### 资产列表

| 批次 | 资产 | 用途 | 建议形式 | 验收标准 | 依赖 |
| --- | --- | --- | --- | --- | --- |
| B0 | `fallback_hero_shaoxia` | 少侠缺图时的占位 | 128x128 透明 PNG，青白菱形 + 朝向箭头 | 3 秒截图能在 80 个敌人中指出少侠 | 无 |
| B0 | `fallback_enemy_basic/fast/tank/elite` | 敌人缺图占位 | 80-160px 透明 PNG，暖色、暗红、盾形、木色剪影 | 四类轮廓和颜色互不混淆 | 无 |
| B0 | `fallback_drop_inner/copper/heal` | 掉落缺图占位 | 32-52px 透明 PNG | 内力蓝青、铜钱金黄、回血绿色/白红，3 秒可分辨 | 无 |
| B0 | `fallback_danger_warning` | 危险范围缺图占位 | 半透明红橙长条/圆环 PNG | 透明度 35%-55%，不遮挡少侠轮廓 | 无 |
| B0 | `art_style_sheet_p0` | 风格统一基准 | 2400x1080 mockup，含少侠、山贼、内力、剑气、HUD、青石路 | 不含英文/伪字；3 秒看出轻武侠山道 survivor-like | SW-DOC-002 |
| B1 | `hero_shaoxia_idle` | 少侠待机 | 128x128 spritesheet，4 帧，透明背景，8fps | 轮廓含斗笠/短披风/剑鞘或腰带之一；不靠文字识别 | B0 |
| B1 | `hero_shaoxia_move` | 少侠移动 | 128x128 spritesheet，6 帧，透明背景，8-12fps | 移动方向或身体摆动明显；斜向移动不需要额外帧 | B0 |
| B1 | `hero_shaoxia_hurt` | 受伤反馈 | 128x128 spritesheet，2 帧，白/红闪 | 0.12-0.25 秒内可见，不改变碰撞尺寸 | B1 少侠 |
| B1 | `enemy_bandit_grunt_walk` | 山贼喽啰 | 96x96 spritesheet，4 帧，暖棕/暗红布衣，木棍或短刀剪影 | 和少侠颜色分离；远看不是铜钱/内力 | B0 |
| B1 | `enemy_hound_run` | 恶犬 | 80x80 spritesheet，4 帧，低矮暗红/褐色剪影 | 体型低于山贼，速度感通过前倾或拖影体现 | B0 |
| B1 | `enemy_shield_bandit_walk` | 持盾山贼 | 112x112 spritesheet，4 帧，大盾轮廓占主体 35%-50% | 3 秒截图能看出厚血/盾牌定位 | B0 |
| B1 | `enemy_wooden_dummy_elite_walk` | 木人机关精英 | 160x160 spritesheet，4 帧，木质机关、关节、黄褐轮廓 | 体型为普通山贼 1.4-1.8 倍，有精英边框或符号 | B0 |
| B2 | `drop_inner_small/medium/large` | 内力光点 | 32/40/52px 透明 PNG 或 4 帧闪烁 | 三档大小或亮度递进；不接近铜钱金黄 | B1 |
| B2 | `drop_copper` | 战后/翻阅补偿铜钱图标 | 32x32 透明 PNG，圆孔铜钱 | 不接近危险红橙；64x64 和 32x32 都可识别 | B4 战后清点 |
| B2 | `drop_heal_pill` | 回血药丸 | 36x36 透明 PNG，绿白/白红药丸 | 不能被误认为铜钱或内力 | B1 |
| B2 | `skill_yulong_projectile` | 游龙剑气弹体 | 96x32 透明 PNG 或 4 帧 spritesheet，青白剑弧 | 飞行方向清楚；同屏 80 条不遮少侠 | B1 |
| B2 | `skill_huifeng_dart` | 回风飞镖 | 40x40 透明 PNG，银色暗器 | 旋转时不变成灰色圆点 | B1 |
| B2 | `skill_zhenshan_wave` | 震山掌冲击波 | 256x256 半透明圆环 spritesheet，4-6 帧 | 半透明淡绿/土黄色冲击，不覆盖头目红橙预兆 | B1 |
| B2 | P0 招式图标 6 个 | 招式槽和领悟卡 | 64x64 PNG，游龙、游龙进阶、飞镖、飞镖进阶、掌、掌进阶 | 64x64 下主体可读；进阶边框和普通边框不同 | B2 招式 |
| B2 | 领悟卡图标 8 个 | 领悟三选一 | 64x64 PNG，招式强化、冷却、数量、范围、穿透、击退、剑谱残页、暗器囊/内劲心法 | 不用长文字解释类型；图形和短标题可对应 | B4 UI |
| B3 | `boss_heifeng_idle` | 黑风寨主待机 | 192x192 spritesheet，4 帧，深红/黑衣寨主，大刀剪影 | 体型和威胁明显高于精英；不与普通山贼混淆 | B1 |
| B3 | `boss_heifeng_attack` | 黑风寨主攻击 | 192x192 spritesheet，6 帧，挥刀/蓄力动作 | 攻击帧不改变碰撞半径表现超过 20% | B3 boss idle |
| B3 | `vfx_boss_charge_warning` | 冲撞斩预兆 | 78x460 或可拉伸长条，红橙半透明 | 预兆宽度和方向明确；持续 0.75 秒；透明度 35%-55% | B3 boss |
| B3 | `vfx_boss_whirlwind_warning` | 旋风刀预兆 | 620x620 环形范围 spritesheet，4-6 帧 | 预兆至少 0.5 秒早于伤害；中心少侠仍可见 | B3 boss |
| B3 | `vfx_elite_warning` | 木人机关生成预警 | 128x128 边缘符号，黄橙/木纹 | 1.2 秒内可见；同屏最多 2 个不遮 HUD | B1 elite |
| B3 | `vfx_hit_light` | 普通命中 | 64x64 spritesheet，3-4 帧，0.12s | 命中后 0.2 秒内可见；同屏上限 40 | B2 |
| B3 | `vfx_enemy_die` | 敌人死亡 | 96x96 spritesheet，4-6 帧，0.25s | 死亡反馈可见但不挡内力掉落 | B1 |
| B3 | `vfx_inner_magnet_trail` | 内力吸附尾迹 | 32x96 或程序尾迹贴图 | 吸附路径可读；同屏上限 80 | B2 drops |
| B3 | `vfx_insight_burst` | 领悟触发 | 512x512 光圈 spritesheet，0.6s | 屏幕轻暂停时可见，不误认为头目危险 | B4 领悟页 |
| B3 | `vfx_skill_advance` | 招式进阶 | 640x640 爆发光圈，0.9s | 比普通领悟强，但不遮危险范围超过 0.5 秒 | B2/B4 |
| B3 | `vfx_hero_hurt_flash` | 少侠受伤 | 屏幕边缘红闪 + 少侠闪白 | 明确血量受损和 0.6 秒无敌窗口 | B1 少侠 |
| B3 | `vfx_death_vignette` | 力竭倒地过渡 | 1920x1080 或可缩放墨色边框 | 降饱和 40%-60%，最长 1.5 秒 | B4 页面 |
| B3 | `vfx_scripture_reveal` | 翻阅秘籍揭示 | 512x512 或卡片上方特效，0.8s | 稀有及以上更强，普通不拖慢 | B4 翻阅秘籍 |
| B4 | `ui_panel_hud` | 战斗 HUD 底板 | 512x128 9-slice PNG | 不遮挡少侠半径 180px；数字变长不跳动 | B0 style |
| B4 | `ui_panel_menu` | 主菜单 | 960x640 9-slice/背景组合 | 首屏有 `开始闯荡`、`翻阅秘籍`、`设置` 的布局空间 | B5 背景 |
| B4 | `ui_panel_pause` | 暂停页 | 640x720 9-slice PNG | 移动端按钮 >=240x72，按钮间距 >=12px | B4 button |
| B4 | `ui_card_insight` | 领悟卡 | 320x460 9-slice/card PNG | 3 张卡移动端点击区 >=220x140，标题/说明空间明确 | B2 icons |
| B4 | `ui_panel_result` | 战后清点 | 720x760 9-slice PNG | `胜利/失败`、时间、击杀、等级、铜钱、3 个按钮不拥挤 | B2 copper |
| B4 | `ui_panel_death` | 阵亡过渡文案层 | 720x360 PNG/9-slice | 只放 `力竭倒地` 和死因，不显示重开按钮 | B3 death |
| B4 | `ui_card_scripture` | 翻阅秘籍结果卡 | 320x460 card，common/rare/elite/epic 4 套边框 | 稀有度靠边框 + 颜色 + 图标三重区分 | B2 icons |
| B4 | `ui_panel_scripture_probability` | 概率说明 | 720x280 9-slice PNG | 概率表默认可见，不做小问号隐藏 | B4 scripture |
| B4 | `ui_button_primary` | 主按钮 | 320x96 9-slice PNG | 移动端按钮高度不小于 72px；按下态/禁用态可区分 | B4 |
| B4 | `ui_icon_pause` | 暂停按钮 | 96x96 PNG | 触控区可扩展到 >=72x72，图标不用文字也能识别 | B4 |
| B5 | `ground_qingshi_base` | 青石山道地表 | 1024x1024 低噪声 tile | 不含高亮青蓝/红橙；不被误认为掉落或危险 | B0 style |
| B5 | `road_ribbon_a/b` | 山道走向变化 | 1024x512 透明或边缘过渡 PNG | 连续移动 3 分钟无黑边、硬边和高噪声重复感 | B5 base |
| B5 | `bamboo_edge_cluster` | 竹林边缘氛围 | 512x512 透明 PNG，可旋转/镜像 | 每屏 4-8 组，不遮少侠/敌人 | B5 base |
| B5 | `rock_cluster` | 碎石点缀 | 256x256 透明 PNG | 每屏 3-6 组，不像内力/铜钱 | B5 base |
| B5 | `wood_stake_flag` | 山寨方向提示 | 256x256 透明 PNG | 每屏 1-3 个，暗示山寨，不做碰撞承诺 | B5 base |
| B5 | `distant_gate_shadow` | 远处山寨门楼 | 1024x512 透明/半透明 PNG | 300 秒后可见度提高；不遮头目预兆 | B5 base |

## AI 生成或手工资产流程

| 步骤 | 输入 | 输出 | 通过标准 | 失败处理 |
| --- | --- | --- | --- | --- |
| 1. 草图 | 文档规格、尺寸、用途、对比对象 | 低保真草图或灰阶剪影 | 黑白剪影能分出少侠、敌人、掉落、危险 | 剪影不可分，先改轮廓，不上色 |
| 2. 生成/绘制 | 草图、正向提示词、禁用方向、尺寸 | 候选 PNG 或源文件 | 不含商业游戏素材、英文、伪字、乱码、水印 | 触发禁用项直接重做 |
| 3. 筛选 | 候选图、3 秒截图测试、64x64 缩小测试 | 可用候选列表 | 核心资产 3/5 人或自测 3 秒可识别；图标 64x64 可识别主体 | 标记为 reference，不进入 production |
| 4. 切图 | 候选图、帧表 | 透明 PNG、spritesheet、9-slice | 背景透明、无白边、无假阴影底板、帧中心稳定 | 重新抠图或重排帧 |
| 5. 命名 | 资产类别和用途 | `category_object_action_variant.ext` | 小写英文、下划线、与 manifest id 一致 | 不合规文件不进入工程 |
| 6. manifest | 文件、尺寸、帧数、用途、fallback | `src/data/artManifest.ts` 条目建议 | `id/type/path/width/height/frames/usage/fallback/required` 完整 | 缺字段不交接工程 |
| 7. 压缩 | PNG、spritesheet、UI 图 | 压缩后 PNG/WebP 候选 | 单张 spritesheet <=2048x2048；首包美术建议 <=10MB | 拆 sheet、降帧、降粒子 |
| 8. 验收 | 游戏截图、调试面板、manifest | 验收截图和问题清单 | 缺失必需资产数 0；3 秒截图可识别；移动端 UI 不溢出 | 回到对应步骤修正 |

素材来源规则：

- 可以使用 AI 生成、手工绘制、程序化形状和自制纹理。
- 可以参考“轻武侠、山道、山寨、竹林、青石、剑气、掌风、暗器”的通用文化元素。
- 不可以使用商业游戏原图、截图裁切、图标描摹、角色复刻、技能特效复刻。
- 不可以把含版权 logo、水印、假文字、英文 UI 的 AI 图直接作为生产资产。
- 不确定来源是否合法时，资产标记为 `reference_only`，不进入 `artManifest.ts`。

## 武侠风格提示词模板

通用正向约束：

```text
原创轻武侠 survivor-like Web 游戏资产，俯视或 3/4 俯视 2D，清晰剪影，手机屏幕可读，透明背景 PNG，无文字，无水印，无 logo，左上方柔和光源，低细节高辨识度，适合 Phaser spritesheet，对象居中，保留 8px 透明边距。
```

通用禁用方向：

```text
不要商业游戏原始素材，不要仿《Survivor.io》图标或角色，不要真实武侠 IP，不要修仙飞升，不要仙侠满屏法阵，不要赛博霓虹，不要现代枪械，不要欧美重甲，不要复杂写实厚涂，不要伪中文/英文/乱码，不要带背景板，不要水印，不要 logo。
```

### 少侠

正向：

```text
少侠主角，青绿和白色高亮，短披风或布衣下摆，腰间剑鞘，轻装备，俯视 3/4 视角，128x128，每帧人物实际高度 78-92px，动作幅度清楚，移动帧身体轻微前倾，轮廓在暖色山贼群中突出，透明背景。
```

禁用：

```text
不要长篇飘带遮挡碰撞，不要全身白到和剑气混在一起，不要现代运动服，不要重甲骑士，不要修仙光环，不要复杂脸部细节。
```

### 山贼喽啰

正向：

```text
普通山贼喽啰，暖棕布衣，短刀或木棍剪影，96x96，4 帧走路，体型中等，表情不重要，移动时肩膀左右摆动，颜色和少侠青白明显分离，透明背景。
```

禁用：

```text
不要像主角一样青白发光，不要现代帮派，不要过度血腥，不要复杂盔甲，不要大盾，不要拿枪。
```

### 恶犬

正向：

```text
山道恶犬，低矮快速剪影，暗红褐色，80x80，4 帧奔跑，身体前倾，腿部动势清楚，远看能和山贼区分，透明背景。
```

禁用：

```text
不要可爱宠物风，不要过大到像精英，不要蓝青发光，不要写实恐怖血腥，不要带地面阴影大板。
```

### 持盾山贼

正向：

```text
持盾山贼，112x112，厚重慢速敌人，大木盾或旧铁盾占主体 35%-50%，暖暗色布衣，盾牌轮廓一眼可见，4 帧走路，透明背景。
```

禁用：

```text
不要西式骑士塔盾，不要科幻盾牌，不要盾牌发蓝光，不要和木人机关同色同形。
```

### 木人机关

正向：

```text
木人机关精英，160x160，木质人形机关，竹木关节，符纸或小铜钉点缀，体型比山贼大 1.5 倍，4 帧沉重移动，有精英外圈或脚下短暂符号但不大面积发光，透明背景。
```

禁用：

```text
不要现代机器人，不要金属机甲，不要赛博蓝光，不要大型 boss 压迫感，不要细节密到 160px 看不清。
```

### 黑风寨主

正向：

```text
黑风寨主，首关头目，192x192，深红黑衣，宽肩，大刀剪影，山寨首领气质，待机 4 帧，攻击 6 帧，体型明显大于木人机关，红橙危险预兆与角色本体分离，透明背景。
```

禁用：

```text
不要真实武侠 IP 人物，不要魔王角和西幻恶魔，不要修仙仙尊，不要满屏黑烟遮挡预兆，不要突然秒杀式恐怖表现。
```

### 青石山道

正向：

```text
青石山道背景资产，低噪声俯视 2D，青石路、土路、竹林边缘、碎石、破旗、远处山寨门楼，颜色压低饱和度，背景不使用高亮青蓝和高饱和红橙，适合循环拼接，1024x1024 或 1024x512，无文字。
```

禁用：

```text
不要复杂山水画导致角色看不清，不要高对比花纹铺满地面，不要可见硬墙，不要现代城市，不要仙境云海，不要把背景画成可交互物。
```

### 招式

正向：

```text
轻武侠招式资产，青白游龙剑气 96x32，银色回风飞镖 40x40，淡绿震山掌冲击波 256x256，形状简洁，方向明确，半透明边缘，适合对象池复用，同屏大量出现仍不遮挡少侠。
```

禁用：

```text
不要巨大法阵，不要全屏爆炸，不要紫蓝霓虹，不要和敌方红橙危险范围混淆，不要用文字写招式名。
```

### UI

正向：

```text
轻武侠 Web 游戏 UI 组件，木、青石、旧布、铜边，适合手机触控，9-slice 面板，按钮厚实，主按钮 320x96，卡片 320x460，HUD 底板 512x128，留出中文排版空间，无烘焙文字，透明或可切片背景。
```

禁用：

```text
不要现代聊天软件，不要科幻驾驶舱，不要抽卡手游强商业按钮，不要充值感红点，不要英文/伪中文/乱码，不要把整张 HUD 当最终切图。
```

### 翻阅秘籍

正向：

```text
翻阅秘籍页面和结果卡，武侠秘籍残页、竹简、旧书页、铜边卡框，common/rare/elite/epic 四种稀有度边框清楚，概率说明区域默认可见，结果卡 320x460，图标 64x64 可读，无文字烘焙。
```

禁用：

```text
不要写“抽卡/Gacha/充值/礼包”，不要限时池倒计时，不要付费诱导按钮，不要现代卡牌手游大光污染，不要商业游戏卡面风格复刻。
```

## 和工程 Codex 的交接物

### 文件命名

统一格式：

```text
category_object_action_variant.ext
```

示例：

```text
hero_shaoxia_move.png
enemy_bandit_grunt_walk.png
boss_heifeng_attack.png
skill_yulong_projectile.png
vfx_boss_charge_warning.png
ui_card_scripture_epic.png
bg_ground_qingshi_base.png
```

命名规则：

- 只用小写英文、数字和下划线。
- 玩家可见中文只在工程 UI 文本里排版，不烘进图片。
- 文件名和 manifest `id` 保持一致，扩展名不写进 `id`。
- 临时参考图加 `_ref`，不能登记为 required 生产资产。

### 尺寸和透明背景

| 类型 | 尺寸规则 | 背景规则 |
| --- | --- | --- |
| 角色帧 | 少侠 128x128，敌人 80-160，头目 192x192 | 透明 PNG，保留 8px 透明边距 |
| 掉落 | 32-52px | 透明 PNG，无外扩假底板 |
| 招式弹体 | 40x40 到 384x384 | 透明 PNG，半透明边缘可接受 |
| VFX | 单帧 64-640px，按用途控制 | 透明 PNG，不能整张黑底 |
| UI | 9-slice 或独立图标 | 无文字，保留中文排版空间 |
| 背景 | 1024x1024、1024x512、512x512、256x256 | 地表可不透明，装饰物透明 |

### Spritesheet

交接时必须附帧序说明：

```text
id: hero_shaoxia_move
file: hero_shaoxia_move.png
frameWidth: 128
frameHeight: 128
frames: 6
frameRate: 10
order: left-to-right
anchor: center
loop: true
```

规则：

- spritesheet 单张不超过 2048x2048。
- 每帧对象中心稳定，脚底或视觉中心跳动不超过 4px。
- 不把多个不同对象混在一个无说明的大图里。
- 头目攻击、受伤、死亡可以拆 sheet，避免单图过大。

### Manifest 建议

工程侧登记到 `src/data/artManifest.ts`，美术交接表必须给出这些字段：

```ts
{
  id: "hero_shaoxia_move",
  type: "spritesheet",
  path: "assets/sprites/hero/hero_shaoxia_move.png",
  width: 128,
  height: 128,
  frames: 6,
  frameRate: 10,
  usage: "少侠移动",
  fallback: "shape",
  required: true
}
```

fallback 规则：

| fallback | 用途 | 验收边界 |
| --- | --- | --- |
| `shape` | 用程序图形代替缺失资产 | 开发可用，最终 P0 验收前必需资产缺失数必须为 0 |
| `tint` | 对现有图加色区分变体 | 只能用于同类低风险变体，不用于头目/危险预兆 |
| `hidden` | 缺失时隐藏纯装饰 | 只允许背景小装饰，不允许玩法对象 |

### 验收截图

每个批次交接至少要给工程侧一组截图或 mock：

| 截图 | 必须包含 | 用途 |
| --- | --- | --- |
| `art-01-style-sheet.png` | 少侠、3 类敌人、内力、铜钱、剑气、危险预兆 | 统一风格和颜色 |
| `art-02-64px-icons.png` | 招式图标、领悟图标、秘籍稀有度 | 检查 64x64 可读性 |
| `art-03-combat-density.png` | 少侠 + 80 敌人 + 内力 + 3 类 VFX | 检查战斗可读性 |
| `art-04-boss-warning.png` | 黑风寨主、冲撞斩、旋风刀预兆 | 检查头目公平性 |
| `art-05-mobile-ui.png` | 主菜单/HUD/领悟/战后清点/翻阅秘籍核心布局 | 检查移动端文字和按钮空间 |
| `art-06-qingshi-road.png` | 青石路、竹林、碎石、远处寨门 | 检查背景不抢玩法对象 |

验收通过线：

- 3 秒内能指出少侠、最近敌人、内力光点、铜钱、危险范围。
- 64x64 图标能识别主体，不依赖细小文字。
- UI 主要按钮移动端点击区 >=120x64；主按钮高度 >=72px。
- HUD 不遮挡少侠半径 180px。
- 常驻活跃 VFX <=80，爆发峰值 <=160 且持续不超过 1 秒。
- 调试面板 `missingRequiredAssets = 0` 后，P0 资产才可标记完成。

## 后续拆分建议

| Dashboard 任务 | 本文对应范围 | 建议产出 |
| --- | --- | --- |
| SW-ART-002 | B0 fallback 和风格小样 | fallback 图形清单、颜色表、3 秒识别截图 |
| SW-ART-003 | B1 + B3 角色/敌人/头目 | 角色和敌人 spritesheet 规格、头目预兆图例；制作级规格见 [29](29-character-drop-vfx-art-spec.md) |
| SW-ART-004 | B2 掉落/招式/图标 | 64x64 图标表、招式弹体、掉落图；制作级规格见 [29](29-character-drop-vfx-art-spec.md) |
| SW-ART-005 | B3 VFX 和动画 | VFX 时长、上限、对象池建议、低 VFX 模式建议；制作级规格见 [29](29-character-drop-vfx-art-spec.md) |
| SW-ART-006 | B4 + B5 UI 和背景 | UI 9-slice 规格、页面 mock、青石山道背景资产 |

完成 `SW-ART-001` 的最低验收：本文存在，并覆盖美术职责边界、P0 资产批次、AI/手工流程、武侠提示词模板、工程交接物。
