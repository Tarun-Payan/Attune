import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ViewProps,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { radius } from "../theme";
import { useTheme } from "../store/theme";

export function Screen({ style, children, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }, style]} {...rest}>
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger";
}) {
  const { colors, isDark } = useTheme();
  const bg =
    variant === "primary"
      ? colors.accent
      : variant === "danger"
        ? isDark
          ? "#3A1D24"
          : "#FEE2E2"
        : "transparent";
  const fg =
    variant === "primary" ? "#FFFFFF" : variant === "danger" ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
        variant === "ghost" && { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  passwordToggle,
  autoCapitalize = "none",
  keyboardType = "default",
  error,
  onSubmitEditing,
  returnKeyType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  passwordToggle?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  onSubmitEditing?: () => void;
  returnKeyType?: "search" | "done" | "go" | "next";
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  const hide = secureTextEntry && !show;

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: colors.sub }, error ? { color: colors.danger } : null]}>
          {label}
        </Text>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.sub}
          secureTextEntry={hide}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.text,
            },
            error ? { borderColor: colors.danger } : null,
            passwordToggle ? { paddingRight: 46 } : null,
          ]}
        />
        {passwordToggle ? (
          <Pressable onPress={() => setShow((s) => !s)} style={styles.eyeBtn} hitSlop={10}>
            {show ? (
              <EyeOff size={20} color={colors.sub} />
            ) : (
              <Eye size={20} color={colors.sub} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.fieldError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  btn: { height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnLabel: { fontSize: 16, fontWeight: "700" },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  inputWrap: { position: "relative", justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
  },
  eyeBtn: { position: "absolute", right: 12, padding: 4 },
  fieldError: { fontSize: 12.5, marginTop: 5 },
});
