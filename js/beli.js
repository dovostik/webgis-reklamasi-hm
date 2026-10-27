// Bibit dari beli: terima → aklimatisasi 7 hari di BST (belum masuk pembukuan) → hitung hidup → stok siap kirim.
// Afkir dirawat di penampungan "Afkir beli"; yang pulih masuk BST. Pemasok tetap berhutang sebanyak afkir sampai kiriman pengganti hidup.
import { S, L, ins, upd, toast, sheet, uid, pickPhoto, uploadOrQueue } from './core.js';
import * as G from './logic.js';
import { isRole } from './app.js';
const { esc, fmt, tgl } = G;
export const AKLIM_HARI = 7;
const jn = k => S.jenisMap[k]?.nama || k;
const crewName = () => isRole('crew') ? `<label class="f" for="cn">Nama pencatat <small>akun bersama, isi nama Anda</small><input id="cn" required placeholder="Nama crew"></label>` : '';
const getCrew = box => { const i = box.querySelector('#cn'); return i ? i.value.trim() : S.me.nama; };
export const canBeli = () => isRole('admin', 'nursery', 'crew');

const logs = b => (S.beli_log || []).filter(x => x.beli_id === b.id);
export const afkirSisa = b => b.status !== 'selesai' ? 0 : (b.n_afkir || 0) - logs(b).reduce((a, x) => a + x.n, 0);
export const hutang = b => b.pengganti_untuk || b.status !== 'selesai' ? 0 : Math.max(0, (b.n_afkir || 0) - (S.beli || []).filter(x => x.pengganti_untuk === b.id && x.status === 'selesai').reduce((a, x) => a + (x.n_hidup || 0), 0));
export const aklimList = () => (S.beli || []).filter(b => b.status === 'aklimatisasi').sort((a, b) => a.aklim_sampai.localeCompare(b.aklim_sampai));
export const aklimDue = () => aklimList().filter(b => b.aklim_sampai <= G.today());
const lotsOf = b => S.lot.filter(l => l.beli_id === b.id && l.aklim_sampai);
const bstBeds = jk => S.bedengan.filter(x => x.status === 'aktif' && (x.cluster === 'BF' || x.cluster === 'BL')).sort((a, b) => ((a.cluster === (S.jenisMap[jk]?.tipe === 'pionir' ? 'BF' : 'BL')) ? -1 : 1) - ((b.cluster === (S.jenisMap[jk]?.tipe === 'pionir' ? 'BF' : 'BL')) ? -1 : 1) || a.kode.localeCompare(b.kode));
const room = k => (S.bedMap[k]?.kapasitas || 1300) - L.fill(k);

