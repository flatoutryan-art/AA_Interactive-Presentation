/**
 * lib/supabaseClient.ts
 * Data layer — NO 'use client' directive here.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  as string;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnon);

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

export type Proposal = {
  id?:                    string;
  created_at?:            string;
  slug:                   string;
  client_name:            string;
  client_logo_url?:       string;
  contract_date?:         string;
  supply_window_closes?:  string;
  next_supply_window?:    string;
  proposal_password:      string;
  contract_mwh:           number;
  customer_load_mwh:      number;
  green_coverage_pct:     number;
  carbon_savings?:        number;
  monthly_supply:         MonthlyProfile;
  monthly_load:           MonthlyProfile;
  tariff_3yr:             number;
  tariff_5yr:             number;
  tariff_7yr:             number;
  tariff_10yr:            number;
  tariff_15yr:            number;
  tariff_20yr:            number;
  eskom_tariff:           number;
  savings_3yr:            number;
  savings_5yr:            number;
  savings_7yr:            number;
  savings_10yr:           number;
  savings_15yr:           number;
  savings_20yr:           number;
  year1_savings:          number;
  npv_savings:            number;
  forex_exposure_pct:     number;
  volume_guarantee_pct:   number;
  credit_support_3yr:     number;
  credit_support_5yr:     number;
  credit_support_7yr:     number;
  credit_support_10yr:    number;
  credit_support_15yr:    number;
  credit_support_20yr:    number;
  escalation_cpi:         number;
  eskom_escalation:       number;
  tou_peak_pct:           number;
  tou_standard_pct:       number;
  tou_offpeak_pct:        number;
  active_terms:           number[];
  value_return_hr?:       number;   // DEAL IOs D48 — value return as decimal
  // Actual TOU tariffs from DEAL IOs (Apollo E19:E25, WEPS C28:C34)
  tou_peak_hs_apollo?:    number;
  tou_std_hs_apollo?:     number;
  tou_op_hs_apollo?:      number;
  tou_peak_ls_apollo?:    number;
  tou_std_ls_apollo?:     number;
  tou_op_ls_apollo?:      number;
  tou_peak_hs_weps?:      number;
  tou_std_hs_weps?:       number;
  tou_op_hs_weps?:        number;
  tou_peak_ls_weps?:      number;
  tou_std_ls_weps?:       number;
  tou_op_ls_weps?:        number;
  salesperson_name?:      string;
  salesperson_email?:     string;
  salesperson_phone?:     string;
};

// ── Extended TOU tariff fields (DEAL IOs E19:E25 Apollo, C28:C34 WEPS) ───────
// Added in migration v4. Optional — zero when not yet uploaded.
// These replace the computed ratio approximations with actual model values.
