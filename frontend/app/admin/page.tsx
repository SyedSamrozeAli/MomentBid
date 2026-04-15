"use client";

import { Activity, ShieldAlert, Cpu, BarChart3, Clock, AlertTriangle, Play } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="p-6 md:p-10 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Global Observation Deck</h2>
          <p className="mt-1 text-sm text-[#4E8098]">Protocol telemetry, aggregate liquidity, and master alerts.</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-[#A31621] text-white px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#8a121c] transition-colors shadow-sm">
           <AlertTriangle className="w-4 h-4 shrink-0" />
           Emergency Pause Protocol
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {/* Top Stats */}
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><BarChart3 className="w-3 h-3"/> Total Value Locked (PKR)</p>
           <p className="text-3xl font-light text-[#1a1a1a]">12,450,000</p>
         </div>
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><Cpu className="w-3 h-3"/> Active Matches</p>
           <p className="text-3xl font-light text-[#1a1a1a]">3 <span className="text-sm text-[#4E8098] ml-2">/ 14 Total</span></p>
         </div>
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><Activity className="w-3 h-3"/> Network Platform Fee (5%)</p>
           <p className="text-3xl font-mono font-medium text-[#1a1a1a]">842,000</p>
         </div>
         <div className="bg-white border border-[#CED3DC] p-5">
           <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2"><ShieldAlert className="w-3 h-3"/> Triggered Events</p>
           <p className="text-3xl font-light text-[#1a1a1a]">142</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#CED3DC]">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex justify-between items-center">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Recent Protocol Transactions</h3>
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
                  <tr className="hover:bg-[#FCF7F8]">
                    <td className="px-5 py-3 font-mono text-[#A31621] text-xs">0x4a91...f2e0</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-[#CED3DC] bg-white">AUCTION_SETTLED</span></td>
                    <td className="px-5 py-3 text-[#1a1a1a]">m2_psl_final</td>
                    <td className="px-5 py-3 text-[#4E8098] text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> 2m ago</td>
                  </tr>
                  <tr className="hover:bg-[#FCF7F8]">
                    <td className="px-5 py-3 font-mono text-[#A31621] text-xs">0x1b22...88aa</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-[#CED3DC] bg-white">BID_PLACED</span></td>
                    <td className="px-5 py-3 text-[#1a1a1a]">m3_zalmi</td>
                    <td className="px-5 py-3 text-[#4E8098] text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> 5m ago</td>
                  </tr>
                  <tr className="hover:bg-[#FCF7F8]">
                    <td className="px-5 py-3 font-mono text-[#A31621] text-xs">0x8cc4...10d5</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-[#CED3DC] bg-white">MATCH_OPENED</span></td>
                    <td className="px-5 py-3 text-[#1a1a1a]">m4_united</td>
                    <td className="px-5 py-3 text-[#4E8098] text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> 15m ago</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-[#1a1a1a] border border-[#1a1a1a] text-white p-6">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white/80 mb-4 flex items-center gap-2">
                 <Activity className="w-4 h-4 text-[#A31621]" />
                 Oracle Simulator
              </h3>
              <p className="text-xs text-white/60 leading-relaxed mb-6">
                 Development environment control. Enter the Oracle Sandbox to trigger simulated match events directly onto the blockchain testnet.
              </p>
              <Link href="/admin/simulator" className="w-full flex items-center justify-between px-4 py-3 bg-white text-[#1a1a1a] text-xs font-bold uppercase tracking-widest hover:bg-[#FCF7F8] transition-colors group">
                 Launch Simulator
                 <Play className="w-4 h-4 text-[#A31621] group-hover:scale-110 transition-transform" />
              </Link>
           </div>
        </div>
      </div>
    </div>
  );
}