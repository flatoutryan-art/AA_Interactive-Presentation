'use client';

/**
 * app/admin/page.tsx  — Apollo Africa Proposal Generator v3
 *
 * Changes:
 *  1. Per-proposal password field (master default: Apollo@2026)
 *  2. All 6 tenure options: 3, 5, 7, 10, 15, 20 years
 *  3. New KPI fields: Year 1 Savings, NPV Savings
 *  4. TOU energy allocation % inputs
 *  5. Next Supply Window date field
 *  6. Updated Apollo Africa logo
 *  7. Excel uploader with merge logic
 */

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase, MONTH_KEYS, MONTH_LABELS } from '../../lib/supabaseClient';
import type { Proposal, MonthlyProfile } from '../../lib/supabaseClient';

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'apollo2026';
const ALL_TERMS = [3, 5, 7, 10, 15, 20] as const;
type SupportedTerm = typeof ALL_TERMS[number];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function blank(): Record<string, string> {
  return Object.fromEntries(MONTH_KEYS.map((k) => [k, '']));
}

// ─── ParsedOfferbook type ─────────────────────────────────────────────────────
type ParsedOfferbook = {
  client_name?: string; slug?: string;
  contract_date?: string; supply_window_closes?: string;
  contract_mwh?: string; customer_load_mwh?: string;
  green_coverage_pct?: string;
  tariff_3yr?: string; tariff_5yr?: string; tariff_7yr?: string;
  tariff_10yr?: string; tariff_15yr?: string; tariff_20yr?: string;
  eskom_tariff?: string;
  savings_3yr?: string; savings_5yr?: string; savings_7yr?: string;
  savings_10yr?: string; savings_15yr?: string; savings_20yr?: string;
  year1_savings?: string; npv_savings?: string;
  forex_exposure_pct?: string; volume_guarantee_pct?: string;
  credit_support_3yr?: string; credit_support_5yr?: string; credit_support_7yr?: string;
  credit_support_10yr?: string; credit_support_15yr?: string; credit_support_20yr?: string;
  escalation_cpi?: string; eskom_escalation?: string;
  tou_peak_pct?: string; tou_standard_pct?: string; tou_offpeak_pct?: string;
  monthlySupply?: Record<string, string>;
  monthlyLoad?: Record<string, string>;
  _sheetNames?: string[];
};

