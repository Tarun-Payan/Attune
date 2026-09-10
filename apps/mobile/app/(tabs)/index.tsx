import React, { useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Bookmark, CircleUserRound, House, Search } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { HomeScreen } from "../../src/screens/HomeScreen";
import { SearchScreen } from "../../src/screens/SearchScreen";
import { NotificationsScreen } from "../../src/screens/NotificationsScreen";
import { SavedScreen } from "../../src/screens/SavedScreen";
import { ProfileScreen } from "../../src/screens/ProfileScreen";
import { useTheme } from "../../src/store/theme";

const TABS = [
  { key: "home", label: "Home", Icon: House },
  { key: "search", label: "Search", Icon: Search },
  { key: "notifications", label: "Inbox", Icon: Bell },
  { key: "saved", label: "Saved", Icon: Bookmark },
  { key: "profile", label: "Profile", Icon: CircleUserRound },
] as const;

export default function PagedTabsScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState(0);

  const notifQuery = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: () => api.me.getNotifications({ limit: 1 }),
    refetchInterval: 30000,
  });
  const unreadCount = notifQuery.data?.unreadCount ?? 0;

  const goToTab = (index: number) => {
    setActiveTab(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index >= 0 && index < TABS.length && index !== activeTab) {
      setActiveTab(index);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Horizontal Continuous Pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        <View style={{ width, flex: 1 }}>
          <HomeScreen />
        </View>
        <View style={{ width, flex: 1 }}>
          <SearchScreen />
        </View>
        <View style={{ width, flex: 1 }}>
          <NotificationsScreen />
        </View>
        <View style={{ width, flex: 1 }}>
          <SavedScreen />
        </View>
        <View style={{ width, flex: 1 }}>
          <ProfileScreen />
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {TABS.map((tab, idx) => {
          const active = activeTab === idx;
          const Icon = tab.Icon;
          const isNotificationTab = tab.key === "notifications";

          return (
            <Pressable
              key={tab.key}
              style={styles.tabItem}
              onPress={() => goToTab(idx)}
              hitSlop={6}
            >
              <View style={styles.iconContainer}>
                <Icon size={22} color={active ? colors.accent : colors.sub} />
                {isNotificationTab && unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.accent : colors.sub },
                  active && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  tabLabelActive: {
    fontWeight: "700",
  },
});


