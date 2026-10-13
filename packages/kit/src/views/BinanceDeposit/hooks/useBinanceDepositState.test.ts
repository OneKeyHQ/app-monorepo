/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositSessionSnapshot,
  IBinanceDepositState,
} from '@onekeyhq/shared/types/exchange';

import { useBinanceDepositState } from './useBinanceDepositState';

jest.mock('@onekeyhq/components/src/hooks/useVisibilityChange', () => ({
  getCurrentVisibilityState: jest.fn(),
  useVisibilityChange: jest.fn(),
}));

jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: jest.fn(),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBinanceDeposit: {
      getState: jest.fn(),
      retryPendingReports: jest.fn(),
    },
  },
}));

jest.mock('../../../routes/config/deeplink/binanceDepositReturn', () => ({
  recoverBinanceDepositReturnOnForeground: jest.fn(),
}));

const visibilityMock = jest.requireMock(
  '@onekeyhq/components/src/hooks/useVisibilityChange',
) as {
  getCurrentVisibilityState: jest.Mock<boolean, []>;
  useVisibilityChange: jest.Mock<void, [(visible: boolean) => void]>;
};
const mockedUseRouteIsFocused = (
  jest.requireMock('../../../hooks/useRouteIsFocused') as {
    useRouteIsFocused: jest.Mock<boolean, []>;
  }
).useRouteIsFocused;
const service = (
  jest.requireMock('../../../background/instance/backgroundApiProxy') as {
    default: {
      serviceBinanceDeposit: {
        getState: jest.Mock<Promise<IBinanceDepositState>, []>;
        retryPendingReports: jest.Mock<Promise<void>, []>;
      };
    };
  }
).default.serviceBinanceDeposit;
const mockedRecover = (
  jest.requireMock('../../../routes/config/deeplink/binanceDepositReturn') as {
    recoverBinanceDepositReturnOnForeground: jest.Mock<Promise<void>, []>;
  }
).recoverBinanceDepositReturnOnForeground;

function buildSession(
  patch: Partial<IBinanceDepositSessionSnapshot> = {},
): IBinanceDepositSessionSnapshot {
  return {
    localId: 'local-id-0001',
    sessionId: 'd'.repeat(64),
    accountId: 'account-id',
    senderAddress: '0x1111111111111111111111111111111111111111',
    networkId: 'evm--56',
    cryptoCurrency: 'USDT',
    status: EBinanceDepositSessionStatus.INIT,
    createdAt: 1,
    updatedAt: 1,
    awaitingReturn: false,
    hasPendingNonce: false,
    bindInFlight: false,
    sessionIdMasked: 'dddddddd…',
    endpointMismatch: false,
    ...patch,
  };
}

function buildState(
  active?: IBinanceDepositSessionSnapshot,
): IBinanceDepositState {
  return { active, recent: [], events: [] };
}

async function flush() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

function emitVisibility(visible: boolean) {
  const handler = visibilityMock.useVisibilityChange.mock.calls.at(-1)?.[0];
  expect(handler).toBeDefined();
  handler?.(visible);
}

