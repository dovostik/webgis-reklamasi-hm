// Stock opname bibit nursery: hitung fisik per bedengan/lot (baris × isi per baris + sisa), catat selisih & alasan,
// perbaiki tanggal sapih/masuk (opname pertama), kunci kirim & pindah tahap selama sesi, lalu BA SO disetujui admin.
import { SB } from './sb.js';
import { S, L, ins, upd, $, $$, toast, sheet, confirmSheet, uid, nm } from './core.js';
import * as G from './logic.js';
import { isRole } from './app.js';
const { esc, fmt, tgl, jam } = G;
const jn = k => S.jenisMap[k]?.nama || k || '–';
const CL = { SP: 'Penyapihan', PB: 'Pembesaran', BF: 'BST Fastgrow', BL: 'BST Lokal' };
export const activeOpname = () => (S.opname || []).find(o => o.status === 'berjalan');
const rowsOf = (o, bed) => (S.opname_baris || []).filter(r => r.opname_id === o.id && (!bed || r.bedengan === bed));
const liveRows = (o, bed) => rowsOf(o, bed).filter(r => r.jenis);
const counted = (o, bed) => rowsOf(o, bed).length > 0;
const canDo = () => isRole('admin', 'nursery', 'crew');

// syarat mulai: kiriman selesai & penampungan / lapangan kosong
export function blockers() {
  const out = [];
  const kirim = S.kirim.filter(k => k.status === 'dikirim'); if (kirim.length) out.push(`${kirim.length} kiriman bibit belum diterima lapangan`);
  const lap = S.blok.filter(b => b.layer !== 'berhasil' && Object.keys(L.stokTampung(b.id)).length); if (lap.length) out.push(`bibit masih di lapangan: ${lap.map(b => G.blokName(b)).join(', ')}`);
  const kb = (S.kembali || []).filter(k => k.status === 'dikirim' || (k.n - (S.kembali_log || []).filter(x => x.kembali_id === k.id).reduce((a, x) => a + x.n, 0)) > 0); if (kb.length) out.push(`${kb.length} bibit kembali masih di penampungan`);
  const ak = (S.beli || []).filter(b => b.status === 'aklimatisasi'); if (ak.length) out.push(`${ak.length} bibit beli masih aklimatisasi`);
  return out;
}

// kartu di halaman Nursery
export function opnameCard() {
  const o = activeOpname(); const last = (S.opname || []).filter(x => x.status !== 'berjalan').sort((a, b) => String(b.mulai_at).localeCompare(String(a.mulai_at)))[0];
  const beds = S.bedengan.filter(b => b.status === 'aktif');
  if (o) {
    const n = beds.filter(b => counted(o, b.kode)).length;
    return `<div class="card stack"><div class="row between"><h2>Stock opname berjalan</h2><span class="pill s-warn">${n}/${beds.length} bedengan</span></div><div class="alert warn">Selama opname, kirim bibit dan pindah tahap dikunci.</div><a class="btn block" href="#opname">Lanjutkan hitung</a></div>`;
  }
  const wait = (S.opname || []).find(x => x.status === 'selesai');
  return `<div class="card stack"><div class="row between"><h2>Stock opname bibit</h2>${last ? `<span class="small muted">terakhir ${tgl(last.selesai_at || last.mulai_at)}</span>` : ''}</div>
    ${wait ? `<div class="alert">Opname ${tgl(wait.selesai_at)} selesai, BA Stock Opname menunggu persetujuan admin.</div>${isRole('admin') ? `<button class="btn block" id="soOk" data-o="${wait.id}">Setujui & terbitkan BA SO</button>` : ''}` : ''}
    ${canDo() && !wait ? `<p class="small" style="margin:0">Hitung fisik semua bedengan dan sesuaikan stok aplikasi dengan aktual. ${(S.opname || []).length ? '' : 'Ini opname pertama: tanggal sapih dan tanggal masuk bedengan bisa diisi supaya umur bibit tercatat.'}</p><button class="btn ghost block" id="soStart">Mulai stock opname</button>` : ''}</div>`;
}
export function bindOpnameCard(rerender) {
  const st = $('#soStart'); if (st) st.addEventListener('click', async () => {
    const bl = blockers(); const first = !(S.opname || []).length;
    if (bl.length && !isRole('admin')) return sheet(`<div class="stack"><h2>Opname belum bisa dimulai</h2><ul class="small" style="margin:0;padding-left:18px">${bl.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="note">Selesaikan dulu pengiriman dan kembalikan semua bibit ke nursery.</p><button class="btn ghost block" data-close>Tutup</button></div>`);
    if (!(await confirmSheet(`${bl.length ? `<b>Masih ada:</b><br>${bl.map(esc).join('<br>')}<br><br>Sebagai admin Anda tetap bisa memulai.<br><br>` : ''}Mulai stock opname bibit? Kirim bibit dan pindah tahap dikunci sampai opname selesai.`, 'Mulai opname'))) return;
    await ins('opname', { id: uid(), status: 'berjalan', oleh: S.me.id, pertama: first, mulai_at: new Date().toISOString() });
    location.hash = '#opname';
  });
  const ok = $('#soOk'); if (ok) ok.addEventListener('click', async () => { await approveSO((S.opname || []).find(x => x.id === ok.dataset.o)); });
}

