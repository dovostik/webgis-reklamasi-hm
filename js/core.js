// Inti: state, pemuatan data, antrean offline, GPS, scanner QR, foto, util UI.
import { SB } from './sb.js';
import { makeLogic, esc, setSim } from './logic.js';
import { kvGet, kvSet, blobGet, blobSet, blobDel, SAT_URL, ORTHO, orthoUrl, SLOTS } from './offline.js';

export const S = { me: null, ready: false };
export let L = null;
const TABLES = ['setting', 'profiles', 'jenis', 'blok', 'periode', 'sesi', 'tag', 'tag_event', 'bedengan', 'nursery_fitur', 'lot', 'lot_log', 'minta', 'kirim', 'tampung_log', 'barang', 'barang_tx', 'alat', 'pinjam', 'ba', 'beli', 'beli_log', 'kembali', 'kembali_log', 'kirim_mat'];
const PK = { jenis: 'kode', bedengan: 'kode', barang: 'nama', setting: 'k' };
const pkOf = t => PK[t] || 'id';

// data dimuat dari server; tanpa sinyal memakai salinan terakhir di HP, lalu antrean lokal diterapkan di atasnya
export async function loadAll() {
  let res = null;
  try {
    res = await Promise.all(TABLES.map(t => SB.select(t, t === 'barang_tx' ? { order: 'at.desc', limit: 300 } : t === 'lot_log' ? { order: 'at.desc', limit: 500 } : {}).catch(e => { if (e.status === 404) return []; throw e; })));
    TABLES.forEach((t, i) => { S[t] = res[i] || []; });
    S.offline = false; S.snapAt = new Date().toISOString();
    saveSnap();
  } catch (e) {
    if (!e.net) throw e;
    const snap = await kvGet(snapKey());
    if (!snap) throw e;
    TABLES.forEach(t => { S[t] = snap.data[t] || []; });
    S.offline = true; S.snapAt = snap.at; netState(false);
  }
  replayOutbox();
  derive();
  S.ready = true;
}
const snapKey = () => 'snap:' + (SB.user()?.id || 'anon');
let snapT = null;
function saveSnap() { clearTimeout(snapT); snapT = setTimeout(() => { const data = {}; TABLES.forEach(t => { data[t] = (S[t] || []).filter(r => !r._pending); }); kvSet(snapKey(), { at: S.snapAt || new Date().toISOString(), data }); }, 300); }
function replayOutbox() {
  for (const o of outbox) {
    if (o.op === 'insert') applyLocal('insert', o.t, o.rows.map(r => ({ ...r, _pending: true, at: r.at || o.at, created_at: r.created_at || o.at })), null, null, true);
    else if (o.op === 'update') applyLocal('update', o.t, null, o.match, o.patch, true);
  }
}
export function derive() {
  setSim((S.setting || []).find(x => x.k === 'sim_days')?.v || 0);
  S.jenisMap = Object.fromEntries(S.jenis.map(j => [j.kode, j]));
  S.jenisAktif = S.jenis.filter(j => j.aktif !== false);
  S.blokMap = Object.fromEntries(S.blok.map(b => [b.id, b]));
  S.bedMap = Object.fromEntries(S.bedengan.map(b => [b.kode, b]));
  S.profMap = Object.fromEntries(S.profiles.map(p => [p.id, p]));
  const u = SB.user(); S.me = u ? S.profMap[u.id] || null : null;
  L = makeLogic(S);
}

