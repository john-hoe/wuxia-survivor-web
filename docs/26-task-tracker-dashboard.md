# 26 Task Tracker Dashboard

> Historical snapshot: this board records the original MVP workflow through
> 2026-05-09. It is not the current project status or a public evidence index.
> Many referenced local evidence paths are absent from this checkout. Use
> [CURRENT-STATUS.md](CURRENT-STATUS.md) and current executable checks for
> present-tense claims.

## 目的

本文是 `survivor-web` 的 MVP 任务看板，用来记录任务整体状态、分工、分工完成状态、依赖、验收标准和是否已经成功验收。

第一性原则：

- 任务必须能被验收，否则不能算完成。
- 不是“做完就算完”，而是“做完 -> 检查 -> 多模型 review -> 验证 -> 修复 -> 再验收 -> 更新 dashboard”。
- 状态只反映事实，不用乐观描述替代证据。
- 多分工任务必须拆开记录每个分工的完成情况；例如 `美术Agent done / Codex工程 pending` 不能被整体标记为 `done`。
- 文档任务、实现任务、验收任务分开记录，避免“写完代码但没验收”被误判为完成。

## 字段定义

| 字段 | 说明 |
| --- | --- |
| ID | 稳定任务编号，后续提交、证据和讨论都引用它 |
| 状态 | 任务整体状态，使用 `pending`、`in_progress`、`blocked`、`in_review`、`done` |
| 分工 | 谁负责推进；当前使用 `Codex工程`、`美术Agent`、`用户` |
| 分工完成状态 | 每个分工的事实状态，格式为 `角色 状态 / 角色 状态`；状态使用 `pending`、`in_progress`、`blocked`、`in_review`、`done`、`n/a` |
| 任务 | 任务内容，必须是可执行动作 |
| 依赖 | 前置任务 ID；无依赖写 `无` |
| 验收标准 | 通过条件，必须可观察或可运行 |
| 是否成功验收 | `yes`、`no`、`pending` |

## 当前总览

| 指标 | 当前值 |
| --- | ---: |
| 总任务数 | 35 |
| 已完成并验收（原团队记录） | 35 |
| 待用户核对 | 0 |
| Review 中 | 0 |
| 进行中 | 0 |
| 未开始 | 0 |
| 阻塞 | 0 |

## 分工边界

| 角色 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| 用户 | 方向确认、体验偏好、最终取舍 | 具体工程实现、日常表格维护 |
| Codex工程 | Phaser 工程、系统实现、数据结构、集成、验收脚本、性能和存档 | 原始美术资产的审美定稿 |
| 美术Agent | 美术风格细化、资产批次、生成提示词、资产验收建议、P0 视觉产出清单 | Phaser 代码、数值平衡、商业化、存档和构建 |

## 多 Session 写入边界

| 文件/位置 | 默认写入者 | 规则 |
| --- | --- | --- |
| 主工程 worktree `survivor-web/next-step.md` | Codex工程 session | 只记录主工程下一步；美术 session 不主动改 |
| 美术 worktree `survivor-web/next-step.md` | 美术Agent session | 只记录美术生产下一步；工程 session 不主动改 |
| `docs/26-task-tracker-dashboard.md` | 当前推进任务的 session | 只更新事实状态和分工状态；多分工任务必须拆开 `美术Agent done / Codex工程 pending` |
| `current-status.md` | 当前推进任务的 session | 追加或小范围事实更新；不要覆盖另一个 session 刚写入的状态 |
| evidence/handoff 文件 | 产出该证据的 session | 作为跨 session 交接主载体，工程导入以 handoff/manifest 为准 |

跨 session 交接优先级：用户明确消息 > evidence/handoff 文件 > dashboard 分工状态 > `current-status.md` 摘要 > 各自 worktree 的 `next-step.md`。

## MVP 任务看板

