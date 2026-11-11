import Link from "next/link";
import { productName } from "@/lib/product";

export function MarketingShell({
  children,
  title,
  lead,
}: {
  children: React.ReactNode;
  title: string;
  lead?: string;
}) {
  return (
    <div className="min-h-screen bg-studio-950">
      <header className="sticky top-0 z-30 border-b border-studio-800 bg-studio-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-amber-400 text-[13px] font-black text-neutral-950">3D</span>
            <span className="text-sm font-semibold">{productName}</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-5 text-xs text-neutral-400 sm:flex">
            <Link href="/features" className="hover:text-neutral-100">Features</Link>
            <Link href="/docs" className="hover:text-neutral-100">Docs</Link>
            <Link href="/help" className="hover:text-neutral-100">Help</Link>
            <Link href="/studio" className="rounded-md bg-amber-400 px-3 py-1.5 font-medium text-neutral-950 hover:bg-amber-300">
              Open studio
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50">{title}</h1>
        {lead ? <p className="mt-3 text-sm leading-relaxed text-neutral-400">{lead}</p> : null}
        <div className="prose-invert mt-8 space-y-6 text-sm leading-relaxed text-neutral-300">{children}</div>
      </main>
      <footer className="border-t border-studio-800 py-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 text-2xs text-neutral-500">
          <span>© {new Date().getFullYear()} {productName}</span>
          <Link href="/privacy" className="hover:text-neutral-300">Privacy</Link>
          <Link href="/terms" className="hover:text-neutral-300">Terms</Link>
          <Link href="/docs" className="hover:text-neutral-300">Documentation</Link>
        </div>
      </footer>
    </div>
  );
}
