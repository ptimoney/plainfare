import type { Recipe } from "@plainfare/core";

export interface DuplicateCandidate {
  slugA: string;
  slugB: string;
  titleA: string;
  titleB: string;
  titleSimilarity: number;
  ingredientSimilarity: number;
  combinedScore: number;
}

/**
 * Normalised Levenshtein distance — 1 = identical, 0 = completely different.
 */
export function normalizedLevenshtein(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;

  // DP matrix — only two rows needed
  let prev = Array.from({ length: lb.length + 1 }, (_, j) => j);
  let curr = new Array(lb.length + 1);

  for (let i = 1; i <= la.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb.length; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[lb.length];
  return 1 - distance / maxLen;
}

/**
 * Jaccard similarity on two string sets — 1 = identical, 0 = disjoint.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function ingredientNames(recipe: Recipe): Set<string> {
  const names = new Set<string>();
  for (const group of recipe.ingredientGroups) {
    for (const ing of group.ingredients) {
      names.add(ing.name.toLowerCase().trim());
    }
  }
  return names;
}

const TITLE_WEIGHT = 0.6;
const INGREDIENT_WEIGHT = 0.4;
const COMBINED_THRESHOLD = 0.55;

/**
 * Find near-duplicate recipe pairs from a collection.
 * O(n²) — fine for home collections up to ~1000 recipes.
 */
export function findDuplicates(
  entries: { slug: string; recipe: Recipe }[],
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];

      const titleSim = normalizedLevenshtein(a.recipe.title, b.recipe.title);
      const ingredientSim = jaccardSimilarity(ingredientNames(a.recipe), ingredientNames(b.recipe));
      const combined = titleSim * TITLE_WEIGHT + ingredientSim * INGREDIENT_WEIGHT;

      if (combined >= COMBINED_THRESHOLD) {
        candidates.push({
          slugA: a.slug,
          slugB: b.slug,
          titleA: a.recipe.title,
          titleB: b.recipe.title,
          titleSimilarity: Math.round(titleSim * 100) / 100,
          ingredientSimilarity: Math.round(ingredientSim * 100) / 100,
          combinedScore: Math.round(combined * 100) / 100,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.combinedScore - a.combinedScore);
}
