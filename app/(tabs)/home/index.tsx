import { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryFeed } from "../../../hooks/useQueryFeed";
import { useAuth } from "../../../hooks/useAuth";
import { addReaction } from "../../../api/deuces";
import { Colors } from "../../../constants/colors";
import { ErrorState } from "../../components/ErrorState";
import { getErrorMessage } from "../../../api";
import type { Deuce } from "../../../types/api.types";

const REACTION_EMOJIS = ["💩", "🔥", "😂", "👑", "🙏"];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={[styles.avatar, { backgroundColor: Colors.lightGray }]} />
          <View
            style={{
              width: 100,
              height: 14,
              backgroundColor: Colors.lightGray,
              borderRadius: 7,
              marginLeft: 10,
            }}
          />
        </View>
        <View
          style={{
            width: 60,
            height: 12,
            backgroundColor: Colors.lightGray,
            borderRadius: 6,
          }}
        />
      </View>
      <View
        style={{
          width: "80%" as any,
          height: 14,
          backgroundColor: Colors.lightGray,
          borderRadius: 7,
          marginTop: 12,
        }}
      />
      <View
        style={{
          width: "50%" as any,
          height: 14,
          backgroundColor: Colors.lightGray,
          borderRadius: 7,
          marginTop: 8,
        }}
      />
    </View>
  );
}

function FeedCard({
  item,
  onReact,
}: {
  item: Deuce;
  onReact: (entryId: string, emoji: string) => void;
}) {
  const displayName =
    item.user?.username || item.user?.firstName || "Unknown";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.username}>{displayName}</Text>
        </View>
        <Text style={styles.time}>{relativeTime(item.loggedAt)}</Text>
      </View>

      {item.location ? (
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.location}>{item.location}</Text>
        </View>
      ) : null}

      {item.thoughts ? (
        <Text style={styles.thoughts}>{item.thoughts}</Text>
      ) : null}

      <View style={styles.reactionRow}>
        {REACTION_EMOJIS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.reactionButton}
            onPress={() => onReact(item.id, emoji)}
            activeOpacity={0.6}
            accessibilityLabel={`React with ${emoji}`}
            accessibilityRole="button"
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Free tier home screen ──
function FreeHome() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.freeContent}
    >
      {/* Log Deuce — the one free action */}
      <TouchableOpacity
        style={styles.logButton}
        onPress={() => router.push("/modals/log-a-deuce")}
        activeOpacity={0.85}
        accessibilityLabel="Log a Deuce"
        accessibilityRole="button"
      >
        <Text style={styles.logButtonEmoji}>🚽</Text>
        <Text style={styles.logButtonText}>Log a Deuce</Text>
      </TouchableOpacity>

      {/* Total Deuces stat */}
      <View style={styles.statCard}>
        <View>
          <Text style={styles.statLabel}>TOTAL DEUCES</Text>
          <Text style={styles.statNumber}>{user?.deuceCount ?? 0}</Text>
        </View>
        <View style={styles.statIcon}>
          <Text style={{ fontSize: 28 }}>💩</Text>
        </View>
      </View>

      {/* Premium upsell */}
      <View style={styles.upsellCard}>
        <Text style={styles.upsellCrown}>👑</Text>
        <Text style={styles.upsellTitle}>
          Unlock the Full Throne Experience
        </Text>

        <View style={styles.upsellBullets}>
          <Text style={styles.upsellBullet}>🏆  Compete with your squad</Text>
          <Text style={styles.upsellBullet}>🔥  Track your streaks</Text>
          <Text style={styles.upsellBullet}>🎨  Custom themes</Text>
        </View>

        <TouchableOpacity
          style={styles.upsellButton}
          onPress={() => router.push("/premium")}
          activeOpacity={0.8}
          accessibilityLabel="Go Premium"
          accessibilityRole="button"
        >
          <Text style={styles.upsellButtonText}>Go Premium</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isFree = user?.subscription !== "premium";
  const { data: feed, isLoading, isError, error, refetch, isRefetching } = useQueryFeed();

  const handleReact = useCallback(
    async (entryId: string, emoji: string) => {
      try {
        await addReaction(entryId, emoji);
      } catch {
        // silent — non-critical
      }
    },
    []
  );

  if (isFree) return <FreeHome />;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 16 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
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
      <FlatList
        data={feed ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard item={item} onReact={handleReact} />
        )}
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
            <Text style={styles.emptyEmoji}>🪣</Text>
            <Text style={styles.emptyTitle}>
              Nobody has dropped anything yet.
            </Text>
            <Text style={styles.emptySubtitle}>
              The silence is deafening.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/modals/log-a-deuce")}
        activeOpacity={0.85}
        accessibilityLabel="Log a Deuce"
        accessibilityRole="button"
      >
        <Text style={styles.fabEmoji}>🚽</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  list: { padding: 16, paddingBottom: 120 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brown,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.white,
  },
  username: { fontSize: 16, fontWeight: "700", color: Colors.espresso },
  time: { fontSize: 12, color: Colors.gray },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  locationIcon: { fontSize: 13, marginRight: 4 },
  location: { fontSize: 13, color: Colors.green, fontWeight: "500" },
  thoughts: {
    fontSize: 15,
    color: Colors.darkText,
    lineHeight: 22,
    marginTop: 4,
  },
  reactionRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 4,
  },
  reactionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.cream,
    borderRadius: 16,
  },
  reactionEmoji: { fontSize: 16 },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 120,
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
  fab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.green,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabEmoji: { fontSize: 28 },

  // ── Free tier styles ──
  freeContent: {
    padding: 20,
    paddingBottom: 120,
    alignItems: "center",
  },
  logButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.green,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logButtonEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  logButtonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: "bold",
  },
  statCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.white,
    width: "100%",
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.secondaryText,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 40,
    fontWeight: "900",
    color: Colors.espresso,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(45, 138, 78, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  upsellCard: {
    backgroundColor: Colors.white,
    width: "100%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  upsellCrown: {
    fontSize: 40,
    marginBottom: 8,
  },
  upsellTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.espresso,
    textAlign: "center",
    marginBottom: 16,
  },
  upsellBullets: {
    width: "100%",
    marginBottom: 20,
    gap: 12,
  },
  upsellBullet: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.espresso,
  },
  upsellButton: {
    backgroundColor: Colors.green,
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upsellButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: "bold",
  },
});
