-- Bandeja de sugerencias de la IA (gastos ambiguos, follow-ups, etc.).
-- dedupe_key evita mostrar la misma sugerencia dos veces (ej. mismo txn).
create table if not exists public.ai_nudges (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  text text not null,
  action jsonb,
  dedupe_key text not null,
  status text not null default 'pending',
  created_at timestamptz default now(),
  unique (user_id, dedupe_key)
);
alter table public.ai_nudges enable row level security;
drop policy if exists "own ai_nudges" on public.ai_nudges;
create policy "own ai_nudges" on public.ai_nudges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
