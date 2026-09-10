export const darkColors = {
  bg: "#0B0E14",
  card: "#151B27",
  cardHover: "#1B2333",
  border: "#232C3E",
  text: "#E8EDF7",
  sub: "#8B95A9",
  accent: "#6C7CFF",
  accentSoft: "#232B52",
  success: "#3FCF8E",
  danger: "#FF6B6B",
  chipBg: "#1C2434",
};

export const lightColors: typeof darkColors = {
  bg: "#F6F8FA",
  card: "#FFFFFF",
  cardHover: "#EEF2F6",
  border: "#D8DFE8",
  text: "#0F172A",
  sub: "#57606A",
  accent: "#4F46E5",
  accentSoft: "#EEF2FF",
  success: "#10B981",
  danger: "#EF4444",
  chipBg: "#EBF0F5",
};

export type ThemeColors = typeof darkColors;

// Backwards-compatible default export
export const colors = darkColors;

export const radius = { sm: 8, md: 12, lg: 18 };

