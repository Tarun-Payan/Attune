import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageStyle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SvgUri } from "react-native-svg";
import { router, useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Flame,
  KeyRound,
  Mail,
  Monitor,
  Moon,
  Pencil,
  ShieldAlert,
  Sun,
  User,
  X,
} from "lucide-react-native";
import { api, ApiError, resolveAvatarUrl } from "../lib/api";
import { PRESET_AVATARS, type NotificationSettings, type PublicUser } from "../lib/types";
import { useSession } from "../store/session";
import { useTheme } from "../store/theme";
import { Field, PrimaryButton } from "../components/ui";

export function ProfileScreen() {
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const signOut = useSession((s) => s.signOut);
  const { colors, mode, setMode } = useTheme();

  // Queries
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me.get() });
  const settingsQuery = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () => (await api.me.getNotificationSettings()).settings,
  });
  const statsQuery = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => api.me.getStats(),
  });

  // Auto-refetch reading stats and profile whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void statsQuery.refetch();
      void me.refetch();
    }, [statsQuery, me]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        statsQuery.refetch(),
        me.refetch(),
        settingsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [statsQuery, me, settingsQuery]);

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState("");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change Email Form State
  const [emailStep, setEmailStep] = useState<"request" | "verify">("request");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const u = me.data?.user ?? user;
  const initials = (u?.name || u?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const totalMinutes = statsQuery.data?.totalPlatformMinutes ?? 0;
  const totalReadTimeStr =
    totalMinutes >= 60
      ? `${(totalMinutes / 60).toFixed(1)}h`
      : `${totalMinutes}m`;

  // Settings mutation
  const saveSettings = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) =>
      api.me.updateNotificationSettings(patch).then((r) => r.settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(["notification-settings"], settings);
    },
  });

  // Logout mutation
  const logout = useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/onboarding");
    },
  });

  // Edit profile mutation
  const updateProfile = useMutation({
    mutationFn: (input: { name?: string; avatarUrl?: string | null }) =>
      api.me.patch(input),
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setIsEditProfileOpen(false);
      Alert.alert("Profile Updated", "Your profile details have been saved.");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setProfileError(err.body.error || "Failed to update profile.");
      } else {
        setProfileError("Network error. Please try again.");
      }
    },
  });

  // Request email change mutation
  const requestEmail = useMutation({
    mutationFn: (emailToSet: string) => api.me.requestEmailChange(emailToSet),
    onSuccess: (data) => {
      setEmailError(null);
      setEmailNotice(data.message || `Verification code sent to ${newEmail.trim()}`);
      setEmailStep("verify");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setEmailError(err.body.error || "Failed to request email change.");
      } else {
        setEmailError("Network error. Please try again.");
      }
    },
  });

  // Verify email change mutation
  const verifyEmail = useMutation({
    mutationFn: (payload: { newEmail: string; code: string }) =>
      api.me.verifyEmailChange(payload),
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setIsChangeEmailOpen(false);
      Alert.alert(
        "Email Updated",
        `Your email has been updated to ${data.user.email}. An alert was sent to your previous email address for security.`,
      );
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setEmailError(err.body.error || "Invalid or expired verification code.");
      } else {
        setEmailError("Network error. Please try again.");
      }
    },
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.me.changePassword(input),
    onSuccess: () => {
      setIsChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password Updated", "Your password has been changed successfully.");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setPasswordError(err.body.error || "Failed to change password.");
      } else {
        setPasswordError("Network error. Please try again.");
      }
    },
  });

  const openEditProfile = () => {
    setEditName(u?.name || "");
    setSelectedAvatarUrl(u?.avatarUrl || null);
    setProfileError(null);
    setIsEditProfileOpen(true);
  };

  const openChangeEmail = () => {
    setEmailStep("request");
    setNewEmail("");
    setEmailCode("");
    setEmailError(null);
    setEmailNotice(null);
    setIsChangeEmailOpen(true);
  };

  const openChangePassword = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setIsChangePasswordOpen(true);
  };

  const handleSaveProfile = () => {
    setProfileError(null);
    updateProfile.mutate({
      name: editName.trim() || undefined,
      avatarUrl: selectedAvatarUrl,
    });
  };

  const handleRequestEmailChange = () => {
    setEmailError(null);
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (newEmail.trim().toLowerCase() === u?.email.toLowerCase()) {
      setEmailError("The new email must be different from your current email.");
      return;
    }
    requestEmail.mutate(newEmail.trim());
  };

  const handleVerifyEmailChange = () => {
    setEmailError(null);
    if (!emailCode.trim() || emailCode.trim().length !== 6) {
      setEmailError("Please enter the 6-digit verification code.");
      return;
    }
    verifyEmail.mutate({
      newEmail: newEmail.trim(),
      code: emailCode.trim(),
    });
  };

  const handleChangePassword = () => {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    changePassword.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        {/* User card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <AvatarImage
              uri={u?.avatarUrl}
              size={52}
              fallbackText={initials}
              style={styles.avatarImg}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>{u?.name || "Attune reader"}</Text>
            <Text style={[styles.email, { color: colors.sub }]}>{u?.email}</Text>
            <Text style={[styles.meta, { color: colors.sub }]}>Timezone: {u?.timezone ?? "Asia/Kolkata"}</Text>
          </View>
          <Pressable
            onPress={openEditProfile}
            style={[styles.editIconBtn, { backgroundColor: colors.accentSoft }]}
            hitSlop={8}
          >
            <Pencil size={16} color={colors.accent} />
          </Pressable>
        </View>

        {/* Reading stats */}
        <Text style={[styles.section, { color: colors.text }]}>MY STATS</Text>
        {statsQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
        ) : statsQuery.data ? (
          <View style={styles.statsRow}>
            <Stat icon={<Flame size={17} color={colors.accent} />} value={`${statsQuery.data.streakDays}d`} label="day streak" />
            <Stat value={`${statsQuery.data.minutesReadWeek}m`} label="read this week" />
            <Stat
              icon={<Clock size={16} color={colors.accent} />}
              value={totalReadTimeStr}
              label="total reading"
            />
            <Stat value={statsQuery.data.itemsSavedTotal} label="saved all-time" />
          </View>
        ) : null}
        {statsQuery.data?.topTopicsWeek && statsQuery.data.topTopicsWeek.length > 0 ? (
          <Text style={[styles.topTopics, { color: colors.sub }]}>
            Most read: {statsQuery.data.topTopicsWeek.map((t) => `#${t.key}`).join("  ")}
          </Text>
        ) : null}

        {/* Appearance / Theme Selector */}
        <Text style={[styles.section, { color: colors.text }]}>APPEARANCE</Text>
        <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(
            [
              { key: "system", label: "System", Icon: Monitor },
              { key: "light", label: "Light", Icon: Sun },
              { key: "dark", label: "Dark", Icon: Moon },
            ] as const
          ).map(({ key, label, Icon }) => {
            const active = mode === key;
            return (
              <Pressable
                key={key}
                onPress={() => void setMode(key)}
                style={[
                  styles.themeOption,
                  active && {
                    backgroundColor: colors.accentSoft,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Icon size={16} color={active ? colors.accent : colors.sub} />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: active ? colors.accent : colors.sub },
                    active && { fontWeight: "700" },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Account Management section */}
        <Text style={[styles.section, { color: colors.text }]}>ACCOUNT SETTINGS</Text>
        <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            onPress={openEditProfile}
            style={[styles.accountRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
          >
            <View style={styles.accountRowLeft}>
              <View style={[styles.rowIconWrap, { backgroundColor: colors.accentSoft }]}>
                <User size={16} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.accountRowLabel, { color: colors.text }]}>Edit Profile</Text>
                <Text style={[styles.accountRowSub, { color: colors.sub }]}>Update name and select avatar</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.sub} />
          </Pressable>

          <Pressable
            onPress={openChangeEmail}
            style={[styles.accountRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
          >
            <View style={styles.accountRowLeft}>
              <View style={[styles.rowIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Mail size={16} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.accountRowLabel, { color: colors.text }]}>Change Email</Text>
                <Text style={[styles.accountRowSub, { color: colors.sub }]}>{u?.email}</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.sub} />
          </Pressable>

          <Pressable
            onPress={openChangePassword}
            style={styles.accountRow}
          >
            <View style={styles.accountRowLeft}>
              <View style={[styles.rowIconWrap, { backgroundColor: colors.accentSoft }]}>
                <KeyRound size={16} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.accountRowLabel, { color: colors.text }]}>Change Password</Text>
                <Text style={[styles.accountRowSub, { color: colors.sub }]}>Change account password</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.sub} />
          </Pressable>
        </View>

        <Text style={[styles.section, { color: colors.text }]}>NOTIFICATIONS</Text>
        {settingsQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
        ) : settingsQuery.data ? (
          <View style={[styles.notifyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow label="Push notifications" sub="New stories in topics matching your interests">
              <Switch
                value={settingsQuery.data.pushEnabled}
                onValueChange={(v) => saveSettings.mutate({ pushEnabled: v })}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            </SettingRow>
          </View>
        ) : null}

        {/* Selected topics (read-only) */}
        {me.data?.preferences && me.data.preferences.length > 0 && (
          <>
            <Text style={[styles.section, { color: colors.text }]}>MY INTERESTS</Text>
            <Text style={[styles.sectionHint, { color: colors.sub }]}>
              Selected during registration. The system automatically personalizes your feed based on reading habits.
            </Text>
            <View style={styles.topicBadgesRow}>
              {me.data.preferences.map((p) => (
                <View
                  key={p.key}
                  style={[
                    styles.topicBadge,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.topicBadgeText, { color: colors.text }]}>{p.name}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 28 }} />
        <PrimaryButton label="Log out" variant="danger" onPress={() => logout.mutate()} loading={logout.isPending} />

        <Text style={[styles.version, { color: colors.sub }]}>Attune v0.1</Text>
      </ScrollView>

      {/* ── Modal 1: Edit Profile ─────────────────────────────────────────── */}
      <Modal
        visible={isEditProfileOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditProfileOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setIsEditProfileOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
              <Pressable onPress={() => setIsEditProfileOpen(false)} hitSlop={10}>
                <X size={20} color={colors.sub} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Selected Avatar Preview */}
              <View style={styles.avatarPreviewWrap}>
                <View style={[styles.largeAvatar, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                  <AvatarImage
                    uri={selectedAvatarUrl}
                    size={72}
                    fallbackText={initials}
                    style={styles.largeAvatarImg}
                  />
                </View>
                {selectedAvatarUrl ? (
                  <Pressable
                    onPress={() => setSelectedAvatarUrl(null)}
                    style={styles.removeAvatarBtn}
                  >
                    <Text style={[styles.removeAvatarText, { color: colors.danger }]}>Remove Avatar</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Avatar Selector */}
              <Text style={[styles.inputLabel, { color: colors.sub }]}>CHOOSE PRESET AVATAR</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarPickerList}
              >
                {PRESET_AVATARS.map((avatar) => {
                  const isSelected = selectedAvatarUrl === avatar.url;
                  return (
                    <Pressable
                      key={avatar.id}
                      onPress={() => setSelectedAvatarUrl(avatar.url)}
                      style={[
                        styles.avatarOption,
                        { borderColor: isSelected ? colors.accent : colors.border },
                        isSelected && { backgroundColor: colors.accentSoft },
                      ]}
                    >
                      <AvatarImage uri={avatar.url} size={44} style={styles.avatarOptionImg} />
                      {isSelected ? (
                        <View style={[styles.avatarCheckBadge, { backgroundColor: colors.accent }]}>
                          <Check size={10} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Name Field */}
              <View style={{ marginTop: 16 }}>
                <Field
                  label="FULL NAME"
                  value={editName}
                  onChangeText={(v) => {
                    setEditName(v);
                    setProfileError(null);
                  }}
                  placeholder="Your Name"
                  autoCapitalize="words"
                />
              </View>

              {profileError ? (
                <Text style={[styles.modalError, { color: colors.danger }]}>{profileError}</Text>
              ) : null}

              <View style={{ marginTop: 12, marginBottom: 20 }}>
                <PrimaryButton
                  label="Save Profile"
                  onPress={handleSaveProfile}
                  loading={updateProfile.isPending}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 2: Change Email ─────────────────────────────────────────── */}
      <Modal
        visible={isChangeEmailOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsChangeEmailOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setIsChangeEmailOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change Email</Text>
              <Pressable onPress={() => setIsChangeEmailOpen(false)} hitSlop={10}>
                <X size={20} color={colors.sub} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {emailStep === "request" ? (
                <>
                  <Text style={[styles.modalSub, { color: colors.sub }]}>
                    Current email: <Text style={{ fontWeight: "700", color: colors.text }}>{u?.email}</Text>
                  </Text>

                  {/* Security Notice */}
                  <View style={[styles.noticeBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                    <ShieldAlert size={18} color={colors.accent} style={{ marginTop: 2 }} />
                    <Text style={[styles.noticeText, { color: colors.text }]}>
                      For security, we will send a 6-digit verification code to your new email. An alert will also be sent to your old email address with support instructions if this action was unauthorized.
                    </Text>
                  </View>

                  <Field
                    label="NEW EMAIL ADDRESS"
                    value={newEmail}
                    onChangeText={(v) => {
                      setNewEmail(v);
                      setEmailError(null);
                    }}
                    placeholder="new.email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  {emailError ? (
                    <Text style={[styles.modalError, { color: colors.danger }]}>{emailError}</Text>
                  ) : null}

                  <View style={{ marginTop: 14, marginBottom: 20 }}>
                    <PrimaryButton
                      label="Send Verification Code"
                      onPress={handleRequestEmailChange}
                      loading={requestEmail.isPending}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.modalSub, { color: colors.sub }]}>
                    A 6-digit code was sent to <Text style={{ fontWeight: "700", color: colors.text }}>{newEmail}</Text>.
                  </Text>

                  {emailNotice ? (
                    <View style={[styles.noticeBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                      <Text style={[styles.noticeText, { color: colors.accent }]}>{emailNotice}</Text>
                    </View>
                  ) : null}

                  <Field
                    label="6-DIGIT VERIFICATION CODE"
                    value={emailCode}
                    onChangeText={(v) => {
                      setEmailCode(v.replace(/\D/g, "").slice(0, 6));
                      setEmailError(null);
                    }}
                    placeholder="123456"
                    keyboardType="number-pad"
                  />

                  {emailError ? (
                    <Text style={[styles.modalError, { color: colors.danger }]}>{emailError}</Text>
                  ) : null}

                  <View style={{ marginTop: 14, marginBottom: 12 }}>
                    <PrimaryButton
                      label="Verify & Update Email"
                      onPress={handleVerifyEmailChange}
                      loading={verifyEmail.isPending}
                    />
                  </View>

                  <View style={styles.modalActionRow}>
                    <Pressable
                      onPress={handleRequestEmailChange}
                      disabled={requestEmail.isPending}
                      hitSlop={8}
                    >
                      <Text style={[styles.actionLink, { color: colors.accent }]}>
                        {requestEmail.isPending ? "Sending..." : "Resend code"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEmailStep("request")}
                      hitSlop={8}
                    >
                      <Text style={[styles.actionLink, { color: colors.sub }]}>Change email address</Text>
                    </Pressable>
                  </View>
                  <View style={{ height: 16 }} />
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 3: Change Password ──────────────────────────────────────── */}
      <Modal
        visible={isChangePasswordOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsChangePasswordOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setIsChangePasswordOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
              <Pressable onPress={() => setIsChangePasswordOpen(false)} hitSlop={10}>
                <X size={20} color={colors.sub} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalSub, { color: colors.sub }]}>
                To change your password, please confirm your current password first.
              </Text>

              <Field
                label="CURRENT PASSWORD"
                value={currentPassword}
                onChangeText={(v) => {
                  setCurrentPassword(v);
                  setPasswordError(null);
                }}
                placeholder="••••••••"
                secureTextEntry
                passwordToggle
              />

              <Field
                label="NEW PASSWORD (MIN 8)"
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  setPasswordError(null);
                }}
                placeholder="••••••••"
                secureTextEntry
                passwordToggle
              />

              <Field
                label="CONFIRM NEW PASSWORD"
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setPasswordError(null);
                }}
                placeholder="••••••••"
                secureTextEntry
                passwordToggle
              />

              {passwordError ? (
                <Text style={[styles.modalError, { color: colors.danger }]}>{passwordError}</Text>
              ) : null}

              <View style={{ marginTop: 14, marginBottom: 24 }}>
                <PrimaryButton
                  label="Update Password"
                  onPress={handleChangePassword}
                  loading={changePassword.isPending}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function AvatarImage({
  uri,
  size,
  fallbackText,
  style,
}: {
  uri?: string | null;
  size: number;
  fallbackText?: string;
  style?: StyleProp<ImageStyle>;
}) {
  const { colors } = useTheme();
  const [hasError, setHasError] = useState(false);

  const resolved = resolveAvatarUrl(uri);

  if (!resolved || hasError) {
    if (!fallbackText) {
      return (
        <View
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            },
            style,
          ]}
        >
          <User size={Math.round(size * 0.5)} color={colors.accent} />
        </View>
      );
    }
    return (
      <Text
        style={[
          styles.avatarFallbackText,
          { color: colors.text, fontSize: Math.max(12, Math.round(size * 0.38)) },
        ]}
      >
        {fallbackText}
      </Text>
    );
  }

  // Rewrite legacy DiceBear /svg? to /png? if needed, ensuring native Image displays it
  let resolvedUri = resolved;
  if (resolvedUri.includes("api.dicebear.com") && resolvedUri.includes("/svg?")) {
    resolvedUri = resolvedUri.replace("/svg?", "/png?");
    if (!resolvedUri.includes("size=")) {
      resolvedUri += "&size=128";
    }
  }

  if (resolvedUri.endsWith(".svg") || resolvedUri.includes("/svg?")) {
    return (
      <SvgUri
        uri={resolvedUri}
        width={size}
        height={size}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      onError={() => setHasError(true)}
      resizeMode="cover"
    />
  );
}

function Stat({ icon, value, label }: { icon?: React.ReactNode; value: string | number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {icon}
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      </View>
      <Text style={[styles.statLabel, { color: colors.sub }]}>{label}</Text>
    </View>
  );
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={[styles.settingSub, { color: colors.sub }]}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
  },
  avatarText: { fontWeight: "800", fontSize: 18 },
  avatarFallbackText: { fontWeight: "800" },
  name: { fontSize: 16, fontWeight: "700" },
  email: { fontSize: 13, marginTop: 2 },
  meta: { fontSize: 12, marginTop: 4 },
  editIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontSize: 15, fontWeight: "800", marginBottom: 8, marginTop: 8 },
  accountCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  accountRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  accountRowLabel: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  accountRowSub: {
    fontSize: 12,
    marginTop: 1,
  },
  themeCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    gap: 6,
    marginBottom: 20,
  },
  themeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  themeOptionText: { fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  statBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: "22%",
    flexGrow: 1,
  },
  statValue: { fontSize: 17, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  topTopics: { fontSize: 12, marginBottom: 8 },
  sectionHint: { fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  notifyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  settingLabel: { fontSize: 14.5, fontWeight: "600" },
  settingSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  topicBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  topicBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  topicBadgeText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  version: { fontSize: 11, textAlign: "center", marginTop: 28 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  avatarPreviewWrap: {
    alignItems: "center",
    marginVertical: 10,
  },
  largeAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  largeAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
  },
  largeAvatarText: {
    fontSize: 26,
    fontWeight: "800",
  },
  removeAvatarBtn: {
    marginTop: 8,
    padding: 4,
  },
  removeAvatarText: {
    fontSize: 12,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  avatarPickerList: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
  },
  avatarOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarOptionImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarCheckBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  noticeBox: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  modalError: {
    fontSize: 12.5,
    marginVertical: 8,
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  actionLink: {
    fontSize: 13,
    fontWeight: "600",
  },
});