// halaman hitung
let soQ = '';
export function renderOpname(shell) {
  const o = activeOpname();
  if (!o) { shell('Stock opname', null, `<div class="card stack"><p style="margin:0">Tidak ada opname yang sedang berjalan.</p><a class="btn ghost block" href="#nursery">Ke Nursery</a></div>`); return; }
  const beds = S.bedengan.filter(b => b.status === 'aktif').sort((a, b) => a.kode.localeCompare(b.kode));
  const sys = k => L.lotsIn(k).reduce((a, l) => a + l.jumlah, 0), fis = k => liveRows(o, k).reduce((a, r) => a + r.fisik, 0);
  const done = beds.filter(b => counted(o, b.kode)).length;
  const ql = soQ.toLowerCase();
  const show = beds.filter(b => !ql || b.kode.toLowerCase().includes(ql) || L.lotsIn(b.kode).some(l => jn(l.jenis).toLowerCase().includes(ql)));
  const grp = {}; show.forEach(b => (grp[b.cluster] = grp[b.cluster] || []).push(b));
  shell('Stock opname', `Mulai ${tgl(o.mulai_at)} ${jam(o.mulai_at)}`, `<div class="stack">
    <div class="card stack"><div class="row between"><b>${done}/${beds.length} bedengan dihitung</b><span class="small">sistem ${fmt(beds.reduce((a, b) => a + sys(b.kode), 0))} · fisik ${fmt(beds.filter(b => counted(o, b.kode)).reduce((a, b) => a + fis(b.kode), 0))}</span></div><div class="bar"><span style="width:${done / Math.max(1, beds.length) * 100}%"></span></div>
      ${o.pertama ? '<p class="note" style="margin:0">Opname pertama: isi juga <b>tanggal sapih</b> (umur bibit) dan <b>tanggal masuk bedengan</b> untuk setiap lot.</p>' : ''}
      <input id="soQ" type="search" placeholder="Cari kode bedengan atau jenis" value="${esc(soQ)}">
      ${canDo() ? `<div class="grid2"><button class="btn ghost" id="soEmpty">Tandai semua bedengan kosong (sistem 0)</button><button class="btn" id="soDone" ${done < beds.length ? 'disabled' : ''}>Selesai opname</button></div>${done < beds.length ? `<p class="note" style="margin:0">Selesai opname aktif setelah semua bedengan dihitung (${beds.length - done} lagi).</p>` : ''}` : ''}</div>
    ${Object.keys(grp).map(c => `<div class="card stack"><h2>${esc(CL[c] || c)}</h2><div class="list">${grp[c].map(b => { const c1 = counted(o, b.kode), s1 = sys(b.kode), f1 = fis(b.kode), d = f1 - s1; return `<a class="item" href="#" data-sob="${esc(b.kode)}"><span class="tagid">${esc(b.kode)}</span><div class="grow"><b>${esc([...new Set(L.lotsIn(b.kode).map(l => jn(l.jenis)))].join(', ') || 'kosong')}</b><span>sistem ${fmt(s1)}${c1 ? ` · fisik ${fmt(f1)}${d ? ` · selisih ${d > 0 ? '+' : ''}${fmt(d)}` : ''}` : ''}</span></div><span class="pill ${c1 ? (d ? 's-warn' : 's-ok') : 's-idle'}">${c1 ? (d ? 'Selisih' : 'Cocok') : 'Belum'}</span></a>`; }).join('')}</div></div>`).join('')}
  </div>`);
  let t; $('#soQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { soQ = e.target.value; renderOpname(shell); const q = $('#soQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 300); });
  $$('[data-sob]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); if (canDo()) bedOpname(o, a.dataset.sob, shell); }));
  const em = $('#soEmpty'); if (em) em.addEventListener('click', async () => {
    const empty = beds.filter(b => !counted(o, b.kode) && !sys(b.kode)); if (!empty.length) return toast('Tidak ada bedengan kosong yang belum dihitung.');
    if (!(await confirmSheet(`Tandai ${empty.length} bedengan (sistem 0) sebagai kosong juga secara fisik? Bedengan yang ternyata berisi bisa dibuka lagi untuk dikoreksi.`))) return;
    await ins('opname_baris', empty.map(b => ({ id: uid(), opname_id: o.id, bedengan: b.kode, jenis: null, sistem: 0, fisik: 0, penghitung: S.me.nama, oleh: S.me.id }))); renderOpname(shell);
  });
  const dn = $('#soDone'); if (dn) dn.addEventListener('click', () => finishOpname(o, shell));
}

function bedOpname(o, kode, shell) {
  const lots = L.lotsIn(kode); const prev = rowsOf(o, kode);
  const base = lots.map(l => ({ lot: l, r: prev.find(r => r.lot_id === l.id) }));
  const extra = prev.filter(r => !r.lot_id && r.jenis);
  const bed = S.bedMap[kode]; const sp = bed?.tahap === 'Penyapihan';
  const jOpts = sel => S.jenisAktif.map(j => `<option value="${j.kode}" ${j.kode === sel ? 'selected' : ''}>${esc(j.nama)}</option>`).join('');
  const rowHtml = (i, x) => `<div class="sec sorow" data-i="${i}" data-lot="${x.lot?.id || ''}" data-rid="${x.r?.id || ''}">
    <div class="row between"><b>${x.lot ? esc(jn(x.lot.jenis)) : `<select class="soJ" aria-label="Jenis">${jOpts(x.r?.jenis)}</select>`}</b><span class="small muted">${x.lot ? 'sistem ' + fmt(x.lot.jumlah) : 'lot baru (tidak tercatat)'}</span></div>
    <div class="grid3"><label class="f">Baris<input class="soB" type="number" min="0" inputmode="numeric" value="${x.r?.baris ?? ''}"></label><label class="f">Isi/baris<input class="soP" type="number" min="0" inputmode="numeric" value="${x.r?.per_baris ?? ''}"></label><label class="f">Sisa<input class="soS" type="number" min="0" inputmode="numeric" value="${x.r?.sisa ?? ''}"></label></div>
    <label class="f">Jumlah fisik <small>otomatis dari baris × isi + sisa, atau ketik langsung</small><input class="soF" type="number" min="0" inputmode="numeric" value="${x.r ? x.r.fisik : x.lot ? x.lot.jumlah : ''}"></label>
    <div class="grid2"><label class="f">Tanggal sapih<input class="soTS" type="date" value="${esc(x.r?.tgl_sapih || x.lot?.tgl_sapih || '')}"></label><label class="f">Masuk bedengan ini<input class="soTM" type="date" value="${esc(x.r?.tgl_masuk || x.lot?.tgl_masuk || '')}"></label></div>
    <label class="f">Alasan selisih <small>wajib bila fisik ≠ sistem</small><input class="soA" value="${esc(x.r?.alasan || '')}" placeholder="mis. mati tidak tercatat, salah hitung sebelumnya"></label></div>`;
  let n = 0;
  sheet(`<form class="stack" id="sof"><div class="row between"><h2>Opname ${esc(kode)}</h2><span class="pill s-idle">${esc(CL[bed?.cluster] || '')}</span></div>
    <div id="soRows">${base.map(x => rowHtml(n++, x)).join('')}${extra.map(r => rowHtml(n++, { r })).join('')}</div>
    <button type="button" class="btn ghost sm" id="soAdd">+ Jenis/lot yang belum tercatat</button>
    <label class="f" for="soH">Nama penghitung<input id="soH" value="${esc(prev[0]?.penghitung || (isRole('crew') ? '' : S.me.nama))}" required></label>
    <p class="err" id="soE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan hitungan</button></div></form>`, (box, close) => {
    const calc = el => { const r = el.closest('.sorow'); const b = r.querySelector('.soB').value, p = r.querySelector('.soP').value, s = r.querySelector('.soS').value; if (b !== '' && p !== '') r.querySelector('.soF').value = Number(b) * Number(p) + (Number(s) || 0); };
    box.addEventListener('input', e => { if (e.target.matches('.soB,.soP,.soS')) calc(e.target); });
    box.querySelector('#soAdd').addEventListener('click', () => { box.querySelector('#soRows').insertAdjacentHTML('beforeend', rowHtml(n++, { r: { tgl_sapih: G.today(), tgl_masuk: G.today() } })); });
    box.querySelector('#sof').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#soE'), fail = m => { er.textContent = m; er.hidden = false; };
      const who = box.querySelector('#soH').value.trim(); if (!who) return fail('Isi nama penghitung.');
      const out = [];
      for (const r of box.querySelectorAll('.sorow')) {
        const lot = S.lot.find(l => l.id === r.dataset.lot); const f = r.querySelector('.soF').value;
        if (f === '') { if (!lot) continue; return fail(`Isi jumlah fisik ${jn(lot.jenis)}.`); }
        const fisik = Number(f); if (!(fisik >= 0)) return fail('Jumlah fisik tidak valid.');
        const jenis = lot ? lot.jenis : r.querySelector('.soJ').value; const sistem = lot ? lot.jumlah : 0;
        const ts = r.querySelector('.soTS').value || null, tm = r.querySelector('.soTM').value || null;
        if (fisik > 0 && (!ts || !tm)) return fail(`Isi tanggal sapih dan tanggal masuk untuk ${jn(jenis)}.`);
        if (ts && tm && ts > tm) return fail(`${jn(jenis)}: tanggal sapih tidak boleh setelah tanggal masuk bedengan.`);
        if (tm && tm > G.today()) return fail('Tanggal tidak boleh di masa depan.');
        const alasan = r.querySelector('.soA').value.trim(); if (fisik !== sistem && !alasan) return fail(`Isi alasan selisih ${jn(jenis)} (${fmt(sistem)} → ${fmt(fisik)}).`);
        const num = v => v === '' ? null : Number(v);
        out.push({ id: r.dataset.rid || uid(), _upd: !!r.dataset.rid, opname_id: o.id, bedengan: kode, lot_id: lot?.id || null, jenis, sistem, fisik, baris: num(r.querySelector('.soB').value), per_baris: num(r.querySelector('.soP').value), sisa: num(r.querySelector('.soS').value), tgl_sapih: ts, tgl_masuk: tm, alasan: alasan || null, penghitung: who, oleh: S.me.id });
      }
      const tot = out.reduce((a, r) => a + r.fisik, 0); const cap = bed?.kapasitas || 1300;
      if (tot > cap * 1.3) return fail(`Total ${fmt(tot)} jauh melebihi kapasitas ${fmt(cap)}. Periksa lagi hitungan.`);
      box.querySelector('button[type=submit]').disabled = true;
      // baris lama yang tidak dipakai lagi → dikosongkan (tanpa hapus)
      for (const pr of prev) if (!out.some(x => x.id === pr.id)) await upd('opname_baris', { id: pr.id }, { jenis: null, fisik: 0, alasan: '(dihapus)' });
      if (!out.length && !prev.length) await ins('opname_baris', { id: uid(), opname_id: o.id, bedengan: kode, jenis: null, sistem: 0, fisik: 0, penghitung: who, oleh: S.me.id });
      for (const r of out) { const { _upd, id, ...v } = r; if (_upd) await upd('opname_baris', { id }, v); else await ins('opname_baris', { id, ...v }); }
      close(); toast(`${kode} tersimpan · fisik ${fmt(tot)}.`); renderOpname(shell);
    });
  });
}

