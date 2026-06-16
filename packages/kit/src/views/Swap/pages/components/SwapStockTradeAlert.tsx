import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Alert, YStack } from '@onekeyhq/components';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteEventErrorAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuoteResult,
  ISwapAlertState,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapAlertLevel } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelStage,
  type IUseSwapStockChannelReturn,
} from '../../hooks/useSwapStockChannel';
import { SwapTestIDs } from '../../testIDs';
import { getStockTradeAlertAnalyticsPayload } from '../../utils/swapStockAnalytics';
import { getStockQuoteTradeControl } from '../../utils/swapStockTradeControl';

import SwapAlertContainer from './SwapAlertContainer';

type IStockTradeAlerts = {
  states: ISwapAlertState[];
  quoteId: string;
};

type ISwapStockTradeAlertProps = {
  alerts: IStockTradeAlerts;
  quoteEventFetching: boolean;
  quoteLoading: boolean;
  quoteResult?: IFetchQuoteResult;
  stockChannel: IUseSwapStockChannelReturn;
};

function isSameAlertMessage(a?: string, b?: string) {
  return Boolean(a && b && a.trim() === b.trim());
}

function getStockErrorAlertLevel({
  message,
  notAvailableInRegionMessage,
}: {
  message: string;
  notAvailableInRegionMessage: string;
}) {
  const isRegionError =
    isSameAlertMessage(message, notAvailableInRegionMessage) ||
    message.toLowerCase().includes('region');
  return isRegionError ? ESwapAlertLevel.ERROR : ESwapAlertLevel.WARNING;
}