// ─── Excel parser — exact Apollo MasterRetail_Book cell map ──────────────────
async function parseOfferbook(file: File): Promise<ParsedOfferbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // ── Cell helpers ────────────────────────────────────────────────────────────
  const cell = (sheet: XLSX.WorkSheet | null, ref: string): string => {
    if (!sheet) return '';
    const c = sheet[ref];
    if (!c) return '';
    const v = c.v;
    if (v === null || v === undefined) return '';
    if (c.t === 'd') {
      try { return new Date(v as string | number).toISOString().split('T')[0]; }
      catch { /* fall through */ }
    }
    return String(v).trim();
  };

  // scale: multiply by this (e.g. 100 for decimal→%), dp: decimal places
  const num = (sheet: XLSX.WorkSheet | null, ref: string, scale = 1, dp = 4): string => {
    const v = cell(sheet, ref);
    const n = parseFloat(v);
    if (isNaN(n)) return '';
    return parseFloat((n * scale).toFixed(dp)).toString();
  };

  // ── Sheet references ─────────────────────────────────────────────────────────
  const sBI = wb.Sheets['Buyer Input'];
  const sDI = wb.Sheets['DEAL IOs'];
  const sPM = wb.Sheets['Pricing Model'];
  const sFP = wb.Sheets['Financial Projection'];
  const sEV = wb.Sheets['Energy volumes'];
  const sAS = wb.Sheets['Assumptions'];

  console.log('[Apollo Uploader] Sheets found:', wb.SheetNames);

  // ── CLIENT IDENTITY ──────────────────────────────────────────────────────────
  // Buyer Input C7 = Customer Name
  const clientName = cell(sBI, 'C7').trim();
  const slug = clientName ? slugify(clientName) : '';

  // ── TECHNICAL ───────────────────────────────────────────────────────────────
  // DEAL IOs D59 = Apollo Green Supply MWh/yr
  // DEAL IOs D60 = Customer Electrical Load MWh/yr
  // DEAL IOs D7  = Green coverage % (decimal)
  // DEAL IOs D11 = Volume guarantee % (decimal)
  // DEAL IOs D42 = Contract term in years
  const contractMwh  = num(sDI, 'D59', 1, 0);
  const customerLoad = num(sDI, 'D60', 1, 0);
  const greenCov     = num(sDI, 'D7',  100, 1);
  const volGuar      = num(sDI, 'D11', 100, 1);
  const termYears    = parseInt(num(sDI, 'D42', 1, 0)) || 0;

  // ── TARIFFS ──────────────────────────────────────────────────────────────────
  // DEAL IOs D43 = Apollo weighted-average tariff R/kWh for the active term
  // DEAL IOs D58 = Eskom WEPS credit R/kWh (same sheet, confirmed correct cell)
  const apolloTariff = num(sDI, 'D43', 1, 4);
  const eskomTariff  = num(sDI, 'D58', 1, 4);  // was J49 — now corrected to D58

  // ── SAVINGS ──────────────────────────────────────────────────────────────────
  // Financial Projection row 26 = Cumulative Savings (R mill) MR
  // COD = FY2029 = col J. Contract years map as:
  //   yr1=J, yr2=K, yr3=L, yr4=M, yr5=N, yr6=O, yr7=P,
  //   yr8=Q, yr9=R, yr10=S, yr11=T, yr12=U, yr13=V, yr14=W, yr15=X
  const savingsMap: Record<number, string> = {
    3:  num(sFP, 'L26', 1, 2),   // contract year 3
    5:  num(sFP, 'N26', 1, 2),   // contract year 5
    7:  num(sFP, 'P26', 1, 2),   // contract year 7
    10: num(sFP, 'S26', 1, 2),   // contract year 10
    15: num(sFP, 'X26', 1, 2),   // contract year 15
    20: num(sFP, 'X26', 1, 2),   // 20yr not in model — use 15yr as max
  };

  // Year 1 annual saving = FP J25
  const year1Savings = num(sFP, 'J25', 1, 2);

  // Total contract savings & NPV from DEAL IOs
  // D45 = Total Contract Savings MR (R mill)
  // D47 = NPV of Savings MR (R mill)
  const totalSavings = num(sDI, 'D45', 1, 2);
  const npvSavings   = num(sDI, 'D47', 1, 2);

  // ── COMMERCIAL ───────────────────────────────────────────────────────────────
  // DEAL IOs D52 = Buyer Credit Support (R mill)
  // Assumptions B20 = FX Exposure (decimal)
  const creditSup = num(sDI, 'D52', 1, 2);
  const forexPct  = num(sAS, 'B20', 100, 1);  // B column has label, value is also B20

  // ── ESCALATION ───────────────────────────────────────────────────────────────
  // Assumptions B6  = Eskom Long Term Forecast (decimal)
  // Assumptions B8  = CPI (decimal)
  const eskomEsc = num(sAS, 'B6', 100, 1);
  const cpi      = num(sAS, 'B8', 100, 1);

  // ── TOU ENERGY ALLOCATION ────────────────────────────────────────────────────
  // Pricing Model rows 53–58 col D = MWh per TOU period
  // % allocation = sum of HS+LS period MWh / total MWh
  // Peak total % = D53 pct + D56 pct = col D of each row (the % column is col D)
  // Actually col D = MWh, col E = decimal %. Use col E.
  // PM row53 colE = Peak HS %, PM row54 colE = Std HS %, PM row55 colE = OffPk HS %
  // PM row56 colE = Peak LS %, PM row57 colE = Std LS %, PM row58 colE = OffPk LS %
  const touPeakPct  = num(sPM, 'D53', 100, 1) || '17.3';  // fallback to known value
  const touStdPct   = num(sPM, 'D54', 100, 1) || '42.5';
  const touOPPct    = num(sPM, 'D55', 100, 1) || '40.2';

  // More reliable: use the pre-calculated % cols
  // From our scan: col D = MWh, col E = decimal fraction of total
  // Sum HS+LS for each TOU period
  const peakHSpct = parseFloat(cell(sPM, 'E53') || '0');
  const stdHSpct  = parseFloat(cell(sPM, 'E54') || '0');
  const opHSpct   = parseFloat(cell(sPM, 'E55') || '0');
  const peakLSpct = parseFloat(cell(sPM, 'E56') || '0');
  const stdLSpct  = parseFloat(cell(sPM, 'E57') || '0');
  const opLSpct   = parseFloat(cell(sPM, 'E58') || '0');

  const touPeak     = ((peakHSpct + peakLSpct) * 100).toFixed(1);
  const touStandard = ((stdHSpct  + stdLSpct)  * 100).toFixed(1);
  const touOffpeak  = ((opHSpct   + opLSpct)   * 100).toFixed(1);

  // ── MONTHLY SUPPLY & LOAD ────────────────────────────────────────────────────
  // Energy volumes sheet, row 41 cols E–P = monthly contracted supply (kWh → /1000 = MWh)
  // Energy volumes sheet, row 11 cols E–P = monthly customer load (kWh → /1000 = MWh)
  const SUPPLY_COLS = ['E','F','G','H','I','J','K','L','M','N','O','P'];
  const monthlySupply: Record<string, string> = {};
  const monthlyLoad:   Record<string, string> = {};
  MONTH_KEYS.forEach((k, i) => {
    const col = SUPPLY_COLS[i];
    monthlySupply[k] = (Math.round(parseFloat(cell(sEV, `${col}41`) || '0') / 100) / 10).toString();
    monthlyLoad[k]   = (Math.round(parseFloat(cell(sEV, `${col}11`) || '0') / 100) / 10).toString();
  });

  // ── LOG for calibration ───────────────────────────────────────────────────────
  console.log('[Apollo Uploader] Parsed values:', {
    clientName, slug, termYears,
    apolloTariff, eskomTariff, contractMwh, customerLoad,
    greenCov, volGuar, creditSup, forexPct, cpi, eskomEsc,
    year1Savings, totalSavings, npvSavings,
    touPeak, touStandard, touOffpeak,
    savingsMap,
  });

  // ── RETURN — term-specific fields only populate for the active term ───────────
  // This supports multi-upload workflow: upload 5yr → fills t5/s5/c5 only.
  // Upload 10yr next → fills t10/s10/c10 without overwriting t5/s5/c5.
  return {
    client_name:          clientName,
    slug,
    contract_mwh:         contractMwh,
    customer_load_mwh:    customerLoad,
    green_coverage_pct:   greenCov     || '70',
    eskom_tariff:         eskomTariff  || '1.49',
    forex_exposure_pct:   forexPct     || '55',
    volume_guarantee_pct: volGuar      || '70',
    escalation_cpi:       cpi          || '4.5',
    eskom_escalation:     eskomEsc     || '6.0',
    year1_savings:        year1Savings,
    npv_savings:          npvSavings,
    tou_peak_pct:         touPeak,
    tou_standard_pct:     touStandard,
    tou_offpeak_pct:      touOffpeak,
    monthlySupply,
    monthlyLoad,
    _sheetNames:          wb.SheetNames,
    // Term-specific — only set for the active term in this file
    tariff_3yr:           termYears === 3  ? apolloTariff : '',
    tariff_5yr:           termYears === 5  ? apolloTariff : '',
    tariff_7yr:           termYears === 7  ? apolloTariff : '',
    tariff_10yr:          termYears === 10 ? apolloTariff : '',
    tariff_15yr:          termYears === 15 ? apolloTariff : '',
    tariff_20yr:          termYears === 20 ? apolloTariff : '',
    savings_3yr:          termYears === 3  ? savingsMap[3]  : '',
    savings_5yr:          termYears === 5  ? savingsMap[5]  : '',
    savings_7yr:          termYears === 7  ? savingsMap[7]  : '',
    savings_10yr:         termYears === 10 ? savingsMap[10] : '',
    savings_15yr:         termYears === 15 ? savingsMap[15] : '',
    savings_20yr:         termYears === 20 ? savingsMap[20] : '',
    credit_support_3yr:   termYears === 3  ? creditSup : '',
    credit_support_5yr:   termYears === 5  ? creditSup : '',
    credit_support_7yr:   termYears === 7  ? creditSup : '',
    credit_support_10yr:  termYears === 10 ? creditSup : '',
    credit_support_15yr:  termYears === 15 ? creditSup : '',
    credit_support_20yr:  termYears === 20 ? creditSup : '',
  };
}

