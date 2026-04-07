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
import { createImportIngestHandler } from "./jobs/import-ingest.js";
import { createVideoIngestHandler } from "./jobs/video-ingest.js";
import { isYtDlpAvailable } from "./services/subtitles.js";
import { closeBrowser } from "./services/browser.js";
import { createTelegramBot } from "./services/telegram.js";
import { createAuthRoutes, createAuthMiddleware } from "./auth.js";
import type { AppContext } from "./trpc.js";

const config = loadConfig();
const library = new RecipeLibrary(config.PLAINFARE_RECIPES_DIR);
const jobQueue = new JobQueue(config.PLAINFARE_JOB_CONCURRENCY);

// Register AI ingestion handler if AI provider is configured
// Register job handlers
jobQueue.registerHandler(createBrowserFetchHandler(library));
jobQueue.registerHandler(createImportIngestHandler(library));

let aiProvider: OpenAiCompatibleProvider | undefined;
let ytdlpAvailable = false;
if (config.PLAINFARE_AI_ENDPOINT) {
  aiProvider = new OpenAiCompatibleProvider(config);
  jobQueue.registerHandler(createAiIngestHandler(aiProvider, library));
  jobQueue.registerHandler(createAiTextIngestHandler(aiProvider, library));
  const visionTag = config.PLAINFARE_AI_VISION_ENDPOINT
    ? ` | vision: ${config.PLAINFARE_AI_VISION_MODEL ?? config.PLAINFARE_AI_MODEL}`
    : "";
  console.log(`AI ingestion enabled (model: ${config.PLAINFARE_AI_MODEL}${visionTag})`);
}

// Telegram bot (optional — only starts if token is configured)
const telegramBot = config.PLAINFARE_TELEGRAM_BOT_TOKEN
  ? createTelegramBot(config, jobQueue)
  : null;

const appRouter = createAppRouter(jobQueue);
const app = new Hono();

// Auth routes (login/logout/status — always public)
app.route("/", createAuthRoutes(config));

// Auth middleware — protects tRPC and recipe images when credentials are configured
const requireAuth = createAuthMiddleware(config);

// Health check
app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    recipes: library.size,
    ai: !!config.PLAINFARE_AI_ENDPOINT,
    ytdlp: ytdlpAvailable,
  }),
);

// tRPC API
app.all("/api/trpc/*", requireAuth, (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: (): AppContext => ({ config, library, aiProvider }),
  });
});

// Serve recipe images from the recipes directory
app.get("/recipes-images/*", requireAuth, async (c) => {
  const filename = c.req.path.replace("/recipes-images/", "");
  if (filename.includes("..") || filename.includes("/")) {
    return c.text("Not found", 404);
  }
  const { readFile: rf } = await import("node:fs/promises");
  const { resolve: res } = await import("node:path");
  try {
    const filePath = res(config.PLAINFARE_RECIPES_DIR, filename);
    const data = await rf(filePath);
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      webp: "image/webp", gif: "image/gif",
    };
    return c.body(data, { headers: { "Content-Type": mimeTypes[ext ?? ""] ?? "application/octet-stream" } });
  } catch {
    return c.text("Not found", 404);
  }
});

// Serve static SPA assets in production
app.use("/assets/*", serveStatic({ root: "./dist/ui" }));

// SPA fallback — serve index.html for any non-API route
app.get("*", async (c) => {
  try {
    const html = await readFile(new URL("../../dist/ui/index.html", import.meta.url), "utf-8");
    return c.html(html);
  } catch {
    return c.text("UI not built. Run: pnpm --filter @plainfare/web build:ui", 404);
  }
});

// Start
async function main() {
  await library.initialize();
  console.log(`Loaded ${library.size} recipes from ${config.PLAINFARE_RECIPES_DIR}`);

  // Register video ingest handler if both AI and yt-dlp are available
  ytdlpAvailable = await isYtDlpAvailable();
  if (ytdlpAvailable && aiProvider) {
    jobQueue.registerHandler(createVideoIngestHandler(aiProvider, library));
    console.log("Video ingestion enabled (yt-dlp found)");
  }

  if (telegramBot) {
    await telegramBot.start();
  }

  if (config.PLAINFARE_USERNAME) {
    console.log("Authentication enabled");
  }

  serve({ fetch: app.fetch, port: config.PLAINFARE_PORT }, () => {
    console.log(`plainfare running at http://localhost:${config.PLAINFARE_PORT}`);
  });
}

// Graceful shutdown
async function shutdown() {
  if (telegramBot) await telegramBot.stop();
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
