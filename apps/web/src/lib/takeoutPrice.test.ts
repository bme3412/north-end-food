import { describe, expect, it } from "vitest";

import { formatAppBand, formatMoney, takeoutQuote } from "./takeoutPrice";

describe("takeoutQuote", () => {
  it("adds Boston meals tax and a typical app band", () => {
    const quote = takeoutQuote(17.5);
    expect(quote).toEqual({
      menu: 17.5,
      pickup: 18.73,
      appLow: 22.48,
      appHigh: 25.29,
    });
    expect(formatMoney(quote!.pickup)).toBe("$18.73");
    expect(formatAppBand(quote!)).toBe("$22.48–$25.29");
  });

  it("ignores missing prices", () => {
    expect(takeoutQuote(null)).toBeNull();
  });
});
