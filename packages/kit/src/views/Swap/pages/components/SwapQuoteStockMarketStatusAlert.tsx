import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteEventErrorAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  StockMarketStatusAlert,
  resolveStockMarketStatusCase,
} from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { isCurrentStockMarketClosedQuoteEventError } from './SwapStockTradeAlertUtils';

export function SwapQuoteStockMarketStatusAlert() {
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [quoteEventError] = useSwapQuoteEventErrorAtom();

  const isSwapOrBridge =
    swapTypeSwitch === ESwapTabSwitchType.SWAP ||
    swapTypeSwitch === ESwapTabSwitchType.BRIDGE;
  if (
    !isSwapOrBridge ||
    !isCurrentStockMarketClosedQuoteEventError({
      fromToken,
      fromTokenAmount: fromTokenAmount.value,
      quoteEventError,
      toToken,
    })
  ) {
    return null;
  }

  return (
    <StockMarketStatusAlert
      statusCase={resolveStockMarketStatusCase({
        isOpen: false,
        hasOpenTime: false,
        hasPerps: false,
      })}
    />
  );
}
