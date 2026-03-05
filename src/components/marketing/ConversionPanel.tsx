"use client";

import { FormEvent, useMemo, useState } from "react";

type Plan = "starter" | "growth" | "enterprise";
type Goal = "labor_reduction" | "outage_reduction" | "cmdb_quality";
type Payback = "lt_6" | "6_12" | "gt_12";
type BudgetBand = "up_to_10" | "10_20" | "20_plus";

type PlantOption = { label: string; value: number };
type AssetOption = { label: string; value: number | null };

const PLANT_OPTIONS: PlantOption[] = [
  { label: "1 Plant", value: 1 },
  { label: "3 Plants", value: 3 },
  { label: "8 Plants", value: 8 },
  { label: "12+ Plants", value: 12 },
];

const ASSET_OPTIONS: AssetOption[] = [
  { label: "5k assets", value: 5000 },
  { label: "18k assets", value: 18000 },
  { label: "50k assets", value: 50000 },
  { label: "100k assets", value: 100000 },
  { label: "No Idea", value: null },
];

export default function ConversionPanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [plants, setPlants] = useState<number>(PLANT_OPTIONS[1].value);
  const [assets, setAssets] = useState<number | null>(ASSET_OPTIONS[1].value);
  const [plan, setPlan] = useState<Plan>("growth");
  const [goal, setGoal] = useState<Goal>("labor_reduction");
  const [payback, setPayback] = useState<Payback>("lt_6");
  const [budgetBand, setBudgetBand] = useState<BudgetBand>("10_20");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimatedMonthly = useMemo(() => {
    const base = plan === "starter" ? 2500 : plan === "growth" ? 8500 : 18000;
    const plantFactor = Math.max(0, plants - 1) * (plan === "starter" ? 900 : 1200);
    const assetFactor = assets === null ? 0 : assets > 50000 ? 2500 : assets > 20000 ? 1200 : 0;
    return base + plantFactor + assetFactor;
  }, [plan, plants, assets]);

  const engagementFit = useMemo(() => {
    if (plan === "starter") return "Pilot Fit";
    if (plan === "enterprise") return "Enterprise Fit";
    return "Program Fit";
  }, [plan]);

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
          plants,
          assets,
          assetsUnknown: assets === null,
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
      <h3 className="text-2xl font-semibold text-white headline-display">Tell Us Where To Start</h3>
      <p className="mt-1 text-sm text-slate-300">Two minutes. No decks. No procurement maze.</p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Full Name" value={name} onChange={setName} required />
          <Input label="Work Email" value={email} onChange={setEmail} required type="email" />
          <Input label="Company" value={company} onChange={setCompany} required />
        </div>

        <ChoiceRow
          label="Plant Count"
          value={String(plants)}
          options={PLANT_OPTIONS.map((p) => ({ label: p.label, value: String(p.value) }))}
          onChange={(value) => setPlants(Number(value))}
        />

        <ChoiceRow
          label="Asset Count"
          value={assets === null ? "unknown" : String(assets)}
          options={ASSET_OPTIONS.map((a) => ({ label: a.label, value: a.value === null ? "unknown" : String(a.value) }))}
          onChange={(value) => setAssets(value === "unknown" ? null : Number(value))}
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
          <div className="text-slate-400">Suggested Engagement Path</div>
          <div className="mt-1 text-2xl font-semibold text-cyan-300">{engagementFit}</div>
          <div className="mt-1 text-xs text-slate-400">Pricing is scoped after discovery and requirements alignment.</div>
        </div>

        {error && <div className="text-sm text-red-300">{error}</div>}
        {submitted && <div className="text-sm text-emerald-300">Intake submitted. We will follow up with a scoped plan and next steps.</div>}

        <div className="flex flex-wrap gap-2 pt-1 items-center">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300 disabled:opacity-70"
          >
            {loading ? "Submitting..." : "Submit Intake"}
          </button>
          <div className="text-xs text-slate-400">
            No payment on this page. We align scope first, then move to formal proposal.
          </div>
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
