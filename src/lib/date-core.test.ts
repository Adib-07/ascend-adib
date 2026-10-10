import { describe, expect, it } from "bun:test";
import {
  BUSINESS_TIMEZONE,
  addDaysISO,
  computeStreak,
  instantToTimeInput,
  instantToWallClock,
  isoDateInTz,
  offsetMinutesInTz,
  todayISO,
  wallClockToInstant,
  weekBounds,
  weekDaysInTz,
  weekdayIndexInTz,
} from "./date-core";

const IST = BUSINESS_TIMEZONE;

describe("todayISO — business timezone", () => {
  it("UTC midnight when the IST date has not changed yet", () => {
    // 2026-10-10T00:00Z = 05:30 IST Oct 10 — both calendars agree.
    expect(todayISO(new Date("2026-10-10T00:00:00Z"))).toBe("2026-10-10");
  });

  it("advances the date at IST midnight even though UTC has not", () => {
    // 2026-10-09T18:31Z = 00:01 IST Oct 10 — UTC still says Oct 9.
    expect(todayISO(new Date("2026-10-09T18:31:00Z"))).toBe("2026-10-10");
    // One minute earlier it is still Oct 9 in IST.
    expect(todayISO(new Date("2026-10-09T18:29:00Z"))).toBe("2026-10-09");
  });

  it("uses the business date, not the UTC date, late in the IST evening", () => {
    // 2026-10-09T20:00Z = 01:30 IST Oct 10.
    expect(todayISO(new Date("2026-10-09T20:00:00Z"))).toBe("2026-10-10");
  });

  it("respects an explicit timezone override", () => {
    expect(todayISO(new Date("2026-10-09T20:00:00Z"), "UTC")).toBe("2026-10-09");
    expect(todayISO(new Date("2026-10-09T20:00:00Z"), "America/New_York")).toBe("2026-10-09");
  });
});

describe("isoDateInTz / weekdayIndexInTz", () => {
  it("formats a fixed instant in the business timezone", () => {
    expect(isoDateInTz(new Date("2026-10-09T20:00:00Z"), IST)).toBe("2026-10-10");
  });

  it("computes the weekday index in the business timezone", () => {
    // 2026-10-10 is a Saturday.
    expect(weekdayIndexInTz(new Date("2026-10-10T10:00:00Z"), IST)).toBe(6);
    // Leap day 2028-02-29 is a Tuesday.
    expect(weekdayIndexInTz(new Date("2028-02-29T10:00:00Z"), IST)).toBe(2);
  });
});

describe("weekBounds — Monday-first, business timezone", () => {
  it("returns the current Mon..Sun for a Sunday afternoon in IST", () => {
    // 2026-10-11 is a Sunday; 10:00Z = 15:30 IST.
    expect(weekBounds(new Date("2026-10-11T10:00:00Z"))).toEqual({
      start: "2026-10-05",
      end: "2026-10-11",
    });
  });

  it("rolls to the next week exactly at IST midnight on Sunday", () => {
    // 2026-10-11T18:31Z = Monday 2026-10-12 00:31 IST.
    expect(weekBounds(new Date("2026-10-11T18:31:00Z"))).toEqual({
      start: "2026-10-12",
      end: "2026-10-18",
    });
    // One minute earlier it is still the old week.
    expect(weekBounds(new Date("2026-10-11T18:29:00Z"))).toEqual({
      start: "2026-10-05",
      end: "2026-10-11",
    });
  });

  it("starts a clean Monday week early on Monday IST", () => {
    expect(weekBounds(new Date("2026-10-12T00:31:00Z"))).toEqual({
      start: "2026-10-12",
      end: "2026-10-18",
    });
  });

  it("handles the year boundary", () => {
    // 2026-12-31T20:00Z = Friday 2027-01-01 01:30 IST -> Mon 2026-12-28..Sun 2027-01-03.
    expect(weekBounds(new Date("2026-12-31T20:00:00Z"))).toEqual({
      start: "2026-12-28",
      end: "2027-01-03",
    });
  });

  it("handles the leap day", () => {
    // Tuesday 2028-02-29 15:30 IST -> Mon 2028-02-28..Sun 2028-03-05.
    expect(weekBounds(new Date("2028-02-29T10:00:00Z"))).toEqual({
      start: "2028-02-28",
      end: "2028-03-05",
    });
  });

  it("respects an explicit timezone override", () => {
    // 2026-10-11T10:00Z is Sunday 06:00 in New York: Mon 2026-10-05..Sun 2026-10-11.
    expect(weekBounds(new Date("2026-10-11T10:00:00Z"), "America/New_York")).toEqual({
      start: "2026-10-05",
      end: "2026-10-11",
    });
  });
});

