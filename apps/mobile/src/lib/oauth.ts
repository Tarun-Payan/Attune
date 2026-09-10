import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { API_URL } from "./config";

export type OAuthProvider = "google" | "github";

/**
 * Server-side OAuth flow: open the consent screen in the system browser,
 * and catch the redirect back into the app (attune:// or exp:// in Expo Go)
 * carrying the tokens in the URL fragment.
 */
export async function oauthSignIn(
  provider: OAuthProvider,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const redirect = Linking.createURL("/auth/callback");
  const startUrl = `${API_URL}/v1/auth/oauth/${provider}/start?redirect=${encodeURIComponent(redirect)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirect);
  if (result.type !== "success" || !result.url) return null;

  try {
    const urlObj = new URL(result.url);
    const fragment = urlObj.hash.replace(/^#/, "");
    const fragmentParams = new URLSearchParams(fragment);
    const accessToken = fragmentParams.get("access_token") ?? urlObj.searchParams.get("access_token");
    const refreshToken = fragmentParams.get("refresh_token") ?? urlObj.searchParams.get("refresh_token");
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}
