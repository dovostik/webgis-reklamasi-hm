// Aturan bisnis reklamasi & nursery (dipakai semua layar).
export const STD = { lubang: 881, pupuk: 1762, npk: 44, pio: 625, sis: 256, lcc: 15, kohe: 25, sekam: 25, ambang: 90 };
export const CAP_DEFAULT = 1300;
export const KONDISI = [['pmk', 'PMK spreading'], ['tergenang', 'Tergenang'], ['berpasir', 'Berpasir'], ['ob', 'Tanah OB']];
export const KONDLBL = Object.fromEntries(KONDISI);
export const ROLE_LBL = { admin: 'Administrator', owner: 'SPV / GL lapangan', nursery: 'GL Nursery', crew: 'Tenaga harian nursery', exdas: 'Vendor ExDAS', bumdes: 'Vendor BUMDES', viewer: 'Atasan (lihat saja)' };
export const STATUS_LBL = {
  pelaksanaan: 'Pelaksanaan vendor', siap_inspeksi: 'Siap inspeksi GL', inspeksi: 'Inspeksi berjalan',
  sulam_gl: 'Vendor menyulam tag GL', verifikasi: 'Siap verifikasi GL', menunggu_persetujuan: 'Menunggu persetujuan owner', selesai: 'Selesai'
};
export const TIPE_LBL = { cek1: 'Cek 1 penanaman', retensi: 'Retensi', rotasi: 'Rotasi perawatan' };

