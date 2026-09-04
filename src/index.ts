import { Bot, Context, InlineKeyboard } from "grammy";
import { Env as KitEnv, PRO_STARS, ProSpec, displayName, isPrivate, makeFetch, now, preparedShare, sendInvoice, wirePro } from "./kit.ts";
import { Store, EventRow, RsvpRow } from "./db.ts";
import { Bucket, applyRsvp, canCreateEvent, decodeChatId, dueReminders, encodeChatId, fmtWhen, isSourcePayload, nameList, parseEventWhen, parseTz } from "./logic.ts";
import { APP_HTML, buildShareText, validateInitData } from "./webapp.ts";
import { resolveLang, t } from "./i18n.ts";
export { Store };

const BOT = "EventRSVPProBot";
const FREE_ACTIVE = 3;
const ANON_ADMIN_ID = 1087968824; // GroupAnonymousBot
interface Env extends KitEnv { STORE: DurableObjectNamespace<Store>; }
const store = (env: Env) => env.STORE.get(env.STORE.idFromName("main"));

/** True for a real, identifiable human sender: not a channel post, not an anonymous group
 *  admin (GroupAnonymousBot), not a bot, and not a message relayed via another bot.
 *  Narrows ctx.from to non-null so handlers never need `ctx.from!`. */
function fromReal<C extends Context>(ctx: C): ctx is C & { from: NonNullable<C["from"]> } {
  const f = ctx.from;
  if (!f || f.is_bot || f.id === ANON_ADMIN_ID) return false;
  return !ctx.message?.via_bot;
}

const PRO: ProSpec = {
  title: "EventRSVP Pro (this group)",
  description: "Unlimited active events and 1-hour reminders for one group. One-time payment, no subscription.",
  payload: "rsvp-pro",
  thanks: "✅ Pro unlocked for the group. Unlimited events + reminders.\n\n/more — more free tools",
};
/** YYYY-MM-DD (UTC) 30 days from now, used as an always-future example date in `help`. */
const exampleDate = (): string => new Date((now() + 30 * 86400) * 1000).toISOString().slice(0, 10);
const helpText = (lang: string): string => t(lang, "help", { free: FREE_ACTIVE, stars: PRO_STARS, date: exampleDate() });
const startText = (lang: string): string => t(lang, "start", { free: FREE_ACTIVE, stars: PRO_STARS });
const MORE_TEXT = "More free tools by the same maker:\n🔒 @WhisperLockBot — locked messages only one person can open\n⏰ @NudgeRemindBot — reminders that arrive on time\n📮 @AnonInboxProBot — anonymous inbox via your link\n🧾 @SplitTabsBot — split group expenses\n🔥 @HabitStreakProBot — habit streaks with daily check-ins";
const SHARE_PITCH = "Free RSVP cards for group events — going / maybe / can't, right in the chat.";
const shareUrl = (bot: string, pitch: string): string =>
  `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${bot}?start=share`)}&text=${encodeURIComponent(pitch)}`;

const proKb = (chatId: number, lang: string): InlineKeyboard =>
  new InlineKeyboard().url(t(lang, "btn_unlockProStars", { stars: PRO_STARS }), `https://t.me/${BOT}?start=pro_${encodeChatId(chatId)}`);

function bucketsOf(rsvps: RsvpRow[]): { going: string[]; maybe: string[]; cant: string[] } {
  return {
    going: rsvps.filter((r) => r.bucket === "going").map((r) => r.name),
    maybe: rsvps.filter((r) => r.bucket === "maybe").map((r) => r.name),
    cant: rsvps.filter((r) => r.bucket === "cant").map((r) => r.name),
  };
}

/** Plain text (no parse_mode): the card carries user-supplied titles and names, and a
 *  correct Markdown escaper is not worth the risk of a 400 for a group's shared message. */
function cardText(e: EventRow, rsvps: RsvpRow[]): string {
  const b = bucketsOf(rsvps);
  return `📅 ${e.title}\nWhen: ${fmtWhen(e.when_ts, e.creator_tz_min)}\nBy: ${e.creator_name}\n\n` +
    `✅ Going (${b.going.length}): ${nameList(b.going)}\n🤔 Maybe (${b.maybe.length}): ${nameList(b.maybe)}\n❌ Can't (${b.cant.length}): ${nameList(b.cant)}`;
}

