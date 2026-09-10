"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Shield,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { PRESET_AVATARS, type PresetAvatar, type PublicUser } from "@attune/types";
import { api, resolveAvatarUrl } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Badge, Button, Card, Input, Modal, PageHeader } from "@/components/ui";
import { toast } from "sonner";

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, role, refreshPermissions } = usePermissions();

  // Profile fields
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar picker modal
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);

  // Read-only email display
  const [currentEmail, setCurrentEmail] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (authUser) {
      setName(authUser.name ?? "");
      setAvatarUrl(authUser.avatarUrl ?? null);
      setSelectedAvatarUrl(authUser.avatarUrl ?? null);
      setCurrentEmail(authUser.email ?? "");
    }
  }, [authUser]);

  // Handle profile save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.me.patch({
        name: name.trim() || null,
        avatarUrl,
      });
      await refreshPermissions();
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle avatar select
  const handleSelectAvatar = (preset: PresetAvatar) => {
    setSelectedAvatarUrl(preset.url);
  };

  const handleApplyAvatar = async () => {
    setAvatarUrl(selectedAvatarUrl);
    setIsAvatarModalOpen(false);
    // Persist immediately
    try {
      await api.me.patch({ avatarUrl: selectedAvatarUrl });
      await refreshPermissions();
      toast.success("Avatar updated");
    } catch (err) {
      toast.error("Failed to save avatar choice");
    }
  };

  // Password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.me.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <PageHeader
        title="Profile & Security"
        subtitle="Manage your administrative credentials, avatar, email, and password"
      />

      <div className="grid gap-6">
        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserIcon size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Personal Information</h2>
              <p className="text-xs text-muted-foreground">Update your avatar and display name</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Avatar Section */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Avatar
              </label>
              <div className="flex items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-muted/40 overflow-hidden shadow-sm">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveAvatarUrl(avatarUrl)!} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold uppercase text-muted-foreground">
                      {name ? name[0] : currentEmail[0] ?? "A"}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={14} className="text-primary" /> Select Avatar
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Choose from predefined system avatars
                  </p>
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div className="max-w-md">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Display Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Mercer"
                maxLength={100}
              />
            </div>

            {/* Email Address (Read-only with Change Email button) */}
            <div className="max-w-md">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Email Address
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={currentEmail}
                  readOnly
                  disabled
                  className="bg-muted/40 font-mono text-xs text-muted-foreground cursor-not-allowed"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/profile/change-email")}
                  className="shrink-0 gap-1.5 text-xs cursor-pointer hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Mail size={13} /> Change Email
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Your administrative email used for sign-in and security alerts.
              </p>
            </div>

            {/* Role & Permissions (Read-only) */}
            <div className="max-w-md">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Assigned Role
              </label>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs font-semibold py-1 px-3">
                  <Shield size={12} className="mr-1.5 inline" /> {role?.name ?? "Super Admin"}
                </Badge>
                {role?.isSystem && (
                  <Badge variant="secondary" className="text-[11px]">System Role</Badge>
                )}
              </div>
            </div>

            <Button type="submit" disabled={savingProfile} className="cursor-pointer">
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </Card>

        {/* Password Change Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Change Password</h2>
              <p className="text-xs text-muted-foreground">Ensure your account is using a secure password</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <Input
                  type={showCurrentPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showCurrentPass ? "Hide password" : "Show password"}
                >
                  {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showNewPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showNewPass ? "Hide password" : "Show password"}
                >
                  {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Must be at least 8 characters.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showConfirmPass ? "Hide password" : "Show password"}
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={
                passwordLoading ||
                !currentPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
              className="cursor-pointer"
            >
              {passwordLoading ? "Updating Password..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>

      {/* Preset Avatars Modal */}
      <Modal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        title="Select Preset Avatar"
      >
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Select one of the built-in system avatars below:
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[360px] overflow-y-auto p-1">
            {PRESET_AVATARS.map((preset) => {
              const isSelected = selectedAvatarUrl === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectAvatar(preset)}
                  className={`group relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted/50 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveAvatarUrl(preset.url)!} alt={preset.name} className="h-full w-full object-cover" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check size={10} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAvatarModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplyAvatar}
              disabled={!selectedAvatarUrl}
            >
              Apply Avatar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
