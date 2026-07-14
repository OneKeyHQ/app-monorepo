/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ITradingViewChartMigration } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAppStatus';

import { useChartMigration } from './useChartMigration';
import { CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS } from './utils';

type IChartMigrationResult = {
  migration?: ITradingViewChartMigration;
  blob?: Record<string, string>;
};

const mockGetTradingViewChartMigration = jest.fn<
  Promise<IChartMigrationResult>,
  []
>();
let mockDesktopOfflineChartReady = true;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      getTradingViewChartMigration: () => mockGetTradingViewChartMigration(),
    },
  },
}));

jest.mock('../utils/desktopOfflineChartReady', () => ({
  useDesktopOfflineChartReady: () => mockDesktopOfflineChartReady,
}));

describe('useChartMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDesktopOfflineChartReady = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('advances export, restore, and completion in the same mount', async () => {
    mockGetTradingViewChartMigration.mockResolvedValue({
      migration: { state: 'export-deferred' },
    });
    const { result } = renderHook(() => useChartMigration());

    await waitFor(() => expect(result.current.phase).toBe('export'));

    act(() => {
      result.current.handleExported({ tradingview_layout: 'saved-layout' });
    });
    expect(result.current.phase).toBe('restore');
    expect(result.current.blob).toEqual({
      tradingview_layout: 'saved-layout',
    });
    expect(result.current.restoreAttemptCount).toBe(0);

    act(() => {
      result.current.handleRestored();
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.blob).toBeUndefined();
  });

  it('loads the persisted restore attempt count', async () => {
    mockGetTradingViewChartMigration.mockResolvedValue({
      migration: { state: 'restore-pending', restoreAttemptCount: 2 },
      blob: { tradingview_layout: 'saved-layout' },
    });
    const { result } = renderHook(() => useChartMigration());

    await waitFor(() => expect(result.current.phase).toBe('restore'));

    expect(result.current.restoreAttemptCount).toBe(2);
  });

  it('backs off a persisted restore retry across launches', async () => {
    jest.useFakeTimers();
    const now = 100_000;
    jest.setSystemTime(now);
    mockGetTradingViewChartMigration.mockResolvedValue({
      migration: {
        state: 'restore-pending',
        restoreAttemptCount: 3,
        lastRestoreAttemptAt: now,
      },
      blob: { tradingview_layout: 'saved-layout' },
    });
    const { result } = renderHook(() => useChartMigration());

    await act(async () => Promise.resolve());
    expect(result.current.phase).toBe('idle');

    act(() => {
      jest.advanceTimersByTime(
        CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS - 1,
      );
    });
    expect(result.current.phase).toBe('idle');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.phase).toBe('restore');
    expect(result.current.restoreAttemptCount).toBe(3);
  });

  it('does not enter restore when the exported storage is empty', async () => {
    mockGetTradingViewChartMigration.mockResolvedValue({
      migration: { state: 'export-deferred' },
    });
    const { result } = renderHook(() => useChartMigration());

    await waitFor(() => expect(result.current.phase).toBe('export'));

    act(() => {
      result.current.handleExported({});
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.blob).toBeUndefined();
  });

  it('starts after desktop offline readiness is published', async () => {
    mockDesktopOfflineChartReady = false;
    mockGetTradingViewChartMigration.mockResolvedValue({
      migration: { state: 'export-deferred' },
    });
    const { result, rerender } = renderHook(() => useChartMigration());

    expect(result.current.phase).toBe('idle');
    expect(mockGetTradingViewChartMigration).not.toHaveBeenCalled();

    mockDesktopOfflineChartReady = true;
    rerender();

    await waitFor(() => expect(result.current.phase).toBe('export'));
    expect(mockGetTradingViewChartMigration).toHaveBeenCalledTimes(1);
  });
});
