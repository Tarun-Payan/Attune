import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fieldErrors, loginSchema } from "@attune/schemas";
import { api, ApiError } from "../../src/lib/api";
import type { AuthResponse } from "../../src/lib/types";
import { completeSignIn } from "../../src/lib/post-auth";
import { Field, PrimaryButton, Screen } from "../../src/components/ui";
import { SocialButtons } from "../../src/components/SocialButtons";
import { useTheme } from "../../src/store/theme";

export default function Login() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const clearField = (key: string) =>
    setFieldErrs((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const login = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.auth.login(input),
    onSuccess: async (data) => {

      await completeSignIn(data, () => queryClient.invalidateQueries());
    },
    onError: (err) => {
      if (err instanceof ApiError && err.body.fields) {
        setFieldErrs(err.body.fields);
        setFormError(null);
      } else {
        setFormError(
          err instanceof ApiError
            ? String(err.body.error ?? "Login failed")
            : "Could not reach the server. Is the backend running?",
        );
      }
    },
  });

  const submit = () => {
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrs(fieldErrors(parsed.error));
      return;
    }
    setFieldErrs({});
    login.mutate(parsed.data);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.sub }]}>Log in to pick up where you left off.</Text>

          <Field
            label="EMAIL"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clearField("email");
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            error={fieldErrs.email}
          />
          <Field
            label="PASSWORD"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clearField("password");
            }}
            placeholder="••••••••"
            secureTextEntry
            passwordToggle
            error={fieldErrs.password}
          />

          <View style={styles.forgotRow}>
            <Link href="/auth/forgot-password" style={[styles.forgotLink, { color: colors.accent }]}>
              Forgot password?
            </Link>
          </View>

          {formError ? <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text> : null}

          <View style={{ height: 6 }} />
          <PrimaryButton label="Log in" onPress={submit} loading={login.isPending} />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.sub }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
          <SocialButtons />

          <View style={styles.loginRow}>
            <Text style={[styles.hint, { color: colors.sub }]}>New to Attune? </Text>
            <Link href="/auth/register" style={[styles.link, { color: colors.accent }]}>
              Create account
            </Link>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 70, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  forgotRow: { alignItems: "flex-end", marginTop: -6, marginBottom: 16 },
  forgotLink: { fontSize: 13, fontWeight: "600" },
  error: { fontSize: 13, marginBottom: 10 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  hint: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "700" },
});
