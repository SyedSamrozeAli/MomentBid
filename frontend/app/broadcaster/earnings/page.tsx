"use client";

import { CircleDollarSign, ArrowUpRight, History, Download, TrendingUp } from "lucide-react";

type EarningRecord = {
  match: string;
  grossRevenue: number;
  platformFee: number;
  reservationYield: number;
  netSettle: number;
  status: "Settled" | "Pending";
};

const records: EarningRecord[] = [
  { match: "Karachi Kings vs Lahore Qalandars", grossRevenue: 1200000, platformFee: 60000, reservationYield: 45000, netSettle: 1185000, status: "Settled" },
  { match: "Islamabad United vs Multan Sultans", grossRevenue: 850000, platformFee: 42500, reservationYield: 15000, netSettle: 822500, status: "Settled" },
  { match: "Peshawar Zalmi vs Quetta Gladiators", grossRevenue: 3450000, platformFee: 172500, reservationYield: 0, netSettle: 3277500, status: "Settled" },
];

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BroadcasterEarningsPage() {
  return (
    <div className="flex flex-col space-y-10 pb-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]">Treasury</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Earnings & Fees</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Track gross match revenues, platform fee deductions (5%), and aggregate yields from untriggered reservation fees.
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3 px-0 sm:px-6">
        <div className="bg-white border border-[#CED3DC] p-5">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-[#4E8098]">Total Gross Yield</h3>
            <TrendingUp className="w-4 h-4 text-[#90C2E7]" />
          </div>
          <p className="text-3xl font-light text-[#1a1a1a]">{formatPKR(5500000)}</p>
        </div>
        <div className="bg-[#FCF7F8] border border-[#CED3DC] p-5">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-[#4E8098]">Reservation Fees</h3>
            <ArrowUpRight className="w-4 h-4 text-[#4E8098]" />
          </div>
          <p className="text-3xl font-mono text-[#1a1a1a] text-xl">{formatPKR(60000)}</p>
          <p className="text-[10px] uppercase tracking-widest text-[#4E8098] mt-2">Yield from un-triggered events</p>
        </div>
        <div className="bg-[#1a1a1a] text-white p-5 border border-[#1a1a1a]">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-white/60">Platform Tax</h3>
            <CircleDollarSign className="w-4 h-4 text-white/50" />
          </div>
          <p className="text-3xl font-mono text-white text-xl">- {formatPKR(275000)}</p>
          <p className="text-[10px] uppercase tracking-widest text-white/50 mt-2">Deducted Automatically at settlement</p>
        </div>
      </section>

      <section className="px-0 sm:px-6">
        <div className="border border-[#CED3DC] bg-white overflow-hidden">
          <div className="p-6 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[#4E8098]" />
              <h3 className="text-lg font-medium text-[#1a1a1a]">Match Ledgers</h3>
            </div>
            <button className="flex items-center justify-center gap-2 border border-[#CED3DC] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#4E8098] transition-all hover:bg-[#FCF7F8] hover:text-[#1a1a1a]">
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left align-middle min-w-[800px]">
              <thead className="bg-white">
                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                  <th className="px-6 py-4 font-semibold">Fixture</th>
                  <th className="px-6 py-4 font-semibold">Gross Rev</th>
                  <th className="px-6 py-4 font-semibold">Reservation Rev</th>
                  <th className="px-6 py-4 font-semibold">Platform Fee (5%)</th>
                  <th className="px-6 py-4 font-semibold">Net Result</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {records.map((r, i) => (
                  <tr key={i} className="hover:bg-[#FCF7F8] transition-colors group">
                    <td className="px-6 py-4 text-[#1a1a1a] font-medium">{r.match}</td>
                    <td className="px-6 py-4 font-mono text-[#4E8098]">{formatPKR(r.grossRevenue)}</td>
                    <td className="px-6 py-4 font-mono text-[#1a1a1a]">{formatPKR(r.reservationYield)}</td>
                    <td className="px-6 py-4 font-mono text-[#A31621]">- {formatPKR(r.platformFee)}</td>
                    <td className="px-6 py-4 font-mono font-bold text-[#1a1a1a]">{formatPKR(r.netSettle)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest bg-[#4E8098]/10 text-[#4E8098] border border-[#4E8098]/20">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}