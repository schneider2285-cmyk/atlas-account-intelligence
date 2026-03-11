export const KANBAN_STAGES = ["research", "drafting", "ready", "sent", "follow-up"];

export function getStageTitle(stageId) {
  const titles = {
    research: "Research",
    drafting: "Drafting",
    ready: "Ready",
    sent: "Sent",
    "follow-up": "Follow-up"
  };

  return titles[stageId] || stageId;
}

export function moveStage(currentStage, direction) {
  const index = KANBAN_STAGES.indexOf(currentStage);
  if (index < 0) return currentStage;

  const nextIndex = direction === "left" ? Math.max(0, index - 1) : Math.min(KANBAN_STAGES.length - 1, index + 1);
  return KANBAN_STAGES[nextIndex];
}
