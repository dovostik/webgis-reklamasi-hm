// Cetak peta layout PT Hamparan Mulya (A4/A3 lanskap): preset progres mingguan/bulanan penanaman & perawatan, atau bebas pilih blok
import { S, L, $, $$, toast } from './core.js';
import { SAT_URL, ORTHO, orthoUrl, SLOTS } from './offline.js';
import { mingguKe } from './dash.js';
import * as G from './logic.js';
const { fmt } = G;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const PAL = ['#F4A6A6', '#A8E6A1', '#A7D8F0', '#B9A7F0', '#F7D9A0', '#F2B8E8', '#9FE0D2', '#E8E39A', '#F5B98A', '#C6D7A0', '#9DB8F2', '#E3A3C2', '#B5E3F2', '#D9C2A6', '#A6B5A0', '#F0A0A0'];
const day = ts => ts ? (String(ts).length <= 10 ? String(ts) : G.tglWIB(ts)) : null;
const addD = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = d => (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7;
const tglS = d => { const [y, m, dd] = d.split('-'); return `${+dd} ${BULAN[+m - 1].slice(0, 3)} ${y}`; };

// ---------- WGS84 → UTM (zona 50 selatan) ----------
function utm(lat, lon, zone = 50) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2), rad = Math.PI / 180;
  const l0 = ((zone - 1) * 6 - 180 + 3) * rad, p = lat * rad, l = lon * rad;
  const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = Math.cos(p) * (l - l0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
  const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  let Nn = k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  if (lat < 0) Nn += 10000000;
  return [E, Nn];
}
// UTM → WGS84 (untuk menempatkan garis grid)
function utmInv(E, Nn, zone = 50) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = E - 500000, y = Nn - 10000000, M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2, R1 = a * (1 - e2) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = x / (N1 * k0);
  const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
  return [lat * 180 / Math.PI, ((zone - 1) * 6 - 180 + 3) + lon * 180 / Math.PI];
}

// ---------- rentang waktu ----------
function rWeek(y, w) { const j = `${y}-01-01`, s0 = addD(j, (w - 1) * 7 - dow(j)); const a = s0 < j ? j : s0, e0 = addD(s0, 6), z = `${y}-12-31`; return { a, b: e0 > z ? z : e0 }; }
function rMonth(y, m) { const a = `${y}-${String(m).padStart(2, '0')}-01`; const b = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); return { a, b }; }
const inR = (d, r) => d && d >= r.a && d <= r.b;

// ---------- isi peta per preset ----------
function blokTanam(r) {
  const out = [];
  S.blok.filter(b => b.layer === 'bastl').forEach(b => {
    const ps = S.periode.filter(p => p.blok_id === b.id && p.tipe === 'cek1');
    const act = ps.find(p => p.mulai_at && day(p.mulai_at) <= r.b && (!p.vendor_selesai_at || day(p.vendor_selesai_at) >= r.a));
    const th = L.tanamHarian(b), bib = th ? Math.round(Object.entries(th.days).filter(([d]) => inR(d, r)).reduce((a, [, x]) => a + x.bibit, 0)) : 0;
    if (!act && bib <= 0) return;
    const done = act?.vendor_selesai_at && inR(day(act.vendor_selesai_at), r);
    out.push({ b, ket: (done ? `Selesai ${tglS(day(act.vendor_selesai_at))}` : 'Berjalan') + (bib > 0 ? ` · ${fmt(bib)} bibit` : '') });
  });
  return out;
}
function blokRawat(r) {
  const out = [];
  S.blok.filter(b => b.layer === 'perawatan').forEach(b => {
    const ps = S.periode.filter(p => p.blok_id === b.id && p.tipe === 'rotasi');
    const act = ps.find(p => p.mulai_at && day(p.mulai_at) <= r.b && (!p.vendor_selesai_at || day(p.vendor_selesai_at) >= r.a));
    const last = day(b.tgl_rotasi_terakhir); const info = L.rotasiInfo(b);
    if (act) out.push({ b, ket: act.vendor_selesai_at && inR(day(act.vendor_selesai_at), r) ? `Rotasi ${act.nomor || ''} selesai ${tglS(day(act.vendor_selesai_at))}` : `Rotasi ${act.nomor || ''} berjalan` });
    else if (inR(last, r)) out.push({ b, ket: `Realisasi ${tglS(last)}` });
    else if (info?.next && inR(day(info.next), r)) out.push({ b, ket: `Rencana · ${info.kegiatan}` });
    else if (info?.next && day(info.next) < r.a && info.dleft < 0) out.push({ b, ket: 'Rencana · lewat jadwal' });
  });
  return out;
}

