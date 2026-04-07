import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Proposal = {
  id?: string;
  created_at?: string;
  slug: string;
  client_name: string;
  client_logo_url?: string;
  contract_date?: string;
  supply_window_closes?: string;

  // Technical
  contract_mwh: number;           // Annual contracted supply MWh/yr
  customer_load_mwh: number;      // Customer electrical load MWh/yr
  green_coverage_pct: number;     // e.g. 70
  carbon_savings: number;         // Tons CO2e/yr  = contract_mwh * 0.94

  // Monthly supply profile (MWh/month) — stored as JSON
  monthly_supply: {
    jan: number; feb: number; mar: number; apr: number;
    may: number; jun: number; jul: number; aug: number;
    sep: number; oct: number; nov: number; dec: number;
  };
  monthly_load: {
    jan: number; feb: number; mar: number; apr: number;
    may: number; jun: number; jul: number; aug: number;
    sep: number; oct: number; nov: number; dec: number;
  };

  // TOU Tariffs — R/kWh — Your Offer (COD: 1 April 2025)
  tariff_5yr: number;    // Weighted average e.g. 1.43
  tariff_10yr: number;   // e.g. 1.41
  tariff_15yr: number;   // e.g. 1.34

  // Eskom WEPS weighted average for comparison
  eskom_tariff: number;  // e.g. 1.49

  // Cumulative savings over term [Mill ZAR]
  savings_5yr: number;   // e.g. 26
  savings_10yr: number;  // e.g. 81
  savings_15yr: number;  // e.g. 189

  // Commercial terms
  forex_exposure_pct: number;   // e.g. 55
  volume_guarantee_pct: number; // e.g. 70

  // Buyer credit support [ZAR mill]
  credit_support_5yr: number;
  credit_support_10yr: number;
  credit_support_15yr: number;

  // Escalation rates used for projections
  escalation_cpi: number;       // e.g. 4.5 (%)
  eskom_escalation: number;     // e.g. 6.0 (%)

  // Sales contact
  salesperson_name?: string;
  salesperson_email?: string;
  salesperson_phone?: string;
};
