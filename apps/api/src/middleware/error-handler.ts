import type { NextFunction, Request, Response } from "express";
import { AppError, appError, errorEnvelope } from "@probable/schemas";
import { ZodError } from "zod";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

/**
 * Single place errors become JSON — never leak a stack trace or raw provider
 * payload to the client (AGENTS.md §7 / §13).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? "req_unknown";

  let mapped: AppError;
  if (err instanceof AppError) {
    mapped = err;
  } else if (err instanceof ZodError) {
    mapped = appError("INVALID_REQUEST", "Request failed validation.", {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  } else {
    req.log?.error({ err: err instanceof Error ? err.message : String(err) }, "unhandled error");
    mapped = appError("INTERNAL_ERROR", "An internal error occurred.");
  }

  if (mapped.code === "INTERNAL_ERROR") {
    req.log?.error({ code: mapped.code }, mapped.message);
  } else {
    req.log?.warn({ code: mapped.code }, mapped.message);
  }

  res
    .status(mapped.status)
    .json(errorEnvelope(mapped.code, mapped.message, requestId, mapped.retryable, mapped.details));
}

export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json(errorEnvelope("MARKET_NOT_FOUND", "No route matches this path.", req.requestId ?? "req_unknown", false));
}
