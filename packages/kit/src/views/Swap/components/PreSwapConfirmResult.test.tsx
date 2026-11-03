/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapStep } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapStepStatus,
  ESwapStepType,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapConfirmResult, {
  SwapTransactionResultStatus,
} from './PreSwapConfirmResult';

const mockLottiePause = jest.fn();
const mockLottieResume = jest.fn();

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    testID,
    onPress,
  }: PropsWithChildren<{ testID?: string; onPress?: () => void }>) {
    return onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  }
  return {
    AnimatePresence: MockStack,
    Button: MockStack,
    Icon: ({ name }: { name: string }) => (
      <span data-testid="result-icon">{name}</span>
    ),
    Illustration: ({ name }: { name: string }) => (
      <span data-testid="result-illustration">{name}</span>
    ),
    LottieView: jest
      .requireActual<typeof import('react')>('react')
      .forwardRef(function MockLottie(_props, ref) {
        jest
          .requireActual<typeof import('react')>('react')
          .useImperativeHandle(ref, () => ({
            play: jest.fn(),
            pause: mockLottiePause,
            resume: mockLottieResume,
            reset: jest.fn(),
          }));
        return <span data-testid="result-lottie" />;
      }),
    SizableText: MockStack,
    XStack: MockStack,
    YStack: MockStack,
    useMedia: () => ({ md: false }),
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceExplorer: { buildExplorerUrl: jest.fn().mockResolvedValue('') },
  },
}));
jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  SUPPORT_URL: 'https://help.onekey.so',
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  showIntercom: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('../utils/utils', () => ({
  truncateMiddle: (value: string) => value,
}));

const failedStep: ISwapStep = {
  type: ESwapStepType.SEND_TX,
  status: ESwapStepStatus.FAILED,
  errorMessage: 'rpc timeout',
};

describe('PreSwapConfirmResult', () => {
  it('offers Retry for an ordinary failed step', () => {
    const onConfirm = jest.fn();
    render(
      <PreSwapConfirmResult lastStep={failedStep} onConfirm={onConfirm} />,
    );

    expect(
      screen.getByText(ETranslations.swap_review_transaction_failed),
    ).toBeTruthy();
    expect(screen.getByText('rpc timeout')).toBeTruthy();
    expect(screen.getByTestId('result-illustration').textContent).toBe('XMark');
    const button = screen.getByText(ETranslations.global_retry);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows the check-activity state with Done after a result-unknown send', () => {
    // OK-64746: the tx may already be on chain, so the page must not read as
    // a plain failure nor invite a retry of the same swap.
    const onConfirm = jest.fn();
    render(
      <PreSwapConfirmResult
        lastStep={{
          ...failedStep,
          canRetry: false,
          submitResultUnknown: true,
          errorMessage:
            ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
        }}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByText(
        ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.swap_review_transaction_failed),
    ).toBeNull();
    expect(screen.queryByText(ETranslations.global_retry)).toBeNull();
    expect(screen.queryByTestId('result-illustration')).toBeNull();
    expect(screen.getByTestId('result-lottie')).toBeTruthy();
    fireEvent.click(screen.getByText(ETranslations.global_done));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('SwapTransactionResultStatus', () => {
  beforeEach(() => {
    mockLottiePause.mockClear();
    mockLottieResume.mockClear();
  });

  it('holds the pending hourglass while paused and resumes it after', () => {
    const { rerender } = render(
      <SwapTransactionResultStatus status="pending" />,
    );
    expect(mockLottiePause).not.toHaveBeenCalled();
    expect(mockLottieResume).not.toHaveBeenCalled();

    rerender(<SwapTransactionResultStatus status="pending" paused />);
    expect(mockLottiePause).toHaveBeenCalledTimes(1);

    rerender(<SwapTransactionResultStatus status="pending" />);
    expect(mockLottieResume).toHaveBeenCalledTimes(1);
  });

  it('starts held when it mounts paused', () => {
    render(<SwapTransactionResultStatus status="pending" paused />);
    expect(mockLottiePause).toHaveBeenCalledTimes(1);
  });
});
