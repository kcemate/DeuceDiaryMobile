import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "../api/auth";
import { api, registerTokenGetter } from "../api/index";
import type { User } from "../types/api.types";

export const CLERK_ENABLED = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// ─── Dev-mode auth (username / session cookie) ────────────────────────
function useDevAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["auth", "user"],
    queryFn: getUser,
    retry: false, // don't retry on 401
    staleTime: 1000 * 60 * 5,
  });

  const isAuthenticated = !!user && !error;

  /** Call after successful login to refetch user */
  function onLoginSuccess() {
    queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
  }

  /** Clear auth state on logout */
  function onLogout() {
    queryClient.setQueryData(["auth", "user"], null);
    queryClient.clear();
  }

  return { user: user ?? null, isLoading, isAuthenticated, onLoginSuccess, onLogout };
}

// ─── Clerk auth (Bearer JWT) ──────────────────────────────────────────
function useClerkAuth() {
  // These imports are safe — the package is installed but hooks only
  // execute when CLERK_ENABLED is true (ClerkProvider is mounted).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useUser, useAuth: useClerkAuthHook } = require("@clerk/clerk-expo");

  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken, signOut } = useClerkAuthHook();

  // Register the token getter so the axios interceptor can attach JWTs
  useEffect(() => {
    if (isSignedIn) {
      registerTokenGetter(() => getToken());
    }
    return () => registerTokenGetter(null);
  }, [isSignedIn, getToken]);

  // Fetch our app-level user from the backend (the server validates the JWT
  // and returns the canonical User record, just like dev mode).
  const { data: user, isLoading: isQueryLoading, error } = useQuery<User>({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      // Fetch token inline so the very first request has it,
      // even before the interceptor effect has fired.
      const token = await getToken();
      const { data } = await api.get<User>("/api/auth/user", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return data;
    },
    enabled: isLoaded && !!isSignedIn,
    // On first Clerk login, the backend user may not exist yet (race with
    // provisioning). Retry up to 3 times with exponential backoff so the
    // backend has time to create the user record.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = !isLoaded || (!!isSignedIn && isQueryLoading);
  const isAuthenticated = isLoaded && !!isSignedIn && !!user && !error;

  function onLoginSuccess() {
    queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
  }

  async function onLogout() {
    registerTokenGetter(null);
    await signOut();
    queryClient.setQueryData(["auth", "user"], null);
    queryClient.clear();
  }

  return { user: user ?? null, isLoading, isAuthenticated, onLoginSuccess, onLogout };
}

// ─── Export ───────────────────────────────────────────────────────────
// CLERK_ENABLED is a build-time constant, so only one path ever executes.
export const useAuth = CLERK_ENABLED ? useClerkAuth : useDevAuth;
