import Purchases from "react-native-purchases";

jest.mock("../../api/index", () => ({
  api: {
    post: jest.fn().mockResolvedValue({}),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  },
  registerTokenGetter: jest.fn(),
}));

import { configure, getCustomerInfo, syncWithBackend } from "../../services/revenuecat";

describe("services/revenuecat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("configure", () => {
    it("calls Purchases.configure with the API key", () => {
      const result = configure("test-key");
      expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: "test-key" });
      expect(result).toBe(true);
    });

    it("returns false when no API key provided", () => {
      const result = configure("");
      expect(Purchases.configure).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("returns false when Purchases.configure throws", () => {
      (Purchases.configure as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Failed");
      });
      const result = configure("test-key");
      expect(result).toBe(false);
    });
  });

  describe("getCustomerInfo", () => {
    it("returns isPremium true when entitlements are active", async () => {
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
        entitlements: {
          active: {
            premium: { expirationDate: "2027-01-01" },
          },
        },
      });

      const info = await getCustomerInfo();
      expect(info.isPremium).toBe(true);
      expect(info.activeEntitlements).toContain("premium");
      expect(info.expirationDate).toBe("2027-01-01");
    });

    it("returns isPremium false when no active entitlements", async () => {
      (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({
        entitlements: { active: {} },
      });

      const info = await getCustomerInfo();
      expect(info.isPremium).toBe(false);
      expect(info.activeEntitlements).toHaveLength(0);
    });

    it("returns safe default when SDK throws", async () => {
      (Purchases.getCustomerInfo as jest.Mock).mockRejectedValue(
        new Error("SDK Error")
      );

      const info = await getCustomerInfo();
      expect(info.isPremium).toBe(false);
      expect(info.activeEntitlements).toEqual([]);
      expect(info.expirationDate).toBeNull();
    });
  });

  describe("syncWithBackend", () => {
    it("posts to /api/user/subscription", async () => {
      const { api } = require("../../api/index");
      await syncWithBackend();
      expect(api.post).toHaveBeenCalledWith(
        "/api/user/subscription",
        { source: "revenuecat" }
      );
    });

    it("sends customerInfo when provided", async () => {
      const { api } = require("../../api/index");
      await syncWithBackend({ activeEntitlements: ["premium"], productId: "monthly" });
      expect(api.post).toHaveBeenCalledWith("/api/user/subscription", {
        source: "revenuecat",
        activeEntitlements: ["premium"],
        productId: "monthly",
      });
    });
  });
});
