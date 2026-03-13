"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessState, setAccessState, setOnboardingState } from "@/lib/access";

const INDUSTRIES = [
  "Automotive",
  "Energy & Utilities",
  "Oil & Gas",
  "Chemicals",
  "Pharma & Life Sciences",
  "Defense & Aerospace",
  "Manufacturing",
  "Mining & Metals",
];

export default function OnboardingPage() {
  const router = useRouter();
  const access = useMemo(() => getAccessState(), []);
  const [company, setCompany] = useState(access.company || "");
  const [industry, setIndustry] = useState("Automotive");
  const [objective, setObjective] = useState<"mission_map" | "industry_tracker">("mission_map");
  const [privacyMode, setPrivacyMode] = useState<"private_by_default" | "shared_demo">("private_by_default");

  function continueFlow() {
    const nextCompany = company.trim();
    if (!nextCompany) return;

    setAccessState({
      ...access,
      loggedIn: true,
      company: nextCompany,
    });

    setOnboardingState({
      completed: true,
      company: nextCompany,
      industry,
      objective,
      privacyMode,
    });

    if (objective === "mission_map") {
      router.push(`/ingest?orgSlug=${encodeURIComponent(nextCompany.toLowerCase().replace(/\s+/g, "-"))}`);
      return;
    }
    router.push("/industrial-tracker/coverage");
  }

  return (
    <div className="industrial-spec min-h-screen bg-[#060606] text-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="spec-block p-6">
          <p className="spec-eyebrow">Client Onboarding</p>
          <h1 className="spec-title mt-2">Start With Your Business Context</h1>
          <p className="spec-body mt-3 max-w-2xl">
            Baseload is private by default. We scope to your company first, then optionally add external industry context.
          </p>
        </section>

        <section className="spec-block p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company" value={company} onChange={setCompany} placeholder="Toyota North America" />
            <label className="block">
              <span className="text-xs text-zinc-400">Industry</span>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-[#090909] px-3 py-2 text-sm text-zinc-100"
              >
                {INDUSTRIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ChoiceCard
              active={objective === "mission_map"}
              title="Mission Map First"
              subtitle="Start with your plant/site assessment and internal data."
              onClick={() => setObjective("mission_map")}
            />
            <ChoiceCard
              active={objective === "industry_tracker"}
              title="Industry Context First"
              subtitle="Start with external market signals and opportunity coverage."
              onClick={() => setObjective("industry_tracker")}
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ChoiceCard
              active={privacyMode === "private_by_default"}
              title="Private By Default"
              subtitle="Only your workspace and your uploads are visible."
              onClick={() => setPrivacyMode("private_by_default")}
            />
            <ChoiceCard
              active={privacyMode === "shared_demo"}
              title="Demo Shared Context"
              subtitle="Includes broader national context for demo storytelling."
              onClick={() => setPrivacyMode("shared_demo")}
            />
          </div>

          <button
            type="button"
            onClick={continueFlow}
            disabled={!company.trim()}
            className="spec-link mt-6 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-center disabled:opacity-50"
          >
            Continue
          </button>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-[#090909] px-3 py-2 text-sm text-zinc-100"
        placeholder={placeholder}
      />
    </label>
  );
}

function ChoiceCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border p-3 text-left transition ${
        active ? "border-cyan-400 bg-cyan-500/10" : "border-zinc-700 bg-[#090909] hover:border-zinc-500"
      }`}
    >
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{subtitle}</div>
    </button>
  );
}
