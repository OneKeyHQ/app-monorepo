/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import type {
  IEarnAssetsList,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import { useStakeAssets } from './useStakeAssets';

const mockAssets = jest.fn<Promise<IEarnAssetsList>, [unknown]>();
const mockToken = jest.fn<Promise<IFetchTokenDetailItem[]>, [unknown]>();

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

  it('does not request WETH when the ETH entry is absent', async () => {
    mockAssets.mockResolvedValue({ assets: [] });
    const { result } = renderHook(() => useStakeAssets(params));
    await waitFor(() => expect(result.current.result?.status).toBe('success'));
    expect(mockToken).not.toHaveBeenCalled();
    expect(result.current.wrappedToken).toBeUndefined();
  });
});
