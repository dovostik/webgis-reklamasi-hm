// Shell aplikasi: login, menu per peran, router, beranda, peta, detail blok, admin.
import { SB } from './sb.js';
import { S, L, loadAll, derive, ins, upd, flush, pending, netState, isOnline, $, $$, toast, sheet, confirmSheet, uid, nm, newMap, locateControl } from './core.js';
import * as G from './logic.js';
import { downloadTiles, tileList, tileInfo, tileJob, canInstall, isInstalled, promptInstall, persist, loadOrtho, ORTHO, SLOTS, orthoKey } from './offline.js';
import { tokenGet, tokenSet, checkToken, uploadOrtho, jobStatus, lastJob } from './ortho-up.js';
import { renderSesi, openScan, tagSheet, vendorNewTag } from './field.js';
import { renderNursery, renderKirim, renderTampung, renderGudang, kembaliSheet, kembaliDue } from './nursery.js';
import { renderBAList, renderBA, approvePeriode, renderCetakTag } from './ba.js';
import { renderMaster } from './master.js';
const { esc, fmt, tgl, jam } = G;

const app = document.getElementById('app');
const ICON = {
  beranda: '<path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
  peta: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  tugas: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M7 12h10"/>',
  nursery: '<path d="M12 20v-8"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M5 20h14"/>',
  kirim: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  tampung: '<rect x="3" y="8" width="18" height="12" rx="1"/><path d="M3 8l3-4h12l3 4M9 8v12M15 8v12"/>',
  gudang: '<path d="M3 9l9-5 9 5v11H3z"/><path d="M8 20v-6h8v6"/>',
  ba: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  lainnya: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
};
const LBL = { beranda: 'Beranda', peta: 'Peta', tugas: 'Tugas', scan: 'Scan tag', nursery: 'Nursery', kirim: 'Kirim bibit', tampung: 'Penampungan', gudang: 'Gudang', ba: 'BA', lainnya: 'Lainnya', admin: 'Pengguna', cetak: 'Cetak tag', akun: 'Akun saya', master: 'Master data' };
const MENU = {
  admin: ['beranda', 'tugas', 'peta', 'kirim', 'lainnya'],
  spv: ['beranda', 'tugas', 'peta', 'nursery', 'lainnya'],
  admrek: ['beranda', 'peta', 'nursery', 'ba', 'lainnya'],
  owner: ['tugas', 'peta', 'scan', 'tampung', 'lainnya'],
  nursery: ['nursery', 'kirim', 'tampung', 'gudang', 'lainnya'],
  crew: ['nursery', 'gudang', 'lainnya'],
  exdas: ['tugas', 'peta', 'scan', 'tampung', 'lainnya'],
  bumdes: ['tugas', 'peta', 'scan', 'tampung', 'lainnya'],
  viewer: ['beranda', 'peta', 'nursery', 'ba', 'lainnya'],
};
const MORE = {
  admin: ['nursery', 'tampung', 'gudang', 'ba', 'scan', 'admin', 'master', 'cetak', 'akun'],
  spv: ['kirim', 'tampung', 'gudang', 'ba', 'cetak', 'akun'],
  admrek: ['tugas', 'kirim', 'tampung', 'gudang', 'cetak', 'akun'],
  owner: ['ba', 'gudang', 'akun'],
  nursery: ['ba', 'master', 'akun'],
  crew: ['akun'],
  exdas: ['ba', 'akun'], bumdes: ['ba', 'akun'],
  viewer: ['gudang', 'akun'],
};
export const role = () => S.me?.role || 'none';
export const isRole = (...r) => r.includes(role());

// ---------- shell ----------
function shell(title, sub, body) {
  const r = role(); const cur = (location.hash.slice(1).split('/')[0]) || MENU[r]?.[0];
  const badges = countBadges();
  const tabs = (MENU[r] || []).map(k => `<a href="#${k}" class="${cur === k || (k === 'lainnya' && MORE[r]?.includes(cur)) ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>${LBL[k]}${badges[k] ? `<span class="badge">${badges[k]}</span>` : ''}</a>`).join('');
  app.className = '';
  app.innerHTML = `<header class="top"><div class="logo"><img src="img/logo.svg" alt="PT Hamparan Mulya"></div><div class="t"><b>${esc(title)}</b><span>${esc(sub || (S.me ? S.me.nama + ' · ' + G.ROLE_LBL[r] : ''))}</span></div><span class="net" id="net">Online</span></header><main id="main">${G.SIM ? `<div class="alert warn" style="margin-bottom:12px">Mode uji coba: tanggal sistem ${tgl(G.today())} (dimajukan ${G.SIM} hari).</div>` : ''}${body}</main><nav class="tabs">${tabs}</nav>`;
  netState(isOnline());
  return $('#main');
}
function countBadges() {
  const r = role(), b = {};
  if (!S.ready || !S.me) return b;
  const t = tugasList().length; if (t) b.tugas = t;
  if (['admin', 'nursery'].includes(r)) { const n = L.sulamDemand().filter(o => o.kurang > 0).length + L.tanamDemand().length; if (n) b.kirim = n; }
  if (['owner', 'exdas', 'bumdes', 'admin'].includes(r)) { const k = S.kirim.filter(x => x.status === 'dikirim' && seesBlok(S.blokMap[x.blok_id])).length; if (k) b.tampung = k; }
  if (r === 'admin') { const a = S.periode.filter(p => p.status === 'menunggu_persetujuan').length; if (a) b.tugas = (b.tugas || 0); }
  return b;
}
export function seesBlok(b) { if (!b) return false; const r = role(); if (r === 'exdas') return b.layer === 'bastl'; if (r === 'bumdes') return b.layer === 'perawatan'; return true; }

