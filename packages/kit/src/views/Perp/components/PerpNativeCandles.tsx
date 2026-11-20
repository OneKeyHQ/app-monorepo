import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { XStack, YStack } from '@onekeyhq/components';
import {
  TradingViewNative,
  TradingViewNativeMultiChart,
  getTradingViewNativeSourceKey,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type {
  ITradingViewNativeMultiChartPanel,
  ITradingViewNativeMultiChartProps,
  ITradingViewNativeProps,
  ITradingViewNativeSource,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import {
  getTradingViewNativeMultiChartActivePanelId,
  getTradingViewNativeMultiChartPanelIds,
  getTradingViewNativeMultiChartSync,
  normalizeTradingViewNativeMultiChartLayout,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/multiChart/multiChartLayout';
import { TradingViewNativeTokenHeader } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNativeTokenHeader';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsTradingViewIndicatorSettingsPersistAtom,
  usePerpsTradingViewMultiChartPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getDexIndexByAssetId } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import {
  getHyperliquidTokenImageUris,
  getHyperliquidTokenImageUrl,
  isSpotInstrument,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { useActivePerpsChartInstrument } from '../hooks/usePerpsChartInstrument';
import { usePerpsChartOrderMenu } from '../hooks/usePerpsChartOrderMenu';
import { usePerpsChartPanelInstrument } from '../hooks/usePerpsChartPanelInstrument';
import { usePerpsNativeChartLines } from '../hooks/usePerpsNativeChartLines';
import { usePerpsNativeChartMarks } from '../hooks/usePerpsNativeChartMarks';
import { usePerpsNativeChartMetadata } from '../hooks/usePerpsNativeChartMetadata';
import { PerpTestIDs } from '../testIDs';

import { CtxPriceDisplay } from './FavoritesBar/FavoriteTokenItem';
import { PerpChartTokenSelector } from './TokenSelector/PerpChartTokenSelector';

import type { IPerpTokenSelection } from './TokenSelector/PerpTokenSelector';
import type {
  IPerpsChartInstrument,
  IPerpsChartInstrumentDisplay,
} from '../hooks/usePerpsChartInstrument';

export type IPerpNativeCandlesProps = ITradingViewNativeProps & {
  enableTradingUi: boolean;
  /**
   * False while the page keeps the chart mounted behind another view. The
   * split view then lets go of the quotes only its panel headers need.
   */
  isVisible?: boolean;
};

// The chart of the active trade instrument, with its trading integrations.
export function PerpNativeCandles({
  enableTradingUi,
  // Only the split view has quotes of its own to let go of.
  isVisible,
  ...props
}: IPerpNativeCandlesProps) {
  const { chartComponents: lines, onReferenceLineAction } =
    usePerpsNativeChartLines(enableTradingUi);
  const marks = usePerpsNativeChartMarks();
  const metadata = usePerpsNativeChartMetadata();
  const orderMenu = usePerpsChartOrderMenu(enableTradingUi);
  const chartComponents = useMemo(() => [...lines, ...marks], [lines, marks]);
  const { baseName, coin, displayName, mode } = useActiveTradeDisplay();
  const fullscreenHeader = useMemo(
    () =>
      platformEnv.isNative ? (
        <TradingViewNativeTokenHeader
          name={mode === 'spot' ? displayName : `${displayName}USDC`}
          {...(mode === 'spot'
            ? { tokenImageUri: getHyperliquidTokenImageUrl(baseName) }
            : { tokenImageUris: getHyperliquidTokenImageUris(coin) })}
        />
      ) : undefined,
    [baseName, coin, displayName, mode],
  );
  return (
    <TradingViewNative
      {...props}
      {...metadata}
      {...orderMenu}
      isPricePrecisionLoading={metadata.priceDecimalPlaces === undefined}
      nativeChartFullscreenHeader={fullscreenHeader}
      chartComponents={chartComponents}
      onReferenceLineAction={
        enableTradingUi ? onReferenceLineAction : undefined
      }
    />
  );
}

const PANEL_HEADER_HEIGHT = 32;

// Offered to newly opened panels, most liquid first.
const DEFAULT_PANEL_COINS = ['BTC', 'ETH', 'SOL', 'HYPE'];

function getHyperliquidSource(coin: string): ITradingViewNativeSource {
  return { kind: 'hyperliquid', coin, environment: 'mainnet' };
}

const getDefaultPanelSource: ITradingViewNativeMultiChartProps['getDefaultPanelSource'] =
  ({ usedSources }) => {
    const usedCoins = new Set(
      usedSources.flatMap((source) =>
        source.kind === 'hyperliquid' ? [source.coin] : [],
      ),
    );
    return getHyperliquidSource(
      DEFAULT_PANEL_COINS.find((coin) => !usedCoins.has(coin)) ??
        DEFAULT_PANEL_COINS[0],
    );
  };

// Live price and 24h change of a panel's token, as in the favorites bar.
function PerpChartPanelQuote({
  assetId,
  coin,
  isLive,
  mode,
}: {
  assetId?: number;
  coin: string;
  /** The quote is on screen, so it has to stream. */
  isLive: boolean;
  mode: 'perp' | 'spot';
}) {
  const actions = useHyperliquidActions();
  // Perp quotes come from the shared asset contexts, which only update while
  // something on screen needs them.
  useEffect(() => {
    if (mode !== 'perp' || !isLive) return;
    const { markAllAssetCtxsNotRequired, markAllAssetCtxsRequired } =
      actions.current;
    markAllAssetCtxsRequired();
    return () => markAllAssetCtxsNotRequired();
  }, [actions, isLive, mode]);
  // Off screen the quote would still follow the trade instrument's own ticks.
  if (assetId === undefined || !isLive) return null;
  return (
    <CtxPriceDisplay
      key={`${mode}:${coin}:${assetId}`}
      coinName={coin}
      dexIndex={getDexIndexByAssetId(assetId)}
      assetId={assetId}
      mode={mode}
      displayMode="priceAndPercent"
    />
  );
}

/**
 * One split-view panel. The selected panel is the trading chart: once the
 * trade instrument has switched to its token it has every trading integration.
 * The others show their token's candles with the account's lines and fills
 * read-only. Selecting a panel only changes these props, so no chart remounts.
 * Only the selected panel's controls are on screen, above the grid, so every
 * panel gets the page-level controls; in a split each panel shows its token,
 * price and 24h change instead. The token is a picker: a press on it selects
 * the panel like any press in it, and a pick selects the panel with the
 * picked token, so one switch of the trade instrument decides both.
 */
function PerpNativeSplitPanel({
  activeDisplay,
  enableTradingUi,
  hostProps,
  isVisible,
  panel,
  switchingCoin,
}: {
  activeDisplay: IPerpsChartInstrumentDisplay;
  enableTradingUi: boolean;
  hostProps: Omit<ITradingViewNativeProps, 'source'>;
  isVisible: boolean;
  panel: ITradingViewNativeMultiChartPanel;
  /** The token of a panel switch still on its way. */
  switchingCoin?: string;
}) {
  const { id, isActive, isMain, isSplit, layoutControl, selectSource, source } =
    panel;
  const coin = source.kind === 'hyperliquid' ? source.coin : '';
  const activeInstrument = useActivePerpsChartInstrument();
  const { display, instrument: panelInstrument } =
    usePerpsChartPanelInstrument(coin);
  // A selected panel keeps its own token until the switch has landed, so it
  // never shows the previous token's orders or menu.
  const isTrading = isActive && activeInstrument.coin === coin;
  // A switch publishes the trade instrument before its metadata has loaded.
  // The panel already has the same token's metadata, so its chart keeps its
  // precision and quote meanwhile instead of flashing the loading mask.
  const instrument = useMemo<IPerpsChartInstrument>(
    () =>
      isTrading
        ? {
            ...activeInstrument,
            szDecimals:
              activeInstrument.szDecimals ?? panelInstrument.szDecimals,
            spotName: activeInstrument.spotName ?? panelInstrument.spotName,
            assetId: activeInstrument.assetId ?? panelInstrument.assetId,
          }
        : panelInstrument,
    [activeInstrument, isTrading, panelInstrument],
  );
  // Orders wait for the switch to land: until then the trade instrument
  // shows the token without its metadata, trade mode and form. The panel's
  // own metadata above is for display only.
  const isTradeReady =
    isTrading &&
    switchingCoin !== coin &&
    activeInstrument.szDecimals !== undefined;
  const canTrade = isTradeReady && enableTradingUi;
  const { chartComponents: lines, onReferenceLineAction } =
    usePerpsNativeChartLines(canTrade, instrument);
  const marks = usePerpsNativeChartMarks(instrument);
  const metadata = usePerpsNativeChartMetadata(instrument);
  const orderMenu = usePerpsChartOrderMenu(canTrade);
  const chartComponents = useMemo(() => [...lines, ...marks], [lines, marks]);
  const tokenDisplay = coin === activeInstrument.coin ? activeDisplay : display;
  const handleSelectToken = useCallback(
    (selection: IPerpTokenSelection) =>
      selectSource(getHyperliquidSource(selection.coin)),
    [selectSource],
  );
  const { onInteractionChange, testID, ...pageProps } = hostProps;
  return (
    // The header slot is always there, so a preset change never remounts the
    // chart beside it.
    <YStack flex={1} minHeight={0}>
      {isSplit ? (
        <XStack
          h={PANEL_HEADER_HEIGHT}
          px="$2"
          gap="$2"
          flexShrink={0}
          alignItems="center"
          overflow="hidden"
          testID={`${PerpTestIDs.NativeChartPanelHeader}-${id}`}
        >
          <PerpChartTokenSelector
            display={tokenDisplay}
            onSelectToken={handleSelectToken}
            testID={`${PerpTestIDs.NativeChartPanelToken}-${id}`}
          />
          <PerpChartPanelQuote
            coin={coin}
            mode={instrument.mode}
            assetId={instrument.assetId}
            isLive={isVisible}
          />
        </XStack>
      ) : null}
      <TradingViewNative
        {...pageProps}
        {...(canTrade ? orderMenu : {})}
        testID={isMain ? testID : `${PerpTestIDs.NativeChartPanel}-${id}`}
        onInteractionChange={isMain ? onInteractionChange : undefined}
        source={source}
        priceDecimalPlaces={metadata.priceDecimalPlaces}
        isPricePrecisionLoading={metadata.priceDecimalPlaces === undefined}
        chartComponents={chartComponents}
        onReferenceLineAction={canTrade ? onReferenceLineAction : undefined}
        nativeControlsTrailing={layoutControl}
      />
    </YStack>
  );
}

/**
 * The trading chart with optional extra panels for other tokens. Only the
 * large web, extension and desktop layouts mount this. Selecting a panel makes
 * its token the trade instrument; every chart keeps its place and token.
 */
export function PerpNativeSplitCandles({
  enableTradingUi,
  isVisible = true,
  source,
  ...hostProps
}: IPerpNativeCandlesProps) {
  const actions = useHyperliquidActions();
  const [layout, setLayout] = usePerpsTradingViewMultiChartPersistAtom();
  const [indicatorSettings] = usePerpsTradingViewIndicatorSettingsPersistAtom();
  const { baseName, coin, displayName, mode } = useActiveTradeDisplay();
  const activeDisplay = useMemo<IPerpsChartInstrumentDisplay>(
    () =>
      mode === 'spot'
        ? {
            label: displayName,
            tokenImageUri: getHyperliquidTokenImageUrl(baseName),
          }
        : {
            label: `${displayName}USDC`,
            tokenImageUris: getHyperliquidTokenImageUris(coin),
          },
    [baseName, coin, displayName, mode],
  );
  // The panel switch on its way, whose chart stays read-only until it lands.
  const [switchingCoin, setSwitchingCoin] = useState<string>();
  const switchSeq = useRef(0);
  const handleSelectPanel = useCallback(
    async (panelSource: ITradingViewNativeSource) => {
      if (panelSource.kind !== 'hyperliquid') return false;
      switchSeq.current += 1;
      const seq = switchSeq.current;
      setSwitchingCoin(panelSource.coin);
      try {
        const switched = await actions.current.switchTradeInstrument({
          mode: isSpotInstrument(panelSource.coin) ? 'spot' : 'perp',
          coin: panelSource.coin,
        });
        return switched !== false;
      } finally {
        if (switchSeq.current === seq) setSwitchingCoin(undefined);
      }
    },
    [actions],
  );
  // Spot quotes only stream while something asks for them; the selected
  // panel's token is covered by the trade instrument itself.
  const hasSpotQuote = useMemo(() => {
    const saved = normalizeTradingViewNativeMultiChartLayout(layout);
    const activeId = getTradingViewNativeMultiChartActivePanelId(saved);
    const panelIds = getTradingViewNativeMultiChartPanelIds(saved.preset);
    return (
      panelIds.length > 1 &&
      // A shared token is the trade instrument in every panel.
      !getTradingViewNativeMultiChartSync(saved).symbol &&
      panelIds.some((id) => {
        const panelSource = saved.panels[id]?.source;
        return (
          id !== activeId &&
          panelSource?.kind === 'hyperliquid' &&
          isSpotInstrument(panelSource.coin)
        );
      })
    );
  }, [layout]);
  // Hidden charts stay mounted with their layout, without the quotes.
  const streamsSpotQuote = hasSpotQuote && isVisible;
  useEffect(() => {
    if (!streamsSpotQuote) return;
    const { setTradeRouteViewState } = actions.current;
    setTradeRouteViewState({ chartPanelsSpotActive: true });
    return () => setTradeRouteViewState({ chartPanelsSpotActive: false });
  }, [actions, streamsSpotQuote]);
  const renderPanel = (panel: ITradingViewNativeMultiChartPanel) => (
    <PerpNativeSplitPanel
      key={getTradingViewNativeSourceKey(panel.source)}
      panel={panel}
      activeDisplay={activeDisplay}
      enableTradingUi={enableTradingUi}
      hostProps={hostProps}
      isVisible={isVisible}
      switchingCoin={switchingCoin}
    />
  );
  return (
    <TradingViewNativeMultiChart
      testID={PerpTestIDs.NativeChartSplitView}
      layout={layout}
      layoutKey="perps"
      onLayoutChange={setLayout}
      activeSource={source}
      onSelectPanel={handleSelectPanel}
      defaultIndicatorSettings={indicatorSettings}
      getDefaultPanelSource={getDefaultPanelSource}
      renderPanel={renderPanel}
    />
  );
}
