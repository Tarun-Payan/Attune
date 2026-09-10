import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { forgotPasswordSchema, resetPasswordSchema } from "@attune/schemas";
import { api, ApiError } from "../../src/lib/api";
import { Field, PrimaryButton, Screen } from "../../src/components/ui";
import { useTheme } from "../../src/store/theme";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const [step, setStep] = useState<"request" | "verify">("request");

  // Inputs
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestCode = useMutation({
    mutationFn: (targetEmail: string) => api.auth.forgotPassword(targetEmail),
    onSuccess: (data) => {
      setError(null);
      setSuccessMessage(data.message || `Code sent to ${email.trim()}`);
      setStep("verify");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.body.error || "Failed to send verification code.");
      } else {
        setError("Network error. Please try again.");
      }
    },
  });

  const resetPassword = useMutation({
    mutationFn: (payload: { email: string; code: string; newPassword: string }) =>
      api.auth.resetPassword(payload),
    onSuccess: () => {
      Alert.alert(
        "Password Reset",
        "Your password has been reset successfully. You can now log in with your new password.",
        [{ text: "Log in", onPress: () => router.replace("/auth/login") }],
      );
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.body.error || "Failed to reset password. The code may be invalid or expired.");
      } else {
        setError("Network error. Please try again.");
      }
    },
  });

  const handleSendCode = () => {
    setError(null);
    setSuccessMessage(null);
    const parsed = forgotPasswordSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message || "Please enter a valid email address.");
      return;
    }
    requestCode.mutate(parsed.data.email);
  };

  const handleResetPassword = () => {
    setError(null);
    if (!code.trim() || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({
      email: email.trim(),
      code: code.trim(),
      newPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message || "Password must be at least 8 characters.");
      return;
    }
    resetPassword.mutate(parsed.data);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === "request" ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Forgot password</Text>
              <Text style={[styles.subtitle, { color: colors.sub }]}>
                Enter your registered email address and we'll send you a 6-digit verification code.
              </Text>

              <Field
                label="EMAIL"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={handleSendCode}
              />

              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

              <View style={{ height: 10 }} />
              <PrimaryButton
                label="Send Verification Code"
                onPress={handleSendCode}
                loading={requestCode.isPending}
              />

              <View style={styles.loginRow}>
                <Link href="/auth/login" style={[styles.link, { color: colors.accent }]}>
                  ← Back to log in
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
              <Text style={[styles.subtitle, { color: colors.sub }]}>
                A 6-digit code was sent to <Text style={{ fontWeight: "700", color: colors.text }}>{email}</Text>.
              </Text>

              {successMessage ? (
                <View style={[styles.infoBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                  <Text style={[styles.infoText, { color: colors.accent }]}>{successMessage}</Text>
                </View>
              ) : null}

              <Field
                label="6-DIGIT CODE"
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                placeholder="123456"
                keyboardType="number-pad"
              />

              <Field
                label="NEW PASSWORD (MIN 8)"
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  setError(null);
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
                  setError(null);
                }}
                placeholder="••••••••"
                secureTextEntry
                passwordToggle
                returnKeyType="go"
                onSubmitEditing={handleResetPassword}
              />

              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

              <View style={{ height: 10 }} />
              <PrimaryButton
                label="Reset Password"
                onPress={handleResetPassword}
                loading={resetPassword.isPending}
              />

              <View style={styles.resendRow}>
                <Pressable
                  onPress={handleSendCode}
                  disabled={requestCode.isPending}
                  hitSlop={10}
                >
                  <Text style={[styles.resendText, { color: colors.accent }]}>
                    {requestCode.isPending ? "Sending..." : "Didn't receive code? Resend"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.loginRow}>
                <Link href="/auth/login" style={[styles.link, { color: colors.accent }]}>
                  ← Back to log in
                </Link>
              </View>
            </>
          )}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 70, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  infoBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { fontSize: 13, fontWeight: "500" },
  error: { fontSize: 13, marginBottom: 12 },
  resendRow: { alignItems: "center", marginTop: 16 },
  resendText: { fontSize: 13.5, fontWeight: "600" },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  link: { fontSize: 14, fontWeight: "700" },
});
