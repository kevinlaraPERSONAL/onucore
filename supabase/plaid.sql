-- Plaid (conectar banco): guarda el token de acceso + evita duplicar transacciones.
-- Aplícalo UNA vez en Supabase → SQL Editor.

create table if not exists public.plaid_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  access_token text not null,
  item_id      text,
  institution  text,
  created_at   timestamptz not null default now()
);
alter table public.plaid_items enable row level security;
drop policy if exists "own plaid_items" on public.plaid_items;
create policy "own plaid_items" on public.plaid_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- para no importar dos veces la misma transacción
alter table public.txns add column if not exists plaid_id text;
create unique index if not exists txns_plaid_id_uq on public.txns (plaid_id) where plaid_id is not null;
