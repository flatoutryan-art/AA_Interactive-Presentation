'use client';

/**
 * app/[slug]/Charts.tsx  v3
 *
 * Changes:
 *  1. Props extended: touPeak, touStandard, touOffpeak, full term support (3,5,7,10,15,20)
 *  2. TOU Tariff Schedule: adds Energy % Allocation column
 *  3. Tariff Trajectory: moved to full-width own row below the WA tariff bar
 *  4. Term type extended to 3|5|7|10|15|20
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
type Term = 3 | 5 | 7 | 10 | 15 | 20;

type Props = {
  term:             Term;
  coveragePct:      number;
  defaultCov:       number;
  monthlyChartData: Array<{ month: string; supply: number; load: number; spill: number }>;
  dayChartData:     Array<{ hour: string; apollo: number; load: number; spill: number }>;
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
  activeTerms:      number[];
  touPeak:          number;
  touStandard:      number;
  touOffpeak:       number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number, dp = 2): string =>
  (isNaN(n) ? 0 : n).toLocaleString('en-ZA', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtDot = (n: number, dp = 2): string =>
  (isNaN(n) ? 0 : n).toFixed(dp);

const fmtMill = (n: number): string => `R${fmt(isNaN(n) ? 0 : n, 0)}m`;

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function Tip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#0F2318', border:'1px solid #1E4D30', borderRadius:12, padding:'10px 14px', fontSize:12, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
      <p style={{ color:'#86EFAC', fontWeight:600, marginBottom:4 }}>{label}</p>
      {payload.map(p => {
        const isTariff = p.name.includes('R/kWh') || p.name.includes('Apollo (') || p.name.includes('Eskom (');
        const display  = isTariff ? `R${fmtDot(p.value, 2)}` : `${fmt(p.value)}${p.unit ?? ''}`;
        return (
          <p key={p.name} style={{ color:p.color, lineHeight:1.7 }}>
            {p.name}: <strong>{display}</strong>
          </p>
        );
      })}
    </div>
  );
}

const legendFmt = (v: string) => <span style={{ color:'#86EFAC', fontSize:12 }}>{v}</span>;

const axisProps = {
  tick:     { fill:'#86EFAC', fontSize:11 },
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

function HR() { return <div className="border-t border-border" />; }

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
  touPeak, touStandard, touOffpeak,
}: Props) {

  const validTerms: Term[] = (
    (activeTerms?.length ? activeTerms : [5, 10, 15]) as Term[]
  ).filter(t => [3, 5, 7, 10, 15, 20].includes(t));

  const hasTerm = (t: Term): boolean => validTerms.includes(t);

  // Savings for any term — interpolate for 3yr and 7yr if not stored
  const savingsForTerm = (t: Term): number => {
    if (t === 5)  return savings.s5;
    if (t === 10) return savings.s10;
    if (t === 15) return savings.s15;
    if (t === 3)  return savings.s5  * 0.55;
    if (t === 7)  return savings.s10 * 0.65;
    return savings.s15 * 1.35; // 20yr
  };

  const scaledSavings = (t: Term): number => {
    const baseCurrent = savingsForTerm(term);
    const baseOther   = savingsForTerm(t);
    return baseCurrent > 0 ? adjSavings * (baseOther / baseCurrent) : adjSavings;
  };

  // TOU tariff table data — keyed by term
  // Each row: label, apolloRate (derived from WA), eskomRate, energyPct
  const buildTouRows = (wa: number, eskomWa: number) => [
    {
      label:     'Weighted Average',
      apollo:    wa,
      eskom:     eskomWa,
      pct:       null,          // total row
      season:    '',
      isWA:      true,
    },
    // High season rows
    {
      label:     'High Season — Peak',
      apollo:    wa * 1.38,
      eskom:     eskomWa * 1.38,
      pct:       touPeak * 0.5,
      season:    'high',
      isWA:      false,
    },
    {
      label:     'High Season — Standard',
      apollo:    wa * 0.97,
      eskom:     eskomWa * 0.97,
      pct:       touStandard * 0.5,
      season:    'high',
      isWA:      false,
    },
    {
      label:     'High Season — Off-Peak',
      apollo:    wa * 0.68,
      eskom:     eskomWa * 0.62,
      pct:       touOffpeak * 0.5,
      season:    'high',
      isWA:      false,
    },
    // Low season rows
    {
      label:     'Low Season — Peak',
      apollo:    wa * 0.58,
      eskom:     eskomWa * 0.58,
      pct:       touPeak * 0.5,
      season:    'low',
      isWA:      false,
    },
    {
      label:     'Low Season — Standard',
      apollo:    wa * 0.85,
      eskom:     eskomWa * 0.85,
      pct:       touStandard * 0.5,
      season:    'low',
      isWA:      false,
    },
    {
      label:     'Low Season — Off-Peak',
      apollo:    wa * 0.68,
      eskom:     eskomWa * 0.62,
      pct:       touOffpeak * 0.5,
      season:    'low',
      isWA:      false,
    },
  ];

  // Apollo WA tariff for current term
  const apolloWa =
    term===3  ? (tariffBars.find(b=>b.term==='3yr')?.apollo  ?? tariffs.t5*1.04) :
    term===5  ? tariffs.t5  :
    term===7  ? (tariffBars.find(b=>b.term==='7yr')?.apollo  ?? tariffs.t5*0.98) :
    term===10 ? tariffs.t10 :
    term===15 ? tariffs.t15 :
                tariffs.t15*0.97;

  return (
    <>
      {/* ── MONTHLY POWER FORECAST ───────────────────────────────────────── */}
      <section className="py-14">
        <SHead eye="Your Contracted Supply" title="Monthly Power Forecast" />

        <Card title="Apollo Wheeled Supply vs Electrical Load [MWh / month]">
          <p className="text-muted text-xs mb-3 -mt-2">
            Green fill = Apollo supply consumed. Blue line = customer load.
            {spillMwh > 0 && <span className="text-gold"> Gold stacked on top = spillage (supply exceeds load).</span>}
          </p>
          <ResponsiveContainer width="100%" height={290}>
            <ComposedChart data={monthlyChartData} margin={{ top:8, right:8, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="spillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.75} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit=" MWh" width={72} />
              <Tooltip content={<Tip />} />
              <Legend formatter={legendFmt} wrapperStyle={{ paddingTop:14 }} />
              <Area type="monotone" dataKey="supply" stackId="apollo"
                name="Apollo Wheeled Supply (MWh)" stroke="#10B981" strokeWidth={2.5}
                fill="url(#supplyGrad)" dot={false} activeDot={{ r:5, fill:'#10B981' }} />
              {spillMwh > 0 && (
                <Area type="monotone" dataKey="spill" stackId="apollo"
                  name="Spillage — supply exceeds load (MWh)" stroke="#C9A84C" strokeWidth={2}
                  fill="url(#spillGrad)" dot={false} />
              )}
              <Line type="monotone" dataKey="load"
                name="Customer Electrical Load (MWh)" stroke="#38BDF8" strokeWidth={3}
                dot={false} activeDot={{ r:5, fill:'#38BDF8' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Monthly table */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse" style={{ fontSize:11 }}>
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
                { label:'Apollo Supply', key:'supply' as const, cls:'text-green' },
                { label:'Elec. Load',    key:'load'   as const, cls:'text-offwhite' },
              ]).map(row => {
                const total = monthlyChartData.reduce((s,d) => s+d[row.key], 0);
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

        {/* 24hr day chart */}
        <div className="mt-5">
          <Card title="Day-in-the-Life Match — 24-Hour Cycle [MW average]">
            <p className="text-muted text-xs mb-4 -mt-2">Representative daily profile. Hover/tap for values.</p>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dayChartData} margin={{ top:8, right:8, left:0, bottom:0 }}>
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
                <Legend formatter={legendFmt} wrapperStyle={{ paddingTop:12 }} />
                <Area type="monotone" dataKey="apollo" stackId="day"
                  name="Apollo Supply (MW)" stroke="#10B981" strokeWidth={2.5}
                  fill="url(#dayApolloGrad)" dot={false} activeDot={{ r:5, fill:'#10B981' }} />
                {spillMwh > 0 && (
                  <Area type="monotone" dataKey="spill" stackId="day"
                    name="Spillage" stroke="#C9A84C" strokeWidth={1.5}
                    fill="url(#daySpillGrad)" dot={false} strokeDasharray="4 2" />
                )}
                <Line type="monotone" dataKey="load"
                  name="Eskom Load (MW)" stroke="#38BDF8" strokeWidth={2.5}
                  dot={false} activeDot={{ r:5, fill:'#38BDF8' }} />
              </ComposedChart>
            </ResponsiveContainer>
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
              <BarChart data={traj} margin={{ top:4, right:4, left:0, bottom:20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                <XAxis dataKey="year" {...axisProps}
                  label={{ value:'Contract Year', position:'insideBottom', offset:-12, fill:'#4ADE80', fontSize:11 }} />
                <YAxis {...axisProps} unit="m" width={40} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="annual" name="Annual Saving (R mill)" fill="#10B981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Cumulative Savings [Mill ZAR]">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={traj} margin={{ top:4, right:4, left:0, bottom:20 }}>
                <defs>
                  <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34D399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34D399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis dataKey="year" {...axisProps}
                  label={{ value:'Contract Year', position:'insideBottom', offset:-12, fill:'#4ADE80', fontSize:11 }} />
                <YAxis {...axisProps} unit="m" width={40} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="cumul" name="Cumulative Saving (R mill)"
                  stroke="#34D399" strokeWidth={2.5} fill="url(#cumulGrad)"
                  dot={{ fill:'#34D399', r:3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Term picker — filtered to active terms only */}
        {validTerms.length > 1 && (
          <div className={`grid gap-4 ${
            validTerms.length === 2 ? 'grid-cols-2' :
            validTerms.length === 3 ? 'grid-cols-3' :
            'grid-cols-2 md:grid-cols-3'
          }`}>
            {validTerms.map(t => {
              const s = scaledSavings(t);
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
                  {active && <span className="inline-block mt-1 bg-green text-charcoal text-[11px] font-bold px-2 py-0.5 rounded-full">Selected</span>}
                </button>
              );
            })}
          </div>
        )}

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

        {/* Row 1: WA Tariff bar + escalation toggle side by side */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">

          {/* WA tariff bar chart */}
          {(() => {
            const selectedBar =
              tariffBars.find(b => b.term === `${term}yr`) ??
              tariffBars.find(b => validTerms.includes(parseInt(b.term) as Term)) ??
              tariffBars[0];
            if (!selectedBar) return null;
            const barData = [
              { label:`Apollo ${term}yr`, value:selectedBar.apollo, fill:'#10B981' },
              { label:'Eskom WEPS',       value:selectedBar.eskom,  fill:'#EF4444' },
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
                    <BarChart data={barData} barGap={16} margin={{ top:4, right:4, left:0, bottom:4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} domain={[yMin, yMax]} tickFormatter={(v:number) => `R${fmtDot(v,2)}`} width={68} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" name="R/kWh" radius={[6,6,0,0]} isAnimationActive={true}>
                        {barData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} opacity={index===1?0.75:1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Eskom escalation toggle panel */}
          <div className="bg-forest border border-border rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">
                Eskom Escalation Assumption
              </p>
              <p className="text-offwhite text-sm leading-relaxed mb-4">
                Apollo tariffs escalate at CPI (<strong className="text-green">{cpi}%</strong> p.a.).
                Adjust the Eskom escalation assumption below to model different savings scenarios.
              </p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[4, 6, 8, 10].map(pct => (
                  <button key={pct} onClick={() => onEskomEscChange(pct)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all text-center ${
                      eskomEscPct === pct
                        ? 'bg-green text-charcoal'
                        : 'bg-elevated border border-border text-muted hover:text-offwhite hover:border-green/40'
                    }`}>
                    {pct}% p.a.
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-elevated rounded-xl p-3 border border-border">
              <p className="text-dim text-xs leading-relaxed">
                Apollo at CPI <strong className="text-green">{cpi}%</strong> p.a. vs Eskom at{' '}
                <strong className="text-danger">{eskomEscPct}%</strong> p.a.{' '}
                {eskomEscPct > 6
                  ? '— Higher assumption shows greater long-term savings divergence.'
                  : eskomEscPct < 6
                  ? '— Conservative assumption. Savings forecast reduced.'
                  : '— The tariff gap widens every year of the contract.'}
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Tariff Trajectory — FULL WIDTH own row */}
        <div className="mb-5">
          <Card title={`Tariff Trajectory — Apollo vs Eskom divergence over ${term} years`}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={traj} margin={{ top:8, right:24, left:0, bottom:36 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E4D30" />
                <XAxis dataKey="year" {...axisProps}
                  label={{ value:'Contract Year', position:'insideBottom', offset:-20, fill:'#4ADE80', fontSize:11 }} />
                <YAxis
                  {...axisProps}
                  domain={[
                    (dataMin: number) => parseFloat((dataMin * 0.97).toFixed(2)),
                    (dataMax: number) => parseFloat((dataMax * 1.05).toFixed(2)),
                  ]}
                  tickFormatter={(v: number) => `R${fmtDot(v, 2)}`}
                  width={72}
                />
                <Tooltip content={<Tip />} />
                <Legend formatter={legendFmt} wrapperStyle={{ paddingTop:8 }}
                  verticalAlign="bottom" align="left" iconType="line" />
                <Line type="monotone" dataKey="apollo" name="Apollo (R/kWh)"
                  stroke="#10B981" strokeWidth={3} dot={false} activeDot={{ r:5, fill:'#10B981' }} />
                <Line type="monotone" dataKey="eskom" name="Eskom (R/kWh)"
                  stroke="#EF4444" strokeWidth={3} dot={false} strokeDasharray="5 3"
                  activeDot={{ r:5, fill:'#EF4444' }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-dim text-[11px] mt-2">
              Eskom modelled at {eskomEscPct}% p.a. · Apollo at CPI {cpi}% p.a.
              The shaded gap between lines represents cumulative savings opportunity over the contract term.
            </p>
          </Card>
        </div>

        {/* Row 3: TOU Tariff Schedule — FULL WIDTH with Energy % Allocation column */}
        {hasTerm(term) && (() => {
          const rows = buildTouRows(apolloWa, tariffs.eskom);
          const termLabel = `${term}-Year Contract`;
          return (
            <Card title={`TOU Tariff Schedule [R/kWh] — 1 April 2026 · ${termLabel}`}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize:12 }}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-[11px] font-bold uppercase text-dim w-48">TOU Period</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-muted">Energy %</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-green">{termLabel}</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-danger">Eskom WEPS</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-muted">Saving</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-muted">Saving %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const saving    = row.eskom - row.apollo;
                      const savingPct = row.eskom > 0 ? (saving / row.eskom) * 100 : 0;
                      const isWA      = row.isWA;
                      const isHigh    = row.season === 'high';
                      return (
                        <tr key={row.label}
                          className={`border-b border-border/40 hover:bg-elevated/20 transition-colors
                            ${isWA ? 'bg-green/5' : isHigh ? 'bg-gold/3' : ''}`}>
                          <td className={`py-3 px-3 ${isWA ? 'font-black text-offwhite' : 'text-muted'} ${isHigh && !isWA ? 'text-gold/80' : ''}`}>
                            {row.label}
                          </td>
                          <td className="text-center py-3 px-3 text-dim">
                            {row.pct !== null ? `${fmt(row.pct, 1)}%` : '100%'}
                          </td>
                          <td className={`text-center py-3 px-3 text-green ${isWA ? 'font-black text-xl' : 'font-semibold'}`}>
                            {fmt(row.apollo)}
                          </td>
                          <td className={`text-center py-3 px-3 text-danger ${isWA ? 'font-black text-xl' : ''}`}>
                            {fmt(row.eskom)}
                          </td>
                          <td className={`text-center py-3 px-3 font-bold
                            ${saving > 0 ? 'text-green' : saving < 0 ? 'text-danger' : 'text-muted'}
                            ${isWA ? 'text-xl' : ''}`}>
                            {saving > 0 ? '-' : saving < 0 ? '+' : ''}{fmt(Math.abs(saving))}
                          </td>
                          <td className={`text-center py-3 px-3 text-dim ${isWA ? 'font-bold text-offwhite' : ''}`}>
                            {isWA ? `${savingPct.toFixed(1)}%` : `${savingPct.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-dim text-[11px] mt-3">
                TOU rates derived from weighted-average tariff using Eskom WEPS 2026 period ratios.
                Apollo escalates at CPI annually. High season = Jun–Aug. Low season = Sep–May.
                {term === 20 ? ' 20-year rates are indicative.' : ''}
              </p>
            </Card>
          );
        })()}
      </section>
    </>
  );
}
