/** @jest-environment jsdom */

import { StrictMode } from 'react';
import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE,
  PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE,
} from '../purchasesSdk/purchaseWithStripeLoadingGuard';

import { purchaseWithPrimeEmbeddedWebCheckout } from './PrimeEmbeddedWebCheckout';

import type { PurchaseResult } from '@revenuecat/purchases-js';

const mockCloseDialog = jest.fn<Promise<void>, []>(async () => undefined);
let mockConfirmation: IDialogShowProps | undefined;
const mockCloseConfirmation = jest.fn<Promise<void>, []>(async () => {
  const confirmation = mockConfirmation;
  mockConfirmation = undefined;
  await confirmation?.onClose?.();
});
const mockMonitorStop = jest.fn();
let mockOnLoadingFailure: (() => void) | undefined;
let mockStrictMode = false;

jest.mock('../purchasesSdk/stripePaymentElementHealth', () => ({
  monitorStripePaymentElementLoading: (onFailure: () => void) => {
    mockOnLoadingFailure = onFailure;
    return mockMonitorStop;
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (props: IDialogShowProps) => {
      const { renderContent } = props;
      if (!renderContent) {
        mockConfirmation = props;
        return {
          close: mockCloseConfirmation,
          isExist: () => Boolean(mockConfirmation),
        };
      }
      render(
        mockStrictMode ? (
          <StrictMode>{renderContent}</StrictMode>
        ) : (
          renderContent
        ),
      );
      return { close: mockCloseDialog };
    },
  },
  Button: ({
    children,
    testID,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ),
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

type IPurchaseFixture = {
  root: HTMLElement;
  close: HTMLButtonElement;
  form: HTMLFormElement;
  cancel: () => void;
  resolve: (value: PurchaseResult) => void;
};
let fixture: IPurchaseFixture | undefined;
const purchase = jest.fn(
  (root: HTMLElement) =>
    new Promise<PurchaseResult>((resolve, reject) => {
      const close = document.createElement('button');
      close.className = 'close-button';
      close.type = 'button';
      const form = document.createElement('form');
      const cancel = () => {
        root.innerHTML = '';
        reject(Object.assign(new Error('User cancelled'), { errorCode: 1 }));
      };
      close.onclick = cancel;
      root.append(close, form);
      fixture = { root, close, form, cancel, resolve };
    }),
);

beforeEach(() => {
  jest.clearAllMocks();
  mockCloseDialog.mockReset().mockResolvedValue(undefined);
  mockStrictMode = false;
  fixture = undefined;
  mockConfirmation = undefined;
});

afterEach(() => {
  cleanup();
});

async function openCheckout() {
  let failure: unknown;
  let result: PurchaseResult | undefined;
  let complete: Promise<void> = Promise.resolve();
  await act(async () => {
    complete = purchaseWithPrimeEmbeddedWebCheckout(purchase).then(
      (value) => {
        result = value;
      },
      (error: unknown) => {
        failure = error;
      },
    );
  });
  return { complete, getFailure: () => failure, getResult: () => result };
}

async function confirmBrowserCheckout() {
  await mockConfirmation?.onConfirm?.({
    close: mockCloseConfirmation,
    preventClose: jest.fn(),
    getForm: () => undefined,
    isExist: () => Boolean(mockConfirmation),
  });
}

it('mounts the SDK into the app-owned target and waits for acknowledged cancellation before returning hosted intent', async () => {
  const { complete, getFailure } = await openCheckout();
  const root = screen.getByTestId('prime-embedded-checkout-target');
  expect(purchase).toHaveBeenCalledWith(root);
  const button = screen.getByTestId('prime-embedded-checkout-open-browser');
  expect(button).toHaveProperty('disabled', false);
  expect(button.textContent).toBe('explore.open_in_browser');
  let releaseClose: (() => void) | undefined;
  mockCloseDialog.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        releaseClose = resolve;
      }),
  );

  await act(async () => {
    fireEvent.click(button);
  });
  expect(root.childNodes.length).toBe(2);
  expect(mockCloseDialog).not.toHaveBeenCalled();
  expect(mockConfirmation).toMatchObject({
    description: ETranslations.prime_external_wallet_checkout__desc,
    showCancelButton: true,
    showConfirmButton: true,
  });
  expect(
    screen.queryByText(ETranslations.prime_external_wallet_checkout__desc),
  ).toBeNull();
  await act(async () => {
    await confirmBrowserCheckout();
  });
  expect(root.childNodes.length).toBe(0);
  expect(mockCloseConfirmation).toHaveBeenCalledTimes(1);
  expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  expect(getFailure()).toBeUndefined();
  await act(async () => {
    releaseClose?.();
    await complete;
  });
  expect(getFailure()).toMatchObject({
    message: PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE,
  });
  expect(mockMonitorStop).toHaveBeenCalledTimes(1);
});

it('keeps the embedded form open after dismissing the browser confirmation and permits another attempt', async () => {
  const { complete, getFailure } = await openCheckout();
  const button = screen.getByTestId('prime-embedded-checkout-open-browser');
  await act(async () => {
    fireEvent.click(button);
    await mockCloseConfirmation();
  });
  expect(fixture?.root.childNodes.length).toBe(2);
  expect(mockCloseDialog).not.toHaveBeenCalled();
  expect(getFailure()).toBeUndefined();
  await act(async () => {
    fireEvent.click(button);
  });
  expect(mockConfirmation).toBeDefined();
  await act(async () => {
    await confirmBrowserCheckout();
    await complete;
  });
  expect(getFailure()).toMatchObject({
    message: PRIME_HOSTED_CHECKOUT_REQUESTED_MESSAGE,
  });
});

it('rejects a stale browser confirmation if the form was submitted while it was open', async () => {
  const { complete, getFailure } = await openCheckout();
  await act(async () => {
    fireEvent.click(screen.getByTestId('prime-embedded-checkout-open-browser'));
    if (fixture) fireEvent.submit(fixture.form);
    await confirmBrowserCheckout();
  });
  expect(fixture?.root.childNodes.length).toBe(2);
  expect(mockCloseDialog).not.toHaveBeenCalled();
  expect(getFailure()).toBeUndefined();
  await act(async () => {
    fixture?.cancel();
    await complete;
  });
  expect(getFailure()).toMatchObject({ errorCode: 1 });
});

it('closes an open browser confirmation if the SDK finishes first', async () => {
  const { complete, getFailure } = await openCheckout();
  await act(async () => {
    fireEvent.click(screen.getByTestId('prime-embedded-checkout-open-browser'));
  });
  const staleConfirmation = mockConfirmation;
  await act(async () => {
    fixture?.cancel();
    await complete;
  });
  expect(mockCloseConfirmation).toHaveBeenCalledTimes(1);
  expect(mockConfirmation).toBeUndefined();
  expect(getFailure()).toMatchObject({ errorCode: 1 });
  await act(async () => {
    await staleConfirmation?.onConfirm?.({
      close: mockCloseConfirmation,
      preventClose: jest.fn(),
      getForm: () => undefined,
      isExist: () => false,
    });
  });
  expect(getFailure()).toMatchObject({ errorCode: 1 });
});

it('preserves loading-error fallback in the custom target', async () => {
  const { complete, getFailure } = await openCheckout();
  await act(async () => {
    mockOnLoadingFailure?.();
    await complete;
  });
  expect(getFailure()).toMatchObject({
    message: PRIME_STRIPE_FORM_LOAD_FAILED_MESSAGE,
  });
  expect(fixture?.root.childNodes.length).toBe(0);
  expect(mockCloseDialog).toHaveBeenCalledTimes(1);
});

it('never offers another checkout after form submission, including a later loading error', async () => {
  const { complete, getFailure, getResult } = await openCheckout();
  const current = fixture;
  expect(current).toBeDefined();
  if (!current) throw new OneKeyLocalError('Missing purchase fixture');
  await act(async () => {
    fireEvent.submit(current.form);
  });
  const button = screen.getByTestId('prime-embedded-checkout-open-browser');
  expect(button).toHaveProperty('disabled', true);
  await act(async () => {
    fireEvent.click(button);
    mockOnLoadingFailure?.();
  });
  expect(mockCloseDialog).not.toHaveBeenCalled();
  expect(current.root.childNodes.length).toBe(2);
  expect(getFailure()).toBeUndefined();

  const result: PurchaseResult = {
    customerInfo: {
      activeSubscriptions: new Set<string>(),
      entitlements: { active: {}, all: {} },
      firstSeenDate: new Date(),
      managementURL: null,
      originalAppUserId: 'test-user',
      originalPurchaseDate: null,
      requestDate: new Date(),
      allExpirationDatesByProduct: {},
      allPurchaseDatesByProduct: {},
    },
    redemptionInfo: null,
  };
  await act(async () => {
    current.resolve(result);
    await complete;
  });
  expect(getResult()).toBe(result);
});

it('does not treat an ordinary SDK close as a request for browser payment', async () => {
  const { complete, getFailure } = await openCheckout();
  await act(async () => {
    fixture?.cancel();
    await complete;
  });
  expect(getFailure()).toMatchObject({ errorCode: 1 });
  expect(mockCloseDialog).toHaveBeenCalledTimes(1);
});

it('starts the SDK only once under Strict Mode', async () => {
  mockStrictMode = true;
  const { complete } = await openCheckout();
  expect(purchase).toHaveBeenCalledTimes(1);
  await act(async () => {
    fixture?.cancel();
    await complete;
  });
});
