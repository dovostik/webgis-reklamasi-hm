/* Penyimpanan lokal (IndexedDB) dengan antarmuka yang sama seperti versi online */
(function(){
  const open=()=>new Promise((ok,no)=>{const r=indexedDB.open('dtm-kontur-3d',1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('docs');r.result.createObjectStore('blobs')};
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const dbp=open();
  const tx=async(store,mode,fn)=>{const d=await dbp;return new Promise((ok,no)=>{const t=d.transaction(store,mode),s=t.objectStore(store);let out;const q=fn(s);if(q)q.onsuccess=()=>out=q.result;t.oncomplete=()=>ok(out);t.onerror=()=>no(t.error)})};
  const allDocs=async()=>{const d=await dbp;return new Promise((ok,no)=>{const out=[],r=d.transaction('docs').objectStore('docs').openCursor();r.onsuccess=()=>{const c=r.result;if(c){out.push([c.key,c.value]);c.continue()}else ok(out)};r.onerror=()=>no(r.error)})};
  const subs=new Set();const fire=p=>subs.forEach(o=>{if(o.k===p||p.startsWith(o.k+'/'))o.f()});
  const snap=(id,v)=>({id,exists:v!==undefined,data:()=>v});
  const db={
    doc:p=>({
      set:async v=>{await tx('docs','readwrite',s=>s.put(JSON.parse(JSON.stringify(v)),p));fire(p)},
      update:async v=>{const o=await tx('docs','readonly',s=>s.get(p));await tx('docs','readwrite',s=>s.put({...o,...v},p));fire(p)},
      delete:async()=>{await tx('docs','readwrite',s=>s.delete(p));fire(p)},
      get:async()=>snap(p.split('/').pop(),await tx('docs','readonly',s=>s.get(p))),
      onSnapshot:next=>{const f=async()=>next(snap(p.split('/').pop(),await tx('docs','readonly',s=>s.get(p))));const o={k:p,f};subs.add(o);f();return()=>subs.delete(o)}
    }),
    collection:c=>{const q={onSnapshot:next=>{const f=async()=>{const all=(await allDocs()).filter(([k])=>k.startsWith(c+'/')&&k.split('/').length===2).map(([k,v])=>snap(k.split('/')[1],v));next({docs:all,size:all.length,empty:!all.length})};const o={k:c,f};subs.add(o);ready.then(f);return()=>subs.delete(o)}};q.orderBy=()=>q;return q}
  };
  let n=0;
  const assets={
    upload:async(b,o)=>{const id=(Date.now().toString(36)+(n++).toString(36)+Math.random().toString(36).slice(2)).padEnd(32,'0').slice(0,32);await tx('blobs','readwrite',s=>s.put(new Blob([b],{type:(o&&o.type)||b.type}),id));return{id,url:'/_blob/'+id,sizeBytes:b.size,contentType:b.type}},
    delete:async id=>{await tx('blobs','readwrite',s=>s.delete(id));return{deleted:true}},
    list:async()=>({assets:[],usage:{}})
  };
  const of=window.fetch.bind(window);
  window.fetch=async(u,o)=>{const s=String(u);if(s.startsWith('/_blob/')){const b=await tx('blobs','readonly',st=>st.get(s.slice(7)));return b?new Response(b):new Response('',{status:404})}return of(u,o)};
  /* Minta penyimpanan permanen agar data survei tidak dibersihkan otomatis oleh browser */
  const ready=(async()=>{try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist()}catch(_){}})();
  window.claude={use:async name=>name==='db'?db:name==='assets'?assets:null};
})();
