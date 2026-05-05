/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ESwapReviewApproveTransactionSource } from '../../utils/swapReviewState';

import { SwapReviewDialog } from './SwapReviewDialog';

const useSwapReviewActionsMock = jest.fn();
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

jest.mock('../SwapProviderMirror', () => ({
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

jest.mock('./PreSwapDialogContent', () => ({
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
}));

jest.mock('../../hooks/useSwapReviewActions', () => ({
  useSwapReviewActions: (props: unknown) =>
    useSwapReviewActionsMock(props) as {
      onConfirm: () => void;
      preSwapBeforeStepActions: () => void;
      preSwapStepsStart: () => void;
    },
}));

jest.mock('./SwapReviewInitializer', () => ({
  SwapReviewInitializer: ({
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

describe('SwapReviewDialog', () => {
  beforeEach(() => {
    removeStoreMock.mockClear();
    useSwapReviewActionsMock.mockReturnValue({
      onConfirm: jest.fn(),
      preSwapBeforeStepActions: jest.fn(),
      preSwapStepsStart: jest.fn(),
    });
  });

  it('renders the reusable swap review shell with the provided store and adapter', () => {
    const onDone = jest.fn();
    const adapter = {
      prepareReview: jest.fn(),
      sendApproveTx: jest.fn(),
      sendSwapTx: jest.fn(),
      sendWrappedTx: jest.fn(),
      sendSignMessage: jest.fn(),
      buildApproveInfos: jest.fn(),
    };

    render(
      <SwapReviewDialog
        onDone={onDone}
        adapter={adapter}
        reviewState={{
          steps: [],
          preSwapData: {},
          quoteResult: undefined,
        }}
        storeName={EJotaiContextStoreNames.marketSwapReview}
        disableGlobalApproveSync
        approveTransactionSource={ESwapReviewApproveTransactionSource.SpeedSwap}
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
    expect(useSwapReviewActionsMock).toHaveBeenCalledWith({
      adapter,
      approveTransactionSource: ESwapReviewApproveTransactionSource.SpeedSwap,
    });

    fireEvent.click(screen.getByTestId('review-confirm'));
    fireEvent.click(screen.getByTestId('review-done'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cleans up the provided review store on unmount', () => {
    const { unmount } = render(
      <SwapReviewDialog
        onDone={jest.fn()}
        adapter={{
          prepareReview: jest.fn(),
          sendApproveTx: jest.fn(),
          sendSwapTx: jest.fn(),
          sendWrappedTx: jest.fn(),
          sendSignMessage: jest.fn(),
          buildApproveInfos: jest.fn(),
        }}
        reviewState={{
          steps: [],
          preSwapData: {},
          quoteResult: undefined,
        }}
        storeName={EJotaiContextStoreNames.marketSwapReview}
      />,
    );

    unmount();

    expect(removeStoreMock).toHaveBeenCalledWith({
      storeName: EJotaiContextStoreNames.marketSwapReview,
    });
  });
});
