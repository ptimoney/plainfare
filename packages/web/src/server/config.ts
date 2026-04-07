import { z } from "zod";

const configSchema = z.object({
  PLAINFARE_RECIPES_DIR: z.string().default("./recipes"),
  PLAINFARE_PORT: z.coerce.number().default(3141),

  // AI provider (optional — service works without it)
  PLAINFARE_AI_ENDPOINT: z.string().url().optional(),
  PLAINFARE_AI_API_KEY: z.string().optional(),
  PLAINFARE_AI_MODEL: z.string().default("gpt-4o"),

  // Vision model override (optional — falls back to AI provider above for image tasks)
  PLAINFARE_AI_VISION_ENDPOINT: z.string().url().optional(),
  PLAINFARE_AI_VISION_API_KEY: z.string().optional(),
  PLAINFARE_AI_VISION_MODEL: z.string().optional(),

  // Job queue
  PLAINFARE_JOB_CONCURRENCY: z.coerce.number().default(2),

  // Public-facing URL (used in Telegram replies, etc.)
  PLAINFARE_BASE_URL: z.string().url().optional(),

  // Telegram bot (optional — enables mobile ingestion via Telegram)
  PLAINFARE_TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Authentication (optional — when set, all routes require login)
  PLAINFARE_USERNAME: z.string().optional(),
  PLAINFARE_PASSWORD: z.string().optional(),
}).refine(
  (c) => (!c.PLAINFARE_USERNAME && !c.PLAINFARE_PASSWORD) || (!!c.PLAINFARE_USERNAME && !!c.PLAINFARE_PASSWORD),
  { message: "PLAINFARE_USERNAME and PLAINFARE_PASSWORD must both be set or both be unset" },
);

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse(process.env);
}
