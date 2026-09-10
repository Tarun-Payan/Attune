import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Newspaper, WifiOff, Zap } from "lucide-react-native";
import { api } from "../lib/api";
import type { FeedPage } from "../lib/types";
import { FeedCard } from "../components/FeedCard";
import { useTheme } from "../store/theme";

export function HomeScreen() {
  const { colors } = useTheme();
  const query = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) =>
      api.feed.get({ limit: 20, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,

  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const openItem = (id: string) => router.push(`/item/${id}`);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.text }]}>Attune</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
        renderItem={({ item }) => <FeedCard item={item} onOpen={openItem} />}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : query.isError ? (
            <EmptyState
              Icon={WifiOff}
              text="Couldn't load the feed. Is the backend running? Pull to retry."
            />
          ) : (
            <EmptyState
              Icon={Newspaper}
              text="Nothing here yet. Pick more topics in Profile, or check back after the next sync."
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
          ) : items.length > 0 ? (
            <Text style={[styles.caughtUp, { color: colors.sub }]}>You're all caught up</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function EmptyState({ Icon, text }: { Icon: typeof Zap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon size={36} color={colors.sub} />
      <Text style={[styles.emptyText, { color: colors.sub }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  logo: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  listEmpty: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  emptyText: { textAlign: "center", lineHeight: 21, fontSize: 14 },
  caughtUp: { textAlign: "center", marginVertical: 18, fontSize: 13 },
});
