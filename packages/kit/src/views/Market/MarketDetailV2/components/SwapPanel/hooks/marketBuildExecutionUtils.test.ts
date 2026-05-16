import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';
import type {
  EInternalDappEnum,
  IStakeTx,
} from '@onekeyhq/shared/types/staking';
import type {
  IFetchBuildTxResponse,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { buildMarketExecutionPayload } from './marketBuildExecutionUtils';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

function createBuildRes(
  overrides: Partial<IFetchBuildTxResponse> = {},
): IFetchBuildTxResponse {
  return {
    result: {
      protocol: EProtocolOfExchange.SWAP,
      info: {
        provider: 'provider-a',
        providerName: 'Provider A',
      },
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      fromAmount: '1',
      toAmount: '1000',
    },
    ...overrides,
  } as IFetchBuildTxResponse;
}

describe('marketBuildExecutionUtils', () => {
  it('builds transfer info for provider orders like swft', async () => {
    const result = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        swftOrder: {
          platformAddr: '0xplatform',
          depositCoinAmt: '1',
          memo: 'memo-1',
        } as never,
      }),
      currentFromToken: fromToken,
      currentToToken: toToken,
      fromAmount: '1',
      receivingAddress: '0xuser',
      slippage: 1,
      userAddress: '0xuser',
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: jest.fn(),
      onBuildInternalDappTx: jest.fn(),
    });

    expect(result.transferInfo).toEqual(
      expect.objectContaining({
        from: '0xuser',
        to: '0xplatform',
        amount: '1',
        memo: 'memo-1',
      }),
    );
    expect(result.encodedTx).toBeUndefined();
  });

  it('supports LM Tron build payloads', async () => {
    const buildLMSwapEncodedTx = jest.fn<Promise<IEncodedTx>, [unknown]>();
    buildLMSwapEncodedTx.mockResolvedValue({
      data: '0xlm',
    } as IEncodedTx);

    const result = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        LMTronObject: {
          from: '0xfrom',
          to: '0xto',
          value: '0',
          data: '0xlm',
        },
      }),
      currentFromToken: fromToken,
      currentToToken: toToken,
      fromAmount: '1',
      receivingAddress: '0xuser',
      slippage: 1,
      userAddress: '0xuser',
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: buildLMSwapEncodedTx,
      onBuildInternalDappTx: jest.fn(),
    });

    expect(buildLMSwapEncodedTx).toHaveBeenCalledTimes(1);
    expect(result.encodedTx).toEqual({
      data: '0xlm',
    });
  });

  it('attaches selected BTC UTXOs to SWFT provider orders', async () => {
    const result = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        swftOrder: {
          platformAddr: 'bc1p-platform',
          depositCoinAmt: '0.001',
          memo: 'memo-1',
        } as never,
      }),
      currentFromToken: fromToken,
      currentToToken: toToken,
      fromAmount: '0.001',
      receivingAddress: '0xreceive',
      slippage: 1,
      userAddress: 'bc1p-current',
      btcSwapSingleAddressUtxoPlan: {
        userAddress: 'bc1p-input',
        refundAddress: 'bc1p-input',
        selectedUtxoKeys: ['tx-a:0'],
        utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
      },
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: jest.fn(),
      onBuildInternalDappTx: jest.fn(),
    });

    expect(result.transferInfo).toEqual(
      expect.objectContaining({
        from: 'bc1p-input',
        selectedUtxoKeys: ['tx-a:0'],
        utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
      }),
    );
    expect(result.swapInfo.accountAddress).toBe('bc1p-input');
    expect(result.swapInfo.receivingAddress).toBe('0xreceive');
  });

  it('marks signed orders to skip on-chain sending and preserves quote-based order ids', async () => {
    const result = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        result: {
          ...createBuildRes().result,
          quoteId: 'quote-1',
          swapShouldSignedData: {
            unSignedInfo: {},
          } as never,
        },
      }),
      currentFromToken: fromToken,
      currentToToken: toToken,
      fromAmount: '1',
      receivingAddress: '0xuser',
      slippage: 1,
      userAddress: '0xuser',
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: jest.fn(),
      onBuildInternalDappTx: jest.fn(),
    });

    expect(result.skipSendTransAction).toBe(true);
    expect(result.orderId).toBe('quote-1');
    expect(result.swapInfo.swapBuildResData.orderId).toBe('quote-1');
  });

  it('keeps service order ids on swap build data when provider order ids also exist', async () => {
    const result = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        swftOrder: {
          orderId: 'swft-order-1',
        } as never,
        ctx: {
          cowSwapOrderId: 'cow-order-1',
          oneInchFusionOrderHash: 'fusion-order-1',
          changeHeroOrderId: 'change-hero-order-1',
        },
        orderId: 'build-order-1',
        result: {
          ...createBuildRes().result,
          quoteId: 'quote-1',
        },
      }),
      currentFromToken: fromToken,
      currentToToken: toToken,
      fromAmount: '1',
      receivingAddress: '0xuser',
      slippage: 1,
      userAddress: '0xuser',
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: jest.fn(),
      onBuildInternalDappTx: jest.fn(),
    });

    expect(result.orderId).toBe('build-order-1');
    expect(result.swapInfo.swapBuildResData.orderId).toBe('build-order-1');
  });

  it('falls back to quote ids for service order tracking when build order ids are missing', async () => {
    const result = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        ctx: {
          oneInchFusionOrderHash: '0xfusion-hash',
        },
        result: {
          ...createBuildRes().result,
          quoteId: 'quote-1',
        },
      }),
      currentFromToken: fromToken,
      currentToToken: toToken,
      fromAmount: '1',
      receivingAddress: '0xuser',
      slippage: 1,
      userAddress: '0xuser',
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: jest.fn(),
      onBuildInternalDappTx: jest.fn(),
    });

    expect(result.orderId).toBe('quote-1');
    expect(result.swapInfo.swapBuildResData.orderId).toBe('quote-1');
  });

  it('supports BTC and Sui internal dapp payloads', async () => {
    const buildInternalDappTx = jest.fn<
      Promise<IEncodedTx>,
      [
        {
          accountId: string;
          networkId: string;
          tx: IStakeTx;
          internalDappType: EInternalDappEnum;
        },
      ]
    >();
    buildInternalDappTx.mockResolvedValue({
      data: '0xinternal',
    } as IEncodedTx);

    const btcResult = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        btcData: {
          hexStr: 'psbt-hex',
          addressType: ['p2wpkh'],
        },
      }),
      currentFromToken: {
        ...fromToken,
        networkId: 'btc--0',
      },
      currentToToken: toToken,
      deriveAddressEncoding: 'p2wpkh',
      fromAmount: '1',
      receivingAddress: '0xuser',
      slippage: 1,
      userAddress: '0xuser',
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: jest.fn(),
      onBuildInternalDappTx: buildInternalDappTx,
    });

    const suiResult = await buildMarketExecutionPayload({
      accountId: 'account-1',
      buildRes: createBuildRes({
        suiBase64Data: 'base64-tx',
      }),
      currentFromToken: {
        ...fromToken,
        networkId: 'sui--mainnet',
      },
      currentToToken: toToken,
      fromAmount: '1',
      receivingAddress: '0xuser',
      slippage: 1,
      userAddress: '0xuser',
      onBuildOkxSwapEncodedTx: jest.fn(),
      onBuildLMSwapEncodedTx: jest.fn(),
      onBuildInternalDappTx: buildInternalDappTx,
    });

    expect(buildInternalDappTx).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tx: {
          psbtHex: 'psbt-hex',
        },
      }),
    );
    expect(buildInternalDappTx).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tx: 'base64-tx',
      }),
    );
    expect(btcResult.encodedTx).toEqual({
      data: '0xinternal',
    });
    expect(suiResult.encodedTx).toEqual({
      data: '0xinternal',
    });
  });

  it('fails fast when BTC derivation encoding does not match the build tx', async () => {
    await expect(
      buildMarketExecutionPayload({
        accountId: 'account-1',
        buildRes: createBuildRes({
          btcData: {
            hexStr: 'psbt-hex',
            addressType: ['p2wpkh'],
          },
        }),
        btcDerivationRestrictionErrorMessage: 'Derivation restricted',
        currentFromToken: {
          ...fromToken,
          networkId: 'btc--0',
        },
        currentToToken: toToken,
        deriveAddressEncoding: 'p2tr',
        fromAmount: '1',
        receivingAddress: '0xuser',
        slippage: 1,
        userAddress: '0xuser',
        onBuildOkxSwapEncodedTx: jest.fn(),
        onBuildLMSwapEncodedTx: jest.fn(),
        onBuildInternalDappTx: jest.fn(),
      }),
    ).rejects.toThrow('Derivation restricted');
  });
});
