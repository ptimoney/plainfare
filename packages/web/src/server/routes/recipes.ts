import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";

export const recipesRouter = router({
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
});
