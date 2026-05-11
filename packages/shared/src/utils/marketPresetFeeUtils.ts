import BigNumber from 'bignumber.js';

import type { IEstimateFeeParams } from '../../types/fee';
import type { ISwapGasInfo } from '../../types/swap/types';

const EVM_GWEI_DECIMALS = 9;

export const MARKET_PRESET_CUSTOM_PRIORITY_FEE_MIN_VALUE = '0';
export const MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE = '1000';

export type IMarketPresetCustomPriorityFeeRangeValue = string | number;

export type IMarketPresetCustomPriorityFeeRange = {
  min?: IMarketPresetCustomPriorityFeeRangeValue;
  max?: IMarketPresetCustomPriorityFeeRangeValue;
};

export type ICustomPriorityFeeOverride = {
  customValue: string;
  customRange?: IMarketPresetCustomPriorityFeeRange;
};

export function normalizeMarketPresetCustomPriorityFeeRange(
  range?: IMarketPresetCustomPriorityFeeRange,
) {
  const defaultMinBN = new BigNumber(
    MARKET_PRESET_CUSTOM_PRIORITY_FEE_MIN_VALUE,
  );
  const defaultMaxBN = new BigNumber(
    MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE,
  );
  const rawMinBN = new BigNumber(
    range?.min ?? MARKET_PRESET_CUSTOM_PRIORITY_FEE_MIN_VALUE,
  );
  const rawMaxBN = new BigNumber(
    range?.max ?? MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE,
  );
  const minBN =
    rawMinBN.isFinite() && rawMinBN.gte(defaultMinBN) ? rawMinBN : defaultMinBN;

  if (rawMaxBN.isFinite() && rawMaxBN.gt(minBN)) {
    return {
      min: minBN.toFixed(),
      max: rawMaxBN.toFixed(),
    };
  }

  if (range?.max === undefined && defaultMaxBN.gt(minBN)) {
    return {
      min: minBN.toFixed(),
      max: MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE,
    };
  }

  return {
    min: MARKET_PRESET_CUSTOM_PRIORITY_FEE_MIN_VALUE,
    max: MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE,
  };
}

export function isValidMarketPresetCustomPriorityFeeValue({
  value,
  range,
}: {
  value?: string;
  range?: IMarketPresetCustomPriorityFeeRange;
}) {
  if (!value) {
    return false;
  }

  const valueBN = new BigNumber(value);
  const normalizedRange = normalizeMarketPresetCustomPriorityFeeRange(range);
  return (
    valueBN.isFinite() &&
    valueBN.gt(normalizedRange.min) &&
    valueBN.lte(normalizedRange.max)
  );
}

function convertEvmCustomPriorityFeeToFeeUnit({
  value,
  feeDecimals,
}: {
  value: BigNumber;
  feeDecimals?: number;
}) {
  return value
    .shiftedBy(EVM_GWEI_DECIMALS - (feeDecimals ?? EVM_GWEI_DECIMALS))
    .toFixed();
}

export function applyCustomPriorityFeeToGasInfo({
  gasInfo,
  customPriorityFee,
  estimateFeeParams,
}: {
  gasInfo: ISwapGasInfo;
  customPriorityFee?: ICustomPriorityFeeOverride;
  estimateFeeParams?: IEstimateFeeParams;
}): ISwapGasInfo {
  const customValueBN = new BigNumber(
    customPriorityFee?.customValue ?? Number.NaN,
  );
  // Defense in depth: upstream override creation should already apply the same
  // range, but reject invalid persisted values before touching gas params.
  if (
    !customPriorityFee ||
    !isValidMarketPresetCustomPriorityFeeValue({
      value: customPriorityFee.customValue,
      range: customPriorityFee.customRange,
    })
  ) {
    return gasInfo;
  }

  if (gasInfo.gasEIP1559) {
    const maxPriorityFeePerGas = convertEvmCustomPriorityFeeToFeeUnit({
      value: customValueBN,
      feeDecimals: gasInfo.common?.feeDecimals,
    });
    const baseFeePerGas = new BigNumber(gasInfo.gasEIP1559.baseFeePerGas ?? 0);
    return {
      ...gasInfo,
      gasEIP1559: {
        ...gasInfo.gasEIP1559,
        maxPriorityFeePerGas,
        maxFeePerGas: baseFeePerGas
          .times(2)
          .plus(maxPriorityFeePerGas)
          .toFixed(),
      },
    };
  }

  if (gasInfo.gas) {
    return {
      ...gasInfo,
      gas: {
        ...gasInfo.gas,
        gasPrice: convertEvmCustomPriorityFeeToFeeUnit({
          value: customValueBN,
          feeDecimals: gasInfo.common?.feeDecimals,
        }),
      },
    };
  }

  const solEstimateParams = estimateFeeParams?.estimateFeeParamsSol;
  const computeUnitLimitBN = new BigNumber(
    solEstimateParams?.computeUnitLimit ?? Number.NaN,
  );
  if (
    gasInfo.feeSol &&
    !computeUnitLimitBN.isNaN() &&
    computeUnitLimitBN.gt(0)
  ) {
    const computeUnitPrice = customValueBN
      .shiftedBy(gasInfo.common?.nativeDecimals ?? 9)
      .shiftedBy(solEstimateParams?.computeUnitPriceDecimals ?? 6)
      .dividedBy(computeUnitLimitBN)
      .decimalPlaces(0, BigNumber.ROUND_CEIL)
      .toFixed();
    return {
      ...gasInfo,
      feeSol: {
        ...gasInfo.feeSol,
        computeUnitPrice,
      },
    };
  }

  return gasInfo;
}
