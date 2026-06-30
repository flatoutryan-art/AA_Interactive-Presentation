'use client';

/**
 * app/admin/page.tsx
 * Route: /admin
 */

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'apollo2026';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function n(v: string) { return Number(v) || 0; }
function numCell(sheet: XLSX.WorkSheet, addr: string): number {
  const cell = sheet[addr];
  if (!cell) return 0;
  const v = parseFloat(String(cell.v ?? ''));
  return isNaN(v) ? 0 : v;
}

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TOU_ROWS = [
  { key: 'hs_peak',      label: 'High Season — Peak'      },
  { key: 'hs_std',       label: 'High Season — Standard'   },
  { key: 'hs_offpeak',   label: 'High Season — Off-Peak'   },
  { key: 'ls_peak',      label: 'Low Season — Peak'        },
  { key: 'ls_std',       label: 'Low Season — Standard'    },
  { key: 'ls_offpeak',   label: 'Low Season — Off-Peak'    },
  { key: 'weighted_avg', label: 'Weighted Average'          },
] as const;

type TouKey = typeof TOU_ROWS[number]['key'];
type TouData = Record<TouKey, number>;
const emptyTou = (): TouData => ({
  hs_peak: 0, hs_std: 0, hs_offpeak: 0,
  ls_peak: 0, ls_std: 0, ls_offpeak: 0,
  weighted_avg: 0,
});

