import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { readFile } from "node:fs/promises";
import { loadConfig } from "./config.js";
import { RecipeLibrary } from "./services/library.js";
import { createAppRouter } from "./router.js";
import { JobQueue } from "./jobs/queue.js";
import { OpenAiCompatibleProvider } from "./services/ai.js";
import { createAiIngestHandler, createAiTextIngestHandler } from "./jobs/ai-ingest.js";
import { createBrowserFetchHandler } from "./jobs/browser-fetch.js";
import { closeBrowser } from "./services/browser.js";
import type { AppContext } from "./trpc.js";

const config = loadConfig();
const library = new RecipeLibrary(config.MISE_RECIPES_DIR);
const jobQueue = new JobQueue(config.MISE_JOB_CONCURRENCY);

// Register AI ingestion handler if AI provider is configured
// Register job handlers
jobQueue.registerHandler(createBrowserFetchHandler(library));

if (config.MISE_AI_ENDPOINT) {
  const aiProvider = new OpenAiCompatibleProvider(config);
  jobQueue.registerHandler(createAiIngestHandler(aiProvider, library));
  jobQueue.registerHandler(createAiTextIngestHandler(aiProvider, library));
  console.log(`AI ingestion enabled (model: ${config.MISE_AI_MODEL})`);
}

const appRouter = createAppRouter(jobQueue);
const app = new Hono();

// Health check
app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    recipes: library.size,
    ai: !!config.MISE_AI_ENDPOINT,
  }),
);

// tRPC API
app.all("/api/trpc/*", (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: (): AppContext => ({ config, library }),
  });
});

// Serve static SPA assets in production
app.use("/assets/*", serveStatic({ root: "./dist/ui" }));

// SPA fallback — serve index.html for any non-API route
app.get("*", async (c) => {
  try {
    const html = await readFile(new URL("../../dist/ui/index.html", import.meta.url), "utf-8");
    return c.html(html);
  } catch {
    return c.text("UI not built. Run: pnpm --filter @mise/web build:ui", 404);
  }
});

// Start
async function main() {
  await library.initialize();
  console.log(`Loaded ${library.size} recipes from ${config.MISE_RECIPES_DIR}`);

  serve({ fetch: app.fetch, port: config.MISE_PORT }, () => {
    console.log(`mise running at http://localhost:${config.MISE_PORT}`);
  });
}

// Graceful shutdown
async function shutdown() {
  await library.close();
  await closeBrowser();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
