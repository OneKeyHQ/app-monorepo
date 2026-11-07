/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

// Pay-block layout handlers the zone registered, newest last: jsdom has no
// layout pass, so tests report measurements through these.
const mockLayoutHandlers: ((event: {
  nativeEvent: { layout: { height: number } };
}) => void)[] = [];

jest.mock('@onekeyhq/components', () => {
  const { createElement, Fragment } =
    jest.requireActual<typeof import('react')>('react');
  const passthrough = ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children);
  const box = ({
    children,
    testID,
    minHeight,
    onLayout,
  }: {
    children?: ReactNode;
    testID?: string;
    minHeight?: number;
    onLayout?: (typeof mockLayoutHandlers)[number];
  }) => {
    if (onLayout) {
      mockLayoutHandlers.push(onLayout);
    }
    return createElement(
      'div',
      { 'data-testid': testID, 'data-min-height': minHeight },
      children,
    );
  };
  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      createElement(
        'button',
        { type: 'button', 'data-testid': testID, onClick: onPress },
        children,
      ),
    Icon: () => null,
    SizableText: passthrough,
    Spinner: () => null,
    Stack: box,
    XStack: box,
    YStack: box,
  };
});

const mockStorage = new Map<string, number>();
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getNumber: (key: string) => mockStorage.get(key),
      set: (key: string, value: number) => {
        mockStorage.set(key, value);
      },
    },
  },
}));

import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { BuyActionZone } from './BuyActionZone';
import { EBuyActionState } from './types';

const ZONE_HEIGHT_KEY = EAppSyncStorageKeys.onekey_onramper_pay_zone_height;

beforeEach(() => {
  mockStorage.clear();
  mockLayoutHandlers.length = 0;
});

function renderZone(
  onViewOrder?: () => void,
  {
    offerWebFallback,
    errorText,
    onSwitchAccount,
  }: {
    offerWebFallback?: boolean;
    errorText?: string;
    onSwitchAccount?: () => void;
  } = {},
) {
  const onRetry = jest.fn();
  const onWebFallback = jest.fn();
  render(
    <BuyActionZone
      state={EBuyActionState.RetryableError}
      nativeButton={null}
      isMock={false}
      errorText={errorText}
      onMockPay={() => {}}
      onRetry={onRetry}
      onViewOrder={onViewOrder}
      onWebFallback={onWebFallback}
      offerWebFallback={offerWebFallback}
      onSwitchAccount={onSwitchAccount}
    />,
  );
  return { onRetry, onWebFallback };
}

