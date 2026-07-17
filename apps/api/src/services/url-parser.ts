import { appError } from "@probable/schemas";

const ALLOWED_HOSTS = new Set(["polymarket.com", "www.polymarket.com"]);

export type ParsedPolymarketUrl = { kind: "event"; slug: string } | { kind: "market"; slug: string };

/**
 * Only an allowlisted Polymarket hostname may be parsed — never fetch an
 * arbitrary user-provided URL (AGENTS.md §3 security / SSRF rule).
 */
export function parsePolymarketUrl(rawUrl: string): ParsedPolymarketUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw appError("INVALID_TARGET", "Target URL is not a valid URL.");
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw appError("INVALID_TARGET", "Target URL host is not an allowlisted Polymarket domain.", {
      host: url.hostname,
    });
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "event" && segments[1]) {
    return { kind: "event", slug: segments[1] };
  }
  if (segments[0] === "market" && segments[1]) {
    return { kind: "market", slug: segments[1] };
  }

  throw appError("INVALID_TARGET", "Unsupported Polymarket URL shape.", { path: url.pathname });
}
