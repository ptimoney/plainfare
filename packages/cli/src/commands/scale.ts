import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRecipe, scaleRecipe, serialiseRecipe } from "@plainfare/core";

export const scaleCommand = new Command("scale")
  .description("Scale a recipe to a target number of servings")
  .argument("<file>", "Path to a recipe .md file")
  .argument("<servings>", "Target number of servings")
  .option("-o, --output <file>", "Write to file instead of stdout")
  .option("-i, --in-place", "Overwrite the input file")
  .action(async (file: string, servings: string, opts: {
    output?: string;
    inPlace?: boolean;
  }) => {
    const target = parseFloat(servings);
    if (isNaN(target) || target <= 0) {
      console.error(`Invalid servings value: ${servings}`);
      process.exit(1);
    }

    const filePath = resolve(file);
    const markdown = await readFile(filePath, "utf-8");
    const { recipe } = parseRecipe(markdown);
    const scaled = scaleRecipe(recipe, target);
    const output = serialiseRecipe(scaled);

    if (opts.inPlace) {
      await writeFile(filePath, output, "utf-8");
      console.error(`Scaled to ${target} servings: ${filePath}`);
    } else if (opts.output) {
      const outPath = resolve(opts.output);
      await writeFile(outPath, output, "utf-8");
      console.error(`Written to ${outPath}`);
    } else {
      console.log(output);
    }
  });
