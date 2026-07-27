-- Cofre de contraseñas CIFRADO.
-- El servidor NUNCA ve las contraseñas: solo guarda texto cifrado (AES-GCM)
-- que se descifra en el dispositivo del usuario con su clave maestra.

-- Configuración del cofre: sales públicas + la llave del cofre envuelta dos
-- veces (con la clave maestra y con el código de recuperación).
create table if not exists public.vault_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  salt text not null,
  verifier text not null,
  wrapped_key text not null,
  recovery_salt text,
  recovery_wrapped_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.vault_meta enable row level security;
drop policy if exists "own vault_meta" on public.vault_meta;
create policy "own vault_meta" on public.vault_meta
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cada entrada guarda TODO cifrado en `blob` (título, link, usuario,
-- contraseña, notas). Ni el título viaja en claro.
create table if not exists public.secrets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  blob text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.secrets enable row level security;
drop policy if exists "own secrets" on public.secrets;
create policy "own secrets" on public.secrets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
