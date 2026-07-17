/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { fetchMarketKLineDataWithSlicing } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { useTradingViewNativeKLine } from './useTradingViewNativeKLine';

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData',
  () => ({
    fetchMarketKLineDataWithSlicing: jest.fn(),
  }),
);

const mockFetchMarketKLineDataWithSlicing =
  fetchMarketKLineDataWithSlicing as jest.MockedFunction<
    typeof fetchMarketKLineDataWithSlicing
  >;

function buildResponse(close: number): IMarketTokenKLineResponse {
  return {
    points: [
      {
        o: close,
        h: close + 1,
        l: close - 1,
        c: close,
        v: 10,
        t: close,
      },
    ],
    total: 1,
  };
}

function createDeferredResponse() {
  let resolve: (value: IMarketTokenKLineResponse | null) => void = () =>
    undefined;
  const promise = new Promise<IMarketTokenKLineResponse | null>(
    (promiseResolve) => {
      resolve = promiseResolve;
    },
  );
  return { promise, resolve };
}

describe('useTradingViewNativeKLine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the previous candles until a non-empty interval response arrives', async () => {
    const initialRequest = createDeferredResponse();
    const intervalRequest = createDeferredResponse();
    mockFetchMarketKLineDataWithSlicing
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(intervalRequest.promise);

    const { result } = renderHook(() =>
      useTradingViewNativeKLine({
        networkId: 'evm--1',
        tokenAddress: '0x123',
      }),
    );

    await act(async () => {
      initialRequest.resolve(buildResponse(100));
      await initialRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(100));

    act(() => result.current.handleIntervalChange('1'));
    await waitFor(() =>
      expect(mockFetchMarketKLineDataWithSlicing).toHaveBeenCalledTimes(2),
    );
    expect(result.current.points[0]?.c).toBe(100);
    expect(result.current.intervalConfig.activeInterval).toBe('1');
    expect(result.current.isSwitchingInterval).toBe(true);

    await act(async () => {
      intervalRequest.resolve({ points: [], total: 0 });
      await intervalRequest.promise;
    });
    await waitFor(() =>
      expect(result.current.intervalConfig.activeInterval).toBe('60'),
    );
    expect(result.current.points[0]?.c).toBe(100);
    expect(result.current.isSwitchingInterval).toBe(false);
  });

  it('hides another token immediately and ignores an obsolete response', async () => {
    const firstRequest = createDeferredResponse();
    const secondRequest = createDeferredResponse();
    mockFetchMarketKLineDataWithSlicing
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({ tokenAddress }: { tokenAddress: string }) =>
        useTradingViewNativeKLine({
          networkId: 'evm--1',
          tokenAddress,
        }),
      { initialProps: { tokenAddress: '0x123' } },
    );

    rerender({ tokenAddress: '0x456' });
    expect(result.current.points).toEqual([]);

    await act(async () => {
      secondRequest.resolve(buildResponse(200));
      await secondRequest.promise;
    });
    await waitFor(() => expect(result.current.points[0]?.c).toBe(200));

    await act(async () => {
      firstRequest.resolve(buildResponse(100));
      await firstRequest.promise;
    });
    expect(result.current.points[0]?.c).toBe(200);
  });
});
