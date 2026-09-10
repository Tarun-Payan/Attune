import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { completeSignIn } from "../../src/lib/post-auth";
import { useSession } from "../../src/store/session";
import { useTheme } from "../../src/store/theme";

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const status = useSession((s) => s.status);
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();

  useEffect(() => {
    async function processTokens() {
      if (params.access_token && params.refresh_token) {
        await completeSignIn(
          {
            user: null,
            accessToken: params.access_token,
            refreshToken: params.refresh_token,
          },
          () => queryClient.invalidateQueries(),
        );
        router.replace("/(tabs)");
      } else if (status === "authed") {
        router.replace("/(tabs)");
      } else {
        const timer = setTimeout(() => {
          if (useSession.getState().status === "authed") {
            router.replace("/(tabs)");
          } else {
            router.replace("/auth/login");
          }
        }, 1200);
        return () => clearTimeout(timer);
      }
    }

    void processTokens();
  }, [params.access_token, params.refresh_token, status, queryClient]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
