import { describe, it, expect } from "vitest";
import { createIngestRouter } from "../../src/server/routes/ingest.js";
import { JobQueue } from "../../src/server/jobs/queue.js";
import { initTRPC } from "@trpc/server";
import type { AppContext } from "../../src/server/trpc.js";

const t = initTRPC.context<AppContext>().create();

function setup() {
  const jobQueue = new JobQueue(0); // concurrency 0 so jobs stay pending
  // Register handlers so enqueue doesn't throw
  jobQueue.registerHandler({ type: "url-ingest", async execute() { return {}; } });
  jobQueue.registerHandler({ type: "ai-text-ingest", async execute() { return {}; } });
  jobQueue.registerHandler({ type: "ai-ingest", async execute() { return {}; } });

  const router = createIngestRouter(jobQueue);
  const caller = t.createCallerFactory(router);
  const ctx = { library: {} as AppContext["library"], config: {} as AppContext["config"] };
  return { trpc: caller(ctx), jobQueue };
}

describe("ingest router", () => {
  it("fromUrl enqueues a url-ingest job", async () => {
    const { trpc, jobQueue } = setup();
    const result = await trpc.fromUrl({ url: "https://example.com/recipe" });

    expect(result.jobId).toBeDefined();
    const job = jobQueue.getJob(result.jobId);
    expect(job).toBeDefined();
    expect(job!.type).toBe("url-ingest");
  });

  it("fromText enqueues an ai-text-ingest job", async () => {
    const { trpc, jobQueue } = setup();
    const result = await trpc.fromText({ text: "A recipe for soup..." });

    expect(result.jobId).toBeDefined();
    const job = jobQueue.getJob(result.jobId);
    expect(job!.type).toBe("ai-text-ingest");
  });

  it("fromImage enqueues an ai-ingest job", async () => {
    const { trpc, jobQueue } = setup();
    const result = await trpc.fromImage({
      image: "base64data",
      mimeType: "image/jpeg",
    });

    expect(result.jobId).toBeDefined();
    const job = jobQueue.getJob(result.jobId);
    expect(job!.type).toBe("ai-ingest");
  });

  it("fromUrl rejects invalid URLs", async () => {
    const { trpc } = setup();
    await expect(trpc.fromUrl({ url: "not-a-url" })).rejects.toThrow();
  });
});
