"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  LAYER_NAMES,
  LAYER_DESCRIPTIONS,
  type CanonLayer,
  type CanonAsset,
  type RiskTier,
} from "@/types/canon";

// Wrapper component to handle Suspense for useSearchParams
function ExplorerContent() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ExplorerPageInner />
    </Suspense>
  );
}

export default function ExplorerPage() {
  return <ExplorerContent />;
}

// Sample data for demo - in production this comes from the Canon database
const SAMPLE_ASSETS: Partial<CanonAsset>[] = [
  {
    id: "1",
    tagNumber: "TIC-101",
    name: "Reactor R-101 Temperature Controller",
    assetType: "dcs_controller",
    layer: 3,
    security: {
      riskTier: "critical",
      cveCount: 12,
      criticalCveCount: 3,
      patchable: false,
      patchConstraint: "Requires 48hr production shutdown",
      compensatingControls: ["Network segmentation", "Passive monitoring"],
      riskJustification: "Safety function + unpatched + severe consequence",
    },
    engineering: {
      processArea: "Reactor Section",
      pidReference: "DWG-PR-101-003",
      hazopNode: "Node 7 - High Temperature in R-101",
      consequenceOfFailure: "Runaway reaction → relief valve lift → potential atmospheric release",
      silRating: "SIL2",
      safetyFunction: "SIS trip on high-high temp",
    },
    controlSystem: {
      controllerMake: "Honeywell",
      controllerModel: "C300",
      firmwareVersion: "v310.1",
      currentFirmware: "v400.2",
      firmwareGap: 3,
      historianTag: "R101.TIC101.PV",
    },
    network: {
      ipAddress: "10.1.4.23",
      vlan: 40,
      zone: "Process Control Zone",
      protocol: ["Ethernet/IP", "Modbus TCP"],
    },
  },
  {
    id: "2",
    tagNumber: "TT-101",
    name: "Reactor R-101 Temperature Transmitter",
    assetType: "temperature_sensor",
    layer: 2,
    security: {
      riskTier: "high",
      cveCount: 0,
      riskJustification: "Field device - limited attack surface but critical measurement",
    },
    engineering: {
      processArea: "Reactor Section",
      pidReference: "DWG-PR-101-003",
      designBasis: { temperature: { value: 450, unit: "F" } },
    },
  },
  {
    id: "3",
    tagNumber: "TV-101",
    name: "Cooling Water Control Valve",
    assetType: "control_valve",
    layer: 2,
    security: {
      riskTier: "high",
      riskJustification: "Final control element for reactor cooling",
    },
    engineering: {
      processArea: "Reactor Section",
      pidReference: "DWG-PR-101-003",
      consequenceOfFailure: "Loss of cooling → runaway reaction",
    },
  },
  {
    id: "4",
    tagNumber: "R-101",
    name: "Primary Reactor",
    assetType: "reactor",
    layer: 1,
    security: {
      riskTier: "critical",
      riskJustification: "Process vessel - ultimate consequence target",
    },
    engineering: {
      processArea: "Reactor Section",
      hazopNode: "Node 7",
      consequenceOfFailure: "Runaway exothermic reaction, relief valve lift, potential release",
      designBasis: {
        temperature: { value: 450, unit: "F" },
        pressure: { value: 200, unit: "PSI" },
      },
    },
  },
  {
    id: "5",
    tagNumber: "HMI-04",
    name: "Reactor Area Operator Console",
    assetType: "hmi",
    layer: 4,
    security: {
      riskTier: "high",
      cveCount: 47,
      criticalCveCount: 8,
      patchable: true,
      riskJustification: "Windows 7 EOL - operator access to reactor controls",
    },
    controlSystem: {
      controllerMake: "Honeywell",
      controllerModel: "Experion PKS",
    },
    network: {
      ipAddress: "10.1.4.50",
      vlan: 40,
      zone: "Process Control Zone",
    },
  },
  {
    id: "6",
    tagNumber: "EWS-04",
    name: "Engineering Workstation - Reactor",
    assetType: "engineering_workstation",
    layer: 4,
    security: {
      riskTier: "critical",
      cveCount: 23,
      riskJustification: "Can modify safety system logic - VPN accessible",
    },
    network: {
      ipAddress: "10.1.4.55",
      vlan: 40,
      zone: "Process Control Zone",
      remoteAccessExposure: "VPN access for vendor support",
    },
  },
  {
    id: "7",
    tagNumber: "SW-OT-04",
    name: "Process Control Zone Switch",
    assetType: "switch",
    layer: 5,
    security: {
      riskTier: "high",
      cveCount: 5,
      riskJustification: "Aggregates all reactor area control traffic",
    },
    network: {
      ipAddress: "10.1.4.1",
      vlan: 40,
      zone: "Process Control Zone",
    },
  },
  {
    id: "8",
    tagNumber: "VPN-01",
    name: "Vendor VPN Concentrator",
    assetType: "vpn_concentrator",
    layer: 6,
    security: {
      riskTier: "critical",
      cveCount: 2,
      criticalCveCount: 1,
      riskJustification: "Entry point from external - can reach EWS-04",
    },
    network: {
      ipAddress: "10.0.1.10",
      zone: "DMZ",
    },
  },
];

