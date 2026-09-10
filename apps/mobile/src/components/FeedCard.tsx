import React from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Flame, ThumbsDown, ThumbsUp } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { radius } from "../theme";
import { useTheme } from "../store/theme";
import type { FeedItem, ReportReason } from "../lib/types";
import { timeAgo } from "../lib/time";
import { mutateItemInteraction, trackInteraction } from "../lib/interactions";
import { TopicIcon } from "./TopicIcon";

export function FeedCard({ item, onOpen }: { item: FeedItem; onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [liked, setLiked] = React.useState(item.userState?.liked ?? false);
  const [disliked, setDisliked] = React.useState(item.userState?.disliked ?? false);
  const [likesCount, setLikesCount] = React.useState(item.likesCount ?? item.metrics?.likes ?? 0);

  // Sync state whenever props or cache change
  React.useEffect(() => {
    setLiked(item.userState?.liked ?? false);
    setDisliked(item.userState?.disliked ?? false);
    setLikesCount(item.likesCount ?? item.metrics?.likes ?? 0);
  }, [
    item.id,
    item.userState?.liked,
    item.userState?.disliked,
    item.likesCount,
    item.metrics?.likes,
  ]);

  const clusterSize = item.clusterSize ?? 1;

  const toggleLike = () => {
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
    void mutateItemInteraction(queryClient, item.id, "REPORT", { reason }).catch(() => undefined);
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

  const longPress = () => {
    Alert.alert(item.title.slice(0, 60) + "…", undefined, [
      {
        text: item.userState?.saved ? "Remove from Saved" : "Save Story",
        onPress: () => {
          void mutateItemInteraction(queryClient, item.id, "SAVE").catch(() => undefined);
        },
      },
      {
        text: "Not Interested (Dislike)",
        style: "destructive",
        onPress: toggleDislike,
      },
      {
        text: "Report Story",
        style: "destructive",
        onPress: handleReport,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Pressable
      onPress={() => {
        trackInteraction(item.id, "VIEW");
        onOpen(item.id);
      }}
      onLongPress={longPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.image, { backgroundColor: colors.chipBg }]}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.chips}>
        {item.topics.slice(0, 3).map((t) => (
          <View key={t} style={[styles.chip, { backgroundColor: colors.chipBg }]}>
            <TopicIcon topicKey={t} size={11} />
            <Text style={[styles.chipText, { color: colors.accent }]}>{t}</Text>
          </View>
        ))}
        {item.tags?.slice(0, 2).map((tg) => (
          <View key={tg} style={[styles.tagChip, { borderColor: colors.border }]}>
            <Text style={[styles.tagChipText, { color: colors.sub }]}>#{tg}</Text>
          </View>
        ))}
        {clusterSize >= 3 && (
          <View style={styles.breakingChip}>
            <Flame size={11} color="#ff5252" />
            <Text style={styles.breakingText}>BREAKING</Text>
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
        {item.title}
      </Text>
      {item.summary ? (
        <Text style={[styles.summary, { color: colors.sub }]} numberOfLines={2}>
          {item.summary}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerMeta}>
          <Text style={[styles.meta, { color: colors.sub }]} numberOfLines={1}>
            {item.author && !item.source.name.toLowerCase().includes(item.author.toLowerCase())
              ? `${item.author} · ${item.source.name}`
              : (item.author ?? item.source.name)}
          </Text>
          <Text style={[styles.dot, { color: colors.sub }]}>·</Text>
          <Text style={[styles.meta, { color: colors.sub }]}>{timeAgo(item.publishedAt)}</Text>
          {clusterSize > 1 && clusterSize < 3 ? (
            <Text style={[styles.meta, { color: colors.sub }]}>· {clusterSize} sources</Text>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            hitSlop={8}
            onPress={toggleLike}
            style={[styles.actionBtn, liked && { backgroundColor: colors.accentSoft }]}
          >
            <ThumbsUp
              size={13}
              color={liked ? colors.accent : colors.sub}
              fill={liked ? colors.accent : "none"}
            />
            {likesCount > 0 ? (
              <Text style={[styles.actionCount, { color: liked ? colors.accent : colors.sub }]}>
                {formatMetric(likesCount)}
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            hitSlop={8}
            onPress={toggleDislike}
            style={[styles.actionBtn, disliked && { backgroundColor: "#ff525222" }]}
          >
            <ThumbsDown
              size={13}
              color={disliked ? "#ff5252" : colors.sub}
              fill={disliked ? "#ff5252" : "none"}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function formatMetric(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  image: { width: "100%", height: 150, borderRadius: radius.md, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 11, fontWeight: "700" },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagChipText: { fontSize: 10, fontWeight: "600" },
  breakingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ff525222",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  breakingText: {
    color: "#ff5252",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  title: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  summary: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  meta: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  dot: { fontSize: 12 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  actionCount: {
    fontSize: 11,
    fontWeight: "600",
  },
});

