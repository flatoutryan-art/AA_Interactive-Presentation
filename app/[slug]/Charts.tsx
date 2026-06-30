'use client';

/**
 * app/[slug]/Charts.tsx
 * Loaded via dynamic import (ssr:false) from ProposalClient.
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
import type { TouBreakdown } from '../../lib/supabaseClient';

type Term = 5 | 10 | 15;

type Props = {
  term:             Term;
  availableTerms:   Term[];
  coveragePct:      number;
  defaultCov:       number;
  monthlyChartData: Array<{ month: string; supply: number; load: number; spill: number }>;
  dayChartData:     Array<{ hour: string;  apollo: number; load: number; spill: number }>;
  traj:             TRow[];
  tariffBars:       Array<{ term: string; apollo: number; eskom: number }>;
  cpi:              number;
  esEsc:            number;
  eskomEscPct:      number;
  spillMwh:         number;
  onTermChange:     (t: number) => void;
  onEskomEscChange: (v: number) => void;
  savings:          { s5: number; s10: number; s15: number };
  tariffs:          { t5: number; t10: number; t15: number; eskom: number };
  adjSavings:       number;
  activeTou:        TouBreakdown | null;
};

const fmt = (n: number, dp = 2): string =>
  (isNaN(n) ? 0 : n).toLocaleString('en-ZA', {
    minimumFractionDigits: dp, maximumFractionDigits: dp,
  });

const fmtDot = (n: number, dp = 2): string => (isNaN(n) ? 0 : n).toFixed(dp);
const fmtMill = (n: number): string => `R${fmt(isNaN(n) ? 0 : n, 0)}m`;

function Tip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
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
        return (
          <p key={p.name} style={{ color: p.color, lineHeight: 1.7 }}>
            {p.name}: <strong>{isTariff ? `R${fmtDot(p.value, 2)}` : fmt(p.value)}</strong>
          </p>
        );
      })}
    </div>
  );
}

const lgFmt = (v: string) => <span style={{ color: '#86EFAC', fontSize: 12 }}>{v}</span>;
const ax = {
  tick: { fill: '#86EFAC', fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
};

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

function HR() { return <div className="border-t border-border" />; }

const TOU_LABELS: Array<{ key: keyof TouBreakdown; label: string }> = [
  { key: 'weighted_avg', label: 'Weighted Average'        },
  { key: 'hs_peak',      label: 'High Season — Peak'      },
  { key: 'hs_std',       label: 'High Season — Standard'  },
  { key: 'hs_offpeak',   label: 'High Season — Off-Peak'  },
  { key: 'ls_peak',      label: 'Low Season — Peak'       },
  { key: 'ls_std',       label: 'Low Season — Standard'   },
  { key: 'ls_offpeak',   label: 'Low Season — Off-Peak'   },
];

const ESKOM_REF: Record<keyof TouBreakdown, number> = {
  hs_peak:     5.40,
  hs_std:      1.35,
  hs_offpeak:  0.90,
  ls_peak:     2.24,
  ls_std:      1.26,
  ls_offpeak:  0.90,
  weighted_avg: 0, // filled dynamically from tariffs.eskom
};

export default function Charts({
  term, availableTerms,
  monthlyChartData, dayChartData,
  traj, tariffBars,
  cpi, eskomEscPct,
  spillMwh, onTermChange, onEskomEscChange,
  savings, tariffs,
  adjSavings, activeTou,
}: Props) {

  const baseForTerm = (t: Term): number => {
    if (t === 5)  return savings.s5;
    if (t === 10) return savings.s10;
    return savings.s15;
  };

  const scaledSavings = (t: Term): number => {
    const baseCurrent = baseForTerm(term);
    const baseOther   = baseForTerm(t);
    return baseCurrent > 0 ? adjSavings * (baseOther / baseCurrent) : adjSavings;
  };

  const eskomRef = { ...ESKOM_REF, weighted_avg: tariffs.eskom };

  const termCols =
    availableTerms.length === 1 ? 'grid-cols-1 max-w-xs' :
    availableTerms.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <>
      {/* ── MONTHLY POWER FORECAST ───────────────────────────────────────── */}
      <section className="py-14">
        <SHead eye="Your Contracted Supply" title="Monthly Power Forecast" />

        <Card title="Apollo Wheeled Supply vs Electrical Load [MWh / month]">
          <p className="text-muted text-xs mb-3 -mt-2">
            Green fill = Apollo supply · Blue line = customer load
            {spillMwh > 0 && <span className="text-gold"> · Gold = spillage (supply exceeds load)</span>}
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
              <XAxis dataKey="month" {...ax} />
              <YAxis {...ax} unit=" MWh" width={72} />
              <Tooltip content={<Tip />} />
              <Legend formatter={lgFmt} wrapperStyle={{ paddingTop: 14 }} />
              <Area type="monotone" dataKey="supply" name="Apollo Wheeled Supply (MWh)"
                stroke="#10B981" strokeWidth={2.5} fill="url(#supplyGrad)"
                dot={false} activeDot={{ r: 5, fill: '#10B981' }} />
              {spillMwh > 0 && (
                <Area type="monotone" dataKey="spill" name="Spillage — supply exceeds load (MWh)"
                  stroke="#C9A84C" strokeWidth={1.5} fill="url(#spillGrad)"
                  dot={false} strokeDasharray="4 3" />
              )}
              <Line type="monotone" dataKey="load" name="Customer Electrical Load (MWh)"
                stroke="#38BDF8" strokeWidth={3} dot={false}
                activeDot={{ r: 5, fill: '#38BDF8' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Monthly table */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse" style={{ fontSize: 11 }}>
            <thead>
              <tr className="border-b border-border bg-forest">
                <th className="text-left py-2.5 px-3 text-green font-bold uppercase tracking-widest whitespace-nowrap">Period</th>
                {monthlyChartData.map(d => (
                  <th key={d.month} className="text-center py-2.5 px-1 text-muted font-semibold">{d.month}</th>
                ))}
                <th className="text-center py-2.5 px-3 text-green font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {([
                { label: 'Apollo Supply', key: 'supply' as const, cls: 'text-green'    },
                { label: 'Elec. Load',    key: 'load'   as const, cls: 'text-offwhite' },
              ]).map(row => {
                const total = monthlyChartData.reduce((s, d) => s + d[row.key], 0);
                return (
                  <tr key={row.key} className="border-b border-border/50">
                    <td className={`py-2 px-3 font-semibold whitespace-nowrap ${row.cls}`}>{row.label}</td>
                    {monthlyChartData.map(d => (
                      <td key={d.month} className="text-center py-2 px-1 text-offwhite">{fmt(d[row.key], 0)}</td>
                    ))}
                    <td className={`text-center py-2 px-3 font-black ${row.cls}`}>{fmt(total, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Day-in-the-life */}
        <div className="mt-5">
          <Card title="Day-in-the-Life Match — 24-Hour Cycle [MW average]">
            <p className="text-muted text-xs mb-4 -mt-2">
              Representative daily profile. Coverage slider adjusts Apollo supply curve.
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
                <XAxis dataKey="hour" {...ax} interval={3} />
                <YAxis {...ax} unit=" MW" width={48} />
                <Tooltip content={<Tip />} />
                <Legend formatter={lgFmt} wrapperStyle={{ paddingTop: 12 }} />
                <Area type="monotone" dataKey="apollo" name="Apollo Supply (MW)"
                  stroke="#10B981" strokeWidth={2.5} fill="url(#dayApolloGrad)"
                  dot={false} activeDot={{ r: 5, fill: '#10B981' }} />
                {spillMwh > 0 && (
                  <Area type="monotone" dataKey="spill" name="Spillage"
                    stroke="#C9A84C" strokeWidth={1.5} fill="url(#daySpillGrad)"
                    dot={false} strokeDasharray="4 2" />
                )}
                <Line type="monotone" dataKey="load" name="Eskom Load (MW)"
                  stroke="#38BDF8" strokeWidth={2.5} dot={false}
                  activeDot={{ r: 5, fill: '#38BDF8' }} />
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
        <SHead eye="Your Savings Forecast" title={`${term}-Year Savings Projection`} />

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          <Card title="Annual Savings [Mill ZAR / year]">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={traj} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                <XAxis dataKey="year" {...ax}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }} />
                <YAxis {...ax} unit="m" width={40} />
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
                <XAxis dataKey="year" {...ax}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -12, fill: '#4ADE80', fontSize: 11 }} />
                <YAxis {...ax} unit="m" width={40} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="cumul" name="Cumulative Saving (R mill)"
                  stroke="#34D399" strokeWidth={2.5} fill="url(#cumulGrad)"
                  dot={{ fill: '#34D399', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Term picker — only available terms */}
        <div className={`grid gap-4 ${termCols}`}>
          {availableTerms.map(t => {
            const s      = scaledSavings(t);
            const active = term === t;
            return (
              <button key={t} onClick={() => onTermChange(t)}
                className={`rounded-2xl border p-4 text-center cursor-pointer transition-all w-full ${
                  active ? 'bg-green/10 border-green' : 'bg-forest border-border hover:border-green/40'
                }`}>
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
      </section>

      <HR />

      {/* ── TARIFF COMPARISON ────────────────────────────────────────────── */}
      <section className="py-14">
        <SHead eye="Your TOU Tariffs" title="Apollo vs Eskom Comparison" />

        <div className="grid md:grid-cols-2 gap-5 mb-5">

          {/* Tariff bar — selected term vs Eskom */}
          {(() => {
            const selectedBar = tariffBars.find(b => b.term === `${term}yr`) ?? tariffBars[0];
            if (!selectedBar) return null;
            const barData   = [
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
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Apollo saving vs Eskom</p>
                  <p className="text-green text-2xl font-black leading-none mt-1">
                    R{fmtDot(saving, 2)} /kWh
                    <span className="text-sm text-dim font-semibold ml-2">({savingPct}% cheaper)</span>
                  </p>
                </div>
                <div className="flex-1 min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} barGap={16} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                      <XAxis dataKey="label" {...ax} />
                      <YAxis {...ax} domain={[yMin, yMax]}
                        tickFormatter={(v: number) => `R${fmtDot(v, 2)}`} width={68} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" name="R/kWh" radius={[6, 6, 0, 0]}>
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
                <XAxis dataKey="year" {...ax}
                  label={{ value: 'Contract Year', position: 'insideBottom', offset: -18, fill: '#4ADE80', fontSize: 11 }} />
                <YAxis {...ax}
                  domain={[
                    (dataMin: number) => parseFloat((dataMin * 0.97).toFixed(2)),
                    (dataMax: number) => parseFloat((dataMax * 1.05).toFixed(2)),
                  ]}
                  tickFormatter={(v: number) => `R${fmtDot(v, 2)}`}
                  width={68}
                />
                <Tooltip content={<Tip />} />
                <Legend formatter={lgFmt} wrapperStyle={{ paddingTop: 8 }}
                  verticalAlign="bottom" align="left" iconType="line" />
                <Line type="monotone" dataKey="apollo" name="Apollo (R/kWh)"
                  stroke="#10B981" strokeWidth={2.5} dot={false}
                  activeDot={{ r: 5, fill: '#10B981' }} />
                <Line type="monotone" dataKey="eskom" name="Eskom (R/kWh)"
                  stroke="#EF4444" strokeWidth={2.5} dot={false}
                  strokeDasharray="5 3" activeDot={{ r: 5, fill: '#EF4444' }} />
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-muted text-[11px] font-semibold uppercase tracking-widest mb-2">
                Eskom Escalation Assumption
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[4, 6, 8, 10].map(pct => (
                  <button key={pct} onClick={() => onEskomEscChange(pct)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all text-center ${
                      eskomEscPct === pct
                        ? 'bg-green text-charcoal'
                        : 'bg-elevated border border-border text-muted hover:text-offwhite'
                    }`}>
                    {pct}% p.a.
                  </button>
                ))}
              </div>
              <p className="text-dim text-[11px] mt-2">
                Apollo at CPI ({cpi}% p.a.) vs Eskom at {eskomEscPct}% p.a.
                {eskomEscPct > 6 ? ' — higher assumption shows greater long-term savings.' :
                 eskomEscPct < 6 ? ' — conservative assumption reduces savings forecast.'  :
                 ' — the gap widens every year.'}
              </p>
            </div>
          </Card>
        </div>

        {/* TOU Tariff table — real data from DB */}
        <div className="mt-2">
          <SHead eye="TOU Tariff Schedule [R/kWh]" title={`Apollo vs Eskom — 1 April 2026`} />

          {activeTou ? (
            <div className="bg-forest border border-border rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">
                {term}-Year Contract · Time of Use Tariffs
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: 12 }}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-2 text-[11px] font-bold uppercase text-dim">
                        Time of Use Period
                      </th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-bold uppercase text-green">
                        Apollo {term}yr
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
                    {TOU_LABELS.map(row => {
                      const apollo   = activeTou[row.key] ?? 0;
                      const eskomVal = eskomRef[row.key] ?? 0;
                      const saving   = eskomVal - apollo;
                      const isWA     = row.key === 'weighted_avg';
                      return (
                        <tr key={row.key}
                          className={`border-b border-border/40 hover:bg-elevated/20 transition-colors ${isWA ? 'bg-green/5' : ''}`}>
                          <td className={`py-2.5 px-2 text-muted ${isWA ? 'font-bold text-offwhite' : ''}`}>
                            {row.label}
                          </td>
                          <td className={`text-center py-2.5 px-3 text-green ${isWA ? 'font-bold text-lg' : ''}`}>
                            {apollo > 0 ? fmt(apollo) : '—'}
                          </td>
                          <td className={`text-center py-2.5 px-3 text-danger ${isWA ? 'font-bold text-lg' : ''}`}>
                            {eskomVal > 0 ? fmt(eskomVal) : '—'}
                          </td>
                          <td className={`text-center py-2.5 px-3 ${
                            saving > 0 ? 'text-green' : saving < 0 ? 'text-danger' : 'text-muted'
                          } ${isWA ? 'font-bold text-lg' : ''}`}>
                            {apollo > 0 && eskomVal > 0
                              ? `${saving >= 0 ? '-' : '+'}${fmt(Math.abs(saving))}`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-dim text-[11px] mt-3">
                Apollo tariffs escalate at CPI annually. Eskom WEPS based on 2025/26 approved tariff booklet.
              </p>
            </div>
          ) : (
            <div className="bg-forest border border-border rounded-2xl p-8 text-center">
              <p className="text-muted text-sm font-semibold mb-2">TOU tariff data not yet uploaded</p>
              <p className="text-border text-xs">
                Re-upload the offerbook Excel file in the admin panel to populate exact TOU tariff
                values from the Deal IO tab (columns D/E/F, rows 18–25).
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
