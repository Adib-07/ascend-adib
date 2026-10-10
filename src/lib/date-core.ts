// DATE CORE — the single date-handling strategy for Ascend.
//
// All business-day arithmetic (today's date, week bounds, habit-day keys) is
// computed against BUSINESS_TIMEZONE, never against whichever timezone the
// browser or server happens to run in. The owner's business timezone is
// Asia/Kolkata (UTC+05:30, no DST since 1945).
//
// Two rules the rest of the codebase must follow:
// 1. A calendar DAY is always a "YYYY-MM-DD" string. Never round-trip a date
//    string through a device-local constructor: `new Date("YYYY-MM-DD")`
//    parses as UTC midnight, and formatting it in the device timezone shifts
//    the day for zones west of UTC.
// 2. An INSTANT is always a Date (UTC internally) or a timestamptz ISO
//    string. Wall-clock strings from datetime-local/time inputs are only
//    meaningful together with BUSINESS_TIMEZONE — convert them with
//    wallClockToInstant(), never `new Date(wall)`, which would interpret the
//    wall clock in the device's timezone.

export const BUSINESS_TIMEZONE = "Asia/Kolkata";

const pad = (n: number) => String(n).padStart(2, "0");

export interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function datePartsInTz(date: Date, tz: string): DateParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts["year"],
    month: parts["month"],
    day: parts["day"],
    hour: parts["hour"],
    minute: parts["minute"],
    second: parts["second"],
  };
}

export function isoDateInTz(date: Date, tz: string): string {
  const p = datePartsInTz(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function weekdayIndexInTz(date: Date, tz: string): number {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  return WEEKDAY_INDEX[label];
}

// Minutes east of UTC for the given zone at the given instant.
export function offsetMinutesInTz(date: Date, tz: string): number {
  const p = datePartsInTz(date, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 60_000);
}

// Convert a wall-clock string ("YYYY-MM-DDTHH:mm" or with ":ss") in `tz` into
// the true UTC instant. The offset is looked up at the UTC guess and refined
// once: exact for fixed-offset zones (Asia/Kolkata) and for every
// non-pathological minute of DST-observing zones.
export function wallClockToInstant(wall: string, tz: string): Date {
  const withSeconds = wall.length === 16 ? `${wall}:00` : wall;
  const utcGuess = Date.parse(`${withSeconds}Z`);
  if (Number.isNaN(utcGuess)) {
    throw new Error(`Invalid wall-clock string: ${wall}`);
  }
  const offset = offsetMinutesInTz(new Date(utcGuess), tz);
  let instant = utcGuess - offset * 60_000;
  const refined = offsetMinutesInTz(new Date(instant), tz);
  if (refined !== offset) {
    instant = utcGuess - refined * 60_000;
  }
  return new Date(instant);
}

// Minute-precision wall clock in `tz` ("YYYY-MM-DDTHH:mm") — the value shape
// datetime-local inputs expect.
export function instantToWallClock(date: Date, tz: string): string {
  const p = datePartsInTz(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// "HH:mm" wall clock in `tz` — the value shape time inputs expect.
export function instantToTimeInput(date: Date, tz: string): string {
  const p = datePartsInTz(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

// Pure calendar arithmetic on a "YYYY-MM-DD" string. Date.UTC normalizes
// out-of-range components, so month/year boundaries and leap days are exact.
export function addDaysISO(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Today's date in the business timezone.
export function todayISO(now?: Date, tz: string = BUSINESS_TIMEZONE): string {
  return isoDateInTz(now ?? new Date(), tz);
}

// Monday..Sunday bounds of the week containing `now`, in the business
// timezone, as date strings.
export function weekBounds(
  now?: Date,
  tz: string = BUSINESS_TIMEZONE,
): { start: string; end: string } {
  const ref = now ?? new Date();
  const today = isoDateInTz(ref, tz);
  const [y, m, d] = today.split("-").map(Number);
  const daysSinceMonday = (weekdayIndexInTz(ref, tz) + 6) % 7;
  const mondayMs = Date.UTC(y, m - 1, d - daysSinceMonday);
  return {
    start: new Date(mondayMs).toISOString().slice(0, 10),
    end: new Date(mondayMs + 6 * 86_400_000).toISOString().slice(0, 10),
  };
}

// The seven "YYYY-MM-DD" strings Mon..Sun of the week containing `now`.
export function weekDaysInTz(now?: Date, tz: string = BUSINESS_TIMEZONE): string[] {
  const { start } = weekBounds(now, tz);
  const [y, m, d] = start.split("-").map(Number);
  const mondayMs = Date.UTC(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(mondayMs + i * 86_400_000).toISOString().slice(0, 10),
  );
}

// Consecutive-day streak count from `today` backwards over a desc-sorted list
// of done-day strings. Preserves the existing semantics: if today is not
// logged, the streak is 0; the walk stops at the first gap. Pure date-string
// comparison — no device-local "now" and no UTC/local mixing.
export function computeStreak(doneDaysDesc: string[], today: string): number {
  let streak = 0;
  let cursor = today;
  for (const day of doneDaysDesc) {
    if (day === cursor) {
      streak++;
      cursor = addDaysISO(cursor, -1);
    } else break;
  }
  return streak;
}
