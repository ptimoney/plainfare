import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { Button } from "../components/Button.js";
import styles from "./Duplicates.module.css";

export function Duplicates() {
  const utils = trpc.useUtils();
  const { data: candidates, isLoading } = trpc.recipes.duplicates.useQuery();
  const deleteMutation = trpc.recipes.delete.useMutation({
    onSuccess: () => {
      utils.recipes.duplicates.invalidate();
    },
  });

  if (isLoading) return <p>Scanning for duplicates...</p>;

  return (
    <div>
      <Link to="/" className={styles.backLink}>&larr; All recipes</Link>
      <h1 className={styles.title}>Duplicate Recipes</h1>

      {!candidates || candidates.length === 0 ? (
        <p className={styles.empty}>No duplicate recipes found.</p>
      ) : (
        <p>{candidates.length} potential duplicate{candidates.length !== 1 ? "s" : ""} found.</p>
      )}

      {candidates?.map((pair) => (
        <div key={`${pair.slugA}-${pair.slugB}`} className={styles.pair}>
          <div className={styles.pairTitles}>
            <div className={styles.recipeTitle}>
              <Link to={`/recipes/${pair.slugA}`}>{pair.titleA}</Link>
            </div>
            <span className={styles.vs}>vs</span>
            <div className={styles.recipeTitle}>
              <Link to={`/recipes/${pair.slugB}`}>{pair.titleB}</Link>
            </div>
          </div>
          <div className={styles.similarity}>
            <span>Title: {Math.round(pair.titleSimilarity * 100)}%</span>
            <span>Ingredients: {Math.round(pair.ingredientSimilarity * 100)}%</span>
            <span>Overall: {Math.round(pair.combinedScore * 100)}%</span>
          </div>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => deleteMutation.mutate({ slug: pair.slugB })}
            >
              Keep "{pair.titleA}"
            </Button>
            <Button
              variant="secondary"
              onClick={() => deleteMutation.mutate({ slug: pair.slugA })}
            >
              Keep "{pair.titleB}"
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
