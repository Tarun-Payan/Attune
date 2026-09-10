import React from "react";
import { ActivityIndicator, StyleSheet, Text, Pressable, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GoogleMark, GithubMark } from "./BrandIcons";
import { oauthSignIn } from "../lib/oauth";
import { completeSignIn } from "../lib/post-auth";
import { radius } from "../theme";
import { useTheme } from "../store/theme";

export function SocialButtons() {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const invalidate = () => queryClient.invalidateQueries();

  const oauth = useMutation({
    mutationFn: (provider: "google" | "github") => oauthSignIn(provider),
    onSuccess: async (result) => {
      if (!result) return;
      await completeSignIn(
        { user: null, accessToken: result.accessToken, refreshToken: result.refreshToken },
        invalidate,
      );
    },
  });

  const busy = oauth.isPending;
  const failed = oauth.isError;

  return (
    <View>
      <SocialButton
        label="Continue with Google"
        Icon={GoogleMark}
        disabled={busy}
        onPress={() => oauth.mutate("google")}
      />
      <SocialButton
        label="Continue with GitHub"
        Icon={GithubMark}
        disabled={busy}
        onPress={() => oauth.mutate("github")}
      />
      {busy ? <ActivityIndicator color={colors.accent} style={{ marginTop: 10 }} /> : null}
      {failed ? (
        <Text style={[styles.err, { color: colors.sub }]}>Sign-in didn't complete. OAuth apps may not be configured yet (see blueprint §15).</Text>
      ) : null}
    </View>
  );
}

function SocialButton({
  label,
  Icon,
  onPress,
  disabled,
}: {
  label: string;
  Icon: (props: { size?: number; color?: string }) => React.ReactElement;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon size={18} color={colors.text} />
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 10,
  },
  label: { fontSize: 15, fontWeight: "600" },
  err: { fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 16 },
});
