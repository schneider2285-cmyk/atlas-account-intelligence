import { createTRPCRouter } from "../trpc";
import { jobsRouter } from "./jobs";
import { candidatesRouter } from "./candidates";
import { submissionsRouter } from "./submissions";
import { dashboardRouter } from "./dashboard";
import { activityRouter } from "./activity";

export const appRouter = createTRPCRouter({
  jobs: jobsRouter,
  candidates: candidatesRouter,
  submissions: submissionsRouter,
  dashboard: dashboardRouter,
  activity: activityRouter,
});

export type AppRouter = typeof appRouter;
