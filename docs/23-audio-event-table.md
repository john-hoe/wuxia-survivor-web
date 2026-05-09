# 23 Audio Event Table

## 目的

本文细化 [11 Audio HUD Pause](11-audio-hud-pause.md)，定义 MVP 音频事件、优先级、节流和验收。

第一性原则：

- 音效帮助玩家理解事件，不靠刺耳和堆叠制造刺激。
- 高频战斗音必须节流。
- 所有声音必须可静音、可调音量。
- 音频不能成为移动端性能和舒适度问题。

## 音频总线

| 总线 | 默认音量 | 内容 |
| --- | ---: | --- |
| master | 1.0 | 全局 |
| music | 0.6 | 背景音乐 |
| sfx | 0.8 | 战斗和 UI 音效 |

设置写入 `localStorage`。

## 事件表

| id | 类型 | 建议时长 | 优先级 | 节流 | 用途 |
| --- | --- | ---: | ---: | ---: | --- |
| `music_menu` | music | loop | 1 | 无 | 主菜单背景，可与关卡 BGM 同主题 |
| `music_stage_qingshi` | music | loop | 1 | 无 | 青石山道背景 |
| `menu_open` | sfx | 0.3s | 2 | 无 | 主菜单打开 |
| `ui_click` | sfx | 0.08s | 4 | 40ms | 按钮 |
| `pause_toggle` | sfx | 0.12s | 5 | 100ms | 暂停/继续 |
| `hit_light` | sfx | 0.06s | 2 | 80ms | 普通命中 |
| `enemy_die` | sfx | 0.18s | 3 | 60ms | 敌人死亡 |
| `inner_power_pickup` | sfx | 0.12s | 3 | 50ms 合并 | 内力拾取 |
| `copper_gain` | sfx | 0.18s | 3 | 100ms | 铜钱获得 |
| `hero_hurt` | sfx | 0.25s | 8 | 300ms | 少侠受伤 |
| `hero_die` | sfx | 0.8s | 10 | 无 | 阵亡过渡 |
| `low_hp_loop` | sfx | loop | 6 | 低血量期间 | 生命过低，可关闭 |
| `insight` | sfx | 0.7s | 9 | 无 | 领悟 |
| `skill_advance` | sfx | 0.9s | 10 | 无 | 招式进阶 |
| `elite_warning` | sfx | 0.6s | 7 | 1000ms | 精英预警 |
| `boss_intro` | sfx | 1.2s | 10 | 无 | 头目入场 |
| `boss_warning` | sfx | 0.45s | 9 | 500ms | 头目攻击预警 |
| `boss_hit` | sfx | 0.12s | 4 | 80ms | 头目受击 |
| `boss_defeated` | sfx | 1.0s | 10 | 无 | 头目击败 |
| `result_open` | sfx | 0.5s | 7 | 无 | 战后清点 |
| `scripture_reveal_common` | sfx | 0.5s | 6 | 无 | 普通秘籍 |
| `scripture_reveal_rare` | sfx | 0.7s | 7 | 无 | 稀有秘籍 |
| `scripture_reveal_epic` | sfx | 1.0s | 9 | 无 | 史诗秘籍 |

优先级 10 最高。声音数量超过预算时，低优先级先被丢弃。

## 同时播放预算

| 项 | 上限 |
| --- | ---: |
| 同时 sfx voices | 24 |
| 高频命中 voices | 4 |
| 内力拾取合并窗口 | 50ms |
| 普通死亡合并窗口 | 60ms |
| 头目/领悟/受伤 | 不被普通音效挤掉 |

## 音量建议

| 类别 | 相对音量 |
| --- | ---: |
| 普通命中 | 0.45 |
| 敌人死亡 | 0.55 |
| 拾取 | 0.5 |
| 受伤 | 0.8 |
| 领悟 | 0.9 |
| 进阶 | 1.0 |
| 头目预警 | 0.95 |
| UI | 0.45 |

## 低血量声音

`low_hp_loop` 可选，但如果做，必须满足：

