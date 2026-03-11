const SESSION_STORAGE_KEY = "atlas_supabase_auth_session_v1";

function getConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
  };
}

function parseErrorText(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed.msg || parsed.message || text;
  } catch {
    return text;
  }
}

function persistSession(session) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function loadSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function authRequest(path, payload) {
  const { url, anonKey } = getConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase auth config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const response = await fetch(`${url}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(parseErrorText(text));
  }

  return text ? JSON.parse(text) : {};
}

function toSessionPayload(response, profile = null) {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresIn: response.expires_in,
    tokenType: response.token_type,
    user: response.user,
    profile,
    createdAt: new Date().toISOString()
  };
}

function resolveProfile(profile) {
  if (profile) return profile;
  return {
    role: "manager",
    orgId: "00000000-0000-0000-0000-000000000001"
  };
}

export function getStoredSession() {
  return loadSession();
}

export function clearStoredSession() {
  clearSession();
}

export function hasSupabaseAuthConfig() {
  const { url, anonKey } = getConfig();
  return Boolean(url && anonKey);
}

export async function fetchUserProfile(accessToken, userId) {
  const { url, anonKey } = getConfig();

  if (!url || !anonKey || !accessToken || !userId) {
    return null;
  }

  const query = new URLSearchParams({
    select: "org_id,role",
    user_id: `eq.${userId}`,
    limit: "1"
  });

  const response = await fetch(`${url}/rest/v1/atlas_user_profiles?${query.toString()}`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Accept-Profile": "public"
    }
  });

  if (!response.ok) {
    return null;
  }

  const rows = await response.json();
  const row = rows[0];
  if (!row) return null;

  return {
    orgId: row.org_id,
    role: row.role
  };
}

export async function hydrateSessionProfile(session) {
  if (!session?.accessToken || !session?.user?.id) return session;
  const profile = resolveProfile(await fetchUserProfile(session.accessToken, session.user.id));
  const nextSession = {
    ...session,
    profile
  };
  persistSession(nextSession);
  return nextSession;
}

export async function signInWithPassword(email, password) {
  const response = await authRequest("/token?grant_type=password", { email, password });
  const profile = resolveProfile(await fetchUserProfile(response.access_token, response.user?.id));
  const session = toSessionPayload(response, profile);
  persistSession(session);
  return session;
}

export async function signUpWithPassword(email, password) {
  const response = await authRequest("/signup", { email, password });
  const profile = resolveProfile(await fetchUserProfile(response.access_token, response.user?.id));
  const session = response.access_token ? toSessionPayload(response, profile) : null;

  if (session) {
    persistSession(session);
  }

  return {
    session,
    user: response.user,
    message: session
      ? "Account created and signed in."
      : "Account created. Check email confirmation settings in Supabase Auth."
  };
}
