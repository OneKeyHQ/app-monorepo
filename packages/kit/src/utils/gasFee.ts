import BigNumber from 'bignumber.js';

import type { IEIP1559Fee, IFeeInfoUnit } from '@onekeyhq/shared/types/gas';

function nilError(message: string): number {
  throw new Error(message);
}

function nanToZeroString(value: string | number | unknown) {
  if (value === 'NaN' || Number.isNaN(value)) {
    return '0';
  }
  return value as string;
}

export function calculateTotalFeeRange(
  feeInfo: IFeeInfoUnit,
  displayDecimals = 8,
) {
  const limit = feeInfo.limitUsed || feeInfo.limit;
  const limitForDisplay = feeInfo.limitForDisplay ?? limit;
  if (feeInfo.isEIP1559) {
    // MIN: (baseFeePerGas + maxPriorityFeePerGas) * limit
    const priceInfo = feeInfo.price1559 as IEIP1559Fee;
    const min = new BigNumber(limit as string)
      .times(
        new BigNumber(priceInfo.baseFeePerGas).plus(
          priceInfo.maxPriorityFeePerGas,
        ),
      )
      .toFixed(displayDecimals);

    const minForDisplay = new BigNumber(limitForDisplay as string)
      .times(
        new BigNumber(priceInfo.baseFeePerGas).plus(
          priceInfo.maxPriorityFeePerGas,
        ),
      )
      .toFixed(displayDecimals);

    // MAX: maxFeePerGas * limit
    const max = new BigNumber(limit as string)
      .times(priceInfo.maxFeePerGas)
      .toFixed(displayDecimals);

    const maxForDisplay = new BigNumber(limitForDisplay as string)
      .times(priceInfo.maxFeePerGas)
      .toFixed(displayDecimals);
    return {
      min: nanToZeroString(min),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(minForDisplay),
      maxForDisplay: nanToZeroString(maxForDisplay),
    };
  }

  if (feeInfo.isBtcForkChain) {
    const fee = new BigNumber(feeInfo.btcFee ?? '0')
      .shiftedBy(-displayDecimals)
      .toFixed(displayDecimals);
    return {
      min: nanToZeroString(fee),
      max: nanToZeroString(fee),
      minForDisplay: nanToZeroString(fee),
      maxForDisplay: nanToZeroString(fee),
    };
  }

  const max = new BigNumber(limit as string)
    .times(feeInfo.price as string)
    .toFixed();

  const maxForDisplay = new BigNumber(limitForDisplay as string)
    .times(feeInfo.price as string)
    .toFixed();

  return {
    min: nanToZeroString(max),
    max: nanToZeroString(max),
    minForDisplay: nanToZeroString(maxForDisplay),
    maxForDisplay: nanToZeroString(maxForDisplay),
  };
}
export function calculateTotalFeeNative({
  amount, // in GWEI
  feeInfo,
  displayDecimal = 8,
}: {
  amount: string | BigNumber;
  feeInfo: IFeeInfoUnit;
  displayDecimal?: number;
}) {
  return new BigNumber(amount)
    .plus(feeInfo.baseFeeValue ?? 0)
    .shiftedBy(
      feeInfo.feeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.feeDecimals missing'),
    ) // GWEI -> onChainValue
    .shiftedBy(
      -(
        feeInfo.nativeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.nativeDecimals missing')
      ),
    ) // onChainValue -> nativeAmount
    .toFixed(displayDecimal);
}