// ---------- tanggal ----------
export const DAY = 864e5;
export const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // tanggal WIB
export const toDate = s => s ? new Date(String(s).length <= 10 ? s + 'T12:00:00Z' : s) : null;
export const iso = d => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const addMonths = (s, n) => { const d = toDate(s); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return iso(d); };
export const diffDays = (a, b) => Math.floor((toDate(a) - toDate(b)) / DAY);
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const BLN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const wib = s => { const d = new Date(new Date(s).getTime() + 7 * 3600e3); return d; };
export const tgl = s => { if (!s) return '–'; const d = String(s).length <= 10 ? toDate(s) : wib(s); return `${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const jam = s => { if (!s) return ''; const d = wib(s); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
export const tglWIB = s => s ? iso(wib(s)) : null;
export const fmt = (n, d = 0) => Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- blok ----------
export function blokName(b) { if (!b) return '–'; if (b.layer === 'bastl') return b.nama || `${b.kode_bastl} · petak ${b.id.slice(2)}`; return b.nama; }
export const vendorOf = b => b.layer === 'bastl' ? 'exdas' : 'bumdes';
export function needs(ha) { return { lubang: Math.round(STD.lubang * ha), pupuk: Math.round(STD.pupuk * ha), npk: Math.round(STD.npk * ha), pio: Math.round(STD.pio * ha), sis: Math.round(STD.sis * ha), lcc: Math.round(STD.lcc * ha), sakKohe: Math.ceil(STD.pupuk * ha / STD.kohe), hariKerja: Math.ceil(ha / 10 * 30) }; }

export function makeLogic(S) {
  const J = () => S.jenisMap;
  const periodes = bid => S.periode.filter(p => p.blok_id === bid).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const aktif = bid => periodes(bid).filter(p => p.status !== 'selesai').pop() || null;
  const selesai = (bid, tipe) => periodes(bid).filter(p => p.status === 'selesai' && (!tipe || p.tipe === tipe));
  const tags = bid => S.tag.filter(t => t.blok_id === bid);
  const events = tid => S.tag_event.filter(e => e.tag_id === tid).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const deadAt = tag => new Set(events(tag.id).filter(e => e.tipe === 'mati' && e.jenis).map(e => e.jenis));
  function allowed(tag) {
    const dead = deadAt(tag);
    return S.jenis.filter(j => {
      if (dead.has(j.kode)) return false;
      if (tag.kondisi === 'tergenang') return j.tergenang === true;
      if (tag.kondisi === 'berpasir') return j.berpasir === true;
      if (tag.kondisi === 'ob') return j.ob === true;
      return true;
    });
  }
  function stokTampung(bid) {
    const m = {};
    S.kirim.filter(k => k.blok_id === bid && k.status === 'diterima').forEach(k => { m[k.jenis] = (m[k.jenis] || 0) + k.n; });
    const tagIds = new Set(tags(bid).map(t => t.id));
    S.tag_event.filter(e => e.tipe === 'sulam' && tagIds.has(e.tag_id) && e.jenis).forEach(e => { m[e.jenis] = (m[e.jenis] || 0) - 1; });
    S.tampung_log.filter(l => l.blok_id === bid).forEach(l => { m[l.jenis] = (m[l.jenis] || 0) - l.n; });
    Object.keys(m).forEach(k => { if (m[k] <= 0) delete m[k]; });
    return m;
  }
  const dalamKirim = bid => S.kirim.filter(k => k.blok_id === bid && k.status === 'dikirim');
  function realisasi(b) {
    if (b.layer === 'bastl' || selesai(b.id, 'cek1').length) {
      const r = { pio: 0, sis: 0 };
      S.tampung_log.filter(l => l.blok_id === b.id && l.tipe === 'tanam').forEach(l => { const j = J()[l.jenis]; r[j && j.tipe === 'pionir' ? 'pio' : 'sis'] += l.n; });
      if (r.pio + r.sis > 0) return { ...r, aktual: true };
    }
    return { pio: Math.round(STD.pio * b.ha), sis: Math.round(STD.sis * b.ha), aktual: false };
  }
  function lastSulam(bid, since) {
    const ids = new Set(tags(bid).map(t => t.id)); let last = null;
    S.tag_event.filter(e => e.tipe === 'sulam' && ids.has(e.tag_id) && (!since || e.at >= since)).forEach(e => { if (!last || e.at > last) last = e.at; });
    return last;
  }
  function lockInfo(p) {
    if (!p) return { why: 'Belum ada pekerjaan vendor di blok ini.' };
    if (!['siap_inspeksi', 'verifikasi'].includes(p.status)) return { why: 'Status: ' + STATUS_LBL[p.status] + '.' };
    const base = [p.vendor_selesai_at, lastSulam(p.blok_id, p.created_at)].filter(Boolean).sort().pop();
    if (base) { const until = addDays(tglWIB(base), 7); if (today() < until) return { why: `Bibit tanam/sulam terakhir ${tgl(base)} belum berumur 7 hari.`, until }; }
    return null;
  }
  function retensiInfo(p) {
    if (!p || p.tipe !== 'retensi') return null;
    const c1 = selesai(p.blok_id, 'cek1').pop(); if (!c1) return null;
    const until = addDays(tglWIB(c1.approved_at), 30);
    return { until, left: diffDays(until, today()) };
  }
  function rotasiInfo(b) {
    if (b.layer !== 'perawatan') return null;
    const tanam = b.tgl_tanam ? { tgl: b.tgl_tanam, perkiraan: false } : b.bln_tanam ? { tgl: b.bln_tanam + '-01', perkiraan: true } : null;
    if (!tanam) return null;
    const ap = selesai(b.id, 'rotasi').map(p => tglWIB(p.approved_at));
    const last = [b.tgl_rotasi_terakhir, ...ap].filter(Boolean).sort().pop() || null;
    let next, perk = false;
    if (last) next = addMonths(last, 4); else { perk = true; next = addMonths(tanam.tgl, 3); while (next < today()) next = addMonths(next, 4); }
    const umur = diffDays(today(), tanam.tgl);
    const dleft = diffDays(next, today());
    let st = !perk && dleft < 0 ? ['bad', 'Lewat jadwal'] : dleft <= 30 ? ['warn', 'Rotasi ≤ 30 hari'] : ['ok', 'Terjadwal'];
    if (perk && st[0] !== 'warn') st = ['pend', 'Terjadwal (perkiraan)'];
    return { tanam, last, next, perk, umur, dleft, kegiatan: umur >= 365 ? 'Penyiangan' : 'Pendangiran', status: { k: st[0], t: st[1] } };
  }
  function blokStatus(b) {
    if (b.layer === 'berhasil') return { k: 'done', t: 'Berhasil penilaian' };
    const p = aktif(b.id);
    if (b.layer === 'bastl') {
      if (!b.nama) return { k: 'idle', t: 'Belum diberi nama' };
      if (!p) return { k: 'idle', t: 'Menunggu pekerjaan' };
      if (p.status === 'pelaksanaan' && p.tipe === 'cek1') { const st = stokTampung(b.id); return Object.keys(st).length || S.tampung_log.some(l => l.blok_id === b.id) ? { k: 'warn', t: 'Penanaman berjalan' } : { k: 'idle', t: 'Menunggu bibit' }; }
      return { k: p.status === 'menunggu_persetujuan' ? 'warn' : 'pend', t: TIPE_LBL[p.tipe] + ' · ' + STATUS_LBL[p.status] };
    }
    if (p) return { k: p.status === 'menunggu_persetujuan' ? 'warn' : 'pend', t: TIPE_LBL[p.tipe] + ' ' + p.nomor + ' · ' + STATUS_LBL[p.status] };
    const r = rotasiInfo(b); return r ? r.status : { k: 'idle', t: '–' };
  }
  // tag GL yang masih harus disulam vendor dalam periode ini
  const openGL = p => S.tag.filter(t => t.blok_id === p.blok_id && t.periode_id === p.id && t.sumber === 'gl' && t.status === 'mati');
  const openVendor = p => S.tag.filter(t => t.blok_id === p.blok_id && t.periode_id === p.id && t.sumber === 'vendor' && t.status === 'mati');
  // permintaan sulam gabungan per blok x jenis mati
  function sulamDemand() {
    const out = {};
    S.tag.filter(t => t.status === 'mati').forEach(t => {
      const ev = events(t.id).filter(e => e.tipe === 'mati').pop();
      const jm = ev?.jenis || '?';
      const o = out[t.blok_id] = out[t.blok_id] || { blok_id: t.blok_id, perJenis: {}, total: 0, tags: [] };
      o.perJenis[jm] = (o.perJenis[jm] || 0) + 1; o.total++; o.tags.push(t);
    });
    Object.values(out).forEach(o => {
      const st = stokTampung(o.blok_id); const dk = dalamKirim(o.blok_id).reduce((a, k) => a + k.n, 0);
      o.tersedia = Object.values(st).reduce((a, b) => a + b, 0) + dk;
      o.kurang = Math.max(0, o.total - o.tersedia);
    });
    return Object.values(out);
  }
  function tanamDemand() {
    return S.minta.filter(m => m.tipe === 'tanam' && m.status === 'terbuka').map(m => {
      const sent = { pio: 0, sis: 0 };
      S.kirim.filter(k => k.minta_id === m.id).forEach(k => { const j = J()[k.jenis]; sent[j && j.tipe === 'pionir' ? 'pio' : 'sis'] += k.n; });
      const kembali = { pio: 0, sis: 0 };
      S.tampung_log.filter(l => l.blok_id === m.blok_id && l.tipe === 'kembali').forEach(l => { const j = J()[l.jenis]; kembali[j && j.tipe === 'pionir' ? 'pio' : 'sis'] += l.n; });
      return { ...m, sent, kembali };
    });
  }
  // ---------- nursery ----------
  const bed = k => S.bedMap[k];
  const lotsIn = k => S.lot.filter(l => l.bedengan === k && l.jumlah > 0);
  const fill = k => lotsIn(k).reduce((a, l) => a + l.jumlah, 0);
  function stage(l) {
    const b = bed(l.bedengan); const j = J()[l.jenis] || {}; const inBed = diffDays(today(), l.tgl_masuk);
    const dS = j.durasi_sapih || 56, dB = j.durasi_besar || 14, dT = j.durasi_bst || 14;
    if (!b) return { tahap: '?', left: 0 };
    if (b.tahap === 'Penyapihan') { const left = dS - diffDays(today(), l.tgl_sapih); return { tahap: b.tahap, left, due: left <= 0, ready: false, next: 'Pembesaran' }; }
    if (b.tahap === 'Pembesaran') { const left = dB - inBed; return { tahap: b.tahap, left, due: left <= 0, ready: false, next: j.tipe === 'pionir' ? 'BF' : 'BL' }; }
    const left = dT - inBed; return { tahap: 'BST', left, due: false, ready: left <= 0, next: null };
  }
  function readyStock() { const m = {}; S.lot.forEach(l => { if (l.jumlah > 0 && stage(l).ready) m[l.jenis] = (m[l.jenis] || 0) + l.jumlah; }); return m; }
  function readyLots(jk) { return S.lot.filter(l => l.jenis === jk && l.jumlah > 0 && stage(l).ready).sort((a, b) => a.tgl_masuk.localeCompare(b.tgl_masuk)); }
  function targetCluster(l) { const st = stage(l); if (st.next === 'Pembesaran') return S.bedengan.filter(b => b.tahap === 'Pembesaran'); if (st.next === 'BF' || st.next === 'BL') return S.bedengan.filter(b => b.cluster === st.next); return []; }
  function suggestTargets(l) {
    const beds = targetCluster(l).filter(b => b.status === 'aktif' && b.kode !== l.bedengan);
    const cap = b => b.kapasitas || CAP_DEFAULT;
    const same = beds.filter(b => { const ls = lotsIn(b.kode); return ls.length && ls.every(x => x.jenis === l.jenis) && fill(b.kode) < cap(b); });
    const empty = beds.filter(b => fill(b.kode) === 0);
    const partial = beds.filter(b => { const f = fill(b.kode); return f > 0 && f <= cap(b) / 2 && !same.includes(b) && new Set(lotsIn(b.kode).map(x => x.jenis)).size < 2; });
    const plan = []; let rest = l.jumlah;
    const take = (arr, why) => { for (const b of arr) { if (rest <= 0) break; const room = cap(b) - fill(b.kode) - plan.filter(p => p.bed === b.kode).reduce((s, p) => s + p.n, 0); if (room <= 0) continue; const n = Math.min(room, rest); plan.push({ bed: b.kode, n, why }); rest -= n; } };
    take(same, 'jenis sama'); if (rest > 0) take(empty, 'bedengan kosong'); if (rest > 0 && !empty.length) take(partial, 'campur, tidak ada bedengan kosong');
    return { plan, rest };
  }
  // ---------- sensus ----------
  function sensus(p, b, sesiList) {
    const rl = realisasi(b);
    const latest = sesiList.filter(s => s.selesai_at).pop();
    let deadIds = new Set();
    if (latest) S.tag_event.filter(e => e.sesi_id === latest.id && e.tipe === 'mati').forEach(e => deadIds.add(e.tag_id));
    const dead = [...deadIds].map(id => S.tag.find(t => t.id === id)).filter(Boolean);
    const mp = dead.filter(t => t.jalur === 'pioneer').length, ms = dead.length - mp;
    const rows = [['Pioneer', rl.pio, mp], ['Sisipan', rl.sis, ms], ['Jumlah', rl.pio + rl.sis, mp + ms]].map(([n, r, m]) => ({ n, r, m, h: r - m, p: r ? (r - m) / r * 100 : 0 }));
    return { rows, pct: rows[2].p, aktual: rl.aktual };
  }
  return { periodes, aktif, selesai, tags, events, deadAt, allowed, stokTampung, dalamKirim, realisasi, lastSulam, lockInfo, retensiInfo, rotasiInfo, blokStatus, openGL, openVendor, sulamDemand, tanamDemand, bed, lotsIn, fill, stage, readyStock, readyLots, suggestTargets, sensus };
}
