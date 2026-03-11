import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

const agentCatalog = read("src/domain/agents/agentCatalog.js");
const agentCount = countMatches(agentCatalog, /id:\s*"[^"]+"/g);
assert(agentCount === 12, `Expected 12 agents in agentCatalog.js, found ${agentCount}.`);

const requiredPaths = [
  "src/domain/signals/signalEngine.js",
  "src/domain/scoring/opportunityScoring.js",
  "src/domain/briefs/dailyStrategyBrief.js",
  "src/infrastructure/data/supabase/atlasRepository.js",
  "src/infrastructure/connectors/connectorRegistry.js",
  "src/ui/components/Dashboard.jsx",
  "src/ui/components/OutreachKanban.jsx",
  "src/ui/components/OrgChartExplorer.jsx",
  "src/ui/components/StrategyBrief.jsx"
];

requiredPaths.forEach((relativePath) => {
  assert(exists(relativePath), `Required file is missing: ${relativePath}`);
});

const connectorRegistry = read("src/infrastructure/connectors/connectorRegistry.js");
const connectorCount = countMatches(connectorRegistry, /new\s+[A-Za-z0-9_]+Connector\(/g);
assert(connectorCount >= 6, `Expected at least 6 connectors, found ${connectorCount}.`);

const appEntry = read("src/App.jsx");
["Dashboard", "OutreachKanban", "OrgChartExplorer", "StrategyBrief"].forEach((componentName) => {
  assert(
    appEntry.includes(componentName),
    `App.jsx is expected to render ${componentName}.`
  );
});

console.log("Structure checks passed.");