type ParseResult = {
  contractMwh?: string;
  customerLoadMwh?: string;
  greenCoveragePct?: string;
  tou5?: TouData;  savings5?: string;  credit5?: string;
  tou10?: TouData; savings10?: string; credit10?: string;
  tou15?: TouData; savings15?: string; credit15?: string;
  eskomTariff?: string;
  forexPct?: string;
  volumeGuaranteePct?: string;
  escalationCpi?: string;
  eskomEscalation?: string;
  monthlySupply?: Record<string, string>;
  monthlyLoad?: Record<string, string>;
  sheetNames?: string[];
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, type='text', placeholder='', half=false }: {
  label: string; name: string; value: string;
  onChange: (v: string) => void;
  type?: string; placeholder?: string; half?: boolean;
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label htmlFor={name}
        className="block mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </label>
      <input id={name} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg bg-elevated border border-border px-3 py-2.5
                   text-sm text-offwhite placeholder:text-border outline-none
                   focus:border-green transition-colors" />
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

// ─── Excel Uploader ───────────────────────────────────────────────────────────
function ExcelUploader({ onParsed }: { onParsed: (r: ParseResult) => void }) {
  const [status, setStatus]     = useState<'idle'|'parsing'|'done'|'warn'|'error'>('idle');
  const [msg, setMsg]           = useState('');
  const [dragging, setDragging] = useState(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  const parse = useCallback((file: File) => {
    setStatus('parsing'); setMsg('Reading file…');
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'uint8' });
        setSheetNames(wb.SheetNames);

        // Find Deal IO sheet (TOU tariffs live here, columns D/E/F rows 18-25)
        const dealSheetName = wb.SheetNames.find(sn =>
          /deal\s*io/i.test(sn) || /deal/i.test(sn) || /tariff/i.test(sn) || /input/i.test(sn)
        ) ?? wb.SheetNames[0];
        const ds = wb.Sheets[dealSheetName];

        // Find summary/cover sheet
        const ssName = wb.SheetNames.find(sn =>
          /cover/i.test(sn) || /summary/i.test(sn) || /commercial/i.test(sn)
        ) ?? wb.SheetNames[0];
        const ss = wb.Sheets[ssName];

        // Find monthly sheet
        const msName = wb.SheetNames.find(sn =>
          /monthly/i.test(sn) || /forecast/i.test(sn) || /schedule/i.test(sn)
        ) ?? wb.SheetNames[0];
        const ms = wb.Sheets[msName];

        // Extract TOU data from Deal IO columns D/E/F, rows 18-25
        // Row 18 = header, rows 19-25 = HS Peak, HS Std, HS Off-Peak, LS Peak, LS Std, LS Off-Peak, Weighted Avg
        const extractTou = (col: string): TouData => {
          // Scan rows 14-35 to find 7 consecutive non-zero values
          const vals: number[] = [];
          for (let r = 14; r <= 35; r++) {
            const v = numCell(ds, `${col}${r}`);
            if (v > 0.01) vals.push(v);
            if (vals.length === 7) break;
          }
          while (vals.length < 7) vals.push(0);
          return {
            hs_peak:     vals[0],
            hs_std:      vals[1],
            hs_offpeak:  vals[2],
            ls_peak:     vals[3],
            ls_std:      vals[4],
            ls_offpeak:  vals[5],
            weighted_avg:vals[6],
          };
        };

        const tou5  = extractTou('D');
        const tou10 = extractTou('E');
        const tou15 = extractTou('F');

        // Eskom WEPS — column G, same row range
        let eskomWeps = 0;
        for (let r = 14; r <= 35; r++) {
          const v = numCell(ds, `G${r}`);
          if (v > 0.01) { eskomWeps = v; break; }
        }

        // Cumulative savings — scan all sheets for "cumul" or "saving" label
        let sav5 = 0, sav10 = 0, sav15 = 0;
        for (const sheetName of wb.SheetNames) {
          const sh = wb.Sheets[sheetName];
          if (!sh) continue;
          for (let r = 1; r <= 60; r++) {
            const label = String(sh[`A${r}`]?.v ?? sh[`B${r}`]?.v ?? '').toLowerCase();
            if (label.includes('cumul') || (label.includes('sav') && label.includes('total'))) {
              const v1 = numCell(sh, `D${r}`) || numCell(sh, `C${r}`);
              const v2 = numCell(sh, `E${r}`) || numCell(sh, `D${r}`);
              const v3 = numCell(sh, `F${r}`) || numCell(sh, `E${r}`);
              if (v1 > 0) { sav5 = v1; sav10 = v2; sav15 = v3; break; }
            }
          }
          if (sav5 > 0) break;
        }

        // Contract MWh and load — scan summary sheet
        let contractMwh = 0, customerLoadMwh = 0, greenCov = 0;
        for (let r = 1; r <= 80; r++) {
          const a = String(ss[`A${r}`]?.v ?? '').toLowerCase();
          const b = String(ss[`B${r}`]?.v ?? '').toLowerCase();
          const label = a || b;
          const valCol = a ? 'C' : 'C';
          if (label.includes('contracted') && (label.includes('supply') || label.includes('mwh'))) {
            contractMwh = numCell(ss, `C${r}`) || numCell(ss, `D${r}`);
          }
          if (label.includes('load') || label.includes('demand') || label.includes('consumption')) {
            customerLoadMwh = numCell(ss, `C${r}`) || numCell(ss, `D${r}`);
          }
          if (label.includes('coverage') || label.includes('green %')) {
            greenCov = numCell(ss, `C${r}`) || numCell(ss, `D${r}`);
          }
        }
        if (!greenCov && contractMwh && customerLoadMwh) {
          greenCov = Math.round((contractMwh / customerLoadMwh) * 100);
        }

        // Monthly supply and load
        const monthlySupply: Record<string, string> = {};
        const monthlyLoad:   Record<string, string> = {};
        let supplyFound = false, loadFound = false;
        const cols = ['C','D','E','F','G','H','I','J','K','L','M','N'];

        for (let r = 1; r <= 100; r++) {
          const label = String(ms[`A${r}`]?.v ?? ms[`B${r}`]?.v ?? '').toLowerCase();
          if (!supplyFound && (label.includes('apollo') || label.includes('supply') || label.includes('green'))) {
            const vals = cols.map(c => numCell(ms, `${c}${r}`));
            if (vals.filter(v => v > 0).length >= 6) {
              MONTHS.forEach((m, i) => { monthlySupply[m] = String(vals[i] || 0); });
              supplyFound = true;
            }
          }
          if (!loadFound && (label.includes('load') || label.includes('demand') || label.includes('electrical'))) {
            const vals = cols.map(c => numCell(ms, `${c}${r}`));
            if (vals.filter(v => v > 0).length >= 6) {
              MONTHS.forEach((m, i) => { monthlyLoad[m] = String(vals[i] || 0); });
              loadFound = true;
            }
          }
          if (supplyFound && loadFound) break;
        }

        // Credit support
        let credit5 = '5.3', credit10 = '5.3', credit15 = '5.0';
        for (let r = 1; r <= 60; r++) {
          const label = String(ss[`A${r}`]?.v ?? ss[`B${r}`]?.v ?? '').toLowerCase();
          if (label.includes('credit') || label.includes('security') || label.includes('deposit')) {
            credit5  = String(numCell(ss, `D${r}`) || 5.3);
            credit10 = String(numCell(ss, `E${r}`) || 5.3);
            credit15 = String(numCell(ss, `F${r}`) || 5.0);
            break;
          }
        }

        const result: ParseResult = {
          contractMwh:        contractMwh ? String(contractMwh) : '',
          customerLoadMwh:    customerLoadMwh ? String(customerLoadMwh) : '',
          greenCoveragePct:   greenCov ? String(greenCov) : '',
          tou5, tou10, tou15,
          eskomTariff:        eskomWeps ? String(eskomWeps) : '1.49',
          savings5:           sav5  ? String(sav5)  : '',
          savings10:          sav10 ? String(sav10) : '',
          savings15:          sav15 ? String(sav15) : '',
          credit5, credit10, credit15,
          forexPct:           '55',
          volumeGuaranteePct: '70',
          escalationCpi:      '4.5',
          eskomEscalation:    '6.0',
          monthlySupply:      supplyFound ? monthlySupply : undefined,
          monthlyLoad:        loadFound   ? monthlyLoad   : undefined,
          sheetNames:         wb.SheetNames,
        };

        // Log raw data for calibration
        console.log('[Apollo Uploader] Sheet names:', wb.SheetNames);
        console.log('[Apollo Uploader] Deal IO sheet:', dealSheetName);
        console.log('[Apollo Uploader] TOU 5yr (col D):', tou5);
        console.log('[Apollo Uploader] TOU 10yr (col E):', tou10);
        console.log('[Apollo Uploader] TOU 15yr (col F):', tou15);
        console.log('[Apollo Uploader] Eskom WEPS:', eskomWeps);
        console.log('[Apollo Uploader] Savings:', sav5, sav10, sav15);
        console.log('[Apollo Uploader] Contract MWh:', contractMwh, 'Load:', customerLoadMwh);
        wb.SheetNames.forEach(sn => {
          console.log(`[Apollo Uploader] Sheet "${sn}" (first 30 rows):`,
            XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', range: 0 }).slice(0, 30));
        });

        const hits = [tou5.weighted_avg, tou10.weighted_avg, contractMwh].filter(v => v > 0).length;
        if (hits >= 2) {
          setStatus('done');
          setMsg(`✓ Data extracted from "${file.name}" — review fields below before saving.`);
        } else {
          setStatus('warn');
          setMsg(`⚠ Limited data matched. Sheets found: ${wb.SheetNames.join(', ')}. Open browser console (F12) to see raw data layout for calibration.`);
        }

        onParsed(result);
      } catch (err) {
        setStatus('error');
        setMsg(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
        console.error('[Apollo Uploader]', err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [onParsed]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) parse(f);
  }, [parse]);

  const statusColor =
    status === 'done'  ? '#10B981' :
    status === 'warn'  ? '#C9A84C' :
    status === 'error' ? '#EF4444' : '#86EFAC';

  return (
    <div className="col-span-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-green mb-3">
        ⚡ Quick Import — Apollo Offerbook Excel
      </p>
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center gap-3 cursor-pointer
                   rounded-2xl border-2 border-dashed transition-all duration-200 p-8"
        style={{ borderColor: dragging ? '#10B981' : '#1E4D30', background: dragging ? 'rgba(16,185,129,0.06)' : '#0F2318' }}
      >
        <input type="file" accept=".xlsx,.xls,.xlsm" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) parse(f); }} />
        <div className="w-14 h-14 rounded-2xl bg-green/10 border border-green/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9,15 12,12 15,15"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-offwhite text-sm font-bold">Drop Apollo Offerbook here</p>
          <p className="text-muted text-xs mt-1">or click to browse · .xlsx / .xls / .xlsm</p>
          <p className="text-border text-[11px] mt-2">
            Reads TOU tariffs from Deal IO tab (cols D/E/F, rows 18–25), monthly supply,
            contracted MWh, cumulative savings — pre-fills all fields below automatically.
          </p>
        </div>
        {status === 'parsing' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-green/20 border-t-green animate-spin" />
            <span className="text-muted text-xs">Parsing…</span>
          </div>
        )}
        {(status === 'done' || status === 'warn' || status === 'error') && (
          <p className="text-xs text-center max-w-sm leading-relaxed" style={{ color: statusColor }}>
            {msg}
          </p>
        )}
      </label>
      {sheetNames.length > 0 && (
        <p className="text-[11px] text-border mt-2 px-1">
          <span className="text-dim font-semibold">Sheets: </span>{sheetNames.join(' · ')}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw]         = useState('');
  const [pwErr, setPwErr]   = useState('');
  const [saving, setSaving] = useState(false);
  const [url, setUrl]       = useState('');
  const [err, setErr]       = useState('');

  // Term flags
  const [has5yr,  setHas5yr]  = useState(true);
  const [has10yr, setHas10yr] = useState(true);
  const [has15yr, setHas15yr] = useState(true);

  // Identity
  const [clientName, setClientName]     = useState('');
  const [slug, setSlug]                 = useState('');
  const [contractDate, setContractDate] = useState('');
  const [swc, setSwc]                   = useState('');
  const [spName, setSpName]             = useState('');
  const [spEmail, setSpEmail]           = useState('');
  const [spPhone, setSpPhone]           = useState('');

  // Technical
  const [mwh, setMwh]           = useState('');
  const [loadMwh, setLoadMwh]   = useState('');
  const [coverage, setCoverage] = useState('70');

  // TOU
  const [tou5,  setTou5]  = useState<TouData>(emptyTou());
  const [tou10, setTou10] = useState<TouData>(emptyTou());
  const [tou15, setTou15] = useState<TouData>(emptyTou());
  const [eskom, setEskom] = useState('1.49');

  // Savings
  const [s5, setS5]   = useState('');
  const [s10, setS10] = useState('');
  const [s15, setS15] = useState('');

  // Commercial
  const [forex, setForex]     = useState('55');
  const [volGuar, setVolGuar] = useState('70');
  const [c5, setC5]           = useState('5.3');
  const [c10, setC10]         = useState('5.3');
  const [c15, setC15]         = useState('5.0');
  const [cpi, setCpi]         = useState('4.5');
  const [eskomEsc, setEskomEsc] = useState('6.0');

  // Monthly
  const blank = () => Object.fromEntries(MONTHS.map(k => [k, '']));
  const [supply, setSupply] = useState<Record<string, string>>(blank());
  const [load, setLoad]     = useState<Record<string, string>>(blank());

  const handleExcelParsed = useCallback((r: ParseResult) => {
    if (r.contractMwh)        setMwh(r.contractMwh);
    if (r.customerLoadMwh)    setLoadMwh(r.customerLoadMwh);
    if (r.greenCoveragePct)   setCoverage(r.greenCoveragePct);
    if (r.tou5)  setTou5(r.tou5);
    if (r.tou10) setTou10(r.tou10);
    if (r.tou15) setTou15(r.tou15);
    if (r.eskomTariff)        setEskom(r.eskomTariff);
    if (r.savings5)           setS5(r.savings5);
    if (r.savings10)          setS10(r.savings10);
    if (r.savings15)          setS15(r.savings15);
    if (r.credit5)            setC5(r.credit5);
    if (r.credit10)           setC10(r.credit10);
    if (r.credit15)           setC15(r.credit15);
    if (r.forexPct)           setForex(r.forexPct);
    if (r.volumeGuaranteePct) setVolGuar(r.volumeGuaranteePct);
    if (r.escalationCpi)      setCpi(r.escalationCpi);
    if (r.eskomEscalation)    setEskomEsc(r.eskomEscalation);
    if (r.monthlySupply) setSupply(Object.fromEntries(MONTHS.map(k => [k, r.monthlySupply![k] ?? ''])));
    if (r.monthlyLoad)   setLoad(Object.fromEntries(MONTHS.map(k => [k, r.monthlyLoad![k] ?? ''])));
    if (r.tou5  && r.tou5.weighted_avg  === 0) setHas5yr(false);  else if (r.tou5)  setHas5yr(true);
    if (r.tou10 && r.tou10.weighted_avg === 0) setHas10yr(false); else if (r.tou10) setHas10yr(true);
    if (r.tou15 && r.tou15.weighted_avg === 0) setHas15yr(false); else if (r.tou15) setHas15yr(true);
  }, []);

  function auth() {
    if (pw === ADMIN_PW) { setAuthed(true); setPwErr(''); }
    else setPwErr('Incorrect password.');
  }

  async function submit() {
    setErr(''); setSaving(true);
    try {
      const ms = Object.fromEntries(MONTHS.map(k => [k, n(supply[k])]));
      const ml = Object.fromEntries(MONTHS.map(k => [k, n(load[k])]));

      const payload = {
        slug,
        client_name:           clientName,
        contract_date:         contractDate || null,
        supply_window_closes:  swc          || null,
        contract_mwh:          n(mwh),
        customer_load_mwh:     n(loadMwh),
        green_coverage_pct:    n(coverage),
        monthly_supply:        ms,
        monthly_load:          ml,
        tou_5yr:               has5yr  ? tou5  : null,
        tou_10yr:              has10yr ? tou10 : null,
        tou_15yr:              has15yr ? tou15 : null,
        tariff_5yr:            has5yr  ? (tou5.weighted_avg  || null) : null,
        tariff_10yr:           has10yr ? (tou10.weighted_avg || null) : null,
        tariff_15yr:           has15yr ? (tou15.weighted_avg || null) : null,
        eskom_tariff:          n(eskom),
        savings_5yr:           has5yr  ? n(s5)  : null,
        savings_10yr:          has10yr ? n(s10) : null,
        savings_15yr:          has15yr ? n(s15) : null,
        has_5yr:               has5yr,
        has_10yr:              has10yr,
        has_15yr:              has15yr,
        forex_exposure_pct:    n(forex),
        volume_guarantee_pct:  n(volGuar),
        credit_support_5yr:    n(c5),
        credit_support_10yr:   n(c10),
        credit_support_15yr:   n(c15),
        escalation_cpi:        n(cpi),
        eskom_escalation:      n(eskomEsc),
        salesperson_name:      spName  || null,
        salesperson_email:     spEmail || null,
        salesperson_phone:     spPhone || null,
      };

      const { error: dbErr } = await supabase
        .from('proposals')
        .upsert(payload, { onConflict: 'slug' });

      if (dbErr) {
        if (dbErr.code === '42501' || dbErr.message?.includes('policy')) {
          throw new Error(
            'Supabase RLS is blocking inserts.\n\nRun this in Supabase → SQL Editor:\n\nCREATE POLICY "Public insert proposals"\n  ON proposals FOR INSERT\n  WITH CHECK (true);\n\nThen try again.'
          );
        }
        if (dbErr.code === '42703') {
          throw new Error(
            `Column missing: ${dbErr.message}\n\nRun the schema migration SQL to add: has_5yr, has_10yr, has_15yr, tou_5yr, tou_10yr, tou_15yr`
          );
        }
        throw new Error(dbErr.message);
      }

      const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
      setUrl(`${base}/${slug}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setSaving(false);
    }
  }

  if (!authed) return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm bg-forest border border-border rounded-2xl p-8 space-y-5">
        <div className="flex items-end gap-2">
          <svg width="22" height="26" viewBox="0 0 28 32" fill="none">
            <path d="M14 0L28 28H0L14 0Z" fill="#C9A84C" opacity="0.9"/>
            <path d="M14 6L24 28H14V6Z" fill="#10B981"/>
          </svg>
          <div>
            <p className="font-display text-xl font-black text-offwhite leading-none">
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
                     text-sm text-offwhite outline-none focus:border-green transition-colors
                     placeholder:text-border" />
        {pwErr && <p className="text-xs text-danger">{pwErr}</p>}
        <button onClick={auth}
          className="w-full bg-green hover:bg-mint text-charcoal font-bold py-2.5 rounded-lg text-sm transition-colors">
          Unlock
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-charcoal py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-end gap-2">
            <svg width="22" height="26" viewBox="0 0 28 32" fill="none">
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

        <div className="bg-forest border border-border rounded-2xl p-8">
          <div className="grid grid-cols-2 gap-4">

            <ExcelUploader onParsed={handleExcelParsed} />

            <Rule title="Client Details" />
            <Field label="Client Name"          name="client_name"          value={clientName}   onChange={v => { setClientName(v); setSlug(slugify(v)); }} placeholder="Steyn City Properties" />
            <Field label="URL Slug"             name="slug"                 value={slug}          onChange={setSlug}         placeholder="steyn-city"  half />
            <Field label="Contract Date"        name="contract_date"        value={contractDate}  onChange={setContractDate}  type="date"              half />
            <Field label="Supply Window Closes" name="supply_window_closes" value={swc}           onChange={setSwc}           type="date"              half />
            <Field label="Salesperson Name"     name="sp_name"              value={spName}        onChange={setSpName}        half />
            <Field label="Salesperson Email"    name="sp_email"             value={spEmail}       onChange={setSpEmail}       type="email"             half />
            <Field label="Salesperson Phone"    name="sp_phone"             value={spPhone}       onChange={setSpPhone}       half />

            <Rule title="Available Contract Terms" />
            <div className="col-span-2">
              <p className="text-[11px] text-muted mb-3">
                Check only the terms offered to this client. Unchecked terms will not appear in the proposal.
              </p>
              <div className="flex gap-6">
                {[
                  { label:'5 Year',  checked:has5yr,  set:setHas5yr  },
                  { label:'10 Year', checked:has10yr, set:setHas10yr },
                  { label:'15 Year', checked:has15yr, set:setHas15yr },
                ].map(({ label, checked, set }) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={checked}
                      onChange={e => set(e.target.checked)}
                      className="w-4 h-4 accent-green" />
                    <span className={`text-sm font-semibold ${checked ? 'text-green' : 'text-muted'}`}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Rule title="Technical Overview" />
            <Field label="Contracted Supply (MWh/yr)"        name="mwh"      value={mwh}      onChange={setMwh}      type="number" placeholder="14840" half />
            <Field label="Customer Electrical Load (MWh/yr)" name="loadMwh"  value={loadMwh}  onChange={setLoadMwh}  type="number" placeholder="21208" half />
            <Field label="Green Coverage (%)"                name="coverage" value={coverage} onChange={setCoverage} type="number" placeholder="70"    half />

            <div className="col-span-2 mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Monthly Apollo Supply [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTHS.map((k, i) => (
                  <div key={k}>
                    <p className="text-[11px] text-dim text-center mb-1">{MONTH_LABELS[i]}</p>
                    <input type="number" value={supply[k]}
                      onChange={e => setSupply(p => ({...p,[k]:e.target.value}))}
                      placeholder="0"
                      className="w-full bg-elevated border border-border rounded-md px-1.5 py-1.5
                                 text-xs text-offwhite text-center outline-none focus:border-green transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 mt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Monthly Electrical Load [MWh]</p>
              <div className="grid grid-cols-6 gap-2">
                {MONTHS.map((k, i) => (
                  <div key={k}>
                    <p className="text-[11px] text-dim text-center mb-1">{MONTH_LABELS[i]}</p>
                    <input type="number" value={load[k]}
                      onChange={e => setLoad(p => ({...p,[k]:e.target.value}))}
                      placeholder="0"
                      className="w-full bg-elevated border border-border rounded-md px-1.5 py-1.5
                                 text-xs text-offwhite text-center outline-none focus:border-green transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            <Rule title="TOU Tariffs [R/kWh] — auto-filled from Excel" />
            <p className="col-span-2 text-[11px] text-muted -mt-2">
              Full TOU breakdown per term. Weighted Average is the key figure shown in the proposal.
            </p>

            {([
              { term: 5,  tou: tou5,  setTou: setTou5,  show: has5yr  },
              { term: 10, tou: tou10, setTou: setTou10, show: has10yr },
              { term: 15, tou: tou15, setTou: setTou15, show: has15yr },
            ] as const).filter(t => t.show).map(({ term: t, tou, setTou }) => (
              <div key={t} className="col-span-2">
                <p className="text-[11px] font-bold text-green/80 uppercase tracking-widest mb-2">{t}-Year Term</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {TOU_ROWS.map(r => (
                    <div key={r.key}>
                      <p className="text-[11px] text-muted mb-1">{r.label}</p>
                      <input type="number" step="0.01"
                        value={tou[r.key] || ''}
                        onChange={e => setTou((prev: TouData) => ({...prev,[r.key]:parseFloat(e.target.value)||0}))}
                        placeholder="0.00"
                        className="w-full bg-elevated border border-border rounded-md px-2 py-1.5
                                   text-xs text-offwhite outline-none focus:border-green transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Field label="Eskom WEPS Tariff" name="eskom" value={eskom} onChange={setEskom} type="number" placeholder="1.49" half />

            <Rule title="Cumulative Savings Forecast [Mill ZAR]" />
            {has5yr  && <Field label="5-Year Savings"  name="s5"  value={s5}  onChange={setS5}  type="number" placeholder="26"  half />}
            {has10yr && <Field label="10-Year Savings" name="s10" value={s10} onChange={setS10} type="number" placeholder="81"  half />}
            {has15yr && <Field label="15-Year Savings" name="s15" value={s15} onChange={setS15} type="number" placeholder="189" half />}

            <Rule title="Commercial Terms" />
            <Field label="Forex Exposure (%)"   name="forex"   value={forex}   onChange={setForex}   type="number" placeholder="55" half />
            <Field label="Volume Guarantee (%)" name="volGuar" value={volGuar} onChange={setVolGuar} type="number" placeholder="70" half />
            {has5yr  && <Field label="Credit Support 5yr [ZAR mill]"  name="c5"  value={c5}  onChange={setC5}  type="number" placeholder="5.3" half />}
            {has10yr && <Field label="Credit Support 10yr [ZAR mill]" name="c10" value={c10} onChange={setC10} type="number" placeholder="5.3" half />}
            {has15yr && <Field label="Credit Support 15yr [ZAR mill]" name="c15" value={c15} onChange={setC15} type="number" placeholder="5.0" half />}

            <Rule title="Escalation Assumptions" />
            <Field label="CPI Escalation (%/yr)"    name="cpi"      value={cpi}      onChange={setCpi}      type="number" placeholder="4.5" half />
            <Field label="Eskom Escalation (%/yr)"  name="eskomEsc" value={eskomEsc} onChange={setEskomEsc} type="number" placeholder="6.0" half />
          </div>

          {err && (
            <div className="mt-5 bg-danger/10 border border-danger/30 rounded-xl p-4 text-danger text-xs whitespace-pre-wrap leading-relaxed">
              {err}
            </div>
          )}
          {url && (
            <div className="mt-5 bg-green/10 border border-green/30 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Proposal URL Generated</p>
              <a href={url} target="_blank" rel="noreferrer"
                className="font-mono text-sm text-green break-all hover:underline">{url}</a>
            </div>
          )}
          <button onClick={submit}
            disabled={saving || !clientName || !slug}
            className="mt-6 w-full bg-green hover:bg-mint disabled:opacity-40 disabled:cursor-not-allowed
                       text-charcoal font-bold py-3 rounded-xl text-base tracking-wide transition-colors">
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
