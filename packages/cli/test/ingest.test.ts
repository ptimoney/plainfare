import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const exec = promisify(execFile);

const CLI = join(import.meta.dirname, "../src/index.ts");
const FIXTURE_DIR = join(import.meta.dirname, "../../core/test/fixtures/input");

/** Run the CLI via tsx so we don't need to build first */
function plainfare(...args: string[]) {
  return exec("npx", ["tsx", CLI, ...args], { timeout: 10_000 });
}

describe("plainfare ingest", () => {
  it("ingests a canonical markdown file and outputs canonical markdown", async () => {
    const { stdout } = await plainfare("ingest", join(FIXTURE_DIR, "carbonara.md"));
    expect(stdout).toContain("# Spaghetti Carbonara");
    expect(stdout).toContain("## Ingredients");
    expect(stdout).toContain("## Method");
  });

  it("ingests a minimal file (title only)", async () => {
    const { stdout } = await plainfare("ingest", join(FIXTURE_DIR, "title-only.md"));
    expect(stdout).toContain("# ");
  });

  it("outputs JSON with --json flag", async () => {
    const { stdout } = await plainfare("ingest", "--json", join(FIXTURE_DIR, "carbonara.md"));
    const parsed = JSON.parse(stdout);
    expect(parsed.recipe.title).toBe("Spaghetti Carbonara");
    expect(parsed.confidence.overallConfidence).toBeGreaterThan(0);
  });

  it("writes to a file with -o flag", async () => {
    let tmpDir: string;
    tmpDir = await mkdtemp(join(tmpdir(), "plainfare-test-"));
    const outPath = join(tmpDir, "output.md");

    try {
      const { stderr } = await plainfare("ingest", "-o", outPath, join(FIXTURE_DIR, "carbonara.md"));
      expect(stderr).toContain(`Written to ${outPath}`);

      const { readFile: rf } = await import("node:fs/promises");
      const content = await rf(outPath, "utf-8");
      expect(content).toContain("# Spaghetti Carbonara");
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it("scales a recipe with --scale flag", async () => {
    const { stdout } = await plainfare("ingest", "--scale", "8", join(FIXTURE_DIR, "carbonara.md"));
    // Carbonara serves 4, scaling to 8 should double quantities
    // 200g spaghetti → 400g
    expect(stdout).toContain("400g");
  });

  it("reports confidence to stderr", async () => {
    const { stderr } = await plainfare("ingest", join(FIXTURE_DIR, "carbonara.md"));
    expect(stderr).toContain("Confidence Report");
    expect(stderr).toContain("Overall:");
    expect(stderr).toContain("Resolved:");
  });

  it("fails gracefully on non-existent file", async () => {
    await expect(plainfare("ingest", "/tmp/does-not-exist.md")).rejects.toThrow();
  });
});
