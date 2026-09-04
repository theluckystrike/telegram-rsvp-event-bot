// Static-text localization for EventRSVP. Only user-facing static copy lives here —
// dynamic/group-facing content (RSVP cards, /events lists, /cancel, /tz, reminders)
// stays in index.ts and is intentionally left in English so it reads the same for
// every member of the group.
//
// Truthfulness rule: the /event parser (see logic.ts parseNamedDay) accepts only the
// literal English tokens `at|tomorrow|today|sun|mon|tue|wed|thu|fri|sat` plus `HH:MM`
// clock times. Every command example below MUST keep those tokens in English in every
// locale — translating them (e.g. "пт 19:00") produces a command that the parser
// rejects. Only the surrounding prose, and the free-text event title in the example
// (unconstrained by the parser — see logic.ts parseEventWhen), may be translated.
// The `help` text also carries a one-line note in the reader's own language saying so.

export const LANGS = ["en", "ru", "es", "pt", "id", "de", "tr", "uk", "fa", "ar", "hi"] as const;
export type Lang = (typeof LANGS)[number];
export type Key =
  | "start"
  | "help"
  | "useInGroupNudge"
  | "needMember"
  | "limitReached"
  | "proGroupInfo"
  | "proRunInGroup"
  | "proDescription"
  | "thankYou"
  | "btn_unlockProStars"
  | "btn_addToGroup"
  | "btn_shareBot";

/** ctx.from.language_code -> first two letters -> known table language, else "en". */
export function resolveLang(code?: string): Lang {
  const c = (code ?? "").slice(0, 2).toLowerCase();
  return (LANGS as readonly string[]).includes(c) ? (c as Lang) : "en";
}

