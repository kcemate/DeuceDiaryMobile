import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("../../api/index", () => ({
  api: {
    patch: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

import {
  loadPreferences,
  savePreferences,
  syncPreferencesToBackend,
  type NotificationPreferences,
} from "../../app/settings/notifications";
import { api } from "../../api/index";

const DEFAULT_PREFS: NotificationPreferences = {
  streakReminders: true,
  streakReminderHour: 20,
  streakReminderMinute: 0,
  squadActivity: true,
  weeklyThroneReport: true,
  streakAtRisk: true,
};

describe("Notification Preferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loadPreferences", () => {
    it("returns defaults when nothing is stored", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await loadPreferences();

      expect(result).toEqual(DEFAULT_PREFS);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        "notificationPreferences"
      );
    });

    it("returns stored preferences merged with defaults", async () => {
      const stored = { streakReminders: false, squadActivity: false };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(stored)
      );

      const result = await loadPreferences();

      expect(result).toEqual({
        ...DEFAULT_PREFS,
        streakReminders: false,
        squadActivity: false,
      });
    });

    it("returns defaults on parse error", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("invalid json{");

      const result = await loadPreferences();

      expect(result).toEqual(DEFAULT_PREFS);
    });
  });

  describe("savePreferences", () => {
    it("persists preferences to AsyncStorage as JSON", async () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_PREFS,
        streakReminders: false,
      };

      await savePreferences(prefs);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "notificationPreferences",
        JSON.stringify(prefs)
      );
    });
  });

  describe("syncPreferencesToBackend", () => {
    it("sends PATCH to /api/users/me/notifications", async () => {
      await syncPreferencesToBackend(DEFAULT_PREFS);

      expect(api.patch).toHaveBeenCalledWith(
        "/api/users/me/notifications",
        DEFAULT_PREFS
      );
    });
  });
});
