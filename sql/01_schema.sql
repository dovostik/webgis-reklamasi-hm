-- =====================================================================
-- Web GIS Reklamasi & Nursery PT Hamparan Mulya
-- 01_schema.sql : struktur database, aturan akses (RLS), fungsi bantu
-- Jalankan sekali di Supabase > SQL Editor, lalu 02_seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- profil & peran ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null default '',
  jabatan text not null default '',
  role text not null default 'viewer'
    check (role in ('admin','spv','owner','nursery','crew','exdas','bumdes','viewer')),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid() and aktif), 'none')
$$;

create or replace function public.has_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = any(roles)
$$;

-- vendor hanya melihat blok pekerjaannya
create or replace function public.can_see_layer(layer text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'exdas'  then layer = 'bastl'
    when 'bumdes' then layer = 'perawatan'
    when 'none'   then false
    else true end
$$;


-- profil baru otomatis saat admin membuat user di Authentication
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, nama, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nama', split_part(new.email,'@',1)),
          case when (select count(*) from public.profiles) = 0 then 'admin' else 'viewer' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- jam server: kolom waktu selalu diisi server, bukan HP
create or replace function public.set_server_time() returns trigger
language plpgsql as $$
declare c text;
begin
  foreach c in array TG_ARGV loop
    if TG_OP = 'INSERT' then
      new := jsonb_populate_record(new, jsonb_build_object(c, now()));
    end if;
  end loop;
  return new;
end $$;

-- nomor urut (tag QR, BA)
create table if not exists public.counter (name text primary key, val bigint not null default 0);
alter table public.counter enable row level security;
create or replace function public.next_number(p_name text, p_n int default 1) returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into public.counter(name, val) values (p_name, p_n)
  on conflict (name) do update set val = public.counter.val + p_n
  returning val into v;
  return v;
end $$;

-- ---------- master ----------
create table if not exists public.jenis (
  kode text primary key, nama text not null, latin text, kelompok text, tipe text,
  tersedia boolean, tergenang boolean, berpasir boolean, ob boolean,
  durasi_sapih int not null default 56, durasi_besar int not null default 14, durasi_bst int not null default 14
);
alter table public.jenis enable row level security;

create table if not exists public.blok (
  id text primary key,                         -- mis. P:HRP-10, B:CLR-1, S:13
  layer text not null check (layer in ('berhasil','perawatan','bastl')),
  nama text,                                   -- nama blok (HRP-27 dst.)
  kode_bastl text, no_bastl text, pit text,
  ha numeric not null,
  geom jsonb not null,                         -- GeoJSON (Polygon/MultiPolygon, lon/lat WGS84)
  bln_tanam text,                              -- dari shp lama (YYYY-MM)
  tgl_tanam date,                              -- tanggal closing BA retensi (input admin / sistem)
  tgl_rotasi_terakhir date,                    -- input manual admin untuk data lama
  tahun text,
  created_at timestamptz not null default now()
);
alter table public.blok enable row level security;

create or replace function public.can_see_blok(bid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.blok b where b.id = bid and public.can_see_layer(b.layer))
$$;

-- ---------- reklamasi: periode kerja ----------
create table if not exists public.periode (
  id uuid primary key default gen_random_uuid(),
  blok_id text not null references public.blok(id),
  tipe text not null check (tipe in ('cek1','retensi','rotasi')),
  nomor int not null default 1,
  vendor text not null check (vendor in ('exdas','bumdes')),
  status text not null default 'pelaksanaan'
    check (status in ('pelaksanaan','siap_inspeksi','inspeksi','sulam_gl','verifikasi','menunggu_persetujuan','selesai')),
  mulai_at timestamptz,
  vendor_selesai_at timestamptz,
  pct numeric,
  hasil jsonb,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.periode enable row level security;
create index if not exists periode_blok on public.periode(blok_id);

create table if not exists public.sesi (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.periode(id),
  blok_id text not null references public.blok(id),
  tipe text not null check (tipe in ('inspeksi','verifikasi')),
  oleh uuid references public.profiles(id),
  mulai_at timestamptz not null default now(),
  selesai_at timestamptz,
  track jsonb not null default '[]',           -- [[lon,lat,acc,epochMs],...]
  foto jsonb not null default '[]',            -- path storage foto kegiatan (4)
  pct numeric, hasil jsonb
);
alter table public.sesi enable row level security;

create table if not exists public.tag (
  id text primary key,                         -- HM-T-000001
  blok_id text not null references public.blok(id),
  periode_id uuid references public.periode(id),
  sumber text not null check (sumber in ('vendor','gl')),
  lon double precision, lat double precision, acc real, low_acc boolean not null default false,
  jalur text check (jalur in ('pioneer','sisipan')),
  kondisi text check (kondisi in ('pmk','tergenang','berpasir','ob')),
  status text not null default 'mati' check (status in ('mati','disulam','closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table public.tag enable row level security;
create index if not exists tag_blok on public.tag(blok_id);

create table if not exists public.tag_event (
  id bigserial primary key,
  tag_id text not null references public.tag(id),
  periode_id uuid references public.periode(id),
  sesi_id uuid references public.sesi(id),
  tipe text not null check (tipe in ('mati','sulam','hidup')),
  jenis text references public.jenis(kode),
  lon double precision, lat double precision, acc real,
  oleh uuid references public.profiles(id),
  client_at timestamptz,
  at timestamptz not null default now()
);
alter table public.tag_event enable row level security;
create index if not exists tag_event_tag on public.tag_event(tag_id);

-- ---------- nursery ----------
create table if not exists public.bedengan (
  kode text primary key, cluster text not null, tahap text not null,
  kapasitas int not null default 1300, status text not null default 'aktif', luas_m2 numeric,
  geom jsonb not null
);
alter table public.bedengan enable row level security;
create table if not exists public.nursery_fitur (
  id serial primary key, layer text not null check (layer in ('cluster','fasilitas','parit')),
  props jsonb not null default '{}', geom jsonb not null
);
alter table public.nursery_fitur enable row level security;
create table if not exists public.lot (
  id uuid primary key default gen_random_uuid(),
  bedengan text not null references public.bedengan(kode),
  jenis text not null references public.jenis(kode),
  jumlah int not null check (jumlah >= 0),
  tgl_sapih date not null, tgl_masuk date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.lot enable row level security;
create table if not exists public.lot_log (
  id bigserial primary key, lot_id uuid references public.lot(id),
  tipe text not null check (tipe in ('baru','mati','afkir','pindah_keluar','pindah_masuk','kirim','kembali','opname')),
  n int not null, ket text, oleh uuid references public.profiles(id), nama_pencatat text,
  at timestamptz not null default now()
);
alter table public.lot_log enable row level security;

-- ---------- permintaan, kiriman, penampungan ----------
create table if not exists public.minta (
  id uuid primary key default gen_random_uuid(),
  blok_id text not null references public.blok(id),
  tipe text not null check (tipe in ('tanam','sulam')),
  pio int not null default 0, sis int not null default 0,
  status text not null default 'terbuka' check (status in ('terbuka','selesai')),
  created_at timestamptz not null default now()
);
alter table public.minta enable row level security;
create table if not exists public.kirim (
  id uuid primary key default gen_random_uuid(),
  blok_id text not null references public.blok(id),
  minta_id uuid references public.minta(id),
  jenis text not null references public.jenis(kode),
  n int not null check (n > 0),
  lot_id uuid references public.lot(id), bedengan text,
  status text not null default 'dikirim' check (status in ('dikirim','diterima')),
  dikirim_oleh uuid references public.profiles(id), dikirim_at timestamptz not null default now(),
  diterima_oleh uuid references public.profiles(id), diterima_at timestamptz
);
alter table public.kirim enable row level security;
create table if not exists public.tampung_log (     -- pengurang stok penampungan selain sulam
  id bigserial primary key, blok_id text not null references public.blok(id),
  jenis text not null references public.jenis(kode),
  tipe text not null check (tipe in ('tanam','kembali','afkir')),
  n int not null check (n > 0), bedengan text, lot_id uuid,
  oleh uuid references public.profiles(id), at timestamptz not null default now()
);
alter table public.tampung_log enable row level security;

-- ---------- gudang ----------
create table if not exists public.barang (
  nama text primary key, kategori text, satuan text, minimum numeric, stok numeric
);
alter table public.barang enable row level security;
create table if not exists public.barang_tx (
  id bigserial primary key, barang text not null references public.barang(nama),
  tipe text not null check (tipe in ('masuk','keluar','opname')),
  n numeric not null, keperluan text, lokasi text, bukti text,
  oleh uuid references public.profiles(id), at timestamptz not null default now()
);
alter table public.barang_tx enable row level security;
create table if not exists public.alat (
  id serial primary key, nama text not null, kategori text, satuan text, stok numeric, ket text
);
alter table public.alat enable row level security;
create table if not exists public.pinjam (
  id uuid primary key default gen_random_uuid(),
  alat_id int not null references public.alat(id),
  peminjam text not null, ket text not null,
  oleh uuid references public.profiles(id), at timestamptz not null default now(),
  kembali_at timestamptz, kondisi text, kembali_oleh uuid references public.profiles(id)
);
alter table public.pinjam enable row level security;

-- ---------- berita acara ----------
create table if not exists public.ba (
  id uuid primary key default gen_random_uuid(),
  jenis text not null,                          -- PP / KP / KPR / SO
  unit text, nomor text not null,
  blok_id text references public.blok(id), periode_id uuid references public.periode(id),
  data jsonb not null default '{}',
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  scan_path text, scan_at timestamptz, confirmed_by uuid references public.profiles(id), confirmed_at timestamptz
);
alter table public.ba enable row level security;

-- ---------- jam server pada kolom waktu ----------
do $$
declare r record;
begin
  for r in select * from (values
    ('periode','created_at'),('sesi','mulai_at'),('tag','created_at'),('tag_event','at'),
    ('lot','created_at'),('lot_log','at'),('minta','created_at'),('kirim','dikirim_at'),
    ('tampung_log','at'),('barang_tx','at'),('pinjam','at'),('ba','created_at')) t(tbl,col)
  loop
    execute format('drop trigger if exists srv_time on public.%I', r.tbl);
    execute format('create trigger srv_time before insert on public.%I for each row execute function public.set_server_time(%L)', r.tbl, r.col);
  end loop;
end $$;

-- waktu pada update status juga diambil dari server
create or replace function public.stamp_updates() returns trigger language plpgsql as $$
begin
  if TG_TABLE_NAME = 'periode' then
    if new.status is distinct from old.status then
      if new.status = 'siap_inspeksi' then new.vendor_selesai_at := now(); end if;
      if new.status = 'selesai' then new.approved_at := now(); new.approved_by := auth.uid(); end if;
    end if;
    if new.mulai_at is distinct from old.mulai_at and new.mulai_at is not null then new.mulai_at := now(); end if;
  elsif TG_TABLE_NAME = 'sesi' then
    if new.selesai_at is not null and old.selesai_at is null then new.selesai_at := now(); end if;
  elsif TG_TABLE_NAME = 'kirim' then
    if new.status = 'diterima' and old.status <> 'diterima' then new.diterima_at := now(); new.diterima_oleh := auth.uid(); end if;
  elsif TG_TABLE_NAME = 'tag' then
    if new.status = 'closed' and old.status <> 'closed' then new.closed_at := now(); end if;
  elsif TG_TABLE_NAME = 'pinjam' then
    if new.kembali_at is not null and old.kembali_at is null then new.kembali_at := now(); new.kembali_oleh := auth.uid(); end if;
  elsif TG_TABLE_NAME = 'ba' then
    if new.scan_path is distinct from old.scan_path and new.scan_path is not null then new.scan_at := now(); end if;
    if new.confirmed_at is not null and old.confirmed_at is null then new.confirmed_at := now(); new.confirmed_by := auth.uid(); end if;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['periode','sesi','kirim','tag','pinjam','ba'] loop
    execute format('drop trigger if exists srv_upd on public.%I', t);
    execute format('create trigger srv_upd before update on public.%I for each row execute function public.stamp_updates()', t);
  end loop;
end $$;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','counter','jenis','blok','periode','sesi','tag','tag_event','bedengan','nursery_fitur',
    'lot','lot_log','minta','kirim','tampung_log','barang','barang_tx','alat','pinjam','ba'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- baca
drop policy if exists r on public.profiles;      create policy r on public.profiles      for select to authenticated using (true);
drop policy if exists r on public.jenis;         create policy r on public.jenis         for select to authenticated using (true);
drop policy if exists r on public.bedengan;      create policy r on public.bedengan      for select to authenticated using (true);
drop policy if exists r on public.nursery_fitur; create policy r on public.nursery_fitur for select to authenticated using (true);
drop policy if exists r on public.lot;           create policy r on public.lot           for select to authenticated using (true);
drop policy if exists r on public.lot_log;       create policy r on public.lot_log       for select to authenticated using (true);
drop policy if exists r on public.barang;        create policy r on public.barang        for select to authenticated using (public.my_role() <> 'none');
drop policy if exists r on public.barang_tx;     create policy r on public.barang_tx     for select to authenticated using (public.my_role() <> 'none');
drop policy if exists r on public.alat;          create policy r on public.alat          for select to authenticated using (public.my_role() <> 'none');
drop policy if exists r on public.pinjam;        create policy r on public.pinjam        for select to authenticated using (public.my_role() <> 'none');
drop policy if exists r on public.blok;          create policy r on public.blok          for select to authenticated using (public.can_see_layer(layer));
drop policy if exists r on public.periode;       create policy r on public.periode       for select to authenticated using (public.can_see_blok(blok_id));
drop policy if exists r on public.sesi;          create policy r on public.sesi          for select to authenticated using (public.can_see_blok(blok_id));
drop policy if exists r on public.tag;           create policy r on public.tag           for select to authenticated using (public.can_see_blok(blok_id));
drop policy if exists r on public.tag_event;     create policy r on public.tag_event     for select to authenticated using (exists(select 1 from public.tag g where g.id = tag_id and public.can_see_blok(g.blok_id)));
drop policy if exists r on public.minta;         create policy r on public.minta         for select to authenticated using (public.can_see_blok(blok_id));
drop policy if exists r on public.kirim;         create policy r on public.kirim         for select to authenticated using (public.can_see_blok(blok_id));
drop policy if exists r on public.tampung_log;   create policy r on public.tampung_log   for select to authenticated using (public.can_see_blok(blok_id));
drop policy if exists r on public.ba;            create policy r on public.ba            for select to authenticated using (blok_id is null and public.my_role() <> 'none' or public.can_see_blok(blok_id));

-- tulis
drop policy if exists w on public.profiles;  create policy w on public.profiles  for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists w on public.jenis;     create policy w on public.jenis     for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists w on public.blok;      create policy w on public.blok      for update to authenticated using (public.has_role('admin','exdas','bumdes','owner')) with check (public.has_role('admin') or public.can_see_layer(layer));
drop policy if exists wi on public.periode;  create policy wi on public.periode  for insert to authenticated with check (public.has_role('admin','owner','exdas','bumdes') and public.can_see_blok(blok_id));
drop policy if exists wu on public.periode;  create policy wu on public.periode  for update to authenticated using (public.has_role('admin','owner','exdas','bumdes') and public.can_see_blok(blok_id));
drop policy if exists w on public.sesi;      create policy w on public.sesi      for all to authenticated using (public.has_role('admin','owner')) with check (public.has_role('admin','owner'));
drop policy if exists wi on public.tag;      create policy wi on public.tag      for insert to authenticated with check (public.has_role('admin','owner','exdas','bumdes') and public.can_see_blok(blok_id));
drop policy if exists wu on public.tag;      create policy wu on public.tag      for update to authenticated using (public.has_role('admin','owner','exdas','bumdes') and public.can_see_blok(blok_id));
drop policy if exists w on public.tag_event; create policy w on public.tag_event for insert to authenticated with check (public.has_role('admin','owner','exdas','bumdes') and oleh = auth.uid());
drop policy if exists w on public.bedengan;  create policy w on public.bedengan  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists w on public.nursery_fitur; create policy w on public.nursery_fitur for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
drop policy if exists w on public.lot;       create policy w on public.lot       for all to authenticated using (public.has_role('admin','nursery','crew')) with check (public.has_role('admin','nursery','crew'));
drop policy if exists w on public.lot_log;   create policy w on public.lot_log   for insert to authenticated with check (public.has_role('admin','nursery','crew'));
drop policy if exists w on public.minta;     create policy w on public.minta     for all to authenticated using (public.has_role('admin','owner','nursery','exdas','bumdes')) with check (public.has_role('admin','owner','nursery','exdas','bumdes'));
drop policy if exists wi on public.kirim;    create policy wi on public.kirim    for insert to authenticated with check (public.has_role('admin','nursery'));
drop policy if exists wu on public.kirim;    create policy wu on public.kirim    for update to authenticated using (public.has_role('admin','owner','exdas','bumdes','nursery') and public.can_see_blok(blok_id));
drop policy if exists w on public.tampung_log; create policy w on public.tampung_log for insert to authenticated with check (public.has_role('admin','owner','nursery','exdas','bumdes'));
drop policy if exists w on public.barang;    create policy w on public.barang    for update to authenticated using (public.has_role('admin','nursery','crew'));
drop policy if exists w on public.barang_tx; create policy w on public.barang_tx for insert to authenticated with check (public.has_role('admin','nursery','crew'));
drop policy if exists w on public.alat;      create policy w on public.alat      for update to authenticated using (public.has_role('admin','nursery'));
drop policy if exists wi on public.pinjam;   create policy wi on public.pinjam   for insert to authenticated with check (public.my_role() <> 'none' and oleh = auth.uid());
drop policy if exists wu on public.pinjam;   create policy wu on public.pinjam   for update to authenticated using (public.my_role() <> 'none');
drop policy if exists wi on public.ba;       create policy wi on public.ba       for insert to authenticated with check (public.has_role('admin','owner','nursery'));
drop policy if exists wu on public.ba;       create policy wu on public.ba       for update to authenticated using (public.has_role('admin','owner','nursery'));

grant execute on function public.next_number(text,int) to authenticated;

-- ---------- penyimpanan foto & scan ----------
insert into storage.buckets (id, name, public) values ('foto','foto',false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('scan','scan',false) on conflict (id) do nothing;
drop policy if exists foto_r on storage.objects; create policy foto_r on storage.objects for select to authenticated using (bucket_id in ('foto','scan'));
drop policy if exists foto_w on storage.objects; create policy foto_w on storage.objects for insert to authenticated with check (bucket_id in ('foto','scan') and public.my_role() <> 'none');
drop policy if exists foto_d on storage.objects; create policy foto_d on storage.objects for delete to authenticated using (bucket_id = 'foto' and public.has_role('admin'));
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.can_see_blok(text), public.can_see_layer(text), public.has_role(text[]), public.my_role(), public.next_number(text,int), public.handle_new_user() from anon, public;
revoke execute on function public.handle_new_user() from authenticated;
alter function public.stamp_updates() set search_path = public;
alter function public.set_server_time() set search_path = public;
-- SPV Reklamasi: beri nama BASTL, tanggal blok lama, unggah/konfirmasi scan BA
create policy spv_blok_u on public.blok for update to authenticated using (public.has_role('spv')) with check (public.has_role('spv'));
create policy spv_periode_i on public.periode for insert to authenticated with check (public.has_role('spv'));
create policy spv_minta on public.minta for insert to authenticated with check (public.has_role('spv'));
create policy spv_ba_u on public.ba for update to authenticated using (public.has_role('spv'));
create policy spv_sesi_u on public.sesi for update to authenticated using (public.has_role('spv'));
create policy spv_foto_d on storage.objects for delete to authenticated using (bucket_id = 'foto' and public.has_role('spv'));
-- pengaturan bersama (simulasi tanggal uji coba)
create table if not exists public.setting (k text primary key, v jsonb not null default '0', updated_by uuid references public.profiles(id), updated_at timestamptz not null default now());
alter table public.setting enable row level security;
create policy setting_r on public.setting for select to authenticated using (public.my_role() <> 'none');
create policy setting_u on public.setting for update to authenticated using (public.has_role('admin','spv')) with check (public.has_role('admin','spv'));
grant select, update on public.setting to authenticated;
insert into public.setting (k, v) values ('sim_days', '0') on conflict (k) do nothing;
