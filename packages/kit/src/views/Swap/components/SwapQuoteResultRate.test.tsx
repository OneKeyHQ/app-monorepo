/** @jest-environment jsdom */
import type { MouseEvent, PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapQuoteResultRate from './SwapQuoteResultRate';

jest.mock('@onekeyhq/components', () => {
  function MockStack({
    children,
    onPress,
  }: PropsWithChildren<{ onPress?: (event: MouseEvent) => void }>) {
    return onPress ? (
      <button type="button" data-testid="quote-rate" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    );
  }
  function MockText({ children }: PropsWithChildren) {
    return <span>{children}</span>;
  }
  return {
    Badge: MockStack,
    Divider: MockStack,
    Icon: () => null,
    Image: () => null,
    LottieView: () => null,
    NumberSizeableText: MockText,
    SizableText: MockText,
    Stack: MockStack,
    XStack: MockStack,
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('./SwapRefreshButton', () => () => <span />);

const stockToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xstock',
  symbol: 'AAPLB',
  decimals: 18,
  isStock: true,
};
const paymentToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
};
const refreshAction = jest.fn();

function QuoteDetailsTrigger({
  children,
  onOpen,
}: PropsWithChildren<{ onOpen: () => void }>) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
    </div>
  );
}

it('keeps the stock as the unit across buying and selling and locks the direction', () => {
  const openDetails = jest.fn();
  const { rerender } = render(
    <QuoteDetailsTrigger onOpen={openDetails}>
      <SwapQuoteResultRate
        fromToken={paymentToken}
        toToken={stockToken}
        rate="0.0025"
        fixedReverse
        refreshAction={refreshAction}
      />
    </QuoteDetailsTrigger>,
  );

  expect(screen.getByText(/^1 AAPLB =/).textContent).toBe('1 AAPLB = 400 USDT');
  fireEvent.click(screen.getByText(/^1 AAPLB =/));
  expect(openDetails).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/^1 AAPLB =/).textContent).toBe('1 AAPLB = 400 USDT');

  rerender(
    <QuoteDetailsTrigger onOpen={openDetails}>
      <SwapQuoteResultRate
        fromToken={stockToken}
        toToken={paymentToken}
        rate="402"
        fixedReverse={false}
        refreshAction={refreshAction}
      />
    </QuoteDetailsTrigger>,
  );

  expect(screen.getByText(/^1 AAPLB =/).textContent).toBe('1 AAPLB = 402 USDT');
  fireEvent.click(screen.getByText(/^1 AAPLB =/));
  expect(openDetails).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/^1 AAPLB =/).textContent).toBe('1 AAPLB = 402 USDT');
});

it('lets ordinary Swap users switch the rate direction and switch it back', () => {
  const openDetails = jest.fn();
  render(
    <QuoteDetailsTrigger onOpen={openDetails}>
      <SwapQuoteResultRate
        fromToken={paymentToken}
        toToken={stockToken}
        rate="0.0025"
        refreshAction={refreshAction}
      />
    </QuoteDetailsTrigger>,
  );

  expect(screen.getByTestId('quote-rate').textContent).toBe(
    '1 USDT = 0.0025 AAPLB',
  );
  fireEvent.click(screen.getByTestId('quote-rate'));
  expect(screen.getByTestId('quote-rate').textContent).toBe(
    '1 AAPLB = 400 USDT',
  );
  fireEvent.click(screen.getByTestId('quote-rate'));
  expect(screen.getByTestId('quote-rate').textContent).toBe(
    '1 USDT = 0.0025 AAPLB',
  );
  expect(openDetails).not.toHaveBeenCalled();
});
