/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { ESwapReviewApproveTransactionSource } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewState';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { MarketSwapReviewDialog } from './MarketSwapReviewDialog';

const swapReviewDialogMock = jest.fn<void, [unknown]>();

jest.mock(
  '@onekeyhq/kit/src/views/Swap/pages/components/SwapReviewDialog',
  () => ({
    SwapReviewDialog: (props: unknown) => {
      swapReviewDialogMock(props);
      return null;
    },
  }),
);

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

function createQuoteResult(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'onekey',
      providerName: 'OneKey',
    },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    ...overrides,
  };
}

describe('MarketSwapReviewDialog', () => {
  beforeEach(() => {
    swapReviewDialogMock.mockClear();
  });

  it('delegates to the generic swap review shell with market-specific config', () => {
    const onDone = jest.fn();
    const adapter = {
      prepareReview: jest.fn(),
      sendApproveTx: jest.fn(),
      sendSwapTx: jest.fn(),
      sendWrappedTx: jest.fn(),
      sendSignMessage: jest.fn(),
      buildApproveInfos: jest.fn(),
    };
    const reviewState = {
      steps: [],
      preSwapData: {
        fromToken,
        toToken,
        fromTokenAmount: '1',
        toTokenAmount: '2500',
      },
      quoteResult: createQuoteResult(),
    };

    render(
      <MarketSwapReviewDialog
        onDone={onDone}
        adapter={adapter}
        reviewState={reviewState}
      />,
    );

    expect(swapReviewDialogMock).toHaveBeenCalledWith({
      onDone,
      adapter,
      reviewState,
      storeName: EJotaiContextStoreNames.marketSwapReview,
      disableGlobalApproveSync: true,
      approveTransactionSource: ESwapReviewApproveTransactionSource.SpeedSwap,
      accountSelectorConfig: {
        config: {
          sceneName: 'swap',
          sceneUrl: '',
        },
        enabledNum: [0],
      },
    });
  });
});
