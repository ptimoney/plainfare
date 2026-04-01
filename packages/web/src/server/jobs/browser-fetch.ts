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

export function createBrowserFetchHandler(
  library: RecipeLibrary,
): JobHandler<BrowserFetchInput, BrowserFetchOutput> {
  return {
    type: "url-ingest",
    async execute(input, report) {
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
