import {
  Bitcoin,
  Bot,
  BrainCircuit,
  CloudCog,
  Code,
  Coins,
  Cpu,
  Flame,
  FlaskConical,
  Gamepad2,
  GitFork,
  Layout,
  Newspaper,
  Orbit,
  Palette,
  Rocket,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Telescope,
  type LucideIcon,
} from "lucide-react-native";
import * as LucideIcons from "lucide-react-native";
import { Text } from "react-native";
import { colors } from "../theme";

const TOPIC_ICONS: Record<string, LucideIcon> = {
  ai: BrainCircuit,
  webdev: Code,
  mobile: Smartphone,
  devops: CloudCog,
  cybersecurity: ShieldCheck,
  startups: Rocket,
  gadgets: Cpu,
  science: FlaskConical,
  gaming: Gamepad2,
  crypto: Bitcoin,
  opensource: GitFork,
  design: Palette,
};

const ICON_ALIASES: Record<string, string> = {
  astroid: "Orbit",
  asteroid: "Orbit",
  meteor: "Flame",
  crypto: "Bitcoin",
  btc: "Bitcoin",
  eth: "Coins",
  ai: "BrainCircuit",
  web: "Code",
  webdev: "Code",
  space: "Rocket",
  astronomy: "Telescope",
};

export function TopicIcon({
  topicKey,
  iconName,
  size = 22,
  color,
}: {
  topicKey?: string;
  iconName?: string | null;
  size?: number;
  color?: string;
}) {
  const chosenColor = color ?? colors.accent;

  if (iconName && iconName.trim()) {
    const trimmed = iconName.trim();
    if (/\p{Extended_Pictographic}/u.test(trimmed)) {
      return <Text style={{ fontSize: size }}>{trimmed}</Text>;
    }
    const pascal = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    const resolvedName = ICON_ALIASES[trimmed.toLowerCase()] ?? pascal;
    const DynIcon = (LucideIcons as Record<string, any>)[resolvedName] as LucideIcon | undefined;
    if (DynIcon) {
      return <DynIcon size={size} color={chosenColor} />;
    }
  }

  const Icon = (topicKey ? TOPIC_ICONS[topicKey] : undefined) ?? Newspaper;
  return <Icon size={size} color={chosenColor} />;
}
