/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

import { useSpeedSwapActions } from './useSpeedSwapActions';
import { ESwapDirection } from './useTradeType';

type IFetchSwapTokenDetailsParams = {
  accountId?: string;
  networkId?: string;
  contractAddress?: string;
  accountAddress?: string;
  currency?: string;
};

type IFetchSwapNativeTokenConfigParams = {
  networkId: string;
};

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (params: IFetchSwapTokenDetailsParams) => Promise<ISwapToken[]>
> = jest.fn();
const mockFetchSwapNativeTokenConfig: jest.MockedFunction<
  (
    params: IFetchSwapNativeTokenConfigParams,
  ) => Promise<{ networkId: string; reserveGas: string }>
> = jest.fn();
const mockSetInAppNotificationAtom = jest.fn();
const mockNavigationToTxConfirm = jest.fn();
const mockNetAccountRun = jest.fn();
const mockMarketDeriveInfoRun = jest.fn();

let mockUsePromiseResultCallCount = 0;
let mockNetAccountPromiseResult: {
  result?: {
    id: string;
    addressDetail: {
      address: string;
      networkId: string;
    };
  };
  run: jest.Mock;
};
let mockMarketDeriveInfoPromiseResult: {
  result?: {
    addressEncoding?: string;
  };
  run: jest.Mock;
};
let mockInAppNotificationAtomState: {
  speedSwapApprovingTransaction?: {
    status?: string;
  };
} = {};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
      fetchSwapNativeTokenConfig: (params: IFetchSwapNativeTokenConfigParams) =>
        mockFetchSwapNativeTokenConfig(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => {
    const nextResult =
      mockUsePromiseResultCallCount % 2 === 0
        ? mockNetAccountPromiseResult
        : mockMarketDeriveInfoPromiseResult;
    mockUsePromiseResultCallCount += 1;
    return nextResult;
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({
    navigationToTxConfirm: mockNavigationToTxConfirm,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: {
        id: 'account-1',
      },
      indexedAccount: undefined,
      deriveType: 'default',
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms', () => ({
  useSelectedDeriveTypeAtom: () => [undefined],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useInAppNotificationAtom: () => [
    mockInAppNotificationAtomState,
    mockSetInAppNotificationAtom,
  ],
  useSettingsPersistAtom: () => [
    {
      currencyInfo: {
        symbol: '$',
      },
      isFirstTimeSwap: false,
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    NetworkDeriveTypeChanged: 'NetworkDeriveTypeChanged',
    SwapSpeedApprovingReset: 'SwapSpeedApprovingReset',
    SwapSpeedBalanceUpdate: 'SwapSpeedBalanceUpdate',
    SwapSpeedBuildTxSuccess: 'SwapSpeedBuildTxSuccess',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function createTokenDetail(overrides: Partial<ISwapToken> = {}): ISwapToken[] {
  return [
    {
      networkId: 'evm--1',
      contractAddress: '0xtoken',
      symbol: 'TOKEN',
      decimals: 18,
      ...overrides,
    },
  ];
}

const usdcToken: ISwapTokenBase = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

const usdtToken: ISwapTokenBase = {
  networkId: 'evm--1',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
  isNative: false,
};

const btcToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xbtc',
  symbol: 'BTC',
  decimals: 8,
  isNative: false,
};

const tonMarketToken: ISwapToken = {
  networkId: 'ton--239',
  contractAddress: '0xton',
  symbol: 'TON',
  decimals: 9,
  isNative: false,
};

function createHookProps({
  marketToken = btcToken,
  tradeToken = usdcToken,
}: {
  marketToken?: ISwapToken;
  tradeToken?: ISwapTokenBase;
} = {}) {
  return {
    marketToken,
    tradeToken,
    tradeType: ESwapDirection.BUY,
    fromTokenAmount: '0',
    provider: 'onekey',
    spenderAddress: '0xspender',
    slippage: 0.5,
    antiMEV: false,
  };
}

describe('useSpeedSwapActions', () => {
  beforeEach(() => {
    mockFetchSwapTokenDetails.mockReset();
    mockFetchSwapNativeTokenConfig.mockReset();
    mockSetInAppNotificationAtom.mockReset();
    mockNavigationToTxConfirm.mockReset();
    mockNetAccountRun.mockReset();
    mockMarketDeriveInfoRun.mockReset();
    mockUsePromiseResultCallCount = 0;
    mockInAppNotificationAtomState = {};
    mockFetchSwapNativeTokenConfig.mockResolvedValue({
      networkId: 'evm--1',
      reserveGas: '0.01',
    });
    mockNetAccountPromiseResult = {
      result: {
        id: 'net-account-1',
        addressDetail: {
          address: '0xuser',
          networkId: 'evm--1',
        },
      },
      run: mockNetAccountRun,
    };
    mockMarketDeriveInfoPromiseResult = {
      result: undefined,
      run: mockMarketDeriveInfoRun,
    };
  });

  it('keeps the latest same-network balance when stablecoin balance requests resolve out of order', async () => {
    const oldBalanceRequest = createDeferred<ISwapToken[]>();
    const newBalanceRequest = createDeferred<ISwapToken[]>();

    mockFetchSwapTokenDetails.mockImplementation(
      ({
        accountId,
        contractAddress,
      }: {
        accountId?: string;
        contractAddress?: string;
      }) => {
        if (!accountId) {
          return Promise.resolve([]);
        }
        if (contractAddress === usdcToken.contractAddress) {
          return oldBalanceRequest.promise;
        }
        if (contractAddress === usdtToken.contractAddress) {
          return newBalanceRequest.promise;
        }
        return Promise.resolve([]);
      },
    );

    const { result, rerender } = renderHook(
      ({ tradeToken }: { tradeToken: ISwapTokenBase }) =>
        useSpeedSwapActions(
          createHookProps({
            marketToken: {
              ...btcToken,
              price: '100000',
            },
            tradeToken: {
              ...tradeToken,
              price: '1',
            },
          }),
        ),
      {
        initialProps: {
          tradeToken: usdcToken,
        },
      },
    );

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(1);
    });

    rerender({
      tradeToken: usdtToken,
    });

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(2);
      expect(result.current.balanceToken.symbol).toBe('USDT');
    });

    await act(async () => {
      newBalanceRequest.resolve(
        createTokenDetail({
          networkId: usdtToken.networkId,
          contractAddress: usdtToken.contractAddress,
          symbol: usdtToken.symbol,
          decimals: usdtToken.decimals,
          balanceParsed: '250',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.balance?.toFixed()).toBe('250');
      expect(result.current.fetchBalanceLoading).toBe(false);
    });

    await act(async () => {
      oldBalanceRequest.resolve(
        createTokenDetail({
          networkId: usdcToken.networkId,
          contractAddress: usdcToken.contractAddress,
          symbol: usdcToken.symbol,
          decimals: usdcToken.decimals,
          balanceParsed: '100',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.balanceToken.symbol).toBe('USDT');
      expect(result.current.balance?.toFixed()).toBe('250');
      expect(result.current.fetchBalanceLoading).toBe(false);
    });
  });

  it('keeps the latest cross-network price when token detail requests resolve out of order', async () => {
    const oldTradeTokenPriceRequest = createDeferred<ISwapToken[]>();
    const oldMarketTokenPriceRequest = createDeferred<ISwapToken[]>();
    const newTradeTokenPriceRequest = createDeferred<ISwapToken[]>();
    const newMarketTokenPriceRequest = createDeferred<ISwapToken[]>();

    mockNetAccountPromiseResult = {
      result: undefined,
      run: mockNetAccountRun,
    };

    mockFetchSwapTokenDetails.mockImplementation(
      ({
        accountId,
        networkId,
        contractAddress,
      }: {
        accountId?: string;
        networkId?: string;
        contractAddress?: string;
      }) => {
        if (accountId) {
          return Promise.resolve([]);
        }

        const requestKey = `${networkId ?? ''}:${contractAddress ?? ''}`;
        switch (requestKey) {
          case `${usdcToken.networkId}:${usdcToken.contractAddress}`:
            return oldTradeTokenPriceRequest.promise;
          case `${btcToken.networkId}:${btcToken.contractAddress}`:
            return oldMarketTokenPriceRequest.promise;
          case `ton--239:0x11112222`:
            return newTradeTokenPriceRequest.promise;
          case `${tonMarketToken.networkId}:${tonMarketToken.contractAddress}`:
            return newMarketTokenPriceRequest.promise;
          default:
            return Promise.resolve([]);
        }
      },
    );

    const { result, rerender } = renderHook(
      ({
        marketToken,
        tradeToken,
      }: {
        marketToken: ISwapToken;
        tradeToken: ISwapTokenBase;
      }) =>
        useSpeedSwapActions(
          createHookProps({
            marketToken,
            tradeToken,
          }),
        ),
      {
        initialProps: {
          marketToken: btcToken,
          tradeToken: usdcToken,
        },
      },
    );

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(2);
    });

    rerender({
      marketToken: tonMarketToken,
      tradeToken: {
        networkId: 'ton--239',
        contractAddress: '0x11112222',
        symbol: 'USDT',
        decimals: 6,
        isNative: false,
      },
    });

    await waitFor(() => {
      expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(4);
    });

    await act(async () => {
      newTradeTokenPriceRequest.resolve(
        createTokenDetail({
          networkId: 'ton--239',
          contractAddress: '0x11112222',
          symbol: 'USDT',
          decimals: 6,
          price: '1',
        }),
      );
      newMarketTokenPriceRequest.resolve(
        createTokenDetail({
          networkId: tonMarketToken.networkId,
          contractAddress: tonMarketToken.contractAddress,
          symbol: tonMarketToken.symbol,
          decimals: tonMarketToken.decimals,
          price: '5',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.priceRate).toEqual(
        expect.objectContaining({
          fromTokenSymbol: 'USDT',
          toTokenSymbol: 'TON',
          loading: false,
        }),
      );
      expect(result.current.priceRate?.rate).toBeCloseTo(0.2);
    });

    await act(async () => {
      oldTradeTokenPriceRequest.resolve(
        createTokenDetail({
          networkId: usdcToken.networkId,
          contractAddress: usdcToken.contractAddress,
          symbol: usdcToken.symbol,
          decimals: usdcToken.decimals,
          price: '1',
        }),
      );
      oldMarketTokenPriceRequest.resolve(
        createTokenDetail({
          networkId: btcToken.networkId,
          contractAddress: btcToken.contractAddress,
          symbol: btcToken.symbol,
          decimals: btcToken.decimals,
          price: '100000',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.priceRate).toEqual(
        expect.objectContaining({
          fromTokenSymbol: 'USDT',
          toTokenSymbol: 'TON',
          loading: false,
        }),
      );
      expect(result.current.priceRate?.rate).toBeCloseTo(0.2);
    });
  });
});
