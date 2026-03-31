import type { Recipe, Ingredient } from "../types.js";

export function serialiseRecipe(recipe: Recipe): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${recipe.title}`);

  // Description
  if (recipe.description) {
    lines.push("", recipe.description);
  }

  // Image
  if (recipe.image) {
    lines.push("", `![${recipe.title}](${recipe.image})`);
  }

  // Metadata block
  const metaLines: string[] = [];

  if (recipe.source) {
    metaLines.push(`Source: ${recipe.source}`);
  }
  if (recipe.tags && recipe.tags.length > 0) {
    metaLines.push(`Tags: ${recipe.tags.join(", ")}`);
  }
  if (recipe.serves) {
    metaLines.push(`Serves: ${recipe.serves}`);
  }
  if (recipe.time) {
    const parts: string[] = [];
    if (recipe.time.prep != null) parts.push(`${recipe.time.prep} mins prep`);
    if (recipe.time.cook != null) parts.push(`${recipe.time.cook} mins cook`);
    if (parts.length > 0) metaLines.push(`Time: ${parts.join(" | ")}`);
  }
  if (recipe.nutrition) {
    const n = recipe.nutrition;
    const parts: string[] = [];
    if (n.calories != null) parts.push(`Calories: ${n.calories}`);
    if (n.protein != null) parts.push(`Protein: ${n.protein}g`);
    if (n.carbs != null) parts.push(`Carbs: ${n.carbs}g`);
    if (n.fat != null) parts.push(`Fat: ${n.fat}g`);
    if (n.fibre != null) parts.push(`Fibre: ${n.fibre}g`);
    if (parts.length > 0) metaLines.push(parts.join(" | "));
  }

  if (metaLines.length > 0) {
    lines.push("", ...metaLines);
  }

  // Ingredients
  if (recipe.ingredientGroups.length > 0) {
    lines.push("", "## Ingredients");

    for (const group of recipe.ingredientGroups) {
      if (group.title) {
        lines.push("", `### ${group.title}`);
      }
      lines.push("");
      for (const ing of group.ingredients) {
        lines.push(`- ${formatIngredient(ing)}`);
      }
    }
  }

  // Method
  if (recipe.steps.length > 0) {
    lines.push("", "## Method");
    lines.push("");

    for (const step of recipe.steps) {
      const [first, ...rest] = step.paragraphs;
      lines.push(`${step.number}. ${first}`);
      for (const para of rest) {
        lines.push("", `   ${para}`);
      }
      lines.push("");
    }

    // Remove trailing blank line from last step
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  // Notes
  if (recipe.notes) {
    lines.push("", "## Notes", "", recipe.notes);
  }

  return lines.join("\n") + "\n";
}

// Units that attach directly to the number (no space): 200g, 1.5kg, 400ml
const STUCK_UNITS = new Set(["g", "kg", "mg", "l", "ml", "dl", "oz", "lb", "lbs"]);

// Units that read naturally with "of": "1 handful of parsley", "a pinch of salt"
const OF_UNITS = new Set([
  "handful", "handfuls", "pinch", "pinches", "bunch", "bunches",
  "clove", "cloves", "tin", "tins",
  "sprig", "sprigs", "bottle", "bottles", "packet", "packets",
  "can", "cans", "piece", "pieces", "slice", "slices",
  "sheet", "sheets", "stick", "sticks",
]);

function formatIngredient(ing: Ingredient): string {
  let result = "";

  if (ing.quantity != null && ing.unit) {
    const qty = formatQuantity(ing.quantity);
    if (STUCK_UNITS.has(ing.unit)) {
      result = `${qty}${ing.unit} ${ing.name}`;
    } else if (OF_UNITS.has(ing.unit)) {
      result = `${qty} ${ing.unit} of ${ing.name}`;
    } else {
      result = `${qty} ${ing.unit} ${ing.name}`;
    }
  } else if (ing.quantity != null) {
    result = `${formatQuantity(ing.quantity)} ${ing.name}`;
  } else {
    result = ing.name;
  }

  if (ing.note) {
    result += `, ${ing.note}`;
  }

  return result;
}

function formatQuantity(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}
