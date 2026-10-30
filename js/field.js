// Lapangan: sesi inspeksi GL (jejak GPS, scan tag, foto), scan tag umum, sulam vendor.
import { SB } from './sb.js';
import { S, L, ins, upd, $, $$, toast, sheet, confirmSheet, uid, nm, GPS, dist, waitGPS, scanQR, pickPhoto, newMap, locateControl, uploadOrQueue, fileUrl, loadAll, isOnline, flush, pending } from './core.js';
import * as G from './logic.js';
import { role, isRole, seesBlok, route, tagColor, tagItem } from './app.js';
const { esc, fmt, tgl, jam } = G;

// ---------- tim inspeksi: HP anggota (crew) bergabung ke sesi GL lewat QR ----------
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
const agKey = sid => 'hm-ag-' + sid;
export const anggota = s => (S.sesi_anggota || []).filter(a => a.sesi_id === s.id).sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)));
// baris anggota milik HP ini (akun crew bisa dipakai di banyak HP, jadi dikenali dari penyimpanan HP)
export const myAg = s => { const id = lsGet(agKey(s.id)); const a = id && (S.sesi_anggota || []).find(x => x.id === id); return a && a.oleh === S.me.id && !a.selesai_at && !s.selesai_at ? a : null; };
const isLead = s => s.oleh === S.me.id && !s.selesai_at && !myAg(s);
const worker = s => !!s && !s.selesai_at && (isLead(s) || !!myAg(s));
const who = s => { const a = s && myAg(s); return a ? { pencatat: a.nama, anggota_id: a.id } : { pencatat: S.me.nama, anggota_id: null }; };
// sesi tim yang diikuti HP ini dan masih berjalan
export const mySesiTim = () => (S.sesi || []).find(s => !s.selesai_at && myAg(s));
// pembagian area: blok dibagi jalur memanjang sesuai jumlah orang (GL = jalur 1)
function zones(b, n) {
  const pts = []; const walk = c => Array.isArray(c[0]) ? c.forEach(walk) : pts.push(c); walk(b.geom.coordinates);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const wide = (x1 - x0) * Math.cos((y0 + y1) / 2 * Math.PI / 180) >= (y1 - y0);
  return Array.from({ length: n }, (_, i) => wide ? [[y0, x0 + (x1 - x0) * i / n], [y1, x0 + (x1 - x0) * (i + 1) / n]] : [[y1 - (y1 - y0) * i / n, x0], [y1 - (y1 - y0) * (i + 1) / n, x1]]);
}
const ZC = ['#29B6F6', '#FF9800', '#AB47BC', '#66BB6A', '#EF5350', '#FFEE58', '#8D6E63', '#26C6DA'];
export async function joinSesi(payload) {
  let q; try { q = JSON.parse(payload.slice(4)); } catch (e) { return toast('QR sesi tidak terbaca.'); }
  if (isRole('exdas', 'bumdes')) return toast('Akun vendor tidak bisa bergabung ke tim inspeksi GL.');
  if (!isOnline()) return toast('Bergabung ke sesi butuh sinyal. Setelah bergabung, pencatatan bisa tanpa sinyal.', 4500);
  try { await loadAll(); } catch (e) {}
  const s = S.sesi.find(x => x.id === q.s);
  if (!s || s.selesai_at) return toast('Sesi ini sudah ditutup atau tidak ditemukan.');
  if (s.kode !== q.k) return toast('QR sudah tidak berlaku. Minta GL menampilkan QR terbaru.');
  if (myAg(s)) { location.hash = '#sesi/' + s.id; return; }
  const nama = await new Promise(res => sheet(`<form class="stack" id="jn"><h2>Gabung inspeksi</h2><p class="small" style="margin:0">${esc(G.blokName(S.blokMap[s.blok_id]))} · ketua ${esc(nm(s.oleh))}</p>
    <label class="f" for="jnN">Nama Anda <small>tercatat di setiap scan</small><input id="jnN" value="${esc(lsGet('hm-nama-anggota') || '')}" autocomplete="name" required></label>
    <div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Gabung</button></div></form>`, (box, close) => {
    box.querySelector('[data-close]').addEventListener('click', () => res(null));
    box.querySelector('#jn').addEventListener('submit', e => { e.preventDefault(); const v = box.querySelector('#jnN').value.trim(); if (!v) return; close(); res(v); });
  }));
  if (!nama) return;
  const id = uid();
  try { await ins('sesi_anggota', { id, sesi_id: s.id, oleh: S.me.id, nama, kode: q.k, track: [] }, { offline: false }); }
  catch (e) { return toast(e.net ? 'Sinyal putus, coba lagi.' : 'Gagal bergabung: ' + e.message, 4500); }
  lsSet(agKey(s.id), id); lsSet('hm-nama-anggota', nama);
  toast('Bergabung. Kerjakan area warna Anda di peta.'); location.hash = '#sesi/' + s.id;
}
function qrSheet(s, rerender) {
  sheet(`<div class="stack" style="align-items:center;text-align:center"><h2>Tambah anggota tim</h2><p class="small" style="margin:0">Di HP crew: masuk dengan akun crew → <b>Scan tag</b> → scan QR ini.</p><div id="qrS" style="background:#fff;padding:10px;border-radius:10px"></div><p class="small muted" style="margin:0">Kode sesi ${esc(s.kode)}</p><button class="btn ghost block" data-close>Selesai</button></div>`, (box, close) => {
    if (window.QRCode) new window.QRCode(box.querySelector('#qrS'), { text: 'HMS1' + JSON.stringify({ s: s.id, k: s.kode }), width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
    box.querySelector('[data-close]').addEventListener('click', () => rerender());
  });
}

const jenisOpts = (jalur, sel) => {
  const grp = jalur === 'pioneer' ? S.jenisAktif.filter(j => j.tipe === 'pionir') : S.jenisAktif.filter(j => j.tipe !== 'pionir');
  const rest = S.jenisAktif.filter(j => !grp.includes(j));
  return `<optgroup label="${jalur === 'pioneer' ? 'Pionir' : 'Lokal & MPTS'}">${grp.map(j => `<option value="${j.kode}" ${j.kode === sel ? 'selected' : ''}>${esc(j.nama)}</option>`).join('')}</optgroup><optgroup label="Lainnya">${rest.map(j => `<option value="${j.kode}">${esc(j.nama)}</option>`).join('')}</optgroup>`;
};

// form tanaman mati (tag baru)
function deadForm(tagId, pos, title) {
  return new Promise(res => {
    sheet(`<form class="stack" id="df"><div class="row between"><h2>${esc(title)}</h2><span class="tagid">${esc(tagId)}</span></div>
      <p class="small" style="margin:0;${pos.low ? 'color:var(--warn);font-weight:600' : ''}">± ${fmt(pos.acc, 1)} m${pos.low ? ' · akurasi rendah, akan diberi catatan sulit ditemukan' : ''}</p>
      <div class="seg" role="group" aria-label="Jalur"><button type="button" class="on" data-j="pioneer">Jalur pioneer</button><button type="button" data-j="sisipan">Jalur sisipan</button></div>
      <label class="f" for="dfJ">Jenis yang mati<select id="dfJ">${jenisOpts('pioneer')}</select></label>
      <label class="f" for="dfK">Kondisi titik<select id="dfK">${G.KONDISI.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <div class="grid2"><button type="button" class="btn ghost" data-close>Batal</button><button class="btn" type="submit">Simpan tag</button></div></form>`, (box, close) => {
      let jalur = 'pioneer';
      box.querySelectorAll('[data-j]').forEach(b => b.addEventListener('click', () => { jalur = b.dataset.j; box.querySelectorAll('[data-j]').forEach(x => x.classList.toggle('on', x === b)); box.querySelector('#dfJ').innerHTML = jenisOpts(jalur); }));
      box.querySelector('[data-close]').addEventListener('click', () => res(null));
      box.querySelector('#df').addEventListener('submit', e => { e.preventDefault(); close(); res({ jalur, jenis: box.querySelector('#dfJ').value, kondisi: box.querySelector('#dfK').value }); });
    });
  });
}
async function newTag({ id, b, p, sesi, sumber }) {
  if (S.tag.find(t => t.id === id)) { toast('Tag ' + id + ' sudah terpakai di ' + G.blokName(S.blokMap[S.tag.find(t => t.id === id).blok_id]) + '.'); return null; }
  const pos = await waitGPS(6, 'Kunci posisi tag ' + id); if (!pos) return null;
  const f = await deadForm(id, pos, sumber === 'gl' ? 'Tag GL: tanaman mati' : 'Tag vendor: tanaman mati'); if (!f) return null;
  const w = who(sesi);
  await ins('tag', { id, blok_id: b.id, periode_id: p.id, sumber, lon: pos.lon, lat: pos.lat, acc: Math.round(pos.acc * 10) / 10, low_acc: !!pos.low, jalur: f.jalur, kondisi: f.kondisi, status: 'mati', created_by: S.me.id, ...(sesi ? { pencatat: w.pencatat } : {}) });
  await ins('tag_event', { tag_id: id, periode_id: p.id, sesi_id: sesi?.id || null, tipe: 'mati', jenis: f.jenis, lon: pos.lon, lat: pos.lat, acc: pos.acc, oleh: S.me.id, client_at: new Date().toISOString(), ...(sesi ? w : {}) });
  toast(`Tag ${id} tersimpan. Masuk ke ringkasan permintaan bibit.`);
  return id;
}
export async function vendorNewTag(b, p) {
  const id = await scanQR('Scan tag yang dipasang di ajir'); if (!id) return;
  await newTag({ id, b, p, sesi: null, sumber: 'vendor' });
}

// ---------- sesi inspeksi / verifikasi ----------
let trackTimer = null, trackUnsub = null;
export function renderSesi(id, shell) {
  const s = S.sesi.find(x => x.id === id);
  if (!s) { shell('Sesi', '', '<p class="muted">Sesi tidak ditemukan.</p>'); return; }
  const p = S.periode.find(x => x.id === s.periode_id); const b = S.blokMap[s.blok_id];
  const lead = isLead(s), ag = myAg(s), mine = lead || !!ag;
  const tim = anggota(s); const myZ = ag ? tim.findIndex(x => x.id === ag.id) + 1 : 0;
  const evs = S.tag_event.filter(e => e.sesi_id === s.id);
  const dead = new Set(evs.filter(e => e.tipe === 'mati').map(e => e.tag_id));
  const hidup = new Set(evs.filter(e => e.tipe === 'hidup').map(e => e.tag_id));
  const verif = s.tipe === 'verifikasi';
  const glTags = verif ? S.tag.filter(t => t.periode_id === p.id && t.sumber === 'gl') : [];
  const foto = s.foto || [];
  const LK = 'trk-' + s.id + (ag ? '-' + ag.id : ''); const base = ag ? ag.track || [] : s.track || []; let track = []; try { track = JSON.parse(localStorage.getItem(LK) || 'null') || base; } catch (e) { track = base; }
  const saveTrack = extra => ag ? upd('sesi_anggota', { id: ag.id }, { track, ...(extra || {}) }) : upd('sesi', { id: s.id }, { track, ...(extra || {}) });
  const el = shell((verif ? 'Verifikasi · ' : 'Inspeksi · ') + G.blokName(b), G.TIPE_LBL[p.tipe] + (p.tipe === 'rotasi' ? ' ' + p.nomor : ''), `<div class="stack">
    ${s.selesai_at ? `<div class="alert ok">Sesi ditutup ${tgl(s.selesai_at)} ${jam(s.selesai_at)} · hasil ${fmt(s.pct, 2)}%</div>` : ''}
    <div class="card"><div class="row between"><span class="gps" id="sAcc">± – m</span><span class="small muted" id="sInfo">${track.length} titik jejak</span></div><p class="note" id="sGpsMsg">${mine ? 'Jejak penyapuan direkam selama halaman ini terbuka. Jangan tutup layar terlalu lama.' : 'Sesi milik ' + esc(nm(s.oleh)) + '.'}</p>${ag ? `<p class="small" style="margin:4px 0 0">Anggota tim: <b>${esc(ag.nama)}</b> · area <b style="color:${ZC[myZ % ZC.length]}">jalur ${myZ + 1}</b> · ketua ${esc(nm(s.oleh))}</p>` : ''}</div>
    ${mine ? `<button class="btn big block" id="sScan">Scan tag</button>` : ''}
    <div class="tiles"><div class="tile"><span>Mati di sesi ini</span><b>${dead.size}</b><span>${verif ? 'dari ' + glTags.length + ' tag GL' : 'tag GL baru + tag lama'}</span></div><div class="tile"><span>Hidup / closed</span><b>${hidup.size}</b><span>dinilai di sesi ini</span></div></div>
    <div class="map short" id="smap"></div>
    ${lead || tim.length ? `<div class="card stack"><div class="row between"><h2>Tim inspeksi (${tim.length + 1} orang)</h2>${lead ? '<button class="btn ghost sm" id="tmRf">Perbarui</button>' : ''}</div>
      <div class="list"><div class="item"><i class="sw" style="background:${ZC[0]};width:14px;height:14px;border-radius:3px;flex:none"></i><div class="grow"><b>${esc(nm(s.oleh))} (ketua)</b><span>jalur 1 · ${evs.filter(e => !e.anggota_id).length} catatan</span></div></div>
      ${tim.map((a, i) => `<div class="item"><i class="sw" style="background:${ZC[(i + 1) % ZC.length]};width:14px;height:14px;border-radius:3px;flex:none"></i><div class="grow"><b>${esc(a.nama)}</b><span>jalur ${i + 2} · ${evs.filter(e => e.anggota_id === a.id).length} catatan · ${(a.track || []).length} titik jejak</span></div>${a.selesai_at ? '<span class="pill s-ok">Selesai</span>' : lead ? `<button class="btn ghost sm" data-agx="${a.id}">Tandai selesai</button>` : '<span class="pill s-pend">Bekerja</span>'}</div>`).join('')}</div>
      ${lead ? '<button class="btn block" id="tmAdd">Tambah anggota (QR)</button><p class="note" style="margin:0">Anggota hanya mencatat di lapangan. Menutup sesi dan mengajukan BA tetap dari akun GL.</p>' : ''}</div>` : ''}
    ${verif ? `<div class="card stack"><h2>Tag GL yang diverifikasi</h2><div class="list">${glTags.map(t => { const d = dead.has(t.id), h = hidup.has(t.id); return `<a class="item" href="#" data-tag="${esc(t.id)}"><span class="tagid">${esc(t.id.slice(-6))}</span><div class="grow"><b>${d ? 'Mati lagi' : h ? 'Hidup' : 'Belum dinilai'}</b><span>${esc(t.jalur)} · ${esc(G.KONDLBL[t.kondisi])}</span></div><span class="pill ${d ? 's-bad' : h ? 's-ok' : 's-idle'}">${d ? 'mati' : h ? 'hidup' : '–'}</span></a>`; }).join('')}</div></div>` : ''}
    <div class="card stack"><div class="row between"><h2>Foto kegiatan</h2><span class="small muted">${foto.length}/4 wajib</span></div><div class="photos">${[0, 1, 2, 3].map(i => `<button class="ph" data-ph="${i}" type="button" ${lead ? '' : 'disabled'} aria-label="Foto ${i + 1}">${foto[i] ? `<img data-src="${esc(foto[i])}" alt="Foto ${i + 1}">` : '+ foto'}</button>`).join('')}</div><p class="note">Ambil langsung dari kamera. Foto asli dihapus setelah scan BA bertanda tangan dikonfirmasi admin.</p></div>
    ${lead ? `<button class="btn block" id="sClose" ${foto.length >= 4 ? '' : 'disabled'}>Tutup sesi dan hitung hasil</button>${foto.length < 4 ? '<p class="note">Lengkapi 4 foto untuk menutup sesi.</p>' : ''}` : ''}
    ${ag ? '<button class="btn block" id="agDone">Bagian saya selesai</button><p class="note">Tekan setelah area Anda selesai disapu. Semua catatan harus sudah terkirim (butuh sinyal).</p>' : ''}
  </div>`);
  void el;
  // gambar foto
  $$('img[data-src]').forEach(async im => { try { im.src = await fileUrl('foto', im.dataset.src); } catch (e) {} });
  // peta
  const map = newMap($('#smap')); const gj = window.L.geoJSON(b.geom, { style: { color: '#fff', weight: 2, fillOpacity: .08 } }).addTo(map); map.fitBounds(gj.getBounds(), { padding: [10, 10] });
  if (lead || tim.length) { const zs = zones(b, tim.length + 1); zs.forEach((z, i) => window.L.rectangle(z, { color: ZC[i % ZC.length], weight: i === myZ ? 2.5 : 1, fillOpacity: i === myZ ? .18 : .06, dashArray: i === myZ ? null : '4 4', interactive: false }).addTo(map)); }
  if (lead || ag) { if (ag) window.L.polyline((s.track || []).map(x => [x[1], x[0]]), { color: ZC[0], weight: 2, opacity: .6 }).addTo(map); tim.filter(a => !ag || a.id !== ag.id).forEach(a => { const i = tim.indexOf(a) + 1; window.L.polyline((a.track || []).map(x => [x[1], x[0]]), { color: ZC[i % ZC.length], weight: 2, opacity: .7 }).addTo(map); }); }
  const line = window.L.polyline(track.map(x => [x[1], x[0]]), { color: ZC[myZ % ZC.length], weight: 3 }).addTo(map);
  S.tag.filter(t => t.blok_id === b.id && t.lat && (!verif || t.sumber === 'gl')).forEach(t => window.L.circleMarker([t.lat, t.lon], { radius: 6, color: '#fff', weight: 1.5, fillColor: dead.has(t.id) ? '#E0473B' : hidup.has(t.id) ? '#2F8A57' : tagColor(t), fillOpacity: 1 }).on('click', () => tagSheet(t.id, s)).addTo(map));
  locateControl(map);
  $$('[data-tag]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); tagSheet(a.dataset.tag, s); }));
  // jejak
  if (trackUnsub) { trackUnsub(); trackUnsub = null; } if (trackTimer) { clearInterval(trackTimer); trackTimer = null; }
  trackUnsub = GPS.sub(pos => {
    const a = $('#sAcc'); if (!a) { trackUnsub && trackUnsub(); return; }
    if (!pos) { $('#sGpsMsg').textContent = GPS.err || 'Menunggu GPS…'; return; }
    a.textContent = '± ' + pos.acc.toFixed(1) + ' m'; a.style.color = pos.acc <= 6 ? 'var(--ok)' : pos.acc <= 15 ? 'var(--warn)' : 'var(--bad)';
    if (!mine || pos.acc > 25) return;
    const last = track[track.length - 1];
    if (!last || dist({ lat: last[1], lon: last[0] }, pos) >= 3 || pos.t - last[3] > 30000) {
      track.push([+pos.lon.toFixed(7), +pos.lat.toFixed(7), Math.round(pos.acc), pos.t]); line.addLatLng([pos.lat, pos.lon]);
      try { localStorage.setItem(LK, JSON.stringify(track)); } catch (e) {}
      const inf = $('#sInfo'); if (inf) inf.textContent = track.length + ' titik jejak';
    }
  });
  if (mine) trackTimer = setInterval(() => { if (!document.getElementById('smap')) { clearInterval(trackTimer); return; } saveTrack().catch(() => {}); }, 60000);
  // tim
  const ta = $('#tmAdd'); if (ta) ta.addEventListener('click', async () => {
    if (!isOnline()) return toast('Menampilkan QR anggota butuh sinyal sekali agar kode tersimpan.', 4000);
    if (!s.kode) { const k = Math.random().toString(36).slice(2, 8).toUpperCase(); try { await upd('sesi', { id: s.id }, { kode: k }, { offline: false }); s.kode = k; } catch (e) { return toast(e.message); } }
    qrSheet(s, () => renderSesi(id, shell));
  });
  const tr = $('#tmRf'); if (tr) tr.addEventListener('click', async () => { tr.disabled = true; try { await flush(); await loadAll(); } catch (e) {} renderSesi(id, shell); });
  $$('[data-agx]').forEach(bt => bt.addEventListener('click', async () => {
    const a = tim.find(x => x.id === bt.dataset.agx);
    if (!(await confirmSheet(`Tandai ${esc(a.nama)} selesai? Pakai ini hanya jika HP-nya mati atau ia sudah pulang. Catatan yang belum terkirim dari HP itu bisa tidak terhitung.`, 'Tandai selesai'))) return;
    try { await upd('sesi_anggota', { id: a.id }, { selesai_at: new Date().toISOString() }, { offline: false }); renderSesi(id, shell); } catch (e) { toast(e.net ? 'Butuh sinyal.' : e.message); }
  }));
  const ad = $('#agDone'); if (ad) ad.addEventListener('click', async () => {
    if (!(await confirmSheet('Bagian Anda sudah selesai disapu? Setelah ini HP Anda keluar dari sesi.', 'Selesai'))) return;
    ad.disabled = true;
    try { await saveTrack(); await flush(); } catch (e) {}
    if (pending()) { ad.disabled = false; return toast(`Masih ada ${pending()} catatan belum terkirim. Cari sinyal lalu tekan lagi.`, 4500); }
    try { await upd('sesi_anggota', { id: ag.id }, { track, selesai_at: new Date().toISOString() }, { offline: false }); }
    catch (e) { ad.disabled = false; return toast(e.net ? 'Butuh sinyal untuk menyelesaikan.' : e.message); }
    try { localStorage.removeItem(LK); } catch (e) {} lsSet(agKey(s.id), null);
    if (trackUnsub) trackUnsub(); clearInterval(trackTimer);
    toast('Terima kasih. Bagian Anda tercatat selesai.', 3500); location.hash = '#scan';
  });
  // scan
  const sc = $('#sScan'); if (sc) sc.addEventListener('click', async () => {
    const tid = await scanQR(verif ? 'Scan tag GL yang diverifikasi' : 'Scan tag di ajir'); if (!tid) return;
    const t = S.tag.find(x => x.id === tid);
    if (!t) {
      if (verif) return toast('Verifikasi hanya untuk tag GL periode ini.');
      await newTag({ id: tid, b, p, sesi: s, sumber: 'gl' }); return renderSesi(id, shell);
    }
    if (t.blok_id !== b.id) return toast(`Tag ${tid} milik ${G.blokName(S.blokMap[t.blok_id])}.`);
    if (verif && !(t.sumber === 'gl' && t.periode_id === p.id)) return toast('Verifikasi hanya untuk tag GL periode ini.');
    tagSheet(tid, s, () => renderSesi(id, shell));
  });
  // foto
  $$('[data-ph]').forEach(btn => btn.addEventListener('click', async () => {
    if (!mine) return; const i = +btn.dataset.ph; const blob = await pickPhoto(); if (!blob) return;
    const path = `${s.id}/${i + 1}-${Date.now()}.jpg`;
    try { btn.innerHTML = '…'; const how = await uploadOrQueue('foto', path, blob); const f = [...(s.foto || [])]; f[i] = path; await upd('sesi', { id: s.id }, { foto: f.filter(Boolean) }); if (how === 'queued') toast('Foto disimpan di HP, diunggah otomatis saat ada sinyal.'); renderSesi(id, shell); }
    catch (e) { toast(e.message); btn.innerHTML = '+ foto'; }
  }));
  // tutup sesi
  const cl = $('#sClose'); if (cl) cl.addEventListener('click', async () => {
    if (tim.length) { if (isOnline()) { try { await flush(); await loadAll(); } catch (e) {} } const blm = anggota(s).filter(a => !a.selesai_at); if (blm.length) return toast(`Belum selesai: ${blm.map(a => a.nama).join(', ')}. Minta mereka menekan "Bagian saya selesai", atau tandai selesai di daftar tim.`, 5500); if (anggota(s).length && S.tag_event.filter(e => e.sesi_id === s.id).length !== evs.length) return renderSesi(id, shell); }
    const realS = L.realisasi(b); const tot = realS.pio + realS.sis; const pct = tot ? (tot - dead.size) / tot * 100 : 0;
    if (!(await confirmSheet(`Tutup sesi dengan ${dead.size} tanaman mati? Persen hidup ${fmt(pct, 2)}%. ${pct >= G.STD.ambang ? (p.vendor === 'exdas' ? (p.tipe === 'cek1' ? 'Vendor menyulam semua tag GL, lalu GL mengajukan BA Keberhasilan Penilaian.' : 'Vendor menyulam semua tag GL, lalu ExDAS mengajukan BA Keberhasilan Penilaian Retensi.') : 'Vendor wajib menyulam semua tag GL, lalu BA menunggu persetujuan owner.') : 'Di bawah 90%: vendor menyulam tag GL, lalu GL verifikasi ulang.'}`, 'Tutup sesi'))) return;
    try {
      await saveTrack({ selesai_at: new Date().toISOString() });
      const sesiList = S.sesi.filter(x => x.periode_id === p.id);
      const sen = L.sensus(p, b, sesiList);
      await upd('sesi', { id: s.id }, { pct: sen.pct, hasil: { rows: sen.rows, aktual: sen.aktual } });
      const openGl = L.openGL(p).length;
      const final = sen.pct >= G.STD.ambang;
      await upd('periode', { id: p.id }, { status: openGl || !final ? 'sulam_gl' : p.vendor === 'exdas' ? 'ajukan_ba' : 'menunggu_persetujuan', pct: sen.pct, hasil: { final, rows: sen.rows, sesi_id: s.id, gl: { id: S.me.id, at: new Date().toISOString() } } });
      try { localStorage.removeItem(LK); } catch (e) {}
      if (trackUnsub) trackUnsub(); clearInterval(trackTimer);
      toast(`Sesi ditutup · ${fmt(sen.pct, 2)}%. ${openGl ? openGl + ' tag GL dikirim ke vendor untuk disulam.' : p.vendor === 'exdas' ? (p.tipe === 'cek1' ? 'BA KP siap diajukan GL.' : 'BA KPR siap diajukan ExDAS.') : 'Menunggu persetujuan owner.'}`, 4000);
      location.hash = '#blok/' + encodeURIComponent(b.id);
    } catch (e) { toast(e.message); }
  });
}

// ---------- scan umum ----------
// cegah ketukan ganda: semua tombol aksi di lembar dikunci selama proses
function once(box, fn) { let busy = false; return async (...a) => { if (busy) return; busy = true; const bs = [...box.querySelectorAll('button.btn')], prev = bs.map(b => b.disabled); bs.forEach(b => b.disabled = true); try { await fn(...a); } finally { busy = false; if (box.isConnected) bs.forEach((b, i) => b.disabled = prev[i]); } }; }
export function openScan(shell) {
  const r = role();
  const tim = mySesiTim(); const myOpen = tim || S.sesi.find(x => x.oleh === S.me.id && !x.selesai_at && !myAg(x));
  const internal = !isRole('exdas', 'bumdes');
  shell('Scan tag', null, `<div class="stack">
    ${myOpen ? `<a class="item" href="#sesi/${myOpen.id}"><div class="grow"><b>${tim ? 'Sesi tim yang Anda ikuti' : 'Sesi inspeksi berjalan'}</b><span>${esc(G.blokName(S.blokMap[myOpen.blok_id]))}${tim ? ' · ketua ' + esc(nm(tim.oleh)) : ''}</span></div><span class="pill s-pend">Buka</span></a>` : ''}
    ${internal && !myOpen ? '<div class="alert">Ikut inspeksi GL: tekan <b>Scan QR</b> lalu arahkan ke QR "Tambah anggota" di HP GL.</div>' : ''}
    <button class="btn big block" id="scGo">Scan QR tag</button>
    <p class="note">${isRole('exdas') || isRole('bumdes') ? 'Scan tag untuk mencatat sulam, atau untuk memasang tag baru pada tanaman mati di blok yang sedang Anda kerjakan.' : 'Scan tag untuk melihat riwayat titik. Penilaian hidup/mati dilakukan dari dalam sesi inspeksi.'}</p>
    <div class="card stack"><h2>Tag terakhir saya</h2><div class="list">${S.tag_event.filter(e => e.oleh === S.me.id).slice(-10).reverse().map(e => S.tag.find(t => t.id === e.tag_id)).filter(Boolean).map(tagItem).join('') || '<p class="muted small" style="margin:0">Belum ada.</p>'}</div></div></div>`);
  $$('[data-tag]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); tagSheet(a.dataset.tag); }));
  $('#scGo').addEventListener('click', async () => {
    const id = await scanQR(); if (!id) return;
    if (id.startsWith('HMK1')) { const { terimaSuratJalan } = await import('./nursery.js'); await terimaSuratJalan(id); return openScan(shell); }
    if (id.startsWith('HMS1')) return joinSesi(id);
    if (isOnline()) { try { await Promise.race([loadAll(), new Promise(ok => setTimeout(ok, 6000))]); } catch (e) {} } // stok & status terbaru sebelum mencatat
    const t = S.tag.find(x => x.id === id);
    if (t) { if (!seesBlok(S.blokMap[t.blok_id])) return toast('Tag ini bukan bagian pekerjaan akun Anda.'); return tagSheet(id, null, () => openScan(shell)); }
    if (isRole('exdas') || isRole('bumdes') || isRole('admin')) {
      const cands = S.blok.filter(b => seesBlok(b) && b.layer !== 'berhasil').map(b => ({ b, p: L.aktif(b.id) })).filter(x => x.p && x.p.status === 'pelaksanaan' && x.p.tipe !== 'cek1');
      if (!cands.length) return toast('Tag baru hanya bisa dipasang saat perawatan atau retensi sedang berjalan.');
      const pick = cands.length === 1 ? cands[0] : await new Promise(res => sheet(`<div class="stack"><h2>Tag ${esc(id)} untuk blok mana?</h2><div class="list">${cands.map((c, i) => `<button class="item" data-i="${i}" style="font:inherit;text-align:left;width:100%"><div class="grow"><b>${esc(G.blokName(c.b))}</b><span>${G.TIPE_LBL[c.p.tipe]}</span></div></button>`).join('')}</div><button class="btn ghost" data-close>Batal</button></div>`, (box, close) => { box.querySelectorAll('[data-i]').forEach(x => x.addEventListener('click', () => { close(); res(cands[+x.dataset.i]); })); box.querySelector('[data-close]').addEventListener('click', () => res(null)); }));
      if (!pick) return;
      await newTag({ id, b: pick.b, p: pick.p, sesi: null, sumber: 'vendor' }); return openScan(shell);
    }
    if (myOpen) { location.hash = '#sesi/' + myOpen.id; return; }
    toast('Tag ' + id + ' belum terdaftar. Tag baru dipasang dari sesi inspeksi.');
  });
}

// ---------- lembar tag ----------
export function tagSheet(id, sesi = null, after = null) {
  const t = S.tag.find(x => x.id === id); if (!t) return toast('Tag tidak ditemukan.');
  const b = S.blokMap[t.blok_id]; const p = L.aktif(b.id); const r = role();
  const ev = L.events(id); const dead = L.deadAt(t); const al = L.allowed(t);
  const lastS = ev.filter(e => e.tipe === 'sulam').pop(); const ageS = lastS ? G.diffDays(G.today(), G.tglWIB(lastS.at)) : null;
  const vendorOk = (isRole(G.vendorOf(b)) || isRole('admin')) && t.status === 'mati' && p && ((t.sumber === 'vendor' && p.status === 'pelaksanaan') || (t.sumber === 'gl' && p.status === 'sulam_gl') || (p.status === 'pelaksanaan' && p.tipe !== 'cek1'));
  const sesiOk = sesi && worker(sesi) && sesi.blok_id === b.id;
  const stok = L.stokTampung(b.id);
  let act = '';
  if (sesiOk) {
    const judged = S.tag_event.some(e => e.sesi_id === sesi.id && e.tag_id === id);
    const young = t.status === 'disulam' && ageS != null && ageS < 7;
    act = judged ? '<div class="alert">Tag ini sudah dinilai di sesi ini.</div>' : young ? `<div class="alert warn">Sulaman baru ${ageS} hari. Bisa dinilai mulai ${tgl(G.addDays(G.tglWIB(lastS.at), 7))}.</div>` :
      `<div class="grid2"><button class="btn" id="tHidup" ${t.status === 'mati' ? 'disabled' : ''}>Hidup</button><button class="btn bad" id="tMati">Mati</button></div>${t.status === 'mati' ? '<p class="note">Tag ini masih berstatus mati (belum disulam), otomatis dihitung mati.</p>' : ''}`;
  } else if (vendorOk) {
    const opts = al.filter(j => stok[j.kode] > 0);
    act = `<div class="sec"><h3>Scan sulam (${isRole('admin') ? 'vendor' : 'Anda'})</h3>${p.status === 'inspeksi' ? '<p class="err">Sesi inspeksi sedang terbuka. Sulam belum bisa dicatat.</p>' : opts.length ? `<label class="f" for="tJ">Jenis yang disulam <small>dari stok bibit di lapangan blok ini</small><select id="tJ">${opts.map(j => `<option value="${j.kode}">${esc(j.nama)} (${fmt(stok[j.kode])})</option>`).join('')}</select></label><button class="btn block" id="tSulam">Tandai sudah disulam</button><p class="note">Posisi HP dicek: harus dalam 15 m${t.low_acc ? ' + ' + fmt(t.acc) + ' m (akurasi awal rendah)' : ''} dari titik tag.</p>` : '<p class="err">Tidak ada bibit yang cocok di stok bibit di lapangan blok ini. Minta kiriman dari nursery.</p>'}</div>`;
  }
  sheet(`<div class="stack"><div class="row between"><span class="tagid" style="font-size:16px">${esc(id)}</span><span class="pill ${t.status === 'closed' ? 's-ok' : t.status === 'disulam' ? 's-pend' : 's-bad'}">${t.status === 'mati' ? 'Mati' : t.status === 'disulam' ? 'Disulam' : 'Hidup, closed'}</span></div>
    <dl class="kv"><dt>Blok</dt><dd>${esc(G.blokName(b))}</dd><dt>Ditandai</dt><dd>${t.sumber === 'gl' ? 'GL owner' : 'Vendor'} · ${esc(t.pencatat || nm(t.created_by))}</dd><dt>Jalur</dt><dd>${esc(t.jalur)}</dd><dt>Kondisi</dt><dd>${esc(G.KONDLBL[t.kondisi])}</dd><dt>Akurasi awal</dt><dd style="${t.low_acc ? 'color:var(--warn)' : ''}">± ${fmt(t.acc, 1)} m${t.low_acc ? ' · sulit ditemukan' : ''}</dd></dl>
    <div class="sec"><h3>Riwayat</h3><ul class="small" style="margin:0;padding-left:18px">${ev.map(e => `<li>${tgl(e.at)} ${jam(e.at)} · ${e.tipe === 'mati' ? 'Mati' : e.tipe === 'sulam' ? 'Disulam' : 'Hidup'}${e.jenis ? ': ' + esc(S.jenisMap[e.jenis]?.nama) : ''} · ${esc(e.pencatat || nm(e.oleh))}${e._pending ? ' (antre)' : ''}</li>`).join('')}</ul></div>
    <div class="sec"><h3>Jenis yang boleh untuk titik ini</h3><div class="chips">${al.map(j => `<span class="chip yes">${esc(j.nama)}</span>`).join('')}${[...dead].map(k => `<span class="chip no">${esc(S.jenisMap[k]?.nama || k)}</span>`).join('')}</div></div>
    ${act}<button class="btn ghost block" data-close>Tutup</button></div>`, (box, close) => {
    const done = () => { close(); after ? after() : route(); };
    const h = box.querySelector('#tHidup'); if (h) h.addEventListener('click', once(box, async () => {
      await ins('tag_event', { tag_id: id, periode_id: sesi.periode_id, sesi_id: sesi.id, tipe: 'hidup', oleh: S.me.id, client_at: new Date().toISOString(), lon: GPS.pos?.lon, lat: GPS.pos?.lat, acc: GPS.pos?.acc, ...who(sesi) });
      await upd('tag', { id }, { status: 'closed' }); toast(id + ' hidup, titik ditutup.'); done();
    }));
    const m = box.querySelector('#tMati'); if (m) m.addEventListener('click', once(box, async () => {
      const jenis = lastS?.jenis || ev.filter(e => e.tipe === 'mati').pop()?.jenis;
      await ins('tag_event', { tag_id: id, periode_id: sesi.periode_id, sesi_id: sesi.id, tipe: 'mati', jenis, oleh: S.me.id, client_at: new Date().toISOString(), lon: GPS.pos?.lon, lat: GPS.pos?.lat, acc: GPS.pos?.acc, ...who(sesi) });
      const patch = { status: 'mati' }; if (t.sumber !== 'gl' || t.periode_id !== sesi.periode_id) Object.assign(patch, { sumber: 'gl', periode_id: sesi.periode_id });
      await upd('tag', { id }, patch); toast(`${id} mati. ${S.jenisMap[jenis]?.nama || ''} dikeluarkan dari pilihan titik ini.`); done();
    }));
    const su = box.querySelector('#tSulam'); if (su) su.addEventListener('click', once(box, async () => {
      const jk = box.querySelector('#tJ').value;
      let pos = GPS.pos && Date.now() - GPS.pos.t < 20000 && GPS.pos.acc <= 15 ? GPS.pos : null;
      if (!pos) { pos = await waitGPS(15, 'Cek posisi di titik tag'); if (!pos) return; }
      if (t.lat) { const d = dist({ lat: t.lat, lon: t.lon }, pos); const lim = 15 + (t.low_acc ? Number(t.acc || 0) : 0); if (d > lim) return toast(`Posisi Anda ${fmt(d)} m dari titik tag (batas ${fmt(lim)} m). Dekati ajir lalu scan lagi.`, 4500); }
      await ins('tag_event', { tag_id: id, periode_id: p.id, tipe: 'sulam', jenis: jk, lon: pos.lon, lat: pos.lat, acc: pos.acc, oleh: S.me.id, client_at: new Date().toISOString() });
      await upd('tag', { id }, { status: 'disulam' }); toast(`${id} disulam ${S.jenisMap[jk]?.nama}. Bisa dinilai 7 hari lagi.`); done();
    }));
  });
}
