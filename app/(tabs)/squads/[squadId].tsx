import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSquadDetail, getGroupStreak, createInvite } from "../../../api/squads";
import { getGroupFeed, addReaction } from "../../../api/deuces";
import { useGroupSocket } from "../../../hooks/useGroupSocket";
import { useAuth } from "../../../hooks/useAuth";
import { useRevenueCat } from "../../../hooks/useRevenueCat";
import { usePaywall } from "../../../hooks/usePaywall";
import { Colors } from "../../../constants/colors";
import type { Deuce, StreakData, SquadDetail } from "../../../types/api.types";

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

function getMilestoneBadge(streak: number): string {
  if (streak >= 30) return "💎";
  if (streak >= 14) return "🥇";
  if (streak >= 7) return "🥈";
  if (streak >= 3) return "🥉";
  return "";
}

function getMilestoneLabel(streak: number): string {
  if (streak >= 30) return "Diamond tier";
  if (streak >= 14) return "Gold tier";
  if (streak >= 7) return "Silver tier";
  if (streak >= 3) return "Bronze tier";
  return "";
}

// ─── Streak Card ─────────────────────────────────────────────
function StreakCard({
  streak,
  isPremium,
  onStreakPaywall,
  previousStreak,
}: {
  streak: StreakData;
  isPremium: boolean;
  onStreakPaywall: () => void;
  previousStreak: number | null;
}) {
  const active = streak.currentStreak > 0;
  const badge = getMilestoneBadge(streak.currentStreak);
  const milestoneLabel = getMilestoneLabel(streak.currentStreak);
  // Trigger (e): streak was lost (previous was >0, now is 0)
  const streakLost = previousStreak !== null && previousStreak > 0 && streak.currentStreak === 0;

  return (
    <View style={[styles.streakCard, active ? styles.streakCardActive : styles.streakCardInactive]}>
      {active ? (
        <>
          <View style={styles.streakTop}>
            <Text style={styles.streakFlame}>{"\uD83D\uDD25"}</Text>
            <Text style={styles.streakNumber}>{streak.currentStreak}</Text>
            {badge ? <Text style={styles.streakBadge}>{badge}</Text> : null}
          </View>
          <Text style={styles.streakLabel}>
            {streak.currentStreak}-day streak
          </Text>
          {milestoneLabel ? (
            <Text style={styles.milestoneLabel}>{milestoneLabel}</Text>
          ) : null}

          {/* Trigger (b): Streak Insurance button for free users */}
          {!isPremium && (
            <TouchableOpacity
              style={styles.streakInsuranceButton}
              onPress={onStreakPaywall}
              activeOpacity={0.8}
              accessibilityLabel="Activate streak insurance"
              accessibilityRole="button"
              accessibilityHint="Protect your streak with Premium"
            >
              <Text style={styles.streakInsuranceText}>
                {"\uD83D\uDEE1\uFE0F"} Streak Insurance
              </Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <>
          <Text style={styles.streakZeroEmoji}>{"\uD83D\uDEBD"}</Text>
          <Text style={styles.streakZeroText}>
            Start a streak — every member logs today to begin!
          </Text>

          {/* Trigger (e): Streak loss prompt */}
          {streakLost && !isPremium && (
            <TouchableOpacity
              style={styles.streakLossPrompt}
              onPress={onStreakPaywall}
              activeOpacity={0.8}
              accessibilityLabel="Recover from streak loss with Premium"
              accessibilityRole="button"
            >
              <Text style={styles.streakLossEmoji}>{"\uD83D\uDCA8"}</Text>
              <Text style={styles.streakLossTitle}>Never lose your streak again</Text>
              <Text style={styles.streakLossSubtitle}>
                Get Streak Insurance with Premium
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Member checklist */}
      <View style={styles.memberChecklist}>
        {streak.logsToday.map((member) => (
          <View key={member.userId} style={styles.memberRow} accessible accessibilityLabel={`${member.username}, ${member.hasLogged ? "logged today" : "not yet logged"}`}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText} accessibilityElementsHidden>
                {(member.username?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.username}
            </Text>
            <Text style={styles.memberStatus} accessibilityElementsHidden>
              {member.hasLogged ? "\u2705" : "\u23F3"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Feed Card ───────────────────────────────────────────────
function FeedCard({
  item,
  onReact,
}: {
  item: Deuce;
  onReact: (entryId: string, emoji: string) => void;
}) {
  const displayName = item.user?.username || item.user?.firstName || "Unknown";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardHeader}>
        <View style={styles.feedCardUser}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.feedUsername}>{displayName}</Text>
        </View>
        <Text style={styles.feedTime}>{relativeTime(item.loggedAt)}</Text>
      </View>

      {item.location ? (
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      ) : null}

      {item.thoughts ? (
        <Text style={styles.thoughtsText}>{item.thoughts}</Text>
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

// ─── Main Screen ─────────────────────────────────────────────
export default function SquadDetailScreen() {
  const { squadId } = useLocalSearchParams<{ squadId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isPremium } = useRevenueCat();
  const { showPaywall } = usePaywall();
  const [inviting, setInviting] = useState(false);
  // Track previous streak value to detect streak loss
  const previousStreakRef = useRef<number | null>(null);

  // Fetch group detail
  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery<SquadDetail>({
    queryKey: ["squad", squadId],
    queryFn: () => getSquadDetail(squadId!),
    enabled: !!squadId,
  });

  // Fetch streak
  const {
    data: streak,
    isLoading: streakLoading,
  } = useQuery<StreakData>({
    queryKey: ["streak", squadId],
    queryFn: () => getGroupStreak(squadId!),
    enabled: !!squadId,
    staleTime: 1000 * 30,
  });

  // Update previous streak ref AFTER render via useEffect so the
  // current render still sees the old value for streak-loss detection.
  useEffect(() => {
    if (streak) {
      previousStreakRef.current = streak.currentStreak;
    }
  }, [streak?.currentStreak]);

  // Fetch group feed via /api/deuces?groupId=
  const {
    data: feed,
    isLoading: feedLoading,
    refetch,
    isRefetching,
  } = useQuery<Deuce[]>({
    queryKey: ["feed", squadId],
    queryFn: () => getGroupFeed(squadId!),
    enabled: !!squadId,
    staleTime: 1000 * 30,
  });

  // Realtime updates
  const { connectionState: _wsState } = useGroupSocket(squadId ?? null, () => {
    queryClient.invalidateQueries({ queryKey: ["feed", squadId] });
    queryClient.invalidateQueries({ queryKey: ["streak", squadId] });
  });

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

  async function handleInvite() {
    if (!squadId) return;
    setInviting(true);
    try {
      const invite = await createInvite(squadId);
      await Share.share({
        message: `Join my squad on Deuce Diary! ${invite.inviteLink}`,
      });
    } catch (err: any) {
      if (err?.code !== "ERR_CANCELED") {
        Alert.alert("Oops", "Could not create invite link.");
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleRefresh() {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["streak", squadId] }),
    ]);
  }

  const isLoading = detailLoading || streakLoading || feedLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.green} />
      </View>
    );
  }

  const group = detail?.group;
  const members = detail?.members ?? [];
  const totalDeuces = group?.entryCount ?? 0;

  const headerComponent = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.groupName}>{group?.name ?? "Squad"}</Text>
        <Text style={styles.groupMeta}>
          {members.length} member{members.length !== 1 ? "s" : ""} · {totalDeuces} deuce
          {totalDeuces !== 1 ? "s" : ""} total
        </Text>
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={handleInvite}
          activeOpacity={0.8}
          disabled={inviting}
          accessibilityLabel="Invite your crew"
          accessibilityRole="button"
          accessibilityHint="Create and share an invite link"
        >
          {inviting ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.inviteButtonText}>Invite Your Crew</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.leaderboardButton}
          onPress={() => router.push({ pathname: "/(tabs)/squads/leaderboard", params: { groupId: squadId } })}
          activeOpacity={0.8}
          accessibilityLabel="View leaderboard"
          accessibilityRole="button"
        >
          <Text style={styles.leaderboardButtonText}>🏆 Leaderboard</Text>
        </TouchableOpacity>
      </View>

      {/* Streak Card */}
      {streak ? (
        <StreakCard
          streak={streak}
          isPremium={isPremium}
          onStreakPaywall={() => showPaywall("streak_insurance")}
          previousStreak={previousStreakRef.current}
        />
      ) : null}

      {/* Feed label */}
      <Text style={styles.sectionLabel}>Group Feed</Text>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={feed ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard item={item} onReact={handleReact} />
        )}
        ListHeaderComponent={headerComponent}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.green}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🪑</Text>
            <Text style={styles.emptyTitle}>Dead air on the throne.</Text>
            <Text style={styles.emptySubtitle}>
              No deuces yet — be the first.
            </Text>
          </View>
        }
      />

      {/* FAB — Log a Deuce */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/modals/log-a-deuce")}
        activeOpacity={0.85}
        accessibilityLabel="Log a deuce"
        accessibilityRole="button"
      >
        <Text style={styles.fabEmoji} accessibilityElementsHidden>🚽</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.cream,
  },
  list: { padding: 16, paddingBottom: 120 },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 8,
  },
  groupName: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.espresso,
    textAlign: "center",
  },
  groupMeta: {
    fontSize: 14,
    color: Colors.secondaryText,
    marginTop: 4,
  },
  inviteButton: {
    backgroundColor: Colors.green,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    marginTop: 14,
  },
  inviteButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "bold",
  },
  leaderboardButton: {
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  leaderboardButtonText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },

  // Streak Card
  streakCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  streakCardActive: {
    backgroundColor: "#FFFBF0",
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  streakCardInactive: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.lightGray,
  },
  streakTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  streakFlame: { fontSize: 36 },
  streakNumber: {
    fontSize: 48,
    fontWeight: "bold",
    color: Colors.espresso,
  },
  streakBadge: { fontSize: 28 },
  streakLabel: {
    fontSize: 16,
    color: Colors.secondaryText,
    fontWeight: "600",
    marginTop: 2,
  },
  milestoneLabel: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  streakZeroEmoji: { fontSize: 40, marginBottom: 8 },
  streakZeroText: {
    fontSize: 15,
    color: Colors.secondaryText,
    textAlign: "center",
    lineHeight: 22,
  },
  // Streak Insurance button
  streakInsuranceButton: {
    marginTop: 12,
    backgroundColor: "rgba(200, 169, 81, 0.12)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  streakInsuranceText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.gold,
  },
  // Streak loss prompt
  streakLossPrompt: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.gold,
    width: "100%",
  },
  streakLossEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  streakLossTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.espresso,
    textAlign: "center",
    marginBottom: 4,
  },
  streakLossSubtitle: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: "600",
  },

  // Member checklist
  memberChecklist: {
    width: "100%",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 12,
    gap: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brown,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.white,
  },
  memberName: {
    fontSize: 14,
    color: Colors.espresso,
    flex: 1,
  },
  memberStatus: { fontSize: 16 },

  // Section
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.espresso,
    marginBottom: 12,
  },

  // Feed Card
  feedCard: {
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
  feedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  feedCardUser: {
    flexDirection: "row",
    alignItems: "center",
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
  feedUsername: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.espresso,
  },
  feedTime: { fontSize: 12, color: Colors.gray },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  locationIcon: { fontSize: 13, marginRight: 4 },
  locationText: { fontSize: 13, color: Colors.green, fontWeight: "500" },
  thoughtsText: {
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

  // Empty
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
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

  // FAB
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
});
