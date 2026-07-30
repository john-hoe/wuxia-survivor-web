# 36 · 视觉 / 交互 / 动效 / 特效 全面优化方案

> 调研日期：2026-07-26。基于对 `game/src` 全部场景/系统代码、美术资产实图、`docs/00–35` 设计文档、同类头部作品（Vampire Survivors / Halls of Torment / Brotato / 弹壳特攻队）基准的十路并行调研。
> 结论一句话：**游戏逻辑与资产管线已完成，但"工程表现层"几乎为零**——全工程 0 处粒子、0 处相机特效、0 处伤害飘字、场景间硬切、Tween 全工程仅 6 处。幸存者类游戏的爽感公式（命中→飘字→掉落→磁吸→升级金光）每一环都缺反馈。

---

## 1. 核心问题诊断（按收益排序）

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| 1 | 零打击感：无相机 shake/flash、无 hit stop、无伤害数字、敌人受击只有 110ms alpha 微闪 | `GameScene.ts:302`（相机唯一调用是设背景色）、`EnemyDirectorSystem.ts:897` | 幸存者类核心爽感缺失 |
| 2 | 画面"全员滑冰 + 地面流动"：地面 0.38× 滚动、两层路带 1.0/0.84× 互滑，与角色速度不匹配 | `GameScene.ts:526-539` | 移动反馈失真，最伤体感 |
| 3 | 地图空且假：仅 6 个装饰物按固定节律 Wrap 闪现，背景被 alpha 0.12–0.72 压到几乎不可见 | `GameScene.ts:336-341,541-544` | "一片灰绿"，无武侠氛围 |
| 4 | 画风三系混杂：Q 版主角 / 粗线条山贼 / 厚涂 Boss 与恶犬同屏；UI 两代风格（墨绿国风 vs 暗黑鎏金）冲突 | `src/assets/sprites/*`、`sw-art-015/017` | 第一眼廉价感 |
| 5 | 资产/功能大面积空转：`vfx_scripture_reveal`、`ui_frame_rarity_*` 已加载从未使用；rare/epic 抽卡音效是死代码；音乐总线被硬编码拒绝 | `ScriptureScene.ts:499`、`AudioSystem.ts:123-126` | 高光时刻无声无光 |
| 6 | 抽卡/顿悟零演出：同帧出结果、卡片静态、选中无确认、保底只有一行小字 | `ScriptureScene.ts:477-502`、`InsightScene.ts:107-120` | 奖励时刻多巴胺为零 |
| 7 | 字体零风格化：全部 system-ui，中文标题无描边无书法感 | 全场景十余处 | 与武侠题材割裂 |
| 8 | UI 贴图被 `setDisplaySize` 非等比拉伸，无九宫格；HUD 血条烘死在 PNG 里无法动态渲染 | `ArtPanel.ts:16`、`ui_hud_health_panel.png` | 面板变形、功能性缺陷 |
| 9 | 无 BGM：音频目录为空，16 种合成蜂鸣无随机音高，三种拾取音色雷同 | `AudioSystem.ts:293-306` | 8 分钟单局听觉疲劳 |
| 10 | 死亡 1 秒闪跳、结算静态铺满、Boot 黑屏加载、全场景硬切 | `DeathTransitionScene.ts:65` | 心流断裂 |

**好消息**：`docs/02/10/11/28/29` 里早有现成而未执行的参数表（背景 6 档时间轴、VFX 降级表、音频事件表、音量默认值），优化不是从零设计，而是"把文档落地"。

---

## 2. P0 急救包（1–2 天，纯代码零新资产，收益最大）

> 目标：不动一张图，把"可玩"变"有手感"。

1. **统一滚动基准**：ground 与 road_a 均改 1.0× 滚动（接触面与世界一致），road_b 改 0.9× 薄雾层或 `scrollFactor(0)` 固定污渍层。改 `GameScene.ts:526-539`。
2. **相机反馈链**：
   - 英雄受击 `cameras.main.shake(120, 0.004)`（`GameScene.applyHeroDamage:1042`）
   - Boss 死亡 `shake(400, 0.01)` + `flash(150, 255, 240, 200)`（`handleBossDefeated:1104`）
   - 升级/顿悟开启前 `flash` 淡金 + `zoomTo(1.04, 300)` 回弹
   - hit stop 低配版：Boss 招式命中/精英击杀时 `tweens.timeScale = 0.15` 持续 60–90ms 恢复
