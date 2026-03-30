import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, Content, Heading, Paragraph, List, Image } from "mdast";
import type {
  ParseResult,
  Recipe,
  RecipeTime,
  Nutrition,
  IngredientGroup,
  MethodStep,
  ConfidenceLevel,
} from "../types.js";
import { parseIngredientLine } from "./ingredient.js";
import { buildConfidenceReport } from "./confidence.js";

export function parseRecipe(markdown: string): ParseResult {
  const tree = unified().use(remarkParse).parse(markdown) as Root;
  const children = tree.children;

  const fields: Partial<Record<keyof Recipe, ConfidenceLevel>> = {};
  const recipe: Recipe = {
    title: "",
    ingredientGroups: [],
    steps: [],
  };

  // Phase 1: Find structural landmarks
  const h1Index = children.findIndex(
    (n) => n.type === "heading" && (n as Heading).depth === 1,
  );
  const ingredientsIndex = findH2(children, "ingredients");
  const methodIndex = findH2(children, "method");
  const notesIndex = findH2(children, "notes");

  // Title
  if (h1Index !== -1) {
    recipe.title = inlineToText((children[h1Index] as Heading).children);
    fields.title = "resolved";
  } else {
    fields.title = "missing";
  }

  // Preamble: everything between h1 and the first h2 (or end)
  const firstH2 = findFirstH2Index(children);
  const preambleEnd = firstH2 !== -1 ? firstH2 : children.length;
  const preamble = children.slice(h1Index + 1, preambleEnd);

  // Extract description, image, and metadata from preamble
  extractPreamble(preamble, recipe, fields);

  // Ingredients
  if (ingredientsIndex !== -1) {
    recipe.ingredientGroups = extractIngredients(children, ingredientsIndex);
    fields.ingredientGroups =
      recipe.ingredientGroups.length > 0 ? "resolved" : "missing";
  } else {
    fields.ingredientGroups = "missing";
  }

  // Method
  if (methodIndex !== -1) {
    recipe.steps = extractSteps(children, methodIndex);
    fields.steps = recipe.steps.length > 0 ? "resolved" : "missing";
  } else {
    fields.steps = "missing";
  }

  // Notes
  if (notesIndex !== -1) {
    recipe.notes = extractNotes(children, notesIndex, markdown);
    fields.notes = recipe.notes ? "resolved" : "missing";
  } else {
    fields.notes = "missing";
  }

  return {
    recipe,
    confidence: buildConfidenceReport(fields, false),
  };
}

// --- Preamble extraction ---

const METADATA_KEYS = ["source", "tags", "serves", "time", "calories"];

function extractPreamble(
  nodes: Content[],
  recipe: Recipe,
  fields: Partial<Record<keyof Recipe, ConfidenceLevel>>,
): void {
  let descriptionSet = false;

  for (const node of nodes) {
    // Image
    if (node.type === "paragraph") {
      const img = (node as Paragraph).children.find(
        (c) => c.type === "image",
      ) as Image | undefined;
      if (img) {
        recipe.image = img.url;
        fields.image = "resolved";
        continue;
      }
    }

    // Paragraph — could be description or metadata
    if (node.type === "paragraph") {
      const text = inlineToText((node as Paragraph).children);

      // Check if this paragraph contains metadata lines
      const metaLines = text.split("\n");
      const metaMatches = metaLines.filter((l) => isMetadataLine(l));

      if (metaMatches.length > 0) {
        // Process each line as potential metadata
        for (const line of metaLines) {
          parseMetadataLine(line, recipe, fields);
        }
        continue;
      }

      // First non-meta paragraph is the description
      if (!descriptionSet) {
        recipe.description = text;
        fields.description = "resolved";
        descriptionSet = true;
      }
    }
  }

  // Mark missing optional fields
  if (!fields.description) fields.description = "missing";
  if (!fields.image) fields.image = "missing";
  if (!fields.source) fields.source = "missing";
  if (!fields.tags) fields.tags = "missing";
  if (!fields.serves) fields.serves = "missing";
  if (!fields.time) fields.time = "missing";
  if (!fields.nutrition) fields.nutrition = "missing";
}

function isMetadataLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return METADATA_KEYS.some((key) => lower.startsWith(key + ":"));
}

function parseMetadataLine(
  line: string,
  recipe: Recipe,
  fields: Partial<Record<keyof Recipe, ConfidenceLevel>>,
): void {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("source:")) {
    recipe.source = trimmed.slice("source:".length).trim();
    fields.source = "resolved";
  } else if (lower.startsWith("tags:")) {
    recipe.tags = trimmed
      .slice("tags:".length)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    fields.tags = "resolved";
  } else if (lower.startsWith("serves:")) {
    recipe.serves = trimmed.slice("serves:".length).trim();
    fields.serves = "resolved";
  } else if (lower.startsWith("time:")) {
    recipe.time = parseTime(trimmed.slice("time:".length));
    fields.time = "resolved";
  } else if (lower.startsWith("calories:")) {
    // Nutrition line starts with "Calories:" and uses pipe delimiters
    recipe.nutrition = parseNutrition(trimmed);
    fields.nutrition = "resolved";
  }
}

