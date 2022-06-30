import BigNumber from 'bignumber.js';

import { EIP1559Fee } from '../../types/network';
import { IFeeInfo, IFeeInfoUnit } from '../types';

export function calculateTotalFeeNative({
  amount, // in GWEI
  info,
}: {
  amount: string;
  info: IFeeInfo;
}) {
  return new BigNumber(amount)
    .plus(info.baseFeeValue ?? 0)
    .shiftedBy(info.feeDecimals ?? 0) // GWEI -> Value
    .shiftedBy(-(info.nativeDecimals ?? 0)) // Value -> Amount
    .toFixed();
}

function nanToZeroString(value: string | number | unknown) {
  if (value === 'NaN' || Number.isNaN(value)) {
    return '0';
  }
  return value as string;
}

export function calculateTotalFeeRange(feeValue: IFeeInfoUnit) {
  const limit = feeValue.limitUsed || feeValue.limit;
  if (feeValue.eip1559) {
    // MIN: (baseFee + maxPriorityFeePerGas) * limit
    const priceInfo = feeValue.price as EIP1559Fee;
    const min = new BigNumber(limit as string)
      .times(
        new BigNumber(priceInfo.baseFee).plus(priceInfo.maxPriorityFeePerGas),
      )
      .toFixed();

    // MAX: maxFeePerGas * limit
    const max = new BigNumber(limit as string)
      .times(priceInfo.gasPrice || priceInfo.maxFeePerGas)
      .toFixed();
    return {
      min: nanToZeroString(min),
      max: nanToZeroString(max),
    };
  }

  const max = new BigNumber(limit as string)
    .times(feeValue.price as string)
    .toFixed();
  return {
    min: nanToZeroString(max),
    max: nanToZeroString(max),
  };
}
