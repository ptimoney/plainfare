import { Command } from "commander";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parseRecipe, serialiseRecipe } from "@mise/core";

export const normaliseCommand = new Command("normalise")
  .description("Normalise a fuzzy .md file to canonical format")
  .argument("<file>", "Path to a .md recipe file")
  .option("--replace", "Replace the file in place")
  .option("--backup", "Replace with .orig backup")
  .option("--output <dir>", "Write to output directory")
  .option("--dry-run", "Show diff without writing")
  .action(
    async (
      file: string,
      opts: {
        replace?: boolean;
        backup?: boolean;
        output?: string;
        dryRun?: boolean;
      },
    ) => {
      const filePath = resolve(file);
      const original = await readFile(filePath, "utf-8");
      const result = parseRecipe(original);
      const normalised = serialiseRecipe(result.recipe);

      if (original === normalised) {
        console.error("File is already in canonical format.");
        return;
      }

      if (opts.dryRun) {
        console.log(normalised);
        console.error("\n(dry run — no files written)");
        return;
      }

      if (opts.output) {
        const outDir = resolve(opts.output);
        await mkdir(outDir, { recursive: true });
        const outPath = join(outDir, basename(filePath));
        await writeFile(outPath, normalised, "utf-8");
        console.error(`Written to ${outPath}`);
        return;
      }

      if (opts.backup) {
        await rename(filePath, filePath + ".orig");
        console.error(`Backup saved to ${filePath}.orig`);
      }

      if (opts.replace || opts.backup) {
        await writeFile(filePath, normalised, "utf-8");
        console.error(`Normalised ${filePath}`);
        return;
      }

      // Default: output to stdout
      console.log(normalised);
    },
  );
