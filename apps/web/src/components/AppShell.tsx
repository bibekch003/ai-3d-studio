"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@ai3d/ui";
import { productName } from "@/lib/product";

const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: "Create",
    items: [
      { href: "/studio", label: "Studio", icon: "◧" },
      { href: "/ai-director", label: "AI Director", icon: "✦" },
      { href: "/characters", label: "Characters", icon: "☺" },
    ],
  },
  {
    label: "Produce",
    items: [
      { href: "/animation", label: "Animation", icon: "◷" },
      { href: "/rendering", label: "Rendering", icon: "▣" },
      { href: "/assets", label: "Assets", icon: "◈" },
      { href: "/library", label: "Library", icon: "▥" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard", label: "Home", icon: "▦" },
      { href: "/projects", label: "Projects", icon: "▤" },
      { href: "/settings", label: "Settings", icon: "⚙" },
    ],
  },
];

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  wide,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 shrink-0 border-r border-studio-800 bg-studio-900/95 backdrop-blur transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-studio-800 px-4">
          <span className="grid size-6 place-items-center rounded-md bg-amber-400 text-[13px] font-black text-neutral-950">3D</span>
          <span className="truncate text-sm font-semibold text-neutral-100">{productName}</span>
        </div>
        <nav className="panel-scroll space-y-3 p-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-600">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                        active ? "bg-studio-800 text-neutral-100" : "text-neutral-400 hover:bg-studio-850 hover:text-neutral-200",
                      )}
                    >
                      <span aria-hidden className={cn("text-xs", active ? "text-amber-400" : "text-neutral-500")}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-4 border-t border-studio-800 p-3 text-2xs leading-relaxed text-neutral-500">
          <p className="font-medium text-neutral-400">Local workspace</p>
          <p>Demo project loaded from the browser. Connect the API to persist scenes.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-studio-800 bg-studio-950/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="grid size-8 place-items-center rounded-md border border-studio-800 text-neutral-400 lg:hidden"
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-neutral-100">{title}</h1>
            {subtitle ? <p className="truncate text-2xs text-neutral-500">{subtitle}</p> : null}
          </div>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
        <main className={cn("flex-1 px-4 py-5", wide ? "" : "mx-auto w-full max-w-6xl")}>{children}</main>
      </div>
    </div>
  );
}
