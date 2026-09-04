import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGuestResult } from "../src/guest.ts";
import { buildGuestReply } from "../src/guestReply.ts";

const BOT = "EventRSVPProBot";
const NOW = Date.parse("2026-09-02T12:00:00Z") / 1000; // Wed
const PITCH = "Ask your group who's coming.";

test("unparseable query falls back to the pitch: text + no parse_mode + buttons", () => {
  const r = buildGuestReply(BOT, "", "en", PITCH, NOW);
  assert.equal(r.text, PITCH);
  assert.ok(r.title.length > 0);
  const res = buildGuestResult(r, BOT, "supergroup");
  assert.equal("parse_mode" in res.input_message_content, false);
  assert.equal(res.reply_markup?.inline_keyboard.length, 2, "Open + Add to this group");
});

test("a query that parses echoes the date in the reply text and the title in the article title", () => {
  const r = buildGuestReply(BOT, "fri 19:00 Board games", "en", PITCH, NOW);
  assert.match(r.text, /Fri/, "the parsed date shows up in the message body");
  assert.match(r.text, /add me to this group/i);
  assert.equal(r.title, "📅 Board games");
  assert.notEqual(r.text, PITCH, "a parsed query gets the echo, not the generic pitch");
});

test("a query that fails to parse (garbage) falls back to the pitch", () => {
  const r = buildGuestReply(BOT, "asdkjasjdaskjd", "en", PITCH, NOW);
  assert.equal(r.text, PITCH);
});

test("the echoed reply never sets parse_mode, even when the parsed title carries Markdown-sensitive characters", () => {
  const r = buildGuestReply(BOT, "in 2h Team_sync *now*", "en", PITCH, NOW);
  assert.equal(r.title, "📅 Team_sync *now*");
  const res = buildGuestResult(r, BOT, "group");
  assert.equal("parse_mode" in res.input_message_content, false);
});
