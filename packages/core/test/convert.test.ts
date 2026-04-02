import { describe, it, expect } from "vitest";
import { convertUnits } from "../src/index.js";
import type { Recipe } from "../src/index.js";

function makeRecipe(ingredients: { quantity?: number; unit?: string; name: string }[]): Recipe {
  return {
    title: "Test",
    ingredientGroups: [{ ingredients: ingredients.map((i) => ({ ...i })) }],
    steps: [],
  };
}

describe("convertUnits", () => {
  it("converts grams to ounces", () => {
    const recipe = makeRecipe([{ quantity: 200, unit: "g", name: "flour" }]);
    const result = convertUnits(recipe, "imperial");
    const flour = result.ingredientGroups[0].ingredients[0];
    expect(flour.unit).toBe("oz");
    expect(flour.quantity).toBeCloseTo(7, 0);
  });

  it("converts kg to lb", () => {
    const recipe = makeRecipe([{ quantity: 1, unit: "kg", name: "chicken" }]);
    const result = convertUnits(recipe, "imperial");
    const chicken = result.ingredientGroups[0].ingredients[0];
    expect(chicken.unit).toBe("lb");
    expect(chicken.quantity).toBeCloseTo(2.25, 1);
  });

  it("converts oz to grams", () => {
    const recipe = makeRecipe([{ quantity: 8, unit: "oz", name: "cheese" }]);
    const result = convertUnits(recipe, "metric");
    const cheese = result.ingredientGroups[0].ingredients[0];
    expect(cheese.unit).toBe("g");
    expect(cheese.quantity).toBeCloseTo(225, -1);
  });

  it("converts ml to cups/tbsp/tsp appropriately", () => {
    const recipe = makeRecipe([
      { quantity: 250, unit: "ml", name: "milk" },
      { quantity: 15, unit: "ml", name: "vanilla" },
      { quantity: 5, unit: "ml", name: "salt" },
    ]);
    const result = convertUnits(recipe, "imperial");
    const ings = result.ingredientGroups[0].ingredients;
    expect(ings[0].unit).toBe("cups");
    expect(ings[1].unit).toBe("tbsp");
    expect(ings[2].unit).toBe("tsp");
  });

  it("converts cups to ml", () => {
    const recipe = makeRecipe([{ quantity: 2, unit: "cups", name: "water" }]);
    const result = convertUnits(recipe, "metric");
    const water = result.ingredientGroups[0].ingredients[0];
    expect(water.unit).toBe("ml");
    expect(water.quantity).toBeCloseTo(475, -1);
  });

  it("leaves non-convertible units unchanged", () => {
    const recipe = makeRecipe([
      { quantity: 2, unit: "cloves", name: "garlic" },
      { name: "salt", quantity: 1, unit: "pinch" },
    ]);
    const result = convertUnits(recipe, "imperial");
    expect(result.ingredientGroups[0].ingredients[0].unit).toBe("cloves");
    expect(result.ingredientGroups[0].ingredients[1].unit).toBe("pinch");
  });

  it("leaves ingredients without units unchanged", () => {
    const recipe = makeRecipe([{ quantity: 3, name: "eggs" }]);
    const result = convertUnits(recipe, "imperial");
    expect(result.ingredientGroups[0].ingredients[0]).toEqual({ quantity: 3, name: "eggs" });
  });

  it("does not convert if already in target system", () => {
    const recipe = makeRecipe([{ quantity: 200, unit: "g", name: "flour" }]);
    const result = convertUnits(recipe, "metric");
    expect(result.ingredientGroups[0].ingredients[0]).toEqual({ quantity: 200, unit: "g", name: "flour" });
  });

  it("rounds to sensible display values", () => {
    // 1 cup = 236.588ml — should round to 235 or 240, not 236.588
    const recipe = makeRecipe([{ quantity: 1, unit: "cups", name: "water" }]);
    const result = convertUnits(recipe, "metric");
    const water = result.ingredientGroups[0].ingredients[0];
    expect(water.quantity).toBe(235);
    expect(Number.isInteger(water.quantity)).toBe(true);
  });
});
