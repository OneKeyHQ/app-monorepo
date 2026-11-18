import { useCallback, useEffect, useMemo } from 'react';

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
import type { IPerpsChartInstrumentDisplay } from '../hooks/usePerpsChartInstrument';

export type IPerpNativeCandlesProps = ITradingViewNativeProps & {
  enableTradingUi: boolean;
};

// The chart of the active trade instrument, with its trading integrations.
export function PerpNativeCandles({
  enableTradingUi,
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
  mode,
}: {
  assetId?: number;
  coin: string;
  mode: 'perp' | 'spot';
}) {
  const actions = useHyperliquidActions();
  // Perp quotes come from the shared asset contexts, which only update while
  // something on screen needs them.
  useEffect(() => {
    if (mode !== 'perp') return;
    const { markAllAssetCtxsNotRequired, markAllAssetCtxsRequired } =
      actions.current;
    markAllAssetCtxsRequired();
    return () => markAllAssetCtxsNotRequired();
  }, [actions, mode]);
  if (assetId === undefined) return null;
  const dexIndex = getDexIndexByAssetId(assetId);
  const key = `${mode}:${coin}:${assetId}`;
  return (
    <>
      <CtxPriceDisplay
        key={`${key}:price`}
        coinName={coin}
        dexIndex={dexIndex}
        assetId={assetId}
        mode={mode}
        displayMode="price"
      />
      <CtxPriceDisplay
        key={`${key}:percent`}
        coinName={coin}
        dexIndex={dexIndex}
        assetId={assetId}
        mode={mode}
        displayMode="percent"
      />
    </>
  );
}

/**
 * One split-view panel. The selected panel is the trading chart: once the
 * trade instrument has switched to its token it has every trading integration.
 * The others show their token's candles with the account's lines and fills
 * read-only. Selecting a panel only changes these props, so no chart remounts.
 * Only the selected panel's controls are on screen, above the grid, so every
 * panel gets the page-level controls; in a split each panel names its token,
 * price and 24h change instead.
 */
function PerpNativeSplitPanel({
  activeDisplay,
  enableTradingUi,
  hostProps,
  panel,
}: {
  activeDisplay: IPerpsChartInstrumentDisplay;
  enableTradingUi: boolean;
  hostProps: Omit<ITradingViewNativeProps, 'source'>;
  panel: ITradingViewNativeMultiChartPanel;
}) {
  const {
    id,
    isActive,
    isMain,
    isSplit,
    isSymbolSynced,
    layoutControl,
    setSource,
    source,
  } = panel;
  const coin = source.kind === 'hyperliquid' ? source.coin : '';
  const activeInstrument = useActivePerpsChartInstrument();
  const { display, instrument: panelInstrument } =
    usePerpsChartPanelInstrument(coin);
  // A selected panel keeps its own token until the switch has landed, so it
  // never shows the previous token's orders or menu.
  const isTrading = isActive && activeInstrument.coin === coin;
  const instrument = isTrading ? activeInstrument : panelInstrument;
  const canTrade = isTrading && enableTradingUi;
  const { chartComponents: lines, onReferenceLineAction } =
    usePerpsNativeChartLines(canTrade, instrument);
  const marks = usePerpsNativeChartMarks(instrument);
  const metadata = usePerpsNativeChartMetadata(instrument);
  const orderMenu = usePerpsChartOrderMenu(canTrade);
  const chartComponents = useMemo(() => [...lines, ...marks], [lines, marks]);
  const handleSelectToken = useCallback(
    (selection: IPerpTokenSelection) => {
      setSource(getHyperliquidSource(selection.coin));
    },
    [setSource],
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
            testID={`${PerpTestIDs.NativeChartPanelTokenSelector}-${id}`}
            display={coin === activeInstrument.coin ? activeDisplay : display}
            // The selected panel's picker switches the trade instrument, and
            // so does every picker while the panels share the token.
            onSelectToken={
              isActive || isSymbolSynced ? undefined : handleSelectToken
            }
          />
          <PerpChartPanelQuote
            coin={coin}
            mode={instrument.mode}
            assetId={instrument.assetId}
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
  const handleSelectPanel = useCallback(
    async (panelSource: ITradingViewNativeSource) => {
      if (panelSource.kind !== 'hyperliquid') return false;
      const switched = await actions.current.switchTradeInstrument({
        mode: isSpotInstrument(panelSource.coin) ? 'spot' : 'perp',
        coin: panelSource.coin,
      });
      return switched !== false;
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
  useEffect(() => {
    if (!hasSpotQuote) return;
    const { setTradeRouteViewState } = actions.current;
    setTradeRouteViewState({ chartPanelsSpotActive: true });
    return () => setTradeRouteViewState({ chartPanelsSpotActive: false });
  }, [actions, hasSpotQuote]);
  const renderPanel = (panel: ITradingViewNativeMultiChartPanel) => (
    <PerpNativeSplitPanel
      key={getTradingViewNativeSourceKey(panel.source)}
      panel={panel}
      activeDisplay={activeDisplay}
      enableTradingUi={enableTradingUi}
      hostProps={hostProps}
    />
  );
  return (
    <TradingViewNativeMultiChart
      testID={PerpTestIDs.NativeChartSplitView}
      layout={layout}
      onLayoutChange={setLayout}
      activeSource={source}
      onSelectPanel={handleSelectPanel}
      defaultIndicatorSettings={indicatorSettings}
      getDefaultPanelSource={getDefaultPanelSource}
      renderPanel={renderPanel}
    />
  );
}
