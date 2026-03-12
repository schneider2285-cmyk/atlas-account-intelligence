import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { createCandidateSchema, updateCandidateSchema } from "@/lib/validators";
import { emitChange, CHANNELS, EVENTS } from "../pusher";
import { Prisma } from "@prisma/client";

export const candidatesRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.CandidateWhereInput = {};
      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { location: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const limit = input?.limit ?? 50;
      const candidates = await ctx.db.candidate.findMany({
        where,
        include: {
          submissions: {
            include: {
              job: { select: { id: true, roleTitle: true, projectName: true, businessUnit: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (candidates.length > limit) {
        const next = candidates.pop();
        nextCursor = next?.id;
      }

      return { candidates, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.candidate.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          submissions: {
            include: {
              job: true,
              createdBy: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(createCandidateSchema)
    .mutation(async ({ ctx, input }) => {
      const candidate = await ctx.db.candidate.create({
        data: {
          ...input,
          rate: input.rate ? new Prisma.Decimal(input.rate) : null,
          toptalProfileLink: input.toptalProfileLink || null,
          email: input.email || null,
        },
      });

      await ctx.db.activityLog.create({
        data: {
          action: "CANDIDATE_CREATED",
          entityType: "Candidate",
          entityId: candidate.id,
          userId: ctx.session.user.id,
          details: { name: candidate.name },
        },
      });

      await emitChange(CHANNELS.CANDIDATES, EVENTS.CREATED, { id: candidate.id });
      return candidate;
    }),

  update: protectedProcedure
    .input(updateCandidateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const candidate = await ctx.db.candidate.update({
        where: { id },
        data: {
          ...data,
          rate: data.rate !== undefined ? (data.rate ? new Prisma.Decimal(data.rate) : null) : undefined,
          toptalProfileLink: data.toptalProfileLink !== undefined ? (data.toptalProfileLink || null) : undefined,
          email: data.email !== undefined ? (data.email || null) : undefined,
        },
      });

      await emitChange(CHANNELS.CANDIDATES, EVENTS.UPDATED, { id: candidate.id });
      return candidate;
    }),

  // Search by name (for fuzzy matching in chat)
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.candidate.findMany({
        where: {
          name: { contains: input.query, mode: "insensitive" },
        },
        take: 10,
        orderBy: { name: "asc" },
      });
    }),
});
