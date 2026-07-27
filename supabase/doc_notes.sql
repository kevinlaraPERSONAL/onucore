-- Texto/nota por documento o foto de la Bóveda.
alter table public.documents add column if not exists note text;
