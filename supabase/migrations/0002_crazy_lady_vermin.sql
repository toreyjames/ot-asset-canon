CREATE TABLE "client_data_boundary_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"mode" varchar(32) DEFAULT 'customer_agent' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_data_boundary_settings" ADD CONSTRAINT "client_data_boundary_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_data_boundary_client_idx" ON "client_data_boundary_settings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_data_boundary_mode_idx" ON "client_data_boundary_settings" USING btree ("mode");