import { eq } from "drizzle-orm";
import type { ServiceId } from "@probable/config";
import type { Database } from "../client.js";
import { reports } from "../schema.js";
import { generatePublicId } from "../public-id.js";

/** Domain type returned to callers — never a raw Drizzle row (AGENTS.md §15). */
export interface PersistedReport {
  publicId: string;
  service: ServiceId;
  marketId: string;
  eventId: string | undefined;
  methodologyVersion: string;
  dataAsOf: string;
  generatedAt: string;
  isPublic: boolean;
  resultPayload: unknown;
  requestHash: string;
}

export interface CreateReportInput {
  service: ServiceId;
  requestHash: string;
  idempotencyKey: string | undefined;
  requestPayload: unknown;
  resultPayload: unknown;
  methodologyVersion: string;
  marketId: string;
  eventId: string | undefined;
  dataAsOf: Date;
  generatedAt: Date;
  isPublic: boolean;
}

function toDomain(row: typeof reports.$inferSelect): PersistedReport {
  return {
    publicId: row.publicId,
    service: row.service,
    marketId: row.marketId,
    eventId: row.eventId ?? undefined,
    methodologyVersion: row.methodologyVersion,
    dataAsOf: row.dataAsOf.toISOString(),
    generatedAt: row.generatedAt.toISOString(),
    isPublic: row.public,
    resultPayload: row.resultPayload,
    requestHash: row.requestHash,
  };
}

export class ReportsRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateReportInput): Promise<PersistedReport> {
    const [row] = await this.db
      .insert(reports)
      .values({
        publicId: generatePublicId(),
        service: input.service,
        requestHash: input.requestHash,
        idempotencyKey: input.idempotencyKey,
        requestPayload: input.requestPayload,
        resultPayload: input.resultPayload,
        methodologyVersion: input.methodologyVersion,
        marketId: input.marketId,
        eventId: input.eventId,
        dataAsOf: input.dataAsOf,
        generatedAt: input.generatedAt,
        public: input.isPublic,
      })
      .returning();

    if (!row) throw new Error("Report insert returned no row.");
    return toDomain(row);
  }

  async findByPublicId(publicId: string): Promise<PersistedReport | undefined> {
    const [row] = await this.db.select().from(reports).where(eq(reports.publicId, publicId)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  /** Idempotency support (PLAN.md §13) — same request_hash returns the same report. */
  async findByRequestHash(requestHash: string): Promise<PersistedReport | undefined> {
    const [row] = await this.db.select().from(reports).where(eq(reports.requestHash, requestHash)).limit(1);
    return row ? toDomain(row) : undefined;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PersistedReport | undefined> {
    const [row] = await this.db.select().from(reports).where(eq(reports.idempotencyKey, idempotencyKey)).limit(1);
    return row ? toDomain(row) : undefined;
  }
}
