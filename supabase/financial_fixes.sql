-- Millaje de negocio por transacción (para la bitácora del carro y el export).
alter table public.txns add column if not exists miles numeric;
