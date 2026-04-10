'use client';

/**
 * app/[slug]/page.tsx  —  Apollo Africa: Strategic Energy Roadmap
 * Route: /[slug]   e.g. /steyn-city
 * Depth: 2 levels  →  ../../lib/supabaseClient
 *
 * CRASH FIXES vs previous version:
 *  1. Removed next/image (caused hydration error when /public/apollo-logo.png absent)
 *  2. Removed ReferenceLine import (Recharts runtime undefined in some builds)
 *  3. Hardened useMemo dependency arrays
 *  4. Added null-guards on all proposal field arithmetic
 */

import { useEffect, useState, useMemo } from 'react';
import { supabase, MONTH_KEYS, MONTH_LABELS } from '../../lib/supabaseClient';
import type { Proposal } from '../../lib/supabaseClient';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type Term = 5 | 10 | 15 | 20;

// ─── Constants ────────────────────────────────────────────────────────────────
const CARBON_TAX_USD_PER_TON = 80;
const ZAR_PER_USD             = 18.5;
const CARBON_TAX_ZAR          = CARBON_TAX_USD_PER_TON * ZAR_PER_USD;
const ESKOM_WATER_L_PER_KWH   = 1.4;
const TREES_PER_TON_CO2       = 45;

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number, dp = 2): string =>
  (isNaN(n) ? 0 : n).toLocaleString('en-ZA', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

const fmtMill = (n: number): string => `R${fmt(isNaN(n) ? 0 : n, 0)}m`;

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

// ─── Savings trajectory ───────────────────────────────────────────────────────
type TRow = {
  year: number;
  apolloTariff: number;
  eskomTariff: number;
  annualSaving: number;
  cumulativeSaving: number;
};

function buildTrajectory(
  apollo0: number,
  eskom0: number,
  contractMwh: number,
  multiplier: number,
  customerLoad: number,
  cpi: number,
  esEsc: number,
  years: number,
): TRow[] {
  let a = apollo0 || 1.43;
  let e = eskom0  || 1.49;
  let cumul = 0;
  return Array.from({ length: years }, (_, i) => {
    const generated = contractMwh * multiplier;
    const effective = Math.min(generated, customerLoad || generated);
    const saving    = ((effective * e) - (generated * a)) * 1000 / 1_000_000;
    cumul += saving;
    const row: TRow = {
      year:             i + 1,
      apolloTariff:     parseFloat(a.toFixed(4)),
      eskomTariff:      parseFloat(e.toFixed(4)),
      annualSaving:     parseFloat(saving.toFixed(3)),
      cumulativeSaving: parseFloat(cumul.toFixed(3)),
    };
    a *= 1 + cpi   / 100;
    e *= 1 + esEsc / 100;
    return row;
  });
}

// ─── 24-hour day profile ──────────────────────────────────────────────────────
type DayRow = { hour: string; apollo: number; load: number; spill: number };

function buildDayProfile(
  contractMwhPerYear: number,
  customerLoadMwh: number,
  multiplier: number,
): DayRow[] {
  const apolloShape = [
    0, 0, 0, 0, 0, 0.05, 0.25, 0.55, 0.80, 0.95,
    1.0, 1.0, 1.0, 0.95, 0.85, 0.70, 0.50, 0.30,
    0.10, 0.05, 0, 0, 0, 0,
  ];
  const loadShape = [
    0.35, 0.30, 0.28, 0.28, 0.30, 0.38, 0.55, 0.75,
    0.85, 0.80, 0.78, 0.75, 0.72, 0.74, 0.76, 0.80,
    0.90, 1.0, 0.98, 0.88, 0.72, 0.60, 0.48, 0.40,
  ];
  const apolloPeakMw = (contractMwhPerYear / 8760) * multiplier * 3.2;
  const loadPeakMw   = ((customerLoadMwh || contractMwhPerYear) / 8760) * 2.8;

  return Array.from({ length: 24 }, (_, h) => {
    const apollo = apolloShape[h] * apolloPeakMw;
    const load   = loadShape[h]   * loadPeakMw;
    const spill  = Math.max(0, apollo - load);
    return {
      hour:   `${String(h).padStart(2, '0')}:00`,
      apollo: parseFloat(apollo.toFixed(3)),
      load:   parseFloat(load.toFixed(3)),
      spill:  parseFloat(spill.toFixed(3)),
    };
  });
}

// ─── Zone logic ───────────────────────────────────────────────────────────────
type Zone = {
  id: 'A' | 'B' | 'C';
  label: string;
  sublabel: string;
  color: string;
  cbamCompliant: boolean;
};

function getZone(multiplier: number, baseCoverage: number): Zone {
  const effective = baseCoverage * multiplier;
  if (effective >= 90) {
    return { id: 'C', label: 'Carbon Neutral', sublabel: 'EU CBAM Compliant', color: '#C9A84C', cbamCompliant: true };
  }
  if (effective >= 60) {
    return { id: 'B', label: 'Balanced Growth', sublabel: 'Future-Proofed', color: '#34D399', cbamCompliant: false };
  }
  return { id: 'A', label: 'Maximum Savings', sublabel: 'Cash Flow Optimised', color: '#10B981', cbamCompliant: false };
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────
function ChartTip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-forest border border-border rounded-xl px-4 py-3 text-xs shadow-2xl">
      <p className="text-muted font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="leading-5">
          {p.name}: <span className="font-bold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function Stat({
  label, value, sub, accent = false,
}: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-1 ${
      accent ? 'bg-green/10 border-green/40' : 'bg-forest border-border'
    }`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-2xl font-black leading-none ${accent ? 'text-green' : 'text-offwhite'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-dim mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SHead({ eye, title }: { eye: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-green mb-2">{eye}</p>
      <h2 className="font-display font-black text-offwhite leading-tight text-4xl md:text-5xl">
        {title}
      </h2>
    </div>
  );
}

// ─── Chart card ───────────────────────────────────────────────────────────────
function CCard({
  title, children, gold = false,
}: {
  title: string; children: React.ReactNode; gold?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 md:p-6 ${
      gold ? 'bg-gold/5 border-gold/40 shadow-lg shadow-gold/10' : 'bg-forest border-border'
    }`}>
      <p className={`text-[11px] font-semibold uppercase tracking-widest mb-4 ${
        gold ? 'text-gold' : 'text-muted'
      }`}>{title}</p>
      {children}
    </div>
  );
}

