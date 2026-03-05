"use client";

import { FormEvent, useMemo, useState } from "react";

type Plan = "starter" | "growth" | "enterprise";
type Goal = "labor_reduction" | "outage_reduction" | "cmdb_quality";
type Payback = "lt_6" | "6_12" | "gt_12";
type BudgetBand = "up_to_10" | "10_20" | "20_plus";

type ScopeBand = { label: string; plants: number; assets: number };

const SCOPE_BANDS: ScopeBand[] = [
  { label: "1 Plant · 5k assets", plants: 1, assets: 5000 },
  { label: "3 Plants · 18k assets", plants: 3, assets: 18000 },
  { label: "8 Plants · 50k assets", plants: 8, assets: 50000 },
  { label: "12+ Plants · 100k assets", plants: 12, assets: 100000 },
];

export default function ConversionPanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [scope, setScope] = useState<ScopeBand>(SCOPE_BANDS[1]);
  const [plan, setPlan] = useState<Plan>("growth");
  const [goal, setGoal] = useState<Goal>("labor_reduction");
  const [payback, setPayback] = useState<Payback>("lt_6");
  const [budgetBand, setBudgetBand] = useState<BudgetBand>("10_20");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  const estimatedMonthly = useMemo(() => {
    const base = plan === "starter" ? 2500 : plan === "growth" ? 8500 : 18000;
    const plantFactor = Math.max(0, scope.plants - 1) * (plan === "starter" ? 900 : 1200);
    const assetFactor = scope.assets > 50000 ? 2500 : scope.assets > 20000 ? 1200 : 0;
    return base + plantFactor + assetFactor;
  }, [plan, scope]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          plants: scope.plants,
          assets: scope.assets,
          plan,
          goal,
          payback,
          budgetBand,
          estimatedMonthly,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit intake");
      setSubmitted(true);
    } catch {
      setError("Unable to submit intake right now. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-700/50 bg-slate-950/80 p-5 md:p-6 shadow-xl shadow-cyan-900/20">
      <h3 className="text-xl font-semibold text-white">Start Commercial Intake</h3>
      <p className="mt-1 text-sm text-slate-300">Mostly click-based qualification. Fast for your team and ours.</p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Full Name" value={name} onChange={setName} required />
          <Input label="Work Email" value={email} onChange={setEmail} required type="email" />
          <Input label="Company" value={company} onChange={setCompany} required />
        </div>

        <ChoiceRow
          label="Scope"
          value={scope.label}
          options={SCOPE_BANDS.map((s) => ({ label: s.label, value: s.label }))}
          onChange={(value) => setScope(SCOPE_BANDS.find((s) => s.label === value) || SCOPE_BANDS[1])}
        />

        <ChoiceRow
          label="Primary ROI Goal"
          value={goal}
          options={[
            { label: "Labor Reduction", value: "labor_reduction" },
            { label: "Outage Reduction", value: "outage_reduction" },
            { label: "CMDB Quality", value: "cmdb_quality" },
          ]}
          onChange={(v) => setGoal(v as Goal)}
        />

        <ChoiceRow
          label="Target Payback"
          value={payback}
          options={[
            { label: "< 6 months", value: "lt_6" },
            { label: "6-12 months", value: "6_12" },
            { label: "12+ months", value: "gt_12" },
          ]}
          onChange={(v) => setPayback(v as Payback)}
        />

        <ChoiceRow
          label="Budget vs Expected Annual Savings"
          value={budgetBand}
          options={[
            { label: "Up to 10%", value: "up_to_10" },
            { label: "10-20%", value: "10_20" },
            { label: "20%+", value: "20_plus" },
          ]}
          onChange={(v) => setBudgetBand(v as BudgetBand)}
        />

        <ChoiceRow
          label="Plan"
          value={plan}
          options={[
            { label: "Starter", value: "starter" },
            { label: "Growth", value: "growth" },
            { label: "Enterprise", value: "enterprise" },
          ]}
          onChange={(v) => setPlan(v as Plan)}
        />

        <div className="rounded-md border border-slate-700 bg-slate-900/80 p-3 text-sm">
          <div className="text-slate-400">Estimated Monthly Platform</div>
          <div className="mt-1 text-2xl font-semibold text-cyan-300">${estimatedMonthly.toLocaleString()}</div>
        </div>

        {error && <div className="text-sm text-red-300">{error}</div>}
        {submitted && <div className="text-sm text-emerald-300">Intake submitted. We will contact you with a scoped ROI plan.</div>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300 disabled:opacity-70"
          >
            {loading ? "Submitting..." : "Submit Intake"}
          </button>

          {paymentLink ? (
            <a
              href={paymentLink}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-md border border-cyan-400/60 text-cyan-100 hover:bg-cyan-500/10"
            >
              Pay Pilot Deposit
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="px-4 py-2 rounded-md border border-slate-700 text-slate-500 cursor-not-allowed"
              title="Set NEXT_PUBLIC_STRIPE_PAYMENT_LINK to enable checkout"
            >
              Payment Link Not Configured
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
      />
    </label>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
              value === option.value
                ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
