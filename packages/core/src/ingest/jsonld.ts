import type {
  Recipe,
  RecipeTime,
  Nutrition,
  IngredientGroup,
  MethodStep,
} from "../types.js";
import { parseIngredientLine } from "./ingredient.js";

/**
 * Extract a Recipe from a schema.org JSON-LD Recipe node.
 * Returns undefined if the node doesn't contain usable recipe data.
 */
export function extractFromJsonLd(html: string): Recipe | undefined {
  const nodes = findRecipeNodes(html);
  if (nodes.length === 0) return undefined;

  const node = nodes[0];
  return mapToRecipe(node);
}

// --- JSON-LD discovery ---

function findRecipeNodes(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  // Extract all <script type="application/ld+json"> blocks
  const scriptRe = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      collectRecipeNodes(data, results);
    } catch {
      // Malformed JSON — skip
    }
  }

  return results;
}

function collectRecipeNodes(
  data: unknown,
  results: Record<string, unknown>[],
): void {
  if (!data || typeof data !== "object") return;

  if (Array.isArray(data)) {
    for (const item of data) collectRecipeNodes(item, results);
    return;
  }

  const obj = data as Record<string, unknown>;

  // Check @type
  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
    results.push(obj);
    return;
  }

  // Walk @graph
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) collectRecipeNodes(item, results);
  }

  // Walk mainEntity
  if (obj["mainEntity"]) collectRecipeNodes(obj["mainEntity"], results);
}

// --- Mapping ---

function mapToRecipe(node: Record<string, unknown>): Recipe | undefined {
  const title = asString(node["name"]) || asString(node["headline"]);
  if (!title) return undefined;

  const recipe: Recipe = {
    title,
    ingredientGroups: [],
    steps: [],
  };

  // Description
  const desc = asString(node["description"]);
  if (desc) recipe.description = desc;

  // Image
  const image = extractImage(node["image"]);
  if (image) recipe.image = image;

  // Source
  const url = asString(node["url"]);
  if (url) recipe.source = url;

  // Tags / keywords
  const keywords = extractKeywords(node["keywords"]);
  if (keywords.length > 0) recipe.tags = keywords;

  // Serves
  const serves = extractServes(node["recipeYield"]);
  if (serves) recipe.serves = serves;

  // Time
  const time = extractTime(node);
  if (time && (time.prep != null || time.cook != null)) recipe.time = time;

  // Nutrition
  const nutrition = extractNutrition(node["nutrition"]);
  if (nutrition) recipe.nutrition = nutrition;

  // Ingredients
  const ingredients = extractIngredients(node["recipeIngredient"]);
  if (ingredients.length > 0) {
    recipe.ingredientGroups = [{ ingredients }];
  }

  // Steps
  const steps = extractSteps(node["recipeInstructions"]);
  if (steps.length > 0) recipe.steps = steps;

  return recipe;
}

function extractImage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return extractImage(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return asString(obj["url"]) || asString(obj["contentUrl"]);
  }
  return undefined;
}

function extractKeywords(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return [];
}

function extractServes(value: unknown): string | undefined {
  if (typeof value === "string") {
    // "4 servings" → "4", but keep "12 cookies" as-is
    const num = /^(\d+)\s*servings?$/i.exec(value);
    if (num) return num[1];
    return value;
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0) return extractServes(value[0]);
  return undefined;
}

function extractTime(node: Record<string, unknown>): RecipeTime | undefined {
  const prep = parseDuration(asString(node["prepTime"]));
  const cook = parseDuration(asString(node["cookTime"]));
  if (prep == null && cook == null) return undefined;
  return {
    ...(prep != null && { prep }),
    ...(cook != null && { cook }),
  };
}

// Parse ISO 8601 duration (PT30M, PT1H30M, PT1H, etc.) to minutes
function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value);
  if (!match) return undefined;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

function extractNutrition(value: unknown): Nutrition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;

  const nutrition: Nutrition = {};
  const cal = parseNumeric(obj["calories"]);
  if (cal != null) nutrition.calories = cal;
  const protein = parseNumeric(obj["proteinContent"]);
  if (protein != null) nutrition.protein = protein;
  const carbs = parseNumeric(obj["carbohydrateContent"]);
  if (carbs != null) nutrition.carbs = carbs;
  const fat = parseNumeric(obj["fatContent"]);
  if (fat != null) nutrition.fat = fat;
  const fibre = parseNumeric(obj["fiberContent"]);
  if (fibre != null) nutrition.fibre = fibre;

  return Object.keys(nutrition).length > 0 ? nutrition : undefined;
}

function parseNumeric(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = /(\d+(?:\.\d+)?)/.exec(value);
    if (match) return parseFloat(match[1]);
  }
  return undefined;
}

function extractIngredients(value: unknown): ReturnType<typeof parseIngredientLine>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = typeof item === "string" ? item : asString(item);
      const line = raw ? stripHtml(raw) : null;
      return line ? parseIngredientLine(line) : null;
    })
    .filter((i): i is NonNullable<typeof i> => i != null);
}

function extractSteps(value: unknown): MethodStep[] {
  if (!value) return [];

  const texts: string[] = [];
  collectStepTexts(value, texts);

  return texts.map((text, i) => ({
    number: i + 1,
    paragraphs: [text],
  }));
}

function collectStepTexts(value: unknown, texts: string[]): void {
  if (typeof value === "string") {
    const cleaned = stripHtml(value).trim();
    if (cleaned) texts.push(cleaned);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStepTexts(item, texts);
    return;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const type = asString(obj["@type"]);

    if (type === "HowToStep") {
      const text = asString(obj["text"]);
      if (text) {
        const cleaned = stripHtml(text).trim();
        if (cleaned) texts.push(cleaned);
      }
    } else if (type === "HowToSection") {
      // Recurse into section items
      if (obj["itemListElement"]) collectStepTexts(obj["itemListElement"], texts);
    } else if (obj["itemListElement"]) {
      collectStepTexts(obj["itemListElement"], texts);
    } else if (obj["text"]) {
      const text = asString(obj["text"]);
      if (text) {
        const cleaned = stripHtml(text).trim();
        if (cleaned) texts.push(cleaned);
      }
    }
  }
}

// --- Utility ---

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return decodeEntities(value);
  if (typeof value === "number") return String(value);
  return undefined;
}

function stripHtml(text: string): string {
  return decodeEntities(text.replace(/<[^>]*>/g, ""));
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
  "&nbsp;": " ",
  "&frac12;": "1/2", "&frac13;": "1/3", "&frac14;": "1/4",
  "&frac34;": "3/4", "&frac23;": "2/3", "&frac15;": "1/5",
  "&frac16;": "1/6", "&frac18;": "1/8", "&frac38;": "3/8",
  "&frac56;": "5/6", "&frac58;": "5/8", "&frac78;": "7/8",
  "½": "1/2", "⅓": "1/3", "¼": "1/4", "¾": "3/4", "⅔": "2/3",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

function decodeEntities(text: string): string {
  // Named/fraction entities
  let result = text;
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, replacement);
  }
  // Numeric entities: &#123; or &#x1a;
  result = result.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)));
  return result;
}
