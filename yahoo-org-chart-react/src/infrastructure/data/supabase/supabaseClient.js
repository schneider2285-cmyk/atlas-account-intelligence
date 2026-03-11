function toQueryString({ select = "*", filters = [], order, limit } = {}) {
  const params = new URLSearchParams();
  params.set("select", select);

  filters.forEach((filter) => {
    params.append(filter.column, `${filter.op}.${filter.value}`);
  });

  if (order?.column) {
    params.set("order", `${order.column}.${order.ascending === false ? "desc" : "asc"}`);
  }

  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }

  return params.toString();
}

export class SupabaseClient {
  constructor({ url, anonKey, schema = "public" }) {
    this.url = url;
    this.anonKey = anonKey;
    this.schema = schema;
    this.accessToken = "";
  }

  get enabled() {
    return Boolean(this.url && this.anonKey);
  }

  setAccessToken(token) {
    this.accessToken = token || "";
  }

  async select(table, options = {}) {
    const queryString = toQueryString(options);
    return this.request(`/${table}?${queryString}`, { method: "GET" });
  }

  async upsert(table, payload, options = {}) {
    const { onConflict, ignoreDuplicates = false } = options;
    const path = onConflict
      ? `/${table}?on_conflict=${encodeURIComponent(onConflict)}`
      : `/${table}`;

    return this.request(path, {
      method: "POST",
      headers: {
        Prefer: `resolution=${ignoreDuplicates ? "ignore" : "merge"}-duplicates,return=representation`
      },
      body: JSON.stringify(payload)
    });
  }

  async insert(table, payload) {
    return this.request(`/${table}`, {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });
  }

  async request(path, init) {
    if (!this.enabled) {
      throw new Error("Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }

    const response = await fetch(`${this.url}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.accessToken || this.anonKey}`,
        "Content-Type": "application/json",
        "Accept-Profile": this.schema,
        ...(init?.headers || {})
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase request failed (${response.status}): ${text}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }
}
