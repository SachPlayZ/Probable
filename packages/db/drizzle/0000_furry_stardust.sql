CREATE TYPE "public"."cache_status" AS ENUM('hit', 'miss', 'stale-fallback');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'free');--> statement-breakpoint
CREATE TYPE "public"."service" AS ENUM('search', 'snapshot', 'vitals', 'resolution_audit', 'contradictions', 'full_report');--> statement-breakpoint
CREATE TYPE "public"."service_usage_status" AS ENUM('ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."social_card_status" AS ENUM('not_requested', 'pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."upstream_provider" AS ENUM('gamma', 'clob', 'data');--> statement-breakpoint
CREATE TABLE "methodology_versions" (
	"version" text PRIMARY KEY NOT NULL,
	"configuration" jsonb NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"service" "service" NOT NULL,
	"request_hash" text NOT NULL,
	"idempotency_key" text,
	"request_payload" jsonb NOT NULL,
	"result_payload" jsonb NOT NULL,
	"methodology_version" text NOT NULL,
	"market_id" text NOT NULL,
	"event_id" text,
	"data_as_of" timestamp with time zone NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"social_card_status" "social_card_status" DEFAULT 'not_requested' NOT NULL,
	"social_card_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "reports_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "service_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"service" "service" NOT NULL,
	"status" "service_usage_status" NOT NULL,
	"latency_ms" integer NOT NULL,
	"cache_status" "cache_status" NOT NULL,
	"payment_status" "payment_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_usage_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "upstream_fetches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"provider" "upstream_provider" NOT NULL,
	"endpoint_key" text NOT NULL,
	"status_code" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"schema_version" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_code" text
);
--> statement-breakpoint
CREATE INDEX "reports_request_hash_idx" ON "reports" USING btree ("request_hash");--> statement-breakpoint
CREATE INDEX "reports_market_id_idx" ON "reports" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "upstream_fetches_request_id_idx" ON "upstream_fetches" USING btree ("request_id");