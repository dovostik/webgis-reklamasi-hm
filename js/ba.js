// Berita acara: persetujuan owner, terbit nomor, tanda tangan elektronik, arsip foto (asli dihapus); cetak tag QR.
import { SB } from './sb.js';
import { S, L, ins, upd, $, $$, toast, confirmSheet, uid, nm, pickFile, fileUrl } from './core.js';
import * as G from './logic.js';
import { isRole, seesBlok, seesBA } from './app.js';
const { esc, fmt, tgl, jam } = G;

const JUDUL = { PP: 'BERITA ACARA PENYELESAIAN PEKERJAAN', KP: 'BERITA ACARA KEBERHASILAN PENILAIAN', KPR: 'BERITA ACARA KEBERHASILAN PENILAIAN RETENSI', SO: 'BERITA ACARA STOCK OPNAME' };
const KODE = { PP: 'PP', KP: 'KP', KPR: 'KPR', SO: 'SO' };
const byJab = re => S.profiles.find(p => p.aktif !== false && re.test(p.jabatan || ''));
const signer = (re, jab) => { const p = byJab(re); return { nama: p?.nama || '……………………', jabatan: jab }; };
const vendorSigner = v => { const p = S.profiles.find(x => x.role === v && x.aktif !== false); return { nama: p?.nama || '……………………', jabatan: p?.jabatan || (v === 'exdas' ? 'Pelaksana ExDAS' : 'Ketua BUMDES') }; };

