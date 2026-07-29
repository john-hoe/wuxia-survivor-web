import Phaser from "phaser";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../ui/designSize";

/**
 * 墨晕转场 —— 自定义 PostFXPipeline（值噪声纹理 + 阈值场）。
 *
 * 思路移植自 prototypes/f-inkwipe.html：
 *  - 四八度值噪声预烘进一张 512×512 RGBA 纹理（R/G/B/A = 低频墨势/纸纹/飞白/墨内浓淡）；
 *  - 片元内按形态求阈值场 f(uv)，uProgress 驱动阈值 thr：f < thr 处着墨；
 *  - 边缘带（0 < inside < 0.09）用高频噪声 + 笔向条纹撕出「飞白/干笔丝」，
 *    墨锋外一圈「水痕灰晕」，前锋前撒「飞沫」溅点；
 *  - 满墨（t≥0.995）压实不留尾丝，空墨（t≤0.002）强制无墨。
 *
 * 两种形态（对应小样 A/B 案）：
 *  - "center"：圆墨中晕 —— 墨滴从画面中心晕开至满屏（Boss 登场 / 死亡过渡）；
 *  - "sweep" ：斜锋扫墨 —— 墨带从左上扫向右下（常规场景切换）。
 *
 * 性能：管线只在转场期间挂在相机上，出墨完成（progress 回到 0）即 removePostPipeline。
 * Canvas 渲染器兜底：本模块函数返回 false，由调用方退回 cameras.main.fadeOut/fadeIn。
 */

export type InkWipeMode = "center" | "sweep";

export interface InkWipeOptions {
  /** 墨晕形态：center=圆墨中晕（A 案），sweep=斜锋扫墨（B 案）。 */
  mode?: InkWipeMode;
  /** 入墨/出墨时长（ms）。入墨默认 1150，出墨默认 850。 */
  durationMs?: number;
  /** 动画完成回调（出墨完成后管线已从相机摘除）。 */
  onComplete?: () => void;
}

const PIPELINE_KEY = "InkWipe";
const NOISE_TEXTURE_KEY = "__ink_wipe_noise";
const NOISE_SIZE = 512;
/** B 案阈值场上限：需覆盖 f 的理论最大值（≈1.28）；A 案在着色器内分段推进（0.19+0.64+0.62=1.45 同效）。满墨时统一压实到 2.0。 */
const THR_MAX = 1.35;

/* ============ 确定性伪随机 + 值噪声（与小样一致的实现） ============ */

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 值噪声：cells×cells 随机格点 + smoothstep 双线性插值，u/v 回绕到 [0,1)。 */
function makeValueNoise(seed: number, cellsX: number, cellsY = cellsX): (u: number, v: number) => number {
  const sx = cellsX + 2;
  const sy = cellsY + 2;
  const grid = new Float32Array(sx * sy);
  const rng = mulberry32(seed);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = rng();
  }
  const sm = (t: number): number => t * t * (3 - 2 * t);
  const wrap = (t: number): number => {
    t = t % 1;
    return t < 0 ? t + 1 : t;
  };
  return (u: number, v: number): number => {
    u = wrap(u);
    v = wrap(v);
    const fx = u * cellsX;
    const fy = v * cellsY;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = sm(fx - ix);
    const ty = sm(fy - iy);
    const p = iy * sx + ix;
    const v00 = grid[p];
    const v10 = grid[p + 1];
    const v01 = grid[p + sx];
    const v11 = grid[p + sx + 1];
    return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
  };
}

/**
 * 生成（全局只一次）四八度噪声纹理：R=n1(6) G=n2(16) B=n3(44) A=n4(80)。
 * 与小样同款种子/频率；着色器直接采样即为小样的 n1~n4。
 */
function ensureNoiseTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(NOISE_TEXTURE_KEY)) {
    return;
  }
  const canvasTexture = scene.textures.createCanvas(NOISE_TEXTURE_KEY, NOISE_SIZE, NOISE_SIZE);
  if (!canvasTexture) {
    return;
  }
  const ctx = canvasTexture.getContext();
  const image = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
  const data = image.data;
  const n1 = makeValueNoise(11, 6);
  const n2 = makeValueNoise(23, 16);
  const n3 = makeValueNoise(37, 44);
  const n4 = makeValueNoise(53, 80);
  for (let y = 0; y < NOISE_SIZE; y++) {
    for (let x = 0; x < NOISE_SIZE; x++) {
      const u = (x + 0.5) / NOISE_SIZE;
      const v = (y + 0.5) / NOISE_SIZE;
      const o = (y * NOISE_SIZE + x) * 4;
      data[o] = Math.round(n1(u, v) * 255);
      data[o + 1] = Math.round(n2(u, v) * 255);
      data[o + 2] = Math.round(n3(u, v) * 255);
      data[o + 3] = Math.round(n4(u, v) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  canvasTexture.refresh();
}

/* ============ 片元着色器（GLSL ES 1.00，与内置 FX 管线同约定） ============ */

const INK_WIPE_FRAG = `#define SHADER_NAME INK_WIPE_FS

precision mediump float;

uniform sampler2D uMainSampler;
uniform sampler2D uNoiseSampler;
uniform float uProgress;
uniform float uMode;
uniform vec2 uResolution;

varying vec2 outTexCoord;

// 阈值场：A 圆墨中晕 = 中心距离场破形；B 斜锋扫墨 = 对角推进场
float shapeField(vec2 uv, float n1, float n2) {
  if (uMode < 0.5) {
    float d = length(vec2(uv.x - 0.5, (uv.y - 0.52) * 1.18)) / 0.62;
    return d * 0.72 + n1 * 0.28 + n2 * 0.10;
  }
  float d = (uv.x * 1.04 + uv.y * 0.96) * 0.5;
  return d * 0.84 + n1 * 0.34 + n2 * 0.10;
}

void main() {
  vec4 scene = texture2D(uMainSampler, outTexCoord);
  float t = clamp(uProgress, 0.0, 1.0);

  // outTexCoord 原点在左下，翻转为小样的「左上原点」约定，保证扫墨自左上起笔
  vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);

  vec4 nz = texture2D(uNoiseSampler, uv);
  float n1 = nz.r;
  float n2 = nz.g;
  float hf = nz.b;
  float fine = nz.a;

  // 干笔丝：沿笔向拉伸的条纹噪声（A 斜锋 26° / B 沿扫向 45°）
  float ang = uMode < 0.5 ? 0.45 : 0.785;
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 rp = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);
  float st = texture2D(uNoiseSampler, fract(rp * vec2(3.0 / 44.0, 34.0 / 44.0))).b;

  // 飞沫：量化到 3px 小块的溅点
  vec2 q = floor(uv * uResolution / 3.0) * 3.0 / uResolution;
  float sp = texture2D(uNoiseSampler, fract(vec2(1.0 - q.x + 0.37, q.y * 0.83 + 0.11))).b;

  float f = shapeField(uv, n1, n2);

  // 阈值推进：
  // A 案覆盖率 ∝ 距离²，sqrt 匀速化并扣除噪声均值偏置 0.19；末段（t>0.8）洇满四角高噪点。
  // B 案对角带覆盖率近似线性。
  float thr;
  if (uMode < 0.5) {
    float ts = sqrt(min(t / 0.8, 1.0));
    float t2 = max(t - 0.8, 0.0) / 0.2;
    thr = 0.19 + 0.64 * ts + 0.62 * t2 * t2 + 0.0008;
  } else {
    thr = t * ${THR_MAX} + 0.0008;
  }
  if (t >= 0.995) { thr = 2.0; }
  if (t <= 0.002) { thr = -1.0; }

  float inside = thr - f;
  float a = 0.0;
  if (inside > 0.0) {
    float m = inside / 0.09;
    if (m >= 1.0) {
      a = 0.9412 + (fine - 0.5) * 0.0863;
      if (m < 1.9 && st > 0.58) {
        float g = (st - 0.58) / 0.42;
        float deep = (1.9 - m) / 0.9;
        a *= 1.0 - 0.8 * g * deep;
      }
    } else {
      float k = m * (0.22 + 1.3 * hf);
      k *= 0.4 + 0.9 * st;
      a = clamp(k, 0.0, 1.0) * 0.9647;
    }
  } else if (inside > -0.045) {
    a = 0.1176 * (1.0 + inside / 0.045);
  } else if (inside > -0.11 && sp > 0.958) {
    a = 0.8039;
  }

  // 墨为近黑 #0a0f0c；alpha 取 max(scene.a, a)，覆盖场景（含下层暂停场景）不漏底
  vec3 ink = vec3(10.0, 15.0, 12.0) / 255.0;
  gl_FragColor = vec4(mix(scene.rgb, ink, a), max(scene.a, a));
}
`;

/* ============ PostFXPipeline ============ */

export class InkWipePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** 墨覆盖率 0=无墨 1=满墨（由 inkWipeIn/Out 的补间驱动）。 */
  public progress = 0;
  /** 0 = 圆墨中晕（center），1 = 斜锋扫墨（sweep）。 */
  public mode = 1;

  private noiseTexture?: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: INK_WIPE_FRAG });
  }

  private ensureNoiseTextureBound(): boolean {
    if (!this.noiseTexture) {
      const frame = this.game.textures.getFrame(NOISE_TEXTURE_KEY);
      this.noiseTexture = frame?.glTexture ?? undefined;
    }
    return this.noiseTexture !== undefined;
  }

  override onDraw(source: Phaser.Renderer.WebGL.RenderTarget): void {
    if (!this.ensureNoiseTextureBound()) {
      // 噪声纹理未就绪：原样透传，避免黑屏
      this.bindAndDraw(source);
      return;
    }
    this.bind();
    this.set1i("uMainSampler", 0);
    this.set1i("uNoiseSampler", 1);
    this.set1f("uProgress", this.progress);
    this.set1f("uMode", this.mode);
    // 高 DPR：uResolution 仅用于飞沫 3px 小块量化，必须传设计尺寸（960×540），
    // 否则 K 倍渲染缓冲下飞沫块相对屏幕缩小 K 倍，视觉与旧版不一致
    this.set2f("uResolution", DESIGN_WIDTH, DESIGN_HEIGHT);
    this.bindTexture(this.noiseTexture, 1);
    // bindAndDraw 只占用纹理单元 0，单元 1 的噪声纹理保持绑定
    this.bindAndDraw(source);
  }
}

