-- Suscripciones de push (avisos al teléfono con la app cerrada).
create table if not exists public.push_subs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "own push_subs" on public.push_subs;
create policy "own push_subs" on public.push_subs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
