-- HMI UNPI CMS: Supabase database + storage
-- Jalankan SEKALI di Supabase > SQL Editor.
create table if not exists public.app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
-- Aplikasi menggunakan SERVICE ROLE dari server. Tidak perlu policy public.

insert into public.app_state(key, value) values
('applicants','[]'::jsonb),
('kader','[]'::jsonb),
('rejected','[]'::jsonb),
('media','[]'::jsonb),
('cms','{"site":{},"berita":[],"galeri":[],"agenda":[],"tentang":{},"struktur":[],"pages":{}}'::jsonb)
on conflict (key) do nothing;

-- Storage bucket harus bernama persis: kader-poto
-- Jadikan bucket PUBLIC dari Dashboard Storage, atau gunakan SQL berikut bila tersedia pada project:
-- insert into storage.buckets (id, name, public) values ('kader-poto','kader-poto',true)
-- on conflict (id) do update set public=true;
