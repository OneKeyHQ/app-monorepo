/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type {
  IEarnAssetsList,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';

import { useEarnWithdrawAssets } from './useEarnWithdrawAssets';

const mockGetAssets = jest.fn<Promise<IEarnAssetsList>, [unknown]>();
let mockFocused = true;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAssetsList: (request: unknown) => mockGetAssets(request),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => mockFocused,
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

const asset: IEarnTokenItem = {
  info: {
    symbol: 'USDC',
    name: 'USDC',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    isNative: false,
  },
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: '1',
  price24h: '0',
};
const params = {
  enabled: true,
  accountId: 'account-1',
  networkId: 'evm--1',
  provider: 'etherfi',
  symbol: 'USDC',
  vault: '0xvault',
};

describe('withdraw output asset recovery', () => {
  beforeEach(() => {
    mockGetAssets.mockReset();
    mockFocused = true;
  });

  it('retries a failed request without enabling the old selection while loading', async () => {
    mockGetAssets.mockRejectedValueOnce(new Error('offline'));
    let resolveRetry:
      | ((value: { assets: IEarnTokenItem[] }) => void)
      | undefined;
    mockGetAssets.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
    );
    const { result } = renderHook(() => useEarnWithdrawAssets(params));
    await waitFor(() => expect(result.current.status).toBe('error'));
    let retry: Promise<void> | undefined;
    act(() => {
      retry = result.current.retry();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.selectedAsset).toBeUndefined();
    expect(result.current.status).toBeUndefined();
    await act(async () => {
      resolveRetry?.({ assets: [asset] });
      await retry;
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.selectedAsset?.info.symbol).toBe('USDC');
  });

  it('does not publish an old account response after switching accounts', async () => {
    let resolveOld: ((value: { assets: IEarnTokenItem[] }) => void) | undefined;
    mockGetAssets.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    mockGetAssets.mockResolvedValueOnce({ assets: [] });
    const { result, rerender } = renderHook(
      (props: typeof params) => useEarnWithdrawAssets(props),
      { initialProps: params },
    );
    await waitFor(() => expect(resolveOld).toBeDefined());
    rerender({ ...params, accountId: 'account-2' });
    await waitFor(() => expect(result.current.status).toBe('empty'));
    await act(async () => resolveOld?.({ assets: [asset] }));
    expect(result.current.status).toBe('empty');
    expect(result.current.selectedAsset).toBeUndefined();
  });

  it('does not reuse output assets after an unfocused account round trip', async () => {
    mockGetAssets.mockResolvedValueOnce({ assets: [asset] });
    const { result, rerender } = renderHook(
      (props: typeof params) => useEarnWithdrawAssets(props),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.selectedAsset).toEqual(asset);
    mockFocused = false;
    rerender({ ...params, accountId: 'account-2' });
    rerender(params);
    expect(result.current.status).toBeUndefined();
    expect(result.current.selectedAsset).toBeUndefined();
    expect(mockGetAssets).toHaveBeenCalledTimes(1);

    let finish: (value: IEarnAssetsList) => void = () => undefined;
    mockGetAssets.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mockFocused = true;
    rerender(params);
    await waitFor(() => expect(mockGetAssets).toHaveBeenCalledTimes(2));
    expect(result.current.selectedAsset).toBeUndefined();
    await act(async () => finish({ assets: [asset] }));
    expect(result.current.status).toBe('ready');
    expect(result.current.selectedAsset).toEqual(asset);
  });

  it('does not reuse output assets after being disabled and re-enabled while unfocused', async () => {
    mockGetAssets.mockResolvedValueOnce({ assets: [asset] });
    const { result, rerender } = renderHook(
      (props: typeof params) => useEarnWithdrawAssets(props),
      { initialProps: params },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    mockFocused = false;
    rerender({ ...params, enabled: false });
    rerender(params);
    expect(result.current.status).toBeUndefined();
    expect(result.current.selectedAsset).toBeUndefined();
  });

  it('does not retain an output token removed by a refreshed list', async () => {
    const usdt: IEarnTokenItem = {
      ...asset,
      info: {
        ...asset.info,
        symbol: 'USDT',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      },
    };
    mockGetAssets
      .mockResolvedValueOnce({ assets: [asset, usdt] })
      .mockResolvedValueOnce({ assets: [asset] });
    const { result } = renderHook(() => useEarnWithdrawAssets(params));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.selectAsset(usdt));
    expect(result.current.selectedAsset?.info.symbol).toBe('USDT');
    await act(async () => result.current.retry());
    expect(result.current.status).toBe('ready');
    expect(result.current.selectedAsset?.info.symbol).toBe('USDC');
    expect(result.current.assets).toEqual([asset]);
  });
});
