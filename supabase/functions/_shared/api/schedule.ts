// When Tides are due (section 11.2 and 15.5). The season keeps a timezone and a local time such as
// "21:00" in "Europe/Bucharest", so the Tide stays at 21:00 on the clock when daylight saving
// changes. Pure: the clock is always passed in.

interface Parts { year: number; month: number; day: number; hour: number; minute: number; second: number; }

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(date: Date, timeZone: string): Parts {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(date)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute!, second: p.second! };
}

/** How far the zone is ahead of UTC at this instant, in milliseconds. */
function offsetAt(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `timeZone` reads this date and time. */
function wallClockToDate(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // The offset depends on the instant, which is what we are looking for, so settle it in two passes.
  let guess = new Date(asUtc - offsetAt(new Date(asUtc), timeZone));
  guess = new Date(asUtc - offsetAt(guess, timeZone));
  return guess;
}

/** The calendar date on the clock in `timeZone`, as "YYYY-MM-DD". */
export function localDate(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function parseTime(local: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(local);
  const hour = Number(m?.[1]), minute = Number(m?.[2]);
  if (!m || hour > 23 || minute > 59) throw new Error(`Tide time must look like 21:00, got "${local}"`);
  return { hour, minute };
}

/**
 * The next Tide time after `after`. With `skipToday` it is the Tide time on the next calendar day
 * even if today's has not come yet, which is what follows a Tide that turned early: the day's
 * Tide has been used.
 */
export function nextDueAt(after: Date, timeZone: string, tideTimeLocal: string, skipToday = false): Date {
  const { hour, minute } = parseTime(tideTimeLocal);
  const today = partsIn(after, timeZone);
  for (let days = skipToday ? 1 : 0; ; days++) {
    // Date.UTC rolls the day over months and years for us.
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
    const due = wallClockToDate(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, minute, timeZone);
    if (due.getTime() > after.getTime()) return due;
  }
}
