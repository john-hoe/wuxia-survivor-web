import Phaser from "phaser";

/**
 * 高 DPR 高清渲染：「设计分辨率」与「渲染分辨率」解耦。
 *
 * - 设计坐标系恒定 960×540（设计单位）：所有场景布局、HUD、全屏层、粒子范围、
 *   敌人生成/剔除的屏幕换算一律使用 DESIGN_WIDTH / DESIGN_HEIGHT，与画布物理尺寸无关。
 * - 渲染尺寸 = 960×K × 540×K（K = min(devicePixelRatio || 1, 2)，见 main.ts）：
 *   Retina 屏按 K 倍物理像素光栅化，文字/贴图/粒子不再被 CSS 拉伸糊化。
 * - 每个场景主相机 setOrigin(0,0) + setZoom(K) + setScroll(0,0)：相机退化为纯 K 倍缩放，
 *   worldView 恒为 960×540 设计单位；sf=0（HUD/全屏层）与 sf=1（世界）坐标系重合。
 *
 * 输入坐标：Phaser 的命中检测自动经相机 transform（worldX/worldY 为设计单位）；
 * 手动读取 pointer 的代码（虚拟摇杆、设置滑杆）必须用 pointer.worldX/worldY。
 *
 * 注意：K 在游戏启动时计算一次；运行中跨屏拖动改变 devicePixelRatio 不热更新（重启生效）。
 */

/** 设计坐标系宽（世界/屏幕逻辑单位）。 */
export const DESIGN_WIDTH = 960;
/** 设计坐标系高（世界/屏幕逻辑单位）。 */
export const DESIGN_HEIGHT = 540;

/** 渲染倍率 K = min(devicePixelRatio || 1, 2)；DPR=1 时 K=1，与旧行为完全一致。 */
export const RESOLUTION_SCALE = resolveResolutionScale();

/** 画布实际像素尺寸（= 设计尺寸 × K），供 main.ts GameConfig 使用。 */
export const RENDER_WIDTH = DESIGN_WIDTH * RESOLUTION_SCALE;
export const RENDER_HEIGHT = DESIGN_HEIGHT * RESOLUTION_SCALE;

function resolveResolutionScale(): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  if (!Number.isFinite(dpr) || dpr <= 0) {
    return 1;
  }
  return Math.min(dpr, 2);
}

/**
 * 场景接入：create()（BootScene 为 preload()）开头调用一次。
 *
 * 关键细节（实测 Phaser 3.90）：相机 zoom 默认绕视口中心（origin 0.5）缩放，
 * 该模式下 setScrollFactor(0) 的对象（HUD/全屏雾带/暗角/虚拟摇杆）坐标会被
 * 解释为「未缩放视口像素」，相对 sf=1 世界坐标偏移 center·(K-1)/K，导致全屏层
 * 覆盖错位、摇杆画出屏外。把 origin 固定为 (0,0) 后，相机退化为纯 K 倍缩放：
 * scroll(0,0) 下 sf=0 与 sf=1 坐标系重合，设计坐标对两者一致。
 * zoom/scroll/origin 持久于相机，场景切换/窗口 resize（FIT 仅改 CSS 缩放）无需重复调用。
 */
export function applyResolutionCamera(scene: Phaser.Scene): void {
  const camera = scene.cameras.main;
  camera.setOrigin(0, 0);
  camera.setZoom(RESOLUTION_SCALE);
  camera.setScroll(0, 0);
}