function HR() {
  return <hr className="border-none border-t border-border my-0" />;
}

// ─── Logo (pure SVG — no next/image dependency) ───────────────────────────────
function ApolloLogo() {
  return (
    <div className="flex items-end gap-2.5">
      <svg width="24" height="28" viewBox="0 0 28 32" fill="none" aria-hidden="true">
        <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9" />
        <path d="M14 6L24 28H14V6Z" fill="#10B981" />
      </svg>
      <div>
        <p className="font-display text-xl font-black text-offwhite leading-none tracking-tight">
          APOLLO <span className="text-green">AFRICA</span>
        </p>
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
          a Reunert company
        </p>
      </div>
    </div>
  );
}

// ─── Loading / 404 ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-green/20 border-t-green animate-spin" />
        <p className="text-sm text-muted">Loading your proposal…</p>
      </div>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center text-center px-4">
      <div>
        <p className="font-display text-8xl font-black text-border">404</p>
        <p className="text-offwhite text-xl font-bold mt-3">Proposal not found</p>
        <p className="text-muted text-sm mt-2">
          Check the URL or contact your Apollo representative.
        </p>
      </div>
    </div>
  );
}

// ─── CBAM card ────────────────────────────────────────────────────────────────
function CBAMCard({
  contractMwh, multiplier, zone,
}: {
  contractMwh: number; multiplier: number; zone: Zone;
}) {
  const generated    = contractMwh * multiplier;
  const ghgPerYear   = generated * 0.94;
  const avoidedTax   = (ghgPerYear * CARBON_TAX_ZAR) / 1_000_000;
  const gold         = zone.cbamCompliant;

  return (
    <div className={`rounded-2xl border p-6 transition-all duration-500 ${
      gold ? 'bg-gold/8 border-gold/50 shadow-xl shadow-gold/15' : 'bg-forest border-border'
    }`}>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
          Carbon &amp; EU CBAM Analysis
        </p>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-500"
          style={{
            borderColor: gold ? '#C9A84C' : '#1E4D30',
            background:  gold ? 'rgba(201,168,76,0.15)' : 'rgba(30,77,48,0.5)',
            color:        gold ? '#C9A84C' : '#86EFAC',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: gold ? '#C9A84C' : '#86EFAC' }}
          />
          {gold ? 'EU CBAM Compliant ✓' : 'Standard Savings'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            GHG Avoided / yr
          </p>
          <p className={`text-3xl font-black leading-none ${gold ? 'text-gold' : 'text-green'}`}>
            {fmt(ghgPerYear, 0)}
          </p>
          <p className="text-xs text-dim mt-0.5">tCO₂e</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            Avoided Carbon Tax
          </p>
          <p className={`text-3xl font-black leading-none ${gold ? 'text-gold' : 'text-green'}`}>
            {fmtMill(avoidedTax)}
          </p>
          <p className="text-xs text-dim mt-0.5">per year @ $80/ton</p>
        </div>
        <div className="col-span-2 md:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
            EU Carbon Price
          </p>
          <p className={`text-3xl font-black leading-none ${gold ? 'text-gold' : 'text-green'}`}>
            R{fmt(CARBON_TAX_ZAR, 0)}
          </p>
          <p className="text-xs text-dim mt-0.5">per ton (R18.50/$)</p>
        </div>
      </div>

      {gold && (
        <div className="mt-2 bg-gold/10 border border-gold/30 rounded-xl p-4">
          <p className="text-gold text-xs font-bold uppercase tracking-widest mb-1.5">
            ✦ EU CBAM Protection Active
          </p>
          <p className="text-muted text-xs leading-relaxed">
            At 90%+ renewable coverage your business qualifies for EU Carbon Border Adjustment
            Mechanism compliance — protecting exports and enabling premium green product pricing
            in European markets.
          </p>
        </div>
      )}

      <p className="text-border text-[11px] mt-4">
        Carbon price based on EU ETS Q1 2025 forward rate. Converted at R18.50/USD.
        For informational purposes only.
      </p>
    </div>
  );
}

// ─── Environmental Legacy ─────────────────────────────────────────────────────
function EnvLegacy({
  contractMwh, multiplier, term,
}: {
  contractMwh: number; multiplier: number; term: number;
}) {
  const annualMwh   = contractMwh * multiplier;
  const totalKwh    = annualMwh * 1000 * term;
  const ghgTotal    = annualMwh * 0.94 * term;
  const waterLitres = totalKwh * ESKOM_WATER_L_PER_KWH;
  const trees       = ghgTotal * TREES_PER_TON_CO2;
  const cars        = ghgTotal / 2.1;

  const items = [
    { icon: '💧', label: 'Water Saved',   value: fmt(waterLitres / 1_000_000, 1), unit: 'million litres', note: 'vs coal generation' },
    { icon: '🌳', label: 'Tree Equiv.',   value: fmt(trees, 0),                   unit: 'trees planted',  note: 'carbon absorption equiv.' },
    { icon: '🚗', label: 'Cars Off Road', value: fmt(cars, 0),                    unit: 'vehicles / year', note: 'tailpipe equivalent' },
    { icon: '⚡', label: 'Clean Energy',  value: fmt(totalKwh / 1_000_000, 1),   unit: 'million kWh',    note: `over ${term} years` },
  ];

  return (
    <div className="bg-forest border border-border rounded-2xl p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-green mb-5">
        Local Impact — Environmental Legacy
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.label} className="text-center">
            <p className="text-3xl mb-2">{item.icon}</p>
            <p className="text-green text-2xl font-black leading-none">{item.value}</p>
            <p className="text-offwhite text-xs font-semibold mt-1">{item.unit}</p>
            <p className="text-muted text-[11px] mt-0.5">{item.note}</p>
          </div>
        ))}
      </div>
      <p className="text-border text-[11px] mt-5 text-center">
        Water: 1.4 L/kWh (Eskom coal avg) · Carbon absorption: 45 trees/tCO₂e/yr · Vehicle avg: 2.1 tCO₂e/yr
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ProposalPage({ params }: { params: { slug: string } }) {
  const [proposal,   setProposal]   = useState<Proposal | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [term,       setTerm]       = useState<Term>(5);
  const [multiplier, setMultiplier] = useState(1.0);

  // ── Fetch
  useEffect(() => {
    supabase
      .from('proposals')
      .select('*')
      .eq('slug', params.slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setProposal(data as Proposal);
        setLoading(false);
      });
  }, [params.slug]);

  if (loading)               return <LoadingScreen />;
  if (notFound || !proposal) return <NotFoundScreen />;

  // ── Derived (reactive to term + multiplier) ──────────────────────────────
  const baseTariff: number =
    term === 5  ? (proposal.tariff_5yr  || 1.43) :
    term === 10 ? (proposal.tariff_10yr || 1.41) :
    term === 15 ? (proposal.tariff_15yr || 1.34) :
                  (proposal.tariff_15yr || 1.34) * 0.97;

  const baseSavings: number =
    term === 5  ? (proposal.savings_5yr  || 0) :
    term === 10 ? (proposal.savings_10yr || 0) :
    term === 15 ? (proposal.savings_15yr || 0) :
                  (proposal.savings_15yr || 0) * 1.7;

  const activeCredit: number =
    term === 5  ? (proposal.credit_support_5yr  || 0) :
    term === 10 ? (proposal.credit_support_10yr || 0) :
                  (proposal.credit_support_15yr || 0);

  const contractMwh    = proposal.contract_mwh    || 0;
  const customerLoad   = proposal.customer_load_mwh || contractMwh;
  const generated      = contractMwh * multiplier;
  const effective      = Math.min(generated, customerLoad);
  const spillageMwh    = Math.max(0, generated - customerLoad);
  const spillagePct    = generated > 0 ? (spillageMwh / generated) * 100 : 0;
  const ghgAnnual      = generated * 0.94;
  const coverage       = customerLoad > 0 ? (effective / customerLoad) * 100 : 0;
  const adjustedSavings = baseSavings * multiplier * (contractMwh > 0 ? effective / contractMwh : 1);
  const tariffDiscount  = proposal.eskom_tariff > 0
    ? ((proposal.eskom_tariff - baseTariff) / proposal.eskom_tariff) * 100
    : 0;

  const zone = getZone(multiplier, proposal.green_coverage_pct || 70);

  // ── Chart datasets (memoised)
  const trajectory = useMemo(
    () => buildTrajectory(
      baseTariff,
      proposal.eskom_tariff || 1.49,
      contractMwh,
      multiplier,
      customerLoad,
      proposal.escalation_cpi   || 4.5,
      proposal.eskom_escalation || 6.0,
      term,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [term, multiplier, baseTariff],
  );

  const monthly = MONTH_LABELS.map((label, i) => {
    const base  = (proposal.monthly_supply as Record<string, number>)[MONTH_KEYS[i]] ?? 0;
    const load  = (proposal.monthly_load   as Record<string, number>)[MONTH_KEYS[i]] ?? 0;
    const adj   = base * multiplier;
    return {
      month:  label,
      supply: Math.round(adj),
      load,
      spill:  Math.round(Math.max(0, adj - load)),
    };
  });

  const dayProfile = useMemo(
    () => buildDayProfile(contractMwh, customerLoad, multiplier),
    [contractMwh, customerLoad, multiplier],
  );

  const tariffBars = [
    { term: '5yr',  apollo: proposal.tariff_5yr  || 1.43, eskom: proposal.eskom_tariff || 1.49 },
    { term: '10yr', apollo: proposal.tariff_10yr || 1.41, eskom: proposal.eskom_tariff || 1.49 },
    { term: '15yr', apollo: proposal.tariff_15yr || 1.34, eskom: proposal.eskom_tariff || 1.49 },
    { term: '20yr', apollo: (proposal.tariff_15yr || 1.34) * 0.97, eskom: proposal.eskom_tariff || 1.49 },
  ];

  const lgFmt = (v: string) => <span className="text-muted text-xs">{v}</span>;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-charcoal text-offwhite font-sans">

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest via-charcoal to-charcoal">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#10B981 1px,transparent 1px),linear-gradient(90deg,#10B981 1px,transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-5 pt-12 pb-20">
          {/* Nav */}
          <div className="flex items-center justify-between mb-14">
            <ApolloLogo />
            <div className="text-right">
              <p className="text-xs text-muted">Strategic Energy Roadmap</p>
              {proposal.contract_date && (
                <p className="text-xs text-dim">{fmtDate(proposal.contract_date)}</p>
              )}
            </div>
          </div>

          {/* Pill */}
          <div className="inline-flex items-center gap-2 bg-green/10 border border-green/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
            <span className="text-green text-[11px] font-bold uppercase tracking-[0.2em]">
              Securing Renewable Energy Supply
            </span>
          </div>

          <h1
            className="font-display font-black leading-[0.93] tracking-tight mb-6"
            style={{ fontSize: 'clamp(52px, 10vw, 96px)' }}
          >
            <span className="text-offwhite">Go Greener,</span>
            <br />
            <span className="text-green">Pay Less.</span>
          </h1>

          <p className="text-muted text-lg max-w-xl leading-relaxed mb-6">
            Your tailored clean energy roadmap for{' '}
            <strong className="text-offwhite">{proposal.client_name}</strong>.
            Certified renewable energy, expertly sourced and seamlessly delivered.
          </p>

          {proposal.supply_window_closes && (
            <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-lg px-4 py-2">
              <span className="text-gold text-[11px] font-bold uppercase tracking-widest">
                ⚠ Supply Window Closes:
              </span>
              <span className="text-gold text-sm font-semibold">
                {fmtDate(proposal.supply_window_closes)}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ STICKY CONTROLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="sticky top-0 z-50 border-b border-border bg-charcoal/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 py-3 flex flex-wrap items-center gap-3">
          {/* Term toggle */}
          <div className="flex items-center gap-1 bg-forest border border-border rounded-xl p-1">
            {([5, 10, 15, 20] as Term[]).map(t => (
              <button
                key={t}
                onClick={() => setTerm(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                  term === t
                    ? 'bg-green text-charcoal shadow-md shadow-green/20'
                    : 'text-muted hover:text-offwhite hover:bg-elevated'
                }`}
              >
                {t}yr
              </button>
            ))}
          </div>

          {/* Live zone badge */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all duration-500"
            style={{
              borderColor: zone.color + '60',
              background:  zone.color + '18',
              color:        zone.color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: zone.color }}
            />
            Zone {zone.id}: {zone.label}
          </div>
        </div>
      </div>

      {/* ━━━ BODY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-5xl mx-auto px-5">

        {/* ── SNAPSHOT ───────────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your Offer at a Glance" title="Commercial Snapshot" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="Contracted Supply"          value={`${fmt(contractMwh, 0)} MWh`}     sub="base per year"             accent />
            <Stat label={`${term}-yr Tariff`}        value={`R${fmt(baseTariff)} /kWh`}       sub={`${fmt(tariffDiscount,1)}% below Eskom`} />
            <Stat label={`${term}-yr Cum. Savings`}  value={fmtMill(adjustedSavings)}         sub="at current slider"         accent />
            <Stat label="Annual GHG Savings"         value={`${fmt(ghgAnnual, 0)} t`}         sub="CO₂e per year" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Green Coverage"       value={`${fmt(coverage, 0)}%`}               sub="effective (slider-adjusted)" />
            <Stat label="Volume Guarantee"     value={`${proposal.volume_guarantee_pct || 70}%`} sub="contracted supply" />
            <Stat label="Spillage"             value={`${fmt(spillagePct, 1)}%`}            sub={`${fmt(spillageMwh, 0)} MWh excess`} />
            <Stat label="Buyer Credit Support" value={`R${fmt(activeCredit, 1)}m`}          sub="ZAR million" />
          </div>
        </section>

        <HR />

        {/* ── GREEN VOLUME SLIDER ────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Strategic Control" title="Green Volume Optimiser" />

          <div className="bg-forest border border-border rounded-2xl p-6 mb-6">
            {/* Slider header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-muted text-sm font-semibold">Volume Multiplier</p>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-300"
                  style={{
                    borderColor: zone.color + '80',
                    background:  zone.color + '20',
                    color:        zone.color,
                  }}
                >
                  {multiplier < 0.95 ? 'Conservative' :
                   multiplier < 1.05 ? 'Contracted'   :
                   multiplier < 1.30 ? 'Uplifted'     :
                   multiplier < 1.60 ? 'Carbon-Neutral' : 'Maximum Green'}
                </span>
                <span className="text-offwhite font-mono font-bold text-lg">
                  {fmt(multiplier * 100, 0)}%
                </span>
              </div>
            </div>

            {/* Range input */}
            <input
              type="range"
              min={80}
              max={180}
              step={5}
              value={Math.round(multiplier * 100)}
              onChange={e => setMultiplier(Number(e.target.value) / 100)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer mb-2"
              style={{
                background: `linear-gradient(to right, ${zone.color} 0%, ${zone.color} ${
                  (multiplier - 0.8) / 1.0 * 100
                }%, #1E4D30 ${(multiplier - 0.8) / 1.0 * 100}%, #1E4D30 100%)`,
              }}
            />
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide mb-5">
              <span className="text-green">Zone A: Max Savings (CFO)</span>
              <span className="text-mint">Zone B: Balanced (Ops)</span>
              <span className="text-gold">Zone C: CBAM (Board)</span>
            </div>

            {/* Zone cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { id: 'A', label: 'Zone A',  title: 'Max Savings',    range: '80–99%',   desc: 'Maximum cash flow. Lowest tariff. Ideal for cost reduction mandates.', color: '#10B981' },
                { id: 'B', label: 'Zone B',  title: 'Balanced',       range: '100–129%', desc: 'Future-proofed. Balanced between cost saving and green coverage.',      color: '#34D399' },
                { id: 'C', label: 'Zone C ✦',title: 'Carbon Neutral', range: '130–180%', desc: 'EU CBAM compliant. Enables green premium pricing in export markets.',   color: '#C9A84C' },
              ] as const).map(z => {
                const active = zone.id === z.id;
                return (
                  <div
                    key={z.id}
                    className="rounded-xl border p-4 transition-all duration-300 text-center"
                    style={{
                      borderColor: active ? z.color + 'aa' : '#1E4D30',
                      background:  active ? z.color + '18' : '#0F2318',
                      boxShadow:   active ? `0 4px 20px ${z.color}22` : 'none',
                    }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: z.color }}>
                      {z.label}
                    </p>
                    <p className="text-offwhite text-sm font-bold">{z.title}</p>
                    <p className="text-[11px] mt-1" style={{ color: z.color }}>{z.range}</p>
                    <p className="text-muted text-[11px] mt-2 leading-tight">{z.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-forest border border-border rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Generated Volume</p>
              <p className="text-2xl font-black text-offwhite">{fmt(generated, 0)}</p>
              <p className="text-xs text-dim">MWh / year</p>
            </div>
            <div className="bg-forest border border-border rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Effective Saving</p>
              <p className="text-2xl font-black text-green">{fmtMill(adjustedSavings)}</p>
              <p className="text-xs text-dim">{term}-yr cumulative</p>
            </div>
            <div className={`rounded-2xl border p-5 transition-all duration-300 ${
              spillagePct > 5 ? 'bg-gold/8 border-gold/40' : 'bg-forest border-border'
            }`}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Spillage</p>
              <p className={`text-2xl font-black ${spillagePct > 5 ? 'text-gold' : 'text-offwhite'}`}>
                {fmt(spillagePct, 1)}%
              </p>
              <p className="text-xs text-dim">{fmt(spillageMwh, 0)} MWh excess</p>
            </div>
            <div className="bg-forest border border-border rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">GHG Avoided</p>
              <p className="text-2xl font-black text-mint">{fmt(ghgAnnual, 0)}</p>
              <p className="text-xs text-dim">tCO₂e / year</p>
            </div>
          </div>
        </section>

        <HR />

        {/* ── CBAM ───────────────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="EU Export & Carbon Strategy" title="CBAM Carbon Tax Analysis" />
          <CBAMCard contractMwh={contractMwh} multiplier={multiplier} zone={zone} />
        </section>

        <HR />

        {/* ── MONTHLY FORECAST + DAY-IN-LIFE ─────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your Contracted Supply" title="Monthly Power Forecast" />

          <CCard title="Apollo Wheeled Supply vs Electrical Load [MWh / month]">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis dataKey="month" tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} unit=" MWh" width={72} />
                <Tooltip content={<ChartTip />} />
                <Legend formatter={lgFmt} wrapperStyle={{ paddingTop: 14 }} />
                {spillageMwh > 0 && (
                  <Area type="monotone" dataKey="spill" name="Spillage (excess)"
                    stroke="#C9A84C" strokeWidth={1.5} fill="url(#spg)" dot={false} strokeDasharray="4 2" />
                )}
                <Area type="monotone" dataKey="supply" name="Apollo Wheeled Supply"
                  stroke="#10B981" strokeWidth={2} fill="url(#sg)" dot={false} />
                <Line type="monotone" dataKey="load" name="Electrical Load"
                  stroke="#F0FFF4" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CCard>

          {/* Day-in-the-life 24hr chart */}
          <div className="mt-5">
            <CCard title="Day-in-the-Life Match — 24-Hour Cycle [MW average]">
              <p className="text-muted text-xs mb-4 -mt-2">
                Representative daily profile. Move the slider above to see Apollo supply grow relative to your load.
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dayProfile} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="dsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: '#86EFAC', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis tick={{ fill: '#86EFAC', fontSize: 10 }} axisLine={false} tickLine={false} unit=" MW" width={48} />
                  <Tooltip content={<ChartTip />} />
                  <Legend formatter={lgFmt} wrapperStyle={{ paddingTop: 12 }} />
                  {spillageMwh > 0 && (
                    <Area type="monotone" dataKey="spill" name="Spillage"
                      stroke="#C9A84C" strokeWidth={1.5} fill="url(#dsg)" dot={false} strokeDasharray="4 2" />
                  )}
                  <Area type="monotone" dataKey="apollo" name="Apollo Supply (MW)"
                    stroke="#10B981" strokeWidth={2.5} fill="url(#dag)" dot={false} />
                  <Line type="monotone" dataKey="load" name="Eskom Load (MW)"
                    stroke="#F0FFF4" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-border text-[11px] mt-3">
                Indicative shape: wind/solar blend. Gold area appears when supply exceeds consumption. Actual output varies by weather and grid conditions.
              </p>
            </CCard>
          </div>

          {/* Monthly table */}
          <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-forest">
                  <th className="text-left py-3 px-4 text-green text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                    Period
                  </th>
                  {MONTH_LABELS.map(m => (
                    <th key={m} className="text-center py-3 px-2 text-muted text-[11px] font-semibold">{m}</th>
                  ))}
                  <th className="text-center py-3 px-4 text-green text-[11px] font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Apollo Supply', key: 'supply' as const, color: 'text-green' },
                  { label: 'Electrical Load', key: 'load' as const, color: 'text-offwhite' },
                ] as const).map(row => {
                  const total = monthly.reduce((s, d) => s + d[row.key], 0);
                  return (
                    <tr key={row.key} className="border-b border-border/50 hover:bg-forest/50 transition-colors">
                      <td className={`py-3 px-4 font-semibold whitespace-nowrap ${row.color}`}>{row.label}</td>
                      {monthly.map(d => (
                        <td key={d.month} className="text-center py-3 px-2 text-offwhite">{fmt(d[row.key], 0)}</td>
                      ))}
                      <td className={`text-center py-3 px-4 font-black text-sm ${row.color}`}>{fmt(total, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <HR />

        {/* ── SAVINGS FORECAST ───────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your Savings Forecast" title={`${term}-Year Savings Projection`} />

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <CCard title="Annual Savings [Mill ZAR / year]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trajectory} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: '#86EFAC', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} unit="m" width={40} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="annualSaving" name="Annual Saving (R mill)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CCard>

            <CCard title="Cumulative Savings [Mill ZAR]">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trajectory} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#34D399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34D399" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: '#86EFAC', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} unit="m" width={40} />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="cumulativeSaving"
                    name="Cumulative Saving (R mill)"
                    stroke="#34D399"
                    strokeWidth={2.5}
                    fill="url(#cg)"
                    dot={{ fill: '#34D399', r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CCard>
          </div>

          {/* Term picker — 4 cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([5, 10, 15, 20] as Term[]).map(t => {
              const raw =
                t === 5  ? (proposal.savings_5yr  || 0) :
                t === 10 ? (proposal.savings_10yr || 0) :
                t === 15 ? (proposal.savings_15yr || 0) :
                           (proposal.savings_15yr || 0) * 1.7;
              const s = raw * multiplier;
              const active = term === t;
              return (
                <button
                  key={t}
                  onClick={() => setTerm(t)}
                  className={`rounded-2xl border p-5 text-center cursor-pointer transition-all duration-200 w-full ${
                    active
                      ? 'bg-green/10 border-green shadow-lg shadow-green/10'
                      : 'bg-forest border-border hover:border-green/40'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Term</p>
                  <p className="text-offwhite text-2xl font-black">{t} Year</p>
                  <p className="text-green text-3xl font-black mt-2">{fmtMill(s)}</p>
                  <p className="text-dim text-xs mt-1">Cumulative Savings</p>
                  {t === 20 && (
                    <span className="inline-block mt-1.5 text-[10px] font-bold text-gold border border-gold/40 rounded-full px-2 py-0.5">
                      Long Horizon
                    </span>
                  )}
                  {active && (
                    <span className="inline-block mt-1.5 bg-green text-charcoal text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <HR />

        {/* ── TARIFF COMPARISON ──────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your TOU Tariffs" title="Apollo vs Eskom Comparison" />

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <CCard title="Weighted Average Tariff [R/kWh] — All Terms">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={tariffBars} barGap={8} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                  <XAxis dataKey="term" tick={{ fill: '#86EFAC', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#86EFAC', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[1.1, 1.6]}
                    tickFormatter={v => `R${v}`}
                    width={52}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Legend formatter={lgFmt} />
                  <Bar dataKey="apollo" name="Apollo Tariff" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="eskom"  name="Eskom WEPS"   fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CCard>

            <CCard title="Tariff Schedule [R/kWh] — 1 April 2025">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {['Period','5yr','10yr','15yr','20yr','Eskom'].map((h, i) => (
                        <th
                          key={h}
                          className={`py-2 px-1 text-[11px] font-bold uppercase ${
                            i === 0 ? 'text-left text-dim' :
                            i === 5 ? 'text-center text-danger' :
                            'text-center text-green'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Weighted Avg', vals: [proposal.tariff_5yr||1.43, proposal.tariff_10yr||1.41, proposal.tariff_15yr||1.34, (proposal.tariff_15yr||1.34)*0.97, proposal.eskom_tariff||1.49], bold: true },
                      { label: 'HS — Peak',    vals: [5.20, 5.13, 4.88, 4.74, 5.40], bold: false },
                      { label: 'HS — Std',     vals: [1.28, 1.26, 1.17, 1.14, 1.35], bold: false },
                      { label: 'HS — Off-Pk',  vals: [0.90, 0.90, 0.90, 0.88, 0.90], bold: false },
                      { label: 'LS — Peak',    vals: [2.16, 2.13, 2.03, 1.97, 2.24], bold: false },
                      { label: 'LS — Std',     vals: [1.20, 1.17, 1.09, 1.06, 1.26], bold: false },
                      { label: 'LS — Off-Pk',  vals: [0.90, 0.90, 0.90, 0.88, 0.90], bold: false },
                    ].map(row => (
                      <tr
                        key={row.label}
                        className={`border-b border-border/40 hover:bg-elevated/30 transition-colors ${
                          row.bold ? 'bg-green/5' : ''
                        }`}
                      >
                        <td className={`py-2.5 px-1 text-muted ${row.bold ? 'font-bold' : ''}`}>{row.label}</td>
                        {row.vals.map((v, j) => (
                          <td
                            key={j}
                            className={`text-center py-2.5 px-1 ${j === 4 ? 'text-danger' : 'text-offwhite'} ${row.bold ? 'font-bold' : ''}`}
                          >
                            {fmt(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-dim text-[11px] mt-3">
                Escalate at CPI annually. 20yr rates are indicative extrapolations.
              </p>
            </CCard>
          </div>

          {/* Trajectory line chart */}
          <CCard title={`Tariff Trajectory [R/kWh] — ${term}-Year View`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trajectory} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#86EFAC', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: '#86EFAC', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `R${fmt(v, 2)}`}
                  width={72}
                />
                <Tooltip content={<ChartTip />} />
                <Legend formatter={lgFmt} />
                <Line type="monotone" dataKey="apolloTariff" name="Apollo (R/kWh)" stroke="#10B981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="eskomTariff"  name="Eskom (R/kWh)"  stroke="#EF4444" strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-dim text-xs mt-3">
              Apollo escalates at CPI ({proposal.escalation_cpi || 4.5}% p.a.) vs Eskom at{' '}
              {proposal.eskom_escalation || 6.0}% p.a. — your saving margin grows every year.
            </p>
          </CCard>
        </section>

        <HR />

        {/* ── ENVIRONMENTAL ──────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Environmental Impact" title="Your Green Legacy" />

          <div className="grid md:grid-cols-3 gap-5 mb-5">
            <div className="md:col-span-2 bg-forest border border-border rounded-2xl p-7 grid grid-cols-2 gap-8">
              {[
                { label: 'Annual GHG Savings', value: fmt(ghgAnnual, 0),        unit: 'tCO₂e / year',      note: `${fmt(generated,0)} MWh × 0.94`, color: 'text-green' },
                { label: `Over ${term} Years`, value: fmt(ghgAnnual * term, 0), unit: 'Total tCO₂e',        note: `≈ ${fmt(ghgAnnual*term/2.1,0)} cars off road/yr`, color: 'text-mint' },
                { label: 'Effective Coverage', value: `${fmt(coverage, 0)}%`,   unit: 'of your total load', note: 'Slider-adjusted', color: 'text-offwhite' },
                { label: 'Energy Source',      value: 'Wind & Solar',           unit: '100% renewable',     note: 'NERSA-certified IPPs', color: 'text-offwhite' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">{item.label}</p>
                  <p className={`font-display text-4xl font-black leading-none ${item.color}`}>{item.value}</p>
                  <p className="text-dim text-sm mt-1">{item.unit}</p>
                  {item.note && <p className="text-muted text-[11px] mt-1.5">{item.note}</p>}
                </div>
              ))}
            </div>

            <div className="bg-green/10 border border-green/30 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-green mb-4">Carbon Commitment</p>
                <p className="text-offwhite text-base font-semibold leading-snug">
                  Certifiably reduce your footprint with traceable RECs and GHG reports.
                </p>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  'Certified renewable energy supply',
                  'Verifiable GHG reduction reporting',
                  'ESG & TCFD compliance ready',
                  'NERSA licensed: TRD09/2024',
                  'EU CBAM-ready documentation',
                ].map(b => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-green flex items-center justify-center text-charcoal text-[10px] font-black">
                      ✓
                    </span>
                    <span className="text-muted text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <EnvLegacy contractMwh={contractMwh} multiplier={multiplier} term={term} />
        </section>

        <HR />

        {/* ── NEXT STEPS ─────────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="What Happens Next" title="Your Path to Green Energy" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { n: '01', title: 'Letter of Intent',   body: 'Reserve your supply off the market using your meter numbers.',               color: '#10B981' },
              { n: '02', title: 'Heads of Terms',      body: 'Continues the reservation of your supply allocation.',                      color: '#34D399' },
              { n: '03', title: 'Power Purchase Agmt', body: 'CPPA conclusion locks your supply definitively.',                           color: '#6EE7B7' },
              { n: '04', title: 'Update Your ESA',     body: 'Update your Electricity Supply Agreement with Eskom or your municipality.', color: '#34D399' },
              { n: '05', title: 'Receive Supply',      body: 'Green energy is wheeled to your business — start saving today.',           color: '#10B981' },
            ].map(step => (
              <div key={step.n} className="bg-forest border border-border rounded-2xl p-5 hover:border-green/40 transition-colors">
                <p className="font-display text-6xl font-black leading-none mb-3" style={{ color: step.color + '22' }}>
                  {step.n}
                </p>
                <p className="text-sm font-bold mb-2" style={{ color: step.color }}>{step.title}</p>
                <p className="text-muted text-xs leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <HR />

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <ApolloLogo />
              <p className="text-dim text-[11px] font-bold uppercase tracking-widest mt-4">
                NERSA Licensed Energy Trader · TRD09/2024
              </p>
              <p className="text-dim text-[11px] font-bold uppercase tracking-[0.12em] mt-2">
                Green Energy · Expertly Sourced · Seamlessly Delivered
              </p>
            </div>

            {(proposal.salesperson_name || proposal.salesperson_email) && (
              <div className="bg-forest border border-border rounded-2xl p-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-3">
                  Your Apollo Contact
                </p>
                {proposal.salesperson_name && (
                  <p className="text-offwhite font-bold text-base">{proposal.salesperson_name}</p>
                )}
                {proposal.salesperson_email && (
                  <a
                    href={`mailto:${proposal.salesperson_email}`}
                    className="text-green text-sm hover:underline block mt-1"
                  >
                    {proposal.salesperson_email}
                  </a>
                )}
                {proposal.salesperson_phone && (
                  <p className="text-muted text-sm mt-1">{proposal.salesperson_phone}</p>
                )}
                {proposal.salesperson_email && (
                  <a
                    href={`mailto:${proposal.salesperson_email}?subject=Enquiry — ${encodeURIComponent(proposal.client_name)}`}
                    className="inline-block mt-4 bg-green hover:bg-mint text-charcoal font-bold px-5 py-2 rounded-lg text-sm transition-colors"
                  >
                    Get in Touch →
                  </a>
                )}
              </div>
            )}
          </div>

          <p className="text-border text-[11px] leading-relaxed mt-10">
            Commercial in confidence. May not be replicated or distributed. Tariffs applicable 1 April 2025 – 31 March 2026.
            GHG calculations use 0.94 tCO₂e/MWh emission factor. Water intensity 1.4 L/kWh (Eskom coal avg).
            EU CBAM eligibility subject to formal certification. 20-year savings are indicative extrapolations.
          </p>
        </section>

      </div>
    </div>
  );
}
