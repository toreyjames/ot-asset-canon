// Drizzle ORM Schema for OT Asset Canon
// Vercel Postgres compatible

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  inet,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// CORE CANON TABLES
// ============================================

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }), // Optional for backward compat
    tagNumber: varchar("tag_number", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    assetType: varchar("asset_type", { length: 50 }).notNull(),
    layer: integer("layer").notNull(), // 1-6

    // Engineering Context (JSONB for flexibility)
    engineering: jsonb("engineering").$type<{
      processArea?: string;
      pidReference?: string;
      hazopNode?: string;
      consequenceOfFailure?: string;
      silRating?: string;
      safetyFunction?: string;
      designBasis?: Record<string, unknown>;
    }>(),

    // Control System Context
    controlSystem: jsonb("control_system").$type<{
      controllerType?: string;
      controllerMake?: string;
      controllerModel?: string;
      firmwareVersion?: string;
      currentFirmware?: string;
      firmwareGap?: number;
      ioType?: string;
      historianTag?: string;
      scanRate?: number;
      lastLogicChange?: string;
      lastLogicChangeBy?: string;
    }>(),

    // Network Context
    ipAddress: inet("ip_address"),
    macAddress: varchar("mac_address", { length: 17 }),
    vlan: integer("vlan"),
    networkZone: varchar("network_zone", { length: 100 }),
    protocols: jsonb("protocols").$type<string[]>(),

    // Security Context
    cveCount: integer("cve_count").default(0),
    criticalCveCount: integer("critical_cve_count").default(0),
    highCveCount: integer("high_cve_count").default(0),
    patchable: boolean("patchable").default(true),
    patchConstraint: text("patch_constraint"),
    compensatingControls: jsonb("compensating_controls").$type<string[]>(),
    monitoringCoverage: varchar("monitoring_coverage", { length: 100 }),
    lastSecurityAssessment: timestamp("last_security_assessment"),
    riskTier: varchar("risk_tier", { length: 20 }).notNull().default("medium"),
    riskJustification: text("risk_justification"),

    // Operational Context
    criticality: varchar("criticality", { length: 50 }).default("important"),
    redundancy: varchar("redundancy", { length: 50 }),
    mtbf: decimal("mtbf", { precision: 10, scale: 2 }),
    spareAvailability: varchar("spare_availability", { length: 255 }),
    lastCalibration: timestamp("last_calibration"),
    maintenanceSchedule: varchar("maintenance_schedule", { length: 255 }),
    endOfLife: timestamp("end_of_life"),

    // Confidence & Confirmation Status
    confirmationStatus: varchar("confirmation_status", { length: 20 }).default("inferred"), // confirmed, inferred, expected
    confidenceScore: integer("confidence_score").default(0), // 0-100, weighted by source quality
    confirmationCount: integer("confirmation_count").default(0), // How many sources confirm this
    inferredFrom: jsonb("inferred_from").$type<string[]>(), // Engineering rules that suggest this exists
    firstConfirmedAt: timestamp("first_confirmed_at"),
    lastConfirmedAt: timestamp("last_confirmed_at"),

    // Metadata
    sourceSystem: varchar("source_system", { length: 100 }), // Legacy field
    verified: boolean("verified").default(false), // Legacy field
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteTagIdx: uniqueIndex("site_tag_idx").on(table.siteId, table.tagNumber), // Unique per site
    siteIdx: index("asset_site_idx").on(table.siteId),
    layerIdx: index("layer_idx").on(table.layer),
    assetTypeIdx: index("asset_type_idx").on(table.assetType),
    riskTierIdx: index("risk_tier_idx").on(table.riskTier),
    ipAddressIdx: index("ip_address_idx").on(table.ipAddress),
  })
);

export const assetRelationships = pgTable(
  "asset_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
    consequenceIfCompromised: text("consequence_if_compromised"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index("source_idx").on(table.sourceId),
    targetIdx: index("target_idx").on(table.targetId),
    relationshipIdx: index("relationship_idx").on(table.relationshipType),
  })
);

