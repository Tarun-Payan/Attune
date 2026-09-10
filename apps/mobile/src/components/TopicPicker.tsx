import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { radius } from "../theme";
import { useTheme } from "../store/theme";
import type { Topic } from "../lib/types";
import { TopicIcon } from "./TopicIcon";

export function TopicPicker({
  topics,
  selected,
  onToggle,
}: {
  topics: Topic[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {topics.map((t) => {
        const isOn = selected.has(t.key);
        return (
          <Pressable
            key={t.key}
            onPress={() => onToggle(t.key)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: isOn ? colors.accentSoft : colors.card,
                borderColor: isOn ? colors.accent : colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <TopicIcon topicKey={t.key} iconName={t.icon} size={26} color={isOn ? colors.text : colors.sub} />
            <Text
              style={[
                styles.name,
                { color: isOn ? colors.text : colors.sub },
              ]}
              numberOfLines={2}
            >
              {t.name}
            </Text>
            {isOn ? (
              <View style={[styles.checkBadge, { backgroundColor: colors.accent }]}>
                <Check size={13} color="#FFFFFF" strokeWidth={3} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "31%",
    aspectRatio: 0.95,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    position: "relative",
  },
  name: { fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 8 },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
