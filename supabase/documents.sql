-- Bóveda de documentos: bucket privado + tabla de metadatos.
-- Aplícalo UNA vez en Supabase → SQL Editor.
-- Privacidad: bucket privado + RLS → cada usuario solo ve/descarga sus archivos.

-- 1) Bucket privado para los archivos
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 2) Reglas de acceso a los archivos: cada quien solo su carpeta (userId/...)
drop policy if exists "own files read"   on storage.objects;
drop policy if exists "own files insert" on storage.objects;
drop policy if exists "own files delete" on storage.objects;

create policy "own files read" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Tabla de metadatos (nombre, categoría, ruta, tamaño)
create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  category   text default 'other',   -- tax | receipt | insurance | id | other
  path       text not null,          -- ruta dentro del bucket 'documents'
  size       bigint,
  mime       text,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
