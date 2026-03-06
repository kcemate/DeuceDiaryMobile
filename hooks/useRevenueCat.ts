import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import {
  configure,
  getCustomerInfo,
  syncWithBackend,
} from "../services/revenuecat";

const REVENUECAT_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_KEY || "placeholder";
const IS_DEV = REVENUECAT_KEY === "placeholder";
const DEV_PREMIUM_KEY = "dev_premium";

const PRODUCT_IDS = {
  monthly: "deuce_diary_premium_monthly",
  annual: "deuce_diary_premium_annual",
} as const;

export function useRevenueCat() {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Initialise ──────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        if (IS_DEV) {
          const stored = await AsyncStorage.getItem(DEV_PREMIUM_KEY);
          setIsPremium(stored === "true");
        } else {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
          configure(REVENUECAT_KEY);
          const info = await getCustomerInfo();
          setIsPremium(info.isPremium);
        }
      } catch (err) {
        console.error("[RevenueCat] init error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // ── Purchase helpers ────────────────────────────────────────────────
  const purchaseMonthly = useCallback(async () => {
    if (IS_DEV) {
      await AsyncStorage.setItem(DEV_PREMIUM_KEY, "true");
      setIsPremium(true);
      return { success: true };
    }

    try {
      const { customerInfo } = await Purchases.purchaseProduct(
        PRODUCT_IDS.monthly,
      );
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      const premium = activeEntitlements.length > 0;
      setIsPremium(premium);
      if (premium) await syncWithBackend({ activeEntitlements, productId: PRODUCT_IDS.monthly });
      return { success: premium };
    } catch (err: any) {
      if (err.userCancelled) return { success: false, cancelled: true };
      throw err;
    }
  }, []);

  const purchaseAnnual = useCallback(async () => {
    if (IS_DEV) {
      await AsyncStorage.setItem(DEV_PREMIUM_KEY, "true");
      setIsPremium(true);
      return { success: true };
    }

    try {
      const { customerInfo } = await Purchases.purchaseProduct(
        PRODUCT_IDS.annual,
      );
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      const premium = activeEntitlements.length > 0;
      setIsPremium(premium);
      if (premium) await syncWithBackend({ activeEntitlements, productId: PRODUCT_IDS.annual });
      return { success: premium };
    } catch (err: any) {
      if (err.userCancelled) return { success: false, cancelled: true };
      throw err;
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    if (IS_DEV) {
      const stored = await AsyncStorage.getItem(DEV_PREMIUM_KEY);
      setIsPremium(stored === "true");
      return { success: stored === "true" };
    }

    try {
      const info = await Purchases.restorePurchases();
      const activeEntitlements = Object.keys(info.entitlements.active);
      const premium = activeEntitlements.length > 0;
      setIsPremium(premium);
      if (premium) await syncWithBackend({ activeEntitlements });
      return { success: premium };
    } catch (err) {
      console.error("[RevenueCat] restore error:", err);
      throw err;
    }
  }, []);

  return { isPremium, purchaseMonthly, purchaseAnnual, restorePurchases, isLoading };
}
