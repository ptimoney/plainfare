import { describe, it, expect } from "vitest";
import { ingestFromUrl } from "../src/ingest/url.js";

function mockFetch(html: string): typeof globalThis.fetch {
  return async () =>
    new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
}

const JSON_LD_PAGE = `
<html>
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": "Simple Soup",
    "description": "A warming bowl of soup.",
    "url": "https://example.com/soup",
    "keywords": "soup, easy, winter",
    "recipeYield": "4",
    "prepTime": "PT10M",
    "cookTime": "PT20M",
    "recipeIngredient": [
      "1 onion, diced",
      "2 carrots, chopped",
      "500ml vegetable stock",
      "Salt and pepper"
    ],
    "recipeInstructions": [
      {"@type": "HowToStep", "text": "Sauté the onion until soft."},
      {"@type": "HowToStep", "text": "Add carrots and stock, bring to boil."},
      {"@type": "HowToStep", "text": "Simmer for 20 minutes. Season to taste."}
    ],
    "nutrition": {
      "@type": "NutritionInformation",
      "calories": "180 calories",
      "proteinContent": "4g"
    }
  }
  </script>
</head>
<body>
  <h1>Simple Soup</h1>
  <p>A bunch of blog content here...</p>
</body>
</html>
`;

const HTML_ONLY_PAGE = `
<html>
<body>
  <article class="recipe">
    <h1>Quick Bruschetta</h1>
    <p>A simple Italian starter.</p>
    <p>Serves: 4</p>
    <h2>Ingredients</h2>
    <ul>
      <li>4 slices of bread</li>
      <li>2 tomatoes, diced</li>
      <li>1 clove garlic</li>
      <li>2 tbsp olive oil</li>
      <li>Fresh basil</li>
    </ul>
    <h2>Method</h2>
    <ol>
      <li>Toast the bread.</li>
      <li>Rub with garlic.</li>
      <li>Top with tomatoes, oil, and basil.</li>
    </ol>
  </article>
</body>
</html>
`;

describe("ingestFromUrl", () => {
  describe("JSON-LD path", () => {
    it("extracts recipe via JSON-LD when available", async () => {
      const result = await ingestFromUrl("https://example.com/soup", {
        fetch: mockFetch(JSON_LD_PAGE),
      });

      expect(result.method).toBe("json-ld");
      expect(result.sourceUrl).toBe("https://example.com/soup");
      expect(result.recipe.title).toBe("Simple Soup");
      expect(result.recipe.description).toBe("A warming bowl of soup.");
      expect(result.recipe.tags).toEqual(["soup", "easy", "winter"]);
      expect(result.recipe.serves).toBe("4");
      expect(result.recipe.time).toEqual({ prep: 10, cook: 20 });
      expect(result.recipe.nutrition).toEqual({ calories: 180, protein: 4 });
    });

    it("parses ingredients from JSON-LD", async () => {
      const result = await ingestFromUrl("https://example.com/soup", {
        fetch: mockFetch(JSON_LD_PAGE),
      });

      const ings = result.recipe.ingredientGroups[0].ingredients;
      expect(ings).toHaveLength(4);
      expect(ings[0]).toEqual({ quantity: 1, name: "onion", note: "diced" });
      expect(ings[2]).toEqual({ quantity: 500, unit: "ml", name: "vegetable stock" });
    });

    it("parses steps from JSON-LD", async () => {
      const result = await ingestFromUrl("https://example.com/soup", {
        fetch: mockFetch(JSON_LD_PAGE),
      });

      expect(result.recipe.steps).toHaveLength(3);
      expect(result.recipe.steps[0].paragraphs[0]).toBe("Sauté the onion until soft.");
    });

    it("has high confidence", async () => {
      const result = await ingestFromUrl("https://example.com/soup", {
        fetch: mockFetch(JSON_LD_PAGE),
      });

      expect(result.confidence.overallConfidence).toBeGreaterThan(0.8);
      expect(result.confidence.usedLLMFallback).toBe(false);
    });

    it("reports usedBrowser as false for plain fetch", async () => {
      const result = await ingestFromUrl("https://example.com/soup", {
        fetch: mockFetch(JSON_LD_PAGE),
      });

      expect(result.usedBrowser).toBe(false);
    });
  });

  describe("HTML fallback path", () => {
    it("falls back to HTML parsing when no JSON-LD", async () => {
      const result = await ingestFromUrl("https://example.com/bruschetta", {
        fetch: mockFetch(HTML_ONLY_PAGE),
      });

      expect(result.method).toBe("html-fallback");
      expect(result.recipe.title).toBe("Quick Bruschetta");
      expect(result.recipe.description).toBe("A simple Italian starter.");
    });

    it("extracts ingredients from HTML", async () => {
      const result = await ingestFromUrl("https://example.com/bruschetta", {
        fetch: mockFetch(HTML_ONLY_PAGE),
      });

      const ings = result.recipe.ingredientGroups[0].ingredients;
      expect(ings.length).toBeGreaterThanOrEqual(4);
    });

    it("extracts steps from HTML", async () => {
      const result = await ingestFromUrl("https://example.com/bruschetta", {
        fetch: mockFetch(HTML_ONLY_PAGE),
      });

      expect(result.recipe.steps).toHaveLength(3);
      expect(result.recipe.steps[0].paragraphs[0]).toContain("Toast the bread");
    });

    it("sets source URL", async () => {
      const result = await ingestFromUrl("https://example.com/bruschetta", {
        fetch: mockFetch(HTML_ONLY_PAGE),
      });

      expect(result.recipe.source).toBe("https://example.com/bruschetta");
    });
  });

  describe("browser fallback", () => {
    it("falls back to browser when plain fetch returns non-2xx", async () => {
      const failFetch = async () =>
        new Response("Forbidden", { status: 403, statusText: "Forbidden" });

      const browserFetch = async () => JSON_LD_PAGE;

      const result = await ingestFromUrl("https://example.com/blocked", {
        fetch: failFetch as typeof fetch,
        browserFetch,
      });

      expect(result.usedBrowser).toBe(true);
      expect(result.method).toBe("json-ld");
      expect(result.recipe.title).toBe("Simple Soup");
    });

    it("uses browser directly when useBrowser is set", async () => {
      const browserFetch = async () => JSON_LD_PAGE;

      const result = await ingestFromUrl("https://example.com/soup", {
        useBrowser: true,
        browserFetch,
      });

      expect(result.usedBrowser).toBe(true);
      expect(result.recipe.title).toBe("Simple Soup");
    });

    it("uses HTML fallback when browser returns page without JSON-LD", async () => {
      const failFetch = async () =>
        new Response("Blocked", { status: 403, statusText: "Forbidden" });

      const browserFetch = async () => HTML_ONLY_PAGE;

      const result = await ingestFromUrl("https://example.com/blocked", {
        fetch: failFetch as typeof fetch,
        browserFetch,
      });

      expect(result.usedBrowser).toBe(true);
      expect(result.method).toBe("html-fallback");
      expect(result.recipe.title).toBe("Quick Bruschetta");
    });
  });

  describe("error handling", () => {
    it("throws on HTTP error when no browser fallback available", async () => {
      const failFetch = async () =>
        new Response("Not Found", { status: 404, statusText: "Not Found" });

      const failBrowser = async () => {
        throw new Error("Browser failed too");
      };

      await expect(
        ingestFromUrl("https://example.com/404", {
          fetch: failFetch as typeof fetch,
          browserFetch: failBrowser,
        }),
      ).rejects.toThrow("404");
    });
  });
});
