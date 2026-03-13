"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setAccessState } from "@/lib/access";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [returnTo, setReturnTo] = useState("/industrial-tracker");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("returnTo");
    if (next?.trim()) setReturnTo(next);
  }, []);

  function handleAuth() {
    if (!email.trim() || !password.trim()) return;
    setAccessState({
      loggedIn: true,
      plan: "pilot",
      name: name.trim() || undefined,
      company: company.trim() || undefined,
      email: email.trim(),
    });
    router.push(returnTo);
  }

  return (
    <div className="industrial-spec min-h-screen bg-[#060606] text-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-md spec-block p-6">
        <div className="spec-eyebrow">Baseload Access</div>
        <h1 className="spec-title mt-2 text-3xl">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>
        <p className="spec-body mt-2 text-sm">
          Sign in to save assessments, manage opportunities, and keep team workspace history.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            disabled
            className="w-full rounded-md border border-zinc-700 bg-[#090909] px-4 py-2.5 text-sm text-zinc-400 disabled:opacity-80"
          >
            Continue with Microsoft (Workplace) - Coming Soon
          </button>
          <div className="text-[11px] text-zinc-500">
            Recommended for enterprise teams using Microsoft 365 and Entra ID.
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-md border border-zinc-700 bg-[#090909] p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded px-3 py-2 ${mode === "signin" ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-300"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded px-3 py-2 ${mode === "signup" ? "bg-cyan-500/20 text-cyan-100" : "text-zinc-300"}`}
          >
            Create Account
          </button>
        </div>

        <form className="mt-5 space-y-4">
          {mode === "signup" && (
            <>
              <Field label="Full Name" type="text" placeholder="Jane Smith" value={name} onChange={setName} />
              <Field label="Company" type="text" placeholder="Acme Manufacturing" value={company} onChange={setCompany} />
              <Field label="Role" type="text" placeholder="Plant Manager" value={role} onChange={setRole} />
            </>
          )}
          <Field label="Work Email" type="email" placeholder="you@company.com" value={email} onChange={setEmail} />
          <Field label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} />

          <button
            type="button"
            onClick={handleAuth}
            className="spec-link w-full rounded-md px-4 py-2.5 text-sm font-semibold text-center"
          >
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-xs text-zinc-400">
          {mode === "signin" ? "Need access? Create an account." : "Already have an account? Switch to Sign In."}
        </div>
        <div className="mt-6 text-xs">
          <Link href="/" className="spec-link">
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
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-[#090909] px-3 py-2 text-sm text-zinc-100"
        placeholder={placeholder}
      />
    </label>
  );
}
