import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  checkSwapLatestBalanceSufficient,
  getSwapRequiredNativeBalanceAmount,
} from './swapBalanceUtils';

type IFetchSwapTokenDetailsParams = {
  networkId: string;
  contractAddress: string;
  accountAddress?: string;
  accountId?: string;
  currency?: string;
};

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (params: IFetchSwapTokenDetailsParams) => Promise<{ balanceParsed: string }[]>
> = jest.fn();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
    },
  },
}));

const ethToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
} as ISwapToken;

const usdcToken = {
  networkId: 'evm--1',
  contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  symbol: 'USDC',
  decimals: 6,
} as ISwapToken;

const evmGasInfo = {
  common: {
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
  },
  gas: {
    gasLimit: '21000',
    gasPrice: '1',
  },
};

describe('checkSwapLatestBalanceSufficient', () => {
  beforeEach(() => {
    mockFetchSwapTokenDetails.mockReset();
  });

  it('returns insufficient when the latest token balance is lower than amount', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([{ balanceParsed: '0.08' }]);

    await expect(
      checkSwapLatestBalanceSufficient({
        token: ethToken,
        amount: '0.1',
        accountId: 'account-id',
        accountAddress: '0xabc',
      }),
    ).resolves.toEqual({
      isSufficient: false,
      balance: '0.08',
      requiredAmount: '0.1',
      tokenSymbol: 'ETH',
    });
  });

  it('does not block when balance cannot be fetched', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([]);

    await expect(
      checkSwapLatestBalanceSufficient({
        token: ethToken,
        amount: '0.1',
        accountId: 'account-id',
        accountAddress: '0xabc',
      }),
    ).resolves.toEqual({ isSufficient: true });
  });
});

describe('getSwapRequiredNativeBalanceAmount', () => {
  it('returns the required native gas amount for non-native swaps', () => {
    expect(
      getSwapRequiredNativeBalanceAmount({
        gasInfos: [{ gasInfo: evmGasInfo }],
        networkId: 'evm--1',
        fromToken: usdcToken,
        fromAmount: '12',
      }),
    ).toEqual({
      token: {
        networkId: 'evm--1',
        contractAddress: '',
        isNative: true,
        symbol: 'ETH',
        decimals: 18,
      },
      amount: '0.000021',
    });
  });

  it('adds the sending amount when the from token is native', () => {
    expect(
      getSwapRequiredNativeBalanceAmount({
        gasInfos: [{ gasInfo: evmGasInfo }],
        networkId: 'evm--1',
        fromToken: ethToken,
        fromAmount: '0.1',
      }),
    ).toEqual({
      token: ethToken,
      amount: '0.100021',
    });
  });

  it('adds native other fees to the same native balance requirement', () => {
    expect(
      getSwapRequiredNativeBalanceAmount({
        gasInfos: [{ gasInfo: evmGasInfo }],
        networkId: 'evm--1',
        fromToken: ethToken,
        fromAmount: '0.1',
        otherFeeInfos: [
          {
            token: {
              networkId: 'evm--1',
              contractAddress: '',
              symbol: 'ETH',
              price: '3000',
              decimals: 18,
              isNative: true,
            },
            amount: '0.02',
          },
          {
            token: {
              networkId: 'evm--1',
              contractAddress: usdcToken.contractAddress,
              symbol: 'USDC',
              price: '1',
              decimals: 6,
            },
            amount: '5',
          },
        ],
      }),
    ).toEqual({
      token: ethToken,
      amount: '0.120021',
    });
  });
});
