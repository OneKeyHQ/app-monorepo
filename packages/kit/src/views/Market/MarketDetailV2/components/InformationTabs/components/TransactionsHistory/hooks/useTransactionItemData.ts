import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatRelativeTimeAbbr } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface IUseTransactionItemDataProps {
  item: IMarketTokenTransaction;
}

export function useTransactionItemData({ item }: IUseTransactionItemDataProps) {
  const intl = useIntl();

  const formattedTime = formatRelativeTimeAbbr(item.timestamp);

  const isBuy = item.type === 'buy';
  const baseToken = isBuy ? item.to : item.from;
  const quoteToken = isBuy ? item.from : item.to;

  const baseSign = isBuy ? '+' : '-';
  const quoteSign = isBuy ? '-' : '+';
  const typeColor = isBuy ? '$textSuccess' : '$textCritical';

  const typeText = useMemo(
    () =>
      isBuy
        ? intl.formatMessage({
            id: ETranslations.dexmarket_details_transactions_buy,
          })
        : intl.formatMessage({
            id: ETranslations.dexmarket_details_transactions_sell,
          }),
    [isBuy, intl],
  );

  const price = isBuy ? item.to.price : item.from.price;
  const value = BigNumber(item.from.amount).times(item.from.price).toNumber();

  return {
    isBuy,
    baseToken,
    quoteToken,
    baseSign,
    quoteSign,
    typeColor,
    typeText,
    price,
    value,
    formattedTime,
  };
}