/** Look up `key` for `lang` (falling back to English), substituting `{name}` tokens from `vars`. */
export function t(lang: string, key: Key, vars?: Record<string, string | number>): string {
  const l: Lang = (LANGS as readonly string[]).includes(lang) ? (lang as Lang) : "en";
  let s = TABLE[key][l] ?? TABLE[key].en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

const TABLE: Record<Key, Record<Lang, string>> = {
  start: {
    en: "📅 Ask your group who's coming — get a live headcount.\nAdd me, then `/event fri 19:00 Board games`.\nMembers tap Going / Maybe / Can't; the card keeps score.\nFree: {free} active events per group · /help",
    ru: "📅 Спросите группу, кто придёт, — получите живой подсчёт.\nДобавьте меня, затем `/event fri 19:00 Board games`.\nУчастники нажимают Going / Maybe / Can't; карточка ведёт счёт.\nБесплатно: {free} активных события на группу · /help",
    es: "📅 Pregunta a tu grupo quién viene y obtén un recuento en vivo.\nAgrégame, luego `/event fri 19:00 Board games`.\nLos miembros tocan Going / Maybe / Can't; la tarjeta lleva la cuenta.\nGratis: {free} eventos activos por grupo · /help",
    pt: "📅 Pergunte ao seu grupo quem vai — tenha uma contagem ao vivo.\nAdicione-me, depois `/event fri 19:00 Board games`.\nOs membros tocam em Going / Maybe / Can't; o cartão mantém a contagem.\nGrátis: {free} eventos ativos por grupo · /help",
    id: "📅 Tanyakan ke grupmu siapa yang datang — dapatkan hitungan langsung.\nTambahkan aku, lalu `/event fri 19:00 Board games`.\nAnggota tap Going / Maybe / Can't; kartu menyimpan skornya.\nGratis: {free} acara aktif per grup · /help",
    de: "📅 Frag deine Gruppe, wer kommt — mit Live-Zählung.\nFüge mich hinzu, dann `/event fri 19:00 Board games`.\nMitglieder tippen Going / Maybe / Can't; die Karte zählt mit.\nKostenlos: {free} aktive Events pro Gruppe · /help",
    tr: "📅 Grubuna kimin geleceğini sor — canlı sayım al.\nBeni ekle, sonra `/event fri 19:00 Board games`.\nÜyeler Going / Maybe / Can't'a dokunur; kart skoru tutar.\nÜcretsiz: grup başına {free} aktif etkinlik · /help",
    uk: "📅 Запитайте групу, хто прийде, — отримайте живий підрахунок.\nДодайте мене, потім `/event fri 19:00 Board games`.\nУчасники тиснуть Going / Maybe / Can't; картка веде рахунок.\nБезкоштовно: {free} активних подій на групу · /help",
    fa: "📅 از گروهتان بپرسید چه کسی می‌آید — شمارش زنده بگیرید.\nمرا اضافه کنید، سپس `/event fri 19:00 Board games`.\nاعضا روی Going / Maybe / Can't می‌زنند؛ کارت امتیاز را نگه می‌دارد.\nرایگان: {free} رویداد فعال در هر گروه · /help",
    ar: "📅 اسأل مجموعتك من سيحضر — واحصل على عدّاد حي.\nأضفني، ثم `/event fri 19:00 Board games`.\nيضغط الأعضاء على Going / Maybe / Can't؛ وتحتفظ البطاقة بالنتيجة.\nمجانًا: {free} فعاليات نشطة لكل مجموعة · /help",
    hi: "📅 अपने ग्रुप से पूछें कौन आ रहा है — लाइव हेडकाउंट पाएं।\nमुझे जोड़ें, फिर `/event fri 19:00 Board games`।\nसदस्य Going / Maybe / Can't पर टैप करते हैं; कार्ड स्कोर रखता है।\nमुफ़्त: प्रति ग्रुप {free} सक्रिय इवेंट · /help",
  },
  help: {
    en: "📅 *EventRSVP* posts RSVP cards for group events.\n\nAdd me to a group, then:\n`/event in 2h Team sync` — start in 2 hours\n`/event at 19:00 Movie night` — today/next 19:00\n`/event fri 19:00 Board games` — next Friday\n`/event tomorrow 09:00 Standup` — tomorrow\n`/event {date} 19:00 Launch party` — a specific date\n`/events` — list upcoming\n`/cancel 3` — cancel #3 (creator only)\n`/tz +2` — your UTC offset (times you type/see use it)\n\nCommands stay in English: `fri`, `at`, `tomorrow`, `today`.\n\nFree: {free} active events per group, no reminders. Pro: unlimited + 1-hour reminders, one-time {stars} ⭐ — /pro",
    ru: "📅 *EventRSVP* публикует карточки RSVP для групповых событий.\n\nДобавьте меня в группу, затем:\n`/event in 2h Team sync` — начало через 2 часа\n`/event at 19:00 Movie night` — сегодня/ближайшие 19:00\n`/event fri 19:00 Board games` — в ближайшую пятницу\n`/event tomorrow 09:00 Standup` — завтра\n`/event {date} 19:00 Launch party` — конкретная дата\n`/events` — список ближайших\n`/cancel 3` — отменить №3 (только создатель)\n`/tz +2` — ваше смещение UTC (учитывается во всех временах)\n\nКоманды остаются на английском: `fri`, `at`, `tomorrow`, `today`.\n\nБесплатно: {free} активных события на группу, без напоминаний. Pro: без ограничений + напоминания за час, разовый платёж {stars} ⭐ — /pro",
    es: "📅 *EventRSVP* publica tarjetas de RSVP para eventos de grupo.\n\nAgrégame a un grupo, luego:\n`/event in 2h Team sync` — empieza en 2 horas\n`/event at 19:00 Movie night` — hoy/próximas 19:00\n`/event fri 19:00 Board games` — el próximo viernes\n`/event tomorrow 09:00 Standup` — mañana\n`/event {date} 19:00 Launch party` — una fecha concreta\n`/events` — lista de próximos\n`/cancel 3` — cancela el #3 (solo el creador)\n`/tz +2` — tu desfase UTC (se usa en las horas que escribes/ves)\n\nLos comandos permanecen en inglés: `fri`, `at`, `tomorrow`, `today`.\n\nGratis: {free} eventos activos por grupo, sin recordatorios. Pro: ilimitado + recordatorios de 1 hora, pago único de {stars} ⭐ — /pro",
    pt: "📅 *EventRSVP* publica cartões de RSVP para eventos do grupo.\n\nAdicione-me a um grupo, depois:\n`/event in 2h Team sync` — começa em 2 horas\n`/event at 19:00 Movie night` — hoje/próximas 19:00\n`/event fri 19:00 Board games` — próxima sexta-feira\n`/event tomorrow 09:00 Standup` — amanhã\n`/event {date} 19:00 Launch party` — uma data específica\n`/events` — listar próximos\n`/cancel 3` — cancelar #3 (somente o criador)\n`/tz +2` — seu deslocamento UTC (usado nos horários que você digita/vê)\n\nOs comandos permanecem em inglês: `fri`, `at`, `tomorrow`, `today`.\n\nGrátis: {free} eventos ativos por grupo, sem lembretes. Pro: ilimitado + lembretes de 1 hora, pagamento único de {stars} ⭐ — /pro",
    id: "📅 *EventRSVP* memposting kartu RSVP untuk acara grup.\n\nTambahkan aku ke grup, lalu:\n`/event in 2h Team sync` — mulai dalam 2 jam\n`/event at 19:00 Movie night` — hari ini/berikutnya jam 19:00\n`/event fri 19:00 Board games` — Jumat berikutnya\n`/event tomorrow 09:00 Standup` — besok\n`/event {date} 19:00 Launch party` — tanggal tertentu\n`/events` — daftar acara mendatang\n`/cancel 3` — batalkan #3 (hanya pembuat)\n`/tz +2` — offset UTC kamu (dipakai untuk waktu yang kamu ketik/lihat)\n\nPerintah tetap dalam bahasa Inggris: `fri`, `at`, `tomorrow`, `today`.\n\nGratis: {free} acara aktif per grup, tanpa pengingat. Pro: tanpa batas + pengingat 1 jam sebelumnya, sekali bayar {stars} ⭐ — /pro",
    de: "📅 *EventRSVP* postet RSVP-Karten für Gruppenevents.\n\nFüge mich zu einer Gruppe hinzu, dann:\n`/event in 2h Team sync` — beginnt in 2 Stunden\n`/event at 19:00 Movie night` — heute/nächste 19:00\n`/event fri 19:00 Board games` — nächsten Freitag\n`/event tomorrow 09:00 Standup` — morgen\n`/event {date} 19:00 Launch party` — ein bestimmtes Datum\n`/events` — kommende auflisten\n`/cancel 3` — #3 absagen (nur Ersteller)\n`/tz +2` — dein UTC-Offset (gilt für Zeiten, die du eingibst/siehst)\n\nBefehle bleiben auf Englisch: `fri`, `at`, `tomorrow`, `today`.\n\nKostenlos: {free} aktive Events pro Gruppe, keine Erinnerungen. Pro: unbegrenzt + Erinnerung 1 Stunde vorher, einmalig {stars} ⭐ — /pro",
    tr: "📅 *EventRSVP* grup etkinlikleri için RSVP kartları paylaşır.\n\nBeni bir gruba ekle, sonra:\n`/event in 2h Team sync` — 2 saat sonra başlar\n`/event at 19:00 Movie night` — bugün/sıradaki 19:00\n`/event fri 19:00 Board games` — gelecek Cuma\n`/event tomorrow 09:00 Standup` — yarın\n`/event {date} 19:00 Launch party` — belirli bir tarih\n`/events` — yaklaşanları listele\n`/cancel 3` — #3'ü iptal et (yalnızca oluşturan)\n`/tz +2` — UTC farkın (yazdığın/gördüğün saatlerde kullanılır)\n\nKomutlar İngilizce kalır: `fri`, `at`, `tomorrow`, `today`.\n\nÜcretsiz: grup başına {free} aktif etkinlik, hatırlatma yok. Pro: sınırsız + 1 saat önceden hatırlatma, tek seferlik {stars} ⭐ — /pro",
    uk: "📅 *EventRSVP* публікує картки RSVP для групових подій.\n\nДодайте мене до групи, потім:\n`/event in 2h Team sync` — початок через 2 години\n`/event at 19:00 Movie night` — сьогодні/найближчі 19:00\n`/event fri 19:00 Board games` — найближча п'ятниця\n`/event tomorrow 09:00 Standup` — завтра\n`/event {date} 19:00 Launch party` — конкретна дата\n`/events` — список найближчих\n`/cancel 3` — скасувати №3 (лише творець)\n`/tz +2` — ваше зміщення UTC (враховується в усіх часах)\n\nКоманди залишаються англійською: `fri`, `at`, `tomorrow`, `today`.\n\nБезкоштовно: {free} активних подій на групу, без нагадувань. Pro: без обмежень + нагадування за годину, разовий платіж {stars} ⭐ — /pro",
    fa: "📅 *EventRSVP* برای رویدادهای گروهی کارت RSVP ارسال می‌کند.\n\nمرا به یک گروه اضافه کنید، سپس:\n`/event in 2h Team sync` — شروع ۲ ساعت دیگر\n`/event at 19:00 Movie night` — امروز/نزدیک‌ترین ساعت ۱۹:۰۰\n`/event fri 19:00 Board games` — جمعه آینده\n`/event tomorrow 09:00 Standup` — فردا\n`/event {date} 19:00 Launch party` — یک تاریخ مشخص\n`/events` — فهرست رویدادهای پیش رو\n`/cancel 3` — لغو رویداد #3 (فقط سازنده)\n`/tz +2` — اختلاف ساعت شما با UTC (در زمان‌هایی که تایپ/می‌بینید اعمال می‌شود)\n\nدستورها به انگلیسی باقی می‌مانند: `fri`, `at`, `tomorrow`, `today`.\n\nرایگان: {free} رویداد فعال در هر گروه، بدون یادآوری. Pro: نامحدود + یادآوری یک‌ساعته، پرداخت یک‌باره {stars} ⭐ — /pro",
    ar: "📅 *EventRSVP* ينشر بطاقات تأكيد الحضور لفعاليات المجموعة.\n\nأضفني إلى مجموعة، ثم:\n`/event in 2h Team sync` — يبدأ خلال ساعتين\n`/event at 19:00 Movie night` — اليوم/أقرب الساعة 19:00\n`/event fri 19:00 Board games` — يوم الجمعة القادم\n`/event tomorrow 09:00 Standup` — غدًا\n`/event {date} 19:00 Launch party` — تاريخ محدد\n`/events` — عرض القادمة\n`/cancel 3` — إلغاء #3 (المنشئ فقط)\n`/tz +2` — فارقك عن UTC (يُستخدم في الأوقات التي تكتبها/تراها)\n\nتبقى الأوامر بالإنجليزية: `fri`, `at`, `tomorrow`, `today`.\n\nمجانًا: {free} فعاليات نشطة لكل مجموعة، بدون تذكيرات. Pro: غير محدود + تذكير قبل ساعة، دفعة واحدة {stars} ⭐ — /pro",
    hi: "📅 *EventRSVP* ग्रुप इवेंट्स के लिए RSVP कार्ड पोस्ट करता है।\n\nमुझे किसी ग्रुप में जोड़ें, फिर:\n`/event in 2h Team sync` — 2 घंटे में शुरू\n`/event at 19:00 Movie night` — आज/अगली 19:00\n`/event fri 19:00 Board games` — अगला शुक्रवार\n`/event tomorrow 09:00 Standup` — कल\n`/event {date} 19:00 Launch party` — कोई खास तारीख\n`/events` — आगामी सूची\n`/cancel 3` — #3 रद्द करें (केवल बनाने वाला)\n`/tz +2` — आपका UTC ऑफ़सेट (आपके द्वारा टाइप/देखे गए समय में लागू होता है)\n\nकमांड अंग्रेज़ी में ही रहते हैं: `fri`, `at`, `tomorrow`, `today`।\n\nमुफ़्त: प्रति ग्रुप {free} सक्रिय इवेंट, कोई रिमाइंडर नहीं। Pro: असीमित + 1 घंटे पहले रिमाइंडर, एकमुश्त {stars} ⭐ — /pro",
  },
  useInGroupNudge: {
    en: "Use /event inside a group.",
    ru: "Используйте /event внутри группы.",
    es: "Usa /event dentro de un grupo.",
    pt: "Use /event dentro de um grupo.",
    id: "Gunakan /event di dalam grup.",
    de: "Nutze /event innerhalb einer Gruppe.",
    tr: "/event komutunu bir grup içinde kullan.",
    uk: "Використовуйте /event всередині групи.",
    fa: "دستور /event را داخل یک گروه استفاده کنید.",
    ar: "استخدم /event داخل مجموعة.",
    hi: "किसी ग्रुप के अंदर /event इस्तेमाल करें।",
  },
  needMember: {
    en: "You need to be a member of that group to unlock Pro for it.",
    ru: "Чтобы разблокировать Pro для этой группы, вы должны быть её участником.",
    es: "Debes ser miembro de ese grupo para desbloquear Pro en él.",
    pt: "Você precisa ser membro desse grupo para desbloquear o Pro nele.",
    id: "Kamu harus jadi anggota grup itu untuk membuka Pro di sana.",
    de: "Du musst Mitglied dieser Gruppe sein, um Pro dafür freizuschalten.",
    tr: "O grup için Pro'yu açmak için grubun üyesi olman gerekir.",
    uk: "Щоб розблокувати Pro для цієї групи, ви маєте бути її учасником.",
    fa: "برای فعال‌سازی Pro برای آن گروه باید عضو آن گروه باشید.",
    ar: "يجب أن تكون عضوًا في تلك المجموعة لتفعيل Pro لها.",
    hi: "उस ग्रुप के लिए Pro अनलॉक करने के लिए आपको उसका सदस्य होना ज़रूरी है।",
  },
  limitReached: {
    en: "This group has {free} active events already (the free limit). Pro is unlimited + reminders, one-time {stars} ⭐.",
    ru: "В этой группе уже {free} активных события (бесплатный лимит). Pro без ограничений + напоминания, разовый платёж {stars} ⭐.",
    es: "Este grupo ya tiene {free} eventos activos (el límite gratuito). Pro es ilimitado + recordatorios, pago único de {stars} ⭐.",
    pt: "Este grupo já tem {free} eventos ativos (o limite grátis). Pro é ilimitado + lembretes, pagamento único de {stars} ⭐.",
    id: "Grup ini sudah punya {free} acara aktif (batas gratis). Pro tanpa batas + pengingat, sekali bayar {stars} ⭐.",
    de: "Diese Gruppe hat bereits {free} aktive Events (das kostenlose Limit). Pro ist unbegrenzt + Erinnerungen, einmalig {stars} ⭐.",
    tr: "Bu grupta zaten {free} aktif etkinlik var (ücretsiz sınır). Pro sınırsızdır + hatırlatmalar, tek seferlik {stars} ⭐.",
    uk: "У цій групі вже {free} активних подій (безкоштовний ліміт). Pro без обмежень + нагадування, разовий платіж {stars} ⭐.",
    fa: "این گروه هم‌اکنون {free} رویداد فعال دارد (سقف رایگان). Pro نامحدود + یادآوری است، پرداخت یک‌باره {stars} ⭐.",
    ar: "تحتوي هذه المجموعة بالفعل على {free} فعاليات نشطة (الحد المجاني). Pro غير محدود + تذكيرات، دفعة واحدة {stars} ⭐.",
    hi: "इस ग्रुप में पहले से {free} सक्रिय इवेंट हैं (मुफ़्त सीमा)। Pro असीमित + रिमाइंडर देता है, एकमुश्त {stars} ⭐।",
  },
  proGroupInfo: {
    en: "Pro for this group: unlimited events + 1-hour reminders, one-time {stars} ⭐.",
    ru: "Pro для этой группы: неограниченные события + напоминания за час, разовый платёж {stars} ⭐.",
    es: "Pro para este grupo: eventos ilimitados + recordatorios de 1 hora, pago único de {stars} ⭐.",
    pt: "Pro para este grupo: eventos ilimitados + lembretes de 1 hora, pagamento único de {stars} ⭐.",
    id: "Pro untuk grup ini: acara tanpa batas + pengingat 1 jam sebelumnya, sekali bayar {stars} ⭐.",
    de: "Pro für diese Gruppe: unbegrenzte Events + Erinnerung 1 Stunde vorher, einmalig {stars} ⭐.",
    tr: "Bu grup için Pro: sınırsız etkinlik + 1 saat önceden hatırlatma, tek seferlik {stars} ⭐.",
    uk: "Pro для цієї групи: необмежені події + нагадування за годину, разовий платіж {stars} ⭐.",
    fa: "Pro برای این گروه: رویدادهای نامحدود + یادآوری یک‌ساعته، پرداخت یک‌باره {stars} ⭐.",
    ar: "Pro لهذه المجموعة: فعاليات غير محدودة + تذكير قبل ساعة، دفعة واحدة {stars} ⭐.",
    hi: "इस ग्रुप के लिए Pro: असीमित इवेंट + 1 घंटे पहले रिमाइंडर, एकमुश्त {stars} ⭐।",
  },
  proRunInGroup: {
    en: "Run /pro inside the group you want to upgrade.",
    ru: "Запустите /pro внутри группы, которую хотите обновить.",
    es: "Ejecuta /pro dentro del grupo que quieres mejorar.",
    pt: "Execute /pro dentro do grupo que deseja atualizar.",
    id: "Jalankan /pro di dalam grup yang ingin kamu tingkatkan.",
    de: "Führe /pro in der Gruppe aus, die du upgraden möchtest.",
    tr: "Yükseltmek istediğin grubun içinde /pro çalıştır.",
    uk: "Запустіть /pro всередині групи, яку хочете оновити.",
    fa: "دستور /pro را داخل گروهی که می‌خواهید ارتقا دهید اجرا کنید.",
    ar: "شغّل /pro داخل المجموعة التي تريد ترقيتها.",
    hi: "जिस ग्रुप को अपग्रेड करना है, उसके अंदर /pro चलाएं।",
  },
  proDescription: {
    en: "Unlimited active events and 1-hour reminders for one group. One-time payment, no subscription.",
    ru: "Неограниченные активные события и напоминания за час для одной группы. Разовый платёж, без подписки.",
    es: "Eventos activos ilimitados y recordatorios de 1 hora para un grupo. Pago único, sin suscripción.",
    pt: "Eventos ativos ilimitados e lembretes de 1 hora para um grupo. Pagamento único, sem assinatura.",
    id: "Acara aktif tanpa batas dan pengingat 1 jam sebelumnya untuk satu grup. Sekali bayar, tanpa langganan.",
    de: "Unbegrenzte aktive Events und Erinnerung 1 Stunde vorher für eine Gruppe. Einmalzahlung, kein Abo.",
    tr: "Bir grup için sınırsız aktif etkinlik ve 1 saat önceden hatırlatma. Tek seferlik ödeme, abonelik yok.",
    uk: "Необмежені активні події та нагадування за годину для однієї групи. Разовий платіж, без підписки.",
    fa: "رویدادهای فعال نامحدود و یادآوری یک‌ساعته برای یک گروه. پرداخت یک‌باره، بدون اشتراک.",
    ar: "فعاليات نشطة غير محدودة وتذكير قبل ساعة لمجموعة واحدة. دفعة واحدة، بدون اشتراك.",
    hi: "एक ग्रुप के लिए असीमित सक्रिय इवेंट और 1 घंटे पहले रिमाइंडर। एकमुश्त भुगतान, कोई सब्सक्रिप्शन नहीं।",
  },
  thankYou: {
    en: "✅ Pro unlocked for the group. Unlimited events + reminders.\n\n/more — more free tools",
    ru: "✅ Pro активирован для группы. Неограниченные события + напоминания.\n\n/more — другие бесплатные инструменты",
    es: "✅ Pro activado para el grupo. Eventos ilimitados + recordatorios.\n\n/more — más herramientas gratis",
    pt: "✅ Pro ativado para o grupo. Eventos ilimitados + lembretes.\n\n/more — mais ferramentas grátis",
    id: "✅ Pro aktif untuk grup. Acara tanpa batas + pengingat.\n\n/more — alat gratis lainnya",
    de: "✅ Pro für die Gruppe freigeschaltet. Unbegrenzte Events + Erinnerungen.\n\n/more — weitere kostenlose Tools",
    tr: "✅ Grup için Pro açıldı. Sınırsız etkinlik + hatırlatmalar.\n\n/more — daha fazla ücretsiz araç",
    uk: "✅ Pro активовано для групи. Необмежені події + нагадування.\n\n/more — інші безкоштовні інструменти",
    fa: "✅ Pro برای گروه فعال شد. رویدادهای نامحدود + یادآوری‌ها.\n\n/more — ابزارهای رایگان بیشتر",
    ar: "✅ تم تفعيل Pro للمجموعة. فعاليات غير محدودة + تذكيرات.\n\n/more — أدوات مجانية أخرى",
    hi: "✅ ग्रुप के लिए Pro अनलॉक हुआ। असीमित इवेंट + रिमाइंडर।\n\n/more — और मुफ़्त टूल्स",
  },
  btn_unlockProStars: {
    en: "Unlock Pro, {stars} ⭐",
    ru: "Открыть Pro, {stars} ⭐",
    es: "Desbloquear Pro, {stars} ⭐",
    pt: "Desbloquear Pro, {stars} ⭐",
    id: "Buka Pro, {stars} ⭐",
    de: "Pro freischalten, {stars} ⭐",
    tr: "Pro'yu aç, {stars} ⭐",
    uk: "Розблокувати Pro, {stars} ⭐",
    fa: "باز کردن Pro، {stars} ⭐",
    ar: "فتح Pro، {stars} ⭐",
    hi: "Pro अनलॉक करें, {stars} ⭐",
  },
  btn_addToGroup: {
    en: "Add me to a group",
    ru: "Добавить меня в группу",
    es: "Añádeme a un grupo",
    pt: "Adicione-me a um grupo",
    id: "Tambahkan aku ke grup",
    de: "Zu Gruppe hinzufügen",
    tr: "Gruba ekle",
    uk: "Додати мене до групи",
    fa: "افزودن به گروه",
    ar: "أضفني إلى مجموعة",
    hi: "मुझे ग्रुप में जोड़ें",
  },
  btn_shareBot: {
    en: "Share this bot",
    ru: "Поделиться ботом",
    es: "Compartir este bot",
    pt: "Compartilhar este bot",
    id: "Bagikan bot ini",
    de: "Bot teilen",
    tr: "Botu paylaş",
    uk: "Поділитися ботом",
    fa: "اشتراک‌گذاری ربات",
    ar: "مشاركة هذا البوت",
    hi: "यह बॉट शेयर करें",
  },
};
