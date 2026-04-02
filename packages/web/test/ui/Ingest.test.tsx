import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "../../src/ui/lib/trpc.js";
import { Ingest } from "../../src/ui/pages/Ingest.js";

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
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

describe("Ingest", () => {
  it("renders the page title", () => {
    renderWithTrpc(<Ingest />);
    expect(screen.getByText("Add Recipe")).toBeInTheDocument();
  });

  it("renders all ingestion tabs", () => {
    renderWithTrpc(<Ingest />);
    expect(screen.getByText("From URL")).toBeInTheDocument();
    expect(screen.getByText("Batch URLs")).toBeInTheDocument();
    expect(screen.getByText("From Text")).toBeInTheDocument();
    expect(screen.getByText("From Image")).toBeInTheDocument();
    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("From Video")).toBeInTheDocument();
  });

  it("shows URL form by default", () => {
    renderWithTrpc(<Ingest />);
    expect(screen.getByPlaceholderText("https://example.com/recipe")).toBeInTheDocument();
  });
});
