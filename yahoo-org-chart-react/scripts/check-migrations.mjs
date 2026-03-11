import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const migrationsDir = path.join(projectRoot, "supabase", "migrations");
const policyDir = path.join(projectRoot, "supabase", "policies");

const PLACEHOLDER_PATTERNS = [
  /YOUR_[A-Z0-9_]+/,
  /<Cmd\+V/i,
  /REPLACE_ME/i,
  /TODO\b/i
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasPlaceholder(content) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content));
}

assert(fs.existsSync(migrationsDir), "Missing supabase/migrations directory.");
assert(fs.existsSync(policyDir), "Missing supabase/policies directory.");

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

assert(migrationFiles.length > 0, "No SQL migrations found in supabase/migrations.");

const prefixes = new Set();
let previousPrefix = "";

migrationFiles.forEach((file) => {
  assert(
    /^\d{14}_[a-z0-9_]+\.sql$/.test(file),
    `Migration filename must follow YYYYMMDDHHMMSS_name.sql: ${file}`
  );

  const [prefix] = file.split("_");
  assert(!prefixes.has(prefix), `Duplicate migration timestamp prefix detected: ${prefix}`);
  prefixes.add(prefix);

  assert(prefix > previousPrefix, `Migration order is not strictly increasing around ${file}`);
  previousPrefix = prefix;

  const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  assert(content.trim().length > 0, `Migration is empty: ${file}`);
  assert(!hasPlaceholder(content), `Migration contains placeholder text: ${file}`);
});

const policyFiles = fs
  .readdirSync(policyDir)
  .filter((file) => file.endsWith(".sql"));

assert(policyFiles.includes("production_rls.sql"), "Missing supabase/policies/production_rls.sql");
assert(policyFiles.includes("transitional_rls.sql"), "Missing supabase/policies/transitional_rls.sql");

policyFiles.forEach((file) => {
  const content = fs.readFileSync(path.join(policyDir, file), "utf8");
  assert(content.includes("policy"), `Expected policy statements in ${file}`);
});

console.log("Migration and policy checks passed.");
