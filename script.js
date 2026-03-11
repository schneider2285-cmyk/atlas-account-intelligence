const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
const siteHeader = document.querySelector(".site-header");

const impactForm = document.getElementById("impactForm");
const productivityValueEl = document.getElementById("productivityValue");
const pipelineValueEl = document.getElementById("pipelineValue");
const totalValueEl = document.getElementById("totalValue");
const confidenceFillEl = document.getElementById("confidenceFill");
const confidenceValueEl = document.getElementById("confidenceValue");

const casePanel = document.getElementById("casePanel");
const caseTabs = Array.from(document.querySelectorAll(".case-tab"));

const readinessForm = document.getElementById("readinessForm");
const scoreOutput = document.getElementById("scoreOutput");

const stageButtons = Array.from(document.querySelectorAll(".stage-btn"));
const timelinePanel = document.getElementById("timelinePanel");

const teamSizeRange = document.getElementById("teamSizeRange");
const teamSizeLabel = document.getElementById("teamSizeLabel");
const billingButtons = Array.from(document.querySelectorAll(".billing-toggle button"));
const priceCards = Array.from(document.querySelectorAll(".price-card"));

const faqQuestions = Array.from(document.querySelectorAll(".faq-question"));

const bookForm = document.getElementById("bookForm");
const bookFormStatus = document.getElementById("bookFormStatus");

const caseData = {
  saas: {
    title: "Mid-Market SaaS",
    description:
      "Rebuilt outbound and manager coaching workflows with governed AI prompts and CRM-grade instrumentation.",
    metrics: [
      ["Qualified pipeline", "+39% in 2 quarters"],
      ["Ramp time", "-24%"],
      ["Forecast variance", "-19%"],
    ],
  },
  cyber: {
    title: "Enterprise Cybersecurity",
    description:
      "Introduced secure AI-generated messaging and deal-risk scoring with human approvals for high-risk outbound.",
    metrics: [
      ["Win rate", "+8.7 points"],
      ["Legal escalations", "-41%"],
      ["Manager QA workload", "-33%"],
    ],
  },
  health: {
    title: "Healthcare IT",
    description:
      "Implemented policy-bound coaching and account planning across complex buying groups and compliance constraints.",
    metrics: [
      ["Qualified opportunities", "+31%"],
      ["Cycle time", "-17 days"],
      ["Output compliance", "99.5% safe"],
    ],
  },
};

const stageData = {
  discover: {
    title: "Discover",
    summary:
      "Assess data reliability, segment-level workflow friction, and legal/security requirements across your GTM stack.",
    points: [
      "Baseline KPI capture and risk mapping",
      "Role and channel prioritization matrix",
      "Change-management readiness checkpoint",
    ],
  },
  design: {
    title: "Design",
    summary:
      "Create governed prompt systems, workflow automation, and manager scorecards aligned to your sales methodology.",
    points: [
      "Role-specific prompt architecture",
      "Guardrail and approval workflow design",
      "CRM and call-intelligence integration map",
    ],
  },
  deploy: {
    title: "Deploy",
    summary:
      "Launch the first production wave with rep onboarding, QA loops, and governance instrumentation enabled by default.",
    points: [
      "Pilot team rollout and training",
      "Manager coaching and adoption dashboards",
      "Weekly performance and compliance tuning",
    ],
  },
  scale: {
    title: "Scale",
    summary:
      "Expand by segment and region using measured learnings, control gates, and executive-level reporting cadence.",
    points: [
      "Expansion readiness scoring",
      "Global governance consistency checks",
      "Board and leadership impact reporting",
    ],
  },
};

const planPricing = {
  foundation: { base: 2600, perRep: 28 },
  scale: { base: 6200, perRep: 54 },
  enterprise: { base: 11800, perRep: 86 },
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

init();

function init() {
  bindCoreInteractions();
  bindCaseTabs();
  bindTimeline();
  bindPricing();
  bindFaq();
  bindBookForm();
  computeImpact();
  updatePricing();
  setCase("saas");
  setStage("discover");
  observeReveals();
}

function bindCoreInteractions() {
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.textContent = isOpen ? "Close" : "Menu";
    });

    mainNav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLAnchorElement && mainNav.classList.contains("open")) {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "Menu";
      }
    });
  }

  window.addEventListener("scroll", () => {
    if (!siteHeader) return;
    siteHeader.classList.toggle("scrolled", window.scrollY > 8);
  });

  if (impactForm) {
    impactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      computeImpact();
    });

    impactForm.addEventListener("input", () => {
      computeImpact();
    });
  }

  if (readinessForm) {
    readinessForm.addEventListener("submit", (event) => {
      event.preventDefault();
      computeReadiness();
    });
  }
}

function computeImpact() {
  if (!impactForm) return;

  const reps = getFieldNumber("reps");
  const repCost = getFieldNumber("repCost");
  const hoursSaved = getFieldNumber("hoursSaved");
  const monthlyPipeline = getFieldNumber("monthlyPipeline");
  const pipelineLiftPct = getFieldNumber("pipelineLift");

  const hourlyCost = repCost / (48 * 40);
  const productivityValue = reps * hoursSaved * 48 * hourlyCost;
  const pipelineValue = monthlyPipeline * 12 * (pipelineLiftPct / 100);
  const totalValue = productivityValue + pipelineValue;

  productivityValueEl.textContent = currency.format(productivityValue);
  pipelineValueEl.textContent = currency.format(pipelineValue);
  totalValueEl.textContent = currency.format(totalValue);

  const confidenceScore = Math.max(8, Math.min(95, Math.round(35 + (hoursSaved * 2 + pipelineLiftPct * 1.4))));
  confidenceFillEl.style.width = `${confidenceScore}%`;

  let label = "Baseline";
  if (confidenceScore >= 80) {
    label = "High confidence";
  } else if (confidenceScore >= 60) {
    label = "Moderate confidence";
  }
  confidenceValueEl.textContent = `${label} (${confidenceScore}%)`;
}

