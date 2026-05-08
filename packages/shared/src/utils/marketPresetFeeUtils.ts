import BigNumber from 'bignumber.js';

import type { IEstimateFeeParams } from '../../types/fee';
import type { ISwapGasInfo } from '../../types/swap/types';

const EVM_GWEI_DECIMALS = 9;

export const MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE = '999999999';

export type ICustomPriorityFeeOverride = {
  customValue: string;
};

export function isValidMarketPresetCustomPriorityFeeValue(value?: string) {
  if (!value) {
    return false;
  }

  const valueBN = new BigNumber(value);
  return (
    valueBN.isFinite() &&
    valueBN.gt(0) &&
    valueBN.lte(MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE)
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
    !isValidMarketPresetCustomPriorityFeeValue(customPriorityFee.customValue)
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
