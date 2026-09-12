import { describe, expect, it } from "vitest";

import {
  divergingAxisMax,
  divergingBarWidthPercent,
  joinRestaurantNames,
  pctVsMedian,
  priceBarPercent,
  rangePositionPercent,
} from "./priceScale";

describe("priceBarPercent", () => {
  it("scales from $0 to the group max", () => {
    expect(priceBarPercent(19.95, 36)).toBeCloseTo((19.95 / 36) * 100);
    expect(priceBarPercent(36, 36)).toBe(100);
  });

  it("returns null for unpriced or invalid values", () => {
    expect(priceBarPercent(null, 36)).toBeNull();
    expect(priceBarPercent(20, null)).toBeNull();
    expect(priceBarPercent(20, 0)).toBeNull();
    expect(priceBarPercent(-1, 36)).toBeNull();
  });
});

describe("rangePositionPercent", () => {
  it("places the median between min and max", () => {
    expect(rangePositionPercent(28, 19.95, 36)).toBeCloseTo(((28 - 19.95) / (36 - 19.95)) * 100);
  });

  it("sits in the middle when the range is a single price", () => {
    expect(rangePositionPercent(18, 18, 18)).toBe(50);
  });

  it("returns null without a usable range", () => {
    expect(rangePositionPercent(28, null, 36)).toBeNull();
    expect(rangePositionPercent(28, 36, 19.95)).toBeNull();
  });
});

describe("pctVsMedian", () => {
  it("is negative when cheaper than the median", () => {
    expect(pctVsMedian(12, 18.95)).toBeCloseTo(((12 - 18.95) / 18.95) * 100);
  });

  it("returns null without a usable median", () => {
    expect(pctVsMedian(12, null)).toBeNull();
    expect(pctVsMedian(null, 18.95)).toBeNull();
    expect(pctVsMedian(12, 0)).toBeNull();
  });
});

describe("divergingAxisMax", () => {
  it("rounds up to a readable symmetric tick", () => {
    expect(divergingAxisMax([-37, 8, 79])).toBe(80);
    expect(divergingAxisMax([-12, 5])).toBe(15);
  });
});

describe("divergingBarWidthPercent", () => {
  it("maps a percent onto half the track", () => {
    expect(divergingBarWidthPercent(-37, 60)).toBeCloseTo((37 / 60) * 50);
    expect(divergingBarWidthPercent(60, 60)).toBe(50);
  });
});

describe("joinRestaurantNames", () => {
  it("uses and for two names", () => {
    expect(joinRestaurantNames(["Quattro", "Il Molo"])).toBe("Quattro and Il Molo");
  });
});
