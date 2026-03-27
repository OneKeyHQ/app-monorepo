/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { MarketSwapReviewDialog } from './MarketSwapReviewDialog';

const useMarketSwapReviewActionsMock = jest.fn();
const removeStoreMock = jest.fn();

jest.mock('@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore', () => ({
  jotaiContextStore: {
    removeStore: (...args: unknown[]) => {
      removeStoreMock(...args);
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
    enabledNum,
  }: {
    children?: ReactNode;
    enabledNum: number[];
  }) => (
    <div data-enabled-num={enabledNum.join(',')} data-testid="account-selector">
      {children}
    </div>
  ),
}));

jest.mock('@onekeyhq/kit/src/views/Swap/pages/SwapProviderMirror', () => ({
  SwapProviderMirror: ({
    children,
    storeName,
  }: {
    children?: ReactNode;
    storeName: string;
  }) => (
    <div data-store-name={storeName} data-testid="swap-provider">
      {children}
    </div>
  ),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Swap/pages/components/PreSwapDialogContent',
  () => ({
    __esModule: true,
    default: ({
      disableGlobalApproveSync,
      onConfirm,
      onDone,
    }: {
      disableGlobalApproveSync?: boolean;
      onConfirm: () => void;
      onDone: () => void;
    }) => (
      <div
        data-disable-global-approve-sync={
          disableGlobalApproveSync ? 'true' : 'false'
        }
        data-testid="pre-swap-dialog-content"
      >
        <button data-testid="review-confirm" onClick={onConfirm} type="button">
          confirm
        </button>
        <button data-testid="review-done" onClick={onDone} type="button">
          done
        </button>
      </div>
    ),
  }),
);

jest.mock('./hooks/useMarketSwapReviewActions', () => ({
  useMarketSwapReviewActions: (props: unknown) =>
    useMarketSwapReviewActionsMock(props) as {
      onConfirm: () => void;
      preSwapBeforeStepActions: () => void;
      preSwapStepsStart: () => void;
    },
}));

jest.mock('./MarketSwapReviewInitializer', () => ({
  MarketSwapReviewInitializer: ({
    children,
    reviewState,
  }: {
    children?: ReactNode;
    reviewState: { steps: unknown[] };
  }) => (
    <div data-step-count={reviewState.steps.length} data-testid="initializer">
      {children}
    </div>
  ),
}));

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
    removeStoreMock.mockClear();
    useMarketSwapReviewActionsMock.mockReturnValue({
      onConfirm: jest.fn(),
      preSwapBeforeStepActions: jest.fn(),
      preSwapStepsStart: jest.fn(),
    });
  });

  it('uses the isolated market swap review store and binds the market review adapter', () => {
    const onDone = jest.fn();
    const adapter = {
      prepareMarketSwapReview: jest.fn(),
      sendMarketApproveTx: jest.fn(),
      sendMarketSwapTx: jest.fn(),
      sendMarketWrappedTx: jest.fn(),
      sendMarketSignMessage: jest.fn(),
      buildMarketApproveInfos: jest.fn(),
    };

    render(
      <MarketSwapReviewDialog
        onDone={onDone}
        adapter={adapter}
        reviewState={{
          steps: [],
          preSwapData: {
            fromToken,
            toToken,
            fromTokenAmount: '1',
            toTokenAmount: '2500',
          },
          quoteResult: createQuoteResult(),
        }}
      />,
    );

    expect(
      screen.getByTestId('account-selector').getAttribute('data-enabled-num'),
    ).toBe('0');
    expect(
      screen.getByTestId('swap-provider').getAttribute('data-store-name'),
    ).toBe(EJotaiContextStoreNames.marketSwapReview);
    expect(
      screen.getByTestId('initializer').getAttribute('data-step-count'),
    ).toBe('0');
    expect(
      screen
        .getByTestId('pre-swap-dialog-content')
        .getAttribute('data-disable-global-approve-sync'),
    ).toBe('true');
    expect(useMarketSwapReviewActionsMock).toHaveBeenCalledWith({
      adapter,
    });

    fireEvent.click(screen.getByTestId('review-confirm'));
    fireEvent.click(screen.getByTestId('review-done'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cleans up the isolated review store on unmount', () => {
    const { unmount } = render(
      <MarketSwapReviewDialog
        onDone={jest.fn()}
        adapter={{
          prepareMarketSwapReview: jest.fn(),
          sendMarketApproveTx: jest.fn(),
          sendMarketSwapTx: jest.fn(),
          sendMarketWrappedTx: jest.fn(),
          sendMarketSignMessage: jest.fn(),
          buildMarketApproveInfos: jest.fn(),
        }}
        reviewState={{
          steps: [],
          preSwapData: {
            fromToken,
            toToken,
            fromTokenAmount: '1',
            toTokenAmount: '2500',
          },
          quoteResult: createQuoteResult(),
        }}
      />,
    );

    unmount();

    expect(removeStoreMock).toHaveBeenCalledWith({
      storeName: EJotaiContextStoreNames.marketSwapReview,
    });
  });
});
