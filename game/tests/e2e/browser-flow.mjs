import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.WUXIA_BASE_URL ?? "http://127.0.0.1:5281";
const outputRoot = resolve(process.env.WUXIA_EVIDENCE_DIR ?? "test-results/browser");
await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ignoreDefaultArgs: ["--enable-unsafe-swiftshader"],
  ...(process.env.WUXIA_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.WUXIA_CHROMIUM_EXECUTABLE_PATH }
    : { channel: process.env.WUXIA_BROWSER_CHANNEL ?? "chrome" })
});
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const errors = [];
let initialPayload;
page.on("pageerror", error => errors.push(String(error)));
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});

async function activate(name) {
  const button = page.getByRole("button", { name, exact: false }).first();
  await button.waitFor({ state: "attached" });
  await button.evaluate(element => element.click());
}

async function expectAction(name) {
  await page.getByRole("button", { name, exact: false }).first().waitFor({ state: "attached" });
}

async function settleTransition() {
  await page.waitForTimeout(1300);
}

try {
  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  if (!response?.ok()) errors.push(`navigation returned ${response?.status() ?? "no response"}`);
  if (!await page.locator("canvas[role='application']").count()) errors.push("accessible game canvas missing");
  for (const name of ["开始闯荡", "翻阅秘籍", "设置"]) await expectAction(name);
  initialPayload = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    return {
      resourceCount: resources.length,
      encodedBodyBytes: resources.reduce((total, entry) => {
        return total + ("encodedBodySize" in entry ? entry.encodedBodySize : 0);
      }, 0),
      imageCount: resources.filter(entry => entry.initiatorType === "img").length
    };
  });
  if (initialPayload.encodedBodyBytes > 6 * 1024 * 1024) {
    errors.push(`initial encoded payload exceeds 6 MiB: ${initialPayload.encodedBodyBytes}`);
  }
  await page.screenshot({ path: resolve(outputRoot, "01-menu.png") });

  await activate("设置");
  for (const name of ["总音量", "低特效", "伤害飘字", "返回"]) await expectAction(name);
  await settleTransition();
  await page.screenshot({ path: resolve(outputRoot, "02-settings.png") });
  await activate("返回");

  await activate("翻阅秘籍");
  for (const name of ["翻阅一次", "翻阅十次", "局外成长", "返回"]) await expectAction(name);
  await settleTransition();
  await activate("翻阅一次");
  await page.waitForFunction(() => document.body.textContent?.includes("铜钱不足"));
  await page.screenshot({ path: resolve(outputRoot, "03-scripture-insufficient.png") });
  await activate("局外成长");
  await expectAction("铜钱不足");
  await expectAction("返回");
  await settleTransition();
  await page.screenshot({ path: resolve(outputRoot, "04-meridian.png") });
  await activate("返回");
  await expectAction("翻阅一次");
  await activate("返回");
  await expectAction("开始闯荡");

  await activate("开始闯荡");
  await expectAction("暂停游戏");
  await settleTransition();
  await page.screenshot({ path: resolve(outputRoot, "05-game.png") });
  await activate("暂停游戏");
  for (const name of ["继续", "重新开始", "回主菜单", "设置"]) await expectAction(name);
  await settleTransition();
  await page.screenshot({ path: resolve(outputRoot, "06-pause.png") });

  const overlay = await page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay").count();
  if (overlay > 0) errors.push("framework error overlay detected");
  if (errors.length > 0) {
    console.error(JSON.stringify({ errors }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      passed: true,
      screens: ["menu", "settings", "scripture", "meridian", "game", "pause"],
      consoleErrorCount: 0,
      initialPayload
    }, null, 2));
  }
} finally {
  await browser.close();
}
