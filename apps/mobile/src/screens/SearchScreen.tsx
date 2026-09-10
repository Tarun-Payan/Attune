import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Newspaper, Search as SearchIcon } from "lucide-react-native";
import { api } from "../lib/api";
import type { FeedItem } from "../lib/types";
import { FeedCard } from "../components/FeedCard";
import { Field } from "../components/ui";
import { useTheme } from "../store/theme";

export function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const search = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => api.search.query({ q: submitted, limit: 20 }),
    enabled: submitted.trim().length >= 2,

  });

  const openItem = (id: string) => router.push(`/item/${id}`);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <Text style={[styles.title, { color: colors.text }]}>Search</Text>
      <Field
        label=""
        value={query}
        onChangeText={setQuery}
        placeholder="Search 30 days of stories…"
        onSubmitEditing={() => setSubmitted(query.trim())}
        returnKeyType="search"
      />
      {submitted.trim().length < 2 ? (
        <View style={styles.centerArea}>
          <EmptyHint />
        </View>
      ) : search.isLoading ? (
        <View style={styles.centerArea}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : search.isError ? (
        <View style={styles.centerArea}>
          <Text style={[styles.empty, { color: colors.sub }]}>Search failed. Is the backend running?</Text>
        </View>
      ) : (search.data?.items.length ?? 0) === 0 ? (
        <View style={styles.centerArea}>
          <Newspaper size={36} color={colors.sub} />
          <Text style={[styles.empty, { color: colors.sub }]}>Nothing found for “{submitted}”.</Text>
        </View>
      ) : (
        <FlatList
          data={search.data?.items ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <FeedCard item={item} onOpen={openItem} />}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyHint() {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <SearchIcon size={36} color={colors.sub} />
      <Text style={[styles.empty, { color: colors.sub }]}>
        Find stories across all your sources.{"\n"}Try “openai”, “funding”, or “android”.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: "800", paddingTop: 8, paddingBottom: 10 },
  list: { paddingBottom: 100 },
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 100,
    gap: 12,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  empty: { textAlign: "center", lineHeight: 21, fontSize: 14 },
});
