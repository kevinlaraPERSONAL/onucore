-- ATLAS AI — Esquema de Supabase
-- Pégalo en el SQL Editor de Supabase.
-- Privacidad por diseño: NUNCA se guardan números de tarjeta, credenciales ni números de cuenta bancaria.

-- 1) PERFILES (una fila por usuario, creada automáticamente al registrarse)
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text default '',
  nickname        text default '',
  role            text default '',
  photo_url       text,
  tone            text default 'casual',          -- 'casual' | 'formal'
  birthday        date,
  whatsapp        text,                            -- E.164; enruta las capturas de WhatsApp
  city            text default '',
  tz              text default '',
  dietary         text default '',
  about           text default '',                 -- texto libre que lee la IA
  hobbies         jsonb default '[]'::jsonb,
  people          jsonb default '[]'::jsonb,        -- [{name, rel}]
  goals           jsonb default '[]'::jsonb,
  wake            text default '7:00 AM',
  work_hours      text default '9-6',
  briefing_time   text default '8:00 AM',
  notif           boolean default true,
  brief_len       text default 'short',            -- 'short' | 'detailed'
  reminder_style  text default 'gentle',
  notify_channel  text default 'push',
  quiet           text default '',
  default_account text default 'card',             -- solo etiqueta, jamás un número
  set_aside_pct   integer default 30,
  conns           jsonb default '{}'::jsonb,         -- {gcal, apple, gmail, contacts, whatsapp}
  lang            text default 'es',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 2) ITEMS (citas, tareas, recordatorios, pagos, notas, ideas, contactos)
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                         -- event|task|reminder|obligation|note|idea|contact
  area       text default 'personal',               -- work|family|personal|health
  title      text not null,
  detail     text default '',
  amount     numeric,                                -- para pagos (obligation)
  date_iso   date,
  date_label text default '',
  person     text default '',
  priority   text default 'medium',
  done       boolean default false,
  photo_url  text,
  source     text default 'app',                     -- app|whatsapp|gcal|apple
  created_at timestamptz default now()
);
create index if not exists items_user_idx on public.items(user_id, date_iso);

-- 3) TXNS (dinero: ingresos y gastos)
create table if not exists public.txns (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,                          -- income|expense
  amount     numeric not null,
  cat        text not null,                          -- clave de categoría
  account    text default '',                        -- SOLO etiqueta de método de pago (nunca un número)
  date_iso   date not null default current_date,
  note       text default '',
  ded        boolean default false,                  -- deducible
  source     text default 'app',
  created_at timestamptz default now()
);
create index if not exists txns_user_idx on public.txns(user_id, date_iso);

-- 4) WA_LINKS (mapea un número de WhatsApp a un usuario)
create table if not exists public.wa_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  phone      text unique not null,                   -- E.164
  verified   boolean default false,
  created_at timestamptz default now()
);

-- 5) Row Level Security: cada usuario solo ve y edita sus propios datos
alter table public.profiles enable row level security;
alter table public.items    enable row level security;
alter table public.txns     enable row level security;
alter table public.wa_links enable row level security;

create policy "own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "own items" on public.items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own txns" on public.txns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own wa" on public.wa_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6) Crear el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7) Mantener updated_at al día en profiles
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