| ID | 状态 | 分工 | 分工完成状态 | 任务 | 依赖 | 验收标准 | 是否成功验收 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SW-DOC-001 | done | Codex工程 | Codex工程 done | 建立 survivor-web 文档基线 | 无 | 00 到 25 号核心文档存在，覆盖产品、系统、技术、验收 | yes |
| SW-DOC-002 | done | 用户 | 用户 done | 核对 MVP 规格基线 | SW-DOC-001 | 用户确认页面流、音频、翻阅秘籍、MVP 范围没有关键缺口 | yes |
| SW-ART-001 | done | 美术Agent | 美术Agent done | 产出美术生产计划和提示词模板 | SW-DOC-002 | `docs/27-art-agent-production-plan.md` 存在，覆盖资产批次、提示词、流程和交接物 | yes |
| SW-ART-002 | done | 美术Agent | 美术Agent done | 产出 P0 视觉占位/fallback 规范 | SW-ART-001 | 少侠、敌人、掉落、招式、UI、VFX 都有可读 fallback，3 秒截图能分辨；证据见 `docs/28-p0-fallback-ui-background-spec.md` | yes |
| SW-ART-003 | done | 美术Agent | 美术Agent done | 产出角色、敌人、头目资产方案 | SW-ART-001 | 少侠、3 类普通敌人、1 类精英、黑风寨主有尺寸、帧数、配色和验收图例；证据见 `docs/29-character-drop-vfx-art-spec.md` | yes |
| SW-ART-004 | done | 美术Agent | 美术Agent done | 产出掉落物、招式弹体和图标方案 | SW-ART-001 | 内力、铜钱、回血、三招式、进阶图标在 64x64 下可读；证据见 `docs/29-character-drop-vfx-art-spec.md` | yes |
| SW-ART-005 | done | 美术Agent | 美术Agent done | 产出 VFX 和动画方案 | SW-ART-001 | 命中、击杀、吸附、领悟、进阶、受伤、阵亡、头目预兆、翻阅秘籍都有时长和预算；证据见 `docs/29-character-drop-vfx-art-spec.md` | yes |
| SW-ART-006 | done | 美术Agent | 美术Agent done | 产出 UI 和青石山道背景方案 | SW-ART-001 | 主菜单、HUD、暂停、战后清点、翻阅秘籍、青石山道背景有布局和可读性标准；证据见 `docs/28-p0-fallback-ui-background-spec.md` | yes |
| SW-ART-007 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | P0 第一批生图候选审图、淘汰/重生图、切图和导入准备 | SW-ART-004, SW-ART-005, SW-ART-006 | Round 009 最终推荐 15 项已完成工程导入、manifest 建议落地、浏览器截图、多模型 review/triage/修复/再验收；证据见 `evidence/2026-05-06-sw-art-009-import/` | yes |
| SW-ART-008 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | 角色与普通敌人正式资产接入 | SW-ART-007, SW-CORE-001, SW-COMBAT-001 | 少侠和山贼 spritesheet 已接入 Phaser；manifest 有稳定 id；桌面/移动横屏截图能区分少侠和山贼；证据见 `evidence/2026-05-06-sw-art-009-import/` | yes |
| SW-ART-009 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | 招式、掉落和战斗 VFX 正式资产接入 | SW-ART-007, SW-COMBAT-002, SW-PROG-001 | 游龙剑气、小/中/大内力、命中/击杀/吸附 VFX 已接入；桌面和移动横屏截图覆盖飞行方向、命中、击杀和掉落；证据见 `evidence/2026-05-06-sw-art-009-import/` | yes |
| SW-ART-010 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | HUD、领悟页和基础页面 UI 正式资产接入 | SW-ART-007, SW-CORE-002, SW-PROG-001 | 美术侧 Round 001 全套 `001c` 已接入 HUD、暂停图标、按钮、主菜单、暂停/设置、战后清点、阵亡和翻阅秘籍页面；截图复审后修复标题压框、HUD 拥挤、结算按钮间距、秘籍概率区和竖屏横屏提示；用户已确认本轮修复 UI 没问题；typecheck/build、截图证据和复查完成；证据见 `evidence/2026-05-06-sw-art-010-import/` | yes |
| SW-ART-011 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | 青石山道背景与场景物件正式资产接入 | SW-ART-006, SW-CORE-001 | 美术侧 Round 003 A / Clean Stone / `003a` 已完成工程导入；桌面和移动横屏截图验证移动循环无明显接缝，少侠、敌人、内力和剑气 3 秒内可读；Codex/DeepSeek/Kimi review、Kimi finding 修复和再验收完成；证据见 `evidence/2026-05-06-sw-art-011-import/` | yes |
| SW-ART-012 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | 波次敌人与黑风寨主正式资产接入 | SW-ART-003, SW-WAVE-001, SW-BOSS-001 | 美术侧 Round 004 B-Fix 5 个 `004b1` 文件已完成工程导入：恶犬、持盾山贼、木人机关、黑风寨主 idle、黑风寨主 attack；`004b2/004b3/004b4` 未进入 preload/manifest/动画注册；桌面和移动横屏截图覆盖少侠、山贼、恶犬、持盾山贼、木人机关、黑风寨主 idle/attack、命中/击杀/VFX；Codex/DeepSeek/Kimi review、triage、修复和再验收完成；证据见 `evidence/2026-05-07-sw-art-012-import/` | yes |
| SW-ART-013 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | 剩余 P0 招式、进阶和关键 VFX 正式资产接入 | SW-ART-004, SW-ART-005, SW-SKILL-001, SW-BOSS-001 | 13 个最终 alpha PNG 已导入 `game/src/assets/vfx/` 并接入 manifest/preload/runtime：`游龙归海`、`回风飞镖`、`震山掌`、领悟/进阶/受伤/阵亡/精英/Boss/秘籍 VFX；通过尺寸检查、`typecheck`、`build`、桌面/移动横屏截图、Codex 自审、DeepSeek/Kimi review、debug-key 修复、follow-up review 和再验收；证据见 `evidence/2026-05-07-sw-art-013-import/` | yes |
| SW-ART-014 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | 局外成长和翻阅秘籍正式美术配套 | SW-META-002, SW-ART-010 | 13 个 final alpha PNG 已导入 `game/src/assets/ui/` 并接入 manifest/preload/runtime；局外成长 3 项、翻阅秘籍概率页、单抽、十连、重复补偿、铜钱不足均有桌面和移动横屏截图；页面无商城、充值、付费抽卡或高压促销误读；Codex 自审、DeepSeek/Kimi review、triage、修复和再验收完成；用户后续指出 `翻阅秘籍` / `局外成长` 默认态杂乱、领悟卡溢出、HUD 不搭、`剑谱残页` 图标过像和 `暗器囊` 图标重复感后，工程已完成三轮 UI 修复并通过 typecheck/build、截图、DeepSeek/Kimi review、Kimi finding 修复和 follow-up；证据见 `evidence/2026-05-07-sw-art-014-import/`、`evidence/2026-05-07-ui-layout-fix/`、`evidence/2026-05-07-insight-hud-fix/`、`evidence/2026-05-07-hidden-weapon-pouch-icon-fix/` | yes |
| SW-ART-015 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | P0 UI 图标语义与 HUD 核心组件补强 | SW-ART-010, SW-ART-014, SW-SKILL-001 | 14 个 batch-024 final alpha PNG 已导入 `game/src/assets/ui/sw-art-015/` 并接入 manifest/preload/runtime；领悟页进阶信物、三招式基础/进阶图标、专用血量/时间/内力 HUD 组件和招式槽均有桌面/移动横屏截图；通过 typecheck/build、14 项尺寸检查、console/page error 0、Codex 自审、DeepSeek/Kimi review、triage、修复和再验收；证据见 `evidence/2026-05-07-sw-art-015-import/` | yes |
| SW-ART-016 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done | P1 领悟、翻阅秘籍和设置控件补强 | SW-ART-015 | 17 个 batch-026 final alpha PNG 已导入 `game/src/assets/ui/sw-art-016/` 并接入 manifest/preload/runtime；用户复核指出设置页 5 行控件过长、底板排版不整齐、音效音量滑块跑出、slider 有黑色方块底块；工程已完成 390px 紧凑表单和程序化 slider 修复，并通过桌面/移动横屏截图、typecheck/build、DeepSeek/Kimi review；用户已在 2026-05-08 确认最新截图可接受；证据见 `evidence/2026-05-07-sw-art-016-import/`、`evidence/2026-05-08-sw-art-016-settings-fix/` | yes |
| SW-ART-017 | done | 美术Agent + Codex工程 | 美术Agent done / Codex工程 done / 用户 done | P2 UI polish 组件补齐 | SW-ART-016 | 13 个 SW-ART-017 final alpha PNG 已导入 `game/src/assets/ui/sw-art-017/` 并接入 manifest/preload/runtime；sound/mute 使用 batch-030 replacement，哈希确认不同于 batch-028 旧版；用户复核截图指出设置页横条未与底板导线对齐、翻阅秘籍结果栏位叠旧卡牌/旧特效导致底部混乱；工程已完成视觉修复：横条/标签列对齐、单抽/十连结果改为 compact 稀有度细线框、结果面板支持点击或 `继续` 收起并恢复翻阅按钮；用户后续通过 `F9` Layout Tuner 手动确认单抽和十连结果坐标，工程已固化并通过 typecheck/build、JSON 回读、桌面/移动截图、console/page error 0、DeepSeek/Kimi review 和 triage；证据见 `evidence/2026-05-08-sw-art-017-import/`、`evidence/2026-05-08-sw-art-017-visual-fix/`、`evidence/2026-05-08-layout-tuner/`；用户已在 2026-05-08 确认最新十连截图可接受 | yes |
| SW-ENG-001 | done | Codex工程 | Codex工程 done | 创建 Phaser + TypeScript + Vite 工程骨架 | SW-DOC-002 | `npm run dev` 可启动，`npm run typecheck` 和 `npm run build` 通过；证据见 `evidence/2026-05-05-sw-eng-001/` | yes |
| SW-ENG-002 | done | Codex工程 | Codex工程 done | 建立场景和页面流骨架 | SW-ENG-001 | `MenuScene`、`GameScene`、`PauseScene`、`SettingsScene`、`DeathTransitionScene`、`ResultScene`、`ScriptureScene`、`InsightScene` 可切换；证据见 `evidence/2026-05-06-sw-eng-002/` | yes |
| SW-ENG-003 | done | Codex工程 | Codex工程 done | 建立事件总线、调试面板和配置加载 | SW-ENG-001 | 调试面板显示 fps、scene、screenState、saveStatus、missingRequiredAssets；事件历史和配置加载可被浏览器脚本断言；证据见 `evidence/2026-05-06-sw-eng-003/` | yes |
| SW-UI-001 | done | Codex工程 + 美术Agent | Codex工程 done / 美术Agent done | 实现主菜单 | SW-ENG-002, SW-ART-006, SW-ART-010 | 首屏有 `开始闯荡`、`翻阅秘籍`、`设置`，5 秒内可进 `青石山道`；主菜单正式 UI 已由 `SW-ART-010` 覆盖接入并经用户确认；证据见 `evidence/2026-05-06-sw-art-010-import/01-menu-desktop.png` | yes |
| SW-CORE-001 | done | Codex工程 | Codex工程 done | 实现少侠移动和输入 | SW-ENG-002 | 键盘和移动端摇杆可移动，起步/停止 <=50ms，斜向不更快；证据见 `evidence/2026-05-06-sw-core-001/` | yes |
| SW-CORE-002 | done | Codex工程 | Codex工程 done | 实现 HUD、血量和暂停页工程 fallback | SW-CORE-001, SW-ART-006 | HUD 不遮挡少侠半径 180px；暂停 10 秒战斗状态不变化；证据见 `evidence/2026-05-06-sw-core-002/`。正式 HUD/页面美术导入不包含在本任务 done 口径内 | yes |
| SW-COMBAT-001 | done | Codex工程 | Codex工程 done | 实现敌人生成、追踪、接触伤害工程 fallback | SW-CORE-002, SW-ART-003 | 山贼从屏幕外生成，生成距离少侠 >=220px，接触扣血并触发 0.6 秒无敌；证据见 `evidence/2026-05-06-sw-combat-001/`。正式敌人美术导入不包含在本任务 done 口径内 | yes |
| SW-COMBAT-002 | done | Codex工程 | Codex工程 done | 实现游龙剑气和基础命中/击杀工程 fallback | SW-COMBAT-001, SW-ART-004, SW-ART-005 | 不按攻击键也能击杀敌人，命中和死亡反馈延迟 <=0.2 秒；证据见 `evidence/2026-05-06-sw-combat-002/`。正式招式/VFX 美术导入不包含在本任务 done 口径内 | yes |
| SW-PROG-001 | done | Codex工程 | Codex工程 done | 实现内力掉落、吸附、等级和领悟三选一 | SW-COMBAT-002 | 第一次领悟 15 到 25 秒内出现；领悟时规则层暂停；证据见 `evidence/2026-05-06-sw-prog-001/` | yes |
| SW-SKILL-001 | done | Codex工程 | Codex工程 done | 实现 P0 三招式和至少 1 个进阶工程 fallback | SW-PROG-001 | 游龙剑气、回风飞镖、震山掌可用；游龙剑气可进阶为游龙归海；领悟调息恢复 20 点血量；证据见 `evidence/2026-05-06-sw-skill-001/`。正式招式/VFX 美术导入不包含在本任务 done 口径内 | yes |
| SW-WAVE-001 | done | Codex工程 | Codex工程 done | 实现 0 到 360 秒怪潮时间轴 | SW-COMBAT-002 | 恶犬、持盾山贼、木人机关按时间加入；移动端 aliveCap clamp 生效；证据见 `evidence/2026-05-06-sw-wave-001/` | yes |
| SW-BOSS-001 | done | Codex工程 | Codex工程 done | 实现黑风寨主工程 fallback | SW-WAVE-001, SW-ART-003, SW-ART-005 | 360 秒自然入场、至少 2 种攻击、预警 >=0.5 秒、击败后胜利结算均已通过；证据见 `evidence/2026-05-06-sw-boss-001/`。正式 Boss 美术不包含在本任务 done 口径内 | yes |
| SW-META-001 | done | Codex工程 | Codex工程 done | 实现战后清点、铜钱和本地存档 | SW-BOSS-001, SW-ART-006 | 胜利/失败都进入 `战后清点`；铜钱计算一次；刷新后保留；证据见 `evidence/2026-05-06-sw-meta-001/`。局外成长购买和真实翻阅秘籍不包含在本任务 done 口径内 | yes |
| SW-META-002 | done | Codex工程 + 美术Agent | Codex工程 done / 美术Agent done | 实现局外成长和翻阅秘籍 | SW-META-001, SW-ART-006 | 3 个局外成长可购买；翻阅秘籍概率公开、20 抽保底、重复补偿；已验证铜钱扣除、localStorage 写入、局外成长下局生效、保底触发和重复补偿持久化；证据见 `evidence/2026-05-08-sw-meta-002-verification/` | yes |
| SW-AUDIO-001 | done | Codex工程 | Codex工程 done | 接入基础音频系统和占位音效 | SW-ENG-003 | WebAudio 本地占位音效已接入；26 个 audio event、23 个 required placeholder event，`missingRequiredAudioEvents = 0`；按钮、命中、击杀、拾取、领悟、受伤、阵亡和预警类事件可触发；静音、音量 0、节流、24 voice cap、设置页写档和 console/page error 0 已验证；Codex 自审发现静音拖尾 P1 并已修复，Kimi/DeepSeek 无 P0-P2；证据见 `evidence/2026-05-08-sw-audio-001/` | yes |
| SW-QA-001 | done | Codex工程 + 用户 | Codex工程 done / 用户 done | 完成 MVP 验收证据包 | SW-META-002, SW-AUDIO-001 | 3 分钟脚本、8 分钟脚本、页面流截图、性能记录、无付费入口检查通过；用户已在 2026-05-09 试玩确认 MVP 体感成功；证据见 `evidence/2026-05-09-sw-qa-001/` | yes |

