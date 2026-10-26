// Baca lokasi GPS dan waktu ambil dari EXIF foto JPEG (foto galeri yang lokasinya tersimpan).
export async function readExif(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer(); const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return {};
    let o = 2;
    while (o + 4 < v.byteLength) {
      const mk = v.getUint16(o), len = v.getUint16(o + 2);
      if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) return parseTiff(v, o + 10);
      if ((mk & 0xFF00) !== 0xFF00) break; o += 2 + len;
    }
  } catch (e) {}
  return {};
}
function parseTiff(v, t) {
  const le = v.getUint16(t) === 0x4949; const u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
  const ifd = off => { const n = u16(t + off), out = {}; for (let i = 0; i < n; i++) { const e = t + off + 2 + i * 12; out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), val: e + 8 }; } return out; };
  const rat = (p, i) => { const a = t + u32(p) + i * 8; return u32(a) / (u32(a + 4) || 1); };
  const str = e => { const p = e.count > 4 ? t + u32(e.val) : e.val; let s = ''; for (let i = 0; i < e.count - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; };
  const ref = e => e ? String.fromCharCode(v.getUint8(e.val)) : '';
  const out = {}; const i0 = ifd(u32(t + 4));
  if (i0[0x8769]) { const ex = ifd(u32(i0[0x8769].val)); const d = ex[0x9003] || ex[0x9004]; if (d) { const m = /(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(str(d)); if (m) out.time = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`; } }
  if (!out.time && i0[0x0132]) { const m = /(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(str(i0[0x0132])); if (m) out.time = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`; }
  if (i0[0x8825]) {
    const g = ifd(u32(i0[0x8825].val));
    if (g[2] && g[4]) {
      const dms = e => rat(e.val, 0) + rat(e.val, 1) / 60 + rat(e.val, 2) / 3600;
      let lat = dms(g[2]), lon = dms(g[4]); if (ref(g[1]) === 'S') lat = -lat; if (ref(g[3]) === 'W') lon = -lon;
      if (isFinite(lat) && isFinite(lon) && (lat || lon)) { out.lat = lat; out.lon = lon; }
    }
  }
  return out;
}
// titik di dalam poligon blok (GeoJSON Polygon/MultiPolygon), dengan toleransi jarak (meter) ke tepi
export function inBlok(geom, lon, lat, tolM = 30) {
  if (!geom) return false;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  const k = Math.cos(lat * Math.PI / 180) * 111320, kl = 110540;
  for (const pl of polys) {
    let ins = false; const r = pl[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) ins = !ins; }
    if (ins) return true;
    for (const ring of pl) for (let i = 0; i + 1 < ring.length; i++) {
      const ax = (ring[i][0] - lon) * k, ay = (ring[i][1] - lat) * kl, bx = (ring[i + 1][0] - lon) * k, by = (ring[i + 1][1] - lat) * kl;
      const dx = bx - ax, dy = by - ay, tt = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(ax + tt * dx, ay + tt * dy) <= tolM) return true;
    }
  }
  return false;
}