// ---------- arsip foto: salinan ringkas disimpan di BA, file asli dihapus ----------
async function archivePhotos(items) {
  const out = [];
  for (const it of items) {
    try {
      const url = await fileUrl('foto', it.path); const r = await fetch(url); const bl = await r.blob(); const bm = await createImageBitmap(bl);
      const k = Math.min(1, 1000 / Math.max(bm.width, bm.height)); const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); out.push({ ...it, src: c.toDataURL('image/jpeg', 0.6) });
    } catch (e) { out.push({ ...it, src: null }); }
  }
  return out;
}
const stamp = at => ({ at: at || new Date().toISOString() });
function signers(p, extra = {}) {
  const now = new Date().toISOString(), appr = { id: S.me.id, at: now };
  const sesiList = S.sesi.filter(s => s.periode_id === p.id && s.selesai_at);
  const glP = S.profMap[p.hasil?.gl?.id] || (sesiList.length ? S.profMap[sesiList[sesiList.length - 1].oleh] : null);
  const vendAt = extra.vendorAt || p.hasil?.diajukan?.at || p.vendor_selesai_at || now;
  const glAt = (p.tipe === 'cek1' && p.hasil?.diajukan?.at) || p.hasil?.gl?.at || sesiList[sesiList.length - 1]?.selesai_at || now;
  return {
    approver: appr,
    ttd: { dibuat: { ...signer(/spv/i, 'SPV Reklamasi'), ...stamp(now) }, vendor: { ...vendorSigner(p.vendor), ...stamp(vendAt) }, gl: { nama: glP?.nama || '……………………', jabatan: 'GL Reklamasi', ...stamp(glAt) }, rs: { ...signer(/suptend|superintend/i, 'Reclamation Suptend'), ...stamp(now) }, ktt: { ...signer(/ktt|kepala teknik/i, 'KTT PT Hamparan Mulya'), ...stamp(now) } }
  };
}
async function issue(p, b, jenis, base) {
  const unit = p.vendor === 'exdas' ? 'TEWEH' : 'BUMDES';
  const td = G.toDate(G.today()), rom = G.ROM[td.getUTCMonth()], th = td.getUTCFullYear(); const ids = [];
  for (const j of jenis) {
    const n = await SB.rpc('next_number', { p_name: `ba-${unit}-${th}`, p_n: 1 });
    const nomor = `${String(n).padStart(3, '0')}/HM/BA/${KODE[j]}/${unit}/${rom}/${th}`;
    const id = uid(); ids.push(id);
    await ins('ba', { id, jenis: j, unit, nomor, blok_id: b.id, periode_id: p.id, data: base, created_by: S.me.id, confirmed_by: S.me.id, confirmed_at: new Date().toISOString() }, { offline: false });
  }
  return ids;
}
function baseData(p, b) {
  const tanam = {}; S.tampung_log.filter(l => l.blok_id === b.id && l.tipe === 'tanam').forEach(l => { tanam[l.jenis] = (tanam[l.jenis] || 0) + l.n; });
  const sulam = {}; S.tag_event.filter(e => e.tipe === 'sulam' && S.tag.find(t => t.id === e.tag_id && t.periode_id === p.id)).forEach(e => { sulam[e.jenis] = (sulam[e.jenis] || 0) + 1; });
  return {
    blok: { id: b.id, nama: G.blokName(b), ha: b.ha, pit: b.pit, kode_bastl: b.kode_bastl, no_bastl: b.no_bastl, geom: b.geom },
    periode: { tipe: p.tipe, nomor: p.nomor, vendor: p.vendor, mulai_at: p.mulai_at, vendor_selesai_at: p.vendor_selesai_at || p.pp?.diajukan_at },
    pct: p.pct, rows: p.hasil?.rows, tanggal: G.today(), tanam, sulam, realisasi: L.realisasi(b),
    umur: b.tgl_tanam ? G.diffDays(G.today(), b.tgl_tanam) : null, esign: true,
    mat: (() => { const m = {}; (S.kirim_mat || []).filter(k => k.periode_id === p.id && k.status === 'diterima').forEach(k => { const sat = L.MAT[k.kel].sat; const v = (Number(k.n) - Number(k.sisa || 0)) * L.unitK(S.barang.find(x => x.nama === k.barang)?.satuan, sat); m[k.kel] = (m[k.kel] || 0) + v; }); return m; })()
  };
}
// ExDAS: BA Penyelesaian Pekerjaan diajukan vendor dengan 4 foto kegiatan
export async function approvePP(p) {
  const b = S.blokMap[p.blok_id];
  if (!(await confirmSheet(`Setujui BA Penyelesaian Pekerjaan ${esc(G.blokName(b))}? BA terbit dengan tanda tangan elektronik semua pihak. Foto asli diarsipkan ringkas di BA lalu dihapus dari penyimpanan.`, 'Setujui & terbitkan'))) return;
  try {
    toast('Menerbitkan BA…', 8000);
    const fotos = await archivePhotos((p.pp?.foto || []).map((path, i) => ({ path, label: G.PP_FOTO[i], ...(p.pp?.meta?.[i] || {}) })));
    const base = { ...baseData(p, b), ...signers(p, { vendorAt: p.pp?.diajukan_at }), foto: fotos.map(({ path, ...x }) => x), periode: { ...baseData(p, b).periode, vendor_selesai_at: p.pp?.diajukan_at } };
    const ids = await issue(p, b, ['PP'], base);
    await upd('periode', { id: p.id }, { status: 'siap_inspeksi', pp: { ...p.pp, approved_at: new Date().toISOString(), approved_by: S.me.id, ba_id: ids[0] } }, { offline: false });
    const paths = (p.pp?.foto || []).filter(Boolean); if (paths.length) await SB.remove('foto', paths).catch(() => {});
    toast('BA PP terbit. GL owner bisa mengecek 7 hari lagi.'); location.hash = '#ba/' + ids[0];
  } catch (e) { toast(e.message, 5000); }
}
export async function approvePeriode(p) {
  const b = S.blokMap[p.blok_id];
  if (!p.hasil?.final) return toast('Hasil belum ≥ 90%. BA tidak bisa terbit.');
  if (L.openGL(p).length) return toast('Masih ada tag GL yang belum disulam vendor.');
  if (!(await confirmSheet(`Setujui hasil ${fmt(p.pct, 2)}% di ${esc(G.blokName(b))} dan terbitkan BA dengan tanda tangan elektronik? Foto inspeksi asli diarsipkan ringkas di BA lalu dihapus dari penyimpanan.`, 'Setujui & terbitkan'))) return;
  try {
    toast('Menerbitkan BA…', 8000);
    // ExDAS: PP sudah terbit di awal → cek1 = KP saja, retensi = KPR. BUMDES: PP + KP.
    const jenis = p.tipe === 'retensi' ? ['KPR'] : p.vendor === 'exdas' ? ['KP'] : ['PP', 'KP'];
    const sesiList = S.sesi.filter(s => s.periode_id === p.id && s.selesai_at);
    const items = sesiList.flatMap(s => (s.foto || []).map(path => { const ts = +(/-(\d{12,})\./.exec(path)?.[1] || 0); const near = (s.track || []).reduce((best, q) => !best || Math.abs(q[3] - ts) < Math.abs(best[3] - ts) ? q : best, null); return { path, label: 'Foto inspeksi', at: ts ? new Date(ts).toISOString() : null, lat: near?.[1], lon: near?.[0] }; }));
    const fotos = await archivePhotos(items);
    const base = { ...baseData(p, b), ...signers(p), sesi: sesiList.map(s => s.id), foto: fotos.map(({ path, ...x }) => x) };
    const ids = await issue(p, b, jenis, base);
    await upd('periode', { id: p.id }, { status: 'selesai' }, { offline: false });
    const paths = items.map(x => x.path); if (paths.length) { await SB.remove('foto', paths).catch(() => {}); for (const s of sesiList) await upd('sesi', { id: s.id }, { foto: [] }, { offline: false }).catch(() => {}); }
    if (p.tipe === 'cek1') await ins('periode', { id: uid(), blok_id: b.id, tipe: 'retensi', nomor: 1, vendor: 'exdas', status: 'pelaksanaan', mulai_at: new Date().toISOString() });
    if (p.tipe === 'retensi') await upd('blok', { id: b.id }, { tgl_tanam: G.today(), layer: 'perawatan', asal_bastl: true }); // penanaman closed: blok diserahkan ke perawatan BUMDES
    if (p.tipe === 'rotasi') await upd('blok', { id: b.id }, { tgl_rotasi_terakhir: G.today() });
    toast(`BA terbit: ${jenis.join(' + ')}.`);
    location.hash = '#ba/' + ids[0];
  } catch (e) { toast(e.message, 5000); }
}

