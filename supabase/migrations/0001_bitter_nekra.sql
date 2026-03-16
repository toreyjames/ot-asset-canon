CREATE TABLE "derived_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid,
	"company_id" uuid,
	"geo_id" uuid,
	"project_id" uuid,
	"signal_type" varchar(100) NOT NULL,
	"value" varchar(255),
	"unit" varchar(50),
	"evidence_id" uuid,
	"observed_at" timestamp NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_record_id" uuid,
	"facility_id" uuid,
	"company_id" uuid,
	"geo_id" uuid,
	"project_id" uuid,
	"source_name" varchar(255) NOT NULL,
	"dataset" varchar(255) NOT NULL,
	"evidence_type" varchar(100) NOT NULL,
	"source_url" text,
	"confidence_score" integer DEFAULT 0,
	"observed_at" timestamp NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"signal_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industrial_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid,
	"company_id" uuid,
	"geo_id" uuid,
	"project_type" varchar(100) NOT NULL,
	"sector" varchar(100),
	"investment_amount" numeric(18, 2),
	"announcement_date" timestamp,
	"construction_start" timestamp,
	"completion_estimate" timestamp,
	"status" varchar(50) DEFAULT 'observed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_hypotheses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid,
	"project_id" uuid,
	"hypothesis_type" varchar(100) NOT NULL,
	"value" varchar(255),
	"confidence_score" integer DEFAULT 0,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_version" varchar(100),
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "program_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"program_type" varchar(100) NOT NULL,
	"external_program_id" varchar(255) NOT NULL,
	"agency" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "derived_signals" ADD CONSTRAINT "derived_signals_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_signals" ADD CONSTRAINT "derived_signals_company_id_entity_master_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."entity_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_signals" ADD CONSTRAINT "derived_signals_geo_id_geo_dim_id_fk" FOREIGN KEY ("geo_id") REFERENCES "public"."geo_dim"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_signals" ADD CONSTRAINT "derived_signals_project_id_industrial_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."industrial_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_signals" ADD CONSTRAINT "derived_signals_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_company_id_entity_master_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."entity_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_geo_id_geo_dim_id_fk" FOREIGN KEY ("geo_id") REFERENCES "public"."geo_dim"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_project_id_industrial_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."industrial_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_events" ADD CONSTRAINT "facility_events_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_events" ADD CONSTRAINT "facility_events_signal_id_derived_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."derived_signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "industrial_projects" ADD CONSTRAINT "industrial_projects_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "industrial_projects" ADD CONSTRAINT "industrial_projects_company_id_entity_master_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."entity_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "industrial_projects" ADD CONSTRAINT "industrial_projects_geo_id_geo_dim_id_fk" FOREIGN KEY ("geo_id") REFERENCES "public"."geo_dim"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_hypotheses" ADD CONSTRAINT "model_hypotheses_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_hypotheses" ADD CONSTRAINT "model_hypotheses_project_id_industrial_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."industrial_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_links" ADD CONSTRAINT "program_links_facility_id_facility_master_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signal_facility_idx" ON "derived_signals" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "signal_type_idx" ON "derived_signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "signal_observed_idx" ON "derived_signals" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "evidence_facility_idx" ON "evidence_records" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "evidence_company_idx" ON "evidence_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "evidence_dataset_idx" ON "evidence_records" USING btree ("dataset");--> statement-breakpoint
CREATE INDEX "evidence_observed_idx" ON "evidence_records" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "facility_event_facility_idx" ON "facility_events" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_event_type_idx" ON "facility_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "facility_event_occurred_idx" ON "facility_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "project_facility_idx" ON "industrial_projects" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "project_company_idx" ON "industrial_projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "industrial_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hypothesis_facility_idx" ON "model_hypotheses" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "hypothesis_type_idx" ON "model_hypotheses" USING btree ("hypothesis_type");--> statement-breakpoint
CREATE INDEX "program_facility_idx" ON "program_links" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "program_type_idx" ON "program_links" USING btree ("program_type");--> statement-breakpoint
CREATE UNIQUE INDEX "program_facility_external_idx" ON "program_links" USING btree ("facility_id","program_type","external_program_id");