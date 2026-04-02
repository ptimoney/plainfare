import { parsePaprikaArchive, parseCopyMeThatArchive } from "@plainfare/core";
import type { Recipe } from "@plainfare/core";
import type { JobHandler } from "./queue.js";
import type { RecipeLibrary } from "../services/library.js";

export interface ImportIngestInput {
  data: string; // base64-encoded archive
  filename: string;
}

export interface ImportIngestOutput {
  imported: number;
  failed: number;
  recipes: { slug: string; title: string }[];
}

export function createImportIngestHandler(
  library: RecipeLibrary,
): JobHandler<ImportIngestInput, ImportIngestOutput> {
  return {
    type: "import-ingest",
    async execute(input, report) {
      report(5);

      const buffer = new Uint8Array(Buffer.from(input.data, "base64"));
      const filename = input.filename.toLowerCase();

      const results = filename.endsWith(".paprikarecipes")
        ? parsePaprikaArchive(buffer)
        : parseCopyMeThatArchive(buffer);

      report(30);

      const imported: { slug: string; title: string }[] = [];
      let failed = 0;

      for (let i = 0; i < results.length; i++) {
        try {
          const entry = await library.add(results[i].recipe);
          imported.push({ slug: entry.slug, title: entry.recipe.title });
        } catch {
          failed++;
        }
        report(30 + Math.round((70 * (i + 1)) / results.length));
      }

      return { imported: imported.length, failed, recipes: imported };
    },
  };
}
