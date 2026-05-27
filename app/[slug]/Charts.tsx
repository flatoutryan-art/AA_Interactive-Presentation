'use client';

/**
 * app/[slug]/Charts.tsx
 * All Recharts components — loaded via dynamic import (ssr:false) from ProposalClient.
 *
 * v2: activeTerms prop filters which term cards / tariff rows are shown.
 *     If activeTerms = [10] only the 10yr option is displayed; term picker
 *     is hidden entirely when only one term is present.
 */

import {
  ComposedChart, AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  Cell,
} from 'recharts';
import type { TRow } from './ProposalClient';

// ─── Types ────────────────────────────────────────────────────────────────────
type Term = 5 | 10 | 15 | 20;

type Props = {
  term:             Term;
  coveragePct:      number;
  defaultCov:       number;
  monthlyChartData: Array<{ month: string; supply: number; load: number; spill: number }>;
  dayChartData:     Array<{ hour: string;  apollo: number; load: number; spill: number }>;
  traj:             TRow[];
  tariffBars:       Array<{ term: string; apollo: number; eskom: number }>;
  cpi:              number;
  esEsc:            number;
  spillMwh:         number;
  onTermChange:     (t: Term) => void;
  savings:          { s5: number; s10: number; s15: number };
  tariffs:          { t5: number; t10: number; t15: number; eskom: number };
  adjSavings:       number;
  eskomEscPct:      number;
  onEskomEscChange: (v: number) => void;
  /** Which contract terms have data in this proposal (e.g. [10] or [5,15]) */
  activeTerms:      number[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number, dp = 2): string =>
  (isNaN(n) ? 0 : n).toLocaleString('en-ZA', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

const fmtDot = (n: number, dp = 2): string =>
  (isNaN(n) ? 0 : n).toFixed(dp);

const fmtMill = (n: number): string => `R${fmt(isNaN(n) ? 0 : n, 0)}m`;

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function Tip({ active, payload, label }: {
  active?:  boolean;
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>;
  label?:   string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0F2318', border: '1px solid #1E4D30',
      borderRadius: 12, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: '#86EFAC', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map(p => {
        const isTariff = p.name.includes('R/kWh') || p.name.includes('Apollo (') || p.name.includes('Eskom (');
        const display  = isTariff
          ? `R${fmtDot(p.value, 2)}`
          : `${fmt(p.value)}${p.unit ?? ''}`;
        return (
          <p key={p.name} style={{ color: p.color, lineHeight: 1.7 }}>
            {p.name}: <strong>{display}</strong>
          </p>
        );
      })}
    </div>
  );
}

const legendFmt = (v: string) => (
  <span style={{ color: '#86EFAC', fontSize: 12 }}>{v}</span>
);

const axisProps = {
  tick:     { fill: '#86EFAC', fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
};

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-forest border border-border rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">{title}</p>
      {children}
    </div>
  );
}

function SHead({ eye, title }: { eye: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-green mb-2">{eye}</p>
      <h2 className="font-display font-black text-offwhite leading-tight text-3xl md:text-4xl">{title}</h2>
    </div>
  );
}

