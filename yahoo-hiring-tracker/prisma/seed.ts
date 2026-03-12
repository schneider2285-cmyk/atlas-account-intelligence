import { PrismaClient, BusinessUnit, JobStatus, SubmissionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Users ──────────────────────────────────────────────────────
  const user1 = await prisma.user.upsert({
    where: { email: "matt@toptal.com" },
    update: {},
    create: { name: "Matt Schneider", email: "matt@toptal.com", role: "ADMIN" },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "sarah@toptal.com" },
    update: {},
    create: { name: "Sarah Chen", email: "sarah@toptal.com", role: "MEMBER" },
  });

  // ─── Approved Countries ─────────────────────────────────────────
  const countries = [
    { region: "Americas", country: "United States", maxDurationMonths: null, requiresAdditionalApproval: false },
    { region: "Americas", country: "Canada", maxDurationMonths: null, requiresAdditionalApproval: false },
    { region: "Americas", country: "Brazil", maxDurationMonths: 12, requiresAdditionalApproval: false },
    { region: "Americas", country: "Argentina", maxDurationMonths: 12, requiresAdditionalApproval: false },
    { region: "Europe", country: "United Kingdom", maxDurationMonths: null, requiresAdditionalApproval: false },
    { region: "Europe", country: "Germany", maxDurationMonths: null, requiresAdditionalApproval: true },
    { region: "Europe", country: "Poland", maxDurationMonths: null, requiresAdditionalApproval: false },
    { region: "Europe", country: "Portugal", maxDurationMonths: null, requiresAdditionalApproval: false },
    { region: "Europe", country: "Spain", maxDurationMonths: null, requiresAdditionalApproval: false },
    { region: "Asia", country: "India", maxDurationMonths: 12, requiresAdditionalApproval: true },
    { region: "Asia", country: "Philippines", maxDurationMonths: 12, requiresAdditionalApproval: false },
  ];

  for (const c of countries) {
    await prisma.approvedCountry.upsert({
      where: { region_country: { region: c.region, country: c.country } },
      update: c,
      create: c,
    });
  }

  // ─── Jobs ───────────────────────────────────────────────────────
  const jobs = [
    {
      roleTitle: "Senior iOS Developer",
      businessUnit: BusinessUnit.MAIL,
      projectName: "AOL Project",
      yahooPoC: "Mohit Sharma",
      openHeadcount: 3,
      sowNumber: "SOW-2026-089",
      poNumber: "PO-44521",
      rateCap: 125,
      slackChannel: "#yahoo-aol-ios",
      status: JobStatus.ACTIVE,
      matcher: "Sarah Chen",
      interviewPrepNotes: "Focus on SwiftUI experience and reactive programming. Yahoo uses Combine extensively.",
      dateOpened: new Date("2026-01-15"),
    },
    {
      roleTitle: "Android Developer",
      businessUnit: BusinessUnit.MAIL,
      projectName: "AOL Project",
      yahooPoC: "Mohit Sharma",
      openHeadcount: 2,
      sowNumber: "SOW-2026-089",
      poNumber: "PO-44521",
      rateCap: 120,
      slackChannel: "#yahoo-aol-android",
      status: JobStatus.ACTIVE,
      matcher: "Matt Schneider",
      dateOpened: new Date("2026-01-20"),
    },
    {
      roleTitle: "Full Stack Engineer",
      businessUnit: BusinessUnit.HOME_ECO,
      projectName: "Home Ecosystem Redesign",
      yahooPoC: "Jennifer Liu",
      openHeadcount: 4,
      sowNumber: "SOW-2026-102",
      rateCap: 130,
      slackChannel: "#yahoo-home-eco",
      status: JobStatus.ACTIVE,
      matcher: "Sarah Chen",
      dateOpened: new Date("2026-02-01"),
    },
    {
      roleTitle: "Security Engineer",
      businessUnit: BusinessUnit.PARANOIDS,
      projectName: "Paranoids Security Audit",
      yahooPoC: "Alex Thompson",
      openHeadcount: 2,
      sowNumber: "SOW-2026-115",
      rateCap: 150,
      slackChannel: "#yahoo-paranoids",
      status: JobStatus.ACTIVE,
      matcher: "Matt Schneider",
      interviewPrepNotes: "Must have CISSP or equivalent. Focus on penetration testing and incident response.",
      dateOpened: new Date("2026-02-10"),
    },
    {
      roleTitle: "React Native Developer",
      businessUnit: BusinessUnit.SPORTS,
      projectName: "Yahoo Sports App v3",
      yahooPoC: "David Park",
      openHeadcount: 2,
      sowNumber: "SOW-2026-098",
      rateCap: 115,
      slackChannel: "#yahoo-sports-mobile",
      status: JobStatus.ACTIVE,
      matcher: "Sarah Chen",
      dateOpened: new Date("2026-01-25"),
    },
    {
      roleTitle: "Data Engineer",
      businessUnit: BusinessUnit.MAIL,
      projectName: "Mail DT Analytics",
      yahooPoC: "Priya Patel",
      openHeadcount: 1,
      sowNumber: "SOW-2026-110",
      rateCap: 140,
      status: JobStatus.ON_HOLD,
      matcher: "Matt Schneider",
      dateOpened: new Date("2026-02-15"),
    },
    {
      roleTitle: "DevOps Engineer",
      businessUnit: BusinessUnit.HOME_ECO,
      projectName: "Infrastructure Modernization",
      yahooPoC: "Jennifer Liu",
      openHeadcount: 1,
      status: JobStatus.FUTURE_NEED,
      matcher: "Sarah Chen",
      dateOpened: new Date("2026-03-01"),
    },
  ];

  const createdJobs: Array<{ id: string; roleTitle: string }> = [];
  for (const job of jobs) {
    const created = await prisma.job.create({ data: job });
    createdJobs.push({ id: created.id, roleTitle: created.roleTitle });
  }

  // ─── Candidates ─────────────────────────────────────────────────
  const candidates = [
    { name: "Blake Rogers", location: "Austin, TX", country: "United States", rate: 110, pstOverlap: "Full", toptalProfileLink: "https://www.toptal.com/resume/blake-rogers" },
    { name: "Maria Santos", location: "São Paulo, Brazil", country: "Brazil", rate: 95, pstOverlap: "4 hours" },
    { name: "Andrei Volkov", location: "Warsaw, Poland", country: "Poland", rate: 100, pstOverlap: "3 hours" },
    { name: "Priya Nair", location: "Bangalore, India", country: "India", rate: 85, pstOverlap: "2 hours" },
    { name: "James Chen", location: "Vancouver, Canada", country: "Canada", rate: 120, pstOverlap: "Full" },
    { name: "Sofia Martinez", location: "Buenos Aires, Argentina", country: "Argentina", rate: 90, pstOverlap: "5 hours" },
    { name: "Tom Wilson", location: "London, UK", country: "United Kingdom", rate: 130, pstOverlap: "3 hours" },
    { name: "Ana Kowalski", location: "Lisbon, Portugal", country: "Portugal", rate: 95, pstOverlap: "2 hours" },
    { name: "Ryan Park", location: "San Francisco, CA", country: "United States", rate: 140, pstOverlap: "Full" },
    { name: "Elena Petrova", location: "Madrid, Spain", country: "Spain", rate: 105, pstOverlap: "3 hours" },
    { name: "Carlos Mendez", location: "Manila, Philippines", country: "Philippines", rate: 75, pstOverlap: "1 hour" },
    { name: "Lisa Zhang", location: "Toronto, Canada", country: "Canada", rate: 115, pstOverlap: "Full" },
  ];

  const createdCandidates: Array<{ id: string; name: string }> = [];
  for (const c of candidates) {
    const created = await prisma.candidate.create({ data: c });
    createdCandidates.push({ id: created.id, name: created.name });
  }

  // ─── Submissions ────────────────────────────────────────────────
  const findJob = (title: string) => createdJobs.find((j) => j.roleTitle.includes(title))!;
  const findCandidate = (name: string) => createdCandidates.find((c) => c.name === name)!;

  const submissions = [
    // iOS Developer submissions
    { jobId: findJob("iOS").id, candidateId: findCandidate("Blake Rogers").id, status: SubmissionStatus.INTERVIEWING, dateIntroduced: new Date("2026-02-01") },
    { jobId: findJob("iOS").id, candidateId: findCandidate("James Chen").id, status: SubmissionStatus.HIRED, dateIntroduced: new Date("2026-01-25") },
    { jobId: findJob("iOS").id, candidateId: findCandidate("Maria Santos").id, status: SubmissionStatus.INTRODUCED, dateIntroduced: new Date("2026-03-01") },
    // Android Developer submissions
    { jobId: findJob("Android").id, candidateId: findCandidate("Andrei Volkov").id, status: SubmissionStatus.INTERVIEWING, dateIntroduced: new Date("2026-02-05") },
    { jobId: findJob("Android").id, candidateId: findCandidate("Priya Nair").id, status: SubmissionStatus.REJECTED, dateIntroduced: new Date("2026-02-01"), clientFeedbackNotes: "Not enough Kotlin experience" },
    // Full Stack submissions
    { jobId: findJob("Full Stack").id, candidateId: findCandidate("Tom Wilson").id, status: SubmissionStatus.HIRED, dateIntroduced: new Date("2026-02-10") },
    { jobId: findJob("Full Stack").id, candidateId: findCandidate("Sofia Martinez").id, status: SubmissionStatus.INTERVIEWING, dateIntroduced: new Date("2026-02-20") },
    { jobId: findJob("Full Stack").id, candidateId: findCandidate("Ana Kowalski").id, status: SubmissionStatus.INTRODUCED, dateIntroduced: new Date("2026-03-05") },
    // Security Engineer submissions
    { jobId: findJob("Security").id, candidateId: findCandidate("Ryan Park").id, status: SubmissionStatus.PENDING_DECISION, dateIntroduced: new Date("2026-02-15") },
    // React Native submissions
    { jobId: findJob("React Native").id, candidateId: findCandidate("Elena Petrova").id, status: SubmissionStatus.INTERVIEWING, dateIntroduced: new Date("2026-02-08") },
    { jobId: findJob("React Native").id, candidateId: findCandidate("Carlos Mendez").id, status: SubmissionStatus.REMOVED_FOR_LOCATION, dateIntroduced: new Date("2026-02-03"), clientFeedbackNotes: "Philippines not on approved list for this project" },
    { jobId: findJob("React Native").id, candidateId: findCandidate("Lisa Zhang").id, status: SubmissionStatus.INTRODUCED, dateIntroduced: new Date("2026-03-08") },
  ];

  for (const sub of submissions) {
    const created = await prisma.submission.create({
      data: {
        ...sub,
        createdById: user1.id,
        dateLastStatusChange: sub.dateIntroduced,
      },
    });

    // Create activity log entries for historical data
    await prisma.activityLog.create({
      data: {
        action: "SUBMISSION_CREATED",
        entityType: "Submission",
        entityId: created.id,
        jobId: sub.jobId,
        submissionId: created.id,
        userId: user1.id,
        createdAt: sub.dateIntroduced,
      },
    });

    if (sub.status !== SubmissionStatus.INTRODUCED) {
      await prisma.activityLog.create({
        data: {
          action: "SUBMISSION_STATUS_CHANGED",
          entityType: "Submission",
          entityId: created.id,
          jobId: sub.jobId,
          submissionId: created.id,
          userId: user1.id,
          details: { from: "INTRODUCED", to: sub.status },
          createdAt: new Date(sub.dateIntroduced.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // Create job-level activity logs
  for (const job of createdJobs) {
    await prisma.activityLog.create({
      data: {
        action: "JOB_CREATED",
        entityType: "Job",
        entityId: job.id,
        jobId: job.id,
        userId: user1.id,
        details: { roleTitle: job.roleTitle },
      },
    });
  }

  console.log(`Seeded: ${createdJobs.length} jobs, ${createdCandidates.length} candidates, ${submissions.length} submissions`);
  console.log("Seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
