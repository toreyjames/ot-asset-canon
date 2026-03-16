CREATE TABLE "asset_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"confirmed_at" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp,
	"fields_provided" jsonb,
	"source_asset_id" varchar(255),
	"source_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"consequence_if_compromised" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid,
	"tag_number" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"asset_type" varchar(50) NOT NULL,
	"layer" integer NOT NULL,
	"engineering" jsonb,
	"control_system" jsonb,
	"ip_address" "inet",
	"mac_address" varchar(17),
	"vlan" integer,
	"network_zone" varchar(100),
	"protocols" jsonb,
	"cve_count" integer DEFAULT 0,
	"critical_cve_count" integer DEFAULT 0,
	"high_cve_count" integer DEFAULT 0,
	"patchable" boolean DEFAULT true,
	"patch_constraint" text,
	"compensating_controls" jsonb,
	"monitoring_coverage" varchar(100),
	"last_security_assessment" timestamp,
	"risk_tier" varchar(20) DEFAULT 'medium' NOT NULL,
	"risk_justification" text,
	"criticality" varchar(50) DEFAULT 'important',
	"redundancy" varchar(50),
	"mtbf" numeric(10, 2),
	"spare_availability" varchar(255),
	"last_calibration" timestamp,
	"maintenance_schedule" varchar(255),
	"end_of_life" timestamp,
	"confirmation_status" varchar(20) DEFAULT 'inferred',
	"confidence_score" integer DEFAULT 0,
	"confirmation_count" integer DEFAULT 0,
	"inferred_from" jsonb,
	"first_confirmed_at" timestamp,
	"last_confirmed_at" timestamp,
	"source_system" varchar(100),
	"verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attack_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_point_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"path_steps" jsonb NOT NULL,
	"consequence_severity" varchar(20) NOT NULL,
	"likelihood_score" numeric(5, 4),
	"attack_vector" text NOT NULL,
	"mitigations" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"industry" varchar(100),
	"logo_url" text,
	"primary_contact" varchar(255),
	"contact_email" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "consequence_chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_asset_id" uuid NOT NULL,
	"trigger_event" text NOT NULL,
	"steps" jsonb NOT NULL,
	"ultimate_consequence" text NOT NULL,
	"severity" varchar(20) NOT NULL,
	"regulatory_impact" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"layer" integer,
	"total_assets" integer DEFAULT 0,
	"confirmed_assets" integer DEFAULT 0,
	"inferred_assets" integer DEFAULT 0,
	"coverage_percent" integer DEFAULT 0,
	"collector_count" integer DEFAULT 0,
	"recommendation" varchar(20),
	"recommendation_rationale" text,
	"network_segment" varchar(100),
	"visual_color" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"vendor" varchar(100),
	"version" varchar(50),
	"description" text,
	"confidence_weight" integer DEFAULT 50 NOT NULL,
	"confidence_rationale" text,
	"is_collector" boolean DEFAULT false,
	"collector_location" varchar(255),
	"coverage_zones" jsonb,
	"last_sync" timestamp,
	"sync_frequency" varchar(50),
	"sync_status" varchar(20) DEFAULT 'active',
	"last_error" text,
	"asset_count" integer DEFAULT 0,
	"connection_count" integer DEFAULT 0,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_master" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"country" varchar(2) DEFAULT 'US',
	"website_domain" varchar(255),
	"identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"address" jsonb,
	"confidence_score" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_resolution_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_record_id" uuid NOT NULL,
	"entity_id" uuid,
	"facility_id" uuid,
	"decision_type" varchar(30) NOT NULL,
	"score" numeric(5, 4) NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"candidate_set" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chosen" boolean DEFAULT false NOT NULL,
	"rationale" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255),
	"facility_type" varchar(100),
	"regulatory_framework" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_master" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"geo_id" uuid,
	"facility_name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"county_fips" varchar(5),
	"cbsa_code" varchar(5),
	"facility_source_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_score" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"gap_type" varchar(50) NOT NULL,
	"category" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"engineering_rationale" text,
	"severity" varchar(20) NOT NULL,
	"layer" integer,
	"related_assets" jsonb,
	"detection_rule" varchar(100),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"dismissed_reason" text,
	"dismissed_by" varchar(255),
	"dismissed_at" timestamp,
	"resolved_by" varchar(255),
	"resolved_at" timestamp,
	"resolution_notes" text,
	"visual_position" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_dim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"county_fips" varchar(5),
	"state_fips" varchar(2),
	"cbsa_code" varchar(5),
	"state_code" varchar(2),
	"county_name" varchar(255),
	"cbsa_name" varchar(255),
	"geometry_ref" text,
	"population" integer,
	"manufacturing_employment" integer,
	"establishment_count" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid,
	"source_type" varchar(50) NOT NULL,
	"file_name" varchar(255),
	"blob_url" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"assets_created" integer DEFAULT 0,
	"assets_updated" integer DEFAULT 0,
	"errors" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_record_id" uuid NOT NULL,
	"provider_entity_id" uuid,
	"recipient_entity_id" uuid,
	"facility_id" uuid,
	"geo_id" uuid,
	"taxonomy_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"amount" numeric(18, 2),
	"amount_type" varchar(30) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"announced_date" timestamp,
	"action_date" timestamp,
	"start_date" timestamp,
	"end_date" timestamp,
	"provider_name" varchar(255),
	"recipient_name" varchar(255),
	"program_name" varchar(255),
	"award_type" varchar(100),
	"sector_naics" varchar(6),
	"psc_code" varchar(10),
	"tech_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jobs_estimate" integer,
	"capex_estimate" numeric(18, 2),
	"county_fips" varchar(5),
	"cbsa_code" varchar(5),
	"place_of_performance" jsonb,
	"recipient_location" jsonb,
	"confidence_score" integer DEFAULT 0,
	"provenance" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permit_or_milestone_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_record_id" uuid NOT NULL,
	"facility_id" uuid,
	"geo_id" uuid,
	"responsible_entity_id" uuid,
	"permit_or_project_id" varchar(255),
	"event_type" varchar(50) NOT NULL,
	"event_date" timestamp NOT NULL,
	"responsible_agency" varchar(255),
	"permit_program" varchar(100),
	"status" varchar(50),
	"county_fips" varchar(5),
	"cbsa_code" varchar(5),
	"notes" text,
	"metadata" jsonb,
	"confidence_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_proportionality_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid,
	"zone" varchar(100),
	"asset_tier" varchar(20),
	"base_risk" numeric(10, 4) NOT NULL,
	"expected_posture" numeric(10, 4) NOT NULL,
	"actual_posture" numeric(10, 4) NOT NULL,
	"judgment" varchar(30) NOT NULL,
	"gap_magnitude" numeric(10, 4),
	"recommendations" jsonb,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"location" varchar(255),
	"timezone" varchar(50),
	"inferred_plant_type" varchar(50),
	"plant_type_confidence" integer,
	"plant_type_evidence" jsonb,
	"asset_count" integer DEFAULT 0,
	"gap_count" integer DEFAULT 0,
	"reconstruction_score" integer DEFAULT 0,
	"can_run_plant" boolean DEFAULT false,
	"layer_scores" jsonb,
	"confirmed_asset_count" integer DEFAULT 0,
	"inferred_asset_count" integer DEFAULT 0,
	"coverage_percent" integer DEFAULT 0,
	"data_source_count" integer DEFAULT 0,
	"collector_count" integer DEFAULT 0,
	"coverage_recommendation" varchar(20),
	"active" boolean DEFAULT true NOT NULL,
	"last_data_ingestion" timestamp,
	"last_analysis" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(255),
	"snapshot_type" varchar(50) NOT NULL,
	"asset_count" integer NOT NULL,
	"gap_count" integer NOT NULL,
	"reconstruction_score" integer NOT NULL,
	"can_run_plant" boolean NOT NULL,
	"layer_scores" jsonb,
	"gaps" jsonb,
	"created_by" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_system" varchar(100) NOT NULL,
	"source_record_id" varchar(255) NOT NULL,
	"source_category" varchar(50) NOT NULL,
	"source_url" text,
	"source_hash" varchar(128),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"effective_date" timestamp,
	"raw_payload" jsonb NOT NULL,
	"extraction_version" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_dim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taxonomy_type" varchar(50) NOT NULL,
	"code" varchar(100) NOT NULL,
	"parent_code" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"hierarchy_level" integer,
	"synonyms" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_confirmations" ADD CONSTRAINT "asset_confirmations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_confirmations" ADD CONSTRAINT "asset_confirmations_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_source_id_assets_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_target_id_assets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_paths" ADD CONSTRAINT "attack_paths_entry_point_id_assets_id_fk" FOREIGN KEY ("entry_point_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attack_paths" ADD CONSTRAINT "attack_paths_target_id_assets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consequence_chains" ADD CONSTRAINT "consequence_chains_trigger_asset_id_assets_id_fk" FOREIGN KEY ("trigger_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_zones" ADD CONSTRAINT "coverage_zones_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_resolution_decisions" ADD CONSTRAINT "entity_resolution_decisions_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_resolution_decisions" ADD CONSTRAINT "entity_resolution_decisions_entity_id_entity_master_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_resolution_decisions" ADD CONSTRAINT "entity_resolution_decisions_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_master" ADD CONSTRAINT "facility_master_entity_id_entity_master_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entity_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_master" ADD CONSTRAINT "facility_master_geo_id_geo_dim_id_fk" FOREIGN KEY ("geo_id") REFERENCES "public"."geo_dim"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gaps" ADD CONSTRAINT "gaps_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_provider_entity_id_entity_master_id_fk" FOREIGN KEY ("provider_entity_id") REFERENCES "public"."entity_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_recipient_entity_id_entity_master_id_fk" FOREIGN KEY ("recipient_entity_id") REFERENCES "public"."entity_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_geo_id_geo_dim_id_fk" FOREIGN KEY ("geo_id") REFERENCES "public"."geo_dim"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_events" ADD CONSTRAINT "investment_events_taxonomy_id_taxonomy_dim_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomy_dim"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_or_milestone_events" ADD CONSTRAINT "permit_or_milestone_events_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_or_milestone_events" ADD CONSTRAINT "permit_or_milestone_events_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_or_milestone_events" ADD CONSTRAINT "permit_or_milestone_events_geo_id_geo_dim_id_fk" FOREIGN KEY ("geo_id") REFERENCES "public"."geo_dim"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_or_milestone_events" ADD CONSTRAINT "permit_or_milestone_events_responsible_entity_id_entity_master_id_fk" FOREIGN KEY ("responsible_entity_id") REFERENCES "public"."entity_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_proportionality_scores" ADD CONSTRAINT "risk_proportionality_scores_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "confirmation_asset_idx" ON "asset_confirmations" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "confirmation_source_idx" ON "asset_confirmations" USING btree ("data_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_asset_source" ON "asset_confirmations" USING btree ("asset_id","data_source_id");--> statement-breakpoint
CREATE INDEX "source_idx" ON "asset_relationships" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "target_idx" ON "asset_relationships" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "relationship_idx" ON "asset_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE UNIQUE INDEX "site_tag_idx" ON "assets" USING btree ("site_id","tag_number");--> statement-breakpoint
CREATE INDEX "asset_site_idx" ON "assets" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "layer_idx" ON "assets" USING btree ("layer");--> statement-breakpoint
CREATE INDEX "asset_type_idx" ON "assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "risk_tier_idx" ON "assets" USING btree ("risk_tier");--> statement-breakpoint
CREATE INDEX "ip_address_idx" ON "assets" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "entry_point_idx" ON "attack_paths" USING btree ("entry_point_id");--> statement-breakpoint
CREATE INDEX "attack_target_idx" ON "attack_paths" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "severity_idx" ON "attack_paths" USING btree ("consequence_severity");--> statement-breakpoint
CREATE INDEX "zone_site_idx" ON "coverage_zones" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "datasource_site_idx" ON "data_sources" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "datasource_type_idx" ON "data_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "entity_normalized_name_idx" ON "entity_master" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "entity_type_idx" ON "entity_master" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "entity_website_domain_idx" ON "entity_master" USING btree ("website_domain");--> statement-breakpoint
CREATE INDEX "resolution_source_idx" ON "entity_resolution_decisions" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "resolution_entity_idx" ON "entity_resolution_decisions" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "resolution_facility_idx" ON "entity_resolution_decisions" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_entity_idx" ON "facility_master" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "facility_geo_idx" ON "facility_master" USING btree ("geo_id");--> statement-breakpoint
CREATE INDEX "facility_county_idx" ON "facility_master" USING btree ("county_fips");--> statement-breakpoint
CREATE INDEX "facility_cbsa_idx" ON "facility_master" USING btree ("cbsa_code");--> statement-breakpoint
CREATE INDEX "facility_normalized_name_idx" ON "facility_master" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "gap_site_idx" ON "gaps" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "gap_status_idx" ON "gaps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gap_severity_idx" ON "gaps" USING btree ("severity");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_county_fips_idx" ON "geo_dim" USING btree ("county_fips");--> statement-breakpoint
CREATE INDEX "geo_cbsa_idx" ON "geo_dim" USING btree ("cbsa_code");--> statement-breakpoint
CREATE INDEX "geo_state_idx" ON "geo_dim" USING btree ("state_fips");--> statement-breakpoint
CREATE INDEX "ingestion_site_idx" ON "ingestion_jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "ingestion_status_idx" ON "ingestion_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "investment_source_idx" ON "investment_events" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "investment_event_type_idx" ON "investment_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "investment_amount_type_idx" ON "investment_events" USING btree ("amount_type");--> statement-breakpoint
CREATE INDEX "investment_action_date_idx" ON "investment_events" USING btree ("action_date");--> statement-breakpoint
CREATE INDEX "investment_county_idx" ON "investment_events" USING btree ("county_fips");--> statement-breakpoint
CREATE INDEX "investment_cbsa_idx" ON "investment_events" USING btree ("cbsa_code");--> statement-breakpoint
CREATE INDEX "investment_naics_idx" ON "investment_events" USING btree ("sector_naics");--> statement-breakpoint
CREATE INDEX "permit_source_idx" ON "permit_or_milestone_events" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "permit_event_date_idx" ON "permit_or_milestone_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "permit_program_idx" ON "permit_or_milestone_events" USING btree ("permit_program");--> statement-breakpoint
CREATE INDEX "permit_county_idx" ON "permit_or_milestone_events" USING btree ("county_fips");--> statement-breakpoint
CREATE INDEX "permit_cbsa_idx" ON "permit_or_milestone_events" USING btree ("cbsa_code");--> statement-breakpoint
CREATE INDEX "facility_idx" ON "risk_proportionality_scores" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "judgment_idx" ON "risk_proportionality_scores" USING btree ("judgment");--> statement-breakpoint
CREATE INDEX "site_client_idx" ON "sites" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_slug_idx" ON "sites" USING btree ("client_id","slug");--> statement-breakpoint
CREATE INDEX "snapshot_site_idx" ON "snapshots" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "snapshot_type_idx" ON "snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE UNIQUE INDEX "source_system_record_idx" ON "source_records" USING btree ("source_system","source_record_id");--> statement-breakpoint
CREATE INDEX "source_category_idx" ON "source_records" USING btree ("source_category");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_type_code_idx" ON "taxonomy_dim" USING btree ("taxonomy_type","code");--> statement-breakpoint
CREATE INDEX "taxonomy_parent_idx" ON "taxonomy_dim" USING btree ("parent_code");