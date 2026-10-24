// Klien Supabase minimal (Auth, PostgREST, Storage) tanpa library luar.
// Juga menyediakan mode demo (mock) di memori untuk pengujian.
import { CONFIG } from '../config.js';

const SKEY = 'hm-sb-session';
let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { session = null; }
const saveSession = s => { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} };

export class NetError extends Error { constructor(m) { super(m); this.net = true; } }
export class ApiError extends Error { constructor(m, status, body) { super(m); this.status = status; this.body = body; } }

function base() { return CONFIG.SUPABASE_URL.replace(/\/$/, ''); }
function hdr(extra = {}) {
  const h = { apikey: CONFIG.SUPABASE_ANON_KEY, ...extra };
  // kunci publishable (sb_publishable_...) hanya boleh di header apikey; Authorization hanya untuk JWT
  const k = CONFIG.SUPABASE_ANON_KEY;
  if (session?.access_token) h.Authorization = 'Bearer ' + session.access_token;
  else if (/^eyJ/.test(k)) h.Authorization = 'Bearer ' + k;
  return h;
}
async function req(path, opts = {}, retry = true) {
  let r;
  try { r = await fetch(base() + path, opts); }
  catch (e) { throw new NetError('Tidak ada koneksi'); }
  if (r.status === 401 && retry && session?.refresh_token) {
    const ok = await refresh();
    if (ok) { opts.headers = { ...opts.headers, Authorization: 'Bearer ' + session.access_token }; return req(path, opts, false); }
  }
  const txt = await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = txt; }
  if (!r.ok) throw new ApiError((body && (body.message || body.msg || body.error_description || body.error)) || ('HTTP ' + r.status), r.status, body);
  return body;
}
async function refresh() {
  try {
    const s = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) }, false);
    saveSession(s); return true;
  } catch (e) { if (!e.net) saveSession(null); return false; }
}
const enc = v => encodeURIComponent(v);
function qs(q = {}) {
  const p = [];
  for (const [k, v] of Object.entries(q)) {
    if (k === 'select' || k === 'order' || k === 'limit') p.push(k + '=' + enc(v));
    else if (Array.isArray(v)) p.push(k + '=in.(' + v.map(x => '"' + String(x).replace(/"/g, '\\"') + '"').join(',') + ')');
    else if (v === null) p.push(k + '=is.null');
    else p.push(k + '=eq.' + enc(v));
  }
  return p.length ? '?' + p.join('&') : '';
}

const real = {
  mode: 'live',
  async debug() {
    const t = session?.access_token; let claim = {};
    try { claim = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) {}
    const out = [`token ${t ? 'ada' : 'TIDAK ADA'}`, `role jwt ${claim.role || '-'}`, `alg ${(() => { try { return JSON.parse(atob(t.split('.')[0])).alg; } catch (e) { return '-'; } })()}`];
    try { const r = await fetch(base() + '/rest/v1/rpc/my_role', { method: 'POST', headers: hdr({ 'Content-Type': 'application/json' }), body: '{}' }); out.push('my_role ' + r.status + ' ' + (await r.text()).slice(0, 80)); } catch (e) { out.push('my_role gagal ' + e.message); }
    try { const r = await fetch(base() + '/rest/v1/profiles?select=id', { headers: hdr() }); out.push('profiles ' + r.status + ' ' + (await r.text()).slice(0, 60)); } catch (e) { out.push('profiles gagal'); }
    return out.join(' · ');
  },
  user() { return session?.user || null; },
  async login(email, password) {
    const s = await req('/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }, false);
    saveSession(s); return s.user;
  },
  async logout() { try { await req('/auth/v1/logout', { method: 'POST', headers: hdr() }, false); } catch (e) {} saveSession(null); },
  async ensure() { if (!session) return null; if (session.expires_at && session.expires_at * 1000 < Date.now() + 60000) await refresh(); return session?.user || null; },
  select(table, q = {}) { return req('/rest/v1/' + table + qs({ select: '*', ...q }), { headers: hdr() }); },
  insert(table, rows) { return req('/rest/v1/' + table, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(rows) }); },
  update(table, match, patch) { return req('/rest/v1/' + table + qs(match), { method: 'PATCH', headers: hdr({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(patch) }); },
  rpc(fn, args) { return req('/rest/v1/rpc/' + fn, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify(args || {}) }); },
  async upload(bucket, path, blob) {
    await req('/storage/v1/object/' + bucket + '/' + path, { method: 'POST', headers: hdr({ 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' }), body: blob });
    return path;
  },
  async signedUrl(bucket, path, sec = 3600) {
    const r = await req('/storage/v1/object/sign/' + bucket + '/' + path, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: sec }) });
    const u = r.signedURL || r.signedUrl; return u.startsWith('http') ? u : base() + '/storage/v1' + u;
  },
  remove(bucket, paths) { return req('/storage/v1/object/' + bucket, { method: 'DELETE', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: paths }) }); },
};

// ---------- mode demo: semua data di memori HP, untuk pengujian ----------
function makeMock() {
  const MK = 'hm-demo-db';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(MK) || 'null'); } catch (e) { db = null; }
  if (!db) db = JSON.parse(JSON.stringify(window.__DEMO_SEED__ || {}));
  db.counter = db.counter || {}; db.files = db.files || {};
  const persist = () => { try { localStorage.setItem(MK, JSON.stringify(db)); } catch (e) {} };
  const now = () => new Date().toISOString();
  const tbl = t => (db[t] = db[t] || []);
  const pk = { blok: 'id', jenis: 'kode', bedengan: 'kode', barang: 'nama', tag: 'id', counter: 'name' };
  const TIME = { periode: 'created_at', sesi: 'mulai_at', tag: 'created_at', tag_event: 'at', lot: 'created_at', lot_log: 'at', minta: 'created_at', kirim: 'dikirim_at', tampung_log: 'at', barang_tx: 'at', pinjam: 'at', ba: 'created_at' };
  const DEF = { minta: { status: 'terbuka', pio: 0, sis: 0 }, kirim: { status: 'dikirim' }, tag: { status: 'mati', low_acc: false }, periode: { status: 'pelaksanaan', nomor: 1 }, sesi: { track: [], foto: [] }, ba: { data: {} } };
  let seq = 1;
  const match = (r, q) => Object.entries(q).every(([k, v]) => ['select', 'order', 'limit'].includes(k) || (Array.isArray(v) ? v.includes(r[k]) : v === null ? r[k] == null : String(r[k]) === String(v)));
  const me = () => db.__user || null;
  const stampUpd = (t, o, n) => {
    if (t === 'periode') { if (n.status !== o.status && n.status === 'siap_inspeksi') n.vendor_selesai_at = now(); if (n.status !== o.status && n.status === 'selesai') { n.approved_at = now(); n.approved_by = me()?.id; } if (n.mulai_at && n.mulai_at !== o.mulai_at) n.mulai_at = now(); }
    if (t === 'sesi' && n.selesai_at && !o.selesai_at) n.selesai_at = now();
    if (t === 'kirim' && n.status === 'diterima' && o.status !== 'diterima') { n.diterima_at = now(); n.diterima_oleh = me()?.id; }
    if (t === 'tag' && n.status === 'closed' && o.status !== 'closed') n.closed_at = now();
    if (t === 'pinjam' && n.kembali_at && !o.kembali_at) { n.kembali_at = now(); n.kembali_oleh = me()?.id; }
    if (t === 'ba') { if (n.scan_path && n.scan_path !== o.scan_path) n.scan_at = now(); if (n.confirmed_at && !o.confirmed_at) { n.confirmed_at = now(); n.confirmed_by = me()?.id; } }
  };
  return {
    mode: 'demo',
    user() { return me(); },
    async login(email) {
      const p = tbl('profiles').find(x => x.email === email.trim().toLowerCase());
      if (!p) throw new ApiError('Akun demo tidak ditemukan', 400);
      db.__user = { id: p.id, email: p.email }; persist(); return db.__user;
    },
    async logout() { db.__user = null; persist(); },
    async ensure() { return me(); },
    async select(t, q = {}) { return tbl(t).filter(r => match(r, q)).map(r => ({ ...r })); },
    async insert(t, rows) {
      const out = [];
      for (const r0 of [].concat(rows)) {
        const r = { ...(DEF[t] || {}), ...r0 };
        if (!r[pk[t] || 'id']) r[pk[t] || 'id'] = (t === 'tag_event' || t === 'lot_log' || t === 'tampung_log' || t === 'barang_tx') ? seq++ + Date.now() : crypto.randomUUID();
        if (TIME[t]) r[TIME[t]] = now();
        if (t === 'pinjam' || t === 'tag_event') r.oleh = r.oleh || me()?.id;
        tbl(t).push(r); out.push({ ...r });
      }
      persist(); return out;
    },
    async update(t, q, patch) {
      const out = [];
      tbl(t).forEach((r, i) => { if (match(r, q)) { const n = { ...r, ...patch }; stampUpd(t, r, n); db[t][i] = n; out.push({ ...n }); } });
      persist(); return out;
    },
    async rpc(fn, a) {
      if (fn === 'next_number') { db.counter[a.p_name] = (db.counter[a.p_name] || 0) + (a.p_n || 1); persist(); return db.counter[a.p_name]; }
      throw new ApiError('rpc ' + fn + ' tidak ada di demo');
    },
    async upload(b, path, blob) {
      const url = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      db.files[b + '/' + path] = url; persist(); return path;
    },
    async signedUrl(b, path) { return db.files[b + '/' + path] || ''; },
    async remove(b, paths) { paths.forEach(p => delete db.files[b + '/' + p]); persist(); return []; },
    reset() { try { localStorage.removeItem(MK); } catch (e) {} },
  };
}

export const SB = (CONFIG.SUPABASE_URL && !/demo/.test(location.search) && !window.__DEMO_SEED__) ? real : makeMock();
