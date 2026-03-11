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

function toSessionPayload(response) {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresIn: response.expires_in,
    tokenType: response.token_type,
    user: response.user,
    createdAt: new Date().toISOString()
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

export async function signInWithPassword(email, password) {
  const response = await authRequest("/token?grant_type=password", { email, password });
  const session = toSessionPayload(response);
  persistSession(session);
  return session;
}

export async function signUpWithPassword(email, password) {
  const response = await authRequest("/signup", { email, password });
  const session = response.access_token ? toSessionPayload(response) : null;

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
