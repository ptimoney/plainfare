import type { Recipe } from "../types.js";

const SCALED_RE = /Scaled: (\d+(?:\.\d+)?)x from original/;

/**
 * Scale a recipe to a target number of servings.
 * Returns a new Recipe with quantities and nutrition adjusted.
 *
 * If the recipe has no parseable numeric serves value, the multiplier
 * is tracked via a "Scaled: Nx from original" note. Successive scalings
 * compound the multiplier (3x then 2x = 6x from original).
 */
export function scaleRecipe(recipe: Recipe, targetServings: number): Recipe {
  const currentServings = parseServings(recipe.serves);
  const hasServes = currentServings != null;
  const ratio = hasServes
    ? targetServings / currentServings
    : targetServings; // treat as multiplier if no base

  const scaled: Recipe = {
    ...recipe,
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      ingredients: group.ingredients.map((ing) => ({
        ...ing,
        ...(ing.quantity != null && { quantity: roundQuantity(ing.quantity * ratio) }),
      })),
    })),
  };

  if (hasServes) {
    scaled.serves = String(targetServings);
  } else {
    // No serves field — track cumulative multiplier in notes
    const existingMultiplier = parseScaleNote(recipe.notes);
    const cumulativeMultiplier = existingMultiplier != null
      ? roundQuantity(existingMultiplier * targetServings)
      : targetServings;
    scaled.notes = updateScaleNote(recipe.notes, cumulativeMultiplier);
  }

  if (recipe.nutrition) {
    scaled.nutrition = scaleNutrition(recipe.nutrition, ratio);
  }

  return scaled;
}

/** Extract an existing scale multiplier from notes, if present. */
function parseScaleNote(notes: string | undefined): number | undefined {
  if (!notes) return undefined;
  const match = SCALED_RE.exec(notes);
  return match ? parseFloat(match[1]) : undefined;
}

/** Add or update the "Scaled: Nx from original" line in notes. */
function updateScaleNote(notes: string | undefined, multiplier: number): string {
  const scaleLine = `Scaled: ${multiplier}x from original`;
  if (!notes) return scaleLine;
  if (SCALED_RE.test(notes)) {
    return notes.replace(SCALED_RE, scaleLine);
  }
  return `${notes}\n\n${scaleLine}`;
}

/**
 * Extract a numeric servings value from the serves string.
 * Handles "4", "4 servings", "6-8" (takes the first number).
 */
function parseServings(serves: string | undefined): number | undefined {
  if (!serves) return undefined;
  const match = /^(\d+)/.exec(serves);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Round a scaled quantity to a sensible precision.
 * - Integers stay as integers
 * - Values >= 10 round to nearest integer
 * - Values >= 1 round to 1 decimal
 * - Values < 1 round to 2 decimals
 */
function roundQuantity(n: number): number {
  if (Number.isInteger(n)) return n;
  if (n >= 10) return Math.round(n);
  if (n >= 1) return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
}

function scaleNutrition(
  nutrition: NonNullable<Recipe["nutrition"]>,
  ratio: number,
): NonNullable<Recipe["nutrition"]> {
  const scaled: NonNullable<Recipe["nutrition"]> = {};
  if (nutrition.calories != null) scaled.calories = Math.round(nutrition.calories * ratio);
  if (nutrition.protein != null) scaled.protein = Math.round(nutrition.protein * ratio);
  if (nutrition.carbs != null) scaled.carbs = Math.round(nutrition.carbs * ratio);
  if (nutrition.fat != null) scaled.fat = Math.round(nutrition.fat * ratio);
  if (nutrition.fibre != null) scaled.fibre = Math.round(nutrition.fibre * ratio);
  return scaled;
}
