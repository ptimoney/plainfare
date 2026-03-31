import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import type { JobQueue } from "../jobs/queue.js";

export function createJobsRouter(jobQueue: JobQueue) {
  return router({
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        const job = jobQueue.getJob(input.id);
        if (!job) throw new Error(`Job not found: ${input.id}`);
        return job;
      }),

    list: publicProcedure
      .input(
        z.object({
          type: z.string().optional(),
          status: z.string().optional(),
        }).optional(),
      )
      .query(({ input }) => {
        return jobQueue.listJobs(input ?? undefined);
      }),
  });
}
