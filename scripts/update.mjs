import { readFile, writeFile, mkdir } from 'node:fs/promises';

const FILE = 'data/prices.json';
const KEEP_DAYS = 400;
const GRAMS_PER_OUNCE = 31.1035;
const TZ = 'Africa/Cairo';
// بعد أي تحديث ناجح ننتظر 12 ساعة. نستخدم 11.5 كهامش لأن الجدولة قد تتأخر دقائق.
const MIN_AGE_MS = 11.5 * 3600000;
const FORCE = process.env.FORCE === 'true';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 3 محاولات قبل ما نعتبر المصدر واقع (يمنع فشل التحديث بسبب عطل لحظي)
async function getJSON(url) {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'gold-egypt-bot' } });
      if (!res.ok) throw new Error(url + ' -> ' + res.status);
      return await res.json();
    } catch (e) {
      err = e;
      if (i < 2) await sleep(10000 * (i + 1));
    }
  }
  throw err;
}

// آخر 14 يوم كل نقطة، وما قبلها نقطة واحدة في اليوم: يبقي الملف صغير وسريع للأبد
const FULL_DAYS = 14;
function compact(history) {
  const cut = Date.now() - FULL_DAYS * 86400000;
  const daily = new Map();
  const recent = [];
  for (const p of history) {
    if (new Date(p.t).getTime() >= cut) recent.push(p);
    else daily.set(new Date(p.t).toISOString().slice(0, 10), p);
  }
  return [...daily.values(), ...recent];
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const r2 = (n) => Math.round(n * 100) / 100;

// يكتب الأسعار والتاريخ داخل HTML نفسه عشان جوجل يشوفهم بدون JavaScript
async function patchHtml(c, nowIso) {
  const d = new Date(nowIso);
  const dateAr = d.toLocaleDateString('ar-EG-u-nu-latn', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const stamp = d.toLocaleString('ar-EG-u-nu-latn', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' });

  let html = await readFile('index.html', 'utf8');
  const sub = (re, fn) => { html = html.replace(re, (...m) => fn(m)); };

  sub(/<title>[^<]*<\/title>/, () => `<title>سعر الذهب اليوم في مصر ${dateAr}</title>`);
  sub(/(<meta name='description' content=')[^']*(')/, (m) =>
    `${m[1]}سعر الذهب اليوم ${dateAr}: عيار 21 بـ ${fmt(c.g21)} جنيه، عيار 24 بـ ${fmt(c.g24)}، عيار 18 بـ ${fmt(c.g18)}، والجنيه الذهب ${fmt(c.pound)} جنيه.${m[2]}`);
  sub(/(<span id='today'>)[^<]*(<\/span>)/, (m) => m[1] + dateAr + m[2]);
  sub(/(<p id='upd'>)[^<]*(<\/p>)/, (m) => m[1] + 'آخر تحديث: ' + stamp + m[2]);
  for (const k of ['g24', 'g21', 'g18', 'pound']) {
    sub(new RegExp(`(id='${k}'[^>]*>\\s*<span>[^<]*</span>\\s*<b>)[^<]*(</b>)`), (m) => m[1] + fmt(c[k]) + m[2]);
  }
  sub(/(<b id='oz'>)[^<]*(<\/b>)/, (m) => m[1] + fmt(c.ounceUsd) + m[2]);
  sub(/(<b id='fx'>)[^<]*(<\/b>)/, (m) => m[1] + c.usdEgp.toFixed(2) + m[2]);
  await writeFile('index.html', html);

  // تحديث lastmod للصفحة الرئيسية في السايت ماب
  let sm = await readFile('sitemap.xml', 'utf8');
  sm = sm.replace(/(<loc>[^<]*\/<\/loc>)(<lastmod>[^<]*<\/lastmod>)?(<changefreq>hourly)/, (a, loc, lm, rest) =>
    `${loc}<lastmod>${nowIso.slice(0, 10)}</lastmod>${rest}`);
  await writeFile('sitemap.xml', sm);
}

async function main() {
  await mkdir('data', { recursive: true });

  let db = { updated: null, current: null, history: [] };
  try { db = JSON.parse(await readFile(FILE, 'utf8')); } catch {}

  if (!FORCE && db.updated && Date.now() - new Date(db.updated).getTime() < MIN_AGE_MS) {
    const h = ((Date.now() - new Date(db.updated).getTime()) / 3600000).toFixed(1);
    console.log('skip: last successful update was ' + h + ' hours ago');
    return;
  }

  const gold = await getJSON('https://api.gold-api.com/price/XAU');
  const fx = await getJSON('https://open.er-api.com/v6/latest/USD');

  const ounceUsd = Number(gold.price);
  const usdEgp = Number(fx.rates.EGP);

  if (!(ounceUsd > 500 && ounceUsd < 20000)) throw new Error('bad gold price: ' + ounceUsd);
  if (!(usdEgp > 5 && usdEgp < 500)) throw new Error('bad fx rate: ' + usdEgp);

  const g24 = (ounceUsd * usdEgp) / GRAMS_PER_OUNCE;
  const now = new Date().toISOString();

  const current = {
    time: now,
    ounceUsd: r2(ounceUsd),
    usdEgp: r2(usdEgp),
    g24: r2(g24),
    g21: r2((g24 * 21) / 24),
    g18: r2((g24 * 18) / 24),
    pound: r2(((g24 * 21) / 24) * 8)
  };

  db.current = current;
  db.updated = now;
  db.history.push({ t: now, g24: current.g24, g21: current.g21, g18: current.g18, pound: current.pound });

  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  db.history = compact(db.history.filter((p) => new Date(p.t).getTime() >= cutoff));

  await writeFile(FILE, JSON.stringify(db));
  console.log('updated', current);

  try { await patchHtml(current, now); } catch (e) { console.warn('html patch skipped:', e.message); }
}

main().catch((e) => { console.error(e); process.exit(1); });
