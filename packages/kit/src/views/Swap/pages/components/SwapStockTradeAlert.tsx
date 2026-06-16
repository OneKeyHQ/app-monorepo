import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
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
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
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
    const fromAmountBN = new BigNumber(fromTokenAmount.value ?? 0);
    const fromTokenSymbol =
      quoteResult?.fromTokenInfo?.symbol ?? stockChannel.fromToken?.symbol;

    if (
      quoteResult?.limit &&
      !fromAmountBN.isNaN() &&
      fromAmountBN.gt(0) &&
      fromTokenSymbol
    ) {
      if (quoteResult.limit.min) {
        const minBN = new BigNumber(quoteResult.limit.min);
        if (!minBN.isNaN() && fromAmountBN.lt(minBN)) {
          return {
            message: intl.formatMessage(
              { id: ETranslations.provider_min_amount_required },
              {
                amount: numberFormat(quoteResult.limit.min, {
                  formatter: 'balance',
                }),
                token: fromTokenSymbol,
              },
            ),
            alertLevel: ESwapAlertLevel.WARNING,
          };
        }
      }

      if (quoteResult.limit.max) {
        const maxBN = new BigNumber(quoteResult.limit.max);
        if (!maxBN.isNaN() && fromAmountBN.gt(maxBN)) {
          return {
            message: intl.formatMessage(
              { id: ETranslations.provider_max_amount_required },
              {
                amount: numberFormat(quoteResult.limit.max, {
                  formatter: 'balance',
                }),
                token: fromTokenSymbol,
              },
            ),
            alertLevel: ESwapAlertLevel.WARNING,
          };
        }
      }
    }

    if (quoteResult?.errorMessage) {
      return {
        message: quoteResult.errorMessage,
        alertLevel: getStockErrorAlertLevel({
          message: quoteResult.errorMessage,
          notAvailableInRegionMessage,
        }),
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
    navigateToPerps(perpsTicker);
  }, [canOpenPerps, navigateToPerps, perpsTicker]);

  const shouldShowSwapAlerts =
    alerts.states.length > 0 &&
    !quoteLoading &&
    !quoteEventFetching &&
    alerts.quoteId === (quoteResult?.quoteId ?? '');
  const stockPrimaryAlert = stockQuoteAlert ?? stockEventAlert;

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
