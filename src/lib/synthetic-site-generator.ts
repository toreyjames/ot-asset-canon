import type { AssetType, CanonAsset, CanonLayer, RiskTier } from "@/types/canon";

export type SiteProfile =
  | "petrochemical"
  | "chemical"
  | "water"
  | "power"
  | "automotive"
  | "defense_manufacturing"
  | "shipbuilding";

export interface GenerateSiteOptions {
  siteName: string;
  siteSlug: string;
  profile: SiteProfile;
  targetAssetCount: number;
  seed?: string;
}

export interface GeneratedSiteData {
  assets: Partial<CanonAsset>[];
  metadata: {
    siteName: string;
    siteSlug: string;
    profile: SiteProfile;
    targetAssetCount: number;
    generatedAssetCount: number;
    generatedAt: string;
  };
}

const LAYER_WEIGHTS: Record<CanonLayer, number> = {
  1: 0.12,
  2: 0.52,
  3: 0.1,
  4: 0.09,
  5: 0.11,
  6: 0.06,
};

const PROCESS_AREAS_BY_PROFILE: Record<SiteProfile, string[]> = {
  petrochemical: ["Cracking", "Compression", "Separation", "Utilities", "Tank Farm", "Flare"],
  chemical: ["Reaction", "Distillation", "Utilities", "Storage", "Loading"],
  water: ["Intake", "Clarification", "Filtration", "Disinfection", "Distribution"],
  power: ["Generation", "Steam", "Cooling", "Substation", "Fuel Handling"],
  automotive: ["Body Shop", "Paint Shop", "Final Assembly", "Utilities", "Test Line"],
  defense_manufacturing: ["Precision Machining", "Assembly Cell", "Heat Treatment", "Test Bay", "Secure Storage"],
  shipbuilding: ["Hull Fabrication", "Module Assembly", "Outfitting", "Dry Dock", "Marine Utilities"],
};

const LAYER_TYPES: Record<CanonLayer, AssetType[]> = {
  1: ["reactor", "column", "vessel", "tank", "heat_exchanger", "pump", "compressor", "flare", "boiler", "cooler"],
  2: ["temperature_sensor", "pressure_sensor", "flow_sensor", "level_sensor", "control_valve", "shutdown_valve", "relief_valve", "analyzer"],
  3: ["plc", "dcs_controller", "safety_controller", "io_module", "remote_io"],
  4: ["hmi", "historian", "engineering_workstation", "scada_master", "opc_server", "application_server"],
  5: ["industrial_switch", "switch", "router", "firewall", "wireless_access_point", "protocol_converter"],
  6: ["remote_access", "erp_gateway", "cloud_gateway", "vpn_concentrator", "mes_server"],
};

const TAG_PREFIX: Record<AssetType, string> = {
  reactor: "R",
  column: "C",
  vessel: "V",
  tank: "TK",
  heat_exchanger: "E",
  pump: "P",
  compressor: "K",
  flare: "FL",
  boiler: "BLR",
  cooler: "CLR",
  temperature_sensor: "TT",
  pressure_sensor: "PT",
  flow_sensor: "FT",
  level_sensor: "LT",
  control_valve: "CV",
  shutdown_valve: "SDV",
  relief_valve: "PSV",
  analyzer: "AT",
  plc: "PLC",
  dcs_controller: "DCS",
  safety_controller: "SIS",
  io_module: "IO",
  remote_io: "RIO",
  hmi: "HMI",
  historian: "HIS",
  engineering_workstation: "EWS",
  scada_master: "SCADA",
  opc_server: "OPC",
  application_server: "APP",
  industrial_switch: "SW",
  switch: "SW",
  router: "RTR",
  firewall: "FW",
  wireless_access_point: "WAP",
  protocol_converter: "PCV",
  remote_access: "RA",
  erp_gateway: "ERP",
  cloud_gateway: "CLD",
  vpn_concentrator: "VPN",
  mes_server: "MES",
  // Unused required by type coverage fallback
  furnace: "F",
  cooling_tower: "CT",
  blower: "B",
  fan: "FN",
  filter: "FIL",
  dryer: "DRY",
  conveyor: "CONV",
  mixer: "MX",
  agitator: "AG",
  centrifuge: "CEN",
  storage_vessel: "SV",
  silo: "SILO",
  relief_header: "RH",
  scrubber: "SCR",
  heater: "HTR",
  substation: "SS",
  line_segment: "LN",
  feeder: "FDR",
  transformer: "TX",
  switchgear: "SG",
  load_bus: "BUS",
  generator: "GEN",
  battery_storage: "BAT",
  solar_array: "SOL",
  wind_turbine: "WT",
  analytical_sensor: "AS",
  motor: "M",
  drive: "DRV",
  safety_sensor: "SST",
  safety_actuator: "SA",
  blowdown_valve: "BDV",
  isolation_valve: "XV",
  safety_valve: "SV",
  speed_sensor: "SS",
  vibration_sensor: "VS",
  controller: "CTR",
  pmu: "PMU",
  power_meter: "PM",
  line_sensor: "LS",
  fault_indicator: "FI",
  voltage_regulator: "VR",
  capacitor_bank: "CAP",
  recloser: "RCL",
  breaker: "BRK",
  protection_ct: "CT",
  protection_pt: "PT",
  rtu: "RTU",
  motion_controller: "MC",
  safety_plc: "SPLC",
  sis_controller: "SIS",
  marshalling_cabinet: "MCB",
  protective_relay: "REL",
  substation_rtac: "RTAC",
  derms_controller: "DERM",
  operator_station: "OPS",
  data_diode: "DD",
  server: "SRV",
  batch_server: "BATCH",
  ems_server: "EMS",
  scada_gateway: "SGW",
  phasor_data_concentrator: "PDC",
  wireless_ap: "WAP",
  cellular_gateway: "CELL",
  jump_server: "JMP",
  bastion_host: "BAST",
  serial_gateway: "SER",
  erp_connector: "ERPC",
};

