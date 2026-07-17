import type { NextFunction, Request, Response } from "express";
import { appError } from "@probable/schemas";

const MAX_BODY_BYTES = 32 * 1024; // AGENTS.md §19 default request-size limit.

export function bodySizeGuard(maxBytes: number = MAX_BODY_BYTES) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const contentLength = req.headers["content-length"];
    if (contentLength && Number(contentLength) > maxBytes) {
      next(appError("INVALID_REQUEST", `Request body exceeds ${maxBytes} byte limit.`));
      return;
    }
    next();
  };
}