function useStockQuoteAlert({
  quoteResult,
  stockChannel,
}: {
  quoteResult?: IFetchQuoteResult;
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const intl = useIntl();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const notAvailableInRegionMessage = intl.formatMessage({
    id: ETranslations.trade_stock_not_available_in_region,
  });

  return useMemo<ISwapAlertState | undefined>(() => {
    const tradeControl = getStockQuoteTradeControl({
      quoteResult,
      fromTokenAmount: fromTokenAmount.value,
      fromTokenSymbol: stockChannel.fromToken?.symbol,
      intl,
    });
    if (tradeControl) {
      return {
        message: tradeControl.message,
        alertLevel:
          tradeControl.reason === 'error'
            ? getStockErrorAlertLevel({
                message: tradeControl.message,
                notAvailableInRegionMessage,
              })
            : ESwapAlertLevel.WARNING,
      };
    }

    return undefined;
  }, [
    fromTokenAmount.value,
    intl,
    notAvailableInRegionMessage,
    quoteResult,
    stockChannel.fromToken?.symbol,
  ]);
}

function BasicSwapStockTradeAlert({
  alerts,
  quoteEventFetching,
  quoteLoading,
  quoteResult,
  stockChannel,
}: ISwapStockTradeAlertProps) {
  const intl = useIntl();
  const { perpsInfo } = useTokenDetail();
  const { perpDisabled } = usePerpTabConfig();
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.MarketList,
  );
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const stockAlertShownKeysRef = useRef(new Set<string>());
  const stockQuoteAlert = useStockQuoteAlert({ quoteResult, stockChannel });
  const notAvailableInRegionMessage = intl.formatMessage({
    id: ETranslations.trade_stock_not_available_in_region,
  });
  const perpsTicker = perpsInfo?.hlTicker;
  const canOpenPerps = Boolean(perpsTicker && !perpDisabled);

  const isCurrentStockQuoteEventError = useMemo(
    () =>
      Boolean(
        quoteEventError &&
        stockChannel.fromToken &&
        stockChannel.toToken &&
        equalTokenNoCaseSensitive({
          token1: quoteEventError.fromToken,
          token2: stockChannel.fromToken,
        }) &&
        equalTokenNoCaseSensitive({
          token1: quoteEventError.toToken,
          token2: stockChannel.toToken,
        }),
      ),
    [quoteEventError, stockChannel.fromToken, stockChannel.toToken],
  );

  const isStockMarketClosed =
    stockChannel.channelStage === ESwapStockChannelStage.MarketClosed ||
    Boolean(
      quoteEventError?.isStock &&
      quoteEventError.isMarketOpen === false &&
      isCurrentStockQuoteEventError,
    );

  const stockEventAlert = useMemo<ISwapAlertState | undefined>(() => {
    if (
      !quoteEventError?.isStock ||
      !isCurrentStockQuoteEventError ||
      !quoteEventError.message ||
      isStockMarketClosed
    ) {
      return undefined;
    }
    return {
      message: quoteEventError.message,
      alertLevel: getStockErrorAlertLevel({
        message: quoteEventError.message,
        notAvailableInRegionMessage,
      }),
    };
  }, [
    isCurrentStockQuoteEventError,
    isStockMarketClosed,
    notAvailableInRegionMessage,
    quoteEventError?.isStock,
    quoteEventError?.message,
  ]);

  const onOpenPerps = useCallback(() => {
    if (!canOpenPerps || !perpsTicker) {
      return;
    }
    defaultLogger.swap.stockTradeAlert.stockTradeAlertActionClick({
      ...getStockTradeAlertAnalyticsPayload({
        alertType: 'marketClosed',
        alertLevel: ESwapAlertLevel.WARNING,
        tradeDisabled: true,
        tradeSide: stockChannel.tradeSide,
        stockToken: stockChannel.currentStockToken,
      }),
      action: 'perps',
    });
    navigateToPerps(perpsTicker);
  }, [
    canOpenPerps,
    navigateToPerps,
    perpsTicker,
    stockChannel.currentStockToken,
    stockChannel.tradeSide,
  ]);

  const shouldShowSwapAlerts =
    alerts.states.length > 0 &&
    !quoteLoading &&
    !quoteEventFetching &&
    alerts.quoteId === (quoteResult?.quoteId ?? '');
  const stockPrimaryAlert = stockQuoteAlert ?? stockEventAlert;
  const stockTradeDisabled =
    isStockMarketClosed ||
    stockChannel.channelStage === ESwapStockChannelStage.MarketUnavailable ||
    stockChannel.channelStage === ESwapStockChannelStage.MissingPayToken ||
    Boolean(stockQuoteAlert || stockEventAlert);

  const swapAlerts = useMemo(() => {
    if (!shouldShowSwapAlerts) {
      return [];
    }
    return alerts.states.filter(
      (item) => !isSameAlertMessage(item.message, stockPrimaryAlert?.message),
    );
  }, [alerts.states, shouldShowSwapAlerts, stockPrimaryAlert?.message]);

  const mergedQuoteAlerts = useMemo(() => {
    if (stockPrimaryAlert) {
      return [stockPrimaryAlert, ...swapAlerts];
    }
    return swapAlerts;
  }, [stockPrimaryAlert, swapAlerts]);

  const stockAlertForLog = useMemo(() => {
    if (isStockMarketClosed) {
      return {
        alertType: 'marketClosed',
        alertLevel: ESwapAlertLevel.WARNING,
      };
    }
    if (
      stockChannel.channelStage === ESwapStockChannelStage.MarketUnavailable
    ) {
      return {
        alertType: 'marketUnavailable',
        alertLevel: ESwapAlertLevel.WARNING,
      };
    }
    if (stockChannel.channelStage === ESwapStockChannelStage.MissingPayToken) {
      return {
        alertType: 'missingPayToken',
        alertLevel: ESwapAlertLevel.WARNING,
      };
    }
    if (stockPrimaryAlert) {
      return {
        alertType:
          stockPrimaryAlert === stockQuoteAlert ? 'quoteAlert' : 'stockEvent',
        alertLevel: stockPrimaryAlert.alertLevel,
        message: stockPrimaryAlert.message,
      };
    }
    return undefined;
  }, [
    isStockMarketClosed,
    stockChannel.channelStage,
    stockPrimaryAlert,
    stockQuoteAlert,
  ]);

  useEffect(() => {
    if (!stockAlertForLog) {
      return;
    }
    const alertKey = [
      stockAlertForLog.alertType,
      stockAlertForLog.alertLevel,
      stockAlertForLog.message,
      stockChannel.tradeSide,
      stockChannel.currentStockToken?.networkId,
      stockChannel.currentStockToken?.contractAddress,
      stockChannel.currentStockToken?.symbol,
    ].join('|');
    if (stockAlertShownKeysRef.current.has(alertKey)) {
      return;
    }
    stockAlertShownKeysRef.current.add(alertKey);
    defaultLogger.swap.stockTradeAlert.stockTradeAlertShown(
      getStockTradeAlertAnalyticsPayload({
        alertType: stockAlertForLog.alertType,
        alertLevel: stockAlertForLog.alertLevel,
        tradeDisabled: stockTradeDisabled,
        tradeSide: stockChannel.tradeSide,
        stockToken: stockChannel.currentStockToken,
      }),
    );
  }, [
    stockAlertForLog,
    stockChannel.currentStockToken,
    stockChannel.tradeSide,
    stockTradeDisabled,
  ]);

  if (isStockMarketClosed) {
    const description = canOpenPerps
      ? intl.formatMessage({ id: ETranslations.trade_stock_trade_in_perps })
      : (stockChannel.stockMarketStatus?.reason ??
        intl.formatMessage({ id: ETranslations.trade_stock_wait_for_reopen }));

    return (
      <Alert
        testID={SwapTestIDs.stockTradeStatusAlert}
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.trade_stock_market_closed,
        })}
        description={description}
        action={
          canOpenPerps
            ? {
                primary: intl.formatMessage({
                  id: ETranslations.global_perp,
                }),
                primaryVariant: 'secondary',
                onPrimaryPress: onOpenPerps,
              }
            : undefined
        }
      />
    );
  }

  if (stockChannel.channelStage === ESwapStockChannelStage.MarketUnavailable) {
    return (
      <Alert
        testID={SwapTestIDs.stockTradeStatusAlert}
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        })}
        description={stockChannel.stockMarketStatus?.reason ?? undefined}
      />
    );
  }

  if (stockChannel.channelStage === ESwapStockChannelStage.MissingPayToken) {
    return (
      <Alert
        testID={SwapTestIDs.stockTradeStatusAlert}
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        })}
      />
    );
  }

  if (!mergedQuoteAlerts.length) {
    return null;
  }

  return (
    <YStack testID={SwapTestIDs.stockTradeStatusAlert}>
      <SwapAlertContainer alerts={mergedQuoteAlerts} />
    </YStack>
  );
}

export const SwapStockTradeAlert = memo(BasicSwapStockTradeAlert);
