// Unggah orthophoto drone langsung dari aplikasi (khusus admin).
// File GeoTIFF dipecah ±25 MB, dikirim sebagai blob Git ke cabang sementara "ortho-upload-<slot>-<waktu>".
// GitHub Actions menyambung potongan, memotong jadi ubin, mengganti ortho lama di slot itu, lalu menghapus cabang.
const REPO = 'dovostik/webgis-reklamasi-hm', API = 'https://api.github.com/repos/' + REPO;
const PART = 16 * 1024 * 1024;
export const tokenGet = () => { try { return localStorage.getItem('hm-gh-token') || ''; } catch (e) { return ''; } };
export const tokenSet = v => { try { v ? localStorage.setItem('hm-gh-token', v) : localStorage.removeItem('hm-gh-token'); } catch (e) {} };
export const lastJob = () => { try { return JSON.parse(localStorage.getItem('hm-ortho-job') || 'null'); } catch (e) { return null; } };
const saveJob = j => { try { localStorage.setItem('hm-ortho-job', JSON.stringify(j)); } catch (e) {} };

async function gh(path, opt = {}, token = tokenGet()) {
  for (let i = 0; ; i++) {
    let r;
    try {
      r = await fetch(path.startsWith('http') ? path : API + path, { ...opt, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(opt.body ? { 'Content-Type': 'application/json' } : {}) } });
    } catch (e) { if (i < 3) { await new Promise(ok => setTimeout(ok, 3000 * (i + 1))); continue; } throw new Error('Koneksi terputus. Coba lagi, potongan yang sudah terkirim tidak diulang.'); }
    if (r.ok) return r.status === 204 ? null : r.json();
    if (r.status >= 500 && i < 3) { await new Promise(ok => setTimeout(ok, 3000 * (i + 1))); continue; }
    const t = await r.text().catch(() => '');
    if (r.status === 401) throw new Error('Token GitHub salah atau kedaluwarsa.');
    if (r.status === 403 || r.status === 404) throw new Error('Token tidak punya izin ke repo ' + REPO + ' (butuh Contents: Read and write, Actions: Read).');
    throw new Error(`GitHub ${r.status}: ${t.slice(0, 160)}`);
  }
}
export async function checkToken(token) {
  const r = await gh('', {}, token);
  if (!r.permissions || !r.permissions.push) throw new Error('Token hanya bisa membaca. Beri izin Contents: Read and write.');
  return true;
}
// kirim potongan dengan kemajuan per byte (fetch tidak memberi kemajuan unggah)
function postBlob(content, onUp, token = tokenGet()) {
  return new Promise((ok, no) => {
    const x = new XMLHttpRequest(); x.open('POST', API + '/git/blobs');
    x.setRequestHeader('Accept', 'application/vnd.github+json'); x.setRequestHeader('Authorization', 'Bearer ' + token); x.setRequestHeader('X-GitHub-Api-Version', '2022-11-28'); x.setRequestHeader('Content-Type', 'application/json');
    x.upload.onprogress = e => onUp && e.lengthComputable && onUp(e.loaded, e.total);
    x.onload = () => { if (x.status >= 200 && x.status < 300) ok(JSON.parse(x.responseText)); else no(Object.assign(new Error(x.status === 401 ? 'Token GitHub salah atau kedaluwarsa.' : `GitHub ${x.status}: ${String(x.responseText).slice(0, 160)}`), { status: x.status })); };
    x.onerror = () => no(Object.assign(new Error('Koneksi terputus.'), { net: true })); x.ontimeout = x.onerror; x.timeout = 30 * 60 * 1000;
    x.send(JSON.stringify({ content, encoding: 'base64' }));
  });
}
const b64 = blob => new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1] || ''); f.onerror = () => no(f.error); f.readAsDataURL(blob); });

