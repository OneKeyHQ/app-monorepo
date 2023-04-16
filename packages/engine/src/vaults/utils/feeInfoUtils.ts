import BigNumber from 'bignumber.js';

import type { EIP1559Fee, Network } from '../../types/network';
import type { IFeeInfo, IFeeInfoUnit } from '../types';

// onChainValue -> GWEI
export function convertFeeValueToGwei({
  value,
  network,
}: {
  value: string;
  network: Network;
}) {
  return new BigNumber(value).shiftedBy(-network.feeDecimals ?? 0).toFixed();
}

// GWEI -> onChainValue
export function convertFeeGweiToValue({
  value,
  network,
}: {
  value: string;
  network: Network;
}) {
  return new BigNumber(value).shiftedBy(network.feeDecimals ?? 0).toFixed();
}

// onChainValue -> nativeAmount
export function convertFeeValueToNative({
  value,
  network,
}: {
  value: string;
  network: Network;
}) {
  return new BigNumber(value).shiftedBy(-network.decimals ?? 0).toFixed();
}

// nativeAmount -> onChainValue
export function convertFeeNativeToValue({
  value,
  network,
}: {
  value: string;
  network: Network;
}) {
  return new BigNumber(value).shiftedBy(network.decimals ?? 0).toFixed();
}

export function calculateTotalFeeNative({
  amount, // in GWEI
  info,
  decimal = 8,
}: {
  amount: string;
  info: IFeeInfo;
  decimal?: number;
}) {
  return new BigNumber(amount)
    .plus(info.baseFeeValue ?? 0)
    .shiftedBy(info.feeDecimals ?? 0) // GWEI -> onChainValue
    .shiftedBy(-(info.nativeDecimals ?? 0)) // onChainValue -> nativeAmount
    .toFixed(decimal);
}

function nanToZeroString(value: string | number | unknown) {
  if (value === 'NaN' || Number.isNaN(value)) {
    return '0';
  }
  return value as string;
}

export function calculateTotalFeeRange(feeValue: IFeeInfoUnit, decimal = 8) {
  const limit = feeValue.limitUsed || feeValue.limit;
  if (feeValue.eip1559) {
    // MIN: (baseFee + maxPriorityFeePerGas) * limit
    const priceInfo = feeValue.price1559 as EIP1559Fee;
    const min = new BigNumber(limit as string)
      .times(
        new BigNumber(priceInfo.baseFee).plus(priceInfo.maxPriorityFeePerGas),
      )
      .toFixed(decimal);

    // MAX: maxFeePerGas * limit
    const max = new BigNumber(limit as string)
      .times(priceInfo.gasPrice || priceInfo.maxFeePerGas)
      .toFixed(decimal);
    return {
      min: nanToZeroString(min),
      max: nanToZeroString(max),
    };
  }

  if (feeValue.isBtcForkChain) {
    const fee = new BigNumber(feeValue.btcFee ?? '0')
      .shiftedBy(-decimal)
      .toFixed(decimal);
    return {
      min: nanToZeroString(fee),
      max: nanToZeroString(fee),
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
