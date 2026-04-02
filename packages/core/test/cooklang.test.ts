import { describe, it, expect } from "vitest";
import { parseCooklang, serialiseRecipe } from "../src/index.js";

describe("parseCooklang", () => {
  it("parses a basic Cooklang recipe", () => {
    const source = `>> title: Scrambled Eggs
>> servings: 2
>> tags: breakfast, quick
>> source: https://example.com

Crack @eggs{3} into a #bowl{} and whisk with a #fork{}.

Melt @butter{1%tbsp} in a #pan{} over low heat.

Pour in the eggs and stir gently with a #spatula{} for ~{3%minutes}.

Season with @salt{} and @black pepper{} to taste.
`;

    const { recipe, confidence } = parseCooklang(source);

    expect(recipe.title).toBe("Scrambled Eggs");
    expect(recipe.serves).toBe("2");
    expect(recipe.tags).toEqual(["breakfast", "quick"]);
    expect(recipe.source).toBe("https://example.com");

    // Ingredients extracted from inline annotations
    const names = recipe.ingredientGroups[0].ingredients.map((i) => i.name);
    expect(names).toContain("eggs");
    expect(names).toContain("butter");
    expect(names).toContain("salt");
    expect(names).toContain("black pepper");

    // Butter has quantity and unit
    const butter = recipe.ingredientGroups[0].ingredients.find((i) => i.name === "butter");
    expect(butter?.quantity).toBe(1);
    expect(butter?.unit).toBe("tbsp");

    // Eggs have quantity
    const eggs = recipe.ingredientGroups[0].ingredients.find((i) => i.name === "eggs");
    expect(eggs?.quantity).toBe(3);

    // Steps are cleaned of Cooklang syntax
    expect(recipe.steps).toHaveLength(4);
    expect(recipe.steps[0].paragraphs[0]).not.toContain("@");
    expect(recipe.steps[0].paragraphs[0]).toContain("eggs");

    expect(confidence.overallConfidence).toBeGreaterThan(0.5);
  });

  it("handles fractions in quantities", () => {
    const source = `>> title: Toast
Spread @butter{1/2%tbsp} on @bread{2} slices.
`;

    const { recipe } = parseCooklang(source);
    const butter = recipe.ingredientGroups[0].ingredients.find((i) => i.name === "butter");
    expect(butter?.quantity).toBe(0.5);
    expect(butter?.unit).toBe("tbsp");
  });

  it("handles comments", () => {
    const source = `>> title: Simple
-- This is a comment
Boil @water{500%ml}.
[- This is a
block comment -]
Add @pasta{200%g}.
`;

    const { recipe } = parseCooklang(source);
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.ingredientGroups[0].ingredients).toHaveLength(2);
  });

  it("deduplicates ingredients", () => {
    const source = `>> title: Pasta
Boil @water{500%ml} in a #pot{}.
Add @salt{1%tsp} to the water.
Drain and add more @salt{1%tsp}.
`;

    const { recipe } = parseCooklang(source);
    const salts = recipe.ingredientGroups[0].ingredients.filter((i) => i.name === "salt");
    expect(salts).toHaveLength(1);
  });

  it("serialises to canonical markdown", () => {
    const source = `>> title: Quick Omelette
>> servings: 1
>> tags: breakfast, eggs

Beat @eggs{3} with @milk{2%tbsp}.
Cook in a #pan{} with @butter{1%tbsp} for ~{2%minutes}.
`;

    const { recipe } = parseCooklang(source);
    const md = serialiseRecipe(recipe);

    expect(md).toContain("# Quick Omelette");
    expect(md).toContain("Tags: breakfast, eggs");
    expect(md).toContain("Serves: 1");
    expect(md).toContain("## Ingredients");
    expect(md).toContain("## Method");
    expect(md).toContain("eggs");
  });

  it("handles recipe with no metadata", () => {
    const source = `Slice @bread{2} and toast.`;

    const { recipe, confidence } = parseCooklang(source);
    expect(recipe.title).toBe("");
    expect(recipe.steps).toHaveLength(1);
    expect(confidence.fields.title).toBe("missing");
  });
});