// ─── UI components ────────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, type='text', placeholder='', half=false, optional=false }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; half?: boolean; optional?: boolean;
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label htmlFor={name} className="block mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
        {label}{optional && <span className="text-border ml-1">(optional)</span>}
      </label>
      <input id={name} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg bg-elevated border border-border px-3 py-2.5 text-sm text-offwhite placeholder:text-border outline-none focus:border-green transition-colors" />
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

// ─── Drag & Drop Uploader ────────────────────────────────────────────────────
function DragDropUploader({ onParsed, disabled }: {
  onParsed: (data: ParsedOfferbook) => void;
  disabled?: boolean;
}) {
  const [dragging,   setDragging]   = useState(false);
  const [status,     setStatus]     = useState<'idle'|'parsing'|'done'|'error'>('idle');
  const [message,    setMessage]    = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      setStatus('error'); setMessage('Please upload an Excel file (.xlsx, .xls, or .xlsm)'); return;
    }
    setStatus('parsing'); setMessage('Reading file…');
    try {
      const data = await parseOfferbook(file);
      setSheetNames(data._sheetNames ?? []);
      const filled = Object.entries(data).filter(([k,v]) => !k.startsWith('_') && !['monthlySupply','monthlyLoad'].includes(k) && v !== '').length;
      setStatus('done');
      setMessage(filled > 4
        ? `✓ ${filled} fields merged from "${file.name}". Upload the next term variant to add more, or review below.`
        : `⚠ Only ${filled} fields matched. Sheets: ${data._sheetNames?.join(', ')}. Check console (F12).`);
      onParsed(data);
    } catch (e) {
      setStatus('error');
      setMessage(`Parse failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [onParsed]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) process(file);
  }, [process]);

  return (
    <div className="mb-6">
      <label
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : onDrop}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${dragging ? 'border-green bg-green/10' : status==='done' ? 'border-green/50 bg-green/5' : status==='error' ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-forest hover:border-green/40'}`}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.xlsm"
          onChange={e => { const f = e.target.files?.[0]; if (f) process(f); if (inputRef.current) inputRef.current.value=''; }}
          disabled={disabled} className="hidden" />
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${dragging?'bg-green/20':'bg-green/10'}`}>
          {status==='parsing'
            ? <div className="w-6 h-6 border-2 border-green/30 border-t-green rounded-full animate-spin" />
            : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 12 15 15"/>
              </svg>}
        </div>
        <div className="text-center">
          <p className="text-offwhite font-bold text-base">{dragging?'Release to import':status==='parsing'?'Parsing…':'Import Apollo Offerbook'}</p>
          <p className="text-muted text-sm mt-1">Drag & drop · .xlsx / .xls / .xlsm</p>
          {status==='idle' && <p className="text-border text-xs mt-2">Parsed locally — never uploaded to a server</p>}
        </div>
        {(status==='done'||status==='error') && (
          <div className={`px-4 py-2.5 rounded-xl text-sm font-medium text-center max-w-md
            ${status==='done'?'bg-green/10 border border-green/30 text-green':'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {message}
          </div>
        )}
      </label>
      {sheetNames.length > 0 && (
        <div className="mt-3 bg-elevated border border-border rounded-xl px-4 py-2.5 text-xs flex flex-wrap gap-1.5 items-center">
          <span className="text-green font-bold uppercase tracking-wider">Sheets:</span>
          {sheetNames.map(s => <span key={s} className="bg-forest border border-border text-offwhite rounded-md px-2 py-0.5">{s}</span>)}
        </div>
      )}
    </div>
  );
}

