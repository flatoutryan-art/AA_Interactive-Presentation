'use client';

/**
 * Apollo Africa — Proposal Admin
 * Route: /  (app/page.tsx)
 *
 * Depth from project root: 1 level  →  lib is at ../lib/supabaseClient
 */

import { useState } from 'react';
import { supabase, MONTH_KEYS, MONTH_LABELS } from '../lib/supabaseClient';
import type { Proposal, MonthlyProfile } from '../lib/supabaseClient';

// ─── helpers ─────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'apollo2026';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const emptyMonths = (): Record<string, string> =>
  Object.fromEntries(MONTH_KEYS.map((k) => [k, '']));

// ─── sub-components ──────────────────────────────────────────────────────────

type FieldProps = {
  label:        string;
  name:         string;
  value:        string;
  onChange:     (v: string) => void;
  type?:        string;
  placeholder?: string;
  half?:        boolean;
};

function Field({ label, name, value, onChange, type = 'text', placeholder = '', half = false }: FieldProps) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label
        htmlFor={name}
        className="block text-[#86EFAC] text-xs font-semibold uppercase tracking-wider mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white rounded-lg
                   px-3 py-2.5 text-sm outline-none focus:border-[#10B981]
                   transition-colors placeholder:text-[#1E4D30]"
      />
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="col-span-2 pt-4 pb-1 border-t border-[#1E4D30] mt-2">
      <p className="text-[#10B981] text-xs font-bold uppercase tracking-[0.25em]">
        {title}
      </p>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────
export default function AdminPage() {
  // ── auth state
  const [authed,   setAuthed]   = useState(false);
  const [pw,       setPw]       = useState('');
  const [pwError,  setPwError]  = useState('');

  // ── form state
  const [saving,       setSaving]       = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [error,        setError]        = useState('');

  const [f, setF] = useState({
    client_name:           '',
    slug:                  '',
    contract_date:         '',
    supply_window_closes:  '',
    contract_mwh:          '',
    customer_load_mwh:     '',
    green_coverage_pct:    '70',
    tariff_5yr:            '',
    tariff_10yr:           '',
    tariff_15yr:           '',
    eskom_tariff:          '1.49',
    savings_5yr:           '',
    savings_10yr:          '',
    savings_15yr:          '',
    forex_exposure_pct:    '55',
    volume_guarantee_pct:  '70',
    credit_support_5yr:    '5.3',
    credit_support_10yr:   '5.3',
    credit_support_15yr:   '5',
    escalation_cpi:        '4.5',
    eskom_escalation:      '6.0',
    salesperson_name:      '',
    salesperson_email:     '',
    salesperson_phone:     '',
  });

  const [monthlySupply, setMonthlySupply] = useState<Record<string, string>>(emptyMonths());
  const [monthlyLoad,   setMonthlyLoad]   = useState<Record<string, string>>(emptyMonths());

  // ── setters
  const setField = (key: string) => (val: string) => {
    setF((prev) => ({
      ...prev,
      [key]: val,
      ...(key === 'client_name' ? { slug: slugify(val) } : {}),
    }));
  };

  // ── auth
  const handleAuth = () => {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
      setPwError('');
    } else {
      setPwError('Incorrect password. Please try again.');
    }
  };

  // ── submit
  const handleSubmit = async () => {
    setError('');
    setSaving(true);

    try {
      const supply = Object.fromEntries(
        MONTH_KEYS.map((k) => [k, Number(monthlySupply[k]) || 0])
      ) as MonthlyProfile;

      const load = Object.fromEntries(
        MONTH_KEYS.map((k) => [k, Number(monthlyLoad[k]) || 0])
      ) as MonthlyProfile;

      // Build payload — omit generated/auto columns
      const payload: Omit<Proposal, 'id' | 'created_at' | 'carbon_savings'> = {
        slug:                  f.slug,
        client_name:           f.client_name,
        contract_date:         f.contract_date    || undefined,
        supply_window_closes:  f.supply_window_closes || undefined,
        contract_mwh:          Number(f.contract_mwh),
        customer_load_mwh:     Number(f.customer_load_mwh)  || 0,
        green_coverage_pct:    Number(f.green_coverage_pct),
        monthly_supply:        supply,
        monthly_load:          load,
        tariff_5yr:            Number(f.tariff_5yr),
        tariff_10yr:           Number(f.tariff_10yr),
        tariff_15yr:           Number(f.tariff_15yr),
        eskom_tariff:          Number(f.eskom_tariff),
        savings_5yr:           Number(f.savings_5yr),
        savings_10yr:          Number(f.savings_10yr),
        savings_15yr:          Number(f.savings_15yr),
        forex_exposure_pct:    Number(f.forex_exposure_pct),
        volume_guarantee_pct:  Number(f.volume_guarantee_pct),
        credit_support_5yr:    Number(f.credit_support_5yr),
        credit_support_10yr:   Number(f.credit_support_10yr),
        credit_support_15yr:   Number(f.credit_support_15yr),
        escalation_cpi:        Number(f.escalation_cpi),
        eskom_escalation:      Number(f.eskom_escalation),
        salesperson_name:      f.salesperson_name  || undefined,
        salesperson_email:     f.salesperson_email || undefined,
        salesperson_phone:     f.salesperson_phone || undefined,
      };

      const { error: dbErr } = await supabase
        .from('proposals')
        .upsert(payload, { onConflict: 'slug' });

      if (dbErr) throw dbErr;

      const base =
        process.env.NEXT_PUBLIC_BASE_URL ??
        (typeof window !== 'undefined' ? window.location.origin : '');

      setGeneratedUrl(`${base}/${f.slug}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — AUTH GATE
  // ══════════════════════════════════════════════════════════════════════════
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0D1B14] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-8 space-y-6">

          {/* Logo */}
          <div className="flex items-end gap-2">
            <svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true">
              <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9" />
              <path d="M14 6L24 28H14V6Z" fill="#10B981" />
            </svg>
            <div>
              <p className="text-white text-xl font-black tracking-tight leading-none">
                APOLLO <span className="text-[#10B981]">AFRICA</span>
              </p>
              <p className="text-[#C9A84C] text-[9px] font-bold uppercase tracking-[0.25em]">
                a Reunert company
              </p>
            </div>
          </div>

          <p className="text-[#86EFAC] text-sm">
            Enter your admin password to access the proposal generator.
          </p>

          <div className="space-y-3">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              placeholder="Admin password"
              className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white
                         rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#10B981]
                         transition-colors placeholder:text-[#2D5A3D]"
            />
            {pwError && (
              <p className="text-red-400 text-xs">{pwError}</p>
            )}
            <button
              onClick={handleAuth}
              className="w-full bg-[#10B981] hover:bg-[#34D399] text-[#0D1B14]
                         font-bold py-2.5 rounded-lg text-sm transition-colors"
            >
              Unlock Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — ADMIN FORM
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0D1B14] py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-end gap-2">
            <svg width="24" height="28" viewBox="0 0 28 32" fill="none" aria-hidden="true">
              <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9" />
              <path d="M14 6L24 28H14V6Z" fill="#10B981" />
            </svg>
            <div>
              <p className="text-white text-2xl font-black tracking-tight leading-none">
                APOLLO <span className="text-[#10B981]">AFRICA</span>
              </p>
              <p className="text-[#86EFAC] text-xs mt-0.5">Proposal Generator — Sales Admin</p>
            </div>
          </div>

          {generatedUrl && (
            <a
              href={generatedUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-[#10B981] hover:bg-[#34D399] text-[#0D1B14]
                         font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              View Proposal ↗
            </a>
          )}
        </div>

        {/* Card */}
        <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-8">
          <div className="grid grid-cols-2 gap-4">

            {/* ── Client Details */}
            <SectionDivider title="Client Details" />
            <Field label="Client Name"              name="client_name"           value={f.client_name}           onChange={setField('client_name')}          placeholder="Steyn City Properties" />
            <Field label="URL Slug"                 name="slug"                  value={f.slug}                   onChange={setField('slug')}                 placeholder="steyn-city"            half />
            <Field label="Contract Date"            name="contract_date"         value={f.contract_date}          onChange={setField('contract_date')}        type="date"                         half />
            <Field label="Supply Window Closes"     name="supply_window_closes"  value={f.supply_window_closes}   onChange={setField('supply_window_closes')} type="date"                         half />
            <Field label="Salesperson Name"         name="salesperson_name"      value={f.salesperson_name}       onChange={setField('salesperson_name')}     half />
            <Field label="Salesperson Email"        name="salesperson_email"     value={f.salesperson_email}      onChange={setField('salesperson_email')}    type="email"                        half />
            <Field label="Salesperson Phone"        name="salesperson_phone"     value={f.salesperson_phone}      onChange={setField('salesperson_phone')}    half />

            {/* ── Technical Overview */}
            <SectionDivider title="Technical Overview" />
            <Field label="Contracted Supply (MWh/yr)"         name="contract_mwh"       value={f.contract_mwh}       onChange={setField('contract_mwh')}       type="number" placeholder="14840" half />
            <Field label="Customer Electrical Load (MWh/yr)"  name="customer_load_mwh"  value={f.customer_load_mwh}  onChange={setField('customer_load_mwh')}  type="number" placeholder="21208" half />
            <Field label="Green Coverage (%)"                  name="green_coverage_pct" value={f.green_coverage_pct} onChange={setField('green_coverage_pct')} type="number" placeholder="70"    half />

            {/* Monthly Supply */}
            <div className="col-span-2 mt-2">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-wider mb-2">
                Monthly Apollo Supply [MWh]
              </p>
              <div className="grid grid-cols-6 gap-2">
                {MONTH_KEYS.map((k, i) => (
                  <div key={k}>
                    <p className="text-[#4ADE80] text-xs mb-1 text-center">{MONTH_LABELS[i]}</p>
                    <input
                      type="number"
                      value={monthlySupply[k]}
                      onChange={(e) =>
                        setMonthlySupply((p) => ({ ...p, [k]: e.target.value }))
                      }
                      className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white
                                 rounded px-2 py-1.5 text-sm text-center outline-none
                                 focus:border-[#10B981] transition-colors"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Load */}
            <div className="col-span-2 mt-2">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-wider mb-2">
                Monthly Electrical Load [MWh]
              </p>
              <div className="grid grid-cols-6 gap-2">
                {MONTH_KEYS.map((k, i) => (
                  <div key={k}>
                    <p className="text-[#4ADE80] text-xs mb-1 text-center">{MONTH_LABELS[i]}</p>
                    <input
                      type="number"
                      value={monthlyLoad[k]}
                      onChange={(e) =>
                        setMonthlyLoad((p) => ({ ...p, [k]: e.target.value }))
                      }
                      className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white
                                 rounded px-2 py-1.5 text-sm text-center outline-none
                                 focus:border-[#10B981] transition-colors"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── TOU Tariffs */}
            <SectionDivider title="TOU Weighted Average Tariffs [R/kWh]" />
            <Field label="5-Year Tariff"                     name="tariff_5yr"    value={f.tariff_5yr}    onChange={setField('tariff_5yr')}   type="number" placeholder="1.43" half />
            <Field label="10-Year Tariff"                    name="tariff_10yr"   value={f.tariff_10yr}   onChange={setField('tariff_10yr')}  type="number" placeholder="1.41" half />
            <Field label="15-Year Tariff"                    name="tariff_15yr"   value={f.tariff_15yr}   onChange={setField('tariff_15yr')}  type="number" placeholder="1.34" half />
            <Field label="Eskom WEPS Tariff (comparison)"   name="eskom_tariff"  value={f.eskom_tariff}  onChange={setField('eskom_tariff')} type="number" placeholder="1.49" half />

            {/* ── Savings */}
            <SectionDivider title="Cumulative Savings Forecast [Mill ZAR]" />
            <Field label="5-Year Savings"  name="savings_5yr"  value={f.savings_5yr}  onChange={setField('savings_5yr')}  type="number" placeholder="26"  half />
            <Field label="10-Year Savings" name="savings_10yr" value={f.savings_10yr} onChange={setField('savings_10yr')} type="number" placeholder="81"  half />
            <Field label="15-Year Savings" name="savings_15yr" value={f.savings_15yr} onChange={setField('savings_15yr')} type="number" placeholder="189" half />

            {/* ── Commercial Terms */}
            <SectionDivider title="Commercial Terms" />
            <Field label="Forex Exposure (%)"            name="forex_exposure_pct"   value={f.forex_exposure_pct}   onChange={setField('forex_exposure_pct')}   type="number" placeholder="55"  half />
            <Field label="Volume Guarantee (%)"          name="volume_guarantee_pct" value={f.volume_guarantee_pct} onChange={setField('volume_guarantee_pct')} type="number" placeholder="70"  half />
            <Field label="Credit Support 5yr [ZAR mill]"  name="credit_support_5yr"  value={f.credit_support_5yr}   onChange={setField('credit_support_5yr')}   type="number" placeholder="5.3" half />
            <Field label="Credit Support 10yr [ZAR mill]" name="credit_support_10yr" value={f.credit_support_10yr}  onChange={setField('credit_support_10yr')}  type="number" placeholder="5.3" half />
            <Field label="Credit Support 15yr [ZAR mill]" name="credit_support_15yr" value={f.credit_support_15yr}  onChange={setField('credit_support_15yr')}  type="number" placeholder="5"   half />

            {/* ── Escalation */}
            <SectionDivider title="Escalation Assumptions" />
            <Field label="CPI Escalation (%/yr)"           name="escalation_cpi"      value={f.escalation_cpi}      onChange={setField('escalation_cpi')}      type="number" placeholder="4.5" half />
            <Field label="Eskom Tariff Escalation (%/yr)"  name="eskom_escalation"    value={f.eskom_escalation}    onChange={setField('eskom_escalation')}    type="number" placeholder="6.0" half />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-5 bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Generated URL */}
          {generatedUrl && (
            <div className="mt-5 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4">
              <p className="text-[#86EFAC] text-xs mb-1 font-semibold uppercase tracking-widest">
                Proposal URL Generated
              </p>
              <a
                href={generatedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#10B981] font-mono text-sm break-all hover:underline"
              >
                {generatedUrl}
              </a>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !f.client_name || !f.slug}
            className="mt-6 w-full bg-[#10B981] hover:bg-[#34D399] disabled:opacity-40
                       disabled:cursor-not-allowed text-[#0D1B14] font-bold py-3
                       rounded-xl text-base tracking-wide transition-colors"
          >
            {saving ? 'Saving to Supabase…' : '⚡ Generate Proposal'}
          </button>
        </div>

        <p className="text-[#1E4D30] text-xs text-center mt-6">
          Apollo Africa — a Reunert company · NERSA/TRD09/2024 · Commercial in confidence
        </p>
      </div>
    </div>
  );
}
