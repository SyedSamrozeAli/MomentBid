"use client";

import { useState } from "react";
import { ArrowLeft, Target, Radio, Activity, Clock, ShieldCheck, TrendingUp, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

// Mock data
const mockMatch = {
  id: "m1",
  homeTeam: "Karachi Kings",
  awayTeam: "Lahore Qalandars",
  status: "ACTIVE",
  timeText: "LIVE",
  venue: "National Stadium, Karachi",
  date: "Apr 14, 2026",
  broadcaster: "PTV Sports"
};

const budgetStats = {
  cap: 8000000,
  spent: 2300000,
  remaining: 5700000,
  escrowed: 2300000
};

type EventCategory = {
  id: string;
  name: string;
  reservePrice: number;
  slots: number;
  reservationFee: number;
  myBidAmount: number;
  myBidRank: number | null;
  status: "No Bid" | "Leading" | "Outbid" | "Settled";
};

const categories: EventCategory[] = [
  { id: "e1", name: "OVER_BREAK", reservePrice: 100000, slots: 3, reservationFee: 2, myBidAmount: 400000, myBidRank: 1, status: "Leading" },
  { id: "e2", name: "WICKET_FALL", reservePrice: 150000, slots: 2, reservationFee: 5, myBidAmount: 250000, myBidRank: 3, status: "Outbid" },
  { id: "e3", name: "STRATEGIC_TIMEOUT", reservePrice: 300000, slots: 5, reservationFee: 1, myBidAmount: 0, myBidRank: null, status: "No Bid" },
];

const liveResults = [
  {
    time: "18:40:12",
    event: "OVER_BREAK",
    outcome: "Partial Fill 2/3",
    winners: ["Brand B - PKR 350K", "Kababjees (You) - PKR 300K", "House Ad"]
  },
  {
    time: "18:44:03",
    event: "WICKET_FALL",
    outcome: "Full Fill 2/2",
    winners: ["Brand C - PKR 280K", "Brand A - PKR 260K"]
  }
];

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [activeTab, setActiveTab] = useState<"bidding" | "live">("bidding");

  return (
    <div className="flex flex-col space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/brand/matches" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#4E8098] hover:text-[#A31621] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${mockMatch.status === "ACTIVE" ? "bg-[#A31621]/10 text-[#A31621]" : "bg-[#CED3DC] text-[#1a1a1a]"}`}>
                {mockMatch.status}
              </span>
              <span className="text-[10px] font-mono text-[#4E8098] uppercase">{mockMatch.timeText}</span>
            </div>
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
            <span className="w-1 h-1 rounded-full bg-[#CED3DC]"></span>
            <span>Host: {mockMatch.broadcaster}</span>
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
                onClick={() => setActiveTab("bidding")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors ${activeTab === "bidding" ? "border-b-2 border-[#A31621] text-[#A31621]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
              >
                Event Bidding
              </button>
              <button 
                onClick={() => setActiveTab("live")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === "live" ? "border-b-2 border-[#A31621] text-[#A31621]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
              >
                <Radio className={`w-3.5 h-3.5 ${activeTab === "live" ? "animate-pulse" : ""}`} />
                Live Results
              </button>
            </div>

            {/* Bidding View */}
            {activeTab === "bidding" && (
              <div className="space-y-4">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-white border border-[#CED3DC] p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center border-b border-[#CED3DC]/50 pb-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-[#1a1a1a] flex items-center gap-2">
                          {cat.name.replace(/_/g, " ")}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-[#4E8098] font-mono">
                          <span>Reserve: {cat.reservePrice.toLocaleString("en-PK")} PKR</span>
                          <span>Slots: {cat.slots}</span>
                          <span>Fee: {cat.reservationFee}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          cat.status === "Leading" ? "bg-[#90C2E7]/20 text-[#1a1a1a]" :
                          cat.status === "Outbid" ? "bg-[#A31621]/10 text-[#A31621]" :
                          "bg-[#FCF7F8] border border-[#CED3DC] text-[#4E8098]"
                        }`}>
                          {cat.status}
                        </span>
                        {cat.myBidRank && (
                          <span className="text-xs font-semibold text-[#1a1a1a] bg-[#FCF7F8] px-2 py-1 border border-[#CED3DC]">
                            Rank #{cat.myBidRank}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                        <label className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1.5 block">Your Max Bid (PKR)</label>
                        <input 
                          type="number" 
                          defaultValue={cat.myBidAmount > 0 ? cat.myBidAmount : ""}
                          placeholder={`Min ${cat.reservePrice.toLocaleString()}`}
                          className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-4 py-2.5 text-sm font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                        />
                      </div>
                      <button className="w-full sm:w-auto mt-5 sm:mt-0 bg-[#1a1a1a] hover:bg-[#333] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap">
                        {cat.myBidAmount > 0 ? "Update Bid" : "Place Bid"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live Results View */}
            {activeTab === "live" && (
              <div className="space-y-4">
                <div className="bg-[#FCF7F8] p-4 border border-[#CED3DC] flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#A31621] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">Network Oracle Sync Active</span>
                  </div>
                  <Activity className="w-4 h-4 text-[#A31621]" />
                </div>
                
                {liveResults.map((res, idx) => (
                  <div key={idx} className="bg-white border border-[#CED3DC] p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-[#4E8098]">{res.time}</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">{res.event.replace(/_/g, " ")}</span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#FCF7F8] border border-[#CED3DC] text-[#4E8098]">
                        {res.outcome}
                      </span>
                    </div>
                    <div className="space-y-2 mt-4 ml-6 pl-4 border-l-2 border-[#CED3DC]">
                      {res.winners.map((winner, i) => (
                        <div key={i} className="flex font-mono text-xs text-[#1a1a1a]">
                          <span className="text-[#4E8098] w-12 shrink-0">Slot {i + 1}</span>
                          <span className={winner.includes("(You)") ? "font-bold text-[#A31621]" : ""}>{winner}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Sidebar / Escrow Panel */}
          <div className="space-y-6">
            <div className="bg-white border border-[#CED3DC] p-5 sticky top-6">
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-[#4E8098]" />
                Match Budget
              </h3>
              
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono text-[#4E8098]">
                    <span>Total Cap</span>
                    <span>{budgetStats.cap.toLocaleString("en-PK")}</span>
                  </div>
                  <input 
                    type="number" 
                    defaultValue={budgetStats.cap}
                    className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-sm font-mono text-[#1a1a1a]"
                  />
                  <button className="w-full mt-2 bg-[#FCF7F8] border border-[#CED3DC] hover:bg-[#CED3DC]/30 text-[#1a1a1a] py-2 text-[10px] font-bold uppercase tracking-widest transition-colors">
                    Update Cap
                  </button>
                </div>

                <div className="h-px bg-[#CED3DC] w-full" />

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Active Escrow</span>
                    <span className="font-mono text-[#1a1a1a] font-semibold">{budgetStats.escrowed.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Remaining</span>
                    <span className="font-mono text-[#4E8098]">{budgetStats.remaining.toLocaleString()}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-[#FCF7F8] border border-[#CED3DC] relative mt-2">
                    <div 
                      className="absolute top-0 left-0 h-full bg-[#90C2E7]" 
                      style={{ width: `${(budgetStats.escrowed / budgetStats.cap) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#4E8098]/80 text-right mt-1">
                    {Math.round((budgetStats.escrowed / budgetStats.cap) * 100)}% utilized
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex gap-3 text-xs text-[#4E8098] leading-relaxed">
              <HelpCircle className="w-4 h-4 shrink-0 text-[#90C2E7]" />
              <p>Your escrowed amount is temporarily locked while the auction is active. Unused funds are refunded upon match completion.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}