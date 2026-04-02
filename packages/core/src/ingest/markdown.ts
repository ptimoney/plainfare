import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, Content, Heading, Paragraph, List, Image, ThematicBreak } from "mdast";
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

// Alternate names for canonical sections
const INGREDIENTS_NAMES = ["ingredients"];
const METHOD_NAMES = ["method", "directions", "instructions", "steps", "preparation"];
const NOTES_NAMES = ["notes", "tips", "tips and tricks"];

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

  // Look for section headings — real h2s first, then bold pseudo-headings
  let ingredientsIndex = findH2ByNames(children, INGREDIENTS_NAMES);
  let methodIndex = findH2ByNames(children, METHOD_NAMES);
  let notesIndex = findH2ByNames(children, NOTES_NAMES);

  // If we didn't find real headings, try bold pseudo-headings ("**Ingredients**")
  if (ingredientsIndex === -1 || methodIndex === -1) {
    const pseudo = findBoldPseudoHeadings(children);
    if (ingredientsIndex === -1) ingredientsIndex = pseudo.ingredients;
    if (methodIndex === -1) methodIndex = pseudo.method;
    if (notesIndex === -1) notesIndex = pseudo.notes;
  }

  // RecipeMD-style: thematic breaks (---) as section separators
  // First --- separates preamble from ingredients, second --- separates ingredients from method
  if (ingredientsIndex === -1 && methodIndex === -1) {
    const breaks = children
      .map((n, i) => (n.type === "thematicBreak" ? i : -1))
      .filter((i) => i > h1Index);
    if (breaks.length >= 2) {
      ingredientsIndex = breaks[0];
      methodIndex = breaks[1];
    } else if (breaks.length === 1) {
      // Single break: could separate preamble from ingredients+method
      // Check if there's a list before and an ordered list after
      ingredientsIndex = breaks[0];
    }
  }

  // Title
  if (h1Index !== -1) {
    recipe.title = inlineToText((children[h1Index] as Heading).children);
    fields.title = "resolved";
  } else {
    fields.title = "missing";
  }

  // Preamble: everything between h1 and the first section marker (or end)
  const firstSection = findFirstSectionIndex(children, ingredientsIndex, methodIndex, notesIndex);
  const preambleEnd = firstSection !== -1 ? firstSection : children.length;
  const preamble = children.slice(h1Index + 1, preambleEnd);

  // Extract description, image, and metadata from preamble
  extractPreamble(preamble, recipe, fields);

  // Ingredients — from heading, or infer from bare lists in the preamble
  if (ingredientsIndex !== -1) {
    const sectionEnd = findNextSectionIndex(children, ingredientsIndex, methodIndex, notesIndex);
    recipe.ingredientGroups = extractIngredients(children, ingredientsIndex, sectionEnd);
    fields.ingredientGroups =
      recipe.ingredientGroups.length > 0 ? "resolved" : "missing";
  } else {
    // Fallback: look for bare unordered lists anywhere before the method
    const inferred = inferIngredients(children, h1Index, methodIndex !== -1 ? methodIndex : children.length);
    if (inferred.length > 0) {
      recipe.ingredientGroups = inferred;
      fields.ingredientGroups = "inferred";
    } else {
      fields.ingredientGroups = "missing";
    }
  }

  // Method
  if (methodIndex !== -1) {
    const sectionEnd = findNextSectionIndex(children, methodIndex, notesIndex);
    recipe.steps = extractSteps(children, methodIndex, sectionEnd);
    fields.steps = recipe.steps.length > 0 ? "resolved" : "missing";
  } else {
    // Fallback: look for any ordered list, or a paragraph of imperative sentences
    const inferred = inferSteps(children, ingredientsIndex !== -1 ? ingredientsIndex : h1Index);
    if (inferred.length > 0) {
      recipe.steps = inferred;
      fields.steps = "inferred";
    } else {
      fields.steps = "missing";
    }
  }

  // Notes
  if (notesIndex !== -1) {
    const sectionEnd = findNextSectionIndex(children, notesIndex);
    recipe.notes = extractNotes(children, notesIndex, sectionEnd, markdown);
    fields.notes = recipe.notes ? "resolved" : "missing";
  } else {
    // Infer notes from trailing paragraphs after the last known section
    const lastSection = Math.max(ingredientsIndex, methodIndex);
    if (lastSection !== -1) {
      const notes = inferNotes(children, lastSection, markdown);
      if (notes) {
        recipe.notes = notes;
        fields.notes = "inferred";
      } else {
        fields.notes = "missing";
      }
    } else {
      fields.notes = "missing";
    }
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
  let seenList = false;

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

    // Track lists — paragraphs after a list are likely method, not description
    if (node.type === "list") {
      seenList = true;
      continue;
    }

    // Paragraph — could be description or metadata
    if (node.type === "paragraph") {
      const text = inlineToText((node as Paragraph).children);

      // Check if this paragraph contains metadata lines
      const metaLines = text.split("\n");
      const metaMatches = metaLines.filter((l) => isMetadataLine(l));

      if (metaMatches.length > 0) {
        // Process each line as potential metadata, splitting lines that
        // contain multiple keys (e.g. "Source: ... Tags: ... Serves: 4")
        for (const line of metaLines) {
          for (const part of splitMetadataKeys(line)) {
            parseMetadataLine(part, recipe, fields);
          }
        }
        continue;
      }

      // RecipeMD-style: *italic* paragraph as tags (comma-separated short words)
      // Must have commas and short items to distinguish from prose like "*Updated Dec 2024*"
      if (isPurelyEmphasis(node as Paragraph) && !fields.tags) {
        const tagText = inlineToText((node as Paragraph).children);
        if (tagText.includes(",")) {
          const parsed = tagText.split(",").map((t) => t.trim()).filter(Boolean);
          const allShort = parsed.every((t) => t.split(/\s+/).length <= 3);
          if (parsed.length >= 2 && allShort) {
            recipe.tags = parsed;
            fields.tags = "resolved";
            continue;
          }
        }
      }

      // RecipeMD-style: **bold** paragraph as yield/serves
      if (isPurelyStrong(node as Paragraph) && !fields.serves) {
        const yieldText = inlineToText((node as Paragraph).children);
        const yieldMatch = /^(\d[\d\s\-–]*)\s*(.*)$/.exec(yieldText.trim());
        if (yieldMatch) {
          recipe.serves = yieldText.trim();
          fields.serves = "resolved";
          continue;
        }
      }

      // Skip remaining purely-emphasis paragraphs (e.g. "*Updated Dec 2024*")
      if (isPurelyEmphasis(node as Paragraph)) continue;

      // Skip ingredient/method intro phrases ("You'll need:", "Here's what you need:", etc.)
      if (isIntroPhrase(text)) continue;

      // First substantive non-meta paragraph before any list is the description.
      // Paragraphs after a list are likely method prose, not description.
      if (!descriptionSet && !seenList) {
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

function isPurelyEmphasis(para: Paragraph): boolean {
  return (
    para.children.length === 1 &&
    para.children[0].type === "emphasis"
  );
}

function isPurelyStrong(para: Paragraph): boolean {
  return (
    para.children.length === 1 &&
    para.children[0].type === "strong"
  );
}

const INTRO_PHRASES = [
  /^you'?ll need:?$/i,
  /^what you'?ll need:?$/i,
  /^here'?s what you need:?$/i,
  /^ingredients:?$/i,
  /^for the .+:?$/i,
  /^you will need:?$/i,
  /^anyway,? here'?s what you need:?$/i,
];

function isIntroPhrase(text: string): boolean {
  const trimmed = text.trim();
  return INTRO_PHRASES.some((re) => re.test(trimmed));
}

function isMetadataLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return METADATA_KEYS.some((key) => lower.startsWith(key + ":"));
}

// Splits "Source: https://example.com Tags: a, b Serves: 4" into
// ["Source: https://example.com", "Tags: a, b", "Serves: 4"]
const METADATA_SPLIT_RE = new RegExp(
  `\\s+(?=(${METADATA_KEYS.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join("|")}):)`,
  "g",
);

function splitMetadataKeys(line: string): string[] {
  const parts = line.split(METADATA_SPLIT_RE).filter((p) => p.trim());
  // The split with a capture group includes the lookahead match as an element,
  // so filter to only parts that contain a colon (actual key:value pairs)
  return parts.filter((p) => p.includes(":"));
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
  sectionStart: number,
  sectionEnd: number,
): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  let currentGroup: IngredientGroup | null = null;

  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const node = children[i];

    if (node.type === "heading" && (node as Heading).depth === 3) {
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

// Fallback: find unordered lists that look like ingredient lists
function inferIngredients(
  children: Content[],
  afterIndex: number,
  beforeIndex: number,
): IngredientGroup[] {
  for (let i = afterIndex + 1; i < beforeIndex; i++) {
    const node = children[i];
    if (node.type === "list" && !(node as List).ordered) {
      const ingredients = [];
      for (const item of (node as List).children) {
        const text = listItemToText(item);
        ingredients.push(parseIngredientLine(text));
      }
      if (ingredients.length > 0) {
        return [{ ingredients }];
      }
    }
  }
  return [];
}

// --- Method ---

function extractSteps(
  children: Content[],
  sectionStart: number,
  sectionEnd: number,
): MethodStep[] {
  const steps: MethodStep[] = [];

  for (let i = sectionStart + 1; i < sectionEnd; i++) {
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

// Fallback: find ordered lists or prose paragraphs that look like steps
function inferSteps(
  children: Content[],
  afterIndex: number,
): MethodStep[] {
  // First try: find an ordered list anywhere after the given index
  for (let i = afterIndex + 1; i < children.length; i++) {
    const node = children[i];
    if (node.type === "list" && (node as List).ordered) {
      const steps: MethodStep[] = [];
      for (const item of (node as List).children) {
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
      if (steps.length > 0) return steps;
    }
  }

  // Second try: find a paragraph after all lists that reads like method prose
  // (treat it as a single step)
  let lastListIndex = -1;
  for (let i = children.length - 1; i > afterIndex; i--) {
    if (children[i].type === "list") {
      lastListIndex = i;
      break;
    }
  }
  if (lastListIndex !== -1) {
    const proseSteps: MethodStep[] = [];
    for (let i = lastListIndex + 1; i < children.length; i++) {
      if (children[i].type === "paragraph") {
        const text = inlineToText((children[i] as Paragraph).children);
        if (text.length > 20) {
          proseSteps.push({ number: proseSteps.length + 1, paragraphs: [text] });
        }
      }
    }
    if (proseSteps.length > 0) return proseSteps;
  }

  return [];
}

// Infer notes from trailing paragraphs after the last list in a section
function inferNotes(
  children: Content[],
  lastSectionIndex: number,
  markdown: string,
): string | undefined {
  // Find the last list node after the section heading
  let lastListEnd = -1;
  for (let i = lastSectionIndex + 1; i < children.length; i++) {
    if (children[i].type === "list") {
      lastListEnd = i;
    }
  }
  if (lastListEnd === -1) return undefined;

  // Collect paragraphs after the last list
  const parts: string[] = [];
  for (let i = lastListEnd + 1; i < children.length; i++) {
    const node = children[i];
    // Stop if we hit another section-like structure
    if (node.type === "heading") break;
    if (node.type === "paragraph" && node.position) {
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

// --- Notes ---

function extractNotes(
  children: Content[],
  sectionStart: number,
  sectionEnd: number,
  markdown: string,
): string | undefined {
  const parts: string[] = [];

  for (let i = sectionStart + 1; i < sectionEnd; i++) {
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

// --- Section finding ---

function findH2ByNames(children: Content[], names: string[]): number {
  return children.findIndex(
    (n) =>
      n.type === "heading" &&
      (n as Heading).depth === 2 &&
      names.includes(inlineToText((n as Heading).children).toLowerCase().trim()),
  );
}

// Find bold pseudo-headings like "**Ingredients**" or "**Ingredients:**"
function findBoldPseudoHeadings(children: Content[]): {
  ingredients: number;
  method: number;
  notes: number;
} {
  const result = { ingredients: -1, method: -1, notes: -1 };

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.type !== "paragraph") continue;

    const para = node as Paragraph;
    // Check if paragraph is a single bold/strong node
    if (
      para.children.length === 1 &&
      para.children[0].type === "strong"
    ) {
      const text = inlineToText(para.children[0].children as Content[])
        .toLowerCase()
        .replace(/:$/, "")
        .trim();

      if (INGREDIENTS_NAMES.includes(text) && result.ingredients === -1) {
        result.ingredients = i;
      } else if (METHOD_NAMES.includes(text) && result.method === -1) {
        result.method = i;
      } else if (NOTES_NAMES.includes(text) && result.notes === -1) {
        result.notes = i;
      }
    }
  }

  return result;
}

function findFirstSectionIndex(
  children: Content[],
  ...sectionIndices: number[]
): number {
  const valid = sectionIndices.filter((i) => i !== -1);
  if (valid.length === 0) {
    // No sections found — check for first h2 as fallback
    return children.findIndex(
      (n) => n.type === "heading" && (n as Heading).depth === 2,
    );
  }
  return Math.min(...valid);
}

function findNextSectionIndex(
  children: Content[],
  afterIndex: number,
  ...otherSections: number[]
): number {
  // Find the closest section index that comes after afterIndex
  const candidates = otherSections.filter((i) => i > afterIndex);

  // Also look for any h2 heading after afterIndex
  for (let i = afterIndex + 1; i < children.length; i++) {
    if (children[i].type === "heading" && (children[i] as Heading).depth === 2) {
      candidates.push(i);
    }
  }

  // Also consider bold pseudo-heading sections after afterIndex
  for (let i = afterIndex + 1; i < children.length; i++) {
    const node = children[i];
    if (node.type === "paragraph") {
      const para = node as Paragraph;
      if (para.children.length === 1 && para.children[0].type === "strong") {
        const text = inlineToText(para.children[0].children as Content[])
          .toLowerCase()
          .replace(/:$/, "")
          .trim();
        const allNames = [...INGREDIENTS_NAMES, ...METHOD_NAMES, ...NOTES_NAMES];
        if (allNames.includes(text)) {
          candidates.push(i);
        }
      }
    }
  }

  if (candidates.length === 0) return children.length;
  return Math.min(...candidates);
}

// --- Utility ---

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
