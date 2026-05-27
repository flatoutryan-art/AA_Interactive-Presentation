'use client';

/**
 * app/admin/page.tsx  — Apollo Africa Proposal Generator
 * Route: /admin
 * Depth: 2 levels → ../../lib/supabaseClient
 *
 * v2 improvements:
 *  1. Drag-and-drop Excel offerbook uploader at top of page
 *  2. Partial-term support — leave 5yr / 10yr / 15yr blank to omit from proposal
 *  3. active_terms[] written to DB so the client view only renders present terms
 *  4. Improved error reporting with full Supabase error detail
 */

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase, MONTH_KEYS, MONTH_LABELS } from '../../lib/supabaseClient';
import type { Proposal, MonthlyProfile } from '../../lib/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'apollo2026';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function blank(): Record<string, string> {
  return Object.fromEntries(MONTH_KEYS.map((k) => [k, '']));
}

// ─── Excel parser ─────────────────────────────────────────────────────────────
// Reads the Apollo Africa offerbook Excel file and returns mapped field values.
// Update cell references to match your actual workbook layout.
// Run with console open (F12) after upload to see raw data and calibrate.
async function parseOfferbook(file: File): Promise<Partial<Record<string, string>> & {
  monthlySupply?: Record<string, string>;
  monthlyLoad?: Record<string, string>;
  _sheetNames?: string[];
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Helper to safely read a cell value
  const cell = (sheet: XLSX.WorkSheet | null, ref: string): string => {
    if (!sheet) return '';
    const c = sheet[ref];
    if (!c) return '';
    const v = c.v;
    if (v === null || v === undefined) return '';
    // Format dates
    if (c.t === 'd') {
      try {
        const d = new Date(v as string | number);
        return d.toISOString().split('T')[0];
      } catch { /* fall through */ }
    }
    return String(v).trim();
  };

  const num = (sheet: XLSX.WorkSheet | null, ref: string): string => {
    const v = cell(sheet, ref);
    const n = parseFloat(v);
    return isNaN(n) ? '' : String(n);
  };

  // Log all sheet names and first 20 rows of each for calibration
  console.log('[Apollo Uploader] Sheet names:', wb.SheetNames);
  wb.SheetNames.forEach(sn => {
    console.log(`[Apollo Uploader] Sheet "${sn}" (first 20 rows):`,
      XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', range: { s: { r: 0, c: 0 }, e: { r: 19, c: 10 } } })
    );
  });

  // Find sheet by partial name match
  const findSheet = (candidates: string[]): XLSX.WorkSheet | null => {
    for (const name of candidates) {
      const found = wb.SheetNames.find(s => s.toLowerCase().includes(name.toLowerCase()));
      if (found) return wb.Sheets[found];
    }
    return null;
  };

  const commSheet    = findSheet(['Commercial', 'Terms', 'Summary', 'Offer', 'Cover']) ?? wb.Sheets[wb.SheetNames[0]];
  const supplySheet  = findSheet(['Supply', 'Profile', 'Monthly', 'Forecast'])         ?? commSheet;
  const savingsSheet = findSheet(['Savings', 'Financial', 'Forecast'])                 ?? commSheet;
  const tariffSheet  = findSheet(['Tariff', 'TOU', 'Price'])                           ?? commSheet;

  // ── READ CELL REFERENCES ─────────────────────────────────────────────────
  // ⚠ IMPORTANT: Update these to match your actual Excel offerbook.
  // Open browser console (F12) after upload to see raw data and find correct cells.
  const clientName       = cell(commSheet,   'B3');
  const contractDate     = cell(commSheet,   'B4');
  const supplyWindowDate = cell(commSheet,   'B5');
  const contractMwh      = num(commSheet,    'C8');
  const customerLoadMwh  = num(commSheet,    'C9');
  const greenCoverage    = num(commSheet,    'C10');
  const volGuarantee     = num(commSheet,    'C12');
  const forexPct         = num(commSheet,    'C13');
  const creditSupport5   = num(commSheet,    'C15');
  const creditSupport10  = num(commSheet,    'D15');
  const creditSupport15  = num(commSheet,    'E15');

  const tariff5yr        = num(tariffSheet,  'C20');
  const tariff10yr       = num(tariffSheet,  'D20');
  const tariff15yr       = num(tariffSheet,  'E20');
  const eskomTariff      = num(tariffSheet,  'F20');

  const savings5yr       = num(savingsSheet, 'C5');
  const savings10yr      = num(savingsSheet, 'D5');
  const savings15yr      = num(savingsSheet, 'E5');

  // Monthly supply + load (columns B–M, adjust row numbers to match your sheet)
  const SUPPLY_ROW = '8';
  const LOAD_ROW   = '12';
  const COLS = ['B','C','D','E','F','G','H','I','J','K','L','M'];

  const monthlySupply: Record<string, string> = {};
  const monthlyLoad:   Record<string, string> = {};
  MONTH_KEYS.forEach((k, i) => {
    monthlySupply[k] = num(supplySheet, `${COLS[i]}${SUPPLY_ROW}`) || '0';
    monthlyLoad[k]   = num(supplySheet, `${COLS[i]}${LOAD_ROW}`)   || '0';
  });

  const slug = clientName ? slugify(clientName) : '';
  return {
    client_name: clientName, slug,
    contract_date: contractDate, supply_window_closes: supplyWindowDate,
    contract_mwh: contractMwh, customer_load_mwh: customerLoadMwh,
    green_coverage_pct: greenCoverage || '70',
    tariff_5yr: tariff5yr, tariff_10yr: tariff10yr, tariff_15yr: tariff15yr,
    eskom_tariff: eskomTariff || '1.49',
    savings_5yr: savings5yr, savings_10yr: savings10yr, savings_15yr: savings15yr,
    forex_exposure_pct: forexPct || '55',
    volume_guarantee_pct: volGuarantee || '70',
    credit_support_5yr: creditSupport5 || '5.3',
    credit_support_10yr: creditSupport10 || '5.3',
    credit_support_15yr: creditSupport15 || '5',
    escalation_cpi: '4.5', eskom_escalation: '6.0',
    monthlySupply, monthlyLoad,
    _sheetNames: wb.SheetNames,
  };
}

