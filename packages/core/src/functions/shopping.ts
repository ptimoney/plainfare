import type { Recipe, Ingredient } from "../types.js";

export interface ShoppingItem {
  name: string;
  quantities: { quantity: number; unit?: string }[];
  note?: string;
}

/**
 * Generate a shopping list from one or more recipes.
 * Merges ingredients with the same name and unit, sums quantities.
 * Returns items sorted alphabetically.
 */
export function generateShoppingList(recipes: Recipe[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();

  for (const recipe of recipes) {
    for (const group of recipe.ingredientGroups) {
      for (const ing of group.ingredients) {
        const key = ing.name.toLowerCase();
        const existing = map.get(key);

        if (existing) {
          if (ing.quantity != null) {
            const matchingQty = existing.quantities.find(
              (q) => (q.unit ?? "") === (ing.unit ?? ""),
            );
            if (matchingQty) {
              matchingQty.quantity += ing.quantity;
            } else {
              existing.quantities.push({
                quantity: ing.quantity,
                ...(ing.unit && { unit: ing.unit }),
              });
            }
          }
          if (ing.note && !existing.note) {
            existing.note = ing.note;
          }
        } else {
          map.set(key, {
            name: ing.name,
            quantities: ing.quantity != null
              ? [{ quantity: ing.quantity, ...(ing.unit && { unit: ing.unit }) }]
              : [],
            ...(ing.note && { note: ing.note }),
          });
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Format a shopping list as a markdown checklist. */
export function formatShoppingList(items: ShoppingItem[]): string {
  return items
    .map((item) => {
      const parts: string[] = [];
      for (const q of item.quantities) {
        if (q.unit) {
          parts.push(`${q.quantity}${q.unit}`);
        } else {
          parts.push(String(q.quantity));
        }
      }
      const qty = parts.length > 0 ? `${parts.join(" + ")} ` : "";
      const note = item.note ? `, ${item.note}` : "";
      return `- [ ] ${qty}${item.name}${note}`;
    })
    .join("\n");
}
