"use client";

import { useState } from "react";

// Demo gaps data
const DEMO_GAPS = [
  {
    id: "1",
    gapType: "missing_equipment",
    severity: "critical",
    status: "open",
    title: "Missing spare feed pump",
    description: "Engineering drawings show P-101B (spare pump) but no asset data found. Critical for operational continuity.",
    layer: 1,
    affectedTags: ["P-101B"],
    suggestedAction: "Verify if spare pump exists physically and add to inventory, or update P&ID if removed.",
    detectedAt: "2024-02-10",
  },
  {
    id: "2",
    gapType: "missing_instrumentation",
    severity: "critical",
    title: "No SIS transmitter found",
    description: "Safety Instrumented System requires independent temperature transmitter per SIL2 design. None found in data.",
    layer: 2,
    status: "open",
    affectedTags: ["TT-101-SIS"],
    suggestedAction: "Confirm SIS transmitter exists and add to asset inventory for accurate safety assessment.",
    detectedAt: "2024-02-10",
  },
  {
    id: "3",
    gapType: "network_unknown",
    severity: "major",
    title: "Controller network path unknown",
    description: "PLC-101 communicates with historian but network topology between them is not documented.",
    layer: 5,
    status: "open",
    affectedTags: ["PLC-101", "HIST-01"],
    suggestedAction: "Document network path and intermediate switches between control and operations layers.",
    detectedAt: "2024-02-12",
  },
  {
    id: "4",
    gapType: "missing_equipment",
    severity: "critical",
    title: "Cooling water system incomplete",
    description: "Heat exchanger E-101 referenced in reactor cooling loop but no associated pumps or valves found.",
    layer: 1,
    status: "open",
    affectedTags: ["E-101", "P-CW-*"],
    suggestedAction: "Import cooling water system assets or add manually to complete process flow.",
    detectedAt: "2024-02-08",
  },
  {
    id: "5",
    gapType: "firmware_unknown",
    severity: "major",
    title: "PLC firmware version unknown",
    description: "PLC-102 discovered but firmware version not captured. Required for vulnerability assessment.",
    layer: 3,
    status: "dismissed",
    dismissedReason: "Legacy system - vendor no longer provides updates. Compensating controls in place.",
    affectedTags: ["PLC-102"],
    suggestedAction: "Document current firmware version if accessible.",
    detectedAt: "2024-02-05",
  },
  {
    id: "6",
    gapType: "missing_documentation",
    severity: "minor",
    title: "HMI screen mapping incomplete",
    description: "HMI-01 screens reference 12 additional tags not found in asset database.",
    layer: 4,
    status: "open",
    affectedTags: ["HMI-01"],
    suggestedAction: "Review HMI configuration and add referenced tags to inventory.",
    detectedAt: "2024-02-14",
  },
  {
    id: "7",
    gapType: "configuration_gap",
    severity: "major",
    title: "Historian retention unknown",
    description: "HIST-01 data retention policy not documented. May affect incident investigation capability.",
    layer: 4,
    status: "open",
    affectedTags: ["HIST-01"],
    suggestedAction: "Document data retention settings and verify against compliance requirements.",
    detectedAt: "2024-02-13",
  },
];

export default function GapsPage() {
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const filteredGaps = DEMO_GAPS.filter((gap) => {
    if (severityFilter && gap.severity !== severityFilter) return false;
    if (statusFilter && gap.status !== statusFilter) return false;
    return true;
  });

  const openGaps = DEMO_GAPS.filter((g) => g.status === "open");
  const criticalCount = openGaps.filter((g) => g.severity === "critical").length;
  const majorCount = openGaps.filter((g) => g.severity === "major").length;
  const minorCount = openGaps.filter((g) => g.severity === "minor").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reconstruction Gaps</h1>
        <p className="text-sm text-gray-500 mt-1">
          Issues preventing complete plant reconstruction
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Open Gaps</div>
          <div className="text-2xl font-bold text-gray-900">{openGaps.length}</div>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <div className="text-sm text-red-600">Critical</div>
          <div className="text-2xl font-bold text-red-700">{criticalCount}</div>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="text-sm text-amber-600">Major</div>
          <div className="text-2xl font-bold text-amber-700">{majorCount}</div>
        </div>
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Minor</div>
          <div className="text-2xl font-bold text-gray-700">{minorCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <div className="flex gap-1">
            {["open", "dismissed", "resolved"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
                className={`px-3 py-1 text-xs font-medium rounded capitalize ${
                  statusFilter === status ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Severity:</span>
          <div className="flex gap-1">
            {[null, "critical", "major", "minor"].map((severity) => (
              <button
                key={severity || "all"}
                onClick={() => setSeverityFilter(severity)}
                className={`px-3 py-1 text-xs font-medium rounded capitalize ${
                  severityFilter === severity ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {severity || "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gaps List */}
      <div className="space-y-4">
        {filteredGaps.map((gap) => (
          <div
            key={gap.id}
            className={`bg-white rounded-xl border p-5 ${
              gap.status === "dismissed" ? "opacity-60" : ""
            } ${
              gap.severity === "critical"
                ? "border-red-200"
                : gap.severity === "major"
                  ? "border-amber-200"
                  : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  gap.severity === "critical"
                    ? "bg-red-100 text-red-700"
                    : gap.severity === "major"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700"
                }`}>
                  {gap.severity}
                </span>
                <h3 className="font-semibold text-gray-900">{gap.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">L{gap.layer}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  gap.status === "open"
                    ? "bg-blue-100 text-blue-700"
                    : gap.status === "dismissed"
                      ? "bg-gray-100 text-gray-500"
                      : "bg-green-100 text-green-700"
                }`}>
                  {gap.status}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-3">{gap.description}</p>

            {gap.dismissedReason && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                <div className="text-xs font-medium text-gray-500">Dismissed reason:</div>
                <div className="text-sm text-gray-600">{gap.dismissedReason}</div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Affected:</span>
                {gap.affectedTags.map((tag) => (
                  <span key={tag} className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="text-xs text-gray-400">Detected {gap.detectedAt}</div>
            </div>

            {gap.status === "open" && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-1">Suggested action:</div>
                <div className="text-sm text-gray-700">{gap.suggestedAction}</div>
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">
                    Resolve Gap
                  </button>
                  <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredGaps.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No gaps matching current filters
          </div>
        )}
      </div>
    </div>
  );
}