// ---------- login ----------
function renderLogin(msg = '') {
  app.className = '';
  const demo = SB.mode === 'demo';
  const demoUsers = demo ? (S.profiles || []).filter(p => p.email) : [];
  app.innerHTML = `<main style="max-width:420px;padding-top:calc(30px + env(safe-area-inset-top,0px))"><div class="stack">
    <div class="card" style="text-align:center;background:#fff"><img src="img/logo.svg" alt="PT Hamparan Mulya" style="width:230px;max-width:80%"><p class="small" style="color:#444;margin:8px 0 0">Web GIS Reklamasi &amp; Nursery</p></div>
    <form class="card stack" id="lf" novalidate><h1>Masuk</h1>
      <label class="f" for="le">Email<input id="le" type="email" autocomplete="username" inputmode="email" required></label>
      <label class="f" for="lp">Kata sandi<input id="lp" type="password" autocomplete="current-password" ${demo ? '' : 'required'}></label>
      <p class="err" id="lerr" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
      <button class="btn block" type="submit">Masuk</button>
      <p class="note">Akun dibuat oleh administrator. Lupa kata sandi? Hubungi administrator.</p></form>
    ${demo ? `<div class="card stack"><h3>Mode demo</h3><p class="note">Data hanya tersimpan di HP ini. Pilih akun:</p><div class="list">${demoUsers.map(p => `<button class="item" data-demo="${esc(p.email)}" style="text-align:left;font:inherit;width:100%"><div class="grow"><b>${esc(p.nama)}</b><span>${esc(G.ROLE_LBL[p.role])}</span></div></button>`).join('')}</div></div>` : ''}
  </div></main>`;
  $('#lf').addEventListener('submit', async e => {
    e.preventDefault(); const em = $('#le').value.trim(), pw = $('#lp').value; const er = $('#lerr');
    if (!em) { er.textContent = 'Isi email.'; er.hidden = false; return; }
    if (!pw && !demo) { er.textContent = 'Isi kata sandi.'; er.hidden = false; return; }
    try { await SB.login(em, pw); await boot(); } catch (x) { const c = x.body?.error_code || x.body?.code || ''; er.textContent = x.net ? 'Tidak ada koneksi internet.' : c === 'invalid_credentials' ? 'Email atau kata sandi salah.' : c === 'email_not_confirmed' ? 'Email belum dikonfirmasi. Admin perlu mencentang Auto Confirm User saat membuat akun.' : `Gagal masuk: ${x.message}${c ? ' (' + c + ')' : ''} [${x.status}]`; er.hidden = false; }
  });
  $$('[data-demo]').forEach(b => b.addEventListener('click', async () => { await SB.login(b.dataset.demo, ''); await boot(); }));
}

// ---------- daftar tugas per peran ----------
export function tugasList() {
  const r = role(), out = [];
  if (!S.ready) return out;
  for (const b of S.blok) {
    if (!seesBlok(b) || b.layer === 'berhasil') continue;
    const p = L.aktif(b.id);
    if (r === 'spv' && b.layer === 'bastl' && !b.nama) { out.push({ b, p: null, t: 'Beri nama blok BASTL', k: 'warn' }); continue; }
    if (r === 'admin') {
      if (b.layer === 'bastl' && !b.nama) continue;
      if (p && p.status === 'menunggu_persetujuan') out.push({ b, p, t: 'Setujui dan terbitkan BA', k: 'warn' });
    }
    if (r === 'owner' || r === 'admin') {
      if (p && ['siap_inspeksi', 'verifikasi'].includes(p.status)) { const lk = L.lockInfo(p); out.push({ b, p, t: (p.status === 'verifikasi' ? 'Verifikasi tag GL' : 'Inspeksi') + (lk ? ` · mulai ${tgl(lk.until)}` : ' · siap'), k: lk ? 'idle' : 'pend' }); }
      if (p && p.status === 'inspeksi') out.push({ b, p, t: 'Inspeksi sedang berjalan', k: 'pend' });
    }
    if (r === 'exdas' || r === 'bumdes') {
      if (b.layer === 'bastl' && !b.nama) continue;
      if (!p && b.layer === 'perawatan') { const ri = L.rotasiInfo(b); if (ri && ri.dleft <= 30) out.push({ b, p: null, t: `Rotasi perawatan jatuh tempo ${tgl(ri.next)}`, k: ri.dleft < 0 ? 'bad' : 'warn' }); continue; }
      if (!p) continue;
      if (p.status === 'pelaksanaan') out.push({ b, p, t: p.tipe === 'cek1' ? 'Penanaman berjalan' : p.tipe === 'retensi' ? 'Retensi berjalan' : 'Perawatan berjalan', k: 'pend' });
      if (p.status === 'sulam_gl') out.push({ b, p, t: `Sulam ${L.openGL(p).length} tag GL`, k: 'bad' });
    }
  }
  return out;
}

// ---------- beranda (atasan & admin) ----------
function renderBeranda() {
  const per = S.blok.filter(b => b.layer === 'perawatan'), bs = S.blok.filter(b => b.layer === 'bastl'), bh = S.blok.filter(b => b.layer === 'berhasil');
  const sum = a => a.reduce((s, b) => s + Number(b.ha), 0);
  const late = per.filter(b => { const r = L.rotasiInfo(b); return r && !r.perk && r.dleft < 0; });
  const done = S.periode.filter(p => p.status === 'selesai' && p.pct != null);
  const avg = done.length ? done.reduce((s, p) => s + Number(p.pct), 0) / done.length : null;
  const ready = L.readyStock(); const tr = Object.values(ready).reduce((a, b) => a + b, 0);
  const wait = S.periode.filter(p => p.status === 'menunggu_persetujuan');
  const el = shell('Beranda', null, `<div class="stack">
    <div class="tiles">
      <div class="tile"><span>Luas dalam perawatan</span><b>${fmt(sum(per), 2)} Ha</b><span>${per.length} blok</span></div>
      <div class="tile"><span>BASTL 2026</span><b>${fmt(sum(bs), 2)} Ha</b><span>${bs.length} petak</span></div>
      <div class="tile"><span>Rata-rata keberhasilan</span><b>${avg == null ? '–' : fmt(avg, 1) + '%'}</b><span>${done.length} BA keberhasilan</span></div>
      <div class="tile"><span>Bibit siap kirim</span><b>${fmt(tr)}</b><span>≥ 2 minggu di BST</span></div>
    </div>
    <div class="card stack"><h2>Perlu perhatian</h2>
      ${wait.map(p => `<a class="item" href="#blok/${esc(p.blok_id)}"><div class="grow"><b>${esc(G.blokName(S.blokMap[p.blok_id]))}</b><span>${G.TIPE_LBL[p.tipe]} · hasil ${fmt(p.pct, 2)}%</span></div><span class="pill s-warn">Menunggu persetujuan</span></a>`).join('')}
      ${late.map(b => `<a class="item" href="#blok/${esc(b.id)}"><div class="grow"><b>${esc(b.nama)}</b><span>Rotasi jatuh tempo ${tgl(L.rotasiInfo(b).next)}</span></div><span class="pill s-bad">Lewat jadwal</span></a>`).join('')}
      ${!wait.length && !late.length ? '<p class="muted small" style="margin:0">Tidak ada yang mendesak.</p>' : ''}
    </div>
    <p class="note">Reklamasi berhasil penilaian: ${bh.length} blok, ${fmt(sum(bh), 2)} Ha (tampilan peta saja).</p></div>`);
  void el;
}

