import { describe, it, expect } from "vitest";
import { extractFromJsonLd } from "../src/ingest/jsonld.js";

describe("extractFromJsonLd", () => {
  it("extracts a recipe from a basic JSON-LD script", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Recipe",
          "name": "Chocolate Cake",
          "description": "A rich chocolate cake.",
          "recipeIngredient": ["200g flour", "100g sugar", "50g cocoa powder"],
          "recipeInstructions": [
            {"@type": "HowToStep", "text": "Mix the dry ingredients."},
            {"@type": "HowToStep", "text": "Add wet ingredients and stir."},
            {"@type": "HowToStep", "text": "Bake at 180°C for 30 minutes."}
          ],
          "recipeYield": "8",
          "prepTime": "PT15M",
          "cookTime": "PT30M"
        }
        </script>
      </head><body></body></html>
    `;

    const recipe = extractFromJsonLd(html);
    expect(recipe).toBeDefined();
    expect(recipe!.title).toBe("Chocolate Cake");
    expect(recipe!.description).toBe("A rich chocolate cake.");
    expect(recipe!.ingredientGroups).toHaveLength(1);
    expect(recipe!.ingredientGroups[0].ingredients).toHaveLength(3);
    expect(recipe!.ingredientGroups[0].ingredients[0]).toEqual({
      quantity: 200,
      unit: "g",
      name: "flour",
    });
    expect(recipe!.steps).toHaveLength(3);
    expect(recipe!.steps[0].paragraphs[0]).toBe("Mix the dry ingredients.");
    expect(recipe!.serves).toBe("8");
    expect(recipe!.time).toEqual({ prep: 15, cook: 30 });
  });

  it("handles @graph wrapper", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {"@type": "WebPage", "name": "My Blog"},
            {
              "@type": "Recipe",
              "name": "Pasta",
              "recipeIngredient": ["200g spaghetti"],
              "recipeInstructions": [{"@type": "HowToStep", "text": "Cook it."}]
            }
          ]
        }
        </script>
      </head><body></body></html>
    `;

    const recipe = extractFromJsonLd(html);
    expect(recipe).toBeDefined();
    expect(recipe!.title).toBe("Pasta");
  });

  it("extracts keywords as tags", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Soup",
          "keywords": "soup, comfort food, winter",
          "recipeIngredient": ["1 onion"],
          "recipeInstructions": ["Cook it."]
        }
        </script>
      </head><body></body></html>
    `;

    const recipe = extractFromJsonLd(html);
    expect(recipe!.tags).toEqual(["soup", "comfort food", "winter"]);
  });

  it("extracts nutrition data", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Salad",
          "recipeIngredient": ["lettuce"],
          "recipeInstructions": ["Eat it."],
          "nutrition": {
            "@type": "NutritionInformation",
            "calories": "150 calories",
            "proteinContent": "5g",
            "fatContent": "8g"
          }
        }
        </script>
      </head><body></body></html>
    `;

    const recipe = extractFromJsonLd(html);
    expect(recipe!.nutrition).toEqual({
      calories: 150,
      protein: 5,
      fat: 8,
    });
  });

  it("handles plain string instructions", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Quick Meal",
          "recipeIngredient": ["food"],
          "recipeInstructions": ["Step 1: Do this.", "Step 2: Do that."]
        }
        </script>
      </head><body></body></html>
    `;

    const recipe = extractFromJsonLd(html);
    expect(recipe!.steps).toHaveLength(2);
    expect(recipe!.steps[0].paragraphs[0]).toBe("Step 1: Do this.");
  });

  it("returns undefined when no JSON-LD is present", () => {
    const html = "<html><body><h1>Not a recipe</h1></body></html>";
    expect(extractFromJsonLd(html)).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{ broken json }</script>
      </head><body></body></html>
    `;
    expect(extractFromJsonLd(html)).toBeUndefined();
  });

  it("handles recipeYield as '4 servings'", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Stew",
          "recipeYield": "4 servings",
          "recipeIngredient": ["beef"],
          "recipeInstructions": ["Cook."]
        }
        </script>
      </head><body></body></html>
    `;

    const recipe = extractFromJsonLd(html);
    expect(recipe!.serves).toBe("4");
  });

  it("strips HTML from instruction text", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Test",
          "recipeIngredient": ["stuff"],
          "recipeInstructions": [
            {"@type": "HowToStep", "text": "Mix <b>well</b> until <i>smooth</i>."}
          ]
        }
        </script>
      </head><body></body></html>
    `;

    const recipe = extractFromJsonLd(html);
    expect(recipe!.steps[0].paragraphs[0]).toBe("Mix well until smooth.");
  });
});
