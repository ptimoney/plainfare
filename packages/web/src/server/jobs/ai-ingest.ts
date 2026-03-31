import { parseAiRecipeResponse } from "@mise/core";
import type { Recipe } from "@mise/core";
import type { JobHandler } from "./queue.js";
import type { OpenAiCompatibleProvider } from "../services/ai.js";
import type { RecipeLibrary } from "../services/library.js";

export interface AiIngestInput {
  image: string; // base64-encoded image data
  mimeType: string;
  filename?: string;
}

export interface AiIngestOutput {
  slug: string;
  recipe: Recipe;
}

export function createAiIngestHandler(
  aiProvider: OpenAiCompatibleProvider,
  library: RecipeLibrary,
): JobHandler<AiIngestInput, AiIngestOutput> {
  return {
    type: "ai-ingest",
    async execute(input, report) {
      report(10);

      // Decode base64 image
      const imageBuffer = Buffer.from(input.image, "base64");

      report(20);

      // Call AI provider
      const rawResponse = await aiProvider.extractRecipeFromImage(
        imageBuffer,
        input.mimeType,
      );

      report(70);

      // Parse AI response into Recipe
      const { recipe } = parseAiRecipeResponse(rawResponse);

      report(90);

      // Write to library
      const entry = await library.add(recipe);

      report(100);

      return {
        slug: entry.slug,
        recipe: entry.recipe,
      };
    },
  };
}
