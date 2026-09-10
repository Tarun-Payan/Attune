export interface PresetAvatar {
  id: string;
  name: string;
  url: string;
}

export const PRESET_AVATARS: readonly PresetAvatar[] = [
  { id: "avatar-orbit", name: "Orbit", url: "/avatars/orbit.png" },
  { id: "avatar-nova", name: "Nova", url: "/avatars/nova.png" },
  { id: "avatar-pulse", name: "Pulse", url: "/avatars/pulse.png" },
  { id: "avatar-echo", name: "Echo", url: "/avatars/echo.png" },
  { id: "avatar-aura", name: "Aura", url: "/avatars/aura.png" },
  { id: "avatar-zephyr", name: "Zephyr", url: "/avatars/zephyr.png" },
  { id: "avatar-vortex", name: "Vortex", url: "/avatars/vortex.png" },
  { id: "avatar-cosmo", name: "Cosmo", url: "/avatars/cosmo.png" },
  { id: "avatar-zenith", name: "Zenith", url: "/avatars/zenith.png" },
  { id: "avatar-sol", name: "Sol", url: "/avatars/sol.png" },
  { id: "avatar-atlas", name: "Atlas", url: "/avatars/atlas.png" },
  { id: "avatar-luna", name: "Luna", url: "/avatars/luna.png" },
] as const;
