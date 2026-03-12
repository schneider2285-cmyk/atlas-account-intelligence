import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const dashboardRouter = createTRPCRouter({
  // Aggregated stats for the main dashboard
  stats: publicProcedure.query(async ({ ctx }) => {
    const [
      totalJobs,
      activeJobs,
      totalCandidates,
      totalSubmissions,
      hiredCount,
      interviewingCount,
    ] = await Promise.all([
      ctx.db.job.count(),
      ctx.db.job.count({ where: { status: "ACTIVE" } }),
      ctx.db.candidate.count(),
      ctx.db.submission.count(),
      ctx.db.submission.count({ where: { status: "HIRED" } }),
      ctx.db.submission.count({ where: { status: "INTERVIEWING" } }),
    ]);

    return {
      totalJobs,
      activeJobs,
      totalCandidates,
      totalSubmissions,
      hiredCount,
      interviewingCount,
    };
  }),

  // Stale pipeline items
  staleItems: publicProcedure
    .input(
      z
        .object({
          warningDays: z.number().int().default(7),
          criticalDays: z.number().int().default(14),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const warningDays = input?.warningDays ?? 7;
      const criticalDays = input?.criticalDays ?? 14;
      const now = new Date();
      const warningDate = new Date(now.getTime() - warningDays * 24 * 60 * 60 * 1000);
      const criticalDate = new Date(now.getTime() - criticalDays * 24 * 60 * 60 * 1000);

      // Jobs with no activity
      const staleJobs = await ctx.db.job.findMany({
        where: {
          status: "ACTIVE",
          updatedAt: { lt: warningDate },
        },
        include: {
          _count: { select: { submissions: true } },
        },
        orderBy: { updatedAt: "asc" },
      });

      // Submissions waiting for feedback
      const staleSubs = await ctx.db.submission.findMany({
        where: {
          status: { in: ["INTRODUCED", "INTERVIEWING", "PENDING_DECISION"] },
          dateLastStatusChange: { lt: warningDate },
        },
        include: {
          job: { select: { id: true, roleTitle: true, projectName: true } },
          candidate: { select: { name: true } },
        },
        orderBy: { dateLastStatusChange: "asc" },
      });

      // Jobs with open HC and zero candidates
      const emptyJobs = await ctx.db.job.findMany({
        where: {
          status: "ACTIVE",
          submissions: { none: {} },
        },
        orderBy: { dateOpened: "asc" },
      });

      return {
        staleJobs: staleJobs.map((j) => ({
          ...j,
          severity: j.updatedAt < criticalDate ? "critical" as const : "warning" as const,
        })),
        staleSubmissions: staleSubs.map((s) => ({
          ...s,
          severity: s.dateLastStatusChange < criticalDate ? "critical" as const : "warning" as const,
        })),
        emptyJobs,
      };
    }),

  // Pipeline by business unit
  pipelineByBU: publicProcedure.query(async ({ ctx }) => {
    const jobs = await ctx.db.job.findMany({
      where: { status: "ACTIVE" },
      include: {
        submissions: { select: { status: true } },
      },
    });

    const byBU = new Map<string, { open: number; filled: number; interviewing: number; introduced: number }>();

    for (const job of jobs) {
      const bu = job.businessUnit;
      const current = byBU.get(bu) ?? { open: 0, filled: 0, interviewing: 0, introduced: 0 };
      const hired = job.submissions.filter((s) => s.status === "HIRED").length;
      current.open += job.openHeadcount - hired;
      current.filled += hired;
      current.interviewing += job.submissions.filter((s) => s.status === "INTERVIEWING").length;
      current.introduced += job.submissions.filter((s) => s.status === "INTRODUCED").length;
      byBU.set(bu, current);
    }

    return Object.fromEntries(byBU);
  }),
});
