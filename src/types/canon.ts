// OT Asset Canon Type Definitions
// The converged plant intelligence model

export type CanonLayer = 1 | 2 | 3 | 4 | 5 | 6;

export const LAYER_NAMES: Record<CanonLayer, string> = {
  1: "Physical Process",
  2: "Instrumentation & Actuation",
  3: "Control Systems",
  4: "Operations & Monitoring",
  5: "Network Infrastructure",
  6: "Enterprise Integration",
};

export const LAYER_DESCRIPTIONS: Record<CanonLayer, string> = {
  1: "Unit operations, material flows, energy balances, chemical reactions",
  2: "Sensors, actuators, safety instrumented systems (SIS/SIL-rated)",
  3: "PLCs, DCS controllers, RTUs, motion controllers, I/O modules",
  4: "HMIs, historian servers, engineering workstations, SCADA, OPC",
  5: "Switches, routers, firewalls, VLANs, protocols, segmentation",
  6: "ERP connections, cloud services, remote access, vendor portals",
};

export type AssetType =
  // Layer 1 - Physical Process Equipment
  | "reactor"
  | "heat_exchanger"
  | "pump"
  | "compressor"
  | "tank"
  | "column"
  | "furnace"
  | "vessel"
  | "boiler"
  | "cooling_tower"
  | "flare"
  | "blower"
  | "fan"
  | "filter"
  | "dryer"
  | "conveyor"
  | "mixer"
  | "agitator"
  | "centrifuge"
  | "storage_vessel"
  | "silo"
  | "relief_header"
  | "scrubber"
  | "heater"
  | "cooler"
  // Layer 2 - Instrumentation & Actuation
  | "temperature_sensor"
  | "pressure_sensor"
  | "flow_sensor"
  | "level_sensor"
  | "analytical_sensor"
  | "analyzer"
  | "control_valve"
  | "motor"
  | "drive"
  | "safety_sensor"
  | "safety_actuator"
  | "shutdown_valve"
  | "blowdown_valve"
  | "isolation_valve"
  | "relief_valve"
  | "safety_valve"
  | "speed_sensor"
  | "vibration_sensor"
  | "controller"  // Field-mounted controller
  // Layer 3 - Control Systems
  | "plc"
  | "dcs_controller"
  | "rtu"
  | "motion_controller"
  | "io_module"
  | "safety_plc"
  | "safety_controller"
  | "sis_controller"
  | "remote_io"
  | "marshalling_cabinet"
  // Layer 4 - Operations & Monitoring
  | "hmi"
  | "operator_station"
  | "historian"
  | "engineering_workstation"
  | "scada_master"
  | "opc_server"
  | "data_diode"
  | "server"
  | "application_server"
  | "batch_server"
  // Layer 5 - Network Infrastructure
  | "switch"
  | "industrial_switch"
  | "router"
  | "firewall"
  | "wireless_ap"
  | "wireless_access_point"
  | "cellular_gateway"
  | "jump_server"
  | "bastion_host"
  // Layer 6 - Enterprise Integration
  | "erp_connector"
  | "erp_gateway"
  | "cloud_gateway"
  | "vpn_concentrator"
  | "remote_access"
  | "mes_server";

export type RiskTier = "critical" | "high" | "medium" | "low";

export type RelationshipType =
  | "controls"      // Controller controls actuator
  | "monitors"      // Sensor monitors process
  | "feeds"         // Process feeds another process
  | "protects"      // Safety system protects process
  | "connects_to"   // Network connectivity
  | "accesses"      // User/system access
  | "depends_on"    // Operational dependency
  | "contained_in"; // Physical containment

