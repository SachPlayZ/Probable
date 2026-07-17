import { randomBytes } from "node:crypto";

/** Random, non-sequential public report ID (AGENTS.md §15) — never derived from the primary key. */
export function generatePublicId(): string {
  return randomBytes(9).toString("base64url");
}
