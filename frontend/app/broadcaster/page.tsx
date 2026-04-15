import Link from "next/link";
import { ArrowRight, Activity, TrendingUp, Radio, ShieldCheck, Component } from "lucide-react";

const broadcasterSnapshot = {
  totalEarnings: 8450000,
  upcomingMatches: 3,
  activeAuctions: 1,
  activeBidders: 24,
};

const recentMatches = [
  { id: "m1", title: "Karachi Kings vs Lahore Qalandars", status: "ACTIVE", bids: 42, revenue: 1200000 },
  { id: "m2", title: "Islamabad United vs Multan Sultans", status: "OPEN", bids: 18, revenue: 0 },
  { id: "m4", title: "Quetta Gladiators vs Peshawar Zalmi", status: "COMPLETED", bids: 56, revenue: 3450000 },
];

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BroadcasterDashboardPage() {
  return (
    <div className="flex flex-col space-y-10 pb-10">
      
      {/* Header */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]">Studio Control</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Network Overview</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Monitor live match performance, total protocol earnings, and upcoming ad inventory demand.
          </p>
        </div>
      </header>

      {/* Snapshot Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-[#CED3DC] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#4E8098]">Total Earnings</h3>
            <TrendingUp className="w-4 h-4 text-[#90C2E7]" />
          </div>
          <p className="text-2xl font-light text-[#1a1a1a]">{formatPKR(broadcasterSnapshot.totalEarnings)}</p>
        </div>
        <div className="bg-white border border-[#CED3DC] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#4E8098]">Active Matches</h3>
            <Radio className="w-4 h-4 text-[#A31621] animate-pulse" />
          </div>
          <p className="text-2xl font-light text-[#1a1a1a]">{broadcasterSnapshot.activeAuctions} Live</p>
        </div>
        <div className="bg-white border border-[#CED3DC] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#4E8098]">Upcoming Matches</h3>
            <ShieldCheck className="w-4 h-4 text-[#4E8098]" />
          </div>
          <p className="text-2xl font-light text-[#1a1a1a]">{broadcasterSnapshot.upcomingMatches} Scheduled</p>
        </div>
        <div className="bg-white border border-[#CED3DC] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#4E8098]">Active Bidders</h3>
            <Activity className="w-4 h-4 text-[#4E8098]" />
          </div>
          <p className="text-2xl font-light text-[#1a1a1a]">{broadcasterSnapshot.activeBidders} Brands</p>
        </div>
      </section>

      {/* Quick Actions & Recent Matches */}
      <section className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px]">
        {/* Recent Matches */}
        <article className="border border-[#CED3DC] bg-white flex flex-col">
          <div className="p-5 border-b border-[#CED3DC] flex items-center justify-between bg-[#FCF7F8]">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">Fixtures & Inventory</h3>
              <p className="text-[10px] text-[#4E8098]/80 mt-1 uppercase tracking-widest">Recent & Active Auctions</p>
            </div>
            <Link
              href="/broadcaster/matches"
              className="group flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#90C2E7] transition-colors hover:text-[#4E8098]"
            >
              View All
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[600px]">
              <thead className="bg-white">
                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                  <th className="px-5 py-4 font-semibold">Match</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Total Bids</th>
                  <th className="px-5 py-4 font-semibold">Current Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {recentMatches.map((match) => (
                  <tr key={match.id} className="group transition-colors hover:bg-[#FCF7F8]">
                    <td className="px-5 py-4">
                      <span className="font-semibold tracking-wide text-[#1a1a1a]">{match.title}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        match.status === "ACTIVE" ? "bg-[#A31621] text-white" :
                        match.status === "OPEN" ? "bg-[#90C2E7]/20 text-[#1a1a1a] border border-[#90C2E7]/50" :
                        "bg-[#FCF7F8] text-[#4E8098] border border-[#CED3DC]"
                      }`}>
                        {match.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[#4E8098]">{match.bids}</td>
                    <td className="px-5 py-4 font-mono text-[#4E8098]">{formatPKR(match.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* Quick Actions */}
        <div className="flex flex-col gap-6">
          <Link
            href="/broadcaster/matches"
            className="group flex items-center justify-between bg-[#1a1a1a] p-5 transition-all hover:bg-[#333]"
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-widest text-white uppercase">Create New Match</span>
              <span className="text-[10px] text-white/60 lowercase tracking-wide">Configure inventory and reserve floors</span>
            </div>
            <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
          </Link>

          <article className="border border-[#CED3DC] bg-white">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8]">
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">Protocol Config</h3>
              <p className="mt-1 text-[10px] text-[#4E8098]/80 uppercase tracking-widest">Network Setup</p>
            </div>
            <div className="p-5 space-y-4">
              <Link href="/broadcaster/exclusions" className="group flex items-center gap-3">
                <div className="p-2 border border-[#CED3DC] bg-[#FCF7F8] group-hover:border-[#90C2E7] transition-colors">
                  <Component className="w-4 h-4 text-[#4E8098]" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#1a1a1a]">Exclusion Groups</h4>
                  <p className="text-[10px] text-[#4E8098]">Manage brand separation logic</p>
                </div>
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}