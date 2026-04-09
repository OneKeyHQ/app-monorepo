/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { useRecommendedRefreshSwapEvents } from './useRecommendedRefreshSwapEvents';

describe('useRecommendedRefreshSwapEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes immediately when swap success arrives', () => {
    const scheduleRecommendedRefresh = jest.fn();

    renderHook(() =>
      useRecommendedRefreshSwapEvents({
        enableFetch: true,
        scheduleRecommendedRefresh,
      }),
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
      });
    });

    expect(scheduleRecommendedRefresh).toHaveBeenCalledWith({
      source: 'app-event',
    });
  });

  it('ignores non-final swap statuses', () => {
    const scheduleRecommendedRefresh = jest.fn();

    renderHook(() =>
      useRecommendedRefreshSwapEvents({
        enableFetch: true,
        scheduleRecommendedRefresh,
      }),
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.PENDING,
      });
    });

    expect(scheduleRecommendedRefresh).not.toHaveBeenCalled();
  });
});