function cardKb(id: number): InlineKeyboard {
  return new InlineKeyboard().text("✅ Going", `rsvp:${id}:going`).text("🤔 Maybe", `rsvp:${id}:maybe`).text("❌ Can't", `rsvp:${id}:cant`);
}

async function onEvent(ctx: Context, env: Env): Promise<void> {
  if (isPrivate(ctx)) {
    const lang = resolveLang(ctx.from?.language_code);
    await ctx.reply(t(lang, "useInGroupNudge") + "\n\n" + helpText(lang), { parse_mode: "Markdown" });
    return;
  }
  const from = ctx.from;
  if (!from) return;
  const chat = ctx.chat!;
  const u = await store(env).touchUser(from.id, from.username, displayName(from));
  const parsed = parseEventWhen(String(ctx.match ?? ""), now(), u.tz_min);
  if (!parsed) { await ctx.reply("Usage: /event in 2h Team sync  ·  /event at 19:00 Movie night  ·  /event fri 19:00 Board games  ·  /event 2026-09-10 19:00 Launch"); return; }
  const g = await store(env).touchGroup(chat.id, "title" in chat ? chat.title ?? "" : "");
  const active = await store(env).countActiveEvents(chat.id, now());
  if (!canCreateEvent(active, g.pro === 1, FREE_ACTIVE)) {
    await store(env).track(from.id, "pro_prompt");
    const lang = resolveLang(from.language_code);
    await ctx.reply(t(lang, "limitReached", { free: FREE_ACTIVE, stars: PRO_STARS }), { reply_markup: proKb(chat.id, lang) });
    return;
  }
  await store(env).track(from.id, "action");
  const id = await store(env).createEvent(chat.id, from.id, displayName(from), u.tz_min, parsed.title, parsed.whenTs);
  const event = await store(env).getEvent(id);
  if (!event) return;
  const msg = await ctx.reply(cardText(event, []), { reply_markup: cardKb(id) });
  await store(env).setMessageId(id, msg.message_id);
}

async function onRsvp(ctx: Context, env: Env, id: number, bucket: Bucket): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const event = await store(env).getEvent(id);
  if (!event || event.cancelled) { await ctx.answerCallbackQuery({ text: "This event is gone." }); return; }
  await store(env).touchUser(from.id, from.username, displayName(from));
  const current = await store(env).rsvps(id);
  const next = applyRsvp(current.map((r) => ({ userId: r.user_id, name: r.name, bucket: r.bucket })), from.id, displayName(from), bucket);
  const mine = next.find((r) => r.userId === from.id);
  await store(env).setRsvp(id, from.id, mine!.name, bucket);
  await store(env).track(from.id, "action");
  await ctx.answerCallbackQuery({ text: bucket === "going" ? "✅ You're in" : bucket === "maybe" ? "🤔 Maybe noted" : "❌ Got it" });
  const rsvps = await store(env).rsvps(id);
  try { await ctx.editMessageText(cardText(event, rsvps), { reply_markup: cardKb(id) }); } catch { /* unchanged text */ }
}

async function onEvents(ctx: Context, env: Env): Promise<void> {
  if (isPrivate(ctx)) { await ctx.reply(helpText(resolveLang(ctx.from?.language_code)), { parse_mode: "Markdown" }); return; }
  const from = ctx.from;
  if (!from) return;
  const u = await store(env).touchUser(from.id, from.username, displayName(from));
  const list = await store(env).listUpcoming(ctx.chat!.id, now());
  if (!list.length) { await ctx.reply("No upcoming events. /event in 2h Team sync"); return; }
  const lines = list.map((e) => `#${e.id} ${e.title} — ${fmtWhen(e.when_ts, u.tz_min)} (${e.going} going)`);
  await ctx.reply("📅 Upcoming events\n" + lines.join("\n"));
}

