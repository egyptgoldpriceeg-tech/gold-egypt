import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'data/prices.json';
const START = '2026-01-01';
const GRAMS_PER_OUNCE = 31.1035;
const r2 = (n) => Math.round(n * 100) / 100;

async function yahoo(symbol) {
  const p1 = Math.floor(new Date(START + 'T00:00:00Z').getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) +
    '?period1=' + p1 + '&period2=' + p2 + '&interval=1d';
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(symbol + ' -> ' + res.status);
  const j = await res.json();
  const r = j.chart.result[0];
  const closes = r.indicators.quote[0].close;
  const map = new Map();
  r.timestamp.forEach((t, i) => {
    if (closes[i] > 0) map.set(new Date(t * 1000).toISOString().slice(0, 10), closes[i]);
  });
  return map;
}

async function main() {
  const db = JSON.parse(await readFile(FILE, 'utf8'));

  let gold, used;
  for (const sym of ['XAUUSD=X', 'GC=F']) {
    try {
      gold = await yahoo(sym);
      if (gold.size > 50) { used = sym; break; }
    } catch (e) {
      console.warn('failed', sym, e.message);
    }
  }
  if (!gold || !used) throw new Error('no gold history found');
  const fx = await yahoo('EGP=X');

  const have = new Set(db.history.map((p) => String(p.t).slice(0, 10)));
  const added = [];
  let lastFx = null;

  for (const day of [...gold.keys()].sort()) {
    if (fx.has(day)) lastFx = fx.get(day);
    const ounce = gold.get(day);
    if (!lastFx || have.has(day)) continue;
    if (!(ounce > 500 && ounce < 20000) || !(lastFx > 5 && lastFx < 500)) continue;
    const g24 = (ounce * lastFx) / GRAMS_PER_OUNCE;
    added.push({
      t: day + 'T12:00:00.000Z',
      g24: r2(g24),
      g21: r2((g24 * 21) / 24),
      g18: r2((g24 * 18) / 24),
      pound: r2(((g24 * 21) / 24) * 8)
    });
  }

  db.history = [...db.history, ...added].sort((a, b) => new Date(a.t) - new Date(b.t));
  await writeFile(FILE, JSON.stringify(db));
  console.log('source:', used, '| added:', added.length, '| total:', db.history.length);
  if (added.length) console.log('first:', added[0].t, '| last:', added[added.length - 1].t);
}

main().catch((e) => { console.error(e); process.exit(1); });
