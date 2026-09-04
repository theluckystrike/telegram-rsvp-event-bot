import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRsvp, canCreateEvent, decodeChatId, dueReminders, encodeChatId, isSourcePayload, nameList, parseEventWhen } from "../src/logic.ts";

const NOW = Date.parse("2026-09-02T12:00:00Z") / 1000; // Wed

test("when-parsing: all supported forms", () => {
  const inH = parseEventWhen("in 2h Team sync", NOW, 0);
  assert.equal(inH?.whenTs, NOW + 2 * 3600);
  assert.equal(inH?.title, "Team sync");

  const at = parseEventWhen("at 19:00 Movie night", NOW, 0);
  assert.equal(at?.whenTs, Date.parse("2026-09-02T19:00:00Z") / 1000);
  assert.equal(at?.title, "Movie night");

  const tomorrow = parseEventWhen("tomorrow 09:00 Standup", NOW, 0);
  assert.equal(tomorrow?.whenTs, Date.parse("2026-09-03T09:00:00Z") / 1000);

  const fri = parseEventWhen("fri 19:00 Board games", NOW, 0);
  assert.equal(fri?.whenTs, Date.parse("2026-09-04T19:00:00Z") / 1000); // next Friday
  assert.equal(fri?.title, "Board games");

  const dated = parseEventWhen("2026-09-10 19:00 Launch party", NOW, 0);
  assert.equal(dated?.whenTs, Date.parse("2026-09-10T19:00:00Z") / 1000);
  assert.equal(dated?.title, "Launch party");

  // tz offset shifts "at" arithmetic
  const tz = parseEventWhen("at 19:00 Standup", NOW, 120); // UTC+2
  assert.equal(tz?.whenTs, Date.parse("2026-09-02T17:00:00Z") / 1000);

  assert.equal(parseEventWhen("nonsense", NOW, 0), null);
  assert.equal(parseEventWhen("in 2h", NOW, 0), null); // no title
  assert.equal(parseEventWhen("at 08:00 Past thing", NOW, 0)?.whenTs, Date.parse("2026-09-03T08:00:00Z") / 1000);
});

test("bucket switching: a user moving from Going to Maybe", () => {
  let list = applyRsvp([], 1, "Ann", "going");
  assert.deepEqual(list, [{ userId: 1, name: "Ann", bucket: "going" }]);
  list = applyRsvp(list, 2, "Ben", "going");
  list = applyRsvp(list, 1, "Ann", "maybe");
  assert.equal(list.length, 2);
  assert.equal(list.find((e) => e.userId === 1)?.bucket, "maybe");
  assert.equal(list.find((e) => e.userId === 2)?.bucket, "going");
});

test("name-list truncation", () => {
  assert.equal(nameList([]), "—");
  assert.equal(nameList(["Ann", "Ben"]), "Ann, Ben");
  const many = Array.from({ length: 35 }, (_, i) => "U" + i);
  const out = nameList(many);
  assert.match(out, /\+5 more$/);
  assert.equal(out.split(", ").length, 30); // last entry carries the "+5 more" suffix
});

test("free-limit logic", () => {
  assert.equal(canCreateEvent(0, false), true);
  assert.equal(canCreateEvent(2, false), true);
  assert.equal(canCreateEvent(3, false), false);
  assert.equal(canCreateEvent(3, false, 5), true);
  assert.equal(canCreateEvent(999, true), true); // pro = unlimited
});

test("reminder due selection (pure function over rows)", () => {
  const rows = [
    { id: 1, when_ts: NOW + 1800, reminded: 0, pro: 1 }, // 30 min out, pro -> due
    { id: 2, when_ts: NOW + 1800, reminded: 0, pro: 0 }, // free group -> not due
    { id: 3, when_ts: NOW + 1800, reminded: 1, pro: 1 }, // already reminded -> not due
    { id: 4, when_ts: NOW + 7200, reminded: 0, pro: 1 }, // 2h out -> not yet due
    { id: 5, when_ts: NOW - 10, reminded: 0, pro: 1 }, // already started -> not due
  ];
  assert.deepEqual(dueReminders(rows, NOW), [1]);
});

test("deep-link chat id encode/decode", () => {
  assert.equal(encodeChatId(-1001234567890), "m1001234567890");
  assert.equal(decodeChatId("m1001234567890"), -1001234567890);
  assert.equal(decodeChatId("1001234567890"), 1001234567890);
  assert.equal(decodeChatId("bogus"), null);
  const roundTrip = decodeChatId(encodeChatId(-987654321));
  assert.equal(roundTrip, -987654321);
});

test("source-payload regex", () => {
  assert.equal(isSourcePayload("site"), true);
  assert.equal(isSourcePayload("share"), true);
  assert.equal(isSourcePayload("list"), true);
  assert.equal(isSourcePayload("x"), false); // too short (min 2)
  assert.equal(isSourcePayload("pro"), false); // reserved
  assert.equal(isSourcePayload("pro_m1001234567890"), false); // per-group pro payload
  assert.equal(isSourcePayload("thisistoolongasrc"), false); // over 12 chars
  assert.equal(isSourcePayload("Site1"), false); // must be lowercase letters only
});