3. **伤害飘字系统**：新建 `DamageNumberSystem`，BitmapText/Text 对象池（≤40），`y -24 + alpha→0 + scale 1.2→1`（250ms, Quad.easeOut）；普通白字 / 暴击金色放大 / Boss 橙字。挂 `SkillSystem.ts:641`、`BossSystem.damageBoss`。低 VFX 模式关闭。
4. **受击白闪**：`setTintFill(0xffffff)` 80ms 后 `clearTint()` + 60ms `scale 0.92` 回弹，替换现有 alpha 微闪（`EnemyDirectorSystem.ts:897`、`BossSystem.ts:861`）。
5. **粒子系统从零到一**：BootScene 用 `graphics.generateTexture` 生成 16×16 圆点/星屑/尘粒 3 张小图；命中 `explode(8)`、击杀 `explode(16)`（ADD 混合）、拾取收集 6 粒小迸发。预算直接引用 `docs/29:418-428`。
6. **敌人死亡 200ms 小动画**：不再瞬间 `destroy()`，改 scaleY→0.2 + alpha→0 + 沿弹道击退飞出（`EnemyDirectorSystem.ts:537,549`）。
7. **死代码接线（零成本）**：
   - 抽卡按稀有度播 `scripture_reveal_rare/epic`（`ScriptureScene.ts:499`）
   - `elite_warning` 接精英预警、`boss_intro` 监听 `boss_intro_started`、`copper_gain` 监听 `copper_gained`
8. **背景 alpha 修复**：竹子 0.13→0.5+、山门 0.12→0.4+、road_a 0.46→0.7（`GameScene.ts:315-341`），已有资产立刻可见。
9. **低血警告强化**：现有四边红光数组做 `sin` 呼吸 alpha 0.12–0.25 + 血条 1.04 脉冲（复用 `GameScene.ts:1247-1264`）。
10. **桌面端隐藏虚拟摇杆**（`VirtualJoystick.ts:126-130` 按 `device.input.touch` 判断）。

---

## 3. P1 视觉体系重建（3–5 天）

### 3.1 配色：墨金宣纸（替换现有"森林绿"基调）

| 用途 | 现值 | 新值 |
|------|------|------|
| 世界底色 | `#33483e` 灰绿 | `#14201b` 压暗墨绿 |
| HUD 面板底 | 深绿 | `#101010` 墨 |
| 主文本 | `#f7f0d0` | `#f4f3ec` 暖白宣纸 |
| 次级文本 | — | `#9a958a` |
| 强调金 | `#d6c28d` 亮金 | `#a99a20` 哑光芥金（更"古"） |
| 警示/Boss/受击 | 红绿混杂 | `#c00000` 朱砂 / 低血 `#f1001e` |
| 内力条 | `#3b9fb7` | `#2e7f8f` 降饱和 |
| 稀有度 | 通用蓝紫金 | 普通 `#b8b3a4` 灰宣 → 精良 `#7d9b76` 竹青 → 上乘 `#a99a20` 芥金 → 绝学 `#c00000` 朱砂描金 |

### 3.2 字体

- 中文标题/心法名/Boss 名：开源书法/宋体（演示悠然小楷或思源宋体 Heavy），`@font-face` + `font-display: swap` 入 `styles.css`，BootScene 用 WebFontLoader 加载完成再进菜单。
- 中文正文：思源黑体/PingFang SC；数字与 HUD 标签：等宽字体增强仪表感。
- **中文禁斜体**；强调用字重/描金色/字距。伤害飘字烘焙为 BitmapFont（兼顾性能）。
- 标题加 `setStroke(0x1e2a24, 6)` + `setShadow`。

### 3.3 地图与氛围（改 `drawPlaceholderStage` 与滚动逻辑）

1. **装饰物系统重写**：弃用 Wrap 闪现，改"世界坐标 + 对象池 + chunk 哈希随机散布"（复用 `gameConfig.ts:8` 预留的 `backgroundChunkSizePx`），竹丛/石堆/木桩数量升到 20+，随机 flip/scale/alpha 抖动。
2. **氛围三层**：
   - 暗角：128×128 径向渐变 Canvas 纹理铺屏，`BlendModes.MULTIPLY`，depth 90
   - 雾带：软噪声大 TileSprite，alpha 0.06–0.1，`BlendModes.SCREEN`，0.3× 慢速漂移
   - 落叶/飞尘粒子：2–3 张小叶片贴图，lifespan 6s，每 400ms 1 粒（成本极低、氛围提升最大）
3. **山门叙事化**（落地 `docs/28:335-344` 的 6 档时间轴）：山门不再 Wrap，按 `elapsed/360s` 从极远（alpha 0.05）逐渐清晰，Boss 出场时配合相机 zoom 推到最近——把"杀到黑风寨"做成一局的空间心流目标；Boss 入场全屏压暗 10–18%（文档已定参数）。
4. **地面重绘**（资产侧）：低重复感青石板 4 变体随机贴，或 RenderTexture 预烘焙噪点水渍；`ground_qingshi_base` 1.1MB 压到 512×512。
5. **二期可选**：`lights.enable()` + 主角 PointLight（需法线贴图，工作量大）；林隙光用 ADD 暖光斑即可替代。

