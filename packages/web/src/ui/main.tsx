import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./lib/trpc.js";
import { Link } from "react-router-dom";
import { RecipeList } from "./pages/RecipeList.js";
import { RecipeDetail } from "./pages/RecipeDetail.js";
import { Ingest } from "./pages/Ingest.js";

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: "/api/trpc" })],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
              <a href="/" style={{ color: "inherit" }}>mise</a>
            </h1>
            <Link
              to="/ingest"
              style={{
                padding: "0.4rem 1rem",
                background: "#2563eb",
                color: "white",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "0.85rem",
              }}
            >
              + Add Recipe
            </Link>
          </header>
          <Routes>
            <Route path="/" element={<RecipeList />} />
            <Route path="/ingest" element={<Ingest />} />
            <Route path="/recipes/:slug" element={<RecipeDetail />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
