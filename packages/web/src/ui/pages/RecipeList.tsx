import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { Input } from "../components/Input.js";
import { Card } from "../components/Card.js";
import { Tag } from "../components/Tag.js";
import styles from "./RecipeList.module.css";

export function RecipeList() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = trpc.recipes.list.useQuery(
    search ? { search } : undefined,
  );

  return (
    <div>
      <div className={styles.search}>
        <Input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && <p>Loading recipes...</p>}
      {error && <p className={styles.error}>Error: {error.message}</p>}

      <div className={styles.grid}>
        {data?.map((entry) => (
          <Card key={entry.slug} to={`/recipes/${entry.slug}`}>
            <h2 className={styles.cardTitle}>{entry.recipe.title}</h2>
            {entry.recipe.description && (
              <p className={styles.cardDescription}>
                {entry.recipe.description.length > 100
                  ? entry.recipe.description.slice(0, 100) + "..."
                  : entry.recipe.description}
              </p>
            )}
            {entry.recipe.tags && entry.recipe.tags.length > 0 && (
              <div className={styles.tags}>
                {entry.recipe.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {data && data.length === 0 && (
        <p className={styles.empty}>
          {search
            ? "No recipes match your search."
            : <>No recipes found. <Link to="/ingest">Import a recipe</Link> to get started.</>
          }
        </p>
      )}
    </div>
  );
}
