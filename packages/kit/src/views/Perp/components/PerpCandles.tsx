import { useCallback, useEffect, useMemo, useState } from 'react';

import { BackHandler } from 'react-native';

import {
  DebugRenderTracker,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import {
  TRADING_VIEW_CHART_CONTROLS_HEIGHT,
  TradingViewChartModeSelect,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  TradingViewNative,
  getTradingViewNativeSourceKey,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type {
  ITradingViewNativeProps,
  ITradingViewNativeSource,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCandlesWebviewReloadHookAtom,
  usePerpsLayoutStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatSpotPairDisplayName,
  getSpotTokenDisplayName,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsChartOrderMenu } from '../hooks/usePerpsChartOrderMenu';
import { usePerpsNativeChartLines } from '../hooks/usePerpsNativeChartLines';
import { usePerpsNativeChartMarks } from '../hooks/usePerpsNativeChartMarks';
import { usePerpsNativeChartMetadata } from '../hooks/usePerpsNativeChartMetadata';

function PerpNativeCandles({
  enableTradingUi,
  ...props
}: ITradingViewNativeProps & { enableTradingUi: boolean }) {
  const { chartComponents: lines, onReferenceLineAction } =
    usePerpsNativeChartLines(enableTradingUi);
  const marks = usePerpsNativeChartMarks();
  const metadata = usePerpsNativeChartMetadata();
  const orderMenu = usePerpsChartOrderMenu(enableTradingUi);
  const chartComponents = useMemo(() => [...lines, ...marks], [lines, marks]);
  return (
    <TradingViewNative
      {...props}
      {...metadata}
      {...orderMenu}
      chartComponents={chartComponents}
      onReferenceLineAction={
        enableTradingUi ? onReferenceLineAction : undefined
      }
    />
  );
}

export function PerpCandles({
  collapseChartExpandSignal,
  onTouchScroll,
  onInteractionOverlayOpenChange,
}: {
  collapseChartExpandSignal?: number;
  onTouchScroll?: (deltaY: number) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
}) {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const accountAddress = currentAccount?.accountAddress?.toLowerCase();
  const [chartAccount, setChartAccount] = useState({
    address: accountAddress,
    revision: 0,
  });
  if (chartAccount.address !== accountAddress) {
    // An anonymous chart has no account marks to discard on first resolution.
    setChartAccount({
      address: accountAddress,
      revision: chartAccount.revision + (chartAccount.address ? 1 : 0),
    });
  }
  const [{ reloadHook }] = usePerpsCandlesWebviewReloadHookAtom();
  const [{ chartExpanded = false }, setLayoutState] = usePerpsLayoutStateAtom();
  const [isTradingViewNative, setIsTradingViewNative] = useState(true);
  const [isMobileChartFullscreen, setIsMobileChartFullscreen] = useState(false);
  const [isChartInteracting, setIsChartInteracting] = useState(false);
  const [isChartResizing, setIsChartResizing] = useState(false);
  const { gtMd } = useMedia();
  const isDesktopLayout = gtMd && !platformEnv.isNative;
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
      isMobileChartFullscreen || isChartInteracting || isChartResizing,
    );
    return () => onInteractionOverlayOpenChange?.(false);
  }, [
    isTradingViewNative,
    isMobileChartFullscreen,
    isChartInteracting,
    isChartResizing,
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
    setIsChartResizing(false);
    setIsMobileChartFullscreen(false);
  }, [activeTradeInstrument.coin]);
  const handleChartSwitch = useCallback(() => {
    // The legacy chart owns its expand state internally and remounts collapsed.
    handleFullscreenChange(false);
    onInteractionOverlayOpenChange?.(false);
    setIsChartInteracting(false);
    setIsChartResizing(false);
    setIsTradingViewNative((current) => !current);
  }, [handleFullscreenChange, onInteractionOverlayOpenChange]);

  useEffect(() => {
    if (collapseChartExpandSignal) {
      handleFullscreenChange(false);
    }
  }, [collapseChartExpandSignal, handleFullscreenChange]);

  useEffect(
    () => () => onInteractionOverlayOpenChange?.(false),
    [activeTradeInstrument.coin, onInteractionOverlayOpenChange],
  );

  const content = (
    <Stack w="100%" h="100%" flex={1} minHeight={0}>
      {!isTradingViewNative ? (
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
        <PerpNativeCandles
          key={getTradingViewNativeSourceKey(source)}
          source={source}
          storageNamespace="perps"
          enableTradingUi={enablePerpsTradingUi}
          useFullscreenOverlay={!isDesktopLayout}
          onInteractionChange={setIsChartInteracting}
          enableNativeChartSettings
          enableMultiChart
          enableDrawings
          nativeControlsLayoutMode={isDesktopLayout ? 'desktop' : 'mobile'}
          nativeChartSettingsInToolbar={platformEnv.isNative}
          showNativeIndicatorQuickBar={platformEnv.isNative}
          onChartSwitch={handleChartSwitch}
          isNativeChartFullscreen={
            isDesktopLayout ? chartExpanded : isMobileChartFullscreen
          }
          onNativeChartFullscreenChange={handleFullscreenChange}
          onNativeMultiChartResizingChange={setIsChartResizing}
        />
      ) : null}
      {!isTradingViewNative && reloadHook > 0 && activeTradeInstrument.coin ? (
        <TradingViewPerpsV2
          // The embedded chart caches marks by symbol, so accounts must not
          // share its instance even after the current symbol's marks are cleared.
          key={chartAccount.revision}
          webviewKey={reloadHook.toString()}
          userAddress={currentAccount?.accountAddress}
          enablePerpsTradingUi={enablePerpsTradingUi}
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
