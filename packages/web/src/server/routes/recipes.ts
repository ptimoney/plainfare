import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { parseNutritionResponse, serialiseRecipe } from "@plainfare/core";
import type { Recipe, Ingredient } from "@plainfare/core";
import { findDuplicates } from "../services/deduplication.js";

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
      const nutrition = parseNutritionResponse(rawResponse);
      if (!nutrition) {
        throw new Error("Failed to parse nutrition response from AI");
      }

      // Update recipe with nutrition data
      const updatedRecipe: Recipe = { ...entry.recipe, nutrition };
      const markdown = serialiseRecipe(updatedRecipe);
      return ctx.library.update(input.slug, markdown);
    }),
});
