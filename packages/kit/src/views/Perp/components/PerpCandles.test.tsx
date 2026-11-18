import type { ReactNode } from 'react';

import { act, render, waitFor } from '@testing-library/react-native';

import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  type ITradingViewNativeMultiChartPanel,
  type ITradingViewNativeMultiChartProps,
  type ITradingViewNativeProps,
  type ITradingViewNativeSource,
  TradingViewNative,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewPerpsV2Props } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import type { IPerpsCustomSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITradingViewNativeMultiChartLayout } from '@onekeyhq/shared/types/tradingViewNative';

import { buildActiveTradeDisplay } from '../hooks/useActiveTradeDisplayUtils';

import { PerpMarketWorkspacePanel } from './MarketDetail/PerpMarketWorkspacePanel';
import { PerpCandles } from './PerpCandles';

import type { IPerpTokenSelection } from './TokenSelector/PerpTokenSelector';

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
let mockMultiChartLayout: ITradingViewNativeMultiChartLayout;
const mockSetPanelSource = jest.fn<
  void,
  Parameters<ITradingViewNativeMultiChartPanel['setSource']>
>();
let mockMultiChartProps: ITradingViewNativeMultiChartProps | undefined;
// What the grid shows in the selected panel while the host is still switching.
let mockPendingActiveSource: ITradingViewNativeSource | undefined;
const mockReferenceLineAction = jest.fn();
const mockPriceSelect = jest.fn();
const mockMarkAllAssetCtxsRequired = jest.fn();
const mockMarkAllAssetCtxsNotRequired = jest.fn();
const mockSetTradeRouteViewState = jest.fn();
type IMockTokenSelectorProps = {
  testID?: string;
  onSelectToken?: (selection: IPerpTokenSelection) => void;
};
const mockTokenSelector = jest.fn<null, [IMockTokenSelectorProps]>(() => null);
const mockQuote = jest.fn<
  null,
  [{ coinName: string; mode: string; assetId: number; displayMode: string }]
>(() => null);
const mockSwitchTradeInstrument = jest.fn<
  Promise<boolean>,
  [{ mode: 'perp' | 'spot'; coin: string }]
>(async () => true);
const mockGetSymbolMeta = jest.fn(async ({ coin }: { coin: string }) => ({
  coin,
  assetId: 7,
  universe: { szDecimals: 3 },
}));
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
  IconButton: () => null,
  LottieView: () => null,
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => children,
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: {
      switchTradeInstrument: mockSwitchTradeInstrument,
      markAllAssetCtxsRequired: mockMarkAllAssetCtxsRequired,
      markAllAssetCtxsNotRequired: mockMarkAllAssetCtxsNotRequired,
      setTradeRouteViewState: mockSetTradeRouteViewState,
    },
  }),
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
  usePerpsTradingViewIndicatorSettingsPersistAtom: () => [
    { schemaVersion: 2, mainIndicators: [], subIndicators: [] },
  ],
  usePerpsTradingViewMultiChartPersistAtom: () => [
    mockMultiChartLayout,
    jest.fn(),
  ],
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getSymbolMeta: (params: { coin: string }) => mockGetSymbolMeta(params),
    },
  },
}));

jest.mock('./TokenSelector/PerpChartTokenSelector', () => ({
  PerpChartTokenSelector: (props: IMockTokenSelectorProps) =>
    mockTokenSelector(props),
}));

