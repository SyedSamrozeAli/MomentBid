"use client";

import { useState } from "react";
import { ShieldCheck, Target, Radio, Clock, ChevronRight, ArrowLeft } from "lucide-react";

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  status: "ONGOING" | "UPCOMING_OPEN" | "UPCOMING_CLOSED";
  timeText: string;
  daysUntil?: number;
};

const mockMatches: Match[] = [
  {
    id: "m1",
    homeTeam: "Karachi Kings",
    awayTeam: "Lahore Qalandars",
    status: "ONGOING",
    timeText: "LIVE (2nd Innings, Over 14)",
  },
  {
    id: "m2",
    homeTeam: "Islamabad United",
    awayTeam: "Multan Sultans",
    status: "UPCOMING_OPEN",
    timeText: "Starts in 3 days",
    daysUntil: 3,
  },
  {
    id: "m3",
    homeTeam: "Peshawar Zalmi",
    awayTeam: "Quetta Gladiators",
    status: "UPCOMING_CLOSED",
    timeText: "Starts in 10 days",
    daysUntil: 10,
  },
];

type BidCategory = {
  id: string;
  name: string;
  reservePrice: number;
  currentHighBid: number;
  yourBid: number;
};

const initialCategories: BidCategory[] = [
  { id: "cat1", name: "Hattrick Ball", reservePrice: 500000, currentHighBid: 600000, yourBid: 0 },
  { id: "cat2", name: "Super Over", reservePrice: 1500000, currentHighBid: 1500000, yourBid: 0 },
  { id: "cat3", name: "Final Over (Innings 2)", reservePrice: 800000, currentHighBid: 950000, yourBid: 0 },
];

const BID_INCREMENT = 50000;

