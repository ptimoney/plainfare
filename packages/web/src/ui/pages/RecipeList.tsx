import React, { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";

export function RecipeList() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = trpc.recipes.list.useQuery(
    search ? { search } : undefined,
  );

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            fontSize: "1rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
          }}
        />
      </div>

      {isLoading && <p>Loading recipes...</p>}
      {error && <p style={{ color: "red" }}>Error: {error.message}</p>}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {data?.map((entry) => (
          <Link
            key={entry.slug}
            to={`/recipes/${entry.slug}`}
            style={{
              display: "block",
              padding: "1rem",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              background: "#fff",
              color: "inherit",
              textDecoration: "none",
              transition: "box-shadow 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)")}
            onMouseOut={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              {entry.recipe.title}
            </h2>
            {entry.recipe.description && (
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                {entry.recipe.description.length > 100
                  ? entry.recipe.description.slice(0, 100) + "..."
                  : entry.recipe.description}
              </p>
            )}
            {entry.recipe.tags && entry.recipe.tags.length > 0 && (
              <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                {entry.recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "0.7rem",
                      background: "#f0f0f0",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "10px",
                      color: "#555",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>

      {data && data.length === 0 && (
        <p style={{ color: "#888", textAlign: "center", marginTop: "2rem" }}>
          {search
            ? "No recipes match your search."
            : <>No recipes found. <Link to="/ingest" style={{ color: "#2563eb" }}>Import a recipe</Link> to get started.</>
          }
        </p>
      )}
    </div>
  );
}
