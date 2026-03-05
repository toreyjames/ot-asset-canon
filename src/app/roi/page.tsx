"use client";

import { useMemo, useState } from "react";

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function RoiPage() {
  const [plants, setPlants] = useState(3);
  const [assetsPerPlant, setAssetsPerPlant] = useState(6000);
  const [loadedRate, setLoadedRate] = useState(95);
  const [hoursSavedPerPlant, setHoursSavedPerPlant] = useState(65);
  const [outageAvoidancePerPlant, setOutageAvoidancePerPlant] = useState(45000);
  const [reworkAvoidancePerPlant, setReworkAvoidancePerPlant] = useState(12000);

  const calc = useMemo(() => {
    const annualLaborSavings = plants * hoursSavedPerPlant * loadedRate * 12;
    const annualOutageSavings = plants * outageAvoidancePerPlant;
    const annualReworkSavings = plants * reworkAvoidancePerPlant;
    const annualGrossBenefit = annualLaborSavings + annualOutageSavings + annualReworkSavings;

    const monthlyPlatform = 2500 + Math.max(0, plants - 1) * 1100 + (plants * assetsPerPlant > 50000 ? 2500 : 0);
    const annualCost = monthlyPlatform * 12;
    const netAnnualValue = annualGrossBenefit - annualCost;
    const roiPercent = annualCost > 0 ? Math.round((netAnnualValue / annualCost) * 100) : 0;
    const paybackMonths = annualGrossBenefit > 0 ? Number((annualCost / (annualGrossBenefit / 12)).toFixed(1)) : 0;

    return {
      annualLaborSavings,
      annualOutageSavings,
      annualReworkSavings,
      annualGrossBenefit,
      annualCost,
      netAnnualValue,
      roiPercent,
      paybackMonths,
    };
  }, [plants, assetsPerPlant, loadedRate, hoursSavedPerPlant, outageAvoidancePerPlant, reworkAvoidancePerPlant]);

  return (
    <div className="min-h-screen bg-[#060b16] text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-4xl font-semibold tracking-tight">PlantTrace ROI Model</h1>
        <p className="mt-3 text-slate-300 max-w-3xl">
          Estimate ROI by plant count and asset scope. This model quantifies wasted work and waste avoidance:
          labor recovered, outage exposure reduced, and CMDB/data rework eliminated.
        </p>

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-5">
            <h2 className="text-xl font-semibold">Assumptions</h2>

            <RangeInput label={`Plants (${plants})`} min={1} max={25} step={1} value={plants} onChange={setPlants} />
            <RangeInput
              label={`Assets per plant (${assetsPerPlant.toLocaleString()})`}
              min={1000}
              max={50000}
              step={500}
              value={assetsPerPlant}
              onChange={setAssetsPerPlant}
            />
            <RangeInput label={`Loaded labor rate (${formatMoney(loadedRate)}/hr)`} min={50} max={220} step={5} value={loadedRate} onChange={setLoadedRate} />
            <RangeInput
              label={`Hours saved per plant/month (${hoursSavedPerPlant})`}
              min={10}
              max={240}
              step={5}
              value={hoursSavedPerPlant}
              onChange={setHoursSavedPerPlant}
            />
            <RangeInput
              label={`Annual outage loss avoided per plant (${formatMoney(outageAvoidancePerPlant)})`}
              min={0}
              max={300000}
              step={5000}
              value={outageAvoidancePerPlant}
              onChange={setOutageAvoidancePerPlant}
            />
            <RangeInput
              label={`Annual data rework avoided per plant (${formatMoney(reworkAvoidancePerPlant)})`}
              min={0}
              max={120000}
              step={2000}
              value={reworkAvoidancePerPlant}
              onChange={setReworkAvoidancePerPlant}
            />
          </div>

          <div className="rounded-xl border border-cyan-700/60 bg-cyan-900/20 p-6">
            <h2 className="text-xl font-semibold">Projected Annual ROI</h2>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Labor Savings" value={formatMoney(calc.annualLaborSavings)} />
              <Stat label="Outage Avoidance" value={formatMoney(calc.annualOutageSavings)} />
              <Stat label="Rework Avoidance" value={formatMoney(calc.annualReworkSavings)} />
              <Stat label="Gross Benefit" value={formatMoney(calc.annualGrossBenefit)} accent />
              <Stat label="PlantTrace Cost" value={formatMoney(calc.annualCost)} />
              <Stat label="Net Annual Value" value={formatMoney(calc.netAnnualValue)} accent />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wider">ROI</div>
                <div className="text-3xl font-semibold text-cyan-300 mt-1">{calc.roiPercent}%</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wider">Payback</div>
                <div className="text-3xl font-semibold text-cyan-300 mt-1">{calc.paybackMonths} mo</div>
              </div>
            </div>

            <p className="mt-6 text-xs text-slate-400">
              This model is directional. Final ROI depends on data quality, baseline process maturity, remediation speed,
              and integration depth.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeInput({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm text-slate-200 mb-2">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${accent ? "text-cyan-300" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
