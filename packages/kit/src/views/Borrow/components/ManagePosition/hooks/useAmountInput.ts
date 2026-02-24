import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { calcPercentBalance } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useOnBlurAmountValue } from '@onekeyhq/kit/src/views/Staking/components/StakingAmountInput';
import { countDecimalPlaces } from '@onekeyhq/kit/src/views/Staking/utils/utils';

import type { IBorrowActionType } from '../types';

export interface IUseAmountInputParams {
  action: IBorrowActionType;
  decimals?: number;
  balance: string;
  maxBalance?: string;
  amountValue: string;
  setAmountValue: (value: string) => void;
}

export function useAmountInput({
  action: _action,
  decimals,
  balance,
  maxBalance,
  amountValue,
  setAmountValue,
}: IUseAmountInputParams) {
  const onChangeAmountValue = useCallback(
    (value: string) => {
      if (!validateAmountInputForStaking(value, decimals)) {
        return;
      }

      const valueBN = new BigNumber(value);
      if (valueBN.isNaN()) {
        if (value === '') {
          setAmountValue('');
        }
        return;
      }

      const isOverflowDecimals = Boolean(
        decimals &&
        Number(decimals) > 0 &&
        countDecimalPlaces(value) > decimals,
      );
      if (isOverflowDecimals) {
        return;
      }

      setAmountValue(value);
    },
    [decimals, setAmountValue],
  );

  const onMax = useCallback(() => {
    const valueForMax = maxBalance ?? balance;
    const formattedMax =
      typeof decimals === 'number'
        ? new BigNumber(valueForMax)
            .decimalPlaces(decimals, BigNumber.ROUND_DOWN)
            .toFixed()
        : valueForMax;
    onChangeAmountValue(formattedMax);
  }, [balance, maxBalance, decimals, onChangeAmountValue]);

  const onSelectPercentageStage = useCallback(
    (percent: number) => {
      // Use the same base as onMax for consistency:
      // repay uses maxRepayBalance (min of debt and wallet balance),
      // other actions fall back to balance when maxBalance is undefined.
      const balanceForPercent = maxBalance ?? balance;
      onChangeAmountValue(
        calcPercentBalance({
          balance: balanceForPercent,
          percent,
          decimals,
        }),
      );
    },
    [balance, maxBalance, decimals, onChangeAmountValue],
  );

  // Use the original hook to avoid closure issues
  const onBlurAmountValue = useOnBlurAmountValue(amountValue, setAmountValue);

  return {
    onChangeAmountValue,
    onMax,
    onSelectPercentageStage,
    onBlurAmountValue,
  };
}