async function finishOpname(o, shell) {
  const rows = liveRows(o); const sel = rows.reduce((a, r) => a + r.fisik - r.sistem, 0);
  if (!(await confirmSheet(`Selesaikan opname? Stok aplikasi diganti dengan hasil hitung fisik (${rows.length} lot, selisih total ${sel > 0 ? '+' : ''}${fmt(sel)} bibit). Kunci kirim dan pindah tahap dibuka, lalu BA Stock Opname menunggu persetujuan admin.`, 'Selesai & terapkan'))) return;
  try {
    const fresh = new Set();
    for (const r of rows) {
      const lot = S.lot.find(l => l.id === r.lot_id);
      if (lot) {
        const patch = { jumlah: r.fisik }; if (r.tgl_sapih) patch.tgl_sapih = r.tgl_sapih; if (r.tgl_masuk) patch.tgl_masuk = r.tgl_masuk;
        await upd('lot', { id: lot.id }, patch);
        if (r.fisik !== r.sistem) await ins('lot_log', { lot_id: lot.id, tipe: 'opname', n: r.fisik - r.sistem, ket: r.alasan || 'opname', oleh: S.me.id, nama_pencatat: r.penghitung });
      } else if (r.fisik > 0) {
        const id = uid(); fresh.add(id); await ins('lot', { id, bedengan: r.bedengan, jenis: r.jenis, jumlah: r.fisik, tgl_sapih: r.tgl_sapih || G.today(), tgl_masuk: r.tgl_masuk || G.today(), created_by: S.me.id });
        await ins('lot_log', { lot_id: id, tipe: 'opname', n: r.fisik, ket: r.alasan || 'lot tidak tercatat, hasil opname', oleh: S.me.id, nama_pencatat: r.penghitung });
      }
    }
    // lot sistem di bedengan yang tidak muncul di hitungan (bedengan ditandai kosong) → 0
    for (const l of S.lot.filter(l => l.jumlah > 0 && counted(o, l.bedengan) && !fresh.has(l.id) && !rows.some(r => r.lot_id === l.id))) { await upd('lot', { id: l.id }, { jumlah: 0 }); await ins('lot_log', { lot_id: l.id, tipe: 'opname', n: -l.jumlah, ket: 'bedengan kosong saat opname', oleh: S.me.id, nama_pencatat: S.me.nama }); }
    await upd('opname', { id: o.id }, { status: 'selesai', selesai_at: new Date().toISOString() });
    toast('Opname selesai. Stok bibit sudah sesuai aktual.'); location.hash = '#nursery';
  } catch (e) { toast(e.message, 5000); }
}

