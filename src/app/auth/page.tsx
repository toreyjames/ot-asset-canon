"use client";

import Link from "next/link";
import { useState } from "react";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("signin");

  return (
    <div className="min-h-screen bg-[#050915] text-slate-100 px-4 py-12">
      <div className="max-w-md mx-auto rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6">
        <div className="text-xs uppercase tracking-wide text-cyan-300">PlantTrace Access</div>
        <h1 className="mt-2 text-3xl font-semibold">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Demo viewing is public. Sign in to save runs, export results, and keep site history.
        </p>

        <div className="mt-5 grid grid-cols-2 rounded-md border border-slate-700 bg-slate-950 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded px-3 py-2 ${mode === "signin" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded px-3 py-2 ${mode === "signup" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"}`}
          >
            Create Account
          </button>
        </div>

        <form className="mt-5 space-y-4">
          {mode === "signup" && (
            <>
              <Field label="Full Name" type="text" placeholder="Jane Smith" />
              <Field label="Company" type="text" placeholder="Acme Manufacturing" />
              <Field label="Role" type="text" placeholder="Plant Manager" />
            </>
          )}
          <Field label="Work Email" type="email" placeholder="you@company.com" />
          <Field label="Password" type="password" placeholder="••••••••" />

          <button
            type="button"
            className="w-full rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          >
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-400">
          {mode === "signin" ? "Need access? Create an account." : "Already have an account? Switch to Sign In."}
        </div>
        <div className="mt-6 text-xs">
          <Link href="/" className="text-cyan-300 hover:text-cyan-200">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
}: {
  label: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type={type}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}

