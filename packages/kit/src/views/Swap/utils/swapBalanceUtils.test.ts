import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  checkSwapLatestBalanceSufficient,
  getSwapEncodedTxSize,
  getSwapRequiredNativeBalanceAmount,
  validateSwapBtcOutputs,
} from './swapBalanceUtils';

type IFetchSwapTokenDetailsParams = {
  networkId: string;
  contractAddress: string;
  accountAddress?: string;
  accountId?: string;
  currency?: string;
};

type IGetNativeTokenAddressParams = {
  networkId: string;
};

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (params: IFetchSwapTokenDetailsParams) => Promise<{ balanceParsed: string }[]>
> = jest.fn();
const mockGetNativeTokenAddress: jest.MockedFunction<
  (params: IGetNativeTokenAddressParams) => Promise<string>
> = jest.fn();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      getNativeTokenAddress: (params: IGetNativeTokenAddressParams) =>
        mockGetNativeTokenAddress(params),
    },
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

const btcToken = {
  networkId: 'btc--0',
  contractAddress: '',
  symbol: 'BTC',
  decimals: 8,
  isNative: true,
} as ISwapToken;

const btcGasInfo = {
  common: {
    feeDecimals: 0,
    feeSymbol: 'sat/vB',
    nativeDecimals: 8,
    nativeSymbol: 'BTC',
  },
  feeUTXO: {
    feeRate: '1',
  },
};

const aptosNativeAddress = '0x1::aptos_coin::AptosCoin';

const aptosToken = {
  networkId: 'aptos--1',
  contractAddress: '',
  symbol: 'APT',
  decimals: 8,
  isNative: true,
} as ISwapToken;

describe('checkSwapLatestBalanceSufficient', () => {
  beforeEach(() => {
    mockFetchSwapTokenDetails.mockReset();
    mockGetNativeTokenAddress.mockReset();
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

  it('uses canonical native token address when native token address is empty', async () => {
    mockGetNativeTokenAddress.mockResolvedValue(aptosNativeAddress);
    mockFetchSwapTokenDetails.mockResolvedValue([{ balanceParsed: '6.6044' }]);

    await expect(
      checkSwapLatestBalanceSufficient({
        token: aptosToken,
        amount: '0.0225',
        accountId: 'account-id',
        accountAddress: '0xabc',
      }),
    ).resolves.toEqual({ isSufficient: true });
    expect(mockGetNativeTokenAddress).toHaveBeenCalledWith({
      networkId: 'aptos--1',
    });
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledWith({
      networkId: 'aptos--1',
      contractAddress: aptosNativeAddress,
      accountAddress: '0xabc',
      accountId: 'account-id',
      currency: 'usd',
    });
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
      reserveAmount: '0.000021',
      includesFromAmount: false,
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
      reserveAmount: '0.000021',
      includesFromAmount: true,
    });
  });

  it('adds UTXO fee-rate reserve using transaction size for native BTC swaps', () => {
    expect(
      getSwapRequiredNativeBalanceAmount({
        gasInfos: [{ gasInfo: btcGasInfo, txSize: 220 }],
        networkId: 'btc--0',
        fromToken: btcToken,
        fromAmount: '0.0018',
      }),
    ).toEqual({
      token: btcToken,
      amount: '0.0018022',
      reserveAmount: '0.0000022',
      includesFromAmount: true,
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
      reserveAmount: '0.020021',
      includesFromAmount: true,
    });
  });
});

describe('getSwapEncodedTxSize', () => {
  it('reads rebuilt UTXO txSize from encodedTx only when valid', () => {
    expect(getSwapEncodedTxSize({ txSize: 220 } as IEncodedTx)).toBe(220);
    expect(getSwapEncodedTxSize({ txSize: 0 } as IEncodedTx)).toBeUndefined();
    expect(getSwapEncodedTxSize({ txSize: -1 } as IEncodedTx)).toBeUndefined();
    expect(getSwapEncodedTxSize('raw-tx' as IEncodedTx)).toBeUndefined();
  });
});

describe('validateSwapBtcOutputs', () => {
  const btcTransferInfo = {
    from: 'bc1from',
    to: 'bc1provider',
    amount: '0.00179536',
    tokenInfo: {
      networkId: 'btc--0',
      address: '',
      symbol: 'BTC',
      decimals: 8,
      isNative: true,
    },
  } as ITransferInfo;

  it('blocks UTXO swap transactions when the provider payment output is missing', () => {
    expect(
      validateSwapBtcOutputs({
        networkId: 'btc--0',
        encodedTx: {
          outputs: [
            {
              address: 'bc1change',
              value: '1000',
            },
          ],
        } as IEncodedTx,
        transferInfo: btcTransferInfo,
      }),
    ).toEqual({
      type: 'payment_output_missing',
      expectedAmount: '0.00179536',
      actualAmount: '0',
      expectedAmountBase: '179536',
      actualAmountBase: '0',
    });
  });

  it('blocks UTXO swap transactions when SendMax reduces the provider output', () => {
    expect(
      validateSwapBtcOutputs({
        networkId: 'btc--0',
        encodedTx: {
          outputs: [
            {
              address: 'bc1provider',
              value: '179316',
            },
          ],
        } as IEncodedTx,
        transferInfo: btcTransferInfo,
      }),
    ).toEqual({
      type: 'payment_output_less_than_order_amount',
      expectedAmount: '0.00179536',
      actualAmount: '0.00179316',
      expectedAmountBase: '179536',
      actualAmountBase: '179316',
    });
  });

  it('allows UTXO swap transactions when the provider output matches the order amount', () => {
    expect(
      validateSwapBtcOutputs({
        networkId: 'btc--0',
        encodedTx: {
          outputs: [
            {
              address: 'bc1provider',
              value: '179536',
            },
            {
              address: 'bc1change',
              value: '1000',
            },
          ],
        } as IEncodedTx,
        transferInfo: btcTransferInfo,
      }),
    ).toBeUndefined();
  });

  it('blocks BTC swap transactions when required OP_RETURN output is missing', () => {
    expect(
      validateSwapBtcOutputs({
        networkId: 'btc--0',
        encodedTx: {
          outputs: [
            {
              address: 'bc1provider',
              value: '179536',
            },
          ],
        } as IEncodedTx,
        transferInfo: {
          ...btcTransferInfo,
          opReturn: '=:BNB.BNB:bnb1recipient',
        } as ITransferInfo,
      }),
    ).toEqual({
      type: 'op_return_missing',
      expectedOpReturn: '=:BNB.BNB:bnb1recipient',
    });
  });

  it('allows BTC swap transactions when required OP_RETURN output exists', () => {
    expect(
      validateSwapBtcOutputs({
        networkId: 'btc--0',
        encodedTx: {
          outputs: [
            {
              address: 'bc1provider',
              value: '179536',
            },
            {
              address: '',
              value: '0',
              payload: {
                opReturn: '=:BNB.BNB:bnb1recipient',
              },
            },
          ],
        } as IEncodedTx,
        transferInfo: {
          ...btcTransferInfo,
          opReturn: '=:BNB.BNB:bnb1recipient',
        } as ITransferInfo,
      }),
    ).toBeUndefined();
  });

  it('skips exact-output validation for non-BTC networks', () => {
    expect(
      validateSwapBtcOutputs({
        networkId: 'ada--0',
        encodedTx: {
          outputs: [
            {
              address: 'bc1provider',
              amount: '179536',
            },
          ],
        } as IEncodedTx,
        transferInfo: btcTransferInfo,
      }),
    ).toBeUndefined();
  });
});
