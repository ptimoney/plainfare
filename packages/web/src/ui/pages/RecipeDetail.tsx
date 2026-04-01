import { useParams, Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { Tag } from "../components/Tag.js";
import type { Recipe } from "@plainfare/core";
import styles from "./RecipeDetail.module.css";

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

function RecipeHeader({ recipe }: { recipe: Recipe }) {
  return (
    <>
      <h1 className={styles.title}>{recipe.title}</h1>
      {recipe.description && <p className={styles.description}>{recipe.description}</p>}
      <div className={styles.metadata}>
        {recipe.serves && <span>Serves {recipe.serves}</span>}
        {recipe.time?.prep != null && <span>{recipe.time.prep} min prep</span>}
        {recipe.time?.cook != null && <span>{recipe.time.cook} min cook</span>}
        {recipe.source && (
          <a href={recipe.source} target="_blank" rel="noopener noreferrer">Source</a>
        )}
      </div>
      {recipe.tags && recipe.tags.length > 0 && (
        <div className={styles.tags}>
          {recipe.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </div>
      )}
    </>
  );
}

function IngredientList({ groups }: { groups: Recipe["ingredientGroups"] }) {
  if (groups.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Ingredients</h2>
      {groups.map((group, gi) => (
        <div key={gi} className={styles.ingredientGroup}>
          {group.title && <h3 className={styles.ingredientGroupTitle}>{group.title}</h3>}
          <ul className={styles.list}>
            {group.ingredients.map((ing, ii) => (
              <li key={ii}>{formatIngredient(ing)}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function MethodSteps({ steps }: { steps: Recipe["steps"] }) {
  if (steps.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Method</h2>
      <ol className={styles.orderedList}>
        {steps.map((step) => (
          <li key={step.number}>
            {step.paragraphs.map((p, pi) => (
              <p key={pi} className={pi < step.paragraphs.length - 1 ? styles.stepParagraph : undefined}>
                {p}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}

function NutritionSummary({ nutrition }: { nutrition: Recipe["nutrition"] }) {
  if (!nutrition) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Nutrition</h2>
      <div className={styles.nutritionRow}>
        {nutrition.calories != null && <span>{nutrition.calories} cal</span>}
        {nutrition.protein != null && <span>{nutrition.protein}g protein</span>}
        {nutrition.carbs != null && <span>{nutrition.carbs}g carbs</span>}
        {nutrition.fat != null && <span>{nutrition.fat}g fat</span>}
        {nutrition.fibre != null && <span>{nutrition.fibre}g fibre</span>}
      </div>
    </section>
  );
}

function RecipeNotes({ notes }: { notes?: string }) {
  if (!notes) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Notes</h2>
      <p className={styles.notes}>{notes}</p>
    </section>
  );
}

export function RecipeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = trpc.recipes.get.useQuery(
    { slug: slug! },
    { enabled: !!slug },
  );

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className={styles.error}>Error: {error.message}</p>;
  if (!data) return <p>Recipe not found.</p>;

  const { recipe } = data;

  return (
    <article>
      <Link to="/" className={styles.backLink}>&larr; All recipes</Link>
      <RecipeHeader recipe={recipe} />
      <IngredientList groups={recipe.ingredientGroups} />
      <MethodSteps steps={recipe.steps} />
      <NutritionSummary nutrition={recipe.nutrition} />
      <RecipeNotes notes={recipe.notes} />
    </article>
  );
}
