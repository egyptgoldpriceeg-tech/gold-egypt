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
