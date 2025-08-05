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
      return `${item.percentage}%`;
    }
    return '-';
  }, [item.percentage]);

  const hasValidData = useMemo(() => {
    return Boolean(item.amount && item.fiatValue);
  }, [item.amount, item.fiatValue]);

  return {
    rank,
    displayPercentage,
    hasValidData,
    accountAddress: item.accountAddress,
    amount: item.amount,
    fiatValue: item.fiatValue,
  };
}
