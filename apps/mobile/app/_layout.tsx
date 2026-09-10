import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSession } from "../src/store/session";
import { useTheme, useThemeStore } from "../src/store/theme";
import { setupNotificationResponseListener } from "../src/lib/notifications";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const hydrateSession = useSession((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    void hydrateSession();
    void hydrateTheme();
  }, [hydrateSession, hydrateTheme]);

  // Any transition into/out of auth drives navigation globally — this covers
  // email login, register, and OAuth sign-ins from any screen.
  useEffect(() => {
    if (status === "hydrating") return;
    router.replace(status === "authed" ? "/(tabs)" : "/onboarding");
  }, [status]);

  // Tapping a push opens the story directly
  useEffect(() => {
    const cleanup = setupNotificationResponseListener((itemId) => {
      router.push(`/item/${itemId}`);
    });
    return cleanup;
  }, []);

  if (status === "hydrating") return null; // brief blank while tokens load

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="item/[id]"
          options={{
            headerShown: true,
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.bg },
            headerTitle: "",
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
