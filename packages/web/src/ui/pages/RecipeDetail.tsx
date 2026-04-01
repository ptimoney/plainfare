import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { Tag } from "../components/Tag.js";
import { Button } from "../components/Button.js";
import { scaleRecipe, serialiseRecipe } from "@plainfare/core";
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

function ServingsAdjuster({ serves, onChange }: { serves: number; onChange: (n: number) => void }) {
  return (
    <span className={styles.servingsAdjuster}>
      Serves{" "}
      <button className={styles.servingsBtn} onClick={() => onChange(Math.max(1, serves - 1))}>-</button>
      <span className={styles.servingsValue}>{serves}</span>
      <button className={styles.servingsBtn} onClick={() => onChange(serves + 1)}>+</button>
    </span>
  );
}

function MultiplierSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const options = [1, 2, 3, 4, 5];
  return (
    <span className={styles.servingsAdjuster}>
      {options.map((n) => (
        <button
          key={n}
          className={`${styles.multiplierBtn} ${n === value ? styles.multiplierActive : ""}`}
          onClick={() => onChange(n)}
        >
          {n}x
        </button>
      ))}
    </span>
  );
}

function RecipeHeader({ recipe, targetServings, onServingsChange, multiplier, onMultiplierChange }: {
  recipe: Recipe;
  targetServings: number | null;
  onServingsChange: (n: number) => void;
  multiplier: number;
  onMultiplierChange: (n: number) => void;
}) {
  const hasServes = targetServings != null;
  return (
    <>
      <h1 className={styles.title}>{recipe.title}</h1>
      {recipe.description && <p className={styles.description}>{recipe.description}</p>}
      <div className={styles.metadata}>
        {hasServes ? (
          <ServingsAdjuster serves={targetServings} onChange={onServingsChange} />
        ) : (
          <MultiplierSelector value={multiplier} onChange={onMultiplierChange} />
        )}
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

function RecipeEditor({ slug, initialMarkdown, onSaved, onCancel }: {
  slug: string;
  initialMarkdown: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const updateMutation = trpc.recipes.update.useMutation({ onSuccess: onSaved });

  return (
    <div className={styles.editor}>
      <textarea
        className={styles.editorTextarea}
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        spellCheck
      />
      <div className={styles.editorActions}>
        <Button onClick={() => updateMutation.mutate({ slug, markdown })}>
          {updateMutation.isPending ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        {updateMutation.isError && (
          <span className={styles.error}>{updateMutation.error.message}</span>
        )}
      </div>
    </div>
  );
}

function DeleteButton({ slug }: { slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();
  const deleteMutation = trpc.recipes.delete.useMutation({
    onSuccess: () => navigate("/"),
  });

  if (confirming) {
    return (
      <span className={styles.deleteConfirm}>
        Delete this recipe?{" "}
        <Button variant="secondary" onClick={() => deleteMutation.mutate({ slug })}>
          {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>No</Button>
      </span>
    );
  }

  return <Button variant="secondary" onClick={() => setConfirming(true)}>Delete</Button>;
}

export function RecipeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.recipes.get.useQuery(
    { slug: slug! },
    { enabled: !!slug },
  );

  const [editing, setEditing] = useState(false);
  const originalServings = data?.recipe.serves ? parseInt(data.recipe.serves, 10) : null;
  const hasNumericServes = originalServings != null && !isNaN(originalServings);
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState(1);

  const recipe = useMemo(() => {
    if (!data) return null;
    if (hasNumericServes) {
      if (targetServings == null || targetServings === originalServings) return data.recipe;
      return scaleRecipe(data.recipe, targetServings);
    }
    if (multiplier === 1) return data.recipe;
    return scaleRecipe(data.recipe, multiplier);
  }, [data, targetServings, hasNumericServes, originalServings, multiplier]);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className={styles.error}>Error: {error.message}</p>;
  if (!recipe) return <p>Recipe not found.</p>;

  if (editing) {
    return (
      <article>
        <Link to="/" className={styles.backLink}>&larr; All recipes</Link>
        <h1 className={styles.title}>{recipe.title}</h1>
        <RecipeEditor
          slug={slug!}
          initialMarkdown={serialiseRecipe(data!.recipe)}
          onSaved={() => {
            setEditing(false);
            utils.recipes.get.invalidate({ slug: slug! });
          }}
          onCancel={() => setEditing(false)}
        />
      </article>
    );
  }

  return (
    <article>
      <Link to="/" className={styles.backLink}>&larr; All recipes</Link>
      <div className={styles.headerActions}>
        <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
        <DeleteButton slug={slug!} />
      </div>
      <RecipeHeader
        recipe={recipe}
        targetServings={hasNumericServes ? (targetServings ?? originalServings) : null}
        onServingsChange={setTargetServings}
        multiplier={multiplier}
        onMultiplierChange={setMultiplier}
      />
      <IngredientList groups={recipe.ingredientGroups} />
      <MethodSteps steps={recipe.steps} />
      <NutritionSummary nutrition={recipe.nutrition} />
      <RecipeNotes notes={recipe.notes} />
    </article>
  );
}
