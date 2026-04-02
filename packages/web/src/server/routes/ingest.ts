import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import type { JobQueue } from "../jobs/queue.js";

export function createIngestRouter(jobQueue: JobQueue) {
  return router({
    fromImage: publicProcedure
      .input(
        z.object({
          image: z.string().max(10_000_000, "Image must be under 10MB"), // base64-encoded
          mimeType: z.string(),
          filename: z.string().optional(),
        }),
      )
      .mutation(({ input }) => {
        const jobId = jobQueue.enqueue("ai-ingest", input);
        return { jobId };
      }),

    fromText: publicProcedure
      .input(
        z.object({
          text: z.string().min(1),
        }),
      )
      .mutation(({ input }) => {
        const jobId = jobQueue.enqueue("ai-text-ingest", input);
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

    fromImport: publicProcedure
      .input(
        z.object({
          data: z.string().max(50_000_000, "Import file must be under 50MB"),
          filename: z.string(),
        }),
      )
      .mutation(({ input }) => {
        const jobId = jobQueue.enqueue("import-ingest", input);
        return { jobId };
      }),

    fromVideo: publicProcedure
      .input(
        z.object({
          url: z.string().url(),
        }),
      )
      .mutation(({ input }) => {
        const jobId = jobQueue.enqueue("video-ingest", input);
        return { jobId };
      }),
  });
}