describe("weekDaysInTz", () => {
  it("returns seven Mon..Sun date strings containing the current day", () => {
    const days = weekDaysInTz(new Date("2026-10-11T10:00:00Z"));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-05");
    expect(days[6]).toBe("2026-10-11");
    expect(days).toContain("2026-10-11");
  });

  it("crosses month boundaries without gaps", () => {
    const days = weekDaysInTz(new Date("2028-03-01T10:00:00Z")); // Wednesday
    expect(days).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
      "2028-03-02",
      "2028-03-03",
      "2028-03-04",
      "2028-03-05",
    ]);
  });
});

describe("addDaysISO — calendar arithmetic", () => {
  it("crosses month boundaries", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("crosses year boundaries", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("handles leap days", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDaysISO("2027-02-28", 1)).toBe("2027-03-01");
  });
});

describe("wall-clock <-> instant conversion (IST)", () => {
  it("converts a business wall clock to the exact UTC instant", () => {
    expect(wallClockToInstant("2026-10-10T09:30", IST).toISOString()).toBe(
      "2026-10-10T04:00:00.000Z",
    );
  });

  it("formats an instant as the business wall clock (datetime-local shape)", () => {
    expect(instantToWallClock(new Date("2026-10-10T04:00:00Z"), IST)).toBe("2026-10-10T09:30");
    expect(instantToWallClock(new Date("2026-10-10T18:00:00Z"), IST)).toBe("2026-10-10T23:30");
  });

  it("formats an instant for a time input (HH:mm)", () => {
    expect(instantToTimeInput(new Date("2026-10-10T04:00:00Z"), IST)).toBe("09:30");
    expect(instantToTimeInput(new Date("2026-10-10T18:00:00Z"), IST)).toBe("23:30");
  });

  it("round-trips without drift across representative instants", () => {
    const instants = [
      "2026-01-01T18:30:00.000Z",
      "2026-06-15T00:15:00.000Z",
      "2026-10-10T04:00:00.000Z",
      "2026-12-31T18:31:00.000Z",
      "2028-02-29T18:31:00.000Z",
    ];
    for (const iso of instants) {
      const date = new Date(iso);
      const wall = instantToWallClock(date, IST);
      const back = wallClockToInstant(wall, IST);
      expect(back.toISOString()).toBe(iso);
    }
  });

  it("is independent of the device timezone (exact instants, not device-local)", () => {
    // These assertions hold regardless of the process TZ because the helper
    // resolves the offset from BUSINESS_TIMEZONE via Intl.
    expect(wallClockToInstant("2026-10-10T00:00", IST).toISOString()).toBe(
      "2026-10-09T18:30:00.000Z",
    );
    expect(wallClockToInstant("2026-10-10T23:30", IST).toISOString()).toBe(
      "2026-10-10T18:00:00.000Z",
    );
  });

  it("rejects invalid wall-clock strings", () => {
    expect(() => wallClockToInstant("garbage", IST)).toThrow();
  });
});

describe("wall-clock conversion in a DST-observing zone", () => {
  it("handles summer (EDT, UTC-4) and winter (EST, UTC-5)", () => {
    expect(wallClockToInstant("2026-07-15T09:30", "America/New_York").toISOString()).toBe(
      "2026-07-15T13:30:00.000Z",
    );
    expect(wallClockToInstant("2026-01-15T09:30", "America/New_York").toISOString()).toBe(
      "2026-01-15T14:30:00.000Z",
    );
  });

  it("computes offsets for both DST sides", () => {
    expect(offsetMinutesInTz(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(-240);
    expect(offsetMinutesInTz(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(offsetMinutesInTz(new Date("2026-10-10T12:00:00Z"), IST)).toBe(330);
  });
});

describe("computeStreak — pure date-string walk", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-10-10", "2026-10-09", "2026-10-08"], "2026-10-10")).toBe(3);
  });

  it("returns 0 when today is not logged (existing semantics preserved)", () => {
    expect(computeStreak(["2026-10-09", "2026-10-08"], "2026-10-10")).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(computeStreak(["2026-10-10", "2026-10-08", "2026-10-07"], "2026-10-10")).toBe(1);
  });

  it("returns 0 for an empty log", () => {
    expect(computeStreak([], "2026-10-10")).toBe(0);
  });

  it("walks across month boundaries", () => {
    expect(computeStreak(["2026-11-01", "2026-10-31", "2026-10-30"], "2026-11-01")).toBe(3);
  });

  it("walks across year and leap-day boundaries", () => {
    expect(computeStreak(["2027-01-01", "2026-12-31", "2026-12-30"], "2027-01-01")).toBe(3);
    expect(computeStreak(["2028-03-01", "2028-02-29", "2028-02-28"], "2028-03-01")).toBe(3);
  });
});
