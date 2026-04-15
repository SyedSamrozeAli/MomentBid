"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Filter, Calendar, Settings, Zap, Target, Activity } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BroadcasterApiError, createMatch, getCurrentUserContext, listMatches, type MatchRecord } from "@/lib/broadcasterApi";

type Match = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  status: "CREATED" | "OPEN" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  date: string;
  venue: string;
};

function matchStateToStatus(state: number): Match["status"] {
  if (state === 1) {
    return "OPEN";
  }
  if (state === 2) {
    return "ACTIVE";
  }
  if (state === 3) {
    return "COMPLETED";
  }
  if (state === 4) {
    return "CANCELLED";
  }
  return "CREATED";
}

function formatMatchDate(matchDate: string): string {
  const date = new Date(`${matchDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return matchDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function mapMatchRecord(record: MatchRecord): Match {
  return {
    id: String(record.id),
    homeTeam: record.team_a,
    awayTeam: record.team_b,
    status: matchStateToStatus(record.state),
    date: formatMatchDate(record.match_date),
    venue: record.venue,
  };
}

function normalizeMatchTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  return trimmed;
}

export default function AppBroadcasterMatchesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "CREATED" | "OPEN" | "ACTIVE">("ALL");
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [broadcasterName, setBroadcasterName] = useState<string>("");
  const [isContextReady, setIsContextReady] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadContext(): Promise<void> {
      setLoadError("");
      setIsContextReady(false);

      try {
        const context = await getCurrentUserContext();
        if (!isMounted) {
          return;
        }

        const nextBroadcasterName = context.org?.type === "broadcaster" ? context.org.name : "";
        setBroadcasterName(nextBroadcasterName);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof BroadcasterApiError ? error.message : "Unable to load fixtures.";
        setLoadError(message);
        setBroadcasterName("");
      } finally {
        if (isMounted) {
          setIsContextReady(true);
        }
      }
    }

    void loadContext();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMatches(): Promise<void> {
      if (!isContextReady) {
        return;
      }

      setLoadError("");
      setIsLoading(true);

      const stateFilter =
        filter === "CREATED" ? 0 : filter === "OPEN" ? 1 : filter === "ACTIVE" ? 2 : undefined;

      try {
        const records = await listMatches(stateFilter);
        if (!isMounted) {
          return;
        }

        const filteredRecords = broadcasterName ? records.filter((match) => match.broadcaster === broadcasterName) : records;
        const mapped = filteredRecords.map(mapMatchRecord);
        setMatches(mapped);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof BroadcasterApiError ? error.message : "Unable to load fixtures.";
        setLoadError(message);
        setMatches([]);
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
  }, [broadcasterName, filter, isContextReady]);

  async function handleCreateMatchSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreateError("");

    const nextTeamA = teamA.trim();
    const nextTeamB = teamB.trim();
    const nextVenue = venue.trim();
    const nextMatchDate = matchDate.trim();
    const nextMatchTime = normalizeMatchTime(matchTime);

    if (!nextTeamA || !nextTeamB || !nextVenue || !nextMatchDate || !nextMatchTime) {
      setCreateError("Please fill in all match fields.");
      return;
    }

    if (nextTeamA.toLowerCase() === nextTeamB.toLowerCase()) {
      setCreateError("Team A and Team B must be different.");
      return;
    }

    setIsCreating(true);
    try {
      const created = await createMatch({
        team_a: nextTeamA,
        team_b: nextTeamB,
        venue: nextVenue,
        match_date: nextMatchDate,
        match_time: nextMatchTime,
      });

      setIsCreateOpen(false);
      setTeamA("");
      setTeamB("");
      setVenue("");
      setMatchDate("");
      setMatchTime("");

      router.push(`/broadcaster/matches/${created.id}`);
    } catch (error) {
      const message = error instanceof BroadcasterApiError ? error.message : "Unable to create match.";
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  }

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (filter !== "ALL" && match.status !== filter) {
        return false;
      }

      const lowerSearch = search.toLowerCase();
      if (
        search &&
        !match.homeTeam.toLowerCase().includes(lowerSearch) &&
        !match.awayTeam.toLowerCase().includes(lowerSearch)
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
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">Match Control</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Manage Fixtures</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Create properties, configure event-based ad slots, and manually trigger live market settlements.
          </p>
        </div>
        
        {/* Search, Filter, Action */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-4 bg-[#FCF7F8] border border-[#CED3DC] p-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#4E8098] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search fixtures..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-[#CED3DC] pl-9 pr-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
              />
            </div>
            <div className="flex items-center gap-2 hidden sm:flex">
              {(["ALL", "CREATED", "OPEN", "ACTIVE"] as const).map(f => (
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
          
          <button
            type="button"
            onClick={() => setIsCreateOpen((previous) => !previous)}
            className="flex items-center gap-2 bg-[#A31621] text-white px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#8a121c] transition-colors whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            <Plus className="w-4 h-4" /> Create Match
          </button>
        </div>
      </header>

      {isCreateOpen ? (
        <section className="px-0 sm:px-6">
          <div className="border border-[#CED3DC] bg-white">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">Create Fixture</h3>
                <p className="text-[10px] text-[#4E8098]/80 mt-1 uppercase tracking-widest">
                  Enter teams, venue, and scheduled time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] hover:text-[#1a1a1a] transition-colors"
              >
                Close
              </button>
            </div>

            <form onSubmit={(event) => void handleCreateMatchSubmit(event)} className="p-5 grid gap-4">
              {createError ? (
                <div className="border border-[#A31621]/30 bg-[#FCF7F8] p-3 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
                  {createError}
                </div>
              ) : null}

              {broadcasterName ? (
                <div className="text-[10px] uppercase tracking-widest text-[#4E8098]">
                  Creating as: <span className="font-semibold text-[#1a1a1a]">{broadcasterName}</span>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Team A</label>
                  <input
                    value={teamA}
                    onChange={(event) => setTeamA(event.target.value)}
                    className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                    placeholder="e.g., Lahore Qalandars"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Team B</label>
                  <input
                    value={teamB}
                    onChange={(event) => setTeamB(event.target.value)}
                    className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                    placeholder="e.g., Karachi Kings"
                    disabled={isCreating}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Venue</label>
                  <input
                    value={venue}
                    onChange={(event) => setVenue(event.target.value)}
                    className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                    placeholder="e.g., Gaddafi Stadium, Lahore"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Match Date</label>
                  <input
                    type="date"
                    value={matchDate}
                    onChange={(event) => setMatchDate(event.target.value)}
                    className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-1">Match Time</label>
                  <input
                    type="time"
                    value={matchTime}
                    onChange={(event) => setMatchTime(event.target.value)}
                    className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                    disabled={isCreating}
                  />
                  <p className="mt-1 text-[10px] text-[#4E8098] uppercase tracking-widest">Stored as HH:MM:SS</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  className="border border-[#CED3DC] bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] hover:bg-[#FCF7F8] hover:text-[#1a1a1a] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#A31621] text-white px-5 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#8a121c] disabled:opacity-60"
                >
                  {isCreating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {loadError ? (
        <div className="border border-[#A31621]/30 bg-white p-4 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
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
          </div>
        ) : (
          filteredMatches.map(match => (
            <article key={match.id} className="group border border-[#CED3DC] bg-white flex flex-col hover:border-[#4E8098] transition-all">
              <div className={`p-5 border-b border-[#CED3DC] flex items-start justify-between ${match.status === "ACTIVE" ? "bg-[#FCF7F8]" : "bg-white"}`}>
                <div className="space-y-1 w-full">
                  <div className="flex justify-between items-center w-full mb-3">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      match.status === "CREATED" ? "bg-[#CED3DC] text-[#1a1a1a]" :
                      match.status === "OPEN" ? "bg-[#90C2E7]/20 text-[#1a1a1a] border border-[#90C2E7]/50" :
                      match.status === "ACTIVE" ? "bg-[#A31621] text-white" :
                      "bg-[#FCF7F8] text-[#4E8098] border border-[#CED3DC]"
                    }`}>
                      {match.status}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-[#4E8098]/80">
                      <Calendar className="w-3 h-3" /> {match.date}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold tracking-tight text-[#1a1a1a] leading-snug">
                    {match.homeTeam} <span className="text-[#4E8098] font-normal text-sm mx-1">vs</span> {match.awayTeam}
                  </h3>
                  <p className="text-xs text-[#4E8098] line-clamp-1">{match.venue}</p>
                </div>
              </div>
              <div className="p-0 border-t border-[#CED3DC] grid grid-cols-2 divide-x divide-[#CED3DC]">
                <Link
                  href={`/broadcaster/matches/${match.id}`}
                  className="flex items-center justify-center gap-2 p-3 text-xs font-bold uppercase tracking-widest text-[#4E8098] hover:text-[#1a1a1a] hover:bg-[#FCF7F8] transition-colors"
                >
                  <Settings className="w-4 h-4" /> Config
                </Link>
                <Link
                  href={`/broadcaster/matches/${match.id}?tab=live`}
                  className="flex items-center justify-center gap-2 p-3 text-xs font-bold uppercase tracking-widest text-[#4E8098] hover:text-[#A31621] hover:bg-[#FCF7F8] transition-colors"
                >
                  <Zap className="w-4 h-4" /> Trigger
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}