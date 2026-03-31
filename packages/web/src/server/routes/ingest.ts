import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import type { JobQueue } from "../jobs/queue.js";

export function createIngestRouter(jobQueue: JobQueue) {
  return router({
    fromImage: publicProcedure
      .input(
        z.object({
          image: z.string(), // base64-encoded
          mimeType: z.string(),
          filename: z.string().optional(),
        }),
      )
      .mutation(({ input }) => {
        const jobId = jobQueue.enqueue("ai-ingest", input);
        return { jobId };
      }),

    fromUrl: publicProcedure
      .input(
        z.object({
          url: z.string().url(),
          useBrowser: z.boolean().optional(),
        }),
      )
      .mutation(({ input }) => {
        const jobId = jobQueue.enqueue("url-ingest", input);
        return { jobId };
      }),
  });
}
