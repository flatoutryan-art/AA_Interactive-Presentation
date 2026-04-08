'use client';

/**
 * Apollo Africa — Client Proposal View
 * Route: /[slug]  (app/[slug]/page.tsx)
 *
 * Depth from project root: 2 levels  →  lib is at ../../lib/supabaseClient
 */

import { useEffect, useState } from 'react';
import {
  supabase,
  MONTH_KEYS,
  MONTH_LABELS,
} from '../lib/supabaseClient';
import type { Proposal } from '../lib/supabaseClient';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────
type Term = 5 | 10 | 15;

// ─── Formatting helpers ───────────────────────────────────────────────────────
function fmt(n: number, dp = 2): string {
  return n.toLocaleString('en-ZA', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}
function fmtMill(n: number): string {
  return `R${fmt(n, 0)}m`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Savings trajectory builder ───────────────────────────────────────────────
type TrajectoryRow = {
  year:             number;
  apolloTariff:     number;
  eskomTariff:      number;
  annualSaving:     number;
  cumulativeSaving: number;
};

function buildTrajectory(
  startApollo:      number,
  startEskom:       number,
  contractMwh:      number,
  cpiPct:           number,
  eskomPct:         number,
  years:            number
): TrajectoryRow[] {
  const rows: TrajectoryRow[] = [];
  let apollo = startApollo;
  let eskom  = startEskom;
  let cumul  = 0;

  for (let y = 1; y <= years; y++) {
    // Annual saving in Mill ZAR  (R/kWh × MWh × 1000 kWh/MWh ÷ 1 000 000)
    const saving = (eskom - apollo) * contractMwh * 1000 / 1_000_000;
    cumul += saving;

    rows.push({
      year:             y,
      apolloTariff:     parseFloat(apollo.toFixed(4)),
      eskomTariff:      parseFloat(eskom.toFixed(4)),
      annualSaving:     parseFloat(saving.toFixed(3)),
      cumulativeSaving: parseFloat(cumul.toFixed(3)),
    });

    apollo *= 1 + cpiPct  / 100;
    eskom  *= 1 + eskomPct / 100;
  }
  return rows;
}

// ─── Custom recharts tooltip ─────────────────────────────────────────────────
function ApTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F2318] border border-[#1E4D30] rounded-xl px-4 py-3 text-xs shadow-xl">
      <p className="text-[#86EFAC] font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="leading-5">
          {p.name}:{' '}
          <span className="font-bold">
            {typeof p.value === 'number' ? fmt(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Reusable UI components ──────────────────────────────────────────────────
function StatCard({
  label, value, sub, accent = false,
}: {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-1 ${
        accent
          ? 'bg-[#10B981]/10 border-[#10B981]/40'
          : 'bg-[#0F2318] border-[#1E4D30]'
      }`}
    >
      <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest">
        {label}
      </p>
      <p className={`text-2xl font-black leading-none ${accent ? 'text-[#10B981]' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-[#4ADE80] text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-[#10B981] text-xs font-bold uppercase tracking-[0.25em] mb-2">
        {eyebrow}
      </p>
      <h2 className="text-4xl font-black text-white leading-tight tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function ApolloLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const w = size === 'lg' ? 32 : size === 'md' ? 24 : 18;
  const h = Math.round(w * 32 / 28);
  return (
    <svg width={w} height={h} viewBox="0 0 28 32" fill="none" aria-hidden="true">
      <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9" />
      <path d="M14 6L24 28H14V6Z" fill="#10B981" />
    </svg>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0D1B14] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#10B981]/20 border-t-[#10B981] rounded-full animate-spin" />
        <p className="text-[#86EFAC] text-sm">Loading your proposal…</p>
      </div>
    </div>
  );
}

// ─── 404 screen ───────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen bg-[#0D1B14] flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-8xl font-black text-[#1E4D30]">404</p>
        <p className="text-white text-xl font-bold">Proposal not found</p>
        <p className="text-[#86EFAC] text-sm">
          Check the URL or contact your Apollo sales representative.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProposalPage({
  params,
}: {
  params: { slug: string };
}) {
  const [proposal,  setProposal]  = useState<Proposal | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [term,      setTerm]      = useState<Term>(5);

  // ── Fetch from Supabase
  useEffect(() => {
    supabase
      .from('proposals')
      .select('*')
      .eq('slug', params.slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setProposal(data as Proposal);
        }
        setLoading(false);
      });
  }, [params.slug]);

  if (loading)  return <LoadingScreen />;
  if (notFound || !proposal) return <NotFound />;

  // ── Derive values from selected term ──────────────────────────────────────
  const activeTariff: number =
    term === 5  ? proposal.tariff_5yr  :
    term === 10 ? proposal.tariff_10yr :
                  proposal.tariff_15yr;

  const activeSavings: number =
    term === 5  ? proposal.savings_5yr  :
    term === 10 ? proposal.savings_10yr :
                  proposal.savings_15yr;

  const activeCredit: number =
    term === 5  ? proposal.credit_support_5yr  :
    term === 10 ? proposal.credit_support_10yr :
                  proposal.credit_support_15yr;

  const ghgSavings    = proposal.contract_mwh * 0.94;         // Tons CO₂e/yr
  const tariffDiscount = (proposal.eskom_tariff - activeTariff)
                        / proposal.eskom_tariff * 100;

  // ── Build chart datasets
  const trajectory = buildTrajectory(
    activeTariff,
    proposal.eskom_tariff,
    proposal.contract_mwh,
    proposal.escalation_cpi,
    proposal.eskom_escalation,
    term
  );

  const monthlyData = MONTH_LABELS.map((label, i) => ({
    month:  label,
    supply: (proposal.monthly_supply as Record<string, number>)[MONTH_KEYS[i]] ?? 0,
    load:   (proposal.monthly_load   as Record<string, number>)[MONTH_KEYS[i]] ?? 0,
  }));

  const tariffCompareData = [
    { term: '5yr',  apollo: proposal.tariff_5yr,  eskom: proposal.eskom_tariff },
    { term: '10yr', apollo: proposal.tariff_10yr, eskom: proposal.eskom_tariff },
    { term: '15yr', apollo: proposal.tariff_15yr, eskom: proposal.eskom_tariff },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0D1B14] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ════════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Background atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2318] via-[#0D1B14] to-[#0D1B14]" />
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[#10B981]/5
                        rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#10B981]/3
                        rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#10B981 1px, transparent 1px), linear-gradient(90deg, #10B981 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-20">

          {/* Top nav */}
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-end gap-2">
              <ApolloLogo size="md" />
              <div>
                <p className="text-white text-xl font-black tracking-tight leading-none">
                  APOLLO <span className="text-[#10B981]">AFRICA</span>
                </p>
                <p className="text-[#C9A84C] text-[9px] font-bold uppercase tracking-[0.25em]">
                  a Reunert company
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[#86EFAC] text-xs">Energy Supply Proposal</p>
              {proposal.contract_date && (
                <p className="text-[#4ADE80] text-xs">{fmtDate(proposal.contract_date)}</p>
              )}
            </div>
          </div>

          {/* Hero headline */}
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/30
                            rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
              <span className="text-[#10B981] text-xs font-semibold uppercase tracking-widest">
                Securing Renewable Energy Supply
              </span>
            </div>

            <h1
              className="text-6xl md:text-8xl font-black leading-[0.92] tracking-tight mb-6"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              <span className="text-white">Go Greener,</span>
              <br />
              <span className="text-[#10B981]">Pay Less.</span>
            </h1>

            <p className="text-[#86EFAC] text-xl max-w-2xl leading-relaxed mb-6">
              Your tailored clean energy proposal for{' '}
              <span className="text-white font-semibold">{proposal.client_name}</span>.
              Certified renewable energy, expertly sourced and seamlessly delivered.
            </p>

            {proposal.supply_window_closes && (
              <div className="inline-flex items-center gap-2 bg-[#C9A84C]/10
                              border border-[#C9A84C]/30 rounded-lg px-4 py-2">
                <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest">
                  ⚠ Supply Window Closes:
                </span>
                <span className="text-[#C9A84C] text-sm font-semibold">
                  {fmtDate(proposal.supply_window_closes)}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          STICKY TERM SELECTOR
      ════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 bg-[#0D1B14]/90 backdrop-blur-sm border-b border-[#1E4D30]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest hidden sm:block">
            Select contract term — all figures update instantly
          </p>
          <div className="flex items-center gap-1 bg-[#0F2318] border border-[#1E4D30] rounded-xl p-1">
            {([5, 10, 15] as Term[]).map((t) => (
              <button
                key={t}
                onClick={() => setTerm(t)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  term === t
                    ? 'bg-[#10B981] text-[#0D1B14] shadow-lg shadow-[#10B981]/20'
                    : 'text-[#86EFAC] hover:text-white hover:bg-[#1A3A28]'
                }`}
              >
                {t} Year
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          PAGE BODY
      ════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6">

        {/* ── SNAPSHOT STATS ─────────────────────────────────────────────── */}
        <section className="py-16">
          <SectionHead eyebrow="Your Offer at a Glance" title="Commercial Snapshot" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Contracted Supply"
              value={`${fmt(proposal.contract_mwh, 0)} MWh`}
              sub="per year"
              accent
            />
            <StatCard
              label={`${term}-yr Weighted Tariff`}
              value={`R${fmt(activeTariff)} /kWh`}
              sub={`${fmt(tariffDiscount, 1)}% below Eskom`}
            />
            <StatCard
              label={`${term}-yr Cumulative Savings`}
              value={fmtMill(activeSavings)}
              sub="estimated total"
              accent
            />
            <StatCard
              label="Annual GHG Savings"
              value={`${fmt(ghgSavings, 0)} t`}
              sub="CO₂e per year"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Green Coverage"      value={`${proposal.green_coverage_pct}%`} sub="of total load" />
            <StatCard label="Volume Guarantee"    value={`${proposal.volume_guarantee_pct}%`} sub="contracted supply" />
            <StatCard label="Forex Exposure"      value={`${proposal.forex_exposure_pct}%`} sub="FX hedge component" />
            <StatCard label="Buyer Credit Support" value={`R${fmt(activeCredit, 1)}m`} sub="ZAR million" />
          </div>
        </section>

        {/* ── MONTHLY POWER FORECAST ─────────────────────────────────────── */}
        <section className="py-16 border-t border-[#1E4D30]">
          <SectionHead eyebrow="Your Contracted Supply" title="Monthly Power Forecast" />

          <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-6">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis dataKey="month" tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#86EFAC', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" MWh"
                  width={72}
                />
                <Tooltip content={<ApTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 16 }}
                  formatter={(v) => <span style={{ color: '#86EFAC', fontSize: 12 }}>{v}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="supply"
                  name="Apollo Wheeled Supply"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#supplyGrad)"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="load"
                  name="Electrical Load"
                  stroke="#F0FFF4"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1E4D30]">
                  <th className="text-left py-3 px-3 text-[#10B981] text-xs font-bold uppercase tracking-widest">
                    Period
                  </th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="text-center py-3 px-2 text-[#86EFAC] text-xs font-semibold">
                      {m}
                    </th>
                  ))}
                  <th className="text-center py-3 px-3 text-[#10B981] text-xs font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Apollo Supply', key: 'supply' as const, color: '#10B981' },
                  { label: 'Electrical Load', key: 'load' as const, color: '#F0FFF4' },
                ].map((row) => {
                  const total = monthlyData.reduce((s, d) => s + d[row.key], 0);
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-[#1E4D30]/50 hover:bg-[#0F2318] transition-colors"
                    >
                      <td className="py-3 px-3 text-xs font-semibold" style={{ color: row.color }}>
                        {row.label}
                      </td>
                      {monthlyData.map((d) => (
                        <td key={d.month} className="text-center py-3 px-2 text-white text-xs">
                          {fmt(d[row.key], 0)}
                        </td>
                      ))}
                      <td className="text-center py-3 px-3 font-black text-sm" style={{ color: row.color }}>
                        {fmt(total, 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SAVINGS FORECAST ───────────────────────────────────────────── */}
        <section className="py-16 border-t border-[#1E4D30]">
          <SectionHead eyebrow="Your Savings Forecast" title={`${term}-Year Savings Projection`} />

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-6">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-4">
                Annual Savings [Mill ZAR / year]
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trajectory} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
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
                    unit="m"
                    width={45}
                  />
                  <Tooltip content={<ApTooltip />} />
                  <Bar dataKey="annualSaving" name="Annual Saving (R mill)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-6">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-4">
                Cumulative Savings [Mill ZAR]
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trajectory} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
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
                  <YAxis
                    tick={{ fill: '#86EFAC', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                    width={45}
                  />
                  <Tooltip content={<ApTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cumulativeSaving"
                    name="Cumulative Saving (R mill)"
                    stroke="#34D399"
                    strokeWidth={2.5}
                    fill="url(#cumGrad)"
                    dot={{ fill: '#34D399', r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Term selection cards */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            {([5, 10, 15] as Term[]).map((t) => {
              const s =
                t === 5  ? proposal.savings_5yr  :
                t === 10 ? proposal.savings_10yr :
                           proposal.savings_15yr;
              const selected = term === t;
              return (
                <button
                  key={t}
                  onClick={() => setTerm(t)}
                  className={`rounded-2xl border p-5 text-center transition-all duration-200 cursor-pointer w-full ${
                    selected
                      ? 'bg-[#10B981]/10 border-[#10B981] shadow-lg shadow-[#10B981]/10'
                      : 'bg-[#0F2318] border-[#1E4D30] hover:border-[#10B981]/40'
                  }`}
                >
                  <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-1">Term</p>
                  <p className="text-white text-2xl font-black">{t} Year</p>
                  <p className="text-[#10B981] text-3xl font-black mt-2">{fmtMill(s)}</p>
                  <p className="text-[#4ADE80] text-xs mt-1">Cumulative Savings</p>
                  {selected && (
                    <span className="inline-block mt-2 bg-[#10B981] text-[#0D1B14]
                                     text-xs font-bold px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── TARIFF COMPARISON ──────────────────────────────────────────── */}
        <section className="py-16 border-t border-[#1E4D30]">
          <SectionHead eyebrow="Your TOU Tariffs" title="Apollo vs Eskom Comparison" />

          <div className="grid md:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-6">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-4">
                Weighted Average Tariff [R/kWh]
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={tariffCompareData} barGap={8} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                  <XAxis dataKey="term" tick={{ fill: '#86EFAC', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#86EFAC', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[1.1, 1.6]}
                    tickFormatter={(v) => `R${v}`}
                    width={52}
                  />
                  <Tooltip content={<ApTooltip />} />
                  <Legend formatter={(v) => <span style={{ color: '#86EFAC', fontSize: 12 }}>{v}</span>} />
                  <Bar dataKey="apollo" name="Apollo Tariff"  fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="eskom"  name="Eskom WEPS"     fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tariff schedule table */}
            <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-6">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-4">
                Tariff Schedule [R/kWh] — 1 April 2025
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E4D30]">
                    <th className="text-left   py-2 text-[#4ADE80] text-xs font-bold">Period</th>
                    <th className="text-center py-2 text-[#10B981] text-xs font-bold">5yr</th>
                    <th className="text-center py-2 text-[#10B981] text-xs font-bold">10yr</th>
                    <th className="text-center py-2 text-[#10B981] text-xs font-bold">15yr</th>
                    <th className="text-center py-2 text-[#EF4444] text-xs font-bold">Eskom</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Weighted Average',      vals: [proposal.tariff_5yr, proposal.tariff_10yr, proposal.tariff_15yr, proposal.eskom_tariff], bold: true },
                    { label: 'High Season — Peak',    vals: [5.20, 5.13, 4.88, 5.40], bold: false },
                    { label: 'High Season — Std',     vals: [1.28, 1.26, 1.17, 1.35], bold: false },
                    { label: 'High Season — Off-Peak',vals: [0.90, 0.90, 0.90, 0.90], bold: false },
                    { label: 'Low Season — Peak',     vals: [2.16, 2.13, 2.03, 2.24], bold: false },
                    { label: 'Low Season — Std',      vals: [1.20, 1.17, 1.09, 1.26], bold: false },
                    { label: 'Low Season — Off-Peak', vals: [0.90, 0.90, 0.90, 0.90], bold: false },
                  ].map((row) => (
                    <tr
                      key={row.label}
                      className={`border-b border-[#1E4D30]/40 hover:bg-[#1A3A28]/30 transition-colors ${
                        row.bold ? 'bg-[#10B981]/5 font-bold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-1 text-[#86EFAC] text-xs">{row.label}</td>
                      {row.vals.map((v, j) => (
                        <td
                          key={j}
                          className={`text-center py-2.5 text-xs ${j === 3 ? 'text-[#EF4444]' : 'text-white'}`}
                        >
                          {fmt(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[#4ADE80] text-xs mt-3">
                Tariffs escalate at CPI annually. Applicable 1 April 2025 – 31 March 2026.
              </p>
            </div>
          </div>

          {/* Tariff trajectory line chart */}
          <div className="mt-6 bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-6">
            <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-4">
              Tariff Trajectory [R/kWh] — {term}-Year View
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trajectory} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
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
                  tickFormatter={(v) => `R${fmt(v, 2)}`}
                  width={72}
                />
                <Tooltip content={<ApTooltip />} />
                <Legend formatter={(v) => <span style={{ color: '#86EFAC', fontSize: 12 }}>{v}</span>} />
                <Line
                  type="monotone"
                  dataKey="apolloTariff"
                  name="Apollo (R/kWh)"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="eskomTariff"
                  name="Eskom (R/kWh)"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  dot={false}
                  strokeDasharray="5 3"
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[#4ADE80] text-xs mt-3">
              Apollo escalates at CPI ({proposal.escalation_cpi}% p.a.) vs Eskom at{' '}
              {proposal.eskom_escalation}% p.a. — your saving margin grows every year.
            </p>
          </div>
        </section>

        {/* ── ENVIRONMENTAL IMPACT ───────────────────────────────────────── */}
        <section className="py-16 border-t border-[#1E4D30]">
          <SectionHead eyebrow="Environmental Impact" title="Your Green Credentials" />

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-2">
                    Annual GHG Savings
                  </p>
                  <p className="text-5xl font-black text-[#10B981] leading-none">
                    {fmt(ghgSavings, 0)}
                  </p>
                  <p className="text-[#4ADE80] text-sm mt-1">Tons CO₂e per year</p>
                  <p className="text-[#86EFAC] text-xs mt-3">
                    {fmt(proposal.contract_mwh, 0)} MWh × 0.94 = {fmt(ghgSavings, 0)} tCO₂e
                  </p>
                </div>

                <div>
                  <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-2">
                    Over {term} Years
                  </p>
                  <p className="text-5xl font-black text-[#34D399] leading-none">
                    {fmt(ghgSavings * term, 0)}
                  </p>
                  <p className="text-[#4ADE80] text-sm mt-1">Total tons CO₂e avoided</p>
                  <p className="text-[#86EFAC] text-xs mt-3">
                    ≈ {fmt(ghgSavings * term / 2.1, 0)} cars removed from roads/yr
                  </p>
                </div>

                <div>
                  <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-2">
                    Green Coverage
                  </p>
                  <p className="text-5xl font-black text-white leading-none">
                    {proposal.green_coverage_pct}%
                  </p>
                  <p className="text-[#4ADE80] text-sm mt-1">of your total load</p>
                </div>

                <div>
                  <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-widest mb-2">
                    Energy Source
                  </p>
                  <p className="text-2xl font-black text-white leading-tight">
                    Wind &<br />Solar IPPs
                  </p>
                  <p className="text-[#4ADE80] text-sm mt-1">100% renewable</p>
                </div>
              </div>
            </div>

            <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-[#10B981] text-xs font-bold uppercase tracking-widest mb-4">
                  Carbon Commitment
                </p>
                <p className="text-white text-lg font-semibold leading-snug">
                  Certifiably reduce your footprint with traceable green energy certificates.
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  'Certified renewable energy',
                  'Verifiable GHG reduction reporting',
                  'ESG compliance ready',
                  'NERSA licensed trader (TRD09/2024)',
                ].map((b) => (
                  <div key={b} className="flex items-start gap-2">
                    <span className="mt-0.5 w-4 h-4 bg-[#10B981] rounded-full flex items-center
                                     justify-center text-[#0D1B14] text-xs font-black flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-[#86EFAC] text-sm">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── NEXT STEPS ─────────────────────────────────────────────────── */}
        <section className="py-16 border-t border-[#1E4D30]">
          <SectionHead eyebrow="What Happens Next" title="Your Path to Green Energy" />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { n: '01', title: 'Letter of Intent',      body: 'Utilise your meter numbers to reserve your supply off the market.',   color: '#10B981' },
              { n: '02', title: 'Heads of Terms',         body: 'Continues the reservation of your supply allocation.',                color: '#34D399' },
              { n: '03', title: 'Power Purchase Agmt',   body: 'CPPA conclusion locks your supply definitively.',                     color: '#6EE7B7' },
              { n: '04', title: 'Update Your ESA',        body: 'Update your Electricity Supply Agreement with Eskom or municipality.',color: '#34D399' },
              { n: '05', title: 'Receive Your Supply',    body: 'Green energy is wheeled to your business — start saving today.',      color: '#10B981' },
            ].map((step) => (
              <div
                key={step.n}
                className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-5
                           hover:border-[#10B981]/40 transition-colors"
              >
                <p className="text-6xl font-black leading-none mb-3" style={{ color: step.color + '22' }}>
                  {step.n}
                </p>
                <p className="font-bold text-sm mb-2" style={{ color: step.color }}>
                  {step.title}
                </p>
                <p className="text-[#86EFAC] text-xs leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER / CONTACT ───────────────────────────────────────────── */}
        <section className="py-16 border-t border-[#1E4D30]">
          <div className="grid md:grid-cols-2 gap-8 items-center">

            <div>
              <div className="flex items-end gap-2 mb-4">
                <ApolloLogo size="sm" />
                <div>
                  <p className="text-white text-lg font-black tracking-tight leading-none">
                    APOLLO <span className="text-[#10B981]">AFRICA</span>
                  </p>
                  <p className="text-[#C9A84C] text-[9px] font-bold uppercase tracking-[0.25em]">
                    a Reunert company
                  </p>
                </div>
              </div>
              <p className="text-[#4ADE80] text-xs font-bold uppercase tracking-widest mb-1">
                NERSA Licensed Energy Trader
              </p>
              <p className="text-[#86EFAC] text-xs">NERSA/TRD09/2024</p>
              <p className="text-[#4ADE80] text-xs mt-4 font-bold uppercase tracking-[0.15em]">
                Green Energy · Expertly Sourced · Seamlessly Delivered
              </p>
            </div>

            {(proposal.salesperson_name || proposal.salesperson_email) && (
              <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-6">
                <p className="text-[#10B981] text-xs font-bold uppercase tracking-widest mb-3">
                  Your Apollo Contact
                </p>
                {proposal.salesperson_name && (
                  <p className="text-white font-bold text-base">{proposal.salesperson_name}</p>
                )}
                {proposal.salesperson_email && (
                  <a
                    href={`mailto:${proposal.salesperson_email}?subject=Proposal%20Enquiry%20—%20${encodeURIComponent(proposal.client_name)}`}
                    className="text-[#10B981] text-sm hover:underline block mt-1"
                  >
                    {proposal.salesperson_email}
                  </a>
                )}
                {proposal.salesperson_phone && (
                  <p className="text-[#86EFAC] text-sm mt-1">{proposal.salesperson_phone}</p>
                )}
                {proposal.salesperson_email && (
                  <a
                    href={`mailto:${proposal.salesperson_email}?subject=Proposal%20Enquiry%20—%20${encodeURIComponent(proposal.client_name)}`}
                    className="inline-block mt-4 bg-[#10B981] hover:bg-[#34D399] text-[#0D1B14]
                               font-bold px-5 py-2 rounded-lg text-sm transition-colors"
                  >
                    Get in Touch →
                  </a>
                )}
              </div>
            )}
          </div>

          <p className="text-[#1E4D30] text-xs mt-10 leading-relaxed">
            Commercial in confidence. May not be replicated or distributed. This offer is valid as
            indicated above. Tariffs applicable 1 April 2025 – 31 March 2026 and are subject to
            annual CPI escalation thereafter. Based on the 2025 approved Eskom Retail Tariff Plan
            and Eskom approved MYPD 6 annual increases.
          </p>
        </section>

      </div>
    </div>
  );
}