## Post-MVP 总览（2026-05-09 历史计划）

执行路线见 [34 Post-MVP Route](34-post-mvp-route.md)。

| 指标 | 当前值 |
| --- | ---: |
| Post-MVP 总任务数 | 7 |
| 已完成并验收（当时记录） | 1 |
| 进行中 | 0 |
| 未开始 | 6 |
| 阻塞 | 0 |

## Post-MVP 任务看板

| ID | 状态 | 分工 | 分工完成状态 | 任务 | 依赖 | 验收标准 | 是否成功验收 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SW-POST-001 | done | Codex工程 | Codex工程 done | MVP 冻结和基线整理 | SW-QA-001 | 当前可玩 MVP 有可回退基线；typecheck/build/关键 QA 可复跑；调试入口和证据目录边界清楚；dashboard/current-status/next-step 对齐；证据见 `evidence/2026-05-09-sw-post-001/` | yes |
| SW-BAL-001 | pending | Codex工程 | Codex工程 pending | 数值平衡第一轮 | SW-POST-001 | 第一次领悟 15-25 秒；首次明显危险 60-120 秒；普通失败 3-5 分钟；头目 360 秒；胜利 6-8 分钟；至少 2 种稳定构筑 | pending |
| SW-AUDIO-002 | pending | Codex工程 + 用户 | Codex工程 pending / 用户 pending | 正式音频和 BGM 接入 | SW-BAL-001 | 正式 BGM/关键 SFX 接入；静音、音量、节流和 voice cap 仍通过；仓库和前端无 API key；用户确认风格不刺耳、不像商城促销音 | pending |
| SW-MOBILE-001 | pending | Codex工程 | Codex工程 pending | 移动端横屏适配 | SW-AUDIO-002 | 移动端横屏可玩；虚拟摇杆和 HUD 不遮挡核心区域；安全区适配；移动端目标 FPS 45-60；竖屏有旋转提示 | pending |
| SW-CONTENT-001 | pending | Codex工程 + 美术Agent | Codex工程 pending / 美术Agent pending | 青石山道小扩展 | SW-MOBILE-001 | 新增 1 个小敌人/精英或 1 个小机制；不破坏 6-8 分钟节奏；桌面/移动截图和数值复测通过 | pending |
| SW-STAGE-002 | pending | Codex工程 + 美术Agent | Codex工程 pending / 美术Agent pending | 第二关规格和首版实现 | SW-CONTENT-001 | 第二关与青石山道在视觉、波次、头目或机制上有明确差异；能独立进入、完成和结算；不引入付费入口 | pending |
| SW-QA-002 | pending | 用户 + Codex工程 | 用户 pending / Codex工程 pending | 最终朋友试玩反馈收集 | SW-STAGE-002 | 至少 5 次试玩记录；70% 愿意再开一局；70% 理解死因；60% 能说出构筑差异；100% 知道铜钱只能游玩获得 | pending |

