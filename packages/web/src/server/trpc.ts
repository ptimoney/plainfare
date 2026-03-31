import { initTRPC } from "@trpc/server";
import type { Config } from "./config.js";
import type { RecipeLibrary } from "./services/library.js";

export interface AppContext {
  config: Config;
  library: RecipeLibrary;
}

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
