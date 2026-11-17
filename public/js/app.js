const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SPECIES = { dog: '🐶 สุนัข', cat: '🐱 แมว', rabbit: '🐰 กระต่าย', bird: '🐦 นก', other: '🐾 อื่น ๆ' };
const GENDER = { male: 'ผู้', female: 'เมีย', unknown: 'ไม่ระบุเพศ' };
const PET_ST = { pending: 'รอแอดมินอนุมัติ', available: 'พร้อมหาบ้าน', adopted: 'ได้บ้านแล้ว', hidden: 'ถูกซ่อน' };
const REQ_ST = { pending: 'รอพิจารณา', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ' };
const HOURS = { lt4: 'น้อยกว่า 4 ชม.', '4to8': '4–8 ชม.', gt8: 'มากกว่า 8 ชม.' };
let ME = null;

async function api(url, opt = {}) {
  const o = { credentials: 'same-origin', ...opt };
  if (opt.body && !(opt.body instanceof FormData)) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(opt.body); }
  const r = await fetch(url, o);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'เกิดข้อผิดพลาด');
  return d;
}
function toast(msg, err) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
function ageText(m) { m = +m; if (m < 12) return m + ' เดือน'; const y = Math.floor(m / 12), r = m % 12; return y + ' ปี' + (r ? ' ' + r + ' เดือน' : ''); }
function petCard(p) {
  return `<a class="card pet" href="/pet.html?id=${p.id}"><img src="${esc(p.image_url || '/img/placeholder.svg')}" alt="${esc(p.name)}">
  <div class="body"><h3>${esc(p.name)}</h3><p class="muted">${SPECIES[p.species] || ''} · ${esc(p.breed || 'ไม่ระบุสายพันธุ์')}</p>
  <p class="muted">${ageText(p.age_months)} · 📍${esc(p.province)}</p></div></a>`;
}
async function initPage(opts = {}) {
  try { ME = (await api('/api/auth/me')).user; } catch { ME = null; }
  const here = location.pathname;
  const link = (h, t) => `<a class="l ${here === h ? 'on' : ''}" href="${h}">${t}</a>`;
  document.body.insertAdjacentHTML('afterbegin', `<header class="nav"><div class="wrap">
    <a class="logo" href="/">🐾 บ้านใหม่ให้น้อง</a>
    ${link('/pets.html', 'ค้นหาสัตว์')}
    ${ME ? link('/add-pet.html', 'ลงทะเบียนสัตว์') + link('/dashboard.html', 'แดชบอร์ด') : ''}
    ${ME && ME.role === 'admin' ? link('/admin.html', 'ผู้ดูแลระบบ') : ''}
    ${ME ? `<span>สวัสดี ${esc(ME.name)}</span><button class="btn sm ghost" id="logout">ออกจากระบบ</button>`
         : `<a class="btn sm ghost" href="/login.html">เข้าสู่ระบบ</a><a class="btn sm teal" href="/register.html">สมัครสมาชิก</a>`}
  </div></header>`);
  document.body.insertAdjacentHTML('beforeend', '<footer>🐾 ช่วยกันหาบ้านให้น้องๆ ที่ไม่มีบ้าน</footer>');
  const lo = $('#logout'); if (lo) lo.onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };
  if ((opts.auth || opts.admin) && !ME) { location.href = '/login.html?next=' + encodeURIComponent(here + location.search); return false; }
  if (opts.admin && ME.role !== 'admin') { location.href = '/'; return false; }
  return true;
}
