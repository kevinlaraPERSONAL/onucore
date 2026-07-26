-- Tax forms the user receives (W-2, 1099-NEC, 1099-MISC, 1099-K, other).
-- A reference list for the accountant: amount + federal tax withheld per form.
create table if not exists public.tax_forms (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  kind text not null,
  payer text,
  amount numeric not null default 0,
  withheld numeric not null default 0,
  created_at timestamptz default now()
);

alter table public.tax_forms enable row level security;

drop policy if exists "own tax_forms" on public.tax_forms;
create policy "own tax_forms" on public.tax_forms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
