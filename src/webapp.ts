/** Telegram Mini App: initData validation (HMAC-SHA256, key "WebAppData") + tiny JSON API + HTML shell. */
const enc = new TextEncoder();
const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

export interface InitUser { id: number; first_name: string; username?: string; }

async function hashMatches(hash: string, dcs: string, token: string): Promise<boolean> {
  const secret = await hmac(enc.encode("WebAppData"), token);
  return hex(await hmac(secret, dcs)) === hash;
}

/** Returns the user if initData is authentic (signed by any of `tokens`, e.g. a bot's own
 * BOT_TOKEN plus a shared hub bot token) and younger than maxAgeSec, else null. */
export async function validateInitData(initData: string, tokens: string | string[], maxAgeSec = 86_400): Promise<InitUser | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const list = Array.isArray(tokens) ? tokens : [tokens];
  let ok = false;
  for (const token of list) { if (await hashMatches(hash, dcs, token)) { ok = true; break; } }
  if (!ok) return null;
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > maxAgeSec) return null;
  try { return JSON.parse(params.get("user") ?? "null") as InitUser | null; } catch { return null; }
}

/** Pure: one-line pitch + an attributable deep link (?start=<startParam>), for both the
 * "Share to a chat" prepared message and any "Share to story" widget_link text. Kept short
 * enough (fleet convention: <=300 chars) to fit comfortably in a story/chat share sheet.
 * Lives here (not kit.ts) so it stays importable by tests without pulling in kit.ts's
 * "cloudflare:workers" DurableObject dependency. */
export function buildShareText(pitch: string, botUsername: string, startParam: string): string {
  return `${pitch}\n\nhttps://t.me/${botUsername}?start=${startParam}`;
}

export const APP_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EventRSVP</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>body{margin:0;font:16px/1.4 -apple-system,system-ui,sans-serif;background:var(--tg-theme-bg-color,#fff);color:var(--tg-theme-text-color,#111);padding:16px}
h1{font-size:18px;margin:0 0 12px}.e{padding:12px;border-radius:12px;background:var(--tg-theme-secondary-bg-color,#f3f3f3);margin-bottom:8px}
.e b{display:block}.e small{color:var(--tg-theme-hint-color,#777)}.tag{display:inline-block;border-radius:8px;padding:2px 8px;font-size:12px;margin-top:6px}
.going{background:#d7f5df;color:#1a7a34}.maybe{background:#fff3cf;color:#8a6a00}.cant{background:#fde0e0;color:#9c2b2b}.empty{color:var(--tg-theme-hint-color,#777)}
.more{margin-top:20px}.more h2{font-size:14px;color:var(--tg-theme-hint-color,#777);margin:0 0 8px}.app{padding:10px 12px;border-radius:12px;background:var(--tg-theme-secondary-bg-color,#f3f3f3);margin-bottom:6px;cursor:pointer}</style></head><body>
<h1>📅 Your upcoming events</h1><div id="list" class="empty">Loading…</div>
<div id="shareRow" style="margin-top:14px"></div>
<div class="more"><h2>More apps</h2><div id="moreapps"></div></div>
<script>
const tg=window.Telegram.WebApp;tg.ready();tg.expand();
async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:tg.initData,...body})});return r.json()}
function esc(s){return String(s).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}
const TAG={going:['✅ Going','going'],maybe:['🤔 Maybe','maybe'],cant:["❌ Can't",'cant']};
async function load(){const d=await api('/api/events',{});const el=document.getElementById('list');if(d.error){el.textContent=d.error;return}
 if(!d.events.length){el.innerHTML='No RSVPs yet. Tap a button on an event card in a group.';return}
 el.className='';el.innerHTML=d.events.map(e=>{const t=TAG[e.my_bucket]||['',''];return '<div class="e"><b>'+esc(e.title)+'</b><small>'+esc(e.group_title||'Group')+' · '+esc(e.when)+' · '+e.going+' going</small><span class="tag '+t[1]+'">'+t[0]+'</span></div>'}).join('')}
load();
const MORE_APPS=[['🔒 WhisperLock','WhisperLockBot'],['⏰ NudgeRemind','NudgeRemindBot'],['📮 AnonInboxPro','AnonInboxProBot'],['🧾 SplitTabs','SplitTabsBot'],['🔥 HabitStreakPro','HabitStreakProBot']];
const ma=document.getElementById('moreapps');
ma.innerHTML=MORE_APPS.map(([label,bot])=>'<div class="app" data-bot="'+bot+'">'+esc(label)+'</div>').join('');
ma.addEventListener('click',e=>{const b=e.target.closest('[data-bot]');if(b)tg.openTelegramLink('tg://resolve?domain='+b.dataset.bot)});
function renderShare(){const el=document.getElementById("shareRow");if(!el)return;let ok=false;try{ok=typeof tg.shareMessage==="function"&&tg.isVersionAtLeast("8.0")}catch(e){}if(ok){const b=document.createElement("button");b.textContent="💬 Share to a chat";b.style.cssText="border:0;border-radius:10px;padding:10px 14px;font-size:14px;background:var(--tg-theme-secondary-bg-color,#f3f3f3);color:var(--tg-theme-text-color,#111);width:100%";b.onclick=async()=>{try{const r=await fetch("/api/share",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:tg.initData})});const d=await r.json();if(d&&d.id)tg.shareMessage(d.id)}catch(e){}};el.appendChild(b)}let ok2=false;try{ok2=typeof tg.shareToStory==="function"&&tg.isVersionAtLeast("7.8")}catch(e){}if(ok2){const s=document.createElement("button");s.textContent="📣 Share to story";s.style.cssText="border:0;border-radius:10px;padding:10px 14px;font-size:14px;background:var(--tg-theme-secondary-bg-color,#f3f3f3);color:var(--tg-theme-text-color,#111);width:100%;margin-top:8px";s.onclick=()=>{try{fetch("/api/share-story",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:tg.initData})}).catch(()=>{});tg.shareToStory("https://tg.zovo.one/img/banner-rsvp.png",{text:"Free RSVP cards for group events — going / maybe / can't, right in the chat.\\n\\nhttps://t.me/EventRSVPBot?start=story",widget_link:{url:"https://t.me/EventRSVPBot?start=story",name:"EventRSVP"}})}catch(e){}};el.appendChild(s)}}
renderShare();
</script></body></html>`;
