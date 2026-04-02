import { describe, it, expect } from "vitest";
import { generateShoppingList, formatShoppingList } from "../src/index.js";
import type { Recipe } from "../src/index.js";

function makeRecipe(ingredients: { quantity?: number; unit?: string; name: string; note?: string }[]): Recipe {
  return {
    title: "Test",
    ingredientGroups: [{ ingredients }],
    steps: [],
  };
}

describe("generateShoppingList", () => {
  it("merges same ingredient + unit across recipes", () => {
    const r1 = makeRecipe([{ quantity: 200, unit: "g", name: "flour" }]);
    const r2 = makeRecipe([{ quantity: 100, unit: "g", name: "flour" }]);
    const list = generateShoppingList([r1, r2]);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("flour");
    expect(list[0].quantities[0].quantity).toBe(300);
  });

  it("keeps different units for the same ingredient separate", () => {
    const r1 = makeRecipe([{ quantity: 2, unit: "cups", name: "milk" }]);
    const r2 = makeRecipe([{ quantity: 100, unit: "ml", name: "milk" }]);
    const list = generateShoppingList([r1, r2]);
    expect(list).toHaveLength(1);
    expect(list[0].quantities).toHaveLength(2);
  });

  it("handles ingredients without quantities", () => {
    const r = makeRecipe([{ name: "salt" }, { name: "pepper" }]);
    const list = generateShoppingList([r]);
    expect(list).toHaveLength(2);
    expect(list.find((i) => i.name === "salt")?.quantities).toHaveLength(0);
  });

  it("is case-insensitive for merging", () => {
    const r1 = makeRecipe([{ quantity: 1, unit: "tsp", name: "Salt" }]);
    const r2 = makeRecipe([{ quantity: 2, unit: "tsp", name: "salt" }]);
    const list = generateShoppingList([r1, r2]);
    expect(list).toHaveLength(1);
    expect(list[0].quantities[0].quantity).toBe(3);
  });

  it("sorts alphabetically", () => {
    const r = makeRecipe([
      { quantity: 1, name: "zucchini" },
      { quantity: 2, name: "apple" },
      { quantity: 3, name: "banana" },
    ]);
    const list = generateShoppingList([r]);
    expect(list.map((i) => i.name)).toEqual(["apple", "banana", "zucchini"]);
  });

  it("preserves notes from first occurrence", () => {
    const r = makeRecipe([{ quantity: 100, unit: "g", name: "cheese", note: "grated" }]);
    const list = generateShoppingList([r]);
    expect(list[0].note).toBe("grated");
  });
});

describe("formatShoppingList", () => {
  it("formats as markdown checklist", () => {
    const list = generateShoppingList([
      makeRecipe([
        { quantity: 200, unit: "g", name: "flour" },
        { quantity: 3, name: "eggs" },
        { name: "salt" },
      ]),
    ]);
    const md = formatShoppingList(list);
    expect(md).toContain("- [ ] 3 eggs");
    expect(md).toContain("- [ ] 200g flour");
    expect(md).toContain("- [ ] salt");
  });
});
