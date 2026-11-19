// Laporan lengkap (beberapa lembar A4, simpan sebagai PDF lewat dialog cetak): progres penanaman, perawatan,
// pemakaian bahan, stok bibit nursery, stok gudang & alat. Setiap tabel/grafik bisa diunduh sebagai PNG.
import { S, L, $, $$ } from './core.js';
import { dashFor, chart, pngBtn } from './dash.js';
import { hijauLast } from './hijau.js';
import * as G from './logic.js';
const { fmt, esc, tgl } = G;
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const day = ts => ts ? (String(ts).length <= 10 ? String(ts) : G.tglWIB(ts)) : null;
let mode = 'bulan';

const tbl = (head, rows, foot, cls = '') => `<table class="g ${cls}"><thead><tr>${head.map(h => `<th${h[1] ? ` class="${h[1]}"` : ''}>${h[0] ?? h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map((c, i) => `<td${head[i]?.[1] ? ` class="${head[i][1]}"` : ''}>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}" class="muted">Tidak ada data</td></tr>`}${foot ? `<tr class="tt">${foot.map((c, i) => `<td${head[i]?.[1] ? ` class="${head[i][1]}"` : ''}>${c}</td>`).join('')}</tr>` : ''}</tbody></table>`;
const sec = (id, judul, body, note) => `<section class="lsec pngbox"><div class="row between"><h3>${judul}</h3>${pngBtn(id)}</div>${body}${note ? `<p class="lnote">${note}</p>` : ''}</section>`;
const R = 'r';

function kop(r, hal, tot) {
  return `<div class="kop"><img src="img/logo.svg" alt="PT Hamparan Mulya"><small><b>LAPORAN PROGRES REKLAMASI & NURSERY</b><br>PT Hamparan Mulya · Site Muara Teweh<br>${esc(r.sub)} · dicetak ${tgl(new Date().toISOString())}</small><small style="text-align:right">Lembar ${hal} / ${tot}</small></div>`;
}

function pageRingkas(r, d) {
  const pct = d.bastlHa ? Math.min(100, d.allSetara / d.bastlHa * 100) : 0;
  return `<h4>Ringkasan Progres · ${esc(r.lbl)}</h4><p class="nomor">${esc(r.sub)}</p>
    ${sec('ringkasan', '1. Ringkasan', tbl([['Uraian'], ['Realisasi', R], ['Keterangan']], [
      ['Penanaman (Ha setara)', fmt(d.haSetara, 2), `${fmt(d.bibit)} bibit tertanam · ${d.hariTanam} hari kerja`],
      ['Perawatan rotasi (Ha)', fmt(d.rotHa, 2), d.rencana ? `rencana ${fmt(d.rencana, 2)} Ha · ${fmt(d.rotHa / d.rencana * 100)}%` : `${d.rotN} blok selesai`],
      ['Inspeksi (Ha)', fmt(d.sesiHa, 2), `${d.sesiN} sesi · ${fmt(d.mati)} tanaman mati ditemukan`],
      ['Penyulaman (pohon)', fmt(d.sulam), ''],
      ['Progres BASTL 2026 kumulatif', `${fmt(pct, 1)}%`, `${fmt(d.allSetara, 2)} dari ${fmt(d.bastlHa, 2)} Ha`]]))}
    ${sec('grafik', '2. Grafik luasan', `<div class="lchart">${chart(d.series)}</div>`, 'Batang hijau: penanaman (Ha setara = bibit tertanam ÷ ' + fmt(G.STD.lubang) + ' pohon/Ha). Batang biru: perawatan (Ha rotasi). Garis putus-putus: rencana perawatan bulanan.')}
    ${sec('produktivitas', '3. Produktivitas', tbl([['Pekerjaan'], ['Nilai']], [
      ['Penanaman', d.hariTanam ? `${fmt(d.bibit / d.hariTanam)} pohon/hari · ${fmt(d.haSetara / d.hariTanam, 2)} Ha/hari` : '–'],
      ['Rotasi perawatan', d.rotDur != null ? `rata-rata ${fmt(d.rotDur, 1)} hari/blok` : d.manual && d.bulanN ? `rata-rata ${fmt(d.rotHa / d.bulanN, 2)} Ha/bulan` : d.rotN ? `${fmt(d.rotHa / d.rotN, 2)} Ha/blok` : '–'],
      ['Inspeksi', d.jam > 0 ? `${fmt(d.sesiHa / d.jam, 2)} Ha/jam (${fmt(d.jam, 1)} jam)` : '–']]))}`;
}

function pageTanam(r) {
  const inR = x => x && x >= r.a && x <= r.b;
  const rows = S.blok.filter(b => b.layer === 'bastl').sort((a, b) => G.blokName(a).localeCompare(G.blokName(b), 'id', { numeric: true })).map(b => {
    const ps = L.periodes(b.id).filter(p => p.tipe === 'cek1'), p = ps[ps.length - 1];
    const kir = S.kirim.filter(k => k.blok_id === b.id && k.status === 'diterima'), kem = (S.kembali || []).filter(k => k.blok_id === b.id);
    const net = kir.reduce((a, k) => a + Number(k.n), 0) - kem.reduce((a, k) => a + Number(k.n), 0);
    const netR = kir.filter(k => inR(day(k.diterima_at))).reduce((a, k) => a + Number(k.n), 0) - kem.filter(k => inR(day(k.dikirim_at))).reduce((a, k) => a + Number(k.n), 0);
    const setara = Math.max(0, net) / G.STD.lubang, pc = Number(b.ha) ? Math.min(100, setara / Number(b.ha) * 100) : 0;
    return { b, p, net, netR, setara, pc };
  });
  const T = k => rows.reduce((a, x) => a + x[k], 0), luas = rows.reduce((a, x) => a + Number(x.b.ha || 0), 0);
  return `<h4>Progres Penanaman (BASTL 2026 · ExDAS)</h4><p class="nomor">${esc(r.sub)}</p>
    ${sec('penanaman-per-blok', '4. Penanaman per blok', tbl([['No'], ['Blok'], ['Luas (Ha)', R], ['Status'], ['Mulai'], ['Selesai'], ['Tertanam periode ini', R], ['Tertanam kumulatif', R], ['Ha setara', R], ['%', R]],
      rows.map((x, i) => [i + 1, esc(G.blokName(x.b)), fmt(x.b.ha, 2), esc(L.blokStatus(x.b).t), x.p?.mulai_at ? tgl(x.p.mulai_at) : '–', x.p?.vendor_selesai_at ? tgl(x.p.vendor_selesai_at) : '–', fmt(x.netR), fmt(x.net), fmt(x.setara, 2), fmt(x.pc, 0) + '%']),
      ['', `Jumlah ${rows.length} blok`, fmt(luas, 2), '', '', '', fmt(T('netR')), fmt(T('net')), fmt(T('setara'), 2), luas ? fmt(T('setara') / luas * 100, 0) + '%' : '']), 'Tertanam = bibit diterima di lapangan dikurangi yang dikembalikan ke nursery.')}`;
}

function pageRawat(r) {
  const yr = r.b.slice(0, 4), PB = (S.perawatan_bulanan || []).filter(x => String(x.tahun) === yr).sort((a, b) => a.bulan - b.bulan);
  const rr = PB.reduce((a, x) => a + Number(x.rencana || 0), 0), ra = PB.reduce((a, x) => a + Number(x.realisasi || 0), 0);
  const bl = S.blok.filter(b => b.layer === 'perawatan').sort((a, b) => G.blokName(a).localeCompare(G.blokName(b), 'id', { numeric: true }));
  return `<h4>Progres Perawatan (BUMDES)</h4><p class="nomor">Tahun ${yr}</p>
    ${PB.length ? sec('perawatan-bulanan', '5. Realisasi perawatan bulanan', tbl([['No'], ['Bulan'], ['Rencana (Ha)', R], ['Realisasi (Ha)', R], ['%', R]],
      PB.map((x, i) => [i + 1, BULAN[x.bulan - 1], fmt(x.rencana, 2), x.realisasi == null ? '–' : fmt(x.realisasi, 2), x.realisasi == null || !Number(x.rencana) ? '' : fmt(x.realisasi / x.rencana * 100) + '%']),
      ['', 'Jumlah', fmt(rr, 2), fmt(ra, 2), rr ? fmt(ra / rr * 100) + '%' : '']), 'Bulan yang sudah dilaporkan memakai realisasi aktual laporan Compre; bulan berikutnya dari rotasi yang diselesaikan di aplikasi.') : ''}
    ${sec('perawatan-per-blok', '6. Jadwal rotasi per blok', tbl([['No'], ['Blok'], ['Luas (Ha)', R], ['Rotasi terakhir'], ['Kegiatan berikut'], ['Jatuh tempo'], ['Status'], ['% hijau', R]],
      bl.map((b, i) => { const x = L.rotasiInfo(b); return [i + 1, esc(G.blokName(b)), fmt(b.ha, 2), b.tgl_rotasi_terakhir ? tgl(b.tgl_rotasi_terakhir) : '–', x ? esc(x.kegiatan) : '–', x?.next ? tgl(x.next) : '–', esc(L.blokStatus(b).t), (h => h ? fmt(h.pct, 1) + '%' : '–')(hijauLast(b.id))]; }),
      ['', `Jumlah ${bl.length} blok`, fmt(bl.reduce((a, b) => a + Number(b.ha || 0), 0), 2), '', '', '', '', '']), '% hijau = luas blok yang tampak hijau pada ortho drone terakhir.')}`;
}

function pageBahan(r, d) {
  const inR = x => x && x >= r.a && x <= r.b;
  const km = (S.kirim_mat || []).filter(k => k.status === 'diterima' && inR(day(k.diterima_at)));
  const sat = n => S.barang.find(x => x.nama === n)?.satuan || '';
  const per = {}; km.forEach(k => { const key = k.blok_id + '|' + k.barang; const o = per[key] = per[key] || { b: S.blokMap[k.blok_id], barang: k.barang, n: 0, sisa: 0, balik: 0 }; o.n += Number(k.n); o.sisa += Number(k.sisa || 0); if (k.kembali_at && !k.sisa_at) o.balik += Number(k.kembali || 0); });
  const rows = Object.values(per).sort((a, b) => G.blokName(a.b).localeCompare(G.blokName(b.b), 'id', { numeric: true }) || a.barang.localeCompare(b.barang));
  const tot = {}; rows.forEach(x => { const t = tot[x.barang] = tot[x.barang] || { n: 0, sisa: 0 }; t.n += x.n; t.sisa += x.sisa; });
  return `<h4>Pemakaian Bahan</h4><p class="nomor">${esc(r.sub)}</p>
    ${sec('bahan-ringkas', '7. Ringkasan pemakaian', tbl([['Bahan'], ['Dikirim', R], ['Sisa kembali', R], ['Terpakai', R], ['Satuan']],
      Object.entries(tot).map(([k, t]) => [esc(k), fmt(t.n, 1), fmt(t.sisa, 1), fmt(t.n - t.sisa, 1), esc(sat(k))])),
      `Dibanding standar: pupuk kandang ${G.STD.koheKg} kg/pohon, NPK ${G.STD.npkG} g/pohon, LCC ${G.STD.lcc} kg/Ha.${d.bibit > 0 ? ` Periode ini: kohe ${fmt(d.kohe * G.STD.kohe / d.bibit, 2)} kg/pohon, LCC ${fmt(d.lcc / d.haSetara, 1)} kg/Ha.` : ''}`)}
    ${sec('bahan-per-blok', '8. Pemakaian per blok', tbl([['No'], ['Blok'], ['Bahan'], ['Dikirim', R], ['Sisa kembali', R], ['Terpakai', R], ['Satuan']],
      rows.map((x, i) => [i + 1, esc(G.blokName(x.b)), esc(x.barang), fmt(x.n, 1), fmt(x.sisa, 1) + (x.balik ? ` <small>(+${fmt(x.balik, 1)} belum ditimbang)</small>` : ''), fmt(x.n - x.sisa, 1), esc(sat(x.barang))])))}`;
}

function pageStok() {
  const KG = [['pionir', 'FG'], ['lokal', 'Lokal'], ['mpts', 'MPTS']], TH = [['Penyapihan', 'Sapih'], ['Pembesaran', 'Besar'], ['BST', 'BST']];
  const kg = j => { const k = String(S.jenisMap[j]?.kelompok || '').toLowerCase(); return KG.some(x => x[0] === k) ? k : (S.jenisMap[j]?.tipe === 'pionir' ? 'pionir' : 'lokal'); };
  const J = {}; S.lot.filter(l => l.jumlah > 0).forEach(l => { const t = L.tahapOf(l.bedengan); if (!TH.some(x => x[0] === t)) return; const o = J[l.jenis] = J[l.jenis] || { k: kg(l.jenis) }; o[t] = (o[t] || 0) + Number(l.jumlah); });
  const sumJ = o => TH.reduce((a, [t]) => a + (o[t] || 0), 0);
  const jrows = Object.entries(J).sort((a, b) => KG.findIndex(x => x[0] === a[1].k) - KG.findIndex(x => x[0] === b[1].k) || sumJ(b[1]) - sumJ(a[1]));
  const col = t => jrows.reduce((a, [, o]) => a + (o[t] || 0), 0), all = jrows.reduce((a, [, o]) => a + sumJ(o), 0);
  const krows = KG.map(([k, l]) => { const xs = jrows.filter(([, o]) => o.k === k); const s = t => xs.reduce((a, [, o]) => a + (o[t] || 0), 0); return [l, ...TH.map(([t]) => fmt(s(t))), fmt(TH.reduce((a, [t]) => a + s(t), 0))]; });
  const brg = S.barang.filter(b => b.aktif !== false).sort((a, b) => String(a.kategori || '').localeCompare(String(b.kategori || '')) || a.nama.localeCompare(b.nama));
  const alat = (S.alat || []).filter(a => a.aktif !== false && (Number(a.stok) > 0 || Number(a.rusak) > 0)).sort((a, b) => a.nama.localeCompare(b.nama));
  return `<h4>Stok Nursery & Gudang</h4><p class="nomor">Posisi ${tgl(new Date().toISOString())}</p>
    ${sec('stok-bibit-kelompok', '9. Stok bibit per kelompok', tbl([['Kelompok'], ...TH.map(([, s]) => [s, R]), ['Total', R]], krows, ['Jumlah', ...TH.map(([t]) => fmt(col(t))), fmt(all)]))}
    ${sec('stok-bibit-jenis', '10. Stok bibit per jenis', tbl([['No'], ['Jenis'], ['Kelompok'], ...TH.map(([, s]) => [s, R]), ['Total', R]],
      jrows.map(([j, o], i) => [i + 1, esc(S.jenisMap[j]?.nama || j), KG.find(x => x[0] === o.k)?.[1] || '', ...TH.map(([t]) => o[t] ? fmt(o[t]) : '–'), fmt(sumJ(o))]),
      ['', 'Jumlah', '', ...TH.map(([t]) => fmt(col(t))), fmt(all)]))}
    ${sec('stok-gudang', '11. Stok gudang (habis pakai)', tbl([['No'], ['Barang'], ['Kategori'], ['Stok', R], ['Satuan'], ['Minimum', R], ['Status']],
      brg.map((b, i) => [i + 1, esc(b.nama), esc(b.kategori || ''), b.stok == null ? '–' : fmt(b.stok, 1), esc(b.satuan || ''), b.minimum == null ? '–' : fmt(b.minimum, 1), b.stok == null ? 'belum dihitung' : b.minimum != null && Number(b.stok) < Number(b.minimum) ? '<b>di bawah minimum</b>' : 'cukup'])), '', 'lstok')}
    ${alat.length ? sec('stok-alat', '12. Peralatan', tbl([['No'], ['Alat'], ['Kategori'], ['Jumlah', R], ['Rusak', R], ['Baik', R], ['Satuan']],
      alat.map((a, i) => [i + 1, esc(a.nama), esc(a.kategori || ''), fmt(a.stok || 0), fmt(a.rusak || 0), fmt(Number(a.stok || 0) - Number(a.rusak || 0)), esc(a.satuan || '')]))) : ''}`;
}

export function renderLaporan(shell, seesBlok) {
  const { r, d } = dashFor(mode, seesBlok);
  const pages = [pageRingkas(r, d), pageTanam(r), pageRawat(r), pageBahan(r, d), pageStok()];
  shell('Laporan lengkap', r.sub, `<div class="stack">
    <div class="card stack noprint"><div class="seg" role="tablist">${[['minggu', 'Minggu ini'], ['bulan', 'Bulan ini'], ['ytd', 'YTD']].map(([k, l]) => `<button type="button" data-lm="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button class="btn" id="lpPdf">Download laporan PDF (${pages.length} lembar)</button>
      <p class="note" style="margin:0">Di dialog cetak pilih <b>Simpan sebagai PDF</b>, kertas A4 tegak. Setiap tabel dan grafik juga bisa diunduh sebagai gambar lewat tombol <b>PNG</b>.</p></div>
    ${pages.map((p, i) => `<div class="doc lap">${kop(r, i + 1, pages.length)}${p}</div>`).join('')}</div>`);
  $$('[data-lm]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.lm; renderLaporan(shell, seesBlok); }));
  $('#lpPdf').addEventListener('click', () => {
    const css = document.createElement('style'); css.textContent = '@page{size:A4 portrait;margin:10mm}'; document.head.appendChild(css);
    const done = () => { css.remove(); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 100);
  });
}