// ─── Field component ──────────────────────────────────────────────────────────
function Field({
  label, name, value, onChange,
  type = 'text', placeholder = '', half = false, optional = false,
}: {
  label: string; name: string; value: string;
  onChange: (v: string) => void;
  type?: string; placeholder?: string; half?: boolean; optional?: boolean;
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label htmlFor={name}
        className="block mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
        {label}{optional && <span className="text-border ml-1">(optional)</span>}
      </label>
      <input id={name} type={type} value={value}
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

// ─── Drag-and-Drop Uploader component ─────────────────────────────────────────
function DragDropUploader({ onParsed, disabled }: {
  onParsed: (data: Awaited<ReturnType<typeof parseOfferbook>>) => void;
  disabled?: boolean;
}) {
  const [dragging,   setDragging]   = useState(false);
  const [status,     setStatus]     = useState<'idle'|'parsing'|'done'|'error'>('idle');
  const [message,    setMessage]    = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      setStatus('error');
      setMessage('Please upload an Excel file (.xlsx, .xls, or .xlsm)');
      return;
    }
    setStatus('parsing');
    setMessage('Reading file…');
    try {
      const data = await parseOfferbook(file);
      setSheetNames(data._sheetNames ?? []);
      const filled = Object.entries(data)
        .filter(([k, v]) => !k.startsWith('_') && !['monthlySupply','monthlyLoad'].includes(k) && v !== '')
        .length;
      setStatus('done');
      setMessage(
        filled > 4
          ? `✓ ${filled} fields imported from "${file.name}". Review and adjust below.`
          : `⚠ Only ${filled} fields matched. Sheets found: ${data._sheetNames?.join(', ')}. Check console (F12) to calibrate cell references.`
      );
      onParsed(data);
    } catch (e) {
      setStatus('error');
      setMessage(`Parse failed: ${e instanceof Error ? e.message : 'Unknown error'}. Check console (F12) for details.`);
    }
  }, [onParsed]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) process(file);
  }, [process]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
    // Reset so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="mb-6">
      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : onDrop}
        className={`
          flex flex-col items-center justify-center gap-3
          border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${dragging
            ? 'border-green bg-green/10'
            : status === 'done'
              ? 'border-green/50 bg-green/5'
              : status === 'error'
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-border bg-forest hover:border-green/40 hover:bg-green/5'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          onChange={onFileInput}
          disabled={disabled}
          className="hidden"
        />

        {/* Icon */}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors
          ${dragging ? 'bg-green/20' : 'bg-green/10'}`}>
          {status === 'parsing' ? (
            <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin" />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 12 15 15"/>
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-offwhite font-bold text-base">
            {dragging ? 'Release to import' : status === 'parsing' ? 'Parsing offerbook…' : 'Import Apollo Offerbook'}
          </p>
          <p className="text-muted text-sm mt-1">
            Drag & drop here, or click to browse · .xlsx / .xls / .xlsm
          </p>
          {status === 'idle' && (
            <p className="text-border text-xs mt-2">
              File is parsed locally in your browser — never uploaded to a server
            </p>
          )}
        </div>

        {/* Status message */}
        {(status === 'done' || status === 'error') && (
          <div className={`px-4 py-2.5 rounded-xl text-sm font-medium text-center max-w-md
            ${status === 'done'
              ? 'bg-green/10 border border-green/30 text-green'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {message}
          </div>
        )}
      </label>

      {/* Sheet names helper */}
      {sheetNames.length > 0 && (
        <div className="mt-3 bg-elevated border border-border rounded-xl px-4 py-2.5 text-xs flex flex-wrap gap-1.5 items-center">
          <span className="text-green font-bold uppercase tracking-wider">Sheets found:</span>
          {sheetNames.map(s => (
            <span key={s} className="bg-forest border border-border text-offwhite rounded-md px-2 py-0.5">{s}</span>
          ))}
          <span className="text-border ml-1">· Open console (F12) if fields are blank to calibrate cell references</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  // Auth
  const [authed, setAuthed] = useState(false);
  const [pw,     setPw]     = useState('');
  const [pwErr,  setPwErr]  = useState('');

  // Form state
  const [saving,  setSaving]  = useState(false);
  const [url,     setUrl]     = useState('');
  const [err,     setErr]     = useState('');

  const [clientName,   setClientName]   = useState('');
  const [slug,         setSlug]         = useState('');
  const [contractDate, setContractDate] = useState('');
  const [swc,          setSwc]          = useState('');
  const [spName,       setSpName]       = useState('');
  const [spEmail,      setSpEmail]      = useState('');
  const [spPhone,      setSpPhone]      = useState('');
  const [mwh,          setMwh]          = useState('');
  const [loadMwh,      setLoadMwh]      = useState('');
  const [coverage,     setCoverage]     = useState('70');
  const [t5,           setT5]           = useState('');
  const [t10,          setT10]          = useState('');
  const [t15,          setT15]          = useState('');
  const [eskom,        setEskom]        = useState('1.49');
  const [s5,           setS5]           = useState('');
  const [s10,          setS10]          = useState('');
  const [s15,          setS15]          = useState('');
  const [forex,        setForex]        = useState('55');
  const [volGuar,      setVolGuar]      = useState('70');
  const [c5,           setC5]           = useState('5.3');
  const [c10,          setC10]          = useState('5.3');
  const [c15,          setC15]          = useState('5');
  const [cpi,          setCpi]          = useState('4.5');
  const [eskomEsc,     setEskomEsc]     = useState('6.0');
  const [supply, setSupply] = useState<Record<string,string>>(blank());
  const [load,   setLoad]   = useState<Record<string,string>>(blank());

  // Auth
  function auth() {
    if (pw === ADMIN_PW) { setAuthed(true); setPwErr(''); }
    else setPwErr('Incorrect password.');
  }

  // Excel upload handler
  const handleParsed = useCallback((data: Awaited<ReturnType<typeof parseOfferbook>>) => {
    if (data.client_name)          { setClientName(data.client_name); setSlug(data.slug ?? slugify(data.client_name)); }
    if (data.contract_date)        setContractDate(data.contract_date);
    if (data.supply_window_closes) setSwc(data.supply_window_closes);
    if (data.contract_mwh)         setMwh(data.contract_mwh);
    if (data.customer_load_mwh)    setLoadMwh(data.customer_load_mwh);
    if (data.green_coverage_pct)   setCoverage(data.green_coverage_pct);
    if (data.tariff_5yr)           setT5(data.tariff_5yr);
    if (data.tariff_10yr)          setT10(data.tariff_10yr);
    if (data.tariff_15yr)          setT15(data.tariff_15yr);
    if (data.eskom_tariff)         setEskom(data.eskom_tariff);
    if (data.savings_5yr)          setS5(data.savings_5yr);
    if (data.savings_10yr)         setS10(data.savings_10yr);
    if (data.savings_15yr)         setS15(data.savings_15yr);
    if (data.forex_exposure_pct)   setForex(data.forex_exposure_pct);
    if (data.volume_guarantee_pct) setVolGuar(data.volume_guarantee_pct);
    if (data.credit_support_5yr)   setC5(data.credit_support_5yr);
    if (data.credit_support_10yr)  setC10(data.credit_support_10yr);
    if (data.credit_support_15yr)  setC15(data.credit_support_15yr);
    if (data.monthlySupply)        setSupply(data.monthlySupply);
    if (data.monthlyLoad)          setLoad(data.monthlyLoad);
  }, []);

  // Submit
  async function submit() {
    setErr(''); setSaving(true);
    try {
      const ms = Object.fromEntries(MONTH_KEYS.map(k => [k, Number(supply[k])||0])) as MonthlyProfile;
      const ml = Object.fromEntries(MONTH_KEYS.map(k => [k, Number(load[k])  ||0])) as MonthlyProfile;

      // Determine which terms have data — used by the client view to hide empty terms
      const activeTerms: number[] = [];
      if (t5  && Number(t5)  > 0) activeTerms.push(5);
      if (t10 && Number(t10) > 0) activeTerms.push(10);
      if (t15 && Number(t15) > 0) activeTerms.push(15);
      // If no tariffs entered at all, default to showing all three
      const termsToSave = activeTerms.length > 0 ? activeTerms : [5, 10, 15];

      const p: Omit<Proposal, 'id'|'created_at'|'carbon_savings'> = {
        slug,
        client_name: clientName,
        contract_date:        contractDate || undefined,
        supply_window_closes: swc          || undefined,
        contract_mwh:         Number(mwh)      || 0,
        customer_load_mwh:    Number(loadMwh)  || 0,
        green_coverage_pct:   Number(coverage) || 70,
        monthly_supply: ms,
        monthly_load:   ml,
        tariff_5yr:  Number(t5)  || 0,
        tariff_10yr: Number(t10) || 0,
        tariff_15yr: Number(t15) || 0,
        eskom_tariff: Number(eskom) || 1.49,
        savings_5yr:  Number(s5)  || 0,
        savings_10yr: Number(s10) || 0,
        savings_15yr: Number(s15) || 0,
        forex_exposure_pct:   Number(forex)   || 55,
        volume_guarantee_pct: Number(volGuar) || 70,
        credit_support_5yr:  Number(c5)  || 0,
        credit_support_10yr: Number(c10) || 0,
        credit_support_15yr: Number(c15) || 0,
        escalation_cpi:    Number(cpi)     || 4.5,
        eskom_escalation:  Number(eskomEsc)|| 6.0,
        active_terms: termsToSave,
        salesperson_name:  spName  || undefined,
        salesperson_email: spEmail || undefined,
        salesperson_phone: spPhone || undefined,
      };

      console.log('[Admin] Upserting proposal:', JSON.stringify(p, null, 2));

      const { data: result, error: dbErr } = await supabase
        .from('proposals')
        .upsert(p, { onConflict: 'slug' })
        .select()
        .single();

      if (dbErr) {
        console.error('[Admin] Supabase error:', dbErr);
        throw new Error(`Database error (${dbErr.code}): ${dbErr.message}${dbErr.details ? ` — ${dbErr.details}` : ''}${dbErr.hint ? ` (hint: ${dbErr.hint})` : ''}`);
      }

      console.log('[Admin] Saved proposal:', result);
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
      setUrl(`${base}/${slug}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      console.error('[Admin] Submit error:', e);
    } finally {
      setSaving(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH GATE
  // ══════════════════════════════════════════════════════════════════════════
  if (!authed) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm bg-forest border border-border rounded-2xl p-8 space-y-5">
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
        <input type="password" value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && auth()}
          placeholder="Password"
          className="w-full bg-elevated border border-border rounded-lg px-4 py-2.5
                     text-sm text-offwhite placeholder:text-border outline-none focus:border-green transition-colors"
        />
        {pwErr && <p className="text-xs text-danger">{pwErr}</p>}
        <button onClick={auth}
          className="w-full bg-green hover:bg-mint text-charcoal font-bold py-2.5 rounded-lg text-sm transition-colors">
          Unlock
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN FORM
  // ══════════════════════════════════════════════════════════════════════════
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
               className="bg-green hover:bg-mint text-charcoal font-bold px-4 py-2 rounded-lg text-sm transition-colors">
              View Proposal ↗
            </a>
          )}
        </div>

        {/* ── DRAG & DROP EXCEL UPLOADER ──────────────────────────────────── */}
        <DragDropUploader onParsed={handleParsed} />

        {/* ── HINT ABOUT PARTIAL TERMS ──────────────────────────────────── */}
        <div className="mb-6 bg-forest border border-border rounded-xl px-4 py-3 flex gap-3 items-start">
          <svg className="mt-0.5 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-muted text-xs leading-relaxed">
            <strong className="text-offwhite">Partial terms supported.</strong>{' '}
            Leave 5yr, 10yr, or 15yr tariff fields blank to hide that term from the client proposal.
            Only terms with data will appear in the savings comparison and charts.
          </p>
        </div>

        {/* ── MAIN FORM ──────────────────────────────────────────────────── */}
        <div className="bg-forest border border-border rounded-2xl p-8">
          <div className="grid grid-cols-2 gap-4">

            <Rule title="Client Details" />
            <Field label="Client Name"          name="client_name"          value={clientName}    onChange={v => { setClientName(v); setSlug(slugify(v)); }} placeholder="Steyn City Properties" />
            <Field label="URL Slug"             name="slug"                 value={slug}          onChange={setSlug}           placeholder="steyn-city" half />
            <Field label="Contract Date"        name="contract_date"        value={contractDate}  onChange={setContractDate}   type="date" half />
            <Field label="Supply Window Closes" name="supply_window_closes" value={swc}           onChange={setSwc}            type="date" half />
            <Field label="Salesperson Name"     name="sp_name"              value={spName}        onChange={setSpName}         half optional />
            <Field label="Salesperson Email"    name="sp_email"             value={spEmail}       onChange={setSpEmail}        type="email" half optional />
            <Field label="Salesperson Phone"    name="sp_phone"             value={spPhone}       onChange={setSpPhone}        half optional />

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

            {/* TOU Tariffs — mark all optional so partial terms work */}
            <Rule title="TOU Weighted Average Tariffs [R/kWh]" />
            <div className="col-span-2 text-[11px] text-muted -mt-3 mb-1">
              Leave any term blank to exclude it from the client proposal.
            </div>
            <Field label="5-Year Tariff"     name="t5"    value={t5}    onChange={setT5}    type="number" placeholder="1.43" half optional />
            <Field label="10-Year Tariff"    name="t10"   value={t10}   onChange={setT10}   type="number" placeholder="1.41" half optional />
            <Field label="15-Year Tariff"    name="t15"   value={t15}   onChange={setT15}   type="number" placeholder="1.34" half optional />
            <Field label="Eskom WEPS Tariff" name="eskom" value={eskom} onChange={setEskom} type="number" placeholder="1.49" half />

            <Rule title="Cumulative Savings [Mill ZAR]" />
            <div className="col-span-2 text-[11px] text-muted -mt-3 mb-1">
              Leave blank for any term not included in this offer.
            </div>
            <Field label="5-Year Savings"  name="s5"  value={s5}  onChange={setS5}  type="number" placeholder="26"  half optional />
            <Field label="10-Year Savings" name="s10" value={s10} onChange={setS10} type="number" placeholder="81"  half optional />
            <Field label="15-Year Savings" name="s15" value={s15} onChange={setS15} type="number" placeholder="189" half optional />

            <Rule title="Commercial Terms" />
            <Field label="Forex Exposure (%)"              name="forex"   value={forex}   onChange={setForex}   type="number" placeholder="55"  half />
            <Field label="Volume Guarantee (%)"            name="volGuar" value={volGuar} onChange={setVolGuar} type="number" placeholder="70"  half />
            <Field label="Credit Support 5yr [ZAR mill]"  name="c5"      value={c5}      onChange={setC5}      type="number" placeholder="5.3" half optional />
            <Field label="Credit Support 10yr [ZAR mill]" name="c10"     value={c10}     onChange={setC10}     type="number" placeholder="5.3" half optional />
            <Field label="Credit Support 15yr [ZAR mill]" name="c15"     value={c15}     onChange={setC15}     type="number" placeholder="5"   half optional />

            <Rule title="Escalation Assumptions" />
            <Field label="CPI Escalation (%/yr)"   name="cpi"      value={cpi}      onChange={setCpi}      type="number" placeholder="4.5" half />
            <Field label="Eskom Escalation (%/yr)" name="eskomEsc" value={eskomEsc} onChange={setEskomEsc} type="number" placeholder="6.0" half />
          </div>

          {err && (
            <div className="mt-5 bg-danger/10 border border-danger/30 rounded-xl p-4">
              <p className="text-danger text-sm font-bold mb-1">Error saving proposal</p>
              <p className="text-danger/80 text-xs font-mono whitespace-pre-wrap break-all">{err}</p>
              <p className="text-muted text-xs mt-2">Check the browser console (F12) for full details. Common causes: missing Supabase env vars, slug already exists, or RLS policy.</p>
            </div>
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
