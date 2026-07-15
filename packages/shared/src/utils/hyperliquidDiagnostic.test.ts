import { recordHyperliquidDiagnosticHeartbeat } from './hyperliquidDiagnostic';

describe('recordHyperliquidDiagnosticHeartbeat', () => {
  it('logs the first sample immediately', () => {
    const result = recordHyperliquidDiagnosticHeartbeat({
      state: { pendingCount: 0 },
      now: 1000,
      intervalMs: 1000,
    });

    expect(result).toEqual({
      shouldLog: true,
      sampleCount: 1,
      state: {
        lastLoggedAt: 1000,
        pendingCount: 0,
      },
    });
  });

  it('aggregates samples until the interval elapses', () => {
    const first = recordHyperliquidDiagnosticHeartbeat({
      state: { pendingCount: 0 },
      now: 1000,
      intervalMs: 1000,
    });
    const second = recordHyperliquidDiagnosticHeartbeat({
      state: first.state,
      now: 1200,
      intervalMs: 1000,
    });
    const third = recordHyperliquidDiagnosticHeartbeat({
      state: second.state,
      now: 1500,
      intervalMs: 1000,
    });
    const fourth = recordHyperliquidDiagnosticHeartbeat({
      state: third.state,
      now: 2000,
      intervalMs: 1000,
    });

    expect(second.shouldLog).toBe(false);
    expect(third.shouldLog).toBe(false);
    expect(fourth).toEqual({
      shouldLog: true,
      sampleCount: 3,
      state: {
        lastLoggedAt: 2000,
        pendingCount: 0,
      },
    });
  });

  it('logs a forced transition without waiting for the interval', () => {
    const result = recordHyperliquidDiagnosticHeartbeat({
      state: {
        lastLoggedAt: 1000,
        pendingCount: 2,
      },
      now: 1100,
      intervalMs: 1000,
      force: true,
    });

    expect(result).toEqual({
      shouldLog: true,
      sampleCount: 3,
      state: {
        lastLoggedAt: 1100,
        pendingCount: 0,
      },
    });
  });
});
