import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../api/index";

const STREAK_REMINDER_ID = "streak-reminder";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permissions ──────────────────────────────────────────────────────
async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ── Push token registration ──────────────────────────────────────────
async function registerPushToken() {
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await api.post("/api/notifications/register", {
      token,
      platform: Platform.OS,
    });
  } catch (err) {
    console.warn("[Notifications] push token registration failed:", err);
  }
}

// ── Streak reminder scheduling ───────────────────────────────────────

export async function scheduleStreakReminder(hour = 20, minute = 0) {
  // Cancel existing reminder before re-scheduling
  await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(
    () => {},
  );

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_REMINDER_ID,
    content: {
      title: "\uD83D\uDEBD Don't break your streak!",
      body: "You haven't dropped a deuce today. Don't let the squad down.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelAllStreakReminders() {
  await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(
    () => {},
  );
}

/**
 * Cancel today's streak reminder and re-schedule for tomorrow 8 PM.
 * Call this after a successful deuce log.
 */
export async function cancelStreakReminder() {
  // Cancel the current daily reminder
  await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(
    () => {},
  );

  // Re-schedule for tomorrow at 8 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_REMINDER_ID,
    content: {
      title: "\uD83D\uDEBD Don't break your streak!",
      body: "You haven't dropped a deuce today. Don't let the squad down.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
  }).catch(() => {});
}

// ── Milestone broadcast notifications ────────────────────────────────

/**
 * Show a local notification when a squad member hits a milestone.
 * Call this when receiving a broadcast POST from /api/squads/:id/broadcast.
 */
export async function showMilestoneBroadcast(username: string, milestone: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "\uD83C\uDFC6 " + username + " hit a milestone!",
      body: milestone,
    },
    trigger: null, // fire immediately
  });
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useNotifications() {
  useEffect(() => {
    async function init() {
      const granted = await requestPermissions();
      if (!granted) return;

      await registerPushToken();
      await scheduleStreakReminder();
    }
    init();

    // Listen for incoming broadcast push notifications that contain milestone data
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.type === "milestone_broadcast" && data?.username && data?.milestone) {
          showMilestoneBroadcast(data.username as string, data.milestone as string);
        }
      },
    );

    return () => subscription.remove();
  }, []);
}
