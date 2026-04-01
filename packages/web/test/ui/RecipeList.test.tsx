import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "../../src/ui/lib/trpc.js";

function renderWithTrpc(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
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

// Import after setup
import { RecipeList } from "../../src/ui/pages/RecipeList.js";

describe("RecipeList", () => {
  it("renders loading state initially", () => {
    renderWithTrpc(<RecipeList />);
    expect(screen.getByText("Loading recipes...")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderWithTrpc(<RecipeList />);
    const inputs = screen.getAllByPlaceholderText("Search recipes...");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});
