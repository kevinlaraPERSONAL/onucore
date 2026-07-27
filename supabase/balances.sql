-- Saldo actual de cada cuenta Plaid (para alertas de saldo bajo).
alter table public.plaid_accounts add column if not exists balance_available numeric;
alter table public.plaid_accounts add column if not exists balance_current numeric;
alter table public.plaid_accounts add column if not exists balance_updated_at timestamptz;
