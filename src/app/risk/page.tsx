"use client";

import { useState } from "react";

interface ZoneScore {
  zone: string;
  baseRisk: number;
  expectedPosture: number;
  actualPosture: number;
  judgment: "overspend" | "proportional" | "underspend" | "structural_mismatch";
  gapMagnitude: number;
  criticalAssets: number;
  openCVEs: number;
  recommendations: string[];
}

// Sample data - in production this comes from Build Clock analysis
const SAMPLE_SCORES: ZoneScore[] = [
  {
    zone: "Reactor Section (R-101)",
    baseRisk: 95,
    expectedPosture: 90,
    actualPosture: 62,
    judgment: "underspend",
    gapMagnitude: 28,
    criticalAssets: 12,
    openCVEs: 47,
    recommendations: [
      "Implement network segmentation for safety controllers",
      "Deploy passive OT monitoring on VLAN 40",
      "Establish firmware update schedule for C300 controllers",
      "Add redundant temperature monitoring path",
    ],
  },
  {
    zone: "Process Control Zone",
    baseRisk: 78,
    expectedPosture: 75,
    actualPosture: 71,
    judgment: "proportional",
    gapMagnitude: 4,
    criticalAssets: 8,
    openCVEs: 23,
    recommendations: [
      "Continue current monitoring program",
      "Schedule quarterly access reviews",
    ],
  },
  {
    zone: "Engineering Workstations",
    baseRisk: 82,
    expectedPosture: 80,
    actualPosture: 45,
    judgment: "underspend",
    gapMagnitude: 35,
    criticalAssets: 4,
    openCVEs: 89,
    recommendations: [
      "Implement application whitelisting",
      "Remove vendor VPN access or add MFA",
      "Deploy endpoint detection on EWS systems",
      "Restrict ability to modify safety system logic",
    ],
  },
  {
    zone: "Historian & Data Zone",
    baseRisk: 45,
    expectedPosture: 50,
    actualPosture: 67,
    judgment: "overspend",
    gapMagnitude: -17,
    criticalAssets: 2,
    openCVEs: 12,
    recommendations: [
      "Consider reallocating security resources to higher-risk zones",
      "Maintain current controls but deprioritize enhancements",
    ],
  },
  {
    zone: "Network Infrastructure",
    baseRisk: 72,
    expectedPosture: 70,
    actualPosture: 68,
    judgment: "proportional",
    gapMagnitude: 2,
    criticalAssets: 6,
    openCVEs: 15,
    recommendations: [
      "Document network architecture for incident response",
      "Implement quarterly firewall rule review",
    ],
  },
  {
    zone: "Enterprise Integration",
    baseRisk: 55,
    expectedPosture: 55,
    actualPosture: 30,
    judgment: "underspend",
    gapMagnitude: 25,
    criticalAssets: 3,
    openCVEs: 34,
    recommendations: [
      "Implement data diode for historian to business network",
      "Review and restrict vendor remote access",
      "Add monitoring at DMZ boundary",
    ],
  },
];

