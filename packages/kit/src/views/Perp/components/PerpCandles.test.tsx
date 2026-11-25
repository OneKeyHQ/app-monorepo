import type { ContextType, ReactNode } from 'react';

import { act, render, waitFor } from '@testing-library/react-native';

import type {
  ITradingViewChartMode,
  TradingViewChartModeSelectContext,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  type ITradingViewNativeMultiChartProps,
  type ITradingViewNativeProps,
  type ITradingViewNativeSource,
  TradingViewNative,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewPerpsV2Props } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import type { IPerpsCustomSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITradingViewNativeMultiChartLayout } from '@onekeyhq/shared/types/tradingViewNative';

import { buildActiveTradeDisplay } from '../hooks/useActiveTradeDisplayUtils';
import { PerpTestIDs } from '../testIDs';

import {
  PerpDesktopOrderBookPanel,
  PerpMarketWorkspacePanel,
} from './MarketDetail/PerpMarketWorkspacePanel';
import { PerpCandles } from './PerpCandles';

let mockWorkspaceSelect: ContextType<typeof TradingViewChartModeSelectContext>;
let mockAccountAddress: string | undefined;
let mockCoin = 'ETH';
let mockInstrumentMode: 'perp' | 'spot' = 'perp';
let mockSzDecimals: number | undefined = 2;
let mockTradeDisplay: ReturnType<typeof buildActiveTradeDisplay> | undefined;
let mockRecentTradesForeground = true;
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockRecentTrades = jest.fn<null, [{ active: boolean; visible: boolean }]>(
  () => null,
);
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
let mockMultiChartProps: ITradingViewNativeMultiChartProps | undefined;
// The panel selected on this page, which the host keeps for the grid.
let mockSelectedPanelId: string | undefined;
const mockSetSelectedPanelId = jest.fn<void, [string]>();
// What the grid shows in the selected panel while the host is still switching.
let mockPendingActiveSource: ITradingViewNativeSource | undefined;
const mockReferenceLineAction = jest.fn();
const mockPriceSelect = jest.fn();
const mockMarkAllAssetCtxsRequired = jest.fn();
const mockMarkAllAssetCtxsNotRequired = jest.fn();
const mockSetTradeRouteViewState = jest.fn();
type IMockTokenSelectorProps = {
  display: { label: string };
  onSelectToken: (selection: { mode: 'perp' | 'spot'; coin: string }) => void;
  testID?: string;
};
const mockTokenSelector = jest.fn<null, [IMockTokenSelectorProps]>(() => null);
const mockSelectSource = jest.fn<void, [string, ITradingViewNativeSource]>();
const mockQuote = jest.fn<
  null,
  [{ coinName: string; mode: string; assetId: number; displayMode: string }]
