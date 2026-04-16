"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, Filter, Radio, XCircle } from "lucide-react";
import {
  BrandApiError,
  listMyBidHistory,
  type BidHistoryStatus,
  type BrandBidHistoryRecord,
} from "@/lib/brandApi";

const statusOptions: Array<{ value: BidHistoryStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "settled", label: "Settled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatPKR(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMatchSchedule(matchDate: string, matchTime: string): string {
  const parsedDate = new Date(`${matchDate}T${matchTime}`);
  if (Number.isNaN(parsedDate.getTime())) {
    return `${matchDate} ${matchTime}`;
  }

  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortenHash(hash: string): string {
  if (!hash) {
    return "-";
  }

  if (hash.length <= 14) {
    return hash;
  }

  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function resolveBidStatusLabel(bid: BrandBidHistoryRecord): "Active" | "Settled" | "Cancelled" {
  if (bid.bid_status === "cancelled" || bid.is_cancelled) {
    return "Cancelled";
  }

  if (bid.bid_status === "settled" || bid.is_settled) {
    return "Settled";
  }

  return "Active";
}

export default function MyBidsPage() {
  const [statusFilter, setStatusFilter] = useState<BidHistoryStatus>("active");
  const [records, setRecords] = useState<BrandBidHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMyBids(): Promise<void> {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await listMyBidHistory(statusFilter);
        if (!isMounted) {
          return;
        }

        setRecords(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof BrandApiError ? error.message : "Unable to load bid history right now.";
        setLoadError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMyBids();

    return () => {
      isMounted = false;
    };
  }, [statusFilter]);

  const totalCommitted = useMemo(() => {
    return records.reduce((sum, record) => sum + parseAmount(record.amount), 0);
  }, [records]);

  const statusSummary = useMemo(() => {
    return records.reduce(
      (summary, record) => {
        const status = resolveBidStatusLabel(record);
        if (status === "Active") {
          return { ...summary, active: summary.active + 1 };
        }

        if (status === "Settled") {
          return { ...summary, settled: summary.settled + 1 };
        }

        return { ...summary, cancelled: summary.cancelled + 1 };
      },
      { active: 0, settled: 0, cancelled: 0 },
    );
  }, [records]);

  return (
    <div className="flex flex-col space-y-8">
      <header className="flex flex-col gap-4 border-b border-[#CED3DC] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Radio className="h-4 w-4 text-[#A31621]" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A31621]/80">Bid Command</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">My Bids</h2>
          <p className="mt-1 max-w-xl text-sm text-[#4E8098]">
            Monitor active exposure, settled outcomes, and cancelled positions from a single ledger-backed view.
          </p>
        </div>

        <div className="border border-[#CED3DC] bg-white px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098]">Committed Capital</p>
          <p className="mt-1 font-mono text-lg font-semibold text-[#1a1a1a]">{formatPKR(totalCommitted)}</p>
        </div>
      </header>

      {loadError ? (
        <div className="border border-[#A31621]/30 bg-[#FCF7F8] px-4 py-3 text-sm text-[#A31621]">
          {loadError}
        </div>
      ) : null}

      <section className="border border-[#CED3DC] bg-white p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#4E8098]" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098]">Filter Bid Status</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusOptions.map((statusOption) => (
              <button
                key={statusOption.value}
                type="button"
                onClick={() => setStatusFilter(statusOption.value)}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  statusFilter === statusOption.value
                    ? "bg-[#1a1a1a] text-white"
                    : "border border-[#CED3DC] bg-[#FCF7F8] text-[#4E8098] hover:bg-white hover:text-[#1a1a1a]"
                }`}
              >
                {statusOption.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border border-[#CED3DC] bg-white px-4 py-4">
          <div className="mb-2 flex items-center gap-2 text-[#4E8098]">
            <Activity className="h-4 w-4" />
            <p className="text-[10px] font-semibold uppercase tracking-widest">Active</p>
          </div>
          <p className="font-mono text-2xl font-semibold text-[#1a1a1a]">{statusSummary.active}</p>
        </div>
        <div className="border border-[#CED3DC] bg-white px-4 py-4">
          <div className="mb-2 flex items-center gap-2 text-[#4E8098]">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-[10px] font-semibold uppercase tracking-widest">Settled</p>
          </div>
          <p className="font-mono text-2xl font-semibold text-[#1a1a1a]">{statusSummary.settled}</p>
        </div>
        <div className="border border-[#CED3DC] bg-white px-4 py-4">
          <div className="mb-2 flex items-center gap-2 text-[#A31621]">
            <XCircle className="h-4 w-4" />
            <p className="text-[10px] font-semibold uppercase tracking-widest">Cancelled</p>
          </div>
          <p className="font-mono text-2xl font-semibold text-[#1a1a1a]">{statusSummary.cancelled}</p>
        </div>
      </section>

      <section>
        <div className="overflow-hidden border border-[#CED3DC] bg-white">
          <div className="flex items-center justify-between border-b border-[#CED3DC] bg-[#FCF7F8] p-6">
            <div>
              <h3 className="text-lg font-medium text-[#1a1a1a]">Bid Ledger</h3>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-[#4E8098]">
                Showing {statusFilter} bids
              </p>
            </div>
            <Clock3 className="h-5 w-5 text-[#4E8098]" />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-[#FCF7F8]">
                <tr className="border-b border-[#CED3DC] text-[10px] font-semibold uppercase tracking-widest text-[#4E8098]">
                  <th className="px-6 py-4">Fixture</th>
                  <th className="px-6 py-4">Event Type</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Creative</th>
                  <th className="px-6 py-4">Match State</th>
                  <th className="px-6 py-4">Bid State</th>
                  <th className="px-6 py-4">Placed</th>
                  <th className="px-6 py-4">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-6 text-sm text-[#4E8098]">
                      Loading bid history...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-sm text-[#4E8098]">
                      No bids found for this status.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const bidStatusLabel = resolveBidStatusLabel(record);
                    return (
                      <tr key={record.id} className="transition-colors hover:bg-[#FCF7F8]">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-medium text-[#1a1a1a]">{record.match_title}</span>
                            <span className="mt-1 text-[11px] text-[#4E8098]">
                              {formatMatchSchedule(record.match_date, record.match_time)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-[#1a1a1a]">{record.event_type_label}</td>
                        <td className="px-6 py-5 font-mono text-[#1a1a1a]">{formatPKR(parseAmount(record.amount))}</td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-[#1a1a1a]">{record.creative_title}</span>
                            {record.creative_ad_url ? (
                              <a
                                href={record.creative_ad_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#4E8098] hover:text-[#1a1a1a]"
                              >
                                Preview
                              </a>
                            ) : (
                              <span className="mt-1 text-[11px] text-[#4E8098]">No media link</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center border border-[#CED3DC] bg-[#FCF7F8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#4E8098]">
                            {record.match_state_label}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${
                              bidStatusLabel === "Settled"
                                ? "border-[#4E8098]/20 bg-[#4E8098]/10 text-[#4E8098]"
                                : bidStatusLabel === "Cancelled"
                                  ? "border-[#A31621]/20 bg-[#A31621]/10 text-[#A31621]"
                                  : "border-[#90C2E7]/30 bg-[#90C2E7]/15 text-[#1a1a1a]"
                            }`}
                          >
                            {bidStatusLabel === "Settled" ? <CheckCircle2 className="h-3 w-3" /> : null}
                            {bidStatusLabel === "Cancelled" ? <XCircle className="h-3 w-3" /> : null}
                            {bidStatusLabel === "Active" ? <AlertCircle className="h-3 w-3" /> : null}
                            {bidStatusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-[12px] text-[#4E8098]">{formatDateTime(record.created_at)}</td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1 font-mono text-[11px] text-[#4E8098]">
                            <span>Bid: {shortenHash(record.tx_hash)}</span>
                            {record.cancel_tx_hash ? <span>Cancel: {shortenHash(record.cancel_tx_hash)}</span> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}