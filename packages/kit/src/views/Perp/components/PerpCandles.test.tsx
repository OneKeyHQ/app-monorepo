import type { ReactNode } from 'react';

import { render } from '@testing-library/react-native';

import { PerpCandles } from './PerpCandles';

let mockAccountAddress: string | undefined;
let mockCoin = 'ETH';
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: mockCoin }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAccountAddress }],
  usePerpsCandlesWebviewReloadHookAtom: () => [{ reloadHook: 1 }],
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2',
  () => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    return {
      TradingViewPerpsV2: () => {
        useEffect(() => {
          mockChartMount();
          return () => {
            mockChartUnmount();
          };
        }, []);
        return null;
      },
    };
  },
);

describe('PerpCandles account isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountAddress = '0xABC';
    mockCoin = 'ETH';
  });

  it('discards the chart and all of its symbol caches when the account changes', () => {
    const { rerender } = render(<PerpCandles />);
    mockCoin = 'BTC';
    rerender(<PerpCandles />);
    expect(mockChartMount).toHaveBeenCalledTimes(1);

    mockAccountAddress = '0xDEF';
    rerender(<PerpCandles />);
    expect(mockChartUnmount).toHaveBeenCalledTimes(1);
    expect(mockChartMount).toHaveBeenCalledTimes(2);

    mockCoin = 'ETH';
    rerender(<PerpCandles />);
    expect(mockChartMount).toHaveBeenCalledTimes(2);
  });

  it('discards the chart on disconnect and reconnect', () => {
    const { rerender } = render(<PerpCandles />);
    mockAccountAddress = undefined;
    rerender(<PerpCandles />);
    mockAccountAddress = '0xABC';
    rerender(<PerpCandles />);
    expect(mockChartUnmount).toHaveBeenCalledTimes(2);
    expect(mockChartMount).toHaveBeenCalledTimes(3);
  });

  it('keeps the chart when only the address casing changes', () => {
    const { rerender } = render(<PerpCandles />);
    mockAccountAddress = '0xabc';
    rerender(<PerpCandles />);
    expect(mockChartUnmount).not.toHaveBeenCalled();
    expect(mockChartMount).toHaveBeenCalledTimes(1);
  });
});
