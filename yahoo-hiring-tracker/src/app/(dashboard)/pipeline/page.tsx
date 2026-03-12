"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AgingBadge } from "@/components/shared/AgingBadge";
import { daysSince } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, Trophy } from "lucide-react";

const buLabels: Record<string, string> = {
  MAIL: "Mail",
  HOME_ECO: "Home Eco",
  PARANOIDS: "Paranoids",
  SPORTS: "Sports",
  SEARCH: "Search",
  ADS: "Ads",
  OTHER: "Other",
};

const buColors: Record<string, string> = {
  MAIL: "#204ECF",
  HOME_ECO: "#0D9E6E",
  PARANOIDS: "#D6336C",
  SPORTS: "#D97B00",
  SEARCH: "#6941C6",
  ADS: "#EA580C",
  OTHER: "#6B7280",
};

const statusFilters = [
  { value: "", label: "All Active" },
  { value: "INTRODUCED", label: "Introduced" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "PENDING_DECISION", label: "Pending Decision" },
  { value: "PENDING_2ND_INTERVIEW", label: "Pending 2nd Interview" },
  { value: "HIRED", label: "Hired" },
];

export default function PipelinePage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedBUs, setExpandedBUs] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [winsOpen, setWinsOpen] = useState(false);

  const { data: pipeline, isLoading } = trpc.submissions.pipelineGrouped.useQuery({
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const { data: recentWins } = trpc.submissions.recentWins.useQuery();

  const toggleBU = (bu: string) => {
    setExpandedBUs((prev) => {
      const next = new Set(prev);
      if (next.has(bu)) next.delete(bu);
      else next.add(bu);
      return next;
    });
  };

  const toggleProject = (key: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    if (!pipeline) return;
    const allBUs = new Set(pipeline.map((g) => g.businessUnit));
    const allProjects = new Set(
      pipeline.flatMap((g) =>
        g.projects.map((p) => `${g.businessUnit}::${p.projectName}::${p.roleTitle}`)
      )
    );
    setExpandedBUs(allBUs);
    setExpandedProjects(allProjects);
  };

  const collapseAll = () => {
    setExpandedBUs(new Set());
    setExpandedProjects(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Talent Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            View candidates grouped by business unit and project
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-xs text-muted-foreground hover:text-foreground">
            Expand All
          </button>
          <span className="text-muted-foreground">|</span>
          <button onClick={collapseAll} className="text-xs text-muted-foreground hover:text-foreground">
            Collapse All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search candidates, roles, projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#204ECF]/20 focus:border-[#204ECF]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                statusFilter === sf.value
                  ? "bg-[#204ECF] text-white border-[#204ECF]"
                  : "bg-white text-muted-foreground border-gray-200 hover:border-[#204ECF] hover:text-[#204ECF]"
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Accordion */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading pipeline...
        </div>
      ) : !pipeline?.length ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No candidates match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {pipeline.map((buGroup) => {
            const buKey = buGroup.businessUnit;
            const isExpanded = expandedBUs.has(buKey);
            const color = buColors[buKey] ?? "#6B7280";

            return (
              <div key={buKey} className="border rounded-lg overflow-hidden">
                {/* BU Header */}
                <button
                  onClick={() => toggleBU(buKey)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <span
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {(buLabels[buKey] ?? buKey).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="font-semibold text-sm">
                    {buLabels[buKey] ?? buKey}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({buGroup.candidateCount} candidates)
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 ml-auto text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="border-t">
                    {buGroup.projects.map((project) => {
                      const projKey = `${buKey}::${project.projectName}::${project.roleTitle}`;
                      const isProjExpanded = expandedProjects.has(projKey);

                      return (
                        <div key={projKey} className="border-b last:border-b-0">
                          {/* Project Header */}
                          <button
                            onClick={() => toggleProject(projKey)}
                            className="w-full flex items-center gap-3 px-6 py-2.5 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-sm font-medium">{project.roleTitle}</span>
                            <span className="text-xs text-muted-foreground">
                              {project.projectName}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto mr-2">
                              POC: {project.yahooPoC}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-muted-foreground">
                              {project.candidates.length}
                            </span>
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                isProjExpanded && "rotate-180"
                              )}
                            />
                          </button>

                          {/* Candidates */}
                          {isProjExpanded && (
                            <div className="divide-y">
                              {project.candidates.map((candidate) => (
                                <div
                                  key={candidate.id}
                                  className="flex items-center gap-3 px-8 py-3 bg-white hover:bg-gray-50/50"
                                >
                                  <InitialsAvatar
                                    name={candidate.name}
                                    href={candidate.toptalProfileLink ?? undefined}
                                    size="md"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium truncate">
                                        {candidate.name}
                                      </span>
                                      <StatusBadge status={candidate.status} />
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                      {candidate.location && <span>{candidate.location}</span>}
                                      {candidate.rate && (
                                        <span>${Number(candidate.rate)}/hr</span>
                                      )}
                                      {candidate.interviewDateTime && (
                                        <span className="text-[#6941C6] font-medium">
                                          Interview: {new Date(candidate.interviewDateTime).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <AgingBadge
                                      days={daysSince(candidate.dateIntroduced)}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Wins */}
      {recentWins && recentWins.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #E6F7F1, #D1FAE5)" }}>
          <button
            onClick={() => setWinsOpen(!winsOpen)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/20 transition-colors"
          >
            <Trophy className="h-5 w-5 text-[#0D9E6E]" />
            <span className="font-semibold text-sm text-[#065F46]">
              Recent Wins
            </span>
            <span className="text-xs text-[#065F46]/70">
              ({recentWins.length} hired)
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 ml-auto text-[#065F46]/70 transition-transform",
                winsOpen && "rotate-180"
              )}
            />
          </button>

          {winsOpen && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentWins.map((win) => (
                <div
                  key={win.id}
                  className="flex items-center gap-3 bg-white/80 rounded-lg px-3 py-2.5"
                >
                  <InitialsAvatar
                    name={win.candidate.name}
                    href={win.candidate.toptalProfileLink ?? undefined}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{win.candidate.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {win.job.roleTitle} &middot; {win.job.projectName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
