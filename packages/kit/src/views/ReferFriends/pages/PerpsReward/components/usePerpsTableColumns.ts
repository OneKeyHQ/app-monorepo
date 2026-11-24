import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

// Column width percentages for desktop
const COLUMN_WIDTHS_PERCENT = {
  address: '13%',
  invitedAt: '14%',
  referralCode: '12%',
  firstTrade: '14%',
  volume: '11%',
  fee: '13%',
  undistributed: '9%',
  reward: '14%',
} as const;

// Minimum column widths for mobile
const MIN_COLUMN_WIDTHS = {
  address: 120,
  invitedAt: 140,
  referralCode: 110,
  firstTrade: 140,
  volume: 120,
  fee: 120,
  undistributed: 110,
  reward: 130,
} as const;

// Character width multiplier for calculating dynamic widths
const CHAR_WIDTH_MULTIPLIER = 9;

export interface IColumnWidths {
  address: string | number;
  invitedAt: string | number;
  referralCode: string | number;
  firstTrade: string | number;
  volume: string | number;
  fee: string | number;
  undistributed: string | number;
  reward: string | number;
}

export function usePerpsTableColumns(isMobile: boolean) {
  const intl = useIntl();

  // Calculate dynamic column widths based on translated text length
  const dynamicColumnWidths = useMemo(() => {
    const addressWidth = Math.max(
      intl.formatMessage({ id: ETranslations.global_address }).length *
        CHAR_WIDTH_MULTIPLIER,
      MIN_COLUMN_WIDTHS.address,
    );
    const invitedAtWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_perps_invited_at })
        .length *
        CHAR_WIDTH_MULTIPLIER +
        10,
      MIN_COLUMN_WIDTHS.invitedAt,
    );
    const referralCodeWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_perps_referral_code })
        .length * CHAR_WIDTH_MULTIPLIER,
      MIN_COLUMN_WIDTHS.referralCode,
    );
    const firstTradeWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_perps_first_trade })
        .length *
        CHAR_WIDTH_MULTIPLIER +
        20,
      MIN_COLUMN_WIDTHS.firstTrade,
    );
    const volumeWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_perps_volume }).length *
        CHAR_WIDTH_MULTIPLIER,
      MIN_COLUMN_WIDTHS.volume,
    );
    const feeWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_perps_onekey_fee })
        .length * CHAR_WIDTH_MULTIPLIER,
      MIN_COLUMN_WIDTHS.fee,
    );
    const undistributedWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_undistributed }).length *
        CHAR_WIDTH_MULTIPLIER,
      MIN_COLUMN_WIDTHS.undistributed,
    );
    const rewardWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_total_reward }).length *
        CHAR_WIDTH_MULTIPLIER +
        20,
      MIN_COLUMN_WIDTHS.reward,
    );

    return {
      address: addressWidth,
      invitedAt: invitedAtWidth,
      referralCode: referralCodeWidth,
      firstTrade: firstTradeWidth,
      volume: volumeWidth,
      fee: feeWidth,
      undistributed: undistributedWidth,
      reward: rewardWidth,
    };
  }, [intl]);

  // Calculate total table width for mobile horizontal scroll
  const tableMinWidth = useMemo(() => {
    return (
      dynamicColumnWidths.address +
      dynamicColumnWidths.invitedAt +
      dynamicColumnWidths.referralCode +
      dynamicColumnWidths.firstTrade +
      dynamicColumnWidths.volume +
      dynamicColumnWidths.fee +
      dynamicColumnWidths.undistributed +
      dynamicColumnWidths.reward +
      40 // padding
    );
  }, [dynamicColumnWidths]);

  const columnWidths: IColumnWidths = isMobile
    ? dynamicColumnWidths
    : COLUMN_WIDTHS_PERCENT;

  return {
    columnWidths,
    tableMinWidth,
  };
}
