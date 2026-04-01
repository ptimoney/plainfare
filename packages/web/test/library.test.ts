import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RecipeLibrary } from "../src/server/services/library.js";

let tempDir: string;
let library: RecipeLibrary;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "plainfare-test-"));
});

afterEach(async () => {
  await library?.close();
  await rm(tempDir, { recursive: true, force: true });
});

const SIMPLE_RECIPE = `# Test Recipe

A simple test recipe.

Tags: dinner, easy
Serves: 4

## Ingredients

- 200g pasta
- 100g cheese

## Method

1. Cook the pasta.
2. Add the cheese.
`;

const MINIMAL_RECIPE = `# Minimal Recipe
`;

const DESSERT_RECIPE = `# Chocolate Cake

A rich chocolate cake.

Tags: dessert, chocolate

## Ingredients

- 200g dark chocolate
- 100g butter

## Method

1. Melt chocolate and butter together.
`;

async function writeRecipe(dir: string, filename: string, content: string) {
  await writeFile(join(dir, filename), content, "utf-8");
}

describe("RecipeLibrary", () => {
  describe("initialize", () => {
    it("loads .md files from the directory", async () => {
      await writeRecipe(tempDir, "test-recipe.md", SIMPLE_RECIPE);
      await writeRecipe(tempDir, "minimal.md", MINIMAL_RECIPE);

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      expect(library.size).toBe(2);
    });

    it("loads .md files recursively from nested directories", async () => {
      await writeRecipe(tempDir, "top-level.md", SIMPLE_RECIPE);
      const subDir = join(tempDir, "subfolder");
      await mkdir(subDir);
      await writeRecipe(subDir, "nested.md", DESSERT_RECIPE);

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      expect(library.size).toBe(2);
    });

    it("skips non-.md files", async () => {
      await writeRecipe(tempDir, "recipe.md", SIMPLE_RECIPE);
      await writeFile(join(tempDir, "notes.txt"), "not a recipe", "utf-8");
      await writeFile(join(tempDir, "data.json"), "{}", "utf-8");

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      expect(library.size).toBe(1);
    });

    it("skips unparseable files without crashing", async () => {
      await writeRecipe(tempDir, "good.md", SIMPLE_RECIPE);
      // A file with no heading — parseRecipe should still handle it
      await writeFile(join(tempDir, "empty.md"), "", "utf-8");

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      // At minimum the good recipe loaded; empty may or may not parse
      expect(library.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("list", () => {
    it("returns all recipes sorted alphabetically by title", async () => {
      await writeRecipe(tempDir, "chocolate-cake.md", DESSERT_RECIPE);
      await writeRecipe(tempDir, "test-recipe.md", SIMPLE_RECIPE);
      await writeRecipe(tempDir, "minimal.md", MINIMAL_RECIPE);

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      const results = library.list();
      const titles = results.map((e) => e.recipe.title);
      expect(titles).toEqual(["Chocolate Cake", "Minimal Recipe", "Test Recipe"]);
    });

    it("filters by search term in title", async () => {
      await writeRecipe(tempDir, "chocolate-cake.md", DESSERT_RECIPE);
      await writeRecipe(tempDir, "test-recipe.md", SIMPLE_RECIPE);

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      const results = library.list({ search: "chocolate" });
      expect(results).toHaveLength(1);
      expect(results[0].recipe.title).toBe("Chocolate Cake");
    });

    it("filters by search term in ingredient names", async () => {
      await writeRecipe(tempDir, "chocolate-cake.md", DESSERT_RECIPE);
      await writeRecipe(tempDir, "test-recipe.md", SIMPLE_RECIPE);

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      const results = library.list({ search: "pasta" });
      expect(results).toHaveLength(1);
      expect(results[0].recipe.title).toBe("Test Recipe");
    });

    it("filters by tags (case-insensitive)", async () => {
      await writeRecipe(tempDir, "chocolate-cake.md", DESSERT_RECIPE);
      await writeRecipe(tempDir, "test-recipe.md", SIMPLE_RECIPE);

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      const results = library.list({ tags: ["Dessert"] });
      expect(results).toHaveLength(1);
      expect(results[0].recipe.title).toBe("Chocolate Cake");
    });
  });

  describe("get", () => {
    it("returns entry by slug", async () => {
      await writeRecipe(tempDir, "test-recipe.md", SIMPLE_RECIPE);

      library = new RecipeLibrary(tempDir);
      await library.initialize();

      const entry = library.get("test-recipe");
      expect(entry).toBeDefined();
      expect(entry!.recipe.title).toBe("Test Recipe");
      expect(entry!.slug).toBe("test-recipe");
    });

    it("returns undefined for unknown slug", async () => {
      library = new RecipeLibrary(tempDir);
      await library.initialize();

      expect(library.get("nonexistent")).toBeUndefined();
    });
  });

  describe("add", () => {
    it("writes file to disk and adds to index", async () => {
      library = new RecipeLibrary(tempDir);
      await library.initialize();

      const recipe = {
        title: "New Recipe",
        ingredientGroups: [{ ingredients: [{ name: "flour", quantity: 200, unit: "g" }] }],
        steps: [{ number: 1, paragraphs: ["Mix everything."] }],
      };

      const entry = await library.add(recipe);

      expect(entry.slug).toBe("new-recipe");
      expect(entry.recipe.title).toBe("New Recipe");
      expect(library.size).toBe(1);
      expect(library.get("new-recipe")).toBeDefined();

      // Verify file was written to disk
      const filePath = join(tempDir, "new-recipe.md");
      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("# New Recipe");
    });

    it("slugifies titles with special characters", async () => {
      library = new RecipeLibrary(tempDir);
      await library.initialize();

      const recipe = {
        title: "Grandma's Best Mac & Cheese!",
        ingredientGroups: [],
        steps: [],
      };

      const entry = await library.add(recipe);
      expect(entry.slug).toBe("grandma-s-best-mac-cheese");
    });
  });
});
