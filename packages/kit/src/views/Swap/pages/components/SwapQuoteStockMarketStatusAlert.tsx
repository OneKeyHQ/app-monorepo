import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteEventCompletedAtom,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { useRefreshQuoteWhenStockMarketReopens } from '../../hooks/useRefreshQuoteWhenStockMarketReopens';
import { useSwapStockTokenDetail } from '../../hooks/useSwapStockTokenDetail';

import {
  isCurrentStockMarketClosedQuoteEventError,
  isCurrentStockQuoteEventError,
} from './SwapStockTradeAlertUtils';

export function SwapQuoteStockMarketStatusAlert({
  onMarketReopen,
}: {
  onMarketReopen: () => void;
}) {
  const intl = useIntl();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
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
  const isCurrentQuoteEventError = isCurrentStockQuoteEventError({
    fromToken,
    fromTokenAmount: fromTokenAmount.value,
    quoteEventError,
    toToken,
  });
  const marketScopeKey = [
    swapTypeSwitch,
    getTokenIdentityKey(fromToken),
    getTokenIdentityKey(toToken),
    fromTokenAmount.value,
  ].join('>');
  const [monitoredMarketScopeKey, setMonitoredMarketScopeKey] = useState(() =>
    isCurrentMarketClosedError ? marketScopeKey : '',
  );

  useEffect(() => {
    if (!isSwapOrBridge || !fromToken || !toToken || !fromTokenAmount.value) {
      setMonitoredMarketScopeKey('');
      return;
    }
    if (monitoredMarketScopeKey && monitoredMarketScopeKey !== marketScopeKey) {
      setMonitoredMarketScopeKey('');
      return;
    }
    if (isCurrentMarketClosedError) {
      setMonitoredMarketScopeKey(marketScopeKey);
      return;
    }
    if (
      monitoredMarketScopeKey === marketScopeKey &&
      (isCurrentQuoteEventError || quoteEventCompleted)
    ) {
      setMonitoredMarketScopeKey('');
    }
  }, [
    fromToken,
    fromTokenAmount.value,
    isCurrentMarketClosedError,
    isCurrentQuoteEventError,
    isSwapOrBridge,
    marketScopeKey,
    monitoredMarketScopeKey,
    quoteEventCompleted,
    toToken,
  ]);

  const shouldMonitorMarketStatus =
    isCurrentMarketClosedError ||
    (isSwapOrBridge && monitoredMarketScopeKey === marketScopeKey);

  // A current selector result normally identifies the stock side. If that
  // metadata is missing (cold cache/deep link) or both sides are stocks, probe
  // both only after the quote service has authoritatively reported closure.
  const hasSingleStockSide =
    Boolean(fromToken?.isStock) !== Boolean(toToken?.isStock);
  const shouldFetchFromToken =
    shouldMonitorMarketStatus &&
    (Boolean(fromToken?.isStock) || !hasSingleStockSide);
  const shouldFetchToToken =
    shouldMonitorMarketStatus &&
    (Boolean(toToken?.isStock) || !hasSingleStockSide);
  const fromTokenDetail = useSwapStockTokenDetail({
    enabled: shouldFetchFromToken,
    requireCurrentActivation: true,
    token: fromToken,
  });
  const toTokenDetail = useSwapStockTokenDetail({
    enabled: shouldFetchToToken,
    requireCurrentActivation: true,
    token: toToken,
  });
  const detailCandidates = [
    ...(shouldFetchFromToken ? [fromTokenDetail] : []),
    ...(shouldFetchToToken ? [toTokenDetail] : []),
  ];
  const isResolvingStockDetail = detailCandidates.some(
    (candidate) => candidate.pending,
  );
  const didEveryDetailFetchSucceed =
    detailCandidates.length > 0 &&
    detailCandidates.every(
      (candidate) => candidate.latestFetchSucceeded === true,
    );
  const resolvedStockDetail = isResolvingStockDetail
    ? undefined
    : (detailCandidates.find(
        (candidate) => candidate.tokenDetail?.stock?.isPaused === true,
      ) ??
      detailCandidates.find(
        (candidate) => candidate.tokenDetail?.stock?.isOpen === false,
      ) ??
      detailCandidates.find((candidate) => candidate.tokenDetail?.stock));
  const currentStockDetail =
    didEveryDetailFetchSucceed &&
    resolvedStockDetail?.latestFetchSucceeded === true
      ? resolvedStockDetail
      : undefined;
  const restrictiveStockDetail =
    resolvedStockDetail?.tokenDetail?.stock?.isPaused === true ||
    resolvedStockDetail?.tokenDetail?.stock?.isOpen === false
      ? resolvedStockDetail
      : undefined;
  const displayStockDetail = restrictiveStockDetail ?? currentStockDetail;
  const currentStock = currentStockDetail?.tokenDetail?.stock;
  const displayStock = displayStockDetail?.tokenDetail?.stock;
  const isMarketAvailable =
    Boolean(currentStock) &&
    currentStock?.isOpen !== false &&
    currentStock?.isPaused !== true;

  useRefreshQuoteWhenStockMarketReopens({
    enabled: shouldMonitorMarketStatus,
    marketDetailFetchedAt: currentStockDetail?.fetchedAt,
    marketIsOpen: currentStock?.isOpen,
    marketIsPaused: currentStock?.isPaused,
    onRefresh: onMarketReopen,
    refreshOnInitialOpen: true,
    refreshOnMarketStatusUpdate: isCurrentMarketClosedError,
    scopeKey: marketScopeKey,
  });

  if (
    !isCurrentMarketClosedError ||
    isResolvingStockDetail ||
    isMarketAvailable
  ) {
    return null;
  }

  if (displayStock?.isPaused === true) {
    return (
      <Alert
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.market_status_halted,
        })}
        description={intl.formatMessage({
          id: ETranslations.trading_hours_trading_halts_description,
        })}
      />
    );
  }

  const closedTimeText = getStockMarketClosedDescription(
    displayStock?.description,
  );
  const hlTicker = displayStockDetail?.perpsInfo?.hlTicker;

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