// kartu ringkas untuk halaman Nursery
export function beliCard() {
  const ak = aklimList(), af = (S.beli || []).filter(b => afkirSisa(b) > 0), ht = (S.beli || []).filter(b => hutang(b) > 0);
  const row = b => { const left = G.diffDays(b.aklim_sampai, G.today()); return `<div class="sec"><div class="row between"><b>${esc(jn(b.jenis))} · ${fmt(b.n_datang)}</b>${left <= 0 ? `<span class="pill s-warn">Hitung sekarang</span>` : `<span class="pill s-idle">${left} hari lagi</span>`}</div><p class="small" style="margin:0">${esc(b.pemasok)}${b.pengganti_untuk ? ' · kiriman pengganti' : ''} · datang ${tgl(b.tgl_datang)} · ${lotsOf(b).map(l => esc(l.bedengan)).join(', ')}</p>${canBeli() && left <= 0 ? `<button class="btn sm" data-hitung="${b.id}" style="margin-top:6px">Hitung bibit hidup</button>` : ''}</div>`; };
  return `<div class="card stack"><div class="row between"><h2>Bibit beli</h2>${canBeli() ? '<button class="btn sm" id="beliNew">Terima bibit beli</button>' : ''}</div>
    ${ak.length ? `<h3 style="margin:0">Aklimatisasi (${ak.length})</h3>${ak.map(row).join('')}` : '<p class="muted small" style="margin:0">Tidak ada bibit beli dalam aklimatisasi.</p>'}
    ${ht.length ? `<h3 style="margin:8px 0 0">Hutang pemasok (wajib kirim ulang)</h3><dl class="kv">${ht.map(b => `<dt>${esc(b.pemasok)} · ${esc(jn(b.jenis))}</dt><dd>${fmt(hutang(b))} bibit</dd>`).join('')}</dl>` : ''}
    ${af.length ? `<p class="small" style="margin:0">Afkir beli dirawat: <b>${fmt(af.reduce((a, b) => a + afkirSisa(b), 0))}</b> bibit (lihat di bawah).</p>` : ''}
    <p class="note">Bibit beli ditaruh di bedengan BST, belum masuk pembukuan selama ${AKLIM_HARI} hari aklimatisasi. Riwayatnya terpisah dari produksi bibit mandiri.</p></div>`;
}
export function afkirCard() {
  const af = (S.beli || []).filter(b => afkirSisa(b) > 0);
  if (!af.length) return '';
  return `<div class="card stack"><h2>Penampungan · Afkir beli</h2>${af.map(b => `<div class="sec"><div class="row between"><b>${esc(jn(b.jenis))}</b><span class="mono">${fmt(afkirSisa(b))} bibit</span></div><p class="small" style="margin:0">${esc(b.pemasok)} · datang ${tgl(b.tgl_datang)}${hutang(b) ? ` · pemasok hutang ${fmt(hutang(b))}` : ''}</p>${canBeli() ? `<div class="grid2"><button class="btn ghost sm" data-afmati="${b.id}">Catat mati</button><button class="btn sm" data-afpulih="${b.id}">Pulih → BST</button></div>` : ''}</div>`).join('')}
    <p class="note">Afkir beli dirawat sampai pulih lalu dimasukkan ke bedengan BST. Bibit yang pulih tidak mengurangi hutang pemasok.</p></div>`;
}
export function bindBeli(box, rerender) {
  const q = s => box.querySelector(s), qa = s => box.querySelectorAll(s);
  const nb = q('#beliNew'); if (nb) nb.addEventListener('click', () => terimaSheet(rerender));
  qa('[data-hitung]').forEach(b => b.addEventListener('click', () => hitungSheet(S.beli.find(x => x.id === b.dataset.hitung), rerender)));
  qa('[data-afmati]').forEach(b => b.addEventListener('click', () => afkirActSheet(S.beli.find(x => x.id === b.dataset.afmati), 'mati', rerender)));
  qa('[data-afpulih]').forEach(b => b.addEventListener('click', () => afkirActSheet(S.beli.find(x => x.id === b.dataset.afpulih), 'pulih', rerender)));
}

