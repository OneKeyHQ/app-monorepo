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
});
