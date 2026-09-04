# EventRSVPProBot — RSVP event bot for Telegram

**Try it:** [@EventRSVPProBot](https://t.me/EventRSVPProBot) · [tg.zovo.one/bots/rsvp/](https://tg.zovo.one/bots/rsvp/)

## What it does

EventRSVPProBot turns a Telegram group message into an event card with three tappable buttons — Going, Maybe, Can't — that update in place as people respond, so the whole group can see who's in without a side thread of replies. It reads flexible time phrases like "in 2h", "fri 19:00", or a full date. Free tier: 3 active events per group. Pro adds unlimited active events and an automatic reminder posted an hour before the event starts.

## Self-host

```bash
pnpm i
wrangler secret put BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
wrangler deploy
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook?url=https://<your-worker>.workers.dev/webhook&secret_token=$WEBHOOK_SECRET"
```

## Stack

[grammY](https://grammy.dev/) on Cloudflare Workers, state in a Durable Object backed by SQLite, a 1-minute Cron Trigger for reminders, Pro upgrades billed with Telegram Stars.

---
Part of Tiny Telegram Tools — https://tg.zovo.one/