### 3.4 HUD 重构

1. **九宫格化**：`createArtPanel` 改 `this.add.nineslice(...)`，移除面板上冗余的矩形描边底框（`GameScene.ts:410,431`），让 sw-art-015 面板直接呈现不再被拉伸。
2. **血条/内力条拆分**：`ui_hud_health_panel`/`ui_panel_hud` 的红色填充烘死在 PNG 里，必须重切为"空槽底图 + 独立 fill"，用 `setCrop` 或 mask 做动态数值。
3. **布局层级**：统一三面板高度与 1px 低透明 hairline 分隔；Boss 战时 Boss 血条移到顶中放大（替换内力条位置），制造视觉重心切换。
4. **位图字体**：HUD 全部数值换 BitmapText。
5. **击杀里程碑**：50/100/200 杀时击杀数 `scale 1→1.4→1` 弹跳 + 金色"百杀！"飘字。

---

## 4. P2 演出编排（3–4 天，让奖励时刻"炸"）

### 4.1 抽卡（改 `ScriptureScene.showResultPanel/pullScripture`）

- **揭示前奏**：点"翻阅"后 `cameras.main.fadeOut(150)` → 全屏 `vfx_scripture_reveal`（已加载未用）ADD 铺底 alpha 0→0.8 脉冲；rare 以上追加 `shake(80, 0.004)`。
- **单抽**：卡牌居中翻面 Tween 链 `scaleY 1→0 → 换图标 → 0→1 (Back.easeOut)`，同时按稀有度 `cameras.main.flash`（绝学金色 `#f6d472`）。
- **十连**：`time.delayedCall(i * 120)` 错峰逐格翻面；高稀有度格故意排到后半段拉期待；加"跳过"热区。
- **稀有度分层**：elite+ 粒子爆发 40–80 粒 + flash；**保底**卡槽加金色粒子尾迹 + 标题金色脉动（承接已 emit 的 `scripture_pity_triggered`）。
- **稀有度框**：用已加载的 `ui_frame_rarity_*` 贴图替换代码画的 2px 矩形（`ScriptureScene.ts:755-758`），elite/epic 叠 ADD 副本做 alpha 0.3↔0.7 呼吸"流光"。

### 4.2 顿悟三选一（改 `InsightScene`）

- 入场：每张卡 `alpha 0, y+34` → `y 原位, alpha 1`，`delay: index * 130`，Cubic.easeOut 错落入场；`vfx_insight_burst` 加 rotation/scale 缓动让静态光"活"起来。
- 悬停：`scale 1.05` + 边框 ADD 发光层淡入。
- 选中爆发：选中卡 `scale→1.12` + 白闪，未选卡 `alpha→0.25`，Tween 完成后再切场——把"我选中了"的确认感补上。

### 4.3 转场与流程

- 封装 `transitionTo()`：全场景 `scene.start` 前 `fadeOut(200)` / 后 `fadeIn(250)`，替代硬切（改 `screenFlow.ts`）。
- 死亡链路：GameScene `flash(200, 226, 74, 54)` + 短慢动作 → DeathTransition 延长至 2.2s（`docs/21:181-186` 要求降饱和 40–60% + 墨色压边）→ ResultScene 铜钱数字 Tween 滚动计数、统计行 stagger 入场、胜利淡青 flash / 失败墨色压边。
- BootScene 加载条：铜边进度条 + 标题，杜绝黑屏。
- 按钮手感：hover/press 改 Tween 弹性 scale（Back.easeOut），按下 80ms 后再触发回调；设置 slider 支持拖拽、只重绘 knob 不整页重建。

### 4.4 Boss 战表现（改 `BossSystem`）

- attack 动画改单次播放对齐 windup→挥砍（现为循环）；windup 期 `setTint(0xff6b5e)` 蓄力。
- 冲锋路径留 2–3 个 Boss 纹理残影；冲锋/旋风攻击本体用贴图+粒子替换几何矩形椭圆（`:769-791`）。
- 预警可读性：alpha 由 0.2→0.9 渐强 + 内圈随 `stateMs` 收缩填充，明示出手时机。
- 死亡：`time.timeScale = 0.3` 400ms 慢镜 + 粒子爆散 + shake/flash 组合。
- 可选：Boss 登场对象级 `postFX.addBloom`，2 秒后移除（勿全屏常驻 PostFX，有已知活跃帧问题）。

### 4.5 技能特效升级

- 一次性 VFX 动画注册从 `repeat: -1` 改 `repeat: 0` + `animationcomplete` 销毁（`artAssets.ts:259-264`）。
- 投射物拖尾：emitter `follow` 弹体，frequency 30 / lifespan 200；进阶版金色尾焰——修复"进阶视觉降级为基础版"的倒挂。
- 回风镖叠 2 层 alpha 渐隐残影；震山波 `shake(200, 0.006)`。

