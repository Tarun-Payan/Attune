import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bookmark } from "lucide-react-native";
import { api } from "../lib/api";
import type { SavedItem } from "../lib/types";
import { timeAgo } from "../lib/time";
import { radius } from "../theme";
import { useTheme } from "../store/theme";

export function SavedScreen() {
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ["saved"],
    queryFn: () => api.me.getSaved(),
  });


  const items = query.data?.items ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <Text style={[styles.title, { color: colors.text }]}>Saved</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.accent} />
        }
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push(`/item/${item.id}`)}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={3}>
              {item.title}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.sub }]}>
              saved {timeAgo(item.savedAt)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : (
            <View style={styles.empty}>
              <Bookmark size={36} color={colors.sub} />
              <Text style={[styles.emptyText, { color: colors.sub }]}>
                Long-press a story and tap Save —{"\n"}it lands here.
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
  title: { fontSize: 22, fontWeight: "800", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  listEmpty: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  cardMeta: { fontSize: 12, marginTop: 8 },
  empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  emptyText: { textAlign: "center", lineHeight: 21, fontSize: 14 },
});