describe('BuyActionZone retryable error', () => {
  it('offers an in-place retry', () => {
    const { onRetry } = renderZone();

    fireEvent.click(screen.getByTestId('headless-buy-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('headless-buy-view-order')).toBeNull();
    expect(screen.queryByTestId('headless-buy-retry-web-fallback')).toBeNull();
  });

  it('offers the web widget under the retry after a declined payment', () => {
    const { onRetry, onWebFallback } = renderZone(undefined, {
      offerWebFallback: true,
    });

    expect(screen.getByTestId('headless-buy-retry')).toBeTruthy();
    fireEvent.click(screen.getByTestId('headless-buy-retry-web-fallback'));

    expect(onWebFallback).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('sends the user to the order instead of a one-tap retry when the payment outcome is unknown', () => {
    const onViewOrder = jest.fn();
    const { onRetry } = renderZone(onViewOrder);

    // Paying again while the first payment may have gone through could
    // charge twice: the only action here is checking that order.
    expect(screen.queryByTestId('headless-buy-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('headless-buy-view-order'));

    expect(onViewOrder).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('states the failure right above the action that answers it', () => {
    renderZone(undefined, { errorText: 'Payment declined' });

    const error = screen.getByTestId('headless-buy-zone-error');
    expect(error.textContent).toBe('Payment declined');
    // Document order is visual order: the reason comes before the retry.
    expect(
      error.compareDocumentPosition(screen.getByTestId('headless-buy-retry')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('offers verifying another email only when there may be a login to drop', () => {
    const onSwitchAccount = jest.fn();
    renderZone(undefined, { onSwitchAccount });

    fireEvent.click(screen.getByTestId('headless-buy-switch-account'));

    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
  });

  it('leaves the switch-account action out without a login', () => {
    renderZone();

    expect(screen.queryByTestId('headless-buy-switch-account')).toBeNull();
  });
});

function renderFallback(onRetryInit?: () => void) {
  const onWebFallback = jest.fn();
  render(
    <BuyActionZone
      state={EBuyActionState.WebFallback}
      nativeButton={null}
      isMock={false}
      errorText="Initialization failed. Try again"
      onMockPay={() => {}}
      onRetry={() => {}}
      onRetryInit={onRetryInit}
      onWebFallback={onWebFallback}
    />,
  );
  return { onWebFallback };
}

describe('BuyActionZone web fallback', () => {
  it('offers only the web widget for a failure nothing can fix in place', () => {
    const { onWebFallback } = renderFallback();

    fireEvent.click(screen.getByTestId('headless-buy-web-fallback'));

    expect(onWebFallback).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('headless-buy-retry-init')).toBeNull();
  });

  it('adds an in-place retry when the init failure may pass on another try', () => {
    const onRetryInit = jest.fn();
    const { onWebFallback } = renderFallback(onRetryInit);

    // The web widget stays available next to it.
    expect(screen.getByTestId('headless-buy-web-fallback')).toBeTruthy();
    fireEvent.click(screen.getByTestId('headless-buy-retry-init'));

    expect(onRetryInit).toHaveBeenCalledTimes(1);
    expect(onWebFallback).not.toHaveBeenCalled();
  });
});

function renderReady() {
  return render(
    <BuyActionZone
      state={EBuyActionState.Ready}
      nativeButton={null}
      isMock={false}
      onMockPay={() => {}}
      onRetry={() => {}}
      onWebFallback={() => {}}
    />,
  );
}

function zoneMinHeight(container: HTMLElement) {
  return Number((container.firstElementChild as HTMLElement).dataset.minHeight);
}

describe('BuyActionZone reserved height', () => {
  it('reserves the pay block height remembered from an earlier visit', () => {
    mockStorage.set(ZONE_HEIGHT_KEY, 92);

    const { container } = renderReady();

    expect(zoneMinHeight(container)).toBe(92);
  });

  it('ignores a remembered height no pay block could have', () => {
    mockStorage.set(ZONE_HEIGHT_KEY, 400);

    const { container } = renderReady();

    expect(zoneMinHeight(container)).toBe(56);
  });

  it('keeps and remembers the tallest pay block it measures', () => {
    const { container } = renderReady();
    const reportHeight = (height: number) =>
      act(() => {
        mockLayoutHandlers[mockLayoutHandlers.length - 1]({
          nativeEvent: { layout: { height } },
        });
      });

    reportHeight(91.2);
    expect(zoneMinHeight(container)).toBe(92);
    expect(mockStorage.get(ZONE_HEIGHT_KEY)).toBe(92);

    // A shorter pass (the button mid-swap) never shrinks the reservation.
    reportHeight(50);
    expect(zoneMinHeight(container)).toBe(92);
    expect(mockStorage.get(ZONE_HEIGHT_KEY)).toBe(92);
  });
});

describe('BuyActionZone quoting', () => {
  it('says a quote is on its way while preparing', () => {
    render(
      <BuyActionZone
        state={EBuyActionState.Preparing}
        nativeButton={null}
        isMock={false}
        onMockPay={() => {}}
        onRetry={() => {}}
        onWebFallback={() => {}}
      />,
    );

    expect(screen.getByTestId('headless-buy-placeholder').textContent).toBe(
      'buy_quote_loading__msg',
    );
  });
});
