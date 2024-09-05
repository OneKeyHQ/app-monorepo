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
      'claimable': intl.formatMessage({ id: ETranslations.earn_claim }),
      'claimed': intl.formatMessage({ id: ETranslations.earn_claimed }),
    }),
    [intl],
  );
};