function HR() {
  return <div className="border-t border-border" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════
export default function Charts({
  term, coveragePct, defaultCov,
  monthlyChartData, dayChartData, traj, tariffBars,
  cpi, esEsc, spillMwh, onTermChange,
  savings, tariffs,
  adjSavings, eskomEscPct, onEskomEscChange,
  activeTerms,
}: Props) {

  // Normalise: if activeTerms is empty/missing, fall back to all three standard terms
  const validTerms: Term[] = (
    (activeTerms?.length ? activeTerms : [5, 10, 15]) as Term[]
  ).filter(t => [5, 10, 15, 20].includes(t));

  // Whether a given term has data in this proposal
  const hasTerm = (t: Term): boolean => validTerms.includes(t);

  // Savings value for a term — 0 when term is absent
  const savingsForTerm = (t: Term): number => {
    if (t === 5)  return savings.s5;
    if (t === 10) return savings.s10;
    if (t === 15) return savings.s15;
    return savings.s15 * 1.7; // 20yr extrapolation
  };

  // Spillage-aware savings scaled across available terms
  const scaledSavings = (t: Term): number => {
    const baseCurrent = savingsForTerm(term);
    const baseOther   = savingsForTerm(t);
    return baseCurrent > 0 ? adjSavings * (baseOther / baseCurrent) : adjSavings;
  };

  return (
    <>
      {/* ── MONTHLY POWER FORECAST ───────────────────────────────────────── */}
      <section className="py-14">
        <SHead eye="Your Contracted Supply" title="Monthly Power Forecast" />

        <Card title="Apollo Wheeled Supply vs Electrical Load [MWh / month]">
          <p className="text-muted text-xs mb-3 -mt-2">
            Green fill = Apollo supply. Blue line = actual customer load.
            {spillMwh > 0 && (
              <span className="text-gold"> Gold fill = spillage (supply exceeds load).</span>
            )}
          </p>
          <ResponsiveContainer width="100%" height={290}>
            <ComposedChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="spillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit=" MWh" width={72} />
              <Tooltip content={<Tip />} />
              <Legend formatter={legendFmt} wrapperStyle={{ paddingTop: 14 }} />
              <Area
                type="monotone"
                dataKey="supply"
                name="Apollo Wheeled Supply (MWh)"
                stroke="#10B981"
                strokeWidth={2.5}
                fill="url(#supplyGrad)"
                dot={false}
                activeDot={{ r: 5, fill: '#10B981' }}
              />
              {spillMwh > 0 && (
                <Area
                  type="monotone"
                  dataKey="spill"
                  name="Spillage — supply exceeds load (MWh)"
                  stroke="#C9A84C"
                  strokeWidth={1.5}
                  fill="url(#spillGrad)"
                  dot={false}
                  strokeDasharray="4 3"
                />
              )}
              <Line
                type="monotone"
                dataKey="load"
                name="Customer Electrical Load (MWh)"
                stroke="#38BDF8"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: '#38BDF8' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Monthly table */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse" style={{ fontSize: 11 }}>
            <thead>
              <tr className="border-b border-border bg-forest">
                <th className="text-left py-2.5 px-3 text-green font-bold uppercase tracking-widest whitespace-nowrap">
                  Period
                </th>
                {monthlyChartData.map(d => (
                  <th key={d.month} className="text-center py-2.5 px-1 text-muted font-semibold">
                    {d.month}
                  </th>
                ))}
                <th className="text-center py-2.5 px-3 text-green font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {([
                { label: 'Apollo Supply', key: 'supply' as const, cls: 'text-green' },
                { label: 'Elec. Load',    key: 'load'   as const, cls: 'text-offwhite' },
              ]).map(row => {
                const total = monthlyChartData.reduce((s, d) => s + d[row.key], 0);
                return (
                  <tr key={row.key} className="border-b border-border/50">
                    <td className={`py-2 px-3 font-semibold whitespace-nowrap ${row.cls}`}>
                      {row.label}
                    </td>
                    {monthlyChartData.map(d => (
                      <td key={d.month} className="text-center py-2 px-1 text-offwhite">
                        {fmt(d[row.key], 0)}
                      </td>
                    ))}
                    <td className={`text-center py-2 px-3 font-black ${row.cls}`}>
                      {fmt(total, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Day-in-the-life 24hr chart */}
        <div className="mt-5">
          <Card title="Day-in-the-Life Match — 24-Hour Cycle [MW average]">
            <p className="text-muted text-xs mb-4 -mt-2">
              Representative daily profile. Coverage slider adjusts Apollo supply curve. Hover/tap for values.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dayChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dayApolloGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="daySpillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis dataKey="hour" {...axisProps} interval={3} />
                <YAxis {...axisProps} unit=" MW" width={48} />
                <Tooltip content={<Tip />} />
                <Legend formatter={legendFmt} wrapperStyle={{ paddingTop: 12 }} />
                <Area
                  type="monotone"
                  dataKey="apollo"
                  name="Apollo Supply (MW)"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#dayApolloGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#10B981' }}
                />
                {spillMwh > 0 && (
                  <Area
                    type="monotone"
                    dataKey="spill"
                    name="Spillage"
                    stroke="#C9A84C"
                    strokeWidth={1.5}
                    fill="url(#daySpillGrad)"
                    dot={false}
                    strokeDasharray="4 2"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="load"
                  name="Eskom Load (MW)"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#38BDF8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-border text-[11px] mt-3">
              Indicative shape: wind/solar blend. Gold area appears when supply exceeds consumption.
            </p>
          </Card>
        </div>
      </section>

      <HR />

      {/* ── SAVINGS FORECAST ─────────────────────────────────────────────── */}
      <section className="py-14">
        <SHead
          eye="Your Savings Forecast"
          title={`${term}-Year Savings Projection`}
        />

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <Card title="Annual Savings [Mill ZAR / year]">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={traj} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                <XAxis
                  dataKey="year"
                  {...axisProps}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }}
                />
                <YAxis {...axisProps} unit="m" width={40} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="annual" name="Annual Saving (R mill)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Cumulative Savings [Mill ZAR]">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={traj} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34D399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34D399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis
                  dataKey="year"
                  {...axisProps}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }}
                />
                <YAxis {...axisProps} unit="m" width={40} />
                <Tooltip content={<Tip />} />
                <Area
                  type="monotone"
                  dataKey="cumul"
                  name="Cumulative Saving (R mill)"
                  stroke="#34D399"
                  strokeWidth={2.5}
                  fill="url(#cumulGrad)"
                  dot={{ fill: '#34D399', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/*
          Term picker — only renders cards for terms that have data.
          Hidden entirely when the proposal is single-term.
        */}
        {validTerms.length > 1 && (
          <div className={`grid gap-4 ${
            validTerms.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'
          }`}>
            {validTerms.map(t => {
              const s      = scaledSavings(t);
              const active = term === t;
              return (
                <button
                  key={t}
                  onClick={() => onTermChange(t)}
                  className={`rounded-2xl border p-4 text-center cursor-pointer transition-all w-full ${
                    active
                      ? 'bg-green/10 border-green'
                      : 'bg-forest border-border hover:border-green/40'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Term</p>
                  <p className="text-offwhite text-2xl font-black">{t} Year</p>
                  <p className="text-green text-2xl font-black mt-1">{fmtMill(s)}</p>
                  <p className="text-dim text-xs mt-1">Cumulative Savings</p>
                  {active && (
                    <span className="inline-block mt-1 bg-green text-charcoal text-[11px] font-bold px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Single-term badge — shown when there is only one option */}
        {validTerms.length === 1 && (
          <div className="flex items-center gap-3 mt-2 px-1">
            <div className="bg-green/10 border border-green/30 rounded-xl px-5 py-3 inline-flex items-center gap-3">
              <span className="text-green text-2xl font-black">{validTerms[0]}-Year Contract</span>
              <span className="text-muted text-sm">·</span>
              <span className="text-green font-bold">{fmtMill(adjSavings)} cumulative savings</span>
            </div>
          </div>
        )}
      </section>

      <HR />

      {/* ── TARIFF COMPARISON ────────────────────────────────────────────── */}
      <section className="py-14">
        <SHead eye="Your TOU Tariffs" title="Apollo vs Eskom Comparison" />

        <div className="grid md:grid-cols-2 gap-5 mb-5">

          {/* Tariff bar — selected term only */}
          {(() => {
            // Find the bar for the active term; fall back to first available
            const selectedBar =
              tariffBars.find(b => b.term === `${term}yr`) ??
              tariffBars.find(b => validTerms.includes(parseInt(b.term) as Term)) ??
              tariffBars[0];

            if (!selectedBar) return null;

            const barData  = [
              { label: `Apollo ${term}yr`, value: selectedBar.apollo, fill: '#10B981' },
              { label: 'Eskom WEPS',        value: selectedBar.eskom,  fill: '#EF4444' },
            ];
            const saving    = selectedBar.eskom - selectedBar.apollo;
            const savingPct = ((saving / selectedBar.eskom) * 100).toFixed(1);
            const yMin      = parseFloat((Math.min(selectedBar.apollo, selectedBar.eskom) * 0.93).toFixed(2));
            const yMax      = parseFloat((Math.max(selectedBar.apollo, selectedBar.eskom) * 1.07).toFixed(2));
            return (
              <div className="bg-forest border border-border rounded-2xl p-5 flex flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">
                  {`Weighted Average Tariff [R/kWh] — ${term}-Year Term`}
                </p>
                <div className="mb-4 p-3 rounded-xl bg-green/10 border border-green/20">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                    Apollo saving vs Eskom
                  </p>
                  <p className="text-green text-2xl font-black leading-none mt-1">
                    R{fmtDot(saving, 2)} /kWh
                    <span className="text-sm text-dim font-semibold ml-2">({savingPct}% cheaper)</span>
                  </p>
                </div>
                <div className="flex-1 min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} barGap={16} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis
                        {...axisProps}
                        domain={[yMin, yMax]}
                        tickFormatter={(v: number) => `R${fmtDot(v, 2)}`}
                        width={68}
                      />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" name="R/kWh" radius={[6, 6, 0, 0]} isAnimationActive={true}>
                        {barData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} opacity={index === 1 ? 0.75 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Tariff trajectory + Eskom escalation toggle */}
          <Card title="Tariff Trajectory — divergence over time">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={traj} margin={{ top: 4, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis
                  dataKey="year"
                  {...axisProps}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -18, fill: '#4ADE80', fontSize: 11 }}
                />
                <YAxis
                  {...axisProps}
                  domain={[
                    (dataMin: number) => parseFloat((dataMin * 0.97).toFixed(2)),
                    (dataMax: number) => parseFloat((dataMax * 1.05).toFixed(2)),
                  ]}
                  tickFormatter={(v: number) => `R${fmtDot(v, 2)}`}
                  width={68}
                />
                <Tooltip content={<Tip />} />
                <Legend
                  formatter={legendFmt}
                  wrapperStyle={{ paddingTop: 8, paddingBottom: 0 }}
                  verticalAlign="bottom"
                  align="left"
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="apollo"
                  name="Apollo (R/kWh)"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#10B981' }}
                />
                <Line
                  type="monotone"
                  dataKey="eskom"
                  name="Eskom (R/kWh)"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  dot={false}
                  strokeDasharray="5 3"
                  activeDot={{ r: 5, fill: '#EF4444' }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Eskom escalation toggle */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-muted text-[11px] font-semibold uppercase tracking-widest mb-2">
                Eskom Escalation Assumption
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[4, 6, 8, 10].map(pct => (
                  <button
                    key={pct}
                    onClick={() => onEskomEscChange(pct)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all text-center ${
                      eskomEscPct === pct
                        ? 'bg-green text-charcoal'
                        : 'bg-elevated border border-border text-muted hover:text-offwhite'
                    }`}
                  >
                    {pct}% p.a.
                  </button>
                ))}
              </div>
              <p className="text-dim text-[11px] mt-2">
                Apollo at CPI ({cpi}% p.a.) vs Eskom at {eskomEscPct}% p.a.
                {eskomEscPct > 6
                  ? ' — higher assumption shows greater long-term savings.'
                  : eskomEscPct < 6
                  ? ' — conservative assumption reduces savings forecast.'
                  : ' — the gap widens every year.'}
              </p>
            </div>
          </Card>
        </div>

        {/* Dynamic TOU tariff table — selected term only, only rendered if term has data */}
        {hasTerm(term) && (() => {
          const termData: Record<number, Array<{ label: string; apollo: number; eskom: number }>> = {
            5: [
              { label: 'Weighted Average',       apollo: tariffs.t5,        eskom: tariffs.eskom },
              { label: 'High Season — Peak',      apollo: 5.20,              eskom: 5.40 },
              { label: 'High Season — Standard',  apollo: 1.28,              eskom: 1.35 },
              { label: 'High Season — Off-Peak',  apollo: 0.90,              eskom: 0.90 },
              { label: 'Low Season — Peak',       apollo: 2.16,              eskom: 2.24 },
              { label: 'Low Season — Standard',   apollo: 1.20,              eskom: 1.26 },
              { label: 'Low Season — Off-Peak',   apollo: 0.90,              eskom: 0.90 },
            ],
            10: [
              { label: 'Weighted Average',       apollo: tariffs.t10,       eskom: tariffs.eskom },
              { label: 'High Season — Peak',      apollo: 5.13,              eskom: 5.40 },
              { label: 'High Season — Standard',  apollo: 1.26,              eskom: 1.35 },
              { label: 'High Season — Off-Peak',  apollo: 0.90,              eskom: 0.90 },
              { label: 'Low Season — Peak',       apollo: 2.13,              eskom: 2.24 },
              { label: 'Low Season — Standard',   apollo: 1.17,              eskom: 1.26 },
              { label: 'Low Season — Off-Peak',   apollo: 0.90,              eskom: 0.90 },
            ],
            15: [
              { label: 'Weighted Average',       apollo: tariffs.t15,       eskom: tariffs.eskom },
              { label: 'High Season — Peak',      apollo: 4.88,              eskom: 5.40 },
              { label: 'High Season — Standard',  apollo: 1.17,              eskom: 1.35 },
              { label: 'High Season — Off-Peak',  apollo: 0.90,              eskom: 0.90 },
              { label: 'Low Season — Peak',       apollo: 2.03,              eskom: 2.24 },
              { label: 'Low Season — Standard',   apollo: 1.09,              eskom: 1.26 },
              { label: 'Low Season — Off-Peak',   apollo: 0.90,              eskom: 0.90 },
            ],
            20: [
              { label: 'Weighted Average',       apollo: tariffs.t15 * 0.97, eskom: tariffs.eskom },
              { label: 'High Season — Peak',      apollo: 4.74,               eskom: 5.40 },
              { label: 'High Season — Standard',  apollo: 1.14,               eskom: 1.35 },
              { label: 'High Season — Off-Peak',  apollo: 0.88,               eskom: 0.90 },
              { label: 'Low Season — Peak',       apollo: 1.97,               eskom: 2.24 },
              { label: 'Low Season — Standard',   apollo: 1.06,               eskom: 1.26 },
              { label: 'Low Season — Off-Peak',   apollo: 0.88,               eskom: 0.90 },
            ],
          };
          const rows      = termData[term] ?? termData[validTerms[0]];
          const termLabel = `${term}-Year Contract`;
          return (
            <Card title={`TOU Tariff Schedule [R/kWh] — 1 April 2026 · ${termLabel}`}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: 12 }}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-2 text-[11px] font-bold uppercase text-dim">
                        Time of Use Period
                      </th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-bold uppercase text-green">
                        {termLabel}
                      </th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-bold uppercase text-danger">
                        Eskom WEPS
                      </th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-bold uppercase text-muted">
                        Saving
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const saving = row.eskom - row.apollo;
                      const isWA   = i === 0;
                      return (
                        <tr
                          key={row.label}
                          className={`border-b border-border/40 hover:bg-elevated/20 transition-colors ${
                            isWA ? 'bg-green/5' : ''
                          }`}
                        >
                          <td className={`py-2.5 px-2 text-muted ${isWA ? 'font-bold text-offwhite' : ''}`}>
                            {row.label}
                          </td>
                          <td className={`text-center py-2.5 px-3 text-green ${isWA ? 'font-bold text-lg' : ''}`}>
                            {fmt(row.apollo)}
                          </td>
                          <td className={`text-center py-2.5 px-3 text-danger ${isWA ? 'font-bold text-lg' : ''}`}>
                            {fmt(row.eskom)}
                          </td>
                          <td className={`text-center py-2.5 px-3 ${
                            saving > 0 ? 'text-green' : saving < 0 ? 'text-danger' : 'text-muted'
                          } ${isWA ? 'font-bold text-lg' : ''}`}>
                            {saving > 0 ? '-' : saving < 0 ? '+' : ''}{fmt(Math.abs(saving))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-dim text-[11px] mt-3">
                Apollo tariffs escalate at CPI annually. Eskom WEPS based on 2025 approved tariff booklet.
                {term === 20 ? ' 20-year rates are indicative extrapolations.' : ''}
              </p>
            </Card>
          );
        })()}
      </section>
    </>
  );
}
