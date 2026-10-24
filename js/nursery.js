// Nursery (bedengan & lot), kirim bibit, penampungan lapangan, gudang.
import { SB } from './sb.js';
import { S, L, ins, upd, $, $$, toast, sheet, confirmSheet, uid, nm, newMap, pickPhoto } from './core.js';
import * as G from './logic.js';
import { role, isRole, seesBlok } from './app.js';
const { esc, fmt, tgl, jam } = G;
const CLC = { SP: '#FFF2CC', PB: '#FFD966', BF: '#A9D08E', BL: '#4E7A3B' };
const jn = k => S.jenisMap[k]?.nama || k;
const crewName = () => isRole('crew') ? `<label class="f" for="cn">Nama pencatat <small>akun bersama, isi nama Anda</small><input id="cn" required placeholder="Nama crew"></label>` : '';
const getCrew = box => { const i = box.querySelector('#cn'); return i ? i.value.trim() : S.me.nama; };

// ---------- nursery ----------
let nurseryView = null;
export function renderNursery(shell) {
  const can = isRole('admin', 'nursery', 'crew');
  const ready = L.readyStock(); const tr = Object.values(ready).reduce((a, b) => a + b, 0);
  const due = S.lot.filter(l => l.jumlah > 0 && L.stage(l).due);
  const tot = t => S.lot.filter(l => l.jumlah > 0 && L.bed(l.bedengan)?.tahap === t).reduce((a, l) => a + l.jumlah, 0);
  shell('Nursery', null, `<div class="stack">
    <div class="tiles"><div class="tile"><span>Siap kirim</span><b>${fmt(tr)}</b><span>≥ 2 minggu di BST</span></div><div class="tile"><span>Penyapihan</span><b>${fmt(tot('Penyapihan'))}</b><span>bibit</span></div><div class="tile"><span>Pembesaran</span><b>${fmt(tot('Pembesaran'))}</b><span>bibit</span></div><div class="tile"><span>Pindah tahap</span><b>${due.length}</b><span>lot jatuh tempo</span></div></div>
    <div class="map" id="nmap"></div>
    <div class="legend"><span><i class="sw" style="background:${CLC.SP}"></i>Penyapihan</span><span><i class="sw" style="background:${CLC.PB}"></i>Pembesaran</span><span><i class="sw" style="background:${CLC.BF}"></i>BST Fastgrow</span><span><i class="sw" style="background:${CLC.BL}"></i>BST Lokal</span><span>Pudar = kosong</span><span><i class="sw" style="background:#E0473B;border-radius:50%"></i>Waktunya pindah</span></div>
    <div class="card stack"><h2>Pengingat pindah tahap</h2>${due.length ? `<div class="list">${due.map(l => `<a class="item" href="#" data-bed="${l.bedengan}"><span class="tagid">${l.bedengan}</span><div class="grow"><b>${esc(jn(l.jenis))} · ${fmt(l.jumlah)}</b><span>ke ${L.stage(l).next === 'Pembesaran' ? 'Pembesaran' : L.stage(l).next === 'BF' ? 'BST Fastgrow' : 'BST Lokal'}</span></div></a>`).join('')}</div>` : '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
    <div class="card stack"><h2>Stok siap kirim per jenis</h2>${Object.keys(ready).length ? `<dl class="kv">${Object.entries(ready).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<dt>${esc(jn(k))}</dt><dd>${fmt(v)}</dd>`).join('')}</dl>` : '<p class="muted small" style="margin:0">Belum ada.</p>'}</div>
    ${can ? '<p class="note">Tap bedengan di peta untuk mencatat lot baru, mati/afkir, atau pindah tahap.</p>' : ''}</div>`);
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
}
function bedSheet(kode, shell) {
  const b = L.bed(kode); const ls = L.lotsIn(kode); const f = L.fill(kode), cap = b.kapasitas || 1300;
  const can = isRole('admin', 'nursery', 'crew');
  sheet(`<div class="stack"><div class="row between"><h2>${esc(kode)}</h2><span class="pill s-idle">${esc(b.tahap)}${b.cluster === 'BF' ? ' Fastgrow' : b.cluster === 'BL' ? ' Lokal' : ''}</span></div>
    <div><div class="row between small"><span>Terisi</span><span class="mono">${fmt(f)} / ${fmt(cap)}</span></div><div class="bar"><span style="width:${Math.min(100, f / cap * 100)}%"></span></div></div>
    ${ls.map(l => { const st = L.stage(l); return `<div class="sec"><div class="row between"><b>${esc(jn(l.jenis))}</b>${st.ready ? '<span class="pill s-ok">Siap kirim</span>' : st.due ? '<span class="pill s-warn">Waktunya pindah</span>' : `<span class="pill s-idle">${st.left} hari lagi</span>`}</div><dl class="kv"><dt>Jumlah</dt><dd>${fmt(l.jumlah)}</dd><dt>Sapih</dt><dd>${tgl(l.tgl_sapih)}</dd><dt>Masuk bedengan</dt><dd>${tgl(l.tgl_masuk)}</dd><dt>Umur</dt><dd>${fmt(G.diffDays(G.today(), l.tgl_sapih) / 7, 1)} minggu</dd></dl>${can ? `<div class="grid2"><button class="btn ghost sm" data-afk="${l.id}">Catat mati/afkir</button>${st.due ? `<button class="btn sm" data-move="${l.id}">Pindahkan</button>` : '<span></span>'}</div>` : ''}</div>`; }).join('') || '<p class="muted small" style="margin:0">Bedengan kosong.</p>'}
    ${can && b.tahap === 'Penyapihan' ? `<form class="sec" id="nl"><h3>Lot baru (sapih ke polybag)</h3><div class="grid2"><label class="f" for="nlJ">Jenis<select id="nlJ">${S.jenis.map(j => `<option value="${j.kode}">${esc(j.nama)}</option>`).join('')}</select></label><label class="f" for="nlN">Jumlah bibit<input id="nlN" type="number" min="1" inputmode="numeric" value="${Math.max(0, Math.min(1200, cap - f))}"></label></div>${crewName()}<p class="note">Polybag kecil berkurang otomatis sesuai jumlah bibit.</p><p class="err" id="nlErr" hidden></p><button class="btn" type="submit">Tambah lot</button></form>` : ''}
    <button class="btn ghost block" data-close>Tutup</button></div>`, (box, close) => {
    box.querySelectorAll('[data-afk]').forEach(btn => btn.addEventListener('click', () => { close(); afkirSheet(S.lot.find(x => x.id === btn.dataset.afk), shell); }));
    box.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => { close(); moveSheet(S.lot.find(x => x.id === btn.dataset.move), shell); }));
    const nl = box.querySelector('#nl'); if (nl) nl.addEventListener('submit', async e => {
      e.preventDefault(); const n = Number(box.querySelector('#nlN').value), j = box.querySelector('#nlJ').value, er = box.querySelector('#nlErr');
      const who = getCrew(box); if (!who) { er.textContent = 'Isi nama pencatat.'; er.hidden = false; return; }
      if (!(n > 0)) { er.textContent = 'Isi jumlah bibit.'; er.hidden = false; return; }
      if (n > cap - f) { er.textContent = `Bedengan hanya muat ${fmt(cap - f)} lagi.`; er.hidden = false; return; }
      if (ls.length && !ls.every(x => x.jenis === j)) { const empty = S.bedengan.some(x => x.tahap === 'Penyapihan' && x.status === 'aktif' && L.fill(x.kode) === 0); if (empty || f > cap / 2 || new Set(ls.map(x => x.jenis)).size >= 2) { er.textContent = 'Campur jenis hanya boleh bila tidak ada bedengan kosong dan bedengan ini terisi ≤ ½.'; er.hidden = false; return; } }
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
function moveSheet(l, shell) {
  const sg = L.suggestTargets(l);
  sheet(`<div class="stack"><h2>Pindah tahap · ${esc(l.bedengan)}</h2><p class="small" style="margin:0">${esc(jn(l.jenis))} ${fmt(l.jumlah)} bibit</p>
    <div class="alert ${sg.rest ? 'warn' : 'ok'}"><b>Saran tujuan</b><br>${sg.plan.map(p => `${p.bed}: ${fmt(p.n)} bibit (${p.why})`).join('<br>') || 'Tidak ada bedengan yang muat.'}${sg.rest ? `<br>Sisa ${fmt(sg.rest)} bibit belum mendapat tempat.` : ''}</div>
    ${crewName()}<div class="grid2"><button class="btn ghost" data-close>Batal</button><button class="btn" id="mvOk" ${sg.plan.length ? '' : 'disabled'}>Pindahkan</button></div></div>`, (box, close) => {
    const ok = box.querySelector('#mvOk'); if (ok) ok.addEventListener('click', async () => {
      const who = getCrew(box); if (!who) return toast('Isi nama pencatat.');
      for (const p of sg.plan) { const id = uid(); await ins('lot', { id, bedengan: p.bed, jenis: l.jenis, jumlah: p.n, tgl_sapih: l.tgl_sapih, tgl_masuk: G.today(), created_by: S.me.id }); await ins('lot_log', { lot_id: id, tipe: 'pindah_masuk', n: p.n, ket: 'dari ' + l.bedengan, oleh: S.me.id, nama_pencatat: who }); }
      const moved = sg.plan.reduce((a, p) => a + p.n, 0);
      await upd('lot', { id: l.id }, { jumlah: l.jumlah - moved }); await ins('lot_log', { lot_id: l.id, tipe: 'pindah_keluar', n: moved, ket: 'ke ' + sg.plan.map(p => p.bed).join(', '), oleh: S.me.id, nama_pencatat: who });
      close(); toast('Dipindah ke ' + sg.plan.map(p => p.bed).join(', ')); renderNursery(shell);
    });
  });
}

// ---------- kirim bibit ----------
async function sendFromStock(blok_id, minta_id, jk, n) {
  const lots = L.readyLots(jk); const avail = lots.reduce((a, l) => a + l.jumlah, 0);
  if (n > avail) { toast(`Stok siap ${jn(jk)} hanya ${fmt(avail)}.`); return false; }
  let left = n;
  for (const l of lots) {
    if (left <= 0) break; const k = Math.min(l.jumlah, left); left -= k;
    await upd('lot', { id: l.id }, { jumlah: l.jumlah - k });
    await ins('lot_log', { lot_id: l.id, tipe: 'kirim', n: k, ket: 'ke ' + G.blokName(S.blokMap[blok_id]), oleh: S.me.id, nama_pencatat: S.me.nama });
    await ins('kirim', { id: uid(), blok_id, minta_id, jenis: jk, n: k, lot_id: l.id, bedengan: l.bedengan, dikirim_oleh: S.me.id });
  }
  return true;
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
  shell('Kirim bibit', null, `<div class="stack">
    ${nurs ? `<div class="alert">${hourWIB >= 18 ? 'Ringkasan permintaan hari ini sudah terkirim pukul 18.00 WIB.' : 'Ringkasan permintaan sulam dikumpulkan sepanjang hari dan dikirim pukul 18.00 WIB.'}</div>` : ''}
    <div class="card stack"><h2>Permintaan penanaman BASTL (${tanam.length})</h2>
      ${tanam.map(m => { const b = S.blokMap[m.blok_id]; const row = (lbl, t, need, got) => `<div class="sec"><div class="row between"><b>${lbl}</b><span class="small">${fmt(got)} / ${fmt(need)} ${got > need ? '· lebih ' + fmt(got - need) : got < need ? '· kurang ' + fmt(need - got) : ''}</span></div>${nurs ? `<div class="row" style="flex-wrap:nowrap">${sel(`mj-${m.id}-${t}`, t)}<input type="number" min="1" inputmode="numeric" id="mn-${m.id}-${t}" value="${Math.max(0, need - got) || ''}" style="width:96px" aria-label="Jumlah"><button class="btn sm" data-mk="${m.id}" data-t="${t}">Kirim</button></div>` : ''}</div>`;
        return `<div class="card tight"><div class="row between"><b>${esc(G.blokName(b))} · ${fmt(b.ha, 2)} Ha</b><span class="small muted">${tgl(m.created_at)}</span></div>${row('Pioneer', 'pio', m.pio, m.sent.pio)}${row('Sisipan', 'sis', m.sis, m.sent.sis)}</div>`; }).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}
      <p class="note">Boleh dikirim bertahap, kurang, atau lebih. Bibit diambil dari bedengan BST yang paling lama mengendap.</p></div>
    <div class="card stack"><h2>Permintaan sulam (${sul.length} blok)</h2>
      ${sul.map(o => { const b = S.blokMap[o.blok_id]; return `<div class="card tight stack"><div class="row between"><b>${esc(G.blokName(b))}</b><span class="pill ${o.kurang ? 's-warn' : 's-ok'}">${o.kurang ? 'kurang ' + fmt(o.kurang) : 'cukup'}</span></div><div class="chips">${Object.entries(o.perJenis).map(([k, v]) => `<span class="chip">${esc(jn(k))} mati ${v}</span>`).join('')}</div><p class="small" style="margin:0">${o.total} tag perlu disulam · ${fmt(o.tersedia)} bibit sudah di penampungan/pengiriman.</p>${nurs ? `<div class="row" style="flex-wrap:nowrap">${sel(`sj-${o.blok_id}`)}<input type="number" min="1" inputmode="numeric" id="sn-${o.blok_id}" value="${o.kurang || ''}" style="width:96px" aria-label="Jumlah"><button class="btn sm" data-sk="${esc(o.blok_id)}">Kirim</button></div>` : ''}</div>`; }).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}
      <p class="note">Digabung per blok dan jenis yang mati. Orang lapangan menentukan jenis yang dipakai; saat scan sulam, aplikasi hanya menawarkan jenis yang cocok untuk titik itu.</p></div>
    <div class="card stack"><h2>Dalam pengiriman (${sent.length})</h2>${sent.length ? `<div class="tbl"><table><thead><tr><th>Blok</th><th>Jenis</th><th class="r">Jml</th><th>Dari</th><th></th></tr></thead><tbody>${sent.map(k => `<tr><td>${esc(G.blokName(S.blokMap[k.blok_id]))}</td><td>${esc(jn(k.jenis))}</td><td class="r">${fmt(k.n)}</td><td>${esc(k.bedengan || '')}</td><td>${isRole('admin', 'owner', 'exdas', 'bumdes') ? `<button class="btn sm" data-tr="${k.id}">Terima</button>` : '<span class="small muted">menunggu</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small" style="margin:0">Tidak ada.</p>'}<p class="note">Serah terima di aplikasi: nursery menekan Kirim, lapangan menekan Terima.</p></div></div>`);
  $$('[data-mk]').forEach(b => b.addEventListener('click', async () => { const m = S.minta.find(x => x.id === b.dataset.mk), t = b.dataset.t; const s = $(`#mj-${m.id}-${t}`); if (!s) return; const n = Number($(`#mn-${m.id}-${t}`).value); if (!(n > 0)) return toast('Isi jumlah.'); b.disabled = true; if (await sendFromStock(m.blok_id, m.id, s.value, n)) { toast(`${fmt(n)} ${jn(s.value)} dikirim.`); renderKirim(shell); } b.disabled = false; }));
  $$('[data-sk]').forEach(b => b.addEventListener('click', async () => { const bid = b.dataset.sk; const s = $(`#sj-${CSS.escape(bid)}`); if (!s) return; const n = Number($(`#sn-${CSS.escape(bid)}`).value); if (!(n > 0)) return toast('Isi jumlah.'); b.disabled = true; if (await sendFromStock(bid, null, s.value, n)) { toast(`${fmt(n)} ${jn(s.value)} dikirim.`); renderKirim(shell); } b.disabled = false; }));
  $$('[data-tr]').forEach(b => b.addEventListener('click', async () => { await upd('kirim', { id: b.dataset.tr }, { status: 'diterima' }); toast('Bibit diterima, masuk penampungan blok.'); renderKirim(shell); }));
}

// ---------- penampungan ----------
export function renderTampung(shell) {
  const nurs = isRole('admin', 'nursery');
  const bloks = S.blok.filter(b => seesBlok(b) && b.layer !== 'berhasil').map(b => ({ b, st: L.stokTampung(b.id), dk: L.dalamKirim(b.id), p: L.aktif(b.id), last: L.periodes(b.id).filter(p => p.status === 'selesai').pop() })).filter(x => Object.keys(x.st).length || x.dk.length);
  const anyStock = S.blok.some(b => Object.keys(L.stokTampung(b.id)).length);
  shell('Penampungan', 'Sekat bibit per blok di lapangan', `<div class="stack">
    ${anyStock ? '<div class="alert warn">Sebelum stock opname bulanan, semua bibit di penampungan harus dikembalikan ke nursery.</div>' : ''}
    ${bloks.map(x => { const closed = !x.p && x.last; const left = closed ? 3 - G.diffDays(G.today(), G.tglWIB(x.last.approved_at)) : null;
      return `<div class="card stack"><div class="row between"><b>${esc(G.blokName(x.b))}</b>${closed ? `<span class="pill ${left < 0 ? 's-bad' : 's-warn'}">${left < 0 ? 'Lewat ' + (-left) + ' hari' : 'Kembalikan ≤ ' + left + ' hari'}</span>` : '<span class="pill s-pend">Blok berjalan</span>'}</div>
      ${x.dk.map(k => `<div class="row between small"><span>Dikirim: ${esc(jn(k.jenis))} ${fmt(k.n)} dari ${esc(k.bedengan || '')}</span>${isRole('admin', 'owner', 'exdas', 'bumdes') ? `<button class="btn sm" data-tr="${k.id}">Terima</button>` : ''}</div>`).join('')}
      ${Object.entries(x.st).map(([k, v]) => `<div class="sec"><div class="row between"><b>${esc(jn(k))}</b><span class="mono">${fmt(v)} bibit</span></div>${nurs || isRole('owner', 'exdas', 'bumdes') ? `<div class="grid2"><button class="btn ghost sm" data-afk="${esc(x.b.id)}|${k}">Catat afkir</button>${nurs ? `<button class="btn sm" data-kb="${esc(x.b.id)}|${k}">Kembalikan ke nursery</button>` : '<span class="small muted">pengembalian dicatat nursery</span>'}</div>` : ''}</div>`).join('')}</div>`; }).join('') || '<div class="card"><p class="muted" style="margin:0">Tidak ada bibit di penampungan.</p></div>'}
    <p class="note">Sisa dikembalikan setelah blok closing (pengingat 3 hari). Bibit di sekat satu blok tidak boleh dipakai blok lain.</p></div>`);
  $$('[data-tr]').forEach(b => b.addEventListener('click', async () => { await upd('kirim', { id: b.dataset.tr }, { status: 'diterima' }); toast('Diterima.'); renderTampung(shell); }));
  $$('[data-afk]').forEach(b => b.addEventListener('click', () => { const [bid, jk] = b.dataset.afk.split('|'); qtySheet(`Afkir di penampungan · ${jn(jk)}`, L.stokTampung(bid)[jk], null, async n => { await ins('tampung_log', { blok_id: bid, jenis: jk, tipe: 'afkir', n, oleh: S.me.id }); toast('Afkir tercatat.'); renderTampung(shell); }); }));
  $$('[data-kb]').forEach(b => b.addEventListener('click', () => {
    const [bid, jk] = b.dataset.kb.split('|'); const cl = S.jenisMap[jk]?.tipe === 'pionir' ? 'BF' : 'BL';
    const beds = S.bedengan.filter(x => x.cluster === cl && x.status === 'aktif' && L.fill(x.kode) < (x.kapasitas || 1300));
    const src = S.kirim.filter(k => k.blok_id === bid && k.jenis === jk).pop();
    qtySheet(`Kembalikan ${jn(jk)} ke nursery`, L.stokTampung(bid)[jk], `<label class="f" for="qB">Bedengan tujuan <small>dipilih tim nursery</small><select id="qB">${beds.map(x => `<option ${x.kode === src?.bedengan ? 'selected' : ''}>${x.kode}</option>`).join('')}</select></label>`, async (n, box) => {
      const bed = box.querySelector('#qB').value; if (!bed) return toast('Tidak ada bedengan BST yang muat.');
      const sl = S.lot.find(l => l.id === src?.lot_id); const same = S.lot.find(l => l.bedengan === bed && l.jenis === jk && sl && l.tgl_sapih === sl.tgl_sapih);
      let lotId;
      if (same) { lotId = same.id; await upd('lot', { id: same.id }, { jumlah: same.jumlah + n }); }
      else { lotId = uid(); await ins('lot', { id: lotId, bedengan: bed, jenis: jk, jumlah: n, tgl_sapih: sl?.tgl_sapih || G.addDays(G.today(), -84), tgl_masuk: sl?.tgl_masuk || G.addDays(G.today(), -14), created_by: S.me.id }); }
      await ins('lot_log', { lot_id: lotId, tipe: 'kembali', n, ket: 'dari ' + G.blokName(S.blokMap[bid]), oleh: S.me.id, nama_pencatat: S.me.nama });
      await ins('tampung_log', { blok_id: bid, jenis: jk, tipe: 'kembali', n, bedengan: bed, lot_id: lotId, oleh: S.me.id });
      toast(`${fmt(n)} ${jn(jk)} kembali ke ${bed}.`); renderTampung(shell);
    });
  }));
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
export function renderGudang(shell) {
  const can = isRole('admin', 'nursery', 'crew');
  const st = m => m.stok == null ? ['s-idle', 'Perlu opname'] : Number(m.stok) < Number(m.minimum) ? ['s-warn', 'Di bawah minimum'] : ['s-ok', 'Aman'];
  const dip = S.pinjam.filter(p => !p.kembali_at);
  const alat = S.alat.filter(a => !gQ || a.nama.toLowerCase().includes(gQ.toLowerCase()));
  shell('Gudang', null, `<div class="stack">
    <div class="seg"><button data-g="material" class="${gTab === 'material' ? 'on' : ''}">Material</button><button data-g="alat" class="${gTab === 'alat' ? 'on' : ''}">Peralatan</button></div>
    ${gTab === 'material' ? `<div class="list">${S.barang.map(m => { const [c, t] = st(m); return `<div class="item"><div class="grow"><b>${esc(m.nama)}</b><span>${m.stok == null ? '–' : fmt(m.stok, Number(m.stok) % 1 ? 2 : 0)} ${esc(m.satuan)} · min ${fmt(m.minimum)} ${esc(m.satuan)}</span></div><span class="pill ${c}">${t}</span>${can ? `<button class="btn ghost sm" data-bx="${esc(m.nama)}">Catat</button>` : ''}</div>`; }).join('')}</div><p class="note">Stok dihitung dari masuk − keluar. Item "Perlu opname" menunggu hitung fisik. Kohe 25 kg/sak, arang sekam 25 kg/sak.</p>`
      : `<input id="gq" placeholder="Cari alat" value="${esc(gQ)}" aria-label="Cari alat"><div class="card stack"><h2>Sedang dipinjam (${dip.length})</h2>${dip.map(p => `<div class="item"><div class="grow"><b>${esc(S.alat.find(a => a.id === p.alat_id)?.nama)}</b><span>${esc(p.peminjam)} · ${esc(p.ket)} · ${tgl(p.at)}${p.oleh !== S.me.id ? ' · dicatat ' + esc(nm(p.oleh)) : ''}</span></div>${isRole('viewer') ? '' : `<button class="btn sm" data-kb="${p.id}">Kembali</button>`}</div>`).join('') || '<p class="muted small" style="margin:0">Tidak ada.</p>'}</div>
        <div class="list">${alat.map(a => { const n = dip.filter(p => p.alat_id === a.id).length; const avail = (Number(a.stok) || 0) - n; return `<div class="item"><div class="grow"><b>${esc(a.nama)}</b><span>${esc(a.kategori || '')} · stok ${a.stok ?? '–'} ${esc(a.satuan || '')}${n ? ' · dipinjam ' + n : ''}${a.ket ? ' · ' + esc(a.ket) : ''}</span></div>${isRole('viewer') ? '' : `<button class="btn ghost sm" data-pj="${a.id}" ${avail > 0 ? '' : 'disabled'}>Pinjam</button>`}</div>`; }).join('')}</div>`}</div>`);
  $$('[data-g]').forEach(b => b.addEventListener('click', () => { gTab = b.dataset.g; renderGudang(shell); }));
  const q = $('#gq'); if (q) q.addEventListener('change', e => { gQ = e.target.value; renderGudang(shell); });
  $$('[data-pj]').forEach(b => b.addEventListener('click', () => {
    const a = S.alat.find(x => x.id === +b.dataset.pj);
    sheet(`<form class="stack" id="pj"><h2>Pinjam ${esc(a.nama)}</h2><label class="f" for="pjN">Nama peminjam<input id="pjN" value="${isRole('crew') ? '' : esc(S.me.nama)}" required></label><label class="f" for="pjK">Keterangan pemakaian<input id="pjK" required placeholder="mis. penyiangan HRP-10"></label><p class="note">Dicatat oleh akun ${esc(S.me.nama)}.</p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Pinjam</button></div></form>`, (box, close) => {
      box.querySelector('#pj').addEventListener('submit', async e => { e.preventDefault(); const n = box.querySelector('#pjN').value.trim(), k = box.querySelector('#pjK').value.trim(); if (!n || !k) return toast('Isi nama peminjam dan keterangan.'); await ins('pinjam', { id: uid(), alat_id: a.id, peminjam: n, ket: k, oleh: S.me.id }); close(); toast(`${a.nama} dipinjam ${n}.`); renderGudang(shell); });
    });
  }));
  $$('[data-kb]').forEach(b => b.addEventListener('click', () => {
    sheet(`<div class="stack"><h2>Pengembalian alat</h2><label class="f" for="kd">Kondisi<select id="kd"><option>Baik</option><option>Rusak</option><option>Hilang</option></select></label><div class="grid2"><button class="btn ghost" data-close>Batal</button><button class="btn" id="kdOk">Simpan</button></div></div>`, (box, close) => {
      box.querySelector('#kdOk').addEventListener('click', async () => { await upd('pinjam', { id: b.dataset.kb }, { kembali_at: new Date().toISOString(), kondisi: box.querySelector('#kd').value }); close(); toast('Alat kembali.'); renderGudang(shell); });
    });
  }));
  $$('[data-bx]').forEach(b => b.addEventListener('click', () => {
    const m = S.barang.find(x => x.nama === b.dataset.bx);
    const lok = [...S.blok.filter(x => x.layer !== 'berhasil' && x.nama).map(x => x.nama), ...LOK];
    sheet(`<form class="stack" id="bx"><h2>${esc(m.nama)}</h2><div class="seg"><button type="button" class="on" data-t="keluar">Keluar</button><button type="button" data-t="masuk">Masuk</button><button type="button" data-t="opname">Opname</button></div>
      <label class="f" for="bxN"><span id="bxL">Jumlah (${esc(m.satuan)})</span><input id="bxN" type="number" min="0" step="any" inputmode="decimal"></label>
      <div id="bxK"><div class="grid2"><label class="f" for="bxP">Keperluan<select id="bxP">${KEP.map(k => `<option>${k}</option>`).join('')}</select></label><label class="f" for="bxO">Lokasi<select id="bxO">${lok.map(k => `<option>${esc(k)}</option>`).join('')}</select></label></div></div>
      <div id="bxM" hidden><button type="button" class="btn ghost block" id="bxF">Foto bukti (PO / surat jalan / DO)</button><p class="note" id="bxFs">Belum ada bukti.</p></div>
      <p class="err" id="bxE" hidden></p><div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan</button></div></form>`, (box, close) => {
      let tipe = 'keluar', bukti = null;
      box.querySelectorAll('[data-t]').forEach(x => x.addEventListener('click', () => { tipe = x.dataset.t; box.querySelectorAll('[data-t]').forEach(y => y.classList.toggle('on', y === x)); box.querySelector('#bxK').hidden = tipe !== 'keluar'; box.querySelector('#bxM').hidden = tipe !== 'masuk'; box.querySelector('#bxL').textContent = tipe === 'opname' ? `Hasil hitung fisik (${m.satuan})` : `Jumlah (${m.satuan})`; }));
      box.querySelector('#bxF').addEventListener('click', async () => { const f = await pickPhoto(); if (!f) return; try { bukti = `bukti/${Date.now()}.jpg`; await SB.upload('scan', bukti, f); box.querySelector('#bxFs').textContent = 'Bukti terunggah.'; } catch (e) { bukti = null; toast(e.message); } });
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
