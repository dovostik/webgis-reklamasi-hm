// Service worker: simpan kerangka aplikasi agar bisa dibuka tanpa sinyal.
const V = 'hm-v9';
const CORE = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/core.js', 'js/sb.js', 'js/logic.js', 'js/field.js', 'js/nursery.js', 'js/ba.js',
  'lib/leaflet/leaflet.js', 'lib/leaflet/leaflet.css', 'lib/jsQR.js', 'lib/qrcode.min.js',
  'img/logo.svg', 'img/mark.svg', 'img/icon-192.png', 'img/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'hm-tiles').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // data Supabase selalu dari jaringan (aplikasi punya antrean offline sendiri)
  if (/supabase\.co$/.test(u.hostname)) return;
  // ubin peta: cache-first, simpan untuk dipakai di lapangan tanpa sinyal
  if (/arcgisonline|tile\.openstreetmap/.test(u.hostname)) {
    e.respondWith(caches.open('hm-tiles').then(async c => { const hit = await c.match(e.request); if (hit) return hit; try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; } catch (err) { return new Response('', { status: 504 }); } }));
    return;
  }
  if (u.origin === location.origin) {
    // network-first untuk file aplikasi agar pembaruan cepat sampai, fallback cache
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) caches.open(V).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  }
});