function ExplorerPageInner() {
  const searchParams = useSearchParams();
  const initialLayer = searchParams.get("layer");

  const [selectedLayer, setSelectedLayer] = useState<CanonLayer | null>(
    initialLayer ? (parseInt(initialLayer) as CanonLayer) : null
  );
  const [selectedRisk, setSelectedRisk] = useState<RiskTier | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Partial<CanonAsset> | null>(null);

  // Filter assets
  const filteredAssets = SAMPLE_ASSETS.filter((asset) => {
    if (selectedLayer && asset.layer !== selectedLayer) return false;
    if (selectedRisk && asset.security?.riskTier !== selectedRisk) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        asset.tagNumber?.toLowerCase().includes(q) ||
        asset.name?.toLowerCase().includes(q) ||
        asset.assetType?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const layers: CanonLayer[] = [1, 2, 3, 4, 5, 6];
  const riskTiers: RiskTier[] = ["critical", "high", "medium", "low"];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Canon Explorer
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse and search assets across all Canon layers
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tag number, name, or type..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Layer Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Layer
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedLayer(null)}
                className={`px-2 py-1 text-xs rounded ${
                  !selectedLayer
                    ? "bg-gray-900 text-white"
                    : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                }`}
              >
                All
              </button>
              {layers.map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedLayer(l)}
                  className={`px-2 py-1 text-xs rounded layer-${l} ${
                    selectedLayer === l ? "ring-2 ring-offset-1 ring-black" : ""
                  }`}
                >
                  L{l}
                </button>
              ))}
            </div>
          </div>

          {/* Risk Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Risk Tier
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedRisk(null)}
                className={`px-2 py-1 text-xs rounded ${
                  !selectedRisk
                    ? "bg-gray-900 text-white"
                    : "bg-gray-200 dark:bg-gray-600"
                }`}
              >
                All
              </button>
              {riskTiers.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRisk(r)}
                  className={`px-2 py-1 text-xs rounded risk-${r} ${
                    selectedRisk === r ? "ring-2 ring-offset-1 ring-black" : ""
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {filteredAssets.length} assets
              </span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onSelect={() => setSelectedAsset(asset)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Asset Detail */}
        <div className="lg:col-span-1">
          {selectedAsset ? (
            <AssetDetail asset={selectedAsset} />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500">
              Select an asset to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetRow({
  asset,
  isSelected,
  onSelect,
}: {
  asset: Partial<CanonAsset>;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const layerColors: Record<number, string> = {
    1: "bg-layer1",
    2: "bg-layer2",
    3: "bg-layer3",
    4: "bg-layer4",
    5: "bg-layer5",
    6: "bg-layer6",
  };

  const riskColors: Record<string, string> = {
    critical: "text-critical",
    high: "text-high",
    medium: "text-medium",
    low: "text-low",
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-8 rounded ${layerColors[asset.layer || 1]}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-gray-900 dark:text-white">
              {asset.tagNumber}
            </span>
            <span
              className={`text-xs font-medium ${
                riskColors[asset.security?.riskTier || "low"]
              }`}
            >
              {asset.security?.riskTier?.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {asset.name}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>Layer {asset.layer}</div>
          <div>{asset.assetType?.replace(/_/g, " ")}</div>
        </div>
      </div>
    </button>
  );
}

function AssetDetail({ asset }: { asset: Partial<CanonAsset> }) {
  const layerColors: Record<number, string> = {
    1: "layer-1",
    2: "layer-2",
    3: "layer-3",
    4: "layer-4",
    5: "layer-5",
    6: "layer-6",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className={`p-4 ${layerColors[asset.layer || 1]}`}>
        <div className="text-sm opacity-75">
          Layer {asset.layer} - {LAYER_NAMES[asset.layer as CanonLayer]}
        </div>
        <h2 className="text-xl font-bold">{asset.tagNumber}</h2>
        <p className="text-sm opacity-90">{asset.name}</p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Security Context */}
        {asset.security && (
          <Section title="Security Context">
            <DetailRow
              label="Risk Tier"
              value={asset.security.riskTier?.toUpperCase()}
              highlight={asset.security.riskTier}
            />
            {asset.security.cveCount !== undefined && (
              <DetailRow
                label="CVEs"
                value={`${asset.security.cveCount} total (${asset.security.criticalCveCount || 0} critical)`}
              />
            )}
            {asset.security.patchable !== undefined && (
              <DetailRow
                label="Patchable"
                value={asset.security.patchable ? "Yes" : "No"}
              />
            )}
            {asset.security.patchConstraint && (
              <DetailRow label="Constraint" value={asset.security.patchConstraint} />
            )}
            {asset.security.riskJustification && (
              <DetailRow
                label="Justification"
                value={asset.security.riskJustification}
              />
            )}
          </Section>
        )}

        {/* Engineering Context */}
        {asset.engineering && (
          <Section title="Engineering Context">
            {asset.engineering.processArea && (
              <DetailRow label="Process Area" value={asset.engineering.processArea} />
            )}
            {asset.engineering.pidReference && (
              <DetailRow label="P&ID" value={asset.engineering.pidReference} />
            )}
            {asset.engineering.hazopNode && (
              <DetailRow label="HAZOP Node" value={asset.engineering.hazopNode} />
            )}
            {asset.engineering.silRating && (
              <DetailRow label="SIL Rating" value={asset.engineering.silRating} />
            )}
            {asset.engineering.consequenceOfFailure && (
              <DetailRow
                label="Consequence"
                value={asset.engineering.consequenceOfFailure}
                highlight="critical"
              />
            )}
          </Section>
        )}

        {/* Control System Context */}
        {asset.controlSystem && (
          <Section title="Control System Context">
            {asset.controlSystem.controllerMake && (
              <DetailRow
                label="Make/Model"
                value={`${asset.controlSystem.controllerMake} ${asset.controlSystem.controllerModel || ""}`}
              />
            )}
            {asset.controlSystem.firmwareVersion && (
              <DetailRow
                label="Firmware"
                value={`${asset.controlSystem.firmwareVersion}${
                  asset.controlSystem.firmwareGap
                    ? ` (${asset.controlSystem.firmwareGap} versions behind)`
                    : ""
                }`}
              />
            )}
            {asset.controlSystem.historianTag && (
              <DetailRow label="Historian Tag" value={asset.controlSystem.historianTag} />
            )}
          </Section>
        )}

        {/* Network Context */}
        {asset.network && (
          <Section title="Network Context">
            {asset.network.ipAddress && (
              <DetailRow label="IP Address" value={asset.network.ipAddress} />
            )}
            {asset.network.vlan && (
              <DetailRow label="VLAN" value={asset.network.vlan.toString()} />
            )}
            {asset.network.zone && (
              <DetailRow label="Zone" value={asset.network.zone} />
            )}
            {asset.network.protocol && (
              <DetailRow label="Protocols" value={asset.network.protocol.join(", ")} />
            )}
            {asset.network.remoteAccessExposure && (
              <DetailRow
                label="Remote Access"
                value={asset.network.remoteAccessExposure}
                highlight="high"
              />
            )}
          </Section>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <a
            href={`/ai?q=What happens if ${asset.tagNumber} is compromised?`}
            className="block w-full text-center px-4 py-2 bg-layer5 hover:bg-blue-700 text-white rounded-md text-sm"
          >
            Analyze Consequences
          </a>
          <a
            href={`/attack-paths?target=${asset.id}`}
            className="block w-full text-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-sm"
          >
            View Attack Paths
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | undefined;
  highlight?: string;
}) {
  if (!value) return null;

  const highlightColors: Record<string, string> = {
    critical: "text-critical",
    high: "text-high",
    medium: "text-medium",
    low: "text-low",
  };

  return (
    <div className="flex text-sm">
      <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">
        {label}
      </span>
      <span
        className={`text-gray-900 dark:text-white ${
          highlight ? highlightColors[highlight] || "" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
