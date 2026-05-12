import { useMemo } from 'react';

import { DebugRenderTracker, Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCandlesWebviewReloadHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  formatSpotPairDisplayName,
  getSpotTokenDisplayName,
} from '@onekeyhq/shared/src/utils/perpsUtils';

export function PerpCandles({
  onTouchScroll,
}: {
  onTouchScroll?: (deltaY: number) => void;
}) {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [{ reloadHook }] = usePerpsCandlesWebviewReloadHookAtom();
  const enablePerpsTradingUi = false;

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
          symbol={activeTradeInstrument.coin}
          displayPair={displayPair}
          displayCoin={displayCoin}
          w="100%"
          onTouchScroll={onTouchScroll}
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
