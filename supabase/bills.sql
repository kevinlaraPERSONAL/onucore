-- Biles recurrentes: al marcar pagado, la fecha avanza al mes siguiente.
alter table public.items add column if not exists repeat text;
