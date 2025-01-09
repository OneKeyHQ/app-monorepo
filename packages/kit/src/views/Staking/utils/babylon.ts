import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBabylonPortfolioItem,
  IBabylonPortfolioStatus,
} from '@onekeyhq/shared/types/staking';

export type IBabylonStatus = IBabylonPortfolioStatus | 'overflow';

export const getBabylonPortfolioStatus = (
  item: IBabylonPortfolioItem,
): IBabylonStatus => (item.isOverflow ? 'overflow' : item.status);

export const useBabylonStatusMap = () => {
  const intl = useIntl();
  return useMemo<Record<IBabylonStatus, string>>(
    () => ({
      'active': intl.formatMessage({ id: ETranslations.earn_active }),
      'withdraw_requested': intl.formatMessage({
        id: ETranslations.earn_withdrawal_requested,
      }),
      'overflow': intl.formatMessage({ id: ETranslations.earn_overflow }),
      'claimable': intl.formatMessage({ id: ETranslations.earn_claimable }),
      'claimed': intl.formatMessage({ id: ETranslations.earn_claimed }),
      'local_pending_activation': intl.formatMessage({
        id: ETranslations.earn_pending_activation,
      }),
    }),
    [intl],
  );
};

export const getBabylonPortfolioTags = (
  item: IBabylonPortfolioItem,
): IBabylonStatus[] => {
  // 正常状态
  if (!item.isOverflow) {
    switch (item.status) {
      case 'active':
        return ['active'];
      case 'withdraw_requested':
        return ['active', 'withdraw_requested'];
      case 'claimable':
        return ['claimable'];
      case 'claimed':
        return ['claimed'];
      case 'local_pending_activation':
        return ['local_pending_activation'];
      default:
        return [];
    }
  }
  // 溢出状态
  switch (item.status) {
    case 'active':
      return ['overflow'];
    case 'withdraw_requested':
      return ['withdraw_requested'];
    case 'claimable':
      return ['claimable'];
    case 'claimed':
      return ['claimed'];
    case 'local_pending_activation':
      return ['local_pending_activation'];
    default:
      return [];
  }
};