function bedRow(jk, i) {
  const beds = bstBeds(jk).filter(b => room(b.kode) > 0);
  return `<div class="row bedrow" style="flex-wrap:nowrap;gap:6px"><select class="bB" aria-label="Bedengan ${i + 1}">${beds.map(b => `<option value="${b.kode}">${b.kode} (muat ${fmt(room(b.kode))})</option>`).join('')}</select><input class="bN" type="number" min="1" inputmode="numeric" placeholder="Jumlah" style="width:96px" aria-label="Jumlah"></div>`;
}
function terimaSheet(rerender) {
  const pemasok = [...new Set((S.beli || []).map(b => b.pemasok))];
  const ganti = (S.beli || []).filter(b => hutang(b) > 0);
  sheet(`<form class="stack" id="tb"><h2>Terima bibit beli</h2>
    <label class="f" for="tbG">Jenis kiriman<select id="tbG"><option value="">Pembelian baru</option>${ganti.map(b => `<option value="${b.id}">Pengganti afkir: ${esc(b.pemasok)} · ${esc(jn(b.jenis))} (hutang ${fmt(hutang(b))})</option>`).join('')}</select></label>
    <div class="grid2"><label class="f" for="tbP">Pemasok<input id="tbP" list="tbPl" required>${`<datalist id="tbPl">${pemasok.map(p => `<option value="${esc(p)}">`).join('')}</datalist>`}</label><label class="f" for="tbD">No. PO / surat jalan<input id="tbD"></label></div>
    <div class="grid2"><label class="f" for="tbJ">Jenis bibit<select id="tbJ">${S.jenisAktif.map(j => `<option value="${j.kode}">${esc(j.nama)}</option>`).join('')}</select></label><label class="f" for="tbN">Jumlah datang<input id="tbN" type="number" min="1" inputmode="numeric" required></label></div>
    <div class="stack" style="gap:6px"><span class="small"><b>Bedengan BST penerimaan</b> (boleh lebih dari satu)</span><div id="tbBeds"></div><button type="button" class="btn ghost sm" id="tbAdd">+ Bedengan lain</button></div>
    <button type="button" class="btn ghost block" id="tbF">Foto bukti (PO / surat jalan)</button><p class="note" id="tbFs">Belum ada bukti.</p>
    ${crewName()}<p class="note">Aklimatisasi ${AKLIM_HARI} hari: bibit belum masuk stok siap kirim sampai dihitung pada ${tgl(G.addDays(G.today(), AKLIM_HARI))}.</p><p class="err" id="tbE" hidden></p>
    <div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    const q = s => box.querySelector(s), er = q('#tbE'), err = m => { er.textContent = m; er.hidden = false; };
    let bukti = null, blob = null;
    const beds = () => { q('#tbBeds').innerHTML = bedRow(q('#tbJ').value, 0); };
    beds();
    q('#tbJ').addEventListener('change', beds);
    q('#tbAdd').addEventListener('click', () => q('#tbBeds').insertAdjacentHTML('beforeend', bedRow(q('#tbJ').value, q('#tbBeds').children.length)));
    q('#tbG').addEventListener('change', () => { const b = S.beli.find(x => x.id === q('#tbG').value); if (b) { q('#tbP').value = b.pemasok; q('#tbJ').value = b.jenis; q('#tbN').value = hutang(b); beds(); } });
    q('#tbF').addEventListener('click', async () => { const f = await pickPhoto(); if (!f) return; blob = f; bukti = `bukti/beli-${Date.now()}.jpg`; q('#tbFs').textContent = 'Bukti siap disimpan.'; });
    q('#tb').addEventListener('submit', async e => {
      e.preventDefault(); er.hidden = true;
      const who = getCrew(box), n = Number(q('#tbN').value), jk = q('#tbJ').value, pem = q('#tbP').value.trim();
      if (!who) return err('Isi nama pencatat.');
      if (!pem) return err('Isi nama pemasok.');
      if (!(n > 0)) return err('Isi jumlah datang.');
      const raw = [...box.querySelectorAll('.bedrow')].map(r => ({ bed: r.querySelector('.bB').value, n: Number(r.querySelector('.bN').value) || 0 }));
      if (raw.length === 1 && !raw[0].n) raw[0].n = n; // satu bedengan: jumlah = jumlah datang
      const rows = raw.filter(r => r.bed && r.n > 0);
      const sum = rows.reduce((a, r) => a + r.n, 0);
      if (!rows.length) return err('Pilih bedengan BST.');
      if (sum !== n) return err(`Jumlah di bedengan (${fmt(sum)}) harus sama dengan jumlah datang (${fmt(n)}).`);
      const per = {}; rows.forEach(r => per[r.bed] = (per[r.bed] || 0) + r.n);
      for (const [k, v] of Object.entries(per)) if (v > room(k)) return err(`${k} hanya muat ${fmt(room(k))} lagi.`);
      if (!blob) return err('Lampirkan foto bukti PO / surat jalan.');
      await uploadOrQueue('scan', bukti, blob);
      const id = uid(), sampai = G.addDays(G.today(), AKLIM_HARI);
      await ins('beli', { id, tgl_datang: G.today(), pemasok: pem, no_dok: q('#tbD').value.trim() || null, bukti, jenis: jk, n_datang: n, pengganti_untuk: q('#tbG').value || null, aklim_sampai: sampai, created_by: S.me.id });
      for (const [bed, v] of Object.entries(per)) {
        const lid = uid();
        await ins('lot', { id: lid, bedengan: bed, jenis: jk, jumlah: v, tgl_sapih: G.today(), tgl_masuk: G.today(), sumber: 'beli', beli_id: id, aklim_sampai: sampai, created_by: S.me.id });
        await ins('lot_log', { lot_id: lid, tipe: 'beli_masuk', n: v, ket: pem, oleh: S.me.id, nama_pencatat: who });
      }
      close(); toast(`${fmt(n)} ${jn(jk)} dari ${pem} masuk aklimatisasi sampai ${tgl(sampai)}.`); rerender();
    });
  });
}
function hitungSheet(b, rerender) {
  const ls = lotsOf(b);
  sheet(`<form class="stack" id="hb"><h2>Hitung hasil aklimatisasi</h2><p class="small" style="margin:0">${esc(jn(b.jenis))} dari ${esc(b.pemasok)} · datang ${fmt(b.n_datang)} pada ${tgl(b.tgl_datang)}</p>
    ${ls.map(l => `<label class="f">${esc(l.bedengan)}: bibit hidup <small>dari ${fmt(l.jumlah)}</small><input type="number" min="0" max="${l.jumlah}" inputmode="numeric" data-lot="${l.id}" value="${l.jumlah}"></label>`).join('')}
    <p class="note">Yang hidup langsung masuk stok siap kirim. Sisanya tercatat sebagai afkir beli dan dipindah ke penampungan Afkir beli; pemasok wajib mengirim ulang sebanyak afkir.</p>${crewName()}<p class="err" id="hbE" hidden></p>
    <div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    box.querySelector('#hb').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#hbE'), who = getCrew(box);
      if (!who) { er.textContent = 'Isi nama pencatat.'; er.hidden = false; return; }
      const vals = [...box.querySelectorAll('[data-lot]')].map(i => ({ l: S.lot.find(x => x.id === i.dataset.lot), n: Number(i.value) }));
      if (vals.some(v => !(v.n >= 0) || v.n > v.l.jumlah)) { er.textContent = 'Jumlah hidup tidak boleh melebihi jumlah di bedengan.'; er.hidden = false; return; }
      let hidup = 0, afkir = 0;
      for (const { l, n } of vals) {
        hidup += n; afkir += l.jumlah - n;
        await upd('lot', { id: l.id }, { jumlah: n, aklim_sampai: null });
        if (n) await ins('lot_log', { lot_id: l.id, tipe: 'aklim_hidup', n, oleh: S.me.id, nama_pencatat: who });
        if (l.jumlah - n) await ins('lot_log', { lot_id: l.id, tipe: 'aklim_afkir', n: l.jumlah - n, ket: 'ke penampungan afkir beli', oleh: S.me.id, nama_pencatat: who });
      }
      await upd('beli', { id: b.id }, { status: 'selesai', n_hidup: hidup, n_afkir: afkir, dihitung_at: new Date().toISOString() });
      close(); toast(`${fmt(hidup)} hidup masuk stok BST${afkir ? `, ${fmt(afkir)} afkir beli ke penampungan` : ''}.`); rerender();
    });
  });
}
function afkirActSheet(b, tipe, rerender) {
  const max = afkirSisa(b), beds = bstBeds(b.jenis).filter(x => room(x.kode) > 0);
  const bedRow = (sel, n) => `<div class="row abrow" style="flex-wrap:nowrap;gap:6px"><select class="abB" aria-label="Bedengan tujuan">${beds.map(x => `<option value="${x.kode}" ${x.kode === sel ? 'selected' : ''}>${x.kode} · muat ${fmt(room(x.kode))}${L.lotsIn(x.kode).some(l => l.jenis === b.jenis) ? ' · jenis sama' : L.fill(x.kode) ? '' : ' · kosong'}</option>`).join('')}</select><input class="abN" type="number" min="0" inputmode="numeric" value="${n}" style="width:90px" aria-label="Jumlah"></div>`;
  const first = beds.find(x => L.lotsIn(x.kode).some(l => l.jenis === b.jenis)) || beds[0];
  sheet(`<form class="stack" id="ab"><h2>${tipe === 'pulih' ? 'Afkir beli pulih → BST' : 'Afkir beli mati'}</h2><p class="small" style="margin:0">${esc(jn(b.jenis))} · ${esc(b.pemasok)} · tersisa ${fmt(max)}</p>
    ${tipe === 'pulih' ? (beds.length ? `<div class="stack" style="gap:6px"><span class="small"><b>Bedengan BST tujuan</b> · boleh dibagi ke beberapa bedengan</span><div id="abRows">${bedRow(first?.kode, Math.min(max, first ? room(first.kode) : max))}</div><button type="button" class="btn ghost sm" id="abAdd">+ Bedengan lain</button><div class="small" id="abT"></div></div>` : '<p class="err">Tidak ada bedengan BST yang muat.</p>') : `<label class="f" for="abN">Jumlah<input id="abN" type="number" min="1" max="${max}" inputmode="numeric" value="${max}"></label>`}
    ${crewName()}<p class="err" id="abE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    const rows = () => [...box.querySelectorAll('.abrow')].map(r => ({ bed: r.querySelector('.abB').value, n: Number(r.querySelector('.abN').value) || 0 }));
    const show = () => { const t = box.querySelector('#abT'); if (t) t.textContent = `Total ${fmt(rows().reduce((a, r) => a + r.n, 0))} dari ${fmt(max)}`; };
    box.addEventListener('input', show); show();
    const add = box.querySelector('#abAdd'); if (add) add.addEventListener('click', () => { const used = rows().reduce((a, r) => a + r.n, 0); const nx = beds.find(x => !rows().some(r => r.bed === x.kode)); box.querySelector('#abRows').insertAdjacentHTML('beforeend', bedRow(nx?.kode, Math.max(0, max - used))); show(); });
    box.querySelector('#ab').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#abE'), who = getCrew(box);
      const fail = m => { er.textContent = m; er.hidden = false; };
      if (!who) return fail('Isi nama pencatat.');
      if (tipe === 'pulih') {
        const rs = rows().filter(r => r.n > 0), tot = rs.reduce((a, r) => a + r.n, 0);
        if (!rs.length) return fail('Isi jumlah untuk minimal satu bedengan.');
        if (tot > max) return fail(`Total ${fmt(tot)} melebihi sisa ${fmt(max)}.`);
        const per = {}; rs.forEach(r => per[r.bed] = (per[r.bed] || 0) + r.n);
        for (const [bed, n] of Object.entries(per)) if (n > room(bed)) return fail(`${bed} hanya muat ${fmt(room(bed))} lagi.`);
        box.querySelector('button[type=submit]').disabled = true;
        for (const [bed, n] of Object.entries(per)) {
          const lid = uid();
          await ins('lot', { id: lid, bedengan: bed, jenis: b.jenis, jumlah: n, tgl_sapih: b.tgl_datang, tgl_masuk: G.today(), sumber: 'beli', beli_id: b.id, created_by: S.me.id });
          await ins('lot_log', { lot_id: lid, tipe: 'pulih', n, ket: 'dari afkir beli ' + b.pemasok, oleh: S.me.id, nama_pencatat: who });
          await ins('beli_log', { beli_id: b.id, tipe, n, bedengan: bed, lot_id: lid, oleh: S.me.id, nama_pencatat: who });
        }
        toast(`${fmt(tot)} ${jn(b.jenis)} pulih, masuk ${Object.keys(per).join(', ')}.`);
      } else {
        const n = Number(box.querySelector('#abN').value); if (!(n > 0) || n > max) return fail(`Isi jumlah 1–${fmt(max)}.`);
        await ins('beli_log', { beli_id: b.id, tipe, n, oleh: S.me.id, nama_pencatat: who }); toast(`${fmt(n)} afkir beli mati tercatat.`);
      }
      close(); rerender();
    });
  });
}