export const attackPaths = pgTable(
  "attack_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryPointId: uuid("entry_point_id")
      .notNull()
      .references(() => assets.id),
    targetId: uuid("target_id")
      .notNull()
      .references(() => assets.id),
    pathSteps: jsonb("path_steps").$type<string[]>().notNull(),
    consequenceSeverity: varchar("consequence_severity", { length: 20 }).notNull(),
    likelihoodScore: decimal("likelihood_score", { precision: 5, scale: 4 }),
    attackVector: text("attack_vector").notNull(),
    mitigations: jsonb("mitigations").$type<string[]>(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => ({
    entryPointIdx: index("entry_point_idx").on(table.entryPointId),
    targetIdx: index("attack_target_idx").on(table.targetId),
    severityIdx: index("severity_idx").on(table.consequenceSeverity),
  })
);

export const consequenceChains = pgTable("consequence_chains", {
  id: uuid("id").primaryKey().defaultRandom(),
  triggerAssetId: uuid("trigger_asset_id")
    .notNull()
    .references(() => assets.id),
  triggerEvent: text("trigger_event").notNull(),
  steps: jsonb("steps")
    .$type<{ assetId: string; event: string; timeframe?: string }[]>()
    .notNull(),
  ultimateConsequence: text("ultimate_consequence").notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  regulatoryImpact: jsonb("regulatory_impact").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// MULTI-TENANT: CLIENTS & SITES
// ============================================

// Top-level organization (e.g., "Acme Industries")
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  industry: varchar("industry", { length: 100 }), // Optional hint, but we infer from data
  logoUrl: text("logo_url"),
  primaryContact: varchar("primary_contact", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Site within a client (e.g., "Houston Plant")
export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    location: varchar("location", { length: 255 }),
    timezone: varchar("timezone", { length: 50 }),

    // Inferred from data - not declared
    inferredPlantType: varchar("inferred_plant_type", { length: 50 }),
    plantTypeConfidence: integer("plant_type_confidence"), // 0-100
    plantTypeEvidence: jsonb("plant_type_evidence").$type<string[]>(),

    // Reconstruction metrics (cached, updated on data change)
    assetCount: integer("asset_count").default(0),
    gapCount: integer("gap_count").default(0),
    reconstructionScore: integer("reconstruction_score").default(0), // 0-100
    canRunPlant: boolean("can_run_plant").default(false),
    layerScores: jsonb("layer_scores").$type<{
      layer: number;
      score: number;
      status: string;
      gapCount: number;
    }[]>(),

    // Coverage metrics (for collector optimization)
    confirmedAssetCount: integer("confirmed_asset_count").default(0),
    inferredAssetCount: integer("inferred_asset_count").default(0),
    coveragePercent: integer("coverage_percent").default(0), // confirmed / total
    dataSourceCount: integer("data_source_count").default(0),
    collectorCount: integer("collector_count").default(0),
    coverageRecommendation: varchar("coverage_recommendation", { length: 20 }), // "under", "optimal", "over"

    // Status
    active: boolean("active").default(true).notNull(),
    lastDataIngestion: timestamp("last_data_ingestion"),
    lastAnalysis: timestamp("last_analysis"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    clientIdx: index("site_client_idx").on(table.clientId),
    slugIdx: uniqueIndex("site_slug_idx").on(table.clientId, table.slug),
  })
);

// Engineering gaps detected by reconstruction
export const gaps = pgTable(
  "gaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),

    // Gap identification
    gapType: varchar("gap_type", { length: 50 }).notNull(), // equipment, control, safety, data
    category: varchar("category", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    engineeringRationale: text("engineering_rationale"),

    // Severity and layer
    severity: varchar("severity", { length: 20 }).notNull(), // critical, major, minor
    layer: integer("layer"), // 1-6

    // What triggered this gap
    relatedAssets: jsonb("related_assets").$type<string[]>(),
    detectionRule: varchar("detection_rule", { length: 100 }),

    // Resolution
    status: varchar("status", { length: 20 }).notNull().default("open"), // open, dismissed, resolved
    dismissedReason: text("dismissed_reason"),
    dismissedBy: varchar("dismissed_by", { length: 255 }),
    dismissedAt: timestamp("dismissed_at"),
    resolvedBy: varchar("resolved_by", { length: 255 }),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),

    // Position for 3D visualization
    visualPosition: jsonb("visual_position").$type<[number, number, number]>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index("gap_site_idx").on(table.siteId),
    statusIdx: index("gap_status_idx").on(table.status),
    severityIdx: index("gap_severity_idx").on(table.severity),
  })
);

