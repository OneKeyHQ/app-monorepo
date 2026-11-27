import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { ILiveActivityStrings } from '@onekeyhq/shared/types/liveActivity';

export function getLiveActivityLocalizedStrings({
  fromNetworkName,
  toNetworkName,
  updatedAtMs,
}: {
  fromNetworkName: string;
  toNetworkName: string;
  updatedAtMs?: number;
}): ILiveActivityStrings {
  const { intl } = appLocale;
  const lastUpdatedLabel = intl.formatMessage({
    id: ETranslations.market_last_updated,
  });
  const displayName = (value: string) =>
    Array.from(value).slice(0, 64).join('');
  return {
    done: intl.formatMessage({ id: ETranslations.global_done }),
    failed: intl.formatMessage({ id: ETranslations.global_failed }),
    refunded: intl.formatMessage({
      id: ETranslations.swap_history_detail_badge_refunded,
    }),
    canceled: intl.formatMessage({
      id: ETranslations.swap_history_status_canceled,
    }),
    refunding: intl.formatMessage({
      id: ETranslations.swap_history_detail_badge_refunding,
    }),
    almostDone: intl.formatMessage({
      id: ETranslations.live_swap_almost_complete,
    }),
    confirmingFrom: intl.formatMessage(
      { id: ETranslations.live_swap_bitcoin_confirmation_status },
      { networkName: displayName(fromNetworkName) },
    ),
    confirmingTo: intl.formatMessage(
      { id: ETranslations.live_swap_bitcoin_confirmation_status },
      { networkName: displayName(toNetworkName) },
    ),
    pending: intl.formatMessage({
      id: ETranslations.swap_history_status_pending,
    }),
    swapFailed: intl.formatMessage({
      id: ETranslations.swap_page_toast_swap_failed,
    }),
    etaTemplate: intl.formatMessage(
      { id: ETranslations.receive_arrival_time_min },
      { number: '{number}' },
    ),
    lastUpdatedLabel,
    locale: intl.locale,
    refundFailed: intl.formatMessage({
      id: ETranslations.swap_history_detail_badge_refund_failed,
    }),
    expired: intl.formatMessage({
      id: ETranslations.swap_history_detail_badge_expired,
    }),
    partiallyFilled: intl.formatMessage({
      id: ETranslations.Limit_order_history_status_partially_filled,
    }),
    lastUpdated:
      updatedAtMs === undefined
        ? ''
        : `${lastUpdatedLabel}: ${intl.formatDate(updatedAtMs, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
  };
}
