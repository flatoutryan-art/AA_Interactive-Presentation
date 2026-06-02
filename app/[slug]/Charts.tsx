'use client';

/**
 * app/[slug]/Charts.tsx  v4
 *
 * Design refresh:
 *  - Chart cards: white background, dark text, green accents
 *  - Section headings and page background remain dark (unchanged)
 *  - Tooltips: keep dark green (brand contrast on white charts)
 *  - All axis labels, legends, grid lines updated for white bg
 *  - Fixed label overlaps: removed insideBottom XAxis labels (used
 *    dedicated bottom margin instead), increased chart heights where
 *    labels were clipped, moved legend below charts with safe padding
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

const fmtDot = (n: number, dp = 2): string => (isNaN(n) ? 0 : n).toFixed(dp);

const fmtMill = (n: number): string => `R${fmt(isNaN(n) ? 0 : n, 0)}m`;

// ─── Axis props for WHITE background charts ───────────────────────────────────
// Text is dark charcoal on white cards
const axisLight = {
  tick:     { fill: '#374151', fontSize: 11 },
  axisLine: { stroke: '#E5E7EB' } as const,
  tickLine: false as const,
};

// Grid for white background
const gridLight = { strokeDasharray: '3 3', stroke: '#E5E7EB' };

// ─── Tooltip — stays dark green for brand contrast ────────────────────────────
function Tip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#0F2318', border:'1px solid #10B981', borderRadius:10, padding:'10px 14px', fontSize:12, boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
      <p style={{ color:'#86EFAC', fontWeight:700, marginBottom:5, borderBottom:'1px solid #1E4D30', paddingBottom:4 }}>{label}</p>
      {payload.map(p => {
        const isTariff = p.name.includes('R/kWh') || p.name.includes('Apollo') || p.name.includes('Eskom');
        const display  = isTariff ? `R${fmtDot(p.value, 2)}` : fmt(p.value);
        return (
          <p key={p.name} style={{ color: p.color === '#374151' ? '#86EFAC' : p.color, lineHeight: 1.7 }}>
            {p.name}: <strong>{display}</strong>
          </p>
        );
      })}
    </div>
  );
}

// Legend formatter for white bg cards
const legendLight = (v: string) => (
  <span style={{ color: '#374151', fontSize: 11 }}>{v}</span>
);

// ─── White chart card ─────────────────────────────────────────────────────────
function ChartCard({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-1">{title}</p>
      {sub && <p className="text-gray-400 text-xs mb-4">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

// Dark section card (term picker, escalation panel etc — stays dark)
function DarkCard({ title, children, gold=false }: {
  title: string; children: React.ReactNode; gold?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${gold ? 'bg-gold/5 border-gold/40' : 'bg-forest border-border'}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-widest mb-4 ${gold ? 'text-gold' : 'text-muted'}`}>
        {title}
      </p>
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

function HR() { return <div className="border-t border-border my-2" />; }

// ── White table wrapper ───────────────────────────────────────────────────────
function WhiteTable({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <p className="text-[11px] font-bold uppercase tracking-widest text-green">{title}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

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

  const hasTerm = (t: Term) => validTerms.includes(t);

  const savingsForTerm = (t: Term): number => {
    if (t === 5)  return savings.s5;
    if (t === 10) return savings.s10;
    if (t === 15) return savings.s15;
    if (t === 3)  return savings.s5  * 0.55;
    if (t === 7)  return savings.s10 * 0.65;
    return savings.s15 * 1.35;
  };

  const scaledSavings = (t: Term): number => {
    const baseCurrent = savingsForTerm(term);
    const baseOther   = savingsForTerm(t);
    return baseCurrent > 0 ? adjSavings * (baseOther / baseCurrent) : adjSavings;
  };

  const apolloWa =
    term===3  ? (tariffBars.find(b=>b.term==='3yr')?.apollo  ?? tariffs.t5*1.04) :
    term===5  ? tariffs.t5  :
    term===7  ? (tariffBars.find(b=>b.term==='7yr')?.apollo  ?? tariffs.t5*0.98) :
    term===10 ? tariffs.t10 :
    term===15 ? tariffs.t15 :
                tariffs.t15 * 0.97;

  const buildTouRows = (wa: number, eskomWa: number) => [
    { label:'Weighted Average',        apollo:wa,          eskom:eskomWa,           pct:null,              isWA:true,  season:'' },
    { label:'High Season — Peak',      apollo:wa*1.38,     eskom:eskomWa*1.38,      pct:touPeak*0.5,       isWA:false, season:'high' },
    { label:'High Season — Standard',  apollo:wa*0.97,     eskom:eskomWa*0.97,      pct:touStandard*0.5,   isWA:false, season:'high' },
    { label:'High Season — Off-Peak',  apollo:wa*0.68,     eskom:eskomWa*0.62,      pct:touOffpeak*0.5,    isWA:false, season:'high' },
    { label:'Low Season — Peak',       apollo:wa*0.58,     eskom:eskomWa*0.58,      pct:touPeak*0.5,       isWA:false, season:'low' },
    { label:'Low Season — Standard',   apollo:wa*0.85,     eskom:eskomWa*0.85,      pct:touStandard*0.5,   isWA:false, season:'low' },
    { label:'Low Season — Off-Peak',   apollo:wa*0.68,     eskom:eskomWa*0.62,      pct:touOffpeak*0.5,    isWA:false, season:'low' },
  ];

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          MONTHLY POWER FORECAST
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-14">
        <SHead eye="Your Contracted Supply" title="Monthly Power Forecast" />

        {/* Main area chart — white card */}
        <ChartCard
          title="Apollo Wheeled Supply vs Electrical Load [MWh / month]"
          sub={spillMwh > 0
            ? "Green = Apollo supply consumed · Blue line = customer load · Gold stacked = spillage (supply exceeds load)"
            : "Green fill = Apollo supply · Blue line = actual customer load"}
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyChartData} margin={{ top:10, right:16, left:0, bottom:10 }}>
              <defs>
                <linearGradient id="supplyGradW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="spillGradW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.60} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridLight} />
              <XAxis dataKey="month" {...axisLight} />
              <YAxis {...axisLight} unit=" MWh" width={80} />
              <Tooltip content={<Tip />} />
              <Legend formatter={legendLight} wrapperStyle={{ paddingTop:12, fontSize:11 }} />
              <Area type="monotone" dataKey="supply" stackId="apollo"
                name="Apollo Wheeled Supply (MWh)" stroke="#10B981" strokeWidth={2.5}
                fill="url(#supplyGradW)" dot={false} activeDot={{ r:5, fill:'#10B981' }} />
              {spillMwh > 0 && (
                <Area type="monotone" dataKey="spill" stackId="apollo"
                  name="Spillage — supply exceeds load (MWh)" stroke="#C9A84C" strokeWidth={2}
                  fill="url(#spillGradW)" dot={false} />
              )}
              <Line type="monotone" dataKey="load"
                name="Customer Electrical Load (MWh)" stroke="#3B82F6" strokeWidth={2.5}
                dot={false} activeDot={{ r:5, fill:'#3B82F6' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Monthly data table — white */}
        <div className="mt-5">
          <WhiteTable title="Monthly Energy Summary [MWh]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ fontSize:11 }}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2.5 px-4 text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">Period</th>
                    {monthlyChartData.map(d => (
                      <th key={d.month} className="text-center py-2.5 px-2 text-gray-500 font-semibold">{d.month}</th>
                    ))}
                    <th className="text-center py-2.5 px-4 text-green font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label:'Apollo Supply', key:'supply' as const, textCls:'text-green font-semibold', totalCls:'text-green font-black' },
                    { label:'Elec. Load',    key:'load'   as const, textCls:'text-gray-700',            totalCls:'text-gray-900 font-black' },
                  ]).map(row => {
                    const total = monthlyChartData.reduce((s,d) => s+d[row.key], 0);
                    return (
                      <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className={`py-2.5 px-4 font-semibold whitespace-nowrap ${row.textCls}`}>{row.label}</td>
                        {monthlyChartData.map(d => (
                          <td key={d.month} className={`text-center py-2.5 px-2 ${row.textCls}`}>{fmt(d[row.key], 0)}</td>
                        ))}
                        <td className={`text-center py-2.5 px-4 ${row.totalCls}`}>{fmt(total, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </WhiteTable>
        </div>

        {/* 24hr day chart — white */}
        <div className="mt-5">
          <ChartCard
            title="Day-in-the-Life — 24-Hour Cycle [MW average]"
            sub="Representative daily profile based on contracted supply shape. Hover for values."
          >
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dayChartData} margin={{ top:10, right:16, left:0, bottom:10 }}>
                <defs>
                  <linearGradient id="dayApolloW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.30} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="daySpillW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridLight} />
                {/* interval=2 shows every 2nd hour label — avoids overlap on mobile */}
                <XAxis dataKey="hour" {...axisLight} interval={2} />
                <YAxis {...axisLight} unit=" MW" width={56} />
                <Tooltip content={<Tip />} />
                <Legend formatter={legendLight} wrapperStyle={{ paddingTop:10, fontSize:11 }} />
                <Area type="monotone" dataKey="apollo" stackId="day"
                  name="Apollo Supply (MW)" stroke="#10B981" strokeWidth={2.5}
                  fill="url(#dayApolloW)" dot={false} activeDot={{ r:5, fill:'#10B981' }} />
                {spillMwh > 0 && (
                  <Area type="monotone" dataKey="spill" stackId="day"
                    name="Spillage (MW)" stroke="#C9A84C" strokeWidth={1.5}
                    fill="url(#daySpillW)" dot={false} strokeDasharray="4 2" />
                )}
                <Line type="monotone" dataKey="load"
                  name="Eskom Load (MW)" stroke="#3B82F6" strokeWidth={2.5}
                  dot={false} activeDot={{ r:5, fill:'#3B82F6' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-gray-400 text-[11px] mt-2">Indicative wind/solar blend shape. Gold area appears when supply exceeds consumption.</p>
          </ChartCard>
        </div>
      </section>

      <HR />

      {/* ════════════════════════════════════════════════════════════════════
          SAVINGS FORECAST
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-14">
        <SHead eye="Your Savings Forecast" title={`${term}-Year Savings Projection`} />

        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {/* Annual bar chart — white */}
          <ChartCard title="Annual Savings [Mill ZAR / year]">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={traj} margin={{ top:10, right:16, left:0, bottom:8 }}>
                <CartesianGrid {...gridLight} vertical={false} />
                <XAxis dataKey="year" {...axisLight}
                  label={{ value:'Contract Year', position:'insideBottom', offset:-4, fill:'#6B7280', fontSize:10 }} />
                <YAxis {...axisLight} unit="m" width={44} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="annual" name="Annual Saving (R mill)" fill="#10B981"
                  radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Cumulative area chart — white */}
          <ChartCard title="Cumulative Savings [Mill ZAR]">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={traj} margin={{ top:10, right:16, left:0, bottom:8 }}>
                <defs>
                  <linearGradient id="cumulW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridLight} />
                <XAxis dataKey="year" {...axisLight}
                  label={{ value:'Contract Year', position:'insideBottom', offset:-4, fill:'#6B7280', fontSize:10 }} />
                <YAxis {...axisLight} unit="m" width={44} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="cumul" name="Cumulative Saving (R mill)"
                  stroke="#10B981" strokeWidth={2.5} fill="url(#cumulW)"
                  dot={{ fill:'#10B981', r:3, strokeWidth:0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Term picker — stays dark (it's a CTA / selector) */}
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
                  className={`rounded-2xl border p-5 text-center cursor-pointer transition-all w-full ${
                    active
                      ? 'bg-green text-charcoal border-green shadow-lg shadow-green/20'
                      : 'bg-white border-gray-200 hover:border-green/50 hover:shadow-md text-gray-900'
                  }`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-widest mb-1 ${active?'text-charcoal/70':'text-gray-400'}`}>Contract Term</p>
                  <p className={`text-3xl font-black ${active?'text-charcoal':'text-gray-900'}`}>{t} Year</p>
                  <p className={`text-2xl font-black mt-1 ${active?'text-charcoal':'text-green'}`}>{fmtMill(s)}</p>
                  <p className={`text-xs mt-1 ${active?'text-charcoal/70':'text-gray-400'}`}>Cumulative Savings</p>
                  {active && <span className="inline-block mt-2 bg-charcoal/20 text-charcoal text-[11px] font-bold px-3 py-0.5 rounded-full">Selected ✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {validTerms.length === 1 && (
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 inline-flex items-center gap-4 shadow-sm">
            <span className="text-green text-2xl font-black">{validTerms[0]}-Year Contract</span>
            <span className="text-gray-300">·</span>
            <span className="text-green font-bold text-xl">{fmtMill(adjSavings)}</span>
            <span className="text-gray-400 text-sm">cumulative savings</span>
          </div>
        )}
      </section>

      <HR />

      {/* ════════════════════════════════════════════════════════════════════
          TARIFF COMPARISON
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-14">
        <SHead eye="Your TOU Tariffs" title="Apollo vs Eskom Comparison" />

        {/* Row 1: WA bar + escalation panel */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">

          {/* WA tariff bar — white */}
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
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col">
                <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-3">
                  Weighted Average Tariff [R/kWh] — {term}-Year Term
                </p>
                <div className="mb-4 p-3 rounded-xl bg-green/8 border border-green/20">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Apollo saving vs Eskom</p>
                  <p className="text-green text-2xl font-black leading-none mt-1">
                    R{fmtDot(saving, 2)}/kWh
                    <span className="text-sm text-gray-400 font-semibold ml-2">({savingPct}% cheaper)</span>
                  </p>
                </div>
                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} barGap={20} margin={{ top:8, right:8, left:0, bottom:8 }}>
                      <CartesianGrid {...gridLight} vertical={false} />
                      <XAxis dataKey="label" {...axisLight} />
                      <YAxis {...axisLight} domain={[yMin, yMax]}
                        tickFormatter={(v:number) => `R${fmtDot(v,2)}`} width={72} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" name="R/kWh" radius={[6,6,0,0]} maxBarSize={60}>
                        {barData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} opacity={index===1?0.80:1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Escalation toggle — white card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-3">
                Eskom Escalation Assumption
              </p>
              <p className="text-gray-600 text-sm leading-relaxed mb-5">
                Apollo tariffs escalate at CPI (<strong className="text-green">{cpi}%</strong> p.a.).
                Adjust the Eskom escalation below to model different savings scenarios over the contract term.
              </p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[4, 6, 8, 10].map(pct => (
                  <button key={pct} onClick={() => onEskomEscChange(pct)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all text-center ${
                      eskomEscPct === pct
                        ? 'bg-green text-white shadow-md shadow-green/30'
                        : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-green/50 hover:text-green'
                    }`}>
                    {pct}% p.a.
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <p className="text-gray-500 text-xs leading-relaxed">
                Apollo at CPI <strong className="text-green">{cpi}%</strong> p.a. vs Eskom at{' '}
                <strong className="text-red-500">{eskomEscPct}%</strong> p.a.{' '}
                {eskomEscPct > 6
                  ? '— Higher assumption widens the savings gap significantly over time.'
                  : eskomEscPct < 6
                  ? '— Conservative scenario. The gap still widens in Apollo\'s favour.'
                  : '— The tariff gap compresses every year of the contract.'}
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Tariff Trajectory — FULL WIDTH white card */}
        <div className="mb-5">
          <ChartCard
            title={`Tariff Trajectory — Apollo vs Eskom over ${term} years`}
            sub={`Apollo at CPI ${cpi}% p.a. · Eskom modelled at ${eskomEscPct}% p.a. · The gap between lines = cumulative savings`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={traj} margin={{ top:10, right:24, left:0, bottom:16 }}>
                <CartesianGrid {...gridLight} />
                <XAxis dataKey="year" {...axisLight} />
                <YAxis
                  {...axisLight}
                  domain={[
                    (dataMin: number) => parseFloat((dataMin * 0.96).toFixed(2)),
                    (dataMax: number) => parseFloat((dataMax * 1.06).toFixed(2)),
                  ]}
                  tickFormatter={(v: number) => `R${fmtDot(v, 2)}`}
                  width={76}
                />
                <Tooltip content={<Tip />} />
                <Legend
                  formatter={legendLight}
                  wrapperStyle={{ paddingTop:12, fontSize:11 }}
                  verticalAlign="bottom"
                  align="left"
                  iconType="line"
                />
                <Line type="monotone" dataKey="apollo" name="Apollo (R/kWh)"
                  stroke="#10B981" strokeWidth={3} dot={false}
                  activeDot={{ r:5, fill:'#10B981', stroke:'white', strokeWidth:2 }} />
                <Line type="monotone" dataKey="eskom" name="Eskom (R/kWh)"
                  stroke="#EF4444" strokeWidth={3} dot={false} strokeDasharray="6 3"
                  activeDot={{ r:5, fill:'#EF4444', stroke:'white', strokeWidth:2 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Row 3: TOU Tariff Schedule — FULL WIDTH white table */}
        {hasTerm(term) && (() => {
          const rows = buildTouRows(apolloWa, tariffs.eskom);
          const termLabel = `${term}-Year Contract`;
          return (
            <WhiteTable
              title={`TOU Tariff Schedule [R/kWh] — 1 April 2026 · ${termLabel}`}
              sub="TOU rates derived from weighted-average tariff using Eskom WEPS 2026 period ratios. Apollo escalates at CPI annually."
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize:12 }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-[11px] font-bold uppercase text-gray-500 w-52">TOU Period</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-gray-500">Energy %</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-green">{termLabel}</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-red-500">Eskom WEPS</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-gray-500">Saving R/kWh</th>
                      <th className="text-center py-3 px-3 text-[11px] font-bold uppercase text-gray-500">Saving %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const saving    = row.eskom - row.apollo;
                      const savingPct = row.eskom > 0 ? (saving / row.eskom) * 100 : 0;
                      const isHigh    = row.season === 'high';
                      return (
                        <tr key={row.label}
                          className={`border-b border-gray-100 hover:bg-gray-50 transition-colors
                            ${row.isWA ? 'bg-green/5 border-b-2 border-green/20' : ''}`}>
                          <td className={`py-3 px-4 ${row.isWA ? 'font-black text-gray-900 text-sm' : isHigh ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>
                            {row.label}
                          </td>
                          <td className="text-center py-3 px-3 text-gray-500 text-xs">
                            {row.pct !== null ? `${fmt(row.pct, 1)}%` : '100%'}
                          </td>
                          <td className={`text-center py-3 px-3 text-green ${row.isWA ? 'font-black text-xl' : 'font-semibold'}`}>
                            {fmt(row.apollo)}
                          </td>
                          <td className={`text-center py-3 px-3 text-red-500 ${row.isWA ? 'font-black text-xl' : ''}`}>
                            {fmt(row.eskom)}
                          </td>
                          <td className={`text-center py-3 px-3 font-bold ${saving>0?'text-green':saving<0?'text-red-500':'text-gray-400'} ${row.isWA?'text-xl':''}`}>
                            {saving>0?'-':saving<0?'+':''}{fmt(Math.abs(saving))}
                          </td>
                          <td className={`text-center py-3 px-3 ${row.isWA?'font-bold text-gray-900':'text-gray-500'}`}>
                            {savingPct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                <p className="text-gray-400 text-[11px]">
                  High season = Jun–Aug. Low season = Sep–May.{term === 20 ? ' 20-year rates are indicative extrapolations.' : ''}
                </p>
              </div>
            </WhiteTable>
          );
        })()}
      </section>
    </>
  );
}
