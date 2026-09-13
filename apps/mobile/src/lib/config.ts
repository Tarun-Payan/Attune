import Constants from "expo-constants";

function resolveApiUrl(): string {
  let env = process.env.EXPO_PUBLIC_API_URL;
  if (env) {
    if (!env.startsWith("http://") && !env.startsWith("https://")) {
      env = `https://${env}`;
    }
    return env.replace(/\/+$/, "");
  }
  // In Expo Go, hostUri is "<dev-machine-lan-ip>:8081" — the phone reaches the
  // API on the same Wi-Fi, so reuse that IP. Set EXPO_PUBLIC_API_URL to override.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(":")[0]}:3000`;
  return "http://localhost:3000";
}

export const API_URL = resolveApiUrl();