---

## 5. P3 资产重制与 AI 生成管线

### 5.1 资产优先级清单

| 优先级 | 资产 | 动作 |
|--------|------|------|
| P0 | `ui_hud_health_panel` / `ui_panel_hud` | 重切为空槽底图 + 独立 fill 条 |
| P0 | `vfx_enemy_die` | 重做为通用尘烟+碎片（现图是"斗笠小人溶解"，与山贼/恶犬/木人全不匹配） |
| P0 | `ground_qingshi_base` | 重绘低重复感青石板 4 变体，压到 512×512 |
| P1 | 恶犬、Boss | 以主角 Q 版国风为基准重绘（或减细节加描边向 Q 版靠），统一画风 |
| P1 | `road_ribbon` / `bamboo_edge` | 提高本体对比度，竹子加水墨晕染边 |
| P1 | 技能弹体 | 游龙弹体重绘为剑形气劲（现为"蓝色果冻"） |
| P2 | UI 风格统一 | 保留墨绿国风面板代，sw-art-015/017 暗黑鎏金件按"墨绿+描金"重绘 |
| P2 | 新增 | 武侠符号点缀：灯笼、幡旗、石碑、酒坛 |
| P2 | Boss attack 帧 | 修复构图漂移（第 4/5 帧几乎只剩刀光导致跳位） |

### 5.2 生成工作流（沿用 `docs/27` 的 8 步管线与武侠提示词模板/禁用词）

草图→AI 生成→3 秒截图/64px 缩小盲审→切图→命名→manifest→压缩→验收。

---

## 6. 音频方案

1. **BGM 从 0 到 1**（最高优先）：1 条青石山道循环 BGM（战斗段可双层强度切换），生成后 ffmpeg 统一响度转 `.ogg` 落 `src/assets/audio/`，走 music 总线（音量设置已支持）。
2. **真实 SFX 替换合成音**：按 `docs/23-audio-event-table` 23 个事件逐条生成武侠语义音效（木鱼、短鼓、剑风、掌风），保留现有合成音作 fallback。
3. **合成音即时优化**（不等资产）：命中音加 ±8% 频率 jitter + 叠 30ms 低频 thump；三种拾取音色区分开（治疗/内力/铜钱现共用一案）。
4. **解锁门**：MenuScene `input.once('pointerdown')` 内显式 resume AudioContext，避免首屏事件被 autoplay 策略吞掉。
5. 实现 `mergeWindowMs` 拾取聚合；暂停时 suspend AudioContext 消除尾音；`low_hp_loop` 心跳在 HP<25% 淡入。

---

## 7. 外部生成服务边界

本仓库不记录开发者本机密钥路径、已开通服务清单或账号能力。资产生产者可自行选择满足质量和授权要求的供应商，但必须：

- 只从仓库外环境变量读取凭证；
- 不在日志、任务 JSON、截图或交接文档中写入密钥与完整鉴权头；
- 为每个进入版本的资产记录 provider、model、prompt、尺寸、日期、来源文件和许可依据；
- 远程下载使用 tracked 安全下载器的 HTTPS、hostname、MIME 和体积限制；
- 提交前完成来源清单与授权复核，不能用“generated”单一标签代替。

---

## 8. 实施路线图

| 阶段 | 内容 | 预计 | 验收 |
|------|------|------|------|
| **第 1 期 P0** | §2 全部 10 项（纯代码） | 1–2 天 | 受击有震屏白闪、命中有飘字粒子、地面不滑冰、低血有红晕脉冲 |
| **第 2 期 P1** | 配色字体落地、HUD 九宫格+血条拆分、地图装饰物重写+氛围三层+山门时间轴 | 3–5 天 | `docs/10:113` 验收：静止截图 3 秒可辨认少侠/敌人/危险；80 敌包围轮廓可见 |
| **第 3 期 P2** | 抽卡/顿悟演出、全转场、死亡结算仪式感、Boss 战表现、技能拖尾 | 3–4 天 | 抽稀有卡有"炸了"的感觉；死亡→结算节奏符合 `docs/21` |
| **第 4 期 P3+音频** | AI 资产重制管线跑批、BGM/SFX 接入、画风统一 | 持续 | 资产同画风；23 个音频事件全部可闻且为武侠语义 |
| 贯穿 | 性能预算守卫：常驻 VFX ≤80、峰值 ≤160/s、120 敌 60FPS（`docs/10:117-129`）；低 VFX 模式按 `docs/29:430-436` 五步降级闭环 | — | DebugPanel FPS 不掉出基线（现基线 76.5 FPS，`docs/35:52-66`） |

**原则**：每期结束游戏都必须可玩且观感跃升；AI 生成资产一律走 `docs/27` 的盲审→manifest→压缩→验收管线，不进管线的图不进仓库。
