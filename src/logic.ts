/** Pure parsing / formatting / business-rule helpers for EventRSVP. No I/O, no imports across dirs. */

const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ParsedEvent { whenTs: number; title: string; }

function localParts(nowSec: number, tzMin: number): { dayStart: number; secOfDay: number; dow: number } {
  const shifted = nowSec + tzMin * MIN;
  const secOfDay = ((shifted % DAY) + DAY) % DAY;
  const dayStart = shifted - secOfDay - tzMin * MIN;
  const dow = Math.floor(shifted / DAY + 4) % 7; // 1970-01-01 was Thursday (4)
  return { dayStart, secOfDay, dow };
}

function clock(s: string): number | null {
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? "0");
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return h * HOUR + mi * MIN;
}

/** "in 2h Team sync", "in 1h30m Standup" */
function parseIn(rest: string): { sec: number; title: string } | null {
  const m = rest.match(/^in\s+((?:\d+\s*[mhd]\s*)+)(.*)$/i);
  if (!m) return null;
  let sec = 0;
  const parts = m[1].match(/\d+\s*[mhd]/gi) ?? [];
  for (const p of parts.slice(0, 4)) {
    const n = Number(p.slice(0, -1).trim());
    const u = p.slice(-1).toLowerCase();
    sec += n * (u === "m" ? MIN : u === "h" ? HOUR : DAY);
  }
  if (sec <= 0 || sec > 365 * DAY) return null;
  return { sec, title: m[2].trim() };
}

/** "at 19:00 x", "tomorrow 19:00 x", "fri 19:00 x", "today 19:00 x" */
function parseNamedDay(rest: string, now: number, tz: number): ParsedEvent | null {
  const m = rest.match(/^(at|tomorrow|today|sun|mon|tue|wed|thu|fri|sat)\b\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\s+(.+)$/i);
  if (!m) return null;
  const key = m[1].toLowerCase();
  if (key === "at" && !m[2]) return null;
  const tod = m[2] ? clock(m[2].trim()) : null;
  if (m[2] && tod === null) return null;
  const useTod = tod ?? 19 * HOUR;
  const { dayStart, secOfDay, dow } = localParts(now, tz);
  let whenTs = dayStart + useTod;
  if (key === "tomorrow") whenTs += DAY;
  else if (DOW_KEYS.includes(key)) {
    let ahead = (DOW_KEYS.indexOf(key) - dow + 7) % 7;
    if (ahead === 0 && useTod <= secOfDay) ahead = 7;
    whenTs += ahead * DAY;
  } else if (useTod <= secOfDay) whenTs += DAY; // "at"/"today" already past today -> tomorrow
  return { whenTs, title: m[3].trim() };
}

/** "2026-09-10 19:00 x" */
function parseDate(rest: string, tz: number): ParsedEvent | null {
  const m = rest.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(.+)$/i);
  if (!m) return null;
  const tod = clock(m[4].trim());
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 1000;
  if (tod === null || Number.isNaN(base)) return null;
  return { whenTs: base + tod - tz * MIN, title: m[5].trim() };
}

/** "<when> <title>" -> {whenTs, title}, or null if unparseable / past / no title. */
export function parseEventWhen(text: string, nowSec: number, tzMin: number): ParsedEvent | null {
  const rest = text.trim();
  if (rest.length === 0 || rest.length > 500) return null;
  const rel = parseIn(rest);
  if (rel) return rel.title.length > 0 ? { whenTs: nowSec + rel.sec, title: rel.title.slice(0, 200) } : null;
  const r = parseNamedDay(rest, nowSec, tzMin) ?? parseDate(rest, tzMin);
  if (!r || r.title.length === 0 || r.whenTs <= nowSec) return null;
  return { whenTs: r.whenTs, title: r.title.slice(0, 200) };
}

export function parseTz(s: string): number | null {
  const m = s.trim().match(/^(?:utc)?\s*([+-])?(\d{1,2})(?::?(\d{2}))?$/i);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const h = Number(m[2]);
  const mi = Number(m[3] ?? "0");
  if (h > 14 || mi > 59) return null;
  return sign * (h * 60 + mi);
}

export function fmtWhen(sec: number, tzMin: number): string {
  const d = new Date((sec + tzMin * MIN) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const off = tzMin === 0 ? "UTC" : `UTC${tzMin > 0 ? "+" : "-"}${Math.floor(Math.abs(tzMin) / 60)}${Math.abs(tzMin) % 60 ? ":" + p(Math.abs(tzMin) % 60) : ""}`;
  return `${DOW_NAMES[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${off}`;
}

export type Bucket = "going" | "maybe" | "cant";
export interface RsvpEntry { userId: number; name: string; bucket: Bucket; }

/** Move (or add) a user's RSVP to a new bucket. One entry per user, always. */
export function applyRsvp(list: RsvpEntry[], userId: number, name: string, bucket: Bucket): RsvpEntry[] {
  const out = list.filter((e) => e.userId !== userId);
  out.push({ userId, name, bucket });
  return out;
}

/** Join up to `max` names; append a "+N more" tail when truncated. */
export function nameList(names: string[], max = 30): string {
  if (names.length === 0) return "—";
  if (names.length <= max) return names.join(", ");
  return names.slice(0, max).join(", ") + ` +${names.length - max} more`;
}

/** Free groups may hold at most `limit` active (uncancelled, upcoming) events. */
export function canCreateEvent(activeCount: number, pro: boolean, limit = 3): boolean {
  return pro || activeCount < limit;
}

export interface ReminderRow { id: number; when_ts: number; reminded: number; pro: number; }

/** Ids of events that need their "1 hour to go" reminder sent right now (Pro groups only). */
export function dueReminders(rows: ReminderRow[], nowSec: number): number[] {
  return rows.filter((r) => r.reminded === 0 && r.pro === 1 && r.when_ts > nowSec && r.when_ts - nowSec <= HOUR).map((r) => r.id);
}

/** Deep-link encoding for a (possibly negative) group chat id: "-" <-> "m". */
export const encodeChatId = (id: number): string => String(id).replace("-", "m");
export function decodeChatId(s: string): number | null {
  if (!/^m?\d+$/.test(s)) return null;
  const n = Number(s.startsWith("m") ? "-" + s.slice(1) : s);
  return Number.isFinite(n) ? n : null;
}

/** True for a first-touch attribution payload on /start (e.g. "site", "share", "list", "x"),
 *  never the reserved "pro" tag or a "pro_<id>" per-group payload. */
export const SOURCE_PAYLOAD_RE = /^[a-z]{2,12}$/;
export function isSourcePayload(s: string): boolean { return s !== "pro" && SOURCE_PAYLOAD_RE.test(s); }
