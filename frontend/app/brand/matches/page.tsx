"use client";

import { useState } from "react";
import { Search, Filter, Calendar, Target, Activity, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  status: "OPEN" | "ACTIVE" | "COMPLETED" | "CREATED" | "CANCELLED";
  date: string;
  venue: string;
  broadcaster: string;
  biddable: boolean;
};

const mockMatches: Match[] = [
  {
    id: "m1",
    homeTeam: "Karachi Kings",
    awayTeam: "Lahore Qalandars",
    status: "ACTIVE",
    date: "Apr 14, 2026",
    venue: "National Stadium, Karachi",
    broadcaster: "PTV Sports",
    biddable: false,
  },
  {
    id: "m2",
    homeTeam: "Islamabad United",
    awayTeam: "Multan Sultans",
    status: "OPEN",
    date: "Apr 16, 2026",
    venue: "Rawalpindi Cricket Stadium",
    broadcaster: "TEN Sports",
    biddable: true,
  },
  {
    id: "m3",
    homeTeam: "Peshawar Zalmi",
    awayTeam: "Quetta Gladiators",
    status: "OPEN",
    date: "Apr 18, 2026",
    venue: "Gaddafi Stadium, Lahore",
    broadcaster: "A Sports",
    biddable: true,
  },
  {
    id: "m4",
    homeTeam: "Karachi Kings",
    awayTeam: "Multan Sultans",
    status: "COMPLETED",
    date: "Apr 10, 2026",
    venue: "National Stadium, Karachi",
    broadcaster: "PTV Sports",
    biddable: false,
  },
];

export default function BrowseMatchesPage() {
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "ACTIVE">("ALL");
  const [search, setSearch] = useState("");

  const filteredMatches = mockMatches.filter(m => {
    if (filter !== "ALL" && m.status !== filter) return false;
    const lowerSearch = search.toLowerCase();
    if (search && !m.homeTeam.toLowerCase().includes(lowerSearch) && !m.awayTeam.toLowerCase().includes(lowerSearch)) return false;
    return true;
  });

  return (
    <div className="flex flex-col space-y-10 pb-10">
      {/* Header */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-[#4E8098]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">Marketplace</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Browse Matches</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Discover upcoming fixtures, review reserve floors, and configure your bidding strategy before the slots close.
          </p>
        </div>
        
        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#FCF7F8] border border-[#CED3DC] p-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#4E8098] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search teams..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-[#CED3DC] pl-9 pr-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            />
          </div>
          <div className="flex items-center gap-2">
            {(["ALL", "OPEN", "ACTIVE"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  filter === f 
                    ? "bg-[#1a1a1a] text-white" 
                    : "bg-white border border-[#CED3DC] text-[#4E8098] hover:bg-[#CED3DC]/30 hover:text-[#1a1a1a]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Grid */}
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 px-0 sm:px-6">
        {filteredMatches.length === 0 ? (
          <div className="col-span-full border border-[#CED3DC] bg-[#FCF7F8] p-12 flex flex-col justify-center items-center text-center">
            <Filter className="w-8 h-8 text-[#CED3DC] mb-4" />
            <p className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">No fixtures found</p>
            <p className="mt-1 text-[10px] text-[#4E8098]/80 uppercase tracking-widest">Adjust your filters to see more matches</p>
          </div>
        ) : (
          filteredMatches.map(match => (
            <article key={match.id} className="group border border-[#CED3DC] bg-white flex flex-col hover:border-[#90C2E7] transition-all">
              <div className={`p-5 border-b border-[#CED3DC] flex items-start justify-between ${
                match.status === "ACTIVE" ? "bg-[#FCF7F8]" : "bg-white"
              }`}>
                <div className="space-y-1 w-full">
                  <div className="flex justify-between items-center w-full mb-3">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      match.status === "OPEN" ? "bg-[#90C2E7]/20 text-[#1a1a1a] border border-[#90C2E7]/50" :
                      match.status === "ACTIVE" ? "bg-[#A31621] text-white" :
                      "bg-[#FCF7F8] text-[#4E8098] border border-[#CED3DC]"
                    }`}>
                      {match.status}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-[#4E8098]/80">
                      <Calendar className="w-3 h-3" />
                      {match.date}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold tracking-tight text-[#1a1a1a] leading-snug">
                    {match.homeTeam} <span className="text-[#4E8098] font-normal text-sm mx-1">vs</span> {match.awayTeam}
                  </h3>
                  <p className="text-xs text-[#4E8098] line-clamp-1">{match.venue}</p>
                </div>
              </div>

              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-center justify-between text-xs text-[#1a1a1a]">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098]">Host Broadcast</span>
                  <span className="font-semibold">{match.broadcaster}</span>
                </div>
                <div className="bg-[#FCF7F8] p-3 border border-[#CED3DC] flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#90C2E7]" /> Verified
                  </span>
                  <span className="text-[10px] uppercase font-mono text-[#4E8098]/80 text-right">No Fraud</span>
                </div>
              </div>

              <div className="p-5 pt-0 mt-auto">
                <Link
                  href={`/brand/matches/${match.id}`}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                    match.biddable 
                      ? "bg-[#1a1a1a] text-white hover:bg-[#333]" 
                      : "bg-[#FCF7F8] text-[#4E8098] border border-[#CED3DC] hover:text-[#1a1a1a]"
                  }`}
                >
                  {match.biddable ? "Place Bid" : "View Details"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}