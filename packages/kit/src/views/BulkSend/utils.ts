import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type {
  ITransferInfo,
  IVaultSettings,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EAmountInputMode,
  EIntervalMode,
  type IAmountInputError,
  type IAmountInputValues,
  type IIntervalSettings,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export const BULK_SEND_INTERVAL_MAX_SECONDS = 600;

export const DEFAULT_INTERVAL_SETTINGS: IIntervalSettings = {
  mode: EIntervalMode.Specified,
  minSeconds: '5',
  maxSeconds: '30',
};

export function filterIntegerInput(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

// Filter input to only allow numbers and decimal point
export function filterNumericInput(text: string): string {
  if (!text) {
    return '';
  }

  // Remove all characters except digits and decimal point
  let filtered = text.replace(/[^0-9.]/g, '');
  // Ensure only one decimal point
  const parts = filtered.split('.');
  if (parts.length > 2) {
    filtered = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  // Normalize decimal inputs like ".5" to "0.5"
  if (filtered.startsWith('.')) {
    filtered = `0${filtered}`;
  }

  return filtered;
}

export function calculateIsAmountValid({
  amountInputMode,
  amountInputErrors,
  amountInputValues,
  transferInfoErrors,
}: {
  amountInputMode: EAmountInputMode;
  amountInputErrors: IAmountInputError;
  amountInputValues: IAmountInputValues;
  transferInfoErrors?: ITransferInfoErrors;
}): boolean {
  switch (amountInputMode) {
    case EAmountInputMode.Specified: {
      // Max mode is always valid (send full balance per sender)
      if (amountInputValues.isMaxMode) {
        return true;
      }
      const specifiedAmountBN = new BigNumber(
        amountInputValues.specifiedAmount || '0',
      );
      return (
        !amountInputErrors.specifiedAmount &&
        amountInputValues.specifiedAmount !== '' &&
        !specifiedAmountBN.isZero() &&
        !specifiedAmountBN.isNaN()
      );
    }
    case EAmountInputMode.Range:
      return (
        !amountInputErrors.rangeError &&
        amountInputValues.rangeMin !== '' &&
        amountInputValues.rangeMax !== ''
      );
    case EAmountInputMode.Custom:
      if (transferInfoErrors) {
        return isEmpty(transferInfoErrors);
      }
      return true;
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

export function isBulkSendTokenDetailsMatched(
  {
    networkId,
    tokenInfo,
  }: {
    networkId?: string;
    tokenInfo?: IToken;
  },
  tokenDetails?: ({ info: IToken } & Partial<ITokenFiat>) | undefined,
): tokenDetails is { info: IToken } & Partial<ITokenFiat> {
  if (!tokenInfo || !tokenDetails?.info) {
    return false;
  }

  const expectedNetworkId = tokenInfo.networkId ?? networkId;
  const currentNetworkId = tokenDetails.info.networkId ?? networkId;

  if (!expectedNetworkId || !currentNetworkId) {
    return false;
  }

  if (expectedNetworkId !== currentNetworkId) {
    return false;
  }

  if (tokenInfo.isNative && tokenDetails.info.isNative) {
    return true;
  }

  return equalTokenNoCaseSensitive({
    token1: {
      networkId: expectedNetworkId,
      contractAddress: tokenInfo.address,
    },
    token2: {
      networkId: currentNetworkId,
      contractAddress: tokenDetails.info.address,
    },
  });
}

// Check if any sender's aggregated transfer amount exceeds their balance.
// For duplicate senders, sums all transfer amounts for the same address.
export function checkSenderInsufficientBalance({
  transfersInfo,
  senderBalances,
}: {
  transfersInfo: ITransferInfo[];
  senderBalances: Record<string, string>;
}): boolean {
  const aggregated = new Map<string, BigNumber>();
  for (const transfer of transfersInfo) {
    if (transfer.amount && transfer.amount !== '') {
      const amount = new BigNumber(transfer.amount);
      if (!amount.isNaN()) {
        const existing = aggregated.get(transfer.from);
        aggregated.set(
          transfer.from,
          existing ? existing.plus(amount) : amount,
        );
      }
    }
  }
  for (const [address, totalAmount] of aggregated) {
    const balance = senderBalances[address];
    if (balance !== undefined && totalAmount.gt(balance)) {
      return true;
    }
  }
  return false;
}

export function getBulkSendMinTransferAmount({
  vaultSettings,
  isNative,
}: {
  vaultSettings?: Pick<
    IVaultSettings,
    'minTransferAmount' | 'nativeMinTransferAmount'
  > | null;
  isNative?: boolean;
}): string {
  if (!vaultSettings) {
    return '0';
  }

  return isNative
    ? (vaultSettings.nativeMinTransferAmount ??
        vaultSettings.minTransferAmount ??
        '0')
    : (vaultSettings.minTransferAmount ?? '0');
}

function getTokenMinAmount(tokenDecimals?: number): string {
  if (tokenDecimals === undefined || tokenDecimals === null) {
    return '0';
  }

  return new BigNumber(1).shiftedBy(-tokenDecimals).toFixed();
}

export function getBulkSendMinTransferDisplayAmount({
  minTransferAmount,
  tokenDecimals,
}: {
  minTransferAmount?: string;
  tokenDecimals?: number;
}): string {
  return BigNumber.max(
    getTokenMinAmount(tokenDecimals),
    minTransferAmount ?? '0',
  ).toFixed();
}

export function formatIntervalSecondsRange({
  minSeconds,
  maxSeconds,
}: {
  minSeconds?: string;
  maxSeconds?: string;
}) {
  const min = minSeconds || '0';
  const max = maxSeconds || '0';

  return appLocale.intl.formatMessage(
    {
      id: ETranslations.earn_number_seconds,
    },
    {
      number: `${min} - ${max}`,
    },
  );
}

export function validateIntervalSettings({
  mode,
  minSeconds,
  maxSeconds,
}: IIntervalSettings): string | undefined {
  if (mode !== EIntervalMode.Specified) {
    return undefined;
  }

  const minBN = new BigNumber(minSeconds || '0');
  const maxBN = new BigNumber(maxSeconds || '0');

  if (
    (minSeconds !== '' &&
      (minBN.isNaN() || minBN.isGreaterThan(BULK_SEND_INTERVAL_MAX_SECONDS))) ||
    (maxSeconds !== '' &&
      (maxBN.isNaN() || maxBN.isGreaterThan(BULK_SEND_INTERVAL_MAX_SECONDS)))
  ) {
    return appLocale.intl.formatMessage({
      id: ETranslations.wallet_bulk_send_error_proper_range,
    });
  }

  if (minSeconds === '') {
    return appLocale.intl.formatMessage({
      id: ETranslations.wallet_bulk_send_error_min_required,
    });
  }

  if (maxSeconds === '') {
    return appLocale.intl.formatMessage({
      id: ETranslations.wallet_bulk_send_error_max_required,
    });
  }

  if (maxBN.isLessThanOrEqualTo(0)) {
    return appLocale.intl.formatMessage({
      id: ETranslations.wallet_bulk_send_error_max_zero,
    });
  }

  if (minBN.isGreaterThanOrEqualTo(maxBN)) {
    return appLocale.intl.formatMessage({
      id: ETranslations.wallet_bulk_send_error_max_less_than_min,
    });
  }

  return undefined;
}

/**
 * Gets the number of decimal places in a numeric string.
 */
function getDecimalPlaces(value: string): number {
  const parts = value.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

const MAX_INPUT_DECIMALS = 4;
const SIGNIFICANT_FIGURES = 3;

/**
 * Formats a BigNumber value with appropriate decimal places.
 * - Follows input precision when reasonable
 * - Uses significant figures for very small values to avoid showing 0.00
 * - Caps at token decimals
 */
function formatWithSmartDecimals(
  value: BigNumber,
  inputDecimals: number,
  tokenDecimals: number,
): string {
  if (value.isZero()) {
    return '0';
  }

  const absValue = value.abs();

  // For values >= 1, use input decimals (capped)
  if (absValue.gte(1)) {
    const decimals = Math.min(
      inputDecimals <= MAX_INPUT_DECIMALS ? inputDecimals : MAX_INPUT_DECIMALS,
      tokenDecimals,
    );
    return value.toFixed(decimals, BigNumber.ROUND_DOWN);
  }

  // For values < 1, ensure we show meaningful digits
  // Calculate minimum decimals needed for significant figures
  const log10 = Math.floor(Math.log10(absValue.toNumber()));
  const minDecimalsForSigFigs = -log10 + SIGNIFICANT_FIGURES - 1;

  let finalDecimals: number;
  if (inputDecimals <= MAX_INPUT_DECIMALS) {
    // Use the larger of: input decimals or minimum needed for sig figs
    finalDecimals = Math.max(inputDecimals, minDecimalsForSigFigs);
  } else {
    // Input is too long, just use sig figs
    finalDecimals = minDecimalsForSigFigs;
  }

  return value.toFixed(
    Math.min(finalDecimals, tokenDecimals),
    BigNumber.ROUND_DOWN,
  );
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
 * Generated values will have smart decimal places based on value magnitude:
 * larger values get fewer decimals, smaller values get more.
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
  let max = new BigNumber(rangeMax);
  const count = transfersInfo.length;

  if (min.isNaN() || max.isNaN() || count === 0) {
    return [];
  }

  // Get input decimal places as minimum precision floor
  const minDecimals = getDecimalPlaces(rangeMin);
  const maxDecimals = getDecimalPlaces(rangeMax);
  const inputDecimals = Math.max(minDecimals, maxDecimals);

  // Validate balance array length
  if (balance !== undefined && balance.length > 1 && balance.length !== count) {
    throw new OneKeyLocalError(
      `Balance array length (${balance.length}) must equal transfersInfo length (${count}) when providing multiple balances`,
    );
  }

  // When single balance constraint exists, use balance/count as effective max
  // This ensures total amount won't exceed balance without needing excessive scaling
  let totalBalanceBN: BigNumber | undefined;
  if (balance !== undefined && balance.length === 1) {
    totalBalanceBN = new BigNumber(balance[0]);
    if (!totalBalanceBN.isNaN()) {
      // When balance is zero, all amounts must be zero
      if (totalBalanceBN.isZero()) {
        return transfersInfo.map(() => '0');
      }
      const avgBalancePerTransfer = totalBalanceBN.dividedBy(count);
      // Use the smaller of: user's max or average balance per transfer
      if (max.isGreaterThan(avgBalancePerTransfer)) {
        max = avgBalancePerTransfer;
      }
    }
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

  // Case 1: Single total balance constraint - scale down if total exceeds balance
  if (totalBalanceBN && !totalBalanceBN.isNaN()) {
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

  // Format amounts with smart decimals
  const formattedAmounts = randomAmounts.map((amount) =>
    formatWithSmartDecimals(amount, inputDecimals, decimals),
  );

  // Final check: ensure formatted total doesn't exceed balance due to rounding
  if (totalBalanceBN && !totalBalanceBN.isNaN()) {
    const formattedTotal = formattedAmounts.reduce(
      (sum, amt) => sum.plus(amt),
      new BigNumber(0),
    );

    if (formattedTotal.isGreaterThan(totalBalanceBN)) {
      // Find the largest amount and reduce it to compensate for rounding error
      const excess = formattedTotal.minus(totalBalanceBN);
      let maxIdx = 0;
      let maxVal = new BigNumber(formattedAmounts[0]);
      for (let i = 1; i < formattedAmounts.length; i += 1) {
        const val = new BigNumber(formattedAmounts[i]);
        if (val.isGreaterThan(maxVal)) {
          maxVal = val;
          maxIdx = i;
        }
      }
      // Reduce the largest amount by the excess, respecting min
      const adjusted = maxVal.minus(excess);
      if (adjusted.gte(min)) {
        formattedAmounts[maxIdx] = adjusted.toFixed(
          decimals,
          BigNumber.ROUND_DOWN,
        );
      }
    }
  }

  return formattedAmounts;
}

export function generateAmountsFromSpecifiedAmount({
  specifiedAmount,
  transfersInfo,
}: {
  specifiedAmount: string;
  transfersInfo: ITransferInfo[];
}): string[] {
  return transfersInfo.map(() => specifiedAmount);
}

/**
 * Validates a range amount input.
 * Returns an error message if validation fails, undefined otherwise.
 */
export function validateRangeInput({
  rangeMin,
  rangeMax,
  balance,
  minTransferAmount,
  tokenSymbol,
  tokenDecimals,
}: {
  rangeMin: string;
  rangeMax: string;
  balance?: string;
  minTransferAmount?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
}): string | undefined {
  const minBN = new BigNumber(rangeMin || '0');
  const maxBN = new BigNumber(rangeMax || '0');

  // Balance checks only when balance is provided
  if (balance !== undefined) {
    const balanceBN = new BigNumber(balance);

    // When balance is zero, no valid non-zero range can be generated
    if (balanceBN.isZero()) {
      return appLocale.intl.formatMessage({
        id: ETranslations.swap_page_button_insufficient_balance,
      });
    }

    // Only check if min exceeds balance (min must be achievable)
    // max > balance is allowed - generation logic will use balance/count as effective max
    if (minBN.isGreaterThan(balanceBN)) {
      return appLocale.intl.formatMessage({
        id: ETranslations.swap_page_button_insufficient_balance,
      });
    }
  }

  // Check if range min is below chain minimum transfer amount
  if (minTransferAmount) {
    const minTransferBN = new BigNumber(minTransferAmount);
    if (
      !minTransferBN.isZero() &&
      rangeMin !== '' &&
      !minBN.isNaN() &&
      minBN.isLessThan(minTransferBN)
    ) {
      const minTransferDisplayAmount = getBulkSendMinTransferDisplayAmount({
        minTransferAmount,
        tokenDecimals,
      });
      return appLocale.intl.formatMessage(
        { id: ETranslations.send_error_minimum_amount },
        { amount: minTransferDisplayAmount, token: tokenSymbol ?? '' },
      );
    }
  }

  // Check if min >= max (invalid range)
  if (
    rangeMin !== '' &&
    rangeMax !== '' &&
    minBN.isGreaterThanOrEqualTo(maxBN)
  ) {
    return appLocale.intl.formatMessage({
      id: ETranslations.wallet_bulk_send_error_proper_range,
    });
  }

  return undefined;
}