// ---------- antrean offline ----------
const OB = 'hm-outbox';
let outbox = []; try { outbox = JSON.parse(localStorage.getItem(OB) || '[]'); } catch (e) { outbox = []; }
const saveOB = () => { try { localStorage.setItem(OB, JSON.stringify(outbox)); } catch (e) {} };
export const pending = () => outbox.length;
// foto: unggah sekarang, atau simpan di HP dan unggah otomatis saat ada sinyal
export async function uploadOrQueue(bucket, path, blob) {
  try { await SB.upload(bucket, path, blob); return 'sent'; }
  catch (e) {
    if (!e.net) throw e;
    const key = bucket + '/' + path; await blobSet(key, blob);
    outbox.push({ op: 'upload', bucket, path, key }); saveOB(); netState(false); return 'queued';
  }
}
export async function fileUrl(bucket, path) {
  const b = await blobGet(bucket + '/' + path); if (b) return URL.createObjectURL(b);
  return SB.signedUrl(bucket, path);
}
function applyLocal(op, t, rows, match, patch, quiet) {
  S[t] = S[t] || [];
  if (op === 'insert') [].concat(rows).forEach(r => { const k = pkOf(t); const i = S[t].findIndex(x => x[k] === r[k]); if (i >= 0) S[t][i] = { ...S[t][i], ...r }; else S[t].push(r); });
  else S[t].forEach((r, i) => { if (Object.entries(match).every(([k, v]) => String(r[k]) === String(v))) S[t][i] = { ...r, ...(rows && rows.find(x => x[pkOf(t)] === r[pkOf(t)]) || patch) }; });
  if (!quiet) { derive(); saveSnap(); }
}
export async function ins(t, rows, opts = {}) {
  rows = [].concat(rows).map(r => ({ ...r }));
  try { const out = await SB.insert(t, rows); applyLocal('insert', t, out); return out; }
  catch (e) {
    if (e.net && opts.offline !== false) { outbox.push({ op: 'insert', t, rows, at: new Date().toISOString() }); saveOB(); applyLocal('insert', t, rows.map(r => ({ ...r, _pending: true, at: r.at || new Date().toISOString(), created_at: r.created_at || new Date().toISOString() }))); netState(false); toast('Tersimpan di HP. Dikirim otomatis saat ada sinyal.'); return rows; }
    throw e;
  }
}
export async function upd(t, match, patch, opts = {}) {
  try { const out = await SB.update(t, match, patch); applyLocal('update', t, out, match, patch); return out; }
  catch (e) {
    if (e.net && opts.offline !== false) { outbox.push({ op: 'update', t, match, patch }); saveOB(); applyLocal('update', t, null, match, patch); netState(false); toast('Tersimpan di HP. Dikirim otomatis saat ada sinyal.'); return []; }
    throw e;
  }
}
let flushing = false;
export async function flush() {
  if (flushing || !outbox.length) return; flushing = true;
  try {
    while (outbox.length) {
      const o = outbox[0];
      try {
        if (o.op === 'upload') { const b = await blobGet(o.key); if (b) await SB.upload(o.bucket, o.path, b); await blobDel(o.key); }
        else if (o.op === 'insert') await SB.insert(o.t, o.rows.map(r => { const x = { ...r }; delete x._pending; return x; }));
        else await SB.update(o.t, o.match, o.patch);
        outbox.shift(); saveOB();
      }
      catch (e) { if (e.net) { netState(false); break; } if (e.status === 409) { outbox.shift(); saveOB(); continue; } console.warn('outbox drop', o, e); outbox.shift(); saveOB(); toast('Satu data gagal disimpan: ' + e.message); }
    }
    if (!outbox.length) { netState(true); await loadAll(); window.dispatchEvent(new Event('hm:data')); }
  } finally { flushing = false; }
}
let online = navigator.onLine;
export const isOnline = () => online && navigator.onLine;
export function netState(v) { online = v; const el = document.getElementById('net'); if (el) { el.className = 'net' + (v ? '' : ' off'); el.textContent = v ? (outbox.length ? `${outbox.length} antre` : 'Online') : `Offline${outbox.length ? ' · ' + outbox.length + ' antre' : ''}`; } }
window.addEventListener('online', () => { netState(true); flush(); });
window.addEventListener('offline', () => netState(false));
setInterval(() => { if (outbox.length) flush(); }, 30000);

