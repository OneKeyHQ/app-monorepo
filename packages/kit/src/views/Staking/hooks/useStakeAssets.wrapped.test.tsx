/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type {
  IEarnAssetsList,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { useStakeAssets } from './useStakeAssets';

const mockAssets = jest.fn<Promise<IEarnAssetsList>, [unknown]>();
const mockToken = jest.fn<Promise<IFetchTokenDetailItem[]>, [unknown]>();
const mockWaitForFinal = jest.fn<
  Promise<EOnChainHistoryTxStatus | undefined>,
  [unknown]
>();

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: (params: unknown) => mockWaitForFinal(params),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: { getEarnAssetsList: (p: unknown) => mockAssets(p) },
    serviceToken: { fetchTokensDetails: (p: unknown) => mockToken(p) },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useDeferredPromise: jest.requireActual(
    '../../../../../components/src/hooks/useDeferredPromise',
  ).useDeferredPromise,
  useNetInfo: jest.requireActual(
    '../../../../../components/src/hooks/useNetInfo',
  ).useNetInfo,
}));

const eth: IEarnTokenItem = {
  info: {
    symbol: 'ETH',
    name: 'Ether',
    address: '',
    decimals: 18,
    isNative: true,
  },
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: '0',
  price24h: '0',
};
const weth: IFetchTokenDetailItem = {
  info: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: EthereumWETH,
    decimals: 18,
    isNative: false,
  },
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: 0,
};
const params = {
  enabled: true,
  accountId: 'account-a',
  networkId: 'evm--1',
  providerName: 'etherfi',
  symbol: 'ETH',
  vault: 'vault',
  nativeWrapSelectedRef: { current: false },
};

describe('EtherFi wrapped token metadata', () => {
  beforeEach(() => {
    mockAssets.mockReset();
    mockToken.mockReset();
    mockWaitForFinal.mockReset();
  });

  it('keeps ETH selectable while independently loading WETH omitted from the input list', async () => {
    mockAssets.mockResolvedValue({ assets: [eth] });
    let finish: (items: IFetchTokenDetailItem[]) => void = () => undefined;
    mockToken.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useStakeAssets(params));
    await waitFor(() => expect(mockToken).toHaveBeenCalledTimes(1));
    expect(result.current.result?.assets).toEqual([eth]);
    expect(result.current.isWrappedTokenLoading).toBe(true);
    expect(result.current.wrappedToken).toBeUndefined();
    expect(mockToken).toHaveBeenCalledWith({
      accountId: 'account-a',
      networkId: 'evm--1',
      contractList: [EthereumWETH],
    });
    await act(async () => finish([weth]));
    await waitFor(() => expect(result.current.wrappedToken).toEqual(weth.info));
  });

  it.each([
    { ...weth.info, address: '0xwrong' },
    { ...weth.info, decimals: 6 },
    { ...weth.info, isNative: true },
    { ...weth.info, networkId: 'evm--10' },
  ])('rejects mismatched wrapped token metadata', async (info) => {
    mockAssets.mockResolvedValue({ assets: [eth] });
    mockToken.mockResolvedValue([{ ...weth, info }]);
    const { result } = renderHook(() => useStakeAssets(params));
    await waitFor(() => expect(result.current.wrappedTokenError).toBe(true));
    expect(result.current.wrappedToken).toBeUndefined();
    expect(result.current.result?.assets).toEqual([eth]);
  });

  it('does not expose a delayed token from the previous account', async () => {
    mockAssets.mockResolvedValue({ assets: [eth] });
    let finish: (items: IFetchTokenDetailItem[]) => void = () => undefined;
    mockToken.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mockToken.mockRejectedValue(new Error('offline'));
    const { result, rerender } = renderHook(
      (p: typeof params) => useStakeAssets(p),
      { initialProps: params },
    );
    await waitFor(() => expect(mockToken).toHaveBeenCalledTimes(1));
    rerender({ ...params, accountId: 'account-b' });
    await waitFor(() => expect(result.current.wrappedTokenError).toBe(true));
    await act(async () => finish([weth]));
    expect(result.current.wrappedToken).toBeUndefined();
  });

  it('allows a failed metadata request to be retried without hiding the input list', async () => {
    mockAssets.mockResolvedValue({ assets: [eth] });
    mockToken
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([weth]);
    const { result } = renderHook(() => useStakeAssets(params));
    await waitFor(() => expect(result.current.wrappedTokenError).toBe(true));
    expect(result.current.result?.assets).toEqual([eth]);
    await act(async () => result.current.retryWrappedToken());
    await waitFor(() => expect(result.current.wrappedToken).toEqual(weth.info));
  });

  it('does not reuse EtherFi assets after a failed refresh', async () => {
    mockAssets.mockResolvedValueOnce({ assets: [eth] });
    mockAssets.mockRejectedValueOnce(new Error('offline'));
    mockToken.mockResolvedValue([weth]);
    const { result } = renderHook(() => useStakeAssets(params));
    await waitFor(() => expect(result.current.result?.status).toBe('success'));
    await act(async () => result.current.run());
    await waitFor(() => expect(result.current.result?.status).toBe('error'));
    expect(result.current.result?.assets).toEqual([]);
  });

  it('does not supplement canonical WETH for Native asset lists', async () => {
    mockAssets.mockResolvedValue({ assets: [eth] });
    const { result } = renderHook(() =>
      useStakeAssets({ ...params, providerName: 'native' }),
    );
    await waitFor(() => expect(result.current.result?.status).toBe('success'));
    expect(mockToken).not.toHaveBeenCalled();
  });

  it('does not request WETH when the ETH entry is absent', async () => {
    mockAssets.mockResolvedValue({ assets: [] });
    const { result } = renderHook(() => useStakeAssets(params));
    await waitFor(() => expect(result.current.result?.status).toBe('success'));
    expect(mockToken).not.toHaveBeenCalled();
    expect(result.current.wrappedToken).toBeUndefined();
  });
});

