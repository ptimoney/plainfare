import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRecipe, serialiseRecipe } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputDir = join(__dirname, "fixtures", "input");
const expectedDir = join(__dirname, "fixtures", "expected");
const actualDir = join(__dirname, "fixtures", "actual");

const inputFiles = readdirSync(inputDir).filter((f) => f.endsWith(".md"));

beforeAll(() => {
  mkdirSync(actualDir, { recursive: true });
});

describe.each(inputFiles)("normalise: %s", (filename) => {
  const inputPath = join(inputDir, filename);
  const expectedPath = join(expectedDir, filename);
  const actualPath = join(actualDir, filename);

  const input = readFileSync(inputPath, "utf-8");
  const expected = readFileSync(expectedPath, "utf-8");

  const result = parseRecipe(input);
  const actual = serialiseRecipe(result.recipe);

  // Always write actual output so the developer can inspect it
  beforeAll(() => {
    writeFileSync(actualPath, actual, "utf-8");
  });

  it("produces valid output", () => {
    expect(actual.length).toBeGreaterThan(0);
    expect(actual.endsWith("\n")).toBe(true);
  });

  it("preserves the title", () => {
    expect(result.recipe.title).toBeTruthy();
  });

  it("matches expected output", () => {
    if (actual !== expected) {
      // Build a line-by-line diff summary for the test failure message
      const actualLines = actual.split("\n");
      const expectedLines = expected.split("\n");
      const maxLines = Math.max(actualLines.length, expectedLines.length);
      const diffs: string[] = [];

      for (let i = 0; i < maxLines; i++) {
        const a = actualLines[i] ?? "⟨missing⟩";
        const e = expectedLines[i] ?? "⟨missing⟩";
        if (a !== e) {
          diffs.push(
            [
              `  line ${i + 1}:`,
              `    expected: ${JSON.stringify(e)}`,
              `    actual:   ${JSON.stringify(a)}`,
            ].join("\n"),
          );
        }
      }

      const hint = [
        "",
        `Files written to disk for inspection:`,
        `  input:    ${inputPath}`,
        `  expected: ${expectedPath}`,
        `  actual:   ${actualPath}`,
        "",
        `Diff (${diffs.length} line(s) differ):`,
        ...diffs,
      ].join("\n");

      expect.fail(hint);
    }
  });

  it("re-parses its own output identically (idempotent)", () => {
    const reparsed = serialiseRecipe(parseRecipe(actual).recipe);
    if (reparsed !== actual) {
      writeFileSync(
        join(actualDir, filename.replace(".md", ".reparse.md")),
        reparsed,
        "utf-8",
      );
      expect.fail(
        `Re-serialising the actual output produced a different result.\n` +
          `  See: ${join(actualDir, filename.replace(".md", ".reparse.md"))}`,
      );
    }
  });
});
