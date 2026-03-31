import React from "react";
import { useParams, Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";

export function RecipeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = trpc.recipes.get.useQuery(
    { slug: slug! },
    { enabled: !!slug },
  );

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>;
  if (!data) return <p>Recipe not found.</p>;

  const { recipe } = data;

  return (
    <article>
      <Link to="/" style={{ fontSize: "0.85rem", marginBottom: "1rem", display: "inline-block" }}>
        &larr; All recipes
      </Link>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        {recipe.title}
      </h1>

      {recipe.description && (
        <p style={{ fontSize: "1.05rem", color: "#444", marginBottom: "1rem" }}>
          {recipe.description}
        </p>
      )}

      {/* Metadata */}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem", color: "#666", marginBottom: "1.5rem" }}>
        {recipe.serves && <span>Serves {recipe.serves}</span>}
        {recipe.time?.prep != null && <span>{recipe.time.prep} min prep</span>}
        {recipe.time?.cook != null && <span>{recipe.time.cook} min cook</span>}
        {recipe.source && (
          <a href={recipe.source} target="_blank" rel="noopener noreferrer">
            Source
          </a>
        )}
      </div>

      {recipe.tags && recipe.tags.length > 0 && (
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "0.75rem",
                background: "#f0f0f0",
                padding: "0.2rem 0.6rem",
                borderRadius: "10px",
                color: "#555",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredientGroups.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.75rem" }}>Ingredients</h2>
          {recipe.ingredientGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: "1rem" }}>
              {group.title && (
                <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>{group.title}</h3>
              )}
              <ul style={{ paddingLeft: "1.25rem" }}>
                {group.ingredients.map((ing, ii) => (
                  <li key={ii} style={{ marginBottom: "0.15rem" }}>
                    {formatIngredient(ing)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Method */}
      {recipe.steps.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.75rem" }}>Method</h2>
          <ol style={{ paddingLeft: "1.25rem" }}>
            {recipe.steps.map((step) => (
              <li key={step.number} style={{ marginBottom: "0.75rem" }}>
                {step.paragraphs.map((p, pi) => (
                  <p key={pi} style={{ marginBottom: pi < step.paragraphs.length - 1 ? "0.5rem" : 0 }}>
                    {p}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Nutrition */}
      {recipe.nutrition && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.5rem" }}>Nutrition</h2>
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "#555" }}>
            {recipe.nutrition.calories != null && <span>{recipe.nutrition.calories} cal</span>}
            {recipe.nutrition.protein != null && <span>{recipe.nutrition.protein}g protein</span>}
            {recipe.nutrition.carbs != null && <span>{recipe.nutrition.carbs}g carbs</span>}
            {recipe.nutrition.fat != null && <span>{recipe.nutrition.fat}g fat</span>}
            {recipe.nutrition.fibre != null && <span>{recipe.nutrition.fibre}g fibre</span>}
          </div>
        </section>
      )}

      {/* Notes */}
      {recipe.notes && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.5rem" }}>Notes</h2>
          <p style={{ color: "#444" }}>{recipe.notes}</p>
        </section>
      )}
    </article>
  );
}

function formatIngredient(ing: { quantity?: number; unit?: string; name: string; note?: string }): string {
  let result = "";
  if (ing.quantity != null && ing.unit) {
    result = `${ing.quantity}${ing.unit} ${ing.name}`;
  } else if (ing.quantity != null) {
    result = `${ing.quantity} ${ing.name}`;
  } else {
    result = ing.name;
  }
  if (ing.note) result += `, ${ing.note}`;
  return result;
}
