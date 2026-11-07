// Nursery (bedengan & lot), kirim bibit, penampungan lapangan, gudang.
import { SB } from './sb.js';
import { S, L, loadAll, ins, upd, $, $$, toast, sheet, confirmSheet, uid, nm, newMap, pickPhoto, scanQR } from './core.js';
import * as G from './logic.js';
import { role, isRole, seesBlok } from './app.js';
import { beliCard, afkirCard, bindBeli, aklimDue } from './beli.js';
import { denahSVG, CLC } from './denah.js';
import { opnameCard, bindOpnameCard, activeOpname } from './opname.js';
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
let denahQ = '';
const { esc, fmt, tgl, jam } = G;
const jn = k => S.jenisMap[k]?.nama || k;
const crewName = () => isRole('crew') ? `<label class="f" for="cn">Nama pencatat <small>akun bersama, isi nama Anda</small><input id="cn" required placeholder="Nama crew"></label>` : '';
const getCrew = box => { const i = box.querySelector('#cn'); return i ? i.value.trim() : S.me.nama; };

// ---------- nursery ----------
let nurseryView = null;
export function renderNursery(shell) {
  autoKembali();
  const can = isRole('admin', 'nursery', 'crew');
  const ready = L.readyStock(); const beliReady = {}; S.lot.forEach(l => { if (l.sumber === 'beli' && l.jumlah > 0 && L.stage(l).ready) beliReady[l.jenis] = (beliReady[l.jenis] || 0) + l.jumlah; }); const tr = Object.values(ready).reduce((a, b) => a + b, 0);
  const due = S.lot.filter(l => l.jumlah > 0 && L.stage(l).due);
  const tot = t => S.lot.filter(l => l.jumlah > 0 && L.tahapOf(l.bedengan) === t).reduce((a, l) => a + l.jumlah, 0);
  shell('Nursery', null, `<div class="stack">
    <div class="tiles"><div class="tile"><span>Siap kirim</span><b>${fmt(tr)}</b><span>≥ 2 minggu di BST</span></div><div class="tile"><span>Penyapihan</span><b>${fmt(tot('Penyapihan'))}</b><span>bibit</span></div><div class="tile"><span>Pembesaran</span><b>${fmt(tot('Pembesaran'))}</b><span>bibit</span></div><div class="tile"><span>Pindah tahap</span><b>${due.length}</b><span>lot jatuh tempo</span></div></div>
    ${(() => { const v = lsGet('hm-nview', 'denah'); return `<div class="row between"><div class="seg" role="group" aria-label="Tampilan" style="min-width:200px"><button type="button" data-nv="denah" class="${v === 'denah' ? 'on' : ''}" aria-pressed="${v === 'denah'}">Denah</button><button type="button" data-nv="peta" class="${v === 'peta' ? 'on' : ''}" aria-pressed="${v === 'peta'}">Peta asli</button></div>${v === 'denah' ? '<div class="row" style="gap:6px"><button class="btn ghost sm" id="dnOut" aria-label="Perkecil">−</button><button class="btn ghost sm" id="dnIn" aria-label="Perbesar">+</button></div>' : ''}</div>
    ${v === 'denah' ? `<input id="dnQ" type="search" placeholder="Cari kode bedengan atau jenis, mis. BF-03 atau sengon" value="${esc(denahQ)}" aria-label="Cari bedengan"><div class="chips" id="dnHits"></div><div class="dn-wrap" id="dnWrap"></div><p class="note" id="dnFac" style="margin:0"></p>` : '<div class="map" id="nmap"></div>'}`; })()}
    <div class="legend"><span><i class="sw" style="background:${CLC.SP}"></i>Penyapihan</span><span><i class="sw" style="background:${CLC.PB}"></i>Pembesaran</span><span><i class="sw" style="background:${CLC.BF}"></i>BST Fastgrow</span><span><i class="sw" style="background:${CLC.BL}"></i>BST Lokal</span><span><i class="sw" style="background:#E0473B;border-radius:50%"></i>Waktunya pindah</span><span><i class="sw" style="background:#FFD400;border-radius:50%"></i>Siap kirim</span><span><i class="sw" style="background:#111;border-radius:50%"></i>Aklimatisasi</span><span><b>B</b> = bibit beli</span><span><i class="sw" style="background:repeating-linear-gradient(45deg,#999 0 3px,#fff 3px 6px)"></i>Arsir = bedengan dipinjam (warna = tahap pinjaman)</span><span>Bar warna = persen isi terhadap kapasitas bedengan</span></div>
    ${aklimDue().length ? `<div class="alert warn"><b>Aklimatisasi bibit beli selesai (${aklimDue().length})</b><br>Hitung bibit yang hidup di kartu Bibit beli.</div>` : ''}
    <div class="card stack"><h2>Pengingat pindah tahap</h2>${due.length ? `<div class="list">${due.map(l => `<a class="item" href="#" data-bed="${l.bedengan}"><span class="tagid">${l.bedengan}</span><div class="grow"><b>${esc(jn(l.jenis))} · ${fmt(l.jumlah)}</b><span>ke ${L.stage(l).next === 'Pembesaran' ? 'Pembesaran' : L.stage(l).next === 'BF' ? 'BST Fastgrow' : 'BST Lokal'}</span></div></a>`).join('')}</div>` : '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
    <div class="card stack"><h2>Stok siap kirim per jenis</h2>${Object.keys(ready).length ? `<dl class="kv">${Object.entries(ready).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<dt>${esc(jn(k))}</dt><dd>${fmt(v)}${beliReady[k] ? ` <small class="muted">(beli ${fmt(beliReady[k])})</small>` : ''}</dd>`).join('')}</dl>` : '<p class="muted small" style="margin:0">Belum ada.</p>'}</div>
    ${pinjamCard()}${opnameCard()}${beliCard()}${afkirCard()}
    ${can ? '<p class="note">Tap bedengan di peta untuk mencatat lot baru, mati/afkir, atau pindah tahap.</p>' : ''}</div>`);
  $$('[data-nv]').forEach(b => b.addEventListener('click', () => { lsSet('hm-nview', b.dataset.nv); renderNursery(shell); }));
  if (lsGet('hm-nview', 'denah') === 'denah') { bindDenah(shell); $$('[data-bed]').forEach(a => { if (!a.closest('#dnWrap')) a.addEventListener('click', e => { e.preventDefault(); bedSheet(a.dataset.bed, shell); }); }); bindBeli(document.getElementById('main'), () => renderNursery(shell)); bindOpnameCard(); return; }
  const map = newMap($('#nmap'), { maxZoom: 23 });
  const grp = window.L.featureGroup();
  S.nursery_fitur.forEach(f => {
    if (f.layer === 'parit') window.L.geoJSON(f.geom, { style: { color: '#4F86C6', weight: 4 } }).addTo(grp);
    else if (f.layer === 'fasilitas') window.L.geoJSON(f.geom, { style: { color: '#333', weight: 1, fillColor: '#BFC4C1', fillOpacity: .9 } }).bindTooltip(esc(f.props.NAMA || ''), { direction: 'center', className: 'lbl-blok' }).addTo(grp);
  });
  S.bedengan.filter(b => b.status === 'aktif').forEach(b => {
    const f = L.fill(b.kode), cap = b.kapasitas || 1300; const isDue = L.lotsIn(b.kode).some(l => L.stage(l).due);
    window.L.geoJSON(b.geom, { style: { color: isDue ? '#E0473B' : '#222', weight: isDue ? 2.5 : .8, fillColor: CLC[b.cluster] || '#ccc', fillOpacity: f ? .35 + .6 * Math.min(1, f / cap) : .18 } })
      .bindTooltip(`${b.kode} · ${fmt(f)}`, { direction: 'center', className: 'lbl-blok' }).on('click', () => bedSheet(b.kode, shell)).addTo(grp);
  });
  grp.addTo(map);
  if (nurseryView) map.setView(nurseryView.c, nurseryView.z); else if (grp.getLayers().length) map.fitBounds(grp.getBounds(), { padding: [6, 6] });
  map.on('moveend', () => { nurseryView = { c: map.getCenter(), z: map.getZoom() }; });
  $$('[data-bed]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); bedSheet(a.dataset.bed, shell); }));
  bindBeli(document.getElementById('main'), () => renderNursery(shell)); bindOpnameCard();
}
function bedSheet(kode, shell) {
  const b = L.bed(kode); const ls = L.lotsIn(kode); const f = L.fill(kode), cap = b.kapasitas || 1300;
  const can = isRole('admin', 'nursery', 'crew'), gl = isRole('admin', 'nursery'); const pj = L.pinjamOf(kode);
  const hist = (S.bedengan_pinjam || []).filter(x => x.bedengan === kode).sort((a, c) => String(c.at).localeCompare(String(a.at)));
  const realRoom = jk => L.realBST(S.jenisMap[jk]?.tipe === 'pionir' ? 'BF' : 'BL').reduce((a, x) => a + Math.max(0, (x.kapasitas || 1300) - L.fill(x.kode)), 0);
  sheet(`<div class="stack"><div class="row between"><h2>${esc(kode)}</h2><span class="pill ${pj ? 's-warn' : 's-idle'}">${pj ? `Pinjam ${esc(pj.tahap)}` : esc(b.tahap) + (b.cluster === 'BF' ? ' Fastgrow' : b.cluster === 'BL' ? ' Lokal' : '')}</span></div>
    ${pj ? `<div class="alert warn">Bedengan ${esc(b.tahap)} ini <b>dipinjam sebagai ${esc(pj.tahap)}</b> sejak ${tgl(pj.mulai)} (${esc(pj.alasan || '-')}, oleh ${esc(nm(pj.oleh))}). Bibit di sini dihitung sebagai tahap ${esc(pj.tahap)}.${gl ? '' : ''}</div>${gl ? `<button class="btn ghost block" id="pjEnd">Kembalikan jadi ${esc(b.tahap)}</button>` : ''}` : gl ? '<button class="btn ghost block" id="pjNew">Pinjam bedengan untuk tahap lain</button>' : ''}
    <div><div class="row between small"><span>Terisi</span><span class="mono">${fmt(f)} / ${fmt(cap)}${isRole('admin', 'nursery') ? ' <a href="#" id="capEd" class="small">Ubah kapasitas</a>' : ''}</span></div><div class="bar"><span style="width:${Math.min(100, f / cap * 100)}%"></span></div></div>
    ${ls.map(l => { const st = L.stage(l); return `<div class="sec"><div class="row between"><b>${esc(jn(l.jenis))}${l.sumber === 'beli' ? ' <span class="pill s-pend">Beli</span>' : ''}</b>${st.aklim ? `<span class="pill s-warn">Aklimatisasi${st.left > 0 ? ' · ' + st.left + ' hari' : ' · hitung'}</span>` : st.ready ? '<span class="pill s-ok">Siap kirim</span>' : st.due ? '<span class="pill s-warn">Waktunya pindah</span>' : `<span class="pill s-idle">${st.left} hari lagi</span>`}</div><dl class="kv"><dt>Jumlah</dt><dd>${fmt(l.jumlah)}</dd>${l.sumber === 'beli' ? `<dt>Asal</dt><dd>Beli · ${esc(S.beli?.find(x => x.id === l.beli_id)?.pemasok || '')}</dd><dt>Datang</dt><dd>${tgl(l.tgl_sapih)}</dd>` : `<dt>Sapih</dt><dd>${tgl(l.tgl_sapih)}</dd>`}<dt>Masuk bedengan</dt><dd>${tgl(l.tgl_masuk)}</dd>${l.sumber === 'beli' ? '' : `<dt>Umur</dt><dd>${fmt(G.diffDays(G.today(), l.tgl_sapih) / 7, 1)} minggu</dd>`}</dl>${can && !st.aklim ? `<div class="grid2"><button class="btn ghost sm" data-afk="${l.id}">Catat mati/afkir</button>${st.due ? `<button class="btn sm" data-move="${l.id}">Pindahkan</button>` : pj && pj.tahap === 'BST' && realRoom(l.jenis) > 0 ? `<button class="btn sm" data-mvreal="${l.id}">Pindah ke BST asli</button>` : '<span></span>'}</div>` : ''}</div>`; }).join('') || '<p class="muted small" style="margin:0">Bedengan kosong.</p>'}
    ${can && ['Pembesaran', 'BST'].includes(L.tahapOf(kode)) ? `<button class="btn block" id="fillBed">Isi bedengan ini</button>` : ''}
    ${can && L.tahapOf(kode) === 'Penyapihan' ? `<form class="sec" id="nl"><h3>Lot baru (sapih ke polybag)</h3><div class="grid2"><label class="f" for="nlJ">Jenis<select id="nlJ">${S.jenisAktif.filter(j => j.tersedia !== false).map(j => `<option value="${j.kode}">${esc(j.nama)}</option>`).join('')}</select></label><label class="f" for="nlN">Jumlah bibit<input id="nlN" type="number" min="1" inputmode="numeric" value="${Math.max(0, Math.min(1200, cap - f))}"></label></div>${crewName()}<p class="note">Polybag kecil berkurang otomatis sesuai jumlah bibit.</p><p class="err" id="nlErr" hidden></p><button class="btn" type="submit">Tambah lot</button></form>` : ''}
    ${hist.length ? `<details class="sec"><summary class="small"><b>Riwayat pinjam bedengan (${hist.length})</b></summary><ul class="small" style="margin:6px 0 0;padding-left:18px">${hist.map(h => `<li>${tgl(h.mulai)} → ${h.selesai_at ? tgl(h.selesai_at) : 'sekarang'} · dipakai ${esc(h.tahap)} · ${esc(h.alasan || '-')} · ${esc(nm(h.oleh))}${h.selesai_at ? ` · dikembalikan ${esc(h.selesai_alasan || '')}${h.selesai_oleh ? ' oleh ' + esc(nm(h.selesai_oleh)) : ''}` : ''}</li>`).join('')}</ul></details>` : ''}
    <button class="btn ghost block" data-close>Tutup</button></div>`, (box, close) => {
    const fb = box.querySelector('#fillBed'); if (fb) fb.addEventListener('click', () => { close(); fillSheet(kode, shell); });
    const pn = box.querySelector('#pjNew'); if (pn) pn.addEventListener('click', () => { close(); pinjamSheet(b, shell); });
    const pe = box.querySelector('#pjEnd'); if (pe) pe.addEventListener('click', async () => {
      const ls2 = L.lotsIn(kode); if (!(await confirmSheet(`Kembalikan ${esc(kode)} menjadi bedengan ${esc(b.tahap)}?${ls2.length ? ` Masih ada ${fmt(L.fill(kode))} bibit di sini; tahapnya akan dihitung ulang sebagai ${esc(b.tahap)}.` : ''}`, 'Kembalikan'))) return;
      try { await upd('bedengan_pinjam', { id: pj.id }, { selesai_at: new Date().toISOString(), selesai_oleh: S.me.id, selesai_alasan: 'manual' }, { offline: false }); close(); toast(kode + ' kembali jadi ' + b.tahap + '.'); renderNursery(shell); } catch (x) { toast(x.net ? 'Butuh sinyal.' : x.message); }
    });
    box.querySelectorAll('[data-mvreal]').forEach(btn => btn.addEventListener('click', () => { close(); moveSheet(S.lot.find(x => x.id === btn.dataset.mvreal), shell, 'real'); }));
    const ce = box.querySelector('#capEd'); if (ce) ce.addEventListener('click', e => { e.preventDefault(); close(); capSheet(b, shell); });
    box.querySelectorAll('[data-afk]').forEach(btn => btn.addEventListener('click', () => { close(); afkirSheet(S.lot.find(x => x.id === btn.dataset.afk), shell); }));
    box.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => { close(); moveSheet(S.lot.find(x => x.id === btn.dataset.move), shell); }));
    const nl = box.querySelector('#nl'); if (nl) nl.addEventListener('submit', async e => {
      e.preventDefault(); const n = Number(box.querySelector('#nlN').value), j = box.querySelector('#nlJ').value, er = box.querySelector('#nlErr');
      const who = getCrew(box); if (!who) { er.textContent = 'Isi nama pencatat.'; er.hidden = false; return; }
      if (!(n > 0)) { er.textContent = 'Isi jumlah bibit.'; er.hidden = false; return; }
      if (n > cap - f) { er.textContent = `Bedengan hanya muat ${fmt(cap - f)} lagi.`; er.hidden = false; return; }
      if (ls.length && !ls.some(x => x.jenis === j)) { const empty = S.bedengan.some(x => L.tahapOf(x.kode) === 'Penyapihan' && x.status === 'aktif' && L.fill(x.kode) === 0); if (empty || f > cap / 2 || new Set(ls.map(x => x.jenis)).size >= 2) { er.textContent = `${jn(j)} belum ada di bedengan ini. Jenis baru hanya boleh dicampur bila tidak ada bedengan kosong dan bedengan ini terisi ≤ ½. Jenis yang sudah ada di sini (${[...new Set(ls.map(x => jn(x.jenis)))].join(', ')}) boleh ditambah.`; er.hidden = false; return; } }
      const id = uid(); await ins('lot', { id, bedengan: kode, jenis: j, jumlah: n, tgl_sapih: G.today(), tgl_masuk: G.today(), created_by: S.me.id });
      await ins('lot_log', { lot_id: id, tipe: 'baru', n, oleh: S.me.id, nama_pencatat: who });
      const pb = S.barang.find(x => x.nama === 'Polybag kecil'); if (pb && pb.stok != null) { await upd('barang', { nama: pb.nama }, { stok: Number(pb.stok) - n }); await ins('barang_tx', { barang: pb.nama, tipe: 'keluar', n, keperluan: 'Penyapihan', lokasi: 'Nursery ' + kode, oleh: S.me.id }); }
      close(); toast(`Lot ${jn(j)} ${fmt(n)} bibit ditambahkan.`); renderNursery(shell);
    });
  });
}
function afkirSheet(l, shell) {
  sheet(`<form class="stack" id="af"><h2>Mati / afkir · ${esc(l.bedengan)}</h2><p class="small" style="margin:0">${esc(jn(l.jenis))}, ${fmt(l.jumlah)} bibit</p><div class="grid2"><label class="f" for="afN">Jumlah<input id="afN" type="number" min="1" max="${l.jumlah}" inputmode="numeric"></label><label class="f" for="afT">Alasan<select id="afT"><option value="mati">Mati</option><option value="afkir">Afkir</option></select></label></div>${crewName()}<p class="err" id="afE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    box.querySelector('#af').addEventListener('submit', async e => {
      e.preventDefault(); const n = Number(box.querySelector('#afN').value), t = box.querySelector('#afT').value, who = getCrew(box), er = box.querySelector('#afE');
      if (!who) { er.textContent = 'Isi nama pencatat.'; er.hidden = false; return; }
      if (!(n > 0) || n > l.jumlah) { er.textContent = `Isi jumlah 1–${fmt(l.jumlah)}.`; er.hidden = false; return; }
      await upd('lot', { id: l.id }, { jumlah: l.jumlah - n }); await ins('lot_log', { lot_id: l.id, tipe: t, n, oleh: S.me.id, nama_pencatat: who });
      close(); toast(`${t === 'mati' ? 'Mati' : 'Afkir'} ${n} bibit tercatat.`); renderNursery(shell);
    });
  });
}
// bedengan pinjaman yang sudah kosong berakhir otomatis (bukan di hari mulai, agar bisa diisi dulu)
let akBusy = false;
function autoKembali() {
  if (akBusy || !isRole('admin', 'nursery', 'crew')) return;
  const due = (S.bedengan_pinjam || []).filter(p => !p.selesai_at && p.mulai < G.today() && L.fill(p.bedengan) === 0); if (!due.length) return;
  akBusy = true; Promise.all(due.map(p => upd('bedengan_pinjam', { id: p.id }, { selesai_at: new Date().toISOString(), selesai_alasan: 'kosong (otomatis)' }).catch(() => {}))).finally(() => { akBusy = false; });
}
function pinjamCard() {
  const act = (S.bedengan_pinjam || []).filter(p => !p.selesai_at).sort((a, b) => a.bedengan.localeCompare(b.bedengan)); if (!act.length) return '';
  const room = c => L.realBST(c).reduce((a, x) => a + Math.max(0, (x.kapasitas || 1300) - L.fill(x.kode)), 0);
  const bst = act.filter(p => p.tahap === 'BST'); const rF = room('BF'), rL = room('BL');
  const tot = act.reduce((a, p) => a + L.fill(p.bedengan), 0);
  return `<div class="card stack"><div class="row between"><h2>Bedengan dipinjam (${act.length})</h2><span class="small muted">${fmt(tot)} bibit</span></div>
    ${bst.length && (rF > 0 || rL > 0) ? `<div class="alert">BST asli ada tempat: Fastgrow ${fmt(rF)}, Lokal ${fmt(rL)} bibit. Pindahkan bibit dari bedengan pinjaman (buka bedengan → <b>Pindah ke BST asli</b>).</div>` : ''}
    <div class="list">${act.map(p => { const b = S.bedMap[p.bedengan]; return `<a class="item" href="#" data-bed="${esc(p.bedengan)}"><span class="tagid">${esc(p.bedengan)}</span><div class="grow"><b>${esc(b?.tahap || '')} → dipakai ${esc(p.tahap)}</b><span>sejak ${tgl(p.mulai)} · ${fmt(L.fill(p.bedengan))} bibit · ${esc(p.alasan || '')}</span></div></a>`; }).join('')}</div></div>`;
}
// Isi bedengan Pembesaran/BST hanya dari asal yang jelas: tahap sebelumnya, bedengan setahap lain, atau pembelian
function fillSheet(kode, shell) {
  if (activeOpname()) return toast('Stock opname sedang berjalan. Pemindahan bibit dikunci sampai opname selesai.', 4000);
  const b = L.bed(kode), T = L.tahapOf(kode), prev = T === 'BST' ? 'Pembesaran' : 'Penyapihan', pj = L.pinjamOf(kode);
  const cap = b.kapasitas || 1300, room = cap - L.fill(kode);
  // BST asli: Fastgrow hanya pionir, Lokal hanya lokal/MPTS; bedengan pinjaman menerima keduanya
  const tipeOk = l => T !== 'BST' || pj || (b.cluster === 'BF') === (S.jenisMap[l.jenis]?.tipe === 'pionir');
  const src = l => l.jumlah > 0 && l.bedengan !== kode && !L.stage(l).aklim && tipeOk(l);
  const dariPrev = S.lot.filter(l => src(l) && L.tahapOf(l.bedengan) === prev).sort((a, c) => (L.stage(c).due - L.stage(a).due) || a.bedengan.localeCompare(c.bedengan));
  const dariSama = S.lot.filter(l => src(l) && L.tahapOf(l.bedengan) === T).sort((a, c) => a.bedengan.localeCompare(c.bedengan));
  const row = (l, k) => { const st = L.stage(l); return `<option value="${l.id}" data-k="${k}">${esc(l.bedengan)} · ${esc(jn(l.jenis))} · ${fmt(l.jumlah)}${k === 'prev' ? (st.due ? ' · sudah waktunya' : ` · belum waktunya (${st.left} hari lagi)`) : ` · masuk ${tgl(l.tgl_masuk)}`}</option>`; };
  let mode = dariPrev.length ? 'prev' : 'sama';
  const opts = () => (mode === 'prev' ? dariPrev : dariSama).map(l => row(l, mode)).join('');
  sheet(`<form class="stack" id="fs"><h2>Isi ${esc(kode)}</h2><p class="small" style="margin:0">${esc(T)}${pj ? ' (pinjaman)' : ''} · terisi ${fmt(L.fill(kode))} / ${fmt(cap)} · sisa tempat <b>${fmt(room)}</b></p>
    <div class="seg" role="group" aria-label="Asal bibit"><button type="button" data-m="prev" class="${mode === 'prev' ? 'on' : ''}">Dari ${prev.toLowerCase()}</button><button type="button" data-m="sama" class="${mode === 'sama' ? 'on' : ''}">Dari ${T === 'BST' ? 'BST' : 'pembesaran'} lain</button>${T === 'BST' ? '<button type="button" data-m="beli">Pembelian</button>' : ''}</div>
    <div id="fsBody"><label class="f" for="fsL">Lot asal<select id="fsL">${opts()}</select></label><p class="note" id="fsNone" hidden></p>
      <label class="f" for="fsN">Jumlah dipindah<input id="fsN" type="number" min="1" inputmode="numeric"></label>
      <label class="f" for="fsA" id="fsAW" hidden>Alasan pindah lebih awal <small>wajib</small><input id="fsA" placeholder="mis. bibit sudah cukup tinggi, pembesaran penuh"></label>
      <div id="fsSel" class="sec" hidden><label style="display:flex;gap:10px;align-items:center;font-weight:600" id="fsSisaW"><input type="checkbox" id="fsSisa" style="width:22px;height:22px;min-height:0;flex:none;margin:0"> <span id="fsSisaT"></span></label>
        <label class="f" for="fsC">Catatan selisih <small>wajib</small><input id="fsC" placeholder="mis. toleransi hitungan"></label></div>
      ${crewName()}<p class="note" id="fsInfo" style="margin:0"></p></div>
    <div id="fsBeli" hidden><p class="small" style="margin:0">Bibit beli masuk lewat kartu <b>Bibit beli</b> di halaman Nursery: terima kiriman pemasok (foto bukti), aklimatisasi 7 hari, lalu hitung. Bedengan BST tujuan dipilih di sana.</p></div>
    <p class="err" id="fsE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit" id="fsOk">Pindahkan</button></div></form>`, (box, close) => {
    const q = s => box.querySelector(s);
    const sync = () => {
      const beli = mode === 'beli'; q('#fsBody').hidden = beli; q('#fsBeli').hidden = !beli; q('#fsOk').hidden = beli;
      if (beli) return; const list = mode === 'prev' ? dariPrev : dariSama; q('#fsNone').hidden = !!list.length; q('#fsNone').textContent = `Tidak ada lot ${mode === 'prev' ? prev.toLowerCase() : 'di bedengan ' + T + ' lain'} yang cocok untuk bedengan ini.`; q('#fsOk').disabled = !list.length;
      const l = S.lot.find(x => x.id === q('#fsL').value); if (!l) { q('#fsAW').hidden = true; q('#fsInfo').textContent = ''; return; }
      const early = mode === 'prev' && !L.stage(l).due; q('#fsAW').hidden = !early;
      if (!q('#fsN').value) q('#fsN').value = Math.max(0, Math.min(l.jumlah, room));
      const n = Math.round(Number(q('#fsN').value) || 0), d = l.jumlah - n; q('#fsSel').hidden = !(n > 0 && d !== 0); q('#fsSisaW').hidden = d <= 0;
      q('#fsSisaT').textContent = d > 0 ? `Sisa ${fmt(d)} di ${l.bedengan} tidak ada fisiknya (selisih hitung, lot asal jadi 0)` : ''; if (d < 0) q('#fsSel').querySelector('small').textContent = `wajib · fisik lebih ${fmt(-d)} dari catatan`;
      q('#fsInfo').textContent = mode === 'prev' ? `Umur ${T === 'BST' ? 'BST' : 'pembesaran'} mulai dihitung hari ini.` : `Tanggal masuk tetap ${tgl(l.tgl_masuk)}, umur tidak mundur.`;
    };
    box.querySelectorAll('[data-m]').forEach(x => x.addEventListener('click', () => { mode = x.dataset.m; box.querySelectorAll('[data-m]').forEach(y => y.classList.toggle('on', y === x)); if (mode !== 'beli') { q('#fsL').innerHTML = opts(); q('#fsN').value = ''; } sync(); }));
    q('#fsL').addEventListener('change', () => { q('#fsN').value = ''; sync(); }); q('#fsN').addEventListener('input', sync); sync();
    q('#fs').addEventListener('submit', async e => {
      e.preventDefault(); const er = q('#fsE'), fail = m => { er.textContent = m; er.hidden = false; };
      const l = S.lot.find(x => x.id === q('#fsL').value); if (!l) return fail('Pilih lot asal.');
      const n = Math.round(Number(q('#fsN').value)); const who = getCrew(box); if (!who) return fail('Isi nama pencatat.');
      if (!(n > 0)) return fail('Isi jumlah.'); if (n > room) return fail(`Bedengan ini hanya muat ${fmt(room)} lagi.`);
      const lebih = n > l.jumlah, buang = n < l.jumlah && q('#fsSisa').checked, cat = q('#fsC').value.trim();
      if ((lebih || buang) && !cat) return fail(lebih ? `Fisik ${fmt(n - l.jumlah)} lebih banyak dari catatan lot asal. Isi catatan selisihnya.` : 'Isi catatan selisih untuk sisa yang tidak ada fisiknya.');
      const early = mode === 'prev' && !L.stage(l).due, alasan = q('#fsA').value.trim(); if (early && !alasan) return fail('Isi alasan memindah lebih awal.');
      const ls = L.lotsIn(kode); if (ls.length && !ls.some(x => x.jenis === l.jenis)) { const empty = (T === 'BST' ? L.realBST(b.cluster) : S.bedengan.filter(x => L.tahapOf(x.kode) === T)).some(x => x.status === 'aktif' && x.kode !== kode && L.fill(x.kode) === 0); if (empty || L.fill(kode) > cap / 2 || new Set(ls.map(x => x.jenis)).size >= 2) return fail(`${jn(l.jenis)} belum ada di bedengan ini. Jenis baru hanya boleh dicampur bila tidak ada bedengan kosong dan bedengan ini terisi ≤ ½.`); }
      q('#fsOk').disabled = true;
      try {
        const id = uid(); const ket = 'dari ' + l.bedengan + (early ? ` (lebih awal ${L.stage(l).left} hari: ${alasan})` : '');
        await ins('lot', { id, bedengan: kode, jenis: l.jenis, jumlah: n, tgl_sapih: l.tgl_sapih, tgl_masuk: mode === 'prev' ? G.today() : l.tgl_masuk, sumber: l.sumber || 'mandiri', beli_id: l.beli_id || null, created_by: S.me.id });
        await ins('lot_log', { lot_id: id, tipe: 'pindah_masuk', n, ket, oleh: S.me.id, nama_pencatat: who });
        if (lebih) await ins('lot_log', { lot_id: l.id, tipe: 'opname', n: n - l.jumlah, ket: 'selisih hitung saat pindah (lebih): ' + cat, oleh: S.me.id, nama_pencatat: who });
        if (buang) await ins('lot_log', { lot_id: l.id, tipe: 'opname', n: -(l.jumlah - n), ket: 'selisih hitung saat pindah (kurang): ' + cat, oleh: S.me.id, nama_pencatat: who });
        await upd('lot', { id: l.id }, { jumlah: lebih || buang ? 0 : l.jumlah - n });
        await ins('lot_log', { lot_id: l.id, tipe: 'pindah_keluar', n, ket: 'ke ' + kode + (early ? ` (lebih awal: ${alasan})` : '') + ((lebih || buang) && cat ? ' · ' + cat : ''), oleh: S.me.id, nama_pencatat: who });
        close(); toast(`${fmt(n)} ${jn(l.jenis)} dipindah dari ${l.bedengan} ke ${kode}.`); renderNursery(shell);
      } catch (x) { q('#fsOk').disabled = false; fail(x.message); }
    });
  });
}
// GL Nursery: pinjam bedengan untuk tahap lain (tanpa persetujuan, riwayat tercatat)
function pinjamSheet(b, shell) {
  const opts = ['Penyapihan', 'Pembesaran', 'BST'].filter(t => t !== b.tahap);
  sheet(`<form class="stack" id="pjf"><h2>Pinjam ${esc(b.kode)}</h2><p class="small" style="margin:0">Bedengan ${esc(b.tahap)} ini dipakai sementara untuk tahap lain. Riwayatnya tercatat dan terlihat SPV serta Suptend.</p>
    <label class="f" for="pjT">Dipakai sebagai<select id="pjT">${opts.map(t => `<option ${t === 'BST' ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <div class="grid2"><label class="f" for="pjM">Mulai<input id="pjM" type="date" value="${G.today()}" max="${G.today()}" required></label><label class="f" for="pjA">Alasan<input id="pjA" value="BST penuh"></label></div>
    <p class="note" style="margin:0">Bibit di bedengan ini langsung dihitung sesuai tahap pinjaman (BST: siap kirim 2 minggu setelah tanggal masuk). Saat kirim bibit, bedengan pinjaman diambil lebih dulu. Bila bedengan kosong, pinjaman berakhir otomatis.</p>
    <p class="err" id="pjE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    box.querySelector('#pjf').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#pjE'), bt = box.querySelector('button[type=submit]'); bt.disabled = true;
      const tahap = box.querySelector('#pjT').value, mulai = box.querySelector('#pjM').value || G.today(), alasan = box.querySelector('#pjA').value.trim() || null;
      try {
        await ins('bedengan_pinjam', { id: uid(), bedengan: b.kode, tahap, mulai, alasan, oleh: S.me.id }, { offline: false });
        const ids = S.profiles.filter(p => p.aktif !== false && ['spv', 'suptend'].includes(p.role)).map(p => p.id);
        const { notify } = await import('./core.js'); await notify(ids, `Bedengan ${b.kode} dipinjam sebagai ${tahap}`, `${S.me.nama}: ${b.kode} (${b.tahap}) dipakai sebagai ${tahap} mulai ${tgl(mulai)}${alasan ? ' · ' + alasan : ''}.`, '#nursery');
        close(); toast(`${b.kode} sekarang dihitung sebagai ${tahap}.`); renderNursery(shell);
      } catch (x) { bt.disabled = false; er.textContent = x.net ? 'Butuh sinyal.' : x.message; er.hidden = false; }
    });
  });
}
// GL Nursery / admin: ubah kapasitas bedengan (satu bedengan atau satu cluster sekaligus)
function capSheet(b, shell) {
  const CLN = { SP: 'Penyapihan', PB: 'Pembesaran', BF: 'BST Fastgrow', BL: 'BST Lokal' };
  const same = S.bedengan.filter(x => x.status === 'aktif' && x.cluster === b.cluster);
  sheet(`<form class="stack" id="cpf"><h2>Kapasitas ${esc(b.kode)}</h2>
    <label class="f" for="cpN">Kapasitas (bibit)<input id="cpN" type="number" min="1" max="20000" inputmode="numeric" value="${b.kapasitas || 1300}" required></label>
    <label style="display:flex;gap:10px;align-items:center;font-weight:600"><input type="checkbox" id="cpAll" style="width:22px;height:22px;min-height:0;flex:none;margin:0;padding:0"> Terapkan ke semua bedengan ${esc(CLN[b.cluster] || b.cluster)} (${same.length})</label>
    <p class="small muted" style="margin:0">Terisi sekarang ${fmt(L.fill(b.kode))} bibit. Kapasitas dipakai untuk bar persen isi, saran bedengan tujuan pindah tahap, dan batas penerimaan bibit.</p>
    <p class="err" id="cpE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    box.querySelector('#cpf').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#cpE'); const n = Math.round(Number(box.querySelector('#cpN').value));
      const kode = box.querySelector('#cpAll').checked ? same.map(x => x.kode) : [b.kode];
      if (!(n >= 1 && n <= 20000)) { er.textContent = 'Kapasitas tidak valid.'; er.hidden = false; return; }
      const over = kode.filter(k => L.fill(k) > n);
      if (over.length && !(await confirmSheet(`Isi sekarang melebihi ${fmt(n)} di ${over.join(', ')}. Tetap simpan?`))) return;
      const btn = box.querySelector('button[type=submit]'); btn.disabled = true;
      try { await SB.rpc('set_kapasitas', { p_kode: kode, p_n: n }); S.bedengan.forEach(x => { if (kode.includes(x.kode)) x.kapasitas = n; }); await loadAll().catch(() => {}); close(); toast(`Kapasitas ${kode.length > 1 ? kode.length + ' bedengan' : b.kode} jadi ${fmt(n)}.`); renderNursery(shell); }
      catch (x) { btn.disabled = false; er.textContent = x.net ? 'Ubah kapasitas butuh sinyal.' : x.message; er.hidden = false; }
    });
  });
}
function moveSheet(l, shell, mode) {
  if (activeOpname()) return toast('Stock opname sedang berjalan. Pindah tahap dikunci sampai opname selesai.', 4000);
  const st = L.stage(l), cl = S.jenisMap[l.jenis]?.tipe === 'pionir' ? 'BF' : 'BL';
  // bedengan tujuan yang sah: tahap berikutnya (BST sesuai golongan jenis + bedengan pinjaman BST)
  const targets = (mode === 'real' ? L.realBST(cl) : st.next === 'Pembesaran' ? S.bedengan.filter(b => L.tahapOf(b.kode) === 'Pembesaran') : [...L.realBST(st.next || cl), ...L.pinjamBST()])
    .filter(b => b.status === 'aktif' && b.kode !== l.bedengan).sort((a, b) => a.kode.localeCompare(b.kode));
  const capOf = b => b.kapasitas || 1300, roomOf = b => capOf(b) - L.fill(b.kode);
  const label = b => { const js = [...new Set(L.lotsIn(b.kode).map(x => jn(x.jenis)))]; return `${b.kode}${L.pinjamOf(b.kode) ? ' (pinjaman)' : ''} · sisa ${fmt(Math.max(0, roomOf(b)))} · ${js.length ? js.join(', ') : 'kosong'}`; };
  const opt = sel => `<option value="">— pilih bedengan —</option>${targets.map(b => `<option value="${b.kode}" ${b.kode === sel ? 'selected' : ''} ${roomOf(b) <= 0 ? 'disabled' : ''}>${esc(label(b))}</option>`).join('')}`;
  const sg = L.suggestTargets(l, mode);
  const rowH = (bed = '', n = '') => `<div class="grid2 mvrow" style="grid-template-columns:1fr 110px auto;align-items:end"><label class="f">Bedengan tujuan<select class="mvB">${opt(bed)}</select></label><label class="f">Jumlah<input class="mvN" type="number" min="1" inputmode="numeric" value="${n}"></label><button type="button" class="btn ghost sm mvDel" aria-label="Hapus baris">✕</button></div>`;
  const toLbl = mode === 'real' ? 'BST asli' : st.next === 'Pembesaran' ? 'Pembesaran' : 'BST';
  sheet(`<form class="stack" id="mv"><h2>Pindah ke ${toLbl} · ${esc(l.bedengan)}</h2><p class="small" style="margin:0">${esc(jn(l.jenis))} <b>${fmt(l.jumlah)}</b> bibit${mode === 'real' ? ' · umur BST tetap dari tanggal masuk semula' : ''}</p>
    <p class="note" style="margin:0">Pilih sendiri bedengan tujuan dan jumlahnya. Isian awal hanya saran aplikasi${sg.plan.length ? '' : ' (tidak ada saran yang muat)'}. Boleh dibagi ke beberapa bedengan; sisa yang tidak dipindah tetap di ${esc(l.bedengan)}.</p>
    <div id="mvRows">${(sg.plan.length ? sg.plan : [{ bed: '', n: '' }]).map(x => rowH(x.bed, x.n)).join('')}</div>
    <button type="button" class="btn ghost sm" id="mvAdd">+ Bedengan tujuan lain</button>
    <p class="small" id="mvSum" style="margin:0"></p>
    <div id="mvSel" class="sec" hidden><label style="display:flex;gap:10px;align-items:center;font-weight:600" id="mvSisaW"><input type="checkbox" id="mvSisa" style="width:22px;height:22px;min-height:0;flex:none;margin:0"> <span id="mvSisaT"></span></label>
      <label class="f" for="mvC">Catatan selisih <small id="mvCW">wajib</small><input id="mvC" placeholder="mis. toleransi hitungan, polybag kosong"></label></div>${crewName()}
    <p class="err" id="mvE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit" id="mvOk">Pindahkan</button></div></form>`, (box, close) => {
    const q = x => box.querySelector(x), rows = () => [...box.querySelectorAll('.mvrow')].map(r => ({ r, bed: r.querySelector('.mvB').value, n: Math.round(Number(r.querySelector('.mvN').value) || 0) }));
    const sum = () => { const t = rows().reduce((a, x) => a + x.n, 0), d = l.jumlah - t;
      q('#mvSum').innerHTML = d >= 0 ? `Dipindah <b>${fmt(t)}</b> · tersisa di ${esc(l.bedengan)} <b>${fmt(d)}</b>` : `Dipindah <b>${fmt(t)}</b> · <b>lebih ${fmt(-d)}</b> dari catatan ${fmt(l.jumlah)}`;
      q('#mvSel').hidden = !(d !== 0 && t > 0); q('#mvSisaW').hidden = d <= 0; q('#mvSisaT').textContent = `Sisa ${fmt(d)} bibit tidak ada fisiknya (selisih hitung, bedengan asal jadi 0)`; };
    const bind = r => { r.querySelector('.mvDel').addEventListener('click', () => { if (box.querySelectorAll('.mvrow').length > 1) r.remove(); else { r.querySelector('.mvB').value = ''; r.querySelector('.mvN').value = ''; } sum(); }); r.querySelector('.mvN').addEventListener('input', sum); r.querySelector('.mvB').addEventListener('change', () => { const b = S.bedMap[r.querySelector('.mvB').value]; const ni = r.querySelector('.mvN'); if (b && !ni.value) { const used = rows().filter(x => x.r !== r).reduce((a, x) => a + x.n, 0); ni.value = Math.max(0, Math.min(roomOf(b), l.jumlah - used)); } sum(); }); };
    box.querySelectorAll('.mvrow').forEach(bind); sum();
    q('#mvAdd').addEventListener('click', () => { q('#mvRows').insertAdjacentHTML('beforeend', rowH()); bind([...box.querySelectorAll('.mvrow')].pop()); });
    q('#mv').addEventListener('submit', async e => {
      e.preventDefault(); const er = q('#mvE'), fail = m => { er.textContent = m; er.hidden = false; };
      const who = getCrew(box); if (!who) return fail('Isi nama pencatat.');
      const plan = rows().filter(x => x.bed || x.n); if (!plan.length) return fail('Pilih minimal satu bedengan tujuan.');
      if (plan.some(x => !x.bed)) return fail('Ada baris tanpa bedengan tujuan.'); if (plan.some(x => !(x.n > 0))) return fail('Ada baris tanpa jumlah.');
      const tot = plan.reduce((a, x) => a + x.n, 0), lebih = tot > l.jumlah, buang = !lebih && tot < l.jumlah && q('#mvSisa').checked, cat = q('#mvC').value.trim();
      if ((lebih || buang) && !cat) return fail(lebih ? `Fisik ${fmt(tot - l.jumlah)} lebih banyak dari catatan. Isi catatan selisihnya.` : 'Isi catatan selisih untuk sisa yang tidak ada fisiknya.');
      const per = {}; plan.forEach(x => { per[x.bed] = (per[x.bed] || 0) + x.n; });
      for (const [k, n] of Object.entries(per)) {
        const b = S.bedMap[k]; if (n > roomOf(b)) return fail(`${k} hanya muat ${fmt(roomOf(b))} lagi.`);
        const ls = L.lotsIn(k); if (ls.length && !ls.some(x => x.jenis === l.jenis)) { const empty = targets.some(x => x.kode !== k && L.fill(x.kode) === 0 && !per[x.kode]); if (empty || L.fill(k) > capOf(b) / 2 || new Set(ls.map(x => x.jenis)).size >= 2) return fail(`${k}: ${jn(l.jenis)} belum ada di bedengan itu. Jenis baru hanya boleh dicampur bila tidak ada bedengan kosong dan bedengan terisi ≤ ½.`); }
      }
      q('#mvOk').disabled = true;
      try {
        for (const [k, n] of Object.entries(per)) { const id = uid(); await ins('lot', { id, bedengan: k, jenis: l.jenis, jumlah: n, tgl_sapih: l.tgl_sapih, tgl_masuk: mode === 'real' ? l.tgl_masuk : G.today(), sumber: l.sumber || 'mandiri', beli_id: l.beli_id || null, created_by: S.me.id }); await ins('lot_log', { lot_id: id, tipe: 'pindah_masuk', n, ket: 'dari ' + l.bedengan, oleh: S.me.id, nama_pencatat: who }); }
        // selisih hitung dicatat di lot asal sebagai penyesuaian (bukan kesalahan)
        if (lebih) await ins('lot_log', { lot_id: l.id, tipe: 'opname', n: tot - l.jumlah, ket: 'selisih hitung saat pindah (lebih): ' + cat, oleh: S.me.id, nama_pencatat: who });
        if (buang) await ins('lot_log', { lot_id: l.id, tipe: 'opname', n: -(l.jumlah - tot), ket: 'selisih hitung saat pindah (kurang): ' + cat, oleh: S.me.id, nama_pencatat: who });
        await upd('lot', { id: l.id }, { jumlah: lebih || buang ? 0 : l.jumlah - tot }); await ins('lot_log', { lot_id: l.id, tipe: 'pindah_keluar', n: tot, ket: 'ke ' + Object.keys(per).join(', ') + (cat && (lebih || buang) ? ' · ' + cat : ''), oleh: S.me.id, nama_pencatat: who });
        close(); toast(`${fmt(tot)} bibit dipindah ke ${Object.keys(per).join(', ')}.${lebih ? ` Lebih ${fmt(tot - l.jumlah)} dicatat sebagai selisih.` : buang ? ` Selisih ${fmt(l.jumlah - tot)} dicatat.` : ''}`); renderNursery(shell);
      } catch (x) { q('#mvOk').disabled = false; fail(x.message); }
    });
  });
}

function bindDenah(shell) {
  const wrap = $('#dnWrap'), q = $('#dnQ'), hitsEl = $('#dnHits');
  let z = Number(lsGet('hm-nzoom', '0')) || 0, first = !z;
  const draw = () => {
    const r = denahSVG(denahQ); const fit = Math.max(.25, (wrap.clientWidth - 4) / (r.w || 1));
    if (!z) z = fit * 2; z = Math.max(fit, Math.min(3, z));
    wrap.innerHTML = r.svg; const svg = wrap.querySelector('svg'); if (svg) { svg.style.width = (r.w * z) + 'px'; svg.style.height = (r.h * z) + 'px'; }
    hitsEl.innerHTML = denahQ ? (r.hits.length ? r.hits.map(k => `<button type="button" class="chip" data-go="${esc(k)}">${esc(k)}</button>`).join('') : '<span class="small muted">Tidak ditemukan.</span>') : '';
    wrap.querySelectorAll('[data-bed]').forEach(g => { const open = () => bedSheet(g.dataset.bed, shell); g.addEventListener('click', open); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }); });
    hitsEl.querySelectorAll('[data-go]').forEach(c => c.addEventListener('click', () => { const g = document.getElementById('dn-' + c.dataset.go); if (g) { g.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); g.classList.add('pulse'); setTimeout(() => g.classList.remove('pulse'), 1600); } }));
    const fl = document.getElementById('dnFac'); if (fl) fl.textContent = r.facNames ? 'Fasilitas: ' + r.facNames + ' · garis biru = parit air.' : '';
    if (first) { first = false; wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; wrap.scrollTop = (wrap.scrollHeight - wrap.clientHeight) / 2; }
    if (denahQ && r.hits.length === 1) { const g = document.getElementById('dn-' + r.hits[0]); if (g) g.scrollIntoView({ block: 'center', inline: 'center' }); }
  };
  const zoom = k => { const cx = (wrap.scrollLeft + wrap.clientWidth / 2) / (wrap.scrollWidth || 1), cy = (wrap.scrollTop + wrap.clientHeight / 2) / (wrap.scrollHeight || 1); z *= k; lsSet('hm-nzoom', z); draw(); wrap.scrollLeft = cx * wrap.scrollWidth - wrap.clientWidth / 2; wrap.scrollTop = cy * wrap.scrollHeight - wrap.clientHeight / 2; };
  $('#dnIn').addEventListener('click', () => zoom(1.3)); $('#dnOut').addEventListener('click', () => zoom(1 / 1.3));
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { denahQ = q.value; draw(); }, 200); });
  draw();
}

// riwayat pengiriman & pengembalian, terlihat oleh semua akun (vendor hanya bloknya sendiri)
function riwayatBibit() {
  const ev = [
    ...S.kirim.filter(k => seesBlok(S.blokMap[k.blok_id])).map(k => ({ at: k.diterima_at || k.dikirim_at, t: `Kirim ${jn(k.jenis)} ${fmt(k.n)} → ${G.blokName(S.blokMap[k.blok_id])}`, s: k.status === 'diterima' ? `diterima ${nm(k.diterima_oleh)} ${tgl(k.diterima_at)} ${jam(k.diterima_at)}` : `dikirim ${nm(k.dikirim_oleh)} ${tgl(k.dikirim_at)} ${jam(k.dikirim_at)} · belum diterima`, k: k.status === 'diterima' ? 's-ok' : 's-warn' })),
    ...(S.kembali || []).filter(k => seesBlok(S.blokMap[k.blok_id])).map(k => ({ at: k.diterima_at || k.dikirim_at, t: `Kembali ${jn(k.jenis)} ${fmt(k.n)} (${k.kondisi === 'afkir' ? 'afkir' : 'sisa sehat'}) ← ${G.blokName(S.blokMap[k.blok_id])}`, s: k.status === 'diterima' ? `diterima nursery ${nm(k.diterima_oleh)} ${tgl(k.diterima_at)} ${jam(k.diterima_at)}` : `dikirim ${nm(k.dikirim_oleh)} ${tgl(k.dikirim_at)} ${jam(k.dikirim_at)} · belum diterima nursery`, k: k.status === 'diterima' ? 's-ok' : 's-warn' })),
    ...(S.kirim_mat || []).filter(k => seesBlok(S.blokMap[k.blok_id])).map(k => ({ at: k.diterima_at || k.dikirim_at, t: `Material ${k.barang} ${fmt(k.n, 1)} ${satB(k.barang)} → ${G.blokName(S.blokMap[k.blok_id])}${Number(k.sisa) ? ` (sisa kembali ${fmt(k.sisa, 1)})` : ''}`, s: k.status === 'diterima' ? `diterima ${nm(k.diterima_oleh)} ${tgl(k.diterima_at)} ${jam(k.diterima_at)}` : `dikirim ${nm(k.dikirim_oleh)} ${tgl(k.dikirim_at)} ${jam(k.dikirim_at)} · belum diterima`, k: k.status === 'diterima' ? 's-ok' : 's-warn' })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40);
  return `<div class="card stack"><h2>Riwayat kirim & kembali</h2>${ev.length ? `<div class="list">${ev.map(e => `<div class="item"><div class="grow"><b>${esc(e.t)}</b><span>${esc(e.s)}</span></div><span class="pill ${e.k}">${e.k === 's-ok' ? 'Diterima' : 'Dalam perjalanan'}</span></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Belum ada.</p>'}</div>`;
}
// ---------- surat jalan QR: serah terima bibit & material tanpa sinyal ----------
export function suratJalanSheet(bid) {
  const ks = S.kirim.filter(k => k.blok_id === bid && k.status === 'dikirim'), ms = (S.kirim_mat || []).filter(k => k.blok_id === bid && k.status === 'dikirim');
  if (!ks.length && !ms.length) return toast('Tidak ada kiriman yang belum diterima untuk blok ini.');
  const data = 'HMK1' + JSON.stringify({ b: bid, k: ks.map(k => [k.id, k.jenis, k.n, k.bedengan || '', k.minta_id || '', k.lot_id || '']), m: ms.map(k => [k.id, k.barang, Number(k.n), k.kel, k.periode_id || '']) });
  sheet(`<div class="stack"><h2>Surat jalan · ${esc(G.blokName(S.blokMap[bid]))}</h2><div id="sjqr" style="background:#fff;padding:12px;border-radius:12px;align-self:center"></div>
    <div class="small">${ks.map(k => `<div>• ${esc(jn(k.jenis))} ${fmt(k.n)} bibit dari ${esc(k.bedengan || '')}</div>`).join('')}${ms.map(k => `<div>• ${esc(k.barang)} ${fmt(k.n, 1)} ${esc(satB(k.barang))}</div>`).join('')}</div>
    <p class="note">Penerima (ExDAS/BUMDES/GL) membuka menu Kirim → <b>Scan QR surat jalan</b>, lalu scan kode ini. Bisa tanpa sinyal; data terkirim otomatis begitu ada sinyal.</p><button class="btn ghost block" data-close>Tutup</button></div>`, box => {
    try { new window.QRCode(box.querySelector('#sjqr'), { text: data, width: 260, height: 260, correctLevel: window.QRCode.CorrectLevel.L }); } catch (e) { box.querySelector('#sjqr').textContent = 'QR gagal dibuat: ' + e.message; }
  });
}
export async function terimaSuratJalan(text) {
  let d; try { d = JSON.parse(text.slice(4)); } catch (e) { return toast('QR surat jalan tidak terbaca.'); }
  const b = S.blokMap[d.b]; if (!b || !seesBlok(b)) return toast('Surat jalan ini bukan untuk blok pekerjaan akun Anda.');
  let nb = 0, nm2 = 0;
  for (const [id, jenis, n, bedengan, minta_id, lot_id] of d.k || []) {
    const ex = S.kirim.find(k => k.id === id); if (ex && ex.status === 'diterima') continue;
    if (!ex) S.kirim.push({ id, blok_id: d.b, jenis, n, bedengan, minta_id: minta_id || null, lot_id: lot_id || null, status: 'dikirim', dikirim_at: new Date().toISOString() });
    await upd('kirim', { id }, { status: 'diterima' }); nb += n;
  }
  S.kirim_mat = S.kirim_mat || [];
  for (const [id, barang, n, kel, periode_id] of d.m || []) {
    const ex = S.kirim_mat.find(k => k.id === id); if (ex && ex.status === 'diterima') continue;
    if (!ex) S.kirim_mat.push({ id, blok_id: d.b, barang, n, kel, periode_id: periode_id || null, status: 'dikirim', sisa: 0, dikirim_at: new Date().toISOString() });
    await upd('kirim_mat', { id }, { status: 'diterima', diterima_oleh: S.me.id, diterima_at: new Date().toISOString() }); nm2++;
  }
  toast(nb || nm2 ? `Diterima di ${G.blokName(b)}: ${nb ? fmt(nb) + ' bibit' : ''}${nb && nm2 ? ' + ' : ''}${nm2 ? nm2 + ' material' : ''}. ${navigator.onLine ? '' : 'Tersimpan di HP, terkirim saat ada sinyal.'}` : 'Kiriman di surat jalan ini sudah diterima sebelumnya.', 4500);
}
// ---------- material ke lapangan ----------
const satB = nama => S.barang.find(x => x.nama === nama)?.satuan || '';
function matSection() {
  const nurs = isRole('admin', 'nursery', 'crew');
  const dem = L.matDemand().filter(x => seesBlok(x.b));
  const jalan = (S.kirim_mat || []).filter(k => k.status === 'dikirim' && seesBlok(S.blokMap[k.blok_id]));
  const sisaOk = (S.kirim_mat || []).filter(k => k.status === 'diterima' && seesBlok(S.blokMap[k.blok_id]) && !k.sisa_at);
  return `<div class="card stack"><h2>Permintaan material (${dem.filter(x => x.kurang > 0).length})</h2>
    ${dem.map(x => { const opts = S.barang.filter(bg => bg.aktif !== false && x.match(bg)); const key = x.p.id + '-' + x.kel;
      return `<div class="sec"><div class="row between"><b>${esc(G.blokName(x.b))} · ${esc(x.lbl)}</b><span class="small ${x.kurang > 0 ? '' : 'muted'}">${fmt(x.sent, 1)} / ${fmt(x.need, x.sat === 'kg' ? 0 : 0)} ${x.sat}${x.kurang > 0 ? ' · kurang ' + fmt(x.kurang, 1) : ' · cukup'}</span></div>
      <p class="small muted" style="margin:0">${esc(G.TIPE_LBL[x.p.tipe])}${x.p.tipe === 'rotasi' ? ' ' + x.p.nomor : ''} · ${fmt(x.b.ha, 2)} Ha</p>
      ${nurs && x.kurang > 0 ? (opts.length ? `<div class="row" style="flex-wrap:nowrap"><select id="mb-${key}" aria-label="Barang">${opts.map(bg => `<option value="${esc(bg.nama)}">${esc(bg.nama)} (stok ${bg.stok == null ? '–' : fmt(bg.stok, 1)} ${esc(bg.satuan)})</option>`).join('')}</select><input type="number" min="0" step="any" inputmode="decimal" id="mn-${key}" value="${x.kurang ? +(x.kurang / L.unitK(opts[0].satuan, x.sat)).toFixed(2) : ''}" style="width:96px" aria-label="Jumlah"><button class="btn sm" data-mm="${key}">Kirim</button></div>` : `<p class="err" style="margin:0">Belum ada barang ${x.kel === 'lcc' ? 'berkategori LCC' : 'yang cocok'} di master gudang.</p>`) : ''}</div>`; }).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}
    <p class="note">Otomatis: petak BASTL diberi nama → pupuk kandang 2 kg/lubang & LCC 15 kg/Ha; retensi ExDAS mulai dan rotasi BUMDES → NPK 50 g/pohon untuk seluruh luas. Stok gudang berkurang saat dikirim.</p></div>
    <div class="card stack"><h2>Material dalam pengiriman (${jalan.length})</h2>${jalan.map(k => `<div class="row between"><span class="small"><b>${esc(k.barang)} ${fmt(k.n, 1)} ${esc(satB(k.barang))}</b> → ${esc(G.blokName(S.blokMap[k.blok_id]))}</span>${isRole('admin', 'owner', 'exdas', 'bumdes') ? `<button class="btn sm" data-mt="${k.id}">Terima</button>` : '<span class="small muted">menunggu lapangan</span>'}</div>`).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
    ${nurs && sisaOk.length ? `<div class="card stack"><h2>Sisa material kembali ke gudang</h2><p class="note" style="margin:0">Timbang sisa yang dibawa kembali dari lapangan, lalu catat. Stok gudang bertambah sesuai sisa.</p>${sisaOk.map(k => `<div class="row between"><span class="small"><b>${esc(k.barang)}</b> ${fmt(k.n, 1)} ${esc(satB(k.barang))} · ${esc(G.blokName(S.blokMap[k.blok_id]))} · diterima ${tgl(k.diterima_at)}</span><button class="btn ghost sm" data-ms="${k.id}">Catat sisa</button></div>`).join('')}</div>` : ''}`;
}
function bindMat(rerender) {
  $$('[data-mm]').forEach(b => b.addEventListener('click', async () => {
    const key = b.dataset.mm, x = L.matDemand().find(d => d.p.id + '-' + d.kel === key); if (!x) return;
    const nama = $('#mb-' + CSS.escape(key)).value, n = Number($('#mn-' + CSS.escape(key)).value); const bg = S.barang.find(z => z.nama === nama);
    if (!(n > 0)) return toast('Isi jumlah.');
    if (bg.stok == null) return toast(`Stok ${nama} belum valid. Lakukan opname di Gudang dulu.`, 4000);
    if (n > Number(bg.stok)) return toast(`Stok ${nama} hanya ${fmt(bg.stok, 1)} ${bg.satuan}.`);
    b.disabled = true;
    await ins('kirim_mat', { id: uid(), periode_id: x.p.id, blok_id: x.b.id, kel: x.kel, barang: nama, n, dikirim_oleh: S.me.id });
    await upd('barang', { nama }, { stok: Number(bg.stok) - n });
    await ins('barang_tx', { barang: nama, tipe: 'keluar', n, keperluan: x.kel === 'npk' ? 'Pemupukan' : 'Penanaman', lokasi: G.blokName(x.b), oleh: S.me.id });
    toast(`${nama} ${fmt(n, 1)} ${bg.satuan} dikirim ke ${G.blokName(x.b)}.`); rerender();
  }));
  $$('[data-mt]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; await upd('kirim_mat', { id: b.dataset.mt }, { status: 'diterima', diterima_oleh: S.me.id, diterima_at: new Date().toISOString() }); toast('Material diterima di lapangan.'); rerender(); }));
  $$('[data-ms]').forEach(b => b.addEventListener('click', () => {
    const k = S.kirim_mat.find(x => x.id === b.dataset.ms); const sat = satB(k.barang);
    sheet(`<form class="stack" id="msf"><h2>Sisa ${esc(k.barang)}</h2><p class="small" style="margin:0">Dikirim ${fmt(k.n, 1)} ${esc(sat)} ke ${esc(G.blokName(S.blokMap[k.blok_id]))}. Isi hasil timbang sisa (0 bila habis terpakai).</p><label class="f" for="msN">Sisa ditimbang (${esc(sat)})<input id="msN" type="number" min="0" max="${k.n}" step="any" inputmode="decimal" value="0"></label><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
      box.querySelector('#msf').addEventListener('submit', async e => {
        e.preventDefault(); const n = Number(box.querySelector('#msN').value); if (!(n >= 0) || n > Number(k.n)) return toast(`Isi 0–${fmt(k.n, 1)}.`);
        await upd('kirim_mat', { id: k.id }, { sisa: n, sisa_oleh: S.me.id, sisa_at: new Date().toISOString() });
        if (n > 0) { const bg = S.barang.find(z => z.nama === k.barang); await upd('barang', { nama: k.barang }, { stok: Number(bg?.stok || 0) + n }); await ins('barang_tx', { barang: k.barang, tipe: 'masuk', n, keperluan: 'Sisa dari lapangan', lokasi: G.blokName(S.blokMap[k.blok_id]), oleh: S.me.id }); }
        close(); toast(n > 0 ? `Sisa ${fmt(n, 1)} ${sat} masuk gudang.` : 'Tercatat habis terpakai.'); rerender();
      });
    });
  }));
}
// ---------- kirim bibit ----------
// nursery memilih bedengan BST asal; saran awal = lot yang paling lama mengendap
function sendFromStock(blok_id, minta_id, jk, n) {
  if (activeOpname()) { toast('Stock opname sedang berjalan. Kirim bibit dikunci sampai opname selesai.', 4000); return Promise.resolve(false); }
  const lots = L.readyLots(jk); const avail = lots.reduce((a, l) => a + l.jumlah, 0);
  if (!avail) { toast(`Stok siap ${jn(jk)} kosong.`); return Promise.resolve(false); }
  let left = Math.min(n, avail); const sug = lots.map(l => { const k = Math.min(l.jumlah, left); left -= k; return k; });
  return new Promise(res => {
    let done = false;
    const close = sheet(`<form class="stack" id="sf"><h2>Kirim ${esc(jn(jk))} → ${esc(G.blokName(S.blokMap[blok_id]))}</h2><p class="small" style="margin:0">Pilih bedengan BST asal dan jumlah dari tiap bedengan. Saran awal: bedengan yang paling lama mengendap.</p>
      <div class="list">${lots.map((l, i) => `<div class="item"><div class="grow"><b>${esc(l.bedengan)}</b><span>${fmt(l.jumlah)} siap · ${fmt(G.diffDays(G.today(), l.tgl_masuk))} hari di BST${l.sumber === 'beli' ? ' · bibit beli' : ''}</span></div><input type="number" min="0" max="${l.jumlah}" inputmode="numeric" data-li="${i}" value="${sug[i] || 0}" style="width:96px" aria-label="Jumlah dari ${esc(l.bedengan)}"></div>`).join('')}</div>
      <div class="row between"><span class="small">Diminta ${fmt(n)}</span><b id="sfT"></b></div><p class="err" id="sfE" hidden></p>
      <div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Kirim</button></div></form>`, (box, cl) => {
      const ins_ = [...box.querySelectorAll('[data-li]')], tot = () => ins_.reduce((a, x) => a + (Number(x.value) || 0), 0);
      const show = () => { box.querySelector('#sfT').textContent = 'Total dikirim ' + fmt(tot()); }; ins_.forEach(x => x.addEventListener('input', show)); show();
      box.querySelector('#sf').addEventListener('submit', async e => {
        e.preventDefault(); const er = box.querySelector('#sfE');
        const bad = ins_.find(x => !(Number(x.value) >= 0) || Number(x.value) > lots[+x.dataset.li].jumlah);
        if (bad) { er.textContent = `${lots[+bad.dataset.li].bedengan} hanya ${fmt(lots[+bad.dataset.li].jumlah)} siap kirim.`; er.hidden = false; return; }
        if (!tot()) { er.textContent = 'Isi jumlah dari minimal satu bedengan.'; er.hidden = false; return; }
        const sb = box.querySelector('button[type=submit]'); sb.disabled = true;
        for (const x of ins_) {
          const k = Number(x.value) || 0; if (!k) continue; const l = lots[+x.dataset.li];
          await upd('lot', { id: l.id }, { jumlah: l.jumlah - k });
          await ins('lot_log', { lot_id: l.id, tipe: 'kirim', n: k, ket: 'ke ' + G.blokName(S.blokMap[blok_id]), oleh: S.me.id, nama_pencatat: S.me.nama });
          await ins('kirim', { id: uid(), blok_id, minta_id, jenis: jk, n: k, lot_id: l.id, bedengan: l.bedengan, dikirim_oleh: S.me.id });
        }
        done = true; toast(`${fmt(tot())} ${jn(jk)} dikirim dari ${ins_.filter(x => Number(x.value) > 0).map(x => lots[+x.dataset.li].bedengan).join(', ')}.`); cl(); res(true);
      });
    });
    const iv = setInterval(() => { if (!document.getElementById('sf')) { clearInterval(iv); if (!done) res(false); } }, 400);
  });
}
export function renderKirim(shell) {
  const nurs = isRole('admin', 'nursery');
  const ready = L.readyStock();
  const opts = tipe => Object.entries(ready).filter(([k]) => tipe == null || (tipe === 'pio') === (S.jenisMap[k]?.tipe === 'pionir')).sort((a, b) => b[1] - a[1]);
  const sel = (id, tipe) => { const o = opts(tipe); return o.length ? `<select id="${id}" aria-label="Jenis">${o.map(([k, v]) => `<option value="${k}">${esc(jn(k))} (${fmt(v)})</option>`).join('')}</select>` : '<span class="err">Stok siap kirim kosong</span>'; };
  const tanam = L.tanamDemand().filter(m => seesBlok(S.blokMap[m.blok_id]));
  const sul = L.sulamDemand().filter(o => seesBlok(S.blokMap[o.blok_id]));
  const sent = S.kirim.filter(k => k.status === 'dikirim' && seesBlok(S.blokMap[k.blok_id]));
  const hourWIB = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  shell('Kirim bibit & material', null, `<div class="stack">
    ${nurs ? `<div class="alert">${hourWIB >= 18 ? 'Ringkasan permintaan hari ini sudah terkirim pukul 18.00 WIB.' : 'Ringkasan permintaan sulam dikumpulkan sepanjang hari dan dikirim pukul 18.00 WIB.'}</div>` : ''}
    <div class="card stack"><h2>Permintaan penanaman BASTL (${tanam.length})</h2>
      ${tanam.map(m => { const b = S.blokMap[m.blok_id]; const row = (lbl, t, need, got) => `<div class="sec"><div class="row between"><b>${lbl}</b><span class="small">${fmt(got)} / ${fmt(need)} ${got > need ? '· lebih ' + fmt(got - need) : got < need ? '· kurang ' + fmt(need - got) : ''}</span></div>${nurs ? `<div class="row" style="flex-wrap:nowrap">${sel(`mj-${m.id}-${t}`, t)}<input type="number" min="1" inputmode="numeric" id="mn-${m.id}-${t}" value="${Math.max(0, need - got) || ''}" style="width:96px" aria-label="Jumlah"><button class="btn sm" data-mk="${m.id}" data-t="${t}">Kirim</button></div>` : ''}</div>`;
        return `<div class="card tight"><div class="row between"><b>${esc(G.blokName(b))} · ${fmt(b.ha, 2)} Ha</b><span class="small muted">${tgl(m.created_at)}</span></div>${row('Pioneer', 'pio', m.pio, m.sent.pio - m.kembali.pio)}${row('Sisipan', 'sis', m.sis, m.sent.sis - m.kembali.sis)}${m.kembali.pio + m.kembali.sis ? `<p class="note" style="margin:0">Sudah dikurangi ${fmt(m.kembali.pio + m.kembali.sis)} bibit yang dikembalikan atau afkir di lapangan.</p>` : ''}</div>`; }).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}
      <p class="note">Boleh dikirim bertahap, kurang, atau lebih. Setelah menekan Kirim, pilih bedengan BST asal (saran awal: yang paling lama mengendap).</p></div>
    <div class="card stack"><h2>Permintaan sulam (${sul.length} blok)</h2>
      ${sul.map(o => { const b = S.blokMap[o.blok_id]; return `<div class="card tight stack"><div class="row between"><b>${esc(G.blokName(b))}</b><span class="pill ${o.kurang ? 's-warn' : 's-ok'}">${o.kurang ? 'kurang ' + fmt(o.kurang) : 'cukup'}</span></div><div class="chips">${Object.entries(o.perJenis).map(([k, v]) => `<span class="chip">${esc(jn(k))} mati ${v}</span>`).join('')}</div><p class="small" style="margin:0">${o.total} tag perlu disulam · ${fmt(o.tersedia)} bibit sudah di penampungan/pengiriman.</p>${nurs ? `<div class="row" style="flex-wrap:nowrap">${sel(`sj-${o.blok_id}`)}<input type="number" min="1" inputmode="numeric" id="sn-${o.blok_id}" value="${o.kurang || ''}" style="width:96px" aria-label="Jumlah"><button class="btn sm" data-sk="${esc(o.blok_id)}">Kirim</button></div>` : ''}</div>`; }).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}
      <p class="note">Digabung per blok dan jenis yang mati. Orang lapangan menentukan jenis yang dipakai; saat scan sulam, aplikasi hanya menawarkan jenis yang cocok untuk titik itu.</p></div>
    ${isRole('admin', 'owner', 'exdas', 'bumdes') ? '<button class="btn block" id="sjScan">Scan QR surat jalan (terima bibit & material)</button>' : ''}
    ${nurs && [...new Set([...sent.map(k => k.blok_id), ...(S.kirim_mat || []).filter(k => k.status === 'dikirim').map(k => k.blok_id)])].length ? `<div class="card stack"><h2>Surat jalan QR</h2><p class="note" style="margin:0">Tunjukkan QR saat serah terima. Penerima cukup scan, tanpa perlu sinyal.</p><div class="chips">${[...new Set([...sent.map(k => k.blok_id), ...(S.kirim_mat || []).filter(k => k.status === 'dikirim').map(k => k.blok_id)])].map(bid => `<button type="button" class="chip" data-sj="${esc(bid)}">QR ${esc(G.blokName(S.blokMap[bid]))}</button>`).join('')}</div></div>` : ''}
    <div class="card stack"><h2>Dalam pengiriman (${sent.length})</h2>${sent.length ? `<div class="tbl"><table><thead><tr><th>Blok</th><th>Jenis</th><th class="r">Jml</th><th>Dari</th><th></th></tr></thead><tbody>${sent.map(k => `<tr><td>${esc(G.blokName(S.blokMap[k.blok_id]))}</td><td>${esc(jn(k.jenis))}</td><td class="r">${fmt(k.n)}</td><td>${esc(k.bedengan || '')}</td><td>${isRole('admin', 'owner', 'exdas', 'bumdes') ? `<button class="btn sm" data-tr="${k.id}">Terima</button>` : '<span class="small muted">menunggu</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small" style="margin:0">Tidak ada.</p>'}<p class="note">Serah terima di aplikasi: nursery menekan Kirim, lapangan menekan Terima.</p></div>
    ${matSection()}${riwayatBibit()}</div>`);
  bindMat(() => renderKirim(shell));
  $$('[data-sj]').forEach(b => b.addEventListener('click', () => suratJalanSheet(b.dataset.sj)));
  const sjs = $('#sjScan'); if (sjs) sjs.addEventListener('click', async () => { const t = await scanQR('Scan QR surat jalan dari HP nursery'); if (!t) return; if (!t.startsWith('HMK1')) return toast('Ini bukan QR surat jalan.'); await terimaSuratJalan(t); renderKirim(shell); });
  $$('[data-mk]').forEach(b => b.addEventListener('click', async () => { const m = S.minta.find(x => x.id === b.dataset.mk), t = b.dataset.t; const s = $(`#mj-${m.id}-${t}`); if (!s) return; const n = Number($(`#mn-${m.id}-${t}`).value); if (!(n > 0)) return toast('Isi jumlah.'); b.disabled = true; if (await sendFromStock(m.blok_id, m.id, s.value, n)) renderKirim(shell); b.disabled = false; }));
  $$('[data-sk]').forEach(b => b.addEventListener('click', async () => { const bid = b.dataset.sk; const s = $(`#sj-${CSS.escape(bid)}`); if (!s) return; const n = Number($(`#sn-${CSS.escape(bid)}`).value); if (!(n > 0)) return toast('Isi jumlah.'); b.disabled = true; if (await sendFromStock(bid, null, s.value, n)) renderKirim(shell); b.disabled = false; }));
  $$('[data-tr]').forEach(b => b.addEventListener('click', async () => { await upd('kirim', { id: b.dataset.tr }, { status: 'diterima' }); toast('Bibit diterima di lapangan.'); renderKirim(shell); }));
}

// ---------- penampungan: bibit kembali dari lapangan ----------
const kLogs = k => (S.kembali_log || []).filter(x => x.kembali_id === k.id);
const kSisa = k => k.n - kLogs(k).reduce((a, x) => a + x.n, 0);
const bstFor = jk => { const c = S.jenisMap[jk]?.tipe === 'pionir' ? 'BF' : 'BL', ok = x => L.fill(x.kode) < (x.kapasitas || 1300); return [...L.realBST(c).filter(ok), ...L.realBST(c === 'BF' ? 'BL' : 'BF').filter(ok), ...L.pinjamBST().filter(ok)]; };
const roomOf = k => (S.bedMap[k]?.kapasitas || 1300) - L.fill(k);
// sisa hari pengembalian setelah blok closing (null bila blok masih berjalan)
export function kembaliDue(bid) { const p = L.aktif(bid), last = L.periodes(bid).filter(x => x.status === 'selesai').pop(); return !p && last ? 3 - G.diffDays(G.today(), G.tglWIB(last.approved_at)) : null; }

// dipanggil dari detail blok: vendor/GL mengembalikan sisa sehat & afkir ke nursery
export function kembaliSheet(bid, onDone) {
  const st = L.stokTampung(bid); const ks = Object.keys(st);
  if (!ks.length) return toast('Tidak ada bibit di lapangan untuk blok ini.');
  sheet(`<form class="stack" id="kf"><h2>Kembalikan bibit ke nursery</h2><p class="small" style="margin:0">${esc(G.blokName(S.blokMap[bid]))} · isi jumlah yang dibawa kembali per jenis.</p>
    ${ks.map(k => `<div class="sec"><div class="row between"><b>${esc(jn(k))}</b><span class="small muted">di lapangan ${fmt(st[k])}</span></div><div class="grid2"><label class="f">Sisa sehat<input type="number" min="0" max="${st[k]}" inputmode="numeric" data-k="${k}" data-c="sehat" value="0"></label><label class="f">Afkir<input type="number" min="0" max="${st[k]}" inputmode="numeric" data-k="${k}" data-c="afkir" value="0"></label></div></div>`).join('')}
    <p class="note">Bibit masuk ke penampungan nursery setelah diterima tim nursery. Sisa sehat masuk bedengan BST setelah disetujui GL Nursery; afkir dirawat dulu.</p><p class="err" id="kfE" hidden></p>
    <div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Kirim ke nursery</button></div></form>`, (box, close) => {
    box.querySelector('#kf').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#kfE'); const rows = [];
      for (const k of ks) {
        const se = Number(box.querySelector(`[data-k="${k}"][data-c="sehat"]`).value) || 0, af = Number(box.querySelector(`[data-k="${k}"][data-c="afkir"]`).value) || 0;
        if (se < 0 || af < 0 || se + af > st[k]) { er.textContent = `${jn(k)}: jumlah sehat + afkir maksimal ${fmt(st[k])}.`; er.hidden = false; return; }
        const src = S.kirim.filter(x => x.blok_id === bid && x.jenis === k).pop();
        if (se) rows.push({ id: uid(), blok_id: bid, jenis: k, n: se, kondisi: 'sehat', lot_src: src?.lot_id || null, dikirim_oleh: S.me.id });
        if (af) rows.push({ id: uid(), blok_id: bid, jenis: k, n: af, kondisi: 'afkir', lot_src: src?.lot_id || null, dikirim_oleh: S.me.id });
      }
      if (!rows.length) { er.textContent = 'Isi jumlah yang dikembalikan.'; er.hidden = false; return; }
      await ins('kembali', rows); close(); toast(`${fmt(rows.reduce((a, r) => a + r.n, 0))} bibit dikirim kembali, menunggu diterima nursery.`); onDone && onDone();
    });
  });
}
async function toBST(k, n, bed, who, tipe) {
  const sl = S.lot.find(l => l.id === k.lot_src);
  const same = S.lot.find(l => l.bedengan === bed && l.jenis === k.jenis && sl && l.tgl_sapih === sl.tgl_sapih && (l.beli_id || null) === (sl.beli_id || null) && !l.aklim_sampai);
  let lotId;
  if (same) { lotId = same.id; await upd('lot', { id: same.id }, { jumlah: same.jumlah + n }); }
  else { lotId = uid(); await ins('lot', { id: lotId, bedengan: bed, jenis: k.jenis, jumlah: n, tgl_sapih: sl?.tgl_sapih || G.addDays(G.today(), -84), tgl_masuk: sl?.tgl_masuk || G.addDays(G.today(), -14), sumber: sl?.sumber || 'mandiri', beli_id: sl?.beli_id || null, created_by: S.me.id }); }
  await ins('lot_log', { lot_id: lotId, tipe: tipe === 'afkir' ? 'pulih' : 'kembali', n, ket: (tipe === 'afkir' ? 'afkir pulih dari ' : 'sisa dari ') + G.blokName(S.blokMap[k.blok_id]), oleh: S.me.id, nama_pencatat: who });
  await ins('kembali_log', { kembali_id: k.id, tipe: 'masuk_bst', n, bedengan: bed, lot_id: lotId, oleh: S.me.id, nama_pencatat: who });
}
function procSheet(k, act, shell) {
  const max = kSisa(k), beds = bstFor(k.jenis), src = S.kirim.find(x => x.lot_id === k.lot_src);
  const title = act === 'mati' ? 'Afkir mati / dibuang' : k.kondisi === 'sehat' ? 'Setujui masuk bedengan BST' : 'Afkir pulih → BST';
  const bedRow = (sel, n) => `<div class="row pfrow" style="flex-wrap:nowrap;gap:6px"><select class="pfB" aria-label="Bedengan tujuan">${beds.map(x => `<option value="${x.kode}" ${x.kode === sel ? 'selected' : ''}>${x.kode} · muat ${fmt(roomOf(x.kode))}${L.lotsIn(x.kode).some(l => l.jenis === k.jenis) ? ' · jenis sama' : L.fill(x.kode) ? '' : ' · kosong'}</option>`).join('')}</select><input class="pfN" type="number" min="0" inputmode="numeric" value="${n}" style="width:90px" aria-label="Jumlah"></div>`;
  const first = beds.find(x => x.kode === src?.bedengan) || beds.find(x => L.lotsIn(x.kode).some(l => l.jenis === k.jenis)) || beds[0];
  sheet(`<form class="stack" id="pf"><h2>${title}</h2><p class="small" style="margin:0">${esc(jn(k.jenis))} dari ${esc(G.blokName(S.blokMap[k.blok_id]))} · tersisa ${fmt(max)}</p>
    ${act === 'mati' ? `<label class="f" for="pfN">Jumlah<input id="pfN" type="number" min="1" max="${max}" inputmode="numeric" value="${max}"></label>` : beds.length ? `<div class="stack" style="gap:6px"><span class="small"><b>Bedengan BST tujuan</b> · boleh dibagi ke beberapa bedengan</span><div id="pfRows">${bedRow(first?.kode, Math.min(max, first ? roomOf(first.kode) : max))}</div><button type="button" class="btn ghost sm" id="pfAdd">+ Bedengan lain</button><div class="small" id="pfT"></div></div>` : '<p class="err">Tidak ada bedengan BST yang muat.</p>'}
    ${crewName()}<p class="err" id="pfE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    const rows = () => [...box.querySelectorAll('.pfrow')].map(r => ({ bed: r.querySelector('.pfB').value, n: Number(r.querySelector('.pfN').value) || 0 }));
    const show = () => { const t = box.querySelector('#pfT'); if (t) t.textContent = `Total ${fmt(rows().reduce((a, r) => a + r.n, 0))} dari ${fmt(max)}`; };
    box.addEventListener('input', show); show();
    const add = box.querySelector('#pfAdd'); if (add) add.addEventListener('click', () => { const used = rows().reduce((a, r) => a + r.n, 0); const nx = beds.find(x => !rows().some(r => r.bed === x.kode)); box.querySelector('#pfRows').insertAdjacentHTML('beforeend', bedRow(nx?.kode, Math.max(0, max - used))); show(); });
    box.querySelector('#pf').addEventListener('submit', async e => {
      e.preventDefault(); const er = box.querySelector('#pfE'), who = getCrew(box); const fail = m => { er.textContent = m; er.hidden = false; };
      if (!who) return fail('Isi nama pencatat.');
      if (act === 'mati') { const n = Number(box.querySelector('#pfN').value); if (!(n > 0) || n > max) return fail(`Isi jumlah 1–${fmt(max)}.`); await ins('kembali_log', { kembali_id: k.id, tipe: 'mati', n, oleh: S.me.id, nama_pencatat: who }); toast(`${fmt(n)} afkir dibuang tercatat.`); close(); return renderTampung(shell); }
      const rs = rows().filter(r => r.n > 0); const tot = rs.reduce((a, r) => a + r.n, 0);
      if (!rs.length) return fail('Isi jumlah untuk minimal satu bedengan.');
      if (tot > max) return fail(`Total ${fmt(tot)} melebihi sisa ${fmt(max)}.`);
      const per = {}; rs.forEach(r => per[r.bed] = (per[r.bed] || 0) + r.n);
      for (const [bed, n] of Object.entries(per)) if (n > roomOf(bed)) return fail(`${bed} hanya muat ${fmt(roomOf(bed))} lagi.`);
      box.querySelector('button[type=submit]').disabled = true;
      for (const [bed, n] of Object.entries(per)) await toBST(k, n, bed, who, k.kondisi);
      toast(`${fmt(tot)} ${jn(k.jenis)} masuk ${Object.keys(per).join(', ')}.`); close(); renderTampung(shell);
    });
  });
}
export function renderTampung(shell) {
  const nurs = isRole('admin', 'nursery'), care = isRole('admin', 'nursery', 'crew');
  const mine = (S.kembali || []).filter(k => seesBlok(S.blokMap[k.blok_id]));
  const jalan = mine.filter(k => k.status === 'dikirim');
  const sehat = mine.filter(k => k.status === 'diterima' && k.kondisi === 'sehat' && kSisa(k) > 0);
  const afkir = mine.filter(k => k.status === 'diterima' && k.kondisi === 'afkir' && kSisa(k) > 0);
  const lap = S.blok.filter(b => seesBlok(b) && b.layer !== 'berhasil').map(b => ({ b, st: L.stokTampung(b.id), due: kembaliDue(b.id) })).filter(x => Object.keys(x.st).length);
  const row = (k, btns) => `<div class="sec"><div class="row between"><b>${esc(jn(k.jenis))}</b><span class="mono">${fmt(kSisa(k))} bibit</span></div><p class="small" style="margin:0">dari ${esc(G.blokName(S.blokMap[k.blok_id]))} · ${tgl(k.diterima_at || k.dikirim_at)} · oleh ${esc(nm(k.dikirim_oleh))}</p>${btns}</div>`;
  shell('Penampungan', 'Bibit kembali dari lapangan', `<div class="stack">
    <div class="card stack"><h2>Dalam perjalanan kembali (${jalan.length})</h2>${jalan.map(k => `<div class="row between"><span class="small"><b>${esc(jn(k.jenis))} ${fmt(k.n)}</b> · ${k.kondisi === 'afkir' ? 'afkir' : 'sisa sehat'} · dari ${esc(G.blokName(S.blokMap[k.blok_id]))}</span>${nurs ? `<button class="btn sm" data-kt="${k.id}">Terima</button>` : '<span class="small muted">menunggu nursery</span>'}</div>`).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
    <div class="card stack"><h2>Sisa sehat · menunggu persetujuan GL Nursery (${sehat.length})</h2>${sehat.map(k => row(k, nurs ? `<button class="btn sm" data-ks="${k.id}">Setujui → bedengan BST</button>` : '')).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
    <div class="card stack"><h2>Afkir dari lapangan · dirawat (${afkir.length})</h2>${afkir.map(k => row(k, care ? `<div class="grid2"><button class="btn ghost sm" data-km="${k.id}">Mati, dibuang</button><button class="btn sm" data-kp="${k.id}">Pulih → BST</button></div>` : '')).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
    ${afkirCard()}
    ${lap.length ? `<div class="card stack"><h2>Masih di lapangan (${lap.length} blok)</h2><div class="alert warn">Sebelum stock opname bulanan, semua bibit di lapangan harus sudah kembali ke nursery. Setelah blok closing, sisa dikembalikan ≤ 3 hari.</div><div class="list">${lap.map(x => `<a class="item" href="#blok/${encodeURIComponent(x.b.id)}"><div class="grow"><b>${esc(G.blokName(x.b))}</b><span>${Object.entries(x.st).map(([k, v]) => esc(jn(k)) + ' ' + fmt(v)).join(' · ')}</span></div>${x.due != null ? `<span class="pill ${x.due < 0 ? 's-bad' : 's-warn'}">${x.due < 0 ? 'Lewat ' + (-x.due) + ' hari' : 'Kembalikan ≤ ' + x.due + ' hari'}</span>` : '<span class="pill s-pend">Berjalan</span>'}</a>`).join('')}</div><p class="note">Pengembalian dicatat oleh vendor atau GL dari halaman blok (tombol Kembalikan ke nursery).</p></div>` : ''}
  </div>`);
  bindBeli(document.getElementById('main'), () => renderTampung(shell));
  $$('[data-kt]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; await upd('kembali', { id: b.dataset.kt }, { status: 'diterima', diterima_oleh: S.me.id, diterima_at: new Date().toISOString() }); toast('Diterima di penampungan.'); renderTampung(shell); }));
  const find = id => S.kembali.find(x => x.id === id);
  $$('[data-ks]').forEach(b => b.addEventListener('click', () => procSheet(find(b.dataset.ks), 'bst', shell)));
  $$('[data-kp]').forEach(b => b.addEventListener('click', () => procSheet(find(b.dataset.kp), 'bst', shell)));
  $$('[data-km]').forEach(b => b.addEventListener('click', () => procSheet(find(b.dataset.km), 'mati', shell)));
}
function qtySheet(title, max, extra, onOk) {
  sheet(`<form class="stack" id="qf"><h2>${esc(title)}</h2><label class="f" for="qN">Jumlah <small>maks ${fmt(max)}</small><input id="qN" type="number" min="1" max="${max}" inputmode="numeric" value="${max}"></label>${extra || ''}<p class="note">Dikonfirmasi bersama orang nursery dan orang lapangan.</p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    box.querySelector('#qf').addEventListener('submit', async e => { e.preventDefault(); const n = Number(box.querySelector('#qN').value); if (!(n > 0) || n > max) return toast(`Isi jumlah 1–${fmt(max)}.`); await onOk(n, box); close(); });
  });
}

// ---------- gudang ----------
let gTab = 'material', gQ = '';
const KEP = ['Pemupukan', 'Penyemprotan', 'Penanaman', 'Penyulaman', 'Pengisian polybag', 'Penyapihan', 'Spraying fungisida', 'Spraying insektisida', 'Improvement', 'Lainnya'];
const LOK = ['Nursery', 'Highwall', 'Enviro', 'Area improvement', 'Area keterlanjuran', 'Setpond', 'Pembuangan'];
const grp = (list, row) => { const g = {}; list.forEach(x => { const k = x.kategori || 'Tanpa kategori'; (g[k] = g[k] || []).push(x); }); return Object.keys(g).sort().map(k => `<h3 style="margin:12px 0 4px">${esc(k)} (${g[k].length})</h3><div class="list">${g[k].map(row).join('')}</div>`).join('') || '<p class="muted">Tidak ada.</p>'; };
// Penerimaan barang: satu surat jalan / PO untuk banyak barang, satu foto bukti; barang baru bisa langsung ditambahkan
function terimaBarangSheet(shell) {
  const can = isRole('admin', 'nursery'); const names = S.barang.filter(m => m.aktif !== false).map(m => m.nama).sort();
  const cats = [...new Set(S.barang.map(m => m.kategori).filter(Boolean))].sort();
  const row = () => `<div class="sec tbrow stack" style="gap:6px"><div class="grid2" style="grid-template-columns:1fr 100px auto;align-items:end"><label class="f">Barang<input class="tbB" list="dlBrg" placeholder="ketik nama barang"></label><label class="f">Jumlah<input class="tbN" type="number" min="0" step="any" inputmode="decimal"></label><button type="button" class="btn ghost sm tbDel" aria-label="Hapus">✕</button></div>
    <p class="small tbInfo" style="margin:0"></p><div class="grid2 tbNew" hidden><label class="f">Kategori<input class="tbK" list="dlKat"></label><label class="f">Satuan<input class="tbS" list="dlSat" placeholder="kg, roll, lembar"></label></div></div>`;
  sheet(`<form class="stack" id="tb"><h2>Penerimaan barang</h2>
    <div class="grid2"><label class="f" for="tbV">Pemasok<input id="tbV" placeholder="nama toko / vendor"></label><label class="f" for="tbD">No. surat jalan / PO<input id="tbD" placeholder="mis. SJ-0123"></label></div>
    <button type="button" class="btn ghost block" id="tbF">Foto bukti (surat jalan / DO / PO)</button><p class="note" id="tbFs" style="margin:0">Belum ada bukti.</p>
    <datalist id="dlBrg">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist><datalist id="dlKat">${cats.map(n => `<option value="${esc(n)}">`).join('')}</datalist><datalist id="dlSat">${['kg', 'gram', 'sak', 'liter', 'ml', 'pcs', 'roll', 'lembar', 'meter', 'botol', 'pak', 'dus', 'karung', 'unit'].map(n => `<option value="${n}">`).join('')}</datalist>
    <div id="tbRows">${row()}</div><button type="button" class="btn ghost sm" id="tbAdd">+ Barang lain</button>
    ${crewName()}<p class="err" id="tbE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit" id="tbOk">Simpan semua</button></div></form>`, (box, close) => {
    const q = x => box.querySelector(x); let bukti = null;
    const find = n => S.barang.find(m => m.nama.toLowerCase() === String(n).trim().toLowerCase());
    const bind = r => { const upd1 = () => { const nm1 = r.querySelector('.tbB').value.trim(), m = find(nm1), info = r.querySelector('.tbInfo'); r.querySelector('.tbNew').hidden = !nm1 || !!m;
        info.innerHTML = !nm1 ? '' : m ? `Stok sekarang ${m.stok == null ? 'belum dihitung' : fmt(m.stok, 2)} ${esc(m.satuan || '')} · masuk dalam satuan <b>${esc(m.satuan || '-')}</b>` : can ? '<b>Barang baru</b>: isi kategori dan satuan, otomatis ditambahkan ke daftar.' : '<b style="color:var(--bad)">Barang belum terdaftar.</b> Barang baru hanya bisa ditambah GL Nursery.'; };
      r.querySelector('.tbB').addEventListener('input', upd1); r.querySelector('.tbDel').addEventListener('click', () => { if (box.querySelectorAll('.tbrow').length > 1) r.remove(); else { r.querySelectorAll('input').forEach(x => x.value = ''); upd1(); } }); };
    box.querySelectorAll('.tbrow').forEach(bind);
    q('#tbAdd').addEventListener('click', () => { q('#tbRows').insertAdjacentHTML('beforeend', row()); bind([...box.querySelectorAll('.tbrow')].pop()); [...box.querySelectorAll('.tbB')].pop().focus(); });
    q('#tbF').addEventListener('click', async () => { const f = await pickPhoto({ gallery: true, title: 'Foto bukti penerimaan barang' }); if (!f) return; q('#tbFs').textContent = 'Mengunggah…'; try { const path = `bukti/terima-${Date.now()}.jpg`; await SB.upload('scan', path, f); bukti = path; q('#tbFs').textContent = 'Bukti terunggah.'; } catch (e) { bukti = null; q('#tbFs').textContent = e.net ? 'Gagal unggah: tidak ada sinyal.' : 'Gagal unggah: ' + e.message; } });
    q('#tb').addEventListener('submit', async e => {
      e.preventDefault(); const er = q('#tbE'), fail = m => { er.textContent = m; er.hidden = false; };
      const who = getCrew(box); if (!who) return fail('Isi nama pencatat.');
      const vend = q('#tbV').value.trim(), doc = q('#tbD').value.trim(); if (!vend && !doc) return fail('Isi pemasok atau nomor surat jalan / PO.');
      if (!bukti) return fail('Lampirkan foto bukti (surat jalan / DO / PO).');
      const items = {}, baru = {};
      for (const r of box.querySelectorAll('.tbrow')) {
        const nm1 = r.querySelector('.tbB').value.trim(), n = Number(r.querySelector('.tbN').value); if (!nm1 && !r.querySelector('.tbN').value) continue;
        if (!nm1) return fail('Ada baris tanpa nama barang.'); if (!(n > 0)) return fail(`Isi jumlah ${nm1}.`);
        const m = find(nm1);
        if (!m) { if (!can) return fail(`${nm1} belum terdaftar. Minta GL Nursery menambahkannya.`); const kat = r.querySelector('.tbK').value.trim(), sat = r.querySelector('.tbS').value.trim(); if (!kat || !sat) return fail(`Isi kategori dan satuan untuk barang baru ${nm1}.`); baru[nm1.toLowerCase()] = { nama: nm1.replace(/^./, c => c.toUpperCase()), kategori: kat, satuan: sat }; }
        const key = (m ? m.nama : nm1).toLowerCase(); items[key] = { nama: m ? m.nama : baru[nm1.toLowerCase()].nama, n: (items[key]?.n || 0) + n };
      }
      const list = Object.values(items); if (!list.length) return fail('Isi minimal satu barang.');
      q('#tbOk').disabled = true; const ket = ['Penerimaan', doc, vend].filter(Boolean).join(' · ') + ' · ' + who;
      try {
        for (const b of Object.values(baru)) await ins('barang', { nama: b.nama, kategori: b.kategori, satuan: b.satuan, minimum: null, stok: null, aktif: true }, { offline: false });
        for (const it of list) { const m = find(it.nama); await ins('barang_tx', { barang: it.nama, tipe: 'masuk', n: it.n, keperluan: ket, lokasi: 'Gudang', bukti, oleh: S.me.id }); await upd('barang', { nama: it.nama }, { stok: Number(m?.stok || 0) + it.n }); }
        close(); toast(`${list.length} barang diterima${Object.keys(baru).length ? `, ${Object.keys(baru).length} barang baru ditambahkan` : ''}.`, 3500); renderGudang(shell);
      } catch (x) { q('#tbOk').disabled = false; fail(x.net ? 'Butuh sinyal untuk menambah barang baru.' : x.message); }
    });
  });
}
let gKond = 'semua';
// kondisi alat: tandai rusak, sudah diperbaiki, dibuang (afkir), hilang — semua tercatat di riwayat alat
function kondisiSheet(a, shell) {
  const rs = Number(a.rusak) || 0, stok = Number(a.stok) || 0, dip = S.pinjam.filter(p => !p.kembali_at && p.alat_id === a.id).length, baikSisa = stok - rs - dip;
  const T = { rusak: ['Tandai rusak', baikSisa, 'unit baik di gudang'], baik: ['Sudah diperbaiki', rs, 'unit rusak'], buang: ['Dibuang / afkir', rs, 'unit rusak'], hilang: ['Hilang', baikSisa, 'unit baik di gudang'] };
  const log = (S.alat_log || []).filter(x => x.alat_id === a.id).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 10);
  let t = baikSisa > 0 ? 'rusak' : 'baik';
  sheet(`<form class="stack" id="ak"><h2>${esc(a.nama)}</h2><p class="small" style="margin:0">Stok ${fmt(stok)} ${esc(a.satuan || '')} · baik ${fmt(stok - rs)} · rusak ${fmt(rs)}${dip ? ' · dipinjam ' + dip : ''}</p>
    <div class="seg" style="flex-wrap:wrap">${Object.entries(T).map(([k, v]) => `<button type="button" data-t="${k}" class="${k === t ? 'on' : ''}" ${v[1] > 0 ? '' : 'disabled'}>${v[0]}</button>`).join('')}</div>
    <label class="f" for="akN">Jumlah <small id="akM"></small><input id="akN" type="number" min="1" inputmode="numeric" value="1"></label>
    <label class="f" for="akK">Keterangan <small>wajib</small><input id="akK" placeholder="mis. gagang patah, mesin mati, dibuang ke TPS"></label>${crewName()}
    ${log.length ? `<details class="sec"><summary class="small"><b>Riwayat kondisi (${log.length})</b></summary><ul class="small" style="margin:6px 0 0;padding-left:18px">${log.map(x => `<li>${tgl(x.at)} · ${esc(T[x.tipe]?.[0] || x.tipe)} ${fmt(x.n)} · ${esc(x.ket || '')} · ${esc(x.nama_pencatat || nm(x.oleh))}</li>`).join('')}</ul></details>` : ''}
    <p class="err" id="akE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
    const q = x => box.querySelector(x); const sync = () => { q('#akM').textContent = `maks ${fmt(T[t][1])} ${T[t][2]}`; };
    box.querySelectorAll('[data-t]').forEach(x => x.addEventListener('click', () => { t = x.dataset.t; box.querySelectorAll('[data-t]').forEach(y => y.classList.toggle('on', y === x)); sync(); })); sync();
    q('#ak').addEventListener('submit', async e => {
      e.preventDefault(); const er = q('#akE'), fail = m => { er.textContent = m; er.hidden = false; };
      const n = Math.round(Number(q('#akN').value)), ket = q('#akK').value.trim(), who = getCrew(box);
      if (!who) return fail('Isi nama pencatat.'); if (!(n > 0)) return fail('Isi jumlah.'); if (n > T[t][1]) return fail(`Maksimal ${fmt(T[t][1])} ${T[t][2]}.`); if (!ket) return fail('Isi keterangan.');
      const patch = t === 'rusak' ? { rusak: rs + n } : t === 'baik' ? { rusak: rs - n } : t === 'buang' ? { rusak: rs - n, stok: stok - n } : { stok: stok - n };
      try { await upd('alat', { id: a.id }, patch, { offline: false }); await ins('alat_log', { alat_id: a.id, tipe: t, n, ket, oleh: S.me.id, nama_pencatat: who }); close(); toast(`${a.nama}: ${T[t][0].toLowerCase()} ${fmt(n)}.`); renderGudang(shell); }
      catch (x) { fail(x.net ? 'Butuh sinyal.' : x.message); }
    });
  });
}
export function renderGudang(shell) {
  const can = isRole('admin', 'nursery', 'crew');
  const st = m => m.stok == null ? ['s-idle', 'Perlu opname'] : Number(m.stok) < Number(m.minimum) ? ['s-warn', 'Di bawah minimum'] : ['s-ok', 'Aman'];
  const dip = S.pinjam.filter(p => !p.kembali_at);
  const alat = S.alat.filter(a => a.aktif !== false && (!gQ || a.nama.toLowerCase().includes(gQ.toLowerCase())));
  shell('Gudang', null, `<div class="stack">
    <div class="seg"><button data-g="material" class="${gTab === 'material' ? 'on' : ''}">Habis pakai</button><button data-g="alat" class="${gTab === 'alat' ? 'on' : ''}">Alat dipinjam</button></div>
    ${gTab === 'material' ? `<input id="gq" placeholder="Cari barang" value="${esc(gQ)}" aria-label="Cari barang">${isRole('admin', 'nursery', 'crew') ? '<button class="btn block" id="gTrm">Penerimaan barang (satu surat jalan, banyak barang)</button>' : ''}${isRole('admin', 'nursery') ? `<button class="btn ghost block" id="gNew">+ Tambah barang baru${gQ && !S.barang.some(m => m.nama.toLowerCase().includes(gQ.toLowerCase())) ? ` "${esc(gQ)}"` : ''}</button>` : ''}${grp(S.barang.filter(m => m.aktif !== false && (!gQ || (m.nama + ' ' + (m.kategori || '')).toLowerCase().includes(gQ.toLowerCase()))), m => { const [c, t] = st(m); return `<div class="item"><div class="grow"><b>${esc(m.nama)}</b><span>${m.stok == null ? '–' : fmt(m.stok, Number(m.stok) % 1 ? 2 : 0)} ${esc(m.satuan)} · min ${fmt(m.minimum)} ${esc(m.satuan)}</span></div><span class="pill ${c}">${t}</span>${can ? `<button class="btn ghost sm" data-bx="${esc(m.nama)}">Catat</button>` : ''}</div>`; })}<p class="note">Stok dihitung dari masuk − keluar. Item "Perlu opname" menunggu hitung fisik. Kohe 25 kg/sak, arang sekam 25 kg/sak.</p>`
      : `<input id="gq" placeholder="Cari alat" value="${esc(gQ)}" aria-label="Cari alat">
        <div class="seg" role="group" aria-label="Kondisi"><button data-kf="semua" class="${gKond === 'semua' ? 'on' : ''}">Semua</button><button data-kf="baik" class="${gKond === 'baik' ? 'on' : ''}">Baik</button><button data-kf="rusak" class="${gKond === 'rusak' ? 'on' : ''}">Rusak (${S.alat.filter(a => a.aktif !== false && Number(a.rusak) > 0).length})</button></div>
        <div class="card stack"><h2>Sedang dipinjam (${dip.length})</h2>${dip.map(p => `<div class="item"><div class="grow"><b>${esc(S.alat.find(a => a.id === p.alat_id)?.nama)}</b><span>${esc(p.peminjam)} · ${esc(p.ket)} · ${tgl(p.at)}${p.oleh !== S.me.id ? ' · dicatat ' + esc(nm(p.oleh)) : ''}</span></div>${isRole('viewer') ? '' : `<button class="btn sm" data-kb="${p.id}">Kembali</button>`}</div>`).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
        ${grp(alat.filter(a => gKond === 'semua' || (gKond === 'rusak' ? Number(a.rusak) > 0 : (Number(a.stok) || 0) - (Number(a.rusak) || 0) > 0)), a => { const n = dip.filter(p => p.alat_id === a.id).length, rs = Number(a.rusak) || 0, baik = (Number(a.stok) || 0) - rs, avail = baik - n; return `<div class="item"><div class="grow"><b>${esc(a.nama)}</b><span>${esc(a.kategori || '')} · stok ${a.stok ?? '–'} ${esc(a.satuan || '')} · <b style="color:var(--ok)">baik ${fmt(baik)}</b>${rs ? ` · <b style="color:var(--bad)">rusak ${fmt(rs)}</b>` : ''}${n ? ' · dipinjam ' + n : ''}${a.ket ? ' · ' + esc(a.ket) : ''}</span></div>${isRole('viewer') ? '' : `<div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn ghost sm" data-ak="${a.id}">Kondisi</button><button class="btn ghost sm" data-pj="${a.id}" ${avail > 0 ? '' : 'disabled'}>Pinjam</button></div>`}</div>`; })}`}</div>`);
  $$('[data-g]').forEach(b => b.addEventListener('click', () => { gTab = b.dataset.g; renderGudang(shell); }));
  $$('[data-kf]').forEach(b => b.addEventListener('click', () => { gKond = b.dataset.kf; renderGudang(shell); }));
  $$('[data-ak]').forEach(b => b.addEventListener('click', () => kondisiSheet(S.alat.find(x => x.id === +b.dataset.ak), shell)));
  const q = $('#gq'); if (q) q.addEventListener('change', e => { gQ = e.target.value; renderGudang(shell); });
  const gt = $('#gTrm'); if (gt) gt.addEventListener('click', () => terimaBarangSheet(shell));
  const gn = $('#gNew'); if (gn) gn.addEventListener('click', async () => { const { barangSheet } = await import('./master.js'); const exists = gQ && S.barang.some(m => m.nama.toLowerCase().includes(gQ.toLowerCase())); barangSheet(null, shell, { nama: exists ? '' : gQ.trim().replace(/^./, c => c.toUpperCase()), after: n => { gQ = n; renderGudang(shell); } }); });
  $$('[data-pj]').forEach(b => b.addEventListener('click', () => {
    const a = S.alat.find(x => x.id === +b.dataset.pj);
    sheet(`<form class="stack" id="pj"><h2>Pinjam ${esc(a.nama)}</h2><label class="f" for="pjN">Nama peminjam<input id="pjN" value="${isRole('crew') ? '' : esc(S.me.nama)}" required></label><label class="f" for="pjK">Keterangan pemakaian<input id="pjK" required placeholder="mis. penyiangan HRP-10"></label><p class="note">Dicatat oleh akun ${esc(S.me.nama)}.</p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Pinjam</button></div></form>`, (box, close) => {
      box.querySelector('#pj').addEventListener('submit', async e => { e.preventDefault(); const n = box.querySelector('#pjN').value.trim(), k = box.querySelector('#pjK').value.trim(); if (!n || !k) return toast('Isi nama peminjam dan keterangan.'); await ins('pinjam', { id: uid(), alat_id: a.id, peminjam: n, ket: k, oleh: S.me.id }); close(); toast(`${a.nama} dipinjam ${n}.`); renderGudang(shell); });
    });
  }));
  $$('[data-kb]').forEach(b => b.addEventListener('click', () => {
    sheet(`<div class="stack"><h2>Pengembalian alat</h2><label class="f" for="kd">Kondisi<select id="kd"><option>Baik</option><option>Rusak</option><option>Hilang</option></select></label><div class="grid2"><button class="btn ghost" data-close>Batal</button><button class="btn" id="kdOk">Simpan</button></div></div>`, (box, close) => {
      box.querySelector('#kdOk').addEventListener('click', async () => {
        const kd = box.querySelector('#kd').value, pj = S.pinjam.find(x => x.id === b.dataset.kb), a = S.alat.find(x => x.id === pj?.alat_id);
        await upd('pinjam', { id: b.dataset.kb }, { kembali_at: new Date().toISOString(), kondisi: kd });
        if (a && kd === 'Rusak') { await upd('alat', { id: a.id }, { rusak: (Number(a.rusak) || 0) + 1 }); await ins('alat_log', { alat_id: a.id, tipe: 'rusak', n: 1, ket: `kembali rusak dari ${pj.peminjam}`, oleh: S.me.id }).catch(() => {}); }
        if (a && kd === 'Hilang') { await upd('alat', { id: a.id }, { stok: Math.max(0, (Number(a.stok) || 0) - 1) }); await ins('alat_log', { alat_id: a.id, tipe: 'hilang', n: 1, ket: `hilang saat dipinjam ${pj.peminjam}`, oleh: S.me.id }).catch(() => {}); }
        close(); toast(kd === 'Baik' ? 'Alat kembali.' : kd === 'Rusak' ? 'Alat kembali, tercatat rusak.' : 'Tercatat hilang, stok dikurangi 1.'); renderGudang(shell);
      });
    });
  }));
  $$('[data-bx]').forEach(b => b.addEventListener('click', () => {
    const m = S.barang.find(x => x.nama === b.dataset.bx);
    const lok = [...S.blok.filter(x => x.layer !== 'berhasil' && x.nama).map(x => x.nama), ...LOK];
    sheet(`<form class="stack" id="bx"><div class="row between"><h2>${esc(m.nama)}</h2>${isRole('admin', 'nursery') ? '<button type="button" class="btn ghost sm" id="bxEd">Ubah nama / satuan</button>' : ''}</div><div class="seg"><button type="button" class="on" data-t="keluar">Keluar</button><button type="button" data-t="masuk">Masuk</button><button type="button" data-t="opname">Opname</button></div>
      <label class="f" for="bxN"><span id="bxL">Jumlah (${esc(m.satuan)})</span><input id="bxN" type="number" min="0" step="any" inputmode="decimal"></label>
      <div id="bxK"><div class="grid2"><label class="f" for="bxP">Keperluan<select id="bxP">${KEP.map(k => `<option>${k}</option>`).join('')}</select></label><label class="f" for="bxO">Lokasi<select id="bxO">${lok.map(k => `<option>${esc(k)}</option>`).join('')}</select></label></div></div>
      <div id="bxM" hidden><button type="button" class="btn ghost block" id="bxF">Foto bukti (PO / surat jalan / DO)</button><p class="note" id="bxFs">Belum ada bukti.</p></div>
      <p class="err" id="bxE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
      let tipe = 'keluar', bukti = null;
      const be = box.querySelector('#bxEd'); if (be) be.addEventListener('click', async () => { close(); const { barangSheet } = await import('./master.js'); barangSheet(m, shell, { after: n => { gQ = n; renderGudang(shell); } }); });
      box.querySelectorAll('[data-t]').forEach(x => x.addEventListener('click', () => { tipe = x.dataset.t; box.querySelectorAll('[data-t]').forEach(y => y.classList.toggle('on', y === x)); box.querySelector('#bxK').hidden = tipe !== 'keluar'; box.querySelector('#bxM').hidden = tipe !== 'masuk'; box.querySelector('#bxL').textContent = tipe === 'opname' ? `Hasil hitung fisik (${m.satuan})` : `Jumlah (${m.satuan})`; }));
      box.querySelector('#bxF').addEventListener('click', async () => { const f = await pickPhoto({ gallery: true, title: 'Foto bukti barang masuk' }); if (!f) return; try { bukti = `bukti/${Date.now()}.jpg`; await SB.upload('scan', bukti, f); box.querySelector('#bxFs').textContent = 'Bukti terunggah.'; } catch (e) { bukti = null; toast(e.message); } });
      box.querySelector('#bx').addEventListener('submit', async e => {
        e.preventDefault(); const n = Number(box.querySelector('#bxN').value), er = box.querySelector('#bxE');
        if (!(n >= 0) || box.querySelector('#bxN').value === '' || (tipe !== 'opname' && n <= 0)) { er.textContent = 'Isi jumlah.'; er.hidden = false; return; }
        if (tipe === 'keluar' && m.stok == null) { er.textContent = 'Stok belum valid. Lakukan opname dulu.'; er.hidden = false; return; }
        if (tipe === 'keluar' && n > Number(m.stok)) { er.textContent = `Stok hanya ${fmt(m.stok, 2)}.`; er.hidden = false; return; }
        if (tipe === 'masuk' && !bukti) { er.textContent = 'Lampirkan foto bukti barang masuk.'; er.hidden = false; return; }
        const stok = tipe === 'opname' ? n : Number(m.stok || 0) + (tipe === 'masuk' ? n : -n);
        await ins('barang_tx', { barang: m.nama, tipe, n: tipe === 'opname' ? n - Number(m.stok || 0) : n, keperluan: tipe === 'keluar' ? box.querySelector('#bxP').value : tipe === 'opname' ? 'Penyesuaian opname' : 'Barang masuk', lokasi: tipe === 'keluar' ? box.querySelector('#bxO').value : 'Gudang', bukti, oleh: S.me.id });
        await upd('barang', { nama: m.nama }, { stok }); close(); toast('Tersimpan.'); renderGudang(shell);
      });
    });
  }));
}
