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
});
