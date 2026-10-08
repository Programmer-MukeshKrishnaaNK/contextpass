import type { DurationId, Timestamp } from "./types";

/**
 * Time helpers. Formatting uses the viewer's local time: recorded
 * permissions expire on real clocks, so times must match the user's own.
 *
 * DEMO_EPOCH and at() only date the landing page's illustrative ledger.
 */
export const DEMO_EPOCH: Timestamp = Date.UTC(2026, 9, 6, 21, 53, 44);

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Build a timestamp on the demo day. */
export function at(h: number, m: number, s = 0, dayOffset = 0): Timestamp {
  return Date.UTC(2026, 9, 6 + dayOffset, h, m, s);
}

export const DURATIONS: Record<DurationId, { ms: number; label: string; short: string }> = {
  "15m": { ms: 15 * MIN, label: "15 minutes", short: "15 min" },
  "1h": { ms: HOUR, label: "1 hour", short: "1 hour" },
  "1d": { ms: DAY, label: "1 day", short: "1 day" },
  "30d": { ms: 30 * DAY, label: "30 days", short: "30 days" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** 21:41:03 */
export function clockTime(t: Timestamp): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 21:41 */
export function shortTime(t: Timestamp): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** 06 Oct 2026 */
export function calendarDate(t: Timestamp): string {
  const d = new Date(t);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 2026-10-06T21:41:03Z — for <time dateTime> */
export function isoTime(t: Timestamp): string {
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function startOfDay(t: Timestamp): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", or "Friday 02 Oct" */
export function dayLabel(t: Timestamp, now: Timestamp): string {
  const diff = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  const d = new Date(t);
  return `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** A future moment, phrased for a sentence: "22:41 today", "tomorrow at 21:54", "05 Nov". */
export function whenLabel(t: Timestamp, now: Timestamp): string {
  const day = dayLabel(t, now);
  if (day === "Today") return `${shortTime(t)} today`;
  if (day === "Tomorrow") return `tomorrow at ${shortTime(t)}`;
  const d = new Date(t);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** "47m", "2h 14m", "6 days" — coarse, for prose. */
export function span(ms: number): string {
  const abs = Math.max(0, ms);
  if (abs < MIN) return `${Math.floor(abs / 1000)}s`;
  if (abs < HOUR) return `${Math.floor(abs / MIN)}m`;
  if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MIN);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(abs / DAY);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "46:59" or "23:12:08" — precise, for live countdowns. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "4m ago", "Yesterday 18:30", "02 Oct" */
export function relative(t: Timestamp, now: Timestamp): string {
  const diff = now - t;
  if (diff < MIN) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (startOfDay(t) === startOfDay(now)) return `Today ${shortTime(t)}`;
  if (startOfDay(now) - startOfDay(t) === DAY) return `Yesterday ${shortTime(t)}`;
  const d = new Date(t);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

export function greeting(now: Timestamp): string {
  const h = new Date(now).getHours();
  if (h < 5) return "Still up.";
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}
