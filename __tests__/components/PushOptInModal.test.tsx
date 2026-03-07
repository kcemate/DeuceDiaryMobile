import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  PushOptInModal,
  hasSeenPushPrompt,
  markPushPromptSeen,
} from "../../app/components/PushOptInModal";

describe("PushOptInModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("hasSeenPushPrompt", () => {
    it("returns false when key is not set", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await hasSeenPushPrompt();

      expect(result).toBe(false);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("hasSeenPushPrompt");
    });

    it("returns true when key is 'true'", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("true");

      const result = await hasSeenPushPrompt();

      expect(result).toBe(true);
    });
  });

  describe("markPushPromptSeen", () => {
    it("sets the key in AsyncStorage", async () => {
      await markPushPromptSeen();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "hasSeenPushPrompt",
        "true"
      );
    });
  });

  describe("rendering", () => {
    it("shows the modal when visible is true", () => {
      const { getByText } = render(
        <PushOptInModal visible={true} onDismiss={jest.fn()} />
      );

      expect(getByText("Never Miss a Day")).toBeTruthy();
      expect(getByText("Enable Reminders")).toBeTruthy();
      expect(getByText("Maybe Later")).toBeTruthy();
    });

    it("calls requestPermissionsAsync and onDismiss when Enable is pressed", async () => {
      const onDismiss = jest.fn();
      const { getByText } = render(
        <PushOptInModal visible={true} onDismiss={onDismiss} />
      );

      fireEvent.press(getByText("Enable Reminders"));

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "hasSeenPushPrompt",
          "true"
        );
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
        expect(onDismiss).toHaveBeenCalled();
      });
    });

    it("marks prompt seen and dismisses when Maybe Later is pressed", async () => {
      const onDismiss = jest.fn();
      const { getByText } = render(
        <PushOptInModal visible={true} onDismiss={onDismiss} />
      );

      fireEvent.press(getByText("Maybe Later"));

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          "hasSeenPushPrompt",
          "true"
        );
        expect(onDismiss).toHaveBeenCalled();
      });
    });

    it("does not call requestPermissionsAsync when Maybe Later is pressed", async () => {
      const { getByText } = render(
        <PushOptInModal visible={true} onDismiss={jest.fn()} />
      );

      fireEvent.press(getByText("Maybe Later"));

      await waitFor(() => {
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      });
    });
  });
});
