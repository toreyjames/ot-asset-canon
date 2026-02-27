"use client";

import { useState } from "react";

type IngestionSource =
  | "claroty"
  | "dragos"
  | "nozomi"
  | "nessus"
  | "qualys"
  | "tenable"
  | "manual";

interface IngestionResult {
  jobId: string;
  status: string;
  assetsCreated: number;
  assetsUpdated: number;
  errors: string[];
}

export default function IngestPage() {
  const [source, setSource] = useState<IngestionSource>("claroty");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", source);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ingestion failed");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const sources: { value: IngestionSource; label: string; description: string }[] = [
    {
      value: "claroty",
      label: "Claroty",
      description: "OT asset discovery platform export (CSV or JSON)",
    },
    {
      value: "dragos",
      label: "Dragos",
      description: "Dragos Platform asset export",
    },
    {
      value: "nozomi",
      label: "Nozomi Networks",
      description: "Guardian/Vantage asset export",
    },
    {
      value: "nessus",
      label: "Nessus",
      description: "Tenable Nessus vulnerability scan results",
    },
    {
      value: "qualys",
      label: "Qualys",
      description: "Qualys vulnerability scan export",
    },
    {
      value: "tenable",
      label: "Tenable.io/sc",
      description: "Tenable Security Center export",
    },
    {
      value: "manual",
      label: "Manual Entry",
      description: "JSON file with Canon asset format",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Data Ingestion
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Import assets from OT discovery tools, vulnerability scanners, or manual entry
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upload Asset Data
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                {sources.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSource(s.value)}
                    className={`p-3 text-left rounded-lg border-2 transition-colors ${
                      source === s.value
                        ? "border-layer5 bg-layer5/10"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      {s.label}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {s.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File
              </label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-layer5 hover:text-blue-700"
                >
                  {file ? (
                    <span className="text-gray-900 dark:text-white">{file.name}</span>
                  ) : (
                    <>
                      <span className="font-medium">Click to upload</span>
                      <span className="text-gray-500"> or drag and drop</span>
                    </>
                  )}
                </label>
                <p className="mt-1 text-xs text-gray-500">CSV or JSON up to 50MB</p>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!file || isLoading}
              className="w-full px-4 py-3 bg-layer5 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading ? "Processing..." : "Import Assets"}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">
                Ingestion Complete
              </h3>
              <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                <p>Job ID: {result.jobId}</p>
                <p>Status: {result.status}</p>
                <p>Assets Created: {result.assetsCreated}</p>
                <p>Assets Updated: {result.assetsUpdated}</p>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-yellow-700 dark:text-yellow-300">
                      Errors ({result.errors.length}):
                    </p>
                    <ul className="list-disc list-inside text-xs">
                      {result.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Canon Data Sources */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Canon Data Sources
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The Canon converges data from sources that already exist in most organizations
            </p>

            <div className="space-y-3">
              <DataSourceGroup
                title="Engineering Data"
                sources={[
                  "P&IDs (Piping & Instrumentation Diagrams)",
                  "HAZOP/LOPA studies",
                  "Instrument index",
                  "Cause & effect matrices",
                ]}
              />
              <DataSourceGroup
                title="OT/Control System Data"
                sources={[
                  "DCS/PLC configuration exports",
                  "Historian tag database",
                  "OT asset discovery tools (Claroty, Dragos, Nozomi)",
                  "Network architecture diagrams",
                ]}
              />
              <DataSourceGroup
                title="IT/Security Data"
                sources={[
                  "CMDB/IT asset management",
                  "Vulnerability scanner results",
                  "Firewall rule sets",
                  "Active Directory / IAM",
                ]}
              />
            </div>
          </div>

          <div className="bg-gradient-to-r from-layer1/10 via-layer3/10 to-layer5/10 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              The Rosetta Stone
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The Canon links sources using shared identifiers:
            </p>
            <ul className="mt-2 text-sm space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-layer1"></span>
                <strong>Instrument tag number</strong> → P&ID, I/O list, historian
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-layer3"></span>
                <strong>Controller identity</strong> → OT config, network IP, CVEs
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-layer5"></span>
                <strong>IP address</strong> → IT asset, firewall rules, monitoring
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataSourceGroup({
  title,
  sources,
}: {
  title: string;
  sources: string[];
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {title}
      </h4>
      <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        {sources.map((s, i) => (
          <li key={i}>• {s}</li>
        ))}
      </ul>
    </div>
  );
}