// Point-in-time snapshots of reconstruction state
export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }), // Optional label
    snapshotType: varchar("snapshot_type", { length: 50 }).notNull(), // auto, manual, pre-change, milestone

    // Frozen metrics at this point in time
    assetCount: integer("asset_count").notNull(),
    gapCount: integer("gap_count").notNull(),
    reconstructionScore: integer("reconstruction_score").notNull(),
    canRunPlant: boolean("can_run_plant").notNull(),
    layerScores: jsonb("layer_scores").$type<{
      layer: number;
      score: number;
      status: string;
      gapCount: number;
    }[]>(),

    // Full gap list at this point
    gaps: jsonb("gaps").$type<{
      id: string;
      title: string;
      severity: string;
      status: string;
    }[]>(),

    createdBy: varchar("created_by", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index("snapshot_site_idx").on(table.siteId),
    typeIdx: index("snapshot_type_idx").on(table.snapshotType),
  })
);

// ============================================
// DATA SOURCES & CONFIDENCE TRACKING
// ============================================

// Where data comes from - enables planning vs efficiency analysis
export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),

    // Source identification
    name: varchar("name", { length: 255 }).notNull(), // "PI Historian", "Claroty CTD", "P&ID Rev 3"
    sourceType: varchar("source_type", { length: 50 }).notNull(), // engineering, historian, collector, network, maintenance, manual

    // Source details
    vendor: varchar("vendor", { length: 100 }), // "OSIsoft", "Claroty", "Dragos"
    version: varchar("version", { length: 50 }),
    description: text("description"),

    // Confidence weighting (higher = more trusted)
    confidenceWeight: integer("confidence_weight").notNull().default(50), // 0-100
    confidenceRationale: text("confidence_rationale"),

    // Coverage info (for collectors)
    isCollector: boolean("is_collector").default(false),
    collectorLocation: varchar("collector_location", { length: 255 }), // "DMZ Switch SPAN", "Control Network Tap"
    coverageZones: jsonb("coverage_zones").$type<string[]>(), // Which network zones this sees

    // Sync status
    lastSync: timestamp("last_sync"),
    syncFrequency: varchar("sync_frequency", { length: 50 }), // "realtime", "daily", "weekly", "manual"
    syncStatus: varchar("sync_status", { length: 20 }).default("active"), // active, stale, error
    lastError: text("last_error"),

    // Metrics
    assetCount: integer("asset_count").default(0), // How many assets this source confirms
    connectionCount: integer("connection_count").default(0), // How many relationships this source provides

    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index("datasource_site_idx").on(table.siteId),
    typeIdx: index("datasource_type_idx").on(table.sourceType),
  })
);

// Links assets to their confirming sources (many-to-many)
export const assetConfirmations = pgTable(
  "asset_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),

    // What this source tells us
    confirmedAt: timestamp("confirmed_at").defaultNow().notNull(),
    lastSeen: timestamp("last_seen"), // For collectors - when was this asset last observed

    // What fields this source provides
    fieldsProvided: jsonb("fields_provided").$type<string[]>(), // ["ipAddress", "macAddress", "firmwareVersion"]

    // Source-specific identifier
    sourceAssetId: varchar("source_asset_id", { length: 255 }), // ID in the source system
    sourceMetadata: jsonb("source_metadata"), // Any extra data from the source

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    assetIdx: index("confirmation_asset_idx").on(table.assetId),
    sourceIdx: index("confirmation_source_idx").on(table.dataSourceId),
    uniqueConfirmation: uniqueIndex("unique_asset_source").on(table.assetId, table.dataSourceId),
  })
);

// Coverage zones for collector optimization
export const coverageZones = pgTable(
  "coverage_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(), // "Control Network", "Safety System", "DMZ"
    description: text("description"),
    layer: integer("layer"), // Primary Purdue layer for this zone

    // Asset counts
    totalAssets: integer("total_assets").default(0),
    confirmedAssets: integer("confirmed_assets").default(0),
    inferredAssets: integer("inferred_assets").default(0),

    // Coverage analysis
    coveragePercent: integer("coverage_percent").default(0), // 0-100
    collectorCount: integer("collector_count").default(0),

    // Recommendation
    recommendation: varchar("recommendation", { length: 20 }), // "add", "adequate", "redundant"
    recommendationRationale: text("recommendation_rationale"),

    // For visualization
    networkSegment: varchar("network_segment", { length: 100 }), // VLAN, subnet
    visualColor: varchar("visual_color", { length: 20 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index("zone_site_idx").on(table.siteId),
  })
);

// ============================================
// BUILD CLOCK / RISK PROPORTIONALITY
// ============================================

