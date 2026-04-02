import { useMemo } from 'react';

import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

interface IUseHolderItemDataProps {
  item: IMarketTokenHolder;
  index: number;
}

export function useHolderItemData({ item, index }: IUseHolderItemDataProps) {
  const rank = index + 1;

  const displayPercentage = useMemo(() => {
    if (item.percentage) {
      if (item.percentage === '0.00') {
        return '<0.01%';
      }

      return `${item.percentage}%`;
    }
    return '-';
  }, [item.percentage]);

  const fiatValue = item.fiatValue;

  const hasValidData = useMemo(() => {
    return Boolean(item.amount && fiatValue);
  }, [item.amount, fiatValue]);

  return {
    rank,
    displayPercentage,
    hasValidData,
    accountAddress: item.accountAddress,
    amount: item.amount,
    fiatValue,
  };
}
