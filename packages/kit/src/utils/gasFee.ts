import BigNumber from 'bignumber.js';

import type { ILocaleIds } from '@onekeyhq/components';
import {
  EFeeType,
  type IFeeInfoUnit,
  type IGasEIP1559,
  type IGasLegacy,
} from '@onekeyhq/shared/types/fee';

const PRESET_FEE_ICON = ['🚅️', '🚗', '🚴‍♂️'];
const PRESET_FEE_LABEL = ['content__fast', 'content__normal', 'content__slow'];

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
  const { gas, gasEIP1559 } = feeInfo;
  if (feeInfo.gasEIP1559) {
    // MIN: (baseFeePerGas + maxPriorityFeePerGas) * limit
    const gasInfo = gasEIP1559 as IGasEIP1559;
    const limit = gasInfo.gasLimit;
    const limitForDisplay = gasInfo.gasLimitForDisplay ?? limit;
    const min = new BigNumber(limit)
      .times(
        new BigNumber(gasInfo.baseFeePerGas).plus(gasInfo.maxPriorityFeePerGas),
      )
      .toFixed(displayDecimals);

    const minForDisplay = new BigNumber(limitForDisplay)
      .times(
        new BigNumber(gasInfo.baseFeePerGas).plus(gasInfo.maxPriorityFeePerGas),
      )
      .toFixed(displayDecimals);

    // MAX: maxFeePerGas * limit
    const max = new BigNumber(limit)
      .times(gasInfo.maxFeePerGas)
      .toFixed(displayDecimals);

    const maxForDisplay = new BigNumber(limitForDisplay)
      .times(gasInfo.maxFeePerGas)
      .toFixed(displayDecimals);
    return {
      min: nanToZeroString(min),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(minForDisplay),
      maxForDisplay: nanToZeroString(maxForDisplay),
    };
  }

  if (feeInfo.feeUTXO) {
    const fee = new BigNumber(feeInfo.feeUTXO?.feeValue ?? '0')
      .shiftedBy(-displayDecimals)
      .toFixed(displayDecimals);
    return {
      min: nanToZeroString(fee),
      max: nanToZeroString(fee),
      minForDisplay: nanToZeroString(fee),
      maxForDisplay: nanToZeroString(fee),
    };
  }

  if (feeInfo.gas) {
    const gasInfo = gas as IGasLegacy;
    const limit = gasInfo.gasLimit;
    const limitForDisplay = gasInfo.gasLimitForDisplay ?? limit;
    const max = new BigNumber(limit).times(gasInfo.gasPrice).toFixed();

    const maxForDisplay = new BigNumber(limitForDisplay)
      .times(gasInfo.gasPrice)
      .toFixed();

    return {
      min: nanToZeroString(max),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(maxForDisplay),
      maxForDisplay: nanToZeroString(maxForDisplay),
    };
  }

  return {
    min: '0',
    max: '0',
    minForDisplay: '0',
    maxForDisplay: '0',
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
  const { common } = feeInfo;

  return new BigNumber(amount)
    .plus(common?.baseFeeValue ?? 0)
    .shiftedBy(
      common?.feeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.feeDecimals missing'),
    ) // GWEI -> onChainValue
    .shiftedBy(
      -(
        common?.nativeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.nativeDecimals missing')
      ),
    ) // onChainValue -> nativeAmount
    .toFixed(displayDecimal);
}

export function calculateFeeForSend({
  feeInfo,
  nativeTokenPrice,
  nativeDisplayDecimal = 8,
  fiatDisplayDecimal = 2,
}: {
  feeInfo: IFeeInfoUnit;
  nativeTokenPrice: number;
  nativeDisplayDecimal?: number;
  fiatDisplayDecimal?: number;
}) {
  const feeRange = calculateTotalFeeRange(feeInfo);
  const total = feeRange.max;
  const totalForDisplay = feeRange.maxForDisplay;
  const totalNative = calculateTotalFeeNative({
    amount: total,
    feeInfo,
    displayDecimal: nativeDisplayDecimal,
  });
  const totalNativeForDisplay = calculateTotalFeeNative({
    amount: totalForDisplay,
    feeInfo,
    displayDecimal: nativeDisplayDecimal,
  });
  const totalFiatForDisplay = new BigNumber(totalNativeForDisplay)
    .multipliedBy(nativeTokenPrice)
    .toFixed(fiatDisplayDecimal);

  return {
    total,
    totalForDisplay,
    totalNative,
    totalNativeForDisplay,
    totalFiatForDisplay,
    feeRange,
  };
}

export function getFeeLabel({
  feeType,
  presetIndex,
}: {
  feeType: EFeeType;
  presetIndex?: number;
}) {
  if (feeType === EFeeType.Custom) {
    return 'content__custom';
  }

  return PRESET_FEE_LABEL[presetIndex ?? 1] as ILocaleIds;
}
export function getFeeIcon({
  feeType,
  presetIndex,
}: {
  feeType: EFeeType;
  presetIndex?: number;
}) {
  if (feeType === EFeeType.Custom) {
    return '⚙️';
  }

  return PRESET_FEE_ICON[presetIndex ?? 1];
}
export function getFeeConfidenceLevelStyle(confidence: number) {
  if (confidence <= 70) {
    return {
      badgeType: 'critical',
    };
  }
  if (confidence <= 90) {
    return {
      badgeType: 'warning',
    };
  }

  return {
    badgeType: 'success',
  };
}
