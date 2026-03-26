import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EProtocolOfExchange,
  type IFetchQuoteResult,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildMarketSwapApproveInfos,
  buildMarketSwapReviewData,
  createWrappedMarketSwapReviewQuote,
  getMarketSwapReviewActionTranslationId,
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

describe('buildMarketSwapReviewData', () => {
  it('builds review data with slippage for normal quotes', () => {
    const reviewData = buildMarketSwapReviewData({
      quoteResult: mockQuoteResult,
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1',
      slippage: 0.5,
      isHWAndExBatchTransfer: true,
    });

    expect(reviewData).toMatchObject({
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      minToAmount: '2475',
      slippage: 0.5,
      unSupportSlippage: false,
      supportNetworkFeeLevel: false,
      isHWAndExBatchTransfer: true,
    });
  });

  it('drops slippage when quote does not support slippage', () => {
    const reviewData = buildMarketSwapReviewData({
      quoteResult: {
        ...mockQuoteResult,
        unSupportSlippage: true,
      },
      fromToken: mockFromToken,
      toToken: mockToToken,
      fromTokenAmount: '1',
      slippage: 0.5,
    });

    expect(reviewData.slippage).toBeUndefined();
    expect(reviewData.unSupportSlippage).toBe(true);
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

describe('getMarketSwapReviewActionTranslationId', () => {
  it('returns 3 confirmations for hardware wallets with reset approve', () => {
    expect(
      getMarketSwapReviewActionTranslationId({
        isExternalWallet: false,
        isHWAndExBatchTransfer: true,
        isHwWallet: true,
        shouldResetApprove: true,
      }),
    ).toBe(ETranslations.swap_review_confirm_3_on_device);
  });

  it('returns 2 confirmations for external wallets without reset approve', () => {
    expect(
      getMarketSwapReviewActionTranslationId({
        isExternalWallet: true,
        isHWAndExBatchTransfer: true,
        isHwWallet: false,
        shouldResetApprove: false,
      }),
    ).toBe(ETranslations.swap_review_confirm_2_on_wallet);
  });

  it('falls back to the default confirm action', () => {
    expect(
      getMarketSwapReviewActionTranslationId({
        isExternalWallet: false,
        isHWAndExBatchTransfer: false,
        isHwWallet: false,
        shouldResetApprove: false,
      }),
    ).toBe(ETranslations.global_confirm);
  });
});
