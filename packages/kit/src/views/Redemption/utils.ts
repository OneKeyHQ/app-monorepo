import type { IBadgeType } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBtcRewardStatus } from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import type { useIntl } from 'react-intl';

export interface IBtcRewardStatusConfig {
  label: string;
  badgeType: IBadgeType;
  description: string;
}

export function getBtcRewardStatusConfig(
  intl: ReturnType<typeof useIntl>,
): Record<EBtcRewardStatus, IBtcRewardStatusConfig> {
  return {
    [EBtcRewardStatus.Wait]: {
      label: intl.formatMessage({
        id: ETranslations.redemption_btc_status_waiting_label,
      }),
      badgeType: 'warning',
      description: intl.formatMessage({
        id: ETranslations.redemption_btc_status_waiting_desc,
      }),
    },
    [EBtcRewardStatus.PendingPayout]: {
      label: intl.formatMessage({ id: ETranslations.referral_pending }),
      badgeType: 'info',
      description: intl.formatMessage({
        id: ETranslations.redemption_btc_status_pending_desc,
      }),
    },
    [EBtcRewardStatus.PayoutInProgress]: {
      label: intl.formatMessage({
        id: ETranslations.redemption_btc_status_distributing_label,
      }),
      badgeType: 'info',
      description: intl.formatMessage({
        id: ETranslations.redemption_btc_status_distributing_desc,
      }),
    },
    [EBtcRewardStatus.Paid]: {
      label: intl.formatMessage({ id: ETranslations.referral_distributed }),
      badgeType: 'success',
      description: intl.formatMessage({
        id: ETranslations.redemption_btc_status_distributed_desc,
      }),
    },
    [EBtcRewardStatus.Rejected]: {
      label: intl.formatMessage({
        id: ETranslations.redemption_btc_status_rejected_label,
      }),
      badgeType: 'critical',
      description: intl.formatMessage({
        id: ETranslations.redemption_btc_status_rejected_desc,
      }),
    },
  };
}

export function formatUsd(value: number | string): string {
  return numberFormat(String(value), {
    formatter: 'price',
    formatterOptions: { currency: '$' },
  });
}

export function isBtcRewardSnapshotStatus(status: EBtcRewardStatus): boolean {
  return (
    status === EBtcRewardStatus.PayoutInProgress ||
    status === EBtcRewardStatus.Paid
  );
}

const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

const padDatePart = (value: number) => String(value).padStart(2, '0');

function getShanghaiDatePrefix(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const shanghaiDate = new Date(date.getTime() + SHANGHAI_UTC_OFFSET_MS);
  return `${shanghaiDate.getUTCFullYear()}-${padDatePart(
    shanghaiDate.getUTCMonth() + 1,
  )}-${padDatePart(shanghaiDate.getUTCDate())}`;
}

export function formatBtcRewardServerDate(value: string): string {
  const datePrefix = getShanghaiDatePrefix(value);
  return formatDate(datePrefix ? `${datePrefix}T12:00:00` : value, {
    hideTimeForever: true,
  });
}
