import { describe, it, expect } from "vitest";
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

describe("serialiseRecipe", () => {
  it("serialises a full recipe to canonical format", () => {
    const output = serialiseRecipe(fullRecipe);

    expect(output).toContain("# Spaghetti Carbonara\n");
    expect(output).toContain(
      "\nA classic Roman pasta dish. Rich, creamy, and made without any cream.\n",
    );
    expect(output).toContain("\n![Spaghetti Carbonara](spaghetti-carbonara.jpg)\n");
    expect(output).toContain("\nSource: https://example.com/carbonara\n");
    expect(output).toContain("\nTags: pasta, italian, weeknight\n");
    expect(output).toContain("\nServes: 4\n");
    expect(output).toContain("\nTime: 10 mins prep | 20 mins cook\n");
    expect(output).toContain(
      "\nCalories: 520 | Protein: 22g | Carbs: 61g | Fat: 18g | Fibre: 2g\n",
    );
    expect(output).toContain("\n## Ingredients\n");
    expect(output).toContain("\n### Pasta\n");
    expect(output).toContain("\n- 200g spaghetti\n");
    expect(output).toContain("\n### Sauce\n");
    expect(output).toContain("\n- 4 egg yolks\n");
    expect(output).toContain("\n- 100g guanciale\n");
    expect(output).toContain("\n- 50g pecorino romano, finely grated\n");
    expect(output).toContain("\n- Black pepper, to taste\n");
    expect(output).toContain("\n## Method\n");
    expect(output).toContain("1. Bring a large pot");
    expect(output).toContain("2. Meanwhile, fry the guanciale");
    expect(output).toContain(
      "\n   You want good colour and rendered fat",
    );
    expect(output).toContain("\n## Notes\n");
    expect(output).toContain("\nGuanciale can be substituted");
  });

  it("handles a minimal recipe (title + ingredients + steps only)", () => {
    const minimal: Recipe = {
      title: "Toast",
      ingredientGroups: [
        {
          ingredients: [
            { quantity: 1, name: "slice of bread" },
          ],
        },
      ],
      steps: [{ number: 1, paragraphs: ["Toast the bread."] }],
    };

    const output = serialiseRecipe(minimal);
    expect(output).toBe(
      `# Toast

## Ingredients

- 1 slice of bread

## Method

1. Toast the bread.
`,
    );
  });

  it("handles ungrouped ingredients (no title)", () => {
    const recipe: Recipe = {
      title: "Simple Salad",
      ingredientGroups: [
        {
          ingredients: [
            { quantity: 1, name: "lettuce head" },
            { quantity: 2, name: "tomatoes" },
          ],
        },
      ],
      steps: [{ number: 1, paragraphs: ["Chop and mix."] }],
    };

    const output = serialiseRecipe(recipe);
    // No ### subheading for ungrouped
    expect(output).not.toContain("###");
    expect(output).toContain("- 1 lettuce head\n- 2 tomatoes");
  });

  it("handles partial nutrition", () => {
    const recipe: Recipe = {
      title: "Snack",
      nutrition: { calories: 150, protein: 5 },
      ingredientGroups: [],
      steps: [],
    };

    const output = serialiseRecipe(recipe);
    expect(output).toContain("Calories: 150 | Protein: 5g");
    expect(output).not.toContain("Carbs");
    expect(output).not.toContain("Fat");
  });

  it("handles prep-only and cook-only time", () => {
    const prepOnly: Recipe = {
      title: "Salad",
      time: { prep: 5 },
      ingredientGroups: [],
      steps: [],
    };
    expect(serialiseRecipe(prepOnly)).toContain("Time: 5 mins prep");
    expect(serialiseRecipe(prepOnly)).not.toContain("|");

    const cookOnly: Recipe = {
      title: "Roast",
      time: { cook: 60 },
      ingredientGroups: [],
      steps: [],
    };
    expect(serialiseRecipe(cookOnly)).toContain("Time: 60 mins cook");
  });

  it("outputs valid markdown that ends with a newline", () => {
    const output = serialiseRecipe(fullRecipe);
    expect(output.endsWith("\n")).toBe(true);
    expect(output.endsWith("\n\n")).toBe(false);
  });
});
