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
  const W = 600, H = 260, P = 46;
  const v = pts.map((p) => p[key]);
  const mn = Math.min(...v), mx = Math.max(...v), sp = mx - mn || 1;
  const x = (i) => P + (i * (W - P - 10)) / (pts.length - 1);
  const y = (n) => H - 28 - ((n - mn) / sp) * (H - 60);
  const path = 'M' + pts.map((p, i) => x(i).toFixed(1) + ',' + y(p[key]).toFixed(1)).join('L');
  const up = v[v.length - 1] >= v[0];
  const col = up ? '#18853b' : '#c62828';
  const fd = (p) => new Date(p.t).toLocaleDateString('ar-EG-u-nu-latn', { timeZone: TZ, day: 'numeric', month: 'short' });
  box.innerHTML =
    "<svg viewBox='0 0 " + W + ' ' + H + "' role='img' aria-label='رسم بياني لسعر الذهب'>" +
    "<path d='" + path + ' L' + x(pts.length - 1).toFixed(1) + ',' + (H - 28) + ' L' + P + ',' + (H - 28) + " Z' fill='" + col + "' opacity='.12'/>" +
    "<path d='" + path + "' fill='none' stroke='" + col + "' stroke-width='2.5' stroke-linejoin='round'/>" +
    "<g fill='currentColor' font-size='12' opacity='.75'>" +
    "<text x='4' y='" + (y(mx) + 4) + "'>" + f(mx) + '</text>' +
    "<text x='4' y='" + (y(mn) + 4) + "'>" + f(mn) + '</text>' +
    "<text x='" + P + "' y='" + (H - 6) + "'>" + fd(pts[0]) + '</text>' +
    "<text x='" + (W - 10) + "' y='" + (H - 6) + "' text-anchor='end'>" + fd(pts[pts.length - 1]) + '</text></g></svg>';
}

document.querySelectorAll('[data-r]').forEach((b) =>
  b.addEventListener('click', () => {
    range = +b.dataset.r;
    document.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', x === b));
    if (db) chart();
  })
);
$('#k').addEventListener('change', (e) => {
  key = e.target.value;
  if (db) chart();
});

load();
setInterval(load, 600000);