let st = null;
function defaults() {
  const t = G.tglWIB(new Date().toISOString()), [y, m] = t.split('-').map(Number);
  return { preset: 'mg-tanam', y, w: mingguKe(t), m, sel: [], judul: '', lay: { mingguan: true, utama: true, online: true }, skala: null, kertas: 'A4', label: true };
}
function compute() {
  const p = st.preset, wk = p.startsWith('mg'), r = p === 'bebas' ? null : wk ? rWeek(st.y, st.w) : rMonth(st.y, st.m);
  const jenis = p.endsWith('tanam') ? 'PENANAMAN' : 'PEMELIHARAAN';
  let rows = p === 'bebas' ? st.sel.map(id => S.blokMap[id]).filter(Boolean).map(b => ({ b, ket: b.layer === 'bastl' ? 'BASTL' : b.layer === 'perawatan' ? 'Perawatan' : 'Berhasil' })) : p.endsWith('tanam') ? blokTanam(r) : blokRawat(r);
  rows.sort((a, b) => G.blokName(a.b).localeCompare(G.blokName(b.b), 'id', { numeric: true }));
  const per = r ? (wk ? `MINGGU KE-${st.w} TAHUN ${st.y}` : `BULAN ${BULAN[st.m - 1].toUpperCase()} TAHUN ${st.y}`) : '';
  const judul = st.judul || (p === 'bebas' ? `PETA AREA REKLAMASI\nTAHUN ${st.y}\nPT. HAMPARAN MULYA` : `PETA PROGRES ${jenis}\n${per}\nPT. HAMPARAN MULYA`);
  return { rows, r, judul, per };
}

