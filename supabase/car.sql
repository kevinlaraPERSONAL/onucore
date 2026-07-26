-- "Mi Carro": perfil del vehículo + registros de mantenimiento/recordatorios.

create table if not exists public.vehicles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  make text,
  model text,
  year int,
  plate text,
  vin text,
  color text,
  mileage int,
  insurance_company text,
  insurance_policy text,
  insurance_expiry date,
  created_at timestamptz default now()
);
alter table public.vehicles enable row level security;
drop policy if exists "own vehicles" on public.vehicles;
create policy "own vehicles" on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.car_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text,
  date_iso date,
  due_iso date,
  mileage int,
  due_mileage int,
  cost numeric,
  note text,
  created_at timestamptz default now()
);
alter table public.car_records enable row level security;
drop policy if exists "own car_records" on public.car_records;
create policy "own car_records" on public.car_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
