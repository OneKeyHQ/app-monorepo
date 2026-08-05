import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SWAP_INVITE_DESKTOP_COLUMN_WIDTHS } from '../utils';

const MIN_COLUMN_WIDTHS = {
  address: 140,
  invitedAt: 150,
  referralCode: 140,
  firstTrade: 170,
  volume: 130,
  fee: 140,
  rewards: 130,
} as const;

const CHAR_WIDTH_MULTIPLIER = 9;
const SORT_ICON_WIDTH = 24;
const ROW_HORIZONTAL_PADDING = 40;

export interface ISwapInviteColumnWidths {
  address: string | number;
  invitedAt: string | number;
  referralCode: string | number;
  firstTrade: string | number;
  volume: string | number;
  fee: string | number;
  rewards: string | number;
}

function getColumnWidth({
  label,
  minWidth,
  sortable = false,
}: {
  label: string;
  minWidth: number;
  sortable?: boolean;
}) {
  return Math.max(
    label.length * CHAR_WIDTH_MULTIPLIER + (sortable ? SORT_ICON_WIDTH : 0),
    minWidth,
  );
}

export function useSwapTableColumns(isCompact: boolean) {
  const intl = useIntl();

  const compactColumnWidths = useMemo<ISwapInviteColumnWidths>(
    () => ({
      address: getColumnWidth({
        label: intl.formatMessage({ id: ETranslations.global_address }),
        minWidth: MIN_COLUMN_WIDTHS.address,
      }),
      invitedAt: getColumnWidth({
        label: intl.formatMessage({
          id: ETranslations.referral_perps_invited_at,
        }),
        minWidth: MIN_COLUMN_WIDTHS.invitedAt,
        sortable: true,
      }),
      referralCode: getColumnWidth({
        label: intl.formatMessage({
          id: ETranslations.referral_perps_referral_code,
        }),
        minWidth: MIN_COLUMN_WIDTHS.referralCode,
      }),
      firstTrade: getColumnWidth({
        label: intl.formatMessage({
          id: ETranslations.referral_perps_first_trade,
        }),
        minWidth: MIN_COLUMN_WIDTHS.firstTrade,
        sortable: true,
      }),
      volume: getColumnWidth({
        label: intl.formatMessage({
          id: ETranslations.referral_perps_volume,
        }),
        minWidth: MIN_COLUMN_WIDTHS.volume,
        sortable: true,
      }),
      fee: getColumnWidth({
        label: intl.formatMessage({
          id: ETranslations.referral_perps_onekey_fee,
        }),
        minWidth: MIN_COLUMN_WIDTHS.fee,
        sortable: true,
      }),
      rewards: getColumnWidth({
        label: intl.formatMessage({ id: ETranslations.earn_rewards }),
        minWidth: MIN_COLUMN_WIDTHS.rewards,
        sortable: true,
      }),
    }),
    [intl],
  );

  const tableMinWidth = useMemo(
    () =>
      Object.values(compactColumnWidths).reduce<number>(
        (total, width) => total + Number(width),
        ROW_HORIZONTAL_PADDING,
      ),
    [compactColumnWidths],
  );

  return {
    columnWidths: isCompact
      ? compactColumnWidths
      : SWAP_INVITE_DESKTOP_COLUMN_WIDTHS,
    tableMinWidth,
  };
}
