import dossiers from "./perplexityDossiers.json";

const ACCOUNT_KEY_BY_ID = {
  "acct-yahoo": "yahoo",
  "acct-fico": "fico",
  "acct-schneider-electric": "schneider-electric"
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function keyForAccount(account) {
  if (!account) return "";

  if (ACCOUNT_KEY_BY_ID[account.id]) {
    return ACCOUNT_KEY_BY_ID[account.id];
  }

  const byName = normalize(account.name);
  if (byName.includes("schneider")) return "schneider-electric";
  if (byName.includes("yahoo")) return "yahoo";
  if (byName.includes("fico")) return "fico";

  return "";
}

export function getPerplexityDossier(account) {
  const key = keyForAccount(account);
  return key ? dossiers[key] : null;
}

export function getPerplexityDossierByKey(key) {
  return dossiers[key] || null;
}
