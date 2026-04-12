'use client';

/**
 * app/[slug]/ProposalClient.tsx
 *
 * Recharts is loaded via dynamic import with ssr:false — this is the
 * correct Next.js App Router pattern that prevents the SSR crash while
 * keeping full hover/touch interactivity on every chart.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase, MONTH_KEYS, MONTH_LABELS } from '../../lib/supabaseClient';
import type { Proposal } from '../../lib/supabaseClient';

// ─── Dynamic Recharts import — ssr:false prevents the window crash ─────────────
const Charts = dynamic(() => import('./Charts'), { ssr: false, loading: () => <ChartSkeleton /> });

function ChartSkeleton() {
  return <div className="w-full rounded-xl bg-elevated/40 animate-pulse" style={{ height: 220 }} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Term = 5 | 10 | 15 | 20;

// ─── Constants ────────────────────────────────────────────────────────────────
const CARBON_TAX_ZAR        = 80 * 18.5;
const ESKOM_WATER_L_PER_KWH = 1.4;
const TREES_PER_TON         = 45;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const safe = (n: unknown): number =>
  typeof n === 'number' && isFinite(n) ? n : 0;

const fmt = (n: number, dp = 2): string =>
  safe(n).toLocaleString('en-ZA', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtMill = (n: number): string => `R${fmt(safe(n), 0)}m`;

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
};

// ─── Savings trajectory ───────────────────────────────────────────────────────
export type TRow = { year: number; apollo: number; eskom: number; annual: number; cumul: number };

export function buildTrajectory(
  apollo0: number, eskom0: number,
  genMwh: number, load: number,
  cpi: number, esEsc: number, years: number,
): TRow[] {
  let a = apollo0 || 1.43;
  let e = eskom0  || 1.49;
  let cumul = 0;
  return Array.from({ length: years }, (_, i) => {
    const eff  = Math.min(genMwh, load || genMwh);
    const ann  = ((eff * e) - (genMwh * a)) * 1000 / 1_000_000;
    cumul += ann;
    const row: TRow = {
      year: i + 1,
      apollo: parseFloat(a.toFixed(4)),
      eskom:  parseFloat(e.toFixed(4)),
      annual: parseFloat(ann.toFixed(3)),
      cumul:  parseFloat(cumul.toFixed(3)),
    };
    a *= 1 + cpi   / 100;
    e *= 1 + esEsc / 100;
    return row;
  });
}

// ─── Zone ─────────────────────────────────────────────────────────────────────
export type Zone = { id: 'A'|'B'|'C'; label: string; color: string; cbam: boolean };
export function getZone(pct: number): Zone {
  if (pct >= 130) return { id:'C', label:'Carbon Neutral',  color:'#C9A84C', cbam:true  };
  if (pct >= 100) return { id:'B', label:'Balanced Growth', color:'#34D399', cbam:false };
  return              { id:'A', label:'Maximum Savings',   color:'#10B981', cbam:false };
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, accent=false }: {
  label:string; value:string; sub?:string; accent?:boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${
      accent ? 'bg-green/10 border-green/40' : 'bg-forest border-border'
    }`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-xl font-black leading-none ${accent ? 'text-green' : 'text-offwhite'}`}>{value}</p>
      {sub && <p className="text-[11px] text-dim mt-0.5">{sub}</p>}
    </div>
  );
}

function SHead({ eye, title }: { eye:string; title:string }) {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-green mb-2">{eye}</p>
      <h2 className="font-display font-black text-offwhite leading-tight text-3xl md:text-4xl">{title}</h2>
    </div>
  );
}

function Card({ title, children, gold=false }: {
  title:string; children:React.ReactNode; gold?:boolean;
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

function HR() { return <div className="border-t border-border" />; }

function Logo() {
  return (
    <div className="flex items-center gap-3">
      {/* Real logo loaded from /public/apollo-logo.png */}
      <img
        src="/apollo-logo.png"
        alt="Apollo Africa"
        style={{ height: 48, width: "auto", objectFit: "contain" }}
        onError={(e) => {
          const t = e.currentTarget as HTMLImageElement;
          t.style.display = "none";
          const fb = document.getElementById("logo-svg-fallback");
          if (fb) fb.style.display = "block";
        }}
      />
      {/* SVG fallback shown only if PNG fails */}
      <svg
        id="logo-svg-fallback"
        width="22" height="26" viewBox="0 0 28 32" fill="none"
        aria-hidden="true" style={{ display: "none" }}
      >
        <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9"/>
        <path d="M14 6L24 28H14V6Z" fill="#10B981"/>
      </svg>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green/20 border-t-green animate-spin" />
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
        <p className="text-muted text-sm mt-2">Check the URL or contact your Apollo representative.</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN CLIENT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ProposalClient({ slug }: { slug: string }) {
  const [proposal,    setProposal]    = useState<Proposal | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [term,        setTerm]        = useState<Term>(5);
  const [coveragePct, setCoveragePct] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('proposals')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setProposal(data as Proposal);
          const cov = (data as Proposal).green_coverage_pct;
          setCoveragePct(cov && cov > 0 ? Math.round(cov) : 70);
        }
        setLoading(false);
      });
  }, [slug]);

  if (loading || coveragePct === null) return <LoadingScreen />;
  if (notFound || !proposal)           return <NotFoundScreen />;

  // ── Safe reads ────────────────────────────────────────────────────────────
  const p = {
    mwh:        safe(proposal.contract_mwh),
    load:       safe(proposal.customer_load_mwh),
    defaultCov: safe(proposal.green_coverage_pct) || 70,
    t5:         safe(proposal.tariff_5yr)  || 1.43,
    t10:        safe(proposal.tariff_10yr) || 1.41,
    t15:        safe(proposal.tariff_15yr) || 1.34,
    eskom:      safe(proposal.eskom_tariff) || 1.49,
    s5:         safe(proposal.savings_5yr),
    s10:        safe(proposal.savings_10yr),
    s15:        safe(proposal.savings_15yr),
    c5:         safe(proposal.credit_support_5yr),
    c10:        safe(proposal.credit_support_10yr),
    c15:        safe(proposal.credit_support_15yr),
    volGuar:    safe(proposal.volume_guarantee_pct) || 70,
    cpi:        safe(proposal.escalation_cpi)   || 4.5,
    esEsc:      safe(proposal.eskom_escalation) || 6.0,
  };

  // ── Term-derived ──────────────────────────────────────────────────────────
  const baseTariff  = term===5?p.t5 : term===10?p.t10 : term===15?p.t15 : p.t15*0.97;
  const baseSavings = term===5?p.s5 : term===10?p.s10 : term===15?p.s15 : p.s15*1.7;
  const baseCredit  = term===5?p.c5 : term===10?p.c10 : p.c15;

  // ── Coverage-derived ──────────────────────────────────────────────────────
  const fraction   = coveragePct / 100;
  const generated  = p.load > 0 ? p.load * fraction : p.mwh * fraction;
  const effective  = Math.min(generated, p.load || generated);
  const spillMwh   = Math.max(0, generated - (p.load || generated));
  const spillPct   = generated > 0 ? (spillMwh / generated) * 100 : 0;
  const ghgAnnual  = generated * 0.94;
  const adjSavings = baseSavings * (coveragePct / p.defaultCov);
  const discount   = p.eskom > 0 ? ((p.eskom - baseTariff) / p.eskom) * 100 : 0;
  const zone       = getZone(coveragePct);

  // ── Chart data ────────────────────────────────────────────────────────────
  const traj = buildTrajectory(baseTariff, p.eskom, generated, p.load, p.cpi, p.esEsc, term);

  const covScale      = p.defaultCov > 0 ? coveragePct / p.defaultCov : 1;
  const monthlySupply = MONTH_KEYS.map(k => safe((proposal.monthly_supply as Record<string,number>)[k]) * covScale);
  const monthlyLoad   = MONTH_KEYS.map(k => safe((proposal.monthly_load   as Record<string,number>)[k]));

  const monthlyChartData = MONTH_LABELS.map((month, i) => ({
    month,
    supply: parseFloat(monthlySupply[i].toFixed(0)),
    load:   parseFloat(monthlyLoad[i].toFixed(0)),
    spill:  parseFloat(Math.max(0, monthlySupply[i] - monthlyLoad[i]).toFixed(0)),
  }));

  // 24h day profile
  const apolloShape = [0,0,0,0,0,0.05,0.25,0.55,0.80,0.95,1,1,1,0.95,0.85,0.70,0.50,0.30,0.10,0.05,0,0,0,0];
  const loadShape   = [0.35,0.30,0.28,0.28,0.30,0.38,0.55,0.75,0.85,0.80,0.78,0.75,0.72,0.74,0.76,0.80,0.90,1.0,0.98,0.88,0.72,0.60,0.48,0.40];
  const apolloPeak  = (generated / 8760) * 3.2;
  const loadPeak    = ((p.load || generated) / 8760) * 2.8;
  const dayChartData = Array.from({ length: 24 }, (_, h) => ({
    hour:   `${String(h).padStart(2,'0')}:00`,
    apollo: parseFloat((apolloShape[h] * apolloPeak).toFixed(3)),
    load:   parseFloat((loadShape[h]   * loadPeak).toFixed(3)),
    spill:  parseFloat((Math.max(0, apolloShape[h]*apolloPeak - loadShape[h]*loadPeak)).toFixed(3)),
  }));

  const tariffBars = [
    { term:'5yr',  apollo:p.t5,        eskom:p.eskom },
    { term:'10yr', apollo:p.t10,       eskom:p.eskom },
    { term:'15yr', apollo:p.t15,       eskom:p.eskom },
    { term:'20yr', apollo:p.t15*0.97,  eskom:p.eskom },
  ];

  // Environmental legacy
  const totalKwh       = generated * 1000 * term;
  const ghgTotal       = ghgAnnual * term;
  const waterML        = (totalKwh * ESKOM_WATER_L_PER_KWH) / 1_000_000;
  const trees          = ghgTotal * TREES_PER_TON;
  const cars           = ghgTotal / 2.1;
  const avoidedTaxMill = (ghgAnnual * CARBON_TAX_ZAR) / 1_000_000;

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-charcoal text-offwhite font-sans">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest via-charcoal to-charcoal">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage:'linear-gradient(#10B981 1px,transparent 1px),linear-gradient(90deg,#10B981 1px,transparent 1px)', backgroundSize:'60px 60px' }} />
        <div className="relative max-w-4xl mx-auto px-5 pt-12 pb-20">
          <div className="flex items-center justify-between mb-12">
            <Logo />
            <div className="text-right">
              <p className="text-xs text-muted">Strategic Energy Roadmap</p>
              {proposal.contract_date && <p className="text-xs text-dim">{fmtDate(proposal.contract_date)}</p>}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-green/10 border border-green/30 rounded-full px-4 py-1.5 mb-5">
            <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
            <span className="text-green text-[11px] font-bold uppercase tracking-[0.2em]">Securing Renewable Energy Supply</span>
          </div>
          <h1 className="font-display font-black leading-[0.93] mb-5" style={{ fontSize:'clamp(48px,10vw,88px)' }}>
            <span className="text-offwhite">Go Greener,</span><br />
            <span className="text-green">Pay Less.</span>
          </h1>
          <p className="text-muted text-lg max-w-lg leading-relaxed mb-5">
            Your tailored clean energy roadmap for <strong className="text-offwhite">{proposal.client_name}</strong>.
          </p>
          {proposal.supply_window_closes && (
            <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-lg px-4 py-2">
              <span className="text-gold text-[11px] font-bold uppercase tracking-widest">⚠ Supply Window Closes:</span>
              <span className="text-gold text-sm font-semibold">{fmtDate(proposal.supply_window_closes)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── STICKY TERM BAR ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-border bg-charcoal/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-5 py-2.5 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-forest border border-border rounded-xl p-1">
            {([5,10,15,20] as Term[]).map(t => (
              <button key={t} onClick={() => setTerm(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  term===t ? 'bg-green text-charcoal' : 'text-muted hover:text-offwhite'
                }`}>
                {t}yr
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest"
            style={{ borderColor:zone.color+'60', background:zone.color+'18', color:zone.color }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:zone.color}} />
            Zone {zone.id}: {zone.label}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5">

        {/* ── SNAPSHOT ───────────────────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="Your Offer at a Glance" title="Commercial Snapshot" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="Contracted Supply"   value={`${fmt(p.mwh,0)} MWh`}     sub="base contracted"         accent />
            <Stat label={`${term}-yr Tariff`} value={`R${fmt(baseTariff)}/kWh`}  sub={`${fmt(discount,1)}% below Eskom`} />
            <Stat label={`${term}-yr Savings`} value={fmtMill(adjSavings)}       sub="at selected coverage"    accent />
            <Stat label="GHG Savings"         value={`${fmt(ghgAnnual,0)} t`}    sub="CO₂e per year" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Green Coverage"  value={`${coveragePct}%`}
              sub={coveragePct===p.defaultCov?'contracted default':coveragePct<p.defaultCov?'below contracted':'above contracted'} />
            <Stat label="Vol. Guarantee"  value={`${p.volGuar}%`}             sub="contracted" />
            <Stat label="Spillage"        value={`${fmt(spillPct,1)}%`}       sub={`${fmt(spillMwh,0)} MWh excess`} />
            <Stat label="Credit Support"  value={`R${fmt(baseCredit,1)}m`}    sub="ZAR million" />
          </div>
        </section>

        <HR />

        {/* ── GREEN COVERAGE SLIDER ──────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="Strategic Control" title="Green Coverage Optimiser" />

          <div className="bg-forest border border-border rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-muted text-sm font-semibold">Green Coverage %</p>
                <p className="text-[11px] text-dim mt-0.5">
                  Default = contracted coverage ({p.defaultCov}%). Matches the Green Coverage card exactly.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border"
                  style={{ borderColor:zone.color+'80', background:zone.color+'20', color:zone.color }}>
                  {coveragePct===p.defaultCov?`Contracted (${p.defaultCov}%)`:coveragePct<p.defaultCov?'Below Contracted':coveragePct<100?'Uplifted':coveragePct<130?'At/Above 100%':'Carbon-Neutral Zone'}
                </span>
                <span className="text-offwhite font-mono font-bold text-xl">{coveragePct}%</span>
              </div>
            </div>

            <div className="relative mt-5 mb-2">
              <input type="range" min={10} max={150} step={1}
                value={coveragePct}
                onChange={e => setCoveragePct(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background:`linear-gradient(to right,${zone.color} 0%,${zone.color} ${((coveragePct-10)/140)*100}%,#1E4D30 ${((coveragePct-10)/140)*100}%,#1E4D30 100%)` }}
              />
              <div className="absolute top-3 flex flex-col items-center pointer-events-none"
                style={{ left:`${((p.defaultCov-10)/140)*100}%`, transform:'translateX(-50%)' }}>
                <div className="w-px h-3 bg-green/70" />
                <span className="text-[9px] text-green font-bold whitespace-nowrap mt-0.5">▲ Contracted ({p.defaultCov}%)</span>
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide mt-6 mb-4">
              <span className="text-green">Zone A: Max Savings</span>
              <span className="text-mint">Zone B: Balanced</span>
              <span className="text-gold">Zone C: CBAM</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {([
                { id:'A', label:'Zone A',   title:'Max Savings',   range:'10–99%',  desc:'Maximum cash flow. Ideal for CFO cost mandates.',       color:'#10B981' },
                { id:'B', label:'Zone B',   title:'Balanced',      range:'100–129%',desc:'Full green load coverage. Future-proofed.',              color:'#34D399' },
                { id:'C', label:'Zone C ✦', title:'Carbon Neutral',range:'130–150%',desc:'EU CBAM compliant. Premium green pricing for exports.',  color:'#C9A84C' },
              ] as const).map(z => {
                const active = zone.id === z.id;
                return (
                  <div key={z.id} className="rounded-xl border p-3 text-center transition-all duration-300"
                    style={{ borderColor:active?z.color+'aa':'#1E4D30', background:active?z.color+'18':'#0F2318' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{color:z.color}}>{z.label}</p>
                    <p className="text-offwhite text-xs font-bold">{z.title}</p>
                    <p className="text-[10px] mt-0.5" style={{color:z.color}}>{z.range}</p>
                    <p className="text-muted text-[10px] mt-1 leading-tight hidden sm:block">{z.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-green/10 border border-green/40 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Green Coverage</p>
              <p className="text-xl font-black text-green">{coveragePct}%</p>
              <p className="text-xs text-dim">= slider above</p>
            </div>
            <div className="bg-forest border border-border rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Apollo Supply</p>
              <p className="text-xl font-black text-offwhite">{fmt(generated,0)}</p>
              <p className="text-xs text-dim">MWh / year</p>
            </div>
            <div className="bg-forest border border-border rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Effective Saving</p>
              <p className="text-xl font-black text-green">{fmtMill(adjSavings)}</p>
              <p className="text-xs text-dim">{term}-yr cumulative</p>
            </div>
            <div className="bg-forest border border-border rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">GHG Avoided</p>
              <p className="text-xl font-black text-mint">{fmt(ghgAnnual,0)}</p>
              <p className="text-xs text-dim">tCO₂e / year</p>
            </div>
          </div>
        </section>

        <HR />

        {/* ── CBAM ───────────────────────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="EU Export & Carbon Strategy" title="CBAM Carbon Tax Analysis" />
          <div className={`rounded-2xl border p-6 transition-all duration-500 ${zone.cbam?'bg-gold/5 border-gold/50':'bg-forest border-border'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Carbon &amp; EU CBAM Analysis</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-500"
                style={{ borderColor:zone.cbam?'#C9A84C':'#1E4D30', background:zone.cbam?'rgba(201,168,76,0.15)':'rgba(30,77,48,0.5)', color:zone.cbam?'#C9A84C':'#86EFAC' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{background:zone.cbam?'#C9A84C':'#86EFAC'}} />
                {zone.cbam ? 'EU CBAM Compliant ✓' : 'Standard Savings'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-4">
              {[
                {label:'GHG Avoided / yr',  value:fmt(ghgAnnual,0),            unit:'tCO₂e'},
                {label:'Avoided Carbon Tax', value:fmtMill(avoidedTaxMill),    unit:'per year @ $80/ton'},
                {label:'EU Carbon Price',    value:`R${fmt(CARBON_TAX_ZAR,0)}`,unit:'per ton (R18.50/$)'},
              ].map(item=>(
                <div key={item.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">{item.label}</p>
                  <p className={`text-3xl font-black leading-none ${zone.cbam?'text-gold':'text-green'}`}>{item.value}</p>
                  <p className="text-xs text-dim mt-0.5">{item.unit}</p>
                </div>
              ))}
            </div>
            {zone.cbam && (
              <div className="mt-2 bg-gold/10 border border-gold/30 rounded-xl p-4">
                <p className="text-gold text-xs font-bold uppercase tracking-widest mb-1.5">✦ EU CBAM Protection Active</p>
                <p className="text-muted text-xs leading-relaxed">
                  At 130%+ green coverage your business qualifies for EU Carbon Border Adjustment Mechanism compliance —
                  protecting exports and enabling premium green pricing in European markets.
                </p>
              </div>
            )}
            <p className="text-border text-[11px] mt-4">Based on EU ETS Q1 2025 forward rate at R18.50/USD. Informational only.</p>
          </div>
        </section>

        <HR />

        {/* ── ALL INTERACTIVE CHARTS via dynamic Recharts ────────────────── */}
        <Charts
          term={term}
          coveragePct={coveragePct}
          defaultCov={p.defaultCov}
          monthlyChartData={monthlyChartData}
          dayChartData={dayChartData}
          traj={traj}
          tariffBars={tariffBars}
          cpi={p.cpi}
          esEsc={p.esEsc}
          spillMwh={spillMwh}
          onTermChange={setTerm}
          savings={{ s5: p.s5, s10: p.s10, s15: p.s15 }}
          tariffs={{ t5: p.t5, t10: p.t10, t15: p.t15, eskom: p.eskom }}
        />

        <HR />

        {/* ── ENVIRONMENTAL ──────────────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="Environmental Impact" title="Your Green Legacy" />
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="bg-forest border border-border rounded-2xl p-6 grid grid-cols-2 gap-6">
              {[
                {label:'Annual GHG',     value:fmt(ghgAnnual,0),      unit:'tCO₂e / year',   color:'text-green'},
                {label:`${term}-yr Total`,value:fmt(ghgTotal,0),      unit:'Total tCO₂e',    color:'text-mint'},
                {label:'Coverage',       value:`${coveragePct}%`,     unit:'of total load',  color:'text-offwhite'},
                {label:'Energy Source',  value:'Wind & Solar',         unit:'100% renewable', color:'text-offwhite'},
              ].map(item=>(
                <div key={item.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">{item.label}</p>
                  <p className={`font-display text-3xl font-black leading-none ${item.color}`}>{item.value}</p>
                  <p className="text-dim text-xs mt-1">{item.unit}</p>
                </div>
              ))}
            </div>
            <div className="bg-green/10 border border-green/30 rounded-2xl p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-green mb-4">Carbon Commitment</p>
              <p className="text-offwhite text-base font-semibold leading-snug mb-5">
                Certifiably reduce your footprint with traceable RECs and GHG reports.
              </p>
              <ul className="space-y-2.5">
                {['Certified renewable energy supply','Verifiable GHG reduction reporting','ESG & TCFD compliance ready','NERSA licensed: TRD09/2024','EU CBAM-ready documentation'].map(b=>(
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-green flex items-center justify-center text-charcoal text-[10px] font-black">✓</span>
                    <span className="text-muted text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-forest border border-border rounded-2xl p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-green mb-5">Local Impact — Environmental Legacy</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {icon:'💧',label:'Water Saved',  value:fmt(waterML,1),             unit:'million litres', note:'vs coal generation'},
                {icon:'🌳',label:'Tree Equiv.',  value:fmt(trees,0),               unit:'trees planted',  note:'carbon absorption equiv.'},
                {icon:'🚗',label:'Cars Off Road',value:fmt(cars,0),                unit:'vehicles/year',  note:'tailpipe equivalent'},
                {icon:'⚡',label:'Clean Energy', value:fmt(totalKwh/1_000_000,1),  unit:'million kWh',    note:`over ${term} years`},
              ].map(item=>(
                <div key={item.label} className="text-center">
                  <p className="text-3xl mb-2">{item.icon}</p>
                  <p className="text-green text-2xl font-black leading-none">{item.value}</p>
                  <p className="text-offwhite text-xs font-semibold mt-1">{item.unit}</p>
                  <p className="text-muted text-[11px] mt-0.5">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HR />

        {/* ── NEXT STEPS ─────────────────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="What Happens Next" title="Your Path to Green Energy" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {n:'01',title:'Letter of Intent',   body:'Reserve your supply using your meter numbers.',                 c:'#10B981'},
              {n:'02',title:'Heads of Terms',      body:'Continues reservation of your supply allocation.',             c:'#34D399'},
              {n:'03',title:'Power Purchase Agmt', body:'CPPA conclusion locks your supply definitively.',              c:'#6EE7B7'},
              {n:'04',title:'Update Your ESA',     body:'Update your Electricity Supply Agreement with Eskom.',         c:'#34D399'},
              {n:'05',title:'Receive Supply',      body:'Green energy wheeled to your business — start saving today.', c:'#10B981'},
            ].map(step=>(
              <div key={step.n} className="bg-forest border border-border rounded-2xl p-4">
                <p className="font-display text-5xl font-black leading-none mb-2" style={{color:step.c+'22'}}>{step.n}</p>
                <p className="text-sm font-bold mb-1.5" style={{color:step.c}}>{step.title}</p>
                <p className="text-muted text-xs leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <HR />

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <section className="py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Logo />
              <p className="text-dim text-[11px] font-bold uppercase tracking-widest mt-4">NERSA Licensed Energy Trader · TRD09/2024</p>
              <p className="text-dim text-[11px] font-bold uppercase tracking-[0.12em] mt-2">Green Energy · Expertly Sourced · Seamlessly Delivered</p>
            </div>
            {(proposal.salesperson_name || proposal.salesperson_email) && (
              <div className="bg-forest border border-border rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-3">Your Apollo Contact</p>
                {proposal.salesperson_name  && <p className="text-offwhite font-bold">{proposal.salesperson_name}</p>}
                {proposal.salesperson_email && (
                  <a href={`mailto:${proposal.salesperson_email}`} className="text-green text-sm hover:underline block mt-1">
                    {proposal.salesperson_email}
                  </a>
                )}
                {proposal.salesperson_phone && <p className="text-muted text-sm mt-1">{proposal.salesperson_phone}</p>}
                {proposal.salesperson_email && (
                  <a href={`mailto:${proposal.salesperson_email}?subject=Enquiry — ${encodeURIComponent(proposal.client_name)}`}
                    className="inline-block mt-4 bg-green hover:bg-mint text-charcoal font-bold px-5 py-2 rounded-lg text-sm transition-colors">
                    Get in Touch →
                  </a>
                )}
              </div>
            )}
          </div>
          <p className="text-border text-[11px] leading-relaxed mt-10">
            Commercial in confidence. May not be replicated or distributed. Tariffs applicable 1 April 2025 – 31 March 2026.
            GHG: 0.94 tCO₂e/MWh. Water: 1.4 L/kWh coal avg. EU CBAM subject to formal certification. 20yr savings indicative.
          </p>
        </section>

      </div>
    </div>
  );
}
