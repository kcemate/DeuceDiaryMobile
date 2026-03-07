import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { postDeuce } from "../../api/deuces";
import { listSquads } from "../../api/squads";
import { getErrorMessage } from "../../api";
import { cancelStreakReminder } from "../../hooks/useNotifications";
import { Colors } from "../../constants/colors";
import type { Squad } from "../../types/api.types";

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const MAX_THOUGHT_LENGTH = 500;

export default function LogADeuceModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [thought, setThought] = useState("");
  const [location, setLocation] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isOverLimit = thought.length > MAX_THOUGHT_LENGTH;

  const { data: squads } = useQuery<Squad[]>({
    queryKey: ["squads"],
    queryFn: listSquads,
  });

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }

  async function handleSubmit() {
    if (submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await postDeuce({
        groupIds: selectedGroupIds,
        thoughts: thought.trim(),
        location: location.trim(),
      });

      queryClient.invalidateQueries({ queryKey: ["feed"] });
      cancelStreakReminder();

      // Update app icon badge to reflect new total deuce count
      if (result?.count != null) {
        Notifications.setBadgeCountAsync(result.count).catch(() => {});
      }

      setShowToast(true);
      setTimeout(() => {
        router.back();
      }, 1800);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.handle} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Drop a Deuce</Text>

        <Text style={styles.label}>Thought</Text>
        <TextInput
          style={[styles.textArea, isOverLimit && styles.textAreaOver]}
          placeholder="What's on your mind?"
          placeholderTextColor={Colors.gray}
          value={thought}
          onChangeText={setThought}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          accessibilityLabel="Thought"
          accessibilityHint="Share what's on your mind, up to 500 characters"
        />
        <Text
          style={[
            styles.charCounter,
            isOverLimit && styles.charCounterOver,
          ]}
        >
          {thought.length} / {MAX_THOUGHT_LENGTH}
        </Text>

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Where are you? (optional)"
          placeholderTextColor={Colors.gray}
          value={location}
          onChangeText={setLocation}
          accessibilityLabel="Location"
          accessibilityHint="Optionally enter where you are"
        />

        {squads && squads.length > 0 ? (
          <>
            <Text style={styles.label}>Squads</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillScroll}
              contentContainerStyle={styles.pillContainer}
            >
              {squads.map((squad) => {
                const isSelected = selectedGroupIds.includes(squad.id);
                return (
                  <TouchableOpacity
                    key={squad.id}
                    style={[
                      styles.pill,
                      isSelected && styles.pillSelected,
                    ]}
                    onPress={() => toggleGroup(squad.id)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${squad.name}${isSelected ? ", selected" : ""}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isSelected && styles.pillTextSelected,
                      ]}
                    >
                      {squad.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {submitError ? (
          <Text style={styles.submitError} accessibilityRole="alert">
            {submitError}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, (submitting || isOverLimit) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || isOverLimit}
          activeOpacity={0.8}
          accessibilityLabel="Drop it"
          accessibilityRole="button"
          accessibilityHint="Submit your deuce entry"
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitText}>Drop It</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          activeOpacity={0.6}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      <Toast message="Dropped! 💩" visible={showToast} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.warmSand,
    marginTop: 12,
    marginBottom: 8,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.espresso,
    marginBottom: 24,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.secondaryText,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: Colors.warmSand,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    backgroundColor: Colors.white,
    color: Colors.darkText,
    minHeight: 100,
    marginBottom: 4,
  },
  textAreaOver: {
    borderColor: "#CC3333",
  },
  charCounter: {
    fontSize: 12,
    color: Colors.secondaryText,
    textAlign: "right",
    marginBottom: 16,
  },
  charCounterOver: {
    color: "#CC3333",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.warmSand,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: Colors.white,
    color: Colors.darkText,
    marginBottom: 20,
  },
  pillScroll: {
    marginBottom: 28,
  },
  pillContainer: {
    gap: 8,
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.warmSand,
    backgroundColor: Colors.white,
  },
  pillSelected: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.espresso,
  },
  pillTextSelected: {
    color: Colors.white,
  },
  submitError: {
    fontSize: 14,
    color: "#CC3333",
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: Colors.green,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 12,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    color: Colors.secondaryText,
    fontSize: 16,
    fontWeight: "500",
  },
  toast: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    backgroundColor: Colors.espresso,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  toastText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
