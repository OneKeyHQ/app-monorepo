import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapExecutionResultFromBuildResponse,
  isSwapSignedNoSendBuildResult,
  isSwapTerminalSignedNoSendBuildResult,
  settleSwapSignedNoSendResult,
} from './swapBuildExecutionResult';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'FROM',
  decimals: 18,
};
const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'TO',
  decimals: 6,
};
const quoteResult: IFetchQuoteResult = {
  protocol: EProtocolOfExchange.SWAP,
  kind: ESwapQuoteKind.SELL,
  info: { provider: 'provider-a', providerName: 'Provider A' },
  fromTokenInfo: fromToken,
  toTokenInfo: toToken,
  fromAmount: '1',
  toAmount: '2',
};
const unsignedSigningData: NonNullable<
  IFetchQuoteResult['swapShouldSignedData']
> = {
  unSignedInfo: {
    origin: 'onekey',
    scope: 'swap',
    signedType: EMessageTypesEth.TYPED_DATA_V4,
  },
};

function createBuildResponse(
  overrides: Partial<IFetchBuildTxResponse> = {},
): IFetchBuildTxResponse {
  return {
    result: quoteResult,
    ...overrides,
  };
}

describe('swapBuildExecutionResult', () => {
  it.each([
    { ctx: { cowSwapOrderId: 'cow-order' } },
    { ctx: { oneInchFusionOrderHash: 'fusion-order' } },
    { result: { ...quoteResult, swapShouldSignedData: unsignedSigningData } },
  ])('recognizes signed-no-send result %#', (overrides) => {
    expect(isSwapSignedNoSendBuildResult(createBuildResponse(overrides))).toBe(
      true,
    );
  });

  it('does not classify an on-chain response as signed-no-send even when ctx also has an order id', () => {
    expect(
      isSwapSignedNoSendBuildResult(
        createBuildResponse({
          ctx: { cowSwapOrderId: 'cow-order' },
          tx: '0xencoded',
        }),
      ),
    ).toBe(false);
  });

  it.each([
    { ctx: { cowSwapOrderId: 'cow-order' } },
    { ctx: { oneInchFusionOrderHash: 'fusion-order' } },
  ])('recognizes a server-created terminal signed order %#', (overrides) => {
    expect(
      isSwapTerminalSignedNoSendBuildResult(createBuildResponse(overrides)),
    ).toBe(true);
  });

  it('does not persist an unsigned signing prompt as a terminal order', () => {
    expect(
      isSwapTerminalSignedNoSendBuildResult(
        createBuildResponse({
          result: {
            ...quoteResult,
            swapShouldSignedData: unsignedSigningData,
          },
        }),
      ),
    ).toBe(false);
  });

  it('does not classify an on-chain response as a terminal signed order', () => {
    expect(
      isSwapTerminalSignedNoSendBuildResult(
        createBuildResponse({
          ctx: { cowSwapOrderId: 'cow-order' },
          tx: '0xencoded',
        }),
      ),
    ).toBe(false);
  });

  it('builds history identity from the frozen execution inputs and signed order', () => {
    const { orderId, swapInfo } = buildSwapExecutionResultFromBuildResponse({
      buildSwapRes: createBuildResponse({
        ctx: { oneInchFusionOrderHash: 'fusion-order' },
        result: { ...quoteResult, fromAmount: '1.1', toAmount: '2.2' },
      }),
      currentFromToken: fromToken,
      currentToToken: toToken,
      fromAccountId: 'account-a',
      fromUserAddress: '0xsender',
      quoteResult,
      slippage: 0.5,
      toAccountId: 'account-b',
      toUserAddress: '0xreceiver',
    });

    expect(orderId).toBe('fusion-order');
    expect(swapInfo).toMatchObject({
      accountAddress: '0xsender',
      receivingAddress: '0xreceiver',
      sender: { amount: '1.1', accountInfo: { accountId: 'account-a' } },
      receiver: { amount: '2.2', accountInfo: { accountId: 'account-b' } },
      swapBuildResData: { result: { slippage: 0.5 } },
    });
  });

  it('persists a stale signed-no-send result exactly once without a UI write', async () => {
    const onCurrentRevision = jest.fn();
    const persistHistory = jest.fn(async () => {});

    await settleSwapSignedNoSendResult({
      isRevisionCurrent: false,
      onCurrentRevision,
      persistHistory,
    });

    expect(onCurrentRevision).not.toHaveBeenCalled();
    expect(persistHistory).toHaveBeenCalledTimes(1);
  });

  it('updates current UI and still persists history exactly once', async () => {
    const onCurrentRevision = jest.fn();
    const persistHistory = jest.fn(async () => {});

    await settleSwapSignedNoSendResult({
      isRevisionCurrent: true,
      onCurrentRevision,
      persistHistory,
    });

    expect(onCurrentRevision).toHaveBeenCalledTimes(1);
    expect(persistHistory).toHaveBeenCalledTimes(1);
  });
});
