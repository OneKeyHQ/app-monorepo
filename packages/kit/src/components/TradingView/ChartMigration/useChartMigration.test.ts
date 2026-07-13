/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ITradingViewChartMigration } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAppStatus';

import { useChartMigration } from './useChartMigration';

type IChartMigrationResult = {
  migration?: ITradingViewChartMigration;
  blob?: Record<string, string>;
};

const mockGetTradingViewChartMigration = jest.fn<
  Promise<IChartMigrationResult>,
  []
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      getTradingViewChartMigration: () => mockGetTradingViewChartMigration(),
    },
  },
}));

jest.mock('./utils', () => ({
  ...jest.requireActual<typeof import('./utils')>('./utils'),
  isChartMigrationEffectivelyOffline: () => true,
}));

describe('useChartMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