// ---------- halaman ----------
export function renderCetakPeta(shell) {
  st = st || defaults();
  const PRE = [['mg-tanam', 'Mingguan · Penanaman'], ['mg-rawat', 'Mingguan · Perawatan'], ['bl-tanam', 'Bulanan · Penanaman'], ['bl-rawat', 'Bulanan · Perawatan'], ['bebas', 'Bebas pilih blok']];
  const grp = [['bastl', 'BASTL 2026'], ['perawatan', 'Perawatan'], ['berhasil', 'Berhasil penilaian']];
  shell('Cetak peta', 'Layout PT Hamparan Mulya', `<div class="stack">
    <div class="card stack noprint">
      <label class="f" for="cpP">Jenis peta<select id="cpP">${PRE.map(([k, l]) => `<option value="${k}" ${st.preset === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="grid2" id="cpPer"></div>
      <div id="cpSel" class="stack" hidden><div class="row" style="gap:6px;flex-wrap:wrap">${grp.map(([k, l]) => `<button type="button" class="btn ghost sm" data-all="${k}">+ ${l}</button>`).join('')}<button type="button" class="btn ghost sm" id="cpNone">Kosongkan</button></div>
        <details><summary class="small">Pilih blok (<span id="cpN">0</span> dipilih)</summary><div class="stack" style="gap:2px;max-height:240px;overflow:auto;margin-top:6px">${grp.map(([k, l]) => `<b class="small" style="margin-top:6px">${l}</b>${S.blok.filter(b => b.layer === k).sort((a, b) => G.blokName(a).localeCompare(G.blokName(b), 'id', { numeric: true })).map(b => `<label class="cpck"><span>${esc(G.blokName(b))} <span class="muted">${fmt(b.ha, 2)} Ha</span></span><input type="checkbox" data-sb="${esc(b.id)}" ${st.sel.includes(b.id) ? 'checked' : ''}></label>`).join('')}`).join('')}</div></details></div>
      <label class="f" for="cpJ">Judul <small>kosongkan untuk judul otomatis</small><textarea id="cpJ" rows="3" placeholder="judul otomatis">${esc(st.judul)}</textarea></label>
      <div class="grid2"><label class="f" for="cpK">Kertas<select id="cpK"><option ${st.kertas === 'A4' ? 'selected' : ''}>A4</option><option ${st.kertas === 'A3' ? 'selected' : ''}>A3</option></select></label>
        <label class="f" for="cpS">Skala 1 : <small>kosong = otomatis</small><input id="cpS" type="number" min="200" step="100" inputmode="numeric" list="cpSL" placeholder="otomatis" value="${st.skala || ''}"><datalist id="cpSL">${[1000, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000].map(v => `<option value="${v}">`).join('')}</datalist></label></div>
      <div class="stack" style="gap:0"><b class="small">Latar peta</b>
        <label class="cpck"><span>Drone mingguan${ORTHO.mingguan ? ` <small class="muted">${esc(ORTHO.mingguan.tanggal || '')}</small>` : ' <small class="muted">(belum ada)</small>'}</span><input type="checkbox" data-ly="mingguan" ${st.lay.mingguan ? 'checked' : ''}></label>
        <label class="cpck"><span>Drone utama${ORTHO.utama ? ` <small class="muted">${esc(ORTHO.utama.tanggal || '')}</small>` : ' <small class="muted">(belum ada)</small>'}</span><input type="checkbox" data-ly="utama" ${st.lay.utama ? 'checked' : ''}></label>
        <label class="cpck"><span>Citra online <small class="muted">Esri World Imagery</small></span><input type="checkbox" data-ly="online" ${st.lay.online ? 'checked' : ''}></label>
        <label class="cpck"><span>Label semua blok</span><input type="checkbox" id="cpL" ${st.label ? 'checked' : ''}></label></div>
      <button class="btn" id="cpGo">Cetak / simpan PDF</button><p class="note" style="margin:0">Di dialog cetak pilih <b>Simpan sebagai PDF</b>, orientasi <b>lanskap</b>, skala 100%. Geser dan zoom peta pratinjau di bawah untuk mengatur area.</p></div>
    <div class="plwrap" id="plw"></div></div>`);
  const per = () => { const box = $('#cpPer'), p = st.preset; $('#cpSel').hidden = p !== 'bebas';
    box.innerHTML = p.startsWith('mg') ? `<label class="f" for="cpW">Minggu ke-<input id="cpW" type="number" min="1" max="54" value="${st.w}"></label><label class="f" for="cpY">Tahun<input id="cpY" type="number" value="${st.y}"></label>`
      : p.startsWith('bl') ? `<label class="f" for="cpM">Bulan<select id="cpM">${BULAN.map((b, i) => `<option value="${i + 1}" ${st.m === i + 1 ? 'selected' : ''}>${b}</option>`).join('')}</select></label><label class="f" for="cpY">Tahun<input id="cpY" type="number" value="${st.y}"></label>`
      : `<label class="f" for="cpY">Tahun<input id="cpY" type="number" value="${st.y}"></label>`;
    box.querySelectorAll('input,select').forEach(i => i.addEventListener('change', () => { st.w = +($('#cpW')?.value || st.w); st.m = +($('#cpM')?.value || st.m); st.y = +($('#cpY')?.value || st.y); draw(true); })); };
  $('#cpP').addEventListener('change', e => { st.preset = e.target.value; per(); draw(true); });
  $('#cpJ').addEventListener('input', e => { st.judul = e.target.value.trim(); drawPanel(); });
  $('#cpK').addEventListener('change', e => { st.kertas = e.target.value; draw(false); });
  $$('[data-ly]').forEach(c => c.addEventListener('change', () => { st.lay[c.dataset.ly] = c.checked; draw(false); }));
  const sk = $('#cpS'); sk.addEventListener('change', () => { const v = Math.round(Number(sk.value)); st.skala = v >= 200 ? v : null; if (!st.skala) sk.value = ''; applyScale(); });
  $('#cpL').addEventListener('change', e => { st.label = e.target.checked; draw(false); });
  const selN = () => { $('#cpN').textContent = st.sel.length; };
  $$('[data-sb]').forEach(c => c.addEventListener('change', () => { st.sel = $$('[data-sb]').filter(x => x.checked).map(x => x.dataset.sb); selN(); draw(true); }));
  $$('[data-all]').forEach(b => b.addEventListener('click', () => { const ids = S.blok.filter(x => x.layer === b.dataset.all).map(x => x.id); st.sel = [...new Set([...st.sel, ...ids])]; $$('[data-sb]').forEach(c => c.checked = st.sel.includes(c.dataset.sb)); selN(); draw(true); }));
  $('#cpNone').addEventListener('click', () => { st.sel = []; $$('[data-sb]').forEach(c => c.checked = false); selN(); draw(true); });
  $('#cpGo').addEventListener('click', doPrint);
  per(); selN(); draw(true);
}

let map = null, view = null, tilesBusy = 0;
function size() { return st.kertas === 'A3' ? { W: 410, H: 287 } : { W: 287, H: 200 }; } // area cetak (mm) setelah margin 5 mm
function draw(refit) {
  const w = $('#plw'); if (!w) return; const { W, H } = size(), side = st.kertas === 'A3' ? 105 : 80;
  if (map && !refit) view = { c: map.getCenter(), z: map.getZoom() }; else view = null;
  if (map) { map.remove(); map = null; }
  w.innerHTML = `<div class="pl" id="pl" style="width:${W}mm;height:${H}mm;grid-template-columns:1fr ${side}mm">
    <div class="pl-map"><div id="plm"></div><svg id="plg" class="pl-grid"></svg></div>
    <div class="pl-side" id="pls"></div></div>`;
  const pl = $('#pl'); const fit = () => { const k = w.clientWidth / pl.offsetWidth; pl.style.transform = `scale(${Math.min(1, k)})`; w.style.height = pl.offsetHeight * Math.min(1, k) + 'px'; };
  fit(); window.removeEventListener('resize', draw._f || (() => {})); draw._f = fit; window.addEventListener('resize', fit);
  const { rows } = compute(); const col = {}; rows.forEach((x, i) => { col[x.b.id] = PAL[i % PAL.length]; });
  map = window.L.map('plm', { zoomControl: true, attributionControl: false, zoomSnap: 0, zoomDelta: 0.5, preferCanvas: false });
  tilesBusy = 0; const track = lay => { lay.on('loading', () => { tilesBusy++; }); lay.on('load', () => { tilesBusy = Math.max(0, tilesBusy - 1); }); return lay; };
  if (st.lay.online) track(window.L.tileLayer(SAT_URL, { maxNativeZoom: 18, maxZoom: 22, crossOrigin: true })).addTo(map);
  SLOTS.forEach(([k], i) => { const o = ORTHO[k]; if (!o || !st.lay[k]) return; const [ww, so, e, n] = o.bounds; track(window.L.tileLayer(orthoUrl(k), { maxNativeZoom: o.maxzoom, minNativeZoom: o.minzoom, maxZoom: 22, bounds: [[so, ww], [n, e]], zIndex: 10 + i })).addTo(map); });
  const all = window.L.featureGroup().addTo(map), selG = window.L.featureGroup().addTo(map);
  S.blok.forEach(b => { if (!b.geom) return; const on = col[b.id];
    const g = window.L.geoJSON(b.geom, { style: { color: on ? '#222' : '#fff', weight: on ? 1.1 : 0.8, fillColor: on || '#fff', fillOpacity: on ? 0.62 : 0, opacity: on ? 1 : 0.85 } }).addTo(on ? selG : all);
    if (on || (st.label && b.nama)) g.bindTooltip(`${esc(b.nama || G.blokName(b))}<br>${fmt(b.ha, 2)} Ha`, { permanent: true, direction: 'center', className: 'pl-lbl' + (on ? ' on' : '') }); });
  const target = rows.length ? selG : all;
  if (view) map.setView(view.c, view.z, { animate: false }); else if (target.getLayers().length) map.fitBounds(target.getBounds(), { padding: [18, 18], animate: false }); else map.setView([-0.99, 115.06], 15);
  if (st.skala && !view) applyScale(true);
  map.on('moveend zoomend', () => { if (st.skala && Math.abs(scaleRaw() - st.skala) / st.skala > 0.01) { st.skala = null; const i = $('#cpS'); if (i) i.value = ''; } grid(); drawPanel(); });
  grid(); drawPanel();
}
// skala manual: atur zoom agar 1 mm di kertas = skala/1000 m di lapangan (cetak 100%)
const scaleRaw = () => { const c = map.getSize(), y = c.y / 2; return map.containerPointToLatLng([c.x / 2 - 50, y]).distanceTo(map.containerPointToLatLng([c.x / 2 + 50, y])) / 100 / 0.000264583; };
function applyScale(silent) {
  if (!map) return; if (!st.skala) { if (!silent) draw(true); return; }
  const c = map.getCenter(), z = Math.log2(156543.03392 * Math.cos(c.lat * Math.PI / 180) / (st.skala * 0.000264583));
  map.setView(c, z, { animate: false });
}
function nice(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function grid() {
  const svg = $('#plg'), el = $('#plm'); if (!svg || !map) return;
  const w = svg.clientWidth || svg.parentNode.clientWidth, h = svg.parentNode.clientHeight, ox = el.offsetLeft, oy = el.offsetTop, mw = el.clientWidth, mh = el.clientHeight;
  const b = map.getBounds(), [e0, n0] = utm(b.getSouth(), b.getWest()), [e1, n1] = utm(b.getNorth(), b.getEast());
  const step = nice(Math.max(e1 - e0, n1 - n0) / 4), out = [];
  for (let E = Math.ceil(e0 / step) * step; E < e1; E += step) { const lat = (b.getSouth() + b.getNorth()) / 2, pt = map.latLngToContainerPoint(utmInv(E, utm(lat, b.getCenter().lng)[1])); const x = ox + pt.x; if (pt.x < 4 || pt.x > mw - 4) continue;
    out.push(`<line x1="${x}" x2="${x}" y1="${oy}" y2="${oy + mh}" class="gl"/><text x="${x}" y="${oy - 4}" text-anchor="middle">${Math.round(E)}</text><text x="${x}" y="${oy + mh + 11}" text-anchor="middle">${Math.round(E)}</text>`); }
  for (let N = Math.ceil(n0 / step) * step; N < n1; N += step) { const pt = map.latLngToContainerPoint(utmInv(utm(b.getCenter().lat, b.getCenter().lng)[0], N)); const y = oy + pt.y; if (pt.y < 4 || pt.y > mh - 4) continue;
    out.push(`<line y1="${y}" y2="${y}" x1="${ox}" x2="${ox + mw}" class="gl"/><text x="${ox - 4}" y="${y}" text-anchor="middle" transform="rotate(-90 ${ox - 4} ${y})">${Math.round(N)}</text><text x="${ox + mw + 4}" y="${y}" text-anchor="middle" transform="rotate(90 ${ox + mw + 4} ${y})">${Math.round(N)}</text>`); }
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.innerHTML = out.join('');
}
function scaleInfo() {
  const el = $('#plm'); const c = map.getSize(), y = c.y / 2, d = map.containerPointToLatLng([c.x / 2 - 50, y]).distanceTo(map.containerPointToLatLng([c.x / 2 + 50, y])) / 100; // meter per px CSS
  const ratio = d / 0.000264583; const den = st.skala || Math.round(ratio / 100) * 100;
  const target = (st.kertas === 'A3' ? 70 : 52) / 0.264583 * d; // panjang bar ±52 mm
  const seg = nice(target / 4), segPx = seg / d; void el;
  return { den, seg, segPx };
}
function drawPanel() {
  const side = $('#pls'); if (!side || !map) return;
  const { rows, judul, r } = compute(), sc = scaleInfo(), tot = rows.reduce((a, x) => a + Number(x.b.ha || 0), 0);
  const many = rows.length > 14, max = st.kertas === 'A3' ? 36 : 20, show = rows.slice(0, max);
  const bar = [0, 1, 2, 4].map(k => k * sc.seg), bw = sc.segPx * 4;
  side.innerHTML = `<div class="pl-box pl-title">${judul.split('\n').map(l => `<div>${esc(l)}</div>`).join('')}${r ? `<small>${tglS(r.a)} – ${tglS(r.b)}</small>` : ''}</div>
    <div class="pl-box pl-na"><svg viewBox="0 0 60 60" class="pl-north"><circle cx="30" cy="32" r="13" fill="none" stroke="#000" stroke-width="1.2"/><path d="M30 8 L35 32 L30 28 L25 32Z" fill="#000"/><path d="M30 56 L35 32 L30 36 L25 32Z" fill="#fff" stroke="#000" stroke-width="1"/><path d="M6 32 L30 27 L30 37Z" fill="#fff" stroke="#000" stroke-width="1"/><path d="M54 32 L30 27 L30 37Z" fill="#000"/><text x="30" y="7" text-anchor="middle" font-size="7" font-weight="700">U</text></svg>
      <svg class="pl-sb" viewBox="-6 0 ${bw + 22} 26" style="width:${(bw + 28) * 0.264583}mm">${[0, 1, 2].map(i => { const x0 = sc.segPx * [0, 1, 2][i], x1 = sc.segPx * [1, 2, 4][i]; return `<rect x="${x0}" y="4" width="${x1 - x0}" height="5" fill="${i % 2 ? '#fff' : '#000'}" stroke="#000" stroke-width=".8"/>`; }).join('')}
        ${bar.map((v, i) => `<text x="${sc.segPx * [0, 1, 2, 4][i]}" y="18" text-anchor="middle" font-size="7">${fmt(v)}</text>`).join('')}<text x="${bw / 2}" y="25" text-anchor="middle" font-size="6.5">Meter</text></svg>
      <div class="pl-sc">Skala 1 : ${fmt(sc.den)} <small>(dicetak 100%)</small></div></div>
    <div class="pl-box pl-leg"><b>Keterangan</b>
      <table class="${many ? 'sm' : ''}"><thead><tr><th>No</th><th></th><th>Blok</th><th>Luas (Ha)</th><th>Ket.</th></tr></thead><tbody>
      ${show.map((x, i) => `<tr><td>${i + 1}</td><td><i style="background:${PAL[i % PAL.length]}"></i></td><td>${esc(x.b.nama || G.blokName(x.b))}</td><td class="r">${fmt(x.b.ha, 2)}</td><td>${esc(x.ket)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Tidak ada blok pada periode ini</td></tr>'}
      ${rows.length > max ? `<tr><td colspan="5" class="muted">+ ${rows.length - max} blok lain</td></tr>` : ''}
      <tr class="tt"><td colspan="3">Jumlah ${rows.length} blok</td><td class="r">${fmt(tot, 2)}</td><td></td></tr></tbody></table>
      <div class="pl-meta">Sistem koordinat WGS 84 / UTM zona 50S<br>Citra: ${[...SLOTS.filter(([k]) => ORTHO[k] && st.lay[k]).map(([k]) => `drone ${k} ${ORTHO[k].tanggal || ''}`), ...(st.lay.online ? ['Esri World Imagery'] : [])].join(', ') || '–'}<br>Dicetak ${tglS(G.tglWIB(new Date().toISOString()))} · ${esc(S.me?.nama || '')}</div></div>
    <div class="pl-box pl-logo"><img src="img/logo.svg" alt="PT Hamparan Mulya"></div>`;
}
async function doPrint() {
  if (!map) return; const btn = $('#cpGo'); btn.disabled = true; btn.textContent = 'Menunggu citra termuat…';
  const t0 = Date.now(); while (tilesBusy > 0 && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 300));
  const pl = $('#pl'), w = $('#plw'), tf = pl.style.transform, hh = w.style.height;
  const css = document.createElement('style'); css.id = 'plPage'; css.textContent = `@page{size:${st.kertas} landscape;margin:5mm}`; document.head.appendChild(css);
  document.body.classList.add('print-peta'); pl.style.transform = 'none'; w.style.height = 'auto';
  const done = () => { document.body.classList.remove('print-peta'); css.remove(); pl.style.transform = tf; w.style.height = hh; btn.disabled = false; btn.textContent = 'Cetak / simpan PDF'; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 150);
  if (tilesBusy > 0) toast('Sebagian citra belum termuat; hasil cetak mungkin ada bagian kosong.', 4000);
}
