// Beranda: progres pekerjaan minggu ini / bulan ini / year to date — luasan, bibit, material, inspeksi, produktivitas, grafik
import { S, L, $, $$ } from './core.js';
import * as G from './logic.js';
const { fmt } = G;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'], HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const day = ts => ts ? (String(ts).length <= 10 ? String(ts) : G.tglWIB(ts)) : null;
const addD = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diffD = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
let mode = (() => { try { return localStorage.getItem('hm-dash') || 'bulan'; } catch (e) { return 'bulan'; } })();

// minggu ke-n dihitung dari 1 Januari (minggu 1, Senin–Minggu); akhir tahun bisa minggu 53/54
const dow = d => (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7;
export const mingguKe = d => { const j = d.slice(0, 4) + '-01-01'; return Math.floor((diffD(j, d) + dow(j)) / 7) + 1; };
// pilihan periode: minggu ke-n / bulan ke-n tahun berjalan (null = yang sedang berjalan)
let selW = null, selM = null;
const sunday = d => addD(d, 6 - dow(d));
function range(m, sel = {}) {
  const today = day(new Date().toISOString()), [y, mo] = today.split('-').map(Number), jan1 = `${y}-01-01`, wkNow = mingguKe(today);
  if (m === 'minggu') { const wk = Math.min(sel.w || wkNow, wkNow), s0 = addD(jan1, (wk - 1) * 7 - dow(jan1)), mon = s0, a = mon < jan1 ? jan1 : mon, e0 = sunday(a), b = e0 > today ? today : e0;
    return { kind: 'minggu', a, b, lbl: wk === wkNow ? 'Minggu ini' : `Minggu ke-${wk}`, sub: `Minggu ke-${wk} · ${G.tgl(a)} – ${G.tgl(e0)}`, buckets: HARI.map((h, i) => ({ k: addD(mon, i), l: h })), key: d => d }; }
  if (m === 'bulan') { const bm = Math.min(sel.m || mo, mo), a = `${y}-${String(bm).padStart(2, '0')}-01`, end = new Date(Date.UTC(y, bm, 0)).toISOString().slice(0, 10), b = end > today ? today : end, w0 = mingguKe(a), w1 = mingguKe(b);
    return { kind: 'bulan', a, b, lbl: bm === mo ? 'Bulan ini' : `${BLN[bm - 1]} ${y}`, sub: `${BLN[bm - 1]} ${y} · minggu ke-${w0}–${w1}`, buckets: Array.from({ length: w1 - w0 + 1 }, (_, i) => ({ k: w0 + i, l: 'Mg ' + (w0 + i) })), key: mingguKe }; }
  return { kind: 'ytd', a: jan1, b: today, lbl: 'Year to date', sub: `1 Jan – ${G.tgl(today)} · s.d. minggu ke-${wkNow}`, buckets: BLN.slice(0, mo).map((l, i) => ({ k: i + 1, l })), key: d => Number(d.slice(5, 7)), monthly: true };
}
function pilihan() {
  const today = day(new Date().toISOString()), [y, mo] = today.split('-').map(Number), jan1 = `${y}-01-01`, wkNow = mingguKe(today);
  if (mode === 'minggu') return `<select id="dmSel" aria-label="Pilih minggu">${Array.from({ length: wkNow }, (_, i) => wkNow - i).map(w => { const s0 = addD(jan1, (w - 1) * 7 - dow(jan1)), a = s0 < jan1 ? jan1 : s0; return `<option value="${w}" ${(selW || wkNow) === w ? 'selected' : ''}>Minggu ke-${w} · ${G.tgl(a)}${w === wkNow ? ' (ini)' : ''}</option>`; }).join('')}</select>`;
  if (mode === 'bulan') return `<select id="dmSel" aria-label="Pilih bulan">${Array.from({ length: mo }, (_, i) => mo - i).map(m => `<option value="${m}" ${(selM || mo) === m ? 'selected' : ''}>${BLN[m - 1]} ${y}${m === mo ? ' (ini)' : ''}</option>`).join('')}</select>`;
  return '';
}

function rencanaOf(r, PB) {
  const m = Number(r.b.slice(5, 7)), rc = k => Number(PB.find(x => Number(x.bulan) === k)?.rencana || 0);
  if (r.monthly) return Array.from({ length: m }, (_, i) => rc(i + 1)).reduce((a, b) => a + b, 0);
  const dim = new Date(Date.UTC(Number(r.b.slice(0, 4)), m, 0)).getUTCDate();
  return r.kind === 'bulan' ? rc(m) : rc(m) * (diffD(r.a, r.b) + 1) / dim;
}
function data(r, sees) {
  const inR = d => d && d >= r.a && d <= r.b, bl = id => S.blokMap[id], ok = id => sees(bl(id));
  const ev = []; // {d, tipe, v}
  // penanaman: bibit diterima di lapangan dikurangi yang dikembalikan
  // bibit diterima dihitung tertanam esok harinya (sama dengan progres per blok)
  S.kirim.filter(k => k.status === 'diterima' && ok(k.blok_id)).forEach(k => ev.push({ d: addD(day(k.diterima_at), 1), t: 'bibit', v: Number(k.n), blok: k.blok_id }));
  (S.kembali || []).filter(k => ok(k.blok_id)).forEach(k => ev.push({ d: day(k.dikirim_at), t: 'bibit', v: -Number(k.n), blok: k.blok_id }));
  // selesai penanaman & rotasi
  // realisasi perawatan bulanan (aktual dari laporan Compre) menggantikan catatan aplikasi untuk bulan yang sudah diisi
  const yr = r.b.slice(0, 4), PB = (S.perawatan_bulanan || []).filter(x => String(x.tahun) === yr), manM = new Set(PB.filter(x => x.realisasi != null).map(x => Number(x.bulan)));
  const isMan = d => d && d.slice(0, 4) === yr && manM.has(Number(d.slice(5, 7)));
  PB.filter(x => Number(x.realisasi) > 0).forEach(x => ev.push({ d: `${yr}-${String(x.bulan).padStart(2, '0')}-15`, t: 'rotHa', v: Number(x.realisasi), man: true }));
  S.periode.filter(p => p.vendor_selesai_at && ok(p.blok_id) && !(p.tipe === 'rotasi' && isMan(day(p.vendor_selesai_at)))).forEach(p => ev.push({ d: day(p.vendor_selesai_at), t: p.tipe === 'cek1' ? 'tanamHa' : p.tipe === 'rotasi' ? 'rotHa' : 'retHa', v: Number(bl(p.blok_id).ha), p }));
  S.blok.filter(b => b.layer === 'perawatan' && b.tgl_rotasi_terakhir && sees(b) && !isMan(day(b.tgl_rotasi_terakhir))).forEach(b => { const d = day(b.tgl_rotasi_terakhir);
    if (!S.periode.some(p => p.blok_id === b.id && p.tipe === 'rotasi' && p.vendor_selesai_at && Math.abs(diffD(day(p.vendor_selesai_at), d)) <= 31)) ev.push({ d, t: 'rotHa', v: Number(b.ha) }); });
  // material terpakai = diterima − sisa kembali
  (S.kirim_mat || []).filter(k => k.status === 'diterima' && ok(k.blok_id)).forEach(k => { const sat = L.MAT[k.kel]?.sat; ev.push({ d: day(k.diterima_at), t: 'm_' + k.kel, v: (Number(k.n) - Number(k.sisa || 0)) * L.unitK(S.barang.find(x => x.nama === k.barang)?.satuan, sat) }); });
  // inspeksi
  S.sesi.filter(s => s.selesai_at && ok(s.blok_id)).forEach(s => ev.push({ d: day(s.selesai_at), t: 'sesi', v: Number(bl(s.blok_id).ha), jam: Math.max(0, (new Date(s.selesai_at) - new Date(s.mulai_at)) / 36e5) }));
  (S.tag_event || []).filter(e => e.tipe === 'mati' || e.tipe === 'sulam').forEach(e => { const t = S.tag.find(x => x.id === e.tag_id); if (t && ok(t.blok_id)) ev.push({ d: day(e.at), t: e.tipe, v: 1 }); });
  const E = ev.filter(e => inR(e.d)), sum = t => E.filter(e => e.t === t).reduce((a, e) => a + e.v, 0);
  const bibit = sum('bibit'), perHa = G.STD.lubang, hariTanam = new Set(E.filter(e => e.t === 'bibit' && e.v > 0).map(e => e.d)).size;
  const ses = E.filter(e => e.t === 'sesi'), jam = ses.reduce((a, e) => a + e.jam, 0);
  const rotDur = E.filter(e => e.t === 'rotHa' && e.p?.mulai_at).map(e => diffD(day(e.p.mulai_at), e.d));
  const series = r.buckets.map(b => { const f = t => E.filter(e => e.t === t && r.key(e.d) === b.k).reduce((a, e) => a + e.v, 0); return { l: b.l, a: Math.max(0, f('bibit')) / perHa, b: f('rotHa'), r: r.monthly ? Number(PB.find(x => Number(x.bulan) === b.k)?.rencana || 0) : 0 }; });
  const bs = S.blok.filter(b => b.layer === 'bastl' && sees(b)), bastlHa = bs.reduce((a, b) => a + Number(b.ha), 0);
  const allBibit = ev.filter(e => e.t === 'bibit' && e.d <= day(new Date().toISOString())).reduce((a, e) => a + e.v, 0);
  return { bibit, haSetara: bibit / perHa, hariTanam, tanamHa: sum('tanamHa'), rotHa: sum('rotHa'), rotN: E.filter(e => e.t === 'rotHa' && !e.man).length, manual: E.some(e => e.man), bulanN: Math.max(1, Number(r.b.slice(5, 7)) - (r.monthly ? 0 : Number(r.a.slice(5, 7)) - 1)), rencana: rencanaOf(r, PB), rencanaThn: PB.reduce((a, x) => a + Number(x.rencana || 0), 0), retHa: sum('retHa'),
    kohe: sum('m_kohe'), npk: sum('m_npk'), lcc: sum('m_lcc'), sesiN: ses.length, sesiHa: ses.reduce((a, e) => a + e.v, 0), jam, mati: sum('mati'), sulam: sum('sulam'),
    rotDur: rotDur.length ? rotDur.reduce((a, b) => a + b, 0) / rotDur.length : null, series, bastlHa, allSetara: allBibit / perHa,
    perHa };
}

export function chart(series) {
  const W = 340, H = 160, pl = 38, pb = 22, pt = 16, max = Math.max(0.5, ...series.flatMap(s => [s.a, s.b, s.r || 0]));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))), m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const n = series.length, gw = (W - pl - 4) / n, bw = Math.min(14, gw / 2.6), y = v => pt + (H - pt - pb) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  return `<svg viewBox="0 0 ${W} ${H}" class="dchart" role="img" aria-label="Grafik luasan per periode">
    <text x="9" y="${pt + (H - pt - pb) / 2}" text-anchor="middle" transform="rotate(-90 9 ${pt + (H - pt - pb) / 2})" class="ax">Luas (Ha)</text>
    ${ticks.map(t => `<line x1="${pl}" x2="${W - 4}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 4}" y="${y(t) + 3}" text-anchor="end">${fmt(t, t < 10 && t % 1 ? 1 : 0)}</text>`).join('')}
    ${series.map((s, i) => { const cx = pl + gw * i + gw / 2; return `<g><title>${esc(s.l)}: penanaman ${fmt(s.a, 2)} Ha · perawatan ${fmt(s.b, 2)} Ha</title>
      <rect x="${cx - bw - 1}" y="${y(s.a)}" width="${bw}" height="${Math.max(0, y(0) - y(s.a))}" rx="3" fill="var(--accent)"/>
      <rect x="${cx + 1}" y="${y(s.b)}" width="${bw}" height="${Math.max(0, y(0) - y(s.b))}" rx="3" fill="var(--pb)"/>
      ${s.a > 0.005 ? `<text x="${cx - bw / 2 - 1}" y="${y(s.a) - 3}" text-anchor="middle" class="vl">${fmt(s.a, s.a < 10 ? 2 : 1)}</text>` : ''}
      ${s.b > 0.005 ? `<text x="${cx + bw / 2 + 1}" y="${y(s.b) - 3}" text-anchor="middle" class="vl">${fmt(s.b, s.b < 10 ? 2 : 1)}</text>` : ''}
      ${s.r ? `<line x1="${cx - 1}" x2="${cx + bw + 3}" y1="${y(s.r)}" y2="${y(s.r)}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="3 2"/>` : ''}
      <text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(s.l)}</text></g>`; }).join('')}
  </svg><div class="row small muted" style="gap:14px"><span><i class="dot" style="background:var(--accent)"></i>Penanaman (Ha setara)</span><span><i class="dot" style="background:var(--pb)"></i>Perawatan (Ha rotasi)</span>${series.some(s => s.r) ? '<span><i class="dot" style="background:none;border-top:2px dashed var(--ink);border-radius:0;height:0;width:12px"></i>Rencana</span>' : ''}</div>`;
}

