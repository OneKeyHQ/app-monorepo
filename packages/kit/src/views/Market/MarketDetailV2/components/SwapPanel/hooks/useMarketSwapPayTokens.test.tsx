/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

import { useMarketSwapPayTokens } from './useMarketSwapPayTokens';

const { globalNetInfo } = jest.requireActual<
  typeof import('@onekeyhq/components/src/hooks/useNetInfo')
>('../../../../../../../../components/src/hooks/useNetInfo');

type IStableResponse = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceSwap.checkStableCoinsList>
>;
const mockClassify = jest.fn<
  Promise<IStableResponse>,
  Parameters<typeof backgroundApiProxy.serviceSwap.checkStableCoinsList>
>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isDesktop: false,
    isWeb: true,
    isRuntimeBrowser: true,
    isRuntimeChrome: false,
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => {
  const deferredPromiseModule = require('../../../../../../../../components/src/hooks/useDeferredPromise');
  const netInfoModule = require('../../../../../../../../components/src/hooks/useNetInfo');

  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise: deferredPromiseModule.useDeferredPromise,
    useNetInfo: netInfoModule.useNetInfo,
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      checkStableCoinsList: (
        params: Parameters<
          typeof backgroundApiProxy.serviceSwap.checkStableCoinsList
        >[0],
      ) => mockClassify(params),
    },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const native: ISwapTokenBase = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};
const usdt = {
  ...native,
  contractAddress: '0xusdt',
  symbol: 'USDT',
  isNative: false,
};
const usdc = { ...usdt, contractAddress: '0xusdc', symbol: 'USDC' };
const wrapped = { ...usdt, contractAddress: '0xwrapped', symbol: 'WETH' };
const tokens = [native, usdt, wrapped, usdc];
const stableResponse: IStableResponse = [
  {
    networkId: 'evm--1',
    results: [
      { contractAddress: usdt.contractAddress, isStableCoin: true },
      { contractAddress: usdc.contractAddress, isStableCoin: true },
      { contractAddress: wrapped.contractAddress, isStableCoin: false },
    ],
  },
];

beforeEach(() => {
  mockClassify.mockReset();
  mockClassify.mockResolvedValue(stableResponse);
  globalNetInfo.listeners = [];
  globalNetInfo.state = { isInternetReachable: false };
  globalNetInfo.prevIsInternetReachable = false;
});

function reconnect() {
  act(() => {
    globalNetInfo.updateState({ isInternetReachable: false });
  });
  act(() => {
    globalNetInfo.updateState({ isInternetReachable: true });
  });
}

it('waits for classification and preserves the configured stablecoin order', async () => {
  const request = deferred<IStableResponse>();
  mockClassify.mockReturnValueOnce(request.promise);
  const { result } = renderHook(() =>
    useMarketSwapPayTokens({ tokens, enabled: true, configReady: true }),
  );
  expect(result.current.ready).toBe(false);
  expect(result.current.payTokens).toEqual([]);
  expect(mockClassify).toHaveBeenCalledWith({
    list: [
      {
        networkId: native.networkId,
        contractAddressList: [
          usdt.contractAddress,
          wrapped.contractAddress,
          usdc.contractAddress,
        ],
      },
    ],
  });

  await act(async () => {
    request.resolve(stableResponse);
    await request.promise;
  });
  expect(result.current.ready).toBe(true);
  expect(result.current.payTokens).toEqual([usdt, usdc]);
  expect(tokens).toEqual([native, usdt, wrapped, usdc]);
});

it('waits for speed config before requesting classification', async () => {
  const { result, rerender } = renderHook(
    ({ configReady }) =>
      useMarketSwapPayTokens({ tokens, enabled: true, configReady }),
    { initialProps: { configReady: false } },
  );
  await act(async () => {});
  expect(result.current.ready).toBe(false);
  expect(mockClassify).not.toHaveBeenCalled();

  rerender({ configReady: true });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.payTokens).toEqual([usdt, usdc]);
  expect(mockClassify).toHaveBeenCalledTimes(1);
});

