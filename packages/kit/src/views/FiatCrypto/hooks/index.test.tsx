/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceFiatCrypto: {
      getTokensListWithNetworks: jest.fn(),
      isNetworkSupported: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn(), pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells', () => ({
  useHomeTokenListSnapshot: () => ({ tokens: [], map: {} }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const state: { options?: { swrKey?: string; initResult?: unknown } } = {};
  (
    globalThis as unknown as {
      __fiatCryptoPromiseResultMock: typeof state;
    }
  ).__fiatCryptoPromiseResultMock = state;

  return {
    usePromiseResult: (
      _method: () => Promise<unknown>,
      _deps: unknown[],
      options: { swrKey?: string; initResult?: unknown },
    ) => {
      state.options = options;
      return { result: options.initResult, isLoading: false, run: jest.fn() };
    },
  };
});

import { useGetTokensListWithNetworks, useSupportNetworkId } from '.';

import { renderHook } from '@testing-library/react-native';

const promiseResultMock = (
  globalThis as unknown as {
    __fiatCryptoPromiseResultMock: {
      options?: { swrKey?: string; initResult?: unknown };
    };
  }
).__fiatCryptoPromiseResultMock;

const ACCOUNT_ID = 'hd-1--m/44h/0h/0h/0/0';

describe('useGetTokensListWithNetworks cache identity', () => {
  beforeEach(() => {
    promiseResultMock.options = undefined;
  });

  it('scopes the buy list snapshot by network and account', () => {
    renderHook(() =>
      useGetTokensListWithNetworks({
        networkId: 'onekeyall--0',
        type: 'buy',
        accountId: ACCOUNT_ID,
      }),
    );

    expect(promiseResultMock.options?.swrKey).toBe(
      `fiatCryptoTokenList:v1:onekeyall--0:buy:${ACCOUNT_ID}`,
    );
  });

  it('does not snapshot the All Networks buy list for imported or watching accounts', () => {
    // SellOrBuyContent drops networks incompatible with an "others" account
    // only after the async account read lands; a snapshot would paint those
    // rows first and then remove them.
    renderHook(() =>
      useGetTokensListWithNetworks({
        networkId: 'onekeyall--0',
        type: 'buy',
        accountId: 'imported--evm--0xabc',
      }),
    );

    expect(promiseResultMock.options?.swrKey).toBeUndefined();
  });

  it('still snapshots the single-network buy list for imported accounts', () => {
    renderHook(() =>
      useGetTokensListWithNetworks({
        networkId: 'evm--1',
        type: 'buy',
        accountId: 'imported--evm--0xabc',
      }),
    );

    expect(promiseResultMock.options?.swrKey).toBe(
      'fiatCryptoTokenList:v1:evm--1:buy:imported--evm--0xabc',
    );
  });

  it('does not snapshot the sell list because its rows depend on live balances', () => {
    renderHook(() =>
      useGetTokensListWithNetworks({
        networkId: 'onekeyall--0',
        type: 'sell',
        accountId: ACCOUNT_ID,
      }),
    );

    expect(promiseResultMock.options?.swrKey).toBeUndefined();
  });
});

describe('useSupportNetworkId cache identity (OK-61505)', () => {
  beforeEach(() => {
    promiseResultMock.options = undefined;
  });

  it('snapshots the buy/sell support flag per network and type', () => {
    // The home Buy/Sell entry is fail-closed on this flag; without a
    // snapshot every cold start paints it greyed until fiat-pay/list lands.
    renderHook(() => useSupportNetworkId('sell', 'evm--1'));

    expect(promiseResultMock.options?.swrKey).toBe(
      'fiatCryptoNetSupport:v1:evm--1:sell',
    );
    expect(promiseResultMock.options?.initResult).toBe(false);
  });

  it('does not snapshot before the active network is known', () => {
    renderHook(() => useSupportNetworkId('buy', undefined));

    expect(promiseResultMock.options?.swrKey).toBeUndefined();
  });
});
