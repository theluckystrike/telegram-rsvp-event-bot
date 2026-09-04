# EventRSVPProBot — RSVP event bot for Telegram

**Try it:** [@EventRSVPProBot](https://t.me/EventRSVPProBot) · [tg.zovo.one/bots/rsvp/](https://tg.zovo.one/bots/rsvp/)

## What it does

EventRSVPProBot turns a Telegram group message into an event card with three tappable buttons — Going, Maybe, Can't — that update in place as people respond, so the whole group can see who's in without a side thread of replies. It reads flexible time phrases like "in 2h", "fri 19:00", or a full date. Free tier: 3 active events per group. Pro adds unlimited active events and an automatic reminder posted an hour before the event starts.

## Use it without adding the bot

Type `@EventRSVPProBot` in **any** Telegram chat, even one the bot has never been added to. It answers with a pitch card — an RSVP needs a persistent event in a chat the bot belongs to, so this one's a pitch rather than a live answer.

Both **Inline Mode** and **Guest Chat Mode** need to be turned on for the bot in [@BotFather](https://t.me/BotFather) (Bot Settings → Mode Settings) — turn Inline Mode on first, then Guest Chat Mode. Without both, only the classic `@Bot query` inline surface works.

## Self-host

```bash
pnpm i
wrangler secret put BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
wrangler deploy
curl -G "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  --data-urlencode "url=https://<your-worker>.workers.dev/webhook" \
  --data-urlencode "secret_token=$WEBHOOK_SECRET" \
  --data-urlencode 'allowed_updates=["message","callback_query","guest_message","inline_query","chosen_inline_result"]'
```

## Stack

[grammY](https://grammy.dev/) on Cloudflare Workers, state in a Durable Object backed by SQLite, a 1-minute Cron Trigger for reminders, Pro upgrades billed with Telegram Stars.

---
Part of Tiny Telegram Tools — https://tg.zovo.one/
