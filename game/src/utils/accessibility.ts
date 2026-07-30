import Phaser from "phaser";

export type AccessibleAction = {
  label: string;
  description?: string;
  onActivate: () => void;
};

const ROOT_ID = "wuxia-a11y-controls";
const LIVE_ID = "wuxia-a11y-live";

export function setAccessibleActions(
  scene: Phaser.Scene,
  title: string,
  actions: AccessibleAction[],
  summary = ""
): void {
  const root = ensureRoot();
  root.replaceChildren();
  root.setAttribute("aria-label", title);

  const heading = document.createElement("h1");
  heading.textContent = title;
  heading.className = "a11y-only";
  root.appendChild(heading);

  if (summary) {
    const description = document.createElement("p");
    description.textContent = summary;
    description.className = "a11y-only";
    root.appendChild(description);
  }

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.className = "a11y-game-action";
    if (action.description) {
      button.setAttribute("aria-label", `${action.label}，${action.description}`);
    }
    button.addEventListener("click", action.onActivate, { once: false });
    root.appendChild(button);
  }

  const canvas = scene.game.canvas;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", `${title}。可按 Tab 浏览游戏操作。`);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (root.getAttribute("aria-label") === title) {
      root.replaceChildren();
    }
  });
  announceAccessibleText(`${title}。${summary}`);
}

export function announceAccessibleText(message: string): void {
  const live = ensureLiveRegion();
  live.textContent = "";
  window.setTimeout(() => {
    live.textContent = message;
  }, 20);
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("nav");
    root.id = ROOT_ID;
    root.className = "a11y-game-controls";
    document.body.appendChild(root);
  }
  return root;
}

function ensureLiveRegion(): HTMLElement {
  let live = document.getElementById(LIVE_ID);
  if (!live) {
    live = document.createElement("div");
    live.id = LIVE_ID;
    live.className = "a11y-only";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    document.body.appendChild(live);
  }
  return live;
}
