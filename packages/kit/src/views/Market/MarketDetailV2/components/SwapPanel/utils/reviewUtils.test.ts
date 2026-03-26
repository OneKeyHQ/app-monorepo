import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EProtocolOfExchange,
  ESwapStepType,
  type IFetchQuoteResult,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildMarketSwapApproveInfos,
  buildMarketSwapReviewState,
  createWrappedMarketSwapReviewQuote,
  marketSwapBatchTransferTypes,
} from './reviewUtils';

const mockFromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'ETH',
  decimals: 18,
  name: 'Ethereum',
  isNative: true,
  logoURI: 'https://example.com/eth.png',
};

const mockToToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'USDC',
  decimals: 6,
  name: 'USD Coin',
  isNative: false,
  logoURI: 'https://example.com/usdc.png',
};

const mockQuoteResult: IFetchQuoteResult = {
  protocol: EProtocolOfExchange.SWAP,
  info: {
    provider: 'socket',
    providerName: 'Socket',
    providerLogo: 'https://example.com/socket.png',
  },
  fromAmount: '1',
  toAmount: '2500',
  minToAmount: '2475',
  fromTokenInfo: mockFromToken,
  toTokenInfo: mockToToken,
  fee: {
    percentageFee: 0.3,
  },
};

const formatMessage = ({ id }: { id: ETranslations }) => id;

describe('buildMarketSwapApproveInfos', () => {
  it('returns empty approve infos when allowance result is missing', () => {
    expect(
      buildMarketSwapApproveInfos({
        allowanceResult: undefined,
        amount: '1',
        owner: '0xowner',
        fromToken: mockFromToken,
      }),
    ).toEqual([]);
  });

  it('builds one approve transaction when reset approve is not needed', () => {
    const approveInfos = buildMarketSwapApproveInfos({
      allowanceResult: {
        allowanceTarget: '0xspender',
        amount: '1',
      },
      amount: '1',
      owner: '0xowner',
      fromToken: mockFromToken,
    });

    expect(approveInfos).toHaveLength(1);
    expect(approveInfos[0]).toMatchObject({
      owner: '0xowner',
      spender: '0xspender',
      amount: '1',
      isMax: true,
    });
  });

  it('builds reset + approve transactions when reset approve is needed', () => {
    const approveInfos = buildMarketSwapApproveInfos({
      allowanceResult: {
        allowanceTarget: '0xspender',
        amount: '1',
        shouldResetApprove: true,
      },
      amount: '1',
      owner: '0xowner',
      fromToken: mockFromToken,
    });

    expect(approveInfos).toHaveLength(2);
    expect(approveInfos[0]).toMatchObject({
      owner: '0xowner',
      spender: '0xspender',
      amount: '0',
      isMax: false,
    });
    expect(approveInfos[1]).toMatchObject({
      owner: '0xowner',
      spender: '0xspender',
      amount: '1',
      isMax: true,
    });
  });
});

describe('buildMarketSwapReviewState', () => {
  it('builds wrap review state for wrapped pairs', () => {
    const reviewState = buildMarketSwapReviewState({
      formatMessage,
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1.5',
      isHWAndExBatchTransfer: false,
      needFetchGas: false,
      quoteResult: createWrappedMarketSwapReviewQuote({
        fromToken: mockFromToken,
        toToken: mockToToken,
        fromTokenAmount: '1.5',
        providerLogo: 'https://example.com/wrapped.png',
      }),
      shouldFallback: false,
      slippage: 0.5,
      supportPreBuild: false,
      swapBatchTransferType: marketSwapBatchTransferTypes.normal,
    });

    expect(reviewState.steps).toHaveLength(1);
    expect(reviewState.steps[0].type).toBe(ESwapStepType.WRAP_TX);
    expect(reviewState.preSwapData).toMatchObject({
      fromTokenAmount: '1.5',
      toTokenAmount: '1.5',
      supportNetworkFeeLevel: true,
      supportPreBuild: false,
      shouldFallback: false,
    });
    expect(reviewState.preSwapData.slippage).toBeUndefined();
  });

  it('builds approve + sign steps when the quote needs a signature', () => {
    const reviewState = buildMarketSwapReviewState({
      formatMessage,
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1',
      isHWAndExBatchTransfer: true,
      needFetchGas: true,
      quoteResult: {
        ...mockQuoteResult,
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
          shouldResetApprove: true,
        },
        swapShouldSignedData: {
          unSignedInfo: {
            origin: 'https://app.onekey.so',
            scope: 'market-review',
            signedType: EMessageTypesEth.TYPED_DATA_V4,
          },
        } as IFetchQuoteResult['swapShouldSignedData'],
      },
      shouldFallback: false,
      slippage: 0.5,
      supportPreBuild: true,
      swapBatchTransferType: marketSwapBatchTransferTypes.normal,
    });

    expect(reviewState.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SIGN_MESSAGE,
    ]);
    expect(reviewState.preSwapData.supportNetworkFeeLevel).toBeUndefined();
    expect(reviewState.preSwapData.isHWAndExBatchTransfer).toBe(true);
    expect(reviewState.preSwapData.needFetchGas).toBe(true);
  });

  it('builds a batch approve step when batch transfer is available', () => {
    const reviewState = buildMarketSwapReviewState({
      formatMessage,
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1',
      isHWAndExBatchTransfer: false,
      needFetchGas: false,
      quoteResult: {
        ...mockQuoteResult,
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
      },
      shouldFallback: false,
      slippage: 0.5,
      supportPreBuild: true,
      swapBatchTransferType: marketSwapBatchTransferTypes.batchApproveAndSwap,
    });

    expect(reviewState.steps).toHaveLength(1);
    expect(reviewState.steps[0]).toMatchObject({
      type: ESwapStepType.BATCH_APPROVE_SWAP,
      stepActionsLabel: ETranslations.swap_page_approve_and_swap,
    });
  });

  it('builds approve + swap state for standard speed swap quotes', () => {
    const reviewState = buildMarketSwapReviewState({
      formatMessage,
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1',
      isHWAndExBatchTransfer: false,
      needFetchGas: true,
      quoteResult: {
        ...mockQuoteResult,
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
      },
      shouldFallback: true,
      slippage: 0.5,
      supportPreBuild: true,
      swapBatchTransferType: marketSwapBatchTransferTypes.normal,
    });

    expect(reviewState.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SEND_TX,
    ]);
    expect(reviewState.preSwapData).toMatchObject({
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      minToAmount: '2475',
      providerInfo: mockQuoteResult.info,
      slippage: 0.5,
      unSupportSlippage: false,
      supportNetworkFeeLevel: true,
      supportPreBuild: true,
      needFetchGas: true,
      shouldFallback: true,
    });
  });
});

describe('createWrappedMarketSwapReviewQuote', () => {
  it('builds a wrapped quote snapshot from the current pair', () => {
    const wrappedQuote = createWrappedMarketSwapReviewQuote({
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1.5',
      providerLogo: 'https://example.com/wrapped.png',
    });

    expect(wrappedQuote).toMatchObject({
      protocol: EProtocolOfExchange.SWAP,
      isWrapped: true,
      fromAmount: '1.5',
      toAmount: '1.5',
      fromTokenInfo: mockFromToken,
      toTokenInfo: mockToToken,
      fee: {
        percentageFee: 0,
      },
      info: {
        provider: 'wrapped',
        providerName: 'wrapped',
        providerLogo: 'https://example.com/wrapped.png',
      },
    });
    expect(wrappedQuote.unSupportSlippage).toBe(true);
  });
});
