"use client";

import { useState } from "react";
import { ArrowLeft, Target, Radio, Activity, Clock, ShieldCheck, Zap, Settings, TrendingUp, Trophy, PlaySquare } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const mockMatch = {
  id: "m1",
  homeTeam: "Karachi Kings",
  awayTeam: "Lahore Qalandars",
  status: "COMPLETED", // Changed to COMPLETED to show results
  timeText: "Match Finished",
  venue: "National Stadium, Karachi",
  date: "Apr 14, 2026",
};

type EventCategory = {
  id: string;
  name: string;
  reservePrice: number;
  slots: number;
  reservationFee: number;
  maxTriggers: number;
  enabled: boolean;
};

const defaultCategories: EventCategory[] = [
  { id: "e1", name: "OVER_BREAK", reservePrice: 100000, slots: 3, reservationFee: 2, maxTriggers: 40, enabled: true },
  { id: "e2", name: "WICKET_FALL", reservePrice: 150000, slots: 2, reservationFee: 5, maxTriggers: 20, enabled: true },
  { id: "e3", name: "STRATEGIC_TIMEOUT", reservePrice: 300000, slots: 5, reservationFee: 1, maxTriggers: 4, enabled: false },
  { id: "e4", name: "LAST_OVER_THRILLER", reservePrice: 700000, slots: 1, reservationFee: 0, maxTriggers: 1, enabled: true },
];

