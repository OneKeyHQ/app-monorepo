import { useCallback } from 'react';

import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import type BigNumber from 'bignumber.js';

// Dust sweep prices everything in USD; text that can't use <Currency> (labels,
// interpolated copy) goes through here to show the user's display currency.
export function useDustSweepFiatFormatter() {
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const targetCurrency = currencyInfo?.id ?? 'usd';
  return useCallback(
    (valueUsd: BigNumber.Value) => {
      // convertFiat passes the USD value through when either rate is missing,
      // so the symbol must stay USD in that case too.
      const converted = !!currencyMap.usd && !!currencyMap[targetCurrency];
      return numberFormat(
        convertFiat({
          value: valueUsd,
          sourceCurrency: 'usd',
          targetCurrency,
          currencyMap,
        }),
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
