/** Pure Guest Mode reply builder for EventRSVP. No I/O, no cross-dir imports beyond
 * logic.ts / guest.ts (both dependency-free), so this runs under plain `node --test`. */
import type { GuestReply } from "./guest.ts";
import { fmtWhen, parseEventWhen } from "./logic.ts";
import type { Lang } from "./i18n.ts";
import { t } from "./i18n.ts";

/**
 * RSVPs need a persistent event in a chat we belong to, so this is always a pitch — but
 * when the guest's query parses as an event, we echo the date back (as UTC: a guest has
 * no saved /tz) to show we understood it, then ask for the add.
 */
export function buildGuestReply(botUsername: string, q: string, lang: Lang, startTextPlain: string, nowSec: number): GuestReply {
  const parsed = q ? parseEventWhen(q, nowSec, 0) : null;
  if (parsed) {
    const when = fmtWhen(parsed.whenTs, 0);
    return { title: `📅 ${parsed.title}`, description: when, text: t(lang, "guestParsed", { when }) };
  }
  return {
    title: "📅 EventRSVP — RSVP cards for group events",
    description: "Try: @" + botUsername + " tomorrow 19:00 Team sync",
    text: startTextPlain,
  };
}
