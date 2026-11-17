import { useMemo } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

export function useBorrowPlaceholderAmountText(): IEarnText {
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;

  return useMemo(
    () => ({ text: `${currencySymbol}0.00`, color: '$textSubdued' }),
    [currencySymbol],
  );
}
