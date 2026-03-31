import { trpc } from "../lib/trpc.js";

export function useJobPolling(jobId: string | null) {
  const query = trpc.jobs.get.useQuery(
    { id: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "pending" || status === "running") return 1000;
        return false;
      },
    },
  );

  const job = query.data;
  const isPolling = !!jobId && (job?.status === "pending" || job?.status === "running");
  const isComplete = job?.status === "completed";
  const isFailed = job?.status === "failed";

  return { job, isPolling, isComplete, isFailed };
}
