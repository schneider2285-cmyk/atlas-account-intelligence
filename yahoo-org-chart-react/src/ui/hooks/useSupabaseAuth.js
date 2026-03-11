import { useEffect, useMemo, useState } from "react";
import {
  clearStoredSession,
  getStoredSession,
  hasSupabaseAuthConfig,
  hydrateSessionProfile,
  signInWithPassword,
  signUpWithPassword
} from "../../infrastructure/auth/supabaseAuthClient";

export function useSupabaseAuth() {
  const [session, setSession] = useState(() => getStoredSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const configured = useMemo(() => hasSupabaseAuthConfig(), []);

  useEffect(() => {
    if (!session?.accessToken) return;

    let active = true;

    hydrateSessionProfile(session)
      .then((nextSession) => {
        if (!active) return;
        setSession(nextSession);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load user profile.");
      });

    return () => {
      active = false;
    };
  }, [session?.accessToken]);

  const signIn = async (email, password) => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const nextSession = await signInWithPassword(email, password);
      setSession(nextSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password) => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const result = await signUpWithPassword(email, password);
      if (result.session) {
        setSession(result.session);
      }
      setInfo(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    clearStoredSession();
    setSession(null);
    setError("");
    setInfo("");
  };

  return {
    configured,
    loading,
    error,
    info,
    session,
    accessToken: session?.accessToken || "",
    userEmail: session?.user?.email || "",
    role: session?.profile?.role || "manager",
    orgId: session?.profile?.orgId || "",
    canPersist: (session?.profile?.role || "manager") !== "rep",
    isAuthenticated: Boolean(session?.accessToken),
    signIn,
    signUp,
    signOut
  };
}
