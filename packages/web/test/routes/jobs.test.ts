import { describe, it, expect } from "vitest";
import { createJobsRouter } from "../../src/server/routes/jobs.js";
import { JobQueue } from "../../src/server/jobs/queue.js";
import { initTRPC } from "@trpc/server";
import type { AppContext } from "../../src/server/trpc.js";

const t = initTRPC.context<AppContext>().create();

function setup() {
  const jobQueue = new JobQueue(0);
  jobQueue.registerHandler({ type: "test", async execute() { return {}; } });

  const router = createJobsRouter(jobQueue);
  const caller = t.createCallerFactory(router);
  const ctx = { library: {} as AppContext["library"], config: {} as AppContext["config"] };
  return { trpc: caller(ctx), jobQueue };
}

describe("jobs router", () => {
  it("get() returns job by id", async () => {
    const { trpc, jobQueue } = setup();
    const id = jobQueue.enqueue("test", { value: 1 });

    const job = await trpc.get({ id });
    expect(job.id).toBe(id);
    expect(job.type).toBe("test");
    expect(job.status).toBe("pending");
  });

  it("get() throws for unknown job id", async () => {
    const { trpc } = setup();
    await expect(trpc.get({ id: "nonexistent" })).rejects.toThrow("Job not found");
  });

  it("list() returns all jobs", async () => {
    const { trpc, jobQueue } = setup();
    jobQueue.enqueue("test", {});
    jobQueue.enqueue("test", {});

    const jobs = await trpc.list();
    expect(jobs).toHaveLength(2);
  });
});
