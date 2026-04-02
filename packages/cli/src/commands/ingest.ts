import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseRecipe,
  parseCooklang,
  parsePaprikaArchive,
  parseCopyMeThatArchive,
  ingestFromUrl,
  serialiseRecipe,
} from "@plainfare/core";
import type { ConfidenceLevel, ParseResult } from "@plainfare/core";

export const ingestCommand = new Command("ingest")
  .description("Ingest a recipe from a file or URL, output canonical markdown")
  .argument("<source>", "Path to a .md, .cook, .paprikarecipes, or .zip file, or a URL")
  .option("--json", "Output parsed recipe as JSON instead of canonical markdown")
  .option("-o, --output <file>", "Write to file instead of stdout")
  .action(async (source: string, opts: {
    json?: boolean;
    output?: string;
  }) => {
    // Determine source type and ingest
    const isUrl = /^https?:\/\//i.test(source);
    let result;

    if (isUrl) {
      result = await ingestFromUrl(source);
    } else {
      const filePath = resolve(source);
      const lowerPath = filePath.toLowerCase();

      // Archive formats — produce multiple recipes
      if (lowerPath.endsWith(".paprikarecipes") || lowerPath.endsWith(".zip")) {
        const buffer = await readFile(filePath);
        const data = new Uint8Array(buffer);
        const results: ParseResult[] = lowerPath.endsWith(".paprikarecipes")
          ? parsePaprikaArchive(data)
          : parseCopyMeThatArchive(data);

        if (results.length === 0) {
          console.error("No recipes found in archive.");
          process.exit(1);
        }

        for (const r of results) {
          if (opts.json) {
            console.log(JSON.stringify(r, null, 2));
          } else {
            console.log(serialiseRecipe(r.recipe, { placeholders: true }));
            console.log("---\n");
          }
        }
        console.error(`Imported ${results.length} recipe(s) from ${source}`);
        return;
      }

      const content = await readFile(filePath, "utf-8");
      result = filePath.endsWith(".cook")
        ? parseCooklang(content)
        : parseRecipe(content);
    }

    const { recipe } = result;

    // Output
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const canonical = serialiseRecipe(recipe, { placeholders: true });
      if (opts.output) {
        const outPath = resolve(opts.output);
        await writeFile(outPath, canonical, "utf-8");
        console.error(`Written to ${outPath}`);
      } else {
        console.log(canonical);
      }
    }

    // Confidence report to stderr
    const { confidence } = result;
    console.error(`\n--- Confidence Report ---`);
    if (isUrl) {
      const urlResult = result as { method?: string };
      console.error(`Method: ${urlResult.method ?? "markdown"}`);
    }
    console.error(`Overall: ${(confidence.overallConfidence * 100).toFixed(0)}%`);

    const fieldEntries = Object.entries(confidence.fields) as [string, ConfidenceLevel][];
    const resolved = fieldEntries.filter(([, v]) => v === "resolved").map(([k]) => k);
    const missing = fieldEntries.filter(([, v]) => v === "missing").map(([k]) => k);
    const inferred = fieldEntries.filter(([, v]) => v === "inferred").map(([k]) => k);

    if (resolved.length) console.error(`Resolved: ${resolved.join(", ")}`);
    if (inferred.length) console.error(`Inferred: ${inferred.join(", ")}`);
    if (missing.length) console.error(`Missing:  ${missing.join(", ")}`);
  });
