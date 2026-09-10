import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, CheckCheck } from "lucide-react-native";
import { api } from "../lib/api";
import type { InAppNotification } from "@attune/types";
import { timeAgo } from "../lib/time";
import { radius } from "../theme";
import { useTheme } from "../store/theme";

export function NotificationsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => api.me.getNotifications({ limit: 50 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.me.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.me.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = query.data?.notifications ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  const handlePressNotification = (item: InAppNotification) => {
    if (!item.readAt) {
      markReadMutation.mutate(item.id);
    }
    if (item.itemId) {
      router.push({ pathname: "/item/[id]", params: { id: item.itemId } });
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <CheckCheck size={16} color={colors.accent} />
            <Text style={[styles.markAllText, { color: colors.accent }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, notifications.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => {
          const isUnread = !item.readAt;
          return (
            <Pressable
              style={[
                styles.card,
                {
                  backgroundColor: isUnread ? colors.card : colors.bg,
                  borderColor: isUnread ? colors.accent : colors.border,
                },
              ]}
              onPress={() => handlePressNotification(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={[styles.cardTime, { color: colors.sub }]}>
                  {timeAgo(item.createdAt)}
                </Text>
              </View>
              <Text style={[styles.cardBody, { color: colors.sub }]} numberOfLines={3}>
                {item.body}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : (
            <View style={styles.empty}>
              <Bell size={36} color={colors.sub} />
              <Text style={[styles.emptyText, { color: colors.sub }]}>
                No notifications yet.{"\n"}Stories matching your topics will appear here.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "800" },
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  markAllText: { fontSize: 13, fontWeight: "600" },
  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 32 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  card: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  cardTime: {
    fontSize: 11,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 20,
    fontSize: 13,
  },
});
