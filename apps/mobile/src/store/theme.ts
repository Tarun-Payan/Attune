import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { useColorScheme } from "react-native";
import { darkColors, lightColors, type ThemeColors } from "../theme";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "attune.themeMode";

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",
  setMode: async (mode) => {
    set({ mode });
    await SecureStore.setItemAsync(STORAGE_KEY, mode).catch(() => {});
  },
  hydrate: async () => {
    try {
      const saved = (await SecureStore.getItemAsync(STORAGE_KEY)) as ThemeMode | null;
      if (saved && (saved === "system" || saved === "light" || saved === "dark")) {
        set({ mode: saved });
      }
    } catch {
      // ignore
    }
  },
}));

export function useTheme(): {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  colors: ThemeColors;
  isDark: boolean;
} {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const isDark = mode === "system" ? systemScheme !== "light" : mode === "dark";
  const colors = isDark ? darkColors : lightColors;

  return { mode, setMode, colors, isDark };
}
