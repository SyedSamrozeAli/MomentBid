"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, History as HistoryIcon, FileText, Download, Check, AlertCircle } from "lucide-react";
import {
  BrandApiError,
  claimRefund,
  getCurrentUserContext,
  listMatchBids,
  listMatches,
  listRefunds,
  type MatchRecord,
} from "@/lib/brandApi";

const WS_BASE_URL = (process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000").replace(/\/+$/, "");

type MatchHistory = {
  id: number;
  match: string;
  spend: number;
  refund: number;
  reservationFee: number;
  status: "Completed" | "Refund Pending";
  canClaimRefund: boolean;
};

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed);
}

function isTerminalMatch(match: MatchRecord): boolean {
  return match.state === 3 || match.state === 4;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<MatchHistory[]>([]);
  const [brandName, setBrandName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClaimingMatchId, setIsClaimingMatchId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError("");

    try {
      const [matches, userContext] = await Promise.all([listMatches(), getCurrentUserContext()]);
      const nextBrandName = userContext.org?.name ?? "";
      setBrandName(nextBrandName);
      const terminalMatches = matches.filter(isTerminalMatch);

      const historyRows = await Promise.all(
        terminalMatches.map(async (match): Promise<MatchHistory> => {
          const [refunds, bids] = await Promise.all([
            listRefunds(match.id),
            listMatchBids(match.id),
          ]);

          const refundAmount = refunds.reduce((sum, refund) => sum + parseAmount(refund.amount), 0);
          const spendAmount = bids
            .filter((bid) => bid.is_settled && (!nextBrandName || bid.brand === nextBrandName))
            .reduce((sum, bid) => sum + parseAmount(bid.amount), 0);

          return {
            id: match.id,
            match: `${match.team_a} vs ${match.team_b}`,
            spend: spendAmount,
            refund: refundAmount,
            reservationFee: 0,
            status: refundAmount > 0 ? "Completed" : "Refund Pending",
            canClaimRefund: refundAmount === 0,
          };
        }),
      );

      setRecords(historyRows);
    } catch (loadError) {
      const message =
        loadError instanceof BrandApiError
          ? loadError.message
          : "Unable to load settlement history right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!brandName) {
      return;
    }

    const matchIdsToWatch = records
      .filter((record) => record.canClaimRefund)
      .map((record) => record.id);

    if (matchIdsToWatch.length === 0) {
      return;
    }

    const sockets = matchIdsToWatch.map((matchId) => {
      const socket = new WebSocket(`${WS_BASE_URL}/ws/matches/${matchId}/`);

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as {
            event?: string;
            payload?: { brand?: string };
          };

          if (parsed.event !== "refund_processed") {
            return;
          }

          if (parsed.payload?.brand && parsed.payload.brand !== brandName) {
            return;
          }

          void listRefunds(matchId)
            .then((refunds) => {
              const refundAmount = refunds.reduce((sum, refund) => sum + parseAmount(refund.amount), 0);
              setRecords((previous) =>
                previous.map((record) =>
                  record.id === matchId
                    ? {
                        ...record,
                        refund: refundAmount,
                        status: refundAmount > 0 ? "Completed" : "Refund Pending",
                        canClaimRefund: refundAmount === 0,
                      }
                    : record,
                ),
              );
            })
            .catch(() => {
              // Ignore refresh errors; user can still manually refresh by navigating.
            });
        } catch {
          // Ignore malformed websocket messages and keep the socket open.
        }
      };

      return socket;
    });

    return () => {
      sockets.forEach((socket) => {
        socket.close();
      });
    };
  }, [brandName, records]);

  const handleClaimRefund = useCallback(
    async (matchId: number): Promise<void> => {
      if (isClaimingMatchId !== null) {
        return;
      }

      setIsClaimingMatchId(matchId);
      setError("");

      try {
        const refund = await claimRefund(matchId);
        const refundAmount = parseAmount(refund.amount);
        setRecords((previous) =>
          previous.map((record) =>
            record.id === matchId
              ? {
                  ...record,
                  refund: refundAmount,
                  status: refundAmount > 0 ? "Completed" : "Refund Pending",
                  canClaimRefund: refundAmount === 0,
                }
              : record,
          ),
        );
      } catch (claimError) {
        const message =
          claimError instanceof BrandApiError
            ? claimError.message
            : "Unable to claim refund right now.";
        setError(message);
      } finally {
        setIsClaimingMatchId(null);
      }
    },
    [isClaimingMatchId],
  );

  return (
    <div className="flex flex-col space-y-8">
      
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Archive className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]/80">Ledger Index</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Settlement History</h2>
          <p className="mt-1 text-sm text-[#4E8098] max-w-xl">
            Cryptographically sealed match settlement records. Review spend velocity, reclaim un-triggered bid capital, and export invoices.
          </p>
        </div>
      </header>

      {error ? (
        <div className="border border-[#A31621]/30 bg-[#FCF7F8] px-4 py-3 text-sm text-[#A31621]">
          {error}
        </div>
      ) : null}

      {/* Main Table */}
      <section>
        <div className="border border-[#CED3DC] bg-white overflow-hidden">
          <div className="p-6 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HistoryIcon className="w-5 h-5 text-[#4E8098]" />
              <h3 className="text-lg font-medium text-[#1a1a1a]">Historical Fixtures</h3>
            </div>
            <button className="flex items-center justify-center gap-2 border border-[#CED3DC] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#4E8098] transition-all hover:bg-[#FCF7F8] hover:text-[#1a1a1a]">
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#FCF7F8]">
                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                  <th className="px-6 py-4 font-semibold">Fixture</th>
                  <th className="px-6 py-4 font-semibold">Capital Deployed</th>
                  <th className="px-6 py-4 font-semibold">Escrow Refund</th>
                  <th className="px-6 py-4 font-semibold">Gas / Fees</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-sm text-[#4E8098]">
                      Loading history...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-sm text-[#4E8098]">
                      No completed or cancelled matches available yet.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                  <tr key={record.id} className="group transition-colors hover:bg-[#FCF7F8]">
                    <td className="px-6 py-5">
                      <span className="font-medium text-[#1a1a1a]">{record.match}</span>
                    </td>
                    <td className="px-6 py-5 font-mono text-[#1a1a1a]">{formatPKR(record.spend)}</td>
                    <td className="px-6 py-5 font-mono text-[#4E8098]">{formatPKR(record.refund)}</td>
                    <td className="px-6 py-5 font-mono text-[#4E8098]">{formatPKR(record.reservationFee)}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold ${
                          record.status === "Completed"
                            ? "bg-[#4E8098]/10 text-[#4E8098] border-[#4E8098]/20"
                            : "bg-[#A31621]/10 text-[#A31621] border-[#A31621]/20"
                        }`}
                      >
                        {record.status === "Completed" && <Check className="w-3 h-3" />}
                        {record.status === "Refund Pending" && <AlertCircle className="w-3 h-3" />}
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                      {record.canClaimRefund ? (
                        <button
                          type="button"
                          onClick={() => void handleClaimRefund(record.id)}
                          disabled={isClaimingMatchId !== null}
                          className="inline-flex items-center justify-center border border-[#A31621] bg-[#FCF7F8] px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#A31621] transition-all hover:bg-[#A31621]/10 hover:text-[#A31621]"
                        >
                          {isClaimingMatchId === record.id ? "Claiming..." : "Claim Refund"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center border border-[#CED3DC] bg-white px-4 py-2 transition-all hover:bg-[#FCF7F8] hover:text-[#1a1a1a]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#4E8098]" />
                        </button>
                      )}
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