- 血量低于 25% 才播放。
- 静音、音效音量 0 或暂停页打开时停止。
- 不和 `hero_hurt` 叠到刺耳。
- 设置页可以关闭。

## 文件格式

推荐：

- `.ogg` 为主。
- `.mp3` 作为 Safari fallback 时再考虑。
- 单个短音效建议 <=100KB。
- BGM MVP 建议 <=3MB。

## 制作管线

MVP 音频分 3 层推进：

| 层级 | 工具 | 产物 | 进入版本条件 |
| --- | --- | --- | --- |
| 占位层 | WebAudio、ZzFX、Bfxr、手工短波形 | `placeholder_*.ogg` 或运行时合成 | 事件能触发、能静音、不过载 |
| 生成层 | MiniMax 或其他本机已有音频 API | 武侠风短音效、青石山道 BGM 草案 | 授权来源清楚、无 key 泄漏、响度可控 |
| 整理层 | Audacity、ffmpeg、脚本批处理 | 裁切、转码、响度统一后的 `.ogg` | 文件名、时长、体积和 manifest 通过检查 |

本机私有 key 使用规则：

- 可以从仓库外的私有环境文件或 shell 环境读取 API key。
- 不把 key、完整请求 header 或返回的鉴权信息写入 `survivor-web/`。
- 生成脚本日志只记录 provider、prompt id、事件 id、输出文件和耗时。
- 如果 provider 调用失败，保留占位层音频，不阻塞系统验收。

推荐生成顺序：

1. UI：`ui_click`、`pause_toggle`、`result_open`。
2. 战斗高频：`hit_light`、`enemy_die`、`inner_power_pickup`。
3. 高优先级反馈：`hero_hurt`、`hero_die`、`insight`、`skill_advance`。
4. 头目：`boss_intro`、`boss_warning`、`boss_defeated`。
5. 翻阅秘籍：`scripture_reveal_common`、`scripture_reveal_rare`、`scripture_reveal_epic`。
6. BGM：`music_stage_qingshi`。

生成提示词原则：

- 用“短、清楚、弱混响、低频不过量”的提示词，避免移动端小喇叭刺耳。
- 高频事件不能做长尾音；命中音和拾取音建议 0.06 到 0.18 秒。
- 武侠语义可以来自木鱼、短鼓、金属轻击、剑风、掌风，但不要做仙侠大合唱或电影预告风。
- 每个事件最多保留 3 个候选，按可读性、疲劳度和体积筛选。

建议目录：

```text
survivor-web/game/src/assets/audio/
  music/
    music_stage_qingshi.ogg
  sfx/
    ui_click_01.ogg
    hit_light_01.ogg
    enemy_die_01.ogg
  generated/
    manifest-audio-source.json
```

`manifest-audio-source.json` 只记录非敏感来源信息：

```json
{
  "id": "hero_die",
  "provider": "minimax",
  "prompt": "short wuxia hero defeat sting, muted drum, soft sword fall, no vocals",
  "sourceFile": "generated/hero_die_raw_01.wav",
  "finalFile": "sfx/hero_die_01.ogg",
  "durationSeconds": 0.8,
  "review": "pass"
}
```

## 数据结构建议

```ts
type AudioEventConfig = {
  id: string;
  path: string;
  bus: "music" | "sfx";
  priority: number;
  volume: number;
  throttleMs: number;
  mergeWindowMs?: number;
  loop?: boolean;
  required: boolean;
  source?: "placeholder" | "generated" | "handmade";
};
```

## 验收

- 静音后不再播放音乐或音效。
- 刷新后音量、静音、低 VFX 设置保留。
- 高频命中不会连续爆音。
- 内力连续拾取会合并，不刺耳。
- 头目预警、领悟、进阶、受伤不会被普通命中音挤掉。
- 暂停页打开后，战斗循环音和危险提示暂停或降低。
- `hero_die` 和 `result_open` 不重叠到刺耳，阵亡到战后清点节奏清楚。
- 生成素材没有把 API key 或完整鉴权信息写入仓库。
- 没有任何广告、付费或商城相关音频提示。