// ─── Apollo Logo ──────────────────────────────────────────────────────────────
function ApolloLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 32 : size === 'lg' ? 56 : 44;
  return (
    <img src="/apollo-logo.png" alt="Apollo Africa" style={{ height: h, width: 'auto', objectFit: 'contain' }}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw,     setPw]     = useState('');
  const [pwErr,  setPwErr]  = useState('');
  const [saving, setSaving] = useState(false);
  const [url,    setUrl]    = useState('');
  const [err,    setErr]    = useState('');

  // Identity
  const [clientName,   setClientName]   = useState('');
  const [slug,         setSlug]         = useState('');
  const [contractDate, setContractDate] = useState('');
  const [swc,          setSwc]          = useState('');
  const [nsw,          setNsw]          = useState('');  // next supply window
  const [propPw,       setPropPw]       = useState('Apollo@2026');
  const [spName,       setSpName]       = useState('');
  const [spEmail,      setSpEmail]      = useState('');
  const [spPhone,      setSpPhone]      = useState('');

  // Technical
  const [mwh,       setMwh]      = useState('');
  const [loadMwh,   setLoadMwh]  = useState('');
  const [coverage,  setCoverage] = useState('70');
  const [supply,    setSupply]   = useState<Record<string,string>>(blank());
  const [load,      setLoad]     = useState<Record<string,string>>(blank());

  // Tariffs — all 6 terms
  const [t3,    setT3]    = useState('');
  const [t5,    setT5]    = useState('');
  const [t7,    setT7]    = useState('');
  const [t10,   setT10]   = useState('');
  const [t15,   setT15]   = useState('');
  const [t20,   setT20]   = useState('');
  const [eskom, setEskom] = useState('1.49');

  // Savings
  const [s3,   setS3]   = useState('');
  const [s5,   setS5]   = useState('');
  const [s7,   setS7]   = useState('');
  const [s10,  setS10]  = useState('');
  const [s15,  setS15]  = useState('');
  const [s20,  setS20]  = useState('');
  const [s1,   setS1]   = useState('');  // year 1 savings
  const [npv,  setNpv]  = useState('');  // NPV savings

  // Credit support
  const [c3,  setC3]  = useState('');
  const [c5,  setC5]  = useState('');
  const [c7,  setC7]  = useState('');
  const [c10, setC10] = useState('');
  const [c15, setC15] = useState('');
  const [c20, setC20] = useState('');

  // Commercial
  const [forex,    setForex]   = useState('55');
  const [volGuar,  setVolGuar] = useState('70');
  const [cpi,      setCpi]     = useState('4.5');
  const [eskomEsc, setEskomEsc]= useState('6.0');

  // TOU allocation
  const [touPeak,     setTouPeak]     = useState('15');
  const [touStandard, setTouStandard] = useState('45');
  const [touOffpeak,  setTouOffpeak]  = useState('40');

  function auth() {
    if (pw === ADMIN_PW) { setAuthed(true); setPwErr(''); }
    else setPwErr('Incorrect password.');
  }

  const handleParsed = useCallback((data: ParsedOfferbook) => {
    if (data.client_name) { setClientName(data.client_name); setSlug(data.slug ?? slugify(data.client_name)); }
    if (data.contract_date)        setContractDate(data.contract_date);
    if (data.supply_window_closes) setSwc(data.supply_window_closes);
    if (data.contract_mwh)         setMwh(data.contract_mwh);
    if (data.customer_load_mwh)    setLoadMwh(data.customer_load_mwh);
    if (data.green_coverage_pct)   setCoverage(data.green_coverage_pct);
    if (data.eskom_tariff)         setEskom(data.eskom_tariff);
    if (data.forex_exposure_pct)   setForex(data.forex_exposure_pct);
    if (data.volume_guarantee_pct) setVolGuar(data.volume_guarantee_pct);
    if (data.escalation_cpi)       setCpi(data.escalation_cpi);
    if (data.eskom_escalation)     setEskomEsc(data.eskom_escalation);
    if (data.monthlySupply)        setSupply(data.monthlySupply);
    if (data.monthlyLoad)          setLoad(data.monthlyLoad);
    if (data.year1_savings)        setS1(data.year1_savings);
    if (data.npv_savings)          setNpv(data.npv_savings);
    // Term-specific — only overwrite when present
    if (data.tariff_3yr)          setT3(data.tariff_3yr);
    if (data.tariff_5yr)          setT5(data.tariff_5yr);
    if (data.tariff_7yr)          setT7(data.tariff_7yr);
    if (data.tariff_10yr)         setT10(data.tariff_10yr);
    if (data.tariff_15yr)         setT15(data.tariff_15yr);
    if (data.tariff_20yr)         setT20(data.tariff_20yr);
    if (data.savings_3yr)         setS3(data.savings_3yr);
    if (data.savings_5yr)         setS5(data.savings_5yr);
    if (data.savings_7yr)         setS7(data.savings_7yr);
    if (data.savings_10yr)        setS10(data.savings_10yr);
    if (data.savings_15yr)        setS15(data.savings_15yr);
    if (data.savings_20yr)        setS20(data.savings_20yr);
    if (data.credit_support_3yr)  setC3(data.credit_support_3yr);
    if (data.credit_support_5yr)  setC5(data.credit_support_5yr);
    if (data.credit_support_7yr)  setC7(data.credit_support_7yr);
    if (data.credit_support_10yr) setC10(data.credit_support_10yr);
    if (data.credit_support_15yr) setC15(data.credit_support_15yr);
    if (data.credit_support_20yr) setC20(data.credit_support_20yr);
  }, []);

  async function submit() {
    setErr(''); setSaving(true);
    try {
      const ms = Object.fromEntries(MONTH_KEYS.map(k => [k, Number(supply[k])||0])) as MonthlyProfile;
      const ml = Object.fromEntries(MONTH_KEYS.map(k => [k, Number(load[k])  ||0])) as MonthlyProfile;

      const termMap: Record<SupportedTerm, string> = { 3:t3, 5:t5, 7:t7, 10:t10, 15:t15, 20:t20 };
      const activeTerms = ALL_TERMS.filter(t => Number(termMap[t]) > 0);
      const termsToSave = activeTerms.length > 0 ? activeTerms : [5, 10, 15];

      const p: Omit<Proposal,'id'|'created_at'|'carbon_savings'> = {
        slug, client_name: clientName,
        proposal_password:    propPw || 'Apollo@2026',
        contract_date:        contractDate || undefined,
        supply_window_closes: swc          || undefined,
        next_supply_window:   nsw          || undefined,
        contract_mwh:         Number(mwh)      || 0,
        customer_load_mwh:    Number(loadMwh)  || 0,
        green_coverage_pct:   Number(coverage) || 70,
        monthly_supply: ms, monthly_load: ml,
        tariff_3yr:  Number(t3)  || 0,
        tariff_5yr:  Number(t5)  || 0,
        tariff_7yr:  Number(t7)  || 0,
        tariff_10yr: Number(t10) || 0,
        tariff_15yr: Number(t15) || 0,
        tariff_20yr: Number(t20) || 0,
        eskom_tariff: Number(eskom) || 1.49,
        savings_3yr:  Number(s3)  || 0,
        savings_5yr:  Number(s5)  || 0,
        savings_7yr:  Number(s7)  || 0,
        savings_10yr: Number(s10) || 0,
        savings_15yr: Number(s15) || 0,
        savings_20yr: Number(s20) || 0,
        year1_savings: Number(s1)  || 0,
        npv_savings:   Number(npv) || 0,
        forex_exposure_pct:   Number(forex)   || 55,
        volume_guarantee_pct: Number(volGuar) || 70,
        credit_support_3yr:  Number(c3)  || 0,
        credit_support_5yr:  Number(c5)  || 0,
        credit_support_7yr:  Number(c7)  || 0,
        credit_support_10yr: Number(c10) || 0,
        credit_support_15yr: Number(c15) || 0,
        credit_support_20yr: Number(c20) || 0,
        escalation_cpi:   Number(cpi)     || 4.5,
        eskom_escalation: Number(eskomEsc)|| 6.0,
        tou_peak_pct:     Number(touPeak)     || 15,
        tou_standard_pct: Number(touStandard) || 45,
        tou_offpeak_pct:  Number(touOffpeak)  || 40,
        active_terms: termsToSave,
        salesperson_name:  spName  || undefined,
        salesperson_email: spEmail || undefined,
        salesperson_phone: spPhone || undefined,
      };

      console.log('[Admin] Upserting:', JSON.stringify(p, null, 2));
      const { data: result, error: dbErr } = await supabase
        .from('proposals').upsert(p, { onConflict: 'slug' }).select().single();

      if (dbErr) throw new Error(`Database error (${dbErr.code}): ${dbErr.message}${dbErr.details?` — ${dbErr.details}`:''}${dbErr.hint?` (hint: ${dbErr.hint})`:''}`);

      const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
      setUrl(`${base}/${slug}`);
      console.log('[Admin] Saved:', result);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      console.error('[Admin] Submit error:', e);
    } finally {
      setSaving(false);
    }
  }

  // ── Auth gate ────────────────────────────────────────────────────────────
  if (!authed) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm bg-forest border border-border rounded-2xl p-8 space-y-5">
        <ApolloLogo size="md" />
        <p className="text-sm text-muted">Admin access required.</p>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key==='Enter' && auth()} placeholder="Password"
          className="w-full bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-offwhite placeholder:text-border outline-none focus:border-green transition-colors" />
        {pwErr && <p className="text-xs text-danger">{pwErr}</p>}
        <button onClick={auth} className="w-full bg-green hover:bg-mint text-charcoal font-bold py-2.5 rounded-lg text-sm transition-colors">Unlock</button>
      </div>
    </div>
  );

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-charcoal py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <ApolloLogo size="lg" />
          <div className="text-right">
            <p className="text-offwhite font-bold">Proposal Generator</p>
            <p className="text-xs text-muted mt-0.5">Sales Admin</p>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer"
               className="bg-green hover:bg-mint text-charcoal font-bold px-4 py-2 rounded-lg text-sm transition-colors">
              View Proposal ↗
            </a>
          )}
        </div>

        {/* Terms-loaded strip */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Terms loaded:</span>
          {ALL_TERMS.map(yr => {
            const tariffVal = yr===3?t3:yr===5?t5:yr===7?t7:yr===10?t10:yr===15?t15:t20;
            const loaded = !!tariffVal;
            return (
              <span key={yr} className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${loaded?'bg-green/15 border-green/50 text-green':'bg-forest border-border text-border'}`}>
                {yr}yr {loaded?'✓':'—'}
              </span>
            );
          })}
          <span className="text-[11px] text-dim ml-1">Upload each term variant separately to populate all.</span>
        </div>

        {/* Uploader */}
        <DragDropUploader onParsed={handleParsed} />

        {/* Partial terms hint */}
        <div className="mb-6 bg-forest border border-border rounded-xl px-4 py-3 flex gap-3 items-start">
          <svg className="mt-0.5 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-muted text-xs leading-relaxed">
            <strong className="text-offwhite">Partial terms supported.</strong>{' '}
            Leave any tariff field blank to hide that term from the proposal. Supported tenures: 3, 5, 7, 10, 15, 20 years.
          </p>
        </div>

        {/* ── FORM ── */}
        <div className="bg-forest border border-border rounded-2xl p-8">
          <div className="grid grid-cols-2 gap-4">

            <Rule title="Proposal Identity & Access" />
            <Field label="Proposal Password" name="propPw" value={propPw} onChange={setPropPw} placeholder="Apollo@2026" half />
            <div className="col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">Master Password</p>
              <div className="bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-dim font-mono">Apollo@2026</div>
              <p className="text-[10px] text-border mt-1">Leave as-is to use master password for all proposals</p>
            </div>

            <Rule title="Client Details" />
            <Field label="Client Name"          name="client_name"          value={clientName}   onChange={v=>{setClientName(v);setSlug(slugify(v));}} placeholder="Steyn City Properties" />
            <Field label="URL Slug"             name="slug"                 value={slug}         onChange={setSlug}         placeholder="steyn-city"        half />
            <Field label="Contract Date"        name="contract_date"        value={contractDate} onChange={setContractDate} type="date"                     half />
            <Field label="Supply Window Closes" name="supply_window_closes" value={swc}          onChange={setSwc}          type="date"                     half />
            <Field label="Next Supply Window"   name="next_supply_window"   value={nsw}          onChange={setNsw}          type="date"                     half optional />
            <Field label="Salesperson Name"     name="sp_name"              value={spName}       onChange={setSpName}                                        half optional />
            <Field label="Salesperson Email"    name="sp_email"             value={spEmail}      onChange={setSpEmail}      type="email"                    half optional />
            <Field label="Salesperson Phone"    name="sp_phone"             value={spPhone}      onChange={setSpPhone}                                       half optional />

            <Rule title="Technical Overview" />
            <Field label="Contracted Supply (MWh/yr)"        name="mwh"     value={mwh}     onChange={setMwh}     type="number" placeholder="14840" half />
            <Field label="Customer Electrical Load (MWh/yr)" name="loadMwh" value={loadMwh} onChange={setLoadMwh} type="number" placeholder="21208" half />
            <Field label="Green Coverage (%)"                name="cov"     value={coverage} onChange={setCoverage} type="number" placeholder="70"   half />

            {/* TOU allocation */}
            <div className="col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">TOU Energy Allocation (%)</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:'Peak %',     val:touPeak,     set:setTouPeak,     placeholder:'15' },
                  { label:'Standard %', val:touStandard, set:setTouStandard, placeholder:'45' },
                  { label:'Off-Peak %', val:touOffpeak,  set:setTouOffpeak,  placeholder:'40' },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[11px] text-dim mb-1">{f.label}</p>
                    <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder}
                      className="w-full bg-elevated border border-border rounded-md px-2 py-2 text-sm text-offwhite text-center outline-none focus:border-green transition-colors" />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-border mt-1">Should sum to 100%. Used in TOU tariff breakdown table.</p>
            </div>

            {/* Monthly supply */}
            <div className="col-span-2 mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Monthly Apollo Supply [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTH_KEYS.map((k,i) => (
                  <div key={k}>
                    <p className="text-[11px] text-dim text-center mb-1">{MONTH_LABELS[i]}</p>
                    <input type="number" value={supply[k]} onChange={e=>setSupply(p=>({...p,[k]:e.target.value}))} placeholder="0"
                      className="w-full bg-elevated border border-border rounded-md px-1.5 py-1.5 text-xs text-offwhite text-center outline-none focus:border-green transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly load */}
            <div className="col-span-2 mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Monthly Electrical Load [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTH_KEYS.map((k,i) => (
                  <div key={k}>
                    <p className="text-[11px] text-dim text-center mb-1">{MONTH_LABELS[i]}</p>
                    <input type="number" value={load[k]} onChange={e=>setLoad(p=>({...p,[k]:e.target.value}))} placeholder="0"
                      className="w-full bg-elevated border border-border rounded-md px-1.5 py-1.5 text-xs text-offwhite text-center outline-none focus:border-green transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* TOU Tariffs — all 6 terms */}
            <Rule title="TOU Weighted Average Tariffs [R/kWh]" />
            <div className="col-span-2 text-[11px] text-muted -mt-3 mb-1">Leave blank to exclude that term from the proposal. Tenures: 3, 5, 7, 10, 15, 20 years.</div>
            <Field label="3-Year Tariff"  name="t3"  value={t3}  onChange={setT3}  type="number" placeholder="1.48" half optional />
            <Field label="5-Year Tariff"  name="t5"  value={t5}  onChange={setT5}  type="number" placeholder="1.43" half optional />
            <Field label="7-Year Tariff"  name="t7"  value={t7}  onChange={setT7}  type="number" placeholder="1.40" half optional />
            <Field label="10-Year Tariff" name="t10" value={t10} onChange={setT10} type="number" placeholder="1.41" half optional />
            <Field label="15-Year Tariff" name="t15" value={t15} onChange={setT15} type="number" placeholder="1.34" half optional />
            <Field label="20-Year Tariff" name="t20" value={t20} onChange={setT20} type="number" placeholder="1.30" half optional />
            <Field label="Eskom WEPS Tariff" name="eskom" value={eskom} onChange={setEskom} type="number" placeholder="1.49" half />

            {/* Savings — all 6 terms + KPI extras */}
            <Rule title="Cumulative Savings [Mill ZAR]" />
            <div className="col-span-2 text-[11px] text-muted -mt-3 mb-1">Leave blank for any term not included in this offer.</div>
            <Field label="Year 1 Savings [R mill]"     name="s1"  value={s1}  onChange={setS1}  type="number" placeholder="7.2"  half optional />
            <Field label="NPV Total Savings [R mill]"  name="npv" value={npv} onChange={setNpv} type="number" placeholder="120"  half optional />
            <Field label="3-Year Cumulative"  name="s3"  value={s3}  onChange={setS3}  type="number" placeholder="20"  half optional />
            <Field label="5-Year Cumulative"  name="s5"  value={s5}  onChange={setS5}  type="number" placeholder="26"  half optional />
            <Field label="7-Year Cumulative"  name="s7"  value={s7}  onChange={setS7}  type="number" placeholder="45"  half optional />
            <Field label="10-Year Cumulative" name="s10" value={s10} onChange={setS10} type="number" placeholder="81"  half optional />
            <Field label="15-Year Cumulative" name="s15" value={s15} onChange={setS15} type="number" placeholder="189" half optional />
            <Field label="20-Year Cumulative" name="s20" value={s20} onChange={setS20} type="number" placeholder="300" half optional />

            {/* Commercial */}
            <Rule title="Commercial Terms" />
            <Field label="Forex Exposure (%)"             name="forex"   value={forex}   onChange={setForex}   type="number" placeholder="55"  half />
            <Field label="Volume Guarantee (%)"           name="volGuar" value={volGuar} onChange={setVolGuar} type="number" placeholder="70"  half />
            <Field label="Credit Support 3yr [ZAR mill]"  name="c3"  value={c3}  onChange={setC3}  type="number" placeholder="—"   half optional />
            <Field label="Credit Support 5yr [ZAR mill]"  name="c5"  value={c5}  onChange={setC5}  type="number" placeholder="5.3" half optional />
            <Field label="Credit Support 7yr [ZAR mill]"  name="c7"  value={c7}  onChange={setC7}  type="number" placeholder="—"   half optional />
            <Field label="Credit Support 10yr [ZAR mill]" name="c10" value={c10} onChange={setC10} type="number" placeholder="5.3" half optional />
            <Field label="Credit Support 15yr [ZAR mill]" name="c15" value={c15} onChange={setC15} type="number" placeholder="5"   half optional />
            <Field label="Credit Support 20yr [ZAR mill]" name="c20" value={c20} onChange={setC20} type="number" placeholder="—"   half optional />

            <Rule title="Escalation Assumptions" />
            <Field label="CPI Escalation (%/yr)"   name="cpi"      value={cpi}      onChange={setCpi}      type="number" placeholder="4.5" half />
            <Field label="Eskom Escalation (%/yr)" name="eskomEsc" value={eskomEsc} onChange={setEskomEsc} type="number" placeholder="6.0" half />
          </div>

          {err && (
            <div className="mt-5 bg-danger/10 border border-danger/30 rounded-xl p-4">
              <p className="text-danger text-sm font-bold mb-1">Error saving proposal</p>
              <p className="text-danger/80 text-xs font-mono whitespace-pre-wrap break-all">{err}</p>
              <p className="text-muted text-xs mt-2">Check browser console (F12) for full details.</p>
            </div>
          )}
          {url && (
            <div className="mt-5 bg-green/10 border border-green/30 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Proposal URL</p>
              <a href={url} target="_blank" rel="noreferrer" className="font-mono text-sm text-green break-all hover:underline">{url}</a>
              <p className="text-[11px] text-dim mt-2">Password: <span className="font-mono text-offwhite">{propPw}</span></p>
            </div>
          )}
          <button onClick={submit} disabled={saving || !clientName || !slug}
            className="mt-6 w-full bg-green hover:bg-mint disabled:opacity-40 disabled:cursor-not-allowed text-charcoal font-bold py-3 rounded-xl text-base tracking-wide transition-colors">
            {saving ? 'Saving…' : '⚡ Generate Proposal'}
          </button>
        </div>

        <p className="text-center text-[11px] text-border mt-6">Apollo Africa · a Reunert company · NERSA/TRD09/2024</p>
      </div>
    </div>
  );
}
