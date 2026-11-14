const $ = (s) => document.querySelector(s);
const K = ['g24', 'g21', 'g18', 'pound'];
const f = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const TZ = 'Africa/Cairo';
const EN = document.documentElement.lang === 'en';
const LOC = EN ? 'en-US' : 'ar-EG-u-nu-latn';
const T = EN
  ? {
      upd: 'Last updated: ',
      loading: 'Loading...',
      wait: 'Prices will appear after the first update, please check back soon',
      nochart: 'The chart will appear once enough data has been collected. Please check back in a few hours.',
      aria: 'Gold price chart',
      egp: ' EGP'
    }
  : {
      upd: 'آخر تحديث: ',
      loading: 'جاري التحميل...',
      wait: 'الأسعار هتظهر بعد أول تحديث، ارجع بعد قليل',
      nochart: 'الرسم البياني هيظهر بعد ما تتجمع بيانات كفاية، ارجع بعد كام ساعة.',
      aria: 'رسم بياني لسعر الذهب',
      egp: ' جنيه'
    };
let db = null, range = 30, key = 'g21', view = null;

// المربعات دي بتشتغل على الكمبيوتر (ماوس) بس، مش على الموبايل
const DESK = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
if (DESK) {
  const st = document.createElement('style');
  st.textContent =
    '#chart{position:relative}' +
    '#chart.hv{cursor:crosshair}' +
    '.tt{display:none;pointer-events:none;position:absolute;inset:0;direction:ltr}' +
    '.tt .tl{position:absolute;width:0;border-left:1.5px dashed #c9971c;opacity:.75}' +
    '.tt .td{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#c9971c;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)}' +
    '.tt .tp{position:absolute;white-space:nowrap;padding:6px 14px;border-radius:10px;background:linear-gradient(135deg,#c9971c,#e8c15a);color:#2a2005;font-weight:800;font-size:.95rem;line-height:1.5;box-shadow:0 6px 16px rgba(201,151,28,.35);unicode-bidi:plaintext}' +
    '.tt .tx{position:absolute;white-space:nowrap;padding:3px 12px;border-radius:8px;background:#fff;color:#000;font-weight:700;font-size:.85rem;line-height:1.6;border:1px solid #c9971c;box-shadow:0 4px 12px rgba(0,0,0,.12);unicode-bidi:plaintext}';
  document.head.appendChild(st);
}

async function load() {
  try {
    const r = await fetch('/data/prices.json?t=' + Date.now());
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!j || !j.current) throw new Error('empty');
    db = j;
    render();
  } catch (e) {
    if (!db && $('#upd').textContent.trim() === T.loading) {
      $('#upd').textContent = T.wait;
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
  $('#upd').textContent = T.upd + d.toLocaleString(LOC, { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' });
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
    view = null;
    box.textContent = T.nochart;
    return;
  }
  const W = 600, H = 260, P = 60, B = 30, T2 = 16;
  const v = pts.map((p) => p[key]);
  const mn = Math.min(...v), mx = Math.max(...v), sp = mx - mn || 1;
  const x = (i) => P + (i * (W - P - 16)) / (pts.length - 1);
  const y = (n) => H - B - ((n - mn) / sp) * (H - B - T2);
  view = { pts, W, H, P, B, T2, x, y };
  const path = 'M' + pts.map((p, i) => x(i).toFixed(1) + ',' + y(p[key]).toFixed(1)).join('L');
  const gold = '#c9971c';
  const muted = '#6e6e73';
  const fd = (p) => new Date(p.t).toLocaleDateString(LOC, { timeZone: TZ, day: 'numeric', month: 'short' });
  const last = pts[pts.length - 1];
  const grid = [0, 0.5, 1].map((t) => {
    const val = mn + sp * t, yy = y(val).toFixed(1);
    return "<line x1='" + P + "' x2='" + (W - 16) + "' y1='" + yy + "' y2='" + yy + "' stroke='#e3e3e0' stroke-width='1'/>" +
      "<text x='" + (P - 8) + "' y='" + (+yy + 4) + "' text-anchor='end'>" + f(val) + '</text>';
  }).join('');
  box.innerHTML =
    "<svg viewBox='0 0 " + W + ' ' + H + "' role='img' aria-label='" + T.aria + "'>" +
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
  if (DESK) {
    box.insertAdjacentHTML('beforeend',
      "<div class='tt'><span class='tl'></span><span class='td'></span><span class='tp'></span><span class='tx'></span></div>");
  }
}

function hideTip() {
  const tt = document.querySelector('#chart .tt');
  if (tt) tt.style.display = 'none';
}

function hover(e) {
  const box = $('#chart');
  const tt = box.querySelector('.tt');
  const svg = box.querySelector('svg');
  if (!view || !tt || !svg) return;
  const r = svg.getBoundingClientRect();
  if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) {
    tt.style.display = 'none';
    return;
  }
  const { pts, W, H, P, B, T2, x, y } = view;
  const s = r.width / W;
  const sx = (e.clientX - r.left) / s;
  const step = (W - P - 16) / (pts.length - 1);
  let i = Math.round((sx - P) / step);
  i = Math.max(0, Math.min(pts.length - 1, i));
  const p = pts[i];
  const px = x(i) * s, py = y(p[key]) * s, baseY = (H - B) * s, topY = T2 * s;

  const line = tt.querySelector('.tl'), dot = tt.querySelector('.td');
  const tp = tt.querySelector('.tp'), tx = tt.querySelector('.tx');
  tp.textContent = f(p[key]) + T.egp;
  tx.textContent = new Date(p.t).toLocaleDateString(LOC, { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
  tt.style.display = 'block';

  line.style.left = px + 'px';
  line.style.top = topY + 'px';
  line.style.height = Math.max(0, baseY - topY) + 'px';
  dot.style.left = px + 'px';
  dot.style.top = py + 'px';

  const bw = box.clientWidth;
  let pl = px + 16;
  if (pl + tp.offsetWidth > bw) pl = px - 16 - tp.offsetWidth;
  let pt = py - tp.offsetHeight - 12;
  if (pt < 0) pt = py + 14;
  tp.style.left = Math.max(0, pl) + 'px';
  tp.style.top = pt + 'px';

  let dl = px - tx.offsetWidth / 2;
  dl = Math.max(0, Math.min(bw - tx.offsetWidth, dl));
  tx.style.left = dl + 'px';
  tx.style.top = baseY + 4 + 'px';
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

const cbox = $('#chart');
if (DESK && cbox) {
  cbox.classList.add('hv');
  cbox.addEventListener('mousemove', hover);
  cbox.addEventListener('mouseleave', hideTip);
}

load();
setInterval(load, 600000);
