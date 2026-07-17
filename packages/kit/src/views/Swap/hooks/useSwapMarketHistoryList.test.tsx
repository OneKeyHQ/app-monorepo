/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import {
  SWAP_HISTORY_PREVIEW_SWR_KEY,
  useSwapMarketHistoryList,
} from './useSwapMarketHistoryList';

const mockRun = jest.fn(() => Promise.resolve());
const mockUsePromiseResult = jest.fn<
  {
    result: ISwapTxHistory[];
    isLoading: boolean;
    run: typeof mockRun;
  },
  unknown[]
>();
let mockShouldShowSwapLocalData = true;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapHistoryListFromSimple: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (...args: unknown[]) => mockUsePromiseResult(...args),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  filterSwapHistoryPendingList: (items: unknown[]) => items.filter(Boolean),
  useInAppNotificationAtom: () => [{ swapHistoryPendingList: [] }],
}));

jest.mock('./useSwapLocalDataVisibility', () => ({
  useShouldShowSwapLocalData: () => mockShouldShowSwapLocalData,
}));

const cachedHistory = {
  protocol: EProtocolOfExchange.STOCK,
} as ISwapTxHistory;

describe('useSwapMarketHistoryList', () => {
  beforeEach(() => {
    mockRun.mockClear();
    mockUsePromiseResult.mockReset();
    mockUsePromiseResult.mockReturnValue({
      result: [cachedHistory],
      isLoading: false,
      run: mockRun,
    });
    mockShouldShowSwapLocalData = true;
  });

  it('retains the shared preview list across tab remounts and revalidates it', () => {
    const { result } = renderHook(() =>
      useSwapMarketHistoryList(EProtocolOfExchange.STOCK),
    );

    expect(result.current.swapTxHistoryList).toEqual([cachedHistory]);
    expect(mockUsePromiseResult).toHaveBeenCalledWith(
      expect.any(Function),
      ['', true],
      expect.objectContaining({
        swrKey: SWAP_HISTORY_PREVIEW_SWR_KEY,
        watchLoading: true,
      }),
    );
    const options = mockUsePromiseResult.mock.calls[0]?.[2] as {
      overrideIsFocused?: (isFocused: boolean) => boolean;
    };
    expect(options.overrideIsFocused?.(false)).toBe(true);
  });

  it('refreshes after a finished-history clear and never exposes cache while local data is gated', () => {
    const { result, rerender } = renderHook(() =>
      useSwapMarketHistoryList(EProtocolOfExchange.STOCK),
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.RefreshSwapHistoryList, undefined);
    });
    expect(mockRun).toHaveBeenCalledWith({ alwaysSetState: true });

    mockShouldShowSwapLocalData = false;
    rerender();
    expect(result.current.swapTxHistoryList).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockUsePromiseResult).toHaveBeenLastCalledWith(
      expect.any(Function),
      ['', false],
      expect.objectContaining({ swrKey: undefined }),
    );

    mockShouldShowSwapLocalData = true;
    rerender();
    expect(mockUsePromiseResult).toHaveBeenLastCalledWith(
      expect.any(Function),
      ['', true],
      expect.objectContaining({ swrKey: SWAP_HISTORY_PREVIEW_SWR_KEY }),
    );
  });
});
