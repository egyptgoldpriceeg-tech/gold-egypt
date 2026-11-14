const $ = (s) => document.querySelector(s);
const K = ['g24', 'g21', 'g18', 'pound'];
const f = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const TZ = 'Africa/Cairo';
let db = null, range = 30, key = 'g21';

async function load() {
  try {
    const r = await fetch('/data/prices.json?t=' + Date.now());
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!j || !j.current) throw new Error('empty');
    db = j;
    render();
  } catch (e) {
    if (!db && $('#upd').textContent.trim() === 'جاري التحميل...') {
      $('#upd').textContent = 'الأسعار هتظهر بعد أول تحديث، ارجع بعد قليل';
    }
  }
}

function ago(h) {
  const t = Date.now() - h * 3600000;
  let b = null;
  for (const p of db.history) if (new Date(p.t) <= t) b = p;
  return b;
}

function render() {
  const c = db.current, d = new Date(c.time);
  $('#upd').textContent = 'آخر تحديث: ' + d.toLocaleString('ar-EG-u-nu-latn', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' });
  const old = Date.now() - d.getTime() > 30 * 3600000;
  const st = $('#stale');
  if (st) st.hidden = !old;
  const o = ago(24);
  K.forEach((k) => {
    const el = $('#' + k);
    el.querySelector('b').textContent = f(c[k]);
    const s = el.querySelector('i');
    if (o && o[k]) {
      const p = ((c[k] - o[k]) / o[k]) * 100;
      s.textContent = (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p).toFixed(2) + '%';
      s.className = p >= 0 ? 'up' : 'dn';
    } else s.textContent = '';
  });
  $('#oz').textContent = f(c.ounceUsd);
  $('#fx').textContent = c.usdEgp.toFixed(2);
  chart();
}

function chart() {
  const box = $('#chart');
  const pts = db.history.filter((p) => new Date(p.t) >= Date.now() - range * 864e5);
  if (pts.length < 2) {
    box.textContent = 'الرسم البياني هيظهر بعد ما تتجمع بيانات كفاية، ارجع بعد كام ساعة.';
    return;
  }
  const W = 600, H = 260, P = 60, B = 30, T = 16;
  const v = pts.map((p) => p[key]);
  const mn = Math.min(...v), mx = Math.max(...v), sp = mx - mn || 1;
  const x = (i) => P + (i * (W - P - 16)) / (pts.length - 1);
  const y = (n) => H - B - ((n - mn) / sp) * (H - B - T);
  const path = 'M' + pts.map((p, i) => x(i).toFixed(1) + ',' + y(p[key]).toFixed(1)).join('L');
  const gold = '#c9971c';
  const muted = '#6e6e73';
  const fd = (p) => new Date(p.t).toLocaleDateString('ar-EG-u-nu-latn', { timeZone: TZ, day: 'numeric', month: 'short' });
  const last = pts[pts.length - 1];
  const grid = [0, 0.5, 1].map((t) => {
    const val = mn + sp * t, yy = y(val).toFixed(1);
    return "<line x1='" + P + "' x2='" + (W - 16) + "' y1='" + yy + "' y2='" + yy + "' stroke='#e3e3e0' stroke-width='1'/>" +
      "<text x='" + (P - 8) + "' y='" + (+yy + 4) + "' text-anchor='end'>" + f(val) + '</text>';
  }).join('');
  box.innerHTML =
    "<svg viewBox='0 0 " + W + ' ' + H + "' role='img' aria-label='رسم بياني لسعر الذهب'>" +
    "<defs><linearGradient id='gfill' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0%' stop-color='" + gold + "' stop-opacity='.32'/>" +
    "<stop offset='100%' stop-color='" + gold + "' stop-opacity='0'/></linearGradient></defs>" +
    "<g fill='" + muted + "' font-size='12' font-family='Cairo,Tahoma,sans-serif'>" + grid + '</g>' +
    "<path d='" + path + ' L' + x(pts.length - 1).toFixed(1) + ',' + (H - B) + ' L' + P + ',' + (H - B) + " Z' fill='url(#gfill)'/>" +
    "<path d='" + path + "' fill='none' stroke='" + gold + "' stroke-width='3' stroke-linejoin='round' stroke-linecap='round'/>" +
    "<circle cx='" + x(pts.length - 1).toFixed(1) + "' cy='" + y(last[key]).toFixed(1) + "' r='5' fill='" + gold + "' stroke='#fff' stroke-width='2.5'/>" +
    "<g fill='" + muted + "' font-size='12' font-family='Cairo,Tahoma,sans-serif'>" +
    "<text x='" + P + "' y='" + (H - 8) + "'>" + fd(pts[0]) + '</text>' +
    "<text x='" + (W - 16) + "' y='" + (H - 8) + "' text-anchor='end'>" + fd(last) + '</text></g></svg>';
}

const sel = document.querySelector('select');
const btns = [...document.querySelectorAll('[data-r]')];
const cur = btns.find((b) => +b.dataset.r === range);
const other = btns.find((b) => b !== cur);
const onCls = cur ? cur.className : '';
const offCls = other ? other.className : '';
if (sel && K.includes(sel.value)) key = sel.value;
btns.forEach((b) => {
  b.addEventListener('click', () => {
    range = +b.dataset.r;
    btns.forEach((x) => { x.className = x === b ? onCls : offCls; });
    if (db) chart();
  });
});
if (sel) sel.addEventListener('change', () => { key = sel.value; if (db) chart(); });
load();
setInterval(load, 600000);