// ---------- util UI ----------
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export function toast(m, ms = 2800) { document.querySelectorAll('.toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
export function sheet(html, onBind) {
  const w = document.createElement('div'); w.className = 'sheet'; w.innerHTML = `<div class="box" role="dialog">${html}</div>`;
  document.body.appendChild(w);
  const close = () => w.remove();
  w.addEventListener('click', e => { if (e.target === w) close(); });
  w.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  onBind && onBind(w.firstElementChild, close);
  return close;
}
export function confirmSheet(msg, okLbl = 'Ya, lanjutkan', danger = false) {
  return new Promise(res => sheet(`<div class="stack"><p style="margin:0">${msg}</p><div class="grid2"><button class="btn ghost" data-close>Batal</button><button class="btn ${danger ? 'bad' : ''}" id="cfOk">${esc(okLbl)}</button></div></div>`, (box, close) => {
    box.querySelector('[data-close]').addEventListener('click', () => res(false));
    box.querySelector('#cfOk').addEventListener('click', () => { close(); res(true); });
  }));
}
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
export const nm = id => S.profMap[id]?.nama || '–';

// ---------- GPS ----------
export const GPS = {
  pos: null, err: null, watch: null, subs: new Set(),
  start() {
    if (this.watch != null || !navigator.geolocation) { if (!navigator.geolocation) this.err = 'HP tidak mendukung GPS'; return; }
    this.watch = navigator.geolocation.watchPosition(p => {
      this.pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }; this.err = null;
      this.subs.forEach(f => { try { f(this.pos); } catch (e) {} });
    }, e => { this.err = e.code === 1 ? 'Izin lokasi ditolak. Aktifkan lokasi untuk browser ini.' : 'GPS belum mendapat sinyal'; this.subs.forEach(f => { try { f(null); } catch (x) {} }); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  },
  sub(f) { this.subs.add(f); this.start(); if (this.pos) setTimeout(() => { if (this.subs.has(f)) f(this.pos); }, 0); return () => this.subs.delete(f); },
  // minta posisi baru (HP diam kadang jarang mengirim update watchPosition)
  fresh() { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(p => { this.pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }; this.subs.forEach(f => { try { f(this.pos); } catch (e) {} }); }, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }); },
};
export function dist(a, b) { const R = 6371000, r = Math.PI / 180; const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }

// menunggu GPS akurat (≤ maxAcc m); pengguna bisa memilih simpan dengan akurasi rendah
export function waitGPS(maxAcc = 6, title = 'Mengunci posisi GPS') {
  return new Promise(res => {
    let unsub = null, t0 = Date.now();
    const close = sheet(`<div class="stack"><h2>${esc(title)}</h2><div class="row between"><span class="gps" id="gAcc">± – m</span><span class="small muted" id="gMsg">menunggu sinyal…</span></div><div class="alert" id="gTip">Berdiri di tempat terbuka sebentar. Titik tersimpan otomatis begitu akurasi ≤ ${maxAcc} m.</div><div class="grid2"><button class="btn ghost" id="gCancel">Batal</button><button class="btn warn" id="gLow" hidden>Simpan dengan catatan</button></div></div>`, (box, cl) => {
      box.querySelector('#gCancel').addEventListener('click', () => { unsub && unsub(); cl(); res(null); });
      box.querySelector('#gLow').addEventListener('click', () => { unsub && unsub(); cl(); res({ ...GPS.pos, low: true }); });
      GPS.fresh();
      unsub = GPS.sub(p => {
        if (!p) { box.querySelector('#gMsg').textContent = GPS.err || 'menunggu sinyal…'; return; }
        box.querySelector('#gAcc').textContent = '± ' + p.acc.toFixed(1) + ' m';
        box.querySelector('#gAcc').style.color = p.acc <= maxAcc ? 'var(--ok)' : 'var(--warn)';
        if (p.acc <= maxAcc && Date.now() - p.t < 30000) { unsub && unsub(); cl(); res({ ...p, low: false }); return; }
        box.querySelector('#gMsg').textContent = 'perlu ≤ ' + maxAcc + ' m';
        if (Date.now() - t0 > 20000) { box.querySelector('#gLow').hidden = false; box.querySelector('#gTip').textContent = 'Akurasi belum tercapai. Tunggu lagi, atau simpan dengan catatan "akurasi rendah, sulit ditemukan" supaya tim berikutnya tahu.'; box.querySelector('#gTip').className = 'alert warn'; }
      });
      setTimeout(() => { const b = box.querySelector('#gLow'); if (b && GPS.pos) b.hidden = false; }, 20000);
    });
  });
}

// ---------- scanner QR ----------
export function scanQR(title = 'Arahkan kamera ke QR tag') {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'scanner';
    w.innerHTML = `<video playsinline muted></video><div class="frame"></div><div class="bar"><b>${esc(title)}</b><span class="small" id="qMsg">Membuka kamera…</span><div class="row" style="flex-wrap:nowrap"><input id="qManual" placeholder="atau ketik nomor tag, mis. HM-T-000123" style="background:#222;color:#fff;border-color:#444"><button class="btn sm" id="qOk">OK</button></div><button class="btn ghost" id="qCancel" style="color:#fff;border-color:#555">Batal</button></div>`;
    document.body.appendChild(w);
    const video = w.querySelector('video'); let stream = null, stop = false;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const done = v => { stop = true; if (stream) stream.getTracks().forEach(t => t.stop()); w.remove(); res(v); };
    w.querySelector('#qCancel').addEventListener('click', () => done(null));
    w.querySelector('#qOk').addEventListener('click', () => { const v = w.querySelector('#qManual').value.trim().toUpperCase(); if (v) done(normTag(v)); });
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }).then(s => {
      stream = s; video.srcObject = s; video.play(); w.querySelector('#qMsg').textContent = 'Kamera aktif. Dekatkan QR ke dalam kotak.';
      const tick = () => {
        if (stop) return;
        if (video.readyState >= 2) {
          const vw = video.videoWidth, vh = video.videoHeight, sz = Math.min(vw, vh) * 0.7;
          canvas.width = 480; canvas.height = 480;
          ctx.drawImage(video, (vw - sz) / 2, (vh - sz) / 2, sz, sz, 0, 0, 480, 480);
          const img = ctx.getImageData(0, 0, 480, 480);
          const code = window.jsQR && window.jsQR(img.data, 480, 480, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) { if (navigator.vibrate) navigator.vibrate(80); return done(normTag(code.data.trim())); }
        }
        requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => { w.querySelector('#qMsg').textContent = 'Kamera tidak bisa dibuka. Izinkan kamera, atau ketik nomor tag.'; });
  });
}
export function normTag(v) { const m = /(\d{1,6})\s*$/.exec(v); if (/^HM-T-\d{6}$/.test(v)) return v; if (m && /HM|T|^\d+$/.test(v)) return 'HM-T-' + m[1].padStart(6, '0'); return v; }

