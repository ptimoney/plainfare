import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import sharp from "sharp";
import { parseAiRecipeResponse } from "@plainfare/core";
import type { AiProvider, Recipe } from "@plainfare/core";
import type { JobHandler } from "./queue.js";
import type { RecipeLibrary } from "../services/library.js";

const IMAGE_MAX_WIDTH = 1200;
const IMAGE_QUALITY = 80;

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

      // Decode base64 image and auto-rotate based on EXIF orientation.
      // Photos taken pointing downward (e.g. at a book) are often physically
      // rotated — the camera embeds the correct orientation in EXIF metadata
      // but the pixel data is still sideways. Without this step the vision
      // model receives a rotated image and produces garbage transcription.
      const imageBuffer = Buffer.from(input.image, "base64");
      const preprocessed = await sharp(imageBuffer)
        .rotate() // apply EXIF orientation, no-op if absent
        .jpeg({ quality: 95 })
        .toBuffer();

      report(20);

      // Call AI provider with the orientation-corrected image
      const rawResponse = await aiProvider.extractRecipeFromImage(
        preprocessed,
        "image/jpeg",
      );

      report(70);

      // Parse AI response into Recipe
      const { recipe } = parseAiRecipeResponse(rawResponse);

      // Reject responses that lack the bare minimum structure of a recipe.
      // This catches cases where the image was unreadable and the model
      // hallucinated or returned an empty shell rather than failing outright.
      const totalIngredients = recipe.ingredientGroups.flatMap((g) => g.ingredients).length;
      if (totalIngredients === 0) {
        throw new Error(
          "AI could not extract any ingredients — the image may be unreadable or not contain a recipe",
        );
      }
      if (recipe.steps.length === 0) {
        throw new Error(
          "AI could not extract any method steps — the image may be unreadable or not contain a recipe",
        );
      }

      report(90);

      // Write to library
      const entry = await library.add(recipe);

      // Save the uploaded image alongside the recipe file if AI didn't extract an image.
      // Reuse the already-rotated buffer so the saved image is also correctly oriented.
      if (!entry.recipe.image) {
        const compressed = await sharp(preprocessed)
          .resize(IMAGE_MAX_WIDTH, undefined, { withoutEnlargement: true })
          .jpeg({ quality: IMAGE_QUALITY })
          .toBuffer();
        const imageFilename = `${entry.slug}.jpg`;
        const imagePath = resolve(dirname(entry.filePath), imageFilename);
        await writeFile(imagePath, compressed);
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
