// Penyimpanan offline: salinan data (IndexedDB), foto yang menunggu sinyal, dan ubin peta satelit area kerja.
const DB = 'hm-offline', VER = 1;
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((ok, no) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('blob')) d.createObjectStore('blob'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((ok, no) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); });
}
export const kvGet = k => tx('kv', 'readonly', s => s.get(k)).catch(() => null);
export const kvSet = (k, v) => tx('kv', 'readwrite', s => s.put(v, k)).catch(() => null);
export const blobGet = k => tx('blob', 'readonly', s => s.get(k)).catch(() => null);
export const blobSet = (k, v) => tx('blob', 'readwrite', s => s.put(v, k)).catch(() => null);
export const blobDel = k => tx('blob', 'readwrite', s => s.delete(k)).catch(() => null);

// minta browser tidak menghapus data offline saat memori HP penuh
export function persist() { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} }

// ---------- ubin peta ----------
export const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const TILE_CACHE = 'hm-tiles';
// orthophoto drone: dua slot, 'utama' (seluruh area, ±3 bulanan) dan 'mingguan' (sebagian area, terbaru di atas)
export const SLOTS = [['utama', 'Ortho utama'], ['mingguan', 'Ortho mingguan']];
export let ORTHO = {};
export async function loadOrtho() {
  try { const r = await fetch('ortho/meta.json', { cache: 'no-cache' }); if (r.ok) { const m = await r.json(); ORTHO = m && !m.id ? m : {}; try { localStorage.setItem('hm-ortho', JSON.stringify(ORTHO)); } catch (e) {} return ORTHO; } } catch (e) {}
  try { ORTHO = JSON.parse(localStorage.getItem('hm-ortho') || '{}') || {}; } catch (e) { ORTHO = {}; }
  return ORTHO;
}
export const orthoKey = () => SLOTS.map(([k]) => ORTHO[k]?.id || '-').join('|');
export const orthoUrl = k => ORTHO[k] ? `ortho/${k}/${ORTHO[k].id}/{z}/{x}/{y}.${ORTHO[k].ext || 'webp'}` : null;
const tileXY = (lon, lat, z) => { const n = 2 ** z, r = lat * Math.PI / 180; return [Math.floor((lon + 180) / 360 * n), Math.floor((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * n)]; };
function bbox(g) {
  let a = 180, b = 90, c = -180, d = -90;
  const walk = x => { if (typeof x[0] === 'number') { a = Math.min(a, x[0]); c = Math.max(c, x[0]); b = Math.min(b, x[1]); d = Math.max(d, x[1]); } else x.forEach(walk); };
  if (g && g.coordinates) walk(g.coordinates); return [a, b, c, d];
}
export function tileList(S) {
  const buf = 0.0015; // ±150 m di sekitar batas blok
  const boxes = [...S.blok.map(b => [bbox(b.geom), 18]), ...S.bedengan.map(b => [bbox(b.geom), 19])];
  const set = new Set();
  for (const [[a, b, c, d], zmax] of boxes) {
    if (a > c) continue;
    for (let z = 12; z <= zmax; z++) {
      const [x0, y1] = tileXY(a - buf, b - buf, z), [x1, y0] = tileXY(c + buf, d + buf, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(`${z}/${y}/${x}`);
    }
  }
  const urls = [...set].map(k => SAT_URL.replace('{z}/{y}/{x}', k));
  // ortho: seluruh cakupan; bila terlalu banyak ubin, hanya area sekitar blok
  for (const [k] of SLOTS) {
    const o = ORTHO[k]; if (!o) continue;
    const [ow, os, oe, on] = o.bounds, oset = new Set();
    const add = (A, B, C, D) => { if (A >= C || B >= D) return; for (let z = o.minzoom; z <= o.maxzoom; z++) { const [x0, y1] = tileXY(A, B, z), [x1, y0] = tileXY(C, D, z); for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) oset.add(`${z}/${x}/${y}`); } };
    add(ow, os, oe, on);
    if (oset.size > 12000) { oset.clear(); for (const [[a, b, c, d]] of boxes) add(Math.max(a - buf, ow), Math.max(b - buf, os), Math.min(c + buf, oe), Math.min(d + buf, on)); }
    const base = new URL(orthoUrl(k), location.href).href;
    oset.forEach(t => urls.push(base.replace('{z}/{x}/{y}', t)));
  }
  return urls;
}
async function purgeOldOrtho(cache) {
  const keep = SLOTS.map(([k]) => ORTHO[k] ? `/ortho/${k}/${ORTHO[k].id}/` : null).filter(Boolean);
  const keys = await cache.keys();
  await Promise.all(keys.filter(r => r.url.includes('/ortho/') && !keep.some(x => r.url.includes(x))).map(r => cache.delete(r)));
}
let running = null;
export function tileJob() { return running; }
export async function downloadTiles(S, onProgress) {
  if (running) return running.promise;
  const urls = tileList(S); const st = { total: urls.length, done: 0, fail: 0 };
  running = st;
  st.promise = (async () => {
    const cache = await caches.open(TILE_CACHE);
    await purgeOldOrtho(cache);
    let i = 0;
    const worker = async () => {
      while (i < urls.length) {
        const u = urls[i++];
        try {
          if (!(await cache.match(u, { ignoreVary: true }))) {
            const r = await fetch(u, { mode: u.startsWith(location.origin) ? 'same-origin' : 'cors' });
            if (r.ok) await cache.put(u, r); else if (!(r.status === 404 && u.includes('/ortho/'))) st.fail++;
          }
        } catch (e) { st.fail++; if (!navigator.onLine) { i = urls.length; } }
        st.done++; onProgress && onProgress(st);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    const res = { total: st.total, done: st.done, fail: st.fail, at: new Date().toISOString(), ortho: orthoKey() };
    if (!st.fail) try { localStorage.setItem('hm-tiles', JSON.stringify(res)); } catch (e) {}
    running = null; return res;
  })();
  return st.promise;
}
export function tileInfo() { try { return JSON.parse(localStorage.getItem('hm-tiles') || 'null'); } catch (e) { return null; } }

// ---------- pasang aplikasi ----------
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
export const canInstall = () => !!installEvt;
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export async function promptInstall() { if (!installEvt) return false; installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null; return r.outcome === 'accepted'; }
