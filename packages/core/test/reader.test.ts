import { describe, it, expect } from "vitest";
import { parseRecipe } from "../src/ingest/markdown.js";
import { serialiseRecipe } from "../src/functions/serialise.js";
import type { Recipe } from "../src/types.js";

const fullRecipe: Recipe = {
  title: "Spaghetti Carbonara",
  description:
    "A classic Roman pasta dish. Rich, creamy, and made without any cream.",
  image: "spaghetti-carbonara.jpg",
  source: "https://example.com/carbonara",
  tags: ["pasta", "italian", "weeknight"],
  serves: "4",
  time: { prep: 10, cook: 20 },
  nutrition: { calories: 520, protein: 22, carbs: 61, fat: 18, fibre: 2 },
  ingredientGroups: [
    {
      title: "Pasta",
      ingredients: [{ quantity: 200, unit: "g", name: "spaghetti" }],
    },
    {
      title: "Sauce",
      ingredients: [
        { quantity: 4, name: "egg yolks" },
        { quantity: 100, unit: "g", name: "guanciale" },
        {
          quantity: 50,
          unit: "g",
          name: "pecorino romano",
          note: "finely grated",
        },
        { name: "Black pepper", note: "to taste" },
      ],
    },
  ],
  steps: [
    {
      number: 1,
      paragraphs: [
        "Bring a large pot of salted water to the boil and cook the spaghetti until al dente.",
      ],
    },
    {
      number: 2,
      paragraphs: [
        "Meanwhile, fry the guanciale in a dry pan over medium heat until crispy.",
        "You want good colour and rendered fat, which will form part of the sauce.",
      ],
    },
    {
      number: 3,
      paragraphs: [
        "Whisk the egg yolks with the pecorino and a generous amount of black pepper. The mixture should be thick and pale.",
      ],
    },
  ],
  notes:
    "Guanciale can be substituted with pancetta in a pinch, though the flavour is noticeably different. Never use cream.",
};

describe("parseRecipe", () => {
  it("round-trips a full recipe through writer → reader", () => {
    const markdown = serialiseRecipe(fullRecipe);
    const result = parseRecipe(markdown);

    expect(result.recipe.title).toBe("Spaghetti Carbonara");
    expect(result.recipe.description).toBe(fullRecipe.description);
    expect(result.recipe.image).toBe("spaghetti-carbonara.jpg");
    expect(result.recipe.source).toBe("https://example.com/carbonara");
    expect(result.recipe.tags).toEqual(["pasta", "italian", "weeknight"]);
    expect(result.recipe.serves).toBe("4");
    expect(result.recipe.time).toEqual({ prep: 10, cook: 20 });
    expect(result.recipe.nutrition).toEqual({
      calories: 520,
      protein: 22,
      carbs: 61,
      fat: 18,
      fibre: 2,
    });
    expect(result.recipe.notes).toBe(fullRecipe.notes);
  });

  it("round-trips ingredient groups", () => {
    const markdown = serialiseRecipe(fullRecipe);
    const result = parseRecipe(markdown);
    const groups = result.recipe.ingredientGroups;

    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe("Pasta");
    expect(groups[0].ingredients).toHaveLength(1);
    expect(groups[0].ingredients[0]).toEqual({
      quantity: 200,
      unit: "g",
      name: "spaghetti",
    });

    expect(groups[1].title).toBe("Sauce");
    expect(groups[1].ingredients).toHaveLength(4);
    expect(groups[1].ingredients[0]).toEqual({
      quantity: 4,
      name: "egg yolks",
    });
    expect(groups[1].ingredients[3]).toEqual({
      name: "Black pepper",
      note: "to taste",
    });
  });

  it("round-trips method steps including multi-paragraph", () => {
    const markdown = serialiseRecipe(fullRecipe);
    const result = parseRecipe(markdown);
    const steps = result.recipe.steps;

    expect(steps).toHaveLength(3);
    expect(steps[0].number).toBe(1);
    expect(steps[0].paragraphs).toHaveLength(1);

    // Multi-paragraph step
    expect(steps[1].number).toBe(2);
    expect(steps[1].paragraphs).toHaveLength(2);
    expect(steps[1].paragraphs[0]).toContain("fry the guanciale");
    expect(steps[1].paragraphs[1]).toContain("good colour");
  });

  it("parses a minimal recipe", () => {
    const md = `# Toast

## Ingredients

- 1 slice of bread

## Method

1. Toast the bread.
`;
    const result = parseRecipe(md);
    expect(result.recipe.title).toBe("Toast");
    expect(result.recipe.ingredientGroups).toHaveLength(1);
    expect(result.recipe.steps).toHaveLength(1);
    expect(result.confidence.fields.title).toBe("resolved");
    expect(result.confidence.fields.description).toBe("missing");
  });

  it("marks confidence for resolved and missing fields", () => {
    const markdown = serialiseRecipe(fullRecipe);
    const result = parseRecipe(markdown);

    expect(result.confidence.fields.title).toBe("resolved");
    expect(result.confidence.fields.description).toBe("resolved");
    expect(result.confidence.fields.ingredientGroups).toBe("resolved");
    expect(result.confidence.fields.steps).toBe("resolved");
    expect(result.confidence.fields.notes).toBe("resolved");
    expect(result.confidence.usedLLMFallback).toBe(false);
    expect(result.confidence.overallConfidence).toBeGreaterThan(0.8);
  });

  it("handles recipe with no metadata", () => {
    const md = `# Plain Recipe

Just a description.

## Ingredients

- Salt

## Method

1. Use the salt.
`;
    const result = parseRecipe(md);
    expect(result.recipe.title).toBe("Plain Recipe");
    expect(result.recipe.description).toBe("Just a description.");
    expect(result.recipe.source).toBeUndefined();
    expect(result.recipe.tags).toBeUndefined();
    expect(result.confidence.fields.source).toBe("missing");
    expect(result.confidence.fields.tags).toBe("missing");
  });

  it("handles partial nutrition", () => {
    const md = `# Snack

Calories: 150 | Protein: 5g

## Ingredients

- 1 apple

## Method

1. Eat the apple.
`;
    const result = parseRecipe(md);
    expect(result.recipe.nutrition).toEqual({ calories: 150, protein: 5 });
  });

  it("handles prep-only time", () => {
    const md = `# Salad

Time: 5 mins prep

## Ingredients

- 1 lettuce

## Method

1. Chop.
`;
    const result = parseRecipe(md);
    expect(result.recipe.time).toEqual({ prep: 5 });
  });
});