// action: 'ganti' (unggah file) atau 'hapus' (kosongkan slot)
export async function uploadOrtho({ file, slot, tanggal, action = 'ganti' }, onProg) {
  const key = file ? `hm-up:${slot}:${file.name}:${file.size}:${file.lastModified}` : null;
  let done = {}; try { done = key ? JSON.parse(localStorage.getItem(key) || '{}') : {}; } catch (e) {}
  const n = file ? Math.ceil(file.size / PART) : 0, tree = [];
  for (let i = 0; i < n; i++) {
    const name = `upload/part-${String(i).padStart(3, '0')}`;
    if (!done[i]) {
      onProg && onProg({ i, n, frac: i / n, msg: `Menyiapkan potongan ${i + 1} dari ${n}` });
      const content = await b64(file.slice(i * PART, Math.min(file.size, (i + 1) * PART)));
      let r, t0 = Date.now();
      for (let a = 0; ; a++) {
        try { r = await postBlob(content, (l, tot) => { const sp = l / Math.max(1, (Date.now() - t0) / 1000); const fr = (i + l / tot) / n; const left = (n - i - l / tot) * tot / Math.max(1, sp); onProg && onProg({ i, n, frac: fr, msg: `Mengirim potongan ${i + 1} dari ${n} · ${(sp * 8 / 1e6).toFixed(1)} Mbps · sisa ±${left > 3600 ? (left / 3600).toFixed(1) + ' jam' : Math.ceil(left / 60) + ' menit'}` }); }); break; }
        catch (e) { if ((e.net || e.status >= 500) && a < 3) { onProg && onProg({ i, n, frac: i / n, msg: `Koneksi terputus, mencoba lagi potongan ${i + 1}…` }); await new Promise(ok => setTimeout(ok, 5000 * (a + 1))); t0 = Date.now(); continue; } throw e.net ? new Error('Koneksi terputus. Ketuk Unggah lagi; potongan yang sudah terkirim tidak diulang.') : e; }
      }
      done[i] = r.sha; try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) {}
    }
    tree.push({ path: name, mode: '100644', type: 'blob', sha: done[i] });
  }
  onProg && onProg({ i: n, n, msg: 'Menyiapkan pemrosesan…' });
  const info = { slot, tanggal, action, nama: file ? file.name : null, ukuran: file ? file.size : 0, potongan: n, dikirim: new Date().toISOString() };
  tree.push({ path: 'upload/info.json', mode: '100644', type: 'blob', content: JSON.stringify(info, null, 1) });
  // berbasis main agar cabang membawa berkas workflow (Actions hanya jalan bila workflow ada di commit itu)
  const head = await gh('/git/ref/heads/main'), base = await gh('/git/commits/' + head.object.sha);
  const t = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
  const c = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: `Ortho ${slot} ${tanggal || ''} (${action})`, tree: t.sha, parents: [head.object.sha] }) });
  const branch = `ortho-upload-${slot}-${Date.now()}`;
  await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: c.sha }) });
  if (key) try { localStorage.removeItem(key); } catch (e) {}
  const job = { branch, slot, tanggal, action, at: new Date().toISOString() }; saveJob(job);
  return job;
}

// status proses di GitHub Actions untuk unggahan terakhir
export async function jobStatus(job = lastJob()) {
  if (!job || !tokenGet()) return null;
  const r = await gh(`/actions/runs?branch=${encodeURIComponent(job.branch)}&per_page=5`);
  const run = (r.workflow_runs || [])[0];
  if (!run) return { tahap: 'antre', teks: 'Menunggu GitHub memulai proses…' };
  if (run.status !== 'completed') return { tahap: 'proses', teks: `Sedang diproses (${run.status === 'queued' ? 'antre' : 'memotong ubin'}), mulai ${new Date(run.run_started_at || run.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`, url: run.html_url };
  if (run.conclusion === 'success') return { tahap: 'selesai', teks: 'Selesai. Ortho baru tampil di peta semua akun setelah aplikasi dibuka ulang.', url: run.html_url };
  return { tahap: 'gagal', teks: `Proses gagal (${run.conclusion}). Periksa file GeoTIFF lalu unggah ulang.`, url: run.html_url };
}
