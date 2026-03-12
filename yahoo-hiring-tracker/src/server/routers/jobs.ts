import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import {
  createJobSchema,
  updateJobSchema,
  jobFilterSchema,
} from "@/lib/validators";
import { emitChange, CHANNELS, EVENTS } from "../pusher";
import { Prisma } from "@prisma/client";

export const jobsRouter = createTRPCRouter({
  list: publicProcedure
    .input(jobFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const where: Prisma.JobWhereInput = {};
      if (input?.businessUnit) where.businessUnit = input.businessUnit;
      if (input?.status) where.status = input.status;
      if (input?.projectName) where.projectName = { contains: input.projectName, mode: "insensitive" };
      if (input?.yahooPoC) where.yahooPoC = { contains: input.yahooPoC, mode: "insensitive" };
      if (input?.search) {
        where.OR = [
          { roleTitle: { contains: input.search, mode: "insensitive" } },
          { projectName: { contains: input.search, mode: "insensitive" } },
          { yahooPoC: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const jobs = await ctx.db.job.findMany({
        where,
        include: {
          submissions: {
            select: {
              id: true,
              status: true,
            },
          },
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return jobs.map((job) => {
        const hired = job.submissions.filter((s) => s.status === "HIRED").length;
        const interviewing = job.submissions.filter((s) => ["INTERVIEWING", "INTERVIEW_SCHEDULED", "PENDING_2ND_INTERVIEW"].includes(s.status)).length;
        const introduced = job.submissions.filter((s) => s.status === "INTRODUCED").length;
        return {
          ...job,
          filledHeadcount: hired,
          remainingHeadcount: job.openHeadcount - hired,
          interviewingCount: interviewing,
          introducedCount: introduced,
          totalSubmissions: job._count.submissions,
        };
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.job.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          submissions: {
            include: {
              candidate: true,
              createdBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { updatedAt: "desc" },
          },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(createJobSchema)
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.job.create({
        data: {
          ...input,
          rateCap: input.rateCap ? new Prisma.Decimal(input.rateCap) : null,
          toptalJobLink: input.toptalJobLink || null,
          salesforceLink: input.salesforceLink || null,
        },
      });

      await ctx.db.activityLog.create({
        data: {
          action: "JOB_CREATED",
          entityType: "Job",
          entityId: job.id,
          jobId: job.id,
          userId: ctx.session.user.id,
          details: { roleTitle: job.roleTitle, projectName: job.projectName },
        },
      });

      await emitChange(CHANNELS.JOBS, EVENTS.CREATED, { id: job.id });
      await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});
      return job;
    }),

  update: protectedProcedure
    .input(updateJobSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const job = await ctx.db.job.update({
        where: { id },
        data: {
          ...data,
          rateCap: data.rateCap !== undefined ? (data.rateCap ? new Prisma.Decimal(data.rateCap) : null) : undefined,
          toptalJobLink: data.toptalJobLink !== undefined ? (data.toptalJobLink || null) : undefined,
          salesforceLink: data.salesforceLink !== undefined ? (data.salesforceLink || null) : undefined,
        },
      });

      await ctx.db.activityLog.create({
        data: {
          action: "JOB_UPDATED",
          entityType: "Job",
          entityId: job.id,
          jobId: job.id,
          userId: ctx.session.user.id,
          details: data,
        },
      });

      await emitChange(CHANNELS.JOBS, EVENTS.UPDATED, { id: job.id });
      await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});
      return job;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.job.delete({ where: { id: input.id } });
      await emitChange(CHANNELS.JOBS, EVENTS.DELETED, { id: input.id });
      await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});
      return { success: true };
    }),

  // Unique values for filter dropdowns
  filterOptions: publicProcedure.query(async ({ ctx }) => {
    const [projects, pocs] = await Promise.all([
      ctx.db.job.findMany({ select: { projectName: true }, distinct: ["projectName"], orderBy: { projectName: "asc" } }),
      ctx.db.job.findMany({ select: { yahooPoC: true }, distinct: ["yahooPoC"], orderBy: { yahooPoC: "asc" } }),
    ]);
    return {
      projectNames: projects.map((p) => p.projectName),
      yahooPocs: pocs.map((p) => p.yahooPoC),
    };
  }),
});
