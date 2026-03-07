import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { listSquads, createSquad, getGroupStreak } from "../../../api/squads";
import { useAuth } from "../../../hooks/useAuth";
import { usePaywall } from "../../../hooks/usePaywall";
import { Colors } from "../../../constants/colors";
import { ErrorState } from "../../components/ErrorState";
import { getErrorMessage } from "../../../api";
import type { Squad, StreakData } from "../../../types/api.types";

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "No activity yet";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "last deuce just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `last deuce ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last deuce ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last deuce ${days}d ago`;
}

export default function SquadsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showPaywall } = usePaywall();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const {
    data: squads,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["squads"],
    queryFn: listSquads,
  });

  // Fetch streaks for all squads in parallel
  const streakQueries = useQueries({
    queries: (squads ?? []).map((s) => ({
      queryKey: ["streak", s.id],
      queryFn: () => getGroupStreak(s.id),
      staleTime: 1000 * 60,
      enabled: !!squads,
    })),
  });

  const streakMap = new Map<string, number>();
  (squads ?? []).forEach((s, i) => {
    const data = streakQueries[i]?.data;
    if (data) streakMap.set(s.id, data.currentStreak);
  });

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    try {
      await createSquad({ name });
      queryClient.invalidateQueries({ queryKey: ["squads"] });
      setNewName("");
      setShowCreate(false);
    } catch (err: any) {
      // Backend returns 403 with upgrade:true when squad limit is hit
      if (err?.response?.status === 403 && err.response.data?.feature === "unlimited_squads") {
        showPaywall("unlimited_squads");
      } else {
        Alert.alert("Error", "Could not create squad. Try again.");
      }
    } finally {
      setCreating(false);
    }
  }

  function renderItem({ item }: { item: Squad }) {
    const currentStreak = streakMap.get(item.id) ?? 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/squads/${item.id}` as any)}
        activeOpacity={0.7}
        accessibilityLabel={`Open squad ${item.name}`}
        accessibilityRole="button"
      >
        <View style={styles.cardTop}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.cardTopRight}>
            {currentStreak > 0 ? (
              <Text style={styles.streakBadge}>🔥 {currentStreak}</Text>
            ) : null}
            <Text style={styles.memberCount}>
              {item.memberCount ?? 0} 👥
            </Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.lastActivity}>
          {relativeTime(item.lastActivity)}
        </Text>
      </TouchableOpacity>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.green} />
      </View>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Create a Squad */}
      {showCreate ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            placeholder="Squad name..."
            placeholderTextColor={Colors.gray}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            accessibilityLabel="Squad name"
            accessibilityHint="Enter a name for your new squad"
          />
          <TouchableOpacity
            style={styles.createSubmit}
            onPress={handleCreate}
            disabled={creating}
            accessibilityLabel="Create squad"
            accessibilityRole="button"
          >
            {creating ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.createSubmitText}>Create</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowCreate(false);
              setNewName("");
            }}
            style={styles.createCancel}
            accessibilityLabel="Cancel creating squad"
            accessibilityRole="button"
          >
            <Text style={styles.createCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
          accessibilityLabel="Create a Squad"
          accessibilityRole="button"
        >
          <Text style={styles.createButtonText}>+ Create a Squad</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={squads ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.green}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🪑</Text>
            <Text style={styles.emptyTitle}>Lonely throne vibes.</Text>
            <Text style={styles.emptySubtitle}>
              Create a squad or share an invite link.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.cream,
  },
  list: { padding: 16, paddingBottom: 100 },
  createButton: {
    backgroundColor: Colors.green,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  createButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    gap: 8,
  },
  createInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.warmSand,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: Colors.white,
    color: Colors.darkText,
  },
  createSubmit: {
    backgroundColor: Colors.green,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  createSubmitText: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: 14,
  },
  createCancel: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  createCancelText: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.espresso,
    flex: 1,
  },
  streakBadge: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gold,
  },
  memberCount: {
    fontSize: 14,
    color: Colors.secondaryText,
  },
  description: {
    fontSize: 14,
    color: Colors.secondaryText,
    marginBottom: 8,
  },
  lastActivity: {
    fontSize: 13,
    color: Colors.green,
    fontWeight: "500",
    marginTop: 4,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.espresso,
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.secondaryText,
    textAlign: "center",
  },
});