function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function pick<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length)] as T;
}

function layerCounts(total: number): Record<CanonLayer, number> {
  const counts = {
    1: Math.max(8, Math.round(total * LAYER_WEIGHTS[1])),
    2: Math.max(20, Math.round(total * LAYER_WEIGHTS[2])),
    3: Math.max(6, Math.round(total * LAYER_WEIGHTS[3])),
    4: Math.max(6, Math.round(total * LAYER_WEIGHTS[4])),
    5: Math.max(8, Math.round(total * LAYER_WEIGHTS[5])),
    6: Math.max(4, Math.round(total * LAYER_WEIGHTS[6])),
  } as Record<CanonLayer, number>;

  const computed = counts[1] + counts[2] + counts[3] + counts[4] + counts[5] + counts[6];
  counts[2] += total - computed;
  return counts;
}

function riskFor(layer: CanonLayer, assetType: AssetType): RiskTier {
  if (assetType === "safety_controller" || assetType === "firewall" || assetType === "remote_access") return "high";
  if (layer <= 2) return "medium";
  if (layer >= 5) return "low";
  return "medium";
}

function sampleAssetsStratified(assets: Partial<CanonAsset>[], limit: number): Partial<CanonAsset>[] {
  if (assets.length <= limit) return assets;

  const byLayer = new Map<number, Partial<CanonAsset>[]>();
  for (const asset of assets) {
    const layer = asset.layer ?? 0;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(asset);
  }

  const sampled: Partial<CanonAsset>[] = [];
  const layers = [1, 2, 3, 4, 5, 6];
  for (const layer of layers) {
    const layerAssets = byLayer.get(layer) ?? [];
    const take = Math.max(1, Math.floor((layerAssets.length / assets.length) * limit));
    sampled.push(...layerAssets.slice(0, take));
  }

  if (sampled.length < limit) {
    const ids = new Set(sampled.map((a) => a.id));
    for (const asset of assets) {
      if (sampled.length >= limit) break;
      if (!ids.has(asset.id)) sampled.push(asset);
    }
  }

  return sampled.slice(0, limit);
}

