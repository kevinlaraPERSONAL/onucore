-- Google Calendar connection: stores each user's OAuth tokens.
-- Apply this in the Supabase SQL Editor (one time).
--
-- Security: RLS so a user only ever touches their own row. Our app NEVER
-- reads these tokens from the browser — only the server routes (/api/google/*)
-- do, using the user's session. (Hardening option for later: move tokens to a
-- table only the service_role can read, so they're never reachable client-side.)

create table if not exists public.google_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  access_token  text not null,
  refresh_token text,
  expiry        timestamptz not null,
  scope         text,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.google_tokens enable row level security;

drop policy if exists "own google_tokens select" on public.google_tokens;
drop policy if exists "own google_tokens insert" on public.google_tokens;
drop policy if exists "own google_tokens update" on public.google_tokens;
drop policy if exists "own google_tokens delete" on public.google_tokens;

create policy "own google_tokens select" on public.google_tokens
  for select using (auth.uid() = user_id);
create policy "own google_tokens insert" on public.google_tokens
  for insert with check (auth.uid() = user_id);
create policy "own google_tokens update" on public.google_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own google_tokens delete" on public.google_tokens
  for delete using (auth.uid() = user_id);
