"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ShieldAlert, Cpu, BarChart3, Clock, AlertTriangle, Play, Users, Radio } from "lucide-react";
import Link from "next/link";
import { AdminApiError, listBrands, listBroadcasters, listMatches } from "@/lib/adminApi";

type OverviewSnapshot = {
  totalMatches: number;
  activeMatches: number;
  totalBrands: number;
  totalBroadcasters: number;
};

const defaultOverviewSnapshot: OverviewSnapshot = {
  totalMatches: 0,
  activeMatches: 0,
  totalBrands: 0,
  totalBroadcasters: 0,
};

function renderMetricValue(value: number, isLoading: boolean): string {
  if (isLoading) {
    return "...";
  }

  return String(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load system overview.";
}

export default function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>(defaultOverviewSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOverview(): Promise<void> {
      setIsLoading(true);
      setLoadError("");

      try {
        const [matches, brands, broadcasters] = await Promise.all([listMatches(), listBrands(), listBroadcasters()]);

        if (!isMounted) {
          return;
        }

        const activeMatches = matches.filter((match) => match.state === 2).length;
        setSnapshot({
          totalMatches: matches.length,
          activeMatches,
          totalBrands: brands.length,
          totalBroadcasters: broadcasters.length,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSnapshot(defaultOverviewSnapshot);
        setLoadError(toErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeMatchesLabel = useMemo(() => {
    const active = renderMetricValue(snapshot.activeMatches, isLoading);
    const total = renderMetricValue(snapshot.totalMatches, isLoading);
    return `${active} / ${total}`;
  }, [isLoading, snapshot.activeMatches, snapshot.totalMatches]);

  const hardcodedTransactions = [
    { txHash: "0x4a91...f2e0", txType: "AUCTION_SETTLED", matchId: "m2_psl_final", time: "2m ago" },
    { txHash: "0x1b22...88aa", txType: "BID_PLACED", matchId: "m3_zalmi", time: "5m ago" },
    { txHash: "0x8cc4...10d5", txType: "MATCH_OPENED", matchId: "m4_united", time: "15m ago" },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">System Overview</h2>
          <p className="mt-1 text-sm text-[#4E8098]">Admin metrics sourced from implemented APIs, with hardcoded sections clearly labeled.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="flex items-center justify-center gap-2 bg-[#A31621]/60 text-white px-5 py-3 text-xs font-bold uppercase tracking-widest cursor-not-allowed shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Emergency Pause Protocol
          </button>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-[#A31621] border border-[#A31621]/30 px-2 py-1 bg-white">
            <AlertTriangle className="w-3 h-3" /> Hardcoded
          </span>
        </div>
      </div>

      {loadError ? (
        <div className="border border-[#A31621]/30 bg-white p-4 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
          {loadError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* Top Stats */}
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><BarChart3 className="w-3 h-3"/> Total Matches</p>
           <p className="text-3xl font-light text-[#1a1a1a]">{renderMetricValue(snapshot.totalMatches, isLoading)}</p>
         </div>
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><Cpu className="w-3 h-3"/> Active Matches</p>
           <p className="text-3xl font-light text-[#1a1a1a]">{activeMatchesLabel}</p>
         </div>
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><Users className="w-3 h-3"/> Registered Brands</p>
           <p className="text-3xl font-mono font-medium text-[#1a1a1a]">{renderMetricValue(snapshot.totalBrands, isLoading)}</p>
         </div>
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><Radio className="w-3 h-3"/> Registered Broadcasters</p>
           <p className="text-3xl font-light text-[#1a1a1a]">{renderMetricValue(snapshot.totalBroadcasters, isLoading)}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#CED3DC]">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex justify-between items-center">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Recent Protocol Transactions</h3>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-[#A31621] border border-[#A31621]/30 px-2 py-1 bg-white">
                <AlertTriangle className="w-3 h-3" /> Hardcoded
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-widest text-[#4E8098] bg-white border-b border-[#CED3DC]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Tx Hash</th>
                    <th className="px-5 py-4 font-semibold">Type</th>
                    <th className="px-5 py-4 font-semibold">Match ID</th>
                    <th className="px-5 py-4 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CED3DC]/50">
                  {hardcodedTransactions.map((item) => (
                    <tr key={item.txHash} className="hover:bg-[#FCF7F8]">
                      <td className="px-5 py-3 font-mono text-[#A31621] text-xs">{item.txHash}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-[#CED3DC] bg-white">{item.txType}</span></td>
                      <td className="px-5 py-3 text-[#1a1a1a]">{item.matchId}</td>
                      <td className="px-5 py-3 text-[#4E8098] text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> {item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-[#1a1a1a] border border-[#1a1a1a] text-white p-6">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white/80 mb-4 flex items-center gap-2">
                 <Activity className="w-4 h-4 text-[#A31621]" />
                  Match Simulator
              </h3>
              <p className="text-xs text-white/60 leading-relaxed mb-6">
                  Admin control center for START, TRIGGER, COMPLETE, and CANCEL operations in the simulator workflow.
              </p>
              <Link href="/admin/simulator" className="w-full flex items-center justify-between px-4 py-3 bg-white text-[#1a1a1a] text-xs font-bold uppercase tracking-widest hover:bg-[#FCF7F8] transition-colors group">
                  Open Simulator
                 <Play className="w-4 h-4 text-[#A31621] group-hover:scale-110 transition-transform" />
              </Link>
           </div>

           <div className="bg-white border border-[#CED3DC] p-6">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a] flex items-center gap-2">
                 <ShieldAlert className="w-4 h-4 text-[#4E8098]" />
                 Network Security Summary
               </h3>
               <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-[#A31621] border border-[#A31621]/30 px-2 py-1 bg-[#FCF7F8]">
                 <AlertTriangle className="w-3 h-3" /> Hardcoded
               </span>
             </div>
             <ul className="space-y-2 text-[11px] uppercase tracking-widest font-semibold text-[#1a1a1a]">
               <li>Bridge Health: Stable</li>
               <li>Oracle Latency: 1.3s</li>
               <li>Escrow Verification: Passed</li>
             </ul>
           </div>
        </div>
      </div>
    </div>
  );
}