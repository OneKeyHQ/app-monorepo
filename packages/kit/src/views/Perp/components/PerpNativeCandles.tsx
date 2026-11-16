import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
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
import { TradingViewNativeTokenHeader } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewNativeTokenHeader';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsTradingViewIndicatorSettingsPersistAtom,
  usePerpsTradingViewMultiChartPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getHyperliquidTokenImageUris,
  getHyperliquidTokenImageUrl,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { usePerpsChartOrderMenu } from '../hooks/usePerpsChartOrderMenu';
import { usePerpsChartPanelInstrument } from '../hooks/usePerpsChartPanelInstrument';
import { usePerpsNativeChartLines } from '../hooks/usePerpsNativeChartLines';
import { usePerpsNativeChartMarks } from '../hooks/usePerpsNativeChartMarks';
import { usePerpsNativeChartMetadata } from '../hooks/usePerpsNativeChartMetadata';
import { PerpTestIDs } from '../testIDs';

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

// An extra split-view panel: any token's candles with the account's lines and
// fills for it, read-only. Trading stays with the first panel.
function PerpNativePanelCandles({
  mainSource,
  panel,
}: {
  mainSource: ITradingViewNativeSource;
  panel: ITradingViewNativeMultiChartPanel;
}) {
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const { id, setSource, source } = panel;
  const coin = source.kind === 'hyperliquid' ? source.coin : '';
  const { display, instrument } = usePerpsChartPanelInstrument(coin);
  const { chartComponents: lines } = usePerpsNativeChartLines(
    false,
    instrument,
  );
  const marks = usePerpsNativeChartMarks(instrument);
  const { priceDecimalPlaces } = usePerpsNativeChartMetadata(instrument);
  const chartComponents = useMemo(() => [...lines, ...marks], [lines, marks]);
  const handleSelectToken = useCallback(
    (selection: IPerpTokenSelection) =>
      setSource(getHyperliquidSource(selection.coin)),
    [setSource],
  );
  const { mode } = instrument;
  const handleTrade = useCallback(async () => {
    const switched = await actions.current.switchTradeInstrument({
      mode,
      coin,
    });
    // Swap rather than duplicate: the token that was being traded stays on
    // screen in this panel.
    if (switched !== false) setSource(mainSource);
  }, [actions, coin, mainSource, mode, setSource]);
  return (
    <TradingViewNative
      testID={`${PerpTestIDs.NativeChartPanel}-${id}`}
      source={source}
      storageNamespace="perps"
      priceDecimalPlaces={priceDecimalPlaces}
      isPricePrecisionLoading={priceDecimalPlaces === undefined}
      nativeControlsLayoutMode="desktop"
      chartComponents={chartComponents}
      nativeControlsLeading={
        <PerpChartTokenSelector
          testID={`${PerpTestIDs.NativeChartPanelTokenSelector}-${id}`}
          display={display}
          onSelectToken={handleSelectToken}
        />
      }
      nativeControlsTrailing={
        <IconButton
          testID={`${PerpTestIDs.NativeChartPanelTrade}-${id}`}
          size="small"
          variant="tertiary"
          icon="SwitchHorOutline"
          iconSize="$5"
          title={intl.formatMessage({ id: ETranslations.global_trade })}
          onPress={handleTrade}
        />
      }
    />
  );
}

/**
 * The trading chart with optional extra panels for other tokens. Only the
 * large web, extension and desktop layouts mount this; the first panel is the
 * same `PerpNativeCandles` the single-chart layouts use.
 */
export function PerpNativeSplitCandles({
  source,
  ...props
}: IPerpNativeCandlesProps) {
  const [layout, setLayout] = usePerpsTradingViewMultiChartPersistAtom();
  const [indicatorSettings] = usePerpsTradingViewIndicatorSettingsPersistAtom();
  const { baseName, coin, displayName, mode } = useActiveTradeDisplay();
  const mainDisplay = useMemo<IPerpsChartInstrumentDisplay>(
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
  const renderPanel = (panel: ITradingViewNativeMultiChartPanel) =>
    panel.isMain ? (
      <PerpNativeCandles
        key={getTradingViewNativeSourceKey(source)}
        {...props}
        source={source}
        nativeControlsLeading={
          // Several charts are on screen, so each one names its token.
          panel.isSplit ? (
            <PerpChartTokenSelector
              testID={`${PerpTestIDs.NativeChartPanelTokenSelector}-${panel.id}`}
              display={mainDisplay}
            />
          ) : undefined
        }
        nativeControlsTrailing={panel.layoutControl}
      />
    ) : (
      <PerpNativePanelCandles
        key={getTradingViewNativeSourceKey(panel.source)}
        panel={panel}
        mainSource={source}
      />
    );
  return (
    <TradingViewNativeMultiChart
      testID={PerpTestIDs.NativeChartSplitView}
      layout={layout}
      onLayoutChange={setLayout}
      mainSource={source}
      defaultIndicatorSettings={indicatorSettings}
      getDefaultPanelSource={getDefaultPanelSource}
      renderPanel={renderPanel}
    />
  );
}
