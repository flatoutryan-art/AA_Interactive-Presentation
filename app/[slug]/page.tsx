'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function ClientProposal({ params }: { params: { slug: string } }) {
  const [term, setTerm] = useState(15);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProposal() {
      const { data: proposal, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('slug', params.slug)
        .single();
      
      if (!error && proposal) setData(proposal);
      setLoading(false);
    }
    fetchProposal();
  }, [params.slug]);

  if (loading) return <div className="min-h-screen bg-[#0D1B14] flex items-center justify-center text-[#10B981]">Loading Apollo Offer...</div>;
  if (!data) return <div className="min-h-screen bg-[#0D1B14] flex items-center justify-center text-white text-center">Proposal not found.<br/>Please generate it via the Admin Form.</div>;

  // Dynamic Logic mapping to your SQL columns
  const activeTariff = term === 5 ? data.tariff_5yr : term === 10 ? data.tariff_10yr : data.tariff_15yr;
  const activeSavings = term === 5 ? data.savings_5yr : term === 10 ? data.savings_10yr : data.savings_15yr;
  const activeCredit = term === 15 ? data.credit_support_15yr : term === 5 ? data.credit_support_5yr : data.credit_support_10yr;

  return (
    <div className="min-h-screen bg-[#0D1B14] text-white font-sans selection:bg-[#10B981]/30">
      {/* Navigation Header */}
      <nav className="border-b border-[#1E4D30] bg-[#0F2318]/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-[#10B981] text-2xl font-black tracking-tighter">APOLLO</span>
            <span className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Africa</span>
          </div>
          <div className="text-right">
            <p className="text-[#86EFAC] text-[10px] uppercase font-bold tracking-widest leading-none">{data.client_name}</p>
            <p className="text-gray-500 text-[10px] mt-1">Valid until: {data.supply_window_closes}</p>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-12">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">Interactive Wheeled <span className="text-[#10B981]">Supply Offer</span></h1>
          <p className="text-gray-400 max-w-2xl text-lg">Adjust the commitment term to see the immediate impact on your energy tariff, cumulative savings, and required credit support.</p>
        </section>

        {/* Term Switcher */}
        <div className="bg-[#0F2318] border border-[#1E4D30] rounded-3xl p-8 mb-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex-1">
              <h3 className="text-[#86EFAC] text-xs font-bold uppercase tracking-widest mb-4">Choose Your Commitment Term</h3>
              <div className="flex gap-3">
                {[5, 10, 15].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTerm(t)}
                    className={`flex-1 py-4 rounded-2xl font-bold text-xl transition-all duration-300 ${term === t ? 'bg-[#10B981] text-[#0D1B14] shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105' : 'bg-[#1A3A28] text-white hover:bg-[#234d35]'}`}
                  >
                    {t} Years
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 flex-[1.5]">
              <div className="border-l border-[#1E4D30] pl-6">
                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-1">Energy Charge</p>
                <p className="text-5xl font-bold">R{activeTariff.toFixed(2)}<span className="text-lg text-gray-500 font-normal">/kWh</span></p>
              </div>
              <div className="border-l border-[#1E4D30] pl-6">
                <p className="text-[#10B981] text-xs uppercase font-bold tracking-widest mb-1">Projected Savings</p>
                <p className="text-5xl font-bold text-[#10B981]">R{activeSavings}M</p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical/Commercial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#0F2318] border border-[#1E4D30] p-6 rounded-2xl">
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-4">Credit Support Required</p>
            <p className="text-3xl font-bold">R{activeCredit}M</p>
            <div className="w-full bg-[#1A3A28] h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-[#C9A84C] h-full transition-all duration-700" style={{ width: `${(activeCredit / 5.3) * 100}%` }}></div>
            </div>
          </div>
          
          <div className="bg-[#0F2318] border border-[#1E4D30] p-6 rounded-2xl">
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-4">Green Coverage</p>
            <p className="text-3xl font-bold text-[#86EFAC]">{data.green_coverage_pct}%</p>
            <p className="text-[10px] text-gray-500 mt-2 italic">Relative to {data.customer_load_mwh} MWh total load</p>
          </div>

          <div className="bg-[#0F2318] border border-[#1E4D30] p-6 rounded-2xl">
            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-4">Sales Lead</p>
            <p className="text-lg font-bold">{data.salesperson_name}</p>
            <p className="text-xs text-[#10B981]">{data.salesperson_email}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
