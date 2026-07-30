import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const gameBuild = resolve(repositoryRoot, "game/dist");
const sitesBuild = resolve(repositoryRoot, "dist");
const clientBuild = resolve(sitesBuild, "client");
const serverBuild = resolve(sitesBuild, "server");

await rm(sitesBuild, { recursive: true, force: true });
await mkdir(clientBuild, { recursive: true });
await mkdir(serverBuild, { recursive: true });
await cp(gameBuild, clientBuild, { recursive: true });

const workerSource = `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") {
      return response;
    }

    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/html")) {
      return response;
    }

    const fallback = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(fallback, request));
  }
};

export default worker;
`;

await writeFile(resolve(serverBuild, "index.js"), workerSource, "utf8");
console.log("Prepared Sites build in dist/");
