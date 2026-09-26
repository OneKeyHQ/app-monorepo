/* eslint-disable import/first */

const mockRouteFocus = { current: true };
const mockGetStatus = jest.fn<Promise<IBorrowEModeStatus>, unknown[]>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocus.current,
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/swrCacheUtils')
  >('@onekeyhq/shared/src/utils/swrCacheUtils'),
  swrCacheUtils: { getWithTimestamp: jest.fn(), set: jest.fn() },
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowEModeStatus: (...args: unknown[]) => mockGetStatus(...args),
    },
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { useBorrowEModeStatus } from './useBorrowEModeStatus';

const status: IBorrowEModeStatus = {
  eModeId: 0,
  originalLtv: '80',
  categories: [],
};

function renderStatus() {
  return renderHook(
    ({ revalidateOnFocus }: { revalidateOnFocus: boolean }) =>
      useBorrowEModeStatus({
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMarket',
        accountId: 'account-1',
        revalidateOnFocus,
      }),
    { initialProps: { revalidateOnFocus: true } },
  );
}

describe('useBorrowEModeStatus with real request and focus state', () => {
  beforeEach(() => {
    mockRouteFocus.current = true;
    mockGetStatus.mockReset();
    mockGetStatus.mockResolvedValue(status);
    jest.mocked(swrCacheUtils.getWithTimestamp).mockReset();
    jest.mocked(swrCacheUtils.set).mockReset();
  });

  it('publishes a 61-second persisted status while refreshing it in the background', async () => {
    const params = {
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: '0xMarket',
      accountId: 'account-1',
    };
    const swrKey = swrKeys.borrowEModeStatus(params);
    jest.mocked(swrCacheUtils.getWithTimestamp).mockImplementation((key) =>
      key === swrKey
        ? {
            data: {
              scopeKey: JSON.stringify([
                params.networkId,
                params.provider,
                params.marketAddress,
                params.accountId,
                true,
              ]),
              eModeStatus: status,
              state: 'resolved',
              resolvedAt: Date.now() - 60_001,
            },
            updatedAt: Date.now() - 60_001,
          }
        : undefined,
    );
    let resolveStatus!: (value: IBorrowEModeStatus) => void;
    mockGetStatus.mockReturnValueOnce(
      new Promise<IBorrowEModeStatus>((resolve) => {
        resolveStatus = resolve;
      }),
    );

    const view = renderHook(() =>
      useBorrowEModeStatus({ ...params, isPreloading: true }),
    );
    expect(view.result.current.eModeStatus).toEqual(status);
    expect(view.result.current.isReadyForMarketSwitch).toBe(true);
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(1));
    expect(view.result.current.eModeStatus).toEqual(status);
    expect(view.result.current.isReadyForMarketSwitch).toBe(true);

    await act(async () => resolveStatus({ ...status, eModeId: 1 }));
    await waitFor(() =>
      expect(view.result.current.isReadyForMarketSwitch).toBe(true),
    );
    expect(view.result.current.eModeStatus?.eModeId).toBe(1);
    view.unmount();
  });

  it('skips only the picker return, then preserves cached data if ordinary refocus fails', async () => {
    const view = renderStatus();
    await waitFor(() =>
      expect(view.result.current.eModeStatus).toEqual(status),
    );
    expect(mockGetStatus).toHaveBeenCalledTimes(1);

    mockRouteFocus.current = false;
    view.rerender({ revalidateOnFocus: true });
    mockRouteFocus.current = true;
    view.rerender({ revalidateOnFocus: false });
    view.rerender({ revalidateOnFocus: true });
    expect(mockGetStatus).toHaveBeenCalledTimes(1);
    expect(view.result.current.isLoading).toBe(false);

    mockGetStatus.mockRejectedValueOnce(new Error('offline'));
    mockRouteFocus.current = false;
    view.rerender({ revalidateOnFocus: true });
    mockRouteFocus.current = true;
    view.rerender({ revalidateOnFocus: true });
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
    expect(view.result.current.eModeStatus).toEqual(status);
  });

  it('commits an explicit picker reconciliation refresh even while the parent route is blurred', async () => {
    const view = renderStatus();
    await waitFor(() =>
      expect(view.result.current.eModeStatus).toEqual(status),
    );
    mockRouteFocus.current = false;
    view.rerender({ revalidateOnFocus: true });
    let resolveStatus!: (value: IBorrowEModeStatus) => void;
    mockGetStatus.mockReturnValueOnce(
      new Promise<IBorrowEModeStatus>((resolve) => {
        resolveStatus = resolve;
      }),
    );
    let refresh!: Promise<void>;
    act(() => {
      refresh = view.result.current.refresh();
    });
    expect(view.result.current.isLoading).toBe(true);
    expect(view.result.current.eModeStatus).toEqual(status);

    await act(async () => {
      resolveStatus({ ...status, eModeId: 1 });
      await refresh;
    });
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.eModeStatus?.eModeId).toBe(1);
    mockRouteFocus.current = true;
    view.rerender({ revalidateOnFocus: false });
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
  });

  it('starts an explicit refresh while the foreground is joining a preloading request', async () => {
    let resolvePreload!: (value: IBorrowEModeStatus) => void;
    let resolveRefresh!: (value: IBorrowEModeStatus) => void;
    mockGetStatus
      .mockReturnValueOnce(
        new Promise<IBorrowEModeStatus>((resolve) => {
          resolvePreload = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<IBorrowEModeStatus>((resolve) => {
          resolveRefresh = resolve;
        }),
      );
    const preload = renderHook(() =>
      useBorrowEModeStatus({
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMarket',
        accountId: 'account-1',
        isPreloading: true,
      }),
    );
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(1));
    const foreground = renderStatus();
    await waitFor(() => expect(foreground.result.current.isLoading).toBe(true));
    expect(mockGetStatus).toHaveBeenCalledTimes(1);

    let refresh!: Promise<void>;
    act(() => {
      refresh = foreground.result.current.refresh();
    });
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(2));
    preload.unmount();
    await act(async () => {
      resolvePreload(status);
      resolveRefresh({ ...status, eModeId: 1 });
      await refresh;
    });
    expect(foreground.result.current.eModeStatus?.eModeId).toBe(1);
    foreground.unmount();
  });

  it('retries the visible scope after an in-place account update without publishing the cancelled request', async () => {
    const view = renderStatus();
    await waitFor(() =>
      expect(view.result.current.eModeStatus).toEqual(status),
    );

    let resolveOld!: (value: IBorrowEModeStatus) => void;
    mockGetStatus
      .mockReturnValueOnce(
        new Promise<IBorrowEModeStatus>((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce({ ...status, eModeId: 1 });
    let oldRefresh!: Promise<void>;
    act(() => {
      oldRefresh = view.result.current.refresh();
    });
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(2));

    act(() => {
      appEventBus.emitToSelf({
        type: EAppEventBusNames.AccountUpdate,
        payload: undefined,
      });
    });
    expect(view.result.current).toMatchObject({
      eModeStatus: null,
      isInitialLoading: true,
      isError: false,
    });
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(view.result.current.eModeStatus?.eModeId).toBe(1),
    );

    await act(async () => {
      resolveOld({ ...status, eModeId: 2 });
      await oldRefresh;
    });
    expect(view.result.current.eModeStatus?.eModeId).toBe(1);
    expect(view.result.current.isError).toBe(false);
    view.unmount();
  });
});