it('does not apply a late classification from the previous candidate scope', async () => {
  const previousRequest = deferred<IStableResponse>();
  const currentRequest = deferred<IStableResponse>();
  const nextToken = { ...usdt, networkId: 'evm--56' };
  mockClassify
    .mockReturnValueOnce(previousRequest.promise)
    .mockReturnValueOnce(currentRequest.promise);
  const { result, rerender } = renderHook(
    ({ candidates }: { candidates: ISwapTokenBase[] }) =>
      useMarketSwapPayTokens({
        tokens: candidates,
        enabled: true,
        configReady: true,
      }),
    { initialProps: { candidates: tokens } },
  );
  rerender({ candidates: [nextToken] });
  expect(result.current.ready).toBe(false);
  expect(result.current.payTokens).toEqual([]);

  await act(async () => {
    currentRequest.resolve([
      {
        networkId: nextToken.networkId,
        results: [
          { contractAddress: nextToken.contractAddress, isStableCoin: true },
        ],
      },
    ]);
    await currentRequest.promise;
  });
  expect(result.current.payTokens).toEqual([nextToken]);
  await act(async () => {
    previousRequest.resolve(stableResponse);
    await previousRequest.promise;
  });
  expect(result.current.ready).toBe(true);
  expect(result.current.payTokens).toEqual([nextToken]);
  expect(mockClassify).toHaveBeenCalledTimes(2);
});

it('updates metadata without requesting the same token identities again', async () => {
  const { result, rerender } = renderHook(
    ({ candidates }: { candidates: ISwapTokenBase[] }) =>
      useMarketSwapPayTokens({
        tokens: candidates,
        enabled: true,
        configReady: true,
      }),
    { initialProps: { candidates: tokens } },
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  const refreshedUsdt = { ...usdt, logoURI: 'updated-usdt.png' };
  rerender({ candidates: [refreshedUsdt, usdc, native, wrapped] });
  await act(async () => {});
  expect(result.current.payTokens).toEqual([refreshedUsdt, usdc]);
  expect(mockClassify).toHaveBeenCalledTimes(1);
});

it('retains known statuses during reconnect and failed refresh, but applies explicit false', async () => {
  const { result } = renderHook(() =>
    useMarketSwapPayTokens({ tokens, enabled: true, configReady: true }),
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  const refresh = deferred<IStableResponse>();
  mockClassify.mockReturnValueOnce(refresh.promise);
  reconnect();
  expect(mockClassify).toHaveBeenCalledTimes(2);
  expect(result.current.ready).toBe(true);
  expect(result.current.payTokens).toEqual([usdt, usdc]);

  await act(async () => {
    refresh.resolve([]);
    await refresh.promise;
  });
  expect(result.current.payTokens).toEqual([usdt, usdc]);
  mockClassify.mockRejectedValueOnce(
    new Error('stable classification unavailable'),
  );
  reconnect();
  await waitFor(() => expect(mockClassify).toHaveBeenCalledTimes(3));
  await act(async () => {});
  expect(result.current.ready).toBe(true);
  expect(result.current.payTokens).toEqual([usdt, usdc]);

  mockClassify.mockResolvedValueOnce([
    {
      networkId: usdt.networkId,
      results: [{ contractAddress: usdt.contractAddress, isStableCoin: false }],
    },
  ]);
  reconnect();
  await waitFor(() => expect(result.current.payTokens).toEqual([usdc]));
  expect(mockClassify).toHaveBeenCalledTimes(4);
});

it('finishes with no candidates after an initial classification failure', async () => {
  mockClassify.mockRejectedValueOnce(
    new Error('stable classification unavailable'),
  );
  const { result } = renderHook(() =>
    useMarketSwapPayTokens({ tokens, enabled: true, configReady: true }),
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.payTokens).toEqual([]);
  expect(mockClassify).toHaveBeenCalledTimes(1);
});

it('does not retain known statuses when the new candidate scope returns empty', async () => {
  const { result, rerender } = renderHook(
    ({ candidates }: { candidates: ISwapTokenBase[] }) =>
      useMarketSwapPayTokens({
        tokens: candidates,
        enabled: true,
        configReady: true,
      }),
    { initialProps: { candidates: tokens } },
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  mockClassify.mockResolvedValueOnce([]);
  rerender({ candidates: [usdt] });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.payTokens).toEqual([]);
});

it('leaves Stock candidates untouched without classifying them on reconnect', async () => {
  const { result } = renderHook(() =>
    useMarketSwapPayTokens({ tokens, enabled: false, configReady: false }),
  );
  await act(async () => {});
  reconnect();
  await act(async () => {});
  expect(result.current.payTokens).toBe(tokens);
  expect(result.current.ready).toBe(true);
  expect(mockClassify).not.toHaveBeenCalled();
});
