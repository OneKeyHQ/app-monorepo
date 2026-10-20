import type { ReactNode } from 'react';

import { render } from '@testing-library/react-native';

import { PerpCandles } from './PerpCandles';

let mockAccountAddress: string | undefined;
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockChartUserAddress = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: 'ETH' }],
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
      TradingViewPerpsV2: ({ userAddress }: { userAddress?: string }) => {
        mockChartUserAddress(userAddress);
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

describe('PerpCandles account switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountAddress = '0xABC';
  });

  it('leaves the rebuild decision to the chart instead of remounting it', () => {
    const { rerender } = render(<PerpCandles />);
    mockAccountAddress = '0xDEF';
    rerender(<PerpCandles />);
    mockAccountAddress = undefined;
    rerender(<PerpCandles />);

    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockChartUnmount).not.toHaveBeenCalled();
    expect(mockChartUserAddress).toHaveBeenLastCalledWith(undefined);
    expect(mockChartUserAddress).toHaveBeenCalledWith('0xDEF');
  });
});
