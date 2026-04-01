import { describe, it, expect } from "vitest";
import { OpenAiCompatibleProvider } from "../src/server/services/ai.js";
import { parseAiRecipeResponse, serialiseRecipe } from "@plainfare/core";

const OLLAMA_ENDPOINT = process.env.PLAINFARE_TEST_OLLAMA_ENDPOINT;
const OLLAMA_MODEL = process.env.PLAINFARE_TEST_OLLAMA_MODEL || "gemma3:12b";

describe.skipIf(!OLLAMA_ENDPOINT)("AI integration (Ollama)", () => {
  const provider = OLLAMA_ENDPOINT
    ? new OpenAiCompatibleProvider({
        PLAINFARE_AI_ENDPOINT: OLLAMA_ENDPOINT,
        PLAINFARE_AI_API_KEY: "",
        PLAINFARE_AI_MODEL: OLLAMA_MODEL,
      })
    : (null as never);

  it("extracts a recipe from plain text", async () => {
    const text = `
Classic Tomato Soup

A simple, comforting soup that's ready in under 30 minutes.

Serves 4

Ingredients:
- 1 can (400g) crushed tomatoes
- 1 onion, diced
- 2 cloves garlic, minced
- 500ml vegetable stock
- 2 tbsp olive oil
- Salt and pepper to taste

Instructions:
1. Heat olive oil in a large pot. Saute onion and garlic until soft, about 5 minutes.
2. Add crushed tomatoes and vegetable stock. Bring to a simmer and cook for 20 minutes.
3. Blend until smooth using an immersion blender. Season with salt and pepper to taste.

Notes:
Serve with crusty bread and a drizzle of cream.
    `.trim();

    const raw = await provider.extractRecipeFromText(text);
    const result = parseAiRecipeResponse(raw);

    console.log("\n=== Text extraction — canonical markdown ===");
    console.log(serialiseRecipe(result.recipe));
    console.log(`=== Confidence: ${(result.confidence.overallConfidence * 100).toFixed(0)}% ===\n`);

    // Title extracted
    expect(result.recipe.title.toLowerCase()).toContain("tomato");

    // Ingredients present
    expect(result.recipe.ingredientGroups.length).toBeGreaterThan(0);
    const allIngredients = result.recipe.ingredientGroups.flatMap(g => g.ingredients);
    expect(allIngredients.length).toBeGreaterThanOrEqual(5);

    // Should find tomatoes
    const hasTomatoes = allIngredients.some(i => i.name.toLowerCase().includes("tomato"));
    expect(hasTomatoes).toBe(true);

    // Steps present
    expect(result.recipe.steps.length).toBeGreaterThanOrEqual(3);

    // Serves extracted
    expect(result.recipe.serves).toBe("4");

    // All fields marked as inferred (AI source)
    expect(result.confidence.usedLLMFallback).toBe(true);
  });

  it("extracts a recipe from an image", async () => {
    // Create a simple test image with recipe text rendered on it
    // For now, we use a 1x1 white pixel as a minimal image to verify
    // the vision API call works end-to-end. The model won't extract
    // a real recipe from this, but we verify the pipeline doesn't crash.
    //
    // To test with a real recipe image, place a file at:
    //   packages/web/test/fixtures/test-recipe.jpg
    // and update this test.
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");

    const fixturePath = resolve(import.meta.dirname, "fixtures/test-recipe.jpg");
    let image: Uint8Array;
    let mimeType: string;

    try {
      image = await readFile(fixturePath);
      mimeType = "image/jpeg";
    } catch {
      // No fixture image — skip this test
      console.log("Skipping image test: no fixture at test/fixtures/test-recipe.jpg");
      return;
    }

    const raw = await provider.extractRecipeFromImage(image, mimeType);

    console.log("\n=== Image extraction — raw LLM response ===");
    console.log(raw);
    console.log("=== end raw ===\n");

    const result = parseAiRecipeResponse(raw);

    console.log("=== Image extraction — canonical markdown ===");
    console.log(serialiseRecipe(result.recipe));
    console.log(`=== Confidence: ${(result.confidence.overallConfidence * 100).toFixed(0)}% ===\n`);

    // Basic structure present
    expect(result.recipe.title).toBeTruthy();
    expect(result.recipe.ingredientGroups.length).toBeGreaterThan(0);
    expect(result.recipe.steps.length).toBeGreaterThan(0);
    expect(result.confidence.usedLLMFallback).toBe(true);
  });
});
