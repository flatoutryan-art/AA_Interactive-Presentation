/**
 * lib/supabaseClient.tsx
 * No 'use client' — imported by both server and client components.
 */

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
);

// ─── TOU breakdown shape ──────────────────────────────────────────────────────
export type TouBreakdown = {
  hs_peak:     number;
  hs_std:      number;
  hs_offpeak:  number;
  ls_peak:     number;
  ls_std:      number;
  ls_offpeak:  number;
  weighted_avg:number;
};

// ─── Monthly profile ──────────────────────────────────────────────────────────
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

// ─── Proposal — exact Supabase column names ───────────────────────────────────
export type Proposal = {
  id?:                   string;
  created_at?:           string;
  slug:                  string;
  client_name:           string;
  client_logo_url?:      string;
  contract_date?:        string;
  supply_window_closes?: string;

  contract_mwh:          number;
  customer_load_mwh:     number;
  green_coverage_pct:    number;
  carbon_savings?:       number;

  monthly_supply:        MonthlyProfile;
  monthly_load:          MonthlyProfile;

  // Term availability flags
  has_5yr:               boolean;
  has_10yr:              boolean;
  has_15yr:              boolean;

  // Full TOU breakdown per term (null if term not offered)
  tou_5yr?:              TouBreakdown | null;
  tou_10yr?:             TouBreakdown | null;
  tou_15yr?:             TouBreakdown | null;

  // Weighted average convenience fields (derived from TOU)
  tariff_5yr?:           number | null;
  tariff_10yr?:          number | null;
  tariff_15yr?:          number | null;
  eskom_tariff:          number;

  savings_5yr?:          number | null;
  savings_10yr?:         number | null;
  savings_15yr?:         number | null;

  forex_exposure_pct:    number;
  volume_guarantee_pct:  number;
  credit_support_5yr:    number;
  credit_support_10yr:   number;
  credit_support_15yr:   number;

  escalation_cpi:        number;
  eskom_escalation:      number;

  salesperson_name?:     string;
  salesperson_email?:    string;
  salesperson_phone?:    string;
};

// ─── Helper: get weighted average for a term ─────────────────────────────────
export function getTariff(p: Proposal, term: 5|10|15): number {
  if (term === 5)  return p.tou_5yr?.weighted_avg  ?? p.tariff_5yr  ?? 0;
  if (term === 10) return p.tou_10yr?.weighted_avg ?? p.tariff_10yr ?? 0;
  return                  p.tou_15yr?.weighted_avg ?? p.tariff_15yr ?? 0;
}

// ─── Helper: get available terms ─────────────────────────────────────────────
export function getAvailableTerms(p: Proposal): Array<5|10|15> {
  const terms: Array<5|10|15> = [];
  if (p.has_5yr  !== false && getTariff(p, 5)  > 0) terms.push(5);
  if (p.has_10yr !== false && getTariff(p, 10) > 0) terms.push(10);
  if (p.has_15yr !== false && getTariff(p, 15) > 0) terms.push(15);
  // Fallback: if flags not set (old rows), show all
  if (terms.length === 0) {
    if (p.tariff_5yr)  terms.push(5);
    if (p.tariff_10yr) terms.push(10);
    if (p.tariff_15yr) terms.push(15);
  }
  return terms.length > 0 ? terms : [5];
}
