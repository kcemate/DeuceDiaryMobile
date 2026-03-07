import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Colors } from "../../constants/colors";
import { api } from "../../api/index";
import {
  scheduleStreakReminder,
  cancelAllStreakReminders,
} from "../../hooks/useNotifications";

// ── Storage keys ────────────────────────────────────────────────────
const STORAGE_KEY = "notificationPreferences";

// ── Types ───────────────────────────────────────────────────────────
export interface NotificationPreferences {
  streakReminders: boolean;
  streakReminderHour: number;
  streakReminderMinute: number;
  squadActivity: boolean;
  weeklyThroneReport: boolean;
  streakAtRisk: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  streakReminders: true,
  streakReminderHour: 20,
  streakReminderMinute: 0,
  squadActivity: true,
  weeklyThroneReport: true,
  streakAtRisk: true,
};

// ── Helpers (exported for testing) ──────────────────────────────────

export async function loadPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

export async function savePreferences(
  prefs: NotificationPreferences
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function syncPreferencesToBackend(
  prefs: NotificationPreferences
): Promise<void> {
  await api.patch("/api/users/me/notifications", prefs);
}

// ── Component ───────────────────────────────────────────────────────

export default function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences().then(setPrefs);
  }, []);

  const persist = useCallback(
    async (updated: NotificationPreferences) => {
      setSaving(true);
      try {
        await savePreferences(updated);
        await syncPreferencesToBackend(updated);

        // Reschedule or cancel the local streak reminder
        if (updated.streakReminders) {
          await scheduleStreakReminder(
            updated.streakReminderHour,
            updated.streakReminderMinute
          );
        } else {
          await cancelAllStreakReminders();
        }
      } catch {
        Alert.alert("Error", "Failed to save preferences. Try again.");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  function toggle(
    key: keyof Pick<
      NotificationPreferences,
      "streakReminders" | "squadActivity" | "weeklyThroneReport" | "streakAtRisk"
    >
  ) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    persist(updated);
  }

  function onTimeChange(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (!date) return;
    const updated = {
      ...prefs,
      streakReminderHour: date.getHours(),
      streakReminderMinute: date.getMinutes(),
    };
    setPrefs(updated);
    persist(updated);
  }

  const reminderDate = new Date();
  reminderDate.setHours(prefs.streakReminderHour, prefs.streakReminderMinute, 0, 0);

  const timeLabel = reminderDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>Stay on the throne</Text>

      {/* Streak Reminders */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelGroup}>
            <Text style={styles.label}>Streak Reminders</Text>
            <Text style={styles.description}>
              Daily nudge to keep your streak alive
            </Text>
          </View>
          <Switch
            value={prefs.streakReminders}
            onValueChange={() => toggle("streakReminders")}
            trackColor={{ false: Colors.lightGray, true: Colors.gold }}
            thumbColor={Colors.white}
            disabled={saving}
            accessibilityLabel="Streak reminders"
            accessibilityRole="switch"
          />
        </View>

        {prefs.streakReminders && (
          <TouchableOpacity
            style={styles.timeRow}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.7}
            accessibilityLabel={`Reminder time: ${timeLabel}`}
            accessibilityRole="button"
            accessibilityHint="Tap to change reminder time"
          >
            <Text style={styles.timeLabel}>Reminder Time</Text>
            <Text style={styles.timeValue}>{timeLabel}</Text>
          </TouchableOpacity>
        )}

        {showTimePicker && (
          <DateTimePicker
            value={reminderDate}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onTimeChange}
            textColor={Colors.espresso}
          />
        )}
      </View>

      {/* Squad Activity */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelGroup}>
            <Text style={styles.label}>Squad Activity</Text>
            <Text style={styles.description}>
              When squad members log or react
            </Text>
          </View>
          <Switch
            value={prefs.squadActivity}
            onValueChange={() => toggle("squadActivity")}
            trackColor={{ false: Colors.lightGray, true: Colors.gold }}
            thumbColor={Colors.white}
            disabled={saving}
            accessibilityLabel="Squad activity notifications"
            accessibilityRole="switch"
          />
        </View>
      </View>

      {/* Weekly Throne Report */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelGroup}>
            <Text style={styles.label}>Weekly Throne Report</Text>
            <Text style={styles.description}>
              Your weekly stats recap every Sunday
            </Text>
          </View>
          <Switch
            value={prefs.weeklyThroneReport}
            onValueChange={() => toggle("weeklyThroneReport")}
            trackColor={{ false: Colors.lightGray, true: Colors.gold }}
            thumbColor={Colors.white}
            disabled={saving}
            accessibilityLabel="Weekly throne report"
            accessibilityRole="switch"
          />
        </View>
      </View>

      {/* Streak At Risk */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.labelGroup}>
            <Text style={styles.label}>Streak at Risk Alerts</Text>
            <Text style={styles.description}>
              Heads-up when your streak is about to break
            </Text>
          </View>
          <Switch
            value={prefs.streakAtRisk}
            onValueChange={() => toggle("streakAtRisk")}
            trackColor={{ false: Colors.lightGray, true: Colors.gold }}
            thumbColor={Colors.white}
            disabled={saving}
            accessibilityLabel="Streak at risk alerts"
            accessibilityRole="switch"
          />
        </View>
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.espresso,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.secondaryText,
    marginBottom: 28,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelGroup: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.espresso,
  },
  description: {
    fontSize: 13,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  timeLabel: {
    fontSize: 14,
    color: Colors.espresso,
    fontWeight: "500",
  },
  timeValue: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: "700",
  },
});
