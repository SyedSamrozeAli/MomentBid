import { Radio, Activity, CheckCircle2, Circle } from "lucide-react";

const liveState = {
  match: "Karachi Kings vs Lahore Qalandars",
  score: "112/4",
  overs: "12.3",
  requiredRunRate: "11.6",
  status: "ACTIVE",
};

const feed = [
  {
    timestamp: "18:51:27",
    eventType: "STRATEGIC_TIMEOUT",
    outcome: "Pending Trigger",
    slots: ["Awaiting Oracle Signature..."],
    status: "pending"
  },
  {
    timestamp: "18:44:03",
    eventType: "WICKET_FALL",
    outcome: "Full Fill 2/2",
    slots: [
      "Slot 1: Brand C - PKR 280,000",
      "Slot 2: kababjees - PKR 250,000",
    ],
    status: "settled"
  },
  {
    timestamp: "18:40:12",
    eventType: "OVER_BREAK",
    outcome: "PartialFill 2/3",
    slots: [
      "Slot 1: Brand B - PKR 350,000",
      "Slot 2: kababjees - PKR 300,000",
      "Slot 3: House Ad",
    ],
    status: "settled"
  },
];

export default function LivePage() {
  return (
    <div className="flex flex-col space-y-8">
      
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-4 h-4 text-[#A31621] animate-pulse" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]/80">Real-Time Trigger Feed</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Live Broadcast Network</h2>
          <p className="mt-1 text-sm text-[#4E8098] max-w-xl">
            Streaming active match state and auction resolutions. Watch the contract finalize your bids as live broadcast events occur.
          </p>
        </div>
      </header>

      {/* Match Telemetry */}
      <section className="grid gap-4 md:grid-cols-5">
        <div className="border border-[#CED3DC] bg-white p-6 md:col-span-2 overflow-hidden flex flex-col justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#FCF7F8] via-white to-transparent" />
          <p className="text-[10px] uppercase tracking-widest text-[#4E8098] mb-1 z-10 relative font-semibold">Synchronized Fixture</p>
          <p className="text-xl font-medium text-[#1a1a1a] z-10 relative">{liveState.match}</p>
          <div className="mt-4 flex items-center gap-2 z-10 relative">
            <span className="w-2 h-2 bg-[#A31621] animate-ping" />
            <span className="text-[10px] uppercase tracking-widest text-[#A31621] border border-[#A31621]/20 bg-[#FCF7F8] px-2 py-0.5">
              {liveState.status}
            </span>
          </div>
        </div>
        
        <MetricCard label="Current Score" value={liveState.score} />
        <MetricCard label="Overs Bowled" value={liveState.overs} />
        <MetricCard label="Required RR" value={liveState.requiredRunRate} />
      </section>

      {/* Trigger Stream */}
      <section>
        <div className="flex items-center gap-3 mb-6 px-1">
          <Activity className="w-5 h-5 text-[#4E8098]" />
          <h3 className="text-lg font-medium text-[#1a1a1a]">Execution Log</h3>
        </div>

        <div className="relative pl-6 space-y-6">
          {/* Vertical stream line */}
          <div className="absolute top-4 bottom-4 left-[11px] w-px bg-[#CED3DC]" />

          {feed.map((entry, idx) => (
            <article key={`${entry.timestamp}-${entry.eventType}`} className="relative">
              {/* Node dot */}
              <div className="absolute top-6 -left-[27px] bg-white p-1">
                {entry.status === 'pending' ? (
                  <Circle className="w-4 h-4 text-[#A31621] animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#4E8098]" />
                )}
              </div>

              <div className={`border border-[#CED3DC] bg-white p-6 transition-colors hover:bg-[#FCF7F8] ${
                entry.status === 'pending' ? 'bg-[#FCF7F8] border-[#A31621]/20' : ''
              }`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 mt-2">
                  <h3 className="text-lg font-medium text-[#1a1a1a]">{entry.eventType.replace(/_/g, " ")}</h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#4E8098] bg-[#FCF7F8] px-2 py-1 border border-[#CED3DC]">
                    {entry.timestamp}
                  </p>
                </div>
                
                <p className={`text-sm mb-5 font-semibold ${entry.status === 'pending' ? 'text-[#A31621] animate-pulse' : 'text-[#90C2E7]'}`}>
                  {entry.outcome}
                </p>
                
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {entry.slots.map((slot, i) => (
                    <li key={i} className={`border px-4 py-3 text-sm font-medium ${
                      slot.includes('kababjees') ? 'text-[#1a1a1a] border-[#90C2E7] bg-[#FCF7F8]' : 'text-[#4E8098] border-[#CED3DC] bg-white'
                    }`}>
                      {slot}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#CED3DC] bg-white p-6 flex flex-col justify-center transition-colors hover:bg-[#FCF7F8]">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#1a1a1a] font-mono tracking-tight">{value}</p>
    </div>
  );
}