// ---------- foto ----------
export function pickPhoto() {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment';
    i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return res(null); res(await compress(f)); };
    i.click();
  });
}
// foto dari galeri (boleh foto lama) beserta lokasi & waktu ambil dari EXIF
export function pickPhotoGeo() {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/*';
    i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return res(null); const { readExif } = await import('./exif.js'); const exif = await readExif(f); res({ blob: await compress(f), exif }); };
    i.click();
  });
}
export async function compress(file, max = 1600, q = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
export function pickFile(accept = 'image/*,application/pdf') {
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files && i.files[0] || null); i.click(); });
}

// ---------- peta ----------
export const SAT = () => L_tiles();
function L_tiles() {
  const sat = window.L.tileLayer(SAT_URL, { maxNativeZoom: 18, maxZoom: 22, crossOrigin: true, attribution: 'Citra © Esri, Maxar' });
  const osm = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 22, attribution: '© OpenStreetMap' });
  return { sat, osm };
}
export function newMap(el, opts = {}) {
  const map = window.L.map(el, { zoomControl: true, attributionControl: true, preferCanvas: false, ...opts });
  const t = L_tiles(); t.sat.addTo(map);
  const base = { 'Citra satelit': t.sat, 'Peta jalan': t.osm };
  map._lc = window.L.control.layers(base, null, { position: 'topright' }).addTo(map);
  // urutan tampilan: citra online < ortho utama < ortho mingguan (terbaru paling atas); centang untuk menyembunyikan
  let hide = {}; try { hide = JSON.parse(localStorage.getItem('hm-ortho-hide') || '{}'); } catch (e) {}
  SLOTS.forEach(([k, lbl], i) => {
    const o = ORTHO[k]; if (!o) return;
    const [w, so, e, n] = o.bounds;
    const lay = window.L.tileLayer(orthoUrl(k), { maxNativeZoom: o.maxzoom, minNativeZoom: o.minzoom, maxZoom: 22, bounds: [[so, w], [n, e]], zIndex: 10 + i, attribution: `${lbl} ${o.tanggal || ''}` });
    if (!hide[k]) lay.addTo(map);
    map._lc.addOverlay(lay, `${lbl} ${o.tanggal || ''}`);
    lay.on('add', () => { hide[k] = false; try { localStorage.setItem('hm-ortho-hide', JSON.stringify(hide)); } catch (x) {} });
    lay.on('remove', () => { hide[k] = true; try { localStorage.setItem('hm-ortho-hide', JSON.stringify(hide)); } catch (x) {} });
  });
  return map;
}
export function locateControl(map) {
  let mk = null, circ = null;
  const unsub = GPS.sub(p => {
    if (!p) return; const ll = [p.lat, p.lon];
    if (!mk) { mk = window.L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#2a7de1', fillOpacity: 1 }).addTo(map); circ = window.L.circle(ll, { radius: p.acc, color: '#2a7de1', weight: 1, fillOpacity: .1 }).addTo(map); }
    else { mk.setLatLng(ll); circ.setLatLng(ll).setRadius(p.acc); }
  });
  const Btn = window.L.Control.extend({ onAdd() { const b = window.L.DomUtil.create('button', ''); b.type = 'button'; b.title = 'Posisi saya'; b.innerHTML = '◎'; b.style.cssText = 'width:34px;height:34px;font-size:18px;border-radius:6px;border:2px solid rgba(0,0,0,.2);background:#fff;color:#111'; b.onclick = e => { e.stopPropagation(); if (GPS.pos) map.setView([GPS.pos.lat, GPS.pos.lon], Math.max(map.getZoom(), 18)); else toast('Menunggu GPS…'); }; return b; } });
  new Btn({ position: 'topleft' }).addTo(map);
  map.on('unload', unsub);
  return unsub;
}