// Legacy table - keeping for compatibility but sites table is preferred
export const facilities = pgTable("facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  facilityType: varchar("facility_type", { length: 100 }),
  regulatoryFramework: jsonb("regulatory_framework").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskProportionalityScores = pgTable(
  "risk_proportionality_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    facilityId: uuid("facility_id").references(() => facilities.id),
    zone: varchar("zone", { length: 100 }),
    assetTier: varchar("asset_tier", { length: 20 }),

    baseRisk: decimal("base_risk", { precision: 10, scale: 4 }).notNull(),
    expectedPosture: decimal("expected_posture", { precision: 10, scale: 4 }).notNull(),
    actualPosture: decimal("actual_posture", { precision: 10, scale: 4 }).notNull(),

    judgment: varchar("judgment", { length: 30 }).notNull(),
    gapMagnitude: decimal("gap_magnitude", { precision: 10, scale: 4 }),
    recommendations: jsonb("recommendations").$type<string[]>(),

    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  },
  (table) => ({
    facilityIdx: index("facility_idx").on(table.facilityId),
    judgmentIdx: index("judgment_idx").on(table.judgment),
  })
);

// ============================================
// INGESTION TRACKING
// ============================================

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // claroty, dragos, nozomi, nessus, etc.
    fileName: varchar("file_name", { length: 255 }),
    blobUrl: text("blob_url"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    assetsCreated: integer("assets_created").default(0),
    assetsUpdated: integer("assets_updated").default(0),
    errors: jsonb("errors").$type<string[]>(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index("ingestion_site_idx").on(table.siteId),
    statusIdx: index("ingestion_status_idx").on(table.status),
  })
);

// ============================================
// RELATIONS
// ============================================

export const assetsRelations = relations(assets, ({ one, many }) => ({
  site: one(sites, {
    fields: [assets.siteId],
    references: [sites.id],
  }),
  confirmations: many(assetConfirmations),
  outgoingRelationships: many(assetRelationships, {
    relationName: "sourceAsset",
  }),
  incomingRelationships: many(assetRelationships, {
    relationName: "targetAsset",
  }),
  attackPathsAsEntry: many(attackPaths, {
    relationName: "entryPoint",
  }),
  attackPathsAsTarget: many(attackPaths, {
    relationName: "attackTarget",
  }),
  consequenceChains: many(consequenceChains),
}));

export const assetRelationshipsRelations = relations(
  assetRelationships,
  ({ one }) => ({
    source: one(assets, {
      fields: [assetRelationships.sourceId],
      references: [assets.id],
      relationName: "sourceAsset",
    }),
    target: one(assets, {
      fields: [assetRelationships.targetId],
      references: [assets.id],
      relationName: "targetAsset",
    }),
  })
);

// ============================================
// MULTI-TENANT RELATIONS
// ============================================

export const clientsRelations = relations(clients, ({ many }) => ({
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  client: one(clients, {
    fields: [sites.clientId],
    references: [clients.id],
  }),
  assets: many(assets),
  gaps: many(gaps),
  snapshots: many(snapshots),
  ingestionJobs: many(ingestionJobs),
  dataSources: many(dataSources),
  coverageZones: many(coverageZones),
}));

export const gapsRelations = relations(gaps, ({ one }) => ({
  site: one(sites, {
    fields: [gaps.siteId],
    references: [sites.id],
  }),
}));

export const snapshotsRelations = relations(snapshots, ({ one }) => ({
  site: one(sites, {
    fields: [snapshots.siteId],
    references: [sites.id],
  }),
}));

export const ingestionJobsRelations = relations(ingestionJobs, ({ one }) => ({
  site: one(sites, {
    fields: [ingestionJobs.siteId],
    references: [sites.id],
  }),
}));

// ============================================
// DATA SOURCE RELATIONS
// ============================================

export const dataSourcesRelations = relations(dataSources, ({ one, many }) => ({
  site: one(sites, {
    fields: [dataSources.siteId],
    references: [sites.id],
  }),
  confirmations: many(assetConfirmations),
}));

export const assetConfirmationsRelations = relations(assetConfirmations, ({ one }) => ({
  asset: one(assets, {
    fields: [assetConfirmations.assetId],
    references: [assets.id],
  }),
  dataSource: one(dataSources, {
    fields: [assetConfirmations.dataSourceId],
    references: [dataSources.id],
  }),
}));

export const coverageZonesRelations = relations(coverageZones, ({ one }) => ({
  site: one(sites, {
    fields: [coverageZones.siteId],
    references: [sites.id],
  }),
}));