// BA Stock Opname (tanda tangan elektronik)
async function approveSO(o) {
  if (!o) return;
  if (!(await confirmSheet('Setujui hasil stock opname dan terbitkan BA Stock Opname dengan tanda tangan elektronik?', 'Setujui & terbitkan'))) return;
  const rows = liveRows(o).map(r => ({ bedengan: r.bedengan, cluster: S.bedMap[r.bedengan]?.cluster, jenis: r.jenis, nama: jn(r.jenis), sistem: r.sistem, fisik: r.fisik, alasan: r.alasan, penghitung: r.penghitung, tgl_sapih: r.tgl_sapih }));
  const mat = (S.barang_tx || []).filter(x => x.tipe === 'opname' && x.at >= o.mulai_at && (!o.selesai_at || x.at <= new Date(new Date(o.selesai_at).getTime() + 864e5).toISOString())).map(x => ({ barang: x.barang, n: Number(x.n), at: x.at }));
  const now = new Date().toISOString();
  const byJab = re => S.profiles.find(p => p.aktif !== false && re.test(p.jabatan || ''));
  const glN = S.profiles.find(p => p.role === 'nursery' && p.aktif !== false);
  const ttd = { dibuat: { nama: glN?.nama || '……………', jabatan: 'GL Nursery', at: o.selesai_at || now }, diperiksa: { nama: byJab(/spv/i)?.nama || '……………', jabatan: 'SPV Reklamasi', at: now }, rs: { nama: byJab(/suptend|superintend/i)?.nama || '……………', jabatan: 'Reclamation Suptend', at: now } };
  const td = G.toDate(G.today()), rom = G.ROM[td.getUTCMonth()], th = td.getUTCFullYear();
  const n = await SB.rpc('next_number', { p_name: `ba-NURSERY-${th}`, p_n: 1 });
  const nomor = `${String(n).padStart(3, '0')}/HM/BA/SO/NURSERY/${rom}/${th}`; const id = uid();
  await ins('ba', { id, jenis: 'SO', unit: 'NURSERY', nomor, blok_id: null, periode_id: null, data: { so: { rows, mat, mulai: o.mulai_at, selesai: o.selesai_at, pertama: o.pertama }, tanggal: G.today(), ttd, esign: true, approver: { id: S.me.id, at: now }, blok: { nama: 'Nursery' } }, created_by: S.me.id, confirmed_by: S.me.id, confirmed_at: now }, { offline: false });
  await upd('opname', { id: o.id }, { status: 'disetujui', ba_id: id }, { offline: false });
  toast('BA Stock Opname terbit.'); location.hash = '#ba/' + id;
}

