import Purchases, { type CustomerInfo } from "react-native-purchases";
import { api } from "../api";

/**
 * Configure RevenueCat SDK. Call once at app startup when a real key is present.
 * Returns null gracefully if the key is missing or configuration fails.
 */
export function configure(apiKey: string): boolean {
  if (!apiKey) {
    console.warn("[RevenueCat] No API key provided — skipping configuration");
    return false;
  }
  try {
    Purchases.configure({ apiKey });
    return true;
  } catch (err) {
    console.warn("[RevenueCat] Configuration failed:", err);
    return false;
  }
}

/**
 * Fetch current customer subscription status from RevenueCat.
 * Returns a safe default if RevenueCat is unavailable.
 */
export async function getCustomerInfo(): Promise<{
  isPremium: boolean;
  activeEntitlements: string[];
  expirationDate: string | null;
}> {
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    const activeEntitlements = Object.keys(info.entitlements.active);

    // Find the latest expiration across all active entitlements
    let expirationDate: string | null = null;
    for (const key of activeEntitlements) {
      const ent = info.entitlements.active[key];
      if (ent.expirationDate && (!expirationDate || ent.expirationDate > expirationDate)) {
        expirationDate = ent.expirationDate;
      }
    }

    return {
      isPremium: activeEntitlements.length > 0,
      activeEntitlements,
      expirationDate,
    };
  } catch (err) {
    console.warn("[RevenueCat] getCustomerInfo failed:", err);
    return { isPremium: false, activeEntitlements: [], expirationDate: null };
  }
}

/**
 * After a successful purchase, immediately notify the backend so it can
 * update the user's subscription status without waiting for the webhook.
 */
export async function syncWithBackend(customerInfo?: {
  activeEntitlements: string[];
  productId?: string;
}): Promise<void> {
  await api.post("/api/user/subscription", {
    source: "revenuecat",
    ...(customerInfo ?? {}),
  });
}
