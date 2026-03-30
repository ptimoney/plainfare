import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { parseRecipe, serialiseRecipe } from "@mise/core";
import type { ConfidenceLevel } from "@mise/core";

export const parseCommand = new Command("parse")
  .description("Parse a recipe file and report confidence, output canonical md to stdout")
  .argument("<file>", "Path to a .md recipe file")
  .option("--json", "Output parsed recipe as JSON instead of canonical markdown")
  .action(async (file: string, opts: { json?: boolean }) => {
    const markdown = await readFile(file, "utf-8");
    const result = parseRecipe(markdown);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Output canonical markdown
    console.log(serialiseRecipe(result.recipe));

    // Print confidence report to stderr so it doesn't mix with the recipe output
    const { confidence } = result;
    console.error("\n--- Confidence Report ---");
    console.error(`Overall: ${(confidence.overallConfidence * 100).toFixed(0)}%`);
    console.error(`LLM fallback: ${confidence.usedLLMFallback ? "yes" : "no"}`);

    const fieldEntries = Object.entries(confidence.fields) as [string, ConfidenceLevel][];
    const resolved = fieldEntries.filter(([, v]) => v === "resolved").map(([k]) => k);
    const missing = fieldEntries.filter(([, v]) => v === "missing").map(([k]) => k);
    const inferred = fieldEntries.filter(([, v]) => v === "inferred").map(([k]) => k);

    if (resolved.length) console.error(`Resolved: ${resolved.join(", ")}`);
    if (inferred.length) console.error(`Inferred: ${inferred.join(", ")}`);
    if (missing.length) console.error(`Missing:  ${missing.join(", ")}`);
  });
