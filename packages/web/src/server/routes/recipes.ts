import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import sharp from "sharp";
import { router, publicProcedure } from "../trpc.js";
import { parseNutritionResponse, serialiseRecipe } from "@plainfare/core";
import type { Recipe, Ingredient } from "@plainfare/core";
import { findDuplicates } from "../services/deduplication.js";

const IMAGE_MAX_WIDTH = 1200;
const IMAGE_QUALITY = 80;

export const recipesRouter = router({
  capabilities: publicProcedure
    .query(({ ctx }) => ({
      ai: !!ctx.aiProvider,
    })),

  list: publicProcedure
    .input(
      z.object({
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
      }).optional(),
    )
    .query(({ ctx, input }) => {
      return ctx.library.list(input ?? undefined);
    }),

  get: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ ctx, input }) => {
      const entry = ctx.library.get(input.slug);
      if (!entry) throw new Error(`Recipe not found: ${input.slug}`);
      return entry;
    }),

  update: publicProcedure
    .input(z.object({ slug: z.string(), markdown: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.library.update(input.slug, input.markdown);
    }),

  delete: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.library.remove(input.slug);
      return { ok: true };
    }),

  duplicates: publicProcedure
    .query(({ ctx }) => {
      const entries = ctx.library.list().map((e) => ({ slug: e.slug, recipe: e.recipe }));
      return findDuplicates(entries);
    }),

  estimateNutrition: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.aiProvider) {
        throw new Error("AI provider not configured");
      }

      const entry = ctx.library.get(input.slug);
      if (!entry) throw new Error(`Recipe not found: ${input.slug}`);

      // Serialise ingredients to plain text for the LLM
      const ingredientLines = entry.recipe.ingredientGroups.flatMap((group) =>
        group.ingredients.map((ing: Ingredient) => {
          let line = "";
          if (ing.quantity != null && ing.unit) line = `${ing.quantity}${ing.unit} ${ing.name}`;
          else if (ing.quantity != null) line = `${ing.quantity} ${ing.name}`;
          else line = ing.name;
          if (ing.note) line += `, ${ing.note}`;
          return line;
        }),
      );

      const rawResponse = await ctx.aiProvider.estimateNutrition(ingredientLines.join("\n"));
      const totalNutrition = parseNutritionResponse(rawResponse);
      if (!totalNutrition) {
        throw new Error("Failed to parse nutrition response from AI");
      }

      // Divide by servings to get per-serving values
      const servings = entry.recipe.serves ? parseInt(entry.recipe.serves, 10) : NaN;
      const nutrition = Number.isFinite(servings) && servings > 1
        ? {
            ...(totalNutrition.calories != null && { calories: Math.round(totalNutrition.calories / servings) }),
            ...(totalNutrition.protein != null && { protein: Math.round(totalNutrition.protein / servings) }),
            ...(totalNutrition.carbs != null && { carbs: Math.round(totalNutrition.carbs / servings) }),
            ...(totalNutrition.fat != null && { fat: Math.round(totalNutrition.fat / servings) }),
            ...(totalNutrition.fibre != null && { fibre: Math.round(totalNutrition.fibre / servings) }),
          }
        : totalNutrition;

      // Update recipe with per-serving nutrition data
      const updatedRecipe: Recipe = { ...entry.recipe, nutrition };
      const markdown = serialiseRecipe(updatedRecipe);
      return ctx.library.update(input.slug, markdown);
    }),

  uploadImage: publicProcedure
    .input(z.object({
      slug: z.string(),
      image: z.string().max(10_000_000, "Image must be under 10MB"),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const entry = ctx.library.get(input.slug);
      if (!entry) throw new Error(`Recipe not found: ${input.slug}`);

      const imageBuffer = Buffer.from(input.image, "base64");
      const compressed = await sharp(imageBuffer)
        .resize(IMAGE_MAX_WIDTH, undefined, { withoutEnlargement: true })
        .jpeg({ quality: IMAGE_QUALITY })
        .toBuffer();

      const imageFilename = `${input.slug}.jpg`;
      const imagePath = resolve(dirname(entry.filePath), imageFilename);
      await writeFile(imagePath, compressed);

      const updatedRecipe: Recipe = { ...entry.recipe, image: imageFilename };
      const markdown = serialiseRecipe(updatedRecipe);
      return ctx.library.update(input.slug, markdown);
    }),
});
