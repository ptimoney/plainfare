import type { Ingredient } from "../types.js";

const KNOWN_UNITS = [
  "kg", "g", "mg",
  "l", "ml", "dl",
  "lb", "lbs", "oz",
  "cup", "cups",
  "tbsp", "tsp",
  "pinch", "pinches",
  "bunch", "bunches",
  "handful", "handfuls",
  "clove", "cloves",
  "slice", "slices",
  "piece", "pieces",
  "can", "cans",
  "bottle", "bottles",
  "packet", "packets",
  "sprig", "sprigs",
  "stick", "sticks",
  "sheet", "sheets",
];

// Matches: "200g", "2 cups", "1.5kg", "100 ml"
// Group 1: quantity, Group 2: unit (stuck to number like "200g"), Group 3: unit (space-separated like "2 cups")
const QTY_UNIT_RE = new RegExp(
  `^(\\d+(?:\\.\\d+)?)\\s*(?:(${KNOWN_UNITS.join("|")})\\b)?`,
  "i",
);

// Matches: "a handful of", "a pinch of"
const A_UNIT_OF_RE = new RegExp(
  `^a\\s+(${KNOWN_UNITS.join("|")})\\s+of\\s+`,
  "i",
);

export function parseIngredientLine(line: string): Ingredient {
  const trimmed = line.replace(/^[-*]\s*/, "").trim();

  if (!trimmed) {
    return { name: "" };
  }

  // Split off note after last comma (but only if what follows looks like a note, not part of the name)
  const { main, note } = splitNote(trimmed);

  // Try "a handful of parsley" pattern
  const aMatch = A_UNIT_OF_RE.exec(main);
  if (aMatch) {
    const unit = aMatch[1].toLowerCase();
    const name = main.slice(aMatch[0].length).trim();
    return { quantity: 1, unit, name, ...(note && { note }) };
  }

  // Try numeric quantity with optional unit
  const match = QTY_UNIT_RE.exec(main);
  if (match && match[1]) {
    const quantity = parseFloat(match[1]);
    const unit = match[2]?.toLowerCase();
    let rest = main.slice(match[0].length).trim();

    // If no unit was captured stuck to the number, check if the next word is a unit
    if (!unit) {
      const spaceUnitRe = new RegExp(
        `^(${KNOWN_UNITS.join("|")})\\b\\s*`,
        "i",
      );
      const spaceMatch = spaceUnitRe.exec(rest);
      if (spaceMatch) {
        let name = rest.slice(spaceMatch[0].length).trim();
        // Strip leading "of " (e.g. "1 handful of parsley" → "parsley")
        name = name.replace(/^of\s+/i, "");
        return {
          quantity,
          unit: spaceMatch[1].toLowerCase(),
          name,
          ...(note && { note }),
        };
      }
    }

    // Strip leading "of " when unit was captured (e.g. "1 handful of basil")
    if (unit) {
      rest = rest.replace(/^of\s+/i, "");
    }

    return {
      quantity,
      ...(unit && { unit }),
      name: rest || main,
      ...(note && { note }),
    };
  }

  // No quantity found — whole string is the name
  return { name: main, ...(note && { note }) };
}

function splitNote(text: string): { main: string; note?: string } {
  const lastComma = text.lastIndexOf(",");
  if (lastComma === -1) return { main: text };

  const afterComma = text.slice(lastComma + 1).trim();
  // Heuristic: a note is short-ish freeform text, not another ingredient component
  // If the part after the comma starts with a number, it's probably not a note
  if (/^\d/.test(afterComma)) return { main: text };

  return {
    main: text.slice(0, lastComma).trim(),
    note: afterComma,
  };
}
