/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type {
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

import { usePaymentTokenPrice } from './usePaymentTokenPrice';

type IFetchSwapTokenDetailsParams = {
  networkId?: string;
  contractAddress?: string;
  currency?: string;
};

type IPaymentTokenPriceResult = {
  tokenDetail?: ISwapToken;
  tokenKey: string;
};

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (params: IFetchSwapTokenDetailsParams) => Promise<ISwapToken[]>
> = jest.fn();
const mockRun = jest.fn();
let mockPromiseResult: IPaymentTokenPriceResult | undefined;
let mockCapturedMethod:
  | (() => Promise<IPaymentTokenPriceResult | undefined>)
  | undefined;
let mockCapturedDeps: unknown[] = [];

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<IPaymentTokenPriceResult | undefined>,
    deps: unknown[],
  ) => {
    mockCapturedMethod = method;
    mockCapturedDeps = deps;
    return {
      result: mockPromiseResult,
      isLoading: false,
      run: mockRun,
    };
  },
}));

const paymentToken: ISwapTokenBase = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

describe('usePaymentTokenPrice', () => {
  beforeEach(() => {
    mockFetchSwapTokenDetails.mockReset();
    mockRun.mockReset();
    mockPromiseResult = undefined;
    mockCapturedMethod = undefined;
    mockCapturedDeps = [];
  });

  it('requests token detail with the selected currency and returns a currency-aware key', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([
      {
        ...paymentToken,
        price: '7',
      },
    ]);

    renderHook(() => usePaymentTokenPrice(paymentToken, 'evm--1', 'cny'));

    const result = await mockCapturedMethod?.();

    expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith({
      networkId: 'evm--1',
      contractAddress: '0xusdc',
      currency: 'cny',
    });
    expect(result).toEqual({
      tokenDetail: expect.objectContaining({
        price: '7',
        currency: 'cny',
      }),
      tokenKey: 'evm--1:0xusdc:cny',
    });
    expect(mockCapturedDeps).toContain('cny');
    expect(mockCapturedDeps).toContain('evm--1:0xusdc:cny');
  });

  it('does not fetch until a currency id is available', async () => {
    renderHook(() => usePaymentTokenPrice(paymentToken, 'evm--1'));

    const result = await mockCapturedMethod?.();

    expect(result).toBeUndefined();
    expect(mockFetchSwapTokenDetails).not.toHaveBeenCalled();
  });

  it('exposes the current currency-scoped price result', () => {
    mockPromiseResult = {
      tokenDetail: {
        ...paymentToken,
        price: '9',
        currency: 'cny',
      },
      tokenKey: 'evm--1:0xusdc:cny',
    };

    const { result } = renderHook(() =>
      usePaymentTokenPrice(paymentToken, 'evm--1', 'cny'),
    );

    expect(result.current.price?.toFixed()).toBe('9');
    expect(result.current.tokenKey).toBe('evm--1:0xusdc:cny');
  });
});
