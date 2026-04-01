import { resolve } from "node:path";
import { readdir, readFile, stat, writeFile, unlink } from "node:fs/promises";
import { watch } from "chokidar";
import { parseRecipe, serialiseRecipe } from "@plainfare/core";
import type { Recipe, ConfidenceReport } from "@plainfare/core";

export interface RecipeEntry {
  filePath: string;
  slug: string;
  recipe: Recipe;
  confidence: ConfidenceReport;
  lastModified: Date;
}

export class RecipeLibrary {
  private entries = new Map<string, RecipeEntry>();
  private watcher: ReturnType<typeof watch> | null = null;
  private ownWrites = new Set<string>();

  constructor(private recipesDir: string) {
    this.recipesDir = resolve(recipesDir);
  }

  async initialize(): Promise<void> {
    // Scan directory for .md files
    const files = await this.scanDirectory(this.recipesDir);
    for (const filePath of files) {
      await this.loadFile(filePath);
    }

    // Start watching for changes
    this.watcher = watch(this.recipesDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
    });

    this.watcher
      .on("add", (path) => this.onFileEvent(path))
      .on("change", (path) => this.onFileEvent(path))
      .on("unlink", (path) => this.onFileRemoved(path));
  }

  list(options?: { tags?: string[]; search?: string }): RecipeEntry[] {
    let results = Array.from(this.entries.values());

    if (options?.tags && options.tags.length > 0) {
      const filterTags = options.tags.map((t) => t.toLowerCase());
      results = results.filter((e) =>
        e.recipe.tags?.some((t) => filterTags.includes(t.toLowerCase())),
      );
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      results = results.filter((e) => {
        const recipe = e.recipe;
        if (recipe.title.toLowerCase().includes(q)) return true;
        if (recipe.description?.toLowerCase().includes(q)) return true;
        if (recipe.tags?.some((t) => t.toLowerCase().includes(q))) return true;
        return recipe.ingredientGroups.some((g) =>
          g.ingredients.some((i) => i.name.toLowerCase().includes(q)),
        );
      });
    }

    return results.sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
  }

  get(slug: string): RecipeEntry | undefined {
    return Array.from(this.entries.values()).find((e) => e.slug === slug);
  }

  async add(recipe: Recipe): Promise<RecipeEntry> {
    const slug = this.uniqueSlug(this.slugify(recipe.title));
    const filePath = resolve(this.recipesDir, `${slug}.md`);
    const markdown = serialiseRecipe(recipe);

    // Track this write so the watcher doesn't redundantly re-parse
    this.ownWrites.add(filePath);
    await writeFile(filePath, markdown, "utf-8");

    const entry: RecipeEntry = {
      filePath,
      slug,
      recipe,
      confidence: { fields: {}, overallConfidence: 1, usedLLMFallback: false },
      lastModified: new Date(),
    };
    this.entries.set(filePath, entry);
    return entry;
  }

  async update(slug: string, markdown: string): Promise<RecipeEntry> {
    const existing = this.get(slug);
    if (!existing) throw new Error(`Recipe not found: ${slug}`);

    const { recipe, confidence } = parseRecipe(markdown);

    this.ownWrites.add(existing.filePath);
    await writeFile(existing.filePath, markdown, "utf-8");

    const entry: RecipeEntry = {
      filePath: existing.filePath,
      slug: existing.slug,
      recipe,
      confidence,
      lastModified: new Date(),
    };
    this.entries.set(existing.filePath, entry);
    return entry;
  }

  async remove(slug: string): Promise<void> {
    const existing = this.get(slug);
    if (!existing) throw new Error(`Recipe not found: ${slug}`);

    this.ownWrites.add(existing.filePath);
    await unlink(existing.filePath);
    this.entries.delete(existing.filePath);
  }

  async close(): Promise<void> {
    await this.watcher?.close();
  }

  get size(): number {
    return this.entries.size;
  }

  // --- Private ---

  private async scanDirectory(dir: string): Promise<string[]> {
    const results: string[] = [];
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = resolve(dir, item.name);
      if (item.isDirectory()) {
        results.push(...(await this.scanDirectory(fullPath)));
      } else if (item.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  private async loadFile(filePath: string): Promise<void> {
    try {
      const markdown = await readFile(filePath, "utf-8");
      const { recipe, confidence } = parseRecipe(markdown);
      const fileStat = await stat(filePath);
      const slug = this.slugFromPath(filePath);

      this.entries.set(filePath, {
        filePath,
        slug,
        recipe,
        confidence,
        lastModified: fileStat.mtime,
      });
    } catch {
      // Skip files that fail to parse
    }
  }

  private async onFileEvent(filePath: string): Promise<void> {
    if (!filePath.endsWith(".md")) return;

    // Skip our own writes
    if (this.ownWrites.has(filePath)) {
      this.ownWrites.delete(filePath);
      return;
    }

    await this.loadFile(filePath);
  }

  private onFileRemoved(filePath: string): void {
    this.entries.delete(filePath);
  }

  private slugFromPath(filePath: string): string {
    const basename = filePath.slice(filePath.lastIndexOf("/") + 1);
    return basename.replace(/\.md$/, "");
  }

  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private uniqueSlug(base: string): string {
    const slugs = new Set(Array.from(this.entries.values()).map((e) => e.slug));
    if (!slugs.has(base)) return base;
    let n = 2;
    while (slugs.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
}
