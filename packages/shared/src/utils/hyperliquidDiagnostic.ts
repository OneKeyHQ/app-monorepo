export type IHyperliquidDiagnosticHeartbeatState = {
  lastLoggedAt?: number;
  pendingCount: number;
};

export const HYPERLIQUID_DIAGNOSTIC_HEARTBEAT_INTERVAL_MS = 1000;

export function recordHyperliquidDiagnosticHeartbeat({
  state,
  now,
  intervalMs,
  force = false,
}: {
  state: IHyperliquidDiagnosticHeartbeatState;
  now: number;
  intervalMs: number;
  force?: boolean;
}): {
  shouldLog: boolean;
  sampleCount: number;
  state: IHyperliquidDiagnosticHeartbeatState;
} {
  const sampleCount = state.pendingCount + 1;
  const shouldLog =
    force ||
    state.lastLoggedAt === undefined ||
    now - state.lastLoggedAt >= intervalMs;

  if (!shouldLog) {
    return {
      shouldLog: false,
      sampleCount,
      state: {
        ...state,
        pendingCount: sampleCount,
      },
    };
  }

  return {
    shouldLog: true,
    sampleCount,
    state: {
      lastLoggedAt: now,
      pendingCount: 0,
    },
  };
}