export default function BroadcasterMatchDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const initTab = searchParams.get("tab") === "live" ? "live" : searchParams.get("tab") === "results" ? "results" : "config";
  
  const [activeTab, setActiveTab] = useState<"config" | "live" | "results">(initTab);
  const [categories, setCategories] = useState(defaultCategories);
  const [matchStatus, setMatchStatus] = useState(mockMatch.status);

  const toggleEvent = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  return (
    <div className="flex flex-col space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/broadcaster/matches" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#4E8098] hover:text-[#A31621] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                matchStatus === "ACTIVE" ? "bg-[#A31621] text-white" : 
                matchStatus === "OPEN" ? "bg-[#90C2E7]/20 text-[#1a1a1a]" : 
                "bg-[#CED3DC] text-[#1a1a1a]"
              }`}>
                {matchStatus}
              </span>
              <span className="text-[10px] font-mono text-[#4E8098] uppercase">{mockMatch.timeText}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {matchStatus === "CREATED" && (
              <button 
                onClick={() => setMatchStatus("OPEN")}
                className="bg-[#1a1a1a] hover:bg-[#333] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Open Bidding
              </button>
            )}
            {matchStatus === "OPEN" && (
              <button 
                onClick={() => setMatchStatus("ACTIVE")}
                className="bg-[#A31621] hover:bg-[#8a121c] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                <Radio className="w-3.5 h-3.5" /> Go Live
              </button>
            )}
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl md:text-4xl font-medium tracking-tight text-[#1a1a1a] mt-2">
            {mockMatch.homeTeam} <span className="text-[#4E8098] mx-2 text-lg">vs</span> {mockMatch.awayTeam}
          </h1>
          <p className="mt-2 text-sm text-[#4E8098] flex items-center justify-start gap-4">
            <span>{mockMatch.date}</span>
            <span className="w-1 h-1 rounded-full bg-[#CED3DC]"></span>
            <span>{mockMatch.venue}</span>
          </p>
        </div>
      </div>

      <div className="px-0 sm:px-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tabs */}
            <div className="border-b border-[#CED3DC] flex items-center gap-6">
              <button 
                onClick={() => setActiveTab("config")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === "config" ? "border-b-2 border-[#1a1a1a] text-[#1a1a1a]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
              >
                <Settings className="w-4 h-4" /> Match Config
              </button>
              <button 
                onClick={() => setActiveTab("live")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === "live" ? "border-b-2 border-[#A31621] text-[#A31621]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
              >
                <Zap className="w-4 h-4" /> Live Control
              </button>
              {matchStatus === "COMPLETED" && (
                <button 
                  onClick={() => setActiveTab("results")}
                  className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === "results" ? "border-b-2 border-[#1a1a1a] text-[#1a1a1a]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
                >
                  <Trophy className="w-4 h-4" /> Results & Ads
                </button>
              )}
            </div>

            {/* Config View */}
            {activeTab === "config" && (
              <div className="space-y-4">
                <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex gap-3 text-xs text-[#4E8098] mb-4">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#90C2E7]" />
                  <p>Configure floor prices and available slots. Once you click "Open Bidding", these parameters are locked to the blockchain.</p>
                </div>
                
                {categories.map(cat => (
                  <div key={cat.id} className={`bg-white border p-5 transition-colors ${cat.enabled ? "border-[#4E8098]" : "border-[#CED3DC] opacity-60"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={cat.enabled} 
                          onChange={() => toggleEvent(cat.id)}
                          disabled={matchStatus !== "CREATED"}
                          className="w-4 h-4 accent-[#1a1a1a]"
                        />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a]">
                          {cat.name.replace(/_/g, " ")}
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-7">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Reserve (PKR)</label>
                        <input type="number" defaultValue={cat.reservePrice} disabled={!cat.enabled || matchStatus !== "CREATED"} className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Slots</label>
                        <input type="number" defaultValue={cat.slots} disabled={!cat.enabled || matchStatus !== "CREATED"} className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Res Fee %</label>
                        <input type="number" defaultValue={cat.reservationFee} disabled={!cat.enabled || matchStatus !== "CREATED"} className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Max Triggers</label>
                        <input type="number" defaultValue={cat.maxTriggers} disabled={!cat.enabled || matchStatus !== "CREATED"} className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live View */}
            {activeTab === "live" && (
              <div className="space-y-4">
                {matchStatus !== "ACTIVE" && (
                  <div className="bg-[#FCF7F8] border border-[#CED3DC] p-6 text-center text-sm text-[#4E8098]">
                    Live triggers are disabled until the match state is changed to ACTIVE.
                  </div>
                )}
                
                <div className={`grid grid-cols-2 gap-4 ${matchStatus !== "ACTIVE" ? "opacity-50 pointer-events-none" : ""}`}>
                  {categories.filter(c => c.enabled).map(cat => (
                    <button key={cat.id} className="bg-white border-2 border-[#A31621]/30 hover:border-[#A31621] hover:bg-[#FCF7F8] p-6 text-center transition-colors group flex flex-col items-center justify-center gap-3">
                      <Zap className="w-6 h-6 text-[#A31621] group-hover:scale-110 transition-transform" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">{cat.name.replace(/_/g, " ")}</h4>
                        <span className="text-[10px] text-[#4E8098] font-mono mt-1 block">Trigger Oracle Event</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results View */}
            {activeTab === "results" && (
              <div className="space-y-6">
                <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex gap-3 text-xs text-[#4E8098]">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#90C2E7]" />
                  <p>The bidding period has finished. Below are the winning brands for each triggered event, along with their assigned promotional video/ad greenlit by the regulatory authority.</p>
                </div>
                
                {/* Hardcoded result blocks */}
                <div className="space-y-4">
                  <div className="bg-white border border-[#CED3DC] overflow-hidden">
                    <div className="bg-[#FCF7F8] border-b border-[#CED3DC] p-4 flex justify-between items-center">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-emerald-600" />
                        EVENT: OVER BREAK
                      </h3>
                      <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">SLOT 1 WINNER</span>
                    </div>
                    <div className="p-5 flex flex-col md:flex-row gap-6 items-start">
                      <div className="w-full md:w-48 aspect-video bg-black flex items-center justify-center group relative overflow-hidden shrink-0">
                        <PlaySquare className="w-8 h-8 text-white opacity-50 group-hover:opacity-100 transition-opacity z-10" />
                        <div className="absolute inset-0 bg-[#A31621]/20 group-hover:bg-[#A31621]/10 transition-colors"></div>
                        <span className="absolute bottom-2 right-2 px-1 py-0.5 bg-black/80 text-[8px] text-white font-mono uppercase tracking-widest">0:15</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="text-xs uppercase font-semibold text-[#4E8098]">Winning Brand</h4>
                          <p className="text-lg font-bold text-[#1a1a1a] tracking-tight">Kababjees (KB)</p>
                        </div>
                        <div>
                          <h4 className="text-xs uppercase font-semibold text-[#4E8098] mb-1">Assigned Ad Creative</h4>
                          <p className="text-sm text-[#1a1a1a] flex items-center gap-2 font-medium">Summer Blast 2026 - 15s</p>
                          <p className="text-[10px] font-mono tracking-widest text-emerald-600 mt-1 flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-0.5 w-fit">
                            <ShieldCheck className="w-3 h-3" /> VERIFIED & GREENLIT
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#CED3DC] w-full flex justify-between items-center mt-2">
                          <span className="text-[10px] uppercase font-semibold text-[#4E8098]">Winning Bid</span>
                          <span className="font-mono text-sm font-bold text-[#A31621]">350,000 PKR</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-[#CED3DC] overflow-hidden">
                    <div className="bg-[#FCF7F8] border-b border-[#CED3DC] p-4 flex justify-between items-center">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-emerald-600" />
                        EVENT: WICKET FALL
                      </h3>
                      <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">SLOT 1 WINNER</span>
                    </div>
                    <div className="p-5 flex flex-col md:flex-row gap-6 items-start">
                      <div className="w-full md:w-48 aspect-video bg-black flex items-center justify-center group relative overflow-hidden shrink-0">
                        <PlaySquare className="w-8 h-8 text-white opacity-50 group-hover:opacity-100 transition-opacity z-10" />
                        <div className="absolute inset-0 bg-[#4E8098]/20 group-hover:bg-[#4E8098]/10 transition-colors"></div>
                        <span className="absolute bottom-2 right-2 px-1 py-0.5 bg-black/80 text-[8px] text-white font-mono uppercase tracking-widest">0:05</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="text-xs uppercase font-semibold text-[#4E8098]">Winning Brand</h4>
                          <p className="text-lg font-bold text-[#1a1a1a] tracking-tight">Jazz (JZ)</p>
                        </div>
                        <div>
                          <h4 className="text-xs uppercase font-semibold text-[#4E8098] mb-1">Assigned Ad Creative</h4>
                          <p className="text-sm text-[#1a1a1a] flex items-center gap-2 font-medium">Flash Logo Sting</p>
                          <p className="text-[10px] font-mono tracking-widest text-emerald-600 mt-1 flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-0.5 w-fit">
                            <ShieldCheck className="w-3 h-3" /> VERIFIED & GREENLIT
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#CED3DC] w-full flex justify-between items-center mt-2">
                          <span className="text-[10px] uppercase font-semibold text-[#4E8098]">Winning Bid</span>
                          <span className="font-mono text-sm font-bold text-[#A31621]">155,000 PKR</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <div className="bg-white border border-[#CED3DC] p-5 sticky top-6">
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#4E8098]" />
                Event Analytics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Gross Escrow</span>
                  <span className="font-mono text-[#1a1a1a] font-semibold">1,400,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Est. Network Fee</span>
                  <span className="font-mono text-[#A31621]">70,000</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Active Bids</span>
                  <span className="font-mono text-[#1a1a1a]">12</span>
                </div>
              </div>
              <div className="h-px bg-[#CED3DC] w-full my-5" />
              <Link href="/broadcaster/exclusions" className="text-[10px] uppercase font-bold tracking-widest text-[#90C2E7] hover:text-[#4E8098] transition-colors flex items-center justify-center gap-1 w-full border border-[#CED3DC] bg-[#FCF7F8] py-3">
                Review Exclusion Groups <ArrowLeft className="w-3 h-3 rotate-180" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}