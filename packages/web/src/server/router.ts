import { router } from "./trpc.js";
import { recipesRouter } from "./routes/recipes.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createJobsRouter } from "./routes/jobs.js";
import type { JobQueue } from "./jobs/queue.js";

export function createAppRouter(jobQueue: JobQueue) {
  return router({
    recipes: recipesRouter,
    ingest: createIngestRouter(jobQueue),
    jobs: createJobsRouter(jobQueue),
  });
}

// Export the type for the tRPC client — uses a dummy queue for type inference only
type _Router = ReturnType<typeof createAppRouter>;
export type AppRouter = _Router;
