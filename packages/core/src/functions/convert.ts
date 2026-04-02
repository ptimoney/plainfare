import type { Recipe, Ingredient } from "../types.js";

type System = "metric" | "imperial";

interface UnitDef {
  system: System;
  type: "weight" | "volume";
  toBase: number; // multiply by this to get to base unit (g or ml)
}

const UNITS: Record<string, UnitDef> = {
  // Metric weight (base: g)
  g:   { system: "metric",   type: "weight", toBase: 1 },
  kg:  { system: "metric",   type: "weight", toBase: 1000 },
  mg:  { system: "metric",   type: "weight", toBase: 0.001 },
  // Imperial weight (base: g)
  oz:  { system: "imperial", type: "weight", toBase: 28.3495 },
  lb:  { system: "imperial", type: "weight", toBase: 453.592 },
  lbs: { system: "imperial", type: "weight", toBase: 453.592 },
  // Metric volume (base: ml)
  ml:  { system: "metric",   type: "volume", toBase: 1 },
  l:   { system: "metric",   type: "volume", toBase: 1000 },
  dl:  { system: "metric",   type: "volume", toBase: 100 },
  // Imperial volume (base: ml)
  cup:  { system: "imperial", type: "volume", toBase: 236.588 },
  cups: { system: "imperial", type: "volume", toBase: 236.588 },
  tbsp: { system: "imperial", type: "volume", toBase: 14.787 },
  tsp:  { system: "imperial", type: "volume", toBase: 4.929 },
};

// Preferred output units per system, ordered large → small
const METRIC_WEIGHT: { unit: string; min: number }[] = [
  { unit: "kg", min: 1000 },
  { unit: "g",  min: 1 },
];

const METRIC_VOLUME: { unit: string; min: number }[] = [
  { unit: "l",  min: 1000 },
  { unit: "ml", min: 1 },
];

const IMPERIAL_WEIGHT: { unit: string; min: number }[] = [
  { unit: "lb", min: 453.592 },
  { unit: "oz", min: 28.3495 },
];

const IMPERIAL_VOLUME: { unit: string; min: number }[] = [
  { unit: "cups", min: 236.588 },
  { unit: "tbsp", min: 14.787 },
  { unit: "tsp",  min: 4.929 },
];

/**
 * Convert all ingredients in a recipe to the target unit system.
 * Ingredients with no recognised unit or non-convertible units
 * (e.g. "cloves", "pinch") are left unchanged.
 */
export function convertUnits(recipe: Recipe, target: System): Recipe {
  return {
    ...recipe,
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      ingredients: group.ingredients.map((ing) => convertIngredient(ing, target)),
    })),
  };
}

function convertIngredient(ing: Ingredient, target: System): Ingredient {
  if (ing.quantity == null || !ing.unit) return ing;

  const unitDef = UNITS[ing.unit];
  if (!unitDef) return ing; // non-convertible unit (pinch, clove, etc.)
  if (unitDef.system === target) return ing; // already in target system

  const baseValue = ing.quantity * unitDef.toBase;
  const candidates = target === "metric"
    ? (unitDef.type === "weight" ? METRIC_WEIGHT : METRIC_VOLUME)
    : (unitDef.type === "weight" ? IMPERIAL_WEIGHT : IMPERIAL_VOLUME);

  // Pick the largest unit where the value is >= 1
  for (const candidate of candidates) {
    const converted = baseValue / UNITS[candidate.unit].toBase;
    if (converted >= 1) {
      return {
        ...ing,
        quantity: roundForDisplay(converted),
        unit: candidate.unit,
      };
    }
  }

  // Fallback to the smallest unit
  const smallest = candidates[candidates.length - 1];
  const converted = baseValue / UNITS[smallest.unit].toBase;
  return {
    ...ing,
    quantity: roundForDisplay(converted),
    unit: smallest.unit,
  };
}

/**
 * Round a converted value to a sensible display precision.
 * Avoids ugly numbers like "236.588ml" — prefers "240ml" or "1.5 cups".
 */
function roundForDisplay(n: number): number {
  if (n >= 100) return Math.round(n / 5) * 5; // nearest 5 for large values
  if (n >= 10) return Math.round(n);
  if (n >= 1) return Math.round(n * 4) / 4; // nearest quarter
  return Math.round(n * 10) / 10; // 1 decimal for small values
}
