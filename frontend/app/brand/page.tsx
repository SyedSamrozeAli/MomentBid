import Link from "next/link";
import { ArrowRight, Activity, TrendingUp, ShieldCheck, Zap, Radio } from "lucide-react";

type ActiveBid = {
  eventType: string;
  bid: number;
  rank: number;
  reserve: number;
  slots: number;
  trend: "up" | "stable" | "down";
};

const walletSnapshot = {
  totalBalance: 4850000,
  escrowed: 2300000,
  available: 2550000,
  seasonBudgetCap: 8000000,
};

const activeBids: ActiveBid[] = [
  { eventType: "OVER_BREAK", bid: 400000, rank: 1, reserve: 100000, slots: 3, trend: "up" },
  { eventType: "STRATEGIC_TIMEOUT", bid: 500000, rank: 2, reserve: 300000, slots: 5, trend: "stable" },
  { eventType: "LAST_OVER_THRILLER", bid: 1500000, rank: 1, reserve: 700000, slots: 3, trend: "up" },
  { eventType: "WICKET_FALL", bid: 250000, rank: 3, reserve: 150000, slots: 2, trend: "down" },
];

const nextTriggers = [
  { label: "Over 7 Break", eta: "02:10", expectedSlots: 3, urgency: "high" },
  { label: "Potential Wicket Window", eta: "04:20", expectedSlots: 2, urgency: "medium" },
  { label: "Strategic Timeout", eta: "07:30", expectedSlots: 5, urgency: "low" },
];

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BrandDashboardPage() {
  return (
    <div className="flex flex-col space-y-10 pb-10">
      
      {/* Header */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]">Command Center</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Overview</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Live auction console. Funds are secured and active bids are currently streaming into the network.
          </p>
        </div>
        
        <div className="group border border-[#CED3DC] bg-white px-5 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-none bg-[#A31621]" />
          <div>
            <p className="text-[10px] items-center gap-1 uppercase tracking-widest text-[#4E8098]/80 mb-0.5">Active Fixture</p>
            <p className="text-sm font-semibold text-[#1a1a1a]">
              Karachi Kings vs Lahore Qalandars
            </p>
          </div>
        </div>
      </header>

      {/* Snapshot Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Total Balance" 
          value={formatPKR(walletSnapshot.totalBalance)} 
          accent="blue" 
          icon={<ShieldCheck className="w-4 h-4" />} 
        />
        <StatCard 
          label="Escrow Locked" 
          value={formatPKR(walletSnapshot.escrowed)} 
          accent="red" 
          icon={<Activity className="w-4 h-4" />} 
        />
        <StatCard 
          label="Available Liquidity" 
          value={formatPKR(walletSnapshot.available)} 
          accent="slate" 
          icon={<Zap className="w-4 h-4" />} 
        />
        <StatCard
          label="Season Cap"
          value={formatPKR(walletSnapshot.seasonBudgetCap)}
          accent="blue"
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </section>

      {/* Main Grids */}
      <section className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px]">
        
        {/* Active Bids Table */}
        <article className="border border-[#CED3DC] bg-white flex flex-col">
          <div className="p-5 border-b border-[#CED3DC] flex items-center justify-between bg-[#FCF7F8]">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a]">ACTIVE BID LADDER</h3>
              <p className="text-[10px] text-[#4E8098]/80 mt-1 uppercase tracking-widest">Real-time rank estimation</p>
            </div>
            <Link
              href="/brand/opportunities"
              className="group flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#90C2E7] transition-colors hover:text-[#4E8098]"
            >
              Configure
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[600px]">
              <thead className="bg-white">
                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                  <th className="px-5 py-4 font-semibold">Event Target</th>
                  <th className="px-5 py-4 font-semibold">Your Commitment</th>
                  <th className="px-5 py-4 font-semibold">Est. Rank</th>
                  <th className="px-5 py-4 font-semibold">Reserve Floor</th>
                  <th className="px-5 py-4 font-semibold">Slot Avail.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {activeBids.map((entry) => (
                  <tr key={entry.eventType} className="group transition-colors hover:bg-[#FCF7F8]">
                    <td className="px-5 py-4">
                      <span className="font-semibold tracking-wide text-[#1a1a1a]">
                        {entry.eventType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[#4E8098]">{formatPKR(entry.bid)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold ${
                           entry.rank === 1 ? "bg-[#90C2E7] text-white" :
                           entry.rank === 2 ? "bg-[#CED3DC] text-[#1a1a1a]" :
                           "bg-[#FCF7F8] border border-[#CED3DC] text-[#4E8098]"
                        }`}>
                          {entry.rank}
                        </span>
                        {entry.trend === "up" && <TrendingUp className="w-3 h-3 text-[#90C2E7]" />}
                        {entry.trend === "down" && <TrendingUp className="w-3 h-3 text-[#A31621] rotate-180" />}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-[#4E8098]/80">{formatPKR(entry.reserve)}</td>
                    <td className="px-5 py-4 text-[#4E8098]/80 font-mono">{entry.slots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* Radar & Quick Actions */}
        <div className="flex flex-col gap-6">
          <article className="border border-[#CED3DC] bg-white">
            <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8]">
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase">Trigger Radar</h3>
              <p className="mt-1 text-[10px] text-[#4E8098]/80 uppercase tracking-widest">Upcoming simulation models</p>
            </div>

            <div className="p-5 space-y-4">
              {nextTriggers.map((trigger, idx) => (
                <div key={trigger.label} className="relative pl-4 border-l-2 border-[#CED3DC] group hover:border-[#90C2E7] transition-colors cursor-default">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-semibold text-[#1a1a1a]">{trigger.label}</p>
                      <span className="font-mono text-[10px] text-[#4E8098]">{trigger.eta}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] uppercase tracking-widest text-[#4E8098]/80">
                        {trigger.expectedSlots} slots
                      </p>
                      <div className={`w-1.5 h-1.5 ${
                        trigger.urgency === "high" ? "bg-[#A31621]" : 
                        trigger.urgency === "medium" ? "bg-[#90C2E7]" : 
                        "bg-[#CED3DC]"
                      }`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-3 flex-1">
            <Link
              href="/brand/live"
              className="group flex flex-col bg-[#A31621] p-5 transition-all hover:bg-[#8a121c] justify-between items-start h-24"
            >
              <Radio className="w-5 h-5 text-white/80" />
              <span className="text-xs font-bold tracking-widest text-white uppercase mt-auto">Enter Live Feed</span>
            </Link>
            <Link
              href="/brand/balance"
              className="group flex items-center justify-between bg-[#FCF7F8] border border-[#CED3DC] p-4 transition-all hover:bg-white"
            >
               <span className="text-xs font-semibold tracking-widest text-[#4E8098] uppercase">Manage Treasury</span>
               <ArrowRight className="w-4 h-4 text-[#4E8098] group-hover:text-[#1a1a1a] group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: string; accent: "blue" | "red" | "slate" | "neutral"; icon: React.ReactNode }) {
  const accentColors = {
    blue: "text-[#90C2E7]",
    red: "text-[#A31621]",
    slate: "text-[#4E8098]",
    neutral: "text-[#4E8098]/80",
  };

  return (
    <div className="border border-[#CED3DC] bg-white px-5 py-6 transition-colors hover:bg-[#FCF7F8] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">{label}</p>
        <div className={accentColors[accent]}>
          {icon}
        </div>
      </div>
      
      <p className="text-2xl font-semibold tracking-tight text-[#1a1a1a] font-mono break-words">
        {value}
      </p>
    </div>
  );
}