// ---------- daftar BA ----------
export function renderBAList(shell) {
  const wait = S.periode.filter(p => ['menunggu_persetujuan', 'pp_diajukan'].includes(p.status) && seesBlok(S.blokMap[p.blok_id]) && (!isRole('exdas', 'bumdes') || isRole(p.vendor)));
  const list = S.ba.filter(seesBA).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  shell('Berita acara', null, `<div class="stack">
    ${wait.length ? `<div class="card stack"><h2>Menunggu persetujuan owner (${wait.length})</h2><div class="list">${wait.map(p => `<a class="item" href="#blok/${encodeURIComponent(p.blok_id)}"><div class="grow"><b>${esc(G.blokName(S.blokMap[p.blok_id]))} · ${p.status === 'pp_diajukan' ? 'BA Penyelesaian Pekerjaan' : G.TIPE_LBL[p.tipe]}</b><span>${p.status === 'pp_diajukan' ? 'Diajukan ExDAS ' + tgl(p.pp?.diajukan_at) : `Hasil ${fmt(p.pct, 2)}% ${p.hasil?.final ? '· siap disetujui' : ''}`}</span></div>${isRole('admin') ? '<span class="pill s-warn">Setujui</span>' : ''}</a>`).join('')}</div></div>` : ''}
    <div class="card stack"><h2>Arsip BA (${list.length})</h2>${list.length ? `<div class="list">${list.map(a => `<a class="item" href="#ba/${a.id}"><div class="grow"><b>BA ${esc(a.jenis)} · ${esc(a.data?.blok?.nama || '')}</b><span class="mono">${esc(a.nomor)}</span><span>${tgl(a.created_at)}</span></div><span class="pill ${a.data?.esign || a.confirmed_at ? 's-ok' : a.scan_path ? 's-pend' : 's-idle'}">${a.data?.esign ? 'Final · TTE' : a.confirmed_at ? 'Final' : a.scan_path ? 'Scan diunggah' : 'Perlu ttd'}</span></a>`).join('')}</div>` : '<p class="muted small" style="margin:0">Belum ada BA. BA terbit setelah hasil ≥ 90%, semua tag GL disulam, dan disetujui owner.</p>'}</div></div>`);
}

