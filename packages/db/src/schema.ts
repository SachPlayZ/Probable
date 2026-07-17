import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { SERVICE_IDS } from "@probable/config";

export const serviceEnum = pgEnum("service", SERVICE_IDS);
export const upstreamProviderEnum = pgEnum("upstream_provider", ["gamma", "clob", "data"]);
export const socialCardStatusEnum = pgEnum("social_card_status", ["not_requested", "pending", "ready", "failed"]);
export const serviceUsageStatusEnum = pgEnum("service_usage_status", ["ok", "error"]);
export const cacheStatusEnum = pgEnum("cache_status", ["hit", "miss", "stale-fallback"]);
export const paymentStatusEnum = pgEnum("payment_status", ["paid", "free"]);

/**
 * PLAN.md §17. Public IDs are random and non-sequential (AGENTS.md §15) — generated
 * at the application layer, never derived from the primary key.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull().unique(),
    service: serviceEnum("service").notNull(),
    requestHash: text("request_hash").notNull(),
    // PLAN.md §13 idempotency: same key + same payload hash → same report; same key +
    // different payload hash → 409 IDEMPOTENCY_CONFLICT (enforced at the repository layer).
    idempotencyKey: text("idempotency_key").unique(),
    // Redacted before persistence — never payment headers or secrets (AGENTS.md §15).
    requestPayload: jsonb("request_payload").notNull(),
    resultPayload: jsonb("result_payload").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    marketId: text("market_id").notNull(),
    eventId: text("event_id"),
    dataAsOf: timestamp("data_as_of", { withTimezone: true }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    public: boolean("public").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    socialCardStatus: socialCardStatusEnum("social_card_status").notNull().default("not_requested"),
    socialCardUrl: text("social_card_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_request_hash_idx").on(table.requestHash),
    index("reports_market_id_idx").on(table.marketId),
  ],
);

export const upstreamFetches = pgTable(
  "upstream_fetches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: text("request_id").notNull(),
    provider: upstreamProviderEnum("provider").notNull(),
    endpointKey: text("endpoint_key").notNull(),
    statusCode: integer("status_code").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    schemaVersion: text("schema_version").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    errorCode: text("error_code"),
  },
  (table) => [index("upstream_fetches_request_id_idx").on(table.requestId)],
);

export const serviceUsage = pgTable("service_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: text("request_id").notNull().unique(),
  service: serviceEnum("service").notNull(),
  status: serviceUsageStatusEnum("status").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  cacheStatus: cacheStatusEnum("cache_status").notNull(),
  // Category only — never a payment secret, signature, or authorization payload.
  paymentStatus: paymentStatusEnum("payment_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const methodologyVersions = pgTable("methodology_versions", {
  version: text("version").primaryKey(),
  configuration: jsonb("configuration").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
