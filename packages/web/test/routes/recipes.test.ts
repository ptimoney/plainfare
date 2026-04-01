import { describe, it, expect } from "vitest";
import { recipesRouter } from "../../src/server/routes/recipes.js";
import { initTRPC } from "@trpc/server";
import type { AppContext } from "../../src/server/trpc.js";

// Create a caller for testing without HTTP
const t = initTRPC.context<AppContext>().create();
const caller = t.createCallerFactory(recipesRouter);

function makeEntry(slug: string, title: string, tags?: string[]) {
  return {
    filePath: `/recipes/${slug}.md`,
    slug,
    recipe: {
      title,
      tags,
      ingredientGroups: [],
      steps: [],
    },
    confidence: { fields: {}, overallConfidence: 1, usedLLMFallback: false },
    lastModified: new Date(),
  };
}

const mockEntries = [
  makeEntry("pasta", "Pasta Carbonara", ["italian", "dinner"]),
  makeEntry("cake", "Chocolate Cake", ["dessert"]),
];

function createMockLibrary() {
  return {
    list: (options?: { tags?: string[]; search?: string }) => {
      let results = [...mockEntries];
      if (options?.search) {
        const q = options.search.toLowerCase();
        results = results.filter((e) => e.recipe.title.toLowerCase().includes(q));
      }
      if (options?.tags?.length) {
        const filterTags = options.tags.map((t) => t.toLowerCase());
        results = results.filter((e) =>
          e.recipe.tags?.some((t) => filterTags.includes(t.toLowerCase())),
        );
      }
      return results;
    },
    get: (slug: string) => mockEntries.find((e) => e.slug === slug),
  } as unknown as AppContext["library"];
}

const mockConfig = {} as AppContext["config"];

describe("recipes router", () => {
  const ctx: AppContext = { library: createMockLibrary(), config: mockConfig };
  const trpc = caller(ctx);

  it("list() returns all recipes", async () => {
    const result = await trpc.list();
    expect(result).toHaveLength(2);
  });

  it("list({ search }) filters by search term", async () => {
    const result = await trpc.list({ search: "pasta" });
    expect(result).toHaveLength(1);
    expect(result[0].recipe.title).toBe("Pasta Carbonara");
  });

  it("get() returns entry by slug", async () => {
    const result = await trpc.get({ slug: "cake" });
    expect(result.recipe.title).toBe("Chocolate Cake");
  });

  it("get() throws for unknown slug", async () => {
    await expect(trpc.get({ slug: "nonexistent" })).rejects.toThrow("Recipe not found");
  });
});
