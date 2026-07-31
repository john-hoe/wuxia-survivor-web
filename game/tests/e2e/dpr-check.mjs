import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.WUXIA_BASE_URL ?? "http://127.0.0.1:5281";
const outputRoot = resolve(process.env.WUXIA_EVIDENCE_DIR ?? "test-results/dpr");
await mkdir(outputRoot, { recursive: true });

let failed = false;
for (const dpr of [1, 2]) {
  const browser = await chromium.launch({
    headless: true,
    ignoreDefaultArgs: ["--enable-unsafe-swiftshader"],
    ...(process.env.WUXIA_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.WUXIA_CHROMIUM_EXECUTABLE_PATH }
      : { channel: process.env.WUXIA_BROWSER_CHANNEL ?? "chrome" })
    // Deliberately no --allow-file-access-from-files or unsafe SwiftShader
    // flags. The target must be a trusted localhost HTTP server.
  });
  const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: dpr,
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  if (!response?.ok()) {
    errors.push(`navigation returned ${response?.status() ?? "no response"}`);
  }
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return { error: "canvas missing" };
    const rect = canvas.getBoundingClientRect();
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      devicePixelRatio: window.devicePixelRatio,
      screenState: window.__WUXIA_SURVIVOR_DEBUG__?.getDebugSnapshot?.()?.screenState
    };
  });
  if ("error" in metrics || metrics.canvasWidth < 960 || metrics.canvasHeight < 540) {
    errors.push(`invalid canvas metrics: ${JSON.stringify(metrics)}`);
  }
  await page.screenshot({ path: resolve(outputRoot, `menu-dpr${dpr}.png`), fullPage: true });
  if (errors.length > 0) {
    failed = true;
    console.error(JSON.stringify({ dpr, metrics, errors }, null, 2));
  } else {
    console.log(JSON.stringify({ dpr, metrics, errors }, null, 2));
  }
  await browser.close();
}

process.exitCode = failed ? 1 : 0;
