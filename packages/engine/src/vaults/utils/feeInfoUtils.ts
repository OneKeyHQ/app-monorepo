import BigNumber from 'bignumber.js';

import type { EIP1559Fee, Network } from '../../types/network';
import type { IFeeInfo, IFeeInfoUnit } from '../types';

function nilError(message: string): number {
  throw new Error(message);
}

// onChainValue -> GWEI
export function convertFeeValueToGwei({
  value,
  network,
}: {
  value: string | BigNumber;
  network: Network;
}) {
  return new BigNumber(value)
    .shiftedBy(
      -network.feeDecimals ??
        nilError('convertFeeValueToGwei ERROR: network.feeDecimals missing'),
    )
    .toFixed();
}

// GWEI -> onChainValue
export function convertFeeGweiToValue({
  value,
  network,
}: {
  value: string | BigNumber;
  network: Network;
}) {
  return new BigNumber(value)
    .shiftedBy(
      network.feeDecimals ??
        nilError('convertFeeGweiToValue ERROR: network.feeDecimals missing'),
    )
    .toFixed();
}

// onChainValue -> nativeAmount
export function convertFeeValueToNative({
  value,
  network,
}: {
  value: string | BigNumber;
  network: Network;
}) {
  return new BigNumber(value)
    .shiftedBy(
      -network.decimals ??
        nilError('convertFeeValueToNative ERROR: network.decimals missing'),
    )
    .toFixed();
}

// nativeAmount -> onChainValue
export function convertFeeNativeToValue({
  value,
  network,
}: {
  value: string | BigNumber;
  network: Network;
}) {
  return new BigNumber(value)
    .shiftedBy(
      network.decimals ??
        nilError('convertFeeNativeToValue ERROR: network.decimals missing'),
    )
    .toFixed();
}

export function calculateTotalFeeNative({
  amount, // in GWEI
  info,
  decimal = 8,
}: {
  amount: string | BigNumber;
  info: IFeeInfo;
  decimal?: number;
}) {
  return new BigNumber(amount)
    .plus(info.baseFeeValue ?? 0)
    .shiftedBy(
      info.feeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.feeDecimals missing'),
    ) // GWEI -> onChainValue
    .shiftedBy(
      -(
        info.nativeDecimals ??
        nilError('calculateTotalFeeNative ERROR: info.nativeDecimals missing')
      ),
    ) // onChainValue -> nativeAmount
    .toFixed(decimal);
}

function nanToZeroString(value: string | number | unknown) {
  if (value === 'NaN' || Number.isNaN(value)) {
    return '0';
  }
  return value as string;
}

export function calculateTotalFeeRange(
  feeValue: IFeeInfoUnit,
  displayDecimals = 8,
) {
  const limit = feeValue.limitUsed || feeValue.limit;
  const limitForDisplay = feeValue.limitForDisplay ?? limit;
  if (feeValue.eip1559) {
    // MIN: (baseFee + maxPriorityFeePerGas) * limit
    const priceInfo = feeValue.price1559 as EIP1559Fee;
    const min = new BigNumber(limit as string)
      .times(
        new BigNumber(priceInfo.baseFee).plus(priceInfo.maxPriorityFeePerGas),
      )
      .toFixed(displayDecimals);

    const minForDisplay = new BigNumber(limitForDisplay as string)
      .times(
        new BigNumber(priceInfo.baseFee).plus(priceInfo.maxPriorityFeePerGas),
      )
      .toFixed(displayDecimals);

    // MAX: maxFeePerGas * limit
    const max = new BigNumber(limit as string)
      .times(priceInfo.gasPrice || priceInfo.maxFeePerGas)
      .toFixed(displayDecimals);

    const maxForDisplay = new BigNumber(limitForDisplay as string)
      .times(priceInfo.gasPrice || priceInfo.maxFeePerGas)
      .toFixed(displayDecimals);
    return {
      min: nanToZeroString(min),
      max: nanToZeroString(max),
      minForDisplay: nanToZeroString(minForDisplay),
      maxForDisplay: nanToZeroString(maxForDisplay),
    };
  }

  if (feeValue.isBtcForkChain) {
    const fee = new BigNumber(feeValue.btcFee ?? '0')
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
    .times(feeValue.price as string)
    .toFixed();

  const maxForDisplay = new BigNumber(limitForDisplay as string)
    .times(feeValue.price as string)
    .toFixed();

  return {
    min: nanToZeroString(max),
    max: nanToZeroString(max),
    minForDisplay: nanToZeroString(maxForDisplay),
    maxForDisplay: nanToZeroString(maxForDisplay),
  };
}
