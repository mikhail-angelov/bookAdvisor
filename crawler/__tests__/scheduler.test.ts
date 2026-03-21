import { getMillisecondsUntilNextUtcMidnight } from "../scheduler";

describe("daily crawl scheduler", () => {
  it("calculates the delay to the next UTC midnight", () => {
    const now = new Date("2026-03-22T15:30:45.000Z");
    const delay = getMillisecondsUntilNextUtcMidnight(now);

    expect(delay).toBe((8 * 60 * 60 + 29 * 60 + 15) * 1000);
  });

  it("rolls over correctly when already at UTC midnight", () => {
    const now = new Date("2026-03-22T00:00:00.000Z");
    const delay = getMillisecondsUntilNextUtcMidnight(now);

    expect(delay).toBe(24 * 60 * 60 * 1000);
  });
});
