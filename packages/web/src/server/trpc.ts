import { initTRPC } from "@trpc/server";
import type { Config } from "./config.js";
import type { RecipeLibrary } from "./services/library.js";
import type { AiProvider } from "@plainfare/core";

export interface AppContext {
  config: Config;
  library: RecipeLibrary;
  aiProvider?: AiProvider;
}

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