async function onCancel(ctx: Context, env: Env): Promise<void> {
  if (isPrivate(ctx)) return;
  const from = ctx.from;
  if (!from) return;
  const id = Number(String(ctx.match ?? "").trim().replace("#", ""));
  const event = id > 0 ? await store(env).getEvent(id) : null;
  if (!event || event.chat_id !== ctx.chat!.id || event.cancelled) { await ctx.reply("Usage: /cancel <id>"); return; }
  if (event.creator_id !== from.id) { await ctx.reply("Only the creator can cancel this event."); return; }
  await store(env).cancelEvent(id);
  await ctx.reply(`🗑 #${id} ${event.title} cancelled.`);
  if (event.message_id) {
    try { await ctx.api.editMessageText(event.chat_id, event.message_id, `❌ Cancelled\n${event.title}`); } catch { /* best effort */ }
  }
}

async function remind(env: Env): Promise<number> {
  const bot = new Bot(env.BOT_TOKEN);
  const pending = await store(env).pendingEvents(now());
  const due = new Set(dueReminders(pending, now()));
  let sent = 0;
  for (const e of pending.filter((p) => due.has(p.id)).slice(0, 500)) {
    const rsvps = await store(env).rsvps(e.id);
    const going = rsvps.filter((r) => r.bucket === "going").length;
    const text = `⏰ ${e.title} in 1 hour — ${going} going`;
    try {
      await bot.api.sendMessage(e.chat_id, text, e.message_id ? { reply_parameters: { message_id: e.message_id } } : {});
      sent += 1;
    } catch (err) { console.log("remind failed", e.id, String(err).slice(0, 100)); }
    await store(env).markReminded(e.id);
  }
  return sent;
}

function buildBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN);
  // Message updates only (never channel_post), and only real, identifiable senders
  // (no anonymous group admins, no bots, no via_bot relays) — see fromReal().
  const m = bot.on("message").filter(fromReal);
  m.command("start", async (ctx) => {
    const from = ctx.from;
    await store(env).touchUser(from.id, from.username, displayName(from));
    await store(env).track(from.id, "start");
    const lang = resolveLang(from.language_code);
    const payload = String(ctx.match ?? "");
    const match = payload.match(/^pro_(m?\d+)$/);
    const chatId = match ? decodeChatId(match[1]) : null;
    if (chatId !== null && isPrivate(ctx)) {
      const member = await ctx.api.getChatMember(chatId, from.id).catch(() => null);
      if (!member || member.status === "left" || member.status === "kicked") {
        await ctx.reply(t(lang, "needMember"));
        return;
      }
      const spec: ProSpec = { ...PRO, description: t(lang, "proDescription") };
      await sendInvoice(ctx, spec, "rsvp-pro:" + chatId, (s) => store(env).track(from.id, s));
      return;
    }
    if (isSourcePayload(payload)) await store(env).recordSource(from.id, payload);
    const kb = new InlineKeyboard().url(t(lang, "btn_addToGroup"), `https://t.me/${BOT}?startgroup=true`);
    if (isPrivate(ctx)) kb.row().url(t(lang, "btn_shareBot"), shareUrl(BOT, SHARE_PITCH));
    await ctx.reply(startText(lang), { parse_mode: "Markdown", reply_markup: kb });
  });
  m.command("help", (ctx) => ctx.reply(helpText(resolveLang(ctx.from.language_code)), { parse_mode: "Markdown" }));
  m.command("more", (ctx) => ctx.reply(MORE_TEXT));
  m.command("event", (ctx) => onEvent(ctx, env));
  m.command("events", (ctx) => onEvents(ctx, env));
  m.command("cancel", (ctx) => onCancel(ctx, env));
  m.command("tz", async (ctx) => {
    const from = ctx.from;
    const tz = parseTz(String(ctx.match ?? ""));
    if (tz === null) { await ctx.reply("Usage: /tz +2  or  /tz -5:30"); return; }
    await store(env).touchUser(from.id, from.username, displayName(from));
    await store(env).setTz(from.id, tz);
    await ctx.reply("🕒 Timezone saved.");
  });
  m.command("pro", async (ctx) => {
    const lang = resolveLang(ctx.from?.language_code);
    if (isPrivate(ctx)) { await ctx.reply(t(lang, "proRunInGroup")); return; }
    await ctx.reply(t(lang, "proGroupInfo", { stars: PRO_STARS }), { reply_markup: proKb(ctx.chat!.id, lang) });
  });
  // wirePro registers on `bot` (kit.ts, not owned here) but our own m.command("pro", …) above
  // is attached first, so it always wins — see AGENT-CONTRACT.md: shared kit.ts is not edited.
  wirePro(bot, PRO, async (ctx, payload, charge) => {
    const from = ctx.from;
    if (!from) return;
    const match = payload.match(/^rsvp-pro:(-?\d+)$/);
    if (match) await store(env).setGroupPro(Number(match[1]), charge); else await store(env).setPro(from.id, charge);
    // kit.ts always sends its own (English) spec.thanks after onPaid resolves; for a
    // non-English payer we send a localized thank-you first so they get at least one
    // message in their language.
    const lang = resolveLang(from.language_code);
    if (lang !== "en") await ctx.reply(t(lang, "thankYou"));
  }, (uid, s) => store(env).track(uid, s));
  bot.callbackQuery(/^rsvp:(\d+):(going|maybe|cant)$/, (ctx) => onRsvp(ctx, env, Number(ctx.match[1]), ctx.match[2] as Bucket));
  m.on("message:new_chat_members", (ctx) => {
    if (!ctx.message.new_chat_members.some((mem) => mem.id === ctx.me.id)) return;
    return ctx.reply(helpText(resolveLang(ctx.from?.language_code)), { parse_mode: "Markdown" });
  });
  m.on("message:text", async (ctx) => {
    if (!isPrivate(ctx)) return;
    await ctx.reply(helpText(resolveLang(ctx.from?.language_code)), { parse_mode: "Markdown" });
  });
  return bot;
}

