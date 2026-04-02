import { ingestFromUrl } from "@plainfare/core";
import type { Recipe } from "@plainfare/core";
import type { JobHandler } from "./queue.js";
import type { RecipeLibrary } from "../services/library.js";
import { fetchWithBrowser } from "../services/browser.js";

export interface BrowserFetchInput {
  url: string;
  useBrowser?: boolean;
}

export interface BrowserFetchOutput {
  slug: string;
  recipe: Recipe;
  method: string;
  usedBrowser: boolean;
}

const VIDEO_URL_RE = /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/|tiktok\.com|instagram\.com\/reel)/i;

export function createBrowserFetchHandler(
  library: RecipeLibrary,
): JobHandler<BrowserFetchInput, BrowserFetchOutput> {
  return {
    type: "url-ingest",
    async execute(input, report) {
      if (VIDEO_URL_RE.test(input.url)) {
        throw new Error(
          "This looks like a video URL. Use the \"From Video\" tab to extract recipes from video subtitles.",
        );
      }

      report(10);

      const result = await ingestFromUrl(input.url, {
        useBrowser: input.useBrowser,
        browserFetch: fetchWithBrowser,
      });

      report(80);

      const entry = await library.add(result.recipe);

      report(100);

      return {
        slug: entry.slug,
        recipe: entry.recipe,
        method: result.method,
        usedBrowser: result.usedBrowser,
      };
    },
  };
}
