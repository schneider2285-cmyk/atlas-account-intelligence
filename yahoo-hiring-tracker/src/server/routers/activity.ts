import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const activityRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.string().optional(),
          jobId: z.string().optional(),
          userId: z.string().optional(),
          entityType: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;

      const where: Record<string, unknown> = {};
      if (input?.jobId) where.jobId = input.jobId;
      if (input?.userId) where.userId = input.userId;
      if (input?.entityType) where.entityType = input.entityType;

      const items = await ctx.db.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, image: true } },
          job: { select: { id: true, roleTitle: true, projectName: true } },
          submission: {
            select: {
              id: true,
              candidate: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),
});
