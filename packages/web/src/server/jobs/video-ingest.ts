import type { AiProvider, Recipe } from "@plainfare/core";
import { parseAiRecipeResponse } from "@plainfare/core";
import type { JobHandler } from "./queue.js";
import type { RecipeLibrary } from "../services/library.js";
import { extractSubtitles } from "../services/subtitles.js";

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

      // Extract subtitles from video
      const transcript = await extractSubtitles(input.url);
      report(40);

      // Use AI to extract recipe from transcript
      const rawResponse = await aiProvider.extractRecipeFromText(transcript);
      report(80);

      const { recipe } = parseAiRecipeResponse(rawResponse);

      // Add source URL
      if (!recipe.source) recipe.source = input.url;

      const entry = await library.add(recipe);
      report(100);

      return { slug: entry.slug, recipe: entry.recipe };
    },
  };
}