>(() => null);
// Panel quotes currently mounted.
let mockMountedQuotes = 0;
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
  Tooltip: Object.assign(
    ({ renderTrigger }: { renderTrigger: ReactNode }) => renderTrigger,
    { Text: ({ children }: { children?: ReactNode }) => children },
  ),
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
  useChartSelectedPanelIdAtom: () => [
    mockSelectedPanelId,
    mockSetSelectedPanelId,
  ],
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
  CtxPriceDisplay: (props: Parameters<typeof mockQuote>[0]) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      mockMountedQuotes += 1;
      return () => {
        mockMountedQuotes -= 1;
      };
    }, []);
    return mockQuote(props);
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls',
  () => ({
    TradingViewChartModeSelectContext: jest
      .requireActual<typeof import('react')>('react')
      .createContext(null),
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
  TradingViewNative: (props: ITradingViewNativeProps) => {
    const { useContext } = jest.requireActual<typeof import('react')>('react');
    const { TradingViewChartModeSelectContext: SelectContext } =
      jest.requireMock<{
        TradingViewChartModeSelectContext: typeof TradingViewChartModeSelectContext;
      }>('@onekeyhq/kit/src/components/TradingView/TradingViewChartControls');
    mockWorkspaceSelect = useContext(SelectContext);
    return mockNativeChart(props);
  },
  // The grid itself is covered beside the component; here it only has to hand
  // every visible panel to the host.
  TradingViewNativeMultiChart: (props: ITradingViewNativeMultiChartProps) => {
    mockMultiChartProps = props;
    const { activeSource, layout, renderPanel, selectedPanelId } = props;
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
    const activeId = getTradingViewNativeMultiChartActivePanelId(
      selectedPanelId ? { ...layout, activePanelId: selectedPanelId } : layout,
    );
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
            selectSource: (picked: ITradingViewNativeSource) =>
              mockSelectSource(id, picked),
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

jest.mock('../hooks/usePerpMarketForeground', () => ({
  usePerpMarketForeground: () => mockRecentTradesForeground,
}));

jest.mock('./PerpRecentTrades', () => ({
  useRecentTradesForeground: () => mockRecentTradesForeground,
  PerpRecentTrades: (props: { active: boolean; visible: boolean }) =>
    mockRecentTrades(props),
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
        const { useContext } =
          jest.requireActual<typeof import('react')>('react');
        const { TradingViewChartModeSelectContext: SelectContext } =
          jest.requireMock<{
            TradingViewChartModeSelectContext: typeof TradingViewChartModeSelectContext;
          }>(
            '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls',
          );
        mockWorkspaceSelect = useContext(SelectContext);

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
  mockRecentTradesForeground = true;
  mockCustomSettings = { showChartLines: false };
  mockMultiChartLayout = { preset: '1', panels: {} };
  mockMultiChartProps = undefined;
  mockSelectedPanelId = undefined;
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

    // The first panel keeps its token, read-only.
    const first = getChartProps('BTC');
    expect(first?.onReferenceLineAction).toBeUndefined();
    expect(first?.onPriceSelect).toBeUndefined();
  });

  it('keeps the precision and quote of a selected panel while the trade instrument loads its token', async () => {
    mockMultiChartLayout = {
      preset: '2h',
      panels: {
        main: { source: btcSource },
        'panel-2': { source: ethSource },
      },
    };
    const view = renderTradingViewCandles();
    await waitFor(() =>
      expect(getChartProps('ETH')?.priceDecimalPlaces).toBe(3),
    );

    // Selecting the panel switches the trade instrument at once, before the
    // instrument's own metadata has loaded.
    mockCoin = 'ETH';
    mockSzDecimals = undefined;
    mockMultiChartLayout = {
      ...mockMultiChartLayout,
      activePanelId: 'panel-2',
    };
    mockQuote.mockClear();
    view.rerender(<PerpCandles />);

    let trading = getChartProps('ETH');
    // No loading mask over the candles the panel already shows.
    expect(trading?.isPricePrecisionLoading).toBe(false);
    expect(trading?.priceDecimalPlaces).toBe(3);
    // Nor does its quote go away.
    expect(mockQuote).toHaveBeenCalledWith(
      expect.objectContaining({ coinName: 'ETH', assetId: 7 }),
    );
    // That metadata is for display only: orders wait for the trade
    // instrument's own, which comes with the switch.
    expect(trading?.onReferenceLineAction).toBeUndefined();
    expect(trading?.onPriceSelect).toBeUndefined();

    mockSzDecimals = 3;
    view.rerender(<PerpCandles />);
    trading = getChartProps('ETH');
    expect(trading?.onReferenceLineAction).toBe(mockReferenceLineAction);
    expect(trading?.onPriceSelect).toBe(mockPriceSelect);
  });

  it('keeps a selected panel read-only until the switch to its token lands', async () => {
    mockMultiChartLayout = {
      preset: '2h',
      panels: {
        main: { source: btcSource },
        'panel-2': { source: ethSource },
      },
    };
    let finish: (switched: boolean) => void = () => {};
    mockSwitchTradeInstrument.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderTradingViewCandles();
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = mockMultiChartProps?.onSelectPanel(ethSource);
    });

    // The trade instrument shows the token, with its precision as a spot
    // switch publishes it, while the switch is still settling.
    mockCoin = 'ETH';
    mockMultiChartLayout = {
      ...mockMultiChartLayout,
      activePanelId: 'panel-2',
    };
    view.rerender(<PerpCandles />);
    expect(getChartProps('ETH')?.onReferenceLineAction).toBeUndefined();
    expect(getChartProps('ETH')?.onPriceSelect).toBeUndefined();

    await act(async () => {
      finish(true);
      await answer;
    });
    expect(getChartProps('ETH')?.onReferenceLineAction).toBe(
      mockReferenceLineAction,
    );
    expect(getChartProps('ETH')?.onPriceSelect).toBe(mockPriceSelect);
  });

  it('selects a panel with the token picked in its header', async () => {
    renderTradingViewCandles();
    const picker = mockTokenSelector.mock.calls.findLast(
      ([props]) =>
        props.testID === `${PerpTestIDs.NativeChartPanelToken}-panel-2`,
    )?.[0];

    act(() => picker?.onSelectToken({ mode: 'perp', coin: 'SOL' }));

    // The grid decides the selection and the switch together.
    expect(mockSelectSource).toHaveBeenCalledWith('panel-2', {
      kind: 'hyperliquid',
      coin: 'SOL',
      environment: 'mainnet',
    });
    expect(mockSwitchTradeInstrument).not.toHaveBeenCalled();
  });

  it('gives each panel a token picker of its own', async () => {
    renderTradingViewCandles();

    // A pick switches the trade instrument, as from the page's picker, and
    // the press on the picker selects its panel like any press in the panel.
    await waitFor(() =>
      expect(
        mockTokenSelector.mock.calls.map(([props]) => [
          props.testID,
          props.display.label,
        ]),
      ).toEqual(
        expect.arrayContaining([
          [`${PerpTestIDs.NativeChartPanelToken}-main`, 'BTCUSDC'],
          [`${PerpTestIDs.NativeChartPanelToken}-panel-2`, 'ETHUSDC'],
        ]),
      ),
    );
  });

  it('names every token with its live quote while split', async () => {
    const { unmount } = renderTradingViewCandles();

    await waitFor(() =>
      expect(mockQuote).toHaveBeenCalledWith(
        expect.objectContaining({ coinName: 'ETH', assetId: 7 }),
      ),
    );
    // One quote per panel shows both the price and the 24h change.
    for (const coinName of ['BTC', 'ETH']) {
      expect(mockQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          coinName,
          mode: 'perp',
          displayMode: 'priceAndPercent',
        }),
      );
    }
    expect(
      new Set(mockQuote.mock.calls.map(([props]) => props.displayMode)),
    ).toEqual(new Set(['priceAndPercent']));
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

  it('lets go of the panel quotes while the workspace shows another view', async () => {
    mockMultiChartLayout = {
      preset: '2h',
      panels: { 'panel-2': { source: { ...ethSource, coin: '@107' } } },
    };
    render(<PerpMarketWorkspacePanel />);
    await waitFor(() => expect(mockMountedQuotes).toBeGreaterThan(0));
    expect(mockSetTradeRouteViewState).toHaveBeenLastCalledWith({
      chartPanelsSpotActive: true,
    });
    expect(mockMarkAllAssetCtxsRequired.mock.calls.length).toBeGreaterThan(
      mockMarkAllAssetCtxsNotRequired.mock.calls.length,
    );

    // The chart stays mounted behind the funding view.
    act(() => {
      appEventBus.emit(EAppEventBusNames.PerpShowFundingHistory, undefined);
    });
    expect(mockSetTradeRouteViewState).toHaveBeenLastCalledWith({
      chartPanelsSpotActive: false,
    });
    expect(mockMarkAllAssetCtxsNotRequired.mock.calls.length).toBe(
      mockMarkAllAssetCtxsRequired.mock.calls.length,
    );
    // The headers drop their quotes, which would follow the trade
    // instrument's ticks.
    expect(mockMountedQuotes).toBe(0);
    expect(mockChartUnmount).not.toHaveBeenCalled();
    expect(getChartProps('@107')).toBeDefined();
  });

  it('streams the panel quotes again once the chart is back on screen', () => {
    mockMultiChartLayout = {
      preset: '2h',
      panels: { 'panel-2': { source: { ...ethSource, coin: '@107' } } },
    };
    const view = render(<PerpCandles isVisible={false} />);
    expect(mockSetTradeRouteViewState).not.toHaveBeenCalled();
    expect(mockMarkAllAssetCtxsRequired).not.toHaveBeenCalled();

    view.rerender(<PerpCandles isVisible />);
    expect(mockSetTradeRouteViewState).toHaveBeenLastCalledWith({
      chartPanelsSpotActive: true,
    });
    expect(mockMarkAllAssetCtxsRequired).toHaveBeenCalled();
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

  it('goes by the panel selected on this page, not the one another page saved', () => {
    // Another page, e.g. an extension tab, selected the spot chart last.
    mockMultiChartLayout = {
      preset: '2h',
      activePanelId: 'panel-2',
      panels: {
        main: { source: ethSource },
        'panel-2': { source: { ...ethSource, coin: '@107' } },
      },
    };
    mockSelectedPanelId = 'main';
    renderTradingViewCandles();

    expect(mockMultiChartProps?.selectedPanelId).toBe('main');
    expect(mockMultiChartProps?.onSelectedPanelIdChange).toBe(
      mockSetSelectedPanelId,
    );
    // The spot chart is not this page's trading chart, so its quote streams.
    expect(getChartProps('@107')).toBeDefined();
    expect(mockSetTradeRouteViewState).toHaveBeenLastCalledWith({
      chartPanelsSpotActive: true,
    });
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
      requireSpotMetadata: true,
    });
    // A spot token goes only with its metadata: a chart the page cannot
    // trade on is none to select.
    await select?.({ ...ethSource, coin: '@107' });
    expect(mockSwitchTradeInstrument).toHaveBeenLastCalledWith({
      mode: 'spot',
      coin: '@107',
      requireSpotMetadata: true,
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

it.each(['web', 'desktop'] as const)(
  'keeps the %s trade feed warm for 30 seconds and drops it on a hidden market change',
  (platform) => {
    jest.useFakeTimers();
    const web = jest.replaceProperty(platformEnv, 'isWeb', platform === 'web');
    const desktop = jest.replaceProperty(
      platformEnv,
      'isDesktop',
      platform === 'desktop',
    );
    const view = render(
      <PerpDesktopOrderBookPanel initialOrderBookHeight={400} />,
    );
    const select = (label: ETranslations) => {
      act(view.UNSAFE_getByProps({ label }).props.onPress as () => void);
    };
    try {
      expect(mockRecentTrades).not.toHaveBeenCalled();
      select(ETranslations.swap_page_recent_trade);
      expect(mockRecentTrades.mock.lastCall?.[0]).toEqual({
        active: true,
        visible: true,
      });
      select(ETranslations.perps_order_book);
      act(() => {
        jest.advanceTimersByTime(29_999);
      });
      expect(mockRecentTrades.mock.lastCall?.[0]).toEqual({
        active: true,
        visible: false,
      });
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(mockRecentTrades.mock.lastCall?.[0]).toEqual({
        active: false,
        visible: false,
      });
      select(ETranslations.swap_page_recent_trade);
      select(ETranslations.perps_order_book);
      mockRecentTradesForeground = false;
      view.rerender(<PerpDesktopOrderBookPanel initialOrderBookHeight={400} />);
      mockRecentTradesForeground = true;
      view.rerender(<PerpDesktopOrderBookPanel initialOrderBookHeight={400} />);
      expect(mockRecentTrades.mock.lastCall?.[0]).toEqual({
        active: false,
        visible: false,
      });
      select(ETranslations.swap_page_recent_trade);
      select(ETranslations.perps_order_book);
      mockRecentTrades.mockClear();
      mockCoin = 'BTC';
      view.rerender(<PerpDesktopOrderBookPanel initialOrderBookHeight={400} />);
      expect(mockRecentTrades).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      web.restore();
      desktop.restore();
      jest.useRealTimers();
    }
  },
);

it.each(['web', 'desktop'] as const)(
  'opens recent trades from the narrow %s workspace',
  (platform) => {
    const web = jest.replaceProperty(platformEnv, 'isWeb', platform === 'web');
    const desktop = jest.replaceProperty(
      platformEnv,
      'isDesktop',
      platform === 'desktop',
    );
    const native = jest.replaceProperty(platformEnv, 'isNative', false);
    const view = render(<PerpMarketWorkspacePanel />);
    try {
      expect(mockRecentTrades).not.toHaveBeenCalled();
      act(
        view.UNSAFE_getByProps({ label: ETranslations.swap_page_recent_trade })
          .props.onPress as () => void,
      );
      expect(mockRecentTrades.mock.lastCall?.[0]).toEqual({
        active: true,
        visible: true,
      });
    } finally {
      view.unmount();
      native.restore();
      desktop.restore();
      web.restore();
    }
  },
);

it.each(['native', 'tradingView'] as const)(
  'opens depth in the chart area and preserves the %s chart on return',
  (chartMode) => {
    const desktop = jest.replaceProperty(platformEnv, 'isDesktop', true);
    const native = jest.replaceProperty(platformEnv, 'isNative', false);
    mockCustomSettings.chartMode = chartMode;
    const view = render(<PerpCandles />);
    const depthChart = () => view.UNSAFE_getByProps({ depthChart: true });
    try {
      const depthEntry = depthChart();
      expect(depthEntry.props.depthChartVisible).toBe(false);
      act(() => mockWorkspaceSelect?.onChange('depth'));
      expect(depthChart()).toBe(depthEntry);
      expect(depthEntry.props.depthChartVisible).toBe(true);
      expect(mockSetCustomSettings).not.toHaveBeenCalled();
      act(() => mockWorkspaceSelect?.onChange(chartMode));
      expect(depthEntry.props.depthChartVisible).toBe(false);
      expect(mockSetCustomSettings).not.toHaveBeenCalled();
      expect(mockChartUnmount).not.toHaveBeenCalled();
      view.rerender(<PerpCandles isVisible={false} />);
      expect(depthEntry.props.depthChartVisible).toBe(false);
    } finally {
      view.unmount();
      native.restore();
      desktop.restore();
    }
  },
);

it('keeps the original extension order book without recent trades or depth tabs', () => {
  const web = jest.replaceProperty(platformEnv, 'isWeb', false);
  const desktop = jest.replaceProperty(platformEnv, 'isDesktop', false);
  const native = jest.replaceProperty(platformEnv, 'isNative', false);
  const extension = jest.replaceProperty(platformEnv, 'isExtension', true);
  const view = render(
    <>
      <PerpDesktopOrderBookPanel initialOrderBookHeight={400} />
      <PerpMarketWorkspacePanel />
    </>,
  );
  try {
    expect(
      view.UNSAFE_queryAllByProps({
        label: ETranslations.swap_page_recent_trade,
      }),
    ).toHaveLength(0);
    expect(
      view.UNSAFE_queryAllByProps({
        label: ETranslations.perp_depth_chart__title,
      }),
    ).toHaveLength(0);
    expect(
      view.UNSAFE_queryAllByProps({ label: ETranslations.perps_order_book }),
    ).toHaveLength(1);
    expect(mockRecentTrades).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    extension.restore();
    native.restore();
    desktop.restore();
    web.restore();
  }
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
