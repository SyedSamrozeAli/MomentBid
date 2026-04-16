"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Target, Radio, Activity, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BrandApiError,
  getAuctionResults,
  getCurrentUserContext,
  getMatchDetail,
  getMatchLeaderboard,
  increaseBid,
  listCreatives,
  placeBid,
  setBudgetCap,
  type AuctionResultGroup,
  type Creative,
  type LeaderboardGroup,
  type MatchDetail,
} from "@/lib/brandApi";

const WS_BASE_URL = (process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000").replace(/\/+$/, "");
const LEADERBOARD_POLL_INTERVAL_MS = 2500;

type MatchTab = "bidding" | "live";

type EventFormState = {
  bidAmount: string;
  additionalAmount: string;
  creativeId: string;
};

type MyBidMeta = {
  id: number;
  amount: number;
  rank: number;
};

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed);
}

function formatPKR(value: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeIdentityLabel(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function logBrandLive(
  level: "info" | "warn" | "error" | "debug",
  matchId: number,
  message: string,
  details?: unknown,
): void {
  const prefix = `[BrandLive][match:${Number.isFinite(matchId) ? matchId : "invalid"}] ${message}`;
  if (details === undefined) {
    console[level](prefix);
    return;
  }
  console[level](prefix, details);
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const matchId = Number.parseInt(String(params.id ?? ""), 10);

  const [activeTab, setActiveTab] = useState<MatchTab>("bidding");
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardGroup[]>([]);
  const [auctionResults, setAuctionResults] = useState<AuctionResultGroup[]>([]);
  const [approvedCreatives, setApprovedCreatives] = useState<Creative[]>([]);
  const [brandName, setBrandName] = useState("");
  const [eventForms, setEventForms] = useState<Record<number, EventFormState>>({});
  const [budgetCapInput, setBudgetCapInput] = useState("8000000");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [submittingEventType, setSubmittingEventType] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");

  const canBid = matchDetail?.state === 1;

  const myBidByEventType = useMemo(() => {
    const output = new Map<number, MyBidMeta>();

    const normalizedBrandName = normalizeIdentityLabel(brandName);
    if (!normalizedBrandName) {
      return output;
    }

    for (const group of leaderboard) {
      const bidIndex = group.bids.findIndex(
        (bid) => !bid.is_cancelled && normalizeIdentityLabel(bid.brand) === normalizedBrandName,
      );
      if (bidIndex === -1) {
        continue;
      }

      const myBid = group.bids[bidIndex];
      output.set(group.event_type, {
        id: myBid.id,
        amount: parseAmount(myBid.amount),
        rank: bidIndex + 1,
      });
    }

    return output;
  }, [brandName, leaderboard]);

  const activeEscrow = useMemo(() => {
    let total = 0;
    for (const bid of myBidByEventType.values()) {
      total += bid.amount;
    }
    return total;
  }, [myBidByEventType]);

  const parsedBudgetCap = parseAmount(budgetCapInput);
  const remainingBudget = Math.max(parsedBudgetCap - activeEscrow, 0);
  const budgetUtilization =
    parsedBudgetCap > 0 ? Math.min(Math.round((activeEscrow / parsedBudgetCap) * 100), 100) : 0;

  const sortedAuctionResults = useMemo(() => {
    return [...auctionResults].sort((left, right) => {
      if (left.trigger_number !== right.trigger_number) {
        return right.trigger_number - left.trigger_number;
      }

      return right.event_type - left.event_type;
    });
  }, [auctionResults]);

  const updateEventForm = useCallback(
    (eventType: number, patch: Partial<EventFormState>) => {
      setEventForms((previous) => {
        const fallbackCreativeId = approvedCreatives[0]?.id ? String(approvedCreatives[0].id) : "";
        const current = previous[eventType] ?? {
          bidAmount: "",
          additionalAmount: "",
          creativeId: fallbackCreativeId,
        };

        return {
          ...previous,
          [eventType]: {
            ...current,
            ...patch,
          },
        };
      });
    },
    [approvedCreatives],
  );

  const refreshLeaderboard = useCallback(async (source = "manual") => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    logBrandLive("debug", matchId, "refreshLeaderboard:start", { source });

    try {
      const nextLeaderboard = await getMatchLeaderboard(matchId);
      setLeaderboard(nextLeaderboard);
      logBrandLive("debug", matchId, "refreshLeaderboard:success", {
        source,
        eventGroups: nextLeaderboard.length,
        topEventType: nextLeaderboard[0]?.event_type ?? null,
      });
    } catch (error) {
      logBrandLive("error", matchId, "refreshLeaderboard:failed", { source, error });
      throw error;
    }
  }, [matchId]);

  const refreshMatchDetail = useCallback(async (source = "manual") => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    logBrandLive("debug", matchId, "refreshMatchDetail:start", { source });

    try {
      const detail = await getMatchDetail(matchId);
      setMatchDetail(detail);
      logBrandLive("debug", matchId, "refreshMatchDetail:success", {
        source,
        state: detail.state,
        stateLabel: detail.state_label,
      });
    } catch (error) {
      logBrandLive("error", matchId, "refreshMatchDetail:failed", { source, error });
      throw error;
    }
  }, [matchId]);

  const refreshAuctionResults = useCallback(async (source = "manual") => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    logBrandLive("debug", matchId, "refreshAuctionResults:start", { source });

    try {
      const results = await getAuctionResults(matchId);
      setAuctionResults(results);
      logBrandLive("debug", matchId, "refreshAuctionResults:success", {
        source,
        groups: results.length,
      });
    } catch (error) {
      logBrandLive("error", matchId, "refreshAuctionResults:failed", { source, error });
      throw error;
    }
  }, [matchId]);

  const loadMatchPage = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setPageError("Invalid match id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setPageError("");
    logBrandLive("info", matchId, "loadMatchPage:start");

    try {
      const [detail, board, results, allCreatives, userContext] = await Promise.all([
        getMatchDetail(matchId),
        getMatchLeaderboard(matchId),
        getAuctionResults(matchId),
        listCreatives({ status: "approved", ordering: "-created_at" }),
        getCurrentUserContext(),
      ]);

      setMatchDetail(detail);
      setLeaderboard(board);
      setAuctionResults(results);
      setApprovedCreatives(allCreatives);
      setBrandName(userContext.org?.name ?? userContext.user.username ?? "");
      logBrandLive("info", matchId, "loadMatchPage:success", {
        leaderboardEvents: board.length,
        auctionResults: results.length,
        approvedCreatives: allCreatives.length,
        brand: userContext.org?.name ?? userContext.user.username ?? "",
      });

      const defaultCreativeId = allCreatives[0]?.id ? String(allCreatives[0].id) : "";
      const nextForms: Record<number, EventFormState> = {};
      for (const config of detail.event_configs) {
        nextForms[config.event_type] = {
          bidAmount: "",
          additionalAmount: "",
          creativeId: defaultCreativeId,
        };
      }
      setEventForms(nextForms);
    } catch (error) {
      logBrandLive("error", matchId, "loadMatchPage:failed", { error });
      const message =
        error instanceof BrandApiError
          ? error.message
          : "Unable to load match data right now.";
      setPageError(message);
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void loadMatchPage();
  }, [loadMatchPage]);

  useEffect(() => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    const socket = new WebSocket(`${WS_BASE_URL}/ws/matches/${matchId}/`);

    socket.onopen = () => {
      logBrandLive("info", matchId, "websocket:open", { url: `${WS_BASE_URL}/ws/matches/${matchId}/` });
    };

    socket.onerror = (event) => {
      logBrandLive("warn", matchId, "websocket:error", event);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          type?: string;
          payload?: {
            event_type?: number;
            state?: number;
            trigger_number?: number;
          };
          data?: {
            event?: string;
            payload?: {
              event_type?: number;
              state?: number;
              trigger_number?: number;
            };
          };
        };

        const eventName =
          parsed.event ??
          parsed.type ??
          parsed.data?.event ??
          "";

        const payload = parsed.payload ?? parsed.data?.payload;
        const hasEventHint =
          typeof payload?.event_type === "number" ||
          typeof payload?.trigger_number === "number" ||
          typeof payload?.state === "number";

        if (!eventName && !hasEventHint) {
          logBrandLive("debug", matchId, "websocket:message-ignored", { raw: parsed });
          return;
        }

        logBrandLive("debug", matchId, "websocket:message", {
          eventName,
          payload,
        });

        const shouldRefreshResults =
          eventName === "auction_settled" ||
          typeof payload?.trigger_number === "number";

        const shouldRefreshMatch =
          eventName === "match_state_changed" ||
          typeof payload?.state === "number" ||
          eventName === "refund_processed";

        const refreshTasks: Array<Promise<void>> = [
          refreshLeaderboard("ws-message").catch((error) => {
            logBrandLive("warn", matchId, "websocket:leaderboard-refresh-failed", { error, eventName });
          }),
        ];

        if (shouldRefreshResults) {
          refreshTasks.push(
            refreshAuctionResults("ws-auction").catch((error) => {
              logBrandLive("warn", matchId, "websocket:auction-results-refresh-failed", { error, eventName });
            }),
          );
        }

        if (shouldRefreshMatch || refreshTasks.length === 0) {
          refreshTasks.push(
            refreshMatchDetail("ws-state").catch((error) => {
              logBrandLive("warn", matchId, "websocket:match-refresh-failed", { error, eventName });
            }),
          );
        }

        void Promise.all(refreshTasks);
      } catch {
        // Ignore malformed websocket messages and keep the socket open.
      }
    };

    return () => {
      logBrandLive("info", matchId, "websocket:close");
      socket.close();
    };
  }, [matchId, refreshAuctionResults, refreshLeaderboard, refreshMatchDetail]);

  useEffect(() => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    const isPollEligible = matchDetail?.state === 1 || matchDetail?.state === 2;
    if (!isPollEligible) {
      return;
    }

    logBrandLive("info", matchId, "poller:start", {
      intervalMs: LEADERBOARD_POLL_INTERVAL_MS,
      state: matchDetail?.state,
      stateLabel: matchDetail?.state_label,
    });

    const timerId = window.setInterval(() => {
      logBrandLive("debug", matchId, "poller:tick");
      void refreshLeaderboard("poll").catch((error) => {
        logBrandLive("warn", matchId, "poller:leaderboard-refresh-failed", { error });
      });
    }, LEADERBOARD_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
      logBrandLive("info", matchId, "poller:stop");
    };
  }, [matchDetail?.state, matchDetail?.state_label, matchId, refreshLeaderboard]);

  const handleBidAction = useCallback(
    async (eventType: number): Promise<void> => {
      if (!Number.isFinite(matchId)) {
        return;
      }

      if (!canBid) {
        setPageError("Bids can only be placed while the match is OPEN.");
        return;
      }

      const myBid = myBidByEventType.get(eventType);
      const form = eventForms[eventType];
      if (!form) {
        return;
      }

      setSubmittingEventType(eventType);
      setPageError("");

      try {
        logBrandLive("info", matchId, "bidAction:start", {
          eventType,
          action: myBid ? "increase_bid" : "place_bid",
          additionalAmount: form.additionalAmount,
          bidAmount: form.bidAmount,
          myBidId: myBid?.id ?? null,
        });

        if (myBid) {
          if (!form.additionalAmount.trim()) {
            throw new BrandApiError("Additional amount is required.", 400);
          }

          await increaseBid(matchId, myBid.id, form.additionalAmount.trim());
          updateEventForm(eventType, { additionalAmount: "" });
        } else {
          if (!form.bidAmount.trim()) {
            throw new BrandApiError("Bid amount is required.", 400);
          }

          if (!form.creativeId) {
            throw new BrandApiError("Select an approved creative before placing a bid.", 400);
          }

          await placeBid(matchId, {
            event_type: eventType,
            amount: form.bidAmount.trim(),
            creative_id: Number.parseInt(form.creativeId, 10),
          });

          updateEventForm(eventType, { bidAmount: "" });
        }

        await Promise.all([
          refreshLeaderboard("bid-action-success"),
          refreshMatchDetail("bid-action-success"),
        ]);

        logBrandLive("info", matchId, "bidAction:success", {
          eventType,
          action: myBid ? "increase_bid" : "place_bid",
        });
      } catch (error) {
        logBrandLive("error", matchId, "bidAction:failed", { eventType, error });
        const message =
          error instanceof BrandApiError
            ? error.message
            : "Unable to submit bid update right now.";
        setPageError(message);
      } finally {
        setSubmittingEventType(null);
      }
    },
    [canBid, eventForms, matchId, myBidByEventType, refreshLeaderboard, refreshMatchDetail, updateEventForm],
  );

  const handleBudgetCapUpdate = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    if (!budgetCapInput.trim()) {
      setPageError("Budget cap is required.");
      return;
    }

    setIsSubmittingBudget(true);
    setPageError("");

    try {
      const response = await setBudgetCap(matchId, budgetCapInput.trim());
      setBudgetCapInput(response.cap);
      await refreshMatchDetail();
    } catch (error) {
      const message =
        error instanceof BrandApiError
          ? error.message
          : "Unable to update budget cap right now.";
      setPageError(message);
    } finally {
      setIsSubmittingBudget(false);
    }
  }, [budgetCapInput, matchId, refreshMatchDetail]);

  if (!Number.isFinite(matchId)) {
    return <div className="text-sm text-[#A31621]">Invalid match id.</div>;
  }

  if (isLoading) {
    return <div className="text-sm text-[#4E8098]">Loading match data...</div>;
  }

  if (!matchDetail) {
    return <div className="text-sm text-[#A31621]">Unable to load match details.</div>;
  }

  return (
    <div className="flex flex-col space-y-8 pb-20">
      <div className="flex flex-col gap-4 border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/brand/matches"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#4E8098] hover:text-[#A31621] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  matchDetail.state === 2 ? "bg-[#A31621]/10 text-[#A31621]" : "bg-[#CED3DC] text-[#1a1a1a]"
                }`}
              >
                {matchDetail.state_label}
              </span>
              <span className="text-[10px] font-mono text-[#4E8098] uppercase">
                {matchDetail.state === 2 ? "LIVE" : "SCHEDULED"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-2xl md:text-4xl font-medium tracking-tight text-[#1a1a1a] mt-2">
            {matchDetail.team_a} <span className="text-[#4E8098] mx-2 text-lg">vs</span> {matchDetail.team_b}
          </h1>
          <p className="mt-2 text-sm text-[#4E8098] flex items-center justify-start gap-4">
            <span>{matchDetail.match_date}</span>
            <span className="w-1 h-1 rounded-full bg-[#CED3DC]" />
            <span>{matchDetail.venue}</span>
            <span className="w-1 h-1 rounded-full bg-[#CED3DC]" />
            <span>Host: {matchDetail.broadcaster}</span>
          </p>
        </div>
      </div>

      {pageError ? (
        <div className="mx-0 sm:mx-6 border border-[#A31621]/30 bg-[#FCF7F8] px-4 py-3 text-sm text-[#A31621]">
          {pageError}
        </div>
      ) : null}

      <div className="px-0 sm:px-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="border-b border-[#CED3DC] flex items-center gap-6">
              <button
                onClick={() => setActiveTab("bidding")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors ${
                  activeTab === "bidding"
                    ? "border-b-2 border-[#A31621] text-[#A31621]"
                    : "text-[#4E8098]/80 hover:text-[#1a1a1a]"
                }`}
              >
                Event Bidding
              </button>
              <button
                onClick={() => setActiveTab("live")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${
                  activeTab === "live"
                    ? "border-b-2 border-[#A31621] text-[#A31621]"
                    : "text-[#4E8098]/80 hover:text-[#1a1a1a]"
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${activeTab === "live" ? "animate-pulse" : ""}`} />
                Live Results
              </button>
            </div>

            {activeTab === "bidding" ? (
              <div className="space-y-4">
                {matchDetail.event_configs.map((config) => {
                  const form = eventForms[config.event_type] ?? {
                    bidAmount: "",
                    additionalAmount: "",
                    creativeId: approvedCreatives[0]?.id ? String(approvedCreatives[0].id) : "",
                  };
                  const myBid = myBidByEventType.get(config.event_type);
                  const statusText = myBid ? (myBid.rank === 1 ? "Leading" : "Outbid") : "No Bid";
                  const isSubmitting = submittingEventType === config.event_type;

                  return (
                    <div key={config.id} className="bg-white border border-[#CED3DC] p-5">
                      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center border-b border-[#CED3DC]/50 pb-4 mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-[#1a1a1a]">{config.event_type_label}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-[#4E8098] font-mono">
                            <span>Reserve: {formatPKR(parseAmount(config.reserve_price))}</span>
                            <span>Slots: {config.slot_count}</span>
                            <span>Fee: {config.reservation_fee_pct}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              statusText === "Leading"
                                ? "bg-[#90C2E7]/20 text-[#1a1a1a]"
                                : statusText === "Outbid"
                                  ? "bg-[#A31621]/10 text-[#A31621]"
                                  : "bg-[#FCF7F8] border border-[#CED3DC] text-[#4E8098]"
                            }`}
                          >
                            {statusText}
                          </span>
                          {myBid ? (
                            <span className="text-xs font-semibold text-[#1a1a1a] bg-[#FCF7F8] px-2 py-1 border border-[#CED3DC]">
                              Rank #{myBid.rank}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 w-full grid gap-3">
                          {myBid ? (
                            <>
                              <label className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">
                                Additional Bid Amount (PKR)
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={form.additionalAmount}
                                onChange={(event) =>
                                  updateEventForm(config.event_type, { additionalAmount: event.target.value })
                                }
                                placeholder="Enter additional amount"
                                className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-4 py-2.5 text-sm font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                                disabled={!canBid || isSubmitting}
                              />
                            </>
                          ) : (
                            <>
                              <label className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">
                                Bid Amount (PKR)
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={form.bidAmount}
                                onChange={(event) => updateEventForm(config.event_type, { bidAmount: event.target.value })}
                                placeholder={`Min ${parseAmount(config.reserve_price).toLocaleString("en-PK")}`}
                                className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-4 py-2.5 text-sm font-mono text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                                disabled={!canBid || isSubmitting}
                              />

                              <label className="text-[10px] uppercase tracking-widest font-semibold text-[#4E8098]">
                                Approved Creative
                              </label>
                              <select
                                value={form.creativeId}
                                onChange={(event) => updateEventForm(config.event_type, { creativeId: event.target.value })}
                                className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-4 py-2.5 text-sm text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
                                disabled={!canBid || isSubmitting || approvedCreatives.length === 0}
                              >
                                {approvedCreatives.length === 0 ? (
                                  <option value="">No approved creatives</option>
                                ) : (
                                  approvedCreatives.map((creative) => (
                                    <option key={creative.id} value={creative.id}>
                                      {creative.title}
                                    </option>
                                  ))
                                )}
                              </select>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleBidAction(config.event_type)}
                          disabled={isSubmitting || !canBid || (!myBid && approvedCreatives.length === 0)}
                          className="w-full sm:w-auto bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-50 text-white px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap"
                        >
                          {isSubmitting ? "Submitting..." : myBid ? "Increase Bid" : "Place Bid"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#FCF7F8] p-4 border border-[#CED3DC] flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#A31621] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">
                      Network Oracle Sync Active
                    </span>
                  </div>
                  <Activity className="w-4 h-4 text-[#A31621]" />
                </div>

                <div className="bg-white border border-[#CED3DC] overflow-hidden">
                  <div className="bg-[#FCF7F8] border-b border-[#CED3DC] p-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a]">Live Leaderboard</h3>
                    <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">
                      {leaderboard.length} EVENTS
                    </span>
                  </div>

                  {leaderboard.length === 0 ? (
                    <div className="p-5 text-sm text-[#4E8098]">No active bids yet.</div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {leaderboard.map((group) => (
                        <div key={group.event_type} className="border border-[#CED3DC] overflow-hidden">
                          <div className="bg-white border-b border-[#CED3DC] p-4 flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
                              {group.event_type_label}
                            </h4>
                            <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">
                              TOTAL {formatPKR(group.total_escrowed)}
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] text-left text-xs">
                              <thead className="bg-[#FCF7F8]">
                                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                                  <th className="px-4 py-3 font-semibold">Rank</th>
                                  <th className="px-4 py-3 font-semibold">Brand</th>
                                  <th className="px-4 py-3 font-semibold">Amount</th>
                                  <th className="px-4 py-3 font-semibold">Status</th>
                                  <th className="px-4 py-3 font-semibold">Placed</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#CED3DC]/50">
                                {group.bids.map((bid, index) => {
                                  const isMyBid =
                                    normalizeIdentityLabel(bid.brand) ===
                                    normalizeIdentityLabel(brandName);
                                  return (
                                    <tr key={bid.id} className={isMyBid ? "bg-[#FCF7F8]" : "hover:bg-[#FCF7F8]"}>
                                      <td className="px-4 py-3 font-mono text-[#4E8098]">#{index + 1}</td>
                                      <td className="px-4 py-3 text-[#1a1a1a] font-semibold">
                                        {bid.brand}
                                        {isMyBid ? (
                                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-[#A31621]/10 text-[#A31621] border border-[#A31621]/20">
                                            You
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="px-4 py-3 font-mono text-[#A31621] font-semibold">
                                        {formatPKR(parseAmount(bid.amount))}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                            bid.is_cancelled
                                              ? "bg-[#FCF7F8] border-[#CED3DC] text-[#4E8098]"
                                              : bid.is_settled
                                                ? "bg-[#FCF7F8] border-[#CED3DC] text-[#4E8098]"
                                                : "bg-[#90C2E7]/20 border-[#90C2E7]/50 text-[#1a1a1a]"
                                          }`}
                                        >
                                          {bid.is_cancelled ? "Cancelled" : bid.is_settled ? "Settled" : "Active"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-[#4E8098]">{bid.created_at}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#CED3DC] overflow-hidden">
                  <div className="bg-[#FCF7F8] border-b border-[#CED3DC] p-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a]">Auction Settlements</h3>
                    <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">
                      {sortedAuctionResults.length} TOTAL
                    </span>
                  </div>

                  {sortedAuctionResults.length === 0 ? (
                    <div className="p-5 text-sm text-[#4E8098]">No auction settlements yet.</div>
                  ) : (
                    <div className="p-5 space-y-4">
                      {sortedAuctionResults.map((result) => (
                        <div key={`${result.event_type}-${result.trigger_number}`} className="border border-[#CED3DC] p-5">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">
                              {result.event_type_label}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#FCF7F8] border border-[#CED3DC] text-[#4E8098]">
                              Trigger #{result.trigger_number}
                            </span>
                          </div>

                          <div className="space-y-2 mt-4 ml-6 pl-4 border-l-2 border-[#CED3DC]">
                            {result.slots.map((slot) => (
                              <div key={slot.id} className="flex font-mono text-xs text-[#1a1a1a]">
                                <span className="text-[#4E8098] w-14 shrink-0">Slot {slot.slot_position}</span>
                                <span
                                  className={
                                    normalizeIdentityLabel(slot.winner) === normalizeIdentityLabel(brandName)
                                      ? "font-bold text-[#A31621]"
                                      : ""
                                  }
                                >
                                  {slot.winner} - {formatPKR(parseAmount(slot.amount))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-[#CED3DC] p-5 sticky top-6">
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-[#4E8098]" />
                Match Budget
              </h3>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-mono text-[#4E8098]">
                    <span>Total Cap</span>
                    <span>{formatPKR(parsedBudgetCap)}</span>
                  </div>
                  <input
                    type="number"
                    value={budgetCapInput}
                    onChange={(event) => setBudgetCapInput(event.target.value)}
                    className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-sm font-mono text-[#1a1a1a]"
                    disabled={isSubmittingBudget}
                  />
                  <button
                    type="button"
                    onClick={() => void handleBudgetCapUpdate()}
                    disabled={isSubmittingBudget}
                    className="w-full mt-2 bg-[#FCF7F8] border border-[#CED3DC] hover:bg-[#CED3DC]/30 text-[#1a1a1a] py-2 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    {isSubmittingBudget ? "Updating..." : "Update Cap"}
                  </button>
                </div>

                <div className="h-px bg-[#CED3DC] w-full" />

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Active Escrow</span>
                    <span className="font-mono text-[#1a1a1a] font-semibold">{formatPKR(activeEscrow)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Remaining</span>
                    <span className="font-mono text-[#4E8098]">{formatPKR(remainingBudget)}</span>
                  </div>

                  <div className="w-full h-2 bg-[#FCF7F8] border border-[#CED3DC] relative mt-2">
                    <div className="absolute top-0 left-0 h-full bg-[#90C2E7]" style={{ width: `${budgetUtilization}%` }} />
                  </div>
                  <p className="text-[10px] text-[#4E8098]/80 text-right mt-1">{budgetUtilization}% utilized</p>
                </div>
              </div>
            </div>

            <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex gap-3 text-xs text-[#4E8098] leading-relaxed">
              <HelpCircle className="w-4 h-4 shrink-0 text-[#90C2E7]" />
              <p>
                Your escrowed amount is temporarily locked while the auction is active. Unused funds are
                refunded upon match completion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
