"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, TextInput } from "@ai3d/ui";
import { isApiConfigured, productName } from "@/lib/product";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "unavailable">("idle");

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-amber-400 text-[13px] font-black text-neutral-950">3D</span>
          <span className="text-sm font-semibold">{productName}</span>
        </Link>
        <h1 className="text-xl font-semibold text-neutral-100">Sign in</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Accounts are handled by Supabase Auth. This build has{" "}
          {isApiConfigured ? "the API configured" : "no backend configured"}, so the demo workspace is open without an account.
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setStatus("unavailable");
          }}
        >
          <Field label="Email" htmlFor="email">
            <TextInput id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" htmlFor="password">
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={status === "sending"}>
            Sign in
          </Button>
        </form>

        {status === "unavailable" ? (
          <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-2xs leading-relaxed text-amber-200">
            Authentication is not enabled in this deployment. Set <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> to turn on sign-in. Meanwhile,{" "}
            <Link href="/studio" className="underline">open the studio directly</Link>.
          </p>
        ) : null}

        <p className="mt-6 text-2xs text-neutral-500">
          No account? <Link href="/signup" className="text-amber-300 hover:text-amber-200">Create one</Link>
        </p>
      </div>
    </div>
  );
}
