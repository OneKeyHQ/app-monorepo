/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@onekeyhq/components', () => {
  const { createElement, Fragment } =
    jest.requireActual<typeof import('react')>('react');
  const passthrough = ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children);
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
    SizableText: passthrough,
    Spinner: () => null,
    Stack: passthrough,
    YStack: passthrough,
  };
});

import { BuyActionZone } from './BuyActionZone';
import { EBuyActionState } from './types';

function renderZone(onViewOrder?: () => void) {
  const onRetry = jest.fn();
  render(
    <BuyActionZone
      state={EBuyActionState.RetryableError}
      nativeButton={null}
      isMock={false}
      onMockPay={() => {}}
      onRetry={onRetry}
      onViewOrder={onViewOrder}
      onWebFallback={() => {}}
    />,
  );
  return { onRetry };
}

describe('BuyActionZone retryable error', () => {
  it('offers an in-place retry', () => {
    const { onRetry } = renderZone();

    fireEvent.click(screen.getByTestId('headless-buy-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('headless-buy-view-order')).toBeNull();
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
});
