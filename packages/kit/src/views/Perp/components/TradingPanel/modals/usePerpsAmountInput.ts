import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';

type IAmountUnit = 'token' | 'usd';

export function usePerpsAmountInput({
  unit,
  tokenPrice,
  tokenDecimals = 6,
  resetKey,
}: {
  unit: IAmountUnit;
  tokenPrice?: string;
  tokenDecimals?: number;
  resetKey?: string;
}) {
  // Only edits replace the source. Rounded display values must never become
  // the input to the next conversion or change the quoted token amount.
  const [source, setSource] = useState({ amount: '', unit, resetKey });
  // Reset before effects can interpret the previous token's amount as this one.
  if (source.resetKey !== resetKey) {
    setSource({ amount: '', unit, resetKey });
  }
  const setAmount = useCallback(
    (amount: string) => setSource({ amount, unit, resetKey }),
    [unit, resetKey],
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

export function usePerpsDepositQuoteAmount(
  amount: string,
  tokenIdentity: string | undefined,
) {
  const input = useMemo(
    () => ({ amount, tokenIdentity }),
    [amount, tokenIdentity],
  );
  const debouncedInput = useDebounce(input, 800);
  return debouncedInput.tokenIdentity === tokenIdentity &&
    debouncedInput.amount === amount
    ? debouncedInput.amount
    : '';
}