export interface EngineeringContext {
  processArea?: string;
  pidReference?: string;
  hazopNode?: string;
  consequenceOfFailure?: string;
  silRating?: "SIL1" | "SIL2" | "SIL3" | "SIL4" | string;
  safetyFunction?: string;
  designBasis?: {
    temperature?: { value: number; unit: "F" | "C" };
    pressure?: { value: number; unit: "PSI" | "bar" | "kPa" };
    flow?: { value: number; unit: "gpm" | "m3/h" };
  };
  // Physical equipment properties
  designPressure?: string;
  designTemperature?: string;
  material?: string;
  volume?: string;
  capacity?: string;
  head?: string;
  driver?: string;
  pumpType?: string;
  compressorType?: string;
  heatDuty?: string;
  shellSide?: string;
  tubeSide?: string;
  heatingMedium?: string;
  trays?: number;
  diameter?: string;
  height?: string;
  redundancy?: string;
  product?: string;
  tankType?: string;
  steamCapacity?: string;
  steamPressure?: string;
  // Instrumentation properties
  range?: string;
  elementType?: string;
  associatedEquipment?: string;
  setpoint?: string;
  relievingCapacity?: string;
  setPoint?: string;
  meterType?: string;
  size?: string;
  cv?: number;
  failPosition?: string;
  strokeTime?: string;
  analyzerType?: string;
  components?: string;
  purpose?: string;
  certification?: string;
}

export interface ControlSystemContext {
  controllerType?: string;
  controllerMake?: string;
  controllerModel?: string;
  firmwareVersion?: string;
  currentFirmware?: string;
  firmwareGap?: number;
  ioType?: "AI" | "AO" | "DI" | "DO" | "serial" | "ethernet";
  historianTag?: string;
  scanRate?: number;
  lastLogicChange?: Date;
  lastLogicChangeBy?: string;
  // Additional controller properties
  ioCapacity?: string;
  redundancy?: string;
  certification?: string;
  manufacturer?: string;
  model?: string;
  os?: string;
  application?: string;
}

export interface NetworkContext {
  ipAddress?: string;
  macAddress?: string;
  vlan?: number;
  zone?: string;
  protocol?: string[];
  protocols?: string[];
  upstreamDevice?: string;
  firewallTraversal?: boolean;
  remoteAccessExposure?: string;
  // Network device properties
  manufacturer?: string;
  model?: string;
  redundancy?: string;
}

export interface SecurityContext {
  cveCount?: number;
  criticalCveCount?: number;
  highCveCount?: number;
  patchable?: boolean;
  patchConstraint?: string;
  compensatingControls?: string[];
  monitoringCoverage?: string;
  lastSecurityAssessment?: Date;
  riskTier: RiskTier;
  riskJustification?: string;
}

export interface OperationalContext {
  criticality: "production_critical" | "important" | "auxiliary";
  redundancy?: "none" | "hot_standby" | "cold_standby" | "n+1";
  mtbf?: number; // Mean time between failure in years
  spareAvailability?: string;
  lastCalibration?: Date;
  maintenanceSchedule?: string;
  endOfLife?: Date;
}

export interface CanonAsset {
  id: string;
  tagNumber: string; // The Rosetta Stone
  name: string;
  description?: string;
  assetType: AssetType;
  layer: CanonLayer;

  engineering?: EngineeringContext;
  controlSystem?: ControlSystemContext;
  network?: NetworkContext;
  security: SecurityContext;
  operational?: OperationalContext;

  createdAt: Date;
  updatedAt: Date;
  sourceSystem?: string;
  verified?: boolean;
}

export interface AssetRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  consequenceIfCompromised?: string;
  description?: string;
}

export interface AttackPath {
  id: string;
  entryPointId: string;
  targetId: string;
  pathSteps: string[]; // Ordered asset IDs
  consequenceSeverity: RiskTier;
  likelihoodScore: number;
  attackVector: string;
  mitigations?: string[];
  generatedAt: Date;
}

export interface ConsequenceChain {
  id: string;
  triggerAssetId: string;
  triggerEvent: string;
  steps: {
    assetId: string;
    event: string;
    timeframe?: string;
  }[];
  ultimateConsequence: string;
  severity: RiskTier;
  regulatoryImpact?: string[];
}

// Build Clock Risk Proportionality Types
export interface RiskProportionalityScore {
  facilityId: string;
  zone?: string;
  assetTier?: RiskTier;

  // The four judgments
  baseRisk: number;        // Threat landscape × asset exposure × consequence severity
  expectedPosture: number; // What security investment SHOULD exist
  actualPosture: number;   // What security investment DOES exist

  judgment: "overspend" | "proportional" | "underspend" | "structural_mismatch";
  gapMagnitude?: number;
  recommendations?: string[];

  calculatedAt: Date;
}