describe('stake asset reconciliation after submission', () => {
  beforeEach(() => {
    mockAssets.mockReset().mockResolvedValue({ assets: [] });
    mockToken.mockReset();
    mockWaitForFinal.mockReset();
  });

  it.each([EOnChainHistoryTxStatus.Success, EOnChainHistoryTxStatus.Failed])(
    'refreshes after a submitted transaction reaches %s without a history event',
    async (status) => {
      mockWaitForFinal.mockResolvedValue(status);
      const view = renderHook(() => useStakeAssets(params));
      await waitFor(() =>
        expect(view.result.current.result?.status).toBe('success'),
      );
      jest.useFakeTimers();
      try {
        await act(async () => {
          view.result.current.trackSubmittedTransaction('tx-1', '0xaccount');
          await Promise.resolve();
        });
        expect(mockWaitForFinal).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 'account-a',
            networkId: 'evm--1',
            txid: 'tx-1',
            expectedAccountAddress: '0xaccount',
            signal: expect.any(AbortSignal),
          }),
        );
        await act(async () => {
          await jest.advanceTimersByTimeAsync(3000);
        });
        expect(mockAssets).toHaveBeenCalledTimes(2);
        expect(mockAssets).toHaveBeenLastCalledWith(
          expect.objectContaining({ forceRefresh: true }),
        );
        await act(async () => {
          await jest.advanceTimersByTimeAsync(7000);
        });
        expect(mockAssets).toHaveBeenCalledTimes(3);
      } finally {
        view.unmount();
        jest.useRealTimers();
      }
    },
  );

  it('does not refresh on timeout and permits later history confirmation', async () => {
    mockWaitForFinal.mockResolvedValue(undefined);
    const view = renderHook(() => useStakeAssets(params));
    await waitFor(() =>
      expect(view.result.current.result?.status).toBe('success'),
    );
    jest.useFakeTimers();
    try {
      await act(async () => {
        view.result.current.trackSubmittedTransaction('tx-1');
        await Promise.resolve();
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(mockAssets).toHaveBeenCalledTimes(1);
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
          accountId: 'account-a',
          networkId: 'evm--1',
          txid: 'tx-1',
          status: EDecodedTxStatus.Confirmed,
        });
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3000);
      });
      expect(mockAssets).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('deduplicates direct polling and the matching confirmation event', async () => {
    let finish: (value: EOnChainHistoryTxStatus) => void = () => undefined;
    mockWaitForFinal.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = renderHook(() => useStakeAssets(params));
    await waitFor(() =>
      expect(view.result.current.result?.status).toBe('success'),
    );
    jest.useFakeTimers();
    try {
      act(() => {
        view.result.current.trackSubmittedTransaction('tx-1');
        view.result.current.trackSubmittedTransaction('tx-1');
        appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
          accountId: 'account-a',
          networkId: 'evm--1',
          txid: 'tx-1',
          status: EDecodedTxStatus.Confirmed,
        });
      });
      expect(mockWaitForFinal).toHaveBeenCalledTimes(1);
      await act(async () => finish(EOnChainHistoryTxStatus.Success));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(mockAssets).toHaveBeenCalledTimes(3);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('aborts and discards a late confirmation after switching account', async () => {
    let finish: (value: EOnChainHistoryTxStatus) => void = () => undefined;
    mockWaitForFinal.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = renderHook((p: typeof params) => useStakeAssets(p), {
      initialProps: params,
    });
    await waitFor(() =>
      expect(view.result.current.result?.status).toBe('success'),
    );
    jest.useFakeTimers();
    try {
      act(() => view.result.current.trackSubmittedTransaction('tx-1'));
      const call = mockWaitForFinal.mock.calls[0][0] as { signal: AbortSignal };
      view.rerender({ ...params, accountId: 'account-b' });
      expect(call.signal.aborted).toBe(true);
      await act(async () => finish(EOnChainHistoryTxStatus.Success));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(mockAssets).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('aborts an outstanding observation when the hook unmounts', async () => {
    let finish: (value: EOnChainHistoryTxStatus) => void = () => undefined;
    mockWaitForFinal.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = renderHook(() => useStakeAssets(params));
    await waitFor(() =>
      expect(view.result.current.result?.status).toBe('success'),
    );
    jest.useFakeTimers();
    try {
      act(() => view.result.current.trackSubmittedTransaction('tx-1'));
      const call = mockWaitForFinal.mock.calls[0][0] as { signal: AbortSignal };
      view.unmount();
      expect(call.signal.aborted).toBe(true);
      await act(async () => finish(EOnChainHistoryTxStatus.Success));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(mockAssets).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
