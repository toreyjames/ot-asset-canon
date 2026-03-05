"use client";

import { useState } from "react";

const DATA_SOURCES = [
  {
    id: "claroty",
    name: "Claroty",
    description: "Import assets from Claroty CTD or xDome",
    icon: "C",
    color: "bg-blue-600",
  },
  {
    id: "dragos",
    name: "Dragos",
    description: "Import assets from Dragos Platform",
    icon: "D",
    color: "bg-green-600",
  },
  {
    id: "nozomi",
    name: "Nozomi Networks",
    description: "Import assets from Nozomi Guardian",
    icon: "N",
    color: "bg-purple-600",
  },
  {
    id: "qualys",
    name: "Qualys",
    description: "Import asset/security coverage telemetry",
    icon: "T",
    color: "bg-orange-600",
  },
  {
    id: "tanium",
    name: "Tanium",
    description: "Import endpoint visibility and control coverage",
    icon: "Ta",
    color: "bg-emerald-600",
  },
  {
    id: "historian",
    name: "Historian Export",
    description: "Import tag lists from OSIsoft PI or other historians",
    icon: "H",
    color: "bg-gray-600",
  },
  {
    id: "manual",
    name: "Manual / JSON",
    description: "Upload JSON file or enter data manually",
    icon: "+",
    color: "bg-gray-400",
  },
];

export default function ImportPage() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add assets and evidence from OT discovery, engineering systems, and security coverage tools
        </p>
      </div>

      {/* Source Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {DATA_SOURCES.map((source) => (
          <button
            key={source.id}
            onClick={() => setSelectedSource(source.id)}
            className={`p-5 bg-white rounded-xl border-2 text-left transition-all ${
              selectedSource === source.id
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 ${source.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                {source.icon}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{source.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">{source.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Upload Area */}
      {selectedSource && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Upload {DATA_SOURCES.find((s) => s.id === selectedSource)?.name} Export
          </h2>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div className="text-gray-600 mb-2">Drop file here or click to upload</div>
            <div className="text-sm text-gray-400">Supports JSON, CSV, XML</div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Data will be processed and merged with existing assets
            </div>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
              Start Import
            </button>
          </div>
        </div>
      )}

      {/* Recent Imports */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Imports</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-sm font-bold">C</div>
              <div>
                <div className="text-sm font-medium text-gray-900">Claroty Export</div>
                <div className="text-xs text-gray-500">156 assets imported</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">Feb 15, 2024</div>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-white text-sm font-bold">H</div>
              <div>
                <div className="text-sm font-medium text-gray-900">PI Historian Tags</div>
                <div className="text-xs text-gray-500">2,341 tags mapped</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">Feb 12, 2024</div>
          </div>
        </div>
      </div>
    </div>
  );
}