/* ============ 驱动逻辑 ============ */

/** 每个场景同时只跑一段墨晕补间；新墨晕接管时杀掉旧的，防止 progress 打架。 */
const activeInkTweens = new WeakMap<Phaser.Scene, Phaser.Tweens.Tween>();

/** 斜锋扫墨「反向收回」标记：transitionTo 墨满换场后，由 fadeIn 消费一次。 */
let sweepRevealPending = false;

export function markInkSweepRevealPending(): void {
  sweepRevealPending = true;
}

export function consumeInkSweepRevealPending(): boolean {
  const pending = sweepRevealPending;
  sweepRevealPending = false;
  return pending;
}

function isWebGLRenderer(scene: Phaser.Scene): boolean {
  // config.renderType 可能是 AUTO（0），以解析后的 renderer.type 为准
  return scene.renderer.type === Phaser.WEBGL;
}

/** 注册（幂等）并把管线挂到主相机，返回实例与是否复用；Canvas 渲染器或挂载失败返回 null。 */
function attachPipeline(
  scene: Phaser.Scene,
  mode: InkWipeMode
): { pipeline: InkWipePipeline; reused: boolean } | null {
  if (!isWebGLRenderer(scene)) {
    return null;
  }
  const renderer = scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  ensureNoiseTexture(scene);
  const manager = renderer.pipelines;
  if (!manager.postPipelineClasses.has(PIPELINE_KEY)) {
    manager.addPostPipeline(PIPELINE_KEY, InkWipePipeline);
  }
  const camera = scene.cameras.main;
  let instance = camera.postPipelines.find(
    (pipeline): pipeline is InkWipePipeline => pipeline instanceof InkWipePipeline
  );
  const reused = instance !== undefined;
  if (!instance) {
    camera.setPostPipeline(PIPELINE_KEY);
    instance = camera.postPipelines.find(
      (pipeline): pipeline is InkWipePipeline => pipeline instanceof InkWipePipeline
    );
  }
  if (!instance) {
    return null;
  }
  instance.mode = mode === "center" ? 0 : 1;
  return { pipeline: instance, reused };
}

function detachPipeline(scene: Phaser.Scene): void {
  try {
    scene.cameras.main.removePostPipeline(PIPELINE_KEY);
  } catch {
    // 相机已随场景销毁时静默
  }
}

function runInk(
  scene: Phaser.Scene,
  mode: InkWipeMode,
  from: number,
  to: number,
  durationMs: number,
  onComplete?: () => void
): boolean {
  const attached = attachPipeline(scene, mode);
  if (!attached) {
    return false;
  }
  const { pipeline, reused } = attached;
  // 复用进行中的管线时从当前墨量接续（如跳过死亡演出直接 transitionTo），避免墨面瞬间跳变
  const startT = reused ? pipeline.progress : from;
  pipeline.progress = startT;
  activeInkTweens.get(scene)?.remove();
  const state = { t: startT };
  const tween = scene.tweens.add({
    targets: state,
    t: to,
    duration: Math.max(16, durationMs),
    ease: "Linear",
    onUpdate: () => {
      pipeline.progress = state.t;
    },
    onComplete: () => {
      pipeline.progress = to;
      activeInkTweens.delete(scene);
      if (to <= 0) {
        // 出墨完成：摘除全屏管线，恢复常态渲染
        detachPipeline(scene);
      }
      onComplete?.();
    }
  });
  activeInkTweens.set(scene, tween);
  // 场景中断（shutdown）时兜底清理：杀补间 + 摘管线
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    tween.remove();
    activeInkTweens.delete(scene);
    detachPipeline(scene);
  });
  return true;
}

/**
 * 入墨：墨从起点晕开至满屏（progress 0→1），完成后墨保持满屏。
 * 调用方负责在墨满后换场（scene.start）或接 inkWipeOut 收回。
 * @returns true=WebGL 墨晕已启动；false=Canvas 渲染器，调用方应退回 fadeOut。
 */
export function inkWipeIn(scene: Phaser.Scene, options?: InkWipeOptions): boolean {
  return runInk(
    scene,
    options?.mode ?? "sweep",
    0,
    1,
    options?.durationMs ?? 1150,
    options?.onComplete
  );
}

/**
 * 出墨：满墨反向收回至无墨（progress 1→0），完成后管线自动摘除。
 * @returns true=WebGL 墨晕已启动；false=Canvas 渲染器，调用方应退回 fadeIn。
 */
export function inkWipeOut(scene: Phaser.Scene, options?: InkWipeOptions): boolean {
  return runInk(
    scene,
    options?.mode ?? "sweep",
    1,
    0,
    options?.durationMs ?? 850,
    options?.onComplete
  );
}