function bindCaseTabs() {
  caseTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.case;
      if (!key || !caseData[key]) return;
      setCase(key);
    });
  });
}

function setCase(key) {
  const data = caseData[key];
  if (!data || !casePanel) return;

  caseTabs.forEach((tab) => {
    const active = tab.dataset.case === key;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  const metrics = data.metrics
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )
    .join("");

  casePanel.innerHTML = `
    <h3>${escapeHtml(data.title)}</h3>
    <p>${escapeHtml(data.description)}</p>
    <dl>${metrics}</dl>
  `;
}

function computeReadiness() {
  if (!readinessForm || !scoreOutput) return;

  const fields = ["data", "enablement", "governance", "coaching", "analytics"];
  const values = fields.map((name) => Number(readinessForm.elements[name].value || 0));

  if (values.some((value) => value <= 0)) {
    scoreOutput.textContent = "Complete all fields to calculate your readiness tier.";
    return;
  }

  const score = values.reduce((total, value) => total + value, 0);
  const percentage = Math.round((score / (fields.length * 4)) * 100);

  if (percentage >= 80) {
    scoreOutput.textContent = `Tier: Scale-ready (${percentage}%). You have strong foundations for multi-team deployment with controlled expansion.`;
  } else if (percentage >= 60) {
    scoreOutput.textContent = `Tier: Pilot-ready (${percentage}%). Launch a focused team pilot and close governance and enablement gaps before broad rollout.`;
  } else {
    scoreOutput.textContent = `Tier: Foundation-required (${percentage}%). Prioritize data quality, manager discipline, and policy controls before production AI usage.`;
  }
}

function bindTimeline() {
  stageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const stage = button.dataset.stage;
      if (!stage || !stageData[stage]) return;
      setStage(stage);
    });
  });
}

function setStage(stageKey) {
  const stage = stageData[stageKey];
  if (!stage || !timelinePanel) return;

  stageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.stage === stageKey);
  });

  const points = stage.points.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  timelinePanel.innerHTML = `
    <h3>${escapeHtml(stage.title)}</h3>
    <p>${escapeHtml(stage.summary)}</p>
    <ul>${points}</ul>
  `;
}

function bindPricing() {
  billingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      billingButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      updatePricing();
    });
  });

  if (teamSizeRange) {
    teamSizeRange.addEventListener("input", () => {
      teamSizeLabel.textContent = teamSizeRange.value;
      updatePricing();
    });
  }
}

function updatePricing() {
  if (!teamSizeRange || !teamSizeLabel) return;

  const teamSize = Number(teamSizeRange.value);
  teamSizeLabel.textContent = String(teamSize);

  const billingMode = billingButtons.find((button) => button.classList.contains("active"))?.dataset.billing || "monthly";
  const multiplier = billingMode === "annual" ? 0.82 : 1;

  priceCards.forEach((card) => {
    const planKey = card.dataset.plan;
    const config = planPricing[planKey];
    if (!config) return;

    const planPrice = (config.base + config.perRep * teamSize) * multiplier;
    const priceEl = card.querySelector(".price strong");
    const unitEl = card.querySelector(".price span");

    if (priceEl) priceEl.textContent = currency.format(planPrice);
    if (unitEl) unitEl.textContent = billingMode === "annual" ? "/month (annual billing)" : "/month";
  });
}

function bindFaq() {
  faqQuestions.forEach((question) => {
    question.addEventListener("click", () => {
      const item = question.closest(".faq-item");
      if (!item) return;

      const wasOpen = item.classList.contains("open");
      faqQuestions.forEach((q) => {
        q.setAttribute("aria-expanded", "false");
        q.closest(".faq-item")?.classList.remove("open");
      });

      if (!wasOpen) {
        item.classList.add("open");
        question.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function bindBookForm() {
  if (!bookForm || !bookFormStatus) return;

  bookForm.addEventListener("submit", (event) => {
    event.preventDefault();
    bookFormStatus.className = "form-status";

    const name = bookForm.elements.name.value.trim();
    const email = bookForm.elements.email.value.trim();
    const company = bookForm.elements.company.value.trim();
    const team = Number(bookForm.elements.team.value);
    const goal = bookForm.elements.goal.value.trim();

    if (!name || !email || !company || !team || !goal) {
      bookFormStatus.textContent = "Please complete all form fields.";
      bookFormStatus.classList.add("error");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      bookFormStatus.textContent = "Enter a valid work email address.";
      bookFormStatus.classList.add("error");
      return;
    }

    bookFormStatus.textContent = "Request submitted. We will reach out with next-step scheduling options.";
    bookFormStatus.classList.add("success");
    bookForm.reset();
  });
}

function observeReveals() {
  const revealEls = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px",
    }
  );

  revealEls.forEach((el) => observer.observe(el));
}

function getFieldNumber(id) {
  const input = document.getElementById(id);
  if (!input) return 0;
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
