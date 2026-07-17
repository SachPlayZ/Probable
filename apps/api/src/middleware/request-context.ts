import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "@probable/logger";
import { withRequestId } from "@probable/logger";

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
    log: Logger;
  }
}

export function requestContext(baseLogger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = `req_${randomUUID()}`;
    req.requestId = requestId;
    req.log = withRequestId(baseLogger, requestId);
    res.setHeader("x-request-id", requestId);

    const startedAt = Date.now();
    res.on("finish", () => {
      req.log.info(
        {
          route: req.route?.path ?? req.path,
          method: req.method,
          status: res.statusCode,
          latencyMs: Date.now() - startedAt,
        },
        "request completed",
      );
    });

    next();
  };
}
