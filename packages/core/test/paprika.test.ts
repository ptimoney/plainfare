import { describe, it, expect } from "vitest";
import { zipSync, gzipSync } from "fflate";
import { parsePaprikaArchive } from "../src/ingest/paprika.js";

function buildPaprikaArchive(recipes: Record<string, unknown>[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  recipes.forEach((recipe, i) => {
    const json = JSON.stringify(recipe);
    const compressed = gzipSync(new TextEncoder().encode(json));
    entries[`recipe_${i}.paprikarecipe`] = compressed;
  });
  return zipSync(entries);
}

describe("parsePaprikaArchive", () => {
  it("parses a single recipe with all fields", () => {
    const archive = buildPaprikaArchive([
      {
        name: "Banana Pancakes",
        ingredients: "2 ripe bananas\n200g plain flour\n1 tsp baking powder",
        directions: "Mash the bananas.\n\nMix in flour and baking powder.\n\nCook in a pan.",
        categories: ["breakfast", "sweet"],
        source_url: "https://example.com/pancakes",
        servings: "4",
        prep_time: "10 minutes",
        cook_time: "15 minutes",
        nutritional_info: "350 calories, 8g protein, 45g carbs, 12g fat",
        notes: "Top with maple syrup.",
        image_url: "https://example.com/pancakes.jpg",
        description: "Fluffy pancakes with banana.",
      },
    ]);

    const results = parsePaprikaArchive(archive);
    expect(results).toHaveLength(1);

    const recipe = results[0].recipe;
    expect(recipe.title).toBe("Banana Pancakes");
    expect(recipe.description).toBe("Fluffy pancakes with banana.");
    expect(recipe.image).toBe("https://example.com/pancakes.jpg");
    expect(recipe.source).toBe("https://example.com/pancakes");
    expect(recipe.tags).toEqual(["breakfast", "sweet"]);
    expect(recipe.serves).toBe("4");
    expect(recipe.time).toEqual({ prep: 10, cook: 15 });
    expect(recipe.nutrition).toEqual({ calories: 350, protein: 8, carbs: 45, fat: 12 });
    expect(recipe.ingredientGroups).toHaveLength(1);
    expect(recipe.ingredientGroups[0].ingredients).toHaveLength(3);
    expect(recipe.ingredientGroups[0].ingredients[0].name).toBe("ripe bananas");
    expect(recipe.steps).toHaveLength(3);
    expect(recipe.steps[0].paragraphs[0]).toBe("Mash the bananas.");
    expect(recipe.notes).toBe("Top with maple syrup.");

    expect(results[0].confidence.usedLLMFallback).toBe(false);
  });

  it("parses multiple recipes", () => {
    const archive = buildPaprikaArchive([
      { name: "Recipe A", ingredients: "1 egg", directions: "Cook." },
      { name: "Recipe B", ingredients: "2 eggs", directions: "Fry." },
    ]);

    const results = parsePaprikaArchive(archive);
    expect(results).toHaveLength(2);
    expect(results[0].recipe.title).toBe("Recipe A");
    expect(results[1].recipe.title).toBe("Recipe B");
  });

  it("handles missing optional fields", () => {
    const archive = buildPaprikaArchive([
      { name: "Simple" },
    ]);

    const results = parsePaprikaArchive(archive);
    expect(results).toHaveLength(1);
    expect(results[0].recipe.title).toBe("Simple");
    expect(results[0].recipe.ingredientGroups).toEqual([]);
    expect(results[0].recipe.steps).toEqual([]);
    expect(results[0].recipe.tags).toBeUndefined();
  });

  it("parses various time formats", () => {
    const archive = buildPaprikaArchive([
      { name: "T1", prep_time: "1:30", cook_time: "45 min" },
    ]);

    const results = parsePaprikaArchive(archive);
    expect(results[0].recipe.time).toEqual({ prep: 90, cook: 45 });
  });

  it("falls back to source when source_url is missing", () => {
    const archive = buildPaprikaArchive([
      { name: "Test", source: "Grandma's cookbook" },
    ]);

    const results = parsePaprikaArchive(archive);
    expect(results[0].recipe.source).toBe("Grandma's cookbook");
  });

  it("handles an empty archive", () => {
    const archive = zipSync({});
    const results = parsePaprikaArchive(archive);
    expect(results).toEqual([]);
  });
});
