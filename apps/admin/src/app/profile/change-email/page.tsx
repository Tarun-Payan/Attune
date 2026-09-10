"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Mail,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { toast } from "sonner";

export default function ChangeEmailPage() {
  const router = useRouter();
  const { user: authUser, refreshPermissions } = usePermissions();

  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [step, setStep] = useState<"request" | "verify" | "success">("request");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (authUser?.email) {
      setCurrentEmail(authUser.email);
    }
  }, [authUser]);

  // Step 1: Request verification code to new email
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = newEmail.trim().toLowerCase();

    if (!targetEmail) {
      toast.error("Please enter a new email address");
      return;
    }

    if (targetEmail === currentEmail.toLowerCase()) {
      toast.error("New email must be different from current email");
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const res = await api.me.requestEmailChange(targetEmail);
      setStep("verify");
      setNotice(res.message);
      toast.success("Verification code sent to your new email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and update email
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = emailCode.trim();

    if (!code || code.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    try {
      await api.me.verifyEmailChange({
        newEmail: newEmail.trim().toLowerCase(),
        code,
      });
      setStep("success");
      await refreshPermissions();
      toast.success("Email changed successfully! A security notice was sent to your old email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed. Check the code.");
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const handleResendCode = async () => {
    setLoading(true);
    try {
      const res = await api.me.requestEmailChange(newEmail.trim().toLowerCase());
      setNotice(res.message);
      toast.success("A new verification code has been sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl pb-12">
      <div>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-3"
        >
          <ArrowLeft size={14} /> Back to Profile
        </button>

        <PageHeader
          title="Change Email Address"
          subtitle="Update your administrative login and notification email address"
        />
      </div>

      {step === "request" && (
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Step 1: Enter New Email</h2>
              <p className="text-xs text-muted-foreground">
                We will send a 6-digit verification code to confirm ownership
              </p>
            </div>
          </div>

          <form onSubmit={handleRequestCode} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Current Email Address
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={currentEmail}
                  readOnly
                  disabled
                  className="bg-muted/40 font-mono text-xs text-muted-foreground cursor-not-allowed"
                />
                <Badge variant="success" className="text-[11px] shrink-0">
                  Active
                </Badge>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                New Email Address
              </label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new-admin@example.com"
                required
                autoFocus
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                A 6-digit code will be sent to this address. An advisory notice will also be sent to{" "}
                <span className="font-semibold text-foreground">{currentEmail}</span>.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading || !newEmail.trim() || newEmail.trim().toLowerCase() === currentEmail.toLowerCase()}
                className="cursor-pointer"
              >
                {loading ? "Sending Code..." : "Send Verification Code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/profile")}
                className="cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === "verify" && (
        <Card className="p-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Step 2: Verify New Email</h2>
              <p className="text-xs text-muted-foreground">
                Enter the verification code sent to {newEmail}
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-5">
            {notice && (
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Verification Code
              </label>
              <Input
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="font-mono text-center tracking-widest text-2xl font-bold max-w-xs h-12"
                maxLength={6}
                required
                autoFocus
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Enter the 6-digit number sent to{" "}
                <span className="font-semibold text-foreground">{newEmail}</span>. The code expires in 15
                minutes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer disabled:opacity-50"
              >
                <RotateCcw size={12} /> Resend verification code
              </button>
              <span className="text-xs text-muted-foreground">•</span>
              <button
                type="button"
                onClick={() => {
                  setStep("request");
                  setEmailCode("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
              >
                Change target email address
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={loading || emailCode.length !== 6}
                className="cursor-pointer"
              >
                {loading ? "Verifying..." : "Verify & Update Email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/profile")}
                className="cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === "success" && (
        <Card className="p-8 text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">Email Updated Successfully</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your administrative email address has been updated to{" "}
              <span className="font-semibold text-foreground">{newEmail}</span>. You can now use this
              email for sign-in and system notifications.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground max-w-md mx-auto text-left">
            A confirmation notice was also dispatched to your previous address (
            <span className="font-semibold text-foreground">{currentEmail}</span>).
          </div>

          <div>
            <Button
              type="button"
              onClick={() => router.push("/profile")}
              className="cursor-pointer"
            >
              Return to Profile
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