export default function RiskAssessmentPage() {
  const [selectedZone, setSelectedZone] = useState<ZoneScore | null>(null);

  // Calculate overall statistics
  const overallStats = {
    totalCritical: SAMPLE_SCORES.reduce((sum, z) => sum + z.criticalAssets, 0),
    totalCVEs: SAMPLE_SCORES.reduce((sum, z) => sum + z.openCVEs, 0),
    underspentZones: SAMPLE_SCORES.filter((z) => z.judgment === "underspend").length,
    avgGap: Math.round(
      SAMPLE_SCORES.filter((z) => z.judgment === "underspend").reduce(
        (sum, z) => sum + z.gapMagnitude,
        0
      ) / SAMPLE_SCORES.filter((z) => z.judgment === "underspend").length || 0
    ),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Risk Proportionality Assessment
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Build Clock analysis: Is security investment proportional to actual risk?
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Critical Assets"
          value={overallStats.totalCritical.toString()}
          subtitle="Across all zones"
          color="critical"
        />
        <SummaryCard
          title="Open CVEs"
          value={overallStats.totalCVEs.toString()}
          subtitle="Unpatched vulnerabilities"
          color="high"
        />
        <SummaryCard
          title="Underspent Zones"
          value={`${overallStats.underspentZones}/${SAMPLE_SCORES.length}`}
          subtitle="Below required posture"
          color="medium"
        />
        <SummaryCard
          title="Avg Security Gap"
          value={`${overallStats.avgGap}%`}
          subtitle="In underspent zones"
        />
      </div>

      {/* The Four Judgments */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Build Clock: The Four Judgments
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <JudgmentCard
            judgment="proportional"
            title="Proportional"
            description="Investment matches risk appropriately"
            count={SAMPLE_SCORES.filter((z) => z.judgment === "proportional").length}
          />
          <JudgmentCard
            judgment="underspend"
            title="Underspend"
            description="Investment below what risk requires"
            count={SAMPLE_SCORES.filter((z) => z.judgment === "underspend").length}
          />
          <JudgmentCard
            judgment="overspend"
            title="Overspend"
            description="Investment exceeds risk level"
            count={SAMPLE_SCORES.filter((z) => z.judgment === "overspend").length}
          />
          <JudgmentCard
            judgment="structural_mismatch"
            title="Structural Mismatch"
            description="Fundamental misalignment"
            count={SAMPLE_SCORES.filter((z) => z.judgment === "structural_mismatch").length}
          />
        </div>
      </div>

      {/* Zone Assessment Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Zone Risk Proportionality
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {SAMPLE_SCORES.map((zone, i) => (
                <ZoneRow
                  key={i}
                  zone={zone}
                  isSelected={selectedZone?.zone === zone.zone}
                  onSelect={() => setSelectedZone(zone)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Zone Detail */}
        <div>
          {selectedZone ? (
            <ZoneDetail zone={selectedZone} />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <p className="text-center text-gray-500">
                Select a zone to view details and recommendations
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Build Clock Methodology */}
      <div className="mt-8 bg-gradient-to-r from-layer1/10 via-layer3/10 to-layer5/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Build Clock Methodology
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Base Risk Calculation
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Threat landscape × Asset exposure × Consequence severity
            </p>
            <ul className="mt-2 text-xs text-gray-500 space-y-1">
              <li>• Process consequence from HAZOP/LOPA</li>
              <li>• Network exposure from Canon</li>
              <li>• Threat intelligence for sector</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Expected Posture
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              What security investment SHOULD exist given the risk
            </p>
            <ul className="mt-2 text-xs text-gray-500 space-y-1">
              <li>• Risk tier × Asset surface</li>
              <li>• Regulatory requirements</li>
              <li>• Industry benchmarks</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Actual Posture
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              What security investment DOES exist today
            </p>
            <ul className="mt-2 text-xs text-gray-500 space-y-1">
              <li>• Deployed controls from Canon</li>
              <li>• Monitoring coverage</li>
              <li>• Compensating controls</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color?: "critical" | "high" | "medium" | "low";
}) {
  const colorClasses = {
    critical: "border-critical",
    high: "border-high",
    medium: "border-medium",
    low: "border-low",
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
        color ? colorClasses[color] : "border-gray-200"
      }`}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function JudgmentCard({
  judgment,
  title,
  description,
  count,
}: {
  judgment: string;
  title: string;
  description: string;
  count: number;
}) {
  const colors: Record<string, string> = {
    proportional: "bg-green-100 dark:bg-green-900/30 border-green-500",
    underspend: "bg-red-100 dark:bg-red-900/30 border-red-500",
    overspend: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500",
    structural_mismatch: "bg-purple-100 dark:bg-purple-900/30 border-purple-500",
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 ${colors[judgment]}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
        </div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {count}
        </span>
      </div>
    </div>
  );
}

function ZoneRow({
  zone,
  isSelected,
  onSelect,
}: {
  zone: ZoneScore;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const judgmentColors: Record<string, string> = {
    proportional: "text-green-600 bg-green-100",
    underspend: "text-red-600 bg-red-100",
    overspend: "text-yellow-600 bg-yellow-100",
    structural_mismatch: "text-purple-600 bg-purple-100",
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">{zone.zone}</h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>{zone.criticalAssets} critical assets</span>
            <span>{zone.openCVEs} CVEs</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Risk vs Posture Visual */}
          <div className="w-32">
            <div className="flex justify-between text-xs mb-1">
              <span>Risk: {zone.baseRisk}</span>
              <span>Posture: {zone.actualPosture}</span>
            </div>
            <div className="relative h-2 bg-gray-200 dark:bg-gray-600 rounded">
              <div
                className="absolute h-2 bg-red-500 rounded-l"
                style={{ width: `${zone.baseRisk}%` }}
              />
              <div
                className="absolute h-2 bg-green-500 rounded"
                style={{
                  width: `${Math.min(zone.actualPosture, zone.baseRisk)}%`,
                }}
              />
            </div>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              judgmentColors[zone.judgment]
            }`}
          >
            {zone.judgment.replace("_", " ")}
          </span>
        </div>
      </div>
    </button>
  );
}

function ZoneDetail({ zone }: { zone: ZoneScore }) {
  const judgmentColors: Record<string, { bg: string; text: string }> = {
    proportional: { bg: "bg-green-100", text: "text-green-800" },
    underspend: { bg: "bg-red-100", text: "text-red-800" },
    overspend: { bg: "bg-yellow-100", text: "text-yellow-800" },
    structural_mismatch: { bg: "bg-purple-100", text: "text-purple-800" },
  };

  const colors = judgmentColors[zone.judgment];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className={`p-4 ${colors.bg}`}>
        <span className={`text-sm font-medium ${colors.text}`}>
          {zone.judgment.replace("_", " ").toUpperCase()}
        </span>
        <h2 className="text-lg font-bold text-gray-900 mt-1">{zone.zone}</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {zone.baseRisk}
            </p>
            <p className="text-xs text-gray-500">Base Risk</p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {zone.actualPosture}
            </p>
            <p className="text-xs text-gray-500">Actual Posture</p>
          </div>
        </div>

        {/* Gap Analysis */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gap Analysis
          </h3>
          <div className="relative pt-1">
            <div className="flex justify-between text-xs mb-1">
              <span>Expected: {zone.expectedPosture}</span>
              <span
                className={
                  zone.gapMagnitude > 0 ? "text-red-600" : "text-green-600"
                }
              >
                Gap: {zone.gapMagnitude > 0 ? "+" : ""}
                {zone.gapMagnitude}%
              </span>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded relative">
              <div
                className="absolute h-4 bg-green-500 rounded-l"
                style={{ width: `${zone.actualPosture}%` }}
              />
              <div
                className="absolute h-4 w-1 bg-black"
                style={{ left: `${zone.expectedPosture}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Black line = expected posture
            </p>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recommendations
          </h3>
          <ul className="space-y-2">
            {zone.recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="text-layer5 mt-1">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href={`/explorer?zone=${encodeURIComponent(zone.zone)}`}
            className="block w-full text-center px-4 py-2 bg-layer5 hover:bg-blue-700 text-white rounded-md text-sm"
          >
            View Zone Assets
          </a>
          <a
            href={`/ai?q=What are the attack paths to ${zone.zone}?`}
            className="block w-full text-center px-4 py-2 mt-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-sm"
          >
            Analyze Attack Paths
          </a>
        </div>
      </div>
    </div>
  );
}
