"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Field, Select, TextInput, Toggle } from "@ai3d/ui";
import { AppShell } from "@/components/AppShell";
import { apiBaseUrl, gpuJobsEnabled, isApiConfigured, productName, segmentationEnabled, supportEmail } from "@/lib/product";
import { useStudio } from "@/lib/store";

const PREFS_KEY = "ai3d.prefs";

export default function SettingsPage() {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const notify = useStudio((s) => s.notify);
  const [crashReports, setCrashReports] = useState(true);
  const [trainingOptIn, setTrainingOptIn] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { crashReports?: boolean; trainingOptIn?: boolean };
        setCrashReports(parsed.crashReports ?? true);
        setTrainingOptIn(parsed.trainingOptIn ?? false);
      }
    } catch {
      /* storage blocked */
    }
  }, []);

  function savePrefs(next: { crashReports?: boolean; trainingOptIn?: boolean }) {
    const merged = { crashReports, trainingOptIn, ...next };
    setCrashReports(merged.crashReports);
    setTrainingOptIn(merged.trainingOptIn);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
    } catch {
      notify("Browser storage is blocked; the preference was not saved", "warning");
    }
  }

  return (
    <AppShell title="Settings" subtitle="Workspace, branding and integration status">
      <div className="space-y-4">
        <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Workspace</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Default workspace mode" hint="beginner hides advanced panels">
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as "beginner" | "professional")}
                options={[
                  { value: "beginner", label: "Beginner" },
                  { value: "professional", label: "Professional" },
                ]}
              />
            </Field>
            <Field label="Display name">
              <TextInput defaultValue="Bibek Chakraborty" />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Product</h2>
          <dl className="mt-3 grid gap-2 text-2xs sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Product name</dt>
              <dd className="text-neutral-200">{productName}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Support email</dt>
              <dd className="text-neutral-200">{supportEmail}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-neutral-500">Rename the product</dt>
              <dd className="font-mono text-neutral-400">NEXT_PUBLIC_PRODUCT_NAME — branding is configuration, not code</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Integrations</h2>
          <ul className="mt-3 space-y-2 text-2xs">
            <li className="flex items-center justify-between gap-2">
              <span className="text-neutral-300">API</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-neutral-500">{apiBaseUrl || "not set"}</span>
                <Badge tone={isApiConfigured ? "success" : "warning"}>{isApiConfigured ? "configured" : "demo mode"}</Badge>
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-neutral-300">GPU jobs (4K / 60 fps)</span>
              <Badge tone={gpuJobsEnabled ? "success" : "neutral"}>{gpuJobsEnabled ? "enabled" : "disabled"}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-neutral-300">Segmentation (SAM 2.1)</span>
              <Badge tone={segmentationEnabled ? "success" : "neutral"}>{segmentationEnabled ? "enabled" : "adapter only"}</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-neutral-300">Blender render worker</span>
              <Badge tone="warning">requires service</Badge>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Privacy controls</h2>
          <div className="mt-2">
            <Toggle
              label="Allow my projects to be used for model improvement"
              checked={trainingOptIn}
              onChange={(next) => {
                savePrefs({ trainingOptIn: next });
                notify(
                  next
                    ? "Recorded locally. With an API, consent is written to the audit log per project."
                    : "Opted out. No project of yours will be used for training.",
                  next ? "warning" : "success",
                );
              }}
            />
            <Toggle label="Send anonymous crash reports" checked={crashReports} onChange={(next) => savePrefs({ crashReports: next })} />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
            Consent defaults to off and is revocable. No customer project is used for training without an explicit, logged opt-in.
          </p>
        </section>

        <section className="rounded-xl border border-red-500/25 bg-red-950/20 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-300">Danger zone</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">
            Deleting an account removes projects after a 30-day grace period. This is irreversible after the grace period ends.
          </p>
          <Button variant="danger" size="sm" className="mt-2" onClick={() => notify("Account deletion requires the API and a confirmation email. Not available in demo mode.", "warning")}>
            Delete account
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
