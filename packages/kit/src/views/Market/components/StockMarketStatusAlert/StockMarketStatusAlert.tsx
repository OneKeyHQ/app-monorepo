import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
   * the "with Perps" cases (1 & 4); the Perps button only renders when set.
   */
  onTradePerps?: () => void;
  testID?: string;
};

/**
 * Standard market-status alert for a tokenized stock (open/closed cases).
 * Presentational only — the caller resolves the case and wires navigation, so
 * this can be reused across modules. See `resolveStockMarketStatusCase` for the
 * case definitions (case 5 Halted is reserved for when the backend supports it).
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

  const waitText = intl.formatMessage({
    id: ETranslations.trade_stock_wait_for_reopen,
  });
  // "Wait for market to reopen, you can still trade Perps" (unknown time + Perps).
  const waitWithPerpsText = intl.formatMessage({
    id: ETranslations.trade_stock_wait_reopens_in_perps,
  });
  // "{countdown}, you can still trade Perps" — backend countdown + Perps suffix.
  // Falls back to the no-time variant if the countdown is somehow missing.
  const timeWithPerpsText = timeText?.trim()
    ? intl.formatMessage(
        { id: ETranslations.trade_stock_reopen_eta_perps },
        { time: timeText.trim() },
      )
    : waitWithPerpsText;
  // Perps button (cases 1 & 4); only when the caller provided a handler.
  const perpsAction = onTradePerps
    ? {
        primary: intl.formatMessage({ id: ETranslations.global_perp }),
        onPrimaryPress: onTradePerps,
        primaryVariant: 'secondary' as const,
        primaryTestID: 'stock-market-status-perps-action',
      }
    : undefined;

  let description = waitText;
  let action: typeof perpsAction;
  switch (statusCase) {
    // 1. known time + Perps: countdown + "you can still trade Perps", offer Perps.
    case EStockMarketStatusCase.ClosedKnownTimeWithPerps:
      description = timeWithPerpsText;
      action = perpsAction;
      break;
    // 2. known time, no Perps: show the countdown.
    case EStockMarketStatusCase.ClosedKnownTimeNoPerps:
      description = timeText?.trim() || waitText;
      break;
    // 4. unknown time + Perps: ask to wait, offer Perps.
    case EStockMarketStatusCase.ClosedUnknownTimeWithPerps:
      description = waitWithPerpsText;
      action = perpsAction;
      break;
    // 3. unknown time, no Perps: ask to wait.
    case EStockMarketStatusCase.ClosedUnknownTimeNoPerps:
    default:
      description = waitText;
      break;
  }

  return (
    <Alert
      testID={testID}
      type="warning"
      icon="InfoCircleOutline"
      title={intl.formatMessage({
        id: ETranslations.trade_stock_market_closed,
      })}
      description={description}
      action={action}
      actionLayout="horizontal"
    />
  );
}
