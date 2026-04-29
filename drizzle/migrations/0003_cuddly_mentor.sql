CREATE TABLE "lucratividade" (
	"id" serial PRIMARY KEY NOT NULL,
	"feitoria_id" integer NOT NULL,
	"fees_snapshot" jsonb NOT NULL,
	"investimento_ads" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lucratividade_feitoria_id_unique" UNIQUE("feitoria_id")
);
--> statement-breakpoint
ALTER TABLE "lucratividade" ADD CONSTRAINT "lucratividade_feitoria_id_feitorias_id_fk" FOREIGN KEY ("feitoria_id") REFERENCES "public"."feitorias"("id") ON DELETE cascade ON UPDATE no action;