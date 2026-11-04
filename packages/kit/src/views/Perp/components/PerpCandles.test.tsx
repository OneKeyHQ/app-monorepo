import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react-native';

import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  type ITradingViewNativeProps,
  TradingViewNative,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewPerpsV2Props } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import type { IPerpsCustomSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { buildActiveTradeDisplay } from '../hooks/useActiveTradeDisplayUtils';

import { PerpMarketWorkspacePanel } from './MarketDetail/PerpMarketWorkspacePanel';
import { PerpCandles } from './PerpCandles';

let mockAccountAddress: string | undefined;
let mockCoin = 'ETH';
let mockInstrumentMode: 'perp' | 'spot' = 'perp';
let mockSzDecimals: number | undefined = 2;
let mockTradeDisplay: ReturnType<typeof buildActiveTradeDisplay> | undefined;
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockChartUserAddress = jest.fn();
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

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
  XStack: ({ children }: { children?: ReactNode }) => children,
  YStack: ({ children }: { children?: ReactNode }) => children,
  SizableText: () => null,
  LottieView: () => null,
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [
    {
      mode: mockInstrumentMode,
      coin: mockCoin,
      assetId: mockSzDecimals === undefined ? undefined : 1,
      universe:
        mockSzDecimals === undefined
          ? undefined
          : {
              assetId: 1,
              name: mockCoin,
              szDecimals: mockSzDecimals,
              baseSzDecimals: mockSzDecimals,
              maxLeverage: 10,
            },
    },
  ],
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
  useActiveTradeDisplay: () =>
    mockTradeDisplay ?? {
      baseName: mockCoin,
      coin: mockCoin,
      displayName: mockCoin,
      mode: 'perp',
    },
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
        mockChartUserAddress(props.userAddress);
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
  mockInstrumentMode = 'perp';
  mockSzDecimals = 2;
  mockTradeDisplay = undefined;
  mockCustomSettings = { showChartLines: false };
});

it('covers unknown precision until metadata arrives without remounting the chart', () => {
  mockCustomSettings.chartMode = 'native';
  mockSzDecimals = undefined;
  const view = renderTradingViewCandles();

  expect(mockNativeChart.mock.lastCall?.[0].priceDecimalPlaces).toBeUndefined();
  expect(mockNativeChart.mock.lastCall?.[0].isPricePrecisionLoading).toBe(true);
  const chart = view.UNSAFE_getByType(TradingViewNative);

  mockSzDecimals = 2;
  view.rerender(<PerpCandles />);
  expect(mockNativeChart.mock.lastCall?.[0].priceDecimalPlaces).toBe(4);
  expect(mockNativeChart.mock.lastCall?.[0].isPricePrecisionLoading).toBe(
    false,
  );
  expect(view.UNSAFE_getByType(TradingViewNative)).toBe(chart);
});

it.each([
  ['perp', 6],
  ['spot', 8],
] as const)(
  'bounds missing %s metadata and accepts late precision without remounting',
  (mode, fallbackDecimals) => {
    jest.useFakeTimers();
    mockInstrumentMode = mode;
    mockCustomSettings.chartMode = 'native';
    mockSzDecimals = undefined;
    const view = renderTradingViewCandles();
    try {
      act(() => jest.advanceTimersByTime(4000));
      mockCoin = mode === 'spot' ? '@143' : 'ZEC';
      view.rerender(<PerpCandles />);
      const chart = view.UNSAFE_getByType(TradingViewNative);
      act(() => jest.advanceTimersByTime(1000));
      expect(mockNativeChart.mock.lastCall?.[0].isPricePrecisionLoading).toBe(
        true,
      );
      act(() => jest.advanceTimersByTime(4000));
      expect(mockNativeChart.mock.lastCall?.[0].isPricePrecisionLoading).toBe(
        false,
      );
      expect(mockNativeChart.mock.lastCall?.[0].priceDecimalPlaces).toBe(
        fallbackDecimals,
      );
      mockSzDecimals = 2;
      view.rerender(<PerpCandles />);
      expect(mockNativeChart.mock.lastCall?.[0].priceDecimalPlaces).toBe(
        fallbackDecimals - 2,
      );
      expect(view.UNSAFE_getByType(TradingViewNative)).toBe(chart);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  },
);

it.each([
  ['perp', 'ZEC', 'USDC', 'ZECUSDC', 'ZEC'],
  ['perp', 'xyz:ZEC', 'USDC', 'ZECUSDC', 'xyzZEC'],
  ['spot', 'ZEC', 'USDC', 'ZEC/USDC', 'ZEC'],
  ['spot', 'LINK', 'USDT0', 'LINK/USDT0', 'LINK'],
] as const)(
  'shows the complete %s pair for %s/%s with its base token icon',
  (mode, baseName, quoteName, name, imageName) => {
    const nativePlatform = jest.replaceProperty(platformEnv, 'isNative', true);
    mockCustomSettings.chartMode = 'native';
    mockCoin = mode === 'spot' ? '@143' : baseName;
    mockTradeDisplay = buildActiveTradeDisplay({
      tradeInstrument:
        mode === 'spot'
          ? {
              mode,
              coin: mockCoin,
              assetId: 10_143,
              universe: {
                name: mockCoin,
                index: 143,
                tokens: [1, 0],
                isCanonical: true,
                assetId: 10_143,
                baseName,
                quoteName,
                displayName: baseName,
                baseSzDecimals: 2,
              },
            }
          : { mode, coin: mockCoin, assetId: 1, universe: undefined },
      perpsAsset: {
        coin: mockCoin,
        assetId: 1,
        universe: undefined,
        margin: undefined,
      },
    });
    try {
      renderTradingViewCandles();
      const image = `https://uni.onekey-asset.com/static/hyperliquid/${imageName}.png`;
      expect(
        mockNativeChart.mock.lastCall?.[0].nativeChartFullscreenHeader,
      ).toMatchObject({
        props: {
          name,
          ...(mode === 'spot'
            ? { tokenImageUri: image }
            : { tokenImageUris: [image] }),
        },
      });
    } finally {
      nativePlatform.restore();
    }
  },
);

it.each([false, true])(
  'coordinates the native chart with page scrolling only on iOS (%s)',
  (isNativeIOS) => {
    const nativeIOSPlatform = jest.replaceProperty(
      platformEnv,
      'isNativeIOS',
      isNativeIOS,
    );
    mockCustomSettings.chartMode = 'native';

    try {
      renderTradingViewCandles();

      expect(mockNativeChart.mock.lastCall?.[0].prioritizePageScroll).toBe(
        isNativeIOS,
      );
    } finally {
      nativeIOSPlatform.restore();
    }
  },
);

describe('PerpCandles account switch', () => {
  it('leaves the rebuild decision to the chart instead of remounting it', () => {
    const { rerender } = renderTradingViewCandles();
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
