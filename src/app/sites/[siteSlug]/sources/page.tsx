"use client";

import { useState } from "react";

// Demo data sources
const DEMO_SOURCES = [
  {
    id: "1",
    name: "Claroty CTD",
    sourceType: "collector",
    vendor: "Claroty",
    isCollector: true,
    collectorLocation: "Control Network SPAN Port",
    confidenceWeight: 95,
    assetCount: 142,
    coverageZones: ["Control Network", "Safety System"],
    lastSync: "2024-02-15T14:30:00Z",
    syncStatus: "active",
    syncFrequency: "realtime",
  },
  {
    id: "2",
    name: "PI Historian",
    sourceType: "historian",
    vendor: "OSIsoft",
    isCollector: false,
    confidenceWeight: 85,
    assetCount: 2341,
    coverageZones: null,
    lastSync: "2024-02-15T06:00:00Z",
    syncStatus: "active",
    syncFrequency: "daily",
  },
  {
    id: "3",
    name: "P&ID Package Rev 3",
    sourceType: "engineering",
    vendor: null,
    isCollector: false,
    confidenceWeight: 70,
    assetCount: 186,
    coverageZones: null,
    lastSync: "2024-01-20T00:00:00Z",
    syncStatus: "active",
    syncFrequency: "manual",
  },
  {
    id: "4",
    name: "Maintenance Work Orders",
    sourceType: "maintenance",
    vendor: "SAP PM",
    isCollector: false,
    confidenceWeight: 50,
    assetCount: 89,
    coverageZones: null,
    lastSync: "2024-02-14T00:00:00Z",
    syncStatus: "active",
    syncFrequency: "daily",
  },
  {
    id: "5",
    name: "Firewall Logs",
    sourceType: "network",
    vendor: "Palo Alto",
    isCollector: false,
    confidenceWeight: 60,
    assetCount: 45,
    coverageZones: ["DMZ", "Enterprise"],
    lastSync: "2024-02-15T14:00:00Z",
    syncStatus: "active",
    syncFrequency: "realtime",
  },
  {
    id: "6",
    name: "Nozomi Guardian",
    sourceType: "collector",
    vendor: "Nozomi Networks",
    isCollector: true,
    collectorLocation: "DMZ Network Tap",
    confidenceWeight: 90,
    assetCount: 38,
    coverageZones: ["DMZ"],
    lastSync: "2024-02-15T14:25:00Z",
    syncStatus: "active",
    syncFrequency: "realtime",
  },
];

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  collector: { label: "OT Collector", color: "bg-green-100 text-green-700", icon: "C" },
  historian: { label: "Historian", color: "bg-blue-100 text-blue-700", icon: "H" },
  engineering: { label: "Engineering", color: "bg-purple-100 text-purple-700", icon: "E" },
  network: { label: "Network", color: "bg-orange-100 text-orange-700", icon: "N" },
  maintenance: { label: "Maintenance", color: "bg-gray-100 text-gray-700", icon: "M" },
  manual: { label: "Manual", color: "bg-gray-100 text-gray-500", icon: "+" },
};

export default function SourcesPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);

  const filteredSources = filterType
    ? DEMO_SOURCES.filter((s) => s.sourceType === filterType)
    : DEMO_SOURCES;

  const collectors = DEMO_SOURCES.filter((s) => s.isCollector);
  const totalAssets = DEMO_SOURCES.reduce((sum, s) => sum + s.assetCount, 0);
  const avgConfidence = Math.round(
    DEMO_SOURCES.reduce((sum, s) => sum + s.confidenceWeight, 0) / DEMO_SOURCES.length
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Data Sources</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage where asset data comes from and configure confidence weights
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Source
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Sources</div>
          <div className="text-2xl font-bold text-gray-900">{DEMO_SOURCES.length}</div>
          <div className="text-xs text-gray-400 mt-1">{collectors.length} collectors</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Asset References</div>
          <div className="text-2xl font-bold text-gray-900">{totalAssets.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Across all sources</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Avg. Confidence</div>
          <div className="text-2xl font-bold text-gray-900">{avgConfidence}%</div>
          <div className="text-xs text-gray-400 mt-1">Weighted by source type</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="text-sm text-green-600">Active Collectors</div>
          <div className="text-2xl font-bold text-green-700">{collectors.length}</div>
          <div className="text-xs text-green-600 mt-1">Real-time monitoring</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Filter:</span>
        <button
          onClick={() => setFilterType(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
            filterType === null ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {Object.entries(SOURCE_TYPE_CONFIG).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              filterType === type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Sources List */}
      <div className="space-y-3">
        {filteredSources.map((source) => {
          const config = SOURCE_TYPE_CONFIG[source.sourceType];
          return (
            <div
              key={source.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg ${config.color} flex items-center justify-center text-lg font-bold`}>
                    {config.icon}
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{source.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      {source.isCollector && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Collector
                        </span>
                      )}
                    </div>
                    {source.vendor && (
                      <div className="text-sm text-gray-500 mt-0.5">{source.vendor}</div>
                    )}
                    {source.collectorLocation && (
                      <div className="text-xs text-gray-400 mt-1">
                        Location: {source.collectorLocation}
                      </div>
                    )}
                    {source.coverageZones && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-gray-400">Covers:</span>
                        {source.coverageZones.map((zone) => (
                          <span key={zone} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {zone}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-6">
                  {/* Asset Count */}
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">{source.assetCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">assets</div>
                  </div>

                  {/* Confidence */}
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            source.confidenceWeight >= 80
                              ? "bg-green-500"
                              : source.confidenceWeight >= 60
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${source.confidenceWeight}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{source.confidenceWeight}%</span>
                    </div>
                    <div className="text-xs text-gray-400">confidence</div>
                  </div>

                  {/* Sync Status */}
                  <div className="text-right min-w-[100px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        source.syncStatus === "active" ? "bg-green-500" : "bg-red-500"
                      }`} />
                      <span className="text-sm text-gray-700 capitalize">{source.syncFrequency}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(source.lastSync).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confidence Guide */}
      <div className="mt-8 bg-blue-50 rounded-xl border border-blue-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Confidence Weight Guide</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-700">High Confidence (80-100%)</div>
            <div className="text-gray-500 mt-1">
              OT collectors, historian databases - direct observation of network traffic or process data
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-700">Medium Confidence (50-79%)</div>
            <div className="text-gray-500 mt-1">
              Engineering documents, firewall logs - accurate but may be outdated or incomplete
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-700">Low Confidence (0-49%)</div>
            <div className="text-gray-500 mt-1">
              Maintenance records, manual entry - useful for cross-reference but not authoritative
            </div>
          </div>
        </div>
      </div>

      {/* Add Source Modal (simplified) */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Data Source</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Select type...</option>
                    <option value="collector">OT Collector (Claroty, Dragos, Nozomi)</option>
                    <option value="historian">Historian (PI, Honeywell PHD)</option>
                    <option value="engineering">Engineering Documents (P&IDs, I/O Lists)</option>
                    <option value="network">Network Data (Firewall, Switch)</option>
                    <option value="maintenance">Maintenance System (SAP, Maximo)</option>
                    <option value="manual">Manual / JSON Upload</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Claroty CTD - Control Network"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Claroty, OSIsoft"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Weight: <span className="font-bold">75%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="75"
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Low (manual data)</span>
                    <span>High (direct observation)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Add Source
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
