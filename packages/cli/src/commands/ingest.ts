import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseRecipe,
  ingestFromUrl,
  serialiseRecipe,
  scaleRecipe,
} from "@plainfare/core";
import type { ConfidenceLevel } from "@plainfare/core";

export const ingestCommand = new Command("ingest")
  .description("Ingest a recipe from a file or URL, output canonical markdown")
  .argument("<source>", "Path to a .md file or a URL")
  .option("--json", "Output parsed recipe as JSON instead of canonical markdown")
  .option("-o, --output <file>", "Write to file instead of stdout")
  .option("--scale <servings>", "Scale the recipe to a target number of servings")
  .action(async (source: string, opts: {
    json?: boolean;
    output?: string;
    scale?: string;
  }) => {
    // Determine source type and ingest
    const isUrl = /^https?:\/\//i.test(source);
    let result;

    if (isUrl) {
      result = await ingestFromUrl(source);
    } else {
      const filePath = resolve(source);
      const markdown = await readFile(filePath, "utf-8");
      result = parseRecipe(markdown);
    }

    let { recipe } = result;

    // Apply scaling if requested
    if (opts.scale) {
      const target = parseFloat(opts.scale);
      if (isNaN(target) || target <= 0) {
        console.error(`Invalid scale value: ${opts.scale}`);
        process.exit(1);
      }
      recipe = scaleRecipe(recipe, target);
    }

    // Output
    if (opts.json) {
      console.log(JSON.stringify({ ...result, recipe }, null, 2));
    } else {
      const canonical = serialiseRecipe(recipe);
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
