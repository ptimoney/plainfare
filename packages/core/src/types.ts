export interface RecipeTime {
  prep?: number; // minutes
  cook?: number; // minutes
}

export interface Nutrition {
  calories?: number;
  protein?: number; // grams
  carbs?: number; // grams
  fat?: number; // grams
  fibre?: number; // grams
}

export interface Ingredient {
  quantity?: number;
  unit?: string;
  name: string;
  note?: string; // e.g. "finely grated", "to taste"
}

export interface IngredientGroup {
  title?: string; // undefined = ungrouped
  ingredients: Ingredient[];
}

export interface MethodStep {
  number: number;
  paragraphs: string[]; // multi-paragraph steps supported
}

export interface Recipe {
  title: string;
  description?: string;
  image?: string; // local file path or URL
  source?: string; // URL or attribution string
  tags?: string[];
  serves?: string; // kept as string: "4", "12 cookies", "6-8"
  time?: RecipeTime;
  nutrition?: Nutrition;
  ingredientGroups: IngredientGroup[];
  steps: MethodStep[];
  notes?: string;
}

export type ConfidenceLevel = "resolved" | "inferred" | "missing";

export interface ConfidenceReport {
  fields: Partial<Record<keyof Recipe, ConfidenceLevel>>;
  overallConfidence: number; // 0-1
  usedLLMFallback: boolean;
}

export interface ParseResult {
  recipe: Recipe;
  confidence: ConfidenceReport;
}
