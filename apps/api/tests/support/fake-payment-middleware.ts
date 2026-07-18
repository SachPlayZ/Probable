import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AppConfig, PaidRouteConfig } from "@probable/config";

/**
 * Wire-format-faithful stand-in for @okxweb3/x402-express's paymentMiddleware.
 *
 * The real SDK's "supported kinds" sync is an authenticated OKX facilitator call that
 * 401s without production credentials (verified by reading OKXFacilitatorClient's
 * source — see apps/api/src/config/payments.ts comment), so it cannot run against a
 * live facilitator in this environment. This fake reproduces the exact PaymentRequired
 * v2 JSON shape (confirmed from @okxweb3/x402-core's PaymentRequiredSchema) so the test
 * suite can still verify our own middleware ordering, challenge decoding, and
 * handler-not-invoked behavior deterministically. It is never used outside tests/.
 */
export function fakePaymentMiddleware(config: AppConfig, routes: PaidRouteConfig[]): RequestHandler {
  // Keyed by path only, not "METHOD path": the real SDK's route pattern parser
  // treats a bare path as verb "*" (see apps/api/src/config/payments.ts), so the
  // challenge fires for any HTTP method on a protected resource, not just POST.
  const byPath = new Map(routes.map((r) => [r.path, r]));

  return (req: Request, res: Response, next: NextFunction): void => {
    const route = byPath.get(req.path);
    if (!route) {
      next();
      return;
    }

    const hasPayment = Boolean(req.headers["x-payment"] || req.headers["payment-signature"]);
    if (hasPayment) {
      next();
      return;
    }

    const challenge = {
      x402Version: 2,
      resource: { url: `${config.publicApiUrl}${route.path}`, description: route.description, mimeType: "application/json" },
      accepts: [
        {
          scheme: "exact",
          network: route.network,
          amount: "10000",
          asset: config.x402.assetAddress,
          payTo: route.payTo,
          maxTimeoutSeconds: 300,
        },
      ],
    };

    res.setHeader("payment-required", Buffer.from(JSON.stringify(challenge)).toString("base64"));
    res.status(402).json({ x402Version: 2, error: "payment_required" });
  };
}
