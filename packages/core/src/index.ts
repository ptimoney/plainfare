// Types
export type {
  Recipe,
  RecipeTime,
  Nutrition,
  Ingredient,
  IngredientGroup,
  MethodStep,
  ConfidenceLevel,
  ConfidenceReport,
  ParseResult,
} from "./types.js";

// Ingestion — all routes to produce a Recipe AST
export { parseRecipe } from "./ingest/markdown.js";
export { parseIngredientLine } from "./ingest/ingredient.js";
export { buildConfidenceReport } from "./ingest/confidence.js";
export { ingestFromUrl } from "./ingest/url.js";
export type { IngestUrlOptions, IngestUrlResult } from "./ingest/url.js";
export { extractFromJsonLd } from "./ingest/jsonld.js";
export { htmlToMarkdown } from "./ingest/html-to-markdown.js";
export { parseCooklang } from "./ingest/cooklang.js";
export { parsePaprikaArchive } from "./ingest/paprika.js";
export { parseCopyMeThatArchive } from "./ingest/copymethat.js";
export type { AiProvider } from "./ingest/ai.js";
export { buildImageExtractionPrompt, buildTextExtractionPrompt, parseAiRecipeResponse, buildNutritionEstimationPrompt, parseNutritionResponse } from "./ingest/ai.js";

// Functions — operations on a Recipe AST
export { serialiseRecipe } from "./functions/serialise.js";
export { scaleRecipe } from "./functions/scale.js";
export { convertUnits } from "./functions/convert.js";
export { generateShoppingList, formatShoppingList } from "./functions/shopping.js";
export type { ShoppingItem } from "./functions/shopping.js";