function parseTime(value: string): RecipeTime {
  const time: RecipeTime = {};
  const parts = value.split("|").map((p) => p.trim());
  for (const part of parts) {
    const match = /(\d+)\s*mins?\s*(prep|cook)/i.exec(part);
    if (match) {
      const mins = parseInt(match[1], 10);
      if (match[2].toLowerCase() === "prep") time.prep = mins;
      else time.cook = mins;
    }
  }
  return time;
}

function parseNutrition(line: string): Nutrition {
  const nutrition: Nutrition = {};
  const parts = line.split("|").map((p) => p.trim());
  for (const part of parts) {
    const match = /(\w+):\s*(\d+)/i.exec(part);
    if (match) {
      const key = match[1].toLowerCase();
      const val = parseInt(match[2], 10);
      if (key === "calories") nutrition.calories = val;
      else if (key === "protein") nutrition.protein = val;
      else if (key === "carbs") nutrition.carbs = val;
      else if (key === "fat") nutrition.fat = val;
      else if (key === "fibre") nutrition.fibre = val;
    }
  }
  return nutrition;
}

// --- Ingredients ---

function extractIngredients(
  children: Content[],
  h2Index: number,
): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  const sectionEnd = findNextH2(children, h2Index);

  let currentGroup: IngredientGroup | null = null;

  for (let i = h2Index + 1; i < sectionEnd; i++) {
    const node = children[i];

    if (node.type === "heading" && (node as Heading).depth === 3) {
      // Start a new named group
      currentGroup = {
        title: inlineToText((node as Heading).children),
        ingredients: [],
      };
      groups.push(currentGroup);
    } else if (node.type === "list") {
      if (!currentGroup) {
        currentGroup = { ingredients: [] };
        groups.push(currentGroup);
      }
      for (const item of (node as List).children) {
        const text = listItemToText(item);
        currentGroup.ingredients.push(parseIngredientLine(text));
      }
    }
  }

  return groups;
}

// --- Method ---

function extractSteps(children: Content[], h2Index: number): MethodStep[] {
  const steps: MethodStep[] = [];
  const sectionEnd = findNextH2(children, h2Index);

  for (let i = h2Index + 1; i < sectionEnd; i++) {
    const node = children[i];
    if (node.type === "list" && (node as List).ordered) {
      const list = node as List;
      for (let j = 0; j < list.children.length; j++) {
        const item = list.children[j];
        const paragraphs: string[] = [];
        for (const child of item.children) {
          if (child.type === "paragraph") {
            paragraphs.push(inlineToText((child as Paragraph).children));
          }
        }
        if (paragraphs.length > 0) {
          steps.push({ number: steps.length + 1, paragraphs });
        }
      }
    }
  }

  return steps;
}

// --- Notes ---

function extractNotes(
  children: Content[],
  h2Index: number,
  markdown: string,
): string | undefined {
  const sectionEnd = findNextH2(children, h2Index);
  const parts: string[] = [];

  for (let i = h2Index + 1; i < sectionEnd; i++) {
    const node = children[i];
    if (node.position) {
      const text = markdown.slice(
        node.position.start.offset,
        node.position.end.offset,
      );
      parts.push(text);
    }
  }

  const joined = parts.join("\n\n").trim();
  return joined || undefined;
}

// --- Utility ---

function findH2(children: Content[], title: string): number {
  return children.findIndex(
    (n) =>
      n.type === "heading" &&
      (n as Heading).depth === 2 &&
      inlineToText((n as Heading).children).toLowerCase() === title,
  );
}

function findFirstH2Index(children: Content[]): number {
  return children.findIndex(
    (n) => n.type === "heading" && (n as Heading).depth === 2,
  );
}

function findNextH2(children: Content[], afterIndex: number): number {
  for (let i = afterIndex + 1; i < children.length; i++) {
    if (children[i].type === "heading" && (children[i] as Heading).depth === 2) {
      return i;
    }
  }
  return children.length;
}

function inlineToText(nodes: Content[]): string {
  return nodes
    .map((n) => {
      if ("value" in n) return (n as { value: string }).value;
      if ("children" in n) return inlineToText((n as { children: Content[] }).children);
      return "";
    })
    .join("");
}

function listItemToText(item: Content): string {
  if ("children" in item) {
    const children = (item as { children: Content[] }).children;
    return children
      .map((c) => {
        if (c.type === "paragraph") {
          return inlineToText((c as Paragraph).children);
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}
