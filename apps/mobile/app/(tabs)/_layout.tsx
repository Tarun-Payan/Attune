import { useEffect } from "react";
import { Stack } from "expo-router";
import { useSession } from "../../src/store/session";
import { registerForPush } from "../../src/lib/notifications";

export default function TabsLayout() {
  const status = useSession((s) => s.status);

  useEffect(() => {
    if (status === "authed") void registerForPush();
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
