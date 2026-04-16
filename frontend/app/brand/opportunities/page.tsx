import { Target, TrendingUp, AlertCircle, Info, ChevronRight } from "lucide-react";

type Opportunity = {
  eventType: string;
  reservePrice: number;
  slots: number;
  maxTriggers: number;
  yourBid: number;
  status: "Leading" | "Outbid" | "Not Bidding";
};

const opportunities: Opportunity[] = [
  {
    eventType: "OVER_BREAK",
    reservePrice: 100000,
    slots: 3,
    maxTriggers: 40,
    yourBid: 400000,
    status: "Leading",
  },
  {
    eventType: "STRATEGIC_TIMEOUT",
    reservePrice: 300000,
    slots: 5,
    maxTriggers: 4,
    yourBid: 500000,
    status: "Outbid",
  },
  {
    eventType: "INNINGS_BREAK",
    reservePrice: 800000,
    slots: 12,
    maxTriggers: 1,
    yourBid: 0,
    status: "Not Bidding",
  },
  {
    eventType: "WICKET_FALL",
    reservePrice: 150000,
    slots: 2,
    maxTriggers: 20,
    yourBid: 250000,
    status: "Outbid",
  },
  {
    eventType: "LAST_OVER_THRILLER",
    reservePrice: 700000,
    slots: 3,
    maxTriggers: 1,
    yourBid: 1500000,
    status: "Leading",
  },
  {
    eventType: "SUPER_OVER",
    reservePrice: 1200000,
    slots: 8,
    maxTriggers: 1,
    yourBid: 0,
    status: "Not Bidding",
  },
];

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OpportunitiesPage() {
  return (
    <div className="flex flex-col space-y-8">
      
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]/80">Market Discovery</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Bidding Action Matrix</h2>
          <p className="mt-1 text-sm text-[#4E8098] max-w-xl">
            Secure inventory instantly across verified event triggers. Outbid competitors in an open environment and track expected delivery.
          </p>
        </div>
        
        <div className="group border border-[#A31621] bg-[#FCF7F8] px-5 py-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-[#A31621]" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#A31621] font-semibold">Warning</p>
            <p className="text-sm font-medium text-[#1a1a1a]">
              Competitor active in 2 slots
            </p>
          </div>
        </div>
      </header>

      {/* Main Table */}
      <section>
        <div className="border border-[#CED3DC] bg-white overflow-hidden">
          <div className="p-6 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
            <h3 className="text-lg font-medium text-[#1a1a1a]">Live Contracts</h3>
            <div className="text-xs flex items-center gap-2 text-[#4E8098]">
              <Info className="w-4 h-4" />
              <span>Select action to escalate bid</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-[#FCF7F8]">
                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                  <th className="px-6 py-4 font-semibold">Event Vector</th>
                  <th className="px-6 py-4 font-semibold">Reserve Floor</th>
                  <th className="px-6 py-4 font-semibold">Depth (Slots)</th>
                  <th className="px-6 py-4 font-semibold">Max Impact</th>
                  <th className="px-6 py-4 font-semibold">Your Stake</th>
                  <th className="px-6 py-4 font-semibold">Stance</th>
                  <th className="px-6 py-4 font-semibold text-right">Escalate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {opportunities.map((event) => (
                  <tr key={event.eventType} className="group transition-colors hover:bg-[#FCF7F8]">
                    <td className="px-6 py-5">
                      <span className="font-medium text-[#1a1a1a]">{event.eventType.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-6 py-5 font-mono text-[#4E8098]">{formatPKR(event.reservePrice)}</td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center justify-center w-6 h-6 border border-[#CED3DC] bg-[#FCF7F8] text-xs font-medium text-[#1a1a1a]">
                        {event.slots}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[#4E8098] tracking-widest">{event.maxTriggers}x</span>
                    </td>
                    <td className="px-6 py-5 font-mono">
                      {event.yourBid > 0 ? (
                        <span className="text-[#90C2E7]">{formatPKR(event.yourBid)}</span>
                      ) : (
                        <span className="text-[#CED3DC]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold border ${
                          event.status === "Leading"
                            ? "bg-[#4E8098]/10 text-[#4E8098] border-[#4E8098]/20"
                            : event.status === "Outbid"
                              ? "bg-[#A31621]/10 text-[#A31621] border-[#A31621]/20"
                              : "bg-[#FCF7F8] text-[#4E8098] border-[#CED3DC]"
                        }`}
                      >
                        {event.status === "Leading" && <TrendingUp className="w-3 h-3" />}
                        {event.status === "Outbid" && <TrendingUp className="w-3 h-3 rotate-180" />}
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center border border-[#CED3DC] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#4E8098] transition-all hover:bg-[#FCF7F8] hover:text-[#1a1a1a]"
                      >
                        Increase
                        <ChevronRight className="w-3 h-3 ml-1 text-[#4E8098]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
