import { describe, it, expect } from "vitest";
import { parseIngredientLine } from "../src/ingest/ingredient.js";

describe("parseIngredientLine", () => {
  it("parses quantity + unit stuck together: 200g spaghetti", () => {
    expect(parseIngredientLine("200g spaghetti")).toEqual({
      quantity: 200,
      unit: "g",
      name: "spaghetti",
    });
  });

  it("parses quantity + unit with space: 2 cups flour", () => {
    expect(parseIngredientLine("2 cups flour")).toEqual({
      quantity: 2,
      unit: "cups",
      name: "flour",
    });
  });

  it("parses quantity without unit: 4 egg yolks", () => {
    expect(parseIngredientLine("4 egg yolks")).toEqual({
      quantity: 4,
      name: "egg yolks",
    });
  });

  it("parses name with note: 50g pecorino romano, finely grated", () => {
    expect(parseIngredientLine("50g pecorino romano, finely grated")).toEqual({
      quantity: 50,
      unit: "g",
      name: "pecorino romano",
      note: "finely grated",
    });
  });

  it("parses name-only: Black pepper, to taste", () => {
    expect(parseIngredientLine("Black pepper, to taste")).toEqual({
      name: "Black pepper",
      note: "to taste",
    });
  });

  it("parses 'a handful of' pattern", () => {
    expect(parseIngredientLine("a handful of parsley")).toEqual({
      quantity: 1,
      unit: "handful",
      name: "parsley",
    });
  });

  it("strips list marker prefix", () => {
    expect(parseIngredientLine("- 200g spaghetti")).toEqual({
      quantity: 200,
      unit: "g",
      name: "spaghetti",
    });
  });

  it("handles decimal quantities: 1.5kg chicken", () => {
    expect(parseIngredientLine("1.5kg chicken")).toEqual({
      quantity: 1.5,
      unit: "kg",
      name: "chicken",
    });
  });
});
