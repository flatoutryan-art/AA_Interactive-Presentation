'use client';

/**
 * app/[slug]/page.tsx
 * Route: /steyn-city  (or any slug)
 * Depth: 2 levels → ../../lib/supabaseClient
 */

import { useEffect, useState } from 'react';
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
type Term = 5 | 10 | 15;

// ─── Number formatting ────────────────────────────────────────────────────────
const fmt = (n: number, dp = 2) =>
  n.toLocaleString('en-ZA', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtMill = (n: number) => `R${fmt(n, 0)}m`;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
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
  apollo0: number, eskom0: number,
  mwh: number, cpi: number, esEsc: number, years: number
): TRow[] {
  let a = apollo0, e = eskom0, cumul = 0;
  return Array.from({ length: years }, (_, i) => {
    const saving = ((e - a) * mwh * 1000) / 1_000_000;
    cumul += saving;
    const row = {
      year: i + 1,
      apolloTariff: parseFloat(a.toFixed(4)),
      eskomTariff:  parseFloat(e.toFixed(4)),
      annualSaving: parseFloat(saving.toFixed(3)),
      cumulativeSaving: parseFloat(cumul.toFixed(3)),
    };
    a *= 1 + cpi   / 100;
    e *= 1 + esEsc / 100;
    return row;
  });
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
function Stat({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-1 ${
      accent
        ? 'bg-green/10 border-green/40'
        : 'bg-forest border-border'
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
      <h2 className="font-display text-4xl md:text-5xl font-black text-offwhite leading-tight">{title}</h2>
    </div>
  );
}

// ─── Chart card ───────────────────────────────────────────────────────────────
function CCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-forest border border-border rounded-2xl p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">{title}</p>
      {children}
    </div>
  );
}

// ─── Logo SVG ─────────────────────────────────────────────────────────────────
function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 32 / 28)} viewBox="0 0 28 32" fill="none" aria-hidden>
      <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9"/>
      <path d="M14 6L24 28H14V6Z" fill="#10B981"/>
    </svg>
  );
}

// ─── Loading / 404 ────────────────────────────────────────────────────────────
function Loading() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-green/20 border-t-green animate-spin" />
        <p className="text-sm text-muted">Loading your proposal…</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center text-center px-4">
      <div>
        <p className="font-display text-8xl font-black text-border">404</p>
        <p className="text-offwhite text-xl font-bold mt-3">Proposal not found</p>
        <p className="text-muted text-sm mt-2">Check the URL or contact your Apollo representative.</p>
      </div>
    </div>
  );
}

