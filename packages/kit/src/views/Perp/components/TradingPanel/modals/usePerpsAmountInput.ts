import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

type IAmountUnit = 'token' | 'usd';

export function usePerpsAmountInput({
  unit,
  tokenPrice,
  tokenDecimals = 6,
}: {
  unit: IAmountUnit;
  tokenPrice?: string;
  tokenDecimals?: number;
}) {
  // Only edits replace the source. Rounded display values must never become
  // the input to the next conversion or change the quoted token amount.
  const [source, setSource] = useState({ amount: '', unit });
  const setAmount = useCallback(
    (amount: string) => setSource({ amount, unit }),
    [unit],
  );
  const priceBN = useMemo(() => new BigNumber(tokenPrice || '0'), [tokenPrice]);
  const sourceAmountBN = useMemo(
    () => new BigNumber(source.amount || '0'),
    [source.amount],
  );
  const tokenAmountBN = useMemo(
    () =>
      source.unit === 'usd' && priceBN.gt(0)
        ? sourceAmountBN.dividedBy(priceBN)
        : sourceAmountBN,
    [priceBN, source.unit, sourceAmountBN],
  );
  const getDisplayAmount = useCallback(
    (displayUnit: IAmountUnit, decimals = tokenDecimals) => {
      if (
        displayUnit === source.unit ||
        !sourceAmountBN.gt(0) ||
        !priceBN.gt(0)
      ) {
        return source.amount;
      }
      return displayUnit === 'usd'
        ? sourceAmountBN
            .multipliedBy(priceBN)
            .toFixed(2, BigNumber.ROUND_HALF_UP)
        : tokenAmountBN.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed();
    },
    [priceBN, source, sourceAmountBN, tokenAmountBN, tokenDecimals],
  );

  return {
    amount: getDisplayAmount(unit),
    convertedAmount: getDisplayAmount(
      unit === 'usd' ? 'token' : 'usd',
      Math.min(tokenDecimals, 8),
    ),
    setAmount,
    source,
    tokenAmountBN,
  };
}
