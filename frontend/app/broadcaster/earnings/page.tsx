"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, ArrowUpRight, History, Download, TrendingUp } from "lucide-react";

import {
  BroadcasterApiError,
  getAuctionResults,
  getBroadcasterDashboard,
  listMatches,
  type AuctionResultGroup,
  type MatchRecord,
} from "@/lib/broadcasterApi";

type EarningRecord = {
  match: string;
  grossRevenue: number;
  platformFee: number;
  reservationYield: number;
  netSettle: number;
  status: "Settled" | "Pending";
};

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

type EarningsSummary = {
  totalGrossYield: number;
  reservationFees: number;
  platformTax: number;
};

type CompletedMatchEarnings = {
  match: MatchRecord;
  matchGrossPaisa: number;
  matchPlatformFeePaisa: number;
  matchBroadcasterSharePaisa: number;
};

function toMessage(error: unknown): string {
  if (error instanceof BroadcasterApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to load earnings.";
}

function toPaisa(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) {
    return 0;
  }

  const parsed = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function sumAuctionGroups(groups: AuctionResultGroup[]): number {
  return groups.reduce((total, group) => {
    const groupTotal = group.slots.reduce((sum, slot) => sum + toPaisa(slot.amount), 0);
    return total + groupTotal;
  }, 0);
}

function isMatchCompleted(match: MatchRecord): boolean {
  return match.state === 3;
}

export default function BroadcasterEarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [records, setRecords] = useState<EarningRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reservationFees = useMemo(() => summary?.reservationFees ?? 0, [summary]);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [dashboard, allMatches] = await Promise.all([getBroadcasterDashboard(), listMatches(3)]);
        const myCompletedMatches = allMatches
          .filter((match) => match.broadcaster === dashboard.broadcaster_name)
          .filter(isMatchCompleted);

        const grossPaisa = toPaisa(dashboard.total_auction_revenue);
        const earningsPaisa = toPaisa(dashboard.total_earnings);
        const platformTaxPaisa = Math.max(0, grossPaisa - earningsPaisa);

        const perMatchResults = await Promise.allSettled(
          myCompletedMatches.map(async (match): Promise<CompletedMatchEarnings> => {
            const results = await getAuctionResults(match.id);
            const matchGrossPaisa = sumAuctionGroups(results);
            const matchBroadcasterSharePaisa = Math.floor((matchGrossPaisa * 95) / 100);
            const matchPlatformFeePaisa = Math.max(0, matchGrossPaisa - matchBroadcasterSharePaisa);

            return {
              match,
              matchGrossPaisa,
              matchPlatformFeePaisa,
              matchBroadcasterSharePaisa,
            };
          }),
        );

        const nextRecords: EarningRecord[] = perMatchResults
          .filter((result): result is PromiseFulfilledResult<CompletedMatchEarnings> => result.status === "fulfilled")
          .map((result): EarningRecord => {
            const fixture = `${result.value.match.team_a} vs ${result.value.match.team_b}`;

            const reservationYield = 0;
            const grossRevenue = result.value.matchGrossPaisa / 100;
            const platformFee = result.value.matchPlatformFeePaisa / 100;
            const netSettle = result.value.matchBroadcasterSharePaisa / 100 + reservationYield;

            return {
              match: fixture,
              grossRevenue,
              reservationYield,
              platformFee,
              netSettle,
              status: "Settled",
            };
          })
          .sort((a, b) => b.grossRevenue - a.grossRevenue);

        if (isCancelled) {
          return;
        }

        setSummary({
          totalGrossYield: grossPaisa / 100,
          reservationFees: 0,
          platformTax: platformTaxPaisa / 100,
        });
        setRecords(nextRecords);
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }
        setError(toMessage(caughtError));
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col space-y-10 pb-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]">Treasury</p>
          </div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Earnings & Fees</h2>
          <p className="mt-2 text-sm text-[#4E8098] max-w-xl leading-relaxed">
            Track gross match revenues, platform fee deductions (5%), and aggregate yields from untriggered reservation fees.
          </p>

          {error ? (
            <div className="mt-4 bg-[#FCF7F8] border border-[#CED3DC] p-3 text-sm text-[#A31621]">{error}</div>
          ) : null}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3 px-0 sm:px-6">
        <div className="bg-white border border-[#CED3DC] p-5">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-[#4E8098]">Total Gross Yield</h3>
            <TrendingUp className="w-4 h-4 text-[#90C2E7]" />
          </div>
          <p className="text-3xl font-light text-[#1a1a1a]">{summary ? formatPKR(summary.totalGrossYield) : "—"}</p>
        </div>
        <div className="bg-[#FCF7F8] border border-[#CED3DC] p-5">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-[#4E8098]">Reservation Fees</h3>
            <ArrowUpRight className="w-4 h-4 text-[#4E8098]" />
          </div>
          <p className="text-3xl font-mono text-[#1a1a1a] text-xl">{summary ? formatPKR(reservationFees) : "—"}</p>
          <p className="text-[10px] uppercase tracking-widest text-[#4E8098] mt-2">Yield from un-triggered events</p>
        </div>
        <div className="bg-[#1a1a1a] text-white p-5 border border-[#1a1a1a]">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-white/60">Platform Tax</h3>
            <CircleDollarSign className="w-4 h-4 text-white/50" />
          </div>
          <p className="text-3xl font-mono text-white text-xl">{summary ? `- ${formatPKR(summary.platformTax)}` : "—"}</p>
          <p className="text-[10px] uppercase tracking-widest text-white/50 mt-2">Deducted Automatically at settlement</p>
        </div>
      </section>

      <section className="px-0 sm:px-6">
        <div className="border border-[#CED3DC] bg-white overflow-hidden">
          <div className="p-6 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[#4E8098]" />
              <h3 className="text-lg font-medium text-[#1a1a1a]">Match Ledgers</h3>
            </div>
            <button className="flex items-center justify-center gap-2 border border-[#CED3DC] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#4E8098] transition-all hover:bg-[#FCF7F8] hover:text-[#1a1a1a]">
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left align-middle min-w-[800px]">
              <thead className="bg-white">
                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                  <th className="px-6 py-4 font-semibold">Fixture</th>
                  <th className="px-6 py-4 font-semibold">Gross Rev</th>
                  <th className="px-6 py-4 font-semibold">Reservation Rev</th>
                  <th className="px-6 py-4 font-semibold">Platform Fee (5%)</th>
                  <th className="px-6 py-4 font-semibold">Net Result</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-6 text-[#4E8098]" colSpan={6}>
                      Loading earnings…
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-[#4E8098]" colSpan={6}>
                      No completed matches yet.
                    </td>
                  </tr>
                ) : (
                  records.map((r, i) => (
                    <tr key={`${r.match}-${i}`} className="hover:bg-[#FCF7F8] transition-colors group">
                      <td className="px-6 py-4 text-[#1a1a1a] font-medium">{r.match}</td>
                      <td className="px-6 py-4 font-mono text-[#4E8098]">{formatPKR(r.grossRevenue)}</td>
                      <td className="px-6 py-4 font-mono text-[#1a1a1a]">{formatPKR(r.reservationYield)}</td>
                      <td className="px-6 py-4 font-mono text-[#A31621]">- {formatPKR(r.platformFee)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-[#1a1a1a]">{formatPKR(r.netSettle)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest bg-[#4E8098]/10 text-[#4E8098] border border-[#4E8098]/20">{r.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}