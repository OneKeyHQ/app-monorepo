/* eslint-disable import/first */

jest.mock('react-intl', () => {
  const locale = { current: 'en-US' };
  (
    globalThis as unknown as {
      __protocolDetailLocaleMock: typeof locale;
    }
  ).__protocolDetailLocaleMock = locale;
  return { useIntl: () => ({ locale: locale.current }) };
});

jest.mock('@onekeyhq/kit/src/components/Currency', () => {
  const currency = { current: 'usd' };
  (
    globalThis as unknown as {
      __protocolDetailCurrencyMock: typeof currency;
    }
  ).__protocolDetailCurrencyMock = currency;
  return { useCurrency: () => ({ id: currency.current }) };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: { getProtocolDetailsV2: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/views/Staking/hooks/useEarnAccount', () => ({
  useEarnAccount: () => ({
    earnAccount: undefined,
    refreshAccount: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const state: {
    deps?: unknown[];
    options?: { swrKey?: string };
  } = {};
  (
    globalThis as unknown as {
      __protocolDetailPromiseResultMock: typeof state;
    }
  ).__protocolDetailPromiseResultMock = state;

  return {
    usePromiseResult: (
      _method: () => Promise<unknown>,
      deps: unknown[],
      options: { swrKey?: string },
    ) => {
      state.deps = deps;
      state.options = options;
      return { result: undefined, isLoading: false, run: jest.fn() };
    },
  };
});

import { renderHook } from '@testing-library/react-native';

import { useProtocolDetailData } from './useProtocolDetailData';

const localeMock = (
  globalThis as unknown as {
    __protocolDetailLocaleMock: { current: string };
  }
).__protocolDetailLocaleMock;
const currencyMock = (
  globalThis as unknown as {
    __protocolDetailCurrencyMock: { current: string };
  }
).__protocolDetailCurrencyMock;
const promiseResultMock = (
  globalThis as unknown as {
    __protocolDetailPromiseResultMock: {
      deps?: unknown[];
      options?: { swrKey?: string };
    };
  }
).__protocolDetailPromiseResultMock;

describe('useProtocolDetailData cache identity', () => {
  beforeEach(() => {
    localeMock.current = 'en-US';
    currencyMock.current = 'usd';
    promiseResultMock.deps = undefined;
    promiseResultMock.options = undefined;
  });

  it('reruns in a new cache scope after locale or currency changes', () => {
    const { rerender } = renderHook(() =>
      useProtocolDetailData({
        accountId: '',
        networkId: 'evm--1',
        indexedAccountId: undefined,
        symbol: 'USDC',
        provider: 'AAVE',
        vault: '0xVault',
      }),
    );

    expect(promiseResultMock.deps).toEqual(
      expect.arrayContaining(['en-US', 'usd']),
    );
    expect(promiseResultMock.options?.swrKey).toContain(':en-us:usd');

    localeMock.current = 'zh-CN';
    currencyMock.current = 'cny';
    rerender(undefined);

    expect(promiseResultMock.deps).toEqual(
      expect.arrayContaining(['zh-CN', 'cny']),
    );
    expect(promiseResultMock.options?.swrKey).toContain(':zh-cn:cny');
  });
});
