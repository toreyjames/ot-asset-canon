"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CHEMICAL_PLANT_ASSETS } from "@/data/chemical-plant-assets";

// Dynamic import for Three.js components
const Plant3DView = dynamic(() => import("@/components/canon/Plant3DView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-400">Loading 3D view...</div>
    </div>
  ),
});

// Demo site data - in production this would come from the database
const DEMO_SITE = {
  id: "1",
  slug: "houston-plant",
  name: "Houston Plant",
  location: "Houston, TX",
  inferredPlantType: "Petrochemical",
  plantTypeConfidence: 87,
  assetCount: 156,
  gapCount: 7,
  reconstructionScore: 84,
  canRunPlant: true,
  lastDataIngestion: "2024-02-15T14:30:00Z",
  layerScores: [
    { layer: 1, score: 64, status: "partial", gapCount: 3 },
    { layer: 2, score: 94, status: "partial", gapCount: 2 },
    { layer: 3, score: 100, status: "complete", gapCount: 0 },
    { layer: 4, score: 78, status: "partial", gapCount: 2 },
    { layer: 5, score: 92, status: "partial", gapCount: 0 },
    { layer: 6, score: 85, status: "partial", gapCount: 0 },
  ],
};

const LAYER_NAMES = ["", "Physical Process", "Instrumentation", "Control Systems", "Operations", "Network", "Enterprise"];

type ViewMode = "3d" | "process" | "network";

export default function SiteOverview() {
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const site = DEMO_SITE;

  const scoreColor =
    site.reconstructionScore >= 90
      ? "text-green-600"
      : site.reconstructionScore >= 70
        ? "text-amber-600"
        : "text-red-600";

  const scoreBg =
    site.reconstructionScore >= 90
      ? "bg-green-100"
      : site.reconstructionScore >= 70
        ? "bg-amber-100"
        : "bg-red-100";

  return (
    <div className="h-full flex flex-col">
      {/* Main 3D View Area */}
      <div className="relative flex-1 min-h-0">
        {/* View Mode Tabs */}
        <div className="absolute top-4 left-4 z-10 flex bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          {[
            { id: "3d" as const, label: "3D Model" },
            { id: "process" as const, label: "Process Flow" },
            { id: "network" as const, label: "Network" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reconstruction Score Overlay */}
        <div className="absolute top-4 right-4 z-10 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Reconstruction Score
          </div>
          <div className={`text-4xl font-bold ${scoreColor}`}>
            {site.reconstructionScore}%
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {site.canRunPlant ? (
              <span className="text-green-600 font-medium">Ready to run</span>
            ) : (
              <span className="text-red-600 font-medium">Gaps blocking</span>
            )}
          </div>
        </div>

        {/* Plant Identity Overlay */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg ${scoreBg} flex items-center justify-center`}>
              <svg className={`w-6 h-6 ${scoreColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Inferred: {site.inferredPlantType}
              </div>
              <div className="text-xs text-gray-500">
                {site.plantTypeConfidence}% confidence from asset patterns
              </div>
            </div>
          </div>
        </div>

        {/* The 3D View */}
        <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100">
          {viewMode === "3d" && <Plant3DView assets={CHEMICAL_PLANT_ASSETS} />}
          {viewMode === "process" && (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Process flow diagram coming soon
            </div>
          )}
          {viewMode === "network" && (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Network topology view coming soon
            </div>
          )}
        </div>
      </div>

      {/* Layer Completeness Panel */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Layer Completeness</h3>
          <span className="text-xs text-gray-500">{site.assetCount} assets · {site.gapCount} gaps</span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {site.layerScores.map((layer) => (
            <div key={layer.layer} className="text-center">
              <div className="text-xs font-medium text-gray-500 mb-1">L{layer.layer}</div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${
                    layer.status === "complete"
                      ? "bg-green-500"
                      : layer.score >= 70
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${layer.score}%` }}
                />
              </div>
              <div className="text-xs text-gray-600">{layer.score}%</div>
              <div className="text-[10px] text-gray-400 truncate" title={LAYER_NAMES[layer.layer]}>
                {LAYER_NAMES[layer.layer]}
              </div>
              {layer.gapCount > 0 && (
                <div className="text-[10px] text-amber-600 font-medium">{layer.gapCount} gaps</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
