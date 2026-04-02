import { describe, it, expect } from "vitest";
import { parseAiRecipeResponse, buildImageExtractionPrompt, buildTextExtractionPrompt, buildNutritionEstimationPrompt, parseNutritionResponse } from "../src/ingest/ai.js";

describe("buildImageExtractionPrompt", () => {
  it("returns a non-empty prompt string", () => {
    const prompt = buildImageExtractionPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain("ingredientGroups");
    expect(prompt).toContain("JSON");
  });
});

describe("buildTextExtractionPrompt", () => {
  it("returns a non-empty prompt with JSON schema", () => {
    const prompt = buildTextExtractionPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain("ingredientGroups");
    expect(prompt).toContain("JSON");
  });

  it("instructs parsing text, not images", () => {
    const prompt = buildTextExtractionPrompt();
    expect(prompt).toContain("Parse the provided recipe text");
    expect(prompt).not.toContain("Extract the recipe from the provided image");
  });

  it("shares the same schema as the image prompt", () => {
    const textPrompt = buildTextExtractionPrompt();
    const imagePrompt = buildImageExtractionPrompt();
    // Both should contain the same JSON schema fields
    for (const field of ["title", "ingredientGroups", "steps", "serves", "nutrition"]) {
      expect(textPrompt).toContain(field);
      expect(imagePrompt).toContain(field);
    }
  });
});

describe("parseAiRecipeResponse", () => {
  it("parses a complete AI response", () => {
    const response = JSON.stringify({
      title: "Banana Pancakes",
      description: "Fluffy pancakes with ripe bananas.",
      serves: "4",
      time: { prep: 10, cook: 15 },
      nutrition: { calories: 350, protein: 8, carbs: 45, fat: 12, fibre: 2 },
      ingredientGroups: [
        {
          title: null,
          ingredients: [
            { quantity: 2, unit: null, name: "ripe bananas", note: "mashed" },
            { quantity: 200, unit: "g", name: "plain flour", note: null },
            { quantity: 1, unit: "tsp", name: "baking powder", note: null },
            { quantity: 250, unit: "ml", name: "milk", note: null },
            { quantity: 1, unit: null, name: "egg", note: null },
          ],
        },
      ],
      steps: [
        { number: 1, paragraphs: ["Mash the bananas in a large bowl."] },
        { number: 2, paragraphs: ["Mix in flour, baking powder, milk, and egg until smooth."] },
        { number: 3, paragraphs: ["Heat a pan over medium heat and cook spoonfuls of batter until golden on both sides."] },
      ],
      notes: "Top with maple syrup and fresh berries.",
    });

    const result = parseAiRecipeResponse(response);

    expect(result.recipe.title).toBe("Banana Pancakes");
    expect(result.recipe.description).toBe("Fluffy pancakes with ripe bananas.");
    expect(result.recipe.serves).toBe("4");
    expect(result.recipe.time).toEqual({ prep: 10, cook: 15 });
    expect(result.recipe.nutrition).toEqual({ calories: 350, protein: 8, carbs: 45, fat: 12, fibre: 2 });
    expect(result.recipe.ingredientGroups).toHaveLength(1);
    expect(result.recipe.ingredientGroups[0].ingredients).toHaveLength(5);
    expect(result.recipe.ingredientGroups[0].ingredients[0]).toEqual({
      quantity: 2,
      name: "ripe bananas",
      note: "mashed",
    });
    expect(result.recipe.steps).toHaveLength(3);
    expect(result.recipe.notes).toBe("Top with maple syrup and fresh berries.");

    // All fields should be inferred (AI source)
    expect(result.confidence.usedLLMFallback).toBe(true);
    for (const [, level] of Object.entries(result.confidence.fields)) {
      expect(["inferred", "missing"]).toContain(level);
    }
  });

  it("parses a minimal response (title + ingredients + steps only)", () => {
    const response = JSON.stringify({
      title: "Toast",
      ingredientGroups: [
        {
          ingredients: [
            { name: "bread", quantity: 2, unit: "slices" },
            { name: "butter" },
          ],
        },
      ],
      steps: [
        { number: 1, paragraphs: ["Toast the bread."] },
        { number: 2, paragraphs: ["Spread with butter."] },
      ],
    });

    const result = parseAiRecipeResponse(response);

    expect(result.recipe.title).toBe("Toast");
    expect(result.recipe.ingredientGroups).toHaveLength(1);
    expect(result.recipe.ingredientGroups[0].ingredients).toHaveLength(2);
    expect(result.recipe.steps).toHaveLength(2);
    expect(result.recipe.description).toBeUndefined();
    expect(result.recipe.serves).toBeUndefined();
    expect(result.confidence.fields.title).toBe("inferred");
    expect(result.confidence.fields.description).toBe("missing");
  });

  it("handles grouped ingredients", () => {
    const response = JSON.stringify({
      title: "Layered Cake",
      ingredientGroups: [
        {
          title: "Sponge",
          ingredients: [
            { quantity: 200, unit: "g", name: "flour" },
            { quantity: 200, unit: "g", name: "sugar" },
          ],
        },
        {
          title: "Icing",
          ingredients: [
            { quantity: 300, unit: "g", name: "icing sugar" },
            { quantity: 50, unit: "g", name: "butter", note: "softened" },
          ],
        },
      ],
      steps: [{ number: 1, paragraphs: ["Bake and ice."] }],
    });

    const result = parseAiRecipeResponse(response);

    expect(result.recipe.ingredientGroups).toHaveLength(2);
    expect(result.recipe.ingredientGroups[0].title).toBe("Sponge");
    expect(result.recipe.ingredientGroups[1].title).toBe("Icing");
    expect(result.recipe.ingredientGroups[1].ingredients[1].note).toBe("softened");
  });

  it("strips markdown code fences from response", () => {
    const response = '```json\n{"title":"Soup","ingredientGroups":[{"ingredients":[{"name":"water"}]}],"steps":[{"number":1,"paragraphs":["Boil."]}]}\n```';

    const result = parseAiRecipeResponse(response);
    expect(result.recipe.title).toBe("Soup");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAiRecipeResponse("not json at all")).toThrow();
  });

  it("handles missing title gracefully", () => {
    const response = JSON.stringify({
      ingredientGroups: [{ ingredients: [{ name: "egg" }] }],
      steps: [{ number: 1, paragraphs: ["Cook."] }],
    });

    const result = parseAiRecipeResponse(response);
    expect(result.recipe.title).toBe("Untitled Recipe");
    expect(result.confidence.fields.title).toBe("inferred"); // "Untitled Recipe" is truthy
  });
});

