import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { Input } from "../components/Input.js";
import { Card } from "../components/Card.js";
import { Tag } from "../components/Tag.js";
import styles from "./RecipeList.module.css";

export function RecipeList() {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const query: { search?: string; tags?: string[] } | undefined =
    search || selectedTags.length > 0
      ? { ...(search && { search }), ...(selectedTags.length > 0 && { tags: selectedTags }) }
      : undefined;

  const { data, isLoading, error } = trpc.recipes.list.useQuery(query);

  // Fetch all recipes (unfiltered) to build the complete tag list with counts
  const { data: allRecipes } = trpc.recipes.list.useQuery(undefined);
  const tagCounts = useMemo(() => {
    if (!allRecipes) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const entry of allRecipes) {
      entry.recipe.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    }
    return counts;
  }, [allRecipes]);

  const allTags = useMemo(() => {
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [tagCounts]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

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

      {allTags.length > 0 && (
        <div className={styles.tagFilter}>
          {allTags.map((tag) => {
            const count = tagCounts.get(tag) ?? 0;
            return (
              <Tag key={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)}>
                {tag}{count > 1 && ` (${count})`}
              </Tag>
            );
          })}
        </div>
      )}

      {isLoading && <p>Loading recipes...</p>}
      {error && <p className={styles.error}>Error: {error.message}</p>}

      <div className={styles.grid}>
        {data?.map((entry) => (
          <Card key={entry.slug} to={`/recipes/${entry.slug}`}>
            {entry.recipe.image && (
              <img className={styles.cardImage} src={entry.recipe.image} alt={entry.recipe.title} loading="lazy" />
            )}
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
                {entry.recipe.tags
                  .slice()
                  .sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0))
                  .slice(0, 3)
                  .map((tag) => (
                    <Tag
                      key={tag}
                      active={selectedTags.includes(tag)}
                      onClick={(e) => { e.preventDefault(); toggleTag(tag); }}
                    >
                      {tag}
                    </Tag>
                  ))}
                {entry.recipe.tags.length > 3 && (
                  <span className={styles.moreTag}>+{entry.recipe.tags.length - 3}</span>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {data && data.length === 0 && (
        <p className={styles.empty}>
          {search || selectedTags.length > 0
            ? "No recipes match your filters."
            : <>No recipes found. <Link to="/ingest">Import a recipe</Link> to get started.</>
          }
        </p>
      )}
    </div>
  );
}
