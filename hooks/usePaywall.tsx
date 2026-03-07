import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { api } from "../api/index";
import type { AxiosError } from "axios";

// ── Feature definitions ─────────────────────────────────────────────────
export type PaywallFeature =
  | "unlimited_squads"
  | "streak_insurance"
  | "spy_mode"
  | "daily_challenges"
  | "throne_broadcast"
  | "premium_analytics"
  | "custom_themes";

interface FeatureConfig {
  title: string;
  description: string;
  emoji: string;
}

export const FEATURE_CONFIG: Record<PaywallFeature, FeatureConfig> = {
  unlimited_squads: {
    title: "Unlock Unlimited Squads",
    description: "Create and join as many squads as you want.",
    emoji: "\uD83D\uDC65",
  },
  streak_insurance: {
    title: "Protect Your Streak",
    description: "Miss a day? We've got you covered.",
    emoji: "\uD83D\uDD25",
  },
  spy_mode: {
    title: "Activate Spy Mode",
    description: "See who viewed your logs.",
    emoji: "\uD83D\uDD75\uFE0F",
  },
  daily_challenges: {
    title: "Unlock Daily Challenges",
    description: "Compete in daily throne challenges.",
    emoji: "\uD83C\uDFAF",
  },
  throne_broadcast: {
    title: "Broadcast to the Throne",
    description: "Share your achievements with the world.",
    emoji: "\uD83D\uDCE3",
  },
  premium_analytics: {
    title: "See Full Report — Premium",
    description: "Unlock your full Weekly Throne Report.",
    emoji: "\uD83D\uDCCA",
  },
  custom_themes: {
    title: "Make It Yours",
    description: "Unlock premium themes and customization.",
    emoji: "\uD83C\uDFA8",
  },
};

// ── Suppressed routes — never show paywall here ─────────────────────────
// Checked against current navigation segments; if any segment matches, the
// automatic 403 interceptor will NOT trigger.
const SUPPRESSED_SEGMENTS = ["auth", "onboarding", "invite", "legacy", "premium"];

// ── Context ─────────────────────────────────────────────────────────────
interface PaywallContextValue {
  /** Currently visible paywall feature, or null if hidden */
  activeFeature: PaywallFeature | null;
  /** Programmatically open the paywall modal for a given feature */
  showPaywall: (feature: PaywallFeature) => void;
  /** Close the paywall modal */
  dismissPaywall: () => void;
}

const PaywallContext = createContext<PaywallContextValue>({
  activeFeature: null,
  showPaywall: () => {},
  dismissPaywall: () => {},
});

export function usePaywall() {
  return useContext(PaywallContext);
}

// ── Provider ────────────────────────────────────────────────────────────
interface PaywallProviderProps {
  children: React.ReactNode;
  /** Current navigation segments — used to suppress paywall on certain screens */
  segments?: string[];
}

export function PaywallProvider({ children, segments }: PaywallProviderProps) {
  const [activeFeature, setActiveFeature] = useState<PaywallFeature | null>(
    null,
  );
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const showPaywall = useCallback((feature: PaywallFeature) => {
    setActiveFeature(feature);
  }, []);

  const dismissPaywall = useCallback(() => {
    setActiveFeature(null);
  }, []);

  // Install 403 response interceptor
  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ upgrade?: boolean; feature?: string }>) => {
        if (error.response?.status === 403 && error.response.data?.upgrade) {
          // Check if we're on a suppressed route
          const currentSegments = segmentsRef.current ?? [];
          const isSuppressed = currentSegments.some((seg) =>
            SUPPRESSED_SEGMENTS.includes(seg),
          );

          if (!isSuppressed) {
            const feature = error.response.data.feature as
              | PaywallFeature
              | undefined;
            if (feature && feature in FEATURE_CONFIG) {
              setActiveFeature(feature);
            }
          }
        }
        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, []);

  return (
    <PaywallContext.Provider
      value={{ activeFeature, showPaywall, dismissPaywall }}
    >
      {children}
    </PaywallContext.Provider>
  );
}
