import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

export type ILiveActivityLocalizedStrings = {
  done: string;
  failed: string;
  refunded: string;
  canceled: string;
  refunding: string;
  almostDone: string;
  confirmingFrom: string;
  confirmingTo: string;
  pending: string;
  swapFailed: string;
  etaTemplate: string;
  lastUpdated: string;
};

export function getLiveActivityLocalizedStrings({
  fromNetworkName,
  toNetworkName,
  updatedAtMs,
}: {
  fromNetworkName: string;
  toNetworkName: string;
  updatedAtMs: number;
}): ILiveActivityLocalizedStrings {
  const { intl } = appLocale;
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
    lastUpdated: `${intl.formatMessage({ id: ETranslations.market_last_updated })}: ${intl.formatDate(
      updatedAtMs,
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      },
    )}`,
  };
}
