import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getGroupLeaderboard } from "../../../api/squads";
import type { LeaderboardEntry } from "../../../types/api.types";

function getRankDisplay(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function LeaderboardScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leaderboard", groupId],
    queryFn: () => getGroupLeaderboard(groupId!),
    enabled: !!groupId,
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#C8A951" size="large" style={styles.centered} />
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.emptyText}>Failed to load leaderboard</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
            activeOpacity={0.7}
            accessibilityLabel="Retry loading leaderboard"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : !data || data.length === 0 ? (
        <Text style={styles.emptyText}>No members yet</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }: { item: LeaderboardEntry; index: number }) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            return (
              <View style={[styles.row, isTop3 && styles.rowTop3]} accessible accessibilityLabel={`Rank ${rank}, ${item.username ?? "Anonymous"}, ${item.deuceCount} ${item.deuceCount === 1 ? "deuce" : "deuces"}`}>
                <Text style={[styles.rank, isTop3 && styles.rankTop3]} accessibilityElementsHidden>
                  {getRankDisplay(rank)}
                </Text>
                <View style={styles.info} accessibilityElementsHidden>
                  <Text style={styles.username}>
                    {item.username ?? "Anonymous"}
                  </Text>
                  <Text style={styles.count}>
                    {item.deuceCount} {item.deuceCount === 1 ? "deuce" : "deuces"}
                  </Text>
                </View>
                {rank === 1 && (
                  <Text style={styles.crown} accessibilityElementsHidden>👑</Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0F00",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A1F10",
  },
  backBtn: {
    width: 60,
  },
  backText: {
    color: "#C8A951",
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    color: "#F5EFE0",
    fontSize: 18,
    fontWeight: "700",
  },
  centered: {
    marginTop: 60,
  },
  emptyText: {
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 60,
    fontSize: 15,
  },
  errorContainer: {
    alignItems: "center",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#C8A951",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  retryButtonText: {
    color: "#1A0F00",
    fontSize: 15,
    fontWeight: "bold",
  },
  list: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#231508",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowTop3: {
    borderWidth: 1,
    borderColor: "#C8A95140",
    backgroundColor: "#2A1B08",
  },
  rank: {
    width: 44,
    fontSize: 16,
    fontWeight: "700",
    color: "#8E8E93",
    textAlign: "center",
  },
  rankTop3: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    color: "#F5EFE0",
    fontSize: 16,
    fontWeight: "600",
  },
  count: {
    color: "#8E8E93",
    fontSize: 13,
    marginTop: 2,
  },
  crown: {
    fontSize: 20,
  },
});
