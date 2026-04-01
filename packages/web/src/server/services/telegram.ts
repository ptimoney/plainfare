import { Bot } from "grammy";
import type { JobQueue, Job } from "../jobs/queue.js";
import type { Config } from "../config.js";

interface PendingReply {
  chatId: number;
  messageId: number;
}

interface IngestOutput {
  slug: string;
  recipe: { title: string };
}

export function createTelegramBot(config: Config, jobQueue: JobQueue) {
  const bot = new Bot(config.PLAINFARE_TELEGRAM_BOT_TOKEN!);
  const pendingReplies = new Map<string, PendingReply>();
  const baseUrl = config.PLAINFARE_BASE_URL ?? `http://localhost:${config.PLAINFARE_PORT}`;

  // --- Message handlers ---

  bot.command("start", (ctx) =>
    ctx.reply(
      "Hi! Send me a recipe URL, paste recipe text, or share a photo of a recipe and I'll save it to your collection.",
    ),
  );

  bot.on("message:photo", async (ctx) => {
    const status = await ctx.reply("Got your photo! Extracting recipe...", {
      reply_parameters: { message_id: ctx.message.message_id },
    });

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${config.PLAINFARE_TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        await ctx.api.editMessageText(status.chat.id, status.message_id, "Failed to download photo.");
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString("base64");
      const mimeType = file.file_path?.endsWith(".png") ? "image/png" : "image/jpeg";

      const jobId = jobQueue.enqueue("ai-ingest", {
        image: base64,
        mimeType,
        filename: file.file_path,
      });

      pendingReplies.set(jobId, {
        chatId: status.chat.id,
        messageId: ctx.message.message_id,
      });
    } catch (err) {
      await ctx.api.editMessageText(
        status.chat.id,
        status.message_id,
        `Something went wrong: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const urlMatch = text.match(/https?:\/\/[^\s]+/);

    if (urlMatch) {
      const status = await ctx.reply(`Got it! Fetching recipe from ${urlMatch[0]}...`, {
        reply_parameters: { message_id: ctx.message.message_id },
      });

      const jobId = jobQueue.enqueue("url-ingest", {
        url: urlMatch[0],
        useBrowser: false,
      });

      pendingReplies.set(jobId, {
        chatId: status.chat.id,
        messageId: ctx.message.message_id,
      });
    } else {
      const status = await ctx.reply("Got your text! Extracting recipe...", {
        reply_parameters: { message_id: ctx.message.message_id },
      });

      const jobId = jobQueue.enqueue("ai-text-ingest", { text });

      pendingReplies.set(jobId, {
        chatId: status.chat.id,
        messageId: ctx.message.message_id,
      });
    }
  });

  // --- Job completion listeners ---

  function onJobCompleted(job: Job) {
    const reply = pendingReplies.get(job.id);
    if (!reply) return;
    pendingReplies.delete(job.id);

    const output = job.output as IngestOutput;
    const recipeUrl = `${baseUrl}/recipes/${output.slug}`;

    bot.api.sendMessage(reply.chatId, `Recipe saved: "${output.recipe.title}"\n${recipeUrl}`, {
      reply_parameters: { message_id: reply.messageId },
    });
  }

  function onJobFailed(job: Job) {
    const reply = pendingReplies.get(job.id);
    if (!reply) return;
    pendingReplies.delete(job.id);

    bot.api.sendMessage(reply.chatId, `Sorry, extraction failed: ${job.error}`, {
      reply_parameters: { message_id: reply.messageId },
    });
  }

  // --- Lifecycle ---

  return {
    async start() {
      jobQueue.on("job:completed", onJobCompleted);
      jobQueue.on("job:failed", onJobFailed);
      bot.start({ onStart: () => console.log("Telegram bot started") });
    },
    async stop() {
      jobQueue.off("job:completed", onJobCompleted);
      jobQueue.off("job:failed", onJobFailed);
      await bot.stop();
    },
  };
}
