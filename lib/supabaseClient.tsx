'use client';

/**
 * lib/supabaseClient.tsx
 * Single source of truth: Supabase client, Proposal type, month helpers.
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase client ───────────────────────────────────────────────────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  as string;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ── Monthly profile (JSONB columns) ──────────────────────────────────────────
export type MonthlyProfile = {
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
};

export const MONTH_KEYS: Array<keyof MonthlyProfile> = [
  'jan','feb','mar','apr','may','jun',
  'jul','aug','sep','oct','nov','dec',
];

export const MONTH_LABELS: string[] = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// ── Proposal — exact Supabase column names ────────────────────────────────────
export type Proposal = {
  id?:                  string;
  created_at?:          string;

  // Identity
  slug:                  string;
  client_name:           string;
  client_logo_url?:      string;
  contract_date?:        string;
  supply_window_closes?: string;

  // Technical
  contract_mwh:          number;
  customer_load_mwh:     number;
  green_coverage_pct:    number;
  carbon_savings?:       number;   // generated: contract_mwh * 0.94

  // Monthly JSONB
  monthly_supply:        MonthlyProfile;
  monthly_load:          MonthlyProfile;

  // TOU tariffs [R/kWh]
  tariff_5yr:            number;
  tariff_10yr:           number;
  tariff_15yr:           number;
  eskom_tariff:          number;

  // Cumulative savings [Mill ZAR]
  savings_5yr:           number;
  savings_10yr:          number;
  savings_15yr:          number;

  // Commercial
  forex_exposure_pct:    number;
  volume_guarantee_pct:  number;

  // Credit support [ZAR mill]
  credit_support_5yr:    number;
  credit_support_10yr:   number;
  credit_support_15yr:   number;

  // Escalation [% per year]
  escalation_cpi:        number;
  eskom_escalation:      number;

  // Contact
  salesperson_name?:     string;
  salesperson_email?:    string;
  salesperson_phone?:    string;
};
