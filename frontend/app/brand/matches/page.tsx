"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter, Calendar, Target, Activity, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { BrandApiError, listMatches, type MatchRecord } from "@/lib/brandApi";

type Match = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  status: "OPEN" | "ACTIVE" | "COMPLETED" | "CREATED" | "CANCELLED";
  date: string;
  venue: string;
  broadcaster: string;
  biddable: boolean;
};

type MatchFilter = "ALL" | "OPEN" | "ACTIVE";

function getStatusLabel(state: number): Match["status"] {
  switch (state) {
    case 0:
      return "CREATED";
    case 1:
      return "OPEN";
    case 2:
      return "ACTIVE";
    case 3:
      return "COMPLETED";
    case 4:
      return "CANCELLED";
    default:
      return "CREATED";
  }
}

function formatMatchDate(dateString: string): string {
  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toMatchCard(match: MatchRecord): Match {
  return {
    id: match.id,
    homeTeam: match.team_a,
    awayTeam: match.team_b,
    status: getStatusLabel(match.state),
    date: formatMatchDate(match.match_date),
    venue: match.venue,
    broadcaster: match.broadcaster,
    biddable: match.state === 1,
  };
}

export default function BrowseMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<MatchFilter>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMatches(): Promise<void> {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await listMatches();
        if (!isMounted) {
          return;
        }

        setMatches(response.map(toMatchCard));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof BrandApiError ? error.message : "Unable to load matches right now.";
        setLoadError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMatches();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filter !== "ALL" && m.status !== filter) {
        return false;
      }

      const lowerSearch = search.trim().toLowerCase();
      if (
        lowerSearch &&
        !m.homeTeam.toLowerCase().includes(lowerSearch) &&
        !m.awayTeam.toLowerCase().includes(lowerSearch)
      ) {
        return false;
      }

      return true;
    });
  }, [filter, matches, search]);

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
            {(["ALL", "OPEN", "ACTIVE"] as const).map((f) => (
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

      {loadError ? (
        <div className="mx-0 sm:mx-6 border border-[#A31621]/30 bg-[#FCF7F8] px-4 py-3 text-sm text-[#A31621]">
          {loadError}
        </div>
      ) : null}

      {/* Grid */}
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 px-0 sm:px-6">
        {isLoading ? (
          <div className="col-span-full border border-[#CED3DC] bg-[#FCF7F8] p-12 flex flex-col justify-center items-center text-center">
            <Activity className="w-8 h-8 text-[#90C2E7] mb-4 animate-pulse" />
            <p className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">Loading fixtures</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="col-span-full border border-[#CED3DC] bg-[#FCF7F8] p-12 flex flex-col justify-center items-center text-center">
            <Filter className="w-8 h-8 text-[#CED3DC] mb-4" />
            <p className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">No fixtures found</p>
            <p className="mt-1 text-[10px] text-[#4E8098]/80 uppercase tracking-widest">Adjust your filters to see more matches</p>
          </div>
        ) : (
          filteredMatches.map((match) => (
            <article key={match.id} className="group border border-[#CED3DC] bg-white flex flex-col hover:border-[#90C2E7] transition-all">
              <div
                className={`p-5 border-b border-[#CED3DC] flex items-start justify-between ${
                  match.status === "ACTIVE" ? "bg-[#FCF7F8]" : "bg-white"
                }`}
              >
                <div className="space-y-1 w-full">
                  <div className="flex justify-between items-center w-full mb-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        match.status === "OPEN"
                          ? "bg-[#90C2E7]/20 text-[#1a1a1a] border border-[#90C2E7]/50"
                          : match.status === "ACTIVE"
                            ? "bg-[#A31621] text-white"
                            : "bg-[#FCF7F8] text-[#4E8098] border border-[#CED3DC]"
                      }`}
                    >
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