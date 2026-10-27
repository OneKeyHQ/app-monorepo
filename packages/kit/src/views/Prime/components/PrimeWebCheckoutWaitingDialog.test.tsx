/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { showPrimeWebCheckoutWaitingDialog } from './PrimeWebCheckoutWaitingDialog';

import type { settlePrimeWebCheckout } from '../hooks/primeWebCheckout';
import type { IPrimeWebCheckoutResult } from '../hooks/primeWebCheckoutResult';

const mockClose = jest.fn<Promise<void>, []>();
const mockSettle = jest.fn<
  ReturnType<typeof settlePrimeWebCheckout>,
  Parameters<typeof settlePrimeWebCheckout>
>();
const mockFinish = jest.fn<Promise<void>, [unknown]>();
const mockToast = jest.fn<void, []>();
const mockIsUserCurrent = jest.fn<Promise<boolean>, [string]>();
const mockWait = jest.fn<Promise<void>, [number]>();
let mockOnSuccess:
  | ((result: IPrimeWebCheckoutResult | undefined) => void | Promise<void>)
  | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: ({ renderContent }: IDialogShowProps) => {
      render(renderContent);
      return { close: mockClose };
    },
    Footer: () => null,
  },
  useDialogInstance: () => ({ close: mockClose }),
  Button: () => null,
  LottieView: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => <>{children}</>,
  YStack: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Toast: { message: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    PrimeWebCheckoutReturned: 'PrimeWebCheckoutReturned',
    IdentityLifecycleCommitted: 'IdentityLifecycleCommitted',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: (delay: number) => mockWait(delay) },
}));
jest.mock('../hooks/primeWebCheckout', () => ({
  markPrimeWebCheckoutMonitored: () => () => undefined,
  settlePrimeWebCheckout: (
    ...params: Parameters<typeof settlePrimeWebCheckout>
  ) => mockSettle(...params),
  finishPrimeWebCheckoutSuccess: (payload: unknown) => mockFinish(payload),
  showPrimeWebCheckoutSuccessToast: () => mockToast(),
  isPrimeWebCheckoutUserCurrent: (onekeyUserId: string) =>
    mockIsUserCurrent(onekeyUserId),
}));
jest.mock('../hooks/usePrimePurchaseMonitor', () => ({
  usePrimePurchaseMonitor: ({
    onSuccess,
  }: {
    onSuccess: (
      result: IPrimeWebCheckoutResult | undefined,
    ) => void | Promise<void>;
  }) => {
    mockOnSuccess = onSuccess;
    return { refresh: jest.fn(), isTimedOut: false };
  },
}));

const session: IPrimeWebCheckoutPendingSession = {
  checkoutId: 'checkout-1',
  onekeyUserId: 'user-1',
  subscriptionPeriod: 'P1Y',
  packageId: '$rc_annual',
  offeringId: 'Sandbox_testing',
  amount: 99,
  currency: 'USD',
  isSandbox: true,
  platform: 'extension',
  checkoutUrl: 'https://pay.rev.cat/sandbox/test/user-1',
  startedAt: Date.now(),
};
const result: IPrimeWebCheckoutResult = {
  status: 'succeeded',
  entitlement: {
    isActive: true,
    store: 'rc_billing',
    latestPurchaseDate: new Date(),
    isSandbox: true,
    periodType: 'normal',
    productIdentifier: 'prime_yearly',
  },
};
const successPayload = { onekeyUserId: 'user-1', claimId: 'claim-1' };

async function completeCheckout() {
  if (!mockOnSuccess) {
    throw new OneKeyLocalError('Waiting dialog monitor did not mount');
  }
  await mockOnSuccess(result);
}

describe('hosted checkout waiting-dialog success handoff', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockClose.mockResolvedValue(undefined);
    mockWait.mockResolvedValue(undefined);
    mockFinish.mockResolvedValue(undefined);
    mockIsUserCurrent.mockResolvedValue(true);
    mockSettle.mockResolvedValue({ outcome: 'succeeded', successPayload });
    showPrimeWebCheckoutWaitingDialog({ session });
    // Opening the singleton also closes the preceding test's dialog.
    mockClose.mockClear();
  });

  afterEach(cleanup);

  it('closes and waits for the animation before finishing, then shows success', async () => {
    await act(completeCheckout);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockWait).toHaveBeenCalledWith(350);
    expect(mockFinish).toHaveBeenCalledWith(successPayload);
    expect(mockWait.mock.invocationCallOrder[0]).toBeLessThan(
      mockFinish.mock.invocationCallOrder[0],
    );
    expect(mockFinish.mock.invocationCallOrder[0]).toBeLessThan(
      mockToast.mock.invocationCallOrder[0],
    );
  });

  it('finishes once even when the success toast throws', async () => {
    mockToast.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Toast unavailable');
    });

    await act(completeCheckout);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledWith(successPayload);
  });

  it('finishes once even when closing the dialog rejects', async () => {
    mockClose.mockRejectedValueOnce(new OneKeyLocalError('Dialog unavailable'));

    await act(completeCheckout);

    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledWith(successPayload);
  });

  it('preserves the original account handoff without toasting on the new account', async () => {
    mockIsUserCurrent.mockResolvedValue(false);

    await act(completeCheckout);

    expect(mockFinish).toHaveBeenCalledWith(successPayload);
    expect(mockIsUserCurrent).toHaveBeenCalledWith('user-1');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('finishes before a delayed identity read and tolerates its rejection', async () => {
    let rejectRead: ((error: Error) => void) | undefined;
    mockIsUserCurrent.mockImplementationOnce(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectRead = reject;
        }),
    );
    let completion: Promise<void> | undefined;
    await act(async () => {
      completion = completeCheckout();
    });

    expect(mockFinish).toHaveBeenCalledWith(successPayload);
    expect(mockIsUserCurrent).toHaveBeenCalledTimes(1);
    await act(async () => {
      rejectRead?.(new OneKeyLocalError('Identity unavailable'));
      await completion;
    });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('only closes when another surface already settled the checkout', async () => {
    mockSettle.mockResolvedValue(undefined);

    await act(completeCheckout);

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockFinish).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('leaves the checkout recoverable if settlement fails', async () => {
    mockSettle.mockRejectedValueOnce(
      new OneKeyLocalError('Storage unavailable'),
    );

    await act(async () => {
      await expect(completeCheckout()).rejects.toThrow('Storage unavailable');
    });

    expect(mockClose).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
