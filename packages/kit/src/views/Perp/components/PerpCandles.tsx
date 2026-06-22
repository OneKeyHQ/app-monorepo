import { useMemo, useState } from 'react';

import { DebugRenderTracker, Stack, useMedia } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCandlesWebviewReloadHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatSpotPairDisplayName,
  getSpotTokenDisplayName,
} from '@onekeyhq/shared/src/utils/perpsUtils';

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
  const [{ reloadHook }] = usePerpsCandlesWebviewReloadHookAtom();
  const { gtMd } = useMedia();
  // Large desktop/web/ext only. Frozen at mount: Perp.tsx mounts the desktop vs
  // mobile layout by this same gtMd condition, so crossing the breakpoint
  // remounts this tree rather than toggling here. Freezing keeps the value out
  // of the WebView URL memo so a window resize never churns the chart src.
  const [enablePerpsTradingUi] = useState(() => gtMd && !platformEnv.isNative);

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

  const content = (
    <Stack w="100%" h="100%" flex={1}>
      {reloadHook > 0 && activeTradeInstrument.coin ? (
        <TradingViewPerpsV2
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
