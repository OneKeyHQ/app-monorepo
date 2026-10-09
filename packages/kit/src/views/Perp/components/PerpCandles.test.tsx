import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react-native';

import type { ITradingViewNativeProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';

import { PerpCandles } from './PerpCandles';

let mockAccountAddress: string | undefined;
let mockCoin = 'ETH';
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockSetLayoutState = jest.fn();
let mockNativeChartProps: ITradingViewNativeProps;

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
  XStack: ({ children }: { children?: ReactNode }) => children,
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp', coin: mockCoin }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAccountAddress }],
  usePerpsCandlesWebviewReloadHookAtom: () => [{ reloadHook: 1 }],
  usePerpsLayoutStateAtom: () => [{ chartExpanded: false }, mockSetLayoutState],
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls',
  () => ({
    TRADING_VIEW_CHART_CONTROLS_HEIGHT: 40,
    TradingViewChartModeSelect: () => null,
  }),
);

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => ({
  getTradingViewNativeSourceKey: jest.requireActual<
    typeof import('@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource')
  >(
    '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource',
  ).getTradingViewNativeSourceKey,
  TradingViewNative: (props: ITradingViewNativeProps) => {
    mockNativeChartProps = props;
    return null;
  },
}));

jest.mock('../hooks/usePerpsNativeChartLines', () => ({
  usePerpsNativeChartLines: () => ({ chartComponents: [] }),
}));

jest.mock('../hooks/usePerpsNativeChartMarks', () => ({
  usePerpsNativeChartMarks: () => [],
}));

jest.mock('../hooks/usePerpsNativeChartMetadata', () => ({
  usePerpsNativeChartMetadata: () => ({}),
}));

jest.mock('../hooks/usePerpsChartOrderMenu', () => ({
  usePerpsChartOrderMenu: () => ({}),
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

function renderTradingViewCandles() {
  const view = render(<PerpCandles />);
  expect(mockNativeChartProps.onChartSwitch).toEqual(expect.any(Function));
  act(() => mockNativeChartProps.onChartSwitch?.());
  return view;
}

describe('PerpCandles TradingView account isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountAddress = '0xABC';
    mockCoin = 'ETH';
  });

  it('discards the chart and all of its symbol caches when the account changes', () => {
    const { rerender } = renderTradingViewCandles();
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

  it('clears account marks on disconnect and reuses the anonymous chart on reconnect', () => {
    const { rerender } = renderTradingViewCandles();
    mockAccountAddress = undefined;
    rerender(<PerpCandles />);
    expect(mockChartUnmount).toHaveBeenCalledTimes(1);
    mockAccountAddress = '0xABC';
    rerender(<PerpCandles />);
    expect(mockChartUnmount).toHaveBeenCalledTimes(1);
    expect(mockChartMount).toHaveBeenCalledTimes(2);
  });

  it('keeps the cold-start chart when the first account resolves, then isolates switches', () => {
    mockAccountAddress = undefined;
    const { rerender } = renderTradingViewCandles();
    mockAccountAddress = '0xABC';
    rerender(<PerpCandles />);
    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockChartUnmount).not.toHaveBeenCalled();

    mockAccountAddress = '0xDEF';
    rerender(<PerpCandles />);
    expect(mockChartMount).toHaveBeenCalledTimes(2);
    expect(mockChartUnmount).toHaveBeenCalledTimes(1);
  });

  it('keeps the chart when only the address casing changes', () => {
    const { rerender } = renderTradingViewCandles();
    mockAccountAddress = '0xabc';
    rerender(<PerpCandles />);
    expect(mockChartUnmount).not.toHaveBeenCalled();
    expect(mockChartMount).toHaveBeenCalledTimes(1);
  });
});
