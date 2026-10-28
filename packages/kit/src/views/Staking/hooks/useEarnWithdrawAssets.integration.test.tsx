/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type {
  IEarnAssetsList,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';

import { useEarnWithdrawAssets } from './useEarnWithdrawAssets';

const mockGetAssets = jest.fn<Promise<IEarnAssetsList>, [unknown]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAssetsList: (request: unknown) => mockGetAssets(request),
    },
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

const asset = {
  info: { symbol: 'USDC', address: '0xtoken', decimals: 6 },
} as IEarnTokenItem;
const params = {
  enabled: true,
  accountId: 'account-1',
  networkId: 'evm--1',
  provider: 'etherfi',
  symbol: 'USDC',
  vault: '0xvault',
};

describe('withdraw output asset recovery', () => {
  beforeEach(() => mockGetAssets.mockReset());

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
});
