-- ============================================================
-- Apollo Africa — Energy Proposal Engine
-- Supabase Schema  (run in Supabase SQL Editor)
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists proposals (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz default now(),
  slug                  text unique not null,         -- URL path e.g. "steyn-city"

  -- Client identity
  client_name           text not null,
  client_logo_url       text,
  contract_date         date,
  supply_window_closes  date,

  -- Technical overview
  contract_mwh          numeric not null,             -- MWh/yr contracted supply
  customer_load_mwh     numeric not null default 0,
  green_coverage_pct    numeric not null default 70,
  carbon_savings        numeric generated always as (contract_mwh * 0.94) stored,

  -- Monthly profiles (JSON objects with keys jan..dec)
  monthly_supply        jsonb not null default '{}',
  monthly_load          jsonb not null default '{}',

  -- TOU weighted average tariffs [R/kWh]
  tariff_5yr            numeric not null,
  tariff_10yr           numeric not null,
  tariff_15yr           numeric not null,
  eskom_tariff          numeric not null default 1.49,

  -- Cumulative savings [Mill ZAR]
  savings_5yr           numeric not null,
  savings_10yr          numeric not null,
  savings_15yr          numeric not null,

  -- Commercial terms
  forex_exposure_pct    numeric not null default 55,
  volume_guarantee_pct  numeric not null default 70,

  -- Buyer credit support [ZAR mill]
  credit_support_5yr    numeric not null default 5.3,
  credit_support_10yr   numeric not null default 5.3,
  credit_support_15yr   numeric not null default 5,

  -- Escalation rates
  escalation_cpi        numeric not null default 4.5,
  eskom_escalation      numeric not null default 6.0,

  -- Sales contact
  salesperson_name      text,
  salesperson_email     text,
  salesperson_phone     text
);

-- Row-level security: anyone can read, only authed users can insert/update
alter table proposals enable row level security;

create policy "Public read proposals"
  on proposals for select
  using (true);

create policy "Auth insert proposals"
  on proposals for insert
  to authenticated
  with check (true);

create policy "Auth update proposals"
  on proposals for update
  to authenticated
  using (true);

-- Index for fast slug lookups
create index on proposals (slug);

-- ============================================================
-- Seed: Steyn City Properties (from PDF)
-- ============================================================
insert into proposals (
  slug, client_name, contract_date, supply_window_closes,
  contract_mwh, customer_load_mwh, green_coverage_pct,
  monthly_supply, monthly_load,
  tariff_5yr, tariff_10yr, tariff_15yr, eskom_tariff,
  savings_5yr, savings_10yr, savings_15yr,
  forex_exposure_pct, volume_guarantee_pct,
  credit_support_5yr, credit_support_10yr, credit_support_15yr,
  escalation_cpi, eskom_escalation,
  salesperson_name, salesperson_email
) values (
  'steyn-city',
  'Steyn City Properties',
  '2026-03-13',
  '2026-03-31',
  14840,
  21208,
  70,
  '{"jan":1282,"feb":1031,"mar":1117,"apr":519,"may":1218,"jun":1489,"jul":1626,"aug":1431,"sep":1290,"oct":1345,"nov":1304,"dec":1189}',
  '{"jan":1700,"feb":1600,"mar":1650,"apr":1500,"may":1750,"jun":1900,"jul":2200,"aug":2100,"sep":1800,"oct":1700,"nov":1600,"dec":1450}',
  1.43, 1.41, 1.34,
  1.49,
  26, 81, 189,
  55, 70,
  5.3, 5.3, 5.0,
  4.5, 6.0,
  'Apollo Sales Team',
  'sales@apolloafrica.co.za'
);
