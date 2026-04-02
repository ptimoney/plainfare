import type { AiProvider, Recipe } from "@plainfare/core";
import { parseAiRecipeResponse } from "@plainfare/core";
import type { JobHandler } from "./queue.js";
import type { RecipeLibrary } from "../services/library.js";
import { extractSubtitles, extractVideoMetadata } from "../services/subtitles.js";

export interface VideoIngestInput {
  url: string;
}

export interface VideoIngestOutput {
  slug: string;
  recipe: Recipe;
}

export function createVideoIngestHandler(
  aiProvider: AiProvider,
  library: RecipeLibrary,
): JobHandler<VideoIngestInput, VideoIngestOutput> {
  return {
    type: "video-ingest",
    async execute(input, report) {
      report(5);

      // Extract metadata and attempt subtitles in parallel
      const [transcript, metadata] = await Promise.all([
        extractSubtitles(input.url),
        extractVideoMetadata(input.url),
      ]);
      report(40);

      // Use subtitles if available, otherwise fall back to video description
      let textForAi: string;
      if (transcript) {
        textForAi = transcript;
      } else if (metadata.description.trim()) {
        textForAi = `Title: ${metadata.title}\n\nDescription:\n${metadata.description}`;
      } else {
        throw new Error(
          "No subtitles or description available for this video. " +
          "Try a video with captions enabled or a recipe in the description.",
        );
      }

      // Use AI to extract recipe from text
      const rawResponse = await aiProvider.extractRecipeFromText(textForAi);
      report(80);

      const { recipe } = parseAiRecipeResponse(rawResponse);

      // Add source URL and thumbnail
      if (!recipe.source) recipe.source = input.url;
      if (!recipe.image && metadata.thumbnail) recipe.image = metadata.thumbnail;

      const entry = await library.add(recipe);
      report(100);

      return { slug: entry.slug, recipe: entry.recipe };
    },
  };
}
