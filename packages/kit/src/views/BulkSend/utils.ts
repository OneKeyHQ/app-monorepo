import BigNumber from 'bignumber.js';

import {
  EAmountInputMode,
  type IAmountInputError,
  type IAmountInputValues,
} from '@onekeyhq/shared/types/bulkSend';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export function calculateIsAmountValid({
  amountInputMode,
  amountInputErrors,
  amountInputValues,
}: {
  amountInputMode: EAmountInputMode;
  amountInputErrors: IAmountInputError;
  amountInputValues: IAmountInputValues;
}): boolean {
  switch (amountInputMode) {
    case EAmountInputMode.Specified:
      return (
        !amountInputErrors.specifiedAmount &&
        amountInputValues.specifiedAmount !== ''
      );
    case EAmountInputMode.Range:
      return (
        !amountInputErrors.rangeMin &&
        !amountInputErrors.rangeMax &&
        amountInputValues.rangeMin !== '' &&
        amountInputValues.rangeMax !== ''
      );
    default:
      return true;
  }
}

export function calculateTotalAmounts({
  transfersInfo,
  tokenPrice,
}: {
  transfersInfo: ITransferInfo[];
  tokenPrice: number | undefined;
}): { totalTokenAmount: string; totalFiatAmount: string } {
  let total = new BigNumber(0);
  for (const transfer of transfersInfo) {
    const amount = new BigNumber(transfer.amount || '0');
    if (!amount.isNaN()) {
      total = total.plus(amount);
    }
  }
  const fiat =
    tokenPrice && !total.isZero() ? total.times(tokenPrice).toFixed() : '0';
  return {
    totalTokenAmount: total.isZero() ? '0' : total.toFixed(),
    totalFiatAmount: fiat,
  };
}

/**
 * Gets the number of decimal places in a numeric string.
 */
function getDecimalPlaces(value: string): number {
  const parts = value.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

/**
 * Generates random amounts for each transfer within the specified range.
 *
 * @param balance - Optional array of balance constraints:
 *   - If not provided: only generate amounts within [rangeMin, rangeMax]
 *   - If length === 1: total sum of all amounts cannot exceed balance[0]
 *   - If length === transfersInfo.length: each amount must be within [rangeMin, rangeMax]
 *     AND not exceed the corresponding balance[i]
 *   - If length > 1 but !== transfersInfo.length: throws an error
 *
 * Generated values will have minimal decimal places based on the input range,
 * with 2 extra decimal places for randomness (capped at token decimals).
 */
export function generateRandomAmountsFromRange({
  transfersInfo,
  rangeMin,
  rangeMax,
  balance,
  decimals,
}: {
  transfersInfo: ITransferInfo[];
  rangeMin: string;
  rangeMax: string;
  balance?: string[];
  decimals: number;
}): string[] {
  const min = new BigNumber(rangeMin);
  const max = new BigNumber(rangeMax);
  const count = transfersInfo.length;

  if (min.isNaN() || max.isNaN() || count === 0) {
    return [];
  }

  // Calculate output decimal places: max of input decimals + 2, capped at token decimals
  const minDecimals = getDecimalPlaces(rangeMin);
  const maxDecimals = getDecimalPlaces(rangeMax);
  const inputDecimals = Math.max(minDecimals, maxDecimals);
  const outputDecimals = Math.min(inputDecimals + 2, decimals);

  // Validate balance array length
  if (balance !== undefined && balance.length > 1 && balance.length !== count) {
    throw new OneKeyLocalError(
      `Balance array length (${balance.length}) must equal transfersInfo length (${count}) when providing multiple balances`,
    );
  }

  // Generate random amounts within [min, max]
  const randomAmounts: BigNumber[] = [];
  for (let i = 0; i < count; i += 1) {
    const random = Math.random();
    let amount = min.plus(max.minus(min).times(random));

    // Case 2: Per-transfer balance constraint
    if (balance !== undefined && balance.length > 1) {
      const perTransferBalance = new BigNumber(balance[i]);
      if (!perTransferBalance.isNaN()) {
        // Clamp to min of (max, perTransferBalance)
        const effectiveMax = BigNumber.min(max, perTransferBalance);
        // If effectiveMax < min, use effectiveMax (best effort)
        if (effectiveMax.isLessThan(min)) {
          amount = effectiveMax;
        } else {
          // Regenerate within [min, effectiveMax]
          amount = min.plus(effectiveMax.minus(min).times(random));
        }
      }
    }

    randomAmounts.push(amount);
  }

  // Case 1: Single total balance constraint
  if (balance !== undefined && balance.length === 1) {
    const totalBalanceBN = new BigNumber(balance[0]);
    if (!totalBalanceBN.isNaN()) {
      // Calculate total
      let total = randomAmounts.reduce(
        (sum, amt) => sum.plus(amt),
        new BigNumber(0),
      );

      // If total exceeds balance, scale down proportionally
      if (total.isGreaterThan(totalBalanceBN)) {
        const scaleFactor = totalBalanceBN.dividedBy(total);
        for (let i = 0; i < randomAmounts.length; i += 1) {
          let scaled = randomAmounts[i].times(scaleFactor);
          // Ensure scaled amount is at least min (if possible)
          if (scaled.isLessThan(min)) {
            scaled = min;
          }
          // Ensure scaled amount doesn't exceed max
          if (scaled.isGreaterThan(max)) {
            scaled = max;
          }
          randomAmounts[i] = scaled;
        }

        // Recalculate total after clamping
        total = randomAmounts.reduce(
          (sum, amt) => sum.plus(amt),
          new BigNumber(0),
        );

        // If still over balance after clamping, reduce amounts starting from largest
        if (total.isGreaterThan(totalBalanceBN)) {
          const excess = total.minus(totalBalanceBN);
          // Sort indices by amount descending
          const indices = randomAmounts
            .map((_, idx) => idx)
            .toSorted((a, b) => randomAmounts[b].comparedTo(randomAmounts[a]));

          let remaining = excess;
          for (const idx of indices) {
            if (remaining.isLessThanOrEqualTo(0)) break;
            const current = randomAmounts[idx];
            const canReduce = current.minus(min);
            if (canReduce.isGreaterThan(0)) {
              const reduction = BigNumber.min(canReduce, remaining);
              randomAmounts[idx] = current.minus(reduction);
              remaining = remaining.minus(reduction);
            }
          }
        }
      }
    }
  }

  return randomAmounts.map((amount) =>
    amount.toFixed(outputDecimals, BigNumber.ROUND_DOWN),
  );
}

export function generateAmountsFromSpecifiedAmount({
  specifiedAmount,
  transfersInfo,
}: {
  specifiedAmount: string;
  transfersInfo: ITransferInfo[];
}): string[] {
  return transfersInfo.map((_) => specifiedAmount);
}
