/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MarketEmbeddedSwap } from './MarketEmbeddedSwap';

let mockAccountScope = 'account-a';
const mockEmbeddedMounted = jest.fn();
const mockEmbeddedUnmounted = jest.fn();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type IMockStackProps = PropsWithChildren<{
    testID?: string;
    height?: number;
    enterStyle?: unknown;
    onLayout?: (event: {
      nativeEvent: { layout: { width: number; height: number } };
    }) => void;
  }>;
  const Stack = React.forwardRef<HTMLDivElement, IMockStackProps>(
    function MockStack(
      { children, testID, height, enterStyle, onLayout },
      ref,
    ) {
      if (onLayout) {
        return (
          <div
            ref={(node) => {
              if (node) {
                node.getBoundingClientRect = () => ({
                  x: 0,
                  y: 0,
                  top: 0,
                  left: 0,
                  right: 300,
                  bottom: 36,
                  width: 300,
                  height: 36,
                  toJSON: () => ({}),
                });
              }
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            data-testid="measurement"
          >
            <button
              type="button"
              onClick={() =>
                onLayout({
                  nativeEvent: { layout: { width: 300, height: 36 } },
                })
              }
            >
              measure
            </button>
            {children}
          </div>
        );
      }
      if (height !== undefined) {
        return (
          <div
            data-testid="recipient-reveal"
            data-height={height}
            data-enter={enterStyle ? 'animate' : 'none'}
          >
            {children}
          </div>
        );
      }
      return <div data-testid={testID}>{children}</div>;
    },
  );
  return {
    AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
    EPageType: { modal: 'modal' },
    Skeleton: () => null,
    Stack,
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: PropsWithChildren) => (
    <>{children}</>
  ),
}));

jest.mock('./components/MarketStockTradeTarget', () => ({
  MarketStockTradeTarget: () => null,
}));

jest.mock('@onekeyhq/shared/src/lazyLoad', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: () => {
      function MockEmbeddedSwap({
        stockTradeToken,
      }: {
        stockTradeToken?: { contractAddress?: string; networkId?: string };
      }) {
        const { SwapSmoothReveal } = jest.requireActual<
          typeof import('@onekeyhq/kit/src/views/Swap/pages/components/SwapSmoothReveal')
        >('@onekeyhq/kit/src/views/Swap/pages/components/SwapSmoothReveal');
        React.useEffect(() => {
          mockEmbeddedMounted();
          return () => {
            mockEmbeddedUnmounted();
          };
        }, []);
        return (
          <SwapSmoothReveal
            visible
            snapshotKey="stock-recipient"
            snapshotScope={`${mockAccountScope}:${stockTradeToken?.networkId}:${stockTradeToken?.contractAddress}`}
          >
            <span>recipient</span>
          </SwapSmoothReveal>
        );
      }
      return MockEmbeddedSwap;
    },
  };
});

jest.mock('../components/SwapPanel/hooks/useSpeedSwapInit', () => ({
  ESpeedSwapConfigScope: { DEFAULT: 'default', MARKET: 'market' },
  useSpeedSwapInit: () => ({
    defaultTokens: [
      {
        networkId: 'evm--1',
        contractAddress: '0xpay',
        symbol: 'PAY',
        decimals: 18,
      },
    ],
    speedConfigReady: true,
    speedSwapConfig: undefined,
  }),
}));

const stockToken = {
  networkId: 'evm--1',
  contractAddress: '0xstock',
  symbol: 'STOCK',
  decimals: 18,
  isStock: true,
};

function MarketTrade({
  disabled = false,
  token = stockToken,
  inputDraftKey = 'stock:ONE',
}: {
  disabled?: boolean;
  token?: typeof stockToken;
  inputDraftKey?: string;
}) {
  return (
    <MarketEmbeddedSwap
      swapToken={token}
      stockTradeToken={token}
      inputDraftKey={inputDraftKey}
      disabled={disabled}
      embeddedStockTrade
    />
  );
}

function expectReveal(height: number, enter: 'animate' | 'none') {
  const reveal = screen.getByTestId('recipient-reveal');
  expect(reveal.getAttribute('data-height')).toBe(String(height));
  expect(reveal.getAttribute('data-enter')).toBe(enter);
}

describe('Market stock recipient reveal across focus changes', () => {
  beforeEach(() => {
    mockAccountScope = 'account-a';
    mockEmbeddedMounted.mockClear();
    mockEmbeddedUnmounted.mockClear();
  });

  it('keeps the measured layout while unmounting and remounting the trade content', () => {
    const view = render(<MarketTrade />);
    expectReveal(0, 'animate');
    fireEvent.click(screen.getByText('measure'));
    expectReveal(36, 'animate');

    view.rerender(<MarketTrade disabled />);
    expect(screen.queryByTestId('recipient-reveal')).toBeNull();
    expect(mockEmbeddedUnmounted).toHaveBeenCalledTimes(1);

    view.rerender(<MarketTrade />);
    expect(mockEmbeddedMounted).toHaveBeenCalledTimes(2);
    expectReveal(36, 'none');
  });

  it('does not reuse the layout after the account changes while unfocused', () => {
    const view = render(<MarketTrade />);
    fireEvent.click(screen.getByText('measure'));
    view.rerender(<MarketTrade disabled />);
    mockAccountScope = 'account-b';
    view.rerender(<MarketTrade />);
    expectReveal(0, 'animate');
  });

  it('does not reuse the layout for a different stock route', () => {
    const view = render(<MarketTrade />);
    fireEvent.click(screen.getByText('measure'));
    view.rerender(<MarketTrade disabled />);
    const nextToken = { ...stockToken, contractAddress: '0xother-stock' };
    view.rerender(<MarketTrade token={nextToken} inputDraftKey="stock:TWO" />);
    expectReveal(0, 'animate');
  });
});
