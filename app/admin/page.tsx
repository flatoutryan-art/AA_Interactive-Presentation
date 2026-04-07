'use client';
import { useState } from 'react';
import { supabase, type Proposal } from '@/lib/supabaseClient';

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'apollo2026';

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminForm() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    client_name: '',
    slug: '',
    contract_date: '',
    supply_window_closes: '',
    contract_mwh: '',
    customer_load_mwh: '',
    green_coverage_pct: '70',
    tariff_5yr: '',
    tariff_10yr: '',
    tariff_15yr: '',
    eskom_tariff: '1.49',
    savings_5yr: '',
    savings_10yr: '',
    savings_15yr: '',
    forex_exposure_pct: '55',
    volume_guarantee_pct: '70',
    credit_support_5yr: '5.3',
    credit_support_10yr: '5.3',
    credit_support_15yr: '5',
    escalation_cpi: '4.5',
    eskom_escalation: '6.0',
    salesperson_name: '',
    salesperson_email: '',
    salesperson_phone: '',
  });

  const [monthlySupply, setMonthlySupply] = useState<Record<string, string>>(
    Object.fromEntries(MONTHS.map(m => [m, '']))
  );
  const [monthlyLoad, setMonthlyLoad] = useState<Record<string, string>>(
    Object.fromEntries(MONTHS.map(m => [m, '']))
  );

  const handleAuth = () => {
    if (pw === ADMIN_PASSWORD) { setAuthed(true); setPwError(''); }
    else setPwError('Incorrect password');
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm(f => ({
      ...f,
      [k]: v,
      ...(k === 'client_name' ? { slug: slugify(v) } : {}),
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      const supply = Object.fromEntries(MONTHS.map(m => [m, Number(monthlySupply[m]) || 0]));
      const load   = Object.fromEntries(MONTHS.map(m => [m, Number(monthlyLoad[m])   || 0]));
      const mwh = Number(form.contract_mwh);

      const payload: Omit<Proposal, 'id' | 'created_at' | 'carbon_savings'> = {
        slug: form.slug,
        client_name: form.client_name,
        contract_date: form.contract_date || undefined,
        supply_window_closes: form.supply_window_closes || undefined,
        contract_mwh: mwh,
        customer_load_mwh: Number(form.customer_load_mwh) || 0,
        green_coverage_pct: Number(form.green_coverage_pct),
        monthly_supply: supply as any,
        monthly_load:   load   as any,
        tariff_5yr:  Number(form.tariff_5yr),
        tariff_10yr: Number(form.tariff_10yr),
        tariff_15yr: Number(form.tariff_15yr),
        eskom_tariff: Number(form.eskom_tariff),
        savings_5yr:  Number(form.savings_5yr),
        savings_10yr: Number(form.savings_10yr),
        savings_15yr: Number(form.savings_15yr),
        forex_exposure_pct:   Number(form.forex_exposure_pct),
        volume_guarantee_pct: Number(form.volume_guarantee_pct),
        credit_support_5yr:  Number(form.credit_support_5yr),
        credit_support_10yr: Number(form.credit_support_10yr),
        credit_support_15yr: Number(form.credit_support_15yr),
        escalation_cpi: Number(form.escalation_cpi),
        eskom_escalation: Number(form.eskom_escalation),
        salesperson_name:  form.salesperson_name  || undefined,
        salesperson_email: form.salesperson_email || undefined,
        salesperson_phone: form.salesperson_phone || undefined,
      };

      const { error: dbErr } = await supabase.from('proposals').upsert(payload, { onConflict: 'slug' });
      if (dbErr) throw dbErr;
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
      setGeneratedUrl(`${base}/${form.slug}`);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  /* ── AUTH GATE ── */
  if (!authed) return (
    <div className="min-h-screen bg-[#0D1B14] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-[#10B981] text-3xl font-black tracking-tighter">APOLLO</span>
          <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest mt-1">Africa</span>
        </div>
        <p className="text-[#86EFAC] text-sm">Admin access required</p>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAuth()}
          placeholder="Enter password"
          className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#10B981] transition-colors"
        />
        {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
        <button
          onClick={handleAuth}
          className="w-full bg-[#10B981] hover:bg-[#34D399] text-[#0D1B14] font-bold py-2.5 rounded-lg text-sm transition-colors"
        >
          Unlock
        </button>
      </div>
    </div>
  );

  /* ── FORM ── */
  const Field = ({ label, name, type = 'text', placeholder = '', half = false }: any) => (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-[#86EFAC] text-xs font-semibold uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={(form as any)[name]}
        onChange={set(name)}
        placeholder={placeholder}
        className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#10B981] transition-colors placeholder:text-[#1E4D30]"
      />
    </div>
  );

  const Section = ({ title }: { title: string }) => (
    <div className="col-span-2 pt-4 pb-1 border-t border-[#1E4D30] mt-2">
      <p className="text-[#10B981] text-xs font-bold uppercase tracking-widest">{title}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0D1B14] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[#10B981] text-4xl font-black tracking-tighter">APOLLO</span>
            <span className="text-[#C9A84C] text-xs font-bold uppercase tracking-widest ml-2">Africa</span>
            <p className="text-[#86EFAC] text-sm mt-1">Proposal Generator — Sales Admin</p>
          </div>
          {generatedUrl && (
            <a href={generatedUrl} target="_blank" rel="noreferrer"
               className="bg-[#10B981] text-[#0D1B14] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#34D399] transition-colors">
              View Proposal ↗
            </a>
          )}
        </div>

        <div className="bg-[#0F2318] border border-[#1E4D30] rounded-2xl p-8">
          <div className="grid grid-cols-2 gap-4">
            <Section title="Client Details" />
            <Field label="Client Name" name="client_name" placeholder="Steyn City Properties" />
            <Field label="URL Slug" name="slug" placeholder="steyn-city" half />
            <Field label="Contract Date" name="contract_date" type="date" half />
            <Field label="Supply Window Closes" name="supply_window_closes" type="date" half />
            <Field label="Salesperson Name" name="salesperson_name" half />
            <Field label="Salesperson Email" name="salesperson_email" type="email" half />
            <Field label="Salesperson Phone" name="salesperson_phone" half />

            <Section title="Technical Overview" />
            <Field label="Contracted Supply (MWh/yr)" name="contract_mwh" type="number" half placeholder="14840" />
            <Field label="Customer Electrical Load (MWh/yr)" name="customer_load_mwh" type="number" half placeholder="21208" />
            <Field label="Green Coverage (%)" name="green_coverage_pct" type="number" half placeholder="70" />

            {/* Monthly Supply */}
            <div className="col-span-2 mt-2">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-wider mb-2">Monthly Apollo Supply [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTHS.map((m, i) => (
                  <div key={m}>
                    <p className="text-[#4ADE80] text-xs mb-1 text-center">{MONTH_LABELS[i]}</p>
                    <input
                      type="number"
                      value={monthlySupply[m]}
                      onChange={e => setMonthlySupply(p => ({ ...p, [m]: e.target.value }))}
                      className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white rounded px-2 py-1.5 text-sm text-center outline-none focus:border-[#10B981] transition-colors"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Load */}
            <div className="col-span-2 mt-2">
              <p className="text-[#86EFAC] text-xs font-semibold uppercase tracking-wider mb-2">Monthly Electrical Load [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTHS.map((m, i) => (
                  <div key={m}>
                    <p className="text-[#4ADE80] text-xs mb-1 text-center">{MONTH_LABELS[i]}</p>
                    <input
                      type="number"
                      value={monthlyLoad[m]}
                      onChange={e => setMonthlyLoad(p => ({ ...p, [m]: e.target.value }))}
                      className="w-full bg-[#1A3A28] border border-[#1E4D30] text-white rounded px-2 py-1.5 text-sm text-center outline-none focus:border-[#10B981] transition-colors"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Section title="TOU Weighted Average Tariffs [R/kWh]" />
            <Field label="5-Year Tariff" name="tariff_5yr" type="number" half placeholder="1.43" />
            <Field label="10-Year Tariff" name="tariff_10yr" type="number" half placeholder="1.41" />
            <Field label="15-Year Tariff" name="tariff_15yr" type="number" half placeholder="1.34" />
            <Field label="Eskom WEPS Tariff (comparison)" name="eskom_tariff" type="number" half placeholder="1.49" />

            <Section title="Cumulative Savings Forecast [Mill ZAR]" />
            <Field label="5-Year Savings" name="savings_5yr" type="number" half placeholder="26" />
            <Field label="10-Year Savings" name="savings_10yr" type="number" half placeholder="81" />
            <Field label="15-Year Savings" name="savings_15yr" type="number" half placeholder="189" />

            <Section title="Commercial Terms" />
            <Field label="Forex Exposure (%)" name="forex_exposure_pct" type="number" half placeholder="55" />
            <Field label="Volume Guarantee (%)" name="volume_guarantee_pct" type="number" half placeholder="70" />
            <Field label="Credit Support 5yr [ZAR mill]"  name="credit_support_5yr"  type="number" half placeholder="5.3" />
            <Field label="Credit Support 10yr [ZAR mill]" name="credit_support_10yr" type="number" half placeholder="5.3" />
            <Field label="Credit Support 15yr [ZAR mill]" name="credit_support_15yr" type="number" half placeholder="5" />

            <Section title="Escalation Assumptions" />
            <Field label="CPI Escalation (%/yr)" name="escalation_cpi" type="number" half placeholder="4.5" />
            <Field label="Eskom Tariff Escalation (%/yr)" name="eskom_escalation" type="number" half placeholder="6.0" />
          </div>

          {error && (
            <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          )}

          {generatedUrl && (
            <div className="mt-4 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-4">
              <p className="text-[#86EFAC] text-xs mb-1">Proposal URL generated:</p>
              <a href={generatedUrl} target="_blank" rel="noreferrer"
                 className="text-[#10B981] font-mono text-sm break-all hover:underline">
                {generatedUrl}
              </a>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !form.client_name || !form.slug}
            className="mt-6 w-full bg-[#10B981] hover:bg-[#34D399] disabled:opacity-40 text-[#0D1B14] font-bold py-3 rounded-xl text-base tracking-wide transition-colors"
          >
            {saving ? 'Saving…' : '⚡ Generate Proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}
