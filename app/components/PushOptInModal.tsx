import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Colors } from "../../constants/colors";

const PUSH_PROMPT_KEY = "hasSeenPushPrompt";

export async function hasSeenPushPrompt(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PUSH_PROMPT_KEY);
  return value === "true";
}

export async function markPushPromptSeen(): Promise<void> {
  await AsyncStorage.setItem(PUSH_PROMPT_KEY, "true");
}

interface PushOptInModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function PushOptInModal({ visible, onDismiss }: PushOptInModalProps) {
  async function handleEnable() {
    await markPushPromptSeen();
    await Notifications.requestPermissionsAsync();
    onDismiss();
  }

  async function handleSkip() {
    await markPushPromptSeen();
    onDismiss();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji} accessibilityElementsHidden>
            {"\uD83D\uDD25"}
          </Text>
          <Text style={styles.title}>Never Miss a Day</Text>
          <Text style={styles.body}>
            Get a gentle reminder each evening to keep your streak alive. You
            can change the time or turn them off anytime in Settings.
          </Text>

          <TouchableOpacity
            style={styles.enableButton}
            onPress={handleEnable}
            activeOpacity={0.8}
            accessibilityLabel="Enable reminders"
            accessibilityRole="button"
          >
            <Text style={styles.enableText}>Enable Reminders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.6}
            accessibilityLabel="Maybe later"
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.espresso,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: Colors.secondaryText,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  enableButton: {
    backgroundColor: Colors.gold,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
    marginBottom: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enableText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  skipText: {
    fontSize: 14,
    color: Colors.secondaryText,
    fontWeight: "500",
  },
});
