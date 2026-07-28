import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteEventErrorAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  StockMarketStatusAlert,
  getStockMarketClosedDescription,
  resolveStockMarketStatusCase,
} from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { useRefreshQuoteWhenStockMarketReopens } from '../../hooks/useRefreshQuoteWhenStockMarketReopens';
import { useSwapStockTokenDetail } from '../../hooks/useSwapStockTokenDetail';

import { isCurrentStockMarketClosedQuoteEventError } from './SwapStockTradeAlertUtils';

export function SwapQuoteStockMarketStatusAlert({
  onMarketReopen,
}: {
  onMarketReopen: () => void;
}) {
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const { navigateToPerps } = usePerpsNavigation(EPerpPageEnterSource.Trade);

  const isSwapOrBridge =
    swapTypeSwitch === ESwapTabSwitchType.SWAP ||
    swapTypeSwitch === ESwapTabSwitchType.BRIDGE;
  const isCurrentMarketClosedError =
    isSwapOrBridge &&
    isCurrentStockMarketClosedQuoteEventError({
      fromToken,
      fromTokenAmount: fromTokenAmount.value,
      quoteEventError,
      toToken,
    });

  // A current selector result normally identifies the stock side. If that
  // metadata is missing (cold cache/deep link) or both sides are stocks, probe
  // both only after the quote service has authoritatively reported closure.
  const hasSingleStockSide =
    Boolean(fromToken?.isStock) !== Boolean(toToken?.isStock);
  const shouldFetchFromToken =
    isCurrentMarketClosedError &&
    (Boolean(fromToken?.isStock) || !hasSingleStockSide);
  const shouldFetchToToken =
    isCurrentMarketClosedError &&
    (Boolean(toToken?.isStock) || !hasSingleStockSide);
  const fromTokenDetail = useSwapStockTokenDetail({
    enabled: shouldFetchFromToken,
    token: fromToken,
  });
  const toTokenDetail = useSwapStockTokenDetail({
    enabled: shouldFetchToToken,
    token: toToken,
  });
  const detailCandidates = [fromTokenDetail, toTokenDetail];
  const isResolvingAmbiguousStockSide =
    !hasSingleStockSide && (fromTokenDetail.pending || toTokenDetail.pending);
  const stockDetail = isResolvingAmbiguousStockSide
    ? undefined
    : (detailCandidates.find(
        (candidate) => candidate.tokenDetail?.stock?.isOpen === false,
      ) ?? detailCandidates.find((candidate) => candidate.tokenDetail?.stock));
  const marketScopeKey = [
    getTokenIdentityKey(fromToken),
    getTokenIdentityKey(toToken),
  ].join('>');

  useRefreshQuoteWhenStockMarketReopens({
    enabled: isCurrentMarketClosedError,
    marketIsOpen: stockDetail?.tokenDetail?.stock?.isOpen,
    onRefresh: onMarketReopen,
    refreshOnInitialOpen: true,
    scopeKey: marketScopeKey,
  });

  const isMarketConfirmedClosed =
    stockDetail?.tokenDetail?.stock?.isOpen === false;
  if (!isCurrentMarketClosedError || !isMarketConfirmedClosed) {
    return null;
  }

  const closedTimeText = getStockMarketClosedDescription(
    stockDetail?.tokenDetail?.stock?.description,
  );
  const hlTicker = stockDetail?.perpsInfo?.hlTicker;

  return (
    <StockMarketStatusAlert
      statusCase={resolveStockMarketStatusCase({
        isOpen: false,
        hasOpenTime: Boolean(closedTimeText),
        hasPerps: Boolean(hlTicker),
      })}
      timeText={closedTimeText}
      onTradePerps={hlTicker ? () => navigateToPerps(hlTicker) : undefined}
    />
  );
}
