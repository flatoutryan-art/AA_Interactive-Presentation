'use client';
import React, { createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. DATABASE CONNECTION
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. DATA CONSTANTS (Required by your Admin/Slug pages)
export const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// 3. TYPES
export type MonthlyProfile = Record<string, number>;

export type Proposal = {
  id?: string;
  slug: string;
  client_name: string;
  contract_date?: string;
  supply_window_closes?: string;
  contract_mwh: number;
  customer_load_mwh: number;
  green_coverage_pct: number;
  monthly_supply: MonthlyProfile;
  monthly_load: MonthlyProfile;
  tariff_5yr: number;
  tariff_10yr: number;
  tariff_15yr: number;
  eskom_tariff: number;
  savings_5yr: number;
  savings_10yr: number;
  savings_15yr: number;
  forex_exposure_pct: number;
  volume_guarantee_pct: number;
  credit_support_5yr: number;
  credit_support_10yr: number;
  credit_support_15yr: number;
  escalation_cpi: number;
  eskom_escalation: number;
  salesperson_name?: string;
  salesperson_email?: string;
  salesperson_phone?: string;
  created_at?: string;
};

// 4. APOLLO THEME
export const APOLLO_THEME = {
  colors: {
    charcoal: '#0D1B14',
    deepForest: '#0F2318',
    forest: '#1A3A28',
    midForest: '#1E4D30',
    green: '#10B981',
    mint: '#34D399',
    mintBright: '#6EE7B7',
    gold: '#C9A84C',
    white: '#F0FFF4',
    muted: '#86EFAC',
    dim: '#4ADE80',
    saving: '#10B981',
    eskom: '#EF4444',
    neutral: '#6B7280',
  },
  fonts: {
    display: "'Barlow Condensed', sans-serif",
    heading: "'Barlow Semi Condensed', sans-serif",
    body: "'DM Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  spacing: {
    section: '6rem',
    card: '2rem',
  },
};

type Theme = typeof APOLLO_THEME;
const ThemeContext = createContext<Theme>(APOLLO_THEME);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeContext.Provider value={APOLLO_THEME}>
    {children}
  </ThemeContext.Provider>
);

export const useApolloTheme = () => useContext(ThemeContext);
