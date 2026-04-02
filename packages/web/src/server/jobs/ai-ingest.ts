import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { parseAiRecipeResponse } from "@plainfare/core";
import type { AiProvider, Recipe } from "@plainfare/core";
import type { JobHandler } from "./queue.js";
import type { RecipeLibrary } from "../services/library.js";

export interface AiImageIngestInput {
  image: string; // base64-encoded image data
  mimeType: string;
  filename?: string;
}

export interface AiTextIngestInput {
  text: string;
}

export interface AiIngestOutput {
  slug: string;
  recipe: Recipe;
}

export function createAiIngestHandler(
  aiProvider: AiProvider,
  library: RecipeLibrary,
): JobHandler<AiImageIngestInput, AiIngestOutput> {
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

      // Save the uploaded image alongside the recipe file if AI didn't extract an image
      if (!entry.recipe.image) {
        const ext = mimeToExt(input.mimeType);
        const imageFilename = `${entry.slug}.${ext}`;
        const imagePath = resolve(dirname(entry.filePath), imageFilename);
        await writeFile(imagePath, imageBuffer);
        const { serialiseRecipe } = await import("@plainfare/core");
        await library.update(entry.slug,
          serialiseRecipe({ ...entry.recipe, image: imageFilename }),
        );
      }

      report(100);

      const final = library.get(entry.slug)!;
      return {
        slug: final.slug,
        recipe: final.recipe,
      };
    },
  };
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType] ?? "jpg";
}

export function createAiTextIngestHandler(
  aiProvider: AiProvider,
  library: RecipeLibrary,
): JobHandler<AiTextIngestInput, AiIngestOutput> {
  return {
    type: "ai-text-ingest",
    async execute(input, report) {
      report(10);

      const rawResponse = await aiProvider.extractRecipeFromText(input.text);

      report(70);

      const { recipe } = parseAiRecipeResponse(rawResponse);

      report(90);

      const entry = await library.add(recipe);

      report(100);

      return {
        slug: entry.slug,
        recipe: entry.recipe,
      };
    },
  };
}
