import { z } from "zod";

const configSchema = z.object({
  MISE_RECIPES_DIR: z.string().default("./recipes"),
  MISE_PORT: z.coerce.number().default(3000),

  // AI provider (optional — service works without it)
  MISE_AI_ENDPOINT: z.string().url().optional(),
  MISE_AI_API_KEY: z.string().optional(),
  MISE_AI_MODEL: z.string().default("gpt-4o"),

  // Job queue
  MISE_JOB_CONCURRENCY: z.coerce.number().default(2),

  // Public-facing URL (used in Telegram replies, etc.)
  MISE_BASE_URL: z.string().url().optional(),

  // Telegram bot (optional — enables mobile ingestion via Telegram)
  MISE_TELEGRAM_BOT_TOKEN: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse(process.env);
}
