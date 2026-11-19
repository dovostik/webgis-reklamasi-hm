// Tingkat kehijauan per blok dari ortho drone (RGB): % luas blok yang tampak hijau (indeks ExG ternormalisasi).
// Dihitung sekali per ortho baru (oleh admin) dan diarsipkan di tabel blok_hijau, sehingga perkembangan blok terlihat dari waktu ke waktu.
import { S, ins, upd } from './core.js';
import { ORTHO, orthoUrl, SLOTS } from './offline.js';
import * as G from './logic.js';

const EXG = 0.04; // ambang hijau: (2G−R−B)/(R+G+B) > 0.04 dan G > R
const tXY = (lon, lat, z) => { const n = 2 ** z, r = lat * Math.PI / 180; return [(lon + 180) / 360 * n, (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * n]; };
const rings = g => g ? (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) : [];
function bbox(g) { let a = [180, 90, -180, -90]; rings(g).forEach(p => p[0].forEach(([x, y]) => { a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)]; })); return a; }
const loadImg = src => new Promise(ok => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

export const hijauRows = bid => (S.blok_hijau || []).filter(x => x.blok_id === bid).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.slot).localeCompare(String(b.slot)));
export const hijauLast = bid => { const r = hijauRows(bid).filter(x => Number(x.cakupan) >= 0.5); return r[r.length - 1] || null; };
// ortho yang belum dihitung
export const orthoBelum = () => SLOTS.map(([k, l]) => ({ k, l, o: ORTHO[k] })).filter(x => x.o && !(S.blok_hijau || []).some(r => r.ortho_id === x.o.id));

async function blokStat(b, k, o, z) {
  const [w, s, e, n] = bbox(b.geom), ob = o.bounds;
  if (ob && (e < ob[0] || w > ob[2] || n < ob[1] || s > ob[3])) return null;
  const [fx0, fy0] = tXY(w, n, z), [fx1, fy1] = tXY(e, s, z), tpl = orthoUrl(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d', { willReadFrequently: true });
  const mk = document.createElement('canvas'); mk.width = mk.height = 256; const mx = mk.getContext('2d', { willReadFrequently: true });
  let tot = 0, cov = 0, hij = 0; const jobs = [];
  for (let x = Math.floor(fx0); x <= Math.floor(fx1); x++) for (let y = Math.floor(fy0); y <= Math.floor(fy1); y++) jobs.push([x, y]);
  for (let i = 0; i < jobs.length; i += 6) {
    const imgs = await Promise.all(jobs.slice(i, i + 6).map(([x, y]) => loadImg(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y)).then(im => [x, y, im])));
    for (const [x, y, im] of imgs) {
      mx.clearRect(0, 0, 256, 256); mx.fillStyle = '#000'; mx.beginPath();
      rings(b.geom).forEach(p => p.forEach(r => r.forEach(([lo, la], j) => { const [px, py] = tXY(lo, la, z); const X = (px - x) * 256, Y = (py - y) * 256; j ? mx.lineTo(X, Y) : mx.moveTo(X, Y); })));
      mx.fill('evenodd'); const m = mx.getImageData(0, 0, 256, 256).data;
      let any = false; for (let q = 3; q < m.length; q += 4) if (m[q] > 127) { any = true; break; } if (!any) continue;
      let d = null; if (im) { cx.clearRect(0, 0, 256, 256); cx.drawImage(im, 0, 0, 256, 256); d = cx.getImageData(0, 0, 256, 256).data; }
      for (let q = 0; q < m.length; q += 4) { if (m[q + 3] <= 127) continue; tot++;
        if (!d || d[q + 3] < 128) continue; const R = d[q], Gc = d[q + 1], B = d[q + 2], sm = R + Gc + B; if (sm < 45) continue; cov++;
        if (Gc > R && (2 * Gc - R - B) / sm > EXG) hij++; }
    }
  }
  if (!tot || !cov) return null;
  return { pct: Math.round(hij / cov * 1000) / 10, cakupan: Math.round(cov / tot * 1000) / 1000, px: cov };
}

// hitung semua blok untuk satu slot ortho; onProg(i, n, nama)
export async function hitungHijau(k, onProg) {
  const o = ORTHO[k]; if (!o) throw new Error('Ortho belum ada.');
  const z = Math.min(o.maxzoom || 18, 18), list = S.blok.filter(b => b.geom); let done = 0, ok = 0;
  for (const b of list) {
    onProg && onProg(done, list.length, G.blokName(b));
    const r = await blokStat(b, k, o, z); done++;
    if (!r || r.cakupan < 0.05) continue;
    const id = `${b.id}|${o.id}`, row = { blok_id: b.id, ortho_id: o.id, slot: k, tanggal: o.tanggal, ...r, at: new Date().toISOString(), oleh: S.me.id };
    if ((S.blok_hijau || []).some(x => x.id === id)) await upd('blok_hijau', { id }, row); else await ins('blok_hijau', { id, ...row });
    ok++;
  }
  onProg && onProg(list.length, list.length, '');
  return ok;
}
