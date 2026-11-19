const V='dtm-kontur-3d-v1';
const CORE=['./','index.html','store.js','manifest.webmanifest','lib/delaunator.min.js','icons/icon-192.png','icons/icon-512.png'];
const EXTRA=['https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@500;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap'];
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const c=await caches.open(V);await c.addAll(CORE);
  await Promise.all(EXTRA.map(u=>fetch(u,{mode:'cors'}).then(r=>r.ok&&c.put(u,r)).catch(()=>{})));
  self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==V)await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url),same=u.origin===location.origin;
  if(same&&r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{caches.open(V).then(c=>c.put('index.html',res.clone()));return res}).catch(()=>caches.match('index.html')));return;
  }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{
    if(res.ok&&(same||/jsdelivr|cdnjs|fonts\.(googleapis|gstatic)/.test(u.host))){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}
    return res;
  })));
});
