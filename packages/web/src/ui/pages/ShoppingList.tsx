import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { generateShoppingList } from "@plainfare/core";
import type { ShoppingItem } from "@plainfare/core";
import { Button } from "../components/Button.js";
import styles from "./ShoppingList.module.css";

function formatQuantities(item: ShoppingItem): string {
  if (item.quantities.length === 0) return "";
  return item.quantities
    .map((q) => (q.unit ? `${q.quantity}${q.unit}` : String(q.quantity)))
    .join(" + ");
}

export function ShoppingList() {
  const { data: recipes } = trpc.recipes.list.useQuery(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const selectedRecipes = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter((e) => selected.has(e.slug));
  }, [recipes, selected]);

  const items = useMemo(() => {
    return generateShoppingList(selectedRecipes.map((e) => e.recipe));
  }, [selectedRecipes]);

  function toggleRecipe(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setChecked(new Set());
  }

  function toggleChecked(name: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function copyToClipboard() {
    const lines = items.map((item) => {
      const qty = formatQuantities(item);
      const note = item.note ? `, ${item.note}` : "";
      return `- [ ] ${qty ? qty + " " : ""}${item.name}${note}`;
    });
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div>
      <Link to="/" className={styles.backLink}>&larr; All recipes</Link>
      <h1 className={styles.title}>Shopping List</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Select recipes</h2>
        <div className={styles.recipeGrid}>
          {recipes?.map((entry) => (
            <label key={entry.slug} className={styles.recipeOption}>
              <input
                type="checkbox"
                checked={selected.has(entry.slug)}
                onChange={() => toggleRecipe(entry.slug)}
              />
              <span>{entry.recipe.title}</span>
            </label>
          ))}
        </div>
      </section>

      {items.length > 0 && (
        <section className={styles.section}>
          <div className={styles.listHeader}>
            <h2 className={styles.sectionTitle}>
              {items.length} items from {selected.size} {selected.size === 1 ? "recipe" : "recipes"}
            </h2>
            <Button variant="secondary" onClick={copyToClipboard}>Copy</Button>
          </div>
          <ul className={styles.shoppingList}>
            {items.map((item) => {
              const qty = formatQuantities(item);
              const isChecked = checked.has(item.name.toLowerCase());
              return (
                <li
                  key={item.name}
                  className={`${styles.shoppingItem} ${isChecked ? styles.checked : ""}`}
                  onClick={() => toggleChecked(item.name.toLowerCase())}
                >
                  <span className={styles.checkbox}>{isChecked ? "\u2611" : "\u2610"}</span>
                  <span>
                    {qty && <strong>{qty}</strong>}{" "}
                    {item.name}
                    {item.note && <span className={styles.note}>, {item.note}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
