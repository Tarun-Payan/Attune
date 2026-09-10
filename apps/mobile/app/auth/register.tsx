import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fieldErrors, registerSchema } from "@attune/schemas";
import { api, ApiError } from "../../src/lib/api";
import type { AuthResponse } from "../../src/lib/types";
import { completeSignIn } from "../../src/lib/post-auth";
import { Field, PrimaryButton, Screen } from "../../src/components/ui";
import { SocialButtons } from "../../src/components/SocialButtons";
import { useTheme } from "../../src/store/theme";

export default function Register() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
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

  const register = useMutation({
    mutationFn: (input: { email: string; password: string; name?: string }) =>
      api.auth.register(input),
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
            ? String(err.body.error ?? "Registration failed")
            : "Could not reach the server. Is the backend running?",
        );
      }
    },
  });

  const submit = () => {
    setFormError(null);
    const parsed = registerSchema.safeParse({
      email,
      password,
      ...(name.trim() ? { name: name.trim() } : {}),
    });
    if (!parsed.success) {
      setFieldErrs(fieldErrors(parsed.error));
      return;
    }
    setFieldErrs({});
    register.mutate(parsed.data);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.sub }]}>One minute, then your feed is live.</Text>

          <Field
            label="NAME (OPTIONAL)"
            value={name}
            onChangeText={(v) => {
              setName(v);
              clearField("name");
            }}
            placeholder="Your name"
            autoCapitalize="words"
            error={fieldErrs.name}
          />
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
            label="PASSWORD (MIN 8)"
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

          {formError ? <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text> : null}

          <View style={{ height: 6 }} />
          <PrimaryButton label="Create account" onPress={submit} loading={register.isPending} />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.sub }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
          <SocialButtons />

          <View style={styles.loginRow}>
            <Text style={[styles.hint, { color: colors.sub }]}>Already have an account? </Text>
            <Link href="/auth/login" style={[styles.link, { color: colors.accent }]}>
              Log in
            </Link>
          </View>
          <Link href="/onboarding" style={[styles.back, { color: colors.sub }]}>
            ← Back to topics
          </Link>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 70, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  error: { fontSize: 13, marginBottom: 10 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  hint: { fontSize: 14 },
  link: { fontSize: 14, fontWeight: "700" },
  back: { fontSize: 13, textAlign: "center", marginTop: 26 },
});
