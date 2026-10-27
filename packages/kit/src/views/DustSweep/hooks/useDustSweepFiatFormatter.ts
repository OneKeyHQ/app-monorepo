import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

const isUsableRate = (rate: BigNumber) => rate.isFinite() && rate.gt(0);

// Dust sweep prices everything in USD; text that can't use <Currency> (labels,
// interpolated copy) goes through here to show the user's display currency.
export function useDustSweepFiatFormatter() {
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const targetCurrency = currencyInfo?.id ?? 'usd';
  return useCallback(
    (valueUsd: BigNumber.Value) => {
      const usdRate = new BigNumber(currencyMap.usd?.value ?? NaN);
      const targetRate = new BigNumber(
        currencyMap[targetCurrency]?.value ?? NaN,
      );
      // Only label the value with the display currency when it was actually
      // converted; a missing, zero or invalid rate keeps the USD amount and
      // symbol together.
      const converted =
        targetCurrency !== 'usd' &&
        isUsableRate(usdRate) &&
        isUsableRate(targetRate);
      return numberFormat(
        converted
          ? new BigNumber(valueUsd).div(usdRate).times(targetRate).toFixed()
          : new BigNumber(valueUsd).toFixed(),
        {
          formatter: 'value',
          formatterOptions: {
            currency: converted
              ? currencyMap[targetCurrency].unit
              : (currencyMap.usd?.unit ?? '$'),
          },
        },
      );
    },
    [currencyMap, targetCurrency],
  );
}
