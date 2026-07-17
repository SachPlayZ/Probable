import { Decimal } from "decimal.js";

/** Fixed base buffer covering fees/slippage/model uncertainty — methodology v1. */
const BASE_BUFFER = new Decimal("0.03");

export interface MultiOutcomeSumResult {
  sumMidpoints: string;
  rawExcess: string;
  buffer: string;
  flagged: boolean;
}

/**
 * PLAN.md §12.5 mode A — for a confirmed mutually-exclusive, collectively-exhaustive
 * outcome set. Flag only when the excess above 1.0 clears a conservative buffer built
 * from the base constant plus half of each market's visible spread — never flag on a
 * bare raw_excess > 0 (AGENTS.md §3: "never surface a discrepancy below the cost/
 * uncertainty buffer").
 */
export function multiOutcomeSumCheck(midpoints: string[], spreads: string[]): MultiOutcomeSumResult {
  const sumMidpoints = midpoints.reduce((sum, m) => sum.plus(m), new Decimal(0));
  const rawExcess = sumMidpoints.minus(1);
  const halfSpreadTotal = spreads.reduce((sum, s) => sum.plus(new Decimal(s).div(2)), new Decimal(0));
  const buffer = BASE_BUFFER.plus(halfSpreadTotal);

  return {
    sumMidpoints: sumMidpoints.toString(),
    rawExcess: rawExcess.toString(),
    buffer: buffer.toString(),
    flagged: rawExcess.gt(buffer),
  };
}
