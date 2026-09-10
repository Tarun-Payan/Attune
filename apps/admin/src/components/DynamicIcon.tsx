"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import { HelpCircle } from "lucide-react";

interface DynamicIconProps {
  name?: string | null;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

// Convert "bitcoin" -> "Bitcoin", "brain-circuit" -> "BrainCircuit", "shield_check" -> "ShieldCheck"
export function normalizeIconName(name: string): string {
  if (!name) return "";
  const cleaned = name.trim();
  if (/^[A-Z][a-zA-Z0-9]*$/.test(cleaned)) {
    return cleaned;
  }
  return cleaned
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

// Common aliases and intuitive synonyms for Lucide icons
export const ICON_ALIASES: Record<string, string> = {
  astroid: "Orbit",
  asteroid: "Orbit",
  meteor: "Flame",
  comet: "Sparkles",
  crypto: "Bitcoin",
  btc: "Bitcoin",
  eth: "Coins",
  ethereum: "Coins",
  money: "Coins",
  ai: "BrainCircuit",
  ml: "Cpu",
  robot: "Bot",
  bot: "Bot",
  web: "Code",
  webdev: "Code",
  programming: "Code",
  coding: "Code",
  security: "ShieldCheck",
  cybersecurity: "ShieldCheck",
  space: "Rocket",
  astronomy: "Telescope",
  database: "Database",
  db: "Database",
  backend: "Server",
  frontend: "Layout",
  devops: "CloudCog",
  cloud: "Cloud",
};

export function isIconValid(name?: string | null): boolean {
  if (!name || !name.trim()) return false;
  return getLucideIcon(name) !== null || /\p{Extended_Pictographic}/u.test(name.trim());
}

export function getLucideIcon(name?: string | null): LucideIcons.LucideIcon | null {
  if (!name || !name.trim()) return null;
  const trimmed = name.trim();

  // 1. Direct name lookup (e.g. "Bitcoin")
  const iconsRecord = LucideIcons as unknown as Record<string, unknown>;
  const direct = iconsRecord[trimmed];
  if (isValidIconComponent(direct)) {
    return direct as LucideIcons.LucideIcon;
  }

  // 2. PascalCase normalized lookup (e.g. "bitcoin" -> "Bitcoin", "brain-circuit" -> "BrainCircuit")
  const pascal = normalizeIconName(trimmed);
  const normalized = iconsRecord[pascal];
  if (isValidIconComponent(normalized)) {
    return normalized as LucideIcons.LucideIcon;
  }

  // 3. Known aliases/synonyms
  const alias = ICON_ALIASES[trimmed.toLowerCase()];
  if (alias) {
    const aliasedIcon = iconsRecord[alias];
    if (isValidIconComponent(aliasedIcon)) {
      return aliasedIcon as LucideIcons.LucideIcon;
    }
  }

  return null;
}

function isValidIconComponent(item: unknown): boolean {
  if (!item) return false;
  if (typeof item === "function") return true;
  if (typeof item === "object" && item !== null) {
    return "$$typeof" in item || "render" in item;
  }
  return false;
}

export function DynamicIcon({
  name,
  size = 18,
  className = "",
  fallback = null,
}: DynamicIconProps) {
  if (!name || !name.trim()) return <>{fallback}</>;

  const trimmed = name.trim();

  // Render emoji if present
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    return (
      <span
        style={{ fontSize: size }}
        className={`inline-flex items-center justify-center leading-none select-none ${className}`}
      >
        {trimmed}
      </span>
    );
  }

  const IconComponent = getLucideIcon(trimmed);

  if (IconComponent) {
    return <IconComponent size={size} className={className} />;
  }

  if (fallback) return <>{fallback}</>;

  return (
    <span
      title={`Unrecognized Lucide icon: "${name}". Try Orbit, Rocket, Bitcoin, BrainCircuit, etc.`}
      className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive border border-destructive/20"
    >
      <HelpCircle size={size * 0.75} className="text-destructive" />
      <span className="truncate max-w-[80px]">{name}</span>
    </span>
  );
}