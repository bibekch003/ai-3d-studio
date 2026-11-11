"use client";

import { cn } from "@ai3d/ui";
import { useStudio } from "@/lib/store";

export function Toasts() {
  const toasts = useStudio((s) => s.toasts);
  const dismiss = useStudio((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className={cn(
            "pointer-events-auto rounded-lg border px-3 py-2 text-left text-xs leading-relaxed shadow-lg backdrop-blur",
            toast.tone === "success" && "border-emerald-500/30 bg-emerald-950/80 text-emerald-200",
            toast.tone === "danger" && "border-red-500/30 bg-red-950/80 text-red-200",
            toast.tone === "warning" && "border-amber-500/30 bg-amber-950/80 text-amber-200",
            toast.tone === "info" && "border-studio-700 bg-studio-900/90 text-neutral-200",
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
