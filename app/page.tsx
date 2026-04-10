'use client';

/**
 * app/admin/page.tsx
 * Route: /admin
 * Depth: 2 levels → ../../lib/supabaseClient
 */

import { useState } from 'react';
import { supabase, MONTH_KEYS, MONTH_LABELS } from '../../lib/supabaseClient';
import type { Proposal, MonthlyProfile } from '../../lib/supabaseClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'apollo2026';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function blank() {
  return Object.fromEntries(MONTH_KEYS.map((k) => [k, '']));
}

// ─── Tiny input component ─────────────────────────────────────────────────────
function Field({
  label, name, value, onChange,
  type = 'text', placeholder = '', half = false,
}: {
  label: string; name: string; value: string;
  onChange: (v: string) => void;
  type?: string; placeholder?: string; half?: boolean;
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label
        htmlFor={name}
        className="block mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-elevated border border-border px-3 py-2.5
                   text-sm text-offwhite placeholder:text-border outline-none
                   focus:border-green transition-colors"
      />
    </div>
  );
}

function Rule({ title }: { title: string }) {
  return (
    <div className="col-span-2 border-t border-border pt-5 mt-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-green">{title}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed]   = useState(false);
  const [pw, setPw]           = useState('');
  const [pwErr, setPwErr]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [url, setUrl]         = useState('');
  const [err, setErr]         = useState('');

  // ── form state (individual useState for each group)
  const [clientName,  setClientName]  = useState('');
  const [slug,        setSlug]        = useState('');
  const [contractDate, setContractDate] = useState('');
  const [swc,         setSwc]         = useState('');   // supply_window_closes
  const [spName,      setSpName]      = useState('');
  const [spEmail,     setSpEmail]     = useState('');
  const [spPhone,     setSpPhone]     = useState('');

  const [mwh,         setMwh]         = useState('');
  const [loadMwh,     setLoadMwh]     = useState('');
  const [coverage,    setCoverage]    = useState('70');

  const [t5,          setT5]          = useState('');
  const [t10,         setT10]         = useState('');
  const [t15,         setT15]         = useState('');
  const [eskom,       setEskom]       = useState('1.49');

  const [s5,          setS5]          = useState('');
  const [s10,         setS10]         = useState('');
  const [s15,         setS15]         = useState('');

  const [forex,       setForex]       = useState('55');
  const [volGuar,     setVolGuar]     = useState('70');
  const [c5,          setC5]          = useState('5.3');
  const [c10,         setC10]         = useState('5.3');
  const [c15,         setC15]         = useState('5');

  const [cpi,         setCpi]         = useState('4.5');
  const [eskomEsc,    setEskomEsc]    = useState('6.0');

  const [supply, setSupply] = useState<Record<string,string>>(blank());
  const [load,   setLoad]   = useState<Record<string,string>>(blank());

  // ── Auth
  function auth() {
    if (pw === ADMIN_PW) { setAuthed(true); setPwErr(''); }
    else setPwErr('Incorrect password.');
  }

  // ── Submit
  async function submit() {
    setErr(''); setSaving(true);
    try {
      const ms = Object.fromEntries(MONTH_KEYS.map(k => [k, Number(supply[k])||0])) as MonthlyProfile;
      const ml = Object.fromEntries(MONTH_KEYS.map(k => [k, Number(load[k])  ||0])) as MonthlyProfile;

      const p: Omit<Proposal, 'id'|'created_at'|'carbon_savings'> = {
        slug, client_name: clientName,
        contract_date: contractDate || undefined,
        supply_window_closes: swc || undefined,
        contract_mwh: Number(mwh),
        customer_load_mwh: Number(loadMwh)||0,
        green_coverage_pct: Number(coverage),
        monthly_supply: ms, monthly_load: ml,
        tariff_5yr: Number(t5), tariff_10yr: Number(t10), tariff_15yr: Number(t15),
        eskom_tariff: Number(eskom),
        savings_5yr: Number(s5), savings_10yr: Number(s10), savings_15yr: Number(s15),
        forex_exposure_pct: Number(forex), volume_guarantee_pct: Number(volGuar),
        credit_support_5yr: Number(c5), credit_support_10yr: Number(c10), credit_support_15yr: Number(c15),
        escalation_cpi: Number(cpi), eskom_escalation: Number(eskomEsc),
        salesperson_name: spName||undefined, salesperson_email: spEmail||undefined, salesperson_phone: spPhone||undefined,
      };

      const { error: dbErr } = await supabase.from('proposals').upsert(p, { onConflict: 'slug' });
      if (dbErr) throw dbErr;

      const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
      setUrl(`${base}/${slug}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setSaving(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH GATE
  // ═══════════════════════════════════════════════════════════════════════════
  if (!authed) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm bg-forest border border-border rounded-2xl p-8 space-y-5">
        {/* Logo */}
        <div className="flex items-end gap-2.5">
          <svg width="24" height="28" viewBox="0 0 28 32" fill="none">
            <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9"/>
            <path d="M14 6L24 28H14V6Z" fill="#10B981"/>
          </svg>
          <div>
            <p className="font-display text-xl font-black text-offwhite leading-none tracking-tight">
              APOLLO <span className="text-green">AFRICA</span>
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">a Reunert company</p>
          </div>
        </div>

        <p className="text-sm text-muted">Admin access required.</p>

        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && auth()}
          placeholder="Password"
          className="w-full bg-elevated border border-border rounded-lg px-4 py-2.5
                     text-sm text-offwhite placeholder:text-border outline-none
                     focus:border-green transition-colors"
        />
        {pwErr && <p className="text-xs text-danger">{pwErr}</p>}
        <button
          onClick={auth}
          className="w-full bg-green hover:bg-mint text-charcoal font-bold
                     py-2.5 rounded-lg text-sm transition-colors"
        >
          Unlock
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN FORM
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-charcoal py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-end gap-2.5">
            <svg width="24" height="28" viewBox="0 0 28 32" fill="none">
              <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9"/>
              <path d="M14 6L24 28H14V6Z" fill="#10B981"/>
            </svg>
            <div>
              <p className="font-display text-2xl font-black text-offwhite leading-none">
                APOLLO <span className="text-green">AFRICA</span>
              </p>
              <p className="text-xs text-muted mt-0.5">Proposal Generator — Sales Admin</p>
            </div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer"
               className="bg-green hover:bg-mint text-charcoal font-bold px-4 py-2
                          rounded-lg text-sm transition-colors">
              View Proposal ↗
            </a>
          )}
        </div>

        {/* Form card */}
        <div className="bg-forest border border-border rounded-2xl p-8">
          <div className="grid grid-cols-2 gap-4">

            <Rule title="Client Details" />
            <Field label="Client Name"           name="client_name"          value={clientName}   onChange={v => { setClientName(v); setSlug(slugify(v)); }} placeholder="Steyn City Properties" />
            <Field label="URL Slug"              name="slug"                 value={slug}         onChange={setSlug}        placeholder="steyn-city"  half />
            <Field label="Contract Date"         name="contract_date"        value={contractDate} onChange={setContractDate} type="date"              half />
            <Field label="Supply Window Closes"  name="supply_window_closes" value={swc}          onChange={setSwc}          type="date"              half />
            <Field label="Salesperson Name"      name="sp_name"              value={spName}       onChange={setSpName}       half />
            <Field label="Salesperson Email"     name="sp_email"             value={spEmail}      onChange={setSpEmail}       type="email"            half />
            <Field label="Salesperson Phone"     name="sp_phone"             value={spPhone}      onChange={setSpPhone}       half />

            <Rule title="Technical Overview" />
            <Field label="Contracted Supply (MWh/yr)"        name="mwh"      value={mwh}      onChange={setMwh}      type="number" placeholder="14840" half />
            <Field label="Customer Electrical Load (MWh/yr)" name="loadMwh"  value={loadMwh}  onChange={setLoadMwh}  type="number" placeholder="21208" half />
            <Field label="Green Coverage (%)"                name="coverage" value={coverage} onChange={setCoverage} type="number" placeholder="70"    half />

            {/* Monthly Supply */}
            <div className="col-span-2 mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Monthly Apollo Supply [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTH_KEYS.map((k, i) => (
                  <div key={k}>
                    <p className="text-[11px] text-dim text-center mb-1">{MONTH_LABELS[i]}</p>
                    <input type="number" value={supply[k]}
                      onChange={e => setSupply(p => ({...p,[k]:e.target.value}))}
                      placeholder="0"
                      className="w-full bg-elevated border border-border rounded-md px-1.5 py-1.5
                                 text-xs text-offwhite text-center outline-none focus:border-green transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Load */}
            <div className="col-span-2 mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Monthly Electrical Load [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTH_KEYS.map((k, i) => (
                  <div key={k}>
                    <p className="text-[11px] text-dim text-center mb-1">{MONTH_LABELS[i]}</p>
                    <input type="number" value={load[k]}
                      onChange={e => setLoad(p => ({...p,[k]:e.target.value}))}
                      placeholder="0"
                      className="w-full bg-elevated border border-border rounded-md px-1.5 py-1.5
                                 text-xs text-offwhite text-center outline-none focus:border-green transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Rule title="TOU Weighted Average Tariffs [R/kWh]" />
            <Field label="5-Year Tariff"               name="t5"    value={t5}    onChange={setT5}    type="number" placeholder="1.43" half />
            <Field label="10-Year Tariff"              name="t10"   value={t10}   onChange={setT10}   type="number" placeholder="1.41" half />
            <Field label="15-Year Tariff"              name="t15"   value={t15}   onChange={setT15}   type="number" placeholder="1.34" half />
            <Field label="Eskom WEPS Tariff"           name="eskom" value={eskom} onChange={setEskom} type="number" placeholder="1.49" half />

            <Rule title="Cumulative Savings [Mill ZAR]" />
            <Field label="5-Year Savings"  name="s5"  value={s5}  onChange={setS5}  type="number" placeholder="26"  half />
            <Field label="10-Year Savings" name="s10" value={s10} onChange={setS10} type="number" placeholder="81"  half />
            <Field label="15-Year Savings" name="s15" value={s15} onChange={setS15} type="number" placeholder="189" half />

            <Rule title="Commercial Terms" />
            <Field label="Forex Exposure (%)"              name="forex"   value={forex}   onChange={setForex}   type="number" placeholder="55"  half />
            <Field label="Volume Guarantee (%)"            name="volGuar" value={volGuar} onChange={setVolGuar} type="number" placeholder="70"  half />
            <Field label="Credit Support 5yr [ZAR mill]"  name="c5"      value={c5}      onChange={setC5}      type="number" placeholder="5.3" half />
            <Field label="Credit Support 10yr [ZAR mill]" name="c10"     value={c10}     onChange={setC10}     type="number" placeholder="5.3" half />
            <Field label="Credit Support 15yr [ZAR mill]" name="c15"     value={c15}     onChange={setC15}     type="number" placeholder="5"   half />

            <Rule title="Escalation Assumptions" />
            <Field label="CPI Escalation (%/yr)"          name="cpi"      value={cpi}      onChange={setCpi}      type="number" placeholder="4.5" half />
            <Field label="Eskom Escalation (%/yr)"        name="eskomEsc" value={eskomEsc} onChange={setEskomEsc} type="number" placeholder="6.0" half />
          </div>

          {err && (
            <div className="mt-5 bg-danger/10 border border-danger/30 rounded-xl p-3 text-danger text-sm">{err}</div>
          )}
          {url && (
            <div className="mt-5 bg-green/10 border border-green/30 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Proposal URL</p>
              <a href={url} target="_blank" rel="noreferrer"
                 className="font-mono text-sm text-green break-all hover:underline">{url}</a>
            </div>
          )}

          <button
            onClick={submit}
            disabled={saving || !clientName || !slug}
            className="mt-6 w-full bg-green hover:bg-mint disabled:opacity-40 disabled:cursor-not-allowed
                       text-charcoal font-bold py-3 rounded-xl text-base tracking-wide transition-colors"
          >
            {saving ? 'Saving…' : '⚡ Generate Proposal'}
          </button>
        </div>

        <p className="text-center text-[11px] text-border mt-6">
          Apollo Africa · a Reunert company · NERSA/TRD09/2024
        </p>
      </div>
    </div>
  );
}
