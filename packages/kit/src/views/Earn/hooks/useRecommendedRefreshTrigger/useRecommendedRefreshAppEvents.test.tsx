/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useRecommendedRefreshAppEvents } from './useRecommendedRefreshAppEvents';

describe('useRecommendedRefreshAppEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes on the dedicated earn recommended event', () => {
    const scheduleRecommendedRefresh = jest.fn();

    renderHook(() =>
      useRecommendedRefreshAppEvents({
        accountId: 'hd-1',
        networkId: 'onekeyall',
        enableFetch: true,
        shouldRefreshByAccounts: jest.fn(() => true),
        scheduleRecommendedRefresh,
      }),
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.RefreshEarnRecommendedList, undefined);
    });

    expect(scheduleRecommendedRefresh).toHaveBeenCalledWith({
      source: 'app-event',
    });
  });

  it('ignores RefreshTokenList events when the changed accounts are out of scope', () => {
    const scheduleRecommendedRefresh = jest.fn();
    const shouldRefreshByAccounts = jest.fn(() => false);

    renderHook(() =>
      useRecommendedRefreshAppEvents({
        accountId: 'hd-1',
        networkId: 'onekeyall',
        enableFetch: true,
        shouldRefreshByAccounts,
        scheduleRecommendedRefresh,
      }),
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
        accounts: [
          {
            accountId: 'other-account',
            networkId: 'evm--1',
          },
        ],
      });
    });

    expect(shouldRefreshByAccounts).toHaveBeenCalledWith([
      {
        accountId: 'other-account',
        networkId: 'evm--1',
      },
    ]);
    expect(scheduleRecommendedRefresh).not.toHaveBeenCalled();
  });
});
