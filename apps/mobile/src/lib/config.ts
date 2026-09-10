import Constants from "expo-constants";

function resolveApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env;
  // In Expo Go, hostUri is "<dev-machine-lan-ip>:8081" — the phone reaches the
  // API on the same Wi-Fi, so reuse that IP. Set EXPO_PUBLIC_API_URL to override.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(":")[0]}:3000`;
  return "http://localhost:3000";
}

export const API_URL = resolveApiUrl();
