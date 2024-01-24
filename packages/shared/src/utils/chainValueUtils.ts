import BigNumber from 'bignumber.js';

import type { IServerNetwork } from '../../types';
import { IToken } from '../../types/token';

function nilError(message: string): number {
  throw new Error(message);
}

export interface IChainValueConvertOptions {
  value: string | BigNumber;
  network: IServerNetwork;
}

export interface ITokenChainValueConvertOptions {
  value: string | BigNumber;
  token: IToken;
}

// onChainValue -> GWEI
function convertChainValueToGwei({
  value,
  network,
}: IChainValueConvertOptions) {
  return new BigNumber(value)
    .shiftedBy(
      -network.feeMeta.decimals ??
        nilError('convertFeeValueToGwei ERROR: network.feeDecimals missing'),
    )
    .toFixed();
}

// GWEI -> onChainValue
function convertGweiToChainValue({
  value,
  network,
}: IChainValueConvertOptions) {
  return new BigNumber(value)
    .shiftedBy(
      network.feeMeta.decimals ??
        nilError('convertFeeGweiToValue ERROR: network.feeDecimals missing'),
    )
    .toFixed();
}

// onChainValue -> nativeAmount
function convertChainValueToAmount({
  value,
  network,
}: IChainValueConvertOptions) {
  return new BigNumber(value)
    .shiftedBy(
      -network.decimals ??
        nilError('convertFeeValueToNative ERROR: network.decimals missing'),
    )
    .toFixed();
}

// nativeAmount -> onChainValue
function convertAmountToChainValue({
  value,
  network,
}: IChainValueConvertOptions) {
  return new BigNumber(value)
    .shiftedBy(
      network.decimals ??
        nilError('convertFeeNativeToValue ERROR: network.decimals missing'),
    )
    .toFixed();
}

function convertGweiToAmount(options: IChainValueConvertOptions) {
  const chainValue = convertGweiToChainValue(options);
  return convertChainValueToAmount({
    network: options.network,
    value: chainValue,
  });
}

function convertAmountToGwei(options: IChainValueConvertOptions) {
  const chainValue = convertAmountToChainValue(options);
  return convertChainValueToGwei({
    network: options.network,
    value: chainValue,
  });
}

function convertTokenChainValueToAmount({
  value,
  token,
}: ITokenChainValueConvertOptions) {
  return new BigNumber(value)
    .shiftedBy(
      -token.decimals ??
        nilError(
          'convertTokenChainValueToAmount ERROR: token.decimals missing',
        ),
    )
    .toFixed();
}

export default {
  convertAmountToChainValue,
  convertChainValueToAmount,
  convertChainValueToGwei,
  convertGweiToChainValue,
  convertGweiToAmount,
  convertAmountToGwei,
  convertTokenChainValueToAmount,
};
