import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EFeeType } from '@onekeyhq/shared/types/fee';
import type {
  IEstimateFeeParams,
  IFeeInfoUnit,
  IGasEIP1559,
  IGasLegacy,
} from '@onekeyhq/shared/types/fee';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

const PRESET_FEE_ICON = ['🚀', '🚗', '🐢'];
const PRESET_FEE_LABEL = [
  ETranslations.content__fast,
  ETranslations.content__normal,
  ETranslations.content__slow,
];

function nilError(message: string): number {
  throw new Error(message);
}

function nanToZeroString(value: string | number | unknown) {
  if (value === 'NaN' || Number.isNaN(value)) {
    return '0';
  }
  return value as string;
}

export function calculateSolTotalFee({
  computeUnitPrice,
  computeUnitLimit,
  computeUnitPriceDecimals,
  baseFee,
  feeInfo,
}: {
  computeUnitPrice: string | BigNumber;
  computeUnitLimit: string | BigNumber;
  computeUnitPriceDecimals: number | BigNumber;
  baseFee: string | BigNumber;
  feeInfo: IFeeInfoUnit;
}) {
  return new BigNumber(computeUnitPrice)
    .times(computeUnitLimit)
    .shiftedBy(-computeUnitPriceDecimals)
    .plus(baseFee)
    .shiftedBy(-feeInfo.common.feeDecimals)
    .toFixed();
}

export function calculateTotalFeeRange({
  feeInfo,
  txSize,
  estimateFeeParams,
}: {
  feeInfo: IFeeInfoUnit;
  txSize?: number;
  estimateFeeParams?: IEstimateFeeParams;
}) {
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
      .toFixed();

    const minForDisplay = new BigNumber(limitForDisplay)
      .times(
        new BigNumber(gasInfo.baseFeePerGas).plus(gasInfo.maxPriorityFeePerGas),
      )
      .toFixed();

    // MAX: maxFeePerGas * limit
    const max = new BigNumber(limit).times(gasInfo.maxFeePerGas).toFixed();

    const maxForDisplay = new BigNumber(limitForDisplay)
      .times(gasInfo.maxFeePerGas)
      .toFixed();

    return {
      min: nanToZeroString(min),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(minForDisplay),
      maxForDisplay: nanToZeroString(maxForDisplay),
    };
  }

  if (feeInfo.feeUTXO?.feeRate) {
    const fee = new BigNumber(feeInfo.feeUTXO.feeRate)
      .multipliedBy(txSize ?? 0)
      .decimalPlaces(feeInfo.common.feeDecimals, BigNumber.ROUND_CEIL)
      .toFixed();
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

  if (feeInfo.gasFil) {
    const gasInfo = feeInfo.gasFil;
    const limit = gasInfo.gasLimit;
    const max = new BigNumber(limit).times(gasInfo.gasFeeCap).toFixed();

    return {
      min: nanToZeroString(max),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(max),
      maxForDisplay: nanToZeroString(max),
    };
  }
  if (feeInfo.feeSol && estimateFeeParams?.estimateFeeParamsSol) {
    const { computeUnitPrice } = feeInfo.feeSol;
    const { computeUnitLimit, baseFee, computeUnitPriceDecimals } =
      estimateFeeParams.estimateFeeParamsSol;
    const max = calculateSolTotalFee({
      computeUnitLimit,
      computeUnitPrice,
      computeUnitPriceDecimals,
      baseFee,
      feeInfo,
    });

    return {
      min: nanToZeroString(max),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(max),
      maxForDisplay: nanToZeroString(max),
      withoutBaseFee: true,
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
  withoutBaseFee,
}: {
  amount: string | BigNumber;
  feeInfo: IFeeInfoUnit;
  withoutBaseFee?: boolean;
}) {
  const { common } = feeInfo;
  return new BigNumber(amount)
    .plus(withoutBaseFee ? 0 : common?.baseFee ?? 0)
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
    .toFixed();
}

export function calculateFeeForSend({
  feeInfo,
  nativeTokenPrice,
  txSize,
  estimateFeeParams,
}: {
  feeInfo: IFeeInfoUnit;
  nativeTokenPrice: number;
  txSize?: number;
  estimateFeeParams?: IEstimateFeeParams;
}) {
  const feeRange = calculateTotalFeeRange({
    feeInfo,
    txSize,
    estimateFeeParams,
  });
  const total = feeRange.max;
  const totalForDisplay = feeRange.maxForDisplay;
  const totalNative = calculateTotalFeeNative({
    amount: total,
    feeInfo,
    withoutBaseFee: feeRange.withoutBaseFee,
  });
  const totalNativeForDisplay = calculateTotalFeeNative({
    amount: totalForDisplay,
    feeInfo,
    withoutBaseFee: feeRange.withoutBaseFee,
  });
  const totalFiat = new BigNumber(totalNative)
    .multipliedBy(nativeTokenPrice)
    .toFixed();
  const totalFiatForDisplay = new BigNumber(totalNativeForDisplay)
    .multipliedBy(nativeTokenPrice)
    .toFixed();

  return {
    total,
    totalForDisplay,
    totalNative,
    totalFiat,
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
    return ETranslations.global_advanced;
  }

  return PRESET_FEE_LABEL[presetIndex ?? 1] ?? PRESET_FEE_LABEL[0];
}
export function getFeeIcon({
  feeType,
  presetIndex,
}: {
  feeType: EFeeType;
  presetIndex?: number;
}) {
  if (feeType === EFeeType.Custom) {
    return '🔧';
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

export function getFeePriceNumber({ feeInfo }: { feeInfo: IFeeInfoUnit }) {
  if (feeInfo.gasEIP1559) {
    return new BigNumber(feeInfo.gasEIP1559.baseFeePerGas || 0)
      .plus(feeInfo.gasEIP1559.maxPriorityFeePerGas || 0)
      .toFixed();
  }

  if (feeInfo.gas) {
    return feeInfo.gas.gasPrice;
  }

  if (feeInfo.feeUTXO) {
    return feeInfo.feeUTXO.feeRate;
  }

  if (feeInfo.feeSol) {
    return feeInfo.common.baseFee;
  }
}

export function getMaxSendFeeUpwardAdjustmentFactor({
  networkId,
}: {
  networkId: string;
}) {
  const networkIdMap = getNetworkIdsMap();
  switch (networkId) {
    case networkIdMap.mantle:
      return 1.2;
    default:
      return 1;
  }
}