async function api(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { initData?: string };
  const user = await validateInitData(body.initData ?? "", [env.BOT_TOKEN, env.HUB_BOT_TOKEN].filter((t): t is string => !!t));
  if (!user) return Response.json({ error: "Open this page from Telegram." }, { status: 401 });
  const u = await store(env).touchUser(user.id, user.username, user.username ? "@" + user.username : user.first_name);
  const events = (await store(env).myUpcoming(u.id, now())).map((e) => ({
    id: e.id, title: e.title, when: fmtWhen(e.when_ts, u.tz_min), group_title: e.group_title, my_bucket: e.my_bucket, going: e.going,
  }));
  return Response.json({ events });
}

/** POST /api/share: registers a Bot API "prepared" inline message (savePreparedInlineMessage)
 * so the Mini App can hand its id to tg.shareMessage(id) for a native chat/group/channel share. */
async function apiShare(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { initData?: string };
  const user = await validateInitData(body.initData ?? "", [env.BOT_TOKEN, env.HUB_BOT_TOKEN].filter((t): t is string => !!t));
  if (!user) return Response.json({ error: "Open this page from Telegram." }, { status: 401 });
  try {
    const share = await preparedShare(env, user.id, buildShareText(SHARE_PITCH, BOT, "shared"), `https://t.me/${BOT}`);
    await store(env).recordShare(user.id, "chat");
    return Response.json(share);
  } catch { return Response.json({ error: "Share unavailable." }, { status: 502 }); }
}

/** POST /api/share-story: records a "share to story" click. Telegram gives no server
 * callback for tg.shareToStory, so the client fires this right before calling it. */
async function apiShareStory(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { initData?: string };
  const user = await validateInitData(body.initData ?? "", [env.BOT_TOKEN, env.HUB_BOT_TOKEN].filter((t): t is string => !!t));
  if (!user) return Response.json({ error: "Open this page from Telegram." }, { status: 401 });
  await store(env).recordShare(user.id, "story");
  return Response.json({ ok: true });
}

const botFetch = makeFetch<Env>(buildBot, (env) => store(env).stats());
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === "/app") return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (path === "/api/share" && req.method === "POST") return apiShare(req, env);
    if (path === "/api/share-story" && req.method === "POST") return apiShareStory(req, env);
    if (path === "/api/events" && req.method === "POST") return api(req, env);
    return botFetch(req, env);
  },
  async scheduled(_ev: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> { ctx.waitUntil(remind(env)); },
};