export default function MatchesBiddingPage() {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [biddingState, setBiddingState] = useState({
    categories: initialCategories,
    walletBalance: 2550000,
  });

  const { categories, walletBalance } = biddingState;

  const handleMatchClick = (match: Match) => {
    setSelectedMatch(match);
  };

  const handleBack = () => {
    setSelectedMatch(null);
  };

  const handlePlaceBid = (categoryId: string, bidAmount: number) => {
    setBiddingState((prevState) => {
      const targetCategory = prevState.categories.find((category) => category.id === categoryId);

      if (!targetCategory) {
        return prevState;
      }

      const minimumAllowedBid = Math.max(targetCategory.reservePrice, targetCategory.currentHighBid + BID_INCREMENT);
      if (bidAmount < minimumAllowedBid) {
        return prevState;
      }

      const additionalCommitment = bidAmount - targetCategory.yourBid;
      if (additionalCommitment <= 0) {
        return prevState;
      }

      if (prevState.walletBalance < additionalCommitment) {
        console.warn("Insufficient funds to place this bid.");
        return prevState;
      }

      return {
        walletBalance: prevState.walletBalance - additionalCommitment,
        categories: prevState.categories.map((category) => {
          if (category.id !== categoryId) {
            return category;
          }

          return {
            ...category,
            yourBid: bidAmount,
            currentHighBid: Math.max(category.currentHighBid, bidAmount),
          };
        }),
      };
    });
  };

  if (selectedMatch) {
    return (
      <div className="flex flex-col space-y-8 pb-10">
        <header className="flex flex-col gap-4 border-b border-[#CED3DC] pb-5">
          <button 
            onClick={handleBack}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#4E8098] hover:text-[#A31621] transition-colors self-start pb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Matches
          </button>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-[#A31621]" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]/80">
                Match Bidding Interface
              </p>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
              {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}
            </h2>
            <p className="mt-1 text-sm text-[#4E8098] max-w-xl">
              {selectedMatch.timeText}
            </p>
          </div>
        </header>

        {selectedMatch.status === "UPCOMING_CLOSED" ? (
          <div className="bg-white border border-[#CED3DC] p-8 text-center flex flex-col items-center">
            <Clock className="w-8 h-8 text-[#4E8098] mb-4" />
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Bidding is completely closed</h3>
            <p className="text-sm text-[#4E8098] max-w-md">
              This match is starting in more than 1 week ({selectedMatch.daysUntil} days). Bidding channels have not yet opened. 
              Please check back closer to the fixture date.
            </p>
          </div>
        ) : selectedMatch.status === "UPCOMING_OPEN" ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[#1a1a1a]">Available Bid Categories</h3>
              {categories.map(cat => (
                <div key={cat.id} className="bg-white border border-[#CED3DC] p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-[#1a1a1a]">{cat.name}</h4>
                    <p className="text-xs text-[#4E8098] mt-1">Reserve: {"Rs " + cat.reservePrice.toLocaleString()}</p>
                    <p className="text-xs font-medium text-[#A31621] mt-1">Current High: {"Rs " + cat.currentHighBid.toLocaleString()}</p>
                    {cat.yourBid > 0 && (
                      <p className="text-xs font-semibold text-green-600 mt-2">Your locked bid: Rs {cat.yourBid.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                    <button
                      onClick={() => handlePlaceBid(cat.id, cat.currentHighBid > 0 ? cat.currentHighBid + BID_INCREMENT : cat.reservePrice)}
                      className="px-4 py-2 bg-[#1a1a1a] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#A31621] transition-colors w-full sm:w-auto"
                    >
                      Bid Rs {(cat.currentHighBid > 0 ? cat.currentHighBid + BID_INCREMENT : cat.reservePrice).toLocaleString()}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Wallet sidebar in bid page */}
            <div>
              <div className="bg-[#FCF7F8] border border-[#CED3DC] p-5 sticky top-24">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-[#A31621]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#1a1a1a]">Liquidity</span>
                </div>
                <div className="text-3xl font-light text-[#1a1a1a]">
                  Rs {walletBalance.toLocaleString()}
                </div>
                <p className="text-xs text-[#4E8098] mt-2">Available to commit</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#CED3DC] p-8 text-center flex flex-col items-center">
            <Radio className="w-8 h-8 text-[#A31621] mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Live Bidding is on the Live Dashboard</h3>
            <p className="text-sm text-[#4E8098] max-w-md">
              This match is currently ongoing. Please navigate to the Live Match dashboard for real-time trigger bidding.
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- List View ---
  const ongoing = mockMatches.filter(m => m.status === "ONGOING");
  const upcoming = mockMatches.filter(m => m.status.startsWith("UPCOMING"));

  return (
    <div className="flex flex-col space-y-10 pb-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]/80">Fixture Explorer</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Matches & Bidding</h2>
          <p className="mt-1 text-sm text-[#4E8098] max-w-xl">
            Browse upcoming fixtures, assess eligibility, and open bidding positions for targeted events.
          </p>
        </div>
      </header>

      {/* Ongoing Matches */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#1a1a1a] mb-4 flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#A31621] animate-pulse" />
          Ongoing Matches
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {ongoing.map(match => (
            <div 
              key={match.id} 
              onClick={() => handleMatchClick(match)}
              className="bg-white border-2 border-[#A31621]/50 p-5 cursor-pointer hover:border-[#A31621] transition-colors group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold tracking-widest text-white bg-[#A31621] px-2 py-1 uppercase">Live Now</span>
                <ChevronRight className="w-4 h-4 text-[#4E8098] group-hover:text-[#A31621] group-hover:translate-x-1 transition-transform" />
              </div>
              <h4 className="text-lg font-semibold text-[#1a1a1a]">
                {match.homeTeam} vs {match.awayTeam}
              </h4>
              <p className="text-sm text-[#A31621] font-medium mt-1">{match.timeText}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming Matches */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#1a1a1a] mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#4E8098]" />
          Upcoming Matches
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map(match => {
            const isOpen = match.status === "UPCOMING_OPEN";
            return (
              <div 
                key={match.id} 
                onClick={() => handleMatchClick(match)}
                className={`bg-white border p-5 cursor-pointer transition-colors group ${isOpen ? "border-[#4E8098] hover:border-[#1a1a1a]" : "border-[#CED3DC] opacity-80"}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-[10px] font-bold tracking-widest px-2 py-1 uppercase ${isOpen ? "bg-[#90C2E7]/20 text-[#4E8098]" : "bg-[#FCF7F8] text-[#4E8098]/60"}`}>
                    {isOpen ? "Bidding Open" : "Bidding Closed"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#4E8098]/40 group-hover:text-[#4E8098] group-hover:translate-x-1 transition-transform" />
                </div>
                <h4 className="text-lg font-semibold text-[#1a1a1a]">
                  {match.homeTeam} vs {match.awayTeam}
                </h4>
                <p className="text-sm text-[#4E8098] mt-1">{match.timeText}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}