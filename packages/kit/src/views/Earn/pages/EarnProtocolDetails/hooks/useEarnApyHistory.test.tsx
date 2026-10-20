/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

if (typeof globalThis.requestIdleCallback === 'undefined') {
  (
    globalThis as unknown as {
      requestIdleCallback: (cb: () => void) => ReturnType<typeof setTimeout>;
    }
  ).requestIdleCallback = (cb) => setTimeout(cb, 0);
}

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../../../../../components/src/hooks/useDeferredPromise');
  const netInfoModule = require('../../../../../../../components/src/hooks/useNetInfo');
  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: netInfoModule.useNetInfo,
  };
});

type IHistoryResponse = {
  results: { timestamp: number; impliedApy: string; underlyingApy: string }[];
  hasNonZeroUnderlyingApy: boolean;
};

const mockGetUnderlyingApyHistory = jest.fn<
  Promise<IHistoryResponse>,
  [{ vault: string }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getUnderlyingApyHistory: (params: { vault: string }) =>
        mockGetUnderlyingApyHistory(params),
      getApyHistory: jest.fn(),
    },
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useEarnApyHistory } from './useEarnApyHistory';

function deferred() {
  let resolve: (value: IHistoryResponse) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<IHistoryResponse>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  // A request a test never makes must not fail the run as unhandled.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function historyOf(impliedApy: string): IHistoryResponse {
  return {
    results: [{ timestamp: 1, impliedApy, underlyingApy: '4' }],
    hasNonZeroUnderlyingApy: true,
  };
}

const marketA = {
  networkId: 'evm--1',
  symbol: 'sUSDe',
  provider: 'pendle',
  vault: '0xaaa',
};
const marketB = { ...marketA, symbol: 'USDG', vault: '0xbbb' };

describe('useEarnApyHistory', () => {
  let requests: Record<string, ReturnType<typeof deferred>>;

  beforeEach(() => {
    requests = { '0xaaa': deferred(), '0xbbb': deferred() };
    mockGetUnderlyingApyHistory.mockImplementation(
      ({ vault }) => requests[vault].promise,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('drops the previous market’s history while the next one loads', async () => {
    const { result, rerender } = renderHook(
      (props: typeof marketA) => useEarnApyHistory(props),
      { initialProps: marketA },
    );
    await act(async () => {
      requests['0xaaa'].resolve(historyOf('5.09'));
    });
    await waitFor(() =>
      expect(result.current.chartData?.impliedApyHistory?.[0]?.apy).toBe(
        '5.09',
      ),
    );

    rerender(marketB);
    expect(result.current.chartData).toBeUndefined();
    expect(result.current.isChartLoading).toBe(true);

    await act(async () => {
      requests['0xbbb'].resolve(historyOf('7.2'));
    });
    await waitFor(() =>
      expect(result.current.chartData?.impliedApyHistory?.[0]?.apy).toBe('7.2'),
    );
    expect(result.current.isChartLoading).toBe(false);
  });

  it('settles to no history when the next market’s request ends without data', async () => {
    const { result, rerender } = renderHook(
      (props: typeof marketA) => useEarnApyHistory(props),
      { initialProps: marketA },
    );
    await act(async () => {
      requests['0xaaa'].resolve(historyOf('5.09'));
    });
    await waitFor(() => expect(result.current.chartData).toBeDefined());

    rerender(marketB);
    await waitFor(() =>
      expect(mockGetUnderlyingApyHistory).toHaveBeenCalledWith(
        expect.objectContaining({ vault: '0xbbb' }),
      ),
    );
    // usePromiseResult re-throws any other error after settling it, which
    // fails a Jest run; a cancelled request settles the same way without it.
    await act(async () => {
      requests['0xbbb'].reject(new DOMException('cancelled', 'AbortError'));
    });
    await waitFor(() => expect(result.current.isChartLoading).toBe(false));
    expect(result.current.chartData).toBeUndefined();
  });
});