export function generateSyntheticSiteData(options: GenerateSiteOptions): GeneratedSiteData {
  const rng = createRng(options.seed ?? `${options.siteSlug}:${options.targetAssetCount}:${options.profile}`);
  const areas = PROCESS_AREAS_BY_PROFILE[options.profile];
  const counts = layerCounts(options.targetAssetCount);
  const now = new Date();

  const assets: Partial<CanonAsset>[] = [];
  const sourceSystems = ["Claroty", "Nozomi", "Historian", "CMMS", "Qualys", "Tanium", "Manual"];

  for (const layer of [1, 2, 3, 4, 5, 6] as CanonLayer[]) {
    const layerTypes = LAYER_TYPES[layer];
    for (let i = 0; i < counts[layer]; i++) {
      const assetType = pick(rng, layerTypes);
      const area = pick(rng, areas);
      const seq = (i + 1).toString().padStart(3, "0");
      const prefix = TAG_PREFIX[assetType] || "AST";
      const tagNumber = `${prefix}-${seq}`;
      const vlan = layer >= 3 && layer <= 5 ? 100 + Math.floor(rng() * 30) : undefined;

      assets.push({
        id: `${options.siteSlug}-${layer}-${seq}-${Math.floor(rng() * 9000 + 1000)}`,
        tagNumber,
        name: `${assetType.replace(/_/g, " ")} ${seq}`,
        assetType,
        layer,
        engineering: {
          processArea: area,
          pidReference: `PID-${Math.floor(rng() * 90 + 10)}`,
          safetyFunction: layer <= 3 && rng() > 0.7 ? "Process shutdown" : undefined,
        },
        controlSystem: layer >= 2 && layer <= 4 ? {
          controllerMake: pick(rng, ["Emerson", "Honeywell", "Siemens", "ABB", "Rockwell"]),
          firmwareVersion: `${Math.floor(rng() * 10 + 1)}.${Math.floor(rng() * 10)}.${Math.floor(rng() * 20)}`,
          scanRate: layer === 2 ? Math.floor(rng() * 900 + 100) : undefined,
        } : undefined,
        network: layer >= 3 ? {
          ipAddress: `10.${layer}.${Math.floor(rng() * 240 + 10)}.${Math.floor(rng() * 240 + 10)}`,
          vlan,
          zone: `L${layer}-${area}`,
          protocol: layer >= 5 ? [pick(rng, ["TCP", "HTTPS", "SSH"])] : [pick(rng, ["Modbus", "EtherNet/IP", "PROFINET", "OPC UA"])],
        } : undefined,
        security: {
          riskTier: riskFor(layer, assetType),
          patchable: layer >= 3,
          cveCount: layer >= 3 ? Math.floor(rng() * 6) : 0,
          criticalCveCount: layer >= 3 ? Math.floor(rng() * 2) : 0,
          highCveCount: layer >= 3 ? Math.floor(rng() * 3) : 0,
          monitoringCoverage: rng() > 0.25 ? "baseline" : "partial",
          compensatingControls: rng() > 0.6 ? ["network segmentation"] : undefined,
        },
        sourceSystem: pick(rng, sourceSystems),
        verified: rng() > 0.2,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return {
    assets,
    metadata: {
      siteName: options.siteName,
      siteSlug: options.siteSlug,
      profile: options.profile,
      targetAssetCount: options.targetAssetCount,
      generatedAssetCount: assets.length,
      generatedAt: now.toISOString(),
    },
  };
}

export function buildCoverageBaseline(assets: Partial<CanonAsset>[]) {
  const total = assets.length;
  const securable = assets.filter((a) => a.layer !== undefined && a.layer >= 2);
  const canBeSecured = securable.length;
  const monitored = securable.filter((a) => a.security?.monitoringCoverage === "baseline").length;
  const patchable = securable.filter((a) => a.security?.patchable).length;
  const covered = securable.filter((a) =>
    a.security?.monitoringCoverage === "baseline" ||
    ((a.security?.cveCount ?? 0) > 0)
  ).length;
  const boundedCovered = Math.min(canBeSecured, covered);

  return {
    totalAssets: total,
    securableAssets: canBeSecured,
    coveredAssets: boundedCovered,
    uncoveredAssets: Math.max(0, canBeSecured - boundedCovered),
    coveragePercent: canBeSecured > 0 ? Math.round((boundedCovered / canBeSecured) * 100) : 0,
    discoveryCoveragePercent: total > 0 ? Math.round((assets.filter((a) => Boolean(a.sourceSystem)).length / total) * 100) : 0,
    patchVisibilityPercent: canBeSecured > 0 ? Math.round((patchable / canBeSecured) * 100) : 0,
    evidencedPercent: total > 0 ? Math.round((assets.filter((a) => a.verified).length / total) * 100) : 0,
  };
}

export function sampledVisualizationAssets(assets: Partial<CanonAsset>[], limit = 450) {
  return sampleAssetsStratified(assets, limit);
}
