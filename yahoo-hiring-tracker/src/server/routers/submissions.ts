import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { createSubmissionSchema, updateSubmissionSchema } from "@/lib/validators";
import { emitChange, CHANNELS, EVENTS } from "../pusher";

export const submissionsRouter = createTRPCRouter({
  listByJob: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.submission.findMany({
        where: { jobId: input.jobId },
        include: {
          candidate: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.submission.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          job: true,
          candidate: true,
          createdBy: { select: { id: true, name: true } },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });
    }),

  create: protectedProcedure
    .input(createSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.submission.create({
        data: {
          ...input,
          createdById: ctx.session.user.id,
        },
        include: {
          job: { select: { roleTitle: true, projectName: true } },
          candidate: { select: { name: true } },
        },
      });

      await ctx.db.activityLog.create({
        data: {
          action: "SUBMISSION_CREATED",
          entityType: "Submission",
          entityId: submission.id,
          jobId: submission.jobId,
          submissionId: submission.id,
          userId: ctx.session.user.id,
          details: {
            candidateName: submission.candidate.name,
            roleTitle: submission.job.roleTitle,
            projectName: submission.job.projectName,
          },
        },
      });

      await emitChange(CHANNELS.SUBMISSIONS, EVENTS.CREATED, { id: submission.id, jobId: submission.jobId });
      await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});
      return submission;
    }),

  updateStatus: protectedProcedure
    .input(updateSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const prev = await ctx.db.submission.findUniqueOrThrow({
        where: { id },
        select: { status: true, jobId: true },
      });

      const submission = await ctx.db.submission.update({
        where: { id },
        data: {
          ...data,
          dateLastStatusChange: data.status && data.status !== prev.status ? new Date() : undefined,
          dateLastClientFeedback: data.clientFeedbackNotes ? new Date() : undefined,
        },
        include: {
          job: { select: { roleTitle: true, projectName: true } },
          candidate: { select: { name: true } },
        },
      });

      if (data.status && data.status !== prev.status) {
        await ctx.db.activityLog.create({
          data: {
            action: "SUBMISSION_STATUS_CHANGED",
            entityType: "Submission",
            entityId: submission.id,
            jobId: submission.jobId,
            submissionId: submission.id,
            userId: ctx.session.user.id,
            details: {
              from: prev.status,
              to: data.status,
              candidateName: submission.candidate.name,
              roleTitle: submission.job.roleTitle,
            },
          },
        });
      }

      await emitChange(CHANNELS.SUBMISSIONS, EVENTS.UPDATED, { id: submission.id, jobId: submission.jobId });
      await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});
      return submission;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.submission.findUniqueOrThrow({
        where: { id: input.id },
        select: { jobId: true },
      });
      await ctx.db.submission.delete({ where: { id: input.id } });
      await emitChange(CHANNELS.SUBMISSIONS, EVENTS.DELETED, { id: input.id, jobId: sub.jobId });
      await emitChange(CHANNELS.DASHBOARD, EVENTS.REFRESH, {});
      return { success: true };
    }),

  // Pipeline grouped by BU → Project → Candidate
  pipelineGrouped: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.status) {
        where.status = input.status;
      } else {
        where.status = { notIn: ["REJECTED", "WITHDRAWN", "TALENT_WITHDRAWN", "TALENT_NO_LONGER_AVAILABLE", "REMOVED_FOR_LOCATION"] };
      }

      if (input?.search) {
        where.OR = [
          { candidate: { name: { contains: input.search, mode: "insensitive" } } },
          { job: { roleTitle: { contains: input.search, mode: "insensitive" } } },
          { job: { projectName: { contains: input.search, mode: "insensitive" } } },
        ];
      }

      const submissions = await ctx.db.submission.findMany({
        where,
        include: {
          candidate: true,
          job: {
            select: {
              id: true,
              businessUnit: true,
              projectName: true,
              roleTitle: true,
              yahooPoC: true,
            },
          },
        },
        orderBy: { dateIntroduced: "desc" },
      });

      // Group by BU → Project
      const grouped: Record<string, {
        businessUnit: string;
        projects: Record<string, {
          projectName: string;
          roleTitle: string;
          yahooPoC: string;
          jobId: string;
          candidates: typeof submissions;
        }>;
      }> = {};

      for (const sub of submissions) {
        const bu = sub.job.businessUnit;
        const projKey = `${sub.job.projectName}::${sub.job.roleTitle}`;

        if (!grouped[bu]) {
          grouped[bu] = { businessUnit: bu, projects: {} };
        }
        if (!grouped[bu].projects[projKey]) {
          grouped[bu].projects[projKey] = {
            projectName: sub.job.projectName,
            roleTitle: sub.job.roleTitle,
            yahooPoC: sub.job.yahooPoC,
            jobId: sub.job.id,
            candidates: [],
          };
        }
        grouped[bu].projects[projKey].candidates.push(sub);
      }

      return Object.values(grouped).map((bu) => ({
        businessUnit: bu.businessUnit,
        candidateCount: Object.values(bu.projects).reduce((sum, p) => sum + p.candidates.length, 0),
        projects: Object.values(bu.projects).map((p) => ({
          ...p,
          candidates: p.candidates.map((s) => ({
            id: s.id,
            candidateId: s.candidateId,
            name: s.candidate.name,
            location: s.candidate.location,
            rate: s.candidate.rate,
            toptalProfileLink: s.candidate.toptalProfileLink,
            status: s.status,
            dateIntroduced: s.dateIntroduced,
            interviewDateTime: s.interviewDateTime,
            dateLastStatusChange: s.dateLastStatusChange,
          })),
        })),
      }));
    }),

  // Recent wins (hired candidates in last 90 days)
  recentWins: publicProcedure.query(async ({ ctx }) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return ctx.db.submission.findMany({
      where: {
        status: "HIRED",
        dateLastStatusChange: { gte: ninetyDaysAgo },
      },
      include: {
        candidate: { select: { name: true, toptalProfileLink: true, location: true } },
        job: { select: { roleTitle: true, projectName: true, businessUnit: true } },
      },
      orderBy: { dateLastStatusChange: "desc" },
    });
  }),
});