describe("buildNutritionEstimationPrompt", () => {
  it("returns a prompt mentioning nutrition fields", () => {
    const prompt = buildNutritionEstimationPrompt();
    expect(prompt).toContain("calories");
    expect(prompt).toContain("protein");
    expect(prompt).toContain("carbs");
    expect(prompt).toContain("fat");
    expect(prompt).toContain("fibre");
    expect(prompt).toContain("JSON");
  });
});

describe("parseNutritionResponse", () => {
  it("parses valid JSON with all fields", () => {
    const response = JSON.stringify({
      calories: 520,
      protein: 22,
      carbs: 61,
      fat: 18,
      fibre: 2.4,
    });
    const result = parseNutritionResponse(response);
    expect(result).toEqual({ calories: 520, protein: 22, carbs: 61, fat: 18, fibre: 2 });
  });

  it("parses code-fenced JSON", () => {
    const response = '```json\n{"calories": 350, "protein": 12, "carbs": 40, "fat": 15, "fibre": 3}\n```';
    const result = parseNutritionResponse(response);
    expect(result).toEqual({ calories: 350, protein: 12, carbs: 40, fat: 15, fibre: 3 });
  });

  it("handles partial fields", () => {
    const response = JSON.stringify({ calories: 200, protein: 10 });
    const result = parseNutritionResponse(response);
    expect(result).toEqual({ calories: 200, protein: 10 });
  });

  it("returns null for empty object", () => {
    const result = parseNutritionResponse("{}");
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseNutritionResponse("not json");
    expect(result).toBeNull();
  });

  it("rounds values to nearest whole number", () => {
    const response = JSON.stringify({ calories: 521.7, protein: 22.3 });
    const result = parseNutritionResponse(response);
    expect(result).toEqual({ calories: 522, protein: 22 });
  });
});
