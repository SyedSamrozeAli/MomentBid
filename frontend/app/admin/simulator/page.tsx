"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Activity, Play, Power, Flag, Radio, RefreshCcw, Zap, AlertTriangle } from "lucide-react";

import {
  AdminApiError,
  cancelSimulatorMatch,
  completeSimulatorMatch,
  getAuctionResults,
  getSimulatorStatus,
  listMatches,
  startSimulatorMatch,
  triggerSimulatorEvent,
  type AuctionResultGroup,
  type MatchRecord,
  type SimulatorStatus,
} from "@/lib/adminApi";

const WS_BASE_URL = (process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000").replace(/\/+$/, "");

type EventOption = {
  value: number;
  label: string;
};

const eventOptions: EventOption[] = [
  { value: 0, label: "OVER_BREAK" },
  { value: 1, label: "STRATEGIC_TIMEOUT" },
  { value: 2, label: "INNINGS_BREAK" },
  { value: 3, label: "WICKET_FALL" },
  { value: 4, label: "HIGH_VALUE_WICKET" },
  { value: 5, label: "LAST_OVER_THRILLER" },
  { value: 6, label: "HAT_TRICK_BALL" },
  { value: 7, label: "SUPER_OVER" },
];

const eventTypeByLabel: Record<string, number> = eventOptions.reduce<Record<string, number>>((map, option) => {
  map[option.label] = option.value;
  return map;
}, {});

function toErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

function getMatchLabel(match: MatchRecord): string {
  return `${match.team_a} vs ${match.team_b}`;
}

function sortByIdDescending(records: MatchRecord[]): MatchRecord[] {
  return [...records].sort((left, right) => right.id - left.id);
}

function mapStateToLabel(state: number): string {
  if (state === 0) {
    return "CREATED";
  }
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
  return "UNKNOWN";
}

function formatCurrency(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(parsed);
}

export default function AdminSimulatorPage() {
  const [openMatches, setOpenMatches] = useState<MatchRecord[]>([]);
  const [activeMatches, setActiveMatches] = useState<MatchRecord[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [auctionResults, setAuctionResults] = useState<AuctionResultGroup[]>([]);

  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const combinedMatches = useMemo(() => {
    const map = new Map<number, MatchRecord>();

    for (const match of activeMatches) {
      map.set(match.id, match);
    }

    for (const match of openMatches) {
      if (!map.has(match.id)) {
        map.set(match.id, match);
      }
    }

    return sortByIdDescending(Array.from(map.values()));
  }, [activeMatches, openMatches]);

  const selectedMatch = useMemo(
    () => combinedMatches.find((match) => match.id === selectedMatchId) ?? null,
    [combinedMatches, selectedMatchId],
  );

  const loadMatches = useCallback(async (): Promise<void> => {
    setIsLoadingMatches(true);
    setLoadError("");

    try {
      const [openRecords, activeRecords] = await Promise.all([listMatches(1), listMatches(2)]);
      const sortedOpen = sortByIdDescending(openRecords);
      const sortedActive = sortByIdDescending(activeRecords);

      setOpenMatches(sortedOpen);
      setActiveMatches(sortedActive);

      const preferredMatch = sortedActive[0] ?? sortedOpen[0] ?? null;
      setSelectedMatchId((previous) => {
        if (previous && [...sortedActive, ...sortedOpen].some((match) => match.id === previous)) {
          return previous;
        }

        return preferredMatch ? preferredMatch.id : null;
      });
    } catch (error) {
      setOpenMatches([]);
      setActiveMatches([]);
      setSelectedMatchId(null);
      setLoadError(toErrorMessage(error));
    } finally {
      setIsLoadingMatches(false);
    }
  }, []);

  const loadSimulatorData = useCallback(
    async (matchId: number): Promise<void> => {
      setIsLoadingStatus(true);
      setLoadError("");

      try {
        const [results, statusResult] = await Promise.all([
          getAuctionResults(matchId),
          getSimulatorStatus(matchId),
        ]);

        setAuctionResults(results);
        setStatus(statusResult);
      } catch (error) {
        setStatus(null);
        setAuctionResults([]);
        setLoadError(toErrorMessage(error));
      } finally {
        setIsLoadingStatus(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    if (selectedMatchId === null) {
      setStatus(null);
      setAuctionResults([]);
      return;
    }

    void loadSimulatorData(selectedMatchId);
  }, [loadSimulatorData, selectedMatchId]);

  useEffect(() => {
    if (selectedMatchId === null) {
      return;
    }

    const socket = new WebSocket(`${WS_BASE_URL}/ws/matches/${selectedMatchId}/`);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { event?: string };
        if (!payload.event) {
          return;
        }

        if (payload.event === "auction_settled" || payload.event === "match_state_changed") {
          void loadSimulatorData(selectedMatchId);
          return;
        }

        if (payload.event === "refund_processed") {
          void loadMatches();
        }
      } catch {
        // Ignore malformed websocket messages to keep realtime sync alive.
      }
    };

    return () => {
      socket.close();
    };
  }, [loadMatches, loadSimulatorData, selectedMatchId]);

  async function executeAction(action: () => Promise<void>, successMessage: string): Promise<void> {
    setActionError("");
    setActionSuccess("");
    setIsActionBusy(true);

    try {
      await action();
      setActionSuccess(successMessage);

      if (selectedMatchId !== null) {
        await Promise.all([loadMatches(), loadSimulatorData(selectedMatchId)]);
      }
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleStartMatch(): Promise<void> {
    if (selectedMatchId === null || !status || status.state !== 1) {
      return;
    }

    await executeAction(() => startSimulatorMatch(selectedMatchId), "Match started successfully.");
  }

  async function handleTriggerEvent(eventType: number): Promise<void> {
    if (selectedMatchId === null || !status || status.state !== 2) {
      return;
    }

    setActionError("");
    setActionSuccess("");
    setIsActionBusy(true);

    try {
      const response = await triggerSimulatorEvent(selectedMatchId, eventType);
      setActionSuccess(`Triggered: ${response.event_type_label} #${response.trigger_number}`);
      await Promise.all([loadMatches(), loadSimulatorData(selectedMatchId)]);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleCompleteMatch(): Promise<void> {
    if (selectedMatchId === null || !status || status.state !== 2) {
      return;
    }

    await executeAction(() => completeSimulatorMatch(selectedMatchId), "Match completed successfully.");
  }

  async function handleCancelMatch(): Promise<void> {
    if (selectedMatchId === null || !status || status.state >= 3) {
      return;
    }

    await executeAction(() => cancelSimulatorMatch(selectedMatchId), "Match cancelled successfully.");
  }

  function handleMatchSelect(event: ChangeEvent<HTMLSelectElement>): void {
    const nextMatchId = Number.parseInt(event.target.value, 10);
    setSelectedMatchId(Number.isFinite(nextMatchId) ? nextMatchId : null);
  }

  const statusStateLabel = status ? `${status.state_label} (${status.state})` : isLoadingStatus ? "..." : "Select a match";
  const statusEventsEnabled = status ? String(status.events_enabled.length) : isLoadingStatus ? "..." : "-";
  const statusTriggerGroups = status ? String(Object.keys(status.trigger_counts).length) : isLoadingStatus ? "..." : "-";

  const triggerRows = useMemo(() => {
    if (!status) {
      return [];
    }

    return status.events_enabled.map((eventLabel) => {
      const triggerCount = status.trigger_counts[eventLabel] ?? { triggered: 0, max: 0 };
      const eventType = eventTypeByLabel[eventLabel] ?? null;
      const isMaxReached = triggerCount.max > 0 && triggerCount.triggered >= triggerCount.max;
      const isMatchActive = status.state === 2;
      const isDisabled = isActionBusy || !isMatchActive || isMaxReached || eventType === null;

      let disabledReason = "";
      if (eventType === null) {
        disabledReason = "Event mapping unavailable.";
      } else if (!isMatchActive) {
        disabledReason = "Match must be ACTIVE to trigger events.";
      } else if (isMaxReached) {
        disabledReason = "Trigger limit reached.";
      }

      return {
        eventLabel,
        eventType,
        triggered: triggerCount.triggered,
        max: triggerCount.max,
        isDisabled,
        disabledReason,
      };
    });
  }, [isActionBusy, status]);

  return (
    <div className="p-6 md:p-10 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Match Simulator</h2>
          <p className="mt-1 text-sm text-[#4E8098]">Integrated admin controls for simulator lifecycle and event settlement APIs.</p>
        </div>

        <button
          type="button"
          onClick={() => void loadMatches()}
          className="flex items-center justify-center gap-2 bg-[#1a1a1a] text-white px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-colors shadow-sm"
        >
          <RefreshCcw className="w-4 h-4 shrink-0" />
          Refresh Matches
        </button>
      </div>

      {loadError ? (
        <div className="border border-[#A31621]/30 bg-white p-4 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
          {loadError}
        </div>
      ) : null}

      {actionError ? (
        <div className="border border-[#A31621]/30 bg-white p-4 text-xs font-semibold uppercase tracking-widest text-[#A31621]">
          {actionError}
        </div>
      ) : null}

      {actionSuccess ? (
        <div className="border border-[#4E8098]/30 bg-white p-4 text-xs font-semibold uppercase tracking-widest text-[#4E8098]">
          {actionSuccess}
        </div>
      ) : null}

      <section className="bg-white border border-[#CED3DC] p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-semibold text-[#4E8098] mb-2">Select Match</label>
            <select
              value={selectedMatchId ?? ""}
              onChange={handleMatchSelect}
              disabled={isLoadingMatches || combinedMatches.length === 0}
              className="w-full bg-white border border-[#CED3DC] px-3 py-2 text-xs text-[#1a1a1a] focus:outline-none focus:border-[#90C2E7]"
            >
              {combinedMatches.length === 0 ? <option value="">{isLoadingMatches ? "Loading..." : "No OPEN/ACTIVE matches"}</option> : null}
              {combinedMatches.map((match) => (
                <option key={match.id} value={match.id}>{`${getMatchLabel(match)} [${mapStateToLabel(match.state)}]`}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedMatch ? (
          <p className="text-xs text-[#4E8098] uppercase tracking-widest">Selected: <span className="text-[#1a1a1a] font-semibold">{getMatchLabel(selectedMatch)}</span></p>
        ) : (
          <p className="text-xs text-[#4E8098] uppercase tracking-widest">Selected: None</p>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2">
            <Activity className="w-3 h-3" />
            Simulator State
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">{statusStateLabel}</p>
        </div>

        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2">
            <Radio className="w-3 h-3" />
            Events Enabled
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">{statusEventsEnabled}</p>
        </div>

        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center gap-2">
            <Flag className="w-3 h-3" />
            Trigger Groups
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">{statusTriggerGroups}</p>
        </div>
      </section>

      <section className="bg-white border border-[#CED3DC] p-5">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a] mb-4">Simulator Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => void handleStartMatch()}
            disabled={selectedMatchId === null || isActionBusy || !status || status.state !== 1}
            className="flex items-center justify-center gap-2 bg-[#1a1a1a] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#333] disabled:opacity-60"
          >
            <Play className="w-4 h-4" /> Start Match
          </button>

          <button
            type="button"
            onClick={() => void handleCompleteMatch()}
            disabled={selectedMatchId === null || isActionBusy || !status || status.state !== 2}
            className="flex items-center justify-center gap-2 bg-[#4E8098] text-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#35647a] disabled:opacity-60"
          >
            <Flag className="w-4 h-4" /> Complete Match
          </button>

          <button
            type="button"
            onClick={() => void handleCancelMatch()}
            disabled={selectedMatchId === null || isActionBusy || !status || status.state >= 3}
            className="flex items-center justify-center gap-2 border border-[#A31621] text-[#A31621] bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#FCF7F8] disabled:opacity-60"
          >
            <Power className="w-4 h-4" /> Cancel Match
          </button>
        </div>
      </section>

      <section className="bg-white border border-[#CED3DC] p-5">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a] mb-4">Trigger Events</h3>

        {triggerRows.length === 0 ? (
          <p className="text-xs uppercase tracking-widest text-[#4E8098]">Load simulator status to view enabled event triggers.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {triggerRows.map((row) => (
              <button
                key={row.eventLabel}
                type="button"
                disabled={row.isDisabled || row.eventType === null}
                onClick={() => {
                  if (row.eventType !== null) {
                    void handleTriggerEvent(row.eventType);
                  }
                }}
                className="border border-[#CED3DC] bg-white text-left p-4 hover:bg-[#FCF7F8] transition-colors disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">{row.eventLabel.replace(/_/g, " ")}</p>
                  <Zap className="w-4 h-4 text-[#A31621]" />
                </div>
                <p className="mt-3 text-xl font-mono text-[#4E8098]">{`${row.triggered} / ${row.max}`}</p>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-[#4E8098]">
                  {row.disabledReason || "Ready"}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-[#CED3DC] overflow-hidden">
        <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Trigger Counts</h3>
          {isLoadingStatus ? <span className="text-[10px] uppercase tracking-widest text-[#4E8098]">Loading...</span> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-widest text-[#4E8098] bg-white border-b border-[#CED3DC]">
              <tr>
                <th className="px-5 py-4 font-semibold">Event</th>
                <th className="px-5 py-4 font-semibold">Triggered</th>
                <th className="px-5 py-4 font-semibold">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CED3DC]/50">
              {status ? (
                Object.entries(status.trigger_counts).map(([eventName, triggerCount]) => (
                  <tr key={eventName} className="hover:bg-[#FCF7F8]">
                    <td className="px-5 py-3 text-[#1a1a1a]">{eventName}</td>
                    <td className="px-5 py-3 font-mono text-[#4E8098]">{triggerCount.triggered}</td>
                    <td className="px-5 py-3 font-mono text-[#4E8098]">{triggerCount.max}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-4 text-[#4E8098]" colSpan={3}>Select a match to load trigger counts.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-[#CED3DC] overflow-hidden">
        <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8]">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Auction Results Feed</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-widest text-[#4E8098] bg-white border-b border-[#CED3DC]">
              <tr>
                <th className="px-5 py-4 font-semibold">Event</th>
                <th className="px-5 py-4 font-semibold">Trigger #</th>
                <th className="px-5 py-4 font-semibold">Slots</th>
                <th className="px-5 py-4 font-semibold">Top Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CED3DC]/50">
              {auctionResults.length === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-[#4E8098]" colSpan={4}>{selectedMatchId === null ? "Select a match to view results." : "No auction results settled yet."}</td>
                </tr>
              ) : (
                auctionResults.map((group) => (
                  <tr key={`${group.event_type}-${group.trigger_number}`} className="hover:bg-[#FCF7F8]">
                    <td className="px-5 py-3 text-[#1a1a1a]">{group.event_type_label}</td>
                    <td className="px-5 py-3 font-mono text-[#4E8098]">{group.trigger_number}</td>
                    <td className="px-5 py-3 text-[#1a1a1a]">{group.slots_filled}</td>
                    <td className="px-5 py-3 font-mono text-[#4E8098]">
                      {group.slots[0]?.amount ? formatCurrency(group.slots[0].amount) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-[#CED3DC] p-5">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a] mb-3">Simulator API Coverage</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] uppercase tracking-widest font-semibold">
          <p className="text-[#1a1a1a]">GET /api/matches/?state=1: Connected</p>
          <p className="text-[#1a1a1a]">GET /api/matches/?state=2: Connected</p>
          <p className="text-[#1a1a1a]">GET /api/matches/{"{id}"}/auction-results/: Connected</p>
          <p className="text-[#1a1a1a]">GET /api/simulator/{"{id}"}/status/: {status ? "Connected" : "Pending Match Selection"}</p>
          <p className="text-[#1a1a1a]">POST /api/simulator/{"{id}"}/start/: Integrated</p>
          <p className="text-[#1a1a1a]">POST /api/simulator/{"{id}"}/trigger-event/: Integrated</p>
          <p className="text-[#1a1a1a]">POST /api/simulator/{"{id}"}/complete/: Integrated</p>
          <p className="text-[#1a1a1a]">POST /api/simulator/{"{id}"}/cancel/: Integrated</p>
        </div>

        <p className="mt-4 text-[10px] uppercase tracking-widest text-[#4E8098] flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          All listed simulator endpoints are wired in frontend and refresh the UI after each action.
        </p>
      </section>
    </div>
  );
}
