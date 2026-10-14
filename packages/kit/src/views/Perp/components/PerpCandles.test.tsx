import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react-native';

import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type { ITradingViewNativeProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewPerpsV2Props } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import type { IPerpsCustomSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PerpMarketWorkspacePanel } from './MarketDetail/PerpMarketWorkspacePanel';
import { PerpCandles } from './PerpCandles';

let mockAccountAddress: string | undefined;
let mockCoin = 'ETH';
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockSetLayoutState = jest.fn();
let mockCustomSettings: Pick<
  IPerpsCustomSettings,
  'chartMode' | 'showChartLines'
>;
const mockSetCustomSettings = jest.fn(
  (
    update: (current: typeof mockCustomSettings) => typeof mockCustomSettings,
  ) => {
    mockCustomSettings = update(mockCustomSettings);
  },
);
const mockNativeChart = jest.fn<null, [ITradingViewNativeProps]>(() => null);
const mockTradingViewChart = jest.fn<null, [ITradingViewPerpsV2Props]>(
  () => null,
);
const mockChartModeSelect = jest.fn<
  null,
  [{ chartMode: ITradingViewChartMode; onChartSwitch: () => void }]
>(() => null);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
  XStack: ({ children }: { children?: ReactNode }) => children,
  YStack: ({ children }: { children?: ReactNode }) => children,
  SizableText: () => null,
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
  usePerpsCustomSettingsAtom: () => [mockCustomSettings, mockSetCustomSettings],
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls',
  () => ({
    TRADING_VIEW_CHART_CONTROLS_HEIGHT: 40,
    TradingViewChartModeSelect: (props: {
      chartMode: ITradingViewChartMode;
      onChartSwitch: () => void;
    }) => mockChartModeSelect(props),
  }),
);

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => ({
  getTradingViewNativeSourceKey: jest.requireActual<
    typeof import('@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource')
  >(
    '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource',
  ).getTradingViewNativeSourceKey,
  TradingViewNative: (props: ITradingViewNativeProps) => mockNativeChart(props),
}));

jest.mock('../hooks/useActiveTradeDisplay', () => ({
  useActiveTradeDisplay: () => ({
    baseName: mockCoin,
    coin: mockCoin,
    displayName: mockCoin,
    mode: 'perp',
  }),
}));

jest.mock('./MarketDetail/PerpFundingChart', () => ({
  PerpFundingChart: () => null,
}));

jest.mock('./MarketDetail/PerpMarketDetailContent', () => ({
  PERP_MARKET_INFO_TAB_KEYS: [],
  PerpMarketDetailContent: () => null,
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
      TradingViewPerpsV2: (props: ITradingViewPerpsV2Props) => {
        mockTradingViewChart(props);
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
  return render(<PerpCandles />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountAddress = '0xABC';
  mockCoin = 'ETH';
  mockCustomSettings = { showChartLines: false };
});

describe('PerpCandles TradingView account isolation', () => {
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

describe.each([
  ['standalone chart', PerpCandles],
  ['desktop workspace', PerpMarketWorkspacePanel],
] as const)('%s chart mode preference', (_name, Chart) => {
  it('restores a saved native chart preference', () => {
    mockCustomSettings.chartMode = 'native';
    render(<Chart />);

    expect(mockNativeChart).toHaveBeenCalled();
    expect(mockChartMount).not.toHaveBeenCalled();
    expect(mockSetCustomSettings).not.toHaveBeenCalled();
  });

  it('remembers both choices across remounts and preserves other settings', () => {
    const first = render(<Chart />);
    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockChartModeSelect).not.toHaveBeenCalled();
    expect(
      mockTradingViewChart.mock.lastCall?.[0].enableNativeChartControls,
    ).toBe(true);

    act(() => mockTradingViewChart.mock.lastCall?.[0].onChartSwitch?.());
    first.rerender(<Chart />);
    expect(mockNativeChart).toHaveBeenCalled();
    expect(mockCustomSettings).toEqual({
      chartMode: 'native',
      showChartLines: false,
    });
    first.unmount();

    const second = render(<Chart />);
    expect(mockChartMount).toHaveBeenCalledTimes(1);
    act(() => {
      mockNativeChart.mock.lastCall?.[0].onChartSwitch?.();
    });
    second.unmount();

    render(<Chart />);
    expect(mockChartMount).toHaveBeenCalledTimes(2);
    expect(mockChartModeSelect).not.toHaveBeenCalled();
    expect(mockCustomSettings).toEqual({
      chartMode: 'tradingView',
      showChartLines: false,
    });
  });
});
