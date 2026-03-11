import { BaseConnector } from "./baseConnector";
import { getPerplexityDossier } from "../../fixtures/perplexityDossierIndex";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function noteToSignal({ note, departmentName, idx, observedAt }) {
  const text = stripHtml(note.text);

  let direction = "positive";
  let weight = 5;
  let confidence = 0.68;

  if (note.type === "alert") {
    direction = "negative";
    weight = 7;
    confidence = 0.76;
  } else if (note.type === "opportunity") {
    direction = "positive";
    weight = 8;
    confidence = 0.79;
  } else if (note.type === "info") {
    direction = "positive";
    weight = 4;
    confidence = 0.62;
  }

  return {
    category: "dossier",
    label: `${departmentName}: ${text.slice(0, 120)}${text.length > 120 ? "..." : ""}`,
    detail: `Perplexity prototype insight (${note.type || "note"})`,
    direction,
    weight: Math.max(1, Math.min(10, weight - Math.floor(idx / 2))),
    confidence,
    observedAt
  };
}

export class DossierConnector extends BaseConnector {
  constructor() {
    super("dossier");
  }

  async collect(account) {
    const dossier = getPerplexityDossier(account);
    if (!dossier?.departments?.length) {
      return { connector: this.name, signals: [] };
    }

    const departments = dossier.departments;
    const totalJobs = departments.reduce((sum, dept) => sum + (dept.jobs?.length || 0), 0);
    const totalTargets = departments.reduce((sum, dept) => sum + (dept.targets?.length || 0), 0);
    const totalAlerts = departments.reduce(
      (sum, dept) => sum + (dept.notes || []).filter((note) => note.type === "alert").length,
      0
    );

    const topNotes = departments
      .flatMap((dept) =>
        (dept.notes || []).map((note, idx) => ({
          note,
          departmentName: dept.name,
          idx
        }))
      )
      .slice(0, 4)
      .map((entry, index) =>
        noteToSignal({
          ...entry,
          observedAt: this.hoursAgo(3 + index * 4)
        })
      );

    const aggregateSignals = [
      {
        category: "dossier",
        label: `${totalJobs} tracked open roles across ${departments.length} departments`,
        detail: "Imported from Perplexity functional prototype role tracker.",
        direction: totalJobs >= 15 ? "positive" : "negative",
        weight: totalJobs >= 15 ? 8 : 4,
        confidence: 0.8,
        observedAt: this.hoursAgo(2)
      },
      {
        category: "dossier",
        label: `${totalTargets} mapped target stakeholders in buying committee graph`,
        detail: "Target/contact mapping imported from Perplexity prototype intelligence layer.",
        direction: "positive",
        weight: 7,
        confidence: 0.78,
        observedAt: this.hoursAgo(5)
      },
      {
        category: "dossier",
        label: `${totalAlerts} high-priority alert notes flagged in strategic dossiers`,
        detail: "High urgency notes surfaced from prototype strategic notes across departments.",
        direction: totalAlerts > 0 ? "negative" : "positive",
        weight: totalAlerts > 0 ? 6 : 4,
        confidence: 0.71,
        observedAt: this.hoursAgo(6)
      }
    ];

    return {
      connector: this.name,
      signals: [...aggregateSignals, ...topNotes]
    };
  }
}
