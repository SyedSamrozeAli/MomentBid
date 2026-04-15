"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Radio, ShieldCheck, Zap, Settings, TrendingUp, Trophy, PlaySquare } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import {
  BroadcasterApiError,
  createMatchEventConfig,
  deleteMatchEventConfig,
  getAuctionResults,
  getMatchBidLeaderboard,
  getMatchEventConfig,
  getMatchDetail,
  openBidding,
  updateMatchEventConfig,
  type AuctionResultGroup,
  type LeaderboardGroup,
  type MatchDetail,
  type MatchEventConfig,
} from "@/lib/broadcasterApi";

const WS_BASE_URL = (process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000").replace(/\/+$/, "");
const LEADERBOARD_POLL_INTERVAL_MS = 2500;

type MatchStatus = "CREATED" | "OPEN" | "ACTIVE" | "COMPLETED" | "CANCELLED";

type EventCategory = {
  id: string;
  eventType: number;
  name: string;
  reservePrice: string;
  slots: string;
  reservationFee: string;
  maxTriggers: string;
  enabled: boolean;
  configured: boolean;
};

type EventConfigPayload = {
  reserve_price: string;
  reservation_fee_pct: string;
  slot_count: number;
  max_triggers: number;
};

const defaultCategories: EventCategory[] = [
  {
    id: "over-break",
    eventType: 0,
    name: "OVER_BREAK",
    reservePrice: "100000",
    slots: "3",
    reservationFee: "2",
    maxTriggers: "40",
    enabled: false,
    configured: false,
  },
  {
    id: "wicket-fall",
    eventType: 3,
    name: "WICKET_FALL",
    reservePrice: "150000",
    slots: "2",
    reservationFee: "5",
    maxTriggers: "20",
    enabled: false,
    configured: false,
  },
  {
    id: "strategic-timeout",
    eventType: 1,
    name: "STRATEGIC_TIMEOUT",
    reservePrice: "300000",
    slots: "5",
    reservationFee: "1",
    maxTriggers: "4",
    enabled: false,
    configured: false,
  },
  {
    id: "last-over-thriller",
    eventType: 5,
    name: "LAST_OVER_THRILLER",
    reservePrice: "700000",
    slots: "1",
    reservationFee: "0",
    maxTriggers: "1",
    enabled: false,
    configured: false,
  },
];

function matchStateToStatus(state: number): MatchStatus {
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

function matchStatusToTimeText(status: MatchStatus): string {
  if (status === "OPEN") {
    return "Bidding Open";
  }
  if (status === "ACTIVE") {
    return "LIVE";
  }
  if (status === "COMPLETED") {
    return "Match Finished";
  }
  if (status === "CANCELLED") {
    return "Cancelled";
  }
  return "Created";
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed);
}

function formatPKR(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
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

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function deriveCategories(defaults: EventCategory[], configs: MatchEventConfig[]): EventCategory[] {
  const configsByEventType = new Map<number, MatchEventConfig>();
  for (const config of configs) {
    configsByEventType.set(config.event_type, config);
  }

  const categories = defaults.map((category) => {
    const config = configsByEventType.get(category.eventType);
    if (!config) {
      return { ...category };
    }

    return {
      ...category,
      enabled: true,
      configured: true,
      reservePrice: String(config.reserve_price),
      reservationFee: String(config.reservation_fee_pct),
      slots: String(config.slot_count),
      maxTriggers: String(config.max_triggers),
    };
  });

  const knownEventTypes = new Set<number>(defaults.map((category) => category.eventType));
  for (const config of configs) {
    if (knownEventTypes.has(config.event_type)) {
      continue;
    }

    categories.push({
      id: `event-${config.event_type}`,
      eventType: config.event_type,
      name: config.event_type_label,
      reservePrice: String(config.reserve_price),
      reservationFee: String(config.reservation_fee_pct),
      slots: String(config.slot_count),
      maxTriggers: String(config.max_triggers),
      enabled: true,
      configured: true,
    });
  }

  return categories;
}

function toEventConfigPayload(category: EventCategory): EventConfigPayload | null {
  const reservePrice = category.reservePrice.trim();
  const reservationFee = category.reservationFee.trim();
  const reservePriceNumber = Number.parseFloat(reservePrice);
  const reservationFeeNumber = Number.parseFloat(reservationFee);
  const slotCount = Number.parseInt(category.slots, 10);
  const maxTriggers = Number.parseInt(category.maxTriggers, 10);

  if (!reservePrice || !reservationFee) {
    return null;
  }

  if (!Number.isFinite(reservePriceNumber) || reservePriceNumber < 0) {
    return null;
  }

  if (!Number.isFinite(reservationFeeNumber) || reservationFeeNumber < 1 || reservationFeeNumber > 5) {
    return null;
  }

  if (!Number.isFinite(slotCount) || slotCount < 1) {
    return null;
  }

  if (!Number.isFinite(maxTriggers) || maxTriggers < 1) {
    return null;
  }

  return {
    reserve_price: reservePrice,
    reservation_fee_pct: reservationFee,
    slot_count: slotCount,
    max_triggers: maxTriggers,
  };
}

function getCreativeLabel(creativeRef: string): string {
  if (!creativeRef) {
    return "No creative assigned";
  }

  try {
    const url = new URL(creativeRef);
    const segments = url.pathname.split("/").filter(Boolean);
    const filename = segments.at(-1);
    return filename ? decodeURIComponent(filename) : creativeRef;
  } catch {
    const segments = creativeRef.split("/").filter(Boolean);
    return segments.at(-1) ?? creativeRef;
  }
}

export default function BroadcasterMatchDetailPage() {
  const params = useParams<{ id: string }>();
  const matchId = Number.parseInt(String(params.id ?? ""), 10);
  const searchParams = useSearchParams();
  const initTab = searchParams.get("tab") === "live" ? "live" : searchParams.get("tab") === "results" ? "results" : "config";
  
  const [activeTab, setActiveTab] = useState<"config" | "live" | "results">(initTab);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>(defaultCategories.map((category) => ({ ...category })));
  const [leaderboard, setLeaderboard] = useState<LeaderboardGroup[]>([]);
  const [auctionResults, setAuctionResults] = useState<AuctionResultGroup[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningBidding, setIsOpeningBidding] = useState(false);
  const [savingEventType, setSavingEventType] = useState<number | null>(null);
  const [deletingEventType, setDeletingEventType] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");

  const matchStatus = useMemo<MatchStatus>(() => {
    if (!matchDetail) {
      return "CREATED";
    }

    return matchStateToStatus(matchDetail.state);
  }, [matchDetail]);

  const matchDateLabel = useMemo(() => {
    return matchDetail ? formatMatchDate(matchDetail.match_date) : "";
  }, [matchDetail]);

  const grossEscrow = useMemo(() => {
    if (!matchDetail) {
      return 0;
    }

    return matchDetail.bids_summary.reduce((total, summary) => {
      return total + parseAmount(summary.total_amount);
    }, 0);
  }, [matchDetail]);

  const activeBidsCount = useMemo(() => {
    if (!matchDetail) {
      return 0;
    }

    return matchDetail.bids_summary.reduce((total, summary) => total + summary.bid_count, 0);
  }, [matchDetail]);

  const sortedAuctionResults = useMemo(() => {
    return [...auctionResults].sort((left, right) => {
      if (left.trigger_number !== right.trigger_number) {
        return right.trigger_number - left.trigger_number;
      }

      return right.event_type - left.event_type;
    });
  }, [auctionResults]);

  const refreshLeaderboard = useCallback(async (source = "manual"): Promise<void> => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    logBroadcasterLive("debug", matchId, "refreshLeaderboard:start", { source });

    try {
      const nextLeaderboard = await getMatchBidLeaderboard(matchId);
      setLeaderboard(nextLeaderboard);
      logBroadcasterLive("debug", matchId, "refreshLeaderboard:success", {
        source,
        eventGroups: nextLeaderboard.length,
        topEventType: nextLeaderboard[0]?.event_type ?? null,
      });
    } catch (error) {
      logBroadcasterLive("error", matchId, "refreshLeaderboard:failed", { source, error });
      throw error;
    }
  }, [matchId]);

  const refreshAuctionResults = useCallback(async (source = "manual"): Promise<void> => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    logBroadcasterLive("debug", matchId, "refreshAuctionResults:start", { source });

    try {
      const results = await getAuctionResults(matchId);
      setAuctionResults(results);
      logBroadcasterLive("debug", matchId, "refreshAuctionResults:success", {
        source,
        groups: results.length,
      });
    } catch (error) {
      logBroadcasterLive("error", matchId, "refreshAuctionResults:failed", { source, error });
      throw error;
    }
  }, [matchId]);

  const refreshMatchDetail = useCallback(async (source = "manual"): Promise<void> => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    logBroadcasterLive("debug", matchId, "refreshMatchDetail:start", { source });

    try {
      const detail = await getMatchDetail(matchId);
      setMatchDetail(detail);
      setCategories(deriveCategories(defaultCategories, detail.event_configs));
      logBroadcasterLive("debug", matchId, "refreshMatchDetail:success", {
        source,
        state: detail.state,
        stateLabel: detail.state_label,
      });
    } catch (error) {
      logBroadcasterLive("error", matchId, "refreshMatchDetail:failed", { source, error });
      throw error;
    }
  }, [matchId]);

  const loadPage = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(matchId)) {
      setPageError("Invalid match id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setPageError("");
    logBroadcasterLive("info", matchId, "loadPage:start");

    try {
      const [detail, nextLeaderboard, results] = await Promise.all([
        getMatchDetail(matchId),
        getMatchBidLeaderboard(matchId),
        getAuctionResults(matchId),
      ]);

      setMatchDetail(detail);
      setCategories(deriveCategories(defaultCategories, detail.event_configs));
      setLeaderboard(nextLeaderboard);
      setAuctionResults(results);
      logBroadcasterLive("info", matchId, "loadPage:success", {
        leaderboardEvents: nextLeaderboard.length,
        auctionResults: results.length,
        state: detail.state,
        stateLabel: detail.state_label,
      });
    } catch (error) {
      logBroadcasterLive("error", matchId, "loadPage:failed", { error });
      const message =
        error instanceof BroadcasterApiError
          ? error.message
          : "Unable to load match details right now.";
      setPageError(message);
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!Number.isFinite(matchId)) {
      return;
    }

    const socket = new WebSocket(`${WS_BASE_URL}/ws/matches/${matchId}/`);

    socket.onopen = () => {
      logBroadcasterLive("info", matchId, "websocket:open", { url: `${WS_BASE_URL}/ws/matches/${matchId}/` });
    };

    socket.onerror = (event) => {
      logBroadcasterLive("warn", matchId, "websocket:error", event);
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
          logBroadcasterLive("debug", matchId, "websocket:message-ignored", { raw: parsed });
          return;
        }

        logBroadcasterLive("debug", matchId, "websocket:message", {
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
            logBroadcasterLive("warn", matchId, "websocket:leaderboard-refresh-failed", { error, eventName });
          }),
        ];

        if (shouldRefreshResults) {
          refreshTasks.push(
            refreshAuctionResults("ws-auction").catch((error) => {
              logBroadcasterLive("warn", matchId, "websocket:auction-results-refresh-failed", { error, eventName });
            }),
          );
        }

        if (shouldRefreshMatch || refreshTasks.length === 0) {
          refreshTasks.push(
            refreshMatchDetail("ws-state").catch((error) => {
              logBroadcasterLive("warn", matchId, "websocket:match-refresh-failed", { error, eventName });
            }),
          );
        }

        void Promise.all(refreshTasks);
      } catch {
        // Ignore malformed websocket messages and keep the socket open.
      }
    };

    return () => {
      logBroadcasterLive("info", matchId, "websocket:close");
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

    logBroadcasterLive("info", matchId, "poller:start", {
      intervalMs: LEADERBOARD_POLL_INTERVAL_MS,
      state: matchDetail?.state,
      stateLabel: matchDetail?.state_label,
    });

    const timerId = window.setInterval(() => {
      logBroadcasterLive("debug", matchId, "poller:tick");
      void refreshLeaderboard("poll").catch((error) => {
        logBroadcasterLive("warn", matchId, "poller:leaderboard-refresh-failed", { error });
      });
    }, LEADERBOARD_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
      logBroadcasterLive("info", matchId, "poller:stop");
    };
  }, [matchDetail?.state, matchDetail?.state_label, matchId, refreshLeaderboard]);

  useEffect(() => {
    if (!matchDetail) {
      return;
    }

    if (activeTab === "results" && matchDetail.state !== 3) {
      setActiveTab("config");
    }
  }, [activeTab, matchDetail]);

  const updateCategory = useCallback(
    (
      eventType: number,
      patch: Partial<
        Pick<
          EventCategory,
          "reservePrice" | "slots" | "reservationFee" | "maxTriggers" | "enabled" | "configured" | "name"
        >
      >,
    ) => {
      setCategories((previous) =>
        previous.map((category) =>
          category.eventType === eventType
            ? {
                ...category,
                ...patch,
              }
            : category,
        ),
      );
    },
    [],
  );

  const toggleEvent = useCallback(
    (eventType: number) => {
      setCategories((previous) =>
        previous.map((category) => {
          if (category.eventType !== eventType) {
            return category;
          }
          if (category.configured) {
            return category;
          }
          return { ...category, enabled: !category.enabled };
        }),
      );
    },
    [],
  );

  const handleSaveEventConfig = useCallback(
    async (eventType: number): Promise<void> => {
      if (!Number.isFinite(matchId) || !matchDetail) {
        return;
      }

      if (matchDetail.state !== 0) {
        return;
      }

      const category = categories.find((existing) => existing.eventType === eventType);
      if (!category || !category.enabled || category.configured) {
        return;
      }

      const payload = toEventConfigPayload(category);
      if (!payload) {
        setPageError("Fill in valid config values before saving.");
        return;
      }

      setSavingEventType(eventType);
      setPageError("");

      try {
        await createMatchEventConfig(matchId, {
          event_type: category.eventType,
          ...payload,
        });

        const latestConfig = await getMatchEventConfig(matchId, category.eventType);
        updateCategory(category.eventType, {
          reservePrice: String(latestConfig.reserve_price),
          reservationFee: String(latestConfig.reservation_fee_pct),
          slots: String(latestConfig.slot_count),
          maxTriggers: String(latestConfig.max_triggers),
          enabled: true,
          configured: true,
          name: latestConfig.event_type_label,
        });

        await refreshMatchDetail();
      } catch (error) {
        const message =
          error instanceof BroadcasterApiError
            ? error.message
            : "Unable to save event config right now.";
        setPageError(message);
      } finally {
        setSavingEventType(null);
      }
    },
    [categories, matchDetail, matchId, refreshMatchDetail, updateCategory],
  );

  const handleUpdateEventConfig = useCallback(
    async (eventType: number): Promise<void> => {
      if (!Number.isFinite(matchId) || !matchDetail) {
        return;
      }

      if (matchDetail.state !== 0) {
        return;
      }

      const category = categories.find((existing) => existing.eventType === eventType);
      if (!category || !category.enabled || !category.configured) {
        return;
      }

      const payload = toEventConfigPayload(category);
      if (!payload) {
        setPageError("Fill in valid config values before updating.");
        return;
      }

      setSavingEventType(eventType);
      setPageError("");

      try {
        await updateMatchEventConfig(matchId, category.eventType, payload);

        const latestConfig = await getMatchEventConfig(matchId, category.eventType);
        updateCategory(category.eventType, {
          reservePrice: String(latestConfig.reserve_price),
          reservationFee: String(latestConfig.reservation_fee_pct),
          slots: String(latestConfig.slot_count),
          maxTriggers: String(latestConfig.max_triggers),
          enabled: true,
          configured: true,
          name: latestConfig.event_type_label,
        });

        await refreshMatchDetail();
      } catch (error) {
        const message =
          error instanceof BroadcasterApiError
            ? error.message
            : "Unable to update event config right now.";
        setPageError(message);
      } finally {
        setSavingEventType(null);
      }
    },
    [categories, matchDetail, matchId, refreshMatchDetail, updateCategory],
  );

  const handleDeleteEventConfig = useCallback(
    async (eventType: number): Promise<void> => {
      if (!Number.isFinite(matchId) || !matchDetail) {
        return;
      }

      if (matchDetail.state !== 0) {
        return;
      }

      const category = categories.find((existing) => existing.eventType === eventType);
      if (!category || !category.configured) {
        return;
      }

      const confirmed = window.confirm(
        `Delete ${category.name.replace(/_/g, " ")} configuration? This action cannot be undone.`,
      );
      if (!confirmed) {
        return;
      }

      setDeletingEventType(eventType);
      setPageError("");

      try {
        await deleteMatchEventConfig(matchId, category.eventType);
        await refreshMatchDetail();
      } catch (error) {
        const message =
          error instanceof BroadcasterApiError
            ? error.message
            : "Unable to delete event config right now.";
        setPageError(message);
      } finally {
        setDeletingEventType(null);
      }
    },
    [categories, matchDetail, matchId, refreshMatchDetail],
  );

  const handleOpenBidding = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(matchId) || !matchDetail) {
      return;
    }

    if (matchDetail.state !== 0) {
      return;
    }

    const confirmed = window.confirm(
      "This will open bidding and lock all exclusion groups. You cannot change them after this.",
    );
    if (!confirmed) {
      return;
    }

    setIsOpeningBidding(true);
    setPageError("");

    try {
      const pendingConfigs = categories.filter((category) => category.enabled && !category.configured);
      for (const category of pendingConfigs) {
        const payload = toEventConfigPayload(category);
        if (!payload) {
          throw new BroadcasterApiError("Fill in valid config values before opening bidding.", 400);
        }

        await createMatchEventConfig(matchId, {
          event_type: category.eventType,
          ...payload,
        });

        setCategories((previous) =>
          previous.map((existing) =>
            existing.eventType === category.eventType
              ? {
                  ...existing,
                  enabled: true,
                  configured: true,
                  reservePrice: payload.reserve_price,
                  reservationFee: payload.reservation_fee_pct,
                  slots: String(payload.slot_count),
                  maxTriggers: String(payload.max_triggers),
                }
              : existing,
          ),
        );
      }

      await openBidding(matchId);
      await refreshMatchDetail();
    } catch (error) {
      const message =
        error instanceof BroadcasterApiError
          ? error.message
          : "Unable to open bidding right now.";
      setPageError(message);
    } finally {
      setIsOpeningBidding(false);
    }
  }, [categories, matchDetail, matchId, refreshMatchDetail]);

  if (!Number.isFinite(matchId)) {
    return <div className="text-sm text-[#A31621]">Invalid match id.</div>;
  }

  if (isLoading) {
    return <div className="text-sm text-[#4E8098]">Loading match...</div>;
  }

  if (!matchDetail) {
    return <div className="text-sm text-[#A31621]">Unable to load match details.</div>;
  }

  return (
    <div className="flex flex-col space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/broadcaster/matches" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#4E8098] hover:text-[#A31621] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                matchStatus === "ACTIVE" ? "bg-[#A31621] text-white" : 
                matchStatus === "OPEN" ? "bg-[#90C2E7]/20 text-[#1a1a1a]" : 
                "bg-[#CED3DC] text-[#1a1a1a]"
              }`}>
                {matchStatus}
              </span>
              <span className="text-[10px] font-mono text-[#4E8098] uppercase">{matchStatusToTimeText(matchStatus)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {matchStatus === "CREATED" && (
              <button 
                onClick={() => void handleOpenBidding()}
                disabled={isOpeningBidding || savingEventType !== null || deletingEventType !== null}
                className="bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-60 disabled:hover:bg-[#1a1a1a] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                {isOpeningBidding ? "Opening..." : "Open Bidding"}
              </button>
            )}
            {matchStatus === "OPEN" && (
              <button 
                disabled
                title="Admin-only action"
                className="bg-[#A31621] hover:bg-[#8a121c] disabled:opacity-60 disabled:hover:bg-[#A31621] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                <Radio className="w-3.5 h-3.5" /> Go Live
              </button>
            )}
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl md:text-4xl font-medium tracking-tight text-[#1a1a1a] mt-2">
            {matchDetail.team_a} <span className="text-[#4E8098] mx-2 text-lg">vs</span> {matchDetail.team_b}
          </h1>
          <p className="mt-2 text-sm text-[#4E8098] flex items-center justify-start gap-4">
            <span>{matchDateLabel}</span>
            <span className="w-1 h-1 rounded-full bg-[#CED3DC]"></span>
            <span>{matchDetail.venue}</span>
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
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tabs */}
            <div className="border-b border-[#CED3DC] flex items-center gap-6">
              <button 
                onClick={() => setActiveTab("config")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === "config" ? "border-b-2 border-[#1a1a1a] text-[#1a1a1a]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
              >
                <Settings className="w-4 h-4" /> Match Config
              </button>
              <button 
                onClick={() => setActiveTab("live")}
                className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === "live" ? "border-b-2 border-[#A31621] text-[#A31621]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
              >
                <Zap className="w-4 h-4" /> Live Control
              </button>
              {matchStatus === "COMPLETED" && (
                <button 
                  onClick={() => setActiveTab("results")}
                  className={`pb-3 text-sm font-semibold uppercase tracking-widest transition-colors flex items-center gap-2 ${activeTab === "results" ? "border-b-2 border-[#1a1a1a] text-[#1a1a1a]" : "text-[#4E8098]/80 hover:text-[#1a1a1a]"}`}
                >
                  <Trophy className="w-4 h-4" /> Results & Ads
                </button>
              )}
            </div>

            {/* Config View */}
            {activeTab === "config" && (
              <div className="space-y-4">
                <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex gap-3 text-xs text-[#4E8098] mb-4">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#90C2E7]" />
                  <p>Configure floor prices and available slots. Once you click "Open Bidding", these parameters are locked to the blockchain.</p>
                </div>
                
                {categories.map((cat) => (
                  <div key={cat.id} className={`bg-white border p-5 transition-colors ${cat.enabled ? "border-[#4E8098]" : "border-[#CED3DC] opacity-60"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={cat.enabled} 
                          onChange={() => toggleEvent(cat.eventType)}
                          disabled={matchStatus !== "CREATED" || cat.configured || isOpeningBidding || deletingEventType === cat.eventType}
                          className="w-4 h-4 accent-[#1a1a1a]"
                        />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a]">
                          {cat.name.replace(/_/g, " ")}
                        </h3>
                        {cat.configured ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-[#FCF7F8] border border-[#CED3DC] text-[#4E8098]">
                            Saved
                          </span>
                        ) : null}
                      </div>

                      {cat.enabled && matchStatus === "CREATED" ? (
                        <div className="flex items-center gap-2">
                          {cat.configured ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleUpdateEventConfig(cat.eventType)}
                                disabled={isOpeningBidding || deletingEventType === cat.eventType || savingEventType === cat.eventType}
                                className="border border-[#CED3DC] bg-[#FCF7F8] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] hover:bg-[#CED3DC]/30 disabled:opacity-60"
                              >
                                {savingEventType === cat.eventType ? "Updating..." : "Update"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteEventConfig(cat.eventType)}
                                disabled={isOpeningBidding || savingEventType === cat.eventType || deletingEventType === cat.eventType}
                                className="border border-[#A31621]/30 bg-[#FCF7F8] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#A31621] hover:bg-[#A31621]/10 disabled:opacity-60"
                              >
                                {deletingEventType === cat.eventType ? "Deleting..." : "Delete"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleSaveEventConfig(cat.eventType)}
                              disabled={isOpeningBidding || deletingEventType === cat.eventType || savingEventType === cat.eventType}
                              className="border border-[#CED3DC] bg-[#FCF7F8] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a] hover:bg-[#CED3DC]/30 disabled:opacity-60"
                            >
                              {savingEventType === cat.eventType ? "Saving..." : "Save"}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-7">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Reserve (PKR)</label>
                        <input
                          type="number"
                          value={cat.reservePrice}
                          onChange={(e) => updateCategory(cat.eventType, { reservePrice: e.target.value })}
                          disabled={!cat.enabled || matchStatus !== "CREATED" || isOpeningBidding || savingEventType === cat.eventType || deletingEventType === cat.eventType}
                          className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Slots</label>
                        <input
                          type="number"
                          value={cat.slots}
                          onChange={(e) => updateCategory(cat.eventType, { slots: e.target.value })}
                          disabled={!cat.enabled || matchStatus !== "CREATED" || isOpeningBidding || savingEventType === cat.eventType || deletingEventType === cat.eventType}
                          className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Res Fee %</label>
                        <input
                          type="number"
                          value={cat.reservationFee}
                          onChange={(e) => updateCategory(cat.eventType, { reservationFee: e.target.value })}
                          disabled={!cat.enabled || matchStatus !== "CREATED" || isOpeningBidding || savingEventType === cat.eventType || deletingEventType === cat.eventType}
                          className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-[#4E8098]">Max Triggers</label>
                        <input
                          type="number"
                          value={cat.maxTriggers}
                          onChange={(e) => updateCategory(cat.eventType, { maxTriggers: e.target.value })}
                          disabled={!cat.enabled || matchStatus !== "CREATED" || isOpeningBidding || savingEventType === cat.eventType || deletingEventType === cat.eventType}
                          className="w-full bg-[#FCF7F8] border border-[#CED3DC] px-3 py-2 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live View */}
            {activeTab === "live" && (
              <div className="space-y-4">
                <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#A31621] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">
                      {matchStatus === "OPEN" ? "Bidding Open" : matchStatus === "ACTIVE" ? "Match Live" : "Awaiting Bids"}
                    </span>
                  </div>
                  <Radio className="w-4 h-4 text-[#A31621]" />
                </div>

                {leaderboard.length === 0 ? (
                  <div className="bg-white border border-[#CED3DC] p-6 text-sm text-[#4E8098]">
                    No bids yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leaderboard.map((group) => (
                      <div key={group.event_type} className="bg-white border border-[#CED3DC] overflow-hidden">
                        <div className="bg-[#FCF7F8] border-b border-[#CED3DC] p-4 flex items-center justify-between">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a]">
                            {group.event_type_label.replace(/_/g, " ")}
                          </h3>
                          <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">
                            TOTAL {formatPKR(group.total_escrowed)}
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] text-left text-xs">
                            <thead className="bg-white">
                              <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                                <th className="px-4 py-3 font-semibold">Rank</th>
                                <th className="px-4 py-3 font-semibold">Brand</th>
                                <th className="px-4 py-3 font-semibold">Amount</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Placed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#CED3DC]/50">
                              {group.bids.map((bid, index) => (
                                <tr key={bid.id} className="hover:bg-[#FCF7F8]">
                                  <td className="px-4 py-3 font-mono text-[#4E8098]">#{index + 1}</td>
                                  <td className="px-4 py-3 text-[#1a1a1a] font-semibold">{bid.brand}</td>
                                  <td className="px-4 py-3 font-mono text-[#A31621] font-semibold">
                                    {formatPKR(parseAmount(bid.amount))}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                                        bid.is_settled
                                          ? "bg-[#FCF7F8] border-[#CED3DC] text-[#4E8098]"
                                          : "bg-[#90C2E7]/20 border-[#90C2E7]/50 text-[#1a1a1a]"
                                      }`}
                                    >
                                      {bid.is_settled ? "Settled" : "Active"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[#4E8098]">{formatTimestamp(bid.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white border border-[#CED3DC] overflow-hidden">
                  <div className="bg-[#FCF7F8] border-b border-[#CED3DC] p-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a]">Auction Settlements</h3>
                    <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">{sortedAuctionResults.length} TOTAL</span>
                  </div>

                  {sortedAuctionResults.length === 0 ? (
                    <div className="p-6 text-sm text-[#4E8098]">No auction settlements yet.</div>
                  ) : (
                    <div className="divide-y divide-[#CED3DC]/70">
                      {sortedAuctionResults.map((result) => (
                        <div key={`${result.event_type}-${result.trigger_number}`} className="p-5">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">
                                {result.event_type_label.replace(/_/g, " ")}
                              </p>
                              <p className="text-[10px] font-mono tracking-widest text-[#4E8098] mt-1">
                                TRIGGER #{result.trigger_number}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#FCF7F8] border border-[#CED3DC] text-[#4E8098]">
                              {result.slots_filled}/{result.slots.length} slots
                            </span>
                          </div>

                          <div className="space-y-2 mt-4 ml-6 pl-4 border-l-2 border-[#CED3DC]">
                            {result.slots
                              .slice()
                              .sort((left, right) => left.slot_position - right.slot_position)
                              .map((slot) => (
                                <div key={slot.id} className="flex font-mono text-xs text-[#1a1a1a]">
                                  <span className="text-[#4E8098] w-16 shrink-0">Slot {slot.slot_position}</span>
                                  <span>
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

            {/* Results View */}
            {activeTab === "results" && (
              <div className="space-y-6">
                <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex gap-3 text-xs text-[#4E8098]">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#90C2E7]" />
                  <p>The bidding period has finished. Below are the winning brands for each triggered event, along with their assigned promotional video/ad greenlit by the regulatory authority.</p>
                </div>

                {auctionResults.length === 0 ? (
                  <div className="bg-white border border-[#CED3DC] p-6 text-sm text-[#4E8098]">No auction settlements yet.</div>
                ) : (
                  <div className="space-y-4">
                    {auctionResults.map((group) => (
                      <div
                        key={`${group.event_type}-${group.trigger_number}`}
                        className="bg-white border border-[#CED3DC] overflow-hidden"
                      >
                        <div className="bg-[#FCF7F8] border-b border-[#CED3DC] p-4 flex justify-between items-center">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a] flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-[#90C2E7]" />
                            EVENT: {group.event_type_label.replace(/_/g, " ")}
                          </h3>
                          <span className="text-[10px] font-mono tracking-widest text-[#4E8098]">
                            TRIGGER {group.trigger_number}
                          </span>
                        </div>

                        <div className="divide-y divide-[#CED3DC]/70">
                          {group.slots
                            .slice()
                            .sort((left, right) => left.slot_position - right.slot_position)
                            .map((slot) => (
                              <div key={slot.id} className="p-5 flex flex-col md:flex-row gap-6 items-start">
                                <div className="w-full md:w-48 aspect-video bg-black flex items-center justify-center group relative overflow-hidden shrink-0">
                                  <PlaySquare className="w-8 h-8 text-white opacity-50 group-hover:opacity-100 transition-opacity z-10" />
                                  <div className="absolute inset-0 bg-[#A31621]/20 group-hover:bg-[#A31621]/10 transition-colors" />
                                </div>
                                <div className="flex-1 space-y-3">
                                  <div>
                                    <h4 className="text-xs uppercase font-semibold text-[#4E8098]">
                                      Slot {slot.slot_position} Winner
                                    </h4>
                                    <p className="text-lg font-bold text-[#1a1a1a] tracking-tight">{slot.winner}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-xs uppercase font-semibold text-[#4E8098] mb-1">Assigned Ad Creative</h4>
                                    <p className="text-sm text-[#1a1a1a] flex items-center gap-2 font-medium">
                                      {getCreativeLabel(slot.creative_ref)}
                                    </p>
                                    <p className="text-[10px] font-mono tracking-widest text-[#4E8098] mt-1 flex items-center gap-1 border border-[#CED3DC] bg-[#FCF7F8] px-2 py-0.5 w-fit">
                                      <ShieldCheck className="w-3 h-3" /> VERIFIED & GREENLIT
                                    </p>
                                  </div>
                                  <div className="pt-2 border-t border-[#CED3DC] w-full flex justify-between items-center mt-2">
                                    <span className="text-[10px] uppercase font-semibold text-[#4E8098]">Winning Bid</span>
                                    <span className="font-mono text-sm font-bold text-[#A31621]">
                                      {formatPKR(parseAmount(slot.amount))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <div className="bg-white border border-[#CED3DC] p-5 sticky top-6">
              <h3 className="text-sm font-semibold tracking-wide text-[#1a1a1a] uppercase mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#4E8098]" />
                Event Analytics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Gross Escrow</span>
                  <span className="font-mono text-[#1a1a1a] font-semibold">{formatPKR(grossEscrow)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Configured Events</span>
                  <span className="font-mono text-[#1a1a1a]">{matchDetail.event_configs.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4E8098] text-xs font-semibold uppercase tracking-widest">Active Bids</span>
                  <span className="font-mono text-[#1a1a1a]">{activeBidsCount}</span>
                </div>
              </div>
              <div className="h-px bg-[#CED3DC] w-full my-5" />
              <Link href="/broadcaster/exclusions" className="text-[10px] uppercase font-bold tracking-widest text-[#90C2E7] hover:text-[#4E8098] transition-colors flex items-center justify-center gap-1 w-full border border-[#CED3DC] bg-[#FCF7F8] py-3">
                Review Exclusion Groups <ArrowLeft className="w-3 h-3 rotate-180" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function logBroadcasterLive(
  level: "info" | "warn" | "error" | "debug",
  matchId: number,
  message: string,
  details?: unknown,
): void {
  const prefix = `[BroadcasterLive][match:${Number.isFinite(matchId) ? matchId : "invalid"}] ${message}`;
  if (details === undefined) {
    console[level](prefix);
    return;
  }
  console[level](prefix, details);
}