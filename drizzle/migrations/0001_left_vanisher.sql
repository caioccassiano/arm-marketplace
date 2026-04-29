CREATE TABLE "cmv_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(100) NOT NULL,
	"produto_id" varchar(100),
	"descricao" text,
	"preco" numeric(12, 2) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cmv_products_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "feitorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"created_by" integer,
	"payload" jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"total_diff" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feitorias" ADD CONSTRAINT "feitorias_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;