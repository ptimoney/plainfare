import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export interface Job<TInput = unknown, TOutput = unknown> {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  input: TInput;
  output?: TOutput;
  error?: string;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface JobHandler<TInput = unknown, TOutput = unknown> {
  type: string;
  execute(input: TInput, report: (progress: number) => void): Promise<TOutput>;
}

export class JobQueue extends EventEmitter {
  private jobs = new Map<string, Job>();
  private handlers = new Map<string, JobHandler>();
  private running = 0;
  private pending: string[] = [];

  constructor(private concurrency: number = 2) {
    super();
  }

  registerHandler(handler: JobHandler): void {
    this.handlers.set(handler.type, handler);
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  enqueue<TInput>(type: string, input: TInput): string {
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for job type: ${type}`);
    }

    const id = randomUUID();
    const job: Job<TInput> = {
      id,
      type,
      status: "pending",
      input,
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    this.pending.push(id);
    this.emit("job:created", job);
    this.drain();

    return id;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  listJobs(filter?: { type?: string; status?: string }): Job[] {
    let results = Array.from(this.jobs.values());
    if (filter?.type) results = results.filter((j) => j.type === filter.type);
    if (filter?.status) results = results.filter((j) => j.status === filter.status);
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private drain(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const id = this.pending.shift()!;
      const job = this.jobs.get(id);
      if (!job) continue;
      this.runJob(job);
    }
  }

  private async runJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) return;

    this.running++;
    job.status = "running";
    job.startedAt = new Date();
    this.emit("job:started", job);

    try {
      const output = await handler.execute(job.input, (progress: number) => {
        job.progress = progress;
        this.emit("job:progress", job);
      });

      job.status = "completed";
      job.output = output;
      job.progress = 100;
      job.completedAt = new Date();
      this.emit("job:completed", job);
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = new Date();
      this.emit("job:failed", job);
    } finally {
      this.running--;
      this.drain();
    }
  }
}
