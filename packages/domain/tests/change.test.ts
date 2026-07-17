import { describe, expect, it } from "vitest";
import { changePp, toPercent } from "../src/probability/change.js";

describe("changePp", () => {
  it("40% to 48% is +8 percentage points, not +8%", () => {
    expect(changePp("0.48", "0.40")).toBe("8");
  });

  it("handles decreases as negative pp", () => {
    expect(changePp("0.40", "0.48")).toBe("-8");
  });

  it("zero change is exactly 0, not a floating-point near-zero", () => {
    expect(changePp("0.1", "0.1")).toBe("0");
  });
});

describe("toPercent", () => {
  it("converts a probability to a percentage string", () => {
    expect(toPercent("0.505")).toBe("50.5");
  });
});