// ---------- tugas ----------
function renderTugas() {
  const list = tugasList(); const r = role();
  const mine = S.blok.filter(b => seesBlok(b) && b.layer !== 'berhasil' && (b.layer !== 'bastl' || b.nama));
  shell('Tugas', null, `<div class="stack">
    <div class="list">${list.length ? list.map(x => `<a class="item" href="#blok/${esc(x.b.id)}"><div class="grow"><b>${esc(G.blokName(x.b))} <span class="muted small">${fmt(x.b.ha, 2)} Ha</span></b><span>${esc(x.t)}</span></div><span class="pill s-${x.k}">${x.p ? esc(G.STATUS_LBL[x.p.status]) : 'Jadwal'}</span></a>`).join('') : '<div class="card"><p class="muted" style="margin:0">Tidak ada tugas saat ini.</p></div>'}</div>
    <div class="card stack"><div class="row between"><h2>${r === 'exdas' || r === 'bumdes' ? 'Blok saya' : 'Semua blok kerja'}</h2><span class="small muted">${mine.length}</span></div>
      <input id="tq" placeholder="Cari nama blok" aria-label="Cari blok">
      <div class="list" id="tl">${mine.map(b => blokItem(b)).join('')}</div></div></div>`);
  $('#tq').addEventListener('input', e => { const q = e.target.value.toLowerCase(); $('#tl').innerHTML = mine.filter(b => G.blokName(b).toLowerCase().includes(q) || (b.kode_bastl || '').toLowerCase().includes(q)).map(blokItem).join(''); });
}
const blokItem = b => { const s = L.blokStatus(b); return `<a class="item" href="#blok/${esc(b.id)}"><div class="grow"><b>${esc(G.blokName(b))}</b><span>${fmt(b.ha, 2)} Ha · ${b.layer === 'bastl' ? esc(b.kode_bastl) : esc(b.pit || '')}</span></div><span class="pill s-${s.k}">${esc(s.t)}</span></a>`; };

// ---------- peta ----------
const COL = { ok: '#2F8A57', warn: '#D99A1B', bad: '#C8452F', pend: '#4F86C6', idle: '#B49A6A', done: '#9AA59D' };
let mapState = null;
function renderPeta() {
  const el = shell('Peta reklamasi', null, `<div class="stack"><div class="map" id="map"></div>
    <div class="legend"><span><i class="sw" style="background:${COL.ok}"></i>Terjadwal</span><span><i class="sw" style="background:${COL.warn}"></i>Segera / menunggu</span><span><i class="sw" style="background:${COL.bad}"></i>Lewat jadwal</span><span><i class="sw" style="background:${COL.pend}"></i>Dalam pekerjaan</span><span><i class="sw" style="background:${COL.idle}"></i>BASTL siap tanam</span><span><i class="sw" style="background:${COL.done}"></i>Berhasil penilaian</span><span><i class="sw" style="background:#E0473B;border-radius:50%"></i>Tag GL</span><span><i class="sw" style="background:#F2C230;border-radius:50%"></i>Tag vendor</span></div>
    <div id="pdet"></div></div>`);
  const map = newMap($('#map'));
  const groups = {};
  const vis = S.blok.filter(seesBlok);
  vis.forEach(b => {
    const s = L.blokStatus(b);
    const lay = window.L.geoJSON(b.geom, { style: { color: '#fff', weight: 1.2, fillColor: COL[s.k] || '#999', fillOpacity: b.layer === 'berhasil' ? .35 : .55 } });
    lay.on('click', () => showBlokSheet(b.id));
    lay.bindTooltip(esc(G.blokName(b)), { permanent: false, direction: 'center', className: 'lbl-blok' });
    const g = groups[b.layer] = groups[b.layer] || window.L.featureGroup(); lay.addTo(g);
  });
  const names = { berhasil: 'Reklamasi berhasil', perawatan: 'Perawatan BUMDES', bastl: 'BASTL 2026' };
  const ov = {}; Object.entries(groups).forEach(([k, g]) => { g.addTo(map); ov[names[k]] = g; });
  const tg = window.L.layerGroup();
  S.tag.filter(t => t.lat && seesBlok(S.blokMap[t.blok_id]) && t.status !== 'closed').forEach(t => window.L.circleMarker([t.lat, t.lon], { radius: 5, color: '#fff', weight: 1, fillColor: t.sumber === 'gl' ? '#E0473B' : '#F2C230', fillOpacity: 1 }).on('click', () => tagSheet(t.id)).addTo(tg));
  tg.addTo(map); ov['Tag terbuka'] = tg;
  const nur = window.L.featureGroup(); S.bedengan.forEach(b => window.L.geoJSON(b.geom, { style: { color: '#333', weight: .6, fillColor: '#A9D08E', fillOpacity: .8 } }).addTo(nur)); nur.addTo(map); ov['Nursery'] = nur;
  Object.entries(ov).forEach(([k, l]) => map._lc.addOverlay(l, k));
  const all = window.L.featureGroup(Object.values(groups));
  if (mapState) map.setView(mapState.c, mapState.z); else if (all.getLayers().length) map.fitBounds(all.getBounds(), { padding: [10, 10] });
  map.on('moveend', () => { mapState = { c: map.getCenter(), z: map.getZoom() }; });
  locateControl(map);
  void el;
}
function showBlokSheet(id) {
  const b = S.blokMap[id]; const s = L.blokStatus(b);
  sheet(`<div class="stack"><div class="row between"><div><div class="eyebrow">${b.layer === 'bastl' ? 'BASTL 2026 · ExDAS' : b.layer === 'perawatan' ? 'Perawatan · ' + esc(b.pit || '') : 'Reklamasi berhasil'}</div><h2>${esc(G.blokName(b))}</h2></div><span class="pill s-${s.k}">${esc(s.t)}</span></div>
    <dl class="kv"><dt>Luas</dt><dd>${fmt(b.ha, 2)} Ha</dd>${b.kode_bastl ? `<dt>Kode BASTL</dt><dd>${esc(b.kode_bastl)}</dd>` : ''}${b.no_bastl ? `<dt>No. BASTL</dt><dd>${esc(b.no_bastl)}</dd>` : ''}${b.layer === 'berhasil' ? `<dt>Tahun reklamasi</dt><dd>${esc(b.tahun || '')}</dd>` : ''}</dl>
    <div class="grid2"><button class="btn ghost" data-close>Tutup</button>${b.layer !== 'berhasil' ? `<a class="btn" href="#blok/${esc(b.id)}">Buka blok</a>` : '<span></span>'}</div></div>`, (box, close) => { box.querySelectorAll('a').forEach(a => a.addEventListener('click', close)); });
}

