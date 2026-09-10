import { useEffect } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { useSession } from "../src/store/session";
import { useTheme } from "../src/store/theme";

export default function Gate() {
  const status = useSession((s) => s.status);
  const { colors } = useTheme();

  useEffect(() => {
    if (status === "authed") router.replace("/(tabs)");
    else if (status === "guest") router.replace("/onboarding");
  }, [status]);

  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
