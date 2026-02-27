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
    tagNumber: varchar("tag_number", { length: 100 }).notNull().unique(),
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

    // Metadata
    sourceSystem: varchar("source_system", { length: 100 }),
    verified: boolean("verified").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tagNumberIdx: uniqueIndex("tag_number_idx").on(table.tagNumber),
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
// BUILD CLOCK / RISK PROPORTIONALITY
// ============================================

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

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
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
});

// ============================================
// RELATIONS
// ============================================

export const assetsRelations = relations(assets, ({ many }) => ({
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
