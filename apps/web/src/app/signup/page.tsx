"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, TextInput } from "@ai3d/ui";
import { isApiConfigured, productName } from "@/lib/product";

export default function SignupPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-amber-400 text-[13px] font-black text-neutral-950">3D</span>
          <span className="text-sm font-semibold">{productName}</span>
        </Link>
        <h1 className="text-xl font-semibold text-neutral-100">Create an account</h1>
        <p className="mt-1 text-xs text-neutral-500">Free tier: 1 project, 1080p previews, watermarked exports.</p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <Field label="Display name" htmlFor="name">
            <TextInput id="name" autoComplete="name" required />
          </Field>
          <Field label="Email" htmlFor="email">
            <TextInput id="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="password" hint="12+ characters">
            <TextInput id="password" type="password" autoComplete="new-password" minLength={12} required />
          </Field>
          <Button type="submit" variant="primary" className="w-full">Create account</Button>
        </form>
        {submitted ? (
          <p className="mt-3 rounded-lg border border-studio-700 bg-studio-900 p-3 text-2xs leading-relaxed text-neutral-300">
            {isApiConfigured
              ? "Sign-up is routed through Supabase Auth; check your inbox to confirm the address."
              : "No auth provider is configured in this build, so no account was created. The studio demo works without one."}
          </p>
        ) : null}
        <p className="mt-6 text-2xs text-neutral-500">
          Already registered? <Link href="/login" className="text-amber-300 hover:text-amber-200">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
