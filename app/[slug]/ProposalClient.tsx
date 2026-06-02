'use client';

/**
 * app/[slug]/ProposalClient.tsx  v3
 *
 * Gate 1: Password entry
 * Gate 2: Legal Notice + "I understand" checkbox → Proceed
 * If not accepted: Contact Us page with "View your offer?" loop
 */

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase, MONTH_KEYS, MONTH_LABELS } from '../../lib/supabaseClient';
import type { Proposal } from '../../lib/supabaseClient';

const Charts = dynamic(() => import('./Charts'), { ssr: false, loading: () => <ChartSkeleton /> });

function ChartSkeleton() {
  return <div className="w-full rounded-xl bg-elevated/40 animate-pulse" style={{ height: 220 }} />;
}

type Term = 3 | 5 | 7 | 10 | 15 | 20;

const CARBON_TAX_ZAR        = 80 * 18.5;
const ESKOM_WATER_L_PER_KWH = 1.4;
const TREES_PER_TON         = 45;
const MASTER_PASSWORD       = 'Apollo@2026';

const safe = (n: unknown): number =>
  typeof n === 'number' && isFinite(n) ? n : 0;

const fmt = (n: number, dp = 2): string =>
  safe(n).toLocaleString('en-ZA', { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtMill = (n: number): string => `R${fmt(safe(n), 0)}m`;

const fmtDate = (iso: string): string => {
  try { return new Date(iso).toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' }); }
  catch { return iso; }
};

export type TRow = { year:number; apollo:number; eskom:number; annual:number; cumul:number };

export function buildTrajectory(apollo0:number, eskom0:number, genMwh:number, load:number, cpi:number, esEsc:number, years:number): TRow[] {
  let a = apollo0||1.43, e = eskom0||1.49, cumul = 0;
  return Array.from({length:years},(_,i) => {
    const eff = Math.min(genMwh,load||genMwh);
    const ann = ((eff*e)-(genMwh*a))*1000/1_000_000;
    cumul += ann;
    const row:TRow = { year:i+1, apollo:parseFloat(a.toFixed(4)), eskom:parseFloat(e.toFixed(4)), annual:parseFloat(ann.toFixed(3)), cumul:parseFloat(cumul.toFixed(3)) };
    a *= 1+cpi/100; e *= 1+esEsc/100;
    return row;
  });
}

export type Zone = { id:'A'|'B'|'C'; label:string; color:string; cbam:boolean };
export function getZone(pct:number): Zone {
  if (pct>=130) return {id:'C',label:'Carbon Neutral', color:'#C9A84C',cbam:true};
  if (pct>=100) return {id:'B',label:'Balanced Growth',color:'#34D399',cbam:false};
  return              {id:'A',label:'Maximum Savings', color:'#10B981',cbam:false};
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────
function Stat({label,value,sub,accent=false}:{label:string;value:string;sub?:string;accent?:boolean}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${accent?'bg-green/10 border-green/40':'bg-forest border-border'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className={`text-xl font-black leading-none ${accent?'text-green':'text-offwhite'}`}>{value}</p>
      {sub && <p className="text-[11px] text-dim mt-0.5">{sub}</p>}
    </div>
  );
}

function SHead({eye,title}:{eye:string;title:string}) {
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
    <img src="/apollo-logo.png" alt="Apollo Africa"
      style={{height:48,width:'auto',objectFit:'contain'}}
      onError={e=>{
        const t=e.currentTarget as HTMLImageElement;
        t.style.display='none';
        const fb=document.getElementById('logo-svg-fallback');
        if(fb) fb.style.display='block';
      }} />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GATE 1 — Password screen
// ══════════════════════════════════════════════════════════════════════════════
function PasswordGate({onUnlock}:{onUnlock:(pw:string)=>boolean}) {
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);

  function attempt() {
    setLoading(true);
    setTimeout(()=>{
      const ok = onUnlock(pw);
      if (!ok) { setErr('Incorrect password. Please contact your Apollo representative.'); setPw(''); }
      setLoading(false);
    }, 600);
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-sans"
      style={{backgroundImage:'linear-gradient(to br, #0F2318, #121212)'}}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <div className="bg-forest border border-border rounded-2xl p-8 space-y-5">
          <div className="text-center">
            <p className="text-offwhite font-bold text-lg">Energy Supply Proposal</p>
            <p className="text-muted text-sm mt-1">Enter your access password to view this offer</p>
          </div>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&attempt()}
            placeholder="Enter password"
            className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-sm text-offwhite placeholder:text-border outline-none focus:border-green transition-colors text-center tracking-widest" />
          {err && <p className="text-danger text-xs text-center">{err}</p>}
          <button onClick={attempt} disabled={!pw||loading}
            className="w-full bg-green hover:bg-mint disabled:opacity-40 text-charcoal font-bold py-3 rounded-xl text-sm transition-colors">
            {loading ? 'Verifying…' : 'Open Proposal →'}
          </button>
          <p className="text-border text-[11px] text-center">Contact your Apollo representative if you have not received your access password.</p>
        </div>
        <p className="text-center text-[10px] text-border mt-6">Apollo Africa · a Reunert company · NERSA/TRD09/2024</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GATE 2 — Legal Notice + checkbox
// ══════════════════════════════════════════════════════════════════════════════
function LegalGate({clientName, onProceed, onDecline}:{clientName:string; onProceed:()=>void; onDecline:()=>void}) {
  const [checked,setChecked]=useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Header bar */}
      <div className="bg-[#0F2318] px-6 py-4 flex items-center justify-between">
        <Logo />
        <p className="text-green text-xs font-bold uppercase tracking-widest">Confidential — {clientName}</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Legal notice header */}
        <div className="bg-[#0F2318] rounded-2xl p-8 mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-white text-2xl font-bold mb-4">Legal Notice</h1>
            <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
              <strong className="text-white">Confidentiality Notice:</strong> This Energy Offer (the "Offer") has been prepared by CBI Electric Apollo (Pty) Ltd ("Apollo") and is provided strictly on a confidential basis to the intended recipient(s) only. By accessing or reviewing this Offer, you agree to maintain its confidentiality and be bound by its terms. If you are not an intended recipient or do not accept these terms, you must cease review, notify the sender, return the Offer to Apollo, and delete it from your system.
            </p>
          </div>
          <div className="flex-shrink-0">
            <Logo />
          </div>
        </div>

        {/* Two-column legal text */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-[#10B981] font-bold text-sm mb-3">Confidentiality:</h3>
            <div className="text-gray-700 text-xs leading-relaxed space-y-3">
              <p>By reviewing, accessing, or possessing this Offer, you agree to maintain the confidentiality of its contents and protect it from unauthorized access or disclosure.</p>
              <p>This Offer may not be circulated, disclosed or otherwise made available (electronically or otherwise) to any persons who did not receive this Offer directly from Apollo.</p>
              <p>This Offer contains proprietary and trade secret information of Apollo and is protected by applicable intellectual property laws. Any unauthorized use, disclosure, or reproduction of this Offer is strictly prohibited and may result in legal action, including but not limited to urgent interdictory relief, damages, and legal fees.</p>
              <p>The confidentiality obligations outlined in this notice extends indefinitely and survive the termination of any agreements or relationships between the parties.</p>
            </div>
          </div>
          <div>
            <h3 className="text-[#10B981] font-bold text-sm mb-3">Disclaimer:</h3>
            <div className="text-gray-700 text-xs leading-relaxed space-y-3">
              <p>This Offer has been prepared solely for information purposes and is provided to you on a no-reliance basis. Certain information contained in this Offer has been obtained from external sources and Apollo is unable to verify its accuracy.</p>
              <p>This Offer does not purport to be all inclusive or to contain all information which recipients may require in relation to Apollo. The information in this Offer is subject to change without notice. Apollo reserves the right, in its absolute discretion, to alter this Offer accordingly, but does not undertake to update this Offer and is not obliged to do so. You acknowledge and agree that to the maximum extent permitted by law, no representation, warranty or undertaking, express or implied, is made by Apollo as to the fairness, accuracy, reliability or completeness of the information, opinions and conclusions in this Offer or any further information supplied by Apollo.</p>
              <p>This notice is subject to the laws of South Africa, and any disputes arising from or related to this Offer shall be subject to the exclusive jurisdiction of the courts of South Africa.</p>
              <p>You acknowledge that you have read, understood, accept and agree to these terms and conditions, including (without limitation) any modifications to them.</p>
            </div>
          </div>
        </div>

        {/* Checkbox + CTA */}
        <div className="border-t border-gray-200 pt-8">
          <label className="flex items-start gap-3 cursor-pointer mb-6 group">
            <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-all ${checked?'bg-[#10B981] border-[#10B981]':'border-gray-300 group-hover:border-[#10B981]'}`}
              onClick={()=>setChecked(v=>!v)}>
              {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-sm text-gray-700 leading-relaxed">
              <strong className="text-gray-900">I understand</strong> — I have read, understood, and agree to the confidentiality obligations and disclaimer outlined above.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onProceed}
              disabled={!checked}
              className={`flex-1 py-4 rounded-xl font-bold text-base transition-all ${checked?'bg-[#10B981] hover:bg-[#34D399] text-[#121212] cursor-pointer':'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              Proceed to Energy Supply Proposal →
            </button>
          </div>
          {!checked && (
            <p className="text-gray-400 text-xs mt-3 text-center">You must check the box above to proceed to the proposal.</p>
          )}
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 px-6 text-center">
        <p className="text-gray-400 text-[11px]">Commercial in confidence. May not be replicated or distributed.</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTACT US — shown when legal notice declined
// ══════════════════════════════════════════════════════════════════════════════
function ContactUs({clientName, salesperson_name, salesperson_email, salesperson_phone, onViewOffer}:{
  clientName:string; salesperson_name?:string; salesperson_email?:string; salesperson_phone?:string; onViewOffer:()=>void;
}) {
  return (
    <div className="min-h-screen font-sans" style={{
      background:'linear-gradient(135deg, #0a2e1a 0%, #0f3d22 40%, #1a5c38 70%, #0f3d22 100%)',
    }}>
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="mb-10 flex justify-center">
            <Logo />
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-white text-3xl font-black mb-2">Contact Us</h2>
              <p className="text-green text-sm mb-6">Your Apollo energy specialist is ready to assist.</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-green text-lg">📞</span>
                  <span className="text-white font-semibold">{salesperson_phone || '+27 31 001 6453'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green text-lg">✉️</span>
                  <a href={`mailto:${salesperson_email||'info@apolloafrica.co.za'}`}
                    className="text-green hover:underline">{salesperson_email||'info@apolloafrica.co.za'}</a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green text-lg">🌐</span>
                  <a href="https://apolloafrica.co.za" target="_blank" rel="noreferrer"
                    className="text-green hover:underline">apolloafrica.co.za</a>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center border border-white/20">
              <p className="text-white text-sm font-semibold mb-1">Energy Supply Proposal</p>
              <p className="text-green text-xs mb-6">{clientName}</p>
              <button
                onClick={onViewOffer}
                className="w-full bg-[#10B981] hover:bg-[#34D399] text-[#121212] font-bold py-3 px-6 rounded-xl text-sm transition-colors">
                VIEW YOUR OFFER?
              </button>
              <p className="text-white/50 text-[11px] mt-3">Returns to the Legal Notice page</p>
            </div>
          </div>
        </div>
      </div>
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

  // Gate state: 'password' → 'legal' → 'declined' → 'proposal'
  const [gate,        setGate]        = useState<'password'|'legal'|'declined'|'proposal'>('password');

  const [term,        setTerm]        = useState<Term>(5);
  const [coveragePct, setCoveragePct] = useState<number | null>(null);
  const [eskomEscPct, setEskomEscPct] = useState<number>(6);

  useEffect(() => {
    supabase.from('proposals').select('*').eq('slug', slug).single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else {
          const p = data as Proposal;
          setProposal(p);
          const firstTerm = (p.active_terms?.[0] ?? 5) as Term;
          setTerm(firstTerm);
          const cov = p.green_coverage_pct;
          setCoveragePct(cov && cov > 0 ? Math.round(cov) : 70);
        }
        setLoading(false);
      });
  }, [slug]);

  const handleUnlock = useCallback((pw: string): boolean => {
    if (!proposal) return false;
    const correct = proposal.proposal_password || MASTER_PASSWORD;
    if (pw === correct || pw === MASTER_PASSWORD) {
      setGate('legal');
      return true;
    }
    return false;
  }, [proposal]);

  if (loading || coveragePct === null) return <LoadingScreen />;
  if (notFound || !proposal)           return <NotFoundScreen />;

  // ── Gates ────────────────────────────────────────────────────────────────
  if (gate === 'password') return <PasswordGate onUnlock={handleUnlock} />;
  if (gate === 'legal')    return (
    <LegalGate
      clientName={proposal.client_name}
      onProceed={() => setGate('proposal')}
      onDecline={() => setGate('declined')}
    />
  );
  if (gate === 'declined') return (
    <ContactUs
      clientName={proposal.client_name}
      salesperson_name={proposal.salesperson_name}
      salesperson_email={proposal.salesperson_email}
      salesperson_phone={proposal.salesperson_phone}
      onViewOffer={() => setGate('legal')}
    />
  );

  // ── Active terms ─────────────────────────────────────────────────────────
  const activeTerms: number[] = proposal.active_terms?.length ? proposal.active_terms : [5, 10, 15];

  // ── Safe reads ────────────────────────────────────────────────────────────
  const p = {
    mwh:        safe(proposal.contract_mwh),
    load:       safe(proposal.customer_load_mwh),
    defaultCov: safe(proposal.green_coverage_pct) || 70,
    t3:         safe(proposal.tariff_3yr)  || 0,
    t5:         safe(proposal.tariff_5yr)  || 1.43,
    t7:         safe(proposal.tariff_7yr)  || 0,
    t10:        safe(proposal.tariff_10yr) || 1.41,
    t15:        safe(proposal.tariff_15yr) || 1.34,
    t20:        safe(proposal.tariff_20yr) || 0,
    eskom:      safe(proposal.eskom_tariff) || 1.49,
    s3:         safe(proposal.savings_3yr),
    s5:         safe(proposal.savings_5yr),
    s7:         safe(proposal.savings_7yr),
    s10:        safe(proposal.savings_10yr),
    s15:        safe(proposal.savings_15yr),
    s20:        safe(proposal.savings_20yr),
    s1:         safe(proposal.year1_savings),
    npv:        safe(proposal.npv_savings),
    c3:         safe(proposal.credit_support_3yr),
    c5:         safe(proposal.credit_support_5yr),
    c7:         safe(proposal.credit_support_7yr),
    c10:        safe(proposal.credit_support_10yr),
    c15:        safe(proposal.credit_support_15yr),
    c20:        safe(proposal.credit_support_20yr),
    volGuar:    safe(proposal.volume_guarantee_pct) || 70,
    cpi:        safe(proposal.escalation_cpi)   || 4.5,
    esEsc:      safe(proposal.eskom_escalation) || 6.0,
    touPeak:    safe(proposal.tou_peak_pct)     || 15,
    touStd:     safe(proposal.tou_standard_pct) || 45,
    touOP:      safe(proposal.tou_offpeak_pct)  || 40,
  };

  // ── Term-derived ──────────────────────────────────────────────────────────
  const baseTariff  = term===3?p.t3 : term===5?p.t5 : term===7?p.t7 : term===10?p.t10 : term===15?p.t15 : p.t20;
  const baseSavings = term===3?p.s3 : term===5?p.s5 : term===7?p.s7 : term===10?p.s10 : term===15?p.s15 : p.s20;
  const baseCredit  = term===3?p.c3 : term===5?p.c5 : term===7?p.c7 : term===10?p.c10 : term===15?p.c15 : p.c20;

  const fraction   = coveragePct / 100;
  const generated  = p.load > 0 ? p.load * fraction : p.mwh * fraction;
  const effective  = Math.min(generated, p.load || generated);
  const spillMwh   = Math.max(0, generated - (p.load || generated));
  const spillPct   = generated > 0 ? (spillMwh / generated) * 100 : 0;
  const ghgAnnual  = generated * 0.94;
  const discount   = p.eskom > 0 ? ((p.eskom - baseTariff) / p.eskom) * 100 : 0;
  const zone       = getZone(coveragePct);

  const defaultGenMwh   = p.load > 0 ? p.load * (p.defaultCov / 100) : p.mwh;
  const annualSavingY1  = ((effective * p.eskom) - (generated * baseTariff)) * 1000 / 1_000_000;
  const defaultAnnualY1 = ((defaultGenMwh * p.eskom) - (defaultGenMwh * baseTariff)) * 1000 / 1_000_000;
  const savingsRatio    = defaultAnnualY1 > 0 ? annualSavingY1 / defaultAnnualY1 : 1;
  const adjSavings      = Math.max(0, baseSavings * savingsRatio);
  const spillPenaltyMill = spillMwh * baseTariff * 1000 / 1_000_000;
  const peakGenMwh       = p.load > 0 ? p.load : p.mwh;
  const peakAnnualY1     = ((peakGenMwh * p.eskom) - (peakGenMwh * baseTariff)) * 1000 / 1_000_000;
  const peakAdjSavings   = baseSavings * (defaultAnnualY1 > 0 ? peakAnnualY1 / defaultAnnualY1 : 1);

  // Year 1 saving — use DB value if available, else computed
  const year1Saving = p.s1 > 0 ? p.s1 : annualSavingY1;
  // Total contract savings = adjSavings (scaled)
  const totalContractSavings = adjSavings;
  // Value return % = total savings / (Apollo rate × generated × term) × 100
  const apolloCostTotal = baseTariff * generated * term * 1000 / 1_000_000;
  const valueReturn     = apolloCostTotal > 0 ? (totalContractSavings / apolloCostTotal) * 100 : 0;
  // NPV — use DB value if available
  const npvSavings = p.npv > 0 ? p.npv : adjSavings * 0.72; // rough 8% discount

  const traj = buildTrajectory(baseTariff, p.eskom, generated, p.load, p.cpi, eskomEscPct, term);

  const covScale      = p.defaultCov > 0 ? coveragePct / p.defaultCov : 1;
  const monthlySupply = MONTH_KEYS.map(k => safe((proposal.monthly_supply as Record<string,number>)[k]) * covScale);
  const monthlyLoad   = MONTH_KEYS.map(k => safe((proposal.monthly_load   as Record<string,number>)[k]));

  const monthlyChartData = MONTH_LABELS.map((month, i) => {
    const rawSupply = monthlySupply[i];
    const loadVal   = monthlyLoad[i];
    const spill     = Math.max(0, rawSupply - loadVal);
    return { month, supply: parseFloat(Math.min(rawSupply, loadVal).toFixed(0)), load: parseFloat(loadVal.toFixed(0)), spill: parseFloat(spill.toFixed(0)) };
  });

  const apolloShape = [0,0,0,0,0,0.05,0.25,0.55,0.80,0.95,1,1,1,0.95,0.85,0.70,0.50,0.30,0.10,0.05,0,0,0,0];
  const loadShape   = [0.35,0.30,0.28,0.28,0.30,0.38,0.55,0.75,0.85,0.80,0.78,0.75,0.72,0.74,0.76,0.80,0.90,1.0,0.98,0.88,0.72,0.60,0.48,0.40];
  const apolloPeak  = (generated / 8760) * 3.2;
  const loadPeak    = ((p.load || generated) / 8760) * 2.8;
  const dayChartData = Array.from({length:24},(_,h) => ({
    hour:`${String(h).padStart(2,'0')}:00`,
    apollo: parseFloat((apolloShape[h]*apolloPeak).toFixed(3)),
    load:   parseFloat((loadShape[h]*loadPeak).toFixed(3)),
    spill:  parseFloat((Math.max(0,apolloShape[h]*apolloPeak-loadShape[h]*loadPeak)).toFixed(3)),
  }));

  const tariffBars = [
    {term:'3yr', apollo:p.t3, eskom:p.eskom},
    {term:'5yr', apollo:p.t5, eskom:p.eskom},
    {term:'7yr', apollo:p.t7, eskom:p.eskom},
    {term:'10yr',apollo:p.t10,eskom:p.eskom},
    {term:'15yr',apollo:p.t15,eskom:p.eskom},
    {term:'20yr',apollo:p.t20,eskom:p.eskom},
  ].filter(b => activeTerms.includes(parseInt(b.term)));

  const totalKwh       = generated * 1000 * term;
  const ghgTotal       = ghgAnnual * term;
  const waterML        = (totalKwh * ESKOM_WATER_L_PER_KWH) / 1_000_000;
  const trees          = ghgTotal * TREES_PER_TON;
  const cars           = ghgTotal / 2.1;
  const avoidedTaxMill = (ghgAnnual * CARBON_TAX_ZAR) / 1_000_000;

  // TOU breakdown for supply table
  const touPeakMwh  = generated * (p.touPeak   / 100);
  const touStdMwh   = generated * (p.touStd    / 100);
  const touOPMwh    = generated * (p.touOP     / 100);

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-charcoal text-offwhite font-sans">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-forest via-charcoal to-charcoal">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{backgroundImage:'linear-gradient(#10B981 1px,transparent 1px),linear-gradient(90deg,#10B981 1px,transparent 1px)',backgroundSize:'60px 60px'}} />
        <div className="relative max-w-4xl mx-auto px-5 pt-12 pb-20">
          <div className="flex items-center justify-between mb-12">
            <Logo />
            <div className="text-right">
              <p className="text-xs text-muted">Energy Supply Proposal</p>
              {proposal.contract_date && <p className="text-xs text-dim">{fmtDate(proposal.contract_date)}</p>}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-green/10 border border-green/30 rounded-full px-4 py-1.5 mb-5">
            <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
            <span className="text-green text-[11px] font-bold uppercase tracking-[0.2em]">Securing Renewable Energy Supply</span>
          </div>
          <h1 className="font-display font-black leading-[0.93] mb-4" style={{fontSize:'clamp(40px,8vw,72px)'}}>
            <span className="text-offwhite">Energy Supply</span><br />
            <span className="text-green">Proposal.</span>
          </h1>
          <p className="text-muted text-lg max-w-xl leading-relaxed mb-2">
            Optimised Energy Solutions. Delivered with Certainty.
          </p>
          <p className="text-dim text-sm max-w-lg mb-6">
            Prepared exclusively for <strong className="text-offwhite">{proposal.client_name}</strong>.
          </p>

          {/* Supply window blocks */}
          <div className="flex flex-wrap gap-3">
            {proposal.supply_window_closes && (
              <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-lg px-4 py-2">
                <span className="text-gold text-[11px] font-bold uppercase tracking-widest">⚠ Supply Window Closes:</span>
                <span className="text-gold text-sm font-semibold">{fmtDate(proposal.supply_window_closes)}</span>
              </div>
            )}
            {proposal.next_supply_window && (
              <div className="inline-flex items-center gap-2 bg-green/10 border border-green/30 rounded-lg px-4 py-2">
                <span className="text-green text-[11px] font-bold uppercase tracking-widest">📅 Next Supply Window:</span>
                <span className="text-green text-sm font-semibold">{fmtDate(proposal.next_supply_window)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── STICKY TERM BAR ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-border bg-charcoal/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-5 py-2.5 flex flex-wrap items-center gap-3">
          {activeTerms.length > 1 ? (
            <div className="flex gap-1 bg-forest border border-border rounded-xl p-1">
              {activeTerms.map(t => (
                <button key={t} onClick={()=>setTerm(t as Term)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${term===t?'bg-green text-charcoal':'text-muted hover:text-offwhite'}`}>
                  {t}yr
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1 bg-forest border border-border rounded-xl px-4 py-1.5">
              <span className="text-sm font-bold text-green">{activeTerms[0]}yr Contract</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest"
            style={{borderColor:zone.color+'60',background:zone.color+'18',color:zone.color}}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:zone.color}} />
            Zone {zone.id}: {zone.label}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5">

        {/* ── SNAPSHOT — 8-box KPI grid ──────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="Your Offer at a Glance" title="Commercial Snapshot" />

          {/* Row 1 — primary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="Contracted Supply"     value={`${fmt(p.mwh,0)} MWh`}     sub="base contracted"              accent />
            <Stat label={`${term}-yr Tariff`}   value={`R${fmt(baseTariff)}/kWh`}  sub={`${fmt(discount,1)}% below Eskom`} />
            <Stat label="Year 1 Savings"        value={fmtMill(year1Saving)}       sub="first contract year"          accent />
            <Stat label="GHG Savings"           value={`${fmt(ghgAnnual,0)} t`}    sub="CO₂e per year" />
          </div>

          {/* Row 2 — financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label={`Total ${term}-yr Savings`} value={fmtMill(totalContractSavings)} sub="cumulative contract"  accent />
            <Stat label="Value Return"               value={`${fmt(valueReturn,1)}%`}       sub="savings on Apollo cost" />
            <Stat label="NPV Savings"                value={fmtMill(npvSavings)}             sub="net present value"   accent />
            <Stat label="Credit Support"             value={`R${fmt(baseCredit,1)}m`}        sub="ZAR million" />
          </div>

          {/* Row 3 — operational */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Green Coverage"  value={`${coveragePct}%`}
              sub={coveragePct===p.defaultCov?'contracted default':coveragePct<p.defaultCov?'below contracted':'above contracted'} />
            <Stat label="Vol. Guarantee"  value={`${p.volGuar}%`}     sub="contracted" />
            <Stat label="Spillage"        value={`${fmt(spillPct,1)}%`} sub={`${fmt(spillMwh,0)} MWh excess`} />
            <Stat label="Annual GHG"      value={`${fmt(ghgAnnual,0)} t`} sub="tCO₂e avoided / yr" />
          </div>
        </section>

        <HR />

        {/* ── APOLLO SUPPLY TABLE — TOU BREAKDOWN ────────────────────────── */}
        <section className="py-14">
          <SHead eye="Energy Delivery" title="Apollo Green Supply" />
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full border-collapse" style={{fontSize:12}}>
              <thead>
                <tr className="border-b border-border bg-forest">
                  <th className="text-left py-3 px-4 text-green font-bold uppercase tracking-widest text-[11px]">Period / TOU</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold text-[11px]">Energy (MWh/yr)</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold text-[11px]">% Allocation</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold text-[11px]">Apollo R/kWh</th>
                  <th className="text-center py-3 px-3 text-muted font-semibold text-[11px]">Eskom WEPS</th>
                  <th className="text-center py-3 px-3 text-green font-semibold text-[11px]">Saving R/kWh</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label:'Peak',     mwh:touPeakMwh, pct:p.touPeak,  apolloRate: baseTariff*1.35, cls:'text-gold' },
                  { label:'Standard', mwh:touStdMwh,  pct:p.touStd,   apolloRate: baseTariff*0.95, cls:'text-offwhite' },
                  { label:'Off-Peak', mwh:touOPMwh,   pct:p.touOP,    apolloRate: baseTariff*0.70, cls:'text-muted' },
                ].map(row => {
                  const eskomRate = row.label==='Peak' ? p.eskom*1.40 : row.label==='Standard' ? p.eskom*0.97 : p.eskom*0.62;
                  const saving = eskomRate - row.apolloRate;
                  return (
                    <tr key={row.label} className="border-b border-border/50 hover:bg-elevated/20 transition-colors">
                      <td className={`py-3 px-4 font-semibold ${row.cls}`}>{row.label}</td>
                      <td className="text-center py-3 px-3 text-offwhite">{fmt(row.mwh, 0)}</td>
                      <td className="text-center py-3 px-3 text-offwhite">{fmt(row.pct, 1)}%</td>
                      <td className="text-center py-3 px-3 text-green font-semibold">{fmt(row.apolloRate)}</td>
                      <td className="text-center py-3 px-3 text-danger">{fmt(eskomRate)}</td>
                      <td className={`text-center py-3 px-3 font-bold ${saving>0?'text-green':saving<0?'text-danger':'text-muted'}`}>
                        {saving>0?'-':saving<0?'+':''}{fmt(Math.abs(saving))}
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="bg-green/5">
                  <td className="py-3 px-4 font-black text-offwhite">Total / WA</td>
                  <td className="text-center py-3 px-3 font-black text-green">{fmt(generated, 0)}</td>
                  <td className="text-center py-3 px-3 font-black text-offwhite">100%</td>
                  <td className="text-center py-3 px-3 font-black text-green">{fmt(baseTariff)}</td>
                  <td className="text-center py-3 px-3 font-black text-danger">{fmt(p.eskom)}</td>
                  <td className="text-center py-3 px-3 font-black text-green">-{fmt(p.eskom - baseTariff)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-dim text-[11px] mt-3">TOU rates are illustrative weightings derived from the weighted average tariff. Actual TOU periods per Eskom WEPS tariff booklet 2026.</p>
        </section>

        <HR />

        {/* ── GREEN COVERAGE SLIDER ──────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="Strategic Control" title="Green Coverage Optimiser" />
          <div className="bg-forest border border-border rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-muted text-sm font-semibold">Green Coverage %</p>
                <p className="text-[11px] text-dim mt-0.5">Default = contracted coverage ({p.defaultCov}%).</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border"
                  style={{borderColor:zone.color+'80',background:zone.color+'20',color:zone.color}}>
                  {coveragePct===p.defaultCov?`Contracted (${p.defaultCov}%)`:coveragePct<p.defaultCov?'Below Contracted':coveragePct<100?'Uplifted':coveragePct<130?'At/Above 100%':'Carbon-Neutral Zone'}
                </span>
                <span className="text-offwhite font-mono font-bold text-xl">{coveragePct}%</span>
              </div>
            </div>
            <div className="relative mt-5 mb-2 py-4">
              <input type="range" min={10} max={150} step={1} value={coveragePct}
                onChange={e=>setCoveragePct(Number(e.target.value))}
                className="w-full rounded-full appearance-none cursor-pointer"
                style={{touchAction:'none',background:`linear-gradient(to right,${zone.color} 0%,${zone.color} ${((coveragePct-10)/140)*100}%,#1E4D30 ${((coveragePct-10)/140)*100}%,#1E4D30 100%)`}} />
              <div className="absolute flex flex-col items-center pointer-events-none"
                style={{left:`${((p.defaultCov-10)/140)*100}%`,top:'100%',transform:'translateX(-50%)'}}>
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
                {id:'A',label:'Zone A',title:'Max Savings',  range:'10–99%', desc:'Maximum cash flow. Ideal for CFO cost mandates.',      color:'#10B981'},
                {id:'B',label:'Zone B',title:'Balanced',     range:'100–129%',desc:'Full green load coverage. Future-proofed.',            color:'#34D399'},
                {id:'C',label:'Zone C ✦',title:'Carbon Neutral',range:'130–150%',desc:'EU CBAM compliant. Premium green pricing.',         color:'#C9A84C'},
              ] as const).map(z=>{
                const active=zone.id===z.id;
                return (
                  <div key={z.id} className="rounded-xl border p-3 text-center transition-all duration-300"
                    style={{borderColor:active?z.color+'aa':'#1E4D30',background:active?z.color+'18':'#0F2318'}}>
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
          {coveragePct > 100 && (
            <div className="mt-4 bg-gold/8 border border-gold/40 rounded-xl p-4 flex gap-3 items-start">
              <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p className="text-gold text-xs font-bold uppercase tracking-widest mb-1">Spillage Savings Impact — {fmt(spillPct,1)}% of supply exceeds load</p>
                <p className="text-muted text-xs leading-relaxed">
                  At {coveragePct}% coverage, <strong className="text-offwhite">{fmt(spillMwh,0)} MWh/yr</strong> of Apollo supply exceeds your electrical load.
                  Apollo bills on all generated MWh at R{fmt(baseTariff)}/kWh — spilled energy has no offsetting Eskom saving,
                  costing approximately <strong className="text-gold">R{fmt(spillPenaltyMill,1)}m/yr</strong> in unrecovered Apollo charges.
                  Net saving: <strong className="text-green">{fmtMill(adjSavings)}</strong> vs peak <strong className="text-offwhite">{fmtMill(peakAdjSavings)}</strong> at 100%.
                </p>
                <p className="text-gold/60 text-[11px] mt-1.5">Tip: keep coverage ≤100% to maximise savings, or ≥130% for EU CBAM compliance.</p>
              </div>
            </div>
          )}
        </section>

        <HR />

        {/* ── CBAM + iRECs ────────────────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="EU Export & Carbon Strategy" title="CBAM Carbon Tax Analysis" />

          {/* Main CBAM card */}
          <div className={`rounded-2xl border p-6 transition-all duration-500 mb-5 ${zone.cbam?'bg-gold/5 border-gold/50':'bg-forest border-border'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Carbon &amp; EU CBAM Analysis</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-500"
                style={{borderColor:zone.cbam?'#C9A84C':'#1E4D30',background:zone.cbam?'rgba(201,168,76,0.15)':'rgba(30,77,48,0.5)',color:zone.cbam?'#C9A84C':'#86EFAC'}}>
                <span className="w-1.5 h-1.5 rounded-full" style={{background:zone.cbam?'#C9A84C':'#86EFAC'}} />
                {zone.cbam?'EU CBAM Compliant ✓':'Standard Savings'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-4">
              {[
                {label:'GHG Avoided / yr',   value:fmt(ghgAnnual,0),            unit:'tCO₂e'},
                {label:'Avoided Carbon Tax',  value:fmtMill(avoidedTaxMill),    unit:'per year @ $80/ton'},
                {label:'EU Carbon Price',     value:`R${fmt(CARBON_TAX_ZAR,0)}`,unit:'per ton (R18.50/$)'},
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
                <p className="text-muted text-xs leading-relaxed">At 130%+ green coverage your business qualifies for EU Carbon Border Adjustment Mechanism compliance — protecting exports and enabling premium green pricing in European markets.</p>
              </div>
            )}
            <p className="text-border text-[11px] mt-4">Based on EU ETS Q1 2025 forward rate at R18.50/USD. Informational only.</p>
          </div>

          {/* iRECs card */}
          <div className="bg-forest border border-border rounded-2xl overflow-hidden">
            {/* Header bar */}
            <div className="bg-green/10 border-b border-green/20 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* iREC leaf/certificate icon */}
                <div className="w-10 h-10 rounded-xl bg-green/20 border border-green/30 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <polyline points="9 12 11 14 15 10"/>
                  </svg>
                </div>
                <div>
                  <p className="text-green font-black text-base leading-none">iRECs Included</p>
                  <p className="text-muted text-[11px] mt-0.5 font-semibold uppercase tracking-wider">International Renewable Energy Certificates</p>
                </div>
              </div>
              <span className="bg-green/15 border border-green/30 text-green text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap">
                Bundled in Tariff ✓
              </span>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* What is an iREC */}
              <div className="mb-5">
                <p className="text-offwhite font-bold text-sm mb-2">What is an iREC?</p>
                <p className="text-muted text-sm leading-relaxed">
                  An <strong className="text-green">International Renewable Energy Certificate (iREC)</strong> is a globally
                  recognised, tradeable instrument that provides verified proof that one megawatt-hour (MWh)
                  of electricity was generated from a certified renewable energy source — wind, solar, or hydro.
                  Each certificate carries a unique serial number and is independently audited under the
                  I-REC Standard framework, ensuring full traceability from generation to retirement.
                </p>
              </div>

              {/* What it means to the customer — 3 benefit tiles */}
              <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-3">What this means for you</p>
              <div className="grid md:grid-cols-3 gap-3 mb-5">
                {[
                  {
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                      </svg>
                    ),
                    title: 'Verified Green Credentials',
                    body: 'Each MWh of Apollo supply you consume is backed by a retired iREC — giving you auditable, third-party proof of renewable energy use for ESG and sustainability reporting.',
                  },
                  {
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                    ),
                    title: 'Corporate ESG & TCFD Ready',
                    body: 'iRECs satisfy Scope 2 greenhouse gas accounting requirements under GHG Protocol and support TCFD, CDP, and JSE sustainability disclosure frameworks — no additional certification required.',
                  },
                  {
                    icon: (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                    ),
                    title: 'EU CBAM & Export Markets',
                    body: 'For businesses exporting to the EU, iRECs provide the documentation required under the Carbon Border Adjustment Mechanism — protecting your products from carbon tariffs and enabling green premium pricing.',
                  },
                ].map(tile => (
                  <div key={tile.title} className="bg-elevated border border-border rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center mb-3">
                      {tile.icon}
                    </div>
                    <p className="text-offwhite text-xs font-bold mb-1.5">{tile.title}</p>
                    <p className="text-dim text-xs leading-relaxed">{tile.body}</p>
                  </div>
                ))}
              </div>

              {/* iREC volume stat */}
              <div className="bg-green/8 border border-green/20 rounded-xl p-4 flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-0.5">Your annual iREC volume</p>
                  <p className="text-green text-3xl font-black leading-none">{fmt(generated, 0)}</p>
                  <p className="text-dim text-xs mt-0.5">certificates / year · 1 iREC = 1 MWh</p>
                </div>
                <div className="h-10 w-px bg-border hidden sm:block" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-0.5">Contract total</p>
                  <p className="text-green text-3xl font-black leading-none">{fmt(generated * term, 0)}</p>
                  <p className="text-dim text-xs mt-0.5">iRECs over {term}-year contract</p>
                </div>
                <div className="h-10 w-px bg-border hidden sm:block" />
                <div className="flex-1 min-w-[160px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Included at no extra cost</p>
                  <p className="text-offwhite text-xs leading-relaxed">
                    iRECs are <strong className="text-green">bundled into your Apollo tariff</strong> — there is no separate
                    certificate purchase, no registry fees, and no additional administration required on your part.
                    Apollo manages the issuance, retirement, and reporting on your behalf.
                  </p>
                </div>
              </div>

              <p className="text-border text-[11px] mt-4">
                iRECs issued under the I-REC Standard (www.irecstandard.org). Each certificate uniquely serialised,
                independently audited, and retired upon delivery. Certificates satisfy GHG Protocol Scope 2
                market-based accounting and are accepted under CDP, TCFD, and JSE ESG frameworks.
              </p>
            </div>
          </div>
        </section>

        <HR />

        {/* ── CHARTS ─────────────────────────────────────────────────────── */}
        <Charts
          term={term}
          coveragePct={coveragePct}
          defaultCov={p.defaultCov}
          monthlyChartData={monthlyChartData}
          dayChartData={dayChartData}
          traj={traj}
          tariffBars={tariffBars}
          cpi={p.cpi}
          esEsc={eskomEscPct}
          spillMwh={spillMwh}
          onTermChange={setTerm}
          savings={{s5:p.s5,s10:p.s10,s15:p.s15}}
          tariffs={{t5:p.t5,t10:p.t10,t15:p.t15,eskom:p.eskom}}
          adjSavings={adjSavings}
          eskomEscPct={eskomEscPct}
          onEskomEscChange={setEskomEscPct}
          activeTerms={activeTerms}
          touPeak={p.touPeak} touStandard={p.touStd} touOffpeak={p.touOP}
        />

        <HR />

        {/* ── ENVIRONMENTAL ──────────────────────────────────────────────── */}
        <section className="py-14">
          <SHead eye="Environmental Impact" title="Your Green Legacy" />
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="bg-forest border border-border rounded-2xl p-6 grid grid-cols-2 gap-6">
              {[
                {label:'Annual GHG',      value:fmt(ghgAnnual,0), unit:'tCO₂e / year',   color:'text-green'},
                {label:`${term}-yr Total`,value:fmt(ghgTotal,0),  unit:'Total tCO₂e',    color:'text-mint'},
                {label:'Coverage',        value:`${coveragePct}%`,unit:'of total load',  color:'text-offwhite'},
                {label:'Energy Source',   value:'Wind & Solar',    unit:'100% renewable', color:'text-offwhite'},
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
              <p className="text-offwhite text-base font-semibold leading-snug mb-5">Certifiably reduce your footprint with traceable RECs and GHG reports.</p>
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
                {icon:'💧',label:'Water Saved',  value:fmt(waterML,1),           unit:'million litres', note:'vs coal generation'},
                {icon:'🌳',label:'Tree Equiv.',  value:fmt(trees,0),             unit:'trees planted',  note:'carbon absorption equiv.'},
                {icon:'🚗',label:'Cars Off Road',value:fmt(cars,0),              unit:'vehicles/year',  note:'tailpipe equivalent'},
                {icon:'⚡',label:'Clean Energy', value:fmt(totalKwh/1_000_000,1),unit:'million kWh',    note:`over ${term} years`},
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

        {/* ── NEXT STEPS — enhanced process flow ──────────────────────── */}
        <section className="py-14">
          <SHead eye="What Happens Next" title="Secure Your Supply" />

          {/* Urgency banner */}
          <div className="bg-green rounded-2xl px-6 py-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-charcoal font-bold text-sm leading-snug">
              Early commitment secures access to the most competitive supply allocation.
            </p>
            <div className="flex items-center gap-2 bg-charcoal/15 rounded-xl px-4 py-2 flex-shrink-0">
              <span className="text-charcoal text-[11px] font-bold uppercase tracking-wider">Supply allocated</span>
              <span className="text-charcoal font-black text-sm">first-come, first-served</span>
            </div>
          </div>

          {/* 5-step process flow */}
          <div className="relative">

            {/* Connector line — desktop only */}
            <div className="hidden md:block absolute top-[52px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-green via-mint to-green/40 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
              {[
                {
                  n: 1,
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  ),
                  title: 'Letter of Intent',
                  abbr:  'LOI',
                  body:  'Reserves your supply allocation and secures capacity off the market.',
                  color: '#10B981',
                  timeline: null,
                },
                {
                  n: 2,
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                  ),
                  title: 'Heads of Terms',
                  abbr:  'HoT*',
                  body:  'Extends and formalises your reserved supply allocation.',
                  color: '#34D399',
                  timeline: '15 days',
                },
                {
                  n: 3,
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <polyline points="9 11 12 14 22 4"/><line x1="16" y1="21" x2="21" y2="21"/><line x1="21" y1="16" x2="21" y2="21"/>
                    </svg>
                  ),
                  title: 'Conclusion of CPPA',
                  abbr:  'CPPA',
                  body:  'Legally secures your long-term price and supply. Energy contracted.',
                  color: '#6EE7B7',
                  timeline: '30 days',
                  highlight: true,
                },
                {
                  n: 4,
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ),
                  title: 'Enable Wheeling',
                  abbr:  'ESA',
                  body:  'Enable wheeling through Eskom or your municipality.',
                  color: '#34D399',
                  timeline: null,
                },
                {
                  n: 5,
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2z"/>
                    </svg>
                  ),
                  title: 'Receive Supply',
                  abbr:  '',
                  body:  'Secure long-term price certainty and gain a competitive advantage.',
                  color: '#10B981',
                  timeline: null,
                },
              ].map((step, idx) => (
                <div key={step.n} className="flex flex-col items-center text-center">

                  {/* Icon circle */}
                  <div className="relative mb-4">
                    <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center border-4 shadow-lg transition-all"
                      style={{
                        background: step.highlight ? step.color : '#0F2318',
                        borderColor: step.color,
                        color: step.highlight ? '#121212' : step.color,
                        boxShadow: `0 0 20px ${step.color}40`,
                      }}>
                      {step.icon}
                    </div>
                    {/* Step number badge */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-charcoal"
                      style={{ background: step.color }}>
                      {step.n}
                    </div>
                  </div>

                  {/* Timeline arrow between steps — mobile */}
                  {idx < 4 && (
                    <div className="md:hidden flex items-center justify-center w-full my-1">
                      <div className="h-6 w-0.5 bg-green/30" />
                    </div>
                  )}

                  {/* Card */}
                  <div className="w-full rounded-2xl border p-4 transition-all"
                    style={{
                      background: step.highlight ? `${step.color}12` : '#0F2318',
                      borderColor: step.highlight ? step.color : '#1E4D30',
                    }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: step.color }}>
                      {step.abbr || `Step ${step.n}`}
                    </p>
                    <p className="text-offwhite text-sm font-bold leading-snug mb-2">{step.title}</p>
                    <p className="text-muted text-xs leading-relaxed">{step.body}</p>

                    {/* Timeline badge */}
                    {step.timeline && (
                      <div className="mt-3 pt-3 border-t flex items-center justify-center gap-1.5" style={{ borderColor: step.color + '30' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={step.color} strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: step.color }}>
                          ~{step.timeline}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline indicator bar */}
          <div className="mt-8 bg-forest border border-border rounded-2xl px-6 py-4 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Typical timeline</p>
            </div>
            {[
              { label: 'LOI → HoT', days: '~15 days', color: '#10B981' },
              { label: 'HoT → CPPA', days: '~30 days', color: '#34D399' },
              { label: 'Total to contracted', days: '~45 days', color: '#6EE7B7' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                <span className="text-dim text-xs">{t.label}:</span>
                <span className="text-offwhite text-xs font-bold">{t.days}</span>
              </div>
            ))}
          </div>

          {/* Next supply window + urgency footer */}
          <div className="mt-4 grid md:grid-cols-2 gap-4">

            {/* Next supply window bubble */}
            <div className="bg-gradient-to-br from-green/20 to-green/5 border border-green/40 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green/20 border border-green/30 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-0.5">Next Supply Window</p>
                <p className="text-offwhite font-black text-xl leading-none">
                  {proposal.next_supply_window ? fmtDate(proposal.next_supply_window) : 'Q1 2028'}
                </p>
                <p className="text-dim text-xs mt-1">Indicative commencement date for new supply</p>
              </div>
            </div>

            {/* Urgency / scarcity callout */}
            <div className="bg-gold/8 border border-gold/40 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gold mb-1">Supply is critically constrained</p>
                <p className="text-muted text-xs leading-relaxed">
                  Wind supply is critically constrained and grid-ready projects are limited.
                  Supply is allocated on a <strong className="text-offwhite">first-come, first-served</strong> basis
                  and released if not secured.
                </p>
              </div>
            </div>
          </div>

          {/* HoT footnote */}
          <p className="text-border text-[11px] mt-4">
            * Signing of a HoT is not a mandatory step — negotiation can move straight to the CPPA should the customer be comfortable.
            Timelines are indicative only.
          </p>
        </section>

        <HR />

        {/* ── FOOTER / CONTACT ───────────────────────────────────────────── */}
        <section className="py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Logo />
              <p className="text-dim text-[11px] font-bold uppercase tracking-widest mt-4">NERSA Licensed Energy Trader · TRD09/2024</p>
              <p className="text-dim text-[11px] font-bold uppercase tracking-[0.12em] mt-2">Green Energy · Expertly Sourced · Seamlessly Delivered</p>
            </div>
            {(proposal.salesperson_name||proposal.salesperson_email) && (
              <div className="bg-forest border border-border rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-green mb-3">Your Apollo Contact</p>
                {proposal.salesperson_name  && <p className="text-offwhite font-bold">{proposal.salesperson_name}</p>}
                {proposal.salesperson_email && (
                  <a href={`mailto:${proposal.salesperson_email}`} className="text-green text-sm hover:underline block mt-1">{proposal.salesperson_email}</a>
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
            GHG: 0.94 tCO₂e/MWh. Water: 1.4 L/kWh coal avg. EU CBAM subject to formal certification.
          </p>
        </section>
      </div>
    </div>
  );
}