// ---------- detail blok ----------
function renderBlok(id) {
  const b = S.blokMap[id]; if (!b || !seesBlok(b)) { shell('Blok', '', '<p class="muted">Blok tidak ditemukan atau bukan bagian pekerjaan akun ini.</p>'); return; }
  const r = role(); const p = L.aktif(id); const st = L.blokStatus(b);
  const ri = L.rotasiInfo(b); const n = G.needs(b.ha); const stok = L.stokTampung(id); const dk = L.dalamKirim(id);
  const plist = L.periodes(id); const tags = L.tags(id);
  let act = '';
  // --- admin: beri nama BASTL ---
  if (b.layer === 'bastl' && !b.nama) {
    act += (r === 'admin' || r === 'spv') ? `<div class="card stack"><h2>Beri nama blok</h2><p class="note">Melanjutkan urutan terakhir blok. Setelah disimpan, permintaan bibit penanaman langsung masuk ke nursery dan pekerjaan ExDAS dimulai.</p><div class="row" style="flex-wrap:nowrap"><input id="bnm" value="${esc(nextHRP())}" aria-label="Nama blok"><button class="btn" id="bnmOk">Simpan</button></div></div>` : '<div class="alert">Petak ini belum diberi nama oleh administrator.</div>';
  }
  // --- vendor ---
  if ((r === 'exdas' && b.layer === 'bastl') || (r === 'bumdes' && b.layer === 'perawatan') || r === 'admin') {
    if (!p && b.layer === 'perawatan') {
      const no = L.selesai(id, 'rotasi').length + 1;
      act += `<div class="card stack"><h2>Rotasi perawatan ${no}</h2><p class="small" style="margin:0">Jadwal: ${tgl(ri?.next)} · kegiatan ${ri?.kegiatan || '–'} + NPK 50 g/pohon + sulam.</p><button class="btn block" id="vStart" ${r === 'bumdes' || r === 'admin' ? '' : 'disabled'}>Mulai perawatan</button></div>`;
    }
    if (p && p.status === 'pelaksanaan') {
      if (p.tipe === 'cek1') {
        const tot = Object.values(stok).reduce((a, x) => a + x, 0);
        act += `<div class="card stack"><h2>Penanaman ExDAS</h2><p class="small" style="margin:0">Bibit diterima di lapangan (blok ini): <b>${fmt(tot)}</b>${dk.length ? ` · ${fmt(dk.reduce((a, k) => a + k.n, 0))} dalam pengiriman` : ''}.</p><button class="btn block" id="vLapor" ${tot > 0 && !dk.length ? '' : 'disabled'}>Lapor penanaman selesai</button>${dk.length ? '<p class="note">Terima dulu semua kiriman bibit.</p>' : tot ? '' : '<p class="note">Menunggu bibit dari nursery.</p>'}</div>`;
      } else {
        const ov = L.openVendor(p); const ret = L.retensiInfo(p);
        act += `<div class="card stack"><h2>${p.tipe === 'retensi' ? 'Retensi ExDAS (30 hari)' : 'Perawatan rotasi ' + p.nomor}</h2>
          <p class="small" style="margin:0">Tandai setiap tanaman mati dengan tag, sulam, lalu scan tag yang sama. Tag vendor belum disulam: <b>${ov.length}</b>.</p>
          <div class="grid2"><button class="btn ghost" id="vTag">+ Tag tanaman mati</button><a class="btn ghost" href="#scan">Scan sulam</a></div>
          <button class="btn block" id="vDone" ${ov.length || (ret && ret.left > 0) ? 'disabled' : ''}>${p.tipe === 'retensi' ? 'Retensi selesai' : 'Perawatan selesai'}</button>
          ${ov.length ? '<p class="note">Terkunci: masih ada tag vendor yang belum disulam.</p>' : ret && ret.left > 0 ? `<p class="note">Retensi berakhir ${tgl(ret.until)} (${ret.left} hari lagi).</p>` : ''}</div>`;
      }
    }
    if (p && p.status === 'sulam_gl') {
      const og = L.openGL(p);
      act += `<div class="card stack"><h2>Sulam tag GL (${og.length})</h2><p class="small" style="margin:0">Semua tag GL wajib disulam lalu discan. ${p.hasil?.final ? 'Setelah semua selesai, BA menunggu persetujuan owner.' : 'Setelah semua selesai, GL melakukan verifikasi.'}</p><a class="btn ghost block" href="#scan">Scan sulam</a><button class="btn block" id="vSulamDone" ${og.length ? 'disabled' : ''}>Konfirmasi sulam selesai</button></div>`;
    }
  }
  // --- GL owner ---
  if ((r === 'owner' || r === 'admin') && p) {
    if (['siap_inspeksi', 'verifikasi'].includes(p.status)) {
      const lk = L.lockInfo(p);
      act += `<div class="card stack"><h2>${p.status === 'verifikasi' ? 'Verifikasi tag GL' : 'Inspeksi ' + G.TIPE_LBL[p.tipe].toLowerCase()}</h2>${lk ? `<div class="alert warn">${esc(lk.why)}${lk.until ? ` Bisa dimulai ${tgl(lk.until)}.` : ''}</div>` : '<p class="small" style="margin:0">Sapu seluruh jalur. Jejak GPS direkam otomatis. Wajib 4 foto kegiatan.</p>'}<button class="btn block" id="gStart" ${lk ? 'disabled' : ''}>Mulai ${p.status === 'verifikasi' ? 'verifikasi' : 'inspeksi'}</button></div>`;
    }
    if (p.status === 'inspeksi') { const s = S.sesi.find(x => x.periode_id === p.id && !x.selesai_at); act += `<div class="card stack"><h2>Sesi berjalan</h2><p class="small" style="margin:0">Oleh ${esc(nm(s?.oleh))} sejak ${tgl(s?.mulai_at)} ${jam(s?.mulai_at)}.</p><a class="btn block" href="#sesi/${s?.id}">Lanjutkan sesi</a></div>`; }
  }
  if (r === 'admin' && p && p.status === 'menunggu_persetujuan') {
    act += `<div class="card stack"><h2>Persetujuan owner</h2><p class="small" style="margin:0">Hasil ${fmt(p.pct, 2)}% (≥ 90%). Semua tag GL sudah disulam vendor.</p><button class="btn block" id="aOk">Setujui dan terbitkan BA</button></div>`;
  }
  // --- admin input data lama perawatan ---
  if ((r === 'admin' || r === 'spv') && b.layer === 'perawatan') {
    act += `<details class="card"><summary><b>Input manual admin</b></summary><div class="stack" style="margin-top:10px"><div class="grid2"><label class="f" for="aT">Tanggal closing BA tanam<input type="date" id="aT" value="${esc(b.tgl_tanam || '')}"></label><label class="f" for="aR">Realisasi rotasi terakhir<input type="date" id="aR" value="${esc(b.tgl_rotasi_terakhir || '')}"></label></div><button class="btn ghost" id="aSave">Simpan tanggal</button></div></details>`;
  }
  const info = `<dl class="kv"><dt>Luas</dt><dd>${fmt(b.ha, 2)} Ha</dd>${b.kode_bastl ? `<dt>Kode BASTL</dt><dd class="mono">${esc(b.kode_bastl)}</dd>` : ''}${b.no_bastl ? `<dt>No. BASTL</dt><dd>${esc(b.no_bastl)}</dd>` : ''}
    ${ri ? `<dt>Tanggal tanam</dt><dd>${tgl(ri.tanam.tgl)}${ri.tanam.perkiraan ? ' *' : ''}</dd><dt>Umur</dt><dd>${fmt(ri.umur / 30.4)} bulan</dd><dt>Kegiatan</dt><dd>${ri.kegiatan}</dd><dt>Rotasi terakhir</dt><dd>${ri.last ? tgl(ri.last) : 'belum diisi'}</dd><dt>Rotasi berikutnya</dt><dd>${tgl(ri.next)}</dd>` : ''}</dl>${ri?.tanam.perkiraan ? '<p class="note">* Perkiraan dari bulan tanam di shapefile.</p>' : ''}`;
  const need = b.layer === 'bastl' ? `<div class="sec"><h3>Kebutuhan penanaman</h3><dl class="kv"><dt>Ajir & lubang</dt><dd>${fmt(n.lubang)}</dd><dt>Pupuk dasar</dt><dd>${fmt(n.pupuk)} kg · ${fmt(n.sakKohe)} sak</dd><dt>NPK</dt><dd>${fmt(n.npk)} kg</dd><dt>Pioneer / sisipan</dt><dd>${fmt(n.pio)} / ${fmt(n.sis)}</dd><dt>LCC (ditabur)</dt><dd>${fmt(n.lcc)} kg</dd><dt>Perkiraan durasi</dt><dd>${n.hariKerja} hari</dd></dl></div>` : `<div class="sec"><h3>Kebutuhan per rotasi</h3><dl class="kv"><dt>Populasi</dt><dd>${fmt(G.STD.lubang * b.ha)} pohon</dd><dt>NPK 50 g/pohon</dt><dd>${fmt(G.STD.npk * b.ha)} kg</dd></dl></div>`;
  const stokHtml = Object.keys(stok).length || dk.length ? `<div class="sec"><div class="row between"><h3>Bibit di lapangan</h3>${kembaliDue(id) != null && Object.keys(stok).length ? `<span class="pill ${kembaliDue(id) < 0 ? 's-bad' : 's-warn'}">${kembaliDue(id) < 0 ? 'Lewat ' + (-kembaliDue(id)) + ' hari' : 'Kembalikan ≤ ' + kembaliDue(id) + ' hari'}</span>` : ''}</div><div class="chips">${Object.entries(stok).map(([k, v]) => `<span class="chip">${esc(S.jenisMap[k]?.nama || k)} ${fmt(v)}</span>`).join('')}${dk.map(k => `<span class="chip">dikirim: ${esc(S.jenisMap[k.jenis]?.nama)} ${fmt(k.n)}</span>`).join('')}</div>${Object.keys(stok).length && isRole('admin', 'owner', 'exdas', 'bumdes') ? '<button class="btn ghost block" id="kbBtn">Kembalikan ke nursery (sisa / afkir)</button>' : ''}</div>` : '';
  const hist = plist.length ? `<div class="card stack"><h2>Riwayat pekerjaan</h2><div class="tbl"><table><thead><tr><th>Periode</th><th>Status</th><th class="r">Hasil</th><th>Tgl</th></tr></thead><tbody>${plist.slice().reverse().map(x => `<tr><td>${G.TIPE_LBL[x.tipe]}${x.tipe === 'rotasi' ? ' ' + x.nomor : ''}</td><td>${G.STATUS_LBL[x.status]}</td><td class="r">${x.pct != null ? fmt(x.pct, 2) + '%' : '–'}</td><td>${tgl(x.approved_at || x.vendor_selesai_at || x.mulai_at || x.created_at)}</td></tr>`).join('')}</tbody></table></div>${S.ba.filter(a => a.blok_id === id).map(a => `<a class="item" href="#ba/${a.id}"><div class="grow"><b>BA ${esc(a.jenis)} · ${esc(a.nomor)}</b><span>${tgl(a.created_at)}${a.scan_path ? ' · scan diunggah' : ''}</span></div></a>`).join('')}</div>` : '';
  shell(G.blokName(b), b.layer === 'bastl' ? 'BASTL · ' + (b.kode_bastl || '') : b.layer === 'perawatan' ? 'Perawatan BUMDES' : '', `<div class="stack">
    <div class="card"><div class="row between"><div><div class="eyebrow">${b.layer === 'bastl' ? 'BASTL 2026 · ExDAS' : b.layer === 'perawatan' ? 'Perawatan · ' + esc(b.pit || '') : 'Berhasil penilaian'}</div><h1>${esc(G.blokName(b))}</h1></div><span class="pill s-${st.k}">${esc(st.t)}</span></div><div class="sec" style="border:0;margin:0">${info}</div>${need}${stokHtml}</div>
    ${act}
    <div class="card stack"><div class="row between"><h2>Peta & tag</h2><span class="small muted">${tags.filter(t => t.status !== 'closed').length} terbuka · ${tags.length} total</span></div><div class="map short" id="bmap"></div><div class="legend"><span><i class="sw" style="background:#E0473B;border-radius:50%"></i>Tag GL mati</span><span><i class="sw" style="background:#F2C230;border-radius:50%"></i>Tag vendor mati</span><span><i class="sw" style="background:#4F86C6;border-radius:50%"></i>Disulam</span><span><i class="sw" style="background:#2F8A57;border-radius:50%"></i>Hidup / closed</span></div>
      <div class="list">${tags.slice().reverse().slice(0, 40).map(t => tagItem(t)).join('')}</div></div>
    ${hist}</div>`);
  // peta blok
  const map = newMap($('#bmap')); const gj = window.L.geoJSON(b.geom, { style: { color: '#fff', weight: 2, fillColor: COL[st.k] || '#888', fillOpacity: .25 } }).addTo(map);
  map.fitBounds(gj.getBounds(), { padding: [12, 12] });
  tags.filter(t => t.lat).forEach(t => window.L.circleMarker([t.lat, t.lon], { radius: 6, color: '#fff', weight: 1.5, fillColor: tagColor(t), fillOpacity: 1 }).on('click', () => tagSheet(t.id)).addTo(map));
  locateControl(map);
  $$('[data-tag]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); tagSheet(a.dataset.tag); }));
  // aksi
  const on = (sel, fn) => { const x = $(sel); if (x) x.addEventListener('click', async () => { x.disabled = true; try { await fn(); } catch (e) { toast(e.message); } finally { x.disabled = false; } }); };
  on('#bnmOk', async () => {
    const v = $('#bnm').value.trim().toUpperCase(); if (!v) return toast('Isi nama blok.');
    if (S.blok.some(x => x.nama === v)) return toast(`Nama ${v} sudah dipakai.`);
    await upd('blok', { id }, { nama: v });
    await ins('minta', { id: uid(), blok_id: id, tipe: 'tanam', pio: n.pio, sis: n.sis });
    await ins('periode', { id: uid(), blok_id: id, tipe: 'cek1', nomor: 1, vendor: 'exdas', status: 'pelaksanaan', mulai_at: new Date().toISOString() });
    toast(`${v} tersimpan. Permintaan ${fmt(n.pio + n.sis)} bibit dikirim ke nursery.`); route();
  });
  on('#vStart', async () => { const no = L.selesai(id, 'rotasi').length + 1; await ins('periode', { id: uid(), blok_id: id, tipe: 'rotasi', nomor: no, vendor: 'bumdes', status: 'pelaksanaan', mulai_at: new Date().toISOString() }); toast('Perawatan dimulai.'); route(); });
  on('#vLapor', async () => laporTanam(b, p));
  on('#vTag', async () => { await vendorNewTag(b, p); route(); });
  on('#vDone', async () => { if (!(await confirmSheet(`Nyatakan ${p.tipe === 'retensi' ? 'retensi' : 'perawatan'} di ${esc(G.blokName(b))} selesai? GL akan menerima tugas inspeksi 7 hari setelah sulam terakhir.`))) return; await upd('periode', { id: p.id }, { status: 'siap_inspeksi' }); toast('Dilaporkan selesai. Tugas inspeksi masuk ke GL.'); route(); });
  on('#vSulamDone', async () => { const next = p.hasil?.final ? 'menunggu_persetujuan' : 'verifikasi'; await upd('periode', { id: p.id }, { status: next }); toast(next === 'verifikasi' ? 'Sulam selesai. GL akan memverifikasi tag GL.' : 'Sulam selesai. Menunggu persetujuan owner.'); route(); });
  on('#gStart', async () => { const sid = uid(); await ins('sesi', { id: sid, periode_id: p.id, blok_id: id, tipe: p.status === 'verifikasi' ? 'verifikasi' : 'inspeksi', oleh: S.me.id }); await upd('periode', { id: p.id }, { status: 'inspeksi' }); location.hash = '#sesi/' + sid; });
  on('#aOk', async () => { await approvePeriode(p); route(); });
  const kb = $('#kbBtn'); if (kb) kb.addEventListener('click', () => kembaliSheet(id, route));
  on('#aSave', async () => { await upd('blok', { id }, { tgl_tanam: $('#aT').value || null, tgl_rotasi_terakhir: $('#aR').value || null }); toast('Tanggal tersimpan.'); route(); });
}
export const tagColor = t => t.status === 'closed' ? '#2F8A57' : t.status === 'disulam' ? '#4F86C6' : t.sumber === 'gl' ? '#E0473B' : '#F2C230';
export const tagItem = t => { const ev = L.events(t.id); const last = ev[ev.length - 1]; return `<a class="item" href="#" data-tag="${esc(t.id)}"><span class="tagid">${esc(t.id.slice(-6))}</span><div class="grow"><b>${t.status === 'mati' ? 'Mati' : t.status === 'disulam' ? 'Disulam' : 'Hidup, closed'} · ${t.sumber === 'gl' ? 'tag GL' : 'tag vendor'}</b><span>${esc(t.jalur || '')} · ${esc(G.KONDLBL[t.kondisi] || '')}${t.low_acc ? ' · akurasi rendah' : ''} · ${last ? esc(S.jenisMap[last.jenis]?.nama || '') + ' ' + tgl(last.at) : ''}</span></div></a>`; };
function nextHRP() { let mx = 0; S.blok.forEach(b => { const m = /^HRP-(\d+)/.exec(b.nama || ''); if (m) mx = Math.max(mx, +m[1]); }); return 'HRP-' + (mx + 1); }

async function laporTanam(b, p) {
  const stok = L.stokTampung(b.id);
  sheet(`<form class="stack" id="lt"><h2>Lapor penanaman selesai</h2><p class="small" style="margin:0">Isi jumlah bibit yang benar-benar tertanam per jenis. Sisa yang tidak tertanam dikembalikan lewat tombol Kembalikan ke nursery.</p>
    ${Object.entries(stok).map(([k, v]) => `<label class="f" for="lt-${k}">${esc(S.jenisMap[k]?.nama)} <small>diterima di lapangan ${fmt(v)}</small><input type="number" min="0" max="${v}" id="lt-${k}" value="${v}" inputmode="numeric"></label>`).join('')}
    <p class="err" id="ltErr" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Lapor selesai</button></div></form>`, (box, close) => {
    box.querySelector('#lt').addEventListener('submit', async e => {
      e.preventDefault(); const rows = [];
      for (const [k, v] of Object.entries(stok)) { const x = Number(box.querySelector('#lt-' + k).value); if (!(x >= 0) || x > v) { const er = box.querySelector('#ltErr'); er.textContent = `Jumlah ${S.jenisMap[k]?.nama} harus 0–${v}.`; er.hidden = false; return; } if (x > 0) rows.push({ blok_id: b.id, jenis: k, tipe: 'tanam', n: x, oleh: S.me.id }); }
      if (!rows.length) return toast('Belum ada bibit yang tertanam.');
      await ins('tampung_log', rows); await upd('periode', { id: p.id }, { status: 'siap_inspeksi' });
      S.minta.filter(m => m.blok_id === b.id && m.status === 'terbuka').forEach(m => upd('minta', { id: m.id }, { status: 'selesai' }));
      close(); toast('Penanaman dilaporkan selesai. Cek 1 GL bisa mulai 7 hari lagi.'); route();
    });
  });
}

// ---------- lainnya, akun, admin pengguna ----------
function simCard() {
  if (!isRole('admin', 'spv')) return '';
  return `<div class="card stack"><h2>Simulasi waktu (uji coba)</h2><p class="small" style="margin:0">Tanggal sistem: <b>${tgl(G.today())}</b>${G.SIM ? ` · dimajukan <b>${G.SIM} hari</b> dari tanggal asli` : ' · tanggal asli'}.</p><div class="grid2"><button class="btn ghost" data-sim="1">+1 hari</button><button class="btn ghost" data-sim="7">+7 hari</button></div>${G.SIM ? '<button class="btn ghost block" data-sim="0">Kembali ke tanggal asli</button>' : ''}<p class="note">Berlaku untuk semua akun. Dipakai untuk menguji kunci 7 hari, retensi 30 hari, dan jadwal rotasi tanpa menunggu. Kembalikan ke tanggal asli sebelum aplikasi dipakai sungguhan.</p></div>`;
}
// Ortho drone: hanya admin yang mengunggah; semua akun melihat hasilnya di peta.
function orthoCard() {
  if (!isRole('admin')) return '';
  const st = SLOTS.map(([k, lbl]) => { const o = ORTHO[k]; return `<div><b>${lbl}</b>: ${o ? `${esc(o.tanggal ? tgl(o.tanggal) : o.id)} · zoom maks ${o.maxzoom} (±${fmt(o.res_m * 100, 0)} cm/piksel)` : '<span class="muted">belum ada</span>'}</div>`; }).join('');
  const tok = tokenGet(), job = lastJob();
  const body = !tok ? `<p class="small" style="margin:0">Sekali saja: tempel token GitHub khusus repo aplikasi. Token tersimpan hanya di perangkat ini.</p>
      <details class="small"><summary>Cara membuat token</summary><ol style="padding-left:18px;margin:6px 0"><li>Buka github.com → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li><li>Repository access: <b>Only select repositories</b> → webgis-reklamasi-hm.</li><li>Permissions: <b>Contents: Read and write</b>, <b>Actions: Read</b>. Expiration bebas (mis. 1 tahun).</li><li>Salin token (diawali github_pat_) lalu tempel di bawah.</li></ol></details>
      <input id="ghTok" type="password" placeholder="github_pat_…" autocomplete="off"><button class="btn block" id="ghTokSave">Simpan token</button>`
    : `<label class="small">Jenis ortho<select id="oSlot"><option value="mingguan">Ortho mingguan (terbaru, paling atas)</option><option value="utama">Ortho utama (seluruh area)</option></select></label>
      <label class="small">Tanggal terbang<input id="oTgl" type="date" value="${G.today()}"></label>
      <label class="small">File GeoTIFF (.tif)<input id="oFile" type="file" accept=".tif,.tiff,image/tiff"></label>
      <div id="oProg" class="small muted"></div>
      <button class="btn block" id="oUp">Unggah dan ganti ortho lama</button>
      <div class="row" style="gap:8px"><button class="btn ghost grow" id="oDel">Kosongkan slot terpilih</button><button class="btn ghost grow" id="ghTokDel">Ganti token</button></div>`;
  return `<div class="card stack"><h2>Ortho drone</h2><div class="small stack" style="gap:2px">${st}</div>
    <p class="small muted" style="margin:0">Urutan di peta: citra online → ortho utama → ortho mingguan (terbaru di atas). Setiap akun bisa menyembunyikan lewat tombol lapisan di peta.</p>
    ${job ? `<div class="small" id="oJob"><b>Unggahan terakhir</b> (${esc(job.slot)}, ${esc(job.tanggal || '')}): <span id="oJobSt">memeriksa…</span> <a href="#" id="oJobRf">perbarui</a></div>` : ''}
    ${body}</div>`;
}
function bindOrtho() {
  if (!isRole('admin')) return;
  const on = (id, fn) => { const x = document.getElementById(id); if (x) x.addEventListener('click', async e => { e.preventDefault(); x.disabled = true; try { await fn(); } catch (err) { toast(err.message, 5000); const p = document.getElementById('oProg'); if (p) p.textContent = err.message; } finally { x.disabled = false; } }); };
  const prog = m => { const p = document.getElementById('oProg'); if (p) p.textContent = m; };
  const refresh = async () => { const el = document.getElementById('oJobSt'); if (!el) return; try { const r = await jobStatus(); el.textContent = r ? r.teks : '–'; if (r && r.tahap !== 'selesai' && r.tahap !== 'gagal') setTimeout(() => location.hash === '#lainnya' && refresh(), 20000); } catch (e) { el.textContent = e.message; } };
  refresh(); on('oJobRf', refresh);
  on('ghTokSave', async () => { const v = $('#ghTok').value.trim(); if (!v) return toast('Tempel token dulu.'); await checkToken(v); tokenSet(v); toast('Token tersimpan di perangkat ini.'); renderLainnya(); });
  on('ghTokDel', async () => { if (!(await confirmSheet('Hapus token dari perangkat ini? Anda perlu menempel token lagi untuk mengunggah.'))) return; tokenSet(''); renderLainnya(); });
  on('oUp', async () => {
    const f = $('#oFile').files[0], slot = $('#oSlot').value, tanggal = $('#oTgl').value;
    if (!f) return toast('Pilih file GeoTIFF.');
    if (!/\.tiff?$/i.test(f.name)) return toast('File harus GeoTIFF (.tif).');
    if (f.size > 2 * 1024 ** 3) return toast('File lebih dari 2 GB. Ekspor ulang dengan kompresi JPEG.');
    const lbl = slot === 'utama' ? 'Ortho utama' : 'Ortho mingguan';
    if (!(await confirmSheet(`Unggah <b>${esc(f.name)}</b> (${fmt(f.size / 1024 ** 2, 0)} MB) sebagai <b>${lbl}</b> tanggal ${esc(tgl(tanggal))}? ${lbl} yang lama akan diganti. Jangan tutup halaman ini sampai pengiriman selesai.`))) return;
    const job = await uploadOrtho({ file: f, slot, tanggal }, s => prog(`${s.msg} (${Math.round(s.i / Math.max(1, s.n) * 100)}%)`));
    prog(''); toast('Terkirim. GitHub sedang memotong ubin, biasanya 15–40 menit.', 5000); renderLainnya();
  });
  on('oDel', async () => {
    const slot = $('#oSlot').value, lbl = slot === 'utama' ? 'Ortho utama' : 'Ortho mingguan';
    if (!ORTHO[slot]) return toast(`${lbl} memang belum ada.`);
    if (!(await confirmSheet(`Kosongkan ${lbl}? Lapisan ini hilang dari peta semua akun.`, 'Ya, kosongkan', true))) return;
    await uploadOrtho({ slot, tanggal: G.today(), action: 'hapus' }); toast('Diproses. Hilang dari peta dalam beberapa menit.'); renderLainnya();
  });
}
function offCard() {
  const ti = tileInfo(), job = tileJob(), n = S.ready ? tileList(S).length : 0;
  return `<div class="card stack"><h2>Offline di lapangan</h2>
    <dl class="kv"><dt>Data terakhir</dt><dd>${S.snapAt ? tgl(S.snapAt) + ' ' + jam(S.snapAt) : '–'}${S.offline ? ' (offline)' : ''}</dd><dt>Belum terkirim</dt><dd>${pending()} catatan</dd><dt>Peta satelit offline</dt><dd id="tileSt">${job ? `mengunduh ${job.done}/${job.total}` : ti ? `${fmt(ti.total)} ubin · ${tgl(ti.at)}` : 'belum diunduh'}</dd></dl>
    <button class="btn ghost block" id="tileGo" ${job ? 'disabled' : ''}>${ti ? 'Perbarui' : 'Unduh'} peta offline area kerja (${fmt(n)} ubin)</button>
    ${!isInstalled() ? `<button class="btn block" id="instGo">Pasang aplikasi di HP</button>` : '<p class="note" style="margin:0">Aplikasi sudah terpasang di HP.</p>'}
    <p class="note">Tanpa sinyal, semua catatan (tag, sulam, sesi inspeksi, foto, nursery, gudang) disimpan di HP dan dikirim otomatis begitu ada sinyal. Unduh peta saat ada wifi atau sinyal bagus, sekali saja; perbarui bila ada blok baru.</p></div>`;
}
function bindOff() {
  const tg = $('#tileGo'); if (tg) tg.addEventListener('click', () => startTiles(true));
  const ig = $('#instGo'); if (ig) ig.addEventListener('click', async () => { if (canInstall()) { if (await promptInstall()) toast('Aplikasi dipasang. Buka dari ikon Reklamasi HM di layar utama.'); } else toast('Di Chrome: ketuk menu ⋮ lalu "Instal aplikasi" atau "Tambahkan ke layar utama".', 5000); });
}
function startTiles(manual) {
  if (!navigator.onLine) { if (manual) toast('Butuh sinyal untuk mengunduh peta.'); return; }
  const p = downloadTiles(S, st => { const el = document.getElementById('tileSt'); if (el) el.textContent = `mengunduh ${st.done}/${st.total}`; });
  if (manual) toast('Mengunduh peta offline di latar belakang…');
  p.then(r => { if (manual || r.fail) toast(r.fail ? `Peta offline: ${r.fail} ubin gagal, coba Perbarui lagi.` : 'Peta offline siap dipakai tanpa sinyal.'); if (location.hash === '#lainnya') renderLainnya(); });
}
function renderLainnya() {
  const r = role();
  shell('Lainnya', null, `${simCard()}${orthoCard()}${offCard()}<div class="list">${(MORE[r] || []).map(k => `<a class="item" href="#${k}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">${ICON[k] || ICON.tugas}</svg><div class="grow"><b>${LBL[k]}</b></div></a>`).join('')}</div>`);
  $$('[data-sim]').forEach(b => b.addEventListener('click', async () => { const d = +b.dataset.sim; const n = d === 0 ? 0 : G.SIM + d; try { await upd('setting', { k: 'sim_days' }, { v: n, updated_by: S.me.id }, { offline: false }); toast(n ? `Tanggal sistem dimajukan ${n} hari.` : 'Kembali ke tanggal asli.'); renderLainnya(); } catch (e) { toast(e.message); } }));
  bindOff(); bindOrtho();
}
function renderAkun() {
  shell('Akun saya', null, `<div class="stack"><div class="card"><dl class="kv"><dt>Nama</dt><dd>${esc(S.me.nama)}</dd><dt>Jabatan</dt><dd>${esc(S.me.jabatan || '–')}</dd><dt>Peran</dt><dd>${esc(G.ROLE_LBL[role()])}</dd><dt>Mode</dt><dd>${SB.mode === 'demo' ? 'Demo (data di HP)' : 'Online'}</dd><dt>Antrean offline</dt><dd>${pending()}</dd></dl></div>
    <button class="btn ghost block" id="sync">Perbarui data</button><button class="btn bad block" id="out">Keluar</button>
    <p class="note">Pasang di layar utama: buka menu browser lalu pilih "Tambahkan ke layar utama".</p></div>`);
  $('#sync').addEventListener('click', async () => { await flush(); await loadAll(); toast('Data diperbarui.'); });
  $('#out').addEventListener('click', async () => { if (pending() && !(await confirmSheet('Masih ada data yang belum terkirim. Tetap keluar?', 'Keluar', true))) return; await SB.logout(); location.hash = ''; renderLogin(); });
}
function renderAdmin() {
  if (role() !== 'admin') return renderLainnya();
  shell('Pengguna', null, `<div class="stack"><div class="alert">Akun baru dibuat di Supabase: <b>Authentication → Users → Add user</b> (centang <i>Auto confirm</i>). Setelah orangnya login sekali atau muncul di daftar ini, atur nama, jabatan, dan perannya di sini.</div>
    <div class="list">${S.profiles.map(p => `<div class="card stack"><div class="grid2"><label class="f">Nama<input data-p="${p.id}" data-k="nama" value="${esc(p.nama)}"></label><label class="f">Jabatan<input data-p="${p.id}" data-k="jabatan" value="${esc(p.jabatan || '')}"></label></div><div class="grid2"><label class="f">Peran<select data-p="${p.id}" data-k="role">${Object.entries(G.ROLE_LBL).map(([k, v]) => `<option value="${k}" ${p.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="f">Status<select data-p="${p.id}" data-k="aktif"><option value="true" ${p.aktif !== false ? 'selected' : ''}>Aktif</option><option value="false" ${p.aktif === false ? 'selected' : ''}>Nonaktif</option></select></label></div><button class="btn ghost sm" data-save="${p.id}">Simpan</button></div>`).join('')}</div>
    <p class="note">Penanda tangan BA diambil dari jabatan: "SPV Reklamasi", "Reclamation Suptend", "KTT", nama vendor dari akun ExDAS/BUMDES, dan GL dari pengawas yang menginspeksi (dicetak "GL Reklamasi").</p></div>`);
  $$('[data-save]').forEach(b => b.addEventListener('click', async () => { const id = b.dataset.save; const patch = {}; $$(`[data-p="${id}"]`).forEach(i => { patch[i.dataset.k] = i.dataset.k === 'aktif' ? i.value === 'true' : i.value; }); try { await upd('profiles', { id }, patch, { offline: false }); toast('Tersimpan.'); } catch (e) { toast(e.message); } }));
}

// ---------- router ----------
export function route() {
  if (!S.me) return renderLogin(SB.user() ? 'Akun Anda belum terdaftar di aplikasi. Hubungi administrator.' : '');
  const [k, a] = location.hash.slice(1).split('/');
  const r = role(); const allowed = [...(MENU[r] || []), ...(MORE[r] || []), 'blok', 'sesi', 'ba'];
  const key = k || MENU[r][0];
  if (!allowed.includes(key)) { location.hash = '#' + MENU[r][0]; return; }
  window.scrollTo(0, 0);
  ({
    beranda: renderBeranda, tugas: renderTugas, peta: renderPeta, blok: () => renderBlok(decodeURIComponent(a)),
    sesi: () => renderSesi(a, shell), scan: () => openScan(shell), nursery: () => renderNursery(shell), kirim: () => renderKirim(shell),
    tampung: () => renderTampung(shell), gudang: () => renderGudang(shell), ba: () => a ? renderBA(a, shell) : renderBAList(shell),
    lainnya: renderLainnya, akun: renderAkun, admin: renderAdmin, cetak: () => renderCetakTag(shell), master: () => renderMaster(shell),
  }[key] || renderLainnya)();
}
window.addEventListener('hashchange', route);
window.addEventListener('hm:data', () => { if (!document.querySelector('.sheet,.scanner') && !location.hash.startsWith('#sesi')) route(); });
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && S.me) { try { await flush(); await loadAll(); if (!document.querySelector('.sheet,.scanner,input:focus')) route(); } catch (e) {} } });

async function boot() {
  try {
    const u = await SB.ensure();
    await loadOrtho();
    if (!u) { if (SB.mode === 'demo') await loadAll().catch(() => {}); return renderLogin(); }
    await loadAll();
    if (!S.me) { const u = SB.user() || {}; const dbg = SB.debug ? await SB.debug().catch(e => e.message) : ''; return renderLogin(`Akun Anda belum terdaftar di aplikasi. Hubungi administrator. [cek: ${u.email || '-'} · id ${String(u.id || '-').slice(0, 8)} · profil terbaca ${S.profiles.length} · blok terbaca ${S.blok.length} · ${dbg}]`); }
    route(); flush(); persist();
    const ti0 = tileInfo();
    if (SB.mode !== 'demo' && (!ti0 || ti0.ortho !== orthoKey()) && navigator.onLine && !(navigator.connection && navigator.connection.saveData)) setTimeout(() => startTiles(false), 4000);
  } catch (e) {
    if (e.status === 401) { await SB.logout(); return renderLogin('Sesi berakhir. Silakan masuk lagi.'); }
    app.className = ''; app.innerHTML = `<main><div class="card stack"><h1>Tidak bisa memuat data</h1><p class="small">${e.net ? 'Belum ada salinan data di HP ini. Buka aplikasi sekali saat ada sinyal, setelah itu bisa dipakai tanpa sinyal.' : esc(e.message)}</p><button class="btn" onclick="location.reload()">Coba lagi</button></div></main>`;
  }
}
export { shell, boot };
boot();
