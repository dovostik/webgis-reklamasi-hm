// Denah nursery skematis dari data SHP: seluruh denah diputar lurus (sudut bedengan dominan), bedengan digambar
// sebagai kotak berlabel kode, jenis, dan jumlah, supaya mudah dicari di layar HP. Data tetap dari geometri asli.
import { S, L } from './core.js';
import * as G from './logic.js';
const { esc, fmt } = G;
const CLC = { SP: '#FFF2CC', PB: '#FFD966', BF: '#A9D08E', BL: '#4E7A3B' };
const UNIT = 26; // satuan SVG per meter

function ringsOf(g) {
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}
let cache = null;
function frame() {
  const key = S.bedengan.length + ':' + S.nursery_fitur.length + ':' + (S.bedengan[0]?.kode || '');
  if (cache && cache.key === key) return cache;
  const beds = S.bedengan.filter(b => b.status === 'aktif');
  const all = beds.flatMap(b => ringsOf(b.geom).flat());
  if (!all.length) return (cache = { key, ok: false });
  const lon0 = all.reduce((a, p) => a + p[0], 0) / all.length, lat0 = all.reduce((a, p) => a + p[1], 0) / all.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const m = p => [(p[0] - lon0) * kx, (p[1] - lat0) * ky];
  // sudut dominan: sisi terpanjang tiap bedengan, dinormalkan ke kelipatan 90°
  const angs = beds.map(b => { const r = (ringsOf(b.geom)[0] || []).map(m); let best = 0, a = 0; for (let i = 0; i + 1 < r.length; i++) { const dx = r[i + 1][0] - r[i][0], dy = r[i + 1][1] - r[i][1], d = Math.hypot(dx, dy); if (d > best) { best = d; a = Math.atan2(dy, dx); } } let t = a % (Math.PI / 2); if (t < -Math.PI / 4) t += Math.PI / 2; if (t > Math.PI / 4) t -= Math.PI / 2; return t; }).sort((a, b) => a - b);
  const th = angs[Math.floor(angs.length / 2)] || 0, c = Math.cos(-th), s = Math.sin(-th);
  const T = p => { const [x, y] = m(p); return [(x * c - y * s) * UNIT, -(x * s + y * c) * UNIT]; };
  const box = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
  const B = beds.map(b => ({ kode: b.kode, cl: b.cluster, ...box(ringsOf(b.geom).flat().map(T)) }));
  const F = S.nursery_fitur.map(f => ({ layer: f.layer, props: f.props || {}, rings: ringsOf(f.geom).map(r => r.map(T)) }));
  const pts = [...B.flatMap(b => [[b.x, b.y], [b.x + b.w, b.y + b.h]]), ...F.flatMap(f => f.rings.flat())];
  const vb = box(pts); const pad = 2 * UNIT;
  return (cache = { key, ok: true, B, F, vb: { x: vb.x - pad, y: vb.y - pad, w: vb.w + 2 * pad, h: vb.h + 2 * pad } });
}
const short = s => { const w = String(s || '').split(/\s+/); return w[0].length > 9 ? w[0].slice(0, 8) + '.' : w[0]; };

