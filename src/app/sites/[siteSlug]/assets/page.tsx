"use client";

import { useState } from "react";

// Demo assets data
const DEMO_ASSETS = [
  { id: "1", tagNumber: "R-101", name: "Primary Reactor", type: "Vessel", layer: 1, status: "verified", lastSeen: "2024-02-15" },
  { id: "2", tagNumber: "P-101A", name: "Feed Pump A", type: "Pump", layer: 1, status: "verified", lastSeen: "2024-02-15" },
  { id: "3", tagNumber: "P-101B", name: "Feed Pump B (Spare)", type: "Pump", layer: 1, status: "inferred", lastSeen: null },
  { id: "4", tagNumber: "TT-101", name: "Reactor Temp Transmitter", type: "Transmitter", layer: 2, status: "verified", lastSeen: "2024-02-15" },
  { id: "5", tagNumber: "PT-101", name: "Reactor Pressure Transmitter", type: "Transmitter", layer: 2, status: "verified", lastSeen: "2024-02-15" },
  { id: "6", tagNumber: "LT-101", name: "Reactor Level Transmitter", type: "Transmitter", layer: 2, status: "verified", lastSeen: "2024-02-15" },
  { id: "7", tagNumber: "TV-101", name: "Temp Control Valve", type: "Valve", layer: 2, status: "verified", lastSeen: "2024-02-15" },
  { id: "8", tagNumber: "PLC-101", name: "Reactor Controller", type: "PLC", layer: 3, status: "verified", lastSeen: "2024-02-15" },
  { id: "9", tagNumber: "PLC-102", name: "Utility Controller", type: "PLC", layer: 3, status: "verified", lastSeen: "2024-02-15" },
  { id: "10", tagNumber: "HMI-01", name: "Control Room HMI", type: "HMI", layer: 4, status: "verified", lastSeen: "2024-02-15" },
  { id: "11", tagNumber: "HIST-01", name: "Process Historian", type: "Server", layer: 4, status: "verified", lastSeen: "2024-02-15" },
  { id: "12", tagNumber: "SW-01", name: "Control Network Switch", type: "Switch", layer: 5, status: "verified", lastSeen: "2024-02-15" },
];

const LAYER_NAMES = ["", "Physical", "Instrumentation", "Control", "Operations", "Network", "Enterprise"];

export default function AssetsPage() {
  const [layerFilter, setLayerFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAssets = DEMO_ASSETS.filter((asset) => {
    if (layerFilter !== null && asset.layer !== layerFilter) return false;
    if (statusFilter && asset.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        asset.tagNumber.toLowerCase().includes(query) ||
        asset.name.toLowerCase().includes(query) ||
        asset.type.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Asset Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">
          All discovered and inferred assets for this site
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by tag, name, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Layer Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Layer:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setLayerFilter(null)}
              className={`px-2 py-1 text-xs font-medium rounded ${
                layerFilter === null ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {[1, 2, 3, 4, 5, 6].map((layer) => (
              <button
                key={layer}
                onClick={() => setLayerFilter(layer)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  layerFilter === layer ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                L{layer}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <div className="flex gap-1">
            {[null, "verified", "inferred"].map((status) => (
              <button
                key={status || "all"}
                onClick={() => setStatusFilter(status)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  statusFilter === status ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status || "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500 mb-4">
        Showing {filteredAssets.length} of {DEMO_ASSETS.length} assets
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tag</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Layer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAssets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-medium text-blue-600">{asset.tagNumber}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{asset.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{asset.type}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    L{asset.layer} · {LAYER_NAMES[asset.layer]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    asset.status === "verified"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {asset.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {asset.lastSeen || <span className="text-gray-400">Never</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
