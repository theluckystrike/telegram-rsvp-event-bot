import { BaseStore, FleetStats, now } from "./kit.ts";
import type { Bucket } from "./logic.ts";

export interface EventRow {
  id: number; chat_id: number; creator_id: number; creator_name: string; creator_tz_min: number; title: string;
  when_ts: number; message_id: number | null; created: number; reminded: number; cancelled: number;
}
export interface RsvpRow { event_id: number; user_id: number; name: string; bucket: Bucket; }
export interface PendingEvent { id: number; chat_id: number; title: string; when_ts: number; message_id: number | null; reminded: number; pro: number; }
export interface UpcomingEvent { id: number; title: string; when_ts: number; creator_name: string; going: number; }
export interface MyEvent { id: number; title: string; when_ts: number; group_title: string; my_bucket: Bucket; going: number; }

const QA_CHAT = -1001234567890;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (chat_id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '', pro INTEGER NOT NULL DEFAULT 0, paid_charge TEXT, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL, creator_id INTEGER NOT NULL, creator_name TEXT NOT NULL,
  creator_tz_min INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, when_ts INTEGER NOT NULL, message_id INTEGER, created INTEGER NOT NULL,
  reminded INTEGER NOT NULL DEFAULT 0, cancelled INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS events_chat ON events(chat_id, cancelled, when_ts);
CREATE TABLE IF NOT EXISTS rsvps (event_id INTEGER NOT NULL, user_id INTEGER NOT NULL, name TEXT NOT NULL, bucket TEXT NOT NULL, PRIMARY KEY (event_id, user_id));
CREATE INDEX IF NOT EXISTS rsvps_event ON rsvps(event_id);
CREATE TABLE IF NOT EXISTS sources (user_id INTEGER PRIMARY KEY, src TEXT NOT NULL, ts INTEGER NOT NULL);`;

export class Store extends BaseStore {
  constructor(ctx: DurableObjectState, env: Record<string, unknown>) { super(ctx, env, SCHEMA); }

  async touchGroup(chatId: number, title: string): Promise<{ pro: number }> {
    this.run("INSERT INTO groups (chat_id, title, created) VALUES (?1, ?2, ?3) ON CONFLICT(chat_id) DO UPDATE SET title = ?2", chatId, title, now());
    return this.one<{ pro: number }>("SELECT pro FROM groups WHERE chat_id = ?1", chatId) ?? { pro: 0 };
  }
  async setGroupPro(chatId: number, charge: string): Promise<void> {
    this.run("UPDATE groups SET pro = 1, paid_charge = ?2 WHERE chat_id = ?1", chatId, charge);
  }
  async countActiveEvents(chatId: number, nowSec: number): Promise<number> {
    return (this.one<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE chat_id = ?1 AND cancelled = 0 AND when_ts > ?2", chatId, nowSec) ?? { n: 0 }).n;
  }
  async createEvent(chatId: number, creatorId: number, creatorName: string, creatorTzMin: number, title: string, whenTs: number): Promise<number> {
    this.run("INSERT INTO events (chat_id, creator_id, creator_name, creator_tz_min, title, when_ts, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      chatId, creatorId, creatorName, creatorTzMin, title, whenTs, now());
    return this.lastId();
  }
  async setMessageId(id: number, messageId: number): Promise<void> { this.run("UPDATE events SET message_id = ?2 WHERE id = ?1", id, messageId); }
  async getEvent(id: number): Promise<EventRow | null> { return this.one<EventRow>("SELECT * FROM events WHERE id = ?1", id); }
  async cancelEvent(id: number): Promise<void> { this.run("UPDATE events SET cancelled = 1 WHERE id = ?1", id); }

  async listUpcoming(chatId: number, nowSec: number, limit = 20): Promise<UpcomingEvent[]> {
    return this.all<UpcomingEvent>(
      `SELECT e.id, e.title, e.when_ts, e.creator_name, (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.bucket = 'going') AS going
       FROM events e WHERE e.chat_id = ?1 AND e.cancelled = 0 AND e.when_ts > ?2 ORDER BY e.when_ts LIMIT ?3`, chatId, nowSec, limit);
  }
  async rsvps(eventId: number): Promise<RsvpRow[]> {
    return this.all<RsvpRow>("SELECT event_id, user_id, name, bucket FROM rsvps WHERE event_id = ?1 LIMIT 2000", eventId);
  }
  async setRsvp(eventId: number, userId: number, name: string, bucket: Bucket): Promise<void> {
    this.run(`INSERT INTO rsvps (event_id, user_id, name, bucket) VALUES (?1, ?2, ?3, ?4)
              ON CONFLICT(event_id, user_id) DO UPDATE SET name = ?3, bucket = ?4`, eventId, userId, name, bucket);
  }
  /** Events due for their 1-hour reminder: Pro groups only, when_ts in (now, now+3600], ordered, bounded. */
  async pendingEvents(nowSec: number, limit = 500): Promise<PendingEvent[]> {
    return this.all<PendingEvent>(
      `SELECT e.id, e.chat_id, e.title, e.when_ts, e.message_id, e.reminded, g.pro FROM events e
       JOIN groups g ON g.chat_id = e.chat_id
       WHERE e.reminded = 0 AND e.cancelled = 0 AND g.pro = 1 AND e.when_ts > ?1 AND e.when_ts < ?1 + 3600
       ORDER BY e.when_ts LIMIT ?2`, nowSec, limit);
  }
  async markReminded(id: number): Promise<void> { this.run("UPDATE events SET reminded = 1 WHERE id = ?1", id); }

  async myUpcoming(userId: number, nowSec: number): Promise<MyEvent[]> {
    return this.all<MyEvent>(
      `SELECT e.id, e.title, e.when_ts, g.title AS group_title, r.bucket AS my_bucket,
         (SELECT COUNT(*) FROM rsvps r2 WHERE r2.event_id = e.id AND r2.bucket = 'going') AS going
       FROM events e JOIN rsvps r ON r.event_id = e.id AND r.user_id = ?1 JOIN groups g ON g.chat_id = e.chat_id
       WHERE e.cancelled = 0 AND e.when_ts > ?2 ORDER BY e.when_ts LIMIT 50`, userId, nowSec);
  }

  /** First-touch attribution for /start payloads like "site"/"share"/"list"/"x" (see logic.ts isSourcePayload). */
  async recordSource(userId: number, src: string): Promise<void> {
    this.run("INSERT OR IGNORE INTO sources (user_id, src, ts) VALUES (?1, ?2, ?3)", userId, src, now());
  }
  private sourceStats(): Record<string, number> {
    const rows = this.all<{ src: string; n: number }>(
      "SELECT src, COUNT(*) AS n FROM sources WHERE NOT (user_id BETWEEN 900000000 AND 900999999) GROUP BY src");
    const out: Record<string, number> = {};
    for (const r of rows) out["src_" + r.src] = r.n;
    return out;
  }

  async stats(): Promise<FleetStats> {
    const g = this.one<{ n: number; p: number | null }>("SELECT COUNT(*) AS n, SUM(pro) AS p FROM groups WHERE chat_id != ?1", QA_CHAT);
    const e = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE chat_id != ?1", QA_CHAT);
    const r = this.one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM rsvps WHERE event_id IN (SELECT id FROM events WHERE chat_id != ?1) AND NOT (user_id BETWEEN 900000000 AND 900999999)`, QA_CHAT);
    const rem = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE reminded = 1 AND chat_id != ?1", QA_CHAT);
    const qg = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM groups WHERE pro = 1 AND chat_id = ?1", QA_CHAT);
    const u = this.userStats();
    return {
      ...u, qa_pro: u.qa_pro + (qg?.n ?? 0), pro: (g?.p ?? 0) + u.pro, events: e?.n ?? 0, rsvps: r?.n ?? 0,
      groups: g?.n ?? 0, reminded: rem?.n ?? 0, ...this.sourceStats(),
    };
  }
}