// ---------- dokumen ----------
const kop = () => `<div class="kop"><img src="img/logo.svg" alt="PT Hamparan Mulya"><small>PT HAMPARAN MULYA · Site Muara Teweh<br>Departemen Reklamasi &amp; Rehabilitasi</small></div>`;
const ttdBox = (cols, items) => `<div class="ttd" style="grid-template-columns:repeat(${cols},1fr)">${items.map(([lbl, s]) => `<div>${lbl}<br>${esc(s.jabatan)}${s.at ? `<em class="esign">✓ Ditandatangani elektronik<br>${tgl(s.at)} ${jam(s.at)} WIB</em>` : ''}<span${s.at ? ' class="es"' : ''}>${esc(s.nama)}</span></div>`).join('')}</div>`;
function sensusTbl(rows) {
  return `<table class="g"><thead><tr><th rowspan="2">Jalur</th><th colspan="3">Jumlah tanaman (pohon)</th><th rowspan="2">Keberhasilan</th></tr><tr><th>Realisasi</th><th>Mati</th><th>Hidup</th></tr></thead><tbody>${rows.map(r => `<tr${r.n === 'Jumlah' ? ' style="font-weight:700"' : ''}><td>${esc(r.n)}</td><td style="text-align:right">${fmt(r.r)}</td><td style="text-align:right">${fmt(r.m)}</td><td style="text-align:right">${fmt(r.h)}</td><td style="text-align:right">${fmt(r.p, 2)}%</td></tr>`).join('')}</tbody></table>`;
}
function idTbl(d, extra = []) {
  const v = d.periode.vendor === 'exdas' ? 'ExDAS (Pelaksana Penanaman)' : 'BUMDES (Pelaksana Perawatan)';
  const rows = [['Lokasi / blok', d.blok.nama], ['Pit', d.blok.pit || '–'], ['Luas', fmt(d.blok.ha, 2) + ' Ha'], ...(d.blok.kode_bastl ? [['Kode BASTL', d.blok.kode_bastl + (d.blok.no_bastl ? ' (' + d.blok.no_bastl + ')' : '')]] : []), ['Pelaksana', v], ...extra];
  return `<table class="id">${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>: ${esc(b)}</td></tr>`).join('')}</table>`;
}
const hariTgl = s => { const d = G.toDate(s); return `${G.HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${G.BLN_PANJANG[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
function bodyPP(a) {
  const d = a.data;
  if (d.periode.vendor === 'exdas') {
    const ha = d.blok.ha, n = G.needs(ha), rl = d.realisasi;
    const keg = [['Pemasangan ajir', fmt(n.lubang), 'batang'], ['Pembuatan lubang tanam', fmt(n.lubang), 'lubang'], ['Pemberian pupuk dasar (kohe 2 kg/lubang)', fmt(d.mat?.kohe != null ? d.mat.kohe * G.STD.kohe : n.pupuk), 'kg'], ['Penanaman tanaman pioneer (4×4 m)', fmt(rl.pio), 'pohon'], ['Penanaman tanaman sisipan (6×8 m)', fmt(rl.sis), 'pohon'], ['Pemupukan NPK (50 g/pohon)', fmt(n.npk), 'kg'], ['Penaburan LCC / cover crop', fmt(d.mat?.lcc != null ? d.mat.lcc : n.lcc, 1), 'kg']];
    return `<p>Pada hari ini ${hariTgl(d.tanggal)}, telah diselesaikan pekerjaan penanaman reklamasi dengan rincian:</p>${idTbl(d, [['Mulai', tgl(d.periode.mulai_at)], ['Lapor selesai', tgl(d.periode.vendor_selesai_at)]])}
      <table class="g" style="margin-top:10px"><thead><tr><th>No</th><th>Kegiatan</th><th>Volume</th><th>Satuan</th></tr></thead><tbody>${keg.map((k, i) => `<tr><td>${i + 1}</td><td>${k[0]}</td><td style="text-align:right">${k[1]}</td><td>${k[2]}</td></tr>`).join('')}</tbody></table>
      ${Object.keys(d.tanam || {}).length ? `<p style="margin-bottom:4px">Rincian jenis tertanam:</p><table class="g"><thead><tr><th>Jenis</th><th>Jumlah</th></tr></thead><tbody>${Object.entries(d.tanam).map(([k, v]) => `<tr><td>${esc(S.jenisMap[k]?.nama || k)}</td><td style="text-align:right">${fmt(v)}</td></tr>`).join('')}</tbody></table>` : ''}
      <p>Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.</p>${ttdBox(2, [['Dibuat oleh,', d.ttd.dibuat], ['Pelaksana,', d.ttd.vendor]])}${ttdBox(2, [['Mengetahui,', d.ttd.rs], ['Mengetahui,', d.ttd.ktt]])}`;
  }
  const n = G.needs(d.blok.ha); const keg = d.umur != null && d.umur >= 365 ? 'Penyiangan' : 'Pendangiran';
  return `<p>Pada hari ini ${hariTgl(d.tanggal)}, telah diselesaikan pekerjaan perawatan tanaman reklamasi rotasi ke-${d.periode.nomor} dengan rincian:</p>${idTbl(d, [['Rotasi ke', String(d.periode.nomor)], ['Mulai', tgl(d.periode.mulai_at)], ['Lapor selesai', tgl(d.periode.vendor_selesai_at)]])}
    <table class="g" style="margin-top:10px"><thead><tr><th>No</th><th>Kegiatan</th><th>Volume</th><th>Satuan</th></tr></thead><tbody><tr><td>1</td><td>${keg}</td><td style="text-align:right">${fmt(d.blok.ha, 2)}</td><td>Ha</td></tr><tr><td>2</td><td>Pemupukan NPK (50 g/pohon)</td><td style="text-align:right">${fmt(d.mat?.npk != null ? d.mat.npk : n.npk, 1)}</td><td>kg</td></tr><tr><td>3</td><td>Penyulaman</td><td style="text-align:right">${fmt(Object.values(d.sulam || {}).reduce((x, y) => x + y, 0))}</td><td>pohon</td></tr></tbody></table>
    ${Object.keys(d.sulam || {}).length ? `<p style="margin-bottom:4px">Rincian sulam per jenis:</p><table class="g"><thead><tr><th>Jenis</th><th>Jumlah</th></tr></thead><tbody>${Object.entries(d.sulam).map(([k, v]) => `<tr><td>${esc(S.jenisMap[k]?.nama || k)}</td><td style="text-align:right">${fmt(v)}</td></tr>`).join('')}</tbody></table>` : ''}
    <p>Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.</p>${ttdBox(2, [['Dibuat oleh,', d.ttd.dibuat], ['Pelaksana,', d.ttd.vendor]])}${ttdBox(2, [['Mengetahui,', d.ttd.rs], ['Mengetahui,', d.ttd.ktt]])}`;
}
function bodyKP(a) {
  const d = a.data; const ret = a.jenis === 'KPR';
  const ttdTop = d.periode.vendor === 'bumdes' ? ttdBox(3, [['Dibuat oleh,', d.ttd.dibuat], ['Disetujui,', d.ttd.vendor], ['Diperiksa,', d.ttd.gl]]) : ttdBox(2, [['Dibuat oleh,', d.ttd.dibuat], ['Disetujui,', d.ttd.vendor]]);
  return `<p>Pada hari ini ${hariTgl(d.tanggal)}, telah dilakukan penilaian keberhasilan tanaman${ret ? ' masa retensi' : ''} dengan metode sensus (penyapuan seluruh jalur, pencatatan tanaman mati) pada:</p>${idTbl(d)}
    <p style="margin-bottom:4px">Hasil sensus:</p>${sensusTbl(d.rows)}
    <p>Dengan persentase keberhasilan <b>${fmt(d.pct, 2)}%</b> (≥ ${G.STD.ambang}%), pekerjaan dinyatakan <b>BERHASIL</b>${ret ? ' dan masa retensi selesai' : ''}. Seluruh tanaman mati hasil inspeksi telah disulam dan diverifikasi.</p>
    <p>Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.</p>${ttdTop}${ttdBox(2, [['Mengetahui,', d.ttd.rs], ['Mengetahui,', d.ttd.ktt]])}`;
}
function mapSVG(d, tags, tracks) {
  const rings = [];
  const g = d.blok.geom; const polys = g ? (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) : [];
  polys.forEach(pl => pl.forEach(r => rings.push(r)));
  // batas peta = blok + titik tag; jejak GPS di luar batas dipotong, tidak memperkecil peta
  const pts = [...rings.flat(), ...tags.filter(t => t.lon).map(t => [t.lon, t.lat])];
  if (!pts.length) tracks.forEach(t => pts.push(...t.pts));
  if (!pts.length) return '<p class="small">Tidak ada geometri.</p>';
  const lat0 = pts.reduce((a, p) => a + p[1], 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180), m = 40 / 111320;
  const xs = pts.map(p => p[0] * k), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - m * k, x1 = Math.max(...xs) + m * k, y0 = Math.min(...ys) - m, y1 = Math.max(...ys) + m;
  const W = 700, H = 460, pad = 16, s = Math.min((W - 2 * pad) / (x1 - x0 || 1e-6), (H - 2 * pad) / (y1 - y0 || 1e-6));
  const P = p => [(pad + (p[0] * k - x0) * s).toFixed(1), (pad + (y1 - p[1]) * s).toFixed(1)];
  const mPer = 111320 * k; const bar = [10, 20, 50, 100, 200, 500].find(q => q * s / mPer > 60) || 500;
  const col = { mati: '#E0473B', disulam: '#4F86C6', closed: '#2F8A57', foto: '#7B3FA0' };
  const inView = p => { const [x, y] = P(p).map(Number); return x > -60 && x < W + 60 && y > -60 && y < H + 60; };
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;border:1px solid #999;background:#fafaf7" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="cpm"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#cpm)">
    ${rings.map(r => `<polygon points="${r.map(p => P(p).join(',')).join(' ')}" fill="#E8F0DC" stroke="#111" stroke-width="1.5"/>`).join('')}
    ${tracks.map(t => { const q = t.pts.filter(inView); return q.length ? `<polyline points="${q.map(p => P(p).join(',')).join(' ')}" fill="none" stroke="${t.c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".9"/>${q.map(p => { const [x, y] = P(p); return `<circle cx="${x}" cy="${y}" r="2" fill="${t.c}"/>`; }).join('')}` : ''; }).join('')}
    ${tags.filter(t => t.lon).map(t => { const [x, y] = P([t.lon, t.lat]); return `<circle cx="${x}" cy="${y}" r="4.5" fill="${col[t.status] || '#E0473B'}" stroke="#fff" stroke-width="1.2"/>`; }).join('')}</g>
    <g transform="translate(${W - pad - 10},${pad + 6})"><path d="M0 18 L6 0 L12 18 L6 13 Z" fill="#111"/><text x="6" y="30" font-size="11" text-anchor="middle" font-family="Arial">U</text></g>
    <g transform="translate(${pad},${H - pad})"><rect width="${(bar * s / mPer).toFixed(1)}" height="5" fill="#111"/><text y="-4" font-size="10" font-family="Arial">${bar} m</text></g></svg>`;
}
const fotoGrid = list => `<div class="fotos">${list.map(f => `<figure>${f.src ? `<img src="${f.src}" alt="${esc(f.label || 'Foto')}">` : f.path ? `<img data-foto="${esc(f.path)}" alt="${esc(f.label || 'Foto')}">` : '<div class="small">foto tidak tersedia</div>'}<figcaption>${esc(f.label || '')}${f.at ? ' · ' + tgl(f.at) + ' ' + jam(f.at) : ''}${f.lat ? ` · ${(+f.lat).toFixed(6)}, ${(+f.lon).toFixed(6)}` : ''}</figcaption></figure>`).join('')}</div>`;
function lampiranPP(a) {
  const d = a.data; const qrTxt = `${a.nomor}|${d.blok.nama}|PP|${a.id}`;
  return `<div class="doc pgbreak">${kop()}<h4>LAMPIRAN</h4><p class="nomor">${esc(a.nomor)}</p>
    <p style="margin:0 0 6px"><b>1. Peta blok dan lokasi foto</b></p>${mapSVG(d, (d.foto || []).filter(f => f.lon).map(f => ({ lon: f.lon, lat: f.lat, status: 'foto' })), [])}${(d.foto || []).some(f => f.lon) ? '<p class="small" style="font-family:Arial;font-size:10px;margin:4px 0"><span style="color:#7B3FA0">●</span> lokasi foto kegiatan (GPS foto)</p>' : ''}
    <p style="margin:10px 0 4px"><b>2. Foto kegiatan penanaman</b></p>${d.foto?.length ? fotoGrid(d.foto) : '<p class="small">Tidak ada foto.</p>'}
    <div style="display:flex;gap:12px;align-items:center;margin-top:12px"><div id="baqr" data-qr="${esc(qrTxt)}"></div><p class="small" style="font-family:Arial;font-size:10px;margin:0">Kode verifikasi dokumen<br>${esc(a.nomor)}<br>ID ${esc(a.id)}</p></div></div>`;
}
const DAYC = ['#1F6FB5', '#D9822B', '#7B3FA0', '#2A9D8F', '#C2185B', '#6D4C41', '#455A64'];
function lampiran(a) {
  const d = a.data; const sesiList = (d.sesi || []).map(id => S.sesi.find(s => s.id === id)).filter(Boolean);
  const tags = S.tag.filter(t => t.periode_id === a.periode_id && t.blok_id === d.blok.id);
  const days = {}; sesiList.forEach(s => (s.track || []).forEach(p => { const k = G.tglWIB(new Date(p[3]).toISOString()); (days[k] = days[k] || []).push([p[0], p[1]]); }));
  const tracks = Object.keys(days).sort().map((k, i) => ({ day: k, pts: days[k], c: DAYC[i % DAYC.length] }));
  const dead = {}; tags.forEach(t => { const e = S.tag_event.find(x => x.tag_id === t.id && x.tipe === 'mati'); const j = e?.jenis || '–'; dead[j] = (dead[j] || 0) + 1; });
  const fotos = sesiList.flatMap(s => (s.foto || []).map(path => ({ path, s })));
  const qrTxt = `${a.nomor}|${d.blok.nama}|${fmt(d.pct, 2)}%|${a.id}`;
  return `<div class="doc pgbreak">${kop()}<h4>LAMPIRAN</h4><p class="nomor">${esc(a.nomor)}</p>
    <p style="margin:0 0 6px"><b>1. Peta jejak penyapuan dan titik tag</b></p>${mapSVG(d, tags, tracks)}
    <p class="small" style="font-family:Arial;font-size:10px;margin:4px 0">${tracks.map(t => `<span style="display:inline-block;margin-right:10px"><i style="display:inline-block;width:14px;height:3px;background:${t.c};vertical-align:middle"></i> ${tgl(t.day)}</span>`).join('')}<span style="color:#E0473B">●</span> mati &nbsp;<span style="color:#4F86C6">●</span> disulam &nbsp;<span style="color:#2F8A57">●</span> closed</p>
    <p style="margin:10px 0 4px"><b>2. Rekap tanaman mati per jenis</b></p><table class="g"><thead><tr><th>Jenis mati</th><th>Titik</th></tr></thead><tbody>${Object.entries(dead).map(([k, v]) => `<tr><td>${esc(S.jenisMap[k]?.nama || k)}</td><td style="text-align:right">${v}</td></tr>`).join('') || '<tr><td colspan="2">Tidak ada</td></tr>'}</tbody></table>
    ${Object.keys(d.sulam || {}).length ? `<p style="margin:10px 0 4px"><b>Jenis bibit penyulaman</b></p><table class="g"><tbody>${Object.entries(d.sulam).map(([k, v]) => `<tr><td>${esc(S.jenisMap[k]?.nama || k)}</td><td style="text-align:right">${v}</td></tr>`).join('')}</tbody></table>` : ''}
    <p style="margin:10px 0 4px"><b>3. Daftar titik</b></p><table class="g"><thead><tr><th>Tag</th><th>Sumber</th><th>Jalur</th><th>Kondisi</th><th>Koordinat</th><th>Status</th></tr></thead><tbody>${tags.map(t => `<tr><td>${esc(t.id)}</td><td>${t.sumber === 'gl' ? 'GL' : 'Vendor'}</td><td>${esc(t.jalur || '')}</td><td>${esc(G.KONDLBL[t.kondisi] || '')}</td><td>${(+t.lat).toFixed(6)}, ${(+t.lon).toFixed(6)}</td><td>${esc(t.status)}</td></tr>`).join('') || '<tr><td colspan="6">Tidak ada</td></tr>'}</tbody></table>
    <p style="margin:10px 0 4px"><b>4. Foto kegiatan inspeksi</b></p>${d.foto ? fotoGrid(d.foto) : a.confirmed_at && a.scan_path ? '<p class="small">Foto asli telah dihapus setelah scan BA dikonfirmasi; arsip foto ada di scan BA.</p>' : fotoGrid(fotos.map(f => { const ts = +(/-(\d{12,})\./.exec(f.path)?.[1] || 0); return { path: f.path, label: 'Foto inspeksi', at: ts ? new Date(ts).toISOString() : null }; }))}
    <div style="display:flex;gap:12px;align-items:center;margin-top:12px"><div id="baqr" data-qr="${esc(qrTxt)}"></div><p class="small" style="font-family:Arial;font-size:10px;margin:0">Kode verifikasi dokumen<br>${esc(a.nomor)}<br>ID ${esc(a.id)}</p></div></div>`;
}
export function renderBA(id, shell) {
  const a = S.ba.find(x => x.id === id && seesBA(x));
  if (!a) return shell('BA', null, '<div class="card"><p>BA tidak ditemukan.</p></div>');
  const d = a.data; const kp = a.jenis === 'KP' || a.jenis === 'KPR';
  const sib = S.ba.filter(x => x.periode_id && x.periode_id === a.periode_id && x.id !== a.id);
  const admin = isRole('admin');
  shell('BA ' + a.jenis, d.blok?.nama, `<div class="stack">
    <div class="card stack noprint"><div class="row between"><b class="mono small">${esc(a.nomor)}</b><span class="pill ${d.esign || a.confirmed_at ? 's-ok' : a.scan_path ? 's-pend' : 's-idle'}">${d.esign ? 'Final · tanda tangan elektronik' : a.confirmed_at ? 'Final' : a.scan_path ? 'Menunggu konfirmasi' : 'Perlu tanda tangan'}</span></div>
      ${sib.map(x => `<a class="item" href="#ba/${x.id}"><div class="grow"><b>BA ${esc(x.jenis)} pasangan</b><span class="mono">${esc(x.nomor)}</span></div></a>`).join('')}
      <div class="grid2"><button class="btn" id="bPrint">Cetak / simpan PDF</button>${a.scan_path ? '<button class="btn ghost" id="bScanV">Lihat scan</button>' : '<span></span>'}</div>
      ${!d.esign && (admin || isRole('spv', 'admrek')) ? `<button class="btn ghost block" id="bScan">${a.scan_path ? 'Ganti' : 'Unggah'} scan BA bertanda tangan</button>` : ''}
      ${!d.esign && (admin || isRole('spv', 'admrek')) && a.scan_path && !a.confirmed_at ? `<button class="btn block" id="bConf">${kp ? 'Konfirmasi scan & hapus foto asli inspeksi' : 'Konfirmasi scan'}</button>` : ''}
      <p class="note">${d.esign ? `Ditandatangani secara elektronik oleh semua pihak, disetujui ${esc(nm(d.approver?.id))} ${tgl(d.approver?.at)} ${jam(d.approver?.at)} WIB. Keaslian dapat dicek lewat kode QR di lampiran.` : `Cetak, tanda tangan basah semua pihak, lalu unggah scan-nya.${kp ? ' Setelah admin konfirmasi, 4 foto inspeksi asli dihapus permanen.' : ''}`}</p></div>
    <div class="doc">${kop()}<h4>${JUDUL[a.jenis]}</h4><p class="nomor">Nomor: ${esc(a.nomor)}</p>${kp ? bodyKP(a) : bodyPP(a)}</div>
    ${kp ? lampiran(a) : d.foto ? lampiranPP(a) : ''}</div>`);
  $('#bPrint').addEventListener('click', () => window.print());
  const qr = $('#baqr'); if (qr && window.QRCode) new window.QRCode(qr, { text: qr.dataset.qr, width: 84, height: 84, correctLevel: window.QRCode.CorrectLevel.M });
  $$('img[data-foto]').forEach(async im => { try { im.src = await fileUrl('foto', im.dataset.foto); } catch (e) {} });
  const sv = $('#bScanV'); if (sv) sv.addEventListener('click', async () => { try { window.open(await SB.signedUrl('scan', a.scan_path), '_blank'); } catch (e) { toast(e.message); } });
  const su = $('#bScan'); if (su) su.addEventListener('click', async () => {
    const f = await pickFile('image/*,application/pdf'); if (!f) return;
    const ext = /pdf/.test(f.type) ? 'pdf' : 'jpg'; const path = `ba/${a.id}.${ext}`;
    try { su.disabled = true; su.textContent = 'Mengunggah…'; await SB.upload('scan', path, f); await upd('ba', { id: a.id }, { scan_path: path }, { offline: false }); toast('Scan terunggah.'); renderBA(id, shell); }
    catch (e) { toast(e.net ? 'Unggah butuh sinyal.' : e.message); su.disabled = false; }
  });
  const cf = $('#bConf'); if (cf) cf.addEventListener('click', async () => {
    if (!(await confirmSheet(kp ? 'Scan sudah benar dan lengkap ditandatangani? Foto asli inspeksi untuk BA ini akan dihapus permanen.' : 'Scan sudah benar dan lengkap ditandatangani?', kp ? 'Konfirmasi & hapus' : 'Konfirmasi', kp))) return;
    try {
      if (kp) {
        const sesiList = (d.sesi || []).map(x => S.sesi.find(s => s.id === x)).filter(Boolean);
        const paths = sesiList.flatMap(s => s.foto || []);
        if (paths.length) await SB.remove('foto', paths);
        for (const s of sesiList) await upd('sesi', { id: s.id }, { foto: [] }, { offline: false });
      }
      await upd('ba', { id: a.id }, { confirmed_by: S.me.id, confirmed_at: new Date().toISOString() }, { offline: false });
      toast(kp ? 'BA final. Foto asli dihapus.' : 'BA final.'); renderBA(id, shell);
    } catch (e) { toast(e.message); }
  });
}

// ---------- cetak tag QR ----------
let lastTags = null;
export function renderCetakTag(shell) {
  shell('Cetak tag', null, `<div class="stack">
    <div class="card stack noprint"><p class="small" style="margin:0">Pesan nomor tag berurutan lalu cetak. Tag belum terikat ke blok; terikat saat scan pertama di lapangan.</p>
      <div class="grid2"><label class="f" for="ctN">Jumlah tag<input id="ctN" type="number" min="1" max="500" value="40" inputmode="numeric"></label><label class="f" for="ctS">Ukuran<select id="ctS"><option value="30">30 mm</option><option value="40" selected>40 mm</option><option value="50">50 mm</option></select></label></div>
      <button class="btn" id="ctGo">Pesan nomor & tampilkan</button>${lastTags ? '<button class="btn ghost" id="ctPr">Cetak</button>' : ''}
      <p class="note">Nomor yang sudah dipesan tidak dipakai ulang. Ukuran printer thermal menyusul; atur skala di dialog cetak bila perlu.</p></div>
    <div id="ctOut" class="taggrid"></div></div>`);
  const draw = () => {
    if (!lastTags) return; const mm = lastTags.mm; const out = $('#ctOut');
    out.style.cssText = `display:grid;grid-template-columns:repeat(auto-fill,${mm}mm);gap:2mm;background:#fff;padding:2mm`;
    out.innerHTML = lastTags.ids.map(t => `<div style="width:${mm}mm;border:1px dashed #999;padding:1.5mm;text-align:center;font-family:Arial;color:#000;break-inside:avoid"><div data-q="${t}" style="display:flex;justify-content:center"></div><div style="font-size:${Math.max(7, mm / 4.4)}px;font-weight:700;margin-top:1mm">${t}</div><div style="font-size:6px">PT HAMPARAN MULYA</div></div>`).join('');
    const px = Math.round((mm - 5) * 3.78);
    out.querySelectorAll('[data-q]').forEach(el => new window.QRCode(el, { text: el.dataset.q, width: px, height: px, correctLevel: window.QRCode.CorrectLevel.M }));
  };
  draw();
  $('#ctGo').addEventListener('click', async () => {
    const n = Math.min(500, Math.max(1, Number($('#ctN').value) || 0));
    try { const end = Number(await SB.rpc('next_number', { p_name: 'tag', p_n: n })); lastTags = { mm: Number($('#ctS').value), ids: Array.from({ length: n }, (_, i) => 'HM-T-' + String(end - n + 1 + i).padStart(6, '0')) }; toast(`${lastTags.ids[0]} s/d ${lastTags.ids[n - 1]}`); renderCetakTag(shell); }
    catch (e) { toast(e.net ? 'Pesan nomor butuh sinyal.' : e.message); }
  });
  const pr = $('#ctPr'); if (pr) pr.addEventListener('click', () => window.print());
}
