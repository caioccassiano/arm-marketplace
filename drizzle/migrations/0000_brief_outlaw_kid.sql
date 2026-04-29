CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"order_number" varchar(100),
	"status" varchar(50) NOT NULL,
	"marketplace" varchar(50),
	"customer_name" varchar(255),
	"total_amount" numeric(12, 2) NOT NULL,
	"marketplace_fee" numeric(12, 2) DEFAULT '0',
	"shipping_fee" numeric(12, 2) DEFAULT '0',
	"net_amount" numeric(12, 2),
	"ordered_at" timestamp NOT NULL,
	"raw_data" jsonb,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"magazord_order_id" integer,
	"marketplace_order_id" integer,
	"magazord_amount" numeric(12, 2),
	"marketplace_amount" numeric(12, 2),
	"amount_diff" numeric(12, 2),
	"magazord_fee" numeric(12, 2),
	"marketplace_fee" numeric(12, 2),
	"fee_diff" numeric(12, 2),
	"notes" text,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"marketplace" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_by" integer,
	"total_magazord_orders" integer DEFAULT 0,
	"total_marketplace_orders" integer DEFAULT 0,
	"matched_count" integer DEFAULT 0,
	"amount_mismatch_count" integer DEFAULT 0,
	"magazord_only_count" integer DEFAULT 0,
	"marketplace_only_count" integer DEFAULT 0,
	"total_amount_diff" numeric(12, 2) DEFAULT '0',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_session_id_reconciliation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."reconciliation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_magazord_order_id_orders_id_fk" FOREIGN KEY ("magazord_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_marketplace_order_id_orders_id_fk" FOREIGN KEY ("marketplace_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_source_external_id_idx" ON "orders" USING btree ("source","external_id");