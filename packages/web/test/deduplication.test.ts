import { describe, it, expect } from "vitest";
import { normalizedLevenshtein, jaccardSimilarity, findDuplicates } from "../src/server/services/deduplication.js";
import type { Recipe } from "@plainfare/core";

describe("normalizedLevenshtein", () => {
  it("returns 1 for identical strings", () => {
    expect(normalizedLevenshtein("hello", "hello")).toBe(1);
  });

  it("returns 1 for identical strings differing only in case", () => {
    expect(normalizedLevenshtein("Hello", "hello")).toBe(1);
  });

  it("returns 0 for completely different strings of equal length", () => {
    expect(normalizedLevenshtein("abc", "xyz")).toBe(0);
  });

  it("returns expected similarity for known pairs", () => {
    const sim = normalizedLevenshtein("kitten", "sitting");
    expect(sim).toBeGreaterThan(0.5);
    expect(sim).toBeLessThan(0.8);
  });

  it("returns 1 for two empty strings", () => {
    expect(normalizedLevenshtein("", "")).toBe(1);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical sets", () => {
    const set = new Set(["a", "b", "c"]);
    expect(jaccardSimilarity(set, set)).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
  });

  it("returns correct value for partial overlap", () => {
    const a = new Set(["a", "b", "c"]);
    const b = new Set(["b", "c", "d"]);
    // intersection = {b, c} = 2, union = {a, b, c, d} = 4
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });

  it("returns 1 for two empty sets", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });
});

function makeRecipe(title: string, ingredients: string[]): Recipe {
  return {
    title,
    ingredientGroups: [{
      ingredients: ingredients.map((name) => ({ name })),
    }],
    steps: [],
  };
}

describe("findDuplicates", () => {
  it("detects duplicates with similar titles and ingredients", () => {
    const entries = [
      { slug: "chicken-stir-fry", recipe: makeRecipe("Chicken Stir Fry", ["chicken", "soy sauce", "pepper"]) },
      { slug: "chicken-stirfry", recipe: makeRecipe("Chicken Stirfry", ["chicken", "soy sauce", "pepper", "garlic"]) },
      { slug: "banana-bread", recipe: makeRecipe("Banana Bread", ["banana", "flour", "sugar"]) },
    ];

    const results = findDuplicates(entries);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].slugA).toBe("chicken-stir-fry");
    expect(results[0].slugB).toBe("chicken-stirfry");
  });

  it("returns empty array for no duplicates", () => {
    const entries = [
      { slug: "a", recipe: makeRecipe("Chicken Soup", ["chicken", "celery"]) },
      { slug: "b", recipe: makeRecipe("Banana Bread", ["banana", "flour"]) },
    ];

    const results = findDuplicates(entries);
    expect(results).toEqual([]);
  });

  it("returns empty for a single recipe", () => {
    const results = findDuplicates([
      { slug: "a", recipe: makeRecipe("Test", ["flour"]) },
    ]);
    expect(results).toEqual([]);
  });

  it("sorts by combined score descending", () => {
    const entries = [
      { slug: "a", recipe: makeRecipe("Pasta Carbonara", ["pasta", "egg", "bacon"]) },
      { slug: "b", recipe: makeRecipe("Pasta Carbonara Classic", ["pasta", "egg", "guanciale", "pecorino"]) },
      { slug: "c", recipe: makeRecipe("Pasta Carbonara", ["pasta", "egg", "bacon"]) },
    ];

    const results = findDuplicates(entries);
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Perfect match should score highest
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].combinedScore).toBeGreaterThanOrEqual(results[i].combinedScore);
    }
  });
});
