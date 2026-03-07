import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuth, CLERK_ENABLED } from "../hooks/useAuth";
import { useDeepLink } from "../hooks/useDeepLink";
import { useNotifications } from "../hooks/useNotifications";
import { PaywallProvider } from "../hooks/usePaywall";
import { PaywallModal } from "./components/PaywallModal";
import { PushOptInModal, hasSeenPushPrompt } from "./components/PushOptInModal";
import { hasCompletedOnboarding } from "./onboarding";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { OfflineBanner } from "./components/OfflineBanner";

// Conditional Clerk imports — only used when the env var is set.
const ClerkProvider = CLERK_ENABLED
  ? require("@clerk/clerk-expo").ClerkProvider
  : null;
const tokenCache = CLERK_ENABLED
  ? require("@clerk/clerk-expo/token-cache").tokenCache
  : null;
const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AuthGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showPushOptIn, setShowPushOptIn] = useState(false);

  // Activate deep link listener
  useDeepLink();

  // Register push notifications & schedule streak reminder
  useNotifications();

  // Sync app icon badge to user's total deuce count
  useEffect(() => {
    if (isAuthenticated && user?.deuceCount != null) {
      Notifications.setBadgeCountAsync(user.deuceCount).catch(() => {});
    } else if (!isAuthenticated) {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }
  }, [isAuthenticated, user?.deuceCount]);

  // Check onboarding status on mount — skip entirely for authenticated Clerk users
  useEffect(() => {
    if (CLERK_ENABLED && isAuthenticated) {
      setNeedsOnboarding(false);
      setOnboardingChecked(true);
      return;
    }
    hasCompletedOnboarding().then((completed) => {
      setNeedsOnboarding(!completed);
      setOnboardingChecked(true);
    });
  }, [isAuthenticated]);

  // Show push opt-in prompt once after first authentication
  useEffect(() => {
    if (!isAuthenticated || !onboardingChecked) return;
    hasSeenPushPrompt().then((seen) => {
      if (!seen) setShowPushOptIn(true);
    });
  }, [isAuthenticated, onboardingChecked]);

  useEffect(() => {
    if (isLoading || !onboardingChecked) return;

    const inAuthGroup = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";
    const inInvite = segments[0] === "invite";

    // Let invite deep links through regardless of auth state
    if (inInvite) return;

    // Show onboarding on first launch — skip if already authenticated
    if (needsOnboarding && !inOnboarding && !isAuthenticated) {
      router.replace("/onboarding");
      return;
    }

    if (!isAuthenticated && !inAuthGroup && !inOnboarding) {
      router.replace(
        CLERK_ENABLED ? "/auth/sign-in-clerk" : "/auth/sign-in"
      );
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)/home");
    }
  }, [isAuthenticated, isLoading, segments, onboardingChecked, needsOnboarding]);

  return (
    <PaywallProvider segments={segments as string[]}>
      <StatusBar style="dark" />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/sign-in" />
        <Stack.Screen name="auth/sign-in-clerk" />
        <Stack.Screen
          name="modals/log-a-deuce"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="invite/[code]" />
        <Stack.Screen name="legacy/[username]" options={{ headerShown: true, title: "Legacy Wall" }} />
        <Stack.Screen name="premium/index" options={{ headerShown: true, title: "Premium" }} />
        <Stack.Screen name="settings/index" options={{ headerShown: true, title: "Settings" }} />
        <Stack.Screen name="settings/notifications" options={{ headerShown: true, title: "Notifications" }} />
        <Stack.Screen name="settings/widget-preview" options={{ headerShown: true, title: "Widget Preview" }} />
        <Stack.Screen name="referral/index" options={{ headerShown: true, title: "Refer Friends" }} />
      </Stack>
      <PaywallModal />
      <PushOptInModal
        visible={showPushOptIn}
        onDismiss={() => setShowPushOptIn(false)}
      />
    </PaywallProvider>
  );
}

export default function RootLayout() {
  const inner = (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );

  if (ClerkProvider && CLERK_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
        {inner}
      </ClerkProvider>
    );
  }

  return inner;
}
