import { describe, it, expect } from "vitest";
import { JobQueue } from "../src/server/jobs/queue.js";

describe("JobQueue", () => {
  it("enqueues and executes a job", async () => {
    const queue = new JobQueue(1);
    queue.registerHandler({
      type: "test",
      async execute(input: { value: number }, report) {
        report(50);
        return { result: input.value * 2 };
      },
    });

    const id = queue.enqueue("test", { value: 21 });
    const job = queue.getJob(id);
    expect(job).toBeDefined();
    expect(job!.type).toBe("test");

    // Wait for job to complete
    await new Promise<void>((resolve) => {
      queue.on("job:completed", (j) => {
        if (j.id === id) resolve();
      });
    });

    const completed = queue.getJob(id)!;
    expect(completed.status).toBe("completed");
    expect(completed.output).toEqual({ result: 42 });
    expect(completed.progress).toBe(100);
  });

  it("handles job failures", async () => {
    const queue = new JobQueue(1);
    queue.registerHandler({
      type: "fail",
      async execute() {
        throw new Error("Something went wrong");
      },
    });

    const id = queue.enqueue("fail", {});

    await new Promise<void>((resolve) => {
      queue.on("job:failed", (j) => {
        if (j.id === id) resolve();
      });
    });

    const failed = queue.getJob(id)!;
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("Something went wrong");
  });

  it("respects concurrency limits", async () => {
    const queue = new JobQueue(1);
    let running = 0;
    let maxRunning = 0;

    queue.registerHandler({
      type: "slow",
      async execute() {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
        return {};
      },
    });

    const id1 = queue.enqueue("slow", {});
    const id2 = queue.enqueue("slow", {});

    await new Promise<void>((resolve) => {
      let done = 0;
      queue.on("job:completed", () => {
        done++;
        if (done === 2) resolve();
      });
    });

    expect(maxRunning).toBe(1);
    expect(queue.getJob(id1)!.status).toBe("completed");
    expect(queue.getJob(id2)!.status).toBe("completed");
  });

  it("lists jobs with filters", () => {
    const queue = new JobQueue(0); // concurrency 0 so jobs stay pending
    queue.registerHandler({ type: "a", async execute() { return {}; } });
    queue.registerHandler({ type: "b", async execute() { return {}; } });

    queue.enqueue("a", {});
    queue.enqueue("b", {});
    queue.enqueue("a", {});

    expect(queue.listJobs()).toHaveLength(3);
    expect(queue.listJobs({ type: "a" })).toHaveLength(2);
    expect(queue.listJobs({ type: "b" })).toHaveLength(1);
    expect(queue.listJobs({ status: "pending" })).toHaveLength(3);
  });

  it("throws when enqueuing unknown job type", () => {
    const queue = new JobQueue(1);
    expect(() => queue.enqueue("unknown", {})).toThrow("No handler registered");
  });
});
