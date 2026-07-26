-- Per-account labeling. A single bank login (e.g. Chase) can hold both a
-- Personal and an Oprinte account, so each account carries its own tag and
-- each imported transaction remembers which account it came from.

alter table public.txns add column if not exists plaid_account text;

create table if not exists public.plaid_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  name text,
  mask text,
  label text not null default 'personal',
  created_at timestamptz default now(),
  unique (user_id, account_id)
);

alter table public.plaid_accounts enable row level security;

drop policy if exists "own plaid_accounts" on public.plaid_accounts;
create policy "own plaid_accounts" on public.plaid_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