export const pngBtn = (name, lbl = 'PNG') => `<button type="button" class="pngbtn" data-png="${esc(name)}" aria-label="Unduh gambar PNG"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>${lbl}</button>`;
export function dashFor(m, sees) { const r = range(m); return { r, d: data(r, sees) }; }
export const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
export function dashHtml(sees, opts = {}) {
  const r = range(mode, { w: selW, m: selM }), d = data(r, sees), tanam = opts.tanam !== false, rawat = opts.rawat !== false;
  const pct = d.bastlHa ? Math.min(100, d.allSetara / d.bastlHa * 100) : 0;
  return `<div class="card stack pngbox" id="dash"><div class="row between" style="align-items:flex-start"><div><h2 style="margin:0">Progres pekerjaan</h2><span class="small muted">${esc(r.sub)}</span></div><div class="row" style="gap:6px">${pngBtn('progres-' + mode)}${opts.laporan ? '<a class="pngbtn" href="#laporan">Laporan PDF</a>' : ''}</div></div>
    <div class="seg" role="tablist">${[['minggu', 'Minggu'], ['bulan', 'Bulan'], ['ytd', 'YTD']].map(([k, l]) => `<button type="button" data-dm="${k}" class="${mode === k ? 'on' : ''}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>
    ${pilihan()}
    <div class="tiles">
      ${tanam ? `<div class="tile"><span>Penanaman</span><b>${fmt(d.haSetara, 2)} Ha</b><span>${fmt(d.bibit)} bibit tertanam</span></div>` : ''}
      ${rawat ? `<div class="tile"><span>Perawatan (rotasi)</span><b>${fmt(d.rotHa, 2)} Ha</b><span>${d.rencana ? `rencana ${fmt(d.rencana, 2)} Ha · ${fmt(d.rotHa / d.rencana * 100)}%${d.rencanaThn && mode === 'ytd' ? `<br>setahun ${fmt(d.rencanaThn, 2)} Ha · ${fmt(d.rotHa / d.rencanaThn * 100)}%` : ''}` : `${d.rotN} blok selesai`}</span></div>` : ''}
      <div class="tile"><span>Inspeksi</span><b>${fmt(d.sesiHa, 2)} Ha</b><span>${d.sesiN} sesi · ${fmt(d.mati)} mati ditemukan</span></div>
      <div class="tile"><span>Penyulaman</span><b>${fmt(d.sulam)}</b><span>pohon disulam</span></div>
    </div>
    <div class="pngbox"><div class="row between"><b class="small">Grafik luasan · ${esc(r.lbl)}</b>${pngBtn('grafik-' + mode)}</div>${chart(d.series)}</div>
    ${tanam && d.bastlHa ? `<div class="sec"><div class="row between small"><b>Progres BASTL 2026 (kumulatif)</b><span>${fmt(d.allSetara, 2)} / ${fmt(d.bastlHa, 2)} Ha · ${fmt(pct, 1)}%</span></div><div class="bar" style="margin-top:6px"><span style="width:${pct}%"></span></div></div>` : ''}
    <div class="sec pngbox"><div class="row between"><h3>Pemakaian bahan</h3>${pngBtn('bahan-' + mode)}</div>${kv([
      ...(tanam ? [['Pupuk kandang', `${fmt(d.kohe, 1)} sak · ${fmt(d.kohe * G.STD.kohe)} kg`], ['LCC', `${fmt(d.lcc, 1)} kg`]] : []),
      ['NPK', `${fmt(d.npk, 1)} kg`],
      ...(tanam ? [['Bibit', `${fmt(d.bibit)} pohon`]] : [])])}
      ${tanam && d.bibit > 0 ? `<p class="small muted" style="margin:6px 0 0">Per pohon tertanam: kohe ${fmt(d.kohe * G.STD.kohe / d.bibit, 2)} kg (standar ${G.STD.koheKg}) · LCC ${fmt(d.lcc / d.haSetara, 1)} kg/Ha (standar ${G.STD.lcc})</p>` : ''}</div>
    <div class="sec pngbox"><div class="row between"><h3>Produktivitas</h3>${pngBtn('produktivitas-' + mode)}</div>${kv([
      ...(tanam ? [['Penanaman', d.hariTanam ? `${fmt(d.bibit / d.hariTanam)} pohon/hari · ${fmt(d.haSetara / d.hariTanam, 2)} Ha/hari <small class="muted">(${d.hariTanam} hari kerja)</small>` : '–']] : []),
      ...(rawat ? [['Rotasi perawatan', d.rotDur != null ? `rata-rata ${fmt(d.rotDur, 1)} hari/blok` : d.manual && d.bulanN ? `rata-rata ${fmt(d.rotHa / d.bulanN, 2)} Ha/bulan` : d.rotN ? `${fmt(d.rotHa / d.rotN, 2)} Ha/blok` : '–']] : []),
      ['Inspeksi', d.jam > 0 ? `${fmt(d.sesiHa / d.jam, 2)} Ha/jam · ${fmt(d.jam, 1)} jam` : '–']])}</div>
    <p class="note" style="margin:0">Penanaman dihitung dari bibit diterima di lapangan dikurangi yang dikembalikan; 1 Ha setara ${fmt(d.perHa)} pohon. Material = diterima di lapangan dikurangi sisa yang kembali.${d.manual ? ' Perawatan bulan yang sudah dilaporkan memakai realisasi aktual laporan Compre.' : ''}</p></div>`;
}
export function bindDash(rerender) {
  const sl = $('#dmSel'); if (sl) sl.addEventListener('change', () => { if (mode === 'minggu') selW = +sl.value; else selM = +sl.value; rerender(); });
  $$('[data-dm]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.dm; try { localStorage.setItem('hm-dash', mode); } catch (e) {} rerender(); }));
}
