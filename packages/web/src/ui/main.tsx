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
import { ShoppingList } from "./pages/ShoppingList.js";
import { Duplicates } from "./pages/Duplicates.js";
import styles from "./main.module.css";

function DuplicatesNavLink() {
  const { data } = trpc.recipes.duplicates.useQuery();
  if (!data || data.length === 0) return null;
  return (
    <Link to="/duplicates" className={styles.navLink}>
      Duplicates ({data.length})
    </Link>
  );
}

function ActiveJobsIndicator() {
  const { data } = trpc.jobs.list.useQuery(
    { status: "running" },
    { refetchInterval: 2000 },
  );
  const { data: pending } = trpc.jobs.list.useQuery(
    { status: "pending" },
    { refetchInterval: 2000 },
  );

  const count = (data?.length ?? 0) + (pending?.length ?? 0);
  if (count === 0) return null;

  return (
    <span className={styles.jobsBadge} title={`${count} active job${count > 1 ? "s" : ""}`}>
      {count}
    </span>
  );
}

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
          <header className={styles.header}>
            <h1 className={styles.logo}>
              <a href="/">plainfare</a>
            </h1>
            <nav className={styles.nav}>
              <Link to="/shopping" className={styles.navLink}>Shopping List</Link>
              <DuplicatesNavLink />
              <Link to="/ingest" className={styles.addButton}>+ Add Recipe <ActiveJobsIndicator /></Link>
            </nav>
          </header>
          <Routes>
            <Route path="/" element={<RecipeList />} />
            <Route path="/ingest" element={<Ingest />} />
            <Route path="/shopping" element={<ShoppingList />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="/recipes/:slug" element={<RecipeDetail />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
