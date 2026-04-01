import { z } from "zod";

const configSchema = z.object({
  PLAINFARE_RECIPES_DIR: z.string().default("./recipes"),
  PLAINFARE_PORT: z.coerce.number().default(3141),

  // AI provider (optional — service works without it)
  PLAINFARE_AI_ENDPOINT: z.string().url().optional(),
  PLAINFARE_AI_API_KEY: z.string().optional(),
  PLAINFARE_AI_MODEL: z.string().default("gpt-4o"),

  // Job queue
  PLAINFARE_JOB_CONCURRENCY: z.coerce.number().default(2),

  // Public-facing URL (used in Telegram replies, etc.)
  PLAINFARE_BASE_URL: z.string().url().optional(),

  // Telegram bot (optional — enables mobile ingestion via Telegram)
  PLAINFARE_TELEGRAM_BOT_TOKEN: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse(process.env);
}