describe('useBinanceDepositState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    visibilityMock.getCurrentVisibilityState.mockReturnValue(true);
    mockedUseRouteIsFocused.mockReturnValue(true);
    service.getState.mockResolvedValue(buildState());
    service.retryPendingReports.mockResolvedValue(undefined);
    mockedRecover.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads the snapshot and retries pending reports when the page opens', async () => {
    const active = buildSession();
    service.getState.mockResolvedValue(buildState(active));
    const { result } = renderHook(() => useBinanceDepositState());
    await flush();

    expect(result.current.state?.active).toEqual(active);
    expect(result.current.isStateUnavailable).toBe(false);
    expect(service.retryPendingReports).toHaveBeenCalledTimes(1);
    expect(mockedRecover).not.toHaveBeenCalled();
  });

  it('polls the local snapshot while the page is focused', async () => {
    renderHook(() => useBinanceDepositState());
    await flush();
    const callsAfterMount = service.getState.mock.calls.length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS * 3,
      );
    });
    expect(service.getState.mock.calls.length).toBe(callsAfterMount + 3);
    // Polling only reads; it never re-sends reports.
    expect(service.retryPendingReports).toHaveBeenCalledTimes(1);
  });

  it('does not poll while the app is in the background', async () => {
    renderHook(() => useBinanceDepositState());
    await flush();
    const callsAfterMount = service.getState.mock.calls.length;
    visibilityMock.getCurrentVisibilityState.mockReturnValue(false);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS * 3,
      );
    });
    expect(service.getState.mock.calls.length).toBe(callsAfterMount);
  });

  it('stops polling when the page loses focus and refreshes when it is back', async () => {
    const { rerender } = renderHook(() => useBinanceDepositState());
    await flush();

    mockedUseRouteIsFocused.mockReturnValue(false);
    rerender();
    await flush();
    const callsWhileCovered = service.getState.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS * 3,
      );
    });
    expect(service.getState.mock.calls.length).toBe(callsWhileCovered);

    mockedUseRouteIsFocused.mockReturnValue(true);
    rerender();
    await flush();
    expect(service.getState.mock.calls.length).toBe(callsWhileCovered + 1);
  });

  it('retries pending reports every time the app returns to the foreground', async () => {
    renderHook(() => useBinanceDepositState());
    await flush();
    expect(service.retryPendingReports).toHaveBeenCalledTimes(1);

    act(() => emitVisibility(false));
    await flush();
    expect(service.retryPendingReports).toHaveBeenCalledTimes(1);

    act(() => emitVisibility(true));
    await flush();
    expect(service.retryPendingReports).toHaveBeenCalledTimes(2);
    expect(mockedRecover).not.toHaveBeenCalled();
  });

  it('runs the return fallback only while a session still waits for its return', async () => {
    service.getState.mockResolvedValue(
      buildState(buildSession({ linkOpenedAt: 5, awaitingReturn: true })),
    );
    renderHook(() => useBinanceDepositState());
    await flush();
    expect(mockedRecover).toHaveBeenCalledTimes(1);

    act(() => emitVisibility(true));
    await flush();
    expect(mockedRecover).toHaveBeenCalledTimes(2);

    // A return was accepted: the fallback has nothing left to do.
    service.getState.mockResolvedValue(
      buildState(
        buildSession({
          linkOpenedAt: 5,
          awaitingReturn: true,
          returnReceivedAt: 6,
        }),
      ),
    );
    act(() => emitVisibility(true));
    await flush();
    expect(mockedRecover).toHaveBeenCalledTimes(2);

    service.getState.mockResolvedValue(
      buildState(buildSession({ linkOpenedAt: 5, awaitingReturn: false })),
    );
    act(() => emitVisibility(true));
    await flush();
    expect(mockedRecover).toHaveBeenCalledTimes(2);
  });

  it('swallows a failing fallback and still refreshes', async () => {
    service.getState.mockResolvedValue(
      buildState(buildSession({ linkOpenedAt: 5, awaitingReturn: true })),
    );
    mockedRecover.mockRejectedValue(new Error('linking failed'));
    const { result } = renderHook(() => useBinanceDepositState());
    await flush();

    expect(mockedRecover).toHaveBeenCalledTimes(1);
    expect(result.current.state?.active?.awaitingReturn).toBe(true);
    expect(result.current.isStateUnavailable).toBe(false);
  });

  it('flags an unreadable state without throwing and recovers on the next read', async () => {
    service.getState.mockRejectedValue(new Error('bridge down'));
    service.retryPendingReports.mockRejectedValue(new Error('bridge down'));
    const { result } = renderHook(() => useBinanceDepositState());
    await flush();
    expect(result.current.isStateUnavailable).toBe(true);
    expect(result.current.state).toBeUndefined();

    service.getState.mockResolvedValue(buildState(buildSession()));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS,
      );
    });
    expect(result.current.isStateUnavailable).toBe(false);
    expect(result.current.state?.active?.localId).toBe('local-id-0001');
  });

  it('keeps the event array identity while the buffer is unchanged', async () => {
    const events = [{ ts: 1, step: 'createStart' }];
    service.getState.mockImplementation(async () => ({
      active: undefined,
      recent: [],
      events: [...events],
    }));
    const { result } = renderHook(() => useBinanceDepositState());
    await flush();
    const first = result.current.state?.events;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS,
      );
    });
    expect(result.current.state?.events).toBe(first);

    events.push({ ts: 2, step: 'createResult' });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS,
      );
    });
    expect(result.current.state?.events).not.toBe(first);
    expect(result.current.state?.events).toHaveLength(2);
  });
});