jest.mock('./FavoritesBar/FavoriteTokenItem', () => ({
  CtxPriceDisplay: (props: Parameters<typeof mockQuote>[0]) => mockQuote(props),
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
  // The grid itself is covered beside the component; here it only has to hand
  // every visible panel to the host.
  TradingViewNativeMultiChart: (props: ITradingViewNativeMultiChartProps) => {
    mockMultiChartProps = props;
    const { activeSource, layout, renderPanel } = props;
    const { Fragment } = jest.requireActual<typeof import('react')>('react');
    const {
      getTradingViewNativeMultiChartActivePanelId,
      getTradingViewNativeMultiChartPanelIds,
    } = jest.requireActual<
      typeof import('@onekeyhq/kit/src/components/TradingView/TradingViewNative/multiChart/multiChartLayout')
    >(
      '@onekeyhq/kit/src/components/TradingView/TradingViewNative/multiChart/multiChartLayout',
    );
    const ids = getTradingViewNativeMultiChartPanelIds(layout.preset);
    const isSymbolSynced = ids.length > 1 && layout.sync?.symbol === true;
    const activeId = getTradingViewNativeMultiChartActivePanelId(layout);
    return ids.map((id, index) => {
      const isActive = id === activeId;
      const source =
        isActive || isSymbolSynced
          ? (mockPendingActiveSource ?? activeSource)
          : layout.panels[id]?.source;
      return source ? (
        <Fragment key={id}>
          {renderPanel({
            id,
            index,
            isMain: index === 0,
            isActive,
            isSplit: ids.length > 1,
            isSymbolSynced,
            source,
            layoutControl: null,
            setSource: mockSetPanelSource,
          })}
        </Fragment>
      ) : null;
    });
  },
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

jest.mock('./PerpOrderBook', () => ({
  PerpOrderBook: () => null,
}));

jest.mock('./MarketDetail/PerpMarketDetailContent', () => ({
  PERP_MARKET_INFO_TAB_KEYS: [],
  PerpMarketDetailContent: () => null,
}));

jest.mock('../hooks/usePerpsNativeChartLines', () => ({
  usePerpsNativeChartLines: (enableTradingUi: boolean) => ({
    chartComponents: [],
    onReferenceLineAction: enableTradingUi
      ? mockReferenceLineAction
      : undefined,
  }),
}));

jest.mock('../hooks/usePerpsNativeChartMarks', () => ({
  usePerpsNativeChartMarks: () => [],
}));

jest.mock('../hooks/usePerpsChartOrderMenu', () => ({
  usePerpsChartOrderMenu: (enabled: boolean) => ({
    onPriceSelect: enabled ? mockPriceSelect : undefined,
  }),
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
  mockMultiChartLayout = { preset: '1', panels: {} };
  mockMultiChartProps = undefined;
  mockPendingActiveSource = undefined;
});

function getChartProps(coin: string) {
  return mockNativeChart.mock.calls
    .map(([props]) => props)
    .findLast(
      (props) =>
        props.source.kind === 'hyperliquid' && props.source.coin === coin,
    );
}

describe('split view', () => {
  const ethSource: ITradingViewNativeSource = {
    kind: 'hyperliquid',
    coin: 'ETH',
    environment: 'mainnet',
  };
  const btcSource: ITradingViewNativeSource = { ...ethSource, coin: 'BTC' };

  beforeEach(() => {
    mockCustomSettings.chartMode = 'native';
    mockCoin = 'BTC';
    mockMultiChartLayout = {
      preset: '2h',
      panels: { 'panel-2': { source: ethSource } },
    };
  });

  it('shows another token beside the trading chart, read-only', async () => {
    renderTradingViewCandles();

    const trading = getChartProps('BTC');
    expect(trading?.enableDrawings).toBe(true);
    expect(trading?.onChartSwitch).toBeDefined();
    expect(trading?.onNativeChartFullscreenChange).toBeDefined();

    const panel = getChartProps('ETH');
    expect(panel?.storageNamespace).toBe('perps');
    expect(panel?.nativeControlsLayoutMode).toBe('desktop');
    // Every panel can be drawn on.
    expect(panel?.enableDrawings).toBe(true);
    // Trading stays with the trading chart.
    expect(panel?.onReferenceLineAction).toBeUndefined();
    expect(panel?.onPriceSelect).toBeUndefined();
    // Only the selected panel's controls are on screen, so every panel gets
    // the page-level ones.
    expect(panel?.onChartSwitch).toBeDefined();
    expect(panel?.onNativeChartFullscreenChange).toBeDefined();
    expect(trading?.onInteractionChange).toBeDefined();
    expect(panel?.onInteractionChange).toBeUndefined();
    expect(panel?.nativeControlsLeading).toBeUndefined();
    // Its precision comes from its own token, not the traded one.
    expect(panel?.isPricePrecisionLoading).toBe(true);
    await waitFor(() =>
      expect(getChartProps('ETH')?.priceDecimalPlaces).toBe(3),
    );
    expect(mockGetSymbolMeta).toHaveBeenCalledWith({ coin: 'ETH' });
    expect(getChartProps('BTC')?.priceDecimalPlaces).toBe(4);
  });

  it('keeps a single chart when the layout has one panel', () => {
    mockMultiChartLayout = {
      preset: '1',
      panels: { 'panel-2': { source: ethSource } },
    };
    renderTradingViewCandles();

    expect(getChartProps('BTC')).toBeDefined();
    expect(getChartProps('ETH')).toBeUndefined();
  });

  function getPicker(panelId: string) {
    return mockTokenSelector.mock.calls
      .map(([props]) => props)
      .findLast(
        (props) =>
          props.testID === `perp-native-chart-panel-token-selector-${panelId}`,
      );
  }

  it('moves trading to a selected panel and keeps the others read-only', () => {
    mockCoin = 'ETH';
    mockMultiChartLayout = {
      preset: '2h',
      activePanelId: 'panel-2',
      panels: {
        main: { source: btcSource },
        'panel-2': { source: ethSource },
      },
    };
    renderTradingViewCandles();

    const trading = getChartProps('ETH');
    expect(trading?.onReferenceLineAction).toBe(mockReferenceLineAction);
    expect(trading?.onPriceSelect).toBe(mockPriceSelect);
    // Its picker switches the trade instrument instead of the panel's token.
    expect(getPicker('panel-2')?.onSelectToken).toBeUndefined();

    // The first panel keeps its token, read-only.
    const first = getChartProps('BTC');
    expect(first?.onReferenceLineAction).toBeUndefined();
    expect(first?.onPriceSelect).toBeUndefined();
    act(() =>
      getPicker('main')?.onSelectToken?.({ coin: 'SOL', mode: 'perp' }),
    );
    expect(mockSetPanelSource).toHaveBeenCalledWith({
      ...ethSource,
      coin: 'SOL',
    });
  });

  it('names every token with its live quote while split', async () => {
    const { unmount } = renderTradingViewCandles();

    await waitFor(() =>
      expect(mockQuote).toHaveBeenCalledWith(
        expect.objectContaining({ coinName: 'ETH', assetId: 7 }),
      ),
    );
    for (const coinName of ['BTC', 'ETH']) {
      for (const displayMode of ['price', 'percent']) {
        expect(mockQuote).toHaveBeenCalledWith(
          expect.objectContaining({ coinName, mode: 'perp', displayMode }),
        );
      }
    }
    // The perp quotes stream only while a panel shows them: each mark is
    // released again.
    expect(mockMarkAllAssetCtxsRequired.mock.calls.length).toBeGreaterThan(
      mockMarkAllAssetCtxsNotRequired.mock.calls.length,
    );
    unmount();
    expect(mockMarkAllAssetCtxsNotRequired.mock.calls.length).toBe(
      mockMarkAllAssetCtxsRequired.mock.calls.length,
    );
  });

  it('leaves a single chart to the page header', () => {
    mockMultiChartLayout = { preset: '1', panels: {} };
    renderTradingViewCandles();

    expect(mockTokenSelector).not.toHaveBeenCalled();
    expect(mockQuote).not.toHaveBeenCalled();
  });

  it('streams spot quotes while a chart that is not trading shows spot', () => {
    mockMultiChartLayout = {
      preset: '2h',
      panels: { 'panel-2': { source: { ...ethSource, coin: '@107' } } },
    };
    const { unmount } = renderTradingViewCandles();

    expect(mockSetTradeRouteViewState).toHaveBeenCalledWith({
      chartPanelsSpotActive: true,
    });
    unmount();
    expect(mockSetTradeRouteViewState).toHaveBeenLastCalledWith({
      chartPanelsSpotActive: false,
    });
  });

  it('leaves spot quotes to the trade instrument in the selected panel', () => {
    mockMultiChartLayout = {
      preset: '2h',
      activePanelId: 'panel-2',
      panels: {
        main: { source: ethSource },
        'panel-2': { source: { ...ethSource, coin: '@107' } },
      },
    };
    renderTradingViewCandles();

    expect(mockSetTradeRouteViewState).not.toHaveBeenCalled();
  });

  it('keeps a selected panel read-only until the trade instrument follows', () => {
    mockMultiChartLayout = {
      preset: '2h',
      activePanelId: 'panel-2',
      panels: { main: { source: btcSource } },
    };
    // The grid already shows ETH there, the trade instrument is still BTC.
    mockPendingActiveSource = ethSource;
    renderTradingViewCandles();

    const selected = getChartProps('ETH');
    expect(selected?.onReferenceLineAction).toBeUndefined();
    expect(selected?.onPriceSelect).toBeUndefined();
    expect(getChartProps('BTC')?.onReferenceLineAction).toBeUndefined();
  });

  it('switches the trade instrument to a selected panel token', async () => {
    renderTradingViewCandles();
    const select = mockMultiChartProps?.onSelectPanel;

    await expect(select?.(ethSource)).resolves.toBe(true);
    expect(mockSwitchTradeInstrument).toHaveBeenLastCalledWith({
      mode: 'perp',
      coin: 'ETH',
    });
    await select?.({ ...ethSource, coin: '@107' });
    expect(mockSwitchTradeInstrument).toHaveBeenLastCalledWith({
      mode: 'spot',
      coin: '@107',
    });
    mockSwitchTradeInstrument.mockResolvedValueOnce(false);
    await expect(select?.(ethSource)).resolves.toBe(false);
  });

  it('shows the trade instrument in every panel while the token is synced', () => {
    mockMultiChartLayout = { ...mockMultiChartLayout, sync: { symbol: true } };
    renderTradingViewCandles();

    expect(getChartProps('ETH')).toBeUndefined();
    const panels = mockNativeChart.mock.calls
      .map(([props]) => props)
      .filter((props) => props.testID?.endsWith('panel-2'));
    const panel = panels.at(-1);
    expect(panel?.source).toEqual(btcSource);
    // A pick in any panel now switches the trade instrument, like the ticker
    // bar's.
    expect(getPicker('panel-2')?.onSelectToken).toBeUndefined();
    // Only the selected panel trades.
    expect(panel?.onReferenceLineAction).toBeUndefined();
    const selected = mockNativeChart.mock.calls
      .map(([props]) => props)
      .findLast((props) => props.testID === undefined);
    expect(selected?.onReferenceLineAction).toBe(mockReferenceLineAction);
  });

  it('leaves spot quotes to the trade instrument while the token is synced', () => {
    mockMultiChartLayout = {
      preset: '2h',
      sync: { symbol: true },
      panels: { 'panel-2': { source: { ...ethSource, coin: '@107' } } },
    };
    renderTradingViewCandles();

    expect(mockSetTradeRouteViewState).not.toHaveBeenCalled();
  });

  it('stays a single chart on native layouts', () => {
    const nativePlatform = jest.replaceProperty(platformEnv, 'isNative', true);
    try {
      renderTradingViewCandles();
      expect(getChartProps('ETH')).toBeUndefined();
    } finally {
      nativePlatform.restore();
    }
  });
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
    mockCustomSettings.chartMode = 'tradingView';
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
  ['mobile chart', PerpCandles],
  ['desktop workspace', PerpMarketWorkspacePanel],
] as const)('%s chart mode preference', (_name, Chart) => {
  beforeEach(() => {
    jest.replaceProperty(platformEnv, 'isNative', _name === 'mobile chart');
  });

  afterEach(() => jest.restoreAllMocks());

  it('defaults to native and switches to TradingView when no preference exists', () => {
    const view = render(<Chart />);

    expect(mockNativeChart).toHaveBeenCalled();
    expect(mockChartMount).not.toHaveBeenCalled();
    act(() => mockNativeChart.mock.lastCall?.[0].onChartSwitch?.());
    view.rerender(<Chart />);

    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockCustomSettings).toEqual({
      chartMode: 'tradingView',
      showChartLines: false,
    });
  });

  it('restores a saved native chart preference', () => {
    mockCustomSettings.chartMode = 'native';
    render(<Chart />);

    expect(mockNativeChart).toHaveBeenCalled();
    expect(mockChartMount).not.toHaveBeenCalled();
    expect(mockSetCustomSettings).not.toHaveBeenCalled();
  });

  it('remembers both choices across remounts and preserves other settings', () => {
    mockCustomSettings.chartMode = 'tradingView';
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
