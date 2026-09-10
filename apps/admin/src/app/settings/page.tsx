"use client";

import { useEffect, useState } from "react";
import { Sliders, Save, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import { Button, Card, Input, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { can, loading: permsLoading } = usePermissions();
  const [reportThreshold, setReportThreshold] = useState<number>(5);
  const [explorationRatio, setExplorationRatio] = useState<number>(10);
  const [minDwellSeconds, setMinDwellSeconds] = useState<number>(5);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (can("settings", "read")) {
      api.settings.get().then((res) => {
        if (res?.settings) {
          setReportThreshold(res.settings.reportAutoHideThreshold);
          setExplorationRatio(res.settings.explorationRatioPercent);
          setMinDwellSeconds(res.settings.minDwellNudgeSeconds);
        }
      }).catch((err) => {
        setMessage({ text: err instanceof Error ? err.message : "Failed to load settings", type: "error" });
      });
    }
  }, [can]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.settings.patch({
        reportAutoHideThreshold: Number(reportThreshold),
        explorationRatioPercent: Number(explorationRatio),
        minDwellNudgeSeconds: Number(minDwellSeconds),
      });
      if (res?.settings) {
        setReportThreshold(res.settings.reportAutoHideThreshold);
        setExplorationRatio(res.settings.explorationRatioPercent);
        setMinDwellSeconds(res.settings.minDwellNudgeSeconds);
      }
      setMessage({ text: "Algorithm and moderation settings saved successfully!", type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!permsLoading && !can("settings", "read")) {
    return <AccessDenied feature="Settings" />;
  }

  const canEdit = can("settings", "update");

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        subtitle="Configure algorithm weights, exploration ratios, and moderation thresholds"
      />

      <Card className="max-w-2xl p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-foreground">
              Report Auto-Hide Threshold
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Number of distinct user reports required before an item is automatically hidden platform-wide.
            </p>
            <div className="mt-2 w-48">
              <Input
                type="number"
                min={1}
                max={100}
                value={reportThreshold}
                onChange={(e) => setReportThreshold(parseInt(e.target.value, 10) || 1)}
                disabled={!canEdit}
                required
              />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <label className="block text-sm font-semibold text-foreground">
              Exploration Ratio (%)
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Percentage of feed items dedicated to novel topics/tags outside the user's primary interests (default 10%).
            </p>
            <div className="mt-2 w-48">
              <Input
                type="number"
                min={0}
                max={50}
                value={explorationRatio}
                onChange={(e) => setExplorationRatio(parseFloat(e.target.value) || 0)}
                disabled={!canEdit}
                required
              />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <label className="block text-sm font-semibold text-foreground">
              Minimum Dwell Time (seconds)
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Minimum reading dwell time on an article required to increment the user's topic and tag affinity weights (default 5s).
            </p>
            <div className="mt-2 w-48">
              <Input
                type="number"
                min={1}
                max={60}
                value={minDwellSeconds}
                onChange={(e) => setMinDwellSeconds(parseInt(e.target.value, 10) || 1)}
                disabled={!canEdit}
                required
              />
            </div>
          </div>

          {message && (
            <div
              className={`flex items-center gap-2 rounded-2xl p-3 text-sm border ${
                message.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {message.type === "success" && <CheckCircle2 size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="border-t border-border pt-4 flex items-center justify-between">
            <Button type="submit" disabled={saving || !canEdit}>
              <Save size={16} className="mr-2" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            {!canEdit && (
              <span className="text-xs text-muted-foreground italic">
                Read-only access (editing restricted)
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
