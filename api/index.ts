import axios from "axios";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // send session cookies for dev auth
  timeout: 15_000, // 15s — prevent hanging requests
});

/** Extract a user-friendly message from a network/API error. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED") return "Request timed out. Please try again.";
    if (!err.response) return "Unable to connect. Check your internet and try again.";
    const status = err.response.status;
    if (status === 401 || status === 403) return "You don't have access. Please sign in again.";
    if (status >= 500) return "Something went wrong on our end. Try again shortly.";
    // Use server message if provided
    const serverMsg = err.response.data?.message || err.response.data?.error;
    if (typeof serverMsg === "string") return serverMsg;
  }
  return "Something went wrong. Please try again.";
}

// --- Clerk Bearer token support ---
// When Clerk is active, a token-getter function is registered here.
// The interceptor calls it on every request to attach a fresh JWT.
let _getToken: (() => Promise<string | null>) | null = null;

export function registerTokenGetter(fn: (() => Promise<string | null>) | null) {
  _getToken = fn;
}

api.interceptors.request.use(async (config) => {
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // token fetch failed — proceed without auth header
    }
  }
  return config;
});
