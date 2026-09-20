import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api } from "./api";

let registered = false;

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === "expo";

const isAndroidExpoGo = Platform.OS === "android" && isExpoGo;

/**
 * Ask permission and register this device's push token with the backend.
 * In Expo Go on Android, remote push notifications are not supported (SDK 53+),
 * so token registration and expo-notifications module evaluation is skipped.
 * A standalone or development build with FCM config will register properly.
 */
export async function registerForPush(): Promise<void> {
  if (registered) return;

  // Remote push notifications on Android were removed from Expo Go starting in SDK 53.
  // Bypass completely when running in Expo Go on Android to avoid runtime error.
  if (isAndroidExpoGo) {
    return;
  }

  try {
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0B0E14",
      });
    }

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData?.data;
    if (!token) return;

    const platform = Platform.OS === "ios" ? "ios" : "android";
    await api.me.registerDevice({ token, platform, provider: "expo" });
    registered = true;
  } catch {
    // Push is best-effort — never block the app on it
  }
}

/**
 * Safely subscribe to notification tap responses.
 * Bypasses in Expo Go on Android to prevent runtime crashes.
 */
export function setupNotificationResponseListener(
  onItemOpen: (itemId: string) => void,
): () => void {
  if (isAndroidExpoGo) {
    return () => {};
  }

  let sub: { remove: () => void } | null = null;
  void import("expo-notifications")
    .then((Notifications) => {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const itemId = response.notification.request.content.data?.itemId as string | undefined;
        if (itemId) onItemOpen(itemId);
      });
    })
    .catch(() => {});

  return () => {
    sub?.remove();
  };
}
