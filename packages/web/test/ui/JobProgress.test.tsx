import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "../../src/ui/lib/trpc.js";

function renderWithTrpc(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: "http://localhost:9999/api/trpc" })],
  });

  return render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

import { JobProgress } from "../../src/ui/components/JobProgress.js";

describe("JobProgress", () => {
  it("renders nothing when jobId is null", () => {
    const { container } = renderWithTrpc(
      <JobProgress jobId={null} onReset={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
