"use client";

import { Code, Cpu, ShieldAlert, AlertTriangle } from "lucide-react";

function HardcodedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-[#A31621] border border-[#A31621]/30 px-2 py-1 bg-[#FCF7F8]">
      <AlertTriangle className="w-3 h-3" /> Hardcoded
    </span>
  );
}

export default function AdminProtocolPage() {
  return (
    <div className="p-6 md:p-10 space-y-8 pb-20">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Protocol Config</h2>
        <p className="mt-1 text-sm text-[#4E8098]">Protocol controls are shown with preserved UI structure while backend integration for this page is pending.</p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
            <Code className="w-3 h-3" />
              Platform Fee
            </span>
            <HardcodedBadge />
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">5%</p>
        </div>

        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
            <Cpu className="w-3 h-3" />
              Oracle Heartbeat
            </span>
            <HardcodedBadge />
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">1.3s</p>
        </div>

        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
            <ShieldAlert className="w-3 h-3" />
              Settlement Mode
            </span>
            <HardcodedBadge />
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">Automatic</p>
        </div>
      </section>

      <section className="bg-white border border-[#CED3DC] overflow-hidden">
        <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Protocol Ruleset</h3>
          <HardcodedBadge />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-widest text-[#4E8098] bg-white border-b border-[#CED3DC]">
              <tr>
                <th className="px-5 py-4 font-semibold">Rule</th>
                <th className="px-5 py-4 font-semibold">Current Value</th>
                <th className="px-5 py-4 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CED3DC]/50">
              <tr>
                <td className="px-5 py-3 text-[#1a1a1a]">Platform Fee Deduction</td>
                <td className="px-5 py-3 text-[#1a1a1a]">5%</td>
                <td className="px-5 py-3 text-[#1a1a1a]">Deducted during settlement</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-[#1a1a1a]">Oracle Retry Window</td>
                <td className="px-5 py-3 text-[#1a1a1a]">3 seconds</td>
                <td className="px-5 py-3 text-[#1a1a1a]">Retry before final failure</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-[#1a1a1a]">Escrow Enforcement</td>
                <td className="px-5 py-3 text-[#1a1a1a]">Enabled</td>
                <td className="px-5 py-3 text-[#1a1a1a]">Bid placement requires escrow lock</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
