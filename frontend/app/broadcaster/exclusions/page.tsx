"use client";

import { useState } from "react";
import { Component, Plus, Search, ShieldCheck } from "lucide-react";

type ExclusionGroup = {
  id: string;
  name: string;
  separationDistance: number;
  crossEvent: boolean;
  brands: string[];
};

const initialGroups: ExclusionGroup[] = [
  { id: "g1", name: "Beverages", separationDistance: 1, crossEvent: true, brands: ["Pepsi", "Coca-Cola", "7Up"] },
  { id: "g2", name: "Telecom", separationDistance: 2, crossEvent: false, brands: ["Jazz", "Zong", "Telenor"] },
];

export default function BroadcasterExclusionsPage() {
  const [groups, setGroups] = useState(initialGroups);

  return (
    <div className="flex flex-col space-y-10 pb-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Component className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]">Protocol Config</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Exclusion Groups</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Manage competitor separation logic. Once an auction state rolls to OPEN, exclusion groups bound to that match are hardcoded and locked.
          </p>
        </div>
        
        <button className="flex items-center gap-2 bg-[#1a1a1a] text-white px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4" /> Create Group
        </button>
      </header>

      <section className="grid gap-6 lg:grid-cols-2 px-0 sm:px-6">
        {groups.map(group => (
          <div key={group.id} className="bg-white border border-[#CED3DC] flex flex-col">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex justify-between items-start">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">{group.name}</h3>
                <p className="text-[10px] text-[#4E8098] mt-1 font-mono">{group.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {group.crossEvent && <span className="bg-[#90C2E7]/20 text-[#1a1a1a] text-[10px] px-2 py-0.5 border border-[#90C2E7]/50 font-bold uppercase">Cross-Event Active</span>}
              </div>
            </div>
            <div className="p-5 space-y-5 flex-1">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098]">Separation Distance</span>
                <span className="font-mono font-bold text-[#1a1a1a] bg-[#FCF7F8] px-2 py-1 border border-[#CED3DC]">{group.separationDistance} Slot(s)</span>
              </div>
              
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] mb-2 block">Brand Pool ({group.brands.length})</span>
                <div className="flex flex-wrap gap-2">
                  {group.brands.map(b => (
                    <span key={b} className="text-xs bg-[#FCF7F8] border border-[#CED3DC] px-3 py-1 font-medium text-[#1a1a1a]">{b}</span>
                  ))}
                  <button className="text-xs bg-white border border-dashed border-[#CED3DC] text-[#4E8098] hover:border-[#1a1a1a] hover:text-[#1a1a1a] px-3 py-1 flex items-center justify-center transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}