// q: kata pencarian (kode atau jenis). Mengembalikan { svg, hits }
export function denahSVG(q = '') {
  const f = frame(); if (!f.ok) return { svg: '<p class="muted small">Denah bedengan belum ada.</p>', hits: [] };
  const ql = q.trim().toLowerCase(); const hits = [];
  const fac = f.F.map(x => {
    const d = x.rings.map(r => 'M' + r.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + (x.layer === 'parit' ? '' : 'Z')).join('');
    if (x.layer === 'parit') return `<path d="${d}" fill="none" stroke="#4F86C6" stroke-width="${UNIT * .35}" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
    if (x.layer === 'cluster') return '';
    const bb = x.rings.flat(); const cx = bb.reduce((a, p) => a + p[0], 0) / bb.length, cy = bb.reduce((a, p) => a + p[1], 0) / bb.length;
    const water = x.props.JENIS === 'air';
    const bw = Math.max(...bb.map(p => p[0])) - Math.min(...bb.map(p => p[0])), nm = String(x.props.NAMA || '');
    const lbl = bw > (nm.length + 3) * 9.5 ? `${x.props.NO ?? ''} ${nm}` : String(x.props.NO ?? '');
    return `<path d="${d}" fill="${water ? '#9CC3E6' : '#C9CDCA'}" stroke="#555" stroke-width="1" opacity=".9"><title>${esc(nm)}</title></path><text x="${cx.toFixed(0)}" y="${cy.toFixed(0)}" class="dn-fac">${esc(lbl)}</text>`;
  }).join('');
  const beds = f.B.map(b => {
    const ls = L.lotsIn(b.kode), n = ls.reduce((a, l) => a + l.jumlah, 0), cap = S.bedMap[b.kode]?.kapasitas || 1300;
    const jen = [...new Set(ls.map(l => S.jenisMap[l.jenis]?.nama || l.jenis))];
    const st = ls.map(l => L.stage(l));
    const due = st.some(x => x.due), ready = st.some(x => x.ready), ak = st.some(x => x.aklim), beli = ls.some(l => l.sumber === 'beli');
    const match = ql && (b.kode.toLowerCase().includes(ql) || jen.some(j => j.toLowerCase().includes(ql)));
    if (match) hits.push(b.kode);
    const vert = b.h > b.w, fr = Math.min(1, n / cap);
    const fill = vert ? `<rect x="${b.x}" y="${b.y + b.h * (1 - fr)}" width="${b.w}" height="${b.h * fr}" fill="${CLC[b.cl] || '#ccc'}"/>` : `<rect x="${b.x}" y="${b.y}" width="${b.w * fr}" height="${b.h}" fill="${CLC[b.cl] || '#ccc'}"/>`;
    const dark = b.cl === 'BL' && fr > .55;
    const l1 = b.kode, l2 = n ? (jen.length > 1 ? jen.length + ' jenis' : short(jen[0])) : 'kosong', l3 = n ? fmt(n) : '';
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, len = Math.max(b.w, b.h), thick = Math.min(b.w, b.h);
    const fs = Math.max(8, Math.min(thick * .36, 15));
    const tx = `<text class="dn-t${dark ? ' dk' : ''}" font-size="${fs.toFixed(1)}" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})${vert ? ' rotate(-90)' : ''}"><tspan x="0" dy="${(-fs * .15).toFixed(1)}" font-weight="700">${esc(l1)}</tspan><tspan x="0" dy="${(fs * 1.05).toFixed(1)}">${esc(l2)}${l3 ? ' · ' + l3 : ''}</tspan></text>`;
    const dot = (due ? '#E0473B' : ak ? '#4F739A' : ready ? '#2F8A57' : null);
    const dx = vert ? cx : b.x + b.w - fs * .6, dy = vert ? b.y + fs * .6 : cy;
    return `<g class="dn-b${match ? ' hit' : ''}${ql && !match ? ' dim' : ''}" data-bed="${esc(b.kode)}" id="dn-${esc(b.kode)}" role="button" tabindex="0" aria-label="Bedengan ${esc(b.kode)}, ${esc(l2)} ${l3}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#fff"/>${fill}<rect class="dn-o" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="transparent"/>${tx}${dot ? `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${(fs * .32).toFixed(1)}" fill="${dot}" stroke="#fff" stroke-width="1"/>` : ''}${beli ? `<text class="dn-beli" font-size="${(fs * .7).toFixed(1)}" x="${(vert ? cx : b.x + fs * .5).toFixed(1)}" y="${(vert ? b.y + b.h - fs * .4 : cy + fs * .25).toFixed(1)}">B</text>` : ''}</g>`;
  }).join('');
  const { x, y, w, h } = f.vb;
  const facNames = f.F.filter(x => x.layer === 'fasilitas').sort((a, b) => (a.props.NO || 0) - (b.props.NO || 0)).map(x => `${x.props.NO} ${x.props.NAMA}`).join(' · ');
  return { hits, w, h, facNames, svg: `<svg viewBox="${x.toFixed(0)} ${y.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" class="dn-svg" role="group" aria-label="Denah nursery">${fac}${beds}</svg>` };
}
