import { describe, it, expect } from "vitest";
import { scaleRecipe } from "../src/functions/scale.js";
import type { Recipe } from "../src/types.js";

const BASE_RECIPE: Recipe = {
  title: "Pasta Carbonara",
  serves: "4",
  ingredientGroups: [
    {
      title: "Pasta",
      ingredients: [
        { quantity: 400, unit: "g", name: "spaghetti" },
      ],
    },
    {
      title: "Sauce",
      ingredients: [
        { quantity: 4, name: "egg yolks" },
        { quantity: 200, unit: "g", name: "guanciale" },
        { quantity: 100, unit: "g", name: "pecorino romano", note: "finely grated" },
        { name: "Black pepper", note: "to taste" },
      ],
    },
  ],
  steps: [
    { number: 1, paragraphs: ["Cook the pasta."] },
    { number: 2, paragraphs: ["Make the sauce."] },
  ],
  nutrition: {
    calories: 520,
    protein: 22,
    carbs: 61,
    fat: 18,
    fibre: 2,
  },
};

describe("scaleRecipe", () => {
  it("doubles a recipe from 4 to 8 servings", () => {
    const scaled = scaleRecipe(BASE_RECIPE, 8);

    expect(scaled.serves).toBe("8");
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe(800); // 400g → 800g
    expect(scaled.ingredientGroups[1].ingredients[0].quantity).toBe(8); // 4 eggs → 8
    expect(scaled.ingredientGroups[1].ingredients[1].quantity).toBe(400); // 200g → 400g
  });

  it("halves a recipe from 4 to 2 servings", () => {
    const scaled = scaleRecipe(BASE_RECIPE, 2);

    expect(scaled.serves).toBe("2");
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe(200);
    expect(scaled.ingredientGroups[1].ingredients[0].quantity).toBe(2);
    expect(scaled.ingredientGroups[1].ingredients[2].quantity).toBe(50); // 100g → 50g
  });

  it("scales to non-even servings (4 → 6)", () => {
    const scaled = scaleRecipe(BASE_RECIPE, 6);

    expect(scaled.serves).toBe("6");
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe(600);
    expect(scaled.ingredientGroups[1].ingredients[0].quantity).toBe(6); // 4 → 6
    expect(scaled.ingredientGroups[1].ingredients[1].quantity).toBe(300); // 200 → 300
  });

  it("preserves ingredients without quantities", () => {
    const scaled = scaleRecipe(BASE_RECIPE, 8);

    const pepper = scaled.ingredientGroups[1].ingredients[3];
    expect(pepper.name).toBe("Black pepper");
    expect(pepper.quantity).toBeUndefined();
    expect(pepper.note).toBe("to taste");
  });

  it("scales nutrition values", () => {
    const scaled = scaleRecipe(BASE_RECIPE, 8);

    expect(scaled.nutrition).toEqual({
      calories: 1040,
      protein: 44,
      carbs: 122,
      fat: 36,
      fibre: 4,
    });
  });

  it("rounds small quantities sensibly", () => {
    const recipe: Recipe = {
      title: "Test",
      serves: "4",
      ingredientGroups: [{
        ingredients: [
          { quantity: 1, unit: "tsp", name: "salt" },
          { quantity: 0.5, unit: "tsp", name: "pepper" },
          { quantity: 15, unit: "ml", name: "oil" },
        ],
      }],
      steps: [],
    };

    const scaled = scaleRecipe(recipe, 3);
    // ratio = 3/4 = 0.75
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe(0.75); // 1 × 0.75
    expect(scaled.ingredientGroups[0].ingredients[1].quantity).toBe(0.38); // 0.5 × 0.75 = 0.375 → 0.38
    expect(scaled.ingredientGroups[0].ingredients[2].quantity).toBe(11); // 15 × 0.75 = 11.25 → 11
  });

  it("handles recipe with no serves field (treats target as multiplier, adds note)", () => {
    const recipe: Recipe = {
      title: "Quick Snack",
      ingredientGroups: [{
        ingredients: [
          { quantity: 2, name: "eggs" },
          { quantity: 50, unit: "g", name: "cheese" },
        ],
      }],
      steps: [{ number: 1, paragraphs: ["Scramble."] }],
    };

    const scaled = scaleRecipe(recipe, 3);
    expect(scaled.serves).toBeUndefined();
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe(6); // 2 × 3
    expect(scaled.ingredientGroups[0].ingredients[1].quantity).toBe(150); // 50 × 3
    expect(scaled.notes).toBe("Scaled: 3x from original");
  });

  it("compounds multiplier on successive scales without serves", () => {
    const recipe: Recipe = {
      title: "Quick Snack",
      ingredientGroups: [{
        ingredients: [
          { quantity: 2, name: "eggs" },
        ],
      }],
      steps: [{ number: 1, paragraphs: ["Scramble."] }],
    };

    const first = scaleRecipe(recipe, 3);
    expect(first.notes).toBe("Scaled: 3x from original");
    expect(first.ingredientGroups[0].ingredients[0].quantity).toBe(6);

    const second = scaleRecipe(first, 2);
    expect(second.notes).toBe("Scaled: 6x from original");
    expect(second.ingredientGroups[0].ingredients[0].quantity).toBe(12);
  });

  it("appends scale note to existing notes", () => {
    const recipe: Recipe = {
      title: "Quick Snack",
      notes: "Best served warm.",
      ingredientGroups: [{
        ingredients: [{ quantity: 1, name: "egg" }],
      }],
      steps: [],
    };

    const scaled = scaleRecipe(recipe, 2);
    expect(scaled.notes).toBe("Best served warm.\n\nScaled: 2x from original");
  });

  it("handles serves string like '4 servings'", () => {
    const recipe: Recipe = {
      ...BASE_RECIPE,
      serves: "4 servings",
    };

    const scaled = scaleRecipe(recipe, 8);
    expect(scaled.ingredientGroups[0].ingredients[0].quantity).toBe(800);
  });

  it("does not mutate the original recipe", () => {
    const original = JSON.parse(JSON.stringify(BASE_RECIPE));
    scaleRecipe(BASE_RECIPE, 8);
    expect(BASE_RECIPE).toEqual(original);
  });

  it("preserves non-ingredient fields", () => {
    const scaled = scaleRecipe(BASE_RECIPE, 8);

    expect(scaled.title).toBe("Pasta Carbonara");
    expect(scaled.steps).toHaveLength(2);
    expect(scaled.ingredientGroups[0].title).toBe("Pasta");
    expect(scaled.ingredientGroups[1].title).toBe("Sauce");
  });
});
