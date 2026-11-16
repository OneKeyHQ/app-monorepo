import { useCallback, useEffect, useMemo, useState } from 'react';

import { BackHandler } from 'react-native';

import {
  DebugRenderTracker,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  TRADING_VIEW_CHART_CONTROLS_HEIGHT,
  TradingViewChartModeSelect,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { getTradingViewNativeSourceKey } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCandlesWebviewReloadHookAtom,
  usePerpsCustomSettingsAtom,
  usePerpsLayoutStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatSpotPairDisplayName,
  getSpotTokenDisplayName,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpNativeCandles, PerpNativeSplitCandles } from './PerpNativeCandles';

import type { IPerpNativeCandlesProps } from './PerpNativeCandles';

export function PerpCandles({
  chartMode,
  collapseChartExpandSignal,
  onTouchScroll,
  onInteractionOverlayOpenChange,
  nativeChartGrowsWithSubIndicators,
}: {
  // The workspace owns the selector when it supplies a chart mode.
  chartMode?: ITradingViewChartMode;
  collapseChartExpandSignal?: number;
  nativeChartGrowsWithSubIndicators?: boolean;
  onTouchScroll?: (deltaY: number) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
}) {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [{ reloadHook }] = usePerpsCandlesWebviewReloadHookAtom();
  const [{ chartExpanded = false }, setLayoutState] = usePerpsLayoutStateAtom();
  const [{ chartMode: savedChartMode = 'native' }, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const isTradingViewNative = (chartMode ?? savedChartMode) === 'native';
  const showChartModeSelect = chartMode === undefined;
  const [isMobileChartFullscreen, setIsMobileChartFullscreen] = useState(false);
  const [isChartInteracting, setIsChartInteracting] = useState(false);
  const { gtMd } = useMedia();
  const isDesktopLayout = gtMd && !platformEnv.isNative;
  const enableNativeChartControls = isDesktopLayout || platformEnv.isNative;
  // Perp layouts remount at this breakpoint; keep the legacy WebView URL stable.
  const [enablePerpsTradingUi] = useState(isDesktopLayout);
  const source = useMemo<ITradingViewNativeSource>(
    () => ({
      kind: 'hyperliquid',
      coin: activeTradeInstrument.coin,
      environment: 'mainnet',
    }),
    [activeTradeInstrument.coin],
  );
  const { displayPair, displayCoin } = useMemo(() => {
    if (
      activeTradeInstrument.mode !== 'spot' ||
      !activeTradeInstrument.universe
    ) {
      return { displayPair: undefined, displayCoin: undefined };
    }
    const { baseName, quoteName } = activeTradeInstrument.universe;
    return {
      displayPair: formatSpotPairDisplayName(baseName, quoteName),
      displayCoin: getSpotTokenDisplayName(baseName),
    };
  }, [activeTradeInstrument]);

  const handleFullscreenChange = useCallback(
    (isFullscreen: boolean) => {
      if (isDesktopLayout) {
        setLayoutState((prev) =>
          prev.chartExpanded === isFullscreen
            ? prev
            : { ...prev, chartExpanded: isFullscreen },
        );
      } else {
        setIsMobileChartFullscreen(isFullscreen);
      }
    },
    [isDesktopLayout, setLayoutState],
  );
  useEffect(() => {
    if (!isTradingViewNative) return;
    onInteractionOverlayOpenChange?.(
      isMobileChartFullscreen || isChartInteracting,
    );
    return () => onInteractionOverlayOpenChange?.(false);
  }, [
    isTradingViewNative,
    isMobileChartFullscreen,
    isChartInteracting,
    onInteractionOverlayOpenChange,
  ]);
  useEffect(() => {
    if (!platformEnv.isNative || !isMobileChartFullscreen) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      handleFullscreenChange(false);
      return true;
    });
    return () => listener.remove();
  }, [isMobileChartFullscreen, handleFullscreenChange]);
  useEffect(() => {
    setIsChartInteracting(false);
    setIsMobileChartFullscreen(false);
  }, [activeTradeInstrument.coin, isTradingViewNative]);
  const handleChartSwitch = useCallback(() => {
    // The legacy chart owns its expand state internally and remounts collapsed.
    handleFullscreenChange(false);
    onInteractionOverlayOpenChange?.(false);
    setIsChartInteracting(false);
    void setPerpsCustomSettings((current) => ({
      ...current,
      chartMode: current.chartMode === 'tradingView' ? 'native' : 'tradingView',
    }));
  }, [
    handleFullscreenChange,
    onInteractionOverlayOpenChange,
    setPerpsCustomSettings,
  ]);

  useEffect(() => {
    if (collapseChartExpandSignal) {
      handleFullscreenChange(false);
    }
  }, [collapseChartExpandSignal, handleFullscreenChange]);

  useEffect(
    () => () => onInteractionOverlayOpenChange?.(false),
    [activeTradeInstrument.coin, onInteractionOverlayOpenChange],
  );

  // Split view needs room for several charts, so only the large web, extension
  // and desktop layouts offer it.
  const NativeCandles = isDesktopLayout
    ? PerpNativeSplitCandles
    : PerpNativeCandles;
  const nativeChartProps: IPerpNativeCandlesProps = {
    source,
    storageNamespace: 'perps',
    enableTradingUi: enablePerpsTradingUi,
    useFullscreenOverlay: !isDesktopLayout,
    onInteractionChange: setIsChartInteracting,
    enableNativeChartSettings: true,
    enableDrawings: !platformEnv.isNative,
    prioritizePageScroll: platformEnv.isNativeIOS,
    nativeControlsLayoutMode: isDesktopLayout ? 'desktop' : 'mobile',
    nativeChartSettingsInToolbar: platformEnv.isNative,
    showNativeIndicatorQuickBar: platformEnv.isNative,
    nativeChartGrowsWithSubIndicators,
    onChartSwitch: showChartModeSelect ? handleChartSwitch : undefined,
    isNativeChartFullscreen: isDesktopLayout
      ? chartExpanded
      : isMobileChartFullscreen,
    onNativeChartFullscreenChange: handleFullscreenChange,
  };

  const content = (
    <Stack w="100%" h="100%" flex={1} minHeight={0}>
      {!isTradingViewNative &&
      showChartModeSelect &&
      !enableNativeChartControls ? (
        <XStack
          h={TRADING_VIEW_CHART_CONTROLS_HEIGHT}
          px="$2"
          flexShrink={0}
          alignItems="center"
          justifyContent="flex-end"
          borderBottomWidth="$px"
          borderBottomColor="$borderSubdued"
        >
          <TradingViewChartModeSelect
            chartMode="tradingView"
            onChartSwitch={handleChartSwitch}
          />
        </XStack>
      ) : null}
      {isTradingViewNative && activeTradeInstrument.coin ? (
        <NativeCandles
          // The single chart is keyed by its token; split view keeps its grid
          // mounted and keys the panels itself.
          key={
            isDesktopLayout ? undefined : getTradingViewNativeSourceKey(source)
          }
          {...nativeChartProps}
        />
      ) : null}
      {!isTradingViewNative && reloadHook > 0 && activeTradeInstrument.coin ? (
        <TradingViewPerpsV2
          webviewKey={reloadHook.toString()}
          userAddress={currentAccount?.accountAddress}
          enablePerpsTradingUi={enablePerpsTradingUi}
          enableNativeChartControls={enableNativeChartControls}
          isNativeChartFullscreen={chartExpanded}
          onNativeChartFullscreenChange={
            isDesktopLayout ? handleFullscreenChange : undefined
          }
          onChartSwitch={showChartModeSelect ? handleChartSwitch : undefined}
          reloadOnSymbolChange={platformEnv.isNativeAndroid}
          symbol={activeTradeInstrument.coin}
          displayPair={displayPair}
          displayCoin={displayCoin}
          collapseChartExpandSignal={collapseChartExpandSignal}
          w="100%"
          onTouchScroll={onTouchScroll}
          onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
        />
      ) : null}
    </Stack>
  );
  return (
    <DebugRenderTracker
      containerStyle={{
        width: '100%',
        height: '100%',
        flex: 1,
      }}
      name="PerpCandles"
      position="top-right"
    >
      {content}
    </DebugRenderTracker>
  );
}
