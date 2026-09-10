import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { type InfiniteData, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bookmark, ExternalLink, Flag, Flame, ThumbsDown, ThumbsUp } from "lucide-react-native";
import { api } from "../../src/lib/api";
import type { FeedPage, ItemDetail, ReportReason } from "../../src/lib/types";
import { timeAgo } from "../../src/lib/time";
import { mutateItemInteraction, trackInteraction } from "../../src/lib/interactions";
import { TopicIcon } from "../../src/components/TopicIcon";
import { radius } from "../../src/theme";
import { useTheme } from "../../src/store/theme";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["item", id],
    queryFn: () => api.items.get(id!),
    enabled: typeof id === "string",
    initialData: () => {
      // Find item in feed cache to provide instantaneous rendering and accurate initial like/save state
      const feedCache = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed"]);
      for (const page of feedCache?.pages ?? []) {
        const found = page.items.find((it) => it.id === id);
        if (found) {
          return {
            item: {
              id: found.id,
              title: found.title,
              summary: found.summary,
              content: found.summary ?? "",
              url: found.url,
              imageUrl: found.imageUrl,
              author: found.author ?? null,
              metrics: found.metrics,
              language: "en",
              publishedAt: found.publishedAt,
              clusterId: null,
              sourceName: found.source.name,
              sourceCredibility: 0.8,
              topics: found.topics.map((t) => ({ key: t, name: t, icon: null, confidence: 1 })),
              tags: found.tags,
              likesCount: found.likesCount,
              dislikesCount: found.dislikesCount,
              viewsCount: found.viewsCount,
              reportsCount: 0,
              userState: found.userState,
            } as ItemDetail,
          };
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
  });

  // Track reading dwell time while this screen is open (blueprint §13)
  const enteredAt = useRef(Date.now());
  useEffect(() => {
    const itemId = id;
    return () => {
      if (typeof itemId === "string") {
        const rawDwell = Date.now() - enteredAt.current;
        if (rawDwell >= 1_000) {
          const dwellMs = Math.min(600_000, Math.round(rawDwell));
          trackInteraction(itemId, "VIEW", dwellMs);
        }
      }
    };
  }, [id]);

  const item = query.data?.item;

  const [saved, setSaved] = useState(item?.userState?.saved ?? false);
  const [liked, setLiked] = useState(item?.userState?.liked ?? false);
  const [disliked, setDisliked] = useState(item?.userState?.disliked ?? false);
  const [likesCount, setLikesCount] = useState(item?.likesCount ?? item?.metrics?.likes ?? 0);

  useEffect(() => {
    if (item) {
      setSaved(item.userState?.saved ?? false);
      setLiked(item.userState?.liked ?? false);
      setDisliked(item.userState?.disliked ?? false);
      setLikesCount(item.likesCount ?? item.metrics?.likes ?? 0);
    }
  }, [
    item?.id,
    item?.userState?.saved,
    item?.userState?.liked,
    item?.userState?.disliked,
    item?.likesCount,
    item?.metrics?.likes,
  ]);

  const openOriginal = async () => {
    if (!item) return;
    trackInteraction(item.id, "OPEN_LINK");
    await WebBrowser.openBrowserAsync(item.url, {
      toolbarColor: colors.bg,
      enableBarCollapsing: true,
    }).catch(() => Linking.openURL(item.url));
  };

  const toggleSave = () => {
    if (!item) return;
    setSaved((s) => !s);
    void mutateItemInteraction(queryClient, item.id, "SAVE").catch(() => undefined);
  };

  const toggleLike = () => {
    if (!item) return;
    const next = !liked;
    setLiked(next);
    if (next) {
      if (disliked) setDisliked(false);
      setLikesCount((c) => c + 1);
    } else {
      setLikesCount((c) => Math.max(0, c - 1));
    }
    void mutateItemInteraction(queryClient, item.id, "LIKE").catch(() => undefined);
  };

  const toggleDislike = () => {
    if (!item) return;
    const next = !disliked;
    setDisliked(next);
    if (next) {
      if (liked) {
        setLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
      }
    }
    void mutateItemInteraction(queryClient, item.id, "DISLIKE").catch(() => undefined);
  };

  const reportItem = (reason: ReportReason) => {
    if (!item) return;
    void mutateItemInteraction(queryClient, item.id, "REPORT", { reason })
      .then(() => {
        Alert.alert("Report Received", "Thank you for helping keep Attune safe.");
      })
      .catch(() => undefined);
  };

  const handleReport = () => {
    Alert.alert("Report Story", "Why are you reporting this story?", [
      { text: "Spam", onPress: () => reportItem("SPAM") },
      { text: "Misleading / False", onPress: () => reportItem("MISLEADING") },
      { text: "Offensive", onPress: () => reportItem("OFFENSIVE") },
      { text: "Duplicate", onPress: () => reportItem("DUPLICATE") },
      { text: "Other", onPress: () => reportItem("OTHER") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (query.isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }
  if (query.isError || !item) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
        <Text style={[styles.error, { color: colors.sub }]}>Couldn't load this story.</Text>
      </SafeAreaView>
    );
  }

  const heat = Math.max(
    item.metrics?.points ?? 0,
    item.metrics?.score ?? 0,
    item.metrics?.stars ?? 0,
    item.metrics?.likes ?? 0,
  );
  const views = item.metrics?.views;
  const stars = item.metrics?.stars;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.chips}>
          {item.topics.slice(0, 4).map((t) => (
            <View key={t.key} style={[styles.chip, { backgroundColor: colors.chipBg }]}>
              <TopicIcon topicKey={t.key} size={11} />
              <Text style={[styles.chipText, { color: colors.accent }]}>{t.key}</Text>
            </View>
          ))}
          {item.tags?.slice(0, 4).map((tag) => (
            <View key={tag} style={[styles.tagChip, { borderColor: colors.border }]}>
              <Text style={[styles.tagChipText, { color: colors.sub }]}>#{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>

        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.sub }]}>
            {item.author && !item.sourceName.toLowerCase().includes(item.author.toLowerCase())
              ? `${item.author} · ${item.sourceName}`
              : (item.author ?? item.sourceName)}
          </Text>
          <Text style={[styles.dot, { color: colors.sub }]}>·</Text>
          <Text style={[styles.meta, { color: colors.sub }]}>{timeAgo(item.publishedAt)}</Text>
          {views ? (
            <>
              <Text style={[styles.dot, { color: colors.sub }]}>·</Text>
              <Text style={[styles.meta, { color: colors.sub }]}>▶ {formatMetric(views)} views</Text>
            </>
          ) : null}
          {likesCount > 0 ? (
            <>
              <Text style={[styles.dot, { color: colors.sub }]}>·</Text>
              <Text style={[styles.meta, { color: colors.sub }]}>👍 {formatMetric(likesCount)} likes</Text>
            </>
          ) : null}
          {stars ? (
            <>
              <Text style={[styles.dot, { color: colors.sub }]}>·</Text>
              <Text style={[styles.meta, { color: colors.sub }]}>★ {formatMetric(stars)} stars</Text>
            </>
          ) : null}
          {!views && likesCount === 0 && !stars && heat >= 100 ? (
            <>
              <Text style={[styles.dot, { color: colors.sub }]}>·</Text>
              <View style={styles.heat}>
                <Flame size={12} color={colors.sub} />
                <Text style={[styles.meta, { color: colors.sub }]}>{formatHeat(heat)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.image, { backgroundColor: colors.chipBg }]}
            resizeMode="cover"
          />
        ) : null}

        {item.summary ? (
          <Text
            style={[
              styles.summary,
              {
                color: colors.text,
                backgroundColor: colors.accentSoft,
                borderColor: colors.accent,
              },
            ]}
          >
            {item.summary}
          </Text>
        ) : null}
        {item.content ? (
          <Text style={[styles.contentText, { color: colors.sub }]} numberOfLines={30}>
            {item.content.slice(0, 2500)}
          </Text>
        ) : null}

        <View style={{ height: 90 }} />
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: isDark ? "rgba(11,14,20,0.95)" : "rgba(246,248,250,0.95)",
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable style={[styles.readBtn, styles.flex, { backgroundColor: colors.accent }]} onPress={openOriginal}>
          <ExternalLink size={16} color="#FFFFFF" />
          <Text style={styles.readBtnText}>Read source</Text>
        </Pressable>

        <Pressable
          style={[
            styles.iconBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            liked && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
          onPress={toggleLike}
        >
          <ThumbsUp size={17} color={liked ? colors.accent : colors.text} fill={liked ? colors.accent : "none"} />
          {likesCount > 0 ? (
            <Text style={[styles.btnCount, { color: liked ? colors.accent : colors.text }]}>
              {formatMetric(likesCount)}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          style={[
            styles.iconBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            disliked && { backgroundColor: "#ff525222", borderColor: "#ff5252" },
          ]}
          onPress={toggleDislike}
        >
          <ThumbsDown size={17} color={disliked ? "#ff5252" : colors.text} fill={disliked ? "#ff5252" : "none"} />
        </Pressable>

        <Pressable
          style={[
            styles.iconBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            saved && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
          onPress={toggleSave}
        >
          <Bookmark size={17} color={saved ? colors.accent : colors.text} fill={saved ? colors.accent : "none"} />
        </Pressable>

        <Pressable
          style={[
            styles.iconBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={handleReport}
        >
          <Flag size={17} color={colors.sub} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 18, paddingTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: { fontSize: 11, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", lineHeight: 28, marginBottom: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  meta: { fontSize: 12.5, fontWeight: "500" },
  dot: { fontSize: 12 },
  author: { fontSize: 12.5, fontStyle: "italic", marginTop: 4, marginBottom: 10 },
  image: { width: "100%", height: 190, borderRadius: radius.md, marginVertical: 12 },
  summary: {
    fontSize: 15.5,
    lineHeight: 23,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 14,
  },
  contentText: { fontSize: 14.5, lineHeight: 22 },
  heat: { flexDirection: "row", alignItems: "center", gap: 3 },
  error: { textAlign: "center", marginTop: 80, padding: 20 },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 8,
    padding: 14,
    paddingBottom: 22,
    borderTopWidth: 1,
    alignItems: "center",
  },
  flex: { flex: 1 },
  readBtn: {
    borderRadius: radius.md,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  readBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  iconBtn: {
    height: 46,
    minWidth: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  btnCount: {
    fontSize: 11,
    fontWeight: "600",
  },
});

function formatMetric(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatHeat(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
