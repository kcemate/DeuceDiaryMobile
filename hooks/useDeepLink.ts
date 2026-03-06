import { useEffect } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";

/**
 * Listens for incoming deep links (both custom scheme and universal links)
 * and navigates to the appropriate screen.
 *
 * Supported patterns:
 *   deucediary://invite/:code
 *   https://deucediary.app/invite/:code
 */
export function useDeepLink() {
  const router = useRouter();

  useEffect(() => {
    function handleURL(event: { url: string }) {
      try {
        const code = parseInviteCode(event.url);
        if (code) {
          router.push(`/invite/${code}` as any);
        }
      } catch (err) {
        console.warn("[DeepLink] failed to handle URL:", event.url, err);
      }
    }

    // Handle URL that launched the app (cold start)
    Linking.getInitialURL()
      .then((url) => {
        if (url) handleURL({ url });
      })
      .catch((err) => {
        console.warn("[DeepLink] failed to get initial URL:", err);
      });

    // Handle URLs while app is running (warm start)
    const subscription = Linking.addEventListener("url", handleURL);
    return () => subscription.remove();
  }, [router]);
}

function parseInviteCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    // Expo Linking.parse normalises both custom scheme and https URLs.
    // path will be "invite/<code>" for both deucediary://invite/abc
    // and https://deucediary.app/invite/abc
    const segments = parsed.path?.split("/").filter(Boolean) ?? [];
    if (segments[0] === "invite" && segments[1]) {
      return segments[1];
    }
    return null;
  } catch {
    return null;
  }
}
