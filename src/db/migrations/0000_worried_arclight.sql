CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."fighter_alias_kind" AS ENUM('nickname', 'ring_name', 'spelling_variant', 'birth_name');--> statement-breakpoint
CREATE TYPE "public"."fighter_publication_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."fighter_stance" AS ENUM('orthodox', 'southpaw', 'switch');--> statement-breakpoint
CREATE TYPE "public"."fighter_status" AS ENUM('active', 'inactive', 'retired', 'deceased');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('official', 'media_report', 'editorial', 'user_submission', 'licensed_feed');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('verified', 'unverified', 'user_submitted', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."weight_class_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher" text NOT NULL,
	"title" text,
	"url" text,
	"source_type" "source_type" NOT NULL,
	"published_at" date,
	"retrieved_at" date,
	"license_name" text,
	"license_url" text,
	"license_notes" text,
	"archived_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"gender" "weight_class_gender" NOT NULL,
	"limit_lbs" numeric(5, 1),
	"sort_order" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weight_classes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "fighters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"nickname" text,
	"birth_date" date,
	"nationality" char(2),
	"stance" "fighter_stance",
	"height_cm" smallint,
	"reach_cm" smallint,
	"status" "fighter_status" NOT NULL,
	"primary_weight_class_id" uuid,
	"publication_status" "fighter_publication_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fighters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "fighter_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fighter_id" uuid NOT NULL,
	"field_name" text,
	"source_document_id" uuid NOT NULL,
	"source_value" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" NOT NULL,
	"notes" text,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fighter_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fighter_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"kind" "fighter_alias_kind" NOT NULL,
	"source_document_id" uuid,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_primary_weight_class_id_weight_classes_id_fk" FOREIGN KEY ("primary_weight_class_id") REFERENCES "public"."weight_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_evidence" ADD CONSTRAINT "fighter_evidence_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_evidence" ADD CONSTRAINT "fighter_evidence_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_aliases" ADD CONSTRAINT "fighter_aliases_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_aliases" ADD CONSTRAINT "fighter_aliases_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fighter_evidence_fighter" ON "fighter_evidence" USING btree ("fighter_id");--> statement-breakpoint
CREATE INDEX "fighter_evidence_source" ON "fighter_evidence" USING btree ("source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fighter_aliases_fighter_lower_alias" ON "fighter_aliases" USING btree ("fighter_id",lower("alias"));