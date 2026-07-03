'use client';

/**
 * app/[slug]/ProposalClient.tsx
 * 
 * Two gates before the proposal is shown:
 *   1. Legal / Confidentiality Notice — client must accept before viewing
 *   2. Optional link password (if NEXT_PUBLIC_PROPOSAL_PASSWORD is set)
 * 
 * Gate state is stored in sessionStorage so it only shows once per session.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  supabase, MONTH_KEYS, MONTH_LABELS,
  getTariff, getAvailableTerms,
} from '../../lib/supabaseClient';
import type { Proposal, TouBreakdown } from '../../lib/supabaseClient';

const Charts = dynamic(() => import('./Charts'), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-2xl bg-elevated/40 animate-pulse" style={{ height: 240 }} />
  ),
});

type Term = 5 | 10 | 15;

const CARBON_TAX_ZAR        = 80 * 18.5;
const ESKOM_WATER_L_PER_KWH = 1.4;
const TREES_PER_TON         = 45;

const safe = (n: unknown): number =>
  typeof n === 'number' && isFinite(n) ? n : 0;

const fmt = (n: number, dp = 2): string =>
  safe(n).toLocaleString('en-ZA', {
    minimumFractionDigits: dp, maximumFractionDigits: dp,
  });

const fmtMill = (n: number): string => `R${fmt(safe(n), 0)}m`;

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
};

export type TRow = {
  year: number; apollo: number; eskom: number;
  annual: number; cumul: number;
};

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

export type Zone = { id: 'A'|'B'|'C'; label: string; color: string; cbam: boolean };
export function getZone(pct: number): Zone {
  if (pct >= 130) return { id:'C', label:'Carbon Neutral',  color:'#C9A84C', cbam:true  };
  if (pct >= 100) return { id:'B', label:'Balanced Growth', color:'#34D399', cbam:false };
  return              { id:'A', label:'Maximum Savings',   color:'#10B981', cbam:false };
}

// ─── Legal Gate ───────────────────────────────────────────────────────────────
function LegalGate({ clientName, onAccept }: { clientName: string; onAccept: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-end gap-2.5 mb-8 justify-center">
          <svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true">
            <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9"/>
            <path d="M14 6L24 28H14V6Z" fill="#10B981"/>
          </svg>
          <div>
            <p className="font-display text-2xl font-black text-offwhite leading-none tracking-tight">
              APOLLO <span className="text-green">AFRICA</span>
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">a Reunert company</p>
          </div>
        </div>

        {/* Notice card */}
        <div className="bg-forest border border-border rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 border border-gold/30 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h1 className="font-display font-black text-offwhite text-2xl leading-tight">
              Confidential Proposal
            </h1>
            <p className="text-green text-sm font-semibold mt-1">Prepared exclusively for {clientName}</p>
          </div>

          {/* Legal text */}
          <div className="bg-charcoal/60 border border-border rounded-xl p-5 mb-6 text-xs text-muted leading-relaxed space-y-3">
            <p>
              <strong className="text-offwhite">CONFIDENTIALITY NOTICE:</strong> This document and the information
              contained herein is strictly confidential and is intended solely for the named recipient above.
            </p>
            <p>
              This proposal contains commercially sensitive information relating to energy pricing, tariff structures,
              and financial projections prepared by Apollo Africa (Pty) Ltd, a Reunert company
              (NERSA Licence TRD09/2024).
            </p>
            <p>
              By accessing this proposal you agree that you will not copy, distribute, reproduce or disclose
              any part of its contents to any third party without the prior written consent of Apollo Africa.
              Unauthorised use or disclosure may constitute a breach of confidentiality and/or applicable law.
            </p>
            <p>
              The financial projections contained herein are indicative only and are based on information
              available at the time of preparation. Tariffs are applicable from 1 April 2026 and escalate
              annually at CPI. Apollo Africa accepts no liability for decisions made in reliance on this document.
            </p>
            <p className="text-border">
              © {new Date().getFullYear()} Apollo Africa (Pty) Ltd. All rights reserved.
              Registered in South Africa. A Reunert company.
            </p>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-6 group">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={checked}
                onChange={e => setChecked(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                checked
                  ? 'bg-green border-green'
                  : 'bg-elevated border-border group-hover:border-green/50'
              }`}>
                {checked && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#0D1B14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-muted leading-relaxed">
              I confirm that I am the intended recipient of this proposal and I agree to the{' '}
              <strong className="text-offwhite">confidentiality terms</strong> above. I will not
              share or distribute this document without Apollo Africa's prior written consent.
            </span>
          </label>

          {/* Accept button */}
          <button
            onClick={onAccept}
            disabled={!checked}
            className="w-full bg-green hover:bg-mint disabled:opacity-30 disabled:cursor-not-allowed
                       text-charcoal font-bold py-3.5 rounded-xl text-base tracking-wide transition-colors"
          >
            Accept & View Proposal
          </button>

          <p className="text-center text-[11px] text-border mt-4">
            NERSA Licensed Energy Trader · TRD09/2024 · Commercial in confidence
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, accent=false }: {
  label: string; value: string; sub?: string; accent?: boolean;
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

function SHead({ eye, title }: { eye: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-green mb-2">{eye}</p>
      <h2 className="font-display font-black text-offwhite leading-tight text-3xl md:text-4xl">{title}</h2>
    </div>
  );
}

function HR() { return <div className="border-t border-border" />; }

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/apollo-logo.png"
        alt="Apollo Africa"
        style={{ height: 48, width: 'auto', objectFit: 'contain' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <svg width="22" height="26" viewBox="0 0 28 32" fill="none" aria-hidden="true"
        style={{ display: 'none' }}>
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
  const [proposal,     setProposal]    = useState<Proposal | null>(null);
  const [loading,      setLoading]     = useState(true);
  const [notFound,     setNotFound]    = useState(false);
  const [legalAccepted,setLegalAccepted] = useState(false);
  const [term,         setTerm]        = useState<Term>(5);
  const [coveragePct,  setCoveragePct] = useState<number | null>(null);
  const [eskomEscPct,  setEskomEscPct] = useState<number>(6);

  // Check sessionStorage for prior acceptance (persists within tab session)
  useEffect(() => {
    const key = `apollo_legal_${slug}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(key) === 'accepted') {
      setLegalAccepted(true);
    }
  }, [slug]);

  const handleLegalAccept = () => {
    const key = `apollo_legal_${slug}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, 'accepted');
    }
    setLegalAccepted(true);
  };

  // Fetch proposal
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
          const p = data as Proposal;
          setProposal(p);
          const cov = p.green_coverage_pct;
          setCoveragePct(cov && cov > 0 ? Math.round(cov) : 70);
          const available = getAvailableTerms(p);
          setTerm(available[0] ?? 5);
          if (p.eskom_escalation) setEskomEscPct(p.eskom_escalation);
        }
        setLoading(false);
      });
  }, [slug]);

  if (loading || coveragePct === null) return <LoadingScreen />;
  if (notFound || !proposal)           return <NotFoundScreen />;

  // Show legal gate before the proposal
  if (!legalAccepted) {
    return <LegalGate clientName={proposal.client_name} onAccept={handleLegalAccept} />;
  }

  // ── Available terms
  const availableTerms = getAvailableTerms(proposal);

  // ── Safe reads
  const p = {
    mwh:        safe(proposal.contract_mwh),
    load:       safe(proposal.customer_load_mwh),
    defaultCov: safe(proposal.green_coverage_pct) || 70,
    eskom:      safe(proposal.eskom_tariff) || 1.49,
    s5:         safe(proposal.savings_5yr  ?? 0),
    s10:        safe(proposal.savings_10yr ?? 0),
    s15:        safe(proposal.savings_15yr ?? 0),
    c5:         safe(proposal.credit_support_5yr),
    c10:        safe(proposal.credit_support_10yr),
    c15:        safe(proposal.credit_support_15yr),
    volGuar:    safe(proposal.volume_guarantee_pct) || 70,
    cpi:        safe(proposal.escalation_cpi)   || 4.5,
    esEsc:      safe(proposal.eskom_escalation) || 6.0,
  };

  const baseTariff  = getTariff(proposal, term as 5|10|15);
  const baseSavings =
    term === 5  ? p.s5  :
    term === 10 ? p.s10 :
                  p.s15;
  const baseCredit  =
    term === 5  ? p.c5  :
    term === 10 ? p.c10 :
                  p.c15;

  const activeTou: TouBreakdown | null =
    term === 5  ? (proposal.tou_5yr  ?? null) :
    term === 10 ? (proposal.tou_10yr ?? null) :
                  (proposal.tou_15yr ?? null);

  const fraction   = coveragePct / 100;
  const generated  = p.load > 0 ? p.load * fraction : p.mwh * fraction;
  const effective  = Math.min(generated, p.load || generated);
  const spillMwh   = Math.max(0, generated - (p.load || generated));
  const spillPct   = generated > 0 ? (spillMwh / generated) * 100 : 0;
  const ghgAnnual  = generated * 0.94;
  const discount   = p.eskom > 0 ? ((p.eskom - baseTariff) / p.eskom) * 100 : 0;
  const zone       = getZone(coveragePct);

  const annualSavingY1   = ((effective * p.eskom) - (generated * baseTariff)) * 1000 / 1_000_000;
  const defaultGenMwh    = p.load > 0 ? p.load * (p.defaultCov / 100) : p.mwh;
  const defaultAnnualY1  = ((defaultGenMwh * p.eskom) - (defaultGenMwh * baseTariff)) * 1000 / 1_000_000;
  const savingsRatio     = defaultAnnualY1 > 0 ? annualSavingY1 / defaultAnnualY1 : 1;
  const adjSavings       = Math.max(0, baseSavings * savingsRatio);

  const traj = buildTrajectory(
    baseTariff, p.eskom, generated, p.load, p.cpi, eskomEscPct, term
  );

  const covScale      = p.defaultCov > 0 ? coveragePct / p.defaultCov : 1;
  const monthlySupply = MONTH_KEYS.map(k =>
    safe((proposal.monthly_supply as Record<string,number>)[k]) * covScale
  );
  const monthlyLoad = MONTH_KEYS.map(k =>
    safe((proposal.monthly_load as Record<string,number>)[k])
  );

  const monthlyChartData = MONTH_LABELS.map((month, i) => ({
    month,
    supply: Math.round(monthlySupply[i]),
    load:   Math.round(monthlyLoad[i]),
    spill:  Math.round(Math.max(0, monthlySupply[i] - monthlyLoad[i])),
  }));

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

  const tariffBars = availableTerms.map(t => ({
    term: `${t}yr`,
    apollo: getTariff(proposal, t),
    eskom: p.eskom,
  }));

  const totalKwh       = generated * 1000 * term;
  const ghgTotal       = ghgAnnual * term;
  const waterML        = (totalKwh * ESKOM_WATER_L_PER_KWH) / 1_000_000;
  const trees          = ghgTotal * TREES_PER_TON;
  const cars           = ghgTotal / 2.1;
  const avoidedTaxMill = (ghgAnnual * CARBON_TAX_ZAR) / 1_000_000;

  const savings = { s5: p.s5, s10: p.s10, s15: p.s15 };
  const tariffs = {
    t5:    getTariff(proposal, 5),
    t10:   getTariff(proposal, 10),
    t15:   getTariff(proposal, 15),
    eskom: p.eskom,
  };

  return (
    <div className="min-h-screen bg-charcoal text-offwhite font-sans">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest via-charcoal to-charcoal">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#10B981 1px,transparent 1px),linear-gradient(90deg,#10B981 1px,transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        <div className="relative max-w-4xl mx-auto px-5 pt-12 pb-20">
          <div className="flex items-center justify-between mb-12">
            <Logo />
            <div className="text-right">
              <p className="text-xs text-muted">Strategic Energy Roadmap</p>
              {proposal.contract_date && (
                <p className="text-xs text-dim">{fmtDate(proposal.contract_date)}</p>
              )}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-green/10 border border-green/30 rounded-full px-4 py-1.5 mb-5">
            <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
            <span className="text-green text-[11px] font-bold uppercase tracking-[0.2em]">
              Securing Renewable Energy Supply
            </span>
          </div>
          <h1 className="font-display font-black leading-[0.93] mb-5"
            style={{ fontSize: 'clamp(48px,10vw,88px)' }}>
            <span className="text-offwhite">Go Greener,</span><br />
            <span className="text-green">Pay Less.</span>
          </h1>
          <p className="text-muted text-lg max-w-lg leading-relaxed mb-5">
            Your tailored clean energy roadmap for{' '}
            <strong className="text-offwhite">{proposal.client_name}</strong>.
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

      {/* ── STICKY TERM BAR ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-border bg-charcoal/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-5 py-2.5 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-forest border border-border rounded-xl p-1">
            {availableTerms.map(t => (
              <button key={t} onClick={() => setTerm(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  term === t ? 'bg-green text-charcoal' : 'text-muted hover:text-offwhite'
                }`}>
                {t}yr
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest"
            style={{ borderColor: zone.color+'60', background: zone.color+'18', color: zone.color }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: zone.color }} />
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
              sub={coveragePct === p.defaultCov ? 'contracted default' :
                   coveragePct < p.defaultCov   ? 'below contracted'  : 'above contracted'} />
            <Stat label="Vol. Guarantee"  value={`${p.volGuar}%`}           sub="contracted" />
            <Stat label="Spillage"        value={`${fmt(spillPct,1)}%`}     sub={`${fmt(spillMwh,0)} MWh excess`} />
            <Stat label="Credit Support"  value={`R${fmt(baseCredit,1)}m`}  sub="ZAR million" />
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
                  style={{ borderColor: zone.color+'80', background: zone.color+'20', color: zone.color }}>
                  {coveragePct === p.defaultCov
                    ? `Contracted (${p.defaultCov}%)`
                    : coveragePct < p.defaultCov ? 'Below Contracted'
                    : coveragePct < 100 ? 'Uplifted'
                    : coveragePct < 130 ? 'At/Above 100%'
                    : 'Carbon-Neutral Zone'}
                </span>
                <span className="text-offwhite font-mono font-bold text-xl">{coveragePct}%</span>
              </div>
            </div>
            <div className="relative mt-5 mb-2 py-4">
              <input type="range" min={10} max={150} step={1}
                value={coveragePct}
                onChange={e => setCoveragePct(Number(e.target.value))}
                className="w-full rounded-full appearance-none cursor-pointer"
                style={{
                  touchAction: 'none',
                  background: `linear-gradient(to right,${zone.color} 0%,${zone.color} ${
                    ((coveragePct-10)/140)*100
                  }%,#1E4D30 ${((coveragePct-10)/140)*100}%,#1E4D30 100%)`,
                }}
              />
              <div className="absolute flex flex-col items-center pointer-events-none"
                style={{ left: `${((p.defaultCov-10)/140)*100}%`, top: '100%', transform: 'translateX(-50%)' }}>
                <div className="w-px h-3 bg-green/70" />
                <span className="text-[9px] text-green font-bold whitespace-nowrap mt-0.5">
                  ▲ Contracted ({p.defaultCov}%)
                </span>
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide mt-6 mb-4">
              <span className="text-green">Zone A: Max Savings</span>
              <span className="text-mint">Zone B: Balanced</span>
              <span className="text-gold">Zone C: CBAM</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { id:'A', label:'Zone A',   title:'Max Savings',   range:'10–99%',  desc:'Maximum cash flow. Ideal for CFO cost mandates.',      color:'#10B981' },
                { id:'B', label:'Zone B',   title:'Balanced',      range:'100–129%',desc:'Full green load coverage. Future-proofed.',             color:'#34D399' },
                { id:'C', label:'Zone C ✦', title:'Carbon Neutral',range:'130–150%',desc:'EU CBAM compliant. Premium green pricing for exports.', color:'#C9A84C' },
              ] as const).map(z => {
                const active = zone.id === z.id;
                return (
                  <div key={z.id} className="rounded-xl border p-3 text-center transition-all duration-300"
                    style={{ borderColor: active?z.color+'aa':'#1E4D30', background: active?z.color+'18':'#0F2318' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: z.color }}>{z.label}</p>
                    <p className="text-offwhite text-xs font-bold">{z.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: z.color }}>{z.range}</p>
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
          <div className={`rounded-2xl border p-6 transition-all duration-500 ${
            zone.cbam ? 'bg-gold/5 border-gold/50' : 'bg-forest border-border'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Carbon &amp; EU CBAM Analysis</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-500"
                style={{
                  borderColor: zone.cbam?'#C9A84C':'#1E4D30',
                  background:  zone.cbam?'rgba(201,168,76,0.15)':'rgba(30,77,48,0.5)',
                  color:       zone.cbam?'#C9A84C':'#86EFAC',
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: zone.cbam?'#C9A84C':'#86EFAC' }} />
                {zone.cbam ? 'EU CBAM Compliant ✓' : 'Standard Savings'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-4">
              {[
                { label:'GHG Avoided / yr',   value: fmt(ghgAnnual,0),             unit:'tCO₂e' },
                { label:'Avoided Carbon Tax',  value: fmtMill(avoidedTaxMill),      unit:'per year @ $80/ton' },
                { label:'EU Carbon Price',     value: `R${fmt(CARBON_TAX_ZAR,0)}`,  unit:'per ton (R18.50/$)' },
              ].map(item => (
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
                  At 130%+ green coverage your business qualifies for EU Carbon Border Adjustment
                  Mechanism compliance — protecting exports and enabling premium green pricing.
                </p>
              </div>
            )}
            <p className="text-border text-[11px] mt-4">Based on EU ETS Q1 2025 forward rate at R18.50/USD. Informational only.</p>
          </div>
        </section>

        <HR />

        {/* ── CHARTS ─────────────────────────────────────────────────────── */}
        <Charts
          term={term}
          availableTerms={availableTerms}
          coveragePct={coveragePct}
          defaultCov={p.defaultCov}
          monthlyChartData={monthlyChartData}
          dayChartData={dayChartData}
          traj={traj}
          tariffBars={tariffBars}
          cpi={p.cpi}
          esEsc={p.esEsc}
          eskomEscPct={eskomEscPct}
          spillMwh={spillMwh}
          onTermChange={(t) => setTerm(t as Term)}
          onEskomEscChange={setEskomEscPct}
          savings={savings}
          tariffs={tariffs}
          adjSavings={adjSavings}
          activeTou={activeTou}
        />

        <HR />

        {/* ── ENVIRONMENTAL ──────────────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="Environmental Impact" title="Your Green Legacy" />
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="bg-forest border border-border rounded-2xl p-6 grid grid-cols-2 gap-6">
              {[
                { label:'Annual GHG',     value:fmt(ghgAnnual,0),      unit:'tCO₂e / year',   color:'text-green'    },
                { label:`${term}-yr Total`,value:fmt(ghgTotal,0),      unit:'Total tCO₂e',    color:'text-mint'     },
                { label:'Coverage',       value:`${coveragePct}%`,     unit:'of total load',  color:'text-offwhite' },
                { label:'Energy Source',  value:'Wind & Solar',         unit:'100% renewable', color:'text-offwhite' },
              ].map(item => (
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
                {['Certified renewable energy supply','Verifiable GHG reduction reporting',
                  'ESG & TCFD compliance ready','NERSA licensed: TRD09/2024','EU CBAM-ready documentation'].map(b => (
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
                { icon:'💧', label:'Water Saved',   value:fmt(waterML,1),             unit:'million litres', note:'vs coal generation' },
                { icon:'🌳', label:'Tree Equiv.',   value:fmt(trees,0),               unit:'trees planted',  note:'carbon absorption equiv.' },
                { icon:'🚗', label:'Cars Off Road', value:fmt(cars,0),                unit:'vehicles/year',  note:'tailpipe equivalent' },
                { icon:'⚡', label:'Clean Energy',  value:fmt(totalKwh/1_000_000,1),  unit:'million kWh',    note:`over ${term} years` },
              ].map(item => (
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
              { n:'01', title:'Letter of Intent',   body:'Reserve your supply using your meter numbers.',                c:'#10B981' },
              { n:'02', title:'Heads of Terms',      body:'Continues reservation of your supply allocation.',            c:'#34D399' },
              { n:'03', title:'Power Purchase Agmt', body:'CPPA conclusion locks your supply definitively.',             c:'#6EE7B7' },
              { n:'04', title:'Update Your ESA',     body:'Update your Electricity Supply Agreement with Eskom.',        c:'#34D399' },
              { n:'05', title:'Receive Supply',      body:'Green energy wheeled to your business — start saving today.',c:'#10B981' },
            ].map(step => (
              <div key={step.n} className="bg-forest border border-border rounded-2xl p-4">
                <p className="font-display text-5xl font-black leading-none mb-2" style={{ color:step.c+'22' }}>{step.n}</p>
                <p className="text-sm font-bold mb-1.5" style={{ color:step.c }}>{step.title}</p>
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
            Commercial in confidence. May not be replicated or distributed. Tariffs applicable 1 April 2026.
            GHG: 0.94 tCO₂e/MWh. Water: 1.4 L/kWh coal avg. EU CBAM subject to formal certification.
          </p>
        </section>

      </div>
    </div>
  );
}