## 更新规则

- 每次任务开始时，把状态改为 `in_progress`。
- 多分工任务开始时，只把实际开始的角色写成 `in_progress`，未开始的角色保持 `pending`；例如 `美术Agent in_progress / Codex工程 pending`。
- 并行 session 不互相抢写对方 worktree 的 `next-step.md`；需要跨 session 改写时，先取得用户明确同意。
- 任务实现完成但 review、修复或验收脚本未确认时，状态改为 `in_review`，`是否成功验收` 保持 `pending`。
- 如果一个角色已完成但另一个必要角色未完成，整体状态不能标 `done`，只能保持 `in_progress`、`pending` 或 `in_review`。
- 只有验收标准通过、多模型 review findings 已验证、真实问题已修复并留下证据后，状态才能改为 `done`，`是否成功验收` 才能改为 `yes`。
- 如果发现依赖缺失、规格冲突或实现不可行，状态改为 `blocked`，并在当前状态文档记录原因。
- 不用 `almost done`、`basically done`、`差不多` 这类不可验收状态。

## Done 判定

任务标记 `done / yes` 前必须满足：

| 项 | 要求 |
| --- | --- |
| 实现 | 本任务范围内的文档、代码或资产已经完成 |
| 检查 | 对应的自动检查、手动脚本或表格检查通过 |
| 多模型 review | Codex 自审、DeepSeek v4-pro 和 Kimi 已执行；`claude-ds` 暂时跳过，不作为完成门槛 |
| findings 处理 | 真实问题已修复；误报或证据不足已记录 |
| 再验收 | 修复后重新跑相关检查 |
| 证据 | 截图、日志、metrics、命令输出摘要或 review triage 可复查 |
| dashboard | 本表状态、验收结果和依赖状态已同步 |

## 证据位置

后续证据统一放在：

```text
survivor-web/evidence/
  yyyy-mm-dd-topic/
    report.md
    metrics.json
    events.json
    screenshots/
```

验收脚本和证据格式以 [25 Acceptance Scripts And Evidence](25-acceptance-scripts-and-evidence.md) 为准。
