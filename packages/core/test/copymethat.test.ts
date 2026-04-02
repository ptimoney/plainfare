import { describe, it, expect } from "vitest";
import { zipSync } from "fflate";
import { parseCopyMeThatArchive } from "../src/ingest/copymethat.js";

function buildCopyMeThatArchive(htmlFiles: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(htmlFiles)) {
    entries[name] = new TextEncoder().encode(content);
  }
  return zipSync(entries);
}

const sampleRecipeHtml = `
<html>
<body>
<div class="recipe-card">
  <h2>Chicken Stir Fry</h2>
  <img src="https://example.com/stirfry.jpg" alt="Stir fry" />
  <h3>Ingredients</h3>
  <ul>
    <li>500g chicken breast</li>
    <li>2 tbsp soy sauce</li>
    <li>1 red pepper, sliced</li>
  </ul>
  <h3>Directions</h3>
  <ol>
    <li>Slice the chicken into strips.</li>
    <li>Stir fry with pepper and soy sauce.</li>
  </ol>
</div>
</body>
</html>`;

describe("parseCopyMeThatArchive", () => {
  it("parses a recipe from HTML in a zip", () => {
    const archive = buildCopyMeThatArchive({ "recipes.html": sampleRecipeHtml });
    const results = parseCopyMeThatArchive(archive);

    expect(results).toHaveLength(1);
    const recipe = results[0].recipe;
    expect(recipe.title).toBe("Chicken Stir Fry");
    expect(recipe.image).toBe("https://example.com/stirfry.jpg");
    expect(recipe.ingredientGroups).toHaveLength(1);
    expect(recipe.ingredientGroups[0].ingredients).toHaveLength(3);
    expect(recipe.ingredientGroups[0].ingredients[0].name).toBe("chicken breast");
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.steps[0].paragraphs[0]).toBe("Slice the chicken into strips.");
  });

  it("skips non-HTML files", () => {
    const archive = buildCopyMeThatArchive({
      "readme.txt": "This is not a recipe.",
      "recipes.html": sampleRecipeHtml,
    });
    const results = parseCopyMeThatArchive(archive);
    expect(results).toHaveLength(1);
  });

  it("handles empty archive", () => {
    const archive = zipSync({});
    const results = parseCopyMeThatArchive(archive);
    expect(results).toEqual([]);
  });

  it("handles HTML with no recipes", () => {
    const archive = buildCopyMeThatArchive({
      "empty.html": "<html><body><p>Nothing here</p></body></html>",
    });
    const results = parseCopyMeThatArchive(archive);
    expect(results).toEqual([]);
  });
});
