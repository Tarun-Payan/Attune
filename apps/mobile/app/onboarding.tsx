import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { RadioTower } from "lucide-react-native";
import { api } from "../src/lib/api";
import type { TopicsResponse } from "../src/lib/types";
import { useSession } from "../src/store/session";
import { useTheme } from "../src/store/theme";
import { TopicPicker } from "../src/components/TopicPicker";
import { PrimaryButton, Screen } from "../src/components/ui";

const MIN_TOPICS = 3;

export default function Onboarding() {
  const { colors } = useTheme();
  const { data, isLoading, error } = useQuery({
    queryKey: ["topics"],
    queryFn: () => api.topics.list(),
  });

  const setPendingTopics = useSession((s) => s.setPendingTopics);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canContinue = selected.size >= MIN_TOPICS;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const continueToRegister = () => {
    setPendingTopics([...selected].map((key) => ({ key, notify: true })));
    router.push("/auth/register");
  };

  const topics = useMemo(() => data?.topics ?? [], [data]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <RadioTower size={36} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Your world,{"\n"}tuned in.</Text>
        <Text style={[styles.subtitle, { color: colors.sub }]}>
          Pick at least {MIN_TOPICS} topics — we distill everything else away.
        </Text>

        {isLoading ? (
          <Text style={[styles.loading, { color: colors.sub }]}>Loading topics…</Text>
        ) : error ? (
          <Text style={[styles.loading, { color: colors.sub }]}>Could not reach the API. Is the backend running?</Text>
        ) : (
          <TopicPicker topics={topics} selected={selected} onToggle={toggle} />
        )}

        <View style={{ height: 16 }} />
        <PrimaryButton
          label={`Continue${canContinue ? ` · ${selected.size} topics` : ""}`}
          onPress={continueToRegister}
          disabled={!canContinue}
        />
        <View style={styles.loginRow}>
          <Text style={[styles.loginHint, { color: colors.sub }]}>Already have an account? </Text>
          <Link href="/auth/login" style={[styles.loginLink, { color: colors.accent }]}>
            Log in
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 80, paddingBottom: 40 },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: "800", lineHeight: 38, marginBottom: 10 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 28 },
  loading: { fontSize: 14 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  loginHint: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: "700" },
});