// isi dokumen BA SO
export function bodySO(a, ttdBox) {
  const d = a.data, so = d.so; const rows = so.rows || [];
  const per = {}; rows.forEach(r => { const x = per[r.jenis] = per[r.jenis] || { nama: r.nama, s: 0, f: 0 }; x.s += r.sistem; x.f += r.fisik; });
  const sum = rows.reduce((a, r) => ({ s: a.s + r.sistem, f: a.f + r.fisik }), { s: 0, f: 0 });
  const sel = v => v ? (v > 0 ? '+' : '') + fmt(v) : '0';
  return `<p>Pada hari ini ${tgl(d.tanggal)}, telah dilaksanakan stock opname ${so.pertama ? '(pertama) ' : ''}bibit di Nursery PT Hamparan Mulya, dimulai ${tgl(so.mulai)} ${jam(so.mulai)} dan selesai ${tgl(so.selesai)} ${jam(so.selesai)}, dengan cara menghitung fisik setiap bedengan (jumlah baris × isi per baris + sisa), dengan hasil sebagai berikut:</p>
    <p style="margin-bottom:4px"><b>1. Rekap per jenis</b></p><table class="g"><thead><tr><th>Jenis</th><th>Sistem</th><th>Fisik</th><th>Selisih</th></tr></thead><tbody>${Object.values(per).sort((a, b) => a.nama.localeCompare(b.nama)).map(x => `<tr><td>${esc(x.nama)}</td><td style="text-align:right">${fmt(x.s)}</td><td style="text-align:right">${fmt(x.f)}</td><td style="text-align:right">${sel(x.f - x.s)}</td></tr>`).join('')}<tr style="font-weight:700"><td>Jumlah</td><td style="text-align:right">${fmt(sum.s)}</td><td style="text-align:right">${fmt(sum.f)}</td><td style="text-align:right">${sel(sum.f - sum.s)}</td></tr></tbody></table>
    <p style="margin-bottom:4px"><b>2. Rincian per bedengan</b></p><table class="g"><thead><tr><th>Bedengan</th><th>Jenis</th><th>Sistem</th><th>Fisik</th><th>Selisih</th><th>Keterangan</th></tr></thead><tbody>${rows.slice().sort((a, b) => a.bedengan.localeCompare(b.bedengan)).map(r => `<tr><td>${esc(r.bedengan)}</td><td>${esc(r.nama)}</td><td style="text-align:right">${fmt(r.sistem)}</td><td style="text-align:right">${fmt(r.fisik)}</td><td style="text-align:right">${sel(r.fisik - r.sistem)}</td><td>${esc(r.alasan || '')}</td></tr>`).join('') || '<tr><td colspan="6">Semua bedengan kosong</td></tr>'}</tbody></table>
    ${(so.mat || []).length ? `<p style="margin-bottom:4px"><b>3. Penyesuaian material gudang</b></p><table class="g"><thead><tr><th>Barang</th><th>Selisih</th></tr></thead><tbody>${so.mat.map(m => `<tr><td>${esc(m.barang)}</td><td style="text-align:right">${sel(m.n)}</td></tr>`).join('')}</tbody></table>` : ''}
    <p>Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.</p>${ttdBox(2, [['Dibuat oleh,', d.ttd.dibuat], ['Diperiksa,', d.ttd.diperiksa]])}${ttdBox(1, [['Mengetahui,', d.ttd.rs]])}`;
}