// ─── Horizontal rule ──────────────────────────────────────────────────────────
function HR() {
  return <hr className="border-none border-t border-border" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ProposalPage({ params }: { params: { slug: string } }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [term,     setTerm]     = useState<Term>(5);

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

  if (loading)            return <Loading />;
  if (notFound || !proposal) return <NotFound />;

  // ── Derived from term (live recalc) ──────────────────────────────────────
  const activeTariff  = term === 5 ? proposal.tariff_5yr  : term === 10 ? proposal.tariff_10yr  : proposal.tariff_15yr;
  const activeSavings = term === 5 ? proposal.savings_5yr : term === 10 ? proposal.savings_10yr : proposal.savings_15yr;
  const activeCredit  = term === 5 ? proposal.credit_support_5yr : term === 10 ? proposal.credit_support_10yr : proposal.credit_support_15yr;

  const ghg          = proposal.contract_mwh * 0.94;
  const discount     = ((proposal.eskom_tariff - activeTariff) / proposal.eskom_tariff) * 100;

  // ── Chart data ────────────────────────────────────────────────────────────
  const trajectory = buildTrajectory(
    activeTariff, proposal.eskom_tariff,
    proposal.contract_mwh,
    proposal.escalation_cpi, proposal.eskom_escalation,
    term
  );

  const monthly = MONTH_LABELS.map((label, i) => ({
    month: label,
    supply: (proposal.monthly_supply as Record<string, number>)[MONTH_KEYS[i]] ?? 0,
    load:   (proposal.monthly_load   as Record<string, number>)[MONTH_KEYS[i]] ?? 0,
  }));

  const tariffBars = [
    { term: '5yr',  apollo: proposal.tariff_5yr,  eskom: proposal.eskom_tariff },
    { term: '10yr', apollo: proposal.tariff_10yr, eskom: proposal.eskom_tariff },
    { term: '15yr', apollo: proposal.tariff_15yr, eskom: proposal.eskom_tariff },
  ];

  const legendFmt = (v: string) => (
    <span className="text-muted text-xs">{v}</span>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-charcoal text-offwhite font-sans">

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest via-charcoal to-charcoal">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#10B981 1px, transparent 1px), linear-gradient(90deg, #10B981 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-5 pt-12 pb-20">
          {/* Nav */}
          <div className="flex items-center justify-between mb-14">
            <div className="flex items-end gap-2.5">
              <Logo size={22} />
              <div>
                <p className="font-display text-xl font-black text-offwhite leading-none tracking-tight">
                  APOLLO <span className="text-green">AFRICA</span>
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">a Reunert company</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Energy Supply Proposal</p>
              {proposal.contract_date && (
                <p className="text-xs text-dim">{fmtDate(proposal.contract_date)}</p>
              )}
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-green/10 border border-green/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
            <span className="text-green text-[11px] font-bold uppercase tracking-[0.2em]">
              Securing Renewable Energy Supply
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-black leading-[0.93] tracking-tight mb-6
                         text-[clamp(52px,10vw,96px)]">
            <span className="text-offwhite">Go Greener,</span><br />
            <span className="text-green">Pay Less.</span>
          </h1>

          <p className="text-muted text-lg max-w-xl leading-relaxed mb-6">
            Your tailored clean energy proposal for{' '}
            <strong className="text-offwhite">{proposal.client_name}</strong>.
            Certified renewable energy, expertly sourced and seamlessly delivered.
          </p>

          {proposal.supply_window_closes && (
            <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-lg px-4 py-2">
              <span className="text-gold text-[11px] font-bold uppercase tracking-widest">⚠ Supply Window Closes:</span>
              <span className="text-gold text-sm font-semibold">{fmtDate(proposal.supply_window_closes)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ STICKY TERM SELECTOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="sticky top-0 z-50 border-b border-border bg-charcoal/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 py-2.5 flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted hidden sm:block">
            Select contract term — all figures update instantly
          </p>
          <div className="flex items-center gap-1 bg-forest border border-border rounded-xl p-1">
            {([5, 10, 15] as Term[]).map(t => (
              <button
                key={t}
                onClick={() => setTerm(t)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  term === t
                    ? 'bg-green text-charcoal shadow-lg shadow-green/20'
                    : 'text-muted hover:text-offwhite hover:bg-elevated'
                }`}
              >
                {t} Year
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━ PAGE SECTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-5xl mx-auto px-5">

        {/* ── COMMERCIAL SNAPSHOT ──────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your Offer at a Glance" title="Commercial Snapshot" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="Contracted Supply"         value={`${fmt(proposal.contract_mwh, 0)} MWh`}   sub="per year"                       accent />
            <Stat label={`${term}-yr Weighted Tariff`} value={`R${fmt(activeTariff)} /kWh`}         sub={`${fmt(discount, 1)}% below Eskom`} />
            <Stat label={`${term}-yr Cum. Savings`} value={fmtMill(activeSavings)}                  sub="estimated total"                accent />
            <Stat label="Annual GHG Savings"        value={`${fmt(ghg, 0)} t`}                      sub="CO₂e per year"                       />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Green Coverage"       value={`${proposal.green_coverage_pct}%`}    sub="of your total load" />
            <Stat label="Volume Guarantee"     value={`${proposal.volume_guarantee_pct}%`}  sub="contracted supply"  />
            <Stat label="Forex Exposure"       value={`${proposal.forex_exposure_pct}%`}    sub="FX hedge component" />
            <Stat label="Buyer Credit Support" value={`R${fmt(activeCredit, 1)}m`}          sub="ZAR million"        />
          </div>
        </section>

        <HR />

        {/* ── MONTHLY POWER FORECAST ───────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your Contracted Supply" title="Monthly Power Forecast" />

          <CCard title="Apollo Wheeled Supply vs Electrical Load [MWh / month]">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis dataKey="month" tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} unit=" MWh" width={72} />
                <Tooltip content={<ChartTip />} />
                <Legend formatter={legendFmt} wrapperStyle={{ paddingTop: 14 }} />
                <Area  type="monotone" dataKey="supply" name="Apollo Wheeled Supply" stroke="#10B981" strokeWidth={2} fill="url(#sg)" dot={false} />
                <Line  type="monotone" dataKey="load"   name="Electrical Load"       stroke="#F0FFF4" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CCard>

          {/* Monthly data table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-forest">
                  <th className="text-left py-3 px-4 text-green text-[11px] font-bold uppercase tracking-widest">Period</th>
                  {MONTH_LABELS.map(m => (
                    <th key={m} className="text-center py-3 px-2 text-muted text-[11px] font-semibold">{m}</th>
                  ))}
                  <th className="text-center py-3 px-4 text-green text-[11px] font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'Apollo Supply', key: 'supply' as const, color: 'text-green' },
                  { label: 'Electrical Load', key: 'load' as const,  color: 'text-offwhite' },
                ] as const).map(row => {
                  const total = monthly.reduce((s, d) => s + d[row.key], 0);
                  return (
                    <tr key={row.key} className="border-b border-border/50 hover:bg-forest/50 transition-colors">
                      <td className={`py-3 px-4 font-semibold ${row.color}`}>{row.label}</td>
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

        {/* ── SAVINGS FORECAST ─────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your Savings Forecast" title={`${term}-Year Savings Projection`} />

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <CCard title="Annual Savings [Mill ZAR / year]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trajectory} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false}
                    label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} unit="m" width={40} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="annualSaving" name="Annual Saving (R mill)" fill="#10B981" radius={[4,4,0,0]} />
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
                  <XAxis dataKey="year" tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false}
                    label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false} unit="m" width={40} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="cumulativeSaving" name="Cumulative Saving (R mill)"
                    stroke="#34D399" strokeWidth={2.5} fill="url(#cg)" dot={{ fill: '#34D399', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CCard>
          </div>

          {/* Term picker */}
          <div className="grid grid-cols-3 gap-4">
            {([5, 10, 15] as Term[]).map(t => {
              const s = t === 5 ? proposal.savings_5yr : t === 10 ? proposal.savings_10yr : proposal.savings_15yr;
              const active = term === t;
              return (
                <button key={t} onClick={() => setTerm(t)}
                  className={`rounded-2xl border p-5 text-center cursor-pointer transition-all duration-200 w-full ${
                    active ? 'bg-green/10 border-green shadow-lg shadow-green/10' : 'bg-forest border-border hover:border-green/40'
                  }`}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Term</p>
                  <p className="text-offwhite text-2xl font-black">{t} Year</p>
                  <p className="text-green text-3xl font-black mt-2">{fmtMill(s)}</p>
                  <p className="text-dim text-xs mt-1">Cumulative Savings</p>
                  {active && (
                    <span className="inline-block mt-2 bg-green text-charcoal text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <HR />

        {/* ── TARIFF COMPARISON ────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Your TOU Tariffs" title="Apollo vs Eskom Comparison" />

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <CCard title="Weighted Average Tariff [R/kWh]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={tariffBars} barGap={8} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                  <XAxis dataKey="term" tick={{ fill: '#86EFAC', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false}
                    domain={[1.1, 1.6]} tickFormatter={v => `R${v}`} width={52} />
                  <Tooltip content={<ChartTip />} />
                  <Legend formatter={legendFmt} />
                  <Bar dataKey="apollo" name="Apollo Tariff" fill="#10B981" radius={[4,4,0,0]} />
                  <Bar dataKey="eskom"  name="Eskom WEPS"   fill="#EF4444" radius={[4,4,0,0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CCard>

            <CCard title="Tariff Schedule [R/kWh] — 1 April 2025">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {['Period','5yr','10yr','15yr','Eskom'].map((h,i) => (
                      <th key={h} className={`py-2 text-[11px] font-bold uppercase ${
                        i === 0 ? 'text-left text-dim' : i === 4 ? 'text-center text-danger' : 'text-center text-green'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Weighted Avg', vals: [proposal.tariff_5yr, proposal.tariff_10yr, proposal.tariff_15yr, proposal.eskom_tariff], bold: true },
                    { label: 'HS — Peak',    vals: [5.20, 5.13, 4.88, 5.40], bold: false },
                    { label: 'HS — Std',     vals: [1.28, 1.26, 1.17, 1.35], bold: false },
                    { label: 'HS — Off-Pk', vals: [0.90, 0.90, 0.90, 0.90], bold: false },
                    { label: 'LS — Peak',    vals: [2.16, 2.13, 2.03, 2.24], bold: false },
                    { label: 'LS — Std',     vals: [1.20, 1.17, 1.09, 1.26], bold: false },
                    { label: 'LS — Off-Pk', vals: [0.90, 0.90, 0.90, 0.90], bold: false },
                  ].map(row => (
                    <tr key={row.label}
                      className={`border-b border-border/40 hover:bg-elevated/30 transition-colors ${row.bold ? 'bg-green/5' : ''}`}>
                      <td className={`py-2.5 text-muted ${row.bold ? 'font-bold' : ''}`}>{row.label}</td>
                      {row.vals.map((v, j) => (
                        <td key={j} className={`text-center py-2.5 ${j === 3 ? 'text-danger' : 'text-offwhite'} ${row.bold ? 'font-bold' : ''}`}>
                          {fmt(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-dim text-[11px] mt-3">Escalate at CPI annually. Applicable 1 Apr 2025 – 31 Mar 2026.</p>
            </CCard>
          </div>

          {/* Trajectory line chart */}
          <CCard title={`Tariff Trajectory [R/kWh] — ${term}-Year View`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trajectory} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis dataKey="year" tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }} />
                <YAxis tick={{ fill: '#86EFAC', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `R${fmt(v,2)}`} width={72} />
                <Tooltip content={<ChartTip />} />
                <Legend formatter={legendFmt} />
                <Line type="monotone" dataKey="apolloTariff" name="Apollo (R/kWh)" stroke="#10B981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="eskomTariff"  name="Eskom (R/kWh)"  stroke="#EF4444" strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-dim text-xs mt-3">
              Apollo escalates at CPI ({proposal.escalation_cpi}% p.a.) vs Eskom at {proposal.eskom_escalation}% p.a. — your saving margin grows every year.
            </p>
          </CCard>
        </section>

        <HR />

        {/* ── ENVIRONMENTAL ────────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="Environmental Impact" title="Your Green Credentials" />

          <div className="grid md:grid-cols-3 gap-5">
            {/* Metrics grid */}
            <div className="md:col-span-2 bg-forest border border-border rounded-2xl p-7 grid grid-cols-2 gap-8">
              {[
                { label: 'Annual GHG Savings',   value: fmt(ghg, 0),             unit: 'Tons CO₂e / yr',     note: `${fmt(proposal.contract_mwh,0)} MWh × 0.94`, color: 'text-green' },
                { label: `Over ${term} Years`,   value: fmt(ghg * term, 0),      unit: 'Total tons CO₂e',    note: `≈ ${fmt(ghg*term/2.1,0)} cars off road/yr`, color: 'text-mint' },
                { label: 'Green Coverage',       value: `${proposal.green_coverage_pct}%`, unit: 'of your total load', note: '', color: 'text-offwhite' },
                { label: 'Energy Source',        value: 'Wind & Solar',          unit: '100% renewable IPPs', note: '', color: 'text-offwhite' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">{item.label}</p>
                  <p className={`font-display text-4xl font-black leading-none ${item.color}`}>{item.value}</p>
                  <p className="text-dim text-sm mt-1">{item.unit}</p>
                  {item.note && <p className="text-muted text-[11px] mt-1.5">{item.note}</p>}
                </div>
              ))}
            </div>

            {/* Commitment card */}
            <div className="bg-green/10 border border-green/30 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-green mb-4">Carbon Commitment</p>
                <p className="text-offwhite text-base font-semibold leading-snug">
                  Certifiably reduce your footprint with traceable green energy certificates.
                </p>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  'Certified renewable energy',
                  'Verifiable GHG reduction reporting',
                  'ESG compliance ready',
                  'NERSA licensed trader TRD09/2024',
                ].map(b => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-green flex items-center justify-center text-charcoal text-[10px] font-black">✓</span>
                    <span className="text-muted text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <HR />

        {/* ── NEXT STEPS ───────────────────────────────────────────────────── */}
        <section className="py-16">
          <SHead eye="What Happens Next" title="Your Path to Green Energy" />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { n:'01', title:'Letter of Intent',     body:'Reserve your supply off the market using your meter numbers.',                   c:'#10B981' },
              { n:'02', title:'Heads of Terms',        body:'Continues the reservation of your supply allocation.',                          c:'#34D399' },
              { n:'03', title:'Power Purchase Agmt',  body:'CPPA conclusion locks your supply definitively.',                               c:'#6EE7B7' },
              { n:'04', title:'Update Your ESA',       body:'Update your Electricity Supply Agreement with Eskom or your municipality.',     c:'#34D399' },
              { n:'05', title:'Receive Supply',        body:'Green energy is wheeled to your business — start saving today.',               c:'#10B981' },
            ].map(step => (
              <div key={step.n} className="bg-forest border border-border rounded-2xl p-5 hover:border-green/40 transition-colors">
                <p className="font-display text-6xl font-black leading-none mb-3" style={{ color: step.c + '22' }}>{step.n}</p>
                <p className="text-sm font-bold mb-2" style={{ color: step.c }}>{step.title}</p>
                <p className="text-muted text-xs leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <HR />

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-end gap-2.5 mb-4">
                <Logo size={20} />
                <div>
                  <p className="font-display text-lg font-black text-offwhite leading-none">
                    APOLLO <span className="text-green">AFRICA</span>
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">a Reunert company</p>
                </div>
              </div>
              <p className="text-dim text-[11px] font-bold uppercase tracking-widest">NERSA Licensed Energy Trader · TRD09/2024</p>
              <p className="text-dim text-[11px] font-bold uppercase tracking-[0.12em] mt-2">
                Green Energy · Expertly Sourced · Seamlessly Delivered
              </p>
            </div>

            {(proposal.salesperson_name || proposal.salesperson_email) && (
              <div className="bg-forest border border-border rounded-2xl p-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-3">Your Apollo Contact</p>
                {proposal.salesperson_name  && <p className="text-offwhite font-bold text-base">{proposal.salesperson_name}</p>}
                {proposal.salesperson_email && (
                  <a href={`mailto:${proposal.salesperson_email}`}
                     className="text-green text-sm hover:underline block mt-1">{proposal.salesperson_email}</a>
                )}
                {proposal.salesperson_phone && <p className="text-muted text-sm mt-1">{proposal.salesperson_phone}</p>}
                {proposal.salesperson_email && (
                  <a href={`mailto:${proposal.salesperson_email}?subject=Enquiry — ${encodeURIComponent(proposal.client_name)}`}
                     className="inline-block mt-4 bg-green hover:bg-mint text-charcoal font-bold
                                px-5 py-2 rounded-lg text-sm transition-colors">
                    Get in Touch →
                  </a>
                )}
              </div>
            )}
          </div>

          <p className="text-border text-[11px] leading-relaxed mt-10">
            Commercial in confidence. May not be replicated or distributed. Tariffs applicable
            1 April 2025 – 31 March 2026 and escalate annually by CPI. Based on the 2025 approved
            Eskom Retail Tariff Plan and Eskom approved MYPD 6 annual increases.
          </p>
        </section>

      </div>
    </div>
  );
}
