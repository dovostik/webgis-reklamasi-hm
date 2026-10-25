// Master data: barang habis pakai, alat pinjam, dan jenis bibit (tambah, ubah, pindah golongan, nonaktifkan).
import { S, ins, upd, $, $$, toast, sheet, confirmSheet } from './core.js';
import * as G from './logic.js';
import { isRole } from './app.js';
const { esc, fmt } = G;

let tab = 'barang', q = '';
const cats = list => [...new Set(list.map(x => x.kategori).filter(Boolean))].sort();
const dl = (id, list) => `<datalist id="${id}">${list.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
const aktif = x => x.aktif !== false;

export function renderMaster(shell) {
  const admin = isRole('admin'), canItem = isRole('admin', 'nursery');
  if (!canItem) return shell('Master data', null, '<div class="card"><p style="margin:0">Hanya administrator dan GL Nursery.</p></div>');
  if (tab === 'jenis' && !admin) tab = 'barang';
  const f = s => !q || String(s).toLowerCase().includes(q.toLowerCase());
  let body = '';
  if (tab === 'barang') {
    const list = S.barang.filter(m => f(m.nama + ' ' + (m.kategori || ''))).sort((a, b) => String(a.kategori).localeCompare(String(b.kategori)) || a.nama.localeCompare(b.nama));
    body = group(list, m => `<button class="item" data-eb="${esc(m.nama)}" style="font:inherit;text-align:left;width:100%"><div class="grow"><b>${esc(m.nama)}</b><span>${esc(m.satuan || '')} · min ${fmt(m.minimum)} · stok ${m.stok == null ? '–' : fmt(m.stok, Number(m.stok) % 1 ? 2 : 0)}</span></div>${aktif(m) ? '' : '<span class="pill s-idle">Nonaktif</span>'}</button>`);
  } else if (tab === 'alat') {
    const list = S.alat.filter(a => f(a.nama + ' ' + (a.kategori || ''))).sort((a, b) => String(a.kategori).localeCompare(String(b.kategori)) || a.nama.localeCompare(b.nama));
    body = group(list, a => `<button class="item" data-ea="${a.id}" style="font:inherit;text-align:left;width:100%"><div class="grow"><b>${esc(a.nama)}</b><span>${esc(a.satuan || '')} · jumlah ${a.stok ?? '–'}${a.ket ? ' · ' + esc(a.ket) : ''}</span></div>${aktif(a) ? '' : '<span class="pill s-idle">Nonaktif</span>'}</button>`);
  } else {
    const list = S.jenis.filter(j => f(j.nama + ' ' + (j.latin || '') + ' ' + j.kelompok));
    body = ['pionir', 'lokal', 'mpts'].map(k => { const l = list.filter(j => j.kelompok === k); return l.length ? `<h3 style="margin:12px 0 4px">${{ pionir: 'Pionir', lokal: 'Lokal', mpts: 'MPTS' }[k]} (${l.length})</h3><div class="list">${l.map(j => `<button class="item" data-ej="${j.kode}" style="font:inherit;text-align:left;width:100%"><span class="tagid">${j.kode}</span><div class="grow"><b>${esc(j.nama)}</b><span><i>${esc(j.latin || '')}</i> · ${j.tipe === 'pionir' ? 'jalur pioneer' : 'jalur sisipan'}${j.tergenang ? ' · tergenang' : ''}${j.berpasir ? ' · berpasir' : ''}${j.ob ? ' · OB' : ''}</span></div>${aktif(j) ? (j.tersedia ? '' : '<span class="pill s-idle">Belum tersedia</span>') : '<span class="pill s-idle">Nonaktif</span>'}</button>`).join('')}</div>` : ''; }).join('');
  }
  shell('Master data', null, `<div class="stack">
    <div class="seg"><button data-t="barang" class="${tab === 'barang' ? 'on' : ''}">Habis pakai</button><button data-t="alat" class="${tab === 'alat' ? 'on' : ''}">Alat dipinjam</button>${admin ? `<button data-t="jenis" class="${tab === 'jenis' ? 'on' : ''}">Jenis bibit</button>` : ''}</div>
    <div class="row" style="flex-wrap:nowrap"><input id="mq" placeholder="Cari" value="${esc(q)}" aria-label="Cari"><button class="btn sm" id="mAdd">+ Tambah</button></div>
    <p class="note" style="margin:0">${tab === 'barang' ? 'Barang yang stoknya berkurang saat dipakai: pupuk, pestisida, benih, media, sparepart, paku, cat.' : tab === 'alat' ? 'Barang yang dipinjam lalu dikembalikan: mesin, gergaji, meteran, helm.' : 'Jenis bibit untuk lot nursery dan pilihan sulam. Kondisi titik menentukan jenis yang boleh disulam di titik itu.'} Ketuk item untuk mengubah kategori, satuan, golongan, atau menonaktifkan.</p>
    ${body || '<p class="muted">Tidak ada.</p>'}</div>`);
  $$('[data-t]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderMaster(shell); }));
  $('#mq').addEventListener('change', e => { q = e.target.value; renderMaster(shell); });
  $('#mAdd').addEventListener('click', () => tab === 'barang' ? barangSheet(null, shell) : tab === 'alat' ? alatSheet(null, shell) : jenisSheet(null, shell));
  $$('[data-eb]').forEach(b => b.addEventListener('click', () => barangSheet(S.barang.find(x => x.nama === b.dataset.eb), shell)));
  $$('[data-ea]').forEach(b => b.addEventListener('click', () => alatSheet(S.alat.find(x => x.id === +b.dataset.ea), shell)));
  $$('[data-ej]').forEach(b => b.addEventListener('click', () => jenisSheet(S.jenis.find(x => x.kode === b.dataset.ej), shell)));
}
function group(list, row) {
  const g = {}; list.forEach(x => { (g[x.kategori || 'Tanpa kategori'] = g[x.kategori || 'Tanpa kategori'] || []).push(x); });
  return Object.entries(g).map(([k, l]) => `<h3 style="margin:12px 0 4px">${esc(k)} (${l.length})</h3><div class="list">${l.map(row).join('')}</div>`).join('');
}
const allCats = () => cats([...S.barang, ...S.alat]);

function barangSheet(m, shell) {
  const isNew = !m;
  sheet(`<form class="stack" id="fb"><h2>${isNew ? 'Barang habis pakai baru' : esc(m.nama)}</h2>
    <label class="f" for="bN">Nama<input id="bN" required value="${esc(m?.nama || '')}"></label>
    <div class="grid2"><label class="f" for="bK">Kategori <small>ketik baru atau pilih</small><input id="bK" list="dlk" value="${esc(m?.kategori || '')}" placeholder="mis. Sparepart"></label><label class="f" for="bS">Satuan<input id="bS" required value="${esc(m?.satuan || '')}" placeholder="kg, sak, pcs"></label></div>
    <div class="grid2"><label class="f" for="bM">Stok minimum<input id="bM" type="number" step="any" min="0" inputmode="decimal" value="${m?.minimum ?? ''}"></label>${isNew ? `<label class="f" for="bT">Stok awal <small>kosongkan bila belum dihitung</small><input id="bT" type="number" step="any" min="0" inputmode="decimal"></label>` : `<label class="f" for="bA">Status<select id="bA"><option value="1" ${aktif(m) ? 'selected' : ''}>Aktif</option><option value="0" ${aktif(m) ? '' : 'selected'}>Nonaktif</option></select></label>`}</div>
    ${dl('dlk', allCats())}
    ${isNew ? '' : '<p class="note">Stok diubah lewat Gudang (masuk, keluar, opname), bukan di sini. Riwayat transaksi ikut nama baru bila nama diganti.</p><button type="button" class="btn ghost block" id="toAlat">Pindahkan ke Alat dipinjam</button>'}
    <p class="err" id="bE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    const v = id => box.querySelector(id)?.value.trim();
    box.querySelector('#fb').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#bE'); const nama = v('#bN');
      if (S.barang.some(x => x.nama.toLowerCase() === nama.toLowerCase() && x !== m)) { er.textContent = 'Nama sudah ada.'; er.hidden = false; return; }
      const row = { nama, kategori: v('#bK') || null, satuan: v('#bS'), minimum: v('#bM') === '' ? null : Number(v('#bM')) };
      try {
        if (isNew) await ins('barang', { ...row, stok: v('#bT') === '' ? null : Number(v('#bT')), aktif: true }, { offline: false });
        else await upd('barang', { nama: m.nama }, { ...row, aktif: v('#bA') === '1' }, { offline: false });
        close(); toast('Tersimpan.'); renderMaster(shell);
      } catch (x) { er.textContent = x.net ? 'Mengubah master data butuh sinyal.' : x.message; er.hidden = false; }
    });
    const ta = box.querySelector('#toAlat'); if (ta) ta.addEventListener('click', async () => {
      if (!(await confirmSheet(`Pindahkan "${esc(m.nama)}" menjadi alat yang dipinjam-kembalikan? Riwayat keluar-masuk lama tetap tersimpan.`, 'Pindahkan'))) return;
      try { await ins('alat', { nama: m.nama, kategori: m.kategori, satuan: m.satuan, stok: m.stok, aktif: true }, { offline: false }); await upd('barang', { nama: m.nama }, { aktif: false }, { offline: false }); close(); toast('Dipindah ke Alat dipinjam.'); tab = 'alat'; renderMaster(shell); }
      catch (x) { toast(x.message); }
    });
  });
}
function alatSheet(a, shell) {
  const isNew = !a;
  sheet(`<form class="stack" id="fa"><h2>${isNew ? 'Alat baru' : esc(a.nama)}</h2>
    <label class="f" for="aN">Nama<input id="aN" required value="${esc(a?.nama || '')}"></label>
    <div class="grid2"><label class="f" for="aK">Kategori <small>ketik baru atau pilih</small><input id="aK" list="dlk" value="${esc(a?.kategori || '')}"></label><label class="f" for="aS">Satuan<input id="aS" value="${esc(a?.satuan || 'pcs')}"></label></div>
    <div class="grid2"><label class="f" for="aJ">Jumlah<input id="aJ" type="number" min="0" inputmode="numeric" value="${a?.stok ?? ''}"></label>${isNew ? '<span></span>' : `<label class="f" for="aA">Status<select id="aA"><option value="1" ${aktif(a) ? 'selected' : ''}>Aktif</option><option value="0" ${aktif(a) ? '' : 'selected'}>Nonaktif</option></select></label>`}</div>
    <label class="f" for="aT">Keterangan<input id="aT" value="${esc(a?.ket || '')}" placeholder="mis. 1 rusak"></label>
    ${dl('dlk', allCats())}
    ${isNew ? '' : '<button type="button" class="btn ghost block" id="toBarang">Pindahkan ke Habis pakai (sparepart)</button>'}
    <p class="err" id="aE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    const v = id => box.querySelector(id)?.value.trim();
    box.querySelector('#fa').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#aE');
      const row = { nama: v('#aN'), kategori: v('#aK') || null, satuan: v('#aS') || null, stok: v('#aJ') === '' ? null : Number(v('#aJ')), ket: v('#aT') || null };
      try {
        if (isNew) await ins('alat', { ...row, aktif: true }, { offline: false });
        else await upd('alat', { id: a.id }, { ...row, aktif: v('#aA') === '1' }, { offline: false });
        close(); toast('Tersimpan.'); renderMaster(shell);
      } catch (x) { er.textContent = x.net ? 'Mengubah master data butuh sinyal.' : x.message; er.hidden = false; }
    });
    const tb = box.querySelector('#toBarang'); if (tb) tb.addEventListener('click', async () => {
      if (S.pinjam.some(p => p.alat_id === a.id && !p.kembali_at)) return toast('Masih ada yang meminjam alat ini. Kembalikan dulu.');
      let nama = a.nama; if (S.barang.some(x => x.nama.toLowerCase() === nama.toLowerCase())) nama = `${a.nama} (${a.kategori || 'alat'})`;
      if (!(await confirmSheet(`Pindahkan "${esc(a.nama)}" menjadi barang habis pakai? Stok awal ${a.stok ?? '–'} ${esc(a.satuan || '')}.`, 'Pindahkan'))) return;
      try { await ins('barang', { nama, kategori: a.kategori || 'Sparepart', satuan: a.satuan || 'pcs', minimum: 0, stok: a.stok, aktif: true }, { offline: false }); await upd('alat', { id: a.id }, { aktif: false }, { offline: false }); close(); toast('Dipindah ke Habis pakai.'); tab = 'barang'; renderMaster(shell); }
      catch (x) { toast(x.message); }
    });
  });
}
function nextKode(kel) {
  const pre = { pionir: 'PIO', lokal: 'LOK', mpts: 'MPT' }[kel];
  const n = Math.max(0, ...S.jenis.filter(j => j.kode.startsWith(pre)).map(j => +j.kode.slice(3) || 0)) + 1;
  return pre + String(n).padStart(2, '0');
}
function jenisSheet(j, shell) {
  const isNew = !j; const ck = (id, v, lbl) => `<label class="row" style="gap:8px;flex-wrap:nowrap"><input type="checkbox" id="${id}" ${v ? 'checked' : ''} style="width:auto"> ${lbl}</label>`;
  sheet(`<form class="stack" id="fj"><h2>${isNew ? 'Jenis bibit baru' : esc(j.nama) + ' · ' + j.kode}</h2>
    <div class="grid2"><label class="f" for="jN">Nama lokal<input id="jN" required value="${esc(j?.nama || '')}"></label><label class="f" for="jL">Nama latin<input id="jL" value="${esc(j?.latin || '')}"></label></div>
    <div class="grid2"><label class="f" for="jK">Kelompok<select id="jK" ${isNew ? '' : 'disabled'}>${['pionir', 'lokal', 'mpts'].map(k => `<option value="${k}" ${j?.kelompok === k ? 'selected' : ''}>${{ pionir: 'Pionir', lokal: 'Lokal', mpts: 'MPTS' }[k]}</option>`).join('')}</select></label><label class="f" for="jT">Jalur tanam<select id="jT"><option value="pionir" ${j?.tipe === 'pionir' ? 'selected' : ''}>Pioneer (4×4 m)</option><option value="sisipan" ${j && j.tipe !== 'pionir' ? 'selected' : ''}>Sisipan (6×8 m)</option></select></label></div>
    <div class="sec"><h3>Cocok untuk kondisi titik</h3><p class="note" style="margin:0">PMK spreading selalu boleh.</p>${ck('jG', j?.tergenang, 'Tergenang')}${ck('jP', j?.berpasir, 'Berpasir')}${ck('jO', j?.ob, 'Tanah OB')}</div>
    <div class="grid3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><label class="f" for="d1">Sapih (hari)<input id="d1" type="number" min="1" value="${j?.durasi_sapih ?? 56}"></label><label class="f" for="d2">Pembesaran<input id="d2" type="number" min="0" value="${j?.durasi_besar ?? 14}"></label><label class="f" for="d3">BST<input id="d3" type="number" min="0" value="${j?.durasi_bst ?? 14}"></label></div>
    ${ck('jS', isNew ? true : j.tersedia, 'Tersedia di nursery')}${isNew ? '' : ck('jA', aktif(j), 'Aktif (muncul di pilihan)')}
    <p class="err" id="jE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    const v = id => box.querySelector(id)?.value.trim(), c = id => box.querySelector(id)?.checked;
    box.querySelector('#fj').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#jE');
      const row = { nama: v('#jN'), latin: v('#jL') || null, tipe: v('#jT'), tergenang: c('#jG'), berpasir: c('#jP'), ob: c('#jO'), durasi_sapih: +v('#d1'), durasi_besar: +v('#d2'), durasi_bst: +v('#d3'), tersedia: c('#jS') };
      try {
        if (isNew) await ins('jenis', { kode: nextKode(v('#jK')), kelompok: v('#jK'), aktif: true, ...row }, { offline: false });
        else await upd('jenis', { kode: j.kode }, { ...row, aktif: c('#jA') }, { offline: false });
        close(); toast('Tersimpan.'); renderMaster(shell);
      } catch (x) { er.textContent = x.net ? 'Mengubah master data butuh sinyal.' : x.message; er.hidden = false; }
    });
  });
}
