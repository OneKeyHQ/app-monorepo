import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { stripTrailingSentencePunctuation } from './getStockMarketClosedDescription';
import { EStockMarketStatusCase } from './resolveStockMarketStatusCase';

export type IStockMarketStatusAlertProps = {
  /** Resolved case from `resolveStockMarketStatusCase`. */
  statusCase: EStockMarketStatusCase;
  /**
   * Backend-provided localized countdown text (the first line of
   * `stock.description`), used as the body for the "known time" cases (1 & 2).
   * TODO: once the backend exposes a structured next-open time, format the
   * `trade_stock.market_reopens_in` / `market_reopens_in_perps` keys here
   * instead (and optionally tick a live countdown).
   */
  timeText?: string | null;
  /**
   * Navigate to the Perps (contract) screen for this underlying. Provide it for
   * the "with Perps" cases (1, 4 & 5); the Perps button only renders when set.
   */
  onTradePerps?: () => void;
  testID?: string;
};

/**
 * Standard market-status alert for a tokenized stock (open/closed/halted
 * cases). Presentational only — the caller resolves the case and wires
 * navigation, so this can be reused across modules. See
 * `resolveStockMarketStatusCase` for the case definitions.
 */
export function StockMarketStatusAlert({
  statusCase,
  timeText,
  onTradePerps,
  testID,
}: IStockMarketStatusAlertProps) {
  const intl = useIntl();

  if (statusCase === EStockMarketStatusCase.Open) {
    return null;
  }

  const trimmedTimeText = timeText?.trim();
  // "{countdown}, you can still trade Perps" — backend countdown + Perps suffix.
  const formatTimeWithPerps = (time: string) =>
    intl.formatMessage(
      { id: ETranslations.trade_stock_reopen_eta_perps },
      { time: stripTrailingSentencePunctuation(time) },
    );
  const getDescription = () => {
    switch (statusCase) {
      // 1. known time + Perps: countdown + "you can still trade Perps";
      // falls back to the no-time variant if the countdown is somehow missing.
      case EStockMarketStatusCase.ClosedKnownTimeWithPerps:
        return trimmedTimeText
          ? formatTimeWithPerps(trimmedTimeText)
          : intl.formatMessage({
              id: ETranslations.trade_stock_wait_reopens_in_perps,
            });
      // 2. known time, no Perps: show the countdown.
      case EStockMarketStatusCase.ClosedKnownTimeNoPerps:
        return (
          trimmedTimeText ||
          intl.formatMessage({ id: ETranslations.trade_stock_wait_for_reopen })
        );
      // 4. unknown time + Perps: ask to wait, offer Perps.
      case EStockMarketStatusCase.ClosedUnknownTimeWithPerps:
        return intl.formatMessage({
          id: ETranslations.trade_stock_wait_reopens_in_perps,
        });
      // 5. halted (OK-58655): backend halt sentence (+ Perps suffix) — the
      // "wait for market to reopen" copy would be wrong for a halt.
      case EStockMarketStatusCase.Halted:
        if (trimmedTimeText) {
          return onTradePerps
            ? formatTimeWithPerps(trimmedTimeText)
            : trimmedTimeText;
        }
        return intl.formatMessage({
          id: ETranslations.trading_hours_trading_halts_description,
        });
      // 3. unknown time, no Perps: ask to wait.
      case EStockMarketStatusCase.ClosedUnknownTimeNoPerps:
      default:
        return intl.formatMessage({
          id: ETranslations.trade_stock_wait_for_reopen,
        });
    }
  };

  return (
    <Alert
      testID={testID}
      type="warning"
      icon="InfoCircleOutline"
      title={intl.formatMessage({
        id:
          statusCase === EStockMarketStatusCase.Halted
            ? ETranslations.trading_hours_trading_halts
            : ETranslations.trade_stock_market_closed,
      })}
      description={getDescription()}
      action={
        onTradePerps
          ? {
              primary: intl.formatMessage({ id: ETranslations.global_perp }),
              onPrimaryPress: onTradePerps,
              primaryVariant: 'secondary' as const,
              primaryTestID: 'stock-market-status-perps-action',
            }
          : undefined
      }
      actionLayout="horizontal"
    />
  );
}
